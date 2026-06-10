// @soltrade/send-broadcast-review-foundations
//
// Read-only / advisory ONLY SEND / BROADCAST-REVIEW FOUNDATION for Stage-12 of
// the architecture pipeline `data -> signal -> risk -> intent -> route -> sign ->
// send`. This package builds ONLY the read-only/advisory 'send-broadcast-review'
// foundation, consuming Stage-11 signing-review outputs. Import-free, pure,
// deterministic. No network primitive, no live stream, no live quote, no
// aggregator/Jupiter/RPC route call, NO real signing, NO real sending, NO real
// broadcasting, NO RPC call, NO serialized transaction, NO signature, NO message
// bytes, NO send/broadcast permission, NO SignerService activation, NO private
// key / seed / mnemonic / keypair material of any kind, no system clock, no
// persistence, no secrets, no mutable module/global state.
//
// THE CORE RULE: a send/broadcast-review / descriptor is a READ-ONLY ADVISORY
// REPRESENTATION ONLY — it DESCRIPTIVELY REVIEWS send/broadcast PREREQUISITES
// from safe metadata, derived from the Stage-11 signing-review outputs. It is NOT
// sending, NOT broadcasting, NOT an RPC call, NOT a serialized transaction, NOT a
// signature, NOT a send/broadcast permission, NOT send/broadcast readiness.
// can_send / can_broadcast / broadcast_permitted (and every other
// readiness/execution flag) ALL STAY false on every result — a send-review NEVER
// flips any readiness/execution flag. "Input valid / sender-boundary valid /
// descriptor exists" is carried ONLY by dedicated fields
// (send_review_input_boundary_valid / eligible_for_send_review /
// sender_provider_boundary_valid / candidate_send_review_valid /
// candidate_send_review_state), never by a readiness flag. Hostile, throwing, or
// uninspectable input returns a FROZEN refusal with reason
// 'input_inspection_error' and NEVER throws. Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package adds NO name to docs/01-SSOT.md. The bucket
// VALUES that happen to overlap SSOT vocabulary (helius/jito/active/disabled/
// revoked/degraded/none/low/medium/high) are CONSUMED as advisory input bucket
// values ONLY — never live provider/execution behavior. The source tags
// helius_sender_disabled / jito_sender_disabled / rpc_provider_disabled /
// disabled_sender are LOCAL disabled markers (NOT provider/RPC calls); they NEVER
// connect, send, or broadcast. Field names like endpoint / rpc_url / serialized_tx
// / signed_transaction / signature / message_bytes / private_key appear ONLY as
// fixed string literals inside refusal / forbidden-name allowlist arrays and
// prose — never as real objects, calls, or emitted output keys.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function sendSafeFlags() {
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

// the 24 non-read_only flags above (includes can_send / can_broadcast /
// broadcast_permitted) — none may EVER be true on input or output; a send-review
// NEVER flips any.
const SEND_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
]);

const SEND_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute', 'rpc_call',
  'connect_rpc', 'send_transaction', 'broadcast_transaction'
]);

const SEND_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential|signing_key|signer_secret/i;
const SEND_URL_RE = /https?:\/\/|wss?:\/\//i;
const SEND_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan (their values are
// still scanned for URL/secret/mainnet substrings). NOTE: a 'token'/'private'/
// 'seed' SECRET key NOT in this list is still flagged by name.
const SEND_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'send_review_ref', 'signing_review_ref', 'intent_record_ref',
  'idempotency_ref', 'sender_source', 'sender_mode_bucket', 'bundle_bucket',
  'tip_bucket', 'idempotency_bucket', 'intent_binding_bucket',
  'sender_status_bucket'
]);

function sendHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of SEND_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function sendHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (SEND_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function sendHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (SEND_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (SEND_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function sendHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (SEND_URL_RE.test(v) || SEND_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function sendScreen(o) {
  const r = [];
  if (sendHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (sendHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (sendHasSecretField(o)) r.push('secret_field_blocked');
  if (sendHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function sendUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// shared forbidden field NAMES — endpoint / serialization / transaction / signature
// / key material — that MUST NOT appear as a key in any send-review input or output.
// These appear ONLY as fixed string literals in this allowlist + prose — never as
// real objects, calls, or emitted output keys, and the screen NEVER echoes VALUES.
const SEND_FORBIDDEN_FIELD_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'rpc_url', 'rpc_endpoint', 'provider_url', 'node_url',
  'ws_url', 'wss_url', 'http_endpoint', 'serialized_tx', 'serialized_transaction',
  'signed_tx', 'signed_transaction', 'wire_transaction', 'raw_tx', 'raw_transaction',
  'tx_bytes', 'message_bytes', 'signature', 'signatures', 'broadcast_payload',
  'send_payload', 'private_key', 'secret_key', 'keypair', 'mnemonic', 'seed'
]);

function sendHasForbiddenSendKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (SEND_FORBIDDEN_FIELD_NAMES.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Stage-11 signing-review-output recognizers. Send-review input comes ONLY from
// Stage-11 signing-review outputs, each of which carries read_only:true. Raw
// Stage-10 tx-build / Stage-9 route / Stage-8 intent / Stage-7 risk / earlier
// objects, or a raw tx-build result, are REFUSED.
// ---------------------------------------------------------------------------

const SEND_SIGNING_REVIEW_INPUT_STATES = Object.freeze([
  'SIGNING_REVIEW_INPUT_UNCONFIGURED', 'SIGNING_REVIEW_INPUT_INVALID',
  'SIGNING_REVIEW_INPUT_DEGRADED', 'SIGNING_REVIEW_INPUT_VALID'
]);
const SEND_SIGNER_CUSTODY_STATES = Object.freeze([
  'SIGNER_CUSTODY_UNCONFIGURED', 'SIGNER_CUSTODY_INVALID',
  'SIGNER_CUSTODY_READ_ONLY_OK'
]);
const SEND_CANDIDATE_SIGNING_REVIEW_STATES = Object.freeze([
  'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED', 'CANDIDATE_SIGNING_REVIEW_INVALID',
  'CANDIDATE_SIGNING_REVIEW_REJECTED', 'CANDIDATE_SIGNING_REVIEW_DEGRADED',
  'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR'
]);
const SEND_SIGNER_CUSTODY_READINESS_STATES = Object.freeze([
  'SIGNER_CUSTODY_READINESS_UNCONFIGURED', 'SIGNER_CUSTODY_READINESS_INVALID',
  'SIGNER_CUSTODY_READINESS_DEGRADED', 'SIGNER_CUSTODY_READINESS_REJECTED',
  'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY'
]);
const SEND_PRIVATE_KEY_SURFACE_STATES = Object.freeze([
  'PRIVATE_KEY_SURFACE_UNCONFIGURED', 'PRIVATE_KEY_SURFACE_CLEAN',
  'PRIVATE_KEY_SURFACE_BLOCKED'
]);
const SEND_SIGNING_REVIEW_VERDICT_STATES = Object.freeze([
  'SIGNING_REVIEW_UNCONFIGURED', 'SIGNING_REVIEW_DEGRADED',
  'SIGNING_REVIEW_BLOCKED', 'SIGNING_REVIEW_PASS_ADVISORY'
]);
const SEND_SIGNING_REVIEW_HEALTH_STATES = Object.freeze([
  'SIGNING_REVIEW_HEALTH_UNCONFIGURED', 'SIGNING_REVIEW_HEALTH_DEGRADED',
  'SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY', 'SIGNING_REVIEW_HEALTH_SUPPRESSED',
  'SIGNING_REVIEW_HEALTH_BLOCKED'
]);

// Stage-10 tx-build state fields — an object carrying one of these (and no
// signing-review state) is a raw tx-build output, NOT a Stage-11 signing-review
// output -> refuse.
const SEND_TX_BUILD_STATE_FIELDS = Object.freeze([
  'tx_build_input_state', 'tx_build_source_state', 'candidate_tx_build_state',
  'tx_build_resource_state', 'serialization_surface_state',
  'tx_build_review_state', 'tx_build_health_state'
]);

// Stage-9 route state fields — raw route -> refuse.
const SEND_ROUTE_STATE_FIELDS = Object.freeze([
  'route_input_state', 'route_source_state', 'candidate_route_state',
  'route_feasibility_state', 'execution_plan_preview_state', 'route_health_state'
]);

// Stage-8 intent state fields — raw intent -> refuse.
const SEND_INTENT_STATE_FIELDS = Object.freeze([
  'intent_input_state', 'candidate_intent_state', 'ledger_state',
  'intent_state', 'audit_state', 'intent_health_state'
]);

// Stage-7 risk state fields — raw risk -> refuse.
const SEND_RISK_STATE_FIELDS = Object.freeze([
  'risk_input_state', 'hard_risk_state', 'liquidity_exit_state',
  'exposure_risk_state', 'risk_verdict_state', 'risk_health_state'
]);

// Stage-4 raw ingestion event types — raw events -> refuse.
const SEND_RAW_INGESTION_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed', 'token_account_change_observed',
  'swap_observed', 'mint_observed', 'pool_observed', 'balance_change_observed'
]);

// Does an object carry ANY recognized Stage-11 signing-review-layer state field?
function sendSigningReviewComponentState(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (typeof o.signing_review_input_state === 'string' && SEND_SIGNING_REVIEW_INPUT_STATES.includes(o.signing_review_input_state)) return o.signing_review_input_state;
  if (typeof o.signer_custody_state === 'string' && SEND_SIGNER_CUSTODY_STATES.includes(o.signer_custody_state)) return o.signer_custody_state;
  if (typeof o.candidate_signing_review_state === 'string' && SEND_CANDIDATE_SIGNING_REVIEW_STATES.includes(o.candidate_signing_review_state)) return o.candidate_signing_review_state;
  if (typeof o.signer_custody_readiness_state === 'string' && SEND_SIGNER_CUSTODY_READINESS_STATES.includes(o.signer_custody_readiness_state)) return o.signer_custody_readiness_state;
  if (typeof o.private_key_surface_state === 'string' && SEND_PRIVATE_KEY_SURFACE_STATES.includes(o.private_key_surface_state)) return o.private_key_surface_state;
  if (typeof o.signing_review_state === 'string' && SEND_SIGNING_REVIEW_VERDICT_STATES.includes(o.signing_review_state)) return o.signing_review_state;
  if (typeof o.signing_review_health_state === 'string' && SEND_SIGNING_REVIEW_HEALTH_STATES.includes(o.signing_review_health_state)) return o.signing_review_health_state;
  // signing-review suppression carries suppressed + suppression_reasons (no *_state enum)
  if (typeof o.suppressed === 'boolean' && Array.isArray(o.suppression_reasons)) return 'SIGNING_REVIEW_SUPPRESSION_RESULT';
  return null;
}

function sendHasSigningReviewLayerState(o) {
  return sendSigningReviewComponentState(o) !== null;
}

function sendHasAnyStateField(o, fields) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (sendHasSigningReviewLayerState(o)) return false;
  for (const f of fields) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Is the object a raw Stage-10 tx-build output (tx-build state, NO signing-review state)?
function sendIsRawTxBuild(o) {
  return sendHasAnyStateField(o, SEND_TX_BUILD_STATE_FIELDS);
}

// Is the object a raw Stage-9 route output?
function sendIsRawRoute(o) {
  return sendHasAnyStateField(o, SEND_ROUTE_STATE_FIELDS);
}

// Is the object a raw Stage-8 intent output?
function sendIsRawIntent(o) {
  return sendHasAnyStateField(o, SEND_INTENT_STATE_FIELDS);
}

// Is the object a raw Stage-7 risk output?
function sendIsRawRisk(o) {
  return sendHasAnyStateField(o, SEND_RISK_STATE_FIELDS);
}

// Is the object a raw Stage-4 ingestion event (event_type, NO signing-review state)?
function sendIsRawIngestionEvent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (sendHasSigningReviewLayerState(o)) return false;
  const et = o.event_type;
  return typeof et === 'string' && SEND_RAW_INGESTION_EVENT_TYPES.includes(et);
}

function sendIsRawNonSigningReviewInput(o) {
  return sendIsRawTxBuild(o) || sendIsRawRoute(o) || sendIsRawIntent(o) ||
    sendIsRawRisk(o) || sendIsRawIngestionEvent(o);
}

// Recognize a Stage-11 signing-review RESULT component: an inspectable read-only
// object that carries a valid signing-review-layer state and is NOT a raw
// earlier-stage/event object. Returns the recognized state string, or null.
function sendRecognizeSigningReviewComponent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (sendIsRawNonSigningReviewInput(o)) return null;
  if (o.read_only !== true) return null;
  return sendSigningReviewComponentState(o);
}

// Screen a Stage-11 RESULT object passed in a component slot.
function sendScreenComponentResult(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (sendHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (sendHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (sendHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (sendIsRawNonSigningReviewInput(c)) r.push('raw_non_signing_review_input_refused');
  return r;
}

// Recognize a Stage-11 (H) signing-review-verdict result fed forward.
function sendRecognizeSigningReviewVerdictResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.signing_review_state === 'string' && SEND_SIGNING_REVIEW_VERDICT_STATES.includes(o.signing_review_state)) {
    return o.signing_review_state;
  }
  return null;
}

// Recognize a Stage-11 (J) signing-review-health result fed forward.
function sendRecognizeSigningReviewHealthResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.signing_review_health_state === 'string' && SEND_SIGNING_REVIEW_HEALTH_STATES.includes(o.signing_review_health_state)) {
    return o.signing_review_health_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (C) SEND-REVIEW INPUT BOUNDARY
//
// Verifies that send-review input comes ONLY from Stage-11 signing-review
// outputs, never from raw tx-build / route / earlier-stage / commands. A VALID
// boundary opens NO send/broadcast/serialization/trading readiness;
// eligible_for_send_review marks the input shape only, and is NOT sending,
// broadcasting, an RPC call, a send/broadcast permission. The signing-review must
// be REVIEWED (signing_review_verdict SIGNING_REVIEW_PASS_ADVISORY +
// signing_review_health not BLOCKED/UNCONFIGURED + not suppressed by a forbidden
// surface) to be eligible; anything else -> DEGRADED / UNCONFIGURED / INVALID.
// ---------------------------------------------------------------------------

const SEND_REVIEW_INPUT_STATES = Object.freeze([
  'SEND_REVIEW_INPUT_UNCONFIGURED', 'SEND_REVIEW_INPUT_INVALID',
  'SEND_REVIEW_INPUT_DEGRADED', 'SEND_REVIEW_INPUT_VALID'
]);

const SEND_REVIEW_INPUT_COMPONENTS = Object.freeze([
  'signing_review_verdict', 'signing_review_health'
]);

export function describeSendReviewInputBoundaryContract() {
  return Object.freeze({
    contract: 'send-review-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: SEND_REVIEW_INPUT_STATES,
    advisory_only: true,
    send_review_input_state: 'SEND_REVIEW_INPUT_UNCONFIGURED',
    send_review_input_boundary_valid: false,
    eligible_for_send_review: false,
    status: 'SEND_REVIEW_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only send/broadcast-review INPUT boundary. Verifies send-review input comes ONLY from Stage-11 signing-review outputs (signing-review verdict + signing-review health), never from raw Stage-10 transaction-build, Stage-9 route, Stage-8 intent, Stage-7 risk, earlier-stage objects, a raw tx-build result, endpoints, or execution commands. A VALID boundary opens NO send/broadcast/serialization/trading readiness; eligible_for_send_review marks the input shape only, and is NOT sending, NOT broadcasting, NOT an RPC call, NOT a serialized transaction, NOT a signature, NOT a send/broadcast permission. The signing-review must be REVIEWED (signing_review_verdict SIGNING_REVIEW_PASS_ADVISORY + signing_review_health not SIGNING_REVIEW_HEALTH_BLOCKED/UNCONFIGURED + not suppressed by a forbidden surface) to be eligible; signing-review BLOCKED/missing -> fail-closed (SEND_REVIEW_INPUT_UNCONFIGURED / SEND_REVIEW_INPUT_INVALID, not eligible). Raw route/earlier/event objects or a raw tx-build result passed directly -> refused (raw_non_signing_review_input_refused) -> SEND_REVIEW_INPUT_INVALID. Smuggled trading/send/broadcast/serialize/sign flags or commands, secrets, private-key/seed material, endpoints, and mainnet/REAL-LIVE markers are refused (*_blocked) and never echoed. can_send / can_broadcast / broadcast_permitted / serialized_ready / message_bytes_ready STAY false in EVERY state.'
  });
}

export function validateSendReviewInputBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sendUninspectable(obj, ['purpose', ...SEND_REVIEW_INPUT_COMPONENTS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...sendSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_send_review_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!SEND_REVIEW_INPUT_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...sendScreen(shallow));
      for (const k of SEND_REVIEW_INPUT_COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (sendHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (sendHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (sendIsRawNonSigningReviewInput(c)) reasons.push('raw_non_signing_review_input_refused');
      }
      if (obj.purpose !== 'send_review_input_boundary') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...sendSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...sendSafeFlags()
    });
  }
}

export function evaluateSendReviewInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'SEND_REVIEW_INPUT_INVALID'),
    send_review_input_boundary_valid: (state === 'SEND_REVIEW_INPUT_VALID'),
    eligible_for_send_review: (state === 'SEND_REVIEW_INPUT_VALID'),
    send_review_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const v = validateSendReviewInputBoundary(input);
    // unrecognized / hostile -> UNCONFIGURED
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('SEND_REVIEW_INPUT_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_send_review_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / raw input / bad purpose -> INVALID
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_non_signing_review_input_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('SEND_REVIEW_INPUT_INVALID', v.reasons);
    }

    const verdict = input.signing_review_verdict;
    const health = input.signing_review_health;

    // each PRESENT component must be a recognized read-only Stage-11 signing-review
    // result; an unrecognized component (or one blocked by the component screen)
    // is not a Stage-11 signing-review output -> refuse.
    for (const c of [verdict, health]) {
      if (c == null) continue;
      if (sendScreenComponentResult(c).length > 0) {
        return build('SEND_REVIEW_INPUT_INVALID', ['raw_non_signing_review_input_refused']);
      }
      if (sendRecognizeSigningReviewComponent(c) === null) {
        return build('SEND_REVIEW_INPUT_INVALID', ['component_not_stage11_signing_review']);
      }
    }

    const verdictState = (verdict != null) ? sendRecognizeSigningReviewVerdictResult(verdict) : null;
    const healthState = (health != null) ? sendRecognizeSigningReviewHealthResult(health) : null;

    // required minimum components: signing_review_verdict + signing_review_health
    if (verdictState === null || healthState === null) {
      return build('SEND_REVIEW_INPUT_UNCONFIGURED', ['required_component_missing']);
    }

    // signing-review verdict BLOCKED OR health BLOCKED -> INVALID (fail-closed)
    if (verdictState === 'SIGNING_REVIEW_BLOCKED' || healthState === 'SIGNING_REVIEW_HEALTH_BLOCKED') {
      return build('SEND_REVIEW_INPUT_INVALID', ['signing_review_component_blocked']);
    }

    // health SUPPRESSED is the standard signing-review clean path (always-suppressed
    // suppression layer). It is acceptable here so long as the verdict passed; only a
    // forbidden-surface-blocked / unconfigured health is fail-closed.
    if (healthState === 'SIGNING_REVIEW_HEALTH_UNCONFIGURED') {
      return build('SEND_REVIEW_INPUT_UNCONFIGURED', ['signing_review_health_unconfigured']);
    }

    // verdict not PASS_ADVISORY OR health DEGRADED -> DEGRADED (not eligible, fail-closed)
    if (verdictState !== 'SIGNING_REVIEW_PASS_ADVISORY' ||
        healthState === 'SIGNING_REVIEW_HEALTH_DEGRADED') {
      const degraded = [];
      if (verdictState !== 'SIGNING_REVIEW_PASS_ADVISORY') degraded.push('signing_review_not_pass_advisory');
      if (healthState === 'SIGNING_REVIEW_HEALTH_DEGRADED') degraded.push('signing_review_health_degraded');
      return build('SEND_REVIEW_INPUT_DEGRADED', degraded.length ? degraded : ['signing_review_not_pass_advisory']);
    }

    // verdict pass-advisory + health reviewed-advisory/suppressed (not blocked/unconfigured/degraded)
    // -> VALID (eligible)
    return build('SEND_REVIEW_INPUT_VALID', []);
  } catch {
    return build('SEND_REVIEW_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-12 (C) send-review-input-boundary result fed forward.
function sendRecognizeInputBoundaryResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.send_review_input_state === 'string' && SEND_REVIEW_INPUT_STATES.includes(o.send_review_input_state)) {
    return o.send_review_input_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (D) SENDER / PROVIDER BOUNDARY
//
// The sender / provider source is a DISABLED / read-only descriptor TAG only — no
// RPC, no provider connection, no endpoint, no send, no broadcast, no network.
// helius_sender_disabled / jito_sender_disabled / rpc_provider_disabled /
// disabled_sender are accepted ONLY as disabled/read-only markers; they NEVER
// connect, send, or broadcast. Endpoint URL / api_key / secret / serialized-tx /
// signature / smuggled send/broadcast flag / mainnet/REAL-LIVE -> INVALID and
// never echoed.
// ---------------------------------------------------------------------------

const SENDER_PROVIDER_STATES = Object.freeze([
  'SENDER_PROVIDER_UNCONFIGURED', 'SENDER_PROVIDER_INVALID',
  'SENDER_PROVIDER_READ_ONLY_OK'
]);

const SENDER_PROVIDER_ALLOWED_SOURCES = Object.freeze([
  'mock_sender_metadata', 'fixture_sender_metadata', 'disabled_sender',
  'helius_sender_disabled', 'jito_sender_disabled', 'rpc_provider_disabled'
]);

const SENDER_PROVIDER_TOP_KEYS = Object.freeze(['purpose', 'sender_source']);

export function describeSenderProviderBoundaryContract() {
  return Object.freeze({
    contract: 'sender-provider-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: SENDER_PROVIDER_STATES,
    supported_sources: SENDER_PROVIDER_ALLOWED_SOURCES,
    advisory_only: true,
    sender_provider_boundary_valid: false,
    sender_provider_state: 'SENDER_PROVIDER_UNCONFIGURED',
    sender_disabled: true,
    broadcast_performed: false,
    rpc_connected: false,
    endpoint_resolved: false,
    network_call_made: false,
    status: 'SENDER_PROVIDER_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only sender / PROVIDER boundary. The sender/provider source is a DISABLED / read-only descriptor TAG only (mock_sender_metadata, fixture_sender_metadata, disabled_sender, helius_sender_disabled, jito_sender_disabled, rpc_provider_disabled) — NO endpoint, NO RPC, NO provider connection, NO send, NO broadcast, NO live call. helius_sender_disabled / jito_sender_disabled / rpc_provider_disabled / disabled_sender are accepted ONLY as disabled/read-only markers; they NEVER connect, send, or broadcast — sender_disabled STAYS true, broadcast_performed / rpc_connected / endpoint_resolved / network_call_made STAY false. The sender tags overlap SSOT provider vocabulary (helius/jito) as ADVISORY METADATA BUCKETS only, never actual provider behavior. Fail-Safe-Not-Fail-Open: missing source -> SENDER_PROVIDER_UNCONFIGURED; unknown / non-disabled / live sender tag -> SENDER_PROVIDER_INVALID; an endpoint/url field / api_key / secret / serialized-tx / signature / smuggled send/broadcast flag / mainnet / REAL-LIVE -> SENDER_PROVIDER_INVALID and NEVER echoed; a valid disabled/read-only tag -> SENDER_PROVIDER_READ_ONLY_OK. Opens NO send/broadcast/serialization/trading readiness.'
  });
}

export function validateSenderProviderBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sendUninspectable(obj, [...SENDER_PROVIDER_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...sendSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_sender_provider_input');
    } else {
      recognized = true;
      reasons.push(...sendScreen(obj));
      if (sendHasForbiddenSendKey(obj)) reasons.push('forbidden_send_field_blocked');
      if (obj.purpose !== 'sender_provider_boundary') reasons.push('purpose_invalid');
      const src = obj.sender_source;
      if (src == null) {
        reasons.push('sender_source_missing');
      } else if (typeof src !== 'string' || !SENDER_PROVIDER_ALLOWED_SOURCES.includes(src)) {
        reasons.push('sender_source_unknown');
      }
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...sendSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...sendSafeFlags()
    });
  }
}

export function evaluateSenderProviderBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'SENDER_PROVIDER_INVALID'),
    sender_provider_boundary_valid: (state === 'SENDER_PROVIDER_READ_ONLY_OK'),
    sender_provider_state: state,
    sender_disabled: true,
    broadcast_performed: false,
    rpc_connected: false,
    endpoint_resolved: false,
    network_call_made: false,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const v = validateSenderProviderBoundary(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('SENDER_PROVIDER_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_sender_provider_input']);
    }
    // missing source -> UNCONFIGURED
    if (v.reasons.includes('sender_source_missing')) {
      return build('SENDER_PROVIDER_UNCONFIGURED', ['sender_source_missing']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / bad purpose
    // / unknown source -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('forbidden_send_field_blocked') ||
        v.reasons.includes('purpose_invalid') ||
        v.reasons.includes('sender_source_unknown')) {
      return build('SENDER_PROVIDER_INVALID', v.reasons);
    }
    // a valid disabled/read-only tag -> READ_ONLY_OK
    return build('SENDER_PROVIDER_READ_ONLY_OK', ['sender_provider_read_only_ok']);
  } catch {
    return build('SENDER_PROVIDER_UNCONFIGURED', ['input_inspection_error']);
  }
}

