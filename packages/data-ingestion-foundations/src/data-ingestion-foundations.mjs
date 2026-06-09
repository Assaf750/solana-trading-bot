// @soltrade/data-ingestion-foundations
//
// Stage-4 Data Ingestion Foundation core (read-only / replay-mock).
//
// STRICT: import-free, function-I/O-only, pure, deterministic. NO network
// primitive, NO live stream, NO system clock, NO file/DB/Redis/persistence,
// NO send/broadcast/serialize/signing, NO new dependency. Results are
// Object.freeze of fixed literals + whitelisted opaque refs + counts + fixed
// reason tokens. Hostile/throwing input returns a FROZEN refusal with reason
// 'input_inspection_error' and NEVER throws. Ingestion events are OBSERVATIONS
// ONLY — never signals, never trade intents; results open NO trading/signal/
// risk/routing readiness.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function ingSafeFlags() {
  return {
    read_only: true,
    live_stream_enabled: false,
    network_call_made: false,
    endpoint_resolved: false,
    has_secret: false,
    trading_ready: false,
    signal_ready: false,
    risk_ready: false,
    routing_ready: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    signing_permitted: false,
    broadcast_permitted: false,
    is_live: false,
    mainnet_enabled: false,
    real_live: false,
  };
}

const ING_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'trading_ready',
  'signal_ready',
  'risk_ready',
  'routing_ready',
  'can_send',
  'can_broadcast',
  'can_serialize',
  'signing_permitted',
  'broadcast_permitted',
  'is_live',
  'real_live',
  'mainnet_enabled',
  'live_stream_enabled',
  'network_call_made',
  'endpoint_resolved',
]);

const ING_SECRET_KEY_RE =
  /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential/i;
const ING_URL_RE = /https?:\/\/|wss?:\/\//i; // endpoint URL scheme
const ING_MAINNET_RE = /mainnet|prod/i;
const ING_EXEC_CMD_KEYS = Object.freeze([
  'buy',
  'sell',
  'execute',
  'submit',
  'send',
  'broadcast',
  'swap',
  'copy_now',
  'trade_now',
  'sign',
]);

function ingHasForbiddenTrueFlag(obj) {
  if (obj == null || typeof obj !== 'object') return false;
  for (const f of ING_FORBIDDEN_TRUE_FLAGS) {
    if (obj[f] === true) return true;
  }
  return false;
}

function ingHasExecCommandKey(obj) {
  if (obj == null || typeof obj !== 'object') return false;
  for (const k of Object.keys(obj)) {
    const lk = String(k).toLowerCase();
    if (ING_EXEC_CMD_KEYS.includes(lk)) return true;
  }
  return false;
}

// Known SAFE opaque-reference / known field names that legitimately exist in
// ingestion inputs and must NOT be mistaken for secret material even though
// their NAME may contain a secret-pattern substring (e.g. `token_ref` contains
// "token"). These are opaque observation references, not secrets. Real secret
// fields (api_key/secret/private_key/auth_token/token/...) are NOT in this set
// and remain flagged. Value-level URL/mainnet screening still applies to every
// field (incl. these) via ingHasEndpointOrMainnet.
const ING_SAFE_REF_FIELD_NAMES = Object.freeze([
  'event_ref', 'source_ref', 'observed_at_ref', 'event_type',
  'wallet_ref', 'token_ref', 'signature_ref', 'slot_ref',
  'batch_ref', 'descriptor_ref', 'purpose'
]);

// secret MATERIAL = a secret-NAMED key (NOT one of the known safe opaque-ref
// field names) carrying a STRING value. Boolean attestations such as
// has_secret:false are safe; legitimate opaque refs such as token_ref are
// exempt by name (their values are still URL/mainnet-screened elsewhere).
function ingHasSecretField(obj) {
  if (obj == null || typeof obj !== 'object') return false;
  for (const [k, v] of Object.entries(obj)) {
    if (ING_SAFE_REF_FIELD_NAMES.includes(k)) continue;
    if (ING_SECRET_KEY_RE.test(String(k)) && typeof v === 'string') return true;
  }
  return false;
}

function ingHasEndpointOrMainnet(obj) {
  if (obj == null || typeof obj !== 'object') return false;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && (ING_URL_RE.test(v) || ING_MAINNET_RE.test(v)))
      return true;
    const lk = String(k).toLowerCase();
    if (
      lk === 'endpoint' ||
      lk === 'endpoint_url' ||
      lk === 'provider_url' ||
      lk === 'rpc_endpoint' ||
      lk === 'url'
    ) {
      if (typeof v === 'string' && v.length > 0) return true;
    }
  }
  return false;
}

