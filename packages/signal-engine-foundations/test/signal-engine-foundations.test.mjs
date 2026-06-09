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
  evaluateTokenActivityCandidateSignal,
  describeCandidateSignalScoringContract,
  evaluateCandidateSignalScore,
  describeSignalSuppressionContract,
  evaluateSignalSuppression,
  describeSignalHealthContract,
  evaluateSignalHealth
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
// PRIOR SIGNAL RESULTS (REAL Part C/D/E outputs over REAL Stage-5 intelligence)
// ===========================================================================

const walletLedCandidate = evaluateWalletLedCandidateSignal(walletLedInputGood);   // WALLET_LED_CANDIDATE
const tokenActivityCandidate = evaluateTokenActivityCandidateSignal(tokenActivityInputGood); // TOKEN_ACTIVITY_CANDIDATE
const boundaryValid = evaluateSignalInputBoundary(boundaryInputGood);              // SIGNAL_INPUT_VALID
const walletLedSuppressed = evaluateWalletLedCandidateSignal({ purpose: 'wallet_led_signal_input', wallet_observation: wEmpty }); // WALLET_LED_SUPPRESSED

// sanity: the prior results are what we expect
test('PRIOR sanity: candidate / boundary / suppressed states', () => {
  assert.equal(walletLedCandidate.candidate_signal_state, 'WALLET_LED_CANDIDATE');
  assert.equal(tokenActivityCandidate.candidate_signal_state, 'TOKEN_ACTIVITY_CANDIDATE');
  assert.equal(boundaryValid.signal_input_state, 'SIGNAL_INPUT_VALID');
  assert.equal(walletLedSuppressed.candidate_signal_state, 'WALLET_LED_SUPPRESSED');
});

// ===========================================================================
// (F) CANDIDATE SIGNAL SCORING / EXPLANATION  (F1..F12)
// ===========================================================================

const EXPLANATION_ALLOWLIST = new Set([
  'wallet_led_candidate_present', 'token_activity_candidate_present',
  'multiple_candidates_present', 'relationship_supported',
  'sufficient_observation_density', 'no_candidates_present'
]);
const SUPPRESSION_ALLOWLIST = new Set([
  'insufficient_observations', 'missing_wallet_context', 'missing_token_context',
  'relationship_not_observed', 'diagnostic_only', 'not_risk_checked',
  'not_intent_authorized', 'not_execution_authorized'
]);

test('F1 no candidate signals -> score_bucket none', () => {
  const r = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [] });
  assert.equal(r.score_bucket, 'none');
  assert.ok(r.explanation_codes.includes('no_candidates_present'));
  assertAllExecFlagsFalse(r);
});

test('F2 undefined / missing input -> UNCONFIGURED none', () => {
  const r = evaluateCandidateSignalScore(undefined);
  assert.equal(r.signal_score_state, 'SIGNAL_SCORE_UNCONFIGURED');
  assert.equal(r.score_bucket, 'none');
  assert.equal(r.score_valid, false);
});

test('F3 suppressed candidates only -> low/none + suppression_reasons', () => {
  const r = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedSuppressed] });
  assert.ok(['low', 'none'].includes(r.score_bucket));
  assert.equal(r.signal_score_state, 'SIGNAL_SCORE_SUPPRESSED');
  assert.ok(r.suppression_reasons.includes('insufficient_observations'));
  for (const c of r.suppression_reasons) assert.ok(SUPPRESSION_ALLOWLIST.has(c), `supp ${c} allowlisted`);
  assertAllExecFlagsFalse(r);
});

test('F4 valid multiple candidates -> a bucket only', () => {
  const r = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedCandidate, tokenActivityCandidate], boundary: boundaryValid });
  assert.equal(r.score_valid, true);
  assert.ok(['low', 'medium', 'high'].includes(r.score_bucket));
  assert.ok(r.explanation_codes.includes('multiple_candidates_present'));
  assert.ok(r.explanation_codes.includes('wallet_led_candidate_present'));
  assert.ok(r.explanation_codes.includes('token_activity_candidate_present'));
  for (const c of r.explanation_codes) assert.ok(EXPLANATION_ALLOWLIST.has(c), `expl ${c} allowlisted`);
});

