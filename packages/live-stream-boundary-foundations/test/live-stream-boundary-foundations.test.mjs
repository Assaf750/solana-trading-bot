// Stage-17 test suite for @soltrade/live-stream-boundary-foundations
// node:test + node:assert/strict. Deterministic. Uses FIXTURE/REPLAY streams via
// data-ingestion-foundations (normalizeIngestionEvent) to build realistic slot
// sequences for the stream-health read-model — NO live connection anywhere.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeLiveSourceBoundaryContract,
  evaluateLiveSourceBoundary,
  describeLiveActivationSeamContract,
  evaluateLiveActivationSeam,
  describeStreamHealthReadModelContract,
  evaluateStreamHealthReadModel,
  describeLiveReadinessChecklistContract,
  evaluateLiveReadinessChecklist,
  describeLiveSuppressionContract,
  evaluateLiveSuppression,
  describeLiveForbiddenSurfaceContract,
  evaluateLiveForbiddenSurface,
  describeLiveBoundaryHealthContract,
  evaluateLiveBoundaryHealth
} from '../src/index.mjs';

import { normalizeIngestionEvent } from '../../data-ingestion-foundations/src/index.mjs';
import { evaluateRpcReadiness } from '../../rpc-provider-contract/src/index.mjs';

// ---------------------------------------------------------------------------
// shared fixtures / helpers
// ---------------------------------------------------------------------------

const FORBIDDEN_TRUE_FLAGS = [
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
];

function assertLiveSafe(r) {
  assert.equal(Object.isFrozen(r), true, 'result must be frozen');
  assert.equal(r.read_only, true, 'read_only must be true');
  for (const f of FORBIDDEN_TRUE_FLAGS) {
    assert.equal(r[f], false, `${f} must be false on every state`);
  }
}

function hostiles() {
  const throwingProxy = new Proxy({}, {
    get() { throw new Error('hostile-get'); },
    ownKeys() { throw new Error('hostile-keys'); },
    getOwnPropertyDescriptor() { throw new Error('hostile-desc'); }
  });
  const throwingGetter = Object.defineProperty({}, 'purpose', {
    enumerable: true,
    get() { throw new Error('hostile-getter'); }
  });
  return [
    null, undefined, 42, 'a-string', [], true,
    throwingProxy, throwingGetter,
    { purpose: () => {} },
    { live_source: () => {} }
  ];
}

// counting getter: serves firstValue on the FIRST read, laterValue afterwards.
// TOCTOU snapshot-once means evaluators must consume firstValue consistently
// and read the property exactly once.
function withCountedField(base, field, firstValue, laterValue) {
  let reads = 0;
  const obj = { ...base };
  Object.defineProperty(obj, field, {
    enumerable: true,
    configurable: true,
    get() { reads += 1; return reads === 1 ? firstValue : laterValue; }
  });
  return { obj, reads: () => reads };
}

// realistic slot sequence from a FIXTURE/REPLAY stream (Stage-4 envelope):
// normalize a batch of fixture swap observations and derive seen/confirmed slots.
function fixtureSlotSequence(slots) {
  const events = slots.map((slot, i) => normalizeIngestionEvent({
    event_type: 'swap_observed',
    event_ref: 'fixture-evt-' + i,
    source_ref: 'fixture_replay',
    observed_at_ref: 'fixture-ts-' + i,
    wallet_ref: 'wallet-ref-1',
    token_ref: 'token-ref-1',
    signature_ref: 'sig-ref-' + i,
    slot_ref: slot
  }));
  for (const e of events) {
    assert.equal(e.normalized, true, 'fixture event must normalize');
    assert.equal(e.live_stream_enabled, false);
    assert.equal(e.network_call_made, false);
  }
  const seen = events.map((e) => e.normalized_event.slot_ref);
  return { events, maxSlot: Math.max(...seen), minSlot: Math.min(...seen) };
}

function streamInput(lastSeen, lastConfirmed, window, extra) {
  const o = {
    last_seen_slot: lastSeen,
    last_confirmed_slot: lastConfirmed,
    slot_lag: null,
    provider_degraded: null,
    ...(window === undefined ? {} : { max_backfill_window_slots: window }),
    ...(extra || {})
  };
  return o;
}

function cleanSourceInput() {
  return {
    purpose: 'live_source_boundary',
    live_source: 'fixture_stream',
    provider_key_ref: 'helius_key_ref_01'
  };
}

const cleanSource = evaluateLiveSourceBoundary(cleanSourceInput());
const cleanChecklistAllTrue = evaluateLiveReadinessChecklist({
  priority_fee_cache_warm: true,
  protocol_constants_green: true,
  rpc_health_green: true,
  stream_synced: true,
  calibration_priors_loaded: true,
  cost_pipeline_ready: true
});
const cleanSeam = evaluateLiveActivationSeam({
  purpose: 'live_activation_seam',
  live_source_boundary: cleanSource,
  provider_key_ref_present: true,
  owner_approval_ref: 'owner_approval_ref_01',
  readiness_checklist: cleanChecklistAllTrue
});
const syncedStream = evaluateStreamHealthReadModel(streamInput(100, 100, 5));
const cleanSurface = evaluateLiveForbiddenSurface({ purpose: 'live_surface_scan', provider_key_ref: 'ref_only' });
const cleanSuppression = evaluateLiveSuppression({
  live_source_boundary: cleanSource,
  stream_health: syncedStream,
  live_activation_seam: cleanSeam,
  live_surface: cleanSurface
});

// ===========================================================================
// (A) LIVE-SOURCE DESCRIPTOR BOUNDARY
// ===========================================================================

test('(A) contract: frozen, disabled-tag vocabulary, all exec/readiness flags false', () => {
  const c = describeLiveSourceBoundaryContract();
  assertLiveSafe(c);
  assert.equal(c.contract, 'live-source-boundary');
  assert.deepEqual([...c.supported_states],
    ['LIVE_SOURCE_UNCONFIGURED', 'LIVE_SOURCE_INVALID', 'LIVE_SOURCE_READ_ONLY_OK']);
  assert.deepEqual([...c.supported_sources], [
    'live_helius_laserstream_disabled', 'live_triton_yellowstone_disabled',
    'generic_grpc_stream_disabled', 'fixture_stream', 'mock_stream'
  ]);
  assert.equal(c.stream_connected, false);
  assert.equal(c.connection_performed, false);
});

