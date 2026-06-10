// @soltrade/paper-execution-foundations
//
// SIMULATED-ONLY / read-only PAPER EXECUTION ENGINE foundation for Stage-14
// (Phase B opener) of the architecture pipeline `data -> signal -> risk ->
// intent -> route -> sign -> send`. This package builds ONLY a paper-execution
// input boundary, a candidate paper-fill DESCRIPTOR, a pure FIFO PAPER P&L
// READ-MODEL, a paper outcome classifier, an always-suppressed suppression
// layer, a forbidden-surface guard, and a paper-execution health read-model.
// It CONSUMES the already-computed Stage-13 pipeline-decision terminal results
// and caller-supplied simulated fill records PASSED IN as args. Import-free,
// pure, deterministic. NO clock, NO RNG, NO network primitive, NO live stream,
// NO live quote, NO RPC/route call, NO signing, NO sending, NO broadcasting,
// NO SignerService activation, NO private key / seed / mnemonic / keypair
// material, no persistence, no secrets, no mutable module/global state.
//
// THE CORE RULE: a paper fill / paper P&L read-model is a SIMULATED-ONLY
// ADVISORY REPRESENTATION — every fill/result carries simulated:true and
// is_valid_on_chain:false and is NEVER presented or stored as real (no
// Paper/Real mixing). Paper P&L is a backend read-model only, never UX truth.
// It is NOT execution, NOT a permission, NOT trading/signing/send readiness.
// can_send / can_broadcast / signer_ready / signing_permitted /
// broadcast_permitted (and every other readiness/execution flag) ALL STAY
// false on every result of every state — a paper FILLED/PASS state NEVER
// flips any readiness/execution flag and the send gate keeps refusing with
// no paper bypass. Hostile, throwing, or uninspectable input returns a FROZEN
// refusal and NEVER throws. Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract
// identifier, NOT an SSOT name — EXCEPT the already-registered candidate
// FIELD names reused from the paper-portfolio precedent
// (candidate_realized_pnl, candidate_unrealized_pnl, candidate_fees_total,
// candidate_slippage_cost, candidate_paper_pnl, candidate_pnl_by_wallet,
// candidate_pnl_by_copy_mode, candidate_pnl_by_brain, candidate_mark_status —
// the mark bucket VALUE strings valid/stale/unavailable/low_confidence/
// display_only are consumed-only). The deferred SSOT enum for paper outcomes
// is NOT used: the outcome classifier uses LOCAL state names only. Field
// names like endpoint / rpc_url / serialized_tx / signed_transaction /
// signature / message_bytes / private_key / keypair / mnemonic / seed appear
// ONLY as fixed string literals inside forbidden-NAME allowlist arrays and
// prose — never as real objects, calls, or emitted forbidden output keys, and
// a VALUE is NEVER echoed (the (B) descriptor's fixed literal signature:null
// is the sole, provably-null exception that PROVES nothing was signed).

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function paperSafeFlags() {
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

// the 24 non-read_only flags above — none may EVER be true on input or output;
// a paper fill / paper P&L composition NEVER flips any.
const PAPER_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
]);

const PAPER_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell_order', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute', 'rpc_call',
  'connect_rpc', 'send_transaction', 'broadcast_transaction', 'run_stage',
  'run_pipeline', 'execute_pipeline'
]);

const PAPER_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential|signing_key|signer_secret/i;
const PAPER_URL_RE = /https?:\/\/|wss?:\/\//i;
const PAPER_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known consumed-only fields exempt from the secret-NAME scan
// (their values are still scanned for URL/secret/mainnet substrings).
const PAPER_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'position_ref', 'wallet_ref', 'paper_fill_ref',
  'copy_mode_bucket', 'brain_bucket', 'latency_bucket', 'failure_origin_bucket'
]);

function paperHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of PAPER_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function paperHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (PAPER_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function paperHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (PAPER_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (PAPER_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function paperHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (PAPER_URL_RE.test(v) || PAPER_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function paperScreen(o) {
  const r = [];
  if (paperHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (paperHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (paperHasSecretField(o)) r.push('secret_field_blocked');
  if (paperHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function paperUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// shared forbidden field NAMES — key material + live surfaces — that MUST NOT
// appear as a key in ANY paper input component or any output. These appear
// ONLY as fixed string literals in this allowlist + prose; the guard NEVER
// echoes VALUES.
const PAPER_SURFACE_KEY_MATERIAL_NAMES = Object.freeze([
  'private_key', 'secret_key', 'keypair', 'mnemonic', 'seed', 'signing_key',
  'signature', 'signed_tx', 'signed_transaction'
]);
const PAPER_SURFACE_LIVE_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'rpc_url', 'provider_url', 'node_url', 'ws_url',
  'serialized_tx', 'serialized_transaction', 'wire_transaction', 'raw_tx',
  'raw_transaction', 'tx_bytes', 'message_bytes', 'broadcast_payload', 'send_payload'
]);
const PAPER_SURFACE_FORBIDDEN_NAMES = Object.freeze([
  ...PAPER_SURFACE_KEY_MATERIAL_NAMES, ...PAPER_SURFACE_LIVE_NAMES
]);

// forbidden NAME present as a key. allowNullSignature exempts the (B)
// descriptor's fixed literal signature:null (provably null — never a value).
function paperHasForbiddenFieldName(o, { allowNullSignature = false } = {}) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (!PAPER_SURFACE_FORBIDDEN_NAMES.includes(String(k))) continue;
    if (allowNullSignature && k === 'signature' && o[k] === null) continue;
    return true;
  }
  return false;
}

// Read a recognized state STRING from a read-only result object given a
// (field-name, allowed-values) descriptor. Returns the state string, or null.
function paperReadState(o, field, allowed) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  const v = o[field];
  if (typeof v === 'string' && allowed.includes(v)) return v;
  return null;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;

// consumed-only candidate_mark_status bucket VALUE strings (G22 — consumed,
// never re-defined): a mark contributes unrealized truth ONLY when 'valid'.
const PAPER_MARK_STATUS_BUCKETS = Object.freeze([
  'valid', 'stale', 'unavailable', 'low_confidence', 'display_only'
]);

const PAPER_LATENCY_BUCKETS = Object.freeze(['unknown', 'low', 'medium', 'high']);

// ---------------------------------------------------------------------------
// Stage-13 terminal-result recognizers (consumed-only state strings).
// ---------------------------------------------------------------------------

const PAPER_PIPELINE_DECISION_STATES = Object.freeze([
  'PIPELINE_DECISION_UNCONFIGURED', 'PIPELINE_DECISION_DEGRADED',
  'PIPELINE_DECISION_BLOCKED', 'PIPELINE_DECISION_REVIEWED_ADVISORY'
]);
const PAPER_PIPELINE_DECISION_HEALTH_STATES = Object.freeze([
  'PIPELINE_DECISION_HEALTH_UNCONFIGURED', 'PIPELINE_DECISION_HEALTH_DEGRADED',
  'PIPELINE_DECISION_HEALTH_REVIEWED_ADVISORY', 'PIPELINE_DECISION_HEALTH_SUPPRESSED',
  'PIPELINE_DECISION_HEALTH_BLOCKED'
]);

// raw upstream-result MARKERS: a raw earlier-stage result or a raw Stage-13
// trace bundle in the paper-execution input is REFUSED — only the Stage-13
// pipeline-decision VERDICT (and optionally its health) is accepted.
const PAPER_RAW_UPSTREAM_MARKER_KEYS = Object.freeze([
  // raw trace-bundle slots
  'signal_health', 'risk_verdict', 'risk_health', 'intent_terminal',
  'intent_health', 'route_verdict', 'route_health', 'signing_review_verdict',
  'signing_review_health', 'send_review_verdict', 'send_review_health',
  // raw earlier-stage terminal state fields
  'signal_state', 'risk_verdict_state', 'risk_health_state', 'intent_state',
  'intent_health_state', 'execution_plan_preview_state', 'route_health_state',
  'signing_review_state', 'signing_review_health_state', 'send_review_state',
  'send_review_health_state', 'trace_entries'
]);

function paperLooksLikeRawUpstream(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of PAPER_RAW_UPSTREAM_MARKER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(o, k)) return true;
  }
  return false;
}

// Full hostile/smuggle screen for a single component result object.
function paperScreenComponent(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (paperHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (paperHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (paperHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (paperHasForbiddenFieldName(c)) r.push('forbidden_field_name_blocked');
  return r;
}

// ---------------------------------------------------------------------------
// (A) PAPER-EXECUTION INPUT BOUNDARY
//
// Verifies the paper-execution input carries the Stage-13 pipeline-decision
// VERDICT terminal result (recognized ONLY by read_only:true +
// pipeline_decision_state) and optionally the Stage-13 decision-health result.
// eligible_for_paper_execution ONLY when pipeline_decision_state ===
// 'PIPELINE_DECISION_REVIEWED_ADVISORY'. A raw earlier-stage result / raw
// trace bundle is REFUSED (raw_non_pipeline_decision_input_refused). A VALID
// boundary opens NOTHING — paper execution is simulation, never permission.
// ---------------------------------------------------------------------------

const PAPER_EXEC_INPUT_STATES = Object.freeze([
  'PAPER_EXEC_INPUT_UNCONFIGURED', 'PAPER_EXEC_INPUT_INVALID',
  'PAPER_EXEC_INPUT_DEGRADED', 'PAPER_EXEC_INPUT_VALID'
]);

const PAPER_EXEC_INPUT_SLOTS = Object.freeze([
  'pipeline_decision_verdict', 'pipeline_decision_health'
]);

export function describePaperExecutionInputBoundaryContract() {
  return Object.freeze({
    contract: 'paper-execution-input-boundary',
    version: '0.0.0',
    test_only: true,
    simulated: true,
    supported_states: PAPER_EXEC_INPUT_STATES,
    supported_slots: PAPER_EXEC_INPUT_SLOTS,
    advisory_only: true,
    paper_exec_input_state: 'PAPER_EXEC_INPUT_UNCONFIGURED',
    paper_exec_input_boundary_valid: false,
    eligible_for_paper_execution: false,
    status: 'PAPER_EXEC_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...paperSafeFlags(),
    note: 'Simulated-only PAPER-EXECUTION INPUT boundary (Stage-14 / Phase B). Verifies the paper-execution input carries the already-computed Stage-13 PIPELINE-DECISION VERDICT terminal result (recognized ONLY by read_only:true + pipeline_decision_state) and optionally the Stage-13 decision-health result. eligible_for_paper_execution is true ONLY when pipeline_decision_state === PIPELINE_DECISION_REVIEWED_ADVISORY — and even then it marks SIMULATION eligibility only: NOT execution, NOT live, NOT a permission, NOT trading/signing/send readiness. Fail-Safe-Not-Fail-Open: missing/unrecognized/hostile input -> PAPER_EXEC_INPUT_UNCONFIGURED; a raw earlier-stage result or a raw Stage-13 trace bundle -> PAPER_EXEC_INPUT_INVALID (raw_non_pipeline_decision_input_refused); a smuggled forbidden trading flag / execution command / secret / endpoint / mainnet / forbidden field NAME -> PAPER_EXEC_INPUT_INVALID (never echoed); verdict missing or not REVIEWED_ADVISORY -> PAPER_EXEC_INPUT_DEGRADED. The boundary NEVER signs, sends, or broadcasts; can_send / can_broadcast / signer_ready (and every readiness/execution flag) STAY false in EVERY state.'
  });
}

export function evaluatePaperExecutionInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'PAPER_EXEC_INPUT_INVALID'),
    paper_exec_input_boundary_valid: (state === 'PAPER_EXEC_INPUT_VALID'),
    eligible_for_paper_execution: (state === 'PAPER_EXEC_INPUT_VALID'),
    paper_exec_input_state: state,
    status: state,
    simulated: true,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...paperSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (paperUninspectable(obj, ['purpose', ...PAPER_EXEC_INPUT_SLOTS])) {
      return build('PAPER_EXEC_INPUT_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('PAPER_EXEC_INPUT_UNCONFIGURED', ['no_paper_exec_input']);
    }

    // a raw trace bundle / raw earlier-stage result passed as the input itself
    // (instead of a Stage-13 pipeline-decision verdict) is refused.
    if (paperLooksLikeRawUpstream(obj)) {
      return build('PAPER_EXEC_INPUT_INVALID', ['raw_non_pipeline_decision_input_refused']);
    }

    // screen the shallow (non-slot) top level for smuggled flags / commands /
    // secrets / endpoints / mainnet / forbidden field names.
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!PAPER_EXEC_INPUT_SLOTS.includes(k)) shallow[k] = v;
    }
    const shallowReasons = [...paperScreen(shallow)];
    if (paperHasForbiddenFieldName(shallow)) shallowReasons.push('forbidden_field_name_blocked');
    if (shallowReasons.length > 0) {
      return build('PAPER_EXEC_INPUT_INVALID', shallowReasons);
    }

    const verdict = obj.pipeline_decision_verdict;
    if (verdict == null) {
      return build('PAPER_EXEC_INPUT_DEGRADED', ['pipeline_decision_verdict_missing']);
    }
    if (paperScreenComponent(verdict).length > 0) {
      return build('PAPER_EXEC_INPUT_INVALID', ['component_smuggle_blocked']);
    }
    const vState = paperReadState(verdict, 'pipeline_decision_state', PAPER_PIPELINE_DECISION_STATES);
    if (vState === null) {
      // present but not a recognized Stage-13 pipeline-decision verdict
      // (covers a raw earlier-stage result / a raw trace bundle in the slot)
      return build('PAPER_EXEC_INPUT_INVALID', ['raw_non_pipeline_decision_input_refused']);
    }

    // optional Stage-13 decision-health result
    const health = obj.pipeline_decision_health;
    let healthDegraded = false;
    if (health != null) {
      if (paperScreenComponent(health).length > 0) {
        return build('PAPER_EXEC_INPUT_INVALID', ['component_smuggle_blocked']);
      }
      const hState = paperReadState(health, 'pipeline_decision_health_state', PAPER_PIPELINE_DECISION_HEALTH_STATES);
      if (hState === null) {
        return build('PAPER_EXEC_INPUT_INVALID', ['raw_non_pipeline_decision_input_refused']);
      }
      if (hState === 'PIPELINE_DECISION_HEALTH_BLOCKED' ||
          hState === 'PIPELINE_DECISION_HEALTH_DEGRADED' ||
          hState === 'PIPELINE_DECISION_HEALTH_UNCONFIGURED') {
        healthDegraded = true;
      }
    }

    if (vState !== 'PIPELINE_DECISION_REVIEWED_ADVISORY') {
      return build('PAPER_EXEC_INPUT_DEGRADED', ['pipeline_decision_not_reviewed_advisory']);
    }
    if (healthDegraded) {
      return build('PAPER_EXEC_INPUT_DEGRADED', ['pipeline_decision_health_not_clean']);
    }
    return build('PAPER_EXEC_INPUT_VALID', []);
  } catch {
    return build('PAPER_EXEC_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-14 (A) input-boundary result fed forward.
function paperRecognizeInputBoundaryResult(o) {
  return paperReadState(o, 'paper_exec_input_state', PAPER_EXEC_INPUT_STATES);
}

// ---------------------------------------------------------------------------
// (B) CANDIDATE PAPER-FILL DESCRIPTOR
//
// Validates a caller-supplied SIMULATED fill record into a frozen descriptor.
// Output is a fixed-literal proof of non-execution: simulated:true,
// is_valid_on_chain:false, executed:false, signed:false, signature:null. A
// fill claiming on-chain validity / execution / signing, or carrying a
// forbidden surface field, is REJECTED (fail-closed). Fills only compose
// when the (A) boundary result — when supplied — is VALID.
// ---------------------------------------------------------------------------

const CANDIDATE_PAPER_FILL_STATES = Object.freeze([
  'CANDIDATE_PAPER_FILL_UNCONFIGURED', 'CANDIDATE_PAPER_FILL_INVALID',
  'CANDIDATE_PAPER_FILL_REJECTED', 'CANDIDATE_PAPER_FILL_DESCRIPTOR'
]);

export function describeCandidatePaperFillContract() {
  return Object.freeze({
    contract: 'candidate-paper-fill',
    version: '0.0.0',
    test_only: true,
    simulated: true,
    supported_states: CANDIDATE_PAPER_FILL_STATES,
    supported_latency_buckets: PAPER_LATENCY_BUCKETS,
    advisory_only: true,
    paper_fill_kind: 'candidate_paper_fill',
    paper_fill_state: 'CANDIDATE_PAPER_FILL_UNCONFIGURED',
    is_valid_on_chain: false,
    executed: false,
    signed: false,
    signature: null,
    status: 'CANDIDATE_PAPER_FILL_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...paperSafeFlags(),
    note: 'Simulated-only CANDIDATE PAPER-FILL DESCRIPTOR (Stage-14 / Phase B). Validates a caller-supplied simulated fill record { position_ref, wallet_ref, side buy|sell, quantity>0, price>=0, fee>=0 (default 0), slippage>=0 (default 0), copy_mode_bucket, brain_bucket, latency_bucket unknown|low|medium|high, failure_origin_bucket (consumed-only string or none) } into a FROZEN descriptor carrying the fixed literals paper_fill_kind=candidate_paper_fill, simulated:true, is_valid_on_chain:false, executed:false, signed:false, signature:null — a paper fill is a SIMULATION RECORD, never an execution, never presented or stored as real. Fail-Safe-Not-Fail-Open: missing/hostile input -> CANDIDATE_PAPER_FILL_UNCONFIGURED; is_valid_on_chain:true / executed:true / signed:true / a signature-serialized-endpoint-key field present / invalid side-quantity-price / missing position_ref / smuggled forbidden flag-command-secret-endpoint -> CANDIDATE_PAPER_FILL_REJECTED (never echoed); a supplied (A) boundary result that is not PAPER_EXEC_INPUT_VALID, or malformed secondary fields -> CANDIDATE_PAPER_FILL_INVALID. Every state keeps all 24 readiness/execution flags false; the send gate keeps refusing — there is NO paper bypass.'
  });
}

export function evaluateCandidatePaperFill(input) {
  const build = (state, reasons, fill) => Object.freeze({
    valid: (state === 'CANDIDATE_PAPER_FILL_DESCRIPTOR'),
    paper_fill_kind: 'candidate_paper_fill',
    paper_fill_state: state,
    simulated: true,
    is_valid_on_chain: false,
    executed: false,
    signed: false,
    signature: null,
    position_ref: fill ? fill.position_ref : null,
    wallet_ref: fill ? fill.wallet_ref : null,
    side: fill ? fill.side : null,
    quantity: fill ? fill.quantity : null,
    price: fill ? fill.price : null,
    fee: fill ? fill.fee : null,
    slippage: fill ? fill.slippage : null,
    copy_mode_bucket: fill ? fill.copy_mode_bucket : null,
    brain_bucket: fill ? fill.brain_bucket : null,
    latency_bucket: fill ? fill.latency_bucket : null,
    failure_origin_bucket: fill ? fill.failure_origin_bucket : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...paperSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (paperUninspectable(obj, ['purpose', 'position_ref', 'wallet_ref', 'side',
      'quantity', 'price', 'fee', 'slippage', 'paper_exec_input_boundary'])) {
      return build('CANDIDATE_PAPER_FILL_UNCONFIGURED', ['input_inspection_error'], null);
    }
    if (!obj) {
      return build('CANDIDATE_PAPER_FILL_UNCONFIGURED', ['no_paper_fill_input'], null);
    }

    // REJECT (fail-closed): on-chain/executed/signed claims and forbidden
    // surface NAMES (a 'signature'/'serialized_tx'/'endpoint'/key field present)
    const rejectReasons = [];
    if (obj.is_valid_on_chain === true) rejectReasons.push('on_chain_fill_refused');
    if (obj.executed === true) rejectReasons.push('executed_fill_refused');
    if (obj.signed === true) rejectReasons.push('signed_fill_refused');
    if (paperHasForbiddenFieldName(obj)) rejectReasons.push('forbidden_field_name_blocked');

    // smuggle screen (excluding the boundary slot) -> REJECTED
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'paper_exec_input_boundary') shallow[k] = v;
    }
    rejectReasons.push(...paperScreen(shallow));

    // core fill validity (REJECT list per contract)
    if (!isStr(obj.position_ref)) rejectReasons.push('position_ref_required');
    if (obj.side !== 'buy' && obj.side !== 'sell') rejectReasons.push('invalid_side');
    if (!isNum(obj.quantity) || obj.quantity <= 0) rejectReasons.push('invalid_quantity');
    if (!isNum(obj.price) || obj.price < 0) rejectReasons.push('invalid_price');

    if (rejectReasons.length > 0) {
      return build('CANDIDATE_PAPER_FILL_REJECTED', rejectReasons, null);
    }

    // optional composition gate: a supplied (A) boundary result must be VALID
    const boundary = obj.paper_exec_input_boundary;
    if (boundary != null) {
      const bState = paperRecognizeInputBoundaryResult(boundary);
      if (bState !== 'PAPER_EXEC_INPUT_VALID') {
        return build('CANDIDATE_PAPER_FILL_INVALID', ['paper_exec_boundary_not_valid'], null);
      }
    }

    // secondary fields (defaults + validation) -> INVALID when malformed
    const invalidReasons = [];
    if (!isStr(obj.wallet_ref)) invalidReasons.push('wallet_ref_required');
    const fee = (obj.fee === undefined) ? 0 : obj.fee;
    const slippage = (obj.slippage === undefined) ? 0 : obj.slippage;
    if (!isNum(fee) || fee < 0) invalidReasons.push('invalid_fee');
    if (!isNum(slippage) || slippage < 0) invalidReasons.push('invalid_slippage');
    const latency = (obj.latency_bucket === undefined) ? 'unknown' : obj.latency_bucket;
    if (!PAPER_LATENCY_BUCKETS.includes(latency)) invalidReasons.push('invalid_latency_bucket');
    const copyMode = (obj.copy_mode_bucket === undefined) ? 'unknown' : obj.copy_mode_bucket;
    if (!isStr(copyMode)) invalidReasons.push('invalid_copy_mode_bucket');
    const brain = (obj.brain_bucket === undefined) ? 'unknown' : obj.brain_bucket;
    if (!isStr(brain)) invalidReasons.push('invalid_brain_bucket');
    const failureOrigin = (obj.failure_origin_bucket === undefined) ? 'none' : obj.failure_origin_bucket;
    if (!isStr(failureOrigin)) invalidReasons.push('invalid_failure_origin_bucket');
    if (invalidReasons.length > 0) {
      return build('CANDIDATE_PAPER_FILL_INVALID', invalidReasons, null);
    }

    return build('CANDIDATE_PAPER_FILL_DESCRIPTOR', [], {
      position_ref: obj.position_ref,
      wallet_ref: obj.wallet_ref,
      side: obj.side,
      quantity: obj.quantity,
      price: obj.price,
      fee,
      slippage,
      copy_mode_bucket: copyMode,
      brain_bucket: brain,
      latency_bucket: latency,
      failure_origin_bucket: failureOrigin
    });
  } catch {
    return build('CANDIDATE_PAPER_FILL_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// Recognize a Stage-14 (B) fill result fed forward.
function paperRecognizeFillResult(o) {
  return paperReadState(o, 'paper_fill_state', CANDIDATE_PAPER_FILL_STATES);
}

// ---------------------------------------------------------------------------
// shared pure FIFO core (used by (C) and (D)). Re-derives EVERYTHING from the
// fills array on each call — no internal Map/queue survives between calls.
// ---------------------------------------------------------------------------

// screen ONE fill object inside an array input. Returns reasons (empty = ok).
// The (B) descriptor's fixed literal signature:null is exempt; any NON-null
// signature (or any other forbidden surface name) refuses the WHOLE input.
function paperScreenFill(f) {
  const r = [];
  if (f == null || typeof f !== 'object' || Array.isArray(f)) {
    r.push('fill_not_an_object');
    return r;
  }
  if (f.is_valid_on_chain === true) r.push('on_chain_fill_refused');
  if (f.executed === true) r.push('executed_fill_refused');
  if (f.signed === true) r.push('signed_fill_refused');
  if (paperHasForbiddenFieldName(f, { allowNullSignature: true })) r.push('forbidden_field_name_blocked');
  if (paperHasForbiddenTrueFlag(f)) r.push('forbidden_trading_indicator_blocked');
  if (paperHasExecCmdKey(f)) r.push('execution_command_blocked');
  if (paperHasEndpointOrMainnet(f)) r.push('endpoint_or_mainnet_blocked');
  if (!isStr(f.position_ref)) r.push('position_ref_required');
  if (f.side !== 'buy' && f.side !== 'sell') r.push('invalid_side');
  if (!isNum(f.quantity) || f.quantity <= 0) r.push('invalid_quantity');
  if (!isNum(f.price) || f.price < 0) r.push('invalid_price');
  const fee = (f.fee === undefined || f.fee === null) ? 0 : f.fee;
  const slippage = (f.slippage === undefined || f.slippage === null) ? 0 : f.slippage;
  if (!isNum(fee) || fee < 0) r.push('invalid_fee');
  if (!isNum(slippage) || slippage < 0) r.push('invalid_slippage');
  return r;
}

// normalized view of a screened-ok fill (defaults applied; consumed-only buckets)
function paperNormalizeFill(f) {
  return {
    position_ref: f.position_ref,
    wallet_ref: isStr(f.wallet_ref) ? f.wallet_ref : 'unknown',
    side: f.side,
    quantity: f.quantity,
    price: f.price,
    fee: (f.fee === undefined || f.fee === null) ? 0 : f.fee,
    slippage: (f.slippage === undefined || f.slippage === null) ? 0 : f.slippage,
    copy_mode_bucket: isStr(f.copy_mode_bucket) ? f.copy_mode_bucket : 'unknown',
    brain_bucket: isStr(f.brain_bucket) ? f.brain_bucket : 'unknown',
    failure_origin_bucket: isStr(f.failure_origin_bucket) ? f.failure_origin_bucket : 'none'
  };
}

// PURE FIFO over an ordered fills array. Returns per-position books + totals +
// per-bucket aggregations. No module state; everything re-derived per call.
function paperRunFifo(fills) {
  const books = new Map(); // position_ref -> { lots, realized, fees, slippage, oversell, sells, failures }
  const byWallet = new Map();
  const byMode = new Map();
  const byBrain = new Map();
  const bucket = (map, key) => {
    if (!map.has(key)) map.set(key, { gross: 0, fees: 0, slippage: 0 });
    return map.get(key);
  };
  let oversellAny = false;

  for (const f of fills) {
    if (!books.has(f.position_ref)) {
      books.set(f.position_ref, { lots: [], realized: 0, fees: 0, slippage: 0, oversell: false, sells: 0, failures: 0 });
    }
    const p = books.get(f.position_ref);
    p.fees += f.fee;
    p.slippage += f.slippage;
    if (f.failure_origin_bucket !== 'none') p.failures += 1;

    const w = bucket(byWallet, f.wallet_ref);
    const m = bucket(byMode, f.copy_mode_bucket);
    const b = bucket(byBrain, f.brain_bucket);
    w.fees += f.fee; w.slippage += f.slippage;
    m.fees += f.fee; m.slippage += f.slippage;
    b.fees += f.fee; b.slippage += f.slippage;

    if (f.side === 'buy') {
      p.lots.push({ qty: f.quantity, price: f.price });
    } else {
      p.sells += 1;
      let remaining = f.quantity;
      let realizedHere = 0;
      while (remaining > 0 && p.lots.length > 0) {
        const lot = p.lots[0];
        const matched = Math.min(remaining, lot.qty);
        realizedHere += (f.price - lot.price) * matched; // FIFO realized (simulated)
        lot.qty -= matched;
        remaining -= matched;
        if (lot.qty === 0) p.lots.shift();
      }
      if (remaining > 0) { p.oversell = true; oversellAny = true; } // no shorts: excess ignored
      p.realized += realizedHere;
      w.gross += realizedHere;
      m.gross += realizedHere;
      b.gross += realizedHere;
    }
  }
  return { books, byWallet, byMode, byBrain, oversellAny };
}

function paperOpenQuantity(p) {
  return p.lots.reduce((s, l) => s + l.qty, 0);
}
function paperAvgOpenCost(p) {
  const q = paperOpenQuantity(p);
  if (q === 0) return 0;
  return p.lots.reduce((s, l) => s + l.qty * l.price, 0) / q;
}

// unrealized for one position book against one mark record.
// candidate_unrealized_pnl is a number ONLY when the consumed-only
// candidate_mark_status bucket is exactly 'valid' AND mark_price is finite.
function paperUnrealizedFor(p, mark) {
  if (mark == null || typeof mark !== 'object') {
    return { value: null, bucket: null, available: false, reason: 'mark_unavailable' };
  }
  const status = mark.mark_status_bucket;
  if (!PAPER_MARK_STATUS_BUCKETS.includes(status)) {
    return { value: null, bucket: null, available: false, reason: 'invalid_mark_status' };
  }
  if (status !== 'valid') {
    return { value: null, bucket: status, available: false, reason: 'mark_not_valid' };
  }
  if (!isNum(mark.mark_price)) {
    return { value: null, bucket: status, available: false, reason: 'mark_value_missing' };
  }
  const q = paperOpenQuantity(p);
  return { value: (mark.mark_price - paperAvgOpenCost(p)) * q, bucket: 'valid', available: true, reason: null };
}

// ---------------------------------------------------------------------------
// (C) PAPER P&L READ-MODEL (pure FIFO)
//
// A PURE FUNCTION over { paper_fills: [...], marks?: {...} } — re-derives
// everything from the array; same input array twice -> deep-equal frozen
// results. Per position_ref: FIFO realized, open quantity + avg open cost,
// candidate_fees_total, candidate_slippage_cost, candidate_unrealized_pnl
// ONLY when that position's mark_status_bucket === 'valid'. Totals:
// paper_gross_realized (LOCAL gross), candidate_paper_pnl (NET execution-
// aware = gross - fees - slippage), candidate_pnl_by_wallet /
// candidate_pnl_by_copy_mode / candidate_pnl_by_brain. Backend read-model
// ONLY (always simulated), never UX truth. Over-sell -> excess ignored
// (oversell_ignored). Any fill claiming on-chain/executed/signed truth or
// carrying a forbidden surface NAME -> the WHOLE input is refused.
// ---------------------------------------------------------------------------

const PAPER_PNL_STATES = Object.freeze([
  'PAPER_PNL_UNCONFIGURED', 'PAPER_PNL_INVALID', 'PAPER_PNL_READ_MODEL'
]);

const EMPTY_FROZEN_OBJECT = Object.freeze({});

export function describePaperPnlReadModelContract() {
  return Object.freeze({
    contract: 'paper-pnl-read-model',
    version: '0.0.0',
    test_only: true,
    simulated: true,
    supported_states: PAPER_PNL_STATES,
    consumed_mark_status_buckets: PAPER_MARK_STATUS_BUCKETS,
    advisory_only: true,
    paper_pnl_state: 'PAPER_PNL_UNCONFIGURED',
    is_valid_on_chain: false,
    status: 'PAPER_PNL_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...paperSafeFlags(),
    note: 'Simulated-only PAPER P&L READ-MODEL (pure FIFO, Stage-14 / Phase B). A PURE FUNCTION over { paper_fills: [ordered array of (B) descriptors or equivalent simulated fill objects], marks?: { [position_ref]: { mark_price, mark_status_bucket } } } — re-derives EVERYTHING from the array on every call (no internal state; deterministic; same input -> deep-equal frozen result). Per position_ref: FIFO realized (sells consume buy lots in order), open quantity + average open cost, candidate_fees_total, candidate_slippage_cost; candidate_unrealized_pnl is a number ONLY when that position mark_status_bucket === valid (else null + reason mark_not_valid / mark_unavailable / invalid_mark_status / mark_value_missing). Totals: paper_gross_realized (LOCAL gross realized) and candidate_paper_pnl = the NET execution-aware total (gross realized - fees - slippage); candidate_realized_pnl carries the gross FIFO realized matching the paper-portfolio precedent. Aggregations candidate_pnl_by_wallet / candidate_pnl_by_copy_mode / candidate_pnl_by_brain attribute each fill fee+slippage and each sell realized to that fill bucket (net per bucket). Over-sell beyond open lots is IGNORED (no shorts; oversell_ignored). Paper P&L is a BACKEND READ-MODEL ONLY — always simulated:true on the whole result and every nested aggregate, never UX truth, never real P&L, no Paper/Real mixing. Fail-Safe-Not-Fail-Open: missing/hostile input -> PAPER_PNL_UNCONFIGURED; ANY fill carrying is_valid_on_chain:true / executed:true / signed:true / a forbidden surface NAME / smuggled exec flag-command-endpoint OR malformed fill values -> the WHOLE input is refused PAPER_PNL_INVALID (never echoed). Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluatePaperPnlReadModel(input) {
  const build = (state, reasons, model) => Object.freeze({
    valid: (state === 'PAPER_PNL_READ_MODEL'),
    paper_pnl_state: state,
    simulated: true,
    is_valid_on_chain: false,
    fill_count: model ? model.fill_count : 0,
    candidate_realized_pnl: model ? model.gross : null,
    paper_gross_realized: model ? model.gross : null,
    candidate_fees_total: model ? model.fees : null,
    candidate_slippage_cost: model ? model.slippage : null,
    candidate_paper_pnl: model ? model.net : null,
    positions: model ? model.positions : EMPTY_FROZEN_OBJECT,
    candidate_pnl_by_wallet: model ? model.by_wallet : EMPTY_FROZEN_OBJECT,
    candidate_pnl_by_copy_mode: model ? model.by_mode : EMPTY_FROZEN_OBJECT,
    candidate_pnl_by_brain: model ? model.by_brain : EMPTY_FROZEN_OBJECT,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...paperSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (paperUninspectable(obj, ['purpose', 'paper_fills', 'marks'])) {
      return build('PAPER_PNL_UNCONFIGURED', ['input_inspection_error'], null);
    }
    if (!obj || !Array.isArray(obj.paper_fills)) {
      return build('PAPER_PNL_UNCONFIGURED', ['no_paper_fills_input'], null);
    }

    // screen the shallow top level (paper_fills/marks excluded)
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'paper_fills' && k !== 'marks') shallow[k] = v;
    }
    const shallowReasons = [...paperScreen(shallow)];
    if (paperHasForbiddenFieldName(shallow)) shallowReasons.push('forbidden_field_name_blocked');
    if (shallowReasons.length > 0) {
      return build('PAPER_PNL_INVALID', shallowReasons, null);
    }

    // screen EVERY fill — one bad fill refuses the WHOLE input (fail-closed)
    for (const f of obj.paper_fills) {
      const r = paperScreenFill(f);
      if (r.length > 0) {
        return build('PAPER_PNL_INVALID', r, null);
      }
    }

    const fills = obj.paper_fills.map(paperNormalizeFill);
    const marks = (obj.marks != null && typeof obj.marks === 'object' && !Array.isArray(obj.marks)) ? obj.marks : {};
    const { books, byWallet, byMode, byBrain, oversellAny } = paperRunFifo(fills);

    let gross = 0; let fees = 0; let slippage = 0;
    const positions = {};
    for (const [ref, p] of books) {
      gross += p.realized;
      fees += p.fees;
      slippage += p.slippage;
      const u = paperUnrealizedFor(p, marks[ref]);
      positions[ref] = Object.freeze({
        simulated: true,
        is_valid_on_chain: false,
        position_ref: ref,
        candidate_realized_pnl: p.realized,
        candidate_fees_total: p.fees,
        candidate_slippage_cost: p.slippage,
        paper_net_realized: p.realized - p.fees - p.slippage,
        open_quantity: paperOpenQuantity(p),
        avg_open_cost: paperAvgOpenCost(p),
        candidate_unrealized_pnl: u.value,
        candidate_mark_status: u.bucket,
        unrealized_available: u.available,
        unrealized_reason: u.reason,
        oversell_ignored: p.oversell
      });
    }
    const freezeBuckets = (map) => {
      const out = {};
      for (const [k, v] of map) {
        out[k] = Object.freeze({
          simulated: true,
          candidate_paper_pnl: v.gross - v.fees - v.slippage,
          paper_gross_realized: v.gross,
          candidate_fees_total: v.fees,
          candidate_slippage_cost: v.slippage
        });
      }
      return Object.freeze(out);
    };

    const reasons = oversellAny ? ['oversell_ignored'] : [];
    return build('PAPER_PNL_READ_MODEL', reasons, {
      fill_count: fills.length,
      gross,
      fees,
      slippage,
      net: gross - fees - slippage,
      positions: Object.freeze(positions),
      by_wallet: freezeBuckets(byWallet),
      by_mode: freezeBuckets(byMode),
      by_brain: freezeBuckets(byBrain)
    });
  } catch {
    return build('PAPER_PNL_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// Recognize a Stage-14 (C) P&L read-model result fed forward.
function paperRecognizePnlResult(o) {
  return paperReadState(o, 'paper_pnl_state', PAPER_PNL_STATES);
}

// ---------------------------------------------------------------------------
// (D) PAPER OUTCOME CLASSIFIER — LOCAL states only.
//
// Classifies ONE position's fills slice. Closed (open qty == 0 after FIFO):
// net realized > 0 -> _CLOSED_PROFIT, < 0 -> _CLOSED_LOSS, == 0 ->
// _CLOSED_FLAT. Open qty > 0 -> _OPEN; any fill failure_origin_bucket !==
// 'none' AND no successful close -> _FAILED (precedence over _OPEN). The
// deferred SSOT paper-outcome enum is deliberately NOT used — these are
// LOCAL classification states for a SIMULATED record.
// ---------------------------------------------------------------------------

const PAPER_EXEC_OUTCOME_STATES = Object.freeze([
  'PAPER_EXEC_OUTCOME_UNCONFIGURED', 'PAPER_EXEC_OUTCOME_INVALID',
  'PAPER_EXEC_OUTCOME_OPEN', 'PAPER_EXEC_OUTCOME_CLOSED_PROFIT',
  'PAPER_EXEC_OUTCOME_CLOSED_LOSS', 'PAPER_EXEC_OUTCOME_CLOSED_FLAT',
  'PAPER_EXEC_OUTCOME_FAILED'
]);

export function describePaperOutcomeContract() {
  return Object.freeze({
    contract: 'paper-outcome',
    version: '0.0.0',
    test_only: true,
    simulated: true,
    supported_states: PAPER_EXEC_OUTCOME_STATES,
    advisory_only: true,
    paper_outcome_state: 'PAPER_EXEC_OUTCOME_UNCONFIGURED',
    is_valid_on_chain: false,
    status: 'PAPER_EXEC_OUTCOME_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...paperSafeFlags(),
    note: 'Simulated-only PAPER OUTCOME CLASSIFIER (Stage-14 / Phase B). Classifies ONE position slice { paper_fills: fills for one position_ref, mark?: { mark_price, mark_status_bucket } } using the SAME pure FIFO core as the P&L read-model. Closed (open quantity == 0 after FIFO, with at least one sell): NET realized (gross - fees - slippage) > 0 -> PAPER_EXEC_OUTCOME_CLOSED_PROFIT, < 0 -> PAPER_EXEC_OUTCOME_CLOSED_LOSS, == 0 -> PAPER_EXEC_OUTCOME_CLOSED_FLAT. Open quantity > 0 -> PAPER_EXEC_OUTCOME_OPEN; ANY fill with failure_origin_bucket !== none AND no successful close -> PAPER_EXEC_OUTCOME_FAILED (takes precedence over OPEN). These are LOCAL classification state names for a SIMULATED record — the deferred SSOT paper-outcome enum and its value strings are deliberately NOT used. Fail-Safe-Not-Fail-Open: missing/hostile/empty input -> PAPER_EXEC_OUTCOME_UNCONFIGURED; a fill claiming on-chain/executed/signed truth / a forbidden surface NAME / malformed values / more than one position_ref in the slice -> PAPER_EXEC_OUTCOME_INVALID (never echoed). Always simulated:true, never real, never an execution; all 24 readiness/execution flags stay false in every state.'
  });
}

export function evaluatePaperOutcome(input) {
  const build = (state, reasons, model) => Object.freeze({
    valid: (state !== 'PAPER_EXEC_OUTCOME_INVALID'),
    paper_outcome_state: state,
    simulated: true,
    is_valid_on_chain: false,
    position_ref: model ? model.position_ref : null,
    open_quantity: model ? model.open_quantity : null,
    paper_gross_realized: model ? model.gross : null,
    paper_net_realized: model ? model.net : null,
    candidate_fees_total: model ? model.fees : null,
    candidate_slippage_cost: model ? model.slippage : null,
    candidate_unrealized_pnl: model ? model.unrealized : null,
    candidate_mark_status: model ? model.mark_bucket : null,
    failure_detected: model ? model.failure_detected : false,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...paperSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (paperUninspectable(obj, ['purpose', 'paper_fills', 'mark'])) {
      return build('PAPER_EXEC_OUTCOME_UNCONFIGURED', ['input_inspection_error'], null);
    }
    if (!obj || !Array.isArray(obj.paper_fills) || obj.paper_fills.length === 0) {
      return build('PAPER_EXEC_OUTCOME_UNCONFIGURED', ['no_paper_fills_input'], null);
    }

    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'paper_fills' && k !== 'mark') shallow[k] = v;
    }
    const shallowReasons = [...paperScreen(shallow)];
    if (paperHasForbiddenFieldName(shallow)) shallowReasons.push('forbidden_field_name_blocked');
    if (shallowReasons.length > 0) {
      return build('PAPER_EXEC_OUTCOME_INVALID', shallowReasons, null);
    }

    for (const f of obj.paper_fills) {
      const r = paperScreenFill(f);
      if (r.length > 0) {
        return build('PAPER_EXEC_OUTCOME_INVALID', r, null);
      }
    }

    const fills = obj.paper_fills.map(paperNormalizeFill);
    const refs = [...new Set(fills.map((f) => f.position_ref))];
    if (refs.length !== 1) {
      return build('PAPER_EXEC_OUTCOME_INVALID', ['multiple_position_refs'], null);
    }

    const { books } = paperRunFifo(fills);
    const p = books.get(refs[0]);
    const openQty = paperOpenQuantity(p);
    const gross = p.realized;
    const net = gross - p.fees - p.slippage;
    const failureDetected = p.failures > 0;
    const closed = (openQty === 0 && p.sells > 0);
    const u = paperUnrealizedFor(p, obj.mark);

    const model = {
      position_ref: refs[0],
      open_quantity: openQty,
      gross,
      net,
      fees: p.fees,
      slippage: p.slippage,
      unrealized: u.value,
      mark_bucket: u.bucket,
      failure_detected: failureDetected
    };

    if (closed) {
      if (net > 0) return build('PAPER_EXEC_OUTCOME_CLOSED_PROFIT', ['closed_net_positive'], model);
      if (net < 0) return build('PAPER_EXEC_OUTCOME_CLOSED_LOSS', ['closed_net_negative'], model);
      return build('PAPER_EXEC_OUTCOME_CLOSED_FLAT', ['closed_net_flat'], model);
    }
    if (failureDetected) {
      // failure with no successful close takes precedence over OPEN
      return build('PAPER_EXEC_OUTCOME_FAILED', ['failure_origin_detected'], model);
    }
    return build('PAPER_EXEC_OUTCOME_OPEN', ['position_open'], model);
  } catch {
    return build('PAPER_EXEC_OUTCOME_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// ---------------------------------------------------------------------------
// (E) PAPER-EXECUTION SUPPRESSION
//
// ALWAYS suppressed:true; ALWAYS carries not_execution_authorized,
// not_sign_authorized, not_send_authorized on EVERY path. Paper execution is
// NEVER execution / sign / send authorized at this layer — a paper fill is a
// simulation record, not an order. Suppression opens NOTHING.
// ---------------------------------------------------------------------------

const PAPER_EXEC_SUPPRESSION_REASON_CODES = Object.freeze([
  'pipeline_not_reviewed', 'fill_rejected', 'live_surface_detected',
  'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
]);

const PAPER_EXEC_SUPPRESSION_ALWAYS = Object.freeze([
  'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
]);

export function describePaperExecutionSuppressionContract() {
  return Object.freeze({
    contract: 'paper-execution-suppression',
    version: '0.0.0',
    test_only: true,
    simulated: true,
    supported_reason_codes: PAPER_EXEC_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: true,
    not_execution_authorized: true,
    not_sign_authorized: true,
    not_send_authorized: true,
    suppression_reasons: Object.freeze([
      'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
    ]),
    status: 'PAPER_EXEC_SUPPRESSED',
    reasons: Object.freeze([
      'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
    ]),
    ...paperSafeFlags(),
    note: 'Simulated-only PAPER-EXECUTION SUPPRESSION (Stage-14 / Phase B). Paper execution is NEVER execution / sign / send authorized at this layer — a paper fill is a SIMULATION RECORD, not an order, not a permission. Therefore suppressed is ALWAYS true and not_execution_authorized + not_sign_authorized + not_send_authorized are ALWAYS included on EVERY path (clean, blocked, hostile, missing — even a fully FILLED/PASS paper state is STILL suppressed for execution/sign/send; the send gate keeps refusing with NO paper bypass). Suppression opens NOTHING — every readiness/execution flag (can_send / can_broadcast / signer_ready / signing_permitted / broadcast_permitted / ...) STAYS false. It additionally surfaces pipeline_not_reviewed / fill_rejected / live_surface_detected when fed-forward components indicate them, but these are advisory reasons only and never relax the always-on not_*_authorized suppression. Hostile / throwing / missing input -> still suppressed (fail-closed), never throws.'
  });
}

export function evaluatePaperExecutionSuppression(input) {
  const build = (reasonCodes) => {
    const codes = [...new Set([...(reasonCodes || []), ...PAPER_EXEC_SUPPRESSION_ALWAYS])]
      .filter((c) => PAPER_EXEC_SUPPRESSION_REASON_CODES.includes(c));
    return Object.freeze({
      suppressed: true,
      not_execution_authorized: true,
      not_sign_authorized: true,
      not_send_authorized: true,
      simulated: true,
      suppression_reasons: Object.freeze(codes),
      status: 'PAPER_EXEC_SUPPRESSED',
      reasons: Object.freeze(codes),
      read_only: true,
      advisory_only: true,
      ...paperSafeFlags()
    });
  };
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (paperUninspectable(obj, ['purpose', 'paper_exec_input_boundary',
      'candidate_paper_fill', 'paper_forbidden_surface', 'pipeline_decision_verdict'])) {
      return build([]);
    }
    if (!obj) {
      return build([]);
    }

    const codes = [];

    // fed-forward (A) boundary not VALID -> pipeline_not_reviewed
    const boundary = obj.paper_exec_input_boundary;
    if (boundary != null) {
      const bState = paperRecognizeInputBoundaryResult(boundary);
      if (bState !== 'PAPER_EXEC_INPUT_VALID') codes.push('pipeline_not_reviewed');
    }
    // fed-forward Stage-13 verdict not REVIEWED_ADVISORY -> pipeline_not_reviewed
    const verdict = obj.pipeline_decision_verdict;
    if (verdict != null) {
      const vState = paperReadState(verdict, 'pipeline_decision_state', PAPER_PIPELINE_DECISION_STATES);
      if (vState !== 'PIPELINE_DECISION_REVIEWED_ADVISORY') codes.push('pipeline_not_reviewed');
    }
    // fed-forward (B) fill REJECTED -> fill_rejected
    const fill = obj.candidate_paper_fill;
    if (fill != null) {
      const fState = paperRecognizeFillResult(fill);
      if (fState === 'CANDIDATE_PAPER_FILL_REJECTED') codes.push('fill_rejected');
    }
    // fed-forward (F) surface BLOCKED OR a smuggled live surface -> live_surface_detected
    const surface = obj.paper_forbidden_surface;
    if (surface != null && paperReadState(surface, 'paper_surface_state', PAPER_SURFACE_STATES) === 'PAPER_SURFACE_BLOCKED') {
      codes.push('live_surface_detected');
    }
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!['paper_exec_input_boundary', 'candidate_paper_fill',
        'paper_forbidden_surface', 'pipeline_decision_verdict'].includes(k)) shallow[k] = v;
    }
    if (paperScreen(shallow).length > 0 || paperHasForbiddenFieldName(shallow)) {
      codes.push('live_surface_detected');
    }

    return build(codes);
  } catch {
    return build([]);
  }
}

// Recognize a Stage-14 (E) suppression result fed forward.
function paperRecognizeSuppressionResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (o.suppressed === true && Array.isArray(o.suppression_reasons)) return true;
  return null;
}

// ---------------------------------------------------------------------------
// (F) PAPER FORBIDDEN SURFACE GUARD
//
// Scans TOP-LEVEL keys against the frozen forbidden-NAME list (key material +
// live names). Any forbidden name -> PAPER_SURFACE_BLOCKED,
// forbidden_field_ref = NAME only (VALUE provably absent from
// JSON.stringify). Detection booleans: true == found == BLOCKED == SAFE; they
// are NOT readiness flags. Hostile -> PAPER_SURFACE_UNCONFIGURED, never throws.
// ---------------------------------------------------------------------------

const PAPER_SURFACE_STATES = Object.freeze([
  'PAPER_SURFACE_UNCONFIGURED', 'PAPER_SURFACE_CLEAN', 'PAPER_SURFACE_BLOCKED'
]);

export function describePaperForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'paper-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    simulated: true,
    supported_states: PAPER_SURFACE_STATES,
    forbidden_field_names: PAPER_SURFACE_FORBIDDEN_NAMES,
    advisory_only: true,
    paper_surface_state: 'PAPER_SURFACE_UNCONFIGURED',
    key_material_detected: false,
    live_surface_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'PAPER_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...paperSafeFlags(),
    note: 'Simulated-only PAPER FORBIDDEN SURFACE GUARD (Stage-14 / Phase B). Proves the paper-execution engine neither produces nor accepts key-material (private_key / secret_key / keypair / mnemonic / seed / signing_key / signature / signed_tx / signed_transaction) OR live-surface (endpoint / endpoint_url / rpc_url / provider_url / node_url / ws_url / serialized_tx / serialized_transaction / wire_transaction / raw_tx / raw_transaction / tx_bytes / message_bytes / broadcast_payload / send_payload) material. It scans ONLY top-level keys (deterministic, bounded, pure). The detection booleans key_material_detected / live_surface_detected / forbidden_field_detected are DETECTION outputs (true == a forbidden field NAME was found == the SAFE BLOCKED state); they are NOT readiness/execution flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing / hostile input -> PAPER_SURFACE_UNCONFIGURED (frozen, never throws); a clean object with NONE of the forbidden names present -> PAPER_SURFACE_CLEAN (all detection booleans false); ANY forbidden name present at top level -> PAPER_SURFACE_BLOCKED (forbidden_field_detected:true, key_material_detected:true for a key-material name, live_surface_detected:true for a live name, forbidden_field_ref = the matched NAME). A BLOCKED result keeps all 24 readiness/execution flags false. Opens NOTHING.'
  });
}

export function evaluatePaperForbiddenSurface(input) {
  const build = (state, kind, ref, reasons) => Object.freeze({
    paper_surface_state: state,
    key_material_detected: (state === 'PAPER_SURFACE_BLOCKED') ? (kind === 'key') : false,
    live_surface_detected: (state === 'PAPER_SURFACE_BLOCKED') ? (kind === 'live') : false,
    forbidden_field_detected: (state === 'PAPER_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'PAPER_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    simulated: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...paperSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (paperUninspectable(obj, [...PAPER_SURFACE_FORBIDDEN_NAMES])) {
      return build('PAPER_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('PAPER_SURFACE_UNCONFIGURED', null, null, ['no_paper_surface_input']);
    }
    let keys;
    try {
      keys = Object.keys(obj);
    } catch {
      return build('PAPER_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    // scan top-level keys only; first matched NAME (deterministic order) wins
    for (const k of keys) {
      if (PAPER_SURFACE_FORBIDDEN_NAMES.includes(k)) {
        const kind = PAPER_SURFACE_KEY_MATERIAL_NAMES.includes(k) ? 'key' : 'live';
        // forbidden_field_ref = the matched NAME only (REDACTED); NEVER the VALUE
        return build('PAPER_SURFACE_BLOCKED', kind, k,
          [kind === 'key' ? 'key_material_detected' : 'live_surface_detected']);
      }
    }
    return build('PAPER_SURFACE_CLEAN', null, null, ['paper_surface_clean']);
  } catch {
    return build('PAPER_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// Recognize a Stage-14 (F) surface result fed forward.
function paperRecognizeSurfaceResult(o) {
  return paperReadState(o, 'paper_surface_state', PAPER_SURFACE_STATES);
}

// ---------------------------------------------------------------------------
// (G) PAPER-EXECUTION HEALTH
//
// Aggregates (A) boundary + (B) fill sample (optional — fills validity is
// otherwise carried by the (C) read-model) + (C) P&L read-model + (E)
// suppression + (F) surface guard. Because suppression is always-suppressed,
// the standard clean path -> _SUPPRESSED; _REVIEWED_ADVISORY only with an
// explicit not-suppressed object and STILL opens nothing. Surface BLOCKED /
// pnl INVALID / boundary INVALID / fill REJECTED -> _BLOCKED.
// ---------------------------------------------------------------------------

const PAPER_EXEC_HEALTH_STATES = Object.freeze([
  'PAPER_EXEC_HEALTH_UNCONFIGURED', 'PAPER_EXEC_HEALTH_DEGRADED',
  'PAPER_EXEC_HEALTH_REVIEWED_ADVISORY', 'PAPER_EXEC_HEALTH_SUPPRESSED',
  'PAPER_EXEC_HEALTH_BLOCKED'
]);

const PAPER_EXEC_HEALTH_COMPONENTS = Object.freeze([
  'paper_exec_input_boundary', 'candidate_paper_fill', 'paper_pnl_read_model',
  'paper_execution_suppression', 'paper_forbidden_surface'
]);

export function describePaperExecutionHealthContract() {
  return Object.freeze({
    contract: 'paper-execution-health',
    version: '0.0.0',
    test_only: true,
    simulated: true,
    supported_states: PAPER_EXEC_HEALTH_STATES,
    supported_components: PAPER_EXEC_HEALTH_COMPONENTS,
    advisory_only: true,
    valid: false,
    paper_exec_health_state: 'PAPER_EXEC_HEALTH_UNCONFIGURED',
    status: 'PAPER_EXEC_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...paperSafeFlags(),
    note: 'Simulated-only PAPER-EXECUTION HEALTH (Stage-14 / Phase B). Aggregates the paper-execution input boundary (A) + an optional candidate paper-fill sample (B — fills validity is otherwise carried by the P&L read-model) + the paper P&L read-model (C) + the always-suppressed suppression (E) + the forbidden-surface guard (F) and DERIVES STATUS ONLY into {PAPER_EXEC_HEALTH_UNCONFIGURED, PAPER_EXEC_HEALTH_DEGRADED, PAPER_EXEC_HEALTH_REVIEWED_ADVISORY, PAPER_EXEC_HEALTH_SUPPRESSED, PAPER_EXEC_HEALTH_BLOCKED}. Every state keeps all 24 readiness/execution flags false; even REVIEWED_ADVISORY opens NOTHING — paper health is a simulation status, never trading/signing/send readiness, never a live promotion. Ordering (Fail-Safe-Not-Fail-Open): a smuggled forbidden flag / command / secret / endpoint / forbidden field NAME / surface PAPER_SURFACE_BLOCKED / pnl PAPER_PNL_INVALID / boundary PAPER_EXEC_INPUT_INVALID / fill CANDIDATE_PAPER_FILL_REJECTED -> PAPER_EXEC_HEALTH_BLOCKED; a missing/unrecognized required component -> PAPER_EXEC_HEALTH_UNCONFIGURED; boundary/fill/pnl not clean -> PAPER_EXEC_HEALTH_DEGRADED; because the always-suppressed suppression layer reports suppressed:true, the standard clean path -> PAPER_EXEC_HEALTH_SUPPRESSED; PAPER_EXEC_HEALTH_REVIEWED_ADVISORY ONLY when an explicit not-suppressed suppression object is supplied AND every component is clean (and STILL opens nothing).'
  });
}

export function evaluatePaperExecutionHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'PAPER_EXEC_HEALTH_BLOCKED'),
    paper_exec_health_state: state,
    simulated: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...paperSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (paperUninspectable(obj, [...PAPER_EXEC_HEALTH_COMPONENTS])) {
      return build('PAPER_EXEC_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('PAPER_EXEC_HEALTH_UNCONFIGURED', ['no_paper_exec_health_input']);
    }

    const boundary = obj.paper_exec_input_boundary;
    const fill = obj.candidate_paper_fill;
    const pnl = obj.paper_pnl_read_model;
    const suppression = obj.paper_execution_suppression;
    const surface = obj.paper_forbidden_surface;

    // smuggled forbidden flag / command / secret / endpoint / forbidden NAME
    // on the shallow level or any component -> BLOCKED.
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!PAPER_EXEC_HEALTH_COMPONENTS.includes(k)) shallow[k] = v;
    }
    let blocked = paperScreen(shallow).length > 0 || paperHasForbiddenFieldName(shallow);
    for (const k of PAPER_EXEC_HEALTH_COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      // the (B) descriptor's fixed literal signature:null is the sole exemption
      if (paperHasForbiddenTrueFlag(c) || paperHasExecCmdKey(c) ||
          paperHasEndpointOrMainnet(c) ||
          paperHasForbiddenFieldName(c, { allowNullSignature: true })) {
        blocked = true;
      }
    }
    if (blocked) {
      return build('PAPER_EXEC_HEALTH_BLOCKED', ['forbidden_input_blocked']);
    }

    const boundaryState = paperRecognizeInputBoundaryResult(boundary);
    const fillState = (fill == null) ? null : paperRecognizeFillResult(fill);
    const pnlState = paperRecognizePnlResult(pnl);
    const surfaceState = paperRecognizeSurfaceResult(surface);
    const suppressedVal = paperRecognizeSuppressionResult(suppression);

    // hard-block: surface blocked / pnl invalid / boundary invalid / fill rejected
    if (surfaceState === 'PAPER_SURFACE_BLOCKED' ||
        pnlState === 'PAPER_PNL_INVALID' ||
        boundaryState === 'PAPER_EXEC_INPUT_INVALID' ||
        fillState === 'CANDIDATE_PAPER_FILL_REJECTED') {
      return build('PAPER_EXEC_HEALTH_BLOCKED', ['paper_exec_health_blocked']);
    }

    // missing/unrecognized required component -> UNCONFIGURED
    // (the (B) fill sample is OPTIONAL — fills validity is carried by (C))
    if (boundary == null || pnl == null || suppression == null || surface == null ||
        boundaryState === null || pnlState === null || surfaceState === null ||
        (fill != null && fillState === null)) {
      return build('PAPER_EXEC_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    const clean = (boundaryState === 'PAPER_EXEC_INPUT_VALID' &&
      pnlState === 'PAPER_PNL_READ_MODEL' &&
      surfaceState === 'PAPER_SURFACE_CLEAN' &&
      (fillState === null || fillState === 'CANDIDATE_PAPER_FILL_DESCRIPTOR'));

    // explicit not-suppressed object -> REVIEWED_ADVISORY only when clean
    if (suppression.suppressed === false) {
      if (clean) {
        return build('PAPER_EXEC_HEALTH_REVIEWED_ADVISORY', ['paper_exec_reviewed_advisory']);
      }
      return build('PAPER_EXEC_HEALTH_DEGRADED', ['paper_exec_health_degraded']);
    }

    // always-suppressed clean path -> SUPPRESSED
    if (suppressedVal === true && clean) {
      return build('PAPER_EXEC_HEALTH_SUPPRESSED', ['paper_exec_suppressed']);
    }

    // suppressed but components not fully clean -> DEGRADED (fail-closed)
    return build('PAPER_EXEC_HEALTH_DEGRADED', ['paper_exec_health_degraded']);
  } catch {
    return build('PAPER_EXEC_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
