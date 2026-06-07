import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createGateDHarness, runRotationComposite } from '../src/index.mjs';
import { WALLET_ASSIGNMENT_POLICY } from '../../ssot-types/src/core-enums.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sc = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'gate-d-scenario.json'), 'utf8'));
const build = () => { const f = sc(); return { f, h: createGateDHarness({ wallets: f.wallets, activate: f.activate }) }; };

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

// ---- D0: pool + assignment ----

test('D0: every wallet_assignment_policy is supported and selects only ACTIVE-eligible wallets', () => {
  const { h } = build();
  for (const p of WALLET_ASSIGNMENT_POLICY) assert.equal(h.pool.setAssignmentPolicy(p).ok, true);
  h.pool.setAssignmentPolicy('round_robin');
  const eligible = new Set(h.pool.listEligible().map((w) => w.execution_wallet_id));
  for (let i = 0; i < 8; i++) assert.ok(eligible.has(h.pool.assign().execution_wallet_id));
  // a DRAINING wallet is never selected
  h.lifecycle.drainExecutionWallet({ execution_wallet_id: 'exec-wallet-a', permission_role: 'admin', audit_actor: 'op' });
  assert.equal(h.pool.listEligible().some((w) => w.execution_wallet_id === 'exec-wallet-a'), false);
});

test('D0: Hard Risk aggregation cannot be bypassed by multiple wallets', () => {
  const { f, h } = build();
  h.pool.setAssignmentPolicy('risk_weighted');
  assert.ok(h.pool.listEligible().length >= 2);
  for (let i = 0; i < 3; i++) {
    assert.equal(h.pool.assign({ hard_risk: f.hard_risk_exhausted }).reason, 'hard_risk_exhausted');
  }
});

// ---- D1: asset transfer intents (simulated) ----

test('D1: asset transfer is simulated and ownership flips ONLY on CONFIRMED', () => {
  const { h } = build();
  const r = h.transfers.createAssetTransferIntent({
    source_execution_wallet_id: 'exec-wallet-a', destination_execution_wallet_id: 'exec-wallet-b',
    position_owner_wallet_id: 'exec-wallet-a', permission_role: 'admin', audit_actor: 'op',
  });
  const id = r.asset_transfer_intent_id;
  assert.equal(h.transfers.ownerOf(id), 'exec-wallet-a');
  h.transfers.simulate(id, 'SUBMITTED');
  assert.equal(h.transfers.ownerOf(id), 'exec-wallet-a'); // not flipped on SUBMITTED
  h.transfers.simulate(id, 'CONFIRMED');
  assert.equal(h.transfers.ownerOf(id), 'exec-wallet-b'); // flipped on CONFIRMED
});

// ---- D2: profit sweep (simulated, candidate, owner-bound, reconciliation-gated) ----

test('D2: sweep is candidate/simulated, owner-bound and reconciliation-gated', () => {
  const { h } = build();
  const base = {
    execution_wallet_id: 'exec-wallet-a', position_owner_wallet_id: 'exec-wallet-a',
    profit_sweep_policy: 'manual', candidate_profits_available_to_sweep: 1,
    candidate_balance_provenance: 'on_chain', candidate_balance_reconciliation_status: 'reconciled',
    permission_role: 'admin', audit_actor: 'op',
  };
  // owner-bound: source != owner -> reject
  assert.equal(h.sweep.sweepProfits({ ...base, position_owner_wallet_id: 'exec-wallet-b' }).reason, 'not_owner_bound');
  // reconciliation-gated: mismatch -> reject
  assert.equal(h.sweep.sweepProfits({ ...base, candidate_balance_reconciliation_status: 'mismatch' }).reason, 'reconciliation_not_reconciled');
  // valid manual -> candidate_sweep_event, requires simulated confirmation
  const ok = h.sweep.sweepProfits({ ...base });
  assert.equal(ok.simulated, true);
  assert.ok('candidate_profits_available_to_sweep' in ok.candidate_sweep_event); // candidate prefix preserved
  assert.equal(h.sweep.candidateSweepHistory().length, 0);
  h.sweep.simulateConfirm(ok.candidate_sweep_event.id);
  assert.equal(h.sweep.candidateSweepHistory().length, 1);
});

