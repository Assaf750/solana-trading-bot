// @soltrade/risk-engine-foundations — type declarations
//
// Read-only / advisory ONLY RISK foundation for Stage-7, consuming Stage-6 signal
// outputs. A risk verdict is NEVER a trade order, intent, route, send permission,
// or trading readiness. Even a risk PASS is advisory. No network, clock,
// persistence, or secrets.

export interface RiskSafeFlags {
  read_only: true;
  live_stream_enabled: false;
  network_call_made: false;
  endpoint_resolved: false;
  has_secret: false;
  signal_ready: false;
  trading_ready: false;
  risk_ready: false;
  intent_ready: false;
  routing_ready: false;
  can_send: false;
  can_broadcast: false;
  can_serialize: false;
  signing_permitted: false;
  broadcast_permitted: false;
  is_live: false;
  mainnet_enabled: false;
  real_live: false;
}

// --- (C) Risk Input Boundary ---

export type RiskInputBoundaryState =
  | 'RISK_INPUT_UNCONFIGURED'
  | 'RISK_INPUT_INVALID'
  | 'RISK_INPUT_DEGRADED'
  | 'RISK_INPUT_VALID';

export interface RiskInputBoundaryContractDescriptor extends RiskSafeFlags {
  contract: 'risk-input-boundary';
  version: string;
  test_only: true;
  supported_states: readonly RiskInputBoundaryState[];
  advisory_only: true;
  risk_input_state: RiskInputBoundaryState;
  risk_input_boundary_valid: boolean;
  eligible_for_risk_evaluation: boolean;
  status: RiskInputBoundaryState;
  reasons: readonly string[];
  note: string;
}

