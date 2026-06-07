// @soltrade/foundations — ProtocolConstantMonitor (Build Order #4).
// SOURCE: docs/00-ARCHITECTURE.md §10 + docs/01-SSOT.md G5 (protocol_constant_status).
// Pure comparison over CALLER-PROVIDED observed vs baseline constants (mocked/manual) —
// NO external fetch, NO network. Output is the SSOT enum protocol_constant_status
// (green | changed). `changed` => KILLED upstream (§10).
//
// FAIL-SAFE: a missing/unknown observed constant => `changed` (treat uncertainty as a
// protocol change → KILLED). Never silently report `green` on incomplete data.

import { PROTOCOL_CONSTANT_STATUS } from '../../ssot-types/src/core-enums.mjs';

const GREEN = 'green';
const CHANGED = 'changed';

/**
 * Compare observed protocol constants against a known baseline.
 * @param observed object of constant_name -> value (mocked/manual)
 * @param baseline object of constant_name -> expected value
 * @returns { protocol_constant_status, changed_keys, killed }
 */
export function evaluateProtocolConstants(observed, baseline) {
  if (baseline == null || typeof baseline !== 'object') {
    return { protocol_constant_status: CHANGED, changed_keys: [], killed: true, reason: 'missing_baseline' };
  }
  if (observed == null || typeof observed !== 'object') {
    return { protocol_constant_status: CHANGED, changed_keys: Object.keys(baseline), killed: true, reason: 'missing_observed' };
  }

  const changed_keys = [];
  for (const key of Object.keys(baseline)) {
    const obs = observed[key];
    // Unknown/missing observed value is fail-safe treated as a change.
    if (obs === undefined || obs === null) { changed_keys.push(key); continue; }
    if (obs !== baseline[key]) changed_keys.push(key);
  }

  const status = changed_keys.length === 0 ? GREEN : CHANGED;
  // status is one of the SSOT enum values by construction.
  if (!PROTOCOL_CONSTANT_STATUS.includes(status)) {
    throw new Error(`internal: status ${status} not in SSOT protocol_constant_status`);
  }
  return { protocol_constant_status: status, changed_keys, killed: status === CHANGED };
}
