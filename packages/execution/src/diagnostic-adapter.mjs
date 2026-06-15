// @soltrade/execution — DiagnosticExecutionAdapter (ADR-0001 Phase 5A).
//
// A pre-flight / live-readiness diagnostic surface that exercises the trading mechanisms WITHOUT
// trading. It is the first step of turning Paper from a parallel "trading mode" into a diagnostic
// adapter: it asks "could a live trade work right now?" and never performs one.
//
// PURITY (mechanism-guard): this package imports NO fetch / WebSocket / RPC / SDK / db. Every
// mechanism is INJECTED — the provider instances (rpc, jupiter, jito, providerHealth) are built in
// apps/server (the mechanism host) and handed in. We only call their public methods + the PURE
// normalizers/tip-helpers re-exported by @soltrade/provider-adapters.
//
// HARD INVARIANTS (enforced structurally + by tests):
//   - never opens a position        (no positions book is injected; none is callable)
//   - never claims an execution intent (no decision-ledger is injected)
//   - never broadcasts a transaction  (no broadcast/send mechanism is injected; sim is sigVerify:false)
//   - never mutates a portfolio
// The adapter accepts ONLY read/probe providers, so the above are guaranteed by construction.
import {
  normalizeRouteResult,
  normalizeSimulationResult,
  selectTipLamports,
} from '../../provider-adapters/src/index.mjs';
import { TRADE_SIDE, assertEntity } from '../../contracts/src/live-model.mjs';

let _seq = 0;
const defaultGenId = (prefix = 'diag') => `${prefix}_${(_seq += 1)}`;
const defaultNow = () => new Date().toISOString();

function requireDep(label, fn) {
  if (typeof fn !== 'function') throw new Error(`diagnostic_adapter_requires_${label}`);
}

/** invalid → warning → valid; any failed check is a hard blocker. */
function aggregateReadiness(checks) {
  if (checks.some((c) => c && c.status === 'fail')) return 'invalid';
  if (checks.some((c) => c && c.status === 'warn')) return 'warning';
  return 'valid';
}

/**
 * Build a DiagnosticExecutionAdapter.
 * @param deps.rpc            provider-adapters RPC client (rpc(method,params), testConnection())
 * @param deps.jupiter        quote provider (quote(), usdValueOf())
 * @param deps.jito           OPTIONAL bundle provider (getTipFloor()) for priority-fee estimates
 * @param deps.providerHealth OPTIONAL health monitor (snapshot())
 * @param deps.now            OPTIONAL () => ISO string (injected clock; defaults to wall clock)
 * @param deps.genId          OPTIONAL (prefix) => id (defaults to an in-process sequence)
 */
