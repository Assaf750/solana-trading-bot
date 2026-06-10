// PR-S12-A test suite for @soltrade/send-broadcast-review-foundations
// node:test + node:assert/strict. Deterministic. Builds a REAL Stage-4 -> 5 -> 6
// -> 7 -> 8 -> 9 -> 10 -> 11 chain (via the lower-stage evaluators) to a
// SIGNING_REVIEW_PASS_ADVISORY verdict + signing-review health, then feeds the
// Stage-12 send/broadcast-review foundation. Covers Stage-12 spec Parts C-J plus a
// static source guard and a send-gate-contract integration-consistency check.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeSendReviewInputBoundaryContract,
  validateSendReviewInputBoundary,
  evaluateSendReviewInputBoundary,
  describeSenderProviderBoundaryContract,
  validateSenderProviderBoundary,
  evaluateSenderProviderBoundary,
  describeCandidateSendReviewDescriptorContract,
  validateCandidateSendReviewDescriptorInput,
  evaluateCandidateSendReviewDescriptor,
  describeSendReadinessAdvisoryContract,
  validateSendReadinessAdvisoryInput,
  evaluateSendReadinessAdvisory,
  describeBroadcastForbiddenSurfaceContract,
  evaluateBroadcastForbiddenSurface,
  describeSendReviewVerdictContract,
  evaluateSendReviewVerdict,
  describeSendReviewSuppressionContract,
  evaluateSendReviewSuppression,
  describeSendReviewHealthContract,
  evaluateSendReviewHealth
} from '../src/index.mjs';

// Stage-11 signing-review foundation (real upstream chain head)
import {
  evaluateSigningReviewInputBoundary,
  evaluateSignerCustodyBoundary,
  evaluateCandidateSigningReviewDescriptor,
  evaluateSignerCustodyReadinessAdvisory,
  evaluatePrivateKeyForbiddenSurface,
  evaluateSigningReviewVerdict,
  evaluateSigningReviewSuppression,
  evaluateSigningReviewHealth
} from '../../signing-review-foundations/src/index.mjs';

import {
  evaluateTransactionBuildInputBoundary,
  evaluateTransactionBuildSourceBoundary,
  evaluateCandidateTransactionBuildDescriptor,
  evaluateTransactionBuildResourceAdvisory,
  evaluateSerializationForbiddenSurface,
  evaluateTransactionBuildReviewVerdict,
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

// integration-consistency: the EXISTING fail-closed send gate (test-level only)
import { evaluateSendPreflight } from '../../send-gate-contract/src/send-gate-contract.mjs';

// keep validate* imports referenced (contract surface) without affecting logic
void validateSendReviewInputBoundary;
void validateSenderProviderBoundary;
void validateCandidateSendReviewDescriptorInput;
void validateSendReadinessAdvisoryInput;

// ---------------------------------------------------------------------------
// REAL Stage-4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 builders
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

// Stage-11 signing-review results (PASS ADVISORY + health path)
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
const signingBoundaryValid = evaluateSigningReviewInputBoundary(goodSigningInput());
const signingCustodyValid = evaluateSignerCustodyBoundary({
  purpose: 'signer_custody_boundary', signer_source: 'isolated_signer_disabled'
});
const signerMetadata = () => ({
  key_custody_mode_bucket: 'isolated_signer',
  signer_profile_status_bucket: 'active',
  dual_control_bucket: 'required_satisfied',
  signer_reachability_bucket: 'reachable',
  requires_key_material: false,
  requires_signing: false,
  requires_network: false
});
const signingDescriptor = evaluateCandidateSigningReviewDescriptor({
  purpose: 'candidate_signing_review_descriptor_input',
  signing_review_input_boundary: signingBoundaryValid,
  signer_custody_boundary: signingCustodyValid,
  tx_build_review_ref: 'txr-1', signing_review_ref: 'sr-1', intent_record_ref: 'rec-1',
  signer_metadata: signerMetadata()
});
const signingReadiness = evaluateSignerCustodyReadinessAdvisory({
  purpose: 'signer_custody_readiness_input',
  key_custody_mode_bucket: 'isolated_signer',
  signer_profile_status_bucket: 'active',
  dual_control_bucket: 'required_satisfied',
  signer_reachability_bucket: 'reachable',
  custody_verification_bucket: 'verified'
});
const signingKeySurface = evaluatePrivateKeyForbiddenSurface({ purpose: 'candidate_signing_review_descriptor' });
const signingVerdictPass = evaluateSigningReviewVerdict({
  purpose: 'signing_review_verdict_input',
  signing_review_input_boundary: signingBoundaryValid,
  signer_custody_boundary: signingCustodyValid,
  candidate_signing_review_descriptor: signingDescriptor,
  signer_custody_readiness_advisory: signingReadiness,
  private_key_surface: signingKeySurface
});
const signingSuppression = evaluateSigningReviewSuppression({
  purpose: 'signing_review_suppression_input',
  signing_review_input_boundary: signingBoundaryValid,
  candidate_signing_review_descriptor: signingDescriptor,
  signer_custody_readiness_advisory: signingReadiness,
  private_key_surface: signingKeySurface,
  signer_custody_boundary: signingCustodyValid
});
const signingHealth = evaluateSigningReviewHealth({
  signing_review_input_boundary: signingBoundaryValid,
  signer_custody_boundary: signingCustodyValid,
  candidate_signing_review_descriptor: signingDescriptor,
  signer_custody_readiness_advisory: signingReadiness,
  private_key_surface: signingKeySurface,
  signing_review_verdict: signingVerdictPass,
  signing_review_suppression: signingSuppression
});

// sanity: confirm the real Stage-11 chain reached PASS ADVISORY + health
test('preconditions: real Stage-11 chain reaches SIGNING_REVIEW_PASS_ADVISORY', () => {
  assert.equal(txHealthReviewed.tx_build_health_state, 'TX_BUILD_HEALTH_REVIEWED_ADVISORY');
  assert.equal(signingBoundaryValid.signing_review_input_state, 'SIGNING_REVIEW_INPUT_VALID');
  assert.equal(signingVerdictPass.signing_review_state, 'SIGNING_REVIEW_PASS_ADVISORY');
  // suppression layer is always suppressed -> health resolves to SUPPRESSED
  assert.equal(signingHealth.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_SUPPRESSED');
});

const goodSendInput = () => ({
  purpose: 'send_review_input_boundary',
  signing_review_verdict: signingVerdictPass,
  signing_review_health: signingHealth
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

const SEND_FORBIDDEN_OUTPUT_KEYS = [
  'endpoint', 'endpoint_url', 'rpc_url', 'rpc_endpoint', 'provider_url', 'node_url',
  'ws_url', 'wss_url', 'http_endpoint', 'serialized_tx', 'serialized_transaction',
  'signed_tx', 'signed_transaction', 'wire_transaction', 'raw_tx', 'raw_transaction',
  'tx_bytes', 'message_bytes', 'signature', 'signatures', 'broadcast_payload',
  'send_payload', 'private_key', 'keypair', 'seed', 'mnemonic'
];

function assertNoSendArtifacts(res) {
  for (const k of SEND_FORBIDDEN_OUTPUT_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(res, k), false, `output must not contain ${k}`);
  }
}

const hostiles = () => {
  const throwing = new Proxy({}, { get() { throw new Error('hostile'); } });
  const fnReturning = new Proxy({}, { get() { return () => true; } });
  return [throwing, fnReturning];
};

// ===========================================================================
// (C) SEND-REVIEW INPUT BOUNDARY
// ===========================================================================

test('(C) descriptor: shape, states, safe flags, no exec authority', () => {
  const d = describeSendReviewInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'send-review-input-boundary');
  assert.equal(d.send_review_input_boundary_valid, false);
  assert.equal(d.eligible_for_send_review, false);
  assert.deepEqual([...d.supported_states], [
    'SEND_REVIEW_INPUT_UNCONFIGURED', 'SEND_REVIEW_INPUT_INVALID',
    'SEND_REVIEW_INPUT_DEGRADED', 'SEND_REVIEW_INPUT_VALID'
  ]);
});

test('(C) missing signing-review input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSendReviewInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.send_review_input_state, 'SEND_REVIEW_INPUT_UNCONFIGURED');
    assert.equal(r.eligible_for_send_review, false);
  }
  // missing required components (need signing_review_verdict + signing_review_health)
  const r2 = evaluateSendReviewInputBoundary({
    purpose: 'send_review_input_boundary',
    signing_review_verdict: signingVerdictPass
  });
  assertSafe(r2);
  assert.equal(r2.send_review_input_state, 'SEND_REVIEW_INPUT_UNCONFIGURED');
});

