// PR-S13 test suite for @soltrade/pipeline-decision-trace-foundations
// node:test + node:assert/strict. Deterministic. Builds a REAL Stage-4 -> 5 -> 6
// -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 chain (via the lower-stage evaluators) to the
// terminal results of Stages 6-12, assembles the Stage-13 bundle, and exercises
// every Stage-13 foundation (A-G) plus a static source guard.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describePipelineDecisionTraceInputBoundaryContract,
  evaluatePipelineDecisionTraceInputBoundary,
  describePipelineDecisionTraceContract,
  evaluatePipelineDecisionTrace,
  describePipelineHealthReadModelContract,
  evaluatePipelineHealthReadModel,
  describePipelineDecisionVerdictContract,
  evaluatePipelineDecisionVerdict,
  describePipelineDecisionSuppressionContract,
  evaluatePipelineDecisionSuppression,
  describePipelineForbiddenSurfaceContract,
  evaluatePipelineForbiddenSurface,
  describePipelineDecisionHealthContract,
  evaluatePipelineDecisionHealth
} from '../src/index.mjs';

// Stage-12 send/broadcast-review foundation
import {
  evaluateSendReviewInputBoundary,
  evaluateSenderProviderBoundary,
  evaluateCandidateSendReviewDescriptor,
  evaluateSendReadinessAdvisory,
  evaluateBroadcastForbiddenSurface,
  evaluateSendReviewVerdict,
  evaluateSendReviewSuppression,
  evaluateSendReviewHealth
} from '../../send-broadcast-review-foundations/src/index.mjs';

// Stage-11 signing-review foundation
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

// ---------------------------------------------------------------------------
// REAL Stage-4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 builders
// (copied verbatim from the send-broadcast-review-foundations test chain)
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

