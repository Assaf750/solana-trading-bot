// PR-S21 test suite for @soltrade/testnet-send-boundary-foundations.
// node:test + node:assert/strict. Deterministic. Testnet-SHAPED, NO real network.
//
// Builds: a Stage-19-SHAPED sign-only result ({ signed:true, signature:<string>,
// can_send:false, mode:'sign_only' }) + a REAL Stage-12 SEND_REVIEW_PASS_ADVISORY
// verdict (via the full lower-stage chain) + a testnet cluster tag -> exercises
// the eight foundations (A-H). Confirms the seam can NEVER be ready across ALL
// met-combinations, mainnet hard-refusal, secret redaction, idempotency, failure
// + bundle VALUE mapping, suppression three tokens, surface redaction +
// endpoint_ref shape-check, health clean -> _SUPPRESSED, and that the EXISTING
// send-gate evaluateSendPreflight is STILL ok:false / can_send:false alongside.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeTestnetSendInputBoundaryContract,
  evaluateTestnetSendInputBoundary,
  describeTestnetActivationSeamContract,
  evaluateTestnetActivationSeam,
  describeTestnetSendIdempotencyContract,
  evaluateTestnetSendIdempotency,
  describeTestnetFailedSendClassContract,
  evaluateTestnetFailedSendClass,
  describeTestnetBundleStatusContract,
  evaluateTestnetBundleStatus,
  describeTestnetSendSuppressionContract,
  evaluateTestnetSendSuppression,
  describeTestnetForbiddenSurfaceContract,
  evaluateTestnetForbiddenSurface,
  isValidEndpointRef,
  describeTestnetSendHealthContract,
  evaluateTestnetSendHealth
} from '../src/index.mjs';

// EXISTING fail-closed send gate (test-level only, STILL refuses; do NOT modify).
import { evaluateSendPreflight } from '../../send-gate-contract/src/send-gate-contract.mjs';

// ---------------------------------------------------------------------------
// REAL Stage-12 SEND_REVIEW_PASS_ADVISORY chain (copied from the Stage-12 test
// chain builders: Stage-4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12).
// ---------------------------------------------------------------------------

import {
  evaluateSendReviewInputBoundary,
  evaluateSenderProviderBoundary,
  evaluateCandidateSendReviewDescriptor,
  evaluateSendReadinessAdvisory,
  evaluateBroadcastForbiddenSurface,
  evaluateSendReviewVerdict
} from '../../send-broadcast-review-foundations/src/index.mjs';

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

const mk = (type, ref, w, t) => normalizeIngestionEvent({
  event_type: type, event_ref: ref, source_ref: 'mock_replay', observed_at_ref: 'ts',
  wallet_ref: w, token_ref: t, signature_ref: 'sig', slot_ref: 1
}).normalized_event;

const wOk = evaluateWalletObservationIntelligence({
  purpose: 'wallet_observation_input', wallet_ref: 'w-1',
  events: [mk('wallet_transaction_observed', 'e1', 'w-1', 't-1'), mk('swap_observed', 'e2', 'w-1', 't-1'), mk('mint_observed', 'e3', 'w-1', 't-2')],
  read_only: true
});
const tOk = evaluateTokenObservationIntelligence({
  purpose: 'token_observation_input', token_ref: 't-1',
  events: [mk('mint_observed', 'e1', 'w-1', 't-1'), mk('pool_observed', 'e2', 'w-2', 't-1'), mk('swap_observed', 'e3', 'w-1', 't-1')],
  read_only: true
});
const rOk = evaluateWalletTokenRelationship({
  purpose: 'wallet_token_relationship_input', wallet_ref: 'w-1', token_ref: 't-1',
  events: [mk('swap_observed', 'e1', 'w-1', 't-1'), mk('swap_observed', 'e2', 'w-1', 't-1')],
  read_only: true
});
const dOk = evaluateWalletTokenDiagnostics({ purpose: 'wallet_token_diagnostics_input', wallet_observation: wOk, token_observation: tOk, relationship: rOk });
const hOk = evaluateIntelligenceHealth({ wallet_observation: wOk, token_observation: tOk, relationship: rOk, diagnostics: dOk });

const sigBoundaryValid = evaluateSignalInputBoundary({ purpose: 'signal_input_boundary', wallet_observation: wOk, token_observation: tOk, relationship: rOk, diagnostics: dOk, intelligence_health: hOk });
const walletLed = evaluateWalletLedCandidateSignal({ purpose: 'wallet_led_signal_input', wallet_observation: wOk, relationship: rOk, diagnostics: dOk });
const tokenAct = evaluateTokenActivityCandidateSignal({ purpose: 'token_activity_signal_input', token_observation: tOk, relationship: rOk, diagnostics: dOk });
const sigScore = evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLed, tokenAct], boundary: sigBoundaryValid });
const sigSupp = evaluateSignalSuppression({ purpose: 'signal_suppression_input', candidate_signal: walletLed, wallet_observation: wOk, token_observation: tOk, relationship: rOk });
const sigHealth = evaluateSignalHealth({ signal_input_boundary: sigBoundaryValid, candidate_signals: [walletLed, tokenAct], score: sigScore, suppression: sigSupp });

