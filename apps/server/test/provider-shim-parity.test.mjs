// provider-shim-parity.test.mjs — ADR-0001 Phase 3B.3. Proves the PROVIDER_BACKEND legacy path is
// behaviourally identical to the @soltrade/provider-adapters package path for the cleanly-testable
// dispatch points (no real network): jito-tip pure helpers, provider-health (injected clock), and
// jupiter quote/usdValueOf (shared global-fetch mock). This builds the safety net BEFORE any removal;
// the removal itself is DEFERRED to 3B.4 (rpc.subscribeWallets streaming + index.mjs jito glue are not
// unit-provable) — see docs/architecture/legacy-audit.md §8.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { buildTipTransferTx, selectTipLamports } = await import('../src/engine/jito-tip-tx.mjs');
const { createProviderHealth } = await import('../src/engine/provider-health.mjs');
const { createJupiterClient } = await import('../src/engine/jupiter-client.mjs');
const { createRpcClient } = await import('../src/engine/rpc-client.mjs');
const { createDas } = await import('../src/engine/helius-das.mjs');

// the dispatch reads PROVIDER_BACKEND at the moment the function/factory runs, so wrap that call
function withProvider(val, fn) {
  const prev = process.env.PROVIDER_BACKEND;
  if (val === undefined) delete process.env.PROVIDER_BACKEND; else process.env.PROVIDER_BACKEND = val;
  try { return fn(); } finally { if (prev === undefined) delete process.env.PROVIDER_BACKEND; else process.env.PROVIDER_BACKEND = prev; }
}

// ---------- jito-tip selectTipLamports (pure) ----------
test('PROVIDER_BACKEND jito selectTipLamports: legacy === package; default + unknown = package', () => {
  const cases = [
    { floor: null, percentile: 50, fixedLamports: 10000, maxLamports: null },
    { floor: { landed_tips_50th_percentile: 0.00002 }, percentile: 50, fixedLamports: 10000, maxLamports: 1_000_000 },
    { floor: { landed_tips_95th_percentile: 0.001 }, percentile: 95, fixedLamports: 5000, maxLamports: 50000 },
    { floor: { landed_tips_50th_percentile: 0 }, percentile: 50, fixedLamports: 7777, maxLamports: null },
  ];
  for (const c of cases) {
    const legacy = withProvider('legacy', () => selectTipLamports(c));
    const pkg = withProvider('package', () => selectTipLamports(c));
    assert.equal(legacy, pkg, `parity for ${JSON.stringify(c)}`);
    assert.equal(withProvider(undefined, () => selectTipLamports(c)), pkg, 'default = package');
    assert.equal(withProvider('garbage', () => selectTipLamports(c)), pkg, 'unknown = package');
  }
});

// ---------- jito-tip buildTipTransferTx (pure; valid 32-byte base58 inputs) ----------
test('PROVIDER_BACKEND jito buildTipTransferTx: legacy base64 === package base64', () => {
  const K = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // a real 32-byte base58 pubkey (decodes to 32 bytes)
  const args = { owner: K, tipAccount: K, lamports: 10000, recentBlockhash: K };
  const legacy = withProvider('legacy', () => buildTipTransferTx(args));
  const pkg = withProvider('package', () => buildTipTransferTx(args));
  assert.equal(typeof pkg, 'string');
  assert.equal(legacy, pkg, 'legacy tip tx is byte-identical to package');
  assert.equal(withProvider(undefined, () => buildTipTransferTx(args)), pkg, 'default = package');
});

// ---------- provider-health (in-process; constant injected clock => deterministic snapshot) ----------
test('PROVIDER_BACKEND provider-health: legacy snapshot === package snapshot for the same recorded sequence', () => {
  const mk = (val) => withProvider(val, () => createProviderHealth({ window: 50, now: () => 1000 }));
  const seq = [['rpc', true, 10, null], ['rpc', false, 40, 'rpc_http_429'], ['jupiter', true, 25, null], ['jupiter', true, 30, null]];
  const snap = (m) => { for (const o of seq) m.record(...o); return m.snapshot(); };
  const legacy = snap(mk('legacy'));
  const pkg = snap(mk('package'));
  assert.deepEqual(legacy, pkg, 'health snapshots identical');
  assert.deepEqual(snap(mk(undefined)), pkg, 'default = package');
  assert.deepEqual(snap(mk('garbage')), pkg, 'unknown = package');
});

// ---------- jupiter quote/usdValueOf (shared global-fetch mock: both paths hit globalThis.fetch) ----------
function withFetch(impl, fn) {
  const prev = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve(fn()).finally(() => { globalThis.fetch = prev; });
}
const jupiterClient = (val) => withProvider(val, () => createJupiterClient({ getApiKey: () => null, health: null }));

