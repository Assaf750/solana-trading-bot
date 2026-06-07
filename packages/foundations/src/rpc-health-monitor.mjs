// @soltrade/foundations — RPCHealthMonitor / SlotLagMonitor (Build Order #3).
// SOURCE: docs/00-ARCHITECTURE.md §15 (SlotLagMonitor) + docs/05-DATA-MODEL.md §5.2.
// Pure evaluation over CALLER-PROVIDED slot samples — NO RPC calls, NO subscriptions,
// NO external network. Outputs use SSOT G5 field names only (provider_degraded /
// slot_lag / last_seen_slot / last_confirmed_slot).
//
// FAIL-SAFE: missing/empty samples, or a missing lag threshold => provider_degraded=true
// (treat unknown health as degraded → drives EXITS_ONLY upstream). Never assume healthy.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Evaluate provider/stream health from multi-provider slot samples (mocked/manual).
 * @param samples [{ provider, slot, confirmed_slot?, primary? }]
 * @param options { slot_lag_threshold } — REQUIRED; no invented default.
 * @returns { provider_degraded, slot_lag, last_seen_slot, last_confirmed_slot, reason? }
 */
export function evaluateRpcHealth(samples, options = {}) {
  const threshold = options.slot_lag_threshold;
  const failSafe = (reason) => ({
    provider_degraded: true, slot_lag: null, last_seen_slot: null, last_confirmed_slot: null, reason,
  });

  if (!isNum(threshold)) return failSafe('missing_slot_lag_threshold');
  if (!Array.isArray(samples) || samples.length === 0) return failSafe('no_samples');

  const valid = samples.filter((s) => s && isNum(s.slot));
  if (valid.length === 0) return failSafe('no_valid_slot_samples');

  const peerMaxSlot = Math.max(...valid.map((s) => s.slot));
  const primary = valid.find((s) => s.primary === true) || valid[0];

  const slot_lag = peerMaxSlot - primary.slot;
  const last_seen_slot = primary.slot;
  const confirmed = valid.filter((s) => isNum(s.confirmed_slot)).map((s) => s.confirmed_slot);
  const last_confirmed_slot = confirmed.length ? Math.max(...confirmed) : null;

  // Degraded when primary trails peers beyond the (caller-provided) threshold.
  const provider_degraded = slot_lag > threshold;

  return { provider_degraded, slot_lag, last_seen_slot, last_confirmed_slot };
}
