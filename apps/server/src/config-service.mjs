// config-service.mjs — owner-editable configuration with validation + versioning.
// SSOT names only. Hard-Risk completeness rule: REAL-LIVE config is invalid unless ALL
// nine Hard-Risk limits are present and finite (no implicit infinity).
import { readJson, writeJson, deepFreeze, nowIso } from './util.mjs';

const CONFIG_FILE = 'config.json';

export const HARD_RISK_FIELDS = [
  'max_daily_loss_pct',
  'max_daily_loss_usdt',
  'max_total_drawdown_pct',
  'max_open_positions',
  'max_position_size_pct',
  'max_token_exposure_pct',
  'max_creator_exposure_pct',
  'max_cluster_exposure_pct',
  'max_correlated_meme_exposure_pct',
];

export const EV_FIELDS = [
  'minimum_net_expectancy',
  'minimum_profit_factor',
  'minimum_lower_confidence_bound',
  'minimum_sample_size',
  'minimum_exit_success_rate',
  'max_expected_drawdown_pct',
];

const DEFAULTS = {
  config_version: 1,
  updated_at: null,
  // Hard Risk — start UNSET (null). Null means NOT CONFIGURED, which blocks REAL-LIVE.
  hard_risk: Object.fromEntries(HARD_RISK_FIELDS.map((f) => [f, null])),
  // EV thresholds — conservative defaults (paper can run with these; owner tunes later).
  ev: {
    ev_gate_mode: 'strict',
    minimum_net_expectancy: 0,
    minimum_profit_factor: 1.2,
    minimum_lower_confidence_bound: 0,
    minimum_sample_size: 20,
    minimum_exit_success_rate: 0.85,
    max_expected_drawdown_pct: 30,
  },
  execution: {
    capital_limit: null,           // finite > 0 required for REAL-LIVE
    sizing_mode: 'fixed_usd',
    sizing_value: 10,
    usdc_quote_enabled: false,
    signer_backend: 'node',        // 'node' (in-process) | 'rust' (services/hot-executor)
    submit_backend: 'rpc',         // 'rpc' (sendTransaction) | 'jito' (bundle + tip; falls back to rpc)
    jito_tip_account: null,        // base58 Jito tip account (required for the jito backend)
    jito_tip_lamports: 10000,      // tip per bundle (lamports)
  },
  copy_defaults: {
    copy_mode: 'follow_entry_user_exit',  // safe default; full_mirror is per-wallet explicit
    take_profit_pct: 50,
    stop_loss_pct: 30,
    max_entry_slippage_vs_leader: 5,
    min_mirror_sell_pct: 5,
    max_entry_drift_pct: null,            // null = drift guard OFF; else skip/shrink if price ran past leader's fill
    drift_action: 'skip',                 // 'skip' | 'shrink'
    exit_on_leader_sell: false,           // front-run the dump: exit on a leader sell even in follow_entry mode
    auto_pause_after_losses: null,        // null = OFF; else auto-unfollow a leader after N consecutive losses
    trailing_stop_pct: null,              // null = trailing stop OFF; else lock in once up X%, exit on an X% give-back from peak
    tp1_pct: null,                        // null = partial take-profit OFF; else first-tier gain that banks tp1_sell_pct
    tp1_sell_pct: 50,                     // fraction of the position to sell when tp1_pct is hit
    breakeven_after_tp1: false,           // after the first tier banks, exit the remainder if it falls back to break-even
  },
  safety: {
    // pre-trade anti-rug screen (fail-closed); each check independently toggleable
    enabled: true,
    require_mint_revoked: true,
    require_freeze_revoked: true,
    block_permanent_delegate: true,
  },
  providers: {
    // refs only — raw keys live in the vault
    rpc_url_ref: null,        // e.g. vault:helius_rpc_url
    stream_ref: null,
    jupiter_key_ref: null,
    grpc_url_ref: null,       // Yellowstone/Geyser gRPC endpoint (preferred ingestion transport)
    grpc_token_ref: null,     // optional x-token for the gRPC endpoint
    jito_url_ref: null,       // Jito block-engine base URL (for the jito submit backend)
  },
  signer_session: {
    // ALL must be explicitly set (non-null) for the signer to be "ready"
    idle_timeout_ms: null,
    max_session_ms: null,
    max_session_notional_usd: null,
    lock_after_n_risk_rejections: null,
  },
  mode: 'paper', // paper | real_live (real_live only via activate_real_live gate)
};

