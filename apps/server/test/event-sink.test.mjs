// event-sink.test.mjs — ADR-0001 Phase 7A. ClickHouse event-writer foundation. ClickHouse is never
// loaded: clickhouse tests inject a mock client; none mode (the default) needs nothing. ClickHouse is
// append-only analytics, NEVER source of truth; writes are FAIL-OPEN.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { parseClickHouseConfig, createEventSinkBackend, createClickHouseEventWriter, createClickHouseClient } = await import('../src/storage/clickhouse-client.mjs');
const { mapProviderEventToRecord, mapDiagnosticRunToRecord } = await import('../../../packages/storage/src/index.mjs');

function mockCH() {
  const inserts = []; const queries = [];
  const client = {
    insert: async (table, rows) => { inserts.push({ table, rows }); return { ok: true, count: rows.length }; },
    query: async (sql) => { queries.push(sql); return ''; },
    ping: async () => true,
  };
  return { client, inserts, queries };
}
const rowOf = (ins) => ins.rows[0];

// ---------- config ----------
test('config: unset => none; explicit none => none (no clickhouse config)', () => {
  assert.deepEqual(parseClickHouseConfig({}), { ok: true, backend: 'none', clickhouse: null });
  assert.deepEqual(parseClickHouseConfig({ EVENT_SINK_BACKEND: 'none' }), { ok: true, backend: 'none', clickhouse: null });
});

test('config: clickhouse with CLICKHOUSE_URL => ok; HOST builds a url; missing => clear failure', () => {
  const ok = parseClickHouseConfig({ EVENT_SINK_BACKEND: 'clickhouse', CLICKHOUSE_URL: 'http://h:8123/', CLICKHOUSE_DB: 'db', CLICKHOUSE_USER: 'u', CLICKHOUSE_PASSWORD: 'p' });
  assert.deepEqual(ok, { ok: true, backend: 'clickhouse', clickhouse: { url: 'http://h:8123', database: 'db', user: 'u', password: 'p' } });
  assert.equal(parseClickHouseConfig({ EVENT_SINK_BACKEND: 'clickhouse', CLICKHOUSE_HOST: 'h', CLICKHOUSE_HTTP_PORT: '8124' }).clickhouse.url, 'http://h:8124');
  const missing = parseClickHouseConfig({ EVENT_SINK_BACKEND: 'clickhouse' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /clickhouse_config_missing/);
});

test('config: invalid backend => clear failure', () => {
  const r = parseClickHouseConfig({ EVENT_SINK_BACKEND: 'bigquery' });
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid_event_sink_backend:bigquery/);
});

// ---------- createEventSinkBackend ----------
test('createEventSinkBackend: none => no-op writer, no client loaded', async () => {
  const b = await createEventSinkBackend({ env: { EVENT_SINK_BACKEND: 'none' } });
  assert.equal(b.backend, 'none');
  assert.deepEqual(await b.writer.writeEvent({ event_type: 'x' }), { ok: true, sink: 'none' });
  assert.equal(b.client, undefined);
});

test('createEventSinkBackend: clickhouse with injected client builds a writer; bad config throws', async () => {
  const { client, inserts } = mockCH();
  const b = await createEventSinkBackend({ env: { EVENT_SINK_BACKEND: 'clickhouse', CLICKHOUSE_URL: 'http://x' }, clickHouseClient: client });
  assert.equal(b.backend, 'clickhouse');
  await b.writer.writeEvent(mapProviderEventToRecord({ kind: 'provider_health', at: '2026-06-15T00:00:00.000Z', providers: { rpc: { status: 'down' } } }));
  assert.equal(inserts.length, 1);
  await assert.rejects(() => createEventSinkBackend({ env: { EVENT_SINK_BACKEND: 'clickhouse' } }), /event_sink_backend_config_error/);
  await assert.rejects(() => createEventSinkBackend({ env: { EVENT_SINK_BACKEND: 'nope' } }), /event_sink_backend_config_error/);
});

