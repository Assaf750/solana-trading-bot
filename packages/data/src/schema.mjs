// @soltrade/data — data-model registry (CORE, non-candidate).
// SOURCE: docs/05-DATA-MODEL.md §4–§7 + docs/01-SSOT.md. API-facing columns use SSOT
// names only; storage-only columns are internal (id/FKs/partition/ingest markers) and
// are NOT API fields. candidate data additions (§8–§17) are OUT OF SCOPE for PR-A4.
// No rejected name is generated as a column/entity (see @soltrade/ssot-types forbidden).

const f = Object.freeze;
const t = (engine, api, storage_only, extra = {}) => f({ engine, api: f(api), storage_only: f(storage_only), ...extra });

// PostgreSQL — authoritative transactional state (§4) + runtime state (§5).
export const PG_TABLES = f({
  // --- §4 core ---
  config_versions: t('postgres', ['config_version', 'validation_status', 'created_at', 'audit_actor'], ['id', 'superseded_at', 'config_payload']),
  wallet_registry: t('postgres', ['tracked_wallet_address', 'follow_enabled', 'take_profit_pct', 'copy_mode', 'config_version', 'created_at', 'updated_at'], ['id', 'per_wallet_config_payload']),
  positions: t('postgres', ['position_state', 'entry_brain', 'current_control_brain', 'market_phase', 'migration_phase', 'active_exit_route', 'config_version_at_entry', 'cumulative_ignored_sell', 'position_owner_wallet_id', 'entry_execution_wallet_id', 'current_execution_wallet_id', 'created_at', 'updated_at'], ['id', 'wallet_registry_fk', 'execution_wallet_fk', 'token_ref']),
  intents: t('postgres', ['intent_id', 'intent_type', 'issuing_brain', 'bundle_status', 'failure_type', 'execution_wallet_id', 'signer_profile_id', 'idempotency_key', 'created_at', 'updated_at'], ['id', 'position_fk', 'execution_wallet_fk', 'signer_profile_fk', 'retry_linkage']),
  audit_log: t('postgres', ['audit_actor', 'audit_scope', 'audit_reason', 'command_type', 'resource_type', 'permission_role', 'request_id', 'idempotency_key', 'event_sequence', 'event_timestamp', 'api_error_code'], ['id', 'partition_date'], { append_only: true }),
  permissions: t('postgres', ['permission_role', 'audit_actor', 'created_at', 'updated_at'], ['id', 'credential_ref']),
  execution_wallets: t('postgres', ['execution_wallet_id', 'execution_wallet_address', 'execution_wallet_status', 'key_custody_mode', 'signer_profile_id', 'funding_wallet_id', 'settlement_wallet_id', 'created_at', 'updated_at'], ['id', 'signer_profile_fk']),
  signer_profiles: t('postgres', ['signer_profile_id', 'key_custody_mode', 'signer_profile_status', 'created_at', 'updated_at'], ['id']),
  asset_transfer_intents: t('postgres', ['asset_transfer_intent_id', 'asset_transfer_status', 'source_execution_wallet_id', 'destination_execution_wallet_id', 'idempotency_key', 'created_at', 'updated_at'], ['id', 'position_fk', 'source_fk', 'destination_fk']),
  wallet_rotation_events: t('postgres', ['wallet_rotation_status', 'rotation_trigger', 'rotation_from_execution_wallet_id', 'rotation_to_execution_wallet_id', 'created_at', 'updated_at'], ['id', 'from_fk', 'to_fk']),
  profit_sweep_events: t('postgres', ['profit_sweep_policy', 'profit_sweep_interval_ms', 'settlement_wallet_id', 'settlement_wallet_address', 'created_at'], ['id', 'source_execution_wallet_fk', 'sweep_amount_internal']),
  token_opportunities: t('postgres', ['hunt_status', 'new_token_priority_score', 'recycled_token_flag', 'name_impersonation_score', 'creator_launch_rate_flag', 'token_readiness_score', 'accepted_reason', 'rejected_reason', 'discovery_latency_ms', 'signal_to_execution_ms', 'latency_to_copy', 'entry_slippage_vs_leader', 'copyability_by_brain'], ['id', 'token_ref', 'wallet_registry_fk', 'source_events', 'intent_fk', 'position_fk', 'created_at', 'updated_at']),

  // --- §5 runtime state ---
  operating_runtime_state: t('postgres', ['operating_state', 'disable_new_adds', 'updated_at'], ['id', 'last_transition_reason_internal']),
  provider_stream_state: t('postgres', ['provider_degraded', 'slot_lag', 'last_seen_slot', 'last_confirmed_slot', 'protocol_constant_status', 'updated_at'], ['id', 'provider_keys_internal']),
  position_runtime_index: t('postgres', ['position_state', 'current_execution_wallet_id', 'position_owner_wallet_id'], ['id', 'position_fk'], { projection: true }),
  execution_wallet_runtime_eligibility: t('postgres', [], ['id', 'execution_wallet_fk', 'signer_profile_fk', 'dependency_markers'], { projection: true }),
  derived_readiness_cache: t('postgres', ['real_live_config_valid', 'validation_status'], ['id', 'dependency_markers'], { projection: true }),
  wallet_intelligence_projection: t('postgres', ['copyability_by_brain', 'crowd_follow_score', 'profit_concentration', 'tracked_wallet_status'], ['wallet_registry_fk', 'dependency_markers', 'rebuilt_at'], { projection: true }),
});

