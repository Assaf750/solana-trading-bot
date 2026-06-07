// @soltrade/config — config schema (CORE, non-candidate).
// SOURCE: docs/02-CONFIG-AND-POLICY-SCHEMA.md §2–§11 + docs/01-SSOT.md.
// No config name appears here that is not registered in SSOT / 02-CONFIG.
// No new threshold is invented — only the bound KINDS stated in §10/§6/§7 are encoded.
// candidate_* config additions (§12–§17) are OUT OF SCOPE for PR-A3 (deferred).

import {
  COPY_MODE, EV_GATE_MODE, SIZING_MODE, EXECUTION_MODE, PARTIAL_SELL_POLICY,
  TRANSFER_EXIT_POLICY, SCALE_IN_POLICY, CONFLICT_RESOLUTION, STRATEGY_BRAIN,
} from '../../ssot-types/src/core-enums.mjs';

const f = Object.freeze;

// Enum references by SSOT field name (consumed from @soltrade/ssot-types).
export const ENUM_REFS = f({
  copy_mode: COPY_MODE,
  ev_gate_mode: EV_GATE_MODE,
  sizing_mode: SIZING_MODE,
  execution_mode: EXECUTION_MODE,
  partial_sell_policy: PARTIAL_SELL_POLICY,
  transfer_exit_policy: TRANSFER_EXIT_POLICY,
  scale_in_policy: SCALE_IN_POLICY,
  conflict_resolution: CONFLICT_RESOLUTION,
  strategy_brain: STRATEGY_BRAIN,
});

// rule kinds (validation only — bounds taken verbatim from 02-CONFIG §10/§6/§7):
//   bool | enum | string | number | number_pos(>0) | number_nonneg(>=0)
//   pct_pos(>0,<=100) | pct_nonneg(0..100) | pct_open100((0,100]) | usdt_pos(>0)
//   int_pos(>0) | int_nonneg(>=0) | duration_nonneg(>=0)
// field def: { rule, enumRef?, default?, scope, mutable_when_open, applies_to_existing,
//             safety_critical, required? }

