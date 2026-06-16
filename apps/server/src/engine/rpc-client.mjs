// rpc-client.mjs — Solana JSON-RPC (HTTP) + wallet activity stream (WebSocket).
// The RPC URL comes from the encrypted vault at call time and is never logged.
//
// Streaming strategy (auto-detected per provider):
//  - Helius (host contains "helius"): ONE transactionSubscribe with accountInclude=[all
//    followed wallets] and transactionDetails:full -> leader tx delivered INLINE
//    (no per-signature getTransaction round-trip; fewer credits, lower latency).
//  - Generic RPC: logsSubscribe per address -> signature only -> engine fetches the tx.
//  Both paths get a 60s keepalive frame (Helius closes idle sockets after 10 min).

import { createGrpcIngestor } from '../../../../services/ingestor/src/grpc-ingestor.mjs';
import { createRpcProvider } from '../../../../packages/provider-adapters/src/index.mjs';

/** Pure: is this a Helius endpoint (supports enhanced transactionSubscribe)? */
export function isHeliusHost(url) {
  try { return new URL(url).hostname.toLowerCase().includes('helius'); } catch { return false; }
}

/**
 * Pure: build the subscription JSON-RPC message(s) for a wallet set.
 * Default = logsSubscribe (one per address) — universally supported on every Solana
 * RPC incl. the standard Helius endpoint / free plan, so signals actually flow.
 * Helius `transactionSubscribe` (enhanced/Atlas WS) only delivers on the dedicated
 * atlas endpoint + paid plan, so it is opt-in via `enhanced:true`, not the default.
 */
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

// RPC calls (HTTP + wallet stream) are OWNED by @soltrade/provider-adapters (ADR-0001 Phase 2D).
// The PROVIDER_BACKEND legacy in-process shim was REMOVED in Phase 3B.4 after 3B.3/3B.4 proved the
// legacy path was byte-identical to the package — including the subscribeWallets streaming trace
// (subscriptions, onUp/onLeaderActivity/onGap, reconnect/backoff) via a fake-WS + mock-timer harness,
// and the gRPC dispatch args. The server injects the live mechanisms (gRPC ingestor factory, fetch,
// WebSocket) into the package provider; the pure helpers above are re-exported for direct callers.
export function createRpcClient(args) {
  return createRpcProvider({
    grpcIngestorFactory: createGrpcIngestor,
    request: (u, o) => fetch(u, o),
    wsFactory: (u) => new WebSocket(u),
    ...args,
  });
}