test('(A) every allowed disabled/read-only tag -> READ_ONLY_OK with connection asserted absent', () => {
  for (const tag of describeLiveSourceBoundaryContract().supported_sources) {
    const r = evaluateLiveSourceBoundary({ purpose: 'live_source_boundary', live_source: tag });
    assertLiveSafe(r);
    assert.equal(r.live_source_state, 'LIVE_SOURCE_READ_ONLY_OK');
    assert.equal(r.live_source_boundary_valid, true);
    assert.equal(r.live_source, tag);
    assert.equal(r.stream_connected, false);
    assert.equal(r.connection_performed, false);
    assert.equal(r.live_stream_enabled, false);
    assert.equal(r.endpoint_resolved, false);
    assert.equal(r.network_call_made, false);
    assert.equal(r.activation_performed, false);
  }
});

test('(A) missing input / missing live_source -> UNCONFIGURED', () => {
  assert.equal(evaluateLiveSourceBoundary(undefined).live_source_state, 'LIVE_SOURCE_UNCONFIGURED');
  const r = evaluateLiveSourceBoundary({ purpose: 'live_source_boundary' });
  assert.equal(r.live_source_state, 'LIVE_SOURCE_UNCONFIGURED');
  assert.equal(r.reasons.includes('live_source_missing'), true);
});

test('(A) ANY enabled / live-active / unknown tag -> INVALID', () => {
  for (const tag of [
    'live_helius_laserstream', 'live_helius_laserstream_enabled',
    'helius_laserstream_active', 'grpc_stream_connected', 'live_stream',
    'totally_unknown_source'
  ]) {
    const r = evaluateLiveSourceBoundary({ purpose: 'live_source_boundary', live_source: tag });
    assertLiveSafe(r);
    assert.equal(r.live_source_state, 'LIVE_SOURCE_INVALID');
    assert.equal(r.live_source_boundary_valid, false);
    assert.equal(r.live_source, null);
  }
});

test('(A) URL / endpoint values -> INVALID and the value is NEVER echoed', () => {
  for (const planted of [
    'wss://laserstream.example.com', 'https://api.example.com/v1',
    'grpc://yellowstone.example.org:443', 'http://mainnet.example.net'
  ]) {
    const r = evaluateLiveSourceBoundary({
      purpose: 'live_source_boundary', live_source: 'fixture_stream', extra_ref: planted
    });
    assert.equal(r.live_source_state, 'LIVE_SOURCE_INVALID');
    assert.equal(JSON.stringify(r).includes(planted), false, 'planted URL must never be echoed');
  }
});

test('(A) credential field NAMES (api_key / bearer / token / etc.) -> INVALID, value never echoed', () => {
  const secretValue = 'sk-live-abcdef-0123456789';
  for (const name of ['api_key', 'apiKey', 'bearer_token', 'access_token', 'auth_token', 'provider_key', 'provider_secret', 'private_key', 'seed']) {
    const r = evaluateLiveSourceBoundary({
      purpose: 'live_source_boundary', live_source: 'fixture_stream', [name]: secretValue
    });
    assertLiveSafe(r);
    assert.equal(r.live_source_state, 'LIVE_SOURCE_INVALID');
    assert.equal(r.reasons.includes('credential_field_blocked'), true);
    assert.equal(JSON.stringify(r).includes(secretValue), false, 'credential value must never be echoed');
  }
});

test('(A) raw credential VALUES (PEM marker / base58 blob) -> INVALID, value never echoed', () => {
  const pem = '-----BEGIN SOMETHING-----';
  const blob = 'A'.repeat(70); // contiguous base58 alphabet run
  for (const planted of [pem, blob]) {
    const r = evaluateLiveSourceBoundary({
      purpose: 'live_source_boundary', live_source: 'fixture_stream', note_ref: planted
    });
    assert.equal(r.live_source_state, 'LIVE_SOURCE_INVALID');
    assert.equal(JSON.stringify(r).includes(planted), false);
  }
});

test('(A) provider_key_ref: opaque reference accepted; presence only, never the value', () => {
  const r = evaluateLiveSourceBoundary(cleanSourceInput());
  assert.equal(r.live_source_state, 'LIVE_SOURCE_READ_ONLY_OK');
  assert.equal(r.provider_key_ref_present, true);
  assert.equal(JSON.stringify(r).includes('helius_key_ref_01'), false,
    'the ref value itself is never echoed — only presence');
});

test('(A) provider_key_ref refused when secret-shaped (://, spaces, >128, base58 blob, PEM)', () => {
  const shapes = [
    'https://key.example.com/abc',
    'ref with spaces',
    'x'.repeat(129),
    'A'.repeat(64),
    '2'.repeat(45),
    '-----BEGIN PRIVATE-----',
    '',
    12345
  ];
  for (const ref of shapes) {
    const r = evaluateLiveSourceBoundary({
      purpose: 'live_source_boundary', live_source: 'fixture_stream', provider_key_ref: ref
    });
    assertLiveSafe(r);
    assert.equal(r.live_source_state, 'LIVE_SOURCE_INVALID', `must refuse ref shape: ${typeof ref}`);
    assert.equal(r.provider_key_ref_present, false);
    if (typeof ref === 'string' && ref.length > 0) {
      assert.equal(JSON.stringify(r).includes(ref), false, 'secret-shaped ref never echoed');
    }
  }
});

test('(A) execution-command keys (incl. forbidden opportunity/batch vocabulary) -> INVALID', () => {
  for (const k of ['buy', 'send', 'sign', 'connect', 'open_stream', 'activate',
    'buy_opportunity', 'execute_opportunity', 'submit_opportunity',
    'exit_all_positions', 'batch_exit_all_positions']) {
    const r = evaluateLiveSourceBoundary({
      purpose: 'live_source_boundary', live_source: 'fixture_stream', [k]: 'now'
    });
    assert.equal(r.live_source_state, 'LIVE_SOURCE_INVALID');
    assert.equal(r.reasons.includes('execution_command_blocked'), true);
  }
});

test('(A) smuggled forbidden true flag -> INVALID; wrong purpose -> INVALID', () => {
  const r1 = evaluateLiveSourceBoundary({
    purpose: 'live_source_boundary', live_source: 'fixture_stream', live_stream_enabled: true
  });
  assert.equal(r1.live_source_state, 'LIVE_SOURCE_INVALID');
  const r2 = evaluateLiveSourceBoundary({ purpose: 'wrong', live_source: 'fixture_stream' });
  assert.equal(r2.live_source_state, 'LIVE_SOURCE_INVALID');
});

test('(A) hostile / uninspectable input never throws -> frozen UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateLiveSourceBoundary(h); });
    assertLiveSafe(r);
    assert.equal(r.live_source_state, 'LIVE_SOURCE_UNCONFIGURED');
  }
});