test('F5 high bucket opens NO trading_ready/intent_ready/route/can_send', () => {
  // force a high bucket: >=2 valid candidates with a high confidence_bucket
  const denseWallet = evaluateWalletObservationIntelligence({
    purpose: 'wallet_observation_input', wallet_ref: 'w-1',
    events: Array.from({ length: 10 }, (_, i) => mk('swap_observed', 'e' + i, 'w-1', 't-1')), read_only: true
  });
  const denseToken = evaluateTokenObservationIntelligence({
    purpose: 'token_observation_input', token_ref: 't-1',
    events: Array.from({ length: 10 }, (_, i) => mk('swap_observed', 'e' + i, 'w-' + (i % 3), 't-1')), read_only: true
  });
  const wlDense = evaluateWalletLedCandidateSignal({ purpose: 'wallet_led_signal_input', wallet_observation: denseWallet, relationship: rOk });
  const taDense = evaluateTokenActivityCandidateSignal({ purpose: 'token_activity_signal_input', token_observation: denseToken, relationship: rOk });
  assert.equal(wlDense.confidence_bucket, 'high');
  const r = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [wlDense, taDense], boundary: boundaryValid });
  assert.equal(r.score_bucket, 'high');
  assert.equal(r.trading_ready, false);
  assert.equal(r.intent_ready, false);
  assert.equal(r.routing_ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.signal_ready, false);
  assertAllExecFlagsFalse(r);
});

test('F6 score result carries NO trade size/slippage/stop-loss/order field', () => {
  const r = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedCandidate], boundary: boundaryValid });
  for (const k of ['size', 'amount', 'slippage', 'stop_loss', 'order', 'price', 'quantity', 'lamports', 'sol']) {
    assert.ok(!(k in r), `score must not carry ${k}`);
  }
  assert.equal(typeof r.score_bucket, 'string');
});

test('F7 smuggled forbidden trading flag -> fail-closed INVALID, not echoed', () => {
  const r = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedCandidate], trading_ready: true });
  assert.equal(r.signal_score_state, 'SIGNAL_SCORE_INVALID');
  assert.equal(r.trading_ready, false);
  assert.equal(r.score_valid, false);
});

test('F8 smuggled exec key / secret -> INVALID, not echoed', () => {
  const rk = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedCandidate], buy_opportunity: true });
  assert.equal(rk.signal_score_state, 'SIGNAL_SCORE_INVALID');
  const rs = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedCandidate], api_key: 'SECRET123' });
  assert.equal(rs.signal_score_state, 'SIGNAL_SCORE_INVALID');
  assert.ok(!JSON.stringify(rs).includes('SECRET123'));
});

test('F9 candidate with smuggled forbidden flag -> fail-closed INVALID', () => {
  const hostileCandidate = { ...walletLedCandidate, trading_ready: true };
  const r = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [hostileCandidate] });
  assert.equal(r.signal_score_state, 'SIGNAL_SCORE_INVALID');
  assert.equal(r.trading_ready, false);
});

test('F10 wrong purpose -> INVALID', () => {
  const r = evaluateCandidateSignalScore({ purpose: 'nope', candidate_signals: [walletLedCandidate] });
  assert.equal(r.signal_score_state, 'SIGNAL_SCORE_INVALID');
});

test('F11 hostile Proxy -> frozen UNCONFIGURED, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCandidateSignalScore(p); });
    assert.equal(r.signal_score_state, 'SIGNAL_SCORE_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
    assertAllExecFlagsFalse(r);
  }
});

test('F12 single valid candidate -> low/medium bucket, descriptive only', () => {
  const r = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedCandidate], boundary: boundaryValid });
  assert.equal(r.score_valid, true);
  assert.ok(['low', 'medium'].includes(r.score_bucket));
  assert.ok(r.explanation_codes.includes('wallet_led_candidate_present'));
  assert.ok(Object.isFrozen(r));
});

// ===========================================================================
// (H... actually G) SIGNAL SUPPRESSION / REJECTION  (SU1..SU11)
// ===========================================================================

const SUPP_BASELINE = ['not_risk_checked', 'not_intent_authorized', 'not_execution_authorized'];

test('SU1 missing wallet context -> suppressed + missing_wallet_context', () => {
  const r = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: tokenActivityCandidate, token_observation: tOk });
  assert.equal(r.suppressed, true);
  assert.ok(r.suppression_reasons.includes('missing_wallet_context'));
});

test('SU2 missing token context -> suppressed + missing_token_context', () => {
  const r = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: walletLedCandidate, wallet_observation: wOk });
  assert.equal(r.suppressed, true);
  assert.ok(r.suppression_reasons.includes('missing_token_context'));
});

test('SU3 diagnostic-only input (no candidate) -> suppressed + diagnostic_only', () => {
  const r = evaluateSignalSuppression({ purpose: 'signal_suppression_input', wallet_observation: wOk, token_observation: tOk });
  assert.equal(r.suppressed, true);
  assert.ok(r.suppression_reasons.includes('diagnostic_only'));
});

test('SU4 no risk check -> suppressed (not_risk_checked always present when emitting)', () => {
  const r = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: walletLedSuppressed, wallet_observation: wEmpty });
  assert.equal(r.suppressed, true);
  for (const b of SUPP_BASELINE) assert.ok(r.suppression_reasons.includes(b), `${b} present`);
});

