// @soltrade/pipeline-decision-trace-foundations — type declarations
//
// Read-only / advisory ONLY END-TO-END DECISION-TRACE foundation for Stage-13. It
// COMPOSES the already-computed TERMINAL RESULTS of Stages 6-12 (passed in as
// args) into (1) ONE deterministic ordered Decision Trace and (2) a full-pipeline
// health/status read-model. A decision-trace / pipeline-health read-model is a
// READ-ONLY ADVISORY REPRESENTATION ONLY — it does NOT run any stage, does NOT
// sign, does NOT send, does NOT broadcast; it is NEVER execution, a permission, or
// trading/signing/send readiness. Import-free, pure, deterministic: no clock, RNG,
// network, live stream, live quote, RPC/route call, signing, sending, broadcasting,
// persistence, secrets, or mutable module/global state. Every identifier here is a
// LOCAL function-I/O contract identifier, NOT an SSOT name.

export interface TraceSafeFlags {
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

export type PipelineTraceInputState =
  | 'PIPELINE_TRACE_INPUT_UNCONFIGURED'
  | 'PIPELINE_TRACE_INPUT_INVALID'
  | 'PIPELINE_TRACE_INPUT_DEGRADED'
  | 'PIPELINE_TRACE_INPUT_VALID';

export type PipelineTraceStage =
  | 'signal' | 'risk' | 'intent' | 'route' | 'signing_review' | 'send_review';

export type PipelineTraceOutcome =
  | 'reviewed_advisory_all_stages' | 'blocked_at_stage' | 'degraded' | 'unconfigured';

export type PipelineTraceDecisiveReason =
  | 'reviewed_advisory' | 'suppressed' | 'advanced_advisory'
  | 'stage_blocked' | 'stage_rejected' | 'stage_degraded'
  | 'stage_unconfigured' | 'stage_missing' | 'stage_invalid_result';

export type PipelineHealthState =
  | 'PIPELINE_HEALTH_UNCONFIGURED' | 'PIPELINE_HEALTH_BLOCKED'
  | 'PIPELINE_HEALTH_DEGRADED' | 'PIPELINE_HEALTH_SUPPRESSED'
  | 'PIPELINE_HEALTH_REVIEWED_ADVISORY';

export type PipelineDecisionState =
  | 'PIPELINE_DECISION_UNCONFIGURED' | 'PIPELINE_DECISION_DEGRADED'
  | 'PIPELINE_DECISION_BLOCKED' | 'PIPELINE_DECISION_REVIEWED_ADVISORY';

export type PipelineSurfaceState =
  | 'PIPELINE_SURFACE_UNCONFIGURED' | 'PIPELINE_SURFACE_CLEAN'
  | 'PIPELINE_SURFACE_BLOCKED';

export type PipelineDecisionHealthState =
  | 'PIPELINE_DECISION_HEALTH_UNCONFIGURED' | 'PIPELINE_DECISION_HEALTH_DEGRADED'
  | 'PIPELINE_DECISION_HEALTH_REVIEWED_ADVISORY' | 'PIPELINE_DECISION_HEALTH_SUPPRESSED'
  | 'PIPELINE_DECISION_HEALTH_BLOCKED';

export interface PipelineDecisionTraceInputBoundaryResult extends TraceSafeFlags {
  valid: boolean;
  pipeline_trace_input_boundary_valid: boolean;
  eligible_for_trace: boolean;
  pipeline_trace_input_state: PipelineTraceInputState;
  status: PipelineTraceInputState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PipelineTraceEntry {
  stage: PipelineTraceStage;
  stage_state: string;
  decisive_reason: PipelineTraceDecisiveReason;
  advanced: boolean;
  blocked: boolean;
}

export interface PipelineDecisionTraceResult extends TraceSafeFlags {
  overall_outcome: PipelineTraceOutcome;
  trace_entries: ReadonlyArray<PipelineTraceEntry>;
  status: PipelineTraceOutcome;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PipelineHealthReadModelResult extends TraceSafeFlags {
  valid: boolean;
  pipeline_health_state: PipelineHealthState;
  status: PipelineHealthState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PipelineDecisionVerdictResult extends TraceSafeFlags {
  valid: boolean;
  pipeline_decision_state: PipelineDecisionState;
  pipeline_decision_reviewed_advisory: boolean;
  pipeline_decision_blocked: boolean;
  overall_outcome: PipelineTraceOutcome;
  pipeline_health_state: PipelineHealthState;
  status: PipelineDecisionState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PipelineDecisionSuppressionResult extends TraceSafeFlags {
  suppressed: true;
  not_execution_authorized: true;
  not_sign_authorized: true;
  not_send_authorized: true;
  suppression_reasons: ReadonlyArray<string>;
  status: 'PIPELINE_DECISION_SUPPRESSED';
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PipelineForbiddenSurfaceResult extends TraceSafeFlags {
  pipeline_surface_state: PipelineSurfaceState;
  key_material_detected: boolean;
  live_surface_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: PipelineSurfaceState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PipelineDecisionHealthResult extends TraceSafeFlags {
  valid: boolean;
  pipeline_decision_health_state: PipelineDecisionHealthState;
  status: PipelineDecisionHealthState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export function describePipelineDecisionTraceInputBoundaryContract(): Readonly<Record<string, unknown>>;
export function evaluatePipelineDecisionTraceInputBoundary(input: unknown): PipelineDecisionTraceInputBoundaryResult;

export function describePipelineDecisionTraceContract(): Readonly<Record<string, unknown>>;
export function evaluatePipelineDecisionTrace(input: unknown): PipelineDecisionTraceResult;

export function describePipelineHealthReadModelContract(): Readonly<Record<string, unknown>>;
export function evaluatePipelineHealthReadModel(input: unknown): PipelineHealthReadModelResult;

export function describePipelineDecisionVerdictContract(): Readonly<Record<string, unknown>>;
export function evaluatePipelineDecisionVerdict(input: unknown): PipelineDecisionVerdictResult;

export function describePipelineDecisionSuppressionContract(): Readonly<Record<string, unknown>>;
export function evaluatePipelineDecisionSuppression(input: unknown): PipelineDecisionSuppressionResult;

export function describePipelineForbiddenSurfaceContract(): Readonly<Record<string, unknown>>;
export function evaluatePipelineForbiddenSurface(input: unknown): PipelineForbiddenSurfaceResult;

export function describePipelineDecisionHealthContract(): Readonly<Record<string, unknown>>;
export function evaluatePipelineDecisionHealth(inputs: unknown): PipelineDecisionHealthResult;
