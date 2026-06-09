// @soltrade/signal-engine-foundations
//
// Read-only / advisory ONLY signal foundation for Stage-6. Import-free, pure,
// deterministic. No network primitive, no live stream, no system clock, no
// persistence, no secrets. Input comes ONLY from Stage-5 intelligence outputs,
// NEVER from raw events / endpoints / commands.
//
// THE CORE RULE: a candidate signal is NOT a buy order, NOT a copy permission,
// NOT trading readiness, NOT risk approval, NOT an intent, NOT a route. It is
// advisory / read-only ONLY. signal_ready STAYS false on every result — "a
// candidate signal exists" is carried ONLY by dedicated fields
// (candidate_signal_valid / candidate_signal_state / eligible_for_candidate_signal
// / score_bucket), never by a readiness flag. Hostile, throwing, or
// uninspectable input returns a FROZEN refusal with reason
// 'input_inspection_error' and NEVER throws.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function sigSafeFlags() {
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

const SIG_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'can_send', 'can_broadcast', 'can_serialize', 'signing_permitted',
  'broadcast_permitted', 'is_live', 'real_live', 'mainnet_enabled',
  'live_stream_enabled', 'network_call_made', 'endpoint_resolved'
]);

const SIG_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap',
  'copy_now', 'trade_now', 'sign', 'buy_opportunity', 'execute_opportunity',
  'submit_opportunity', 'buy_signal', 'sell_signal', 'copy_signal',
  'alpha_signal', 'order', 'place_order'
]);

const SIG_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential/i;
const SIG_URL_RE = /https?:\/\/|wss?:\/\//i;
const SIG_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan
// (e.g. token_ref contains 'token', signal_ref contains 'signal')
const SIG_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'wallet_ref', 'token_ref', 'event_ref', 'source_ref',
  'signature_ref', 'slot_ref', 'observed_at_ref', 'first_observed_ref',
  'last_observed_ref', 'first_seen_ref', 'last_seen_ref', 'event_type',
  'explanation_refs', 'signal_ref'
]);

// Stage-5 raw ingestion event types — these MUST NOT arrive directly at the
// signal layer (they carry no intelligence *_state field). A raw event in any
// signal-input slot is REFUSED.
const SIG_RAW_INGESTION_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed', 'token_account_change_observed',
  'swap_observed', 'mint_observed', 'pool_observed', 'balance_change_observed'
]);

function sigHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of SIG_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function sigHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (SIG_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function sigHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (SIG_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (SIG_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function sigHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (SIG_URL_RE.test(v) || SIG_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function sigScreen(o) {
  const r = [];
  if (sigHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (sigHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (sigHasSecretField(o)) r.push('secret_field_blocked');
  if (sigHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors throw OR return functions -> uninspectable -> fail closed
function sigUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

// A raw ingestion event = has a recognized raw event_type but NO intelligence
// *_state field. Such an object must NEVER be accepted as a Stage-5 result.
function sigIsRawIngestionEvent(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return false;
  const et = o.event_type;
  if (typeof et !== 'string' || !SIG_RAW_INGESTION_EVENT_TYPES.includes(et)) return false;
  // If it ALSO carries an intelligence state field, it is not a bare raw event.
  if (typeof o.wallet_observation_state === 'string') return false;
  if (typeof o.token_observation_state === 'string') return false;
  if (typeof o.relationship_state === 'string') return false;
  if (typeof o.diagnostics_state === 'string') return false;
  if (typeof o.intelligence_state === 'string') return false;
  return true;
}

// Stage-5 component recognizers: a valid component has its state field present
// with an allowed value AND read_only === true. (Read-only is mandatory.)
const SIG_WALLET_OBS_STATES = Object.freeze([
  'WALLET_OBS_UNCONFIGURED', 'WALLET_OBS_INVALID', 'WALLET_OBS_DEGRADED', 'WALLET_OBS_READ_ONLY_OK'
]);
const SIG_TOKEN_OBS_STATES = Object.freeze([
  'TOKEN_OBS_UNCONFIGURED', 'TOKEN_OBS_INVALID', 'TOKEN_OBS_DEGRADED', 'TOKEN_OBS_READ_ONLY_OK'
]);
const SIG_RELATIONSHIP_STATES = Object.freeze([
  'RELATIONSHIP_UNCONFIGURED', 'RELATIONSHIP_INVALID', 'RELATIONSHIP_DEGRADED', 'RELATIONSHIP_READ_ONLY_OK'
]);
const SIG_DIAGNOSTICS_STATES = Object.freeze([
  'DIAGNOSTICS_UNCONFIGURED', 'DIAGNOSTICS_INVALID', 'DIAGNOSTICS_READ_ONLY_OK'
]);
const SIG_INTELLIGENCE_STATES = Object.freeze([
  'INTELLIGENCE_UNCONFIGURED', 'INTELLIGENCE_DEGRADED',
  'INTELLIGENCE_READY_READ_ONLY', 'INTELLIGENCE_BLOCKED'
]);

function sigComponentState(o, field, allowed) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.read_only !== true) return null;
  const s = o[field];
  if (typeof s === 'string' && allowed.includes(s)) return s;
  return null;
}

// confidence bucket from a non-negative observation count (DESCRIPTIVE only;
// never a trade size / slippage / stop-loss / numeric score).
function sigConfidenceBucket(count) {
  const c = (typeof count === 'number' && count >= 0) ? count : 0;
  if (c <= 0) return 'none';
  if (c < 3) return 'low';
  if (c < 8) return 'medium';
  return 'high';
}

// ---------------------------------------------------------------------------
// (C) SIGNAL INPUT BOUNDARY
//
// Verifies that signal input comes ONLY from Stage-5 intelligence outputs,
// never from raw events / endpoints / commands. The boundary being VALID opens
// NO signal/trading/risk/intent/routing readiness; it only marks the input
// shape eligible to be considered for a candidate signal downstream.
// ---------------------------------------------------------------------------

const SIGNAL_INPUT_STATES = Object.freeze([
  'SIGNAL_INPUT_UNCONFIGURED', 'SIGNAL_INPUT_INVALID',
  'SIGNAL_INPUT_DEGRADED', 'SIGNAL_INPUT_VALID'
]);

export function describeSignalInputBoundaryContract() {
  return Object.freeze({
    contract: 'signal-input-boundary',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNAL_INPUT_STATES,
    advisory_only: true,
    signal_input_state: 'SIGNAL_INPUT_UNCONFIGURED',
    input_boundary_valid: false,
    eligible_for_candidate_signal: false,
    status: 'SIGNAL_INPUT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sigSafeFlags(),
    note: 'Read-only signal-input boundary. Verifies signal input comes ONLY from Stage-5 intelligence outputs (wallet/token observation, relationship, diagnostics, intelligence health), never from raw ingestion events, endpoints, or execution commands. A VALID boundary opens NO signal/trading/risk/intent/routing readiness; eligible_for_candidate_signal marks input shape only. Raw ingestion events, smuggled trading flags/commands, secrets, endpoints, and mainnet/REAL-LIVE markers are refused and never echoed.'
  });
}

export function validateSignalInputBoundary(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sigUninspectable(obj, ['purpose', 'wallet_observation', 'token_observation', 'relationship', 'diagnostics', 'intelligence_health'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...sigSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_signal_input');
    } else {
      recognized = true;
      const COMPONENTS = ['wallet_observation', 'token_observation', 'relationship', 'diagnostics', 'intelligence_health'];
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...sigScreen(shallow));
      // each component is value-screened for forbidden flags / raw events
      for (const k of COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (sigHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (sigIsRawIngestionEvent(c)) reasons.push('raw_ingestion_event_refused');
      }
      if (obj.purpose !== 'signal_input_boundary') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...sigSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...sigSafeFlags()
    });
  }
}

export function evaluateSignalInputBoundary(input) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'SIGNAL_INPUT_INVALID'),
    input_boundary_valid: (state === 'SIGNAL_INPUT_VALID'),
    eligible_for_candidate_signal: (state === 'SIGNAL_INPUT_VALID'),
    signal_input_state: state,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    read_only: true,
    advisory_only: true,
    ...sigSafeFlags()
  });
  try {
    const v = validateSignalInputBoundary(input);
    // unrecognized / hostile -> UNCONFIGURED
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('SIGNAL_INPUT_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_signal_input']);
    }
    // smuggled forbidden flag / exec cmd / secret / endpoint / mainnet / raw event / bad purpose -> INVALID
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_ingestion_event_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('SIGNAL_INPUT_INVALID', v.reasons);
    }

    const w = input.wallet_observation;
    const t = input.token_observation;
    const r = input.relationship;
    const d = input.diagnostics;
    const h = input.intelligence_health;

    const wS = sigComponentState(w, 'wallet_observation_state', SIG_WALLET_OBS_STATES);
    const tS = sigComponentState(t, 'token_observation_state', SIG_TOKEN_OBS_STATES);
    const rS = sigComponentState(r, 'relationship_state', SIG_RELATIONSHIP_STATES);
    const dS = sigComponentState(d, 'diagnostics_state', SIG_DIAGNOSTICS_STATES);
    const hS = sigComponentState(h, 'intelligence_state', SIG_INTELLIGENCE_STATES);

    // a present-but-unrecognized component (wrong shape / read_only missing) -> refuse
    const present = (c) => c != null && typeof c === 'object';
    if ((present(w) && wS === null) || (present(t) && tS === null) ||
        (present(r) && rS === null) || (present(d) && dS === null) ||
        (present(h) && hS === null)) {
      return build('SIGNAL_INPUT_INVALID', ['component_not_stage5_intelligence']);
    }

    // intelligence health BLOCKED or any component *_INVALID -> INVALID
    if (hS === 'INTELLIGENCE_BLOCKED' ||
        wS === 'WALLET_OBS_INVALID' || tS === 'TOKEN_OBS_INVALID' ||
        rS === 'RELATIONSHIP_INVALID' || dS === 'DIAGNOSTICS_INVALID') {
      return build('SIGNAL_INPUT_INVALID', ['intelligence_component_invalid']);
    }

    // required minimum components: wallet_observation + token_observation + intelligence_health
    if (wS === null || tS === null || hS === null) {
      return build('SIGNAL_INPUT_UNCONFIGURED', ['required_component_missing']);
    }

    // health degraded/unconfigured or any present component degraded -> DEGRADED
    const degraded = [];
    if (hS === 'INTELLIGENCE_DEGRADED') degraded.push('intelligence_health_degraded');
    if (hS === 'INTELLIGENCE_UNCONFIGURED') degraded.push('intelligence_health_unconfigured');
    if (wS === 'WALLET_OBS_DEGRADED' || wS === 'WALLET_OBS_UNCONFIGURED') degraded.push('wallet_observation_not_ready');
    if (tS === 'TOKEN_OBS_DEGRADED' || tS === 'TOKEN_OBS_UNCONFIGURED') degraded.push('token_observation_not_ready');
    if (rS === 'RELATIONSHIP_DEGRADED' || rS === 'RELATIONSHIP_UNCONFIGURED') degraded.push('relationship_not_ready');
    if (dS === 'DIAGNOSTICS_UNCONFIGURED') degraded.push('diagnostics_not_ready');
    if (degraded.length > 0) {
      return build('SIGNAL_INPUT_DEGRADED', degraded);
    }

    // all present components read-only-ok AND health READY_READ_ONLY -> VALID
    if (wS === 'WALLET_OBS_READ_ONLY_OK' && tS === 'TOKEN_OBS_READ_ONLY_OK' &&
        hS === 'INTELLIGENCE_READY_READ_ONLY') {
      return build('SIGNAL_INPUT_VALID', []);
    }
    return build('SIGNAL_INPUT_DEGRADED', ['not_all_components_ready']);
  } catch {
    return build('SIGNAL_INPUT_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (D) WALLET-LED CANDIDATE SIGNAL
//
// Descriptive candidate derived from wallet activity intelligence ONLY. NEVER a
// buy/sell/copy order. A WALLET_LED_CANDIDATE is advisory/read-only ONLY with
// every execution flag false; "candidate exists" is carried by
// candidate_signal_valid / candidate_signal_state only.
// ---------------------------------------------------------------------------

const WALLET_LED_STATES = Object.freeze([
  'WALLET_LED_UNCONFIGURED', 'WALLET_LED_INVALID',
  'WALLET_LED_SUPPRESSED', 'WALLET_LED_CANDIDATE'
]);

const WALLET_LED_REASON_CODES = Object.freeze([
  'wallet_activity_observed', 'wallet_token_relationship_observed',
  'repeat_interaction_observed', 'sufficient_observation_density',
  'insufficient_observations'
]);

export function describeWalletLedCandidateSignalContract() {
  return Object.freeze({
    contract: 'wallet-led-candidate-signal',
    version: '0.0.0',
    test_only: true,
    supported_states: WALLET_LED_STATES,
    supported_reason_codes: WALLET_LED_REASON_CODES,
    advisory_only: true,
    signal_kind: 'wallet_led_candidate',
    candidate_signal_valid: false,
    candidate_signal_state: 'WALLET_LED_UNCONFIGURED',
    confidence_bucket: 'none',
    status: 'WALLET_LED_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sigSafeFlags(),
    note: 'Read-only ADVISORY wallet-led candidate signal derived from Stage-5 wallet observation intelligence (and optional relationship/diagnostics). A candidate is NEVER a buy/sell/copy order, copy permission, trading readiness, risk approval, intent, or route. candidate_signal_valid/candidate_signal_state carry "a candidate exists" — signal_ready and every execution flag STAY false. confidence_bucket is DESCRIPTIVE only (derived from observed counts), never a trade size/slippage/stop-loss/numeric score. Smuggled buy/sell/copy/execute/order keys, forbidden flags, secrets, endpoints, mainnet/REAL-LIVE, or raw ingestion events are refused and never echoed.'
  });
}

export function validateWalletLedSignalInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sigUninspectable(obj, ['purpose', 'wallet_observation', 'relationship', 'diagnostics'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...sigSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_wallet_led_input');
    } else {
      recognized = true;
      const COMPONENTS = ['wallet_observation', 'relationship', 'diagnostics'];
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!COMPONENTS.includes(k)) shallow[k] = v;
      }
      reasons.push(...sigScreen(shallow));
      for (const k of COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (sigHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (sigHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (sigIsRawIngestionEvent(c)) reasons.push('raw_ingestion_event_refused');
      }
      if (obj.purpose !== 'wallet_led_signal_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...sigSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...sigSafeFlags()
    });
  }
}

export function evaluateWalletLedCandidateSignal(input) {
  const build = (state, reasonCodes, fields) => Object.freeze({
    candidate_signal_valid: (state === 'WALLET_LED_CANDIDATE'),
    candidate_signal_state: state,
    signal_kind: 'wallet_led_candidate',
    wallet_ref: (state === 'WALLET_LED_CANDIDATE' || state === 'WALLET_LED_SUPPRESSED') ? fields.wallet_ref : undefined,
    token_ref: (state === 'WALLET_LED_CANDIDATE' || state === 'WALLET_LED_SUPPRESSED') ? fields.token_ref : undefined,
    reason_codes: Object.freeze((reasonCodes || []).filter((x) => WALLET_LED_REASON_CODES.includes(x))),
    explanation_refs: Object.freeze(fields.explanation_refs ? [...fields.explanation_refs] : []),
    confidence_bucket: fields.confidence_bucket || 'none',
    status: state,
    reasons: Object.freeze([...new Set(fields.reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...sigSafeFlags()
  });
  try {
    const v = validateWalletLedSignalInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('WALLET_LED_UNCONFIGURED', [], { reasons: v.reasons.length ? v.reasons : ['no_wallet_led_input'] });
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_ingestion_event_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('WALLET_LED_INVALID', [], { reasons: v.reasons });
    }

    const w = input.wallet_observation;
    const r = input.relationship;
    const wS = sigComponentState(w, 'wallet_observation_state', SIG_WALLET_OBS_STATES);
    const rS = (r != null && typeof r === 'object')
      ? sigComponentState(r, 'relationship_state', SIG_RELATIONSHIP_STATES) : 'OMITTED';

    if (wS === null) {
      return build('WALLET_LED_UNCONFIGURED', [], { reasons: ['wallet_observation_missing_or_not_stage5'] });
    }
    if (wS === 'WALLET_OBS_INVALID' || rS === null) {
      return build('WALLET_LED_INVALID', [], { reasons: ['intelligence_component_invalid'] });
    }

    const wCount = (typeof w.observed_event_count === 'number' && w.observed_event_count >= 0) ? w.observed_event_count : 0;
    // insufficient: wallet not READ_ONLY_OK or zero observed events -> SUPPRESSED
    if (wS !== 'WALLET_OBS_READ_ONLY_OK' || wCount === 0) {
      return build('WALLET_LED_SUPPRESSED', ['insufficient_observations'], {
        wallet_ref: (typeof w.wallet_ref === 'string') ? w.wallet_ref : undefined,
        confidence_bucket: 'none',
        reasons: ['insufficient_observations']
      });
    }

    const reasonCodes = ['wallet_activity_observed'];
    const explain = [];
    if (typeof w.first_observed_ref === 'string') explain.push(w.first_observed_ref);
    if (typeof w.last_observed_ref === 'string') explain.push(w.last_observed_ref);

    let tokenRef;
    const relReadyOk = rS === 'RELATIONSHIP_READ_ONLY_OK';
    if (relReadyOk) {
      reasonCodes.push('wallet_token_relationship_observed');
      if (typeof r.token_ref === 'string') tokenRef = r.token_ref;
      const relCount = (typeof r.relationship_event_count === 'number') ? r.relationship_event_count : 0;
      if (relCount > 1) reasonCodes.push('repeat_interaction_observed');
    }
    if (wCount >= 3) reasonCodes.push('sufficient_observation_density');

    return build('WALLET_LED_CANDIDATE', reasonCodes, {
      wallet_ref: (typeof w.wallet_ref === 'string') ? w.wallet_ref : undefined,
      token_ref: tokenRef,
      explanation_refs: explain,
      confidence_bucket: sigConfidenceBucket(wCount),
      reasons: []
    });
  } catch {
    return build('WALLET_LED_UNCONFIGURED', [], { reasons: ['input_inspection_error'] });
  }
}

// ---------------------------------------------------------------------------
// (E) TOKEN ACTIVITY CANDIDATE SIGNAL
//
// Descriptive candidate derived from token intelligence ONLY. NEVER opportunity
// execution. A mint/pool observation NEVER becomes a buy opportunity. An
// 'accepted:true' field is IGNORED (never read as execution authority).
// ---------------------------------------------------------------------------

const TOKEN_ACTIVITY_STATES = Object.freeze([
  'TOKEN_ACTIVITY_UNCONFIGURED', 'TOKEN_ACTIVITY_INVALID',
  'TOKEN_ACTIVITY_SUPPRESSED', 'TOKEN_ACTIVITY_CANDIDATE'
]);

const TOKEN_ACTIVITY_REASON_CODES = Object.freeze([
  'token_activity_observed', 'pool_observed', 'mint_observed',
  'multi_wallet_activity_observed', 'insufficient_token_observations'
]);

export function describeTokenActivityCandidateSignalContract() {
  return Object.freeze({
    contract: 'token-activity-candidate-signal',
    version: '0.0.0',
    test_only: true,
    supported_states: TOKEN_ACTIVITY_STATES,
    supported_reason_codes: TOKEN_ACTIVITY_REASON_CODES,
    advisory_only: true,
    signal_kind: 'token_activity_candidate',
    candidate_signal_valid: false,
    candidate_signal_state: 'TOKEN_ACTIVITY_UNCONFIGURED',
    confidence_bucket: 'none',
    status: 'TOKEN_ACTIVITY_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sigSafeFlags(),
    note: 'Read-only ADVISORY token-activity candidate signal derived from Stage-5 token observation intelligence (and optional relationship/diagnostics). A mint/pool observation NEVER becomes a buy opportunity or opportunity execution. candidate_signal_valid/candidate_signal_state carry "a candidate exists" — signal_ready and every execution flag STAY false. confidence_bucket is DESCRIPTIVE only. An accepted:true field is IGNORED (never read as authority). buy_opportunity/execute_opportunity/submit_opportunity (and other exec keys), forbidden flags, secrets, endpoints, mainnet/REAL-LIVE, or raw ingestion events are refused and never echoed.'
  });
}

export function validateTokenActivitySignalInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sigUninspectable(obj, ['purpose', 'token_observation', 'relationship', 'diagnostics'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...sigSafeFlags()
      });
    }
    const reasons = [];
    let recognized = false;
    if (!obj) {
      reasons.push('no_token_activity_input');
    } else {
      recognized = true;
      // 'accepted' is explicitly IGNORED (not authority); exclude it AND the
      // component objects from the shallow screen.
      const COMPONENTS = ['token_observation', 'relationship', 'diagnostics'];
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!COMPONENTS.includes(k) && k !== 'accepted') shallow[k] = v;
      }
      reasons.push(...sigScreen(shallow));
      for (const k of COMPONENTS) {
        const c = obj[k];
        if (c == null) continue;
        if (sigHasForbiddenTrueFlag(c)) reasons.push('forbidden_trading_indicator_blocked');
        if (sigHasExecCmdKey(c)) reasons.push('execution_command_blocked');
        if (sigIsRawIngestionEvent(c)) reasons.push('raw_ingestion_event_refused');
      }
      if (obj.purpose !== 'token_activity_signal_input') reasons.push('purpose_invalid');
    }
    const unique = [...new Set(reasons)];
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...sigSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...sigSafeFlags()
    });
  }
}

