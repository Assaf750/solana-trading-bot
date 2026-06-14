// ev-gate.test.mjs — leader expected-value quality gate (pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEvGate } from '../src/engine/ev-gate.mjs';

const cfg = (ev = {}) => ({
  ev: {
    ev_gate_mode: 'strict', minimum_sample_size: 5, minimum_profit_factor: 1.5,
    minimum_net_expectancy: 0, minimum_exit_success_rate: 0.5, ...ev,
  },
});

test('ev-gate: allows below the minimum sample (insufficient evidence != bad)', () => {
  const r = checkEvGate({ cfg: cfg(), stats: { trades: 3, profit_factor: 0.1, avg_realized: -5, win_rate: 0 } });
  assert.equal(r.allowed, true);
  assert.equal(r.rejections.length, 0);
});

test('ev-gate: allows when there is no stats object', () => {
  assert.equal(checkEvGate({ cfg: cfg(), stats: null }).allowed, true);
});

test('ev-gate: strict blocks a low-profit-factor leader once sample is met', () => {
  const r = checkEvGate({ cfg: cfg(), stats: { trades: 10, profit_factor: 0.8, avg_realized: 1, win_rate: 0.6 } });
  assert.equal(r.allowed, false);
  assert.ok(r.rejections.some((x) => x.startsWith('profit_factor')));
});

test('ev-gate: strict blocks on low win-rate and negative expectancy too', () => {
  const r = checkEvGate({ cfg: cfg(), stats: { trades: 8, profit_factor: 2, avg_realized: -1, win_rate: 0.3 } });
  assert.equal(r.allowed, false);
  assert.ok(r.rejections.some((x) => x.startsWith('net_expectancy')));
  assert.ok(r.rejections.some((x) => x.startsWith('win_rate')));
});

test('ev-gate: warning_only allows but still reports the rejections', () => {
  const r = checkEvGate({ cfg: cfg({ ev_gate_mode: 'warning_only' }), stats: { trades: 10, profit_factor: 0.5, avg_realized: -2, win_rate: 0.2 } });
  assert.equal(r.allowed, true);
  assert.ok(r.rejections.length >= 1);
});

test('ev-gate: a quality leader passes; a no-loss leader (PF=Infinity) passes', () => {
  assert.equal(checkEvGate({ cfg: cfg(), stats: { trades: 10, profit_factor: 2.5, avg_realized: 3, win_rate: 0.7 } }).allowed, true);
  assert.equal(checkEvGate({ cfg: cfg(), stats: { trades: 6, profit_factor: Infinity, avg_realized: 5, win_rate: 1 } }).allowed, true);
});
