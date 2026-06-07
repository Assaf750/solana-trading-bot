// @soltrade/ssot-types — candidate enums registry (Groups 22–41).
// SOURCE: docs/01-SSOT.md. These are GOVERNED CANDIDATES — registered in SSOT but
// NOT implemented and NOT final names. Every key MUST keep its `candidate_` prefix.
// Encoding here does NOT promote a candidate to implemented (skeleton != promotion).
//
// COVERAGE NOTE (no silent cap): this is a PRELIMINARY foundational subset of the
// candidate enums (PR-A2). SSOT registers more candidate enums across Groups 22–41;
// remaining ones are catalogued in later PRs. See README. The drift guard validates
// every entry listed here; it does NOT require completeness.

const f = Object.freeze;

export const CANDIDATE_ENUMS = f({
  // G22 P&L read-model mark / G28 price taxonomy
  candidate_mark_source: f(['executable_quote', 'route_quote', 'liquidity_estimate', 'display']),
  candidate_mark_status: f(['valid', 'stale', 'unavailable', 'low_confidence', 'display_only']),
  candidate_price_type: f(['display', 'executable_quote', 'mark', 'fill', 'quote']),
  candidate_price_provenance: f(['provider', 'derived_from_swaps', 'delayed', 'estimated', 'executable_route_aware']),
  candidate_price_status: f(['valid', 'stale', 'unavailable', 'low_confidence', 'display_only']),

  // G23 execution trace
  candidate_failure_origin: f(['provider', 'route', 'signer', 'risk', 'liquidity', 'blockhash', 'bundle', 'fill']),

  // G24 provider vocabulary
  candidate_provider_mode: f(['single', 'multi']),
  candidate_provider_role: f(['hot_path', 'enrichment', 'research', 'backup']),
  candidate_provider_tier: f(['fast', 'standard', 'free', 'backup']),

  // G25 recommendation layer (advisory)
  candidate_recommendation_type: f([
    'slow_provider', 'low_tip', 'tp_suggestion', 'sizing_suggestion', 'exclude_wallet',
    'add_provider', 'tp_suitability', 'time_of_day_regime',
  ]),
  candidate_recommendation_status: f(['open', 'converted_to_config_request', 'dismissed', 'superseded']),

  // G26 opportunity / charts
  candidate_opportunity_lifecycle: f(['watch_only', 'diagnostic', 'executable_candidate', 'copy_signal_candidate']),
  candidate_ohlcv_provenance: f(['provider', 'derived_from_swaps', 'delayed', 'estimated', 'executable_route_aware']),

  // G27 data / retention / reports / ops
  candidate_cost_basis_method: f(['fifo', 'average']),
  candidate_retention_profile: f(['30d', '90d', '180d', 'custom']),
  candidate_export_format: f(['markdown', 'csv', 'parquet', 'jsonl']),
  candidate_report_template_id: f(['trade_evaluation', 'failure_analysis', 'custom']),

  // G29 trade event / journal
  candidate_trade_event_type: f([
    'signal_observed', 'decision', 'risk', 'build', 'sign', 'send', 'land', 'fill',
    'partial_fill', 'exit_attempt', 'exit_fill', 'close', 'failure',
  ]),

  // G30/G32 wallet-token & token identity provenance
  candidate_wt_cost_completeness_status: f(['complete', 'partial', 'estimated', 'unavailable']),
  candidate_token_identity_provenance: f(['on_chain_mint', 'token_metadata', 'provider_enrichment', 'user_label', 'unknown']),
  candidate_token_symbol_trust: f(['verified', 'unverified', 'spoof_suspected']),
  candidate_signal_source: f(['followed_wallet', 'wallet_cluster', 'new_coin_radar', 'manual_review', 'system_diagnostic']),

  // G33 batch exit orchestration
  candidate_batch_exit_preview_item_status: f(['eligible', 'blocked', 'stale']),
  candidate_batch_exit_result_status: f(['submitted', 'blocked', 'failed', 'skipped', 'filled']),

  // G34 alerts
  candidate_alert_severity: f(['info', 'warning', 'critical']),
  candidate_alert_category: f(['security', 'risk', 'provider', 'data', 'ops', 'execution', 'wallet']),

  // G35 preferences / glossary / onboarding
  candidate_pref_language: f(['ar', 'en']),
  candidate_pref_direction: f(['rtl', 'ltr']),
  candidate_pref_mode: f(['beginner', 'advanced']),

  // G36 config policy candidate (representative)
  candidate_report_missing_metric_policy: f(['show_unavailable', 'omit', 'block_report']),
});

// Candidate reference fields that are not enums but must keep the candidate_ prefix.
export const CANDIDATE_FIELDS = f([
  'candidate_provider_key_ref', // provider secret reference (never a raw key)
]);
