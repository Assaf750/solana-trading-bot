// Type declarations for @soltrade/profitability-intelligence-foundations (Stage-16).
// All results are frozen, read_only:true, advisory_only:true, all 24 exec/readiness flags false.

export interface ProfitSafeFlags {
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

export type ProfitabilityInputState =
  | 'PROFITABILITY_INPUT_UNCONFIGURED' | 'PROFITABILITY_INPUT_INVALID'
  | 'PROFITABILITY_INPUT_DEGRADED' | 'PROFITABILITY_INPUT_VALID';

export type ProfitabilityState =
  | 'PROFITABILITY_UNCONFIGURED' | 'PROFITABILITY_INVALID' | 'PROFITABILITY_READ_MODEL';

export type ProfitabilityFlagsState =
  | 'PROFITABILITY_FLAGS_UNCONFIGURED' | 'PROFITABILITY_FLAGS_INVALID'
  | 'PROFITABILITY_FLAGS_READ_MODEL';

export type CopyabilityAdvisoryState =
  | 'COPYABILITY_ADVISORY_UNCONFIGURED' | 'COPYABILITY_ADVISORY_INVALID'
  | 'COPYABILITY_ADVISORY_READ_MODEL';

export type ProfitabilityEvidenceToken = 'SUFFICIENT' | 'INSUFFICIENT_EVIDENCE';

export type ProfitabilityAdvisoryToken =
  | 'PROFITABILITY_ADVISORY_INSUFFICIENT_EVIDENCE'
  | 'PROFITABILITY_ADVISORY_NOT_COPY_SUITABLE'
  | 'PROFITABILITY_ADVISORY_PREFER_WATCH_ONLY'
  | 'PROFITABILITY_ADVISORY_KEEP_EVALUATING';

export type ProfitabilitySurfaceState =
  | 'PROFITABILITY_SURFACE_UNCONFIGURED' | 'PROFITABILITY_SURFACE_CLEAN'
  | 'PROFITABILITY_SURFACE_BLOCKED';

export type ProfitabilityHealthState =
  | 'PROFITABILITY_HEALTH_UNCONFIGURED' | 'PROFITABILITY_HEALTH_DEGRADED'
  | 'PROFITABILITY_HEALTH_REVIEWED_ADVISORY' | 'PROFITABILITY_HEALTH_SUPPRESSED'
  | 'PROFITABILITY_HEALTH_BLOCKED';

export interface ProfitabilityInputBoundaryResult extends ProfitSafeFlags {
  readonly valid: boolean;
  readonly profitability_input_boundary_valid: boolean;
  readonly eligible_for_profitability_intelligence: boolean;
  readonly profitability_input_state: ProfitabilityInputState;
  readonly status: ProfitabilityInputState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface WalletProfitabilityEntry {
  readonly profitability_net: number;
  readonly profitability_gross: number;
  readonly profitability_fees: number;
  readonly profitability_slippage: number;
  readonly profitability_wins: number;
  readonly profitability_losses: number;
  readonly profitability_flats: number;
  readonly profitability_open: number;
  readonly profitability_closed_count: number;
  readonly profitability_win_rate: number | null;
  readonly profitability_win_loss_ratio: number | null;
  readonly profitability_profit_factor: null;
  readonly profitability_evidence: ProfitabilityEvidenceToken;
  readonly simulated: true;
  readonly advisory_only: true;
}

export interface WalletProfitabilityResult extends ProfitSafeFlags {
  readonly valid: boolean;
  readonly profitability_state: ProfitabilityState;
  readonly simulated: true;
  readonly profitability_by_wallet: Readonly<Record<string, WalletProfitabilityEntry>>;
  readonly profitability_min_sample_size_valid: boolean;
  readonly status: ProfitabilityState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface ProfitabilityRiskFlagsEntry {
  readonly profitability_thin_evidence_flag: boolean;
  readonly profitability_loss_dominant_flag: boolean;
  readonly profitability_single_position_concentration_flag: boolean;
  readonly profitability_flags_unevaluated: boolean;
  readonly simulated: true;
  readonly advisory_only: true;
}

export interface ProfitabilityRiskFlagsResult extends ProfitSafeFlags {
  readonly valid: boolean;
  readonly profitability_flags_state: ProfitabilityFlagsState;
  readonly simulated: true;
  readonly profitability_flags_by_wallet: Readonly<Record<string, ProfitabilityRiskFlagsEntry>>;
  readonly profitability_thresholds_evaluated: boolean;
  readonly status: ProfitabilityFlagsState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface CopyabilityAdvisoryEntry {
  readonly profitability_advisory: ProfitabilityAdvisoryToken;
  readonly profitability_advisory_reasons: readonly string[];
  readonly simulated: true;
  readonly advisory_only: true;
}

export interface CopyabilityAdvisoryResult extends ProfitSafeFlags {
  readonly valid: boolean;
  readonly copyability_advisory_state: CopyabilityAdvisoryState;
  readonly simulated: true;
  readonly advisory_only: true;
  readonly profitability_advisory_by_wallet: Readonly<Record<string, CopyabilityAdvisoryEntry>>;
  readonly status: CopyabilityAdvisoryState;
  readonly reasons: readonly string[];
}

export interface ProfitabilitySuppressionResult extends ProfitSafeFlags {
  readonly suppressed: true;
  readonly suppression_reasons: readonly string[];
  readonly status: 'PROFITABILITY_SUPPRESSED';
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface ProfitabilityForbiddenSurfaceResult extends ProfitSafeFlags {
  readonly profitability_surface_state: ProfitabilitySurfaceState;
  readonly live_surface_detected: boolean;
  readonly key_material_detected: boolean;
  readonly forbidden_field_detected: boolean;
  readonly forbidden_field_ref: string | null;
  readonly status: ProfitabilitySurfaceState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export interface ProfitabilityHealthResult extends ProfitSafeFlags {
  readonly valid: boolean;
  readonly profitability_health_state: ProfitabilityHealthState;
  readonly status: ProfitabilityHealthState;
  readonly reasons: readonly string[];
  readonly advisory_only: true;
}

export declare function describeProfitabilityInputBoundaryContract(): Readonly<Record<string, unknown>>;
export declare function evaluateProfitabilityInputBoundary(input: unknown): ProfitabilityInputBoundaryResult;
export declare function describeWalletProfitabilityContract(): Readonly<Record<string, unknown>>;
export declare function evaluateWalletProfitability(input: unknown): WalletProfitabilityResult;
export declare function describeProfitabilityRiskFlagsContract(): Readonly<Record<string, unknown>>;
export declare function evaluateProfitabilityRiskFlags(input: unknown): ProfitabilityRiskFlagsResult;
export declare function describeCopyabilityAdvisoryContract(): Readonly<Record<string, unknown>>;
export declare function evaluateCopyabilityAdvisory(input: unknown): CopyabilityAdvisoryResult;
export declare function describeProfitabilitySuppressionContract(): Readonly<Record<string, unknown>>;
export declare function evaluateProfitabilitySuppression(input: unknown): ProfitabilitySuppressionResult;
export declare function describeProfitabilityForbiddenSurfaceContract(): Readonly<Record<string, unknown>>;
export declare function evaluateProfitabilityForbiddenSurface(input: unknown): ProfitabilityForbiddenSurfaceResult;
export declare function describeProfitabilityHealthContract(): Readonly<Record<string, unknown>>;
export declare function evaluateProfitabilityHealth(inputs: unknown): ProfitabilityHealthResult;
