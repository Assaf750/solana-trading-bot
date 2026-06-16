import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createJupiterProvider, createRpcProvider, createJitoProvider, createHeliusProvider,
  createProviderHealthMonitor, selectTipLamports, makeTipTransferBuilder,
  normalizeProviderError, normalizeQuoteResult, normalizeRouteResult,
  normalizeBroadcastResult, normalizeSimulationResult,
  isHeliusHost, buildWalletSubscriptions, parseStreamNotification,
} from '../src/index.mjs';

// the package takes an injected fetch-compatible transport (mechanism-guard pure); tests inject one.
function mkReq(handler) {
  const calls = [];
  return { request: async (url, opts) => { calls.push({ url, opts }); return handler(url, opts); }, calls };
}
const jsonRes = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => body });

// ---------- Jupiter ----------
test('jupiter quote success: parses outAmount/inAmount/priceImpact + exact request payload', async () => {
  const r0 = mkReq(() => jsonRes({ outAmount: '100', inAmount: '50', priceImpactPct: 0.01, routePlan: [{}, {}] }));
  const jup = createJupiterProvider({ getApiKey: () => null, request: r0.request });
  const r = await jup.quote({ inputMint: 'IN', outputMint: 'OUT', amountBaseUnits: 1234.7, slippageBps: 100 });
  assert.equal(r.ok, true);
  assert.equal(r.outAmount, 100);
  assert.equal(r.inAmount, 50);
  assert.equal(r.priceImpactPct, 1);
  assert.equal(r.routePlan, 2);
  assert.match(r0.calls[0].url, /lite-api\.jup\.ag\/swap\/v1\/quote\?inputMint=IN&outputMint=OUT&amount=1234&slippageBps=100&swapMode=ExactIn/);
});

test('jupiter quote failure (http) and route unavailable (no positive outAmount)', async () => {
  const a = createJupiterProvider({ request: mkReq(() => jsonRes({}, { ok: false, status: 500 })).request });
  assert.equal((await a.quote({ inputMint: 'a', outputMint: 'b', amountBaseUnits: 10 })).error, 'quote_http_500');
  const b = createJupiterProvider({ request: mkReq(() => jsonRes({ outAmount: '0' })).request });
  assert.equal((await b.quote({ inputMint: 'a', outputMint: 'b', amountBaseUnits: 10 })).error, 'quote_no_route');
});

test('jupiter uses the pro endpoint + x-api-key when a key is configured', async () => {
  const r0 = mkReq(() => jsonRes({ outAmount: '1' }));
  await createJupiterProvider({ getApiKey: () => 'KEY', request: r0.request }).quote({ inputMint: 'a', outputMint: 'b', amountBaseUnits: 10 });
  assert.match(r0.calls[0].url, /^https:\/\/api\.jup\.ag\/swap\/v1\/quote/);
  assert.equal(r0.calls[0].opts.headers['x-api-key'], 'KEY');
});

// ---------- RPC ----------
test('rpc: getBalance/getLatestBlockhash success + exact JSON-RPC body; records health', async () => {
  const health = createProviderHealthMonitor();
  const r0 = mkReq((_u, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === 'getBalance') return jsonRes({ result: { value: 42 } });
    return jsonRes({ result: { value: { blockhash: 'BH' } } });
  });
  const rpc = createRpcProvider({ getRpcUrl: () => 'http://rpc.example', health, request: r0.request });
  const bal = await rpc.rpc('getBalance', ['owner', { commitment: 'confirmed' }]);
  assert.deepEqual(bal, { ok: true, result: { value: 42 } });
  assert.equal(JSON.parse(r0.calls[0].opts.body).method, 'getBalance');
  assert.deepEqual(JSON.parse(r0.calls[0].opts.body).params, ['owner', { commitment: 'confirmed' }]);
  const bh = await rpc.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  assert.equal(bh.result.value.blockhash, 'BH');
  assert.equal(health.snapshot().rpc.status, 'healthy');
});

