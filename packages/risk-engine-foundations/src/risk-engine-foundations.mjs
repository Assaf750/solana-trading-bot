// @soltrade/risk-engine-foundations
//
// Read-only / advisory ONLY RISK foundation for Stage-7 of the architecture
// pipeline `data -> signal -> risk -> intent -> route -> sign -> send`. This
// package builds ONLY the read-only/advisory part of the `risk` stage, consuming
// Stage-6 signal-engine outputs. Import-free, pure, deterministic. No network
// primitive, no live stream, no system clock, no persistence, no secrets.
//
// THE CORE RULE: a risk verdict is NOT a trade order, NOT an intent, NOT a route,
// NOT a send permission, NOT trading readiness. It is advisory / read-only ONLY.
// Even a risk PASS is advisory. risk_ready AND signal_ready STAY false on every
// result — a risk verdict NEVER flips risk_ready / intent_ready or any execution
// flag. "Risk passed advisory" is carried ONLY by dedicated fields
// (risk_passed_advisory / risk_blocked / risk_*_state / verdict states), never by
// a readiness flag. Hostile, throwing, or uninspectable input returns a FROZEN
// refusal with reason 'input_inspection_error' and NEVER throws.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function riskSafeFlags() {
  return {
    read_only: true,
    live_stream_enabled: false,
    network_call_made: false,
    endpoint_resolved: false,
    has_secret: false,
    signal_ready: false,
    trading_ready: false,
    risk_ready: false,
    intent_ready: false,
    routing_ready: false,
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

const RISK_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'can_send', 'can_broadcast', 'can_serialize', 'signing_permitted',
  'broadcast_permitted', 'is_live', 'real_live', 'mainnet_enabled',
  'live_stream_enabled', 'network_call_made', 'endpoint_resolved'
]);

const RISK_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap',
  'copy_now', 'trade_now', 'sign', 'buy_opportunity', 'execute_opportunity',
  'submit_opportunity', 'buy_signal', 'sell_signal', 'copy_signal',
  'alpha_signal', 'order', 'place_order', 'open_intent', 'create_intent',
  'route', 'plan_route'
]);

const RISK_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential/i;
const RISK_URL_RE = /https?:\/\/|wss?:\/\//i;
const RISK_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan (their values are
// still scanned for URL/secret/mainnet substrings).
const RISK_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'wallet_ref', 'token_ref', 'event_ref', 'signal_ref',
  'candidate_ref', 'first_seen_ref', 'last_seen_ref', 'explanation_refs'
]);

// Stage-4 raw ingestion event types — these MUST NOT arrive at the risk layer
// (they carry no signal-layer state). A raw event in a signal slot is REFUSED.
const RISK_RAW_INGESTION_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed', 'token_account_change_observed',
  'swap_observed', 'mint_observed', 'pool_observed', 'balance_change_observed'
]);

// Stage-5 intelligence state fields — an object carrying one of these (and no
// signal-layer state) is raw intelligence, NOT a Stage-6 signal output -> refuse.
const RISK_INTELLIGENCE_STATE_FIELDS = Object.freeze([
  'wallet_observation_state', 'token_observation_state', 'relationship_state',
  'diagnostics_state', 'intelligence_state'
]);

function riskHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of RISK_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function riskHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (RISK_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function riskHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (RISK_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (RISK_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function riskHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (RISK_URL_RE.test(v) || RISK_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function riskScreen(o) {
  const r = [];
  if (riskHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (riskHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (riskHasSecretField(o)) r.push('secret_field_blocked');
  if (riskHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function riskUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// A raw ingestion event = recognized raw event_type but NO signal-layer state.
function riskIsRawIngestionEvent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  const et = o.event_type;
  if (typeof et !== 'string' || !RISK_RAW_INGESTION_EVENT_TYPES.includes(et)) return false;
  if (riskHasSignalLayerState(o)) return false;
  return true;
}

// Signal-layer recognizers. A Stage-6 signal output carries one of these state
// fields. (Read-only is separately mandatory.)
const RISK_SIGNAL_INPUT_STATES = Object.freeze([
  'SIGNAL_INPUT_UNCONFIGURED', 'SIGNAL_INPUT_INVALID',
  'SIGNAL_INPUT_DEGRADED', 'SIGNAL_INPUT_VALID'
]);
const RISK_CANDIDATE_SIGNAL_STATES = Object.freeze([
  'WALLET_LED_UNCONFIGURED', 'WALLET_LED_INVALID',
  'WALLET_LED_SUPPRESSED', 'WALLET_LED_CANDIDATE',
  'TOKEN_ACTIVITY_UNCONFIGURED', 'TOKEN_ACTIVITY_INVALID',
  'TOKEN_ACTIVITY_SUPPRESSED', 'TOKEN_ACTIVITY_CANDIDATE'
]);
const RISK_CANDIDATE_SIGNAL_KINDS = Object.freeze([
  'wallet_led_candidate', 'token_activity_candidate'
]);
const RISK_SCORE_STATES = Object.freeze([
  'SIGNAL_SCORE_UNCONFIGURED', 'SIGNAL_SCORE_INVALID',
  'SIGNAL_SCORE_SUPPRESSED', 'SIGNAL_SCORE_DESCRIBED'
]);
const RISK_SUPPRESSION_STATES = Object.freeze([
  'SIGNAL_SUPPRESSION_UNCONFIGURED', 'SIGNAL_SUPPRESSION_INVALID',
  'SIGNAL_SUPPRESSION_SUPPRESSED', 'SIGNAL_SUPPRESSION_NOT_SUPPRESSED'
]);
const RISK_HEALTH_STATES = Object.freeze([
  'SIGNAL_UNCONFIGURED', 'SIGNAL_DEGRADED', 'SIGNAL_READY_ADVISORY',
  'SIGNAL_SUPPRESSED', 'SIGNAL_BLOCKED'
]);

// does an object carry ANY recognized signal-layer state field?
function riskHasSignalLayerState(o) {
  if (o == null || typeof o !== 'object') return false;
  if (typeof o.signal_input_state === 'string' && RISK_SIGNAL_INPUT_STATES.includes(o.signal_input_state)) return true;
  if (typeof o.candidate_signal_state === 'string' && RISK_CANDIDATE_SIGNAL_STATES.includes(o.candidate_signal_state)) return true;
  if (typeof o.signal_score_state === 'string' && RISK_SCORE_STATES.includes(o.signal_score_state)) return true;
  if (typeof o.signal_suppression_state === 'string' && RISK_SUPPRESSION_STATES.includes(o.signal_suppression_state)) return true;
  if (typeof o.signal_state === 'string' && RISK_HEALTH_STATES.includes(o.signal_state)) return true;
  return false;
}

// does an object carry a Stage-5 intelligence state (and NO signal-layer state)?
// Such an object is raw intelligence, not a Stage-6 signal output.
function riskIsRawIntelligence(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  if (riskHasSignalLayerState(o)) return false;
  for (const f of RISK_INTELLIGENCE_STATE_FIELDS) {
    if (typeof o[f] === 'string') return true;
  }
  return false;
}

// Screen a Stage-6 RESULT object passed in a component slot: forbidden trading
// flag, execution-command KEY, raw ingestion event, raw intelligence, and
// endpoint/mainnet by string VALUE. The secret-NAME scan is NOT run here because
// legitimate signal state fields contain the substring 'token'/'signal'; results
// spread only fixed literals/allowlisted tokens, so a bare secret value is never
// echoed.
function riskScreenComponentResult(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (riskHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (riskHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (riskHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (riskIsRawIngestionEvent(c)) r.push('raw_signal_input_refused');
  if (riskIsRawIntelligence(c)) r.push('raw_signal_input_refused');
  return r;
}

// Recognize a Stage-6 signal component: it must be an inspectable read-only
// object carrying a valid signal-layer state, and NOT raw ingestion/intelligence.
// Returns the recognized signal-layer state string, or null.
function riskSignalComponentState(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (riskIsRawIngestionEvent(o) || riskIsRawIntelligence(o)) return null;
  if (o.read_only !== true) return null;
  if (typeof o.signal_input_state === 'string' && RISK_SIGNAL_INPUT_STATES.includes(o.signal_input_state)) return o.signal_input_state;
  if (typeof o.candidate_signal_state === 'string' && RISK_CANDIDATE_SIGNAL_STATES.includes(o.candidate_signal_state)
      && RISK_CANDIDATE_SIGNAL_KINDS.includes(o.signal_kind)) return o.candidate_signal_state;
  if (typeof o.signal_score_state === 'string' && RISK_SCORE_STATES.includes(o.signal_score_state)) return o.signal_score_state;
  if (typeof o.signal_suppression_state === 'string' && RISK_SUPPRESSION_STATES.includes(o.signal_suppression_state)) return o.signal_suppression_state;
  if (typeof o.signal_state === 'string' && RISK_HEALTH_STATES.includes(o.signal_state)) return o.signal_state;
  return null;
}

// classify a signal component result for the boundary:
//   'valid' | 'degraded' | 'invalid' | 'blocked' | 'unrecognized'
function riskClassifySignalComponent(c) {
  if (c == null || typeof c !== 'object' || Array.isArray(c)) return 'unrecognized';
  if (riskScreenComponentResult(c).length > 0) return 'blocked';
  const s = riskSignalComponentState(c);
  if (s === null) return 'unrecognized';
  // INVALID states
  if (s === 'SIGNAL_INPUT_INVALID' || s === 'WALLET_LED_INVALID' ||
      s === 'TOKEN_ACTIVITY_INVALID' || s === 'SIGNAL_SCORE_INVALID' ||
      s === 'SIGNAL_SUPPRESSION_INVALID' || s === 'SIGNAL_BLOCKED') {
    return 'invalid';
  }
  // DEGRADED / suppressed / unconfigured states
  if (s === 'SIGNAL_INPUT_DEGRADED' || s === 'SIGNAL_INPUT_UNCONFIGURED' ||
      s === 'WALLET_LED_SUPPRESSED' || s === 'WALLET_LED_UNCONFIGURED' ||
      s === 'TOKEN_ACTIVITY_SUPPRESSED' || s === 'TOKEN_ACTIVITY_UNCONFIGURED' ||
      s === 'SIGNAL_SCORE_SUPPRESSED' || s === 'SIGNAL_SCORE_UNCONFIGURED' ||
      s === 'SIGNAL_SUPPRESSION_SUPPRESSED' || s === 'SIGNAL_SUPPRESSION_UNCONFIGURED' ||
      s === 'SIGNAL_DEGRADED' || s === 'SIGNAL_SUPPRESSED' || s === 'SIGNAL_UNCONFIGURED') {
    return 'degraded';
  }
  return 'valid';
}

// ---------------------------------------------------------------------------
// (C) RISK INPUT BOUNDARY
//
// Verifies that risk input comes ONLY from Stage-6 signal outputs, never from
// raw events / intelligence / commands. A VALID boundary opens NO
// risk/intent/trading/routing readiness; eligible_for_risk_evaluation marks the
// input shape only.
// ---------------------------------------------------------------------------

const RISK_INPUT_STATES = Object.freeze([
  'RISK_INPUT_UNCONFIGURED', 'RISK_INPUT_INVALID',
  'RISK_INPUT_DEGRADED', 'RISK_INPUT_VALID'
]);

const RISK_INPUT_COMPONENTS = Object.freeze([
  'signal_input_boundary', 'candidate_signal', 'signal_score',
  'signal_suppression', 'signal_health'
]);

export function describeRiskInputBoundaryContract() {
  return Object.freeze({
    contract: 'risk-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: RISK_INPUT_STATES,
    advisory_only: true,
    risk_input_state: 'RISK_INPUT_UNCONFIGURED',
    risk_input_boundary_valid: false,
    eligible_for_risk_evaluation: false,
    status: 'RISK_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...riskSafeFlags(),
    note: 'Read-only risk-input boundary. Verifies risk input comes ONLY from Stage-6 signal-engine outputs (signal input boundary, candidate signal, signal score, signal suppression, signal health), never from raw ingestion events, Stage-5 intelligence, endpoints, or execution commands. A VALID boundary opens NO risk/intent/trading/routing readiness; eligible_for_risk_evaluation marks the input shape only, and is NOT a risk verdict, intent, route, or send permission. Raw ingestion/intelligence objects, smuggled trading/intent/route flags or commands, secrets, endpoints, and mainnet/REAL-LIVE markers are refused (raw_signal_input_refused / *_blocked) and never echoed.'
  });
}

export function validateRiskInputBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (riskUninspectable(obj, ['purpose', ...RISK_INPUT_COMPONENTS])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...riskSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_risk_input');
    } else {
      recognized = true;
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!RISK_INPUT_COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...riskScreen(shallow));
      for (const k of RISK_INPUT_COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (riskHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (riskHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (riskIsRawIngestionEvent(c) || riskIsRawIntelligence(c)) reasons.push('raw_signal_input_refused');
      }
      if (obj.purpose !== 'risk_input_boundary') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...riskSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...riskSafeFlags()
    });
  }
}

export function evaluateRiskInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'RISK_INPUT_INVALID'),
    risk_input_boundary_valid: (state === 'RISK_INPUT_VALID'),
    eligible_for_risk_evaluation: (state === 'RISK_INPUT_VALID'),
    risk_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...riskSafeFlags()
  });
  try {
    const v = validateRiskInputBoundary(input);
    // unrecognized / hostile -> UNCONFIGURED
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('RISK_INPUT_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_risk_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / raw input / bad purpose -> INVALID
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_signal_input_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('RISK_INPUT_INVALID', v.reasons);
    }

    const boundary = input.signal_input_boundary;
    const candidate = input.candidate_signal;
    const score = input.signal_score;
    const suppression = input.signal_suppression;
    const health = input.signal_health;

    // classify each provided component
    const slots = [
      ['signal_input_boundary', boundary],
      ['candidate_signal', candidate],
      ['signal_score', score],
      ['signal_suppression', suppression],
      ['signal_health', health]
    ];
    let anyBlocked = false, anyInvalid = false, anyDegraded = false;
    let anyUnrecognized = false;
    for (const [, c] of slots) {
      if (c == null) continue;
      const cls = riskClassifySignalComponent(c);
      if (cls === 'blocked') anyBlocked = true;
      else if (cls === 'invalid') anyInvalid = true;
      else if (cls === 'degraded') anyDegraded = true;
      else if (cls === 'unrecognized') anyUnrecognized = true;
    }

    // a present-but-unrecognized component -> not a Stage-6 signal output -> INVALID
    if (anyUnrecognized) {
      return build('RISK_INPUT_INVALID', ['component_not_stage6_signal']);
    }
    if (anyBlocked) {
      return build('RISK_INPUT_INVALID', ['raw_signal_input_refused']);
    }

    const healthState = (health != null) ? riskSignalComponentState(health) : null;
    // signal_health BLOCKED OR any component *_INVALID -> INVALID
    if (healthState === 'SIGNAL_BLOCKED' || anyInvalid) {
      return build('RISK_INPUT_INVALID', ['signal_component_invalid']);
    }

    // required minimum components: signal_input_boundary + candidate_signal + signal_health
    const boundaryState = (boundary != null) ? riskSignalComponentState(boundary) : null;
    const candidateState = (candidate != null) ? riskSignalComponentState(candidate) : null;
    if (boundaryState === null || candidateState === null || healthState === null) {
      return build('RISK_INPUT_UNCONFIGURED', ['required_component_missing']);
    }

    // health not READY_ADVISORY, boundary not VALID, or any component degraded -> DEGRADED
    if (healthState !== 'SIGNAL_READY_ADVISORY' ||
        boundaryState !== 'SIGNAL_INPUT_VALID' || anyDegraded) {
      const degraded = [];
      if (healthState !== 'SIGNAL_READY_ADVISORY') degraded.push('signal_health_not_ready_advisory');
      if (boundaryState !== 'SIGNAL_INPUT_VALID') degraded.push('signal_input_boundary_not_valid');
      if (anyDegraded) degraded.push('signal_component_degraded');
      return build('RISK_INPUT_DEGRADED', degraded.length ? degraded : ['signal_component_degraded']);
    }

    // all present components recognized + read-only + boundary VALID + health READY_ADVISORY
    return build('RISK_INPUT_VALID', []);
  } catch {
    return build('RISK_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (D) HARD RISK GATE
//
// Advisory hard-risk evaluation from safe boolean/enum metadata ONLY (no network,
// no quote, no clock). A PASS is ADVISORY ONLY — it opens NO intent_ready /
// trading_ready / can_send. Fail-Safe-Not-Fail-Open: any hard blocker -> BLOCKED,
// unknown metadata -> DEGRADED (never advisory pass).
// ---------------------------------------------------------------------------

const HARD_RISK_STATES = Object.freeze([
  'HARD_RISK_UNCONFIGURED', 'HARD_RISK_INVALID', 'HARD_RISK_DEGRADED',
  'HARD_RISK_BLOCKED', 'HARD_RISK_PASS_ADVISORY'
]);

const HARD_RISK_REASON_CODES = Object.freeze([
  'honeypot_indicator', 'freeze_authority_active', 'mint_authority_active',
  'owner_concentration_high', 'blacklist_indicator', 'unknown_token_metadata',
  'risk_factors_unknown', 'clean_factors_advisory'
]);

// the indicator field names accepted on risk_factors
const HARD_RISK_FACTOR_FIELDS = Object.freeze([
  'honeypot_indicator', 'freeze_authority_indicator', 'mint_authority_indicator',
  'owner_concentration_indicator', 'blacklist_indicator', 'unknown_token_metadata'
]);

export function describeHardRiskGateContract() {
  return Object.freeze({
    contract: 'hard-risk-gate',
    version: '0.0.0',
    test_only: true,
    supported_states: HARD_RISK_STATES,
    supported_reason_codes: HARD_RISK_REASON_CODES,
    advisory_only: true,
    valid: false,
    hard_risk_state: 'HARD_RISK_UNCONFIGURED',
    risk_blocked: false,
    risk_passed_advisory: false,
    risk_reason_codes: Object.freeze([]),
    status: 'HARD_RISK_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...riskSafeFlags(),
    note: 'Read-only ADVISORY hard-risk gate evaluated from safe boolean/enum risk metadata ONLY (honeypot / freeze authority / mint authority / owner concentration / blacklist indicators + unknown_token_metadata). No network, no live quote, no system clock. Fail-Safe-Not-Fail-Open: any hard blocker -> HARD_RISK_BLOCKED; unknown_token_metadata (with no blocker) -> HARD_RISK_DEGRADED (NOT pass); all clean -> HARD_RISK_PASS_ADVISORY. A PASS is ADVISORY ONLY and opens NO intent_ready / trading_ready / can_send — risk_ready and every execution flag STAY false. "Risk passed advisory" is carried ONLY by risk_passed_advisory / hard_risk_state. Smuggled forbidden flags / execution commands / secrets / endpoints / mainnet / REAL-LIVE are refused (HARD_RISK_INVALID) and never echoed.'
  });
}

export function validateHardRiskInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (riskUninspectable(obj, ['purpose', 'candidate_signal', 'risk_input_boundary', 'risk_factors'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...riskSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_hard_risk_input');
    } else {
      recognized = true;
      const COMPONENTS = ['candidate_signal', 'risk_input_boundary', 'risk_factors'];
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...riskScreen(shallow));
      for (const k of COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (riskHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (riskHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (riskHasSecretField(c)) reasons.push('secret_field_blocked');
        if (riskHasEndpointOrMainnet(c)) reasons.push('endpoint_or_mainnet_blocked');
      }
      if (obj.purpose !== 'hard_risk_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...riskSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...riskSafeFlags()
    });
  }
}

export function evaluateHardRiskGate(input) {
  const build = (state, reasonCodes, reasons) => Object.freeze({
    valid: (state !== 'HARD_RISK_INVALID'),
    hard_risk_state: state,
    risk_blocked: (state === 'HARD_RISK_BLOCKED'),
    risk_passed_advisory: (state === 'HARD_RISK_PASS_ADVISORY'),
    risk_reason_codes: Object.freeze([...new Set((reasonCodes || []).filter((x) => HARD_RISK_REASON_CODES.includes(x)))]),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...riskSafeFlags()
  });
  try {
    const v = validateHardRiskInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('HARD_RISK_UNCONFIGURED', [], v.reasons.length ? v.reasons : ['no_hard_risk_input']);
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('HARD_RISK_INVALID', [], v.reasons);
    }

    const rf = input.risk_factors;
    // missing / empty risk_factors -> DEGRADED (unknown)
    if (rf == null || typeof rf !== 'object' || Array.isArray(rf)) {
      return build('HARD_RISK_DEGRADED', ['risk_factors_unknown'], ['risk_factors_unknown']);
    }
    const hasAnyFactor = HARD_RISK_FACTOR_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(rf, f));
    if (!hasAnyFactor) {
      return build('HARD_RISK_DEGRADED', ['risk_factors_unknown'], ['risk_factors_unknown']);
    }

    // hard blockers (Fail-Safe: any true indicator blocks)
    const blockers = [];
    if (rf.honeypot_indicator === true) blockers.push('honeypot_indicator');
    if (rf.freeze_authority_indicator === true) blockers.push('freeze_authority_active');
    if (rf.mint_authority_indicator === true) blockers.push('mint_authority_active');
    if (rf.owner_concentration_indicator === true) blockers.push('owner_concentration_high');
    if (rf.blacklist_indicator === true) blockers.push('blacklist_indicator');
    if (blockers.length > 0) {
      return build('HARD_RISK_BLOCKED', blockers, ['hard_risk_blocked']);
    }

    // unknown metadata (no hard blocker) -> DEGRADED (NOT pass)
    if (rf.unknown_token_metadata === true) {
      return build('HARD_RISK_DEGRADED', ['unknown_token_metadata'], ['unknown_token_metadata']);
    }

    // all indicators false/clean -> ADVISORY pass (opens NO execution authority)
    return build('HARD_RISK_PASS_ADVISORY', ['clean_factors_advisory'], []);
  } catch {
    return build('HARD_RISK_UNCONFIGURED', [], ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (E) LIQUIDITY / EXIT FEASIBILITY RISK
//
// Descriptive from input BUCKETS only. NO live quote, NO Jupiter, NO route, NO
// order. A PASS is ADVISORY ONLY and opens NO route/intent. Fail-Safe: thin
// liquidity / poor exit / high slippage -> BLOCKED; unknowns -> DEGRADED.
// ---------------------------------------------------------------------------

const LIQUIDITY_EXIT_STATES = Object.freeze([
  'LIQUIDITY_EXIT_UNCONFIGURED', 'LIQUIDITY_EXIT_INVALID', 'LIQUIDITY_EXIT_DEGRADED',
  'LIQUIDITY_EXIT_BLOCKED', 'LIQUIDITY_EXIT_PASS_ADVISORY'
]);

const LIQUIDITY_EXIT_REASON_CODES = Object.freeze([
  'liquidity_unknown', 'liquidity_thin', 'exit_feasibility_unknown',
  'exit_feasibility_poor', 'exit_feasibility_limited', 'slippage_unknown',
  'slippage_high', 'slippage_medium', 'liquidity_exit_feasible_advisory'
]);

const LIQUIDITY_BUCKETS = Object.freeze(['unknown', 'thin', 'adequate', 'deep']);
const EXIT_BUCKETS = Object.freeze(['unknown', 'poor', 'limited', 'feasible']);
const SLIPPAGE_BUCKETS = Object.freeze(['unknown', 'high', 'medium', 'low']);

export function describeLiquidityExitRiskContract() {
  return Object.freeze({
    contract: 'liquidity-exit-risk',
    version: '0.0.0',
    test_only: true,
    supported_states: LIQUIDITY_EXIT_STATES,
    supported_reason_codes: LIQUIDITY_EXIT_REASON_CODES,
    supported_liquidity_buckets: LIQUIDITY_BUCKETS,
    supported_exit_buckets: EXIT_BUCKETS,
    supported_slippage_buckets: SLIPPAGE_BUCKETS,
    advisory_only: true,
    valid: false,
    liquidity_exit_state: 'LIQUIDITY_EXIT_UNCONFIGURED',
    exit_feasible_advisory: false,
    risk_blocked: false,
    risk_reason_codes: Object.freeze([]),
    status: 'LIQUIDITY_EXIT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...riskSafeFlags(),
    note: 'Read-only ADVISORY liquidity / exit-feasibility risk derived DESCRIPTIVELY from input buckets ONLY (liquidity_observed_bucket / exit_feasibility_bucket / slippage_risk_bucket). NO live quote, NO Jupiter, NO route, NO order — no quote/route/order field appears in any output. Fail-Safe-Not-Fail-Open: thin liquidity OR poor exit OR high slippage -> LIQUIDITY_EXIT_BLOCKED; any unknown / limited exit / medium slippage (with no blocker) -> LIQUIDITY_EXIT_DEGRADED; only adequate/deep liquidity + feasible exit + low/medium slippage with nothing unknown/blocked -> LIQUIDITY_EXIT_PASS_ADVISORY. A PASS is ADVISORY ONLY and opens NO route / intent — risk_ready and every execution flag STAY false. Smuggled forbidden flags / execution commands / secrets / endpoints / mainnet / REAL-LIVE are refused (LIQUIDITY_EXIT_INVALID) and never echoed.'
  });
}

export function validateLiquidityExitRiskInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (riskUninspectable(obj, ['purpose', 'liquidity_observed_bucket', 'exit_feasibility_bucket', 'slippage_risk_bucket'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...riskSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_liquidity_exit_input');
    } else {
      recognized = true;
      reasons.push(...riskScreen(obj));
      if (obj.purpose !== 'liquidity_exit_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...riskSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...riskSafeFlags()
    });
  }
}

export function evaluateLiquidityExitRisk(input) {
  const build = (state, reasonCodes, reasons) => Object.freeze({
    valid: (state !== 'LIQUIDITY_EXIT_INVALID'),
    liquidity_exit_state: state,
    exit_feasible_advisory: (state === 'LIQUIDITY_EXIT_PASS_ADVISORY'),
    risk_blocked: (state === 'LIQUIDITY_EXIT_BLOCKED'),
    risk_reason_codes: Object.freeze([...new Set((reasonCodes || []).filter((x) => LIQUIDITY_EXIT_REASON_CODES.includes(x)))]),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...riskSafeFlags()
  });
  try {
    const v = validateLiquidityExitRiskInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('LIQUIDITY_EXIT_UNCONFIGURED', [], v.reasons.length ? v.reasons : ['no_liquidity_exit_input']);
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid')) {
      return build('LIQUIDITY_EXIT_INVALID', [], v.reasons);
    }

    const liq = input.liquidity_observed_bucket;
    const exit = input.exit_feasibility_bucket;
    const slip = input.slippage_risk_bucket;

    // missing bucket(s) -> UNCONFIGURED
    if (liq === undefined || liq === null ||
        exit === undefined || exit === null ||
        slip === undefined || slip === null) {
      return build('LIQUIDITY_EXIT_UNCONFIGURED', [], ['bucket_missing']);
    }
    // invalid (out-of-enum) bucket value -> INVALID
    if (!LIQUIDITY_BUCKETS.includes(liq) || !EXIT_BUCKETS.includes(exit) || !SLIPPAGE_BUCKETS.includes(slip)) {
      return build('LIQUIDITY_EXIT_INVALID', [], ['bucket_value_invalid']);
    }

    // BLOCKED (Fail-Safe): thin liquidity OR poor exit OR high slippage
    const blockers = [];
    if (liq === 'thin') blockers.push('liquidity_thin');
    if (exit === 'poor') blockers.push('exit_feasibility_poor');
    if (slip === 'high') blockers.push('slippage_high');
    if (blockers.length > 0) {
      return build('LIQUIDITY_EXIT_BLOCKED', blockers, ['liquidity_exit_blocked']);
    }

    // DEGRADED: any unknown OR limited exit OR medium slippage
    const degraded = [];
    if (liq === 'unknown') degraded.push('liquidity_unknown');
    if (exit === 'unknown') degraded.push('exit_feasibility_unknown');
    if (exit === 'limited') degraded.push('exit_feasibility_limited');
    if (slip === 'unknown') degraded.push('slippage_unknown');
    if (slip === 'medium') degraded.push('slippage_medium');
    if (degraded.length > 0) {
      return build('LIQUIDITY_EXIT_DEGRADED', degraded, ['liquidity_exit_degraded']);
    }

    // PASS_ADVISORY: liquidity adequate/deep + exit feasible + slippage low
    // (medium slippage already routed to DEGRADED above; remaining slip here is 'low')
    if ((liq === 'adequate' || liq === 'deep') && exit === 'feasible' && slip === 'low') {
      return build('LIQUIDITY_EXIT_PASS_ADVISORY', ['liquidity_exit_feasible_advisory'], []);
    }

    // anything else -> DEGRADED (Fail-Safe default)
    return build('LIQUIDITY_EXIT_DEGRADED', [], ['liquidity_exit_degraded']);
  } catch {
    return build('LIQUIDITY_EXIT_UNCONFIGURED', [], ['input_inspection_error']);
  }
}