// ---- D3: rotation composite (simulated, end-to-end) ----

test('D3: rotation composite runs end-to-end (rotate->start->confirm->complete; old RETIRED)', () => {
  const { f, h } = build();
  const t = runRotationComposite(h, { rotate_request: f.rotate_request, ctx: f.ctx, withSweep: true });
  assert.equal(t.rotate.wallet_rotation_status, 'PENDING');
  assert.equal(t.start.wallet_rotation_status, 'IN_PROGRESS');
  assert.equal(t.old_status_after_start, 'DRAINING');          // old wallet drained via C3
  assert.ok(typeof t.asset_transfer_intent_id === 'string');    // D1 transfer created
  assert.equal(t.transfer_confirm.asset_transfer_status, 'CONFIRMED');
  assert.equal(t.owner_after_confirm, 'exec-wallet-new');        // ownership flipped on CONFIRMED
  assert.equal(t.complete.ok, true);
  assert.equal(t.rotation_status, 'COMPLETED');
  assert.equal(t.old_status_after_complete, 'RETIRED');         // old wallet retired only at complete
});

test('D3: complete is blocked until the asset transfer is CONFIRMED', () => {
  const { f, h } = build();
  const r = h.rotation.rotateExecutionWallet({ ...f.rotate_request, ...f.ctx });
  h.rotation.start(r.id, f.ctx); // transfer PENDING
  assert.equal(h.rotation.completeWalletRotation(r.id, f.ctx).reason, 'asset_transfer_not_confirmed');
  assert.equal(h.rotation.get(r.id).wallet_rotation_status, 'IN_PROGRESS'); // not completed
});

// ---- Audit: append-only across Gate D layers ----

test('audit is append-only in-memory across Gate D layers (rotation/lifecycle/transfers/sweep)', () => {
  const { f, h } = build();
  runRotationComposite(h, { rotate_request: f.rotate_request, ctx: f.ctx, withSweep: true });
  for (const auditLog of [h.rotation.auditLog, h.lifecycle.auditLog, h.transfers.auditLog, h.sweep.auditLog]) {
    assert.ok(auditLog.list().length >= 1);
    for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof auditLog[m], 'undefined');
    for (const e of auditLog.list()) for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k}`);
  }
});

// ---- harness exposes no execution authority ----

test('harness exposes no signing/sending/transfer/funding/admission surface', () => {
  const { h } = build();
  for (const k of ['sign', 'send', 'submit', 'execute', 'transfer', 'fund', 'admit', 'broadcast']) {
    assert.equal(typeof h[k], 'undefined', `harness must not expose ${k}()`);
  }
  assert.deepEqual(Object.keys(h).sort(), ['lifecycle', 'pool', 'rotation', 'sweep', 'transfers', 'walletRegistry']);
});

// ---- code governance scans ----

test('CODE: no live transfer/sweep, token transfer, signing/sending/serialization, KeyManager, RPC/DB, REAL-LIVE/Gate-E', () => {
  const BAD = /(live[_-]?transfer|live[_-]?sweep|token[_-]?transfer|transfer[_-]?boundary|signTransaction|sendTransaction|sendRawTransaction|\.serialize\(|KeyManager|private[_-]?key|secret[_-]?key|\bmnemonic\b|keypair|@noble|tweetnacl|bs58|ed25519|web3|@solana\/|jupiter|helius|jito|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool|activate_real_live|real[_-]?live)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: no candidate_* promotion in harness code; fixture has no secrets', () => {
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    // candidate names may appear as field refs in strings (stripped); ensure no bare un-prefixed truth tokens
    for (const bare of ['balance_provenance', 'balance_reconciliation_status', 'profits_available_to_sweep']) {
      assert.equal((code.match(new RegExp(`(?<!candidate_)\\b${bare}\\b`, 'g')) || []).length, 0, `bare ${bare} in ${fn}`);
    }
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'gate-d-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b)/i.test(fx), false, 'secret-like content in fixture');
});
