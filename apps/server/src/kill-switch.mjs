// kill-switch.mjs — hierarchical kill switch: global / per-mode / per-wallet / per-strategy.
// Persisted (a restart NEVER silently resumes trading). Every change audited by the caller.
// Fail-safe semantics: unknown/corrupt state == ENGAGED.
import { readJson, writeJson, nowIso } from './util.mjs';

const FILE = 'kill-switch.json';

const DEFAULT = {
  global: { engaged: false, reason: null, at: null },
  per_mode: {},     // { paper: {...}, real_live: {...} }
  per_wallet: {},   // { <wallet_id>: {...} }
  per_strategy: {}, // { <strategy>: {...} }
};

export function createKillSwitch() {
  function load() {
    const { value, corrupt } = readJson(FILE, null);
    if (corrupt) {
      // fail-safe: corrupt kill-switch state == globally ENGAGED
      return { ...structuredClone(DEFAULT), global: { engaged: true, reason: 'kill_state_corrupt_fail_safe', at: nowIso() } };
    }
    return value || structuredClone(DEFAULT);
  }

  function status() {
    return load();
  }

  /** True if ANY applicable level blocks the given scope. */
  function isBlocked({ mode, wallet_id, strategy } = {}) {
    const s = load();
    // global is mandatory: a missing/undefined global reads as ENGAGED (fail-safe).
    if (s.global?.engaged !== false) return { blocked: true, level: 'global' };
    // sub-levels are sparse maps (an entry exists only once set). A PRESENT entry blocks unless
    // engaged is STRICTLY false — so a corrupt/partial entry (missing engaged) fails safe (blocked)
    // instead of silently failing open, while an absent entry correctly means "no kill for that scope".
    const eng = (e) => e && e.engaged !== false;
    if (mode && eng(s.per_mode?.[mode])) return { blocked: true, level: 'per_mode' };
    if (wallet_id && eng(s.per_wallet?.[wallet_id])) return { blocked: true, level: 'per_wallet' };
    if (strategy && eng(s.per_strategy?.[strategy])) return { blocked: true, level: 'per_strategy' };
    return { blocked: false, level: null };
  }

  function engage({ level = 'global', key = null, reason = 'manual' }) {
    const s = load();
    const entry = { engaged: true, reason: String(reason).slice(0, 200), at: nowIso() };
    if (level === 'global') s.global = entry;
    else if (level === 'per_mode' && key) s.per_mode[key] = entry;
    else if (level === 'per_wallet' && key) s.per_wallet[key] = entry;
    else if (level === 'per_strategy' && key) s.per_strategy[key] = entry;
    else return { ok: false, error: 'invalid_level_or_key' };
    writeJson(FILE, s);
    return { ok: true, state: s };
  }

  /** Disengage requires explicit human action (API caller enforces permission+audit). */
  function disengage({ level = 'global', key = null }) {
    const s = load();
    const entry = { engaged: false, reason: null, at: nowIso() };
    if (level === 'global') s.global = entry;
    else if (level === 'per_mode' && key) s.per_mode[key] = entry;
    else if (level === 'per_wallet' && key) s.per_wallet[key] = entry;
    else if (level === 'per_strategy' && key) s.per_strategy[key] = entry;
    else return { ok: false, error: 'invalid_level_or_key' };
    writeJson(FILE, s);
    return { ok: true, state: s };
  }

  return { status, isBlocked, engage, disengage };
}
