// latency-tracker.test.mjs — Phase 0 gate: percentile math + sanity guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-lat-'));
const { createLatencyTracker } = await import('../src/engine/latency-tracker.mjs');

test('latency-tracker: records, computes percentiles, drops junk samples', () => {
  const t = createLatencyTracker({ file: `lat-${Math.floor(performance.now())}-a.json`, max: 100 });
  for (let i = 1; i <= 100; i += 1) t.record({ ingestion_lag_ms: i, decision_ms: 10 });
  const s = t.summary();
  assert.equal(s.count, 100);
  assert.equal(s.metrics.ingestion_lag_ms.n, 100);
  assert.equal(s.metrics.ingestion_lag_ms.p50, 50);
  assert.equal(s.metrics.ingestion_lag_ms.p90, 90);
  assert.equal(s.metrics.ingestion_lag_ms.p99, 99);
  assert.equal(s.metrics.ingestion_lag_ms.max, 100);
  assert.equal(s.metrics.decision_ms.p50, 10);
});

test('latency-tracker: drops negative (clock skew), NaN, and absurd outliers; empty sample not stored', () => {
  const t = createLatencyTracker({ file: `lat-${Math.floor(performance.now())}-b.json`, max: 100 });
  assert.equal(t.record({ ingestion_lag_ms: -5 }), false, 'negative dropped');
  assert.equal(t.record({ ingestion_lag_ms: NaN }), false, 'NaN dropped');
  assert.equal(t.record({ ingestion_lag_ms: 10_000_000 }), false, 'absurd outlier dropped');
  assert.equal(t.record({}), false, 'empty sample not stored');
  assert.equal(t.record({ ingestion_lag_ms: 42, bogus: 1 }), true, 'valid metric kept, unknown ignored');
  const s = t.summary();
  assert.equal(s.count, 1);
  assert.equal(s.metrics.ingestion_lag_ms.p50, 42);
  assert.equal(s.metrics.decision_ms, undefined, 'no decision samples => metric absent');
});

test('latency-tracker: ring buffer bounds retained samples to max', () => {
  const t = createLatencyTracker({ file: `lat-${Math.floor(performance.now())}-c.json`, max: 10 });
  for (let i = 0; i < 25; i += 1) t.record({ decision_ms: i });
  const s = t.summary();
  assert.equal(s.count, 10, 'only the last max samples kept');
  assert.equal(s.metrics.decision_ms.max, 24);
});
