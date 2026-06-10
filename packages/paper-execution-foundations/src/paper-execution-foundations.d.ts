// @soltrade/paper-execution-foundations — type declarations
//
// SIMULATED-ONLY / read-only PAPER EXECUTION ENGINE foundation for Stage-14
// (Phase B opener). It consumes the already-computed Stage-13 pipeline-decision
// terminal results and caller-supplied SIMULATED fill records (passed in as
// args) into (1) a paper-execution input boundary, (2) a candidate paper-fill
// DESCRIPTOR, (3) a pure FIFO PAPER P&L READ-MODEL, (4) a paper outcome
// classifier, (5) an always-suppressed suppression layer, (6) a forbidden-
// surface guard, and (7) a paper-execution health read-model. Every fill /
// result carries simulated:true (fill/P&L outputs also is_valid_on_chain:false)
// and is NEVER presented or stored as real — no Paper/Real mixing. Paper P&L is
// a backend read-model only, never UX truth. NOT execution, NOT a permission,
// NOT trading/signing/send readiness: all 24 readiness/execution flags stay
// false on every result of every state. Import-free, pure, deterministic: no
// clock, RNG, network, live stream, live quote, RPC/route call, signing,
// sending, broadcasting, persistence, secrets, or mutable module/global state.
// Every identifier here is a LOCAL function-I/O contract identifier, NOT an
// SSOT name — except the already-registered candidate FIELD names reused from
// the paper-portfolio precedent.

export interface PaperSafeFlags {
  read_only: true;
  has_secret: false;
  live_stream_enabled: false;
  network_call_made: false;
  endpoint_resolved: false;
  live_quote_enabled: false;
  signal_ready: false;
  trading_ready: false;
  risk_ready: false;
  intent_ready: false;
  routing_ready: false;
  route_ready: false;
  order_ready: false;
  transaction_ready: false;
  serialized_ready: false;
  message_bytes_ready: false;
  signer_ready: false;
  signing_permitted: false;
  broadcast_permitted: false;
  can_send: false;
  can_broadcast: false;
  can_serialize: false;
  is_live: false;
  mainnet_enabled: false;
  real_live: false;
}

export type PaperExecInputState =
  | 'PAPER_EXEC_INPUT_UNCONFIGURED'
  | 'PAPER_EXEC_INPUT_INVALID'
  | 'PAPER_EXEC_INPUT_DEGRADED'
  | 'PAPER_EXEC_INPUT_VALID';

export type CandidatePaperFillState =
  | 'CANDIDATE_PAPER_FILL_UNCONFIGURED'
  | 'CANDIDATE_PAPER_FILL_INVALID'
  | 'CANDIDATE_PAPER_FILL_REJECTED'
  | 'CANDIDATE_PAPER_FILL_DESCRIPTOR';

export type PaperPnlState =
  | 'PAPER_PNL_UNCONFIGURED' | 'PAPER_PNL_INVALID' | 'PAPER_PNL_READ_MODEL';

export type PaperOutcomeState =
  | 'PAPER_EXEC_OUTCOME_UNCONFIGURED' | 'PAPER_EXEC_OUTCOME_INVALID'
  | 'PAPER_EXEC_OUTCOME_OPEN' | 'PAPER_EXEC_OUTCOME_CLOSED_PROFIT'
  | 'PAPER_EXEC_OUTCOME_CLOSED_LOSS' | 'PAPER_EXEC_OUTCOME_CLOSED_FLAT'
  | 'PAPER_EXEC_OUTCOME_FAILED';

export type PaperSurfaceState =
  | 'PAPER_SURFACE_UNCONFIGURED' | 'PAPER_SURFACE_CLEAN' | 'PAPER_SURFACE_BLOCKED';

export type PaperExecHealthState =
  | 'PAPER_EXEC_HEALTH_UNCONFIGURED' | 'PAPER_EXEC_HEALTH_DEGRADED'
  | 'PAPER_EXEC_HEALTH_REVIEWED_ADVISORY' | 'PAPER_EXEC_HEALTH_SUPPRESSED'
  | 'PAPER_EXEC_HEALTH_BLOCKED';

export type PaperLatencyBucket = 'unknown' | 'low' | 'medium' | 'high';