test('rpc: no url => rpc_url_unavailable (not recorded); http + json error mapping', async () => {
  const noUrl = await createRpcProvider({ getRpcUrl: () => null, request: mkReq(() => jsonRes({})).request }).rpc('getSlot', []);
  assert.deepEqual(noUrl, { ok: false, error: 'rpc_url_unavailable' });
  const httpErr = createRpcProvider({ getRpcUrl: () => 'http://x', request: mkReq(() => jsonRes({}, { ok: false, status: 503 })).request });
  assert.equal((await httpErr.rpc('getSlot', [])).error, 'rpc_http_503');
  const jsonErr = createRpcProvider({ getRpcUrl: () => 'http://x', request: mkReq(() => jsonRes({ error: { code: -32002, message: 'blockhash not found' } })).request });
  const r = await jsonErr.rpc('sendTransaction', ['tx']);
  assert.equal(r.error, 'rpc_-32002');
  assert.equal(r.message, 'blockhash not found');
});

test('rpc: simulate result normalization (ok vs on-chain err)', async () => {
  const okSim = createRpcProvider({ getRpcUrl: () => 'http://x', request: mkReq(() => jsonRes({ result: { value: { err: null, logs: ['ok'] } } })).request });
  assert.equal(normalizeSimulationResult(await okSim.rpc('simulateTransaction', ['tx'])).simulated_ok, true);
  const errSim = createRpcProvider({ getRpcUrl: () => 'http://x', request: mkReq(() => jsonRes({ result: { value: { err: { InstructionError: [] } } } })).request });
  const r = normalizeSimulationResult(await errSim.rpc('simulateTransaction', ['tx']));
  assert.equal(r.simulated_ok, false);
  assert.equal(r.error, 'sim_tx_error');
});

test('rpc: a pre-built body ({ body }) is POSTed verbatim (Phase Rust-4 — Rust-assembled request body, JS POST)', async () => {
  const r0 = mkReq(() => jsonRes({ result: 'SIG' }));
  const rpc = createRpcProvider({ getRpcUrl: () => 'http://x', request: r0.request });
  const body = { jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: ['RUSTTX', { encoding: 'base64', skipPreflight: false, maxRetries: 3 }] };
  const r = await rpc.rpc('sendTransaction', ['IGNORED_PARAMS'], { body });
  assert.deepEqual(r, { ok: true, result: 'SIG' }, 'POST + error-mapping still done by JS');
  assert.deepEqual(JSON.parse(r0.calls[0].opts.body), body, 'the EXACT pre-built (Rust) body was POSTed, not the JS-assembled params');
});

test('rpc: subscribeWallets picks injected gRPC factory when endpoint configured', () => {
  const calls = [];
  const rpc = createRpcProvider({
    getRpcUrl: () => null,
    getGrpcEndpoint: () => ({ endpoint: 'grpc:443', token: 't' }),
    grpcIngestorFactory: (a) => { calls.push(a); return { close() { calls.push('closed'); } }; },
    request: () => {}, wsFactory: () => ({}),
  });
  const sub = rpc.subscribeWallets({ addresses: ['L1'], onLeaderActivity: () => {}, onUp: () => {}, onGap: () => {} });
  assert.equal(calls[0].endpoint, 'grpc:443');
  sub.close();
  assert.equal(calls[1], 'closed');
});