test('(A) TOCTOU: counting getter on live_source is read EXACTLY ONCE (snapshot-once)', () => {
  const { obj, reads } = withCountedField(
    { purpose: 'live_source_boundary' }, 'live_source',
    'fixture_stream', 'live_helius_laserstream_enabled');
  const r = evaluateLiveSourceBoundary(obj);
  assert.equal(r.live_source_state, 'LIVE_SOURCE_READ_ONLY_OK',
    'the FIRST (clean) value must be the one consumed everywhere');
  assert.equal(reads(), 1, 'property must be read exactly once');
});

// ===========================================================================
// (B) LIVE-ACTIVATION SEAM DESCRIPTOR
// ===========================================================================

test('(B) contract: frozen, requirement tokens, activation_performed/seam_ready_advisory pinned false', () => {
  const c = describeLiveActivationSeamContract();
  assertLiveSafe(c);
  assert.equal(c.contract, 'live-activation-seam');
  assert.equal(c.activation_performed, false);
  assert.equal(c.seam_ready_advisory, false);
  assert.deepEqual([...c.supported_requirement_tokens], [
    'LIVE_REQ_PROVIDER_KEY_REF', 'LIVE_REQ_OWNER_APPROVAL_REF',
    'LIVE_REQ_READINESS_GREEN', 'LIVE_REQ_SEPARATE_ADAPTER_REVIEW'
  ]);
});

test('(B) full descriptor: describes requirements without activating anything', () => {
  const r = cleanSeam;
  assertLiveSafe(r);
  assert.equal(r.live_seam_state, 'LIVE_SEAM_DESCRIPTOR');
  assert.equal(r.activation_performed, false, 'NEVER activates');
  assert.equal(Object.isFrozen(r.seam_requirements), true);
  const byToken = Object.fromEntries(r.seam_requirements.map((x) => [x.requirement, x.met]));
  assert.equal(byToken.LIVE_REQ_PROVIDER_KEY_REF, true);
  assert.equal(byToken.LIVE_REQ_OWNER_APPROVAL_REF, true);
  assert.equal(byToken.LIVE_REQ_READINESS_GREEN, true);
  assert.equal(byToken.LIVE_REQ_SEPARATE_ADAPTER_REVIEW, false,
    'adapter review HARDCODED unmet — the adapter does not exist in this package');
  assert.equal(r.seam_ready_advisory, false,
    'seam can NEVER claim readiness while adapter review is unmet');
  for (const item of r.seam_requirements) assert.equal(Object.isFrozen(item), true);
});

test('(B) seam_ready_advisory is false across EVERY met-combination (including all-true)', () => {
  const bools = [true, false];
  for (const keyRef of bools) {
    for (const approval of bools) {
      for (const readiness of bools) {
        const r = evaluateLiveActivationSeam({
          purpose: 'live_activation_seam',
          live_source_boundary: cleanSource,
          provider_key_ref_present: keyRef,
          owner_approval_ref: approval ? 'approval_ref_x' : null,
          readiness_checklist: readiness ? cleanChecklistAllTrue : null
        });
        assertLiveSafe(r);
        assert.equal(r.live_seam_state, 'LIVE_SEAM_DESCRIPTOR');
        assert.equal(r.seam_ready_advisory, false,
          `seam_ready_advisory pinned false for combo ${keyRef}/${approval}/${readiness}`);
        assert.equal(r.activation_performed, false);
        const adapter = r.seam_requirements.find((x) => x.requirement === 'LIVE_REQ_SEPARATE_ADAPTER_REVIEW');
        assert.equal(adapter.met, false);
      }
    }
  }
});

test('(B) owner approval VALUE is never validated or echoed — presence only', () => {
  const secretish = 'owner-approval-token-value-shhh';
  const r = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam',
    live_source_boundary: cleanSource,
    provider_key_ref_present: true,
    owner_approval_ref: secretish,
    readiness_checklist: null
  });
  assert.equal(r.live_seam_state, 'LIVE_SEAM_DESCRIPTOR');
  assert.equal(r.owner_approval_ref_present, true);
  assert.equal(JSON.stringify(r).includes(secretish), false, 'approval value never echoed');
  const r2 = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam',
    live_source_boundary: cleanSource,
    provider_key_ref_present: true,
    owner_approval_ref: 12345,
    readiness_checklist: null
  });
  assert.equal(r2.live_seam_state, 'LIVE_SEAM_INVALID');
});

test('(B) boundary gating: missing -> UNCONFIGURED; not READ_ONLY_OK -> UNCONFIGURED; INVALID/forged -> INVALID', () => {
  const missing = evaluateLiveActivationSeam({ purpose: 'live_activation_seam', provider_key_ref_present: true });
  assert.equal(missing.live_seam_state, 'LIVE_SEAM_UNCONFIGURED');

  const unconfigured = evaluateLiveSourceBoundary({ purpose: 'live_source_boundary' });
  const notOk = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam', live_source_boundary: unconfigured, provider_key_ref_present: true
  });
  assert.equal(notOk.live_seam_state, 'LIVE_SEAM_UNCONFIGURED');

  const invalidSource = evaluateLiveSourceBoundary({ purpose: 'live_source_boundary', live_source: 'live_stream_enabled_tag' });
  const seamInvalid = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam', live_source_boundary: invalidSource, provider_key_ref_present: true
  });
  assert.equal(seamInvalid.live_seam_state, 'LIVE_SEAM_INVALID');

  const forged = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam', live_source_boundary: { some: 'object' }, provider_key_ref_present: true
  });
  assert.equal(forged.live_seam_state, 'LIVE_SEAM_INVALID');
});

test('(B) readiness requirement: unmet checklist / missing checklist -> LIVE_REQ_READINESS_GREEN unmet', () => {
  const partial = evaluateLiveReadinessChecklist({ priority_fee_cache_warm: true });
  const r = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam',
    live_source_boundary: cleanSource,
    provider_key_ref_present: true,
    owner_approval_ref: 'approval_ref_x',
    readiness_checklist: partial
  });
  assert.equal(r.live_seam_state, 'LIVE_SEAM_DESCRIPTOR');
  const green = r.seam_requirements.find((x) => x.requirement === 'LIVE_REQ_READINESS_GREEN');
  assert.equal(green.met, false);
  assert.equal(r.seam_ready_advisory, false);

  const bad = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam',
    live_source_boundary: cleanSource,
    provider_key_ref_present: true,
    readiness_checklist: { not: 'a checklist' }
  });
  assert.equal(bad.live_seam_state, 'LIVE_SEAM_INVALID');
});