export interface PaperExecutionInputBoundaryResult extends PaperSafeFlags {
  valid: boolean;
  paper_exec_input_boundary_valid: boolean;
  eligible_for_paper_execution: boolean;
  paper_exec_input_state: PaperExecInputState;
  status: PaperExecInputState;
  simulated: true;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface CandidatePaperFillResult extends PaperSafeFlags {
  valid: boolean;
  paper_fill_kind: 'candidate_paper_fill';
  paper_fill_state: CandidatePaperFillState;
  simulated: true;
  is_valid_on_chain: false;
  executed: false;
  signed: false;
  signature: null;
  position_ref: string | null;
  wallet_ref: string | null;
  side: 'buy' | 'sell' | null;
  quantity: number | null;
  price: number | null;
  fee: number | null;
  slippage: number | null;
  copy_mode_bucket: string | null;
  brain_bucket: string | null;
  latency_bucket: PaperLatencyBucket | null;
  failure_origin_bucket: string | null;
  status: CandidatePaperFillState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PaperPnlPositionEntry {
  simulated: true;
  is_valid_on_chain: false;
  position_ref: string;
  candidate_realized_pnl: number;
  candidate_fees_total: number;
  candidate_slippage_cost: number;
  paper_net_realized: number;
  open_quantity: number;
  avg_open_cost: number;
  candidate_unrealized_pnl: number | null;
  candidate_mark_status: string | null;
  unrealized_available: boolean;
  unrealized_reason: string | null;
  oversell_ignored: boolean;
}

export interface PaperPnlBucketEntry {
  simulated: true;
  candidate_paper_pnl: number;
  paper_gross_realized: number;
  candidate_fees_total: number;
  candidate_slippage_cost: number;
}

export interface PaperPnlReadModelResult extends PaperSafeFlags {
  valid: boolean;
  paper_pnl_state: PaperPnlState;
  simulated: true;
  is_valid_on_chain: false;
  fill_count: number;
  candidate_realized_pnl: number | null;
  paper_gross_realized: number | null;
  candidate_fees_total: number | null;
  candidate_slippage_cost: number | null;
  candidate_paper_pnl: number | null;
  positions: Readonly<Record<string, PaperPnlPositionEntry>>;
  candidate_pnl_by_wallet: Readonly<Record<string, PaperPnlBucketEntry>>;
  candidate_pnl_by_copy_mode: Readonly<Record<string, PaperPnlBucketEntry>>;
  candidate_pnl_by_brain: Readonly<Record<string, PaperPnlBucketEntry>>;
  status: PaperPnlState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PaperOutcomeResult extends PaperSafeFlags {
  valid: boolean;
  paper_outcome_state: PaperOutcomeState;
  simulated: true;
  is_valid_on_chain: false;
  position_ref: string | null;
  open_quantity: number | null;
  paper_gross_realized: number | null;
  paper_net_realized: number | null;
  candidate_fees_total: number | null;
  candidate_slippage_cost: number | null;
  candidate_unrealized_pnl: number | null;
  candidate_mark_status: string | null;
  failure_detected: boolean;
  status: PaperOutcomeState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PaperExecutionSuppressionResult extends PaperSafeFlags {
  suppressed: true;
  not_execution_authorized: true;
  not_sign_authorized: true;
  not_send_authorized: true;
  simulated: true;
  suppression_reasons: ReadonlyArray<string>;
  status: 'PAPER_EXEC_SUPPRESSED';
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PaperForbiddenSurfaceResult extends PaperSafeFlags {
  paper_surface_state: PaperSurfaceState;
  key_material_detected: boolean;
  live_surface_detected: boolean;
  forbidden_field_detected: boolean;
  forbidden_field_ref: string | null;
  simulated: true;
  status: PaperSurfaceState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export interface PaperExecutionHealthResult extends PaperSafeFlags {
  valid: boolean;
  paper_exec_health_state: PaperExecHealthState;
  simulated: true;
  status: PaperExecHealthState;
  reasons: ReadonlyArray<string>;
  advisory_only: true;
}

export function describePaperExecutionInputBoundaryContract(): Readonly<Record<string, unknown>>;
export function evaluatePaperExecutionInputBoundary(input: unknown): PaperExecutionInputBoundaryResult;

export function describeCandidatePaperFillContract(): Readonly<Record<string, unknown>>;
export function evaluateCandidatePaperFill(input: unknown): CandidatePaperFillResult;

export function describePaperPnlReadModelContract(): Readonly<Record<string, unknown>>;
export function evaluatePaperPnlReadModel(input: unknown): PaperPnlReadModelResult;

export function describePaperOutcomeContract(): Readonly<Record<string, unknown>>;
export function evaluatePaperOutcome(input: unknown): PaperOutcomeResult;

export function describePaperExecutionSuppressionContract(): Readonly<Record<string, unknown>>;
export function evaluatePaperExecutionSuppression(input: unknown): PaperExecutionSuppressionResult;

export function describePaperForbiddenSurfaceContract(): Readonly<Record<string, unknown>>;
export function evaluatePaperForbiddenSurface(input: unknown): PaperForbiddenSurfaceResult;

export function describePaperExecutionHealthContract(): Readonly<Record<string, unknown>>;
export function evaluatePaperExecutionHealth(inputs: unknown): PaperExecutionHealthResult;