test('(C) signing-review verdict BLOCKED -> fail-closed INVALID', () => {
  const blockedVerdict = evaluateSigningReviewVerdict({
    purpose: 'signing_review_verdict_input',
    signing_review_input_boundary: signingBoundaryValid,
    signer_custody_boundary: signingCustodyValid,
    candidate_signing_review_descriptor: signingDescriptor,
    signer_custody_readiness_advisory: signingReadiness,
    private_key_surface: signingKeySurface,
    can_send: true
  });
  assert.equal(blockedVerdict.signing_review_state, 'SIGNING_REVIEW_BLOCKED');
  // can_send:true smuggled at top-level is itself refused first; instead feed a real blocked verdict cleanly
  const cleanBlockedVerdict = evaluateSigningReviewVerdict({
    purpose: 'signing_review_verdict_input',
    signing_review_input_boundary: signingBoundaryValid,
    signer_custody_boundary: signingCustodyValid,
    candidate_signing_review_descriptor: signingDescriptor,
    signer_custody_readiness_advisory: signingReadiness,
    private_key_surface: evaluatePrivateKeyForbiddenSurface({ seed: 'x' })
  });
  assert.equal(cleanBlockedVerdict.signing_review_state, 'SIGNING_REVIEW_BLOCKED');
  const r = evaluateSendReviewInputBoundary({ ...goodSendInput(), signing_review_verdict: cleanBlockedVerdict });
  assertSafe(r);
  assert.equal(r.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
  assert.equal(r.eligible_for_send_review, false);
});

test('(C) signing-review verdict not PASS_ADVISORY -> not eligible (DEGRADED)', () => {
  const degReadiness = evaluateSignerCustodyReadinessAdvisory({
    purpose: 'signer_custody_readiness_input',
    key_custody_mode_bucket: 'isolated_signer',
    signer_profile_status_bucket: 'active',
    dual_control_bucket: 'required_satisfied',
    signer_reachability_bucket: 'unknown',
    custody_verification_bucket: 'verified'
  });
  const degVerdict = evaluateSigningReviewVerdict({
    purpose: 'signing_review_verdict_input',
    signing_review_input_boundary: signingBoundaryValid,
    signer_custody_boundary: signingCustodyValid,
    candidate_signing_review_descriptor: signingDescriptor,
    signer_custody_readiness_advisory: degReadiness,
    private_key_surface: signingKeySurface
  });
  assert.equal(degVerdict.signing_review_state, 'SIGNING_REVIEW_DEGRADED');
  const r = evaluateSendReviewInputBoundary({ ...goodSendInput(), signing_review_verdict: degVerdict });
  assertSafe(r);
  assert.equal(r.send_review_input_state, 'SEND_REVIEW_INPUT_DEGRADED');
  assert.equal(r.eligible_for_send_review, false);
});

test('(C) PASS_ADVISORY signing-review + health -> boundary valid only (no readiness)', () => {
  const r = evaluateSendReviewInputBoundary(goodSendInput());
  assertSafe(r);
  assert.equal(r.send_review_input_state, 'SEND_REVIEW_INPUT_VALID');
  assert.equal(r.send_review_input_boundary_valid, true);
  assert.equal(r.eligible_for_send_review, true);
  // eligible opens NO send/broadcast/serialization readiness
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.broadcast_permitted, false);
  assert.equal(r.serialized_ready, false);
});

