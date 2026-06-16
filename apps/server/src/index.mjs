// index.mjs — boot: wire services, start the localhost server, print the operator URL.
import { createVaultService } from './vault.mjs';
import { createConfigService } from './config-service.mjs';
import { createWalletRegistry } from './wallet-registry.mjs';
import { createKillSwitch } from './kill-switch.mjs';
import { createOperatingState } from './operating-state.mjs';
import { createSignerService } from './signer-service.mjs';
import { createApi } from './api.mjs';
import { startServer } from './server.mjs';
import { appendAudit, configureAuditStore } from './audit-log.mjs';
import { ensureDataDir } from './util.mjs';
import { createPaperPortfolio } from './engine/paper-portfolio.mjs';
import { createOrdersStore } from './engine/orders.mjs';
import { createHistory } from './engine/history.mjs';
import { createRpcClient } from './engine/rpc-client.mjs';
import { createJupiterClient } from './engine/jupiter-client.mjs';
import { createProviderHealth } from './engine/provider-health.mjs';
import { createPaperEngine } from './engine/paper-engine.mjs';
import { createLiveExecutor } from './engine/live-executor.mjs';
import { createHotExecutorClient } from './engine/hot-executor-client.mjs';
import { analyzeWallet } from './engine/wallet-analyzer.mjs';
import { analyzeToken as analyzeTokenImpl } from './engine/token-analysis.mjs';
import { discoverTokenTraders, discoverFromLeaders as discoverFromLeadersImpl } from './engine/wallet-discovery.mjs';
import { createTokenMetadata } from './engine/token-metadata.mjs';
import { createDas } from './engine/helius-das.mjs';
import { createJitoProvider } from '../../../packages/provider-adapters/src/index.mjs';
import { createDiagnosticExecutionAdapter } from '../../../packages/execution/src/index.mjs';
import { createMemoryHotStateStore } from '../../../packages/hot-state/src/index.mjs';
import { createStorageBackend, createDecisionLedgerStore, createPositionStore, createAuditStore } from './storage/storage-backend.mjs';
import { createHotStateBackend } from './storage/redis-client.mjs';
import { createEventSinkBackend, createAnalyticsReader } from './storage/clickhouse-client.mjs';
import { createNotifier } from './notifier.mjs';

ensureDataDir();

const vault = createVaultService();
const config = createConfigService();
const wallets = createWalletRegistry();
const killSwitch = createKillSwitch();
const operatingState = createOperatingState();
const signer = createSignerService({ vault, config, killSwitch, audit: appendAudit });

// ADR-0001 Phase 4B: resolve the storage backend once (STORAGE_BACKEND=json|postgres). Fail-clear at
// boot on bad/missing config; the json default loads no pg.
const storageBackend = await createStorageBackend({ env: process.env });
// ADR-0001 Phase 4B.3: route the operational audit trail to the active backend (json JSONL default;
// postgres append-only). The standalone appendAudit/readAuditTail then delegate to it.
configureAuditStore(await createAuditStore(storageBackend));

// engine wiring — secrets resolved from the vault AT CALL TIME, never cached/logged
const portfolio = createPaperPortfolio({ positionStore: await createPositionStore(storageBackend, { file: 'paper-portfolio.json', simulated: true }) });
// live operational health of the external providers the money path leans on (Jupiter, RPC)
const providerHealth = createProviderHealth();
const rpc = createRpcClient({
  health: providerHealth,
  getRpcUrl: () => {
    const ref = config.get().providers?.rpc_url_ref;
    if (!ref?.startsWith('vault:')) return null;
    const r = vault.getSecretForUse(ref.slice(6));
    return r.ok ? r.value : null;
  },
  // Yellowstone/Geyser gRPC endpoint (preferred ingestion transport when configured). The
  // endpoint URL and optional x-token are vault refs; null => fall back to WebSocket.
  getGrpcEndpoint: () => {
    const p = config.get().providers || {};
    if (!p.grpc_url_ref?.startsWith('vault:')) return null;
    const u = vault.getSecretForUse(p.grpc_url_ref.slice(6));
    if (!u.ok) return null;
    let token;
    if (p.grpc_token_ref?.startsWith('vault:')) {
      const t = vault.getSecretForUse(p.grpc_token_ref.slice(6));
      token = t.ok ? t.value : undefined;
    }
    return { endpoint: u.value, token };
  },
});
const jupiter = createJupiterClient({
  health: providerHealth,
  getApiKey: () => {
    const ref = config.get().providers?.jupiter_key_ref;
    if (!ref?.startsWith('vault:')) return null;
    const r = vault.getSecretForUse(ref.slice(6));
    return r.ok ? r.value : null;
  },
});

