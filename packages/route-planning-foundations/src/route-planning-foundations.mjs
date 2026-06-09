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

// ---------------------------------------------------------------------------
// (F) ROUTE FEASIBILITY / SLIPPAGE ADVISORY
//
// An ADVISORY feasibility verdict derived from safe input BUCKETS ONLY (route
// quality / estimated slippage / liquidity / hop count) — NO live quote, NO
// aggregator/Jupiter/RPC route call, NO order, NO transaction. A FEASIBLE
// advisory route is a READ-ONLY ADVISORY REPRESENTATION ONLY — it opens NO
// order / transaction / signing / send and flips NO readiness flag. Fail-Safe-
// Not-Fail-Open: any 'unknown' / 'medium' slippage / 'many' hops -> DEGRADED;
// 'poor' quality / 'high' slippage / 'thin' liquidity -> REJECTED; only clearly
// good/low/deep/single|few -> FEASIBLE_ADVISORY.
// ---------------------------------------------------------------------------

const ROUTE_FEASIBILITY_STATES = Object.freeze([
  'ROUTE_FEASIBILITY_UNCONFIGURED', 'ROUTE_FEASIBILITY_INVALID',
  'ROUTE_FEASIBILITY_DEGRADED', 'ROUTE_FEASIBILITY_REJECTED',
  'ROUTE_FEASIBILITY_FEASIBLE_ADVISORY'
]);

const ROUTE_FEASIBILITY_REASON_CODES = Object.freeze([
  'route_quality_unknown', 'route_quality_poor', 'slippage_unknown',
  'slippage_high', 'slippage_medium', 'liquidity_unknown', 'liquidity_thin',
  'hop_count_unknown', 'hop_count_many', 'route_feasible_advisory'
]);

const ROUTE_FEASIBILITY_QUALITY_BUCKETS = Object.freeze(['unknown', 'poor', 'acceptable', 'good']);
const ROUTE_FEASIBILITY_SLIPPAGE_BUCKETS = Object.freeze(['unknown', 'high', 'medium', 'low']);
const ROUTE_FEASIBILITY_LIQUIDITY_BUCKETS = Object.freeze(['unknown', 'thin', 'adequate', 'deep']);
const ROUTE_FEASIBILITY_HOP_BUCKETS = Object.freeze(['unknown', 'single', 'few', 'many']);

const ROUTE_FEASIBILITY_TOP_KEYS = Object.freeze([
  'purpose', 'route_quality_bucket', 'estimated_slippage_bucket',
  'liquidity_bucket', 'hop_count_bucket'
]);

export function describeRouteFeasibilityContract() {
  return Object.freeze({
    contract: 'route-feasibility-advisory',
    version: '0.0.0',
    test_only: true,
    supported_states: ROUTE_FEASIBILITY_STATES,
    supported_reason_codes: ROUTE_FEASIBILITY_REASON_CODES,
    advisory_only: true,
    valid: false,
    route_feasibility_state: 'ROUTE_FEASIBILITY_UNCONFIGURED',
    route_feasible_advisory: false,
    route_rejected: false,
    route_reason_codes: Object.freeze([]),
    status: 'ROUTE_FEASIBILITY_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...routeSafeFlags(),
    note: 'Read-only ADVISORY route feasibility / slippage verdict derived from safe input BUCKETS ONLY (route_quality_bucket, estimated_slippage_bucket, liquidity_bucket, hop_count_bucket) — NO live quote, NO aggregator/Jupiter/RPC route call, NO order, NO transaction, NO signing, NO send. A FEASIBLE advisory route is a READ-ONLY ADVISORY REPRESENTATION ONLY: it opens NO order / transaction / signing / send and flips NO readiness flag (route_ready / order_ready / transaction_ready / signing_permitted / can_send / live_quote_enabled STAY false). NO quote/order/transaction/instruction field ever appears in output. Fail-Safe-Not-Fail-Open: invalid enum bucket -> ROUTE_FEASIBILITY_INVALID; missing bucket -> ROUTE_FEASIBILITY_UNCONFIGURED; route_quality poor OR estimated_slippage high OR liquidity thin -> ROUTE_FEASIBILITY_REJECTED; any unknown OR hop_count many OR slippage medium (and no rejection) -> ROUTE_FEASIBILITY_DEGRADED; ROUTE_FEASIBILITY_FEASIBLE_ADVISORY only if route_quality in {acceptable,good} AND estimated_slippage in {low,medium} AND liquidity in {adequate,deep} AND hop_count in {single,few}.'
  });
}

