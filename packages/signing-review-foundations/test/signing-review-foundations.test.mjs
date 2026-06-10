// PR-S11-A test suite for @soltrade/signing-review-foundations
// node:test + node:assert/strict. Deterministic. Builds a REAL Stage-4 -> 5 -> 6
// -> 7 -> 8 -> 9 -> 10 chain (via the lower-stage evaluators) to a
// TX_BUILD_REVIEW_PASS_ADVISORY + TX_BUILD_HEALTH_REVIEWED_ADVISORY state, then
// feeds the Stage-11 signing-review foundation. Covers Stage-11 spec Parts C/D/E.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeSigningReviewInputBoundaryContract,
  validateSigningReviewInputBoundary,
  evaluateSigningReviewInputBoundary,
  describeSignerCustodyBoundaryContract,
  validateSignerCustodyBoundary,
  evaluateSignerCustodyBoundary,
  describeCandidateSigningReviewDescriptorContract,
  validateCandidateSigningReviewDescriptorInput,
  evaluateCandidateSigningReviewDescriptor,
  describeSignerCustodyReadinessAdvisoryContract,
  validateSignerCustodyReadinessAdvisoryInput,
  evaluateSignerCustodyReadinessAdvisory,
  describePrivateKeyForbiddenSurfaceContract,
  evaluatePrivateKeyForbiddenSurface,
  describeSigningReviewVerdictContract,
  evaluateSigningReviewVerdict,
  describeSigningReviewSuppressionContract,
  evaluateSigningReviewSuppression,
  describeSigningReviewHealthContract,
  evaluateSigningReviewHealth
} from '../src/index.mjs';

import {
  evaluateTransactionBuildInputBoundary,
  evaluateTransactionBuildSourceBoundary,
  evaluateCandidateTransactionBuildDescriptor,
  evaluateTransactionBuildResourceAdvisory,
  evaluateSerializationForbiddenSurface,
  evaluateTransactionBuildReviewVerdict,
  evaluateTransactionBuildSuppression,
  evaluateTransactionBuildHealth
} from '../../transaction-build-review-foundations/src/index.mjs';

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
void validateSigningReviewInputBoundary;
void validateSignerCustodyBoundary;
void validateCandidateSigningReviewDescriptorInput;
void validateSignerCustodyReadinessAdvisoryInput;

// ---------------------------------------------------------------------------
// REAL Stage-4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 builders
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

// Stage-10 tx-build-review results (REVIEWED ADVISORY path)
const txInputBoundaryValid = evaluateTransactionBuildInputBoundary({
  purpose: 'tx_build_input_boundary',
  route_input_boundary: routeBoundaryValid,
  route_source_boundary: routeSourceValid,
  candidate_route_plan: candidateRouteValid,
  route_feasibility: routeFeasible,
  execution_plan_preview: previewValid,
  route_suppression: routeNotSuppressed,
  route_health: routeHealthPreviewReady
});
const txSourceValid = evaluateTransactionBuildSourceBoundary({
  purpose: 'tx_build_source_boundary', tx_build_source: 'fixture_tx_build_metadata'
});
const txMetadata = () => ({
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
const txDescriptor = evaluateCandidateTransactionBuildDescriptor({
  purpose: 'candidate_tx_build_descriptor_input',
  tx_build_input_boundary: txInputBoundaryValid,
  tx_build_source_boundary: txSourceValid,
  preview_ref: 'preview-1', route_plan_ref: 'plan-1',
  intent_record_ref: 'rec-1', tx_build_review_ref: 'txr-1',
  tx_build_metadata: txMetadata()
});
const txResourceAcceptable = evaluateTransactionBuildResourceAdvisory({
  purpose: 'tx_build_resource_advisory_input',
  account_count_bucket: 'medium',
  instruction_count_bucket: 'low',
  compute_unit_bucket: 'medium',
  transaction_size_bucket: 'medium',
  lookup_table_bucket: 'maybe_needed'
});
const txSerializationClean = evaluateSerializationForbiddenSurface({
  tx_build_kind: 'candidate_tx_build_descriptor', account_count_bucket: 'medium'
});
const txReviewVerdictPass = evaluateTransactionBuildReviewVerdict({
  purpose: 'tx_build_review_verdict_input',
  tx_build_input_boundary: txInputBoundaryValid,
  tx_build_source_boundary: txSourceValid,
  candidate_tx_build_descriptor: txDescriptor,
  tx_build_resource_advisory: txResourceAcceptable,
  serialization_surface: txSerializationClean
});
const txSuppressionNotSuppressed = Object.freeze({
  suppressed: false, suppression_reasons: [], read_only: true
});
const txHealthReviewed = evaluateTransactionBuildHealth({
  tx_build_input_boundary: txInputBoundaryValid,
  tx_build_source_boundary: txSourceValid,
  candidate_tx_build_descriptor: txDescriptor,
  tx_build_resource_advisory: txResourceAcceptable,
  serialization_surface: txSerializationClean,
  tx_build_review_verdict: txReviewVerdictPass,
  tx_build_suppression: txSuppressionNotSuppressed
});

// sanity: confirm the real Stage-10 chain reached REVIEWED ADVISORY
test('preconditions: real Stage-10 chain reaches REVIEWED ADVISORY', () => {
  assert.equal(txInputBoundaryValid.tx_build_input_state, 'TX_BUILD_INPUT_VALID');
  assert.equal(txSourceValid.tx_build_source_state, 'TX_BUILD_SOURCE_READ_ONLY_OK');
  assert.equal(txDescriptor.candidate_tx_build_state, 'CANDIDATE_TX_BUILD_DESCRIPTOR');
  assert.equal(txResourceAcceptable.tx_build_resource_state, 'TX_BUILD_RESOURCE_ACCEPTABLE_ADVISORY');
  assert.equal(txSerializationClean.serialization_surface_state, 'SERIALIZATION_SURFACE_CLEAN');
  assert.equal(txReviewVerdictPass.tx_build_review_state, 'TX_BUILD_REVIEW_PASS_ADVISORY');
  assert.equal(txHealthReviewed.tx_build_health_state, 'TX_BUILD_HEALTH_REVIEWED_ADVISORY');
});

const goodSigningInput = () => ({
  purpose: 'signing_review_input_boundary',
  tx_build_input_boundary: txInputBoundaryValid,
  tx_build_source_boundary: txSourceValid,
  candidate_tx_build_descriptor: txDescriptor,
  tx_build_resource_advisory: txResourceAcceptable,
  serialization_surface: txSerializationClean,
  tx_build_review_verdict: txReviewVerdictPass,
  tx_build_suppression: txSuppressionNotSuppressed,
  tx_build_health: txHealthReviewed
});

// ---------------------------------------------------------------------------
// Shared assertion helpers
// ---------------------------------------------------------------------------

const EXEC_FLAGS = [
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
];

function assertSafe(res) {
  assert.equal(Object.isFrozen(res), true);
  assert.equal(res.read_only, true);
  assert.equal(res.advisory_only, true);
  for (const f of EXEC_FLAGS) {
    assert.equal(res[f], false, `flag ${f} must be false`);
  }
}

const SIGN_FORBIDDEN_OUTPUT_KEYS = [
  'private_key', 'secret_key', 'secretKey', 'keypair', 'mnemonic', 'seed',
  'seed_phrase', 'raw_key', 'signing_key', 'signer_secret', 'signature',
  'signatures', 'signed_tx', 'signed_transaction', 'transaction', 'serialized_tx',
  'message_bytes', 'endpoint'
];

function assertNoSignArtifacts(res) {
  for (const k of SIGN_FORBIDDEN_OUTPUT_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(res, k), false, `output must not contain ${k}`);
  }
}

const hostiles = () => {
  const throwing = new Proxy({}, { get() { throw new Error('hostile'); } });
  const fnReturning = new Proxy({}, { get() { return () => true; } });
  return [throwing, fnReturning];
};

// ===========================================================================
// (C) SIGNING-REVIEW INPUT BOUNDARY
// ===========================================================================

test('(C) descriptor: shape, states, safe flags, no exec authority', () => {
  const d = describeSigningReviewInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'signing-review-input-boundary');
  assert.equal(d.signing_review_input_boundary_valid, false);
  assert.equal(d.eligible_for_signing_review, false);
  assert.deepEqual([...d.supported_states], [
    'SIGNING_REVIEW_INPUT_UNCONFIGURED', 'SIGNING_REVIEW_INPUT_INVALID',
    'SIGNING_REVIEW_INPUT_DEGRADED', 'SIGNING_REVIEW_INPUT_VALID'
  ]);
});

