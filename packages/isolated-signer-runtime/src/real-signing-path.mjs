// @soltrade/isolated-signer-runtime — Real Signing Path, SIGN-ONLY (Gate E / E2-C3-4).
// SOURCE: docs/00-ARCHITECTURE.md §4.3/§5/§10 + docs/09-THREAT-SECURITY §3/§7 + reports/E2-C3-3 (design).
//
// SIGN-ONLY. Behind the EXISTING gate (preflight + readiness + custody), this produces a WebCrypto Ed25519
// signature over the EXACT approved, bound digest — and NOTHING else. It NEVER sends, NEVER builds or
// serialises a transaction, NEVER calls RPC, and NEVER activates REAL-LIVE. `can_send` is always false.
//
// KEY HANDLING: the signing key is an EPHEMERAL, NON-EXTRACTABLE WebCrypto key handle supplied by the caller
// (test-mode input). This module NEVER generates, persists, exports, or literalises a key, and NEVER reads a
// key's private component as a property — it only uses the supplied handle to sign. With the production
// custody STUB the preflight is fail-closed (DEGRADED), so this path cannot reach signing in production yet;
// real custody/KMS key sourcing is a SEPARATE, later track.
//
// ABSENT BY DESIGN (and forbidden here): KMS/vault, KeyManager, third-party crypto libs, key material in
// source, transaction building/serialisation, send/RPC, DB, REAL-LIVE, execution authority.

import { webcrypto } from 'node:crypto';
import { evaluateSigningPreflight } from './signing-preflight-gate.mjs';

const MODE = 'sign_only';
const isStr = (v) => typeof v === 'string' && v.length > 0;

// LOCAL, explicit, sign-only/test-gated descriptor. Global capabilities() stay all-false (see
// isolated-signer-runtime.mjs); this descriptor documents that THIS path can sign (only) under the gate.
export function describeRealSigningPath() {
  return Object.freeze({
    component: 'isolated-signer-real-signing-path',
    mode: MODE,
    can_sign: true,            // LOCAL sign-only, test-gated — NOT a global capability flip
    can_send: false,           // never sends
    test_gated: true,          // requires an explicitly-supplied ephemeral signing key
    holds_key_material: false, // holds no key; the handle is supplied per-call and not retained
    can_export_key: false,
    is_live: false,
    note: 'E2-C3-4 sign-only: signs ONLY the bound approved digest behind preflight+readiness+audit+custody '
      + 'gates, using an explicitly-supplied ephemeral non-extractable key. NO send, NO RPC, NO serialisation, '
      + 'NO KMS, NO REAL-LIVE. Global capabilities() remain all-false.',
  });
}

const refSuffix = (input) => {
  const parts = [];
  if (isStr(input.intent_id)) parts.push(`intent:${input.intent_id}`);
  if (isStr(input.signer_profile_id)) parts.push(`profile:${input.signer_profile_id}`);
  return parts.length ? ` ${parts.join('|')}` : '';
};

// Audit entry using ONLY AUDIT_COLUMNS keys; NEVER includes signature/digest/key/payload.
function auditEntry(input, audit_reason) {
  const entry = { resource_type: 'signer_profile', audit_scope: 'signer_profile', audit_actor: input.audit_actor, audit_reason };
  if (isStr(input.request_id)) entry.request_id = input.request_id;
  if (isStr(input.idempotency_key)) entry.idempotency_key = input.idempotency_key;
  return entry;
}

const failClosed = (extra) => Object.freeze({ ok: false, signed: false, signature: null, can_send: false, ...extra });

// Create the sign-only path. attemptSign() runs the gate, and ONLY on a fully-clean preflight + a supplied
// ephemeral key does it sign the bound digest. Records before/after audit per attempt.
export function createRealSigningPath({ auditLog } = {}) {
  const audit = auditLog && typeof auditLog.append === 'function' ? auditLog : null;
  return Object.freeze({
    describe: describeRealSigningPath,
    mode: MODE,

    async attemptSign(input = {}, signerKey) {
      // Fail-closed: with audit configured, audit_actor is REQUIRED; refuse with NO append (no partial entry).
      if (audit && (input == null || typeof input !== 'object' || !isStr(input.audit_actor))) {
        return failClosed({ blockers: Object.freeze(['audit_actor_required']) });
      }
      if (audit) audit.append(auditEntry(input, `real_sign_before${refSuffix(input)}`));

      // Evaluate gates (pure; no audit here — this path owns its before/after).
      const result = evaluateSigningPreflight(input);
      if (result.preflight_ok !== true) {
        if (audit) audit.append(auditEntry(input, `real_sign_after_refused:${result.blockers.join('|')}${refSuffix(input)}`));
        return Object.freeze({ ...result });
      }

      // Preflight clean. Require an explicitly-supplied ephemeral signing key (no KMS/custody key yet).
      const subtle = webcrypto && webcrypto.subtle;
      if (!signerKey || !subtle || typeof subtle.sign !== 'function') {
        if (audit) audit.append(auditEntry(input, `real_sign_after_refused:no_signing_material${refSuffix(input)}`));
        return failClosed({ reason: 'no_signing_material' });
      }

      // Sign ONLY the bound, approved digest. There is no parameter to sign arbitrary bytes.
      let signature;
      try {
        const bound = new TextEncoder().encode(input.approved_payload_digest);
        const sig = await subtle.sign({ name: 'Ed25519' }, signerKey, bound);
        signature = Buffer.from(new Uint8Array(sig)).toString('base64');
      } catch {
        if (audit) audit.append(auditEntry(input, `real_sign_after_refused:sign_error${refSuffix(input)}`));
        return failClosed({ reason: 'sign_error' });
      }

      if (audit) audit.append(auditEntry(input, `real_sign_after_signed_sign_only_no_send${refSuffix(input)}`));
      return Object.freeze({
        ok: true,
        signed: true,
        signature,          // base64 of the Ed25519 signature over the bound digest (public; not key material)
        can_send: false,    // sign-only; never sends
        mode: MODE,
        intent_id: input.intent_id,
        note: 'sign-only; not sent; not REAL-LIVE',
      });
    },
  });
}

export const REAL_SIGNING_PATH_MODE = MODE;
