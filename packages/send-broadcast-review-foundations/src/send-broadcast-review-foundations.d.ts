// @soltrade/send-broadcast-review-foundations — type declarations
//
// Read-only / advisory ONLY SEND / BROADCAST-REVIEW foundation for Stage-12,
// consuming Stage-11 signing-review outputs. A send/broadcast-review / descriptor
// is a READ-ONLY ADVISORY REPRESENTATION ONLY — it DESCRIPTIVELY REVIEWS
// send/broadcast PREREQUISITES from safe metadata; it is NEVER sending,
// broadcasting, an RPC call, a serialized transaction, a signature, a
// send/broadcast permission, or send/broadcast readiness. No network, live stream,
// live quote, aggregator/Jupiter/RPC route call, real signing, real sending, real
// broadcasting, serialization, message bytes, clock, persistence, secrets, or
// mutable module/global state. Every identifier here is a LOCAL function-I/O
// contract identifier, NOT an SSOT name.

export interface SendSafeFlags {
  read_only: true;
  has_secret: false;
  live_stream_enabled: false;
  network_call_made: false;
  endpoint_resolved: false;
  live_quote_enabled: false;
  signal_ready: false;
  trading_ready: false;
  risk_ready: false;
  intent_ready: false;
  routing_ready: false;
  route_ready: false;
  order_ready: false;
  transaction_ready: false;
  serialized_ready: false;
  message_bytes_ready: false;
  signer_ready: false;
  signing_permitted: false;
  broadcast_permitted: false;
  can_send: false;
  can_broadcast: false;
  can_serialize: false;
  is_live: false;
  mainnet_enabled: false;
  real_live: false;
}

export interface SendValidationResult extends SendSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

// --- (C) Send-Review Input Boundary ---

export type SendReviewInputState =
  | 'SEND_REVIEW_INPUT_UNCONFIGURED'
  | 'SEND_REVIEW_INPUT_INVALID'
  | 'SEND_REVIEW_INPUT_DEGRADED'
  | 'SEND_REVIEW_INPUT_VALID';

export interface SendReviewInputBoundaryContractDescriptor extends SendSafeFlags {
  contract: 'send-review-input-boundary';
  version: string;
  test_only: true;
  supported_states: readonly SendReviewInputState[];
  advisory_only: true;
  send_review_input_state: SendReviewInputState;
  send_review_input_boundary_valid: boolean;
  eligible_for_send_review: boolean;
  status: SendReviewInputState;
  reasons: readonly string[];
  note: string;
}