test('(C) missing tx-build input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSigningReviewInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_UNCONFIGURED');
    assert.equal(r.eligible_for_signing_review, false);
  }
  // missing required components (need tx_build_review_verdict + tx_build_health)
  const r2 = evaluateSigningReviewInputBoundary({
    purpose: 'signing_review_input_boundary',
    tx_build_input_boundary: txInputBoundaryValid,
    tx_build_source_boundary: txSourceValid
  });
  assertSafe(r2);
  assert.equal(r2.signing_review_input_state, 'SIGNING_REVIEW_INPUT_UNCONFIGURED');
});

test('(C) invalid tx-build health (BLOCKED) -> fail-closed INVALID', () => {
  const blockedHealth = evaluateTransactionBuildHealth({
    tx_build_input_boundary: txInputBoundaryValid,
    tx_build_source_boundary: txSourceValid,
    candidate_tx_build_descriptor: txDescriptor,
    tx_build_resource_advisory: txResourceAcceptable,
    serialization_surface: txSerializationClean,
    tx_build_review_verdict: txReviewVerdictPass,
    tx_build_suppression: txSuppressionNotSuppressed,
    can_send: true
  });
  assert.equal(blockedHealth.tx_build_health_state, 'TX_BUILD_HEALTH_BLOCKED');
  const r = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), tx_build_health: blockedHealth });
  assertSafe(r);
  assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_INVALID');
  assert.equal(r.eligible_for_signing_review, false);
});

test('(C) tx-build suppressed -> not eligible (DEGRADED)', () => {
  const suppressed = Object.freeze({
    suppressed: true, suppression_reasons: ['tx_build_resource_unacceptable'], read_only: true
  });
  const r = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), tx_build_suppression: suppressed });
  assertSafe(r);
  assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_DEGRADED');
  assert.equal(r.eligible_for_signing_review, false);
});

test('(C) review not PASS_ADVISORY -> not eligible (DEGRADED)', () => {
  const degradedVerdict = evaluateTransactionBuildReviewVerdict({
    purpose: 'tx_build_review_verdict_input',
    tx_build_input_boundary: txInputBoundaryValid,
    tx_build_source_boundary: txSourceValid,
    candidate_tx_build_descriptor: evaluateCandidateTransactionBuildDescriptor({
      purpose: 'candidate_tx_build_descriptor_input',
      tx_build_input_boundary: txInputBoundaryValid,
      tx_build_source_boundary: txSourceValid,
      tx_build_metadata: { ...txMetadata(), compute_unit_bucket: 'unknown' }
    }),
    tx_build_resource_advisory: txResourceAcceptable,
    serialization_surface: txSerializationClean
  });
  assert.equal(degradedVerdict.tx_build_review_state, 'TX_BUILD_REVIEW_DEGRADED');
  const r = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), tx_build_review_verdict: degradedVerdict });
  assertSafe(r);
  // health is still REVIEWED but verdict is not pass -> DEGRADED (fail-closed)
  assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_DEGRADED');
  assert.equal(r.eligible_for_signing_review, false);
});

test('(C) PASS_ADVISORY + REVIEWED_ADVISORY -> boundary valid only (no readiness)', () => {
  const r = evaluateSigningReviewInputBoundary(goodSigningInput());
  assertSafe(r);
  assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_VALID');
  assert.equal(r.signing_review_input_boundary_valid, true);
  assert.equal(r.eligible_for_signing_review, true);
  // eligible opens NO signing/serialization/send readiness
  assert.equal(r.signer_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.transaction_ready, false);
  assert.equal(r.can_send, false);
});

test('(C) raw route / earlier-stage passed directly -> refused', () => {
  // raw Stage-9 route output in a component slot
  const r1 = evaluateSigningReviewInputBoundary({
    ...goodSigningInput(), tx_build_review_verdict: routeHealthPreviewReady
  });
  assertSafe(r1);
  assert.equal(r1.signing_review_input_state, 'SIGNING_REVIEW_INPUT_INVALID');
  // raw Stage-8 intent
  const r2 = evaluateSigningReviewInputBoundary({
    ...goodSigningInput(), tx_build_health: intentHealthAwaiting
  });
  assert.equal(r2.signing_review_input_state, 'SIGNING_REVIEW_INPUT_INVALID');
  // raw Stage-4 ingestion event directly
  const rawEvent = mk('swap_observed', 'e1', 'w-1', 't-1');
  const r3 = evaluateSigningReviewInputBoundary({
    ...goodSigningInput(), candidate_tx_build_descriptor: { ...rawEvent, read_only: true }
  });
  assert.equal(r3.signing_review_input_state, 'SIGNING_REVIEW_INPUT_INVALID');
});

test('(C) smuggled sign/send/key flags -> refused INVALID', () => {
  for (const s of [{ can_send: true }, { signing_permitted: true }, { signer_ready: true },
    { send: true }, { sign: true }, { load_key: true }, { activate_signer: true }]) {
    const r = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), ...s });
    assertSafe(r);
    assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_INVALID');
  }
});

