// PR-S9-A test suite for @soltrade/route-planning-foundations
// node:test + node:assert/strict. Deterministic. Builds a REAL Stage-4 -> 5 -> 6
// -> 7 -> 8 chain (via the lower-stage evaluators) to an INTENT_AWAITING_ROUTE_
// REVIEW + INTENT_HEALTH_AWAITING_ROUTE_REVIEW state, then feeds the Stage-9
// route foundation. Covers Stage-9 spec Parts C/D/E.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeRouteInputBoundaryContract,
  validateRouteInputBoundary,
  evaluateRouteInputBoundary,
  describeRouteSourceBoundaryContract,
  validateRouteSourceBoundary,
  evaluateRouteSourceBoundary,
  describeCandidateRoutePlanContract,
  validateCandidateRoutePlanInput,
  evaluateCandidateRoutePlan
} from '../src/index.mjs';

import {
  evaluateIntentInputBoundary,
  evaluateCandidateIntentRecord,
  evaluateIntentLedgerAppend,
  evaluateIntentStateTransition,
  evaluateIntentAuditEnvelope,
  evaluateIntentSuppression,
  evaluateIntentHealth
} from '../../intent-ledger-foundations/src/index.mjs';

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
void validateRouteInputBoundary;
void validateRouteSourceBoundary;
void validateCandidateRoutePlanInput;

// ---------------------------------------------------------------------------
// REAL Stage-4 -> 5 -> 6 -> 7 -> 8 builders
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
const sigSupp = evaluateSignalSuppression({
  purpose: 'signal_suppression_input',
  candidate_signal: walletLed,
  wallet_observation: wOk, token_observation: tOk, relationship: rOk
});
const sigHealth = evaluateSignalHealth({
  signal_input_boundary: sigBoundaryValid,
  candidate_signals: [walletLed, tokenAct],
  score: sigScore, suppression: sigSupp
});

