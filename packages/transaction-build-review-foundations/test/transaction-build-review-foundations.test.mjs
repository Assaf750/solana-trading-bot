// PR-S10-A test suite for @soltrade/transaction-build-review-foundations
// node:test + node:assert/strict. Deterministic. Builds a REAL Stage-4 -> 5 -> 6
// -> 7 -> 8 -> 9 chain (via the lower-stage evaluators) to an
// EXECUTION_PLAN_PREVIEW_PREVIEW_VALID + ROUTE_HEALTH_PREVIEW_READY state, then
// feeds the Stage-10 transaction-build-review foundation. Covers Stage-10 spec
// Parts C/D/E.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeTransactionBuildInputBoundaryContract,
  validateTransactionBuildInputBoundary,
  evaluateTransactionBuildInputBoundary,
  describeTransactionBuildSourceBoundaryContract,
  validateTransactionBuildSourceBoundary,
  evaluateTransactionBuildSourceBoundary,
  describeCandidateTransactionBuildDescriptorContract,
  validateCandidateTransactionBuildDescriptorInput,
  evaluateCandidateTransactionBuildDescriptor
} from '../src/index.mjs';

import {
  evaluateRouteInputBoundary,
  evaluateRouteSourceBoundary,
  evaluateCandidateRoutePlan,
  evaluateRouteFeasibility,
  evaluateExecutionPlanPreview,
  evaluateRouteSuppression,
  evaluateRouteHealth
} from '../../route-planning-foundations/src/index.mjs';

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
void validateTransactionBuildInputBoundary;
void validateTransactionBuildSourceBoundary;
void validateCandidateTransactionBuildDescriptorInput;

// ---------------------------------------------------------------------------
// REAL Stage-4 -> 5 -> 6 -> 7 -> 8 -> 9 builders
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
const intentNotSuppressed = Object.freeze({
  suppressed: false, suppression_reasons: [], read_only: true
});
const ledgerAppendOk = evaluateIntentLedgerAppend({
  purpose: 'intent_ledger_append_input', previous_records: [],
  candidate_intent_record: recordedCandidate, audit: intentAuditValid, record_ref: 'rec-1'
});
const intentStateAwaiting = evaluateIntentStateTransition({
  purpose: 'intent_state_input', candidate_intent_record: recordedCandidate,
  requested_transition: 'request_route_review'
});
void evaluateIntentSuppression;
const intentHealthAwaiting = evaluateIntentHealth({
  intent_input_boundary: intentBoundaryValid,
  candidate_intent_record: recordedCandidate,
  ledger_append: ledgerAppendOk,
  intent_state: intentStateAwaiting,
  audit: intentAuditValid,
  suppression: intentNotSuppressed
});

// Stage-9 route results (PREVIEW READY path)
const routeBoundaryValid = evaluateRouteInputBoundary({
  purpose: 'route_input_boundary',
  intent_input_boundary: intentBoundaryValid,
  candidate_intent_record: recordedCandidate,
  intent_ledger_append: ledgerAppendOk,
  intent_state: intentStateAwaiting,
  intent_audit: intentAuditValid,
  intent_suppression: intentNotSuppressed,
  intent_health: intentHealthAwaiting
});
const routeSourceValid = evaluateRouteSourceBoundary({
  purpose: 'route_source_boundary', route_source: 'fixture_route_metadata'
});
const candidateRouteValid = evaluateCandidateRoutePlan({
  purpose: 'candidate_route_plan_input',
  route_input_boundary: routeBoundaryValid,
  route_source_boundary: routeSourceValid,
  intent_record_ref: 'rec-1', route_plan_ref: 'plan-1',
  route_metadata: {
    input_asset_ref: 'asset-in', output_asset_ref: 'asset-out',
    route_hop_count_bucket: 'few', liquidity_bucket: 'deep',
    estimated_slippage_bucket: 'low', route_quality_bucket: 'good',
    requires_live_quote: false, no_transaction_build: true
  }
});
const routeFeasible = evaluateRouteFeasibility({
  purpose: 'route_feasibility_input',
  route_quality_bucket: 'good', estimated_slippage_bucket: 'low',
  liquidity_bucket: 'deep', hop_count_bucket: 'single'
});
const previewValid = evaluateExecutionPlanPreview({
  purpose: 'execution_plan_preview_input',
  candidate_route_plan: candidateRouteValid,
  route_feasibility: routeFeasible,
  preview_ref: 'preview-1',
  no_transaction_build: true, no_order: true, no_signing: true, no_send: true
});
const routeNotSuppressed = evaluateRouteSuppression({
  purpose: 'route_suppression_input',
  route_input_boundary: routeBoundaryValid,
  route_source_boundary: routeSourceValid,
  candidate_route_plan: candidateRouteValid,
  route_feasibility: routeFeasible
});
const routeHealthPreviewReady = evaluateRouteHealth({
  route_input_boundary: routeBoundaryValid,
  route_source_boundary: routeSourceValid,
  candidate_route_plan: candidateRouteValid,
  route_feasibility: routeFeasible,
  execution_plan_preview: previewValid,
  route_suppression: routeNotSuppressed
});

