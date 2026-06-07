// @soltrade/contracts — API contract vocabulary (Groups 11–14).
// SOURCE: docs/01-SSOT.md (owns names) + docs/03-API-CONTRACT.md (consumes them).
// Logical command/resource/error/stream vocabulary only — NOT HTTP routes/methods.
// No name appears here that is not registered in SSOT. No execution authority is
// granted by any name here (opportunity is read-only; no opportunity command).

const f = Object.freeze;

// --- Group 11 — permission_role / resource_type ---
export const PERMISSION_ROLE = f(['viewer', 'operator', 'admin', 'signer_control']);
export const RESOURCE_TYPE = f([
  'config', 'wallet', 'position', 'intent', 'readiness', 'audit', 'health',
  'execution_wallet', 'signer_profile', 'asset_transfer', 'wallet_rotation', 'profit_sweep', 'opportunity',
]);

// --- Group 11 — command_type (logical API commands) ---
export const COMMAND_TYPE = f([
  // config
  'preview_config_update', 'update_config', 'apply_config_migration',
  // wallet
  'register_wallet', 'update_wallet_config', 'enable_wallet_follow', 'disable_wallet_follow',
  // position / intent
  'manual_exit_position', 'emergency_exit_position', 'cancel_intent',
  // critical operations
  'pause_system', 'resume_system', 'trigger_kill_switch', 'activate_real_live', 'revoke_signer',
  // execution_wallet
  'register_execution_wallet', 'update_execution_wallet', 'activate_execution_wallet',
  'drain_execution_wallet', 'disable_execution_wallet', 'revoke_execution_wallet',
  'set_execution_wallet_assignment_policy',
  // signer_profile
  'register_signer_profile', 'disable_signer_profile', 'revoke_signer_profile',
  // asset_transfer
  'create_asset_transfer_intent', 'cancel_asset_transfer_intent',
  // wallet_rotation
  'rotate_execution_wallet', 'complete_wallet_rotation',
  // profit_sweep
  'sweep_profits',
]);

// --- Group 11 — api_error_code ---
export const API_ERROR_CODE = f([
  'HARD_RISK_BYPASS_REJECTED', 'REAL_LIVE_CONFIG_INVALID', 'IDEMPOTENCY_CONFLICT', 'PERMISSION_DENIED',
  'CONFIG_VALIDATION_FAILED', 'IMMUTABLE_FIELD_FROZEN', 'READ_ONLY_FIELD_REJECTED',
  'COMMAND_NOT_ALLOWED_IN_STATE', 'RESOURCE_NOT_FOUND',
]);

// --- Group 12 — event_type (stream message classifier) ---
export const EVENT_TYPE = f([
  'position_update', 'intent_update', 'readiness_update', 'health_update',
  'config_update', 'audit_event', 'error_event', 'opportunity_update',
]);

// --- Group 13 — stream_channel (subscription scope) ---
export const STREAM_CHANNEL = f([
  'position', 'intent', 'readiness', 'health', 'config', 'audit', 'error', 'opportunity',
]);

// --- Group 12 — envelope / transport fields ---
export const ENVELOPE_FIELDS = f([
  'request_id', 'idempotency_key', 'created_at', 'updated_at', 'cursor', 'page_size',
  'sort_by', 'sort_order', 'error_message', 'error_details', 'event_sequence', 'event_timestamp',
  'payload_version', 'subscription_id', 'heartbeat_interval_ms',
]);

// --- Group 14 — audit fields ---
export const AUDIT_FIELDS = f(['audit_actor', 'audit_scope', 'audit_reason']);

// Registry keyed by SSOT source_of_truth_field — used by the drift guard.
export const API_VOCAB = f({
  permission_role: PERMISSION_ROLE,
  resource_type: RESOURCE_TYPE,
  command_type: COMMAND_TYPE,
  api_error_code: API_ERROR_CODE,
  event_type: EVENT_TYPE,
  stream_channel: STREAM_CHANNEL,
});