export function evaluateTokenActivityCandidateSignal(input) {
  const build = (state, reasonCodes, fields) => Object.freeze({
    candidate_signal_valid: (state === 'TOKEN_ACTIVITY_CANDIDATE'),
    candidate_signal_state: state,
    signal_kind: 'token_activity_candidate',
    token_ref: (state === 'TOKEN_ACTIVITY_CANDIDATE' || state === 'TOKEN_ACTIVITY_SUPPRESSED') ? fields.token_ref : undefined,
    reason_codes: Object.freeze((reasonCodes || []).filter((x) => TOKEN_ACTIVITY_REASON_CODES.includes(x))),
    explanation_refs: Object.freeze(fields.explanation_refs ? [...fields.explanation_refs] : []),
    confidence_bucket: fields.confidence_bucket || 'none',
    status: state,
    reasons: Object.freeze([...new Set(fields.reasons || [])]),
    read_only: true,
    advisory_only: true,
    ...sigSafeFlags()
  });
  try {
    const v = validateTokenActivitySignalInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('TOKEN_ACTIVITY_UNCONFIGURED', [], { reasons: v.reasons.length ? v.reasons : ['no_token_activity_input'] });
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('raw_ingestion_event_refused') ||
        v.reasons.includes('purpose_invalid')) {
      return build('TOKEN_ACTIVITY_INVALID', [], { reasons: v.reasons });
    }

    const t = input.token_observation;
    const r = input.relationship;
    const tS = sigComponentState(t, 'token_observation_state', SIG_TOKEN_OBS_STATES);
    const rS = (r != null && typeof r === 'object')
      ? sigComponentState(r, 'relationship_state', SIG_RELATIONSHIP_STATES) : 'OMITTED';

    if (tS === null) {
      return build('TOKEN_ACTIVITY_UNCONFIGURED', [], { reasons: ['token_observation_missing_or_not_stage5'] });
    }
    if (tS === 'TOKEN_OBS_INVALID' || rS === null) {
      return build('TOKEN_ACTIVITY_INVALID', [], { reasons: ['intelligence_component_invalid'] });
    }

    const tCount = (typeof t.observed_event_count === 'number' && t.observed_event_count >= 0) ? t.observed_event_count : 0;
    if (tS !== 'TOKEN_OBS_READ_ONLY_OK' || tCount === 0) {
      return build('TOKEN_ACTIVITY_SUPPRESSED', ['insufficient_token_observations'], {
        token_ref: (typeof t.token_ref === 'string') ? t.token_ref : undefined,
        confidence_bucket: 'none',
        reasons: ['insufficient_token_observations']
      });
    }

    const reasonCodes = ['token_activity_observed'];
    const poolCount = (typeof t.observed_pool_count === 'number') ? t.observed_pool_count : 0;
    const mintCount = (typeof t.observed_mint_count === 'number') ? t.observed_mint_count : 0;
    const walletCount = (typeof t.observed_wallet_count === 'number') ? t.observed_wallet_count : 0;
    if (poolCount > 0) reasonCodes.push('pool_observed');
    if (mintCount > 0) reasonCodes.push('mint_observed');
    if (walletCount > 1) reasonCodes.push('multi_wallet_activity_observed');

    const explain = [];
    if (typeof t.first_observed_ref === 'string') explain.push(t.first_observed_ref);
    if (typeof t.last_observed_ref === 'string') explain.push(t.last_observed_ref);

    return build('TOKEN_ACTIVITY_CANDIDATE', reasonCodes, {
      token_ref: (typeof t.token_ref === 'string') ? t.token_ref : undefined,
      explanation_refs: explain,
      confidence_bucket: sigConfidenceBucket(tCount),
      reasons: []
    });
  } catch {
    return build('TOKEN_ACTIVITY_UNCONFIGURED', [], { reasons: ['input_inspection_error'] });
  }
}

