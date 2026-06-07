// Types for candidate-enums.mjs. Candidate names are governed but NOT implemented.
// Keys always retain the `candidate_` prefix.

export type CandidateEnumName =
  | 'candidate_mark_source'
  | 'candidate_mark_status'
  | 'candidate_price_type'
  | 'candidate_price_provenance'
  | 'candidate_price_status'
  | 'candidate_failure_origin'
  | 'candidate_provider_mode'
  | 'candidate_provider_role'
  | 'candidate_provider_tier'
  | 'candidate_recommendation_type'
  | 'candidate_recommendation_status'
  | 'candidate_opportunity_lifecycle'
  | 'candidate_ohlcv_provenance'
  | 'candidate_cost_basis_method'
  | 'candidate_retention_profile'
  | 'candidate_export_format'
  | 'candidate_report_template_id'
  | 'candidate_trade_event_type'
  | 'candidate_wt_cost_completeness_status'
  | 'candidate_token_identity_provenance'
  | 'candidate_token_symbol_trust'
  | 'candidate_signal_source'
  | 'candidate_batch_exit_preview_item_status'
  | 'candidate_batch_exit_result_status'
  | 'candidate_alert_severity'
  | 'candidate_alert_category'
  | 'candidate_pref_language'
  | 'candidate_pref_direction'
  | 'candidate_pref_mode'
  | 'candidate_report_missing_metric_policy';

export const CANDIDATE_ENUMS: Readonly<Record<CandidateEnumName, readonly string[]>>;
export const CANDIDATE_FIELDS: readonly `candidate_${string}`[];
