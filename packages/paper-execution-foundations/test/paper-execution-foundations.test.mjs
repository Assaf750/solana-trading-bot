// PR-S14 test suite for @soltrade/paper-execution-foundations (Phase B opener)
// node:test + node:assert/strict. Deterministic. Builds a REAL Stage-4 -> 5 -> 6
// -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 chain (via the lower-stage evaluators)
// to a REAL PIPELINE_DECISION_REVIEWED_ADVISORY verdict, then exercises every
// Stage-14 paper-execution foundation (A-G), cross-checks the pure FIFO P&L
// read-model against the Gate-B paper-portfolio skeleton, asserts the paper
// adapter + send gate stay fail-closed beside a full paper P&L read-model, and
// finishes with static source guards.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describePaperExecutionInputBoundaryContract,
  evaluatePaperExecutionInputBoundary,
  describeCandidatePaperFillContract,
  evaluateCandidatePaperFill,
  describePaperPnlReadModelContract,
  evaluatePaperPnlReadModel,
  describePaperOutcomeContract,
  evaluatePaperOutcome,
  describePaperExecutionSuppressionContract,
  evaluatePaperExecutionSuppression,
  describePaperForbiddenSurfaceContract,
  evaluatePaperForbiddenSurface,
  describePaperExecutionHealthContract,
  evaluatePaperExecutionHealth
} from '../src/index.mjs';

// Stage-13 pipeline decision-trace foundation
import {
  evaluatePipelineDecisionTraceInputBoundary,
  evaluatePipelineDecisionTrace,
  evaluatePipelineHealthReadModel,
  evaluatePipelineDecisionVerdict,
  evaluatePipelineDecisionSuppression,
  evaluatePipelineForbiddenSurface,
  evaluatePipelineDecisionHealth
} from '../../pipeline-decision-trace-foundations/src/index.mjs';

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

// Gate-B skeletons (TEST-level only — never imported by src)
import { createPaperPortfolio } from '../../paper-portfolio/src/paper-portfolio.mjs';
import { createPaperExecutionAdapter } from '../../execution-paper-adapter/src/index.mjs';
import { evaluateSendPreflight } from '../../send-gate-contract/src/index.mjs';

// ---------------------------------------------------------------------------
// REAL Stage-4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 builders
// (copied verbatim from the pipeline-decision-trace-foundations test chain)
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
// Stage-13 bundle + REAL pipeline-decision verdict / health (clean end-to-end)
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

const pipelineBoundary = evaluatePipelineDecisionTraceInputBoundary(goodBundle());
const pipelineTrace = evaluatePipelineDecisionTrace(goodBundle());
const pipelineHealthModel = evaluatePipelineHealthReadModel(goodBundle());
const pipelineVerdict = evaluatePipelineDecisionVerdict(goodBundle());
const pipelineSuppression = evaluatePipelineDecisionSuppression({
  purpose: 'pipeline_decision_suppression_input',
  pipeline_decision_verdict: pipelineVerdict,
  pipeline_decision_trace: pipelineTrace
});
const pipelineSurface = evaluatePipelineForbiddenSurface({ purpose: 'pipeline_decision_trace' });
const pipelineDecisionHealth = evaluatePipelineDecisionHealth({
  pipeline_trace_input_boundary: pipelineBoundary,
  pipeline_decision_trace: pipelineTrace,
  pipeline_health_read_model: pipelineHealthModel,
  pipeline_decision_verdict: pipelineVerdict,
  pipeline_decision_suppression: pipelineSuppression,
  pipeline_forbidden_surface: pipelineSurface
});