// Shared fail-closed screen; returns fixed reason tokens, never echoes values.
function ingScreenInput(obj) {
  const reasons = [];
  if (ingHasForbiddenTrueFlag(obj)) reasons.push('forbidden_trading_indicator_blocked');
  if (ingHasExecCommandKey(obj)) reasons.push('execution_command_blocked');
  if (ingHasSecretField(obj)) reasons.push('secret_field_blocked');
  if (ingHasEndpointOrMainnet(obj)) reasons.push('endpoint_or_mainnet_blocked');
  return reasons;
}

// ---------------------------------------------------------------------------
// (C) SOURCE DESCRIPTOR
// ---------------------------------------------------------------------------

const ING_SOURCE_TAGS = Object.freeze([
  'mock_replay',
  'fixture_replay',
  'helius_laserstream_disabled',
  'triton_yellowstone_disabled',
  'rpc_read_only_reference',
]);
const ING_SOURCE_STATES = Object.freeze([
  'INGESTION_SOURCE_UNCONFIGURED',
  'INGESTION_SOURCE_INVALID',
  'INGESTION_SOURCE_READ_ONLY_OK',
]);

export function describeIngestionSourceDescriptorContract() {
  return Object.freeze({
    contract: 'ingestion-source-descriptor',
    version: '0.0.0',
    test_only: true,
    supported_source_tags: ING_SOURCE_TAGS,
    supported_states: ING_SOURCE_STATES,
    source_state: 'INGESTION_SOURCE_UNCONFIGURED',
    source_descriptor_valid: false,
    status: 'INGESTION_SOURCE_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...ingSafeFlags(),
    note:
      'Read-only ingestion source descriptor (metadata only). A source is a TAG (mock_replay/fixture_replay/helius_laserstream_disabled/triton_yellowstone_disabled/rpc_read_only_reference) — never a live endpoint. helius/triton tags are accepted ONLY as disabled/read-only (live_stream_enabled:false). No endpoint/secret; no network; opens no trading readiness.',
  });
}

export function validateIngestionSourceDescriptor(input) {
  try {
    const obj =
      input != null && typeof input === 'object' && !Array.isArray(input) ? input : null;
    const reasons = [];
    if (!obj) {
      reasons.push('no_source_descriptor');
    } else {
      reasons.push(...ingScreenInput(obj));
      const sr = obj.source_ref;
      if (typeof sr !== 'string' || sr.length === 0) reasons.push('source_ref_missing');
      else if (!ING_SOURCE_TAGS.includes(sr)) reasons.push('unknown_source_tag');
    }
    const unique = [...new Set(reasons)];
    const recognized = obj != null;
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid,
      recognized,
      reasons: Object.freeze([...unique]),
      ...ingSafeFlags(),
    });
  } catch {
    return Object.freeze({
      valid: false,
      recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...ingSafeFlags(),
    });
  }
}