// sanity: confirm the real Stage-9 chain reached PREVIEW READY
test('preconditions: real Stage-9 chain reaches PREVIEW READY', () => {
  assert.equal(routeBoundaryValid.route_input_state, 'ROUTE_INPUT_VALID');
  assert.equal(routeSourceValid.route_source_state, 'ROUTE_SOURCE_READ_ONLY_OK');
  assert.equal(candidateRouteValid.candidate_route_state, 'CANDIDATE_ROUTE_CANDIDATE');
  assert.equal(routeFeasible.route_feasibility_state, 'ROUTE_FEASIBILITY_FEASIBLE_ADVISORY');
  assert.equal(previewValid.execution_plan_preview_state, 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID');
  assert.equal(routeNotSuppressed.suppressed, false);
  assert.equal(routeHealthPreviewReady.route_health_state, 'ROUTE_HEALTH_PREVIEW_READY');
});

const goodTxInput = () => ({
  purpose: 'tx_build_input_boundary',
  route_input_boundary: routeBoundaryValid,
  route_source_boundary: routeSourceValid,
  candidate_route_plan: candidateRouteValid,
  route_feasibility: routeFeasible,
  execution_plan_preview: previewValid,
  route_suppression: routeNotSuppressed,
  route_health: routeHealthPreviewReady
});

// ---------------------------------------------------------------------------
// Shared assertion helpers
// ---------------------------------------------------------------------------

const EXEC_FLAGS = [
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'can_send',
  'can_broadcast', 'can_serialize', 'signing_permitted', 'broadcast_permitted',
  'is_live', 'mainnet_enabled', 'real_live'
];

function assertSafe(res) {
  assert.equal(Object.isFrozen(res), true);
  assert.equal(res.read_only, true);
  assert.equal(res.advisory_only, true);
  for (const f of EXEC_FLAGS) {
    assert.equal(res[f], false, `flag ${f} must be false`);
  }
}

const TX_FORBIDDEN_OUTPUT_KEYS = [
  'transaction_id', 'transaction', 'transaction_object', 'VersionedTransaction',
  'TransactionMessage', 'MessageV0', 'serialized_tx', 'message_bytes', 'base64',
  'instruction_array', 'instructions', 'account_metas', 'recentBlockhash',
  'blockhash', 'feePayer', 'signature', 'signatures', 'signer', 'private_key',
  'broadcast_target', 'endpoint'
];

function assertNoTxArtifacts(res) {
  for (const k of TX_FORBIDDEN_OUTPUT_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(res, k), false, `output must not contain ${k}`);
  }
}

const hostiles = () => {
  const throwing = new Proxy({}, { get() { throw new Error('hostile'); } });
  const fnReturning = new Proxy({}, { get() { return () => true; } });
  return [throwing, fnReturning];
};

// ===========================================================================
// (C) TRANSACTION-BUILD INPUT BOUNDARY
// ===========================================================================

