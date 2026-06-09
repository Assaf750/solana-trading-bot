// PR-S7-A test suite for @soltrade/risk-engine-foundations
// node:test + node:assert/strict. Deterministic. Builds REAL Stage-6 signal
// results via the signal-engine-foundations evaluators, which consume REAL
// Stage-5 intelligence (wallet-token-intelligence-foundations) built from REAL
// Stage-4 normalized events (data-ingestion-foundations).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeRiskInputBoundaryContract,
  validateRiskInputBoundary,
  evaluateRiskInputBoundary,
  describeHardRiskGateContract,
  validateHardRiskInput,
  evaluateHardRiskGate,
  describeLiquidityExitRiskContract,
  validateLiquidityExitRiskInput,
  evaluateLiquidityExitRisk
} from '../src/index.mjs';

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
void validateRiskInputBoundary;
void validateHardRiskInput;
void validateLiquidityExitRiskInput;

// ---------------------------------------------------------------------------
// REAL Stage-4 -> Stage-5 -> Stage-6 builders
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

// sanity: confirm the real Stage-6 chain reached READY advisory
test('preconditions: real Stage-6 chain reaches READY advisory', () => {
  assert.equal(sigBoundaryValid.signal_input_state, 'SIGNAL_INPUT_VALID');
  assert.equal(walletLed.candidate_signal_state, 'WALLET_LED_CANDIDATE');
  assert.equal(tokenAct.candidate_signal_state, 'TOKEN_ACTIVITY_CANDIDATE');
  assert.equal(sigHealthReady.signal_state, 'SIGNAL_READY_ADVISORY');
});

// a DEGRADED signal health built from empty intelligence
const wEmpty = evaluateWalletObservationIntelligence({ purpose: 'wallet_observation_input', wallet_ref: 'w-1', events: [], read_only: true });
const tEmpty = evaluateTokenObservationIntelligence({ purpose: 'token_observation_input', token_ref: 't-1', events: [], read_only: true });
const walletLedSuppressed = evaluateWalletLedCandidateSignal({
  purpose: 'wallet_led_signal_input', wallet_observation: wEmpty
});
const sigHealthDegraded = evaluateSignalHealth({
  signal_input_boundary: sigBoundaryValid,
  candidate_signals: [walletLedSuppressed],
  score: evaluateCandidateSignalScore({ purpose: 'candidate_signal_score_input', candidate_signals: [walletLedSuppressed] }),
  suppression: sigSuppNotSuppressed
});

const goodRiskBoundaryInput = {
  purpose: 'risk_input_boundary',
  signal_input_boundary: sigBoundaryValid,
  candidate_signal: walletLed,
  signal_score: sigScore,
  signal_suppression: sigSuppNotSuppressed,
  signal_health: sigHealthReady
};

// ---------------------------------------------------------------------------
// Shared assertion helpers
// ---------------------------------------------------------------------------

const EXEC_FLAGS = [
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'can_send', 'can_broadcast', 'can_serialize', 'signing_permitted',
  'broadcast_permitted', 'is_live', 'mainnet_enabled', 'real_live',
  'live_stream_enabled', 'network_call_made', 'endpoint_resolved'
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

// hostile proxies
function throwingProxy() {
  return new Proxy({}, { get() { throw new Error('hostile'); } });
}
function fnAccessorProxy() {
  return new Proxy({}, { get() { return () => 'fn'; } });
}

// ===========================================================================
// (C) RISK INPUT BOUNDARY
// ===========================================================================

test('(C) descriptor: shape, states, safe flags, no exec authority', () => {
  const d = describeRiskInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'risk-input-boundary');
  assert.equal(d.risk_input_boundary_valid, false);
  assert.equal(d.eligible_for_risk_evaluation, false);
  assert.deepEqual([...d.supported_states], [
    'RISK_INPUT_UNCONFIGURED', 'RISK_INPUT_INVALID', 'RISK_INPUT_DEGRADED', 'RISK_INPUT_VALID'
  ]);
});

test('(C) missing signal input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateRiskInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.risk_input_state, 'RISK_INPUT_UNCONFIGURED');
    assert.equal(r.eligible_for_risk_evaluation, false);
  }
  // an empty object is recognized-but-invalid (no valid purpose)
  const empty = evaluateRiskInputBoundary({});
  assertSafe(empty);
  assert.equal(empty.risk_input_state, 'RISK_INPUT_INVALID');
  assert.equal(empty.eligible_for_risk_evaluation, false);
});

