// client.js — backend API client. Same-origin in production (server serves the UI);
// localhost:8787 during `vite dev`. No secrets are ever stored client-side.
const DEV = typeof window !== 'undefined' && window.location.port === '5173';
export const API_BASE = DEV ? 'http://127.0.0.1:8787' : '';

async function call(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, ok: res.ok, data };
}

export const api = {
  // reads
  status: () => call('GET', '/api/status'),
  config: () => call('GET', '/api/config'),
  readiness: () => call('GET', '/api/readiness'),
  wallets: () => call('GET', '/api/wallets'),
  secrets: () => call('GET', '/api/secrets'),
  audit: (limit = 50) => call('GET', `/api/audit?limit=${limit}`),
  positions: () => call('GET', '/api/positions'),
  trades: () => call('GET', '/api/trades'),
  engineEvents: () => call('GET', '/api/engine-events'),

  // SSOT commands
  command: (command_type, payload = {}) => call('POST', '/api/commands', { command_type, ...payload }),
  updateConfig: (patch) => call('POST', '/api/commands', { command_type: 'update_config', patch }),
  registerWallet: (p) => call('POST', '/api/commands', { command_type: 'register_wallet', ...p }),
  setFollow: (wallet_id, on) => call('POST', '/api/commands', { command_type: on ? 'enable_wallet_follow' : 'disable_wallet_follow', wallet_id }),
  updateWalletConfig: (wallet_id, patch) => call('POST', '/api/commands', { command_type: 'update_wallet_config', wallet_id, patch }),
  pauseSystem: () => call('POST', '/api/commands', { command_type: 'pause_system' }),
  resumeSystem: () => call('POST', '/api/commands', { command_type: 'resume_system' }),
  triggerKill: (level = 'global', key = null, reason = 'manual') => call('POST', '/api/commands', { command_type: 'trigger_kill_switch', level, key, reason }),
  activateRealLive: (confirm) => call('POST', '/api/commands', { command_type: 'activate_real_live', confirm }),
  deactivateRealLive: () => call('POST', '/api/real-live/deactivate', {}),

  // vault / secrets / signer (local ops surfaces)
  vaultCreate: (passphrase) => call('POST', '/api/vault/create', { passphrase }),
  vaultUnlock: (passphrase) => call('POST', '/api/vault/unlock', { passphrase }),
  vaultLock: () => call('POST', '/api/vault/lock', {}),
  storeSecret: (name, value) => call('POST', '/api/secrets', { name, value }),
  deleteSecret: (name) => call('DELETE', `/api/secrets/${encodeURIComponent(name)}`),
  testProviderConnection: () => call('POST', '/api/providers/test-connection', {}),
  analyzeWallet: (address) => call('POST', '/api/wallets/analyze', { address }),
  signerImportKey: (secret) => call('POST', '/api/signer/import-key', { secret }),
  signerOpenSession: () => call('POST', '/api/signer/open-session', {}),
  signerLock: () => call('POST', '/api/signer/lock', {}),
  killDisengage: (level = 'global', key = null, confirm) => call('POST', '/api/kill-switch/disengage', { level, key, confirm }),
  removeWallet: (wallet_id) => call('DELETE', `/api/wallets/${encodeURIComponent(wallet_id)}`),
};

export function subscribeStream(onEvent) {
  try {
    const es = new EventSource(`${API_BASE}/api/stream`);
    es.onmessage = (e) => {
      try { onEvent(JSON.parse(e.data)); } catch { /* ignore malformed */ }
    };
    return () => es.close();
  } catch {
    return () => {};
  }
}
