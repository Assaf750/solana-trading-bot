// ev-gate.mjs — leader expected-value quality gate. Blocks (strict) or warns (warning_only) on
// entries from leaders whose realized history fails the configured EV thresholds, but ONLY once a
// minimum sample of closed trades exists (insufficient evidence != bad). This is the runtime
// consumer the config.ev.* thresholds previously lacked. Pure & sync (stats passed in).
function r2(n) { return Math.round(n * 100) / 100; }

export function checkEvGate({ cfg, stats }) {
  const ev = cfg?.ev || {};
  const mode = ev.ev_gate_mode === 'warning_only' ? 'warning_only' : 'strict';
  const minSample = Number(ev.minimum_sample_size);

  // below the minimum sample (or with no data) we cannot judge a leader — allow.
  if (!stats || !Number.isFinite(stats.trades) || (Number.isFinite(minSample) && stats.trades < minSample)) {
    return { allowed: true, mode, rejections: [] };
  }

  const reasons = [];
  // profit_factor === Infinity (no losses yet) is finite-check false -> skipped -> passes.
  if (Number.isFinite(ev.minimum_profit_factor) && Number.isFinite(stats.profit_factor) && stats.profit_factor < ev.minimum_profit_factor) {
    reasons.push(`profit_factor_${r2(stats.profit_factor)}_below_${ev.minimum_profit_factor}`);
  }
  if (Number.isFinite(ev.minimum_net_expectancy) && Number.isFinite(stats.avg_realized) && stats.avg_realized < ev.minimum_net_expectancy) {
    reasons.push(`net_expectancy_${r2(stats.avg_realized)}_below_${ev.minimum_net_expectancy}`);
  }
  if (Number.isFinite(ev.minimum_exit_success_rate) && Number.isFinite(stats.win_rate) && stats.win_rate < ev.minimum_exit_success_rate) {
    reasons.push(`win_rate_${r2(stats.win_rate)}_below_${ev.minimum_exit_success_rate}`);
  }
  // NOTE: minimum_lower_confidence_bound and max_expected_drawdown_pct are not yet enforced here
  // (they need distributional/equity-curve inputs the engine doesn't compute inline) — documented gap.

  return { allowed: reasons.length === 0 || mode === 'warning_only', mode, rejections: reasons };
}