const riskBoundaryValid = evaluateRiskInputBoundary({ purpose: 'risk_input_boundary', signal_input_boundary: sigBoundaryValid, candidate_signal: walletLed, signal_score: sigScore, signal_suppression: sigSupp, signal_health: sigHealth });
const hardPass = evaluateHardRiskGate({ purpose: 'hard_risk_input', candidate_signal: walletLed, risk_input_boundary: riskBoundaryValid, risk_factors: { honeypot_indicator: false, freeze_authority_indicator: false, mint_authority_indicator: false, owner_concentration_indicator: false, blacklist_indicator: false, unknown_token_metadata: false } });
const liqPass = evaluateLiquidityExitRisk({ purpose: 'liquidity_exit_input', liquidity_observed_bucket: 'deep', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low' });
const expPass = evaluateExposureLimitRisk({ purpose: 'exposure_limit_input', exposure_bucket: 'within_limit', wallet_limit_state: 'ok', token_limit_state: 'ok' });
const verdictPass = evaluateRiskVerdict({ purpose: 'risk_verdict_input', hard_risk: hardPass, liquidity_exit: liqPass, exposure: expPass });
const riskSuppPass = evaluateRiskSuppression({ purpose: 'risk_suppression_input', risk_verdict: verdictPass });
const riskHealthPass = evaluateRiskHealth({ risk_input_boundary: riskBoundaryValid, hard_risk: hardPass, liquidity_exit: liqPass, exposure: expPass, risk_verdict: verdictPass, risk_suppression: riskSuppPass });

const intentBoundaryValid = evaluateIntentInputBoundary({ purpose: 'intent_input_boundary', risk_input_boundary: riskBoundaryValid, hard_risk: hardPass, liquidity_exit: liqPass, exposure: expPass, risk_verdict: verdictPass, risk_suppression: riskSuppPass, risk_health: riskHealthPass });
const recordedCandidate = evaluateCandidateIntentRecord({ purpose: 'candidate_intent_record_input', intent_input_boundary: intentBoundaryValid, risk_verdict: verdictPass, signal_ref: 'sig-ref-1', wallet_ref: 'w-1', token_ref: 't-1', audit_ref: 'audit-1', record_ref: 'rec-1' });
const intentAuditValid = evaluateIntentAuditEnvelope({ purpose: 'intent_audit_envelope_input', reason_codes: ['risk_pass_advisory_confirmed', 'candidate_recorded'], decision_ref: 'dec-1', intent_record_ref: 'rec-1', actor_ref: 'actor-1' });
const intentNotSuppressed = Object.freeze({ suppressed: false, suppression_reasons: [], read_only: true });
const ledgerAppendOk = evaluateIntentLedgerAppend({ purpose: 'intent_ledger_append_input', previous_records: [], candidate_intent_record: recordedCandidate, audit: intentAuditValid, record_ref: 'rec-1' });
const intentStateAwaiting = evaluateIntentStateTransition({ purpose: 'intent_state_input', candidate_intent_record: recordedCandidate, requested_transition: 'request_route_review' });
const intentHealthAwaiting = evaluateIntentHealth({ intent_input_boundary: intentBoundaryValid, candidate_intent_record: recordedCandidate, ledger_append: ledgerAppendOk, intent_state: intentStateAwaiting, audit: intentAuditValid, suppression: intentNotSuppressed });

const routeBoundaryValid = evaluateRouteInputBoundary({ purpose: 'route_input_boundary', intent_input_boundary: intentBoundaryValid, candidate_intent_record: recordedCandidate, intent_ledger_append: ledgerAppendOk, intent_state: intentStateAwaiting, intent_audit: intentAuditValid, intent_suppression: intentNotSuppressed, intent_health: intentHealthAwaiting });
const routeSourceValid = evaluateRouteSourceBoundary({ purpose: 'route_source_boundary', route_source: 'fixture_route_metadata' });
const candidateRouteValid = evaluateCandidateRoutePlan({ purpose: 'candidate_route_plan_input', route_input_boundary: routeBoundaryValid, route_source_boundary: routeSourceValid, intent_record_ref: 'rec-1', route_plan_ref: 'plan-1', route_metadata: { input_asset_ref: 'asset-in', output_asset_ref: 'asset-out', route_hop_count_bucket: 'few', liquidity_bucket: 'deep', estimated_slippage_bucket: 'low', route_quality_bucket: 'good', requires_live_quote: false, no_transaction_build: true } });
const routeFeasible = evaluateRouteFeasibility({ purpose: 'route_feasibility_input', route_quality_bucket: 'good', estimated_slippage_bucket: 'low', liquidity_bucket: 'deep', hop_count_bucket: 'single' });
const previewValid = evaluateExecutionPlanPreview({ purpose: 'execution_plan_preview_input', candidate_route_plan: candidateRouteValid, route_feasibility: routeFeasible, preview_ref: 'preview-1', no_transaction_build: true, no_order: true, no_signing: true, no_send: true });
const routeNotSuppressed = evaluateRouteSuppression({ purpose: 'route_suppression_input', route_input_boundary: routeBoundaryValid, route_source_boundary: routeSourceValid, candidate_route_plan: candidateRouteValid, route_feasibility: routeFeasible });
const routeHealthPreviewReady = evaluateRouteHealth({ route_input_boundary: routeBoundaryValid, route_source_boundary: routeSourceValid, candidate_route_plan: candidateRouteValid, route_feasibility: routeFeasible, execution_plan_preview: previewValid, route_suppression: routeNotSuppressed });

const txInputBoundaryValid = evaluateTransactionBuildInputBoundary({ purpose: 'tx_build_input_boundary', route_input_boundary: routeBoundaryValid, route_source_boundary: routeSourceValid, candidate_route_plan: candidateRouteValid, route_feasibility: routeFeasible, execution_plan_preview: previewValid, route_suppression: routeNotSuppressed, route_health: routeHealthPreviewReady });
const txSourceValid = evaluateTransactionBuildSourceBoundary({ purpose: 'tx_build_source_boundary', tx_build_source: 'fixture_tx_build_metadata' });
const txDescriptor = evaluateCandidateTransactionBuildDescriptor({ purpose: 'candidate_tx_build_descriptor_input', tx_build_input_boundary: txInputBoundaryValid, tx_build_source_boundary: txSourceValid, preview_ref: 'preview-1', route_plan_ref: 'plan-1', intent_record_ref: 'rec-1', tx_build_review_ref: 'txr-1', tx_build_metadata: { account_count_bucket: 'medium', instruction_count_bucket: 'low', compute_unit_bucket: 'medium', transaction_size_bucket: 'medium', lookup_table_bucket: 'maybe_needed', priority_fee_bucket: 'medium', requires_serialization: false, requires_signing: false, requires_network: false } });
const txResourceAcceptable = evaluateTransactionBuildResourceAdvisory({ purpose: 'tx_build_resource_advisory_input', account_count_bucket: 'medium', instruction_count_bucket: 'low', compute_unit_bucket: 'medium', transaction_size_bucket: 'medium', lookup_table_bucket: 'maybe_needed' });
const txSerializationClean = evaluateSerializationForbiddenSurface({ tx_build_kind: 'candidate_tx_build_descriptor', account_count_bucket: 'medium' });
const txReviewVerdictPass = evaluateTransactionBuildReviewVerdict({ purpose: 'tx_build_review_verdict_input', tx_build_input_boundary: txInputBoundaryValid, tx_build_source_boundary: txSourceValid, candidate_tx_build_descriptor: txDescriptor, tx_build_resource_advisory: txResourceAcceptable, serialization_surface: txSerializationClean });
const txSuppressionNotSuppressed = Object.freeze({ suppressed: false, suppression_reasons: [], read_only: true });
const txHealthReviewed = evaluateTransactionBuildHealth({ tx_build_input_boundary: txInputBoundaryValid, tx_build_source_boundary: txSourceValid, candidate_tx_build_descriptor: txDescriptor, tx_build_resource_advisory: txResourceAcceptable, serialization_surface: txSerializationClean, tx_build_review_verdict: txReviewVerdictPass, tx_build_suppression: txSuppressionNotSuppressed });

const signingBoundaryValid = evaluateSigningReviewInputBoundary({ purpose: 'signing_review_input_boundary', tx_build_input_boundary: txInputBoundaryValid, tx_build_source_boundary: txSourceValid, candidate_tx_build_descriptor: txDescriptor, tx_build_resource_advisory: txResourceAcceptable, serialization_surface: txSerializationClean, tx_build_review_verdict: txReviewVerdictPass, tx_build_suppression: txSuppressionNotSuppressed, tx_build_health: txHealthReviewed });
const signingCustodyValid = evaluateSignerCustodyBoundary({ purpose: 'signer_custody_boundary', signer_source: 'isolated_signer_disabled' });
const signingDescriptor = evaluateCandidateSigningReviewDescriptor({ purpose: 'candidate_signing_review_descriptor_input', signing_review_input_boundary: signingBoundaryValid, signer_custody_boundary: signingCustodyValid, tx_build_review_ref: 'txr-1', signing_review_ref: 'sr-1', intent_record_ref: 'rec-1', signer_metadata: { key_custody_mode_bucket: 'isolated_signer', signer_profile_status_bucket: 'active', dual_control_bucket: 'required_satisfied', signer_reachability_bucket: 'reachable', requires_key_material: false, requires_signing: false, requires_network: false } });
const signingReadiness = evaluateSignerCustodyReadinessAdvisory({ purpose: 'signer_custody_readiness_input', key_custody_mode_bucket: 'isolated_signer', signer_profile_status_bucket: 'active', dual_control_bucket: 'required_satisfied', signer_reachability_bucket: 'reachable', custody_verification_bucket: 'verified' });
const signingKeySurface = evaluatePrivateKeyForbiddenSurface({ purpose: 'candidate_signing_review_descriptor' });
const signingVerdictPass = evaluateSigningReviewVerdict({ purpose: 'signing_review_verdict_input', signing_review_input_boundary: signingBoundaryValid, signer_custody_boundary: signingCustodyValid, candidate_signing_review_descriptor: signingDescriptor, signer_custody_readiness_advisory: signingReadiness, private_key_surface: signingKeySurface });
const signingSuppression = evaluateSigningReviewSuppression({ purpose: 'signing_review_suppression_input', signing_review_input_boundary: signingBoundaryValid, candidate_signing_review_descriptor: signingDescriptor, signer_custody_readiness_advisory: signingReadiness, private_key_surface: signingKeySurface, signer_custody_boundary: signingCustodyValid });
const signingHealth = evaluateSigningReviewHealth({ signing_review_input_boundary: signingBoundaryValid, signer_custody_boundary: signingCustodyValid, candidate_signing_review_descriptor: signingDescriptor, signer_custody_readiness_advisory: signingReadiness, private_key_surface: signingKeySurface, signing_review_verdict: signingVerdictPass, signing_review_suppression: signingSuppression });

const validSendBoundary = evaluateSendReviewInputBoundary({ purpose: 'send_review_input_boundary', signing_review_verdict: signingVerdictPass, signing_review_health: signingHealth });
const validSender = evaluateSenderProviderBoundary({ purpose: 'sender_provider_boundary', sender_source: 'helius_sender_disabled' });
const cleanDescriptor = evaluateCandidateSendReviewDescriptor({ purpose: 'candidate_send_review_descriptor_input', send_review_input_boundary: validSendBoundary, sender_provider_boundary: validSender, send_review_ref: 'send-1', signing_review_ref: 'sr-1', intent_record_ref: 'rec-1', send_metadata: { sender_mode_bucket: 'disabled', bundle_bucket: 'no_bundle', tip_bucket: 'low', idempotency_bucket: 'bound', intent_binding_bucket: 'bound', requires_broadcast: false, requires_network: false, requires_serialization: false, requires_signature: false } });
const cleanReadiness = evaluateSendReadinessAdvisory({ purpose: 'send_readiness_input', sender_status_bucket: 'disabled', idempotency_bucket: 'bound', intent_binding_bucket: 'bound', bundle_bucket: 'no_bundle', tip_bucket: 'low' });
const cleanSurface = evaluateBroadcastForbiddenSurface({ purpose: 'candidate_send_review_descriptor' });
const sendReviewPass = evaluateSendReviewVerdict({ purpose: 'send_review_verdict_input', send_review_input_boundary: validSendBoundary, sender_provider_boundary: validSender, candidate_send_review_descriptor: cleanDescriptor, send_readiness_advisory: cleanReadiness, broadcast_surface: cleanSurface });

// Stage-19-SHAPED sign-only result (opaque; matched by shape only, never re-signed).
const signOnlyResult = Object.freeze({ ok: true, signed: true, signature: 'c2lnbmF0dXJlLWJhc2U2NA==', can_send: false, mode: 'sign_only', intent_id: 'intent-1', note: 'sign-only; not sent; not REAL-LIVE' });

test('preconditions: the REAL Stage-12 chain reaches SEND_REVIEW_PASS_ADVISORY + sign-only shape', () => {
  assert.equal(sendReviewPass.send_review_state, 'SEND_REVIEW_PASS_ADVISORY');
  assert.equal(signOnlyResult.signed, true);
  assert.equal(signOnlyResult.can_send, false);
  assert.equal(signOnlyResult.mode, 'sign_only');
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

const goodInput = (over = {}) => ({
  purpose: 'testnet_send_input',
  signing_result: signOnlyResult,
  send_review: sendReviewPass,
  cluster_tag: 'devnet',
  intent_id: 'intent-1',
  ...over
});

// ===========================================================================
// (A) TESTNET-SEND INPUT BOUNDARY
// ===========================================================================

test('(A) descriptor: shape, states, cluster tags, safe flags', () => {
  const d = describeTestnetSendInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'testnet-send-input-boundary');
  assert.equal(d.eligible_for_testnet_send, false);
  assert.deepEqual([...d.supported_states], ['TESTNET_SEND_INPUT_UNCONFIGURED', 'TESTNET_SEND_INPUT_INVALID', 'TESTNET_SEND_INPUT_DEGRADED', 'TESTNET_SEND_INPUT_VALID']);
  assert.deepEqual([...d.supported_cluster_tags], ['devnet', 'testnet', 'localnet']);
});

test('(A) missing / hostile input -> unconfigured (never throws)', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateTestnetSendInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.testnet_send_input_state, 'TESTNET_SEND_INPUT_UNCONFIGURED');
  }
  const thrower = { purpose: 'testnet_send_input', get intent_id() { throw new Error('boom'); } };
  const r = evaluateTestnetSendInputBoundary(thrower);
  assertSafe(r);
  assert.equal(r.testnet_send_input_state, 'TESTNET_SEND_INPUT_UNCONFIGURED');
});

