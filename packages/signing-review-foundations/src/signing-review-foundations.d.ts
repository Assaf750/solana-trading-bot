// @soltrade/signing-review-foundations — type declarations
//
// Read-only / advisory ONLY SIGNING-REVIEW foundation for Stage-11, consuming
// Stage-10 transaction-build-review outputs. A signing-review / descriptor is a
// READ-ONLY ADVISORY REPRESENTATION ONLY — it REVIEWS signing PREREQUISITES from
// safe metadata; it is NEVER signing, a signature, a private key, key material, a
// signing permission, a send permission, or signing/trading readiness. No
// network, live quote, aggregator/Jupiter/RPC route call, real signing,
// SignerService activation, key loading, transaction build, serialization,
// signing, send, clock, persistence, secrets, or mutable module/global state.
// Every identifier here is a LOCAL function-I/O contract identifier, NOT an SSOT
// name.

export interface SignSafeFlags {
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

export interface SignValidationResult extends SignSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

// --- (C) Signing-Review Input Boundary ---

export type SigningReviewInputState =
  | 'SIGNING_REVIEW_INPUT_UNCONFIGURED'
  | 'SIGNING_REVIEW_INPUT_INVALID'
  | 'SIGNING_REVIEW_INPUT_DEGRADED'
  | 'SIGNING_REVIEW_INPUT_VALID';

export interface SigningReviewInputBoundaryContractDescriptor extends SignSafeFlags {
  contract: 'signing-review-input-boundary';
  version: string;
  test_only: true;
  supported_states: readonly SigningReviewInputState[];
  advisory_only: true;
  signing_review_input_state: SigningReviewInputState;
  signing_review_input_boundary_valid: boolean;
  eligible_for_signing_review: boolean;
  status: SigningReviewInputState;
  reasons: readonly string[];
  note: string;
}

export interface SigningReviewInputBoundaryResult extends SignSafeFlags {
  valid: boolean;
  signing_review_input_boundary_valid: boolean;
  eligible_for_signing_review: boolean;
  signing_review_input_state: SigningReviewInputState;
  status: SigningReviewInputState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSigningReviewInputBoundaryContract(): SigningReviewInputBoundaryContractDescriptor;
export function validateSigningReviewInputBoundary(input: unknown): SignValidationResult;
export function evaluateSigningReviewInputBoundary(input: unknown): SigningReviewInputBoundaryResult;

// --- (D) Signer Profile / Custody Boundary ---

export type SignerCustodyState =
  | 'SIGNER_CUSTODY_UNCONFIGURED'
  | 'SIGNER_CUSTODY_INVALID'
  | 'SIGNER_CUSTODY_READ_ONLY_OK';

export type SignerCustodySource =
  | 'mock_signer_metadata'
  | 'fixture_signer_metadata'
  | 'isolated_signer_disabled'
  | 'connected_wallet_disabled'
  | 'manual_signing_review_disabled';

export interface SignerCustodyBoundaryContractDescriptor extends SignSafeFlags {
  contract: 'signer-custody-boundary';
  version: string;
  test_only: true;
  supported_states: readonly SignerCustodyState[];
  supported_sources: readonly SignerCustodySource[];
  advisory_only: true;
  signer_custody_boundary_valid: boolean;
  signer_custody_state: SignerCustodyState;
  signer_disabled: true;
  signing_performed: false;
  key_loaded: false;
  key_material_present: false;
  network_call_made: false;
  endpoint_resolved: false;
  status: SignerCustodyState;
  reasons: readonly string[];
  note: string;
}

export interface SignerCustodyBoundaryResult extends SignSafeFlags {
  valid: boolean;
  signer_custody_boundary_valid: boolean;
  signer_custody_state: SignerCustodyState;
  signer_disabled: true;
  signing_performed: false;
  key_loaded: false;
  key_material_present: false;
  network_call_made: false;
  endpoint_resolved: false;
  status: SignerCustodyState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSignerCustodyBoundaryContract(): SignerCustodyBoundaryContractDescriptor;
export function validateSignerCustodyBoundary(input: unknown): SignValidationResult;
export function evaluateSignerCustodyBoundary(input: unknown): SignerCustodyBoundaryResult;

// --- (E) Candidate Signing-Review Descriptor ---

export type CandidateSigningReviewState =
  | 'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED'
  | 'CANDIDATE_SIGNING_REVIEW_INVALID'
  | 'CANDIDATE_SIGNING_REVIEW_REJECTED'
  | 'CANDIDATE_SIGNING_REVIEW_DEGRADED'
  | 'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR';

export interface CandidateSigningReviewDescriptorContractDescriptor extends SignSafeFlags {
  contract: 'candidate-signing-review-descriptor';
  version: string;
  test_only: true;
  supported_states: readonly CandidateSigningReviewState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  candidate_signing_review_valid: boolean;
  candidate_signing_review_state: CandidateSigningReviewState;
  signing_review_ref: string | null;
  tx_build_review_ref: string | null;
  intent_record_ref: string | null;
  signing_review_kind: 'candidate_signing_review_descriptor';
  signing_review_reason_codes: readonly string[];
  status: CandidateSigningReviewState;
  reasons: readonly string[];
  note: string;
}

export interface CandidateSigningReviewDescriptorResult extends SignSafeFlags {
  candidate_signing_review_valid: boolean;
  candidate_signing_review_state: CandidateSigningReviewState;
  signing_review_ref: string | null;
  tx_build_review_ref: string | null;
  intent_record_ref: string | null;
  signing_review_kind: 'candidate_signing_review_descriptor';
  signing_review_reason_codes: readonly string[];
  status: CandidateSigningReviewState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeCandidateSigningReviewDescriptorContract(): CandidateSigningReviewDescriptorContractDescriptor;
export function validateCandidateSigningReviewDescriptorInput(input: unknown): SignValidationResult;
export function evaluateCandidateSigningReviewDescriptor(input: unknown): CandidateSigningReviewDescriptorResult;

// --- (F) Signer / Key-Custody Readiness Advisory ---

export type SignerCustodyReadinessState =
  | 'SIGNER_CUSTODY_READINESS_UNCONFIGURED'
  | 'SIGNER_CUSTODY_READINESS_INVALID'
  | 'SIGNER_CUSTODY_READINESS_DEGRADED'
  | 'SIGNER_CUSTODY_READINESS_REJECTED'
  | 'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY';

export interface SignerCustodyReadinessAdvisoryInput {
  purpose: 'signer_custody_readiness_input';
  key_custody_mode_bucket: 'unknown' | 'connected_wallet' | 'isolated_signer';
  signer_profile_status_bucket: 'unknown' | 'active' | 'disabled' | 'revoked' | 'degraded';
  dual_control_bucket: 'unknown' | 'not_required' | 'required_unsatisfied' | 'required_satisfied';
  signer_reachability_bucket: 'unknown' | 'unreachable' | 'reachable';
  custody_verification_bucket: 'unknown' | 'unverified' | 'verified';
}

export interface SignerCustodyReadinessAdvisoryContractDescriptor extends SignSafeFlags {
  contract: 'signer-custody-readiness-advisory';
  version: string;
  test_only: true;
  supported_states: readonly SignerCustodyReadinessState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  valid: boolean;
  signer_custody_readiness_state: SignerCustodyReadinessState;
  signer_custody_acceptable_advisory: boolean;
  signer_custody_rejected: boolean;
  signing_review_reason_codes: readonly string[];
  status: SignerCustodyReadinessState;
  reasons: readonly string[];
  note: string;
}

export interface SignerCustodyReadinessAdvisoryResult extends SignSafeFlags {
  valid: boolean;
  signer_custody_readiness_state: SignerCustodyReadinessState;
  signer_custody_acceptable_advisory: boolean;
  signer_custody_rejected: boolean;
  signing_review_reason_codes: readonly string[];
  status: SignerCustodyReadinessState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSignerCustodyReadinessAdvisoryContract(): SignerCustodyReadinessAdvisoryContractDescriptor;
export function validateSignerCustodyReadinessAdvisoryInput(input: unknown): SignValidationResult;
export function evaluateSignerCustodyReadinessAdvisory(input: unknown): SignerCustodyReadinessAdvisoryResult;

// --- (G) Private-Key Forbidden Surface Guard ---

export type PrivateKeySurfaceState =
  | 'PRIVATE_KEY_SURFACE_UNCONFIGURED'
  | 'PRIVATE_KEY_SURFACE_CLEAN'
  | 'PRIVATE_KEY_SURFACE_BLOCKED';

export interface PrivateKeyForbiddenSurfaceContractDescriptor extends SignSafeFlags {
  contract: 'private-key-forbidden-surface';
  version: string;
  test_only: true;
  supported_states: readonly PrivateKeySurfaceState[];
  forbidden_field_names: readonly string[];
  advisory_only: true;
  private_key_surface_state: PrivateKeySurfaceState;
  key_material_detected: boolean;
  private_key_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: PrivateKeySurfaceState;
  reasons: readonly string[];
  note: string;
}

export interface PrivateKeyForbiddenSurfaceResult extends SignSafeFlags {
  private_key_surface_state: PrivateKeySurfaceState;
  key_material_detected: boolean;
  private_key_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: PrivateKeySurfaceState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describePrivateKeyForbiddenSurfaceContract(): PrivateKeyForbiddenSurfaceContractDescriptor;
export function evaluatePrivateKeyForbiddenSurface(input: unknown): PrivateKeyForbiddenSurfaceResult;

// --- (H) Signing-Review Verdict ---

export type SigningReviewVerdictState =
  | 'SIGNING_REVIEW_UNCONFIGURED'
  | 'SIGNING_REVIEW_DEGRADED'
  | 'SIGNING_REVIEW_BLOCKED'
  | 'SIGNING_REVIEW_PASS_ADVISORY';

export interface SigningReviewVerdictContractDescriptor extends SignSafeFlags {
  contract: 'signing-review-verdict';
  version: string;
  test_only: true;
  supported_states: readonly SigningReviewVerdictState[];
  supported_reason_codes: readonly string[];
  supported_explanation_codes: readonly string[];
  advisory_only: true;
  valid: boolean;
  signing_review_state: SigningReviewVerdictState;
  signing_review_passed_advisory: boolean;
  signing_review_blocked: boolean;
  signing_review_reason_codes: readonly string[];
  signing_review_explanation_codes: readonly string[];
  status: SigningReviewVerdictState;
  reasons: readonly string[];
  note: string;
}

export interface SigningReviewVerdictResult extends SignSafeFlags {
  valid: boolean;
  signing_review_state: SigningReviewVerdictState;
  signing_review_passed_advisory: boolean;
  signing_review_blocked: boolean;
  signing_review_reason_codes: readonly string[];
  signing_review_explanation_codes: readonly string[];
  status: SigningReviewVerdictState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSigningReviewVerdictContract(): SigningReviewVerdictContractDescriptor;
export function evaluateSigningReviewVerdict(input: unknown): SigningReviewVerdictResult;

// --- (I) Signing-Review Suppression / Rejection ---

export interface SigningReviewSuppressionContractDescriptor extends SignSafeFlags {
  contract: 'signing-review-suppression';
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

export interface SigningReviewSuppressionResult extends SignSafeFlags {
  suppressed: boolean;
  suppression_reasons: readonly string[];
  status: string;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSigningReviewSuppressionContract(): SigningReviewSuppressionContractDescriptor;
export function evaluateSigningReviewSuppression(input: unknown): SigningReviewSuppressionResult;

// --- (J) Signing-Review Health / Status ---

export type SigningReviewHealthState =
  | 'SIGNING_REVIEW_HEALTH_UNCONFIGURED'
  | 'SIGNING_REVIEW_HEALTH_DEGRADED'
  | 'SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY'
  | 'SIGNING_REVIEW_HEALTH_SUPPRESSED'
  | 'SIGNING_REVIEW_HEALTH_BLOCKED';

export interface SigningReviewHealthContractDescriptor extends SignSafeFlags {
  contract: 'signing-review-health';
  version: string;
  test_only: true;
  supported_states: readonly SigningReviewHealthState[];
  advisory_only: true;
  valid: boolean;
  signing_review_health_state: SigningReviewHealthState;
  status: SigningReviewHealthState;
  reasons: readonly string[];
  note: string;
}

export interface SigningReviewHealthResult extends SignSafeFlags {
  valid: boolean;
  signing_review_health_state: SigningReviewHealthState;
  status: SigningReviewHealthState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeSigningReviewHealthContract(): SigningReviewHealthContractDescriptor;
export function evaluateSigningReviewHealth(inputs: unknown): SigningReviewHealthResult;