test('(C) descriptor: shape, states, safe flags, no exec authority', () => {
  const d = describeTransactionBuildInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'transaction-build-input-boundary');
  assert.equal(d.tx_build_input_boundary_valid, false);
  assert.equal(d.eligible_for_tx_build_review, false);
  assert.deepEqual([...d.supported_states], [
    'TX_BUILD_INPUT_UNCONFIGURED', 'TX_BUILD_INPUT_INVALID',
    'TX_BUILD_INPUT_DEGRADED', 'TX_BUILD_INPUT_VALID'
  ]);
});

test('(C) missing route input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateTransactionBuildInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_UNCONFIGURED');
    assert.equal(r.eligible_for_tx_build_review, false);
  }
  // missing required components (need execution_plan_preview + route_health)
  const r2 = evaluateTransactionBuildInputBoundary({
    purpose: 'tx_build_input_boundary',
    route_input_boundary: routeBoundaryValid,
    route_source_boundary: routeSourceValid
  });
  assertSafe(r2);
  assert.equal(r2.tx_build_input_state, 'TX_BUILD_INPUT_UNCONFIGURED');
});

test('(C) invalid route health (BLOCKED) -> fail-closed INVALID', () => {
  const blockedHealth = evaluateRouteHealth({
    route_input_boundary: routeBoundaryValid,
    route_source_boundary: routeSourceValid,
    candidate_route_plan: candidateRouteValid,
    route_feasibility: routeFeasible,
    execution_plan_preview: previewValid,
    route_suppression: routeNotSuppressed,
    can_send: true
  });
  assert.equal(blockedHealth.route_health_state, 'ROUTE_HEALTH_BLOCKED');
  const r = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), route_health: blockedHealth });
  assertSafe(r);
  assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
  assert.equal(r.eligible_for_tx_build_review, false);
});

test('(C) route suppressed -> not eligible (DEGRADED)', () => {
  const suppressed = Object.freeze({
    suppressed: true, suppression_reasons: ['route_feasibility_failed'], read_only: true
  });
  const r = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), route_suppression: suppressed });
  assertSafe(r);
  assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_DEGRADED');
  assert.equal(r.eligible_for_tx_build_review, false);
});

test('(C) preview not ready -> not eligible (DEGRADED)', () => {
  // execution plan preview REJECTED (a non-candidate route)
  const notReadyPreview = evaluateExecutionPlanPreview({
    purpose: 'execution_plan_preview_input',
    candidate_route_plan: evaluateCandidateRoutePlan({
      purpose: 'candidate_route_plan_input',
      route_input_boundary: routeBoundaryValid,
      route_source_boundary: routeSourceValid,
      route_metadata: {
        route_hop_count_bucket: 'few', liquidity_bucket: 'thin',
        estimated_slippage_bucket: 'low', route_quality_bucket: 'good',
        requires_live_quote: false, no_transaction_build: true
      }
    }),
    route_feasibility: routeFeasible,
    preview_ref: 'preview-x',
    no_transaction_build: true, no_order: true, no_signing: true, no_send: true
  });
  assert.notEqual(notReadyPreview.execution_plan_preview_state, 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID');
  // health derived from that preview is no longer PREVIEW_READY either
  const notReadyHealth = evaluateRouteHealth({
    route_input_boundary: routeBoundaryValid,
    route_source_boundary: routeSourceValid,
    candidate_route_plan: candidateRouteValid,
    route_feasibility: routeFeasible,
    execution_plan_preview: notReadyPreview,
    route_suppression: routeNotSuppressed
  });
  const r = evaluateTransactionBuildInputBoundary({
    ...goodTxInput(),
    execution_plan_preview: notReadyPreview,
    route_health: notReadyHealth
  });
  assertSafe(r);
  assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_DEGRADED');
  assert.equal(r.eligible_for_tx_build_review, false);
});

test('(C) PREVIEW_VALID + PREVIEW_READY -> boundary valid only (no readiness)', () => {
  const r = evaluateTransactionBuildInputBoundary(goodTxInput());
  assertSafe(r);
  assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_VALID');
  assert.equal(r.tx_build_input_boundary_valid, true);
  assert.equal(r.eligible_for_tx_build_review, true);
  // boundary valid does NOT open any readiness/execution flag (asserted by assertSafe)
});

test('(C) raw intent/risk/signal passed directly -> refused INVALID', () => {
  // raw Stage-8 intent state in a route slot
  const r1 = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), route_input_boundary: intentStateAwaiting });
  assertSafe(r1);
  assert.equal(r1.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
  assert.equal(r1.reasons.includes('raw_non_route_input_refused'), true);
  // raw Stage-7 risk verdict
  const r2 = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), route_feasibility: verdictPass });
  assert.equal(r2.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
  assert.equal(r2.reasons.includes('raw_non_route_input_refused'), true);
  // raw Stage-6 signal
  const r3 = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), route_health: sigScore });
  assert.equal(r3.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
  assert.equal(r3.reasons.includes('raw_non_route_input_refused'), true);
});

