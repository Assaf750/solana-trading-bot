// runtime-readiness.test.mjs — ADR-0001 Phase 8A. Structured, READ-ONLY GET /api/runtime/readiness.
// Real services (vault/config/signer/etc.) but backend health is injected via runtimeProbes mocks — no
// real DB/Redis/ClickHouse. Asserts the status rules + the activation hard stop + no mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-rr-'));

const { createVaultService } = await import('../src/vault.mjs');
const { createConfigService } = await import('../src/config-service.mjs');
const { createWalletRegistry } = await import('../src/wallet-registry.mjs');
const { createKillSwitch } = await import('../src/kill-switch.mjs');
const { createOperatingState } = await import('../src/operating-state.mjs');
const { createSignerService } = await import('../src/signer-service.mjs');
const { createApi } = await import('../src/api.mjs');
const { appendAudit } = await import('../src/audit-log.mjs');

function spy(counter) { return new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : (...a) => { counter.n += 1; counter.last = p; counter.args = a; return undefined; }) }); }

function mkApi({ runtimeProbes = null, providerHealth = { snapshot: () => ({}) } } = {}) {
  const vault = createVaultService();
  const config = createConfigService();
  const killSwitch = createKillSwitch();
  const operatingState = createOperatingState();
  const signer = createSignerService({ vault, config, killSwitch, audit: appendAudit });
  const le = { n: 0 }; const pos = { n: 0 };
  const api = createApi({
    config, wallets: createWalletRegistry(), killSwitch, operatingState, vault, signer,
    audit: appendAudit, broadcast: spy({ n: 0 }), providerHealth, runtimeProbes,
    liveExecutor: spy(le), portfolio: spy(pos), livePortfolio: spy(pos),
  });
  return { api, le, pos };
}
const get = (api) => api.handle({ method: 'GET', path: '/api/runtime/readiness', body: null });

// ---------- structured result + defaults ----------
test('returns a structured result; default json/memory/none reads as ready (development), not fail', async () => {
  const { api } = mkApi(); // no probes -> safeProbe fallbacks
  const r = await get(api);
  assert.equal(r.status, 200);
  assert.equal(r.body.overall, 'ready');
  assert.deepEqual(r.body.storage, { backend: 'json', status: 'ok' });
  assert.deepEqual(r.body.hot_state, { backend: 'memory', status: 'ok' });
  assert.deepEqual(r.body.event_sink, { backend: 'none', status: 'disabled' }); // disabled != fail
  assert.ok(r.body.signer);
  assert.ok(r.body.activation);
  assert.equal(r.body.checked_at && typeof r.body.checked_at, 'string');
});

// ---------- status rules ----------
test('postgres backend failure => storage fail + overall blocked + blocker', async () => {
  const { api } = mkApi({ runtimeProbes: { storage: async () => ({ backend: 'postgres', status: 'fail' }) } });
  const r = await get(api);
  assert.equal(r.body.storage.status, 'fail');
  assert.equal(r.body.overall, 'blocked');
  assert.ok(r.body.blockers.includes('storage_unavailable'));
});

test('redis failure => hot_state degraded, overall degraded (NOT blocked — cache)', async () => {
  const { api } = mkApi({ runtimeProbes: { hotState: async () => ({ backend: 'redis', status: 'degraded' }) } });
  const r = await get(api);
  assert.equal(r.body.hot_state.status, 'degraded');
  assert.equal(r.body.overall, 'degraded');
});

test('clickhouse failure => event_sink degraded, overall degraded (NOT blocked — analytics)', async () => {
  const { api } = mkApi({ runtimeProbes: { eventSink: async () => ({ backend: 'clickhouse', status: 'degraded' }) } });
  const r = await get(api);
  assert.equal(r.body.event_sink.status, 'degraded');
  assert.equal(r.body.overall, 'degraded');
});

test('a degraded/down provider => overall degraded (not blocked)', async () => {
  const { api } = mkApi({ providerHealth: { snapshot: () => ({ rpc: { status: 'down' }, jupiter: { status: 'healthy' } }) } });
  const r = await get(api);
  assert.equal(r.body.providers.rpc, 'down');
  assert.equal(r.body.overall, 'degraded');
});

test('a storage probe that throws degrades safely (never crashes the endpoint)', async () => {
  const { api } = mkApi({ runtimeProbes: { storage: async () => { throw new Error('boom'); } } });
  const r = await get(api);
  assert.equal(r.status, 200);
  assert.equal(r.body.storage.status, 'degraded'); // thrown probe -> degraded fallback, not a crash
});

// ---------- activation hard stop ----------
test('activation is ALWAYS a hard stop: live_send_enabled=false, activation_required=true', async () => {
  const { api } = mkApi({
    runtimeProbes: { storage: async () => ({ backend: 'postgres', status: 'ok' }), hotState: async () => ({ backend: 'redis', status: 'ok' }), eventSink: async () => ({ backend: 'clickhouse', status: 'ok' }) },
    providerHealth: { snapshot: () => ({ rpc: { status: 'healthy' } }) },
  });
  const r = await get(api);
  assert.equal(r.body.overall, 'ready', 'everything green');
  assert.equal(r.body.activation.live_send_enabled, false, 'still hard-stopped even when fully ready');
  assert.equal(r.body.activation.activation_required, true);
});

// ---------- read-only ----------
test('readiness reads only: no liveExecutor / portfolio calls; declares the no-trade safety contract', async () => {
  const { api, le, pos } = mkApi();
  const r = await get(api);
  assert.equal(le.n, 0, 'liveExecutor untouched');
  assert.equal(pos.n, 0, 'no portfolio mutation');
  assert.deepEqual(r.body.safety, { diagnostic_only: true, no_transaction_sent: true, no_position_opened: true, no_intent_claimed: true });
});

test('activation blockers mirror the live readiness() (not a cache)', async () => {
  const { api } = mkApi();
  const r = await get(api);
  const direct = await api.handle({ method: 'GET', path: '/api/readiness', body: null });
  assert.deepEqual(r.body.activation.blockers, direct.body.blockers || []);
});
