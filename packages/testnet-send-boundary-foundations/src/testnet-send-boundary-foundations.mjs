// @soltrade/testnet-send-boundary-foundations
//
// Read-only / advisory ONLY TESTNET-SEND BOUNDARY foundation for Stage-21 — the
// Testnet/Devnet Execution SEAM opener. This package builds everything UP TO the
// testnet-broadcast activation seam and NOTHING past it, exactly mirroring the
// Stage-17 live-stream boundary: a fail-closed testnet-send INPUT boundary, a
// NEVER-READY testnet-ACTIVATION SEAM DESCRIPTOR (describes what a real testnet
// broadcast WOULD require; NEVER activates and NEVER claims readiness), an
// idempotency guard READ-MODEL, a failed-send / bundle-status descriptor pair, a
// suppression that ALWAYS suppresses, a forbidden-surface NAME-only guard, and a
// health aggregator. Import-free, pure, deterministic. NO network primitive, NO
// fetch / XMLHttpRequest / WebSocket / Connection / sendTransaction /
// sendRawTransaction / sendAndConfirmTransaction / .serialize() / socket / grpc,
// NO Solana / Jupiter / Helius / Jito / http-client / db import, NO signing /
// crypto primitive, NO signature produced, NO clock, NO RNG, NO environment
// access, NO filesystem access, NO secrets, NO mutable module/global state. A
// real send adapter is a SEPARATE future owner governance decision and is
// explicitly NOT part of Stage 21 — which is why
// TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION is hardcoded met:false and
// send_ready_advisory / can_send can NEVER be true in this package.
//
// THE CORE RULE: this package carries NO live primitive. The default (no injected
// out-of-repo broadcast caller) is fail-closed: NO send. can_send / can_broadcast
// stay FIXED false on every path. Sign-only/send separation is STRUCTURAL: this
// package imports NO signing/crypto primitive and produces NO signature — it
// CONSUMES only a Stage-19 signature DESCRIPTOR (presence/shape, opaque) and
// NEVER re-signs. Secrets travel BY REFERENCE only (an opaque endpoint_ref);
// raw key / endpoint / url / api_key are refused and never echoed (NAME-only
// redaction). MAINNET HARD-REFUSAL: any mainnet / mainnet-beta / prod indicator
// in any field/value (including nested one level) -> refuse; the cluster must be
// an explicit devnet|testnet|localnet enum tag; a default/missing tag -> refuse.
// Hostile, throwing, or uninspectable input returns a FROZEN refusal and NEVER
// throws. Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package adds NO name to docs/01-SSOT.md. The LOCAL
// TESTNET_* / testnet_* tokens are local. SSOT Group 3 failure_type values
// (SlippageExceeded / BlockhashExpired / AccountInUse / ComputeBudgetExceeded /
// InsufficientFunds / RouteInvalid / TokenAccountMissing / ProgramError /
// RPCDropped / BundleFailed / Unknown) and bundle_status values (Pending /
// Failed / Landed / Invalid / STALE_BUNDLE) are CONSUMED ONLY by VALUE — never
// emitted as new SSOT names and never given new candidate_* names. Field names
// like api_key / bearer / token / private_key / endpoint / url appear ONLY as
// fixed string literals inside refusal / forbidden-NAME allowlist arrays and
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

// the 24 non-read_only flags above — none may EVER be true on input or output; a
// testnet-send boundary descriptor NEVER flips any readiness/execution flag.
const TESTNET_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
]);

// Execution-command KEY names refused on any input. The forbidden opportunity /
// batch-exit / send command vocabulary appears here ONLY as fixed refusal
// literals — this package never generates or executes any of them.
const TESTNET_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute', 'connect',
  'open_stream', 'start_stream', 'subscribe_live', 'activate', 'activate_live',
  'enable_live', 'resolve_endpoint', 'activate_testnet', 'enable_testnet',
  'send_testnet', 'broadcast_testnet', 're_sign', 'resign', 'sign_again',
  'buy_opportunity', 'execute_opportunity', 'submit_opportunity',
  'exit_all_positions', 'batch_exit_all_positions'
]);

// Credential-NAME scan (NAME-only redaction: a matched NAME blocks; the VALUE is
// never read into any reason or output).
const TESTNET_CREDENTIAL_KEY_RE = /secret|api[_-]?key|apikey|bearer|access[_-]?token|auth[_-]?token|\btoken\b|private|seed|mnemonic|keypair|raw_key|credential|password|signing_key|provider_key|provider_secret/i;

// URL / endpoint marker inside string VALUES (scheme://) + mainnet marker.
const TESTNET_URL_RE = /[a-z][a-z0-9+.-]*:\/\//i;
// A POSITIVE mainnet indicator: `mainnet` / `mainnet-beta` / `prod` as a token,
// but NOT our own NEGATIVE / DESCRIPTIVE vocabulary — `no_mainnet`,
// `mainnet_detected`, `mainnet_enabled`, `TESTNET_REQ_NO_MAINNET`. A real mainnet
// smuggle uses the bare cluster token; our own tokens negate or describe it. The
// negative-lookbehind excludes a `no_`/`no-`/`not_` prefix, and the
// negative-lookahead excludes a `_detected`/`_enabled`/`_refused` suffix.
const TESTNET_MAINNET_RE = /(?<![a-z_-])(?:mainnet-beta|mainnet|prod)(?!_(?:detected|enabled|refused))/i;

// raw-credential VALUE shapes (PEM block marker / long base58 blob). The value
// itself is never echoed — only a fixed reason code is emitted.
const TESTNET_PEM_RE = /-----BEGIN/;
const TESTNET_BASE58_BLOB_RE = /\b[1-9A-HJ-NP-Za-km-z]{64,}\b/;

// opaque-reference / known field NAMES exempt from the credential-NAME scan.
// endpoint_ref is the single sanctioned BY-REFERENCE name (its VALUE is still
// shape-checked and never echoed); intent_id / cluster_tag / prior_send_records
// are domain fields whose names must not trip the credential scan.
const TESTNET_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'endpoint_ref', 'endpoint_ref_present', 'cluster_tag', 'intent_id',
  'prior_send_records', 'signing_result', 'send_review', 'failure_indicator',
  'failure_type', 'bundle_status', 'ttl_slots', 'observed_slot', 'submitted_slot',
  'testnet_send_input', 'testnet_activation_seam', 'testnet_send_idempotency',
  'testnet_failed_send_class', 'testnet_bundle_status', 'testnet_send_suppression',
  'testnet_forbidden_surface', 'testnet_send_health'
]);

// TOCTOU defense: read every own enumerable property EXACTLY ONCE via a single
// shallow spread; ALL later screening and evaluation walks the SAME snapshot, so
// a hostile counting getter cannot serve clean values to the screen and dirty
// values to the classifier. A getter that throws during the spread is caught by
// the caller and fails closed.
function snapshot(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  return { ...o };
}

// a snapshot carrying function-valued fields is uninspectable -> fail closed.
function hasFunctionValue(snap) {
  if (snap == null) return false;
  for (const v of Object.values(snap)) {
    if (typeof v === 'function') return true;
  }
  return false;
}

function hasForbiddenTrueFlag(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const f of TESTNET_FORBIDDEN_TRUE_FLAGS) {
    if (snap[f] === true) return true;
  }
  return false;
}

function hasExecCmdKey(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const k of Object.keys(snap)) {
    if (TESTNET_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function hasCredentialFieldName(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const k of Object.keys(snap)) {
    if (TESTNET_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (TESTNET_CREDENTIAL_KEY_RE.test(String(k))) return true;
  }
  return false;
}

// scan string VALUES (one level deep, into nested plain objects and arrays of
// plain objects) for endpoint/credential/mainnet markers. Values are never
// echoed — only a fixed reason code is emitted.
function valueIsDirty(v) {
  if (typeof v !== 'string') return false;
  if (TESTNET_URL_RE.test(v)) return true;
  if (TESTNET_MAINNET_RE.test(v)) return true;
  if (TESTNET_PEM_RE.test(v)) return true;
  if (TESTNET_BASE58_BLOB_RE.test(v)) return true;
  return false;
}

function hasEndpointOrCredentialValue(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const v of Object.values(snap)) {
    if (valueIsDirty(v)) return true;
  }
  return false;
}

// MAINNET HARD-REFUSAL scan: any mainnet / mainnet-beta / prod token in a KEY or
// string VALUE, including one nested level (plain objects + arrays of plain
// objects). Conservative by design (over-refusal is fail-safe).
function hasMainnetTokenShallow(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const k of Object.keys(snap)) {
    // the own safe-flag key `mainnet_enabled` (always false) is NOT a mainnet
    // indicator — it is independently asserted false; skip the known safe flags
    // so a fed-forward result's safe-flag KEYS do not false-positive.
    if (TESTNET_FORBIDDEN_TRUE_FLAGS.includes(k)) continue;
    if (TESTNET_MAINNET_RE.test(String(k))) return true;
  }
  for (const v of Object.values(snap)) {
    if (typeof v === 'string' && TESTNET_MAINNET_RE.test(v)) return true;
  }
  return false;
}

