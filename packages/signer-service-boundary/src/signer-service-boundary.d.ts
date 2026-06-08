// Types for signer-service-boundary.mjs (Gate E / E1). Contract/isolation seam only — never signs/sends.

export interface SignRequest {
  intent_id: string;
  idempotency_key: string;
  signer_profile_id?: string;
  signer_profile_status?: string;   // SSOT G15 (must be ACTIVE)
  execution_wallet_status?: string; // SSOT G15 (must be ACTIVE)
  operating_state?: string;         // SSOT G1 (must be ACTIVE)
  real_live_config_valid?: boolean; // SSOT G10 (must be true)
  audit_actor: string;              // SSOT G14
  request_id?: string;
  // --- mock contract inputs (NOT SSOT fields; 09-THREAT §3 implementation/security concepts) ---
  risk_approved?: boolean;             // Risk Gates approval (mock)
  payload_digest?: string;             // opaque mock reference, NO crypto
  approved_payload_digest?: string;    // opaque mock reference, NO crypto
  approval_age_slots?: number;         // mock freshness, NO blockhash/RPC
  max_approval_age_slots?: number;     // mock freshness threshold
}

export interface SignResult {
  signed: false;
  signature: null;
  is_valid_on_chain: false;
  can_sign: false;
  can_send: false;
  note: string;
  contract_valid: boolean;
  refusal_reason?: string;
  intent_id: string | null;
  idempotency_key: string | null;
}

export interface SignerServiceBoundary {
  capabilities(): { can_sign: false; can_send: false; mock: true };
  requestSign(req: SignRequest): SignResult;
  readonly auditLog: unknown;
}

export function createSignerServiceBoundary(deps?: { auditLog?: unknown }): SignerServiceBoundary;
export const SIGNER_SERVICE_BOUNDARY_NOTE: string;
