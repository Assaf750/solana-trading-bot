// PR-S6-A test suite for @soltrade/signal-engine-foundations
// node:test + node:assert/strict. Deterministic. Builds REAL Stage-5 intelligence
// results via the wallet-token-intelligence-foundations evaluators, which in turn
// consume REAL Stage-4 normalized events from data-ingestion-foundations.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeSignalInputBoundaryContract,
  validateSignalInputBoundary,
  evaluateSignalInputBoundary,
  describeWalletLedCandidateSignalContract,
  validateWalletLedSignalInput,
  evaluateWalletLedCandidateSignal,
  describeTokenActivityCandidateSignalContract,
  validateTokenActivitySignalInput,
  evaluateTokenActivityCandidateSignal
} from '../src/index.mjs';

import {
  evaluateWalletObservationIntelligence,
  evaluateTokenObservationIntelligence,
  evaluateWalletTokenRelationship,
  evaluateWalletTokenDiagnostics,
  evaluateIntelligenceHealth
} from '../../wallet-token-intelligence-foundations/src/index.mjs';

import { normalizeIngestionEvent } from '../../data-ingestion-foundations/src/index.mjs';

// keep validate* imports referenced (contract surface) without affecting logic
void validateSignalInputBoundary;
void validateWalletLedSignalInput;
void validateTokenActivitySignalInput;

// ---------------------------------------------------------------------------
// REAL Stage-4 -> Stage-5 builders
// ---------------------------------------------------------------------------

const mk = (type, ref, w, t) => normalizeIngestionEvent({
  event_type: type,
  event_ref: ref,
  source_ref: 'mock_replay',
  observed_at_ref: 'ts',
  wallet_ref: w,
  token_ref: t,
  signature_ref: 'sig',
  slot_ref: 1
}).normalized_event;

const wOk = evaluateWalletObservationIntelligence({
  purpose: 'wallet_observation_input',
  wallet_ref: 'w-1',
  events: [
    mk('wallet_transaction_observed', 'e1', 'w-1', 't-1'),
    mk('swap_observed', 'e2', 'w-1', 't-1'),
    mk('mint_observed', 'e3', 'w-1', 't-2')
  ],
  read_only: true
});
const tOk = evaluateTokenObservationIntelligence({
  purpose: 'token_observation_input',
  token_ref: 't-1',
  events: [
    mk('mint_observed', 'e1', 'w-1', 't-1'),
    mk('pool_observed', 'e2', 'w-2', 't-1'),
    mk('swap_observed', 'e3', 'w-1', 't-1')
  ],
  read_only: true
});
const rOk = evaluateWalletTokenRelationship({
  purpose: 'wallet_token_relationship_input',
  wallet_ref: 'w-1',
  token_ref: 't-1',
  events: [
    mk('swap_observed', 'e1', 'w-1', 't-1'),
    mk('swap_observed', 'e2', 'w-1', 't-1')
  ],
  read_only: true
});
const dOk = evaluateWalletTokenDiagnostics({
  purpose: 'wallet_token_diagnostics_input',
  wallet_observation: wOk,
  token_observation: tOk,
  relationship: rOk
});
const hOk = evaluateIntelligenceHealth({
  wallet_observation: wOk, token_observation: tOk, relationship: rOk, diagnostics: dOk
});

const wEmpty = evaluateWalletObservationIntelligence({ purpose: 'wallet_observation_input', wallet_ref: 'w-1', events: [], read_only: true });
const tEmpty = evaluateTokenObservationIntelligence({ purpose: 'token_observation_input', token_ref: 't-1', events: [], read_only: true });

// a Stage-5 INVALID component (smuggled exec key drove it INVALID)
const wInvalid = evaluateWalletObservationIntelligence({
  purpose: 'wallet_observation_input', wallet_ref: 'w-1',
  events: [mk('swap_observed', 'e1', 'w-1', 't-1')], read_only: true, buy_opportunity: true
});

const boundaryInputGood = {
  purpose: 'signal_input_boundary',
  wallet_observation: wOk,
  token_observation: tOk,
  relationship: rOk,
  diagnostics: dOk,
  intelligence_health: hOk
};

const walletLedInputGood = {
  purpose: 'wallet_led_signal_input',
  wallet_observation: wOk,
  relationship: rOk,
  diagnostics: dOk
};

const tokenActivityInputGood = {
  purpose: 'token_activity_signal_input',
  token_observation: tOk,
  relationship: rOk,
  diagnostics: dOk
};

