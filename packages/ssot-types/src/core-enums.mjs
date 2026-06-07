// @soltrade/ssot-types — core SSOT enums (non-candidate, Groups 1–17).
// SOURCE: docs/01-SSOT.md (the only source of names). No name appears here that is
// not registered in SSOT. Runtime values only; TypeScript types live in core-enums.d.ts.
// Governance: No name before SSOT. candidate_* names are NOT here (see candidate-enums.mjs).

const f = Object.freeze;

// --- Group 1 — States ---
export const OPERATING_STATE = f(['WARMING_UP', 'ACTIVE', 'EXITS_ONLY', 'PAUSED', 'KILLED']);
export const POSITION_STATE = f([
  'OPENING', 'OPEN', 'PARTIALLY_EXITING', 'EXIT_PENDING', 'MIRROR_SELL_PENDING',
  'MIGRATION_PENDING', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_ENTRY', 'FAILED_EXIT',
]);
export const MIGRATION_PHASE = f([
  'PRE_MIGRATION', 'MIGRATION_APPROACHING', 'MIGRATION_IN_PROGRESS', 'LP_MINTED', 'POST_MIGRATION_ACTIVE',
]);

// --- Group 2 — Modes & Policies ---
export const COPY_MODE = f(['follow_entry_user_exit', 'full_mirror']);
export const EV_GATE_MODE = f(['strict', 'warning_only']);
export const SIZING_MODE = f(['fixed_usd', 'fixed_sol', 'pct_of_capital']);
export const PARTIAL_SELL_POLICY = f([
  'risk_modifier_only', 'proportional_mirror', 'ignore_below_threshold', 'tighten_trailing_only', 'manual_review',
]);
export const TRANSFER_EXIT_POLICY = f(['no_auto_exit', 'de_risk_partial', 'exit_on_transfer']);
export const SCALE_IN_POLICY = f(['no_add', 'mirror_proportional', 'limited_add']);
export const CONFLICT_RESOLUTION = f(['risk_signal_wins_by_default']); // single value (Group 2)
export const STRATEGY_BRAIN = f(['brain_a', 'brain_b']);
export const EXECUTION_MODE = f([
  'auto', 'manual_approval', 'helius_sender', 'jito_send', 'jito_bundle', 'jupiter_route',
]);

// --- Group 3 — Intents & Events ---
export const INTENT_TYPE = f([
  'BUY_INTENT', 'SELL_INTENT', 'SCALE_IN_INTENT', 'MIRROR_SELL_INTENT', 'EMERGENCY_EXIT_INTENT', 'CANCEL_INTENT',
]);
export const FAILURE_TYPE = f([
  'SlippageExceeded', 'BlockhashExpired', 'AccountInUse', 'ComputeBudgetExceeded', 'InsufficientFunds',
  'RouteInvalid', 'TokenAccountMissing', 'ProgramError', 'RPCDropped', 'BundleFailed', 'Unknown',
]);
export const BUNDLE_STATUS = f(['Pending', 'Failed', 'Landed', 'Invalid', 'STALE_BUNDLE']);
export const COPY_EVENT = f([
  'leader_buy', 'leader_scale_in', 'leader_partial_sell', 'leader_full_exit', 'leader_transfer_out',
  'transfer_known_cluster', 'transfer_unknown_single', 'transfer_split_unknown', 'transfer_cex_like',
  'transfer_creator_dev', 'leader_rebuy', 'whipsaw_detected', 'multi_wallet_conflict',
  'leader_inactive_token_weak', 'leader_exit_migration_limbo', 'leader_sell_route_unhealthy',
  'entry_slippage_exceeds_leader',
]);
// Classification flags are OUTPUTS, not copy_event values (SSOT Group 3 note).
export const COPY_EVENT_CLASSIFICATION_FLAG = f(['HIGH_EXIT_RISK', 'WHIPSAW_OR_MEV_LIKE']);

// --- Group 5 — Health / Readiness ---
export const PROTOCOL_CONSTANT_STATUS = f(['green', 'changed']);
// Display-only status string (Group 5). Not an enum set; exported as a constant name.
export const WARNING_CRITICAL = 'WARNING_CRITICAL';

// --- Group 10 — Derived outputs ---
export const VALIDATION_STATUS = f(['valid', 'warning', 'invalid']);

