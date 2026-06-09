// @soltrade/intent-ledger-foundations — type declarations
//
// Read-only / advisory ONLY INTENT foundation for Stage-8, consuming Stage-7
// risk outputs. A candidate intent record is an AUDITABLE REPRESENTATION ONLY —
// NEVER an order, route, transaction, signing permission, send permission, or
// trading/route readiness. No network, clock, persistence, secrets, or mutable
// module/global state. Every identifier here is a LOCAL function-I/O contract
// identifier, NOT an SSOT name.

export interface IntentSafeFlags {
  read_only: true;
  has_secret: false;
  live_stream_enabled: false;
  network_call_made: false;
  endpoint_resolved: false;
  signal_ready: false;
  trading_ready: false;
  risk_ready: false;
  intent_ready: false;
  routing_ready: false;
  route_ready: false;
  order_ready: false;
  transaction_ready: false;
  can_send: false;
  can_broadcast: false;
  can_serialize: false;
  signing_permitted: false;
  broadcast_permitted: false;
  is_live: false;
  mainnet_enabled: false;
  real_live: false;
}

export interface IntentValidationResult extends IntentSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

// --- (C) Intent Input Boundary ---

export type IntentInputBoundaryState =
  | 'INTENT_INPUT_UNCONFIGURED'
  | 'INTENT_INPUT_INVALID'
  | 'INTENT_INPUT_DEGRADED'
  | 'INTENT_INPUT_VALID';

export interface IntentInputBoundaryContractDescriptor extends IntentSafeFlags {
  contract: 'intent-input-boundary';
  version: string;
  test_only: true;
  supported_states: readonly IntentInputBoundaryState[];
  advisory_only: true;
  intent_input_state: IntentInputBoundaryState;
  intent_input_boundary_valid: boolean;
  eligible_for_candidate_intent: boolean;
  status: IntentInputBoundaryState;
  reasons: readonly string[];
  note: string;
}

