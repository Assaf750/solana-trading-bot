// Types for candidate-commands.mjs. Candidate names are governed but NOT implemented.

export type CandidateCommand =
  | 'candidate_cmd_register_provider'
  | 'candidate_cmd_test_provider_connection'
  | 'candidate_cmd_disable_provider'
  | 'candidate_cmd_set_provider_role'
  | 'candidate_cmd_preview_recommendation_application'
  | 'candidate_cmd_request_config_update_from_recommendation'
  | 'candidate_cmd_start_export_job'
  | 'candidate_cmd_purge_data'
  | 'candidate_cmd_restart_service'
  | 'candidate_cmd_backup'
  | 'candidate_cmd_export_diagnostic_bundle'
  | 'candidate_cmd_preview_batch_exit'
  | 'candidate_cmd_request_batch_exit';

export type CandidateError = 'candidate_err_provider_unconfigured';

export const CANDIDATE_COMMANDS: readonly CandidateCommand[];
export const CANDIDATE_ERRORS: readonly CandidateError[];