test('(C) endpoint / API key / secret / private_key / seed -> refused & never echoed', () => {
  for (const s of [
    { rpc_url: 'https://api.mainnet-beta.solana.com/LEAK' },
    { api_key: 'sk-LEAK-VALUE' },
    { secret: 'LEAK-VALUE' },
    { private_key: 'LEAK-VALUE' },
    { seed: 'LEAK-VALUE' }
  ]) {
    const r = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), ...s });
    assertSafe(r);
    assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(C) mainnet / REAL-LIVE -> refused', () => {
  for (const s of [{ network: 'mainnet' }, { mode: 'prod' }, { real_live: true }]) {
    const r = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), ...s });
    assertSafe(r);
    assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_INVALID');
  }
});

test('(C) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSigningReviewInputBoundary(h); });
    assertSafe(r);
    assert.equal(r.signing_review_input_state, 'SIGNING_REVIEW_INPUT_UNCONFIGURED');
  }
});

// ===========================================================================
// (D) SIGNER PROFILE / CUSTODY BOUNDARY
// ===========================================================================

test('(D) descriptor: shape, states, safe flags', () => {
  const d = describeSignerCustodyBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'signer-custody-boundary');
  assert.equal(d.signer_custody_boundary_valid, false);
  assert.equal(d.signer_disabled, true);
  assert.equal(d.signing_performed, false);
  assert.equal(d.key_loaded, false);
  assert.equal(d.key_material_present, false);
  assert.deepEqual([...d.supported_states], [
    'SIGNER_CUSTODY_UNCONFIGURED', 'SIGNER_CUSTODY_INVALID', 'SIGNER_CUSTODY_READ_ONLY_OK'
  ]);
});

test('(D) missing source -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSignerCustodyBoundary(inp);
    assertSafe(r);
    assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_UNCONFIGURED');
  }
  const r2 = evaluateSignerCustodyBoundary({ purpose: 'signer_custody_boundary' });
  assertSafe(r2);
  assert.equal(r2.signer_custody_state, 'SIGNER_CUSTODY_UNCONFIGURED');
});

test('(D) unknown source -> fail-closed INVALID', () => {
  for (const src of ['isolated_signer_live', 'connected_wallet_live', 'real_signer', 'unknown_thing']) {
    const r = evaluateSignerCustodyBoundary({ purpose: 'signer_custody_boundary', signer_source: src });
    assertSafe(r);
    assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_INVALID');
    assert.equal(r.signer_custody_boundary_valid, false);
  }
});

test('(D) mock/fixture -> valid read-only only', () => {
  for (const src of ['mock_signer_metadata', 'fixture_signer_metadata', 'manual_signing_review_disabled']) {
    const r = evaluateSignerCustodyBoundary({ purpose: 'signer_custody_boundary', signer_source: src });
    assertSafe(r);
    assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_READ_ONLY_OK');
    assert.equal(r.signer_custody_boundary_valid, true);
    assert.equal(r.signer_disabled, true);
    assert.equal(r.signing_performed, false);
    assert.equal(r.key_loaded, false);
    assert.equal(r.key_material_present, false);
  }
});

test('(D) isolated_signer_disabled & connected_wallet_disabled accepted ONLY as disabled/read-only', () => {
  for (const src of ['isolated_signer_disabled', 'connected_wallet_disabled']) {
    const r = evaluateSignerCustodyBoundary({ purpose: 'signer_custody_boundary', signer_source: src });
    assertSafe(r);
    assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_READ_ONLY_OK');
    assert.equal(r.signer_disabled, true);
    assert.equal(r.signing_performed, false);
    assert.equal(r.key_loaded, false);
    assert.equal(r.key_material_present, false);
    assert.equal(r.network_call_made, false);
    assert.equal(r.endpoint_resolved, false);
    // disabled markers NEVER open any readiness/signing flag
    assert.equal(r.signer_ready, false);
    assert.equal(r.signing_permitted, false);
  }
});

test('(D) endpoint URL field -> refused & never echoed', () => {
  const r = evaluateSignerCustodyBoundary({
    purpose: 'signer_custody_boundary', signer_source: 'mock_signer_metadata',
    rpc_url: 'https://signer.example.com/LEAK'
  });
  assertSafe(r);
  assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_INVALID');
  assert.equal(JSON.stringify(r).includes('LEAK'), false);
});

test('(D) api_key/secret/private_key/seed -> refused & never echoed', () => {
  for (const s of [{ api_key: 'sk-LEAK' }, { secret: 'LEAK' }, { private_key: 'LEAK' },
    { seed: 'LEAK' }, { mnemonic: 'LEAK' }, { keypair: 'LEAK' }]) {
    const r = evaluateSignerCustodyBoundary({
      purpose: 'signer_custody_boundary', signer_source: 'mock_signer_metadata', ...s
    });
    assertSafe(r);
    assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(D) smuggled sign/load/send flags -> refused', () => {
  for (const s of [{ signing_permitted: true }, { signer_ready: true }, { can_send: true },
    { sign: true }, { load_signer: true }, { activate_signer: true }]) {
    const r = evaluateSignerCustodyBoundary({
      purpose: 'signer_custody_boundary', signer_source: 'mock_signer_metadata', ...s
    });
    assertSafe(r);
    assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_INVALID');
  }
});

test('(D) mainnet / REAL-LIVE -> refused', () => {
  for (const s of [{ network: 'mainnet' }, { mode: 'prod' }, { real_live: true }]) {
    const r = evaluateSignerCustodyBoundary({
      purpose: 'signer_custody_boundary', signer_source: 'mock_signer_metadata', ...s
    });
    assertSafe(r);
    assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_INVALID');
  }
});

test('(D) bad purpose -> INVALID', () => {
  const r = evaluateSignerCustodyBoundary({ purpose: 'execute', signer_source: 'mock_signer_metadata' });
  assertSafe(r);
  assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_INVALID');
});

test('(D) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSignerCustodyBoundary(h); });
    assertSafe(r);
    assert.equal(r.signer_custody_state, 'SIGNER_CUSTODY_UNCONFIGURED');
  }
});

// ===========================================================================
// (E) CANDIDATE SIGNING-REVIEW DESCRIPTOR
// ===========================================================================

const validSigningBoundary = evaluateSigningReviewInputBoundary(goodSigningInput());
const validCustody = evaluateSignerCustodyBoundary({
  purpose: 'signer_custody_boundary', signer_source: 'isolated_signer_disabled'
});

const goodSignerMetadata = () => ({
  key_custody_mode_bucket: 'isolated_signer',
  signer_profile_status_bucket: 'active',
  dual_control_bucket: 'required_satisfied',
  signer_reachability_bucket: 'reachable',
  requires_key_material: false,
  requires_signing: false,
  requires_network: false
});

