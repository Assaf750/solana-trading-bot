import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExecutionWalletPool, WALLET_ASSIGNMENT_POLICIES } from '../src/index.mjs';
import { createExecutionWalletRegistry } from '../../execution-wallet-registry/src/index.mjs';
import { WALLET_ASSIGNMENT_POLICY } from '../../ssot-types/src/core-enums.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sc = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'pool-scenario.json'), 'utf8'));

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

// Register N wallets and transition `activeIds` to ACTIVE (WARMING_UP -> ACTIVE).
function build(activeIds = ['exec-wallet-a', 'exec-wallet-b', 'exec-wallet-c']) {
  const f = sc();
  const reg = createExecutionWalletRegistry();
  for (const w of f.wallets) assert.equal(reg.register(w).ok, true);
  for (const id of activeIds) assert.equal(reg.transition(id, 'ACTIVE').ok, true);
  const pool = createExecutionWalletPool({ walletRegistry: reg });
  return { reg, pool, f };
}

test('every wallet_assignment_policy enum value is supported', () => {
  assert.deepEqual([...WALLET_ASSIGNMENT_POLICIES].sort(), [...WALLET_ASSIGNMENT_POLICY].sort());
  const { pool } = build();
  for (const p of WALLET_ASSIGNMENT_POLICY) {
    assert.equal(pool.setAssignmentPolicy(p).ok, true, `policy ${p} must be settable`);
  }
  assert.equal(pool.setAssignmentPolicy('bogus_policy').reason, 'invalid_wallet_assignment_policy');
});

test('selection uses ONLY ACTIVE-eligible wallets', () => {
  const { pool } = build(['exec-wallet-a']); // only A is ACTIVE
  assert.deepEqual(pool.listEligible().map((w) => w.execution_wallet_id), ['exec-wallet-a']);
  pool.setAssignmentPolicy('round_robin');
  for (let i = 0; i < 5; i++) assert.equal(pool.assign().execution_wallet_id, 'exec-wallet-a');
});

test('DRAINING is not selected for new entry', () => {
  const { reg, pool } = build();
  reg.transition('exec-wallet-b', 'DRAINING');
  pool.setAssignmentPolicy('round_robin');
  const ids = pool.listEligible().map((w) => w.execution_wallet_id);
  assert.deepEqual(ids, ['exec-wallet-a', 'exec-wallet-c']);
  for (let i = 0; i < 6; i++) assert.notEqual(pool.assign().execution_wallet_id, 'exec-wallet-b');
});

test('REVOKED is not selected (and DISABLED/RETIRED neither)', () => {
  const { reg, pool } = build();
  reg.transition('exec-wallet-a', 'REVOKED');
  reg.transition('exec-wallet-b', 'DISABLED');
  reg.transition('exec-wallet-c', 'DRAINING');
  reg.transition('exec-wallet-c', 'RETIRED');
  assert.deepEqual(pool.listEligible(), []);
  pool.setAssignmentPolicy('round_robin');
  assert.equal(pool.assign().reason, 'no_eligible_execution_wallet');
});

test('manual_assignment rejects a non-eligible target; accepts an eligible one', () => {
  const { reg, pool } = build(['exec-wallet-a', 'exec-wallet-b']); // c stays WARMING_UP
  pool.setAssignmentPolicy('manual_assignment');
  assert.equal(pool.assign({ execution_wallet_id: 'exec-wallet-c' }).reason, 'manual_target_not_eligible');
  reg.transition('exec-wallet-a', 'REVOKED');
  assert.equal(pool.assign({ execution_wallet_id: 'exec-wallet-a' }).reason, 'manual_target_not_eligible');
  assert.equal(pool.assign({ execution_wallet_id: 'exec-wallet-b' }).execution_wallet_id, 'exec-wallet-b');
  assert.equal(pool.assign({}).reason, 'manual_target_required');
});

test('round_robin is deterministic', () => {
  const seq = () => {
    const { pool } = build();
    pool.setAssignmentPolicy('round_robin');
    return Array.from({ length: 7 }, () => pool.assign().execution_wallet_id);
  };
  const expected = ['exec-wallet-a', 'exec-wallet-b', 'exec-wallet-c', 'exec-wallet-a', 'exec-wallet-b', 'exec-wallet-c', 'exec-wallet-a'];
  assert.deepEqual(seq(), expected);
  assert.deepEqual(seq(), expected); // repeatable
});

