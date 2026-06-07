import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createProfitSweep } from '../src/index.mjs';
import { createExecutionWalletRegistry } from '../../execution-wallet-registry/src/index.mjs';
import { createAuditLog } from '../../data/src/index.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';
import { PROFIT_SWEEP_POLICY } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sc = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'sweep-scenario.json'), 'utf8'));

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

function withRegistry() {
  const reg = createExecutionWalletRegistry();
  reg.register({ execution_wallet_id: 'exec-wallet-owner', execution_wallet_creation_mode: 'manual' });
  reg.transition('exec-wallet-owner', 'ACTIVE');
  return reg;
}
const newSweep = (config) => createProfitSweep({ walletRegistry: withRegistry(), config });

test('manual sweep creates a simulated candidate_sweep_event (requires confirmation, not executed)', () => {
  const s = newSweep();
  const r = s.sweepProfits({ ...sc().manual_request });
  assert.equal(r.ok, true);
  assert.equal(r.simulated, true);
  assert.equal(r.executed, false);
  assert.equal(r.requires_confirmation, true);
  assert.ok(r.candidate_sweep_event);
  assert.equal(r.candidate_sweep_event.profit_sweep_policy, 'manual');
  assert.equal(r.candidate_sweep_event.candidate_profits_available_to_sweep, 2.5);
  assert.equal(s.candidateSweepEvents().length, 1);
  assert.equal(s.candidateSweepHistory().length, 0); // not confirmed yet
});

test('auto/periodic policies do NOT execute — eligibility/orchestration only (no event)', () => {
  const s = newSweep({ candidate_auto_sweep_enabled: true });
  const auto = s.sweepProfits({ ...sc().manual_request, profit_sweep_policy: 'auto_immediate' });
  assert.equal(auto.ok, true); assert.equal(auto.executed, false); assert.equal(auto.eligible, true);
  const per = s.sweepProfits({ ...sc().manual_request, profit_sweep_policy: 'periodic', profit_sweep_interval_ms: 60000 });
  assert.equal(per.ok, true); assert.equal(per.executed, false);
  assert.equal(per.profit_sweep_interval_ms, 60000);
  assert.equal(s.candidateSweepEvents().length, 0); // nothing recorded/executed
  // auto disabled by config -> eligible false (still no execution)
  const s2 = newSweep({ candidate_auto_sweep_enabled: false });
  assert.equal(s2.sweepProfits({ ...sc().manual_request, profit_sweep_policy: 'auto_immediate' }).eligible, false);
});

