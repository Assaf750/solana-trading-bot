// @soltrade/keyless-custody-lifecycle — Keyless Custody Lifecycle Model (Gate E / E2-0).
// SOURCE: docs/09-THREAT-SECURITY §3/§4 (isolation, fail-closed DEGRADED, zeroization, least-privilege,
//   revocation) + docs/01-SSOT G15 (signer_profile_status, key_custody_mode, signer commands) + G14 (audit).
//
// MOCK / in-memory / deterministic — NO KEYS. This models the custody STATE/LIFECYCLE only:
//   load -> use -> zeroize, with fail-closed DEGRADED on custody failure, least-privilege per
//   signer_profile_id, and revoke/disable/shutdown/panic handling. There is NO key material, NO KMS/vault,
//   NO KeyManager, NO crypto/signing library, NO transaction building/serialization, NO signing/sending,
//   NO RPC/provider, NO DB writes, NO REAL-LIVE, NO mechanism-guard carve-out, NO execution authority.
//
// `custody_phase` is an INTERNAL result-model state (NOT an SSOT field/enum). `custody_available` is a
// MOCK input representing KMS/vault availability (NOT an SSOT field). Key material is NEVER accepted,
// stored, or returned — even though there is no key here at all.

import { SIGNER_PROFILE_STATUS, KEY_CUSTODY_MODE } from '../../ssot-types/src/core-enums.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';

const RESOURCE = 'signer_profile'; // SSOT G11 resource_type / G14 audit_scope
const SIGNER_CONTROL = 'signer_control';
const REVOKE_CMD = 'revoke_signer_profile';   // SSOT G11 command_type
const DISABLE_CMD = 'disable_signer_profile'; // SSOT G11 command_type

// Internal custody lifecycle phases (result-model only; NOT registered in SSOT).
const PHASE = Object.freeze({ IDLE: 'idle', LOADED: 'loaded', DEGRADED: 'degraded', ZEROIZED: 'zeroized' });

// Raw key material must never be offered to the custody model.
const KEY_MATERIAL_KEYS = ['private_key', 'privateKey', 'secret_key', 'secretKey', 'seed', 'seed_phrase', 'mnemonic', 'keypair', 'secret'];
const isStr = (v) => typeof v === 'string' && v.length > 0;
const hasKeyMaterial = (o) => KEY_MATERIAL_KEYS.some((k) => Object.prototype.hasOwnProperty.call(o, k));

// A sign-like result NEVER carries a signature.
const NO_SIGNATURE = Object.freeze({ signed: false, signature: null, is_valid_on_chain: false, can_sign: false, can_send: false });