test('PROVIDER_BACKEND jupiter quote: legacy === package on a priced route', async () => {
  const json = { outAmount: '1000000', inAmount: '1000', priceImpactPct: '0.01', routePlan: [{}, {}] };
  const mock = async () => ({ ok: true, status: 200, json: async () => json });
  await withFetch(mock, async () => {
    const legacy = await jupiterClient('legacy').quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 });
    const pkg = await jupiterClient('package').quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 });
    assert.deepEqual(legacy, pkg);
    assert.equal(pkg.ok, true);
    assert.equal(pkg.outAmount, 1000000);
    assert.deepEqual(await jupiterClient(undefined).quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 }), pkg, 'default = package');
  });
});

test('PROVIDER_BACKEND jupiter quote: legacy === package on no-route and HTTP error', async () => {
  await withFetch(async () => ({ ok: true, status: 200, json: async () => ({ outAmount: '0' }) }), async () => {
    assert.deepEqual(await jupiterClient('legacy').quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1 }),
      await jupiterClient('package').quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1 }));
  });
  await withFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }), async () => {
    const pkg = await jupiterClient('package').quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1 });
    assert.deepEqual(await jupiterClient('legacy').quote({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1 }), pkg);
    assert.equal(pkg.error, 'quote_http_503');
  });
});

test('PROVIDER_BACKEND jupiter usdValueOf: legacy === package', async () => {
  const json = { outAmount: '12500000', inAmount: '100000000', priceImpactPct: '0.003', routePlan: [{}] };
  await withFetch(async () => ({ ok: true, status: 200, json: async () => json }), async () => {
    const args = { mint: 'M', qtyUi: 100, decimals: 6 };
    const legacy = await jupiterClient('legacy').usdValueOf(args);
    const pkg = await jupiterClient('package').usdValueOf(args);
    assert.deepEqual(legacy, pkg);
    assert.equal(pkg.ok, true);
  });
});

// ---------- rpc.rpc() (shared global-fetch mock: both paths POST JSON-RPC over globalThis.fetch) ----------
const rpcClient = (val) => withProvider(val, () => createRpcClient({ getRpcUrl: () => 'http://rpc.test', getGrpcEndpoint: () => null, health: null }));

test('PROVIDER_BACKEND rpc.rpc: legacy === package on result, JSON-RPC error, and HTTP error', async () => {
  await withFetch(async () => ({ ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result: 12345 }) }), async () => {
    const legacy = await rpcClient('legacy').rpc('getSlot', [{ commitment: 'confirmed' }]);
    const pkg = await rpcClient('package').rpc('getSlot', [{ commitment: 'confirmed' }]);
    assert.deepEqual(legacy, pkg);
    assert.deepEqual(pkg, { ok: true, result: 12345 });
    assert.deepEqual(await rpcClient(undefined).rpc('getSlot', [{ commitment: 'confirmed' }]), pkg, 'default = package');
  });
  await withFetch(async () => ({ ok: true, status: 200, json: async () => ({ error: { code: -32601, message: 'Method not found' } }) }), async () => {
    assert.deepEqual(await rpcClient('legacy').rpc('bogus', []), await rpcClient('package').rpc('bogus', []));
  });
  await withFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }), async () => {
    const pkg = await rpcClient('package').rpc('getSlot', []);
    assert.deepEqual(await rpcClient('legacy').rpc('getSlot', []), pkg);
    assert.equal(pkg.error, 'rpc_http_500');
  });
});

// ---------- helius-das getAssetMeta (injected stub rpc client; no network) ----------
const dasClient = (val, rpc) => withProvider(val, () => createDas({ rpc }));

test('PROVIDER_BACKEND helius getAssetMeta: legacy === package for hit, miss, and bad rpc', async () => {
  const hitRpc = { rpc: async () => ({ ok: true, result: { content: { metadata: { symbol: 'WIF', name: 'dogwifhat' }, links: { image: 'http://img/wif.png' } } } }) };
  const legacy = await dasClient('legacy', hitRpc).getAssetMeta('Mint1');
  const pkg = await dasClient('package', hitRpc).getAssetMeta('Mint1');
  assert.deepEqual(legacy, pkg);
  assert.deepEqual(pkg, { symbol: 'WIF', name: 'dogwifhat', icon: 'http://img/wif.png' });
  assert.deepEqual(await dasClient(undefined, hitRpc).getAssetMeta('Mint1'), pkg, 'default = package');

  const missRpc = { rpc: async () => ({ ok: false, error: 'rpc_-32601' }) };
  assert.equal(await dasClient('legacy', missRpc).getAssetMeta('Mint1'), null);
  assert.equal(await dasClient('package', missRpc).getAssetMeta('Mint1'), null);
  // no rpc / no mint -> null on both
  assert.equal(await dasClient('legacy', null).getAssetMeta('Mint1'), null);
  assert.equal(await dasClient('package', null).getAssetMeta('Mint1'), null);
});
