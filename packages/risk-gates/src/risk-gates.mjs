// @soltrade/risk-gates — Hard Risk enforcement (Gate B / B1).
// SOURCE: docs/00-ARCHITECTURE.md §5/§10 + docs/02-CONFIG §6/§11 + docs/01-SSOT.md G6/G11.
// Deterministic, local, NO external calls. Enforcement layer (NOT a sidecar) — there is no
// option to disable/bypass enforcement.
//
// INVARIANTS:
//  - Hard Risk limits are ALWAYS binding; ev_gate_mode (incl. warning_only) NEVER relaxes them.
//  - A missing Hard Risk limit is NOT "no limit": it is fail-safe BLOCK + real_live_config_valid=false.
//  - An unverifiable dimension (limit set but no measured value) is fail-safe BLOCK (no fail-open).
//  - No new threshold is introduced; only the nine SSOT limit names are compared.

import { HARD_RISK_FIELDS } from '../../config/src/schema.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';

const BLOCK_CODE = 'HARD_RISK_BYPASS_REJECTED'; // SSOT G11 (must exist)
if (!API_ERROR_CODE.includes(BLOCK_CODE)) {
  throw new Error('internal: HARD_RISK_BYPASS_REJECTED missing from api_error_code');
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Evaluate a proposed action against Hard Risk limits.
 * @param input {
 *   risk_config: Record<hardRiskLimit, number>,   // the nine SSOT limits (values)
 *   measured:    Record<hardRiskLimit, number>,   // current value per dimension (same nine names)
 *   ev_gate_mode?: 'strict' | 'warning_only'      // read-only; does NOT relax Hard Risk
 * }
 * @returns deterministic decision (allow/block) — Hard Risk always enforced.
 */
export function evaluateHardRisk(input = {}) {
  const risk = (input && typeof input.risk_config === 'object' && input.risk_config) || {};
  const measured = (input && typeof input.measured === 'object' && input.measured) || {};

  const violations = [];
  const missing_limits = [];
  const unverifiable = [];

  for (const name of HARD_RISK_FIELDS) {
    const limit = risk[name];
    if (!isNum(limit)) { missing_limits.push(name); continue; } // missing limit != no limit
    const value = measured[name];
    if (!isNum(value)) { unverifiable.push(name); continue; }   // cannot verify -> fail-safe
    if (value > limit) violations.push({ limit: name, limit_value: limit, measured_value: value });
  }

  const real_live_config_valid = missing_limits.length === 0;
  const blocked = violations.length > 0 || missing_limits.length > 0 || unverifiable.length > 0;

  const result = {
    decision: blocked ? 'block' : 'allow',
    violations,
    missing_limits,
    unverifiable,
    real_live_config_valid,
    hard_risk_enforced: true, // always — never relaxed by ev_gate_mode or any option
  };

  if (blocked) {
    result.api_error_code = BLOCK_CODE;
    result.reason = violations.length
      ? 'hard_risk_limit_exceeded'
      : (missing_limits.length ? 'hard_risk_limit_missing' : 'hard_risk_unverifiable');
  }
  return result;
}

export const HARD_RISK_LIMIT_NAMES = HARD_RISK_FIELDS;
export const HARD_RISK_BLOCK_CODE = BLOCK_CODE;
