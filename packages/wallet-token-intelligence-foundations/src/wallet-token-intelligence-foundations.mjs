// @soltrade/wallet-token-intelligence-foundations
//
// Read-only wallet/token observation intelligence derived from Stage-4
// normalized ingestion events. Import-free, pure, deterministic. No network
// primitive, no live stream, no system clock, no persistence, no secrets.
//
// CRITICAL: intelligence here is OBSERVATION / SUMMARY ONLY. An observation
// NEVER becomes a signal; a token diagnostic NEVER becomes a buy recommendation;
// no result opens signal/trading/risk/intent/routing readiness. Hostile,
// throwing, or uninspectable input returns a FROZEN refusal with reason
// 'input_inspection_error' and NEVER throws.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function intelSafeFlags() {
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

const INTEL_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'can_send', 'can_broadcast', 'can_serialize', 'signing_permitted',
  'broadcast_permitted', 'is_live', 'real_live', 'mainnet_enabled',
  'live_stream_enabled', 'network_call_made', 'endpoint_resolved'
]);

const INTEL_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap',
  'copy_now', 'trade_now', 'sign', 'buy_opportunity', 'execute_opportunity',
  'submit_opportunity', 'buy_signal', 'sell_signal', 'copy_signal', 'alpha_signal'
]);

const INTEL_SECRET_KEY_RE = /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential/i;
const INTEL_URL_RE = /https?:\/\/|wss?:\/\//i;
const INTEL_MAINNET_RE = /mainnet|prod/i;

// opaque refs / known fields exempt from the secret-NAME scan
// (e.g. token_ref contains 'token')
const INTEL_SAFE_REF_FIELD_NAMES = Object.freeze([
  'purpose', 'wallet_ref', 'token_ref', 'event_ref', 'source_ref',
  'signature_ref', 'slot_ref', 'observed_at_ref', 'first_observed_ref',
  'last_observed_ref', 'first_seen_ref', 'last_seen_ref', 'event_type', 'batch_ref'
]);

const INTEL_OBSERVED_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed', 'token_account_change_observed',
  'swap_observed', 'mint_observed', 'pool_observed', 'balance_change_observed'
]);

function intelHasForbiddenTrueFlag(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const f of INTEL_FORBIDDEN_TRUE_FLAGS) {
    if (o[f] === true) return true;
  }
  return false;
}

function intelHasExecCmdKey(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const k of Object.keys(o)) {
    if (INTEL_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function intelHasSecretField(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const [k, v] of Object.entries(o)) {
    if (INTEL_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (INTEL_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function intelHasEndpointOrMainnet(o) {
  if (o == null || typeof o !== 'object') return false;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && (INTEL_URL_RE.test(v) || INTEL_MAINNET_RE.test(v))) return true;
  }
  return false;
}

function intelScreen(o) {
  const r = [];
  if (intelHasForbiddenTrueFlag(o)) r.push('forbidden_trading_indicator_blocked');
  if (intelHasExecCmdKey(o)) r.push('execution_command_blocked');
  if (intelHasSecretField(o)) r.push('secret_field_blocked');
  if (intelHasEndpointOrMainnet(o)) r.push('endpoint_or_mainnet_blocked');
  return r;
}

// a Proxy whose accessors return functions -> uninspectable -> fail closed
function intelUninspectable(o, fields) {
  if (o == null) return false;
  for (const f of fields) {
    if (typeof o[f] === 'function') return true;
  }
  return false;
}

function intelEventOk(ev) {
  return ev != null && typeof ev === 'object' && !Array.isArray(ev) &&
    typeof ev.event_type === 'string' &&
    INTEL_OBSERVED_EVENT_TYPES.includes(ev.event_type) &&
    intelScreen(ev).length === 0;
}

// ---------------------------------------------------------------------------
// (C) WALLET OBSERVATION INTELLIGENCE
// ---------------------------------------------------------------------------

const WALLET_OBS_STATES = Object.freeze([
  'WALLET_OBS_UNCONFIGURED', 'WALLET_OBS_INVALID',
  'WALLET_OBS_DEGRADED', 'WALLET_OBS_READ_ONLY_OK'
]);

export function describeWalletObservationIntelligenceContract() {
  return Object.freeze({
    contract: 'wallet-observation-intelligence',
    version: '0.0.0',
    test_only: true,
    supported_states: WALLET_OBS_STATES,
    observations_only: true,
    wallet_observation_state: 'WALLET_OBS_UNCONFIGURED',
    status: 'WALLET_OBS_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...intelSafeFlags(),
    note: 'Read-only wallet observation intelligence derived from Stage-4 normalized ingestion events. Produces a descriptive wallet summary only (counts + first/last refs). An observation is NEVER a signal; opens no signal/trading/risk/intent/routing readiness; emits no buy/sell/copy signal, recommendation, intent, route, or priority.'
  });
}

export function validateWalletObservationInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intelUninspectable(obj, ['purpose', 'wallet_ref', 'events'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...intelSafeFlags()
      });
    }
    const reasons = [];
    if (!obj) {
      reasons.push('no_wallet_input');
    } else {
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k !== 'events') shallow[k] = v;
      }
      reasons.push(...intelScreen(shallow));
      if (obj.purpose !== 'wallet_observation_input') reasons.push('purpose_invalid');
      if (typeof obj.wallet_ref !== 'string' || obj.wallet_ref.length === 0) reasons.push('wallet_ref_missing');
      if (!Array.isArray(obj.events)) reasons.push('events_not_array');
    }
    const unique = [...new Set(reasons)];
    const recognized = obj != null;
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...intelSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...intelSafeFlags()
    });
  }
}

