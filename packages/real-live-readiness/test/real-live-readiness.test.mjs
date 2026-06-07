import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { evaluateRealLiveReadiness, isRealLiveReady, createReadinessAuditLog, READINESS_RESOURCE, ACTIVATION_COMMAND_REF } from '../src/index.mjs';
import { createAuditLog } from '../../data/src/index.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';
import { API_ERROR_CODE, RESOURCE_TYPE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const ready = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'readiness-scenario.json'), 'utf8')).ready_input;
const codes = (v) => v.blockers.map((b) => b.code);

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

test('ready ONLY when all conditions are green/ACTIVE/valid', () => {
  const v = evaluateRealLiveReadiness(ready());
  assert.equal(v.ready, true);
  assert.deepEqual(v.blockers, []);
  assert.equal(v.prerequisite_for, 'activate_real_live');
  assert.equal(isRealLiveReady(ready()), true);
});

test('missing input => not ready (fail-safe)', () => {
  assert.equal(evaluateRealLiveReadiness({}).ready, false);
  // every single field omitted individually trips not-ready
  for (const k of Object.keys(ready())) {
    const input = { ...ready() }; delete input[k];
    assert.equal(evaluateRealLiveReadiness(input).ready, false, `omitting ${k} must be not ready`);
  }
});

test('real_live_config_valid=false => not ready + REAL_LIVE_CONFIG_INVALID blocker', () => {
  const v = evaluateRealLiveReadiness({ ...ready(), real_live_config_valid: false });
  assert.equal(v.ready, false);
  assert.ok(codes(v).includes('REAL_LIVE_CONFIG_INVALID'));
  assert.ok(API_ERROR_CODE.includes('REAL_LIVE_CONFIG_INVALID'));
});

test('config validation_status not valid => not ready', () => {
  for (const s of ['warning', 'invalid', undefined, 'bogus']) {
    const v = evaluateRealLiveReadiness({ ...ready(), validation_status: s });
    assert.equal(v.ready, false);
    assert.ok(codes(v).includes('config_validation_invalid'));
  }
});

test('signer DEGRADED/DISABLED/REVOKED (or unknown) => not ready', () => {
  for (const s of ['DEGRADED', 'DISABLED', 'REVOKED', undefined]) {
    const v = evaluateRealLiveReadiness({ ...ready(), signer_profile_status: s });
    assert.equal(v.ready, false);
    assert.ok(codes(v).includes('signer_profile_not_active'), `signer ${s}`);
  }
});

test('execution wallet not ACTIVE => not ready', () => {
  for (const s of ['WARMING_UP', 'DISABLED', 'DRAINING', 'RETIRED', 'REVOKED']) {
    const v = evaluateRealLiveReadiness({ ...ready(), execution_wallet_status: s });
    assert.equal(v.ready, false);
    assert.ok(codes(v).includes('execution_wallet_not_active'), `wallet ${s}`);
  }
});

test('operating_state EXITS_ONLY/KILLED/PAUSED/WARMING_UP => not ready', () => {
  for (const s of ['EXITS_ONLY', 'KILLED', 'PAUSED', 'WARMING_UP']) {
    const v = evaluateRealLiveReadiness({ ...ready(), operating_state: s });
    assert.equal(v.ready, false);
    assert.ok(codes(v).includes('operating_state_not_ready'), `state ${s}`);
  }
});

test('provider_degraded=true => not ready', () => {
  const v = evaluateRealLiveReadiness({ ...ready(), provider_degraded: true });
  assert.equal(v.ready, false);
  assert.ok(codes(v).includes('provider_degraded'));
});

test('protocol_constant_status=changed => not ready', () => {
  const v = evaluateRealLiveReadiness({ ...ready(), protocol_constant_status: 'changed' });
  assert.equal(v.ready, false);
  assert.ok(codes(v).includes('protocol_constant_changed'));
});

