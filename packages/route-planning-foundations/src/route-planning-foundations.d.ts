// @soltrade/route-planning-foundations — type declarations
//
// Read-only / advisory ONLY ROUTE-PLANNING foundation for Stage-9, consuming
// Stage-8 intent-ledger outputs. A candidate route plan is a READ-ONLY ADVISORY
// REPRESENTATION ONLY — NEVER an order, transaction, signing permission, send
// permission, or trading/transaction readiness. No network, live quote,
// aggregator/Jupiter/RPC route call, transaction build, clock, persistence,
// secrets, or mutable module/global state. Every identifier here is a LOCAL
// function-I/O contract identifier, NOT an SSOT name.

export interface RouteSafeFlags {
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
  can_send: false;
  can_broadcast: false;
  can_serialize: false;
  signing_permitted: false;
  broadcast_permitted: false;
  is_live: false;
  mainnet_enabled: false;
  real_live: false;
}

export interface RouteValidationResult extends RouteSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

// --- (C) Route Input Boundary ---

export type RouteInputBoundaryState =
  | 'ROUTE_INPUT_UNCONFIGURED'
  | 'ROUTE_INPUT_INVALID'
  | 'ROUTE_INPUT_DEGRADED'
  | 'ROUTE_INPUT_VALID';

export interface RouteInputBoundaryContractDescriptor extends RouteSafeFlags {
  contract: 'route-input-boundary';
  version: string;
  test_only: true;
  supported_states: readonly RouteInputBoundaryState[];
  advisory_only: true;
  route_input_state: RouteInputBoundaryState;
  route_input_boundary_valid: boolean;
  eligible_for_route_review: boolean;
  status: RouteInputBoundaryState;
  reasons: readonly string[];
  note: string;
}