// ---------------------------------------------------------------------------
// Shared helpers for Parts F/G/H (candidate-result recognizers, NOT exported)
//
// A candidate signal RESULT (a Part D/E output) is recognized only if it is an
// inspectable read-only object carrying a candidate_signal_state string. These
// helpers NEVER read execution authority from a candidate and NEVER echo input
// values — they classify only.
// ---------------------------------------------------------------------------

const SIG_CANDIDATE_VALID_STATES = Object.freeze([
  'WALLET_LED_CANDIDATE', 'TOKEN_ACTIVITY_CANDIDATE'
]);
const SIG_CANDIDATE_SUPPRESSED_STATES = Object.freeze([
  'WALLET_LED_SUPPRESSED', 'TOKEN_ACTIVITY_SUPPRESSED'
]);
const SIG_CANDIDATE_KIND_WALLET = 'wallet_led_candidate';
const SIG_CANDIDATE_KIND_TOKEN = 'token_activity_candidate';

// classify a single candidate-result object. Returns one of:
//   'valid' | 'suppressed' | 'invalid' | 'unrecognized'
// and never throws. A forbidden trading flag / exec key / secret / endpoint /
// mainnet smuggled into a candidate result -> 'blocked'.
function sigClassifyCandidateResult(c) {
  if (c == null || typeof c !== 'object' || Array.isArray(c)) return 'unrecognized';
  // hostile / function-accessor -> treat as unrecognized (caller fails closed)
  if (typeof c.candidate_signal_state === 'function' ||
      typeof c.candidate_signal_valid === 'function' ||
      typeof c.confidence_bucket === 'function') return 'unrecognized';
  if (sigScreenComponentResult(c).length > 0) return 'blocked';
  if (c.read_only !== true) return 'unrecognized';
  const s = c.candidate_signal_state;
  const k = c.signal_kind;
  if (typeof s !== 'string') return 'unrecognized';
  if (k !== SIG_CANDIDATE_KIND_WALLET && k !== SIG_CANDIDATE_KIND_TOKEN) return 'unrecognized';
  if (SIG_CANDIDATE_VALID_STATES.includes(s) && c.candidate_signal_valid === true) return 'valid';
  if (SIG_CANDIDATE_SUPPRESSED_STATES.includes(s)) return 'suppressed';
  if (s === 'WALLET_LED_INVALID' || s === 'TOKEN_ACTIVITY_INVALID') return 'invalid';
  // UNCONFIGURED or anything else recognized-but-not-candidate
  return 'unrecognized';
}