test('(C) raw tx-build / route / earlier-stage / raw tx-build result passed directly -> refused', () => {
  // raw Stage-10 tx-build output in a component slot
  const r1 = evaluateSendReviewInputBoundary({
    ...goodSendInput(), signing_review_verdict: txHealthReviewed
  });
  assertSafe(r1);
  assert.equal(r1.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
  // raw Stage-9 route output
  const r2 = evaluateSendReviewInputBoundary({
    ...goodSendInput(), signing_review_health: routeHealthPreviewReady
  });
  assert.equal(r2.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
  // raw Stage-8 intent
  const r3 = evaluateSendReviewInputBoundary({
    ...goodSendInput(), signing_review_health: intentHealthAwaiting
  });
  assert.equal(r3.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
  // raw Stage-4 ingestion event directly
  const rawEvent = mk('swap_observed', 'e1', 'w-1', 't-1');
  const r4 = evaluateSendReviewInputBoundary({
    ...goodSendInput(), signing_review_verdict: { ...rawEvent, read_only: true }
  });
  assert.equal(r4.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
});

test('(C) smuggled send/broadcast/serialize flags -> refused INVALID', () => {
  for (const s of [{ can_send: true }, { can_broadcast: true }, { broadcast_permitted: true },
    { send: true }, { broadcast: true }, { serialize: true }, { rpc_call: true }, { connect_rpc: true }]) {
    const r = evaluateSendReviewInputBoundary({ ...goodSendInput(), ...s });
    assertSafe(r);
    assert.equal(r.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
  }
});

test('(C) endpoint / rpc_url / secret / private_key -> refused & never echoed', () => {
  for (const s of [
    { rpc_url: 'https://api.mainnet-beta.solana.com/LEAK' },
    { api_key: 'sk-LEAK-VALUE' },
    { secret: 'LEAK-VALUE' },
    { private_key: 'LEAK-VALUE' }
  ]) {
    const r = evaluateSendReviewInputBoundary({ ...goodSendInput(), ...s });
    assertSafe(r);
    assert.equal(r.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(C) mainnet / REAL-LIVE -> refused', () => {
  for (const s of [{ network: 'mainnet' }, { mode: 'prod' }, { real_live: true }]) {
    const r = evaluateSendReviewInputBoundary({ ...goodSendInput(), ...s });
    assertSafe(r);
    assert.equal(r.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
  }
});

test('(C) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendReviewInputBoundary(h); });
    assertSafe(r);
    assert.equal(r.send_review_input_state, 'SEND_REVIEW_INPUT_UNCONFIGURED');
  }
});

// ===========================================================================
// (D) SENDER / PROVIDER BOUNDARY
// ===========================================================================

test('(D) descriptor: shape, states, safe flags', () => {
  const d = describeSenderProviderBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'sender-provider-boundary');
  assert.equal(d.sender_provider_boundary_valid, false);
  assert.equal(d.sender_disabled, true);
  assert.equal(d.broadcast_performed, false);
  assert.equal(d.rpc_connected, false);
  assert.deepEqual([...d.supported_states], [
    'SENDER_PROVIDER_UNCONFIGURED', 'SENDER_PROVIDER_INVALID', 'SENDER_PROVIDER_READ_ONLY_OK'
  ]);
});

test('(D) missing source -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSenderProviderBoundary(inp);
    assertSafe(r);
    assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_UNCONFIGURED');
  }
  const r2 = evaluateSenderProviderBoundary({ purpose: 'sender_provider_boundary' });
  assertSafe(r2);
  assert.equal(r2.sender_provider_state, 'SENDER_PROVIDER_UNCONFIGURED');
});

test('(D) unknown / live sender -> fail-closed INVALID', () => {
  for (const src of ['helius_sender_live', 'jito_sender_live', 'rpc_provider_live', 'live_sender', 'unknown_thing']) {
    const r = evaluateSenderProviderBoundary({ purpose: 'sender_provider_boundary', sender_source: src });
    assertSafe(r);
    assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_INVALID');
    assert.equal(r.sender_provider_boundary_valid, false);
  }
});

test('(D) mock/fixture/disabled -> valid read-only only', () => {
  for (const src of ['mock_sender_metadata', 'fixture_sender_metadata', 'disabled_sender']) {
    const r = evaluateSenderProviderBoundary({ purpose: 'sender_provider_boundary', sender_source: src });
    assertSafe(r);
    assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_READ_ONLY_OK');
    assert.equal(r.sender_provider_boundary_valid, true);
    assert.equal(r.sender_disabled, true);
    assert.equal(r.broadcast_performed, false);
    assert.equal(r.rpc_connected, false);
    assert.equal(r.endpoint_resolved, false);
    assert.equal(r.network_call_made, false);
  }
});

test('(D) helius/jito/rpc disabled markers accepted ONLY as disabled/read-only', () => {
  for (const src of ['helius_sender_disabled', 'jito_sender_disabled', 'rpc_provider_disabled']) {
    const r = evaluateSenderProviderBoundary({ purpose: 'sender_provider_boundary', sender_source: src });
    assertSafe(r);
    assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_READ_ONLY_OK');
    assert.equal(r.sender_disabled, true);
    assert.equal(r.broadcast_performed, false);
    assert.equal(r.rpc_connected, false);
    assert.equal(r.endpoint_resolved, false);
    assert.equal(r.network_call_made, false);
    // disabled markers NEVER open any readiness/send flag
    assert.equal(r.can_send, false);
    assert.equal(r.can_broadcast, false);
  }
});

test('(D) endpoint URL field -> refused & never echoed', () => {
  const r = evaluateSenderProviderBoundary({
    purpose: 'sender_provider_boundary', sender_source: 'mock_sender_metadata',
    rpc_url: 'https://sender.example.com/LEAK'
  });
  assertSafe(r);
  assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_INVALID');
  assert.equal(JSON.stringify(r).includes('LEAK'), false);
});

test('(D) api_key/secret/serialized_tx/signature -> refused & never echoed', () => {
  for (const s of [{ api_key: 'sk-LEAK' }, { secret: 'LEAK' }, { serialized_tx: 'LEAK' },
    { signature: 'LEAK' }, { signed_transaction: 'LEAK' }]) {
    const r = evaluateSenderProviderBoundary({
      purpose: 'sender_provider_boundary', sender_source: 'mock_sender_metadata', ...s
    });
    assertSafe(r);
    assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(D) smuggled send/broadcast flags -> refused', () => {
  for (const s of [{ can_send: true }, { can_broadcast: true }, { broadcast_permitted: true },
    { send: true }, { broadcast: true }, { connect_rpc: true }]) {
    const r = evaluateSenderProviderBoundary({
      purpose: 'sender_provider_boundary', sender_source: 'mock_sender_metadata', ...s
    });
    assertSafe(r);
    assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_INVALID');
  }
});

test('(D) mainnet / REAL-LIVE / bad purpose -> refused', () => {
  for (const s of [{ network: 'mainnet' }, { mode: 'prod' }, { real_live: true }]) {
    const r = evaluateSenderProviderBoundary({
      purpose: 'sender_provider_boundary', sender_source: 'mock_sender_metadata', ...s
    });
    assertSafe(r);
    assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_INVALID');
  }
  const r2 = evaluateSenderProviderBoundary({ purpose: 'execute', sender_source: 'mock_sender_metadata' });
  assertSafe(r2);
  assert.equal(r2.sender_provider_state, 'SENDER_PROVIDER_INVALID');
});

test('(D) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSenderProviderBoundary(h); });
    assertSafe(r);
    assert.equal(r.sender_provider_state, 'SENDER_PROVIDER_UNCONFIGURED');
  }
});

// ===========================================================================
// (E) CANDIDATE SEND-REVIEW DESCRIPTOR
// ===========================================================================

const validSendBoundary = evaluateSendReviewInputBoundary(goodSendInput());
const validSender = evaluateSenderProviderBoundary({
  purpose: 'sender_provider_boundary', sender_source: 'helius_sender_disabled'
});

const goodSendMetadata = () => ({
  sender_mode_bucket: 'disabled',
  bundle_bucket: 'no_bundle',
  tip_bucket: 'low',
  idempotency_bucket: 'bound',
  intent_binding_bucket: 'bound',
  requires_broadcast: false,
  requires_network: false,
  requires_serialization: false,
  requires_signature: false
});

const goodDescriptorInput = (over = {}) => ({
  purpose: 'candidate_send_review_descriptor_input',
  send_review_input_boundary: validSendBoundary,
  sender_provider_boundary: validSender,
  send_review_ref: 'send-1', signing_review_ref: 'sr-1', intent_record_ref: 'rec-1',
  send_metadata: goodSendMetadata(),
  ...over
});

test('(E) descriptor: shape, states, reason codes, safe flags', () => {
  const d = describeCandidateSendReviewDescriptorContract();
  assertSafe(d);
  assert.equal(d.contract, 'candidate-send-review-descriptor');
  assert.equal(d.candidate_send_review_valid, false);
  assert.equal(d.send_review_kind, 'candidate_send_review_descriptor');
  assertNoSendArtifacts(d);
  assert.deepEqual([...d.supported_states], [
    'CANDIDATE_SEND_REVIEW_UNCONFIGURED', 'CANDIDATE_SEND_REVIEW_INVALID',
    'CANDIDATE_SEND_REVIEW_REJECTED', 'CANDIDATE_SEND_REVIEW_DEGRADED',
    'CANDIDATE_SEND_REVIEW_DESCRIPTOR'
  ]);
});

test('(E) missing input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateCandidateSendReviewDescriptor(inp);
    assertSafe(r);
    assert.equal(r.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_UNCONFIGURED');
  }
  const r2 = evaluateCandidateSendReviewDescriptor({
    purpose: 'candidate_send_review_descriptor_input',
    send_review_input_boundary: validSendBoundary
  });
  assertSafe(r2);
  assert.equal(r2.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_UNCONFIGURED');
});

test('(E) invalid source boundary -> fail-closed REJECTED', () => {
  // send-review boundary not VALID (degraded verdict feeds a degraded boundary)
  const degReadiness = evaluateSignerCustodyReadinessAdvisory({
    purpose: 'signer_custody_readiness_input',
    key_custody_mode_bucket: 'isolated_signer', signer_profile_status_bucket: 'active',
    dual_control_bucket: 'required_satisfied', signer_reachability_bucket: 'unknown',
    custody_verification_bucket: 'verified'
  });
  const degVerdict = evaluateSigningReviewVerdict({
    purpose: 'signing_review_verdict_input',
    signing_review_input_boundary: signingBoundaryValid, signer_custody_boundary: signingCustodyValid,
    candidate_signing_review_descriptor: signingDescriptor,
    signer_custody_readiness_advisory: degReadiness, private_key_surface: signingKeySurface
  });
  const notValidBoundary = evaluateSendReviewInputBoundary({ ...goodSendInput(), signing_review_verdict: degVerdict });
  assert.notEqual(notValidBoundary.send_review_input_state, 'SEND_REVIEW_INPUT_VALID');
  const r1 = evaluateCandidateSendReviewDescriptor(goodDescriptorInput({ send_review_input_boundary: notValidBoundary }));
  assertSafe(r1);
  assert.equal(r1.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_REJECTED');
  assert.equal(r1.send_review_reason_codes.includes('send_review_input_not_valid'), true);
  // sender not READ_ONLY_OK
  const badSender = evaluateSenderProviderBoundary({ purpose: 'sender_provider_boundary', sender_source: 'live_sender' });
  const r2 = evaluateCandidateSendReviewDescriptor(goodDescriptorInput({ sender_provider_boundary: badSender }));
  assert.equal(r2.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_REJECTED');
  assert.equal(r2.send_review_reason_codes.includes('sender_provider_not_valid'), true);
});

test('(E) valid fixture metadata -> descriptor only (no readiness)', () => {
  const r = evaluateCandidateSendReviewDescriptor(goodDescriptorInput());
  assertSafe(r);
  assert.equal(r.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_DESCRIPTOR');
  assert.equal(r.candidate_send_review_valid, true);
  assert.equal(r.send_review_kind, 'candidate_send_review_descriptor');
  assert.equal(r.send_review_ref, 'send-1');
  assert.equal(r.signing_review_ref, 'sr-1');
  assert.equal(r.intent_record_ref, 'rec-1');
  assert.equal(r.send_review_reason_codes.includes('candidate_send_review_reviewed'), true);
  assertNoSendArtifacts(r);
  // descriptor opens NO can_send / can_broadcast / broadcast_permitted / serialized_ready
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.broadcast_permitted, false);
  assert.equal(r.serialized_ready, false);
});

test('(E) unbound idempotency / intent binding -> rejected', () => {
  const cases = [
    [{ idempotency_bucket: 'unbound' }, 'idempotency_unbound'],
    [{ intent_binding_bucket: 'unbound' }, 'intent_binding_unbound']
  ];
  for (const [over, code] of cases) {
    const r = evaluateCandidateSendReviewDescriptor(goodDescriptorInput({
      send_metadata: { ...goodSendMetadata(), ...over }
    }));
    assertSafe(r);
    assert.equal(r.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_REJECTED');
    assert.equal(r.send_review_reason_codes.includes(code), true);
    assert.equal(r.candidate_send_review_valid, false);
  }
});

test('(E) unknown bucket -> degraded (no descriptor)', () => {
  for (const over of [{ sender_mode_bucket: 'unknown' }, { bundle_bucket: 'unknown' },
    { tip_bucket: 'unknown' }, { idempotency_bucket: 'unknown' }, { intent_binding_bucket: 'unknown' }]) {
    const r = evaluateCandidateSendReviewDescriptor(goodDescriptorInput({
      send_metadata: { ...goodSendMetadata(), ...over }
    }));
    assertSafe(r);
    assert.equal(r.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_DEGRADED');
    assert.equal(r.candidate_send_review_valid, false);
  }
});

test('(E) requires_broadcast/network/serialization/signature !== false -> INVALID', () => {
  for (const over of [{ requires_broadcast: true }, { requires_network: true },
    { requires_serialization: true }, { requires_signature: true }, { requires_broadcast: 'maybe' }]) {
    const r = evaluateCandidateSendReviewDescriptor(goodDescriptorInput({
      send_metadata: { ...goodSendMetadata(), ...over }
    }));
    assertSafe(r);
    assert.equal(r.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_INVALID');
  }
});

test('(E) smuggled send/endpoint/serialized/signature fields -> refused & VALUE not echoed', () => {
  for (const s of [{ can_send: true }, { can_broadcast: true }, { send: true },
    { endpoint: 'LEAK' }, { rpc_url: 'https://x/LEAK' }, { serialized_tx: 'LEAK' },
    { signed_transaction: 'LEAK' }, { signature: 'LEAK' }, { message_bytes: 'LEAK' },
    { private_key: 'LEAK' }, { api_key: 'sk-LEAK' }]) {
    const r = evaluateCandidateSendReviewDescriptor({ ...goodDescriptorInput(), ...s });
    assertSafe(r);
    assert.equal(r.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
    assertNoSendArtifacts(r);
  }
});

test('(E) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCandidateSendReviewDescriptor(h); });
    assertSafe(r);
    assert.equal(r.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_UNCONFIGURED');
  }
});

test('(E) descriptor never exposes any endpoint/serialized/signature artifact', () => {
  const states = [
    evaluateCandidateSendReviewDescriptor(goodDescriptorInput()),
    evaluateCandidateSendReviewDescriptor(goodDescriptorInput({ send_metadata: { ...goodSendMetadata(), idempotency_bucket: 'unbound' } })),
    evaluateCandidateSendReviewDescriptor(goodDescriptorInput({ send_metadata: { ...goodSendMetadata(), tip_bucket: 'unknown' } })),
    evaluateCandidateSendReviewDescriptor(undefined)
  ];
  for (const r of states) {
    assertSafe(r);
    assertNoSendArtifacts(r);
  }
});

// ===========================================================================
// (F) SEND-READINESS ADVISORY
// ===========================================================================

const goodReadinessInput = (over = {}) => ({
  purpose: 'send_readiness_input',
  sender_status_bucket: 'disabled',
  idempotency_bucket: 'bound',
  intent_binding_bucket: 'bound',
  bundle_bucket: 'no_bundle',
  tip_bucket: 'low',
  ...over
});

test('(F) descriptor: shape, states, reason codes, safe flags', () => {
  const d = describeSendReadinessAdvisoryContract();
  assertSafe(d);
  assert.equal(d.contract, 'send-readiness-advisory');
  assert.equal(d.send_readiness_acceptable_advisory, false);
  assert.equal(d.send_readiness_rejected, false);
  assertNoSendArtifacts(d);
  assert.deepEqual([...d.supported_states], [
    'SEND_READINESS_UNCONFIGURED', 'SEND_READINESS_INVALID',
    'SEND_READINESS_DEGRADED', 'SEND_READINESS_REJECTED',
    'SEND_READINESS_ACCEPTABLE_ADVISORY'
  ]);
});

test('(F) missing bucket -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSendReadinessAdvisory(inp);
    assertSafe(r);
    assert.equal(r.send_readiness_state, 'SEND_READINESS_UNCONFIGURED');
  }
  const r2 = evaluateSendReadinessAdvisory({
    purpose: 'send_readiness_input', sender_status_bucket: 'disabled'
  });
  assertSafe(r2);
  assert.equal(r2.send_readiness_state, 'SEND_READINESS_UNCONFIGURED');
});

test('(F) invalid enum bucket -> INVALID', () => {
  for (const over of [{ sender_status_bucket: 'live' }, { idempotency_bucket: 'on' },
    { intent_binding_bucket: 'maybe' }, { bundle_bucket: 'bundled' }, { tip_bucket: 'huge' }]) {
    const r = evaluateSendReadinessAdvisory(goodReadinessInput(over));
    assertSafe(r);
    assert.equal(r.send_readiness_state, 'SEND_READINESS_INVALID');
    assert.equal(r.valid, false);
  }
});

test('(F) unbound idempotency / intent binding -> rejected (live/enabled not possible via bucket)', () => {
  const cases = [
    [{ idempotency_bucket: 'unbound' }, 'idempotency_unbound'],
    [{ intent_binding_bucket: 'unbound' }, 'intent_binding_unbound']
  ];
  for (const [over, code] of cases) {
    const r = evaluateSendReadinessAdvisory(goodReadinessInput(over));
    assertSafe(r);
    assert.equal(r.send_readiness_state, 'SEND_READINESS_REJECTED');
    assert.equal(r.send_readiness_rejected, true);
    assert.equal(r.send_review_reason_codes.includes(code), true);
  }
});

test('(F) live/enabled sender smuggled as a flag -> INVALID', () => {
  for (const s of [{ can_send: true }, { can_broadcast: true }, { send: true }, { is_live: true }]) {
    const r = evaluateSendReadinessAdvisory({ ...goodReadinessInput(), ...s });
    assertSafe(r);
    assert.equal(r.send_readiness_state, 'SEND_READINESS_INVALID');
  }
});

test('(F) unknown buckets / degraded sender -> degraded', () => {
  for (const over of [{ sender_status_bucket: 'unknown' }, { idempotency_bucket: 'unknown' },
    { intent_binding_bucket: 'unknown' }, { bundle_bucket: 'unknown' }, { tip_bucket: 'unknown' },
    { sender_status_bucket: 'degraded' }]) {
    const r = evaluateSendReadinessAdvisory(goodReadinessInput(over));
    assertSafe(r);
    assert.equal(r.send_readiness_state, 'SEND_READINESS_DEGRADED');
    assert.equal(r.send_readiness_acceptable_advisory, false);
  }
});

test('(F) acceptable (disabled/ready+bound+bound+bundle+tip) -> advisory acceptable only', () => {
  const r = evaluateSendReadinessAdvisory(goodReadinessInput());
  assertSafe(r);
  assert.equal(r.send_readiness_state, 'SEND_READINESS_ACCEPTABLE_ADVISORY');
  assert.equal(r.send_readiness_acceptable_advisory, true);
  assert.equal(r.send_review_reason_codes.includes('send_readiness_acceptable'), true);
  assertNoSendArtifacts(r);
  // ready_advisory also acceptable
  const r2 = evaluateSendReadinessAdvisory(goodReadinessInput({ sender_status_bucket: 'ready_advisory' }));
  assert.equal(r2.send_readiness_state, 'SEND_READINESS_ACCEPTABLE_ADVISORY');
  // acceptable opens NO can_send / can_broadcast / broadcast_permitted
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.broadcast_permitted, false);
  assert.equal(r.serialized_ready, false);
});

test('(F) smuggled forbidden flag / secret / endpoint / send-material -> INVALID & never echoed', () => {
  for (const s of [{ can_send: true }, { broadcast: true }, { secret: 'LEAK' },
    { rpc_url: 'https://x/LEAK' }, { serialized_tx: 'LEAK' }, { real_live: true }]) {
    const r = evaluateSendReadinessAdvisory({ ...goodReadinessInput(), ...s });
    assertSafe(r);
    assert.equal(r.send_readiness_state, 'SEND_READINESS_INVALID');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(F) no endpoint/serialized/signature field in output across states', () => {
  for (const r of [
    evaluateSendReadinessAdvisory(goodReadinessInput()),
    evaluateSendReadinessAdvisory(goodReadinessInput({ idempotency_bucket: 'unbound' })),
    evaluateSendReadinessAdvisory(goodReadinessInput({ sender_status_bucket: 'unknown' })),
    evaluateSendReadinessAdvisory(undefined)
  ]) {
    assertSafe(r);
    assertNoSendArtifacts(r);
  }
});

test('(F) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendReadinessAdvisory(h); });
    assertSafe(r);
    assert.equal(r.send_readiness_state, 'SEND_READINESS_UNCONFIGURED');
  }
});

// ===========================================================================
// (G) BROADCAST / LIVE FORBIDDEN SURFACE GUARD
// ===========================================================================

test('(G) descriptor: shape, states, safe flags', () => {
  const d = describeBroadcastForbiddenSurfaceContract();
  assertSafe(d);
  assert.equal(d.contract, 'broadcast-forbidden-surface');
  assert.equal(d.live_surface_detected, false);
  assert.equal(d.broadcast_material_detected, false);
  assert.equal(d.forbidden_field_detected, false);
  assert.equal(d.forbidden_field_ref, null);
  assert.deepEqual([...d.supported_states], [
    'BROADCAST_SURFACE_UNCONFIGURED', 'BROADCAST_SURFACE_CLEAN', 'BROADCAST_SURFACE_BLOCKED'
  ]);
});

test('(G) missing / hostile input -> UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateBroadcastForbiddenSurface(inp);
    assertSafe(r);
    assert.equal(r.broadcast_surface_state, 'BROADCAST_SURFACE_UNCONFIGURED');
  }
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateBroadcastForbiddenSurface(h); });
    assertSafe(r);
    assert.equal(r.broadcast_surface_state, 'BROADCAST_SURFACE_UNCONFIGURED');
  }
});