// ---------------------------------------------------------------------------
// shared assertion helpers
// ---------------------------------------------------------------------------

const EXEC_FLAGS = [
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'can_send', 'can_broadcast', 'can_serialize', 'signing_permitted',
  'broadcast_permitted', 'is_live', 'mainnet_enabled', 'real_live'
];

function assertAllExecFlagsFalse(r) {
  for (const f of EXEC_FLAGS) assert.equal(r[f], false, `flag ${f} must be false`);
  assert.equal(r.read_only, true, 'read_only must be true');
}

function hostileThrowProxy() { return new Proxy({}, { get() { throw new Error('hostile-get'); } }); }
function hostileFnProxy() { return new Proxy({}, { get() { return () => {}; } }); }

const RAW_EVENT = mk('swap_observed', 'raw-1', 'w-1', 't-1'); // a normalized raw event: has event_type, NO *_state

// ===========================================================================
// (C) SIGNAL INPUT BOUNDARY  (C1..C16)
// ===========================================================================

test('C1 undefined -> SIGNAL_INPUT_UNCONFIGURED', () => {
  const r = evaluateSignalInputBoundary(undefined);
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_UNCONFIGURED');
  assert.equal(r.input_boundary_valid, false);
  assert.equal(r.eligible_for_candidate_signal, false);
});

test('C2 valid read-only intelligence -> SIGNAL_INPUT_VALID, boundary valid only', () => {
  const r = evaluateSignalInputBoundary(boundaryInputGood);
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_VALID');
  assert.equal(r.input_boundary_valid, true);
  assert.equal(r.eligible_for_candidate_signal, true);
  assertAllExecFlagsFalse(r); // VALID opens NO execution readiness
  assert.equal(r.advisory_only, true);
});

test('C3 invalid intelligence health (BLOCKED) -> fail-closed INVALID', () => {
  const hBlocked = evaluateIntelligenceHealth({ ...boundaryInputGood, can_send: true });
  assert.equal(hBlocked.intelligence_state, 'INTELLIGENCE_BLOCKED');
  const r = evaluateSignalInputBoundary({ ...boundaryInputGood, intelligence_health: hBlocked });
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID');
  assert.equal(r.eligible_for_candidate_signal, false);
});

test('C4 a component *_INVALID -> SIGNAL_INPUT_INVALID', () => {
  const r = evaluateSignalInputBoundary({ ...boundaryInputGood, wallet_observation: wInvalid });
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID');
});

test('C5 missing required component -> SIGNAL_INPUT_UNCONFIGURED', () => {
  const { intelligence_health, ...noHealth } = boundaryInputGood;
  void intelligence_health;
  const r = evaluateSignalInputBoundary(noHealth);
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_UNCONFIGURED');
});

test('C6 degraded component -> SIGNAL_INPUT_DEGRADED, not eligible', () => {
  const hDeg = evaluateIntelligenceHealth({ wallet_observation: wEmpty, token_observation: tOk, relationship: rOk, diagnostics: dOk });
  const r = evaluateSignalInputBoundary({ ...boundaryInputGood, wallet_observation: wEmpty, intelligence_health: hDeg });
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_DEGRADED');
  assert.equal(r.eligible_for_candidate_signal, false);
});

test('C7 raw ingestion event passed directly in a slot -> refused', () => {
  const r = evaluateSignalInputBoundary({ ...boundaryInputGood, wallet_observation: RAW_EVENT });
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID');
  assert.ok(r.reasons.includes('raw_ingestion_event_refused'));
});

test('C8 raw event as the WHOLE input -> refused (not a Stage-5 result)', () => {
  const r = evaluateSignalInputBoundary(RAW_EVENT);
  assert.notEqual(r.signal_input_state, 'SIGNAL_INPUT_VALID');
});

test('C9 smuggled risk/intent/route/trading flags -> refused', () => {
  for (const k of ['trading_ready', 'risk_ready', 'intent_ready', 'routing_ready', 'can_send']) {
    const r = evaluateSignalInputBoundary({ ...boundaryInputGood, [k]: true });
    assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID', `key ${k} must invalidate`);
    assert.equal(r[k], false, `smuggled ${k} must never surface true`);
  }
});

test('C10 execution command key -> refused', () => {
  const r = evaluateSignalInputBoundary({ ...boundaryInputGood, buy_opportunity: true });
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID');
});