test('sweep is rejected when not owner-bound', () => {
  const s = newSweep();
  const r = s.sweepProfits({ ...sc().manual_request, position_owner_wallet_id: 'someone-else' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_owner_bound');
  assert.equal(s.size, 0);
});

test('execution wallet must be sweepable (ACTIVE/DRAINING) when registry is consumed', () => {
  const reg = createExecutionWalletRegistry();
  reg.register({ execution_wallet_id: 'exec-wallet-owner', execution_wallet_creation_mode: 'manual' }); // stays WARMING_UP
  const s = createProfitSweep({ walletRegistry: reg });
  assert.equal(s.sweepProfits({ ...sc().manual_request }).reason, 'execution_wallet_not_sweepable');
  reg.transition('exec-wallet-owner', 'ACTIVE');
  reg.transition('exec-wallet-owner', 'DRAINING'); // DRAINING may sweep
  assert.equal(s.sweepProfits({ ...sc().manual_request }).ok, true);
});

test('reconciliation mismatch (and pending) blocks the sweep', () => {
  const s = newSweep();
  assert.equal(s.sweepProfits({ ...sc().manual_request, candidate_balance_reconciliation_status: 'mismatch' }).reason, 'reconciliation_not_reconciled');
  assert.equal(s.sweepProfits({ ...sc().manual_request, candidate_balance_reconciliation_status: 'pending' }).reason, 'reconciliation_not_reconciled');
  assert.equal(s.size, 0);
});

test('missing/invalid candidate balance provenance is rejected', () => {
  const s = newSweep();
  assert.equal(s.sweepProfits({ ...sc().manual_request, candidate_balance_provenance: undefined }).reason, 'invalid_balance_provenance');
  assert.equal(s.sweepProfits({ ...sc().manual_request, candidate_balance_provenance: 'guessed' }).reason, 'invalid_balance_provenance');
});

test('confirmation required before final status; simulateConfirm marks it and fills history', () => {
  const s = newSweep();
  const ev = s.sweepProfits({ ...sc().manual_request }).candidate_sweep_event;
  assert.equal(s.isConfirmed(ev.id), false);
  assert.equal(s.candidateSweepHistory().length, 0);
  const c = s.simulateConfirm(ev.id);
  assert.equal(c.ok, true); assert.equal(c.simulated, true); assert.equal(c.confirmed, true);
  assert.equal(s.isConfirmed(ev.id), true);
  assert.equal(s.candidateSweepHistory().length, 1);
  assert.equal(s.simulateConfirm(ev.id).reason, 'already_confirmed'); // idempotent guard
  assert.equal(s.simulateConfirm('nope').reason, 'sweep_event_not_found');
});

test('manual sweep with no profits available is rejected', () => {
  const s = newSweep();
  assert.equal(s.sweepProfits({ ...sc().manual_request, candidate_profits_available_to_sweep: 0 }).reason, 'no_profits_to_sweep');
});

test('candidate prefixes preserved; no bare balance/profit/sweep truth fields on the event', () => {
  const s = newSweep();
  const ev = s.sweepProfits({ ...sc().manual_request }).candidate_sweep_event;
  // candidate read-model fields keep the prefix
  for (const k of ['candidate_profits_available_to_sweep', 'candidate_execution_wallet_balance', 'candidate_settlement_wallet_balance', 'candidate_balance_provenance', 'candidate_balance_reconciliation_status']) {
    assert.ok(k in ev, `event must carry ${k}`);
  }
  // bare (non-candidate) balance/profit truth fields must NOT exist
  for (const bare of ['execution_wallet_balance', 'settlement_wallet_balance', 'profits_available_to_sweep', 'balance', 'profit', 'realized_pnl', 'pnl']) {
    assert.equal(bare in ev, false, `event must not carry bare ${bare}`);
  }
});

test('admin required; missing audit_actor rejected pre-effect; invalid policy rejected', () => {
  const s = newSweep();
  assert.equal(s.sweepProfits({ ...sc().manual_request, permission_role: 'operator' }).api_error_code, 'PERMISSION_DENIED');
  assert.equal(s.sweepProfits({ ...sc().manual_request, audit_actor: undefined }).reason, 'audit_actor_required');
  assert.equal(s.sweepProfits({ ...sc().manual_request, profit_sweep_policy: 'bogus' }).reason, 'invalid_profit_sweep_policy');
  assert.ok(PROFIT_SWEEP_POLICY.includes('manual'));
});

test('audit append-only in-memory, one entry per attributed sweep_profits command (success AND failure)', () => {
  const auditLog = createAuditLog();
  const s = createProfitSweep({ walletRegistry: withRegistry(), auditLog });
  s.sweepProfits({ ...sc().manual_request });                                  // success
  s.sweepProfits({ ...sc().manual_request, permission_role: 'viewer' });       // denied
  s.sweepProfits({ ...sc().manual_request, candidate_balance_reconciliation_status: 'mismatch' }); // blocked
  const entries = auditLog.list();
  assert.equal(entries.length, 3);
  for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof auditLog[m], 'undefined');
  for (const e of entries) {
    for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k} not in AUDIT_COLUMNS`);
    assert.equal(e.command_type, 'sweep_profits');
    assert.equal(e.resource_type, 'profit_sweep');
    assert.equal(e.audit_scope, 'profit_sweep');
  }
  assert.equal(entries[1].api_error_code, 'PERMISSION_DENIED');
  assert.ok(API_ERROR_CODE.includes('PERMISSION_DENIED'));
});

test('events ledger is append-only; sweep exposes no execution authority / no real transfer', () => {
  const s = newSweep();
  s.sweepProfits({ ...sc().manual_request });
  assert.equal(typeof s.candidateSweepEvents().push, 'function'); // returns a copy
  const before = s.candidateSweepEvents().length;
  s.candidateSweepEvents().push({ id: 'x' }); // mutating the copy must not affect the ledger
  assert.equal(s.candidateSweepEvents().length, before);
  for (const k of ['sign', 'send', 'submit', 'execute', 'transfer', 'rotate', 'broadcast', 'serialize']) {
    assert.equal(typeof s[k], 'undefined', `sweep must not expose ${k}()`);
  }
});

// ---- code governance scans (comment/string-stripped) ----

test('CODE: no token-transfer / live-sweep / rotation / new asset_transfer_intent / transfer-boundary', () => {
  const BAD = /(token[_-]?transfer|live[_-]?sweep|wallet_rotation|rotate_execution_wallet|create_asset_transfer_intent|asset_transfer_intent|transfer[_-]?boundary)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden artifact in ${fn}`);
  }
});

test('CODE: no tx build/serialize/sign/send, KeyManager, key material, signing-lib, RPC/DB, REAL-LIVE', () => {
  const BAD = /(private[_-]?key|secret[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|KeyManager|@noble|tweetnacl|bs58|ed25519|web3|signTransaction|sendTransaction|sendRawTransaction|\.serialize\(|@solana\/|jupiter|helius|jito|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool|activate_real_live|real[_-]?live)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: candidate prefixes preserved (no stripped/promoted candidate names); no forbidden SSOT names', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    // every candidate-domain token used keeps the candidate_ prefix (no bare balance/sweep truth tokens)
    for (const bare of ['balance_provenance', 'balance_reconciliation_status', 'profits_available_to_sweep', 'sweep_event', 'sweep_history']) {
      const bareHits = (code.match(new RegExp(`(?<!candidate_)\\b${bare}\\b`, 'g')) || []);
      assert.equal(bareHits.length, 0, `bare (un-prefixed) ${bare} found in ${fn}`);
    }
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'sweep-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b)/i.test(fx), false, 'secret-like content in fixture');
});
