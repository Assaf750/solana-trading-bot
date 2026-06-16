// @soltrade/contracts — Live-First data-model contracts (ADR-0001). Types.

export type TradeSide = 'buy' | 'sell';
export type DecisionOutcome = 'accept' | 'reject' | 'warn';
export type IntentStatus =
  | 'CREATED' | 'CLAIMED' | 'PLANNED' | 'SIGNED' | 'BROADCAST' | 'CONFIRMED' | 'FILLED'
  | 'FAILED_PRE_SEND' | 'FAILED' | 'DUPLICATE' | 'CANCELLED';
export type IncidentSeverity = 'info' | 'warning' | 'critical';
export type DiagnosticKind = 'preflight' | 'connectivity' | 'simulation' | 'readiness';
export type SubmitBackend = 'rpc' | 'jito';
export type CheckStatus = 'pass' | 'warn' | 'fail';

export const TRADE_SIDE: readonly TradeSide[];
export const DECISION_OUTCOME: readonly DecisionOutcome[];
export const INTENT_STATUS: readonly IntentStatus[];
export const INCIDENT_SEVERITY: readonly IncidentSeverity[];
export const DIAGNOSTIC_KIND: readonly DiagnosticKind[];
export const SUBMIT_BACKEND: readonly SubmitBackend[];
export const CHECK_STATUS: readonly CheckStatus[];
export const LIVE_MODEL_ENUMS: Readonly<Record<string, readonly string[]>>;

export type LiveModelEntity =
  | 'LeaderWallet' | 'LeaderTrade' | 'DetectedSignal' | 'TokenCandidate' | 'MarketSnapshot'
  | 'RouteQuote' | 'RiskBudget' | 'Decision' | 'ExecutionIntent' | 'ExecutionPlan'
  | 'SignedTransaction' | 'BroadcastAttempt' | 'Confirmation' | 'Fill' | 'Position'
  | 'ExitPlan' | 'Incident' | 'AuditEvent' | 'DiagnosticRun' | 'SimulationResult'
  | 'ConnectivityCheck';

export const LIVE_MODEL_ENTITIES: readonly LiveModelEntity[];

export interface LeaderWallet { wallet_address: string; label?: string; copy_mode?: string; strategy_brain?: string; follow_enabled: boolean; added_at?: string; }
export interface LeaderTrade { trade_id: string; leader_address: string; token_mint: string; copy_event: string; quote_mint?: string; signature?: string; slot?: number; block_time?: number; amount_usd?: number; observed_at: string; }
export interface DetectedSignal { signal_id: string; source_trade_id: string; leader_address: string; token_mint: string; copy_event: string; strategy_brain?: string; created_at: string; }
export interface TokenCandidate { token_mint: string; symbol?: string; decimals?: number; quote_mint?: string; hunt_status?: string; discovered_via?: string; created_at?: string; }
export interface MarketSnapshot { token_mint: string; price_usd?: number; liquidity_usd?: number; pool_address?: string; captured_at: string; }
export interface RouteQuote { token_mint: string; side: TradeSide; in_amount: number; out_amount: number; price_impact_pct?: number; slippage_bps?: number; route_valid: boolean; quoted_at: string; }
export interface RiskBudget { scope: string; max_notional_usd?: number; used_notional_usd?: number; remaining_usd?: number; daily_loss_usd?: number; within_budget: boolean; }
export interface Decision { decision_id: string; signal_id: string; token_mint: string; outcome: DecisionOutcome; reasons?: string[]; is_executable: boolean; created_at: string; }
export interface ExecutionIntent { intent_id: string; idempotency_key: string; decision_id?: string; intent_type: string; token_mint: string; size_usd?: number; status: IntentStatus; created_at: string; }
export interface ExecutionPlan { plan_id: string; intent_id: string; execution_mode: string; route?: object; tip_lamports?: number; compute_unit_limit?: number; created_at: string; }
export interface SignedTransaction { intent_id: string; fee_payer: string; signature?: string; signed_tx_ref?: string; signed_at?: string; }
export interface BroadcastAttempt { attempt_id: string; intent_id: string; submit_backend: SubmitBackend; signature?: string; bundle_status?: string; ok: boolean; attempted_at: string; }
export interface Confirmation { intent_id: string; signature: string; confirmed: boolean; slot?: number; error?: string; confirmed_at?: string; }
export interface Fill { fill_id: string; intent_id: string; token_mint: string; side: TradeSide; qty: number; price_usd: number; proceeds_usd?: number; fees_usd?: number; fill_source?: string; filled_at: string; }
export interface Position { position_id: string; token_mint: string; leader_address?: string; state: string; qty?: number; avg_price_usd?: number; realized_usd?: number; unrealized_usd?: number; opened_at?: string; updated_at?: string; }
export interface ExitPlan { position_id: string; reason: string; target_fraction: number; trailing_stop_pct?: number; tp1_pct?: number; created_at?: string; }
export interface Incident { incident_id: string; severity: IncidentSeverity; scope: string; reason_code: string; detail?: object; created_at: string; }
export interface AuditEvent { audit_scope: string; audit_reason: string; command_type?: string; actor_ref?: string; detail?: object; at: string; }
export interface DiagnosticRun { run_id: string; kind: DiagnosticKind; readiness?: string; checks: unknown[]; created_at: string; }
export interface SimulationResult { token_mint: string; side: TradeSide; simulated_ok: boolean; price_impact_pct?: number; error?: string; simulated_at?: string; }
export interface ConnectivityCheck { provider: string; status: CheckStatus; ok: boolean; latency_ms?: number; detail?: object; checked_at: string; }

export interface FieldRule { type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum'; required: boolean; enum: readonly string[] | null; }
export interface EntitySpec { fields: Readonly<Record<string, FieldRule>>; }
export const ENTITY_SPECS: Readonly<Record<LiveModelEntity, EntitySpec>>;

export interface DataOwnership { pkg: string; sot: string; stores: readonly string[]; }
export const DATA_OWNERSHIP: Readonly<Record<LiveModelEntity, DataOwnership>>;

export interface ValidationResult { ok: boolean; errors: string[]; }
export function validateEntity(entityName: string, obj: unknown): ValidationResult;
export function isEntity(entityName: string, obj: unknown): boolean;
export function assertEntity<T>(entityName: string, obj: T): T;
