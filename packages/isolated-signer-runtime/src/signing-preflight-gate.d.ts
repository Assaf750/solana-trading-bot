// Type declarations for the E2-C0 signing PREFLIGHT GATE (mock / no-signing).
// Evaluates signing preconditions only. Never signs, never sends, never serialises, never holds key material.

export interface SigningPreflightInput {
  readonly risk_approved?: boolean;
  readonly real_live_config_valid?: boolean;
  readonly signer_profile_status?: string;
  readonly execution_wallet_status?: string;
  readonly operating_state?: string;
  readonly custody_phase?: string;
  readonly provider_status?: string;
  readonly payload_digest?: string;
  readonly approved_payload_digest?: string;
  readonly approval_age_slots?: number;
  readonly max_approval_age_slots?: number;
  readonly intent_id?: string;
  readonly idempotency_key?: string;
  readonly audit_actor?: string;
  readonly request_id?: string;
}

export interface SigningPreflightResult {
  readonly preflight_ok: boolean;
  readonly can_attempt_signing: false;
  readonly signed: false;
  readonly signature: null;
  readonly can_send: false;
  readonly blockers: readonly string[];
  readonly intent_id?: string;
  readonly note?: string;
}

export interface SigningPreflightGate {
  evaluate(input?: SigningPreflightInput): SigningPreflightResult;
}

export function evaluateSigningPreflight(input?: SigningPreflightInput): SigningPreflightResult;
export function createSigningPreflightGate(opts?: { auditLog?: unknown }): SigningPreflightGate;
export const SIGNING_PREFLIGHT_NOTE: string;