export function evaluateIngestionSourceBoundary(input) {
  const build = (state, reasons, sourceRef) =>
    Object.freeze({
      valid: state !== 'INGESTION_SOURCE_INVALID',
      source_state: state,
      source_descriptor_valid: state === 'INGESTION_SOURCE_READ_ONLY_OK',
      source_ref: state === 'INGESTION_SOURCE_READ_ONLY_OK' ? sourceRef : undefined,
      status: state,
      reasons: Object.freeze([...reasons]),
      ...ingSafeFlags(),
    });
  try {
    const v = validateIngestionSourceDescriptor(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error'))
      return build(
        'INGESTION_SOURCE_UNCONFIGURED',
        v.reasons.length ? v.reasons : ['no_source_descriptor'],
      );
    if (v.reasons.includes('source_ref_missing'))
      return build('INGESTION_SOURCE_UNCONFIGURED', v.reasons);
    if (v.reasons.length > 0) return build('INGESTION_SOURCE_INVALID', v.reasons);
    // source_ref echoed ONLY when valid and is one of the known fixed tags.
    return build('INGESTION_SOURCE_READ_ONLY_OK', [], input.source_ref);
  } catch {
    return build('INGESTION_SOURCE_UNCONFIGURED', ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (E) NORMALIZED EVENT ENVELOPE
// ---------------------------------------------------------------------------

const ING_EVENT_TYPES = Object.freeze([
  'wallet_transaction_observed',
  'token_account_change_observed',
  'swap_observed',
  'mint_observed',
  'pool_observed',
  'balance_change_observed',
]);
// Whitelist of fields copied into the normalized envelope.
const ING_EVENT_SAFE_REF_FIELDS = Object.freeze([
  'event_ref',
  'source_ref',
  'observed_at_ref',
  'event_type',
  'wallet_ref',
  'token_ref',
  'signature_ref',
  'slot_ref',
]);

export function describeNormalizedIngestionEventContract() {
  return Object.freeze({
    contract: 'normalized-ingestion-event',
    version: '0.0.0',
    test_only: true,
    supported_event_types: ING_EVENT_TYPES,
    safe_ref_fields: ING_EVENT_SAFE_REF_FIELDS,
    observations_only: true,
    normalized_event_valid: false,
    ...ingSafeFlags(),
    note:
      'Read-only normalized ingestion event envelope. Events are OBSERVATIONS ONLY (wallet_transaction_observed / token_account_change_observed / swap_observed / mint_observed / pool_observed / balance_change_observed) — never signals, never trade intents. The envelope copies ONLY whitelisted opaque refs (event_ref/source_ref/observed_at_ref/event_type/wallet_ref/token_ref/signature_ref/slot_ref); no secret/endpoint/private-key/execution-command is ever copied. An accepted/interesting event is NOT an execution intent.',
  });
}

export function validateNormalizedIngestionEvent(rawEvent) {
  try {
    const obj =
      rawEvent != null && typeof rawEvent === 'object' && !Array.isArray(rawEvent)
        ? rawEvent
        : null;
    const reasons = [];
    if (!obj) {
      reasons.push('no_event');
    } else {
      reasons.push(...ingScreenInput(obj));
      const et = obj.event_type;
      if (typeof et !== 'string' || et.length === 0) reasons.push('event_type_missing');
      else if (!ING_EVENT_TYPES.includes(et)) reasons.push('unknown_event_type');
      if (typeof obj.event_ref !== 'string' || obj.event_ref.length === 0)
        reasons.push('event_ref_missing');
    }
    const unique = [...new Set(reasons)];
    const recognized = obj != null;
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid,
      recognized,
      reasons: Object.freeze([...unique]),
      ...ingSafeFlags(),
    });
  } catch {
    return Object.freeze({
      valid: false,
      recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...ingSafeFlags(),
    });
  }
}

export function normalizeIngestionEvent(rawEvent) {
  try {
    const v = validateNormalizedIngestionEvent(rawEvent);
    if (!v.valid) {
      return Object.freeze({
        normalized: false,
        normalized_event: null,
        event_type: undefined,
        reasons: v.reasons,
        ...ingSafeFlags(),
      });
    }
    const e = rawEvent;
    const env = {};
    for (const f of ING_EVENT_SAFE_REF_FIELDS) {
      if (e[f] !== undefined) {
        // Copy ONLY safe types: string refs or a numeric slot_ref.
        const val = e[f];
        if (typeof val === 'string' || typeof val === 'number') env[f] = val;
      }
    }
    env.read_only = true;
    return Object.freeze({
      normalized: true,
      normalized_event: Object.freeze(env),
      event_type: String(e.event_type),
      reasons: Object.freeze([]),
      ...ingSafeFlags(),
    });
  } catch {
    return Object.freeze({
      normalized: false,
      normalized_event: null,
      event_type: undefined,
      reasons: Object.freeze(['input_inspection_error']),
      ...ingSafeFlags(),
    });
  }
}

// ---------------------------------------------------------------------------
// (D) REPLAY / MOCK HARNESS
// ---------------------------------------------------------------------------

const ING_BATCH_STATES = Object.freeze([
  'REPLAY_BATCH_UNCONFIGURED',
  'REPLAY_BATCH_INVALID',
  'REPLAY_BATCH_DEGRADED',
  'REPLAY_BATCH_READ_ONLY_OK',
]);
const ING_BATCH_REQUIRED_TRUE = Object.freeze([
  'read_only',
  'no_network',
  'no_live_stream',
  'no_send',
  'no_broadcast',
  'no_sign',
  'no_mainnet',
  'no_real_live',
]);

export function describeReplayIngestionHarnessContract() {
  return Object.freeze({
    contract: 'replay-ingestion-harness',
    version: '0.0.0',
    test_only: true,
    supported_states: ING_BATCH_STATES,
    required_attestations: ING_BATCH_REQUIRED_TRUE,
    batch_state: 'REPLAY_BATCH_UNCONFIGURED',
    batch_read_only_ok: false,
    normalized_count: 0,
    invalid_count: 0,
    quarantined_count: 0,
    duplicate_count: 0,
    status: 'REPLAY_BATCH_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...ingSafeFlags(),
    note:
      'Read-only replay/mock ingestion harness. Reads ONLY fixture event objects passed as a function argument — NO file/env/network/WebSocket/live-stream/persistence. Normalizes each event via the normalized-event envelope and returns counts only. A valid batch is read-only only and opens NO trading/signal/risk/routing readiness.',
  });
}

export function validateReplayIngestionBatch(input) {
  try {
    const obj =
      input != null && typeof input === 'object' && !Array.isArray(input) ? input : null;
    const reasons = [];
    if (!obj) {
      reasons.push('no_batch');
    } else {
      // Screen the batch envelope itself (NOT its events array yet) for
      // forbidden flags / exec / secret / endpoint.
      const shallow = {};
      for (const [k, vv] of Object.entries(obj)) {
        if (k !== 'events') shallow[k] = vv;
      }
      reasons.push(...ingScreenInput(shallow));
      if (obj.purpose !== 'replay_ingestion_batch') reasons.push('purpose_invalid');
      const sr = obj.source_ref;
      if (typeof sr !== 'string' || !['mock_replay', 'fixture_replay'].includes(sr))
        reasons.push('source_ref_invalid');
      for (const a of ING_BATCH_REQUIRED_TRUE) {
        if (obj[a] !== true) reasons.push(a + '_required');
      }
      if (!Array.isArray(obj.events)) reasons.push('events_not_array');
    }
    const unique = [...new Set(reasons)];
    const recognized = obj != null;
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid,
      recognized,
      reasons: Object.freeze([...unique]),
      ...ingSafeFlags(),
    });
  } catch {
    return Object.freeze({
      valid: false,
      recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...ingSafeFlags(),
    });
  }
}