test('C11 endpoint URL -> refused AND not echoed', () => {
  const r = evaluateSignalInputBoundary({ ...boundaryInputGood, endpoint_url: 'https://rpc.example' });
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID');
  assert.ok(!JSON.stringify(r).includes('rpc.example'));
});

test('C12 api_key/secret/token -> refused AND not echoed', () => {
  for (const k of ['api_key', 'secret', 'auth_token']) {
    const r = evaluateSignalInputBoundary({ ...boundaryInputGood, [k]: 'SECRET123' });
    assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID', `key ${k} must invalidate`);
    assert.ok(!JSON.stringify(r).includes('SECRET123'), `secret via ${k} must not be echoed`);
  }
});

test('C13 mainnet / REAL-LIVE marker -> refused', () => {
  const r = evaluateSignalInputBoundary({ ...boundaryInputGood, network: 'mainnet-beta' });
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID');
});

test('C14 hostile Proxy (throw + fn) -> frozen UNCONFIGURED, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSignalInputBoundary(p); });
    assert.equal(r.signal_input_state, 'SIGNAL_INPUT_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
    assertAllExecFlagsFalse(r);
  }
});

test('C15 wrong purpose -> INVALID', () => {
  const r = evaluateSignalInputBoundary({ ...boundaryInputGood, purpose: 'something_else' });
  assert.equal(r.signal_input_state, 'SIGNAL_INPUT_INVALID');
});

test('C16 all exec flags false + read_only across all states', () => {
  const hDeg = evaluateIntelligenceHealth({ wallet_observation: wEmpty, token_observation: tOk, relationship: rOk, diagnostics: dOk });
  const states = [
    evaluateSignalInputBoundary(undefined),
    evaluateSignalInputBoundary({ ...boundaryInputGood, can_send: true }),
    evaluateSignalInputBoundary({ ...boundaryInputGood, wallet_observation: wEmpty, intelligence_health: hDeg }),
    evaluateSignalInputBoundary(boundaryInputGood)
  ];
  const seen = new Set(states.map((s) => s.signal_input_state));
  assert.ok(seen.has('SIGNAL_INPUT_UNCONFIGURED'));
  assert.ok(seen.has('SIGNAL_INPUT_INVALID'));
  assert.ok(seen.has('SIGNAL_INPUT_DEGRADED'));
  assert.ok(seen.has('SIGNAL_INPUT_VALID'));
  for (const r of states) { assert.ok(Object.isFrozen(r)); assertAllExecFlagsFalse(r); }
});

// ===========================================================================
// (D) WALLET-LED CANDIDATE SIGNAL  (D1..D13)
// ===========================================================================

const WALLET_LED_ALLOWLIST = new Set([
  'wallet_activity_observed', 'wallet_token_relationship_observed',
  'repeat_interaction_observed', 'sufficient_observation_density',
  'insufficient_observations'
]);

test('D1 undefined -> WALLET_LED_UNCONFIGURED', () => {
  assert.equal(evaluateWalletLedCandidateSignal(undefined).candidate_signal_state, 'WALLET_LED_UNCONFIGURED');
});

test('D2 valid wallet observations -> WALLET_LED_CANDIDATE advisory only', () => {
  const r = evaluateWalletLedCandidateSignal(walletLedInputGood);
  assert.equal(r.candidate_signal_state, 'WALLET_LED_CANDIDATE');
  assert.equal(r.candidate_signal_valid, true);
  assert.equal(r.signal_kind, 'wallet_led_candidate');
  assert.equal(r.wallet_ref, 'w-1');
  assert.equal(r.advisory_only, true);
  assertAllExecFlagsFalse(r);
});

test('D3 candidate does NOT open trading/intent/routing/can_send', () => {
  const r = evaluateWalletLedCandidateSignal(walletLedInputGood);
  assert.equal(r.signal_ready, false);
  assert.equal(r.trading_ready, false);
  assert.equal(r.intent_ready, false);
  assert.equal(r.routing_ready, false);
  assert.equal(r.can_send, false);
});

test('D4 reason_codes all in allowlist; descriptive confidence_bucket', () => {
  const r = evaluateWalletLedCandidateSignal(walletLedInputGood);
  for (const c of r.reason_codes) assert.ok(WALLET_LED_ALLOWLIST.has(c), `reason ${c} allowlisted`);
  assert.ok(r.reason_codes.includes('wallet_activity_observed'));
  assert.ok(['none', 'low', 'medium', 'high'].includes(r.confidence_bucket));
});

