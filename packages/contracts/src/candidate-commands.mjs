// @soltrade/contracts — candidate API commands / errors (Groups 24/25/27/33).
// SOURCE: docs/01-SSOT.md. GOVERNED CANDIDATES — NOT implemented command_type values
// and NOT final names (SSOT Group 11 note: stay candidate_* until 03-API-CONTRACT
// finalization). Every entry MUST keep its candidate_ prefix. They are NOT valid
// command_type values until promoted via ARCH -> SSOT.

const f = Object.freeze;

export const CANDIDATE_COMMANDS = f([
  // G24 provider
  'candidate_cmd_register_provider',
  'candidate_cmd_test_provider_connection',
  'candidate_cmd_disable_provider',
  'candidate_cmd_set_provider_role',
  // G25 recommendation (advisory; config flow only)
  'candidate_cmd_preview_recommendation_application',
  'candidate_cmd_request_config_update_from_recommendation',
  // G27 data / ops (admin/local-ops)
  'candidate_cmd_start_export_job',
  'candidate_cmd_purge_data',
  'candidate_cmd_restart_service',
  'candidate_cmd_backup',
  'candidate_cmd_export_diagnostic_bundle',
  // G33 batch exit (preview -> request per-position; no atomic mass exit)
  'candidate_cmd_preview_batch_exit',
  'candidate_cmd_request_batch_exit',
]);

export const CANDIDATE_ERRORS = f([
  'candidate_err_provider_unconfigured', // single-provider with no registered key (G24/G40)
]);
