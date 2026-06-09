// @soltrade/intent-ledger-foundations
//
// Read-only / advisory ONLY INTENT FOUNDATION for Stage-8 of the architecture
// pipeline `data -> signal -> risk -> intent -> route -> sign -> send`. This
// package builds ONLY the read-only/advisory 'intent' foundation, consuming
// Stage-7 risk-engine outputs. Import-free, pure, deterministic. No network
// primitive, no live stream, no system clock, no persistence, no secrets, no
// mutable module/global state.
//
// THE CORE RULE: a candidate intent record is an AUDITABLE REPRESENTATION ONLY —
// NOT an order, NOT a route, NOT a transaction, NOT a signing permission, NOT a
// send permission, NOT trading/route readiness. No execution of any kind.
// intent_ready / route_ready / order_ready / transaction_ready / risk_ready /
// signal_ready ALL STAY false on every result — a candidate intent NEVER flips
// any readiness/execution flag. "A candidate intent exists / awaits route review"
// is carried ONLY by dedicated fields (candidate_intent_valid /
// candidate_intent_state / eligible_for_candidate_intent / intent_record_ref /
// append_valid), never by a readiness flag. Hostile, throwing, or uninspectable
// input returns a FROZEN refusal with reason 'input_inspection_error' and NEVER
// throws. Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package does NOT use SSOT intent vocabulary and adds NO
// name to docs/01-SSOT.md.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function intentSafeFlags() {
  return {
    read_only: true,
    has_secret: false,
    live_stream_enabled: false,
    network_call_made: false,
    endpoint_resolved: false,
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

// the 20 non-read_only flags above — none may EVER be true on input or output
const INTENT_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'route_ready', 'order_ready', 'transaction_ready', 'can_send', 'can_broadcast',
  'can_serialize', 'signing_permitted', 'broadcast_permitted', 'is_live',
  'mainnet_enabled', 'real_live'
]);

const INTENT_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'order', 'place_order', 'route', 'plan_route', 'build_tx', 'serialize_tx',
  'quote', 'jupiter_route', 'open_position', 'close_position'
]);

const INTENT_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential/i;
const INTENT_URL_RE = /https?:\/\/|wss?:\/\//i;
const INTENT_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan (their values are
// still scanned for URL/secret/mainnet substrings). NOTE: 'token_ref' is exempt
// by NAME, but a bare 'token' SECRET key is still flagged.
const INTENT_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'wallet_ref', 'token_ref', 'signal_ref', 'risk_verdict_ref',
  'intent_record_ref', 'record_ref', 'append_ref', 'audit_ref', 'actor_ref',
  'decision_ref', 'candidate_ref', 'previous_records'
]);

function intentHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of INTENT_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function intentHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (INTENT_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function intentHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (INTENT_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (INTENT_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function intentHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (INTENT_URL_RE.test(v) || INTENT_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function intentScreen(o) {
  const r = [];
  if (intentHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (intentHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (intentHasSecretField(o)) r.push('secret_field_blocked');
  if (intentHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function intentUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Stage-7 risk-output recognizers. Intent input comes ONLY from Stage-7 risk
// outputs, each of which carries read_only:true. Raw Stage-6 signal / Stage-5
// intelligence / Stage-4 ingestion objects are REFUSED.
// ---------------------------------------------------------------------------

const INTENT_RISK_INPUT_STATES = Object.freeze([
  'RISK_INPUT_UNCONFIGURED', 'RISK_INPUT_INVALID', 'RISK_INPUT_DEGRADED', 'RISK_INPUT_VALID'
]);
const INTENT_HARD_RISK_STATES = Object.freeze([
  'HARD_RISK_UNCONFIGURED', 'HARD_RISK_INVALID', 'HARD_RISK_DEGRADED',
  'HARD_RISK_BLOCKED', 'HARD_RISK_PASS_ADVISORY'
]);
const INTENT_LIQUIDITY_EXIT_STATES = Object.freeze([
  'LIQUIDITY_EXIT_UNCONFIGURED', 'LIQUIDITY_EXIT_INVALID', 'LIQUIDITY_EXIT_DEGRADED',
  'LIQUIDITY_EXIT_BLOCKED', 'LIQUIDITY_EXIT_PASS_ADVISORY'
]);
const INTENT_EXPOSURE_LIMIT_STATES = Object.freeze([
  'EXPOSURE_LIMIT_UNCONFIGURED', 'EXPOSURE_LIMIT_INVALID', 'EXPOSURE_LIMIT_DEGRADED',
  'EXPOSURE_LIMIT_BLOCKED', 'EXPOSURE_LIMIT_PASS_ADVISORY'
]);
const INTENT_RISK_VERDICT_STATES = Object.freeze([
  'RISK_UNCONFIGURED', 'RISK_DEGRADED', 'RISK_BLOCKED', 'RISK_PASS_ADVISORY'
]);
const INTENT_RISK_HEALTH_STATES = Object.freeze([
  'RISK_HEALTH_UNCONFIGURED', 'RISK_HEALTH_DEGRADED', 'RISK_HEALTH_PASS_ADVISORY',
  'RISK_HEALTH_SUPPRESSED', 'RISK_HEALTH_BLOCKED'
]);

// Stage-6 signal state fields — an object carrying one of these (and no risk
// state) is a raw signal output, NOT a Stage-7 risk output -> refuse.
const INTENT_SIGNAL_STATE_FIELDS = Object.freeze([
  'signal_input_state', 'candidate_signal_state', 'signal_score_state',
  'signal_suppression_state', 'signal_state'
]);

// Stage-5 intelligence state fields — raw intelligence -> refuse.
const INTENT_INTELLIGENCE_STATE_FIELDS = Object.freeze([
  'wallet_observation_state', 'token_observation_state', 'relationship_state',
  'diagnostics_state', 'intelligence_state'
]);

// Stage-4 raw ingestion event types — raw events -> refuse.
const INTENT_RAW_INGESTION_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed', 'token_account_change_observed',
  'swap_observed', 'mint_observed', 'pool_observed', 'balance_change_observed'
]);

// Does an object carry ANY recognized Stage-7 risk-layer state field?
function intentRiskComponentState(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (typeof o.risk_input_state === 'string' && INTENT_RISK_INPUT_STATES.includes(o.risk_input_state)) return o.risk_input_state;
  if (typeof o.hard_risk_state === 'string' && INTENT_HARD_RISK_STATES.includes(o.hard_risk_state)) return o.hard_risk_state;
  if (typeof o.liquidity_exit_state === 'string' && INTENT_LIQUIDITY_EXIT_STATES.includes(o.liquidity_exit_state)) return o.liquidity_exit_state;
  if (typeof o.exposure_risk_state === 'string' && INTENT_EXPOSURE_LIMIT_STATES.includes(o.exposure_risk_state)) return o.exposure_risk_state;
  if (typeof o.risk_verdict_state === 'string' && INTENT_RISK_VERDICT_STATES.includes(o.risk_verdict_state)) return o.risk_verdict_state;
  if (typeof o.risk_health_state === 'string' && INTENT_RISK_HEALTH_STATES.includes(o.risk_health_state)) return o.risk_health_state;
  // risk suppression carries suppressed + suppression_reasons (no dedicated *_state enum)
  if (typeof o.suppressed === 'boolean' && Array.isArray(o.suppression_reasons)) return 'RISK_SUPPRESSION_RESULT';
  return null;
}

function intentHasRiskLayerState(o) {
  return intentRiskComponentState(o) !== null;
}

// Is the object a raw Stage-6 signal output (signal state, NO risk state)?
function intentIsRawSignal(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (intentHasRiskLayerState(o)) return false;
  for (const f of INTENT_SIGNAL_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object raw Stage-5 intelligence (intelligence state, NO risk state)?
function intentIsRawIntelligence(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (intentHasRiskLayerState(o)) return false;
  for (const f of INTENT_INTELLIGENCE_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object a raw Stage-4 ingestion event (event_type, NO risk state)?
function intentIsRawIngestionEvent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (intentHasRiskLayerState(o)) return false;
  const et = o.event_type;
  return typeof et === 'string' && INTENT_RAW_INGESTION_EVENT_TYPES.includes(et);
}

// Recognize a Stage-7 risk RESULT component: an inspectable read-only object that
// carries a valid risk-layer state and is NOT raw signal/intelligence/event.
// Returns the recognized risk-layer state string, or null.
function intentRecognizeRiskComponent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (intentIsRawSignal(o) || intentIsRawIntelligence(o) || intentIsRawIngestionEvent(o)) return null;
  if (o.read_only !== true) return null;
  return intentRiskComponentState(o);
}

// Screen a Stage-7 RESULT object passed in a component slot: forbidden trading
// flag, execution-command KEY, raw signal/intelligence/event, endpoint/mainnet by
// string VALUE. The secret-NAME scan is NOT run here because legitimate risk
// state fields contain the substring 'token'; results spread only fixed
// literals/allowlisted tokens, so a bare secret value is never echoed.
function intentScreenComponentResult(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (intentHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (intentHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (intentHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (intentIsRawSignal(c) || intentIsRawIntelligence(c) || intentIsRawIngestionEvent(c)) r.push('raw_non_risk_input_refused');
  return r;
}

// ---------------------------------------------------------------------------
// (C) INTENT INPUT BOUNDARY
//
// Verifies that intent input comes ONLY from Stage-7 risk outputs, never from raw
// signal / intelligence / commands. A VALID boundary opens NO
// intent/route/order/transaction/trading readiness; eligible_for_candidate_intent
// marks the input shape only, and is NOT an order/route/intent/send permission.
// ---------------------------------------------------------------------------

const INTENT_INPUT_STATES = Object.freeze([
  'INTENT_INPUT_UNCONFIGURED', 'INTENT_INPUT_INVALID',
  'INTENT_INPUT_DEGRADED', 'INTENT_INPUT_VALID'
]);

const INTENT_INPUT_COMPONENTS = Object.freeze([
  'risk_input_boundary', 'hard_risk', 'liquidity_exit', 'exposure',
  'risk_verdict', 'risk_suppression', 'risk_health'
]);

export function describeIntentInputBoundaryContract() {
  return Object.freeze({
    contract: 'intent-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: INTENT_INPUT_STATES,
    advisory_only: true,
    intent_input_state: 'INTENT_INPUT_UNCONFIGURED',
    intent_input_boundary_valid: false,
    eligible_for_candidate_intent: false,
    status: 'INTENT_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...intentSafeFlags(),
    note: 'Read-only intent-input boundary. Verifies intent input comes ONLY from Stage-7 risk-engine outputs (risk input boundary, hard risk, liquidity/exit, exposure, risk verdict, risk suppression, risk health), never from raw Stage-6 signals, Stage-5 intelligence, Stage-4 ingestion events, endpoints, or execution commands. A VALID boundary opens NO intent/route/order/transaction/trading readiness; eligible_for_candidate_intent marks the input shape only, and is NOT an order, route, transaction, intent, signing or send permission. Risk must be ADVISORY-PASS (risk_verdict RISK_PASS_ADVISORY + risk_health RISK_HEALTH_PASS_ADVISORY + not suppressed) to be eligible; risk BLOCKED/DEGRADED/UNCONFIGURED or suppressed -> not eligible. Raw signal/intelligence/event objects, smuggled trading/route/order/transaction/sign/send flags or commands, secrets, endpoints, and mainnet/REAL-LIVE markers are refused (raw_non_risk_input_refused / *_blocked) and never echoed.'
  });
}

export function validateIntentInputBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intentUninspectable(obj, ['purpose', ...INTENT_INPUT_COMPONENTS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...intentSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_intent_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!INTENT_INPUT_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...intentScreen(shallow));
      for (const k of INTENT_INPUT_COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (intentHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (intentHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (intentIsRawSignal(c) || intentIsRawIntelligence(c) || intentIsRawIngestionEvent(c)) reasons.push('raw_non_risk_input_refused');
      }
      if (obj.purpose !== 'intent_input_boundary') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...intentSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...intentSafeFlags()
    });
  }
}

export function evaluateIntentInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'INTENT_INPUT_INVALID'),
    intent_input_boundary_valid: (state === 'INTENT_INPUT_VALID'),
    eligible_for_candidate_intent: (state === 'INTENT_INPUT_VALID'),
    intent_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...intentSafeFlags()
  });
  try {
    const v = validateIntentInputBoundary(input);
    // unrecognized / hostile -> UNCONFIGURED
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('INTENT_INPUT_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_intent_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / raw input / bad purpose -> INVALID
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_non_risk_input_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('INTENT_INPUT_INVALID', v.reasons);
    }

    const slots = [
      ['risk_input_boundary', input.risk_input_boundary],
      ['hard_risk', input.hard_risk],
      ['liquidity_exit', input.liquidity_exit],
      ['exposure', input.exposure],
      ['risk_verdict', input.risk_verdict],
      ['risk_suppression', input.risk_suppression],
      ['risk_health', input.risk_health]
    ];

    // each PRESENT component must be a recognized read-only Stage-7 risk result;
    // an unrecognized component (or one blocked by the component screen) is not a
    // Stage-7 risk output -> refuse.
    let anyComponentInvalid = false;
    for (const [, c] of slots) {
      if (c == null) continue;
      if (intentScreenComponentResult(c).length > 0) {
        return build('INTENT_INPUT_INVALID', ['raw_non_risk_input_refused']);
      }
      const s = intentRecognizeRiskComponent(c);
      if (s === null) {
        return build('INTENT_INPUT_INVALID', ['component_not_stage7_risk']);
      }
      if (s === 'RISK_INPUT_INVALID' || s === 'HARD_RISK_INVALID' ||
          s === 'LIQUIDITY_EXIT_INVALID' || s === 'EXPOSURE_LIMIT_INVALID') {
        anyComponentInvalid = true;
      }
    }

    const verdict = input.risk_verdict;
    const health = input.risk_health;
    const suppression = input.risk_suppression;

    const verdictState = (verdict != null) ? intentRecognizeRiskComponent(verdict) : null;
    const healthState = (health != null) ? intentRecognizeRiskComponent(health) : null;

    // risk_health BLOCKED OR any component *_INVALID OR risk_verdict RISK_BLOCKED -> INVALID
    if (healthState === 'RISK_HEALTH_BLOCKED' || anyComponentInvalid || verdictState === 'RISK_BLOCKED') {
      return build('INTENT_INPUT_INVALID', ['risk_component_invalid']);
    }

    // required minimum components: risk_verdict + risk_health
    if (verdictState === null || healthState === null) {
      return build('INTENT_INPUT_UNCONFIGURED', ['required_component_missing']);
    }

    const suppressed = (suppression != null && typeof suppression === 'object' && !Array.isArray(suppression))
      ? suppression.suppressed === true : false;

    // risk not advisory-pass (blocked/degraded/unconfigured/suppressed/health not pass) -> DEGRADED (not eligible)
    if (verdictState === 'RISK_BLOCKED' || verdictState === 'RISK_DEGRADED' ||
        verdictState === 'RISK_UNCONFIGURED' || suppressed === true ||
        healthState !== 'RISK_HEALTH_PASS_ADVISORY') {
      const degraded = [];
      if (verdictState !== 'RISK_PASS_ADVISORY') degraded.push('risk_verdict_not_pass_advisory');
      if (suppressed === true) degraded.push('risk_suppressed');
      if (healthState !== 'RISK_HEALTH_PASS_ADVISORY') degraded.push('risk_health_not_pass_advisory');
      return build('INTENT_INPUT_DEGRADED', degraded.length ? degraded : ['risk_not_pass_advisory']);
    }

    // verdict RISK_PASS_ADVISORY + health RISK_HEALTH_PASS_ADVISORY + not suppressed
    // + all present components recognized read-only -> VALID (eligible)
    return build('INTENT_INPUT_VALID', []);
  } catch {
    return build('INTENT_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (D) CANDIDATE INTENT RECORD
//
// A DESCRIPTIVE, AUDITABLE record produced after a risk advisory-pass ONLY. It is
// NOT an order, route, transaction, signing permission, or send permission. It
// opens NO route_ready / transaction_ready / order_ready / signing_permitted /
// can_send. Fail-Safe: risk not advisory-pass -> REJECTED (no candidate intent);
// smuggled order/route/tx/sign/send key or forbidden flag/secret/endpoint -> INVALID.
// ---------------------------------------------------------------------------

const CANDIDATE_INTENT_STATES = Object.freeze([
  'CANDIDATE_INTENT_UNCONFIGURED', 'CANDIDATE_INTENT_INVALID',
  'CANDIDATE_INTENT_REJECTED', 'CANDIDATE_INTENT_RECORDED'
]);

const CANDIDATE_INTENT_REASON_CODES = Object.freeze([
  'risk_pass_advisory_confirmed', 'intent_input_boundary_valid',
  'candidate_recorded', 'risk_not_pass_advisory', 'intent_input_not_valid'
]);

// fields that MUST NOT appear in any candidate-intent input (order/route/tx/etc.)
const CANDIDATE_INTENT_FORBIDDEN_KEYS = Object.freeze([
  'order_id', 'route_id', 'transaction_id', 'serialized_tx', 'signature',
  'private_key', 'quote', 'jupiter_route', 'trade_size', 'slippage_config',
  'send', 'broadcast'
]);

const CANDIDATE_INTENT_COMPONENTS = Object.freeze([
  'intent_input_boundary', 'risk_verdict'
]);

function candidateIntentHasForbiddenKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (CANDIDATE_INTENT_FORBIDDEN_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

export function describeCandidateIntentRecordContract() {
  return Object.freeze({
    contract: 'candidate-intent-record',
    version: '0.0.0',
    test_only: true,
    supported_states: CANDIDATE_INTENT_STATES,
    supported_reason_codes: CANDIDATE_INTENT_REASON_CODES,
    advisory_only: true,
    candidate_intent_valid: false,
    candidate_intent_state: 'CANDIDATE_INTENT_UNCONFIGURED',
    intent_kind: 'candidate_trade_intent',
    intent_record_ref: null,
    wallet_ref: null,
    token_ref: null,
    risk_verdict_ref: null,
    signal_ref: null,
    reason_codes: Object.freeze([]),
    status: 'CANDIDATE_INTENT_UNCONFIGURED',
    reasons: Object.freeze([]),
    audit_required: true,
    ...intentSafeFlags(),
    note: 'Read-only DESCRIPTIVE candidate intent record produced after a Stage-7 risk advisory-pass ONLY (intent_input_boundary INTENT_INPUT_VALID + risk_verdict RISK_PASS_ADVISORY). A candidate intent record is an AUDITABLE REPRESENTATION ONLY — NOT an order, NOT a route, NOT a transaction, NOT a signing permission, NOT a send permission, NOT trading/route readiness. It opens NO route_ready / transaction_ready / order_ready / signing_permitted / can_send — every readiness/execution flag STAYS false; "a candidate intent exists" is carried ONLY by candidate_intent_valid / candidate_intent_state / intent_record_ref. NO order_id / route_id / transaction_id / serialized_tx / signature / quote / jupiter_route / send / broadcast field ever appears in output. Fail-Safe-Not-Fail-Open: missing input -> CANDIDATE_INTENT_UNCONFIGURED; intent_input_boundary not INTENT_INPUT_VALID OR risk_verdict not RISK_PASS_ADVISORY -> CANDIDATE_INTENT_REJECTED (no candidate intent); smuggled order/route/transaction/sign/send key or forbidden flag/secret/endpoint/mainnet -> CANDIDATE_INTENT_INVALID; valid -> CANDIDATE_INTENT_RECORDED. record_ref is a caller-supplied deterministic opaque ref, never generated and never derived from a clock.'
  });
}

export function validateCandidateIntentRecordInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intentUninspectable(obj, ['purpose', ...CANDIDATE_INTENT_COMPONENTS,
      'signal_ref', 'wallet_ref', 'token_ref', 'reason_codes', 'audit_ref', 'record_ref'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...intentSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_candidate_intent_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!CANDIDATE_INTENT_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...intentScreen(shallow));
      if (candidateIntentHasForbiddenKey(obj)) reasons.push('forbidden_execution_field_blocked');
      for (const k of CANDIDATE_INTENT_COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (intentHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (intentHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (intentHasEndpointOrMainnet(c)) reasons.push('endpoint_or_mainnet_blocked');
        if (candidateIntentHasForbiddenKey(c)) reasons.push('forbidden_execution_field_blocked');
      }
      if (obj.purpose !== 'candidate_intent_record_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...intentSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...intentSafeFlags()
    });
  }
}

export function evaluateCandidateIntentRecord(input) {
  const build = (state, fields, reasonCodes, reasons) => Object.freeze({
    candidate_intent_valid: (state === 'CANDIDATE_INTENT_RECORDED'),
    candidate_intent_state: state,
    intent_kind: 'candidate_trade_intent',
    intent_record_ref: (fields && 'intent_record_ref' in fields) ? fields.intent_record_ref : null,
    wallet_ref: (fields && 'wallet_ref' in fields) ? fields.wallet_ref : null,
    token_ref: (fields && 'token_ref' in fields) ? fields.token_ref : null,
    risk_verdict_ref: (fields && 'risk_verdict_ref' in fields) ? fields.risk_verdict_ref : null,
    signal_ref: (fields && 'signal_ref' in fields) ? fields.signal_ref : null,
    reason_codes: Object.freeze([...new Set((reasonCodes || []).filter((x) => CANDIDATE_INTENT_REASON_CODES.includes(x)))]),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    audit_required: true,
    ...intentSafeFlags()
  });
  try {
    const v = validateCandidateIntentRecordInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('CANDIDATE_INTENT_UNCONFIGURED', null, [], v.reasons.length ? v.reasons : ['no_candidate_intent_input']);
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('forbidden_execution_field_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('CANDIDATE_INTENT_INVALID', null, [], v.reasons);
    }

    const boundary = input.intent_input_boundary;
    const verdict = input.risk_verdict;

    const boundaryState = intentRecognizeRiskComponentBoundary(boundary);
    const verdictState = (verdict != null) ? intentRecognizeRiskComponent(verdict) : null;

    // missing required component -> UNCONFIGURED
    if (boundaryState === null || verdictState === null) {
      return build('CANDIDATE_INTENT_UNCONFIGURED', null, [], ['required_component_missing']);
    }

    // risk not advisory-pass -> REJECTED (no candidate intent)
    const rejected = [];
    if (boundaryState !== 'INTENT_INPUT_VALID') rejected.push('intent_input_not_valid');
    if (verdictState !== 'RISK_PASS_ADVISORY') rejected.push('risk_not_pass_advisory');
    if (rejected.length > 0) {
      return build('CANDIDATE_INTENT_REJECTED', null, rejected, rejected);
    }

    // RECORDED: descriptive auditable record (opaque refs only). NOT an order/route/tx.
    const fields = {
      intent_record_ref: (typeof input.record_ref === 'string') ? input.record_ref : null,
      wallet_ref: (typeof input.wallet_ref === 'string') ? input.wallet_ref : null,
      token_ref: (typeof input.token_ref === 'string') ? input.token_ref : null,
      risk_verdict_ref: (typeof input.risk_verdict_ref === 'string') ? input.risk_verdict_ref : null,
      signal_ref: (typeof input.signal_ref === 'string') ? input.signal_ref : null
    };
    return build('CANDIDATE_INTENT_RECORDED', fields,
      ['risk_pass_advisory_confirmed', 'intent_input_boundary_valid', 'candidate_recorded'],
      []);
  } catch {
    return build('CANDIDATE_INTENT_UNCONFIGURED', null, [], ['input_inspection_error']);
  }
}

// Recognize an intent-input-boundary RESULT (Stage-8 (C) output) by its dedicated
// state field — read-only required. Returns the boundary state, or null.
function intentRecognizeRiskComponentBoundary(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.intent_input_state === 'string' && INTENT_INPUT_STATES.includes(o.intent_input_state)) {
    return o.intent_input_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (E) INTENT LEDGER APPEND / EVALUATE
//
// Append-only ledger SEMANTICS evaluated PURELY / IN-MEMORY ONLY. previous_records
// is passed in as a function argument — NEVER stored in any module/global state.
// NO persistence, NO db, NO network, NO send/broadcast — these are asserted false
// in output and never performed. Append opens NO routing/signing/send/broadcast.
// ---------------------------------------------------------------------------

const INTENT_LEDGER_STATES = Object.freeze([
  'INTENT_LEDGER_UNCONFIGURED', 'INTENT_LEDGER_INVALID',
  'INTENT_LEDGER_DUPLICATE', 'INTENT_LEDGER_APPEND_EVALUATED'
]);

const INTENT_LEDGER_COMPONENTS = Object.freeze([
  'previous_records', 'candidate_intent_record'
]);

export function describeIntentLedgerContract() {
  return Object.freeze({
    contract: 'intent-ledger-append',
    version: '0.0.0',
    test_only: true,
    supported_states: INTENT_LEDGER_STATES,
    advisory_only: true,
    append_valid: false,
    ledger_state: 'INTENT_LEDGER_UNCONFIGURED',
    ledger_record_count: 0,
    appended_record_ref: null,
    duplicate_record_detected: false,
    audit_required: true,
    persistence_performed: false,
    status: 'INTENT_LEDGER_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...intentSafeFlags(),
    note: 'Read-only append-only ledger SEMANTICS evaluated PURELY / IN-MEMORY ONLY. previous_records is passed in as a function argument and is NEVER stored in any module/global state — this module holds NO mutable ledger array. NO persistence, NO db, NO network, NO send, NO broadcast: persistence_performed is asserted false and never performed. Fail-Safe-Not-Fail-Open: previous_records not an array OR missing candidate_intent_record -> INTENT_LEDGER_UNCONFIGURED; candidate_intent_record not CANDIDATE_INTENT_RECORDED -> INTENT_LEDGER_INVALID (append refused); a previous record with the same intent_record_ref -> INTENT_LEDGER_DUPLICATE (duplicate_record_detected:true, append refused, count unchanged); otherwise INTENT_LEDGER_APPEND_EVALUATED (evaluated in-memory only). ledger_record_count = previous_records length + (appended ? 1 : 0). Append opens NO routing / signing / send / broadcast — every readiness/execution flag STAYS false.'
  });
}

export function validateIntentLedgerAppend(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intentUninspectable(obj, ['purpose', ...INTENT_LEDGER_COMPONENTS, 'append_ref'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...intentSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_intent_ledger_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!INTENT_LEDGER_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...intentScreen(shallow));
      const cir = obj.candidate_intent_record;
      if (cir != null && typeof cir === 'object') {
        if (intentHasForbiddenTrueFlag(cir)) reasons.push('forbidden_trading_indicator_blocked');
        if (intentHasExecCmdKey(cir)) reasons.push('execution_command_blocked');
        if (intentHasEndpointOrMainnet(cir)) reasons.push('endpoint_or_mainnet_blocked');
      }
      if (obj.purpose !== 'intent_ledger_append_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...intentSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...intentSafeFlags()
    });
  }
}

export function evaluateIntentLedgerAppend(input) {
  const build = (state, count, appendedRef, duplicate, reasons) => Object.freeze({
    append_valid: (state === 'INTENT_LEDGER_APPEND_EVALUATED'),
    ledger_state: state,
    ledger_record_count: count,
    appended_record_ref: appendedRef,
    duplicate_record_detected: duplicate,
    audit_required: true,
    persistence_performed: false,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...intentSafeFlags()
  });
  try {
    const v = validateIntentLedgerAppend(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('INTENT_LEDGER_UNCONFIGURED', 0, null, false, v.reasons.length ? v.reasons : ['no_intent_ledger_input']);
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('INTENT_LEDGER_INVALID', 0, null, false, v.reasons);
    }

    const previous = input.previous_records;
    const cir = input.candidate_intent_record;

    // previous_records must be an array; candidate_intent_record must be present
    if (!Array.isArray(previous) || cir == null || typeof cir !== 'object' || Array.isArray(cir)) {
      return build('INTENT_LEDGER_UNCONFIGURED', 0, null, false, ['ledger_input_incomplete']);
    }
    const prevCount = previous.length;

    // candidate_intent_record must be a CANDIDATE_INTENT_RECORDED result
    if (cir.candidate_intent_state !== 'CANDIDATE_INTENT_RECORDED' || cir.candidate_intent_valid !== true) {
      return build('INTENT_LEDGER_INVALID', prevCount, null, false, ['candidate_intent_not_recorded']);
    }

    const ref = (typeof cir.intent_record_ref === 'string') ? cir.intent_record_ref : null;

    // duplicate detection by intent_record_ref over the passed array (no module state)
    if (ref !== null) {
      for (const rec of previous) {
        if (rec != null && typeof rec === 'object' && rec.intent_record_ref === ref) {
          return build('INTENT_LEDGER_DUPLICATE', prevCount, null, true, ['duplicate_record_detected']);
        }
      }
    }

    // evaluate the append IN-MEMORY ONLY (count derived from passed array; no push)
    return build('INTENT_LEDGER_APPEND_EVALUATED', prevCount + 1, ref, false, ['append_evaluated_in_memory']);
  } catch {
    return build('INTENT_LEDGER_UNCONFIGURED', 0, null, false, ['input_inspection_error']);
  }
}

// Recognize a candidate-intent-record RESULT (Stage-8 (D) output) by its dedicated
// state field — read-only required. Returns the candidate intent state, or null.
function intentRecognizeCandidateRecord(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.candidate_intent_state === 'string' && CANDIDATE_INTENT_STATES.includes(o.candidate_intent_state)) {
    return o.candidate_intent_state;
  }
  return null;
}

// Recognize a risk-verdict RESULT by its dedicated state field — read-only
// required. Returns the verdict state, or null.
function intentRecognizeRiskVerdict(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.risk_verdict_state === 'string' && INTENT_RISK_VERDICT_STATES.includes(o.risk_verdict_state)) {
    return o.risk_verdict_state;
  }
  return null;
}

// Recognize an intent-audit-envelope RESULT (Stage-8 (G) output) by its dedicated
// state field — read-only required. Returns the audit state, or null.
function intentRecognizeAuditEnvelope(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.audit_state === 'string' && INTENT_AUDIT_STATES.includes(o.audit_state)) {
    return o.audit_state;
  }
  return null;
}

// Recognize a ledger-append RESULT (Stage-8 (E) output) by its dedicated state
// field — read-only required. Returns the ledger state, or null.
function intentRecognizeLedgerAppend(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.ledger_state === 'string' && INTENT_LEDGER_STATES.includes(o.ledger_state)) {
    return o.ledger_state;
  }
  return null;
}

// Recognize an intent-state-machine RESULT (Stage-8 (F) output) by its dedicated
// state field — read-only required. Returns the intent state, or null.
function intentRecognizeStateMachine(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.intent_state === 'string' && INTENT_STATE_MACHINE_STATES.includes(o.intent_state)) {
    return o.intent_state;
  }
  return null;
}

// Recognize an intent-input-boundary RESULT by its dedicated state field.
function intentRecognizeInputBoundaryResult(o) {
  return intentRecognizeRiskComponentBoundary(o);
}

// ---------------------------------------------------------------------------
// (F) INTENT STATE MACHINE
//
// Evaluates the STATE for a candidate intent WITHOUT execution. An intent state is
// an AUDITABLE REPRESENTATION ONLY — NOT an order/route/transaction/sign/send
// permission. CRITICAL: INTENT_AWAITING_ROUTE_REVIEW does NOT mean a route is
// ready or executed — it ONLY records that a later stage (Stage 9) MAY review a
// route; it keeps every readiness/execution flag false. Fail-Safe-Not-Fail-Open:
// missing input -> UNCONFIGURED; smuggled forbidden flag/exec cmd/secret/endpoint
// -> BLOCKED; candidate not RECORDED -> REJECTED (or SUPPRESSED if suppression).
// ---------------------------------------------------------------------------

const INTENT_STATE_MACHINE_STATES = Object.freeze([
  'INTENT_UNCONFIGURED', 'INTENT_CANDIDATE_RECORDED', 'INTENT_REJECTED',
  'INTENT_SUPPRESSED', 'INTENT_BLOCKED', 'INTENT_AWAITING_ROUTE_REVIEW'
]);

const INTENT_STATE_TRANSITIONS = Object.freeze([
  'record', 'reject', 'suppress', 'request_route_review'
]);

const INTENT_STATE_MACHINE_TOP_KEYS = Object.freeze([
  'purpose', 'candidate_intent_record', 'requested_transition',
  'suppression', 'rejection_reason'
]);

export function describeIntentStateMachineContract() {
  return Object.freeze({
    contract: 'intent-state-machine',
    version: '0.0.0',
    test_only: true,
    supported_states: INTENT_STATE_MACHINE_STATES,
    supported_transitions: INTENT_STATE_TRANSITIONS,
    advisory_only: true,
    valid: false,
    intent_state: 'INTENT_UNCONFIGURED',
    awaiting_route_review: false,
    status: 'INTENT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...intentSafeFlags(),
    note: 'Read-only intent STATE MACHINE. Evaluates the state for a candidate intent record WITHOUT execution. An intent state is an AUDITABLE REPRESENTATION ONLY — NOT an order, NOT a route, NOT a transaction, NOT a signing permission, NOT a send permission, NOT trading/route readiness. CRITICAL: INTENT_AWAITING_ROUTE_REVIEW does NOT mean a route is ready or executed — it ONLY records that a later stage (Stage 9) MAY review a route; routing_ready / route_ready / order_ready / transaction_ready / can_send / signing_permitted STAY false in EVERY state. Transitions: missing input -> INTENT_UNCONFIGURED; invalid input / smuggled forbidden flag, execution command, secret, or endpoint -> INTENT_BLOCKED; candidate_intent_record not CANDIDATE_INTENT_RECORDED -> INTENT_REJECTED (or INTENT_SUPPRESSED if suppression indicates); valid candidate + no transition or "record" -> INTENT_CANDIDATE_RECORDED; rejection_reason present / requested "reject" -> INTENT_REJECTED; suppression.suppressed / requested "suppress" -> INTENT_SUPPRESSED; requested "request_route_review" on a valid recorded candidate -> INTENT_AWAITING_ROUTE_REVIEW. Hostile/throwing/uninspectable input -> frozen INTENT_UNCONFIGURED, never throws.'
  });
}

export function evaluateIntentStateTransition(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'INTENT_BLOCKED'),
    intent_state: state,
    awaiting_route_review: (state === 'INTENT_AWAITING_ROUTE_REVIEW'),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...intentSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intentUninspectable(obj, [...INTENT_STATE_MACHINE_TOP_KEYS])) {
      return build('INTENT_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('INTENT_UNCONFIGURED', ['no_intent_state_input']);
    }

    // screen top-level shape (excluding nested component slots) for smuggled
    // forbidden flag / exec cmd / secret / endpoint / mainnet
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'candidate_intent_record' && k !== 'suppression') shallow[k] = v;
    }
    const screen = intentScreen(shallow);
    // also screen the nested components for forbidden flags / exec cmds / endpoints
    for (const slot of ['candidate_intent_record', 'suppression']) {
      const c = obj[slot];
      if (c != null && typeof c === 'object') {
        if (intentHasForbiddenTrueFlag(c)) screen.push('forbidden_trading_indicator_blocked');
        if (intentHasExecCmdKey(c)) screen.push('execution_command_blocked');
        if (intentHasEndpointOrMainnet(c)) screen.push('endpoint_or_mainnet_blocked');
      }
    }
    if (obj.purpose !== 'intent_state_input') screen.push('purpose_invalid');
    if (screen.length > 0) {
      return build('INTENT_BLOCKED', screen);
    }

    const requested = (typeof obj.requested_transition === 'string') ? obj.requested_transition : null;
    if (requested !== null && !INTENT_STATE_TRANSITIONS.includes(requested)) {
      return build('INTENT_BLOCKED', ['transition_not_allowed']);
    }

    const cir = obj.candidate_intent_record;
    const suppression = obj.suppression;
    const suppressionIndicated = (suppression != null && typeof suppression === 'object' && !Array.isArray(suppression))
      ? suppression.suppressed === true : false;

    // missing candidate -> UNCONFIGURED
    if (cir == null) {
      return build('INTENT_UNCONFIGURED', ['candidate_intent_record_missing']);
    }
    const candidateState = intentRecognizeCandidateRecord(cir);
    if (candidateState === null) {
      return build('INTENT_UNCONFIGURED', ['candidate_intent_record_unrecognized']);
    }

    // candidate not RECORDED -> REJECTED (or SUPPRESSED if suppression indicates)
    if (candidateState !== 'CANDIDATE_INTENT_RECORDED' || cir.candidate_intent_valid !== true) {
      if (suppressionIndicated || requested === 'suppress') {
        return build('INTENT_SUPPRESSED', ['candidate_intent_not_recorded', 'suppressed']);
      }
      return build('INTENT_REJECTED', ['candidate_intent_not_recorded']);
    }

    // valid recorded candidate. Resolve transition.
    const rejectionReason = (typeof obj.rejection_reason === 'string' && obj.rejection_reason.length > 0)
      ? obj.rejection_reason : null;

    if (requested === 'reject' || rejectionReason !== null) {
      return build('INTENT_REJECTED', ['intent_rejected']);
    }
    if (requested === 'suppress' || suppressionIndicated) {
      return build('INTENT_SUPPRESSED', ['intent_suppressed']);
    }
    if (requested === 'request_route_review') {
      // CRITICAL: awaiting route review keeps ALL 20 flags false; route NOT ready.
      return build('INTENT_AWAITING_ROUTE_REVIEW', ['route_review_requested_stage9_pending']);
    }
    // no transition or 'record' -> CANDIDATE_RECORDED
    return build('INTENT_CANDIDATE_RECORDED', ['candidate_recorded']);
  } catch {
    return build('INTENT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (G) INTENT AUDIT ENVELOPE
//
// Every candidate intent must be auditable, WITHOUT secrets. The audit envelope
// carries ONLY opaque refs + fixed reason codes + state — NO secret/private-key/
// seed/signer-credential/auth-token/endpoint material. Fail-Safe-Not-Fail-Open:
// missing audit input -> UNCONFIGURED; missing reason_codes/decision_ref/refs ->
// INVALID (no hidden decision, no missing reason); any secret/endpoint/mainnet or
// smuggled execution flag -> INVALID and NEVER echoed.
// ---------------------------------------------------------------------------

const INTENT_AUDIT_STATES = Object.freeze([
  'INTENT_AUDIT_UNCONFIGURED', 'INTENT_AUDIT_INVALID', 'INTENT_AUDIT_VALID'
]);

const INTENT_AUDIT_TOP_KEYS = Object.freeze([
  'purpose', 'intent_record_ref', 'actor_ref', 'decision_ref', 'risk_verdict_ref',
  'signal_ref', 'reason_codes', 'audit_required', 'no_secret_material',
  'no_private_key_material', 'no_execution_authority'
]);

// audit attestation booleans that are allowed to be true (NOT forbidden flags)
const INTENT_AUDIT_ATTESTATION_KEYS = Object.freeze([
  'no_secret_material', 'no_private_key_material', 'no_execution_authority', 'audit_required'
]);

export function describeIntentAuditEnvelopeContract() {
  return Object.freeze({
    contract: 'intent-audit-envelope',
    version: '0.0.0',
    test_only: true,
    supported_states: INTENT_AUDIT_STATES,
    advisory_only: true,
    intent_audit_valid: false,
    audit_state: 'INTENT_AUDIT_UNCONFIGURED',
    audit_required: true,
    audit_complete: false,
    status: 'INTENT_AUDIT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...intentSafeFlags(),
    note: 'Read-only INTENT AUDIT ENVELOPE. Every candidate intent must be auditable, WITHOUT secrets. The audit envelope carries ONLY opaque refs (intent_record_ref / actor_ref / decision_ref / risk_verdict_ref / signal_ref) + fixed reason codes + state — NO private_key / seed / signer_credential / auth_token / endpoint / raw_wallet_secret material ever appears in output, and any such material is refused and NEVER echoed. An audit envelope is an AUDITABLE REPRESENTATION ONLY — it confers NO order/route/transaction/signing/send permission; every readiness/execution flag STAYS false. Fail-Safe-Not-Fail-Open: missing audit input -> INTENT_AUDIT_UNCONFIGURED; missing reason_codes -> INTENT_AUDIT_INVALID [audit_reason_missing]; missing decision_ref -> INTENT_AUDIT_INVALID [audit_decision_missing]; missing intent_record_ref/actor_ref -> INTENT_AUDIT_INVALID [audit_ref_missing] (no hidden decision, no missing reason); any secret/private-key/seed/signer-credential/auth-token/endpoint/mainnet material or smuggled execution/forbidden flag -> INTENT_AUDIT_INVALID; complete + clean -> INTENT_AUDIT_VALID.'
  });
}

export function validateIntentAuditEnvelope(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intentUninspectable(obj, [...INTENT_AUDIT_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...intentSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_intent_audit_input');
    } else {
      recognized = true;
      reasons.push(...intentScreen(obj));
      if (obj.purpose !== 'intent_audit_envelope_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...intentSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...intentSafeFlags()
    });
  }
}

export function evaluateIntentAuditEnvelope(input) {
  const build = (state, reasons) => Object.freeze({
    intent_audit_valid: (state === 'INTENT_AUDIT_VALID'),
    audit_state: state,
    audit_required: true,
    audit_complete: (state === 'INTENT_AUDIT_VALID'),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...intentSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intentUninspectable(obj, [...INTENT_AUDIT_TOP_KEYS])) {
      return build('INTENT_AUDIT_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('INTENT_AUDIT_UNCONFIGURED', ['no_intent_audit_input']);
    }

    const v = validateIntentAuditEnvelope(obj);
    // secret / endpoint / mainnet / forbidden flag / exec cmd -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked')) {
      return build('INTENT_AUDIT_INVALID', ['audit_forbidden_material_blocked']);
    }
    if (v.reasons.includes('purpose_invalid')) {
      return build('INTENT_AUDIT_INVALID', ['audit_purpose_invalid']);
    }

    // required completeness: reason_codes, decision_ref, intent_record_ref + actor_ref
    const invalid = [];
    const reasonCodes = obj.reason_codes;
    if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) invalid.push('audit_reason_missing');
    if (typeof obj.decision_ref !== 'string' || obj.decision_ref.length === 0) invalid.push('audit_decision_missing');
    if (typeof obj.intent_record_ref !== 'string' || obj.intent_record_ref.length === 0 ||
        typeof obj.actor_ref !== 'string' || obj.actor_ref.length === 0) invalid.push('audit_ref_missing');
    if (invalid.length > 0) {
      return build('INTENT_AUDIT_INVALID', invalid);
    }

    // complete + clean -> VALID (opaque refs + fixed codes + state ONLY)
    return build('INTENT_AUDIT_VALID', ['audit_complete']);
  } catch {
    return build('INTENT_AUDIT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (H) INTENT SUPPRESSION / REJECTION
//
// Prevents an intent from progressing; REASONS ONLY. Creates NO route/order. An
// advisory-valid intent (candidate recorded + risk pass + audit valid + not
// duplicate) is STILL suppressed for routing/sign/send (route_not_reviewed + the
// not_*_authorized reasons) — it never progresses to routing/sign/send at this
// layer. CRITICAL: suppression opens NO routing_ready / route_ready /
// signing_permitted / can_send.
// ---------------------------------------------------------------------------

const INTENT_SUPPRESSION_REASON_ALLOWLIST = Object.freeze([
  'risk_not_passed', 'audit_missing', 'candidate_intent_invalid',
  'duplicate_intent_record', 'route_not_reviewed', 'not_route_authorized',
  'not_order_authorized', 'not_sign_authorized', 'not_send_authorized',
  'not_execution_authorized'
]);

// the not_*_authorized reasons ALWAYS attached whenever suppression is emitted:
// an intent is never route/order/sign/send/execution authorized at this layer.
const INTENT_NOT_AUTHORIZED_REASONS = Object.freeze([
  'not_route_authorized', 'not_order_authorized', 'not_sign_authorized',
  'not_send_authorized', 'not_execution_authorized'
]);

const INTENT_SUPPRESSION_TOP_KEYS = Object.freeze([
  'purpose', 'candidate_intent_record', 'risk_verdict', 'audit', 'ledger_append',
  'route_reviewed'
]);

const INTENT_SUPPRESSION_COMPONENTS = Object.freeze([
  'candidate_intent_record', 'risk_verdict', 'audit', 'ledger_append'
]);

export function describeIntentSuppressionContract() {
  return Object.freeze({
    contract: 'intent-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: INTENT_SUPPRESSION_REASON_ALLOWLIST,
    advisory_only: true,
    suppressed: true,
    suppression_reasons: INTENT_NOT_AUTHORIZED_REASONS,
    status: 'INTENT_SUPPRESSED',
    reasons: Object.freeze([]),
    ...intentSafeFlags(),
    note: 'Read-only INTENT SUPPRESSION / REJECTION. Prevents an intent from progressing; REASONS ONLY. Creates NO route, NO order, NO transaction, NO signing, NO send. suppression_reasons is drawn ONLY from a fixed allowlist (risk_not_passed, audit_missing, candidate_intent_invalid, duplicate_intent_record, route_not_reviewed, not_route_authorized, not_order_authorized, not_sign_authorized, not_send_authorized, not_execution_authorized). The not_route_authorized + not_order_authorized + not_sign_authorized + not_send_authorized + not_execution_authorized reasons are ALWAYS attached when suppression is emitted — an intent is never route/order/sign/send/execution authorized at this layer. Rules: missing candidate -> suppressed + candidate_intent_invalid; candidate not CANDIDATE_INTENT_RECORDED -> candidate_intent_invalid; risk_verdict not RISK_PASS_ADVISORY -> risk_not_passed; audit not INTENT_AUDIT_VALID -> audit_missing; ledger_append INTENT_LEDGER_DUPLICATE -> duplicate_intent_record; route_reviewed !== true -> route_not_reviewed (Stage 9 not done yet). An advisory-valid intent (candidate recorded + risk pass + audit valid + not duplicate) is STILL suppressed for routing/sign/send. CRITICAL: suppression opens NO routing_ready / route_ready / signing_permitted / can_send — every readiness/execution flag STAYS false.'
  });
}

export function evaluateIntentSuppression(input) {
  const build = (suppressed, suppressionReasons, reasons) => Object.freeze({
    suppressed,
    suppression_reasons: Object.freeze([...new Set((suppressionReasons || []).filter((x) => INTENT_SUPPRESSION_REASON_ALLOWLIST.includes(x)))]),
    status: suppressed ? 'INTENT_SUPPRESSED' : 'INTENT_NOT_SUPPRESSED',
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...intentSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intentUninspectable(obj, [...INTENT_SUPPRESSION_TOP_KEYS])) {
      // fail closed: suppressed with the not_*_authorized reasons
      return build(true, [...INTENT_NOT_AUTHORIZED_REASONS], ['input_inspection_error']);
    }
    if (!obj) {
      return build(true, ['candidate_intent_invalid', ...INTENT_NOT_AUTHORIZED_REASONS], ['no_intent_suppression_input']);
    }

    // screen for smuggled forbidden flag / exec cmd / secret / endpoint -> fail closed
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!INTENT_SUPPRESSION_COMPONENTS.includes(k)) shallow[k] = v;
    }
    const screen = intentScreen(shallow);
    for (const slot of INTENT_SUPPRESSION_COMPONENTS) {
      const c = obj[slot];
      if (c != null && typeof c === 'object') {
        if (intentHasForbiddenTrueFlag(c)) screen.push('forbidden_trading_indicator_blocked');
        if (intentHasExecCmdKey(c)) screen.push('execution_command_blocked');
        if (intentHasEndpointOrMainnet(c)) screen.push('endpoint_or_mainnet_blocked');
      }
    }
    if (screen.length > 0) {
      return build(true, [...INTENT_NOT_AUTHORIZED_REASONS], ['suppression_input_blocked']);
    }

    const suppressionReasons = [];

    // candidate intent must be CANDIDATE_INTENT_RECORDED
    const cir = obj.candidate_intent_record;
    const candidateState = intentRecognizeCandidateRecord(cir);
    if (candidateState === null || candidateState !== 'CANDIDATE_INTENT_RECORDED' || cir.candidate_intent_valid !== true) {
      suppressionReasons.push('candidate_intent_invalid');
    }

    // risk_verdict must be RISK_PASS_ADVISORY
    const verdictState = intentRecognizeRiskVerdict(obj.risk_verdict);
    if (verdictState !== 'RISK_PASS_ADVISORY') {
      suppressionReasons.push('risk_not_passed');
    }

    // audit must be INTENT_AUDIT_VALID
    const auditState = intentRecognizeAuditEnvelope(obj.audit);
    if (auditState !== 'INTENT_AUDIT_VALID') {
      suppressionReasons.push('audit_missing');
    }

    // ledger_append duplicate -> suppressed
    const ledgerState = intentRecognizeLedgerAppend(obj.ledger_append);
    if (ledgerState === 'INTENT_LEDGER_DUPLICATE') {
      suppressionReasons.push('duplicate_intent_record');
    }

    // route not reviewed (Stage 9 not done yet)
    if (obj.route_reviewed !== true) {
      suppressionReasons.push('route_not_reviewed');
    }

    // ALWAYS attach the not_*_authorized reasons (never authorized at this layer)
    suppressionReasons.push(...INTENT_NOT_AUTHORIZED_REASONS);

    // suppression is ALWAYS emitted at this layer (intent never progresses to
    // routing/sign/send here) -> suppressed is always true.
    return build(true, suppressionReasons, ['intent_suppressed_at_intent_layer']);
  } catch {
    return build(true, [...INTENT_NOT_AUTHORIZED_REASONS], ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (I) INTENT HEALTH / STATUS
//
// Consumes the intent input boundary + candidate intent + ledger append + state
// machine + audit + suppression, and derives a STATUS ONLY. CRITICAL: every state
// keeps all 20 flags false; INTENT_HEALTH_AWAITING_ROUTE_REVIEW does NOT open
// routing/route/transaction/can_send. Ordering: smuggled forbidden flag / secret /
// mainnet / REAL-LIVE / invalid boundary / invalid audit -> BLOCKED; missing
// required component -> UNCONFIGURED; suppressed -> SUPPRESSED; awaiting route
// review -> AWAITING_ROUTE_REVIEW; candidate recorded + audit valid + not
// suppressed -> CANDIDATE_RECORDED; else -> DEGRADED.
// ---------------------------------------------------------------------------

const INTENT_HEALTH_STATES = Object.freeze([
  'INTENT_HEALTH_UNCONFIGURED', 'INTENT_HEALTH_DEGRADED',
  'INTENT_HEALTH_CANDIDATE_RECORDED', 'INTENT_HEALTH_AWAITING_ROUTE_REVIEW',
  'INTENT_HEALTH_SUPPRESSED', 'INTENT_HEALTH_BLOCKED'
]);

const INTENT_HEALTH_COMPONENTS = Object.freeze([
  'intent_input_boundary', 'candidate_intent_record', 'ledger_append',
  'intent_state', 'audit', 'suppression'
]);

export function describeIntentHealthContract() {
  return Object.freeze({
    contract: 'intent-health',
    version: '0.0.0',
    test_only: true,
    supported_states: INTENT_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    intent_health_state: 'INTENT_HEALTH_UNCONFIGURED',
    status: 'INTENT_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...intentSafeFlags(),
    note: 'Read-only INTENT HEALTH / STATUS. Consumes the intent input boundary + candidate intent record + ledger append + intent state machine + audit envelope + suppression and derives a STATUS ONLY — it confers NO order/route/transaction/signing/send permission. CRITICAL: every state keeps all 20 readiness/execution flags false; INTENT_HEALTH_AWAITING_ROUTE_REVIEW does NOT open routing_ready / route_ready / transaction_ready / can_send. Ordering: smuggled forbidden trading flag (top-level or any component) / secret / mainnet / REAL-LIVE / invalid intent_input_boundary (INTENT_INPUT_INVALID) / invalid audit (INTENT_AUDIT_INVALID) -> INTENT_HEALTH_BLOCKED; missing required component -> INTENT_HEALTH_UNCONFIGURED; suppression.suppressed === true -> INTENT_HEALTH_SUPPRESSED; intent_state INTENT_AWAITING_ROUTE_REVIEW -> INTENT_HEALTH_AWAITING_ROUTE_REVIEW (routing still false); intent_state INTENT_CANDIDATE_RECORDED + audit valid + not suppressed -> INTENT_HEALTH_CANDIDATE_RECORDED; else INTENT_HEALTH_DEGRADED. Hostile/throwing input -> frozen INTENT_HEALTH_UNCONFIGURED, never throws.'
  });
}

export function evaluateIntentHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'INTENT_HEALTH_BLOCKED'),
    intent_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...intentSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (intentUninspectable(obj, [...INTENT_HEALTH_COMPONENTS])) {
      return build('INTENT_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('INTENT_HEALTH_UNCONFIGURED', ['no_intent_health_input']);
    }

    // screen top-level + every component for smuggled forbidden flag / exec cmd /
    // secret / endpoint / mainnet -> BLOCKED
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!INTENT_HEALTH_COMPONENTS.includes(k)) shallow[k] = v;
    }
    const blocked = intentScreen(shallow);
    for (const slot of INTENT_HEALTH_COMPONENTS) {
      const c = obj[slot];
      if (c != null && typeof c === 'object') {
        if (intentHasForbiddenTrueFlag(c)) blocked.push('forbidden_trading_indicator_blocked');
        if (intentHasExecCmdKey(c)) blocked.push('execution_command_blocked');
        if (intentHasEndpointOrMainnet(c)) blocked.push('endpoint_or_mainnet_blocked');
      }
    }

    const boundary = obj.intent_input_boundary;
    const candidate = obj.candidate_intent_record;
    const ledger = obj.ledger_append;
    const stateMachine = obj.intent_state;
    const audit = obj.audit;
    const suppression = obj.suppression;

    const boundaryState = intentRecognizeInputBoundaryResult(boundary);
    const auditState = intentRecognizeAuditEnvelope(audit);

    // invalid boundary / invalid audit -> BLOCKED
    if (boundaryState === 'INTENT_INPUT_INVALID') blocked.push('intent_input_boundary_invalid');
    if (auditState === 'INTENT_AUDIT_INVALID') blocked.push('intent_audit_invalid');
    if (blocked.length > 0) {
      return build('INTENT_HEALTH_BLOCKED', blocked);
    }

    // missing required component -> UNCONFIGURED
    const candidateState = intentRecognizeCandidateRecord(candidate);
    const intentState = intentRecognizeStateMachine(stateMachine);
    if (boundaryState === null || candidateState === null || intentState === null ||
        auditState === null || suppression == null || typeof suppression !== 'object' || Array.isArray(suppression)) {
      return build('INTENT_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }
    // ledger_append, when present, must be a recognized result
    if (ledger != null && intentRecognizeLedgerAppend(ledger) === null) {
      return build('INTENT_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    const suppressed = suppression.suppressed === true;

    // suppressed -> SUPPRESSED
    if (suppressed) {
      return build('INTENT_HEALTH_SUPPRESSED', ['intent_suppressed']);
    }

    // awaiting route review -> AWAITING_ROUTE_REVIEW (routing still false)
    if (intentState === 'INTENT_AWAITING_ROUTE_REVIEW') {
      return build('INTENT_HEALTH_AWAITING_ROUTE_REVIEW', ['route_review_pending_routing_not_ready']);
    }

    // candidate recorded + audit valid + not suppressed -> CANDIDATE_RECORDED
    if (intentState === 'INTENT_CANDIDATE_RECORDED' &&
        candidateState === 'CANDIDATE_INTENT_RECORDED' &&
        auditState === 'INTENT_AUDIT_VALID') {
      return build('INTENT_HEALTH_CANDIDATE_RECORDED', ['candidate_recorded_audit_valid']);
    }

    // else -> DEGRADED
    return build('INTENT_HEALTH_DEGRADED', ['intent_health_degraded']);
  } catch {
    return build('INTENT_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