export function createKeylessCustodyLifecycle({ auditLog } = {}) {
  const audit = auditLog || createAuditLog();
  // session per signer_profile_id: { signer_profile_id, custody_phase, revoked, disabled }
  const sessions = new Map();

  function record(req, audit_reason, command_type) {
    const entry = { resource_type: RESOURCE, audit_scope: RESOURCE, audit_actor: req.audit_actor, audit_reason };
    if (command_type) entry.command_type = command_type;
    if (isStr(req.permission_role)) entry.permission_role = req.permission_role;
    if (isStr(req.request_id)) entry.request_id = req.request_id;
    audit.append(entry);
  }

  const sessionOf = (id) => sessions.get(id);
  const setPhase = (id, phase, extra = {}) => {
    const cur = sessions.get(id) || { signer_profile_id: id, custody_phase: PHASE.IDLE, revoked: false, disabled: false };
    sessions.set(id, Object.freeze({ ...cur, ...extra, signer_profile_id: id, custody_phase: phase }));
    return sessions.get(id);
  };

  // Common entry guards shared by load/use. Returns a refusal reason or null. NEVER touches keys.
  function gate(req, requireLoaded) {
    if (req == null || typeof req !== 'object') return 'invalid_request';
    if (hasKeyMaterial(req)) return 'key_material_not_accepted';
    if (!isStr(req.signer_profile_id)) return 'missing_signer_profile_id';
    // least-privilege: an existing session must match the requested profile.
    const sess = sessionOf(req.signer_profile_id);
    if (sess) {
      if (sess.revoked || sess.custody_phase === PHASE.ZEROIZED) return 'session_zeroized';
      if (sess.disabled) return 'session_disabled';
    }
    if (!SIGNER_PROFILE_STATUS.includes(req.signer_profile_status)) return 'invalid_signer_profile_status';
    if (req.signer_profile_status !== 'ACTIVE') return 'signer_not_active'; // DISABLED/REVOKED/DEGRADED rejected
    if (!KEY_CUSTODY_MODE.includes(req.key_custody_mode) || req.key_custody_mode !== 'isolated_signer') return 'custody_not_isolated_signer';
    if (requireLoaded) {
      if (!sess || sess.custody_phase !== PHASE.LOADED) return 'not_loaded';
    }
    return null;
  }

  return Object.freeze({
    PHASE,

    /** Mock "load" of signing material into isolated custody (NO key). Fail-closed to DEGRADED. */
    requestLoad(req = {}) {
      if (req == null || typeof req !== 'object') return { ...NO_SIGNATURE, ok: false, refusal_reason: 'invalid_request' };
      if (!isStr(req.audit_actor)) return { ...NO_SIGNATURE, ok: false, refusal_reason: 'audit_actor_required' };
      record(req, 'custody_load_attempt');
      const refusal = gate(req, false);
      if (refusal) { record(req, `custody_load_refused:${refusal}`); return { ...NO_SIGNATURE, ok: false, refusal_reason: refusal, signer_profile_id: req.signer_profile_id ?? null }; }
      // fail-closed: custody unavailable => DEGRADED, NOT loaded.
      if (req.custody_available !== true) {
        setPhase(req.signer_profile_id, PHASE.DEGRADED);
        record(req, 'custody_unavailable_degraded');
        return { ...NO_SIGNATURE, ok: false, refusal_reason: 'custody_unavailable_degraded', custody_phase: PHASE.DEGRADED, recommended_signer_profile_status: 'DEGRADED', signer_profile_id: req.signer_profile_id };
      }
      setPhase(req.signer_profile_id, PHASE.LOADED);
      record(req, 'custody_loaded');
      return { ...NO_SIGNATURE, ok: true, loaded: true, usable: true, custody_phase: PHASE.LOADED, signer_profile_id: req.signer_profile_id };
      // NOTE: "loaded/usable" is a mock state. No key was loaded; no signature is possible.
    },

    /** Mock "use" — a request reaching custody. Requires LOADED. NEVER produces a signature. */
    use(req = {}) {
      if (req == null || typeof req !== 'object') return { ...NO_SIGNATURE, ok: false, refusal_reason: 'invalid_request' };
      if (!isStr(req.audit_actor)) return { ...NO_SIGNATURE, ok: false, refusal_reason: 'audit_actor_required' };
      record(req, 'custody_use_attempt');
      const refusal = gate(req, true);
      if (refusal) { record(req, `custody_use_refused:${refusal}`); return { ...NO_SIGNATURE, ok: false, refusal_reason: refusal, signer_profile_id: req.signer_profile_id ?? null }; }
      if (req.custody_available !== true) {
        setPhase(req.signer_profile_id, PHASE.DEGRADED);
        record(req, 'custody_unavailable_degraded');
        return { ...NO_SIGNATURE, ok: false, refusal_reason: 'custody_unavailable_degraded', custody_phase: PHASE.DEGRADED, recommended_signer_profile_status: 'DEGRADED', signer_profile_id: req.signer_profile_id };
      }
      record(req, 'custody_used');
      return { ...NO_SIGNATURE, ok: true, used: true, usable: true, custody_phase: PHASE.LOADED, signer_profile_id: req.signer_profile_id };
      // NOTE: still NO signature. Custody "use" here only confirms a usable mock state.
    },

    /** Report a custody/KMS failure => fail-closed DEGRADED (no signing on unverified custody). */
    reportCustodyFailure(req = {}) {
      if (!isStr(req.audit_actor)) return { ok: false, refusal_reason: 'audit_actor_required' };
      if (!isStr(req.signer_profile_id)) { record(req, 'custody_failure_refused:missing_signer_profile_id'); return { ok: false, refusal_reason: 'missing_signer_profile_id' }; }
      setPhase(req.signer_profile_id, PHASE.DEGRADED);
      record(req, 'custody_failure_degraded');
      return { ok: true, custody_phase: PHASE.DEGRADED, recommended_signer_profile_status: 'DEGRADED', signer_profile_id: req.signer_profile_id };
    },

    /** Simulated zeroize for a profile. Idempotent. No key exists; this is a state transition + audit. */
    zeroize(signer_profile_id, ctx = {}) {
      if (!isStr(ctx.audit_actor)) return { ok: false, refusal_reason: 'audit_actor_required' };
      if (!isStr(signer_profile_id)) return { ok: false, refusal_reason: 'missing_signer_profile_id' };
      const sess = sessionOf(signer_profile_id);
      const already = sess && sess.custody_phase === PHASE.ZEROIZED;
      setPhase(signer_profile_id, PHASE.ZEROIZED, sess ? {} : {});
      record({ ...ctx, signer_profile_id }, already ? 'custody_zeroize_idempotent' : 'custody_zeroized');
      return { ok: true, custody_phase: PHASE.ZEROIZED, zeroized: true, idempotent: !!already, signer_profile_id };
    },

    /** revoke_signer_profile (signer_control): simulated zeroize + terminal/unusable. */
    revoke(signer_profile_id, ctx = {}) {
      if (!isStr(ctx.audit_actor)) return { ok: false, refusal_reason: 'audit_actor_required' };
      if (ctx.permission_role !== SIGNER_CONTROL) { record({ ...ctx, signer_profile_id }, 'custody_revoke_refused:signer_control_required', REVOKE_CMD); return { ok: false, refusal_reason: 'signer_control_required' }; }
      if (!isStr(signer_profile_id)) return { ok: false, refusal_reason: 'missing_signer_profile_id' };
      setPhase(signer_profile_id, PHASE.ZEROIZED, { revoked: true });
      record({ ...ctx, signer_profile_id }, 'custody_revoked_zeroized', REVOKE_CMD);
      return { ok: true, custody_phase: PHASE.ZEROIZED, revoked: true, zeroized: true, signer_profile_id };
    },

    /** disable_signer_profile (signer_control): make the session unusable (rejects load/use). */
    disable(signer_profile_id, ctx = {}) {
      if (!isStr(ctx.audit_actor)) return { ok: false, refusal_reason: 'audit_actor_required' };
      if (ctx.permission_role !== SIGNER_CONTROL) { record({ ...ctx, signer_profile_id }, 'custody_disable_refused:signer_control_required', DISABLE_CMD); return { ok: false, refusal_reason: 'signer_control_required' }; }
      if (!isStr(signer_profile_id)) return { ok: false, refusal_reason: 'missing_signer_profile_id' };
      const sess = sessionOf(signer_profile_id);
      setPhase(signer_profile_id, sess ? sess.custody_phase : PHASE.IDLE, { disabled: true });
      record({ ...ctx, signer_profile_id }, 'custody_disabled', DISABLE_CMD);
      return { ok: true, disabled: true, signer_profile_id };
    },

    /** Simulated shutdown/panic: zeroize ALL sessions. Idempotent. */
    shutdown(ctx = {}) { return this_zeroizeAll(audit, sessions, setPhase, ctx, 'shutdown'); },
    panic(ctx = {}) { return this_zeroizeAll(audit, sessions, setPhase, ctx, 'panic'); },

    get(signer_profile_id) { return sessionOf(signer_profile_id); },
    list() { return [...sessions.values()]; },
    auditLog: audit,
    // No sign(). No send(). No serialize(). No loadKey(). No KeyManager. No KMS. No crypto. By design.
  });
}

// Zeroize every session (shutdown/panic). Records one audit event; idempotent.
function this_zeroizeAll(audit, sessions, setPhase, ctx, kind) {
  const ids = [...sessions.keys()];
  for (const id of ids) setPhase(id, 'zeroized');
  audit.append({ resource_type: 'signer_profile', audit_scope: 'signer_profile', audit_actor: typeof ctx.audit_actor === 'string' ? ctx.audit_actor : 'system', audit_reason: `custody_${kind}_zeroize_all:${ids.length}` });
  return { ok: true, zeroized_sessions: ids.length, kind };
}

export const CUSTODY_PHASE = PHASE;
