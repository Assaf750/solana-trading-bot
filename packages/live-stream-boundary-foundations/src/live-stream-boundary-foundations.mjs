// @soltrade/live-stream-boundary-foundations
//
// Read-only / advisory ONLY LIVE-STREAM BOUNDARY foundation for Stage-17 — the
// Phase-C opener: the LIVE DATA INTEGRATION (READ-ONLY) boundary layer. This
// package builds everything UP TO the activation seam and NOTHING past it: a
// disabled-by-default live-source DESCRIPTOR boundary, an ACTIVATION-SEAM
// DESCRIPTOR (describes what activation WOULD require; NEVER activates), a
// stream-health / gap READ-MODEL, and a live-readiness checklist READ-MODEL.
// Import-free, pure, deterministic. NO network primitive, NO live stream, NO
// live quote, NO endpoint resolution, NO connection of any kind, NO clock, NO
// RNG, NO environment access, NO filesystem access, NO signing, NO sending, NO
// secrets, NO mutable module/global state. Real live transport belongs ONLY in
// a clearly-marked FUTURE adapter package that does not exist yet and requires
// its own separate review — which is why LIVE_REQ_SEPARATE_ADAPTER_REVIEW is
// hardcoded met:false here and seam_ready_advisory can NEVER be true.
//
// THE CORE RULE: a live source here is a DISABLED / READ-ONLY descriptor TAG
// ONLY — it is NOT a connection, NOT an endpoint, NOT a subscription, NOT a
// credential, NOT execution authority, NOT trading readiness. Live data is
// enrichment/read-only with ZERO execution authority; stream gap / provider
// degradation alone NEVER escalates beyond EXITS_ONLY-shaped read-model
// advisory (never KILLED-shaped). Provider secrets travel BY REFERENCE ONLY
// (provider_key_ref); a raw provider key / token / credential is refused AND
// its value is never echoed (NAME-only redaction). Hostile, throwing, or
// uninspectable input returns a FROZEN refusal and NEVER throws.
// Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package adds NO name to docs/01-SSOT.md. The SSOT
// Group 5 field names (last_seen_slot / last_confirmed_slot / slot_lag /
// provider_degraded) are CONSUMED ONLY as INPUT field names of the stream-health
// read-model and are never emitted as output keys. The SSOT Group 1
// operating_state vocabulary (WARMING_UP / ACTIVE / EXITS_ONLY) is consumed ONLY
// as advisory token VOCABULARY in prose/contract notes — this package never
// writes, emits, or transitions any runtime operating state. Field names like
// api_key / bearer_token / private_key / endpoint appear ONLY as fixed string
// literals inside refusal / forbidden-NAME allowlist arrays and prose — never as
// real objects, calls, or emitted output keys.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function liveSafeFlags() {
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
// a live-stream boundary descriptor NEVER flips any readiness/execution flag.
const LIVE_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
]);

// Execution-command KEY names refused on any input. The forbidden opportunity /
// batch-exit command vocabulary appears here ONLY as fixed refusal literals —
// this package never generates or executes any of them.
const LIVE_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute', 'connect',
  'open_stream', 'start_stream', 'subscribe_live', 'activate', 'activate_live',
  'enable_live', 'resolve_endpoint', 'buy_opportunity', 'execute_opportunity',
  'submit_opportunity', 'exit_all_positions', 'batch_exit_all_positions'
]);

// Credential-NAME scan (NAME-only redaction: a matched NAME blocks; the VALUE is
// never read into any reason or output).
const LIVE_CREDENTIAL_KEY_RE = /secret|api[_-]?key|apikey|bearer|access[_-]?token|auth[_-]?token|\btoken\b|private|seed|mnemonic|keypair|raw_key|credential|password|signing_key|provider_key|provider_secret/i;

// URL / endpoint / mainnet markers inside string VALUES (scheme://, mainnet).
const LIVE_URL_RE = /[a-z][a-z0-9+.-]*:\/\//i;
const LIVE_MAINNET_RE = /mainnet|prod/i;

// raw-credential VALUE shapes (PEM block marker / long base58 blob). The value
// itself is never echoed — only a fixed reason code is emitted.
const LIVE_PEM_RE = /-----BEGIN/;
const LIVE_BASE58_BLOB_RE = /\b[1-9A-HJ-NP-Za-km-z]{64,}\b/;

// opaque-reference / slot field NAMES exempt from the credential-NAME scan.
// provider_key_ref is the single sanctioned BY-REFERENCE name (its VALUE is
// still shape-checked in the live-source boundary and never echoed);
// owner_approval_ref is presence-only (its VALUE is never validated or echoed).
const LIVE_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'live_source', 'provider_key_ref', 'provider_key_ref_present',
  'owner_approval_ref', 'live_source_boundary', 'live_activation_seam',
  'stream_health', 'readiness_checklist', 'live_suppression', 'live_surface'
]);

// owner_approval_ref is an OPAQUE presence-only reference: its value is exempt
// from the value scans because it is never validated, consumed, or echoed.
const LIVE_VALUE_SCAN_EXEMPT_NAMES = Object.freeze(['owner_approval_ref']);

// TOCTOU defense: read every own enumerable property EXACTLY ONCE via a single
// shallow spread; ALL later screening and evaluation walks the SAME snapshot, so
// a hostile counting getter cannot serve clean values to the screen and dirty
// values to the classifier. A getter that throws during the spread is caught by
// the caller and fails closed.
function liveSnapshot(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  return { ...o };
}

// a snapshot carrying function-valued fields is uninspectable -> fail closed.
function liveHasFunctionValue(snap) {
  if (snap == null) return false;
  for (const v of Object.values(snap)) {
    if (typeof v === 'function') return true;
  }
  return false;
}

function liveHasForbiddenTrueFlag(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const f of LIVE_FORBIDDEN_TRUE_FLAGS) {
    if (snap[f] === true) return true;
  }
  return false;
}