test('(G) clean descriptor -> surface clean (no detection)', () => {
  const r = evaluateBroadcastForbiddenSurface({
    purpose: 'candidate_send_review_descriptor', send_review_ref: 'send-1',
    sender_mode_bucket: 'disabled', idempotency_bucket: 'bound'
  });
  assertSafe(r);
  assert.equal(r.broadcast_surface_state, 'BROADCAST_SURFACE_CLEAN');
  assert.equal(r.live_surface_detected, false);
  assert.equal(r.broadcast_material_detected, false);
  assert.equal(r.forbidden_field_detected, false);
  assert.equal(r.forbidden_field_ref, null);
});

test('(G) endpoint-only field -> blocked, endpoint vs material classification', () => {
  for (const name of ['endpoint', 'endpoint_url', 'endpointUrl', 'rpc_url', 'rpcUrl', 'rpc_endpoint',
    'provider_url', 'providerUrl', 'node_url', 'nodeUrl', 'ws_url', 'wss_url', 'http_endpoint']) {
    const planted = `PLANTED-${name}-ENDPOINT-VALUE`;
    const r = evaluateBroadcastForbiddenSurface({ [name]: planted });
    assertSafe(r);
    assert.equal(r.broadcast_surface_state, 'BROADCAST_SURFACE_BLOCKED');
    assert.equal(r.live_surface_detected, true);
    assert.equal(r.forbidden_field_detected, true);
    // endpoint names are NOT transaction/signature/payload -> broadcast_material_detected false
    assert.equal(r.broadcast_material_detected, false, `${name} is an endpoint-only name`);
    assert.equal(r.forbidden_field_ref, name);
    assert.equal(JSON.stringify(r).includes('PLANTED'), false, `${name} value must not be echoed`);
  }
});

