import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  describeIngestionSourceDescriptorContract,
  validateIngestionSourceDescriptor,
  evaluateIngestionSourceBoundary,
  describeNormalizedIngestionEventContract,
  validateNormalizedIngestionEvent,
  normalizeIngestionEvent,
  describeReplayIngestionHarnessContract,
  validateReplayIngestionBatch,
  evaluateReplayIngestionBatch,
  describeIngestionDedupeContract,
  evaluateIngestionDedupe,
  describeIngestionCursorContract,
  evaluateIngestionCursor,
  describeIngestionHealthContract,
  evaluateIngestionHealth,
} from '../src/index.mjs';

const SRC_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data-ingestion-foundations.mjs',
);
const PKG_JSON = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');

// --------------------------------------------------------------------------
// Safe fixtures (NO network / secret / endpoint).
// --------------------------------------------------------------------------
const goodEvent = {
  event_type: 'wallet_transaction_observed',
  event_ref: 'ev-1',
  source_ref: 'mock_replay',
  observed_at_ref: 'ts-1',
  wallet_ref: 'w-1',
  token_ref: 't-1',
  signature_ref: 'sig-1',
  slot_ref: 1000,
};
const goodBatch = {
  purpose: 'replay_ingestion_batch',
  source_ref: 'mock_replay',
  batch_ref: 'b-1',
  events: [goodEvent, { ...goodEvent, event_ref: 'ev-2', event_type: 'swap_observed' }],
  read_only: true,
  no_network: true,
  no_live_stream: true,
  no_send: true,
  no_broadcast: true,
  no_sign: true,
  no_mainnet: true,
  no_real_live: true,
};

// A hostile proxy that throws on every property read / key enumeration.
function hostileProxy() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('hostile get');
      },
      ownKeys() {
        throw new Error('hostile ownKeys');
      },
      getOwnPropertyDescriptor() {
        throw new Error('hostile descriptor');
      },
      has() {
        throw new Error('hostile has');
      },
    },
  );
}

// The forbidden-true / capability flags that must always be false on every result.
const FORBIDDEN_FALSE_FLAGS = [
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
  'mainnet_enabled',
  'real_live',
  'live_stream_enabled',
  'network_call_made',
];

function assertSafeFlags(r) {
  for (const f of FORBIDDEN_FALSE_FLAGS) {
    assert.equal(r[f], false, `expected ${f}===false`);
  }
  assert.equal(r.read_only, true, 'expected read_only===true');
}

// ==========================================================================
// SOURCE (SD1..SD10)
// ==========================================================================
test('SD1 undefined -> INGESTION_SOURCE_UNCONFIGURED', () => {
  assert.equal(
    evaluateIngestionSourceBoundary(undefined).source_state,
    'INGESTION_SOURCE_UNCONFIGURED',
  );
});

test('SD2 missing source_ref -> UNCONFIGURED', () => {
  assert.equal(
    evaluateIngestionSourceBoundary({ purpose: 'ingestion_source_descriptor' }).source_state,
    'INGESTION_SOURCE_UNCONFIGURED',
  );
});

test('SD3 unknown source_ref -> INVALID', () => {
  assert.equal(
    evaluateIngestionSourceBoundary({ source_ref: 'live_helius' }).source_state,
    'INGESTION_SOURCE_INVALID',
  );
});

test('SD4 valid mock_replay -> READ_ONLY_OK echoes source_ref', () => {
  const r = evaluateIngestionSourceBoundary({ source_ref: 'mock_replay' });
  assert.equal(r.source_state, 'INGESTION_SOURCE_READ_ONLY_OK');
  assert.equal(r.source_descriptor_valid, true);
  assert.equal(r.source_ref, 'mock_replay');
});

test('SD5 disabled live tags -> READ_ONLY_OK with live_stream_enabled===false', () => {
  for (const tag of ['helius_laserstream_disabled', 'triton_yellowstone_disabled']) {
    const r = evaluateIngestionSourceBoundary({ source_ref: tag });
    assert.equal(r.source_state, 'INGESTION_SOURCE_READ_ONLY_OK', tag);
    assert.equal(r.live_stream_enabled, false, tag);
  }
});