// ---------- writer maps the event families ----------
test('writer: ProviderEvent -> analytics_events row (event_type, ch timestamp, JSON payload)', async () => {
  const { client, inserts } = mockCH();
  const w = createClickHouseEventWriter({ client });
  await w.writeEvent(mapProviderEventToRecord({ kind: 'provider_health', at: '2026-06-15T12:00:00.000Z', providers: { rpc: { status: 'healthy' } } }));
  const row = rowOf(inserts[0]);
  assert.equal(inserts[0].table, 'analytics_events');
  assert.equal(row.event_type, 'provider_health');
  assert.equal(row.event_timestamp, '2026-06-15 12:00:00.000'); // ISO -> ClickHouse DateTime64
  assert.deepEqual(JSON.parse(row.payload).providers, { rpc: { status: 'healthy' } });
});

test('writer: RouteQuote (free-form) -> row with token_mint in payload', async () => {
  const { client, inserts } = mockCH();
  const w = createClickHouseEventWriter({ client });
  await w.writeEvent(mapProviderEventToRecord({ kind: 'route_quote', quoted_at: '2026-06-15T01:02:03.000Z', token_mint: 'MINT', out_amount: 1000 }));
  const row = rowOf(inserts[0]);
  assert.equal(row.event_type, 'route_quote');
  assert.equal(row.event_timestamp, '2026-06-15 01:02:03.000');
  assert.equal(JSON.parse(row.payload).token_mint, 'MINT');
});

test('writer: DiagnosticRun (typed mapper) -> row keyed by kind with run body in payload', async () => {
  const { client, inserts } = mockCH();
  const w = createClickHouseEventWriter({ client });
  const run = { run_id: 'r1', kind: 'preflight', readiness: 'valid', checks: [{ name: 'connectivity', status: 'pass' }], created_at: '2026-06-15T00:00:00.000Z' };
  await w.writeEvent(mapDiagnosticRunToRecord(run));
  const row = rowOf(inserts[0]);
  assert.equal(row.event_type, 'preflight');
  assert.equal(row.event_timestamp, '2026-06-15 00:00:00.000');
  assert.equal(JSON.parse(row.payload).run_id, 'r1');
});

// ---------- FAIL-OPEN ----------
test('writer: a ClickHouse error is FAIL-OPEN (returns ok:false, never throws)', async () => {
  const failing = { insert: async () => { throw new Error('clickhouse_http_503'); } };
  const w = createClickHouseEventWriter({ client: failing });
  const r = await w.writeEvent(mapProviderEventToRecord({ kind: 'x', at: '2026-06-15T00:00:00.000Z' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /clickhouse_write_failed/);
  assert.throws(() => createClickHouseEventWriter({}), /clickhouse_event_writer_requires_client/);
});

// ---------- HTTP client shape (injected request) ----------
test('clickhouse client: insert posts JSONEachRow; query posts the sql body; auth headers set', async () => {
  const calls = [];
  const request = async (url, opts) => { calls.push({ url, opts }); return { ok: true, text: async () => '' }; };
  const client = createClickHouseClient({ url: 'http://h:8123', database: 'db', user: 'u', password: 'p' }, { request });
  await client.insert('analytics_events', [{ event_type: 'e', event_timestamp: '2026-06-15 00:00:00.000', event_sequence: 0, payload: '{}' }]);
  assert.match(calls[0].url, /query=INSERT\+INTO\+analytics_events\+FORMAT\+JSONEachRow/);
  assert.match(calls[0].url, /database=db/);
  assert.equal(calls[0].opts.headers['X-ClickHouse-User'], 'u');
  assert.equal(calls[0].opts.body, '{"event_type":"e","event_timestamp":"2026-06-15 00:00:00.000","event_sequence":0,"payload":"{}"}');
  await client.query('CREATE TABLE t (a String) ENGINE = Memory');
  assert.equal(calls[1].opts.body, 'CREATE TABLE t (a String) ENGINE = Memory');
  assert.throws(() => createClickHouseClient({}), /clickhouse_client_requires_url/);
});
