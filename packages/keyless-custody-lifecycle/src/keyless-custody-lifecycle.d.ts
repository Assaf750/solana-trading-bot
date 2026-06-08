// Types for keyless-custody-lifecycle.mjs (Gate E / E2-0). Keyless state model — no keys, no signing.

export interface CustodyRequest {
  signer_profile_id: string;
  signer_profile_status?: string;   // SSOT G15 (ACTIVE required)
  key_custody_mode?: string;        // SSOT G15 (must be isolated_signer)
  custody_available?: boolean;      // mock KMS/vault availability (NOT SSOT)
  audit_actor: string;              // SSOT G14
  permission_role?: string;         // SSOT G11
  request_id?: string;
}

export interface CustodyContext {
  audit_actor: string;
  permission_role?: string;         // signer_control for revoke/disable
  request_id?: string;
}

export interface CustodyResult {
  ok: boolean;
  signed?: false;
  signature?: null;
  is_valid_on_chain?: false;
  can_sign?: false;
  can_send?: false;
  loaded?: boolean;
  used?: boolean;
  usable?: boolean;
  zeroized?: boolean;
  revoked?: boolean;
  disabled?: boolean;
  idempotent?: boolean;
  custody_phase?: string;                    // internal result-model phase (NOT SSOT)
  recommended_signer_profile_status?: string; // 'DEGRADED' on custody failure
  refusal_reason?: string;
  signer_profile_id?: string | null;
}

export interface CustodySession {
  signer_profile_id: string;
  custody_phase: string;
  revoked: boolean;
  disabled: boolean;
}

export interface KeylessCustodyLifecycle {
  readonly PHASE: Readonly<Record<string, string>>;
  requestLoad(req: CustodyRequest): CustodyResult;
  use(req: CustodyRequest): CustodyResult;
  reportCustodyFailure(req: CustodyRequest): CustodyResult;
  zeroize(signer_profile_id: string, ctx: CustodyContext): CustodyResult;
  revoke(signer_profile_id: string, ctx: CustodyContext): CustodyResult;
  disable(signer_profile_id: string, ctx: CustodyContext): CustodyResult;
  shutdown(ctx?: CustodyContext): { ok: boolean; zeroized_sessions: number; kind: string };
  panic(ctx?: CustodyContext): { ok: boolean; zeroized_sessions: number; kind: string };
  get(signer_profile_id: string): CustodySession | undefined;
  list(): CustodySession[];
  readonly auditLog: unknown;
}

export function createKeylessCustodyLifecycle(deps?: { auditLog?: unknown }): KeylessCustodyLifecycle;
export const CUSTODY_PHASE: Readonly<Record<string, string>>;
