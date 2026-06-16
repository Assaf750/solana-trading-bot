// @soltrade/contracts — Live-First data-model contracts (ADR-0001).
// The 21 runtime entities of the Live-First Runtime Unification, expressed as
// runtime-checkable shape specs + operational enums + a data-ownership map.
// Trading vocabulary (copy_event, intent_type, position_state, ...) is REUSED from
// @soltrade/ssot-types — no name is invented before SSOT. The enums declared here are
// LIVE-FIRST OPERATIONAL states (runtime lifecycle already exercised in apps/server),
// scoped to this module and clearly labeled.
import {
  COPY_EVENT, QUOTE_MINT, STRATEGY_BRAIN, COPY_MODE, HUNT_STATUS,
  INTENT_TYPE, EXECUTION_MODE, BUNDLE_STATUS, POSITION_STATE, VALIDATION_STATUS,
} from '../../ssot-types/src/core-enums.mjs';

const f = Object.freeze;

// --- Live-first operational enums (ADR-0001; runtime lifecycle, not SSOT trading names) ---
export const TRADE_SIDE = f(['buy', 'sell']);
export const DECISION_OUTCOME = f(['accept', 'reject', 'warn']);
export const INTENT_STATUS = f([
  'CREATED', 'CLAIMED', 'PLANNED', 'SIGNED', 'BROADCAST', 'CONFIRMED', 'FILLED',
  'FAILED_PRE_SEND', 'FAILED', 'DUPLICATE', 'CANCELLED',
]);
export const INCIDENT_SEVERITY = f(['info', 'warning', 'critical']);
export const DIAGNOSTIC_KIND = f(['preflight', 'connectivity', 'simulation', 'readiness']);
export const SUBMIT_BACKEND = f(['rpc', 'jito']);
export const CHECK_STATUS = f(['pass', 'warn', 'fail']);

export const LIVE_MODEL_ENUMS = f({
  trade_side: TRADE_SIDE,
  decision_outcome: DECISION_OUTCOME,
  intent_status: INTENT_STATUS,
  incident_severity: INCIDENT_SEVERITY,
  diagnostic_kind: DIAGNOSTIC_KIND,
  submit_backend: SUBMIT_BACKEND,
  check_status: CHECK_STATUS,
});

// --- The 21 Live-First entities (canonical names, ADR-0001 §8) ---
export const LIVE_MODEL_ENTITIES = f([
  'LeaderWallet', 'LeaderTrade', 'DetectedSignal', 'TokenCandidate', 'MarketSnapshot',
  'RouteQuote', 'RiskBudget', 'Decision', 'ExecutionIntent', 'ExecutionPlan',
  'SignedTransaction', 'BroadcastAttempt', 'Confirmation', 'Fill', 'Position',
  'ExitPlan', 'Incident', 'AuditEvent', 'DiagnosticRun', 'SimulationResult',
  'ConnectivityCheck',
]);

// helper: one field rule
const F = (type, opts = {}) => f({ type, required: !!opts.required, enum: opts.enum || null });