export interface IntentInputBoundaryResult extends IntentSafeFlags {
  valid: boolean;
  intent_input_boundary_valid: boolean;
  eligible_for_candidate_intent: boolean;
  intent_input_state: IntentInputBoundaryState;
  status: IntentInputBoundaryState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeIntentInputBoundaryContract(): IntentInputBoundaryContractDescriptor;
export function validateIntentInputBoundary(input: unknown): IntentValidationResult;
export function evaluateIntentInputBoundary(input: unknown): IntentInputBoundaryResult;

// --- (D) Candidate Intent Record ---

export type CandidateIntentState =
  | 'CANDIDATE_INTENT_UNCONFIGURED'
  | 'CANDIDATE_INTENT_INVALID'
  | 'CANDIDATE_INTENT_REJECTED'
  | 'CANDIDATE_INTENT_RECORDED';

export interface CandidateIntentRecordContractDescriptor extends IntentSafeFlags {
  contract: 'candidate-intent-record';
  version: string;
  test_only: true;
  supported_states: readonly CandidateIntentState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  candidate_intent_valid: boolean;
  candidate_intent_state: CandidateIntentState;
  intent_kind: 'candidate_trade_intent';
  intent_record_ref: string | null;
  wallet_ref: string | null;
  token_ref: string | null;
  risk_verdict_ref: string | null;
  signal_ref: string | null;
  reason_codes: readonly string[];
  status: CandidateIntentState;
  reasons: readonly string[];
  audit_required: true;
  note: string;
}

export interface CandidateIntentRecordResult extends IntentSafeFlags {
  candidate_intent_valid: boolean;
  candidate_intent_state: CandidateIntentState;
  intent_kind: 'candidate_trade_intent';
  intent_record_ref: string | null;
  wallet_ref: string | null;
  token_ref: string | null;
  risk_verdict_ref: string | null;
  signal_ref: string | null;
  reason_codes: readonly string[];
  status: CandidateIntentState;
  reasons: readonly string[];
  advisory_only: true;
  audit_required: true;
}

export function describeCandidateIntentRecordContract(): CandidateIntentRecordContractDescriptor;
export function validateCandidateIntentRecordInput(input: unknown): IntentValidationResult;
export function evaluateCandidateIntentRecord(input: unknown): CandidateIntentRecordResult;

// --- (E) Intent Ledger Append / Evaluate ---

export type IntentLedgerState =
  | 'INTENT_LEDGER_UNCONFIGURED'
  | 'INTENT_LEDGER_INVALID'
  | 'INTENT_LEDGER_DUPLICATE'
  | 'INTENT_LEDGER_APPEND_EVALUATED';

export interface IntentLedgerContractDescriptor extends IntentSafeFlags {
  contract: 'intent-ledger-append';
  version: string;
  test_only: true;
  supported_states: readonly IntentLedgerState[];
  advisory_only: true;
  append_valid: boolean;
  ledger_state: IntentLedgerState;
  ledger_record_count: number;
  appended_record_ref: string | null;
  duplicate_record_detected: boolean;
  audit_required: true;
  persistence_performed: false;
  status: IntentLedgerState;
  reasons: readonly string[];
  note: string;
}

export interface IntentLedgerAppendResult extends IntentSafeFlags {
  append_valid: boolean;
  ledger_state: IntentLedgerState;
  ledger_record_count: number;
  appended_record_ref: string | null;
  duplicate_record_detected: boolean;
  audit_required: true;
  persistence_performed: false;
  status: IntentLedgerState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeIntentLedgerContract(): IntentLedgerContractDescriptor;
export function validateIntentLedgerAppend(input: unknown): IntentValidationResult;
export function evaluateIntentLedgerAppend(input: unknown): IntentLedgerAppendResult;

// --- (F) Intent State Machine ---

export type IntentStateMachineState =
  | 'INTENT_UNCONFIGURED'
  | 'INTENT_CANDIDATE_RECORDED'
  | 'INTENT_REJECTED'
  | 'INTENT_SUPPRESSED'
  | 'INTENT_BLOCKED'
  | 'INTENT_AWAITING_ROUTE_REVIEW';

export type IntentStateTransition =
  | 'record'
  | 'reject'
  | 'suppress'
  | 'request_route_review';

export interface IntentStateMachineContractDescriptor extends IntentSafeFlags {
  contract: 'intent-state-machine';
  version: string;
  test_only: true;
  supported_states: readonly IntentStateMachineState[];
  supported_transitions: readonly IntentStateTransition[];
  advisory_only: true;
  valid: boolean;
  intent_state: IntentStateMachineState;
  awaiting_route_review: boolean;
  status: IntentStateMachineState;
  reasons: readonly string[];
  note: string;
}

export interface IntentStateMachineResult extends IntentSafeFlags {
  valid: boolean;
  intent_state: IntentStateMachineState;
  awaiting_route_review: boolean;
  status: IntentStateMachineState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeIntentStateMachineContract(): IntentStateMachineContractDescriptor;
export function evaluateIntentStateTransition(input: unknown): IntentStateMachineResult;

// --- (G) Intent Audit Envelope ---

export type IntentAuditState =
  | 'INTENT_AUDIT_UNCONFIGURED'
  | 'INTENT_AUDIT_INVALID'
  | 'INTENT_AUDIT_VALID';

export interface IntentAuditEnvelopeContractDescriptor extends IntentSafeFlags {
  contract: 'intent-audit-envelope';
  version: string;
  test_only: true;
  supported_states: readonly IntentAuditState[];
  advisory_only: true;
  intent_audit_valid: boolean;
  audit_state: IntentAuditState;
  audit_required: true;
  audit_complete: boolean;
  status: IntentAuditState;
  reasons: readonly string[];
  note: string;
}

export interface IntentAuditEnvelopeResult extends IntentSafeFlags {
  intent_audit_valid: boolean;
  audit_state: IntentAuditState;
  audit_required: true;
  audit_complete: boolean;
  status: IntentAuditState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeIntentAuditEnvelopeContract(): IntentAuditEnvelopeContractDescriptor;
export function validateIntentAuditEnvelope(input: unknown): IntentValidationResult;
export function evaluateIntentAuditEnvelope(input: unknown): IntentAuditEnvelopeResult;

// --- (H) Intent Suppression / Rejection ---

export interface IntentSuppressionContractDescriptor extends IntentSafeFlags {
  contract: 'intent-suppression';
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

export interface IntentSuppressionResult extends IntentSafeFlags {
  suppressed: boolean;
  suppression_reasons: readonly string[];
  status: string;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeIntentSuppressionContract(): IntentSuppressionContractDescriptor;
export function evaluateIntentSuppression(input: unknown): IntentSuppressionResult;

// --- (I) Intent Health / Status ---

export type IntentHealthState =
  | 'INTENT_HEALTH_UNCONFIGURED'
  | 'INTENT_HEALTH_DEGRADED'
  | 'INTENT_HEALTH_CANDIDATE_RECORDED'
  | 'INTENT_HEALTH_AWAITING_ROUTE_REVIEW'
  | 'INTENT_HEALTH_SUPPRESSED'
  | 'INTENT_HEALTH_BLOCKED';

export interface IntentHealthContractDescriptor extends IntentSafeFlags {
  contract: 'intent-health';
  version: string;
  test_only: true;
  supported_states: readonly IntentHealthState[];
  advisory_only: true;
  valid: boolean;
  intent_health_state: IntentHealthState;
  status: IntentHealthState;
  reasons: readonly string[];
  note: string;
}

export interface IntentHealthResult extends IntentSafeFlags {
  valid: boolean;
  intent_health_state: IntentHealthState;
  status: IntentHealthState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeIntentHealthContract(): IntentHealthContractDescriptor;
export function evaluateIntentHealth(inputs: unknown): IntentHealthResult;
