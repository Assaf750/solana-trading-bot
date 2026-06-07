import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createPaperExecutionAdapter } from '../src/paper-execution-adapter.mjs';
import { createIntentLedger } from '../../intent-ledger/src/intent-ledger.mjs';
import { createPositionLifecycle } from '../../position-lifecycle/src/position-lifecycle.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const fx = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'paper-order.json'), 'utf8'));

function wired() {
  const ledger = createIntentLedger();
  ledger.create({ intent_id: 'intent-dev-0001', intent_type: 'BUY_INTENT', idempotency_key: 'k1' });
  const lifecycle = createPositionLifecycle();
  lifecycle.open({ id: 'pos-1', entry_brain: 'brain_a', config_version_at_entry: 1 });
  const adapter = createPaperExecutionAdapter({ ledger, lifecycle });
  return { ledger, lifecycle, adapter };
}

const assertPaperEnvelope = (r) => {
  assert.equal(r.mode, 'paper');
  assert.equal(r.executed, false);
  assert.equal(r.is_valid_on_chain, false);
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
};

test('happy path: guards pass -> simulated fill (paper, not on-chain, unsigned)', () => {
  const { adapter } = wired();
  const { order, ctx } = fx();
  const r = adapter.simulate(order, { ...ctx, position_id: 'pos-1', to_state: 'OPEN' });
  assertPaperEnvelope(r);
  assert.equal(r.simulated, true);
  assert.ok(r.simulated_fill, 'expected a simulated fill');
  assert.equal(r.simulated_fill.simulated, true);
  assert.equal(r.simulated_fill.is_valid_on_chain, false);
  assert.equal(typeof r.simulated_fill.total_cost_lamports, 'number');
  assert.equal(r.signer.signed, false);
});

test('no order without intent_id', () => {
  const { adapter } = wired();
  const r = adapter.simulate({}, fx().ctx);
  assert.equal(r.blocked_by, 'intent_ledger');
  assert.equal(r.reason, 'intent_id_required');
  assertPaperEnvelope(r);
});

test('unregistered intent is blocked by the ledger', () => {
  const { adapter } = wired();
  const r = adapter.simulate({ intent_id: 'nope' }, fx().ctx);
  assert.equal(r.blocked_by, 'intent_ledger');
  assert.equal(r.reason, 'intent_not_registered');
});

test('Risk Gates precede the adapter: block stops paper execution', () => {
  const { adapter } = wired();
  const { order, ctx } = fx();
  const measured = { ...ctx.measured, max_daily_loss_pct: 999 }; // exceed
  const r = adapter.simulate(order, { ...ctx, measured });
  assert.equal(r.blocked_by, 'risk_gates');
  assert.equal(r.risk.decision, 'block');
  assert.equal(r.simulated, false, 'no simulation when risk-blocked');
});

test('warning_only does NOT bypass Hard Risk in the paper path', () => {
  const { adapter } = wired();
  const { order, ctx } = fx();
  const measured = { ...ctx.measured, max_position_size_pct: 999 };
  const r = adapter.simulate(order, { ...ctx, measured, ev_gate_mode: 'warning_only' });
  assert.equal(r.blocked_by, 'risk_gates');
});

test('risk is checked before the signer (guard ordering)', () => {
  const { adapter } = wired();
  const { order, ctx } = fx();
  // both a risk violation AND an invalid signer status -> must be blocked_by risk_gates first
  const r = adapter.simulate(order, { ...ctx, measured: { ...ctx.measured, max_open_positions: 999 }, signer_profile_status: 'REVOKED' });
  assert.equal(r.blocked_by, 'risk_gates');
});

test('signer boundary never signs; envelope is unsigned regardless', () => {
  const { adapter } = wired();
  const { order, ctx } = fx();
  const r = adapter.simulate(order, ctx);
  assert.equal(r.signer.signed, false);
  assert.equal(r.signer.signature, null);
  assertPaperEnvelope(r);
});

test('illegal lifecycle transition blocks paper execution; legal transition applies in-memory', () => {
  const { adapter, lifecycle } = wired();
  const { order, ctx } = fx();
  // OPENING -> CLOSED is illegal
  const bad = adapter.simulate(order, { ...ctx, position_id: 'pos-1', to_state: 'CLOSED' });
  assert.equal(bad.blocked_by, 'position_lifecycle');
  // OPENING -> OPEN is legal and applied in-memory
  const good = adapter.simulate(order, { ...ctx, position_id: 'pos-1', to_state: 'OPEN' });
  assert.equal(good.blocked_by, undefined);
  assert.equal(lifecycle.get('pos-1').position_state, 'OPEN');
});

test('deterministic injected failure (SSOT G3 failure_type), tagged simulated', () => {
  const { adapter } = wired();
  const { order, ctx } = fx();
  const r = adapter.simulate(order, { ...ctx, inject_failure: 'SlippageExceeded' });
  assert.equal(r.simulated, true);
  assert.equal(r.failure.simulated, true);
  assert.equal(r.failure.failure_type, 'SlippageExceeded');
  assert.equal(adapter.simulate(order, { ...ctx, inject_failure: 'BOGUS' }).reason, 'invalid_failure_type');
});

test('adapter exposes no sign/send/submit/serialize methods', () => {
  const { adapter } = wired();
  for (const m of ['sign', 'send', 'submit', 'serializeTransaction', 'buildTransaction', 'execute']) {
    assert.equal(adapter[m], undefined, `must NOT expose ${m}`);
  }
});

test('no signing/sending/serialization/network/DB in source', () => {
  const BAD = /(signTransaction|sendTransaction|sendRawTransaction|\.serialize\(|@solana\/|@noble|tweetnacl|bs58|web3|\bfetch\b|axios|undici|https?:\/\/|new WebSocket|node:net|node:http|node:fs|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|\bpg\b)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `forbidden mechanism in ${fn}`);
  }
});

test('no forbidden names and no secrets in source/fixtures', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  const files = [...readdirSync(SRC).map((f) => join(SRC, f)), join(HERE, '..', 'fixtures', 'paper-order.json')];
  for (const fn of files) {
    if (!/\.(mjs|json)$/.test(fn)) continue;
    const code = readFileSync(fn, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