test('slot_lag above threshold (or non-numeric) => not ready', () => {
  assert.ok(codes(evaluateRealLiveReadiness({ ...ready(), slot_lag: 6, slot_lag_max: 5 })).includes('slot_lag_exceeded'));
  assert.ok(codes(evaluateRealLiveReadiness({ ...ready(), slot_lag: undefined })).includes('slot_lag_exceeded'));
  assert.ok(codes(evaluateRealLiveReadiness({ ...ready(), slot_lag_max: undefined })).includes('slot_lag_exceeded'));
  // at threshold is acceptable
  assert.equal(evaluateRealLiveReadiness({ ...ready(), slot_lag: 5, slot_lag_max: 5 }).ready, true);
});

test('audit path unavailable => not ready', () => {
  assert.ok(codes(evaluateRealLiveReadiness({ ...ready(), audit_path_available: false })).includes('audit_path_unavailable'));
});

test('admission incomplete => not ready', () => {
  assert.ok(codes(evaluateRealLiveReadiness({ ...ready(), admission_complete: false })).includes('admission_incomplete'));
});

test('operator checklist incomplete => not ready', () => {
  assert.ok(codes(evaluateRealLiveReadiness({ ...ready(), operator_checklist_complete: false })).includes('operator_checklist_incomplete'));
});

test('multiple failures accumulate multiple blockers', () => {
  const v = evaluateRealLiveReadiness({});
  assert.equal(v.ready, false);
  assert.ok(v.blockers.length >= 10);
});

test('optional readiness audit is append-only; resource_type/audit_scope=readiness', () => {
  const auditLog = createAuditLog();
  evaluateRealLiveReadiness(ready(), { auditLog, audit_actor: 'operator-dev-1' });
  evaluateRealLiveReadiness({}, { auditLog, audit_actor: 'operator-dev-1' });
  const entries = auditLog.list();
  assert.equal(entries.length, 2);
  for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof auditLog[m], 'undefined');
  for (const e of entries) {
    for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k} not in AUDIT_COLUMNS`);
    assert.equal(e.resource_type, 'readiness');
    assert.equal(e.audit_scope, 'readiness');
  }
  assert.ok(RESOURCE_TYPE.includes('readiness'));
  assert.equal(READINESS_RESOURCE, 'readiness');
  // no audit without an actor
  const a2 = createAuditLog();
  evaluateRealLiveReadiness(ready(), { auditLog: a2 });
  assert.equal(a2.list().length, 0);
});

test('evaluator does not activate and does not mutate input/state', () => {
  const input = ready();
  const snapshot = JSON.stringify(input);
  const v = evaluateRealLiveReadiness(input);
  assert.equal(JSON.stringify(input), snapshot); // input untouched
  assert.equal(ACTIVATION_COMMAND_REF, 'activate_real_live'); // reference only
  // verdict is frozen / read-only
  assert.throws(() => { v.ready = false; });
  // no execution-authority / activation surface exported
  for (const k of ['activate', 'activateRealLive', 'sign', 'send', 'execute', 'trigger']) {
    // module namespace check happens below in code scan; here ensure verdict has no such methods
    assert.equal(typeof v[k], 'undefined');
  }
});

// ---- code governance scans (comment/string-stripped) ----

test('CODE: no KeyManager/key material/signing-lib/signing/sending/serialization/tx-build/RPC/DB', () => {
  const BAD = /(KeyManager|KMS|private[_-]?key|secret[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|@noble|tweetnacl|bs58|ed25519|web3|signTransaction|sendTransaction|sendRawTransaction|\bsign\s*\(|\.serialize\(|buildTransaction|new\s+Transaction|@solana\/|jupiter|helius|jito|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: does not INVOKE activate_real_live (reference string only); no mechanism-guard carve-out; no candidate_*', () => {
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    // activate_real_live must not appear as a call in code (strings are stripped, so any residue is a call)
    assert.equal(/activate_real_live\s*\(/.test(code), false, `activate_real_live invoked in ${fn}`);
    assert.equal(/candidate_/.test(code), false, `candidate_* in ${fn}`);
    assert.equal(/check-mechanism-guards|allowlist|carve[_-]?out/i.test(code), false, `mechanism-guard carve-out in ${fn}`);
  }
});

test('CODE: no forbidden SSOT names; no secrets in fixture', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'readiness-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b)/i.test(fx), false, 'secret-like content in fixture');
});