test('(A) clean sign-only + PASS_ADVISORY + testnet tag -> VALID, eligible; opens nothing', () => {
  for (const tag of ['devnet', 'testnet', 'localnet']) {
    const r = evaluateTestnetSendInputBoundary(goodInput({ cluster_tag: tag }));
    assertSafe(r);
    assert.equal(r.testnet_send_input_state, 'TESTNET_SEND_INPUT_VALID');
    assert.equal(r.eligible_for_testnet_send, true);
    assert.equal(r.cluster_tag, tag);
    assert.equal(r.can_send, false);
    assert.equal(r.can_broadcast, false);
  }
});

test('(A) MAINNET hard-refusal: tag mainnet OR nested mainnet token -> INVALID mainnet_refused', () => {
  const r1 = evaluateTestnetSendInputBoundary(goodInput({ cluster_tag: 'mainnet' }));
  assert.equal(r1.testnet_send_input_state, 'TESTNET_SEND_INPUT_INVALID');
  assert.equal(r1.reasons.includes('mainnet_refused'), true);
  const r2 = evaluateTestnetSendInputBoundary(goodInput({ cluster_tag: 'mainnet-beta' }));
  assert.equal(r2.reasons.includes('mainnet_refused'), true);
  // nested one level (inside a benign object)
  const r3 = evaluateTestnetSendInputBoundary(goodInput({ meta: { network: 'mainnet-beta' } }));
  assert.equal(r3.testnet_send_input_state, 'TESTNET_SEND_INPUT_INVALID');
  assert.equal(r3.reasons.includes('mainnet_refused'), true);
  // a 'prod' indicator
  const r4 = evaluateTestnetSendInputBoundary(goodInput({ env: 'prod' }));
  assert.equal(r4.reasons.includes('mainnet_refused'), true);
});