const goodDescriptorInput = (over = {}) => ({
  purpose: 'candidate_signing_review_descriptor_input',
  signing_review_input_boundary: validSigningBoundary,
  signer_custody_boundary: validCustody,
  tx_build_review_ref: 'txr-1', signing_review_ref: 'sr-1', intent_record_ref: 'rec-1',
  signer_metadata: goodSignerMetadata(),
  ...over
});

test('(E) descriptor: shape, states, reason codes, safe flags', () => {
  const d = describeCandidateSigningReviewDescriptorContract();
  assertSafe(d);
  assert.equal(d.contract, 'candidate-signing-review-descriptor');
  assert.equal(d.candidate_signing_review_valid, false);
  assert.equal(d.signing_review_kind, 'candidate_signing_review_descriptor');
  assertNoSignArtifacts(d);
  assert.deepEqual([...d.supported_states], [
    'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED', 'CANDIDATE_SIGNING_REVIEW_INVALID',
    'CANDIDATE_SIGNING_REVIEW_REJECTED', 'CANDIDATE_SIGNING_REVIEW_DEGRADED',
    'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR'
  ]);
});

test('(E) missing input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateCandidateSigningReviewDescriptor(inp);
    assertSafe(r);
    assert.equal(r.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED');
  }
  const r2 = evaluateCandidateSigningReviewDescriptor({
    purpose: 'candidate_signing_review_descriptor_input',
    signing_review_input_boundary: validSigningBoundary
  });
  assertSafe(r2);
  assert.equal(r2.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED');
});

test('(E) invalid source boundary -> fail-closed REJECTED', () => {
  // signing-review boundary not VALID
  const notValidBoundary = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), tx_build_suppression: Object.freeze({ suppressed: true, suppression_reasons: [], read_only: true }) });
  assert.notEqual(notValidBoundary.signing_review_input_state, 'SIGNING_REVIEW_INPUT_VALID');
  const r1 = evaluateCandidateSigningReviewDescriptor(goodDescriptorInput({ signing_review_input_boundary: notValidBoundary }));
  assertSafe(r1);
  assert.equal(r1.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_REJECTED');
  assert.equal(r1.signing_review_reason_codes.includes('signing_review_input_not_valid'), true);
  // custody not READ_ONLY_OK
  const badCustody = evaluateSignerCustodyBoundary({ purpose: 'signer_custody_boundary', signer_source: 'real_signer' });
  const r2 = evaluateCandidateSigningReviewDescriptor(goodDescriptorInput({ signer_custody_boundary: badCustody }));
  assert.equal(r2.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_REJECTED');
  assert.equal(r2.signing_review_reason_codes.includes('signer_custody_not_valid'), true);
});

