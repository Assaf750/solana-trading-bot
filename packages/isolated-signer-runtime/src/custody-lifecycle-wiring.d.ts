// Type declarations for the E2-B custody lifecycle WIRING (stub provider).
// Stub wiring only: no signing, no key, no send, no provider integration, no execution authority.

export interface CustodyLifecycleDescriptor {
  readonly component: 'isolated-signer-custody-lifecycle-wiring';
  readonly status: 'stub_wiring';
  readonly provider_status: 'unconfigured';
  readonly can_sign: false;
  readonly can_send: false;
  readonly has_key_material: false;
  readonly is_live: false;
  readonly note: string;
}

export interface CustodyLifecycleResult {
  readonly ok: boolean;
  readonly signed?: false;
  readonly signature?: null;
  readonly can_sign?: false;
  readonly can_send?: false;
  readonly refusal_reason?: string;
  readonly custody_phase?: string;
  readonly recommended_signer_profile_status?: string;
  readonly provider_status?: 'unconfigured';
  readonly signer_profile_id?: string | null;
}

export interface IsolatedCustodyLifecycle {
  describeCustodyLifecycle(): CustodyLifecycleDescriptor;
  readonly provider_status: 'unconfigured';
  requestLoad(request?: Record<string, unknown>): CustodyLifecycleResult;
  use(request?: Record<string, unknown>): CustodyLifecycleResult;
  reportCustodyFailure(request?: Record<string, unknown>): CustodyLifecycleResult;
  zeroize(signer_profile_id: string, ctx?: Record<string, unknown>): CustodyLifecycleResult;
  revoke(signer_profile_id: string, ctx?: Record<string, unknown>): CustodyLifecycleResult;
  disable(signer_profile_id: string, ctx?: Record<string, unknown>): CustodyLifecycleResult;
  shutdown(ctx?: Record<string, unknown>): { ok: boolean; zeroized_sessions: number; kind: string };
  panic(ctx?: Record<string, unknown>): { ok: boolean; zeroized_sessions: number; kind: string };
  get(signer_profile_id: string): unknown;
  list(): unknown[];
  readonly auditLog: unknown;
}

export function describeCustodyLifecycle(): CustodyLifecycleDescriptor;
export function createIsolatedCustodyLifecycle(opts?: { auditLog?: unknown }): IsolatedCustodyLifecycle;
export const CUSTODY_LIFECYCLE_WIRING_STATUS: 'stub_wiring';