export function evaluateWalletObservationIntelligence(input) {
  const build = (state, reasons, fields) => Object.freeze({
    valid: (state !== 'WALLET_OBS_INVALID'),
    wallet_observation_state: state,
    wallet_ref: (state === 'WALLET_OBS_READ_ONLY_OK' || state === 'WALLET_OBS_DEGRADED') ? fields.wallet_ref : undefined,
    observed_event_count: fields.observed_event_count || 0,
    observed_swap_count: fields.observed_swap_count || 0,
    observed_mint_count: fields.observed_mint_count || 0,
    observed_balance_change_count: fields.observed_balance_change_count || 0,
    first_observed_ref: fields.first_observed_ref,
    last_observed_ref: fields.last_observed_ref,
    status: state,
    reasons: Object.freeze([...reasons]),
    ...intelSafeFlags()
  });
  try {
    const v = validateWalletObservationInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('WALLET_OBS_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_wallet_input'], {});
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid') ||
        v.reasons.includes('wallet_ref_missing') ||
        v.reasons.includes('events_not_array')) {
      return build('WALLET_OBS_INVALID', v.reasons, {});
    }
    const events = input.events;
    for (const ev of events) {
      if (ev != null && typeof ev === 'object' && intelScreen(ev).length > 0) {
        return build('WALLET_OBS_INVALID', ['event_forbidden_indicator_blocked'], {});
      }
    }
    let total = 0, swap = 0, mint = 0, bal = 0, firstRef, lastRef;
    for (const ev of events) {
      if (!intelEventOk(ev)) continue;
      total++;
      if (ev.event_type === 'swap_observed') swap++;
      if (ev.event_type === 'mint_observed') mint++;
      if (ev.event_type === 'balance_change_observed') bal++;
      const r = (typeof ev.event_ref === 'string') ? ev.event_ref : undefined;
      if (r !== undefined) {
        if (firstRef === undefined) firstRef = r;
        lastRef = r;
      }
    }
    const fields = {
      wallet_ref: input.wallet_ref,
      observed_event_count: total,
      observed_swap_count: swap,
      observed_mint_count: mint,
      observed_balance_change_count: bal,
      first_observed_ref: firstRef,
      last_observed_ref: lastRef
    };
    if (total === 0) return build('WALLET_OBS_DEGRADED', ['no_observed_events'], fields);
    return build('WALLET_OBS_READ_ONLY_OK', [], fields);
  } catch {
    return build('WALLET_OBS_UNCONFIGURED', ['input_inspection_error'], {});
  }
}

// ---------------------------------------------------------------------------
// (D) TOKEN OBSERVATION INTELLIGENCE
// ---------------------------------------------------------------------------

const TOKEN_OBS_STATES = Object.freeze([
  'TOKEN_OBS_UNCONFIGURED', 'TOKEN_OBS_INVALID',
  'TOKEN_OBS_DEGRADED', 'TOKEN_OBS_READ_ONLY_OK'
]);

export function describeTokenObservationIntelligenceContract() {
  return Object.freeze({
    contract: 'token-observation-intelligence',
    version: '0.0.0',
    test_only: true,
    supported_states: TOKEN_OBS_STATES,
    observations_only: true,
    token_observation_state: 'TOKEN_OBS_UNCONFIGURED',
    status: 'TOKEN_OBS_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...intelSafeFlags(),
    note: 'Read-only token observation intelligence derived from Stage-4 normalized ingestion events. Descriptive token summary only. NEVER a buy recommendation / opportunity acceptance / execution or route intent; no P&L, no price/stop-loss guarantee; accepted observation does NOT become a buy order; buy_opportunity/execute_opportunity/submit_opportunity refused.'
  });
}