export function evaluateReplayIngestionBatch(input) {
  const build = (state, reasons, counts) =>
    Object.freeze({
      valid: state !== 'REPLAY_BATCH_INVALID',
      batch_state: state,
      batch_read_only_ok: state === 'REPLAY_BATCH_READ_ONLY_OK',
      normalized_count: counts.normalized || 0,
      invalid_count: counts.invalid || 0,
      quarantined_count: counts.quarantined || 0,
      duplicate_count: counts.duplicate || 0,
      status: state,
      reasons: Object.freeze([...reasons]),
      ...ingSafeFlags(),
    });
  try {
    const v = validateReplayIngestionBatch(input);
    if (!v.recognized || v.reasons.includes('input_inspection_error'))
      return build(
        'REPLAY_BATCH_UNCONFIGURED',
        v.reasons.length ? v.reasons : ['no_batch'],
        {},
      );
    if (
      v.reasons.includes('forbidden_trading_indicator_blocked') ||
      v.reasons.includes('execution_command_blocked') ||
      v.reasons.includes('secret_field_blocked') ||
      v.reasons.includes('endpoint_or_mainnet_blocked') ||
      v.reasons.includes('purpose_invalid') ||
      v.reasons.includes('source_ref_invalid') ||
      v.reasons.includes('events_not_array') ||
      ING_BATCH_REQUIRED_TRUE.some((a) => v.reasons.includes(a + '_required'))
    )
      return build('REPLAY_BATCH_INVALID', v.reasons, {});
    // Now iterate events.
    const events = input.events;
    const seen = new Set();
    let normalized = 0;
    let invalid = 0;
    let quarantined = 0;
    let duplicate = 0;
    for (const ev of events) {
      const nr = normalizeIngestionEvent(ev);
      if (!nr.normalized) {
        if (nr.reasons.includes('unknown_event_type')) quarantined++;
        else invalid++;
        continue;
      }
      const ref = ev && typeof ev === 'object' ? ev.event_ref : undefined;
      if (typeof ref === 'string' && seen.has(ref)) {
        duplicate++;
        continue;
      }
      if (typeof ref === 'string') seen.add(ref);
      normalized++;
    }
    const counts = { normalized, invalid, quarantined, duplicate };
    if (events.length === 0) return build('REPLAY_BATCH_DEGRADED', ['empty_batch'], counts);
    if (invalid > 0 || quarantined > 0)
      return build('REPLAY_BATCH_DEGRADED', ['partial_invalid_or_quarantined'], counts);
    return build('REPLAY_BATCH_READ_ONLY_OK', [], counts);
  } catch {
    return build('REPLAY_BATCH_UNCONFIGURED', ['input_inspection_error'], {});
  }
}