// Stage-7 risk results (PASS advisory path)
const riskBoundaryValid = evaluateRiskInputBoundary({
  purpose: 'risk_input_boundary',
  signal_input_boundary: sigBoundaryValid,
  candidate_signal: walletLed,
  signal_score: sigScore,
  signal_suppression: sigSupp,
  signal_health: sigHealth
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
const liqPass = evaluateLiquidityExitRisk({
  purpose: 'liquidity_exit_input',
  liquidity_observed_bucket: 'deep', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low'
});
const expPass = evaluateExposureLimitRisk({
  purpose: 'exposure_limit_input',
  exposure_bucket: 'within_limit', wallet_limit_state: 'ok', token_limit_state: 'ok'
});
const verdictPass = evaluateRiskVerdict({ purpose: 'risk_verdict_input', hard_risk: hardPass, liquidity_exit: liqPass, exposure: expPass });
const riskSuppPass = evaluateRiskSuppression({ purpose: 'risk_suppression_input', risk_verdict: verdictPass });
const riskHealthPass = evaluateRiskHealth({
  risk_input_boundary: riskBoundaryValid,
  hard_risk: hardPass, liquidity_exit: liqPass, exposure: expPass,
  risk_verdict: verdictPass, risk_suppression: riskSuppPass
});

// Stage-8 intent results (AWAITING ROUTE REVIEW path)
const intentBoundaryValid = evaluateIntentInputBoundary({
  purpose: 'intent_input_boundary',
  risk_input_boundary: riskBoundaryValid,
  hard_risk: hardPass,
  liquidity_exit: liqPass,
  exposure: expPass,
  risk_verdict: verdictPass,
  risk_suppression: riskSuppPass,
  risk_health: riskHealthPass
});
const recordedCandidate = evaluateCandidateIntentRecord({
  purpose: 'candidate_intent_record_input',
  intent_input_boundary: intentBoundaryValid,
  risk_verdict: verdictPass,
  signal_ref: 'sig-ref-1', wallet_ref: 'w-1', token_ref: 't-1',
  audit_ref: 'audit-1', record_ref: 'rec-1'
});
const intentAuditValid = evaluateIntentAuditEnvelope({
  purpose: 'intent_audit_envelope_input',
  reason_codes: ['risk_pass_advisory_confirmed', 'candidate_recorded'],
  decision_ref: 'dec-1',
  intent_record_ref: 'rec-1',
  actor_ref: 'actor-1'
});

// A recognized read-only intent-suppression RESULT reporting NOT suppressed.
// (evaluateIntentSuppression at the Stage-8 ledger layer ALWAYS reports
// suppressed:true — routing/sign/send is never authorized there; the route
// review happens here at Stage-9. The "not suppressed" shape is the legitimate
// awaiting-route-review companion, mirroring the intent-ledger health tests.)
const intentNotSuppressed = Object.freeze({
  suppressed: false, suppression_reasons: [], read_only: true
});
const intentSuppressedResult = Object.freeze({
  suppressed: true, suppression_reasons: ['route_not_reviewed'], read_only: true
});
const ledgerAppendOk = evaluateIntentLedgerAppend({
  purpose: 'intent_ledger_append_input', previous_records: [],
  candidate_intent_record: recordedCandidate, audit: intentAuditValid, record_ref: 'rec-1'
});
const intentStateAwaiting = evaluateIntentStateTransition({
  purpose: 'intent_state_input', candidate_intent_record: recordedCandidate,
  requested_transition: 'request_route_review'
});
const intentStateRecorded = evaluateIntentStateTransition({
  purpose: 'intent_state_input', candidate_intent_record: recordedCandidate
});
// keep the Stage-8 suppression evaluator referenced (contract surface)
void evaluateIntentSuppression;
const intentHealthAwaiting = evaluateIntentHealth({
  intent_input_boundary: intentBoundaryValid,
  candidate_intent_record: recordedCandidate,
  ledger_append: ledgerAppendOk,
  intent_state: intentStateAwaiting,
  audit: intentAuditValid,
  suppression: intentNotSuppressed
});
const intentHealthRecorded = evaluateIntentHealth({
  intent_input_boundary: intentBoundaryValid,
  candidate_intent_record: recordedCandidate,
  ledger_append: ledgerAppendOk,
  intent_state: intentStateRecorded,
  audit: intentAuditValid,
  suppression: intentNotSuppressed
});

// sanity: confirm the real Stage-8 chain reached AWAITING ROUTE REVIEW
test('preconditions: real Stage-8 chain reaches AWAITING ROUTE REVIEW', () => {
  assert.equal(intentBoundaryValid.intent_input_state, 'INTENT_INPUT_VALID');
  assert.equal(recordedCandidate.candidate_intent_state, 'CANDIDATE_INTENT_RECORDED');
  assert.equal(intentAuditValid.audit_state, 'INTENT_AUDIT_VALID');
  assert.equal(intentStateAwaiting.intent_state, 'INTENT_AWAITING_ROUTE_REVIEW');
  assert.equal(intentHealthAwaiting.intent_health_state, 'INTENT_HEALTH_AWAITING_ROUTE_REVIEW');
  assert.equal(intentNotSuppressed.suppressed, false);
});

const goodRouteInput = () => ({
  purpose: 'route_input_boundary',
  intent_input_boundary: intentBoundaryValid,
  candidate_intent_record: recordedCandidate,
  intent_ledger_append: ledgerAppendOk,
  intent_state: intentStateAwaiting,
  intent_audit: intentAuditValid,
  intent_suppression: intentNotSuppressed,
  intent_health: intentHealthAwaiting
});

// ---------------------------------------------------------------------------
// Shared assertion helpers
// ---------------------------------------------------------------------------

const EXEC_FLAGS = [
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'can_send', 'can_broadcast', 'can_serialize',
  'signing_permitted', 'broadcast_permitted', 'is_live', 'mainnet_enabled',
  'real_live'
];

function assertSafe(res) {
  assert.equal(Object.isFrozen(res), true);
  assert.equal(res.read_only, true);
  assert.equal(res.advisory_only, true);
  for (const f of EXEC_FLAGS) {
    assert.equal(res[f], false, `flag ${f} must be false`);
  }
}

function assertNoExecArtifacts(res) {
  const FORBIDDEN = [
    'order_id', 'transaction_id', 'serialized_tx', 'signature', 'private_key',
    'quote_response', 'jupiter_route_object', 'executable_instruction',
    'swap_instruction', 'compute_budget_instruction'
  ];
  for (const k of FORBIDDEN) {
    assert.equal(Object.prototype.hasOwnProperty.call(res, k), false, `output must not contain ${k}`);
  }
}

const hostiles = () => {
  const throwing = new Proxy({}, { get() { throw new Error('hostile'); } });
  const fnReturning = new Proxy({}, { get() { return () => true; } });
  return [throwing, fnReturning];
};

// ===========================================================================
// (C) ROUTE INPUT BOUNDARY
// ===========================================================================

test('(C) descriptor: shape, states, safe flags, no exec authority', () => {
  const d = describeRouteInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'route-input-boundary');
  assert.equal(d.route_input_boundary_valid, false);
  assert.equal(d.eligible_for_route_review, false);
  assert.deepEqual([...d.supported_states], [
    'ROUTE_INPUT_UNCONFIGURED', 'ROUTE_INPUT_INVALID', 'ROUTE_INPUT_DEGRADED', 'ROUTE_INPUT_VALID'
  ]);
});

test('(C) missing intent input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateRouteInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.route_input_state, 'ROUTE_INPUT_UNCONFIGURED');
    assert.equal(r.eligible_for_route_review, false);
  }
});

