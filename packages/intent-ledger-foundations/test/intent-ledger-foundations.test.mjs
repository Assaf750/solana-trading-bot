// PR-S8-A test suite for @soltrade/intent-ledger-foundations
// node:test + node:assert/strict. Deterministic. Builds REAL Stage-7 risk
// results via the risk-engine-foundations evaluators (which consume REAL Stage-6
// signal outputs built from REAL Stage-5 intelligence built from REAL Stage-4
// normalized events) to feed the Stage-8 intent foundation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeIntentInputBoundaryContract,
  validateIntentInputBoundary,
  evaluateIntentInputBoundary,
  describeCandidateIntentRecordContract,
  validateCandidateIntentRecordInput,
  evaluateCandidateIntentRecord,
  describeIntentLedgerContract,
  validateIntentLedgerAppend,
  evaluateIntentLedgerAppend
} from '../src/index.mjs';

import {
  evaluateRiskInputBoundary,
  evaluateHardRiskGate,
  evaluateLiquidityExitRisk,
  evaluateExposureLimitRisk,
  evaluateRiskVerdict,
  evaluateRiskSuppression,
  evaluateRiskHealth
} from '../../risk-engine-foundations/src/index.mjs';

import {
  evaluateSignalInputBoundary,
  evaluateWalletLedCandidateSignal,
  evaluateTokenActivityCandidateSignal,
  evaluateCandidateSignalScore,
  evaluateSignalSuppression,
  evaluateSignalHealth
} from '../../signal-engine-foundations/src/index.mjs';

import {
  evaluateWalletObservationIntelligence,
  evaluateTokenObservationIntelligence,
  evaluateWalletTokenRelationship,
  evaluateWalletTokenDiagnostics,
  evaluateIntelligenceHealth
} from '../../wallet-token-intelligence-foundations/src/index.mjs';

import { normalizeIngestionEvent } from '../../data-ingestion-foundations/src/index.mjs';

// keep validate* imports referenced (contract surface) without affecting logic
void validateIntentInputBoundary;
void validateCandidateIntentRecordInput;
void validateIntentLedgerAppend;

// ---------------------------------------------------------------------------
// REAL Stage-4 -> Stage-5 -> Stage-6 -> Stage-7 builders
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

// Stage-5 intelligence
const wOk = evaluateWalletObservationIntelligence({
  purpose: 'wallet_observation_input', wallet_ref: 'w-1',
  events: [
    mk('wallet_transaction_observed', 'e1', 'w-1', 't-1'),
    mk('swap_observed', 'e2', 'w-1', 't-1'),
    mk('mint_observed', 'e3', 'w-1', 't-2')
  ],
  read_only: true
});
const tOk = evaluateTokenObservationIntelligence({
  purpose: 'token_observation_input', token_ref: 't-1',
  events: [
    mk('mint_observed', 'e1', 'w-1', 't-1'),
    mk('pool_observed', 'e2', 'w-2', 't-1'),
    mk('swap_observed', 'e3', 'w-1', 't-1')
  ],
  read_only: true
});
const rOk = evaluateWalletTokenRelationship({
  purpose: 'wallet_token_relationship_input', wallet_ref: 'w-1', token_ref: 't-1',
  events: [mk('swap_observed', 'e1', 'w-1', 't-1'), mk('swap_observed', 'e2', 'w-1', 't-1')],
  read_only: true
});
const dOk = evaluateWalletTokenDiagnostics({
  purpose: 'wallet_token_diagnostics_input',
  wallet_observation: wOk, token_observation: tOk, relationship: rOk
});
const hOk = evaluateIntelligenceHealth({
  wallet_observation: wOk, token_observation: tOk, relationship: rOk, diagnostics: dOk
});