test('(B) smuggled material -> INVALID; non-boolean provider_key_ref_present -> INVALID', () => {
  const r1 = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam', live_source_boundary: cleanSource,
    provider_key_ref_present: true, api_key: 'raw-key-value'
  });
  assert.equal(r1.live_seam_state, 'LIVE_SEAM_INVALID');
  assert.equal(JSON.stringify(r1).includes('raw-key-value'), false);

  const r2 = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam', live_source_boundary: cleanSource,
    provider_key_ref_present: 'yes'
  });
  assert.equal(r2.live_seam_state, 'LIVE_SEAM_INVALID');

  const r3 = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam', live_source_boundary: cleanSource,
    provider_key_ref_present: true, buy_opportunity: 'x'
  });
  assert.equal(r3.live_seam_state, 'LIVE_SEAM_INVALID');
});

test('(B) hostile input never throws -> UNCONFIGURED; results frozen', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateLiveActivationSeam(h); });
    assertLiveSafe(r);
    assert.equal(r.live_seam_state, 'LIVE_SEAM_UNCONFIGURED');
    assert.equal(r.seam_ready_advisory, false);
    assert.equal(r.activation_performed, false);
  }
});

test('(B) TOCTOU: counting getter on a consumed component field is read exactly once', () => {
  const forgedBoundary = withCountedField(
    {
      read_only: true, valid: true, live_source_boundary_valid: true,
      live_source: 'fixture_stream', provider_key_ref_present: true,
      stream_connected: false, connection_performed: false
    },
    'live_source_state', 'LIVE_SOURCE_READ_ONLY_OK', 'LIVE_SOURCE_INVALID');
  const r = evaluateLiveActivationSeam({
    purpose: 'live_activation_seam',
    live_source_boundary: forgedBoundary.obj,
    provider_key_ref_present: true
  });
  assert.equal(r.live_seam_state, 'LIVE_SEAM_DESCRIPTOR',
    'snapshot-once: the first (clean) state must be consumed consistently');
  assert.equal(forgedBoundary.reads(), 1, 'component field read exactly once');

  const topLevel = withCountedField(
    { purpose: 'live_activation_seam', live_source_boundary: cleanSource },
    'provider_key_ref_present', true, false);
  const r2 = evaluateLiveActivationSeam(topLevel.obj);
  assert.equal(r2.live_seam_state, 'LIVE_SEAM_DESCRIPTOR');
  assert.equal(r2.seam_requirements.find((x) => x.requirement === 'LIVE_REQ_PROVIDER_KEY_REF').met, true);
  assert.equal(topLevel.reads(), 1);
});

// ===========================================================================
// (C) STREAM-HEALTH / GAP READ-MODEL
// ===========================================================================

test('(C) contract: frozen, six states, two advisory tokens only', () => {
  const c = describeStreamHealthReadModelContract();
  assertLiveSafe(c);
  assert.equal(c.contract, 'stream-health-read-model');
  assert.equal(c.read_model_only, true);
  assert.deepEqual([...c.supported_advisory_tokens],
    ['LIVE_ADVISORY_NONE', 'LIVE_ADVISORY_EXITS_ONLY_SHAPED']);
  assert.equal(c.supported_states.length, 6);
});

test('(C) fixture/replay slot sequences: hand-computed gap classifications with window=5', () => {
  // realistic slot sequence from a fixture stream: slots 100..106 observed
  const seq = fixtureSlotSequence([100, 101, 102, 103, 104, 105, 106]);
  assert.equal(seq.maxSlot, 106);

  // gap 0: confirmed caught up to seen
  const g0 = evaluateStreamHealthReadModel(streamInput(seq.maxSlot, seq.maxSlot, 5));
  assertLiveSafe(g0);
  assert.equal(g0.stream_health_state, 'LIVE_STREAM_HEALTH_SYNCED');
  assert.equal(g0.gap_slots, 0);
  assert.equal(g0.live_stream_advisory, 'LIVE_ADVISORY_NONE');

  // gap 3: 106 seen, 103 confirmed
  const g3 = evaluateStreamHealthReadModel(streamInput(seq.maxSlot, 103, 5));
  assert.equal(g3.stream_health_state, 'LIVE_STREAM_HEALTH_GAP_RECOVERABLE');
  assert.equal(g3.gap_slots, 3);
  assert.equal(g3.live_stream_advisory, 'LIVE_ADVISORY_NONE');

  // gap == window (5): still recoverable
  const g5 = evaluateStreamHealthReadModel(streamInput(seq.maxSlot, 101, 5));
  assert.equal(g5.stream_health_state, 'LIVE_STREAM_HEALTH_GAP_RECOVERABLE');
  assert.equal(g5.gap_slots, 5);

  // gap == window+1 (6): exceeded -> EXITS_ONLY-shaped advisory
  const g6 = evaluateStreamHealthReadModel(streamInput(seq.maxSlot, 100, 5));
  assert.equal(g6.stream_health_state, 'LIVE_STREAM_HEALTH_GAP_EXCEEDED');
  assert.equal(g6.gap_slots, 6);
  assert.equal(g6.live_stream_advisory, 'LIVE_ADVISORY_EXITS_ONLY_SHAPED');
});

test('(C) negative gap (confirmed ahead of seen) -> INVALID inconsistent_slots', () => {
  const r = evaluateStreamHealthReadModel(streamInput(100, 101, 5));
  assert.equal(r.stream_health_state, 'LIVE_STREAM_HEALTH_INVALID');
  assert.equal(r.reasons.includes('inconsistent_slots'), true);
  assert.equal(r.gap_slots, null);
});

test('(C) missing backfill window is NEVER defaulted: gap 0 -> SYNCED, gap>0 -> fail-safe GAP_EXCEEDED', () => {
  const synced = evaluateStreamHealthReadModel(streamInput(100, 100, undefined));
  assert.equal(synced.stream_health_state, 'LIVE_STREAM_HEALTH_SYNCED');

  const r = evaluateStreamHealthReadModel(streamInput(101, 100, undefined));
  assert.equal(r.stream_health_state, 'LIVE_STREAM_HEALTH_GAP_EXCEEDED',
    'a 1-slot gap with NO window cannot be classified recoverable');
  assert.equal(r.reasons.includes('missing_backfill_window'), true);
  assert.equal(r.live_stream_advisory, 'LIVE_ADVISORY_EXITS_ONLY_SHAPED');

  const nullWindow = evaluateStreamHealthReadModel(streamInput(101, 100, null));
  assert.equal(nullWindow.stream_health_state, 'LIVE_STREAM_HEALTH_GAP_EXCEEDED');
});

