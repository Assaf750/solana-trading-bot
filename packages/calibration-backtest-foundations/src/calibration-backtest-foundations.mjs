// @soltrade/calibration-backtest-foundations
//
// SIMULATED-ONLY / read-only CALIBRATION & BACKTEST HARNESS foundation for
// Stage-15 (Phase B) of the architecture pipeline `data -> signal -> risk ->
// intent -> route -> sign -> send`. This package builds ONLY a calibration
// input boundary, a pure simulated-vs-real DIVERGENCE read-model, a
// point-in-time / survivorship-free BACKTEST DATASET descriptor, a
// deterministic BACKTEST REPLAY read-model, an always-suppressed suppression
// layer, a forbidden-surface guard, and a calibration health read-model. It
// CONSUMES the already-computed Stage-14 paper P&L read-model results and
// caller-supplied CalibrationRecord-shaped / dataset records PASSED IN as
// args. Import-free, pure, deterministic. NO clock, NO RNG, NO network
// primitive, NO live stream, NO live quote, NO RPC/route call, NO signing,
// NO sending, NO broadcasting, NO SignerService activation, NO private key /
// seed / mnemonic / keypair material, no persistence, no secrets, no mutable
// module/global state.
//
// THE CORE RULES:
//  - A divergence/replay read-model is a SIMULATED-ONLY ADVISORY
//    REPRESENTATION (simulated:true) — never presented as real, never a gate,
//    never execution authority. All 24 readiness/execution flags STAY false
//    on every result of every state.
//  - FINALITY (docs/00-ARCHITECTURE §9 Calibration Finality Policy): only
//    records with BOTH timestamp_processed AND timestamp_confirmed
//    participate in divergence; everything else is excluded and counted.
//    With zero finalized pairs the posture is PESSIMISTIC: dimensions
//    classify UNCLASSIFIED — never silently WITHIN_BAND.
//  - FAIL-SAFE BANDS: divergence bands MUST be caller-supplied; a missing or
//    invalid band yields UNCLASSIFIED (missing_divergence_band) — defaults
//    are never invented.
//  - NO FUTURE LEAKAGE: backtest records are consumed strictly in
//    non-decreasing as_of_rank order; any violation or any record carrying a
//    future-knowledge field name is refused.
//  - SURVIVORSHIP-FREE: extinct cohort wallets must remain in the sample (or
//    be explicitly declared inactive); silently dropping an extinct wallet is
//    refused as survivorship_risk.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract
// identifier, NOT an SSOT name — EXCEPT the already-registered candidate
// FIELD name candidate_pnl_by_wallet (G22, paper-portfolio precedent) reused
// for the per-wallet net map. The CalibrationRecord input field names
// (trade_id, simulated_fill_price, real_fill_price, simulated_slippage,
// real_slippage, simulated_exit, real_exit, failed_attempts_count,
// rpc_latency_ms, route_failure_flag, ordering_confidence,
// timestamp_processed, timestamp_confirmed) are ARCHITECTURE-defined internal
// CalibrationRecord fields consumed-only (the packages/foundations
// calibration-store precedent) — not new SSOT names. The deferred SSOT enums
// candidate_paper_real_divergence_status / candidate_paper_real_divergence_
// dimension stay DEFERRED: classification tokens here are LOCAL
// SCREAMING-CASE strings. Field names like endpoint / rpc_url /
// serialized_tx / signed_transaction / signature / message_bytes /
// private_key / keypair / mnemonic / seed appear ONLY as fixed string
// literals inside forbidden-NAME allowlist arrays and prose — never as real
// objects, calls, or emitted forbidden output keys, and a VALUE is NEVER
// echoed.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function calibSafeFlags() {
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

const CALIB_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live',
  // execution-shaped claims on records/fills are equally refused
  'is_valid_on_chain', 'executed', 'signed'
]);

const CALIB_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell_order', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute', 'rpc_call',
  'connect_rpc', 'send_transaction', 'broadcast_transaction', 'run_stage',
  'run_pipeline', 'execute_pipeline'
]);

const CALIB_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential|signing_key|signer_secret/i;
const CALIB_URL_RE = /https?:\/\/|wss?:\/\//i;
const CALIB_MAINNET_RE = /mainnet|prod/i;

// opaque refs / consumed-only fields exempt from the secret-NAME scan (their
// VALUES are still scanned for URL/secret/mainnet substrings).
const CALIB_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'trade_id', 'record_ref', 'wallet_ref', 'position_ref',
  'brain', 'signal_bucket', 'wallet_cluster', 'token_risk_bucket',
  'copy_mode_bucket', 'brain_bucket', 'latency_bucket', 'failure_origin_bucket',
  'status_bucket'
]);

function calibHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of CALIB_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function calibHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (CALIB_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function calibHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (CALIB_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (CALIB_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function calibHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (CALIB_URL_RE.test(v) || CALIB_MAINNET_RE.test(v))) return true;
  }
  return false;
}

// shared forbidden field NAMES — key material + live surfaces.
const CALIB_SURFACE_KEY_MATERIAL_NAMES = Object.freeze([
  'private_key', 'secret_key', 'keypair', 'mnemonic', 'seed', 'signing_key',
  'signature', 'signed_tx', 'signed_transaction'
]);
const CALIB_SURFACE_LIVE_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'rpc_url', 'provider_url', 'node_url', 'ws_url',
  'serialized_tx', 'serialized_transaction', 'wire_transaction', 'raw_tx',
  'raw_transaction', 'tx_bytes', 'message_bytes', 'broadcast_payload', 'send_payload'
]);
const CALIB_SURFACE_FORBIDDEN_NAMES = Object.freeze([
  ...CALIB_SURFACE_KEY_MATERIAL_NAMES, ...CALIB_SURFACE_LIVE_NAMES
]);

// allowNullSignature exempts a Stage-14 descriptor's fixed literal
// signature:null (provably null — never a value).
function calibHasForbiddenFieldName(o, { allowNullSignature = false } = {}) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (!CALIB_SURFACE_FORBIDDEN_NAMES.includes(String(k))) continue;
    if (allowNullSignature && k === 'signature' && o[k] === null) continue;
    return true;
  }
  return false;
}

// future-knowledge field names refused on backtest records (NO FUTURE LEAKAGE).
function calibHasFutureKnowledgeKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    const lk = String(k).toLowerCase();
    if (lk.startsWith('future_') || lk === 'lookahead' || lk === 'peek_ahead') return true;
  }
  return false;
}