// ---------- Jito ----------
test('jito sendBundle: exact payload + url; error strings parity', async () => {
  const r0 = mkReq(() => jsonRes({ result: 'bundle123' }));
  const jito = createJitoProvider({ getBundleUrl: () => ({ ok: true, url: 'https://jito.example/' }), request: r0.request });
  const r = await jito.sendBundle(['txA', 'txB']);
  assert.deepEqual(r, { ok: true, result: 'bundle123' });
  assert.equal(r0.calls[0].url, 'https://jito.example/api/v1/bundles');
  const body = JSON.parse(r0.calls[0].opts.body);
  assert.equal(body.method, 'sendBundle');
  assert.deepEqual(body.params, [['txA', 'txB'], { encoding: 'base64' }]);
  assert.equal((await createJitoProvider({ getBundleUrl: () => ({ ok: false, error: 'jito_url_unset' }), request: r0.request }).sendBundle([])).error, 'jito_url_unset');
  const httpErr = createJitoProvider({ getBundleUrl: () => ({ ok: true, url: 'https://j' }), request: mkReq(() => jsonRes({}, { ok: false, status: 429 })).request });
  assert.equal((await httpErr.sendBundle([])).error, 'jito_http_429');
});

test('jito sendBundle: a pre-built body ({ body }) is POSTed verbatim (Phase Rust-4 — Rust-assembled bundle body, JS POST)', async () => {
  const r0 = mkReq(() => jsonRes({ result: 'bundleX' }));
  const jito = createJitoProvider({ getBundleUrl: () => ({ ok: true, url: 'https://j/' }), request: r0.request });
  const body = { jsonrpc: '2.0', id: 1, method: 'sendBundle', params: [['t1', 't2'], { encoding: 'base64' }] };
  const r = await jito.sendBundle(['IGNORED'], { body });
  assert.deepEqual(r, { ok: true, result: 'bundleX' });
  assert.deepEqual(JSON.parse(r0.calls[0].opts.body), body, 'the EXACT pre-built (Rust) bundle body was POSTed');
});

test('jito selectTipLamports parity (dynamic, fixed-floor, cap, bucket snap, fallback)', () => {
  assert.equal(selectTipLamports({ floor: { landed_tips_75th_percentile: 0.00005 }, percentile: 75, fixedLamports: 10000, maxLamports: 1000000 }), 50000);
  assert.equal(selectTipLamports({ floor: { landed_tips_50th_percentile: 0.000001 }, fixedLamports: 10000 }), 10000);
  assert.equal(selectTipLamports({ floor: { landed_tips_50th_percentile: 1 }, fixedLamports: 10000, maxLamports: 20000 }), 20000);
  assert.equal(selectTipLamports({ floor: { landed_tips_95th_percentile: 0.00003 }, percentile: 90, fixedLamports: 1, maxLamports: 1e9 }), 30000);
  assert.equal(selectTipLamports({ floor: null, fixedLamports: 7000 }), 7000);
});

test('jito buildTipTransferTx: builds a base64 tx with injected b58decode; bad inputs throw', () => {
  const build = makeTipTransferBuilder(() => Buffer.alloc(32, 1));
  const tx = build({ owner: 'o', tipAccount: 't', lamports: 10000, recentBlockhash: 'bh' });
  assert.equal(typeof tx, 'string');
  assert.ok(Buffer.from(tx, 'base64').length > 64);
  assert.throws(() => build({ owner: 'o', tipAccount: 't', lamports: 0, recentBlockhash: 'bh' }), /tip_tx_bad_lamports/);
  assert.throws(() => makeTipTransferBuilder(() => Buffer.alloc(31))({ owner: 'o', tipAccount: 't', lamports: 1, recentBlockhash: 'b' }), /tip_tx_bad_key_length/);
});

// ---------- Helius ----------
test('helius getAssetMeta: maps content -> {symbol,name,icon}; null on error/empty', async () => {
  const okRpc = { rpc: async () => ({ ok: true, result: { content: { metadata: { symbol: 'AAA', name: 'Aaa' }, links: { image: 'i' } } } }) };
  assert.deepEqual(await createHeliusProvider({ rpc: okRpc }).getAssetMeta('mint'), { symbol: 'AAA', name: 'Aaa', icon: 'i' });
  assert.equal(await createHeliusProvider({ rpc: { rpc: async () => ({ ok: false }) } }).getAssetMeta('mint'), null);
  assert.equal(await createHeliusProvider({ rpc: { rpc: async () => ({ ok: true, result: { content: { metadata: {} } } }) } }).getAssetMeta('mint'), null);
});

