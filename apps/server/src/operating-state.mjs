// operating-state.mjs — system operating_state machine (SSOT Group 1):
// WARMING_UP · ACTIVE · EXITS_ONLY · PAUSED · KILLED
// Persisted; KILLED resumes only via explicit human action (resume_system after disengage).
import { readJson, writeJson, nowIso } from './util.mjs';

const FILE = 'operating-state.json';
export const OPERATING_STATES = ['WARMING_UP', 'ACTIVE', 'EXITS_ONLY', 'PAUSED', 'KILLED'];

const ALLOWED = {
  WARMING_UP: ['ACTIVE', 'PAUSED', 'KILLED', 'EXITS_ONLY'],
  ACTIVE: ['EXITS_ONLY', 'PAUSED', 'KILLED', 'WARMING_UP'],
  EXITS_ONLY: ['ACTIVE', 'PAUSED', 'KILLED', 'WARMING_UP'],
  PAUSED: ['WARMING_UP', 'ACTIVE', 'KILLED', 'EXITS_ONLY'],
  KILLED: ['WARMING_UP'], // human-only resume, via warm-up (caches/health not guaranteed)
};

export function createOperatingState() {
  function load() {
    const { value, corrupt } = readJson(FILE, null);
    if (corrupt) return { operating_state: 'KILLED', reason: 'state_file_corrupt_fail_safe', at: nowIso() };
    return value || { operating_state: 'WARMING_UP', reason: 'boot', at: nowIso() };
  }

  function get() {
    return load();
  }

  function transition(to, reason) {
    if (!OPERATING_STATES.includes(to)) return { ok: false, error: 'unknown_state' };
    const cur = load();
    if (cur.operating_state === to) return { ok: true, state: cur, unchanged: true };
    if (!ALLOWED[cur.operating_state]?.includes(to)) {
      return {
        ok: false,
        api_error_code: 'COMMAND_NOT_ALLOWED_IN_STATE',
        error: `transition_${cur.operating_state}_to_${to}_not_allowed`,
      };
    }
    const next = { operating_state: to, reason: String(reason || '').slice(0, 200), at: nowIso() };
    writeJson(FILE, next);
    return { ok: true, state: next };
  }

  return { get, transition };
}