// Stage-6 signal outputs (READY advisory path)
const sigBoundaryValid = evaluateSignalInputBoundary({
  purpose: 'signal_input_boundary',
  wallet_observation: wOk, token_observation: tOk,
  relationship: rOk, diagnostics: dOk, intelligence_health: hOk
});
const walletLed = evaluateWalletLedCandidateSignal({
  purpose: 'wallet_led_signal_input',
  wallet_observation: wOk, relationship: rOk, diagnostics: dOk
});
const tokenAct = evaluateTokenActivityCandidateSignal({
  purpose: 'token_activity_signal_input',
  token_observation: tOk, relationship: rOk, diagnostics: dOk
});
const sigScore = evaluateCandidateSignalScore({
  purpose: 'candidate_signal_score_input',
  candidate_signals: [walletLed, tokenAct], boundary: sigBoundaryValid
});
const sigSuppNotSuppressed = evaluateSignalSuppression({
  purpose: 'signal_suppression_input',
  candidate_signal: walletLed,
  wallet_observation: wOk, token_observation: tOk, relationship: rOk
});
const sigHealthReady = evaluateSignalHealth({
  signal_input_boundary: sigBoundaryValid,
  candidate_signals: [walletLed, tokenAct],
  score: sigScore, suppression: sigSuppNotSuppressed
});

// Stage-7 risk results (PASS advisory path)
const riskBoundaryValid = evaluateRiskInputBoundary({
  purpose: 'risk_input_boundary',
  signal_input_boundary: sigBoundaryValid,
  candidate_signal: walletLed,
  signal_score: sigScore,
  signal_suppression: sigSuppNotSuppressed,
  signal_health: sigHealthReady
});
const hardPass = evaluateHardRiskGate({
  purpose: 'hard_risk_input',
  candidate_signal: walletLed,
  risk_input_boundary: riskBoundaryValid,
  risk_factors: {
    honeypot_indicator: false, freeze_authority_indicator: false,
    mint_authority_indicator: false, owner_concentration_indicator: false,
    blacklist_indicator: false, unknown_token_metadata: false
  }
});
const hardBlocked = evaluateHardRiskGate({ purpose: 'hard_risk_input', risk_factors: { honeypot_indicator: true } });
const hardDegraded = evaluateHardRiskGate({ purpose: 'hard_risk_input', risk_factors: { unknown_token_metadata: true } });

const liqPass = evaluateLiquidityExitRisk({
  purpose: 'liquidity_exit_input',
  liquidity_observed_bucket: 'deep', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low'
});
const expPass = evaluateExposureLimitRisk({
  purpose: 'exposure_limit_input',
  exposure_bucket: 'within_limit', wallet_limit_state: 'ok', token_limit_state: 'ok'
});

const verdictPass = evaluateRiskVerdict({ purpose: 'risk_verdict_input', hard_risk: hardPass, liquidity_exit: liqPass, exposure: expPass });
const verdictBlocked = evaluateRiskVerdict({ purpose: 'risk_verdict_input', hard_risk: hardBlocked, liquidity_exit: liqPass, exposure: expPass });
const verdictDegraded = evaluateRiskVerdict({ purpose: 'risk_verdict_input', hard_risk: hardDegraded, liquidity_exit: liqPass, exposure: expPass });

const suppPass = evaluateRiskSuppression({ purpose: 'risk_suppression_input', risk_verdict: verdictPass });
const suppBlocked = evaluateRiskSuppression({ purpose: 'risk_suppression_input', risk_verdict: verdictBlocked });
const suppDegraded = evaluateRiskSuppression({ purpose: 'risk_suppression_input', risk_verdict: verdictDegraded });

function riskHealthBase(verdict, suppression) {
  return evaluateRiskHealth({
    risk_input_boundary: riskBoundaryValid,
    hard_risk: hardPass, liquidity_exit: liqPass, exposure: expPass,
    risk_verdict: verdict, risk_suppression: suppression
  });
}
const healthPass = riskHealthBase(verdictPass, suppPass);
const healthBlocked = evaluateRiskHealth({
  risk_input_boundary: riskBoundaryValid,
  hard_risk: hardBlocked, liquidity_exit: liqPass, exposure: expPass,
  risk_verdict: verdictBlocked, risk_suppression: suppBlocked
});
const healthDegradedSuppressed = evaluateRiskHealth({
  risk_input_boundary: riskBoundaryValid,
  hard_risk: hardDegraded, liquidity_exit: liqPass, exposure: expPass,
  risk_verdict: verdictDegraded, risk_suppression: suppDegraded
});

// sanity: confirm the real Stage-7 chain reached PASS advisory
test('preconditions: real Stage-7 chain reaches PASS advisory', () => {
  assert.equal(riskBoundaryValid.risk_input_state, 'RISK_INPUT_VALID');
  assert.equal(verdictPass.risk_verdict_state, 'RISK_PASS_ADVISORY');
  assert.equal(suppPass.suppressed, false);
  assert.equal(healthPass.risk_health_state, 'RISK_HEALTH_PASS_ADVISORY');
});