test('SU5 suppression opens NO risk_ready/intent_ready/trading_ready', () => {
  const r = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: walletLedSuppressed });
  assert.equal(r.risk_ready, false);
  assert.equal(r.intent_ready, false);
  assert.equal(r.trading_ready, false);
  assertAllExecFlagsFalse(r);
});

test('SU6 valid candidate + full context -> NOT_SUPPRESSED but baseline still present', () => {
  const r = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: walletLedCandidate, wallet_observation: wOk, token_observation: tOk, relationship: rOk });
  assert.equal(r.suppressed, false);
  assert.equal(r.signal_suppression_state, 'SIGNAL_SUPPRESSION_NOT_SUPPRESSED');
  for (const b of SUPP_BASELINE) assert.ok(r.suppression_reasons.includes(b), `${b} present`);
  assertAllExecFlagsFalse(r);
});

test('SU7 suppression_reasons all in allowlist', () => {
  const r = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: tokenActivityCandidate, token_observation: tOk });
  for (const c of r.suppression_reasons) assert.ok(SUPPRESSION_ALLOWLIST.has(c), `supp ${c} allowlisted`);
});

test('SU8 smuggled forbidden flag / secret / mainnet -> INVALID, not echoed, suppressed', () => {
  const rf = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: walletLedCandidate, trading_ready: true });
  assert.equal(rf.signal_suppression_state, 'SIGNAL_SUPPRESSION_INVALID');
  assert.equal(rf.suppressed, true);
  assert.equal(rf.trading_ready, false);
  const rs = evaluateSignalSuppression({ purpose: 'signal_suppression_input', api_key: 'SECRET123' });
  assert.ok(!JSON.stringify(rs).includes('SECRET123'));
  const rm = evaluateSignalSuppression({ purpose: 'signal_suppression_input', network: 'mainnet-beta' });
  assert.equal(rm.signal_suppression_state, 'SIGNAL_SUPPRESSION_INVALID');
});

test('SU9 candidate carrying a smuggled exec key -> INVALID', () => {
  const hostileCandidate = { ...tokenActivityCandidate, buy_opportunity: true };
  const r = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: hostileCandidate, token_observation: tOk });
  assert.equal(r.signal_suppression_state, 'SIGNAL_SUPPRESSION_INVALID');
});

test('SU10 hostile Proxy -> frozen, no throw, suppressed', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSignalSuppression(p); });
    assert.ok(Object.isFrozen(r));
    assert.equal(r.suppressed, true);
    assertAllExecFlagsFalse(r);
  }
});

test('SU11 undefined input -> suppressed UNCONFIGURED', () => {
  const r = evaluateSignalSuppression(undefined);
  assert.equal(r.signal_suppression_state, 'SIGNAL_SUPPRESSION_UNCONFIGURED');
  assert.equal(r.suppressed, true);
});

// ===========================================================================
// (H) SIGNAL HEALTH / STATUS  (HE1..HE12)
// ===========================================================================

const scoreDescribed = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedCandidate, tokenActivityCandidate], boundary: boundaryValid });
const suppNotSuppressed = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: walletLedCandidate, wallet_observation: wOk, token_observation: tOk, relationship: rOk });
const suppSuppressed = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: tokenActivityCandidate, token_observation: tOk });

test('HE1 missing components -> UNCONFIGURED', () => {
  const r = evaluateSignalHealth({ candidate_signals: [walletLedCandidate] });
  assert.equal(r.signal_state, 'SIGNAL_UNCONFIGURED');
});

test('HE2 undefined -> UNCONFIGURED', () => {
  assert.equal(evaluateSignalHealth(undefined).signal_state, 'SIGNAL_UNCONFIGURED');
});

test('HE3 invalid input boundary -> BLOCKED', () => {
  const boundaryInvalid = evaluateSignalInputBoundary({ ...boundaryInputGood, buy_opportunity: true });
  assert.equal(boundaryInvalid.signal_input_state, 'SIGNAL_INPUT_INVALID');
  const r = evaluateSignalHealth({ signal_input_boundary: boundaryInvalid, candidate_signals: [walletLedCandidate], score: scoreDescribed, suppression: suppNotSuppressed });
  assert.equal(r.signal_state, 'SIGNAL_BLOCKED');
  assert.equal(r.valid, false);
});

test('HE4 suppressed signals -> SUPPRESSED', () => {
  const r = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [tokenActivityCandidate], score: scoreDescribed, suppression: suppSuppressed });
  assert.equal(r.signal_state, 'SIGNAL_SUPPRESSED');
});

test('HE5 all candidates suppressed -> SUPPRESSED', () => {
  const r = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [walletLedSuppressed], score: scoreDescribed, suppression: suppNotSuppressed });
  assert.equal(r.signal_state, 'SIGNAL_SUPPRESSED');
});

