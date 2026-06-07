import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { estimateCost } from '../src/cost-pipeline.mjs';
import { createCalibrationStore } from '../src/calibration-store.mjs';
import { evaluateRpcHealth } from '../src/rpc-health-monitor.mjs';
import { evaluateProtocolConstants } from '../src/protocol-constant-monitor.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');

const fullCostInput = () => ({
  entry_slippage_bps: 30, price_impact_bps: 20, base_fee_lamports: 5000, priority_fee_lamports: 10000,
  jito_tip_lamports: 0, compute_unit_limit: 200000, compute_unit_price: 1, ata_rent_lamports: 2039280,
  ata_close_recovery: 2039280, est_exit_slippage_bps: 40, est_exit_cost: 6000, platform_fee_bps: 0,
});

// --- 1. cost-pipeline ---
test('cost-pipeline: deterministic total for complete input', () => {
  const a = estimateCost(fullCostInput());
  const b = estimateCost(fullCostInput());
  assert.equal(a.priceable, true);
  assert.deepEqual(a, b, 'must be deterministic');
  // base + priority + compute(200000*1) + tip(0) + ata_net(0) + exit(6000)
  assert.equal(a.total_cost_lamports, 5000 + 10000 + 200000 + 0 + 0 + 6000);
});

test('cost-pipeline: FAIL-SAFE — missing/stale critical input => not priceable (never 0)', () => {
  const miss = { ...fullCostInput() };
  delete miss.priority_fee_lamports;
  const r = estimateCost(miss);
  assert.equal(r.priceable, false);
  assert.match(r.reason, /missing_critical_input:priority_fee_lamports/);

  const stale = { ...fullCostInput(), stale: ['priority_fee_lamports'] };
  const r2 = estimateCost(stale);
  assert.equal(r2.priceable, false);
  assert.match(r2.reason, /stale_critical_input:priority_fee_lamports/);

  assert.equal(estimateCost(null).priceable, false);
});

// --- 2. calibration-store ---
test('calibration-store: only finalized records feed priors; pessimistic by default', () => {
  const store = createCalibrationStore();
  const bucket = { brain: 'brain_a', signal_bucket: 's1', wallet_cluster: 'c1', token_risk_bucket: 't1' };
  // pessimistic when empty
  const p0 = store.getPriors(bucket);
  assert.equal(p0.source, 'pessimistic_default');
  assert.equal(p0.p_fill, 0);
  assert.equal(p0.p_exit_success, 0);
  // a non-finalized record must NOT change priors
  store.add({ ...bucket, real_fill_price: 1, real_exit: 'ok' }); // no timestamps => not finalized
  assert.equal(store.finalizedCount(), 0);
  assert.equal(store.getPriors(bucket).source, 'pessimistic_default');
  // a finalized record contributes
  store.add({ ...bucket, real_fill_price: 1, real_exit: 'ok', route_failure_flag: false, timestamp_processed: 't', timestamp_confirmed: 't' });
  const p1 = store.getPriors(bucket);
  assert.equal(p1.source, 'finalized_records');
  assert.equal(p1.sample_size, 1);
  assert.equal(p1.p_fill, 1);
});

// --- 3. rpc-health-monitor ---
test('rpc-health-monitor: computes slot_lag and degradation (SSOT G5 names)', () => {
  const r = evaluateRpcHealth([
    { provider: 'p1', slot: 100, confirmed_slot: 98, primary: true },
    { provider: 'p2', slot: 105, confirmed_slot: 103 },
  ], { slot_lag_threshold: 3 });
  assert.equal(r.slot_lag, 5);
  assert.equal(r.last_seen_slot, 100);
  assert.equal(r.last_confirmed_slot, 103);
  assert.equal(r.provider_degraded, true); // 5 > 3
  for (const k of ['provider_degraded', 'slot_lag', 'last_seen_slot', 'last_confirmed_slot']) {
    assert.ok(k in r, `missing SSOT G5 field ${k}`);
  }
});

test('rpc-health-monitor: FAIL-SAFE — no samples or missing threshold => degraded', () => {
  assert.equal(evaluateRpcHealth([], { slot_lag_threshold: 3 }).provider_degraded, true);
  assert.equal(evaluateRpcHealth([{ slot: 100 }]).provider_degraded, true); // no threshold
  assert.equal(evaluateRpcHealth(null, { slot_lag_threshold: 3 }).provider_degraded, true);
});

// --- 4. protocol-constant-monitor ---
test('protocol-constant-monitor: green when matching, changed (KILLED) when differing', () => {
  const baseline = { fee_program: 'X', graduation_threshold: 85 };
  const ok = evaluateProtocolConstants({ fee_program: 'X', graduation_threshold: 85 }, baseline);
  assert.equal(ok.protocol_constant_status, 'green');
  assert.equal(ok.killed, false);
  const diff = evaluateProtocolConstants({ fee_program: 'Y', graduation_threshold: 85 }, baseline);
  assert.equal(diff.protocol_constant_status, 'changed');
  assert.equal(diff.killed, true);
  assert.deepEqual(diff.changed_keys, ['fee_program']);
});

test('protocol-constant-monitor: FAIL-SAFE — unknown/missing observed => changed (KILLED)', () => {
  const baseline = { fee_program: 'X' };
  assert.equal(evaluateProtocolConstants({}, baseline).protocol_constant_status, 'changed');
  assert.equal(evaluateProtocolConstants(null, baseline).killed, true);
  assert.equal(evaluateProtocolConstants({ fee_program: undefined }, baseline).protocol_constant_status, 'changed');
});

// --- governance ---
test('foundations source has no forbidden names and no external-network usage', () => {
  const files = readdirSync(SRC).filter((fn) => fn.endsWith('.mjs'));
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const NET = /(node:https?|node:net|node:dgram|\bfetch\b|undici|axios|https?:\/\/|XMLHttpRequest|WebSocket)/;
  for (const fn of files) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    // Scan CODE only — strip comments and string/template literals so prose like
    // "NO external fetch" in a comment doesn't trip the network check.
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden name ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false, `HUNTABLE in ${fn}`);
    assert.equal(NET.test(code), false, `external-network usage in ${fn}`);
  }
});