const goodIntentBoundaryInput = {
  purpose: 'intent_input_boundary',
  risk_input_boundary: riskBoundaryValid,
  hard_risk: hardPass,
  liquidity_exit: liqPass,
  exposure: expPass,
  risk_verdict: verdictPass,
  risk_suppression: suppPass,
  risk_health: healthPass
};

// ---------------------------------------------------------------------------
// Shared assertion helpers
// ---------------------------------------------------------------------------

const EXEC_FLAGS = [
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'route_ready', 'order_ready', 'transaction_ready', 'can_send', 'can_broadcast',
  'can_serialize', 'signing_permitted', 'broadcast_permitted', 'is_live',
  'mainnet_enabled', 'real_live'
];

function assertSafe(res) {
  assert.equal(Object.isFrozen(res), true);
  assert.equal(res.read_only, true);
  assert.equal(res.advisory_only, true);
  for (const f of EXEC_FLAGS) {
    assert.equal(res[f], false, `flag ${f} must be false`);
  }
}

function assertNoSecretEcho(res, secret) {
  const json = JSON.stringify(res);
  assert.equal(json.includes(secret), false, `secret ${secret} must not be echoed`);
}

const FORBIDDEN_OUTPUT_KEYS = [
  'order_id', 'route_id', 'transaction_id', 'serialized_tx', 'signature',
  'quote', 'jupiter_route', 'send', 'broadcast', 'private_key'
];
function assertNoExecutionFields(res) {
  for (const k of FORBIDDEN_OUTPUT_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(res, k), false, `output must not contain ${k}`);
  }
}

function throwingProxy() {
  return new Proxy({}, { get() { throw new Error('hostile'); } });
}
function fnAccessorProxy() {
  return new Proxy({}, { get() { return () => 'fn'; } });
}

// the recorded candidate intent used to feed (E)
const recordedCandidate = evaluateCandidateIntentRecord({
  purpose: 'candidate_intent_record_input',
  intent_input_boundary: evaluateIntentInputBoundary(goodIntentBoundaryInput),
  risk_verdict: verdictPass,
  signal_ref: 'sig-ref-1', wallet_ref: 'w-1', token_ref: 't-1',
  audit_ref: 'audit-1', record_ref: 'rec-1'
});

// ===========================================================================
// (C) INTENT INPUT BOUNDARY
// ===========================================================================

test('(C) descriptor: shape, states, safe flags, no exec authority', () => {
  const d = describeIntentInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'intent-input-boundary');
  assert.equal(d.intent_input_boundary_valid, false);
  assert.equal(d.eligible_for_candidate_intent, false);
  assert.deepEqual([...d.supported_states], [
    'INTENT_INPUT_UNCONFIGURED', 'INTENT_INPUT_INVALID', 'INTENT_INPUT_DEGRADED', 'INTENT_INPUT_VALID'
  ]);
});

test('(C) missing risk input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateIntentInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.intent_input_state, 'INTENT_INPUT_UNCONFIGURED');
    assert.equal(r.eligible_for_candidate_intent, false);
  }
  // empty object is recognized-but-invalid (no valid purpose)
  const empty = evaluateIntentInputBoundary({});
  assertSafe(empty);
  assert.equal(empty.intent_input_state, 'INTENT_INPUT_INVALID');
  assert.equal(empty.eligible_for_candidate_intent, false);
});

test('(C) missing required component -> UNCONFIGURED', () => {
  const r = evaluateIntentInputBoundary({
    purpose: 'intent_input_boundary', risk_verdict: verdictPass
  });
  assertSafe(r);
  assert.equal(r.intent_input_state, 'INTENT_INPUT_UNCONFIGURED');
});

test('(C) invalid risk health (BLOCKED) -> fail-closed INVALID', () => {
  assert.equal(healthBlocked.risk_health_state, 'RISK_HEALTH_BLOCKED');
  const r = evaluateIntentInputBoundary({
    purpose: 'intent_input_boundary',
    risk_verdict: verdictPass,
    risk_health: healthBlocked
  });
  assertSafe(r);
  assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
  assert.equal(r.valid, false);
});

