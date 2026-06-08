// Type declarations for the E2-C3-4 real signing path (SIGN-ONLY, test-gated, no send/RPC/serialize).

export interface RealSigningPathDescriptor {
  readonly component: 'isolated-signer-real-signing-path';
  readonly mode: 'sign_only';
  readonly can_sign: true;   // LOCAL sign-only/test-gated; global capabilities() stay all-false
  readonly can_send: false;
  readonly test_gated: true;
  readonly holds_key_material: false;
  readonly can_export_key: false;
  readonly is_live: false;
  readonly note: string;
}

export interface RealSignSuccess {
  readonly ok: true;
  readonly signed: true;
  readonly signature: string; // base64 Ed25519 signature over the bound digest (public, not key material)
  readonly can_send: false;
  readonly mode: 'sign_only';
  readonly intent_id?: string;
  readonly note: string;
}

export interface RealSignFailClosed {
  readonly ok: false;
  readonly signed: false;
  readonly signature: null;
  readonly can_send: false;
  readonly blockers?: readonly string[];
  readonly reason?: string;
  readonly recommended_signer_profile_status?: 'DEGRADED';
}

export type RealSignResult = RealSignSuccess | RealSignFailClosed;

export interface RealSigningPath {
  describe(): RealSigningPathDescriptor;
  readonly mode: 'sign_only';
  attemptSign(input?: Record<string, unknown>, signerKey?: unknown): Promise<RealSignResult>;
}

export function describeRealSigningPath(): RealSigningPathDescriptor;
export function createRealSigningPath(opts?: { auditLog?: unknown }): RealSigningPath;
export const REAL_SIGNING_PATH_MODE: 'sign_only';