export function validateRouteFeasibilityInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (routeUninspectable(obj, [...ROUTE_FEASIBILITY_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...routeSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_route_feasibility_input');
    } else {
      recognized = true;
      reasons.push(...routeScreen(obj));
      if (obj.purpose !== 'route_feasibility_input') reasons.push('purpose_invalid');
      const q = obj.route_quality_bucket;
      const s = obj.estimated_slippage_bucket;
      const l = obj.liquidity_bucket;
      const h = obj.hop_count_bucket;
      if (q == null || s == null || l == null || h == null) reasons.push('bucket_missing');
      if (q != null && !ROUTE_FEASIBILITY_QUALITY_BUCKETS.includes(q)) reasons.push('bucket_invalid');
      if (s != null && !ROUTE_FEASIBILITY_SLIPPAGE_BUCKETS.includes(s)) reasons.push('bucket_invalid');
      if (l != null && !ROUTE_FEASIBILITY_LIQUIDITY_BUCKETS.includes(l)) reasons.push('bucket_invalid');
      if (h != null && !ROUTE_FEASIBILITY_HOP_BUCKETS.includes(h)) reasons.push('bucket_invalid');
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

export function evaluateRouteFeasibility(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'ROUTE_FEASIBILITY_INVALID'),
    route_feasibility_state: state,
    route_feasible_advisory: (state === 'ROUTE_FEASIBILITY_FEASIBLE_ADVISORY'),
    route_rejected: (state === 'ROUTE_FEASIBILITY_REJECTED'),
    route_reason_codes: Object.freeze(
      [...new Set((reasons || []).filter((c) => ROUTE_FEASIBILITY_REASON_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...routeSafeFlags()
  });
  try {
    const v = validateRouteFeasibilityInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('ROUTE_FEASIBILITY_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_route_feasibility_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / bad purpose
    // / invalid enum -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid') ||
        v.reasons.includes('bucket_invalid')) {
      return build('ROUTE_FEASIBILITY_INVALID', ['route_feasibility_input_invalid']);
    }
    // missing bucket -> UNCONFIGURED
    if (v.reasons.includes('bucket_missing')) {
      return build('ROUTE_FEASIBILITY_UNCONFIGURED', ['bucket_missing']);
    }

    const q = input.route_quality_bucket;
    const s = input.estimated_slippage_bucket;
    const l = input.liquidity_bucket;
    const h = input.hop_count_bucket;

    // Fail-Safe: hard rejection conditions
    const reject = [];
    if (q === 'poor') reject.push('route_quality_poor');
    if (s === 'high') reject.push('slippage_high');
    if (l === 'thin') reject.push('liquidity_thin');
    if (reject.length > 0) {
      return build('ROUTE_FEASIBILITY_REJECTED', reject);
    }

    // DEGRADED conditions (any unknown OR hop many OR slippage medium)
    const degraded = [];
    if (q === 'unknown') degraded.push('route_quality_unknown');
    if (s === 'unknown') degraded.push('slippage_unknown');
    if (l === 'unknown') degraded.push('liquidity_unknown');
    if (h === 'unknown') degraded.push('hop_count_unknown');
    if (h === 'many') degraded.push('hop_count_many');
    if (s === 'medium') degraded.push('slippage_medium');
    if (degraded.length > 0) {
      return build('ROUTE_FEASIBILITY_DEGRADED', degraded);
    }

    // FEASIBLE_ADVISORY only when all clearly within safe ranges
    if ((q === 'acceptable' || q === 'good') &&
        (s === 'low' || s === 'medium') &&
        (l === 'adequate' || l === 'deep') &&
        (h === 'single' || h === 'few')) {
      return build('ROUTE_FEASIBILITY_FEASIBLE_ADVISORY', ['route_feasible_advisory']);
    }

    // fall-through (should not happen with the allowlists above) -> DEGRADED
    return build('ROUTE_FEASIBILITY_DEGRADED', ['route_quality_unknown']);
  } catch {
    return build('ROUTE_FEASIBILITY_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-9 (F) route-feasibility result fed forward.
function routeRecognizeFeasibilityResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.route_feasibility_state === 'string' && ROUTE_FEASIBILITY_STATES.includes(o.route_feasibility_state)) {
    return o.route_feasibility_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (G) EXECUTION PLAN PREVIEW
//
// A DESCRIPTIVE preview of a candidate route plan that already passed an
// advisory feasibility verdict — WITHOUT any transaction, order, signing, or
// send. An execution plan preview is NOT a transaction: even
// EXECUTION_PLAN_PREVIEW_PREVIEW_VALID opens NO transaction_ready /
// signing_permitted / can_serialize / can_send. It only marks that a LATER stage
// (Stage 10) MAY review a transaction build (requires_next_stage is a fixed
// string-literal marker, NOT a readiness flag). NO order_id / transaction_id /
// serialized_tx / instruction_array / message_bytes / signature / signer /
// broadcast_target / endpoint field ever appears in output.
// ---------------------------------------------------------------------------

const EXECUTION_PLAN_PREVIEW_STATES = Object.freeze([
  'EXECUTION_PLAN_PREVIEW_UNCONFIGURED', 'EXECUTION_PLAN_PREVIEW_INVALID',
  'EXECUTION_PLAN_PREVIEW_REJECTED', 'EXECUTION_PLAN_PREVIEW_SUPPRESSED',
  'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID'
]);

const EXECUTION_PLAN_PREVIEW_REASON_CODES = Object.freeze([
  'candidate_route_valid', 'route_feasible_advisory', 'execution_plan_preview_valid',
  'candidate_route_not_valid', 'route_feasibility_not_feasible',
  'transaction_build_forbidden_flag_missing', 'forbidden_execution_field_blocked'
]);

const EXECUTION_PLAN_PREVIEW_COMPONENTS = Object.freeze([
  'candidate_route_plan', 'route_feasibility'
]);

// fields that MUST NOT appear in any execution-plan-preview input or output.
const EXECUTION_PLAN_PREVIEW_FORBIDDEN_KEYS = Object.freeze([
  'order_id', 'transaction_id', 'serialized_tx', 'instruction_array',
  'message_bytes', 'signature', 'signer', 'broadcast_target', 'endpoint',
  'quote_response', 'jupiter_route_object', 'swap_instruction',
  'compute_budget_instruction', 'private_key'
]);

const EXECUTION_PLAN_PREVIEW_TOP_KEYS = Object.freeze([
  'purpose', 'candidate_route_plan', 'route_feasibility', 'preview_ref',
  'no_transaction_build', 'no_order', 'no_signing', 'no_send'
]);

function executionPreviewHasForbiddenKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (EXECUTION_PLAN_PREVIEW_FORBIDDEN_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

export function describeExecutionPlanPreviewContract() {
  return Object.freeze({
    contract: 'execution-plan-preview',
    version: '0.0.0',
    test_only: true,
    supported_states: EXECUTION_PLAN_PREVIEW_STATES,
    supported_reason_codes: EXECUTION_PLAN_PREVIEW_REASON_CODES,
    advisory_only: true,
    execution_plan_preview_valid: false,
    execution_plan_preview_state: 'EXECUTION_PLAN_PREVIEW_UNCONFIGURED',
    preview_ref: null,
    route_plan_ref: null,
    intent_record_ref: null,
    preview_reason_codes: Object.freeze([]),
    requires_next_stage: 'transaction_build_review',
    status: 'EXECUTION_PLAN_PREVIEW_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...routeSafeFlags(),
    note: 'Read-only DESCRIPTIVE execution plan preview over a CANDIDATE_ROUTE_CANDIDATE plan that already passed a ROUTE_FEASIBILITY_FEASIBLE_ADVISORY verdict — WITHOUT any transaction, order, signing, or send. An execution plan preview is NOT a transaction: even EXECUTION_PLAN_PREVIEW_PREVIEW_VALID opens NO transaction_ready / signing_permitted / can_serialize / can_send and flips NO readiness flag. requires_next_stage is a FIXED string-literal marker (transaction_build_review) indicating a LATER stage MAY review a transaction build — it is NOT a readiness flag and grants NO permission. NO order_id / transaction_id / serialized_tx / instruction_array / message_bytes / signature / signer / broadcast_target / endpoint / quote_response / jupiter_route_object / swap_instruction / compute_budget_instruction field ever appears in output. Fail-Safe-Not-Fail-Open: missing candidate route -> EXECUTION_PLAN_PREVIEW_UNCONFIGURED; candidate_route_plan not CANDIDATE_ROUTE_CANDIDATE OR route_feasibility not ROUTE_FEASIBILITY_FEASIBLE_ADVISORY -> EXECUTION_PLAN_PREVIEW_REJECTED / EXECUTION_PLAN_PREVIEW_SUPPRESSED (infeasible route -> rejected/suppressed); no_transaction_build / no_order / no_signing / no_send not strictly true OR a smuggled transaction/instruction/sign/send key / forbidden flag / secret / endpoint -> EXECUTION_PLAN_PREVIEW_INVALID (never echoed); a feasible advisory route + valid candidate -> EXECUTION_PLAN_PREVIEW_PREVIEW_VALID.'
  });
}

export function validateExecutionPlanPreviewInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (routeUninspectable(obj, [...EXECUTION_PLAN_PREVIEW_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...routeSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_execution_plan_preview_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, val] of Object.entries(obj)) {
        if (!EXECUTION_PLAN_PREVIEW_COMPONENTS.includes(k)) shallow[k] = val;
      }
      reasons.push(...routeScreen(shallow));
      if (executionPreviewHasForbiddenKey(obj)) reasons.push('forbidden_execution_field_blocked');
      for (const k of EXECUTION_PLAN_PREVIEW_COMPONENTS) {
        const c = obj[k];
        if (c == null || typeof c !== 'object') continue;
        if (routeHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (routeHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (executionPreviewHasForbiddenKey(c)) reasons.push('forbidden_execution_field_blocked');
        if (routeHasEndpointOrMainnet(c)) reasons.push('endpoint_or_mainnet_blocked');
      }
      if (obj.purpose !== 'execution_plan_preview_input') reasons.push('purpose_invalid');
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

export function evaluateExecutionPlanPreview(input) {
  const build = (state, reasons, refs) => Object.freeze({
    execution_plan_preview_valid: (state === 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID'),
    execution_plan_preview_state: state,
    preview_ref: (refs && typeof refs.preview_ref === 'string') ? refs.preview_ref : null,
    route_plan_ref: (refs && typeof refs.route_plan_ref === 'string') ? refs.route_plan_ref : null,
    intent_record_ref: (refs && typeof refs.intent_record_ref === 'string') ? refs.intent_record_ref : null,
    preview_reason_codes: Object.freeze(
      [...new Set((reasons || []).filter((c) => EXECUTION_PLAN_PREVIEW_REASON_CODES.includes(c)))]
    ),
    requires_next_stage: 'transaction_build_review',
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...routeSafeFlags()
  });
  try {
    const v = validateExecutionPlanPreviewInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('EXECUTION_PLAN_PREVIEW_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_execution_plan_preview_input'], null);
    }

    const candidate = input.candidate_route_plan;
    const feasibility = input.route_feasibility;

    // pull only whitelisted opaque refs from candidate route (never input values)
    const refs = {
      preview_ref: (typeof input.preview_ref === 'string') ? input.preview_ref : null,
      route_plan_ref: (candidate != null && typeof candidate === 'object' && typeof candidate.route_plan_ref === 'string') ? candidate.route_plan_ref : null,
      intent_record_ref: (candidate != null && typeof candidate === 'object' && typeof candidate.intent_record_ref === 'string') ? candidate.intent_record_ref : null
    };

    // smuggled tx/instruction/sign/send key / forbidden flag / exec cmd / secret /
    // endpoint / mainnet / bad purpose -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('forbidden_execution_field_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('EXECUTION_PLAN_PREVIEW_INVALID', ['execution_plan_preview_input_invalid'], refs);
    }

    // missing candidate route -> UNCONFIGURED
    if (candidate == null) {
      return build('EXECUTION_PLAN_PREVIEW_UNCONFIGURED', ['required_input_missing'], refs);
    }

    // the no-* guards MUST be strictly true
    if (input.no_transaction_build !== true || input.no_order !== true ||
        input.no_signing !== true || input.no_send !== true) {
      return build('EXECUTION_PLAN_PREVIEW_INVALID', ['transaction_build_forbidden_flag_missing'], refs);
    }

    const candidateState = routeRecognizeCandidateRouteResult(candidate);
    const feasibilityState = routeRecognizeFeasibilityResult(feasibility);

    // candidate route not a recognized CANDIDATE -> REJECTED
    if (candidateState !== 'CANDIDATE_ROUTE_CANDIDATE') {
      return build('EXECUTION_PLAN_PREVIEW_REJECTED', ['candidate_route_not_valid'], refs);
    }
    // feasibility not FEASIBLE_ADVISORY -> SUPPRESSED (infeasible route -> not previewable)
    if (feasibilityState !== 'ROUTE_FEASIBILITY_FEASIBLE_ADVISORY') {
      return build('EXECUTION_PLAN_PREVIEW_SUPPRESSED', ['route_feasibility_not_feasible'], refs);
    }

    // feasible advisory route + valid candidate -> PREVIEW_VALID (NOT a transaction)
    return build('EXECUTION_PLAN_PREVIEW_PREVIEW_VALID', [
      'candidate_route_valid', 'route_feasible_advisory', 'execution_plan_preview_valid'
    ], refs);
  } catch {
    return build('EXECUTION_PLAN_PREVIEW_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// Recognize a Stage-9 (E) candidate-route-plan result fed forward.
function routeRecognizeCandidateRouteResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.candidate_route_state === 'string' && CANDIDATE_ROUTE_STATES.includes(o.candidate_route_state)) {
    return o.candidate_route_state;
  }
  return null;
}

// Recognize a Stage-9 (G) execution-plan-preview result fed forward.
function routeRecognizeExecutionPreviewResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.execution_plan_preview_state === 'string' && EXECUTION_PLAN_PREVIEW_STATES.includes(o.execution_plan_preview_state)) {
    return o.execution_plan_preview_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (H) ROUTE SUPPRESSION / REJECTION
//
// Prevents route/plan progression and reports REASONS ONLY. It creates NO order
// and NO transaction. A route is NEVER order / transaction / sign / send /
// execution authorized at this layer — the not_*_authorized reasons are ALWAYS
// present when emitting, even for an advisory-valid feasible route. Suppression
// opens NO transaction_ready / signing_permitted / can_send.
// ---------------------------------------------------------------------------

const ROUTE_SUPPRESSION_REASON_CODES = Object.freeze([
  'intent_not_awaiting_route_review', 'route_source_invalid',
  'route_metadata_missing', 'route_feasibility_failed', 'high_slippage',
  'thin_liquidity', 'route_quality_poor', 'not_order_authorized',
  'not_transaction_authorized', 'not_sign_authorized', 'not_send_authorized',
  'not_execution_authorized'
]);

const ROUTE_SUPPRESSION_ALWAYS = Object.freeze([
  'not_order_authorized', 'not_transaction_authorized', 'not_sign_authorized',
  'not_send_authorized', 'not_execution_authorized'
]);

const ROUTE_SUPPRESSION_COMPONENTS = Object.freeze([
  'route_input_boundary', 'candidate_route_plan', 'route_feasibility',
  'route_source_boundary'
]);

const ROUTE_SUPPRESSION_TOP_KEYS = Object.freeze(['purpose', ...ROUTE_SUPPRESSION_COMPONENTS]);

export function describeRouteSuppressionContract() {
  return Object.freeze({
    contract: 'route-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: ROUTE_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: true,
    suppression_reasons: ROUTE_SUPPRESSION_ALWAYS,
    status: 'ROUTE_SUPPRESSED',
    reasons: Object.freeze([]),
    ...routeSafeFlags(),
    note: 'Read-only route SUPPRESSION / REJECTION layer. It prevents route/plan progression and reports REASONS ONLY — it creates NO order and NO transaction. A route is NEVER order / transaction / sign / send / execution authorized at this layer: the reasons not_order_authorized + not_transaction_authorized + not_sign_authorized + not_send_authorized + not_execution_authorized are ALWAYS present when emitting, even for an advisory-valid feasible route (suppressed may be false but the route is still NOT order/transaction/sign/send authorized). Suppression opens NO transaction_ready / signing_permitted / can_send and flips NO readiness flag. Rules: route_input_boundary not ROUTE_INPUT_VALID -> suppressed + intent_not_awaiting_route_review; route_source_boundary not ROUTE_SOURCE_READ_ONLY_OK -> suppressed + route_source_invalid; missing candidate route / route metadata -> suppressed + route_metadata_missing; route_feasibility REJECTED -> suppressed + route_feasibility_failed (+ high_slippage / thin_liquidity / route_quality_poor from its reason codes). Smuggled trading flag / secret / endpoint / mainnet -> fail-closed suppressed.'
  });
}

export function evaluateRouteSuppression(input) {
  const build = (suppressed, reasons) => {
    const all = [...new Set([...(reasons || []), ...ROUTE_SUPPRESSION_ALWAYS])]
      .filter((c) => ROUTE_SUPPRESSION_REASON_CODES.includes(c));
    return Object.freeze({
      suppressed: suppressed === true,
      suppression_reasons: Object.freeze(all),
      status: suppressed === true ? 'ROUTE_SUPPRESSED' : 'ROUTE_NOT_SUPPRESSED',
      reasons: Object.freeze([...new Set(reasons || [])]),
      read_only: true,
      advisory_only: true,
      ...routeSafeFlags()
    });
  };
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (routeUninspectable(obj, [...ROUTE_SUPPRESSION_TOP_KEYS])) {
      return build(true, ['route_metadata_missing']);
    }
    if (!obj) {
      return build(true, ['route_metadata_missing']);
    }

    // fail-closed: smuggled trading flag / exec cmd / secret / endpoint / mainnet
    const shallow = {};
    for (const [k, val] of Object.entries(obj)) {
      if (!ROUTE_SUPPRESSION_COMPONENTS.includes(k)) shallow[k] = val;
    }
    if (routeScreen(shallow).length > 0) {
      return build(true, ['route_metadata_missing']);
    }
    for (const k of ROUTE_SUPPRESSION_COMPONENTS) {
      const c = obj[k];
      if (c == null || typeof c !== 'object') continue;
      if (routeHasForbiddenTrueFlag(c) || routeHasExecCmdKey(c) || routeHasEndpointOrMainnet(c)) {
        return build(true, ['route_metadata_missing']);
      }
    }

    const boundary = obj.route_input_boundary;
    const source = obj.route_source_boundary;
    const candidate = obj.candidate_route_plan;
    const feasibility = obj.route_feasibility;

    const reasons = [];

    // route_input_boundary not ROUTE_INPUT_VALID -> suppressed
    if (boundary != null) {
      const bs = routeRecognizeInputBoundaryResult(boundary);
      if (bs !== 'ROUTE_INPUT_VALID') reasons.push('intent_not_awaiting_route_review');
    }
    // route_source_boundary not ROUTE_SOURCE_READ_ONLY_OK -> suppressed
    if (source != null) {
      const ss = routeRecognizeSourceBoundaryResult(source);
      if (ss !== 'ROUTE_SOURCE_READ_ONLY_OK') reasons.push('route_source_invalid');
    }
    // missing candidate route / route metadata -> suppressed
    const candidateState = routeRecognizeCandidateRouteResult(candidate);
    if (candidate == null || candidateState === null || candidateState !== 'CANDIDATE_ROUTE_CANDIDATE') {
      reasons.push('route_metadata_missing');
    }
    // route_feasibility REJECTED -> suppressed (+ specific reason codes)
    if (feasibility != null) {
      const fs = routeRecognizeFeasibilityResult(feasibility);
      if (fs === 'ROUTE_FEASIBILITY_REJECTED') {
        reasons.push('route_feasibility_failed');
        const fc = Array.isArray(feasibility.route_reason_codes) ? feasibility.route_reason_codes : [];
        if (fc.includes('slippage_high')) reasons.push('high_slippage');
        if (fc.includes('liquidity_thin')) reasons.push('thin_liquidity');
        if (fc.includes('route_quality_poor')) reasons.push('route_quality_poor');
      } else if (fs !== 'ROUTE_FEASIBILITY_FEASIBLE_ADVISORY' && fs !== null) {
        reasons.push('route_feasibility_failed');
      }
    }

    const suppressed = reasons.length > 0;
    return build(suppressed, reasons);
  } catch {
    return build(true, ['route_metadata_missing']);
  }
}

// ---------------------------------------------------------------------------
// (I) ROUTE HEALTH / STATUS
//
// Consumes the route input boundary + source boundary + candidate route plan +
// feasibility + execution plan preview + suppression, and derives a STATUS ONLY.
// Every state keeps all 21 readiness/execution flags false; ROUTE_HEALTH_PREVIEW_
// READY does NOT open transaction_ready / signing / can_serialize / can_send.
// ---------------------------------------------------------------------------

const ROUTE_HEALTH_STATES = Object.freeze([
  'ROUTE_HEALTH_UNCONFIGURED', 'ROUTE_HEALTH_DEGRADED',
  'ROUTE_HEALTH_CANDIDATE_REVIEWED', 'ROUTE_HEALTH_PREVIEW_READY',
  'ROUTE_HEALTH_SUPPRESSED', 'ROUTE_HEALTH_BLOCKED'
]);

const ROUTE_HEALTH_COMPONENTS = Object.freeze([
  'route_input_boundary', 'route_source_boundary', 'candidate_route_plan',
  'route_feasibility', 'execution_plan_preview', 'route_suppression'
]);

const ROUTE_HEALTH_TOP_KEYS = Object.freeze([...ROUTE_HEALTH_COMPONENTS]);

export function describeRouteHealthContract() {
  return Object.freeze({
    contract: 'route-health',
    version: '0.0.0',
    test_only: true,
    supported_states: ROUTE_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    route_health_state: 'ROUTE_HEALTH_UNCONFIGURED',
    status: 'ROUTE_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...routeSafeFlags(),
    note: 'Read-only route HEALTH / STATUS layer. It consumes the route input boundary, route source boundary, candidate route plan, route feasibility, execution plan preview, and route suppression, and derives a STATUS ONLY — it grants NO execution authority. Every state keeps all 21 readiness/execution flags false; ROUTE_HEALTH_PREVIEW_READY does NOT open transaction_ready / signing_permitted / can_serialize / can_send. Ordering (Fail-Safe-Not-Fail-Open): a smuggled forbidden trading flag (top-level or in any component) / secret / mainnet / REAL-LIVE / invalid route_input_boundary (ROUTE_INPUT_INVALID) / invalid route_source_boundary (ROUTE_SOURCE_INVALID) -> ROUTE_HEALTH_BLOCKED; a missing required component -> ROUTE_HEALTH_UNCONFIGURED; route_suppression.suppressed === true -> ROUTE_HEALTH_SUPPRESSED; execution_plan_preview EXECUTION_PLAN_PREVIEW_PREVIEW_VALID -> ROUTE_HEALTH_PREVIEW_READY; candidate_route_plan CANDIDATE_ROUTE_CANDIDATE + feasibility feasible -> ROUTE_HEALTH_CANDIDATE_REVIEWED; else ROUTE_HEALTH_DEGRADED.'
  });
}

export function evaluateRouteHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'ROUTE_HEALTH_BLOCKED'),
    route_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...routeSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (routeUninspectable(obj, [...ROUTE_HEALTH_TOP_KEYS])) {
      return build('ROUTE_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('ROUTE_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    const boundary = obj.route_input_boundary;
    const source = obj.route_source_boundary;
    const candidate = obj.candidate_route_plan;
    const feasibility = obj.route_feasibility;
    const preview = obj.execution_plan_preview;
    const suppression = obj.route_suppression;

    // BLOCKED: smuggled forbidden flag / secret / endpoint / mainnet at top level
    const shallow = {};
    for (const [k, val] of Object.entries(obj)) {
      if (!ROUTE_HEALTH_COMPONENTS.includes(k)) shallow[k] = val;
    }
    if (routeScreen(shallow).length > 0) {
      return build('ROUTE_HEALTH_BLOCKED', ['forbidden_indicator_blocked']);
    }
    // BLOCKED: forbidden flag / secret-value / endpoint / mainnet in any component
    for (const k of ROUTE_HEALTH_COMPONENTS) {
      const c = obj[k];
      if (c == null || typeof c !== 'object') continue;
      if (routeHasForbiddenTrueFlag(c) || routeHasExecCmdKey(c) || routeHasEndpointOrMainnet(c)) {
        return build('ROUTE_HEALTH_BLOCKED', ['forbidden_indicator_blocked']);
      }
    }

    // BLOCKED: invalid boundary / invalid source
    const boundaryState = routeRecognizeInputBoundaryResult(boundary);
    const sourceState = routeRecognizeSourceBoundaryResult(source);
    if (boundaryState === 'ROUTE_INPUT_INVALID') {
      return build('ROUTE_HEALTH_BLOCKED', ['route_input_boundary_invalid']);
    }
    if (sourceState === 'ROUTE_SOURCE_INVALID') {
      return build('ROUTE_HEALTH_BLOCKED', ['route_source_boundary_invalid']);
    }

    // UNCONFIGURED: a required component missing
    if (boundary == null || source == null || candidate == null ||
        feasibility == null || preview == null || suppression == null) {
      return build('ROUTE_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // SUPPRESSED: route_suppression.suppressed === true
    const isSuppressed = (typeof suppression === 'object' && suppression.suppressed === true);
    if (isSuppressed) {
      return build('ROUTE_HEALTH_SUPPRESSED', ['route_suppressed']);
    }

    // PREVIEW_READY: execution plan preview valid (NOT a transaction)
    const previewState = routeRecognizeExecutionPreviewResult(preview);
    if (previewState === 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID') {
      return build('ROUTE_HEALTH_PREVIEW_READY', ['execution_plan_preview_valid']);
    }

    // CANDIDATE_REVIEWED: candidate route + feasibility feasible
    const candidateState = routeRecognizeCandidateRouteResult(candidate);
    const feasibilityState = routeRecognizeFeasibilityResult(feasibility);
    if (candidateState === 'CANDIDATE_ROUTE_CANDIDATE' &&
        feasibilityState === 'ROUTE_FEASIBILITY_FEASIBLE_ADVISORY') {
      return build('ROUTE_HEALTH_CANDIDATE_REVIEWED', ['candidate_route_reviewed']);
    }

    // else DEGRADED
    return build('ROUTE_HEALTH_DEGRADED', ['route_health_degraded']);
  } catch {
    return build('ROUTE_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