test('(A) default / missing / unknown cluster tag -> refused', () => {
  const r1 = evaluateTestnetSendInputBoundary(goodInput({ cluster_tag: undefined }));
  // missing -> UNCONFIGURED (required input missing)
  assert.equal(r1.testnet_send_input_state, 'TESTNET_SEND_INPUT_UNCONFIGURED');
  const r2 = evaluateTestnetSendInputBoundary(goodInput({ cluster_tag: 'staging' }));
  assert.equal(r2.testnet_send_input_state, 'TESTNET_SEND_INPUT_INVALID');
  assert.equal(r2.reasons.includes('cluster_tag_not_testnet_enum'), true);
});

test('(A) raw endpoint / key / url planted -> refused and ABSENT from JSON', () => {
  const plants = [
    { endpoint_url: 'https://api.testnet.example/rpc' },
    { url: 'wss://stream.example/ws' },
    { api_key: 'SECRET-KEY-VALUE-LEAK' },
    { private_key: '-----BEGIN PRIVATE KEY-----LEAK' },
    { endpoint_ref: 'https://leak.example/rpc' }
  ];
  for (const p of plants) {
    const r = evaluateTestnetSendInputBoundary(goodInput(p));
    assertSafe(r);
    assert.equal(r.testnet_send_input_state, 'TESTNET_SEND_INPUT_INVALID');
    const json = JSON.stringify(r);
    assert.equal(json.includes('LEAK'), false);
    assert.equal(json.includes('leak.example'), false);
    assert.equal(json.includes('testnet.example'), false);
  }
});

