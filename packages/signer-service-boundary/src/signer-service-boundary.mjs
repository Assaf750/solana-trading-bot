// @soltrade/signer-service-boundary — SignerService Isolation Boundary CONTRACT (Gate E / E1).
// SOURCE: docs/00-ARCHITECTURE.md §4.3 (SignerService isolation) + docs/09-THREAT-SECURITY §3 (isolation
//   model, payload binding, approval freshness, audit before/after) + docs/01-SSOT G1/G10/G11/G15.
//
// This is the ISOLATION SEAM / request-response CONTRACT only. It is MOCK / in-memory / deterministic.
// It NEVER signs, NEVER sends, builds NO transaction, performs NO serialization, holds NO key material
// (refuses it), imports NO crypto/signing library, has NO KeyManager/KMS, makes NO RPC/provider call.
//
// INVARIANT on EVERY path: signed=false · signature=null · is_valid_on_chain=false · can_sign=false ·
// can_send=false. `contract_valid` only reports whether the Risk/Intent/State/binding/freshness gates
// passed — it NEVER produces a signature. There is no API/UI signing authority here.
//
// Mock contract inputs (NOT SSOT fields; 09-THREAT §3 frames digest/fingerprint + approval-TTL as
// implementation/security concepts): risk_approved · payload_digest/approved_payload_digest (opaque
// string refs, no crypto) · approval_age_slots/max_approval_age_slots (mock freshness, no blockhash/RPC).

import { SIGNER_PROFILE_STATUS, EXECUTION_WALLET_STATUS, OPERATING_STATE } from '../../ssot-types/src/core-enums.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';

const RESOURCE = 'signer_profile'; // SSOT G11 resource_type / G14 audit_scope
const NOTE = 'SignerService isolation boundary contract (Gate E / E1): no key, no signing, no sending; result is NOT a signature and NOT valid on-chain';

// Raw key material must never be offered to the boundary.
const KEY_MATERIAL_KEYS = ['private_key', 'privateKey', 'secret_key', 'secretKey', 'seed', 'seed_phrase', 'mnemonic', 'keypair', 'secret'];

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Immutable non-signature envelope. signed/signature/is_valid_on_chain/can_sign/can_send are fixed.
const envelope = () => ({ signed: false, signature: null, is_valid_on_chain: false, can_sign: false, can_send: false, note: NOTE });

// Ordered gate checks. Returns the first refusal reason, or null if all pass. NEVER signs.
function firstRefusal(req) {
  for (const k of KEY_MATERIAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(req, k)) return 'key_material_not_accepted';
  }
  // Intent checks (idempotency/intent identity) BEFORE anything else.
  if (!isStr(req.intent_id)) return 'missing_intent_id';
  if (!isStr(req.idempotency_key)) return 'missing_idempotency_key';
  // Risk check BEFORE any signing consideration (no signing before Risk approval).
  if (req.risk_approved !== true) return 'risk_not_approved';
  // State checks — all must be ACTIVE/valid.
  if (!SIGNER_PROFILE_STATUS.includes(req.signer_profile_status)) return 'invalid_signer_profile_status';
  if (req.signer_profile_status !== 'ACTIVE') return 'signer_not_active';
  if (!EXECUTION_WALLET_STATUS.includes(req.execution_wallet_status)) return 'invalid_execution_wallet_status';
  if (req.execution_wallet_status !== 'ACTIVE') return 'execution_wallet_not_active';
  if (!OPERATING_STATE.includes(req.operating_state)) return 'invalid_operating_state';
  if (req.operating_state !== 'ACTIVE') return 'operating_state_not_active';
  if (req.real_live_config_valid !== true) return 'real_live_config_invalid';
  // Payload binding (mock opaque digest reference — NOT a hash, NO crypto).
  if (!isStr(req.payload_digest) || !isStr(req.approved_payload_digest)) return 'payload_binding_missing';
  if (req.payload_digest !== req.approved_payload_digest) return 'payload_binding_mismatch';
  // Approval freshness (mock numeric age vs threshold — NO blockhash, NO RPC).
  if (!isNum(req.approval_age_slots) || !isNum(req.max_approval_age_slots)) return 'approval_freshness_missing';
  if (req.approval_age_slots > req.max_approval_age_slots) return 'approval_stale';
  return null;
}

export function createSignerServiceBoundary({ auditLog } = {}) {
  const audit = auditLog || createAuditLog();

  function record(req, audit_reason) {
    const entry = { resource_type: RESOURCE, audit_scope: RESOURCE, audit_actor: req.audit_actor, audit_reason };
    if (isStr(req.idempotency_key)) entry.idempotency_key = req.idempotency_key;
    if (isStr(req.request_id)) entry.request_id = req.request_id;
    audit.append(entry);
  }

  return Object.freeze({
    /** The boundary cannot sign or send — by construction. */
    capabilities() { return Object.freeze({ can_sign: false, can_send: false, mock: true }); },

    /**
     * Receive a signing request and validate it against all Risk/Intent/State/binding/freshness gates.
     * ALWAYS returns a non-signature envelope; NEVER signs, NEVER sends. Audits before AND after.
     */
    requestSign(req = {}) {
      const out = envelope();
      if (req == null || typeof req !== 'object') return { ...out, contract_valid: false, refusal_reason: 'invalid_request' };
      // Cannot attribute a signing attempt without an actor -> refuse before any audit.
      if (!isStr(req.audit_actor)) return { ...out, contract_valid: false, refusal_reason: 'audit_actor_required' };

      // Audit BEFORE the attempt (09-THREAT §3: no silent signing path).
      record(req, `signer_request_before:intent=${isStr(req.intent_id) ? req.intent_id : 'none'}`);

      const refusal = firstRefusal(req);
      const contract_valid = refusal === null;

      // Audit AFTER the attempt with the outcome.
      record(req, contract_valid ? 'signer_request_after:contract_valid' : `signer_request_after:refused:${refusal}`);

      return {
        ...out, // signed:false, signature:null, is_valid_on_chain:false, can_sign:false, can_send:false
        contract_valid,
        ...(refusal ? { refusal_reason: refusal } : {}),
        intent_id: isStr(req.intent_id) ? req.intent_id : null,
        idempotency_key: isStr(req.idempotency_key) ? req.idempotency_key : null,
      };
      // NOTE: even when contract_valid is true, NO signature is produced and NOTHING is sent.
    },

    auditLog: audit,
    // No sign(). No send(). No submit(). No serialize(). No buildTransaction(). No loadKey(). No KeyManager. By design.
  });
}

export const SIGNER_SERVICE_BOUNDARY_NOTE = NOTE;
