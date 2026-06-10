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
