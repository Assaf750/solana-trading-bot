import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createSignerServiceBoundary } from '../src/index.mjs';
import { createAuditLog } from '../../data/src/index.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';
import { RESOURCE_TYPE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';
import { runMechanismGuard, ALLOWLIST } from '../../../tools/check-mechanism-guards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const valid = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'signer-request-scenario.json'), 'utf8')).valid_request;

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

const ALWAYS_FALSE = (r) => {
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
  assert.equal(r.is_valid_on_chain, false);
  assert.equal(r.can_sign, false);
  assert.equal(r.can_send, false);
};

test('capabilities can never sign or send', () => {
  const sb = createSignerServiceBoundary();
  assert.deepEqual(sb.capabilities(), { can_sign: false, can_send: false, mock: true });
});

test('boundary NEVER signs/sends: every result is the non-signature envelope', () => {
  const sb = createSignerServiceBoundary();
  ALWAYS_FALSE(sb.requestSign(valid()));                           // valid path
  ALWAYS_FALSE(sb.requestSign({ ...valid(), risk_approved: false })); // refused path
  ALWAYS_FALSE(sb.requestSign({}));                                // empty
  // a fully-valid request still produces no signature, only contract_valid
  const ok = sb.requestSign(valid());
  assert.equal(ok.contract_valid, true);
  assert.equal(ok.signature, null);
  // no sign()/send()/submit()/serialize() surface
  for (const k of ['sign', 'send', 'submit', 'serialize', 'buildTransaction', 'loadKey']) {
    assert.equal(typeof sb[k], 'undefined', `boundary must not expose ${k}()`);
  }
});

test('no signing before Risk checks: risk_approved missing/false => refused (contract_valid false)', () => {
  const sb = createSignerServiceBoundary();
  assert.equal(sb.requestSign({ ...valid(), risk_approved: false }).refusal_reason, 'risk_not_approved');
  const noRisk = { ...valid() }; delete noRisk.risk_approved;
  assert.equal(sb.requestSign(noRisk).refusal_reason, 'risk_not_approved');
});

test('any non-ACTIVE status (signer/wallet/operating) or invalid config => refused', () => {
  const sb = createSignerServiceBoundary();
  for (const s of ['DEGRADED', 'DISABLED', 'REVOKED']) assert.equal(sb.requestSign({ ...valid(), signer_profile_status: s }).refusal_reason, 'signer_not_active');
  for (const s of ['WARMING_UP', 'DRAINING', 'RETIRED', 'REVOKED', 'DISABLED']) assert.equal(sb.requestSign({ ...valid(), execution_wallet_status: s }).refusal_reason, 'execution_wallet_not_active');
  for (const s of ['EXITS_ONLY', 'KILLED', 'PAUSED', 'WARMING_UP']) assert.equal(sb.requestSign({ ...valid(), operating_state: s }).refusal_reason, 'operating_state_not_active');
  assert.equal(sb.requestSign({ ...valid(), real_live_config_valid: false }).refusal_reason, 'real_live_config_invalid');
  // unknown enum values are refused too
  assert.equal(sb.requestSign({ ...valid(), signer_profile_status: 'bogus' }).refusal_reason, 'invalid_signer_profile_status');
});

test('stale approval => refused; missing freshness inputs => refused', () => {
  const sb = createSignerServiceBoundary();
  assert.equal(sb.requestSign({ ...valid(), approval_age_slots: 6, max_approval_age_slots: 5 }).refusal_reason, 'approval_stale');
  const noFresh = { ...valid() }; delete noFresh.approval_age_slots;
  assert.equal(sb.requestSign(noFresh).refusal_reason, 'approval_freshness_missing');
  assert.equal(sb.requestSign({ ...valid(), approval_age_slots: 5, max_approval_age_slots: 5 }).contract_valid, true); // at threshold ok
});

test('payload digest/reference mismatch or missing => refused', () => {
  const sb = createSignerServiceBoundary();
  assert.equal(sb.requestSign({ ...valid(), payload_digest: 'ref-a', approved_payload_digest: 'ref-b' }).refusal_reason, 'payload_binding_mismatch');
  const noDigest = { ...valid() }; delete noDigest.payload_digest;
  assert.equal(sb.requestSign(noDigest).refusal_reason, 'payload_binding_missing');
});

test('missing intent_id / idempotency_key => refused', () => {
  const sb = createSignerServiceBoundary();
  const noIntent = { ...valid() }; delete noIntent.intent_id;
  assert.equal(sb.requestSign(noIntent).refusal_reason, 'missing_intent_id');
  const noIdem = { ...valid() }; delete noIdem.idempotency_key;
  assert.equal(sb.requestSign(noIdem).refusal_reason, 'missing_idempotency_key');
});

test('key material in the request is refused and never stored', () => {
  const sb = createSignerServiceBoundary();
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair', 'secretKey']) {
    const r = sb.requestSign({ ...valid(), [k]: 'SHOULD_NEVER' });
    assert.equal(r.refusal_reason, 'key_material_not_accepted');
    ALWAYS_FALSE(r);
  }
});