test('(C) missing required component -> UNCONFIGURED', () => {
  const r = evaluateRiskInputBoundary({
    purpose: 'risk_input_boundary', signal_input_boundary: sigBoundaryValid
  });
  assertSafe(r);
  assert.equal(r.risk_input_state, 'RISK_INPUT_UNCONFIGURED');
});

test('(C) invalid signal health (BLOCKED) -> fail-closed INVALID', () => {
  const blockedHealth = evaluateSignalHealth({
    signal_input_boundary: sigBoundaryValid,
    candidate_signals: [{ ...walletLed, buy_opportunity: true }],
    score: sigScore, suppression: sigSuppNotSuppressed
  });
  assert.equal(blockedHealth.signal_state, 'SIGNAL_BLOCKED');
  const r = evaluateRiskInputBoundary({
    purpose: 'risk_input_boundary',
    signal_input_boundary: sigBoundaryValid,
    candidate_signal: walletLed,
    signal_health: blockedHealth
  });
  assertSafe(r);
  assert.equal(r.risk_input_state, 'RISK_INPUT_INVALID');
  assert.equal(r.valid, false);
});

test('(C) valid advisory signal -> boundary VALID, eligible only (no exec authority)', () => {
  const r = evaluateRiskInputBoundary(goodRiskBoundaryInput);
  assertSafe(r);
  assert.equal(r.risk_input_state, 'RISK_INPUT_VALID');
  assert.equal(r.risk_input_boundary_valid, true);
  assert.equal(r.eligible_for_risk_evaluation, true);
  // eligibility is NOT readiness
  assert.equal(r.risk_ready, false);
  assert.equal(r.intent_ready, false);
});

test('(C) degraded signal health -> DEGRADED, not eligible', () => {
  const r = evaluateRiskInputBoundary({
    purpose: 'risk_input_boundary',
    signal_input_boundary: sigBoundaryValid,
    candidate_signal: walletLed,
    signal_health: sigHealthDegraded
  });
  assertSafe(r);
  assert.equal(r.risk_input_state, 'RISK_INPUT_DEGRADED');
  assert.equal(r.eligible_for_risk_evaluation, false);
});

test('(C) raw ingestion event passed directly -> refused', () => {
  const rawEvent = mk('swap_observed', 'e1', 'w-1', 't-1');
  const r = evaluateRiskInputBoundary({
    purpose: 'risk_input_boundary',
    signal_input_boundary: sigBoundaryValid,
    candidate_signal: rawEvent,
    signal_health: sigHealthReady
  });
  assertSafe(r);
  assert.equal(r.risk_input_state, 'RISK_INPUT_INVALID');
  assert.equal(r.reasons.includes('raw_signal_input_refused'), true);
});

test('(C) raw Stage-5 intelligence passed directly -> refused', () => {
  const r = evaluateRiskInputBoundary({
    purpose: 'risk_input_boundary',
    signal_input_boundary: sigBoundaryValid,
    candidate_signal: wOk, // Stage-5 intelligence, not a Stage-6 signal
    signal_health: sigHealthReady
  });
  assertSafe(r);
  assert.equal(r.risk_input_state, 'RISK_INPUT_INVALID');
  assert.equal(r.reasons.includes('raw_signal_input_refused'), true);
});

test('(C) smuggled intent/route/trading flags -> refused INVALID', () => {
  for (const smuggle of [{ intent_ready: true }, { routing_ready: true }, { trading_ready: true }, { can_send: true }]) {
    const r = evaluateRiskInputBoundary({ ...goodRiskBoundaryInput, ...smuggle });
    assertSafe(r);
    assert.equal(r.risk_input_state, 'RISK_INPUT_INVALID');
  }
});

test('(C) smuggled execution/intent/route command keys -> refused INVALID', () => {
  for (const key of ['buy', 'execute', 'open_intent', 'create_intent', 'route', 'plan_route', 'buy_opportunity']) {
    const r = evaluateRiskInputBoundary({ ...goodRiskBoundaryInput, [key]: true });
    assertSafe(r);
    assert.equal(r.risk_input_state, 'RISK_INPUT_INVALID');
  }
});

test('(C) endpoint / API key / secret / token -> refused and never echoed', () => {
  const cases = [
    { api_key: 'sk-SECRET12345' },
    { auth_token: 'tok-SECRET98765' },
    { rpc_endpoint: 'https://mainnet.example.com/SECRETPATH' },
    { ws: 'wss://SECRETHOST/feed' }
  ];
  for (const c of cases) {
    const r = evaluateRiskInputBoundary({ ...goodRiskBoundaryInput, ...c });
    assertSafe(r);
    assert.equal(r.risk_input_state, 'RISK_INPUT_INVALID');
    for (const v of Object.values(c)) assertNoSecretEcho(r, v);
  }
});