test('(C) provider_degraded worst-of merge: EXCEEDED > DEGRADED > RECOVERABLE > SYNCED', () => {
  const degradedSynced = evaluateStreamHealthReadModel(streamInput(100, 100, 5, { provider_degraded: true }));
  assert.equal(degradedSynced.stream_health_state, 'LIVE_STREAM_HEALTH_DEGRADED');
  assert.equal(degradedSynced.live_stream_advisory, 'LIVE_ADVISORY_EXITS_ONLY_SHAPED');

  const degradedRecoverable = evaluateStreamHealthReadModel(streamInput(103, 100, 5, { provider_degraded: true }));
  assert.equal(degradedRecoverable.stream_health_state, 'LIVE_STREAM_HEALTH_DEGRADED');

  const degradedExceeded = evaluateStreamHealthReadModel(streamInput(110, 100, 5, { provider_degraded: true }));
  assert.equal(degradedExceeded.stream_health_state, 'LIVE_STREAM_HEALTH_GAP_EXCEEDED',
    'EXCEEDED outranks DEGRADED in the worst-of merge');
  assert.equal(degradedExceeded.reasons.includes('provider_degraded_reported'), true);

  const notDegraded = evaluateStreamHealthReadModel(streamInput(100, 100, 5, { provider_degraded: false }));
  assert.equal(notDegraded.stream_health_state, 'LIVE_STREAM_HEALTH_SYNCED');
});

test('(C) advisory NEVER escalates beyond EXITS_ONLY-shaped (never KILLED-shaped)', () => {
  const inputs = [
    streamInput(100, 100, 5),
    streamInput(103, 100, 5),
    streamInput(200, 100, 5),
    streamInput(200, 100, undefined),
    streamInput(200, 100, 5, { provider_degraded: true }),
    streamInput(100, 100, 5, { provider_degraded: true }),
    streamInput(100, 101, 5),
    null, {}, streamInput('x', 'y', 5)
  ];
  for (const i of inputs) {
    const r = evaluateStreamHealthReadModel(i);
    assert.equal(['LIVE_ADVISORY_NONE', 'LIVE_ADVISORY_EXITS_ONLY_SHAPED'].includes(r.live_stream_advisory), true);
    assert.equal(JSON.stringify(r).includes('KILLED'), false, 'never KILLED-shaped');
    assert.equal(r.read_model_only, true, 'read-model: changes no operating state');
  }
});

test('(C) invalid types -> INVALID; missing slots -> UNCONFIGURED', () => {
  assert.equal(evaluateStreamHealthReadModel(streamInput('100', 100, 5)).stream_health_state, 'LIVE_STREAM_HEALTH_INVALID');
  assert.equal(evaluateStreamHealthReadModel(streamInput(-1, 0, 5)).stream_health_state, 'LIVE_STREAM_HEALTH_INVALID');
  assert.equal(evaluateStreamHealthReadModel(streamInput(NaN, 100, 5)).stream_health_state, 'LIVE_STREAM_HEALTH_INVALID');
  assert.equal(evaluateStreamHealthReadModel(streamInput(100, 90, -5)).stream_health_state, 'LIVE_STREAM_HEALTH_INVALID');
  assert.equal(evaluateStreamHealthReadModel(streamInput(100, 90, '5')).stream_health_state, 'LIVE_STREAM_HEALTH_INVALID');
  assert.equal(evaluateStreamHealthReadModel(streamInput(100, 90, 5, { slot_lag: 'big' })).stream_health_state, 'LIVE_STREAM_HEALTH_INVALID');
  assert.equal(evaluateStreamHealthReadModel(streamInput(100, 90, 5, { provider_degraded: 'yes' })).stream_health_state, 'LIVE_STREAM_HEALTH_INVALID');
  const missing = evaluateStreamHealthReadModel({ max_backfill_window_slots: 5 });
  assert.equal(missing.stream_health_state, 'LIVE_STREAM_HEALTH_UNCONFIGURED');
  assert.equal(missing.reasons.includes('slots_missing'), true);
});

test('(C) SSOT G5 names are consumed-only: never emitted as output keys; no operating_state output', () => {
  const r = evaluateStreamHealthReadModel(streamInput(106, 103, 5));
  for (const k of ['last_seen_slot', 'last_confirmed_slot', 'slot_lag', 'provider_degraded', 'operating_state']) {
    assert.equal(Object.prototype.hasOwnProperty.call(r, k), false,
      `${k} must not appear as an output key`);
  }
});

test('(C) TOCTOU: counting getter on last_seen_slot read exactly once; first value wins', () => {
  const { obj, reads } = withCountedField(
    { last_confirmed_slot: 100, max_backfill_window_slots: 5 },
    'last_seen_slot', 100, 999);
  const r = evaluateStreamHealthReadModel(obj);
  assert.equal(r.stream_health_state, 'LIVE_STREAM_HEALTH_SYNCED', 'first value (gap 0) must win');
  assert.equal(r.gap_slots, 0);
  assert.equal(reads(), 1);
});

