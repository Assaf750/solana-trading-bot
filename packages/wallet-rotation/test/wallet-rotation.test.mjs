import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createWalletRotation, isTerminalRotationStatus } from '../src/index.mjs';
import { createExecutionWalletRegistry } from '../../execution-wallet-registry/src/index.mjs';
import { createExecutionWalletLifecycle } from '../../execution-wallet-lifecycle/src/index.mjs';
import { createAssetTransferIntents } from '../../asset-transfer-intents/src/index.mjs';
import { createProfitSweep } from '../../profit-sweep/src/index.mjs';
import { createAuditLog } from '../../data/src/index.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';
import { WALLET_ROTATION_STATUS, ROTATION_TRIGGER } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sc = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'rotation-scenario.json'), 'utf8'));
const ADMIN = { permission_role: 'admin', audit_actor: 'operator-dev-1' };

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

// Compose the full Gate-C/D simulated stack on one shared C0 registry.
function harness(activate = ['exec-wallet-old', 'exec-wallet-new']) {
  const reg = createExecutionWalletRegistry();
  for (const w of sc().wallets) reg.register(w);
  for (const id of activate) reg.transition(id, 'ACTIVE');
  const lifecycle = createExecutionWalletLifecycle({ walletRegistry: reg, auditLog: createAuditLog() });
  const transfers = createAssetTransferIntents({ walletRegistry: reg, auditLog: createAuditLog() });
  const sweep = createProfitSweep({ walletRegistry: reg, auditLog: createAuditLog() });
  const auditLog = createAuditLog();
  const rot = createWalletRotation({ walletRegistry: reg, lifecycle, transfers, sweep, auditLog });
  return { reg, lifecycle, transfers, sweep, auditLog, rot };
}
const statusOf = (reg, id) => reg.get(id).execution_wallet_status;

// Drive a rotation to IN_PROGRESS and CONFIRM its transfer (via D1 simulated hook).
function toConfirmedTransfer(h) {
  const r = h.rot.rotateExecutionWallet({ ...sc().rotate_request });
  h.rot.start(r.id, ADMIN);
  const atiId = h.rot.get(r.id).asset_transfer_intent_id;
  h.transfers.simulate(atiId, 'SUBMITTED');
  h.transfers.simulate(atiId, 'CONFIRMED');
  return r.id;
}

test('rotate creates wallet_rotation_status=PENDING', () => {
  const h = harness();
  const r = h.rot.rotateExecutionWallet({ ...sc().rotate_request });
  assert.equal(r.ok, true);
  assert.equal(r.wallet_rotation_status, 'PENDING');
  assert.ok(ROTATION_TRIGGER.includes(sc().rotate_request.rotation_trigger));
  assert.equal(h.rot.get(r.id).wallet_rotation_status, 'PENDING');
});

test('start moves to IN_PROGRESS and drains the old wallet via C3 (state transition only)', () => {
  const h = harness();
  const r = h.rot.rotateExecutionWallet({ ...sc().rotate_request });
  assert.equal(statusOf(h.reg, 'exec-wallet-old'), 'ACTIVE');
  const s = h.rot.start(r.id, ADMIN);
  assert.equal(s.ok, true);
  assert.equal(s.wallet_rotation_status, 'IN_PROGRESS');
  assert.equal(statusOf(h.reg, 'exec-wallet-old'), 'DRAINING'); // drained via C3
  assert.ok(typeof s.asset_transfer_intent_id === 'string');     // transfer created via D1
  assert.equal(h.transfers.get(s.asset_transfer_intent_id).asset_transfer_status, 'PENDING');
});