test('(E) valid fixture metadata -> descriptor only (no readiness)', () => {
  const r = evaluateCandidateSigningReviewDescriptor(goodDescriptorInput());
  assertSafe(r);
  assert.equal(r.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_DESCRIPTOR');
  assert.equal(r.candidate_signing_review_valid, true);
  assert.equal(r.signing_review_kind, 'candidate_signing_review_descriptor');
  assert.equal(r.signing_review_ref, 'sr-1');
  assert.equal(r.tx_build_review_ref, 'txr-1');
  assert.equal(r.intent_record_ref, 'rec-1');
  assert.equal(r.signing_review_reason_codes.includes('candidate_signing_review_reviewed'), true);
  assertNoSignArtifacts(r);
  // descriptor opens NO signer_ready / signing_permitted / transaction_ready / can_send
  assert.equal(r.signer_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.transaction_ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_serialize, false);
});

test('(E) revoked/disabled status / required_unsatisfied dual-control / unreachable -> rejected', () => {
  const cases = [
    [{ signer_profile_status_bucket: 'revoked' }, 'signer_profile_status_revoked'],
    [{ signer_profile_status_bucket: 'disabled' }, 'signer_profile_status_disabled'],
    [{ dual_control_bucket: 'required_unsatisfied' }, 'dual_control_required_unsatisfied'],
    [{ signer_reachability_bucket: 'unreachable' }, 'signer_unreachable']
  ];
  for (const [over, code] of cases) {
    const r = evaluateCandidateSigningReviewDescriptor(goodDescriptorInput({
      signer_metadata: { ...goodSignerMetadata(), ...over }
    }));
    assertSafe(r);
    assert.equal(r.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_REJECTED');
    assert.equal(r.signing_review_reason_codes.includes(code), true);
    assert.equal(r.candidate_signing_review_valid, false);
  }
});

test('(E) degraded status / unknown bucket -> degraded (no descriptor)', () => {
  for (const over of [{ signer_profile_status_bucket: 'degraded' }, { key_custody_mode_bucket: 'unknown' },
    { dual_control_bucket: 'unknown' }, { signer_reachability_bucket: 'unknown' }]) {
    const r = evaluateCandidateSigningReviewDescriptor(goodDescriptorInput({
      signer_metadata: { ...goodSignerMetadata(), ...over }
    }));
    assertSafe(r);
    assert.equal(r.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_DEGRADED');
    assert.equal(r.candidate_signing_review_valid, false);
  }
});

test('(E) requires_key_material/signing/network !== false -> INVALID', () => {
  for (const over of [{ requires_key_material: true }, { requires_signing: true },
    { requires_network: true }, { requires_key_material: 'maybe' }]) {
    const r = evaluateCandidateSigningReviewDescriptor(goodDescriptorInput({
      signer_metadata: { ...goodSignerMetadata(), ...over }
    }));
    assertSafe(r);
    assert.equal(r.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_INVALID');
  }
});

test('(E) smuggled sign/key/seed/signature/send fields -> refused & private_key/seed not echoed', () => {
  for (const s of [{ can_send: true }, { signing_permitted: true }, { sign: true },
    { private_key: 'LEAK' }, { seed: 'LEAK' }, { keypair: 'LEAK' }, { mnemonic: 'LEAK' },
    { signature: 'LEAK' }, { signed_tx: 'LEAK' }, { serialized_tx: 'LEAK' },
    { message_bytes: 'LEAK' }, { transaction: 'LEAK' }, { api_key: 'sk-LEAK' }]) {
    const r = evaluateCandidateSigningReviewDescriptor({ ...goodDescriptorInput(), ...s });
    assertSafe(r);
    assert.equal(r.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
    assertNoSignArtifacts(r);
  }
});

test('(E) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCandidateSigningReviewDescriptor(h); });
    assertSafe(r);
    assert.equal(r.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_UNCONFIGURED');
  }
});

test('(E) descriptor never exposes any key/signature/transaction artifact', () => {
  // across every reachable state, output must carry NO forbidden artifact key
  const states = [
    evaluateCandidateSigningReviewDescriptor(goodDescriptorInput()),
    evaluateCandidateSigningReviewDescriptor(goodDescriptorInput({ signer_metadata: { ...goodSignerMetadata(), signer_profile_status_bucket: 'revoked' } })),
    evaluateCandidateSigningReviewDescriptor(goodDescriptorInput({ signer_metadata: { ...goodSignerMetadata(), key_custody_mode_bucket: 'unknown' } })),
    evaluateCandidateSigningReviewDescriptor(undefined)
  ];
  for (const r of states) {
    assertSafe(r);
    assertNoSignArtifacts(r);
  }
});

// ===========================================================================
// (F) SIGNER / KEY-CUSTODY READINESS ADVISORY
// ===========================================================================

const goodReadinessInput = (over = {}) => ({
  purpose: 'signer_custody_readiness_input',
  key_custody_mode_bucket: 'isolated_signer',
  signer_profile_status_bucket: 'active',
  dual_control_bucket: 'required_satisfied',
  signer_reachability_bucket: 'reachable',
  custody_verification_bucket: 'verified',
  ...over
});

test('(F) descriptor: shape, states, reason codes, safe flags', () => {
  const d = describeSignerCustodyReadinessAdvisoryContract();
  assertSafe(d);
  assert.equal(d.contract, 'signer-custody-readiness-advisory');
  assert.equal(d.signer_custody_acceptable_advisory, false);
  assert.equal(d.signer_custody_rejected, false);
  assertNoSignArtifacts(d);
  assert.deepEqual([...d.supported_states], [
    'SIGNER_CUSTODY_READINESS_UNCONFIGURED', 'SIGNER_CUSTODY_READINESS_INVALID',
    'SIGNER_CUSTODY_READINESS_DEGRADED', 'SIGNER_CUSTODY_READINESS_REJECTED',
    'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY'
  ]);
});

test('(F) missing bucket -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSignerCustodyReadinessAdvisory(inp);
    assertSafe(r);
    assert.equal(r.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_UNCONFIGURED');
  }
  const r2 = evaluateSignerCustodyReadinessAdvisory({
    purpose: 'signer_custody_readiness_input', key_custody_mode_bucket: 'isolated_signer'
  });
  assertSafe(r2);
  assert.equal(r2.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_UNCONFIGURED');
});

test('(F) invalid enum bucket -> INVALID', () => {
  for (const over of [{ key_custody_mode_bucket: 'live_signer' }, { signer_profile_status_bucket: 'on' },
    { dual_control_bucket: 'maybe' }, { signer_reachability_bucket: 'online' },
    { custody_verification_bucket: 'partly' }]) {
    const r = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput(over));
    assertSafe(r);
    assert.equal(r.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_INVALID');
    assert.equal(r.valid, false);
  }
});

test('(F) unknown buckets -> degraded', () => {
  for (const over of [{ key_custody_mode_bucket: 'unknown' }, { signer_profile_status_bucket: 'unknown' },
    { dual_control_bucket: 'unknown' }, { signer_reachability_bucket: 'unknown' },
    { custody_verification_bucket: 'unknown' }, { signer_profile_status_bucket: 'degraded' }]) {
    const r = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput(over));
    assertSafe(r);
    assert.equal(r.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_DEGRADED');
    assert.equal(r.signer_custody_acceptable_advisory, false);
  }
});

test('(F) revoked/disabled/required_unsatisfied/unreachable/unverified -> rejected', () => {
  const cases = [
    [{ signer_profile_status_bucket: 'revoked' }, 'signer_profile_status_revoked'],
    [{ signer_profile_status_bucket: 'disabled' }, 'signer_profile_status_disabled'],
    [{ dual_control_bucket: 'required_unsatisfied' }, 'dual_control_required_unsatisfied'],
    [{ signer_reachability_bucket: 'unreachable' }, 'signer_unreachable'],
    [{ custody_verification_bucket: 'unverified' }, 'custody_unverified']
  ];
  for (const [over, code] of cases) {
    const r = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput(over));
    assertSafe(r);
    assert.equal(r.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_REJECTED');
    assert.equal(r.signer_custody_rejected, true);
    assert.equal(r.signing_review_reason_codes.includes(code), true);
  }
});

test('(F) acceptable (isolated_signer+active+satisfied+reachable+verified) -> advisory acceptable only', () => {
  const r = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput());
  assertSafe(r);
  assert.equal(r.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY');
  assert.equal(r.signer_custody_acceptable_advisory, true);
  assert.equal(r.signing_review_reason_codes.includes('signer_custody_acceptable'), true);
  assertNoSignArtifacts(r);
  // not_required also acceptable
  const r2 = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput({ dual_control_bucket: 'not_required' }));
  assert.equal(r2.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_ACCEPTABLE_ADVISORY');
  // acceptable opens NO signing / transaction / send
  assert.equal(r.signer_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.transaction_ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_serialize, false);
});

test('(F) connected_wallet mode -> not acceptable (degraded)', () => {
  const r = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput({ key_custody_mode_bucket: 'connected_wallet' }));
  assertSafe(r);
  assert.equal(r.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_DEGRADED');
  assert.equal(r.signer_custody_acceptable_advisory, false);
});

test('(F) smuggled forbidden flag / secret / endpoint / key-material -> INVALID & never echoed', () => {
  for (const s of [{ can_send: true }, { signing_permitted: true }, { sign: true },
    { secret: 'LEAK' }, { private_key: 'LEAK' }, { rpc_url: 'https://x/LEAK' }, { real_live: true }]) {
    const r = evaluateSignerCustodyReadinessAdvisory({ ...goodReadinessInput(), ...s });
    assertSafe(r);
    assert.equal(r.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(F) no key/signature/transaction field in output across states', () => {
  for (const r of [
    evaluateSignerCustodyReadinessAdvisory(goodReadinessInput()),
    evaluateSignerCustodyReadinessAdvisory(goodReadinessInput({ signer_profile_status_bucket: 'revoked' })),
    evaluateSignerCustodyReadinessAdvisory(goodReadinessInput({ key_custody_mode_bucket: 'unknown' })),
    evaluateSignerCustodyReadinessAdvisory(undefined)
  ]) {
    assertSafe(r);
    assertNoSignArtifacts(r);
  }
});

test('(F) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSignerCustodyReadinessAdvisory(h); });
    assertSafe(r);
    assert.equal(r.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_UNCONFIGURED');
  }
});

// ===========================================================================
// (G) PRIVATE-KEY FORBIDDEN SURFACE GUARD
// ===========================================================================

test('(G) descriptor: shape, states, safe flags', () => {
  const d = describePrivateKeyForbiddenSurfaceContract();
  assertSafe(d);
  assert.equal(d.contract, 'private-key-forbidden-surface');
  assert.equal(d.key_material_detected, false);
  assert.equal(d.private_key_detected, false);
  assert.equal(d.forbidden_field_detected, false);
  assert.equal(d.forbidden_field_ref, null);
  assert.deepEqual([...d.supported_states], [
    'PRIVATE_KEY_SURFACE_UNCONFIGURED', 'PRIVATE_KEY_SURFACE_CLEAN', 'PRIVATE_KEY_SURFACE_BLOCKED'
  ]);
});

test('(G) missing / hostile input -> UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluatePrivateKeyForbiddenSurface(inp);
    assertSafe(r);
    assert.equal(r.private_key_surface_state, 'PRIVATE_KEY_SURFACE_UNCONFIGURED');
  }
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluatePrivateKeyForbiddenSurface(h); });
    assertSafe(r);
    assert.equal(r.private_key_surface_state, 'PRIVATE_KEY_SURFACE_UNCONFIGURED');
  }
});

