// Types for signer-profiles-registry.mjs. References-only. Names from SSOT G15 + G11.

export interface SignerProfileInput {
  signer_profile_id: string;
  key_custody_mode?: 'connected_wallet' | 'isolated_signer';
}

export interface SignerProfileRecord {
  signer_profile_id: string;
  signer_profile_status: string; // SSOT G15
  key_custody_mode: string | null;
}

export interface PermissionContext {
  permission_role?: string; // SSOT G11 (signer_control required for sensitive ops)
}

export interface SignerRegistryResult {
  ok: boolean;
  reason?: string;
  api_error_code?: 'PERMISSION_DENIED' | 'COMMAND_NOT_ALLOWED_IN_STATE';
  signer_profile_id?: string;
  signer_profile_status?: string;
  from?: string;
  to?: string;
}

export interface SignerProfilesRegistry {
  register(input: SignerProfileInput, ctx?: PermissionContext): SignerRegistryResult;
  transition(signer_profile_id: string, toStatus: string, ctx?: PermissionContext): SignerRegistryResult;
  get(signer_profile_id: string): SignerProfileRecord | undefined;
  list(): SignerProfileRecord[];
  isTerminal(signer_profile_id: string): boolean;
  readonly size: number;
}

export function isTerminalSignerStatus(status: string): boolean;
export function createSignerProfilesRegistry(): SignerProfilesRegistry;
export const SIGNER_PROFILE_TRANSITIONS: Readonly<Record<string, readonly string[]>>;