export const FIELDS = f({
  global_config: f({
    user_enabled_paper_gate: f({ rule: 'bool', default: false, scope: 'global', mutable_when_open: 'yes', applies_to_existing: 'n/a', safety_critical: 'no' }),
    ev_gate_mode: f({ rule: 'enum', enumRef: 'ev_gate_mode', default: 'strict', scope: 'global', mutable_when_open: 'yes', applies_to_existing: 'yes_gating', safety_critical: 'partial' }),
    execution_mode: f({ rule: 'enum', enumRef: 'execution_mode', scope: 'global', mutable_when_open: 'yes', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    usdc_quote_enabled: f({ rule: 'bool', default: false, scope: 'global', mutable_when_open: 'yes', applies_to_existing: 'n/a', safety_critical: 'no' }),
  }),

  brain_config: f({
    strategy_brain: f({ rule: 'enum', enumRef: 'strategy_brain', scope: 'brain', mutable_when_open: 'n/a', applies_to_existing: 'n/a', safety_critical: 'no' }),
    sizing_mode: f({ rule: 'enum', enumRef: 'sizing_mode', scope: 'brain', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    sizing_value: f({ rule: 'number_pos', scope: 'brain', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    capital_reference: f({ rule: 'string', scope: 'brain', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
  }),

  per_wallet_config: f({
    follow_enabled: f({ rule: 'bool', required: true, scope: 'per-wallet', mutable_when_open: 'yes', applies_to_existing: 'yes', safety_critical: 'no' }),
    copy_mode: f({ rule: 'enum', enumRef: 'copy_mode', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    take_profit_pct: f({ rule: 'pct_pos', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    partial_sell_policy: f({ rule: 'enum', enumRef: 'partial_sell_policy', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    min_mirror_sell_pct: f({ rule: 'pct_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    partial_sell_low_threshold: f({ rule: 'pct_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    partial_sell_medium_threshold: f({ rule: 'pct_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    partial_sell_high_threshold: f({ rule: 'pct_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    partial_sell_major_threshold: f({ rule: 'pct_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    transfer_exit_policy: f({ rule: 'enum', enumRef: 'transfer_exit_policy', default: 'no_auto_exit', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    scale_in_policy: f({ rule: 'enum', enumRef: 'scale_in_policy', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    conflict_resolution: f({ rule: 'enum', enumRef: 'conflict_resolution', default: 'risk_signal_wins_by_default', scope: 'per-wallet', mutable_when_open: 'fixed', applies_to_existing: 'fixed', safety_critical: 'no' }),
    copy_adds_enabled: f({ rule: 'bool', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    copy_adds_for_follow_entry: f({ rule: 'bool', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    max_entry_slippage_vs_leader: f({ rule: 'number_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    rebuy_cooldown: f({ rule: 'duration_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    whipsaw_window: f({ rule: 'duration_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    whipsaw_penalty: f({ rule: 'number', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    allow_whipsaw_reentry_override: f({ rule: 'bool', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    fast_hunt_window_ms: f({ rule: 'duration_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    require_pullback: f({ rule: 'bool', default: false, scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    chase_guard: f({ rule: 'bool', default: false, scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    min_token_readiness: f({ rule: 'number', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    max_entry_volatility: f({ rule: 'number_nonneg', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    single_wallet_min_confidence: f({ rule: 'number', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    max_liquidity_share_pct: f({ rule: 'pct_open100', scope: 'per-wallet', mutable_when_open: 'frozen_at_entry', applies_to_existing: 'new_entries', safety_critical: 'no' }),
    stop_loss_pct: f({ rule: 'pct_pos', scope: 'per-wallet', mutable_when_open: 'asymmetric', applies_to_existing: 'asymmetric', safety_critical: 'no' }),
    max_time_in_position: f({ rule: 'duration_nonneg', scope: 'per-wallet', mutable_when_open: 'asymmetric', applies_to_existing: 'asymmetric', safety_critical: 'no' }),
  }),

  risk_config: f({
    max_daily_loss_pct: f({ rule: 'pct_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
    max_daily_loss_usdt: f({ rule: 'usdt_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
    max_total_drawdown_pct: f({ rule: 'pct_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
    max_open_positions: f({ rule: 'int_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
    max_position_size_pct: f({ rule: 'pct_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
    max_token_exposure_pct: f({ rule: 'pct_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
    max_creator_exposure_pct: f({ rule: 'pct_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
    max_cluster_exposure_pct: f({ rule: 'pct_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
    max_correlated_meme_exposure_pct: f({ rule: 'pct_pos', required: true, scope: 'risk', mutable_when_open: 'yes', applies_to_existing: 'immediate', safety_critical: 'yes' }),
  }),

  ev_gate_config: f({
    minimum_net_expectancy: f({ rule: 'number', scope: 'ev_gate', mutable_when_open: 'yes', applies_to_existing: 'gating', safety_critical: 'partial' }),
    minimum_profit_factor: f({ rule: 'number_pos', scope: 'ev_gate', mutable_when_open: 'yes', applies_to_existing: 'gating', safety_critical: 'partial' }),
    minimum_lower_confidence_bound: f({ rule: 'number', scope: 'ev_gate', mutable_when_open: 'yes', applies_to_existing: 'gating', safety_critical: 'partial' }),
    minimum_sample_size: f({ rule: 'int_pos', scope: 'ev_gate', mutable_when_open: 'yes', applies_to_existing: 'gating', safety_critical: 'partial' }),
    minimum_exit_success_rate: f({ rule: 'pct_nonneg', scope: 'ev_gate', mutable_when_open: 'yes', applies_to_existing: 'gating', safety_critical: 'partial' }),
    max_expected_drawdown_pct: f({ rule: 'pct_pos', scope: 'ev_gate', mutable_when_open: 'yes', applies_to_existing: 'gating', safety_critical: 'partial' }),
  }),

  execution_config: f({
    bundle_ttl_slots: f({ rule: 'int_nonneg', scope: 'execution', mutable_when_open: 'yes', applies_to_existing: 'new_sends', safety_critical: 'no' }),
    platform_fee_bps: f({ rule: 'number_nonneg', default: 0, scope: 'execution', mutable_when_open: 'yes', applies_to_existing: 'new_sends', safety_critical: 'no' }),
  }),

  paper_config: f({
    // reference to global_config.user_enabled_paper_gate (§2.7) — not an independent writable copy.
    user_enabled_paper_gate: f({ rule: 'bool', default: false, scope: 'paper', mutable_when_open: 'yes', applies_to_existing: 'n/a', safety_critical: 'no', reference: true }),
  }),

  config_versioning: f({
    // auto-generated revision id (§9) — not user-editable; presence-only, no value validation.
    config_version: f({ rule: 'auto', scope: 'versioning', mutable_when_open: 'n/a', applies_to_existing: 'n/a', safety_critical: 'no' }),
  }),
});

export const CONFIG_OBJECTS = f(Object.keys(FIELDS));

// Hard Risk fields (Group 6) — all required for a valid REAL-LIVE config (§6/§10).
export const HARD_RISK_FIELDS = f(Object.keys(FIELDS.risk_config));

// EV threshold fields (Group 7) — governed by ev_gate_mode (§7).
export const EV_FIELDS = f(Object.keys(FIELDS.ev_gate_config));

// Ordered partial-sell thresholds that must satisfy low < medium < high < major (§10).
export const PARTIAL_SELL_ORDER = f([
  'partial_sell_low_threshold', 'partial_sell_medium_threshold',
  'partial_sell_high_threshold', 'partial_sell_major_threshold',
]);
