// exit-rules.mjs — pure exit-decision helpers (no I/O), unit-tested in isolation so the
// money-path markPass loop stays a thin caller. All percentages are P&L percentages
// (size-independent), so a partial exit that rescales cost+mark together never distorts them.

/**
 * Trailing stop. Once a position has been up by at least `trailingPct` (armed), exit fully
 * if it has since given back `trailingPct` in PRICE terms from its peak.
 *  - peakPct: the highest P&L % the position has reached
 *  - pnlPct:  the current P&L %
 * Returns true to exit. Off (false) when trailingPct is unset/≤0 or not yet armed.
 */
export function trailingStopHit({ pnlPct, peakPct, trailingPct }) {
  if (!Number.isFinite(trailingPct) || trailingPct <= 0) return false;
  if (!Number.isFinite(peakPct) || !Number.isFinite(pnlPct)) return false;
  if (peakPct < trailingPct) return false; // not armed: never been up by the trail distance
  // give-back from peak in price %: 1 - (1+pnl)/(1+peak)
  const ddFromPeakPct = (1 - (1 + pnlPct / 100) / (1 + peakPct / 100)) * 100;
  return ddFromPeakPct >= trailingPct;
}

/**
 * First-tier (partial) take-profit. Fires once, when P&L first reaches `tp1Pct`, selling a
 * fraction of the position (the caller applies tp1_sell_pct) and leaving the rest to ride.
 * `done` = the position's persisted tp1_done flag. Off when tp1Pct is unset/≤0.
 */
export function firstTierHit({ pnlPct, tp1Pct, done }) {
  if (done) return false;
  if (!Number.isFinite(tp1Pct) || tp1Pct <= 0) return false;
  if (!Number.isFinite(pnlPct)) return false;
  return pnlPct >= tp1Pct;
}

/**
 * Break-even stop (moonbag protection). After the first tier has banked profit, exit the
 * remainder if the position falls back to break-even (pnl ≤ 0). Armed only when the position's
 * tp1_done flag is set AND breakeven_after_tp1 is enabled.
 */
export function breakevenStopHit({ pnlPct, tp1Done, breakevenAfterTp1 }) {
  if (!tp1Done || breakevenAfterTp1 !== true) return false;
  if (!Number.isFinite(pnlPct)) return false;
  return pnlPct <= 0;
}
