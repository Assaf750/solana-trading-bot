// @soltrade/pipeline-decision-trace-foundations
//
// Read-only / advisory ONLY END-TO-END DECISION-TRACE foundation for Stage-13 of
// the architecture pipeline `data -> signal -> risk -> intent -> route -> sign ->
// send`. This package builds ONLY a read-only/advisory DECISION-TRACE COMPOSER and
// a full-pipeline HEALTH/STATUS read-model. It COMPOSES the already-computed
// TERMINAL RESULTS of Stages 6-12 (signal health, risk verdict + health, intent
// terminal + health, route terminal verdict + health, signing-review verdict +
// health, send-review verdict + health) that are PASSED IN as args. Import-free,
// pure, deterministic. NO clock, NO RNG, NO network primitive, NO live stream, NO
// live quote, NO RPC/route call, NO signing, NO sending, NO broadcasting, NO
// SignerService activation, NO private key / seed / mnemonic / keypair material,
// no system clock, no persistence, no secrets, no mutable module/global state.
//
// THE CORE RULE: a decision-trace / pipeline-health read-model is a READ-ONLY
// ADVISORY REPRESENTATION ONLY — it COMPOSES the terminal RESULTS of the prior
// stages; it does NOT run any stage, does NOT sign, does NOT send, does NOT
// broadcast. It is NOT execution, NOT a permission, NOT trading/signing/send
// readiness. can_send / can_broadcast / signer_ready / signing_permitted /
// broadcast_permitted (and every other readiness/execution flag) ALL STAY false on
// every result — composing a trace NEVER flips any readiness/execution flag.
// "Every stage was reviewed end-to-end" is carried ONLY by dedicated fields
// (pipeline_decision_state / pipeline_decision_reviewed_advisory /
// overall_outcome / pipeline_health_state), never by a readiness flag. Even the
// fully-reviewed REVIEWED_ADVISORY outcome opens NOTHING. Hostile, throwing, or
// uninspectable input returns a FROZEN refusal and NEVER throws.
// Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package adds NO name to docs/01-SSOT.md. The stage-name
// values (signal/risk/intent/route/signing_review/send_review) and the stage_state
// strings that overlap upstream stage enums are CONSUMED-ONLY — copied through as
// opaque review-outcome strings, never re-defined and never granting authority.
// Field names like endpoint / rpc_url / serialized_tx / signed_transaction /
// signature / message_bytes / private_key / keypair / mnemonic / seed appear ONLY
// as fixed string literals inside forbidden-NAME allowlist arrays and prose —
// never as real objects, calls, or emitted output keys, and a VALUE is NEVER
// echoed.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function traceSafeFlags() {
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
    signer_ready: false,
    signing_permitted: false,
    broadcast_permitted: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    is_live: false,
    mainnet_enabled: false,
    real_live: false
  };
}

// the 24 non-read_only flags above — none may EVER be true on input or output; a
// trace/health composition NEVER flips any.
const TRACE_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
]);

const TRACE_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute', 'rpc_call',
  'connect_rpc', 'send_transaction', 'broadcast_transaction', 'run_stage',
  'run_pipeline', 'execute_pipeline'
]);

const TRACE_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential|signing_key|signer_secret/i;
const TRACE_URL_RE = /https?:\/\/|wss?:\/\//i;
const TRACE_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan (their values are
// still scanned for URL/secret/mainnet substrings).
const TRACE_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'trace_ref', 'pipeline_ref', 'decision_ref'
]);

function traceHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of TRACE_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function traceHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (TRACE_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function traceHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (TRACE_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (TRACE_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function traceHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (TRACE_URL_RE.test(v) || TRACE_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function traceScreen(o) {
  const r = [];
  if (traceHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (traceHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (traceHasSecretField(o)) r.push('secret_field_blocked');
  if (traceHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function traceUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// shared forbidden field NAMES — key material + live surfaces — that MUST NOT
// appear as a key in ANY trace input component or any output. These appear ONLY as
// fixed string literals in this allowlist + prose; the guard NEVER echoes VALUES.
const TRACE_FORBIDDEN_FIELD_NAMES = Object.freeze([
  // key material
  'private_key', 'privateKey', 'secret_key', 'secretKey', 'keypair', 'keyPair',
  'mnemonic', 'seed', 'seed_phrase', 'seedPhrase', 'signing_key', 'signingKey',
  'signer_secret', 'signerSecret', 'signature', 'signatures', 'signed_tx',
  'signedTransaction', 'signed_transaction',
  // live surfaces
  'endpoint', 'endpoint_url', 'endpointUrl', 'rpc_url', 'rpcUrl', 'rpc_endpoint',
  'provider_url', 'providerUrl', 'node_url', 'nodeUrl', 'ws_url', 'wss_url',
  'serialized_tx', 'serializedTx', 'serialized_transaction', 'wire_transaction',
  'raw_tx', 'raw_transaction', 'tx_bytes', 'message_bytes', 'broadcast_payload',
  'send_payload'
]);

function traceHasForbiddenFieldName(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (TRACE_FORBIDDEN_FIELD_NAMES.includes(String(k))) return true;
  }
  return false;
}

// Full hostile/smuggle screen for a single component result object.
function traceScreenComponent(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (traceHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (traceHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (traceHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (traceHasForbiddenFieldName(c)) r.push('forbidden_field_name_blocked');
  return r;
}

// ---------------------------------------------------------------------------
// Stage terminal-result recognizers. The Stage-13 trace consumes ONLY the
// already-computed TERMINAL results of Stages 6-12, each carrying read_only:true
// and its own known terminal state field. We copy ONLY the state STRING (never any
// other field).
// ---------------------------------------------------------------------------

// Stage-6 signal HEALTH terminal state (field: signal_state).
const TRACE_SIGNAL_HEALTH_STATES = Object.freeze([
  'SIGNAL_UNCONFIGURED', 'SIGNAL_DEGRADED', 'SIGNAL_READY_ADVISORY',
  'SIGNAL_SUPPRESSED', 'SIGNAL_BLOCKED'
]);

// Stage-7 risk VERDICT terminal state (field: risk_verdict_state).
const TRACE_RISK_VERDICT_STATES = Object.freeze([
  'RISK_UNCONFIGURED', 'RISK_DEGRADED', 'RISK_BLOCKED', 'RISK_PASS_ADVISORY'
]);
// Stage-7 risk HEALTH terminal state (field: risk_health_state).
const TRACE_RISK_HEALTH_STATES = Object.freeze([
  'RISK_HEALTH_UNCONFIGURED', 'RISK_HEALTH_DEGRADED', 'RISK_HEALTH_PASS_ADVISORY',
  'RISK_HEALTH_SUPPRESSED', 'RISK_HEALTH_BLOCKED'
]);

// Stage-8 intent TERMINAL state (field: intent_state).
const TRACE_INTENT_STATES = Object.freeze([
  'INTENT_UNCONFIGURED', 'INTENT_CANDIDATE_RECORDED', 'INTENT_REJECTED',
  'INTENT_SUPPRESSED', 'INTENT_BLOCKED', 'INTENT_AWAITING_ROUTE_REVIEW'
]);
// Stage-8 intent HEALTH terminal state (field: intent_health_state).
const TRACE_INTENT_HEALTH_STATES = Object.freeze([
  'INTENT_HEALTH_UNCONFIGURED', 'INTENT_HEALTH_DEGRADED',
  'INTENT_HEALTH_CANDIDATE_RECORDED', 'INTENT_HEALTH_AWAITING_ROUTE_REVIEW',
  'INTENT_HEALTH_SUPPRESSED', 'INTENT_HEALTH_BLOCKED'
]);

// Stage-9 route TERMINAL verdict state (field: execution_plan_preview_state).
const TRACE_ROUTE_VERDICT_STATES = Object.freeze([
  'EXECUTION_PLAN_PREVIEW_UNCONFIGURED', 'EXECUTION_PLAN_PREVIEW_INVALID',
  'EXECUTION_PLAN_PREVIEW_REJECTED', 'EXECUTION_PLAN_PREVIEW_SUPPRESSED',
  'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID'
]);
// Stage-9 route HEALTH terminal state (field: route_health_state).
const TRACE_ROUTE_HEALTH_STATES = Object.freeze([
  'ROUTE_HEALTH_UNCONFIGURED', 'ROUTE_HEALTH_DEGRADED',
  'ROUTE_HEALTH_CANDIDATE_REVIEWED', 'ROUTE_HEALTH_PREVIEW_READY',
  'ROUTE_HEALTH_SUPPRESSED', 'ROUTE_HEALTH_BLOCKED'
]);

// Stage-11 signing-review VERDICT terminal state (field: signing_review_state).
const TRACE_SIGNING_REVIEW_VERDICT_STATES = Object.freeze([
  'SIGNING_REVIEW_UNCONFIGURED', 'SIGNING_REVIEW_DEGRADED',
  'SIGNING_REVIEW_BLOCKED', 'SIGNING_REVIEW_PASS_ADVISORY'
]);
// Stage-11 signing-review HEALTH terminal state (field: signing_review_health_state).
const TRACE_SIGNING_REVIEW_HEALTH_STATES = Object.freeze([
  'SIGNING_REVIEW_HEALTH_UNCONFIGURED', 'SIGNING_REVIEW_HEALTH_DEGRADED',
  'SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY', 'SIGNING_REVIEW_HEALTH_SUPPRESSED',
  'SIGNING_REVIEW_HEALTH_BLOCKED'
]);

// Stage-12 send-review VERDICT terminal state (field: send_review_state).
const TRACE_SEND_REVIEW_VERDICT_STATES = Object.freeze([
  'SEND_REVIEW_UNCONFIGURED', 'SEND_REVIEW_DEGRADED',
  'SEND_REVIEW_BLOCKED', 'SEND_REVIEW_PASS_ADVISORY'
]);
// Stage-12 send-review HEALTH terminal state (field: send_review_health_state).
const TRACE_SEND_REVIEW_HEALTH_STATES = Object.freeze([
  'SEND_REVIEW_HEALTH_UNCONFIGURED', 'SEND_REVIEW_HEALTH_DEGRADED',
  'SEND_REVIEW_HEALTH_REVIEWED_ADVISORY', 'SEND_REVIEW_HEALTH_SUPPRESSED',
  'SEND_REVIEW_HEALTH_BLOCKED'
]);

// Read a recognized terminal state STRING from a read-only result object given a
// (field-name, allowed-values) descriptor. Returns the state string, or null.
function traceReadState(o, field, allowed) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  const v = o[field];
  if (typeof v === 'string' && allowed.includes(v)) return v;
  return null;
}

// ---------------------------------------------------------------------------
// FIXED stage enum (composer order) + per-stage terminal descriptors.
// stage is the fixed-enum name; the trace COPIES ONLY this name + the recognized
// stage_state STRING + an allowlisted decisive_reason. The "verdict" component is
// the decisive stage-state used for advanced/blocked classification; the "health"
// component (where present) feeds the pipeline-health read-model only.
// ---------------------------------------------------------------------------

const TRACE_STAGE_ENUM = Object.freeze([
  'signal', 'risk', 'intent', 'route', 'signing_review', 'send_review'
]);

// Per-stage descriptor: the input BUNDLE slot for the decisive (verdict) result,
// its terminal field + allowed values, the health slot + field + values (or null),
// the set of verdict states that count as "advanced to terminal advisory", and the
// set that count as a hard "blocked".
const TRACE_STAGE_DESCRIPTORS = Object.freeze({
  signal: Object.freeze({
    verdict_slot: 'signal_health',
    verdict_field: 'signal_state',
    verdict_states: TRACE_SIGNAL_HEALTH_STATES,
    health_slot: 'signal_health',
    health_field: 'signal_state',
    health_states: TRACE_SIGNAL_HEALTH_STATES,
    advanced_states: Object.freeze(['SIGNAL_READY_ADVISORY', 'SIGNAL_SUPPRESSED']),
    blocked_states: Object.freeze(['SIGNAL_BLOCKED']),
    unconfigured_states: Object.freeze(['SIGNAL_UNCONFIGURED'])
  }),
  risk: Object.freeze({
    verdict_slot: 'risk_verdict',
    verdict_field: 'risk_verdict_state',
    verdict_states: TRACE_RISK_VERDICT_STATES,
    health_slot: 'risk_health',
    health_field: 'risk_health_state',
    health_states: TRACE_RISK_HEALTH_STATES,
    advanced_states: Object.freeze(['RISK_PASS_ADVISORY']),
    blocked_states: Object.freeze(['RISK_BLOCKED']),
    unconfigured_states: Object.freeze(['RISK_UNCONFIGURED'])
  }),
  intent: Object.freeze({
    verdict_slot: 'intent_terminal',
    verdict_field: 'intent_state',
    verdict_states: TRACE_INTENT_STATES,
    health_slot: 'intent_health',
    health_field: 'intent_health_state',
    health_states: TRACE_INTENT_HEALTH_STATES,
    advanced_states: Object.freeze(['INTENT_AWAITING_ROUTE_REVIEW', 'INTENT_CANDIDATE_RECORDED']),
    blocked_states: Object.freeze(['INTENT_BLOCKED', 'INTENT_REJECTED']),
    unconfigured_states: Object.freeze(['INTENT_UNCONFIGURED'])
  }),
  route: Object.freeze({
    verdict_slot: 'route_verdict',
    verdict_field: 'execution_plan_preview_state',
    verdict_states: TRACE_ROUTE_VERDICT_STATES,
    health_slot: 'route_health',
    health_field: 'route_health_state',
    health_states: TRACE_ROUTE_HEALTH_STATES,
    advanced_states: Object.freeze(['EXECUTION_PLAN_PREVIEW_PREVIEW_VALID']),
    blocked_states: Object.freeze(['EXECUTION_PLAN_PREVIEW_INVALID', 'EXECUTION_PLAN_PREVIEW_REJECTED']),
    unconfigured_states: Object.freeze(['EXECUTION_PLAN_PREVIEW_UNCONFIGURED'])
  }),
  signing_review: Object.freeze({
    verdict_slot: 'signing_review_verdict',
    verdict_field: 'signing_review_state',
    verdict_states: TRACE_SIGNING_REVIEW_VERDICT_STATES,
    health_slot: 'signing_review_health',
    health_field: 'signing_review_health_state',
    health_states: TRACE_SIGNING_REVIEW_HEALTH_STATES,
    advanced_states: Object.freeze(['SIGNING_REVIEW_PASS_ADVISORY']),
    blocked_states: Object.freeze(['SIGNING_REVIEW_BLOCKED']),
    unconfigured_states: Object.freeze(['SIGNING_REVIEW_UNCONFIGURED'])
  }),
  send_review: Object.freeze({
    verdict_slot: 'send_review_verdict',
    verdict_field: 'send_review_state',
    verdict_states: TRACE_SEND_REVIEW_VERDICT_STATES,
    health_slot: 'send_review_health',
    health_field: 'send_review_health_state',
    health_states: TRACE_SEND_REVIEW_HEALTH_STATES,
    advanced_states: Object.freeze(['SEND_REVIEW_PASS_ADVISORY']),
    blocked_states: Object.freeze(['SEND_REVIEW_BLOCKED']),
    unconfigured_states: Object.freeze(['SEND_REVIEW_UNCONFIGURED'])
  })
});

// every bundle slot the trace consumes (verdict + health for each stage).
const TRACE_BUNDLE_SLOTS = Object.freeze([
  'signal_health',
  'risk_verdict', 'risk_health',
  'intent_terminal', 'intent_health',
  'route_verdict', 'route_health',
  'signing_review_verdict', 'signing_review_health',
  'send_review_verdict', 'send_review_health'
]);

// the REQUIRED minimum terminal results for an eligible trace: every stage's
// decisive verdict slot + every health slot.
const TRACE_REQUIRED_SLOTS = TRACE_BUNDLE_SLOTS;

// fixed decisive-reason allowlist. The composed trace copies ONLY one of these as
// decisive_reason — never a free-form string from any input.
const TRACE_DECISIVE_REASON_CODES = Object.freeze([
  'reviewed_advisory', 'suppressed', 'advanced_advisory',
  'stage_blocked', 'stage_rejected', 'stage_degraded',
  'stage_unconfigured', 'stage_missing', 'stage_invalid_result'
]);

// ---------------------------------------------------------------------------
// (A) PIPELINE DECISION-TRACE INPUT BOUNDARY
//
// Verifies the trace input is a BUNDLE carrying the terminal RESULTS of the
// pipeline stages, each recognized by read_only:true + its known terminal state
// field. eligible_for_trace is true only when ALL required terminal results are
// present + well-formed. A smuggled forbidden flag / exec command / secret /
// endpoint / mainnet / forbidden field NAME OR a raw non-result object ->
// fail-closed. A VALID boundary opens NOTHING.
// ---------------------------------------------------------------------------

const PIPELINE_TRACE_INPUT_STATES = Object.freeze([
  'PIPELINE_TRACE_INPUT_UNCONFIGURED', 'PIPELINE_TRACE_INPUT_INVALID',
  'PIPELINE_TRACE_INPUT_DEGRADED', 'PIPELINE_TRACE_INPUT_VALID'
]);

export function describePipelineDecisionTraceInputBoundaryContract() {
  return Object.freeze({
    contract: 'pipeline-decision-trace-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: PIPELINE_TRACE_INPUT_STATES,
    supported_slots: TRACE_BUNDLE_SLOTS,
    supported_stages: TRACE_STAGE_ENUM,
    advisory_only: true,
    pipeline_trace_input_state: 'PIPELINE_TRACE_INPUT_UNCONFIGURED',
    pipeline_trace_input_boundary_valid: false,
    eligible_for_trace: false,
    status: 'PIPELINE_TRACE_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...traceSafeFlags(),
    note: 'Read-only PIPELINE DECISION-TRACE INPUT boundary. Verifies the Stage-13 input is a BUNDLE carrying the already-computed TERMINAL RESULTS of the prior stages (signal_health, risk_verdict + risk_health, intent_terminal + intent_health, route_verdict + route_health, signing_review_verdict + signing_review_health, send_review_verdict + send_review_health), each recognized ONLY by read_only:true + its known terminal state field. A VALID boundary opens NO execution/trading/signing/send readiness; eligible_for_trace marks the input shape only and is NOT execution, NOT running a stage, NOT a permission. Fail-Safe-Not-Fail-Open: missing/unrecognized/hostile input -> PIPELINE_TRACE_INPUT_UNCONFIGURED; a smuggled forbidden trading flag / execution command / secret / endpoint / mainnet / REAL-LIVE / forbidden field NAME (private_key/seed/keypair/signature/endpoint/serialized_tx/...) OR a raw non-result object in a slot -> PIPELINE_TRACE_INPUT_INVALID (never echoed); any required terminal result missing or any present component blocked/unconfigured upstream -> PIPELINE_TRACE_INPUT_DEGRADED; all required terminal results present + well-formed -> PIPELINE_TRACE_INPUT_VALID. The composer NEVER runs a stage, signs, sends, or broadcasts; can_send / can_broadcast / signer_ready (and every readiness/execution flag) STAY false in EVERY state.'
  });
}

export function evaluatePipelineDecisionTraceInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'PIPELINE_TRACE_INPUT_INVALID'),
    pipeline_trace_input_boundary_valid: (state === 'PIPELINE_TRACE_INPUT_VALID'),
    eligible_for_trace: (state === 'PIPELINE_TRACE_INPUT_VALID'),
    pipeline_trace_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...traceSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (traceUninspectable(obj, ['purpose', ...TRACE_BUNDLE_SLOTS])) {
      return build('PIPELINE_TRACE_INPUT_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('PIPELINE_TRACE_INPUT_UNCONFIGURED', ['no_pipeline_trace_input']);
    }

    // screen the shallow (non-slot) top level for smuggled flags / commands /
    // secrets / endpoints / mainnet / forbidden field names.
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!TRACE_BUNDLE_SLOTS.includes(k)) shallow[k] = v;
    }
    const shallowReasons = [...traceScreen(shallow)];
    if (traceHasForbiddenFieldName(shallow)) shallowReasons.push('forbidden_field_name_blocked');
    if (shallowReasons.length > 0) {
      return build('PIPELINE_TRACE_INPUT_INVALID', shallowReasons);
    }

    // screen every present slot for smuggle; an unrecognized (raw) object in a slot
    // is refused as a non-result.
    let degraded = false;
    const degradeReasons = [];
    let missing = false;
    for (const stage of TRACE_STAGE_ENUM) {
      const d = TRACE_STAGE_DESCRIPTORS[stage];
      for (const [slot, field, states] of [
        [d.verdict_slot, d.verdict_field, d.verdict_states],
        [d.health_slot, d.health_field, d.health_states]
      ]) {
        const c = obj[slot];
        if (c == null) { missing = true; continue; }
        const screen = traceScreenComponent(c);
        if (screen.length > 0) {
          return build('PIPELINE_TRACE_INPUT_INVALID', ['component_smuggle_blocked']);
        }
        const st = traceReadState(c, field, states);
        if (st === null) {
          // present but not a recognized read-only terminal result of this stage
          return build('PIPELINE_TRACE_INPUT_INVALID', ['component_not_stage_terminal_result']);
        }
        if (d.unconfigured_states.includes(st)) { degraded = true; degradeReasons.push('component_unconfigured'); }
      }
    }

    if (missing) {
      return build('PIPELINE_TRACE_INPUT_DEGRADED', ['required_terminal_result_missing']);
    }
    if (degraded) {
      return build('PIPELINE_TRACE_INPUT_DEGRADED', degradeReasons.length ? degradeReasons : ['component_unconfigured']);
    }
    return build('PIPELINE_TRACE_INPUT_VALID', []);
  } catch {
    return build('PIPELINE_TRACE_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-13 (A) input-boundary result fed forward.
function traceRecognizeInputBoundaryResult(o) {
  return traceReadState(o, 'pipeline_trace_input_state', PIPELINE_TRACE_INPUT_STATES);
}

// ---------------------------------------------------------------------------
// (B) PIPELINE DECISION-TRACE COMPOSER
//
// Produces a deterministic ordered trace_entries array, ONE per stage in the FIXED
// order [signal, risk, intent, route, signing_review, send_review]. Each entry =
// { stage (fixed enum), stage_state (the copied state STRING), decisive_reason
// (from the fixed reason-code allowlist), advanced:boolean, blocked:boolean }. It
// COPIES ONLY stage name + state string + allowlisted reason; NEVER an endpoint /
// serialized / signature / key field. overall_outcome in
// {reviewed_advisory_all_stages, blocked_at_stage, degraded, unconfigured}.
// Read-only; opens nothing.
// ---------------------------------------------------------------------------

const PIPELINE_TRACE_OUTCOMES = Object.freeze([
  'reviewed_advisory_all_stages', 'blocked_at_stage', 'degraded', 'unconfigured'
]);

export function describePipelineDecisionTraceContract() {
  return Object.freeze({
    contract: 'pipeline-decision-trace',
    version: '0.0.0',
    test_only: true,
    supported_stages: TRACE_STAGE_ENUM,
    supported_outcomes: PIPELINE_TRACE_OUTCOMES,
    supported_decisive_reasons: TRACE_DECISIVE_REASON_CODES,
    advisory_only: true,
    overall_outcome: 'unconfigured',
    trace_entries: Object.freeze([]),
    status: 'unconfigured',
    reasons: Object.freeze([]),
    ...traceSafeFlags(),
    note: 'Read-only PIPELINE DECISION-TRACE COMPOSER. Composes a deterministic ordered trace_entries array, ONE entry per stage in the FIXED order [signal, risk, intent, route, signing_review, send_review], from the already-computed TERMINAL RESULTS passed in. Each entry copies ONLY: stage (from the fixed stage enum), stage_state (the recognized terminal state STRING copied verbatim), decisive_reason (from the fixed reason-code allowlist reviewed_advisory/suppressed/advanced_advisory/stage_blocked/stage_rejected/stage_degraded/stage_unconfigured/stage_missing/stage_invalid_result), advanced:boolean, blocked:boolean. It NEVER copies through an endpoint / url / serialized-tx / signed-tx / signature / private-key / secret field from any input — only the name + state + allowlisted reason. overall_outcome is reviewed_advisory_all_stages only when every stage advanced to its terminal-advisory state and nothing blocked; blocked_at_stage if any stage is blocked/rejected/invalid; degraded if any present stage is unconfigured/degraded; unconfigured if a required terminal result is missing or input is hostile. The composer NEVER runs a stage, signs, sends, or broadcasts; can_send / can_broadcast / signer_ready (and every readiness/execution flag) STAY false on every result.'
  });
}

export function evaluatePipelineDecisionTrace(input) {
  const build = (outcome, entries, reasons) => Object.freeze({
    overall_outcome: outcome,
    trace_entries: Object.freeze((entries || []).map((e) => Object.freeze({
      stage: e.stage,
      stage_state: e.stage_state,
      decisive_reason: e.decisive_reason,
      advanced: e.advanced === true,
      blocked: e.blocked === true
    }))),
    status: outcome,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...traceSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (traceUninspectable(obj, ['purpose', ...TRACE_BUNDLE_SLOTS])) {
      return build('unconfigured', [], ['input_inspection_error']);
    }
    if (!obj) {
      return build('unconfigured', [], ['no_pipeline_trace_input']);
    }

    // fail-closed if the input boundary is not VALID (hostile/invalid/missing).
    const boundary = evaluatePipelineDecisionTraceInputBoundary(input);
    if (boundary.pipeline_trace_input_state === 'PIPELINE_TRACE_INPUT_INVALID') {
      return build('blocked_at_stage', [], ['pipeline_trace_input_invalid']);
    }

    const entries = [];
    let anyBlocked = false;
    let anyDegraded = false;
    let anyMissing = false;
    let allAdvanced = true;

    for (const stage of TRACE_STAGE_ENUM) {
      const d = TRACE_STAGE_DESCRIPTORS[stage];
      const c = obj[d.verdict_slot];

      // missing decisive verdict result
      if (c == null) {
        anyMissing = true;
        allAdvanced = false;
        entries.push({ stage, stage_state: 'unavailable', decisive_reason: 'stage_missing', advanced: false, blocked: false });
        continue;
      }
      // smuggled / hostile component -> mark invalid (fail-closed), copy NO value
      if (traceScreenComponent(c).length > 0) {
        anyBlocked = true;
        allAdvanced = false;
        entries.push({ stage, stage_state: 'unavailable', decisive_reason: 'stage_invalid_result', advanced: false, blocked: true });
        continue;
      }
      const st = traceReadState(c, d.verdict_field, d.verdict_states);
      if (st === null) {
        // present but unrecognized terminal result
        anyBlocked = true;
        allAdvanced = false;
        entries.push({ stage, stage_state: 'unavailable', decisive_reason: 'stage_invalid_result', advanced: false, blocked: true });
        continue;
      }

      // classify the (copied) recognized state string
      const blocked = d.blocked_states.includes(st);
      const unconfigured = d.unconfigured_states.includes(st);
      const advanced = d.advanced_states.includes(st);

      let reason;
      if (blocked) {
        // distinguish rejected from blocked where the descriptor lists a *_REJECTED state
        reason = /REJECTED$/.test(st) ? 'stage_rejected' : 'stage_blocked';
        anyBlocked = true;
        allAdvanced = false;
      } else if (unconfigured) {
        reason = 'stage_unconfigured';
        anyDegraded = true;
        allAdvanced = false;
      } else if (advanced) {
        // terminal-advisory: pick the most specific allowlisted reason
        if (/SUPPRESSED$/.test(st)) reason = 'suppressed';
        else if (/(READY_ADVISORY|PASS_ADVISORY|REVIEWED_ADVISORY)$/.test(st)) reason = 'reviewed_advisory';
        else reason = 'advanced_advisory';
      } else {
        // recognized but neither blocked/unconfigured/advanced -> degraded
        reason = 'stage_degraded';
        anyDegraded = true;
        allAdvanced = false;
      }

      entries.push({ stage, stage_state: st, decisive_reason: reason, advanced, blocked });
    }

    let outcome;
    if (anyMissing) outcome = 'unconfigured';
    else if (anyBlocked) outcome = 'blocked_at_stage';
    else if (anyDegraded) outcome = 'degraded';
    else if (allAdvanced) outcome = 'reviewed_advisory_all_stages';
    else outcome = 'degraded';

    return build(outcome, entries, [outcome]);
  } catch {
    return build('unconfigured', [], ['input_inspection_error']);
  }
}

// Recognize a Stage-13 (B) trace result fed forward.
function traceRecognizeTraceResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.overall_outcome === 'string' && PIPELINE_TRACE_OUTCOMES.includes(o.overall_outcome) &&
      Array.isArray(o.trace_entries)) {
    return o.overall_outcome;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (C) PIPELINE HEALTH READ-MODEL
//
// Aggregates every stage HEALTH into pipeline_health_state in
// {PIPELINE_HEALTH_UNCONFIGURED, _BLOCKED, _DEGRADED, _SUPPRESSED,
// _REVIEWED_ADVISORY}. Worst-state-wins fail-safe ordering: BLOCKED beats DEGRADED
// beats SUPPRESSED beats REVIEWED_ADVISORY; any missing -> UNCONFIGURED. NOTE: the
// signing/send-review healths' CLEAN path is *_SUPPRESSED by design
// (always-suppressed upstream), so the pipeline clean path is
// PIPELINE_HEALTH_SUPPRESSED. Opens nothing.
// ---------------------------------------------------------------------------

const PIPELINE_HEALTH_STATES = Object.freeze([
  'PIPELINE_HEALTH_UNCONFIGURED', 'PIPELINE_HEALTH_BLOCKED',
  'PIPELINE_HEALTH_DEGRADED', 'PIPELINE_HEALTH_SUPPRESSED',
  'PIPELINE_HEALTH_REVIEWED_ADVISORY'
]);

// per-stage health-state -> health-tier mapping (worst-state-wins).
// tier rank: blocked(4) > degraded(3) > suppressed(2) > reviewed_advisory(1).
function traceHealthTier(stage, st) {
  if (st == null) return 'unconfigured';
  if (/UNCONFIGURED$/.test(st)) return 'unconfigured';
  if (/BLOCKED$/.test(st)) return 'blocked';
  if (/DEGRADED$/.test(st)) return 'degraded';
  if (/SUPPRESSED$/.test(st)) return 'suppressed';
  if (/(REVIEWED_ADVISORY|READY_ADVISORY|PASS_ADVISORY|PREVIEW_READY|CANDIDATE_REVIEWED|CANDIDATE_RECORDED|AWAITING_ROUTE_REVIEW)$/.test(st)) return 'reviewed_advisory';
  // recognized but otherwise -> degraded fail-safe
  return 'degraded';
}

const TRACE_HEALTH_TIER_RANK = Object.freeze({
  unconfigured: 5, blocked: 4, degraded: 3, suppressed: 2, reviewed_advisory: 1
});

export function describePipelineHealthReadModelContract() {
  return Object.freeze({
    contract: 'pipeline-health-read-model',
    version: '0.0.0',
    test_only: true,
    supported_states: PIPELINE_HEALTH_STATES,
    supported_stages: TRACE_STAGE_ENUM,
    advisory_only: true,
    pipeline_health_state: 'PIPELINE_HEALTH_UNCONFIGURED',
    status: 'PIPELINE_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...traceSafeFlags(),
    note: 'Read-only PIPELINE HEALTH READ-MODEL. Aggregates every stage HEALTH terminal result (signal_health.signal_state, risk_health.risk_health_state, intent_health.intent_health_state, route_health.route_health_state, signing_review_health.signing_review_health_state, send_review_health.send_review_health_state) into pipeline_health_state in {PIPELINE_HEALTH_UNCONFIGURED, PIPELINE_HEALTH_BLOCKED, PIPELINE_HEALTH_DEGRADED, PIPELINE_HEALTH_SUPPRESSED, PIPELINE_HEALTH_REVIEWED_ADVISORY}. Worst-state-wins fail-safe ordering: any missing/unconfigured/hostile -> PIPELINE_HEALTH_UNCONFIGURED; else BLOCKED beats DEGRADED beats SUPPRESSED beats REVIEWED_ADVISORY. NOTE: the signing-review and send-review healths CLEAN path is *_SUPPRESSED by design (always-suppressed suppression upstream), so the standard pipeline clean path is PIPELINE_HEALTH_SUPPRESSED, never REVIEWED_ADVISORY. A smuggled forbidden flag / command / secret / endpoint / forbidden field NAME -> PIPELINE_HEALTH_BLOCKED (never echoed). The read-model NEVER runs a stage, signs, sends, or broadcasts; can_send / can_broadcast / signer_ready (and every readiness/execution flag) STAY false in EVERY state.'
  });
}

export function evaluatePipelineHealthReadModel(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'PIPELINE_HEALTH_BLOCKED'),
    pipeline_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...traceSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (traceUninspectable(obj, ['purpose', ...TRACE_BUNDLE_SLOTS])) {
      return build('PIPELINE_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('PIPELINE_HEALTH_UNCONFIGURED', ['no_pipeline_health_input']);
    }

    // smuggled flags / commands / secrets / endpoints / forbidden NAMES on the
    // shallow level or any health component -> BLOCKED (fail-closed).
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!TRACE_BUNDLE_SLOTS.includes(k)) shallow[k] = v;
    }
    let blocked = traceScreen(shallow).length > 0 || traceHasForbiddenFieldName(shallow);

    let worst = 'reviewed_advisory';
    let anyMissing = false;

    for (const stage of TRACE_STAGE_ENUM) {
      const d = TRACE_STAGE_DESCRIPTORS[stage];
      const c = obj[d.health_slot];
      if (c == null) { anyMissing = true; continue; }
      if (traceScreenComponent(c).length > 0) { blocked = true; continue; }
      const st = traceReadState(c, d.health_field, d.health_states);
      const tier = traceHealthTier(stage, st);
      if (tier === 'unconfigured') { anyMissing = true; continue; }
      if (TRACE_HEALTH_TIER_RANK[tier] > TRACE_HEALTH_TIER_RANK[worst]) worst = tier;
    }

    if (blocked) {
      return build('PIPELINE_HEALTH_BLOCKED', ['pipeline_health_blocked']);
    }
    if (anyMissing) {
      return build('PIPELINE_HEALTH_UNCONFIGURED', ['required_health_result_missing']);
    }
    if (worst === 'blocked') return build('PIPELINE_HEALTH_BLOCKED', ['pipeline_health_blocked']);
    if (worst === 'degraded') return build('PIPELINE_HEALTH_DEGRADED', ['pipeline_health_degraded']);
    if (worst === 'suppressed') return build('PIPELINE_HEALTH_SUPPRESSED', ['pipeline_health_suppressed']);
    return build('PIPELINE_HEALTH_REVIEWED_ADVISORY', ['pipeline_health_reviewed_advisory']);
  } catch {
    return build('PIPELINE_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-13 (C) pipeline-health result fed forward.
function traceRecognizeHealthResult(o) {
  return traceReadState(o, 'pipeline_health_state', PIPELINE_HEALTH_STATES);
}

// ---------------------------------------------------------------------------
// (D) PIPELINE DECISION VERDICT
//
// Aggregates the input boundary (A) + trace (B) + health read-model (C). States
// PIPELINE_DECISION_UNCONFIGURED / _DEGRADED / _BLOCKED / _REVIEWED_ADVISORY.
// _REVIEWED_ADVISORY only when the trace shows every stage advanced to its
// terminal-advisory state and nothing blocked. Even _REVIEWED_ADVISORY opens
// NOTHING (all 24 flags false); "the whole pipeline was reviewed" is carried ONLY
// by pipeline_decision_state / pipeline_decision_reviewed_advisory.
// ---------------------------------------------------------------------------

const PIPELINE_DECISION_STATES = Object.freeze([
  'PIPELINE_DECISION_UNCONFIGURED', 'PIPELINE_DECISION_DEGRADED',
  'PIPELINE_DECISION_BLOCKED', 'PIPELINE_DECISION_REVIEWED_ADVISORY'
]);

export function describePipelineDecisionVerdictContract() {
  return Object.freeze({
    contract: 'pipeline-decision-verdict',
    version: '0.0.0',
    test_only: true,
    supported_states: PIPELINE_DECISION_STATES,
    advisory_only: true,
    valid: false,
    pipeline_decision_state: 'PIPELINE_DECISION_UNCONFIGURED',
    pipeline_decision_reviewed_advisory: false,
    pipeline_decision_blocked: false,
    overall_outcome: 'unconfigured',
    pipeline_health_state: 'PIPELINE_HEALTH_UNCONFIGURED',
    status: 'PIPELINE_DECISION_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...traceSafeFlags(),
    note: 'Read-only PIPELINE DECISION VERDICT. Aggregates the Stage-13 input boundary (A) + decision-trace (B) + pipeline-health read-model (C) into an ADVISORY verdict. A verdict is a READ-ONLY ADVISORY REPRESENTATION ONLY — it COMPOSES the terminal results of the prior stages; it is NOT execution, NOT running a stage, NOT signing, NOT sending, NOT broadcasting, NOT trading/signing/send readiness. Ordering (Fail-Safe-Not-Fail-Open): input boundary PIPELINE_TRACE_INPUT_INVALID / trace blocked_at_stage / health PIPELINE_HEALTH_BLOCKED OR any invalid/smuggled component -> PIPELINE_DECISION_BLOCKED; input boundary not VALID OR a required result missing -> PIPELINE_DECISION_UNCONFIGURED; trace degraded / health degraded -> PIPELINE_DECISION_DEGRADED; PIPELINE_DECISION_REVIEWED_ADVISORY ONLY when the input boundary is VALID, the trace overall_outcome is reviewed_advisory_all_stages (every stage advanced to its terminal-advisory state and nothing blocked), and the health is PIPELINE_HEALTH_SUPPRESSED or PIPELINE_HEALTH_REVIEWED_ADVISORY. CRITICAL: even PIPELINE_DECISION_REVIEWED_ADVISORY opens NOTHING — every readiness/execution flag (can_send / can_broadcast / signer_ready / signing_permitted / broadcast_permitted / ...) STAYS false; "the whole pipeline was reviewed end-to-end" is carried ONLY by pipeline_decision_state / pipeline_decision_reviewed_advisory.'
  });
}

export function evaluatePipelineDecisionVerdict(input) {
  const build = (state, outcome, healthState, reasons) => Object.freeze({
    valid: (state !== 'PIPELINE_DECISION_BLOCKED'),
    pipeline_decision_state: state,
    pipeline_decision_reviewed_advisory: (state === 'PIPELINE_DECISION_REVIEWED_ADVISORY'),
    pipeline_decision_blocked: (state === 'PIPELINE_DECISION_BLOCKED'),
    overall_outcome: outcome,
    pipeline_health_state: healthState,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...traceSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (traceUninspectable(obj, ['purpose', ...TRACE_BUNDLE_SLOTS])) {
      return build('PIPELINE_DECISION_UNCONFIGURED', 'unconfigured', 'PIPELINE_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('PIPELINE_DECISION_UNCONFIGURED', 'unconfigured', 'PIPELINE_HEALTH_UNCONFIGURED', ['no_pipeline_decision_input']);
    }

    const boundary = evaluatePipelineDecisionTraceInputBoundary(input);
    const trace = evaluatePipelineDecisionTrace(input);
    const health = evaluatePipelineHealthReadModel(input);

    const boundaryState = traceRecognizeInputBoundaryResult(boundary);
    const outcome = traceRecognizeTraceResult(trace) || 'unconfigured';
    const healthState = traceRecognizeHealthResult(health) || 'PIPELINE_HEALTH_UNCONFIGURED';

    // BLOCKED: invalid boundary / blocked trace / blocked health
    if (boundaryState === 'PIPELINE_TRACE_INPUT_INVALID' ||
        outcome === 'blocked_at_stage' ||
        healthState === 'PIPELINE_HEALTH_BLOCKED') {
      return build('PIPELINE_DECISION_BLOCKED', outcome, healthState, ['pipeline_decision_blocked']);
    }

    // UNCONFIGURED: boundary not VALID OR required result missing
    if (boundaryState !== 'PIPELINE_TRACE_INPUT_VALID' ||
        outcome === 'unconfigured' ||
        healthState === 'PIPELINE_HEALTH_UNCONFIGURED') {
      return build('PIPELINE_DECISION_UNCONFIGURED', outcome, healthState, ['pipeline_decision_unconfigured']);
    }

    // REVIEWED_ADVISORY: end-to-end advanced + nothing blocked + health clean
    if (outcome === 'reviewed_advisory_all_stages' &&
        (healthState === 'PIPELINE_HEALTH_SUPPRESSED' ||
         healthState === 'PIPELINE_HEALTH_REVIEWED_ADVISORY')) {
      return build('PIPELINE_DECISION_REVIEWED_ADVISORY', outcome, healthState, ['pipeline_decision_reviewed_advisory']);
    }

    // else -> DEGRADED (fail-closed)
    return build('PIPELINE_DECISION_DEGRADED', outcome, healthState, ['pipeline_decision_degraded']);
  } catch {
    return build('PIPELINE_DECISION_UNCONFIGURED', 'unconfigured', 'PIPELINE_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-13 (D) verdict result fed forward.
function traceRecognizeVerdictResult(o) {
  return traceReadState(o, 'pipeline_decision_state', PIPELINE_DECISION_STATES);
}

// ---------------------------------------------------------------------------
// (E) PIPELINE DECISION SUPPRESSION
//
// ALWAYS suppressed:true; ALWAYS carries not_execution_authorized,
// not_sign_authorized, not_send_authorized on EVERY path. A decision-trace is
// NEVER execution / sign / send authorized at this layer, so the not_*_authorized
// reasons are ALWAYS emitted. Suppression opens NOTHING.
// ---------------------------------------------------------------------------

const PIPELINE_DECISION_SUPPRESSION_REASON_CODES = Object.freeze([
  'pipeline_blocked', 'pipeline_unconfigured', 'pipeline_degraded',
  'stage_blocked_detected', 'not_execution_authorized', 'not_sign_authorized',
  'not_send_authorized'
]);

const PIPELINE_DECISION_SUPPRESSION_ALWAYS = Object.freeze([
  'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
]);

export function describePipelineDecisionSuppressionContract() {
  return Object.freeze({
    contract: 'pipeline-decision-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: PIPELINE_DECISION_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: true,
    not_execution_authorized: true,
    not_sign_authorized: true,
    not_send_authorized: true,
    suppression_reasons: Object.freeze([
      'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
    ]),
    status: 'PIPELINE_DECISION_SUPPRESSED',
    reasons: Object.freeze([
      'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
    ]),
    ...traceSafeFlags(),
    note: 'Read-only PIPELINE DECISION SUPPRESSION. A decision-trace is NEVER execution / sign / send authorized at this layer — it only COMPOSES prior-stage terminal results. Therefore suppressed is ALWAYS true and not_execution_authorized + not_sign_authorized + not_send_authorized are ALWAYS included on EVERY path (even a fully end-to-end reviewed-advisory pipeline is STILL suppressed for execution/sign/send). Suppression opens NOTHING — every readiness/execution flag (can_send / can_broadcast / signer_ready / signing_permitted / broadcast_permitted / ...) STAYS false. It additionally surfaces pipeline_blocked / pipeline_unconfigured / pipeline_degraded / stage_blocked_detected when the composed verdict/trace indicates them, but these are advisory reasons only and never relax the always-on not_*_authorized suppression. Hostile / throwing / missing input -> still suppressed (fail-closed), never throws.'
  });
}

export function evaluatePipelineDecisionSuppression(input) {
  const build = (reasonCodes) => {
    const codes = [...new Set([...(reasonCodes || []), ...PIPELINE_DECISION_SUPPRESSION_ALWAYS])]
      .filter((c) => PIPELINE_DECISION_SUPPRESSION_REASON_CODES.includes(c));
    return Object.freeze({
      suppressed: true,
      not_execution_authorized: true,
      not_sign_authorized: true,
      not_send_authorized: true,
      suppression_reasons: Object.freeze(codes),
      status: 'PIPELINE_DECISION_SUPPRESSED',
      reasons: Object.freeze(codes),
      read_only: true,
      advisory_only: true,
      ...traceSafeFlags()
    });
  };
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (traceUninspectable(obj, ['purpose', ...TRACE_BUNDLE_SLOTS,
      'pipeline_decision_verdict', 'pipeline_decision_trace'])) {
      return build([]);
    }
    if (!obj) {
      return build([]);
    }

    const codes = [];

    // if a verdict result is fed forward, surface its tier as an advisory reason.
    const verdict = obj.pipeline_decision_verdict;
    const vState = traceRecognizeVerdictResult(verdict);
    if (vState === 'PIPELINE_DECISION_BLOCKED') codes.push('pipeline_blocked');
    else if (vState === 'PIPELINE_DECISION_UNCONFIGURED') codes.push('pipeline_unconfigured');
    else if (vState === 'PIPELINE_DECISION_DEGRADED') codes.push('pipeline_degraded');

    // if a trace result is fed forward, surface a blocked stage.
    const trace = obj.pipeline_decision_trace;
    const tOutcome = traceRecognizeTraceResult(trace);
    if (tOutcome === 'blocked_at_stage') codes.push('stage_blocked_detected');

    return build(codes);
  } catch {
    return build([]);
  }
}

// Recognize a Stage-13 (E) suppression result fed forward.
function traceRecognizeSuppressionResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (o.suppressed === true && Array.isArray(o.suppression_reasons)) return true;
  return null;
}

// ---------------------------------------------------------------------------
// (F) PIPELINE FORBIDDEN SURFACE GUARD
//
// Scans TOP-LEVEL keys against the frozen forbidden-NAME list (key material + live
// names). Any forbidden name -> PIPELINE_SURFACE_BLOCKED, forbidden_field_ref =
// NAME only (REDACTED; VALUE absent from JSON.stringify). The detection booleans
// (key_material_detected / live_surface_detected / forbidden_field_detected) are
// DETECTION outputs (true == found == BLOCKED == SAFE); they are NOT readiness
// flags. Hostile -> PIPELINE_SURFACE_UNCONFIGURED, never throws.
// ---------------------------------------------------------------------------

const PIPELINE_SURFACE_STATES = Object.freeze([
  'PIPELINE_SURFACE_UNCONFIGURED', 'PIPELINE_SURFACE_CLEAN',
  'PIPELINE_SURFACE_BLOCKED'
]);

// key-material NAMES (vs live/endpoint NAMES). A key-material match sets
// key_material_detected; a live name match sets live_surface_detected. Both set
// forbidden_field_detected.
const PIPELINE_SURFACE_KEY_MATERIAL_NAMES = Object.freeze([
  'private_key', 'secret_key', 'keypair', 'mnemonic', 'seed', 'signing_key',
  'signature', 'signed_tx', 'signed_transaction'
]);
const PIPELINE_SURFACE_LIVE_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'rpc_url', 'provider_url', 'node_url', 'ws_url',
  'serialized_tx', 'serialized_transaction', 'wire_transaction', 'raw_tx',
  'raw_transaction', 'tx_bytes', 'message_bytes', 'broadcast_payload', 'send_payload'
]);
const PIPELINE_SURFACE_FORBIDDEN_NAMES = Object.freeze([
  ...PIPELINE_SURFACE_KEY_MATERIAL_NAMES, ...PIPELINE_SURFACE_LIVE_NAMES
]);

export function describePipelineForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'pipeline-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    supported_states: PIPELINE_SURFACE_STATES,
    forbidden_field_names: PIPELINE_SURFACE_FORBIDDEN_NAMES,
    advisory_only: true,
    pipeline_surface_state: 'PIPELINE_SURFACE_UNCONFIGURED',
    key_material_detected: false,
    live_surface_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'PIPELINE_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...traceSafeFlags(),
    note: 'Read-only PIPELINE FORBIDDEN SURFACE GUARD. Proves the Stage-13 composer neither produces nor accepts key-material (private_key / secret_key / keypair / mnemonic / seed / signing_key / signature / signed_tx / signed_transaction) OR live-surface (endpoint / endpoint_url / rpc_url / provider_url / node_url / ws_url / serialized_tx / serialized_transaction / wire_transaction / raw_tx / raw_transaction / tx_bytes / message_bytes / broadcast_payload / send_payload) material. It scans ONLY top-level keys (deterministic, bounded, pure). The detection booleans key_material_detected / live_surface_detected / forbidden_field_detected are DETECTION outputs (true == a forbidden field NAME was found == the SAFE BLOCKED state); they are NOT readiness/execution flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing / hostile input -> PIPELINE_SURFACE_UNCONFIGURED (frozen, never throws); a clean object with NONE of the forbidden names present -> PIPELINE_SURFACE_CLEAN (all detection booleans false); ANY forbidden name present at top level -> PIPELINE_SURFACE_BLOCKED (forbidden_field_detected:true, key_material_detected:true for a key-material name, live_surface_detected:true for a live name, forbidden_field_ref = the matched NAME). A BLOCKED result keeps all 24 readiness/execution flags false. Opens NOTHING.'
  });
}

export function evaluatePipelineForbiddenSurface(input) {
  const build = (state, kind, ref, reasons) => Object.freeze({
    pipeline_surface_state: state,
    key_material_detected: (state === 'PIPELINE_SURFACE_BLOCKED') ? (kind === 'key') : false,
    live_surface_detected: (state === 'PIPELINE_SURFACE_BLOCKED') ? (kind === 'live') : false,
    forbidden_field_detected: (state === 'PIPELINE_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'PIPELINE_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...traceSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (traceUninspectable(obj, [...PIPELINE_SURFACE_FORBIDDEN_NAMES])) {
      return build('PIPELINE_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('PIPELINE_SURFACE_UNCONFIGURED', null, null, ['no_pipeline_surface_input']);
    }
    let keys;
    try {
      keys = Object.keys(obj);
    } catch {
      return build('PIPELINE_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    // scan top-level keys only; first matched NAME (deterministic order) wins
    for (const k of keys) {
      if (PIPELINE_SURFACE_FORBIDDEN_NAMES.includes(k)) {
        const kind = PIPELINE_SURFACE_KEY_MATERIAL_NAMES.includes(k) ? 'key' : 'live';
        // forbidden_field_ref = the matched NAME only (REDACTED); NEVER the VALUE
        return build('PIPELINE_SURFACE_BLOCKED', kind, k,
          [kind === 'key' ? 'key_material_detected' : 'live_surface_detected']);
      }
    }
    return build('PIPELINE_SURFACE_CLEAN', null, null, ['pipeline_surface_clean']);
  } catch {
    return build('PIPELINE_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// Recognize a Stage-13 (F) surface result fed forward.
function traceRecognizeSurfaceResult(o) {
  return traceReadState(o, 'pipeline_surface_state', PIPELINE_SURFACE_STATES);
}

// ---------------------------------------------------------------------------
// (G) PIPELINE DECISION HEALTH
//
// Aggregates A + B + C + D + E + F + the surface guard into
// PIPELINE_DECISION_HEALTH_UNCONFIGURED / _DEGRADED / _REVIEWED_ADVISORY /
// _SUPPRESSED / _BLOCKED. Because suppression is always-suppressed, the standard
// clean path -> _SUPPRESSED; _REVIEWED_ADVISORY only with an explicit not-suppressed
// object and STILL opens nothing. Surface BLOCKED / verdict BLOCKED / invalid
// component -> _BLOCKED. Opens nothing on every state.
// ---------------------------------------------------------------------------

const PIPELINE_DECISION_HEALTH_STATES = Object.freeze([
  'PIPELINE_DECISION_HEALTH_UNCONFIGURED', 'PIPELINE_DECISION_HEALTH_DEGRADED',
  'PIPELINE_DECISION_HEALTH_REVIEWED_ADVISORY', 'PIPELINE_DECISION_HEALTH_SUPPRESSED',
  'PIPELINE_DECISION_HEALTH_BLOCKED'
]);

const PIPELINE_DECISION_HEALTH_COMPONENTS = Object.freeze([
  'pipeline_trace_input_boundary', 'pipeline_decision_trace',
  'pipeline_health_read_model', 'pipeline_decision_verdict',
  'pipeline_decision_suppression', 'pipeline_forbidden_surface'
]);

export function describePipelineDecisionHealthContract() {
  return Object.freeze({
    contract: 'pipeline-decision-health',
    version: '0.0.0',
    test_only: true,
    supported_states: PIPELINE_DECISION_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    pipeline_decision_health_state: 'PIPELINE_DECISION_HEALTH_UNCONFIGURED',
    status: 'PIPELINE_DECISION_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...traceSafeFlags(),
    note: 'Read-only PIPELINE DECISION HEALTH. Aggregates the Stage-13 input boundary (A) + decision-trace (B) + pipeline-health read-model (C) + decision verdict (D) + decision suppression (E) + forbidden-surface guard (F) and DERIVES STATUS ONLY into {PIPELINE_DECISION_HEALTH_UNCONFIGURED, PIPELINE_DECISION_HEALTH_DEGRADED, PIPELINE_DECISION_HEALTH_REVIEWED_ADVISORY, PIPELINE_DECISION_HEALTH_SUPPRESSED, PIPELINE_DECISION_HEALTH_BLOCKED}. Every state keeps all 24 readiness/execution flags false; even REVIEWED_ADVISORY opens NOTHING. Ordering (Fail-Safe-Not-Fail-Open): a smuggled forbidden flag / command / secret / endpoint / forbidden field NAME (top-level or any component) / forbidden-surface PIPELINE_SURFACE_BLOCKED / verdict PIPELINE_DECISION_BLOCKED / invalid input boundary -> PIPELINE_DECISION_HEALTH_BLOCKED; a missing required component -> PIPELINE_DECISION_HEALTH_UNCONFIGURED; because the always-suppressed suppression layer reports suppressed:true, the standard clean path -> PIPELINE_DECISION_HEALTH_SUPPRESSED; PIPELINE_DECISION_HEALTH_REVIEWED_ADVISORY ONLY when an explicit not-suppressed suppression object is supplied AND the verdict is PIPELINE_DECISION_REVIEWED_ADVISORY (and STILL opens nothing); otherwise -> PIPELINE_DECISION_HEALTH_DEGRADED.'
  });
}

export function evaluatePipelineDecisionHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'PIPELINE_DECISION_HEALTH_BLOCKED'),
    pipeline_decision_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...traceSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (traceUninspectable(obj, [...PIPELINE_DECISION_HEALTH_COMPONENTS])) {
      return build('PIPELINE_DECISION_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('PIPELINE_DECISION_HEALTH_UNCONFIGURED', ['no_pipeline_decision_health_input']);
    }

    const boundary = obj.pipeline_trace_input_boundary;
    const trace = obj.pipeline_decision_trace;
    const healthModel = obj.pipeline_health_read_model;
    const verdict = obj.pipeline_decision_verdict;
    const suppression = obj.pipeline_decision_suppression;
    const surface = obj.pipeline_forbidden_surface;

    // smuggled forbidden flag / command / secret / endpoint / forbidden NAME on the
    // shallow level or any component -> BLOCKED.
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!PIPELINE_DECISION_HEALTH_COMPONENTS.includes(k)) shallow[k] = v;
    }
    let blocked = traceScreen(shallow).length > 0 || traceHasForbiddenFieldName(shallow);
    for (const k of PIPELINE_DECISION_HEALTH_COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      if (traceScreenComponent(c).length > 0) blocked = true;
    }
    if (blocked) {
      return build('PIPELINE_DECISION_HEALTH_BLOCKED', ['forbidden_input_blocked']);
    }

    const boundaryState = traceRecognizeInputBoundaryResult(boundary);
    const traceOutcome = traceRecognizeTraceResult(trace);
    const healthState = traceRecognizeHealthResult(healthModel);
    const verdictState = traceRecognizeVerdictResult(verdict);
    const surfaceState = traceRecognizeSurfaceResult(surface);
    const suppressedVal = traceRecognizeSuppressionResult(suppression);

    // hard-block: surface blocked / verdict blocked / invalid boundary / blocked trace/health
    if (surfaceState === 'PIPELINE_SURFACE_BLOCKED' ||
        verdictState === 'PIPELINE_DECISION_BLOCKED' ||
        boundaryState === 'PIPELINE_TRACE_INPUT_INVALID' ||
        traceOutcome === 'blocked_at_stage' ||
        healthState === 'PIPELINE_HEALTH_BLOCKED') {
      return build('PIPELINE_DECISION_HEALTH_BLOCKED', ['pipeline_decision_health_blocked']);
    }

    // missing any required component -> UNCONFIGURED
    if (boundary == null || trace == null || healthModel == null ||
        verdict == null || suppression == null || surface == null ||
        boundaryState === null || traceOutcome === null || healthState === null ||
        verdictState === null || surfaceState === null) {
      return build('PIPELINE_DECISION_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // explicit not-suppressed object -> REVIEWED_ADVISORY only when verdict reviewed-advisory
    if (suppression.suppressed === false) {
      if (verdictState === 'PIPELINE_DECISION_REVIEWED_ADVISORY') {
        return build('PIPELINE_DECISION_HEALTH_REVIEWED_ADVISORY', ['pipeline_decision_reviewed_advisory']);
      }
      return build('PIPELINE_DECISION_HEALTH_DEGRADED', ['pipeline_decision_health_degraded']);
    }

    // always-suppressed clean path -> SUPPRESSED (when verdict reviewed-advisory)
    if (suppressedVal === true && verdictState === 'PIPELINE_DECISION_REVIEWED_ADVISORY') {
      return build('PIPELINE_DECISION_HEALTH_SUPPRESSED', ['pipeline_decision_suppressed']);
    }

    // suppressed but verdict not fully reviewed -> DEGRADED (fail-closed)
    return build('PIPELINE_DECISION_HEALTH_DEGRADED', ['pipeline_decision_health_degraded']);
  } catch {
    return build('PIPELINE_DECISION_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