function hasMainnetTokenNested(value) {
  if (value == null) return false;
  if (typeof value === 'string') return TESTNET_MAINNET_RE.test(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && TESTNET_MAINNET_RE.test(item)) return true;
      if (item != null && typeof item === 'object' && !Array.isArray(item)) {
        if (hasMainnetTokenShallow(item)) return true;
      }
    }
    return false;
  }
  if (typeof value === 'object') return hasMainnetTokenShallow(value);
  return false;
}

// top-level + one-nested-level mainnet scan over a snapshot.
function snapshotHasMainnet(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  if (hasMainnetTokenShallow(snap)) return true;
  for (const v of Object.values(snap)) {
    if (v != null && typeof v === 'object') {
      if (hasMainnetTokenNested(v)) return true;
    }
  }
  return false;
}

// shared screen over a SNAPSHOT. Reasons are fixed codes; no value is echoed.
// MAINNET is its own dedicated reason (mainnet_refused) so the boundary can map
// it to the hard-refusal state.
function screen(snap) {
  const r = [];
  if (snapshotHasMainnet(snap)) r.push('mainnet_refused');
  if (hasForbiddenTrueFlag(snap)) r.push('forbidden_testnet_indicator_blocked');
  if (hasExecCmdKey(snap)) r.push('execution_command_blocked');
  if (hasCredentialFieldName(snap)) r.push('credential_field_blocked');
  if (hasEndpointOrCredentialValue(snap)) r.push('endpoint_or_credential_value_blocked');
  return r;
}

const SCREEN_REASONS = Object.freeze([
  'mainnet_refused', 'forbidden_testnet_indicator_blocked',
  'execution_command_blocked', 'credential_field_blocked',
  'endpoint_or_credential_value_blocked'
]);

function screenedInvalid(reasons) {
  return reasons.some((x) => SCREEN_REASONS.includes(x));
}

// the explicit testnet cluster enum tags (an explicit devnet|testnet|localnet
// tag is REQUIRED; default/missing -> refuse).
const TESTNET_CLUSTER_TAGS = Object.freeze(['devnet', 'testnet', 'localnet']);

const ENDPOINT_REF_MAX_LENGTH = 128;

// is the sanctioned opaque endpoint_ref secret/endpoint-shaped? (NAME-only
// redaction: the caller never echoes the value; only a fixed reason code is
// emitted.) A valid endpoint_ref is an opaque SHORT token (refuse ://,
// whitespace, >128 chars, base58-blob / PEM shape).
function endpointRefSecretShaped(ref) {
  if (typeof ref !== 'string') return true;
  if (ref.length === 0 || ref.length > ENDPOINT_REF_MAX_LENGTH) return true;
  if (ref.indexOf('://') !== -1) return true;
  if (/\s/.test(ref)) return true;
  if (TESTNET_PEM_RE.test(ref)) return true;
  if (/^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(ref)) return true;
  if (TESTNET_BASE58_BLOB_RE.test(ref)) return true;
  if (TESTNET_MAINNET_RE.test(ref)) return true;
  return false;
}

// Recognize a Stage-19 sign-only result by SHAPE (opaque): { signed:true,
// signature:<non-empty string>, can_send:false, mode:'sign_only' }. The signature
// VALUE is NEVER re-signed, NEVER echoed, NEVER produced here — only its
// presence/shape is read.
function isSignOnlyShaped(snap) {
  if (snap == null || typeof snap !== 'object' || Array.isArray(snap)) return false;
  if (snap.signed !== true) return false;
  if (typeof snap.signature !== 'string' || snap.signature.length === 0) return false;
  if (snap.can_send !== false) return false;
  if (snap.mode !== 'sign_only') return false;
  return true;
}

// Recognize a Stage-12 send-review PASS_ADVISORY result by its verdict state.
function isSendReviewPassAdvisory(snap) {
  if (snap == null || typeof snap !== 'object' || Array.isArray(snap)) return false;
  return snap.send_review_state === 'SEND_REVIEW_PASS_ADVISORY';
}

// ---------------------------------------------------------------------------
// (A) TESTNET-SEND INPUT BOUNDARY
//
// Verifies the inputs needed for a (still-suppressed) testnet send come ONLY
// from: a Stage-19 sign-only-SHAPED signing_result (opaque; never re-signed), a
// Stage-12 SEND_REVIEW_PASS_ADVISORY send_review, an explicit testnet cluster
// enum tag, and an intent_id. eligible_for_testnet_send is true ONLY when all
// four hold. MAINNET HARD-REFUSAL dominates everything. A VALID boundary opens
// NOTHING: can_send / can_broadcast stay FIXED false.
// ---------------------------------------------------------------------------

const TESTNET_SEND_INPUT_STATES = Object.freeze([
  'TESTNET_SEND_INPUT_UNCONFIGURED', 'TESTNET_SEND_INPUT_INVALID',
  'TESTNET_SEND_INPUT_DEGRADED', 'TESTNET_SEND_INPUT_VALID'
]);

export function describeTestnetSendInputBoundaryContract() {
  return Object.freeze({
    contract: 'testnet-send-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: TESTNET_SEND_INPUT_STATES,
    supported_cluster_tags: TESTNET_CLUSTER_TAGS,
    advisory_only: true,
    testnet_send_input_state: 'TESTNET_SEND_INPUT_UNCONFIGURED',
    eligible_for_testnet_send: false,
    cluster_tag: null,
    status: 'TESTNET_SEND_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only TESTNET-SEND INPUT BOUNDARY (Stage-21). Verifies the inputs needed for a (still-suppressed) testnet send come ONLY from a Stage-19 sign-only-SHAPED signing_result ({ signed:true, signature:<string>, can_send:false, mode:\'sign_only\' } — opaque, NEVER re-signed, never echoed), a Stage-12 SEND_REVIEW_PASS_ADVISORY send_review, an explicit testnet cluster enum tag (devnet | testnet | localnet), and an intent_id (string). eligible_for_testnet_send is true ONLY when ALL FOUR hold — and it is NOT a send permission, NOT a broadcast permission, NOT execution authority: can_send / can_broadcast / broadcast_permitted STAY false in EVERY state. MAINNET HARD-REFUSAL: any mainnet / mainnet-beta / prod token anywhere (including nested one level), in a KEY or VALUE -> TESTNET_SEND_INPUT_INVALID mainnet_refused. A default / missing / unknown cluster tag -> refuse (not a testnet enum). Fail-Safe-Not-Fail-Open: missing input -> TESTNET_SEND_INPUT_UNCONFIGURED; smuggled execution command / raw key / endpoint / url / api_key field NAME or value, forbidden true flag, or wrong purpose -> TESTNET_SEND_INPUT_INVALID (offending VALUE NEVER echoed, NAME-only redaction); a recognized shape with a non-PASS_ADVISORY review or a non-sign-only signing_result -> TESTNET_SEND_INPUT_DEGRADED (not eligible); all four present and clean -> TESTNET_SEND_INPUT_VALID. The endpoint_ref, when supplied, is an opaque BY-REFERENCE token shape-checked here (refused when it contains ://, whitespace, is longer than 128 chars, or matches a base58-blob / PEM / mainnet shape) and its value is NEVER echoed.'
  });
}