test('SD6 endpoint_url -> INVALID and url not echoed', () => {
  const r = evaluateIngestionSourceBoundary({
    source_ref: 'mock_replay',
    endpoint_url: 'https://rpc.example',
  });
  assert.equal(r.source_state, 'INGESTION_SOURCE_INVALID');
  assert.equal(JSON.stringify(r).includes('https://rpc.example'), false);
});

test('SD7 api_key -> INVALID and secret not echoed', () => {
  const r = evaluateIngestionSourceBoundary({
    source_ref: 'mock_replay',
    api_key: 'SECRET123',
  });
  assert.equal(r.source_state, 'INGESTION_SOURCE_INVALID');
  assert.equal(JSON.stringify(r).includes('SECRET123'), false);
});

test('SD8 environment mainnet -> INVALID', () => {
  assert.equal(
    evaluateIngestionSourceBoundary({ source_ref: 'mock_replay', environment: 'mainnet' })
      .source_state,
    'INGESTION_SOURCE_INVALID',
  );
});

test('SD9 can_send:true -> INVALID', () => {
  assert.equal(
    evaluateIngestionSourceBoundary({ source_ref: 'mock_replay', can_send: true }).source_state,
    'INGESTION_SOURCE_INVALID',
  );
});

test('SD10 hostile proxy -> frozen UNCONFIGURED, no throw', () => {
  let r;
  assert.doesNotThrow(() => {
    r = evaluateIngestionSourceBoundary(hostileProxy());
  });
  assert.equal(r.source_state, 'INGESTION_SOURCE_UNCONFIGURED');
  assert.equal(Object.isFrozen(r), true);
});

// ==========================================================================
// NORMALIZE (N1..N12 + whitelist)
// ==========================================================================
const NORMALIZED_WHITELIST = [
  'event_ref',
  'source_ref',
  'observed_at_ref',
  'event_type',
  'wallet_ref',
  'token_ref',
  'signature_ref',
  'slot_ref',
  'read_only',
];

test('N1 goodEvent normalizes with refs', () => {
  const r = normalizeIngestionEvent(goodEvent);
  assert.equal(r.normalized, true);
  assert.equal(r.normalized_event.event_type, 'wallet_transaction_observed');
  assert.equal(r.normalized_event.wallet_ref, 'w-1');
});

test('N2 token_account_change_observed normalizes', () => {
  const r = normalizeIngestionEvent({ ...goodEvent, event_type: 'token_account_change_observed' });
  assert.equal(r.normalized, true);
});

test('N3 swap_observed normalizes as observation, no signal/intent keys', () => {
  const r = normalizeIngestionEvent({ ...goodEvent, event_type: 'swap_observed' });
  assert.equal(r.normalized, true);
  const keys = Object.keys(r.normalized_event);
  for (const forbidden of ['buy', 'sell', 'signal', 'intent']) {
    assert.equal(keys.includes(forbidden), false, `normalized_event must not contain ${forbidden}`);
  }
});

test('N4 mint_observed normalizes; trading_ready/signal_ready false', () => {
  const r = normalizeIngestionEvent({ ...goodEvent, event_type: 'mint_observed' });
  assert.equal(r.normalized, true);
  assert.equal(r.trading_ready, false);
  assert.equal(r.signal_ready, false);
});

test('N5 accepted/interesting event still trading_ready false, no execution field', () => {
  const r = normalizeIngestionEvent({ ...goodEvent, accepted: true, interesting: true });
  assert.equal(r.normalized, true);
  assert.equal(r.trading_ready, false);
  const keys = Object.keys(r.normalized_event);
  for (const forbidden of ['buy', 'sell', 'execute', 'submit', 'send', 'accepted', 'interesting']) {
    assert.equal(keys.includes(forbidden), false, `must not copy ${forbidden}`);
  }
});

test('N6 unknown event_type -> not normalized', () => {
  assert.equal(normalizeIngestionEvent({ ...goodEvent, event_type: 'rug_pull' }).normalized, false);
});

test('N7 missing event_ref -> not normalized', () => {
  const { event_ref, ...noRef } = goodEvent;
  assert.equal(normalizeIngestionEvent(noRef).normalized, false);
});