test('D5 insufficient observations (empty wallet) -> WALLET_LED_SUPPRESSED', () => {
  const r = evaluateWalletLedCandidateSignal({ purpose: 'wallet_led_signal_input', wallet_observation: wEmpty });
  assert.equal(r.candidate_signal_state, 'WALLET_LED_SUPPRESSED');
  assert.equal(r.candidate_signal_valid, false);
  assert.deepEqual([...r.reason_codes], ['insufficient_observations']);
  assert.equal(r.confidence_bucket, 'none');
});

test('D6 relationship adds relationship/repeat reason codes', () => {
  const r = evaluateWalletLedCandidateSignal(walletLedInputGood);
  assert.ok(r.reason_codes.includes('wallet_token_relationship_observed'));
  assert.ok(r.reason_codes.includes('repeat_interaction_observed')); // rOk has 2 events
  assert.equal(r.token_ref, 't-1');
});

test('D7 smuggled buy/sell/copy/execute/order key -> WALLET_LED_INVALID', () => {
  for (const k of ['buy', 'sell', 'copy_signal', 'execute', 'order']) {
    const r = evaluateWalletLedCandidateSignal({ ...walletLedInputGood, [k]: true });
    assert.equal(r.candidate_signal_state, 'WALLET_LED_INVALID', `key ${k} must invalidate`);
    assert.equal(r.candidate_signal_valid, false);
  }
});

test('D8 smuggled forbidden flag -> WALLET_LED_INVALID', () => {
  const r = evaluateWalletLedCandidateSignal({ ...walletLedInputGood, trading_ready: true });
  assert.equal(r.candidate_signal_state, 'WALLET_LED_INVALID');
  assert.equal(r.trading_ready, false);
});

test('D9 secret/endpoint -> INVALID AND not echoed', () => {
  const rk = evaluateWalletLedCandidateSignal({ ...walletLedInputGood, api_key: 'SECRET123' });
  assert.equal(rk.candidate_signal_state, 'WALLET_LED_INVALID');
  assert.ok(!JSON.stringify(rk).includes('SECRET123'));
  const re = evaluateWalletLedCandidateSignal({ ...walletLedInputGood, endpoint_url: 'https://rpc.example' });
  assert.equal(re.candidate_signal_state, 'WALLET_LED_INVALID');
  assert.ok(!JSON.stringify(re).includes('rpc.example'));
});

test('D10 raw ingestion event in wallet slot -> refused', () => {
  const r = evaluateWalletLedCandidateSignal({ purpose: 'wallet_led_signal_input', wallet_observation: RAW_EVENT });
  assert.equal(r.candidate_signal_state, 'WALLET_LED_INVALID');
  assert.ok(r.reasons.includes('raw_ingestion_event_refused'));
});

test('D11 hostile Proxy -> frozen UNCONFIGURED, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateWalletLedCandidateSignal(p); });
    assert.equal(r.candidate_signal_state, 'WALLET_LED_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
    assertAllExecFlagsFalse(r);
  }
});

test('D12 confidence_bucket never a numeric/size field; no buy/sell/order fields', () => {
  const r = evaluateWalletLedCandidateSignal(walletLedInputGood);
  assert.equal(typeof r.confidence_bucket, 'string');
  for (const k of ['size', 'amount', 'slippage', 'stop_loss', 'buy', 'sell', 'order', 'price']) {
    assert.ok(!(k in r), `result must not carry ${k}`);
  }
});

test('D13 all exec flags false + read_only across all states', () => {
  const states = [
    evaluateWalletLedCandidateSignal(undefined),
    evaluateWalletLedCandidateSignal({ ...walletLedInputGood, buy: true }),
    evaluateWalletLedCandidateSignal({ purpose: 'wallet_led_signal_input', wallet_observation: wEmpty }),
    evaluateWalletLedCandidateSignal(walletLedInputGood)
  ];
  const seen = new Set(states.map((s) => s.candidate_signal_state));
  assert.ok(seen.has('WALLET_LED_UNCONFIGURED'));
  assert.ok(seen.has('WALLET_LED_INVALID'));
  assert.ok(seen.has('WALLET_LED_SUPPRESSED'));
  assert.ok(seen.has('WALLET_LED_CANDIDATE'));
  for (const r of states) { assert.ok(Object.isFrozen(r)); assertAllExecFlagsFalse(r); }
});

// ===========================================================================
// (E) TOKEN ACTIVITY CANDIDATE SIGNAL  (E1..E13)
// ===========================================================================