test('(C) advisory risk pass -> boundary VALID, eligible only (no exec authority)', () => {
  const r = evaluateIntentInputBoundary(goodIntentBoundaryInput);
  assertSafe(r);
  assert.equal(r.intent_input_state, 'INTENT_INPUT_VALID');
  assert.equal(r.intent_input_boundary_valid, true);
  assert.equal(r.eligible_for_candidate_intent, true);
  // eligibility is NOT readiness
  assert.equal(r.intent_ready, false);
  assert.equal(r.route_ready, false);
  assert.equal(r.risk_ready, false);
});

test('(C) risk blocked -> not eligible (INVALID)', () => {
  const r = evaluateIntentInputBoundary({
    purpose: 'intent_input_boundary',
    risk_verdict: verdictBlocked, risk_health: healthBlocked
  });
  assertSafe(r);
  assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
  assert.equal(r.eligible_for_candidate_intent, false);
});

test('(C) risk degraded -> not eligible (DEGRADED)', () => {
  const r = evaluateIntentInputBoundary({
    purpose: 'intent_input_boundary',
    risk_verdict: verdictDegraded, risk_health: healthDegradedSuppressed
  });
  assertSafe(r);
  assert.equal(r.intent_input_state, 'INTENT_INPUT_DEGRADED');
  assert.equal(r.eligible_for_candidate_intent, false);
});

test('(C) raw Stage-6 signal passed directly -> refused', () => {
  const r = evaluateIntentInputBoundary({
    purpose: 'intent_input_boundary',
    risk_verdict: walletLed, // Stage-6 signal output, not a Stage-7 risk output
    risk_health: healthPass
  });
  assertSafe(r);
  assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
  assert.equal(r.reasons.includes('raw_non_risk_input_refused'), true);
});

test('(C) raw Stage-5 intelligence passed directly -> refused', () => {
  const r = evaluateIntentInputBoundary({
    purpose: 'intent_input_boundary',
    risk_verdict: wOk, // Stage-5 intelligence
    risk_health: healthPass
  });
  assertSafe(r);
  assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
  assert.equal(r.reasons.includes('raw_non_risk_input_refused'), true);
});

test('(C) raw Stage-4 ingestion event passed directly -> refused', () => {
  const rawEvent = mk('swap_observed', 'e1', 'w-1', 't-1');
  const r = evaluateIntentInputBoundary({
    purpose: 'intent_input_boundary',
    risk_verdict: rawEvent, risk_health: healthPass
  });
  assertSafe(r);
  assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
  assert.equal(r.reasons.includes('raw_non_risk_input_refused'), true);
});

test('(C) smuggled route/order/transaction/sign/send flags -> refused INVALID', () => {
  for (const smuggle of [
    { intent_ready: true }, { route_ready: true }, { order_ready: true },
    { transaction_ready: true }, { signing_permitted: true }, { can_send: true }
  ]) {
    const r = evaluateIntentInputBoundary({ ...goodIntentBoundaryInput, ...smuggle });
    assertSafe(r);
    assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
  }
});

test('(C) smuggled execution/route/order command keys -> refused INVALID', () => {
  for (const key of ['buy', 'execute', 'submit', 'send', 'route', 'plan_route', 'build_tx', 'serialize_tx', 'quote', 'jupiter_route', 'open_position']) {
    const r = evaluateIntentInputBoundary({ ...goodIntentBoundaryInput, [key]: true });
    assertSafe(r);
    assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
  }
});

test('(C) endpoint / API key / secret / token -> refused and never echoed', () => {
  const cases = [
    { api_key: 'sk-SECRET12345' },
    { auth_token: 'tok-SECRET98765' },
    { rpc_endpoint: 'https://example.com/SECRETPATH' },
    { ws: 'wss://SECRETHOST/feed' }
  ];
  for (const c of cases) {
    const r = evaluateIntentInputBoundary({ ...goodIntentBoundaryInput, ...c });
    assertSafe(r);
    assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
    for (const v of Object.values(c)) assertNoSecretEcho(r, v);
  }
});

test('(C) mainnet / REAL-LIVE markers -> refused', () => {
  for (const c of [{ network: 'mainnet-beta' }, { env: 'prod' }, { mainnet_enabled: true }, { real_live: true }]) {
    const r = evaluateIntentInputBoundary({ ...goodIntentBoundaryInput, ...c });
    assertSafe(r);
    assert.equal(r.intent_input_state, 'INTENT_INPUT_INVALID');
  }
});

