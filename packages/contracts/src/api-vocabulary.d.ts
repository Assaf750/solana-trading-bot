// Types for api-vocabulary.mjs. Values owned by docs/01-SSOT.md; consumed by docs/03-API-CONTRACT.md.

export type PermissionRole = 'viewer' | 'operator' | 'admin' | 'signer_control';
export type ResourceType =
  | 'config' | 'wallet' | 'position' | 'intent' | 'readiness' | 'audit' | 'health'
  | 'execution_wallet' | 'signer_profile' | 'asset_transfer' | 'wallet_rotation' | 'profit_sweep' | 'opportunity';

export type CommandType =
  | 'preview_config_update' | 'update_config' | 'apply_config_migration'
  | 'register_wallet' | 'update_wallet_config' | 'enable_wallet_follow' | 'disable_wallet_follow'
  | 'manual_exit_position' | 'emergency_exit_position' | 'cancel_intent'
  | 'pause_system' | 'resume_system' | 'trigger_kill_switch' | 'activate_real_live' | 'revoke_signer'
  | 'register_execution_wallet' | 'update_execution_wallet' | 'activate_execution_wallet'
  | 'drain_execution_wallet' | 'disable_execution_wallet' | 'revoke_execution_wallet'
  | 'set_execution_wallet_assignment_policy'
  | 'register_signer_profile' | 'disable_signer_profile' | 'revoke_signer_profile'
  | 'create_asset_transfer_intent' | 'cancel_asset_transfer_intent'
  | 'rotate_execution_wallet' | 'complete_wallet_rotation'
  | 'sweep_profits';

export type ApiErrorCode =
  | 'HARD_RISK_BYPASS_REJECTED' | 'REAL_LIVE_CONFIG_INVALID' | 'IDEMPOTENCY_CONFLICT' | 'PERMISSION_DENIED'
  | 'CONFIG_VALIDATION_FAILED' | 'IMMUTABLE_FIELD_FROZEN' | 'READ_ONLY_FIELD_REJECTED'
  | 'COMMAND_NOT_ALLOWED_IN_STATE' | 'RESOURCE_NOT_FOUND';

export type EventType =
  | 'position_update' | 'intent_update' | 'readiness_update' | 'health_update'
  | 'config_update' | 'audit_event' | 'error_event' | 'opportunity_update';

export type StreamChannel =
  | 'position' | 'intent' | 'readiness' | 'health' | 'config' | 'audit' | 'error' | 'opportunity';

export const PERMISSION_ROLE: readonly PermissionRole[];
export const RESOURCE_TYPE: readonly ResourceType[];
export const COMMAND_TYPE: readonly CommandType[];
export const API_ERROR_CODE: readonly ApiErrorCode[];
export const EVENT_TYPE: readonly EventType[];
export const STREAM_CHANNEL: readonly StreamChannel[];
export const ENVELOPE_FIELDS: readonly string[];
export const AUDIT_FIELDS: readonly string[];
export const API_VOCAB: Readonly<Record<string, readonly string[]>>;
