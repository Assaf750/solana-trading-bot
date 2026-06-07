# SSOT Coverage Manifest — `@soltrade/ssot-types` + `@soltrade/contracts` (PR-A2)

> مصدر الأسماء: **`docs/01-SSOT.md`** + **`docs/03-API-CONTRACT.md`** فقط. هذا الملف توثيق لما استُهلك فعلياً، وما هو **deferred_candidate** (مؤجّل صراحةً لا محذوف صامتاً). النسخة الآلية في `src/coverage.mjs` ويفرضها `tools/check-ssot-drift.mjs`.

## 0. تأكيدات الحوكمة
- **لا ادّعاء بتغطية SSOT كاملة** ما دام هناك candidate مؤجّل: `CLAIMS_FULL_SSOT_COVERAGE = false`.
- كل **deferred_candidate**: مُسجَّل في SSOT، **غير مُدرَج**، **غير implemented**، **لا يُستخدَم runtime/API**، ويحتفظ ببادئة `candidate_`.
- drift guard **يفشل** إذا: ظهر candidate enum في SSOT ليس included ولا deferred · حُذفت بادئة `candidate_` · ظهر candidate command داخل `command_type` الحقيقي · ظهر أي forbidden command/field.

## 1. مجموعات SSOT المستهلَكة
- **مُستهلَكة (non-candidate enums/vocabulary):** Groups **1, 2, 3, 5, 10, 11, 12, 13, 14, 15, 16, 17**.
- **مُستهلَكة كسجلّ رفض:** Group **9** (Rejected Aliases → `forbidden.mjs`).
- **candidate جزئياً (مجموعة أساسية + الباقي deferred):** Groups **22–41**.

## 2. الأسماء المُدرَجة فعلياً في `ssot-types`
**core enums (31):** `operating_state` · `position_state` · `migration_phase` · `copy_mode` · `ev_gate_mode` · `sizing_mode` · `partial_sell_policy` · `transfer_exit_policy` · `scale_in_policy` · `conflict_resolution` · `strategy_brain` · `execution_mode` · `intent_type` · `failure_type` · `bundle_status` · `copy_event` · `protocol_constant_status` · `validation_status` · `key_custody_mode` · `signer_profile_status` · `execution_wallet_status` · `wallet_assignment_policy` · `execution_wallet_creation_mode` · `asset_transfer_status` · `rotation_trigger` · `wallet_rotation_status` · `profit_sweep_policy` · `hunt_status` · `quote_mint` · `accepted_reason` · `rejected_reason`
**+ ثوابت:** `WARNING_CRITICAL` · `COPY_EVENT_CLASSIFICATION_FLAG` (`HIGH_EXIT_RISK`/`WHIPSAW_OR_MEV_LIKE`).

**candidate enums included (30):** `candidate_mark_source` · `candidate_mark_status` · `candidate_price_type` · `candidate_price_provenance` · `candidate_price_status` · `candidate_failure_origin` · `candidate_provider_mode` · `candidate_provider_role` · `candidate_provider_tier` · `candidate_recommendation_type` · `candidate_recommendation_status` · `candidate_opportunity_lifecycle` · `candidate_ohlcv_provenance` · `candidate_cost_basis_method` · `candidate_retention_profile` · `candidate_export_format` · `candidate_report_template_id` · `candidate_trade_event_type` · `candidate_wt_cost_completeness_status` · `candidate_token_identity_provenance` · `candidate_token_symbol_trust` · `candidate_signal_source` · `candidate_batch_exit_preview_item_status` · `candidate_batch_exit_result_status` · `candidate_alert_severity` · `candidate_alert_category` · `candidate_pref_language` · `candidate_pref_direction` · `candidate_pref_mode` · `candidate_report_missing_metric_policy`
**candidate fields included (1):** `candidate_provider_key_ref`

## 3. الأسماء المُدرَجة فعلياً في `contracts`
**API vocab (6):** `permission_role` · `resource_type` · `command_type` (30 قيمة) · `api_error_code` (9) · `event_type` (8) · `stream_channel` (8)
**envelope (15):** `request_id` · `idempotency_key` · `created_at` · `updated_at` · `cursor` · `page_size` · `sort_by` · `sort_order` · `error_message` · `error_details` · `event_sequence` · `event_timestamp` · `payload_version` · `subscription_id` · `heartbeat_interval_ms`
**audit (3):** `audit_actor` · `audit_scope` · `audit_reason`
**candidate commands (13):** `candidate_cmd_register_provider` · `candidate_cmd_test_provider_connection` · `candidate_cmd_disable_provider` · `candidate_cmd_set_provider_role` · `candidate_cmd_preview_recommendation_application` · `candidate_cmd_request_config_update_from_recommendation` · `candidate_cmd_start_export_job` · `candidate_cmd_purge_data` · `candidate_cmd_restart_service` · `candidate_cmd_backup` · `candidate_cmd_export_diagnostic_bundle` · `candidate_cmd_preview_batch_exit` · `candidate_cmd_request_batch_exit`
**candidate errors (1):** `candidate_err_provider_unconfigured`