test('(C) invalid intent health (BLOCKED) -> fail-closed INVALID', () => {
  const blockedHealth = evaluateIntentHealth({
    intent_input_boundary: intentBoundaryValid,
    candidate_intent_record: recordedCandidate,
    ledger_append: ledgerAppendOk,
    intent_state: intentStateAwaiting,
    audit: intentAuditValid,
    suppression: intentNotSuppressed,
    can_send: true
  });
  assert.equal(blockedHealth.intent_health_state, 'INTENT_HEALTH_BLOCKED');
  const r = evaluateRouteInputBoundary({ ...goodRouteInput(), intent_health: blockedHealth });
  assertSafe(r);
  assert.equal(r.route_input_state, 'ROUTE_INPUT_INVALID');
  assert.equal(r.eligible_for_route_review, false);
});

test('(C) intent NOT awaiting route review -> not eligible (DEGRADED)', () => {
  const r = evaluateRouteInputBoundary({
    ...goodRouteInput(),
    intent_state: intentStateRecorded,
    intent_health: intentHealthRecorded
  });
  assertSafe(r);
  assert.equal(r.route_input_state, 'ROUTE_INPUT_DEGRADED');
  assert.equal(r.eligible_for_route_review, false);
});

test('(C) intent suppressed -> not eligible (DEGRADED)', () => {
  const suppressed = evaluateIntentSuppression({
    purpose: 'intent_suppression_input', candidate_intent_record: recordedCandidate,
    risk_verdict: verdictPass, audit: intentAuditValid
  });
  // an intent suppression result that reports suppressed:true
  void suppressed;
  const r = evaluateRouteInputBoundary({ ...goodRouteInput(), intent_suppression: intentSuppressedResult });
  assertSafe(r);
  assert.equal(r.route_input_state, 'ROUTE_INPUT_DEGRADED');
  assert.equal(r.eligible_for_route_review, false);
});

test('(C) valid awaiting route review -> boundary valid only (no readiness)', () => {
  const r = evaluateRouteInputBoundary(goodRouteInput());
  assertSafe(r);
  assert.equal(r.route_input_state, 'ROUTE_INPUT_VALID');
  assert.equal(r.route_input_boundary_valid, true);
  assert.equal(r.eligible_for_route_review, true);
  // boundary valid does NOT open any readiness/execution flag (asserted by assertSafe)
});

test('(C) raw risk/signal/intelligence passed directly -> refused INVALID', () => {
  // raw Stage-7 risk verdict in an intent slot
  const r1 = evaluateRouteInputBoundary({ ...goodRouteInput(), intent_state: verdictPass });
  assertSafe(r1);
  assert.equal(r1.route_input_state, 'ROUTE_INPUT_INVALID');
  assert.equal(r1.reasons.includes('raw_non_intent_input_refused'), true);
  // raw Stage-6 signal
  const r2 = evaluateRouteInputBoundary({ ...goodRouteInput(), intent_audit: sigScore });
  assert.equal(r2.route_input_state, 'ROUTE_INPUT_INVALID');
  assert.equal(r2.reasons.includes('raw_non_intent_input_refused'), true);
  // raw Stage-5 intelligence
  const r3 = evaluateRouteInputBoundary({ ...goodRouteInput(), intent_health: hOk });
  assert.equal(r3.route_input_state, 'ROUTE_INPUT_INVALID');
  assert.equal(r3.reasons.includes('raw_non_intent_input_refused'), true);
});