test('N8 secret-bearing event -> not normalized, secret not echoed', () => {
  const r = normalizeIngestionEvent({ ...goodEvent, api_key: 'SECRET123' });
  assert.equal(r.normalized, false);
  assert.equal(JSON.stringify(r).includes('SECRET123'), false);
});

test('N9 endpoint event -> not normalized, not echoed', () => {
  const r = normalizeIngestionEvent({ ...goodEvent, endpoint_url: 'https://x' });
  assert.equal(r.normalized, false);
  assert.equal(JSON.stringify(r).includes('https://x'), false);
});

test('N10 execution-command field buy:true -> not normalized', () => {
  assert.equal(normalizeIngestionEvent({ ...goodEvent, buy: true }).normalized, false);
});

test('N11 mainnet field -> not normalized', () => {
  assert.equal(
    normalizeIngestionEvent({ ...goodEvent, network: 'mainnet-beta' }).normalized,
    false,
  );
});

test('N12 hostile proxy -> frozen {normalized:false}, no throw', () => {
  let r;
  assert.doesNotThrow(() => {
    r = normalizeIngestionEvent(hostileProxy());
  });
  assert.equal(r.normalized, false);
  assert.equal(Object.isFrozen(r), true);
});

test('N-whitelist: normalized_event keys are a subset of the safe-ref whitelist', () => {
  const r = normalizeIngestionEvent(goodEvent);
  for (const k of Object.keys(r.normalized_event)) {
    assert.equal(NORMALIZED_WHITELIST.includes(k), true, `unexpected key ${k}`);
  }
});

// ==========================================================================
// REPLAY (R1..R12)
// ==========================================================================
test('R1 undefined -> REPLAY_BATCH_UNCONFIGURED', () => {
  assert.equal(
    evaluateReplayIngestionBatch(undefined).batch_state,
    'REPLAY_BATCH_UNCONFIGURED',
  );
});

test('R2 goodBatch -> READ_ONLY_OK, normalized_count 2', () => {
  const r = evaluateReplayIngestionBatch(goodBatch);
  assert.equal(r.batch_state, 'REPLAY_BATCH_READ_ONLY_OK');
  assert.equal(r.normalized_count, 2);
  assert.equal(r.batch_read_only_ok, true);
});

test('R3 empty events -> DEGRADED, no readiness', () => {
  const r = evaluateReplayIngestionBatch({ ...goodBatch, events: [] });
  assert.equal(r.batch_state, 'REPLAY_BATCH_DEGRADED');
  assert.equal(r.batch_read_only_ok, false);
});

test('R4 malformed event (missing event_ref) -> DEGRADED, invalid_count>=1', () => {
  const r = evaluateReplayIngestionBatch({
    ...goodBatch,
    events: [goodEvent, { event_type: 'wallet_transaction_observed' }],
  });
  assert.equal(r.batch_state, 'REPLAY_BATCH_DEGRADED');
  assert.ok(r.invalid_count >= 1, `invalid_count=${r.invalid_count}`);
});

test('R5 duplicate event_ref -> duplicate_count>=1', () => {
  const r = evaluateReplayIngestionBatch({ ...goodBatch, events: [goodEvent, goodEvent] });
  assert.ok(r.duplicate_count >= 1, `duplicate_count=${r.duplicate_count}`);
});

test('R6 unknown event type in batch -> quarantined_count>=1 and DEGRADED', () => {
  const r = evaluateReplayIngestionBatch({
    ...goodBatch,
    events: [goodEvent, { ...goodEvent, event_ref: 'ev-x', event_type: 'rug_pull' }],
  });
  assert.equal(r.batch_state, 'REPLAY_BATCH_DEGRADED');
  assert.ok(r.quarantined_count >= 1, `quarantined_count=${r.quarantined_count}`);
});

test('R7 secret in batch event -> invalid_count++ and secret not echoed', () => {
  const r = evaluateReplayIngestionBatch({
    ...goodBatch,
    events: [{ ...goodEvent, api_key: 'SECRET123' }],
  });
  assert.ok(r.invalid_count >= 1, `invalid_count=${r.invalid_count}`);
  assert.equal(JSON.stringify(r).includes('SECRET123'), false);
});

