// @soltrade/config — config validator.
// Implements docs/02-CONFIG §10 validation rules + §6 Hard Risk REAL-LIVE rule +
// §8/§11 mutability is data-only (schema). No new threshold; bounds are from the doc.
// Returns derived outputs registered in SSOT Group 10 (validation_status,
// real_live_config_valid) — these are OUTPUTS, never stored as config fields.

import {
  FIELDS, ENUM_REFS, CONFIG_OBJECTS, HARD_RISK_FIELDS, EV_FIELDS, PARTIAL_SELL_ORDER,
} from './schema.mjs';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => isNum(v) && Number.isInteger(v);

function checkRule(rule, v, enumRef) {
  switch (rule) {
    case 'bool': return typeof v === 'boolean' ? null : 'must be boolean';
    case 'string': return typeof v === 'string' && v.length > 0 ? null : 'must be a non-empty string';
    case 'enum': {
      const allowed = ENUM_REFS[enumRef];
      return allowed && allowed.includes(v) ? null : `must be one of the ${enumRef} enum values`;
    }
    case 'number': return isNum(v) ? null : 'must be a number';
    case 'number_pos': return isNum(v) && v > 0 ? null : 'must be a number > 0';
    case 'number_nonneg': return isNum(v) && v >= 0 ? null : 'must be a number >= 0';
    case 'pct_pos': return isNum(v) && v > 0 && v <= 100 ? null : 'must be a percent in (0,100]';
    case 'pct_nonneg': return isNum(v) && v >= 0 && v <= 100 ? null : 'must be a percent in [0,100]';
    case 'pct_open100': return isNum(v) && v > 0 && v <= 100 ? null : 'must be a percent in (0,100]';
    case 'usdt_pos': return isNum(v) && v > 0 ? null : 'must be a USDT amount > 0';
    case 'int_pos': return isInt(v) && v > 0 ? null : 'must be an integer > 0';
    case 'int_nonneg': return isInt(v) && v >= 0 ? null : 'must be an integer >= 0';
    case 'duration_nonneg': return isNum(v) && v >= 0 ? null : 'must be a duration >= 0';
    case 'auto': return null; // auto-generated; not user-validated
    default: return `unknown rule ${rule}`;
  }
}

function validateFlatSection(obj, section, out) {
  if (section == null) return;
  if (typeof section !== 'object') { out.errors.push(`${obj} must be an object`); return; }
  for (const [key, val] of Object.entries(section)) {
    const def = FIELDS[obj][key];
    if (!def) { out.unknown_names.push(`${obj}.${key}`); continue; }
    if (val === undefined || val === null) continue; // unset = use default / disabled
    const e = checkRule(def.rule, val, def.enumRef);
    if (e) out.errors.push(`${obj}.${key} ${e}`);
  }
}

function validateWalletEntry(walletId, entry, out) {
  if (entry == null || typeof entry !== 'object') {
    out.errors.push(`per_wallet_config.${walletId} must be an object`);
    return;
  }
  for (const [key, val] of Object.entries(entry)) {
    const def = FIELDS.per_wallet_config[key];
    if (!def) { out.unknown_names.push(`per_wallet_config.${walletId}.${key}`); continue; }
    if (val === undefined || val === null) continue;
    const e = checkRule(def.rule, val, def.enumRef);
    if (e) out.errors.push(`per_wallet_config.${walletId}.${key} ${e}`);
  }
  // follow_enabled required for executability (§5) — unset => watch-only (warning, not error).
  if (entry.follow_enabled == null) {
    out.warnings.push(`per_wallet_config.${walletId}: follow_enabled unset -> wallet is watch-only (not executable)`);
  }
  // take_profit_pct required when copy_mode = follow_entry_user_exit (§5/§10).
  if (entry.copy_mode === 'follow_entry_user_exit' && entry.take_profit_pct == null) {
    out.errors.push(`per_wallet_config.${walletId}: take_profit_pct required when copy_mode=follow_entry_user_exit`);
  }
  // scale_in_policy = limited_add requires copy_adds_for_follow_entry = true (§5/§10).
  if (entry.scale_in_policy === 'limited_add' && entry.copy_adds_for_follow_entry !== true) {
    out.errors.push(`per_wallet_config.${walletId}: scale_in_policy=limited_add requires copy_adds_for_follow_entry=true`);
  }
  // partial-sell thresholds must satisfy low < medium < high < major (§10), among those set.
  const vals = PARTIAL_SELL_ORDER.map((k) => entry[k]);
  if (vals.every((v) => isNum(v))) {
    for (let i = 0; i < vals.length - 1; i++) {
      if (!(vals[i] < vals[i + 1])) {
        out.errors.push(`per_wallet_config.${walletId}: partial-sell thresholds must satisfy low<medium<high<major`);
        break;
      }
    }
  }
}

