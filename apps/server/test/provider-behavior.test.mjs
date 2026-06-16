// provider-behavior.test.mjs — behavioural coverage of the apps/server provider wrappers, which delegate
// to @soltrade/provider-adapters (the canonical and only path; the legacy PROVIDER_BACKEND shim was
// removed). No real network: jito tip helpers are pure, provider-health takes an injected clock, jupiter
// + rpc use a global-fetch mock, helius-das takes an injected stub rpc.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { buildTipTransferTx, selectTipLamports } = await import('../src/engine/jito-tip-tx.mjs');
const { createProviderHealth } = await import('../src/engine/provider-health.mjs');
const { createJupiterClient } = await import('../src/engine/jupiter-client.mjs');
const { createRpcClient } = await import('../src/engine/rpc-client.mjs');
const { createDas } = await import('../src/engine/helius-das.mjs');

// ---------- jito selectTipLamports (pure) ----------
test('selectTipLamports: fixed fallback, floor*1e9, and [fixed,cap] clamping', () => {
  assert.equal(selectTipLamports({ floor: null, percentile: 50, fixedLamports: 10000 }), 10000); // no floor -> fixed
  assert.equal(selectTipLamports({ floor: { landed_tips_50th_percentile: 0.00002 }, percentile: 50, fixedLamports: 10000, maxLamports: 1_000_000 }), 20000);
  assert.equal(selectTipLamports({ floor: { landed_tips_95th_percentile: 0.001 }, percentile: 95, fixedLamports: 5000, maxLamports: 50000 }), 50000); // clamped to cap
  assert.equal(selectTipLamports({ floor: { landed_tips_50th_percentile: 0 }, percentile: 50, fixedLamports: 7777 }), 7777); // zero floor -> fixed
});

// ---------- jito buildTipTransferTx (pure) ----------
test('buildTipTransferTx: deterministic base64 tx; rejects bad inputs', () => {
  const K = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // a real 32-byte base58 pubkey
  const args = { owner: K, tipAccount: K, lamports: 10000, recentBlockhash: K };
  const tx = buildTipTransferTx(args);
  assert.equal(typeof tx, 'string');
  assert.ok(tx.length > 80, 'looks like a serialized tx');
  assert.equal(buildTipTransferTx(args), tx, 'deterministic for the same input');
  assert.throws(() => buildTipTransferTx({ ...args, lamports: 0 }), /tip_tx_bad_lamports/);
});

// ---------- provider-health (injected constant clock) ----------
test('provider-health: snapshot computes status/error_pct over the window', () => {
  const m = createProviderHealth({ window: 50, now: () => 1000 });
  m.record('rpc', true, 10, null);
  m.record('rpc', false, 40, 'rpc_http_429');
  m.record('jupiter', true, 25, null);
  const snap = m.snapshot();
  assert.equal(snap.rpc.calls, 2);
  assert.equal(snap.rpc.errors, 1);
  assert.equal(snap.rpc.error_pct, 50);
  assert.equal(snap.rpc.status, 'down');     // 50% >= DOWN_PCT
  assert.equal(snap.jupiter.status, 'healthy');
});

// ---------- jupiter quote / usdValueOf (global-fetch mock) ----------
function withFetch(impl, fn) {
  const prev = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve(fn()).finally(() => { globalThis.fetch = prev; });
}
const jupiter = () => createJupiterClient({ getApiKey: () => null, health: null });

test('jupiter quote: priced route, no-route, and HTTP error', async () => {
  await withFetch(async () => ({ ok: true, status: 200, json: async () => ({ outAmount: '1000000', inAmount: '1000', priceImpactPct: '0.01', routePlan: [{}, {}] }) }), async () => {
    const q = await jupiter().quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 });
    assert.equal(q.ok, true); assert.equal(q.outAmount, 1000000); assert.equal(q.routePlan, 2);
  });
  await withFetch(async () => ({ ok: true, status: 200, json: async () => ({ outAmount: '0' }) }), async () => {
    assert.equal((await jupiter().quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1 })).error, 'quote_no_route');
  });
  await withFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }), async () => {
    assert.equal((await jupiter().quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1 })).error, 'quote_http_503');
  });
});

test('jupiter usdValueOf: token -> USDC quote', async () => {
  await withFetch(async () => ({ ok: true, status: 200, json: async () => ({ outAmount: '12500000', inAmount: '100000000', priceImpactPct: '0.003', routePlan: [{}] }) }), async () => {
    const r = await jupiter().usdValueOf({ mint: 'M', qtyUi: 100, decimals: 6 });
    assert.equal(r.ok, true); assert.equal(r.usd, 12.5);
  });
});

// ---------- rpc.rpc (global-fetch mock) ----------
const rpcClient = () => createRpcClient({ getRpcUrl: () => 'http://rpc.test', getGrpcEndpoint: () => null, health: null });

test('rpc.rpc: result, JSON-RPC error, and HTTP error', async () => {
  await withFetch(async () => ({ ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result: 12345 }) }), async () => {
    assert.deepEqual(await rpcClient().rpc('getSlot', [{ commitment: 'confirmed' }]), { ok: true, result: 12345 });
  });
  await withFetch(async () => ({ ok: true, status: 200, json: async () => ({ error: { code: -32601, message: 'Method not found' } }) }), async () => {
    assert.equal((await rpcClient().rpc('bogus', [])).error, 'rpc_-32601');
  });
  await withFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }), async () => {
    assert.equal((await rpcClient().rpc('getSlot', [])).error, 'rpc_http_500');
  });
});

// ---------- helius-das getAssetMeta (injected stub rpc) ----------
test('helius getAssetMeta: hit, miss, and bad rpc', async () => {
  const hit = createDas({ rpc: { rpc: async () => ({ ok: true, result: { content: { metadata: { symbol: 'WIF', name: 'dogwifhat' }, links: { image: 'http://img/wif.png' } } } }) } });
  assert.deepEqual(await hit.getAssetMeta('Mint1'), { symbol: 'WIF', name: 'dogwifhat', icon: 'http://img/wif.png' });
  const miss = createDas({ rpc: { rpc: async () => ({ ok: false, error: 'rpc_-32601' }) } });
  assert.equal(await miss.getAssetMeta('Mint1'), null);
  assert.equal(await createDas({ rpc: null }).getAssetMeta('Mint1'), null);
});
