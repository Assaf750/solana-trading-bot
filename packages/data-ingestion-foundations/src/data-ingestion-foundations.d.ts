// @soltrade/data-ingestion-foundations — type declarations
//
// Stage-4 Data Ingestion Foundation core (read-only / replay-mock).
// All results are read-only and open NO trading/signal/risk/routing readiness.

export type IngestionSourceState =
  | 'INGESTION_SOURCE_UNCONFIGURED'
  | 'INGESTION_SOURCE_INVALID'
  | 'INGESTION_SOURCE_READ_ONLY_OK';

export type IngestionSourceTag =
  | 'mock_replay'
  | 'fixture_replay'
  | 'helius_laserstream_disabled'
  | 'triton_yellowstone_disabled'
  | 'rpc_read_only_reference';

export type NormalizedIngestionEventType =
  | 'wallet_transaction_observed'
  | 'token_account_change_observed'
  | 'swap_observed'
  | 'mint_observed'
  | 'pool_observed'
  | 'balance_change_observed';

export type ReplayBatchState =
  | 'REPLAY_BATCH_UNCONFIGURED'
  | 'REPLAY_BATCH_INVALID'
  | 'REPLAY_BATCH_DEGRADED'
  | 'REPLAY_BATCH_READ_ONLY_OK';

/** Immutable safety attestations carried on every result. */
export interface IngestionSafeFlags {
  readonly read_only: true;
  readonly live_stream_enabled: false;
  readonly network_call_made: false;
  readonly endpoint_resolved: false;
  readonly has_secret: false;
  readonly trading_ready: false;
  readonly signal_ready: false;
  readonly risk_ready: false;
  readonly routing_ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly signing_permitted: false;
  readonly broadcast_permitted: false;
  readonly is_live: false;
  readonly mainnet_enabled: false;
  readonly real_live: false;
}

// --- (C) Source Descriptor -------------------------------------------------