/**
 * Validate a config object tree. Returns derived outputs (SSOT Group 10):
 *   { validation_status, real_live_config_valid, errors, warnings, unknown_names }
 * - validation_status: 'invalid' (errors or unknown names) | 'warning' | 'valid'
 * - real_live_config_valid: true only if no errors/unknown names AND all Hard Risk limits present.
 */
export function validateConfig(config) {
  const out = { errors: [], warnings: [], unknown_names: [] };
  if (config == null || typeof config !== 'object') {
    return { validation_status: 'invalid', real_live_config_valid: false, errors: ['config must be an object'], warnings: [], unknown_names: [] };
  }

  for (const k of Object.keys(config)) {
    if (!CONFIG_OBJECTS.includes(k)) out.unknown_names.push(k);
  }
  for (const obj of CONFIG_OBJECTS) {
    if (obj === 'per_wallet_config') continue;
    validateFlatSection(obj, config[obj], out);
  }
  const pw = config.per_wallet_config;
  if (pw != null) {
    if (typeof pw !== 'object') out.errors.push('per_wallet_config must be a map of wallet -> overrides');
    else for (const [walletId, entry] of Object.entries(pw)) validateWalletEntry(walletId, entry, out);
  }

  // brain dependencies (§5/§10).
  const brain = config.brain_config || {};
  if (brain.sizing_mode === 'pct_of_capital') {
    if (brain.capital_reference == null) out.errors.push('brain_config.capital_reference required when sizing_mode=pct_of_capital');
    if (isNum(brain.sizing_value) && brain.sizing_value > 100) out.errors.push('brain_config.sizing_value must be <=100 when sizing_mode=pct_of_capital');
  }

  // EV gate behavior (§7/§10) — never bypasses Hard Risk.
  const evMode = (config.global_config && config.global_config.ev_gate_mode) || 'strict';
  const ev = config.ev_gate_config || {};
  const missingEv = EV_FIELDS.filter((k) => ev[k] == null);
  if (evMode === 'warning_only') {
    out.warnings.push('WARNING_CRITICAL: ev_gate_mode=warning_only (EV advisory; never bypasses Hard Risk)');
    if (missingEv.length) out.warnings.push(`WARNING_CRITICAL: EV thresholds missing under warning_only (no EV-pass claimed): ${missingEv.join(', ')}`);
  } else if (missingEv.length) {
    out.warnings.push(`EV thresholds missing under strict mode block entry: ${missingEv.join(', ')}`);
  }

  // Hard Risk completeness (§6/§10) -> real_live_config_valid. Missing limit != "no limit".
  const missingRisk = HARD_RISK_FIELDS.filter((k) => !config.risk_config || config.risk_config[k] == null);
  if (missingRisk.length) {
    out.warnings.push(`REAL-LIVE invalid: missing Hard Risk limits (no implicit infinity): ${missingRisk.join(', ')}`);
  }

  const hardInvalid = out.errors.length > 0 || out.unknown_names.length > 0;
  const real_live_config_valid = !hardInvalid && missingRisk.length === 0;
  const validation_status = hardInvalid ? 'invalid' : (out.warnings.length > 0 ? 'warning' : 'valid');

  return { validation_status, real_live_config_valid, errors: out.errors, warnings: out.warnings, unknown_names: out.unknown_names };
}