test('(G) serialized_tx/signed_transaction/signature/payload -> blocked, material detected, VALUE never echoed', () => {
  for (const name of ['serialized_tx', 'serializedTx', 'serialized_transaction', 'signed_tx',
    'signedTransaction', 'signed_transaction', 'wire_transaction', 'raw_tx', 'raw_transaction',
    'tx_bytes', 'message_bytes', 'signature', 'signatures', 'broadcast_payload', 'send_payload']) {
    const planted = `PLANTED-${name}-MATERIAL-VALUE-9z9z`;
    const r = evaluateBroadcastForbiddenSurface({ [name]: planted });
    assertSafe(r);
    assert.equal(r.broadcast_surface_state, 'BROADCAST_SURFACE_BLOCKED');
    assert.equal(r.live_surface_detected, true);
    assert.equal(r.forbidden_field_detected, true);
    assert.equal(r.broadcast_material_detected, true, `${name} is a transaction/signature/payload name`);
    assert.equal(r.forbidden_field_ref, name);
    assert.equal(JSON.stringify(r).includes('PLANTED'), false, `${name} value must not be echoed`);
  }
});

test('(G) detection booleans are NOT readiness flags (blocked keeps 24 flags false)', () => {
  const r = evaluateBroadcastForbiddenSurface({ serialized_tx: 'PLANTED' });
  assertSafe(r);
  assert.equal(r.broadcast_surface_state, 'BROADCAST_SURFACE_BLOCKED');
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.broadcast_permitted, false);
});