function liveHasExecCmdKey(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const k of Object.keys(snap)) {
    if (LIVE_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function liveHasCredentialFieldName(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const k of Object.keys(snap)) {
    if (LIVE_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (LIVE_CREDENTIAL_KEY_RE.test(String(k))) return true;
  }
  return false;
}

function liveHasEndpointOrCredentialValue(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const [k, v] of Object.entries(snap)) {
    if (LIVE_VALUE_SCAN_EXEMPT_NAMES.includes(k)) continue;
    if (typeof v !== 'string') continue;
    if (LIVE_URL_RE.test(v) || LIVE_MAINNET_RE.test(v)) return true;
    if (LIVE_PEM_RE.test(v) || LIVE_BASE58_BLOB_RE.test(v)) return true;
  }
  return false;
}

// shared screen over a SNAPSHOT. Reasons are fixed codes; no value is echoed.
function liveScreen(snap) {
  const r = [];
  if (liveHasForbiddenTrueFlag(snap)) r.push('forbidden_live_indicator_blocked');
  if (liveHasExecCmdKey(snap)) r.push('execution_command_blocked');
  if (liveHasCredentialFieldName(snap)) r.push('credential_field_blocked');
  if (liveHasEndpointOrCredentialValue(snap)) r.push('endpoint_or_credential_value_blocked');
  return r;
}

const LIVE_SCREEN_REASONS = Object.freeze([
  'forbidden_live_indicator_blocked', 'execution_command_blocked',
  'credential_field_blocked', 'endpoint_or_credential_value_blocked'
]);

function liveScreenedInvalid(reasons) {
  return reasons.some((x) => LIVE_SCREEN_REASONS.includes(x));
}

// ---------------------------------------------------------------------------
// (A) LIVE-SOURCE DESCRIPTOR BOUNDARY
//
// A live source is a DISABLED / READ-ONLY descriptor TAG ONLY — never a
// connection, endpoint, subscription, or credential. ANY enabled/live-active
// tag, URL, endpoint, api_key/bearer/token field, or raw credential ->
// LIVE_SOURCE_INVALID, value never echoed. A provider key may appear ONLY as
// provider_key_ref — an opaque reference string that must NOT look like a
// secret (refused when it contains ://, whitespace, is longer than 128 chars,
// or matches a base58-blob / PEM shape).
// ---------------------------------------------------------------------------

const LIVE_SOURCE_STATES = Object.freeze([
  'LIVE_SOURCE_UNCONFIGURED', 'LIVE_SOURCE_INVALID', 'LIVE_SOURCE_READ_ONLY_OK'
]);

const LIVE_SOURCE_ALLOWED_TAGS = Object.freeze([
  'live_helius_laserstream_disabled', 'live_triton_yellowstone_disabled',
  'generic_grpc_stream_disabled', 'fixture_stream', 'mock_stream'
]);

const PROVIDER_KEY_REF_MAX_LENGTH = 128;

// is the sanctioned opaque reference secret-shaped? (NAME-only redaction: the
// caller never echoes the value; only a fixed reason code is emitted.)
function liveProviderKeyRefSecretShaped(ref) {
  if (typeof ref !== 'string') return true;
  if (ref.length === 0 || ref.length > PROVIDER_KEY_REF_MAX_LENGTH) return true;
  if (ref.indexOf('://') !== -1) return true;
  if (/\s/.test(ref)) return true;
  if (LIVE_PEM_RE.test(ref)) return true;
  if (/^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(ref)) return true;
  if (LIVE_BASE58_BLOB_RE.test(ref)) return true;
  return false;
}

export function describeLiveSourceBoundaryContract() {
  return Object.freeze({
    contract: 'live-source-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: LIVE_SOURCE_STATES,
    supported_sources: LIVE_SOURCE_ALLOWED_TAGS,
    advisory_only: true,
    live_source_state: 'LIVE_SOURCE_UNCONFIGURED',
    live_source_boundary_valid: false,
    stream_connected: false,
    connection_performed: false,
    provider_key_ref_present: false,
    status: 'LIVE_SOURCE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...liveSafeFlags(),
    note: 'Read-only LIVE-SOURCE DESCRIPTOR BOUNDARY (Stage-17, Phase-C opener). A live source is a DISABLED / READ-ONLY descriptor TAG ONLY (live_helius_laserstream_disabled, live_triton_yellowstone_disabled, generic_grpc_stream_disabled, fixture_stream, mock_stream) — NO connection, NO endpoint, NO subscription, NO credential, NO network call. stream_connected / connection_performed / live_stream_enabled / endpoint_resolved / network_call_made STAY false on EVERY state. Fail-Safe-Not-Fail-Open: missing live_source -> LIVE_SOURCE_UNCONFIGURED; ANY enabled/live-active tag, unknown tag, URL or scheme:// value, api_key/bearer/token/credential field NAME, raw credential value (PEM / long base58 blob), smuggled execution command, or forbidden true flag -> LIVE_SOURCE_INVALID and the offending VALUE is NEVER echoed (NAME-only redaction). A provider key may appear ONLY as provider_key_ref — an opaque BY-REFERENCE string; it is refused as secret-shaped when it contains ://, whitespace, is longer than 128 chars, or matches a base58-blob / PEM shape, and its value is NEVER echoed (only provider_key_ref_present:boolean is emitted). A valid disabled/read-only tag -> LIVE_SOURCE_READ_ONLY_OK. A READ_ONLY_OK boundary grants NOTHING: live data is enrichment/read-only with ZERO execution authority; this is not trading readiness and never activates anything.'
  });
}

export function evaluateLiveSourceBoundary(input) {
  const build = (state, reasons, tag, keyRefPresent) => Object.freeze({
    valid: (state !== 'LIVE_SOURCE_INVALID'),
    live_source_boundary_valid: (state === 'LIVE_SOURCE_READ_ONLY_OK'),
    live_source_state: state,
    live_source: (state === 'LIVE_SOURCE_READ_ONLY_OK' && typeof tag === 'string') ? tag : null,
    provider_key_ref_present: keyRefPresent === true,
    stream_connected: false,
    connection_performed: false,
    activation_performed: false,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...liveSafeFlags()
  });
  try {
    const snap = liveSnapshot(input);
    if (snap === null) {
      return build('LIVE_SOURCE_UNCONFIGURED', ['no_live_source_input'], null, false);
    }
    if (liveHasFunctionValue(snap)) {
      return build('LIVE_SOURCE_UNCONFIGURED', ['input_inspection_error'], null, false);
    }

    const reasons = liveScreen(snap);
    if (snap.purpose !== 'live_source_boundary') reasons.push('purpose_invalid');

    const tag = snap.live_source;
    if (tag == null) {
      // screens still dominate a missing tag (smuggled material -> INVALID)
      if (liveScreenedInvalid(reasons) || reasons.includes('purpose_invalid')) {
        return build('LIVE_SOURCE_INVALID', reasons, null, false);
      }
      return build('LIVE_SOURCE_UNCONFIGURED', ['live_source_missing'], null, false);
    }
    if (typeof tag !== 'string' || !LIVE_SOURCE_ALLOWED_TAGS.includes(tag)) {
      // ANY enabled / live-active tag is refused explicitly; everything else
      // unknown is refused as unknown (both INVALID, never echoed).
      if (typeof tag === 'string' && /enabled|active|connected|on\b/i.test(tag)) {
        reasons.push('live_source_enabled_tag_blocked');
      } else {
        reasons.push('live_source_tag_unknown');
      }
    }

    // sanctioned BY-REFERENCE provider key: opaque ref ONLY, never secret-shaped
    let keyRefPresent = false;
    if (snap.provider_key_ref !== undefined && snap.provider_key_ref !== null) {
      if (liveProviderKeyRefSecretShaped(snap.provider_key_ref)) {
        reasons.push('provider_key_ref_secret_shaped');
      } else {
        keyRefPresent = true;
      }
    }

    if (reasons.length > 0) {
      return build('LIVE_SOURCE_INVALID', reasons, null, false);
    }
    return build('LIVE_SOURCE_READ_ONLY_OK', ['live_source_read_only_ok'], tag, keyRefPresent);
  } catch {
    return build('LIVE_SOURCE_UNCONFIGURED', ['input_inspection_error'], null, false);
  }
}

// Recognize a (A) live-source-boundary result fed forward (from a SNAPSHOT).
function liveRecognizeSourceBoundaryResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.live_source_state === 'string' && LIVE_SOURCE_STATES.includes(snap.live_source_state)) {
    return snap.live_source_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (B) LIVE-ACTIVATION SEAM DESCRIPTOR
//
// A READ-MODEL that DESCRIBES what activation WOULD require, without activating
// anything. activation_performed is a fixed literal false. seam_ready_advisory
// is ALWAYS false in this package: LIVE_REQ_SEPARATE_ADAPTER_REVIEW is hardcoded
// met:false because the separately-reviewed live adapter does not exist yet —
// the descriptor can NEVER claim readiness it cannot have. No owner approval
// VALUE is validated or echoed — only presence of an opaque ref.
// ---------------------------------------------------------------------------

const LIVE_SEAM_STATES = Object.freeze([
  'LIVE_SEAM_UNCONFIGURED', 'LIVE_SEAM_INVALID', 'LIVE_SEAM_DESCRIPTOR'
]);

const LIVE_SEAM_REQUIREMENT_TOKENS = Object.freeze([
  'LIVE_REQ_PROVIDER_KEY_REF', 'LIVE_REQ_OWNER_APPROVAL_REF',
  'LIVE_REQ_READINESS_GREEN', 'LIVE_REQ_SEPARATE_ADAPTER_REVIEW'
]);

function liveSeamRequirements(keyRefMet, approvalMet, readinessMet) {
  return Object.freeze([
    Object.freeze({ requirement: 'LIVE_REQ_PROVIDER_KEY_REF', met: keyRefMet === true }),
    Object.freeze({ requirement: 'LIVE_REQ_OWNER_APPROVAL_REF', met: approvalMet === true }),
    Object.freeze({ requirement: 'LIVE_REQ_READINESS_GREEN', met: readinessMet === true }),
    // HARDCODED met:false — the separately-reviewed live adapter does NOT exist
    // in this package; the seam can never claim this requirement.
    Object.freeze({ requirement: 'LIVE_REQ_SEPARATE_ADAPTER_REVIEW', met: false })
  ]);
}

export function describeLiveActivationSeamContract() {
  return Object.freeze({
    contract: 'live-activation-seam',
    version: '0.0.0',
    test_only: true,
    supported_states: LIVE_SEAM_STATES,
    supported_requirement_tokens: LIVE_SEAM_REQUIREMENT_TOKENS,
    advisory_only: true,
    live_seam_state: 'LIVE_SEAM_UNCONFIGURED',
    activation_performed: false,
    seam_ready_advisory: false,
    seam_requirements: liveSeamRequirements(false, false, false),
    provider_key_ref_present: false,
    owner_approval_ref_present: false,
    status: 'LIVE_SEAM_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...liveSafeFlags(),
    note: 'Read-only LIVE-ACTIVATION SEAM DESCRIPTOR. A READ-MODEL that DESCRIBES what activation WOULD require, without activating anything: activation_performed is a FIXED LITERAL false on every state, and activation — when it ever happens, in a separately-reviewed future adapter package — NEVER grants execution authority (live data stays enrichment/read-only). seam_requirements is a frozen array of LOCAL requirement tokens with met:boolean each (LIVE_REQ_PROVIDER_KEY_REF / LIVE_REQ_OWNER_APPROVAL_REF / LIVE_REQ_READINESS_GREEN / LIVE_REQ_SEPARATE_ADAPTER_REVIEW). LIVE_REQ_SEPARATE_ADAPTER_REVIEW is HARDCODED met:false in this package because the adapter does not exist yet, therefore seam_ready_advisory is ALWAYS false here — false WHENEVER any requirement is unmet, and ALWAYS false while LIVE_REQ_SEPARATE_ADAPTER_REVIEW is unmet: the descriptor can NEVER claim readiness it cannot have. Inputs: live_source_boundary must be a LIVE_SOURCE_READ_ONLY_OK result; provider_key_ref_present is a boolean (BY REFERENCE only — no key value ever appears); owner_approval_ref is an OPAQUE reference whose VALUE is never validated or echoed (only presence is reported); readiness_checklist is an optional live-readiness checklist read-model result (met only when all_met). Fail-Safe-Not-Fail-Open: missing input / missing boundary / boundary not READ_ONLY_OK -> LIVE_SEAM_UNCONFIGURED; an unrecognized or INVALID component, smuggled credential/endpoint/execution material, or wrong purpose -> LIVE_SEAM_INVALID (values never echoed).'
  });
}

export function evaluateLiveActivationSeam(input) {
  const build = (state, reasons, req, keyRefPresent, approvalPresent) => Object.freeze({
    valid: (state !== 'LIVE_SEAM_INVALID'),
    live_seam_state: state,
    // FIXED LITERAL: this descriptor never activates anything.
    activation_performed: false,
    // FIXED LITERAL: LIVE_REQ_SEPARATE_ADAPTER_REVIEW is hardcoded unmet in
    // this package, so seam readiness can NEVER be claimed here.
    seam_ready_advisory: false,
    seam_requirements: req || liveSeamRequirements(false, false, false),
    provider_key_ref_present: keyRefPresent === true,
    owner_approval_ref_present: approvalPresent === true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...liveSafeFlags()
  });
  try {
    const snap = liveSnapshot(input);
    if (snap === null) {
      return build('LIVE_SEAM_UNCONFIGURED', ['no_live_seam_input'], null, false, false);
    }
    if (liveHasFunctionValue(snap)) {
      return build('LIVE_SEAM_UNCONFIGURED', ['input_inspection_error'], null, false, false);
    }

    // screen the top level (component slots + opaque refs handled separately)
    const shallow = {};
    for (const [k, v] of Object.entries(snap)) {
      if (k === 'live_source_boundary' || k === 'readiness_checklist') continue;
      shallow[k] = v;
    }
    const reasons = liveScreen(shallow);
    if (snap.purpose !== 'live_activation_seam') reasons.push('purpose_invalid');

    // snapshot-once each consumed component, then screen + recognize the SAME snapshot
    let boundarySnap = null;
    let checklistSnap = null;
    try {
      boundarySnap = liveSnapshot(snap.live_source_boundary);
      checklistSnap = liveSnapshot(snap.readiness_checklist);
    } catch {
      return build('LIVE_SEAM_UNCONFIGURED', ['input_inspection_error'], null, false, false);
    }
    for (const c of [boundarySnap, checklistSnap]) {
      if (c == null) continue;
      if (liveHasFunctionValue(c)) {
        return build('LIVE_SEAM_UNCONFIGURED', ['input_inspection_error'], null, false, false);
      }
      if (liveHasForbiddenTrueFlag(c)) reasons.push('forbidden_live_indicator_blocked');
      if (liveHasExecCmdKey(c)) reasons.push('execution_command_blocked');
      if (liveHasEndpointOrCredentialValue(c)) reasons.push('endpoint_or_credential_value_blocked');
    }
    if (liveScreenedInvalid(reasons) || reasons.includes('purpose_invalid')) {
      return build('LIVE_SEAM_INVALID', reasons, null, false, false);
    }

    // owner_approval_ref: OPAQUE — only presence is read; the value is never
    // validated, consumed, or echoed.
    const approval = snap.owner_approval_ref;
    if (approval !== undefined && approval !== null && typeof approval !== 'string') {
      return build('LIVE_SEAM_INVALID', ['owner_approval_ref_invalid'], null, false, false);
    }
    const approvalPresent = (typeof approval === 'string' && approval.length > 0);

    // provider_key_ref_present: strict boolean presence marker (BY REFERENCE only)
    const pkrp = snap.provider_key_ref_present;
    if (pkrp !== undefined && pkrp !== null && typeof pkrp !== 'boolean') {
      return build('LIVE_SEAM_INVALID', ['provider_key_ref_present_invalid'], null, false, false);
    }
    const keyRefMet = (pkrp === true);

    // live_source_boundary: must be a recognized (A) result
    if (snap.live_source_boundary == null) {
      return build('LIVE_SEAM_UNCONFIGURED', ['live_source_boundary_missing'], null, keyRefMet, approvalPresent);
    }
    const boundaryState = liveRecognizeSourceBoundaryResult(boundarySnap);
    if (boundaryState === null) {
      return build('LIVE_SEAM_INVALID', ['component_not_live_source_boundary'], null, false, false);
    }
    if (boundaryState === 'LIVE_SOURCE_INVALID') {
      return build('LIVE_SEAM_INVALID', ['live_source_invalid'], null, false, false);
    }
    if (boundaryState !== 'LIVE_SOURCE_READ_ONLY_OK') {
      return build('LIVE_SEAM_UNCONFIGURED', ['live_source_boundary_not_read_only_ok'], null, keyRefMet, approvalPresent);
    }

    // readiness_checklist: optional; met ONLY when a recognized checklist
    // read-model reports all_met === true.
    let readinessMet = false;
    if (snap.readiness_checklist != null) {
      const checklistState = liveRecognizeChecklistResult(checklistSnap);
      if (checklistState === null) {
        return build('LIVE_SEAM_INVALID', ['component_not_readiness_checklist'], null, false, false);
      }
      readinessMet = (checklistState === 'LIVE_READINESS_CHECKLIST' && checklistSnap.all_met === true);
    }

    const req = liveSeamRequirements(keyRefMet, approvalPresent, readinessMet);
    const unmet = req.filter((x) => x.met !== true).map((x) => x.requirement);
    return build('LIVE_SEAM_DESCRIPTOR',
      ['live_seam_descriptor_only', ...unmet.map((t) => 'unmet_' + t.toLowerCase())],
      req, keyRefMet, approvalPresent);
  } catch {
    return build('LIVE_SEAM_UNCONFIGURED', ['input_inspection_error'], null, false, false);
  }
}

// Recognize a (B) live-activation-seam result fed forward (from a SNAPSHOT).
function liveRecognizeSeamResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.live_seam_state === 'string' && LIVE_SEAM_STATES.includes(snap.live_seam_state)) {
    return snap.live_seam_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (C) STREAM-HEALTH / GAP READ-MODEL
//
// Pure function over SSOT Group 5 CONSUMED-ONLY input field names
// (last_seen_slot / last_confirmed_slot / slot_lag / provider_degraded) plus a
// caller-supplied max_backfill_window_slots that is NEVER defaulted. This is a
// READ-MODEL: it does not change any operating state; the advisory token is
// EXITS_ONLY-shaped AT MOST — a stream gap / provider degradation alone NEVER
// escalates beyond EXITS_ONLY semantics (never KILLED-shaped).
// ---------------------------------------------------------------------------

const LIVE_STREAM_HEALTH_STATES = Object.freeze([
  'LIVE_STREAM_HEALTH_UNCONFIGURED', 'LIVE_STREAM_HEALTH_INVALID',
  'LIVE_STREAM_HEALTH_SYNCED', 'LIVE_STREAM_HEALTH_GAP_RECOVERABLE',
  'LIVE_STREAM_HEALTH_GAP_EXCEEDED', 'LIVE_STREAM_HEALTH_DEGRADED'
]);

const LIVE_STREAM_ADVISORY_TOKENS = Object.freeze([
  'LIVE_ADVISORY_NONE', 'LIVE_ADVISORY_EXITS_ONLY_SHAPED'
]);

function liveIsFiniteNonNegativeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function describeStreamHealthReadModelContract() {
  return Object.freeze({
    contract: 'stream-health-read-model',
    version: '0.0.0',
    test_only: true,
    supported_states: LIVE_STREAM_HEALTH_STATES,
    supported_advisory_tokens: LIVE_STREAM_ADVISORY_TOKENS,
    advisory_only: true,
    read_model_only: true,
    stream_health_state: 'LIVE_STREAM_HEALTH_UNCONFIGURED',
    live_stream_advisory: 'LIVE_ADVISORY_NONE',
    gap_slots: null,
    status: 'LIVE_STREAM_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...liveSafeFlags(),
    note: 'Read-only STREAM-HEALTH / GAP READ-MODEL. Pure deterministic function over { last_seen_slot, last_confirmed_slot, slot_lag, provider_degraded, max_backfill_window_slots } — the first four are SSOT Group 5 field names CONSUMED ONLY as input names (never emitted as output keys, never written anywhere); max_backfill_window_slots is caller-supplied and NEVER defaulted. gap = last_seen_slot - last_confirmed_slot; a negative gap -> LIVE_STREAM_HEALTH_INVALID (inconsistent_slots). gap 0 -> SYNCED; 0 < gap <= window -> GAP_RECOVERABLE; gap > window -> GAP_EXCEEDED; provider_degraded === true -> DEGRADED with worst-of merging (EXCEEDED > DEGRADED > RECOVERABLE > SYNCED). A MISSING window means the gap CANNOT be classified recoverable: gap 0 -> SYNCED, otherwise the fail-safe GAP_EXCEEDED posture with reason missing_backfill_window. live_stream_advisory is a LOCAL advisory token: GAP_EXCEEDED / DEGRADED map to LIVE_ADVISORY_EXITS_ONLY_SHAPED and NEVER anything stronger — a stream gap / provider degradation alone NEVER escalates beyond EXITS_ONLY-shaped semantics (never KILLED-shaped). This is a READ-MODEL ONLY: it does not change, write, or transition any operating state (the SSOT Group 1 operating_state vocabulary WARMING_UP / ACTIVE / EXITS_ONLY is referenced as advisory VOCABULARY only); it grants no execution authority and no trading readiness.'
  });
}

export function evaluateStreamHealthReadModel(input) {
  const build = (state, reasons, gap) => Object.freeze({
    valid: (state !== 'LIVE_STREAM_HEALTH_INVALID'),
    stream_health_state: state,
    live_stream_advisory: (state === 'LIVE_STREAM_HEALTH_GAP_EXCEEDED' || state === 'LIVE_STREAM_HEALTH_DEGRADED')
      ? 'LIVE_ADVISORY_EXITS_ONLY_SHAPED' : 'LIVE_ADVISORY_NONE',
    gap_slots: (typeof gap === 'number') ? gap : null,
    read_model_only: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...liveSafeFlags()
  });
  try {
    const snap = liveSnapshot(input);
    if (snap === null) {
      return build('LIVE_STREAM_HEALTH_UNCONFIGURED', ['no_stream_health_input'], null);
    }
    if (liveHasFunctionValue(snap)) {
      return build('LIVE_STREAM_HEALTH_UNCONFIGURED', ['input_inspection_error'], null);
    }
    const screened = liveScreen(snap);
    if (screened.length > 0) {
      return build('LIVE_STREAM_HEALTH_INVALID', screened, null);
    }

    const seen = snap.last_seen_slot;
    const confirmed = snap.last_confirmed_slot;
    if (seen == null || confirmed == null) {
      return build('LIVE_STREAM_HEALTH_UNCONFIGURED', ['slots_missing'], null);
    }
    if (!liveIsFiniteNonNegativeNumber(seen) || !liveIsFiniteNonNegativeNumber(confirmed)) {
      return build('LIVE_STREAM_HEALTH_INVALID', ['invalid_slot_value'], null);
    }

    const lag = snap.slot_lag;
    if (lag !== undefined && lag !== null && !liveIsFiniteNonNegativeNumber(lag)) {
      return build('LIVE_STREAM_HEALTH_INVALID', ['invalid_slot_lag'], null);
    }

    const degradedFlag = snap.provider_degraded;
    if (degradedFlag !== undefined && degradedFlag !== null && typeof degradedFlag !== 'boolean') {
      return build('LIVE_STREAM_HEALTH_INVALID', ['invalid_provider_degraded'], null);
    }

    const gap = seen - confirmed;
    if (gap < 0) {
      return build('LIVE_STREAM_HEALTH_INVALID', ['inconsistent_slots'], null);
    }

    const window = snap.max_backfill_window_slots;
    const windowMissing = (window === undefined || window === null);
    if (!windowMissing && !liveIsFiniteNonNegativeNumber(window)) {
      return build('LIVE_STREAM_HEALTH_INVALID', ['invalid_backfill_window'], null);
    }

    // classify the gap (the window is NEVER defaulted: when missing, a non-zero
    // gap CANNOT be classified recoverable -> fail-safe GAP_EXCEEDED posture)
    let gapState;
    const reasons = [];
    if (gap === 0) {
      gapState = 'LIVE_STREAM_HEALTH_SYNCED';
      reasons.push('stream_synced');
      if (windowMissing) reasons.push('missing_backfill_window');
    } else if (windowMissing) {
      gapState = 'LIVE_STREAM_HEALTH_GAP_EXCEEDED';
      reasons.push('missing_backfill_window');
    } else if (gap <= window) {
      gapState = 'LIVE_STREAM_HEALTH_GAP_RECOVERABLE';
      reasons.push('gap_within_backfill_window');
    } else {
      gapState = 'LIVE_STREAM_HEALTH_GAP_EXCEEDED';
      reasons.push('gap_exceeds_backfill_window');
    }

    // worst-of merge with provider degradation: EXCEEDED > DEGRADED > RECOVERABLE > SYNCED
    if (degradedFlag === true) {
      reasons.push('provider_degraded_reported');
      if (gapState !== 'LIVE_STREAM_HEALTH_GAP_EXCEEDED') {
        gapState = 'LIVE_STREAM_HEALTH_DEGRADED';
      }
    }
    return build(gapState, reasons, gap);
  } catch {
    return build('LIVE_STREAM_HEALTH_UNCONFIGURED', ['input_inspection_error'], null);
  }
}

// Recognize a (C) stream-health result fed forward (from a SNAPSHOT).
function liveRecognizeStreamHealthResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.stream_health_state === 'string' && LIVE_STREAM_HEALTH_STATES.includes(snap.stream_health_state)) {
    return snap.stream_health_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (D) LIVE-READINESS CHECKLIST READ-MODEL
//
// Pure DESCRIPTIVE checklist for the WARMING_UP -> ACTIVE preconditions (SSOT
// Group 1 vocabulary consumed ONLY as descriptions — this read-model never
// writes or transitions any operating state). Unknown / missing / non-boolean
// items are NOT met (fail-safe: unknown is NOT met). Readiness DISPLAY is NOT
// trading readiness and grants nothing.
// ---------------------------------------------------------------------------

const LIVE_READINESS_STATES = Object.freeze([
  'LIVE_READINESS_UNCONFIGURED', 'LIVE_READINESS_INVALID', 'LIVE_READINESS_CHECKLIST'
]);

const LIVE_READINESS_ITEMS = Object.freeze([
  Object.freeze(['priority_fee_cache_warm', 'LIVE_CHECK_PRIORITY_FEE_CACHE_WARM']),
  Object.freeze(['protocol_constants_green', 'LIVE_CHECK_PROTOCOL_CONSTANTS_GREEN']),
  Object.freeze(['rpc_health_green', 'LIVE_CHECK_RPC_HEALTH_GREEN']),
  Object.freeze(['stream_synced', 'LIVE_CHECK_STREAM_SYNCED']),
  Object.freeze(['calibration_priors_loaded', 'LIVE_CHECK_CALIBRATION_PRIORS_LOADED']),
  Object.freeze(['cost_pipeline_ready', 'LIVE_CHECK_COST_PIPELINE_READY'])
]);

const LIVE_READINESS_ITEM_TOKENS = Object.freeze(LIVE_READINESS_ITEMS.map((x) => x[1]));

export function describeLiveReadinessChecklistContract() {
  return Object.freeze({
    contract: 'live-readiness-checklist',
    version: '0.0.0',
    test_only: true,
    supported_states: LIVE_READINESS_STATES,
    supported_item_tokens: LIVE_READINESS_ITEM_TOKENS,
    advisory_only: true,
    read_model_only: true,
    live_readiness_state: 'LIVE_READINESS_UNCONFIGURED',
    checklist: Object.freeze([]),
    all_met: false,
    status: 'LIVE_READINESS_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...liveSafeFlags(),
    note: 'Read-only LIVE-READINESS CHECKLIST READ-MODEL. A pure DESCRIPTIVE checklist for the WARMING_UP -> ACTIVE preconditions (priority-fee cache warm, protocol constants green, RPC health green, stream synced, calibration priors loaded, cost pipeline ready) — the SSOT Group 1 operating_state vocabulary (WARMING_UP / ACTIVE / EXITS_ONLY) is consumed ONLY as descriptive VOCABULARY; this read-model never writes, emits, or transitions any runtime operating state. Input is a set of caller-supplied booleans|null; a null / missing / non-boolean item is fail-safe NOT met with reason unknown_not_verified (unknown is NOT met; a truthy non-boolean is NOT met). Output checklist is a frozen array of { item (LOCAL LIVE_CHECK_* token), met:boolean, reason } plus all_met:boolean. ADVISORY ONLY: readiness DISPLAY is NOT trading readiness and GRANTS NOTHING — all_met:true opens no entry, no signing, no sending, no live stream, no activation, and never feeds execution authority.'
  });
}

export function evaluateLiveReadinessChecklist(input) {
  const build = (state, reasons, checklist, allMet) => Object.freeze({
    valid: (state !== 'LIVE_READINESS_INVALID'),
    live_readiness_state: state,
    checklist: checklist || Object.freeze([]),
    all_met: allMet === true,
    read_model_only: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...liveSafeFlags()
  });
  try {
    const snap = liveSnapshot(input);
    if (snap === null) {
      return build('LIVE_READINESS_UNCONFIGURED', ['no_live_readiness_input'], null, false);
    }
    if (liveHasFunctionValue(snap)) {
      return build('LIVE_READINESS_UNCONFIGURED', ['input_inspection_error'], null, false);
    }
    const screened = liveScreen(snap);
    if (screened.length > 0) {
      return build('LIVE_READINESS_INVALID', screened, null, false);
    }

    const items = [];
    for (const [field, token] of LIVE_READINESS_ITEMS) {
      const v = snap[field];
      if (v === true) {
        items.push(Object.freeze({ item: token, met: true, reason: 'verified_by_caller_input' }));
      } else if (v === false) {
        items.push(Object.freeze({ item: token, met: false, reason: 'reported_not_ready' }));
      } else {
        // null / missing / non-boolean -> fail-safe: unknown is NOT met
        items.push(Object.freeze({ item: token, met: false, reason: 'unknown_not_verified' }));
      }
    }
    const allMet = items.every((x) => x.met === true);
    return build('LIVE_READINESS_CHECKLIST', ['live_readiness_checklist_descriptive_only'],
      Object.freeze(items), allMet);
  } catch {
    return build('LIVE_READINESS_UNCONFIGURED', ['input_inspection_error'], null, false);
  }
}

// Recognize a (D) live-readiness-checklist result fed forward (from a SNAPSHOT).
function liveRecognizeChecklistResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.live_readiness_state === 'string' && LIVE_READINESS_STATES.includes(snap.live_readiness_state)) {
    return snap.live_readiness_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (E) LIVE SUPPRESSION
//
// ALWAYS suppressed:true. The live-stream boundary layer is NEVER execution /
// sign / send authorized, so the three not_*_authorized tokens are ALWAYS
// emitted; component codes are added when a consumed component is unclean.
// ---------------------------------------------------------------------------

const LIVE_SUPPRESSION_REASON_CODES = Object.freeze([
  'live_source_invalid', 'stream_gap_exceeded', 'seam_not_ready',
  'live_surface_detected', 'not_execution_authorized', 'not_sign_authorized',
  'not_send_authorized'
]);

const LIVE_SUPPRESSION_ALWAYS = Object.freeze([
  'not_execution_authorized', 'not_sign_authorized', 'not_send_authorized'
]);

export function describeLiveSuppressionContract() {
  return Object.freeze({
    contract: 'live-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: LIVE_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: true,
    suppression_reasons: LIVE_SUPPRESSION_ALWAYS,
    status: 'LIVE_SUPPRESSED',
    reasons: LIVE_SUPPRESSION_ALWAYS,
    ...liveSafeFlags(),
    note: 'Read-only LIVE SUPPRESSION. ALWAYS suppressed:true — the live-stream boundary layer is NEVER execution / sign / send authorized, so not_execution_authorized + not_sign_authorized + not_send_authorized are ALWAYS carried on every result, including a perfectly clean one. Component codes are added when a consumed component is unclean: live_source_boundary not LIVE_SOURCE_READ_ONLY_OK -> live_source_invalid; stream_health LIVE_STREAM_HEALTH_GAP_EXCEEDED -> stream_gap_exceeded; live_activation_seam present (seam_ready_advisory is always false in this package) -> seam_not_ready; live_surface LIVE_SURFACE_BLOCKED -> live_surface_detected. Suppression prevents progression and reports REASONS ONLY — it opens nothing, connects nothing, and never escalates: a stream gap alone stays EXITS_ONLY-shaped advisory at most and is never KILLED-shaped.'
  });
}

export function evaluateLiveSuppression(input) {
  const build = (codes) => {
    const merged = [...new Set([...(codes || []), ...LIVE_SUPPRESSION_ALWAYS])]
      .filter((c) => LIVE_SUPPRESSION_REASON_CODES.includes(c));
    return Object.freeze({
      suppressed: true,
      suppression_reasons: Object.freeze(merged),
      status: 'LIVE_SUPPRESSED',
      reasons: Object.freeze(merged),
      advisory_only: true,
      ...liveSafeFlags()
    });
  };
  try {
    const snap = liveSnapshot(input);
    if (snap === null || liveHasFunctionValue(snap)) {
      // hostile / missing -> still suppressed, always carrying the three tokens
      return build([]);
    }
    const codes = [];

    let sourceSnap = null;
    let streamSnap = null;
    let seamSnap = null;
    let surfaceSnap = null;
    try {
      sourceSnap = liveSnapshot(snap.live_source_boundary);
      streamSnap = liveSnapshot(snap.stream_health);
      seamSnap = liveSnapshot(snap.live_activation_seam);
      surfaceSnap = liveSnapshot(snap.live_surface);
    } catch {
      return build([]);
    }

    if (snap.live_source_boundary != null) {
      const s = liveRecognizeSourceBoundaryResult(sourceSnap);
      if (s !== 'LIVE_SOURCE_READ_ONLY_OK') codes.push('live_source_invalid');
    }
    if (snap.stream_health != null) {
      const s = liveRecognizeStreamHealthResult(streamSnap);
      if (s === 'LIVE_STREAM_HEALTH_GAP_EXCEEDED') codes.push('stream_gap_exceeded');
    }
    if (snap.live_activation_seam != null) {
      const s = liveRecognizeSeamResult(seamSnap);
      // seam_ready_advisory is ALWAYS false in this package, so a present seam
      // descriptor is ALWAYS seam-not-ready (and an unrecognized one is too).
      if (s === null || seamSnap.seam_ready_advisory !== true) codes.push('seam_not_ready');
    }
    if (snap.live_surface != null) {
      const s = liveRecognizeSurfaceResult(surfaceSnap);
      if (s === 'LIVE_SURFACE_BLOCKED') codes.push('live_surface_detected');
    }
    return build(codes);
  } catch {
    return build([]);
  }
}

// Recognize a (E) live-suppression result fed forward (from a SNAPSHOT).
function liveRecognizeSuppressionResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.suppressed === 'boolean' && Array.isArray(snap.suppression_reasons)) {
    return snap.suppressed;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (F) LIVE FORBIDDEN SURFACE GUARD
//
// Proves the live boundary neither produces nor accepts key material, raw
// provider credentials, or live endpoint/connection surfaces. Detects forbidden
// field NAMES (top-level keys only) and reports a REDACTED forbidden_field_ref
// (the matched NAME only) — NEVER the field VALUE. The detection booleans are
// DETECTION outputs (true == found == BLOCKED == the SAFE blocked state); they
// are NOT readiness/exec flags. provider_key_ref is NOT forbidden — it is the
// sanctioned BY-REFERENCE name (its VALUE is shape-checked in the live-source
// boundary).
// ---------------------------------------------------------------------------

const LIVE_SURFACE_STATES = Object.freeze([
  'LIVE_SURFACE_UNCONFIGURED', 'LIVE_SURFACE_CLEAN', 'LIVE_SURFACE_BLOCKED'
]);

// key-material NAMES (fixed string literals in this refusal allowlist + prose only)
const LIVE_SURFACE_KEY_MATERIAL_NAMES = Object.freeze([
  'private_key', 'privateKey', 'secret_key', 'secretKey', 'keypair', 'keyPair',
  'mnemonic', 'seed', 'seed_phrase', 'seedPhrase', 'secret_seed', 'raw_key',
  'rawKey', 'signing_key', 'signingKey', 'signer_secret', 'signerSecret'
]);

// credential NAMES (the Stage-17 extension: raw provider credential field names)
const LIVE_SURFACE_CREDENTIAL_NAMES = Object.freeze([
  'api_key', 'apiKey', 'bearer_token', 'bearerToken', 'access_token',
  'accessToken', 'auth_token', 'authToken', 'provider_key', 'providerKey',
  'provider_secret', 'providerSecret', 'token', 'secret', 'password',
  'credential', 'credentials'
]);

// live endpoint / connection NAMES
const LIVE_SURFACE_ENDPOINT_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'endpointUrl', 'url', 'rpc_url', 'rpcUrl',
  'ws_url', 'wsUrl', 'stream_url', 'streamUrl', 'grpc_endpoint', 'grpcEndpoint',
  'connection_string', 'connectionString', 'live_endpoint', 'liveEndpoint',
  'live_url', 'liveUrl'
]);

