// rpc-client.mjs — Solana JSON-RPC (HTTP) + wallet activity stream (WebSocket).
// The RPC URL comes from the encrypted vault at call time and is never logged.
//
// Streaming strategy (auto-detected per provider):
//  - Helius (host contains "helius"): ONE transactionSubscribe with accountInclude=[all
//    followed wallets] and transactionDetails:full -> leader tx delivered INLINE
//    (no per-signature getTransaction round-trip; fewer credits, lower latency).
//  - Generic RPC: logsSubscribe per address -> signature only -> engine fetches the tx.
//  Both paths get a 60s keepalive frame (Helius closes idle sockets after 10 min).

/** Pure: is this a Helius endpoint (supports enhanced transactionSubscribe)? */
export function isHeliusHost(url) {
  try { return new URL(url).hostname.toLowerCase().includes('helius'); } catch { return false; }
}

/** Pure: build the subscription JSON-RPC message(s) for a provider + wallet set. */
export function buildWalletSubscriptions({ addresses, helius }) {
  if (helius) {
    return [{
      jsonrpc: '2.0', id: 1, method: 'transactionSubscribe',
      params: [
        { accountInclude: addresses, vote: false, failed: false },
        { commitment: 'confirmed', encoding: 'jsonParsed', transactionDetails: 'full', maxSupportedTransactionVersion: 0 },
      ],
    }];
  }
  return addresses.map((addr, i) => ({
    jsonrpc: '2.0', id: 100 + i, method: 'logsSubscribe',
    params: [{ mentions: [addr] }, { commitment: 'confirmed' }],
  }));
}

/** Pure: extract { signature, tx } from a stream notification (Helius inline or logs). */
export function parseStreamNotification(msg) {
  const method = msg?.method;
  if (method === 'transactionNotification') {
    const v = msg.params?.result?.value || msg.params?.result;
    const sig = v?.signature || v?.transaction?.signatures?.[0];
    if (!sig) return null;
    if (v?.transaction?.meta?.err) return null;
    // reshape to the getTransaction-style object the swap-detector expects
    const tx = v?.transaction ? { transaction: v.transaction.transaction || v.transaction, meta: v.transaction.meta || v.meta } : null;
    return { signature: sig, tx };
  }
  if (method === 'logsNotification') {
    const v = msg.params?.result?.value;
    if (!v || v.err) return null;
    return { signature: v.signature, tx: null };
  }
  return null;
}

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

  /** Runtime readiness probe used when the owner enters/validates an RPC key. */
  async function testConnection() {
    const url = getRpcUrl();
    if (!url) return { ok: false, error: 'rpc_url_unavailable' };
    const started = Date.now();
    const v = await rpc('getVersion', []);
    const latency_ms = Date.now() - started;
    if (!v.ok) return { ok: false, error: v.error, latency_ms };
    const slot = await getSlot();
    return {
      ok: true,
      solana_core: v.result?.['solana-core'] || null,
      current_slot: slot.ok ? slot.result : null,
      latency_ms,
      provider: isHeliusHost(url) ? 'helius' : 'generic',
      enhanced_stream: isHeliusHost(url),
    };
  }

  function wsUrlFromHttp(url) {
    try {
      const u = new URL(url);
      u.protocol = u.protocol === 'http:' ? 'ws:' : 'wss:';
      return u.toString();
    } catch { return null; }
  }

  /**
   * Subscribe to leader-wallet activity. onLeaderActivity({signature, tx}) fires per event
   * (tx inline on Helius, null on generic -> engine fetches). Bounded-backoff reconnect;
   * onGap() fires when the stream has been down longer than gapMs. 60s keepalive frame.
   */
  function subscribeWallets({ addresses, onLeaderActivity, onUp, onGap, gapMs = 120000 }) {
    let ws = null;
    let closed = false;
    let backoff = 1000;
    let downSince = null;
    let gapTimer = null;
    let keepAlive = null;

    function connect() {
      if (closed) return;
      const http = getRpcUrl();
      const wsUrl = http ? wsUrlFromHttp(http) : null;
      if (!wsUrl) { scheduleReconnect(); return; }
      const helius = isHeliusHost(http);
      try { ws = new WebSocket(wsUrl); } catch { scheduleReconnect(); return; }

      ws.onopen = () => {
        backoff = 1000;
        downSince = null;
        if (gapTimer) { clearTimeout(gapTimer); gapTimer = null; }
        for (const sub of buildWalletSubscriptions({ addresses, helius })) {
          try { ws.send(JSON.stringify(sub)); } catch { /* will reconnect */ }
        }
        // keepalive: a lightweight frame every 60s (Helius idle close at 10 min)
        keepAlive = setInterval(() => {
          try { ws.send(JSON.stringify({ jsonrpc: '2.0', id: 'keepalive', method: 'getHealth' })); }
          catch { /* socket gone; onclose handles it */ }
        }, 60000);
        if (onUp) onUp({ provider: helius ? 'helius' : 'generic' });
      };
      ws.onmessage = (ev) => {
        try {
          const parsed = parseStreamNotification(JSON.parse(ev.data));
          if (parsed) onLeaderActivity(parsed);
        } catch { /* malformed/keepalive-reply frame — ignore */ }
      };
      ws.onclose = () => { if (keepAlive) clearInterval(keepAlive); scheduleReconnect(); };
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
        if (keepAlive) clearInterval(keepAlive);
        try { ws?.close(); } catch { /* fine */ }
      },
    };
  }

  return { rpc, getHealth, getSlot, getTransaction, testConnection, subscribeWallets };
}
