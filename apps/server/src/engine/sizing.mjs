// sizing.mjs — pure position-size helpers (no I/O), unit-tested in isolation.

/**
 * Proportional-to-leader size in USD: copy `valuePct`% of the leader's own buy size. Optionally
 * clamped to the position-size cap (capUsd * maxPosPct%) so a whale leader's huge buy co-operates
 * with the risk limits instead of being rejected outright. Returns null when it can't size safely.
 */
export function proportionalLeaderUsd({ leaderUsd, valuePct, capUsd, maxPosPct }) {
  if (!Number.isFinite(leaderUsd) || leaderUsd <= 0) return null;
  if (!Number.isFinite(valuePct) || valuePct <= 0) return null;
  let usd = leaderUsd * valuePct / 100;
  if (Number.isFinite(capUsd) && capUsd > 0 && Number.isFinite(maxPosPct) && maxPosPct > 0) {
    usd = Math.min(usd, capUsd * maxPosPct / 100);
  }
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}