// ===========================================================================
// (H) SEND-REVIEW VERDICT
// ===========================================================================

const cleanReadiness = evaluateSendReadinessAdvisory(goodReadinessInput());
const cleanSurface = evaluateBroadcastForbiddenSurface({ purpose: 'candidate_send_review_descriptor' });
const cleanDescriptor = evaluateCandidateSendReviewDescriptor(goodDescriptorInput());

const goodVerdictInput = (over = {}) => ({
  purpose: 'send_review_verdict_input',
  send_review_input_boundary: validSendBoundary,
  sender_provider_boundary: validSender,
  candidate_send_review_descriptor: cleanDescriptor,
  send_readiness_advisory: cleanReadiness,
  broadcast_surface: cleanSurface,
  ...over
});

test('(H) descriptor: shape, states, reason/explanation codes, safe flags', () => {
  const d = describeSendReviewVerdictContract();
  assertSafe(d);
  assert.equal(d.contract, 'send-review-verdict');
  assert.equal(d.send_review_passed_advisory, false);
  assert.equal(d.send_review_blocked, false);
  assert.deepEqual([...d.supported_states], [
    'SEND_REVIEW_UNCONFIGURED', 'SEND_REVIEW_DEGRADED',
    'SEND_REVIEW_BLOCKED', 'SEND_REVIEW_PASS_ADVISORY'
  ]);
});

test('(H) missing components -> unconfigured', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSendReviewVerdict(inp);
    assertSafe(r);
    assert.equal(r.send_review_state, 'SEND_REVIEW_UNCONFIGURED');
  }
  const r2 = evaluateSendReviewVerdict(goodVerdictInput({ broadcast_surface: undefined }));
  assertSafe(r2);
  assert.equal(r2.send_review_state, 'SEND_REVIEW_UNCONFIGURED');
});

test('(H) blocked component / broadcast-material detected -> blocked', () => {
  // broadcast surface blocked
  const blockedSurface = evaluateBroadcastForbiddenSurface({ serialized_tx: 'LEAK' });
  const r1 = evaluateSendReviewVerdict(goodVerdictInput({ broadcast_surface: blockedSurface }));
  assertSafe(r1);
  assert.equal(r1.send_review_state, 'SEND_REVIEW_BLOCKED');
  assert.equal(JSON.stringify(r1).includes('LEAK'), false);
  // send-readiness rejected -> blocked
  const rejReadiness = evaluateSendReadinessAdvisory(goodReadinessInput({ idempotency_bucket: 'unbound' }));
  const r2 = evaluateSendReviewVerdict(goodVerdictInput({ send_readiness_advisory: rejReadiness }));
  assert.equal(r2.send_review_state, 'SEND_REVIEW_BLOCKED');
  // descriptor invalid -> blocked
  const invDescriptor = evaluateCandidateSendReviewDescriptor({ ...goodDescriptorInput(), endpoint: 'X' });
  assert.equal(invDescriptor.candidate_send_review_state, 'CANDIDATE_SEND_REVIEW_INVALID');
  const r3 = evaluateSendReviewVerdict(goodVerdictInput({ candidate_send_review_descriptor: invDescriptor }));
  assert.equal(r3.send_review_state, 'SEND_REVIEW_BLOCKED');
});

test('(H) degraded readiness -> degraded', () => {
  const degReadiness = evaluateSendReadinessAdvisory(goodReadinessInput({ tip_bucket: 'unknown' }));
  assert.equal(degReadiness.send_readiness_state, 'SEND_READINESS_DEGRADED');
  const r = evaluateSendReviewVerdict(goodVerdictInput({ send_readiness_advisory: degReadiness }));
  assertSafe(r);
  assert.equal(r.send_review_state, 'SEND_REVIEW_DEGRADED');
});

test('(H) clean+acceptable+surface-clean -> pass advisory only (no readiness)', () => {
  const r = evaluateSendReviewVerdict(goodVerdictInput());
  assertSafe(r);
  assert.equal(r.send_review_state, 'SEND_REVIEW_PASS_ADVISORY');
  assert.equal(r.send_review_passed_advisory, true);
  assert.equal(r.send_review_reason_codes.includes('send_readiness_acceptable'), true);
  assert.equal(r.send_review_reason_codes.includes('broadcast_surface_clean'), true);
  // pass opens NO can_send / can_broadcast / broadcast_permitted
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.broadcast_permitted, false);
  assert.equal(r.serialized_ready, false);
});

