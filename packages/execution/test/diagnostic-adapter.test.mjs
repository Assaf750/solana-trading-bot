// @soltrade/execution — DiagnosticExecutionAdapter tests (ADR-0001 Phase 5A).
// Providers are STUBBED (no fetch/RPC). Asserts the diagnostic checks + the hard invariants:
// the adapter never opens a position, never claims an intent, never broadcasts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticExecutionAdapter } from '../src/index.mjs';
import { isEntity } from '../../contracts/src/live-model.mjs';

const NOW = () => 'T';
const GEN = () => 'diag_1';

function stubRpc({ conn, sim } = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (method, params) => {
      calls.push({ method, params });
      if (method === 'simulateTransaction') return sim ?? { ok: true, result: { value: { err: null, logs: ['ok'] } } };
      return { ok: true, result: null };
    },
    testConnection: async () => conn ?? { ok: true, provider: 'helius', solana_core: '1.18', current_slot: 123, latency_ms: 42, enhanced_stream: true },
  };
}
function stubJupiter({ quote, usd } = {}) {
  const calls = [];
  return {
    calls,
    quote: async (a) => { calls.push({ fn: 'quote', a }); return quote ?? { ok: true, outAmount: 1_000_000, priceImpactPct: 0.5, raw: {} }; },
    usdValueOf: async (a) => { calls.push({ fn: 'usdValueOf', a }); return usd ?? { ok: true, usd: 12.5, priceImpactPct: 0.3 }; },
  };
}
const stubJito = () => ({ getTipFloor: async () => ({ landed_tips_50th_percentile: 0.00001 }) });
const stubHealth = (states = { rpc: 'healthy', jupiter: 'healthy' }) => ({
  snapshot: () => Object.fromEntries(Object.entries(states).map(([k, v]) => [k, { status: v, calls: 5, error_pct: 0 }])),
});

function adapter(over = {}) {
  const pick = (k, def) => (k in over ? over[k] : def); // honor explicit null (e.g. jito: null)
  return createDiagnosticExecutionAdapter({
    rpc: pick('rpc', stubRpc()),
    jupiter: pick('jupiter', stubJupiter()),
    jito: pick('jito', stubJito()),
    providerHealth: pick('providerHealth', stubHealth()),
    now: NOW,
    genId: GEN,
    ...over.extra,
  });
}

// ---------- connectivity ----------
test('connectivity ok -> ConnectivityCheck entity, status pass', async () => {
  const c = await adapter().runConnectivityCheck();
  assert.equal(c.ok, true);
  assert.equal(c.status, 'pass');
  assert.equal(c.provider, 'helius');
  assert.equal(c.latency_ms, 42);
  assert.ok(isEntity('ConnectivityCheck', c), 'valid ConnectivityCheck');
});

test('connectivity fail -> status fail, error surfaced, still a valid entity', async () => {
  const rpc = stubRpc({ conn: { ok: false, error: 'rpc_url_unavailable', latency_ms: 5 } });
  const c = await adapter({ rpc }).runConnectivityCheck();
  assert.equal(c.ok, false);
  assert.equal(c.status, 'fail');
  assert.equal(c.detail.error, 'rpc_url_unavailable');
  assert.ok(isEntity('ConnectivityCheck', c));
});

// ---------- quote ----------
test('quote ok -> pass with out_amount; quote fail -> fail with error', async () => {
  const ok = await adapter().runQuoteCheck({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 });
  assert.equal(ok.status, 'pass');
  assert.equal(ok.out_amount, 1_000_000);
  const jupiter = stubJupiter({ quote: { ok: false, error: 'quote_no_route' } });
  const bad = await adapter({ jupiter }).runQuoteCheck({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 });
  assert.equal(bad.status, 'fail');
  assert.equal(bad.error, 'quote_no_route');
});

// ---------- route ----------
test('route available -> pass; route unavailable (zero out) -> fail route_unavailable', async () => {
  const ok = await adapter().runRouteAvailabilityCheck({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 });
  assert.equal(ok.available, true);
  assert.equal(ok.status, 'pass');
  const jupiter = stubJupiter({ quote: { ok: true, outAmount: 0 } });
  const no = await adapter({ jupiter }).runRouteAvailabilityCheck({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 });
  assert.equal(no.available, false);
  assert.equal(no.status, 'fail');
  assert.equal(no.error, 'route_unavailable');
});

