// Types for real-live-readiness.mjs (Gate E / E0). Pure evaluator — no live mechanism, no activation.

export interface ReadinessInput {
  real_live_config_valid?: boolean;
  validation_status?: string;          // SSOT: valid | warning | invalid
  signer_profile_status?: string;      // SSOT: ACTIVE | DISABLED | REVOKED | DEGRADED
  execution_wallet_status?: string;    // SSOT: WARMING_UP | ACTIVE | DISABLED | DRAINING | RETIRED | REVOKED
  operating_state?: string;            // SSOT: WARMING_UP | ACTIVE | EXITS_ONLY | PAUSED | KILLED
  protocol_constant_status?: string;   // SSOT: green | changed
  provider_degraded?: boolean;
  slot_lag?: number;
  slot_lag_max?: number;               // mock threshold (passed in)
  audit_path_available?: boolean;      // mock input
  admission_complete?: boolean;        // mock input
  operator_checklist_complete?: boolean; // mock input
}

export interface ReadinessBlocker {
  code: string;       // result-model code; config-invalid uses SSOT 'REAL_LIVE_CONFIG_INVALID'
  detail?: string;
}

export interface ReadinessVerdict {
  ready: boolean;                       // result-model boolean (NOT a readiness_status enum)
  blockers: ReadinessBlocker[];
  prerequisite_for: 'activate_real_live'; // reference only; never invoked
}

export interface ReadinessAuditOptions {
  auditLog?: { append(entry: Record<string, unknown>): number };
  audit_actor?: string;
}

export function evaluateRealLiveReadiness(input: ReadinessInput, opts?: ReadinessAuditOptions): ReadinessVerdict;
export function isRealLiveReady(input: ReadinessInput): boolean;
export function createReadinessAuditLog(): unknown;
export const READINESS_RESOURCE: 'readiness';
export const ACTIVATION_COMMAND_REF: 'activate_real_live';
