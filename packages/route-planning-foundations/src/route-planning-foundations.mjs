// @soltrade/route-planning-foundations
//
// Read-only / advisory ONLY ROUTE-PLANNING FOUNDATION for Stage-9 of the
// architecture pipeline `data -> signal -> risk -> intent -> route -> sign ->
// send`. This package builds ONLY the read-only/advisory 'route' foundation,
// consuming Stage-8 intent-ledger outputs. Import-free, pure, deterministic. No
// network primitive, no live stream, no live quote, no aggregator/Jupiter/RPC
// route call, no transaction build, no order, no signing, no send, no system
// clock, no persistence, no secrets, no mutable module/global state.
//
// THE CORE RULE: a candidate route plan is a READ-ONLY ADVISORY REPRESENTATION
// ONLY — NOT an order, NOT a transaction, NOT a signing permission, NOT a send
// permission, NOT trading/transaction readiness. route_ready / order_ready /
// transaction_ready / signing_permitted / can_send / live_quote_enabled ALL STAY
// false on every result — a candidate route review NEVER flips any
// readiness/execution/live-quote flag. "Route reviewed / source valid /
// candidate route exists" is carried ONLY by dedicated fields
// (route_input_boundary_valid / eligible_for_route_review / route_source_valid /
// candidate_route_valid / candidate_route_state), never by a readiness flag.
// Hostile, throwing, or uninspectable input returns a FROZEN refusal with reason
// 'input_inspection_error' and NEVER throws. Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package does NOT use SSOT route vocabulary
// (active_exit_route, execution_mode=jupiter_route) as new SSOT names; the source
// tags jupiter_disabled/aggregator_disabled are LOCAL disabled markers (NOT the
// SSOT execution mode). This package adds NO name to docs/01-SSOT.md.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function routeSafeFlags() {
  return {
    read_only: true,
    has_secret: false,
    live_stream_enabled: false,
    network_call_made: false,
    endpoint_resolved: false,
    live_quote_enabled: false,
    signal_ready: false,
    trading_ready: false,
    risk_ready: false,
    intent_ready: false,
    routing_ready: false,
    route_ready: false,
    order_ready: false,
    transaction_ready: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    signing_permitted: false,
    broadcast_permitted: false,
    is_live: false,
    mainnet_enabled: false,
    real_live: false
  };
}

// the 21 non-read_only flags above (includes live_quote_enabled) — none may EVER
// be true on input or output; a candidate route review NEVER flips any.
const ROUTE_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'can_send', 'can_broadcast', 'can_serialize',
  'signing_permitted', 'broadcast_permitted', 'is_live', 'mainnet_enabled',
  'real_live'
]);

const ROUTE_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'order', 'place_order', 'build_tx', 'serialize_tx', 'quote', 'get_quote',
  'jupiter_route', 'aggregator_quote', 'swap_instruction',
  'compute_budget_instruction', 'open_position', 'close_position',
  'route_execute'
]);

const ROUTE_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential/i;
const ROUTE_URL_RE = /https?:\/\/|wss?:\/\//i;
const ROUTE_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan (their values are
// still scanned for URL/secret/mainnet substrings). NOTE: a bare 'token' SECRET
// key is still flagged by value.
const ROUTE_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'intent_record_ref', 'route_plan_ref', 'preview_ref',
  'input_asset_ref', 'output_asset_ref', 'source_ref', 'wallet_ref', 'token_ref',
  'route_source', 'liquidity_bucket', 'estimated_slippage_bucket',
  'route_quality_bucket', 'route_hop_count_bucket', 'hop_count_bucket'
]);

function routeHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of ROUTE_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function routeHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (ROUTE_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function routeHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (ROUTE_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (ROUTE_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function routeHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (ROUTE_URL_RE.test(v) || ROUTE_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function routeScreen(o) {
  const r = [];
  if (routeHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (routeHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (routeHasSecretField(o)) r.push('secret_field_blocked');
  if (routeHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function routeUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Stage-8 intent-output recognizers. Route input comes ONLY from Stage-8 intent
// outputs, each of which carries read_only:true. Raw Stage-7 risk / Stage-6
// signal / Stage-5 intelligence / Stage-4 ingestion objects are REFUSED.
// ---------------------------------------------------------------------------

const ROUTE_INTENT_INPUT_STATES = Object.freeze([
  'INTENT_INPUT_UNCONFIGURED', 'INTENT_INPUT_INVALID',
  'INTENT_INPUT_DEGRADED', 'INTENT_INPUT_VALID'
]);
const ROUTE_CANDIDATE_INTENT_STATES = Object.freeze([
  'CANDIDATE_INTENT_UNCONFIGURED', 'CANDIDATE_INTENT_INVALID',
  'CANDIDATE_INTENT_REJECTED', 'CANDIDATE_INTENT_RECORDED'
]);
const ROUTE_INTENT_LEDGER_STATES = Object.freeze([
  'INTENT_LEDGER_UNCONFIGURED', 'INTENT_LEDGER_INVALID',
  'INTENT_LEDGER_DUPLICATE', 'INTENT_LEDGER_APPEND_EVALUATED'
]);
const ROUTE_INTENT_STATE_MACHINE_STATES = Object.freeze([
  'INTENT_UNCONFIGURED', 'INTENT_CANDIDATE_RECORDED', 'INTENT_REJECTED',
  'INTENT_SUPPRESSED', 'INTENT_BLOCKED', 'INTENT_AWAITING_ROUTE_REVIEW'
]);
const ROUTE_INTENT_AUDIT_STATES = Object.freeze([
  'INTENT_AUDIT_UNCONFIGURED', 'INTENT_AUDIT_INVALID', 'INTENT_AUDIT_VALID'
]);
const ROUTE_INTENT_HEALTH_STATES = Object.freeze([
  'INTENT_HEALTH_UNCONFIGURED', 'INTENT_HEALTH_DEGRADED',
  'INTENT_HEALTH_CANDIDATE_RECORDED', 'INTENT_HEALTH_AWAITING_ROUTE_REVIEW',
  'INTENT_HEALTH_SUPPRESSED', 'INTENT_HEALTH_BLOCKED'
]);

// Stage-7 risk state fields — an object carrying one of these (and no intent
// state) is a raw risk output, NOT a Stage-8 intent output -> refuse.
const ROUTE_RISK_STATE_FIELDS = Object.freeze([
  'risk_input_state', 'hard_risk_state', 'liquidity_exit_state',
  'exposure_risk_state', 'risk_verdict_state', 'risk_health_state'
]);

// Stage-6 signal state fields — raw signal -> refuse.
const ROUTE_SIGNAL_STATE_FIELDS = Object.freeze([
  'signal_input_state', 'candidate_signal_state', 'signal_score_state',
  'signal_suppression_state', 'signal_state'
]);

// Stage-5 intelligence state fields — raw intelligence -> refuse.
const ROUTE_INTELLIGENCE_STATE_FIELDS = Object.freeze([
  'wallet_observation_state', 'token_observation_state', 'relationship_state',
  'diagnostics_state', 'intelligence_state'
]);

// Stage-4 raw ingestion event types — raw events -> refuse.
const ROUTE_RAW_INGESTION_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed', 'token_account_change_observed',
  'swap_observed', 'mint_observed', 'pool_observed', 'balance_change_observed'
]);

// Does an object carry ANY recognized Stage-8 intent-layer state field?
function routeIntentComponentState(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (typeof o.intent_input_state === 'string' && ROUTE_INTENT_INPUT_STATES.includes(o.intent_input_state)) return o.intent_input_state;
  if (typeof o.candidate_intent_state === 'string' && ROUTE_CANDIDATE_INTENT_STATES.includes(o.candidate_intent_state)) return o.candidate_intent_state;
  if (typeof o.ledger_state === 'string' && ROUTE_INTENT_LEDGER_STATES.includes(o.ledger_state)) return o.ledger_state;
  if (typeof o.intent_state === 'string' && ROUTE_INTENT_STATE_MACHINE_STATES.includes(o.intent_state)) return o.intent_state;
  if (typeof o.audit_state === 'string' && ROUTE_INTENT_AUDIT_STATES.includes(o.audit_state)) return o.audit_state;
  if (typeof o.intent_health_state === 'string' && ROUTE_INTENT_HEALTH_STATES.includes(o.intent_health_state)) return o.intent_health_state;
  // intent suppression carries suppressed + suppression_reasons (no dedicated *_state enum)
  if (typeof o.suppressed === 'boolean' && Array.isArray(o.suppression_reasons)) return 'INTENT_SUPPRESSION_RESULT';
  return null;
}

function routeHasIntentLayerState(o) {
  return routeIntentComponentState(o) !== null;
}

// Is the object a raw Stage-7 risk output (risk state, NO intent state)?
function routeIsRawRisk(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (routeHasIntentLayerState(o)) return false;
  for (const f of ROUTE_RISK_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object a raw Stage-6 signal output (signal state, NO intent state)?
function routeIsRawSignal(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (routeHasIntentLayerState(o)) return false;
  for (const f of ROUTE_SIGNAL_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object raw Stage-5 intelligence (intelligence state, NO intent state)?
function routeIsRawIntelligence(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (routeHasIntentLayerState(o)) return false;
  for (const f of ROUTE_INTELLIGENCE_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object a raw Stage-4 ingestion event (event_type, NO intent state)?
function routeIsRawIngestionEvent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (routeHasIntentLayerState(o)) return false;
  const et = o.event_type;
  return typeof et === 'string' && ROUTE_RAW_INGESTION_EVENT_TYPES.includes(et);
}

function routeIsRawNonIntentInput(o) {
  return routeIsRawRisk(o) || routeIsRawSignal(o) || routeIsRawIntelligence(o) || routeIsRawIngestionEvent(o);
}

// Recognize a Stage-8 intent RESULT component: an inspectable read-only object
// that carries a valid intent-layer state and is NOT raw risk/signal/
// intelligence/event. Returns the recognized intent-layer state string, or null.
function routeRecognizeIntentComponent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (routeIsRawNonIntentInput(o)) return null;
  if (o.read_only !== true) return null;
  return routeIntentComponentState(o);
}

// Screen a Stage-8 RESULT object passed in a component slot: forbidden trading
// flag, execution-command KEY, raw risk/signal/intelligence/event, endpoint/
// mainnet by string VALUE. The secret-NAME scan is NOT run here because
// legitimate intent state fields contain the substring 'token'; results spread
// only fixed literals/allowlisted tokens, so a bare secret value is never echoed.
function routeScreenComponentResult(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (routeHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (routeHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (routeHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (routeIsRawNonIntentInput(c)) r.push('raw_non_intent_input_refused');
  return r;
}

// Recognize a Stage-9 (C) route-input-boundary VALID result fed forward.
function routeRecognizeInputBoundaryResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.route_input_state === 'string' && ROUTE_INPUT_STATES.includes(o.route_input_state)) {
    return o.route_input_state;
  }
  return null;
}

// Recognize a Stage-9 (D) route-source-boundary result fed forward.
function routeRecognizeSourceBoundaryResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.route_source_state === 'string' && ROUTE_SOURCE_STATES.includes(o.route_source_state)) {
    return o.route_source_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (C) ROUTE INPUT BOUNDARY
//
// Verifies that route input comes ONLY from Stage-8 intent-ledger outputs, never
// from raw risk / signal / intelligence / commands. A VALID boundary opens NO
// route/order/transaction/trading readiness; eligible_for_route_review marks the
// input shape only, and is NOT an order/route/intent/sign/send permission. The
// intent must be AWAITING ROUTE REVIEW (intent_state INTENT_AWAITING_ROUTE_REVIEW
// + intent_health INTENT_HEALTH_AWAITING_ROUTE_REVIEW + not suppressed + audit
// valid) to be eligible; anything else -> DEGRADED/UNCONFIGURED/INVALID.
// ---------------------------------------------------------------------------

const ROUTE_INPUT_STATES = Object.freeze([
  'ROUTE_INPUT_UNCONFIGURED', 'ROUTE_INPUT_INVALID',
  'ROUTE_INPUT_DEGRADED', 'ROUTE_INPUT_VALID'
]);

const ROUTE_INPUT_COMPONENTS = Object.freeze([
  'intent_input_boundary', 'candidate_intent_record', 'intent_ledger_append',
  'intent_state', 'intent_audit', 'intent_suppression', 'intent_health'
]);

export function describeRouteInputBoundaryContract() {
  return Object.freeze({
    contract: 'route-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: ROUTE_INPUT_STATES,
    advisory_only: true,
    route_input_state: 'ROUTE_INPUT_UNCONFIGURED',
    route_input_boundary_valid: false,
    eligible_for_route_review: false,
    status: 'ROUTE_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...routeSafeFlags(),
    note: 'Read-only route-input boundary. Verifies route input comes ONLY from Stage-8 intent-ledger outputs (intent input boundary, candidate intent record, intent ledger append, intent state machine, intent audit envelope, intent suppression, intent health), never from raw Stage-7 risk, Stage-6 signals, Stage-5 intelligence, Stage-4 ingestion events, endpoints, or execution commands. A VALID boundary opens NO route/order/transaction/trading readiness; eligible_for_route_review marks the input shape only, and is NOT an order, route, transaction, intent, signing or send permission. The intent must be AWAITING ROUTE REVIEW (intent_state INTENT_AWAITING_ROUTE_REVIEW + intent_health INTENT_HEALTH_AWAITING_ROUTE_REVIEW + not suppressed + audit INTENT_AUDIT_VALID) to be eligible; intent not awaiting route review or suppressed -> ROUTE_INPUT_DEGRADED (NOT eligible); intent_health INTENT_HEALTH_BLOCKED or any component *_INVALID or audit not valid -> ROUTE_INPUT_INVALID. Raw risk/signal/intelligence/event objects, smuggled trading/route/order/transaction/sign/send/live-quote flags or commands, secrets, endpoints, and mainnet/REAL-LIVE markers are refused (raw_non_intent_input_refused / *_blocked) and never echoed. route_ready / order_ready / transaction_ready / signing_permitted / can_send / live_quote_enabled STAY false in EVERY state.'
  });
}

export function validateRouteInputBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (routeUninspectable(obj, ['purpose', ...ROUTE_INPUT_COMPONENTS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...routeSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_route_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!ROUTE_INPUT_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...routeScreen(shallow));
      for (const k of ROUTE_INPUT_COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (routeHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (routeHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (routeIsRawNonIntentInput(c)) reasons.push('raw_non_intent_input_refused');
      }
      if (obj.purpose !== 'route_input_boundary') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...routeSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...routeSafeFlags()
    });
  }
}

export function evaluateRouteInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'ROUTE_INPUT_INVALID'),
    route_input_boundary_valid: (state === 'ROUTE_INPUT_VALID'),
    eligible_for_route_review: (state === 'ROUTE_INPUT_VALID'),
    route_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...routeSafeFlags()
  });
  try {
    const v = validateRouteInputBoundary(input);
    // unrecognized / hostile -> UNCONFIGURED
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('ROUTE_INPUT_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_route_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / raw input / bad purpose -> INVALID
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_non_intent_input_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('ROUTE_INPUT_INVALID', v.reasons);
    }

    const slots = [
      ['intent_input_boundary', input.intent_input_boundary],
      ['candidate_intent_record', input.candidate_intent_record],
      ['intent_ledger_append', input.intent_ledger_append],
      ['intent_state', input.intent_state],
      ['intent_audit', input.intent_audit],
      ['intent_suppression', input.intent_suppression],
      ['intent_health', input.intent_health]
    ];

    // each PRESENT component must be a recognized read-only Stage-8 intent result;
    // an unrecognized component (or one blocked by the component screen) is not a
    // Stage-8 intent output -> refuse.
    let anyComponentInvalid = false;
    for (const [, c] of slots) {
      if (c == null) continue;
      if (routeScreenComponentResult(c).length > 0) {
        return build('ROUTE_INPUT_INVALID', ['raw_non_intent_input_refused']);
      }
      const s = routeRecognizeIntentComponent(c);
      if (s === null) {
        return build('ROUTE_INPUT_INVALID', ['component_not_stage8_intent']);
      }
      if (s === 'INTENT_INPUT_INVALID' || s === 'CANDIDATE_INTENT_INVALID' ||
          s === 'INTENT_LEDGER_INVALID' || s === 'INTENT_AUDIT_INVALID') {
        anyComponentInvalid = true;
      }
    }

    const stateMachine = input.intent_state;
    const audit = input.intent_audit;
    const health = input.intent_health;
    const suppression = input.intent_suppression;

    const intentState = (stateMachine != null) ? routeRecognizeIntentComponent(stateMachine) : null;
    const auditState = (audit != null) ? routeRecognizeIntentComponent(audit) : null;
    const healthState = (health != null) ? routeRecognizeIntentComponent(health) : null;

    // intent_health BLOCKED OR any component *_INVALID OR audit not VALID -> INVALID
    if (healthState === 'INTENT_HEALTH_BLOCKED' || anyComponentInvalid ||
        (auditState !== null && auditState !== 'INTENT_AUDIT_VALID')) {
      return build('ROUTE_INPUT_INVALID', ['intent_component_invalid']);
    }

    // required minimum components: intent_state + intent_health
    if (intentState === null || healthState === null) {
      return build('ROUTE_INPUT_UNCONFIGURED', ['required_component_missing']);
    }
    // audit is required and must be VALID for eligibility
    if (auditState === null) {
      return build('ROUTE_INPUT_UNCONFIGURED', ['required_component_missing']);
    }

    const suppressed = (suppression != null && typeof suppression === 'object' && !Array.isArray(suppression))
      ? suppression.suppressed === true : false;

    // intent NOT awaiting route review OR suppressed -> DEGRADED (not eligible, fail-closed)
    if (intentState !== 'INTENT_AWAITING_ROUTE_REVIEW' ||
        healthState !== 'INTENT_HEALTH_AWAITING_ROUTE_REVIEW' ||
        suppressed === true) {
      const degraded = [];
      if (intentState !== 'INTENT_AWAITING_ROUTE_REVIEW') degraded.push('intent_not_awaiting_route_review');
      if (healthState !== 'INTENT_HEALTH_AWAITING_ROUTE_REVIEW') degraded.push('intent_health_not_awaiting_route_review');
      if (suppressed === true) degraded.push('intent_suppressed');
      return build('ROUTE_INPUT_DEGRADED', degraded.length ? degraded : ['intent_not_awaiting_route_review']);
    }

    // intent awaiting route review + health awaiting + not suppressed + audit valid
    // + all present components recognized read-only -> VALID (eligible)
    return build('ROUTE_INPUT_VALID', []);
  } catch {
    return build('ROUTE_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (D) ROUTE SOURCE / PROVIDER BOUNDARY
//
// The route source is a DISABLED / read-only descriptor TAG only — no endpoint,
// no SDK, no live call. jupiter_disabled / aggregator_disabled are accepted ONLY
// as disabled/read-only markers; they NEVER enable Jupiter/aggregator/live quote.
// Endpoint URL / api_key / secret / token / smuggled live_quote/network/route-
// execution flag / mainnet/REAL-LIVE -> INVALID and never echoed.
// ---------------------------------------------------------------------------

const ROUTE_SOURCE_STATES = Object.freeze([
  'ROUTE_SOURCE_UNCONFIGURED', 'ROUTE_SOURCE_INVALID', 'ROUTE_SOURCE_READ_ONLY_OK'
]);

const ROUTE_SOURCE_ALLOWED_TAGS = Object.freeze([
  'mock_route_metadata', 'fixture_route_metadata', 'jupiter_disabled',
  'aggregator_disabled', 'manual_route_review_disabled'
]);

const ROUTE_SOURCE_TOP_KEYS = Object.freeze(['purpose', 'route_source']);

export function describeRouteSourceBoundaryContract() {
  return Object.freeze({
    contract: 'route-source-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: ROUTE_SOURCE_STATES,
    supported_source_tags: ROUTE_SOURCE_ALLOWED_TAGS,
    advisory_only: true,
    route_source_valid: false,
    route_source_state: 'ROUTE_SOURCE_UNCONFIGURED',
    provider_disabled: true,
    status: 'ROUTE_SOURCE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...routeSafeFlags(),
    note: 'Read-only route SOURCE / PROVIDER boundary. The route source is a DISABLED / read-only descriptor TAG only (mock_route_metadata, fixture_route_metadata, jupiter_disabled, aggregator_disabled, manual_route_review_disabled) — NO endpoint, NO SDK, NO live call, NO live quote, NO aggregator/Jupiter/RPC route call. jupiter_disabled / aggregator_disabled are accepted ONLY as disabled/read-only markers; they NEVER enable Jupiter/aggregator/live quote — live_quote_enabled / network_call_made / endpoint_resolved STAY false and provider_disabled STAYS true. Fail-Safe-Not-Fail-Open: missing source -> ROUTE_SOURCE_UNCONFIGURED; unknown source tag -> ROUTE_SOURCE_INVALID; an endpoint URL field / api_key / secret / token / smuggled live_quote/network/route-execution flag / mainnet / REAL-LIVE -> ROUTE_SOURCE_INVALID and NEVER echoed; a valid disabled/read-only tag -> ROUTE_SOURCE_READ_ONLY_OK. Opens NO route/order/transaction/trading readiness.'
  });
}

export function validateRouteSourceBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (routeUninspectable(obj, [...ROUTE_SOURCE_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...routeSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_route_source_input');
    } else {
      recognized = true;
      reasons.push(...routeScreen(obj));
      if (obj.purpose !== 'route_source_boundary') reasons.push('purpose_invalid');
      const tag = obj.route_source;
      if (tag == null) {
        reasons.push('route_source_missing');
      } else if (typeof tag !== 'string' || !ROUTE_SOURCE_ALLOWED_TAGS.includes(tag)) {
        reasons.push('route_source_unknown');
      }
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...routeSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...routeSafeFlags()
    });
  }
}

export function evaluateRouteSourceBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'ROUTE_SOURCE_INVALID'),
    route_source_valid: (state === 'ROUTE_SOURCE_READ_ONLY_OK'),
    route_source_state: state,
    provider_disabled: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...routeSafeFlags()
  });
  try {
    const v = validateRouteSourceBoundary(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('ROUTE_SOURCE_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_route_source_input']);
    }
    // missing source -> UNCONFIGURED
    if (v.reasons.includes('route_source_missing')) {
      return build('ROUTE_SOURCE_UNCONFIGURED', ['route_source_missing']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / bad purpose
    // / unknown tag -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid') ||
        v.reasons.includes('route_source_unknown')) {
      return build('ROUTE_SOURCE_INVALID', v.reasons);
    }
    // a valid disabled/read-only tag -> READ_ONLY_OK
    return build('ROUTE_SOURCE_READ_ONLY_OK', ['route_source_read_only_ok']);
  } catch {
    return build('ROUTE_SOURCE_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (E) CANDIDATE ROUTE PLAN
//
// A DESCRIPTIVE route plan from route metadata input ONLY, produced after a
// ROUTE_INPUT_VALID boundary + ROUTE_SOURCE_READ_ONLY_OK source ONLY. It is NOT
// an order, NOT a transaction, NOT a signing permission, NOT a send permission,
// NOT trading/transaction readiness. It opens NO route_ready / transaction_ready
// / order_ready / signing_permitted / can_send / live_quote_enabled. NO order_id
// / transaction_id / serialized_tx / signature / quote_response /
// jupiter_route_object / executable_instruction / swap_instruction /
// compute_budget_instruction / send / broadcast field ever appears in output.
// Fail-Safe: bad route metadata buckets (many hops / poor quality / thin
// liquidity / high slippage) -> REJECTED (no candidate route).
// ---------------------------------------------------------------------------

const CANDIDATE_ROUTE_STATES = Object.freeze([
  'CANDIDATE_ROUTE_UNCONFIGURED', 'CANDIDATE_ROUTE_INVALID',
  'CANDIDATE_ROUTE_REJECTED', 'CANDIDATE_ROUTE_CANDIDATE'
]);

const CANDIDATE_ROUTE_REASON_CODES = Object.freeze([
  'route_input_valid', 'route_source_valid', 'route_metadata_present',
  'route_hop_count_high', 'route_quality_poor', 'liquidity_thin',
  'slippage_high', 'candidate_route_reviewed', 'route_input_not_valid',
  'route_source_not_valid'
]);

const CANDIDATE_ROUTE_COMPONENTS = Object.freeze([
  'route_input_boundary', 'route_source_boundary', 'route_metadata'
]);

// fields that MUST NOT appear in any candidate-route input or output
// (order/tx/sign/send/quote/instruction).
const CANDIDATE_ROUTE_FORBIDDEN_KEYS = Object.freeze([
  'order_id', 'transaction_id', 'serialized_tx', 'signature', 'private_key',
  'quote_response', 'jupiter_route_object', 'executable_instruction',
  'swap_instruction', 'compute_budget_instruction', 'send', 'broadcast'
]);

const CANDIDATE_ROUTE_HOP_BUCKETS = Object.freeze(['unknown', 'single', 'few', 'many']);
const CANDIDATE_ROUTE_LIQUIDITY_BUCKETS = Object.freeze(['unknown', 'thin', 'adequate', 'deep']);
const CANDIDATE_ROUTE_SLIPPAGE_BUCKETS = Object.freeze(['unknown', 'high', 'medium', 'low']);
const CANDIDATE_ROUTE_QUALITY_BUCKETS = Object.freeze(['unknown', 'poor', 'acceptable', 'good']);

function candidateRouteHasForbiddenKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (CANDIDATE_ROUTE_FORBIDDEN_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

export function describeCandidateRoutePlanContract() {
  return Object.freeze({
    contract: 'candidate-route-plan',
    version: '0.0.0',
    test_only: true,
    supported_states: CANDIDATE_ROUTE_STATES,
    supported_reason_codes: CANDIDATE_ROUTE_REASON_CODES,
    advisory_only: true,
    candidate_route_valid: false,
    candidate_route_state: 'CANDIDATE_ROUTE_UNCONFIGURED',
    route_plan_ref: null,
    intent_record_ref: null,
    route_kind: 'candidate_route_plan',
    route_reason_codes: Object.freeze([]),
    status: 'CANDIDATE_ROUTE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...routeSafeFlags(),
    note: 'Read-only DESCRIPTIVE candidate route plan produced from route metadata input ONLY, after a Stage-9 ROUTE_INPUT_VALID boundary + ROUTE_SOURCE_READ_ONLY_OK source ONLY. A candidate route plan is a READ-ONLY ADVISORY REPRESENTATION ONLY — NOT an order, NOT a transaction, NOT a signing permission, NOT a send permission, NOT trading/transaction readiness. It opens NO route_ready / transaction_ready / order_ready / signing_permitted / can_send / live_quote_enabled — every readiness/execution flag STAYS false; "a candidate route exists" is carried ONLY by candidate_route_valid / candidate_route_state / route_plan_ref. NO order_id / transaction_id / serialized_tx / signature / quote_response / jupiter_route_object / executable_instruction / swap_instruction / compute_budget_instruction / send / broadcast field ever appears in output. Fail-Safe-Not-Fail-Open: missing input -> CANDIDATE_ROUTE_UNCONFIGURED; route_input_boundary not ROUTE_INPUT_VALID OR route_source_boundary not ROUTE_SOURCE_READ_ONLY_OK -> CANDIDATE_ROUTE_REJECTED (no candidate route); route_metadata requires_live_quote!==false OR no_transaction_build!==true OR smuggled order/tx/sign/send/quote/instruction key or forbidden flag/secret/endpoint -> CANDIDATE_ROUTE_INVALID; route_hop_count_bucket many OR route_quality_bucket poor OR liquidity_bucket thin OR estimated_slippage_bucket high -> CANDIDATE_ROUTE_REJECTED (Fail-Safe; matching reason code included); valid clean metadata -> CANDIDATE_ROUTE_CANDIDATE. route_plan_ref / intent_record_ref are caller-supplied deterministic opaque refs, never generated and never derived from a clock.'
  });
}

export function validateCandidateRoutePlanInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (routeUninspectable(obj, ['purpose', ...CANDIDATE_ROUTE_COMPONENTS,
      'intent_record_ref', 'route_plan_ref'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...routeSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_candidate_route_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!CANDIDATE_ROUTE_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...routeScreen(shallow));
      if (candidateRouteHasForbiddenKey(obj)) reasons.push('forbidden_execution_field_blocked');
      // screen nested components for forbidden flags / exec cmds / forbidden keys / endpoints
      for (const k of CANDIDATE_ROUTE_COMPONENTS) {
        const c = obj[k];
        if (c == null || typeof c !== 'object') continue;
        if (routeHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (routeHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (candidateRouteHasForbiddenKey(c)) reasons.push('forbidden_execution_field_blocked');
        if (routeHasEndpointOrMainnet(c)) reasons.push('endpoint_or_mainnet_blocked');
      }
      if (obj.purpose !== 'candidate_route_plan_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...routeSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...routeSafeFlags()
    });
  }
}

export function evaluateCandidateRoutePlan(input) {
  const build = (state, reasons, refs) => Object.freeze({
    candidate_route_valid: (state === 'CANDIDATE_ROUTE_CANDIDATE'),
    candidate_route_state: state,
    route_plan_ref: (refs && typeof refs.route_plan_ref === 'string') ? refs.route_plan_ref : null,
    intent_record_ref: (refs && typeof refs.intent_record_ref === 'string') ? refs.intent_record_ref : null,
    route_kind: 'candidate_route_plan',
    route_reason_codes: Object.freeze(
      [...new Set((reasons || []).filter((c) => CANDIDATE_ROUTE_REASON_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...routeSafeFlags()
  });
  try {
    const v = validateCandidateRoutePlanInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('CANDIDATE_ROUTE_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_candidate_route_input'], null);
    }

    const refs = {
      route_plan_ref: (typeof input.route_plan_ref === 'string') ? input.route_plan_ref : null,
      intent_record_ref: (typeof input.intent_record_ref === 'string') ? input.intent_record_ref : null
    };

    // smuggled order/tx/sign/send/quote/instruction key or forbidden flag / exec
    // cmd / secret / endpoint / mainnet / bad purpose -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('forbidden_execution_field_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('CANDIDATE_ROUTE_INVALID', ['route_metadata_invalid'], refs);
    }

    const boundary = input.route_input_boundary;
    const source = input.route_source_boundary;
    const metadata = input.route_metadata;

    // missing required input -> UNCONFIGURED
    if (boundary == null || source == null || metadata == null ||
        typeof metadata !== 'object' || Array.isArray(metadata)) {
      return build('CANDIDATE_ROUTE_UNCONFIGURED', ['required_input_missing'], refs);
    }

    const boundaryState = routeRecognizeInputBoundaryResult(boundary);
    const sourceState = routeRecognizeSourceBoundaryResult(source);

    // route_input_boundary not ROUTE_INPUT_VALID -> REJECTED
    if (boundaryState !== 'ROUTE_INPUT_VALID') {
      return build('CANDIDATE_ROUTE_REJECTED', ['route_input_not_valid'], refs);
    }
    // route_source_boundary not ROUTE_SOURCE_READ_ONLY_OK -> REJECTED
    if (sourceState !== 'ROUTE_SOURCE_READ_ONLY_OK') {
      return build('CANDIDATE_ROUTE_REJECTED', ['route_source_not_valid'], refs);
    }

    // route metadata must explicitly forbid live quote + transaction build
    if (metadata.requires_live_quote !== false || metadata.no_transaction_build !== true) {
      return build('CANDIDATE_ROUTE_INVALID', ['route_metadata_invalid'], refs);
    }

    const hop = metadata.route_hop_count_bucket;
    const liq = metadata.liquidity_bucket;
    const slip = metadata.estimated_slippage_bucket;
    const quality = metadata.route_quality_bucket;

    // bucket values must be from the known allowlists -> else INVALID
    if (!CANDIDATE_ROUTE_HOP_BUCKETS.includes(hop) ||
        !CANDIDATE_ROUTE_LIQUIDITY_BUCKETS.includes(liq) ||
        !CANDIDATE_ROUTE_SLIPPAGE_BUCKETS.includes(slip) ||
        !CANDIDATE_ROUTE_QUALITY_BUCKETS.includes(quality)) {
      return build('CANDIDATE_ROUTE_INVALID', ['route_metadata_invalid'], refs);
    }

    // Fail-Safe: bad route conditions -> REJECTED (no candidate route)
    const bad = [];
    if (hop === 'many') bad.push('route_hop_count_high');
    if (quality === 'poor') bad.push('route_quality_poor');
    if (liq === 'thin') bad.push('liquidity_thin');
    if (slip === 'high') bad.push('slippage_high');
    if (bad.length > 0) {
      return build('CANDIDATE_ROUTE_REJECTED', [
        'route_input_valid', 'route_source_valid', 'route_metadata_present', ...bad
      ], refs);
    }

    // valid clean metadata -> CANDIDATE
    return build('CANDIDATE_ROUTE_CANDIDATE', [
      'route_input_valid', 'route_source_valid', 'route_metadata_present',
      'candidate_route_reviewed'
    ], refs);
  } catch {
    return build('CANDIDATE_ROUTE_UNCONFIGURED', ['input_inspection_error'], null);
  }
}