test('(C) raw intent/risk/signal object as whole input -> refused', () => {
  for (const raw of [intentStateAwaiting, verdictPass, sigScore, hOk, intentBoundaryValid]) {
    const r = evaluateTransactionBuildInputBoundary(raw);
    assertSafe(r);
    assert.notEqual(r.tx_build_input_state, 'TX_BUILD_INPUT_VALID');
  }
});

test('(C) smuggled tx/serialize/sign/send flags -> refused INVALID', () => {
  for (const smuggle of [
    { transaction_ready: true }, { serialized_ready: true }, { message_bytes_ready: true },
    { signing_permitted: true }, { can_send: true }, { can_serialize: true },
    { live_quote_enabled: true }, { real_live: true }
  ]) {
    const r = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), ...smuggle });
    assertSafe(r);
    assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
    assert.equal(r.eligible_for_tx_build_review, false);
  }
  // exec command keys
  for (const cmd of [{ serialize: true }, { sign: true }, { send: true }, { build_tx: true }, { broadcast: true }]) {
    const r = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), ...cmd });
    assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
  }
});

test('(C) endpoint / API key / secret / token -> refused & never echoed', () => {
  for (const s of [
    { rpc: 'https://api.mainnet-beta.solana.com' },
    { ws: 'wss://leak.example' },
    { api_key: 'sk-LEAK' },
    { secret: 'LEAK-SECRET' },
    { auth_token: 'LEAK-TOKEN' }
  ]) {
    const r = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), ...s });
    assertSafe(r);
    assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
    assert.equal(JSON.stringify(r).includes('mainnet-beta'), false);
  }
});

test('(C) mainnet / REAL-LIVE -> refused', () => {
  for (const s of [{ network: 'mainnet' }, { mode: 'prod' }, { real_live: true }]) {
    const r = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), ...s });
    assertSafe(r);
    assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
  }
});

test('(C) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateTransactionBuildInputBoundary(h); });
    assertSafe(r);
    assert.equal(r.tx_build_input_state, 'TX_BUILD_INPUT_UNCONFIGURED');
  }
});

// ===========================================================================
// (D) TRANSACTION BUILD SOURCE / BUILDER BOUNDARY
// ===========================================================================

test('(D) descriptor: shape, states, tags, safe flags', () => {
  const d = describeTransactionBuildSourceBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'transaction-build-source-boundary');
  assert.equal(d.tx_build_source_valid, false);
  assert.equal(d.builder_disabled, true);
  assert.equal(d.transaction_build_performed, false);
  assert.equal(d.serialization_performed, false);
  assert.deepEqual([...d.supported_states], [
    'TX_BUILD_SOURCE_UNCONFIGURED', 'TX_BUILD_SOURCE_INVALID', 'TX_BUILD_SOURCE_READ_ONLY_OK'
  ]);
  assert.deepEqual([...d.supported_source_tags], [
    'mock_tx_build_metadata', 'fixture_tx_build_metadata',
    'solana_tx_builder_disabled', 'jupiter_tx_builder_disabled', 'manual_tx_review_disabled'
  ]);
});

test('(D) missing source -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x', { purpose: 'tx_build_source_boundary' }]) {
    const r = evaluateTransactionBuildSourceBoundary(inp);
    assertSafe(r);
    assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_UNCONFIGURED');
    assert.equal(r.tx_build_source_valid, false);
  }
});