test('(C) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of [throwingProxy(), fnAccessorProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateIntentInputBoundary(h); });
    assertSafe(r);
    assert.equal(r.intent_input_state, 'INTENT_INPUT_UNCONFIGURED');
  }
});

// ===========================================================================
// (D) CANDIDATE INTENT RECORD
// ===========================================================================

const validIntentBoundaryResult = evaluateIntentInputBoundary(goodIntentBoundaryInput);

function goodCandidateInput() {
  return {
    purpose: 'candidate_intent_record_input',
    intent_input_boundary: validIntentBoundaryResult,
    risk_verdict: verdictPass,
    signal_ref: 'sig-ref-1', wallet_ref: 'w-1', token_ref: 't-1',
    audit_ref: 'audit-1', record_ref: 'rec-1'
  };
}

test('(D) descriptor: shape, states, reason allowlist, no exec fields', () => {
  const d = describeCandidateIntentRecordContract();
  assertSafe(d);
  assert.equal(d.contract, 'candidate-intent-record');
  assert.equal(d.candidate_intent_valid, false);
  assert.equal(d.intent_kind, 'candidate_trade_intent');
  assertNoExecutionFields(d);
  assert.deepEqual([...d.supported_states], [
    'CANDIDATE_INTENT_UNCONFIGURED', 'CANDIDATE_INTENT_INVALID',
    'CANDIDATE_INTENT_REJECTED', 'CANDIDATE_INTENT_RECORDED'
  ]);
});

test('(D) missing input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 7]) {
    const r = evaluateCandidateIntentRecord(inp);
    assertSafe(r);
    assert.equal(r.candidate_intent_state, 'CANDIDATE_INTENT_UNCONFIGURED');
  }
  const empty = evaluateCandidateIntentRecord({});
  assertSafe(empty);
  assert.equal(empty.candidate_intent_state, 'CANDIDATE_INTENT_INVALID');
});

test('(D) risk not pass advisory -> no candidate intent (REJECTED)', () => {
  // blocked verdict + boundary not valid
  const blockedBoundary = evaluateIntentInputBoundary({
    purpose: 'intent_input_boundary', risk_verdict: verdictBlocked, risk_health: healthBlocked
  });
  const r = evaluateCandidateIntentRecord({
    purpose: 'candidate_intent_record_input',
    intent_input_boundary: blockedBoundary,
    risk_verdict: verdictBlocked,
    record_ref: 'rec-x'
  });
  assertSafe(r);
  assert.equal(r.candidate_intent_state, 'CANDIDATE_INTENT_REJECTED');
  assert.equal(r.candidate_intent_valid, false);
  assert.equal(r.reasons.includes('risk_not_pass_advisory'), true);
  assert.equal(r.reasons.includes('intent_input_not_valid'), true);
});

test('(D) boundary valid but verdict degraded -> REJECTED (risk_not_pass_advisory)', () => {
  const r = evaluateCandidateIntentRecord({
    purpose: 'candidate_intent_record_input',
    intent_input_boundary: validIntentBoundaryResult,
    risk_verdict: verdictDegraded,
    record_ref: 'rec-y'
  });
  assertSafe(r);
  assert.equal(r.candidate_intent_state, 'CANDIDATE_INTENT_REJECTED');
  assert.equal(r.reasons.includes('risk_not_pass_advisory'), true);
});

test('(D) valid risk pass -> candidate record only (no execution authority)', () => {
  const r = evaluateCandidateIntentRecord(goodCandidateInput());
  assertSafe(r);
  assert.equal(r.candidate_intent_state, 'CANDIDATE_INTENT_RECORDED');
  assert.equal(r.candidate_intent_valid, true);
  assert.equal(r.intent_kind, 'candidate_trade_intent');
  assert.equal(r.intent_record_ref, 'rec-1');
  assert.equal(r.wallet_ref, 'w-1');
  assert.equal(r.token_ref, 't-1');
  assert.equal(r.signal_ref, 'sig-ref-1');
  assert.equal(r.audit_required, true);
  assert.equal(r.reason_codes.includes('candidate_recorded'), true);
});