test('(C) raw risk/signal object as whole input -> refused', () => {
  for (const raw of [verdictPass, sigScore, hOk, riskBoundaryValid]) {
    const r = evaluateRouteInputBoundary(raw);
    assertSafe(r);
    assert.notEqual(r.route_input_state, 'ROUTE_INPUT_VALID');
  }
});

test('(C) smuggled order/transaction/sign/send flags -> refused INVALID', () => {
  for (const smuggle of [
    { route_ready: true }, { order_ready: true }, { transaction_ready: true },
    { signing_permitted: true }, { can_send: true }, { live_quote_enabled: true },
    { execute: true }, { swap: true }, { jupiter_route: 'x' }
  ]) {
    const r = evaluateRouteInputBoundary({ ...goodRouteInput(), ...smuggle });
    assertSafe(r);
    assert.equal(r.route_input_state, 'ROUTE_INPUT_INVALID');
    assert.equal(r.eligible_for_route_review, false);
  }
});

test('(C) endpoint / API key / secret / token -> refused & never echoed', () => {
  const secrets = [
    { rpc_url: 'https://api.mainnet-beta.solana.com' },
    { api_key: 'sk-LEAK-1' },
    { secret: 'TOPSECRET' },
    { auth_token: 'BEARER-LEAK' }
  ];
  for (const s of secrets) {
    const r = evaluateRouteInputBoundary({ ...goodRouteInput(), ...s });
    assertSafe(r);
    assert.equal(r.route_input_state, 'ROUTE_INPUT_INVALID');
    const blob = JSON.stringify(r);
    assert.equal(blob.includes('LEAK'), false);
    assert.equal(blob.includes('TOPSECRET'), false);
    assert.equal(blob.includes('api.mainnet-beta'), false);
  }
});

test('(C) mainnet / REAL-LIVE markers -> refused', () => {
  for (const s of [{ network: 'mainnet' }, { mode: 'prod' }, { real_live: true }, { mainnet_enabled: true }]) {
    const r = evaluateRouteInputBoundary({ ...goodRouteInput(), ...s });
    assertSafe(r);
    assert.equal(r.route_input_state, 'ROUTE_INPUT_INVALID');
  }
});

test('(C) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateRouteInputBoundary(h); });
    assertSafe(r);
    assert.equal(r.route_input_state, 'ROUTE_INPUT_UNCONFIGURED');
  }
});

// ===========================================================================
// (D) ROUTE SOURCE / PROVIDER BOUNDARY
// ===========================================================================

test('(D) descriptor: shape, states, safe flags', () => {
  const d = describeRouteSourceBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'route-source-boundary');
  assert.equal(d.route_source_valid, false);
  assert.equal(d.provider_disabled, true);
  assert.deepEqual([...d.supported_states], [
    'ROUTE_SOURCE_UNCONFIGURED', 'ROUTE_SOURCE_INVALID', 'ROUTE_SOURCE_READ_ONLY_OK'
  ]);
});

test('(D) missing source -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x', { purpose: 'route_source_boundary' }]) {
    const r = evaluateRouteSourceBoundary(inp);
    assertSafe(r);
    assert.equal(r.route_source_state, 'ROUTE_SOURCE_UNCONFIGURED');
    assert.equal(r.route_source_valid, false);
  }
});

test('(D) unknown source -> fail-closed INVALID', () => {
  const r = evaluateRouteSourceBoundary({ purpose: 'route_source_boundary', route_source: 'jupiter_live' });
  assertSafe(r);
  assert.equal(r.route_source_state, 'ROUTE_SOURCE_INVALID');
  assert.equal(r.route_source_valid, false);
});