const TOKEN_ACTIVITY_ALLOWLIST = new Set([
  'token_activity_observed', 'pool_observed', 'mint_observed',
  'multi_wallet_activity_observed', 'insufficient_token_observations'
]);

test('E1 undefined -> TOKEN_ACTIVITY_UNCONFIGURED', () => {
  assert.equal(evaluateTokenActivityCandidateSignal(undefined).candidate_signal_state, 'TOKEN_ACTIVITY_UNCONFIGURED');
});

test('E2 valid token observations -> TOKEN_ACTIVITY_CANDIDATE advisory only', () => {
  const r = evaluateTokenActivityCandidateSignal(tokenActivityInputGood);
  assert.equal(r.candidate_signal_state, 'TOKEN_ACTIVITY_CANDIDATE');
  assert.equal(r.candidate_signal_valid, true);
  assert.equal(r.signal_kind, 'token_activity_candidate');
  assert.equal(r.token_ref, 't-1');
  assertAllExecFlagsFalse(r);
});

test('E3 mint/pool observation NEVER becomes opportunity execution', () => {
  const r = evaluateTokenActivityCandidateSignal(tokenActivityInputGood);
  assert.ok(r.reason_codes.includes('mint_observed'));
  assert.ok(r.reason_codes.includes('pool_observed'));
  assert.equal(r.signal_ready, false);
  assert.equal(r.trading_ready, false);
  assert.equal(r.can_send, false);
});

test('E4 reason_codes all in allowlist; multi-wallet detected', () => {
  const r = evaluateTokenActivityCandidateSignal(tokenActivityInputGood);
  for (const c of r.reason_codes) assert.ok(TOKEN_ACTIVITY_ALLOWLIST.has(c), `reason ${c} allowlisted`);
  assert.ok(r.reason_codes.includes('token_activity_observed'));
  assert.ok(r.reason_codes.includes('multi_wallet_activity_observed')); // tOk has 2 wallets
});

test('E5 accepted:true opens NO execution (ignored, not authority)', () => {
  const r = evaluateTokenActivityCandidateSignal({ ...tokenActivityInputGood, accepted: true });
  assert.equal(r.candidate_signal_state, 'TOKEN_ACTIVITY_CANDIDATE'); // still just a candidate
  assert.equal(r.candidate_signal_valid, true);
  assertAllExecFlagsFalse(r);
  assert.ok(!('accepted' in r), 'accepted must not surface in result');
});

test('E6 buy_opportunity -> TOKEN_ACTIVITY_INVALID', () => {
  const r = evaluateTokenActivityCandidateSignal({ ...tokenActivityInputGood, buy_opportunity: true });
  assert.equal(r.candidate_signal_state, 'TOKEN_ACTIVITY_INVALID');
});

test('E7 execute_opportunity -> TOKEN_ACTIVITY_INVALID', () => {
  const r = evaluateTokenActivityCandidateSignal({ ...tokenActivityInputGood, execute_opportunity: true });
  assert.equal(r.candidate_signal_state, 'TOKEN_ACTIVITY_INVALID');
});

test('E8 submit_opportunity -> TOKEN_ACTIVITY_INVALID', () => {
  const r = evaluateTokenActivityCandidateSignal({ ...tokenActivityInputGood, submit_opportunity: true });
  assert.equal(r.candidate_signal_state, 'TOKEN_ACTIVITY_INVALID');
});

test('E9 insufficient token observations -> TOKEN_ACTIVITY_SUPPRESSED', () => {
  const r = evaluateTokenActivityCandidateSignal({ purpose: 'token_activity_signal_input', token_observation: tEmpty });
  assert.equal(r.candidate_signal_state, 'TOKEN_ACTIVITY_SUPPRESSED');
  assert.deepEqual([...r.reason_codes], ['insufficient_token_observations']);
});

test('E10 secret/endpoint/mainnet -> INVALID AND not echoed', () => {
  const rk = evaluateTokenActivityCandidateSignal({ ...tokenActivityInputGood, api_key: 'SECRET123' });
  assert.equal(rk.candidate_signal_state, 'TOKEN_ACTIVITY_INVALID');
  assert.ok(!JSON.stringify(rk).includes('SECRET123'));
  const rm = evaluateTokenActivityCandidateSignal({ ...tokenActivityInputGood, network: 'mainnet-beta' });
  assert.equal(rm.candidate_signal_state, 'TOKEN_ACTIVITY_INVALID');
});