test('HE6 valid candidates -> READY_ADVISORY advisory only', () => {
  const r = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [walletLedCandidate, tokenActivityCandidate], score: scoreDescribed, suppression: suppNotSuppressed });
  assert.equal(r.signal_state, 'SIGNAL_READY_ADVISORY');
  assert.equal(r.signal_ready_advisory, true);
  assert.equal(r.valid, true);
  assert.equal(r.advisory_only, true);
  // READY_ADVISORY is NOT trading/risk/intent/routing readiness
  assert.equal(r.signal_ready, false);
  assertAllExecFlagsFalse(r);
});

test('HE7 smuggled risk/intent/routing/trading flags (top-level) -> BLOCKED', () => {
  for (const k of ['trading_ready', 'risk_ready', 'intent_ready', 'routing_ready', 'can_send']) {
    const r = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [walletLedCandidate], score: scoreDescribed, suppression: suppNotSuppressed, [k]: true });
    assert.equal(r.signal_state, 'SIGNAL_BLOCKED', `key ${k} must block`);
    assert.equal(r[k], false, `smuggled ${k} must never surface true`);
  }
});

test('HE8 smuggled flag inside a component -> BLOCKED', () => {
  const hostileScore = { ...scoreDescribed, trading_ready: true };
  const r = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [walletLedCandidate], score: hostileScore, suppression: suppNotSuppressed });
  assert.equal(r.signal_state, 'SIGNAL_BLOCKED');
});

test('HE9 secret / mainnet / REAL-LIVE -> BLOCKED, not echoed', () => {
  const rs = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [walletLedCandidate], score: scoreDescribed, suppression: suppNotSuppressed, api_key: 'SECRET123' });
  assert.equal(rs.signal_state, 'SIGNAL_BLOCKED');
  assert.ok(!JSON.stringify(rs).includes('SECRET123'));
  const rm = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [walletLedCandidate], score: scoreDescribed, suppression: suppNotSuppressed, network: 'mainnet-beta' });
  assert.equal(rm.signal_state, 'SIGNAL_BLOCKED');
  const rl = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [walletLedCandidate], score: scoreDescribed, suppression: suppNotSuppressed, env: 'REAL-LIVE-prod' });
  assert.equal(rl.signal_state, 'SIGNAL_BLOCKED');
});

test('HE10 candidate carrying smuggled flag -> BLOCKED', () => {
  const hostileCandidate = { ...walletLedCandidate, can_send: true };
  const r = evaluateSignalHealth({ signal_input_boundary: boundaryValid, candidate_signals: [hostileCandidate], score: scoreDescribed, suppression: suppNotSuppressed });
  assert.equal(r.signal_state, 'SIGNAL_BLOCKED');
  assert.equal(r.can_send, false);
});

test('HE11 degraded (boundary not valid but recognized) -> DEGRADED', () => {
  const hDeg = evaluateIntelligenceHealth({ wallet_observation: wEmpty, token_observation: tOk, relationship: rOk, diagnostics: dOk });
  const boundaryDeg = evaluateSignalInputBoundary({ ...boundaryInputGood, wallet_observation: wEmpty, intelligence_health: hDeg });
  assert.equal(boundaryDeg.signal_input_state, 'SIGNAL_INPUT_DEGRADED');
  const r = evaluateSignalHealth({ signal_input_boundary: boundaryDeg, candidate_signals: [walletLedCandidate], score: scoreDescribed, suppression: suppNotSuppressed });
  assert.equal(r.signal_state, 'SIGNAL_DEGRADED');
});

test('HE12 hostile Proxy -> frozen UNCONFIGURED, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSignalHealth(p); });
    assert.equal(r.signal_state, 'SIGNAL_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
    assertAllExecFlagsFalse(r);
  }
});

// ===========================================================================
// DESCRIPTORS for F/G/H  (GD1..GD3)
// ===========================================================================

test('GD1 candidate-signal-scoring descriptor frozen, read-only, no exec', () => {
  const d = describeCandidateSignalScoringContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.advisory_only, true);
  assert.equal(d.signal_ready, false);
  assert.equal(d.trading_ready, false);
  assert.equal(d.score_valid, false);
  assert.equal(d.score_bucket, 'none');
});

test('GD2 signal-suppression descriptor frozen, read-only, not a risk engine', () => {
  const d = describeSignalSuppressionContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.advisory_only, true);
  assert.equal(d.risk_ready, false);
  assert.equal(d.intent_ready, false);
  assert.equal(d.suppressed, false);
});

test('GD3 signal-health descriptor frozen, read-only, advisory only', () => {
  const d = describeSignalHealthContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.advisory_only, true);
  assert.equal(d.signal_ready, false);
  assert.equal(d.signal_ready_advisory, false);
  assert.equal(d.signal_state, 'SIGNAL_UNCONFIGURED');
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
