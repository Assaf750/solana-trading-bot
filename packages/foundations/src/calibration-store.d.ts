// Types for calibration-store.mjs (ARCHITECTURE §9 CalibrationRecord, internal).

export interface CalibrationRecord {
  trade_id?: string;
  brain?: string;
  signal_bucket?: string;
  wallet_cluster?: string;
  token_risk_bucket?: string;
  simulated_fill_price?: number;
  real_fill_price?: number;
  simulated_slippage?: number;
  real_slippage?: number;
  simulated_exit?: unknown;
  real_exit?: unknown;
  failed_attempts_count?: number;
  rpc_latency_ms?: number;
  route_failure_flag?: boolean;
  ata_rent_paid?: number;
  ata_rent_recovered?: number;
  dust_event_flag?: boolean;
  ordering_confidence?: number;
  timestamp_processed?: string;
  timestamp_confirmed?: string;
}

export interface CalibrationBucket {
  brain?: string;
  signal_bucket?: string;
  wallet_cluster?: string;
  token_risk_bucket?: string;
}

export interface CalibrationPriors {
  p_fill: number;
  p_exit_success: number;
  route_failure_flag_rate: number;
  sample_size: number;
  source: 'pessimistic_default' | 'finalized_records';
}

export interface CalibrationStore {
  add(record: CalibrationRecord): number;
  getPriors(bucket?: CalibrationBucket): CalibrationPriors;
  finalizedCount(): number;
  readonly length: number;
}

export function createCalibrationStore(): CalibrationStore;
export const CALIBRATION_PESSIMISTIC_PRIORS: Readonly<{ p_fill: number; p_exit_success: number; route_failure_flag_rate: number }>;