test('(C) hostile input never throws -> UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateStreamHealthReadModel(h); });
    assertLiveSafe(r);
    assert.equal(r.stream_health_state, 'LIVE_STREAM_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// (D) LIVE-READINESS CHECKLIST READ-MODEL
// ===========================================================================

test('(D) contract: frozen, item tokens, readiness display grants nothing (note)', () => {
  const c = describeLiveReadinessChecklistContract();
  assertLiveSafe(c);
  assert.equal(c.contract, 'live-readiness-checklist');
  assert.equal(c.supported_item_tokens.length, 6);
  assert.equal(/NOT trading readiness/i.test(c.note), true);
  assert.equal(/GRANTS NOTHING/i.test(c.note), true);
});

test('(D) all-true checklist -> CHECKLIST with all_met:true, frozen items, still no readiness flag', () => {
  const r = cleanChecklistAllTrue;
  assertLiveSafe(r);
  assert.equal(r.live_readiness_state, 'LIVE_READINESS_CHECKLIST');
  assert.equal(r.all_met, true);
  assert.equal(r.checklist.length, 6);
  assert.equal(Object.isFrozen(r.checklist), true);
  for (const item of r.checklist) {
    assert.equal(Object.isFrozen(item), true);
    assert.equal(item.met, true);
    assert.equal(item.reason, 'verified_by_caller_input');
  }
  // all_met:true STILL grants nothing
  assert.equal(r.trading_ready, false);
  assert.equal(r.live_stream_enabled, false);
});

test('(D) unknown is NOT met: null / missing / non-boolean -> met:false unknown_not_verified', () => {
  const r = evaluateLiveReadinessChecklist({
    priority_fee_cache_warm: null,
    protocol_constants_green: undefined,
    rpc_health_green: 'true',
    stream_synced: 1,
    calibration_priors_loaded: true,
    cost_pipeline_ready: false
  });
  assert.equal(r.live_readiness_state, 'LIVE_READINESS_CHECKLIST');
  assert.equal(r.all_met, false);
  const byItem = Object.fromEntries(r.checklist.map((x) => [x.item, x]));
  assert.equal(byItem.LIVE_CHECK_PRIORITY_FEE_CACHE_WARM.met, false);
  assert.equal(byItem.LIVE_CHECK_PRIORITY_FEE_CACHE_WARM.reason, 'unknown_not_verified');
  assert.equal(byItem.LIVE_CHECK_PROTOCOL_CONSTANTS_GREEN.reason, 'unknown_not_verified');
  assert.equal(byItem.LIVE_CHECK_RPC_HEALTH_GREEN.met, false, 'string "true" is NOT met');
  assert.equal(byItem.LIVE_CHECK_STREAM_SYNCED.met, false, 'number 1 is NOT met');
  assert.equal(byItem.LIVE_CHECK_CALIBRATION_PRIORS_LOADED.met, true);
  assert.equal(byItem.LIVE_CHECK_COST_PIPELINE_READY.met, false);
  assert.equal(byItem.LIVE_CHECK_COST_PIPELINE_READY.reason, 'reported_not_ready');
});

test('(D) smuggled credential / exec command / URL -> INVALID', () => {
  assert.equal(evaluateLiveReadinessChecklist({ priority_fee_cache_warm: true, api_key: 'k' }).live_readiness_state, 'LIVE_READINESS_INVALID');
  assert.equal(evaluateLiveReadinessChecklist({ priority_fee_cache_warm: true, send: 'now' }).live_readiness_state, 'LIVE_READINESS_INVALID');
  assert.equal(evaluateLiveReadinessChecklist({ priority_fee_cache_warm: true, ref: 'wss://x.example' }).live_readiness_state, 'LIVE_READINESS_INVALID');
});

test('(D) hostile input never throws -> UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateLiveReadinessChecklist(h); });
    assertLiveSafe(r);
    assert.equal(r.live_readiness_state, 'LIVE_READINESS_UNCONFIGURED');
    assert.equal(r.all_met, false);
  }
});

// ===========================================================================
// (E) LIVE SUPPRESSION
// ===========================================================================

test('(E) contract: always suppressed with the three not_*_authorized tokens', () => {
  const c = describeLiveSuppressionContract();
  assertLiveSafe(c);
  assert.equal(c.suppressed, true);
  for (const t of ['not_execution_authorized', 'not_sign_authorized', 'not_send_authorized']) {
    assert.equal(c.suppression_reasons.includes(t), true);
  }
});

test('(E) ALWAYS suppressed:true — clean, empty, and missing inputs all carry the three tokens', () => {
  for (const input of [
    undefined, null, {},
    { live_source_boundary: cleanSource, stream_health: syncedStream, live_surface: cleanSurface }
  ]) {
    const r = evaluateLiveSuppression(input);
    assertLiveSafe(r);
    assert.equal(r.suppressed, true);
    assert.equal(r.status, 'LIVE_SUPPRESSED');
    for (const t of ['not_execution_authorized', 'not_sign_authorized', 'not_send_authorized']) {
      assert.equal(r.suppression_reasons.includes(t), true, `${t} always present`);
    }
  }
});

test('(E) component codes when unclean: live_source_invalid / stream_gap_exceeded / seam_not_ready / live_surface_detected', () => {
  const invalidSource = evaluateLiveSourceBoundary({ purpose: 'live_source_boundary', live_source: 'nope' });
  const exceeded = evaluateStreamHealthReadModel(streamInput(200, 100, 5));
  const blockedSurface = evaluateLiveForbiddenSurface({ api_key: 'raw' });
  const r = evaluateLiveSuppression({
    live_source_boundary: invalidSource,
    stream_health: exceeded,
    live_activation_seam: cleanSeam,
    live_surface: blockedSurface
  });
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('live_source_invalid'), true);
  assert.equal(r.suppression_reasons.includes('stream_gap_exceeded'), true);
  assert.equal(r.suppression_reasons.includes('seam_not_ready'), true,
    'seam_ready_advisory is always false in this package -> a present seam is always not-ready');
  assert.equal(r.suppression_reasons.includes('live_surface_detected'), true);
});

test('(E) clean components: no component codes, but the three tokens stay', () => {
  const r = cleanSuppression;
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('live_source_invalid'), false);
  assert.equal(r.suppression_reasons.includes('stream_gap_exceeded'), false);
  assert.equal(r.suppression_reasons.includes('live_surface_detected'), false);
  // the seam is present and (by construction in this package) never ready:
  assert.equal(r.suppression_reasons.includes('seam_not_ready'), true);
  assert.equal(r.suppression_reasons.includes('not_execution_authorized'), true);
});

test('(E) hostile input never throws -> still suppressed fail-closed', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateLiveSuppression(h); });
    assertLiveSafe(r);
    assert.equal(r.suppressed, true);
    assert.equal(r.suppression_reasons.includes('not_execution_authorized'), true);
  }
});

// ===========================================================================
// (F) LIVE FORBIDDEN SURFACE GUARD
// ===========================================================================

test('(F) contract: forbidden-NAME list includes the credential extension; provider_key_ref sanctioned', () => {
  const c = describeLiveForbiddenSurfaceContract();
  assertLiveSafe(c);
  for (const n of ['api_key', 'apiKey', 'bearer_token', 'access_token', 'auth_token', 'provider_key', 'provider_secret']) {
    assert.equal(c.forbidden_field_names.includes(n), true, `${n} must be forbidden`);
  }
  assert.equal(c.forbidden_field_names.includes('provider_key_ref'), false,
    'provider_key_ref is the sanctioned BY-REFERENCE name');
});

test('(F) clean descriptor -> CLEAN, all detection booleans false', () => {
  const r = cleanSurface;
  assertLiveSafe(r);
  assert.equal(r.live_surface_state, 'LIVE_SURFACE_CLEAN');
  assert.equal(r.key_material_detected, false);
  assert.equal(r.credential_detected, false);
  assert.equal(r.live_surface_detected, false);
  assert.equal(r.forbidden_field_detected, false);
  assert.equal(r.forbidden_field_ref, null);
});