// ---------- provider health ----------
test('provider health: unknown -> healthy -> down thresholds', () => {
  const h = createProviderHealthMonitor();
  assert.equal(h.snapshot().jupiter, undefined);
  for (let i = 0; i < 10; i += 1) h.record('jupiter', true, 5);
  assert.equal(h.snapshot().jupiter.status, 'healthy');
  for (let i = 0; i < 10; i += 1) h.record('rpc', i < 5, 5, 'rpc_err');
  assert.equal(h.snapshot().rpc.status, 'down');
});

// ---------- normalizers ----------
test('normalizers: error/quote/route/broadcast shapes', () => {
  assert.deepEqual(normalizeProviderError('jupiter', 'quote_http_500'), { ok: false, provider: 'jupiter', error: 'quote_http_500' });
  assert.equal(normalizeQuoteResult({ ok: true, outAmount: '7' }).outAmount, 7);
  assert.equal(normalizeRouteResult({ ok: true, outAmount: 5 }).available, true);
  assert.equal(normalizeRouteResult({ ok: false, error: 'quote_no_route' }).available, false);
  assert.deepEqual(normalizeBroadcastResult({ ok: true, result: 'SIG', via: 'jito' }), { ok: true, signature: 'SIG', via: 'jito' });
  assert.equal(normalizeBroadcastResult({ ok: false, error: 'x' }).ok, false);
});

// ---------- RPC stream pure helpers (relocated from apps/server in Phase Clean-1; these are the LIVE
// copies the runtime uses — the duplicate apps/server/engine/rpc-client.mjs copies were removed) ----------
test('rpc: Helius host detected; generic host not', () => {
  assert.equal(isHeliusHost('https://mainnet.helius-rpc.com/?api-key=x'), true);
  assert.equal(isHeliusHost('https://api.mainnet-beta.solana.com'), false);
  assert.equal(isHeliusHost('not a url'), false);
});

test('rpc: default subscription is per-wallet logsSubscribe (reliable on every plan); transactionSubscribe is opt-in', () => {
  const addrs = ['Aaa', 'Bbb', 'Ccc'];
  const def = buildWalletSubscriptions({ addresses: addrs });
  assert.equal(def.length, 3);
  assert.ok(def.every((s) => s.method === 'logsSubscribe'));
  assert.deepEqual(def[0].params[0].mentions, ['Aaa']);
  const enhanced = buildWalletSubscriptions({ addresses: addrs, enhanced: true });
  assert.equal(enhanced.length, 1);
  assert.equal(enhanced[0].method, 'transactionSubscribe');
  assert.deepEqual(enhanced[0].params[0].accountInclude, addrs);
});

test('rpc: parseStreamNotification extracts inline tx (Helius) + signature-only (logs); drops failed/garbage', () => {
  const heliusMsg = { method: 'transactionNotification', params: { result: { value: { signature: 'SIG1', transaction: { transaction: { message: {} }, meta: { err: null } } } } } };
  const p1 = parseStreamNotification(heliusMsg);
  assert.equal(p1.signature, 'SIG1');
  assert.ok(p1.tx, 'inline tx present for Helius');
  const failed = { method: 'transactionNotification', params: { result: { value: { signature: 'SIG2', transaction: { meta: { err: { x: 1 } } } } } } };
  assert.equal(parseStreamNotification(failed), null, 'failed tx dropped');
  const logsMsg = { method: 'logsNotification', params: { result: { value: { signature: 'SIG3', err: null } } } };
  const p3 = parseStreamNotification(logsMsg);
  assert.equal(p3.signature, 'SIG3');
  assert.equal(p3.tx, null, 'logs path has no inline tx');
  assert.equal(parseStreamNotification({ method: 'unknown' }), null);
});