const NUMERIC_BOUNDS = {
  max_daily_loss_pct: [0.1, 100], max_daily_loss_usdt: [1, 1e9],
  max_total_drawdown_pct: [0.1, 100], max_open_positions: [1, 1000],
  max_position_size_pct: [0.01, 100], max_token_exposure_pct: [0.01, 100],
  max_creator_exposure_pct: [0.01, 100], max_cluster_exposure_pct: [0.01, 100],
  max_correlated_meme_exposure_pct: [0.01, 100],
  minimum_net_expectancy: [-1e9, 1e9], minimum_profit_factor: [0, 100],
  minimum_lower_confidence_bound: [-1e9, 1e9], minimum_sample_size: [1, 1e6],
  minimum_exit_success_rate: [0, 1], max_expected_drawdown_pct: [0.1, 100],
  capital_limit: [1, 1e12], sizing_value: [0.000001, 1e9], jito_tip_lamports: [1000, 1e9],
  take_profit_pct: [0.1, 100000], stop_loss_pct: [0.1, 100],
  max_entry_slippage_vs_leader: [0.01, 100], min_mirror_sell_pct: [0.1, 100],
  max_entry_drift_pct: [0.1, 100000], auto_pause_after_losses: [1, 1000],
  trailing_stop_pct: [0.1, 100000], tp1_pct: [0.1, 100000], tp1_sell_pct: [1, 100],
  idle_timeout_ms: [10_000, 86_400_000], max_session_ms: [60_000, 86_400_000],
  max_session_notional_usd: [1, 1e9], lock_after_n_risk_rejections: [1, 100],
};

function checkNumeric(field, value, errors) {
  if (value === null) return; // null = explicitly unset (allowed; blocks readiness, not save)
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ field, error: 'must_be_finite_number' });
    return;
  }
  const b = NUMERIC_BOUNDS[field];
  if (b && (value < b[0] || value > b[1])) {
    errors.push({ field, error: `out_of_range_${b[0]}_${b[1]}` });
  }
}

export function validateConfigPatch(patch) {
  const errors = [];
  const sections = {
    hard_risk: HARD_RISK_FIELDS,
    ev: [...EV_FIELDS, 'ev_gate_mode'],
    execution: ['capital_limit', 'sizing_mode', 'sizing_value', 'usdc_quote_enabled', 'signer_backend', 'submit_backend', 'jito_tip_account', 'jito_tip_lamports'],
    copy_defaults: ['copy_mode', 'take_profit_pct', 'stop_loss_pct', 'max_entry_slippage_vs_leader', 'min_mirror_sell_pct', 'max_entry_drift_pct', 'drift_action', 'exit_on_leader_sell', 'auto_pause_after_losses', 'trailing_stop_pct', 'tp1_pct', 'tp1_sell_pct', 'breakeven_after_tp1'],
    safety: ['enabled', 'require_mint_revoked', 'require_freeze_revoked', 'block_permanent_delegate'],
    providers: ['rpc_url_ref', 'stream_ref', 'jupiter_key_ref', 'grpc_url_ref', 'grpc_token_ref', 'jito_url_ref'],
    signer_session: ['idle_timeout_ms', 'max_session_ms', 'max_session_notional_usd', 'lock_after_n_risk_rejections'],
  };
  for (const [section, value] of Object.entries(patch || {})) {
    if (!sections[section]) { errors.push({ field: section, error: 'unknown_section' }); continue; }
    if (!value || typeof value !== 'object') { errors.push({ field: section, error: 'must_be_object' }); continue; }
    for (const [field, v] of Object.entries(value)) {
      if (!sections[section].includes(field)) { errors.push({ field: `${section}.${field}`, error: 'unknown_field' }); continue; }
      if (field === 'ev_gate_mode' && !['strict', 'warning_only'].includes(v)) errors.push({ field, error: 'invalid_enum' });
      else if (field === 'sizing_mode' && !['fixed_usd', 'fixed_sol', 'pct_of_capital', 'proportional_leader'].includes(v)) errors.push({ field, error: 'invalid_enum' });
      else if (field === 'signer_backend' && !['node', 'rust'].includes(v)) errors.push({ field, error: 'invalid_enum' });
      else if (field === 'submit_backend' && !['rpc', 'jito'].includes(v)) errors.push({ field, error: 'invalid_enum' });
      else if (field === 'jito_tip_account') {
        if (v !== null && (typeof v !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))) errors.push({ field, error: 'must_be_base58_or_null' });
      }
      else if (field === 'copy_mode' && !['follow_entry_user_exit', 'full_mirror'].includes(v)) errors.push({ field, error: 'invalid_enum' });
      else if (field === 'drift_action' && !['skip', 'shrink'].includes(v)) errors.push({ field, error: 'invalid_enum' });
      else if ((field === 'usdc_quote_enabled' || field === 'exit_on_leader_sell' || field === 'breakeven_after_tp1') && typeof v !== 'boolean') errors.push({ field, error: 'must_be_boolean' });
      else if (section === 'safety' && typeof v !== 'boolean') errors.push({ field, error: 'must_be_boolean' });
      else if (field.endsWith('_ref')) {
        if (v !== null && (typeof v !== 'string' || !/^vault:[a-z0-9_.-]{2,64}$/i.test(v))) {
          errors.push({ field, error: 'must_be_vault_ref_or_null' });
        }
      } else if (NUMERIC_BOUNDS[field] !== undefined) checkNumeric(field, v, errors);
    }
  }
  return { validation_status: errors.length ? 'invalid' : 'valid', errors };
}