test('(D) candidate opens no route_ready/transaction_ready/signing/can_send', () => {
  const r = evaluateCandidateIntentRecord(goodCandidateInput());
  assertSafe(r);
  assert.equal(r.route_ready, false);
  assert.equal(r.transaction_ready, false);
  assert.equal(r.order_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.can_send, false);
  assert.equal(r.intent_ready, false);
});

test('(D) recorded candidate has NO order_id/route_id/transaction_id/serialized_tx/signature/quote', () => {
  const r = evaluateCandidateIntentRecord(goodCandidateInput());
  assertNoExecutionFields(r);
});

test('(D) smuggled order/route/tx/sign/send fields -> refused INVALID', () => {
  for (const smuggle of [
    { order_id: 'o-1' }, { route_id: 'r-1' }, { transaction_id: 'tx-1' },
    { serialized_tx: 'AABB' }, { signature: 'sig-z' }, { quote: 'q-1' },
    { jupiter_route: 'jr-1' }, { send: true }, { broadcast: true },
    { can_send: true }, { route: true }
  ]) {
    const r = evaluateCandidateIntentRecord({ ...goodCandidateInput(), ...smuggle });
    assertSafe(r);
    assert.equal(r.candidate_intent_state, 'CANDIDATE_INTENT_INVALID');
    assertNoExecutionFields(r);
  }
});

test('(D) endpoint / secret -> refused and never echoed', () => {
  const cases = [
    { api_key: 'sk-DSECRET' },
    { rpc_endpoint: 'https://host/DSECRETPATH' }
  ];
  for (const c of cases) {
    const r = evaluateCandidateIntentRecord({ ...goodCandidateInput(), ...c });
    assertSafe(r);
    assert.equal(r.candidate_intent_state, 'CANDIDATE_INTENT_INVALID');
    for (const v of Object.values(c)) assertNoSecretEcho(r, v);
  }
});

test('(D) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of [throwingProxy(), fnAccessorProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCandidateIntentRecord(h); });
    assertSafe(r);
    assert.equal(r.candidate_intent_state, 'CANDIDATE_INTENT_UNCONFIGURED');
  }
});

// ===========================================================================
// (E) INTENT LEDGER APPEND / EVALUATE
// ===========================================================================

test('(E) descriptor: shape, states, persistence false, safe flags', () => {
  const d = describeIntentLedgerContract();
  assertSafe(d);
  assert.equal(d.contract, 'intent-ledger-append');
  assert.equal(d.append_valid, false);
  assert.equal(d.persistence_performed, false);
  assert.deepEqual([...d.supported_states], [
    'INTENT_LEDGER_UNCONFIGURED', 'INTENT_LEDGER_INVALID',
    'INTENT_LEDGER_DUPLICATE', 'INTENT_LEDGER_APPEND_EVALUATED'
  ]);
});

test('(E) missing ledger input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 9]) {
    const r = evaluateIntentLedgerAppend(inp);
    assertSafe(r);
    assert.equal(r.ledger_state, 'INTENT_LEDGER_UNCONFIGURED');
  }
  // recognized object but missing previous_records/candidate -> UNCONFIGURED
  const r2 = evaluateIntentLedgerAppend({ purpose: 'intent_ledger_append_input' });
  assertSafe(r2);
  assert.equal(r2.ledger_state, 'INTENT_LEDGER_UNCONFIGURED');
});

test('(E) valid append -> evaluated in-memory only (persistence false)', () => {
  const r = evaluateIntentLedgerAppend({
    purpose: 'intent_ledger_append_input',
    previous_records: [{ intent_record_ref: 'rec-0' }],
    candidate_intent_record: recordedCandidate,
    append_ref: 'app-1'
  });
  assertSafe(r);
  assert.equal(r.ledger_state, 'INTENT_LEDGER_APPEND_EVALUATED');
  assert.equal(r.append_valid, true);
  assert.equal(r.ledger_record_count, 2); // 1 previous + 1 appended
  assert.equal(r.appended_record_ref, 'rec-1');
  assert.equal(r.duplicate_record_detected, false);
  assert.equal(r.persistence_performed, false);
  assert.equal(r.audit_required, true);
});