function calibScreen(o) {
  const r = [];
  if (calibHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (calibHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (calibHasSecretField(o)) r.push('secret_field_blocked');
  if (calibHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

function calibScreenComponent(c, opts) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (calibHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (calibHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (calibHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (calibHasForbiddenFieldName(c, opts)) r.push('forbidden_field_name_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function calibUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

function calibReadState(o, field, allowed) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  const v = o[field];
  if (typeof v === 'string' && allowed.includes(v)) return v;
  return null;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;

const EMPTY_FROZEN_OBJECT = Object.freeze({});
const EMPTY_FROZEN_ARRAY = Object.freeze([]);

// FINALITY RULE (ARCHITECTURE §9): finalized ONLY when BOTH timestamps exist.
function calibIsFinalized(r) {
  return r != null && typeof r === 'object' &&
    r.timestamp_processed != null && r.timestamp_confirmed != null;
}

// ---------------------------------------------------------------------------
// Stage-14 terminal-result recognizer (consumed-only state strings).
// ---------------------------------------------------------------------------

const CALIB_PAPER_PNL_STATES = Object.freeze([
  'PAPER_PNL_UNCONFIGURED', 'PAPER_PNL_INVALID', 'PAPER_PNL_READ_MODEL'
]);

// raw upstream-result MARKERS: a raw Stage-13/12/11/... result passed as the
// paper read-model is REFUSED — only the Stage-14 paper P&L read-model is
// accepted.
const CALIB_RAW_UPSTREAM_MARKER_KEYS = Object.freeze([
  'pipeline_decision_state', 'pipeline_decision_health_state', 'trace_entries',
  'send_review_state', 'send_review_health_state',
  'signing_review_state', 'signing_review_health_state',
  'tx_build_review_state', 'execution_plan_preview_state', 'intent_state',
  'risk_verdict_state', 'signal_state'
]);

function calibLooksLikeRawUpstream(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of CALIB_RAW_UPSTREAM_MARKER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(o, k)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// (A) CALIBRATION INPUT BOUNDARY
// ---------------------------------------------------------------------------

const CALIB_INPUT_STATES = Object.freeze([
  'CALIB_INPUT_UNCONFIGURED', 'CALIB_INPUT_INVALID',
  'CALIB_INPUT_DEGRADED', 'CALIB_INPUT_VALID'
]);

const CALIB_RECORD_NUMERIC_OR_NULL_FIELDS = Object.freeze([
  'simulated_fill_price', 'real_fill_price', 'simulated_slippage',
  'real_slippage', 'failed_attempts_count', 'rpc_latency_ms',
  'ordering_confidence'
]);

// validate one CalibrationRecord-shaped object (consumed-only field names —
// the packages/foundations calibration-store precedent). Returns reason
// strings (empty = ok).
function calibValidateRecordShape(r) {
  const reasons = [];
  if (r == null || typeof r !== 'object' || Array.isArray(r)) {
    return ['calibration_record_not_object'];
  }
  const screen = calibScreenComponent(r);
  if (screen.length > 0) return screen;
  if (!isStr(r.trade_id)) reasons.push('trade_id_required');
  for (const f of CALIB_RECORD_NUMERIC_OR_NULL_FIELDS) {
    const v = r[f];
    if (v !== undefined && v !== null && !isNum(v)) {
      reasons.push('invalid_numeric_field');
      break;
    }
  }
  return reasons;
}

export function describeCalibrationInputBoundaryContract() {
  return Object.freeze({
    contract: 'calibration-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: CALIB_INPUT_STATES,
    advisory_only: true,
    calib_input_state: 'CALIB_INPUT_UNCONFIGURED',
    calib_input_boundary_valid: false,
    eligible_for_calibration: false,
    status: 'CALIB_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...calibSafeFlags(),
    note: 'Read-only CALIBRATION INPUT boundary (Stage-15 / Phase B). Input is { paper_pnl_read_model: a REAL Stage-14 paper P&L read-model result (recognized ONLY by read_only:true + paper_pnl_state === PAPER_PNL_READ_MODEL), calibration_records: array of CalibrationRecord-shaped objects (ARCHITECTURE §9 internal field names, consumed-only: trade_id, simulated_fill_price/real_fill_price, simulated_slippage/real_slippage, simulated_exit/real_exit, failed_attempts_count, rpc_latency_ms, route_failure_flag, ordering_confidence, timestamp_processed, timestamp_confirmed) }. eligible_for_calibration marks input shape ONLY — it is NOT execution, NOT a gate, NOT readiness. Fail-Safe-Not-Fail-Open: missing/hostile input -> CALIB_INPUT_UNCONFIGURED; a raw earlier-stage result passed as the read-model (raw_non_paper_pnl_input_refused) OR a smuggled forbidden flag/command/secret/endpoint/mainnet OR a malformed/forbidden-named calibration record -> CALIB_INPUT_INVALID (values never echoed); a recognized read-model whose state is not PAPER_PNL_READ_MODEL -> CALIB_INPUT_DEGRADED; recognized read-model + well-formed records -> CALIB_INPUT_VALID. Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateCalibrationInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'CALIB_INPUT_INVALID'),
    calib_input_boundary_valid: (state === 'CALIB_INPUT_VALID'),
    eligible_for_calibration: (state === 'CALIB_INPUT_VALID'),
    calib_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...calibSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (calibUninspectable(obj, ['purpose', 'paper_pnl_read_model', 'calibration_records'])) {
      return build('CALIB_INPUT_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('CALIB_INPUT_UNCONFIGURED', ['no_calibration_input']);
    }

    // shallow smuggle screen (excluding the two component slots)
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'paper_pnl_read_model' && k !== 'calibration_records') shallow[k] = v;
    }
    const shallowReasons = [...calibScreen(shallow)];
    if (calibHasForbiddenFieldName(shallow)) shallowReasons.push('forbidden_field_name_blocked');
    if (shallowReasons.length > 0) return build('CALIB_INPUT_INVALID', shallowReasons);

    const model = obj.paper_pnl_read_model;
    if (model == null) {
      return build('CALIB_INPUT_UNCONFIGURED', ['paper_pnl_read_model_missing']);
    }
    if (calibLooksLikeRawUpstream(model)) {
      return build('CALIB_INPUT_INVALID', ['raw_non_paper_pnl_input_refused']);
    }
    const modelScreen = calibScreenComponent(model);
    if (modelScreen.length > 0) return build('CALIB_INPUT_INVALID', modelScreen);
    const modelState = calibReadState(model, 'paper_pnl_state', CALIB_PAPER_PNL_STATES);
    if (modelState === null) {
      return build('CALIB_INPUT_INVALID', ['unrecognized_paper_pnl_read_model']);
    }
    if (modelState !== 'PAPER_PNL_READ_MODEL') {
      return build('CALIB_INPUT_DEGRADED', ['paper_pnl_not_read_model']);
    }

    const records = obj.calibration_records;
    if (!Array.isArray(records)) {
      return build('CALIB_INPUT_UNCONFIGURED', ['calibration_records_missing']);
    }
    for (const r of records) {
      const rr = calibValidateRecordShape(r);
      if (rr.length > 0) return build('CALIB_INPUT_INVALID', rr);
    }

    return build('CALIB_INPUT_VALID', ['calibration_input_recognized']);
  } catch {
    return build('CALIB_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (B) CALIBRATION DIVERGENCE READ-MODEL (pure; simulated-vs-real)
// ---------------------------------------------------------------------------

const CALIB_DIVERGENCE_STATES = Object.freeze([
  'CALIB_DIVERGENCE_UNCONFIGURED', 'CALIB_DIVERGENCE_INVALID',
  'CALIB_DIVERGENCE_UNCLASSIFIED', 'CALIB_DIVERGENCE_WITHIN_BAND',
  'CALIB_DIVERGENCE_ELEVATED', 'CALIB_DIVERGENCE_HIGH'
]);

// LOCAL per-dimension classification tokens (SCREAMING case — deliberately
// distinct from any deferred SSOT enum value strings, which stay deferred).
const CALIB_DIMENSION_CLASSIFICATIONS = Object.freeze([
  'WITHIN_BAND', 'ELEVATED', 'HIGH', 'UNCLASSIFIED'
]);

// LOCAL dimension keys (consumed-only vocabulary; not SSOT names).
const CALIB_DIMENSIONS = Object.freeze([
  'fill', 'slippage', 'exit_success', 'latency', 'provider_reliability'
]);

const CALIB_EPSILON = 1e-9;

function calibValidBand(b) {
  return b != null && typeof b === 'object' && !Array.isArray(b) &&
    isNum(b.elevated) && isNum(b.high) && b.elevated >= 0 && b.high > b.elevated;
}

function calibClassify(metric, band) {
  if (!isNum(metric)) return 'UNCLASSIFIED';
  if (!calibValidBand(band)) return 'UNCLASSIFIED';
  if (metric >= band.high) return 'HIGH';
  if (metric >= band.elevated) return 'ELEVATED';
  return 'WITHIN_BAND';
}

export function describeCalibrationDivergenceContract() {
  return Object.freeze({
    contract: 'calibration-divergence-read-model',
    version: '0.0.0',
    test_only: true,
    supported_states: CALIB_DIVERGENCE_STATES,
    supported_dimension_classifications: CALIB_DIMENSION_CLASSIFICATIONS,
    supported_dimensions: CALIB_DIMENSIONS,
    advisory_only: true,
    simulated: true,
    calibration_divergence_state: 'CALIB_DIVERGENCE_UNCONFIGURED',
    dimensions: EMPTY_FROZEN_OBJECT,
    finalized_count: 0,
    non_finalized_count: 0,
    status: 'CALIB_DIVERGENCE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...calibSafeFlags(),
    note: 'Simulated-only CALIBRATION DIVERGENCE READ-MODEL (pure, Stage-15 / Phase B). A PURE FUNCTION over { calibration_records: [CalibrationRecord-shaped objects], divergence_bands: { fill?: {elevated, high}, slippage?: ..., exit_success?: ..., latency?: ..., provider_reliability?: ... } } — re-derives everything on every call (no internal state; deterministic). FINALITY (ARCHITECTURE §9): ONLY records with BOTH timestamp_processed AND timestamp_confirmed participate (others counted as non_finalized_count). Per dimension over finalized paired records: fill/slippage = mean(|simulated - real| / max(|real|, epsilon)); exit_success = |rate(simulated_exit truthy) - rate(real_exit truthy)|; latency = ALWAYS UNCLASSIFIED with reason no_paired_latency_metric (the record carries only an observed rpc_latency_ms, no simulated/real latency pair — fail-safe; a reported mean is exposed as reported_mean_latency_ms when present); provider_reliability = rate(route_failure_flag === true). Classification per dimension (LOCAL tokens): metric < elevated -> WITHIN_BAND; >= elevated and < high -> ELEVATED; >= high -> HIGH; missing/invalid band -> UNCLASSIFIED (missing_divergence_band); zero finalized pairs -> UNCLASSIFIED (insufficient_finalized_pairs) — bands are NEVER defaulted and an unclassifiable dimension is NEVER reported WITHIN_BAND (pessimistic posture). Overall calibration_divergence_state = worst classified dimension (HIGH > ELEVATED > WITHIN_BAND); all dimensions unclassified -> CALIB_DIVERGENCE_UNCLASSIFIED. Divergence is an ADVISORY warning signal feeding existing calibration policy — NOT a new gate, NOT execution authority. Fail-Safe-Not-Fail-Open: missing/hostile input -> UNCONFIGURED; any record carrying a forbidden surface NAME / execution-shaped true flag / exec command / endpoint -> the WHOLE input is refused CALIB_DIVERGENCE_INVALID (never echoed). Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateCalibrationDivergence(input) {
  const build = (state, dims, finalized, nonFinalized, reasons) => Object.freeze({
    valid: (state !== 'CALIB_DIVERGENCE_INVALID'),
    calibration_divergence_state: state,
    simulated: true,
    dimensions: dims || EMPTY_FROZEN_OBJECT,
    finalized_count: finalized || 0,
    non_finalized_count: nonFinalized || 0,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...calibSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (calibUninspectable(obj, ['purpose', 'calibration_records', 'divergence_bands'])) {
      return build('CALIB_DIVERGENCE_UNCONFIGURED', null, 0, 0, ['input_inspection_error']);
    }
    if (!obj) {
      return build('CALIB_DIVERGENCE_UNCONFIGURED', null, 0, 0, ['no_divergence_input']);
    }
    const records = obj.calibration_records;
    if (!Array.isArray(records)) {
      return build('CALIB_DIVERGENCE_UNCONFIGURED', null, 0, 0, ['calibration_records_missing']);
    }
    // screen every record; one bad record refuses the WHOLE input (fail-closed)
    for (const r of records) {
      const rr = calibValidateRecordShape(r);
      if (rr.length > 0) return build('CALIB_DIVERGENCE_INVALID', null, 0, 0, rr);
    }
    const bands = (obj.divergence_bands != null && typeof obj.divergence_bands === 'object' &&
      !Array.isArray(obj.divergence_bands)) ? obj.divergence_bands : {};

    const finalized = records.filter(calibIsFinalized);
    const nonFinalizedCount = records.length - finalized.length;

    const dims = {};
    const reasons = [];

    // fill + slippage: mean absolute relative difference over paired records
    for (const [dim, simF, realF] of [
      ['fill', 'simulated_fill_price', 'real_fill_price'],
      ['slippage', 'simulated_slippage', 'real_slippage']
    ]) {
      const pairs = finalized.filter((r) => isNum(r[simF]) && isNum(r[realF]));
      let metric = null;
      const dimReasons = [];
      if (pairs.length === 0) {
        dimReasons.push('insufficient_finalized_pairs');
      } else {
        let sum = 0;
        for (const r of pairs) {
          sum += Math.abs(r[simF] - r[realF]) / Math.max(Math.abs(r[realF]), CALIB_EPSILON);
        }
        metric = sum / pairs.length;
      }
      let cls = 'UNCLASSIFIED';
      if (metric !== null) {
        if (!calibValidBand(bands[dim])) dimReasons.push('missing_divergence_band');
        cls = calibClassify(metric, bands[dim]);
      }
      dims[dim] = Object.freeze({
        classification: cls, metric, pair_count: pairs.length,
        reasons: Object.freeze(dimReasons), simulated: true
      });
    }

    // exit_success: |rate(sim truthy) - rate(real truthy)| over paired records
    {
      const pairs = finalized.filter((r) =>
        r.simulated_exit !== undefined && r.simulated_exit !== null &&
        r.real_exit !== undefined && r.real_exit !== null);
      let metric = null;
      const dimReasons = [];
      if (pairs.length === 0) {
        dimReasons.push('insufficient_finalized_pairs');
      } else {
        const simRate = pairs.filter((r) => !!r.simulated_exit).length / pairs.length;
        const realRate = pairs.filter((r) => !!r.real_exit).length / pairs.length;
        metric = Math.abs(simRate - realRate);
      }
      let cls = 'UNCLASSIFIED';
      if (metric !== null) {
        if (!calibValidBand(bands.exit_success)) dimReasons.push('missing_divergence_band');
        cls = calibClassify(metric, bands.exit_success);
      }
      dims.exit_success = Object.freeze({
        classification: cls, metric, pair_count: pairs.length,
        reasons: Object.freeze(dimReasons), simulated: true
      });
    }

    // latency: no simulated/real pair exists in the record — ALWAYS
    // UNCLASSIFIED (fail-safe); expose the observed mean as reported-only.
    {
      const withLatency = finalized.filter((r) => isNum(r.rpc_latency_ms));
      const mean = withLatency.length === 0 ? null :
        withLatency.reduce((s, r) => s + r.rpc_latency_ms, 0) / withLatency.length;
      dims.latency = Object.freeze({
        classification: 'UNCLASSIFIED', metric: null,
        reported_mean_latency_ms: mean, pair_count: 0,
        reasons: Object.freeze(['no_paired_latency_metric']), simulated: true
      });
    }

    // provider_reliability: route-failure rate over finalized records
    {
      let metric = null;
      const dimReasons = [];
      if (finalized.length === 0) {
        dimReasons.push('insufficient_finalized_pairs');
      } else {
        metric = finalized.filter((r) => r.route_failure_flag === true).length / finalized.length;
      }
      let cls = 'UNCLASSIFIED';
      if (metric !== null) {
        if (!calibValidBand(bands.provider_reliability)) dimReasons.push('missing_divergence_band');
        cls = calibClassify(metric, bands.provider_reliability);
      }
      dims.provider_reliability = Object.freeze({
        classification: cls, metric, pair_count: finalized.length,
        reasons: Object.freeze(dimReasons), simulated: true
      });
    }

    // overall = worst classified dimension (pessimistic). All unclassified ->
    // CALIB_DIVERGENCE_UNCLASSIFIED (never silently WITHIN_BAND).
    const classes = Object.values(dims).map((d) => d.classification);
    let overall = 'CALIB_DIVERGENCE_UNCLASSIFIED';
    if (classes.includes('HIGH')) overall = 'CALIB_DIVERGENCE_HIGH';
    else if (classes.includes('ELEVATED')) overall = 'CALIB_DIVERGENCE_ELEVATED';
    else if (classes.includes('WITHIN_BAND')) overall = 'CALIB_DIVERGENCE_WITHIN_BAND';
    if (overall === 'CALIB_DIVERGENCE_UNCLASSIFIED') reasons.push('all_dimensions_unclassified');
    if (finalized.length === 0) reasons.push('pessimistic_no_finalized_records');

    return build(overall, Object.freeze(dims), finalized.length, nonFinalizedCount,
      reasons.length > 0 ? reasons : ['divergence_computed']);
  } catch {
    return build('CALIB_DIVERGENCE_UNCONFIGURED', null, 0, 0, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (C) BACKTEST DATASET DESCRIPTOR (point-in-time / survivorship-free)
// ---------------------------------------------------------------------------

const BACKTEST_DATASET_STATES = Object.freeze([
  'BACKTEST_DATASET_UNCONFIGURED', 'BACKTEST_DATASET_INVALID',
  'BACKTEST_DATASET_DEGRADED', 'BACKTEST_DATASET_DESCRIPTOR'
]);

const CALIB_WALLET_STATUS_BUCKETS = Object.freeze(['active', 'extinct', 'unknown']);

export function describeBacktestDatasetDescriptorContract() {
  return Object.freeze({
    contract: 'backtest-dataset-descriptor',
    version: '0.0.0',
    test_only: true,
    supported_states: BACKTEST_DATASET_STATES,
    consumed_wallet_status_buckets: CALIB_WALLET_STATUS_BUCKETS,
    advisory_only: true,
    backtest_dataset_state: 'BACKTEST_DATASET_UNCONFIGURED',
    point_in_time_ok: false,
    survivorship_free: false,
    record_count: 0,
    wallet_count: 0,
    extinct_wallet_count: 0,
    status: 'BACKTEST_DATASET_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...calibSafeFlags(),
    note: 'Read-only BACKTEST DATASET DESCRIPTOR (point-in-time / survivorship-free, Stage-15 / Phase B). Input: { records: ORDERED array of { record_ref (string), as_of_rank (finite number), wallet_ref (string), ...safe fields }, cohort_wallets: [{ wallet_ref, status_bucket active|extinct|unknown }], declared_inactive_wallet_refs?: [string] }. NO FUTURE LEAKAGE: as_of_rank must be NON-DECREASING across the array (equal ranks allowed); a violation -> BACKTEST_DATASET_INVALID future_leakage_order_violation; any record carrying a future_*/lookahead/peek_ahead key -> BACKTEST_DATASET_INVALID future_knowledge_field_refused. SURVIVORSHIP-FREE: every cohort wallet must appear in records OR be explicitly listed in declared_inactive_wallet_refs; a dropped EXTINCT wallet -> BACKTEST_DATASET_INVALID survivorship_risk (extinct/failed wallets must remain in the historical sample — silently dropping them creates survivorship bias); a dropped active/unknown wallet -> BACKTEST_DATASET_DEGRADED missing_cohort_wallet. point_in_time_ok / survivorship_free are true ONLY when their checks pass. A descriptor is a DATASET-SHAPE attestation ONLY — not execution, not a gate, not profitability evidence. Fail-Safe-Not-Fail-Open; hostile -> UNCONFIGURED never throws; every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateBacktestDatasetDescriptor(input) {
  const build = (state, extra, reasons) => Object.freeze({
    valid: (state !== 'BACKTEST_DATASET_INVALID'),
    backtest_dataset_state: state,
    point_in_time_ok: extra ? extra.pit === true : false,
    survivorship_free: extra ? extra.sf === true : false,
    record_count: extra ? extra.recordCount : 0,
    wallet_count: extra ? extra.walletCount : 0,
    extinct_wallet_count: extra ? extra.extinctCount : 0,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...calibSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (calibUninspectable(obj, ['purpose', 'records', 'cohort_wallets', 'declared_inactive_wallet_refs'])) {
      return build('BACKTEST_DATASET_UNCONFIGURED', null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('BACKTEST_DATASET_UNCONFIGURED', null, ['no_backtest_dataset_input']);
    }
    const records = obj.records;
    const cohort = obj.cohort_wallets;
    if (!Array.isArray(records) || !Array.isArray(cohort)) {
      return build('BACKTEST_DATASET_UNCONFIGURED', null, ['records_or_cohort_missing']);
    }
    const declared = Array.isArray(obj.declared_inactive_wallet_refs)
      ? obj.declared_inactive_wallet_refs.filter(isStr) : [];

    // validate records: shape + smuggle + future-knowledge + ordering
    let prevRank = -Infinity;
    const seenWallets = new Set();
    for (const r of records) {
      if (r == null || typeof r !== 'object' || Array.isArray(r)) {
        return build('BACKTEST_DATASET_INVALID', null, ['backtest_record_not_object']);
      }
      const screen = calibScreenComponent(r);
      if (screen.length > 0) return build('BACKTEST_DATASET_INVALID', null, screen);
      if (calibHasFutureKnowledgeKey(r)) {
        return build('BACKTEST_DATASET_INVALID', null, ['future_knowledge_field_refused']);
      }
      if (!isStr(r.record_ref)) return build('BACKTEST_DATASET_INVALID', null, ['record_ref_required']);
      if (!isNum(r.as_of_rank)) return build('BACKTEST_DATASET_INVALID', null, ['as_of_rank_required']);
      if (!isStr(r.wallet_ref)) return build('BACKTEST_DATASET_INVALID', null, ['wallet_ref_required']);
      if (r.as_of_rank < prevRank) {
        return build('BACKTEST_DATASET_INVALID', null, ['future_leakage_order_violation']);
      }
      prevRank = r.as_of_rank;
      seenWallets.add(r.wallet_ref);
    }

    // validate cohort + survivorship
    let extinctCount = 0;
    let survivorshipRisk = false;
    let missingActive = false;
    for (const w of cohort) {
      if (w == null || typeof w !== 'object' || !isStr(w.wallet_ref) ||
          !CALIB_WALLET_STATUS_BUCKETS.includes(w.status_bucket)) {
        return build('BACKTEST_DATASET_INVALID', null, ['invalid_cohort_wallet']);
      }
      if (w.status_bucket === 'extinct') extinctCount += 1;
      const present = seenWallets.has(w.wallet_ref) || declared.includes(w.wallet_ref);
      if (!present) {
        if (w.status_bucket === 'extinct') survivorshipRisk = true;
        else missingActive = true;
      }
    }
    if (survivorshipRisk) {
      return build('BACKTEST_DATASET_INVALID',
        { pit: true, sf: false, recordCount: records.length, walletCount: cohort.length, extinctCount },
        ['survivorship_risk']);
    }
    if (missingActive) {
      return build('BACKTEST_DATASET_DEGRADED',
        { pit: true, sf: true, recordCount: records.length, walletCount: cohort.length, extinctCount },
        ['missing_cohort_wallet']);
    }
    return build('BACKTEST_DATASET_DESCRIPTOR',
      { pit: true, sf: true, recordCount: records.length, walletCount: cohort.length, extinctCount },
      ['backtest_dataset_recognized']);
  } catch {
    return build('BACKTEST_DATASET_UNCONFIGURED', null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (D) BACKTEST REPLAY READ-MODEL (pure deterministic walk)
// ---------------------------------------------------------------------------

const BACKTEST_REPLAY_STATES = Object.freeze([
  'BACKTEST_REPLAY_UNCONFIGURED', 'BACKTEST_REPLAY_INVALID', 'BACKTEST_REPLAY_READ_MODEL'
]);

// validate one simulated fill consumed by the replay (Stage-14 descriptor or
// equivalent). allowNullSignature admits the descriptor's fixed literal.
function calibValidateReplayFill(f) {
  if (f == null || typeof f !== 'object' || Array.isArray(f)) return ['replay_fill_not_object'];
  const screen = calibScreenComponent(f, { allowNullSignature: true });
  if (screen.length > 0) return screen;
  const reasons = [];
  if (!isStr(f.position_ref)) reasons.push('position_ref_required');
  if (!isStr(f.wallet_ref)) reasons.push('wallet_ref_required');
  if (f.side !== 'buy' && f.side !== 'sell') reasons.push('invalid_side');
  if (!isNum(f.quantity) || f.quantity <= 0) reasons.push('invalid_quantity');
  if (!isNum(f.price) || f.price < 0) reasons.push('invalid_price');
  if (f.fee !== undefined && (!isNum(f.fee) || f.fee < 0)) reasons.push('invalid_fee');
  if (f.slippage !== undefined && (!isNum(f.slippage) || f.slippage < 0)) reasons.push('invalid_slippage');
  return reasons;
}

export function describeBacktestReplayContract() {
  return Object.freeze({
    contract: 'backtest-replay-read-model',
    version: '0.0.0',
    test_only: true,
    supported_states: BACKTEST_REPLAY_STATES,
    advisory_only: true,
    simulated: true,
    backtest_replay_state: 'BACKTEST_REPLAY_UNCONFIGURED',
    candidate_pnl_by_wallet: EMPTY_FROZEN_OBJECT,
    status: 'BACKTEST_REPLAY_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...calibSafeFlags(),
    note: 'Simulated-only BACKTEST REPLAY READ-MODEL (pure deterministic walk, Stage-15 / Phase B). Input: { dataset: the SAME { records, cohort_wallets, declared_inactive_wallet_refs? } object validated by the backtest dataset descriptor (re-validated INTERNALLY — fail-closed: only a clean BACKTEST_DATASET_DESCRIPTOR proceeds; INVALID/DEGRADED/hostile datasets are refused), paper_fills_by_record?: { [record_ref]: [simulated fills (Stage-14 descriptors or equivalent)] } }. Walks records strictly in their validated non-decreasing as_of_rank order; fills attached to a record are consumed ONLY at that record position (NO FUTURE LEAKAGE), and each fill wallet_ref must equal its record wallet_ref (fill_wallet_mismatch otherwise). Per wallet: FIFO realized per position_ref (sells consume buy lots in order; over-sell ignored — no shorts), fees + slippage attribution, net = gross - fees - slippage, and LOCAL outcome counters backtest_wins / backtest_losses / backtest_flats / backtest_open per closed/open position. candidate_pnl_by_wallet (registered G22 name, paper-portfolio precedent) maps wallet_ref -> a frozen { net, gross, fees, slippage, backtest_wins, backtest_losses, backtest_flats, backtest_open, simulated:true } bucket. A replay result is a SIMULATED read-model ONLY — never real P&L, never profitability proof, never execution authority. Fail-Safe-Not-Fail-Open: any fill claiming is_valid_on_chain:true / executed:true / signed:true / carrying a forbidden surface NAME -> the WHOLE replay is refused BACKTEST_REPLAY_INVALID (values never echoed). Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateBacktestReplay(input) {
  const build = (state, byWallet, reasons) => Object.freeze({
    valid: (state !== 'BACKTEST_REPLAY_INVALID'),
    backtest_replay_state: state,
    simulated: true,
    candidate_pnl_by_wallet: byWallet || EMPTY_FROZEN_OBJECT,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...calibSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (calibUninspectable(obj, ['purpose', 'dataset', 'paper_fills_by_record'])) {
      return build('BACKTEST_REPLAY_UNCONFIGURED', null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('BACKTEST_REPLAY_UNCONFIGURED', null, ['no_backtest_replay_input']);
    }
    const dataset = obj.dataset;
    if (dataset == null || typeof dataset !== 'object') {
      return build('BACKTEST_REPLAY_UNCONFIGURED', null, ['dataset_missing']);
    }
    // fail-closed: the dataset is re-validated INTERNALLY through (C).
    const descriptor = evaluateBacktestDatasetDescriptor(dataset);
    if (descriptor.backtest_dataset_state !== 'BACKTEST_DATASET_DESCRIPTOR') {
      return build('BACKTEST_REPLAY_INVALID', null, ['dataset_not_clean']);
    }
    const fillsByRecord = (obj.paper_fills_by_record != null &&
      typeof obj.paper_fills_by_record === 'object' &&
      !Array.isArray(obj.paper_fills_by_record)) ? obj.paper_fills_by_record : {};

    // walk records in validated order; per-wallet, per-position FIFO.
    // wallets: wallet_ref -> { gross, fees, slippage, positions: Map }
    const wallets = new Map();
    const walletOf = (ref) => {
      if (!wallets.has(ref)) wallets.set(ref, { gross: 0, fees: 0, slippage: 0, positions: new Map() });
      return wallets.get(ref);
    };
    const positionOf = (w, ref) => {
      if (!w.positions.has(ref)) w.positions.set(ref, { lots: [], realized: 0 });
      return w.positions.get(ref);
    };

    for (const record of dataset.records) {
      const fills = fillsByRecord[record.record_ref];
      if (fills === undefined) continue;
      if (!Array.isArray(fills)) {
        return build('BACKTEST_REPLAY_INVALID', null, ['invalid_fills_for_record']);
      }
      for (const f of fills) {
        const fr = calibValidateReplayFill(f);
        if (fr.length > 0) return build('BACKTEST_REPLAY_INVALID', null, fr);
        if (f.wallet_ref !== record.wallet_ref) {
          return build('BACKTEST_REPLAY_INVALID', null, ['fill_wallet_mismatch']);
        }
        const w = walletOf(f.wallet_ref);
        const p = positionOf(w, f.position_ref);
        w.fees += isNum(f.fee) ? f.fee : 0;
        w.slippage += isNum(f.slippage) ? f.slippage : 0;
        if (f.side === 'buy') {
          p.lots.push({ qty: f.quantity, price: f.price });
        } else {
          let remaining = f.quantity;
          while (remaining > 0 && p.lots.length > 0) {
            const lot = p.lots[0];
            const m = Math.min(remaining, lot.qty);
            const realized = (f.price - lot.price) * m;
            p.realized += realized;
            w.gross += realized;
            lot.qty -= m;
            remaining -= m;
            if (lot.qty === 0) p.lots.shift();
          }
          // remaining > 0 = over-sell beyond open lots -> ignored (no shorts)
        }
      }
    }

    const byWallet = {};
    for (const [ref, w] of wallets.entries()) {
      let wins = 0, losses = 0, flats = 0, open = 0;
      for (const p of w.positions.values()) {
        const openQty = p.lots.reduce((s, l) => s + l.qty, 0);
        if (openQty > 0) { open += 1; continue; }
        if (p.realized > 0) wins += 1;
        else if (p.realized < 0) losses += 1;
        else flats += 1;
      }
      byWallet[ref] = Object.freeze({
        net: w.gross - w.fees - w.slippage,
        gross: w.gross,
        fees: w.fees,
        slippage: w.slippage,
        backtest_wins: wins,
        backtest_losses: losses,
        backtest_flats: flats,
        backtest_open: open,
        simulated: true
      });
    }

    return build('BACKTEST_REPLAY_READ_MODEL', Object.freeze(byWallet), ['backtest_replay_computed']);
  } catch {
    return build('BACKTEST_REPLAY_UNCONFIGURED', null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (E) CALIBRATION SUPPRESSION (always suppressed for execution/sign/send)
// ---------------------------------------------------------------------------

const CALIB_SUPPRESSION_ALWAYS = Object.freeze([
  'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
]);

const CALIB_SUPPRESSION_REASON_CODES = Object.freeze([
  'calibration_input_not_valid', 'divergence_invalid', 'dataset_not_clean',
  'replay_invalid', 'live_surface_detected',
  'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
]);

const CALIB_SUPPRESSION_COMPONENTS = Object.freeze([
  'calibration_input_boundary', 'calibration_divergence',
  'backtest_dataset_descriptor', 'backtest_replay', 'calibration_surface'
]);

export function describeCalibrationSuppressionContract() {
  return Object.freeze({
    contract: 'calibration-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: CALIB_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: false,
    suppression_reasons: Object.freeze([]),
    status: 'CALIB_SUPPRESSION_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...calibSafeFlags(),
    note: 'Read-only CALIBRATION SUPPRESSION (Stage-15 / Phase B). ALWAYS suppressed:true — calibration/backtest read-models NEVER authorize execution, signing, or sending; not_execution_authorized + not_sign_authorized + not_send_authorized are carried on EVERY path (clean, blocked, hostile, missing). Component-specific reason codes (calibration_input_not_valid / divergence_invalid / dataset_not_clean / replay_invalid / live_surface_detected) are added when the corresponding component is not clean. Fail-Safe-Not-Fail-Open; hostile -> still suppressed, never throws; every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateCalibrationSuppression(input) {
  const build = (codes) => {
    const all = [...new Set([...(codes || []), ...CALIB_SUPPRESSION_ALWAYS])]
      .filter((c) => CALIB_SUPPRESSION_REASON_CODES.includes(c));
    return Object.freeze({
      suppressed: true,
      suppression_reasons: Object.freeze(all),
      status: 'CALIB_SUPPRESSED',
      reasons: Object.freeze(all),
      read_only: true,
      advisory_only: true,
      ...calibSafeFlags()
    });
  };
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (calibUninspectable(obj, ['purpose', ...CALIB_SUPPRESSION_COMPONENTS])) {
      return build([]);
    }
    if (!obj) return build([]);

    const codes = [];
    const boundary = obj.calibration_input_boundary;
    if (boundary != null) {
      const bs = calibReadState(boundary, 'calib_input_state', CALIB_INPUT_STATES);
      if (bs !== 'CALIB_INPUT_VALID') codes.push('calibration_input_not_valid');
    } else {
      codes.push('calibration_input_not_valid');
    }
    const divergence = obj.calibration_divergence;
    if (divergence != null) {
      const ds = calibReadState(divergence, 'calibration_divergence_state', CALIB_DIVERGENCE_STATES);
      if (ds === 'CALIB_DIVERGENCE_INVALID' || ds === null) codes.push('divergence_invalid');
    }
    const dataset = obj.backtest_dataset_descriptor;
    if (dataset != null) {
      const cs = calibReadState(dataset, 'backtest_dataset_state', BACKTEST_DATASET_STATES);
      if (cs !== 'BACKTEST_DATASET_DESCRIPTOR') codes.push('dataset_not_clean');
    }
    const replay = obj.backtest_replay;
    if (replay != null) {
      const rs = calibReadState(replay, 'backtest_replay_state', BACKTEST_REPLAY_STATES);
      if (rs === 'BACKTEST_REPLAY_INVALID' || rs === null) codes.push('replay_invalid');
    }
    const surface = obj.calibration_surface;
    if (surface != null) {
      const ss = calibReadState(surface, 'calibration_surface_state', CALIB_SURFACE_STATES);
      if (ss === 'CALIB_SURFACE_BLOCKED') codes.push('live_surface_detected');
    }
    return build(codes);
  } catch {
    return build([]);
  }
}

// ---------------------------------------------------------------------------
// (F) CALIBRATION FORBIDDEN SURFACE GUARD
// ---------------------------------------------------------------------------

const CALIB_SURFACE_STATES = Object.freeze([
  'CALIB_SURFACE_UNCONFIGURED', 'CALIB_SURFACE_CLEAN', 'CALIB_SURFACE_BLOCKED'
]);

export function describeCalibrationForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'calibration-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    supported_states: CALIB_SURFACE_STATES,
    forbidden_field_names: CALIB_SURFACE_FORBIDDEN_NAMES,
    advisory_only: true,
    calibration_surface_state: 'CALIB_SURFACE_UNCONFIGURED',
    live_surface_detected: false,
    key_material_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'CALIB_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...calibSafeFlags(),
    note: 'Read-only CALIBRATION FORBIDDEN SURFACE GUARD (Stage-15 / Phase B). Scans ONLY top-level keys (deterministic, bounded, pure) for forbidden field NAMES — key material (private_key, secret_key, keypair, mnemonic, seed, signing_key, signature, signed_tx, signed_transaction) + live surfaces (endpoint, endpoint_url, rpc_url, provider_url, node_url, ws_url, serialized_tx, serialized_transaction, wire_transaction, raw_tx, raw_transaction, tx_bytes, message_bytes, broadcast_payload, send_payload). The detection booleans live_surface_detected / key_material_detected / forbidden_field_detected are DETECTION outputs (true == a forbidden surface was found == the SAFE BLOCKED state); they are NOT readiness/execution flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing/hostile input -> CALIB_SURFACE_UNCONFIGURED (frozen, never throws); clean -> CALIB_SURFACE_CLEAN (all detection booleans false); ANY forbidden name present -> CALIB_SURFACE_BLOCKED (key_material_detected:true for a key/seed/signature name, false for a live-endpoint-only name; forbidden_field_ref = the matched NAME). Opens NOTHING — every readiness/execution flag STAYS false.'
  });
}

export function evaluateCalibrationForbiddenSurface(input) {
  const build = (state, kind, ref, reasons) => Object.freeze({
    calibration_surface_state: state,
    live_surface_detected: (state === 'CALIB_SURFACE_BLOCKED'),
    key_material_detected: (state === 'CALIB_SURFACE_BLOCKED') ? (kind === 'key') : false,
    forbidden_field_detected: (state === 'CALIB_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'CALIB_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...calibSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (calibUninspectable(obj, [...CALIB_SURFACE_FORBIDDEN_NAMES])) {
      return build('CALIB_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('CALIB_SURFACE_UNCONFIGURED', null, null, ['no_calibration_surface_input']);
    }
    let keys;
    try {
      keys = Object.keys(obj);
    } catch {
      return build('CALIB_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    for (const k of keys) {
      if (CALIB_SURFACE_FORBIDDEN_NAMES.includes(k)) {
        const kind = CALIB_SURFACE_KEY_MATERIAL_NAMES.includes(k) ? 'key' : 'live';
        // forbidden_field_ref = the matched NAME only (REDACTED); NEVER the VALUE
        return build('CALIB_SURFACE_BLOCKED', kind, k,
          [kind === 'key' ? 'key_material_detected' : 'live_endpoint_detected']);
      }
    }
    return build('CALIB_SURFACE_CLEAN', null, null, ['calibration_surface_clean']);
  } catch {
    return build('CALIB_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (G) CALIBRATION HEALTH
// ---------------------------------------------------------------------------

const CALIB_HEALTH_STATES = Object.freeze([
  'CALIB_HEALTH_UNCONFIGURED', 'CALIB_HEALTH_DEGRADED',
  'CALIB_HEALTH_REVIEWED_ADVISORY', 'CALIB_HEALTH_SUPPRESSED', 'CALIB_HEALTH_BLOCKED'
]);

const CALIB_HEALTH_COMPONENTS = Object.freeze([
  'calibration_input_boundary', 'calibration_divergence',
  'backtest_dataset_descriptor', 'backtest_replay',
  'calibration_suppression', 'calibration_surface'
]);

export function describeCalibrationHealthContract() {
  return Object.freeze({
    contract: 'calibration-health',
    version: '0.0.0',
    test_only: true,
    supported_states: CALIB_HEALTH_STATES,
    advisory_only: true,
    calibration_health_state: 'CALIB_HEALTH_UNCONFIGURED',
    status: 'CALIB_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...calibSafeFlags(),
    note: 'Read-only CALIBRATION HEALTH (Stage-15 / Phase B). Aggregates the calibration input boundary (A) + divergence read-model (B) + backtest dataset descriptor (C) + backtest replay (D) + suppression (E) + forbidden surface (F). Ordering (Fail-Safe-Not-Fail-Open): smuggled forbidden flag/command/secret/endpoint on any component -> CALIB_HEALTH_BLOCKED; surface CALIB_SURFACE_BLOCKED OR boundary CALIB_INPUT_INVALID OR divergence CALIB_DIVERGENCE_INVALID OR dataset BACKTEST_DATASET_INVALID OR replay BACKTEST_REPLAY_INVALID -> CALIB_HEALTH_BLOCKED; any required component missing/unrecognized -> CALIB_HEALTH_UNCONFIGURED; suppression suppressed:true (the standard clean path — calibration is ALWAYS suppressed for execution/sign/send) -> CALIB_HEALTH_SUPPRESSED; an explicit not-suppressed object with everything clean -> CALIB_HEALTH_REVIEWED_ADVISORY (which STILL opens nothing); anything else -> CALIB_HEALTH_DEGRADED. Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateCalibrationHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'CALIB_HEALTH_BLOCKED'),
    calibration_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...calibSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (calibUninspectable(obj, [...CALIB_HEALTH_COMPONENTS])) {
      return build('CALIB_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('CALIB_HEALTH_UNCONFIGURED', ['no_calibration_health_input']);
    }

    // component smuggle screen -> BLOCKED
    for (const k of CALIB_HEALTH_COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      if (calibScreenComponent(c).length > 0) {
        return build('CALIB_HEALTH_BLOCKED', ['forbidden_input_blocked']);
      }
    }

    const boundary = obj.calibration_input_boundary;
    const divergence = obj.calibration_divergence;
    const dataset = obj.backtest_dataset_descriptor;
    const replay = obj.backtest_replay;
    const suppression = obj.calibration_suppression;
    const surface = obj.calibration_surface;

    const boundaryState = calibReadState(boundary, 'calib_input_state', CALIB_INPUT_STATES);
    const divergenceState = calibReadState(divergence, 'calibration_divergence_state', CALIB_DIVERGENCE_STATES);
    const datasetState = calibReadState(dataset, 'backtest_dataset_state', BACKTEST_DATASET_STATES);
    const replayState = calibReadState(replay, 'backtest_replay_state', BACKTEST_REPLAY_STATES);
    const surfaceState = calibReadState(surface, 'calibration_surface_state', CALIB_SURFACE_STATES);
    const suppressionVal = (suppression != null && typeof suppression === 'object' &&
      !Array.isArray(suppression) && suppression.read_only === true &&
      typeof suppression.suppressed === 'boolean' && Array.isArray(suppression.suppression_reasons))
      ? suppression.suppressed : null;

    // hard blocks first
    if (surfaceState === 'CALIB_SURFACE_BLOCKED' ||
        boundaryState === 'CALIB_INPUT_INVALID' ||
        divergenceState === 'CALIB_DIVERGENCE_INVALID' ||
        datasetState === 'BACKTEST_DATASET_INVALID' ||
        replayState === 'BACKTEST_REPLAY_INVALID') {
      return build('CALIB_HEALTH_BLOCKED', ['calibration_health_blocked']);
    }

    // missing required components -> UNCONFIGURED
    if (boundary == null || divergence == null || dataset == null ||
        replay == null || suppression == null || surface == null ||
        boundaryState === null || divergenceState === null || datasetState === null ||
        replayState === null || surfaceState === null || suppressionVal === null) {
      return build('CALIB_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // suppression active (the standard clean path) -> SUPPRESSED
    if (suppressionVal === true) {
      return build('CALIB_HEALTH_SUPPRESSED', ['calibration_suppressed']);
    }

    // explicit not-suppressed + everything clean -> REVIEWED_ADVISORY
    if (boundaryState === 'CALIB_INPUT_VALID' &&
        datasetState === 'BACKTEST_DATASET_DESCRIPTOR' &&
        replayState === 'BACKTEST_REPLAY_READ_MODEL' &&
        surfaceState === 'CALIB_SURFACE_CLEAN') {
      return build('CALIB_HEALTH_REVIEWED_ADVISORY', ['calibration_reviewed_advisory']);
    }

    return build('CALIB_HEALTH_DEGRADED', ['calibration_health_degraded']);
  } catch {
    return build('CALIB_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
