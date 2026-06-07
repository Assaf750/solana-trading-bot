// Types for execution-wallet-admission.mjs (Gate C / C2). Admission gate only — never signs/sends.

export interface AdmissionRequest {
  execution_wallet_id: string;
  signer_profile_id: string;
  risk_config?: Record<string, number>;
  permission_role?: string; // SSOT G11 (admin; signer_control if linking signer/custody)
  funded?: boolean;                 // mock predicate
  signer_reachable?: boolean;       // mock predicate
  key_custody_verified?: boolean;   // mock predicate
  links_signer_or_custody?: boolean;
}

export interface AdmissionResult {
  ok: boolean;
  admitted: boolean;
  reason?: string;
  api_error_code?: 'PERMISSION_DENIED' | 'COMMAND_NOT_ALLOWED_IN_STATE' | 'REAL_LIVE_CONFIG_INVALID';
  command?: 'activate_execution_wallet';
  execution_wallet_status?: string;
}

export interface AdmissionGate {
  command: 'activate_execution_wallet';
  activateExecutionWallet(req: AdmissionRequest): AdmissionResult;
}

export function createAdmissionGate(deps: { walletRegistry: unknown; signerRegistry: unknown }): AdmissionGate;
export const ADMISSION_COMMAND: 'activate_execution_wallet';
