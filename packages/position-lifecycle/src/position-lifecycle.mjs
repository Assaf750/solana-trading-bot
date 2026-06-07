// @soltrade/position-lifecycle — PositionLifecycleStateMachine (Gate B / B3).
// SOURCE: docs/00-ARCHITECTURE.md §15.1 (PositionLifecycleStateMachine) + §4.1 (Migration Handoff)
// + docs/05-DATA-MODEL.md §4.3 (positions) + docs/01-SSOT.md G1/G2/G4/G9.
// Deterministic, in-memory only. NO real DB writes, NO execution, NO signing/sending, NO network.
//
// INVARIANTS:
//  - Only explicit transitions are allowed; illegal ones are rejected (COMMAND_NOT_ALLOWED_IN_STATE).
//  - Terminal states (CLOSED / CLOSED_WITH_DUST / FAILED_ENTRY) never reopen; FAILED_EXIT never -> OPEN.
//  - No two conflicting actions: a *_PENDING / terminal state restricts the next transition.
//  - entry_brain and config_version_at_entry are frozen at entry.
//  - current_control_brain only changes via migration handover (brain_a -> brain_b at LP_MINTED+).

import { POSITION_STATE, MIGRATION_PHASE, STRATEGY_BRAIN } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';

const STATE_ERR = 'COMMAND_NOT_ALLOWED_IN_STATE'; // SSOT G11 (must exist)
if (!API_ERROR_CODE.includes(STATE_ERR)) throw new Error('internal: COMMAND_NOT_ALLOWED_IN_STATE missing');

const TERMINAL = new Set(['CLOSED', 'CLOSED_WITH_DUST', 'FAILED_ENTRY']);

// Explicit transition graph over position_state (SSOT G1). Terminal states have no outgoing.
const ALLOWED = Object.freeze({
  OPENING: ['OPEN', 'FAILED_ENTRY'],
  OPEN: ['PARTIALLY_EXITING', 'EXIT_PENDING', 'MIRROR_SELL_PENDING', 'MIGRATION_PENDING', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  PARTIALLY_EXITING: ['OPEN', 'EXIT_PENDING', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  EXIT_PENDING: ['PARTIALLY_EXITING', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  MIRROR_SELL_PENDING: ['PARTIALLY_EXITING', 'OPEN', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  MIGRATION_PENDING: ['OPEN', 'EXIT_PENDING', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  FAILED_EXIT: ['EXIT_PENDING', 'CLOSED', 'CLOSED_WITH_DUST'],
  CLOSED: [],
  CLOSED_WITH_DUST: [],
  FAILED_ENTRY: [],
});

// Forward-only migration order (SSOT G1). On-chain detected upstream (not here).
const MIG_ORDER = ['PRE_MIGRATION', 'MIGRATION_APPROACHING', 'MIGRATION_IN_PROGRESS', 'LP_MINTED', 'POST_MIGRATION_ACTIVE'];
// Control handover to Brain B is permitted only at/after canonical pool mint.
const HANDOVER_PHASES = new Set(['LP_MINTED', 'POST_MIGRATION_ACTIVE']);

const isStr = (v) => typeof v === 'string' && v.length > 0;

export function isTerminalState(position_state) {
  return TERMINAL.has(position_state);
}

export function createPositionLifecycle({ audit } = {}) {
  const byId = new Map(); // id (storage-only) -> frozen position record
  const auditSink = audit || createAuditLog();
  const audited = (entry) => auditSink.append({ resource_type: 'position', ...entry });
  const set = (rec) => { byId.set(rec.id, Object.freeze(rec)); };

  return Object.freeze({
    /** Open a new position in OPENING. entry_brain & config_version_at_entry are frozen here. */
    open(position = {}) {
      if (!isStr(position.id)) return { ok: false, reason: 'id_required' };
      if (byId.has(position.id)) return { ok: false, reason: 'position_exists' };
      if (!STRATEGY_BRAIN.includes(position.entry_brain)) return { ok: false, reason: 'invalid_entry_brain' };
      if (position.config_version_at_entry == null) return { ok: false, reason: 'config_version_at_entry_required' };
      const migration_phase = position.migration_phase ?? 'PRE_MIGRATION';
      if (!MIGRATION_PHASE.includes(migration_phase)) return { ok: false, reason: 'invalid_migration_phase' };
      set({
        id: position.id,
        position_state: 'OPENING',
        entry_brain: position.entry_brain,                  // frozen
        current_control_brain: position.entry_brain,        // starts as entry brain
        migration_phase,
        market_phase: migration_phase,                       // G4: market_phase mirrors migration_phase
        active_exit_route: position.active_exit_route ?? null,
        config_version_at_entry: position.config_version_at_entry, // frozen
      });
      audited({});
      return { ok: true, id: position.id };
    },

    transition(id, toState) {
      const cur = byId.get(id);
      if (!cur) return { ok: false, reason: 'position_not_found' };
      if (!POSITION_STATE.includes(toState)) return { ok: false, reason: 'invalid_position_state' };
      const allowed = ALLOWED[cur.position_state] || [];
      if (!allowed.includes(toState)) {
        return { ok: false, api_error_code: STATE_ERR, reason: 'illegal_transition', from: cur.position_state, to: toState };
      }
      set({ ...cur, position_state: toState });
      audited({});
      return { ok: true, position_state: toState };
    },

    /** Forward-only migration phase advance; mirrors into market_phase. */
    advanceMigrationPhase(id, toPhase) {
      const cur = byId.get(id);
      if (!cur) return { ok: false, reason: 'position_not_found' };
      const fromIdx = MIG_ORDER.indexOf(cur.migration_phase);
      const toIdx = MIG_ORDER.indexOf(toPhase);
      if (toIdx < 0) return { ok: false, reason: 'invalid_migration_phase' };
      if (toIdx <= fromIdx) return { ok: false, api_error_code: STATE_ERR, reason: 'migration_phase_not_forward' };
      set({ ...cur, migration_phase: toPhase, market_phase: toPhase });
      audited({});
      return { ok: true, migration_phase: toPhase };
    },

    /** Control handover (brain_a -> brain_b) only at/after LP_MINTED. entry_brain stays frozen. */
    handoverControlBrain(id, toBrain) {
      const cur = byId.get(id);
      if (!cur) return { ok: false, reason: 'position_not_found' };
      if (!STRATEGY_BRAIN.includes(toBrain)) return { ok: false, reason: 'invalid_brain' };
      const valid = cur.current_control_brain === 'brain_a' && toBrain === 'brain_b' && HANDOVER_PHASES.has(cur.migration_phase);
      if (!valid) return { ok: false, api_error_code: STATE_ERR, reason: 'illegal_control_handover' };
      set({ ...cur, current_control_brain: toBrain }); // entry_brain & config_version_at_entry untouched
      audited({});
      return { ok: true, current_control_brain: toBrain };
    },

    get(id) { return byId.get(id); },
    list() { return [...byId.values()]; },
    isTerminal(id) { const r = byId.get(id); return !!r && TERMINAL.has(r.position_state); },
    auditEntries() { return auditSink.list(); },
    get size() { return byId.size; },
    // NO delete / reopen / setConfigVersion / setEntryBrain — by design.
  });
}

export const POSITION_TRANSITIONS = ALLOWED;
export const POSITION_TERMINAL_STATES = Object.freeze([...TERMINAL]);
