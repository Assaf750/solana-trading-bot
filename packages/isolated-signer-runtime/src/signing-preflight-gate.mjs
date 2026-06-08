// @soltrade/isolated-signer-runtime — Signing PREFLIGHT GATE (Gate E / E2-C0).
// SOURCE: docs/00-ARCHITECTURE.md §4.3/§5/§10 (Risk Gates, OperatingStateMachine, SignerService isolation) +
//   docs/09-THREAT-SECURITY §3/§7 (payload binding, approval freshness, fail-closed) +
//   reports/E2-IMPLEMENTATION-PLAN (E2-C0: preflight gate BEFORE any real signing).
//
// MOCK / NO-CRYPTO / NO-SIGNING. This gate ONLY evaluates whether the theoretical preconditions for signing
// hold. It NEVER signs, NEVER serialises, NEVER produces a signature or bytes or a transaction, and NEVER
// sends. Even when every precondition is met it returns signed:false / signature:null / can_send:false and
// states that real signing requires a separate E2-C approval.
//
// ABSENT BY DESIGN (and forbidden here): crypto/signing library, KMS/vault, KeyManager, key material,
// transaction building/serialisation, signing/sending, RPC/provider, DB, REAL-LIVE activation, execution
// authority. `risk_approved`, `payload_digest`, `approved_payload_digest`, `approval_age_slots`, and
// `max_approval_age_slots` are MOCK inputs (implementation concepts, not SSOT fields).

import { refusesKeyMaterial } from '../../custody-provider-contract/src/index.mjs';

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isInt = (v) => typeof v === 'number' && Number.isFinite(v);

// Refuse key-material-shaped input. Delegated to the custody provider contract's detector so this module
// holds NO key-material literals (it lives in the allowlisted path, where key-material strings are scanned).
function carriesKeyMaterial(input) {
  return refusesKeyMaterial(input);
}

// A non-signing envelope. `signed`/`signature`/`can_send` are pinned: this gate cannot sign or send.
function envelope(blockers, extra = {}) {
  const ok = blockers.length === 0;
  return Object.freeze({
    preflight_ok: ok,
    can_attempt_signing: false, // E2-C0 NEVER attempts signing; real signing = separate E2-C approval
    signed: false,
    signature: null,
    can_send: false,
    blockers: Object.freeze([...blockers]),
    ...extra,
  });
}

// Pure evaluation of signing preconditions. Returns a non-signing envelope with a list of blockers.
// Fail-closed: any missing/invalid/non-true input adds a blocker; nothing is ever assumed satisfied.
export function evaluateSigningPreflight(input = {}) {
  if (input == null || typeof input !== 'object') {
    return envelope(['invalid_request']);
  }
  if (carriesKeyMaterial(input)) {
    // refuse outright; do not evaluate further, do not read the offending value
    return envelope(['key_material_not_accepted']);
  }

  const blockers = [];

  // Risk + readiness gates (must be explicitly true)
  if (input.risk_approved !== true) blockers.push('risk_not_approved');
  if (input.real_live_config_valid !== true) blockers.push('real_live_config_invalid');

  // Identity / state gates (existing SSOT enum values)
  if (input.signer_profile_status !== 'ACTIVE') blockers.push('signer_not_active');
  if (input.execution_wallet_status !== 'ACTIVE') blockers.push('execution_wallet_not_active');
  if (input.operating_state !== 'ACTIVE') blockers.push('operating_state_not_active');

  // Custody must be neither degraded nor unconfigured (from E2-A/E2-B wiring)
  if (input.custody_phase === 'degraded') blockers.push('custody_degraded');
  if (input.provider_status !== undefined && input.provider_status !== 'configured') blockers.push('custody_unconfigured');
  if (input.provider_status === undefined) blockers.push('custody_unconfigured'); // fail-closed: unknown => unconfigured

  // Payload binding (mock): the digest presented must match the approved digest
  if (!isStr(input.payload_digest) || !isStr(input.approved_payload_digest) || input.payload_digest !== input.approved_payload_digest) {
    blockers.push('payload_digest_mismatch');
  }

  // Approval freshness (mock): approval must not be stale
  if (!isInt(input.approval_age_slots) || !isInt(input.max_approval_age_slots) || input.approval_age_slots > input.max_approval_age_slots) {
    blockers.push('approval_stale');
  }

  // Idempotency / intent identity (existing SSOT fields)
  if (!isStr(input.intent_id)) blockers.push('missing_intent_id');
  if (!isStr(input.idempotency_key)) blockers.push('missing_idempotency_key');

  if (blockers.length > 0) return envelope(blockers);

  // All preconditions theoretically satisfied — but STILL no signing. Real signing is a separate E2-C PR.
  return envelope([], {
    intent_id: input.intent_id,
    note: 'preflight satisfied; real signing requires separate E2-C approval (E2-C0 never signs)',
  });
}

// Audited gate wrapper. Records the preflight outcome (no secrets, no key material) and returns the envelope.
export function createSigningPreflightGate({ auditLog } = {}) {
  const audit = auditLog || null;
  return Object.freeze({
    evaluate(input = {}) {
      const result = evaluateSigningPreflight(input);
      if (audit && typeof audit.append === 'function') {
        const entry = {
          resource_type: 'signer_profile',
          audit_scope: 'signer_profile',
          audit_actor: input && isStr(input.audit_actor) ? input.audit_actor : 'system',
          audit_reason: result.preflight_ok ? 'signing_preflight_ok_no_signing' : `signing_preflight_blocked:${result.blockers.join('|')}`,
        };
        if (input && isStr(input.request_id)) entry.request_id = input.request_id;
        if (input && isStr(input.idempotency_key)) entry.idempotency_key = input.idempotency_key;
        audit.append(entry);
      }
      return result;
    },
  });
}

export const SIGNING_PREFLIGHT_NOTE = 'E2-C0 preflight gate: evaluates signing preconditions; never signs/sends.';