test('R8 missing attestation no_network -> INVALID', () => {
  assert.equal(
    evaluateReplayIngestionBatch({ ...goodBatch, no_network: undefined }).batch_state,
    'REPLAY_BATCH_INVALID',
  );
});

test('R9 smuggled can_send:true -> INVALID', () => {
  assert.equal(
    evaluateReplayIngestionBatch({ ...goodBatch, can_send: true }).batch_state,
    'REPLAY_BATCH_INVALID',
  );
});

test('R10 non-fixture source_ref -> INVALID (source_ref_invalid)', () => {
  const r = evaluateReplayIngestionBatch({
    ...goodBatch,
    source_ref: 'helius_laserstream_disabled',
  });
  assert.equal(r.batch_state, 'REPLAY_BATCH_INVALID');
  assert.equal(r.reasons.includes('source_ref_invalid'), true);
});

test('R11 hostile proxy -> frozen UNCONFIGURED, no throw', () => {
  let r;
  assert.doesNotThrow(() => {
    r = evaluateReplayIngestionBatch(hostileProxy());
  });
  assert.equal(r.batch_state, 'REPLAY_BATCH_UNCONFIGURED');
  assert.equal(Object.isFrozen(r), true);
});

test('R12 all batch/source/normalize results: capability flags false, read_only true', () => {
  const results = [
    evaluateReplayIngestionBatch(goodBatch),
    evaluateReplayIngestionBatch(undefined),
    evaluateReplayIngestionBatch({ ...goodBatch, events: [] }),
    evaluateReplayIngestionBatch({ ...goodBatch, can_send: true }),
    evaluateIngestionSourceBoundary({ source_ref: 'mock_replay' }),
    evaluateIngestionSourceBoundary(undefined),
    evaluateIngestionSourceBoundary({ source_ref: 'live_helius' }),
    validateIngestionSourceDescriptor({ source_ref: 'mock_replay' }),
    normalizeIngestionEvent(goodEvent),
    normalizeIngestionEvent({ ...goodEvent, event_type: 'rug_pull' }),
    validateNormalizedIngestionEvent(goodEvent),
    validateReplayIngestionBatch(goodBatch),
  ];
  for (const r of results) assertSafeFlags(r);
});

// ==========================================================================
// DESCRIPTORS (G1..G3)
// ==========================================================================
test('G1..G3 describe* contracts frozen and safe', () => {
  const descriptors = [
    describeIngestionSourceDescriptorContract(),
    describeNormalizedIngestionEventContract(),
    describeReplayIngestionHarnessContract(),
  ];
  for (const d of descriptors) {
    assert.equal(Object.isFrozen(d), true);
    assert.equal(d.read_only, true);
    assert.equal(d.can_send, false);
    assert.equal(d.trading_ready, false);
  }
});

