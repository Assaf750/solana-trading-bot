// index.mjs — boot: wire services, start the localhost server, print the operator URL.
import { createVaultService } from './vault.mjs';
import { createConfigService } from './config-service.mjs';
import { createWalletRegistry } from './wallet-registry.mjs';
import { createKillSwitch } from './kill-switch.mjs';
import { createOperatingState } from './operating-state.mjs';
import { createSignerService } from './signer-service.mjs';
import { createApi } from './api.mjs';
import { startServer } from './server.mjs';
import { appendAudit } from './audit-log.mjs';
import { ensureDataDir } from './util.mjs';

ensureDataDir();

const vault = createVaultService();
const config = createConfigService();
const wallets = createWalletRegistry();
const killSwitch = createKillSwitch();
const operatingState = createOperatingState();
const signer = createSignerService({ vault, config, killSwitch, audit: appendAudit });

let broadcastRef = () => {};
const api = createApi({
  config, wallets, killSwitch, operatingState, vault, signer,
  audit: appendAudit,
  broadcast: (p) => broadcastRef(p),
});

const port = Number(process.env.SOLTRADE_PORT) || 8787;
const { broadcast, url } = startServer({ api, port });
broadcastRef = broadcast;

// Boot state: stay/return to WARMING_UP unless KILLED persisted (a restart never resumes silently).
const boot = operatingState.get();
if (boot.operating_state !== 'KILLED' && boot.operating_state !== 'PAUSED') {
  operatingState.transition('WARMING_UP', 'server boot');
}
appendAudit({ audit_scope: 'config', audit_reason: 'server_started', detail: { url, boot_state: operatingState.get().operating_state } });

console.log('');
console.log('  ✅ SOLTRADE SERVER RUNNING');
console.log(`  ➜  افتح المتصفح:  ${url}`);
console.log(`     operating_state: ${operatingState.get().operating_state} · mode: ${config.get().mode}`);
console.log('     (Ctrl+C للإيقاف — الحالة محفوظة، وإعادة التشغيل لا تستأنف التداول صامتاً)');
console.log('');

// graceful shutdown: lock the signer, persist nothing half-written (writes are atomic)
function shutdown() {
  try { signer.lockSession('shutdown'); } catch { /* already locked */ }
  appendAudit({ audit_scope: 'config', audit_reason: 'server_shutdown', detail: {} });
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