test('(H) smuggled forbidden flag/exec/secret/endpoint -> blocked', () => {
  for (const s of [{ can_send: true }, { broadcast: true }, { secret: 'LEAK' }, { rpc_url: 'https://x/LEAK' },
    { real_live: true }, { serialized_tx: 'LEAK' }]) {
    const r = evaluateSendReviewVerdict({ ...goodVerdictInput(), ...s });
    assertSafe(r);
    assert.equal(r.send_review_state, 'SEND_REVIEW_BLOCKED');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(H) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendReviewVerdict(h); });
    assertSafe(r);
    assert.equal(r.send_review_state, 'SEND_REVIEW_UNCONFIGURED');
  }
});

// ===========================================================================
// (I) SEND-REVIEW SUPPRESSION / REJECTION
// ===========================================================================

const goodSuppressionInput = (over = {}) => ({
  purpose: 'send_review_suppression_input',
  send_review_input_boundary: validSendBoundary,
  candidate_send_review_descriptor: cleanDescriptor,
  send_readiness_advisory: cleanReadiness,
  broadcast_surface: cleanSurface,
  sender_provider_boundary: validSender,
  ...over
});

test('(I) descriptor: shape, reason codes, safe flags', () => {
  const d = describeSendReviewSuppressionContract();
  assertSafe(d);
  assert.equal(d.contract, 'send-review-suppression');
  assert.equal(d.suppressed, false);
  assert.deepEqual([...d.supported_reason_codes], [
    'input_not_reviewed', 'sender_provider_invalid', 'sender_metadata_missing',
    'sender_not_ready', 'idempotency_unbound', 'live_surface_detected',
    'broadcast_material_detected', 'not_send_authorized', 'not_broadcast_authorized',
    'not_execution_authorized'
  ]);
});

test('(I) missing descriptor -> suppressed + sender_metadata_missing', () => {
  const r = evaluateSendReviewSuppression(goodSuppressionInput({ candidate_send_review_descriptor: undefined }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('sender_metadata_missing'), true);
});

test('(I) invalid sender -> suppressed + sender_provider_invalid', () => {
  const badSender = evaluateSenderProviderBoundary({ purpose: 'sender_provider_boundary', sender_source: 'live_sender' });
  const r = evaluateSendReviewSuppression(goodSuppressionInput({ sender_provider_boundary: badSender }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('sender_provider_invalid'), true);
});

test('(I) input boundary not valid -> suppressed + input_not_reviewed', () => {
  const degReadiness = evaluateSignerCustodyReadinessAdvisory({
    purpose: 'signer_custody_readiness_input',
    key_custody_mode_bucket: 'isolated_signer', signer_profile_status_bucket: 'active',
    dual_control_bucket: 'required_satisfied', signer_reachability_bucket: 'unknown',
    custody_verification_bucket: 'verified'
  });
  const degVerdict = evaluateSigningReviewVerdict({
    purpose: 'signing_review_verdict_input',
    signing_review_input_boundary: signingBoundaryValid, signer_custody_boundary: signingCustodyValid,
    candidate_signing_review_descriptor: signingDescriptor,
    signer_custody_readiness_advisory: degReadiness, private_key_surface: signingKeySurface
  });
  const notValid = evaluateSendReviewInputBoundary({ ...goodSendInput(), signing_review_verdict: degVerdict });
  const r = evaluateSendReviewSuppression(goodSuppressionInput({ send_review_input_boundary: notValid }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('input_not_reviewed'), true);
});

test('(I) unacceptable readiness (rejected, idempotency) -> suppressed + sender_not_ready (+idempotency_unbound)', () => {
  const rejReadiness = evaluateSendReadinessAdvisory(goodReadinessInput({ idempotency_bucket: 'unbound' }));
  const r = evaluateSendReviewSuppression(goodSuppressionInput({ send_readiness_advisory: rejReadiness }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('sender_not_ready'), true);
  assert.equal(r.suppression_reasons.includes('idempotency_unbound'), true);
});

test('(I) live-surface detected -> suppressed + live_surface_detected', () => {
  const blockedSurface = evaluateBroadcastForbiddenSurface({ endpoint: 'LEAK' });
  const r = evaluateSendReviewSuppression(goodSuppressionInput({ broadcast_surface: blockedSurface }));
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('live_surface_detected'), true);
  assert.equal(JSON.stringify(r).includes('LEAK'), false);
});

test('(I) broadcast-material detected -> suppressed + broadcast_material_detected', () => {
  const matSurface = evaluateBroadcastForbiddenSurface({ serialized_tx: 'LEAK' });
  assert.equal(matSurface.broadcast_material_detected, true);
  assert.equal(matSurface.forbidden_field_detected, true);
  const r = evaluateSendReviewSuppression(goodSuppressionInput({ broadcast_surface: matSurface }));
  assertSafe(r);
  assert.equal(r.suppression_reasons.includes('live_surface_detected'), true);
  assert.equal(r.suppression_reasons.includes('broadcast_material_detected'), true);
});

test('(I) advisory clean -> STILL not send/broadcast authorized', () => {
  const r = evaluateSendReviewSuppression(goodSuppressionInput());
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('not_send_authorized'), true);
  assert.equal(r.suppression_reasons.includes('not_broadcast_authorized'), true);
  assert.equal(r.suppression_reasons.includes('not_execution_authorized'), true);
  // suppression opens NO can_send / can_broadcast / broadcast_permitted
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.broadcast_permitted, false);
});

test('(I) hostile -> frozen no throw (suppressed fail-closed)', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendReviewSuppression(h); });
    assertSafe(r);
    assert.equal(r.suppressed, true);
    assert.equal(r.suppression_reasons.includes('not_send_authorized'), true);
    assert.equal(r.suppression_reasons.includes('not_broadcast_authorized'), true);
  }
});

// ===========================================================================
// (J) SEND-REVIEW HEALTH / STATUS
// ===========================================================================

const cleanVerdict = evaluateSendReviewVerdict(goodVerdictInput());
const cleanSuppression = evaluateSendReviewSuppression(goodSuppressionInput());

const goodHealthInput = (over = {}) => ({
  send_review_input_boundary: validSendBoundary,
  sender_provider_boundary: validSender,
  candidate_send_review_descriptor: cleanDescriptor,
  send_readiness_advisory: cleanReadiness,
  broadcast_surface: cleanSurface,
  send_review_verdict: cleanVerdict,
  send_review_suppression: cleanSuppression,
  ...over
});

test('(J) descriptor: shape, states, safe flags', () => {
  const d = describeSendReviewHealthContract();
  assertSafe(d);
  assert.equal(d.contract, 'send-review-health');
  assert.deepEqual([...d.supported_states], [
    'SEND_REVIEW_HEALTH_UNCONFIGURED', 'SEND_REVIEW_HEALTH_DEGRADED',
    'SEND_REVIEW_HEALTH_REVIEWED_ADVISORY', 'SEND_REVIEW_HEALTH_SUPPRESSED',
    'SEND_REVIEW_HEALTH_BLOCKED'
  ]);
});