test('(E) empty previous_records -> count 1', () => {
  const r = evaluateIntentLedgerAppend({
    purpose: 'intent_ledger_append_input',
    previous_records: [],
    candidate_intent_record: recordedCandidate
  });
  assertSafe(r);
  assert.equal(r.ledger_state, 'INTENT_LEDGER_APPEND_EVALUATED');
  assert.equal(r.ledger_record_count, 1);
});

test('(E) duplicate record -> duplicate detected, append refused, count unchanged', () => {
  const r = evaluateIntentLedgerAppend({
    purpose: 'intent_ledger_append_input',
    previous_records: [{ intent_record_ref: 'rec-1' }, { intent_record_ref: 'rec-2' }],
    candidate_intent_record: recordedCandidate // intent_record_ref === 'rec-1'
  });
  assertSafe(r);
  assert.equal(r.ledger_state, 'INTENT_LEDGER_DUPLICATE');
  assert.equal(r.duplicate_record_detected, true);
  assert.equal(r.append_valid, false);
  assert.equal(r.ledger_record_count, 2); // unchanged
});

test('(E) invalid candidate intent -> append refused (INVALID)', () => {
  const rejected = evaluateCandidateIntentRecord({
    purpose: 'candidate_intent_record_input',
    intent_input_boundary: validIntentBoundaryResult,
    risk_verdict: verdictDegraded, record_ref: 'rec-r'
  });
  assert.equal(rejected.candidate_intent_state, 'CANDIDATE_INTENT_REJECTED');
  const r = evaluateIntentLedgerAppend({
    purpose: 'intent_ledger_append_input',
    previous_records: [],
    candidate_intent_record: rejected
  });
  assertSafe(r);
  assert.equal(r.ledger_state, 'INTENT_LEDGER_INVALID');
  assert.equal(r.append_valid, false);
});

test('(E) append opens no routing/signing/send/broadcast', () => {
  const r = evaluateIntentLedgerAppend({
    purpose: 'intent_ledger_append_input',
    previous_records: [],
    candidate_intent_record: recordedCandidate
  });
  assertSafe(r);
  assert.equal(r.routing_ready, false);
  assert.equal(r.route_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.broadcast_permitted, false);
});

test('(E) smuggled forbidden flag / exec cmd -> INVALID', () => {
  for (const smuggle of [{ can_send: true }, { send: true }, { broadcast: true }, { execute: true }]) {
    const r = evaluateIntentLedgerAppend({
      purpose: 'intent_ledger_append_input',
      previous_records: [], candidate_intent_record: recordedCandidate, ...smuggle
    });
    assertSafe(r);
    assert.equal(r.ledger_state, 'INTENT_LEDGER_INVALID');
  }
});

test('(E) PURE: same inputs -> same outputs, no accumulation across calls', () => {
  const input = {
    purpose: 'intent_ledger_append_input',
    previous_records: [{ intent_record_ref: 'rec-0' }],
    candidate_intent_record: recordedCandidate
  };
  const a = evaluateIntentLedgerAppend(input);
  const b = evaluateIntentLedgerAppend(input);
  assert.equal(a.ledger_record_count, 2);
  assert.equal(b.ledger_record_count, 2); // no module-level accumulation
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('(E) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of [throwingProxy(), fnAccessorProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateIntentLedgerAppend(h); });
    assertSafe(r);
    assert.equal(r.ledger_state, 'INTENT_LEDGER_UNCONFIGURED');
  }
});

// ===========================================================================
// STATIC SOURCE GUARD
// ===========================================================================

test('static guard: src has no "can_send: true" literal, is import-free, no mutable ledger array', () => {
  const files = [
    '../src/intent-ledger-foundations.mjs',
    '../src/index.mjs'
  ].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    if (f.endsWith('intent-ledger-foundations.mjs')) {
      // import-free implementation
      assert.equal(/^\s*import\s/m.test(src), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(src), false, 'implementation must not use require(');
      // no mutable module-level ledger array (e.g. `const ledger = []` / `let records = []`)
      assert.equal(/\b(const|let|var)\s+\w*(ledger|records|store)\w*\s*=\s*\[\s*\]/i.test(src), false,
        'implementation must hold no mutable module-level ledger array');
      // no network/clock/persistence primitives
      assert.equal(/fetch\s*\(|new\s+WebSocket|new\s+Connection|sendTransaction|\.sign\s*\(/.test(src), false, 'no network/sign primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env/.test(src), false, 'no clock/env');
    }
  }
});