test('(D) mock / fixture -> valid read-only only', () => {
  for (const tag of ['mock_route_metadata', 'fixture_route_metadata']) {
    const r = evaluateRouteSourceBoundary({ purpose: 'route_source_boundary', route_source: tag });
    assertSafe(r);
    assert.equal(r.route_source_state, 'ROUTE_SOURCE_READ_ONLY_OK');
    assert.equal(r.route_source_valid, true);
    assert.equal(r.provider_disabled, true);
    assert.equal(r.live_quote_enabled, false);
  }
});

test('(D) jupiter_disabled / aggregator_disabled accepted ONLY as disabled/read-only', () => {
  for (const tag of ['jupiter_disabled', 'aggregator_disabled', 'manual_route_review_disabled']) {
    const r = evaluateRouteSourceBoundary({ purpose: 'route_source_boundary', route_source: tag });
    assertSafe(r);
    assert.equal(r.route_source_state, 'ROUTE_SOURCE_READ_ONLY_OK');
    assert.equal(r.route_source_valid, true);
    assert.equal(r.provider_disabled, true);
    assert.equal(r.live_quote_enabled, false);
    assert.equal(r.network_call_made, false);
    assert.equal(r.endpoint_resolved, false);
  }
});

test('(D) endpoint URL field -> refused & never echoed', () => {
  const r = evaluateRouteSourceBoundary({
    purpose: 'route_source_boundary', route_source: 'jupiter_disabled',
    endpoint: 'https://quote-api.jup.ag/v6/quote'
  });
  assertSafe(r);
  assert.equal(r.route_source_state, 'ROUTE_SOURCE_INVALID');
  assert.equal(JSON.stringify(r).includes('jup.ag'), false);
});

test('(D) api_key / secret / token -> refused & never echoed', () => {
  for (const s of [{ api_key: 'sk-LEAK' }, { secret: 'TOPSECRET' }, { auth_token: 'BEARER-LEAK' }]) {
    const r = evaluateRouteSourceBoundary({ purpose: 'route_source_boundary', route_source: 'mock_route_metadata', ...s });
    assertSafe(r);
    assert.equal(r.route_source_state, 'ROUTE_SOURCE_INVALID');
    const blob = JSON.stringify(r);
    assert.equal(blob.includes('LEAK'), false);
    assert.equal(blob.includes('TOPSECRET'), false);
  }
});

test('(D) smuggled live_quote/network/route-execution flags -> refused', () => {
  for (const s of [{ live_quote_enabled: true }, { network_call_made: true }, { route_ready: true }, { route_execute: true }, { jupiter_route: 'x' }]) {
    const r = evaluateRouteSourceBoundary({ purpose: 'route_source_boundary', route_source: 'jupiter_disabled', ...s });
    assertSafe(r);
    assert.equal(r.route_source_state, 'ROUTE_SOURCE_INVALID');
  }
});

test('(D) mainnet / REAL-LIVE -> refused', () => {
  for (const s of [{ cluster: 'mainnet' }, { env: 'prod' }, { real_live: true }]) {
    const r = evaluateRouteSourceBoundary({ purpose: 'route_source_boundary', route_source: 'mock_route_metadata', ...s });
    assertSafe(r);
    assert.equal(r.route_source_state, 'ROUTE_SOURCE_INVALID');
  }
});

test('(D) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateRouteSourceBoundary(h); });
    assertSafe(r);
    assert.equal(r.route_source_state, 'ROUTE_SOURCE_UNCONFIGURED');
  }
});

// ===========================================================================
// (E) CANDIDATE ROUTE PLAN
// ===========================================================================

const validRouteBoundaryResult = evaluateRouteInputBoundary(goodRouteInput());
const validSourceResult = evaluateRouteSourceBoundary({
  purpose: 'route_source_boundary', route_source: 'fixture_route_metadata'
});

const goodMetadata = () => ({
  input_asset_ref: 'asset-in', output_asset_ref: 'asset-out',
  route_hop_count_bucket: 'few', liquidity_bucket: 'deep',
  estimated_slippage_bucket: 'low', route_quality_bucket: 'good',
  requires_live_quote: false, no_transaction_build: true
});

const goodPlanInput = (overrides = {}) => ({
  purpose: 'candidate_route_plan_input',
  route_input_boundary: validRouteBoundaryResult,
  route_source_boundary: validSourceResult,
  intent_record_ref: 'rec-1', route_plan_ref: 'plan-1',
  route_metadata: goodMetadata(),
  ...overrides
});