function sigCandidateKindLabel(c) {
  if (c == null || typeof c !== 'object') return null;
  const k = c.signal_kind;
  if (k === SIG_CANDIDATE_KIND_WALLET) return 'wallet_led';
  if (k === SIG_CANDIDATE_KIND_TOKEN) return 'token_activity';
  return null;
}

function sigCandidateBucket(c) {
  if (c == null || typeof c !== 'object') return 'none';
  const b = c.confidence_bucket;
  return (b === 'low' || b === 'medium' || b === 'high') ? b : 'none';
}

// Screen a Stage-5/Stage-6 RESULT object passed in a component slot. Mirrors the
// Part D/E component screen: forbidden trading flag, execution-command KEY, raw
// ingestion event, and endpoint/mainnet by string VALUE. It does NOT run the
// secret-NAME scan, because legitimate component state fields (e.g.
// token_observation_state, intelligence_state) contain the substring 'token' and
// are not secrets. A smuggled raw secret VALUE would still surface as an endpoint
// only if it were a URL; bare secret values are not echoed because results spread
// only fixed literals / allowlisted tokens.
function sigScreenComponentResult(c) {
  const r = [];
  if (c == null || typeof c !== 'object') return r;
  if (sigHasForbiddenTrueFlag(c)) r.push('forbidden_trading_indicator_blocked');
  if (sigHasExecCmdKey(c)) r.push('execution_command_blocked');
  if (sigHasEndpointOrMainnet(c)) r.push('endpoint_or_mainnet_blocked');
  if (sigIsRawIngestionEvent(c)) r.push('raw_ingestion_event_refused');
  return r;
}

// ---------------------------------------------------------------------------
// (G) SIGNAL SUPPRESSION / REJECTION
//
// Prevents insufficient candidates from appearing ready; reasons ONLY. This is
// NOT a risk engine (suppression happens BEFORE risk). A suppression result
// opens NO risk/intent/trading readiness. not_risk_checked / not_intent_authorized
// / not_execution_authorized are ALWAYS included when reasons are emitted — a
// signal is never risk-checked, intent-authorized, or execution-authorized here.
// ---------------------------------------------------------------------------

const SIG_SUPPRESSION_REASON_CODES = Object.freeze([
  'insufficient_observations', 'missing_wallet_context', 'missing_token_context',
  'relationship_not_observed', 'diagnostic_only', 'not_risk_checked',
  'not_intent_authorized', 'not_execution_authorized'
]);

const SIG_SUPPRESSION_BASELINE = Object.freeze([
  'not_risk_checked', 'not_intent_authorized', 'not_execution_authorized'
]);

const SIGNAL_SUPPRESSION_STATES = Object.freeze([
  'SIGNAL_SUPPRESSION_UNCONFIGURED', 'SIGNAL_SUPPRESSION_INVALID',
  'SIGNAL_SUPPRESSION_SUPPRESSED', 'SIGNAL_SUPPRESSION_NOT_SUPPRESSED'
]);

export function describeSignalSuppressionContract() {
  return Object.freeze({
    contract: 'signal-suppression',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNAL_SUPPRESSION_STATES,
    supported_suppression_reasons: SIG_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    suppressed: false,
    suppression_reasons: Object.freeze([]),
    status: 'SIGNAL_SUPPRESSION_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sigSafeFlags(),
    note: 'Read-only signal suppression. Prevents insufficient candidates from appearing ready by emitting suppression REASONS only. Suppression is NOT a risk engine — it happens BEFORE risk and opens NO risk/intent/trading readiness (every execution flag STAYS false). When reasons are emitted, not_risk_checked / not_intent_authorized / not_execution_authorized are ALWAYS included: a signal is never risk-checked, intent-authorized, or execution-authorized at this layer. Missing wallet/token context, an unobserved relationship, or diagnostic-only input each yield suppression. Smuggled forbidden flags/commands/secrets/endpoints/mainnet/REAL-LIVE are refused and never echoed.'
  });
}