test('(D) unknown source -> fail-closed INVALID', () => {
  const r = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: 'solana_tx_builder_live' });
  assertSafe(r);
  assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_INVALID');
  assert.equal(r.tx_build_source_valid, false);
});

test('(D) mock/fixture -> valid read-only only', () => {
  for (const tag of ['mock_tx_build_metadata', 'fixture_tx_build_metadata', 'manual_tx_review_disabled']) {
    const r = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: tag });
    assertSafe(r);
    assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_READ_ONLY_OK');
    assert.equal(r.tx_build_source_valid, true);
    assert.equal(r.builder_disabled, true);
    assert.equal(r.transaction_build_performed, false);
    assert.equal(r.serialization_performed, false);
  }
});

test('(D) solana/jupiter builders accepted ONLY as disabled/read-only', () => {
  for (const tag of ['solana_tx_builder_disabled', 'jupiter_tx_builder_disabled']) {
    const r = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: tag });
    assertSafe(r);
    assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_READ_ONLY_OK');
    assert.equal(r.tx_build_source_valid, true);
    assert.equal(r.builder_disabled, true);
    assert.equal(r.transaction_build_performed, false);
    assert.equal(r.serialization_performed, false);
    assert.equal(r.network_call_made, false);
    assert.equal(r.endpoint_resolved, false);
  }
});

test('(D) endpoint URL field -> refused & never echoed', () => {
  for (const s of [{ endpoint: 'https://api.mainnet-beta.solana.com' }, { url: 'wss://leak.example' }]) {
    const r = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: 'solana_tx_builder_disabled', ...s });
    assertSafe(r);
    assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_INVALID');
    assert.equal(JSON.stringify(r).includes('mainnet-beta'), false);
    assert.equal(JSON.stringify(r).includes('leak'), false);
  }
});

test('(D) api_key / secret / token -> refused & never echoed', () => {
  for (const s of [{ api_key: 'sk-LEAK' }, { secret: 'LEAK' }, { auth_token: 'LEAK' }]) {
    const r = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: 'mock_tx_build_metadata', ...s });
    assertSafe(r);
    assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(D) smuggled build/serialize/sign/send flags -> refused', () => {
  for (const s of [{ transaction_ready: true }, { serialized_ready: true }, { signing_permitted: true }, { can_send: true }, { serialize: true }, { build_transaction: true }]) {
    const r = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: 'mock_tx_build_metadata', ...s });
    assertSafe(r);
    assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_INVALID');
  }
});

test('(D) mainnet / REAL-LIVE -> refused', () => {
  for (const s of [{ network: 'mainnet' }, { mode: 'prod' }, { real_live: true }]) {
    const r = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: 'mock_tx_build_metadata', ...s });
    assertSafe(r);
    assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_INVALID');
  }
});

test('(D) bad purpose -> refused', () => {
  const r = evaluateTransactionBuildSourceBoundary({ purpose: 'execute', tx_build_source: 'mock_tx_build_metadata' });
  assertSafe(r);
  assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_INVALID');
});

test('(D) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateTransactionBuildSourceBoundary(h); });
    assertSafe(r);
    assert.equal(r.tx_build_source_state, 'TX_BUILD_SOURCE_UNCONFIGURED');
  }
});

// ===========================================================================
// (E) CANDIDATE TRANSACTION BUILD DESCRIPTOR
// ===========================================================================

const validTxInputBoundary = evaluateTransactionBuildInputBoundary(goodTxInput());
const validTxSource = evaluateTransactionBuildSourceBoundary({
  purpose: 'tx_build_source_boundary', tx_build_source: 'fixture_tx_build_metadata'
});

const goodTxMetadata = () => ({
  account_count_bucket: 'medium',
  instruction_count_bucket: 'low',
  compute_unit_bucket: 'medium',
  transaction_size_bucket: 'medium',
  lookup_table_bucket: 'maybe_needed',
  priority_fee_bucket: 'medium',
  requires_serialization: false,
  requires_signing: false,
  requires_network: false
});

