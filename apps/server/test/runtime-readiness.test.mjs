// runtime-readiness.test.mjs — ADR-0001 Phase 8A-R. GET /api/runtime/readiness is OPEN-BY-DESIGN
// MONITORING: it reports capability status (available | not_configured | degraded | unavailable) and
// NEVER imposes a lock / gate / hard-stop. ONE shared service set (DATA_DIR is captured at module load,
// so multiple stacks would share disk) driven unconfigured -> configured in order; backend health is
// injected via runtimeProbes mocks (no real DB/Redis/ClickHouse). Includes guards that the banned
// lock/gate vocabulary never reappears.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = mkdtempSync(join(tmpdir(), 'soltrade-rr-'));

const { createVaultService } = await import('../src/vault.mjs');
const { createConfigService, HARD_RISK_FIELDS } = await import('../src/config-service.mjs');
const { createWalletRegistry } = await import('../src/wallet-registry.mjs');
const { createKillSwitch } = await import('../src/kill-switch.mjs');
const { createOperatingState } = await import('../src/operating-state.mjs');
const { createSignerService } = await import('../src/signer-service.mjs');
const { createApi } = await import('../src/api.mjs');
const { appendAudit } = await import('../src/audit-log.mjs');

// banned lock/gate/hard-stop vocabulary — must NEVER appear in the readiness response (Phase 8A-R)
const BANNED = /locked|blocked|activation_required|hard_stop|structurally disabled|live_send_enabled|owner.?only/i;

const vault = createVaultService();
const config = createConfigService();
const killSwitch = createKillSwitch();
const operatingState = createOperatingState();
const signer = createSignerService({ vault, config, killSwitch, audit: appendAudit });
const le = { n: 0 }; const pos = { n: 0 };

function spy(counter) { return new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : (...a) => { counter.n += 1; counter.last = p; counter.args = a; return undefined; }) }); }
function apiWith({ runtimeProbes = null, providerHealth = { snapshot: () => ({}) } } = {}) {
  return createApi({
    config, wallets: createWalletRegistry(), killSwitch, operatingState, vault, signer,
    audit: appendAudit, broadcast: spy({ n: 0 }), providerHealth, runtimeProbes,
    liveExecutor: spy(le), portfolio: spy(pos), livePortfolio: spy(pos),
  });
}
const get = (api) => api.handle({ method: 'GET', path: '/api/runtime/readiness', body: null });
function configure() {
  vault.create('correct horse battery staple'); // creates + unlocks
  vault.setSecret('helius_rpc_url', 'https://mainnet.example/?api-key=abcd1234');
  config.update({
    providers: { rpc_url_ref: 'vault:helius_rpc_url' },
    execution: { capital_limit: 100 },
    hard_risk: Object.fromEntries(HARD_RISK_FIELDS.map((f) => [f, 5])),
    signer_session: { idle_timeout_ms: 600000, max_session_ms: 3600000, max_session_notional_usd: 500, lock_after_n_risk_rejections: 3 },
  });
  signer.importKey(JSON.stringify(Array.from({ length: 64 }, (_, i) => i + 1)));
  signer.openSession();
}

// ================= UNCONFIGURED (runs first; shared services are still empty) =================
test('unconfigured: capabilities report not_configured (NOT locked/blocked); open-by-design fields present', async () => {
  const r = await get(apiWith());
  assert.equal(r.status, 200);
  assert.equal(r.body.overall, 'not_configured');
  assert.equal(r.body.storage.status, 'available');         // json dev backend is available, not a failure
  assert.equal(r.body.hot_state.status, 'available');       // memory cache available
  assert.equal(r.body.event_sink.status, 'not_configured'); // analytics off => not_configured (not 'disabled'/'blocked')
  assert.equal(r.body.live_execution.status, 'not_configured');
  assert.ok(r.body.live_execution.missing_config.length > 0);
  assert.equal(r.body.live_execution.can_execute_when_configured, true); // open-by-design
  assert.ok(r.body.capability_status && r.body.read_only === true);
});

test('response carries NONE of the banned lock/gate/hard-stop vocabulary or fields', async () => {
  const r = await get(apiWith());
  assert.ok(!BANNED.test(JSON.stringify(r.body)), 'banned term in response');
  assert.equal('activation' in r.body, false, 'no activation block');
  assert.equal('blockers' in r.body, false, 'no top-level blockers (use missing_config / unavailable_dependencies)');
  assert.equal(JSON.stringify(r.body).includes('live_send_enabled'), false);
});

test('missing config surfaces as missing_config codes (rpc/hard_risk/etc.), not a lock', async () => {
  const r = await get(apiWith());
  const mc = r.body.live_execution.missing_config;
  assert.ok(mc.includes('rpc_provider_not_configured'));
  assert.ok(mc.includes('hard_risk_incomplete'));
  assert.ok(!BANNED.test(mc.join(' ')));
});