test('(A) opaque endpoint_ref shape OK -> VALID; signing_result not sign-only / review not pass -> DEGRADED', () => {
  const rOk = evaluateTestnetSendInputBoundary(goodInput({ endpoint_ref: 'testnet-rpc-ref-001' }));
  assert.equal(rOk.testnet_send_input_state, 'TESTNET_SEND_INPUT_VALID');
  // not sign-only shaped
  const rD1 = evaluateTestnetSendInputBoundary(goodInput({ signing_result: { signed: true, signature: 's', can_send: false, mode: 'partial' } }));
  assert.equal(rD1.testnet_send_input_state, 'TESTNET_SEND_INPUT_DEGRADED');
  assert.equal(rD1.reasons.includes('signing_result_not_sign_only'), true);
  // review not pass advisory
  const rD2 = evaluateTestnetSendInputBoundary(goodInput({ send_review: { send_review_state: 'SEND_REVIEW_DEGRADED', read_only: true } }));
  assert.equal(rD2.testnet_send_input_state, 'TESTNET_SEND_INPUT_DEGRADED');
  assert.equal(rD2.reasons.includes('send_review_not_pass_advisory'), true);
});

test('(A) smuggled execution command / forbidden true flag -> INVALID', () => {
  const r1 = evaluateTestnetSendInputBoundary(goodInput({ send: true }));
  assert.equal(r1.testnet_send_input_state, 'TESTNET_SEND_INPUT_INVALID');
  const r2 = evaluateTestnetSendInputBoundary(goodInput({ can_send: true }));
  assert.equal(r2.testnet_send_input_state, 'TESTNET_SEND_INPUT_INVALID');
});

// ===========================================================================
// (B) TESTNET-ACTIVATION SEAM — the never-ready seam
// ===========================================================================

const goodInputValid = goodInput();

test('(B) descriptor: fixed literals + hardcoded met:false adapter requirement', () => {
  const d = describeTestnetActivationSeamContract();
  assertSafe(d);
  assert.equal(d.activation_performed, false);
  assert.equal(d.send_ready_advisory, false);
  assert.equal(d.endpoint_in_repo, false);
  assert.equal(d.key_in_repo, false);
  assert.equal(d.secret_in_repo, false);
  const adapter = d.seam_requirements.find((x) => x.requirement === 'TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION');
  assert.equal(adapter.met, false);
  assert.equal(Array.isArray(d.required_owner_inputs), true);
  assert.equal(d.required_owner_inputs.length > 0, true);
});

test('(B) seam NEVER send_ready_advisory:true across ALL met-combinations', () => {
  const boundary = evaluateTestnetSendInputBoundary(goodInputValid);
  assert.equal(boundary.testnet_send_input_state, 'TESTNET_SEND_INPUT_VALID');
  const bools = [true, false];
  for (const e of bools) for (const c of bools) for (const f of bools) {
    const r = evaluateTestnetActivationSeam({
      purpose: 'testnet_activation_seam',
      testnet_send_input: boundary,
      endpoint_ref_present: e,
      owner_broadcast_caller_present: c,
      funded_testnet_wallet_present: f
    });
    assertSafe(r);
    assert.equal(r.testnet_seam_state, 'TESTNET_SEAM_DESCRIPTOR');
    assert.equal(r.send_ready_advisory, false, 'send_ready_advisory must NEVER be true');
    assert.equal(r.activation_performed, false);
    // the adapter-allowlist requirement pins readiness false
    const adapter = r.seam_requirements.find((x) => x.requirement === 'TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION');
    assert.equal(adapter.met, false);
    assert.equal(r.reasons.includes('unmet_testnet_req_separate_send_adapter_allowlist_decision'), true);
  }
});

