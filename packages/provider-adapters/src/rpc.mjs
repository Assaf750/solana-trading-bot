// @soltrade/provider-adapters — Solana RPC provider (ADR-0001 Phase 2D).
// Byte-for-byte port of apps/server engine/rpc-client.mjs. The gRPC ingestor factory is INJECTED
// (grpcIngestorFactory) so the package does not import services/ingestor.

/** Pure: is this a Helius endpoint (supports enhanced transactionSubscribe)? */
export function isHeliusHost(url) {
  try { return new URL(url).hostname.toLowerCase().includes('helius'); } catch { return false; }
}

/** Pure: build the subscription JSON-RPC message(s) for a wallet set. */
export function buildWalletSubscriptions({ addresses, enhanced = false }) {
  if (enhanced) {
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

// `request` (fetch-compatible) and `wsFactory` (url => WebSocket-like) are injected so the package
// stays free of live network primitives (mechanism-guard pure); the server passes fetch/WebSocket.
export function createRpcProvider({ getRpcUrl, getGrpcEndpoint, grpcIngestorFactory, health, request, wsFactory } = {}) {
  // `prebuiltBody` (Phase Rust-4): when provided, this EXACT JSON-RPC body is POSTed verbatim instead of
  // being assembled here — so the Rust hot-executor (the hot-path execution owner) can own request-body
  // assembly while the POST + retries + health + error-mapping (and the caller's idempotency) stay in JS.
  // `method` is still used only as the health-record label. Omit it for the unchanged JS-assembled path.
  async function rpc(method, params, { body: prebuiltBody = null } = {}) {
    const url = getRpcUrl();
    if (!url) return { ok: false, error: 'rpc_url_unavailable' };
    const t0 = Date.now();
    const rec = (r) => { if (health) health.record('rpc', r.ok, Date.now() - t0, r.error); return r; };
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      try {
        const res = await request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(prebuiltBody || { jsonrpc: '2.0', id: 1, method, params }),
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
        if (!res.ok) return rec({ ok: false, error: `rpc_http_${res.status}` });
        const j = await res.json();
        if (j.error) return rec({ ok: false, error: `rpc_${j.error.code}`, message: String(j.error.message || '').slice(0, 120) });
        return rec({ ok: true, result: j.result });
      } catch (e) {
        if (attempt >= 3) return rec({ ok: false, error: `rpc_failed_${String(e?.name || 'err')}` });
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    return rec({ ok: false, error: 'rpc_retries_exhausted' });
  }

  const getHealth = () => rpc('getHealth', []);
  const getSlot = () => rpc('getSlot', [{ commitment: 'confirmed' }]);
  const getTransaction = (signature) => rpc('getTransaction', [signature, {
    encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0,
  }]);

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

  function subscribeWallets({ addresses, onLeaderActivity, onUp, onGap, gapMs = 120000 }) {
    const grpc = typeof getGrpcEndpoint === 'function' ? getGrpcEndpoint() : null;
    if (grpc && grpc.endpoint) {
      return grpcIngestorFactory({
        endpoint: grpc.endpoint, token: grpc.token, addresses,
        onLeaderActivity, onUp, onGap, gapMs,
      });
    }
    let ws = null;
    let closed = false;
    let backoff = 1000;
    let downSince = null;
    let gapTimer = null;
    let keepAlive = null;
    let reconnectTimer = null;

    function connect() {
      if (closed) return;
      const http = getRpcUrl();
      const wsUrl = http ? wsUrlFromHttp(http) : null;
      if (!wsUrl) { scheduleReconnect(); return; }
      const helius = isHeliusHost(http);
      try { ws = wsFactory(wsUrl); } catch { scheduleReconnect(); return; }

      ws.onopen = () => {
        backoff = 1000;
        downSince = null;
        if (gapTimer) { clearTimeout(gapTimer); gapTimer = null; }
        for (const sub of buildWalletSubscriptions({ addresses, enhanced: false })) {
          try { ws.send(JSON.stringify(sub)); } catch { /* will reconnect */ }
        }
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
      reconnectTimer = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 60000);
    }

    connect();
    return {
      close() {
        closed = true;
        if (gapTimer) clearTimeout(gapTimer);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (keepAlive) clearInterval(keepAlive);
        try { ws?.close(); } catch { /* fine */ }
      },
    };
  }

  return { rpc, getHealth, getSlot, getTransaction, testConnection, subscribeWallets };
}