// ==========================================================================
// STATIC GUARDS (S1..S4)
// ==========================================================================
test('S1 src is import-free (no import/require specifiers)', () => {
  const src = readFileSync(SRC_FILE, 'utf8');
  assert.equal(/^\s*import\b/m.test(src), false, 'no import statements');
  assert.equal(/\brequire\s*\(/.test(src), false, 'no require()');
  assert.equal(/\bfrom\s+['"]/.test(src), false, 'no from-specifiers');
});

test('S2 src has no network/clock/persistence primitives', () => {
  const src = readFileSync(SRC_FILE, 'utf8');
  const forbidden = [
    /\bfetch\s*\(/,
    /new\s+WebSocket\b/,
    /new\s+Connection\b/,
    /\bsendTransaction\b/,
    /process\.env\b/,
    /\breadFileSync\b/,
    /node:fs\b/,
    /\bDate\.now\b/,
    /new\s+Date\b/,
  ];
  for (const re of forbidden) {
    assert.equal(re.test(src), false, `forbidden primitive matched: ${re}`);
  }
});

test('S3 package.json has no dependencies', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  assert.equal(pkg.dependencies === undefined || Object.keys(pkg.dependencies).length === 0, true);
  assert.equal(
    pkg.peerDependencies === undefined || Object.keys(pkg.peerDependencies).length === 0,
    true,
  );
});

test('S4 src contains no real endpoint URL host', () => {
  const src = readFileSync(SRC_FILE, 'utf8');
  // No concrete http(s)/ws(s) host literal (the regexes use scheme patterns, not hosts).
  assert.equal(/https?:\/\/[a-z0-9]/i.test(src), false, 'no concrete http host');
  assert.equal(/wss?:\/\/[a-z0-9]/i.test(src), false, 'no concrete ws host');
});

// ==========================================================================
// PR-S4-B: DEDUPE / CURSOR / HEALTH
// ==========================================================================

// --------------------------------------------------------------------------
// DEDUPE (F-D1..F-D8)
// --------------------------------------------------------------------------
test('F-D1 undefined -> DEDUPE_UNCONFIGURED', () => {
  assert.equal(evaluateIngestionDedupe(undefined).dedupe_state, 'DEDUPE_UNCONFIGURED');
});

test('F-D2 clean refs -> DEDUPE_OK, accepted 3 duplicate 0', () => {
  const r = evaluateIngestionDedupe({
    purpose: 'ingestion_dedupe',
    event_refs: ['a', 'b', 'c'],
  });
  assert.equal(r.dedupe_state, 'DEDUPE_OK');
  assert.equal(r.accepted_count, 3);
  assert.equal(r.duplicate_count, 0);
});

test('F-D3 in-batch duplicate -> duplicate 1 accepted 2', () => {
  const r = evaluateIngestionDedupe({
    purpose: 'ingestion_dedupe',
    event_refs: ['a', 'a', 'b'],
  });
  assert.equal(r.duplicate_count, 1);
  assert.equal(r.accepted_count, 2);
});

test('F-D4 prior_seen duplicate -> duplicate 1 accepted 1', () => {
  const r = evaluateIngestionDedupe({
    purpose: 'ingestion_dedupe',
    event_refs: ['a', 'x'],
    prior_seen_refs: ['a'],
  });
  assert.equal(r.duplicate_count, 1);
  assert.equal(r.accepted_count, 1);
});

test('F-D5 empty/non-string refs -> quarantined>=2 and DEDUPE_DEGRADED', () => {
  const r = evaluateIngestionDedupe({
    purpose: 'ingestion_dedupe',
    event_refs: ['', 5, 'a'],
  });
  assert.ok(r.quarantined_count >= 2, `quarantined_count=${r.quarantined_count}`);
  assert.equal(r.dedupe_state, 'DEDUPE_DEGRADED');
});

test('F-D6 deterministic: same input twice -> identical counts', () => {
  const input = {
    purpose: 'ingestion_dedupe',
    event_refs: ['a', 'a', 'b', '', 7],
    prior_seen_refs: ['b'],
  };
  const r1 = evaluateIngestionDedupe(input);
  const r2 = evaluateIngestionDedupe(input);
  assert.equal(r1.accepted_count, r2.accepted_count);
  assert.equal(r1.duplicate_count, r2.duplicate_count);
  assert.equal(r1.quarantined_count, r2.quarantined_count);
  assert.equal(r1.dedupe_state, r2.dedupe_state);
});

test('F-D7 smuggled/invalid shape -> DEDUPE_INVALID', () => {
  assert.equal(
    evaluateIngestionDedupe({
      purpose: 'ingestion_dedupe',
      event_refs: ['a'],
      can_send: true,
    }).dedupe_state,
    'DEDUPE_INVALID',
  );
  assert.equal(
    evaluateIngestionDedupe({ purpose: 'wrong', event_refs: ['a'] }).dedupe_state,
    'DEDUPE_INVALID',
  );
  assert.equal(
    evaluateIngestionDedupe({ purpose: 'ingestion_dedupe', event_refs: 'a' }).dedupe_state,
    'DEDUPE_INVALID',
  );
});

test('F-D8 every dedupe result safe; hostile proxy frozen UNCONFIGURED', () => {
  const results = [
    evaluateIngestionDedupe(undefined),
    evaluateIngestionDedupe({ purpose: 'ingestion_dedupe', event_refs: ['a', 'b', 'c'] }),
    evaluateIngestionDedupe({ purpose: 'ingestion_dedupe', event_refs: ['', 5, 'a'] }),
    evaluateIngestionDedupe({ purpose: 'ingestion_dedupe', event_refs: ['a'], can_send: true }),
  ];
  for (const r of results) {
    assert.equal(r.persistence_performed, false);
    assertSafeFlags(r);
  }
  let hr;
  assert.doesNotThrow(() => {
    hr = evaluateIngestionDedupe(hostileProxy());
  });
  assert.equal(hr.dedupe_state, 'DEDUPE_UNCONFIGURED');
  assert.equal(Object.isFrozen(hr), true);
});

// --------------------------------------------------------------------------
// CURSOR (F-C1..F-C8)
// --------------------------------------------------------------------------
test('F-C1 undefined -> CURSOR_UNCONFIGURED', () => {
  assert.equal(evaluateIngestionCursor(undefined).cursor_state, 'CURSOR_UNCONFIGURED');
});

test('F-C2 valid cursor -> CURSOR_VALID, checkpoint, next_cursor_ref, no persistence', () => {
  const r = evaluateIngestionCursor({ purpose: 'ingestion_cursor', current_cursor_ref: 'cur-1' });
  assert.equal(r.cursor_state, 'CURSOR_VALID');
  assert.equal(r.checkpoint_valid, true);
  assert.equal(r.next_cursor_ref, 'cur-1');
  assert.equal(r.persistence_performed, false);
});

test('F-C3 last_processed_ref drives next_cursor_ref', () => {
  const r = evaluateIngestionCursor({
    purpose: 'ingestion_cursor',
    current_cursor_ref: 'cur-1',
    last_processed_ref: 'lp-9',
  });
  assert.equal(r.next_cursor_ref, 'lp-9');
});

test('F-C4 is_stale -> CURSOR_STALE, checkpoint invalid', () => {
  const r = evaluateIngestionCursor({
    purpose: 'ingestion_cursor',
    current_cursor_ref: 'cur-1',
    is_stale: true,
  });
  assert.equal(r.cursor_state, 'CURSOR_STALE');
  assert.equal(r.checkpoint_valid, false);
});

test('F-C5 age vs max_age decides stale/valid', () => {
  assert.equal(
    evaluateIngestionCursor({
      purpose: 'ingestion_cursor',
      current_cursor_ref: 'cur-1',
      age_ms: 100,
      max_age_ms: 10,
    }).cursor_state,
    'CURSOR_STALE',
  );
  assert.equal(
    evaluateIngestionCursor({
      purpose: 'ingestion_cursor',
      current_cursor_ref: 'cur-1',
      age_ms: 5,
      max_age_ms: 10,
    }).cursor_state,
    'CURSOR_VALID',
  );
});

test('F-C6 missing current_cursor_ref -> CURSOR_UNCONFIGURED', () => {
  assert.equal(
    evaluateIngestionCursor({ purpose: 'ingestion_cursor' }).cursor_state,
    'CURSOR_UNCONFIGURED',
  );
});

test('F-C7 smuggled flags -> CURSOR_INVALID, not echoed, never live', () => {
  const r1 = evaluateIngestionCursor({
    purpose: 'ingestion_cursor',
    current_cursor_ref: 'cur-1',
    can_send: true,
  });
  assert.equal(r1.cursor_state, 'CURSOR_INVALID');
  const r2 = evaluateIngestionCursor({
    purpose: 'ingestion_cursor',
    current_cursor_ref: 'cur-1',
    endpoint_url: 'https://x',
  });
  assert.equal(r2.cursor_state, 'CURSOR_INVALID');
  assert.equal(JSON.stringify(r2).includes('https://x'), false);
  for (const r of [r1, r2]) assert.equal(r.live_stream_enabled, false);
});

test('F-C8 checkpoint_valid does not set persistence; hostile proxy frozen UNCONFIGURED', () => {
  const r = evaluateIngestionCursor({ purpose: 'ingestion_cursor', current_cursor_ref: 'cur-1' });
  assert.equal(r.checkpoint_valid, true);
  assert.equal(r.persistence_performed, false);
  let hr;
  assert.doesNotThrow(() => {
    hr = evaluateIngestionCursor(hostileProxy());
  });
  assert.equal(hr.cursor_state, 'CURSOR_UNCONFIGURED');
  assert.equal(Object.isFrozen(hr), true);
});

// --------------------------------------------------------------------------
// HEALTH (F-H1..F-H12) — built from REAL Part C/D results
// --------------------------------------------------------------------------
const sbOk = evaluateIngestionSourceBoundary({
  purpose: 'ingestion_source_descriptor',
  source_ref: 'mock_replay',
});
const rbOk = evaluateReplayIngestionBatch({
  purpose: 'replay_ingestion_batch',
  source_ref: 'mock_replay',
  batch_ref: 'b-1',
  events: [goodEvent, { ...goodEvent, event_ref: 'ev-2', event_type: 'swap_observed' }],
  read_only: true,
  no_network: true,
  no_live_stream: true,
  no_send: true,
  no_broadcast: true,
  no_sign: true,
  no_mainnet: true,
  no_real_live: true,
});
const ddOk = evaluateIngestionDedupe({
  purpose: 'ingestion_dedupe',
  event_refs: ['ev-1', 'ev-2'],
});
const cuOk = evaluateIngestionCursor({
  purpose: 'ingestion_cursor',
  current_cursor_ref: 'cur-1',
});
const allGood = { source_boundary: sbOk, replay_batch: rbOk, dedupe: ddOk, cursor: cuOk };

test('F-H1 undefined -> INGESTION_UNCONFIGURED', () => {
  assert.equal(evaluateIngestionHealth(undefined).ingestion_state, 'INGESTION_UNCONFIGURED');
});

test('F-H2 missing component -> INGESTION_UNCONFIGURED', () => {
  const { cursor, ...noCursor } = allGood;
  assert.equal(evaluateIngestionHealth(noCursor).ingestion_state, 'INGESTION_UNCONFIGURED');
});

test('F-H3 allGood -> INGESTION_REPLAY_READY, replay_ready true', () => {
  const r = evaluateIngestionHealth(allGood);
  assert.equal(r.ingestion_state, 'INGESTION_REPLAY_READY');
  assert.equal(r.ingestion_replay_ready, true);
});

test('F-H4 invalid source -> INGESTION_BLOCKED', () => {
  const r = evaluateIngestionHealth({
    ...allGood,
    source_boundary: evaluateIngestionSourceBoundary({ source_ref: 'live_helius' }),
  });
  assert.equal(r.ingestion_state, 'INGESTION_BLOCKED');
});

test('F-H5 invalid batch -> INGESTION_BLOCKED', () => {
  const r = evaluateIngestionHealth({
    ...allGood,
    replay_batch: evaluateReplayIngestionBatch({
      purpose: 'replay_ingestion_batch',
      source_ref: 'mock_replay',
      batch_ref: 'b-1',
      events: [goodEvent],
      can_send: true,
    }),
  });
  assert.equal(r.ingestion_state, 'INGESTION_BLOCKED');
});

test('F-H6 degraded batch (empty events) -> INGESTION_DEGRADED', () => {
  const r = evaluateIngestionHealth({
    ...allGood,
    replay_batch: evaluateReplayIngestionBatch({ ...goodBatch, events: [] }),
  });
  assert.equal(r.ingestion_state, 'INGESTION_DEGRADED');
});

test('F-H7 stale cursor -> INGESTION_STALE', () => {
  const r = evaluateIngestionHealth({
    ...allGood,
    cursor: evaluateIngestionCursor({
      purpose: 'ingestion_cursor',
      current_cursor_ref: 'cur-1',
      is_stale: true,
    }),
  });
  assert.equal(r.ingestion_state, 'INGESTION_STALE');
});

test('F-H8 smuggled forbidden flag top-level -> INGESTION_BLOCKED', () => {
  const r = evaluateIngestionHealth({ ...allGood, can_send: true });
  assert.equal(r.ingestion_state, 'INGESTION_BLOCKED');
});

test('F-H9 smuggled live_stream_enabled:true in component -> INGESTION_BLOCKED', () => {
  const r = evaluateIngestionHealth({
    ...allGood,
    dedupe: { ...ddOk, live_stream_enabled: true },
  });
  assert.equal(r.ingestion_state, 'INGESTION_BLOCKED');
});

test('F-H10 every health state result keeps capability flags false, read_only true', () => {
  const { cursor, ...noCursor } = allGood;
  const results = [
    evaluateIngestionHealth(undefined), // UNCONFIGURED
    evaluateIngestionHealth(noCursor), // UNCONFIGURED
    evaluateIngestionHealth({
      ...allGood,
      replay_batch: evaluateReplayIngestionBatch({ ...goodBatch, events: [] }),
    }), // DEGRADED
    evaluateIngestionHealth(allGood), // REPLAY_READY
    evaluateIngestionHealth({ ...allGood, can_send: true }), // BLOCKED
    evaluateIngestionHealth({
      ...allGood,
      cursor: evaluateIngestionCursor({
        purpose: 'ingestion_cursor',
        current_cursor_ref: 'cur-1',
        is_stale: true,
      }),
    }), // STALE
  ];
  const states = results.map((r) => r.ingestion_state);
  assert.ok(states.includes('INGESTION_REPLAY_READY'), 'REPLAY_READY covered');
  assert.ok(states.includes('INGESTION_BLOCKED'), 'BLOCKED covered');
  assert.ok(states.includes('INGESTION_STALE'), 'STALE covered');
  assert.ok(states.includes('INGESTION_DEGRADED'), 'DEGRADED covered');
  assert.ok(states.includes('INGESTION_UNCONFIGURED'), 'UNCONFIGURED covered');
  for (const r of results) assertSafeFlags(r);
});

test('F-H11 NO-ECHO: leaked field on inputs is not in result JSON', () => {
  const r = evaluateIngestionHealth({
    ...allGood,
    leaked_marker_field: 'LEAK_TOKEN_XYZ',
  });
  assert.equal(JSON.stringify(r).includes('LEAK_TOKEN_XYZ'), false);
  assert.equal(JSON.stringify(r).includes('leaked_marker_field'), false);
});

test('F-H12 hostile proxy -> frozen INGESTION_UNCONFIGURED; describe frozen', () => {
  let hr;
  assert.doesNotThrow(() => {
    hr = evaluateIngestionHealth(hostileProxy());
  });
  assert.equal(hr.ingestion_state, 'INGESTION_UNCONFIGURED');
  assert.equal(Object.isFrozen(hr), true);
  assert.equal(Object.isFrozen(describeIngestionHealthContract()), true);
});

// --------------------------------------------------------------------------
// DESCRIPTORS (G4..G6) for the new contracts
// --------------------------------------------------------------------------
test('G4..G6 new describe* contracts frozen and safe', () => {
  const descriptors = [
    describeIngestionDedupeContract(),
    describeIngestionCursorContract(),
    describeIngestionHealthContract(),
  ];
  for (const d of descriptors) {
    assert.equal(Object.isFrozen(d), true);
    assert.equal(d.read_only, true);
    assert.equal(d.can_send, false);
    assert.equal(d.trading_ready, false);
  }
});

// --------------------------------------------------------------------------
// STATIC GUARDS (S5..S7) for the appended region
// --------------------------------------------------------------------------
test('S5 src still import-free after append', () => {
  const src = readFileSync(SRC_FILE, 'utf8');
  assert.equal(/^\s*import\b/m.test(src), false, 'no import statements');
  assert.equal(/\brequire\s*\(/.test(src), false, 'no require()');
  assert.equal(/\bfrom\s+['"]/.test(src), false, 'no from-specifiers');
});

test('S6 src has no network/clock/persistence primitives (incl. appended region)', () => {
  const src = readFileSync(SRC_FILE, 'utf8');
  const forbidden = [
    /\bfetch\s*\(/,
    /new\s+WebSocket\b/,
    /new\s+Connection\b/,
    /\bsendTransaction\b/,
    /process\.env\b/,
    /\breadFileSync\b/,
    /node:fs\b/,
    /\bDate\.now\b/,
    /new\s+Date\b/,
  ];
  for (const re of forbidden) {
    assert.equal(re.test(src), false, `forbidden primitive matched: ${re}`);
  }
});

test("S7 src never literally sets can_send: true", () => {
  const src = readFileSync(SRC_FILE, 'utf8');
  assert.equal(/can_send\s*:\s*true/.test(src), false, 'no literal can_send: true');
});
