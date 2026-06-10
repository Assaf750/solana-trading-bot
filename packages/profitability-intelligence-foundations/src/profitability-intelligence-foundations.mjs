// @soltrade/profitability-intelligence-foundations
//
// SIMULATED-ONLY / read-only / ADVISORY-ONLY STRATEGY & WALLET PROFITABILITY
// INTELLIGENCE foundation for Stage-16 (Phase B) of the architecture pipeline
// `data -> signal -> risk -> intent -> route -> sign -> send`. This package
// builds ONLY a profitability input boundary, a pure per-wallet PROFITABILITY
// read-model over the simulated Stage-15 backtest replay output, a heuristic
// diagnostic RISK-FLAGS read-model, a copyability ADVISORY composer, an
// always-suppressed suppression layer, a forbidden-surface guard, and a
// profitability health read-model. It CONSUMES the already-computed Stage-14
// paper P&L read-model result and the Stage-15 backtest replay result PASSED
// IN as args. Import-free, pure, deterministic. NO clock, NO RNG, NO network
// primitive, NO live stream, NO live quote, NO RPC/route call, NO signing,
// NO sending, NO broadcasting, NO SignerService activation, NO private key /
// seed / mnemonic / keypair material, no persistence, no secrets, no mutable
// module/global state.
//
// THE CORE RULES:
//  - A profitability / risk-flag / advisory read-model is a SIMULATED-ONLY
//    ADVISORY REPRESENTATION (simulated:true + advisory_only:true) — never
//    presented as real profit, never a gate, never execution authority,
//    never an auto-apply, never an auto-ban, never a config change. An
//    advisory NEVER closes positions and NEVER changes follow state. All 24
//    readiness/execution flags STAY false on every result of every state.
//  - NO INSTRUCTION-SHAPED OUTPUT: no result carries an instruction-shaped
//    field; recommendations are LOCAL enum tokens on the profitability_advisory
//    field — explicitly NOT a command, NOT config, NOT auto-applied, and
//    KEEP_EVALUATING is NEVER a copy-allowed-style promotion (promotion is a
//    different governed system).
//  - FAIL-SAFE EVIDENCE: min_sample_size is a caller-supplied number, NEVER
//    defaulted — missing/invalid yields the INSUFFICIENT_EVIDENCE posture for
//    every wallet (thin data never produces a confident verdict). Missing
//    heuristic thresholds mean flags CANNOT clear a wallet — the posture is
//    unevaluated, not clean.
//  - RISK VETO: a suspected risk flag VETOES regardless of positive net —
//    apparent profit is not copyable edge until the risk is cleared.
//  - TOCTOU SNAPSHOT: every consumed object/array/bucket is snapshotted ONCE
//    ({ ...spread }) and the SAME snapshot is validated AND consumed — a
//    hostile getter cannot serve clean values to validation and dirty values
//    to derivation.
//  - HONEST METRICS: the Stage-15 replay buckets carry win/loss/flat COUNTS,
//    not per-position gain/loss money sums — a count-based ratio is NOT a
//    money-weighted profit factor, so profitability_profit_factor is ALWAYS
//    null (never faked) and profitability_win_loss_ratio (a count ratio) is
//    exposed instead.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract
// identifier with a profitability_/PROFITABILITY_ (or spec-fixed
// COPYABILITY_ADVISORY_) prefix, NOT an SSOT name — EXCEPT the already-
// registered candidate FIELD name candidate_pnl_by_wallet (G22,
// paper-portfolio / Stage-15 precedent) consumed-only from the Stage-15
// replay result. The deferred SSOT intelligence enums stay DEFERRED and are
// NOT used here, neither as names nor as value strings. Field names like
// endpoint / rpc_url / serialized_tx / signed_transaction / signature /
// message_bytes / private_key / keypair / mnemonic / seed appear ONLY as
// fixed string literals inside forbidden-NAME allowlist arrays and prose —
// never as real objects, calls, or emitted forbidden output keys, and a
// VALUE is NEVER echoed.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function profitSafeFlags() {
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

const PROFIT_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live',
  // execution-shaped claims on consumed objects are equally refused
  'is_valid_on_chain', 'executed', 'signed'
]);

const PROFIT_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell_order', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute', 'rpc_call',
  'connect_rpc', 'send_transaction', 'broadcast_transaction', 'run_stage',
  'run_pipeline', 'execute_pipeline'
]);

const PROFIT_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential|signing_key|signer_secret/i;
const PROFIT_URL_RE = /https?:\/\/|wss?:\/\//i;
const PROFIT_MAINNET_RE = /mainnet|prod/i;

// opaque refs / consumed-only fields exempt from the secret-NAME scan (their
// VALUES are still scanned for URL/secret/mainnet substrings).
const PROFIT_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'wallet_ref', 'position_ref', 'record_ref', 'status', 'note'
]);

function profitHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of PROFIT_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function profitHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (PROFIT_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function profitHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (PROFIT_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (PROFIT_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function profitHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (PROFIT_URL_RE.test(v) || PROFIT_MAINNET_RE.test(v))) return true;
  }
  return false;
}

// shared forbidden field NAMES — key material + live surfaces.
const PROFIT_SURFACE_KEY_MATERIAL_NAMES = Object.freeze([
  'private_key', 'secret_key', 'keypair', 'mnemonic', 'seed', 'signing_key',
  'signature', 'signed_tx', 'signed_transaction'
]);
const PROFIT_SURFACE_LIVE_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'rpc_url', 'provider_url', 'node_url', 'ws_url',
  'serialized_tx', 'serialized_transaction', 'wire_transaction', 'raw_tx',
  'raw_transaction', 'tx_bytes', 'message_bytes', 'broadcast_payload', 'send_payload'
]);
const PROFIT_SURFACE_FORBIDDEN_NAMES = Object.freeze([
  ...PROFIT_SURFACE_KEY_MATERIAL_NAMES, ...PROFIT_SURFACE_LIVE_NAMES
]);

function profitHasForbiddenFieldName(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (PROFIT_SURFACE_FORBIDDEN_NAMES.includes(String(k))) return true;
  }
  return false;
}

