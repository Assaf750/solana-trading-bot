// @soltrade/signer-profiles-registry — Signer Profiles registry + state machine (Gate C / C1).
// SOURCE: docs/01-SSOT.md G15 + docs/05-DATA-MODEL.md §4.8 (signer_profiles) + docs/03-API §12.2
// + docs/09-THREAT-SECURITY. REFERENCES-ONLY: holds signer_profile_id / status / custody mode ONLY.
// Deterministic, in-memory. NO private key/seed/keypair/mnemonic, NO KeyManager, NO signing library,
// NO signing/sending, NO RPC/provider, NO admission gate, NO DB writes, NO execution authority.
//
// INVARIANTS:
//  - register() starts DISABLED (ready requires an explicit ACTIVE transition; never auto-ACTIVE).
//  - REVOKED is terminal. Sensitive ops (register/revoke/disable) REQUIRE permission_role=signer_control.
//  - NO key material is ever accepted or stored.

import { SIGNER_PROFILE_STATUS, KEY_CUSTODY_MODE } from '../../ssot-types/src/core-enums.mjs';
import { PERMISSION_ROLE, API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';

const STATE_ERR = 'COMMAND_NOT_ALLOWED_IN_STATE';
const PERM_ERR = 'PERMISSION_DENIED';
for (const e of [STATE_ERR, PERM_ERR]) if (!API_ERROR_CODE.includes(e)) throw new Error(`internal: ${e} missing`);
const SIGNER_CONTROL = 'signer_control';
if (!PERMISSION_ROLE.includes(SIGNER_CONTROL)) throw new Error('internal: signer_control missing from permission_role');

// Explicit transition graph over signer_profile_status (SSOT G15). REVOKED is terminal.
const ALLOWED = Object.freeze({
  DISABLED: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['DISABLED', 'DEGRADED', 'REVOKED'],
  DEGRADED: ['ACTIVE', 'DISABLED', 'REVOKED'],
  REVOKED: [],
});

const isStr = (v) => typeof v === 'string' && v.length > 0;
// Fields that must NEVER appear on a signer profile (key material).
const FORBIDDEN_FIELDS = ['private_key', 'privateKey', 'secret_key', 'secretKey', 'seed', 'seed_phrase', 'mnemonic', 'keypair', 'secret'];
const hasSignerControl = (role) => role === SIGNER_CONTROL;

export function isTerminalSignerStatus(status) {
  return status === 'REVOKED';
}

export function createSignerProfilesRegistry() {
  const byId = new Map(); // signer_profile_id -> frozen record (references only)
  const set = (rec) => { byId.set(rec.signer_profile_id, Object.freeze(rec)); };

  return Object.freeze({
    /** Register a signer profile (reference). Requires signer_control. Starts DISABLED. No key material. */
    register(input = {}, { permission_role } = {}) {
      // Stage-20 hardening (reports/E2-STAGE-20): hostile/uninspectable input -> refuse, never throw.
      if (input == null || typeof input !== 'object' || Array.isArray(input)) return { ok: false, reason: 'invalid_request' };
      if (!hasSignerControl(permission_role)) return { ok: false, api_error_code: PERM_ERR, reason: 'signer_control_required' };
      try {
        if (!isStr(input.signer_profile_id)) return { ok: false, reason: 'signer_profile_id_required' };
        if (byId.has(input.signer_profile_id)) return { ok: false, reason: 'signer_profile_exists' };
        for (const f of FORBIDDEN_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(input, f)) return { ok: false, reason: 'key_material_not_accepted' };
        }
        const custody = input.key_custody_mode;
        if (custody != null && !KEY_CUSTODY_MODE.includes(custody)) return { ok: false, reason: 'invalid_key_custody_mode' };
        set({
          signer_profile_id: input.signer_profile_id,
          signer_profile_status: 'DISABLED', // never auto-ACTIVE
          key_custody_mode: custody ?? null,
        });
        return { ok: true, signer_profile_id: input.signer_profile_id, signer_profile_status: 'DISABLED' };
      } catch {
        return { ok: false, reason: 'invalid_request' };
      }
    },

    /** Explicit status transition. Sensitive targets (DISABLED/REVOKED) require signer_control. */
    transition(signer_profile_id, toStatus, { permission_role } = {}) {
      const cur = byId.get(signer_profile_id);
      if (!cur) return { ok: false, reason: 'signer_profile_not_found' };
      if (!SIGNER_PROFILE_STATUS.includes(toStatus)) return { ok: false, reason: 'invalid_signer_profile_status' };
      // signer control over the signer is a security-critical op.
      if (!hasSignerControl(permission_role)) return { ok: false, api_error_code: PERM_ERR, reason: 'signer_control_required' };
      const allowed = ALLOWED[cur.signer_profile_status] || [];
      if (!allowed.includes(toStatus)) {
        return { ok: false, api_error_code: STATE_ERR, reason: 'illegal_transition', from: cur.signer_profile_status, to: toStatus };
      }
      set({ ...cur, signer_profile_status: toStatus });
      return { ok: true, signer_profile_status: toStatus };
    },

    get(signer_profile_id) { return byId.get(signer_profile_id); },
    list() { return [...byId.values()]; },
    isTerminal(signer_profile_id) { const r = byId.get(signer_profile_id); return !!r && isTerminalSignerStatus(r.signer_profile_status); },
    get size() { return byId.size; },
    // NO key load/store. NO sign(). NO admission gate (C2). NO delete.
  });
}

export const SIGNER_PROFILE_TRANSITIONS = ALLOWED;