export interface IngestionSourceDescriptorContract extends IngestionSafeFlags {
  readonly contract: 'ingestion-source-descriptor';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly supported_source_tags: readonly IngestionSourceTag[];
  readonly supported_states: readonly IngestionSourceState[];
  readonly source_state: IngestionSourceState;
  readonly source_descriptor_valid: boolean;
  readonly status: IngestionSourceState;
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface IngestionSourceValidateResult extends IngestionSafeFlags {
  readonly valid: boolean;
  readonly recognized: boolean;
  readonly reasons: readonly string[];
}

export interface IngestionSourceBoundaryResult extends IngestionSafeFlags {
  readonly valid: boolean;
  readonly source_state: IngestionSourceState;
  readonly source_descriptor_valid: boolean;
  readonly source_ref?: string;
  readonly status: IngestionSourceState;
  readonly reasons: readonly string[];
}

export function describeIngestionSourceDescriptorContract(): IngestionSourceDescriptorContract;
export function validateIngestionSourceDescriptor(
  input: unknown,
): IngestionSourceValidateResult;
export function evaluateIngestionSourceBoundary(
  input: unknown,
): IngestionSourceBoundaryResult;

// --- (E) Normalized Event Envelope -----------------------------------------

export interface NormalizedIngestionEventContract extends IngestionSafeFlags {
  readonly contract: 'normalized-ingestion-event';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly supported_event_types: readonly NormalizedIngestionEventType[];
  readonly safe_ref_fields: readonly string[];
  readonly observations_only: true;
  readonly normalized_event_valid: boolean;
  readonly note: string;
}

export interface NormalizedIngestionEventValidateResult extends IngestionSafeFlags {
  readonly valid: boolean;
  readonly recognized: boolean;
  readonly reasons: readonly string[];
}

/** Whitelisted opaque refs only; never secret/endpoint/exec data. */
export interface NormalizedIngestionEventEnvelope {
  readonly read_only: true;
  readonly event_ref?: string;
  readonly source_ref?: string;
  readonly observed_at_ref?: string;
  readonly event_type?: string;
  readonly wallet_ref?: string;
  readonly token_ref?: string;
  readonly signature_ref?: string;
  readonly slot_ref?: string | number;
}

export interface NormalizeIngestionEventResult extends IngestionSafeFlags {
  readonly normalized: boolean;
  readonly normalized_event: NormalizedIngestionEventEnvelope | null;
  readonly event_type?: string;
  readonly reasons: readonly string[];
}

export function describeNormalizedIngestionEventContract(): NormalizedIngestionEventContract;
export function validateNormalizedIngestionEvent(
  rawEvent: unknown,
): NormalizedIngestionEventValidateResult;
export function normalizeIngestionEvent(rawEvent: unknown): NormalizeIngestionEventResult;

// --- (D) Replay / Mock Harness ---------------------------------------------

export interface ReplayIngestionHarnessContract extends IngestionSafeFlags {
  readonly contract: 'replay-ingestion-harness';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly supported_states: readonly ReplayBatchState[];
  readonly required_attestations: readonly string[];
  readonly batch_state: ReplayBatchState;
  readonly batch_read_only_ok: boolean;
  readonly normalized_count: number;
  readonly invalid_count: number;
  readonly quarantined_count: number;
  readonly duplicate_count: number;
  readonly status: ReplayBatchState;
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface ReplayIngestionBatchValidateResult extends IngestionSafeFlags {
  readonly valid: boolean;
  readonly recognized: boolean;
  readonly reasons: readonly string[];
}

export interface ReplayIngestionBatchResult extends IngestionSafeFlags {
  readonly valid: boolean;
  readonly batch_state: ReplayBatchState;
  readonly batch_read_only_ok: boolean;
  readonly normalized_count: number;
  readonly invalid_count: number;
  readonly quarantined_count: number;
  readonly duplicate_count: number;
  readonly status: ReplayBatchState;
  readonly reasons: readonly string[];
}

export function describeReplayIngestionHarnessContract(): ReplayIngestionHarnessContract;
export function validateReplayIngestionBatch(
  input: unknown,
): ReplayIngestionBatchValidateResult;
export function evaluateReplayIngestionBatch(input: unknown): ReplayIngestionBatchResult;

// --- (F1) Dedupe / Idempotency ---------------------------------------------

export type IngestionDedupeState =
  | 'DEDUPE_UNCONFIGURED'
  | 'DEDUPE_INVALID'
  | 'DEDUPE_DEGRADED'
  | 'DEDUPE_OK';

export interface IngestionDedupeContract extends IngestionSafeFlags {
  readonly contract: 'ingestion-dedupe';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly supported_states: readonly IngestionDedupeState[];
  readonly dedupe_state: IngestionDedupeState;
  readonly accepted_count: number;
  readonly duplicate_count: number;
  readonly quarantined_count: number;
  readonly persistence_performed: false;
  readonly status: IngestionDedupeState;
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface IngestionDedupeResult extends IngestionSafeFlags {
  readonly valid: boolean;
  readonly dedupe_state: IngestionDedupeState;
  readonly accepted_count: number;
  readonly duplicate_count: number;
  readonly quarantined_count: number;
  readonly persistence_performed: false;
  readonly status: IngestionDedupeState;
  readonly reasons: readonly string[];
}

export function describeIngestionDedupeContract(): IngestionDedupeContract;
export function evaluateIngestionDedupe(input: unknown): IngestionDedupeResult;

// --- (F2) Cursor / Checkpoint ----------------------------------------------

export type IngestionCursorState =
  | 'CURSOR_UNCONFIGURED'
  | 'CURSOR_INVALID'
  | 'CURSOR_VALID'
  | 'CURSOR_STALE';

export interface IngestionCursorContract extends IngestionSafeFlags {
  readonly contract: 'ingestion-cursor';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly supported_states: readonly IngestionCursorState[];
  readonly cursor_state: IngestionCursorState;
  readonly next_cursor_ref?: string;
  readonly checkpoint_valid: boolean;
  readonly persistence_performed: false;
  readonly status: IngestionCursorState;
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface IngestionCursorResult extends IngestionSafeFlags {
  readonly valid: boolean;
  readonly cursor_state: IngestionCursorState;
  readonly next_cursor_ref?: string;
  readonly checkpoint_valid: boolean;
  readonly persistence_performed: false;
  readonly status: IngestionCursorState;
  readonly reasons: readonly string[];
}

export function describeIngestionCursorContract(): IngestionCursorContract;
export function evaluateIngestionCursor(input: unknown): IngestionCursorResult;

// --- (G) Ingestion Health / Status -----------------------------------------

export type IngestionHealthState =
  | 'INGESTION_UNCONFIGURED'
  | 'INGESTION_DEGRADED'
  | 'INGESTION_REPLAY_READY'
  | 'INGESTION_BLOCKED'
  | 'INGESTION_STALE';

export interface IngestionHealthContract extends IngestionSafeFlags {
  readonly contract: 'ingestion-health';
  readonly version: '0.0.0';
  readonly test_only: true;
  readonly consumes: readonly string[];
  readonly supported_states: readonly IngestionHealthState[];
  readonly ingestion_state: IngestionHealthState;
  readonly ingestion_replay_ready: boolean;
  readonly status: IngestionHealthState;
  readonly reasons: readonly string[];
  readonly note: string;
}

export interface IngestionHealthResult extends IngestionSafeFlags {
  readonly valid: boolean;
  readonly ingestion_state: IngestionHealthState;
  readonly ingestion_replay_ready: boolean;
  readonly status: IngestionHealthState;
  readonly reasons: readonly string[];
}

export function describeIngestionHealthContract(): IngestionHealthContract;
export function evaluateIngestionHealth(inputs: unknown): IngestionHealthResult;
