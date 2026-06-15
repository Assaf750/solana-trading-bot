// @soltrade/positions — pure exit-decision helpers (ADR-0001 Phase 2B).
// Verbatim semantics of apps/server engine/exit-rules.mjs (parity), plus deriveExitPlan which
// composes them in the SAME priority the paper-engine markPass loop uses
// (trailing -> breakeven -> first-tier TP -> hard TP -> hard SL). Pure: no I/O.

/** Trailing stop: armed once peak >= trailingPct; exits when give-back from peak >= trailingPct. */
export function trailingStopHit({ pnlPct, peakPct, trailingPct }) {
  if (!Number.isFinite(trailingPct) || trailingPct <= 0) return false;
  if (!Number.isFinite(peakPct) || !Number.isFinite(pnlPct)) return false;
  if (peakPct < trailingPct) return false;
  const ddFromPeakPct = (1 - (1 + pnlPct / 100) / (1 + peakPct / 100)) * 100;
  return ddFromPeakPct >= trailingPct;
}

/** First-tier partial take-profit: fires once when P&L first reaches tp1Pct. */
export function firstTierHit({ pnlPct, tp1Pct, done }) {
  if (done) return false;
  if (!Number.isFinite(tp1Pct) || tp1Pct <= 0) return false;
  if (!Number.isFinite(pnlPct)) return false;
  return pnlPct >= tp1Pct;
}

/** Break-even stop after tp1: exits remainder if P&L falls back to <= 0. */
export function breakevenStopHit({ pnlPct, tp1Done, breakevenAfterTp1 }) {
  if (!tp1Done || breakevenAfterTp1 !== true) return false;
  if (!Number.isFinite(pnlPct)) return false;
  return pnlPct <= 0;
}

/**
 * Compose the exit decision in the paper-engine priority order. Returns
 * { shouldExit, fraction, reason }. fraction is 1 for full exits and tp1SellPct/100 for the first
 * tier. reason matches the legacy event reasons. tp/sl are P&L percentages (sl as a positive number).
 */
export function deriveExitPlan({
  pnlPct, peakPct, trailingPct, tp1Pct, tp1Done, tp1SellPct,
  breakevenAfterTp1, tpPct, slPct,
} = {}) {
  if (trailingStopHit({ pnlPct, peakPct, trailingPct })) {
    return { shouldExit: true, fraction: 1, reason: 'trailing_stop_hit' };
  }
  if (breakevenStopHit({ pnlPct, tp1Done, breakevenAfterTp1 })) {
    return { shouldExit: true, fraction: 1, reason: 'breakeven_stop' };
  }
  if (firstTierHit({ pnlPct, tp1Pct, done: tp1Done })) {
    const frac = Math.min(1, Math.max(0, (Number(tp1SellPct) || 0) / 100));
    return { shouldExit: frac > 0, fraction: frac, reason: 'take_profit_tier1' };
  }
  if (Number.isFinite(tpPct) && tpPct > 0 && Number.isFinite(pnlPct) && pnlPct >= tpPct) {
    return { shouldExit: true, fraction: 1, reason: 'take_profit_hit' };
  }
  if (Number.isFinite(slPct) && slPct > 0 && Number.isFinite(pnlPct) && pnlPct <= -slPct) {
    return { shouldExit: true, fraction: 1, reason: 'stop_loss_hit' };
  }
  return { shouldExit: false, fraction: 0, reason: null };
}