export function validateTokenObservationInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intelUninspectable(obj, ['purpose', 'token_ref', 'events'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...intelSafeFlags()
      });
    }
    const reasons = [];
    if (!obj) {
      reasons.push('no_token_input');
    } else {
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k !== 'events') shallow[k] = v;
      }
      reasons.push(...intelScreen(shallow));
      if (obj.purpose !== 'token_observation_input') reasons.push('purpose_invalid');
      if (typeof obj.token_ref !== 'string' || obj.token_ref.length === 0) reasons.push('token_ref_missing');
      if (!Array.isArray(obj.events)) reasons.push('events_not_array');
    }
    const unique = [...new Set(reasons)];
    const recognized = obj != null;
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...intelSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...intelSafeFlags()
    });
  }
}

export function evaluateTokenObservationIntelligence(input) {
  const build = (state, reasons, fields) => Object.freeze({
    valid: (state !== 'TOKEN_OBS_INVALID'),
    token_observation_state: state,
    token_ref: (state === 'TOKEN_OBS_READ_ONLY_OK' || state === 'TOKEN_OBS_DEGRADED') ? fields.token_ref : undefined,
    observed_event_count: fields.observed_event_count || 0,
    observed_mint_count: fields.observed_mint_count || 0,
    observed_pool_count: fields.observed_pool_count || 0,
    observed_swap_count: fields.observed_swap_count || 0,
    observed_wallet_count: fields.observed_wallet_count || 0,
    first_observed_ref: fields.first_observed_ref,
    last_observed_ref: fields.last_observed_ref,
    status: state,
    reasons: Object.freeze([...reasons]),
    ...intelSafeFlags()
  });
  try {
    const v = validateTokenObservationInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('TOKEN_OBS_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_token_input'], {});
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid') ||
        v.reasons.includes('token_ref_missing') ||
        v.reasons.includes('events_not_array')) {
      return build('TOKEN_OBS_INVALID', v.reasons, {});
    }
    const events = input.events;
    for (const ev of events) {
      if (ev != null && typeof ev === 'object' && intelScreen(ev).length > 0) {
        return build('TOKEN_OBS_INVALID', ['event_forbidden_indicator_blocked'], {});
      }
    }
    let total = 0, mint = 0, pool = 0, swap = 0, firstRef, lastRef;
    const wallets = new Set();
    for (const ev of events) {
      if (!intelEventOk(ev)) continue;
      total++;
      if (ev.event_type === 'mint_observed') mint++;
      if (ev.event_type === 'pool_observed') pool++;
      if (ev.event_type === 'swap_observed') swap++;
      if (typeof ev.wallet_ref === 'string') wallets.add(ev.wallet_ref);
      const r = (typeof ev.event_ref === 'string') ? ev.event_ref : undefined;
      if (r !== undefined) {
        if (firstRef === undefined) firstRef = r;
        lastRef = r;
      }
    }
    const fields = {
      token_ref: input.token_ref,
      observed_event_count: total,
      observed_mint_count: mint,
      observed_pool_count: pool,
      observed_swap_count: swap,
      observed_wallet_count: wallets.size,
      first_observed_ref: firstRef,
      last_observed_ref: lastRef
    };
    if (total === 0) return build('TOKEN_OBS_DEGRADED', ['no_observed_events'], fields);
    return build('TOKEN_OBS_READ_ONLY_OK', [], fields);
  } catch {
    return build('TOKEN_OBS_UNCONFIGURED', ['input_inspection_error'], {});
  }
}

// ---------------------------------------------------------------------------
// (E) WALLET-TOKEN RELATIONSHIP
// ---------------------------------------------------------------------------

const REL_STATES = Object.freeze([
  'RELATIONSHIP_UNCONFIGURED', 'RELATIONSHIP_INVALID',
  'RELATIONSHIP_DEGRADED', 'RELATIONSHIP_READ_ONLY_OK'
]);

