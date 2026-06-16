// event-sink-integration.test.mjs — ADR-0001 Phase 7B. Wiring the OPTIONAL ClickHouse sink to
// NON-CRITICAL surfaces only (diagnostics + provider-health), best-effort + FAIL-OPEN. A sink error
// must never change a response/status, and payloads must carry no secrets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-evi-'));

const { createApi } = await import('../src/api.mjs');
const { createDiagnosticExecutionAdapter } = await import('../../../packages/execution/src/index.mjs');

function spySink() { const writes = []; return { sink: { backend: 'clickhouse', writer: { writeEvent: async (rec) => { writes.push(rec); return { ok: true }; } } }, writes }; }
const failSink = () => ({ backend: 'clickhouse', writer: { writeEvent: async () => { throw new Error('clickhouse_http_503 down'); } } });
function noneSink() { const writes = []; return { sink: { backend: 'none', writer: { writeEvent: async (rec) => { writes.push(rec); return { ok: true, sink: 'none' }; } } }, writes }; }

const stubAdapter = (conn) => createDiagnosticExecutionAdapter({
  rpc: { rpc: async () => ({ ok: true, result: null }), testConnection: async () => conn ?? { ok: true, provider: 'helius', solana_core: '1', current_slot: 1, latency_ms: 5, enhanced_stream: true } },
  jupiter: { quote: async () => ({ ok: true, outAmount: 5, priceImpactPct: 0.1 }), usdValueOf: async () => ({ ok: true, usd: 1 }) },
  jito: { getTipFloor: async () => null },
  providerHealth: { snapshot: () => ({}) },
  now: () => '2026-06-15T00:00:00.000Z', genId: () => 'diag_1',
});

// ---------- none / absent sink: never writes ----------
test('EVENT_SINK_BACKEND=none does not write; response says event_sink disabled', async () => {
  const { sink, writes } = noneSink();
  const r = await createApi({ diagnostics: stubAdapter(), eventSink: sink }).handle({ method: 'POST', path: '/api/diagnostics/run', body: {} });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.event_sink, { enabled: false, written: false });
  assert.equal(writes.length, 0, 'none backend never attempts a write');
});

test('no eventSink wired => event_sink disabled, response unaffected', async () => {
  const r = await createApi({ diagnostics: stubAdapter() }).handle({ method: 'POST', path: '/api/diagnostics/run', body: {} });
  assert.deepEqual(r.body.event_sink, { enabled: false, written: false });
  assert.equal(r.body.run.kind, 'preflight');
});

// ---------- clickhouse sink: diagnostics writes ----------
test('diagnostics run writes a diagnostic.run event (+ quote/route samples when present)', async () => {
  const { sink, writes } = spySink();
  const r = await createApi({ diagnostics: stubAdapter(), eventSink: sink }).handle({
    method: 'POST', path: '/api/diagnostics/run',
    body: { quote: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 100 }, route: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 100 } },
  });
  assert.equal(r.body.event_sink.written, true);
  const types = writes.map((w) => w.event_type);
  assert.ok(types.includes('diagnostic.run'));
  assert.ok(types.includes('diagnostic.quote_check'));
  assert.ok(types.includes('diagnostic.route_check'));
  const runEvt = writes.find((w) => w.event_type === 'diagnostic.run');
  assert.equal(runEvt.payload.run_id, 'diag_1');
  assert.equal(runEvt.payload.run_kind, 'preflight');
  assert.ok(Array.isArray(runEvt.payload.checks));
});

test('provider-test writes a provider.health_check event', async () => {
  const { sink, writes } = spySink();
  const r = await createApi({ diagnostics: stubAdapter(), eventSink: sink }).handle({ method: 'POST', path: '/api/diagnostics/provider-test', body: {} });
  assert.equal(r.body.event_sink.written, true);
  assert.equal(writes[0].event_type, 'provider.health_check');
});

// ---------- provider-health GET: throttled ----------
test('provider-health GET writes provider.health once, then throttles repeated polls', async () => {
  const { sink, writes } = spySink();
  const api = createApi({ providerHealth: { snapshot: () => ({ rpc: { status: 'healthy' } }) }, eventSink: sink });
  const first = await api.handle({ method: 'GET', path: '/api/providers/health', body: null });
  const second = await api.handle({ method: 'GET', path: '/api/providers/health', body: null });
  assert.equal(first.body.event_sink.written, true);
  assert.equal(second.body.event_sink.written, false, 'second poll throttled');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].payload.providers, { rpc: 'healthy' }, 'compact status summary, not the raw snapshot');
});

// ---------- FAIL-OPEN ----------
test('a sink error NEVER changes the diagnostics response or status (fail-open)', async () => {
  const r = await createApi({ diagnostics: stubAdapter(), eventSink: failSink() }).handle({ method: 'POST', path: '/api/diagnostics/run', body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.run.kind, 'preflight');
  assert.equal(r.body.run.readiness, 'valid', 'readiness computed from checks, not the sink');
  assert.equal(r.body.overall, 'pass');
  assert.equal(r.body.event_sink.written, false);
  assert.ok(!JSON.stringify(r.body).toLowerCase().includes('clickhouse'), 'no ClickHouse error leaks into the response');
});

test('a sink error does not break provider-health or provider-test', async () => {
  const ph = await createApi({ providerHealth: { snapshot: () => ({ rpc: { status: 'healthy' } }) }, eventSink: failSink() }).handle({ method: 'GET', path: '/api/providers/health', body: null });
  assert.equal(ph.status, 200);
  assert.deepEqual(ph.body.providers, { rpc: { status: 'healthy' } });
  assert.equal(ph.body.event_sink.written, false);
  const pt = await createApi({ diagnostics: stubAdapter(), eventSink: failSink() }).handle({ method: 'POST', path: '/api/diagnostics/provider-test', body: {} });
  assert.equal(pt.status, 200);
  assert.equal(pt.body.event_sink.written, false);
});

// ---------- no secrets in payloads ----------
test('event payloads contain no secrets / keys / auth headers / raw tx', async () => {
  const { sink, writes } = spySink();
  const api = createApi({ providerHealth: { snapshot: () => ({ rpc: { status: 'healthy', last_error: 'rpc_http_429' } }) }, diagnostics: stubAdapter(), eventSink: sink });
  await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { quote: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 100 }, simulation: { txBase64: 'AA==', token_mint: 'M', side: 'buy' } } });
  await api.handle({ method: 'POST', path: '/api/diagnostics/provider-test', body: {} });
  await api.handle({ method: 'GET', path: '/api/providers/health', body: null });
  const blob = JSON.stringify(writes);
  assert.ok(!/-----BEGIN|password|authorization|x-clickhouse-key|\bsecret\b|private[_-]?key|mnemonic|seed phrase/i.test(blob), 'no secret-ish keys');
  assert.ok(!/\b[1-9A-HJ-NP-Za-km-z]{64,}\b/.test(blob), 'no base58 key-length blobs');
  assert.ok(!/txBase64|raw_tx|signed/i.test(blob), 'no raw/signed tx material');
});