// ---------- simulation ----------
test('simulation ok -> SimulationResult simulated_ok true; sigVerify:false (dry-run, never a broadcast)', async () => {
  const rpc = stubRpc();
  const s = await adapter({ rpc }).runSimulationCheck({ txBase64: 'AA==', token_mint: 'M', side: 'buy' });
  assert.equal(s.simulated_ok, true);
  assert.equal(s.status, 'pass');
  assert.ok(isEntity('SimulationResult', s));
  const simCall = rpc.calls.find((c) => c.method === 'simulateTransaction');
  assert.equal(simCall.params[1].sigVerify, false, 'simulation must not verify signatures (no broadcast)');
});

test('simulation on-chain error -> simulated_ok false, status fail', async () => {
  const rpc = stubRpc({ sim: { ok: true, result: { value: { err: 'InsufficientFunds', logs: [] } } } });
  const s = await adapter({ rpc }).runSimulationCheck({ txBase64: 'AA==', token_mint: 'M', side: 'sell' });
  assert.equal(s.simulated_ok, false);
  assert.equal(s.status, 'fail');
  assert.equal(s.error, 'sim_tx_error');
});

test('simulation without a tx -> warn (nothing to simulate), not a hard fail', async () => {
  const s = await adapter().runSimulationCheck({ token_mint: 'M', side: 'buy' });
  assert.equal(s.status, 'warn');
  assert.equal(s.error, 'no_tx_provided');
});

// ---------- priority fee ----------
test('priority-fee estimate uses the live tip floor; falls back to fixed without jito', async () => {
  const withFloor = await adapter().runPriorityFeeEstimate({ percentile: 50, fixedLamports: 10000, maxLamports: 1_000_000 });
  assert.equal(withFloor.ok, true);
  assert.equal(withFloor.source, 'tip_floor');
  assert.ok(withFloor.tip_lamports >= 10000);
  const noJito = await adapter({ jito: null }).runPriorityFeeEstimate({ fixedLamports: 7777 });
  assert.equal(noJito.source, 'fixed');
  assert.equal(noJito.tip_lamports, 7777);
});

// ---------- sellability ----------
test('sellability ok -> pass with usd; no route -> warn not_sellable', async () => {
  const ok = await adapter().runTokenSellabilityCheck({ mint: 'M', qtyUi: 100, decimals: 6 });
  assert.equal(ok.sellable, true);
  assert.equal(ok.usd, 12.5);
  const jupiter = stubJupiter({ usd: { ok: false, error: 'quote_no_route' } });
  const no = await adapter({ jupiter }).runTokenSellabilityCheck({ mint: 'M', qtyUi: 100, decimals: 6 });
  assert.equal(no.sellable, false);
  assert.equal(no.status, 'warn');
  assert.equal(no.error, 'quote_no_route');
});

// ---------- provider health ----------
test('provider health: ok -> pass; degraded -> warn; down -> fail', async () => {
  assert.equal((await adapter().runProviderHealthCheck()).status, 'pass');
  const deg = await adapter({ providerHealth: stubHealth({ rpc: 'degraded', jupiter: 'healthy' }) }).runProviderHealthCheck();
  assert.equal(deg.status, 'warn');
  assert.equal(deg.degraded, true);
  const down = await adapter({ providerHealth: stubHealth({ rpc: 'down' }) }).runProviderHealthCheck();
  assert.equal(down.status, 'fail');
  assert.equal(down.ok, false);
});

// ---------- readiness rollup ----------
test('readiness: all good -> valid; degraded -> warning; connectivity fail -> invalid + blocker', async () => {
  assert.equal((await adapter().runLiveReadinessDiagnostic()).readiness, 'valid');
  const warn = await adapter({ providerHealth: stubHealth({ rpc: 'degraded' }) }).runLiveReadinessDiagnostic();
  assert.equal(warn.readiness, 'warning');
  const rpc = stubRpc({ conn: { ok: false, error: 'rpc_url_unavailable' } });
  const bad = await adapter({ rpc }).runLiveReadinessDiagnostic();
  assert.equal(bad.readiness, 'invalid');
  assert.ok(bad.blockers.includes('connectivity'));
});