test('(C) mainnet / REAL-LIVE markers -> refused', () => {
  for (const c of [{ network: 'mainnet-beta' }, { env: 'prod' }, { mainnet_enabled: true }, { real_live: true }]) {
    const r = evaluateRiskInputBoundary({ ...goodRiskBoundaryInput, ...c });
    assertSafe(r);
    assert.equal(r.risk_input_state, 'RISK_INPUT_INVALID');
  }
});

test('(C) hostile input -> frozen, no throw, UNCONFIGURED', () => {
  for (const h of [throwingProxy(), fnAccessorProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateRiskInputBoundary(h); });
    assertSafe(r);
    assert.equal(r.risk_input_state, 'RISK_INPUT_UNCONFIGURED');
  }
});

// ===========================================================================
// (D) HARD RISK GATE
// ===========================================================================

test('(D) descriptor: shape, states, reason allowlist, safe flags', () => {
  const d = describeHardRiskGateContract();
  assertSafe(d);
  assert.equal(d.contract, 'hard-risk-gate');
  assert.equal(d.risk_blocked, false);
  assert.equal(d.risk_passed_advisory, false);
  assert.deepEqual([...d.supported_states], [
    'HARD_RISK_UNCONFIGURED', 'HARD_RISK_INVALID', 'HARD_RISK_DEGRADED',
    'HARD_RISK_BLOCKED', 'HARD_RISK_PASS_ADVISORY'
  ]);
});

test('(D) missing input -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, [], 7]) {
    const r = evaluateHardRiskGate(inp);
    assertSafe(r);
    assert.equal(r.hard_risk_state, 'HARD_RISK_UNCONFIGURED');
  }
  // an empty object is recognized-but-invalid (no valid purpose)
  const empty = evaluateHardRiskGate({});
  assertSafe(empty);
  assert.equal(empty.hard_risk_state, 'HARD_RISK_INVALID');
});

test('(D) no / empty risk factors -> DEGRADED unknown (not pass)', () => {
  for (const rf of [undefined, {}, null]) {
    const inp = { purpose: 'hard_risk_input' };
    if (rf !== undefined) inp.risk_factors = rf;
    const r = evaluateHardRiskGate(inp);
    assertSafe(r);
    assert.equal(r.hard_risk_state, 'HARD_RISK_DEGRADED');
    assert.equal(r.risk_passed_advisory, false);
    assert.deepEqual([...r.risk_reason_codes], ['risk_factors_unknown']);
  }
});

test('(D) clean factors -> advisory PASS only (no execution authority)', () => {
  const r = evaluateHardRiskGate({
    purpose: 'hard_risk_input',
    candidate_signal: walletLed,
    risk_input_boundary: evaluateRiskInputBoundary(goodRiskBoundaryInput),
    risk_factors: {
      honeypot_indicator: false, freeze_authority_indicator: false,
      mint_authority_indicator: false, owner_concentration_indicator: false,
      blacklist_indicator: false, unknown_token_metadata: false
    }
  });
  assertSafe(r);
  assert.equal(r.hard_risk_state, 'HARD_RISK_PASS_ADVISORY');
  assert.equal(r.risk_passed_advisory, true);
  assert.equal(r.risk_blocked, false);
  assert.deepEqual([...r.risk_reason_codes], ['clean_factors_advisory']);
  // pass opens NO intent/trading/send
  assert.equal(r.intent_ready, false);
  assert.equal(r.trading_ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.risk_ready, false);
});

test('(D) honeypot / freeze / mint / owner-concentration / blacklist -> BLOCKED', () => {
  const cases = [
    ['honeypot_indicator', 'honeypot_indicator'],
    ['freeze_authority_indicator', 'freeze_authority_active'],
    ['mint_authority_indicator', 'mint_authority_active'],
    ['owner_concentration_indicator', 'owner_concentration_high'],
    ['blacklist_indicator', 'blacklist_indicator']
  ];
  for (const [field, code] of cases) {
    const r = evaluateHardRiskGate({ purpose: 'hard_risk_input', risk_factors: { [field]: true } });
    assertSafe(r);
    assert.equal(r.hard_risk_state, 'HARD_RISK_BLOCKED');
    assert.equal(r.risk_blocked, true);
    assert.equal(r.risk_passed_advisory, false);
    assert.equal(r.risk_reason_codes.includes(code), true);
  }
});