test('(E) descriptor: shape, states, reason codes, safe flags', () => {
  const d = describeCandidateRoutePlanContract();
  assertSafe(d);
  assert.equal(d.contract, 'candidate-route-plan');
  assert.equal(d.candidate_route_valid, false);
  assert.equal(d.route_kind, 'candidate_route_plan');
  assertNoExecArtifacts(d);
  assert.deepEqual([...d.supported_states], [
    'CANDIDATE_ROUTE_UNCONFIGURED', 'CANDIDATE_ROUTE_INVALID',
    'CANDIDATE_ROUTE_REJECTED', 'CANDIDATE_ROUTE_CANDIDATE'
  ]);
});

test('(E) missing input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateCandidateRoutePlan(inp);
    assertSafe(r);
    assert.equal(r.candidate_route_state, 'CANDIDATE_ROUTE_UNCONFIGURED');
    assert.equal(r.candidate_route_valid, false);
    assertNoExecArtifacts(r);
  }
  // missing route_metadata component
  const r2 = evaluateCandidateRoutePlan({
    purpose: 'candidate_route_plan_input',
    route_input_boundary: validRouteBoundaryResult,
    route_source_boundary: validSourceResult
  });
  assert.equal(r2.candidate_route_state, 'CANDIDATE_ROUTE_UNCONFIGURED');
});

test('(E) invalid route input boundary -> fail-closed REJECTED', () => {
  const notValidBoundary = evaluateRouteInputBoundary({
    ...goodRouteInput(), intent_state: intentStateRecorded, intent_health: intentHealthRecorded
  });
  assert.equal(notValidBoundary.route_input_state, 'ROUTE_INPUT_DEGRADED');
  const r = evaluateCandidateRoutePlan(goodPlanInput({ route_input_boundary: notValidBoundary }));
  assertSafe(r);
  assert.equal(r.candidate_route_state, 'CANDIDATE_ROUTE_REJECTED');
  assert.equal(r.route_reason_codes.includes('route_input_not_valid'), true);
  assertNoExecArtifacts(r);
});

test('(E) invalid route source boundary -> fail-closed REJECTED', () => {
  const badSource = evaluateRouteSourceBoundary({ purpose: 'route_source_boundary', route_source: 'jupiter_live' });
  assert.equal(badSource.route_source_state, 'ROUTE_SOURCE_INVALID');
  const r = evaluateCandidateRoutePlan(goodPlanInput({ route_source_boundary: badSource }));
  assertSafe(r);
  assert.equal(r.candidate_route_state, 'CANDIDATE_ROUTE_REJECTED');
  assert.equal(r.route_reason_codes.includes('route_source_not_valid'), true);
});

test('(E) valid fixture route metadata -> candidate route only (no readiness)', () => {
  const r = evaluateCandidateRoutePlan(goodPlanInput());
  assertSafe(r);
  assert.equal(r.candidate_route_state, 'CANDIDATE_ROUTE_CANDIDATE');
  assert.equal(r.candidate_route_valid, true);
  assert.equal(r.route_kind, 'candidate_route_plan');
  assert.equal(r.route_plan_ref, 'plan-1');
  assert.equal(r.intent_record_ref, 'rec-1');
  assert.equal(r.route_reason_codes.includes('candidate_route_reviewed'), true);
  // candidate opens NO transaction/signing/can_send (asserted by assertSafe)
  assert.equal(r.transaction_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.can_send, false);
  assert.equal(r.live_quote_enabled, false);
  assertNoExecArtifacts(r);
  // every reason code is from the allowlist
  const ALLOW = [
    'route_input_valid', 'route_source_valid', 'route_metadata_present',
    'route_hop_count_high', 'route_quality_poor', 'liquidity_thin',
    'slippage_high', 'candidate_route_reviewed', 'route_input_not_valid',
    'route_source_not_valid'
  ];
  for (const c of r.route_reason_codes) assert.equal(ALLOW.includes(c), true, `reason code ${c} not in allowlist`);
});