export function evaluateSignalSuppression(input) {
  const build = (state, suppressed, suppressionReasons, reasons) => {
    const sr = [...new Set((suppressionReasons || []).filter((x) => SIG_SUPPRESSION_REASON_CODES.includes(x)))];
    return Object.freeze({
      suppressed: !!suppressed,
      suppression_reasons: Object.freeze(sr),
      signal_suppression_state: state,
      status: state,
      reasons: Object.freeze([...new Set(reasons || [])]),
      advisory_only: true,
      read_only: true,
      ...sigSafeFlags()
    });
  };
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sigUninspectable(obj, ['purpose', 'candidate_signal', 'wallet_observation', 'token_observation', 'relationship', 'diagnostics', 'wallet_context', 'token_context'])) {
      return build('SIGNAL_SUPPRESSION_UNCONFIGURED', true,
        ['diagnostic_only', ...SIG_SUPPRESSION_BASELINE], ['input_inspection_error']);
    }
    if (!obj) {
      return build('SIGNAL_SUPPRESSION_UNCONFIGURED', true,
        ['missing_wallet_context', 'missing_token_context', ...SIG_SUPPRESSION_BASELINE],
        ['no_suppression_input']);
    }
    // top-level shallow screen (components excluded from key-name screen)
    const COMPONENTS = ['candidate_signal', 'wallet_observation', 'token_observation', 'relationship', 'diagnostics'];
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!COMPONENTS.includes(k)) shallow[k] = v;
    }
    const screen = sigScreen(shallow);
    for (const k of COMPONENTS) {
      const c = obj[k];
      if (c == null) continue;
      screen.push(...sigScreenComponentResult(c));
    }
    if (screen.length > 0) {
      // fail-closed: emit suppression with baseline only, never echo the smuggled value
      return build('SIGNAL_SUPPRESSION_INVALID', true,
        ['diagnostic_only', ...SIG_SUPPRESSION_BASELINE],
        [...new Set(screen)]);
    }
    if (obj.purpose !== 'signal_suppression_input') {
      return build('SIGNAL_SUPPRESSION_INVALID', true,
        ['diagnostic_only', ...SIG_SUPPRESSION_BASELINE], ['purpose_invalid']);
    }

    const suppressionReasons = [];
    const reasons = [];

    const cand = obj.candidate_signal;
    const candClass = (cand != null) ? sigClassifyCandidateResult(cand) : 'absent';
    if (candClass === 'blocked') {
      return build('SIGNAL_SUPPRESSION_INVALID', true,
        ['diagnostic_only', ...SIG_SUPPRESSION_BASELINE], ['candidate_signal_blocked']);
    }

    // wallet / token context presence (either explicit observation OR via candidate kind)
    const wObs = obj.wallet_observation;
    const tObs = obj.token_observation;
    const wState = sigComponentState(wObs, 'wallet_observation_state', SIG_WALLET_OBS_STATES);
    const tState = sigComponentState(tObs, 'token_observation_state', SIG_TOKEN_OBS_STATES);
    const candKind = sigCandidateKindLabel(cand);

    const hasWalletCtx = wState === 'WALLET_OBS_READ_ONLY_OK' || candKind === 'wallet_led';
    const hasTokenCtx = tState === 'TOKEN_OBS_READ_ONLY_OK' || candKind === 'token_activity';

    if (!hasWalletCtx) suppressionReasons.push('missing_wallet_context');
    if (!hasTokenCtx) suppressionReasons.push('missing_token_context');

    // relationship observed?
    const rel = obj.relationship;
    const rState = sigComponentState(rel, 'relationship_state', SIG_RELATIONSHIP_STATES);
    if (rState !== 'RELATIONSHIP_READ_ONLY_OK') suppressionReasons.push('relationship_not_observed');

    // diagnostic-only input (no candidate, or candidate suppressed/insufficient)
    if (candClass === 'suppressed' || candClass === 'invalid') {
      suppressionReasons.push('insufficient_observations');
    }
    if (candClass === 'absent' || candClass === 'unrecognized') {
      suppressionReasons.push('diagnostic_only');
    }

    // suppressed when ANY blocking context is missing OR candidate is not a valid candidate
    const candidateIsValid = candClass === 'valid';
    const contextComplete = hasWalletCtx && hasTokenCtx;
    const suppressed = !candidateIsValid || !contextComplete ||
      suppressionReasons.includes('insufficient_observations') ||
      suppressionReasons.includes('diagnostic_only');

    if (suppressed) {
      suppressionReasons.push(...SIG_SUPPRESSION_BASELINE);
      const state = (candClass === 'unrecognized' || candClass === 'absent') && !contextComplete
        ? 'SIGNAL_SUPPRESSION_UNCONFIGURED'
        : 'SIGNAL_SUPPRESSION_SUPPRESSED';
      return build(state, true, suppressionReasons, reasons);
    }

    // not suppressed: valid candidate + complete context. Still NOT risk-checked /
    // intent-authorized / execution-authorized — those baseline reasons are always
    // included to make the boundary explicit, but suppressed === false.
    return build('SIGNAL_SUPPRESSION_NOT_SUPPRESSED', false, [...SIG_SUPPRESSION_BASELINE], reasons);
  } catch {
    return build('SIGNAL_SUPPRESSION_UNCONFIGURED', true,
      ['diagnostic_only', ...SIG_SUPPRESSION_BASELINE], ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (F) SIGNAL SCORING / EXPLANATION
//
// Aggregates candidate signals into a DESCRIPTIVE score only. score_bucket is
// derived ONLY from how many valid candidates exist and their confidence_bucket.
// It is NEVER a trade size, slippage, stop-loss, order, or numeric trading score.
// CRITICAL: even score_bucket='high' keeps trading_ready / intent_ready /
// routing_ready / can_send / signal_ready FALSE.
// ---------------------------------------------------------------------------

const SIG_EXPLANATION_CODES = Object.freeze([
  'wallet_led_candidate_present', 'token_activity_candidate_present',
  'multiple_candidates_present', 'relationship_supported',
  'sufficient_observation_density', 'no_candidates_present'
]);

const SIGNAL_SCORE_BUCKETS = Object.freeze(['none', 'low', 'medium', 'high']);

const SIGNAL_SCORE_STATES = Object.freeze([
  'SIGNAL_SCORE_UNCONFIGURED', 'SIGNAL_SCORE_INVALID',
  'SIGNAL_SCORE_SUPPRESSED', 'SIGNAL_SCORE_DESCRIBED'
]);

export function describeCandidateSignalScoringContract() {
  return Object.freeze({
    contract: 'candidate-signal-scoring',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNAL_SCORE_STATES,
    supported_score_buckets: SIGNAL_SCORE_BUCKETS,
    supported_explanation_codes: SIG_EXPLANATION_CODES,
    supported_suppression_reasons: SIG_SUPPRESSION_REASON_CODES,
    advisory_only: true,
    score_valid: false,
    score_bucket: 'none',
    explanation_codes: Object.freeze([]),
    suppression_reasons: Object.freeze([]),
    status: 'SIGNAL_SCORE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sigSafeFlags(),
    note: 'Read-only candidate-signal SCORING / EXPLANATION. Aggregates Stage-6 candidate signal RESULTS into a DESCRIPTIVE score_bucket (none/low/medium/high) derived ONLY from how many valid candidates exist and their confidence_bucket. score_bucket is NEVER a trade size, slippage, stop-loss, order, or numeric trading score, and carries NO execution authority: even score_bucket="high" keeps signal_ready / trading_ready / intent_ready / routing_ready / can_send FALSE. No candidates -> "none"; suppressed/invalid candidates -> "low" or "none" with suppression_reasons. explanation_codes and suppression_reasons are drawn from fixed allowlists only. Smuggled forbidden flags/commands/secrets/endpoints/mainnet/REAL-LIVE are refused and never echoed.'
  });
}

export function evaluateCandidateSignalScore(input) {
  const build = (state, bucket, explanationCodes, suppressionReasons, reasons) => Object.freeze({
    score_valid: (state === 'SIGNAL_SCORE_DESCRIBED'),
    score_bucket: SIGNAL_SCORE_BUCKETS.includes(bucket) ? bucket : 'none',
    signal_score_state: state,
    explanation_codes: Object.freeze([...new Set((explanationCodes || []).filter((x) => SIG_EXPLANATION_CODES.includes(x)))]),
    suppression_reasons: Object.freeze([...new Set((suppressionReasons || []).filter((x) => SIG_SUPPRESSION_REASON_CODES.includes(x)))]),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    advisory_only: true,
    read_only: true,
    ...sigSafeFlags()
  });
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (sigUninspectable(obj, ['purpose', 'candidate_signals', 'boundary'])) {
      return build('SIGNAL_SCORE_UNCONFIGURED', 'none', [], [], ['input_inspection_error']);
    }
    if (!obj) {
      return build('SIGNAL_SCORE_UNCONFIGURED', 'none', [], [], ['no_score_input']);
    }
    // shallow screen excluding the candidate_signals array + boundary component
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'candidate_signals' && k !== 'boundary') shallow[k] = v;
    }
    const screen = sigScreen(shallow);
    const boundary = obj.boundary;
    if (boundary != null) screen.push(...sigScreenComponentResult(boundary));
    if (screen.length > 0) {
      return build('SIGNAL_SCORE_INVALID', 'none', [], [], [...new Set(screen)]);
    }
    if (obj.purpose !== 'candidate_signal_score_input') {
      return build('SIGNAL_SCORE_INVALID', 'none', [], [], ['purpose_invalid']);
    }

    const arr = obj.candidate_signals;
    if (arr != null && !Array.isArray(arr)) {
      return build('SIGNAL_SCORE_INVALID', 'none', [], [], ['candidate_signals_not_array']);
    }
    const candidates = Array.isArray(arr) ? arr : [];

    // screen each candidate; a blocked one fails the whole score closed
    let walletValid = 0, tokenValid = 0, suppressedCount = 0, invalidCount = 0;
    let anyRelationship = false, anyDense = false;
    let maxBucketRank = 0;
    const bucketRank = { none: 0, low: 1, medium: 2, high: 3 };

    for (const c of candidates) {
      const cls = sigClassifyCandidateResult(c);
      if (cls === 'blocked') {
        return build('SIGNAL_SCORE_INVALID', 'none', [], [], ['candidate_signal_blocked']);
      }
      if (cls === 'valid') {
        const kind = sigCandidateKindLabel(c);
        if (kind === 'wallet_led') walletValid++;
        else if (kind === 'token_activity') tokenValid++;
        const rc = Array.isArray(c.reason_codes) ? c.reason_codes : [];
        if (rc.includes('wallet_token_relationship_observed')) anyRelationship = true;
        if (rc.includes('sufficient_observation_density')) anyDense = true;
        const b = sigCandidateBucket(c);
        if (bucketRank[b] > maxBucketRank) maxBucketRank = bucketRank[b];
      } else if (cls === 'suppressed') {
        suppressedCount++;
      } else if (cls === 'invalid') {
        invalidCount++;
      }
    }

    const validCount = walletValid + tokenValid;
    const explanationCodes = [];
    const suppressionReasons = [];

    if (validCount === 0) {
      if (suppressedCount > 0 || invalidCount > 0) {
        // suppressed/invalid candidates present but none valid -> 'low' or 'none'
        explanationCodes.push('no_candidates_present');
        if (suppressedCount > 0) suppressionReasons.push('insufficient_observations');
        suppressionReasons.push(...SIG_SUPPRESSION_BASELINE);
        // descriptive 'low' only if there were suppressed candidates to describe; else 'none'
        const bucket = suppressedCount > 0 ? 'low' : 'none';
        return build('SIGNAL_SCORE_SUPPRESSED', bucket, explanationCodes, suppressionReasons, []);
      }
      // truly no candidates
      explanationCodes.push('no_candidates_present');
      return build('SIGNAL_SCORE_DESCRIBED', 'none', explanationCodes, [], []);
    }

    if (walletValid > 0) explanationCodes.push('wallet_led_candidate_present');
    if (tokenValid > 0) explanationCodes.push('token_activity_candidate_present');
    if (validCount > 1) explanationCodes.push('multiple_candidates_present');
    if (anyRelationship) explanationCodes.push('relationship_supported');
    if (anyDense) explanationCodes.push('sufficient_observation_density');

    // DESCRIPTIVE score_bucket: derived from how many valid candidates +
    // their confidence_bucket. NEVER a trade size / slippage / numeric score.
    let bucket = 'low';
    if (validCount >= 2 && maxBucketRank >= 3) bucket = 'high';
    else if (validCount >= 2 || maxBucketRank >= 2) bucket = 'medium';
    else bucket = 'low';

    return build('SIGNAL_SCORE_DESCRIBED', bucket, explanationCodes, suppressionReasons, []);
  } catch {
    return build('SIGNAL_SCORE_UNCONFIGURED', 'none', [], [], ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (H) SIGNAL HEALTH / STATUS
//
// Consumes boundary + candidate signals + score + suppression and derives a
// status ONLY. SIGNAL_READY_ADVISORY is ADVISORY read-only — NOT trading / risk
// / intent / routing readiness. Every execution flag (incl signal_ready) STAYS
// false in every state.
// ---------------------------------------------------------------------------

const SIGNAL_HEALTH_STATES = Object.freeze([
  'SIGNAL_UNCONFIGURED', 'SIGNAL_DEGRADED', 'SIGNAL_READY_ADVISORY',
  'SIGNAL_SUPPRESSED', 'SIGNAL_BLOCKED'
]);

export function describeSignalHealthContract() {
  return Object.freeze({
    contract: 'signal-health',
    version: '0.0.0',
    test_only: true,
    supported_states: SIGNAL_HEALTH_STATES,
    advisory_only: true,
    valid: false,
    signal_state: 'SIGNAL_UNCONFIGURED',
    signal_ready_advisory: false,
    status: 'SIGNAL_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...sigSafeFlags(),
    note: 'Read-only signal HEALTH / STATUS. Consumes the signal-input boundary + candidate signal RESULTS + score + suppression and derives a status only. States: SIGNAL_UNCONFIGURED / SIGNAL_DEGRADED / SIGNAL_READY_ADVISORY / SIGNAL_SUPPRESSED / SIGNAL_BLOCKED. A smuggled forbidden trading flag / secret / mainnet / REAL-LIVE in any component, or an invalid signal-input boundary, drives SIGNAL_BLOCKED. SIGNAL_READY_ADVISORY is ADVISORY read-only ONLY — it is NOT trading / risk / intent / routing readiness, and signal_ready plus every execution flag STAY false in every state. Smuggled values are refused and never echoed.'
  });
}

export function evaluateSignalHealth(inputs) {
  const build = (state, reasons) => Object.freeze({
    valid: (state !== 'SIGNAL_BLOCKED'),
    signal_state: state,
    signal_ready_advisory: (state === 'SIGNAL_READY_ADVISORY'),
    status: state,
    reasons: Object.freeze([...new Set(reasons || [])]),
    advisory_only: true,
    read_only: true,
    ...sigSafeFlags()
  });
  try {
    const obj = (inputs != null && typeof inputs === 'object' && !Array.isArray(inputs)) ? inputs : null;
    if (sigUninspectable(obj, ['signal_input_boundary', 'candidate_signals', 'score', 'suppression'])) {
      return build('SIGNAL_UNCONFIGURED', ['input_inspection_error']);
    }
    if (!obj) {
      return build('SIGNAL_UNCONFIGURED', ['no_health_input']);
    }

    const boundary = obj.signal_input_boundary;
    const arr = obj.candidate_signals;
    const score = obj.score;
    const suppression = obj.suppression;

    // --- BLOCKED: smuggled forbidden flag / secret / endpoint / mainnet anywhere ---
    // top-level shallow (components excluded from key-name screen)
    const COMPONENTS = ['signal_input_boundary', 'candidate_signals', 'score', 'suppression'];
    const shallow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!COMPONENTS.includes(k)) shallow[k] = v;
    }
    const blocked = sigScreen(shallow);
    for (const comp of [boundary, score, suppression]) {
      if (comp != null) blocked.push(...sigScreenComponentResult(comp));
    }
    const candidates = Array.isArray(arr) ? arr : [];
    for (const c of candidates) {
      if (c != null && typeof c === 'object' && sigScreenComponentResult(c).length > 0) {
        blocked.push('candidate_signal_blocked');
      }
    }
    // invalid signal-input boundary -> BLOCKED
    if (boundary != null && typeof boundary === 'object' &&
        boundary.signal_input_state === 'SIGNAL_INPUT_INVALID') {
      blocked.push('signal_input_boundary_invalid');
    }
    if (blocked.length > 0) {
      return build('SIGNAL_BLOCKED', [...new Set(blocked)]);
    }

    // --- UNCONFIGURED: missing required component ---
    if (boundary == null || arr == null || score == null || suppression == null) {
      return build('SIGNAL_UNCONFIGURED', ['required_component_missing']);
    }
    if (!Array.isArray(arr)) {
      return build('SIGNAL_UNCONFIGURED', ['candidate_signals_not_array']);
    }
    // boundary must be a recognized boundary result
    const boundaryState = (boundary != null && typeof boundary === 'object') ? boundary.signal_input_state : undefined;
    if (typeof boundaryState !== 'string' || !SIGNAL_INPUT_STATES.includes(boundaryState)) {
      return build('SIGNAL_UNCONFIGURED', ['signal_input_boundary_unrecognized']);
    }

    // classify candidates
    let validCandidates = 0, suppressedCandidates = 0, recognizedCandidates = 0;
    for (const c of candidates) {
      const cls = sigClassifyCandidateResult(c);
      if (cls === 'blocked') {
        return build('SIGNAL_BLOCKED', ['candidate_signal_blocked']);
      }
      if (cls === 'valid') { validCandidates++; recognizedCandidates++; }
      else if (cls === 'suppressed' || cls === 'invalid') { suppressedCandidates++; recognizedCandidates++; }
    }

    const suppressionSuppressed = (suppression != null && typeof suppression === 'object' && suppression.suppressed === true);
    const scoreBucket = (score != null && typeof score === 'object' && typeof score.score_bucket === 'string') ? score.score_bucket : 'none';

    // --- SUPPRESSED: suppression says suppressed, OR all candidates suppressed ---
    if (suppressionSuppressed ||
        (recognizedCandidates > 0 && validCandidates === 0)) {
      return build('SIGNAL_SUPPRESSED', ['signal_suppressed']);
    }

    // --- READY_ADVISORY: boundary VALID + >=1 valid candidate + score not 'none' + not suppressed ---
    if (boundaryState === 'SIGNAL_INPUT_VALID' && validCandidates >= 1 &&
        scoreBucket !== 'none' && !suppressionSuppressed) {
      return build('SIGNAL_READY_ADVISORY', ['signal_advisory_ready']);
    }

    // --- else DEGRADED ---
    const degradedReasons = [];
    if (boundaryState !== 'SIGNAL_INPUT_VALID') degradedReasons.push('signal_input_boundary_not_valid');
    if (validCandidates === 0) degradedReasons.push('no_valid_candidate');
    if (scoreBucket === 'none') degradedReasons.push('score_bucket_none');
    return build('SIGNAL_DEGRADED', degradedReasons.length ? degradedReasons : ['signal_degraded']);
  } catch {
    return build('SIGNAL_UNCONFIGURED', ['input_inspection_error']);
  }
}
