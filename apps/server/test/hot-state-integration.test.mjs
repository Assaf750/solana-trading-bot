// hot-state-integration.test.mjs — ADR-0001 Phase 6B. provider-health + readiness hot-state cache,
// wired into the API as an OPTIONAL, FAIL-OPEN layer. A Redis error must degrade to a cache-miss and
// never change provider status, readiness, or any trading decision. Uses the pure memory store + a
// deliberately-failing store; no real Redis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-hsi-'));

const { createApi } = await import('../src/api.mjs');
const { createDiagnosticExecutionAdapter } = await import('../../../packages/execution/src/index.mjs');
const { createMemoryHotStateStore } = await import('../../../packages/hot-state/src/index.mjs');

// a hot-state store whose every op throws (simulates Redis down) — to prove fail-open
const failingHotState = () => ({
  backend: 'redis',
  setProviderHealth: async () => { throw new Error('redis_op_failed:set:ECONNREFUSED'); },
  getProviderHealth: async () => { throw new Error('redis_op_failed:get:ECONNREFUSED'); },
  setReadiness: async () => { throw new Error('redis down'); },
  getReadiness: async () => { throw new Error('redis down'); },
  readIdempotencyKey: async () => { throw new Error('redis down'); },
  claimIdempotencyKey: async () => { throw new Error('redis down'); },
});

// minimal counting diagnostics double (lets a test assert a replay did NOT re-run)
function countingDiagnostics() {
  const state = { ran: 0 };
  return { state, adapter: { runDiagnosticExecutionTest: async () => { state.ran += 1; return { run_id: 'r1', kind: 'preflight', readiness: 'valid', checks: [], created_at: '2026-06-15T00:00:00.000Z' }; } } };
}

const stubAdapter = (conn) => createDiagnosticExecutionAdapter({
  rpc: { rpc: async () => ({ ok: true, result: null }), testConnection: async () => conn ?? { ok: true, provider: 'helius', solana_core: '1', current_slot: 1, latency_ms: 5, enhanced_stream: true } },
  jupiter: { quote: async () => ({ ok: true, outAmount: 1, priceImpactPct: 0 }), usdValueOf: async () => ({ ok: true, usd: 1 }) },
  jito: { getTipFloor: async () => null },
  providerHealth: { snapshot: () => ({}) },
  now: () => 'T', genId: () => 'diag_1',
});

// ---------- provider health: write-through ----------
test('provider-health: live snapshot is authoritative + written through to the cache (memory)', async () => {
  const hotState = createMemoryHotStateStore();
  const snap = { rpc: { status: 'healthy', error_pct: 0 } };
  const api = createApi({ providerHealth: { snapshot: () => snap }, hotState });
  const r = await api.handle({ method: 'GET', path: '/api/providers/health', body: null });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.providers, snap);
  assert.deepEqual(r.body.hot_state_cache, { enabled: true, hit: false, degraded: false });
  assert.deepEqual(await hotState.getProviderHealth(), snap, 'snapshot written through to cache');
});

// ---------- provider health: FAIL-OPEN ----------
test('provider-health: a Redis error degrades to cache-miss and NEVER changes the reported status', async () => {
  const snap = { rpc: { status: 'healthy', error_pct: 0 } };
  const api = createApi({ providerHealth: { snapshot: () => snap }, hotState: failingHotState() });
  const r = await api.handle({ method: 'GET', path: '/api/providers/health', body: null });
  assert.equal(r.status, 200, 'route still succeeds');
  assert.deepEqual(r.body.providers, snap, 'live status unchanged (not forced to down)');
  assert.equal(r.body.hot_state_cache.degraded, true);
});

// ---------- provider health: cold-start cache fallback ----------
test('provider-health: empty live monitor falls back to the cached snapshot (cold start)', async () => {
  const hotState = createMemoryHotStateStore();
  await hotState.setProviderHealth({ rpc: { status: 'healthy' } });
  const api = createApi({ providerHealth: { snapshot: () => ({}) }, hotState }); // monitor cold/empty
  const r = await api.handle({ method: 'GET', path: '/api/providers/health', body: null });
  assert.deepEqual(r.body.providers, { rpc: { status: 'healthy' } });
  assert.equal(r.body.hot_state_cache.hit, true);
});

test('provider-health: no hotState wired => cache disabled, route unchanged', async () => {
  const api = createApi({ providerHealth: { snapshot: () => ({ rpc: { status: 'healthy' } }) } });
  const r = await api.handle({ method: 'GET', path: '/api/providers/health', body: null });
  assert.equal(r.body.hot_state_cache.enabled, false);
  assert.deepEqual(r.body.providers, { rpc: { status: 'healthy' } });
});