export function describeWalletTokenRelationshipContract() {
  return Object.freeze({
    contract: 'wallet-token-relationship',
    version: '0.0.0',
    test_only: true,
    supported_states: REL_STATES,
    observations_only: true,
    relationship_state: 'RELATIONSHIP_UNCONFIGURED',
    status: 'RELATIONSHIP_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...intelSafeFlags(),
    note: 'Read-only wallet-token relationship summary derived from observed events only. NEVER a copy recommendation / leader signal / early-buyer signal / risk approval / intent / execution priority / position open-close command.'
  });
}

export function validateWalletTokenRelationshipInput(input) {
  try {
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;
    if (intelUninspectable(obj, ['purpose', 'wallet_ref', 'token_ref', 'events'])) {
      return Object.freeze({
        valid: false, recognized: false,
        reasons: Object.freeze(['input_inspection_error']),
        ...intelSafeFlags()
      });
    }
    const reasons = [];
    if (!obj) {
      reasons.push('no_relationship_input');
    } else {
      const shallow = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k !== 'events') shallow[k] = v;
      }
      reasons.push(...intelScreen(shallow));
      if (obj.purpose !== 'wallet_token_relationship_input') reasons.push('purpose_invalid');
      if (typeof obj.wallet_ref !== 'string' || obj.wallet_ref.length === 0) reasons.push('wallet_ref_missing');
      if (typeof obj.token_ref !== 'string' || obj.token_ref.length === 0) reasons.push('token_ref_missing');
      if (!Array.isArray(obj.events)) reasons.push('events_not_array');
    }
    const unique = [...new Set(reasons)];
    const recognized = obj != null;
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid, recognized,
      reasons: Object.freeze([...unique]),
      ...intelSafeFlags()
    });
  } catch {
    return Object.freeze({
      valid: false, recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...intelSafeFlags()
    });
  }
}

export function evaluateWalletTokenRelationship(input) {
  const build = (state, reasons, fields) => Object.freeze({
    valid: (state !== 'RELATIONSHIP_INVALID'),
    relationship_state: state,
    wallet_ref: (state === 'RELATIONSHIP_READ_ONLY_OK' || state === 'RELATIONSHIP_DEGRADED') ? fields.wallet_ref : undefined,
    token_ref: (state === 'RELATIONSHIP_READ_ONLY_OK' || state === 'RELATIONSHIP_DEGRADED') ? fields.token_ref : undefined,
    relationship_event_count: fields.relationship_event_count || 0,
    observed_interaction_types: Object.freeze(fields.observed_interaction_types ? [...fields.observed_interaction_types] : []),
    first_seen_ref: fields.first_seen_ref,
    last_seen_ref: fields.last_seen_ref,
    status: state,
    reasons: Object.freeze([...reasons]),
    ...intelSafeFlags()
  });
  try {
    const v = validateWalletTokenRelationshipInput(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error')) {
      return build('RELATIONSHIP_UNCONFIGURED', v.reasons.length ? v.reasons : ['no_relationship_input'], {});
    }
    if (v.reasons.includes('forbidden_trading_indicator_blocked') ||
        v.reasons.includes('execution_command_blocked') ||
        v.reasons.includes('secret_field_blocked') ||
        v.reasons.includes('endpoint_or_mainnet_blocked') ||
        v.reasons.includes('purpose_invalid') ||
        v.reasons.includes('wallet_ref_missing') ||
        v.reasons.includes('token_ref_missing') ||
        v.reasons.includes('events_not_array')) {
      return build('RELATIONSHIP_INVALID', v.reasons, {});
    }
    const events = input.events;
    for (const ev of events) {
      if (ev != null && typeof ev === 'object' && intelScreen(ev).length > 0) {
        return build('RELATIONSHIP_INVALID', ['event_forbidden_indicator_blocked'], {});
      }
    }
    let total = 0, firstRef, lastRef;
    const types = new Set();
    for (const ev of events) {
      if (!intelEventOk(ev)) continue;
      total++;
      types.add(ev.event_type);
      const r = (typeof ev.event_ref === 'string') ? ev.event_ref : undefined;
      if (r !== undefined) {
        if (firstRef === undefined) firstRef = r;
        lastRef = r;
      }
    }
    const fields = {
      wallet_ref: input.wallet_ref,
      token_ref: input.token_ref,
      relationship_event_count: total,
      observed_interaction_types: [...types].sort(),
      first_seen_ref: firstRef,
      last_seen_ref: lastRef
    };
    if (total === 0) return build('RELATIONSHIP_DEGRADED', ['no_observed_events'], fields);
    return build('RELATIONSHIP_READ_ONLY_OK', [], fields);
  } catch {
    return build('RELATIONSHIP_UNCONFIGURED', ['input_inspection_error'], {});
  }
}