test('signer reports available/not_configured + can_sign — never locked/unlocked', async () => {
  const r = await get(apiWith());
  assert.equal(r.body.signer.status, 'not_configured'); // no key imported yet
  assert.equal(r.body.signer.can_sign, false);
  assert.ok(!/locked|unlocked/i.test(JSON.stringify(r.body.signer)));
});

test('signing_backend reports the Rust boundary capability — informational, never blocks (Phase Rust-1)', async () => {
  // no signerBackend probe -> official Rust boundary not configured; the in-process fallback is active
  const off = await get(apiWith());
  assert.equal(off.body.signing_backend.backend, 'in_process');
  assert.equal(off.body.signing_backend.status, 'not_configured');
  assert.equal(off.body.signing_backend.official, 'rust');
  assert.equal(off.body.capability_status.signing_backend, 'not_configured');
  // hot-executor configured + responding -> available
  const up = await get(apiWith({ runtimeProbes: { signerBackend: async () => ({ backend: 'rust', status: 'available' }) } }));
  assert.equal(up.body.signing_backend.status, 'available');
  assert.equal(up.body.signing_backend.backend, 'rust');
  // configured but DOWN -> unavailable, but it must NOT change `overall` (in-process fail-safe fallback)
  const baseProbes = { storage: async () => ({ backend: 'postgres', status: 'ok' }) };
  const ph = { snapshot: () => ({ rpc: { status: 'healthy' } }) };
  const base = await get(apiWith({ runtimeProbes: baseProbes, providerHealth: ph }));
  const down = await get(apiWith({ runtimeProbes: { ...baseProbes, signerBackend: async () => ({ backend: 'rust', status: 'unavailable' }) }, providerHealth: ph }));
  assert.equal(down.body.signing_backend.status, 'unavailable');
  assert.equal(down.body.overall, base.body.overall); // informational — signing_backend never changes overall
  assert.ok(!/locked|unlocked|hard[_ ]stop/i.test(JSON.stringify(down.body.signing_backend)));
});

test('a thrown probe degrades safely (never crashes, never blocks)', async () => {
  const r = await get(apiWith({ runtimeProbes: { storage: async () => { throw new Error('boom'); } } }));
  assert.equal(r.status, 200);
  assert.equal(r.body.storage.status, 'degraded');
});

test('readiness reads only: no liveExecutor / portfolio calls; read_only=true', async () => {
  le.n = 0; pos.n = 0;
  const r = await get(apiWith());
  assert.equal(le.n, 0);
  assert.equal(pos.n, 0);
  assert.equal(r.body.read_only, true);
});

// ================= configure the shared stack =================
test('(setup) configure the stack', () => { configure(); });

// ================= CONFIGURED =================
test('fully configured: live execution becomes available and overall is ready (no gate)', async () => {
  const r = await get(apiWith({ runtimeProbes: { storage: async () => ({ backend: 'postgres', status: 'ok' }) }, providerHealth: { snapshot: () => ({ rpc: { status: 'healthy' } }) } }));
  assert.equal(r.body.live_execution.status, 'available');
  assert.deepEqual(r.body.live_execution.missing_config, []);
  assert.equal(r.body.overall, 'ready');
  assert.equal(r.body.signer.status, 'available');
  assert.equal(r.body.signer.can_sign, true);
  assert.ok(!BANNED.test(JSON.stringify(r.body)));
});

test('storage unavailable => storage unavailable + overall unavailable (NOT blocked)', async () => {
  const r = await get(apiWith({ runtimeProbes: { storage: async () => ({ backend: 'postgres', status: 'fail' }) } }));
  assert.equal(r.body.storage.status, 'unavailable');
  assert.equal(r.body.overall, 'unavailable');
  assert.ok(r.body.unavailable_dependencies.includes('storage'));
  assert.ok(!/blocked/i.test(JSON.stringify(r.body)));
});

test('redis failure => hot_state degraded, other capabilities still reported (open-by-design)', async () => {
  const r = await get(apiWith({ runtimeProbes: { storage: async () => ({ backend: 'postgres', status: 'ok' }), hotState: async () => ({ backend: 'redis', status: 'degraded' }) } }));
  assert.equal(r.body.hot_state.status, 'degraded');
  assert.equal(r.body.overall, 'degraded');
  assert.equal(r.body.storage.status, 'available', 'cache failure does not affect storage');
  assert.equal(r.body.signer.status, 'available', 'cache failure does not affect signer');
});

test('clickhouse failure => event_sink degraded, overall degraded (analytics never blocks)', async () => {
  const r = await get(apiWith({ runtimeProbes: { eventSink: async () => ({ backend: 'clickhouse', status: 'degraded' }) } }));
  assert.equal(r.body.event_sink.status, 'degraded');
  assert.equal(r.body.overall, 'degraded');
});