test('(B) missing / not-valid boundary -> unconfigured; mainnet -> invalid', () => {
  const r1 = evaluateTestnetActivationSeam({ purpose: 'testnet_activation_seam' });
  assert.equal(r1.testnet_seam_state, 'TESTNET_SEAM_UNCONFIGURED');
  assert.equal(r1.send_ready_advisory, false);
  const notValid = evaluateTestnetSendInputBoundary(goodInput({ send_review: { send_review_state: 'SEND_REVIEW_DEGRADED', read_only: true } }));
  const r2 = evaluateTestnetActivationSeam({ purpose: 'testnet_activation_seam', testnet_send_input: notValid });
  assert.equal(r2.testnet_seam_state, 'TESTNET_SEAM_UNCONFIGURED');
  const r3 = evaluateTestnetActivationSeam({ purpose: 'testnet_activation_seam', testnet_send_input: goodInputValid, network: 'mainnet' });
  assert.equal(r3.testnet_seam_state, 'TESTNET_SEAM_INVALID');
  assert.equal(r3.reasons.includes('mainnet_refused'), true);
});

// ===========================================================================
// (C) IDEMPOTENCY GUARD
// ===========================================================================

test('(C) first-seen advisory vs duplicate refused; never authorizes a send', () => {
  const first = evaluateTestnetSendIdempotency({ intent_id: 'intent-9', prior_send_records: [{ intent_id: 'other' }] });
  assertSafe(first);
  assert.equal(first.testnet_idempotency_state, 'TESTNET_IDEMPOTENCY_FIRST_SEEN');
  assert.equal(first.authorizes_send, false);
  const dup = evaluateTestnetSendIdempotency({ intent_id: 'intent-9', prior_send_records: [{ intent_id: 'intent-9' }] });
  assert.equal(dup.testnet_idempotency_state, 'TESTNET_IDEMPOTENCY_DUPLICATE_REFUSED');
  assert.equal(dup.is_duplicate, true);
  assert.equal(dup.authorizes_send, false);
});

test('(C) missing intent_id -> INVALID; mainnet in records -> INVALID', () => {
  const r1 = evaluateTestnetSendIdempotency({ prior_send_records: [] });
  assert.equal(r1.testnet_idempotency_state, 'TESTNET_IDEMPOTENCY_INVALID');
  const r2 = evaluateTestnetSendIdempotency({ intent_id: 'x', prior_send_records: [{ intent_id: 'y', network: 'mainnet-beta' }] });
  assert.equal(r2.testnet_idempotency_state, 'TESTNET_IDEMPOTENCY_INVALID');
  assert.equal(r2.reasons.includes('mainnet_refused'), true);
});

// ===========================================================================
// (D) FAILED-SEND CLASSIFIER -> failure_type VALUE vocabulary
// ===========================================================================

test('(D) maps to failure_type values; unknown -> Unknown', () => {
  const values = ['SlippageExceeded', 'BlockhashExpired', 'AccountInUse', 'ComputeBudgetExceeded', 'InsufficientFunds', 'RouteInvalid', 'TokenAccountMissing', 'ProgramError', 'RPCDropped', 'BundleFailed', 'Unknown'];
  for (const v of values) {
    const r = evaluateTestnetFailedSendClass({ failure_indicator: v });
    assertSafe(r);
    assert.equal(r.testnet_failed_send_state, 'TESTNET_FAILED_SEND_CLASSIFIED');
    assert.equal(r.failure_type, v);
  }
  const u = evaluateTestnetFailedSendClass({ failure_indicator: 'something_else' });
  assert.equal(u.failure_type, 'Unknown');
  const missing = evaluateTestnetFailedSendClass({});
  assert.equal(missing.testnet_failed_send_state, 'TESTNET_FAILED_SEND_UNCONFIGURED');
});

// ===========================================================================
// (E) BUNDLE-STATUS OBSERVER
// ===========================================================================

test('(E) observes bundle_status by value; STALE detection past supplied ttl', () => {
  for (const v of ['Pending', 'Failed', 'Landed', 'Invalid', 'STALE_BUNDLE']) {
    const r = evaluateTestnetBundleStatus({ bundle_status: v });
    assertSafe(r);
    assert.equal(r.testnet_bundle_state, 'TESTNET_BUNDLE_OBSERVED');
  }
  // Pending + ttl exceeded -> STALE_BUNDLE
  const stale = evaluateTestnetBundleStatus({ bundle_status: 'Pending', ttl_slots: 10, submitted_slot: 100, observed_slot: 130 });
  assert.equal(stale.bundle_status, 'STALE_BUNDLE');
  assert.equal(stale.stale_detected, true);
  // Pending within ttl -> stays Pending
  const fresh = evaluateTestnetBundleStatus({ bundle_status: 'Pending', ttl_slots: 100, submitted_slot: 100, observed_slot: 130 });
  assert.equal(fresh.bundle_status, 'Pending');
  assert.equal(fresh.stale_detected, false);
  // Pending without ttl (NEVER defaulted) -> stays Pending
  const noTtl = evaluateTestnetBundleStatus({ bundle_status: 'Pending' });
  assert.equal(noTtl.bundle_status, 'Pending');
  // unknown -> INVALID
  const bad = evaluateTestnetBundleStatus({ bundle_status: 'Whatever' });
  assert.equal(bad.testnet_bundle_state, 'TESTNET_BUNDLE_INVALID');
});

