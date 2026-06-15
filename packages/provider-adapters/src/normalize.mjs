// @soltrade/provider-adapters — result/error normalizers (ADR-0001 Phase 2D). Pure, additive:
// they reshape provider outputs to canonical shapes; they do not change provider behaviour.

/** Canonical provider error envelope from a string/Error/{code,name}. */
export function normalizeProviderError(provider, error) {
  const code = typeof error === 'string'
    ? error
    : (error && (error.error || error.code || error.name)) || 'err';
  return { ok: false, provider: provider || null, error: String(code) };
}

/** Normalize a Jupiter-style quote result. */
export function normalizeQuoteResult(r) {
  if (!r || r.ok !== true) return { ok: false, error: (r && r.error) || 'quote_failed' };
  return {
    ok: true,
    inAmount: Number(r.inAmount) || 0,
    outAmount: Number(r.outAmount) || 0,
    priceImpactPct: Number(r.priceImpactPct) || 0,
    routePlan: r.routePlan ?? 0,
    raw: r.raw,
  };
}

/** A route is available iff the quote returned a finite, strictly-positive outAmount. */
export function normalizeRouteResult(r) {
  const out = r ? Number(r.outAmount) : NaN;
  const available = !!(r && r.ok === true && Number.isFinite(out) && out > 0);
  return { ok: available, available, error: available ? null : ((r && r.error) || 'route_unavailable') };
}

/** Normalize a broadcast result (RPC send or bundle submit). */
export function normalizeBroadcastResult(r) {
  if (r && r.ok === true) return { ok: true, signature: r.result ?? r.signature ?? null, via: r.via || 'rpc' };
  return { ok: false, error: (r && r.error) || 'broadcast_failed' };
}

/** Normalize a simulateTransaction result: simulated_ok is false on any on-chain sim error. */
export function normalizeSimulationResult(r) {
  if (!r || r.ok !== true) return { ok: false, simulated_ok: false, error: (r && r.error) || 'simulation_failed', logs: [] };
  const val = (r.result && r.result.value) ?? r.value ?? r.result ?? null;
  const simErr = val && val.err;
  return { ok: true, simulated_ok: !simErr, error: simErr ? 'sim_tx_error' : null, logs: (val && val.logs) || [] };
}
