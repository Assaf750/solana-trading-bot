// @soltrade/transaction-build-review-foundations
//
// Read-only / advisory ONLY TRANSACTION-BUILD-REVIEW FOUNDATION for Stage-10 of
// the architecture pipeline `data -> signal -> risk -> intent -> route -> sign ->
// send`. This package builds ONLY the read-only/advisory 'transaction-build
// review' foundation, consuming Stage-9 route / execution-plan-preview outputs.
// Import-free, pure, deterministic. No network primitive, no live stream, no
// live quote, no aggregator/Jupiter/RPC route call, NO transaction build, NO
// serialization, NO message bytes, NO signing, NO send, no system clock, no
// persistence, no secrets, no mutable module/global state.
//
// THE CORE RULE: a transaction-build review/descriptor is a READ-ONLY ADVISORY
// REPRESENTATION ONLY — NOT a transaction, NOT a serialized transaction, NOT
// message bytes, NOT a signing permission, NOT a send permission, NOT
// transaction/trading readiness. transaction_ready / serialized_ready /
// message_bytes_ready / signing_permitted / can_serialize / can_send (and every
// other readiness/execution flag) ALL STAY false on every result — a tx-build
// review NEVER flips any readiness/execution/serialization flag. "Input valid /
// source valid / descriptor exists" is carried ONLY by dedicated fields
// (tx_build_input_boundary_valid / eligible_for_tx_build_review /
// tx_build_source_valid / candidate_tx_build_descriptor_valid /
// candidate_tx_build_state), never by a readiness flag. Hostile, throwing, or
// uninspectable input returns a FROZEN refusal with reason
// 'input_inspection_error' and NEVER throws. Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package adds NO name to docs/01-SSOT.md. The source tags
// solana_tx_builder_disabled / jupiter_tx_builder_disabled are LOCAL disabled
// markers (NOT SDK/builder calls); they NEVER build a transaction or call a
// builder. Field names like transaction / serialized_tx / message_bytes /
// signature / blockhash / feePayer appear ONLY as fixed string literals inside
// refusal / forbidden-key allowlist arrays and prose — never as real objects,
// calls, or emitted output keys.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function txSafeFlags() {
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
    serialized_ready: false,
    message_bytes_ready: false,
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

// the 23 non-read_only flags above (includes serialized_ready / message_bytes_
// ready) — none may EVER be true on input or output; a tx-build review NEVER
// flips any.
const TX_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'can_send',
  'can_broadcast', 'can_serialize', 'signing_permitted', 'broadcast_permitted',
  'is_live', 'mainnet_enabled', 'real_live'
]);

const TX_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'order', 'place_order', 'build_tx', 'build_transaction', 'serialize',
  'serialize_tx', 'sign_tx', 'send_tx', 'broadcast_tx', 'quote',
  'jupiter_route', 'aggregator_quote', 'route_execute'
]);

const TX_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential/i;
const TX_URL_RE = /https?:\/\/|wss?:\/\//i;
const TX_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan (their values are
// still scanned for URL/secret/mainnet substrings). NOTE: a bare 'token' SECRET
// key is still flagged by value.
const TX_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'preview_ref', 'route_plan_ref', 'intent_record_ref',
  'tx_build_review_ref', 'tx_build_source', 'account_count_bucket',
  'instruction_count_bucket', 'compute_unit_bucket', 'transaction_size_bucket',
  'lookup_table_bucket', 'priority_fee_bucket'
]);

function txHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of TX_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function txHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (TX_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function txHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (TX_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (TX_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function txHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (TX_URL_RE.test(v) || TX_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function txScreen(o) {
  const r = [];
  if (txHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (txHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (txHasSecretField(o)) r.push('secret_field_blocked');
  if (txHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function txUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Stage-9 route-output recognizers. Tx-build-review input comes ONLY from
// Stage-9 route outputs, each of which carries read_only:true. Raw Stage-8
// intent / Stage-7 risk / Stage-6 signal / Stage-5 intelligence / Stage-4
// ingestion objects are REFUSED.
// ---------------------------------------------------------------------------

const TX_ROUTE_INPUT_STATES = Object.freeze([
  'ROUTE_INPUT_UNCONFIGURED', 'ROUTE_INPUT_INVALID',
  'ROUTE_INPUT_DEGRADED', 'ROUTE_INPUT_VALID'
]);
const TX_ROUTE_SOURCE_STATES = Object.freeze([
  'ROUTE_SOURCE_UNCONFIGURED', 'ROUTE_SOURCE_INVALID', 'ROUTE_SOURCE_READ_ONLY_OK'
]);
const TX_CANDIDATE_ROUTE_STATES = Object.freeze([
  'CANDIDATE_ROUTE_UNCONFIGURED', 'CANDIDATE_ROUTE_INVALID',
  'CANDIDATE_ROUTE_REJECTED', 'CANDIDATE_ROUTE_CANDIDATE'
]);
const TX_ROUTE_FEASIBILITY_STATES = Object.freeze([
  'ROUTE_FEASIBILITY_UNCONFIGURED', 'ROUTE_FEASIBILITY_INVALID',
  'ROUTE_FEASIBILITY_DEGRADED', 'ROUTE_FEASIBILITY_REJECTED',
  'ROUTE_FEASIBILITY_FEASIBLE_ADVISORY'
]);
const TX_EXECUTION_PLAN_PREVIEW_STATES = Object.freeze([
  'EXECUTION_PLAN_PREVIEW_UNCONFIGURED', 'EXECUTION_PLAN_PREVIEW_INVALID',
  'EXECUTION_PLAN_PREVIEW_REJECTED', 'EXECUTION_PLAN_PREVIEW_SUPPRESSED',
  'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID'
]);
const TX_ROUTE_HEALTH_STATES = Object.freeze([
  'ROUTE_HEALTH_UNCONFIGURED', 'ROUTE_HEALTH_DEGRADED',
  'ROUTE_HEALTH_CANDIDATE_REVIEWED', 'ROUTE_HEALTH_PREVIEW_READY',
  'ROUTE_HEALTH_SUPPRESSED', 'ROUTE_HEALTH_BLOCKED'
]);

// Stage-8 intent state fields — an object carrying one of these (and no route
// state) is a raw intent output, NOT a Stage-9 route output -> refuse.
const TX_INTENT_STATE_FIELDS = Object.freeze([
  'intent_input_state', 'candidate_intent_state', 'ledger_state',
  'intent_state', 'audit_state', 'intent_health_state'
]);

// Stage-7 risk state fields — raw risk -> refuse.
const TX_RISK_STATE_FIELDS = Object.freeze([
  'risk_input_state', 'hard_risk_state', 'liquidity_exit_state',
  'exposure_risk_state', 'risk_verdict_state', 'risk_health_state'
]);

// Stage-6 signal state fields — raw signal -> refuse.
const TX_SIGNAL_STATE_FIELDS = Object.freeze([
  'signal_input_state', 'candidate_signal_state', 'signal_score_state',
  'signal_suppression_state', 'signal_state'
]);

// Stage-5 intelligence state fields — raw intelligence -> refuse.
const TX_INTELLIGENCE_STATE_FIELDS = Object.freeze([
  'wallet_observation_state', 'token_observation_state', 'relationship_state',
  'diagnostics_state', 'intelligence_state'
]);

// Stage-4 raw ingestion event types — raw events -> refuse.
const TX_RAW_INGESTION_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed', 'token_account_change_observed',
  'swap_observed', 'mint_observed', 'pool_observed', 'balance_change_observed'
]);

// Does an object carry ANY recognized Stage-9 route-layer state field?
function txRouteComponentState(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (typeof o.route_input_state === 'string' && TX_ROUTE_INPUT_STATES.includes(o.route_input_state)) return o.route_input_state;
  if (typeof o.route_source_state === 'string' && TX_ROUTE_SOURCE_STATES.includes(o.route_source_state)) return o.route_source_state;
  if (typeof o.candidate_route_state === 'string' && TX_CANDIDATE_ROUTE_STATES.includes(o.candidate_route_state)) return o.candidate_route_state;
  if (typeof o.route_feasibility_state === 'string' && TX_ROUTE_FEASIBILITY_STATES.includes(o.route_feasibility_state)) return o.route_feasibility_state;
  if (typeof o.execution_plan_preview_state === 'string' && TX_EXECUTION_PLAN_PREVIEW_STATES.includes(o.execution_plan_preview_state)) return o.execution_plan_preview_state;
  if (typeof o.route_health_state === 'string' && TX_ROUTE_HEALTH_STATES.includes(o.route_health_state)) return o.route_health_state;
  // route suppression carries suppressed + suppression_reasons (no dedicated *_state enum)
  if (typeof o.suppressed === 'boolean' && Array.isArray(o.suppression_reasons)) return 'ROUTE_SUPPRESSION_RESULT';
  return null;
}

function txHasRouteLayerState(o) {
  return txRouteComponentState(o) !== null;
}

// Is the object a raw Stage-8 intent output (intent state, NO route state)?
function txIsRawIntent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (txHasRouteLayerState(o)) return false;
  for (const f of TX_INTENT_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object a raw Stage-7 risk output (risk state, NO route state)?
function txIsRawRisk(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (txHasRouteLayerState(o)) return false;
  for (const f of TX_RISK_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object a raw Stage-6 signal output (signal state, NO route state)?
function txIsRawSignal(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (txHasRouteLayerState(o)) return false;
  for (const f of TX_SIGNAL_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object raw Stage-5 intelligence (intelligence state, NO route state)?
function txIsRawIntelligence(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (txHasRouteLayerState(o)) return false;
  for (const f of TX_INTELLIGENCE_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object a raw Stage-4 ingestion event (event_type, NO route state)?
function txIsRawIngestionEvent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (txHasRouteLayerState(o)) return false;
  const et = o.event_type;
  return typeof et === 'string' && TX_RAW_INGESTION_EVENT_TYPES.includes(et);
}

function txIsRawNonRouteInput(o) {
  return txIsRawIntent(o) || txIsRawRisk(o) || txIsRawSignal(o) ||
    txIsRawIntelligence(o) || txIsRawIngestionEvent(o);
}

// Recognize a Stage-9 route RESULT component: an inspectable read-only object
// that carries a valid route-layer state and is NOT raw intent/risk/signal/
// intelligence/event. Returns the recognized route-layer state string, or null.
function txRecognizeRouteComponent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (txIsRawNonRouteInput(o)) return null;
  if (o.read_only !== true) return null;
  return txRouteComponentState(o);
}

// Screen a Stage-9 RESULT object passed in a component slot: forbidden trading
// flag, execution-command KEY, raw intent/risk/signal/intelligence/event,
// endpoint/mainnet by string VALUE. The secret-NAME scan is NOT run here because
// legitimate route state fields contain the substring 'token'; results spread
// only fixed literals/allowlisted tokens, so a bare secret value is never echoed.
function txScreenComponentResult(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (txHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (txHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (txHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (txIsRawNonRouteInput(c)) r.push('raw_non_route_input_refused');
  return r;
}

// Recognize a Stage-9 route-input-boundary result fed forward.
function txRecognizeRouteInputResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.route_input_state === 'string' && TX_ROUTE_INPUT_STATES.includes(o.route_input_state)) {
    return o.route_input_state;
  }
  return null;
}

// Recognize a Stage-9 execution-plan-preview result fed forward.
function txRecognizeExecutionPreviewResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.execution_plan_preview_state === 'string' && TX_EXECUTION_PLAN_PREVIEW_STATES.includes(o.execution_plan_preview_state)) {
    return o.execution_plan_preview_state;
  }
  return null;
}

// Recognize a Stage-9 route-health result fed forward.
function txRecognizeRouteHealthResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.route_health_state === 'string' && TX_ROUTE_HEALTH_STATES.includes(o.route_health_state)) {
    return o.route_health_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (C) TRANSACTION-BUILD INPUT BOUNDARY
//
// Verifies that tx-build-review input comes ONLY from Stage-9 route outputs,
// never from raw intent / risk / signal / commands. A VALID boundary opens NO
// transaction/serialization/signing/send/trading readiness;
// eligible_for_tx_build_review marks the input shape only, and is NOT a
// transaction, serialization, signing or send permission. The route must be
// PREVIEW READY (execution_plan_preview EXECUTION_PLAN_PREVIEW_PREVIEW_VALID +
// route_health ROUTE_HEALTH_PREVIEW_READY + not suppressed) to be eligible;
// anything else -> DEGRADED / UNCONFIGURED / INVALID.
// ---------------------------------------------------------------------------

const TX_BUILD_INPUT_STATES = Object.freeze([
  'TX_BUILD_INPUT_UNCONFIGURED', 'TX_BUILD_INPUT_INVALID',
  'TX_BUILD_INPUT_DEGRADED', 'TX_BUILD_INPUT_VALID'
]);

const TX_BUILD_INPUT_COMPONENTS = Object.freeze([
  'route_input_boundary', 'route_source_boundary', 'candidate_route_plan',
  'route_feasibility', 'execution_plan_preview', 'route_suppression',
  'route_health'
]);

export function describeTransactionBuildInputBoundaryContract() {
  return Object.freeze({
    contract: 'transaction-build-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: TX_BUILD_INPUT_STATES,
    advisory_only: true,
    tx_build_input_state: 'TX_BUILD_INPUT_UNCONFIGURED',
    tx_build_input_boundary_valid: false,
    eligible_for_tx_build_review: false,
    status: 'TX_BUILD_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...txSafeFlags(),
    note: 'Read-only transaction-build INPUT boundary. Verifies tx-build-review input comes ONLY from Stage-9 route outputs (route input boundary, route source boundary, candidate route plan, route feasibility, execution plan preview, route suppression, route health), never from raw Stage-8 intent, Stage-7 risk, Stage-6 signals, Stage-5 intelligence, Stage-4 ingestion events, endpoints, or execution commands. A VALID boundary opens NO transaction/serialization/signing/send/trading readiness; eligible_for_tx_build_review marks the input shape only, and is NOT a transaction, serialized transaction, message bytes, signing or send permission. The route must be PREVIEW READY (execution_plan_preview EXECUTION_PLAN_PREVIEW_PREVIEW_VALID + route_health ROUTE_HEALTH_PREVIEW_READY + not suppressed) to be eligible; route suppressed or preview not ready -> TX_BUILD_INPUT_DEGRADED (NOT eligible, fail-closed); route_health ROUTE_HEALTH_BLOCKED or any component *_INVALID -> TX_BUILD_INPUT_INVALID. Raw intent/risk/signal/intelligence/event objects, smuggled trading/transaction/serialize/sign/send/live-quote flags or commands, secrets, endpoints, and mainnet/REAL-LIVE markers are refused (raw_non_route_input_refused / *_blocked) and never echoed. transaction_ready / serialized_ready / message_bytes_ready / signing_permitted / can_serialize / can_send STAY false in EVERY state.'
  });
}

export function validateTransactionBuildInputBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (txUninspectable(obj, ['purpose', ...TX_BUILD_INPUT_COMPONENTS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...txSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_tx_build_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!TX_BUILD_INPUT_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...txScreen(shallow));
      for (const k of TX_BUILD_INPUT_COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (txHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (txHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (txIsRawNonRouteInput(c)) reasons.push('raw_non_route_input_refused');
      }
      if (obj.purpose !== 'tx_build_input_boundary') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...txSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...txSafeFlags()
    });
  }
}

export function evaluateTransactionBuildInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'TX_BUILD_INPUT_INVALID'),
    tx_build_input_boundary_valid: (state === 'TX_BUILD_INPUT_VALID'),
    eligible_for_tx_build_review: (state === 'TX_BUILD_INPUT_VALID'),
    tx_build_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...txSafeFlags()
  });
  try {
    const v = validateTransactionBuildInputBoundary(input);
    // unrecognized / hostile -> UNCONFIGURED
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('TX_BUILD_INPUT_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_tx_build_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / raw input / bad purpose -> INVALID
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_non_route_input_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('TX_BUILD_INPUT_INVALID', v.reasons);
    }

    const slots = [
      ['route_input_boundary', input.route_input_boundary],
      ['route_source_boundary', input.route_source_boundary],
      ['candidate_route_plan', input.candidate_route_plan],
      ['route_feasibility', input.route_feasibility],
      ['execution_plan_preview', input.execution_plan_preview],
      ['route_suppression', input.route_suppression],
      ['route_health', input.route_health]
    ];

    // each PRESENT component must be a recognized read-only Stage-9 route result;
    // an unrecognized component (or one blocked by the component screen) is not a
    // Stage-9 route output -> refuse.
    let anyComponentInvalid = false;
    for (const [, c] of slots) {
      if (c == null) continue;
      if (txScreenComponentResult(c).length > 0) {
        return build('TX_BUILD_INPUT_INVALID', ['raw_non_route_input_refused']);
      }
      const s = txRecognizeRouteComponent(c);
      if (s === null) {
        return build('TX_BUILD_INPUT_INVALID', ['component_not_stage9_route']);
      }
      if (s === 'ROUTE_INPUT_INVALID' || s === 'ROUTE_SOURCE_INVALID' ||
          s === 'CANDIDATE_ROUTE_INVALID' || s === 'ROUTE_FEASIBILITY_INVALID' ||
          s === 'EXECUTION_PLAN_PREVIEW_INVALID') {
        anyComponentInvalid = true;
      }
    }

    const preview = input.execution_plan_preview;
    const health = input.route_health;
    const suppression = input.route_suppression;

    const previewState = (preview != null) ? txRecognizeRouteComponent(preview) : null;
    const healthState = (health != null) ? txRecognizeRouteComponent(health) : null;

    // route_health BLOCKED OR any component *_INVALID -> INVALID
    if (healthState === 'ROUTE_HEALTH_BLOCKED' || anyComponentInvalid) {
      return build('TX_BUILD_INPUT_INVALID', ['route_component_invalid']);
    }

    // required minimum components: execution_plan_preview + route_health
    if (previewState === null || healthState === null) {
      return build('TX_BUILD_INPUT_UNCONFIGURED', ['required_component_missing']);
    }

    const suppressed = (suppression != null && typeof suppression === 'object' && !Array.isArray(suppression))
      ? suppression.suppressed === true : false;

    // route suppressed OR preview not ready OR health not preview-ready -> DEGRADED
    // (not eligible, fail-closed)
    if (suppressed === true ||
        previewState !== 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID' ||
        healthState !== 'ROUTE_HEALTH_PREVIEW_READY') {
      const degraded = [];
      if (suppressed === true) degraded.push('route_suppressed');
      if (previewState !== 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID') degraded.push('execution_plan_preview_not_ready');
      if (healthState !== 'ROUTE_HEALTH_PREVIEW_READY') degraded.push('route_health_not_preview_ready');
      return build('TX_BUILD_INPUT_DEGRADED', degraded.length ? degraded : ['execution_plan_preview_not_ready']);
    }

    // preview valid + health preview-ready + not suppressed + all present
    // components recognized read-only -> VALID (eligible)
    return build('TX_BUILD_INPUT_VALID', []);
  } catch {
    return build('TX_BUILD_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (D) TRANSACTION BUILD SOURCE / BUILDER BOUNDARY
//
// The tx-build source/builder is a DISABLED / read-only descriptor TAG only — no
// SDK, no builder, no network. solana_tx_builder_disabled /
// jupiter_tx_builder_disabled are accepted ONLY as disabled/read-only markers;
// they NEVER build a transaction, serialize, or call a builder. Endpoint URL /
// api_key / secret / token / smuggled build/serialize/sign/send flag /
// mainnet/REAL-LIVE -> INVALID and never echoed.
// ---------------------------------------------------------------------------

const TX_BUILD_SOURCE_STATES = Object.freeze([
  'TX_BUILD_SOURCE_UNCONFIGURED', 'TX_BUILD_SOURCE_INVALID',
  'TX_BUILD_SOURCE_READ_ONLY_OK'
]);

const TX_BUILD_SOURCE_ALLOWED_TAGS = Object.freeze([
  'mock_tx_build_metadata', 'fixture_tx_build_metadata',
  'solana_tx_builder_disabled', 'jupiter_tx_builder_disabled',
  'manual_tx_review_disabled'
]);

const TX_BUILD_SOURCE_TOP_KEYS = Object.freeze(['purpose', 'tx_build_source']);

export function describeTransactionBuildSourceBoundaryContract() {
  return Object.freeze({
    contract: 'transaction-build-source-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: TX_BUILD_SOURCE_STATES,
    supported_source_tags: TX_BUILD_SOURCE_ALLOWED_TAGS,
    advisory_only: true,
    tx_build_source_valid: false,
    tx_build_source_state: 'TX_BUILD_SOURCE_UNCONFIGURED',
    builder_disabled: true,
    transaction_build_performed: false,
    serialization_performed: false,
    network_call_made: false,
    endpoint_resolved: false,
    status: 'TX_BUILD_SOURCE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...txSafeFlags(),
    note: 'Read-only transaction-build SOURCE / BUILDER boundary. The tx-build source is a DISABLED / read-only descriptor TAG only (mock_tx_build_metadata, fixture_tx_build_metadata, solana_tx_builder_disabled, jupiter_tx_builder_disabled, manual_tx_review_disabled) — NO endpoint, NO SDK, NO builder, NO live call, NO serialization, NO message bytes, NO signing, NO send. solana_tx_builder_disabled / jupiter_tx_builder_disabled are accepted ONLY as disabled/read-only markers; they NEVER build a transaction, serialize, or call a builder — builder_disabled STAYS true, transaction_build_performed / serialization_performed / network_call_made / endpoint_resolved STAY false. Fail-Safe-Not-Fail-Open: missing source -> TX_BUILD_SOURCE_UNCONFIGURED; unknown source tag -> TX_BUILD_SOURCE_INVALID; an endpoint URL field / api_key / secret / token / smuggled build/serialize/sign/send flag / mainnet / REAL-LIVE -> TX_BUILD_SOURCE_INVALID and NEVER echoed; a valid disabled/read-only tag -> TX_BUILD_SOURCE_READ_ONLY_OK. Opens NO transaction/serialization/signing/send/trading readiness.'
  });
}

export function validateTransactionBuildSourceBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (txUninspectable(obj, [...TX_BUILD_SOURCE_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...txSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_tx_build_source_input');
    } else {
      recognized = true;
      reasons.push(...txScreen(obj));
      if (obj.purpose !== 'tx_build_source_boundary') reasons.push('purpose_invalid');
      const tag = obj.tx_build_source;
      if (tag == null) {
        reasons.push('tx_build_source_missing');
      } else if (typeof tag !== 'string' || !TX_BUILD_SOURCE_ALLOWED_TAGS.includes(tag)) {
        reasons.push('tx_build_source_unknown');
      }
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...txSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...txSafeFlags()
    });
  }
}

export function evaluateTransactionBuildSourceBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'TX_BUILD_SOURCE_INVALID'),
    tx_build_source_valid: (state === 'TX_BUILD_SOURCE_READ_ONLY_OK'),
    tx_build_source_state: state,
    builder_disabled: true,
    transaction_build_performed: false,
    serialization_performed: false,
    network_call_made: false,
    endpoint_resolved: false,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...txSafeFlags()
  });
  try {
    const v = validateTransactionBuildSourceBoundary(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('TX_BUILD_SOURCE_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_tx_build_source_input']);
    }
    // missing source -> UNCONFIGURED
    if (v.reasons.includes('tx_build_source_missing')) {
      return build('TX_BUILD_SOURCE_UNCONFIGURED', ['tx_build_source_missing']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / bad purpose
    // / unknown tag -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid') ||
        v.reasons.includes('tx_build_source_unknown')) {
      return build('TX_BUILD_SOURCE_INVALID', v.reasons);
    }
    // a valid disabled/read-only tag -> READ_ONLY_OK
    return build('TX_BUILD_SOURCE_READ_ONLY_OK', ['tx_build_source_read_only_ok']);
  } catch {
    return build('TX_BUILD_SOURCE_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-10 (C) tx-build-input-boundary VALID result fed forward.
function txRecognizeInputBoundaryResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.tx_build_input_state === 'string' && TX_BUILD_INPUT_STATES.includes(o.tx_build_input_state)) {
    return o.tx_build_input_state;
  }
  return null;
}

// Recognize a Stage-10 (D) tx-build-source-boundary result fed forward.
function txRecognizeSourceBoundaryResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.tx_build_source_state === 'string' && TX_BUILD_SOURCE_STATES.includes(o.tx_build_source_state)) {
    return o.tx_build_source_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (E) CANDIDATE TRANSACTION BUILD DESCRIPTOR
//
// A DESCRIPTIVE descriptor produced from tx-build METADATA input ONLY, after a
// TX_BUILD_INPUT_VALID boundary + TX_BUILD_SOURCE_READ_ONLY_OK source ONLY. It is
// NOT a transaction, NOT a serialized transaction, NOT message bytes, NOT a
// signing permission, NOT a send permission, NOT transaction/trading readiness.
// It opens NO transaction_ready / serialized_ready / message_bytes_ready /
// signing_permitted / can_serialize / can_send. NO transaction_id / transaction /
// serialized_tx / message_bytes / instruction_array / signature / blockhash /
// feePayer / signer / broadcast_target / endpoint field ever appears in output.
// Fail-Safe: weak/over-threshold metadata buckets -> REJECTED/DEGRADED.
// ---------------------------------------------------------------------------

const CANDIDATE_TX_BUILD_STATES = Object.freeze([
  'CANDIDATE_TX_BUILD_UNCONFIGURED', 'CANDIDATE_TX_BUILD_INVALID',
  'CANDIDATE_TX_BUILD_REJECTED', 'CANDIDATE_TX_BUILD_DEGRADED',
  'CANDIDATE_TX_BUILD_DESCRIPTOR'
]);

const CANDIDATE_TX_BUILD_REASON_CODES = Object.freeze([
  'tx_build_input_valid', 'tx_build_source_valid', 'tx_build_metadata_present',
  'account_count_high', 'instruction_count_high', 'compute_unit_high',
  'transaction_size_large', 'lookup_table_unresolved',
  'candidate_tx_build_reviewed', 'tx_build_input_not_valid',
  'tx_build_source_not_valid'
]);

const CANDIDATE_TX_BUILD_COMPONENTS = Object.freeze([
  'tx_build_input_boundary', 'tx_build_source_boundary', 'tx_build_metadata'
]);

// fields that MUST NOT appear in any candidate-tx-build input or output
// (transaction / serialization / message-bytes / signing / send / instruction).
const CANDIDATE_TX_BUILD_FORBIDDEN_KEYS = Object.freeze([
  'transaction_id', 'transaction', 'transaction_object', 'versionedtransaction',
  'transactionmessage', 'messagev0', 'serialized_tx', 'message_bytes', 'base64',
  'instruction_array', 'instructions', 'account_metas', 'recentblockhash',
  'blockhash', 'feepayer', 'signature', 'signatures', 'signer', 'private_key',
  'broadcast_target', 'endpoint'
]);

const CANDIDATE_TX_BUILD_ACCOUNT_BUCKETS = Object.freeze(['unknown', 'low', 'medium', 'high', 'too_high']);
const CANDIDATE_TX_BUILD_INSTRUCTION_BUCKETS = Object.freeze(['unknown', 'low', 'medium', 'high', 'too_high']);
const CANDIDATE_TX_BUILD_COMPUTE_BUCKETS = Object.freeze(['unknown', 'low', 'medium', 'high', 'too_high']);
const CANDIDATE_TX_BUILD_SIZE_BUCKETS = Object.freeze(['unknown', 'small', 'medium', 'large', 'too_large']);
const CANDIDATE_TX_BUILD_LOOKUP_BUCKETS = Object.freeze(['unknown', 'not_needed', 'maybe_needed', 'required_unresolved']);
const CANDIDATE_TX_BUILD_PRIORITY_BUCKETS = Object.freeze(['unknown', 'low', 'medium', 'high']);

function candidateTxBuildHasForbiddenKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (CANDIDATE_TX_BUILD_FORBIDDEN_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

export function describeCandidateTransactionBuildDescriptorContract() {
  return Object.freeze({
    contract: 'candidate-transaction-build-descriptor',
    version: '0.0.0',
    test_only: true,
    supported_states: CANDIDATE_TX_BUILD_STATES,
    supported_reason_codes: CANDIDATE_TX_BUILD_REASON_CODES,
    advisory_only: true,
    candidate_tx_build_descriptor_valid: false,
    candidate_tx_build_state: 'CANDIDATE_TX_BUILD_UNCONFIGURED',
    tx_build_review_ref: null,
    preview_ref: null,
    route_plan_ref: null,
    intent_record_ref: null,
    tx_build_kind: 'candidate_tx_build_descriptor',
    tx_build_reason_codes: Object.freeze([]),
    status: 'CANDIDATE_TX_BUILD_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...txSafeFlags(),
    note: 'Read-only DESCRIPTIVE candidate transaction-build descriptor produced from tx-build METADATA input ONLY, after a Stage-10 TX_BUILD_INPUT_VALID boundary + TX_BUILD_SOURCE_READ_ONLY_OK source ONLY. A tx-build descriptor is a READ-ONLY ADVISORY REPRESENTATION ONLY — NOT a transaction, NOT a serialized transaction, NOT message bytes, NOT a signing permission, NOT a send permission, NOT transaction/trading readiness. It opens NO transaction_ready / serialized_ready / message_bytes_ready / signing_permitted / can_serialize / can_send — every readiness/execution/serialization flag STAYS false; "a candidate descriptor exists" is carried ONLY by candidate_tx_build_descriptor_valid / candidate_tx_build_state / tx_build_review_ref. NO transaction_id / transaction / transaction_object / VersionedTransaction / TransactionMessage / MessageV0 / serialized_tx / message_bytes / base64 / instruction_array / instructions / account_metas / recentBlockhash / blockhash / feePayer / signature / signer / broadcast_target / endpoint field ever appears in output. Fail-Safe-Not-Fail-Open: missing input -> CANDIDATE_TX_BUILD_UNCONFIGURED; tx_build_input_boundary not TX_BUILD_INPUT_VALID OR tx_build_source_boundary not TX_BUILD_SOURCE_READ_ONLY_OK -> CANDIDATE_TX_BUILD_REJECTED (no descriptor); tx_build_metadata requires_serialization!==false OR requires_signing!==false OR requires_network!==false OR a smuggled transaction/message/serialize/sign/send/instruction key or forbidden flag/secret/endpoint -> CANDIDATE_TX_BUILD_INVALID; account_count_bucket too_high OR instruction_count_bucket too_high OR compute_unit_bucket too_high OR transaction_size_bucket too_large OR lookup_table_bucket required_unresolved -> CANDIDATE_TX_BUILD_REJECTED (Fail-Safe; matching reason code included); any unknown bucket -> CANDIDATE_TX_BUILD_DEGRADED; valid clean metadata -> CANDIDATE_TX_BUILD_DESCRIPTOR. tx_build_review_ref / preview_ref / route_plan_ref / intent_record_ref are caller-supplied deterministic opaque refs, never generated and never derived from a clock.'
  });
}

export function validateCandidateTransactionBuildDescriptorInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (txUninspectable(obj, ['purpose', ...CANDIDATE_TX_BUILD_COMPONENTS,
      'tx_build_review_ref', 'preview_ref', 'route_plan_ref', 'intent_record_ref'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...txSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_candidate_tx_build_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!CANDIDATE_TX_BUILD_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...txScreen(shallow));
      if (candidateTxBuildHasForbiddenKey(obj)) reasons.push('forbidden_execution_field_blocked');
      // screen nested components for forbidden flags / exec cmds / forbidden keys / endpoints
      for (const k of CANDIDATE_TX_BUILD_COMPONENTS) {
        const c = obj[k];
        if (c == null || typeof c !== 'object') continue;
        if (txHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (txHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (candidateTxBuildHasForbiddenKey(c)) reasons.push('forbidden_execution_field_blocked');
        if (txHasEndpointOrMainnet(c)) reasons.push('endpoint_or_mainnet_blocked');
      }
      if (obj.purpose !== 'candidate_tx_build_descriptor_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...txSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...txSafeFlags()
    });
  }
}

export function evaluateCandidateTransactionBuildDescriptor(input) {
  const build = (state, reasons, refs) => Object.freeze({
    candidate_tx_build_descriptor_valid: (state === 'CANDIDATE_TX_BUILD_DESCRIPTOR'),
    candidate_tx_build_state: state,
    tx_build_review_ref: (refs && typeof refs.tx_build_review_ref === 'string') ? refs.tx_build_review_ref : null,
    preview_ref: (refs && typeof refs.preview_ref === 'string') ? refs.preview_ref : null,
    route_plan_ref: (refs && typeof refs.route_plan_ref === 'string') ? refs.route_plan_ref : null,
    intent_record_ref: (refs && typeof refs.intent_record_ref === 'string') ? refs.intent_record_ref : null,
    tx_build_kind: 'candidate_tx_build_descriptor',
    tx_build_reason_codes: Object.freeze(
      [...new Set((reasons || []).filter((c) => CANDIDATE_TX_BUILD_REASON_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...txSafeFlags()
  });
  try {
    const v = validateCandidateTransactionBuildDescriptorInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('CANDIDATE_TX_BUILD_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_candidate_tx_build_input'], null);
    }

    const refs = {
      tx_build_review_ref: (typeof input.tx_build_review_ref === 'string') ? input.tx_build_review_ref : null,
      preview_ref: (typeof input.preview_ref === 'string') ? input.preview_ref : null,
      route_plan_ref: (typeof input.route_plan_ref === 'string') ? input.route_plan_ref : null,
      intent_record_ref: (typeof input.intent_record_ref === 'string') ? input.intent_record_ref : null
    };

    // smuggled transaction/message/serialize/sign/send/instruction key or forbidden
    // flag / exec cmd / secret / endpoint / mainnet / bad purpose -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('forbidden_execution_field_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('CANDIDATE_TX_BUILD_INVALID', ['tx_build_metadata_invalid'], refs);
    }

    const boundary = input.tx_build_input_boundary;
    const source = input.tx_build_source_boundary;
    const metadata = input.tx_build_metadata;

    // missing required input -> UNCONFIGURED
    if (boundary == null || source == null || metadata == null ||
        typeof metadata !== 'object' || Array.isArray(metadata)) {
      return build('CANDIDATE_TX_BUILD_UNCONFIGURED', ['required_input_missing'], refs);
    }

    const boundaryState = txRecognizeInputBoundaryResult(boundary);
    const sourceState = txRecognizeSourceBoundaryResult(source);

    // tx_build_input_boundary not TX_BUILD_INPUT_VALID -> REJECTED
    if (boundaryState !== 'TX_BUILD_INPUT_VALID') {
      return build('CANDIDATE_TX_BUILD_REJECTED', ['tx_build_input_not_valid'], refs);
    }
    // tx_build_source_boundary not TX_BUILD_SOURCE_READ_ONLY_OK -> REJECTED
    if (sourceState !== 'TX_BUILD_SOURCE_READ_ONLY_OK') {
      return build('CANDIDATE_TX_BUILD_REJECTED', ['tx_build_source_not_valid'], refs);
    }

    // tx build metadata must explicitly forbid serialization + signing + network
    if (metadata.requires_serialization !== false || metadata.requires_signing !== false ||
        metadata.requires_network !== false) {
      return build('CANDIDATE_TX_BUILD_INVALID', ['tx_build_metadata_invalid'], refs);
    }

    const acct = metadata.account_count_bucket;
    const instr = metadata.instruction_count_bucket;
    const compute = metadata.compute_unit_bucket;
    const size = metadata.transaction_size_bucket;
    const lookup = metadata.lookup_table_bucket;
    const priority = metadata.priority_fee_bucket;

    // bucket values must be from the known allowlists -> else INVALID
    if (!CANDIDATE_TX_BUILD_ACCOUNT_BUCKETS.includes(acct) ||
        !CANDIDATE_TX_BUILD_INSTRUCTION_BUCKETS.includes(instr) ||
        !CANDIDATE_TX_BUILD_COMPUTE_BUCKETS.includes(compute) ||
        !CANDIDATE_TX_BUILD_SIZE_BUCKETS.includes(size) ||
        !CANDIDATE_TX_BUILD_LOOKUP_BUCKETS.includes(lookup) ||
        !CANDIDATE_TX_BUILD_PRIORITY_BUCKETS.includes(priority)) {
      return build('CANDIDATE_TX_BUILD_INVALID', ['tx_build_metadata_invalid'], refs);
    }

    // Fail-Safe: over-threshold metadata -> REJECTED (no descriptor)
    const bad = [];
    if (acct === 'too_high') bad.push('account_count_high');
    if (instr === 'too_high') bad.push('instruction_count_high');
    if (compute === 'too_high') bad.push('compute_unit_high');
    if (size === 'too_large') bad.push('transaction_size_large');
    if (lookup === 'required_unresolved') bad.push('lookup_table_unresolved');
    if (bad.length > 0) {
      return build('CANDIDATE_TX_BUILD_REJECTED', [
        'tx_build_input_valid', 'tx_build_source_valid', 'tx_build_metadata_present', ...bad
      ], refs);
    }

    // Fail-Safe: weak/unknown metadata -> DEGRADED (no descriptor)
    if (acct === 'unknown' || instr === 'unknown' || compute === 'unknown' ||
        size === 'unknown' || lookup === 'unknown' || priority === 'unknown') {
      return build('CANDIDATE_TX_BUILD_DEGRADED', [
        'tx_build_input_valid', 'tx_build_source_valid', 'tx_build_metadata_present'
      ], refs);
    }

    // valid clean metadata -> DESCRIPTOR
    return build('CANDIDATE_TX_BUILD_DESCRIPTOR', [
      'tx_build_input_valid', 'tx_build_source_valid', 'tx_build_metadata_present',
      'candidate_tx_build_reviewed'
    ], refs);
  } catch {
    return build('CANDIDATE_TX_BUILD_UNCONFIGURED', ['input_inspection_error'], null);
  }
}
