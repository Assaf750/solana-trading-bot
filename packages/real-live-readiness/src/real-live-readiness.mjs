// @soltrade/real-live-readiness — REAL-LIVE Readiness Checklist Evaluator (Gate E / E0).
// SOURCE: docs/09-THREAT-SECURITY §7 (REAL-LIVE Security Readiness Checklist) + §7.8 (explicit blockers)
//   + docs/06-BUILD §4/§6 (Gate E readiness rule) + docs/01-SSOT G1/G5/G10/G15 (input states)
//   + G11 (REAL_LIVE_CONFIG_INVALID, resource_type=readiness) + G14 (audit).
//
// PURE / in-memory / deterministic. It AGGREGATES already-defined signals into a readiness verdict
// and an explicit blocker list. It is a PREREQUISITE for `activate_real_live` — it does NOT activate
// REAL-LIVE, never calls activate, never mutates state.
//
// FORBIDDEN HERE (and absent): KeyManager, KMS/vault, key custody, private keys/seed/keypair, signing
// library, transaction building/serialization, signing/sending, RPC/provider live calls, live transfer/
// sweep/funding, DB writes, REAL-LIVE activation, mechanism-guard carve-out, execution authority.
//
// FAIL-SAFE-NOT-FAIL-OPEN: any missing/unknown/invalid input => blocker => NOT ready.

import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';

const CONFIG_INVALID = 'REAL_LIVE_CONFIG_INVALID'; // SSOT G11 api_error_code (config-invalid blocker)
if (!API_ERROR_CODE.includes(CONFIG_INVALID)) throw new Error('internal: REAL_LIVE_CONFIG_INVALID missing');

const RESOURCE = 'readiness';                       // SSOT G11 resource_type / G14 audit_scope
const ACTIVATION_COMMAND = 'activate_real_live';    // SSOT G11 — referenced only; NEVER invoked here

const isBool = (v) => typeof v === 'boolean';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Evaluate REAL-LIVE readiness from caller-supplied (mock) signals. Returns a result model:
 *   { ready: boolean, blockers: [{ code, detail? }], prerequisite_for }
 * `ready` is true iff there are zero blockers. This is NOT a readiness_status enum (SSOT line 141
 * forbids ready/not_ready as that enum); it is an internal result-model boolean.
 *
 * input = {
 *   real_live_config_valid, validation_status, signer_profile_status, execution_wallet_status,
 *   operating_state, protocol_constant_status, provider_degraded, slot_lag, slot_lag_max,
 *   audit_path_available, admission_complete, operator_checklist_complete
 * }
 * opts (optional) = { auditLog, audit_actor } — appends one append-only readiness audit entry.
 */
export function evaluateRealLiveReadiness(input = {}, opts = {}) {
  const blockers = [];
  const add = (code, detail) => blockers.push(detail ? { code, detail } : { code });

  // 1) Hard Risk config completeness (real_live_config_valid) — surfaces the SSOT error code.
  if (input.real_live_config_valid !== true) add(CONFIG_INVALID, 'real_live_config_valid must be true');
  // 2) General config validation status.
  if (input.validation_status !== 'valid') add('config_validation_invalid', 'validation_status must be valid');
  // 3) Signer profile must be ACTIVE (DEGRADED/DISABLED/REVOKED/unknown => not ready).
  if (input.signer_profile_status !== 'ACTIVE') add('signer_profile_not_active', 'signer_profile_status must be ACTIVE');
  // 4) Execution wallet must be ACTIVE.
  if (input.execution_wallet_status !== 'ACTIVE') add('execution_wallet_not_active', 'execution_wallet_status must be ACTIVE');
  // 5) Operating state must be ACTIVE (EXITS_ONLY/KILLED/PAUSED/WARMING_UP/unknown => not ready).
  if (input.operating_state !== 'ACTIVE') add('operating_state_not_ready', 'operating_state must be ACTIVE');
  // 6) Protocol constants green.
  if (input.protocol_constant_status !== 'green') add('protocol_constant_changed', 'protocol_constant_status must be green');
  // 7) Provider must not be degraded.
  if (input.provider_degraded !== false) add('provider_degraded', 'provider_degraded must be false');
  // 8) Slot lag within the mock threshold (both must be finite numbers).
  if (!isNum(input.slot_lag) || !isNum(input.slot_lag_max) || input.slot_lag > input.slot_lag_max) {
    add('slot_lag_exceeded', 'slot_lag must be a number within slot_lag_max');
  }
  // 9) Audit write path available (mock input).
  if (input.audit_path_available !== true) add('audit_path_unavailable', 'audit_path_available must be true');
  // 10) Execution-wallet admission complete (mock input).
  if (input.admission_complete !== true) add('admission_incomplete', 'admission_complete must be true');
  // 11) Operator readiness checklist complete (mock input).
  if (input.operator_checklist_complete !== true) add('operator_checklist_incomplete', 'operator_checklist_complete must be true');

  const ready = blockers.length === 0;

  // Optional append-only readiness audit (evidence). NOT a command — observability of resource=readiness.
  if (opts.auditLog && typeof opts.auditLog.append === 'function' && typeof opts.audit_actor === 'string' && opts.audit_actor.length > 0) {
    opts.auditLog.append({
      resource_type: RESOURCE,
      audit_scope: RESOURCE,
      audit_actor: opts.audit_actor,
      audit_reason: ready ? 'real_live_readiness:ready' : `real_live_readiness:not_ready:${blockers.map((b) => b.code).join(',')}`,
    });
  }

  return Object.freeze({
    ready,
    blockers: Object.freeze(blockers.map((b) => Object.freeze({ ...b }))),
    prerequisite_for: ACTIVATION_COMMAND, // readiness gates activate_real_live; this evaluator does NOT run it
  });
  // NOTE: no activation, no state mutation, no signing/sending, no key material, no RPC, no DB.
}

/** Convenience: just the boolean verdict. */
export function isRealLiveReady(input = {}) {
  return evaluateRealLiveReadiness(input).ready;
}

/** Build an in-memory append-only audit log for readiness evidence (re-exported from @soltrade/data). */
export function createReadinessAuditLog() {
  return createAuditLog();
}

export const READINESS_RESOURCE = RESOURCE;
export const ACTIVATION_COMMAND_REF = ACTIVATION_COMMAND;
