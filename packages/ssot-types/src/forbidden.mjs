// @soltrade/ssot-types — forbidden / rejected names registry.
// SOURCE: docs/01-SSOT.md "Rejected Aliases" (Group 9) + global Rejected/Forbidden
// in CLAUDE.md / README.md. These names MUST NOT be defined as real fields, enums,
// commands, resources, or source-of-truth values anywhere in the codebase.
// They may appear ONLY as prohibition text. The drift guard asserts none of them is
// declared as a usable name in this monorepo's registries.

const f = Object.freeze;

// { name, canonical, reason } — canonical is the approved replacement (or null if forbidden forever).
export const FORBIDDEN = f([
  // Rejected aliases (SSOT Group 9)
  { name: 'max_drawdown_allowed', canonical: 'max_total_drawdown_pct | max_expected_drawdown_pct', reason: 'ambiguous drawdown unit/meaning' },
  { name: 'max_position_size', canonical: 'max_position_size_pct', reason: 'missing unit' },
  { name: 'max_token_exposure', canonical: 'max_token_exposure_pct', reason: 'missing unit' },
  { name: 'max_correlated_meme_exposure', canonical: 'max_correlated_meme_exposure_pct', reason: 'missing unit' },
  { name: 'leader_user_price_delta', canonical: 'entry_slippage_vs_leader', reason: 'name reuse; measured vs max_entry_slippage_vs_leader' },
  { name: 'name_spoof_risk', canonical: 'name_impersonation_score', reason: 'naming unification' },
  { name: 'opportunity_class', canonical: 'hunt_status', reason: 'one lifecycle enum' },
  { name: 'max_token_age_for_entry', canonical: 'fast_hunt_window_ms', reason: 'merged hunt-window concept' },
  { name: 'entry_window_ms', canonical: 'fast_hunt_window_ms', reason: 'merged hunt-window concept' },
  { name: 'copy_entry_user_exit', canonical: 'follow_entry_user_exit', reason: 'rejected alias of default mode' },
  { name: 'max_position_size_sol', canonical: null, reason: 'covered by sizing_mode=fixed_sol + max_position_size_pct' },
  { name: 'wallet_trust_score', canonical: 'Group 18 components + candidate_wallet_net_copyability_rank', reason: 'opaque composite invites Goodhart' },
  { name: 'approved_copy_signal', canonical: 'copy_signal_candidate', reason: 'implies execution authority; opportunity is not a buy order' },
  { name: 'apply_recommendation', canonical: 'preview -> request_config_update_from_recommendation -> apply_config_version', reason: 'no auto-apply' },
  { name: 'disable_adds', canonical: 'disable_new_adds', reason: 'unified to disable_new_adds' },
  { name: 'behavior_shift_flag', canonical: 'candidate_wallet_behavior_drift_flag', reason: 'old name superseded in v1.8' },

  // Legacy P&L (unprefixed) — F1
  { name: 'realized_pnl', canonical: 'candidate_realized_pnl', reason: 'F1: legacy unprefixed P&L rejected' },
  { name: 'unrealized_pnl', canonical: 'candidate_unrealized_pnl', reason: 'F1: legacy unprefixed P&L rejected' },
  { name: 'fees_paid', canonical: 'candidate_fees_total', reason: 'F1: legacy unprefixed P&L rejected' },
  { name: 'slippage_cost', canonical: 'candidate_slippage_cost', reason: 'F1: legacy unprefixed P&L rejected' },
  { name: 'net_pnl', canonical: 'candidate_* read-model', reason: 'F1: legacy unprefixed P&L rejected' },
  { name: 'fee_amount', canonical: 'candidate_fees_total', reason: 'F1: legacy unprefixed P&L rejected' },

  // Price/mark — F2
  { name: 'current_price', canonical: 'candidate_current_mark_view', reason: 'F2: no anonymous current price' },
  { name: 'candidate_current_price', canonical: 'candidate_current_mark_view', reason: 'F2: rejected even as candidate' },

  // Atomic batch exit — F9 (forbidden forever)
  { name: 'exit_all_positions', canonical: 'candidate_cmd_preview_batch_exit -> candidate_cmd_request_batch_exit', reason: 'F9: atomic mass-exit bypass forbidden' },
  { name: 'batch_exit_all_positions', canonical: 'candidate_cmd_preview_batch_exit -> candidate_cmd_request_batch_exit', reason: 'F9: atomic mass-exit bypass forbidden' },

  // Opportunity execution commands (forbidden forever)
  { name: 'buy_opportunity', canonical: null, reason: 'no radar/accepted -> direct execution' },
  { name: 'execute_opportunity', canonical: null, reason: 'no radar/accepted -> direct execution' },
  { name: 'submit_opportunity', canonical: null, reason: 'no radar/accepted -> direct execution' },

  // Never a badge/enum/state/executable
  { name: 'HUNTABLE', canonical: null, reason: 'never a UI enum/badge/executable state; prohibition text only' },
]);

export const FORBIDDEN_NAMES = f(FORBIDDEN.map((e) => e.name));