test('(G) clean descriptor -> surface clean (no detection)', () => {
  const r = evaluatePrivateKeyForbiddenSurface({
    purpose: 'candidate_signing_review_descriptor', signing_review_ref: 'sr-1',
    key_custody_mode_bucket: 'isolated_signer', signer_profile_status_bucket: 'active'
  });
  assertSafe(r);
  assert.equal(r.private_key_surface_state, 'PRIVATE_KEY_SURFACE_CLEAN');
  assert.equal(r.key_material_detected, false);
  assert.equal(r.private_key_detected, false);
  assert.equal(r.forbidden_field_detected, false);
  assert.equal(r.forbidden_field_ref, null);
});

test('(G) private_key/secret_key/keypair/mnemonic/seed -> blocked, key detected, VALUE never echoed', () => {
  for (const name of ['private_key', 'privateKey', 'secret_key', 'secretKey', 'keypair', 'keyPair',
    'mnemonic', 'seed', 'seed_phrase', 'secret_seed', 'raw_key', 'signing_key', 'signer_secret', 'ed25519_secret']) {
    const planted = `PLANTED-${name}-SECRET-VALUE-9z9z`;
    const r = evaluatePrivateKeyForbiddenSurface({ [name]: planted });
    assertSafe(r);
    assert.equal(r.private_key_surface_state, 'PRIVATE_KEY_SURFACE_BLOCKED');
    assert.equal(r.key_material_detected, true);
    assert.equal(r.forbidden_field_detected, true);
    assert.equal(r.private_key_detected, true, `${name} is a key-material name`);
    assert.equal(r.forbidden_field_ref, name);
    // output NEVER echoes the forbidden VALUE
    assert.equal(JSON.stringify(r).includes('PLANTED'), false, `${name} value must not be echoed`);
  }
});

test('(G) signature-only field -> blocked, key vs signature classification', () => {
  for (const name of ['signature', 'signatures', 'signed_tx', 'signedTransaction', 'signed_transaction']) {
    const planted = `PLANTED-${name}-SIG-VALUE`;
    const r = evaluatePrivateKeyForbiddenSurface({ [name]: planted });
    assertSafe(r);
    assert.equal(r.private_key_surface_state, 'PRIVATE_KEY_SURFACE_BLOCKED');
    assert.equal(r.key_material_detected, true);
    assert.equal(r.forbidden_field_detected, true);
    // signature names are NOT key/seed/keypair -> private_key_detected false
    assert.equal(r.private_key_detected, false, `${name} is a signature-only name`);
    assert.equal(r.forbidden_field_ref, name);
    assert.equal(JSON.stringify(r).includes('PLANTED'), false);
  }
});

// ===========================================================================
// (H) SIGNING-REVIEW VERDICT
// ===========================================================================

const cleanReadiness = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput());
const cleanSurface = evaluatePrivateKeyForbiddenSurface({ purpose: 'candidate_signing_review_descriptor' });
const cleanDescriptor = evaluateCandidateSigningReviewDescriptor(goodDescriptorInput());

const goodVerdictInput = (over = {}) => ({
  purpose: 'signing_review_verdict_input',
  signing_review_input_boundary: validSigningBoundary,
  signer_custody_boundary: validCustody,
  candidate_signing_review_descriptor: cleanDescriptor,
  signer_custody_readiness_advisory: cleanReadiness,
  private_key_surface: cleanSurface,
  ...over
});

test('(H) descriptor: shape, states, reason/explanation codes, safe flags', () => {
  const d = describeSigningReviewVerdictContract();
  assertSafe(d);
  assert.equal(d.contract, 'signing-review-verdict');
  assert.equal(d.signing_review_passed_advisory, false);
  assert.equal(d.signing_review_blocked, false);
  assert.deepEqual([...d.supported_states], [
    'SIGNING_REVIEW_UNCONFIGURED', 'SIGNING_REVIEW_DEGRADED',
    'SIGNING_REVIEW_BLOCKED', 'SIGNING_REVIEW_PASS_ADVISORY'
  ]);
});

test('(H) missing components -> unconfigured', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSigningReviewVerdict(inp);
    assertSafe(r);
    assert.equal(r.signing_review_state, 'SIGNING_REVIEW_UNCONFIGURED');
  }
  const r2 = evaluateSigningReviewVerdict(goodVerdictInput({ private_key_surface: undefined }));
  assertSafe(r2);
  assert.equal(r2.signing_review_state, 'SIGNING_REVIEW_UNCONFIGURED');
});

test('(H) blocked component / key-material detected -> blocked', () => {
  // private-key surface blocked
  const blockedSurface = evaluatePrivateKeyForbiddenSurface({ private_key: 'LEAK' });
  const r1 = evaluateSigningReviewVerdict(goodVerdictInput({ private_key_surface: blockedSurface }));
  assertSafe(r1);
  assert.equal(r1.signing_review_state, 'SIGNING_REVIEW_BLOCKED');
  assert.equal(JSON.stringify(r1).includes('LEAK'), false);
  // custody-readiness rejected -> blocked
  const rejReadiness = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput({ signer_profile_status_bucket: 'revoked' }));
  const r2 = evaluateSigningReviewVerdict(goodVerdictInput({ signer_custody_readiness_advisory: rejReadiness }));
  assert.equal(r2.signing_review_state, 'SIGNING_REVIEW_BLOCKED');
  // descriptor invalid -> blocked
  const invDescriptor = evaluateCandidateSigningReviewDescriptor({ ...goodDescriptorInput(), private_key: 'X' });
  assert.equal(invDescriptor.candidate_signing_review_state, 'CANDIDATE_SIGNING_REVIEW_INVALID');
  const r3 = evaluateSigningReviewVerdict(goodVerdictInput({ candidate_signing_review_descriptor: invDescriptor }));
  assert.equal(r3.signing_review_state, 'SIGNING_REVIEW_BLOCKED');
});