test('(F) credential names -> BLOCKED with NAME-only redaction (value never echoed)', () => {
  const secretValue = 'raw-secret-credential-value-123';
  for (const name of ['api_key', 'apiKey', 'bearer_token', 'access_token', 'auth_token', 'provider_key', 'provider_secret', 'token', 'password']) {
    const r = evaluateLiveForbiddenSurface({ [name]: secretValue });
    assertLiveSafe(r);
    assert.equal(r.live_surface_state, 'LIVE_SURFACE_BLOCKED', `${name} must block`);
    assert.equal(r.credential_detected, true, 'true == found == BLOCKED == safe');
    assert.equal(r.forbidden_field_detected, true);
    assert.equal(r.forbidden_field_ref, name, 'redacted ref = the NAME only');
    assert.equal(JSON.stringify(r).includes(secretValue), false, 'value never echoed');
  }
});

test('(F) key-material names -> BLOCKED key_material_detected', () => {
  for (const name of ['private_key', 'privateKey', 'secret_key', 'keypair', 'mnemonic', 'seed', 'seed_phrase', 'signing_key']) {
    const r = evaluateLiveForbiddenSurface({ [name]: 'x' });
    assert.equal(r.live_surface_state, 'LIVE_SURFACE_BLOCKED');
    assert.equal(r.key_material_detected, true);
    assert.equal(r.forbidden_field_ref, name);
  }
});

test('(F) live endpoint/connection names -> BLOCKED live_surface_detected', () => {
  for (const name of ['endpoint', 'endpoint_url', 'url', 'rpc_url', 'ws_url', 'stream_url', 'grpc_endpoint', 'connection_string', 'live_endpoint']) {
    const r = evaluateLiveForbiddenSurface({ [name]: 'wss://example.org' });
    assert.equal(r.live_surface_state, 'LIVE_SURFACE_BLOCKED');
    assert.equal(r.live_surface_detected, true);
    assert.equal(r.forbidden_field_ref, name);
    assert.equal(JSON.stringify(r).includes('wss://example.org'), false);
  }
});

test('(F) provider_key_ref alone is NOT forbidden -> CLEAN', () => {
  const r = evaluateLiveForbiddenSurface({ provider_key_ref: 'opaque_ref_1', note: 'fine' });
  assert.equal(r.live_surface_state, 'LIVE_SURFACE_CLEAN');
});

test('(F) hostile input never throws -> UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateLiveForbiddenSurface(h); });
    assertLiveSafe(r);
    assert.equal(['LIVE_SURFACE_UNCONFIGURED', 'LIVE_SURFACE_BLOCKED'].includes(r.live_surface_state), true);
  }
});

// ===========================================================================
// (G) LIVE-BOUNDARY HEALTH
// ===========================================================================

function healthInputs(overrides) {
  return {
    live_source_boundary: cleanSource,
    live_activation_seam: cleanSeam,
    stream_health: syncedStream,
    readiness_checklist: cleanChecklistAllTrue,
    live_suppression: cleanSuppression,
    live_surface: cleanSurface,
    ...(overrides || {})
  };
}

test('(G) contract: five states, frozen', () => {
  const c = describeLiveBoundaryHealthContract();
  assertLiveSafe(c);
  assert.equal(c.contract, 'live-boundary-health');
  assert.equal(c.supported_states.length, 5);
});

test('(G) clean path -> _SUPPRESSED (suppression is always active at this layer)', () => {
  const r = evaluateLiveBoundaryHealth(healthInputs());
  assertLiveSafe(r);
  assert.equal(r.live_boundary_health_state, 'LIVE_BOUNDARY_HEALTH_SUPPRESSED');
});

test('(G) missing component -> UNCONFIGURED', () => {
  for (const slot of ['live_source_boundary', 'live_activation_seam', 'stream_health',
    'readiness_checklist', 'live_suppression', 'live_surface']) {
    const r = evaluateLiveBoundaryHealth(healthInputs({ [slot]: undefined }));
    assert.equal(r.live_boundary_health_state, 'LIVE_BOUNDARY_HEALTH_UNCONFIGURED', `missing ${slot}`);
  }
});

test('(G) surface BLOCKED / component INVALID / smuggled material -> BLOCKED', () => {
  const blockedSurface = evaluateLiveForbiddenSurface({ api_key: 'raw' });
  assert.equal(evaluateLiveBoundaryHealth(healthInputs({ live_surface: blockedSurface })).live_boundary_health_state,
    'LIVE_BOUNDARY_HEALTH_BLOCKED');

  const invalidSource = evaluateLiveSourceBoundary({ purpose: 'live_source_boundary', live_source: 'nope' });
  assert.equal(evaluateLiveBoundaryHealth(healthInputs({ live_source_boundary: invalidSource })).live_boundary_health_state,
    'LIVE_BOUNDARY_HEALTH_BLOCKED');

  const invalidStream = evaluateStreamHealthReadModel(streamInput(100, 101, 5));
  assert.equal(evaluateLiveBoundaryHealth(healthInputs({ stream_health: invalidStream })).live_boundary_health_state,
    'LIVE_BOUNDARY_HEALTH_BLOCKED');

  const smuggled = evaluateLiveBoundaryHealth(healthInputs({ api_key: 'raw-key' }));
  assert.equal(smuggled.live_boundary_health_state, 'LIVE_BOUNDARY_HEALTH_BLOCKED');
  assert.equal(JSON.stringify(smuggled).includes('raw-key'), false);
});

test('(G) stream gap alone -> DEGRADED at most (never BLOCKED from a gap); forged-unsuppressed clean -> REVIEWED_ADVISORY', () => {
  // a forged unsuppressed marker is required to get past the always-on suppression
  const forgedUnsuppressed = { read_only: true, suppressed: false, suppression_reasons: [] };

  const exceeded = evaluateStreamHealthReadModel(streamInput(200, 100, 5));
  const gapHealth = evaluateLiveBoundaryHealth(healthInputs({
    stream_health: exceeded, live_suppression: forgedUnsuppressed
  }));
  assert.equal(gapHealth.live_boundary_health_state, 'LIVE_BOUNDARY_HEALTH_DEGRADED',
    'stream gap alone never escalates health beyond DEGRADED (EXITS_ONLY-shaped)');

  const degraded = evaluateStreamHealthReadModel(streamInput(100, 100, 5, { provider_degraded: true }));
  const degradedHealth = evaluateLiveBoundaryHealth(healthInputs({
    stream_health: degraded, live_suppression: forgedUnsuppressed
  }));
  assert.equal(degradedHealth.live_boundary_health_state, 'LIVE_BOUNDARY_HEALTH_DEGRADED');

  const reviewed = evaluateLiveBoundaryHealth(healthInputs({ live_suppression: forgedUnsuppressed }));
  assert.equal(reviewed.live_boundary_health_state, 'LIVE_BOUNDARY_HEALTH_REVIEWED_ADVISORY');
  assertLiveSafe(reviewed);
});

