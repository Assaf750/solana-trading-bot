// @soltrade/mainnet-activation-seam-foundations
//
// Read-only / advisory ONLY MAINNET REAL-LIVE ACTIVATION SEAM foundation for
// Stage-23 — the FINAL build stage. This is the mainnet analogue of the Stage-17
// live-stream seam and the Stage-21 testnet-send seam: it builds everything UP TO
// the real-money activation switch and NOTHING past it. A READ-ONLY descriptor
// describes what real mainnet REAL-LIVE activation WOULD require and CANNOT
// self-activate under ANY input. Real-money activation is the OWNER's physical,
// out-of-repo decision — this package can NEVER flip can_send, broadcast, sign,
// send, or activate REAL-LIVE.
//
// Import-free, pure, deterministic. NO network primitive, NO fetch /
// XMLHttpRequest / WebSocket / Connection / sendTransaction / sendRawTransaction /
// sendAndConfirmTransaction / .serialize() / socket / grpc, NO Solana / Jupiter /
// Helius / Jito / http-client / db import, NO signing / crypto primitive, NO
// signature produced, NO clock, NO RNG, NO environment access, NO filesystem
// access, NO secrets, NO mutable module/global state.
//
// THE CORE RULE: this package carries NO live primitive and can NEVER be ready.
// activation_performed and real_live_activated are FIXED LITERALS false on EVERY
// state, and can_send / can_broadcast stay FIXED false on every path. A real
// mainnet send adapter is a SEPARATE owner-gated / reviewed / allowlisted decision
// and is explicitly NOT part of Stage 23 — which is why
// MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION is HARDCODED met:false, so
// seam_ready can NEVER be true in this package even with all other requirements
// satisfied and even under forged truthy inputs. The mechanism-guard ALLOWLIST is
// untouched: it stays EXACTLY ['packages/isolated-signer-runtime/src/'] — this
// package adds NO second entry.
//
// Hard-Risk is PRESERVED, never re-implemented or weakened: the seam CONSUMES a
// real-live-readiness verdict (by shape: ready===true required) plus a Hard-Risk
// completeness signal, and treats not-ready / incomplete-Hard-Risk / missing as
// fail-safe (the seam stays not-ready). No implicit infinity. Secrets travel BY
// REFERENCE only (an opaque endpoint_ref); raw key / endpoint / url / seed are
// refused and never echoed (NAME-only redaction). MAINNET-as-a-smuggle: any raw
// mainnet RPC URL / key / PEM / base58 blob in any field/value (including nested
// one level) -> refuse; the value is never echoed. Hostile, throwing, or
// uninspectable input returns a FROZEN refusal and NEVER throws.
// Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract identifier,
// NOT an SSOT name. This package adds NO name to docs/01-SSOT.md. The LOCAL
// MAINNET_* / mainnet_* tokens are local. SSOT Group 1 operating_state values
// (WARMING_UP / ACTIVE / EXITS_ONLY / PAUSED / KILLED) are CONSUMED ONLY by VALUE
// — never emitted as new SSOT names and never given new candidate_* names. Field
// names like api_key / bearer / token / private_key / endpoint / url / seed appear
// ONLY as fixed string literals inside refusal / forbidden-NAME allowlist arrays
// and prose — never as real objects, calls, or emitted output keys.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

// SafeFlags(): read_only:true plus 24 exec/readiness flags pinned false. NONE of
// the 24 may EVER be true on input or output — a mainnet-activation descriptor
// NEVER flips any readiness/execution flag.
function SafeFlags() {
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

// the 24 non-read_only flags above — none may EVER be true on input or output.
const MAINNET_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
]);

// activation/send fixed-false result keys that must NEVER be true on a fed-forward
// result either (a smuggled truthy activation flag -> blocked).
const MAINNET_FORBIDDEN_ACTIVATION_FLAGS = Object.freeze([
  'activation_performed', 'real_live_activated', 'seam_ready', 'send_ready_advisory',
  'activated', 'live_activated'
]);

// Execution-command KEY names refused on any input. The forbidden opportunity /
// batch-exit / send / activation command vocabulary appears here ONLY as fixed
// refusal literals — this package never generates or executes any of them.
const MAINNET_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx', 'serialize',
  'serialize_tx', 'send_tx', 'broadcast_tx', 'quote', 'jupiter_route',
  'load_key', 'load_signer', 'activate_signer', 'route_execute', 'connect',
  'open_stream', 'start_stream', 'subscribe_live', 'activate', 'activate_live',
  'enable_live', 'resolve_endpoint', 'activate_mainnet', 'enable_mainnet',
  'send_mainnet', 'broadcast_mainnet', 'activate_real_live', 'enable_real_live',
  'go_live', 'flip_live', 're_sign', 'resign', 'sign_again',
  'buy_opportunity', 'execute_opportunity', 'submit_opportunity',
  'exit_all_positions', 'batch_exit_all_positions'
]);

// Credential-NAME scan (NAME-only redaction: a matched NAME blocks; the VALUE is
// never read into any reason or output).
const MAINNET_CREDENTIAL_KEY_RE = /secret|api[_-]?key|apikey|bearer|access[_-]?token|auth[_-]?token|\btoken\b|private|seed|mnemonic|keypair|raw_key|credential|password|signing_key|provider_key|provider_secret/i;

// URL / endpoint marker inside string VALUES (scheme://).
const MAINNET_URL_RE = /[a-z][a-z0-9+.-]*:\/\//i;

// A POSITIVE mainnet indicator: `mainnet` / `mainnet-beta` / `prod` as a token,
// but NOT our own NEGATIVE / DESCRIPTIVE vocabulary — `no_mainnet`,
// `mainnet_detected`, `mainnet_enabled`, `MAINNET_REQ_*`, `mainnet_activation_*`.
// The negative-lookbehind excludes a `no_`/`no-`/`not_` prefix, and the
// negative-lookahead excludes our own descriptive suffixes so the package's own
// LOCAL naming and fed-forward result keys do not false-positive on themselves.
const MAINNET_TOKEN_RE = /(?<![a-z_-])(?:mainnet-beta|mainnet|prod)(?!_(?:detected|enabled|refused|activation|seam|req|rpc|wallet|kill|emergency|exit|health|suppression|surface|forbidden|state))/i;

// raw-credential VALUE shapes (PEM block marker / long base58 blob). The value
// itself is never echoed — only a fixed reason code is emitted.
const MAINNET_PEM_RE = /-----BEGIN/;
const MAINNET_BASE58_BLOB_RE = /\b[1-9A-HJ-NP-Za-km-z]{64,}\b/;

// opaque-reference / known field NAMES exempt from the credential-NAME scan.
// mainnet_rpc_endpoint_ref / endpoint_ref are the sanctioned BY-REFERENCE names
// (their VALUE is still shape-checked and never echoed); the rest are domain field
// names whose names must not trip the credential scan.
const MAINNET_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'endpoint_ref', 'mainnet_rpc_endpoint_ref', 'endpoint_ref_present',
  'owner_go_decision_present', 'funded_mainnet_wallet_present', 'capital_limit',
  'all_gates_green', 'real_live_readiness', 'kill_engaged', 'reason',
  'operating_state', 'kill_signal', 'send_gate_refusal', 'hard_risk_completeness',
  'hard_risk_complete', 'mainnet_activation_seam', 'mainnet_kill_switch',
  'mainnet_emergency_exit', 'mainnet_activation_suppression',
  'mainnet_forbidden_surface', 'mainnet_activation_health'
]);

