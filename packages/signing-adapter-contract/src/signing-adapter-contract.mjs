// @soltrade/signing-adapter-contract — Signing Adapter CONTRACT + NO-OP adapter (Gate E / E2-C1).
// SOURCE: docs/00-ARCHITECTURE.md §4.3 (SignerService isolation) + docs/09-THREAT-SECURITY §3/§7 +
//   reports/E2-C plan (E2-C1: adapter interface / no-op; real signing is a later, separately-approved PR).
//
// CONTRACT/STUB ONLY — NO live mechanism. This describes what a signing adapter MUST be (a fail-closed
// component that consumes an already-validated preflight result + an OPAQUE custody handle reference, and
// NEVER exports keys) and ships a NO-OP adapter that always fails closed. It performs no work and holds
// nothing.
//
// ABSENT BY DESIGN (and forbidden here): crypto/signing library, KMS/vault, KeyManager, key material,
// transaction building/serialisation, signing/sending, RPC/provider, DB, REAL-LIVE activation, execution
// authority. The "custody handle" is a plain reference label, not a key and not a credential.

import { refusesKeyMaterial } from '../../custody-provider-contract/src/index.mjs';

const UNCONFIGURED = 'unconfigured';

// A frozen fail-closed signing result. signed/signature/can_send are pinned: this adapter cannot sign/send.
function failClosed(reason) {
  return Object.freeze({
    ok: false,
    status: UNCONFIGURED,
    signed: false,
    signature: null,
    can_send: false,
    reason: reason || 'signing adapter is not configured (contract/no-op only)',
  });
}

// Validate that the request carries an acceptable, already-validated preflight result. Returns a reason code
// on rejection, or null when the preflight shape is acceptable. NEVER reads/echoes key material.
function rejectReason(request) {
  if (request == null || typeof request !== 'object') return 'invalid_request';
  if (refusesKeyMaterial(request)) return 'key_material_not_accepted';
  const pf = request.preflight && typeof request.preflight === 'object' ? request.preflight : request;
  if (refusesKeyMaterial(pf)) return 'key_material_not_accepted';
  // The preflight must be OK and must itself be a non-signing envelope.
  if (pf.preflight_ok !== true) return 'preflight_not_ok';
  if (pf.signed !== false) return 'preflight_signed_must_be_false';
  if (pf.signature !== null) return 'preflight_signature_must_be_null';
  if (pf.can_send !== false) return 'preflight_can_send_must_be_false';
  if (!Array.isArray(pf.blockers) || pf.blockers.length !== 0) return 'preflight_has_blockers';
  // Custody must not be flagged unsafe by the preflight (fail-closed on DEGRADED).
  if (pf.recommended_signer_profile_status === 'DEGRADED') return 'custody_unsafe_degraded';
  return null;
}

// The CONTRACT descriptor: what any conforming signing adapter must expose, with every execution-bearing
// capability pinned to false. Read-only; performs nothing.
export function describeSigningAdapterContract() {
  return Object.freeze({
    contract: 'signing-adapter',
    version: '0.0.0',
    can_sign: false,         // a conforming adapter signs ONLY a bound, approved digest via custody (later PRs)
    can_send: false,         // sending is never part of the signing adapter
    holds_key_material: false,
    can_export_key: false,   // a conforming adapter must NEVER export key material
    is_live: false,
    status: UNCONFIGURED,
    requires: Object.freeze(['preflight_ok', 'opaque_custody_handle']),
    note: 'Contract + no-op only (E2-C1). Fail-closed; consumes a validated preflight + opaque custody handle; '
      + 'never exports keys. No crypto, no KMS/vault, no KeyManager, no signing/sending, no RPC/DB, no '
      + 'execution authority. Real signing requires separate E2-C3 approval.',
  });
}

// A NO-OP signing adapter: validates the preflight-like request and ALWAYS fails closed. It cannot sign,
// cannot send, cannot export keys, holds nothing, and refuses key-material input.
export function createNoopSigningAdapter() {
  return Object.freeze({
    status: UNCONFIGURED,
    isConfigured() { return false; },
    describe() { return describeSigningAdapterContract(); },
    // `sign` NEVER signs. It validates the preflight envelope and returns a fail-closed result. Even a fully
    // valid preflight yields signed:false / signature:null — real signing is a separate, later PR.
    sign(request) {
      const reason = rejectReason(request);
      if (reason) return failClosed(reason);
      return failClosed('noop_adapter_never_signs');
    },
  });
}

// Explicit predicate for tests/diagnostics.
export function signingAdapterRefusesKeyMaterial(input) {
  return refusesKeyMaterial(input);
}

export const SIGNING_ADAPTER_CONTRACT_STATUS = UNCONFIGURED;