export function createConfigService() {
  function load() {
    const { value, corrupt } = readJson(CONFIG_FILE, null);
    if (corrupt) {
      // Fail-safe: corrupt config never silently becomes defaults for trading; flag it.
      return { ...structuredClone(DEFAULTS), corrupt_state_detected: true };
    }
    if (!value) return structuredClone(DEFAULTS);
    // merge over defaults so new fields appear with safe values
    const merged = structuredClone(DEFAULTS);
    for (const k of Object.keys(merged)) {
      if (value[k] !== undefined) {
        merged[k] = typeof merged[k] === 'object' && merged[k] !== null && !Array.isArray(merged[k])
          ? { ...merged[k], ...value[k] }
          : value[k];
      }
    }
    return merged;
  }

  function get() {
    return deepFreeze(load());
  }

  function update(patch) {
    const result = validateConfigPatch(patch);
    if (result.validation_status !== 'valid') {
      return { ok: false, api_error_code: 'CONFIG_VALIDATION_FAILED', ...result };
    }
    const cfg = load();
    // mode is NOT editable via update_config — only via activate_real_live / deactivate path.
    if ('mode' in (patch || {})) {
      return { ok: false, api_error_code: 'READ_ONLY_FIELD_REJECTED', errors: [{ field: 'mode', error: 'use_activation_command' }] };
    }
    for (const [section, value] of Object.entries(patch)) {
      cfg[section] = { ...cfg[section], ...value };
    }
    cfg.config_version += 1;
    cfg.updated_at = nowIso();
    writeJson(CONFIG_FILE, cfg);
    return { ok: true, config_version: cfg.config_version, validation_status: 'valid' };
  }

  /** internal: set mode after activation gates pass (never call from HTTP directly) */
  function setMode(mode) {
    const cfg = load();
    cfg.mode = mode;
    cfg.config_version += 1;
    cfg.updated_at = nowIso();
    writeJson(CONFIG_FILE, cfg);
    return cfg.config_version;
  }

  // setMode bypasses validation/readiness/confirm — those live in the activate_real_live handler.
  // Expose it under _internal (not the casual surface) so it can't be flipped to real_live by a
  // stray caller wired with the config instance.
  return { get, update, _internal: { setMode } };
}

/** Hard-Risk completeness: every field present AND finite. No implicit infinity. */
export function hardRiskComplete(cfg) {
  const missing = HARD_RISK_FIELDS.filter(
    (f) => typeof cfg.hard_risk?.[f] !== 'number' || !Number.isFinite(cfg.hard_risk[f]),
  );
  return { complete: missing.length === 0, missing_limits: missing };
}