test('least_active is deterministic (spreads, tie-break by id)', () => {
  const { pool } = build();
  pool.setAssignmentPolicy('least_active');
  const got = Array.from({ length: 6 }, () => pool.assign().execution_wallet_id);
  assert.deepEqual(got, ['exec-wallet-a', 'exec-wallet-b', 'exec-wallet-c', 'exec-wallet-a', 'exec-wallet-b', 'exec-wallet-c']);
});

test('per_strategy and per_source_wallet are deterministic and stable', () => {
  const { pool } = build();
  pool.setAssignmentPolicy('per_strategy');
  const s1 = pool.assign({ strategy_brain: 'brain_a' }).execution_wallet_id;
  assert.equal(pool.assign({ strategy_brain: 'brain_a' }).execution_wallet_id, s1); // stable
  assert.ok(['exec-wallet-a', 'exec-wallet-b', 'exec-wallet-c'].includes(s1));
  assert.equal(pool.assign({ strategy_brain: 'nope' }).reason, 'strategy_brain_required');

  pool.setAssignmentPolicy('per_source_wallet');
  const w1 = pool.assign({ tracked_wallet_address: 'leader-1' }).execution_wallet_id;
  assert.equal(pool.assign({ tracked_wallet_address: 'leader-1' }).execution_wallet_id, w1); // stable
  assert.equal(pool.assign({}).reason, 'tracked_wallet_address_required');
});

test('risk_weighted REQUIRES an exposure (Hard Risk) input', () => {
  const { pool } = build();
  pool.setAssignmentPolicy('risk_weighted');
  assert.equal(pool.assign({}).reason, 'risk_input_required');                       // missing
  assert.equal(pool.assign({ hard_risk: { risk_config: {} } }).reason, 'risk_input_required'); // incomplete
  const ok = pool.assign({ hard_risk: sc().hard_risk_ok });
  assert.equal(ok.ok, true);
  assert.ok(['exec-wallet-a', 'exec-wallet-b', 'exec-wallet-c'].includes(ok.execution_wallet_id));
});

test('risk_weighted does NOT open when Hard Risk is exhausted (no assignment)', () => {
  const { pool } = build();
  pool.setAssignmentPolicy('risk_weighted');
  const r = pool.assign({ hard_risk: sc().hard_risk_exhausted }); // max_open_positions measured == limit
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'hard_risk_exhausted');
});

test('no Hard Risk bypass via multiple wallets: global budget is shared, not per-wallet', () => {
  // Many eligible wallets, but aggregate measured is at the limit -> still rejected for ALL.
  const { pool } = build(['exec-wallet-a', 'exec-wallet-b', 'exec-wallet-c']);
  pool.setAssignmentPolicy('risk_weighted');
  assert.equal(pool.listEligible().length, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(pool.assign({ hard_risk: sc().hard_risk_exhausted }).reason, 'hard_risk_exhausted');
  }
});

test('pool requires the C0 registry; exposes no execution authority', () => {
  assert.throws(() => createExecutionWalletPool({}));
  const { pool } = build();
  for (const k of ['sign', 'send', 'submit', 'execute', 'transfer', 'sweep', 'rotate', 'buy', 'open', 'fund']) {
    assert.equal(typeof pool[k], 'undefined', `pool must not expose ${k}()`);
  }
  assert.deepEqual(Object.keys(pool).sort(), ['SET_POLICY_COMMAND', 'assign', 'getAssignmentPolicy', 'isEligible', 'listEligible', 'setAssignmentPolicy']);
});

// ---- code governance scans (comment/string-stripped) ----

test('CODE: no asset transfer / rotation / sweep / transfer-boundary artifacts', () => {
  const BAD = /(asset_transfer|wallet_rotation|profit_sweep|rotate_execution_wallet|sweep_profits|create_asset_transfer_intent|transfer[_-]?boundary|token[_-]?transfer)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `transfer/rotation/sweep artifact in ${fn}`);
  }
});

test('CODE: no signing/sending/serialization/KeyManager/key-material/signing-lib/RPC/DB/REAL-LIVE', () => {
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
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'pool-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b)/i.test(fx), false, 'secret-like content in fixture');
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair']) {
    assert.equal(fx.includes(k), false, `fixture must not contain ${k}`);
  }
});