test('(E) high hop count / bad quality / thin liquidity / high slippage -> rejected (Fail-Safe)', () => {
  const cases = [
    [{ route_hop_count_bucket: 'many' }, 'route_hop_count_high'],
    [{ route_quality_bucket: 'poor' }, 'route_quality_poor'],
    [{ liquidity_bucket: 'thin' }, 'liquidity_thin'],
    [{ estimated_slippage_bucket: 'high' }, 'slippage_high']
  ];
  for (const [mdOver, code] of cases) {
    const r = evaluateCandidateRoutePlan(goodPlanInput({ route_metadata: { ...goodMetadata(), ...mdOver } }));
    assertSafe(r);
    assert.equal(r.candidate_route_state, 'CANDIDATE_ROUTE_REJECTED');
    assert.equal(r.candidate_route_valid, false);
    assert.equal(r.route_reason_codes.includes(code), true, `expected reason ${code}`);
    assertNoExecArtifacts(r);
  }
});

test('(E) route_metadata requiring live quote / transaction build -> INVALID', () => {
  const r1 = evaluateCandidateRoutePlan(goodPlanInput({ route_metadata: { ...goodMetadata(), requires_live_quote: true } }));
  assertSafe(r1);
  assert.equal(r1.candidate_route_state, 'CANDIDATE_ROUTE_INVALID');
  const r2 = evaluateCandidateRoutePlan(goodPlanInput({ route_metadata: { ...goodMetadata(), no_transaction_build: false } }));
  assert.equal(r2.candidate_route_state, 'CANDIDATE_ROUTE_INVALID');
});

test('(E) smuggled tx/sign/send/order fields -> refused INVALID & not echoed', () => {
  for (const smuggle of [
    { order_id: 'o-1' }, { transaction_id: 't-1' }, { serialized_tx: 'BASE64LEAK' },
    { signature: 'SIGLEAK' }, { swap_instruction: 'x' }, { compute_budget_instruction: 'x' },
    { jupiter_route_object: 'x' }, { quote_response: 'x' }, { send: true }, { broadcast: true },
    { can_send: true }, { route_ready: true }, { execute: true }
  ]) {
    const r = evaluateCandidateRoutePlan(goodPlanInput(smuggle));
    assertSafe(r);
    assert.equal(r.candidate_route_state, 'CANDIDATE_ROUTE_INVALID');
    assertNoExecArtifacts(r);
    const blob = JSON.stringify(r);
    assert.equal(blob.includes('LEAK'), false);
  }
});

test('(E) endpoint / secret in metadata -> refused & not echoed', () => {
  const r = evaluateCandidateRoutePlan(goodPlanInput({
    route_metadata: { ...goodMetadata(), rpc_url: 'https://api.mainnet-beta.solana.com', api_key: 'sk-LEAK' }
  }));
  assertSafe(r);
  assert.equal(r.candidate_route_state, 'CANDIDATE_ROUTE_INVALID');
  const blob = JSON.stringify(r);
  assert.equal(blob.includes('LEAK'), false);
  assert.equal(blob.includes('api.mainnet-beta'), false);
});

test('(E) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCandidateRoutePlan(h); });
    assertSafe(r);
    assert.equal(r.candidate_route_state, 'CANDIDATE_ROUTE_UNCONFIGURED');
    assertNoExecArtifacts(r);
  }
});

// ===========================================================================
// STATIC SOURCE GUARD
// ===========================================================================

test('static guard: src has no "can_send: true" literal, is import-free, no mutable module state', () => {
  const files = [
    '../src/route-planning-foundations.mjs',
    '../src/index.mjs'
  ].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    if (f.endsWith('route-planning-foundations.mjs')) {
      // import-free implementation
      assert.equal(/^\s*import\s/m.test(src), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(src), false, 'implementation must not use require(');
      // no mutable module-level array (e.g. `const routes = []` / `let store = []`)
      assert.equal(/\b(const|let|var)\s+\w*(route|records|store|ledger|plan)\w*\s*=\s*\[\s*\]/i.test(src), false,
        'implementation must hold no mutable module-level array');
      // no network/clock/persistence primitives
      assert.equal(/fetch\s*\(|new\s+WebSocket|new\s+Connection|sendTransaction|\.sign\s*\(/.test(src), false, 'no network/sign primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env/.test(src), false, 'no clock/env');
    }
  }
});