function profitScreen(o) {
  const r = [];
  if (profitHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (profitHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (profitHasSecretField(o)) r.push('secret_field_blocked');
  if (profitHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

function profitScreenComponent(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (profitHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (profitHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (profitHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (profitHasForbiddenFieldName(c)) r.push('forbidden_field_name_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function profitUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

function profitReadState(o, field, allowed) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  const v = o[field];
  if (typeof v === 'string' && allowed.includes(v)) return v;
  return null;
}

// snapshot one consumed object EXACTLY ONCE (TOCTOU defense); non-objects
// pass through unchanged so shape validation still rejects them.
function profitSnapshot(o) {
  return (o != null && typeof o === 'object' && !Array.isArray(o)) ? { ...o } : o;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isCount = (v) => isNum(v) && v >= 0 && Number.isInteger(v);

const EMPTY_FROZEN_OBJECT = Object.freeze({});

// ---------------------------------------------------------------------------
// Upstream terminal-result recognizers (consumed-only state strings).
// ---------------------------------------------------------------------------

const PROFIT_PAPER_PNL_STATES = Object.freeze([
  'PAPER_PNL_UNCONFIGURED', 'PAPER_PNL_INVALID', 'PAPER_PNL_READ_MODEL'
]);

const PROFIT_BACKTEST_REPLAY_STATES = Object.freeze([
  'BACKTEST_REPLAY_UNCONFIGURED', 'BACKTEST_REPLAY_INVALID', 'BACKTEST_REPLAY_READ_MODEL'
]);

// raw upstream-result MARKERS: a raw Stage-13/12/11/... result (or a non-
// terminal Stage-15 component) passed where a read-model is expected is
// REFUSED — only the Stage-14 paper P&L read-model and the Stage-15 backtest
// replay read-model are accepted.
const PROFIT_RAW_UPSTREAM_MARKER_KEYS = Object.freeze([
  'pipeline_decision_state', 'pipeline_decision_health_state', 'trace_entries',
  'send_review_state', 'send_review_health_state',
  'signing_review_state', 'signing_review_health_state',
  'tx_build_review_state', 'execution_plan_preview_state', 'intent_state',
  'risk_verdict_state', 'signal_state',
  'calib_input_state', 'calibration_divergence_state',
  'backtest_dataset_state', 'calibration_health_state'
]);

function profitLooksLikeRawUpstream(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of PROFIT_RAW_UPSTREAM_MARKER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(o, k)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// (A) PROFITABILITY INPUT BOUNDARY
// ---------------------------------------------------------------------------

const PROFIT_INPUT_STATES = Object.freeze([
  'PROFITABILITY_INPUT_UNCONFIGURED', 'PROFITABILITY_INPUT_INVALID',
  'PROFITABILITY_INPUT_DEGRADED', 'PROFITABILITY_INPUT_VALID'
]);

export function describeProfitabilityInputBoundaryContract() {
  return Object.freeze({
    contract: 'profitability-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: PROFIT_INPUT_STATES,
    advisory_only: true,
    profitability_input_state: 'PROFITABILITY_INPUT_UNCONFIGURED',
    profitability_input_boundary_valid: false,
    eligible_for_profitability_intelligence: false,
    status: 'PROFITABILITY_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...profitSafeFlags(),
    note: 'Read-only PROFITABILITY INPUT boundary (Stage-16 / Phase B). Input is { paper_pnl_read_model: a REAL Stage-14 paper P&L read-model result (recognized ONLY by read_only:true + paper_pnl_state), backtest_replay: a REAL Stage-15 backtest replay result (recognized ONLY by read_only:true + backtest_replay_state) }. Each consumed component is SNAPSHOTTED ONCE (TOCTOU) and the SAME snapshot is validated. eligible_for_profitability_intelligence is true ONLY when BOTH components are present AND in their READ_MODEL states (PAPER_PNL_READ_MODEL + BACKTEST_REPLAY_READ_MODEL) — it marks input shape ONLY; it is NOT execution, NOT a gate, NOT readiness. Fail-Safe-Not-Fail-Open: missing/hostile input -> PROFITABILITY_INPUT_UNCONFIGURED; a raw earlier-stage result passed as either slot (raw_non_read_model_input_refused) OR a smuggled forbidden flag/command/secret/endpoint/mainnet OR an unrecognized component -> PROFITABILITY_INPUT_INVALID (values never echoed); recognized components not in their READ_MODEL states -> PROFITABILITY_INPUT_DEGRADED; both READ_MODEL -> PROFITABILITY_INPUT_VALID. Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateProfitabilityInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'PROFITABILITY_INPUT_INVALID'),
    profitability_input_boundary_valid: (state === 'PROFITABILITY_INPUT_VALID'),
    eligible_for_profitability_intelligence: (state === 'PROFITABILITY_INPUT_VALID'),
    profitability_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...profitSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (profitUninspectable(obj, ['purpose', 'paper_pnl_read_model', 'backtest_replay'])) {
      return build('PROFITABILITY_INPUT_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('PROFITABILITY_INPUT_UNCONFIGURED', ['no_profitability_input']);
    }

    // shallow smuggle screen (excluding the two component slots)
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'paper_pnl_read_model' && k !== 'backtest_replay') shallow[k] = v;
    }
    const shallowReasons = [...profitScreen(shallow)];
    if (profitHasForbiddenFieldName(shallow)) shallowReasons.push('forbidden_field_name_blocked');
    if (shallowReasons.length > 0) return build('PROFITABILITY_INPUT_INVALID', shallowReasons);

    // TOCTOU defense: snapshot each component slot ONCE; validate the SAME
    // snapshot that recognition reads from.
    const model = profitSnapshot(obj.paper_pnl_read_model);
    if (model == null) {
      return build('PROFITABILITY_INPUT_UNCONFIGURED', ['paper_pnl_read_model_missing']);
    }
    if (profitLooksLikeRawUpstream(model)) {
      return build('PROFITABILITY_INPUT_INVALID', ['raw_non_read_model_input_refused']);
    }
    const modelScreen = profitScreenComponent(model);
    if (modelScreen.length > 0) return build('PROFITABILITY_INPUT_INVALID', modelScreen);
    const modelState = profitReadState(model, 'paper_pnl_state', PROFIT_PAPER_PNL_STATES);
    if (modelState === null) {
      return build('PROFITABILITY_INPUT_INVALID', ['unrecognized_paper_pnl_read_model']);
    }

    const replay = profitSnapshot(obj.backtest_replay);
    if (replay == null) {
      return build('PROFITABILITY_INPUT_UNCONFIGURED', ['backtest_replay_missing']);
    }
    if (profitLooksLikeRawUpstream(replay)) {
      return build('PROFITABILITY_INPUT_INVALID', ['raw_non_read_model_input_refused']);
    }
    const replayScreen = profitScreenComponent(replay);
    if (replayScreen.length > 0) return build('PROFITABILITY_INPUT_INVALID', replayScreen);
    const replayState = profitReadState(replay, 'backtest_replay_state', PROFIT_BACKTEST_REPLAY_STATES);
    if (replayState === null) {
      return build('PROFITABILITY_INPUT_INVALID', ['unrecognized_backtest_replay']);
    }

    const degraded = [];
    if (modelState !== 'PAPER_PNL_READ_MODEL') degraded.push('paper_pnl_not_read_model');
    if (replayState !== 'BACKTEST_REPLAY_READ_MODEL') degraded.push('backtest_replay_not_read_model');
    if (degraded.length > 0) return build('PROFITABILITY_INPUT_DEGRADED', degraded);

    return build('PROFITABILITY_INPUT_VALID', ['profitability_input_recognized']);
  } catch {
    return build('PROFITABILITY_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (B) WALLET PROFITABILITY READ-MODEL (pure; over the Stage-15 replay map)
// ---------------------------------------------------------------------------

const PROFITABILITY_STATES = Object.freeze([
  'PROFITABILITY_UNCONFIGURED', 'PROFITABILITY_INVALID', 'PROFITABILITY_READ_MODEL'
]);

// LOCAL per-wallet evidence tokens (SCREAMING case — deliberately distinct
// from any deferred SSOT enum value strings, which stay deferred).
const PROFITABILITY_EVIDENCE_TOKENS = Object.freeze([
  'SUFFICIENT', 'INSUFFICIENT_EVIDENCE'
]);

const PROFIT_BUCKET_NUMERIC_FIELDS = Object.freeze(['net', 'gross', 'fees', 'slippage']);
const PROFIT_BUCKET_COUNT_FIELDS = Object.freeze([
  'backtest_wins', 'backtest_losses', 'backtest_flats', 'backtest_open'
]);

// validate one snapshotted replay bucket; returns reason strings (empty = ok)
function profitValidateBucket(b) {
  if (b == null || typeof b !== 'object' || Array.isArray(b)) {
    return ['replay_bucket_not_object'];
  }
  const screen = profitScreenComponent(b);
  if (screen.length > 0) return screen;
  const reasons = [];
  for (const f of PROFIT_BUCKET_NUMERIC_FIELDS) {
    if (!isNum(b[f])) { reasons.push('invalid_bucket_numeric_field'); break; }
  }
  for (const f of PROFIT_BUCKET_COUNT_FIELDS) {
    if (!isCount(b[f])) { reasons.push('invalid_bucket_count_field'); break; }
  }
  return reasons;
}

export function describeWalletProfitabilityContract() {
  return Object.freeze({
    contract: 'wallet-profitability-read-model',
    version: '0.0.0',
    test_only: true,
    supported_states: PROFITABILITY_STATES,
    supported_evidence_tokens: PROFITABILITY_EVIDENCE_TOKENS,
    advisory_only: true,
    simulated: true,
    profitability_state: 'PROFITABILITY_UNCONFIGURED',
    profitability_by_wallet: EMPTY_FROZEN_OBJECT,
    profitability_min_sample_size_valid: false,
    status: 'PROFITABILITY_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...profitSafeFlags(),
    note: 'Simulated-only WALLET PROFITABILITY READ-MODEL (pure, Stage-16 / Phase B). A PURE FUNCTION over { backtest_replay: a REAL Stage-15 backtest replay result (recognized ONLY by read_only:true + backtest_replay_state === BACKTEST_REPLAY_READ_MODEL), min_sample_size: a CALLER-SUPPLIED finite number >= 0 — NEVER defaulted }. TOCTOU defense: the replay result, its candidate_pnl_by_wallet map (the registered G22 candidate field, consumed-only), and EVERY bucket are each snapshotted EXACTLY ONCE; the SAME snapshot is validated and consumed. Per wallet the LOCAL derived fields are: profitability_net (= bucket net), profitability_gross, profitability_fees, profitability_slippage, profitability_wins/losses/flats/open (count passthrough), profitability_closed_count (wins+losses+flats), profitability_win_rate (wins/closed; null when closed == 0), profitability_win_loss_ratio (wins/losses COUNT ratio; null when losses == 0), profitability_profit_factor (ALWAYS null — the replay buckets carry COUNTS, not per-position gain/loss money sums, so a money-weighted profit factor CANNOT be derived and is NEVER faked), profitability_evidence (SUFFICIENT only when closed_count >= min_sample_size; a missing/invalid min_sample_size yields INSUFFICIENT_EVIDENCE for EVERY wallet — never a confident verdict from thin or unconfigured data). All numbers are SIMULATED backtest derivations (simulated:true) — never real profit, never profitability proof, never execution authority. Fail-Safe-Not-Fail-Open: missing/hostile input -> PROFITABILITY_UNCONFIGURED; raw earlier-stage results, unrecognized/non-READ_MODEL replays, or any bucket carrying an execution-shaped claim or forbidden surface NAME -> the WHOLE input is refused PROFITABILITY_INVALID (values never echoed). Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateWalletProfitability(input) {
  const build = (state, byWallet, minValid, reasons) => Object.freeze({
    valid: (state !== 'PROFITABILITY_INVALID'),
    profitability_state: state,
    simulated: true,
    profitability_by_wallet: byWallet || EMPTY_FROZEN_OBJECT,
    profitability_min_sample_size_valid: minValid === true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...profitSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (profitUninspectable(obj, ['purpose', 'backtest_replay', 'min_sample_size'])) {
      return build('PROFITABILITY_UNCONFIGURED', null, false, ['input_inspection_error']);
    }
    if (!obj) {
      return build('PROFITABILITY_UNCONFIGURED', null, false, ['no_wallet_profitability_input']);
    }

    // TOCTOU defense: snapshot the replay ONCE — recognition, screening and
    // the map read all use the SAME snapshot (candidate_pnl_by_wallet is read
    // exactly once from the original object, during the spread).
    const replay = profitSnapshot(obj.backtest_replay);
    if (replay == null) {
      return build('PROFITABILITY_UNCONFIGURED', null, false, ['backtest_replay_missing']);
    }
    if (profitLooksLikeRawUpstream(replay)) {
      return build('PROFITABILITY_INVALID', null, false, ['raw_non_read_model_input_refused']);
    }
    const replayScreen = profitScreenComponent(replay);
    if (replayScreen.length > 0) return build('PROFITABILITY_INVALID', null, false, replayScreen);
    const replayState = profitReadState(replay, 'backtest_replay_state', PROFIT_BACKTEST_REPLAY_STATES);
    if (replayState === null) {
      return build('PROFITABILITY_INVALID', null, false, ['unrecognized_backtest_replay']);
    }
    if (replayState !== 'BACKTEST_REPLAY_READ_MODEL') {
      return build('PROFITABILITY_INVALID', null, false, ['backtest_replay_not_read_model']);
    }
    const rawMap = replay.candidate_pnl_by_wallet;
    if (rawMap == null || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
      return build('PROFITABILITY_INVALID', null, false, ['replay_wallet_map_missing']);
    }
    // snapshot the map ONCE, then snapshot each bucket ONCE; validation and
    // derivation both run over the SAME bucket snapshots.
    const mapSnapshot = { ...rawMap };

    // min_sample_size: caller-supplied, NEVER defaulted. Missing/invalid ->
    // INSUFFICIENT_EVIDENCE posture for every wallet (the result is still a
    // read-model, but no wallet can reach SUFFICIENT).
    const rawMin = obj.min_sample_size;
    const minValid = isNum(rawMin) && rawMin >= 0;

    const byWallet = {};
    for (const [ref, rawBucket] of Object.entries(mapSnapshot)) {
      const b = profitSnapshot(rawBucket);
      const bucketReasons = profitValidateBucket(b);
      if (bucketReasons.length > 0) {
        return build('PROFITABILITY_INVALID', null, minValid, bucketReasons);
      }
      const closed = b.backtest_wins + b.backtest_losses + b.backtest_flats;
      byWallet[ref] = Object.freeze({
        profitability_net: b.net,
        profitability_gross: b.gross,
        profitability_fees: b.fees,
        profitability_slippage: b.slippage,
        profitability_wins: b.backtest_wins,
        profitability_losses: b.backtest_losses,
        profitability_flats: b.backtest_flats,
        profitability_open: b.backtest_open,
        profitability_closed_count: closed,
        profitability_win_rate: closed === 0 ? null : b.backtest_wins / closed,
        profitability_win_loss_ratio: b.backtest_losses === 0 ? null : b.backtest_wins / b.backtest_losses,
        // COUNT buckets cannot yield a money-weighted profit factor — never faked
        profitability_profit_factor: null,
        profitability_evidence: (minValid && closed >= rawMin) ? 'SUFFICIENT' : 'INSUFFICIENT_EVIDENCE',
        simulated: true,
        advisory_only: true
      });
    }

    const reasons = ['wallet_profitability_computed'];
    if (!minValid) reasons.push('min_sample_size_missing_or_invalid');
    return build('PROFITABILITY_READ_MODEL', Object.freeze(byWallet), minValid, reasons);
  } catch {
    return build('PROFITABILITY_UNCONFIGURED', null, false, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (C) HEURISTIC RISK FLAGS (diagnostic only — never auto-ban/auto-config)
// ---------------------------------------------------------------------------

const PROFITABILITY_FLAGS_STATES = Object.freeze([
  'PROFITABILITY_FLAGS_UNCONFIGURED', 'PROFITABILITY_FLAGS_INVALID',
  'PROFITABILITY_FLAGS_READ_MODEL'
]);

const PROFIT_ENTRY_REQUIRED_NUMERIC = Object.freeze([
  'profitability_net', 'profitability_gross', 'profitability_fees',
  'profitability_slippage'
]);
const PROFIT_ENTRY_REQUIRED_COUNT = Object.freeze([
  'profitability_wins', 'profitability_losses', 'profitability_flats',
  'profitability_closed_count'
]);

function profitValidateEntry(e) {
  if (e == null || typeof e !== 'object' || Array.isArray(e)) {
    return ['profitability_entry_not_object'];
  }
  const screen = profitScreenComponent(e);
  if (screen.length > 0) return screen;
  const reasons = [];
  for (const f of PROFIT_ENTRY_REQUIRED_NUMERIC) {
    if (!isNum(e[f])) { reasons.push('invalid_entry_numeric_field'); break; }
  }
  for (const f of PROFIT_ENTRY_REQUIRED_COUNT) {
    if (!isCount(e[f])) { reasons.push('invalid_entry_count_field'); break; }
  }
  if (!PROFITABILITY_EVIDENCE_TOKENS.includes(e.profitability_evidence)) {
    reasons.push('invalid_entry_evidence_token');
  }
  return reasons;
}

export function describeProfitabilityRiskFlagsContract() {
  return Object.freeze({
    contract: 'profitability-risk-flags',
    version: '0.0.0',
    test_only: true,
    supported_states: PROFITABILITY_FLAGS_STATES,
    advisory_only: true,
    simulated: true,
    profitability_flags_state: 'PROFITABILITY_FLAGS_UNCONFIGURED',
    profitability_flags_by_wallet: EMPTY_FROZEN_OBJECT,
    profitability_thresholds_evaluated: false,
    status: 'PROFITABILITY_FLAGS_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...profitSafeFlags(),
    note: 'Simulated-only HEURISTIC RISK FLAGS read-model (pure, Stage-16 / Phase B). A PURE FUNCTION over { wallet_profitability: a REAL (B) result (recognized ONLY by read_only:true + profitability_state === PROFITABILITY_READ_MODEL), heuristic_thresholds: CALLER-SUPPLIED numbers — NEVER defaulted: { concentration_max_share?: finite number in 0..1, min_closed_for_flags?: finite number >= 0 } }. TOCTOU defense: the (B) result, its profitability_by_wallet map and EVERY entry are each snapshotted EXACTLY ONCE; the SAME snapshot is validated and consumed. Per wallet the LOCAL DIAGNOSTIC flags (true == risk SUSPECTED, advisory — they NEVER auto-ban, NEVER auto-close, NEVER auto-config): profitability_thin_evidence_flag (closed < min_closed_for_flags OR evidence INSUFFICIENT_EVIDENCE; forced true while unevaluated — missing thresholds can never CLEAR a wallet), profitability_loss_dominant_flag (losses > wins), profitability_single_position_concentration_flag (closed > 0 AND closed == 1 — a one-hit wallet; the buckets carry no per-position notional so the count-based one-hit form is used and concentration_max_share is validated but CANNOT loosen it), plus profitability_flags_unevaluated:true when heuristic_thresholds or min_closed_for_flags is missing (fail-safe: the posture is UNEVALUATED, not clean). A PRESENT-but-malformed threshold (wrong type / out of range) is refused PROFITABILITY_FLAGS_INVALID — explicit garbage is not silently ignored. Fail-Safe-Not-Fail-Open: missing/hostile input -> PROFITABILITY_FLAGS_UNCONFIGURED; raw/unrecognized/non-READ_MODEL (B) results or any smuggled forbidden flag/command/secret/endpoint -> PROFITABILITY_FLAGS_INVALID (values never echoed). Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateProfitabilityRiskFlags(input) {
  const build = (state, byWallet, evaluated, reasons) => Object.freeze({
    valid: (state !== 'PROFITABILITY_FLAGS_INVALID'),
    profitability_flags_state: state,
    simulated: true,
    profitability_flags_by_wallet: byWallet || EMPTY_FROZEN_OBJECT,
    profitability_thresholds_evaluated: evaluated === true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...profitSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (profitUninspectable(obj, ['purpose', 'wallet_profitability', 'heuristic_thresholds'])) {
      return build('PROFITABILITY_FLAGS_UNCONFIGURED', null, false, ['input_inspection_error']);
    }
    if (!obj) {
      return build('PROFITABILITY_FLAGS_UNCONFIGURED', null, false, ['no_risk_flags_input']);
    }

    // TOCTOU defense: snapshot the (B) result ONCE; recognition + map read
    // both come from the SAME snapshot.
    const wp = profitSnapshot(obj.wallet_profitability);
    if (wp == null) {
      return build('PROFITABILITY_FLAGS_UNCONFIGURED', null, false, ['wallet_profitability_missing']);
    }
    if (profitLooksLikeRawUpstream(wp)) {
      return build('PROFITABILITY_FLAGS_INVALID', null, false, ['raw_non_read_model_input_refused']);
    }
    const wpScreen = profitScreenComponent(wp);
    if (wpScreen.length > 0) return build('PROFITABILITY_FLAGS_INVALID', null, false, wpScreen);
    const wpState = profitReadState(wp, 'profitability_state', PROFITABILITY_STATES);
    if (wpState === null) {
      return build('PROFITABILITY_FLAGS_INVALID', null, false, ['unrecognized_wallet_profitability']);
    }
    if (wpState !== 'PROFITABILITY_READ_MODEL') {
      return build('PROFITABILITY_FLAGS_INVALID', null, false, ['wallet_profitability_not_read_model']);
    }
    const rawMap = wp.profitability_by_wallet;
    if (rawMap == null || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
      return build('PROFITABILITY_FLAGS_INVALID', null, false, ['profitability_wallet_map_missing']);
    }
    const mapSnapshot = { ...rawMap };

    // heuristic thresholds: caller-supplied, NEVER defaulted. Missing object
    // or missing min_closed_for_flags -> UNEVALUATED posture (flags cannot
    // clear a wallet). Present-but-malformed values are refused.
    const rawThresholds = obj.heuristic_thresholds;
    let thresholds = null;
    if (rawThresholds !== undefined && rawThresholds !== null) {
      if (typeof rawThresholds !== 'object' || Array.isArray(rawThresholds)) {
        return build('PROFITABILITY_FLAGS_INVALID', null, false, ['invalid_heuristic_thresholds']);
      }
      thresholds = { ...rawThresholds }; // snapshot ONCE
      const tScreen = profitScreenComponent(thresholds);
      if (tScreen.length > 0) return build('PROFITABILITY_FLAGS_INVALID', null, false, tScreen);
      const share = thresholds.concentration_max_share;
      if (share !== undefined && (!isNum(share) || share < 0 || share > 1)) {
        return build('PROFITABILITY_FLAGS_INVALID', null, false, ['invalid_concentration_max_share']);
      }
      const minClosed = thresholds.min_closed_for_flags;
      if (minClosed !== undefined && (!isNum(minClosed) || minClosed < 0)) {
        return build('PROFITABILITY_FLAGS_INVALID', null, false, ['invalid_min_closed_for_flags']);
      }
    }
    const evaluated = thresholds !== null && isNum(thresholds.min_closed_for_flags);

    const byWallet = {};
    for (const [ref, rawEntry] of Object.entries(mapSnapshot)) {
      const e = profitSnapshot(rawEntry);
      const entryReasons = profitValidateEntry(e);
      if (entryReasons.length > 0) {
        return build('PROFITABILITY_FLAGS_INVALID', null, evaluated, entryReasons);
      }
      const closed = e.profitability_closed_count;
      const insufficient = e.profitability_evidence !== 'SUFFICIENT';
      // fail-safe: while UNEVALUATED, thin-evidence cannot be cleared.
      const thin = evaluated
        ? (closed < thresholds.min_closed_for_flags || insufficient)
        : true;
      byWallet[ref] = Object.freeze({
        profitability_thin_evidence_flag: thin,
        profitability_loss_dominant_flag: e.profitability_losses > e.profitability_wins,
        profitability_single_position_concentration_flag: closed > 0 && closed === 1,
        profitability_flags_unevaluated: !evaluated,
        simulated: true,
        advisory_only: true
      });
    }

    const reasons = ['risk_flags_computed'];
    if (!evaluated) reasons.push('thresholds_missing_flags_unevaluated');
    return build('PROFITABILITY_FLAGS_READ_MODEL', Object.freeze(byWallet), evaluated, reasons);
  } catch {
    return build('PROFITABILITY_FLAGS_UNCONFIGURED', null, false, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (D) COPYABILITY ADVISORY COMPOSER (advisory-only; opens NOTHING)
// ---------------------------------------------------------------------------

const COPYABILITY_ADVISORY_STATES = Object.freeze([
  'COPYABILITY_ADVISORY_UNCONFIGURED', 'COPYABILITY_ADVISORY_INVALID',
  'COPYABILITY_ADVISORY_READ_MODEL'
]);

// LOCAL advisory tokens — explicitly NOT a command, NOT config, NOT
// auto-applied. KEEP_EVALUATING is NEVER a copy-allowed-style promotion.
const PROFITABILITY_ADVISORY_TOKENS = Object.freeze([
  'PROFITABILITY_ADVISORY_INSUFFICIENT_EVIDENCE',
  'PROFITABILITY_ADVISORY_NOT_COPY_SUITABLE',
  'PROFITABILITY_ADVISORY_PREFER_WATCH_ONLY',
  'PROFITABILITY_ADVISORY_KEEP_EVALUATING'
]);

export function describeCopyabilityAdvisoryContract() {
  return Object.freeze({
    contract: 'copyability-advisory-composer',
    version: '0.0.0',
    test_only: true,
    supported_states: COPYABILITY_ADVISORY_STATES,
    supported_advisory_tokens: PROFITABILITY_ADVISORY_TOKENS,
    advisory_only: true,
    simulated: true,
    copyability_advisory_state: 'COPYABILITY_ADVISORY_UNCONFIGURED',
    profitability_advisory_by_wallet: EMPTY_FROZEN_OBJECT,
    status: 'COPYABILITY_ADVISORY_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...profitSafeFlags(),
    note: 'Simulated-only COPYABILITY ADVISORY COMPOSER (pure, Stage-16 / Phase B). Aggregates { profitability_input_boundary: an (A) result in PROFITABILITY_INPUT_VALID, wallet_profitability: a (B) result in PROFITABILITY_READ_MODEL, profitability_risk_flags: a (C) result in PROFITABILITY_FLAGS_READ_MODEL }. TOCTOU defense: every consumed result, map and entry is snapshotted EXACTLY ONCE; the SAME snapshot is validated and consumed. Per wallet emits profitability_advisory in the LOCAL enum { PROFITABILITY_ADVISORY_INSUFFICIENT_EVIDENCE, PROFITABILITY_ADVISORY_NOT_COPY_SUITABLE, PROFITABILITY_ADVISORY_PREFER_WATCH_ONLY, PROFITABILITY_ADVISORY_KEEP_EVALUATING } with VETO-style fail-safe ordering: (1) flags unevaluated OR flags missing for the wallet OR evidence not SUFFICIENT OR thin-evidence flag -> INSUFFICIENT_EVIDENCE; (2) loss-dominant OR single-position-concentration flag -> NOT_COPY_SUITABLE (a suspected risk flag VETOES regardless of positive net — apparent profit is NOT copyable edge until the risk is cleared); (3) positive net + clear flags + sufficient evidence -> KEEP_EVALUATING (NEVER a copy-allowed-style promotion — promotion is a different governed system); (4) everything else -> PREFER_WATCH_ONLY. The advisory is EXPLICITLY advisory_only:true: it is NOT a command, NOT config, NOT auto-applied; it carries NO instruction-shaped field; it never closes positions, never changes follow state, never bans, never disables, opens NOTHING. Fail-Safe-Not-Fail-Open: missing/hostile input -> COPYABILITY_ADVISORY_UNCONFIGURED; unrecognized/raw/non-clean components or smuggled forbidden surfaces -> COPYABILITY_ADVISORY_INVALID (values never echoed). Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateCopyabilityAdvisory(input) {
  const build = (state, byWallet, reasons) => Object.freeze({
    valid: (state !== 'COPYABILITY_ADVISORY_INVALID'),
    copyability_advisory_state: state,
    simulated: true,
    advisory_only: true,
    profitability_advisory_by_wallet: byWallet || EMPTY_FROZEN_OBJECT,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    ...profitSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (profitUninspectable(obj, ['purpose', 'profitability_input_boundary', 'wallet_profitability', 'profitability_risk_flags'])) {
      return build('COPYABILITY_ADVISORY_UNCONFIGURED', null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('COPYABILITY_ADVISORY_UNCONFIGURED', null, ['no_copyability_advisory_input']);
    }

    // (A) boundary — must be VALID
    const boundary = profitSnapshot(obj.profitability_input_boundary);
    if (boundary == null) {
      return build('COPYABILITY_ADVISORY_UNCONFIGURED', null, ['profitability_input_boundary_missing']);
    }
    const bScreen = profitScreenComponent(boundary);
    if (bScreen.length > 0) return build('COPYABILITY_ADVISORY_INVALID', null, bScreen);
    const bState = profitReadState(boundary, 'profitability_input_state', PROFIT_INPUT_STATES);
    if (bState === null) {
      return build('COPYABILITY_ADVISORY_INVALID', null, ['unrecognized_profitability_input_boundary']);
    }
    if (bState !== 'PROFITABILITY_INPUT_VALID') {
      return build('COPYABILITY_ADVISORY_INVALID', null, ['profitability_input_not_valid']);
    }

    // (B) wallet profitability — must be READ_MODEL
    const wp = profitSnapshot(obj.wallet_profitability);
    if (wp == null) {
      return build('COPYABILITY_ADVISORY_UNCONFIGURED', null, ['wallet_profitability_missing']);
    }
    const wScreen = profitScreenComponent(wp);
    if (wScreen.length > 0) return build('COPYABILITY_ADVISORY_INVALID', null, wScreen);
    const wState = profitReadState(wp, 'profitability_state', PROFITABILITY_STATES);
    if (wState !== 'PROFITABILITY_READ_MODEL') {
      return build('COPYABILITY_ADVISORY_INVALID', null, ['wallet_profitability_not_read_model']);
    }
    const rawWpMap = wp.profitability_by_wallet;
    if (rawWpMap == null || typeof rawWpMap !== 'object' || Array.isArray(rawWpMap)) {
      return build('COPYABILITY_ADVISORY_INVALID', null, ['profitability_wallet_map_missing']);
    }
    const wpMap = { ...rawWpMap };

    // (C) risk flags — must be READ_MODEL
    const rf = profitSnapshot(obj.profitability_risk_flags);
    if (rf == null) {
      return build('COPYABILITY_ADVISORY_UNCONFIGURED', null, ['profitability_risk_flags_missing']);
    }
    const fScreen = profitScreenComponent(rf);
    if (fScreen.length > 0) return build('COPYABILITY_ADVISORY_INVALID', null, fScreen);
    const fState = profitReadState(rf, 'profitability_flags_state', PROFITABILITY_FLAGS_STATES);
    if (fState !== 'PROFITABILITY_FLAGS_READ_MODEL') {
      return build('COPYABILITY_ADVISORY_INVALID', null, ['risk_flags_not_read_model']);
    }
    const rawRfMap = rf.profitability_flags_by_wallet;
    if (rawRfMap == null || typeof rawRfMap !== 'object' || Array.isArray(rawRfMap)) {
      return build('COPYABILITY_ADVISORY_INVALID', null, ['flags_wallet_map_missing']);
    }
    const rfMap = { ...rawRfMap };

    const byWallet = {};
    for (const [ref, rawEntry] of Object.entries(wpMap)) {
      const e = profitSnapshot(rawEntry);
      const entryReasons = profitValidateEntry(e);
      if (entryReasons.length > 0) {
        return build('COPYABILITY_ADVISORY_INVALID', null, entryReasons);
      }
      const f = profitSnapshot(rfMap[ref]);
      const fEntryScreen = (f != null) ? profitScreenComponent(f) : [];
      if (fEntryScreen.length > 0) {
        return build('COPYABILITY_ADVISORY_INVALID', null, fEntryScreen);
      }

      let advisory;
      const why = [];
      const flagsMissing = (f == null || typeof f !== 'object');
      const unevaluated = flagsMissing || f.profitability_flags_unevaluated === true;
      const insufficient = e.profitability_evidence !== 'SUFFICIENT';
      const thin = !flagsMissing && f.profitability_thin_evidence_flag === true;
      if (unevaluated || insufficient || thin) {
        // VETO step 1: no confident verdict from unevaluated/thin data
        advisory = 'PROFITABILITY_ADVISORY_INSUFFICIENT_EVIDENCE';
        if (flagsMissing) why.push('flags_missing_for_wallet');
        if (unevaluated && !flagsMissing) why.push('flags_unevaluated');
        if (insufficient) why.push('evidence_below_min_sample');
        if (thin) why.push('thin_evidence_flag_set');
      } else if (f.profitability_loss_dominant_flag === true ||
                 f.profitability_single_position_concentration_flag === true) {
        // VETO step 2: a suspected risk flag vetoes regardless of net > 0
        advisory = 'PROFITABILITY_ADVISORY_NOT_COPY_SUITABLE';
        if (f.profitability_loss_dominant_flag === true) why.push('loss_dominant_veto');
        if (f.profitability_single_position_concentration_flag === true) {
          why.push('single_position_concentration_veto');
        }
      } else if (e.profitability_net > 0) {
        // NEVER a copy-allowed-style promotion — evaluation continues only
        advisory = 'PROFITABILITY_ADVISORY_KEEP_EVALUATING';
        why.push('positive_net_clear_flags_sufficient_evidence');
      } else {
        advisory = 'PROFITABILITY_ADVISORY_PREFER_WATCH_ONLY';
        why.push('non_positive_net');
      }
      byWallet[ref] = Object.freeze({
        profitability_advisory: advisory,
        profitability_advisory_reasons: Object.freeze(why),
        simulated: true,
        advisory_only: true
      });
    }

    return build('COPYABILITY_ADVISORY_READ_MODEL', Object.freeze(byWallet),
      ['copyability_advisory_composed']);
  } catch {
    return build('COPYABILITY_ADVISORY_UNCONFIGURED', null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (E) PROFITABILITY SUPPRESSION (always suppressed for execution/sign/send)
// ---------------------------------------------------------------------------

const PROFIT_SUPPRESSION_ALWAYS = Object.freeze([
  'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
]);

const PROFIT_SUPPRESSION_REASON_CODES = Object.freeze([
  'profitability_input_not_valid', 'wallet_profitability_invalid',
  'risk_flags_invalid', 'copyability_advisory_invalid', 'live_surface_detected',
  'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
]);

const PROFIT_SUPPRESSION_COMPONENTS = Object.freeze([
  'profitability_input_boundary', 'wallet_profitability',
  'profitability_risk_flags', 'copyability_advisory', 'profitability_surface'
]);

export function describeProfitabilitySuppressionContract() {
  return Object.freeze({
    contract: 'profitability-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: PROFIT_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: false,
    suppression_reasons: Object.freeze([]),
    status: 'PROFITABILITY_SUPPRESSION_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...profitSafeFlags(),
    note: 'Read-only PROFITABILITY SUPPRESSION (Stage-16 / Phase B). ALWAYS suppressed:true — profitability/intelligence read-models NEVER authorize execution, signing, or sending; not_execution_authorized + not_sign_authorized + not_send_authorized are carried on EVERY path (clean, blocked, hostile, missing). Component-specific reason codes (profitability_input_not_valid / wallet_profitability_invalid / risk_flags_invalid / copyability_advisory_invalid / live_surface_detected) are added when the corresponding component is not clean. Fail-Safe-Not-Fail-Open; hostile -> still suppressed, never throws; every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateProfitabilitySuppression(input) {
  const build = (codes) => {
    const all = [...new Set([...(codes || []), ...PROFIT_SUPPRESSION_ALWAYS])]
      .filter((c) => PROFIT_SUPPRESSION_REASON_CODES.includes(c));
    return Object.freeze({
      suppressed: true,
      suppression_reasons: Object.freeze(all),
      status: 'PROFITABILITY_SUPPRESSED',
      reasons: Object.freeze(all),
      read_only: true,
      advisory_only: true,
      ...profitSafeFlags()
    });
  };
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (profitUninspectable(obj, ['purpose', ...PROFIT_SUPPRESSION_COMPONENTS])) {
      return build([]);
    }
    if (!obj) return build([]);

    const codes = [];
    const boundary = obj.profitability_input_boundary;
    if (boundary != null) {
      const bs = profitReadState(boundary, 'profitability_input_state', PROFIT_INPUT_STATES);
      if (bs !== 'PROFITABILITY_INPUT_VALID') codes.push('profitability_input_not_valid');
    } else {
      codes.push('profitability_input_not_valid');
    }
    const wp = obj.wallet_profitability;
    if (wp != null) {
      const ws = profitReadState(wp, 'profitability_state', PROFITABILITY_STATES);
      if (ws === 'PROFITABILITY_INVALID' || ws === null) codes.push('wallet_profitability_invalid');
    }
    const rf = obj.profitability_risk_flags;
    if (rf != null) {
      const fs = profitReadState(rf, 'profitability_flags_state', PROFITABILITY_FLAGS_STATES);
      if (fs === 'PROFITABILITY_FLAGS_INVALID' || fs === null) codes.push('risk_flags_invalid');
    }
    const ad = obj.copyability_advisory;
    if (ad != null) {
      const as = profitReadState(ad, 'copyability_advisory_state', COPYABILITY_ADVISORY_STATES);
      if (as === 'COPYABILITY_ADVISORY_INVALID' || as === null) codes.push('copyability_advisory_invalid');
    }
    const surface = obj.profitability_surface;
    if (surface != null) {
      const ss = profitReadState(surface, 'profitability_surface_state', PROFIT_SURFACE_STATES);
      if (ss === 'PROFITABILITY_SURFACE_BLOCKED') codes.push('live_surface_detected');
    }
    return build(codes);
  } catch {
    return build([]);
  }
}

// ---------------------------------------------------------------------------
// (F) PROFITABILITY FORBIDDEN SURFACE GUARD
// ---------------------------------------------------------------------------

const PROFIT_SURFACE_STATES = Object.freeze([
  'PROFITABILITY_SURFACE_UNCONFIGURED', 'PROFITABILITY_SURFACE_CLEAN',
  'PROFITABILITY_SURFACE_BLOCKED'
]);

export function describeProfitabilityForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'profitability-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    supported_states: PROFIT_SURFACE_STATES,
    forbidden_field_names: PROFIT_SURFACE_FORBIDDEN_NAMES,
    advisory_only: true,
    profitability_surface_state: 'PROFITABILITY_SURFACE_UNCONFIGURED',
    live_surface_detected: false,
    key_material_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'PROFITABILITY_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...profitSafeFlags(),
    note: 'Read-only PROFITABILITY FORBIDDEN SURFACE GUARD (Stage-16 / Phase B). Scans ONLY top-level keys (deterministic, bounded, pure) for forbidden field NAMES — key material (private_key, secret_key, keypair, mnemonic, seed, signing_key, signature, signed_tx, signed_transaction) + live surfaces (endpoint, endpoint_url, rpc_url, provider_url, node_url, ws_url, serialized_tx, serialized_transaction, wire_transaction, raw_tx, raw_transaction, tx_bytes, message_bytes, broadcast_payload, send_payload). The detection booleans live_surface_detected / key_material_detected / forbidden_field_detected are DETECTION outputs (true == a forbidden surface was found == the SAFE BLOCKED state); they are NOT readiness/execution flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing/hostile input -> PROFITABILITY_SURFACE_UNCONFIGURED (frozen, never throws); clean -> PROFITABILITY_SURFACE_CLEAN (all detection booleans false); ANY forbidden name present -> PROFITABILITY_SURFACE_BLOCKED (key_material_detected:true for a key/seed/signature name, false for a live-endpoint-only name; forbidden_field_ref = the matched NAME). Opens NOTHING — every readiness/execution flag STAYS false.'
  });
}

export function evaluateProfitabilityForbiddenSurface(input) {
  const build = (state, kind, ref, reasons) => Object.freeze({
    profitability_surface_state: state,
    live_surface_detected: (state === 'PROFITABILITY_SURFACE_BLOCKED'),
    key_material_detected: (state === 'PROFITABILITY_SURFACE_BLOCKED') ? (kind === 'key') : false,
    forbidden_field_detected: (state === 'PROFITABILITY_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'PROFITABILITY_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...profitSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (profitUninspectable(obj, [...PROFIT_SURFACE_FORBIDDEN_NAMES])) {
      return build('PROFITABILITY_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('PROFITABILITY_SURFACE_UNCONFIGURED', null, null, ['no_profitability_surface_input']);
    }
    let keys;
    try {
      keys = Object.keys(obj);
    } catch {
      return build('PROFITABILITY_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    for (const k of keys) {
      if (PROFIT_SURFACE_FORBIDDEN_NAMES.includes(k)) {
        const kind = PROFIT_SURFACE_KEY_MATERIAL_NAMES.includes(k) ? 'key' : 'live';
        // forbidden_field_ref = the matched NAME only (REDACTED); NEVER the VALUE
        return build('PROFITABILITY_SURFACE_BLOCKED', kind, k,
          [kind === 'key' ? 'key_material_detected' : 'live_endpoint_detected']);
      }
    }
    return build('PROFITABILITY_SURFACE_CLEAN', null, null, ['profitability_surface_clean']);
  } catch {
    return build('PROFITABILITY_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (G) PROFITABILITY HEALTH
// ---------------------------------------------------------------------------

const PROFIT_HEALTH_STATES = Object.freeze([
  'PROFITABILITY_HEALTH_UNCONFIGURED', 'PROFITABILITY_HEALTH_DEGRADED',
  'PROFITABILITY_HEALTH_REVIEWED_ADVISORY', 'PROFITABILITY_HEALTH_SUPPRESSED',
  'PROFITABILITY_HEALTH_BLOCKED'
]);

const PROFIT_HEALTH_COMPONENTS = Object.freeze([
  'profitability_input_boundary', 'wallet_profitability',
  'profitability_risk_flags', 'copyability_advisory',
  'profitability_suppression', 'profitability_surface'
]);

export function describeProfitabilityHealthContract() {
  return Object.freeze({
    contract: 'profitability-health',
    version: '0.0.0',
    test_only: true,
    supported_states: PROFIT_HEALTH_STATES,
    advisory_only: true,
    profitability_health_state: 'PROFITABILITY_HEALTH_UNCONFIGURED',
    status: 'PROFITABILITY_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...profitSafeFlags(),
    note: 'Read-only PROFITABILITY HEALTH (Stage-16 / Phase B). Aggregates the profitability input boundary (A) + wallet profitability read-model (B) + heuristic risk flags (C) + copyability advisory composer (D) + suppression (E) + forbidden surface (F). Ordering (Fail-Safe-Not-Fail-Open): smuggled forbidden flag/command/secret/endpoint on any component -> PROFITABILITY_HEALTH_BLOCKED; surface PROFITABILITY_SURFACE_BLOCKED OR boundary PROFITABILITY_INPUT_INVALID OR wallet profitability PROFITABILITY_INVALID OR risk flags PROFITABILITY_FLAGS_INVALID OR advisory COPYABILITY_ADVISORY_INVALID -> PROFITABILITY_HEALTH_BLOCKED; any required component missing/unrecognized -> PROFITABILITY_HEALTH_UNCONFIGURED; suppression suppressed:true (the standard clean path — profitability intelligence is ALWAYS suppressed for execution/sign/send) -> PROFITABILITY_HEALTH_SUPPRESSED; an explicit not-suppressed object with everything clean -> PROFITABILITY_HEALTH_REVIEWED_ADVISORY (which STILL opens nothing); anything else -> PROFITABILITY_HEALTH_DEGRADED. Every state keeps all 24 readiness/execution flags false.'
  });
}

export function evaluateProfitabilityHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'PROFITABILITY_HEALTH_BLOCKED'),
    profitability_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...profitSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (profitUninspectable(obj, [...PROFIT_HEALTH_COMPONENTS])) {
      return build('PROFITABILITY_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('PROFITABILITY_HEALTH_UNCONFIGURED', ['no_profitability_health_input']);
    }

    // component smuggle screen -> BLOCKED
    for (const k of PROFIT_HEALTH_COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      if (profitScreenComponent(c).length > 0) {
        return build('PROFITABILITY_HEALTH_BLOCKED', ['forbidden_input_blocked']);
      }
    }

    const boundary = obj.profitability_input_boundary;
    const wp = obj.wallet_profitability;
    const rf = obj.profitability_risk_flags;
    const ad = obj.copyability_advisory;
    const suppression = obj.profitability_suppression;
    const surface = obj.profitability_surface;

    const boundaryState = profitReadState(boundary, 'profitability_input_state', PROFIT_INPUT_STATES);
    const wpState = profitReadState(wp, 'profitability_state', PROFITABILITY_STATES);
    const rfState = profitReadState(rf, 'profitability_flags_state', PROFITABILITY_FLAGS_STATES);
    const adState = profitReadState(ad, 'copyability_advisory_state', COPYABILITY_ADVISORY_STATES);
    const surfaceState = profitReadState(surface, 'profitability_surface_state', PROFIT_SURFACE_STATES);
    const suppressionVal = (suppression != null && typeof suppression === 'object' &&
      !Array.isArray(suppression) && suppression.read_only === true &&
      typeof suppression.suppressed === 'boolean' && Array.isArray(suppression.suppression_reasons))
      ? suppression.suppressed : null;

    // hard blocks first
    if (surfaceState === 'PROFITABILITY_SURFACE_BLOCKED' ||
        boundaryState === 'PROFITABILITY_INPUT_INVALID' ||
        wpState === 'PROFITABILITY_INVALID' ||
        rfState === 'PROFITABILITY_FLAGS_INVALID' ||
        adState === 'COPYABILITY_ADVISORY_INVALID') {
      return build('PROFITABILITY_HEALTH_BLOCKED', ['profitability_health_blocked']);
    }

    // missing required components -> UNCONFIGURED
    if (boundary == null || wp == null || rf == null || ad == null ||
        suppression == null || surface == null ||
        boundaryState === null || wpState === null || rfState === null ||
        adState === null || surfaceState === null || suppressionVal === null) {
      return build('PROFITABILITY_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // suppression active (the standard clean path) -> SUPPRESSED
    if (suppressionVal === true) {
      return build('PROFITABILITY_HEALTH_SUPPRESSED', ['profitability_suppressed']);
    }

    // explicit not-suppressed + everything clean -> REVIEWED_ADVISORY
    if (boundaryState === 'PROFITABILITY_INPUT_VALID' &&
        wpState === 'PROFITABILITY_READ_MODEL' &&
        rfState === 'PROFITABILITY_FLAGS_READ_MODEL' &&
        adState === 'COPYABILITY_ADVISORY_READ_MODEL' &&
        surfaceState === 'PROFITABILITY_SURFACE_CLEAN') {
      return build('PROFITABILITY_HEALTH_REVIEWED_ADVISORY', ['profitability_reviewed_advisory']);
    }

    return build('PROFITABILITY_HEALTH_DEGRADED', ['profitability_health_degraded']);
  } catch {
    return build('PROFITABILITY_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