test('(D) unknown metadata -> DEGRADED (not pass)', () => {
  const r = evaluateHardRiskGate({
    purpose: 'hard_risk_input',
    risk_factors: { honeypot_indicator: false, unknown_token_metadata: true }
  });
  assertSafe(r);
  assert.equal(r.hard_risk_state, 'HARD_RISK_DEGRADED');
  assert.equal(r.risk_passed_advisory, false);
  assert.deepEqual([...r.risk_reason_codes], ['unknown_token_metadata']);
});

test('(D) blocker wins even when unknown metadata also set', () => {
  const r = evaluateHardRiskGate({
    purpose: 'hard_risk_input',
    risk_factors: { honeypot_indicator: true, unknown_token_metadata: true }
  });
  assertSafe(r);
  assert.equal(r.hard_risk_state, 'HARD_RISK_BLOCKED');
});

test('(D) smuggled forbidden flag / exec cmd / secret / endpoint -> INVALID, no echo', () => {
  const cases = [
    { can_send: true },
    { execute: true },
    { api_key: 'sk-HARDSECRET' },
    { rpc: 'https://HARDENDPOINT/x' }
  ];
  for (const c of cases) {
    const r = evaluateHardRiskGate({ purpose: 'hard_risk_input', risk_factors: { honeypot_indicator: false }, ...c });
    assertSafe(r);
    assert.equal(r.hard_risk_state, 'HARD_RISK_INVALID');
    assert.equal(r.valid, false);
    for (const v of Object.values(c)) if (typeof v === 'string') assertNoSecretEcho(r, v);
  }
});

test('(D) hostile input -> frozen, no throw', () => {
  for (const h of [throwingProxy(), fnAccessorProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateHardRiskGate(h); });
    assertSafe(r);
    assert.equal(r.hard_risk_state, 'HARD_RISK_UNCONFIGURED');
  }
});

// ===========================================================================
// (E) LIQUIDITY / EXIT FEASIBILITY RISK
// ===========================================================================

test('(E) descriptor: shape, states, reason allowlist, safe flags', () => {
  const d = describeLiquidityExitRiskContract();
  assertSafe(d);
  assert.equal(d.contract, 'liquidity-exit-risk');
  assert.equal(d.exit_feasible_advisory, false);
  assert.deepEqual([...d.supported_states], [
    'LIQUIDITY_EXIT_UNCONFIGURED', 'LIQUIDITY_EXIT_INVALID', 'LIQUIDITY_EXIT_DEGRADED',
    'LIQUIDITY_EXIT_BLOCKED', 'LIQUIDITY_EXIT_PASS_ADVISORY'
  ]);
});

test('(E) missing input / missing bucket -> fail-closed UNCONFIGURED', () => {
  for (const inp of [undefined, null, { purpose: 'liquidity_exit_input' }]) {
    const r = evaluateLiquidityExitRisk(inp);
    assertSafe(r);
    assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_UNCONFIGURED');
  }
  // an empty object is recognized-but-invalid (no valid purpose)
  const empty = evaluateLiquidityExitRisk({});
  assertSafe(empty);
  assert.equal(empty.liquidity_exit_state, 'LIQUIDITY_EXIT_INVALID');
});

test('(E) invalid bucket enum value -> INVALID', () => {
  const r = evaluateLiquidityExitRisk({
    purpose: 'liquidity_exit_input',
    liquidity_observed_bucket: 'gigantic', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low'
  });
  assertSafe(r);
  assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_INVALID');
});

test('(E) unknown liquidity -> DEGRADED', () => {
  const r = evaluateLiquidityExitRisk({
    purpose: 'liquidity_exit_input',
    liquidity_observed_bucket: 'unknown', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low'
  });
  assertSafe(r);
  assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_DEGRADED');
  assert.equal(r.exit_feasible_advisory, false);
  assert.equal(r.risk_reason_codes.includes('liquidity_unknown'), true);
});

test('(E) thin liquidity -> BLOCKED', () => {
  const r = evaluateLiquidityExitRisk({
    purpose: 'liquidity_exit_input',
    liquidity_observed_bucket: 'thin', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low'
  });
  assertSafe(r);
  assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_BLOCKED');
  assert.equal(r.risk_blocked, true);
  assert.equal(r.risk_reason_codes.includes('liquidity_thin'), true);
});

test('(E) poor exit -> BLOCKED', () => {
  const r = evaluateLiquidityExitRisk({
    purpose: 'liquidity_exit_input',
    liquidity_observed_bucket: 'deep', exit_feasibility_bucket: 'poor', slippage_risk_bucket: 'low'
  });
  assertSafe(r);
  assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_BLOCKED');
  assert.equal(r.risk_reason_codes.includes('exit_feasibility_poor'), true);
});