// ClickHouse — analytical/events/replay projection only (§6). Never command authority.
export const CH_TABLES = f({
  stream_events: t('clickhouse', ['event_type', 'event_sequence', 'event_timestamp'], ['ingested_at', 'partition_date', 'source_topic']),
  trade_fills: t('clickhouse', ['intent_id', 'execution_wallet_id', 'signer_profile_id', 'event_timestamp'], ['ingested_at', 'partition_date']),
  execution_outcomes: t('clickhouse', ['intent_id', 'bundle_status', 'failure_type', 'event_timestamp'], ['ingested_at', 'partition_date', 'attempt_id_internal', 'tx_signature_internal']),
  wallet_observations: t('clickhouse', ['tracked_wallet_address', 'copy_event', 'event_timestamp'], ['ingested_at', 'partition_date']),
  replay_backtest_observations: t('clickhouse', ['event_timestamp'], ['ingested_at', 'partition_date', 'backtest_run_id_internal']),
  metrics_timeseries: t('clickhouse', ['event_timestamp'], ['ingested_at', 'partition_date', 'metric_keys_internal']),
});

// Redis / RAM — projection/cache only (§7). Rebuildable; NO trading event bus; NO secrets.
export const REDIS_NAMESPACES = f({
  hot_wallet_sets: f({ rebuild_source: 'wallet_registry' }),
  dedup_keys: f({ rebuild_source: 'intents' }),
  stream_cursors: f({ rebuild_source: 'provider_stream_state' }),
  runtime_cache: f({ rebuild_source: 'authoritative_sources', ttl: true }),
  quote_fee_tip_cache: f({ rebuild_source: 'cost_pipeline', ttl: true }),
  curve_pool_state_cache: f({ rebuild_source: 'chain_stream', ttl: true }),
  execution_wallet_hot_eligibility_cache: f({ rebuild_source: 'execution_wallet_runtime_eligibility', ttl: true }),
});

export const ALL_TABLES = f({ ...PG_TABLES, ...CH_TABLES });

// Audit columns (SSOT G14/G11/G12) — the only allowed audit fields. Append-only.
export const AUDIT_COLUMNS = f(PG_TABLES.audit_log.api);

// Every API-facing data name declared above (for the drift guard).
export const API_DATA_NAMES = f([
  ...Object.keys(ALL_TABLES),
  ...Object.values(ALL_TABLES).flatMap((d) => d.api),
]);