// Recognize a Stage-12 (D) sender-provider-boundary result fed forward.
function sendRecognizeSenderProviderResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.sender_provider_state === 'string' && SENDER_PROVIDER_STATES.includes(o.sender_provider_state)) {
    return o.sender_provider_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (E) CANDIDATE SEND-REVIEW DESCRIPTOR
//
// A DESCRIPTIVE descriptor produced from safe send METADATA buckets ONLY, after a
// SEND_REVIEW_INPUT_VALID boundary + SENDER_PROVIDER_READ_ONLY_OK boundary ONLY.
// It is NOT a serialized transaction, NOT a signature, NOT a send/broadcast
// permission, NOT send/broadcast readiness. It opens NO can_send / can_broadcast /
// broadcast_permitted / serialized_ready / message_bytes_ready. NO endpoint /
// rpc_url / serialized_tx / signed_transaction / signature / message_bytes /
// private_key field ever appears in output. Fail-Safe: weak / adverse buckets ->
// REJECTED / DEGRADED.
// ---------------------------------------------------------------------------

const CANDIDATE_SEND_REVIEW_STATES = Object.freeze([
  'CANDIDATE_SEND_REVIEW_UNCONFIGURED', 'CANDIDATE_SEND_REVIEW_INVALID',
  'CANDIDATE_SEND_REVIEW_REJECTED', 'CANDIDATE_SEND_REVIEW_DEGRADED',
  'CANDIDATE_SEND_REVIEW_DESCRIPTOR'
]);

const CANDIDATE_SEND_REVIEW_REASON_CODES = Object.freeze([
  'send_review_input_valid', 'sender_provider_boundary_valid',
  'send_metadata_present', 'idempotency_unbound', 'intent_binding_unbound',
  'sender_mode_disabled', 'candidate_send_review_reviewed',
  'send_review_input_not_valid', 'sender_provider_not_valid'
]);

const CANDIDATE_SEND_REVIEW_COMPONENTS = Object.freeze([
  'send_review_input_boundary', 'sender_provider_boundary', 'send_metadata'
]);

// fields that MUST NOT appear in any candidate-send-review input or output
// (endpoint / serialization / transaction / signature / key material). These
// names appear ONLY as fixed string literals in this allowlist + prose — never as
// real objects, calls, or emitted output keys, and the screen NEVER echoes VALUES.
const CANDIDATE_SEND_REVIEW_FORBIDDEN_KEYS = Object.freeze([
  'endpoint', 'rpc_url', 'serialized_tx', 'signed_transaction', 'signature',
  'message_bytes', 'private_key', 'secret_key', 'keypair', 'mnemonic', 'seed',
  'wire_transaction', 'raw_tx', 'broadcast_payload', 'send_payload'
]);

const CANDIDATE_SEND_REVIEW_SENDER_MODE_BUCKETS = Object.freeze([
  'unknown', 'disabled', 'manual_review'
]);
const CANDIDATE_SEND_REVIEW_BUNDLE_BUCKETS = Object.freeze([
  'unknown', 'no_bundle', 'bundle_advisory'
]);
const CANDIDATE_SEND_REVIEW_TIP_BUCKETS = Object.freeze([
  'unknown', 'none', 'low', 'medium', 'high'
]);
const CANDIDATE_SEND_REVIEW_IDEMPOTENCY_BUCKETS = Object.freeze([
  'unknown', 'unbound', 'bound'
]);
const CANDIDATE_SEND_REVIEW_INTENT_BINDING_BUCKETS = Object.freeze([
  'unknown', 'unbound', 'bound'
]);

function candidateSendReviewHasForbiddenKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (CANDIDATE_SEND_REVIEW_FORBIDDEN_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

export function describeCandidateSendReviewDescriptorContract() {
  return Object.freeze({
    contract: 'candidate-send-review-descriptor',
    version: '0.0.0',
    test_only: true,
    supported_states: CANDIDATE_SEND_REVIEW_STATES,
    supported_reason_codes: CANDIDATE_SEND_REVIEW_REASON_CODES,
    advisory_only: true,
    candidate_send_review_valid: false,
    candidate_send_review_state: 'CANDIDATE_SEND_REVIEW_UNCONFIGURED',
    send_review_ref: null,
    signing_review_ref: null,
    intent_record_ref: null,
    send_review_kind: 'candidate_send_review_descriptor',
    send_review_reason_codes: Object.freeze([]),
    status: 'CANDIDATE_SEND_REVIEW_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only DESCRIPTIVE candidate send/broadcast-review descriptor produced from safe send METADATA buckets ONLY, after a Stage-12 SEND_REVIEW_INPUT_VALID boundary + SENDER_PROVIDER_READ_ONLY_OK boundary ONLY. A send-review descriptor is a READ-ONLY ADVISORY REPRESENTATION ONLY — NOT a serialized transaction, NOT a signature, NOT a send/broadcast permission, NOT send/broadcast readiness. It opens NO can_send / can_broadcast / broadcast_permitted / serialized_ready / message_bytes_ready — every readiness/execution flag STAYS false; "a candidate descriptor exists" is carried ONLY by candidate_send_review_valid / candidate_send_review_state / send_review_ref. The send metadata buckets (sender_mode_bucket {unknown, disabled, manual_review}, bundle_bucket {unknown, no_bundle, bundle_advisory}, tip_bucket {unknown, none, low, medium, high}, idempotency_bucket {unknown, unbound, bound}, intent_binding_bucket {unknown, unbound, bound}) are reviewed as ADVISORY METADATA ONLY, never actual send/broadcast behavior. NO endpoint / rpc_url / serialized_tx / signed_transaction / signature / message_bytes / private_key field ever appears in output. Fail-Safe-Not-Fail-Open: missing input -> CANDIDATE_SEND_REVIEW_UNCONFIGURED; send_review_input_boundary not SEND_REVIEW_INPUT_VALID OR sender_provider_boundary not SENDER_PROVIDER_READ_ONLY_OK -> CANDIDATE_SEND_REVIEW_REJECTED (no descriptor); send_metadata requires_broadcast / requires_network / requires_serialization / requires_signature true (or any !== false) OR a smuggled send/broadcast/serialize/key/endpoint key or forbidden flag/secret/endpoint -> CANDIDATE_SEND_REVIEW_INVALID; idempotency_bucket unbound OR intent_binding_bucket unbound -> CANDIDATE_SEND_REVIEW_REJECTED (Fail-Safe; matching reason code included); any unknown bucket -> CANDIDATE_SEND_REVIEW_DEGRADED; valid clean disabled-only metadata -> CANDIDATE_SEND_REVIEW_DESCRIPTOR. send_review_ref / signing_review_ref / intent_record_ref are caller-supplied deterministic opaque refs, never generated and never derived from a clock.'
  });
}

export function validateCandidateSendReviewDescriptorInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sendUninspectable(obj, ['purpose', ...CANDIDATE_SEND_REVIEW_COMPONENTS,
      'send_review_ref', 'signing_review_ref', 'intent_record_ref'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...sendSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_candidate_send_review_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!CANDIDATE_SEND_REVIEW_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...sendScreen(shallow));
      if (candidateSendReviewHasForbiddenKey(obj)) reasons.push('forbidden_send_field_blocked');
      // screen nested components for forbidden flags / exec cmds / forbidden keys / endpoints
      for (const k of CANDIDATE_SEND_REVIEW_COMPONENTS) {
        const c = obj[k];
        if (c == null || typeof c !== 'object') continue;
        if (sendHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (sendHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (candidateSendReviewHasForbiddenKey(c)) reasons.push('forbidden_send_field_blocked');
        if (sendHasEndpointOrMainnet(c)) reasons.push('endpoint_or_mainnet_blocked');
      }
      if (obj.purpose !== 'candidate_send_review_descriptor_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...sendSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...sendSafeFlags()
    });
  }
}

export function evaluateCandidateSendReviewDescriptor(input) {
  const build = (state, reasons, refs) => Object.freeze({
    candidate_send_review_valid: (state === 'CANDIDATE_SEND_REVIEW_DESCRIPTOR'),
    candidate_send_review_state: state,
    send_review_ref: (refs && typeof refs.send_review_ref === 'string') ? refs.send_review_ref : null,
    signing_review_ref: (refs && typeof refs.signing_review_ref === 'string') ? refs.signing_review_ref : null,
    intent_record_ref: (refs && typeof refs.intent_record_ref === 'string') ? refs.intent_record_ref : null,
    send_review_kind: 'candidate_send_review_descriptor',
    send_review_reason_codes: Object.freeze(
      [...new Set((reasons || []).filter((c) => CANDIDATE_SEND_REVIEW_REASON_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const v = validateCandidateSendReviewDescriptorInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('CANDIDATE_SEND_REVIEW_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_candidate_send_review_input'], null);
    }

    const refs = {
      send_review_ref: (typeof input.send_review_ref === 'string') ? input.send_review_ref : null,
      signing_review_ref: (typeof input.signing_review_ref === 'string') ? input.signing_review_ref : null,
      intent_record_ref: (typeof input.intent_record_ref === 'string') ? input.intent_record_ref : null
    };

    // smuggled send/broadcast/serialize/key/endpoint key or forbidden flag / exec cmd /
    // secret / endpoint / mainnet / bad purpose -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('forbidden_send_field_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('CANDIDATE_SEND_REVIEW_INVALID', ['send_metadata_invalid'], refs);
    }

    const boundary = input.send_review_input_boundary;
    const sender = input.sender_provider_boundary;
    const metadata = input.send_metadata;

    // missing required input -> UNCONFIGURED
    if (boundary == null || sender == null || metadata == null ||
        typeof metadata !== 'object' || Array.isArray(metadata)) {
      return build('CANDIDATE_SEND_REVIEW_UNCONFIGURED', ['required_input_missing'], refs);
    }

    const boundaryState = sendRecognizeInputBoundaryResult(boundary);
    const senderState = sendRecognizeSenderProviderResult(sender);

    // send_review_input_boundary not VALID -> REJECTED
    if (boundaryState !== 'SEND_REVIEW_INPUT_VALID') {
      return build('CANDIDATE_SEND_REVIEW_REJECTED', ['send_review_input_not_valid'], refs);
    }
    // sender_provider_boundary not READ_ONLY_OK -> REJECTED
    if (senderState !== 'SENDER_PROVIDER_READ_ONLY_OK') {
      return build('CANDIDATE_SEND_REVIEW_REJECTED', ['sender_provider_not_valid'], refs);
    }

    // send metadata must explicitly forbid broadcast + network + serialization + signature
    if (metadata.requires_broadcast !== false || metadata.requires_network !== false ||
        metadata.requires_serialization !== false || metadata.requires_signature !== false) {
      return build('CANDIDATE_SEND_REVIEW_INVALID', ['send_metadata_invalid'], refs);
    }

    const senderMode = metadata.sender_mode_bucket;
    const bundle = metadata.bundle_bucket;
    const tip = metadata.tip_bucket;
    const idempotency = metadata.idempotency_bucket;
    const intentBinding = metadata.intent_binding_bucket;

    // bucket values must be from the known allowlists -> else INVALID
    if (!CANDIDATE_SEND_REVIEW_SENDER_MODE_BUCKETS.includes(senderMode) ||
        !CANDIDATE_SEND_REVIEW_BUNDLE_BUCKETS.includes(bundle) ||
        !CANDIDATE_SEND_REVIEW_TIP_BUCKETS.includes(tip) ||
        !CANDIDATE_SEND_REVIEW_IDEMPOTENCY_BUCKETS.includes(idempotency) ||
        !CANDIDATE_SEND_REVIEW_INTENT_BINDING_BUCKETS.includes(intentBinding)) {
      return build('CANDIDATE_SEND_REVIEW_INVALID', ['send_metadata_invalid'], refs);
    }

    // Fail-Safe: unbound idempotency or intent binding -> REJECTED (no descriptor)
    const bad = [];
    if (idempotency === 'unbound') bad.push('idempotency_unbound');
    if (intentBinding === 'unbound') bad.push('intent_binding_unbound');
    if (bad.length > 0) {
      return build('CANDIDATE_SEND_REVIEW_REJECTED', [
        'send_review_input_valid', 'sender_provider_boundary_valid',
        'send_metadata_present', ...bad
      ], refs);
    }

    // Fail-Safe: weak/unknown metadata -> DEGRADED (no descriptor)
    if (senderMode === 'unknown' || bundle === 'unknown' || tip === 'unknown' ||
        idempotency === 'unknown' || intentBinding === 'unknown') {
      return build('CANDIDATE_SEND_REVIEW_DEGRADED', [
        'send_review_input_valid', 'sender_provider_boundary_valid',
        'send_metadata_present'
      ], refs);
    }

    // valid clean disabled-only metadata -> DESCRIPTOR
    return build('CANDIDATE_SEND_REVIEW_DESCRIPTOR', [
      'send_review_input_valid', 'sender_provider_boundary_valid',
      'send_metadata_present', 'sender_mode_disabled', 'candidate_send_review_reviewed'
    ], refs);
  } catch {
    return build('CANDIDATE_SEND_REVIEW_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// Recognize a Stage-12 (E) candidate-send-review-descriptor result fed forward.
function sendRecognizeCandidateDescriptorResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.candidate_send_review_state === 'string' && CANDIDATE_SEND_REVIEW_STATES.includes(o.candidate_send_review_state)) {
    return o.candidate_send_review_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (F) SEND-READINESS ADVISORY
//
// An ADVISORY derived from safe input METADATA BUCKETS ONLY (sender_status_bucket,
// idempotency_bucket, intent_binding_bucket, bundle_bucket, tip_bucket). It
// REVIEWS send prerequisites — it is NOT sending, NOT broadcasting, NOT an RPC
// call, NOT a send/broadcast permission, NOT send/broadcast readiness.
// ACCEPTABLE_ADVISORY opens NO can_send / can_broadcast / broadcast_permitted
// (every readiness flag STAYS false). No endpoint / serialized-tx / signature
// output field ever appears.
// ---------------------------------------------------------------------------

const SEND_READINESS_STATES = Object.freeze([
  'SEND_READINESS_UNCONFIGURED', 'SEND_READINESS_INVALID',
  'SEND_READINESS_DEGRADED', 'SEND_READINESS_REJECTED',
  'SEND_READINESS_ACCEPTABLE_ADVISORY'
]);

const SEND_READINESS_REASON_CODES = Object.freeze([
  'sender_status_unknown', 'sender_status_degraded', 'sender_live_enabled',
  'idempotency_unknown', 'idempotency_unbound', 'intent_binding_unknown',
  'intent_binding_unbound', 'bundle_unknown', 'tip_unknown',
  'send_readiness_acceptable'
]);

const SEND_READINESS_TOP_KEYS = Object.freeze([
  'purpose', 'sender_status_bucket', 'idempotency_bucket', 'intent_binding_bucket',
  'bundle_bucket', 'tip_bucket'
]);

const SEND_READINESS_SENDER_STATUS_BUCKETS = Object.freeze([
  'unknown', 'disabled', 'ready_advisory', 'degraded'
]);
const SEND_READINESS_IDEMPOTENCY_BUCKETS = CANDIDATE_SEND_REVIEW_IDEMPOTENCY_BUCKETS;
const SEND_READINESS_INTENT_BINDING_BUCKETS = CANDIDATE_SEND_REVIEW_INTENT_BINDING_BUCKETS;
const SEND_READINESS_BUNDLE_BUCKETS = CANDIDATE_SEND_REVIEW_BUNDLE_BUCKETS;
const SEND_READINESS_TIP_BUCKETS = CANDIDATE_SEND_REVIEW_TIP_BUCKETS;

export function describeSendReadinessAdvisoryContract() {
  return Object.freeze({
    contract: 'send-readiness-advisory',
    version: '0.0.0',
    test_only: true,
    supported_states: SEND_READINESS_STATES,
    supported_reason_codes: SEND_READINESS_REASON_CODES,
    advisory_only: true,
    valid: false,
    send_readiness_state: 'SEND_READINESS_UNCONFIGURED',
    send_readiness_acceptable_advisory: false,
    send_readiness_rejected: false,
    send_review_reason_codes: Object.freeze([]),
    status: 'SEND_READINESS_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only SEND-READINESS ADVISORY derived from safe input METADATA BUCKETS ONLY (sender_status_bucket {unknown, disabled, ready_advisory, degraded}, idempotency_bucket {unknown, unbound, bound}, intent_binding_bucket {unknown, unbound, bound}, bundle_bucket {unknown, no_bundle, bundle_advisory}, tip_bucket {unknown, none, low, medium, high}). It REVIEWS send prerequisites as ADVISORY METADATA ONLY, never actual send/broadcast behavior — it is NOT sending, NOT broadcasting, NOT an RPC call, NOT a send/broadcast permission, NOT send/broadcast readiness. SEND_READINESS_ACCEPTABLE_ADVISORY opens NO can_send / can_broadcast / broadcast_permitted: every readiness/execution flag STAYS false; "send acceptable" is carried ONLY by send_readiness_state / send_readiness_acceptable_advisory. NO endpoint / serialized_tx / signature output field ever appears. Fail-Safe-Not-Fail-Open: missing bucket -> SEND_READINESS_UNCONFIGURED; an invalid bucket value OR a smuggled forbidden trading flag / execution command / secret / endpoint / mainnet / send/broadcast material -> SEND_READINESS_INVALID (never echoed); a live/enabled sender (sender_status_bucket ready_advisory but with any sender_live/enabled smuggle is already blocked above) OR unbound idempotency OR unbound intent binding -> SEND_READINESS_REJECTED; any unknown bucket OR sender_status_bucket degraded (and no rejection) -> SEND_READINESS_DEGRADED; ACCEPTABLE_ADVISORY only if sender_status_bucket in {disabled, ready_advisory} AND idempotency_bucket bound AND intent_binding_bucket bound AND bundle_bucket in {no_bundle, bundle_advisory} AND tip_bucket in {none, low, medium, high}. Reason codes from a fixed allowlist contain NO send/broadcast/serialize/signature artifact tokens.'
  });
}

export function validateSendReadinessAdvisoryInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sendUninspectable(obj, [...SEND_READINESS_TOP_KEYS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...sendSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_send_readiness_input');
    } else {
      recognized = true;
      reasons.push(...sendScreen(obj));
      if (candidateSendReviewHasForbiddenKey(obj)) reasons.push('forbidden_send_field_blocked');
      if (obj.purpose !== 'send_readiness_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...sendSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...sendSafeFlags()
    });
  }
}

export function evaluateSendReadinessAdvisory(input) {
  const build = (state, reasonCodes, reasons) => Object.freeze({
    valid: (state !== 'SEND_READINESS_INVALID'),
    send_readiness_state: state,
    send_readiness_acceptable_advisory: (state === 'SEND_READINESS_ACCEPTABLE_ADVISORY'),
    send_readiness_rejected: (state === 'SEND_READINESS_REJECTED'),
    send_review_reason_codes: Object.freeze(
      [...new Set((reasonCodes || []).filter((c) => SEND_READINESS_REASON_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || reasonCodes || [])]),
    read_only: true,
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const v = validateSendReadinessAdvisoryInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('SEND_READINESS_UNCONFIGURED', [],
        v.reasons.length ? v.reasons : ['no_send_readiness_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / send-material /
    // bad purpose -> INVALID (never echoed)
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('forbidden_send_field_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('SEND_READINESS_INVALID', [], ['send_readiness_invalid']);
    }

    const senderStatus = input.sender_status_bucket;
    const idempotency = input.idempotency_bucket;
    const intentBinding = input.intent_binding_bucket;
    const bundle = input.bundle_bucket;
    const tip = input.tip_bucket;

    // missing bucket -> UNCONFIGURED
    if (senderStatus == null || idempotency == null || intentBinding == null ||
        bundle == null || tip == null) {
      return build('SEND_READINESS_UNCONFIGURED', [], ['required_bucket_missing']);
    }

    // invalid enum value -> INVALID
    if (!SEND_READINESS_SENDER_STATUS_BUCKETS.includes(senderStatus) ||
        !SEND_READINESS_IDEMPOTENCY_BUCKETS.includes(idempotency) ||
        !SEND_READINESS_INTENT_BINDING_BUCKETS.includes(intentBinding) ||
        !SEND_READINESS_BUNDLE_BUCKETS.includes(bundle) ||
        !SEND_READINESS_TIP_BUCKETS.includes(tip)) {
      return build('SEND_READINESS_INVALID', [], ['send_readiness_invalid']);
    }

    // Fail-Safe: unbound idempotency / intent binding -> REJECTED (live/enabled sender
    // is already blocked above as a smuggled exec/flag; a bare bucket value cannot be
    // 'enabled' since the bucket allowlist has no live value)
    const rej = [];
    if (idempotency === 'unbound') rej.push('idempotency_unbound');
    if (intentBinding === 'unbound') rej.push('intent_binding_unbound');
    if (rej.length > 0) {
      return build('SEND_READINESS_REJECTED', rej, rej);
    }

    // DEGRADED: any unknown bucket OR sender_status degraded (and no rejection)
    const deg = [];
    if (senderStatus === 'unknown') deg.push('sender_status_unknown');
    if (idempotency === 'unknown') deg.push('idempotency_unknown');
    if (intentBinding === 'unknown') deg.push('intent_binding_unknown');
    if (bundle === 'unknown') deg.push('bundle_unknown');
    if (tip === 'unknown') deg.push('tip_unknown');
    if (senderStatus === 'degraded') deg.push('sender_status_degraded');
    if (deg.length > 0) {
      return build('SEND_READINESS_DEGRADED', deg, deg);
    }

    // ACCEPTABLE_ADVISORY only on the strict positive combination (disabled or
    // ready_advisory sender, bound idempotency + intent binding, known bundle + tip)
    if ((senderStatus === 'disabled' || senderStatus === 'ready_advisory') &&
        idempotency === 'bound' && intentBinding === 'bound' &&
        (bundle === 'no_bundle' || bundle === 'bundle_advisory') &&
        (tip === 'none' || tip === 'low' || tip === 'medium' || tip === 'high')) {
      return build('SEND_READINESS_ACCEPTABLE_ADVISORY',
        ['send_readiness_acceptable'], ['send_readiness_acceptable']);
    }

    // anything else is not acceptable -> DEGRADED
    return build('SEND_READINESS_DEGRADED', [], ['send_readiness_not_acceptable']);
  } catch {
    return build('SEND_READINESS_UNCONFIGURED', [], ['input_inspection_error']);
  }
}

// Recognize a Stage-12 (F) send-readiness-advisory result fed forward.
function sendRecognizeReadinessResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.send_readiness_state === 'string' && SEND_READINESS_STATES.includes(o.send_readiness_state)) {
    return o.send_readiness_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (G) BROADCAST / LIVE FORBIDDEN SURFACE GUARD
//
// Proves Stage-12 neither produces nor accepts endpoint / serialized-transaction /
// signature / broadcast-payload material. Detects forbidden field NAMES (top-level
// keys only) and reports a REDACTED forbidden_field_ref (the matched NAME only) —
// NEVER the field VALUE. The detection booleans (live_surface_detected /
// broadcast_material_detected / forbidden_field_detected) are DETECTION outputs
// (true == found == BLOCKED == the SAFE blocked state); they are NOT
// readiness/exec flags.
// ---------------------------------------------------------------------------

const BROADCAST_SURFACE_STATES = Object.freeze([
  'BROADCAST_SURFACE_UNCONFIGURED', 'BROADCAST_SURFACE_CLEAN',
  'BROADCAST_SURFACE_BLOCKED'
]);

// forbidden field NAMES (case-sensitive + camelCase variants). These appear ONLY
// as fixed string literals in this allowlist + prose — never as real objects,
// calls, or emitted output keys; the guard NEVER echoes their VALUES.
const BROADCAST_FORBIDDEN_FIELD_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'endpointUrl', 'rpc_url', 'rpcUrl', 'rpc_endpoint',
  'provider_url', 'providerUrl', 'node_url', 'nodeUrl', 'ws_url', 'wss_url',
  'http_endpoint', 'serialized_tx', 'serializedTx', 'serialized_transaction',
  'signed_tx', 'signedTransaction', 'signed_transaction', 'wire_transaction',
  'raw_tx', 'raw_transaction', 'tx_bytes', 'message_bytes', 'signature',
  'signatures', 'broadcast_payload', 'send_payload'
]);

// transaction / signature / payload-shaped NAMES (vs endpoint-only NAMES). A
// transaction/signature/payload match sets forbidden_field_detected +
// live_surface_detected + broadcast_material_detected. An endpoint-only match sets
// forbidden_field_detected + live_surface_detected but NOT broadcast_material_detected.
const BROADCAST_MATERIAL_NAMES = Object.freeze([
  'serialized_tx', 'serializedTx', 'serialized_transaction', 'signed_tx',
  'signedTransaction', 'signed_transaction', 'wire_transaction', 'raw_tx',
  'raw_transaction', 'tx_bytes', 'message_bytes', 'signature', 'signatures',
  'broadcast_payload', 'send_payload'
]);

export function describeBroadcastForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'broadcast-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    supported_states: BROADCAST_SURFACE_STATES,
    forbidden_field_names: BROADCAST_FORBIDDEN_FIELD_NAMES,
    advisory_only: true,
    broadcast_surface_state: 'BROADCAST_SURFACE_UNCONFIGURED',
    live_surface_detected: false,
    broadcast_material_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'BROADCAST_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only BROADCAST / LIVE FORBIDDEN SURFACE GUARD. Proves Stage-12 neither produces nor accepts endpoint / serialized-transaction / signature / broadcast-payload material. It scans ONLY top-level keys (deterministic, bounded, pure) for forbidden field NAMES (endpoint, endpoint_url, endpointUrl, rpc_url, rpcUrl, rpc_endpoint, provider_url, providerUrl, node_url, nodeUrl, ws_url, wss_url, http_endpoint, serialized_tx, serializedTx, serialized_transaction, signed_tx, signedTransaction, signed_transaction, wire_transaction, raw_tx, raw_transaction, tx_bytes, message_bytes, signature, signatures, broadcast_payload, send_payload). The detection booleans live_surface_detected / broadcast_material_detected / forbidden_field_detected are DETECTION outputs (true == a forbidden field was found == the SAFE BLOCKED state); they are NOT readiness/execution flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing / hostile input -> BROADCAST_SURFACE_UNCONFIGURED (frozen, never throws); a clean descriptor with NONE of the forbidden field names present -> BROADCAST_SURFACE_CLEAN (all detection booleans false); ANY forbidden field name present at top level -> BROADCAST_SURFACE_BLOCKED (live_surface_detected:true, forbidden_field_detected:true, broadcast_material_detected:true for a transaction/signature/payload-shaped name and false for an endpoint-only name, forbidden_field_ref = the matched NAME). A BLOCKED result keeps all 24 readiness/execution flags false. Opens NO send/broadcast/serialization.'
  });
}

export function evaluateBroadcastForbiddenSurface(input) {
  const build = (state, detected, ref, reasons) => Object.freeze({
    broadcast_surface_state: state,
    live_surface_detected: (state === 'BROADCAST_SURFACE_BLOCKED'),
    broadcast_material_detected: (state === 'BROADCAST_SURFACE_BLOCKED') ? (detected === 'material') : false,
    forbidden_field_detected: (state === 'BROADCAST_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'BROADCAST_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sendUninspectable(obj, [...BROADCAST_FORBIDDEN_FIELD_NAMES])) {
      return build('BROADCAST_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    if (!obj) {
      return build('BROADCAST_SURFACE_UNCONFIGURED', null, null, ['no_broadcast_surface_input']);
    }
    let keys;
    try {
      keys = Object.keys(obj);
    } catch {
      return build('BROADCAST_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    // scan top-level keys only; first matched NAME (deterministic order) wins
    for (const k of keys) {
      if (BROADCAST_FORBIDDEN_FIELD_NAMES.includes(k)) {
        const kind = BROADCAST_MATERIAL_NAMES.includes(k) ? 'material' : 'endpoint';
        // forbidden_field_ref = the matched NAME only (REDACTED); NEVER the VALUE
        return build('BROADCAST_SURFACE_BLOCKED', kind, k,
          [kind === 'material' ? 'broadcast_material_detected' : 'live_endpoint_detected']);
      }
    }
    return build('BROADCAST_SURFACE_CLEAN', null, null, ['broadcast_surface_clean']);
  } catch {
    return build('BROADCAST_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// Recognize a Stage-12 (G) broadcast-surface result fed forward.
function sendRecognizeBroadcastSurfaceResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.broadcast_surface_state === 'string' && BROADCAST_SURFACE_STATES.includes(o.broadcast_surface_state)) {
    return o.broadcast_surface_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (H) SEND-REVIEW VERDICT
//
// Aggregates input boundary (C) + sender/provider boundary (D) + candidate
// descriptor (E) + send-readiness advisory (F) + broadcast surface (G) into an
// advisory verdict. A PASS is ADVISORY ONLY — even SEND_REVIEW_PASS_ADVISORY opens
// NO can_send / can_broadcast / broadcast_permitted (every readiness/execution
// flag STAYS false).
// ---------------------------------------------------------------------------

const SEND_REVIEW_VERDICT_STATES = Object.freeze([
  'SEND_REVIEW_UNCONFIGURED', 'SEND_REVIEW_DEGRADED',
  'SEND_REVIEW_BLOCKED', 'SEND_REVIEW_PASS_ADVISORY'
]);

const SEND_REVIEW_VERDICT_REASON_CODES = Object.freeze([
  'send_review_input_valid', 'sender_provider_read_only_ok',
  'candidate_send_review_descriptor_present', 'send_readiness_acceptable',
  'broadcast_surface_clean', 'send_review_input_not_valid',
  'sender_provider_not_valid', 'candidate_descriptor_not_present',
  'send_readiness_rejected', 'broadcast_surface_blocked',
  'component_invalid', 'component_missing', 'send_readiness_degraded',
  'candidate_descriptor_degraded', 'forbidden_input_blocked'
]);

const SEND_REVIEW_VERDICT_EXPLANATION_CODES = Object.freeze([
  'all_prerequisites_reviewed_advisory', 'input_boundary_reviewed',
  'sender_provider_reviewed', 'candidate_descriptor_reviewed',
  'send_readiness_reviewed', 'broadcast_surface_reviewed',
  'review_blocked_fail_closed', 'review_degraded_fail_closed',
  'review_unconfigured'
]);

const SEND_REVIEW_VERDICT_COMPONENTS = Object.freeze([
  'send_review_input_boundary', 'sender_provider_boundary',
  'candidate_send_review_descriptor', 'send_readiness_advisory',
  'broadcast_surface'
]);

export function describeSendReviewVerdictContract() {
  return Object.freeze({
    contract: 'send-review-verdict',
    version: '0.0.0',
    test_only: true,
    supported_states: SEND_REVIEW_VERDICT_STATES,
    supported_reason_codes: SEND_REVIEW_VERDICT_REASON_CODES,
    supported_explanation_codes: SEND_REVIEW_VERDICT_EXPLANATION_CODES,
    advisory_only: true,
    valid: false,
    send_review_state: 'SEND_REVIEW_UNCONFIGURED',
    send_review_passed_advisory: false,
    send_review_blocked: false,
    send_review_reason_codes: Object.freeze([]),
    send_review_explanation_codes: Object.freeze([]),
    status: 'SEND_REVIEW_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only SEND/BROADCAST-REVIEW VERDICT. Aggregates the Stage-12 send-review input boundary (C) + sender/provider boundary (D) + candidate send-review descriptor (E) + send-readiness advisory (F) + broadcast forbidden surface (G) into an ADVISORY verdict. A send-review verdict is a READ-ONLY ADVISORY REPRESENTATION ONLY — it REVIEWS send/broadcast PREREQUISITES; it is NOT sending, NOT broadcasting, NOT an RPC call, NOT a serialized transaction, NOT a signature, NOT a send/broadcast permission, NOT send/broadcast readiness. CRITICAL: even SEND_REVIEW_PASS_ADVISORY opens NO can_send / can_broadcast / broadcast_permitted — every readiness/execution flag STAYS false; "review passed" is carried ONLY by send_review_state / send_review_passed_advisory. Ordering (Fail-Safe-Not-Fail-Open): a smuggled forbidden trading flag / execution command / secret / endpoint / mainnet / broadcast-material on the top level or any component OR broadcast_surface BROADCAST_SURFACE_BLOCKED -> SEND_REVIEW_BLOCKED; any component *_INVALID OR input boundary not SEND_REVIEW_INPUT_VALID OR sender/provider not SENDER_PROVIDER_READ_ONLY_OK OR descriptor not CANDIDATE_SEND_REVIEW_DESCRIPTOR OR send-readiness SEND_READINESS_REJECTED -> SEND_REVIEW_BLOCKED; any of the 5 components missing -> SEND_REVIEW_UNCONFIGURED; send-readiness DEGRADED OR descriptor DEGRADED -> SEND_REVIEW_DEGRADED; all clean (input VALID + sender READ_ONLY_OK + descriptor DESCRIPTOR + readiness ACCEPTABLE_ADVISORY + broadcast-surface CLEAN) -> SEND_REVIEW_PASS_ADVISORY. Reason / explanation codes come from fixed allowlists and contain NO send/broadcast/serialize/signature artifact tokens.'
  });
}

export function evaluateSendReviewVerdict(input) {
  const build = (state, reasonCodes, explanationCodes, reasons) => Object.freeze({
    valid: (state !== 'SEND_REVIEW_BLOCKED'),
    send_review_state: state,
    send_review_passed_advisory: (state === 'SEND_REVIEW_PASS_ADVISORY'),
    send_review_blocked: (state === 'SEND_REVIEW_BLOCKED'),
    send_review_reason_codes: Object.freeze(
      [...new Set((reasonCodes || []).filter((c) => SEND_REVIEW_VERDICT_REASON_CODES.includes(c)))]
    ),
    send_review_explanation_codes: Object.freeze(
      [...new Set((explanationCodes || []).filter((c) => SEND_REVIEW_VERDICT_EXPLANATION_CODES.includes(c)))]
    ),
    status: state,
    reasons: Object.freeze([...new Set(reasons || reasonCodes || [])]),
    read_only: true,
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sendUninspectable(obj, ['purpose', ...SEND_REVIEW_VERDICT_COMPONENTS])) {
      return build('SEND_REVIEW_UNCONFIGURED', [], ['review_unconfigured'], ['input_inspection_error']);
    }
    if (!obj) {
      return build('SEND_REVIEW_UNCONFIGURED', [], ['review_unconfigured'], ['no_send_review_verdict_input']);
    }

    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet on top-level
    // (excluding component slots) or any component -> BLOCKED
    const shallow = {};
    for (const [k, val] of Object.entries(obj)) {
      if (!SEND_REVIEW_VERDICT_COMPONENTS.includes(k)) shallow[k] = val;
    }
    let blockedBySmuggle = sendScreen(shallow).length > 0 ||
      candidateSendReviewHasForbiddenKey(shallow);
    for (const k of SEND_REVIEW_VERDICT_COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      if (sendHasForbiddenTrueFlag(c) || sendHasExecCmdKey(c) ||
          sendHasEndpointOrMainnet(c) || candidateSendReviewHasForbiddenKey(c)) {
        blockedBySmuggle = true;
      }
    }
    if (blockedBySmuggle) {
      return build('SEND_REVIEW_BLOCKED', ['forbidden_input_blocked'],
        ['review_blocked_fail_closed'], ['forbidden_input_blocked']);
    }

    const boundary = obj.send_review_input_boundary;
    const sender = obj.sender_provider_boundary;
    const descriptor = obj.candidate_send_review_descriptor;
    const readiness = obj.send_readiness_advisory;
    const surface = obj.broadcast_surface;

    const boundaryState = sendRecognizeInputBoundaryResult(boundary);
    const senderState = sendRecognizeSenderProviderResult(sender);
    const descriptorState = sendRecognizeCandidateDescriptorResult(descriptor);
    const readinessState = sendRecognizeReadinessResult(readiness);
    const surfaceState = sendRecognizeBroadcastSurfaceResult(surface);

    // broadcast surface BLOCKED OR any component *_INVALID OR input not VALID OR
    // sender not READ_ONLY_OK OR descriptor not DESCRIPTOR OR readiness REJECTED -> BLOCKED
    if (surfaceState === 'BROADCAST_SURFACE_BLOCKED') {
      return build('SEND_REVIEW_BLOCKED', ['broadcast_surface_blocked'],
        ['review_blocked_fail_closed'], ['broadcast_surface_blocked']);
    }
    if (boundaryState === 'SEND_REVIEW_INPUT_INVALID' ||
        senderState === 'SENDER_PROVIDER_INVALID' ||
        descriptorState === 'CANDIDATE_SEND_REVIEW_INVALID' ||
        readinessState === 'SEND_READINESS_INVALID') {
      return build('SEND_REVIEW_BLOCKED', ['component_invalid'],
        ['review_blocked_fail_closed'], ['component_invalid']);
    }

    // missing any of the 5 components -> UNCONFIGURED
    if (boundary == null || sender == null || descriptor == null ||
        readiness == null || surface == null ||
        boundaryState === null || senderState === null || descriptorState === null ||
        readinessState === null || surfaceState === null) {
      return build('SEND_REVIEW_UNCONFIGURED', ['component_missing'],
        ['review_unconfigured'], ['component_missing']);
    }

    // hard-block conditions
    const blockReasons = [];
    if (boundaryState !== 'SEND_REVIEW_INPUT_VALID') blockReasons.push('send_review_input_not_valid');
    if (senderState !== 'SENDER_PROVIDER_READ_ONLY_OK') blockReasons.push('sender_provider_not_valid');
    if (descriptorState !== 'CANDIDATE_SEND_REVIEW_DESCRIPTOR' &&
        descriptorState !== 'CANDIDATE_SEND_REVIEW_DEGRADED') {
      blockReasons.push('candidate_descriptor_not_present');
    }
    if (readinessState === 'SEND_READINESS_REJECTED') blockReasons.push('send_readiness_rejected');
    if (blockReasons.length > 0) {
      return build('SEND_REVIEW_BLOCKED', blockReasons,
        ['review_blocked_fail_closed'], blockReasons);
    }

    // DEGRADED: send-readiness DEGRADED OR descriptor DEGRADED
    const degReasons = [];
    if (readinessState === 'SEND_READINESS_DEGRADED') degReasons.push('send_readiness_degraded');
    if (descriptorState === 'CANDIDATE_SEND_REVIEW_DEGRADED') degReasons.push('candidate_descriptor_degraded');
    if (degReasons.length > 0) {
      return build('SEND_REVIEW_DEGRADED', degReasons,
        ['review_degraded_fail_closed'], degReasons);
    }

    // all clean -> PASS_ADVISORY (advisory only; opens nothing)
    if (boundaryState === 'SEND_REVIEW_INPUT_VALID' &&
        senderState === 'SENDER_PROVIDER_READ_ONLY_OK' &&
        descriptorState === 'CANDIDATE_SEND_REVIEW_DESCRIPTOR' &&
        readinessState === 'SEND_READINESS_ACCEPTABLE_ADVISORY' &&
        surfaceState === 'BROADCAST_SURFACE_CLEAN') {
      return build('SEND_REVIEW_PASS_ADVISORY', [
        'send_review_input_valid', 'sender_provider_read_only_ok',
        'candidate_send_review_descriptor_present', 'send_readiness_acceptable',
        'broadcast_surface_clean'
      ], ['all_prerequisites_reviewed_advisory', 'input_boundary_reviewed',
        'sender_provider_reviewed', 'candidate_descriptor_reviewed',
        'send_readiness_reviewed', 'broadcast_surface_reviewed'],
        ['send_review_pass_advisory']);
    }

    // any remaining gap -> DEGRADED (fail-closed)
    return build('SEND_REVIEW_DEGRADED', ['send_readiness_degraded'],
      ['review_degraded_fail_closed'], ['send_review_not_pass_advisory']);
  } catch {
    return build('SEND_REVIEW_UNCONFIGURED', [], ['review_unconfigured'], ['input_inspection_error']);
  }
}

// Recognize a Stage-12 (H) send-review-verdict result fed forward.
function sendRecognizeVerdictResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.send_review_state === 'string' && SEND_REVIEW_VERDICT_STATES.includes(o.send_review_state)) {
    return o.send_review_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (I) SEND-REVIEW SUPPRESSION / REJECTION
//
// Prevents progression; reasons only. Creates NO send, NO broadcast. A send-review
// is NEVER send / broadcast / execution authorized at this layer, so the
// not_*_authorized reasons are ALWAYS emitted. Suppression opens NO can_send /
// can_broadcast / broadcast_permitted.
// ---------------------------------------------------------------------------

const SEND_REVIEW_SUPPRESSION_REASON_CODES = Object.freeze([
  'input_not_reviewed', 'sender_provider_invalid', 'sender_metadata_missing',
  'sender_not_ready', 'idempotency_unbound', 'live_surface_detected',
  'broadcast_material_detected', 'not_send_authorized', 'not_broadcast_authorized',
  'not_execution_authorized'
]);

const SEND_REVIEW_SUPPRESSION_ALWAYS = Object.freeze([
  'not_send_authorized', 'not_broadcast_authorized', 'not_execution_authorized'
]);

const SEND_REVIEW_SUPPRESSION_COMPONENTS = Object.freeze([
  'send_review_input_boundary', 'candidate_send_review_descriptor',
  'send_readiness_advisory', 'broadcast_surface', 'sender_provider_boundary'
]);

export function describeSendReviewSuppressionContract() {
  return Object.freeze({
    contract: 'send-review-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: SEND_REVIEW_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: false,
    suppression_reasons: Object.freeze([]),
    status: 'SEND_REVIEW_SUPPRESSION_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only SEND/BROADCAST-REVIEW SUPPRESSION / REJECTION. Prevents progression and reports REASONS ONLY — it creates NO send, NO broadcast, NO RPC call, NO serialized transaction, NO signature. A send-review is NEVER send / broadcast / execution authorized at this layer, so not_send_authorized + not_broadcast_authorized + not_execution_authorized are ALWAYS included whenever a result is emitted — even an advisory-clean send-review is STILL suppressed for send/broadcast. Suppression opens NO can_send / can_broadcast / broadcast_permitted — every readiness/execution flag STAYS false. Rules (Fail-Safe-Not-Fail-Open): send_review_input_boundary not SEND_REVIEW_INPUT_VALID -> suppressed + input_not_reviewed; sender_provider_boundary not SENDER_PROVIDER_READ_ONLY_OK -> suppressed + sender_provider_invalid; missing candidate_send_review_descriptor / send metadata -> suppressed + sender_metadata_missing; send_readiness_advisory SEND_READINESS_REJECTED -> suppressed + sender_not_ready (+ idempotency_unbound where derivable); broadcast_surface BROADCAST_SURFACE_BLOCKED -> suppressed + live_surface_detected (+ broadcast_material_detected when the matched ref is a transaction/signature/payload name). Reason codes come from a fixed allowlist.'
  });
}

export function evaluateSendReviewSuppression(input) {
  const build = (suppressed, reasonCodes) => {
    const codes = [...new Set([...(reasonCodes || []), ...SEND_REVIEW_SUPPRESSION_ALWAYS])]
      .filter((c) => SEND_REVIEW_SUPPRESSION_REASON_CODES.includes(c));
    const state = suppressed ? 'SEND_REVIEW_SUPPRESSED' : 'SEND_REVIEW_NOT_SUPPRESSED';
    return Object.freeze({
      suppressed: suppressed === true,
      suppression_reasons: Object.freeze(codes),
      status: state,
      reasons: Object.freeze(codes),
      read_only: true,
      advisory_only: true,
      ...sendSafeFlags()
    });
  };
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sendUninspectable(obj, ['purpose', ...SEND_REVIEW_SUPPRESSION_COMPONENTS])) {
      // hostile -> suppressed fail-closed (always carries not_*_authorized)
      return build(true, []);
    }
    if (!obj) {
      return build(true, []);
    }

    const boundary = obj.send_review_input_boundary;
    const descriptor = obj.candidate_send_review_descriptor;
    const readiness = obj.send_readiness_advisory;
    const surface = obj.broadcast_surface;
    const sender = obj.sender_provider_boundary;

    const codes = [];

    // input boundary not VALID -> input_not_reviewed
    if (boundary != null) {
      const bs = sendRecognizeInputBoundaryResult(boundary);
      if (bs !== 'SEND_REVIEW_INPUT_VALID') codes.push('input_not_reviewed');
    } else {
      codes.push('input_not_reviewed');
    }

    // sender provider not READ_ONLY_OK -> sender_provider_invalid
    if (sender != null) {
      const cs = sendRecognizeSenderProviderResult(sender);
      if (cs !== 'SENDER_PROVIDER_READ_ONLY_OK') codes.push('sender_provider_invalid');
    }

    // missing descriptor / metadata -> sender_metadata_missing
    if (descriptor == null) {
      codes.push('sender_metadata_missing');
    } else {
      const ds = sendRecognizeCandidateDescriptorResult(descriptor);
      if (ds !== 'CANDIDATE_SEND_REVIEW_DESCRIPTOR') codes.push('sender_metadata_missing');
    }

    // send-readiness REJECTED -> sender_not_ready (+ idempotency_unbound)
    if (readiness != null) {
      const rs = sendRecognizeReadinessResult(readiness);
      if (rs === 'SEND_READINESS_REJECTED') {
        codes.push('sender_not_ready');
        const rc = Array.isArray(readiness.send_review_reason_codes) ? readiness.send_review_reason_codes : [];
        if (rc.includes('idempotency_unbound')) codes.push('idempotency_unbound');
      } else if (rs !== 'SEND_READINESS_ACCEPTABLE_ADVISORY') {
        codes.push('sender_not_ready');
      }
    }

    // broadcast surface BLOCKED -> live_surface_detected (+ broadcast_material_detected)
    if (surface != null) {
      const ss = sendRecognizeBroadcastSurfaceResult(surface);
      if (ss === 'BROADCAST_SURFACE_BLOCKED') {
        codes.push('live_surface_detected');
        if (surface.broadcast_material_detected === true) {
          codes.push('broadcast_material_detected');
        }
      }
    }

    // suppression is ALWAYS active for send/broadcast at this layer (not_*_authorized
    // always added); a result is emitted whenever input is recognized -> suppressed.
    return build(true, codes);
  } catch {
    return build(true, []);
  }
}

// Recognize a Stage-12 (I) send-review-suppression result fed forward.
function sendRecognizeSuppressionResult(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.suppressed === 'boolean' && Array.isArray(o.suppression_reasons)) {
    return o.suppressed;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (J) SEND-REVIEW HEALTH / STATUS
//
// Consumes input boundary (C) + sender/provider boundary (D) + descriptor (E) +
// send-readiness advisory (F) + broadcast surface (G) + verdict (H) + suppression
// (I); derives status only. Because the suppression layer is ALWAYS
// suppressed:true, the standard clean path resolves to SEND_REVIEW_HEALTH_SUPPRESSED;
// SEND_REVIEW_HEALTH_REVIEWED_ADVISORY is reachable ONLY with an explicit
// not-suppressed object and STILL opens nothing — every readiness/execution flag
// STAYS false on EVERY state.
// ---------------------------------------------------------------------------

const SEND_REVIEW_HEALTH_STATES = Object.freeze([
  'SEND_REVIEW_HEALTH_UNCONFIGURED', 'SEND_REVIEW_HEALTH_DEGRADED',
  'SEND_REVIEW_HEALTH_REVIEWED_ADVISORY', 'SEND_REVIEW_HEALTH_SUPPRESSED',
  'SEND_REVIEW_HEALTH_BLOCKED'
]);

const SEND_REVIEW_HEALTH_COMPONENTS = Object.freeze([
  'send_review_input_boundary', 'sender_provider_boundary',
  'candidate_send_review_descriptor', 'send_readiness_advisory',
  'broadcast_surface', 'send_review_verdict', 'send_review_suppression'
]);

export function describeSendReviewHealthContract() {
  return Object.freeze({
    contract: 'send-review-health',
    version: '0.0.0',
    test_only: true,
    supported_states: SEND_REVIEW_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    send_review_health_state: 'SEND_REVIEW_HEALTH_UNCONFIGURED',
    status: 'SEND_REVIEW_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only SEND/BROADCAST-REVIEW HEALTH / STATUS. Consumes the Stage-12 send-review input boundary (C) + sender/provider boundary (D) + candidate descriptor (E) + send-readiness advisory (F) + broadcast forbidden surface (G) + verdict (H) + suppression (I) and DERIVES STATUS ONLY. Send-review health is a READ-ONLY ADVISORY REPRESENTATION ONLY — it is NOT sending, NOT broadcasting, NOT an RPC call, NOT a serialized transaction, NOT a signature, NOT a send/broadcast permission, NOT send/broadcast readiness. CRITICAL: every state keeps all 24 readiness/execution flags false; SEND_REVIEW_HEALTH_REVIEWED_ADVISORY does NOT open send / broadcast. Because the suppression layer is ALWAYS suppressed:true, the standard clean path resolves to SEND_REVIEW_HEALTH_SUPPRESSED; SEND_REVIEW_HEALTH_REVIEWED_ADVISORY is reachable ONLY with an explicit not-suppressed object. Ordering (Fail-Safe-Not-Fail-Open): a smuggled forbidden trading flag (top-level or any component) / secret / mainnet / REAL-LIVE / broadcast-material / invalid input boundary (SEND_REVIEW_INPUT_INVALID) / invalid sender (SENDER_PROVIDER_INVALID) / broadcast-surface BROADCAST_SURFACE_BLOCKED / verdict SEND_REVIEW_BLOCKED -> SEND_REVIEW_HEALTH_BLOCKED; a missing required component -> SEND_REVIEW_HEALTH_UNCONFIGURED; send_review_suppression.suppressed === true -> SEND_REVIEW_HEALTH_SUPPRESSED; verdict SEND_REVIEW_PASS_ADVISORY + not suppressed -> SEND_REVIEW_HEALTH_REVIEWED_ADVISORY; otherwise -> SEND_REVIEW_HEALTH_DEGRADED.'
  });
}

export function evaluateSendReviewHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'SEND_REVIEW_HEALTH_BLOCKED'),
    send_review_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (sendUninspectable(obj, [...SEND_REVIEW_HEALTH_COMPONENTS])) {
      return build('SEND_REVIEW_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('SEND_REVIEW_HEALTH_UNCONFIGURED', ['no_send_review_health_input']);
    }

    const boundary = obj.send_review_input_boundary;
    const sender = obj.sender_provider_boundary;
    const descriptor = obj.candidate_send_review_descriptor;
    const readiness = obj.send_readiness_advisory;
    const surface = obj.broadcast_surface;
    const verdict = obj.send_review_verdict;
    const suppression = obj.send_review_suppression;

    // smuggled forbidden flag / secret / mainnet / REAL-LIVE / broadcast-material on
    // top-level (excluding component slots) or any component -> BLOCKED
    const shallow = {};
    for (const [k, val] of Object.entries(obj)) {
      if (!SEND_REVIEW_HEALTH_COMPONENTS.includes(k)) shallow[k] = val;
    }
    let blockedBySmuggle = sendScreen(shallow).length > 0 ||
      candidateSendReviewHasForbiddenKey(shallow);
    for (const k of SEND_REVIEW_HEALTH_COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      if (sendHasForbiddenTrueFlag(c) || sendHasExecCmdKey(c) ||
          sendHasEndpointOrMainnet(c) || candidateSendReviewHasForbiddenKey(c)) {
        blockedBySmuggle = true;
      }
    }
    if (blockedBySmuggle) {
      return build('SEND_REVIEW_HEALTH_BLOCKED', ['forbidden_input_blocked']);
    }

    const boundaryState = sendRecognizeInputBoundaryResult(boundary);
    const senderState = sendRecognizeSenderProviderResult(sender);
    const surfaceState = sendRecognizeBroadcastSurfaceResult(surface);
    const verdictState = sendRecognizeVerdictResult(verdict);
    const suppressionVal = sendRecognizeSuppressionResult(suppression);

    // hard-block: invalid boundary / invalid sender / surface blocked / verdict blocked
    if (boundaryState === 'SEND_REVIEW_INPUT_INVALID' ||
        senderState === 'SENDER_PROVIDER_INVALID' ||
        surfaceState === 'BROADCAST_SURFACE_BLOCKED' ||
        verdictState === 'SEND_REVIEW_BLOCKED') {
      return build('SEND_REVIEW_HEALTH_BLOCKED', ['send_review_health_blocked']);
    }

    // missing required component -> UNCONFIGURED
    if (boundary == null || sender == null || descriptor == null ||
        readiness == null || surface == null || verdict == null || suppression == null ||
        boundaryState === null || senderState === null || surfaceState === null ||
        verdictState === null || suppressionVal === null ||
        sendRecognizeCandidateDescriptorResult(descriptor) === null ||
        sendRecognizeReadinessResult(readiness) === null) {
      return build('SEND_REVIEW_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // suppression active -> SUPPRESSED
    if (suppressionVal === true) {
      return build('SEND_REVIEW_HEALTH_SUPPRESSED', ['send_review_suppressed']);
    }

    // verdict pass-advisory + not suppressed -> REVIEWED_ADVISORY (opens nothing)
    if (verdictState === 'SEND_REVIEW_PASS_ADVISORY') {
      return build('SEND_REVIEW_HEALTH_REVIEWED_ADVISORY', ['send_review_reviewed_advisory']);
    }

    // else -> DEGRADED (fail-closed)
    return build('SEND_REVIEW_HEALTH_DEGRADED', ['send_review_health_degraded']);
  } catch {
    return build('SEND_REVIEW_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