test('(E) high slippage -> BLOCKED', () => {
  const r = evaluateLiquidityExitRisk({
    purpose: 'liquidity_exit_input',
    liquidity_observed_bucket: 'deep', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'high'
  });
  assertSafe(r);
  assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_BLOCKED');
  assert.equal(r.risk_reason_codes.includes('slippage_high'), true);
});

test('(E) limited exit / medium slippage -> DEGRADED', () => {
  const r1 = evaluateLiquidityExitRisk({
    purpose: 'liquidity_exit_input',
    liquidity_observed_bucket: 'adequate', exit_feasibility_bucket: 'limited', slippage_risk_bucket: 'low'
  });
  assert.equal(r1.liquidity_exit_state, 'LIQUIDITY_EXIT_DEGRADED');
  const r2 = evaluateLiquidityExitRisk({
    purpose: 'liquidity_exit_input',
    liquidity_observed_bucket: 'adequate', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'medium'
  });
  assertSafe(r2);
  assert.equal(r2.liquidity_exit_state, 'LIQUIDITY_EXIT_DEGRADED');
  assert.equal(r2.exit_feasible_advisory, false);
});

test('(E) adequate/deep + feasible + low slippage -> advisory PASS only', () => {
  for (const liq of ['adequate', 'deep']) {
    const r = evaluateLiquidityExitRisk({
      purpose: 'liquidity_exit_input',
      liquidity_observed_bucket: liq, exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low'
    });
    assertSafe(r);
    assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_PASS_ADVISORY');
    assert.equal(r.exit_feasible_advisory, true);
    assert.equal(r.risk_blocked, false);
    assert.deepEqual([...r.risk_reason_codes], ['liquidity_exit_feasible_advisory']);
    // advisory pass opens NO route / intent
    assert.equal(r.routing_ready, false);
    assert.equal(r.intent_ready, false);
    assert.equal(r.risk_ready, false);
    assert.equal(r.can_send, false);
  }
});

test('(E) no quote/route/order field in any output', () => {
  const outputs = [
    evaluateLiquidityExitRisk({ purpose: 'liquidity_exit_input', liquidity_observed_bucket: 'deep', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low' }),
    evaluateLiquidityExitRisk({ purpose: 'liquidity_exit_input', liquidity_observed_bucket: 'thin', exit_feasibility_bucket: 'poor', slippage_risk_bucket: 'high' }),
    describeLiquidityExitRiskContract()
  ];
  const FORBIDDEN_FIELD_RE = /quote|route|order|jupiter/i;
  for (const o of outputs) {
    for (const k of Object.keys(o)) {
      assert.equal(FORBIDDEN_FIELD_RE.test(k), false, `forbidden output field key: ${k}`);
    }
  }
});

test('(E) smuggled forbidden flag / exec cmd / secret / endpoint -> INVALID, no echo', () => {
  const cases = [
    { can_send: true },
    { swap: true },
    { secret: 'sk-LIQSECRET' },
    { ws: 'wss://LIQENDPOINT/x' },
    { network: 'mainnet-beta-cluster' }
  ];
  for (const c of cases) {
    const r = evaluateLiquidityExitRisk({
      purpose: 'liquidity_exit_input',
      liquidity_observed_bucket: 'deep', exit_feasibility_bucket: 'feasible', slippage_risk_bucket: 'low',
      ...c
    });
    assertSafe(r);
    assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_INVALID');
    // never echo the smuggled VALUE (the unique non-substring portion)
    for (const v of Object.values(c)) {
      if (typeof v === 'string') {
        assertNoSecretEcho(r, 'LIQSECRET');
        assertNoSecretEcho(r, 'LIQENDPOINT');
        assertNoSecretEcho(r, 'beta-cluster');
      }
    }
  }
});

test('(E) hostile input -> frozen, no throw', () => {
  for (const h of [throwingProxy(), fnAccessorProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateLiquidityExitRisk(h); });
    assertSafe(r);
    assert.equal(r.liquidity_exit_state, 'LIQUIDITY_EXIT_UNCONFIGURED');
  }
});

// ===========================================================================
// STATIC SOURCE GUARD
// ===========================================================================

test('static guard: src has no "can_send: true" literal and is import-free', () => {
  const files = [
    '../src/risk-engine-foundations.mjs',
    '../src/index.mjs'
  ].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    // import-free: no import/require statements in the implementation .mjs
    if (f.endsWith('risk-engine-foundations.mjs')) {
      assert.equal(/^\s*import\s/m.test(src), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(src), false, 'implementation must not use require(');
    }
  }
});