test('(J) missing components -> unconfigured', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateSendReviewHealth(inp);
    assertSafe(r);
    assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_UNCONFIGURED');
  }
  const r2 = evaluateSendReviewHealth(goodHealthInput({ send_review_verdict: undefined }));
  assertSafe(r2);
  assert.equal(r2.send_review_health_state, 'SEND_REVIEW_HEALTH_UNCONFIGURED');
});

test('(J) invalid boundary -> blocked', () => {
  const invBoundary = evaluateSendReviewInputBoundary({ ...goodSendInput(), can_send: true });
  assert.equal(invBoundary.send_review_input_state, 'SEND_REVIEW_INPUT_INVALID');
  const r = evaluateSendReviewHealth(goodHealthInput({ send_review_input_boundary: invBoundary }));
  assertSafe(r);
  assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_BLOCKED');
});

test('(J) invalid sender -> blocked', () => {
  const badSender = evaluateSenderProviderBoundary({ purpose: 'sender_provider_boundary', sender_source: 'live_sender' });
  const r = evaluateSendReviewHealth(goodHealthInput({ sender_provider_boundary: badSender }));
  assertSafe(r);
  assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_BLOCKED');
});

test('(J) broadcast-material detected -> blocked', () => {
  const blockedSurface = evaluateBroadcastForbiddenSurface({ serialized_tx: 'LEAK' });
  const r = evaluateSendReviewHealth(goodHealthInput({ broadcast_surface: blockedSurface }));
  assertSafe(r);
  assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_BLOCKED');
  assert.equal(JSON.stringify(r).includes('LEAK'), false);
});

test('(J) blocked verdict -> blocked', () => {
  const blockedVerdict = evaluateSendReviewVerdict(goodVerdictInput({ broadcast_surface: evaluateBroadcastForbiddenSurface({ signature: 'x' }) }));
  assert.equal(blockedVerdict.send_review_state, 'SEND_REVIEW_BLOCKED');
  const r = evaluateSendReviewHealth(goodHealthInput({ send_review_verdict: blockedVerdict }));
  assertSafe(r);
  assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_BLOCKED');
});

test('(J) suppressed (always-suppressed clean path) -> suppressed', () => {
  const r = evaluateSendReviewHealth(goodHealthInput({ send_review_suppression: cleanSuppression }));
  assertSafe(r);
  // cleanSuppression.suppressed === true (always suppressed for send/broadcast) -> SUPPRESSED
  assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_SUPPRESSED');
});

test('(J) advisory review pass + explicit not-suppressed -> reviewed advisory only', () => {
  const notSuppressed = Object.freeze({ suppressed: false, suppression_reasons: [], read_only: true });
  const r = evaluateSendReviewHealth(goodHealthInput({ send_review_suppression: notSuppressed }));
  assertSafe(r);
  assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_REVIEWED_ADVISORY');
  // reviewed advisory opens NO send / broadcast
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.broadcast_permitted, false);
  assert.equal(r.serialized_ready, false);
});

test('(J) smuggled send/broadcast flags -> blocked', () => {
  for (const s of [{ can_send: true }, { can_broadcast: true }, { broadcast_permitted: true },
    { send: true }, { broadcast: true }, { serialized_tx: 'LEAK' }]) {
    const r = evaluateSendReviewHealth({ ...goodHealthInput(), ...s });
    assertSafe(r);
    assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_BLOCKED');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(J) secret / mainnet / REAL-LIVE -> blocked', () => {
  for (const s of [{ secret: 'LEAK' }, { network: 'mainnet' }, { mode: 'prod' }, { real_live: true }]) {
    const r = evaluateSendReviewHealth({ ...goodHealthInput(), ...s });
    assertSafe(r);
    assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_BLOCKED');
    assert.equal(JSON.stringify(r).includes('LEAK'), false);
  }
});

test('(J) hostile -> frozen no throw', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendReviewHealth(h); });
    assertSafe(r);
    assert.equal(r.send_review_health_state, 'SEND_REVIEW_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// INTEGRATION CONSISTENCY — the existing send-gate STILL refuses
// ===========================================================================

test('integration: send-gate evaluateSendPreflight STILL refuses alongside a Stage-12 PASS_ADVISORY verdict', () => {
  // a real Stage-12 send-review verdict reaches PASS_ADVISORY (advisory only)
  const verdict = evaluateSendReviewVerdict(goodVerdictInput());
  assert.equal(verdict.send_review_state, 'SEND_REVIEW_PASS_ADVISORY');
  assert.equal(verdict.can_send, false);
  assert.equal(verdict.can_broadcast, false);
  // the EXISTING fail-closed send gate STILL refuses, even with a clean-looking request
  const pre = evaluateSendPreflight({
    sign_only_success: true, readiness_ready: true, preflight_ok: true, custody_status: 'ACTIVE'
  });
  assert.equal(pre.ok, false);
  assert.equal(pre.can_send, false);
  assert.equal(pre.can_broadcast, false);
  assert.equal(pre.sent, false);
  assert.equal(pre.broadcast, false);
  assert.equal(pre.reason, 'send_gate_unconfigured_no_rpc');
  assert.equal(pre.blockers.includes('send_gate_unconfigured_no_rpc'), true);
});

// ===========================================================================
// STATIC SOURCE GUARD
// ===========================================================================

test('static guard: src has no "can_send: true" literal, is import-free, no mutable module state, no forbidden output key / planted VALUE literal', () => {
  const files = [
    '../src/send-broadcast-review-foundations.mjs',
    '../src/index.mjs'
  ].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    assert.equal(/can_broadcast\s*:\s*true/.test(src), false, `${f} must not contain can_broadcast: true`);
    assert.equal(/broadcast_permitted\s*:\s*true/.test(src), false, `${f} must not contain broadcast_permitted: true`);
    if (f.endsWith('send-broadcast-review-foundations.mjs')) {
      // import-free implementation
      assert.equal(/^\s*import\s/m.test(src), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(src), false, 'implementation must not use require(');
      // no mutable module-level array (e.g. `const store = []` / `let ledger = []`)
      assert.equal(/\b(const|let|var)\s+\w*(sender|records|store|ledger|payload|descriptor)\w*\s*=\s*\[\s*\]/i.test(src), false,
        'implementation must hold no mutable module-level array');
      // no network/clock/persistence/send primitives
      assert.equal(/fetch\s*\(|new\s+WebSocket|new\s+Connection|sendTransaction|sendRawTransaction|\.sign\s*\(/.test(src), false, 'no network/send primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env/.test(src), false, 'no clock/env');
      // no planted endpoint/url/serialized-tx/signature VALUE assignment literal
      // (forbidden names may appear ONLY as quoted allowlist field-name string literals)
      assert.equal(/\b(rpc_url|endpoint_url|serialized_tx|signed_transaction|wire_transaction|broadcast_payload)\s*[:=]\s*['"`][^'"`]/.test(src), false,
        'implementation must hold no endpoint/serialized/signature VALUE literal');
    }
  }
});