// ===========================================================================
// (F) SUPPRESSION — always three tokens
// ===========================================================================

test('(F) ALWAYS suppressed:true with the three not_*_authorized tokens', () => {
  for (const inp of [undefined, null, {}, { whatever: 1 }]) {
    const r = evaluateTestnetSendSuppression(inp);
    assertSafe(r);
    assert.equal(r.suppressed, true);
    assert.equal(r.suppression_reasons.includes('not_send_authorized'), true);
    assert.equal(r.suppression_reasons.includes('not_broadcast_authorized'), true);
    assert.equal(r.suppression_reasons.includes('not_execution_authorized'), true);
  }
  // component codes when unclean
  const dup = evaluateTestnetSendIdempotency({ intent_id: 'x', prior_send_records: [{ intent_id: 'x' }] });
  const r = evaluateTestnetSendSuppression({ testnet_send_idempotency: dup, testnet_activation_seam: evaluateTestnetActivationSeam({ purpose: 'testnet_activation_seam', testnet_send_input: goodInputValid }) });
  assert.equal(r.suppression_reasons.includes('idempotency_duplicate'), true);
  assert.equal(r.suppression_reasons.includes('testnet_seam_not_ready'), true);
});

// ===========================================================================
// (G) FORBIDDEN SURFACE GUARD + endpoint_ref shape-check
// ===========================================================================

test('(G) NAME-only redacting guard: blocks key/credential/endpoint/mainnet; ref never echoed', () => {
  const clean = evaluateTestnetForbiddenSurface({ purpose: 'testnet_send_input', intent_id: 'i' });
  assertSafe(clean);
  assert.equal(clean.testnet_surface_state, 'TESTNET_SURFACE_CLEAN');
  const blocks = [
    [{ private_key: 'LEAKKEY' }, 'key_material_detected'],
    [{ api_key: 'LEAKKEY' }, 'credential_detected'],
    [{ endpoint_url: 'https://leak.example/rpc' }, 'testnet_surface_detected'],
    [{ network: 'mainnet-beta' }, 'mainnet_detected']
  ];
  for (const [inp, reason] of blocks) {
    const r = evaluateTestnetForbiddenSurface(inp);
    assertSafe(r);
    assert.equal(r.testnet_surface_state, 'TESTNET_SURFACE_BLOCKED');
    assert.equal(r.forbidden_field_detected, true);
    assert.equal(r.reasons.includes(reason), true);
    const json = JSON.stringify(r);
    assert.equal(json.includes('LEAKKEY'), false);
    assert.equal(json.includes('leak.example'), false);
  }
});

test('(G) endpoint_ref shape-check: opaque short token OK; ://, whitespace, >128, base58/PEM/mainnet refused', () => {
  assert.equal(isValidEndpointRef('testnet-rpc-ref-001'), true);
  assert.equal(isValidEndpointRef('https://x/rpc'), false);
  assert.equal(isValidEndpointRef('has space'), false);
  assert.equal(isValidEndpointRef('x'.repeat(129)), false);
  assert.equal(isValidEndpointRef('-----BEGIN KEY'), false);
  assert.equal(isValidEndpointRef('1'.repeat(64)), false);
  assert.equal(isValidEndpointRef('mainnet-ref'), false);
  assert.equal(isValidEndpointRef(42), false);
  assert.equal(isValidEndpointRef(''), false);
  // a clean opaque endpoint_ref does NOT trip the surface guard
  const r = evaluateTestnetForbiddenSurface({ purpose: 'testnet_send_input', endpoint_ref: 'testnet-rpc-ref-001' });
  assert.equal(r.testnet_surface_state, 'TESTNET_SURFACE_CLEAN');
});

// ===========================================================================
// (H) HEALTH — clean path -> SUPPRESSED
// ===========================================================================

const fullHealthInputs = (over = {}) => ({
  testnet_send_input: evaluateTestnetSendInputBoundary(goodInputValid),
  testnet_activation_seam: evaluateTestnetActivationSeam({ purpose: 'testnet_activation_seam', testnet_send_input: evaluateTestnetSendInputBoundary(goodInputValid) }),
  testnet_send_idempotency: evaluateTestnetSendIdempotency({ intent_id: 'intent-1', prior_send_records: [] }),
  testnet_failed_send_class: evaluateTestnetFailedSendClass({ failure_indicator: 'Unknown' }),
  testnet_bundle_status: evaluateTestnetBundleStatus({ bundle_status: 'Pending' }),
  testnet_send_suppression: evaluateTestnetSendSuppression({}),
  testnet_forbidden_surface: evaluateTestnetForbiddenSurface({ purpose: 'testnet_send_input', intent_id: 'i' }),
  ...over
});

test('(H) clean path -> SUPPRESSED (send always suppressed in-package)', () => {
  const r = evaluateTestnetSendHealth(fullHealthInputs());
  assertSafe(r);
  assert.equal(r.testnet_send_health_state, 'TESTNET_SEND_HEALTH_SUPPRESSED');
});

