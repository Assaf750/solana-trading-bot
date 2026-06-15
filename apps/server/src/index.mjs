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
// server delegates behind PROVIDER_BACKEND (default=package); the URL is resolved from the vault at
// call time (never logged) and injected via getBundleUrl. The legacy in-process glue is retained.
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
async function jitoSendBundle(txsBase64) {
  return process.env.PROVIDER_BACKEND === 'legacy' ? legacyJitoSendBundle(txsBase64) : jitoProvider.sendBundle(txsBase64);
}
async function getJitoTipFloor() {
  return process.env.PROVIDER_BACKEND === 'legacy' ? legacyGetJitoTipFloor() : jitoProvider.getTipFloor();
}
async function legacyJitoSendBundle(txsBase64) {
  const ref = config.get().providers?.jito_url_ref;
  if (!ref?.startsWith('vault:')) return { ok: false, error: 'jito_url_unset' };
  const r = vault.getSecretForUse(ref.slice(6));
  if (!r.ok) return { ok: false, error: 'jito_url_unavailable' };
  try {
    const res = await fetch(`${r.value.replace(/\/+$/, '')}/api/v1/bundles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendBundle', params: [txsBase64, { encoding: 'base64' }] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, error: `jito_http_${res.status}` };
    const j = await res.json();
    if (j.error) return { ok: false, error: `jito_${j.error.code ?? 'err'}` };
    // a 200 with no bundle id is NOT an accept — treat as failure so submitSigned falls back to RPC
    if (!j.result) return { ok: false, error: 'jito_no_bundle_id' };
    return { ok: true, result: j.result };
  } catch (e) {
    return { ok: false, error: `jito_failed_${String(e?.name || 'err')}` };
  }
}
// Live Jito tip floor (dynamic-tip mode). Public endpoint; best-effort with a short timeout —
// any failure makes resolveTipLamports fall back to the fixed jito_tip_lamports.
async function legacyGetJitoTipFloor() {
  try {
    const res = await fetch('https://bundles.jito.wtf/api/v1/bundles/tip_floor', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j) ? j[0] : j;
  } catch {
    return null;
  }
}
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

const api = createApi({
  config, wallets, killSwitch, operatingState, vault, signer,
  audit: appendAudit,
  broadcast: (p) => broadcastRef(p),
  paperEngine, portfolio, livePortfolio, liveExecutor, rpc, tokenMeta, notifier, history, providerHealth, diagnostics, hotState,
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
