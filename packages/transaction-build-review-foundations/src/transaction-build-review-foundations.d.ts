// @soltrade/transaction-build-review-foundations — type declarations
//
// Read-only / advisory ONLY TRANSACTION-BUILD-REVIEW foundation for Stage-10,
// consuming Stage-9 route / execution-plan-preview outputs. A tx-build
// review/descriptor is a READ-ONLY ADVISORY REPRESENTATION ONLY — NEVER a
// transaction, serialized transaction, message bytes, signing permission, send
// permission, or transaction/trading readiness. No network, live quote,
// aggregator/Jupiter/RPC route call, transaction build, serialization, signing,
// send, clock, persistence, secrets, or mutable module/global state. Every
// identifier here is a LOCAL function-I/O contract identifier, NOT an SSOT name.

export interface TxSafeFlags {
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
  can_send: false;
  can_broadcast: false;
  can_serialize: false;
  signing_permitted: false;
  broadcast_permitted: false;
  is_live: false;
  mainnet_enabled: false;
  real_live: false;
}

export interface TxValidationResult extends TxSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

// --- (C) Transaction-Build Input Boundary ---

export type TransactionBuildInputState =
  | 'TX_BUILD_INPUT_UNCONFIGURED'
  | 'TX_BUILD_INPUT_INVALID'
  | 'TX_BUILD_INPUT_DEGRADED'
  | 'TX_BUILD_INPUT_VALID';

export interface TransactionBuildInputBoundaryContractDescriptor extends TxSafeFlags {
  contract: 'transaction-build-input-boundary';
  version: string;
  test_only: true;
  supported_states: readonly TransactionBuildInputState[];
  advisory_only: true;
  tx_build_input_state: TransactionBuildInputState;
  tx_build_input_boundary_valid: boolean;
  eligible_for_tx_build_review: boolean;
  status: TransactionBuildInputState;
  reasons: readonly string[];
  note: string;
}

export interface TransactionBuildInputBoundaryResult extends TxSafeFlags {
  valid: boolean;
  tx_build_input_boundary_valid: boolean;
  eligible_for_tx_build_review: boolean;
  tx_build_input_state: TransactionBuildInputState;
  status: TransactionBuildInputState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeTransactionBuildInputBoundaryContract(): TransactionBuildInputBoundaryContractDescriptor;
export function validateTransactionBuildInputBoundary(input: unknown): TxValidationResult;
export function evaluateTransactionBuildInputBoundary(input: unknown): TransactionBuildInputBoundaryResult;

// --- (D) Transaction Build Source / Builder Boundary ---

export type TransactionBuildSourceState =
  | 'TX_BUILD_SOURCE_UNCONFIGURED'
  | 'TX_BUILD_SOURCE_INVALID'
  | 'TX_BUILD_SOURCE_READ_ONLY_OK';

export type TransactionBuildSourceTag =
  | 'mock_tx_build_metadata'
  | 'fixture_tx_build_metadata'
  | 'solana_tx_builder_disabled'
  | 'jupiter_tx_builder_disabled'
  | 'manual_tx_review_disabled';

export interface TransactionBuildSourceBoundaryContractDescriptor extends TxSafeFlags {
  contract: 'transaction-build-source-boundary';
  version: string;
  test_only: true;
  supported_states: readonly TransactionBuildSourceState[];
  supported_source_tags: readonly TransactionBuildSourceTag[];
  advisory_only: true;
  tx_build_source_valid: boolean;
  tx_build_source_state: TransactionBuildSourceState;
  builder_disabled: true;
  transaction_build_performed: false;
  serialization_performed: false;
  network_call_made: false;
  endpoint_resolved: false;
  status: TransactionBuildSourceState;
  reasons: readonly string[];
  note: string;
}

export interface TransactionBuildSourceBoundaryResult extends TxSafeFlags {
  valid: boolean;
  tx_build_source_valid: boolean;
  tx_build_source_state: TransactionBuildSourceState;
  builder_disabled: true;
  transaction_build_performed: false;
  serialization_performed: false;
  network_call_made: false;
  endpoint_resolved: false;
  status: TransactionBuildSourceState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeTransactionBuildSourceBoundaryContract(): TransactionBuildSourceBoundaryContractDescriptor;
export function validateTransactionBuildSourceBoundary(input: unknown): TxValidationResult;
export function evaluateTransactionBuildSourceBoundary(input: unknown): TransactionBuildSourceBoundaryResult;

// --- (E) Candidate Transaction Build Descriptor ---

export type CandidateTransactionBuildState =
  | 'CANDIDATE_TX_BUILD_UNCONFIGURED'
  | 'CANDIDATE_TX_BUILD_INVALID'
  | 'CANDIDATE_TX_BUILD_REJECTED'
  | 'CANDIDATE_TX_BUILD_DEGRADED'
  | 'CANDIDATE_TX_BUILD_DESCRIPTOR';

export interface CandidateTransactionBuildDescriptorContractDescriptor extends TxSafeFlags {
  contract: 'candidate-transaction-build-descriptor';
  version: string;
  test_only: true;
  supported_states: readonly CandidateTransactionBuildState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  candidate_tx_build_descriptor_valid: boolean;
  candidate_tx_build_state: CandidateTransactionBuildState;
  tx_build_review_ref: string | null;
  preview_ref: string | null;
  route_plan_ref: string | null;
  intent_record_ref: string | null;
  tx_build_kind: 'candidate_tx_build_descriptor';
  tx_build_reason_codes: readonly string[];
  status: CandidateTransactionBuildState;
  reasons: readonly string[];
  note: string;
}

export interface CandidateTransactionBuildDescriptorResult extends TxSafeFlags {
  candidate_tx_build_descriptor_valid: boolean;
  candidate_tx_build_state: CandidateTransactionBuildState;
  tx_build_review_ref: string | null;
  preview_ref: string | null;
  route_plan_ref: string | null;
  intent_record_ref: string | null;
  tx_build_kind: 'candidate_tx_build_descriptor';
  tx_build_reason_codes: readonly string[];
  status: CandidateTransactionBuildState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeCandidateTransactionBuildDescriptorContract(): CandidateTransactionBuildDescriptorContractDescriptor;
export function validateCandidateTransactionBuildDescriptorInput(input: unknown): TxValidationResult;
export function evaluateCandidateTransactionBuildDescriptor(input: unknown): CandidateTransactionBuildDescriptorResult;