// ---------- diagnostics readiness cache ----------
test('diagnostics status: writes readiness cache; prior snapshot returns as advisory cached_readiness', async () => {
  const hotState = createMemoryHotStateStore();
  const api = createApi({ diagnostics: stubAdapter(), hotState });
  const first = await api.handle({ method: 'GET', path: '/api/diagnostics/status', body: null });
  assert.equal(first.body.cached_readiness, null, 'nothing cached yet');
  assert.equal(first.body.hot_state_cache.degraded, false);
  const second = await api.handle({ method: 'GET', path: '/api/diagnostics/status', body: null });
  assert.equal(second.body.hot_state_cache.hit, true);
  assert.ok(second.body.cached_readiness, 'prior readiness surfaced as advisory');
  assert.equal(second.body.cached_readiness.readiness, 'valid');
});

test('diagnostics status: cached readiness is ADVISORY — it never overrides the live decision', async () => {
  const hotState = createMemoryHotStateStore();
  // seed a stale "valid/safe" snapshot
  await hotState.setReadiness({ overall: 'pass', safe_to_run_live: true, readiness: 'valid' });
  // but live connectivity FAILS -> live readiness must be invalid regardless of the cache
  const api = createApi({ diagnostics: stubAdapter({ ok: false, error: 'rpc_url_unavailable' }), hotState });
  const r = await api.handle({ method: 'GET', path: '/api/diagnostics/status', body: null });
  assert.equal(r.body.readiness, 'invalid', 'live decision wins');
  assert.equal(r.body.safe_to_run_live, false, 'cache cannot enable live');
  assert.equal(r.body.cached_readiness.safe_to_run_live, true, 'stale cache shown only as advisory');
});

test('diagnostics status: Redis error is fail-open (route still returns the live readiness)', async () => {
  const api = createApi({ diagnostics: stubAdapter(), hotState: failingHotState() });
  const r = await api.handle({ method: 'GET', path: '/api/diagnostics/status', body: null });
  assert.equal(r.status, 200);
  assert.equal(r.body.readiness, 'valid');
  assert.equal(r.body.hot_state_cache.degraded, true);
  assert.equal(r.body.cached_readiness, null);
});

test('diagnostics run: writes readiness cache (memory); Redis error is fail-open', async () => {
  const hotState = createMemoryHotStateStore();
  const ok = await createApi({ diagnostics: stubAdapter(), hotState }).handle({ method: 'POST', path: '/api/diagnostics/run', body: {} });
  assert.equal(ok.body.hot_state_cache.degraded, false);
  assert.equal((await hotState.getReadiness()).readiness, 'valid', 'run wrote readiness cache');
  const bad = await createApi({ diagnostics: stubAdapter(), hotState: failingHotState() }).handle({ method: 'POST', path: '/api/diagnostics/run', body: {} });
  assert.equal(bad.status, 200, 'run still succeeds when cache write fails');
  assert.equal(bad.body.hot_state_cache.degraded, true);
  assert.equal(bad.body.run.kind, 'preflight');
});

// ---------- diagnostic idempotency (Phase 6C) ----------
test('idempotency: a repeated run with the same idempotency_key replays the cached result (no re-run)', async () => {
  const { state, adapter } = countingDiagnostics();
  const api = createApi({ diagnostics: adapter, hotState: createMemoryHotStateStore() });
  const r1 = await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { idempotency_key: 'k1' } });
  assert.equal(r1.body.idempotent, false);
  assert.equal(state.ran, 1);
  const r2 = await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { idempotency_key: 'k1' } });
  assert.equal(r2.body.idempotent, true, 'second identical request replays');
  assert.equal(state.ran, 1, 'replay did NOT re-run the diagnostic');
  assert.equal(r2.body.run.run_id, 'r1');
});

test('idempotency: no key => always runs (idempotent:false); distinct keys run independently', async () => {
  const { state, adapter } = countingDiagnostics();
  const api = createApi({ diagnostics: adapter, hotState: createMemoryHotStateStore() });
  await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: {} });
  await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: {} });
  assert.equal(state.ran, 2, 'no key => no replay');
  await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { idempotency_key: 'a' } });
  await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { idempotency_key: 'b' } });
  assert.equal(state.ran, 4, 'distinct keys run independently');
});

test('idempotency: hot-state failure is FAIL-OPEN — cache miss re-runs, never a gate', async () => {
  const { state, adapter } = countingDiagnostics();
  const api = createApi({ diagnostics: adapter, hotState: failingHotState() });
  const r1 = await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { idempotency_key: 'k2' } });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.idempotent, false);
  const r2 = await api.handle({ method: 'POST', path: '/api/diagnostics/run', body: { idempotency_key: 'k2' } });
  assert.equal(r2.status, 200);
  assert.equal(state.ran, 2, 'fail-open: Redis down => cache miss => re-runs (no gate, no behavior change)');
  // no lock/gate vocabulary leaks into the response
  assert.ok(!/locked|blocked|activation_required|hard_stop|live_send_enabled/i.test(JSON.stringify(r2.body)));
});
