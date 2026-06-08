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

// Build a compact, secret-free reference suffix for audit_reason. intent_id / signer_profile_id are
// IDENTIFIERS (not SSOT audit columns and not secrets); they are encoded INSIDE audit_reason so no audit
// field outside AUDIT_COLUMNS is introduced. No payload, no digest, no signature, no key material here.
function refSuffix(input) {
  const parts = [];
  if (isStr(input.intent_id)) parts.push(`intent:${input.intent_id}`);
  if (isStr(input.signer_profile_id)) parts.push(`profile:${input.signer_profile_id}`);
  return parts.length ? ` ${parts.join('|')}` : '';
}

// Build one audit entry using ONLY AUDIT_COLUMNS keys (resource_type, audit_scope, audit_actor, audit_reason,
// request_id, idempotency_key). NEVER includes payload/digest/signature/key material.
function auditEntry(input, audit_reason) {
  const entry = {
    resource_type: 'signer_profile',
    audit_scope: 'signer_profile',
    audit_actor: input.audit_actor,
    audit_reason,
  };
  if (isStr(input.request_id)) entry.request_id = input.request_id;
  if (isStr(input.idempotency_key)) entry.idempotency_key = input.idempotency_key;
  return entry;
}

// Audited gate wrapper. Records BEFORE + AFTER for every preflight attempt (success and refusal), append-only,
// refs-only (no secrets, no raw payload, no signature, no key material). It STILL never signs or sends.
export function createSigningPreflightGate({ auditLog } = {}) {
  const audit = auditLog && typeof auditLog.append === 'function' ? auditLog : null;
  return Object.freeze({
    evaluate(input = {}) {
      // No audit configured -> pure passthrough (still never signs).
      if (!audit) return evaluateSigningPreflight(input);

      // Fail-closed: with audit configured, audit_actor is REQUIRED. Refuse with NO append (no partial entry).
      if (input == null || typeof input !== 'object' || !isStr(input.audit_actor)) {
        return envelope(['audit_actor_required']);
      }

      // BEFORE: record the attempt.
      audit.append(auditEntry(input, `signing_preflight_before${refSuffix(input)}`));

      // Evaluate (pure; never signs).
      const result = evaluateSigningPreflight(input);

      // AFTER: record the outcome (ok-but-not-signed, or blocked with reasons).
      const after = result.preflight_ok
        ? `signing_preflight_after_ok_no_signing${refSuffix(input)}`
        : `signing_preflight_after_blocked:${result.blockers.join('|')}${refSuffix(input)}`;
      audit.append(auditEntry(input, after));

      return result;
    },
  });
}

export const SIGNING_PREFLIGHT_NOTE = 'E2-C0 preflight gate: evaluates signing preconditions; never signs/sends.';