export interface SendReviewInputBoundaryResult extends SendSafeFlags {
  valid: boolean;
  send_review_input_boundary_valid: boolean;
  eligible_for_send_review: boolean;
  send_review_input_state: SendReviewInputState;
  status: SendReviewInputState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSendReviewInputBoundaryContract(): SendReviewInputBoundaryContractDescriptor;
export function validateSendReviewInputBoundary(input: unknown): SendValidationResult;
export function evaluateSendReviewInputBoundary(input: unknown): SendReviewInputBoundaryResult;

// --- (D) Sender / Provider Boundary ---

export type SenderProviderState =
  | 'SENDER_PROVIDER_UNCONFIGURED'
  | 'SENDER_PROVIDER_INVALID'
  | 'SENDER_PROVIDER_READ_ONLY_OK';

export type SenderProviderSource =
  | 'mock_sender_metadata'
  | 'fixture_sender_metadata'
  | 'disabled_sender'
  | 'helius_sender_disabled'
  | 'jito_sender_disabled'
  | 'rpc_provider_disabled';

export interface SenderProviderBoundaryContractDescriptor extends SendSafeFlags {
  contract: 'sender-provider-boundary';
  version: string;
  test_only: true;
  supported_states: readonly SenderProviderState[];
  supported_sources: readonly SenderProviderSource[];
  advisory_only: true;
  sender_provider_boundary_valid: boolean;
  sender_provider_state: SenderProviderState;
  sender_disabled: true;
  broadcast_performed: false;
  rpc_connected: false;
  endpoint_resolved: false;
  network_call_made: false;
  status: SenderProviderState;
  reasons: readonly string[];
  note: string;
}

export interface SenderProviderBoundaryResult extends SendSafeFlags {
  valid: boolean;
  sender_provider_boundary_valid: boolean;
  sender_provider_state: SenderProviderState;
  sender_disabled: true;
  broadcast_performed: false;
  rpc_connected: false;
  endpoint_resolved: false;
  network_call_made: false;
  status: SenderProviderState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSenderProviderBoundaryContract(): SenderProviderBoundaryContractDescriptor;
export function validateSenderProviderBoundary(input: unknown): SendValidationResult;
export function evaluateSenderProviderBoundary(input: unknown): SenderProviderBoundaryResult;

// --- (E) Candidate Send-Review Descriptor ---

export type CandidateSendReviewState =
  | 'CANDIDATE_SEND_REVIEW_UNCONFIGURED'
  | 'CANDIDATE_SEND_REVIEW_INVALID'
  | 'CANDIDATE_SEND_REVIEW_REJECTED'
  | 'CANDIDATE_SEND_REVIEW_DEGRADED'
  | 'CANDIDATE_SEND_REVIEW_DESCRIPTOR';

export interface CandidateSendReviewDescriptorContractDescriptor extends SendSafeFlags {
  contract: 'candidate-send-review-descriptor';
  version: string;
  test_only: true;
  supported_states: readonly CandidateSendReviewState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  candidate_send_review_valid: boolean;
  candidate_send_review_state: CandidateSendReviewState;
  send_review_ref: string | null;
  signing_review_ref: string | null;
  intent_record_ref: string | null;
  send_review_kind: 'candidate_send_review_descriptor';
  send_review_reason_codes: readonly string[];
  status: CandidateSendReviewState;
  reasons: readonly string[];
  note: string;
}

export interface CandidateSendReviewDescriptorResult extends SendSafeFlags {
  candidate_send_review_valid: boolean;
  candidate_send_review_state: CandidateSendReviewState;
  send_review_ref: string | null;
  signing_review_ref: string | null;
  intent_record_ref: string | null;
  send_review_kind: 'candidate_send_review_descriptor';
  send_review_reason_codes: readonly string[];
  status: CandidateSendReviewState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeCandidateSendReviewDescriptorContract(): CandidateSendReviewDescriptorContractDescriptor;
export function validateCandidateSendReviewDescriptorInput(input: unknown): SendValidationResult;
export function evaluateCandidateSendReviewDescriptor(input: unknown): CandidateSendReviewDescriptorResult;

// --- (F) Send-Readiness Advisory ---

export type SendReadinessState =
  | 'SEND_READINESS_UNCONFIGURED'
  | 'SEND_READINESS_INVALID'
  | 'SEND_READINESS_DEGRADED'
  | 'SEND_READINESS_REJECTED'
  | 'SEND_READINESS_ACCEPTABLE_ADVISORY';

export interface SendReadinessAdvisoryInput {
  purpose: 'send_readiness_input';
  sender_status_bucket: 'unknown' | 'disabled' | 'ready_advisory' | 'degraded';
  idempotency_bucket: 'unknown' | 'unbound' | 'bound';
  intent_binding_bucket: 'unknown' | 'unbound' | 'bound';
  bundle_bucket: 'unknown' | 'no_bundle' | 'bundle_advisory';
  tip_bucket: 'unknown' | 'none' | 'low' | 'medium' | 'high';
}

export interface SendReadinessAdvisoryContractDescriptor extends SendSafeFlags {
  contract: 'send-readiness-advisory';
  version: string;
  test_only: true;
  supported_states: readonly SendReadinessState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  valid: boolean;
  send_readiness_state: SendReadinessState;
  send_readiness_acceptable_advisory: boolean;
  send_readiness_rejected: boolean;
  send_review_reason_codes: readonly string[];
  status: SendReadinessState;
  reasons: readonly string[];
  note: string;
}

export interface SendReadinessAdvisoryResult extends SendSafeFlags {
  valid: boolean;
  send_readiness_state: SendReadinessState;
  send_readiness_acceptable_advisory: boolean;
  send_readiness_rejected: boolean;
  send_review_reason_codes: readonly string[];
  status: SendReadinessState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSendReadinessAdvisoryContract(): SendReadinessAdvisoryContractDescriptor;
export function validateSendReadinessAdvisoryInput(input: unknown): SendValidationResult;
export function evaluateSendReadinessAdvisory(input: unknown): SendReadinessAdvisoryResult;

// --- (G) Broadcast / Live Forbidden Surface Guard ---

export type BroadcastSurfaceState =
  | 'BROADCAST_SURFACE_UNCONFIGURED'
  | 'BROADCAST_SURFACE_CLEAN'
  | 'BROADCAST_SURFACE_BLOCKED';

export interface BroadcastForbiddenSurfaceContractDescriptor extends SendSafeFlags {
  contract: 'broadcast-forbidden-surface';
  version: string;
  test_only: true;
  supported_states: readonly BroadcastSurfaceState[];
  forbidden_field_names: readonly string[];
  advisory_only: true;
  broadcast_surface_state: BroadcastSurfaceState;
  live_surface_detected: boolean;
  broadcast_material_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: BroadcastSurfaceState;
  reasons: readonly string[];
  note: string;
}

export interface BroadcastForbiddenSurfaceResult extends SendSafeFlags {
  broadcast_surface_state: BroadcastSurfaceState;
  live_surface_detected: boolean;
  broadcast_material_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: BroadcastSurfaceState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeBroadcastForbiddenSurfaceContract(): BroadcastForbiddenSurfaceContractDescriptor;
export function evaluateBroadcastForbiddenSurface(input: unknown): BroadcastForbiddenSurfaceResult;

// --- (H) Send-Review Verdict ---

export type SendReviewVerdictState =
  | 'SEND_REVIEW_UNCONFIGURED'
  | 'SEND_REVIEW_DEGRADED'
  | 'SEND_REVIEW_BLOCKED'
  | 'SEND_REVIEW_PASS_ADVISORY';

export interface SendReviewVerdictContractDescriptor extends SendSafeFlags {
  contract: 'send-review-verdict';
  version: string;
  test_only: true;
  supported_states: readonly SendReviewVerdictState[];
  supported_reason_codes: readonly string[];
  supported_explanation_codes: readonly string[];
  advisory_only: true;
  valid: boolean;
  send_review_state: SendReviewVerdictState;
  send_review_passed_advisory: boolean;
  send_review_blocked: boolean;
  send_review_reason_codes: readonly string[];
  send_review_explanation_codes: readonly string[];
  status: SendReviewVerdictState;
  reasons: readonly string[];
  note: string;
}

export interface SendReviewVerdictResult extends SendSafeFlags {
  valid: boolean;
  send_review_state: SendReviewVerdictState;
  send_review_passed_advisory: boolean;
  send_review_blocked: boolean;
  send_review_reason_codes: readonly string[];
  send_review_explanation_codes: readonly string[];
  status: SendReviewVerdictState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSendReviewVerdictContract(): SendReviewVerdictContractDescriptor;
export function evaluateSendReviewVerdict(input: unknown): SendReviewVerdictResult;

// --- (I) Send-Review Suppression / Rejection ---

export interface SendReviewSuppressionContractDescriptor extends SendSafeFlags {
  contract: 'send-review-suppression';
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

export interface SendReviewSuppressionResult extends SendSafeFlags {
  suppressed: boolean;
  suppression_reasons: readonly string[];
  status: string;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSendReviewSuppressionContract(): SendReviewSuppressionContractDescriptor;
export function evaluateSendReviewSuppression(input: unknown): SendReviewSuppressionResult;

// --- (J) Send-Review Health / Status ---

export type SendReviewHealthState =
  | 'SEND_REVIEW_HEALTH_UNCONFIGURED'
  | 'SEND_REVIEW_HEALTH_DEGRADED'
  | 'SEND_REVIEW_HEALTH_REVIEWED_ADVISORY'
  | 'SEND_REVIEW_HEALTH_SUPPRESSED'
  | 'SEND_REVIEW_HEALTH_BLOCKED';

export interface SendReviewHealthContractDescriptor extends SendSafeFlags {
  contract: 'send-review-health';
  version: string;
  test_only: true;
  supported_states: readonly SendReviewHealthState[];
  advisory_only: true;
  valid: boolean;
  send_review_health_state: SendReviewHealthState;
  status: SendReviewHealthState;
  reasons: readonly string[];
  note: string;
}

export interface SendReviewHealthResult extends SendSafeFlags {
  valid: boolean;
  send_review_health_state: SendReviewHealthState;
  status: SendReviewHealthState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSendReviewHealthContract(): SendReviewHealthContractDescriptor;
export function evaluateSendReviewHealth(inputs: unknown): SendReviewHealthResult;
