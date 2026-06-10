// @soltrade/signing-review-foundations
//
// Read-only / advisory ONLY SIGNING-REVIEW FOUNDATION for Stage-11 of the
// architecture pipeline `data -> signal -> risk -> intent -> route -> sign ->
// send`. This package builds ONLY the read-only/advisory 'signing-review'
// foundation, consuming Stage-10 transaction-build-review outputs. Import-free,
// pure, deterministic. No network primitive, no live stream, no live quote, no
// aggregator/Jupiter/RPC route call, NO real signing, NO SignerService
// activation, NO private key / seed / mnemonic / keypair material of any kind,
// NO crypto signing call, NO transaction build, NO serialization, NO message
// bytes, NO send, no system clock, no persistence, no secrets, no mutable
// module/global state.
//
// THE CORE RULE: a signing-review / descriptor is a READ-ONLY ADVISORY
// REPRESENTATION ONLY — it REVIEWS signing PREREQUISITES from safe metadata; it
// is NOT signing, NOT a signature, NOT a private key, NOT key material, NOT a
// signing permission, NOT a send permission, NOT signing/trading readiness.
// signer_ready / signing_permitted / transaction_ready / serialized_ready /
// message_bytes_ready / can_send / can_serialize (and every other
// readiness/execution/signing flag) ALL STAY false on every result — a
// signing-review NEVER flips any readiness/execution/signing flag. "Input valid
// / signer-boundary valid / descriptor exists" is carried ONLY by dedicated
// fields (signing_review_input_boundary_valid / eligible_for_signing_review /
// signer_custody_boundary_valid / candidate_signing_review_valid /
// candidate_signing_review_state), never by a readiness flag. Hostile, throwing,
// or uninspectable input returns a FROZEN refusal with reason
// 'input_inspection_error' and NEVER throws. Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package adds NO name to docs/01-SSOT.md. The bucket
// VALUES that overlap SSOT Group 15 vocabulary (key_custody_mode =
// connected_wallet|isolated_signer; signer_profile_status =
// active|disabled|revoked|degraded) are CONSUMED as advisory input bucket values
// ONLY — never actual key handling. The source tags isolated_signer_disabled /
// connected_wallet_disabled are LOCAL disabled markers (NOT SignerService calls);
// they NEVER load a key, sign, or activate a signer. Field names like
// private_key / secret_key / keypair / mnemonic / seed / signature /
// signed_tx / transaction / serialized_tx / message_bytes appear ONLY as fixed
// string literals inside refusal / forbidden-field allowlist arrays and prose —
// never as real objects, calls, or emitted output keys.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function signSafeFlags() {
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

// the 24 non-read_only flags above (includes signer_ready / signing_permitted) —
// none may EVER be true on input or output; a signing-review NEVER flips any.
const SIGN_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
]);

const SIGN_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute'
]);

const SIGN_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential|signing_key|signer_secret/i;
const SIGN_URL_RE = /https?:\/\/|wss?:\/\//i;
const SIGN_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan (their values are
// still scanned for URL/secret/mainnet substrings). NOTE: a 'token'/'private'/
// 'seed' SECRET key NOT in this list is still flagged by name.
const SIGN_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'tx_build_review_ref', 'preview_ref', 'route_plan_ref',
  'intent_record_ref', 'signing_review_ref', 'signer_source', 'signer_profile_ref',
  'key_custody_mode_bucket', 'signer_profile_status_bucket', 'dual_control_bucket',
  'signer_reachability_bucket'
]);

function signHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of SIGN_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function signHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (SIGN_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function signHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (SIGN_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (SIGN_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function signHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (SIGN_URL_RE.test(v) || SIGN_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function signScreen(o) {
  const r = [];
  if (signHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (signHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (signHasSecretField(o)) r.push('secret_field_blocked');
  if (signHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function signUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Stage-10 tx-build-review-output recognizers. Signing-review input comes ONLY
// from Stage-10 tx-build-review outputs, each of which carries read_only:true.
// Raw Stage-9 route / Stage-8 intent / Stage-7 risk / Stage-6 signal / Stage-5
// intelligence / Stage-4 ingestion objects are REFUSED.
// ---------------------------------------------------------------------------

const SIGN_TX_BUILD_INPUT_STATES = Object.freeze([
  'TX_BUILD_INPUT_UNCONFIGURED', 'TX_BUILD_INPUT_INVALID',
  'TX_BUILD_INPUT_DEGRADED', 'TX_BUILD_INPUT_VALID'
]);
const SIGN_TX_BUILD_SOURCE_STATES = Object.freeze([
  'TX_BUILD_SOURCE_UNCONFIGURED', 'TX_BUILD_SOURCE_INVALID',
  'TX_BUILD_SOURCE_READ_ONLY_OK'
]);
const SIGN_CANDIDATE_TX_BUILD_STATES = Object.freeze([
  'CANDIDATE_TX_BUILD_UNCONFIGURED', 'CANDIDATE_TX_BUILD_INVALID',
  'CANDIDATE_TX_BUILD_REJECTED', 'CANDIDATE_TX_BUILD_DEGRADED',
  'CANDIDATE_TX_BUILD_DESCRIPTOR'
]);
const SIGN_TX_BUILD_RESOURCE_STATES = Object.freeze([
  'TX_BUILD_RESOURCE_UNCONFIGURED', 'TX_BUILD_RESOURCE_INVALID',
  'TX_BUILD_RESOURCE_DEGRADED', 'TX_BUILD_RESOURCE_REJECTED',
  'TX_BUILD_RESOURCE_ACCEPTABLE_ADVISORY'
]);
const SIGN_SERIALIZATION_SURFACE_STATES = Object.freeze([
  'SERIALIZATION_SURFACE_UNCONFIGURED', 'SERIALIZATION_SURFACE_CLEAN',
  'SERIALIZATION_SURFACE_BLOCKED'
]);
const SIGN_TX_BUILD_REVIEW_STATES = Object.freeze([
  'TX_BUILD_REVIEW_UNCONFIGURED', 'TX_BUILD_REVIEW_DEGRADED',
  'TX_BUILD_REVIEW_BLOCKED', 'TX_BUILD_REVIEW_PASS_ADVISORY'
]);
const SIGN_TX_BUILD_HEALTH_STATES = Object.freeze([
  'TX_BUILD_HEALTH_UNCONFIGURED', 'TX_BUILD_HEALTH_DEGRADED',
  'TX_BUILD_HEALTH_REVIEWED_ADVISORY', 'TX_BUILD_HEALTH_SUPPRESSED',
  'TX_BUILD_HEALTH_BLOCKED'
]);

// Stage-9 route state fields — an object carrying one of these (and no tx-build
// state) is a raw route output, NOT a Stage-10 tx-build output -> refuse.
const SIGN_ROUTE_STATE_FIELDS = Object.freeze([
  'route_input_state', 'route_source_state', 'candidate_route_state',
  'route_feasibility_state', 'execution_plan_preview_state', 'route_health_state'
]);

// Stage-8 intent state fields — raw intent -> refuse.
const SIGN_INTENT_STATE_FIELDS = Object.freeze([
  'intent_input_state', 'candidate_intent_state', 'ledger_state',
  'intent_state', 'audit_state', 'intent_health_state'
]);

// Stage-7 risk state fields — raw risk -> refuse.
const SIGN_RISK_STATE_FIELDS = Object.freeze([
  'risk_input_state', 'hard_risk_state', 'liquidity_exit_state',
  'exposure_risk_state', 'risk_verdict_state', 'risk_health_state'
]);

// Stage-6 signal state fields — raw signal -> refuse.
const SIGN_SIGNAL_STATE_FIELDS = Object.freeze([
  'signal_input_state', 'candidate_signal_state', 'signal_score_state',
  'signal_suppression_state', 'signal_state'
]);

// Stage-5 intelligence state fields — raw intelligence -> refuse.
const SIGN_INTELLIGENCE_STATE_FIELDS = Object.freeze([
  'wallet_observation_state', 'token_observation_state', 'relationship_state',
  'diagnostics_state', 'intelligence_state'
]);

// Stage-4 raw ingestion event types — raw events -> refuse.
const SIGN_RAW_INGESTION_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed', 'token_account_change_observed',
  'swap_observed', 'mint_observed', 'pool_observed', 'balance_change_observed'
]);

// Does an object carry ANY recognized Stage-10 tx-build-layer state field?
function signTxBuildComponentState(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (typeof o.tx_build_input_state === 'string' && SIGN_TX_BUILD_INPUT_STATES.includes(o.tx_build_input_state)) return o.tx_build_input_state;
  if (typeof o.tx_build_source_state === 'string' && SIGN_TX_BUILD_SOURCE_STATES.includes(o.tx_build_source_state)) return o.tx_build_source_state;
  if (typeof o.candidate_tx_build_state === 'string' && SIGN_CANDIDATE_TX_BUILD_STATES.includes(o.candidate_tx_build_state)) return o.candidate_tx_build_state;
  if (typeof o.tx_build_resource_state === 'string' && SIGN_TX_BUILD_RESOURCE_STATES.includes(o.tx_build_resource_state)) return o.tx_build_resource_state;
  if (typeof o.serialization_surface_state === 'string' && SIGN_SERIALIZATION_SURFACE_STATES.includes(o.serialization_surface_state)) return o.serialization_surface_state;
  if (typeof o.tx_build_review_state === 'string' && SIGN_TX_BUILD_REVIEW_STATES.includes(o.tx_build_review_state)) return o.tx_build_review_state;
  if (typeof o.tx_build_health_state === 'string' && SIGN_TX_BUILD_HEALTH_STATES.includes(o.tx_build_health_state)) return o.tx_build_health_state;
  // tx-build suppression carries suppressed + suppression_reasons (no *_state enum)
  if (typeof o.suppressed === 'boolean' && Array.isArray(o.suppression_reasons)) return 'TX_BUILD_SUPPRESSION_RESULT';
  return null;
}

function signHasTxBuildLayerState(o) {
  return signTxBuildComponentState(o) !== null;
}

function signHasAnyStateField(o, fields) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (signHasTxBuildLayerState(o)) return false;
  for (const f of fields) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object a raw Stage-9 route output (route state, NO tx-build state)?
function signIsRawRoute(o) {
  return signHasAnyStateField(o, SIGN_ROUTE_STATE_FIELDS);
}

// Is the object a raw Stage-8 intent output (intent state, NO tx-build state)?
function signIsRawIntent(o) {
  return signHasAnyStateField(o, SIGN_INTENT_STATE_FIELDS);
}

// Is the object a raw Stage-7 risk output (risk state, NO tx-build state)?
function signIsRawRisk(o) {
  return signHasAnyStateField(o, SIGN_RISK_STATE_FIELDS);
}

// Is the object a raw Stage-6 signal output (signal state, NO tx-build state)?
function signIsRawSignal(o) {
  return signHasAnyStateField(o, SIGN_SIGNAL_STATE_FIELDS);
}

// Is the object raw Stage-5 intelligence (intelligence state, NO tx-build state)?
function signIsRawIntelligence(o) {
  return signHasAnyStateField(o, SIGN_INTELLIGENCE_STATE_FIELDS);
}

// Is the object a raw Stage-4 ingestion event (event_type, NO tx-build state)?
function signIsRawIngestionEvent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (signHasTxBuildLayerState(o)) return false;
  const et = o.event_type;
  return typeof et === 'string' && SIGN_RAW_INGESTION_EVENT_TYPES.includes(et);
}

function signIsRawNonTxBuildInput(o) {
  return signIsRawRoute(o) || signIsRawIntent(o) || signIsRawRisk(o) ||
    signIsRawSignal(o) || signIsRawIntelligence(o) || signIsRawIngestionEvent(o);
}

// Recognize a Stage-10 tx-build RESULT component: an inspectable read-only object
// that carries a valid tx-build-layer state and is NOT a raw earlier-stage/event
// object. Returns the recognized tx-build-layer state string, or null.
function signRecognizeTxBuildComponent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (signIsRawNonTxBuildInput(o)) return null;
  if (o.read_only !== true) return null;
  return signTxBuildComponentState(o);
}

// Screen a Stage-10 RESULT object passed in a component slot: forbidden trading
// flag, execution-command KEY, raw earlier-stage/event input, endpoint/mainnet by
// string VALUE. The secret-NAME scan is NOT run here because legitimate tx-build
// state fields may contain the substring 'token'; results spread only fixed
// literals / allowlisted tokens, so a bare secret value is never echoed.
function signScreenComponentResult(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (signHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (signHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (signHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (signIsRawNonTxBuildInput(c)) r.push('raw_non_tx_build_input_refused');
  return r;
}

// Recognize a Stage-10 review-verdict result fed forward.
function signRecognizeReviewVerdictResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.tx_build_review_state === 'string' && SIGN_TX_BUILD_REVIEW_STATES.includes(o.tx_build_review_state)) {
    return o.tx_build_review_state;
  }
  return null;
}

// Recognize a Stage-10 tx-build-health result fed forward.
function signRecognizeTxBuildHealthResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.tx_build_health_state === 'string' && SIGN_TX_BUILD_HEALTH_STATES.includes(o.tx_build_health_state)) {
    return o.tx_build_health_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (C) SIGNING-REVIEW INPUT BOUNDARY
//
// Verifies that signing-review input comes ONLY from Stage-10 tx-build-review
// outputs, never from raw route / earlier-stage / commands. A VALID boundary
// opens NO signing/serialization/send/trading readiness;
// eligible_for_signing_review marks the input shape only, and is NOT signing, a
// signature, a signing or send permission. The tx-build review must be REVIEWED
// (tx_build_review_verdict TX_BUILD_REVIEW_PASS_ADVISORY + tx_build_health
// TX_BUILD_HEALTH_REVIEWED_ADVISORY + not suppressed) to be eligible; anything
// else -> DEGRADED / UNCONFIGURED / INVALID.
// ---------------------------------------------------------------------------

const SIGNING_REVIEW_INPUT_STATES = Object.freeze([
  'SIGNING_REVIEW_INPUT_UNCONFIGURED', 'SIGNING_REVIEW_INPUT_INVALID',
  'SIGNING_REVIEW_INPUT_DEGRADED', 'SIGNING_REVIEW_INPUT_VALID'
]);

const SIGNING_REVIEW_INPUT_COMPONENTS = Object.freeze([
  'tx_build_input_boundary', 'tx_build_source_boundary',
  'candidate_tx_build_descriptor', 'tx_build_resource_advisory',
  'serialization_surface', 'tx_build_review_verdict', 'tx_build_suppression',
  'tx_build_health'
]);

export function describeSigningReviewInputBoundaryContract() {
  return Object.freeze({
    contract: 'signing-review-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNING_REVIEW_INPUT_STATES,
    advisory_only: true,
    signing_review_input_state: 'SIGNING_REVIEW_INPUT_UNCONFIGURED',
    signing_review_input_boundary_valid: false,
    eligible_for_signing_review: false,
    status: 'SIGNING_REVIEW_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...signSafeFlags(),
    note: 'Read-only signing-review INPUT boundary. Verifies signing-review input comes ONLY from Stage-10 transaction-build-review outputs (tx-build input boundary, tx-build source boundary, candidate tx-build descriptor, tx-build resource advisory, serialization surface, tx-build review verdict, tx-build suppression, tx-build health), never from raw Stage-9 route, Stage-8 intent, Stage-7 risk, Stage-6 signals, Stage-5 intelligence, Stage-4 ingestion events, endpoints, or execution commands. A VALID boundary opens NO signing/serialization/send/trading readiness; eligible_for_signing_review marks the input shape only, and is NOT signing, a signature, a private key, a signing or send permission. The tx-build review must be REVIEWED (tx_build_review_verdict TX_BUILD_REVIEW_PASS_ADVISORY + tx_build_health TX_BUILD_HEALTH_REVIEWED_ADVISORY + not suppressed) to be eligible; suppressed or review not reviewed -> SIGNING_REVIEW_INPUT_DEGRADED (NOT eligible, fail-closed); tx_build_health TX_BUILD_HEALTH_BLOCKED or any component *_INVALID or serialization_surface SERIALIZATION_SURFACE_BLOCKED -> SIGNING_REVIEW_INPUT_INVALID. Raw route/earlier/event objects, smuggled trading/transaction/serialize/sign/send/live-quote flags or commands, secrets, private-key/seed/keypair/mnemonic material, endpoints, and mainnet/REAL-LIVE markers are refused (raw_non_tx_build_input_refused / *_blocked) and never echoed. signer_ready / signing_permitted / transaction_ready / serialized_ready / message_bytes_ready / can_send / can_serialize STAY false in EVERY state.'
  });
}

export function validateSigningReviewInputBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (signUninspectable(obj, ['purpose', ...SIGNING_REVIEW_INPUT_COMPONENTS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...signSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_signing_review_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!SIGNING_REVIEW_INPUT_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...signScreen(shallow));
      for (const k of SIGNING_REVIEW_INPUT_COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (signHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (signHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (signIsRawNonTxBuildInput(c)) reasons.push('raw_non_tx_build_input_refused');
      }
      if (obj.purpose !== 'signing_review_input_boundary') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...signSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...signSafeFlags()
    });
  }
}

export function evaluateSigningReviewInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'SIGNING_REVIEW_INPUT_INVALID'),
    signing_review_input_boundary_valid: (state === 'SIGNING_REVIEW_INPUT_VALID'),
    eligible_for_signing_review: (state === 'SIGNING_REVIEW_INPUT_VALID'),
    signing_review_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...signSafeFlags()
  });
  try {
    const v = validateSigningReviewInputBoundary(input);
    // unrecognized / hostile -> UNCONFIGURED
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('SIGNING_REVIEW_INPUT_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_signing_review_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / raw input / bad purpose -> INVALID
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_non_tx_build_input_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('SIGNING_REVIEW_INPUT_INVALID', v.reasons);
    }

    const slots = [
      ['tx_build_input_boundary', input.tx_build_input_boundary],
      ['tx_build_source_boundary', input.tx_build_source_boundary],
      ['candidate_tx_build_descriptor', input.candidate_tx_build_descriptor],
      ['tx_build_resource_advisory', input.tx_build_resource_advisory],
      ['serialization_surface', input.serialization_surface],
      ['tx_build_review_verdict', input.tx_build_review_verdict],
      ['tx_build_suppression', input.tx_build_suppression],
      ['tx_build_health', input.tx_build_health]
    ];

    // each PRESENT component must be a recognized read-only Stage-10 tx-build
    // result; an unrecognized component (or one blocked by the component screen)
    // is not a Stage-10 tx-build output -> refuse.
    let anyComponentInvalid = false;
    for (const [, c] of slots) {
      if (c == null) continue;
      if (signScreenComponentResult(c).length > 0) {
        return build('SIGNING_REVIEW_INPUT_INVALID', ['raw_non_tx_build_input_refused']);
      }
      const s = signRecognizeTxBuildComponent(c);
      if (s === null) {
        return build('SIGNING_REVIEW_INPUT_INVALID', ['component_not_stage10_tx_build']);
      }
      if (s === 'TX_BUILD_INPUT_INVALID' || s === 'TX_BUILD_SOURCE_INVALID' ||
          s === 'CANDIDATE_TX_BUILD_INVALID' || s === 'TX_BUILD_RESOURCE_INVALID' ||
          s === 'TX_BUILD_REVIEW_BLOCKED' || s === 'TX_BUILD_HEALTH_BLOCKED') {
        anyComponentInvalid = true;
      }
    }

    const verdict = input.tx_build_review_verdict;
    const health = input.tx_build_health;
    const serialization = input.serialization_surface;
    const suppression = input.tx_build_suppression;

    const verdictState = (verdict != null) ? signRecognizeTxBuildComponent(verdict) : null;
    const healthState = (health != null) ? signRecognizeTxBuildComponent(health) : null;
    const serializationState = (serialization != null) ? signRecognizeTxBuildComponent(serialization) : null;

    // tx_build_health BLOCKED OR any component *_INVALID OR serialization BLOCKED -> INVALID
    if (healthState === 'TX_BUILD_HEALTH_BLOCKED' || anyComponentInvalid ||
        serializationState === 'SERIALIZATION_SURFACE_BLOCKED') {
      return build('SIGNING_REVIEW_INPUT_INVALID', ['tx_build_component_invalid']);
    }

    // required minimum components: tx_build_review_verdict + tx_build_health
    if (verdictState === null || healthState === null) {
      return build('SIGNING_REVIEW_INPUT_UNCONFIGURED', ['required_component_missing']);
    }

    const suppressed = (suppression != null && typeof suppression === 'object' && !Array.isArray(suppression))
      ? suppression.suppressed === true : false;

    // tx-build suppressed OR review not pass-advisory OR health not reviewed-advisory
    // -> DEGRADED (not eligible, fail-closed)
    if (suppressed === true ||
        verdictState !== 'TX_BUILD_REVIEW_PASS_ADVISORY' ||
        healthState !== 'TX_BUILD_HEALTH_REVIEWED_ADVISORY') {
      const degraded = [];
      if (suppressed === true) degraded.push('tx_build_suppressed');
      if (verdictState !== 'TX_BUILD_REVIEW_PASS_ADVISORY') degraded.push('tx_build_review_not_pass_advisory');
      if (healthState !== 'TX_BUILD_HEALTH_REVIEWED_ADVISORY') degraded.push('tx_build_health_not_reviewed_advisory');
      return build('SIGNING_REVIEW_INPUT_DEGRADED', degraded.length ? degraded : ['tx_build_review_not_pass_advisory']);
    }

    // verdict pass-advisory + health reviewed-advisory + not suppressed + all present
    // components recognized read-only -> VALID (eligible)
    return build('SIGNING_REVIEW_INPUT_VALID', []);
  } catch {
    return build('SIGNING_REVIEW_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-11 (C) signing-review-input-boundary result fed forward.
function signRecognizeInputBoundaryResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.signing_review_input_state === 'string' && SIGNING_REVIEW_INPUT_STATES.includes(o.signing_review_input_state)) {
    return o.signing_review_input_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (D) SIGNER PROFILE / CUSTODY BOUNDARY
//
// The signer / custody source is a DISABLED / read-only descriptor TAG only — no
// SignerService, no key load, no signing, no network. isolated_signer_disabled /
// connected_wallet_disabled are accepted ONLY as disabled/read-only markers;
// they NEVER load a key, sign, or activate a signer. Endpoint URL / api_key /
// secret / token / private_key / seed / keypair / mnemonic / smuggled
// sign/load/send flag / mainnet/REAL-LIVE -> INVALID and never echoed.
// ---------------------------------------------------------------------------

const SIGNER_CUSTODY_STATES = Object.freeze([
  'SIGNER_CUSTODY_UNCONFIGURED', 'SIGNER_CUSTODY_INVALID',
  'SIGNER_CUSTODY_READ_ONLY_OK'
]);

const SIGNER_CUSTODY_ALLOWED_SOURCES = Object.freeze([
  'mock_signer_metadata', 'fixture_signer_metadata', 'isolated_signer_disabled',
  'connected_wallet_disabled', 'manual_signing_review_disabled'
]);

const SIGNER_CUSTODY_TOP_KEYS = Object.freeze(['purpose', 'signer_source']);

export function describeSignerCustodyBoundaryContract() {
  return Object.freeze({
    contract: 'signer-custody-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNER_CUSTODY_STATES,
    supported_sources: SIGNER_CUSTODY_ALLOWED_SOURCES,
    advisory_only: true,
    signer_custody_boundary_valid: false,
    signer_custody_state: 'SIGNER_CUSTODY_UNCONFIGURED',
    signer_disabled: true,
    signing_performed: false,
    key_loaded: false,
    key_material_present: false,
    network_call_made: false,
    endpoint_resolved: false,
    status: 'SIGNER_CUSTODY_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...signSafeFlags(),
    note: 'Read-only signer-profile / CUSTODY boundary. The signer/custody source is a DISABLED / read-only descriptor TAG only (mock_signer_metadata, fixture_signer_metadata, isolated_signer_disabled, connected_wallet_disabled, manual_signing_review_disabled) — NO endpoint, NO SignerService, NO key load, NO signing, NO live call. isolated_signer_disabled / connected_wallet_disabled are accepted ONLY as disabled/read-only markers; they NEVER load a key, sign, or activate a signer — signer_disabled STAYS true, signing_performed / key_loaded / key_material_present / network_call_made / endpoint_resolved STAY false. key_custody_mode is reviewed as an ADVISORY METADATA BUCKET only, never actual key handling. Fail-Safe-Not-Fail-Open: missing source -> SIGNER_CUSTODY_UNCONFIGURED; unknown source tag -> SIGNER_CUSTODY_INVALID; an endpoint URL field / api_key / secret / token / private_key / seed / keypair / mnemonic / smuggled sign/load/send flag / mainnet / REAL-LIVE -> SIGNER_CUSTODY_INVALID and NEVER echoed; a valid disabled/read-only tag -> SIGNER_CUSTODY_READ_ONLY_OK. Opens NO signing/serialization/send/trading readiness.'
  });
}

export function validateSignerCustodyBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (signUninspectable(obj, [...SIGNER_CUSTODY_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...signSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_signer_custody_input');
    } else {
      recognized = true;
      reasons.push(...signScreen(obj));
      if (obj.purpose !== 'signer_custody_boundary') reasons.push('purpose_invalid');
      const src = obj.signer_source;
      if (src == null) {
        reasons.push('signer_source_missing');
      } else if (typeof src !== 'string' || !SIGNER_CUSTODY_ALLOWED_SOURCES.includes(src)) {
        reasons.push('signer_source_unknown');
      }
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...signSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...signSafeFlags()
    });
  }
}

export function evaluateSignerCustodyBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'SIGNER_CUSTODY_INVALID'),
    signer_custody_boundary_valid: (state === 'SIGNER_CUSTODY_READ_ONLY_OK'),
    signer_custody_state: state,
    signer_disabled: true,
    signing_performed: false,
    key_loaded: false,
    key_material_present: false,
    network_call_made: false,
    endpoint_resolved: false,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...signSafeFlags()
  });
  try {
    const v = validateSignerCustodyBoundary(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('SIGNER_CUSTODY_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_signer_custody_input']);
    }
    // missing source -> UNCONFIGURED
    if (v.reasons.includes('signer_source_missing')) {
      return build('SIGNER_CUSTODY_UNCONFIGURED', ['signer_source_missing']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / bad purpose
    // / unknown source -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid') ||
        v.reasons.includes('signer_source_unknown')) {
      return build('SIGNER_CUSTODY_INVALID', v.reasons);
    }
    // a valid disabled/read-only tag -> READ_ONLY_OK
    return build('SIGNER_CUSTODY_READ_ONLY_OK', ['signer_custody_read_only_ok']);
  } catch {
    return build('SIGNER_CUSTODY_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-11 (D) signer-custody-boundary result fed forward.
function signRecognizeCustodyBoundaryResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.signer_custody_state === 'string' && SIGNER_CUSTODY_STATES.includes(o.signer_custody_state)) {
    return o.signer_custody_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (E) CANDIDATE SIGNING-REVIEW DESCRIPTOR
//
// A DESCRIPTIVE descriptor produced from safe signer METADATA buckets ONLY, after
// a SIGNING_REVIEW_INPUT_VALID boundary + SIGNER_CUSTODY_READ_ONLY_OK custody
// boundary ONLY. It is NOT a signature, NOT a private key, NOT key material, NOT
// a signing permission, NOT a send permission, NOT signing/trading readiness. It
// opens NO signer_ready / signing_permitted / transaction_ready / serialized_ready
// / message_bytes_ready / can_send / can_serialize. NO private_key / secret_key /
// keypair / mnemonic / seed / signature / signed_tx / transaction / serialized_tx
// / message_bytes / endpoint field ever appears in output. Fail-Safe: weak /
// adverse metadata buckets -> REJECTED / DEGRADED.
// ---------------------------------------------------------------------------

const CANDIDATE_SIGNING_REVIEW_STATES = Object.freeze([
  'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED', 'CANDIDATE_SIGNING_REVIEW_INVALID',
  'CANDIDATE_SIGNING_REVIEW_REJECTED', 'CANDIDATE_SIGNING_REVIEW_DEGRADED',
  'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR'
]);

const CANDIDATE_SIGNING_REVIEW_REASON_CODES = Object.freeze([
  'signing_review_input_valid', 'signer_custody_boundary_valid',
  'signer_metadata_present', 'signer_profile_status_revoked',
  'signer_profile_status_disabled', 'dual_control_required_unsatisfied',
  'signer_unreachable', 'candidate_signing_review_reviewed',
  'signing_review_input_not_valid', 'signer_custody_not_valid'
]);

const CANDIDATE_SIGNING_REVIEW_COMPONENTS = Object.freeze([
  'signing_review_input_boundary', 'signer_custody_boundary', 'signer_metadata'
]);

// fields that MUST NOT appear in any candidate-signing-review input or output
// (key material / signature / serialization / transaction / send). These names
// appear ONLY as fixed string literals in this allowlist + prose — never as real
// objects, calls, or emitted output keys, and the screen NEVER echoes VALUES.
const CANDIDATE_SIGNING_REVIEW_FORBIDDEN_KEYS = Object.freeze([
  'private_key', 'secret_key', 'secretkey', 'keypair', 'mnemonic', 'seed',
  'seed_phrase', 'raw_key', 'signing_key', 'signer_secret', 'signature',
  'signatures', 'signed_tx', 'signed_transaction', 'transaction', 'serialized_tx',
  'message_bytes', 'endpoint'
]);

const CANDIDATE_SIGNING_REVIEW_CUSTODY_BUCKETS = Object.freeze([
  'unknown', 'connected_wallet', 'isolated_signer'
]);
const CANDIDATE_SIGNING_REVIEW_STATUS_BUCKETS = Object.freeze([
  'unknown', 'active', 'disabled', 'revoked', 'degraded'
]);
const CANDIDATE_SIGNING_REVIEW_DUAL_CONTROL_BUCKETS = Object.freeze([
  'unknown', 'not_required', 'required_unsatisfied', 'required_satisfied'
]);
const CANDIDATE_SIGNING_REVIEW_REACHABILITY_BUCKETS = Object.freeze([
  'unknown', 'unreachable', 'reachable'
]);

function candidateSigningReviewHasForbiddenKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (CANDIDATE_SIGNING_REVIEW_FORBIDDEN_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

export function describeCandidateSigningReviewDescriptorContract() {
  return Object.freeze({
    contract: 'candidate-signing-review-descriptor',
    version: '0.0.0',
    test_only: true,
    supported_states: CANDIDATE_SIGNING_REVIEW_STATES,
    supported_reason_codes: CANDIDATE_SIGNING_REVIEW_REASON_CODES,
    advisory_only: true,
    candidate_signing_review_valid: false,
    candidate_signing_review_state: 'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED',
    signing_review_ref: null,
    tx_build_review_ref: null,
    intent_record_ref: null,
    signing_review_kind: 'candidate_signing_review_descriptor',
    signing_review_reason_codes: Object.freeze([]),
    status: 'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...signSafeFlags(),
    note: 'Read-only DESCRIPTIVE candidate signing-review descriptor produced from safe signer METADATA buckets ONLY, after a Stage-11 SIGNING_REVIEW_INPUT_VALID boundary + SIGNER_CUSTODY_READ_ONLY_OK custody boundary ONLY. A signing-review descriptor is a READ-ONLY ADVISORY REPRESENTATION ONLY — NOT a signature, NOT a private key, NOT key material, NOT a signing permission, NOT a send permission, NOT signing/trading readiness. It opens NO signer_ready / signing_permitted / transaction_ready / serialized_ready / message_bytes_ready / can_send / can_serialize — every readiness/execution/signing flag STAYS false; "a candidate descriptor exists" is carried ONLY by candidate_signing_review_valid / candidate_signing_review_state / signing_review_ref. The signer metadata buckets (key_custody_mode_bucket, signer_profile_status_bucket, dual_control_bucket, signer_reachability_bucket) are reviewed as ADVISORY METADATA ONLY, never actual key handling. NO private_key / secret_key / keypair / mnemonic / seed / seed_phrase / raw_key / signing_key / signer_secret / signature / signatures / signed_tx / signed_transaction / transaction / serialized_tx / message_bytes / endpoint field ever appears in output. Fail-Safe-Not-Fail-Open: missing input -> CANDIDATE_SIGNING_REVIEW_UNCONFIGURED; signing_review_input_boundary not SIGNING_REVIEW_INPUT_VALID OR signer_custody_boundary not SIGNER_CUSTODY_READ_ONLY_OK -> CANDIDATE_SIGNING_REVIEW_REJECTED (no descriptor); signer_metadata requires_key_material!==false OR requires_signing!==false OR requires_network!==false OR a smuggled sign/load/key/seed/signature/send key or forbidden flag/secret/endpoint -> CANDIDATE_SIGNING_REVIEW_INVALID; signer_profile_status_bucket revoked/disabled OR dual_control_bucket required_unsatisfied OR signer_reachability_bucket unreachable -> CANDIDATE_SIGNING_REVIEW_REJECTED (Fail-Safe; matching reason code included); any unknown bucket -> CANDIDATE_SIGNING_REVIEW_DEGRADED; valid clean metadata -> CANDIDATE_SIGNING_REVIEW_DESCRIPTOR. signing_review_ref / tx_build_review_ref / intent_record_ref are caller-supplied deterministic opaque refs, never generated and never derived from a clock.'
  });
}

export function validateCandidateSigningReviewDescriptorInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (signUninspectable(obj, ['purpose', ...CANDIDATE_SIGNING_REVIEW_COMPONENTS,
      'signing_review_ref', 'tx_build_review_ref', 'intent_record_ref'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...signSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_candidate_signing_review_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!CANDIDATE_SIGNING_REVIEW_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...signScreen(shallow));
      if (candidateSigningReviewHasForbiddenKey(obj)) reasons.push('forbidden_signing_field_blocked');
      // screen nested components for forbidden flags / exec cmds / forbidden keys / endpoints
      for (const k of CANDIDATE_SIGNING_REVIEW_COMPONENTS) {
        const c = obj[k];
        if (c == null || typeof c !== 'object') continue;
        if (signHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (signHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (candidateSigningReviewHasForbiddenKey(c)) reasons.push('forbidden_signing_field_blocked');
        if (signHasEndpointOrMainnet(c)) reasons.push('endpoint_or_mainnet_blocked');
      }
      if (obj.purpose !== 'candidate_signing_review_descriptor_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...signSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...signSafeFlags()
    });
  }
}

export function evaluateCandidateSigningReviewDescriptor(input) {
  const build = (state, reasons, refs) => Object.freeze({
    candidate_signing_review_valid: (state === 'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR'),
    candidate_signing_review_state: state,
    signing_review_ref: (refs && typeof refs.signing_review_ref === 'string') ? refs.signing_review_ref : null,
    tx_build_review_ref: (refs && typeof refs.tx_build_review_ref === 'string') ? refs.tx_build_review_ref : null,
    intent_record_ref: (refs && typeof refs.intent_record_ref === 'string') ? refs.intent_record_ref : null,
    signing_review_kind: 'candidate_signing_review_descriptor',
    signing_review_reason_codes: Object.freeze(
      [...new Set((reasons || []).filter((c) => CANDIDATE_SIGNING_REVIEW_REASON_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...signSafeFlags()
  });
  try {
    const v = validateCandidateSigningReviewDescriptorInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('CANDIDATE_SIGNING_REVIEW_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_candidate_signing_review_input'], null);
    }

    const refs = {
      signing_review_ref: (typeof input.signing_review_ref === 'string') ? input.signing_review_ref : null,
      tx_build_review_ref: (typeof input.tx_build_review_ref === 'string') ? input.tx_build_review_ref : null,
      intent_record_ref: (typeof input.intent_record_ref === 'string') ? input.intent_record_ref : null
    };

    // smuggled sign/load/key/seed/signature/send key or forbidden flag / exec cmd /
    // secret / endpoint / mainnet / bad purpose -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('forbidden_signing_field_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('CANDIDATE_SIGNING_REVIEW_INVALID', ['signer_metadata_invalid'], refs);
    }

    const boundary = input.signing_review_input_boundary;
    const custody = input.signer_custody_boundary;
    const metadata = input.signer_metadata;

    // missing required input -> UNCONFIGURED
    if (boundary == null || custody == null || metadata == null ||
        typeof metadata !== 'object' || Array.isArray(metadata)) {
      return build('CANDIDATE_SIGNING_REVIEW_UNCONFIGURED', ['required_input_missing'], refs);
    }

    const boundaryState = signRecognizeInputBoundaryResult(boundary);
    const custodyState = signRecognizeCustodyBoundaryResult(custody);

    // signing_review_input_boundary not VALID -> REJECTED
    if (boundaryState !== 'SIGNING_REVIEW_INPUT_VALID') {
      return build('CANDIDATE_SIGNING_REVIEW_REJECTED', ['signing_review_input_not_valid'], refs);
    }
    // signer_custody_boundary not READ_ONLY_OK -> REJECTED
    if (custodyState !== 'SIGNER_CUSTODY_READ_ONLY_OK') {
      return build('CANDIDATE_SIGNING_REVIEW_REJECTED', ['signer_custody_not_valid'], refs);
    }

    // signer metadata must explicitly forbid key material + signing + network
    if (metadata.requires_key_material !== false || metadata.requires_signing !== false ||
        metadata.requires_network !== false) {
      return build('CANDIDATE_SIGNING_REVIEW_INVALID', ['signer_metadata_invalid'], refs);
    }

    const custodyMode = metadata.key_custody_mode_bucket;
    const status = metadata.signer_profile_status_bucket;
    const dualControl = metadata.dual_control_bucket;
    const reachability = metadata.signer_reachability_bucket;

    // bucket values must be from the known allowlists -> else INVALID
    if (!CANDIDATE_SIGNING_REVIEW_CUSTODY_BUCKETS.includes(custodyMode) ||
        !CANDIDATE_SIGNING_REVIEW_STATUS_BUCKETS.includes(status) ||
        !CANDIDATE_SIGNING_REVIEW_DUAL_CONTROL_BUCKETS.includes(dualControl) ||
        !CANDIDATE_SIGNING_REVIEW_REACHABILITY_BUCKETS.includes(reachability)) {
      return build('CANDIDATE_SIGNING_REVIEW_INVALID', ['signer_metadata_invalid'], refs);
    }

    // Fail-Safe: adverse metadata -> REJECTED (no descriptor)
    const bad = [];
    if (status === 'revoked') bad.push('signer_profile_status_revoked');
    if (status === 'disabled') bad.push('signer_profile_status_disabled');
    if (dualControl === 'required_unsatisfied') bad.push('dual_control_required_unsatisfied');
    if (reachability === 'unreachable') bad.push('signer_unreachable');
    if (bad.length > 0) {
      return build('CANDIDATE_SIGNING_REVIEW_REJECTED', [
        'signing_review_input_valid', 'signer_custody_boundary_valid',
        'signer_metadata_present', ...bad
      ], refs);
    }

    // Fail-Safe: weak/unknown metadata -> DEGRADED (no descriptor)
    if (custodyMode === 'unknown' || status === 'unknown' ||
        dualControl === 'unknown' || reachability === 'unknown' ||
        status === 'degraded') {
      return build('CANDIDATE_SIGNING_REVIEW_DEGRADED', [
        'signing_review_input_valid', 'signer_custody_boundary_valid',
        'signer_metadata_present'
      ], refs);
    }

    // valid clean metadata -> DESCRIPTOR
    return build('CANDIDATE_SIGNING_REVIEW_DESCRIPTOR', [
      'signing_review_input_valid', 'signer_custody_boundary_valid',
      'signer_metadata_present', 'candidate_signing_review_reviewed'
    ], refs);
  } catch {
    return build('CANDIDATE_SIGNING_REVIEW_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// Recognize a Stage-11 (E) candidate-signing-review-descriptor result fed forward.
function signRecognizeCandidateDescriptorResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.candidate_signing_review_state === 'string' && CANDIDATE_SIGNING_REVIEW_STATES.includes(o.candidate_signing_review_state)) {
    return o.candidate_signing_review_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (F) SIGNER / KEY-CUSTODY READINESS ADVISORY
//
// An ADVISORY derived from safe input METADATA BUCKETS ONLY (key_custody_mode,
// signer_profile_status, dual_control, signer_reachability, custody_verification).
// It REVIEWS custody prerequisites — it is NOT signing, NOT a signature, NOT a
// private key, NOT key material, NOT a signing/send permission, NOT
// signing/trading readiness. ACCEPTABLE_ADVISORY opens NO signing/transaction/send
// (signer_ready / signing_permitted / transaction_ready / can_send / can_serialize
// STAY false). No key / signature / transaction output field ever appears.
// ---------------------------------------------------------------------------

const SIGNER_CUSTODY_READINESS_STATES = Object.freeze([
  'SIGNER_CUSTODY_READINESS_UNCONFIGURED', 'SIGNER_CUSTODY_READINESS_INVALID',
  'SIGNER_CUSTODY_READINESS_DEGRADED', 'SIGNER_CUSTODY_READINESS_REJECTED',
  'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY'
]);

const SIGNER_CUSTODY_READINESS_REASON_CODES = Object.freeze([
  'key_custody_mode_unknown', 'signer_profile_status_unknown',
  'signer_profile_status_revoked', 'signer_profile_status_disabled',
  'signer_profile_status_degraded', 'dual_control_unknown',
  'dual_control_required_unsatisfied', 'signer_reachability_unknown',
  'signer_unreachable', 'custody_verification_unknown', 'custody_unverified',
  'signer_custody_acceptable'
]);

const SIGNER_CUSTODY_READINESS_TOP_KEYS = Object.freeze([
  'purpose', 'key_custody_mode_bucket', 'signer_profile_status_bucket',
  'dual_control_bucket', 'signer_reachability_bucket', 'custody_verification_bucket'
]);

const SIGNER_CUSTODY_READINESS_CUSTODY_BUCKETS = CANDIDATE_SIGNING_REVIEW_CUSTODY_BUCKETS;
const SIGNER_CUSTODY_READINESS_STATUS_BUCKETS = CANDIDATE_SIGNING_REVIEW_STATUS_BUCKETS;
const SIGNER_CUSTODY_READINESS_DUAL_CONTROL_BUCKETS = CANDIDATE_SIGNING_REVIEW_DUAL_CONTROL_BUCKETS;
const SIGNER_CUSTODY_READINESS_REACHABILITY_BUCKETS = CANDIDATE_SIGNING_REVIEW_REACHABILITY_BUCKETS;
const SIGNER_CUSTODY_READINESS_VERIFICATION_BUCKETS = Object.freeze([
  'unknown', 'unverified', 'verified'
]);

export function describeSignerCustodyReadinessAdvisoryContract() {
  return Object.freeze({
    contract: 'signer-custody-readiness-advisory',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNER_CUSTODY_READINESS_STATES,
    supported_reason_codes: SIGNER_CUSTODY_READINESS_REASON_CODES,
    advisory_only: true,
    valid: false,
    signer_custody_readiness_state: 'SIGNER_CUSTODY_READINESS_UNCONFIGURED',
    signer_custody_acceptable_advisory: false,
    signer_custody_rejected: false,
    signing_review_reason_codes: Object.freeze([]),
    status: 'SIGNER_CUSTODY_READINESS_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...signSafeFlags(),
    note: 'Read-only signer / KEY-CUSTODY READINESS ADVISORY derived from safe input METADATA BUCKETS ONLY (key_custody_mode_bucket, signer_profile_status_bucket, dual_control_bucket, signer_reachability_bucket, custody_verification_bucket). It REVIEWS custody prerequisites as ADVISORY METADATA ONLY, never actual key handling — it is NOT signing, NOT a signature, NOT a private key, NOT key material, NOT a signing permission, NOT a send permission, NOT signing/trading readiness. SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY opens NO signing/transaction/send: signer_ready / signing_permitted / transaction_ready / can_send / can_serialize (and every readiness/execution/signing flag) STAY false; "custody acceptable" is carried ONLY by signer_custody_readiness_state / signer_custody_acceptable_advisory. NO private_key / secret_key / keypair / mnemonic / seed / signature / transaction output field ever appears. Fail-Safe-Not-Fail-Open: missing bucket -> SIGNER_CUSTODY_READINESS_UNCONFIGURED; an invalid bucket value OR a smuggled forbidden trading flag / execution command / secret / endpoint / mainnet / key-material -> SIGNER_CUSTODY_READINESS_INVALID (never echoed); signer_profile_status_bucket revoked/disabled OR dual_control_bucket required_unsatisfied OR signer_reachability_bucket unreachable OR custody_verification_bucket unverified -> SIGNER_CUSTODY_READINESS_REJECTED; any unknown bucket OR signer_profile_status_bucket degraded (and no rejection) -> SIGNER_CUSTODY_READINESS_DEGRADED; ACCEPTABLE_ADVISORY only if key_custody_mode_bucket isolated_signer AND signer_profile_status_bucket active AND dual_control_bucket in {not_required, required_satisfied} AND signer_reachability_bucket reachable AND custody_verification_bucket verified. Reason codes from a fixed allowlist contain NO sign/key/seed/signature/send artifact tokens.'
  });
}

export function validateSignerCustodyReadinessAdvisoryInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (signUninspectable(obj, [...SIGNER_CUSTODY_READINESS_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...signSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_signer_custody_readiness_input');
    } else {
      recognized = true;
      reasons.push(...signScreen(obj));
      if (candidateSigningReviewHasForbiddenKey(obj)) reasons.push('forbidden_signing_field_blocked');
      if (obj.purpose !== 'signer_custody_readiness_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...signSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...signSafeFlags()
    });
  }
}

export function evaluateSignerCustodyReadinessAdvisory(input) {
  const build = (state, reasonCodes, reasons) => Object.freeze({
    valid: (state !== 'SIGNER_CUSTODY_READINESS_INVALID'),
    signer_custody_readiness_state: state,
    signer_custody_acceptable_advisory: (state === 'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY'),
    signer_custody_rejected: (state === 'SIGNER_CUSTODY_READINESS_REJECTED'),
    signing_review_reason_codes: Object.freeze(
      [...new Set((reasonCodes || []).filter((c) => SIGNER_CUSTODY_READINESS_REASON_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || reasonCodes || [])]),
    read_only: true,
    advisory_only: true,
    ...signSafeFlags()
  });
  try {
    const v = validateSignerCustodyReadinessAdvisoryInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('SIGNER_CUSTODY_READINESS_UNCONFIGURED', [],
        v.reasons.length ? v.reasons : ['no_signer_custody_readiness_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / key-material /
    // bad purpose -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('forbidden_signing_field_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('SIGNER_CUSTODY_READINESS_INVALID', [], ['signer_custody_readiness_invalid']);
    }

    const custodyMode = input.key_custody_mode_bucket;
    const status = input.signer_profile_status_bucket;
    const dualControl = input.dual_control_bucket;
    const reachability = input.signer_reachability_bucket;
    const verification = input.custody_verification_bucket;

    // missing bucket -> UNCONFIGURED
    if (custodyMode == null || status == null || dualControl == null ||
        reachability == null || verification == null) {
      return build('SIGNER_CUSTODY_READINESS_UNCONFIGURED', [], ['required_bucket_missing']);
    }

    // invalid enum value -> INVALID
    if (!SIGNER_CUSTODY_READINESS_CUSTODY_BUCKETS.includes(custodyMode) ||
        !SIGNER_CUSTODY_READINESS_STATUS_BUCKETS.includes(status) ||
        !SIGNER_CUSTODY_READINESS_DUAL_CONTROL_BUCKETS.includes(dualControl) ||
        !SIGNER_CUSTODY_READINESS_REACHABILITY_BUCKETS.includes(reachability) ||
        !SIGNER_CUSTODY_READINESS_VERIFICATION_BUCKETS.includes(verification)) {
      return build('SIGNER_CUSTODY_READINESS_INVALID', [], ['signer_custody_readiness_invalid']);
    }

    // Fail-Safe: adverse buckets -> REJECTED
    const rej = [];
    if (status === 'revoked') rej.push('signer_profile_status_revoked');
    if (status === 'disabled') rej.push('signer_profile_status_disabled');
    if (dualControl === 'required_unsatisfied') rej.push('dual_control_required_unsatisfied');
    if (reachability === 'unreachable') rej.push('signer_unreachable');
    if (verification === 'unverified') rej.push('custody_unverified');
    if (rej.length > 0) {
      return build('SIGNER_CUSTODY_READINESS_REJECTED', rej, rej);
    }

    // DEGRADED: any unknown bucket OR status degraded (and no rejection)
    const deg = [];
    if (custodyMode === 'unknown') deg.push('key_custody_mode_unknown');
    if (status === 'unknown') deg.push('signer_profile_status_unknown');
    if (dualControl === 'unknown') deg.push('dual_control_unknown');
    if (reachability === 'unknown') deg.push('signer_reachability_unknown');
    if (verification === 'unknown') deg.push('custody_verification_unknown');
    if (status === 'degraded') deg.push('signer_profile_status_degraded');
    if (deg.length > 0) {
      return build('SIGNER_CUSTODY_READINESS_DEGRADED', deg, deg);
    }

    // ACCEPTABLE_ADVISORY only on the strict positive combination
    if (custodyMode === 'isolated_signer' && status === 'active' &&
        (dualControl === 'not_required' || dualControl === 'required_satisfied') &&
        reachability === 'reachable' && verification === 'verified') {
      return build('SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY',
        ['signer_custody_acceptable'], ['signer_custody_acceptable']);
    }

    // anything else (e.g. connected_wallet mode) is not acceptable -> DEGRADED
    return build('SIGNER_CUSTODY_READINESS_DEGRADED', [], ['signer_custody_not_acceptable']);
  } catch {
    return build('SIGNER_CUSTODY_READINESS_UNCONFIGURED', [], ['input_inspection_error']);
  }
}

// Recognize a Stage-11 (F) signer-custody-readiness-advisory result fed forward.
function signRecognizeCustodyReadinessResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.signer_custody_readiness_state === 'string' && SIGNER_CUSTODY_READINESS_STATES.includes(o.signer_custody_readiness_state)) {
    return o.signer_custody_readiness_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (G) PRIVATE-KEY FORBIDDEN SURFACE GUARD
//
// Proves Stage-11 neither produces nor accepts private-key / seed / keypair /
// signature material. Detects forbidden field NAMES (top-level keys only) and
// reports a REDACTED forbidden_field_ref (the matched NAME only) — NEVER the
// field VALUE. The detection booleans (key_material_detected / private_key_detected
// / forbidden_field_detected) are DETECTION outputs (true == found == BLOCKED ==
// the SAFE blocked state); they are NOT readiness/exec flags.
// ---------------------------------------------------------------------------

const PRIVATE_KEY_SURFACE_STATES = Object.freeze([
  'PRIVATE_KEY_SURFACE_UNCONFIGURED', 'PRIVATE_KEY_SURFACE_CLEAN',
  'PRIVATE_KEY_SURFACE_BLOCKED'
]);

// forbidden field NAMES (case-sensitive + camelCase variants). These appear ONLY
// as fixed string literals in this allowlist + prose — never as real objects,
// calls, or emitted output keys; the guard NEVER echoes their VALUES.
const PRIVATE_KEY_FORBIDDEN_FIELD_NAMES = Object.freeze([
  'private_key', 'privateKey', 'secret_key', 'secretKey', 'keypair', 'keyPair',
  'mnemonic', 'seed', 'seed_phrase', 'seedPhrase', 'secret_seed', 'raw_key',
  'rawKey', 'signing_key', 'signingKey', 'signer_secret', 'signerSecret',
  'ed25519_secret', 'ed25519Secret', 'signature', 'signatures', 'signed_tx',
  'signedTransaction', 'signed_transaction'
]);

// signature-only NAMES (vs key/seed/keypair NAMES). A signature match sets
// forbidden_field_detected + key_material_detected but NOT private_key_detected.
const PRIVATE_KEY_SIGNATURE_ONLY_NAMES = Object.freeze([
  'signature', 'signatures', 'signed_tx', 'signedTransaction', 'signed_transaction'
]);

export function describePrivateKeyForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'private-key-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    supported_states: PRIVATE_KEY_SURFACE_STATES,
    forbidden_field_names: PRIVATE_KEY_FORBIDDEN_FIELD_NAMES,
    advisory_only: true,
    private_key_surface_state: 'PRIVATE_KEY_SURFACE_UNCONFIGURED',
    key_material_detected: false,
    private_key_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'PRIVATE_KEY_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...signSafeFlags(),
    note: 'Read-only PRIVATE-KEY FORBIDDEN SURFACE GUARD. Proves Stage-11 neither produces nor accepts private-key / seed / keypair / signature material. It scans ONLY top-level keys (deterministic, bounded, pure) for forbidden field NAMES (private_key, privateKey, secret_key, secretKey, keypair, keyPair, mnemonic, seed, seed_phrase, seedPhrase, secret_seed, raw_key, rawKey, signing_key, signingKey, signer_secret, signerSecret, ed25519_secret, ed25519Secret, signature, signatures, signed_tx, signedTransaction, signed_transaction). The detection booleans key_material_detected / private_key_detected / forbidden_field_detected are DETECTION outputs (true == a key-material/signature field was found == the SAFE BLOCKED state); they are NOT readiness/execution/signing flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing / hostile input -> PRIVATE_KEY_SURFACE_UNCONFIGURED (frozen, never throws); a clean descriptor with NONE of the forbidden field names present -> PRIVATE_KEY_SURFACE_CLEAN (all detection booleans false); ANY forbidden field name present at top level -> PRIVATE_KEY_SURFACE_BLOCKED (key_material_detected:true, forbidden_field_detected:true, private_key_detected:true for a key/seed/keypair name and false for a signature-only name, forbidden_field_ref = the matched NAME). Opens NO signing/transaction/send — every readiness/execution/signing flag STAYS false.'
  });
}

export function evaluatePrivateKeyForbiddenSurface(input) {
  const build = (state, detected, ref, reasons) => Object.freeze({
    private_key_surface_state: state,
    key_material_detected: (state === 'PRIVATE_KEY_SURFACE_BLOCKED'),
    private_key_detected: (state === 'PRIVATE_KEY_SURFACE_BLOCKED') ? (detected === 'key') : false,
    forbidden_field_detected: (state === 'PRIVATE_KEY_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'PRIVATE_KEY_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...signSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (signUninspectable(obj, [...PRIVATE_KEY_FORBIDDEN_FIELD_NAMES])) {
      return build('PRIVATE_KEY_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('PRIVATE_KEY_SURFACE_UNCONFIGURED', null, null, ['no_private_key_surface_input']);
    }
    let keys;
    try {
      keys = Object.keys(obj);
    } catch {
      return build('PRIVATE_KEY_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    // scan top-level keys only; first matched NAME (deterministic order) wins
    for (const k of keys) {
      if (PRIVATE_KEY_FORBIDDEN_FIELD_NAMES.includes(k)) {
        const kind = PRIVATE_KEY_SIGNATURE_ONLY_NAMES.includes(k) ? 'signature' : 'key';
        // forbidden_field_ref = the matched NAME only (REDACTED); NEVER the VALUE
        return build('PRIVATE_KEY_SURFACE_BLOCKED', kind, k,
          [kind === 'signature' ? 'signature_field_detected' : 'key_material_detected']);
      }
    }
    return build('PRIVATE_KEY_SURFACE_CLEAN', null, null, ['private_key_surface_clean']);
  } catch {
    return build('PRIVATE_KEY_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// Recognize a Stage-11 (G) private-key-surface result fed forward.
function signRecognizePrivateKeySurfaceResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.private_key_surface_state === 'string' && PRIVATE_KEY_SURFACE_STATES.includes(o.private_key_surface_state)) {
    return o.private_key_surface_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (H) SIGNING-REVIEW VERDICT
//
// Aggregates input boundary (C) + signer/custody boundary (D) + candidate
// descriptor (E) + custody-readiness advisory (F) + private-key surface (G) into
// an advisory verdict. A PASS is ADVISORY ONLY — even SIGNING_REVIEW_PASS_ADVISORY
// opens NO signer_ready / signing_permitted / transaction_ready / can_serialize /
// can_send (every readiness/execution/signing flag STAYS false).
// ---------------------------------------------------------------------------

const SIGNING_REVIEW_VERDICT_STATES = Object.freeze([
  'SIGNING_REVIEW_UNCONFIGURED', 'SIGNING_REVIEW_DEGRADED',
  'SIGNING_REVIEW_BLOCKED', 'SIGNING_REVIEW_PASS_ADVISORY'
]);

const SIGNING_REVIEW_VERDICT_REASON_CODES = Object.freeze([
  'signing_review_input_valid', 'signer_custody_read_only_ok',
  'candidate_signing_review_descriptor_present', 'signer_custody_acceptable',
  'private_key_surface_clean', 'signing_review_input_not_valid',
  'signer_custody_not_valid', 'candidate_descriptor_not_present',
  'signer_custody_rejected', 'private_key_surface_blocked',
  'component_invalid', 'component_missing', 'custody_readiness_degraded',
  'candidate_descriptor_degraded', 'forbidden_input_blocked'
]);

const SIGNING_REVIEW_VERDICT_EXPLANATION_CODES = Object.freeze([
  'all_prerequisites_reviewed_advisory', 'input_boundary_reviewed',
  'signer_custody_reviewed', 'candidate_descriptor_reviewed',
  'custody_readiness_reviewed', 'private_key_surface_reviewed',
  'review_blocked_fail_closed', 'review_degraded_fail_closed',
  'review_unconfigured'
]);

const SIGNING_REVIEW_VERDICT_COMPONENTS = Object.freeze([
  'signing_review_input_boundary', 'signer_custody_boundary',
  'candidate_signing_review_descriptor', 'signer_custody_readiness_advisory',
  'private_key_surface'
]);

export function describeSigningReviewVerdictContract() {
  return Object.freeze({
    contract: 'signing-review-verdict',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNING_REVIEW_VERDICT_STATES,
    supported_reason_codes: SIGNING_REVIEW_VERDICT_REASON_CODES,
    supported_explanation_codes: SIGNING_REVIEW_VERDICT_EXPLANATION_CODES,
    advisory_only: true,
    valid: false,
    signing_review_state: 'SIGNING_REVIEW_UNCONFIGURED',
    signing_review_passed_advisory: false,
    signing_review_blocked: false,
    signing_review_reason_codes: Object.freeze([]),
    signing_review_explanation_codes: Object.freeze([]),
    status: 'SIGNING_REVIEW_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...signSafeFlags(),
    note: 'Read-only SIGNING-REVIEW VERDICT. Aggregates the Stage-11 signing-review input boundary (C) + signer/custody boundary (D) + candidate signing-review descriptor (E) + signer custody-readiness advisory (F) + private-key forbidden surface (G) into an ADVISORY verdict. A signing-review verdict is a READ-ONLY ADVISORY REPRESENTATION ONLY — it REVIEWS signing PREREQUISITES; it is NOT signing, NOT a signature, NOT a private key, NOT key material, NOT a signing/send permission, NOT signing/trading readiness. CRITICAL: even SIGNING_REVIEW_PASS_ADVISORY opens NO signer_ready / signing_permitted / transaction_ready / can_serialize / can_send — every readiness/execution/signing flag STAYS false; "review passed" is carried ONLY by signing_review_state / signing_review_passed_advisory. Ordering (Fail-Safe-Not-Fail-Open): a smuggled forbidden trading flag / execution command / secret / endpoint / mainnet on the top level or any component -> SIGNING_REVIEW_BLOCKED; private_key_surface PRIVATE_KEY_SURFACE_BLOCKED OR any component *_INVALID OR input boundary not SIGNING_REVIEW_INPUT_VALID OR signer/custody not SIGNER_CUSTODY_READ_ONLY_OK OR descriptor not CANDIDATE_SIGNING_REVIEW_DESCRIPTOR OR custody-readiness SIGNER_CUSTODY_READINESS_REJECTED -> SIGNING_REVIEW_BLOCKED; any of the 5 components missing -> SIGNING_REVIEW_UNCONFIGURED; custody-readiness DEGRADED OR descriptor DEGRADED -> SIGNING_REVIEW_DEGRADED; all clean (input VALID + custody READ_ONLY_OK + descriptor DESCRIPTOR + readiness ACCEPTABLE_ADVISORY + private-key-surface CLEAN) -> SIGNING_REVIEW_PASS_ADVISORY. Reason / explanation codes come from fixed allowlists and contain NO sign/key/seed/signature/send artifact tokens.'
  });
}

export function evaluateSigningReviewVerdict(input) {
  const build = (state, reasonCodes, explanationCodes, reasons) => Object.freeze({
    valid: (state !== 'SIGNING_REVIEW_BLOCKED'),
    signing_review_state: state,
    signing_review_passed_advisory: (state === 'SIGNING_REVIEW_PASS_ADVISORY'),
    signing_review_blocked: (state === 'SIGNING_REVIEW_BLOCKED'),
    signing_review_reason_codes: Object.freeze(
      [...new Set((reasonCodes || []).filter((c) => SIGNING_REVIEW_VERDICT_REASON_CODES.includes(c)))]
    ),
    signing_review_explanation_codes: Object.freeze(
      [...new Set((explanationCodes || []).filter((c) => SIGNING_REVIEW_VERDICT_EXPLANATION_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || reasonCodes || [])]),
    read_only: true,
    advisory_only: true,
    ...signSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (signUninspectable(obj, ['purpose', ...SIGNING_REVIEW_VERDICT_COMPONENTS])) {
      return build('SIGNING_REVIEW_UNCONFIGURED', [], ['review_unconfigured'], ['input_inspection_error']);
    }
    if (!obj) {
      return build('SIGNING_REVIEW_UNCONFIGURED', [], ['review_unconfigured'], ['no_signing_review_verdict_input']);
    }

    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet on top-level
    // (excluding component slots) or any component -> BLOCKED
    const shallow = {};
    for (const [k, val] of Object.entries(obj)) {
      if (!SIGNING_REVIEW_VERDICT_COMPONENTS.includes(k)) shallow[k] = val;
    }
    let blockedBySmuggle = signScreen(shallow).length > 0 ||
      candidateSigningReviewHasForbiddenKey(shallow);
    for (const k of SIGNING_REVIEW_VERDICT_COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      if (signHasForbiddenTrueFlag(c) || signHasExecCmdKey(c) ||
          signHasEndpointOrMainnet(c) || candidateSigningReviewHasForbiddenKey(c)) {
        blockedBySmuggle = true;
      }
    }
    if (blockedBySmuggle) {
      return build('SIGNING_REVIEW_BLOCKED', ['forbidden_input_blocked'],
        ['review_blocked_fail_closed'], ['forbidden_input_blocked']);
    }

    const boundary = obj.signing_review_input_boundary;
    const custody = obj.signer_custody_boundary;
    const descriptor = obj.candidate_signing_review_descriptor;
    const readiness = obj.signer_custody_readiness_advisory;
    const surface = obj.private_key_surface;

    const boundaryState = signRecognizeInputBoundaryResult(boundary);
    const custodyState = signRecognizeCustodyBoundaryResult(custody);
    const descriptorState = signRecognizeCandidateDescriptorResult(descriptor);
    const readinessState = signRecognizeCustodyReadinessResult(readiness);
    const surfaceState = signRecognizePrivateKeySurfaceResult(surface);

    // private-key surface BLOCKED OR any component *_INVALID OR input not VALID OR
    // custody not READ_ONLY_OK OR descriptor not DESCRIPTOR OR readiness REJECTED -> BLOCKED
    if (surfaceState === 'PRIVATE_KEY_SURFACE_BLOCKED') {
      return build('SIGNING_REVIEW_BLOCKED', ['private_key_surface_blocked'],
        ['review_blocked_fail_closed'], ['private_key_surface_blocked']);
    }
    if (boundaryState === 'SIGNING_REVIEW_INPUT_INVALID' ||
        custodyState === 'SIGNER_CUSTODY_INVALID' ||
        descriptorState === 'CANDIDATE_SIGNING_REVIEW_INVALID' ||
        readinessState === 'SIGNER_CUSTODY_READINESS_INVALID') {
      return build('SIGNING_REVIEW_BLOCKED', ['component_invalid'],
        ['review_blocked_fail_closed'], ['component_invalid']);
    }

    // missing any of the 5 components -> UNCONFIGURED
    if (boundary == null || custody == null || descriptor == null ||
        readiness == null || surface == null ||
        boundaryState === null || custodyState === null || descriptorState === null ||
        readinessState === null || surfaceState === null) {
      return build('SIGNING_REVIEW_UNCONFIGURED', ['component_missing'],
        ['review_unconfigured'], ['component_missing']);
    }

    // hard-block conditions
    const blockReasons = [];
    if (boundaryState !== 'SIGNING_REVIEW_INPUT_VALID') blockReasons.push('signing_review_input_not_valid');
    if (custodyState !== 'SIGNER_CUSTODY_READ_ONLY_OK') blockReasons.push('signer_custody_not_valid');
    if (descriptorState !== 'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR' &&
        descriptorState !== 'CANDIDATE_SIGNING_REVIEW_DEGRADED') {
      blockReasons.push('candidate_descriptor_not_present');
    }
    if (readinessState === 'SIGNER_CUSTODY_READINESS_REJECTED') blockReasons.push('signer_custody_rejected');
    if (blockReasons.length > 0) {
      return build('SIGNING_REVIEW_BLOCKED', blockReasons,
        ['review_blocked_fail_closed'], blockReasons);
    }

    // DEGRADED: custody-readiness DEGRADED OR descriptor DEGRADED
    const degReasons = [];
    if (readinessState === 'SIGNER_CUSTODY_READINESS_DEGRADED') degReasons.push('custody_readiness_degraded');
    if (descriptorState === 'CANDIDATE_SIGNING_REVIEW_DEGRADED') degReasons.push('candidate_descriptor_degraded');
    if (degReasons.length > 0) {
      return build('SIGNING_REVIEW_DEGRADED', degReasons,
        ['review_degraded_fail_closed'], degReasons);
    }

    // all clean -> PASS_ADVISORY (advisory only; opens nothing)
    if (boundaryState === 'SIGNING_REVIEW_INPUT_VALID' &&
        custodyState === 'SIGNER_CUSTODY_READ_ONLY_OK' &&
        descriptorState === 'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR' &&
        readinessState === 'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY' &&
        surfaceState === 'PRIVATE_KEY_SURFACE_CLEAN') {
      return build('SIGNING_REVIEW_PASS_ADVISORY', [
        'signing_review_input_valid', 'signer_custody_read_only_ok',
        'candidate_signing_review_descriptor_present', 'signer_custody_acceptable',
        'private_key_surface_clean'
      ], ['all_prerequisites_reviewed_advisory', 'input_boundary_reviewed',
        'signer_custody_reviewed', 'candidate_descriptor_reviewed',
        'custody_readiness_reviewed', 'private_key_surface_reviewed'],
        ['signing_review_pass_advisory']);
    }

    // any remaining gap -> DEGRADED (fail-closed)
    return build('SIGNING_REVIEW_DEGRADED', ['custody_readiness_degraded'],
      ['review_degraded_fail_closed'], ['signing_review_not_pass_advisory']);
  } catch {
    return build('SIGNING_REVIEW_UNCONFIGURED', [], ['review_unconfigured'], ['input_inspection_error']);
  }
}

// Recognize a Stage-11 (H) signing-review-verdict result fed forward.
function signRecognizeVerdictResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.signing_review_state === 'string' && SIGNING_REVIEW_VERDICT_STATES.includes(o.signing_review_state)) {
    return o.signing_review_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (I) SIGNING-REVIEW SUPPRESSION / REJECTION
//
// Prevents progression; reasons only. Creates NO signing. A signing-review is
// NEVER sign / send / execution authorized at this layer, so the not_*_authorized
// reasons are ALWAYS emitted. Suppression opens NO signer_ready / signing_permitted
// / transaction_ready / can_send.
// ---------------------------------------------------------------------------

const SIGNING_REVIEW_SUPPRESSION_REASON_CODES = Object.freeze([
  'tx_build_not_reviewed', 'signer_custody_invalid', 'signer_metadata_missing',
  'signer_not_ready', 'dual_control_unsatisfied', 'key_material_detected',
  'signature_detected', 'not_sign_authorized', 'not_send_authorized',
  'not_execution_authorized'
]);

const SIGNING_REVIEW_SUPPRESSION_ALWAYS = Object.freeze([
  'not_sign_authorized', 'not_send_authorized', 'not_execution_authorized'
]);

const SIGNING_REVIEW_SUPPRESSION_COMPONENTS = Object.freeze([
  'signing_review_input_boundary', 'candidate_signing_review_descriptor',
  'signer_custody_readiness_advisory', 'private_key_surface',
  'signer_custody_boundary'
]);

export function describeSigningReviewSuppressionContract() {
  return Object.freeze({
    contract: 'signing-review-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: SIGNING_REVIEW_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: false,
    suppression_reasons: Object.freeze([]),
    status: 'SIGNING_REVIEW_SUPPRESSION_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...signSafeFlags(),
    note: 'Read-only SIGNING-REVIEW SUPPRESSION / REJECTION. Prevents progression and reports REASONS ONLY — it creates NO signing, NO signature, NO send, NO transaction. A signing-review is NEVER sign / send / execution authorized at this layer, so not_sign_authorized + not_send_authorized + not_execution_authorized are ALWAYS included whenever a result is emitted — even an advisory-clean signing-review is STILL suppressed for sign/send. Suppression opens NO signer_ready / signing_permitted / transaction_ready / can_send — every readiness/execution/signing flag STAYS false. Rules (Fail-Safe-Not-Fail-Open): signing_review_input_boundary not SIGNING_REVIEW_INPUT_VALID -> suppressed + tx_build_not_reviewed; signer_custody_boundary not SIGNER_CUSTODY_READ_ONLY_OK -> suppressed + signer_custody_invalid; missing candidate_signing_review_descriptor / signer metadata -> suppressed + signer_metadata_missing; signer_custody_readiness_advisory SIGNER_CUSTODY_READINESS_REJECTED -> suppressed + signer_not_ready (+ dual_control_unsatisfied where derivable); private_key_surface PRIVATE_KEY_SURFACE_BLOCKED -> suppressed + key_material_detected (+ signature_detected when the matched ref is a signature name). Reason codes come from a fixed allowlist.'
  });
}

export function evaluateSigningReviewSuppression(input) {
  const build = (suppressed, reasonCodes) => {
    const codes = [...new Set([...(reasonCodes || []), ...SIGNING_REVIEW_SUPPRESSION_ALWAYS])]
      .filter((c) => SIGNING_REVIEW_SUPPRESSION_REASON_CODES.includes(c));
    const state = suppressed ? 'SIGNING_REVIEW_SUPPRESSED' : 'SIGNING_REVIEW_NOT_SUPPRESSED';
    return Object.freeze({
      suppressed: suppressed === true,
      suppression_reasons: Object.freeze(codes),
      status: state,
      reasons: Object.freeze(codes),
      read_only: true,
      advisory_only: true,
      ...signSafeFlags()
    });
  };
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (signUninspectable(obj, ['purpose', ...SIGNING_REVIEW_SUPPRESSION_COMPONENTS])) {
      // hostile -> suppressed fail-closed (always carries not_*_authorized)
      return build(true, []);
    }
    if (!obj) {
      return build(true, []);
    }

    const boundary = obj.signing_review_input_boundary;
    const descriptor = obj.candidate_signing_review_descriptor;
    const readiness = obj.signer_custody_readiness_advisory;
    const surface = obj.private_key_surface;
    const custody = obj.signer_custody_boundary;

    const codes = [];

    // input boundary not VALID -> tx_build_not_reviewed
    if (boundary != null) {
      const bs = signRecognizeInputBoundaryResult(boundary);
      if (bs !== 'SIGNING_REVIEW_INPUT_VALID') codes.push('tx_build_not_reviewed');
    } else {
      codes.push('tx_build_not_reviewed');
    }

    // signer custody not READ_ONLY_OK -> signer_custody_invalid
    if (custody != null) {
      const cs = signRecognizeCustodyBoundaryResult(custody);
      if (cs !== 'SIGNER_CUSTODY_READ_ONLY_OK') codes.push('signer_custody_invalid');
    }

    // missing descriptor / metadata -> signer_metadata_missing
    if (descriptor == null) {
      codes.push('signer_metadata_missing');
    } else {
      const ds = signRecognizeCandidateDescriptorResult(descriptor);
      if (ds !== 'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR') codes.push('signer_metadata_missing');
    }

    // custody-readiness REJECTED -> signer_not_ready (+ dual_control_unsatisfied)
    if (readiness != null) {
      const rs = signRecognizeCustodyReadinessResult(readiness);
      if (rs === 'SIGNER_CUSTODY_READINESS_REJECTED') {
        codes.push('signer_not_ready');
        const rc = Array.isArray(readiness.signing_review_reason_codes) ? readiness.signing_review_reason_codes : [];
        if (rc.includes('dual_control_required_unsatisfied')) codes.push('dual_control_unsatisfied');
      } else if (rs !== 'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY') {
        codes.push('signer_not_ready');
      }
    }

    // private-key surface BLOCKED -> key_material_detected (+ signature_detected)
    if (surface != null) {
      const ss = signRecognizePrivateKeySurfaceResult(surface);
      if (ss === 'PRIVATE_KEY_SURFACE_BLOCKED') {
        codes.push('key_material_detected');
        if (surface.private_key_detected === false && surface.forbidden_field_detected === true) {
          codes.push('signature_detected');
        }
      }
    }

    // suppression is ALWAYS active for sign/send at this layer (not_*_authorized
    // always added); a result is emitted whenever input is recognized -> suppressed.
    return build(true, codes);
  } catch {
    return build(true, []);
  }
}

// Recognize a Stage-11 (I) signing-review-suppression result fed forward.
function signRecognizeSuppressionResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.suppressed === 'boolean' && Array.isArray(o.suppression_reasons)) {
    return o.suppressed;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (J) SIGNING-REVIEW HEALTH / STATUS
//
// Consumes input boundary (C) + signer/custody boundary (D) + descriptor (E) +
// custody-readiness advisory (F) + private-key surface (G) + verdict (H) +
// suppression (I); derives status only. REVIEWED_ADVISORY does NOT open
// signer / signing / transaction / send — every readiness/execution/signing flag
// STAYS false on EVERY state.
// ---------------------------------------------------------------------------

const SIGNING_REVIEW_HEALTH_STATES = Object.freeze([
  'SIGNING_REVIEW_HEALTH_UNCONFIGURED', 'SIGNING_REVIEW_HEALTH_DEGRADED',
  'SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY', 'SIGNING_REVIEW_HEALTH_SUPPRESSED',
  'SIGNING_REVIEW_HEALTH_BLOCKED'
]);

const SIGNING_REVIEW_HEALTH_COMPONENTS = Object.freeze([
  'signing_review_input_boundary', 'signer_custody_boundary',
  'candidate_signing_review_descriptor', 'signer_custody_readiness_advisory',
  'private_key_surface', 'signing_review_verdict', 'signing_review_suppression'
]);

export function describeSigningReviewHealthContract() {
  return Object.freeze({
    contract: 'signing-review-health',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNING_REVIEW_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    signing_review_health_state: 'SIGNING_REVIEW_HEALTH_UNCONFIGURED',
    status: 'SIGNING_REVIEW_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...signSafeFlags(),
    note: 'Read-only SIGNING-REVIEW HEALTH / STATUS. Consumes the Stage-11 signing-review input boundary (C) + signer/custody boundary (D) + candidate descriptor (E) + custody-readiness advisory (F) + private-key forbidden surface (G) + verdict (H) + suppression (I) and DERIVES STATUS ONLY. Signing-review health is a READ-ONLY ADVISORY REPRESENTATION ONLY — it is NOT signing, NOT a signature, NOT a private key, NOT key material, NOT a signing/send permission, NOT signing/trading readiness. CRITICAL: every state keeps all 24 readiness/execution/signing flags false; SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY does NOT open signer / signing / transaction / send. Ordering (Fail-Safe-Not-Fail-Open): a smuggled forbidden trading flag (top-level or any component) / secret / mainnet / REAL-LIVE / key-material / invalid input boundary (SIGNING_REVIEW_INPUT_INVALID) / invalid custody (SIGNER_CUSTODY_INVALID) / private-key-surface PRIVATE_KEY_SURFACE_BLOCKED / verdict SIGNING_REVIEW_BLOCKED -> SIGNING_REVIEW_HEALTH_BLOCKED; a missing required component -> SIGNING_REVIEW_HEALTH_UNCONFIGURED; signing_review_suppression.suppressed === true -> SIGNING_REVIEW_HEALTH_SUPPRESSED; verdict SIGNING_REVIEW_PASS_ADVISORY + not suppressed -> SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY; otherwise -> SIGNING_REVIEW_HEALTH_DEGRADED.'
  });
}

export function evaluateSigningReviewHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'SIGNING_REVIEW_HEALTH_BLOCKED'),
    signing_review_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...signSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (signUninspectable(obj, [...SIGNING_REVIEW_HEALTH_COMPONENTS])) {
      return build('SIGNING_REVIEW_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('SIGNING_REVIEW_HEALTH_UNCONFIGURED', ['no_signing_review_health_input']);
    }

    const boundary = obj.signing_review_input_boundary;
    const custody = obj.signer_custody_boundary;
    const descriptor = obj.candidate_signing_review_descriptor;
    const readiness = obj.signer_custody_readiness_advisory;
    const surface = obj.private_key_surface;
    const verdict = obj.signing_review_verdict;
    const suppression = obj.signing_review_suppression;

    // smuggled forbidden flag / secret / mainnet / REAL-LIVE / key-material on
    // top-level (excluding component slots) or any component -> BLOCKED
    const shallow = {};
    for (const [k, val] of Object.entries(obj)) {
      if (!SIGNING_REVIEW_HEALTH_COMPONENTS.includes(k)) shallow[k] = val;
    }
    let blockedBySmuggle = signScreen(shallow).length > 0 ||
      candidateSigningReviewHasForbiddenKey(shallow);
    for (const k of SIGNING_REVIEW_HEALTH_COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      if (signHasForbiddenTrueFlag(c) || signHasExecCmdKey(c) ||
          signHasEndpointOrMainnet(c) || candidateSigningReviewHasForbiddenKey(c)) {
        blockedBySmuggle = true;
      }
    }
    if (blockedBySmuggle) {
      return build('SIGNING_REVIEW_HEALTH_BLOCKED', ['forbidden_input_blocked']);
    }

    const boundaryState = signRecognizeInputBoundaryResult(boundary);
    const custodyState = signRecognizeCustodyBoundaryResult(custody);
    const surfaceState = signRecognizePrivateKeySurfaceResult(surface);
    const verdictState = signRecognizeVerdictResult(verdict);
    const suppressionVal = signRecognizeSuppressionResult(suppression);

    // hard-block: invalid boundary / invalid custody / surface blocked / verdict blocked
    if (boundaryState === 'SIGNING_REVIEW_INPUT_INVALID' ||
        custodyState === 'SIGNER_CUSTODY_INVALID' ||
        surfaceState === 'PRIVATE_KEY_SURFACE_BLOCKED' ||
        verdictState === 'SIGNING_REVIEW_BLOCKED') {
      return build('SIGNING_REVIEW_HEALTH_BLOCKED', ['signing_review_health_blocked']);
    }

    // missing required component -> UNCONFIGURED
    if (boundary == null || custody == null || descriptor == null ||
        readiness == null || surface == null || verdict == null || suppression == null ||
        boundaryState === null || custodyState === null || surfaceState === null ||
        verdictState === null || suppressionVal === null ||
        signRecognizeCandidateDescriptorResult(descriptor) === null ||
        signRecognizeCustodyReadinessResult(readiness) === null) {
      return build('SIGNING_REVIEW_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // suppression active -> SUPPRESSED
    if (suppressionVal === true) {
      return build('SIGNING_REVIEW_HEALTH_SUPPRESSED', ['signing_review_suppressed']);
    }

    // verdict pass-advisory + not suppressed -> REVIEWED_ADVISORY (opens nothing)
    if (verdictState === 'SIGNING_REVIEW_PASS_ADVISORY') {
      return build('SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY', ['signing_review_reviewed_advisory']);
    }

    // else -> DEGRADED (fail-closed)
    return build('SIGNING_REVIEW_HEALTH_DEGRADED', ['signing_review_health_degraded']);
  } catch {
    return build('SIGNING_REVIEW_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
