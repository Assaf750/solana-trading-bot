// signer-service.mjs — local signer: vault-backed key custody + session discipline.
// M1 scope: key import (never displayed again), status machine, session open/lock with
// ALL bounds enforced (idle timeout, max duration, notional cap, kill-switch lock,
// N-consecutive-risk-rejection lock). Actual transaction signing arrives with the
// live engine (M4) and refuses unless this session says allowed.
//
// Status surface (UI): missing | locked | ready | degraded | failed
import { nowIso } from './util.mjs';

const SIGNER_SECRET_NAME = 'signer_keypair';
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{43,90}$/;

export function createSignerService({ vault, config, killSwitch, audit }) {
  let session = null; // { opened_at, last_activity_at, signed_notional_usd, risk_rejections_in_a_row }

  function bounds() {
    const ss = config.get().signer_session || {};
    const all = ['idle_timeout_ms', 'max_session_ms', 'max_session_notional_usd', 'lock_after_n_risk_rejections'];
    const ok = all.every((f) => typeof ss[f] === 'number' && Number.isFinite(ss[f]));
    return { ok, ...ss };
  }

  function keyImported() {
    return vault.hasSecret(SIGNER_SECRET_NAME);
  }

  /** Import the signer key into the encrypted vault. Accepts base58 secret or JSON byte array.
   *  The raw value is validated, stored, wiped from scope — and NEVER returned/displayed. */
  function importKey(rawSecret) {
    if (!vault.isUnlocked()) return { ok: false, error: 'vault_locked' };
    let normalized = null;
    if (typeof rawSecret === 'string' && BASE58_RE.test(rawSecret.trim())) {
      normalized = rawSecret.trim();
    } else if (typeof rawSecret === 'string') {
      try {
        const arr = JSON.parse(rawSecret);
        if (Array.isArray(arr) && (arr.length === 64 || arr.length === 32)
          && arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
          normalized = JSON.stringify(arr);
        }
      } catch { /* not JSON */ }
    }
    if (!normalized) return { ok: false, error: 'unrecognized_key_format_use_base58_or_json_array' };
    const res = vault.setSecret(SIGNER_SECRET_NAME, normalized);
    if (!res.ok) return res;
    audit({ audit_scope: 'config', audit_reason: 'signer_key_imported', command_type: 'register_signer_profile', detail: { ref: res.ref } });
    return { ok: true, ref: res.ref };
  }

  function deleteKey() {
    const res = vault.deleteSecret(SIGNER_SECRET_NAME);
    if (res.ok) {
      session = null;
      audit({ audit_scope: 'config', audit_reason: 'signer_key_deleted', command_type: 'revoke_signer_profile', detail: {} });
    }
    return res;
  }

  function enforceSessionExpiry() {
    if (!session) return;
    const b = bounds();
    const now = Date.now();
    if (killSwitch.isBlocked({ mode: 'real_live' }).blocked) {
      session = null; // immediate lock on kill switch
      return;
    }
    if (!b.ok) { session = null; return; }
    if (now - session.last_activity_at > b.idle_timeout_ms) { session = null; return; }
    if (now - session.opened_at > b.max_session_ms) { session = null; return; }
  }

  function openSession() {
    if (!keyImported()) return { ok: false, error: 'signer_key_missing' };
    if (!vault.isUnlocked()) return { ok: false, error: 'vault_locked' };
    const b = bounds();
    if (!b.ok) return { ok: false, error: 'session_bounds_not_configured' };
    if (killSwitch.isBlocked({ mode: 'real_live' }).blocked) return { ok: false, error: 'kill_switch_engaged' };
    session = {
      opened_at: Date.now(),
      last_activity_at: Date.now(),
      signed_notional_usd: 0,
      risk_rejections_in_a_row: 0,
    };
    audit({ audit_scope: 'config', audit_reason: 'signer_session_opened', command_type: null, detail: { bounds: b } });
    return { ok: true };
  }

  function lockSession(reason = 'manual') {
    if (session) audit({ audit_scope: 'config', audit_reason: `signer_session_locked_${reason}`, command_type: null, detail: {} });
    session = null;
    return { ok: true };
  }

  /** Gate used by the live engine before EVERY signing request (M4 consumer). */
  function canSignNow({ notional_usd = 0 } = {}) {
    enforceSessionExpiry();
    if (!session) return { allowed: false, reason: 'no_active_session' };
    const b = bounds();
    if (!b.ok) { session = null; return { allowed: false, reason: 'session_bounds_not_configured' }; }
    if (killSwitch.isBlocked({ mode: 'real_live' }).blocked) { session = null; return { allowed: false, reason: 'kill_switch_engaged' }; }
    if (session.risk_rejections_in_a_row >= b.lock_after_n_risk_rejections) {
      session = null;
      return { allowed: false, reason: 'locked_after_consecutive_risk_rejections' };
    }
    if (session.signed_notional_usd + notional_usd > b.max_session_notional_usd) {
      return { allowed: false, reason: 'session_notional_cap_reached' };
    }
    return { allowed: true };
  }

  function recordSigned({ notional_usd = 0 } = {}) {
    if (!session) return;
    session.signed_notional_usd += notional_usd;
    session.last_activity_at = Date.now();
    session.risk_rejections_in_a_row = 0;
  }

  function recordRiskRejection() {
    if (!session) return;
    session.risk_rejections_in_a_row += 1;
    session.last_activity_at = Date.now();
    const b = bounds();
    if (b.ok && session.risk_rejections_in_a_row >= b.lock_after_n_risk_rejections) {
      lockSession('consecutive_risk_rejections');
    }
  }

  function status() {
    enforceSessionExpiry();
    if (!keyImported()) return 'missing';
    if (!vault.isUnlocked()) return 'locked';
    if (!bounds().ok) return 'degraded'; // key present but session bounds unset
    return session ? 'ready' : 'locked';
  }

  function publicState() {
    enforceSessionExpiry();
    const b = bounds();
    return {
      signer_status: status(),
      key_imported: keyImported(),
      vault_unlocked: vault.isUnlocked(),
      session_active: Boolean(session),
      session_opened_at: session ? new Date(session.opened_at).toISOString() : null,
      session_signed_notional_usd: session ? session.signed_notional_usd : null,
      session_bounds_configured: b.ok,
      checked_at: nowIso(),
    };
  }

  return {
    importKey, deleteKey, openSession, lockSession,
    canSignNow, recordSigned, recordRiskRejection, status, publicState,
    SIGNER_SECRET_NAME,
  };
}
