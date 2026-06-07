// Types for rpc-health-monitor.mjs. Outputs use SSOT G5 names.

export interface SlotSample {
  provider?: string;
  slot: number;
  confirmed_slot?: number;
  primary?: boolean;
}

export interface RpcHealthOptions {
  /** Required. No invented default — missing => fail-safe degraded. */
  slot_lag_threshold?: number;
}

export interface RpcHealthResult {
  provider_degraded: boolean;        // SSOT G5
  slot_lag: number | null;           // SSOT G5
  last_seen_slot: number | null;     // SSOT G5
  last_confirmed_slot: number | null;// SSOT G5
  reason?: string;
}

export function evaluateRpcHealth(samples: SlotSample[], options?: RpcHealthOptions): RpcHealthResult;
