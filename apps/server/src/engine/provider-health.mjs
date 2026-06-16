// provider-health.mjs — in-memory rolling health of the external providers the money path
// depends on (Jupiter quotes, the RPC). A trading bot's biggest silent operational risk is a
// provider quietly failing — quotes 429ing, RPC erroring — so we measure REAL call outcomes
// (success/error + latency) over a sliding window and expose an honest status. No persistence:
// this is live operational health that should reset on restart, never a stored "estimate".
//
// The health monitor is OWNED by @soltrade/provider-adapters (ADR-0001 Phase 2D). The PROVIDER_BACKEND
// legacy in-process monitor was REMOVED in Phase 3B.4 after 3B.1/3B.3 proved byte-identical snapshots
// (same sliding window, degraded/down thresholds, percentiles) under an injected clock.
import { createProviderHealthMonitor } from '../../../../packages/provider-adapters/src/index.mjs';

export function createProviderHealth(args = {}) {
  return createProviderHealthMonitor(args);
}