## 4. candidate enums مؤجّلة (deferred_candidate)
**العدد: 83 من أصل 113 candidate enum في SSOT** (included = 30). القائمة الكاملة الآلية في `src/coverage.mjs › DEFERRED_CANDIDATES`. ملخّص بالعائلة:
- **Paper/Profit (G37):** `candidate_paper_outcome_state` · `candidate_paper_outcome_reason` · `candidate_paper_aggregation_dimension` · `candidate_paper_aggregation_metric` · `candidate_paper_real_divergence_status` · `candidate_paper_real_divergence_dimension` · `candidate_paper_settings_evidence_status` · `candidate_profit_source_type` · `candidate_profit_source_copyability_class` · `candidate_fake_profit_reason` · `candidate_edge_health_status` · `candidate_token_readiness_component_type`
- **Discovery/Copy (G38 + G16/30/32):** `candidate_wallet_type` · `candidate_wallet_type_provenance` · `candidate_token_concentration_dimension` · `candidate_pump_classification` · `candidate_wallet_drift_reason` · `candidate_wallet_drift_recommendation` · `candidate_creator_cluster_learning_metric` · `candidate_creator_cluster_learning_recommendation` · `candidate_adverse_selection_reason` · `candidate_adverse_selection_severity` · `candidate_copyability_veto_reason` · `candidate_cluster_provenance` · `candidate_cluster_usage_policy` · `candidate_balance_provenance` · `candidate_balance_reconciliation_status` · `candidate_leader_balance_reconstruction_status` · `candidate_token_safety_reason` · `candidate_graduation_trap_state`
- **Reports/Honesty (G39):** `candidate_report_context` · `candidate_report_section` · `candidate_report_definition_type` · `candidate_report_disclaimer_requirement` · `candidate_report_disclaimer_required_for` · `candidate_report_gate_context` · `candidate_report_redaction_policy` · `candidate_weekly_comparison_axis` · `candidate_net_business_pnl_status` · `candidate_business_cost_component`
- **Execution/Providers+Data (G40):** `candidate_provider_type` · `candidate_provider_latency_type` · `candidate_provider_cost_metric` · `candidate_provider_cost_attribution_status` · `candidate_provider_capability_status` · `candidate_finality_state` · `candidate_storage_cost_component` · `candidate_pruning_safety_status` · `candidate_reevaluation_trigger` · `candidate_reevaluation_recommendation`
- **Local Ops/Readiness (G41):** `candidate_local_run_workflow_status` · `candidate_local_run_evidence_status` · `candidate_local_ops_service_type` · `candidate_local_ops_service_status` · `candidate_operator_log_severity` · `candidate_operator_log_category` · `candidate_operator_log_redaction_status` · `candidate_migration_status` · `candidate_rollback_availability` · `candidate_rollback_path_status` · `candidate_safe_shutdown_status` · `candidate_status_verification_state` · `candidate_version_compatibility_status` · `candidate_implementation_status`
- **Maintenance/Upgrade (G27/41):** `candidate_maintenance_action_type` · `candidate_maintenance_action_status` · `candidate_maintenance_preview_status` · `candidate_maintenance_permission_status` · `candidate_maintenance_audit_status` · `candidate_maintenance_reversibility_status` · `candidate_upgrade_preflight_status` · `candidate_upgrade_backup_requirement` · `candidate_upgrade_migration_compatibility` · `candidate_upgrade_incident_status` · `candidate_post_upgrade_health_verification`
- **Config display policies (G36):** `candidate_price_status_display_policy` · `candidate_mark_price_source_preference` · `candidate_wt_cost_completeness_display_policy` · `candidate_multi_leader_attribution_policy` · `candidate_token_identity_display_policy` · `candidate_glossary_edit_policy` · `candidate_glossary_locale` · `candidate_ob_selected_mode` · `candidate_provider_cost_metric` (مكرّر بالعائلة)

> أي candidate مؤجّل يُنقل إلى included في PR لاحق عبر إدراجه في `CANDIDATE_ENUMS` وإزالته من `DEFERRED_CANDIDATES` — ويبقى drift guard هو الحارس الذي يمنع أي إغفال.

## 5. خارج النطاق صراحةً (لا يُدرَج أبداً)
الأسماء المرفوضة/الممنوعة في `src/forbidden.mjs` (legacy P&L · `current_price` · `exit_all_positions`/`batch_exit_all_positions` · `buy_/execute_/submit_opportunity` · `HUNTABLE` · …) — **ليست deferred، بل rejected/forbidden**.