test('(H) degraded readiness -> degraded', () => {
  const degReadiness = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput({ signer_reachability_bucket: 'unknown' }));
  assert.equal(degReadiness.signer_custody_readiness_state, 'SIGNER_CUSTODY_READINESS_DEGRADED');
  const r = evaluateSigningReviewVerdict(goodVerdictInput({ signer_custody_readiness_advisory: degReadiness }));
  assertSafe(r);
  assert.equal(r.signing_review_state, 'SIGNING_REVIEW_DEGRADED');
});

test('(H) clean+acceptable+key-clean -> pass advisory only (no readiness)', () => {
  const r = evaluateSigningReviewVerdict(goodVerdictInput());
  assertSafe(r);
  assert.equal(r.signing_review_state, 'SIGNING_REVIEW_PASS_ADVISORY');
  assert.equal(r.signing_review_passed_advisory, true);
  assert.equal(r.signing_review_reason_codes.includes('signer_custody_acceptable'), true);
  assert.equal(r.signing_review_reason_codes.includes('private_key_surface_clean'), true);
  // pass opens NO signer_ready / signing_permitted / transaction_ready / can_serialize / can_send
  assert.equal(r.signer_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.transaction_ready, false);
  assert.equal(r.can_serialize, false);
  assert.equal(r.can_send, false);
  // reason/explanation codes carry NO key-material/signature artifact tokens
  // (the clean-surface status marker 'private_key_surface_clean' is allowed —
  // it asserts the ABSENCE of key material, not its presence)
  for (const c of [...r.signing_review_reason_codes, ...r.signing_review_explanation_codes]) {
    assert.equal(/seed|mnemonic|keypair|secret_key|\bsign_tx\b|\bsend_tx\b|signature/.test(c), false, `code ${c} carries an artifact token`);
  }
});

test('(H) smuggled forbidden flag/exec/secret/endpoint -> blocked', () => {
  for (const s of [{ can_send: true }, { send: true }, { secret: 'LEAK' }, { rpc_url: 'https://x/LEAK' },
    { real_live: true }, { private_key: 'LEAK' }]) {
    const r = evaluateSigningReviewVerdict({ ...goodVerdictInput(), ...s });
    assertSafe(r);
    assert.equal(r.signing_review_state, 'SIGNING_REVIEW_BLOCKED');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(H) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSigningReviewVerdict(h); });
    assertSafe(r);
    assert.equal(r.signing_review_state, 'SIGNING_REVIEW_UNCONFIGURED');
  }
});

// ===========================================================================
// (I) SIGNING-REVIEW SUPPRESSION / REJECTION
// ===========================================================================

const goodSuppressionInput = (over = {}) => ({
  purpose: 'signing_review_suppression_input',
  signing_review_input_boundary: validSigningBoundary,
  candidate_signing_review_descriptor: cleanDescriptor,
  signer_custody_readiness_advisory: cleanReadiness,
  private_key_surface: cleanSurface,
  signer_custody_boundary: validCustody,
  ...over
});

test('(I) descriptor: shape, reason codes, safe flags', () => {
  const d = describeSigningReviewSuppressionContract();
  assertSafe(d);
  assert.equal(d.contract, 'signing-review-suppression');
  assert.equal(d.suppressed, false);
  assert.deepEqual([...d.supported_reason_codes], [
    'tx_build_not_reviewed', 'signer_custody_invalid', 'signer_metadata_missing',
    'signer_not_ready', 'dual_control_unsatisfied', 'key_material_detected',
    'signature_detected', 'not_sign_authorized', 'not_send_authorized',
    'not_execution_authorized'
  ]);
});

test('(I) missing descriptor -> suppressed + signer_metadata_missing', () => {
  const r = evaluateSigningReviewSuppression(goodSuppressionInput({ candidate_signing_review_descriptor: undefined }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('signer_metadata_missing'), true);
});

test('(I) invalid custody -> suppressed + signer_custody_invalid', () => {
  const badCustody = evaluateSignerCustodyBoundary({ purpose: 'signer_custody_boundary', signer_source: 'real_signer' });
  const r = evaluateSigningReviewSuppression(goodSuppressionInput({ signer_custody_boundary: badCustody }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('signer_custody_invalid'), true);
});

test('(I) input boundary not valid -> suppressed + tx_build_not_reviewed', () => {
  const notValid = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), tx_build_suppression: Object.freeze({ suppressed: true, suppression_reasons: [], read_only: true }) });
  const r = evaluateSigningReviewSuppression(goodSuppressionInput({ signing_review_input_boundary: notValid }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('tx_build_not_reviewed'), true);
});

test('(I) unacceptable readiness (rejected, dual-control) -> suppressed + signer_not_ready (+dual_control_unsatisfied)', () => {
  const rejReadiness = evaluateSignerCustodyReadinessAdvisory(goodReadinessInput({ dual_control_bucket: 'required_unsatisfied' }));
  const r = evaluateSigningReviewSuppression(goodSuppressionInput({ signer_custody_readiness_advisory: rejReadiness }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('signer_not_ready'), true);
  assert.equal(r.suppression_reasons.includes('dual_control_unsatisfied'), true);
});

test('(I) key-material detected -> suppressed + key_material_detected', () => {
  const blockedSurface = evaluatePrivateKeyForbiddenSurface({ keypair: 'LEAK' });
  const r = evaluateSigningReviewSuppression(goodSuppressionInput({ private_key_surface: blockedSurface }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('key_material_detected'), true);
  assert.equal(JSON.stringify(r).includes('LEAK'), false);
});

test('(I) signature detected -> suppressed + signature_detected', () => {
  const sigSurface = evaluatePrivateKeyForbiddenSurface({ signature: 'LEAK' });
  assert.equal(sigSurface.private_key_detected, false);
  assert.equal(sigSurface.forbidden_field_detected, true);
  const r = evaluateSigningReviewSuppression(goodSuppressionInput({ private_key_surface: sigSurface }));
  assertSafe(r);
  assert.equal(r.suppression_reasons.includes('key_material_detected'), true);
  assert.equal(r.suppression_reasons.includes('signature_detected'), true);
});

test('(I) advisory clean -> STILL not sign/send authorized', () => {
  const r = evaluateSigningReviewSuppression(goodSuppressionInput());
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('not_sign_authorized'), true);
  assert.equal(r.suppression_reasons.includes('not_send_authorized'), true);
  assert.equal(r.suppression_reasons.includes('not_execution_authorized'), true);
  // suppression opens NO signer_ready / signing / can_send
  assert.equal(r.signer_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.can_send, false);
});

test('(I) hostile -> frozen no throw (suppressed fail-closed)', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSigningReviewSuppression(h); });
    assertSafe(r);
    assert.equal(r.suppressed, true);
    assert.equal(r.suppression_reasons.includes('not_sign_authorized'), true);
  }
});