// --- Entity shape specs (required + typed + enum-constrained fields) ---
export const ENTITY_SPECS = f({
  LeaderWallet: f({ fields: f({
    wallet_address: F('string', { required: true }),
    label: F('string'),
    copy_mode: F('enum', { enum: COPY_MODE }),
    strategy_brain: F('enum', { enum: STRATEGY_BRAIN }),
    follow_enabled: F('boolean', { required: true }),
    added_at: F('string'),
  }) }),
  LeaderTrade: f({ fields: f({
    trade_id: F('string', { required: true }),
    leader_address: F('string', { required: true }),
    token_mint: F('string', { required: true }),
    copy_event: F('enum', { enum: COPY_EVENT, required: true }),
    quote_mint: F('enum', { enum: QUOTE_MINT }),
    signature: F('string'),
    slot: F('number'),
    block_time: F('number'),
    amount_usd: F('number'),
    observed_at: F('string', { required: true }),
  }) }),
  DetectedSignal: f({ fields: f({
    signal_id: F('string', { required: true }),
    source_trade_id: F('string', { required: true }),
    leader_address: F('string', { required: true }),
    token_mint: F('string', { required: true }),
    copy_event: F('enum', { enum: COPY_EVENT, required: true }),
    strategy_brain: F('enum', { enum: STRATEGY_BRAIN }),
    created_at: F('string', { required: true }),
  }) }),
  TokenCandidate: f({ fields: f({
    token_mint: F('string', { required: true }),
    symbol: F('string'),
    decimals: F('number'),
    quote_mint: F('enum', { enum: QUOTE_MINT }),
    hunt_status: F('enum', { enum: HUNT_STATUS }),
    discovered_via: F('string'),
    created_at: F('string'),
  }) }),
  MarketSnapshot: f({ fields: f({
    token_mint: F('string', { required: true }),
    price_usd: F('number'),
    liquidity_usd: F('number'),
    pool_address: F('string'),
    captured_at: F('string', { required: true }),
  }) }),
  RouteQuote: f({ fields: f({
    token_mint: F('string', { required: true }),
    side: F('enum', { enum: TRADE_SIDE, required: true }),
    in_amount: F('number', { required: true }),
    out_amount: F('number', { required: true }),
    price_impact_pct: F('number'),
    slippage_bps: F('number'),
    route_valid: F('boolean', { required: true }),
    quoted_at: F('string', { required: true }),
  }) }),
  RiskBudget: f({ fields: f({
    scope: F('string', { required: true }),
    max_notional_usd: F('number'),
    used_notional_usd: F('number'),
    remaining_usd: F('number'),
    daily_loss_usd: F('number'),
    within_budget: F('boolean', { required: true }),
  }) }),
  Decision: f({ fields: f({
    decision_id: F('string', { required: true }),
    signal_id: F('string', { required: true }),
    token_mint: F('string', { required: true }),
    outcome: F('enum', { enum: DECISION_OUTCOME, required: true }),
    reasons: F('array'),
    is_executable: F('boolean', { required: true }),
    created_at: F('string', { required: true }),
  }) }),
  ExecutionIntent: f({ fields: f({
    intent_id: F('string', { required: true }),
    idempotency_key: F('string', { required: true }),
    decision_id: F('string'),
    intent_type: F('enum', { enum: INTENT_TYPE, required: true }),
    token_mint: F('string', { required: true }),
    size_usd: F('number'),
    status: F('enum', { enum: INTENT_STATUS, required: true }),
    created_at: F('string', { required: true }),
  }) }),
  ExecutionPlan: f({ fields: f({
    plan_id: F('string', { required: true }),
    intent_id: F('string', { required: true }),
    execution_mode: F('enum', { enum: EXECUTION_MODE, required: true }),
    route: F('object'),
    tip_lamports: F('number'),
    compute_unit_limit: F('number'),
    created_at: F('string', { required: true }),
  }) }),
  SignedTransaction: f({ fields: f({
    intent_id: F('string', { required: true }),
    fee_payer: F('string', { required: true }),
    signature: F('string'),
    signed_tx_ref: F('string'),
    signed_at: F('string'),
  }) }),
  BroadcastAttempt: f({ fields: f({
    attempt_id: F('string', { required: true }),
    intent_id: F('string', { required: true }),
    submit_backend: F('enum', { enum: SUBMIT_BACKEND, required: true }),
    signature: F('string'),
    bundle_status: F('enum', { enum: BUNDLE_STATUS }),
    ok: F('boolean', { required: true }),
    attempted_at: F('string', { required: true }),
  }) }),
  Confirmation: f({ fields: f({
    intent_id: F('string', { required: true }),
    signature: F('string', { required: true }),
    confirmed: F('boolean', { required: true }),
    slot: F('number'),
    error: F('string'),
    confirmed_at: F('string'),
  }) }),
  Fill: f({ fields: f({
    fill_id: F('string', { required: true }),
    intent_id: F('string', { required: true }),
    token_mint: F('string', { required: true }),
    side: F('enum', { enum: TRADE_SIDE, required: true }),
    qty: F('number', { required: true }),
    price_usd: F('number', { required: true }),
    proceeds_usd: F('number'),
    fees_usd: F('number'),
    fill_source: F('string'),
    filled_at: F('string', { required: true }),
  }) }),
  Position: f({ fields: f({
    position_id: F('string', { required: true }),
    token_mint: F('string', { required: true }),
    leader_address: F('string'),
    state: F('enum', { enum: POSITION_STATE, required: true }),
    qty: F('number'),
    avg_price_usd: F('number'),
    realized_usd: F('number'),
    unrealized_usd: F('number'),
    opened_at: F('string'),
    updated_at: F('string'),
  }) }),
  ExitPlan: f({ fields: f({
    position_id: F('string', { required: true }),
    reason: F('string', { required: true }),
    target_fraction: F('number', { required: true }),
    trailing_stop_pct: F('number'),
    tp1_pct: F('number'),
    created_at: F('string'),
  }) }),
  Incident: f({ fields: f({
    incident_id: F('string', { required: true }),
    severity: F('enum', { enum: INCIDENT_SEVERITY, required: true }),
    scope: F('string', { required: true }),
    reason_code: F('string', { required: true }),
    detail: F('object'),
    created_at: F('string', { required: true }),
  }) }),
  AuditEvent: f({ fields: f({
    audit_scope: F('string', { required: true }),
    audit_reason: F('string', { required: true }),
    command_type: F('string'),
    actor_ref: F('string'),
    detail: F('object'),
    at: F('string', { required: true }),
  }) }),
  DiagnosticRun: f({ fields: f({
    run_id: F('string', { required: true }),
    kind: F('enum', { enum: DIAGNOSTIC_KIND, required: true }),
    readiness: F('enum', { enum: VALIDATION_STATUS }),
    checks: F('array', { required: true }),
    created_at: F('string', { required: true }),
  }) }),
  SimulationResult: f({ fields: f({
    token_mint: F('string', { required: true }),
    side: F('enum', { enum: TRADE_SIDE, required: true }),
    simulated_ok: F('boolean', { required: true }),
    price_impact_pct: F('number'),
    error: F('string'),
    simulated_at: F('string'),
  }) }),
  ConnectivityCheck: f({ fields: f({
    provider: F('string', { required: true }),
    status: F('enum', { enum: CHECK_STATUS, required: true }),
    ok: F('boolean', { required: true }),
    latency_ms: F('number'),
    detail: F('object'),
    checked_at: F('string', { required: true }),
  }) }),
});