export function evaluateTestnetSendInputBoundary(input) {
  const build = (state, reasons, clusterTag) => Object.freeze({
    valid: (state !== 'TESTNET_SEND_INPUT_INVALID'),
    testnet_send_input_state: state,
    eligible_for_testnet_send: (state === 'TESTNET_SEND_INPUT_VALID'),
    cluster_tag: (state === 'TESTNET_SEND_INPUT_VALID' && typeof clusterTag === 'string') ? clusterTag : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('TESTNET_SEND_INPUT_UNCONFIGURED', ['no_testnet_send_input'], null);
    }
    if (hasFunctionValue(snap)) {
      return build('TESTNET_SEND_INPUT_UNCONFIGURED', ['input_inspection_error'], null);
    }

    // screen the top level minus component slots (those are snapshot+screened
    // separately so a nested credential/mainnet is still caught).
    const shallow = {};
    for (const [k, v] of Object.entries(snap)) {
      if (k === 'signing_result' || k === 'send_review') continue;
      shallow[k] = v;
    }
    const reasons = screen(shallow);
    if (snap.purpose !== 'testnet_send_input') reasons.push('purpose_invalid');

    // snapshot-once each consumed component, then screen the SAME snapshot.
    let signingSnap = null;
    let reviewSnap = null;
    try {
      signingSnap = snapshot(snap.signing_result);
      reviewSnap = snapshot(snap.send_review);
    } catch {
      return build('TESTNET_SEND_INPUT_UNCONFIGURED', ['input_inspection_error'], null);
    }
    for (const c of [signingSnap, reviewSnap]) {
      if (c == null) continue;
      if (hasFunctionValue(c)) {
        return build('TESTNET_SEND_INPUT_UNCONFIGURED', ['input_inspection_error'], null);
      }
      if (snapshotHasMainnet(c)) reasons.push('mainnet_refused');
      if (hasForbiddenTrueFlag(c)) reasons.push('forbidden_testnet_indicator_blocked');
      if (hasExecCmdKey(c)) reasons.push('execution_command_blocked');
      if (hasEndpointOrCredentialValue(c)) reasons.push('endpoint_or_credential_value_blocked');
    }

    // MAINNET HARD-REFUSAL dominates: even before anything else, a mainnet token
    // anywhere -> INVALID mainnet_refused.
    if (reasons.includes('mainnet_refused')) {
      return build('TESTNET_SEND_INPUT_INVALID', ['mainnet_refused'], null);
    }
    if (screenedInvalid(reasons) || reasons.includes('purpose_invalid')) {
      return build('TESTNET_SEND_INPUT_INVALID', reasons, null);
    }

    // optional endpoint_ref: opaque BY-REFERENCE token only, never secret-shaped.
    if (snap.endpoint_ref !== undefined && snap.endpoint_ref !== null) {
      if (endpointRefSecretShaped(snap.endpoint_ref)) {
        return build('TESTNET_SEND_INPUT_INVALID', ['endpoint_ref_secret_shaped'], null);
      }
    }

    // required components present?
    if (snap.signing_result == null || snap.send_review == null ||
        snap.cluster_tag == null || snap.intent_id == null) {
      return build('TESTNET_SEND_INPUT_UNCONFIGURED', ['required_input_missing'], null);
    }

    // cluster_tag must be an explicit testnet enum (default/missing/unknown -> refuse).
    const clusterTag = snap.cluster_tag;
    if (typeof clusterTag !== 'string' || !TESTNET_CLUSTER_TAGS.includes(clusterTag)) {
      return build('TESTNET_SEND_INPUT_INVALID', ['cluster_tag_not_testnet_enum'], null);
    }

    // intent_id must be a non-empty string.
    if (typeof snap.intent_id !== 'string' || snap.intent_id.length === 0) {
      return build('TESTNET_SEND_INPUT_INVALID', ['intent_id_invalid'], null);
    }

    // signing_result must be sign-only-SHAPED (opaque); send_review must be PASS_ADVISORY.
    const signOk = isSignOnlyShaped(signingSnap);
    const reviewOk = isSendReviewPassAdvisory(reviewSnap);
    if (!signOk || !reviewOk) {
      const degraded = [];
      if (!signOk) degraded.push('signing_result_not_sign_only');
      if (!reviewOk) degraded.push('send_review_not_pass_advisory');
      return build('TESTNET_SEND_INPUT_DEGRADED', degraded, null);
    }

    return build('TESTNET_SEND_INPUT_VALID', ['testnet_send_input_valid'], clusterTag);
  } catch {
    return build('TESTNET_SEND_INPUT_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// Recognize an (A) testnet-send-input-boundary result fed forward (from a SNAPSHOT).
function recognizeInputBoundaryResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.testnet_send_input_state === 'string' && TESTNET_SEND_INPUT_STATES.includes(snap.testnet_send_input_state)) {
    return snap.testnet_send_input_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (B) TESTNET-ACTIVATION SEAM DESCRIPTOR — the CORE never-ready seam.
//
// A READ-MODEL that DESCRIBES what a real testnet broadcast WOULD require,
// without activating anything. activation_performed:false and
// send_ready_advisory:false are FIXED LITERALS on every state.
// TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION is HARDCODED met:false, so
// the seam can NEVER be ready in-package — even across ALL met-combinations of
// the other requirements. Opens nothing.
// ---------------------------------------------------------------------------

const TESTNET_SEAM_STATES = Object.freeze([
  'TESTNET_SEAM_UNCONFIGURED', 'TESTNET_SEAM_INVALID', 'TESTNET_SEAM_DESCRIPTOR'
]);

const TESTNET_SEAM_REQUIREMENT_TOKENS = Object.freeze([
  'TESTNET_REQ_OWNER_RPC_ENDPOINT_REF', 'TESTNET_REQ_FUNDED_TESTNET_WALLET',
  'TESTNET_REQ_OUT_OF_REPO_BROADCAST_CALLER',
  'TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION',
  'TESTNET_REQ_TESTNET_CLUSTER_TAG', 'TESTNET_REQ_NO_MAINNET'
]);

// what the owner must supply OUT-OF-REPO before any real testnet broadcast — a
// frozen, documentary list. The repo holds NONE of these.
const TESTNET_REQUIRED_OWNER_INPUTS = Object.freeze([
  'owner_supplied_testnet_rpc_endpoint_ref_out_of_repo',
  'owner_funded_testnet_wallet_out_of_repo',
  'owner_provided_out_of_repo_broadcast_caller',
  'separate_send_adapter_allowlist_governance_decision'
]);

function testnetSeamRequirements(rpcRefMet, fundedMet, callerMet, clusterMet, noMainnetMet) {
  return Object.freeze([
    Object.freeze({ requirement: 'TESTNET_REQ_OWNER_RPC_ENDPOINT_REF', met: rpcRefMet === true }),
    Object.freeze({ requirement: 'TESTNET_REQ_FUNDED_TESTNET_WALLET', met: fundedMet === true }),
    Object.freeze({ requirement: 'TESTNET_REQ_OUT_OF_REPO_BROADCAST_CALLER', met: callerMet === true }),
    // HARDCODED met:false — a real send adapter is a SEPARATE future owner
    // governance/allowlist decision and does NOT exist in this package; the seam
    // can never claim this requirement, so it can never be ready in-package.
    Object.freeze({ requirement: 'TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION', met: false }),
    Object.freeze({ requirement: 'TESTNET_REQ_TESTNET_CLUSTER_TAG', met: clusterMet === true }),
    Object.freeze({ requirement: 'TESTNET_REQ_NO_MAINNET', met: noMainnetMet === true })
  ]);
}

export function describeTestnetActivationSeamContract() {
  return Object.freeze({
    contract: 'testnet-activation-seam',
    version: '0.0.0',
    test_only: true,
    supported_states: TESTNET_SEAM_STATES,
    supported_requirement_tokens: TESTNET_SEAM_REQUIREMENT_TOKENS,
    required_owner_inputs: TESTNET_REQUIRED_OWNER_INPUTS,
    advisory_only: true,
    testnet_seam_state: 'TESTNET_SEAM_UNCONFIGURED',
    activation_performed: false,
    send_ready_advisory: false,
    seam_requirements: testnetSeamRequirements(false, false, false, false, false),
    endpoint_in_repo: false,
    key_in_repo: false,
    secret_in_repo: false,
    status: 'TESTNET_SEAM_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only TESTNET-ACTIVATION SEAM DESCRIPTOR — the CORE never-ready seam of Stage-21. A READ-MODEL that DESCRIBES what a real testnet broadcast WOULD require, without activating anything: activation_performed and send_ready_advisory are FIXED LITERALS false on EVERY state, and endpoint_in_repo / key_in_repo / secret_in_repo are FIXED false. seam_requirements is a frozen array of LOCAL requirement tokens with met:boolean each (TESTNET_REQ_OWNER_RPC_ENDPOINT_REF, TESTNET_REQ_FUNDED_TESTNET_WALLET, TESTNET_REQ_OUT_OF_REPO_BROADCAST_CALLER, TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION, TESTNET_REQ_TESTNET_CLUSTER_TAG, TESTNET_REQ_NO_MAINNET). TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION is HARDCODED met:false in this package because a real send adapter is a SEPARATE future owner governance / allowlist decision that does NOT exist here — therefore send_ready_advisory is ALWAYS false here, false WHENEVER any requirement is unmet and ALWAYS false while the adapter-allowlist requirement is unmet across ALL met-combinations of the others: the descriptor can NEVER claim readiness it cannot have (mirrors Stage-17 LIVE_REQ_SEPARATE_ADAPTER_REVIEW). required_owner_inputs documents exactly what the owner must supply OUT-OF-REPO (a testnet RPC endpoint as an opaque endpoint_ref, a funded testnet wallet, an out-of-repo broadcast caller, and the separate send-adapter allowlist governance decision); the repo holds NONE of them. Inputs: testnet_send_input must be a TESTNET_SEND_INPUT_VALID result (-> cluster tag + no-mainnet requirements derived); endpoint_ref_present / owner_broadcast_caller_present / funded_testnet_wallet_present are booleans (BY REFERENCE / presence only — no endpoint, key, wallet, or secret value ever appears). MAINNET HARD-REFUSAL: any mainnet / mainnet-beta / prod token anywhere (incl. nested) -> TESTNET_SEAM_INVALID mainnet_refused. Fail-Safe-Not-Fail-Open: missing input / missing boundary / boundary not VALID -> TESTNET_SEAM_UNCONFIGURED; smuggled credential / endpoint / execution material or wrong purpose -> TESTNET_SEAM_INVALID (values never echoed). The seam OPENS NOTHING and grants no execution authority.'
  });
}

export function evaluateTestnetActivationSeam(input) {
  const build = (state, reasons, req, refsPresent) => Object.freeze({
    valid: (state !== 'TESTNET_SEAM_INVALID'),
    testnet_seam_state: state,
    // FIXED LITERALS: this descriptor never activates anything and can never be ready.
    activation_performed: false,
    send_ready_advisory: false,
    seam_requirements: req || testnetSeamRequirements(false, false, false, false, false),
    endpoint_in_repo: false,
    key_in_repo: false,
    secret_in_repo: false,
    endpoint_ref_present: (refsPresent && refsPresent.endpoint === true),
    owner_broadcast_caller_present: (refsPresent && refsPresent.caller === true),
    funded_testnet_wallet_present: (refsPresent && refsPresent.funded === true),
    required_owner_inputs: TESTNET_REQUIRED_OWNER_INPUTS,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('TESTNET_SEAM_UNCONFIGURED', ['no_testnet_seam_input'], null, null);
    }
    if (hasFunctionValue(snap)) {
      return build('TESTNET_SEAM_UNCONFIGURED', ['input_inspection_error'], null, null);
    }

    const shallow = {};
    for (const [k, v] of Object.entries(snap)) {
      if (k === 'testnet_send_input') continue;
      shallow[k] = v;
    }
    const reasons = screen(shallow);
    if (snap.purpose !== 'testnet_activation_seam') reasons.push('purpose_invalid');

    let boundarySnap = null;
    try {
      boundarySnap = snapshot(snap.testnet_send_input);
    } catch {
      return build('TESTNET_SEAM_UNCONFIGURED', ['input_inspection_error'], null, null);
    }
    if (boundarySnap != null) {
      if (hasFunctionValue(boundarySnap)) {
        return build('TESTNET_SEAM_UNCONFIGURED', ['input_inspection_error'], null, null);
      }
      if (snapshotHasMainnet(boundarySnap)) reasons.push('mainnet_refused');
      if (hasForbiddenTrueFlag(boundarySnap)) reasons.push('forbidden_testnet_indicator_blocked');
      if (hasExecCmdKey(boundarySnap)) reasons.push('execution_command_blocked');
      if (hasEndpointOrCredentialValue(boundarySnap)) reasons.push('endpoint_or_credential_value_blocked');
    }

    if (reasons.includes('mainnet_refused')) {
      return build('TESTNET_SEAM_INVALID', ['mainnet_refused'], null, null);
    }
    if (screenedInvalid(reasons) || reasons.includes('purpose_invalid')) {
      return build('TESTNET_SEAM_INVALID', reasons, null, null);
    }

    // presence-only references (BY REFERENCE — no value validated or echoed).
    const checkBool = (v, code) => {
      if (v !== undefined && v !== null && typeof v !== 'boolean') return code;
      return null;
    };
    const e1 = checkBool(snap.endpoint_ref_present, 'endpoint_ref_present_invalid');
    const e2 = checkBool(snap.owner_broadcast_caller_present, 'owner_broadcast_caller_present_invalid');
    const e3 = checkBool(snap.funded_testnet_wallet_present, 'funded_testnet_wallet_present_invalid');
    for (const e of [e1, e2, e3]) {
      if (e) return build('TESTNET_SEAM_INVALID', [e], null, null);
    }
    const refsPresent = {
      endpoint: (snap.endpoint_ref_present === true),
      caller: (snap.owner_broadcast_caller_present === true),
      funded: (snap.funded_testnet_wallet_present === true)
    };

    // testnet_send_input: must be a recognized (A) result that is VALID.
    if (snap.testnet_send_input == null) {
      return build('TESTNET_SEAM_UNCONFIGURED', ['testnet_send_input_missing'],
        testnetSeamRequirements(refsPresent.endpoint, refsPresent.funded, refsPresent.caller, false, true),
        refsPresent);
    }
    const boundaryState = recognizeInputBoundaryResult(boundarySnap);
    if (boundaryState === null) {
      return build('TESTNET_SEAM_INVALID', ['component_not_testnet_send_input'], null, null);
    }
    if (boundaryState === 'TESTNET_SEND_INPUT_INVALID') {
      return build('TESTNET_SEAM_INVALID', ['testnet_send_input_invalid'], null, null);
    }
    if (boundaryState !== 'TESTNET_SEND_INPUT_VALID') {
      return build('TESTNET_SEAM_UNCONFIGURED', ['testnet_send_input_not_valid'],
        testnetSeamRequirements(refsPresent.endpoint, refsPresent.funded, refsPresent.caller, false, true),
        refsPresent);
    }

    // a VALID boundary -> cluster tag + no-mainnet requirements are met; the
    // adapter-allowlist requirement is STILL hardcoded false, so the descriptor
    // can never be ready.
    const req = testnetSeamRequirements(refsPresent.endpoint, refsPresent.funded, refsPresent.caller, true, true);
    const unmet = req.filter((x) => x.met !== true).map((x) => x.requirement);
    return build('TESTNET_SEAM_DESCRIPTOR',
      ['testnet_seam_descriptor_only', ...unmet.map((t) => 'unmet_' + t.toLowerCase())],
      req, refsPresent);
  } catch {
    return build('TESTNET_SEAM_UNCONFIGURED', ['input_inspection_error'], null, null);
  }
}

// ---------------------------------------------------------------------------
// (C) IDEMPOTENCY GUARD READ-MODEL
//
// Pure function over { intent_id, prior_send_records: [ { intent_id, ... } ] }.
// One intent_id -> at most one send. If intent_id already present in
// prior_send_records -> TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED; else
// TESTNET_IDEMPOTENCY_FIRST_SEEN (advisory; it does NOT authorize a send —
// can_send stays false). Missing/empty intent_id -> _INVALID.
// ---------------------------------------------------------------------------

const TESTNET_IDEMPOTENCY_STATES = Object.freeze([
  'TESTNET_IDEMPOTENCY_UNCONFIGURED', 'TESTNET_IDEMPOTENCY_INVALID',
  'TESTNET_IDEMPOTENCY_FIRST_SEEN', 'TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED'
]);

export function describeTestnetSendIdempotencyContract() {
  return Object.freeze({
    contract: 'testnet-send-idempotency',
    version: '0.0.0',
    test_only: true,
    supported_states: TESTNET_IDEMPOTENCY_STATES,
    advisory_only: true,
    read_model_only: true,
    testnet_idempotency_state: 'TESTNET_IDEMPOTENCY_UNCONFIGURED',
    is_duplicate: false,
    authorizes_send: false,
    status: 'TESTNET_IDEMPOTENCY_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only TESTNET-SEND IDEMPOTENCY GUARD READ-MODEL. Pure deterministic function over { intent_id (string), prior_send_records: [ { intent_id, ... } ] }. Enforces ONE intent_id -> AT MOST one send: if intent_id already appears in prior_send_records -> TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED (is_duplicate:true); otherwise TESTNET_IDEMPOTENCY_FIRST_SEEN. CRITICAL: FIRST_SEEN is ADVISORY ONLY and does NOT authorize a send — authorizes_send / can_send / can_broadcast STAY false on EVERY state (send is always suppressed in-package). Fail-Safe-Not-Fail-Open: missing / empty / non-string intent_id -> TESTNET_IDEMPOTENCY_INVALID; missing input -> TESTNET_IDEMPOTENCY_UNCONFIGURED; smuggled mainnet / execution command / credential / endpoint material -> TESTNET_IDEMPOTENCY_INVALID (values never echoed); hostile/throwing input -> frozen refusal, never throws. prior_send_records is read shallowly (each record\'s intent_id only); no record value is echoed.'
  });
}

export function evaluateTestnetSendIdempotency(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'TESTNET_IDEMPOTENCY_INVALID'),
    testnet_idempotency_state: state,
    is_duplicate: (state === 'TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED'),
    authorizes_send: false,
    read_model_only: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('TESTNET_IDEMPOTENCY_UNCONFIGURED', ['no_testnet_idempotency_input']);
    }
    if (hasFunctionValue(snap)) {
      return build('TESTNET_IDEMPOTENCY_UNCONFIGURED', ['input_inspection_error']);
    }

    // screen the top level minus prior_send_records (an array, screened nested).
    const shallow = {};
    for (const [k, v] of Object.entries(snap)) {
      if (k === 'prior_send_records') continue;
      shallow[k] = v;
    }
    const reasons = screen(shallow);
    if (reasons.includes('mainnet_refused')) {
      return build('TESTNET_IDEMPOTENCY_INVALID', ['mainnet_refused']);
    }
    if (screenedInvalid(reasons)) {
      return build('TESTNET_IDEMPOTENCY_INVALID', reasons);
    }

    const intentId = snap.intent_id;
    if (intentId == null || typeof intentId !== 'string' || intentId.length === 0) {
      return build('TESTNET_IDEMPOTENCY_INVALID', ['intent_id_invalid']);
    }

    const records = snap.prior_send_records;
    if (records !== undefined && records !== null && !Array.isArray(records)) {
      return build('TESTNET_IDEMPOTENCY_INVALID', ['prior_send_records_invalid']);
    }
    const list = Array.isArray(records) ? records : [];
    // nested mainnet scan over the records (one level deep).
    if (hasMainnetTokenNested(list)) {
      return build('TESTNET_IDEMPOTENCY_INVALID', ['mainnet_refused']);
    }
    let duplicate = false;
    for (const rec of list) {
      if (rec != null && typeof rec === 'object' && !Array.isArray(rec)) {
        if (typeof rec.intent_id === 'string' && rec.intent_id === intentId) {
          duplicate = true;
          break;
        }
      }
    }
    if (duplicate) {
      return build('TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED', ['intent_id_already_sent']);
    }
    return build('TESTNET_IDEMPOTENCY_FIRST_SEEN', ['intent_id_first_seen_advisory_only']);
  } catch {
    return build('TESTNET_IDEMPOTENCY_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (D) FAILED-SEND CLASSIFIER DESCRIPTOR
//
// Consumes a failure indicator and maps it to the EXISTING SSOT Group 3
// failure_type VALUE vocabulary (consumed-only by VALUE; no new SSOT name).
// Descriptive only — observes/classifies, never sends.
// ---------------------------------------------------------------------------

const TESTNET_FAILED_SEND_STATES = Object.freeze([
  'TESTNET_FAILED_SEND_UNCONFIGURED', 'TESTNET_FAILED_SEND_INVALID',
  'TESTNET_FAILED_SEND_CLASSIFIED'
]);

// SSOT Group 3 failure_type values — CONSUMED ONLY by VALUE (not new SSOT names).
const FAILURE_TYPE_VALUES = Object.freeze([
  'SlippageExceeded', 'BlockhashExpired', 'AccountInUse', 'ComputeBudgetExceeded',
  'InsufficientFunds', 'RouteInvalid', 'TokenAccountMissing', 'ProgramError',
  'RPCDropped', 'BundleFailed', 'Unknown'
]);

export function describeTestnetFailedSendClassContract() {
  return Object.freeze({
    contract: 'testnet-failed-send-class',
    version: '0.0.0',
    test_only: true,
    supported_states: TESTNET_FAILED_SEND_STATES,
    supported_failure_type_values: FAILURE_TYPE_VALUES,
    advisory_only: true,
    read_model_only: true,
    testnet_failed_send_state: 'TESTNET_FAILED_SEND_UNCONFIGURED',
    failure_type: null,
    status: 'TESTNET_FAILED_SEND_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only TESTNET FAILED-SEND CLASSIFIER DESCRIPTOR. Consumes a failure indicator and maps it to the EXISTING SSOT Group 3 failure_type VALUE vocabulary (SlippageExceeded / BlockhashExpired / AccountInUse / ComputeBudgetExceeded / InsufficientFunds / RouteInvalid / TokenAccountMissing / ProgramError / RPCDropped / BundleFailed / Unknown) — CONSUMED ONLY by VALUE; this package introduces NO new SSOT name and NO new candidate_* name. DESCRIPTIVE ONLY: it observes / classifies a failure for diagnostics; it never sends, never broadcasts, never retries. An unrecognized / missing / non-string indicator maps fail-safe to \'Unknown\' (TESTNET_FAILED_SEND_CLASSIFIED). Fail-Safe-Not-Fail-Open: missing input -> TESTNET_FAILED_SEND_UNCONFIGURED; smuggled mainnet / execution command / credential / endpoint material -> TESTNET_FAILED_SEND_INVALID (values never echoed); hostile/throwing input -> frozen refusal, never throws.'
  });
}

export function evaluateTestnetFailedSendClass(input) {
  const build = (state, reasons, failureType) => Object.freeze({
    valid: (state !== 'TESTNET_FAILED_SEND_INVALID'),
    testnet_failed_send_state: state,
    failure_type: (state === 'TESTNET_FAILED_SEND_CLASSIFIED') ? failureType : null,
    read_model_only: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('TESTNET_FAILED_SEND_UNCONFIGURED', ['no_testnet_failed_send_input'], null);
    }
    if (hasFunctionValue(snap)) {
      return build('TESTNET_FAILED_SEND_UNCONFIGURED', ['input_inspection_error'], null);
    }
    const reasons = screen(snap);
    if (reasons.includes('mainnet_refused')) {
      return build('TESTNET_FAILED_SEND_INVALID', ['mainnet_refused'], null);
    }
    if (screenedInvalid(reasons)) {
      return build('TESTNET_FAILED_SEND_INVALID', reasons, null);
    }

    const indicator = snap.failure_indicator;
    if (indicator == null) {
      return build('TESTNET_FAILED_SEND_UNCONFIGURED', ['failure_indicator_missing'], null);
    }
    // map by VALUE: an exact known failure_type value is preserved; anything else
    // maps fail-safe to 'Unknown'.
    const failureType = (typeof indicator === 'string' && FAILURE_TYPE_VALUES.includes(indicator))
      ? indicator : 'Unknown';
    return build('TESTNET_FAILED_SEND_CLASSIFIED', ['failure_classified_by_value'], failureType);
  } catch {
    return build('TESTNET_FAILED_SEND_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// ---------------------------------------------------------------------------
// (E) BUNDLE-STATUS OBSERVER READ-MODEL
//
// Consumes a bundle_status VALUE (SSOT Group 3: Pending / Failed / Landed /
// Invalid / STALE_BUNDLE) by value; classifies STALE_BUNDLE when Pending past a
// caller-supplied ttl_slots (NEVER defaulted). Read-model only; observes, never
// sends.
// ---------------------------------------------------------------------------

const TESTNET_BUNDLE_STATES = Object.freeze([
  'TESTNET_BUNDLE_UNCONFIGURED', 'TESTNET_BUNDLE_INVALID', 'TESTNET_BUNDLE_OBSERVED'
]);

// SSOT Group 3 bundle_status values — CONSUMED ONLY by VALUE.
const BUNDLE_STATUS_VALUES = Object.freeze([
  'Pending', 'Failed', 'Landed', 'Invalid', 'STALE_BUNDLE'
]);

function isFiniteNonNegativeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function describeTestnetBundleStatusContract() {
  return Object.freeze({
    contract: 'testnet-bundle-status',
    version: '0.0.0',
    test_only: true,
    supported_states: TESTNET_BUNDLE_STATES,
    supported_bundle_status_values: BUNDLE_STATUS_VALUES,
    advisory_only: true,
    read_model_only: true,
    testnet_bundle_state: 'TESTNET_BUNDLE_UNCONFIGURED',
    bundle_status: null,
    stale_detected: false,
    status: 'TESTNET_BUNDLE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only TESTNET BUNDLE-STATUS OBSERVER READ-MODEL. Consumes a bundle_status VALUE (SSOT Group 3: Pending / Failed / Landed / Invalid / STALE_BUNDLE) by VALUE — CONSUMED ONLY by VALUE; no new SSOT name, no new candidate_*. It observes / classifies a bundle\'s status for diagnostics; it NEVER sends, NEVER broadcasts, NEVER re-broadcasts. STALE detection: when the observed status is Pending AND a caller-supplied ttl_slots is provided (NEVER defaulted) AND (observed_slot - submitted_slot) > ttl_slots, the observer classifies bundle_status as STALE_BUNDLE (stale_detected:true). Without ttl_slots / slots, a Pending stays Pending (the read-model never invents a TTL). Fail-Safe-Not-Fail-Open: missing input -> TESTNET_BUNDLE_UNCONFIGURED; an unknown / non-string bundle_status, a non-numeric/negative ttl_slots or slot, or inconsistent slots -> TESTNET_BUNDLE_INVALID; smuggled mainnet / execution command / credential / endpoint material -> TESTNET_BUNDLE_INVALID (values never echoed); hostile/throwing input -> frozen refusal, never throws.'
  });
}

export function evaluateTestnetBundleStatus(input) {
  const build = (state, reasons, bundleStatus, stale) => Object.freeze({
    valid: (state !== 'TESTNET_BUNDLE_INVALID'),
    testnet_bundle_state: state,
    bundle_status: (state === 'TESTNET_BUNDLE_OBSERVED' && typeof bundleStatus === 'string') ? bundleStatus : null,
    stale_detected: (state === 'TESTNET_BUNDLE_OBSERVED') ? (stale === true) : false,
    read_model_only: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('TESTNET_BUNDLE_UNCONFIGURED', ['no_testnet_bundle_input'], null, false);
    }
    if (hasFunctionValue(snap)) {
      return build('TESTNET_BUNDLE_UNCONFIGURED', ['input_inspection_error'], null, false);
    }
    const reasons = screen(snap);
    if (reasons.includes('mainnet_refused')) {
      return build('TESTNET_BUNDLE_INVALID', ['mainnet_refused'], null, false);
    }
    if (screenedInvalid(reasons)) {
      return build('TESTNET_BUNDLE_INVALID', reasons, null, false);
    }

    const status = snap.bundle_status;
    if (status == null) {
      return build('TESTNET_BUNDLE_UNCONFIGURED', ['bundle_status_missing'], null, false);
    }
    if (typeof status !== 'string' || !BUNDLE_STATUS_VALUES.includes(status)) {
      return build('TESTNET_BUNDLE_INVALID', ['bundle_status_unknown'], null, false);
    }

    // optional staleness inputs: ttl_slots is NEVER defaulted.
    const ttl = snap.ttl_slots;
    const observed = snap.observed_slot;
    const submitted = snap.submitted_slot;
    for (const [v, code] of [[ttl, 'invalid_ttl_slots'], [observed, 'invalid_observed_slot'], [submitted, 'invalid_submitted_slot']]) {
      if (v !== undefined && v !== null && !isFiniteNonNegativeNumber(v)) {
        return build('TESTNET_BUNDLE_INVALID', [code], null, false);
      }
    }

    let resolved = status;
    let stale = false;
    if (status === 'Pending') {
      const haveAll = isFiniteNonNegativeNumber(ttl) &&
        isFiniteNonNegativeNumber(observed) && isFiniteNonNegativeNumber(submitted);
      if (haveAll) {
        const age = observed - submitted;
        if (age < 0) {
          return build('TESTNET_BUNDLE_INVALID', ['inconsistent_slots'], null, false);
        }
        if (age > ttl) {
          resolved = 'STALE_BUNDLE';
          stale = true;
        }
      }
      // without all three slots (ttl never defaulted), a Pending stays Pending.
    } else if (status === 'STALE_BUNDLE') {
      stale = true;
    }
    return build('TESTNET_BUNDLE_OBSERVED',
      stale ? ['bundle_stale_detected'] : ['bundle_status_observed'], resolved, stale);
  } catch {
    return build('TESTNET_BUNDLE_UNCONFIGURED', ['input_inspection_error'], null, false);
  }
}

// ---------------------------------------------------------------------------
// (F) TESTNET-SEND SUPPRESSION
//
// ALWAYS suppressed:true. The testnet-send boundary layer is NEVER send /
// broadcast / execution authorized, so not_send_authorized +
// not_broadcast_authorized + not_execution_authorized are ALWAYS emitted;
// component codes are added when a consumed component is unclean.
// ---------------------------------------------------------------------------

const TESTNET_SUPPRESSION_REASON_CODES = Object.freeze([
  'testnet_send_input_invalid', 'testnet_seam_not_ready', 'idempotency_duplicate',
  'testnet_surface_detected', 'not_send_authorized', 'not_broadcast_authorized',
  'not_execution_authorized'
]);

const TESTNET_SUPPRESSION_ALWAYS = Object.freeze([
  'not_send_authorized', 'not_broadcast_authorized', 'not_execution_authorized'
]);

export function describeTestnetSendSuppressionContract() {
  return Object.freeze({
    contract: 'testnet-send-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: TESTNET_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: true,
    suppression_reasons: TESTNET_SUPPRESSION_ALWAYS,
    status: 'TESTNET_SEND_SUPPRESSED',
    reasons: TESTNET_SUPPRESSION_ALWAYS,
    ...sendSafeFlags(),
    note: 'Read-only TESTNET-SEND SUPPRESSION. ALWAYS suppressed:true — the testnet-send boundary layer is NEVER send / broadcast / execution authorized, so not_send_authorized + not_broadcast_authorized + not_execution_authorized are ALWAYS carried on every result, including a perfectly clean one (the three component codes). Component codes are added when a consumed component is unclean: testnet_send_input not TESTNET_SEND_INPUT_VALID -> testnet_send_input_invalid; testnet_activation_seam present (send_ready_advisory is ALWAYS false in this package) -> testnet_seam_not_ready; idempotency TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED -> idempotency_duplicate; testnet_forbidden_surface TESTNET_SURFACE_BLOCKED -> testnet_surface_detected. Suppression prevents progression and reports REASONS ONLY — it opens nothing, sends nothing, broadcasts nothing, and never escalates. can_send / can_broadcast STAY false.'
  });
}

export function evaluateTestnetSendSuppression(input) {
  const build = (codes) => {
    const merged = [...new Set([...(codes || []), ...TESTNET_SUPPRESSION_ALWAYS])]
      .filter((c) => TESTNET_SUPPRESSION_REASON_CODES.includes(c));
    return Object.freeze({
      suppressed: true,
      suppression_reasons: Object.freeze(merged),
      status: 'TESTNET_SEND_SUPPRESSED',
      reasons: Object.freeze(merged),
      advisory_only: true,
      ...sendSafeFlags()
    });
  };
  try {
    const snap = snapshot(input);
    if (snap === null || hasFunctionValue(snap)) {
      // hostile / missing -> still suppressed, always carrying the three tokens.
      return build([]);
    }
    const codes = [];

    let inputSnap = null;
    let seamSnap = null;
    let idemSnap = null;
    let surfaceSnap = null;
    try {
      inputSnap = snapshot(snap.testnet_send_input);
      seamSnap = snapshot(snap.testnet_activation_seam);
      idemSnap = snapshot(snap.testnet_send_idempotency);
      surfaceSnap = snapshot(snap.testnet_forbidden_surface);
    } catch {
      return build([]);
    }

    if (snap.testnet_send_input != null) {
      const s = recognizeInputBoundaryResult(inputSnap);
      if (s !== 'TESTNET_SEND_INPUT_VALID') codes.push('testnet_send_input_invalid');
    }
    if (snap.testnet_activation_seam != null) {
      // send_ready_advisory is ALWAYS false in this package, so a present seam
      // descriptor is ALWAYS not-ready (and an unrecognized one is too).
      if (seamSnap == null || seamSnap.read_only !== true || seamSnap.send_ready_advisory !== true) {
        codes.push('testnet_seam_not_ready');
      }
    }
    if (snap.testnet_send_idempotency != null) {
      if (idemSnap != null && idemSnap.read_only === true &&
          idemSnap.testnet_idempotency_state === 'TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED') {
        codes.push('idempotency_duplicate');
      }
    }
    if (snap.testnet_forbidden_surface != null) {
      if (surfaceSnap != null && surfaceSnap.read_only === true &&
          surfaceSnap.testnet_surface_state === 'TESTNET_SURFACE_BLOCKED') {
        codes.push('testnet_surface_detected');
      }
    }
    return build(codes);
  } catch {
    return build([]);
  }
}

// ---------------------------------------------------------------------------
// (G) TESTNET FORBIDDEN SURFACE GUARD
//
// NAME-only redacting guard. Scans ONLY top-level keys for forbidden field NAMES:
// key material + live/endpoint + api_key/bearer/token names + mainnet tokens.
// Reports a REDACTED forbidden_field_ref (the matched NAME only) — NEVER the
// VALUE. The detection booleans are DETECTION outputs (true == found == BLOCKED
// == the SAFE blocked state); they are NOT readiness/exec flags. endpoint_ref is
// NOT forbidden — it is the sanctioned BY-REFERENCE name; the endpointRef shape
// helper is exported for shape-checking an opaque endpoint_ref.
// ---------------------------------------------------------------------------

const TESTNET_SURFACE_STATES = Object.freeze([
  'TESTNET_SURFACE_UNCONFIGURED', 'TESTNET_SURFACE_CLEAN', 'TESTNET_SURFACE_BLOCKED'
]);

const TESTNET_SURFACE_KEY_MATERIAL_NAMES = Object.freeze([
  'private_key', 'privateKey', 'secret_key', 'secretKey', 'keypair', 'keyPair',
  'mnemonic', 'seed', 'seed_phrase', 'seedPhrase', 'secret_seed', 'raw_key',
  'rawKey', 'signing_key', 'signingKey', 'signer_secret', 'signerSecret'
]);

const TESTNET_SURFACE_CREDENTIAL_NAMES = Object.freeze([
  'api_key', 'apiKey', 'bearer_token', 'bearerToken', 'bearer', 'access_token',
  'accessToken', 'auth_token', 'authToken', 'provider_key', 'providerKey',
  'provider_secret', 'providerSecret', 'token', 'secret', 'password',
  'credential', 'credentials'
]);

const TESTNET_SURFACE_ENDPOINT_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'endpointUrl', 'url', 'rpc_url', 'rpcUrl',
  'ws_url', 'wsUrl', 'stream_url', 'streamUrl', 'grpc_endpoint', 'grpcEndpoint',
  'connection_string', 'connectionString', 'live_endpoint', 'liveEndpoint',
  'live_url', 'liveUrl', 'testnet_url', 'testnetUrl', 'rpc_endpoint'
]);

const TESTNET_SURFACE_FORBIDDEN_NAMES = Object.freeze([
  ...TESTNET_SURFACE_KEY_MATERIAL_NAMES,
  ...TESTNET_SURFACE_CREDENTIAL_NAMES,
  ...TESTNET_SURFACE_ENDPOINT_NAMES
]);

// endpoint_ref shape-check helper: a valid endpoint_ref is an opaque SHORT token
// (refuse ://, whitespace, >128 chars, base58-blob / PEM / mainnet shape). The
// VALUE is never echoed — returns only a boolean.
export function isValidEndpointRef(ref) {
  return !endpointRefSecretShaped(ref);
}

export function describeTestnetForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'testnet-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    supported_states: TESTNET_SURFACE_STATES,
    forbidden_field_names: TESTNET_SURFACE_FORBIDDEN_NAMES,
    endpoint_ref_max_length: ENDPOINT_REF_MAX_LENGTH,
    advisory_only: true,
    testnet_surface_state: 'TESTNET_SURFACE_UNCONFIGURED',
    key_material_detected: false,
    credential_detected: false,
    testnet_surface_detected: false,
    mainnet_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'TESTNET_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only TESTNET FORBIDDEN SURFACE GUARD. NAME-only redacting guard: proves the Stage-21 testnet-send boundary neither produces nor accepts key material, raw credentials, live/testnet endpoint surfaces, or mainnet indicators. It scans ONLY top-level keys (deterministic, bounded, pure, snapshot-once) for forbidden field NAMES: key material (private_key, secret_key, keypair, mnemonic, seed, raw_key, signing_key, signer_secret, ...), raw credentials (api_key, bearer_token, bearer, access_token, auth_token, provider_key, token, secret, password, credential, ...), and endpoints (endpoint, endpoint_url, url, rpc_url, ws_url, grpc_endpoint, connection_string, testnet_url, rpc_endpoint, ...). It ALSO scans for any mainnet / mainnet-beta / prod token in a KEY or string VALUE -> BLOCKED (mainnet_detected). endpoint_ref is NOT forbidden — it is the single sanctioned BY-REFERENCE name; use the exported isValidEndpointRef(ref) shape-checker (a valid endpoint_ref is an opaque short token; ://, whitespace, >128 chars, base58-blob / PEM / mainnet shapes are refused). The detection booleans key_material_detected / credential_detected / testnet_surface_detected / mainnet_detected / forbidden_field_detected are DETECTION outputs (true == found == BLOCKED == the SAFE blocked state); they are NOT readiness/execution flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing / hostile input -> TESTNET_SURFACE_UNCONFIGURED (frozen, never throws); no forbidden name/value -> TESTNET_SURFACE_CLEAN; ANY forbidden name OR mainnet token -> TESTNET_SURFACE_BLOCKED.'
  });
}

export function evaluateTestnetForbiddenSurface(input) {
  const build = (state, kind, ref, reasons) => Object.freeze({
    testnet_surface_state: state,
    key_material_detected: (state === 'TESTNET_SURFACE_BLOCKED') ? (kind === 'key') : false,
    credential_detected: (state === 'TESTNET_SURFACE_BLOCKED') ? (kind === 'credential') : false,
    testnet_surface_detected: (state === 'TESTNET_SURFACE_BLOCKED') ? (kind === 'endpoint') : false,
    mainnet_detected: (state === 'TESTNET_SURFACE_BLOCKED') ? (kind === 'mainnet') : false,
    forbidden_field_detected: (state === 'TESTNET_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'TESTNET_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('TESTNET_SURFACE_UNCONFIGURED', null, null, ['no_testnet_surface_input']);
    }
    // scan top-level NAMES first (names matter; values are never echoed).
    for (const k of Object.keys(snap)) {
      if (TESTNET_SURFACE_KEY_MATERIAL_NAMES.includes(k)) {
        return build('TESTNET_SURFACE_BLOCKED', 'key', k, ['key_material_detected']);
      }
      if (TESTNET_SURFACE_CREDENTIAL_NAMES.includes(k)) {
        return build('TESTNET_SURFACE_BLOCKED', 'credential', k, ['credential_detected']);
      }
      if (TESTNET_SURFACE_ENDPOINT_NAMES.includes(k)) {
        return build('TESTNET_SURFACE_BLOCKED', 'endpoint', k, ['testnet_surface_detected']);
      }
    }
    // mainnet token in a KEY or VALUE (incl. nested one level) -> BLOCKED.
    if (snapshotHasMainnet(snap)) {
      return build('TESTNET_SURFACE_BLOCKED', 'mainnet', 'mainnet_token', ['mainnet_detected']);
    }
    // endpoint/credential VALUE smuggled under a benign name -> BLOCKED (redacted).
    for (const [k, v] of Object.entries(snap)) {
      if (TESTNET_SAFE_REF_FIELD_NAMES.includes(k)) {
        // endpoint_ref's value is shape-checked elsewhere; skip its value here so a
        // clean opaque ref does not trip the endpoint VALUE scan.
        if (k === 'endpoint_ref') continue;
      }
      if (valueIsDirty(v)) {
        return build('TESTNET_SURFACE_BLOCKED', 'endpoint', k, ['testnet_surface_detected']);
      }
    }
    if (hasFunctionValue(snap)) {
      return build('TESTNET_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    return build('TESTNET_SURFACE_CLEAN', null, null, ['testnet_surface_clean']);
  } catch {
    return build('TESTNET_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// Recognize a (G) testnet-forbidden-surface result fed forward (from a SNAPSHOT).
function recognizeSurfaceResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.testnet_surface_state === 'string' && TESTNET_SURFACE_STATES.includes(snap.testnet_surface_state)) {
    return snap.testnet_surface_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (H) TESTNET-SEND HEALTH
//
// Aggregates (A)-(G) + the send-gate refusal; derives STATUS ONLY. The clean
// path is _SUPPRESSED — send is ALWAYS suppressed in-package, so a fully-reviewed
// clean boundary is STILL suppressed. Surface BLOCKED / mainnet / any _INVALID ->
// _BLOCKED. Every state keeps all 24 readiness/execution flags false.
// ---------------------------------------------------------------------------

const TESTNET_SEND_HEALTH_STATES = Object.freeze([
  'TESTNET_SEND_HEALTH_UNCONFIGURED', 'TESTNET_SEND_HEALTH_DEGRADED',
  'TESTNET_SEND_HEALTH_REVIEWED_ADVISORY', 'TESTNET_SEND_HEALTH_SUPPRESSED',
  'TESTNET_SEND_HEALTH_BLOCKED'
]);

const TESTNET_SEND_HEALTH_COMPONENTS = Object.freeze([
  'testnet_send_input', 'testnet_activation_seam', 'testnet_send_idempotency',
  'testnet_failed_send_class', 'testnet_bundle_status', 'testnet_send_suppression',
  'testnet_forbidden_surface'
]);

export function describeTestnetSendHealthContract() {
  return Object.freeze({
    contract: 'testnet-send-health',
    version: '0.0.0',
    test_only: true,
    supported_states: TESTNET_SEND_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    testnet_send_health_state: 'TESTNET_SEND_HEALTH_UNCONFIGURED',
    status: 'TESTNET_SEND_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sendSafeFlags(),
    note: 'Read-only TESTNET-SEND HEALTH. Aggregates the Stage-21 testnet-send input boundary (A) + testnet-activation seam descriptor (B) + idempotency guard (C) + failed-send classifier (D) + bundle-status observer (E) + testnet-send suppression (F) + testnet forbidden surface (G), and DERIVES STATUS ONLY. Ordering (Fail-Safe-Not-Fail-Open): smuggled forbidden flag / execution command / credential NAME / endpoint value / mainnet token on the top level or any component -> TESTNET_SEND_HEALTH_BLOCKED; testnet_forbidden_surface TESTNET_SURFACE_BLOCKED or any component *_INVALID -> TESTNET_SEND_HEALTH_BLOCKED; any required component missing or unrecognized -> TESTNET_SEND_HEALTH_UNCONFIGURED; testnet_send_suppression.suppressed === true -> TESTNET_SEND_HEALTH_SUPPRESSED — and because suppression is ALWAYS active at this layer, the CLEAN PATH lands on _SUPPRESSED; a (theoretical) unsuppressed clean review -> TESTNET_SEND_HEALTH_REVIEWED_ADVISORY; anything else -> TESTNET_SEND_HEALTH_DEGRADED. send is always suppressed in-package; every state keeps every readiness/execution flag false and grants no execution authority. This health NEVER consults can_send/can_broadcast as anything but FIXED false.'
  });
}

export function evaluateTestnetSendHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'TESTNET_SEND_HEALTH_BLOCKED'),
    testnet_send_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    advisory_only: true,
    ...sendSafeFlags()
  });
  try {
    const snap = snapshot(inputs);
    if (snap === null) {
      return build('TESTNET_SEND_HEALTH_UNCONFIGURED', ['no_testnet_send_health_input']);
    }
    if (hasFunctionValue(snap)) {
      return build('TESTNET_SEND_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }

    // smuggle screen: top-level minus component slots, then every component.
    const shallow = {};
    for (const [k, v] of Object.entries(snap)) {
      if (!TESTNET_SEND_HEALTH_COMPONENTS.includes(k)) shallow[k] = v;
    }
    let blockedBySmuggle = screen(shallow).length > 0;
    const componentSnaps = {};
    for (const k of TESTNET_SEND_HEALTH_COMPONENTS) {
      let c = null;
      try {
        c = snapshot(snap[k]);
      } catch {
        return build('TESTNET_SEND_HEALTH_UNCONFIGURED', ['input_inspection_error']);
      }
      componentSnaps[k] = c;
      if (c == null) continue;
      if (hasFunctionValue(c)) {
        return build('TESTNET_SEND_HEALTH_UNCONFIGURED', ['input_inspection_error']);
      }
      if (snapshotHasMainnet(c) || hasForbiddenTrueFlag(c) || hasExecCmdKey(c) ||
          hasEndpointOrCredentialValue(c)) {
        blockedBySmuggle = true;
      }
    }
    if (blockedBySmuggle) {
      return build('TESTNET_SEND_HEALTH_BLOCKED', ['forbidden_input_blocked']);
    }

    const inputState = recognizeInputBoundaryResult(componentSnaps.testnet_send_input);
    const seamSnap = componentSnaps.testnet_activation_seam;
    const idemSnap = componentSnaps.testnet_send_idempotency;
    const failSnap = componentSnaps.testnet_failed_send_class;
    const bundleSnap = componentSnaps.testnet_bundle_status;
    const supprSnap = componentSnaps.testnet_send_suppression;
    const surfaceState = recognizeSurfaceResult(componentSnaps.testnet_forbidden_surface);

    const seamState = (seamSnap != null && seamSnap.read_only === true &&
      typeof seamSnap.testnet_seam_state === 'string' && TESTNET_SEAM_STATES.includes(seamSnap.testnet_seam_state))
      ? seamSnap.testnet_seam_state : null;
    const idemState = (idemSnap != null && idemSnap.read_only === true &&
      typeof idemSnap.testnet_idempotency_state === 'string' && TESTNET_IDEMPOTENCY_STATES.includes(idemSnap.testnet_idempotency_state))
      ? idemSnap.testnet_idempotency_state : null;
    const failState = (failSnap != null && failSnap.read_only === true &&
      typeof failSnap.testnet_failed_send_state === 'string' && TESTNET_FAILED_SEND_STATES.includes(failSnap.testnet_failed_send_state))
      ? failSnap.testnet_failed_send_state : null;
    const bundleState = (bundleSnap != null && bundleSnap.read_only === true &&
      typeof bundleSnap.testnet_bundle_state === 'string' && TESTNET_BUNDLE_STATES.includes(bundleSnap.testnet_bundle_state))
      ? bundleSnap.testnet_bundle_state : null;
    const supprVal = (supprSnap != null && supprSnap.read_only === true &&
      typeof supprSnap.suppressed === 'boolean' && Array.isArray(supprSnap.suppression_reasons))
      ? supprSnap.suppressed : null;

    // hard-block: surface blocked.
    if (surfaceState === 'TESTNET_SURFACE_BLOCKED') {
      return build('TESTNET_SEND_HEALTH_BLOCKED', ['testnet_surface_blocked']);
    }
    // hard-block: any component *_INVALID.
    if (inputState === 'TESTNET_SEND_INPUT_INVALID' || seamState === 'TESTNET_SEAM_INVALID' ||
        idemState === 'TESTNET_IDEMPOTENCY_INVALID' || failState === 'TESTNET_FAILED_SEND_INVALID' ||
        bundleState === 'TESTNET_BUNDLE_INVALID') {
      return build('TESTNET_SEND_HEALTH_BLOCKED', ['component_invalid']);
    }

    // any required component missing or unrecognized -> UNCONFIGURED.
    if (inputState === null || seamState === null || idemState === null ||
        failState === null || bundleState === null || supprVal === null || surfaceState === null) {
      return build('TESTNET_SEND_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // suppression active -> SUPPRESSED (the CLEAN PATH; suppression is always active).
    if (supprVal === true) {
      return build('TESTNET_SEND_HEALTH_SUPPRESSED', ['testnet_send_suppressed']);
    }

    // (theoretical) unsuppressed clean review -> REVIEWED_ADVISORY.
    if (inputState === 'TESTNET_SEND_INPUT_VALID' && seamState === 'TESTNET_SEAM_DESCRIPTOR' &&
        (idemState === 'TESTNET_IDEMPOTENCY_FIRST_SEEN') &&
        failState === 'TESTNET_FAILED_SEND_CLASSIFIED' &&
        bundleState === 'TESTNET_BUNDLE_OBSERVED' && surfaceState === 'TESTNET_SURFACE_CLEAN') {
      return build('TESTNET_SEND_HEALTH_REVIEWED_ADVISORY', ['testnet_send_reviewed_advisory']);
    }

    // anything else -> DEGRADED.
    return build('TESTNET_SEND_HEALTH_DEGRADED', ['testnet_send_degraded']);
  } catch {
    return build('TESTNET_SEND_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