// TOCTOU defense: read every own enumerable property EXACTLY ONCE via a single
// shallow spread; ALL later screening + evaluation walks the SAME snapshot, so a
// hostile counting getter cannot serve clean values to the screen and dirty values
// to the classifier. A getter that throws during the spread is caught by the
// caller and fails closed.
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
  for (const f of MAINNET_FORBIDDEN_TRUE_FLAGS) {
    if (snap[f] === true) return true;
  }
  for (const f of MAINNET_FORBIDDEN_ACTIVATION_FLAGS) {
    if (snap[f] === true) return true;
  }
  return false;
}

function hasExecCmdKey(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const k of Object.keys(snap)) {
    if (MAINNET_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function hasCredentialFieldName(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const k of Object.keys(snap)) {
    if (MAINNET_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (MAINNET_CREDENTIAL_KEY_RE.test(String(k))) return true;
  }
  return false;
}

// scan string VALUES for endpoint/credential markers. Values are never echoed —
// only a fixed reason code is emitted. The sanctioned opaque endpoint_ref values
// are shape-checked elsewhere (their VALUE skip is applied by the caller).
function valueIsDirty(v) {
  if (typeof v !== 'string') return false;
  if (MAINNET_URL_RE.test(v)) return true;
  if (MAINNET_TOKEN_RE.test(v)) return true;
  if (MAINNET_PEM_RE.test(v)) return true;
  if (MAINNET_BASE58_BLOB_RE.test(v)) return true;
  return false;
}

function hasEndpointOrCredentialValue(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const [k, v] of Object.entries(snap)) {
    // the sanctioned opaque endpoint_ref names hold a shape-checked ref; skip the
    // ref VALUE here so a clean opaque ref does not trip the endpoint VALUE scan
    // (the ref is independently shape-validated and refused if secret-shaped).
    if (k === 'endpoint_ref' || k === 'mainnet_rpc_endpoint_ref') continue;
    if (valueIsDirty(v)) return true;
  }
  return false;
}

// MAINNET-AS-A-SMUGGLE scan: any raw mainnet / mainnet-beta / prod token in a KEY
// or string VALUE, including one nested level (plain objects + arrays of plain
// objects). Conservative by design (over-refusal is fail-safe). The package's own
// LOCAL safe-flag KEYS and descriptive MAINNET_*/mainnet_* tokens are excluded by
// the regex's negative lookahead + the explicit safe-key skip.
function hasMainnetTokenShallow(snap) {
  if (snap == null || typeof snap !== 'object') return false;
  for (const k of Object.keys(snap)) {
    if (MAINNET_FORBIDDEN_TRUE_FLAGS.includes(k)) continue;
    if (MAINNET_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (MAINNET_TOKEN_RE.test(String(k))) return true;
  }
  for (const [k, v] of Object.entries(snap)) {
    if (k === 'endpoint_ref' || k === 'mainnet_rpc_endpoint_ref') continue;
    if (typeof v === 'string' && MAINNET_TOKEN_RE.test(v)) return true;
  }
  return false;
}

function hasMainnetTokenNested(value) {
  if (value == null) return false;
  if (typeof value === 'string') return MAINNET_TOKEN_RE.test(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && MAINNET_TOKEN_RE.test(item)) return true;
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
  for (const [k, v] of Object.entries(snap)) {
    if (k === 'endpoint_ref' || k === 'mainnet_rpc_endpoint_ref') continue;
    if (v != null && typeof v === 'object') {
      if (hasMainnetTokenNested(v)) return true;
    }
  }
  return false;
}

// shared screen over a SNAPSHOT. Reasons are fixed codes; no value is echoed.
function screen(snap) {
  const r = [];
  if (snapshotHasMainnet(snap)) r.push('mainnet_smuggle_refused');
  if (hasForbiddenTrueFlag(snap)) r.push('forbidden_activation_indicator_blocked');
  if (hasExecCmdKey(snap)) r.push('execution_command_blocked');
  if (hasCredentialFieldName(snap)) r.push('credential_field_blocked');
  if (hasEndpointOrCredentialValue(snap)) r.push('endpoint_or_credential_value_blocked');
  return r;
}

const SCREEN_REASONS = Object.freeze([
  'mainnet_smuggle_refused', 'forbidden_activation_indicator_blocked',
  'execution_command_blocked', 'credential_field_blocked',
  'endpoint_or_credential_value_blocked'
]);

function screenedInvalid(reasons) {
  return reasons.some((x) => SCREEN_REASONS.includes(x));
}

const ENDPOINT_REF_MAX_LENGTH = 128;

// is the sanctioned opaque endpoint_ref secret/endpoint-shaped? (NAME-only
// redaction: the caller never echoes the value; only a fixed reason code is
// emitted.) A valid endpoint_ref is an opaque SHORT token (refuse ://, whitespace,
// >128 chars, base58-blob / PEM / raw-mainnet shape).
function endpointRefSecretShaped(ref) {
  if (typeof ref !== 'string') return true;
  if (ref.length === 0 || ref.length > ENDPOINT_REF_MAX_LENGTH) return true;
  if (ref.indexOf('://') !== -1) return true;
  if (/\s/.test(ref)) return true;
  if (MAINNET_PEM_RE.test(ref)) return true;
  if (/^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(ref)) return true;
  if (MAINNET_BASE58_BLOB_RE.test(ref)) return true;
  if (MAINNET_TOKEN_RE.test(ref)) return true;
  return false;
}

function isFiniteNumberGtZero(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

// Recognize a real-live-readiness verdict by SHAPE (opaque): the @soltrade/real-
// live-readiness evaluator returns { ready:boolean, blockers:[...],
// prerequisite_for:'activate_real_live' }. We CONSUME it by shape: ready===true is
// required; anything else (not-ready / wrong shape / missing) -> fail-safe.
function readinessVerdictReady(snap) {
  if (snap == null || typeof snap !== 'object' || Array.isArray(snap)) return false;
  if (snap.ready !== true) return false;
  if (!Array.isArray(snap.blockers)) return false;
  if (snap.blockers.length !== 0) return false;
  return true;
}

// SSOT Group 1 operating_state values — CONSUMED ONLY by VALUE.
const OPERATING_STATE_VALUES = Object.freeze([
  'WARMING_UP', 'ACTIVE', 'EXITS_ONLY', 'PAUSED', 'KILLED'
]);

// ---------------------------------------------------------------------------
// (A) MAINNET-ACTIVATION SEAM DESCRIPTOR — the CORE never-ready seam.
//
// A READ-MODEL describing what real mainnet REAL-LIVE activation WOULD require,
// activating NOTHING. activation_performed:false AND real_live_activated:false AND
// can_send:false are FIXED LITERALS on every state.
// MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION is HARDCODED met:false, so
// seam_ready can NEVER be true in-package — even across ALL met-combinations of the
// other requirements and even under forged truthy inputs. Opens nothing.
// ---------------------------------------------------------------------------

const MAINNET_SEAM_STATES = Object.freeze([
  'MAINNET_SEAM_UNCONFIGURED', 'MAINNET_SEAM_INVALID', 'MAINNET_SEAM_DESCRIPTOR'
]);

const MAINNET_SEAM_REQUIREMENT_TOKENS = Object.freeze([
  'MAINNET_REQ_OWNER_GO_DECISION', 'MAINNET_REQ_FUNDED_MAINNET_WALLET',
  'MAINNET_REQ_MAINNET_RPC_ENDPOINT_REF', 'MAINNET_REQ_CAPITAL_LIMIT',
  'MAINNET_REQ_ALL_GATES_GREEN', 'MAINNET_REQ_REAL_LIVE_READY',
  'MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION'
]);

// what the owner must supply OUT-OF-REPO before any real mainnet activation — a
// frozen, documentary list. The repo holds NONE of these.
const MAINNET_REQUIRED_OWNER_INPUTS = Object.freeze([
  'owner_physical_go_decision_out_of_repo',
  'owner_funded_mainnet_wallet_out_of_repo',
  'owner_supplied_mainnet_rpc_endpoint_ref_out_of_repo',
  'owner_set_capital_limit_out_of_repo',
  'owner_confirmed_all_gates_green_out_of_repo',
  'separate_send_adapter_allowlist_governance_decision'
]);

function mainnetSeamRequirements(goMet, fundedMet, rpcRefMet, capitalMet, gatesMet, readyMet) {
  return Object.freeze([
    Object.freeze({ requirement: 'MAINNET_REQ_OWNER_GO_DECISION', met: goMet === true }),
    Object.freeze({ requirement: 'MAINNET_REQ_FUNDED_MAINNET_WALLET', met: fundedMet === true }),
    Object.freeze({ requirement: 'MAINNET_REQ_MAINNET_RPC_ENDPOINT_REF', met: rpcRefMet === true }),
    Object.freeze({ requirement: 'MAINNET_REQ_CAPITAL_LIMIT', met: capitalMet === true }),
    Object.freeze({ requirement: 'MAINNET_REQ_ALL_GATES_GREEN', met: gatesMet === true }),
    Object.freeze({ requirement: 'MAINNET_REQ_REAL_LIVE_READY', met: readyMet === true }),
    // HARDCODED met:false — a real mainnet send adapter is a SEPARATE owner-gated /
    // reviewed / allowlisted decision that does NOT exist in this package; the seam
    // can never claim this requirement, so seam_ready can never be true in-package.
    Object.freeze({ requirement: 'MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION', met: false })
  ]);
}

export function describeMainnetActivationSeamContract() {
  return Object.freeze({
    contract: 'mainnet-activation-seam',
    version: '0.0.0',
    test_only: true,
    supported_states: MAINNET_SEAM_STATES,
    supported_requirement_tokens: MAINNET_SEAM_REQUIREMENT_TOKENS,
    required_owner_inputs: MAINNET_REQUIRED_OWNER_INPUTS,
    advisory_only: true,
    mainnet_seam_state: 'MAINNET_SEAM_UNCONFIGURED',
    activation_performed: false,
    real_live_activated: false,
    seam_ready: false,
    seam_requirements: mainnetSeamRequirements(false, false, false, false, false, false),
    endpoint_in_repo: false,
    key_in_repo: false,
    funds_in_repo: false,
    status: 'MAINNET_SEAM_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...SafeFlags(),
    note: 'Read-only MAINNET-ACTIVATION SEAM DESCRIPTOR — the CORE never-ready seam of Stage-23 (the FINAL build stage). A READ-MODEL that DESCRIBES what real mainnet REAL-LIVE activation WOULD require, without activating anything: activation_performed AND real_live_activated AND seam_ready AND can_send are FIXED LITERALS false on EVERY state, and endpoint_in_repo / key_in_repo / funds_in_repo are FIXED false. seam_requirements is a frozen array of LOCAL requirement tokens with met:boolean each (MAINNET_REQ_OWNER_GO_DECISION, MAINNET_REQ_FUNDED_MAINNET_WALLET, MAINNET_REQ_MAINNET_RPC_ENDPOINT_REF, MAINNET_REQ_CAPITAL_LIMIT, MAINNET_REQ_ALL_GATES_GREEN, MAINNET_REQ_REAL_LIVE_READY, MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION). The LAST requirement is HARDCODED met:false in this package because a real mainnet send adapter is a SEPARATE owner-gated / reviewed / allowlisted decision that does NOT exist here — therefore seam_ready is ALWAYS false, false WHENEVER any requirement is unmet, and ALWAYS false while the adapter-allowlist requirement is unmet across ALL met-combinations of the others AND even under forged truthy inputs: the descriptor can NEVER claim a readiness it cannot have (mirrors the Stage-17 / Stage-21 separate-adapter requirement). required_owner_inputs documents exactly what the owner must supply OUT-OF-REPO (a physical go decision, a funded mainnet wallet, a mainnet RPC endpoint as an opaque endpoint_ref, a capital limit, the all-gates-green confirmation, and the separate send-adapter allowlist governance decision); the repo holds NONE of them. Inputs are presence/shape/read-model ONLY — never a value: owner_go_decision_present (bool), funded_mainnet_wallet_present (bool), mainnet_rpc_endpoint_ref (opaque ref, shape-checked, value never echoed), capital_limit (a finite number > 0; missing / non-finite / <=0 / Infinity -> requirement met:false; no implicit infinity), all_gates_green (bool), and real_live_readiness (a real-live-readiness verdict CONSUMED BY SHAPE: ready===true with zero blockers required; a not-ready / missing verdict -> requirement met:false). Hard-Risk is PRESERVED, never re-implemented: a not-ready readiness verdict reflects incomplete Hard-Risk and keeps the seam not-ready. MAINNET-AS-A-SMUGGLE: any raw mainnet / mainnet-beta / prod token anywhere (incl. nested) -> MAINNET_SEAM_INVALID mainnet_smuggle_refused. Fail-Safe-Not-Fail-Open: missing input -> MAINNET_SEAM_UNCONFIGURED; smuggled credential / endpoint / execution material, a secret-shaped endpoint_ref, or wrong purpose -> MAINNET_SEAM_INVALID (values never echoed). The seam OPENS NOTHING and grants no execution authority.'
  });
}

export function evaluateMainnetActivationSeam(input) {
  const build = (state, reasons, req, refsPresent) => Object.freeze({
    valid: (state !== 'MAINNET_SEAM_INVALID'),
    mainnet_seam_state: state,
    // FIXED LITERALS: this descriptor never activates anything and can never be ready.
    activation_performed: false,
    real_live_activated: false,
    seam_ready: false,
    seam_requirements: req || mainnetSeamRequirements(false, false, false, false, false, false),
    endpoint_in_repo: false,
    key_in_repo: false,
    funds_in_repo: false,
    owner_go_decision_present: (refsPresent && refsPresent.go === true),
    funded_mainnet_wallet_present: (refsPresent && refsPresent.funded === true),
    mainnet_rpc_endpoint_ref_present: (refsPresent && refsPresent.rpc === true),
    capital_limit_present: (refsPresent && refsPresent.capital === true),
    all_gates_green_present: (refsPresent && refsPresent.gates === true),
    real_live_ready_present: (refsPresent && refsPresent.ready === true),
    required_owner_inputs: MAINNET_REQUIRED_OWNER_INPUTS,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...SafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('MAINNET_SEAM_UNCONFIGURED', ['no_mainnet_seam_input'], null, null);
    }
    if (hasFunctionValue(snap)) {
      return build('MAINNET_SEAM_UNCONFIGURED', ['input_inspection_error'], null, null);
    }

    // screen the top level minus the readiness verdict slot (snapshot+screened
    // separately so a nested credential/mainnet is still caught).
    const shallow = {};
    for (const [k, v] of Object.entries(snap)) {
      if (k === 'real_live_readiness') continue;
      shallow[k] = v;
    }
    const reasons = screen(shallow);
    if (snap.purpose !== 'mainnet_activation_seam') reasons.push('purpose_invalid');

    let readinessSnap = null;
    try {
      readinessSnap = snapshot(snap.real_live_readiness);
    } catch {
      return build('MAINNET_SEAM_UNCONFIGURED', ['input_inspection_error'], null, null);
    }
    if (readinessSnap != null) {
      if (hasFunctionValue(readinessSnap)) {
        return build('MAINNET_SEAM_UNCONFIGURED', ['input_inspection_error'], null, null);
      }
      if (snapshotHasMainnet(readinessSnap)) reasons.push('mainnet_smuggle_refused');
      if (hasForbiddenTrueFlag(readinessSnap)) reasons.push('forbidden_activation_indicator_blocked');
      if (hasExecCmdKey(readinessSnap)) reasons.push('execution_command_blocked');
      if (hasEndpointOrCredentialValue(readinessSnap)) reasons.push('endpoint_or_credential_value_blocked');
    }

    if (reasons.includes('mainnet_smuggle_refused')) {
      return build('MAINNET_SEAM_INVALID', ['mainnet_smuggle_refused'], null, null);
    }
    if (screenedInvalid(reasons) || reasons.includes('purpose_invalid')) {
      return build('MAINNET_SEAM_INVALID', reasons, null, null);
    }

    // presence-only / shape-only booleans (BY REFERENCE — no value validated/echoed).
    const checkBool = (v, code) => {
      if (v !== undefined && v !== null && typeof v !== 'boolean') return code;
      return null;
    };
    const e1 = checkBool(snap.owner_go_decision_present, 'owner_go_decision_present_invalid');
    const e2 = checkBool(snap.funded_mainnet_wallet_present, 'funded_mainnet_wallet_present_invalid');
    const e3 = checkBool(snap.all_gates_green_present, 'all_gates_green_present_invalid');
    const e4 = checkBool(snap.all_gates_green, 'all_gates_green_invalid');
    for (const e of [e1, e2, e3, e4]) {
      if (e) return build('MAINNET_SEAM_INVALID', [e], null, null);
    }

    // optional mainnet_rpc_endpoint_ref: opaque BY-REFERENCE token only.
    let rpcRefMet = false;
    if (snap.mainnet_rpc_endpoint_ref !== undefined && snap.mainnet_rpc_endpoint_ref !== null) {
      if (endpointRefSecretShaped(snap.mainnet_rpc_endpoint_ref)) {
        return build('MAINNET_SEAM_INVALID', ['mainnet_rpc_endpoint_ref_secret_shaped'], null, null);
      }
      rpcRefMet = true;
    }

    // capital_limit: a finite number > 0 (no implicit infinity). Missing / non-finite
    // / <=0 / Infinity -> requirement met:false (NOT an INVALID — simply unmet).
    const capitalMet = isFiniteNumberGtZero(snap.capital_limit);

    // readiness verdict consumed BY SHAPE: ready===true with zero blockers.
    const readyMet = readinessVerdictReady(readinessSnap);

    const goMet = (snap.owner_go_decision_present === true);
    const fundedMet = (snap.funded_mainnet_wallet_present === true);
    // all_gates_green accepted from either an explicit bool field or the present flag.
    const gatesMet = (snap.all_gates_green === true) || (snap.all_gates_green_present === true);

    const refsPresent = {
      go: goMet, funded: fundedMet, rpc: rpcRefMet, capital: capitalMet,
      gates: gatesMet, ready: readyMet
    };

    // no recognizable seam input at all -> UNCONFIGURED (still a frozen descriptor).
    const anyPresent = goMet || fundedMet || rpcRefMet || capitalMet || gatesMet ||
      (snap.real_live_readiness != null);
    const req = mainnetSeamRequirements(goMet, fundedMet, rpcRefMet, capitalMet, gatesMet, readyMet);
    if (!anyPresent) {
      return build('MAINNET_SEAM_UNCONFIGURED', ['no_mainnet_seam_signals'], req, refsPresent);
    }

    // a DESCRIPTOR: the adapter-allowlist requirement is STILL hardcoded false, so
    // seam_ready can never be true regardless of the other requirements.
    const unmet = req.filter((x) => x.met !== true).map((x) => x.requirement);
    return build('MAINNET_SEAM_DESCRIPTOR',
      ['mainnet_seam_descriptor_only', ...unmet.map((t) => 'unmet_' + t.toLowerCase())],
      req, refsPresent);
  } catch {
    return build('MAINNET_SEAM_UNCONFIGURED', ['input_inspection_error'], null, null);
  }
}

// Recognize an (A) mainnet-activation-seam result fed forward (from a SNAPSHOT).
function recognizeSeamResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.mainnet_seam_state === 'string' && MAINNET_SEAM_STATES.includes(snap.mainnet_seam_state)) {
    return snap.mainnet_seam_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (B) GLOBAL KILL-SWITCH READ-MODEL
//
// Pure read-model over { kill_engaged:bool, reason? }. When kill_engaged===true the
// seam can NEVER be ready (the seam/health consume this). Default / missing /
// unknown -> fail-safe MAINNET_KILL_ENGAGED (kill ASSUMED engaged when unknown ->
// safest). Read-model only; engages / disengages NOTHING.
// ---------------------------------------------------------------------------

const MAINNET_KILL_STATES = Object.freeze([
  'MAINNET_KILL_ENGAGED', 'MAINNET_KILL_NOT_ENGAGED'
]);

export function describeGlobalKillSwitchContract() {
  return Object.freeze({
    contract: 'mainnet-global-kill-switch',
    version: '0.0.0',
    test_only: true,
    supported_states: MAINNET_KILL_STATES,
    advisory_only: true,
    read_model_only: true,
    mainnet_kill_state: 'MAINNET_KILL_ENGAGED',
    kill_engaged: true,
    status: 'MAINNET_KILL_ENGAGED',
    reasons: Object.freeze([]),
    ...SafeFlags(),
    note: 'Read-only MAINNET GLOBAL KILL-SWITCH READ-MODEL. Pure deterministic function over { kill_engaged:boolean, reason? }. It REPORTS a kill posture only; it engages / disengages NOTHING and grants no execution authority. When kill_engaged===true -> MAINNET_KILL_ENGAGED (the activation seam / health CONSUME this and can then NEVER be ready). FAIL-SAFE DEFAULT: a default / missing / unknown / non-boolean kill_engaged is treated as MAINNET_KILL_ENGAGED — kill is ASSUMED engaged when unknown (the safest posture), never assumed disengaged. Only an explicit kill_engaged===false yields MAINNET_KILL_NOT_ENGAGED. Fail-Safe-Not-Fail-Open: smuggled mainnet / execution command / credential / endpoint material -> treated as engaged (values never echoed); hostile / throwing input -> frozen MAINNET_KILL_ENGAGED, never throws. can_send / can_broadcast STAY false on every state.'
  });
}

export function evaluateGlobalKillSwitch(input) {
  const build = (state, reasons) => Object.freeze({
    mainnet_kill_state: state,
    kill_engaged: (state === 'MAINNET_KILL_ENGAGED'),
    read_model_only: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...SafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      // missing / hostile -> fail-safe ENGAGED (kill assumed engaged when unknown).
      return build('MAINNET_KILL_ENGAGED', ['kill_assumed_engaged_default']);
    }
    if (hasFunctionValue(snap)) {
      return build('MAINNET_KILL_ENGAGED', ['input_inspection_error']);
    }
    const reasons = screen(snap);
    if (screenedInvalid(reasons)) {
      // any smuggle -> fail-safe ENGAGED.
      return build('MAINNET_KILL_ENGAGED', ['kill_assumed_engaged_on_smuggle']);
    }
    // ONLY an explicit false disengages; everything else (missing/unknown/non-bool)
    // is fail-safe ENGAGED.
    if (snap.kill_engaged === false) {
      return build('MAINNET_KILL_NOT_ENGAGED', ['kill_not_engaged']);
    }
    return build('MAINNET_KILL_ENGAGED', ['kill_engaged']);
  } catch {
    return build('MAINNET_KILL_ENGAGED', ['input_inspection_error']);
  }
}

// Recognize a (B) kill-switch result fed forward (from a SNAPSHOT).
function recognizeKillResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.mainnet_kill_state === 'string' && MAINNET_KILL_STATES.includes(snap.mainnet_kill_state)) {
    return snap.mainnet_kill_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (C) EMERGENCY-EXIT READ-MODEL
//
// Pure read-model describing emergency-exit posture (exit_only_advisory) from
// operating_state (consumed by VALUE) + kill signals. It NEVER trades; it describes
// the advisory posture (EXITS_ONLY-shaped) only. EXITS_ONLY / KILLED / a kill
// signal -> exit_only_advisory. ACTIVE without kill -> not advised. Missing /
// unknown -> fail-safe advised (exits-only is the safe posture).
// ---------------------------------------------------------------------------

const MAINNET_EMERGENCY_EXIT_STATES = Object.freeze([
  'MAINNET_EMERGENCY_EXIT_UNCONFIGURED', 'MAINNET_EMERGENCY_EXIT_INVALID',
  'MAINNET_EMERGENCY_EXIT_NOT_ADVISED', 'MAINNET_EMERGENCY_EXIT_ADVISED'
]);

export function describeEmergencyExitContract() {
  return Object.freeze({
    contract: 'mainnet-emergency-exit',
    version: '0.0.0',
    test_only: true,
    supported_states: MAINNET_EMERGENCY_EXIT_STATES,
    supported_operating_state_values: OPERATING_STATE_VALUES,
    advisory_only: true,
    read_model_only: true,
    mainnet_emergency_exit_state: 'MAINNET_EMERGENCY_EXIT_UNCONFIGURED',
    exit_only_advisory: false,
    status: 'MAINNET_EMERGENCY_EXIT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...SafeFlags(),
    note: 'Read-only MAINNET EMERGENCY-EXIT READ-MODEL. Pure deterministic function over { operating_state, kill_signal? } describing the emergency-exit POSTURE (exit_only_advisory, EXITS_ONLY-shaped) ONLY. It NEVER trades, NEVER closes a position, NEVER emergency-exits — it only describes the advisory posture. operating_state is CONSUMED BY VALUE from the SSOT Group 1 set (WARMING_UP / ACTIVE / EXITS_ONLY / PAUSED / KILLED) — no new SSOT name, no new candidate_*. EXITS_ONLY or KILLED -> MAINNET_EMERGENCY_EXIT_ADVISED (exit_only_advisory:true). A truthy kill_signal -> ADVISED. ACTIVE with no kill -> MAINNET_EMERGENCY_EXIT_NOT_ADVISED (exit_only_advisory:false). FAIL-SAFE: a missing operating_state -> MAINNET_EMERGENCY_EXIT_UNCONFIGURED; an unknown / non-enum operating_state -> MAINNET_EMERGENCY_EXIT_INVALID. WARMING_UP / PAUSED are conservatively treated as ADVISED (exits-only is the safe posture). Fail-Safe-Not-Fail-Open: smuggled mainnet / execution command / credential / endpoint material -> MAINNET_EMERGENCY_EXIT_INVALID (values never echoed); hostile / throwing input -> frozen refusal, never throws. exit_only_advisory is an ADVISORY posture flag, NOT an execution flag — can_send / can_broadcast STAY false on every state.'
  });
}

export function evaluateEmergencyExit(input) {
  const build = (state, reasons, advisory) => Object.freeze({
    valid: (state !== 'MAINNET_EMERGENCY_EXIT_INVALID'),
    mainnet_emergency_exit_state: state,
    exit_only_advisory: (state === 'MAINNET_EMERGENCY_EXIT_ADVISED') ? true : false,
    read_model_only: true,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...SafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('MAINNET_EMERGENCY_EXIT_UNCONFIGURED', ['no_emergency_exit_input'], false);
    }
    if (hasFunctionValue(snap)) {
      return build('MAINNET_EMERGENCY_EXIT_UNCONFIGURED', ['input_inspection_error'], false);
    }
    const reasons = screen(snap);
    if (screenedInvalid(reasons)) {
      return build('MAINNET_EMERGENCY_EXIT_INVALID', reasons, false);
    }

    const os = snap.operating_state;
    if (os == null) {
      return build('MAINNET_EMERGENCY_EXIT_UNCONFIGURED', ['operating_state_missing'], false);
    }
    if (typeof os !== 'string' || !OPERATING_STATE_VALUES.includes(os)) {
      return build('MAINNET_EMERGENCY_EXIT_INVALID', ['operating_state_unknown'], false);
    }

    const killSignal = (snap.kill_signal === true);
    // EXITS_ONLY / KILLED / WARMING_UP / PAUSED -> exits-only advised (safe posture).
    // ACTIVE with no kill signal -> not advised.
    if (killSignal || os === 'EXITS_ONLY' || os === 'KILLED' || os === 'WARMING_UP' || os === 'PAUSED') {
      return build('MAINNET_EMERGENCY_EXIT_ADVISED', ['exit_only_posture_advised'], true);
    }
    return build('MAINNET_EMERGENCY_EXIT_NOT_ADVISED', ['exit_not_advised_active'], false);
  } catch {
    return build('MAINNET_EMERGENCY_EXIT_UNCONFIGURED', ['input_inspection_error'], false);
  }
}

// ---------------------------------------------------------------------------
// (D) MAINNET-ACTIVATION SUPPRESSION
//
// ALWAYS suppressed:true carrying not_activate_authorized, not_send_authorized,
// not_execution_authorized on every path — even a perfectly clean one.
// ---------------------------------------------------------------------------

const MAINNET_SUPPRESSION_REASON_CODES = Object.freeze([
  'mainnet_seam_not_ready', 'mainnet_kill_engaged', 'mainnet_surface_detected',
  'not_activate_authorized', 'not_send_authorized', 'not_execution_authorized'
]);

const MAINNET_SUPPRESSION_ALWAYS = Object.freeze([
  'not_activate_authorized', 'not_send_authorized', 'not_execution_authorized'
]);

export function describeMainnetActivationSuppressionContract() {
  return Object.freeze({
    contract: 'mainnet-activation-suppression',
    version: '0.0.0',
    test_only: true,
    supported_reason_codes: MAINNET_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: true,
    suppression_reasons: MAINNET_SUPPRESSION_ALWAYS,
    status: 'MAINNET_ACTIVATION_SUPPRESSED',
    reasons: MAINNET_SUPPRESSION_ALWAYS,
    ...SafeFlags(),
    note: 'Read-only MAINNET-ACTIVATION SUPPRESSION. ALWAYS suppressed:true — the mainnet-activation layer is NEVER activate / send / execution authorized, so not_activate_authorized + not_send_authorized + not_execution_authorized are ALWAYS carried on every result, including a perfectly clean one (the three component codes). Component codes are added when a consumed component is unclean: mainnet_activation_seam present (seam_ready is ALWAYS false in this package) -> mainnet_seam_not_ready; mainnet_kill_switch MAINNET_KILL_ENGAGED -> mainnet_kill_engaged; mainnet_forbidden_surface MAINNET_SURFACE_BLOCKED -> mainnet_surface_detected. Suppression prevents progression and reports REASONS ONLY — it opens nothing, activates nothing, sends nothing, and never escalates. activation_performed / real_live_activated / can_send / can_broadcast STAY false.'
  });
}

export function evaluateMainnetActivationSuppression(input) {
  const build = (codes) => {
    const merged = [...new Set([...(codes || []), ...MAINNET_SUPPRESSION_ALWAYS])]
      .filter((c) => MAINNET_SUPPRESSION_REASON_CODES.includes(c));
    return Object.freeze({
      suppressed: true,
      suppression_reasons: Object.freeze(merged),
      status: 'MAINNET_ACTIVATION_SUPPRESSED',
      reasons: Object.freeze(merged),
      advisory_only: true,
      ...SafeFlags()
    });
  };
  try {
    const snap = snapshot(input);
    if (snap === null || hasFunctionValue(snap)) {
      // hostile / missing -> still suppressed, always carrying the three tokens.
      return build([]);
    }
    const codes = [];

    let seamSnap = null;
    let killSnap = null;
    let surfaceSnap = null;
    try {
      seamSnap = snapshot(snap.mainnet_activation_seam);
      killSnap = snapshot(snap.mainnet_kill_switch);
      surfaceSnap = snapshot(snap.mainnet_forbidden_surface);
    } catch {
      return build([]);
    }

    if (snap.mainnet_activation_seam != null) {
      // seam_ready is ALWAYS false in this package, so a present seam descriptor is
      // ALWAYS not-ready (and an unrecognized one is too).
      if (seamSnap == null || seamSnap.read_only !== true || seamSnap.seam_ready !== true) {
        codes.push('mainnet_seam_not_ready');
      }
    }
    if (snap.mainnet_kill_switch != null) {
      if (killSnap == null || killSnap.read_only !== true ||
          killSnap.mainnet_kill_state !== 'MAINNET_KILL_NOT_ENGAGED') {
        codes.push('mainnet_kill_engaged');
      }
    }
    if (snap.mainnet_forbidden_surface != null) {
      if (surfaceSnap != null && surfaceSnap.read_only === true &&
          surfaceSnap.mainnet_surface_state === 'MAINNET_SURFACE_BLOCKED') {
        codes.push('mainnet_surface_detected');
      }
    }
    return build(codes);
  } catch {
    return build([]);
  }
}

// ---------------------------------------------------------------------------
// (E) MAINNET FORBIDDEN SURFACE GUARD
//
// NAME-only redacting guard. Scans ONLY top-level keys for forbidden field NAMES:
// key material + live/endpoint + api_key/bearer/token names + raw-mainnet tokens.
// Reports a REDACTED forbidden_field_ref (the matched NAME only) — NEVER the VALUE.
// The detection booleans are DETECTION outputs (true == found == BLOCKED == the
// SAFE blocked state); they are NOT readiness/exec flags. isValidMainnetEndpointRef
// is exported for shape-checking an opaque endpoint_ref.
// ---------------------------------------------------------------------------

const MAINNET_SURFACE_STATES = Object.freeze([
  'MAINNET_SURFACE_UNCONFIGURED', 'MAINNET_SURFACE_CLEAN', 'MAINNET_SURFACE_BLOCKED'
]);

const MAINNET_SURFACE_KEY_MATERIAL_NAMES = Object.freeze([
  'private_key', 'privateKey', 'secret_key', 'secretKey', 'keypair', 'keyPair',
  'mnemonic', 'seed', 'seed_phrase', 'seedPhrase', 'secret_seed', 'raw_key',
  'rawKey', 'signing_key', 'signingKey', 'signer_secret', 'signerSecret'
]);

const MAINNET_SURFACE_CREDENTIAL_NAMES = Object.freeze([
  'api_key', 'apiKey', 'bearer_token', 'bearerToken', 'bearer', 'access_token',
  'accessToken', 'auth_token', 'authToken', 'provider_key', 'providerKey',
  'provider_secret', 'providerSecret', 'token', 'secret', 'password',
  'credential', 'credentials'
]);

const MAINNET_SURFACE_ENDPOINT_NAMES = Object.freeze([
  'endpoint', 'endpoint_url', 'endpointUrl', 'url', 'rpc_url', 'rpcUrl',
  'ws_url', 'wsUrl', 'stream_url', 'streamUrl', 'grpc_endpoint', 'grpcEndpoint',
  'connection_string', 'connectionString', 'live_endpoint', 'liveEndpoint',
  'live_url', 'liveUrl', 'mainnet_url', 'mainnetUrl', 'rpc_endpoint'
]);

const MAINNET_SURFACE_FORBIDDEN_NAMES = Object.freeze([
  ...MAINNET_SURFACE_KEY_MATERIAL_NAMES,
  ...MAINNET_SURFACE_CREDENTIAL_NAMES,
  ...MAINNET_SURFACE_ENDPOINT_NAMES
]);

// endpoint_ref shape-check helper: a valid endpoint_ref is an opaque SHORT token
// (refuse ://, whitespace, >128 chars, base58-blob / PEM / raw-mainnet shape). The
// VALUE is never echoed — returns only a boolean.
export function isValidMainnetEndpointRef(ref) {
  return !endpointRefSecretShaped(ref);
}

export function describeMainnetForbiddenSurfaceContract() {
  return Object.freeze({
    contract: 'mainnet-forbidden-surface',
    version: '0.0.0',
    test_only: true,
    supported_states: MAINNET_SURFACE_STATES,
    forbidden_field_names: MAINNET_SURFACE_FORBIDDEN_NAMES,
    endpoint_ref_max_length: ENDPOINT_REF_MAX_LENGTH,
    advisory_only: true,
    mainnet_surface_state: 'MAINNET_SURFACE_UNCONFIGURED',
    key_material_detected: false,
    credential_detected: false,
    mainnet_surface_detected: false,
    mainnet_detected: false,
    forbidden_field_detected: false,
    forbidden_field_ref: null,
    status: 'MAINNET_SURFACE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...SafeFlags(),
    note: 'Read-only MAINNET FORBIDDEN SURFACE GUARD. NAME-only redacting guard: proves the Stage-23 mainnet-activation seam neither produces nor accepts key material, raw credentials, live / mainnet endpoint surfaces, or raw mainnet indicators. It scans ONLY top-level keys (deterministic, bounded, pure, snapshot-once) for forbidden field NAMES: key material (private_key, secret_key, keypair, mnemonic, seed, raw_key, signing_key, signer_secret, ...), raw credentials (api_key, bearer_token, bearer, access_token, auth_token, provider_key, token, secret, password, credential, ...), and endpoints (endpoint, endpoint_url, url, rpc_url, ws_url, grpc_endpoint, connection_string, mainnet_url, rpc_endpoint, ...). It ALSO scans for any raw mainnet / mainnet-beta / prod token in a KEY or string VALUE -> BLOCKED (mainnet_detected). The sanctioned opaque endpoint_ref / mainnet_rpc_endpoint_ref names are NOT forbidden — use the exported isValidMainnetEndpointRef(ref) shape-checker (a valid endpoint_ref is an opaque short token; ://, whitespace, >128 chars, base58-blob / PEM / raw-mainnet shapes are refused). The detection booleans key_material_detected / credential_detected / mainnet_surface_detected / mainnet_detected / forbidden_field_detected are DETECTION outputs (true == found == BLOCKED == the SAFE blocked state); they are NOT readiness / execution flags. forbidden_field_ref is a REDACTED reference (the matched field NAME only, or null) — the guard NEVER echoes the forbidden field VALUE anywhere. Fail-Safe-Not-Fail-Open: missing / hostile input -> MAINNET_SURFACE_UNCONFIGURED (frozen, never throws); no forbidden name / value -> MAINNET_SURFACE_CLEAN; ANY forbidden name OR raw mainnet token -> MAINNET_SURFACE_BLOCKED.'
  });
}

export function evaluateMainnetForbiddenSurface(input) {
  const build = (state, kind, ref, reasons) => Object.freeze({
    mainnet_surface_state: state,
    key_material_detected: (state === 'MAINNET_SURFACE_BLOCKED') ? (kind === 'key') : false,
    credential_detected: (state === 'MAINNET_SURFACE_BLOCKED') ? (kind === 'credential') : false,
    mainnet_surface_detected: (state === 'MAINNET_SURFACE_BLOCKED') ? (kind === 'endpoint') : false,
    mainnet_detected: (state === 'MAINNET_SURFACE_BLOCKED') ? (kind === 'mainnet') : false,
    forbidden_field_detected: (state === 'MAINNET_SURFACE_BLOCKED'),
    forbidden_field_ref: (state === 'MAINNET_SURFACE_BLOCKED' && typeof ref === 'string') ? ref : null,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    advisory_only: true,
    ...SafeFlags()
  });
  try {
    const snap = snapshot(input);
    if (snap === null) {
      return build('MAINNET_SURFACE_UNCONFIGURED', null, null, ['no_mainnet_surface_input']);
    }
    // scan top-level NAMES first (names matter; values are never echoed).
    for (const k of Object.keys(snap)) {
      if (MAINNET_SURFACE_KEY_MATERIAL_NAMES.includes(k)) {
        return build('MAINNET_SURFACE_BLOCKED', 'key', k, ['key_material_detected']);
      }
      if (MAINNET_SURFACE_CREDENTIAL_NAMES.includes(k)) {
        return build('MAINNET_SURFACE_BLOCKED', 'credential', k, ['credential_detected']);
      }
      if (MAINNET_SURFACE_ENDPOINT_NAMES.includes(k)) {
        return build('MAINNET_SURFACE_BLOCKED', 'endpoint', k, ['mainnet_surface_detected']);
      }
    }
    // raw mainnet token in a KEY or VALUE (incl. nested one level) -> BLOCKED.
    if (snapshotHasMainnet(snap)) {
      return build('MAINNET_SURFACE_BLOCKED', 'mainnet', 'mainnet_token', ['mainnet_detected']);
    }
    // endpoint/credential VALUE smuggled under a benign name -> BLOCKED (redacted).
    for (const [k, v] of Object.entries(snap)) {
      if (k === 'endpoint_ref' || k === 'mainnet_rpc_endpoint_ref') continue;
      if (valueIsDirty(v)) {
        return build('MAINNET_SURFACE_BLOCKED', 'endpoint', k, ['mainnet_surface_detected']);
      }
    }
    if (hasFunctionValue(snap)) {
      return build('MAINNET_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
    }
    return build('MAINNET_SURFACE_CLEAN', null, null, ['mainnet_surface_clean']);
  } catch {
    return build('MAINNET_SURFACE_UNCONFIGURED', null, null, ['input_inspection_error']);
  }
}

// Recognize an (E) mainnet-forbidden-surface result fed forward (from a SNAPSHOT).
function recognizeSurfaceResult(snap) {
  if (snap == null || typeof snap !== 'object') return null;
  if (snap.read_only !== true) return null;
  if (typeof snap.mainnet_surface_state === 'string' && MAINNET_SURFACE_STATES.includes(snap.mainnet_surface_state)) {
    return snap.mainnet_surface_state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// (F) MAINNET-ACTIVATION HEALTH
//
// Aggregates (A)-(E) + the kill switch + the real-live-readiness verdict +
// send-gate refusal, and derives STATUS ONLY. There is NO 'ready/activated' health
// state — the best attainable state is _SUPPRESSED (activation is ALWAYS suppressed
// in-package). Kill engaged / surface blocked / not-ready / any _INVALID ->
// _BLOCKED. Every state keeps all 24 readiness/execution flags false.
// ---------------------------------------------------------------------------

const MAINNET_ACTIVATION_HEALTH_STATES = Object.freeze([
  'MAINNET_ACTIVATION_HEALTH_UNCONFIGURED', 'MAINNET_ACTIVATION_HEALTH_DEGRADED',
  'MAINNET_ACTIVATION_HEALTH_SUPPRESSED', 'MAINNET_ACTIVATION_HEALTH_BLOCKED'
]);

const MAINNET_ACTIVATION_HEALTH_COMPONENTS = Object.freeze([
  'mainnet_activation_seam', 'mainnet_kill_switch', 'mainnet_emergency_exit',
  'mainnet_activation_suppression', 'mainnet_forbidden_surface',
  'real_live_readiness', 'send_gate_refusal'
]);

export function describeMainnetActivationHealthContract() {
  return Object.freeze({
    contract: 'mainnet-activation-health',
    version: '0.0.0',
    test_only: true,
    supported_states: MAINNET_ACTIVATION_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    mainnet_activation_health_state: 'MAINNET_ACTIVATION_HEALTH_UNCONFIGURED',
    status: 'MAINNET_ACTIVATION_HEALTH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...SafeFlags(),
    note: 'Read-only MAINNET-ACTIVATION HEALTH. Aggregates the Stage-23 mainnet-activation seam descriptor (A) + global kill-switch (B) + emergency-exit read-model (C) + mainnet-activation suppression (D) + mainnet forbidden surface (E) + the real-live-readiness verdict + the send-gate refusal, and DERIVES STATUS ONLY. There is NO ready / activated health state — the BEST attainable state is MAINNET_ACTIVATION_HEALTH_SUPPRESSED because activation is ALWAYS suppressed in-package. Ordering (Fail-Safe-Not-Fail-Open): smuggled forbidden flag / execution command / credential NAME / endpoint value / raw mainnet token on the top level or any component -> MAINNET_ACTIVATION_HEALTH_BLOCKED; mainnet_forbidden_surface MAINNET_SURFACE_BLOCKED, kill engaged (MAINNET_KILL_ENGAGED or anything not explicitly NOT_ENGAGED), a not-ready real_live_readiness verdict, a send_gate_refusal that is NOT ok:false, or any component *_INVALID -> MAINNET_ACTIVATION_HEALTH_BLOCKED; any required component missing or unrecognized -> MAINNET_ACTIVATION_HEALTH_UNCONFIGURED; mainnet_activation_suppression.suppressed === true (always) -> MAINNET_ACTIVATION_HEALTH_SUPPRESSED (the CLEAN PATH); anything else -> MAINNET_ACTIVATION_HEALTH_DEGRADED. activation is always suppressed in-package; every state keeps every readiness / execution flag false and grants no execution authority. This health NEVER consults can_send / can_broadcast as anything but FIXED false, and NEVER yields a ready / activated state.'
  });
}

export function evaluateMainnetActivationHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'MAINNET_ACTIVATION_HEALTH_BLOCKED'),
    mainnet_activation_health_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    advisory_only: true,
    ...SafeFlags()
  });
  try {
    const snap = snapshot(inputs);
    if (snap === null) {
      return build('MAINNET_ACTIVATION_HEALTH_UNCONFIGURED', ['no_mainnet_activation_health_input']);
    }
    if (hasFunctionValue(snap)) {
      return build('MAINNET_ACTIVATION_HEALTH_UNCONFIGURED', ['input_inspection_error']);
    }

    // smuggle screen: top-level minus component slots, then every component.
    const shallow = {};
    for (const [k, v] of Object.entries(snap)) {
      if (!MAINNET_ACTIVATION_HEALTH_COMPONENTS.includes(k)) shallow[k] = v;
    }
    let blockedBySmuggle = screen(shallow).length > 0;
    const componentSnaps = {};
    for (const k of MAINNET_ACTIVATION_HEALTH_COMPONENTS) {
      let c = null;
      try {
        c = snapshot(snap[k]);
      } catch {
        return build('MAINNET_ACTIVATION_HEALTH_UNCONFIGURED', ['input_inspection_error']);
      }
      componentSnaps[k] = c;
      if (c == null) continue;
      if (hasFunctionValue(c)) {
        return build('MAINNET_ACTIVATION_HEALTH_UNCONFIGURED', ['input_inspection_error']);
      }
      // real_live_readiness + send_gate_refusal are recognized verdict components
      // consumed by dedicated SHAPE checks below; their legitimate result KEYS
      // (e.g. the send-gate's fixed-false `broadcast`/`sent`/`can_send` keys, the
      // readiness `prerequisite_for: 'activate_real_live'` VALUE) must not trip the
      // generic exec-command / forbidden-flag KEY screen. They are STILL screened
      // for raw mainnet tokens and smuggled endpoint/credential VALUES.
      const isVerdictComponent = (k === 'real_live_readiness' || k === 'send_gate_refusal');
      if (snapshotHasMainnet(c) || hasEndpointOrCredentialValue(c)) {
        blockedBySmuggle = true;
      }
      if (!isVerdictComponent && (hasForbiddenTrueFlag(c) || hasExecCmdKey(c))) {
        blockedBySmuggle = true;
      }
    }
    if (blockedBySmuggle) {
      return build('MAINNET_ACTIVATION_HEALTH_BLOCKED', ['forbidden_input_blocked']);
    }

    const seamState = recognizeSeamResult(componentSnaps.mainnet_activation_seam);
    const killState = recognizeKillResult(componentSnaps.mainnet_kill_switch);
    const surfaceState = recognizeSurfaceResult(componentSnaps.mainnet_forbidden_surface);
    const exitSnap = componentSnaps.mainnet_emergency_exit;
    const supprSnap = componentSnaps.mainnet_activation_suppression;
    const readinessSnap = componentSnaps.real_live_readiness;
    const sendGateSnap = componentSnaps.send_gate_refusal;

    const exitState = (exitSnap != null && exitSnap.read_only === true &&
      typeof exitSnap.mainnet_emergency_exit_state === 'string' &&
      MAINNET_EMERGENCY_EXIT_STATES.includes(exitSnap.mainnet_emergency_exit_state))
      ? exitSnap.mainnet_emergency_exit_state : null;
    const supprVal = (supprSnap != null && supprSnap.read_only === true &&
      typeof supprSnap.suppressed === 'boolean' && Array.isArray(supprSnap.suppression_reasons))
      ? supprSnap.suppressed : null;

    // hard-block: surface blocked.
    if (surfaceState === 'MAINNET_SURFACE_BLOCKED') {
      return build('MAINNET_ACTIVATION_HEALTH_BLOCKED', ['mainnet_surface_blocked']);
    }
    // hard-block: kill engaged (a present kill switch that is anything but explicitly
    // NOT_ENGAGED is fail-safe blocked).
    if (componentSnaps.mainnet_kill_switch != null && killState !== 'MAINNET_KILL_NOT_ENGAGED') {
      return build('MAINNET_ACTIVATION_HEALTH_BLOCKED', ['mainnet_kill_engaged']);
    }
    // hard-block: a present real-live-readiness verdict that is not ready.
    if (componentSnaps.real_live_readiness != null && !readinessVerdictReady(readinessSnap)) {
      return build('MAINNET_ACTIVATION_HEALTH_BLOCKED', ['real_live_not_ready']);
    }
    // hard-block: a present send-gate refusal that is NOT ok:false (must still refuse).
    if (componentSnaps.send_gate_refusal != null) {
      if (sendGateSnap == null || sendGateSnap.ok !== false || sendGateSnap.can_send === true) {
        return build('MAINNET_ACTIVATION_HEALTH_BLOCKED', ['send_gate_not_refusing']);
      }
    }
    // hard-block: any component *_INVALID.
    if (seamState === 'MAINNET_SEAM_INVALID' ||
        exitState === 'MAINNET_EMERGENCY_EXIT_INVALID') {
      return build('MAINNET_ACTIVATION_HEALTH_BLOCKED', ['component_invalid']);
    }

    // any required component missing or unrecognized -> UNCONFIGURED.
    if (seamState === null || killState === null || exitState === null ||
        supprVal === null || surfaceState === null ||
        componentSnaps.real_live_readiness == null || componentSnaps.send_gate_refusal == null) {
      return build('MAINNET_ACTIVATION_HEALTH_UNCONFIGURED', ['required_component_missing']);
    }

    // suppression active -> SUPPRESSED (the CLEAN PATH; suppression is always active,
    // so the BEST attainable state is _SUPPRESSED — never ready/activated).
    if (supprVal === true) {
      return build('MAINNET_ACTIVATION_HEALTH_SUPPRESSED', ['mainnet_activation_suppressed']);
    }

    // anything else -> DEGRADED (never ready/activated).
    return build('MAINNET_ACTIVATION_HEALTH_DEGRADED', ['mainnet_activation_degraded']);
  } catch {
    return build('MAINNET_ACTIVATION_HEALTH_UNCONFIGURED', ['input_inspection_error']);
  }
}