let broadcastRef = () => {};

// best-effort operator notifications (Telegram/webhook). Secrets resolved from the vault at
// send time; never blocks or affects trading.
const notifier = createNotifier({ config, getSecret: (name) => vault.getSecretForUse(name) });

// LIVE book + executor — real money path, fully gated (mode + signer session + kill
// switch + readiness); separate file from the paper book, never mixed
const livePortfolio = createPaperPortfolio({ file: 'live-portfolio.json', simulated: false, positionStore: await createPositionStore(storageBackend, { file: 'live-portfolio.json', simulated: false }) });
// Optional Rust hot-executor for signing — active only when the binary path is set AND the owner
// flips execution.signer_backend='rust'. Any failure falls back to in-process signing (fail-safe).
const hotSigner = process.env.HOT_EXECUTOR_BIN
  ? createHotExecutorClient({ binPath: process.env.HOT_EXECUTOR_BIN })
  : null;
// Jito bundle sender — POSTs to the configured block-engine URL (vault ref). Only invoked when
// execution.submit_backend='jito' AND the URL is set; the live-executor falls back to RPC on any
// failure. The URL is resolved from the vault at call time and never logged.
// Jito bundle sender + tip floor — OWNED by @soltrade/provider-adapters (ADR-0001 Phase 2D). The
// PROVIDER_BACKEND legacy in-process glue was REMOVED in Phase 3B.4 after parity was proven
// byte-identical (url-unset / unavailable / http-error / json-rpc-error / no-result / success + tip
// floor). The block-engine URL is resolved from the vault at call time (never logged) via getBundleUrl.
const jitoProvider = createJitoProvider({
  request: (u, o) => fetch(u, o),
  getBundleUrl: () => {
    const ref = config.get().providers?.jito_url_ref;
    if (!ref?.startsWith('vault:')) return { ok: false, error: 'jito_url_unset' };
    const r = vault.getSecretForUse(ref.slice(6));
    if (!r.ok) return { ok: false, error: 'jito_url_unavailable' };
    return { ok: true, url: r.value };
  },
});
const jitoSendBundle = (txsBase64) => jitoProvider.sendBundle(txsBase64);
const getJitoTipFloor = () => jitoProvider.getTipFloor();
// ADR-0001 Phase 4B.1: the decision-ledger store comes from the same storage backend resolved above.
const decisionLedgerStore = await createDecisionLedgerStore(storageBackend);
const liveExecutor = createLiveExecutor({
  config, vault, signer, killSwitch, operatingState, rpc, jupiter,
  audit: appendAudit, broadcast: (p) => broadcastRef(p), hotSigner, jitoSendBundle, getJitoTipFloor,
  decisionLedgerStore,
});

const ordersStore = createOrdersStore();
const history = createHistory();

const paperEngine = createPaperEngine({
  config, walletsRegistry: wallets, killSwitch, operatingState, vault, portfolio,
  livePortfolio, liveExecutor, signer,
  rpc, jupiter, audit: appendAudit, broadcast: (p) => broadcastRef(p), notifier, ordersStore,
});

// DAS enriches token display metadata for mints Jupiter doesn't list (Helius-only, degrades to
// null elsewhere); used as a fallback inside the cached token-metadata resolver.
const das = createDas({ rpc });
const tokenMeta = createTokenMetadata({ dasResolve: (mint) => das.getAssetMeta(mint) });

// ADR-0001 Phase 5A: DiagnosticExecutionAdapter — pre-flight diagnostics over the SAME live
// providers (read-only; never opens a position, claims an intent, or broadcasts). Behind a flag
// (DIAGNOSTIC_BACKEND=package); default 'legacy' leaves it unconstructed and the engine untouched.
const diagnostics = process.env.DIAGNOSTIC_BACKEND === 'package'
  ? createDiagnosticExecutionAdapter({ rpc, jupiter, jito: jitoProvider, providerHealth })
  : null;

// ADR-0001 Phase 6A/6B: optional hot-state cache (provider-health + readiness only; never SoT).
// memory by default. FAIL-OPEN even at boot: if HOT_STATE_BACKEND=redis but Redis is unreachable, fall
// back to the in-process memory cache rather than failing the server — a cache must never block trading.
let hotState;
try {
  hotState = (await createHotStateBackend({ env: process.env })).store;
} catch (e) {
  console.warn(`hot-state: ${e?.message || e} — falling back to in-process memory cache`);
  hotState = createMemoryHotStateStore();
}

