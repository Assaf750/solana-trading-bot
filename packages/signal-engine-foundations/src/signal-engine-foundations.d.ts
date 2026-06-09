// @soltrade/signal-engine-foundations — type declarations
//
// Read-only / advisory ONLY signal foundation. A candidate signal is NEVER a
// buy order, copy permission, trading readiness, risk approval, intent, or
// route. Input comes ONLY from Stage-5 intelligence outputs. No network, clock,
// persistence, or secrets.

export interface SigSafeFlags {
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

export type ConfidenceBucket = 'none' | 'low' | 'medium' | 'high';

// --- (C) Signal Input Boundary ---

export type SignalInputBoundaryState =
  | 'SIGNAL_INPUT_UNCONFIGURED'
  | 'SIGNAL_INPUT_INVALID'
  | 'SIGNAL_INPUT_DEGRADED'
  | 'SIGNAL_INPUT_VALID';

export interface SignalInputBoundaryContractDescriptor extends SigSafeFlags {
  contract: 'signal-input-boundary';
  version: string;
  test_only: true;
  supported_states: readonly SignalInputBoundaryState[];
  advisory_only: true;
  signal_input_state: SignalInputBoundaryState;
  input_boundary_valid: boolean;
  eligible_for_candidate_signal: boolean;
  status: SignalInputBoundaryState;
  reasons: readonly string[];
  note: string;
}

export interface SignalInputBoundaryValidationResult extends SigSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface SignalInputBoundaryResult extends SigSafeFlags {
  valid: boolean;
  input_boundary_valid: boolean;
  eligible_for_candidate_signal: boolean;
  signal_input_state: SignalInputBoundaryState;
  status: SignalInputBoundaryState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSignalInputBoundaryContract(): SignalInputBoundaryContractDescriptor;
export function validateSignalInputBoundary(input: unknown): SignalInputBoundaryValidationResult;
export function evaluateSignalInputBoundary(input: unknown): SignalInputBoundaryResult;

// --- (D) Wallet-Led Candidate Signal ---

export type WalletLedCandidateSignalState =
  | 'WALLET_LED_UNCONFIGURED'
  | 'WALLET_LED_INVALID'
  | 'WALLET_LED_SUPPRESSED'
  | 'WALLET_LED_CANDIDATE';

export interface WalletLedCandidateSignalContractDescriptor extends SigSafeFlags {
  contract: 'wallet-led-candidate-signal';
  version: string;
  test_only: true;
  supported_states: readonly WalletLedCandidateSignalState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  signal_kind: 'wallet_led_candidate';
  candidate_signal_valid: boolean;
  candidate_signal_state: WalletLedCandidateSignalState;
  confidence_bucket: ConfidenceBucket;
  status: WalletLedCandidateSignalState;
  reasons: readonly string[];
  note: string;
}

export interface WalletLedSignalValidationResult extends SigSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface WalletLedCandidateSignalResult extends SigSafeFlags {
  candidate_signal_valid: boolean;
  candidate_signal_state: WalletLedCandidateSignalState;
  signal_kind: 'wallet_led_candidate';
  wallet_ref?: string;
  token_ref?: string;
  reason_codes: readonly string[];
  explanation_refs: readonly string[];
  confidence_bucket: ConfidenceBucket;
  status: WalletLedCandidateSignalState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeWalletLedCandidateSignalContract(): WalletLedCandidateSignalContractDescriptor;
export function validateWalletLedSignalInput(input: unknown): WalletLedSignalValidationResult;
export function evaluateWalletLedCandidateSignal(input: unknown): WalletLedCandidateSignalResult;

// --- (E) Token Activity Candidate Signal ---

export type TokenActivityCandidateSignalState =
  | 'TOKEN_ACTIVITY_UNCONFIGURED'
  | 'TOKEN_ACTIVITY_INVALID'
  | 'TOKEN_ACTIVITY_SUPPRESSED'
  | 'TOKEN_ACTIVITY_CANDIDATE';

export interface TokenActivityCandidateSignalContractDescriptor extends SigSafeFlags {
  contract: 'token-activity-candidate-signal';
  version: string;
  test_only: true;
  supported_states: readonly TokenActivityCandidateSignalState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  signal_kind: 'token_activity_candidate';
  candidate_signal_valid: boolean;
  candidate_signal_state: TokenActivityCandidateSignalState;
  confidence_bucket: ConfidenceBucket;
  status: TokenActivityCandidateSignalState;
  reasons: readonly string[];
  note: string;
}

export interface TokenActivitySignalValidationResult extends SigSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface TokenActivityCandidateSignalResult extends SigSafeFlags {
  candidate_signal_valid: boolean;
  candidate_signal_state: TokenActivityCandidateSignalState;
  signal_kind: 'token_activity_candidate';
  token_ref?: string;
  reason_codes: readonly string[];
  explanation_refs: readonly string[];
  confidence_bucket: ConfidenceBucket;
  status: TokenActivityCandidateSignalState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeTokenActivityCandidateSignalContract(): TokenActivityCandidateSignalContractDescriptor;
export function validateTokenActivitySignalInput(input: unknown): TokenActivitySignalValidationResult;
export function evaluateTokenActivityCandidateSignal(input: unknown): TokenActivityCandidateSignalResult;

// --- (F) Candidate Signal Scoring / Explanation ---

export type SignalScoreBucket = 'none' | 'low' | 'medium' | 'high';

export type SignalScoreState =
  | 'SIGNAL_SCORE_UNCONFIGURED'
  | 'SIGNAL_SCORE_INVALID'
  | 'SIGNAL_SCORE_SUPPRESSED'
  | 'SIGNAL_SCORE_DESCRIBED';

export interface CandidateSignalScoringContractDescriptor extends SigSafeFlags {
  contract: 'candidate-signal-scoring';
  version: string;
  test_only: true;
  supported_states: readonly SignalScoreState[];
  supported_score_buckets: readonly SignalScoreBucket[];
  supported_explanation_codes: readonly string[];
  supported_suppression_reasons: readonly string[];
  advisory_only: true;
  score_valid: boolean;
  score_bucket: SignalScoreBucket;
  explanation_codes: readonly string[];
  suppression_reasons: readonly string[];
  status: SignalScoreState;
  reasons: readonly string[];
  note: string;
}

export interface CandidateSignalScoreResult extends SigSafeFlags {
  score_valid: boolean;
  score_bucket: SignalScoreBucket;
  signal_score_state: SignalScoreState;
  explanation_codes: readonly string[];
  suppression_reasons: readonly string[];
  status: SignalScoreState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeCandidateSignalScoringContract(): CandidateSignalScoringContractDescriptor;
export function evaluateCandidateSignalScore(input: unknown): CandidateSignalScoreResult;

// --- (G) Signal Suppression / Rejection ---

export type SignalSuppressionState =
  | 'SIGNAL_SUPPRESSION_UNCONFIGURED'
  | 'SIGNAL_SUPPRESSION_INVALID'
  | 'SIGNAL_SUPPRESSION_SUPPRESSED'
  | 'SIGNAL_SUPPRESSION_NOT_SUPPRESSED';

export interface SignalSuppressionContractDescriptor extends SigSafeFlags {
  contract: 'signal-suppression';
  version: string;
  test_only: true;
  supported_states: readonly SignalSuppressionState[];
  supported_suppression_reasons: readonly string[];
  advisory_only: true;
  suppressed: boolean;
  suppression_reasons: readonly string[];
  status: SignalSuppressionState;
  reasons: readonly string[];
  note: string;
}

export interface SignalSuppressionResult extends SigSafeFlags {
  suppressed: boolean;
  suppression_reasons: readonly string[];
  signal_suppression_state: SignalSuppressionState;
  status: SignalSuppressionState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSignalSuppressionContract(): SignalSuppressionContractDescriptor;
export function evaluateSignalSuppression(input: unknown): SignalSuppressionResult;

// --- (H) Signal Health / Status ---

export type SignalHealthState =
  | 'SIGNAL_UNCONFIGURED'
  | 'SIGNAL_DEGRADED'
  | 'SIGNAL_READY_ADVISORY'
  | 'SIGNAL_SUPPRESSED'
  | 'SIGNAL_BLOCKED';

export interface SignalHealthContractDescriptor extends SigSafeFlags {
  contract: 'signal-health';
  version: string;
  test_only: true;
  supported_states: readonly SignalHealthState[];
  advisory_only: true;
  valid: boolean;
  signal_state: SignalHealthState;
  signal_ready_advisory: boolean;
  status: SignalHealthState;
  reasons: readonly string[];
  note: string;
}

export interface SignalHealthResult extends SigSafeFlags {
  valid: boolean;
  signal_state: SignalHealthState;
  signal_ready_advisory: boolean;
  status: SignalHealthState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSignalHealthContract(): SignalHealthContractDescriptor;
export function evaluateSignalHealth(inputs: unknown): SignalHealthResult;