// --- Data ownership map (ADR-0001 §8): entity -> owning package + source-of-truth store ---
export const DATA_OWNERSHIP = f({
  LeaderWallet: f({ pkg: 'wallet-intelligence', sot: 'postgres', stores: f(['postgres', 'redis']) }),
  LeaderTrade: f({ pkg: 'ingestion', sot: 'clickhouse', stores: f(['clickhouse', 'redis']) }),
  DetectedSignal: f({ pkg: 'trading-engine', sot: 'clickhouse', stores: f(['clickhouse']) }),
  TokenCandidate: f({ pkg: 'token-safety', sot: 'redis', stores: f(['redis', 'clickhouse']) }),
  MarketSnapshot: f({ pkg: 'provider-adapters', sot: 'clickhouse', stores: f(['clickhouse', 'redis']) }),
  RouteQuote: f({ pkg: 'provider-adapters', sot: 'redis', stores: f(['redis']) }),
  RiskBudget: f({ pkg: 'risk', sot: 'redis', stores: f(['redis', 'postgres']) }),
  Decision: f({ pkg: 'trading-engine', sot: 'postgres', stores: f(['postgres', 'clickhouse']) }),
  ExecutionIntent: f({ pkg: 'decision-ledger', sot: 'postgres', stores: f(['postgres', 'redis']) }),
  ExecutionPlan: f({ pkg: 'execution', sot: 'postgres', stores: f(['postgres']) }),
  SignedTransaction: f({ pkg: 'execution', sot: 'ephemeral', stores: f(['ephemeral', 'postgres']) }),
  BroadcastAttempt: f({ pkg: 'execution', sot: 'postgres', stores: f(['postgres', 'clickhouse']) }),
  Confirmation: f({ pkg: 'execution', sot: 'postgres', stores: f(['postgres', 'clickhouse']) }),
  Fill: f({ pkg: 'execution', sot: 'postgres', stores: f(['postgres', 'clickhouse']) }),
  Position: f({ pkg: 'positions', sot: 'postgres', stores: f(['postgres', 'redis']) }),
  ExitPlan: f({ pkg: 'positions', sot: 'postgres', stores: f(['postgres', 'redis']) }),
  Incident: f({ pkg: 'safety', sot: 'postgres', stores: f(['postgres', 'clickhouse']) }),
  AuditEvent: f({ pkg: 'audit', sot: 'postgres', stores: f(['postgres', 'clickhouse']) }),
  DiagnosticRun: f({ pkg: 'execution', sot: 'clickhouse', stores: f(['clickhouse', 'json']) }),
  SimulationResult: f({ pkg: 'execution', sot: 'clickhouse', stores: f(['clickhouse']) }),
  ConnectivityCheck: f({ pkg: 'provider-adapters', sot: 'redis', stores: f(['redis', 'clickhouse']) }),
});

function isType(type, v) {
  switch (type) {
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'enum': return true; // membership checked via rule.enum
    default: return true;
  }
}

// Validate an object against a Live-First entity spec. Pure; never throws.
// Returns { ok:boolean, errors:string[] }.
export function validateEntity(entityName, obj) {
  const spec = ENTITY_SPECS[entityName];
  if (!spec) return { ok: false, errors: [`unknown_entity:${entityName}`] };
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['not_an_object'] };
  }
  const errors = [];
  for (const [field, rule] of Object.entries(spec.fields)) {
    const has = Object.prototype.hasOwnProperty.call(obj, field) && obj[field] !== undefined && obj[field] !== null;
    if (!has) {
      if (rule.required) errors.push(`missing:${field}`);
      continue;
    }
    const val = obj[field];
    if (rule.enum && !rule.enum.includes(val)) errors.push(`enum:${field}`);
    else if (!isType(rule.type, val)) errors.push(`type:${field}`);
  }
  return { ok: errors.length === 0, errors };
}

export function isEntity(entityName, obj) {
  return validateEntity(entityName, obj).ok;
}

// Strict variant: throws on invalid (use at trust boundaries).
export function assertEntity(entityName, obj) {
  const r = validateEntity(entityName, obj);
  if (!r.ok) throw new Error(`invalid ${entityName}: ${r.errors.join(', ')}`);
  return obj;
}