// Stage-12 send-review results (PASS ADVISORY + health path)
const goodSendInput = () => ({
  purpose: 'send_review_input_boundary',
  signing_review_verdict: signingVerdictPass,
  signing_review_health: signingHealth
});
const sendBoundaryValid = evaluateSendReviewInputBoundary(goodSendInput());
const senderProviderValid = evaluateSenderProviderBoundary({
  purpose: 'sender_provider_boundary', sender_source: 'helius_sender_disabled'
});
const sendMetadata = () => ({
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
const sendDescriptor = evaluateCandidateSendReviewDescriptor({
  purpose: 'candidate_send_review_descriptor_input',
  send_review_input_boundary: sendBoundaryValid,
  sender_provider_boundary: senderProviderValid,
  send_review_ref: 'snd-1', signing_review_ref: 'sr-1', intent_record_ref: 'rec-1',
  send_metadata: sendMetadata()
});
const sendReadiness = evaluateSendReadinessAdvisory({
  purpose: 'send_readiness_input',
  sender_status_bucket: 'disabled',
  bundle_bucket: 'no_bundle',
  tip_bucket: 'low',
  idempotency_bucket: 'bound',
  intent_binding_bucket: 'bound'
});
const sendBroadcastSurface = evaluateBroadcastForbiddenSurface({ purpose: 'candidate_send_review_descriptor' });
const sendVerdictPass = evaluateSendReviewVerdict({
  purpose: 'send_review_verdict_input',
  send_review_input_boundary: sendBoundaryValid,
  sender_provider_boundary: senderProviderValid,
  candidate_send_review_descriptor: sendDescriptor,
  send_readiness_advisory: sendReadiness,
  broadcast_surface: sendBroadcastSurface
});
const sendSuppression = evaluateSendReviewSuppression({
  purpose: 'send_review_suppression_input',
  send_review_input_boundary: sendBoundaryValid,
  candidate_send_review_descriptor: sendDescriptor,
  send_readiness_advisory: sendReadiness,
  broadcast_surface: sendBroadcastSurface,
  sender_provider_boundary: senderProviderValid
});
const sendHealth = evaluateSendReviewHealth({
  send_review_input_boundary: sendBoundaryValid,
  sender_provider_boundary: senderProviderValid,
  candidate_send_review_descriptor: sendDescriptor,
  send_readiness_advisory: sendReadiness,
  broadcast_surface: sendBroadcastSurface,
  send_review_verdict: sendVerdictPass,
  send_review_suppression: sendSuppression
});

// ---------------------------------------------------------------------------
// Stage-13 bundle of terminal results (clean end-to-end)
// ---------------------------------------------------------------------------

const goodBundle = () => ({
  purpose: 'pipeline_decision_trace_input',
  signal_health: sigHealth,
  risk_verdict: verdictPass,
  risk_health: riskHealthPass,
  intent_terminal: intentStateAwaiting,
  intent_health: intentHealthAwaiting,
  route_verdict: previewValid,
  route_health: routeHealthPreviewReady,
  signing_review_verdict: signingVerdictPass,
  signing_review_health: signingHealth,
  send_review_verdict: sendVerdictPass,
  send_review_health: sendHealth
});

// sanity: the real upstream chain reached its terminal advisory states
test('preconditions: real Stage-6..12 chain reaches terminal advisory states', () => {
  assert.equal(sigHealth.signal_state, 'SIGNAL_READY_ADVISORY');
  assert.equal(verdictPass.risk_verdict_state, 'RISK_PASS_ADVISORY');
  assert.equal(intentStateAwaiting.intent_state, 'INTENT_AWAITING_ROUTE_REVIEW');
  assert.equal(previewValid.execution_plan_preview_state, 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID');
  assert.equal(signingVerdictPass.signing_review_state, 'SIGNING_REVIEW_PASS_ADVISORY');
  assert.equal(sendVerdictPass.send_review_state, 'SEND_REVIEW_PASS_ADVISORY');
  // signing/send health are SUPPRESSED by design (always-suppressed upstream)
  assert.equal(signingHealth.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_SUPPRESSED');
  assert.equal(sendHealth.send_review_health_state, 'SEND_REVIEW_HEALTH_SUPPRESSED');
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
  for (const f of EXEC_FLAGS) {
    assert.equal(res[f], false, `flag ${f} must be false`);
  }
}

const FORBIDDEN_OUTPUT_KEYS = [
  'private_key', 'secret_key', 'keypair', 'mnemonic', 'seed', 'signing_key',
  'signature', 'signed_tx', 'signed_transaction', 'endpoint', 'endpoint_url',
  'rpc_url', 'provider_url', 'node_url', 'ws_url', 'serialized_tx',
  'serialized_transaction', 'wire_transaction', 'raw_tx', 'raw_transaction',
  'tx_bytes', 'message_bytes', 'broadcast_payload', 'send_payload'
];

function assertNoForbiddenKeys(res) {
  for (const k of FORBIDDEN_OUTPUT_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(res, k), false, `output must not contain ${k}`);
  }
}

const hostiles = () => {
  const throwing = new Proxy({}, { get() { throw new Error('hostile'); } });
  const fnReturning = new Proxy({}, { get() { return () => true; } });
  return [throwing, fnReturning];
};

// recursively assert a planted substring is absent from JSON.stringify of a result
function assertAbsent(res, needle) {
  assert.equal(JSON.stringify(res).includes(needle), false, `output must not echo ${needle}`);
}

// ===========================================================================
// (A) PIPELINE DECISION-TRACE INPUT BOUNDARY
// ===========================================================================

test('(A) descriptor: shape, states, safe flags', () => {
  const d = describePipelineDecisionTraceInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'pipeline-decision-trace-input-boundary');
  assert.equal(d.eligible_for_trace, false);
  assert.deepEqual([...d.supported_states], [
    'PIPELINE_TRACE_INPUT_UNCONFIGURED', 'PIPELINE_TRACE_INPUT_INVALID',
    'PIPELINE_TRACE_INPUT_DEGRADED', 'PIPELINE_TRACE_INPUT_VALID'
  ]);
});

test('(A) clean bundle -> VALID, eligible', () => {
  const r = evaluatePipelineDecisionTraceInputBoundary(goodBundle());
  assertSafe(r);
  assert.equal(r.pipeline_trace_input_state, 'PIPELINE_TRACE_INPUT_VALID');
  assert.equal(r.eligible_for_trace, true);
  assertNoForbiddenKeys(r);
});

test('(A) missing/hostile input -> UNCONFIGURED, never throws', () => {
  for (const inp of [undefined, null, [], 42, 'x', ...hostiles()]) {
    const r = evaluatePipelineDecisionTraceInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.pipeline_trace_input_state, 'PIPELINE_TRACE_INPUT_UNCONFIGURED');
    assert.equal(r.eligible_for_trace, false);
  }
});

test('(A) missing required terminal result -> DEGRADED', () => {
  const b = goodBundle();
  delete b.send_review_verdict;
  const r = evaluatePipelineDecisionTraceInputBoundary(b);
  assertSafe(r);
  assert.equal(r.pipeline_trace_input_state, 'PIPELINE_TRACE_INPUT_DEGRADED');
  assert.equal(r.eligible_for_trace, false);
});

test('(A) raw non-result object in a slot -> INVALID', () => {
  const b = goodBundle();
  b.risk_verdict = { not_a_result: true };
  const r = evaluatePipelineDecisionTraceInputBoundary(b);
  assertSafe(r);
  assert.equal(r.pipeline_trace_input_state, 'PIPELINE_TRACE_INPUT_INVALID');
});

test('(A) smuggled exec flag / command / secret / endpoint / mainnet -> INVALID, never echoed', () => {
  const smuggles = [
    { can_send: true },
    { execute: true },
    { api_key: 'LEAK-SECRET-VALUE' },
    { node_url: 'https://LEAK.example/rpc' },
    { network: 'mainnet-LEAK' }
  ];
  for (const s of smuggles) {
    const r = evaluatePipelineDecisionTraceInputBoundary({ ...goodBundle(), ...s });
    assertSafe(r);
    assert.equal(r.pipeline_trace_input_state, 'PIPELINE_TRACE_INPUT_INVALID');
    assertAbsent(r, 'LEAK');
  }
});

test('(A) smuggled forbidden field NAME -> INVALID, value absent', () => {
  for (const name of ['private_key', 'seed', 'serialized_tx', 'signature', 'endpoint']) {
    const r = evaluatePipelineDecisionTraceInputBoundary({ ...goodBundle(), [name]: 'PLANTED-VALUE-9z9z' });
    assertSafe(r);
    assert.equal(r.pipeline_trace_input_state, 'PIPELINE_TRACE_INPUT_INVALID');
    assertAbsent(r, 'PLANTED');
  }
});

// ===========================================================================
// (B) PIPELINE DECISION-TRACE COMPOSER
// ===========================================================================

test('(B) descriptor: shape, outcomes, decisive reasons', () => {
  const d = describePipelineDecisionTraceContract();
  assertSafe(d);
  assert.equal(d.contract, 'pipeline-decision-trace');
  assert.deepEqual([...d.supported_stages], ['signal', 'risk', 'intent', 'route', 'signing_review', 'send_review']);
});

test('(B) clean bundle -> 6 ordered entries, all advanced, reviewed_advisory_all_stages', () => {
  const r = evaluatePipelineDecisionTrace(goodBundle());
  assertSafe(r);
  assert.equal(r.overall_outcome, 'reviewed_advisory_all_stages');
  assert.equal(r.trace_entries.length, 6);
  assert.deepEqual(r.trace_entries.map((e) => e.stage),
    ['signal', 'risk', 'intent', 'route', 'signing_review', 'send_review']);
  // each entry advanced + correct copied state strings
  const byStage = Object.fromEntries(r.trace_entries.map((e) => [e.stage, e]));
  assert.equal(byStage.signal.stage_state, 'SIGNAL_READY_ADVISORY');
  assert.equal(byStage.risk.stage_state, 'RISK_PASS_ADVISORY');
  assert.equal(byStage.intent.stage_state, 'INTENT_AWAITING_ROUTE_REVIEW');
  assert.equal(byStage.route.stage_state, 'EXECUTION_PLAN_PREVIEW_PREVIEW_VALID');
  assert.equal(byStage.signing_review.stage_state, 'SIGNING_REVIEW_PASS_ADVISORY');
  assert.equal(byStage.send_review.stage_state, 'SEND_REVIEW_PASS_ADVISORY');
  for (const e of r.trace_entries) {
    assert.equal(e.advanced, true);
    assert.equal(e.blocked, false);
    // each advanced terminal -> an allowlisted advisory reason
    assert.equal(['reviewed_advisory', 'advanced_advisory', 'suppressed'].includes(e.decisive_reason), true,
      `unexpected decisive_reason ${e.decisive_reason} for ${e.stage}`);
    assert.equal(Object.isFrozen(e), true);
  }
  // signal/risk/route/signing/send terminal-advisory -> reviewed_advisory;
  // intent AWAITING_ROUTE_REVIEW -> advanced_advisory
  assert.equal(byStage.signal.decisive_reason, 'reviewed_advisory');
  assert.equal(byStage.intent.decisive_reason, 'advanced_advisory');
  assertNoForbiddenKeys(r);
});

test('(B) a blocked stage -> blocked_at_stage, blocked entry, others still listed', () => {
  // build a real BLOCKED risk verdict (hard-risk honeypot)
  const hardBlock = evaluateHardRiskGate({
    purpose: 'hard_risk_input',
    candidate_signal: walletLed,
    risk_input_boundary: riskBoundaryValid,
    risk_factors: {
      honeypot_indicator: true, freeze_authority_indicator: false,
      mint_authority_indicator: false, owner_concentration_indicator: false,
      blacklist_indicator: false, unknown_token_metadata: false
    }
  });
  const verdictBlocked = evaluateRiskVerdict({ purpose: 'risk_verdict_input', hard_risk: hardBlock, liquidity_exit: liqPass, exposure: expPass });
  assert.equal(verdictBlocked.risk_verdict_state, 'RISK_BLOCKED');
  const r = evaluatePipelineDecisionTrace({ ...goodBundle(), risk_verdict: verdictBlocked });
  assertSafe(r);
  assert.equal(r.overall_outcome, 'blocked_at_stage');
  assert.equal(r.trace_entries.length, 6);
  const risk = r.trace_entries.find((e) => e.stage === 'risk');
  assert.equal(risk.stage_state, 'RISK_BLOCKED');
  assert.equal(risk.blocked, true);
  assert.equal(risk.decisive_reason, 'stage_blocked');
});

test('(B) missing stage verdict -> unconfigured + stage_missing entry', () => {
  const b = goodBundle();
  delete b.route_verdict;
  const r = evaluatePipelineDecisionTrace(b);
  assertSafe(r);
  assert.equal(r.overall_outcome, 'unconfigured');
  const route = r.trace_entries.find((e) => e.stage === 'route');
  assert.equal(route.decisive_reason, 'stage_missing');
  assert.equal(route.stage_state, 'unavailable');
});

test('(B) planted forbidden VALUE in any bundle input is absent from output', () => {
  for (const name of ['signal_health', 'risk_verdict', 'route_verdict', 'send_review_health']) {
    // attach a planted endpoint/secret VALUE to a real result object copy
    const b = goodBundle();
    b[name] = { ...b[name], endpoint: 'PLANTED-ENDPOINT-https://leak.example' };
    const r = evaluatePipelineDecisionTrace(b);
    assertSafe(r);
    assertAbsent(r, 'PLANTED');
  }
});

test('(B) hostile input -> unconfigured, never throws', () => {
  for (const inp of [undefined, null, [], ...hostiles()]) {
    const r = evaluatePipelineDecisionTrace(inp);
    assertSafe(r);
    assert.equal(r.overall_outcome, 'unconfigured');
  }
});

// ===========================================================================
// (C) PIPELINE HEALTH READ-MODEL
// ===========================================================================

test('(C) descriptor + clean bundle -> SUPPRESSED (always-suppressed clean path)', () => {
  const d = describePipelineHealthReadModelContract();
  assertSafe(d);
  assert.equal(d.contract, 'pipeline-health-read-model');
  const r = evaluatePipelineHealthReadModel(goodBundle());
  assertSafe(r);
  assert.equal(r.pipeline_health_state, 'PIPELINE_HEALTH_SUPPRESSED');
});

test('(C) worst-state-wins: a BLOCKED health beats suppressed', () => {
  // build a BLOCKED signing-review health (private-key surface blocked)
  const blockedKeySurface = evaluatePrivateKeyForbiddenSurface({ seed: 'x' });
  const blockedSigningVerdict = evaluateSigningReviewVerdict({
    purpose: 'signing_review_verdict_input',
    signing_review_input_boundary: signingBoundaryValid,
    signer_custody_boundary: signingCustodyValid,
    candidate_signing_review_descriptor: signingDescriptor,
    signer_custody_readiness_advisory: signingReadiness,
    private_key_surface: blockedKeySurface
  });
  const blockedSigningHealth = evaluateSigningReviewHealth({
    signing_review_input_boundary: signingBoundaryValid,
    signer_custody_boundary: signingCustodyValid,
    candidate_signing_review_descriptor: signingDescriptor,
    signer_custody_readiness_advisory: signingReadiness,
    private_key_surface: blockedKeySurface,
    signing_review_verdict: blockedSigningVerdict,
    signing_review_suppression: signingSuppression
  });
  assert.equal(blockedSigningHealth.signing_review_health_state, 'SIGNING_REVIEW_HEALTH_BLOCKED');
  const r = evaluatePipelineHealthReadModel({ ...goodBundle(), signing_review_health: blockedSigningHealth });
  assertSafe(r);
  assert.equal(r.pipeline_health_state, 'PIPELINE_HEALTH_BLOCKED');
});

test('(C) missing health -> UNCONFIGURED', () => {
  const b = goodBundle();
  delete b.intent_health;
  const r = evaluatePipelineHealthReadModel(b);
  assertSafe(r);
  assert.equal(r.pipeline_health_state, 'PIPELINE_HEALTH_UNCONFIGURED');
});

test('(C) smuggled forbidden -> BLOCKED, value absent; hostile -> UNCONFIGURED', () => {
  const r = evaluatePipelineHealthReadModel({ ...goodBundle(), api_key: 'LEAK' });
  assertSafe(r);
  assert.equal(r.pipeline_health_state, 'PIPELINE_HEALTH_BLOCKED');
  assertAbsent(r, 'LEAK');
  for (const inp of [undefined, null, ...hostiles()]) {
    const r2 = evaluatePipelineHealthReadModel(inp);
    assertSafe(r2);
    assert.equal(r2.pipeline_health_state, 'PIPELINE_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// (D) PIPELINE DECISION VERDICT
// ===========================================================================

test('(D) descriptor + clean bundle -> REVIEWED_ADVISORY, opens nothing', () => {
  const d = describePipelineDecisionVerdictContract();
  assertSafe(d);
  assert.equal(d.contract, 'pipeline-decision-verdict');
  const r = evaluatePipelineDecisionVerdict(goodBundle());
  assertSafe(r);
  assert.equal(r.pipeline_decision_state, 'PIPELINE_DECISION_REVIEWED_ADVISORY');
  assert.equal(r.pipeline_decision_reviewed_advisory, true);
  assert.equal(r.overall_outcome, 'reviewed_advisory_all_stages');
  assert.equal(r.pipeline_health_state, 'PIPELINE_HEALTH_SUPPRESSED');
  assertNoForbiddenKeys(r);
});

test('(D) a blocked stage -> BLOCKED', () => {
  const verdictBlocked = evaluateRiskVerdict({
    purpose: 'risk_verdict_input',
    hard_risk: evaluateHardRiskGate({
      purpose: 'hard_risk_input', candidate_signal: walletLed, risk_input_boundary: riskBoundaryValid,
      risk_factors: { honeypot_indicator: true, freeze_authority_indicator: false, mint_authority_indicator: false, owner_concentration_indicator: false, blacklist_indicator: false, unknown_token_metadata: false }
    }),
    liquidity_exit: liqPass, exposure: expPass
  });
  const r = evaluatePipelineDecisionVerdict({ ...goodBundle(), risk_verdict: verdictBlocked });
  assertSafe(r);
  assert.equal(r.pipeline_decision_state, 'PIPELINE_DECISION_BLOCKED');
  assert.equal(r.pipeline_decision_reviewed_advisory, false);
});

test('(D) missing result -> UNCONFIGURED; hostile -> UNCONFIGURED', () => {
  const b = goodBundle();
  delete b.signal_health;
  const r = evaluatePipelineDecisionVerdict(b);
  assertSafe(r);
  assert.equal(r.pipeline_decision_state, 'PIPELINE_DECISION_UNCONFIGURED');
  for (const inp of [undefined, null, ...hostiles()]) {
    const r2 = evaluatePipelineDecisionVerdict(inp);
    assertSafe(r2);
    assert.equal(r2.pipeline_decision_state, 'PIPELINE_DECISION_UNCONFIGURED');
  }
});

test('(D) planted VALUE absent across verdict output', () => {
  const b = goodBundle();
  b.send_review_verdict = { ...b.send_review_verdict, signature: 'PLANTED-SIG-zzz' };
  const r = evaluatePipelineDecisionVerdict(b);
  assertSafe(r);
  assertAbsent(r, 'PLANTED');
});

// ===========================================================================
// (E) PIPELINE DECISION SUPPRESSION
// ===========================================================================

test('(E) ALWAYS suppressed, always carries not_*_authorized on every path', () => {
  const d = describePipelineDecisionSuppressionContract();
  assertSafe(d);
  assert.equal(d.suppressed, true);
  const inputs = [
    undefined, null, {}, goodBundle(),
    { pipeline_decision_verdict: evaluatePipelineDecisionVerdict(goodBundle()) },
    { pipeline_decision_trace: evaluatePipelineDecisionTrace(goodBundle()) },
    ...hostiles()
  ];
  for (const inp of inputs) {
    const r = evaluatePipelineDecisionSuppression(inp);
    assertSafe(r);
    assert.equal(r.suppressed, true);
    assert.equal(r.not_execution_authorized, true);
    assert.equal(r.not_sign_authorized, true);
    assert.equal(r.not_send_authorized, true);
    for (const c of ['not_execution_authorized', 'not_sign_authorized', 'not_send_authorized']) {
      assert.equal(r.suppression_reasons.includes(c), true, `must carry ${c}`);
    }
  }
});

test('(E) surfaces a blocked verdict/trace as advisory reason (still always-suppressed)', () => {
  const verdictBlocked = evaluatePipelineDecisionVerdict({
    ...goodBundle(),
    risk_verdict: evaluateRiskVerdict({
      purpose: 'risk_verdict_input',
      hard_risk: evaluateHardRiskGate({
        purpose: 'hard_risk_input', candidate_signal: walletLed, risk_input_boundary: riskBoundaryValid,
        risk_factors: { honeypot_indicator: true, freeze_authority_indicator: false, mint_authority_indicator: false, owner_concentration_indicator: false, blacklist_indicator: false, unknown_token_metadata: false }
      }),
      liquidity_exit: liqPass, exposure: expPass
    })
  });
  const r = evaluatePipelineDecisionSuppression({ pipeline_decision_verdict: verdictBlocked });
  assertSafe(r);
  assert.equal(r.suppressed, true);
  assert.equal(r.suppression_reasons.includes('pipeline_blocked'), true);
});

// ===========================================================================
// (F) PIPELINE FORBIDDEN SURFACE GUARD
// ===========================================================================

test('(F) descriptor + clean -> CLEAN; key/live name -> BLOCKED, NAME-only redacted', () => {
  const d = describePipelineForbiddenSurfaceContract();
  assertSafe(d);
  assert.equal(d.contract, 'pipeline-forbidden-surface');
  const clean = evaluatePipelineForbiddenSurface({ purpose: 'x', stage: 'signal' });
  assertSafe(clean);
  assert.equal(clean.pipeline_surface_state, 'PIPELINE_SURFACE_CLEAN');
  assert.equal(clean.forbidden_field_detected, false);

  // key-material names
  for (const name of ['private_key', 'secret_key', 'keypair', 'mnemonic', 'seed', 'signing_key', 'signature', 'signed_transaction']) {
    const planted = `PLANTED-${name}-MATERIAL-VALUE`;
    const r = evaluatePipelineForbiddenSurface({ [name]: planted });
    assertSafe(r);
    assert.equal(r.pipeline_surface_state, 'PIPELINE_SURFACE_BLOCKED');
    assert.equal(r.forbidden_field_detected, true);
    assert.equal(r.key_material_detected, true);
    assert.equal(r.forbidden_field_ref, name);
    assertAbsent(r, 'PLANTED');
  }
  // live names
  for (const name of ['endpoint', 'rpc_url', 'node_url', 'serialized_tx', 'wire_transaction', 'message_bytes', 'broadcast_payload']) {
    const planted = `PLANTED-${name}-ENDPOINT-VALUE`;
    const r = evaluatePipelineForbiddenSurface({ [name]: planted });
    assertSafe(r);
    assert.equal(r.pipeline_surface_state, 'PIPELINE_SURFACE_BLOCKED');
    assert.equal(r.forbidden_field_detected, true);
    assert.equal(r.live_surface_detected, true);
    assert.equal(r.forbidden_field_ref, name);
    assertAbsent(r, 'PLANTED');
  }
});

test('(F) detection booleans true == BLOCKED == safe (NOT readiness flags)', () => {
  const r = evaluatePipelineForbiddenSurface({ private_key: 'x' });
  assertSafe(r); // all 24 readiness flags still false
  assert.equal(r.forbidden_field_detected, true);
  assert.equal(r.key_material_detected, true);
});

test('(F) hostile -> UNCONFIGURED, never throws', () => {
  for (const inp of [undefined, null, [], ...hostiles()]) {
    const r = evaluatePipelineForbiddenSurface(inp);
    assertSafe(r);
    assert.equal(r.pipeline_surface_state, 'PIPELINE_SURFACE_UNCONFIGURED');
  }
});

// ===========================================================================
// (G) PIPELINE DECISION HEALTH
// ===========================================================================

const goodDecisionHealthInputs = () => ({
  pipeline_trace_input_boundary: evaluatePipelineDecisionTraceInputBoundary(goodBundle()),
  pipeline_decision_trace: evaluatePipelineDecisionTrace(goodBundle()),
  pipeline_health_read_model: evaluatePipelineHealthReadModel(goodBundle()),
  pipeline_decision_verdict: evaluatePipelineDecisionVerdict(goodBundle()),
  pipeline_decision_suppression: evaluatePipelineDecisionSuppression({
    pipeline_decision_verdict: evaluatePipelineDecisionVerdict(goodBundle())
  }),
  pipeline_forbidden_surface: evaluatePipelineForbiddenSurface({ purpose: 'x' })
});

test('(G) descriptor + real-clean -> SUPPRESSED (always-suppressed)', () => {
  const d = describePipelineDecisionHealthContract();
  assertSafe(d);
  assert.equal(d.contract, 'pipeline-decision-health');
  const r = evaluatePipelineDecisionHealth(goodDecisionHealthInputs());
  assertSafe(r);
  assert.equal(r.pipeline_decision_health_state, 'PIPELINE_DECISION_HEALTH_SUPPRESSED');
});

test('(G) explicit not-suppressed object + reviewed verdict -> REVIEWED_ADVISORY (opens nothing)', () => {
  const inputs = goodDecisionHealthInputs();
  inputs.pipeline_decision_suppression = Object.freeze({
    suppressed: false, suppression_reasons: [], read_only: true
  });
  const r = evaluatePipelineDecisionHealth(inputs);
  assertSafe(r);
  assert.equal(r.pipeline_decision_health_state, 'PIPELINE_DECISION_HEALTH_REVIEWED_ADVISORY');
});

test('(G) surface BLOCKED -> BLOCKED', () => {
  const inputs = goodDecisionHealthInputs();
  inputs.pipeline_forbidden_surface = evaluatePipelineForbiddenSurface({ private_key: 'x' });
  const r = evaluatePipelineDecisionHealth(inputs);
  assertSafe(r);
  assert.equal(r.pipeline_decision_health_state, 'PIPELINE_DECISION_HEALTH_BLOCKED');
});

test('(G) verdict BLOCKED -> BLOCKED; missing component -> UNCONFIGURED', () => {
  const inputs = goodDecisionHealthInputs();
  inputs.pipeline_decision_verdict = evaluatePipelineDecisionVerdict({
    ...goodBundle(),
    risk_verdict: evaluateRiskVerdict({
      purpose: 'risk_verdict_input',
      hard_risk: evaluateHardRiskGate({
        purpose: 'hard_risk_input', candidate_signal: walletLed, risk_input_boundary: riskBoundaryValid,
        risk_factors: { honeypot_indicator: true, freeze_authority_indicator: false, mint_authority_indicator: false, owner_concentration_indicator: false, blacklist_indicator: false, unknown_token_metadata: false }
      }),
      liquidity_exit: liqPass, exposure: expPass
    })
  });
  const r = evaluatePipelineDecisionHealth(inputs);
  assertSafe(r);
  assert.equal(r.pipeline_decision_health_state, 'PIPELINE_DECISION_HEALTH_BLOCKED');

  const inputs2 = goodDecisionHealthInputs();
  delete inputs2.pipeline_decision_trace;
  const r2 = evaluatePipelineDecisionHealth(inputs2);
  assertSafe(r2);
  assert.equal(r2.pipeline_decision_health_state, 'PIPELINE_DECISION_HEALTH_UNCONFIGURED');
});

test('(G) smuggled forbidden in component -> BLOCKED, value absent; hostile -> UNCONFIGURED', () => {
  const inputs = goodDecisionHealthInputs();
  const r = evaluatePipelineDecisionHealth({ ...inputs, api_key: 'LEAK' });
  assertSafe(r);
  assert.equal(r.pipeline_decision_health_state, 'PIPELINE_DECISION_HEALTH_BLOCKED');
  assertAbsent(r, 'LEAK');
  for (const inp of [undefined, null, ...hostiles()]) {
    const r2 = evaluatePipelineDecisionHealth(inp);
    assertSafe(r2);
    assert.equal(r2.pipeline_decision_health_state, 'PIPELINE_DECISION_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// END-TO-END: planted forbidden VALUE absent across EVERY Stage-13 output
// ===========================================================================

test('end-to-end: a planted endpoint/serialized_tx/signature/private_key VALUE in any bundle input is absent from every Stage-13 output', () => {
  const planters = [
    ['endpoint', 'PLANTED-https://leak.example/rpc'],
    ['serialized_tx', 'PLANTED-AABBCC-serialized'],
    ['signature', 'PLANTED-5sig5sig'],
    ['private_key', 'PLANTED-deadbeefkey']
  ];
  for (const slot of ['signal_health', 'risk_verdict', 'intent_terminal', 'route_health', 'signing_review_verdict', 'send_review_health']) {
    for (const [pname, pval] of planters) {
      const b = goodBundle();
      b[slot] = { ...b[slot], [pname]: pval };
      const outs = [
        evaluatePipelineDecisionTraceInputBoundary(b),
        evaluatePipelineDecisionTrace(b),
        evaluatePipelineHealthReadModel(b),
        evaluatePipelineDecisionVerdict(b)
      ];
      for (const o of outs) {
        assertSafe(o);
        assertAbsent(o, 'PLANTED');
      }
    }
  }
});

// ===========================================================================
// STATIC SOURCE GUARD
// ===========================================================================

test('static guard: src is import-free, no can_send/can_broadcast:true literal, no mutable module state, no forbidden output key / planted VALUE literal', () => {
  const files = [
    '../src/pipeline-decision-trace-foundations.mjs',
    '../src/index.mjs'
  ].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    assert.equal(/can_broadcast\s*:\s*true/.test(src), false, `${f} must not contain can_broadcast: true`);
    assert.equal(/broadcast_permitted\s*:\s*true/.test(src), false, `${f} must not contain broadcast_permitted: true`);
    assert.equal(/signer_ready\s*:\s*true/.test(src), false, `${f} must not contain signer_ready: true`);
    if (f.endsWith('pipeline-decision-trace-foundations.mjs')) {
      assert.equal(/^\s*import\s/m.test(src), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(src), false, 'implementation must not use require(');
      // no mutable module-level array (top of file, not indented locals)
      assert.equal(/^(const|let|var)\s+\w*(store|ledger|records|payload|cache|state)\w*\s*=\s*\[\s*\]/im.test(src), false,
        'implementation must hold no mutable module-level array');
      assert.equal(/fetch\s*\(|new\s+WebSocket|new\s+Connection|sendTransaction|sendRawTransaction|\.sign\s*\(/.test(src), false, 'no network/send primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env|Math\.random/.test(src), false, 'no clock/env/RNG');
      assert.equal(/\b(rpc_url|endpoint_url|serialized_tx|signed_transaction|wire_transaction|broadcast_payload)\s*[:=]\s*['"`][^'"`]/.test(src), false,
        'implementation must hold no endpoint/serialized/signature VALUE literal');
    }
  }
});