// ---------- DiagnosticRun ----------
test('runDiagnosticExecutionTest -> valid DiagnosticRun (preflight) with all checks', async () => {
  const run = await adapter().runDiagnosticExecutionTest({
    quote: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 },
    route: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 },
    sellability: { mint: 'M', qtyUi: 100, decimals: 6 },
    simulation: { txBase64: 'AA==', token_mint: 'M', side: 'buy' },
  });
  assert.ok(isEntity('DiagnosticRun', run), 'valid DiagnosticRun');
  assert.equal(run.kind, 'preflight');
  assert.equal(run.readiness, 'valid');
  assert.deepEqual(run.checks.map((c) => c.name), ['connectivity', 'provider_health', 'priority_fee', 'quote', 'route', 'sellability', 'simulation']);
});

// ---------- HARD INVARIANTS: never trades ----------
test('diagnostic never opens a position / claims an intent / broadcasts (spies stay untouched)', async () => {
  let positionCalls = 0; let ledgerCalls = 0; let broadcastCalls = 0; let signCalls = 0;
  const rpc = stubRpc();
  const a = createDiagnosticExecutionAdapter({
    rpc,
    jupiter: stubJupiter(),
    jito: stubJito(),
    providerHealth: stubHealth(),
    now: NOW,
    genId: GEN,
    // extra mechanisms the adapter must IGNORE — proves it cannot trade even if handed the means:
    positions: { recordEntry: () => { positionCalls += 1; }, recordExit: () => { positionCalls += 1; } },
    decisionLedger: { claimIntent: () => { ledgerCalls += 1; }, createExecutionIntent: () => { ledgerCalls += 1; } },
    broadcast: () => { broadcastCalls += 1; },
    signer: { sign: () => { signCalls += 1; } },
  });
  await a.runDiagnosticExecutionTest({
    quote: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 },
    sellability: { mint: 'M', qtyUi: 100, decimals: 6 },
    simulation: { txBase64: 'AA==', token_mint: 'M', side: 'buy' },
  });
  assert.equal(positionCalls, 0, 'no position writes');
  assert.equal(ledgerCalls, 0, 'no intent claims');
  assert.equal(broadcastCalls, 0, 'no broadcasts');
  assert.equal(signCalls, 0, 'no signing');
  assert.ok(rpc.calls.every((c) => c.method === 'simulateTransaction'), 'only read-only/simulate RPC calls');
  // the returned surface exposes ONLY run* diagnostics — no trade/execute method
  assert.deepEqual(Object.keys(a).filter((k) => !k.startsWith('run')), []);
});

// ---------- fail-closed inputs ----------
test('invalid input fails closed without touching providers', async () => {
  const jupiter = stubJupiter();
  const rpc = stubRpc();
  const a = adapter({ jupiter, rpc });
  assert.equal((await a.runQuoteCheck({})).error, 'invalid_input');
  assert.equal((await a.runRouteAvailabilityCheck({ inputMint: 'A' })).error, 'invalid_input');
  assert.equal((await a.runTokenSellabilityCheck({ mint: 'M', qtyUi: 0, decimals: 6 })).error, 'invalid_input');
  assert.equal((await a.runSimulationCheck({})).error, 'invalid_input');
  assert.equal((await a.runSimulationCheck({ txBase64: 'AA==', token_mint: 'M', side: 'short' })).error, 'invalid_input');
  assert.equal(jupiter.calls.length, 0, 'no provider calls on invalid input');
  assert.ok(!rpc.calls.some((c) => c.method === 'simulateTransaction'), 'no simulate on invalid input');
});

// ---------- missing deps fail clearly ----------
test('missing required provider fails clearly', async () => {
  const a = createDiagnosticExecutionAdapter({ now: NOW, genId: GEN });
  await assert.rejects(() => a.runConnectivityCheck(), /diagnostic_adapter_requires_rpc/);
  await assert.rejects(() => a.runQuoteCheck({ inputMint: 'A', outputMint: 'B', amountBaseUnits: 1 }), /diagnostic_adapter_requires_jupiter/);
});

// ---------- determinism ----------
test('same provider stubs + injected clock/id => byte-stable DiagnosticRun', async () => {
  const opts = { quote: { inputMint: 'A', outputMint: 'B', amountBaseUnits: 1000 }, sellability: { mint: 'M', qtyUi: 100, decimals: 6 } };
  const r1 = await adapter().runDiagnosticExecutionTest(opts);
  const r2 = await adapter().runDiagnosticExecutionTest(opts);
  assert.deepEqual(r1, r2);
});
