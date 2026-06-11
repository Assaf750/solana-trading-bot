// @soltrade/testnet-send-boundary-foundations — type declarations
//
// Read-only / advisory ONLY TESTNET-SEND BOUNDARY foundation for Stage-21. Builds
// everything UP TO the testnet-broadcast activation seam and NOTHING past it,
// mirroring the Stage-17 live-stream boundary. The activation seam is NEVER ready:
// TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION is hardcoded met:false, so
// send_ready_advisory and can_send can NEVER be true in-package. NO live network
// primitive, NO signing/crypto primitive, NO signature produced; consumes only a
// Stage-19 signature DESCRIPTOR (presence/shape, opaque) and NEVER re-signs.
// Secrets BY REFERENCE only (opaque endpoint_ref); raw key/endpoint/url/api_key
// refused with NAME-only redaction. MAINNET HARD-REFUSAL: any mainnet token (incl.
// nested) -> refuse; cluster must be an explicit devnet|testnet|localnet enum tag.
// Every identifier here is a LOCAL function-I/O contract identifier, NOT an SSOT
// name; SSOT Group 3 failure_type/bundle_status are consumed-only by VALUE.

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

export type TestnetSendInputState =
  | 'TESTNET_SEND_INPUT_UNCONFIGURED'
  | 'TESTNET_SEND_INPUT_INVALID'
  | 'TESTNET_SEND_INPUT_DEGRADED'
  | 'TESTNET_SEND_INPUT_VALID';

export type TestnetSeamState =
  | 'TESTNET_SEAM_UNCONFIGURED'
  | 'TESTNET_SEAM_INVALID'
  | 'TESTNET_SEAM_DESCRIPTOR';

export type TestnetIdempotencyState =
  | 'TESTNET_IDEMPOTENCY_UNCONFIGURED'
  | 'TESTNET_IDEMPOTENCY_INVALID'
  | 'TESTNET_IDEMPOTENCY_FIRST_SEEN'
  | 'TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED';

export type TestnetFailedSendState =
  | 'TESTNET_FAILED_SEND_UNCONFIGURED'
  | 'TESTNET_FAILED_SEND_INVALID'
  | 'TESTNET_FAILED_SEND_CLASSIFIED';

export type TestnetBundleState =
  | 'TESTNET_BUNDLE_UNCONFIGURED'
  | 'TESTNET_BUNDLE_INVALID'
  | 'TESTNET_BUNDLE_OBSERVED';

export type TestnetSurfaceState =
  | 'TESTNET_SURFACE_UNCONFIGURED'
  | 'TESTNET_SURFACE_CLEAN'
  | 'TESTNET_SURFACE_BLOCKED';

export type TestnetSendHealthState =
  | 'TESTNET_SEND_HEALTH_UNCONFIGURED'
  | 'TESTNET_SEND_HEALTH_DEGRADED'
  | 'TESTNET_SEND_HEALTH_REVIEWED_ADVISORY'
  | 'TESTNET_SEND_HEALTH_SUPPRESSED'
  | 'TESTNET_SEND_HEALTH_BLOCKED';

export interface SeamRequirement {
  requirement: string;
  met: boolean;
}

// (A)
export function describeTestnetSendInputBoundaryContract(): Readonly<Record<string, unknown>> & SendSafeFlags;
export function evaluateTestnetSendInputBoundary(input: unknown): Readonly<{
  valid: boolean;
  testnet_send_input_state: TestnetSendInputState;
  eligible_for_testnet_send: boolean;
  cluster_tag: string | null;
  status: TestnetSendInputState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}> & SendSafeFlags;

// (B)
export function describeTestnetActivationSeamContract(): Readonly<Record<string, unknown>> & SendSafeFlags;
export function evaluateTestnetActivationSeam(input: unknown): Readonly<{
  valid: boolean;
  testnet_seam_state: TestnetSeamState;
  activation_performed: false;
  send_ready_advisory: false;
  seam_requirements: ReadonlyArray<SeamRequirement>;
  endpoint_in_repo: false;
  key_in_repo: false;
  secret_in_repo: false;
  endpoint_ref_present: boolean;
  owner_broadcast_caller_present: boolean;
  funded_testnet_wallet_present: boolean;
  required_owner_inputs: ReadonlyArray<string>;
  status: TestnetSeamState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}> & SendSafeFlags;

// (C)
export function describeTestnetSendIdempotencyContract(): Readonly<Record<string, unknown>> & SendSafeFlags;
export function evaluateTestnetSendIdempotency(input: unknown): Readonly<{
  valid: boolean;
  testnet_idempotency_state: TestnetIdempotencyState;
  is_duplicate: boolean;
  authorizes_send: false;
  read_model_only: true;
  status: TestnetIdempotencyState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}> & SendSafeFlags;

// (D)
export function describeTestnetFailedSendClassContract(): Readonly<Record<string, unknown>> & SendSafeFlags;
export function evaluateTestnetFailedSendClass(input: unknown): Readonly<{
  valid: boolean;
  testnet_failed_send_state: TestnetFailedSendState;
  failure_type: string | null;
  read_model_only: true;
  status: TestnetFailedSendState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}> & SendSafeFlags;

// (E)
export function describeTestnetBundleStatusContract(): Readonly<Record<string, unknown>> & SendSafeFlags;
export function evaluateTestnetBundleStatus(input: unknown): Readonly<{
  valid: boolean;
  testnet_bundle_state: TestnetBundleState;
  bundle_status: string | null;
  stale_detected: boolean;
  read_model_only: true;
  status: TestnetBundleState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}> & SendSafeFlags;

// (F)
export function describeTestnetSendSuppressionContract(): Readonly<Record<string, unknown>> & SendSafeFlags;
export function evaluateTestnetSendSuppression(input: unknown): Readonly<{
  suppressed: true;
  suppression_reasons: ReadonlyArray<string>;
  status: 'TESTNET_SEND_SUPPRESSED';
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}> & SendSafeFlags;

// (G)
export function isValidEndpointRef(ref: unknown): boolean;
export function describeTestnetForbiddenSurfaceContract(): Readonly<Record<string, unknown>> & SendSafeFlags;
export function evaluateTestnetForbiddenSurface(input: unknown): Readonly<{
  testnet_surface_state: TestnetSurfaceState;
  key_material_detected: boolean;
  credential_detected: boolean;
  testnet_surface_detected: boolean;
  mainnet_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: TestnetSurfaceState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}> & SendSafeFlags;

// (H)
export function describeTestnetSendHealthContract(): Readonly<Record<string, unknown>> & SendSafeFlags;
export function evaluateTestnetSendHealth(inputs: unknown): Readonly<{
  valid: boolean;
  testnet_send_health_state: TestnetSendHealthState;
  status: TestnetSendHealthState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}> & SendSafeFlags;