export interface RouteInputBoundaryResult extends RouteSafeFlags {
  valid: boolean;
  route_input_boundary_valid: boolean;
  eligible_for_route_review: boolean;
  route_input_state: RouteInputBoundaryState;
  status: RouteInputBoundaryState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRouteInputBoundaryContract(): RouteInputBoundaryContractDescriptor;
export function validateRouteInputBoundary(input: unknown): RouteValidationResult;
export function evaluateRouteInputBoundary(input: unknown): RouteInputBoundaryResult;

// --- (D) Route Source / Provider Boundary ---

export type RouteSourceState =
  | 'ROUTE_SOURCE_UNCONFIGURED'
  | 'ROUTE_SOURCE_INVALID'
  | 'ROUTE_SOURCE_READ_ONLY_OK';

export type RouteSourceTag =
  | 'mock_route_metadata'
  | 'fixture_route_metadata'
  | 'jupiter_disabled'
  | 'aggregator_disabled'
  | 'manual_route_review_disabled';

export interface RouteSourceBoundaryContractDescriptor extends RouteSafeFlags {
  contract: 'route-source-boundary';
  version: string;
  test_only: true;
  supported_states: readonly RouteSourceState[];
  supported_source_tags: readonly RouteSourceTag[];
  advisory_only: true;
  route_source_valid: boolean;
  route_source_state: RouteSourceState;
  provider_disabled: true;
  status: RouteSourceState;
  reasons: readonly string[];
  note: string;
}

export interface RouteSourceBoundaryResult extends RouteSafeFlags {
  valid: boolean;
  route_source_valid: boolean;
  route_source_state: RouteSourceState;
  provider_disabled: true;
  status: RouteSourceState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRouteSourceBoundaryContract(): RouteSourceBoundaryContractDescriptor;
export function validateRouteSourceBoundary(input: unknown): RouteValidationResult;
export function evaluateRouteSourceBoundary(input: unknown): RouteSourceBoundaryResult;

// --- (E) Candidate Route Plan ---

export type CandidateRouteState =
  | 'CANDIDATE_ROUTE_UNCONFIGURED'
  | 'CANDIDATE_ROUTE_INVALID'
  | 'CANDIDATE_ROUTE_REJECTED'
  | 'CANDIDATE_ROUTE_CANDIDATE';

export interface CandidateRoutePlanContractDescriptor extends RouteSafeFlags {
  contract: 'candidate-route-plan';
  version: string;
  test_only: true;
  supported_states: readonly CandidateRouteState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  candidate_route_valid: boolean;
  candidate_route_state: CandidateRouteState;
  route_plan_ref: string | null;
  intent_record_ref: string | null;
  route_kind: 'candidate_route_plan';
  route_reason_codes: readonly string[];
  status: CandidateRouteState;
  reasons: readonly string[];
  note: string;
}

export interface CandidateRoutePlanResult extends RouteSafeFlags {
  candidate_route_valid: boolean;
  candidate_route_state: CandidateRouteState;
  route_plan_ref: string | null;
  intent_record_ref: string | null;
  route_kind: 'candidate_route_plan';
  route_reason_codes: readonly string[];
  status: CandidateRouteState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeCandidateRoutePlanContract(): CandidateRoutePlanContractDescriptor;
export function validateCandidateRoutePlanInput(input: unknown): RouteValidationResult;
export function evaluateCandidateRoutePlan(input: unknown): CandidateRoutePlanResult;

// --- (F) Route Feasibility / Slippage Advisory ---

export type RouteFeasibilityState =
  | 'ROUTE_FEASIBILITY_UNCONFIGURED'
  | 'ROUTE_FEASIBILITY_INVALID'
  | 'ROUTE_FEASIBILITY_DEGRADED'
  | 'ROUTE_FEASIBILITY_REJECTED'
  | 'ROUTE_FEASIBILITY_FEASIBLE_ADVISORY';

export interface RouteFeasibilityContractDescriptor extends RouteSafeFlags {
  contract: 'route-feasibility-advisory';
  version: string;
  test_only: true;
  supported_states: readonly RouteFeasibilityState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  valid: boolean;
  route_feasibility_state: RouteFeasibilityState;
  route_feasible_advisory: boolean;
  route_rejected: boolean;
  route_reason_codes: readonly string[];
  status: RouteFeasibilityState;
  reasons: readonly string[];
  note: string;
}

export interface RouteFeasibilityResult extends RouteSafeFlags {
  valid: boolean;
  route_feasibility_state: RouteFeasibilityState;
  route_feasible_advisory: boolean;
  route_rejected: boolean;
  route_reason_codes: readonly string[];
  status: RouteFeasibilityState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRouteFeasibilityContract(): RouteFeasibilityContractDescriptor;
export function validateRouteFeasibilityInput(input: unknown): RouteValidationResult;
export function evaluateRouteFeasibility(input: unknown): RouteFeasibilityResult;

// --- (G) Execution Plan Preview ---

export type ExecutionPlanPreviewState =
  | 'EXECUTION_PLAN_PREVIEW_UNCONFIGURED'
  | 'EXECUTION_PLAN_PREVIEW_INVALID'
  | 'EXECUTION_PLAN_PREVIEW_REJECTED'
  | 'EXECUTION_PLAN_PREVIEW_SUPPRESSED'
  | 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID';

export interface ExecutionPlanPreviewContractDescriptor extends RouteSafeFlags {
  contract: 'execution-plan-preview';
  version: string;
  test_only: true;
  supported_states: readonly ExecutionPlanPreviewState[];
  supported_reason_codes: readonly string[];
  advisory_only: true;
  execution_plan_preview_valid: boolean;
  execution_plan_preview_state: ExecutionPlanPreviewState;
  preview_ref: string | null;
  route_plan_ref: string | null;
  intent_record_ref: string | null;
  preview_reason_codes: readonly string[];
  requires_next_stage: 'transaction_build_review';
  status: ExecutionPlanPreviewState;
  reasons: readonly string[];
  note: string;
}

export interface ExecutionPlanPreviewResult extends RouteSafeFlags {
  execution_plan_preview_valid: boolean;
  execution_plan_preview_state: ExecutionPlanPreviewState;
  preview_ref: string | null;
  route_plan_ref: string | null;
  intent_record_ref: string | null;
  preview_reason_codes: readonly string[];
  requires_next_stage: 'transaction_build_review';
  status: ExecutionPlanPreviewState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeExecutionPlanPreviewContract(): ExecutionPlanPreviewContractDescriptor;
export function validateExecutionPlanPreviewInput(input: unknown): RouteValidationResult;
export function evaluateExecutionPlanPreview(input: unknown): ExecutionPlanPreviewResult;

// --- (H) Route Suppression / Rejection ---

export interface RouteSuppressionContractDescriptor extends RouteSafeFlags {
  contract: 'route-suppression';
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

export interface RouteSuppressionResult extends RouteSafeFlags {
  suppressed: boolean;
  suppression_reasons: readonly string[];
  status: string;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRouteSuppressionContract(): RouteSuppressionContractDescriptor;
export function evaluateRouteSuppression(input: unknown): RouteSuppressionResult;

// --- (I) Route Health / Status ---

export type RouteHealthState =
  | 'ROUTE_HEALTH_UNCONFIGURED'
  | 'ROUTE_HEALTH_DEGRADED'
  | 'ROUTE_HEALTH_CANDIDATE_REVIEWED'
  | 'ROUTE_HEALTH_PREVIEW_READY'
  | 'ROUTE_HEALTH_SUPPRESSED'
  | 'ROUTE_HEALTH_BLOCKED';

export interface RouteHealthContractDescriptor extends RouteSafeFlags {
  contract: 'route-health';
  version: string;
  test_only: true;
  supported_states: readonly RouteHealthState[];
  advisory_only: true;
  valid: boolean;
  route_health_state: RouteHealthState;
  status: RouteHealthState;
  reasons: readonly string[];
  note: string;
}

export interface RouteHealthResult extends RouteSafeFlags {
  valid: boolean;
  route_health_state: RouteHealthState;
  status: RouteHealthState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeRouteHealthContract(): RouteHealthContractDescriptor;
export function evaluateRouteHealth(inputs: unknown): RouteHealthResult;
