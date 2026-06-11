// SIMULATED fixture data shaped like the backend read-models.
// NOTHING here is real: no real money, no real keys, no network.
// Every P&L / fill / balance object carries simulated:true. Missing metrics are
// `null` so the UI renders them as "unavailable" — never as 0.

export const SYSTEM = Object.freeze({
  operating_state: 'WARMING_UP', // WARMING_UP · ACTIVE · EXITS_ONLY · PAUSED · KILLED
  protocol_constant_status: 'green',
  provider_degraded: false,
  slot_lag: 2,
  slot_lag_max: 12,
  app_version: '0.0.0-foundations',
  truth_mode: 'simulated',
  freshness: 'fresh'
});

// ---- Pipeline decision trace (pipeline-decision-trace-foundations shape) ----
// trace_entries: { stage, stage_state, decisive_reason, advanced, blocked }
export const DECISION_TRACE = Object.freeze({
  simulated: true,
  overall_outcome: 'blocked_at_stage', // reviewed_advisory_all_stages | blocked_at_stage | degraded | unconfigured
  pipeline_health_state: 'DEGRADED_ADVISORY',
  trace_entries: Object.freeze([
    { stage: 'signal', stage_state: 'SIGNAL_READY_ADVISORY', decisive_reason: 'advanced_advisory', advanced: true, blocked: false },
    { stage: 'risk', stage_state: 'RISK_PASS_ADVISORY', decisive_reason: 'advanced_advisory', advanced: true, blocked: false },
    { stage: 'intent', stage_state: 'INTENT_CANDIDATE_RECORDED', decisive_reason: 'advanced_advisory', advanced: true, blocked: false },
    { stage: 'route', stage_state: 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID', decisive_reason: 'advanced_advisory', advanced: true, blocked: false },
    { stage: 'signing_review', stage_state: 'SIGNING_REVIEW_BLOCKED', decisive_reason: 'stage_blocked', advanced: false, blocked: true },
    { stage: 'send_review', stage_state: 'SEND_REVIEW_BLOCKED', decisive_reason: 'stage_blocked', advanced: false, blocked: true }
  ])
});

// A second, fully-reviewed trace for a different opportunity (still opens nothing).
export const DECISION_TRACE_REVIEWED = Object.freeze({
  simulated: true,
  overall_outcome: 'reviewed_advisory_all_stages',
  pipeline_health_state: 'REVIEWED_ADVISORY',
  trace_entries: Object.freeze([
    { stage: 'signal', stage_state: 'SIGNAL_READY_ADVISORY', decisive_reason: 'advanced_advisory', advanced: true, blocked: false },
    { stage: 'risk', stage_state: 'RISK_PASS_ADVISORY', decisive_reason: 'advanced_advisory', advanced: true, blocked: false },
    { stage: 'intent', stage_state: 'INTENT_AWAITING_ROUTE_REVIEW', decisive_reason: 'advanced_advisory', advanced: true, blocked: false },
    { stage: 'route', stage_state: 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID', decisive_reason: 'advanced_advisory', advanced: true, blocked: false },
    { stage: 'signing_review', stage_state: 'SIGNING_REVIEW_PASS_ADVISORY', decisive_reason: 'reviewed_advisory', advanced: true, blocked: false },
    { stage: 'send_review', stage_state: 'SEND_REVIEW_PASS_ADVISORY', decisive_reason: 'reviewed_advisory', advanced: true, blocked: false }
  ])
});

const REJECTED_TRACE = Object.freeze({
  simulated: true,
  overall_outcome: 'blocked_at_stage',
  pipeline_health_state: 'BLOCKED_ADVISORY',
  trace_entries: Object.freeze([
    { stage: 'signal', stage_state: 'SIGNAL_SUPPRESSED', decisive_reason: 'suppressed', advanced: true, blocked: false },
    { stage: 'risk', stage_state: 'RISK_BLOCKED', decisive_reason: 'stage_blocked', advanced: false, blocked: true },
    { stage: 'intent', stage_state: 'INTENT_BLOCKED', decisive_reason: 'stage_blocked', advanced: false, blocked: true },
    { stage: 'route', stage_state: 'EXECUTION_PLAN_PREVIEW_REJECTED', decisive_reason: 'stage_rejected', advanced: false, blocked: true },
    { stage: 'signing_review', stage_state: 'SIGNING_REVIEW_BLOCKED', decisive_reason: 'stage_blocked', advanced: false, blocked: true },
    { stage: 'send_review', stage_state: 'SEND_REVIEW_BLOCKED', decisive_reason: 'stage_blocked', advanced: false, blocked: true }
  ])
});

// ---- Paper P&L read-model (paper-execution-foundations shape) ----
export const PAPER_PNL = Object.freeze({
  simulated: true,
  candidate_mark_status: 'valid', // valid | stale | unavailable | low_confidence | display_only
  candidate_realized_pnl: 142.37,
  candidate_paper_pnl: 121.04, // net execution-aware (gross - fees - slippage)
  candidate_fees_total: 14.82,
  candidate_slippage_cost: 6.51,
  candidate_unrealized_pnl: null, // mark not valid for these lots -> unavailable
  candidate_pnl_by_wallet: Object.freeze({
    'wal_7Qx': 88.2,
    'wal_3Mk': 41.1,
    'wal_9Zt': -8.26
  }),
  candidate_pnl_by_copy_mode: Object.freeze({
    follow_entry_user_exit: 96.5,
    full_mirror: 24.54
  }),
  candidate_pnl_by_brain: Object.freeze({
    brain_a: 73.9,
    brain_b: 47.14
  }),
  positions: Object.freeze({
    'pos_aa11': Object.freeze({ position_token_symbol: 'WIFDOGE', qty: 1200000, simulated: true }),
    'pos_bb22': Object.freeze({ position_token_symbol: 'PUMPKAT', qty: 540000, simulated: true })
  })
});

// ---- Positions / Intents / Trades ----
export const POSITIONS = Object.freeze([
  { id: 'pos_aa11', symbol: 'WIFDOGE', mint: '4kZ…WIFd', position_state: 'OPEN', current_control_brain: 'brain_a', copy_mode: 'follow_entry_user_exit', exit_feasibility: 'feasible', simulated: true },
  { id: 'pos_bb22', symbol: 'PUMPKAT', mint: '9aP…PkAt', position_state: 'PARTIALLY_EXITING', current_control_brain: 'brain_b', copy_mode: 'full_mirror', exit_feasibility: 'thin_liquidity', simulated: true },
  { id: 'pos_cc33', symbol: 'SOLBONK', mint: 'Bn…oNk2', position_state: 'MIGRATION_PENDING', current_control_brain: 'brain_a', copy_mode: 'follow_entry_user_exit', exit_feasibility: 'route_unhealthy', simulated: true },
  { id: 'pos_dd44', symbol: 'GIGADUST', mint: 'Du…St55', position_state: 'CLOSED_WITH_DUST', current_control_brain: 'brain_b', copy_mode: 'full_mirror', exit_feasibility: 'dust', simulated: true }
]);

export const INTENTS = Object.freeze([
  { id: 'int_001', intent_type: 'BUY_INTENT', issuing_brain: 'brain_a', position: 'pos_aa11', bundle_status: 'Landed', failure_type: null, simulated: true },
  { id: 'int_002', intent_type: 'SELL_INTENT', issuing_brain: 'brain_b', position: 'pos_bb22', bundle_status: 'Pending', failure_type: null, simulated: true },
  { id: 'int_003', intent_type: 'MIRROR_SELL_INTENT', issuing_brain: 'brain_b', position: 'pos_bb22', bundle_status: 'Failed', failure_type: 'SlippageExceeded', simulated: true },
  { id: 'int_004', intent_type: 'EMERGENCY_EXIT_INTENT', issuing_brain: 'brain_a', position: 'pos_cc33', bundle_status: 'STALE_BUNDLE', failure_type: 'BlockhashExpired', simulated: true },
  { id: 'int_005', intent_type: 'SCALE_IN_INTENT', issuing_brain: 'brain_a', position: 'pos_aa11', bundle_status: 'Invalid', failure_type: 'RouteInvalid', simulated: true }
]);

export const TRADES = Object.freeze([
  { id: 'trd_01', symbol: 'WIFDOGE', side: 'buy', qty: 1200000, fill_price: 0.0000142, fees: 4.1, slippage: 1.2, simulated: true },
  { id: 'trd_02', symbol: 'PUMPKAT', side: 'buy', qty: 540000, fill_price: 0.0000981, fees: 3.6, slippage: 0.9, simulated: true },
  { id: 'trd_03', symbol: 'PUMPKAT', side: 'sell', qty: 200000, fill_price: 0.0001120, fees: 2.2, slippage: 2.0, simulated: true },
  { id: 'trd_04', symbol: 'SOLBONK', side: 'buy', qty: 90000, fill_price: 0.0023100, fees: 4.92, slippage: 2.41, simulated: true }
]);

// ---- New Coin Radar opportunities (hunt_status / reasons) ----
export const OPPORTUNITIES = Object.freeze([
  { id: 'opp_01', symbol: 'WIFDOGE', mint: '4kZ…WIFd', new_token_priority_score: 0.91, hunt_status: 'accepted', accepted_reason: 'wallet_signal_confirmed', rejected_reason: null, quote_mint: 'wsol', trace: 'reviewed', simulated: true },
  { id: 'opp_02', symbol: 'PUMPKAT', mint: '9aP…PkAt', new_token_priority_score: 0.84, hunt_status: 'ranked', accepted_reason: null, rejected_reason: null, quote_mint: 'wsol', trace: 'degraded', simulated: true },
  { id: 'opp_03', symbol: 'RUGZILLA', mint: 'Rg…ziLa', new_token_priority_score: 0.77, hunt_status: 'rejected', accepted_reason: null, rejected_reason: 'token2022_dangerous_extension', quote_mint: 'wsol', trace: 'rejected', simulated: true },
  { id: 'opp_04', symbol: 'USDCAT', mint: 'Uc…dCat', new_token_priority_score: 0.69, hunt_status: 'rejected', accepted_reason: null, rejected_reason: 'unknown_quote_mint', quote_mint: 'unknown', trace: 'rejected', simulated: true },
  { id: 'opp_05', symbol: 'LATECOIN', mint: 'La…teCn', new_token_priority_score: 0.58, hunt_status: 'watch_only', accepted_reason: null, rejected_reason: 'slippage_vs_leader_exceeded', quote_mint: 'wsol', trace: 'degraded', simulated: true },
  { id: 'opp_06', symbol: 'DEXONLY', mint: 'Dx…onLy', new_token_priority_score: 0.44, hunt_status: 'rejected', accepted_reason: null, rejected_reason: 'dex_only_signal', quote_mint: 'wsol', trace: 'rejected', simulated: true },
  { id: 'opp_07', symbol: 'GIGADUST', mint: 'Du…St55', new_token_priority_score: 0.31, hunt_status: 'expired', accepted_reason: null, rejected_reason: 'hunt_window_expired', quote_mint: 'wsol', trace: 'rejected', simulated: true }
]);

export function traceFor(kind) {
  if (kind === 'reviewed') return DECISION_TRACE_REVIEWED;
  if (kind === 'rejected') return REJECTED_TRACE;
  return DECISION_TRACE;
}

// ---- Wallet intelligence + profitability read-model ----
// profitability-intelligence shape: profit_factor ALWAYS null.
export const WALLETS = Object.freeze([
  {
    id: 'wal_7Qx', address: '7Qx…m4D', tracked_wallet_status: 'copy_allowed', wallet_type: 'smart_money_wallet',
    copyability_by_brain: 'both', copyability_component_veto: false, copyability_veto_reason: null,
    profitability_win_rate: 0.62, profitability_win_loss_ratio: 1.7, profitability_profit_factor: null,
    advisory: 'PROFITABILITY_ADVISORY_KEEP_EVALUATING', drift_flag: false, drift_reason: null, simulated: true
  },
  {
    id: 'wal_3Mk', address: '3Mk…q9R', tracked_wallet_status: 'watch_only', wallet_type: 'kol_wallet',
    copyability_by_brain: 'brain_b', copyability_component_veto: true, copyability_veto_reason: 'crowd_follow_decay',
    profitability_win_rate: 0.55, profitability_win_loss_ratio: 1.1, profitability_profit_factor: null,
    advisory: 'PROFITABILITY_ADVISORY_PREFER_WATCH_ONLY', drift_flag: true, drift_reason: 'average_slippage_worsened', simulated: true
  },
  {
    id: 'wal_9Zt', address: '9Zt…b2C', tracked_wallet_status: 'degraded', wallet_type: 'mev_sniper_wallet',
    copyability_by_brain: 'none', copyability_component_veto: true, copyability_veto_reason: 'fake_profit_risk',
    profitability_win_rate: null, profitability_win_loss_ratio: null, profitability_profit_factor: null,
    advisory: 'PROFITABILITY_ADVISORY_INSUFFICIENT_EVIDENCE', drift_flag: true, drift_reason: 'fake_profit_risk_increased', simulated: true
  },
  {
    id: 'wal_5Yp', address: '5Yp…k7N', tracked_wallet_status: 'candidate', wallet_type: 'insider_wallet',
    copyability_by_brain: 'none', copyability_component_veto: true, copyability_veto_reason: 'non_copyable_profit_source',
    profitability_win_rate: 0.71, profitability_win_loss_ratio: 2.3, profitability_profit_factor: null,
    advisory: 'PROFITABILITY_ADVISORY_NOT_COPY_SUITABLE', drift_flag: false, drift_reason: null, simulated: true
  }
]);

// ---- Analytics: paper aggregation + calibration divergence + net business pnl ----
export const PAPER_AGGREGATION = Object.freeze([
  { wallet: 'wal_7Qx', max_drawdown: 0.18, win_rate: 0.62, avg_win: 41.2, avg_loss: -22.7, expectancy: 6.9, profit_factor: null, failed_trade_rate: 0.07, simulated: true },
  { wallet: 'wal_3Mk', max_drawdown: 0.27, win_rate: 0.55, avg_win: 33.0, avg_loss: -29.1, expectancy: 2.1, profit_factor: null, failed_trade_rate: 0.12, simulated: true },
  { wallet: 'wal_9Zt', max_drawdown: null, win_rate: null, avg_win: null, avg_loss: null, expectancy: null, profit_factor: null, failed_trade_rate: null, simulated: true }
]);

export const DIVERGENCE = Object.freeze([
  { dimension: 'fill', status: 'within_band', simulated: true },
  { dimension: 'slippage', status: 'elevated', simulated: true },
  { dimension: 'exit_success', status: 'high', simulated: true },
  { dimension: 'latency', status: 'within_band', simulated: true },
  { dimension: 'provider_reliability', status: 'elevated', simulated: true }
]);

export const NET_BUSINESS = Object.freeze({
  simulated: true,
  status: 'partial', // complete | partial | unavailable
  trade_net_pnl: 121.04,
  components: Object.freeze([
    { component: 'provider_credit_cost', value: -18.4 },
    { component: 'rpc_streaming_cost', value: -22.0 },
    { component: 'infra_storage_export_report_cost', value: null }, // unavailable
    { component: 'subscription_provider_cost', value: -30.0 }
  ])
});

// ---- My Wallets & Funds ----
export const EXECUTION_WALLETS = Object.freeze([
  { id: 'exec_01', address: 'Exe…c01A', execution_wallet_status: 'WARMING_UP', key_custody_mode: 'isolated_signer', signer_profile_status: 'ACTIVE', balance_sol: 4.21, provider_key_ref: 'pref_helius_****', simulated: true },
  { id: 'exec_02', address: 'Exe…c02B', execution_wallet_status: 'DISABLED', key_custody_mode: 'connected_wallet', signer_profile_status: 'DISABLED', balance_sol: 0.0, provider_key_ref: 'pref_jito_****', simulated: true },
  { id: 'exec_03', address: 'Exe…c03C', execution_wallet_status: 'DRAINING', key_custody_mode: 'isolated_signer', signer_profile_status: 'DEGRADED', balance_sol: 1.07, provider_key_ref: 'pref_helius_****', simulated: true }
]);

export const SETTLEMENT_WALLET = Object.freeze({ id: 'settle_01', address: 'Set…tle1', balance_sol: 38.6, assignment_policy: 'round_robin', sweep_policy: 'periodic', simulated: true });
export const FUNDING_WALLET = Object.freeze({ id: 'fund_01', address: 'Fnd…ing1', balance_sol: 102.5, simulated: true });

// ---- Settings & Safety: Hard Risk + EV + readiness ----
export const HARD_RISK = Object.freeze([
  { field: 'max_daily_loss_pct', value: 5, unit: '%' },
  { field: 'max_daily_loss_usdt', value: 250, unit: 'USDT' },
  { field: 'max_total_drawdown_pct', value: 20, unit: '%' },
  { field: 'max_open_positions', value: 8, unit: '' },
  { field: 'max_position_size_pct', value: 3, unit: '%' },
  { field: 'max_token_exposure_pct', value: 6, unit: '%' },
  { field: 'max_creator_exposure_pct', value: 4, unit: '%' },
  { field: 'max_cluster_exposure_pct', value: null, unit: '%' }, // missing -> would block REAL-LIVE
  { field: 'max_correlated_meme_exposure_pct', value: 10, unit: '%' }
]);

export const EV_GATE = Object.freeze({ ev_gate_mode: 'strict' });

// real-live-readiness verdict shape: { ready, blockers:[{code,detail}], prerequisite_for }
export const READINESS = Object.freeze({
  ready: false,
  prerequisite_for: 'activate_real_live',
  blockers: Object.freeze([
    { code: 'operating_state_not_ready', detail: 'operating_state must be ACTIVE' },
    { code: 'real_live_config_invalid', detail: 'real_live_config_valid must be true (max_cluster_exposure_pct missing)' },
    { code: 'execution_wallet_not_active', detail: 'execution_wallet_status must be ACTIVE' }
  ])
});

// mainnet-activation-seam shape: never ready, activation_performed fixed false.
export const ACTIVATION_SEAM = Object.freeze({
  activation_performed: false,
  real_live_activated: false,
  seam_ready: false,
  live_quote_enabled: false,
  owner_checklist: Object.freeze([
    { code: 'owner_supplies_signer_credentials', satisfied: false },
    { code: 'owner_funds_execution_wallet', satisfied: false },
    { code: 'owner_confirms_real_money_acknowledgement', satisfied: false },
    { code: 'all_hard_risk_limits_present', satisfied: false }
  ])
});

// ---- Stream health / readiness checklist (live-stream-boundary shape) ----
export const STREAM_HEALTH = Object.freeze({
  stream_health_state: 'EXITS_ONLY_SHAPED', // advisory cap
  last_seen_slot: 287654321,
  last_confirmed_slot: 287654309,
  readiness_checklist: Object.freeze([
    { item: 'priority_fee_cache', state: 'ready' },
    { item: 'jito_tip_cache', state: 'ready' },
    { item: 'protocol_constants', state: 'ready' },
    { item: 'rpc_health_green', state: 'ready' },
    { item: 'stream_sync', state: 'degraded' },
    { item: 'calibration_priors', state: 'pending' },
    { item: 'cost_pipeline', state: 'ready' }
  ])
});

// ---- Alerts ----
export const ALERTS = Object.freeze([
  { id: 'al_01', severity: 'critical', category: 'security', source: 'SignerService', message: 'Signer profile DEGRADED on exec_03 — review required.', ack_required: true, simulated: true },
  { id: 'al_02', severity: 'critical', category: 'risk', source: 'HardRiskGuard', message: 'max_cluster_exposure_pct is unset — REAL-LIVE config invalid.', ack_required: true, simulated: true },
  { id: 'al_03', severity: 'warning', category: 'provider', source: 'SlotLagMonitor', message: 'Provider slot lag elevated but within threshold.', ack_required: false, simulated: true },
  { id: 'al_04', severity: 'warning', category: 'data', source: 'CalibrationStore', message: 'Paper↔Real divergence (exit_success) is high.', ack_required: false, simulated: true },
  { id: 'al_05', severity: 'info', category: 'ops', source: 'OperatingStateMachine', message: 'System is WARMING_UP; entries disabled until ACTIVE.', ack_required: false, simulated: true }
]);

// ---- Glossary ----
export const GLOSSARY = Object.freeze([
  { term: 'Operating state', ssot: 'operating_state', def_en: 'The system-wide state controlling what is allowed: WARMING_UP, ACTIVE, EXITS_ONLY, PAUSED, KILLED.', def_ar: 'الحالة العامة التي تحكم ما يُسمح به: تهيئة، نشط، خروج فقط، موقوف، إيقاف صلب.' },
  { term: 'Hunt status', ssot: 'hunt_status', def_en: 'Pre-position opportunity lifecycle (discovered → ranked → gated → accepted/rejected/watch_only/expired/entered). Reflects a decision; it is not a gate and not a buy signal.', def_ar: 'دورة حياة الفرصة ما قبل المركز. تعكس قراراً؛ ليست بوّابة ولا إشارة شراء.' },
  { term: 'Priority score', ssot: 'new_token_priority_score', def_en: 'A ranking / display value only. Does not enter EV, grants no execution authority, and is never a buy signal.', def_ar: 'قيمة ترتيب/عرض فقط. لا تدخل EV ولا تمنح سلطة تنفيذ وليست إشارة شراء.' },
  { term: 'Rejected reason', ssot: 'rejected_reason', def_en: 'Why an opportunity did not proceed (e.g. token2022_dangerous_extension, unknown_quote_mint, dex_only_signal). Reflects a decision; it does not block by itself.', def_ar: 'سبب عدم المضي بالفرصة. يعكس قراراً؛ لا يحجب بنفسه.' },
  { term: 'Provider key reference', ssot: 'candidate_provider_key_ref', def_en: 'A by-reference handle to a stored secret. The raw key is NEVER shown in UI, logs, exports or reports. To fix a provider key, update the referenced secret out-of-band; the UI only displays the masked reference.', def_ar: 'مرجع لسرّ مخزّن. المفتاح الخام لا يُعرض أبداً. لإصلاح المفتاح يُحدَّث السرّ المُشار إليه خارج الواجهة؛ تعرض الواجهة المرجع المُقنّع فقط.' },
  { term: 'EV gate mode', ssot: 'ev_gate_mode', def_en: 'strict (profitability gates block) or warning_only (advisory). Never relaxes Hard-Risk limits.', def_ar: 'صارم (بوّابات الربحية تحجب) أو تحذيري فقط (استشاري). لا يخفّف حدود المخاطر الصلبة أبداً.' },
  { term: 'Mark status', ssot: 'candidate_mark_status', def_en: 'valid · stale · unavailable · low_confidence · display_only. Unrealized P&L is shown only when mark is valid.', def_ar: 'صالح · قديم · غير متوفر · ثقة منخفضة · عرض فقط. لا يُعرض الربح غير المحقّق إلا مع mark صالح.' }
]);
