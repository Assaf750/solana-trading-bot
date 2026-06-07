// @soltrade/signer-boundary — SignerService boundary (MOCK / isolated, Gate B / B0).
// SOURCE: docs/00-ARCHITECTURE.md §4.3 (Signer isolation) + docs/01-SSOT.md G15 + docs/09-THREAT-SECURITY.
// This is the ISOLATION SEAM only. It NEVER signs, NEVER sends, NEVER builds a transaction,
// holds NO key material, reads NO files/.env, and makes NO network calls. Deterministic mock.
//
// INVARIANTS (always, every path):
//  - signed === false, signature === null, is_valid_on_chain === false.
//  - any non-paper / REAL / LIVE request is REFUSED.
//  - key material offered in the request is REFUSED and never stored.
//  - no can_sign / can_send capability.

import { SIGNER_PROFILE_STATUS, KEY_CUSTODY_MODE } from '../../ssot-types/src/core-enums.mjs';

const PAPER = 'paper';
const NOTE = 'mock SignerService boundary (Gate B): no signing, no sending; result is NOT a signature and NOT valid on-chain';

// Keys that would indicate raw key material — the boundary refuses to receive any of these.
const KEY_MATERIAL_KEYS = ['private_key', 'privateKey', 'secret_key', 'secretKey', 'seed', 'seed_phrase', 'mnemonic', 'keypair', 'secret'];

function base() {
  // Immutable non-signature envelope. signed/signature/is_valid_on_chain are fixed.
  return { signed: false, signature: null, is_valid_on_chain: false, note: NOTE };
}

/**
 * Create the isolated mock SignerService boundary. Holds no state and no key material.
 */
export function createSignerBoundary() {
  return Object.freeze({
    /** The boundary cannot sign or send — by construction. */
    capabilities() {
      return Object.freeze({ can_sign: false, can_send: false, mock: true });
    },

    /**
     * Receive a signing intent. ALWAYS returns a non-signature mock; never signs/sends.
     * @param intent { mode, signer_profile_id, signer_profile_status, key_custody_mode? }
     */
    requestSignature(intent = {}) {
      const b = base();
      if (intent == null || typeof intent !== 'object') {
        return { ...b, accepted: false, refusal_reason: 'invalid_intent' };
      }
      // Refuse and never store any raw key material offered.
      for (const k of KEY_MATERIAL_KEYS) {
        if (Object.prototype.hasOwnProperty.call(intent, k)) {
          return { ...b, accepted: false, refusal_reason: 'key_material_not_accepted' };
        }
      }
      // Refuse anything that is not an explicit paper request (no live/real signing here).
      if (intent.mode !== PAPER) {
        return { ...b, accepted: false, refusal_reason: 'live_or_nonpaper_signing_refused' };
      }
      const id = intent.signer_profile_id;
      if (typeof id !== 'string' || id.length === 0) {
        return { ...b, accepted: false, refusal_reason: 'missing_signer_profile_id' };
      }
      const status = intent.signer_profile_status;
      if (!SIGNER_PROFILE_STATUS.includes(status)) {
        return { ...b, accepted: false, refusal_reason: 'invalid_signer_profile_status', signer_profile_id: id };
      }
      if (status !== 'ACTIVE') {
        return { ...b, accepted: false, refusal_reason: 'signer_not_active', signer_profile_id: id, signer_profile_status: status };
      }
      const custody = intent.key_custody_mode;
      if (custody != null && !KEY_CUSTODY_MODE.includes(custody)) {
        return { ...b, accepted: false, refusal_reason: 'invalid_key_custody_mode', signer_profile_id: id };
      }
      // Accepted PAPER mock request — STILL produces no signature.
      return {
        ...b,
        accepted: true,
        mode: PAPER,
        signer_profile_id: id,
        signer_profile_status: status,
        key_custody_mode: custody ?? null,
      };
    },
    // No sign(). No send(). No submit(). No serializeTransaction(). No loadKey(). By design.
  });
}

export const SIGNER_BOUNDARY_NOTE = NOTE;