test('(H) surface blocked / mainnet / component INVALID -> BLOCKED; missing -> UNCONFIGURED', () => {
  const blockedSurface = evaluateTestnetForbiddenSurface({ private_key: 'X' });
  const r1 = evaluateTestnetSendHealth(fullHealthInputs({ testnet_forbidden_surface: blockedSurface }));
  assert.equal(r1.testnet_send_health_state, 'TESTNET_SEND_HEALTH_BLOCKED');
  const r2 = evaluateTestnetSendHealth(fullHealthInputs({ network: 'mainnet' }));
  assert.equal(r2.testnet_send_health_state, 'TESTNET_SEND_HEALTH_BLOCKED');
  const invalidBundle = evaluateTestnetBundleStatus({ bundle_status: 'Bogus' });
  const r3 = evaluateTestnetSendHealth(fullHealthInputs({ testnet_bundle_status: invalidBundle }));
  assert.equal(r3.testnet_send_health_state, 'TESTNET_SEND_HEALTH_BLOCKED');
  const r4 = evaluateTestnetSendHealth(fullHealthInputs({ testnet_send_input: undefined }));
  assert.equal(r4.testnet_send_health_state, 'TESTNET_SEND_HEALTH_UNCONFIGURED');
  for (const inp of [undefined, null, 'x', 5]) {
    const r = evaluateTestnetSendHealth(inp);
    assertSafe(r);
    assert.equal(r.testnet_send_health_state, 'TESTNET_SEND_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// Integration consistency: the EXISTING send gate STILL refuses
// ===========================================================================

test('integration: send-gate evaluateSendPreflight STILL ok:false / can_send:false alongside everything', () => {
  const r = evaluateSendPreflight({ sign_only_success: true, readiness_ready: true, preflight_ok: true, custody_status: 'ACTIVE' });
  assert.equal(r.ok, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.blockers.includes('send_gate_unconfigured_no_rpc'), true);
});

// ===========================================================================
// TOCTOU: a counting getter cannot serve clean-then-dirty (snapshot once)
// ===========================================================================

test('TOCTOU: counting getter is read exactly once per evaluation (snapshot-once)', () => {
  // A hostile counting getter that would serve a CLEAN value first and a DIRTY
  // (mainnet) value on a second read. Because the evaluator snapshots input once
  // (single shallow spread) and all later screening + classification walk the
  // SAME snapshot, the getter fires EXACTLY ONCE per evaluation — a second read
  // that could flip the verdict mid-evaluation can never happen.
  let n = 0;
  const hostile = {
    purpose: 'testnet_send_input',
    signing_result: signOnlyResult,
    send_review: sendReviewPass,
    intent_id: 'intent-1',
    get cluster_tag() { n++; return n === 1 ? 'devnet' : 'mainnet'; }
  };
  const r = evaluateTestnetSendInputBoundary(hostile);
  assertSafe(r);
  // exactly one read during the single evaluation -> the first (clean) value is
  // the only one ever seen; the mainnet flip-on-second-read is structurally
  // impossible. The verdict reflects the single snapshotted value (VALID).
  assert.equal(n, 1, 'cluster_tag getter must be read exactly once (snapshot-once)');
  assert.equal(r.testnet_send_input_state, 'TESTNET_SEND_INPUT_VALID');
});

// ===========================================================================
// Static guards: import-free, no live network primitive, no can_send:true, no
// module-level mutable state, no new candidate_*, consumed enums by value only.
// ===========================================================================

// strip line + block comments and BLANK string/template contents (mirrors the
// mechanism guard's lexer), so prose / refusal-allowlist literals naming a
// primitive are not mistaken for the primitive itself.
function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : '';
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; out += ' '; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n) { const ch = src[i]; if (ch === '\\') { i += 2; continue; } i++; if (ch === q) break; }
      out += q + q; continue;
    }
    out += c; i++;
  }
  return out;
}

test('static guard: src is import-free, carries NO live network primitive, no can_send:true, no mutable module state', () => {
  const files = ['../src/testnet-send-boundary-foundations.mjs', '../src/index.mjs'].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const code = stripCommentsAndStrings(src);
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    assert.equal(/can_broadcast\s*:\s*true/.test(src), false, `${f} must not contain can_broadcast: true`);
    assert.equal(/send_ready_advisory\s*:\s*true/.test(src), false, `${f} must not contain send_ready_advisory: true`);
    if (f.endsWith('testnet-send-boundary-foundations.mjs')) {
      // import-free implementation
      assert.equal(/^\s*import\s/m.test(code), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(code), false, 'implementation must not use require(');
      // no mutable module-level array
      assert.equal(/\b(const|let|var)\s+\w*(records|store|ledger|payload|cache)\w*\s*=\s*\[\s*\]/i.test(code), false, 'no mutable module-level array');
      // NO live network / signing / send primitive in CODE (comments + strings
      // blanked the same way the mechanism guard does; prose / refusal-allowlist
      // literals naming a primitive do NOT count).
      assert.equal(/fetch\s*\(|XMLHttpRequest|new\s+WebSocket|WebSocket\s*\(|new\s+Connection|sendTransaction|sendRawTransaction|sendAndConfirmTransaction|\.serialize\s*\(|new\s+Socket|\bgrpc\b/.test(code), false, 'no live network/send primitive');
      assert.equal(/signTransaction|partialSign|\bKeypair\b|fromSecretKey|webcrypto|subtle\.sign/.test(code), false, 'no signing/crypto primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env|Math\.random/.test(code), false, 'no clock/env/RNG');
      // no new candidate_* name DECLARED in code (prose/refusal text is blanked;
      // the SSOT-drift gate is the authoritative project-wide candidate guard).
      assert.equal(/candidate_/.test(code), false, 'package declares no candidate_* name in code');
    }
  }
});