test('(G) hostile input never throws -> UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateLiveBoundaryHealth(h); });
    assertLiveSafe(r);
    assert.equal(r.live_boundary_health_state, 'LIVE_BOUNDARY_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// Cross-cutting invariants
// ===========================================================================

test('all results on every state: frozen + read_only + the 24 exec/readiness flags false', () => {
  const results = [
    describeLiveSourceBoundaryContract(),
    describeLiveActivationSeamContract(),
    describeStreamHealthReadModelContract(),
    describeLiveReadinessChecklistContract(),
    describeLiveSuppressionContract(),
    describeLiveForbiddenSurfaceContract(),
    describeLiveBoundaryHealthContract(),
    cleanSource, cleanSeam, syncedStream, cleanChecklistAllTrue, cleanSuppression, cleanSurface,
    evaluateLiveSourceBoundary(null),
    evaluateLiveSourceBoundary({ purpose: 'live_source_boundary', live_source: 'bad' }),
    evaluateLiveActivationSeam(null),
    evaluateStreamHealthReadModel(streamInput(200, 100, 5)),
    evaluateStreamHealthReadModel(streamInput(100, 101, 5)),
    evaluateLiveReadinessChecklist({}),
    evaluateLiveSuppression(null),
    evaluateLiveForbiddenSurface({ api_key: 'x' }),
    evaluateLiveBoundaryHealth(healthInputs()),
    evaluateLiveBoundaryHealth(null)
  ];
  for (const r of results) {
    assertLiveSafe(r);
    assert.equal(Object.prototype.hasOwnProperty.call(r, 'operating_state'), false,
      'no result ever writes/echoes an operating_state key');
  }
});

test('forbidden command vocabulary is never generated: no result carries an opportunity/batch-exit command key', () => {
  const results = [cleanSource, cleanSeam, syncedStream, cleanChecklistAllTrue, cleanSuppression, cleanSurface];
  for (const r of results) {
    const keys = Object.keys(r);
    for (const bad of ['buy_opportunity', 'execute_opportunity', 'submit_opportunity',
      'exit_all_positions', 'batch_exit_all_positions', 'command_type']) {
      assert.equal(keys.includes(bad), false);
    }
  }
});

test('rpc-provider consistency: evaluateRpcReadiness is STILL not-ready beside the live boundary', () => {
  const rpc = evaluateRpcReadiness({
    live_source_boundary_valid: cleanSource.live_source_boundary_valid,
    endpoint_present: false
  });
  assert.equal(rpc.ready, false);
  assert.equal(rpc.configured, false);
  assert.equal(rpc.can_send, false);
  assert.equal(rpc.can_broadcast, false);
  assert.equal(rpc.live_rpc_enabled, false);
  // a clean Stage-17 boundary changes NOTHING about the fail-closed RPC contract
  const rpc2 = evaluateRpcReadiness({});
  assert.equal(rpc2.ready, false);
  assert.equal(rpc2.blockers.includes('rpc_provider_unconfigured_no_rpc'), true);
});

test('static guards: import-free src, no network primitive, no clock/RNG/env/fs, no module-level mutable state, candidate discipline, SSOT names consumed-only', () => {
  const srcPath = fileURLToPath(new URL('../src/live-stream-boundary-foundations.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');

  // import-free
  assert.equal(/^import\s/m.test(src), false, 'src must be import-free');
  assert.equal(/\brequire\s*\(/.test(src), false);

  // strip comments + string literals, then scan CODE only
  const code = src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

  // no network primitive tokens in code
  assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket|new\s+Connection\s*\(|createConnection|net\.|dgram|Socket\s*\(/.test(code), false, 'no network primitive');
  // no clock / RNG / env / fs
  assert.equal(/Date\s*\.\s*now|new\s+Date\b/.test(code), false, 'no clock');
  assert.equal(/Math\s*\.\s*random/.test(code), false, 'no RNG');
  assert.equal(/process\s*\.\s*env/.test(code), false, 'no env');
  assert.equal(/readFileSync|writeFileSync|createReadStream|node:fs/.test(code), false, 'no fs');
  // no module-level mutable state
  assert.equal(/^(let|var)\s/m.test(code), false, 'no module-level let/var');
  // no execution/readiness flag forced true
  for (const f of FORBIDDEN_TRUE_FLAGS) {
    const re = new RegExp(f + String.raw`\s*:\s*true`);
    assert.equal(re.test(code), false, `${f}: true literal must not exist`);
  }
  // candidate_* discipline: NONE in code
  const codeCandidates = [...new Set(code.match(/candidate_[a-z0-9_]+/g) || [])];
  assert.equal(codeCandidates.length, 0, `no candidate_* names in code: ${codeCandidates.join(',')}`);
  // deferred / SSOT enum value strings must not be minted here
  assert.equal(/['"]within_band['"]/.test(src), false);
  assert.equal(/['"]opportunity_update['"]/.test(src), false);
  // SSOT G5 names consumed-only: never used as object-literal OUTPUT keys in code
  for (const n of ['last_seen_slot', 'last_confirmed_slot', 'slot_lag', 'provider_degraded', 'operating_state']) {
    const re = new RegExp(String.raw`\b` + n + String.raw`\s*:`);
    assert.equal(re.test(code), false, `${n} must never appear as an output/object key in code`);
  }
  // SSOT G1 operating_state VALUES never assigned/emitted in code (vocabulary only in prose)
  assert.equal(/['"](WARMING_UP|ACTIVE|EXITS_ONLY|PAUSED|KILLED)['"]/.test(code), false,
    'operating_state values must not appear as code literals');
});

test('static guard: live transport stays out — no scheme:// literal anywhere in src', () => {
  const srcPath = fileURLToPath(new URL('../src/live-stream-boundary-foundations.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(/https?:\/\/|wss:\/\/|grpc:\/\//.test(src), false, 'no URL literal in src');
});