const LIVE_SURFACE_FORBIDDEN_NAMES = Object.freeze([
  ...LIVE_SURFACE_KEY_MATERIAL_NAMES,
  ...LIVE_SURFACE_CREDENTIAL_NAMES,
  ...LIVE_SURFACE_ENDPOINT_NAMES
]);

export function describeLiveForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'live-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    supported_states: LIVE_SURFACE_STATES,
    forbidden_field_names: LIVE_SURFACE_FORBIDDEN_NAMES,
    advisory_only: true,
    live_surface_state: 'LIVE_SURFACE_UNCONFIGURED',
    key_material_detected: false,
    credential_detected: false,
    live_surface_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'LIVE_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...liveSafeFlags(),
    note: 'Read-only LIVE FORBIDDEN SURFACE GUARD. Proves the Stage-17 live boundary neither produces nor accepts key material, raw provider credentials, or live endpoint/connection surfaces. It scans ONLY top-level keys (deterministic, bounded, pure, snapshot-once) for forbidden field NAMES: key material (private_key, privateKey, secret_key, secretKey, keypair, keyPair, mnemonic, seed, seed_phrase, seedPhrase, secret_seed, raw_key, rawKey, signing_key, signingKey, signer_secret, signerSecret), raw credentials (api_key, apiKey, bearer_token, bearerToken, access_token, accessToken, auth_token, authToken, provider_key, providerKey, provider_secret, providerSecret, token, secret, password, credential, credentials), and live endpoints (endpoint, endpoint_url, endpointUrl, url, rpc_url, rpcUrl, ws_url, wsUrl, stream_url, streamUrl, grpc_endpoint, grpcEndpoint, connection_string, connectionString, live_endpoint, liveEndpoint, live_url, liveUrl). provider_key_ref is NOT forbidden — it is the single sanctioned BY-REFERENCE name; its VALUE is shape-checked in the live-source boundary. The detection booleans key_material_detected / credential_detected / live_surface_detected / forbidden_field_detected are DETECTION outputs (true == found == BLOCKED == the SAFE blocked state); they are NOT readiness/execution flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing / hostile input -> LIVE_SURFACE_UNCONFIGURED (frozen, never throws); no forbidden name -> LIVE_SURFACE_CLEAN; ANY forbidden name -> LIVE_SURFACE_BLOCKED.'
  });
}