test('audit before AND after for every attributed attempt (success and refusal); keys in AUDIT_COLUMNS', () => {
  const auditLog = createAuditLog();
  const sb = createSignerServiceBoundary({ auditLog });
  sb.requestSign(valid());                                   // 2 entries (before+after)
  sb.requestSign({ ...valid(), risk_approved: false });      // 2 entries (before+after refused)
  const entries = auditLog.list();
  assert.equal(entries.length, 4);
  for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof auditLog[m], 'undefined');
  for (const e of entries) {
    for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k} not in AUDIT_COLUMNS`);
    assert.equal(e.resource_type, 'signer_profile');
    assert.equal(e.audit_scope, 'signer_profile');
  }
  assert.ok(RESOURCE_TYPE.includes('signer_profile'));
  assert.ok(entries[0].audit_reason.startsWith('signer_request_before'));
  assert.ok(entries[1].audit_reason.startsWith('signer_request_after:contract_valid'));
  assert.ok(entries[3].audit_reason.includes('refused:risk_not_approved'));
});

test('missing audit_actor => refused before any audit (no audit entries)', () => {
  const auditLog = createAuditLog();
  const sb = createSignerServiceBoundary({ auditLog });
  const noActor = { ...valid() }; delete noActor.audit_actor;
  const r = sb.requestSign(noActor);
  assert.equal(r.refusal_reason, 'audit_actor_required');
  assert.equal(auditLog.list().length, 0);
  ALWAYS_FALSE(r);
});

// ---- allowlist / guard invariants ----

test('this package is NOT allowlisted; the active allowlist holds only the isolated-signer path (B8)', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  // post-B8 the active allowlist contains exactly ONE path: the isolated-signer path, NOT this package
  assert.equal(res.counts.allowlist, 1);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
  // the boundary source files are scanned (not exempt) and pass
  assert.ok(res.counts.sources > 0);
});

// ---- code governance scans (comment/string-stripped) ----

test('CODE: no crypto/signing library, no real signing/sending, no tx build/serialize, no KeyManager/KMS, no RPC/DB', () => {
  const BAD = /(KeyManager|\bKMS\b|@noble|tweetnacl|bs58|ed25519|web3|@solana\/|jupiter|helius|jito|signTransaction|signAllTransactions|partialSign|sendTransaction|sendRawTransaction|\.serialize\(|buildTransaction|new\s+Transaction|VersionedTransaction|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|node:crypto|createHash|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: no key material literals; no REAL-LIVE activation call; no allowlist mutation; no candidate_*', () => {
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/activate_real_live\s*\(/.test(code), false, `activate_real_live invoked in ${fn}`);
    assert.equal(/ALLOWLIST\s*[=.]|allowlist\s*:/i.test(code), false, `allowlist mutation in ${fn}`);
    assert.equal(/candidate_/.test(code), false, `candidate_* in ${fn}`);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'signer-request-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b)/i.test(fx), false, 'secret-like content in fixture');
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair']) {
    assert.equal(fx.includes(k), false, `fixture must not contain ${k}`);
  }
});

test('CODE: no forbidden SSOT names', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
  }
});
