// diagnostics-api.test.mjs — ADR-0001 Phase 5B. The /api/diagnostics/* surface behind
// DIAGNOSTIC_BACKEND. Uses a REAL DiagnosticExecutionAdapter over STUB providers; asserts the
// route is structured, fail-closed, and NEVER trades (no liveExecutor / positions / intent calls).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-diag-'));

const { createApi } = await import('../src/api.mjs');
const { createDiagnosticExecutionAdapter } = await import('../../../packages/execution/src/index.mjs');

const stubRpc = (conn) => ({
  rpc: async (m) => (m === 'simulateTransaction' ? { ok: true, result: { value: { err: null, logs: [] } } } : { ok: true, result: null }),
  testConnection: async () => conn ?? { ok: true, provider: 'helius', solana_core: '1.18', current_slot: 1, latency_ms: 10, enhanced_stream: true },
});
const stubJup = () => ({ quote: async () => ({ ok: true, outAmount: 1000, priceImpactPct: 0.1 }), usdValueOf: async () => ({ ok: true, usd: 5 }) });
const stubJito = () => ({ getTipFloor: async () => null });
const stubHealth = (states) => ({ snapshot: () => states ?? { rpc: { status: 'healthy', error_pct: 0 }, jupiter: { status: 'healthy', error_pct: 0 } } });

// counts EVERY method call on the object (proves the diagnostics route never touches it)
function spy(counter) {
  return new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : (...a) => { counter.n += 1; counter.last = prop; counter.args = a; return undefined; }) });
}

function mkApi(over = {}, withAdapter = true) {
  const leCounter = { n: 0 }; const posCounter = { n: 0 };
  const diagnostics = withAdapter
    ? createDiagnosticExecutionAdapter({ rpc: over.rpc ?? stubRpc(), jupiter: over.jupiter ?? stubJup(), jito: stubJito(), providerHealth: over.providerHealth ?? stubHealth(), now: () => 'T', genId: () => 'diag_1' })
    : null;
  const api = createApi({ diagnostics, liveExecutor: spy(leCounter), portfolio: spy(posCounter), livePortfolio: spy(posCounter), broadcast: spy({ n: 0 }) });
  return { api, leCounter, posCounter };
}

// ---------- disabled backend (DIAGNOSTIC_BACKEND off) ----------
test('disabled backend: every diagnostics route returns 404 RESOURCE_NOT_FOUND', async () => {
  const { api } = mkApi({}, false);
  for (const [method, path] of [['POST', '/api/diagnostics/run'], ['POST', '/api/diagnostics/execution-test'], ['POST', '/api/diagnostics/provider-test'], ['GET', '/api/diagnostics/status']]) {
    const r = await api.handle({ method, path, body: {} });
    assert.equal(r.status, 404, `${method} ${path}`);
    assert.equal(r.body.api_error_code, 'RESOURCE_NOT_FOUND');
  }
});

// ---------- enabled backend: structured DiagnosticRun ----------
test('enabled backend: /run returns a structured DiagnosticRun + overall + advisory safe_to_run_live', async () => {
  const { api } = mkApi();
  const r = await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.run.kind, 'preflight');
  assert.equal(r.body.run.readiness, 'valid');
  assert.equal(r.body.overall, 'pass');
  assert.equal(r.body.safe_to_run_live, true);
  assert.deepEqual(r.body.run.checks.map((c) => c.name), ['connectivity', 'provider_health', 'priority_fee']);
});

test('enabled backend: /execution-test is an alias of /run; optional opts add quote/route/sellability/simulation', async () => {
  const { api } = mkApi();
  const r = await api.handle({
    method: 'POST', path: '/api/diagnostics/execution-test',
    body: { quote: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 100 }, route: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 100 }, sellability: { mint: 'M', qtyUi: 1, decimals: 6 }, simulation: { txBase64: 'AA==', token_mint: 'M', side: 'buy' } },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.run.checks.map((c) => c.name), ['connectivity', 'provider_health', 'priority_fee', 'quote', 'route', 'sellability', 'simulation']);
});

test('enabled backend: GET /status returns a read-only readiness rollup', async () => {
  const { api } = mkApi();
  const r = await api.handle({ method: 'GET', path: '/api/diagnostics/status', body: null });
  assert.equal(r.status, 200);
  assert.equal(r.body.readiness, 'valid');
  assert.equal(r.body.overall, 'pass');
  assert.ok(Array.isArray(r.body.checks));
});

// ---------- fail-closed ----------
test('invalid request fails closed: bad simulation input -> invalid_input check + overall fail (no crash, no trade)', async () => {
  const { api, leCounter, posCounter } = mkApi();
  const r = await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { simulation: { txBase64: 'AA==' } } }); // no token_mint
  assert.equal(r.status, 200);
  const sim = r.body.run.checks.find((c) => c.name === 'simulation');
  assert.equal(sim.error, 'invalid_input');
  assert.equal(r.body.overall, 'fail');
  assert.equal(r.body.safe_to_run_live, false);
  assert.equal(leCounter.n, 0);
  assert.equal(posCounter.n, 0);
});

// ---------- never trades ----------
test('diagnostic route never calls liveExecutor, never mutates positions, never claims an intent', async () => {
  const { api, leCounter, posCounter } = mkApi();
  await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { quote: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 100 }, simulation: { txBase64: 'AA==', token_mint: 'M', side: 'buy' } } });
  await api.handle({ method: 'POST', path: '/api/diagnostics/execution-test', body: {} });
  await api.handle({ method: 'GET', path: '/api/diagnostics/status', body: null });
  await api.handle({ method: 'POST', path: '/api/diagnostics/provider-test', body: {} });
  assert.equal(leCounter.n, 0, 'liveExecutor untouched (no intent claim / no execution)');
  assert.equal(posCounter.n, 0, 'no portfolio mutation');
});

// ---------- provider failure mapping ----------
test('provider failure maps to fail/warn', async () => {
  const down = mkApi({ providerHealth: stubHealth({ rpc: { status: 'down', error_pct: 90 } }) });
  const pt = await down.api.handle({ method: 'POST', path: '/api/diagnostics/provider-test', body: {} });
  assert.equal(pt.body.overall, 'fail');
  assert.equal(pt.body.check.degraded, true);

  const degraded = mkApi({ providerHealth: stubHealth({ rpc: { status: 'degraded', error_pct: 20 } }) });
  const st = await degraded.api.handle({ method: 'GET', path: '/api/diagnostics/status', body: null });
  assert.equal(st.body.readiness, 'warning');
  assert.equal(st.body.overall, 'warn');

  const noRpc = mkApi({ rpc: stubRpc({ ok: false, error: 'rpc_url_unavailable' }) });
  const st2 = await noRpc.api.handle({ method: 'GET', path: '/api/diagnostics/status', body: null });
  assert.equal(st2.body.readiness, 'invalid');
  assert.equal(st2.body.overall, 'fail');
  assert.ok(st2.body.blockers.includes('connectivity'));
});
