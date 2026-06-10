// Type declarations for @soltrade/calibration-backtest-foundations (Stage-15).
// All results are frozen, read_only:true, all 24 exec/readiness flags false.

export interface CalibSafeFlags {
  readonly read_only: true;
  readonly has_secret: false;
  readonly live_stream_enabled: false;
  readonly network_call_made: false;
  readonly endpoint_resolved: false;
  readonly live_quote_enabled: false;
  readonly signal_ready: false;
  readonly trading_ready: false;
  readonly risk_ready: false;
  readonly intent_ready: false;
  readonly routing_ready: false;
  readonly route_ready: false;
  readonly order_ready: false;
  readonly transaction_ready: false;
  readonly serialized_ready: false;
  readonly message_bytes_ready: false;
  readonly signer_ready: false;
  readonly signing_permitted: false;
  readonly broadcast_permitted: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly mainnet_enabled: false;
  readonly real_live: false;
}

export type CalibInputState =
  | 'CALIB_INPUT_UNCONFIGURED' | 'CALIB_INPUT_INVALID'
  | 'CALIB_INPUT_DEGRADED' | 'CALIB_INPUT_VALID';

export type CalibDivergenceState =
  | 'CALIB_DIVERGENCE_UNCONFIGURED' | 'CALIB_DIVERGENCE_INVALID'
  | 'CALIB_DIVERGENCE_UNCLASSIFIED' | 'CALIB_DIVERGENCE_WITHIN_BAND'
  | 'CALIB_DIVERGENCE_ELEVATED' | 'CALIB_DIVERGENCE_HIGH';

export type CalibDimensionClassification = 'WITHIN_BAND' | 'ELEVATED' | 'HIGH' | 'UNCLASSIFIED';

export type BacktestDatasetState =
  | 'BACKTEST_DATASET_UNCONFIGURED' | 'BACKTEST_DATASET_INVALID'
  | 'BACKTEST_DATASET_DEGRADED' | 'BACKTEST_DATASET_DESCRIPTOR';

export type BacktestReplayState =
  | 'BACKTEST_REPLAY_UNCONFIGURED' | 'BACKTEST_REPLAY_INVALID' | 'BACKTEST_REPLAY_READ_MODEL';

export type CalibSurfaceState =
  | 'CALIB_SURFACE_UNCONFIGURED' | 'CALIB_SURFACE_CLEAN' | 'CALIB_SURFACE_BLOCKED';

export type CalibHealthState =
  | 'CALIB_HEALTH_UNCONFIGURED' | 'CALIB_HEALTH_DEGRADED'
  | 'CALIB_HEALTH_REVIEWED_ADVISORY' | 'CALIB_HEALTH_SUPPRESSED' | 'CALIB_HEALTH_BLOCKED';

export interface CalibInputBoundaryResult extends CalibSafeFlags {
  readonly valid: boolean;
  readonly calib_input_boundary_valid: boolean;
  readonly eligible_for_calibration: boolean;
  readonly calib_input_state: CalibInputState;
  readonly status: CalibInputState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface CalibDimensionResult {
  readonly classification: CalibDimensionClassification;
  readonly metric: number | null;
  readonly pair_count: number;
  readonly reported_mean_latency_ms?: number | null;
  readonly reasons: readonly string[];
  readonly simulated: true;
}

export interface CalibDivergenceResult extends CalibSafeFlags {
  readonly valid: boolean;
  readonly calibration_divergence_state: CalibDivergenceState;
  readonly simulated: true;
  readonly dimensions: Readonly<Record<string, CalibDimensionResult>>;
  readonly finalized_count: number;
  readonly non_finalized_count: number;
  readonly status: CalibDivergenceState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface BacktestDatasetResult extends CalibSafeFlags {
  readonly valid: boolean;
  readonly backtest_dataset_state: BacktestDatasetState;
  readonly point_in_time_ok: boolean;
  readonly survivorship_free: boolean;
  readonly record_count: number;
  readonly wallet_count: number;
  readonly extinct_wallet_count: number;
  readonly status: BacktestDatasetState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface BacktestWalletBucket {
  readonly net: number;
  readonly gross: number;
  readonly fees: number;
  readonly slippage: number;
  readonly backtest_wins: number;
  readonly backtest_losses: number;
  readonly backtest_flats: number;
  readonly backtest_open: number;
  readonly simulated: true;
}

export interface BacktestReplayResult extends CalibSafeFlags {
  readonly valid: boolean;
  readonly backtest_replay_state: BacktestReplayState;
  readonly simulated: true;
  readonly candidate_pnl_by_wallet: Readonly<Record<string, BacktestWalletBucket>>;
  readonly status: BacktestReplayState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface CalibSuppressionResult extends CalibSafeFlags {
  readonly suppressed: true;
  readonly suppression_reasons: readonly string[];
  readonly status: string;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface CalibSurfaceResult extends CalibSafeFlags {
  readonly calibration_surface_state: CalibSurfaceState;
  readonly live_surface_detected: boolean;
  readonly key_material_detected: boolean;
  readonly forbidden_field_detected: boolean;
  readonly forbidden_field_ref: string | null;
  readonly status: CalibSurfaceState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface CalibHealthResult extends CalibSafeFlags {
  readonly valid: boolean;
  readonly calibration_health_state: CalibHealthState;
  readonly status: CalibHealthState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export declare function describeCalibrationInputBoundaryContract(): Readonly<Record<string, unknown>>;
export declare function evaluateCalibrationInputBoundary(input: unknown): CalibInputBoundaryResult;
export declare function describeCalibrationDivergenceContract(): Readonly<Record<string, unknown>>;
export declare function evaluateCalibrationDivergence(input: unknown): CalibDivergenceResult;
export declare function describeBacktestDatasetDescriptorContract(): Readonly<Record<string, unknown>>;
export declare function evaluateBacktestDatasetDescriptor(input: unknown): BacktestDatasetResult;
export declare function describeBacktestReplayContract(): Readonly<Record<string, unknown>>;
export declare function evaluateBacktestReplay(input: unknown): BacktestReplayResult;
export declare function describeCalibrationSuppressionContract(): Readonly<Record<string, unknown>>;
export declare function evaluateCalibrationSuppression(input: unknown): CalibSuppressionResult;
export declare function describeCalibrationForbiddenSurfaceContract(): Readonly<Record<string, unknown>>;
export declare function evaluateCalibrationForbiddenSurface(input: unknown): CalibSurfaceResult;
export declare function describeCalibrationHealthContract(): Readonly<Record<string, unknown>>;
export declare function evaluateCalibrationHealth(inputs: unknown): CalibHealthResult;
