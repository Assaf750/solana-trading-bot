// @soltrade/mainnet-activation-seam-foundations — type declarations
//
// Read-only / advisory ONLY MAINNET REAL-LIVE ACTIVATION SEAM foundation for
// Stage-23 (the FINAL build stage). Builds everything UP TO the real-money
// activation switch and NOTHING past it — the mainnet analogue of the Stage-17
// live-stream seam and the Stage-21 testnet-send seam. The seam is NEVER ready:
// MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION is HARDCODED met:false, so
// seam_ready / activation_performed / real_live_activated / can_send can NEVER be
// true in-package, even with all other requirements satisfied and even under
// forged truthy inputs. NO live network primitive, NO signing/crypto primitive, NO
// signature produced. Hard-Risk is PRESERVED, never re-implemented: the seam
// CONSUMES a real-live-readiness verdict (ready===true required) and treats
// not-ready / incomplete-Hard-Risk / missing as fail-safe. Secrets BY REFERENCE
// only (opaque endpoint_ref); raw key/endpoint/url/seed refused with NAME-only
// redaction. Every identifier here is a LOCAL function-I/O contract identifier, NOT
// an SSOT name; SSOT Group 1 operating_state values are consumed-only by VALUE.

export interface SafeFlags {
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

export interface MainnetSeamRequirement {
  requirement: string;
  met: boolean;
}

export interface MainnetActivationSeamResult extends SafeFlags {
  valid: boolean;
  mainnet_seam_state: string;
  activation_performed: false;
  real_live_activated: false;
  seam_ready: false;
  seam_requirements: ReadonlyArray<MainnetSeamRequirement>;
  endpoint_in_repo: false;
  key_in_repo: false;
  funds_in_repo: false;
  required_owner_inputs: ReadonlyArray<string>;
  status: string;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface GlobalKillSwitchResult extends SafeFlags {
  mainnet_kill_state: string;
  kill_engaged: boolean;
  read_model_only: true;
  status: string;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface EmergencyExitResult extends SafeFlags {
  valid: boolean;
  mainnet_emergency_exit_state: string;
  exit_only_advisory: boolean;
  read_model_only: true;
  status: string;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface MainnetActivationSuppressionResult extends SafeFlags {
  suppressed: true;
  suppression_reasons: ReadonlyArray<string>;
  status: string;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface MainnetForbiddenSurfaceResult extends SafeFlags {
  mainnet_surface_state: string;
  key_material_detected: boolean;
  credential_detected: boolean;
  mainnet_surface_detected: boolean;
  mainnet_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  status: string;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface MainnetActivationHealthResult extends SafeFlags {
  valid: boolean;
  mainnet_activation_health_state: string;
  status: string;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export function describeMainnetActivationSeamContract(): Readonly<Record<string, unknown>>;
export function evaluateMainnetActivationSeam(input?: unknown): Readonly<MainnetActivationSeamResult>;

export function describeGlobalKillSwitchContract(): Readonly<Record<string, unknown>>;
export function evaluateGlobalKillSwitch(input?: unknown): Readonly<GlobalKillSwitchResult>;

export function describeEmergencyExitContract(): Readonly<Record<string, unknown>>;
export function evaluateEmergencyExit(input?: unknown): Readonly<EmergencyExitResult>;

export function describeMainnetActivationSuppressionContract(): Readonly<Record<string, unknown>>;
export function evaluateMainnetActivationSuppression(input?: unknown): Readonly<MainnetActivationSuppressionResult>;

export function describeMainnetForbiddenSurfaceContract(): Readonly<Record<string, unknown>>;
export function evaluateMainnetForbiddenSurface(input?: unknown): Readonly<MainnetForbiddenSurfaceResult>;
export function isValidMainnetEndpointRef(ref?: unknown): boolean;

export function describeMainnetActivationHealthContract(): Readonly<Record<string, unknown>>;
export function evaluateMainnetActivationHealth(inputs?: unknown): Readonly<MainnetActivationHealthResult>;
