// rpc-client.mjs — Solana JSON-RPC (HTTP) + logsSubscribe (WebSocket, native global).
// The RPC URL comes from the encrypted vault at call time and is never logged.
export function createRpcClient({ getRpcUrl }) {
  async function rpc(method, params) {
    const url = getRpcUrl();
    if (!url) return { ok: false, error: 'rpc_url_unavailable' };
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
        if (!res.ok) return { ok: false, error: `rpc_http_${res.status}` };
        const j = await res.json();
        if (j.error) return { ok: false, error: `rpc_${j.error.code}`, message: String(j.error.message || '').slice(0, 120) };
        return { ok: true, result: j.result };
      } catch (e) {
        if (attempt >= 3) return { ok: false, error: `rpc_failed_${String(e?.name || 'err')}` };
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    return { ok: false, error: 'rpc_retries_exhausted' };
  }

  const getHealth = () => rpc('getHealth', []);
  const getSlot = () => rpc('getSlot', [{ commitment: 'confirmed' }]);
  const getTransaction = (signature) => rpc('getTransaction', [signature, {
    encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0,
  }]);

  function wsUrlFromHttp(url) {
    try {
      const u = new URL(url);
      u.protocol = u.protocol === 'http:' ? 'ws:' : 'wss:';
      return u.toString();
    } catch { return null; }
  }

  /**
   * Subscribe to logs mentioning each address. onSignature(address, signature) fires per event.
   * Returns { close() }. Reconnects with bounded exponential backoff; onGap() fires when the
   * stream has been down for longer than gapMs.
   */
  function subscribeLogs({ addresses, onSignature, onUp, onGap, gapMs = 120000 }) {
    let ws = null;
    let closed = false;
    let backoff = 1000;
    let downSince = null;
    let gapTimer = null;

    function connect() {
      if (closed) return;
      const http = getRpcUrl();
      const wsUrl = http ? wsUrlFromHttp(http) : null;
      if (!wsUrl) { scheduleReconnect(); return; }
      try {
        ws = new WebSocket(wsUrl);
      } catch { scheduleReconnect(); return; }

      ws.onopen = () => {
        backoff = 1000;
        downSince = null;
        if (gapTimer) { clearTimeout(gapTimer); gapTimer = null; }
        addresses.forEach((addr, i) => {
          ws.send(JSON.stringify({
            jsonrpc: '2.0', id: 100 + i, method: 'logsSubscribe',
            params: [{ mentions: [addr] }, { commitment: 'confirmed' }],
          }));
        });
        if (onUp) onUp();
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const sig = msg?.params?.result?.value?.signature;
          if (sig && !msg.params.result.value.err) {
            // we don't know which address matched; the engine checks the tx against all leaders
            onSignature(sig);
          }
        } catch { /* malformed frame — ignore */ }
      };
      ws.onclose = () => scheduleReconnect();
      ws.onerror = () => { try { ws.close(); } catch { /* already closing */ } };
    }

    function scheduleReconnect() {
      if (closed) return;
      if (!downSince) {
        downSince = Date.now();
        gapTimer = setTimeout(() => { if (onGap && !closed) onGap(); }, gapMs);
      }
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 60000);
    }

    connect();
    return {
      close() {
        closed = true;
        if (gapTimer) clearTimeout(gapTimer);
        try { ws?.close(); } catch { /* fine */ }
      },
    };
  }

  return { rpc, getHealth, getSlot, getTransaction, subscribeLogs };
}
