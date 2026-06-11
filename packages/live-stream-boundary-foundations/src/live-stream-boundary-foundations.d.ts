// @soltrade/live-stream-boundary-foundations — type declarations
//
// Read-only / advisory ONLY LIVE-STREAM BOUNDARY foundation for Stage-17 (the
// Phase-C opener). A live source is a DISABLED / READ-ONLY descriptor TAG ONLY;
// the activation seam DESCRIBES what activation would require and NEVER
// activates anything (LIVE_REQ_SEPARATE_ADAPTER_REVIEW is hardcoded unmet, so
// seam_ready_advisory is always false here); stream health and the readiness
// checklist are READ-MODELS that never write any operating state. No network
// primitive, no clock, no RNG, no environment, no filesystem, no secrets, no
// mutable module/global state. Provider secrets BY REFERENCE ONLY
// (provider_key_ref); raw credentials are refused with NAME-only redaction.
// Every identifier here is a LOCAL function-I/O contract identifier, NOT an
// SSOT name; SSOT Group 5 names are consumed-only input field names and SSOT
// Group 1 operating-state values are consumed-only advisory vocabulary.

export interface LiveSafeFlags {
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

// --- (A) Live-Source Descriptor Boundary ---

export type LiveSourceState =
  | 'LIVE_SOURCE_UNCONFIGURED'
  | 'LIVE_SOURCE_INVALID'
  | 'LIVE_SOURCE_READ_ONLY_OK';

export type LiveSourceTag =
  | 'live_helius_laserstream_disabled'
  | 'live_triton_yellowstone_disabled'
  | 'generic_grpc_stream_disabled'
  | 'fixture_stream'
  | 'mock_stream';

export interface LiveSourceBoundaryContractDescriptor extends LiveSafeFlags {
  contract: 'live-source-boundary';
  version: string;
  test_only: true;
  supported_states: readonly LiveSourceState[];
  supported_sources: readonly LiveSourceTag[];
  advisory_only: true;
  live_source_state: LiveSourceState;
  live_source_boundary_valid: boolean;
  stream_connected: false;
  connection_performed: false;
  provider_key_ref_present: boolean;
  status: LiveSourceState;
  reasons: readonly string[];
  note: string;
}

export interface LiveSourceBoundaryResult extends LiveSafeFlags {
  valid: boolean;
  live_source_boundary_valid: boolean;
  live_source_state: LiveSourceState;
  live_source: LiveSourceTag | null;
  provider_key_ref_present: boolean;
  stream_connected: false;
  connection_performed: false;
  activation_performed: false;
  status: LiveSourceState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeLiveSourceBoundaryContract(): LiveSourceBoundaryContractDescriptor;
export function evaluateLiveSourceBoundary(input: unknown): LiveSourceBoundaryResult;

// --- (B) Live-Activation Seam Descriptor ---

export type LiveSeamState =
  | 'LIVE_SEAM_UNCONFIGURED'
  | 'LIVE_SEAM_INVALID'
  | 'LIVE_SEAM_DESCRIPTOR';

export type LiveSeamRequirementToken =
  | 'LIVE_REQ_PROVIDER_KEY_REF'
  | 'LIVE_REQ_OWNER_APPROVAL_REF'
  | 'LIVE_REQ_READINESS_GREEN'
  | 'LIVE_REQ_SEPARATE_ADAPTER_REVIEW';

export interface LiveSeamRequirement {
  requirement: LiveSeamRequirementToken;
  met: boolean;
}

export interface LiveActivationSeamContractDescriptor extends LiveSafeFlags {
  contract: 'live-activation-seam';
  version: string;
  test_only: true;
  supported_states: readonly LiveSeamState[];
  supported_requirement_tokens: readonly LiveSeamRequirementToken[];
  advisory_only: true;
  live_seam_state: LiveSeamState;
  activation_performed: false;
  seam_ready_advisory: false;
  seam_requirements: readonly LiveSeamRequirement[];
  provider_key_ref_present: boolean;
  owner_approval_ref_present: boolean;
  status: LiveSeamState;
  reasons: readonly string[];
  note: string;
}

export interface LiveActivationSeamResult extends LiveSafeFlags {
  valid: boolean;
  live_seam_state: LiveSeamState;
  activation_performed: false;
  seam_ready_advisory: false;
  seam_requirements: readonly LiveSeamRequirement[];
  provider_key_ref_present: boolean;
  owner_approval_ref_present: boolean;
  status: LiveSeamState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeLiveActivationSeamContract(): LiveActivationSeamContractDescriptor;
export function evaluateLiveActivationSeam(input: unknown): LiveActivationSeamResult;

// --- (C) Stream-Health / Gap Read-Model ---

export type LiveStreamHealthState =
  | 'LIVE_STREAM_HEALTH_UNCONFIGURED'
  | 'LIVE_STREAM_HEALTH_INVALID'
  | 'LIVE_STREAM_HEALTH_SYNCED'
  | 'LIVE_STREAM_HEALTH_GAP_RECOVERABLE'
  | 'LIVE_STREAM_HEALTH_GAP_EXCEEDED'
  | 'LIVE_STREAM_HEALTH_DEGRADED';

export type LiveStreamAdvisoryToken =
  | 'LIVE_ADVISORY_NONE'
  | 'LIVE_ADVISORY_EXITS_ONLY_SHAPED';

export interface StreamHealthReadModelContractDescriptor extends LiveSafeFlags {
  contract: 'stream-health-read-model';
  version: string;
  test_only: true;
  supported_states: readonly LiveStreamHealthState[];
  supported_advisory_tokens: readonly LiveStreamAdvisoryToken[];
  advisory_only: true;
  read_model_only: true;
  stream_health_state: LiveStreamHealthState;
  live_stream_advisory: LiveStreamAdvisoryToken;
  gap_slots: number | null;
  status: LiveStreamHealthState;
  reasons: readonly string[];
  note: string;
}

export interface StreamHealthReadModelResult extends LiveSafeFlags {
  valid: boolean;
  stream_health_state: LiveStreamHealthState;
  live_stream_advisory: LiveStreamAdvisoryToken;
  gap_slots: number | null;
  read_model_only: true;
  status: LiveStreamHealthState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeStreamHealthReadModelContract(): StreamHealthReadModelContractDescriptor;
export function evaluateStreamHealthReadModel(input: unknown): StreamHealthReadModelResult;

// --- (D) Live-Readiness Checklist Read-Model ---

export type LiveReadinessState =
  | 'LIVE_READINESS_UNCONFIGURED'
  | 'LIVE_READINESS_INVALID'
  | 'LIVE_READINESS_CHECKLIST';

export type LiveReadinessItemToken =
  | 'LIVE_CHECK_PRIORITY_FEE_CACHE_WARM'
  | 'LIVE_CHECK_PROTOCOL_CONSTANTS_GREEN'
  | 'LIVE_CHECK_RPC_HEALTH_GREEN'
  | 'LIVE_CHECK_STREAM_SYNCED'
  | 'LIVE_CHECK_CALIBRATION_PRIORS_LOADED'
  | 'LIVE_CHECK_COST_PIPELINE_READY';

export interface LiveReadinessChecklistItem {
  item: LiveReadinessItemToken;
  met: boolean;
  reason: string;
}

export interface LiveReadinessChecklistContractDescriptor extends LiveSafeFlags {
  contract: 'live-readiness-checklist';
  version: string;
  test_only: true;
  supported_states: readonly LiveReadinessState[];
  supported_item_tokens: readonly LiveReadinessItemToken[];
  advisory_only: true;
  read_model_only: true;
  live_readiness_state: LiveReadinessState;
  checklist: readonly LiveReadinessChecklistItem[];
  all_met: boolean;
  status: LiveReadinessState;
  reasons: readonly string[];
  note: string;
}

export interface LiveReadinessChecklistResult extends LiveSafeFlags {
  valid: boolean;
  live_readiness_state: LiveReadinessState;
  checklist: readonly LiveReadinessChecklistItem[];
  all_met: boolean;
  read_model_only: true;
  status: LiveReadinessState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeLiveReadinessChecklistContract(): LiveReadinessChecklistContractDescriptor;
export function evaluateLiveReadinessChecklist(input: unknown): LiveReadinessChecklistResult;

// --- (E) Live Suppression ---

export type LiveSuppressionReasonCode =
  | 'live_source_invalid'
  | 'stream_gap_exceeded'
  | 'seam_not_ready'
  | 'live_surface_detected'
  | 'not_execution_authorized'
  | 'not_sign_authorized'
  | 'not_send_authorized';

export interface LiveSuppressionContractDescriptor extends LiveSafeFlags {
  contract: 'live-suppression';
  version: string;
  test_only: true;
  supported_reason_codes: readonly LiveSuppressionReasonCode[];
  advisory_only: true;
  suppressed: true;
  suppression_reasons: readonly LiveSuppressionReasonCode[];
  status: 'LIVE_SUPPRESSED';
  reasons: readonly LiveSuppressionReasonCode[];
  note: string;
}

export interface LiveSuppressionResult extends LiveSafeFlags {
  suppressed: true;
  suppression_reasons: readonly LiveSuppressionReasonCode[];
  status: 'LIVE_SUPPRESSED';
  reasons: readonly LiveSuppressionReasonCode[];
  advisory_only: true;
}

export function describeLiveSuppressionContract(): LiveSuppressionContractDescriptor;
export function evaluateLiveSuppression(input: unknown): LiveSuppressionResult;

// --- (F) Live Forbidden Surface Guard ---

export type LiveSurfaceState =
  | 'LIVE_SURFACE_UNCONFIGURED'
  | 'LIVE_SURFACE_CLEAN'
  | 'LIVE_SURFACE_BLOCKED';

export interface LiveForbiddenSurfaceContractDescriptor extends LiveSafeFlags {
  contract: 'live-forbidden-surface';
  version: string;
  test_only: true;
  supported_states: readonly LiveSurfaceState[];
  forbidden_field_names: readonly string[];
  advisory_only: true;
  live_surface_state: LiveSurfaceState;
  key_material_detected: boolean;
  credential_detected: boolean;
  live_surface_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: LiveSurfaceState;
  reasons: readonly string[];
  note: string;
}

export interface LiveForbiddenSurfaceResult extends LiveSafeFlags {
  live_surface_state: LiveSurfaceState;
  key_material_detected: boolean;
  credential_detected: boolean;
  live_surface_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: LiveSurfaceState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeLiveForbiddenSurfaceContract(): LiveForbiddenSurfaceContractDescriptor;
export function evaluateLiveForbiddenSurface(input: unknown): LiveForbiddenSurfaceResult;

// --- (G) Live-Boundary Health ---

export type LiveBoundaryHealthState =
  | 'LIVE_BOUNDARY_HEALTH_UNCONFIGURED'
  | 'LIVE_BOUNDARY_HEALTH_DEGRADED'
  | 'LIVE_BOUNDARY_HEALTH_REVIEWED_ADVISORY'
  | 'LIVE_BOUNDARY_HEALTH_SUPPRESSED'
  | 'LIVE_BOUNDARY_HEALTH_BLOCKED';

export interface LiveBoundaryHealthContractDescriptor extends LiveSafeFlags {
  contract: 'live-boundary-health';
  version: string;
  test_only: true;
  supported_states: readonly LiveBoundaryHealthState[];
  advisory_only: true;
  valid: boolean;
  live_boundary_health_state: LiveBoundaryHealthState;
  status: LiveBoundaryHealthState;
  reasons: readonly string[];
  note: string;
}

export interface LiveBoundaryHealthResult extends LiveSafeFlags {
  valid: boolean;
  live_boundary_health_state: LiveBoundaryHealthState;
  status: LiveBoundaryHealthState;
  reasons: readonly string[];
  advisory_only: true;
}

export function describeLiveBoundaryHealthContract(): LiveBoundaryHealthContractDescriptor;
export function evaluateLiveBoundaryHealth(inputs: unknown): LiveBoundaryHealthResult;