// ===========================================================================
// (J) SIGNING-REVIEW HEALTH / STATUS
// ===========================================================================

const cleanVerdict = evaluateSigningReviewVerdict(goodVerdictInput());
const cleanSuppression = evaluateSigningReviewSuppression(goodSuppressionInput());

const goodHealthInput = (over = {}) => ({
  signing_review_input_boundary: validSigningBoundary,
  signer_custody_boundary: validCustody,
  candidate_signing_review_descriptor: cleanDescriptor,
  signer_custody_readiness_advisory: cleanReadiness,
  private_key_surface: cleanSurface,
  signing_review_verdict: cleanVerdict,
  signing_review_suppression: cleanSuppression,
  ...over
});

test('(J) descriptor: shape, states, safe flags', () => {
  const d = describeSigningReviewHealthContract();
  assertSafe(d);
  assert.equal(d.contract, 'signing-review-health');
  assert.deepEqual([...d.supported_states], [
    'SIGNING_REVIEW_HEALTH_UNCONFIGURED', 'SIGNING_REVIEW_HEALTH_DEGRADED',
    'SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY', 'SIGNING_REVIEW_HEALTH_SUPPRESSED',
    'SIGNING_REVIEW_HEALTH_BLOCKED'
  ]);
});

test('(J) missing components -> unconfigured', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSigningReviewHealth(inp);
    assertSafe(r);
    assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_UNCONFIGURED');
  }
  const r2 = evaluateSigningReviewHealth(goodHealthInput({ signing_review_verdict: undefined }));
  assertSafe(r2);
  assert.equal(r2.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_UNCONFIGURED');
});

test('(J) invalid boundary -> blocked', () => {
  const invBoundary = evaluateSigningReviewInputBoundary({ ...goodSigningInput(), can_send: true });
  assert.equal(invBoundary.signing_review_input_state, 'SIGNING_REVIEW_INPUT_INVALID');
  const r = evaluateSigningReviewHealth(goodHealthInput({ signing_review_input_boundary: invBoundary }));
  assertSafe(r);
  assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_BLOCKED');
});

test('(J) invalid custody -> blocked', () => {
  const badCustody = evaluateSignerCustodyBoundary({ purpose: 'signer_custody_boundary', signer_source: 'real_signer' });
  const r = evaluateSigningReviewHealth(goodHealthInput({ signer_custody_boundary: badCustody }));
  assertSafe(r);
  assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_BLOCKED');
});

test('(J) key-material detected -> blocked', () => {
  const blockedSurface = evaluatePrivateKeyForbiddenSurface({ private_key: 'LEAK' });
  const r = evaluateSigningReviewHealth(goodHealthInput({ private_key_surface: blockedSurface }));
  assertSafe(r);
  assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_BLOCKED');
  assert.equal(JSON.stringify(r).includes('LEAK'), false);
});

test('(J) blocked verdict -> blocked', () => {
  const blockedVerdict = evaluateSigningReviewVerdict(goodVerdictInput({ private_key_surface: evaluatePrivateKeyForbiddenSurface({ seed: 'x' }) }));
  assert.equal(blockedVerdict.signing_review_state, 'SIGNING_REVIEW_BLOCKED');
  const r = evaluateSigningReviewHealth(goodHealthInput({ signing_review_verdict: blockedVerdict }));
  assertSafe(r);
  assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_BLOCKED');
});

test('(J) suppressed -> suppressed', () => {
  // build a suppression result that is suppressed for an additional reason (always suppressed),
  // then confirm health reports SUPPRESSED when the verdict isn't a clean pass path
  const r = evaluateSigningReviewHealth(goodHealthInput({ signing_review_suppression: cleanSuppression }));
  assertSafe(r);
  // cleanSuppression.suppressed === true (always suppressed for sign/send) -> SUPPRESSED
  assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_SUPPRESSED');
});

test('(J) advisory review pass + not suppressed -> reviewed advisory only', () => {
  const notSuppressed = Object.freeze({ suppressed: false, suppression_reasons: [], read_only: true });
  const r = evaluateSigningReviewHealth(goodHealthInput({ signing_review_suppression: notSuppressed }));
  assertSafe(r);
  assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_REVIEWED_ADVISORY');
  // reviewed advisory opens NO signer / signing / transaction / send
  assert.equal(r.signer_ready, false);
  assert.equal(r.signing_permitted, false);
  assert.equal(r.transaction_ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_serialize, false);
});

test('(J) smuggled sign/send/key flags -> blocked', () => {
  for (const s of [{ can_send: true }, { signing_permitted: true }, { signer_ready: true },
    { send: true }, { sign: true }, { private_key: 'LEAK' }]) {
    const r = evaluateSigningReviewHealth({ ...goodHealthInput(), ...s });
    assertSafe(r);
    assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_BLOCKED');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(J) secret / mainnet / REAL-LIVE -> blocked', () => {
  for (const s of [{ secret: 'LEAK' }, { network: 'mainnet' }, { mode: 'prod' }, { real_live: true }]) {
    const r = evaluateSigningReviewHealth({ ...goodHealthInput(), ...s });
    assertSafe(r);
    assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_BLOCKED');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(J) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSigningReviewHealth(h); });
    assertSafe(r);
    assert.equal(r.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// STATIC SOURCE GUARD
// ===========================================================================

test('static guard: src has no "can_send: true" literal, is import-free, no mutable module state, no key/seed VALUE literal', () => {
  const files = [
    '../src/signing-review-foundations.mjs',
    '../src/index.mjs'
  ].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    if (f.endsWith('signing-review-foundations.mjs')) {
      // import-free implementation
      assert.equal(/^\s*import\s/m.test(src), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(src), false, 'implementation must not use require(');
      // no mutable module-level array (e.g. `const store = []` / `let ledger = []`)
      assert.equal(/\b(const|let|var)\s+\w*(signer|records|store|ledger|key|descriptor)\w*\s*=\s*\[\s*\]/i.test(src), false,
        'implementation must hold no mutable module-level array');
      // no network/clock/persistence/signing primitives
      assert.equal(/fetch\s*\(|new\s+WebSocket|new\s+Connection|sendTransaction|\.sign\s*\(/.test(src), false, 'no network/sign primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env/.test(src), false, 'no clock/env');
      // no private-key / seed / mnemonic / keypair VALUE assignment literal
      // (forbidden names may appear ONLY as quoted allowlist field-name string literals)
      assert.equal(/\b(private_key|secret_key|seed_phrase|mnemonic|keypair|signing_key|signer_secret)\s*[:=]\s*['"`]/.test(src), false,
        'implementation must hold no key/seed/mnemonic VALUE literal');
    }
  }
});