const goodDescriptorInput = (over = {}) => ({
  purpose: 'candidate_tx_build_descriptor_input',
  tx_build_input_boundary: validTxInputBoundary,
  tx_build_source_boundary: validTxSource,
  preview_ref: 'preview-1', route_plan_ref: 'plan-1',
  intent_record_ref: 'rec-1', tx_build_review_ref: 'txr-1',
  tx_build_metadata: goodTxMetadata(),
  ...over
});

test('(E) descriptor: shape, states, reason codes, safe flags', () => {
  const d = describeCandidateTransactionBuildDescriptorContract();
  assertSafe(d);
  assert.equal(d.contract, 'candidate-transaction-build-descriptor');
  assert.equal(d.candidate_tx_build_descriptor_valid, false);
  assert.equal(d.tx_build_kind, 'candidate_tx_build_descriptor');
  assertNoTxArtifacts(d);
  assert.deepEqual([...d.supported_states], [
    'CANDIDATE_TX_BUILD_UNCONFIGURED', 'CANDIDATE_TX_BUILD_INVALID',
    'CANDIDATE_TX_BUILD_REJECTED', 'CANDIDATE_TX_BUILD_DEGRADED',
    'CANDIDATE_TX_BUILD_DESCRIPTOR'
  ]);
});

test('(E) missing input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateCandidateTransactionBuildDescriptor(inp);
    assertSafe(r);
    assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_UNCONFIGURED');
    assert.equal(r.candidate_tx_build_descriptor_valid, false);
    assertNoTxArtifacts(r);
  }
  // missing tx_build_metadata component
  const r2 = evaluateCandidateTransactionBuildDescriptor({
    purpose: 'candidate_tx_build_descriptor_input',
    tx_build_input_boundary: validTxInputBoundary,
    tx_build_source_boundary: validTxSource
  });
  assert.equal(r2.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_UNCONFIGURED');
});

test('(E) invalid input boundary -> fail-closed REJECTED', () => {
  const badBoundary = evaluateTransactionBuildInputBoundary({ ...goodTxInput(), can_send: true });
  assert.equal(badBoundary.tx_build_input_state, 'TX_BUILD_INPUT_INVALID');
  const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput({ tx_build_input_boundary: badBoundary }));
  assertSafe(r);
  assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_REJECTED');
  assert.equal(r.tx_build_reason_codes.includes('tx_build_input_not_valid'), true);
  assertNoTxArtifacts(r);
});

test('(E) invalid source boundary -> fail-closed REJECTED', () => {
  const badSource = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: 'solana_tx_builder_live' });
  assert.equal(badSource.tx_build_source_state, 'TX_BUILD_SOURCE_INVALID');
  const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput({ tx_build_source_boundary: badSource }));
  assertSafe(r);
  assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_REJECTED');
  assert.equal(r.tx_build_reason_codes.includes('tx_build_source_not_valid'), true);
});

test('(E) valid fixture metadata -> descriptor only (no readiness, no artifacts)', () => {
  const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput());
  assertSafe(r);
  assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_DESCRIPTOR');
  assert.equal(r.candidate_tx_build_descriptor_valid, true);
  assert.equal(r.tx_build_kind, 'candidate_tx_build_descriptor');
  assert.equal(r.tx_build_review_ref, 'txr-1');
  assert.equal(r.preview_ref, 'preview-1');
  assert.equal(r.route_plan_ref, 'plan-1');
  assert.equal(r.intent_record_ref, 'rec-1');
  assert.equal(r.tx_build_reason_codes.includes('candidate_tx_build_reviewed'), true);
  assertNoTxArtifacts(r);
  // descriptor opens NO readiness/serialization/signing/send (asserted by assertSafe)
  assert.equal(r.transaction_ready, false);
  assert.equal(r.serialized_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.can_serialize, false);
  assert.equal(r.can_send, false);
});