export function evaluateLiveForbiddenSurface(input) {
  const build = (state, kind, ref, reasons) => Object.freeze({
    live_surface_state: state,
    key_material_detected: (state === 'LIVE_SURFACE_BLOCKED') ? (kind === 'key') : false,
    credential_detected: (state === 'LIVE_SURFACE_BLOCKED') ? (kind === 'credential') : false,
    live_surface_detected: (state === 'LIVE_SURFACE_BLOCKED') ? (kind === 'endpoint') : false,
    forbidden_field_detected: (state === 'LIVE_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'LIVE_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    advisory_only: true,
    ...liveSafeFlags()
  });
  try {
    const snap = liveSnapshot(input);
    if (snap === null) {
      return build('LIVE_SURFACE_UNCONFIGURED', null, null, ['no_live_surface_input']);
    }
    // scan top-level NAMES first (names matter; values are never echoed)
    for (const k of Object.keys(snap)) {
      if (LIVE_SURFACE_KEY_MATERIAL_NAMES.includes(k)) {
        return build('LIVE_SURFACE_BLOCKED', 'key', k, ['key_material_detected']);
      }
      if (LIVE_SURFACE_CREDENTIAL_NAMES.includes(k)) {
        return build('LIVE_SURFACE_BLOCKED', 'credential', k, ['credential_detected']);
      }
      if (LIVE_SURFACE_ENDPOINT_NAMES.includes(k)) {
        return build('LIVE_SURFACE_BLOCKED', 'endpoint', k, ['live_surface_detected']);
      }
    }
    if (liveHasFunctionValue(snap)) {
      return build('LIVE_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    return build('LIVE_SURFACE_CLEAN', null, null, ['live_surface_clean']);
  } catch {
    return build('LIVE_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// Recognize a (F) live-surface result fed forward (from a SNAPSHOT).
function liveRecognizeSurfaceResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.live_surface_state === 'string' && LIVE_SURFACE_STATES.includes(snap.live_surface_state)) {
    return snap.live_surface_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (G) LIVE-BOUNDARY HEALTH
//
// Aggregates (A)-(F); derives STATUS ONLY. The clean path is _SUPPRESSED —
// suppression is always active for execution/sign/send at this layer, so a
// fully-reviewed clean boundary is STILL suppressed. Every state keeps all 24
// readiness/execution flags false.
// ---------------------------------------------------------------------------

const LIVE_BOUNDARY_HEALTH_STATES = Object.freeze([
  'LIVE_BOUNDARY_HEALTH_UNCONFIGURED', 'LIVE_BOUNDARY_HEALTH_DEGRADED',
  'LIVE_BOUNDARY_HEALTH_REVIEWED_ADVISORY', 'LIVE_BOUNDARY_HEALTH_SUPPRESSED',
  'LIVE_BOUNDARY_HEALTH_BLOCKED'
]);

const LIVE_BOUNDARY_HEALTH_COMPONENTS = Object.freeze([
  'live_source_boundary', 'live_activation_seam', 'stream_health',
  'readiness_checklist', 'live_suppression', 'live_surface'
]);

export function describeLiveBoundaryHealthContract() {
  return Object.freeze({
    contract: 'live-boundary-health',
    version: '0.0.0',
    test_only: true,
    supported_states: LIVE_BOUNDARY_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    live_boundary_health_state: 'LIVE_BOUNDARY_HEALTH_UNCONFIGURED',
    status: 'LIVE_BOUNDARY_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...liveSafeFlags(),
    note: 'Read-only LIVE-BOUNDARY HEALTH. Aggregates the Stage-17 live-source boundary (A) + live-activation seam descriptor (B) + stream-health read-model (C) + live-readiness checklist (D) + live suppression (E) + live forbidden surface (F) and DERIVES STATUS ONLY. Ordering (Fail-Safe-Not-Fail-Open): smuggled forbidden flag / execution command / credential NAME / endpoint value on the top level or any component -> LIVE_BOUNDARY_HEALTH_BLOCKED; live_surface LIVE_SURFACE_BLOCKED or any component *_INVALID -> LIVE_BOUNDARY_HEALTH_BLOCKED; any component missing or unrecognized -> LIVE_BOUNDARY_HEALTH_UNCONFIGURED; live_suppression.suppressed === true -> LIVE_BOUNDARY_HEALTH_SUPPRESSED — and because suppression is ALWAYS active at this layer, the CLEAN PATH lands on _SUPPRESSED; a (theoretical) unsuppressed clean review (source READ_ONLY_OK + seam DESCRIPTOR + stream SYNCED or GAP_RECOVERABLE + checklist CHECKLIST + surface CLEAN) -> LIVE_BOUNDARY_HEALTH_REVIEWED_ADVISORY; anything else -> LIVE_BOUNDARY_HEALTH_DEGRADED. A stream gap / provider degradation alone NEVER escalates beyond EXITS_ONLY-shaped advisory (DEGRADED here, never BLOCKED, never KILLED-shaped). Every state keeps every readiness/execution flag false and grants no execution authority.'
  });
}

export function evaluateLiveBoundaryHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'LIVE_BOUNDARY_HEALTH_BLOCKED'),
    live_boundary_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    advisory_only: true,
    ...liveSafeFlags()
  });
  try {
    const snap = liveSnapshot(inputs);
    if (snap === null) {
      return build('LIVE_BOUNDARY_HEALTH_UNCONFIGURED', ['no_live_boundary_health_input']);
    }
    if (liveHasFunctionValue(snap)) {
      return build('LIVE_BOUNDARY_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }

    // smuggle screen: top-level minus component slots, then every component
    const shallow = {};
    for (const [k, v] of Object.entries(snap)) {
      if (!LIVE_BOUNDARY_HEALTH_COMPONENTS.includes(k)) shallow[k] = v;
    }
    let blockedBySmuggle = liveScreen(shallow).length > 0;
    const componentSnaps = {};
    for (const k of LIVE_BOUNDARY_HEALTH_COMPONENTS) {
      let c = null;
      try {
        c = liveSnapshot(snap[k]);
      } catch {
        return build('LIVE_BOUNDARY_HEALTH_UNCONFIGURED', ['input_inspection_error']);
      }
      componentSnaps[k] = c;
      if (c == null) continue;
      if (liveHasFunctionValue(c)) {
        return build('LIVE_BOUNDARY_HEALTH_UNCONFIGURED', ['input_inspection_error']);
      }
      if (liveHasForbiddenTrueFlag(c) || liveHasExecCmdKey(c) ||
          liveHasEndpointOrCredentialValue(c)) {
        blockedBySmuggle = true;
      }
    }
    if (blockedBySmuggle) {
      return build('LIVE_BOUNDARY_HEALTH_BLOCKED', ['forbidden_input_blocked']);
    }

    const sourceState = liveRecognizeSourceBoundaryResult(componentSnaps.live_source_boundary);
    const seamState = liveRecognizeSeamResult(componentSnaps.live_activation_seam);
    const streamState = liveRecognizeStreamHealthResult(componentSnaps.stream_health);
    const checklistState = liveRecognizeChecklistResult(componentSnaps.readiness_checklist);
    const suppressionVal = liveRecognizeSuppressionResult(componentSnaps.live_suppression);
    const surfaceState = liveRecognizeSurfaceResult(componentSnaps.live_surface);

    // hard-block: surface blocked or any component *_INVALID
    if (surfaceState === 'LIVE_SURFACE_BLOCKED') {
      return build('LIVE_BOUNDARY_HEALTH_BLOCKED', ['live_surface_blocked']);
    }
    if (sourceState === 'LIVE_SOURCE_INVALID' || seamState === 'LIVE_SEAM_INVALID' ||
        streamState === 'LIVE_STREAM_HEALTH_INVALID' || checklistState === 'LIVE_READINESS_INVALID') {
      return build('LIVE_BOUNDARY_HEALTH_BLOCKED', ['component_invalid']);
    }

    // any component missing or unrecognized -> UNCONFIGURED
    if (sourceState === null || seamState === null || streamState === null ||
        checklistState === null || suppressionVal === null || surfaceState === null) {
      return build('LIVE_BOUNDARY_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // suppression active -> SUPPRESSED (the CLEAN PATH: suppression is always
    // active for execution/sign/send at this layer)
    if (suppressionVal === true) {
      return build('LIVE_BOUNDARY_HEALTH_SUPPRESSED', ['live_boundary_suppressed']);
    }

    // (theoretical) unsuppressed clean review -> REVIEWED_ADVISORY
    if (sourceState === 'LIVE_SOURCE_READ_ONLY_OK' && seamState === 'LIVE_SEAM_DESCRIPTOR' &&
        (streamState === 'LIVE_STREAM_HEALTH_SYNCED' || streamState === 'LIVE_STREAM_HEALTH_GAP_RECOVERABLE') &&
        checklistState === 'LIVE_READINESS_CHECKLIST' && surfaceState === 'LIVE_SURFACE_CLEAN') {
      return build('LIVE_BOUNDARY_HEALTH_REVIEWED_ADVISORY', ['live_boundary_reviewed_advisory']);
    }

    // anything else (incl. stream GAP_EXCEEDED / DEGRADED) -> DEGRADED, never
    // stronger: a gap alone never escalates beyond EXITS_ONLY-shaped advisory
    return build('LIVE_BOUNDARY_HEALTH_DEGRADED', ['live_boundary_degraded']);
  } catch {
    return build('LIVE_BOUNDARY_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
