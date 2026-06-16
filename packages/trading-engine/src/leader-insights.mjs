// @soltrade/trading-engine — leader-insights pure logic (ADR-0001 Phase Engine-3). The follow/drop/watch
// recommendation, the leader ranking score, and the insights roll-up are PURE domain logic, extracted
// byte-for-byte from apps/server paper-engine's leaderInsights(). The caller gathers the impure inputs
// (per-leader stats from the positions store, the EV-gate verdict) and passes them in; this module imports
// no mechanisms (no fs / network / provider / store).

/**
 * Recommend follow / drop / watch for one leader — byte-for-byte the prior in-line rule:
 *  - enough sample (minSample finite && trades >= minSample): EV-gate rejected -> 'drop', else 'follow'
 *  - some trades (but below sample): net realized < 0 -> 'watch', else 'follow'
 *  - no trades: 'watch'
 * `evGateRejected` is the caller's EV-gate verdict; it is consulted ONLY in the enough-sample branch
 * (exactly as before), so the caller only needs to run the EV gate when there is enough sample.
 */
export function recommendLeader({ stats, minSample, evGateRejected = false } = {}) {
  const s = stats || {};
  if (Number.isFinite(minSample) && s.trades >= minSample) return evGateRejected ? 'drop' : 'follow';
  if (s.trades > 0) return s.total_realized < 0 ? 'watch' : 'follow';
  return 'watch';
}

/** Leader ranking score (pure): realized PnL weighted by win rate — byte-for-byte the prior formula. */
export function scoreLeader({ total_realized, win_rate } = {}) {
  return Number(total_realized) * (0.5 + 0.5 * Number(win_rate));
}

/** Roll up already-shaped leader rows: rank by score (best first) + group addresses by recommendation. */
export function finalizeLeaderInsights({ mode = null, leaders = [] } = {}) {
  const ranked = leaders.slice().sort((a, b) => b.score - a.score);
  const recommendation = { follow: [], drop: [], watch: [] };
  for (const x of ranked) (recommendation[x.recommendation] || (recommendation.watch)).push(x.leader);
  return { mode, leaders: ranked, recommendation };
}