test('(E) too_high accounts/instructions/compute / too_large size / required_unresolved lookup -> rejected', () => {
  const cases = [
    [{ account_count_bucket: 'too_high' }, 'account_count_high'],
    [{ instruction_count_bucket: 'too_high' }, 'instruction_count_high'],
    [{ compute_unit_bucket: 'too_high' }, 'compute_unit_high'],
    [{ transaction_size_bucket: 'too_large' }, 'transaction_size_large'],
    [{ lookup_table_bucket: 'required_unresolved' }, 'lookup_table_unresolved']
  ];
  for (const [over, code] of cases) {
    const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput({
      tx_build_metadata: { ...goodTxMetadata(), ...over }
    }));
    assertSafe(r);
    assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_REJECTED');
    assert.equal(r.tx_build_reason_codes.includes(code), true);
    assert.equal(r.candidate_tx_build_descriptor_valid, false);
    assertNoTxArtifacts(r);
  }
});

test('(E) unknown bucket -> degraded (no descriptor)', () => {
  const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput({
    tx_build_metadata: { ...goodTxMetadata(), compute_unit_bucket: 'unknown' }
  }));
  assertSafe(r);
  assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_DEGRADED');
  assert.equal(r.candidate_tx_build_descriptor_valid, false);
});

test('(E) metadata requiring serialization/signing/network -> INVALID', () => {
  for (const over of [
    { requires_serialization: true },
    { requires_signing: true },
    { requires_network: true }
  ]) {
    const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput({
      tx_build_metadata: { ...goodTxMetadata(), ...over }
    }));
    assertSafe(r);
    assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_INVALID');
    assertNoTxArtifacts(r);
  }
});

test('(E) smuggled tx/message/serialize/sign/send fields -> refused INVALID', () => {
  for (const smuggle of [
    { transaction: {} }, { transaction_id: 'x' }, { serialized_tx: 'x' },
    { message_bytes: 'x' }, { instruction_array: [] }, { instructions: [] },
    { signature: 'x' }, { blockhash: 'x' }, { feePayer: 'x' }, { signer: 'x' }
  ]) {
    const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput(smuggle));
    assertSafe(r);
    assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_INVALID');
    assertNoTxArtifacts(r);
  }
  // exec command keys
  for (const cmd of [{ serialize: true }, { sign: true }, { send: true }, { broadcast: true }]) {
    const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput(cmd));
    assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_INVALID');
  }
});

test('(E) endpoint / secret not echoed', () => {
  for (const s of [{ endpoint: 'https://api.mainnet-beta.solana.com' }, { api_key: 'sk-LEAK' }, { secret: 'LEAK' }]) {
    const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput(s));
    assertSafe(r);
    assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
    assert.equal(JSON.stringify(r).includes('mainnet-beta'), false);
    assertNoTxArtifacts(r);
  }
});

test('(E) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCandidateTransactionBuildDescriptor(h); });
    assertSafe(r);
    assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_UNCONFIGURED');
    assertNoTxArtifacts(r);
  }
});

test('(E) descriptor result has NO tx/serialization/signature/blockhash artifact field', () => {
  const r = evaluateCandidateTransactionBuildDescriptor(goodDescriptorInput());
  assert.equal(r.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_DESCRIPTOR');
  for (const k of TX_FORBIDDEN_OUTPUT_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(r, k), false, `output must not contain ${k}`);
  }
});

// ===========================================================================
// STATIC SOURCE GUARD
// ===========================================================================

test('static guard: src has no "can_send: true" literal, is import-free, no mutable module state', () => {
  const files = [
    '../src/transaction-build-review-foundations.mjs',
    '../src/index.mjs'
  ].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    if (f.endsWith('transaction-build-review-foundations.mjs')) {
      // import-free implementation
      assert.equal(/^\s*import\s/m.test(src), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(src), false, 'implementation must not use require(');
      // no mutable module-level array (e.g. `const store = []` / `let ledger = []`)
      assert.equal(/\b(const|let|var)\s+\w*(route|records|store|ledger|plan|tx|descriptor)\w*\s*=\s*\[\s*\]/i.test(src), false,
        'implementation must hold no mutable module-level array');
      // no network/clock/persistence primitives
      assert.equal(/fetch\s*\(|new\s+WebSocket|new\s+Connection|sendTransaction|\.sign\s*\(/.test(src), false, 'no network/sign primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env/.test(src), false, 'no clock/env');
    }
  }
});