test('E11 raw ingestion event in token slot -> refused', () => {
  const r = evaluateTokenActivityCandidateSignal({ purpose: 'token_activity_signal_input', token_observation: RAW_EVENT });
  assert.equal(r.candidate_signal_state, 'TOKEN_ACTIVITY_INVALID');
  assert.ok(r.reasons.includes('raw_ingestion_event_refused'));
});

test('E12 hostile Proxy -> frozen UNCONFIGURED, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateTokenActivityCandidateSignal(p); });
    assert.equal(r.candidate_signal_state, 'TOKEN_ACTIVITY_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
    assertAllExecFlagsFalse(r);
  }
});

test('E13 all exec flags false + read_only across all states', () => {
  const states = [
    evaluateTokenActivityCandidateSignal(undefined),
    evaluateTokenActivityCandidateSignal({ ...tokenActivityInputGood, buy_opportunity: true }),
    evaluateTokenActivityCandidateSignal({ purpose: 'token_activity_signal_input', token_observation: tEmpty }),
    evaluateTokenActivityCandidateSignal(tokenActivityInputGood)
  ];
  const seen = new Set(states.map((s) => s.candidate_signal_state));
  assert.ok(seen.has('TOKEN_ACTIVITY_UNCONFIGURED'));
  assert.ok(seen.has('TOKEN_ACTIVITY_INVALID'));
  assert.ok(seen.has('TOKEN_ACTIVITY_SUPPRESSED'));
  assert.ok(seen.has('TOKEN_ACTIVITY_CANDIDATE'));
  for (const r of states) { assert.ok(Object.isFrozen(r)); assertAllExecFlagsFalse(r); }
});

// ===========================================================================
// DESCRIPTORS  (G1..G3)
// ===========================================================================

test('G1 signal-input-boundary descriptor frozen, read-only, no signal/trading', () => {
  const d = describeSignalInputBoundaryContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.advisory_only, true);
  assert.equal(d.signal_ready, false);
  assert.equal(d.trading_ready, false);
  assert.equal(d.input_boundary_valid, false);
  assert.equal(d.eligible_for_candidate_signal, false);
});

test('G2 wallet-led descriptor frozen, read-only, candidate not valid by default', () => {
  const d = describeWalletLedCandidateSignalContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.advisory_only, true);
  assert.equal(d.signal_ready, false);
  assert.equal(d.candidate_signal_valid, false);
  assert.equal(d.signal_kind, 'wallet_led_candidate');
});

test('G3 token-activity descriptor frozen, read-only, candidate not valid by default', () => {
  const d = describeTokenActivityCandidateSignalContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.advisory_only, true);
  assert.equal(d.trading_ready, false);
  assert.equal(d.candidate_signal_valid, false);
  assert.equal(d.signal_kind, 'token_activity_candidate');
});

// ===========================================================================
// STATIC SOURCE GUARDS  (S1..S4)
// ===========================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dir, '..', 'src', 'signal-engine-foundations.mjs');
const PKG = join(__dir, '..', 'package.json');

test('S1 src is import-free', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/^\s*import\s/m.test(src), 'no import statements');
  assert.ok(!/\bimport\s*\(/.test(src), 'no dynamic import()');
  assert.ok(!/\brequire\s*\(/.test(src), 'no require()');
});

test('S2 no network/clock/persistence primitives', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch(');
  assert.ok(!/new\s+WebSocket/.test(src), 'no new WebSocket');
  assert.ok(!/new\s+Connection/.test(src), 'no new Connection');
  assert.ok(!/sendTransaction/.test(src), 'no sendTransaction');
  assert.ok(!/process\.env/.test(src), 'no process.env');
  assert.ok(!/readFileSync/.test(src), 'no readFileSync');
  assert.ok(!/node:fs/.test(src), 'no node:fs');
  assert.ok(!/Date\.now/.test(src), 'no Date.now');
  assert.ok(!/new\s+Date/.test(src), 'no new Date');
});

test('S3 package.json has no dependencies', () => {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'no dependencies');
});

test('S4 no "can_send: true" literal anywhere in src', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/can_send\s*:\s*true/.test(src), 'no can_send: true literal');
  assert.ok(!/['"`]https?:\/\/[a-z0-9.-]+/i.test(src), 'no literal http(s) URL host');
  assert.ok(!/['"`]wss?:\/\/[a-z0-9.-]+/i.test(src), 'no literal ws(s) URL host');
});