export interface RiskInputBoundaryValidationResult extends RiskSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface RiskInputBoundaryResult extends RiskSafeFlags {
  valid: boolean;
  risk_input_boundary_valid: boolean;
  eligible_for_risk_evaluation: boolean;
  risk_input_state: RiskInputBoundaryState;
  status: RiskInputBoundaryState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRiskInputBoundaryContract(): RiskInputBoundaryContractDescriptor;
export function validateRiskInputBoundary(input: unknown): RiskInputBoundaryValidationResult;
export function evaluateRiskInputBoundary(input: unknown): RiskInputBoundaryResult;

// --- (D) Hard Risk Gate ---

export type HardRiskState =
  | 'HARD_RISK_UNCONFIGURED'
  | 'HARD_RISK_INVALID'
  | 'HARD_RISK_DEGRADED'
  | 'HARD_RISK_BLOCKED'
  | 'HARD_RISK_PASS_ADVISORY';

export interface HardRiskGateContractDescriptor extends RiskSafeFlags {
  contract: 'hard-risk-gate';
  version: string;
  test_only: true;
  supported_states: readonly HardRiskState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  valid: boolean;
  hard_risk_state: HardRiskState;
  risk_blocked: boolean;
  risk_passed_advisory: boolean;
  risk_reason_codes: readonly string[];
  status: HardRiskState;
  reasons: readonly string[];
  note: string;
}

export interface HardRiskValidationResult extends RiskSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface HardRiskGateResult extends RiskSafeFlags {
  valid: boolean;
  hard_risk_state: HardRiskState;
  risk_blocked: boolean;
  risk_passed_advisory: boolean;
  risk_reason_codes: readonly string[];
  status: HardRiskState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeHardRiskGateContract(): HardRiskGateContractDescriptor;
export function validateHardRiskInput(input: unknown): HardRiskValidationResult;
export function evaluateHardRiskGate(input: unknown): HardRiskGateResult;

// --- (E) Liquidity / Exit Feasibility Risk ---

export type LiquidityExitState =
  | 'LIQUIDITY_EXIT_UNCONFIGURED'
  | 'LIQUIDITY_EXIT_INVALID'
  | 'LIQUIDITY_EXIT_DEGRADED'
  | 'LIQUIDITY_EXIT_BLOCKED'
  | 'LIQUIDITY_EXIT_PASS_ADVISORY';

export type LiquidityBucket = 'unknown' | 'thin' | 'adequate' | 'deep';
export type ExitFeasibilityBucket = 'unknown' | 'poor' | 'limited' | 'feasible';
export type SlippageRiskBucket = 'unknown' | 'high' | 'medium' | 'low';

export interface LiquidityExitRiskContractDescriptor extends RiskSafeFlags {
  contract: 'liquidity-exit-risk';
  version: string;
  test_only: true;
  supported_states: readonly LiquidityExitState[];
  supported_reason_codes: readonly string[];
  supported_liquidity_buckets: readonly LiquidityBucket[];
  supported_exit_buckets: readonly ExitFeasibilityBucket[];
  supported_slippage_buckets: readonly SlippageRiskBucket[];
  advisory_only: true;
  valid: boolean;
  liquidity_exit_state: LiquidityExitState;
  exit_feasible_advisory: boolean;
  risk_blocked: boolean;
  risk_reason_codes: readonly string[];
  status: LiquidityExitState;
  reasons: readonly string[];
  note: string;
}

export interface LiquidityExitRiskValidationResult extends RiskSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface LiquidityExitRiskResult extends RiskSafeFlags {
  valid: boolean;
  liquidity_exit_state: LiquidityExitState;
  exit_feasible_advisory: boolean;
  risk_blocked: boolean;
  risk_reason_codes: readonly string[];
  status: LiquidityExitState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeLiquidityExitRiskContract(): LiquidityExitRiskContractDescriptor;
export function validateLiquidityExitRiskInput(input: unknown): LiquidityExitRiskValidationResult;
export function evaluateLiquidityExitRisk(input: unknown): LiquidityExitRiskResult;

// --- (F) Exposure / Limit Risk ---

export type ExposureLimitState =
  | 'EXPOSURE_LIMIT_UNCONFIGURED'
  | 'EXPOSURE_LIMIT_INVALID'
  | 'EXPOSURE_LIMIT_DEGRADED'
  | 'EXPOSURE_LIMIT_BLOCKED'
  | 'EXPOSURE_LIMIT_PASS_ADVISORY';

export type ExposureBucket = 'unknown' | 'within_limit' | 'near_limit' | 'over_limit';
export type LimitState = 'unknown' | 'ok' | 'near_limit' | 'blocked';

export interface ExposureLimitRiskContractDescriptor extends RiskSafeFlags {
  contract: 'exposure-limit-risk';
  version: string;
  test_only: true;
  supported_states: readonly ExposureLimitState[];
  supported_reason_codes: readonly string[];
  supported_exposure_buckets: readonly ExposureBucket[];
  supported_limit_states: readonly LimitState[];
  advisory_only: true;
  valid: boolean;
  exposure_risk_state: ExposureLimitState;
  risk_blocked: boolean;
  risk_passed_advisory: boolean;
  risk_reason_codes: readonly string[];
  status: ExposureLimitState;
  reasons: readonly string[];
  note: string;
}

export interface ExposureLimitRiskValidationResult extends RiskSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface ExposureLimitRiskResult extends RiskSafeFlags {
  valid: boolean;
  exposure_risk_state: ExposureLimitState;
  risk_blocked: boolean;
  risk_passed_advisory: boolean;
  risk_reason_codes: readonly string[];
  status: ExposureLimitState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeExposureLimitRiskContract(): ExposureLimitRiskContractDescriptor;
export function validateExposureLimitRiskInput(input: unknown): ExposureLimitRiskValidationResult;
export function evaluateExposureLimitRisk(input: unknown): ExposureLimitRiskResult;

// --- (G) Risk Verdict / Explanation ---

export type RiskVerdictState =
  | 'RISK_UNCONFIGURED'
  | 'RISK_DEGRADED'
  | 'RISK_BLOCKED'
  | 'RISK_PASS_ADVISORY';

export interface RiskVerdictContractDescriptor extends RiskSafeFlags {
  contract: 'risk-verdict';
  version: string;
  test_only: true;
  supported_states: readonly RiskVerdictState[];
  supported_reason_codes: readonly string[];
  supported_explanation_codes: readonly string[];
  advisory_only: true;
  valid: boolean;
  risk_verdict_state: RiskVerdictState;
  risk_passed_advisory: boolean;
  risk_blocked: boolean;
  risk_reason_codes: readonly string[];
  risk_explanation_codes: readonly string[];
  status: RiskVerdictState;
  reasons: readonly string[];
  note: string;
}

export interface RiskVerdictResult extends RiskSafeFlags {
  valid: boolean;
  risk_verdict_state: RiskVerdictState;
  risk_passed_advisory: boolean;
  risk_blocked: boolean;
  risk_reason_codes: readonly string[];
  risk_explanation_codes: readonly string[];
  status: RiskVerdictState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRiskVerdictContract(): RiskVerdictContractDescriptor;
export function evaluateRiskVerdict(input: unknown): RiskVerdictResult;

// --- (H) Risk Suppression / Rejection ---

export interface RiskSuppressionContractDescriptor extends RiskSafeFlags {
  contract: 'risk-suppression';
  version: string;
  test_only: true;
  supported_reason_codes: readonly string[];
  advisory_only: true;
  suppressed: boolean;
  suppression_reasons: readonly string[];
  status: string;
  reasons: readonly string[];
  note: string;
}

export interface RiskSuppressionResult extends RiskSafeFlags {
  suppressed: boolean;
  suppression_reasons: readonly string[];
  status: string;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRiskSuppressionContract(): RiskSuppressionContractDescriptor;
export function evaluateRiskSuppression(input: unknown): RiskSuppressionResult;

// --- (I) Risk Health / Status ---

export type RiskHealthState =
  | 'RISK_HEALTH_UNCONFIGURED'
  | 'RISK_HEALTH_DEGRADED'
  | 'RISK_HEALTH_PASS_ADVISORY'
  | 'RISK_HEALTH_SUPPRESSED'
  | 'RISK_HEALTH_BLOCKED';

export interface RiskHealthContractDescriptor extends RiskSafeFlags {
  contract: 'risk-health';
  version: string;
  test_only: true;
  supported_states: readonly RiskHealthState[];
  advisory_only: true;
  valid: boolean;
  risk_health_state: RiskHealthState;
  risk_health_pass_advisory: boolean;
  status: RiskHealthState;
  reasons: readonly string[];
  note: string;
}

export interface RiskHealthResult extends RiskSafeFlags {
  valid: boolean;
  risk_health_state: RiskHealthState;
  risk_health_pass_advisory: boolean;
  status: RiskHealthState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRiskHealthContract(): RiskHealthContractDescriptor;
export function evaluateRiskHealth(inputs: unknown): RiskHealthResult;