test('preconditions: real Stage-4..13 chain reaches PIPELINE_DECISION_REVIEWED_ADVISORY', () => {
  assert.equal(pipelineVerdict.pipeline_decision_state, 'PIPELINE_DECISION_REVIEWED_ADVISORY');
  assert.equal(pipelineDecisionHealth.pipeline_decision_health_state, 'PIPELINE_DECISION_HEALTH_SUPPRESSED');
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

function assertSimulated(res) {
  assertSafe(res);
  assert.equal(res.simulated, true, 'result must carry simulated:true');
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

// the clean (A) input + result reused below
const goodPaperInput = () => ({
  purpose: 'paper_execution_input',
  pipeline_decision_verdict: pipelineVerdict,
  pipeline_decision_health: pipelineDecisionHealth
});
const boundaryValid = evaluatePaperExecutionInputBoundary(goodPaperInput());

// ===========================================================================
// (A) PAPER-EXECUTION INPUT BOUNDARY
// ===========================================================================

test('(A) descriptor: shape, states, safe flags, simulated', () => {
  const d = describePaperExecutionInputBoundaryContract();
  assertSimulated(d);
  assert.equal(d.contract, 'paper-execution-input-boundary');
  assert.equal(d.eligible_for_paper_execution, false);
  assert.deepEqual([...d.supported_states], [
    'PAPER_EXEC_INPUT_UNCONFIGURED', 'PAPER_EXEC_INPUT_INVALID',
    'PAPER_EXEC_INPUT_DEGRADED', 'PAPER_EXEC_INPUT_VALID'
  ]);
});

test('(A) real REVIEWED_ADVISORY verdict -> VALID + eligible_for_paper_execution (opens nothing)', () => {
  assertSimulated(boundaryValid);
  assert.equal(boundaryValid.paper_exec_input_state, 'PAPER_EXEC_INPUT_VALID');
  assert.equal(boundaryValid.eligible_for_paper_execution, true);
  // eligibility NEVER flips an exec/readiness flag (assertSafe above proves it)
});

test('(A) verdict alone (no health) -> still VALID; non-reviewed verdict -> DEGRADED', () => {
  const r = evaluatePaperExecutionInputBoundary({
    purpose: 'paper_execution_input', pipeline_decision_verdict: pipelineVerdict
  });
  assertSimulated(r);
  assert.equal(r.paper_exec_input_state, 'PAPER_EXEC_INPUT_VALID');

  const unconfVerdict = evaluatePipelineDecisionVerdict(undefined); // recognized UNCONFIGURED result
  const r2 = evaluatePaperExecutionInputBoundary({
    purpose: 'paper_execution_input', pipeline_decision_verdict: unconfVerdict
  });
  assertSimulated(r2);
  assert.equal(r2.paper_exec_input_state, 'PAPER_EXEC_INPUT_DEGRADED');
  assert.equal(r2.eligible_for_paper_execution, false);
});

test('(A) raw trace bundle / raw Stage-12 result -> INVALID raw_non_pipeline_decision_input_refused', () => {
  // raw bundle as the whole input
  const r1 = evaluatePaperExecutionInputBoundary(goodBundle());
  assertSimulated(r1);
  assert.equal(r1.paper_exec_input_state, 'PAPER_EXEC_INPUT_INVALID');
  assert.equal(r1.reasons.includes('raw_non_pipeline_decision_input_refused'), true);

  // raw Stage-12 result as the whole input
  const r2 = evaluatePaperExecutionInputBoundary(sendVerdictPass);
  assert.equal(r2.paper_exec_input_state, 'PAPER_EXEC_INPUT_INVALID');

  // raw Stage-12 result smuggled into the verdict slot
  const r3 = evaluatePaperExecutionInputBoundary({
    purpose: 'paper_execution_input', pipeline_decision_verdict: sendVerdictPass
  });
  assert.equal(r3.paper_exec_input_state, 'PAPER_EXEC_INPUT_INVALID');
  assert.equal(r3.reasons.includes('raw_non_pipeline_decision_input_refused'), true);

  // a raw non-result object in the slot
  const r4 = evaluatePaperExecutionInputBoundary({
    purpose: 'paper_execution_input', pipeline_decision_verdict: { not_a_result: true }
  });
  assert.equal(r4.paper_exec_input_state, 'PAPER_EXEC_INPUT_INVALID');
});

test('(A) missing verdict -> DEGRADED; missing/hostile input -> UNCONFIGURED, never throws', () => {
  const r = evaluatePaperExecutionInputBoundary({ purpose: 'paper_execution_input' });
  assertSimulated(r);
  assert.equal(r.paper_exec_input_state, 'PAPER_EXEC_INPUT_DEGRADED');
  for (const inp of [undefined, null, [], 42, 'x', ...hostiles()]) {
    const r2 = evaluatePaperExecutionInputBoundary(inp);
    assertSimulated(r2);
    assert.equal(r2.paper_exec_input_state, 'PAPER_EXEC_INPUT_UNCONFIGURED');
    assert.equal(r2.eligible_for_paper_execution, false);
  }
});

test('(A) smuggled exec flag / command / secret / endpoint / forbidden NAME -> INVALID, never echoed', () => {
  const smuggles = [
    { can_send: true },
    { execute: true },
    { api_key: 'LEAK-SECRET-VALUE' },
    { node_url: 'https://LEAK.example/rpc' },
    { network: 'mainnet-LEAK' },
    { private_key: 'PLANTED-LEAK-key' },
    { serialized_tx: 'PLANTED-LEAK-tx' }
  ];
  for (const s of smuggles) {
    const r = evaluatePaperExecutionInputBoundary({ ...goodPaperInput(), ...s });
    assertSimulated(r);
    assert.equal(r.paper_exec_input_state, 'PAPER_EXEC_INPUT_INVALID');
    assertAbsent(r, 'LEAK');
  }
});

// ===========================================================================
// (B) CANDIDATE PAPER-FILL DESCRIPTOR
// ===========================================================================

const goodBuyFill = (over = {}) => ({
  purpose: 'candidate_paper_fill_input',
  paper_exec_input_boundary: boundaryValid,
  position_ref: 'pos-1',
  wallet_ref: 'w-A',
  side: 'buy',
  quantity: 10,
  price: 2,
  fee: 1,
  slippage: 1,
  copy_mode_bucket: 'follow_mode_bucket_1',
  brain_bucket: 'brain_bucket_a',
  latency_bucket: 'low',
  failure_origin_bucket: 'none',
  ...over
});

test('(B) descriptor contract + valid buy/sell -> _DESCRIPTOR with fixed non-execution literals', () => {
  const d = describeCandidatePaperFillContract();
  assertSimulated(d);
  assert.equal(d.contract, 'candidate-paper-fill');
  assert.equal(d.paper_fill_kind, 'candidate_paper_fill');

  const buy = evaluateCandidatePaperFill(goodBuyFill());
  assertSimulated(buy);
  assert.equal(buy.paper_fill_state, 'CANDIDATE_PAPER_FILL_DESCRIPTOR');
  assert.equal(buy.paper_fill_kind, 'candidate_paper_fill');
  assert.equal(buy.simulated, true);
  assert.equal(buy.is_valid_on_chain, false);
  assert.equal(buy.executed, false);
  assert.equal(buy.signed, false);
  assert.equal(buy.signature, null);
  assert.equal(buy.position_ref, 'pos-1');
  assert.equal(buy.side, 'buy');
  assert.equal(buy.quantity, 10);

  // sell without a boundary (boundary optional) + defaulted secondary fields
  const sell = evaluateCandidatePaperFill({
    position_ref: 'pos-1', wallet_ref: 'w-A', side: 'sell', quantity: 5, price: 4
  });
  assert.equal(sell.paper_fill_state, 'CANDIDATE_PAPER_FILL_DESCRIPTOR');
  assert.equal(sell.fee, 0);
  assert.equal(sell.slippage, 0);
  assert.equal(sell.latency_bucket, 'unknown');
  assert.equal(sell.failure_origin_bucket, 'none');
});

test('(B) on-chain/executed/signed/forbidden-field/bad-shape fills -> REJECTED, never echoed', () => {
  const rejects = [
    [{ is_valid_on_chain: true }, 'on_chain_fill_refused'],
    [{ executed: true }, 'executed_fill_refused'],
    [{ signed: true }, 'signed_fill_refused'],
    [{ signature: 'PLANTED-sig-LEAK' }, 'forbidden_field_name_blocked'],
    [{ serialized_tx: 'PLANTED-tx-LEAK' }, 'forbidden_field_name_blocked'],
    [{ endpoint: 'https://LEAK.example' }, 'forbidden_field_name_blocked'],
    [{ private_key: 'PLANTED-key-LEAK' }, 'forbidden_field_name_blocked'],
    [{ side: 'short' }, 'invalid_side'],
    [{ quantity: 0 }, 'invalid_quantity'],
    [{ quantity: -3 }, 'invalid_quantity'],
    [{ price: -1 }, 'invalid_price'],
    [{ position_ref: undefined }, 'position_ref_required']
  ];
  for (const [over, reason] of rejects) {
    const r = evaluateCandidatePaperFill(goodBuyFill(over));
    assertSimulated(r);
    assert.equal(r.paper_fill_state, 'CANDIDATE_PAPER_FILL_REJECTED', `expected REJECTED for ${reason}`);
    assert.equal(r.reasons.includes(reason), true, `expected reason ${reason}`);
    assertAbsent(r, 'LEAK');
  }
});

test('(B) boundary not VALID -> INVALID; malformed secondary fields -> INVALID; hostile -> UNCONFIGURED', () => {
  const degraded = evaluatePaperExecutionInputBoundary({ purpose: 'paper_execution_input' });
  const r = evaluateCandidatePaperFill(goodBuyFill({ paper_exec_input_boundary: degraded }));
  assert.equal(r.paper_fill_state, 'CANDIDATE_PAPER_FILL_INVALID');
  assert.equal(r.reasons.includes('paper_exec_boundary_not_valid'), true);

  const r2 = evaluateCandidatePaperFill(goodBuyFill({ latency_bucket: 'warp' }));
  assert.equal(r2.paper_fill_state, 'CANDIDATE_PAPER_FILL_INVALID');
  const r3 = evaluateCandidatePaperFill(goodBuyFill({ fee: -1 }));
  assert.equal(r3.paper_fill_state, 'CANDIDATE_PAPER_FILL_INVALID');
  const r4 = evaluateCandidatePaperFill(goodBuyFill({ wallet_ref: '' }));
  assert.equal(r4.paper_fill_state, 'CANDIDATE_PAPER_FILL_INVALID');

  for (const inp of [undefined, null, [], 'x', ...hostiles()]) {
    const h = evaluateCandidatePaperFill(inp);
    assertSimulated(h);
    assert.equal(h.paper_fill_state, 'CANDIDATE_PAPER_FILL_UNCONFIGURED');
  }
});

// ===========================================================================
// (C) PAPER P&L READ-MODEL — scripted scenario, hand-asserted FIFO numbers
// 3 positions, 2 wallets, 2 copy modes, 2 brains
// ===========================================================================

const fillSpec = [
  { position_ref: 'pos-1', wallet_ref: 'w-A', side: 'buy', quantity: 10, price: 2, fee: 1, slippage: 1, copy_mode_bucket: 'mode-1', brain_bucket: 'brain-a' },
  { position_ref: 'pos-1', wallet_ref: 'w-A', side: 'buy', quantity: 5, price: 3, fee: 1, slippage: 0, copy_mode_bucket: 'mode-1', brain_bucket: 'brain-a' },
  { position_ref: 'pos-2', wallet_ref: 'w-A', side: 'buy', quantity: 4, price: 5, fee: 1, slippage: 1, copy_mode_bucket: 'mode-2', brain_bucket: 'brain-b' },
  { position_ref: 'pos-3', wallet_ref: 'w-B', side: 'buy', quantity: 2, price: 10, fee: 1, slippage: 1, copy_mode_bucket: 'mode-2', brain_bucket: 'brain-b' },
  { position_ref: 'pos-1', wallet_ref: 'w-A', side: 'sell', quantity: 12, price: 4, fee: 2, slippage: 1, copy_mode_bucket: 'mode-1', brain_bucket: 'brain-a' },
  { position_ref: 'pos-2', wallet_ref: 'w-A', side: 'sell', quantity: 4, price: 4.5, fee: 1, slippage: 1, copy_mode_bucket: 'mode-2', brain_bucket: 'brain-b' },
  // over-sell: only 2 open in pos-3; the excess 3 MUST be ignored (no shorts)
  { position_ref: 'pos-3', wallet_ref: 'w-B', side: 'sell', quantity: 5, price: 11, fee: 1, slippage: 0, copy_mode_bucket: 'mode-2', brain_bucket: 'brain-b' }
];

// run the fills through (B) so the read-model consumes REAL descriptors
const descriptorFills = fillSpec.map((f) => {
  const d = evaluateCandidatePaperFill({ ...f, paper_exec_input_boundary: boundaryValid });
  assert.equal(d.paper_fill_state, 'CANDIDATE_PAPER_FILL_DESCRIPTOR');
  return d;
});

const goodMarks = () => ({
  'pos-1': { mark_price: 5, mark_status_bucket: 'valid' },
  'pos-2': { mark_price: 6, mark_status_bucket: 'stale' }
  // pos-3 deliberately has NO mark
});

const goodPnlInput = () => ({
  purpose: 'paper_pnl_input',
  paper_fills: descriptorFills,
  marks: goodMarks()
});

test('(C) descriptor contract + exact hand-computed FIFO numbers', () => {
  const d = describePaperPnlReadModelContract();
  assertSimulated(d);
  assert.equal(d.contract, 'paper-pnl-read-model');

  const r = evaluatePaperPnlReadModel(goodPnlInput());
  assertSimulated(r);
  assert.equal(r.paper_pnl_state, 'PAPER_PNL_READ_MODEL');
  assert.equal(r.is_valid_on_chain, false);
  assert.equal(r.fill_count, 7);
  assert.equal(r.reasons.includes('oversell_ignored'), true);

  // pos-1: FIFO sell 12 -> 10*(4-2) + 2*(4-3) = 22 gross; open 3 @ avg 3
  const p1 = r.positions['pos-1'];
  assert.equal(Object.isFrozen(p1), true);
  assert.equal(p1.simulated, true);
  assert.equal(p1.candidate_realized_pnl, 22);
  assert.equal(p1.candidate_fees_total, 4);
  assert.equal(p1.candidate_slippage_cost, 2);
  assert.equal(p1.paper_net_realized, 16);
  assert.equal(p1.open_quantity, 3);
  assert.equal(p1.avg_open_cost, 3);
  assert.equal(p1.oversell_ignored, false);

  // pos-2: sell 4 @ 4.5 vs buy 4 @ 5 -> -2 gross; closed
  const p2 = r.positions['pos-2'];
  assert.equal(p2.candidate_realized_pnl, -2);
  assert.equal(p2.candidate_fees_total, 2);
  assert.equal(p2.candidate_slippage_cost, 2);
  assert.equal(p2.paper_net_realized, -6);
  assert.equal(p2.open_quantity, 0);

  // pos-3: sell 5 against only 2 open -> matched 2*(11-10)=2; excess IGNORED
  const p3 = r.positions['pos-3'];
  assert.equal(p3.candidate_realized_pnl, 2);
  assert.equal(p3.candidate_fees_total, 2);
  assert.equal(p3.candidate_slippage_cost, 1);
  assert.equal(p3.open_quantity, 0);
  assert.equal(p3.oversell_ignored, true);

  // totals: gross 22-2+2=22; fees 8; slippage 5; NET execution-aware 9
  assert.equal(r.candidate_realized_pnl, 22);
  assert.equal(r.paper_gross_realized, 22);
  assert.equal(r.candidate_fees_total, 8);
  assert.equal(r.candidate_slippage_cost, 5);
  assert.equal(r.candidate_paper_pnl, 9);
});

test('(C) unrealized ONLY with mark valid; stale/missing -> null + reason', () => {
  const r = evaluatePaperPnlReadModel(goodPnlInput());
  // pos-1: mark valid 5 -> (5 - 3) * 3 = 6
  const p1 = r.positions['pos-1'];
  assert.equal(p1.candidate_unrealized_pnl, 6);
  assert.equal(p1.candidate_mark_status, 'valid');
  assert.equal(p1.unrealized_available, true);
  // pos-2: stale mark -> NO unrealized truth
  const p2 = r.positions['pos-2'];
  assert.equal(p2.candidate_unrealized_pnl, null);
  assert.equal(p2.candidate_mark_status, 'stale');
  assert.equal(p2.unrealized_available, false);
  assert.equal(p2.unrealized_reason, 'mark_not_valid');
  // pos-3: no mark at all
  const p3 = r.positions['pos-3'];
  assert.equal(p3.candidate_unrealized_pnl, null);
  assert.equal(p3.unrealized_reason, 'mark_unavailable');
  // a valid bucket with a missing mark_price still yields NO number
  const r2 = evaluatePaperPnlReadModel({
    paper_fills: descriptorFills,
    marks: { 'pos-1': { mark_status_bucket: 'valid' } }
  });
  assert.equal(r2.positions['pos-1'].candidate_unrealized_pnl, null);
  assert.equal(r2.positions['pos-1'].unrealized_reason, 'mark_value_missing');
});

test('(C) aggregations per wallet / copy mode / brain (net after fee+slippage attribution)', () => {
  const r = evaluatePaperPnlReadModel(goodPnlInput());
  // w-A: gross 22-2=20, fees 6, slip 4 -> net 10 ; w-B: gross 2, fees 2, slip 1 -> net -1
  assert.equal(r.candidate_pnl_by_wallet['w-A'].candidate_paper_pnl, 10);
  assert.equal(r.candidate_pnl_by_wallet['w-A'].paper_gross_realized, 20);
  assert.equal(r.candidate_pnl_by_wallet['w-A'].candidate_fees_total, 6);
  assert.equal(r.candidate_pnl_by_wallet['w-A'].candidate_slippage_cost, 4);
  assert.equal(r.candidate_pnl_by_wallet['w-A'].simulated, true);
  assert.equal(r.candidate_pnl_by_wallet['w-B'].candidate_paper_pnl, -1);
  assert.equal(r.candidate_pnl_by_wallet['w-B'].simulated, true);
  // mode-1: gross 22, fees 4, slip 2 -> 16 ; mode-2: gross 0, fees 4, slip 3 -> -7
  assert.equal(r.candidate_pnl_by_copy_mode['mode-1'].candidate_paper_pnl, 16);
  assert.equal(r.candidate_pnl_by_copy_mode['mode-2'].candidate_paper_pnl, -7);
  // brain-a: 16 ; brain-b: -7
  assert.equal(r.candidate_pnl_by_brain['brain-a'].candidate_paper_pnl, 16);
  assert.equal(r.candidate_pnl_by_brain['brain-b'].candidate_paper_pnl, -7);
  // bucket nets sum to the execution-aware total
  assert.equal(r.candidate_pnl_by_wallet['w-A'].candidate_paper_pnl +
    r.candidate_pnl_by_wallet['w-B'].candidate_paper_pnl, r.candidate_paper_pnl);
});

test('(C) purity + determinism: same input twice -> deep-equal frozen results', () => {
  const input = goodPnlInput();
  const a = evaluatePaperPnlReadModel(input);
  const b = evaluatePaperPnlReadModel(input);
  assert.deepEqual(a, b);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.positions), true);
  assert.equal(Object.isFrozen(a.candidate_pnl_by_wallet), true);
  // and a fresh structurally-equal input -> the same numbers (no hidden state)
  const c = evaluatePaperPnlReadModel(goodPnlInput());
  assert.deepEqual(a, c);
});

test('(C) any on-chain/executed/signed/forbidden-surface fill refuses the WHOLE input', () => {
  const bads = [
    { ...fillSpec[0], is_valid_on_chain: true },
    { ...fillSpec[0], executed: true },
    { ...fillSpec[0], signed: true },
    { ...fillSpec[0], signature: 'PLANTED-LEAK' },
    { ...fillSpec[0], rpc_url: 'https://LEAK.example' },
    { ...fillSpec[0], quantity: -1 }
  ];
  for (const bad of bads) {
    const r = evaluatePaperPnlReadModel({ paper_fills: [...descriptorFills, bad] });
    assertSimulated(r);
    assert.equal(r.paper_pnl_state, 'PAPER_PNL_INVALID');
    assertAbsent(r, 'LEAK');
  }
  // hostile / missing -> UNCONFIGURED, never throws
  for (const inp of [undefined, null, {}, { paper_fills: 'x' }, ...hostiles()]) {
    const r = evaluatePaperPnlReadModel(inp);
    assertSimulated(r);
    assert.equal(r.paper_pnl_state, 'PAPER_PNL_UNCONFIGURED');
  }
});

// ===========================================================================
// CROSS-CHECK: pure FIFO (C) === createPaperPortfolio (Gate-B skeleton)
// ===========================================================================

test('cross-check: (C) FIFO realized/fees/slippage EXACTLY EQUAL createPaperPortfolio.getRealized()', () => {
  const portfolio = createPaperPortfolio();
  for (const f of fillSpec) {
    const ack = portfolio.addSimulatedFill(f);
    assert.equal(ack.ok, true);
  }
  const r = evaluatePaperPnlReadModel({ paper_fills: fillSpec });
  assert.equal(r.paper_pnl_state, 'PAPER_PNL_READ_MODEL');
  for (const ref of ['pos-1', 'pos-2', 'pos-3']) {
    const expected = portfolio.getRealized(ref);
    const got = r.positions[ref];
    assert.equal(got.candidate_realized_pnl, expected.candidate_realized_pnl, `${ref} realized`);
    assert.equal(got.candidate_fees_total, expected.candidate_fees_total, `${ref} fees`);
    assert.equal(got.candidate_slippage_cost, expected.candidate_slippage_cost, `${ref} slippage`);
  }
  // descriptor-driven input yields the same numbers as the raw fill objects
  const r2 = evaluatePaperPnlReadModel({ paper_fills: descriptorFills });
  for (const ref of ['pos-1', 'pos-2', 'pos-3']) {
    assert.equal(r2.positions[ref].candidate_realized_pnl, r.positions[ref].candidate_realized_pnl);
  }
});

// ===========================================================================
// (D) PAPER OUTCOME CLASSIFIER (LOCAL states)
// ===========================================================================

test('(D) profit / loss / flat / open / failed scenarios', () => {
  const d = describePaperOutcomeContract();
  assertSimulated(d);
  assert.equal(d.contract, 'paper-outcome');

  const profit = evaluatePaperOutcome({
    paper_fills: [
      { position_ref: 'p', wallet_ref: 'w', side: 'buy', quantity: 10, price: 2, fee: 1, slippage: 1 },
      { position_ref: 'p', wallet_ref: 'w', side: 'sell', quantity: 10, price: 4, fee: 1, slippage: 1 }
    ]
  });
  assertSimulated(profit);
  assert.equal(profit.paper_outcome_state, 'PAPER_EXEC_OUTCOME_CLOSED_PROFIT');
  assert.equal(profit.paper_gross_realized, 20);
  assert.equal(profit.paper_net_realized, 16);
  assert.equal(profit.open_quantity, 0);

  const loss = evaluatePaperOutcome({
    paper_fills: [
      { position_ref: 'p', wallet_ref: 'w', side: 'buy', quantity: 4, price: 5, fee: 1, slippage: 1 },
      { position_ref: 'p', wallet_ref: 'w', side: 'sell', quantity: 4, price: 4.5, fee: 1, slippage: 1 }
    ]
  });
  assert.equal(loss.paper_outcome_state, 'PAPER_EXEC_OUTCOME_CLOSED_LOSS');
  assert.equal(loss.paper_net_realized, -6);

  const flat = evaluatePaperOutcome({
    paper_fills: [
      { position_ref: 'p', wallet_ref: 'w', side: 'buy', quantity: 2, price: 5 },
      { position_ref: 'p', wallet_ref: 'w', side: 'sell', quantity: 2, price: 5 }
    ]
  });
  assert.equal(flat.paper_outcome_state, 'PAPER_EXEC_OUTCOME_CLOSED_FLAT');
  assert.equal(flat.paper_net_realized, 0);

  const open = evaluatePaperOutcome({
    paper_fills: [{ position_ref: 'p', wallet_ref: 'w', side: 'buy', quantity: 2, price: 5 }]
  });
  assert.equal(open.paper_outcome_state, 'PAPER_EXEC_OUTCOME_OPEN');
  assert.equal(open.open_quantity, 2);

  // failure + no successful close -> FAILED takes precedence over OPEN
  const failed = evaluatePaperOutcome({
    paper_fills: [{ position_ref: 'p', wallet_ref: 'w', side: 'buy', quantity: 2, price: 5, failure_origin_bucket: 'route' }]
  });
  assert.equal(failed.paper_outcome_state, 'PAPER_EXEC_OUTCOME_FAILED');
  assert.equal(failed.failure_detected, true);

  // failure but successfully CLOSED -> the closed classification wins
  const closedDespiteFailure = evaluatePaperOutcome({
    paper_fills: [
      { position_ref: 'p', wallet_ref: 'w', side: 'buy', quantity: 2, price: 5, failure_origin_bucket: 'route' },
      { position_ref: 'p', wallet_ref: 'w', side: 'sell', quantity: 2, price: 6 }
    ]
  });
  assert.equal(closedDespiteFailure.paper_outcome_state, 'PAPER_EXEC_OUTCOME_CLOSED_PROFIT');
});

test('(D) multiple refs / bad fills -> INVALID; empty/hostile -> UNCONFIGURED', () => {
  const r = evaluatePaperOutcome({
    paper_fills: [
      { position_ref: 'p1', wallet_ref: 'w', side: 'buy', quantity: 1, price: 1 },
      { position_ref: 'p2', wallet_ref: 'w', side: 'buy', quantity: 1, price: 1 }
    ]
  });
  assert.equal(r.paper_outcome_state, 'PAPER_EXEC_OUTCOME_INVALID');
  assert.equal(r.reasons.includes('multiple_position_refs'), true);

  const r2 = evaluatePaperOutcome({
    paper_fills: [{ position_ref: 'p', wallet_ref: 'w', side: 'buy', quantity: 1, price: 1, executed: true }]
  });
  assert.equal(r2.paper_outcome_state, 'PAPER_EXEC_OUTCOME_INVALID');

  for (const inp of [undefined, null, {}, { paper_fills: [] }, ...hostiles()]) {
    const h = evaluatePaperOutcome(inp);
    assertSimulated(h);
    assert.equal(h.paper_outcome_state, 'PAPER_EXEC_OUTCOME_UNCONFIGURED');
  }
});

// ===========================================================================
// (E) PAPER-EXECUTION SUPPRESSION — ALWAYS suppressed
// ===========================================================================

test('(E) ALWAYS suppressed with the three not_*_authorized on EVERY path', () => {
  const d = describePaperExecutionSuppressionContract();
  assertSimulated(d);
  assert.equal(d.suppressed, true);

  const rejectedFill = evaluateCandidatePaperFill(goodBuyFill({ executed: true }));
  const blockedSurface = evaluatePaperForbiddenSurface({ private_key: 'x' });
  const degradedBoundary = evaluatePaperExecutionInputBoundary({ purpose: 'paper_execution_input' });

  const inputs = [
    undefined, null, 42, ...hostiles(),
    { purpose: 'paper_exec_suppression_input' },
    { purpose: 'paper_exec_suppression_input', paper_exec_input_boundary: boundaryValid },
    { purpose: 'paper_exec_suppression_input', paper_exec_input_boundary: degradedBoundary },
    { purpose: 'paper_exec_suppression_input', candidate_paper_fill: rejectedFill },
    { purpose: 'paper_exec_suppression_input', paper_forbidden_surface: blockedSurface }
  ];
  for (const inp of inputs) {
    const r = evaluatePaperExecutionSuppression(inp);
    assertSimulated(r);
    assert.equal(r.suppressed, true);
    assert.equal(r.not_execution_authorized, true);
    assert.equal(r.not_sign_authorized, true);
    assert.equal(r.not_send_authorized, true);
    for (const code of ['not_execution_authorized', 'not_sign_authorized', 'not_send_authorized']) {
      assert.equal(r.suppression_reasons.includes(code), true, `missing ${code}`);
    }
  }
  // extra advisory reasons when components are unclean
  const r1 = evaluatePaperExecutionSuppression({ paper_exec_input_boundary: degradedBoundary });
  assert.equal(r1.suppression_reasons.includes('pipeline_not_reviewed'), true);
  const r2 = evaluatePaperExecutionSuppression({ candidate_paper_fill: rejectedFill });
  assert.equal(r2.suppression_reasons.includes('fill_rejected'), true);
  const r3 = evaluatePaperExecutionSuppression({ paper_forbidden_surface: blockedSurface });
  assert.equal(r3.suppression_reasons.includes('live_surface_detected'), true);
  // a clean reviewed pipeline is STILL suppressed
  const r4 = evaluatePaperExecutionSuppression({
    paper_exec_input_boundary: boundaryValid, pipeline_decision_verdict: pipelineVerdict
  });
  assert.equal(r4.suppressed, true);
  assert.equal(r4.suppression_reasons.includes('pipeline_not_reviewed'), false);
});

// ===========================================================================
// (F) PAPER FORBIDDEN SURFACE GUARD — NAME-only redaction
// ===========================================================================

test('(F) clean -> CLEAN; planted key/live VALUES -> BLOCKED, ref = NAME only, value ABSENT', () => {
  const d = describePaperForbiddenSurfaceContract();
  assertSimulated(d);
  assert.equal(d.contract, 'paper-forbidden-surface');

  const clean = evaluatePaperForbiddenSurface({ purpose: 'paper_fill_review', position_ref: 'pos-1' });
  assertSimulated(clean);
  assert.equal(clean.paper_surface_state, 'PAPER_SURFACE_CLEAN');
  assert.equal(clean.forbidden_field_detected, false);
  assert.equal(clean.forbidden_field_ref, null);

  const plants = [
    ['endpoint', 'PLANTED-https://leak.example/rpc', 'live'],
    ['serialized_tx', 'PLANTED-AABBCC-serialized', 'live'],
    ['signature', 'PLANTED-5sig5sig', 'key'],
    ['private_key', 'PLANTED-deadbeefkey', 'key'],
    ['mnemonic', 'PLANTED-twelve-words', 'key'],
    ['message_bytes', 'PLANTED-bytes', 'live']
  ];
  for (const [name, value, kind] of plants) {
    const r = evaluatePaperForbiddenSurface({ purpose: 'paper_fill_review', [name]: value });
    assertSimulated(r);
    assert.equal(r.paper_surface_state, 'PAPER_SURFACE_BLOCKED');
    assert.equal(r.forbidden_field_detected, true);
    assert.equal(r.forbidden_field_ref, name);                  // NAME only
    assert.equal(r.key_material_detected, kind === 'key');
    assert.equal(r.live_surface_detected, kind === 'live');
    assertAbsent(r, 'PLANTED');                                  // VALUE provably absent
  }

  for (const inp of [undefined, null, 7, ...hostiles()]) {
    const r = evaluatePaperForbiddenSurface(inp);
    assertSimulated(r);
    assert.equal(r.paper_surface_state, 'PAPER_SURFACE_UNCONFIGURED');
  }
});

// ===========================================================================
// (G) PAPER-EXECUTION HEALTH
// ===========================================================================

const goodHealthInputs = () => ({
  paper_exec_input_boundary: boundaryValid,
  candidate_paper_fill: descriptorFills[0],
  paper_pnl_read_model: evaluatePaperPnlReadModel(goodPnlInput()),
  paper_execution_suppression: evaluatePaperExecutionSuppression({
    paper_exec_input_boundary: boundaryValid, pipeline_decision_verdict: pipelineVerdict
  }),
  paper_forbidden_surface: evaluatePaperForbiddenSurface({ purpose: 'paper_fill_review' })
});

test('(G) clean (always-suppressed) -> SUPPRESSED; explicit not-suppressed -> REVIEWED_ADVISORY (opens nothing)', () => {
  const d = describePaperExecutionHealthContract();
  assertSimulated(d);
  assert.equal(d.contract, 'paper-execution-health');

  const r = evaluatePaperExecutionHealth(goodHealthInputs());
  assertSimulated(r);
  assert.equal(r.paper_exec_health_state, 'PAPER_EXEC_HEALTH_SUPPRESSED');

  const inputs = goodHealthInputs();
  inputs.paper_execution_suppression = Object.freeze({
    suppressed: false, suppression_reasons: [], read_only: true
  });
  const r2 = evaluatePaperExecutionHealth(inputs);
  assertSimulated(r2); // even REVIEWED_ADVISORY keeps all 24 flags false
  assert.equal(r2.paper_exec_health_state, 'PAPER_EXEC_HEALTH_REVIEWED_ADVISORY');
});

test('(G) surface BLOCKED / pnl INVALID / boundary INVALID / fill REJECTED -> BLOCKED', () => {
  const blocked1 = goodHealthInputs();
  blocked1.paper_forbidden_surface = evaluatePaperForbiddenSurface({ private_key: 'x' });
  assert.equal(evaluatePaperExecutionHealth(blocked1).paper_exec_health_state, 'PAPER_EXEC_HEALTH_BLOCKED');

  const blocked2 = goodHealthInputs();
  blocked2.paper_pnl_read_model = evaluatePaperPnlReadModel({
    paper_fills: [{ ...fillSpec[0], executed: true }]
  });
  assert.equal(evaluatePaperExecutionHealth(blocked2).paper_exec_health_state, 'PAPER_EXEC_HEALTH_BLOCKED');

  const blocked3 = goodHealthInputs();
  blocked3.paper_exec_input_boundary = evaluatePaperExecutionInputBoundary(goodBundle()); // raw refused -> INVALID
  assert.equal(evaluatePaperExecutionHealth(blocked3).paper_exec_health_state, 'PAPER_EXEC_HEALTH_BLOCKED');

  const blocked4 = goodHealthInputs();
  blocked4.candidate_paper_fill = evaluateCandidatePaperFill(goodBuyFill({ signed: true }));
  assert.equal(evaluatePaperExecutionHealth(blocked4).paper_exec_health_state, 'PAPER_EXEC_HEALTH_BLOCKED');
});

test('(G) degraded boundary -> DEGRADED; missing component -> UNCONFIGURED; smuggle -> BLOCKED, never echoed', () => {
  const degraded = goodHealthInputs();
  degraded.paper_exec_input_boundary = evaluatePaperExecutionInputBoundary({ purpose: 'paper_execution_input' });
  const r = evaluatePaperExecutionHealth(degraded);
  assertSimulated(r);
  assert.equal(r.paper_exec_health_state, 'PAPER_EXEC_HEALTH_DEGRADED');

  const missing = goodHealthInputs();
  delete missing.paper_pnl_read_model;
  assert.equal(evaluatePaperExecutionHealth(missing).paper_exec_health_state, 'PAPER_EXEC_HEALTH_UNCONFIGURED');

  const smuggled = evaluatePaperExecutionHealth({ ...goodHealthInputs(), api_key: 'LEAK' });
  assert.equal(smuggled.paper_exec_health_state, 'PAPER_EXEC_HEALTH_BLOCKED');
  assertAbsent(smuggled, 'LEAK');

  for (const inp of [undefined, null, ...hostiles()]) {
    const h = evaluatePaperExecutionHealth(inp);
    assertSimulated(h);
    assert.equal(h.paper_exec_health_state, 'PAPER_EXEC_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// INTEGRATION CONSISTENCY: Gate-B adapter still guards; send gate still refuses
// ===========================================================================

test('integration: createPaperExecutionAdapter still blocks an order without intent_id', () => {
  const adapter = createPaperExecutionAdapter();
  const res = adapter.simulate({}, {});
  assert.equal(res.executed, false);
  assert.equal(res.simulated, false);
  assert.equal(res.blocked_by, 'intent_ledger');
  assert.equal(res.reason, 'intent_id_required');
  assert.equal(res.signed, false);
  assert.equal(res.signature, null);
});

test('integration: evaluateSendPreflight stays ok:false / can_send:false beside a full paper P&L read-model', () => {
  const pnl = evaluatePaperPnlReadModel(goodPnlInput());
  assert.equal(pnl.paper_pnl_state, 'PAPER_PNL_READ_MODEL');
  // even WITH a complete paper read-model at hand the send gate refuses
  const preflight = evaluateSendPreflight({ purpose: 'paper_send_attempt', paper_pnl: pnl });
  assert.equal(preflight.ok, false);
  assert.equal(preflight.can_send, false);
  assert.equal(preflight.can_broadcast, false);
  assert.equal(preflight.sent, false);
  assert.equal(preflight.signature, null);
  assert.equal(preflight.blockers.includes('send_gate_unconfigured_no_rpc'), true);
});

// ===========================================================================
// END-TO-END: planted forbidden VALUE absent across EVERY Stage-14 output
// ===========================================================================

test('end-to-end: planted endpoint/serialized_tx/signature/private_key VALUES never echoed by any evaluator', () => {
  const planters = [
    ['endpoint', 'PLANTED-https://leak.example/rpc'],
    ['serialized_tx', 'PLANTED-AABBCC-serialized'],
    ['signature', 'PLANTED-5sig5sig'],
    ['private_key', 'PLANTED-deadbeefkey']
  ];
  for (const [pname, pval] of planters) {
    const outs = [
      evaluatePaperExecutionInputBoundary({ ...goodPaperInput(), [pname]: pval }),
      evaluateCandidatePaperFill(goodBuyFill({ [pname]: pval })),
      evaluatePaperPnlReadModel({ paper_fills: [{ ...fillSpec[0], [pname]: pval }] }),
      evaluatePaperOutcome({ paper_fills: [{ ...fillSpec[0], [pname]: pval }] }),
      evaluatePaperExecutionSuppression({ purpose: 'x', [pname]: pval }),
      evaluatePaperForbiddenSurface({ purpose: 'x', [pname]: pval }),
      evaluatePaperExecutionHealth({ ...goodHealthInputs(), [pname]: pval })
    ];
    for (const o of outs) {
      assertSafe(o);
      assertAbsent(o, 'PLANTED');
    }
  }
});

// ===========================================================================
// STATIC SOURCE GUARDS
// ===========================================================================

test('static guard: src import-free, no exec-flag:true literal, no mutable module state, no clock/RNG/network/fs/env', () => {
  const files = [
    '../src/paper-execution-foundations.mjs',
    '../src/index.mjs'
  ].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    assert.equal(/can_broadcast\s*:\s*true/.test(src), false, `${f} must not contain can_broadcast: true`);
    assert.equal(/broadcast_permitted\s*:\s*true/.test(src), false, `${f} must not contain broadcast_permitted: true`);
    assert.equal(/signer_ready\s*:\s*true/.test(src), false, `${f} must not contain signer_ready: true`);
    assert.equal(/signing_permitted\s*:\s*true/.test(src), false, `${f} must not contain signing_permitted: true`);
    // is_valid_on_chain: true must never be EMITTED — checked outside prose/refusal-list strings
    const noStrings = src.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
    assert.equal(/is_valid_on_chain\s*:\s*true/.test(noStrings), false, `${f} must not emit is_valid_on_chain: true`);
    if (f.endsWith('paper-execution-foundations.mjs')) {
      assert.equal(/^\s*import\s/m.test(src), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(src), false, 'implementation must not use require(');
      // no module-level mutable binding (let/var at column 0)
      assert.equal(/^(?:let|var)\s/m.test(src), false, 'implementation must hold no module-level let/var');
      // no mutable module-level array store
      assert.equal(/^(const|let|var)\s+\w*(store|ledger|records|payload|cache|state)\w*\s*=\s*\[\s*\]/im.test(src), false,
        'implementation must hold no mutable module-level array');
      assert.equal(/fetch\s*\(|new\s+WebSocket|new\s+Connection|sendTransaction|sendRawTransaction|\.sign\s*\(/.test(src), false, 'no network/send primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env|Math\.random|setTimeout|setInterval/.test(src), false, 'no clock/env/RNG/timer');
      assert.equal(/node:fs|readFileSync|writeFileSync/.test(src), false, 'no fs surface');
      assert.equal(/\b(rpc_url|endpoint_url|serialized_tx|signed_transaction|wire_transaction|broadcast_payload)\s*[:=]\s*['"`][^'"`]/.test(src), false,
        'implementation must hold no endpoint/serialized/signature VALUE literal');
    }
  }
});

test('static guard: no candidate_* name beyond the registered allowed list; deferred outcome enum unused', () => {
  const f = fileURLToPath(new URL('../src/paper-execution-foundations.mjs', import.meta.url));
  const src = readFileSync(f, 'utf8');
  const ALLOWED = new Set([
    // registered candidate FIELD names (paper-portfolio precedent, SSOT G22)
    'candidate_realized_pnl', 'candidate_unrealized_pnl', 'candidate_fees_total',
    'candidate_slippage_cost', 'candidate_paper_pnl', 'candidate_pnl_by_wallet',
    'candidate_pnl_by_copy_mode', 'candidate_pnl_by_brain', 'candidate_mark_status',
    // the prescribed LOCAL kind literal / component slot for the (B) descriptor
    'candidate_paper_fill'
  ]);
  const found = new Set(src.match(/candidate_[a-z0-9_]+/g) || []);
  for (const name of found) {
    assert.equal(ALLOWED.has(name), true, `unexpected candidate name in src: ${name}`);
  }
  // the DEFERRED SSOT enum stays deferred — never used as field/state here
  assert.equal(src.includes('candidate_paper_outcome_state'), false);
});

test('static guard (behavioral): simulated:true present on every fill/pnl/outcome output of every state', () => {
  const outputs = [
    evaluateCandidatePaperFill(goodBuyFill()),
    evaluateCandidatePaperFill(goodBuyFill({ executed: true })),
    evaluateCandidatePaperFill(undefined),
    evaluatePaperPnlReadModel(goodPnlInput()),
    evaluatePaperPnlReadModel({ paper_fills: [{ ...fillSpec[0], executed: true }] }),
    evaluatePaperPnlReadModel(undefined),
    evaluatePaperOutcome({ paper_fills: [{ position_ref: 'p', wallet_ref: 'w', side: 'buy', quantity: 1, price: 1 }] }),
    evaluatePaperOutcome(undefined)
  ];
  for (const o of outputs) {
    assert.equal(o.simulated, true);
    assert.equal(Object.isFrozen(o), true);
    assert.equal(o.read_only, true);
  }
  // and the nested aggregates of a full read-model
  const r = evaluatePaperPnlReadModel(goodPnlInput());
  for (const p of Object.values(r.positions)) assert.equal(p.simulated, true);
  for (const map of [r.candidate_pnl_by_wallet, r.candidate_pnl_by_copy_mode, r.candidate_pnl_by_brain]) {
    for (const b of Object.values(map)) assert.equal(b.simulated, true);
  }
});