// ADR-0001 Phase 7A/7B: optional append-only analytics sink (ClickHouse). EVENT_SINK_BACKEND=none by
// default. Wired ONLY to non-critical surfaces (diagnostics + provider-health), best-effort + fail-open.
// FAIL-OPEN at boot too: a misconfigured sink disables analytics rather than blocking the server.
let eventSink = null;
try {
  eventSink = await createEventSinkBackend({ env: process.env });
} catch (e) {
  console.warn(`event-sink: ${e?.message || e} — analytics sink disabled`);
  eventSink = null;
}

// ADR-0001 Phase 7C: OPTIONAL analytics reader (read-only operator insights over ClickHouse). Reuses
// the event-sink client when present; not_configured when EVENT_SINK_BACKEND != clickhouse. Never SoT,
// never required, never affects readiness/trading.
let analytics = null;
try {
  analytics = createAnalyticsReader({ env: process.env, clickHouseClient: eventSink?.client });
} catch (e) {
  console.warn(`analytics-reader: ${e?.message || e} — analytics insights disabled`);
  analytics = null;
}

// ADR-0001 Phase 8A: read-only runtime-readiness probes. Each is best-effort + fail-open and reports
// per-backend status WITHOUT mutating anything or opening live. Postgres is the only hard blocker (it's
// the operational SoT when configured); Redis (cache) and ClickHouse (analytics) only ever degrade.
const runtimeProbes = {
  storage: async () => {
    if (storageBackend.backend !== 'postgres') return { backend: storageBackend.backend || 'json', status: 'ok' };
    try { await storageBackend.executor.query('SELECT 1', []); return { backend: 'postgres', status: 'ok' }; }
    catch { return { backend: 'postgres', status: 'fail' }; } // configured SoT down -> blocker
  },
  hotState: async () => {
    const backend = hotState?.backend || 'memory';
    if (backend !== 'redis') return { backend, status: 'ok' };
    try { await hotState.get('__readiness_probe__'); return { backend: 'redis', status: 'ok' }; }
    catch { return { backend: 'redis', status: 'degraded' }; } // cache down -> degraded, never blocked
  },
  eventSink: async () => {
    const backend = eventSink?.backend || 'none';
    if (backend !== 'clickhouse') return { backend, status: 'disabled' };
    try { return { backend: 'clickhouse', status: (await eventSink.client.ping()) ? 'ok' : 'degraded' }; }
    catch { return { backend: 'clickhouse', status: 'degraded' }; } // analytics down -> degraded
  },
};

const api = createApi({
  config, wallets, killSwitch, operatingState, vault, signer,
  audit: appendAudit,
  broadcast: (p) => broadcastRef(p),
  paperEngine, portfolio, livePortfolio, liveExecutor, rpc, tokenMeta, notifier, history, providerHealth, diagnostics, hotState, eventSink, runtimeProbes, analytics,
  analyzeWallet: ({ address }) => analyzeWallet({ address, rpc, jupiter }),
  analyzeToken: ({ mint }) => analyzeTokenImpl({ mint, rpc, jupiter, das, tokenMeta, discoverTraders: ({ mint: m }) => discoverTokenTraders({ mint: m, rpc }) }),
  discoverTraders: ({ mint }) => discoverTokenTraders({ mint, rpc }),
  discoverFromLeaders: () => discoverFromLeadersImpl({
    leaders: wallets.list().filter((w) => w.follow_enabled).map((w) => w.tracked_wallet_address),
    rpc,
  }),
});

const port = Number(process.env.SOLTRADE_PORT) || 8787;
const { broadcast, url } = startServer({ api, port });
broadcastRef = broadcast;

// Boot state: stay/return to WARMING_UP unless KILLED persisted (a restart never resumes silently).
const boot = operatingState.get();
if (boot.operating_state !== 'KILLED' && boot.operating_state !== 'PAUSED') {
  operatingState.transition('WARMING_UP', 'server boot');
}
paperEngine.start(); // supervised: idles honestly until vault+RPC+followed wallets exist
appendAudit({ audit_scope: 'config', audit_reason: 'server_started', detail: { url, boot_state: operatingState.get().operating_state } });

console.log('');
console.log('  ✅ SOLTRADE SERVER RUNNING');
console.log(`  ➜  افتح المتصفح:  ${url}`);
console.log(`     operating_state: ${operatingState.get().operating_state} · mode: ${config.get().mode}`);
console.log('     (Ctrl+C للإيقاف — الحالة محفوظة، وإعادة التشغيل لا تستأنف التداول صامتاً)');
console.log('');

// graceful shutdown: lock the signer, persist nothing half-written (writes are atomic)
function shutdown() {
  try { paperEngine.stop(); } catch { /* already stopped */ }
  try { signer.lockSession('shutdown'); } catch { /* already locked */ }
  appendAudit({ audit_scope: 'config', audit_reason: 'server_shutdown', detail: {} });
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
