// analytics-reader.test.mjs — ADR-0001 Phase 7C. Optional read-only ClickHouse analytics. ClickHouse is
// never loaded: clickhouse tests inject a mock client; none mode (default) needs nothing. Analytics is
// never SoT, never required; a failure degrades to status only (never throws). Payloads are projected to
// a scalar whitelist (no secrets / raw tx ever leave ClickHouse).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createAnalyticsReader } = await import('../src/storage/clickhouse-client.mjs');
const { createApi } = await import('../src/api.mjs');

function mockCH({ byType = [], overall = [], recent = [], fail = false } = {}) {
  return {
    query: async (sql) => {
      if (fail) throw new Error('clickhouse_http_503');
      if (/GROUP BY event_type/.test(sql)) return JSON.stringify({ data: byType });
      if (/JSONExtractString\(payload, 'overall'\)/.test(sql)) return JSON.stringify({ data: overall });
      if (/ORDER BY event_timestamp DESC/.test(sql)) return JSON.stringify({ data: recent });
      return JSON.stringify({ data: [] });
    },
  };
}
const CH_ENV = { EVENT_SINK_BACKEND: 'clickhouse', CLICKHOUSE_URL: 'http://x' };

// ---------- not_configured ----------
test('reader: EVENT_SINK_BACKEND=none (or unset) => not_configured, no client, no throw', async () => {
  assert.equal((await createAnalyticsReader({ env: { EVENT_SINK_BACKEND: 'none' } }).summary()).status, 'not_configured');
  assert.equal((await createAnalyticsReader({ env: {} }).summary()).status, 'not_configured');
  // clickhouse selected but no URL => still not_configured (incomplete config), never an error
  assert.equal((await createAnalyticsReader({ env: { EVENT_SINK_BACKEND: 'clickhouse' } }).summary()).status, 'not_configured');
});

// ---------- available summary ----------
test('reader: clickhouse mock => available summary with counts, overall counts, provider tally, redacted last_events', async () => {
  const client = mockCH({
    byType: [{ event_type: 'diagnostic.run', c: '5' }, { event_type: 'provider.health', c: '3' }, { event_type: 'diagnostic.quote_check', c: '2' }, { event_type: 'diagnostic.route_check', c: '1' }],
    overall: [{ overall: 'pass', c: '3' }, { overall: 'fail', c: '2' }],
    recent: [
      { event_type: 'diagnostic.run', event_timestamp: '2026-06-15 12:00:00.000', payload: '{"run_id":"r1","run_kind":"preflight","overall":"pass","readiness":"valid","secret_key":"SHOULD_NOT_LEAK","checks":[{"name":"connectivity","status":"pass"}]}' },
      { event_type: 'provider.health', event_timestamp: '2026-06-15 11:59:00.000', payload: '{"providers":{"rpc":"healthy","jupiter":"degraded"},"degraded":true}' },
    ],
  });
  const r = await createAnalyticsReader({ env: CH_ENV, clickHouseClient: client }).summary({ windowHours: 24 });
  assert.equal(r.status, 'available');
  assert.equal(r.window_hours, 24);
  assert.deepEqual(r.counts, { diagnostic_runs: 5, provider_health_events: 3, quote_checks: 2, route_checks: 1 });
  assert.deepEqual(r.diagnostic_overall_counts, { pass: 3, fail: 2 });
  assert.deepEqual(r.provider_status_counts, { healthy: 1, degraded: 1 });
  // last_events: scalar whitelist only — overall/readiness/run_kind kept; run_id/checks/secret dropped
  const e0 = r.last_events[0];
  assert.equal(e0.event_type, 'diagnostic.run');
  assert.equal(e0.overall, 'pass');
  assert.equal(e0.readiness, 'valid');
  assert.equal(e0.run_kind, 'preflight');
  assert.equal('checks' in e0, false, 'nested arrays dropped');
});

// ---------- redaction ----------
test('reader: last_events carry NO secret-ish fields / raw payload blobs', async () => {
  const client = mockCH({ recent: [{ event_type: 'diagnostic.run', event_timestamp: '2026-06-15 00:00:00.000', payload: '{"overall":"pass","secret_key":"AKIAXYZSECRET","authorization":"Bearer zzz","raw_tx":"deadbeef"}' }] });
  const r = await createAnalyticsReader({ env: CH_ENV, clickHouseClient: client }).summary();
  const blob = JSON.stringify(r.last_events);
  assert.ok(!/secret_key|AKIAXYZSECRET|authorization|Bearer|raw_tx|deadbeef/i.test(blob), 'no secret/raw-tx leakage');
  assert.equal(r.last_events[0].overall, 'pass');
});

// ---------- failure => unavailable (never throws) ----------
test('reader: a ClickHouse error => status unavailable (never throws, no effect elsewhere)', async () => {
  const r = await createAnalyticsReader({ env: CH_ENV, clickHouseClient: mockCH({ fail: true }) }).summary();
  assert.equal(r.status, 'unavailable');
  assert.match(r.error, /analytics_read_failed/);
});

// ---------- window clamp ----------
test('reader: window hours clamped to [1, 168]', async () => {
  const client = mockCH();
  assert.equal((await createAnalyticsReader({ env: CH_ENV, clickHouseClient: client }).summary({ windowHours: 500 })).window_hours, 168);
  assert.equal((await createAnalyticsReader({ env: CH_ENV, clickHouseClient: client }).summary({ windowHours: 0 })).window_hours, 24);
});

// ---------- API endpoint ----------
test('GET /api/analytics/summary: not_configured without a reader; returns the summary with one; always 200', async () => {
  const off = await createApi({}).handle({ method: 'GET', path: '/api/analytics/summary', body: null });
  assert.equal(off.status, 200);
  assert.equal(off.body.status, 'not_configured');

  const analytics = { summary: async ({ windowHours }) => ({ status: 'available', window_hours: windowHours, counts: { diagnostic_runs: 1 } }) };
  const on = await createApi({ analytics }).handle({ method: 'GET', path: '/api/analytics/summary?hours=12', body: null });
  assert.equal(on.status, 200);
  assert.equal(on.body.status, 'available');
  assert.equal(on.body.window_hours, 12);
  assert.ok(!/locked|blocked|activation_required|hard_stop|live_send_enabled/i.test(JSON.stringify(on.body)));
});
