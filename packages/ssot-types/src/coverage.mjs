// @soltrade/ssot-types — SSOT coverage manifest (PR-A2).
// Machine-readable record of what this monorepo's typed registries currently consume
// from docs/01-SSOT.md, and which candidate enums are explicitly DEFERRED (not yet
// included) — so deferral is explicit, never a silent omission.
//
// GOVERNANCE:
//   - DEFERRED candidates are GOVERNED but NOT included, NOT implemented, and MUST NOT
//     be used at runtime/API. They keep their candidate_ prefix and stay candidate.
//   - The package does NOT claim full SSOT coverage while any candidate is deferred
//     (CLAIMS_FULL_SSOT_COVERAGE = false).
//   - The drift guard (tools/check-ssot-drift.mjs) fails if a candidate enum exists in
//     SSOT but is neither included nor listed here as deferred.

const f = Object.freeze;

// SSOT groups consumed by ssot-types + contracts (names actually wired as types/values).
export const SSOT_GROUPS_CONSUMED = f({
  // Fully-consumed foundational groups (non-candidate enums/vocabulary).
  full: f([1, 2, 3, 5, 10, 11, 12, 13, 14, 15, 16, 17]),
  // Group 9 consumed as the Rejected Aliases / forbidden registry (not as fields).
  partial: f([9]),
  // Candidate groups partially consumed (foundational subset; remainder deferred below).
  candidate_partial: f([22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41]),
});

// Candidate enums DEFERRED in PR-A2 — registered in SSOT, explicitly NOT yet included.
// Each is `deferred_candidate`: governed, prefix-kept, not implemented, not used at runtime/API.
export const DEFERRED_CANDIDATES = f([
  'candidate_adverse_selection_reason',
  'candidate_adverse_selection_severity',
  'candidate_balance_provenance',
  'candidate_balance_reconciliation_status',
  'candidate_business_cost_component',
  'candidate_cluster_provenance',
  'candidate_cluster_usage_policy',
  'candidate_copyability_veto_reason',
  'candidate_creator_cluster_learning_metric',
  'candidate_creator_cluster_learning_recommendation',
  'candidate_edge_health_status',
  'candidate_fake_profit_reason',
  'candidate_finality_state',
  'candidate_glossary_edit_policy',
  'candidate_glossary_locale',
  'candidate_graduation_trap_state',
  'candidate_implementation_status',
  'candidate_leader_balance_reconstruction_status',
  'candidate_local_ops_service_status',
  'candidate_local_ops_service_type',
  'candidate_local_run_evidence_status',
  'candidate_local_run_workflow_status',
  'candidate_maintenance_action_status',
  'candidate_maintenance_action_type',
  'candidate_maintenance_audit_status',
  'candidate_maintenance_permission_status',
  'candidate_maintenance_preview_status',
  'candidate_maintenance_reversibility_status',
  'candidate_mark_price_source_preference',
  'candidate_migration_status',
  'candidate_multi_leader_attribution_policy',
  'candidate_net_business_pnl_status',
  'candidate_ob_selected_mode',
  'candidate_operator_log_category',
  'candidate_operator_log_redaction_status',
  'candidate_operator_log_severity',
  'candidate_paper_aggregation_dimension',
  'candidate_paper_aggregation_metric',
  'candidate_paper_outcome_reason',
  'candidate_paper_outcome_state',
  'candidate_paper_real_divergence_dimension',
  'candidate_paper_real_divergence_status',
  'candidate_paper_settings_evidence_status',
  'candidate_post_upgrade_health_verification',
  'candidate_price_status_display_policy',
  'candidate_profit_source_copyability_class',
  'candidate_profit_source_type',
  'candidate_provider_capability_status',
  'candidate_provider_cost_attribution_status',
  'candidate_provider_cost_metric',
  'candidate_provider_latency_type',
  'candidate_provider_type',
  'candidate_pruning_safety_status',
  'candidate_pump_classification',
  'candidate_reevaluation_recommendation',
  'candidate_reevaluation_trigger',
  'candidate_report_context',
  'candidate_report_definition_type',
  'candidate_report_disclaimer_required_for',
  'candidate_report_disclaimer_requirement',
  'candidate_report_gate_context',
  'candidate_report_redaction_policy',
  'candidate_report_section',
  'candidate_rollback_availability',
  'candidate_rollback_path_status',
  'candidate_safe_shutdown_status',
  'candidate_status_verification_state',
  'candidate_storage_cost_component',
  'candidate_token_concentration_dimension',
  'candidate_token_identity_display_policy',
  'candidate_token_readiness_component_type',
  'candidate_token_safety_reason',
  'candidate_upgrade_backup_requirement',
  'candidate_upgrade_incident_status',
  'candidate_upgrade_migration_compatibility',
  'candidate_upgrade_preflight_status',
  'candidate_version_compatibility_status',
  'candidate_wallet_drift_reason',
  'candidate_wallet_drift_recommendation',
  'candidate_wallet_type',
  'candidate_wallet_type_provenance',
  'candidate_weekly_comparison_axis',
  'candidate_wt_cost_completeness_display_policy',
]);

// This package does NOT claim complete SSOT coverage while candidates are deferred.
export const CLAIMS_FULL_SSOT_COVERAGE = false;
