// Types for signer-boundary.mjs (mock isolation seam). Names from SSOT G15.

export interface SigningIntent {
  /** Internal boundary control; only 'paper' is accepted (no live/real signing here). */
  mode?: string;
  signer_profile_id?: string;
  signer_profile_status?: 'ACTIVE' | 'DISABLED' | 'REVOKED' | 'DEGRADED';
  key_custody_mode?: 'connected_wallet' | 'isolated_signer';
}

export interface SigningResult {
  accepted: boolean;
  /** Always false. */
  signed: false;
  /** Always null. */
  signature: null;
  /** Always false. */
  is_valid_on_chain: false;
  note: string;
  refusal_reason?: string;
  mode?: 'paper';
  signer_profile_id?: string;
  signer_profile_status?: string;
  key_custody_mode?: string | null;
}

export interface SignerBoundaryCapabilities {
  can_sign: false;
  can_send: false;
  mock: true;
}

export interface SignerBoundary {
  capabilities(): SignerBoundaryCapabilities;
  requestSignature(intent?: SigningIntent): SigningResult;
}

export function createSignerBoundary(): SignerBoundary;
export const SIGNER_BOUNDARY_NOTE: string;
