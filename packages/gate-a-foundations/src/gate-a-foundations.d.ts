// Type declarations for @soltrade/gate-a-foundations
// Read-only Gate-A Config Validation + Audit Path. All invariant flags are
// typed as the literal `false`: these results NEVER open trading readiness.

export type GateAConfigState =
  | 'CONFIG_UNCONFIGURED'
  | 'CONFIG_INVALID'
  | 'CONFIG_VALID_READ_ONLY'
  | 'CONFIG_DEGRADED';

export type GateAAuditState =
  | 'AUDIT_UNCONFIGURED'
  | 'AUDIT_INVALID'
  | 'AUDIT_DEGRADED'
  | 'AUDIT_PATH_VALID';

export interface GateAInvariantFlags {
  readonly trading_ready: false;
  readonly routing_ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly signing_permitted: false;
  readonly broadcast_permitted: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly mainnet_enabled: false;
  readonly has_rpc: false;
}

// --- Config Validation ---

export interface GateAConfigValidationContract extends GateAInvariantFlags {
  readonly contract: 'gate-a-config-validation';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly supported_states: readonly GateAConfigState[];
  readonly required_attestations: readonly string[];
  readonly read_only: true;
  readonly config_is_not_trading_readiness: true;
  readonly config_state: 'CONFIG_UNCONFIGURED';
  readonly config_valid_read_only: false;
  readonly status: 'CONFIG_UNCONFIGURED';
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface GateAConfigValidationResult extends GateAInvariantFlags {
  readonly valid: boolean;
  readonly recognized: boolean;
  readonly reasons: readonly string[];
}

export interface GateAConfigReadinessResult extends GateAInvariantFlags {
  readonly valid: boolean;
  readonly config_state: GateAConfigState;
  readonly config_valid_read_only: boolean;
  readonly status: GateAConfigState;
  readonly reasons: readonly string[];
}

export function describeGateAConfigValidationContract(): GateAConfigValidationContract;
export function validateGateAConfig(config: unknown): GateAConfigValidationResult;
export function evaluateGateAConfigReadiness(config: unknown): GateAConfigReadinessResult;

// --- Audit Path ---

export interface GateAAuditPathContract extends GateAInvariantFlags {
  readonly contract: 'gate-a-audit-path';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly supported_states: readonly GateAAuditState[];
  readonly required_refs: readonly string[];
  readonly required_attestations: readonly string[];
  readonly read_only: true;
  readonly audit_cannot_be_bypassed: true;
  readonly audit_state: 'AUDIT_UNCONFIGURED';
  readonly audit_path_valid: false;
  readonly status: 'AUDIT_UNCONFIGURED';
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface GateAAuditEnvelopeResult extends GateAInvariantFlags {
  readonly valid: boolean;
  readonly recognized: boolean;
  readonly reasons: readonly string[];
}

export interface GateAAuditPathResult extends GateAInvariantFlags {
  readonly valid: boolean;
  readonly audit_state: GateAAuditState;
  readonly audit_path_valid: boolean;
  readonly status: GateAAuditState;
  readonly reasons: readonly string[];
}

export function describeGateAAuditPathContract(): GateAAuditPathContract;
export function validateGateAAuditEnvelope(envelope: unknown): GateAAuditEnvelopeResult;
export function evaluateGateAAuditPath(envelope: unknown): GateAAuditPathResult;

// --- Readiness Aggregator ---

export type GateAReadinessState =
  | 'GATE_A_UNCONFIGURED'
  | 'GATE_A_DEGRADED'
  | 'GATE_A_READY_READ_ONLY'
  | 'GATE_A_BLOCKED';

export type GateAShellStatus =
  | 'read_only_ready'
  | 'degraded'
  | 'blocked'
  | 'unconfigured';

export interface GateAReadinessAggregatorContract extends GateAInvariantFlags {
  readonly contract: 'gate-a-readiness-aggregator';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly consumes: readonly string[];
  readonly supported_states: readonly GateAReadinessState[];
  readonly read_only: true;
  readonly readiness_is_not_trading_readiness: true;
  readonly gate_a_state: 'GATE_A_UNCONFIGURED';
  readonly gate_a_ready_read_only: false;
  readonly status: 'GATE_A_UNCONFIGURED';
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface GateAReadinessResult extends GateAInvariantFlags {
  readonly valid: boolean;
  readonly gate_a_state: GateAReadinessState;
  readonly gate_a_ready_read_only: boolean;
  readonly status: GateAReadinessState;
  readonly reasons: readonly string[];
}

export function describeGateAReadinessAggregatorContract(): GateAReadinessAggregatorContract;
export function evaluateGateAReadiness(inputs?: unknown): GateAReadinessResult;

// --- Status / Dashboard Shell ---

export interface GateAStatusShellContract extends GateAInvariantFlags {
  readonly contract: 'gate-a-status-shell';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly stage: 'gate_a';
  readonly supported_statuses: readonly GateAShellStatus[];
  readonly read_only: true;
  readonly status_only: true;
  readonly has_execution_commands: false;
  readonly can_trade: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly requires_next_stage: 'data_ingestion';
  readonly status: 'unconfigured';
  readonly note: string;
}

export interface GateAStatusShellResult extends GateAInvariantFlags {
  readonly stage: 'gate_a';
  readonly status: GateAShellStatus;
  readonly can_trade: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly requires_next_stage: 'data_ingestion';
  readonly read_only: true;
  readonly status_only: true;
  readonly has_execution_commands: false;
}

export function describeGateAStatusShellContract(): GateAStatusShellContract;
export function evaluateGateAStatusShell(gateAReadinessResult?: unknown): GateAStatusShellResult;
