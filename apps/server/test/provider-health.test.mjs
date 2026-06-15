// provider-health.test.mjs — rolling provider health (success/error + latency, status thresholds).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProviderHealth } from '../src/engine/provider-health.mjs';

test('unknown until the first call', () => {
  const h = createProviderHealth();
  assert.deepEqual(h.snapshot(), {});
});

test('all-ok -> healthy, with latency percentiles', () => {
  const h = createProviderHealth();
  for (const ms of [10, 20, 30, 40, 50]) h.record('jupiter', true, ms);
  const s = h.snapshot().jupiter;
  assert.equal(s.status, 'healthy');
  assert.equal(s.calls, 5);
  assert.equal(s.errors, 0);
  assert.equal(s.error_pct, 0);
  assert.ok(s.p50_ms >= 10 && s.p50_ms <= 50);
});

test('error rate thresholds: healthy < 10% <= degraded < 50% <= down', () => {
  const mk = (errs, total) => {
    const h = createProviderHealth();
    for (let i = 0; i < total; i++) h.record('rpc', i >= errs, 5, i < errs ? 'rpc_http_429' : null);
    return h.snapshot().rpc;
  };
  assert.equal(mk(0, 20).status, 'healthy');
  assert.equal(mk(1, 20).status, 'healthy');   // 5%
  assert.equal(mk(2, 20).status, 'degraded');  // 10%
  assert.equal(mk(9, 20).status, 'degraded');  // 45%
  assert.equal(mk(10, 20).status, 'down');     // 50%
});

test('captures the last error + its code', () => {
  const h = createProviderHealth();
  h.record('jupiter', true, 10);
  h.record('jupiter', false, 200, 'quote_http_429');
  const s = h.snapshot().jupiter;
  assert.equal(s.last_error, 'quote_http_429');
  assert.equal(s.errors, 1);
});

test('sliding window evicts old outcomes', () => {
  const h = createProviderHealth({ window: 5 });
  for (let i = 0; i < 5; i++) h.record('rpc', false, 5, 'err'); // window full of errors
  assert.equal(h.snapshot().rpc.status, 'down');
  for (let i = 0; i < 5; i++) h.record('rpc', true, 5); // push all errors out
  const s = h.snapshot().rpc;
  assert.equal(s.calls, 5);
  assert.equal(s.errors, 0);
  assert.equal(s.status, 'healthy');
});

test('injected clock stamps last_error_ts deterministically', () => {
  let t = 1000;
  const h = createProviderHealth({ now: () => t });
  h.record('rpc', false, 5, 'boom');
  t = 2000;
  h.record('rpc', false, 5, 'boom2');
  assert.equal(h.snapshot().rpc.last_error_ts, 2000);
});

test('tracks multiple providers independently', () => {
  const h = createProviderHealth();
  h.record('jupiter', true, 10);
  for (let i = 0; i < 10; i++) h.record('rpc', false, 5, 'err');
  const s = h.snapshot();
  assert.equal(s.jupiter.status, 'healthy');
  assert.equal(s.rpc.status, 'down');
});