test('complete is rejected if the asset transfer is not CONFIRMED', () => {
  const h = harness();
  const r = h.rot.rotateExecutionWallet({ ...sc().rotate_request });
  h.rot.start(r.id, ADMIN); // transfer is PENDING, not confirmed
  const c = h.rot.completeWalletRotation(r.id, ADMIN);
  assert.equal(c.ok, false);
  assert.equal(c.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.equal(c.reason, 'asset_transfer_not_confirmed');
  assert.equal(h.rot.get(r.id).wallet_rotation_status, 'IN_PROGRESS'); // retryable, not failed
});

test('complete is rejected if a required sweep is not confirmed', () => {
  const h = harness();
  const rid = toConfirmedTransfer(h);
  // require_sweep with no id
  assert.equal(h.rot.completeWalletRotation(rid, { ...ADMIN, require_sweep: true }).reason, 'sweep_event_required');
  // require_sweep with an unconfirmed sweep event
  const ev = h.sweep.sweepProfits({
    execution_wallet_id: 'exec-wallet-old', position_owner_wallet_id: 'exec-wallet-old',
    profit_sweep_policy: 'manual', candidate_profits_available_to_sweep: 1,
    candidate_balance_provenance: 'on_chain', candidate_balance_reconciliation_status: 'reconciled',
    permission_role: 'admin', audit_actor: 'operator-dev-1',
  }).candidate_sweep_event;
  const c = h.rot.completeWalletRotation(rid, { ...ADMIN, require_sweep: true, sweep_event_id: ev.id });
  assert.equal(c.ok, false);
  assert.equal(c.reason, 'sweep_not_confirmed');
});

test('complete succeeds when transfer confirmed + sweep confirmed; old wallet retired', () => {
  const h = harness();
  const rid = toConfirmedTransfer(h);
  const ev = h.sweep.sweepProfits({
    execution_wallet_id: 'exec-wallet-old', position_owner_wallet_id: 'exec-wallet-old',
    profit_sweep_policy: 'manual', candidate_profits_available_to_sweep: 1,
    candidate_balance_provenance: 'on_chain', candidate_balance_reconciliation_status: 'reconciled',
    permission_role: 'admin', audit_actor: 'operator-dev-1',
  }).candidate_sweep_event;
  h.sweep.simulateConfirm(ev.id);
  const c = h.rot.completeWalletRotation(rid, { ...ADMIN, require_sweep: true, sweep_event_id: ev.id });
  assert.equal(c.ok, true);
  assert.equal(c.wallet_rotation_status, 'COMPLETED');
  assert.equal(statusOf(h.reg, 'exec-wallet-old'), 'RETIRED'); // DRAINING -> RETIRED via C0
});

test('complete succeeds when sweep is not required (transfer confirmed only)', () => {
  const h = harness();
  const rid = toConfirmedTransfer(h);
  const c = h.rot.completeWalletRotation(rid, ADMIN); // no require_sweep
  assert.equal(c.ok, true);
  assert.equal(c.wallet_rotation_status, 'COMPLETED');
  assert.equal(statusOf(h.reg, 'exec-wallet-old'), 'RETIRED');
});

test('COMPLETED and FAILED are terminal', () => {
  const h = harness();
  const rid = toConfirmedTransfer(h);
  assert.equal(h.rot.completeWalletRotation(rid, ADMIN).ok, true);
  assert.equal(h.rot.isTerminal(rid), true);
  assert.equal(isTerminalRotationStatus('COMPLETED'), true);
  assert.equal(h.rot.completeWalletRotation(rid, ADMIN).api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.equal(h.rot.simulateFail(rid).reason, 'cannot_fail_in_state'); // cannot fail a COMPLETED

  const h2 = harness();
  const r2 = h2.rot.rotateExecutionWallet({ ...sc().rotate_request });
  assert.equal(h2.rot.simulateFail(r2.id).wallet_rotation_status, 'FAILED');
  assert.equal(h2.rot.isTerminal(r2.id), true);
  assert.equal(h2.rot.start(r2.id, ADMIN).api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE'); // not pending
});

test('REVOKED wallet cannot be used as to/from', () => {
  const h = harness();
  h.reg.transition('exec-wallet-new', 'REVOKED');
  assert.equal(h.rot.rotateExecutionWallet({ ...sc().rotate_request }).reason, 'rotation_wallet_revoked');
  const h2 = harness();
  h2.reg.transition('exec-wallet-old', 'REVOKED');
  assert.equal(h2.rot.rotateExecutionWallet({ ...sc().rotate_request }).reason, 'rotation_wallet_revoked');
});

test('new (to) wallet must already be ACTIVE/admitted (WARMING_UP rejected — no admission here)', () => {
  const h = harness(['exec-wallet-old']); // new stays WARMING_UP
  assert.equal(statusOf(h.reg, 'exec-wallet-new'), 'WARMING_UP');
  assert.equal(h.rot.rotateExecutionWallet({ ...sc().rotate_request }).reason, 'rotation_to_not_active');
});

test('from must equal-not to; invalid trigger rejected; admin required; audit_actor required', () => {
  const h = harness();
  assert.equal(h.rot.rotateExecutionWallet({ ...sc().rotate_request, rotation_to_execution_wallet_id: 'exec-wallet-old' }).reason, 'rotation_from_equals_to');
  assert.equal(h.rot.rotateExecutionWallet({ ...sc().rotate_request, rotation_trigger: 'bogus' }).reason, 'invalid_rotation_trigger');
  assert.equal(h.rot.rotateExecutionWallet({ ...sc().rotate_request, permission_role: 'operator' }).api_error_code, 'PERMISSION_DENIED');
  assert.equal(h.rot.rotateExecutionWallet({ ...sc().rotate_request, audit_actor: undefined }).reason, 'audit_actor_required');
});

test('no new wallet funding / no signer / no admission gate is performed (only state + intents)', () => {
  const h = harness();
  const rid = toConfirmedTransfer(h);
  h.rot.completeWalletRotation(rid, ADMIN);
  // new wallet stayed ACTIVE (it was admitted before rotation; rotation did not fund/admit/create signer)
  assert.equal(statusOf(h.reg, 'exec-wallet-new'), 'ACTIVE');
  // rotation surface exposes no fund/admit/sign/send/transfer authority
  for (const k of ['fund', 'admit', 'activate', 'sign', 'send', 'transfer', 'sweep', 'registerSigner']) {
    assert.equal(typeof h.rot[k], 'undefined', `rotation must not expose ${k}()`);
  }
});

test('audit append-only in-memory, one entry per attributed command (success AND failure)', () => {
  const h = harness();
  const r = h.rot.rotateExecutionWallet({ ...sc().rotate_request });          // success (rotate)
  h.rot.start(r.id, ADMIN);                                                    // success (rotate phase)
  h.rot.completeWalletRotation(r.id, ADMIN);                                   // failure (transfer not confirmed)
  h.rot.rotateExecutionWallet({ ...sc().rotate_request, permission_role: 'viewer' }); // denied
  const entries = h.auditLog.list();
  assert.equal(entries.length, 4);
  for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof h.auditLog[m], 'undefined');
  for (const e of entries) {
    for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k} not in AUDIT_COLUMNS`);
    assert.equal(e.resource_type, 'wallet_rotation');
    assert.equal(e.audit_scope, 'wallet_rotation');
    assert.ok(['rotate_execution_wallet', 'complete_wallet_rotation'].includes(e.command_type));
  }
  assert.equal(entries[3].api_error_code, 'PERMISSION_DENIED');
  assert.ok(API_ERROR_CODE.includes('PERMISSION_DENIED'));
});

test('rotation events ledger is append-only and status values are SSOT', () => {
  const h = harness();
  h.rot.rotateExecutionWallet({ ...sc().rotate_request });
  const before = h.rot.list().length;
  h.rot.list().push({ id: 'x' }); // mutating the copy must not affect the ledger
  assert.equal(h.rot.list().length, before);
  for (const s of ['NOT_REQUIRED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']) assert.ok(WALLET_ROTATION_STATUS.includes(s));
});

test('requires all four injected dependencies (C0/C3/D1/D2)', () => {
  assert.throws(() => createWalletRotation({}));
  assert.throws(() => createWalletRotation({ walletRegistry: { get() {} } }));
});

// ---- code governance scans (comment/string-stripped) ----

test('CODE: no live transfer/sweep, token transfer, funding, signer creation, admission, transfer-boundary', () => {
  const BAD = /(live[_-]?transfer|live[_-]?sweep|token[_-]?transfer|transfer[_-]?boundary|fundWallet|fund_wallet|register_signer_profile|registerSigner|createSigner|admissionGate|activate_execution_wallet)/i;
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

test('CODE: no candidate_*; no forbidden SSOT names; no secrets in fixture', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/candidate_/.test(code), false, `candidate_* in ${fn}`);
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'rotation-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b)/i.test(fx), false, 'secret-like content in fixture');
});

test('S20-hardening: rotateExecutionWallet() refuses null/uninspectable input, never throws', () => {
  const { rot } = harness();
  const hostile = new Proxy({}, { get() { throw new Error('boom'); } });
  for (const bad of [null, undefined, 42, 'x', [], hostile]) {
    let r; assert.doesNotThrow(() => { r = rot.rotateExecutionWallet(bad); });
    assert.equal(r.ok, false);
  }
});