// --- Group 15 — Execution Wallet / Signer ---
export const KEY_CUSTODY_MODE = f(['connected_wallet', 'isolated_signer']);
export const SIGNER_PROFILE_STATUS = f(['ACTIVE', 'DISABLED', 'REVOKED', 'DEGRADED']);
export const EXECUTION_WALLET_STATUS = f(['WARMING_UP', 'ACTIVE', 'DISABLED', 'DRAINING', 'RETIRED', 'REVOKED']);
export const WALLET_ASSIGNMENT_POLICY = f([
  'round_robin', 'least_active', 'per_strategy', 'per_source_wallet', 'manual_assignment', 'risk_weighted',
]);
export const EXECUTION_WALLET_CREATION_MODE = f(['manual', 'automatic_policy']);
export const ASSET_TRANSFER_STATUS = f(['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'CANCELLED']);
export const ROTATION_TRIGGER = f([
  'manual', 'time_based', 'trade_count_based', 'risk_limit_based', 'compromise_suspected', 'wallet_retirement',
]);
export const WALLET_ROTATION_STATUS = f(['NOT_REQUIRED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']);
export const PROFIT_SWEEP_POLICY = f(['auto_immediate', 'manual', 'periodic']);

// --- Group 16/17 — Discovery / New-Coin Hunting / Opportunity decision reasons ---
export const HUNT_STATUS = f([
  'discovered', 'ranked', 'gated', 'accepted', 'rejected', 'watch_only', 'expired', 'entered',
]);
export const QUOTE_MINT = f(['wsol', 'usdc', 'unknown']); // canonical symbolic enum, NOT raw mint pubkey
// accepted_reason / rejected_reason are "(قابلة للتوسّع)" in SSOT — list reflects current registered values.
export const ACCEPTED_REASON = f([
  'wallet_signal_confirmed', 'cluster_signal_confirmed', 'token_readiness_pass', 'exit_feasibility_pass',
]);
export const REJECTED_REASON = f([
  'dex_only_signal', 'ev_negative', 'route_invalid', 'exit_feasibility_fail', 'token2022_dangerous_extension',
  'hard_risk_block', 'slippage_vs_leader_exceeded', 'same_cluster_not_independent', 'hunt_window_expired',
  'liquidity_share_exceeded', 'unknown_quote_mint',
]);

// Registry keyed by SSOT source_of_truth_field — used by the drift guard.
export const CORE_ENUMS = f({
  operating_state: OPERATING_STATE,
  position_state: POSITION_STATE,
  migration_phase: MIGRATION_PHASE,
  copy_mode: COPY_MODE,
  ev_gate_mode: EV_GATE_MODE,
  sizing_mode: SIZING_MODE,
  partial_sell_policy: PARTIAL_SELL_POLICY,
  transfer_exit_policy: TRANSFER_EXIT_POLICY,
  scale_in_policy: SCALE_IN_POLICY,
  conflict_resolution: CONFLICT_RESOLUTION,
  strategy_brain: STRATEGY_BRAIN,
  execution_mode: EXECUTION_MODE,
  intent_type: INTENT_TYPE,
  failure_type: FAILURE_TYPE,
  bundle_status: BUNDLE_STATUS,
  copy_event: COPY_EVENT,
  protocol_constant_status: PROTOCOL_CONSTANT_STATUS,
  validation_status: VALIDATION_STATUS,
  key_custody_mode: KEY_CUSTODY_MODE,
  signer_profile_status: SIGNER_PROFILE_STATUS,
  execution_wallet_status: EXECUTION_WALLET_STATUS,
  wallet_assignment_policy: WALLET_ASSIGNMENT_POLICY,
  execution_wallet_creation_mode: EXECUTION_WALLET_CREATION_MODE,
  asset_transfer_status: ASSET_TRANSFER_STATUS,
  rotation_trigger: ROTATION_TRIGGER,
  wallet_rotation_status: WALLET_ROTATION_STATUS,
  profit_sweep_policy: PROFIT_SWEEP_POLICY,
  hunt_status: HUNT_STATUS,
  quote_mint: QUOTE_MINT,
  accepted_reason: ACCEPTED_REASON,
  rejected_reason: REJECTED_REASON,
});
