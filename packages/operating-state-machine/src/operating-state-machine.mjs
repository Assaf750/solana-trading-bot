// @soltrade/operating-state-machine — OperatingStateMachine (Gate B / B10).
// SOURCE: docs/00-ARCHITECTURE.md §10 (Operating State Machine) + docs/01-SSOT.md G1 (operating_state) / G5.
// Deterministic, in-memory. Maps health signals -> operating_state and gates actions.
// NO live provider/RPC, NO network, NO DB, NO signing/sending, NO execution authority.
//
// FAIL-SAFE-NOT-FAIL-OPEN:
//  - protocol_constant_status='changed' -> KILLED (sticky; human reset only).
//  - provider_degraded / stream_gap / slot_lag>threshold / unverifiable health -> EXITS_ONLY.
//  - ACTIVE only when health is EXPLICITLY confirmed green.
//  - EXITS_ONLY blocks new entries, permits exits. KILLED blocks all but safe diagnostics.

import { OPERATING_STATE, PROTOCOL_CONSTANT_STATUS } from '../../ssot-types/src/core-enums.mjs';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Action gating policy per operating_state. Unknown action => false (fail-safe).
// NOTE: ARCH §10 permits Emergency Exit under KILLED in the LIVE execution path; this Gate-B
// paper policy is conservative (diagnostics-only under KILLED) pending the live exit/KILLED path.
const ACTION_POLICY = Object.freeze({
  WARMING_UP: { entry: false, exit: false, emergency_exit: false, diagnostic: true },
  ACTIVE: { entry: true, exit: true, emergency_exit: true, diagnostic: true },
  EXITS_ONLY: { entry: false, exit: true, emergency_exit: true, diagnostic: true },
  PAUSED: { entry: false, exit: true, emergency_exit: true, diagnostic: true },
  KILLED: { entry: false, exit: false, emergency_exit: false, diagnostic: true },
});

/** Pure: derive the target operating_state from health signals. */
export function evaluateTarget(signals = {}, options = {}) {
  const s = signals || {};
  const threshold = options.slot_lag_threshold;

  // Hard kill: a changed protocol constant.
  if (s.protocol_constant_status === 'changed') return { operating_state: 'KILLED', reason: 'protocol_constant_changed' };
  // Unverifiable protocol status -> fail-safe EXITS_ONLY.
  if (s.protocol_constant_status != null && !PROTOCOL_CONSTANT_STATUS.includes(s.protocol_constant_status)) {
    return { operating_state: 'EXITS_ONLY', reason: 'protocol_status_unverifiable', warning: 'WARNING_CRITICAL' };
  }
  if (s.provider_degraded === true) return { operating_state: 'EXITS_ONLY', reason: 'provider_degraded', warning: 'WARNING_CRITICAL' };
  if (s.stream_gap === true) return { operating_state: 'EXITS_ONLY', reason: 'stream_gap', warning: 'WARNING_CRITICAL' };
  if (isNum(s.slot_lag) && isNum(threshold) && s.slot_lag > threshold) {
    return { operating_state: 'EXITS_ONLY', reason: 'slot_lag_exceeded', warning: 'WARNING_CRITICAL' };
  }

  // ACTIVE requires EXPLICIT healthy confirmation (no fail-open on unknowns).
  const slotOk = !isNum(s.slot_lag) || (isNum(threshold) && s.slot_lag <= threshold);
  const healthyConfirmed = s.provider_degraded === false && s.protocol_constant_status === 'green' && slotOk;
  if (!healthyConfirmed) return { operating_state: 'EXITS_ONLY', reason: 'health_unverifiable', warning: 'WARNING_CRITICAL' };
  return { operating_state: 'ACTIVE', reason: 'healthy' };
}

export function createOperatingStateMachine({ initial = 'WARMING_UP', slot_lag_threshold } = {}) {
  if (!OPERATING_STATE.includes(initial)) throw new Error(`invalid initial operating_state: ${initial}`);
  let state = initial;
  let lastReason = 'init';
  let lastWarning = null;

  return Object.freeze({
    getState() { return { operating_state: state, reason: lastReason, warning: lastWarning }; },

    /** Apply health signals. KILLED is sticky (human reset only). */
    apply(signals) {
      if (state === 'KILLED') {
        lastReason = 'killed_requires_human_reset';
        return this.getState();
      }
      const target = evaluateTarget(signals, { slot_lag_threshold });
      state = target.operating_state;
      lastReason = target.reason;
      lastWarning = target.warning ?? null;
      return this.getState();
    },

    /** Human-only resume from KILLED -> WARMING_UP (ARCH §10). */
    operatorReset() {
      state = 'WARMING_UP';
      lastReason = 'operator_reset';
      lastWarning = null;
      return this.getState();
    },

    /** Is an action category permitted in the current operating_state? Unknown => false. */
    isActionAllowed(action) {
      const policy = ACTION_POLICY[state] || {};
      return policy[action] === true;
    },
  });
}

export const OPERATING_ACTION_POLICY = ACTION_POLICY;