export function createDiagnosticExecutionAdapter(deps = {}) {
  const { rpc, jupiter, jito = null, providerHealth = null, now = defaultNow, genId = defaultGenId } = deps;

  // --- 1) connectivity: can we reach the RPC and how fresh is it? -> ConnectivityCheck entity ---
  async function runConnectivityCheck({ provider = 'rpc' } = {}) {
    requireDep('rpc', rpc && rpc.testConnection);
    const r = await rpc.testConnection();
    const ok = !!(r && r.ok);
    const check = {
      provider: (r && r.provider) || provider,
      status: ok ? 'pass' : 'fail',
      ok,
      checked_at: now(),
      detail: ok
        ? { solana_core: r.solana_core ?? null, current_slot: r.current_slot ?? null, enhanced_stream: !!r.enhanced_stream }
        : { error: (r && r.error) || 'connectivity_failed' },
    };
    if (r && Number.isFinite(r.latency_ms)) check.latency_ms = r.latency_ms;
    assertEntity('ConnectivityCheck', check); // fail-closed: a malformed check throws, never silently passes
    return { name: 'connectivity', ...check };
  }

  // --- 2) quote: is the aggregator returning a priced quote for this pair? ---
  async function runQuoteCheck({ inputMint, outputMint, amountBaseUnits, slippageBps = 100 } = {}) {
    if (!inputMint || !outputMint || !(Number(amountBaseUnits) > 0)) {
      return { name: 'quote', ok: false, status: 'fail', error: 'invalid_input', checked_at: now() };
    }
    requireDep('jupiter', jupiter && jupiter.quote);
    const q = await jupiter.quote({ inputMint, outputMint, amountBaseUnits, slippageBps });
    const ok = !!(q && q.ok);
    return {
      name: 'quote',
      ok,
      status: ok ? 'pass' : 'fail',
      out_amount: ok ? Number(q.outAmount) || 0 : 0,
      price_impact_pct: ok ? Number(q.priceImpactPct) || 0 : null,
      error: ok ? null : ((q && q.error) || 'quote_failed'),
      checked_at: now(),
    };
  }

  // --- 3) route availability: is there a tradable route (strictly-positive out)? ---
  async function runRouteAvailabilityCheck({ inputMint, outputMint, amountBaseUnits, slippageBps = 100 } = {}) {
    if (!inputMint || !outputMint || !(Number(amountBaseUnits) > 0)) {
      return { name: 'route', ok: false, available: false, status: 'fail', error: 'invalid_input', checked_at: now() };
    }
    requireDep('jupiter', jupiter && jupiter.quote);
    const q = await jupiter.quote({ inputMint, outputMint, amountBaseUnits, slippageBps });
    const r = normalizeRouteResult(q);
    return { name: 'route', ok: r.available, available: r.available, status: r.available ? 'pass' : 'fail', error: r.error, checked_at: now() };
  }

  // --- 4) simulation: dry-run a (caller-supplied) tx on-chain. sigVerify:false -> never a broadcast.
  //        -> SimulationResult entity. No tx => warn (nothing to simulate), not a hard failure. ---
  async function runSimulationCheck({ txBase64, token_mint, side = 'buy' } = {}) {
    if (!token_mint || !TRADE_SIDE.includes(side)) {
      return { name: 'simulation', ok: false, status: 'fail', simulated_ok: false, error: 'invalid_input' };
    }
    if (!txBase64) {
      const noTx = { token_mint, side, simulated_ok: false, error: 'no_tx_provided', simulated_at: now() };
      return { name: 'simulation', ok: false, status: 'warn', ...noTx };
    }
    requireDep('rpc', rpc && rpc.rpc);
    const r = await rpc.rpc('simulateTransaction', [txBase64, { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true }]);
    const s = normalizeSimulationResult(r);
    const sim = { token_mint, side, simulated_ok: !!s.simulated_ok, simulated_at: now() };
    if (s.error) sim.error = s.error;
    assertEntity('SimulationResult', sim);
    return { name: 'simulation', ok: sim.simulated_ok, status: sim.simulated_ok ? 'pass' : 'fail', ...sim };
  }

  // --- 5) priority-fee / Jito tip estimate (pure tip selection over the live floor) ---
  async function runPriorityFeeEstimate({ percentile = 50, fixedLamports = 10000, maxLamports = null } = {}) {
    let floor = null;
    if (jito && typeof jito.getTipFloor === 'function') {
      try { floor = await jito.getTipFloor(); } catch { floor = null; }
    }
    const tip_lamports = selectTipLamports({ floor, percentile, fixedLamports, maxLamports });
    return { name: 'priority_fee', ok: true, status: 'pass', tip_lamports, source: floor ? 'tip_floor' : 'fixed', checked_at: now() };
  }

  // --- 6) token sellability: does a sell route back to USD exist for the held size? ---
  async function runTokenSellabilityCheck({ mint, qtyUi, decimals, slippageBps = 100 } = {}) {
    if (!mint || !(Number(qtyUi) > 0) || !Number.isInteger(decimals)) {
      return { name: 'sellability', ok: false, sellable: false, status: 'fail', error: 'invalid_input', checked_at: now() };
    }
    requireDep('jupiter', jupiter && jupiter.usdValueOf);
    const v = await jupiter.usdValueOf({ mint, qtyUi, decimals, slippageBps });
    const sellable = !!(v && v.ok);
    return {
      name: 'sellability',
      ok: sellable,
      sellable,
      status: sellable ? 'pass' : 'warn', // illiquid is a caution, not a connectivity failure
      usd: sellable ? (Number(v.usd) || null) : null,
      error: sellable ? null : ((v && v.error) || 'not_sellable'),
      checked_at: now(),
    };
  }

  // --- 7) provider health rollup (down => fail, degraded => warn) ---
  async function runProviderHealthCheck() {
    if (!providerHealth || typeof providerHealth.snapshot !== 'function') {
      return { name: 'provider_health', ok: true, status: 'warn', degraded: false, providers: {}, detail: 'no_monitor', checked_at: now() };
    }
    const providers = providerHealth.snapshot();
    const states = Object.values(providers).map((p) => p && p.status);
    const down = states.includes('down');
    const degraded = states.includes('degraded');
    return {
      name: 'provider_health',
      ok: !down,
      status: down ? 'fail' : degraded ? 'warn' : 'pass',
      degraded: down || degraded,
      providers,
      checked_at: now(),
    };
  }

  // --- 8) live-readiness rollup: connectivity + provider health (+ optional quote/route) ---
  async function runLiveReadinessDiagnostic(opts = {}) {
    const checks = [await runConnectivityCheck(), await runProviderHealthCheck()];
    if (opts.quote) checks.push(await runQuoteCheck(opts.quote));
    if (opts.route) checks.push(await runRouteAvailabilityCheck(opts.route));
    const readiness = aggregateReadiness(checks);
    return {
      name: 'readiness',
      readiness,
      ok: readiness !== 'invalid',
      blockers: checks.filter((c) => c && c.status === 'fail').map((c) => c.name),
      checks,
      checked_at: now(),
    };
  }

  // --- 9) full diagnostic execution test -> DiagnosticRun entity (the canonical pre-flight) ---
  async function runDiagnosticExecutionTest(opts = {}) {
    const checks = [
      await runConnectivityCheck(),
      await runProviderHealthCheck(),
      await runPriorityFeeEstimate(opts.priorityFee || {}),
    ];
    if (opts.quote) checks.push(await runQuoteCheck(opts.quote));
    if (opts.route) checks.push(await runRouteAvailabilityCheck(opts.route));
    if (opts.sellability) checks.push(await runTokenSellabilityCheck(opts.sellability));
    if (opts.simulation) checks.push(await runSimulationCheck(opts.simulation));
    const run = {
      run_id: genId('diag'),
      kind: 'preflight',
      readiness: aggregateReadiness(checks),
      checks,
      created_at: now(),
    };
    assertEntity('DiagnosticRun', run);
    return run;
  }

  return {
    runConnectivityCheck,
    runQuoteCheck,
    runRouteAvailabilityCheck,
    runSimulationCheck,
    runPriorityFeeEstimate,
    runTokenSellabilityCheck,
    runProviderHealthCheck,
    runLiveReadinessDiagnostic,
    runDiagnosticExecutionTest,
  };
}
