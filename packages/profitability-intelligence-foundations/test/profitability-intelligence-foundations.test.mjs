// Tests for @soltrade/profitability-intelligence-foundations (Stage-16 / Phase B).
// Builds the REAL Stage-14 + Stage-15 chain (real fills -> paper P&L; real
// dataset + fills -> backtest replay), hand-computes the per-wallet
// profitability numbers, proves the evidence gating + veto ordering + TOCTOU
// snapshot + fail-closed / no-leak / always-suppressed / flags-false spine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeProfitabilityInputBoundaryContract,
  evaluateProfitabilityInputBoundary,
  describeWalletProfitabilityContract,
  evaluateWalletProfitability,
  describeProfitabilityRiskFlagsContract,
  evaluateProfitabilityRiskFlags,
  describeCopyabilityAdvisoryContract,
  evaluateCopyabilityAdvisory,
  describeProfitabilitySuppressionContract,
  evaluateProfitabilitySuppression,
  describeProfitabilityForbiddenSurfaceContract,
  evaluateProfitabilityForbiddenSurface,
  describeProfitabilityHealthContract,
  evaluateProfitabilityHealth
} from '../src/index.mjs';

import {
  evaluateCandidatePaperFill,
  evaluatePaperPnlReadModel
} from '../../paper-execution-foundations/src/index.mjs';
import {
  evaluateBacktestReplay,
  evaluateCalibrationDivergence
} from '../../calibration-backtest-foundations/src/index.mjs';
import { evaluateSendPreflight } from '../../send-gate-contract/src/send-gate-contract.mjs';

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

const near = (a, b) => Math.abs(a - b) < 1e-9;

const hostiles = () => {
  const throwing = new Proxy({}, { get() { throw new Error('hostile'); } });
  const fnReturning = new Proxy({}, { get() { return () => true; } });
  return [throwing, fnReturning];
};

function collectKeys(o, acc = new Set()) {
  if (o == null || typeof o !== 'object') return acc;
  if (Array.isArray(o)) { for (const v of o) collectKeys(v, acc); return acc; }
  for (const [k, v] of Object.entries(o)) { acc.add(k); collectKeys(v, acc); }
  return acc;
}

// ---------------------------------------------------------------------------
// REAL Stage-14 + Stage-15 chain
// ---------------------------------------------------------------------------

const mkFill = (o) => evaluateCandidatePaperFill({ purpose: 'candidate_paper_fill_input', ...o });

const realPaperFills = [
  mkFill({ position_ref: 'P0', wallet_ref: 'w-A', side: 'buy', quantity: 2, price: 10, fee: 0.1, slippage: 0.1 }),
  mkFill({ position_ref: 'P0', wallet_ref: 'w-A', side: 'sell', quantity: 2, price: 12, fee: 0.1, slippage: 0.1 })
];
const realPaperPnl = evaluatePaperPnlReadModel({ purpose: 'paper_pnl_input', paper_fills: realPaperFills });

const rec = (ref, rank, wallet) => ({ record_ref: ref, as_of_rank: rank, wallet_ref: wallet });

const replayDataset = () => ({
  records: [rec('r1', 1, 'w-A'), rec('r2', 2, 'w-B'), rec('r3', 3, 'w-C'), rec('r4', 4, 'w-D')],
  cohort_wallets: [
    { wallet_ref: 'w-A', status_bucket: 'active' },
    { wallet_ref: 'w-B', status_bucket: 'active' },
    { wallet_ref: 'w-C', status_bucket: 'active' },
    { wallet_ref: 'w-D', status_bucket: 'active' }
  ]
});

// hand-computed per-wallet outcomes:
// w-A: P-A1 +2 win, P-A2 +3 win, P-A3 -2 loss -> gross 3, fees .6, slip .3, net 2.1; 2W 1L closed=3
// w-B: P-B1 +1 win, P-B2 +1 win, P-B3 -5 loss -> gross -3, fees .6, net -3.6; 2W 1L closed=3
// w-C: P-C1 +10 win, P-C2 -1 loss, P-C3 -1 loss -> gross 8, fees .6, net 7.4; 1W 2L (loss-dominant, net>0)
// w-D: P-D1 +5 win -> gross 5, fees .2, net 4.8; closed=1 (one-hit concentration)
const pair = (pos, wallet, buyPrice, sellPrice, fee, slippage = 0) => ([
  mkFill({ position_ref: pos, wallet_ref: wallet, side: 'buy', quantity: 1, price: buyPrice, fee, slippage }),
  mkFill({ position_ref: pos, wallet_ref: wallet, side: 'sell', quantity: 1, price: sellPrice, fee, slippage })
]);

const replayFills = () => ({
  r1: [...pair('P-A1', 'w-A', 10, 12, 0.1, 0.05), ...pair('P-A2', 'w-A', 10, 13, 0.1, 0.05), ...pair('P-A3', 'w-A', 10, 8, 0.1, 0.05)],
  r2: [...pair('P-B1', 'w-B', 10, 11, 0.1), ...pair('P-B2', 'w-B', 10, 11, 0.1), ...pair('P-B3', 'w-B', 10, 5, 0.1)],
  r3: [...pair('P-C1', 'w-C', 10, 20, 0.1), ...pair('P-C2', 'w-C', 10, 9, 0.1), ...pair('P-C3', 'w-C', 10, 9, 0.1)],
  r4: [...pair('P-D1', 'w-D', 10, 15, 0.1)]
});

const realReplay = evaluateBacktestReplay({
  purpose: 'backtest_replay_input', dataset: replayDataset(), paper_fills_by_record: replayFills()
});

test('preconditions: real Stage-14 + Stage-15 chain', () => {
  assert.equal(realPaperPnl.paper_pnl_state, 'PAPER_PNL_READ_MODEL');
  assert.equal(realReplay.backtest_replay_state, 'BACKTEST_REPLAY_READ_MODEL');
  assert.equal(realReplay.simulated, true);
  const wA = realReplay.candidate_pnl_by_wallet['w-A'];
  assert.equal(near(wA.gross, 3), true);
  assert.equal(wA.backtest_wins, 2);
  assert.equal(wA.backtest_losses, 1);
});

// ===========================================================================
// (A) PROFITABILITY INPUT BOUNDARY
// ===========================================================================

test('(A) descriptor: shape, states, safe flags', () => {
  const d = describeProfitabilityInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'profitability-input-boundary');
  assert.equal(d.eligible_for_profitability_intelligence, false);
  assert.deepEqual([...d.supported_states], [
    'PROFITABILITY_INPUT_UNCONFIGURED', 'PROFITABILITY_INPUT_INVALID',
    'PROFITABILITY_INPUT_DEGRADED', 'PROFITABILITY_INPUT_VALID'
  ]);
});

test('(A) missing input -> UNCONFIGURED; both real read-models -> VALID + eligible', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateProfitabilityInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.profitability_input_state, 'PROFITABILITY_INPUT_UNCONFIGURED');
    assert.equal(r.eligible_for_profitability_intelligence, false);
  }
  const missingReplay = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input', paper_pnl_read_model: realPaperPnl
  });
  assert.equal(missingReplay.profitability_input_state, 'PROFITABILITY_INPUT_UNCONFIGURED');

  const ok = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input',
    paper_pnl_read_model: realPaperPnl,
    backtest_replay: realReplay
  });
  assertSafe(ok);
  assert.equal(ok.profitability_input_state, 'PROFITABILITY_INPUT_VALID');
  assert.equal(ok.eligible_for_profitability_intelligence, true);
});

test('(A) raw earlier-stage results refused in either slot', () => {
  const rawPipeline = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input',
    paper_pnl_read_model: Object.freeze({ pipeline_decision_state: 'PIPELINE_DECISION_REVIEWED_ADVISORY', read_only: true }),
    backtest_replay: realReplay
  });
  assert.equal(rawPipeline.profitability_input_state, 'PROFITABILITY_INPUT_INVALID');
  assert.equal(rawPipeline.reasons.includes('raw_non_read_model_input_refused'), true);

  // a real Stage-15 DIVERGENCE result is NOT the replay read-model -> raw refused
  const divergence = evaluateCalibrationDivergence({
    purpose: 'divergence_input', calibration_records: [], divergence_bands: {}
  });
  const rawDiv = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input', paper_pnl_read_model: realPaperPnl, backtest_replay: divergence
  });
  assert.equal(rawDiv.profitability_input_state, 'PROFITABILITY_INPUT_INVALID');
  assert.equal(rawDiv.reasons.includes('raw_non_read_model_input_refused'), true);

  const unrecognized = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input', paper_pnl_read_model: realPaperPnl,
    backtest_replay: { read_only: true, some_other_state: 'X' }
  });
  assert.equal(unrecognized.profitability_input_state, 'PROFITABILITY_INPUT_INVALID');
  assert.equal(unrecognized.reasons.includes('unrecognized_backtest_replay'), true);
});

test('(A) recognized but non-READ_MODEL -> DEGRADED; smuggle + hostile fail-closed', () => {
  const unconfPaper = evaluatePaperPnlReadModel(undefined);
  const degPaper = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input', paper_pnl_read_model: unconfPaper, backtest_replay: realReplay
  });
  assert.equal(degPaper.profitability_input_state, 'PROFITABILITY_INPUT_DEGRADED');
  assert.equal(degPaper.reasons.includes('paper_pnl_not_read_model'), true);
  assert.equal(degPaper.eligible_for_profitability_intelligence, false);

  const unconfReplay = evaluateBacktestReplay(undefined);
  const degReplay = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input', paper_pnl_read_model: realPaperPnl, backtest_replay: unconfReplay
  });
  assert.equal(degReplay.profitability_input_state, 'PROFITABILITY_INPUT_DEGRADED');
  assert.equal(degReplay.reasons.includes('backtest_replay_not_read_model'), true);

  const smug = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input', paper_pnl_read_model: realPaperPnl,
    backtest_replay: realReplay, can_send: true
  });
  assert.equal(smug.profitability_input_state, 'PROFITABILITY_INPUT_INVALID');

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateProfitabilityInputBoundary(h); });
    assert.equal(r.profitability_input_state, 'PROFITABILITY_INPUT_UNCONFIGURED');
  }
});

// ===========================================================================
// (B) WALLET PROFITABILITY — hand-computed numbers + evidence gating
// ===========================================================================

test('(B) descriptor: shape, states, safe flags, simulated', () => {
  const d = describeWalletProfitabilityContract();
  assertSafe(d);
  assert.equal(d.contract, 'wallet-profitability-read-model');
  assert.equal(d.simulated, true);
  assert.deepEqual([...d.supported_evidence_tokens], ['SUFFICIENT', 'INSUFFICIENT_EVIDENCE']);
});

test('(B) hand-computed per-wallet profitability (2 wins 1 loss -> win_rate 2/3 exact, win_loss_ratio 2)', () => {
  const r = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input', backtest_replay: realReplay, min_sample_size: 3
  });
  assertSafe(r);
  assert.equal(r.profitability_state, 'PROFITABILITY_READ_MODEL');
  assert.equal(r.simulated, true);
  assert.equal(r.profitability_min_sample_size_valid, true);

  const wA = r.profitability_by_wallet['w-A'];
  assert.equal(Object.isFrozen(wA), true);
  assert.equal(wA.simulated, true);
  assert.equal(near(wA.profitability_gross, 3), true, `gross ${wA.profitability_gross}`);
  assert.equal(near(wA.profitability_fees, 0.6), true);
  assert.equal(near(wA.profitability_slippage, 0.3), true);
  assert.equal(near(wA.profitability_net, 2.1), true, `net ${wA.profitability_net}`);
  assert.equal(wA.profitability_wins, 2);
  assert.equal(wA.profitability_losses, 1);
  assert.equal(wA.profitability_flats, 0);
  assert.equal(wA.profitability_open, 0);
  assert.equal(wA.profitability_closed_count, 3);
  assert.equal(wA.profitability_win_rate, 2 / 3); // exact
  assert.equal(wA.profitability_win_loss_ratio, 2); // exact
  assert.equal(wA.profitability_profit_factor, null); // counts are NOT a money-weighted profit factor
  assert.equal(wA.profitability_evidence, 'SUFFICIENT'); // closed 3 >= 3

  const wB = r.profitability_by_wallet['w-B'];
  assert.equal(near(wB.profitability_net, -3.6), true, `net ${wB.profitability_net}`);
  assert.equal(wB.profitability_win_rate, 2 / 3);

  const wC = r.profitability_by_wallet['w-C'];
  assert.equal(near(wC.profitability_net, 7.4), true);
  assert.equal(wC.profitability_win_loss_ratio, 0.5);

  const wD = r.profitability_by_wallet['w-D'];
  assert.equal(near(wD.profitability_net, 4.8), true);
  assert.equal(wD.profitability_closed_count, 1);
  assert.equal(wD.profitability_win_rate, 1);
  assert.equal(wD.profitability_win_loss_ratio, null); // losses == 0
  assert.equal(wD.profitability_evidence, 'INSUFFICIENT_EVIDENCE'); // closed 1 < 3
});

test('(B) win_rate null when closed == 0 (open-only wallet)', () => {
  const openOnly = evaluateBacktestReplay({
    purpose: 'backtest_replay_input',
    dataset: { records: [rec('r1', 1, 'w-O')], cohort_wallets: [{ wallet_ref: 'w-O', status_bucket: 'active' }] },
    paper_fills_by_record: { r1: [mkFill({ position_ref: 'PO', wallet_ref: 'w-O', side: 'buy', quantity: 1, price: 10, fee: 0.1 })] }
  });
  const r = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input', backtest_replay: openOnly, min_sample_size: 0
  });
  const wO = r.profitability_by_wallet['w-O'];
  assert.equal(wO.profitability_closed_count, 0);
  assert.equal(wO.profitability_win_rate, null);
  assert.equal(wO.profitability_open, 1);
  assert.equal(wO.profitability_evidence, 'SUFFICIENT'); // 0 >= 0 with explicit min 0
});

test('(B) evidence gating: missing/invalid min_sample_size -> INSUFFICIENT_EVIDENCE always (never defaulted)', () => {
  for (const min of [undefined, null, 'three', NaN, Infinity, -1, {}]) {
    const r = evaluateWalletProfitability({
      purpose: 'wallet_profitability_input', backtest_replay: realReplay, min_sample_size: min
    });
    assertSafe(r);
    assert.equal(r.profitability_state, 'PROFITABILITY_READ_MODEL');
    assert.equal(r.profitability_min_sample_size_valid, false);
    assert.equal(r.reasons.includes('min_sample_size_missing_or_invalid'), true);
    for (const ref of ['w-A', 'w-B', 'w-C', 'w-D']) {
      assert.equal(r.profitability_by_wallet[ref].profitability_evidence, 'INSUFFICIENT_EVIDENCE',
        `wallet ${ref} must be INSUFFICIENT with min_sample_size ${String(min)}`);
    }
  }
});

test('(B) raw/unrecognized/non-READ_MODEL replays refused; missing -> UNCONFIGURED', () => {
  const missing = evaluateWalletProfitability({ purpose: 'wallet_profitability_input', min_sample_size: 1 });
  assert.equal(missing.profitability_state, 'PROFITABILITY_UNCONFIGURED');

  const raw = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input',
    backtest_replay: Object.freeze({ send_review_state: 'X', read_only: true }),
    min_sample_size: 1
  });
  assert.equal(raw.profitability_state, 'PROFITABILITY_INVALID');
  assert.equal(raw.reasons.includes('raw_non_read_model_input_refused'), true);

  const unconf = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input', backtest_replay: evaluateBacktestReplay(undefined), min_sample_size: 1
  });
  assert.equal(unconf.profitability_state, 'PROFITABILITY_INVALID');
  assert.equal(unconf.reasons.includes('backtest_replay_not_read_model'), true);

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateWalletProfitability(h); });
    assert.equal(r.profitability_state, 'PROFITABILITY_UNCONFIGURED');
  }
});

test('(B) execution-shaped / forbidden-named buckets refuse the whole input (values never echoed)', () => {
  const mkReplayLike = (bucket) => Object.freeze({
    read_only: true, backtest_replay_state: 'BACKTEST_REPLAY_READ_MODEL',
    candidate_pnl_by_wallet: { 'w-X': bucket }
  });
  const base = {
    net: 1, gross: 1, fees: 0, slippage: 0,
    backtest_wins: 1, backtest_losses: 0, backtest_flats: 0, backtest_open: 0, simulated: true
  };
  const exec = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input',
    backtest_replay: mkReplayLike({ ...base, executed: true }), min_sample_size: 1
  });
  assert.equal(exec.profitability_state, 'PROFITABILITY_INVALID');

  const leak = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input',
    backtest_replay: mkReplayLike({ ...base, private_key: 'LEAK_PROF_B_KEYVAL' }), min_sample_size: 1
  });
  assert.equal(leak.profitability_state, 'PROFITABILITY_INVALID');
  assert.equal(JSON.stringify(leak).includes('LEAK_PROF_B_KEYVAL'), false);

  const malformed = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input',
    backtest_replay: mkReplayLike({ ...base, net: 'lots' }), min_sample_size: 1
  });
  assert.equal(malformed.profitability_state, 'PROFITABILITY_INVALID');
});

test('(B) TOCTOU regression: candidate_pnl_by_wallet + bucket fields are read EXACTLY ONCE', () => {
  const cleanMap = {
    'w-1': { net: 5, gross: 6, fees: 0.5, slippage: 0.5, backtest_wins: 2, backtest_losses: 1, backtest_flats: 0, backtest_open: 0, simulated: true }
  };
  const dirtyMap = {
    'w-dirty': { net: 999999, gross: 999999, fees: 0, slippage: 0, backtest_wins: 9, backtest_losses: 0, backtest_flats: 0, backtest_open: 0, executed: true }
  };
  let mapReads = 0;
  const hostileReplay = {
    read_only: true,
    backtest_replay_state: 'BACKTEST_REPLAY_READ_MODEL',
    simulated: true,
    get candidate_pnl_by_wallet() { mapReads += 1; return mapReads === 1 ? cleanMap : dirtyMap; }
  };
  const r = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input', backtest_replay: hostileReplay, min_sample_size: 1
  });
  assert.equal(mapReads, 1, 'candidate_pnl_by_wallet must be read exactly once (snapshot)');
  assert.equal(r.profitability_state, 'PROFITABILITY_READ_MODEL');
  assert.equal(Object.prototype.hasOwnProperty.call(r.profitability_by_wallet, 'w-dirty'), false);
  assert.equal(JSON.stringify(r).includes('w-dirty'), false);
  assert.equal(r.profitability_by_wallet['w-1'].profitability_net, 5);

  // a hostile getter on a BUCKET field likewise cannot serve clean-to-validate
  // and dirty-to-derive: each bucket is snapshotted once.
  let netReads = 0;
  const hostileBucket = {
    gross: 6, fees: 0.5, slippage: 0.5,
    backtest_wins: 2, backtest_losses: 1, backtest_flats: 0, backtest_open: 0, simulated: true,
    get net() { netReads += 1; return netReads === 1 ? 5 : 999999; }
  };
  const r2 = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input',
    backtest_replay: { read_only: true, backtest_replay_state: 'BACKTEST_REPLAY_READ_MODEL', candidate_pnl_by_wallet: { 'w-1': hostileBucket } },
    min_sample_size: 1
  });
  assert.equal(netReads, 1, 'bucket.net must be read exactly once (snapshot)');
  assert.equal(r2.profitability_by_wallet['w-1'].profitability_net, 5);
});

test('(B) purity/determinism', () => {
  const args = { purpose: 'wallet_profitability_input', backtest_replay: realReplay, min_sample_size: 3 };
  assert.deepEqual(
    JSON.parse(JSON.stringify(evaluateWalletProfitability(args))),
    JSON.parse(JSON.stringify(evaluateWalletProfitability(args)))
  );
});

// ===========================================================================
// (C) HEURISTIC RISK FLAGS
// ===========================================================================

const realWalletProfitability = evaluateWalletProfitability({
  purpose: 'wallet_profitability_input', backtest_replay: realReplay, min_sample_size: 1
});

test('(C) descriptor + flags computed from the real (B) result', () => {
  const d = describeProfitabilityRiskFlagsContract();
  assertSafe(d);
  assert.equal(d.contract, 'profitability-risk-flags');
  assert.equal(d.simulated, true);

  const r = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input',
    wallet_profitability: realWalletProfitability,
    heuristic_thresholds: { concentration_max_share: 0.5, min_closed_for_flags: 1 }
  });
  assertSafe(r);
  assert.equal(r.profitability_flags_state, 'PROFITABILITY_FLAGS_READ_MODEL');
  assert.equal(r.profitability_thresholds_evaluated, true);

  const fA = r.profitability_flags_by_wallet['w-A'];
  assert.equal(Object.isFrozen(fA), true);
  assert.equal(fA.profitability_thin_evidence_flag, false);
  assert.equal(fA.profitability_loss_dominant_flag, false); // 1 loss < 2 wins
  assert.equal(fA.profitability_single_position_concentration_flag, false);
  assert.equal(fA.profitability_flags_unevaluated, false);

  const fC = r.profitability_flags_by_wallet['w-C'];
  assert.equal(fC.profitability_loss_dominant_flag, true); // 2 losses > 1 win

  const fD = r.profitability_flags_by_wallet['w-D'];
  assert.equal(fD.profitability_single_position_concentration_flag, true); // closed == 1
  assert.equal(fD.profitability_loss_dominant_flag, false);
});

test('(C) thin-evidence flag tracks min_closed_for_flags and the (B) evidence token', () => {
  const r = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input',
    wallet_profitability: realWalletProfitability,
    heuristic_thresholds: { min_closed_for_flags: 4 }
  });
  for (const ref of ['w-A', 'w-B', 'w-C', 'w-D']) {
    assert.equal(r.profitability_flags_by_wallet[ref].profitability_thin_evidence_flag, true,
      `wallet ${ref} closed < 4 must be thin`);
  }

  // (B) computed with missing min_sample_size -> INSUFFICIENT everywhere ->
  // thin even when min_closed_for_flags passes.
  const insufficientB = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input', backtest_replay: realReplay
  });
  const r2 = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input', wallet_profitability: insufficientB,
    heuristic_thresholds: { min_closed_for_flags: 1 }
  });
  assert.equal(r2.profitability_flags_by_wallet['w-A'].profitability_thin_evidence_flag, true);
});

test('(C) missing thresholds -> unevaluated posture (flags cannot clear a wallet)', () => {
  for (const thresholds of [undefined, null, {}]) {
    const r = evaluateProfitabilityRiskFlags({
      purpose: 'risk_flags_input',
      wallet_profitability: realWalletProfitability,
      heuristic_thresholds: thresholds
    });
    assertSafe(r);
    assert.equal(r.profitability_flags_state, 'PROFITABILITY_FLAGS_READ_MODEL');
    assert.equal(r.profitability_thresholds_evaluated, false);
    assert.equal(r.reasons.includes('thresholds_missing_flags_unevaluated'), true);
    const fA = r.profitability_flags_by_wallet['w-A'];
    assert.equal(fA.profitability_flags_unevaluated, true);
    assert.equal(fA.profitability_thin_evidence_flag, true, 'unevaluated must NOT clear thin evidence');
  }
});

test('(C) present-but-malformed thresholds refused; raw/hostile fail-closed', () => {
  const badShare = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input', wallet_profitability: realWalletProfitability,
    heuristic_thresholds: { concentration_max_share: 2, min_closed_for_flags: 1 }
  });
  assert.equal(badShare.profitability_flags_state, 'PROFITABILITY_FLAGS_INVALID');
  assert.equal(badShare.reasons.includes('invalid_concentration_max_share'), true);

  const badMin = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input', wallet_profitability: realWalletProfitability,
    heuristic_thresholds: { min_closed_for_flags: 'one' }
  });
  assert.equal(badMin.profitability_flags_state, 'PROFITABILITY_FLAGS_INVALID');

  const missing = evaluateProfitabilityRiskFlags({ purpose: 'risk_flags_input' });
  assert.equal(missing.profitability_flags_state, 'PROFITABILITY_FLAGS_UNCONFIGURED');

  const raw = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input',
    wallet_profitability: Object.freeze({ signal_state: 'X', read_only: true }),
    heuristic_thresholds: { min_closed_for_flags: 1 }
  });
  assert.equal(raw.profitability_flags_state, 'PROFITABILITY_FLAGS_INVALID');

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateProfitabilityRiskFlags(h); });
    assert.equal(r.profitability_flags_state, 'PROFITABILITY_FLAGS_UNCONFIGURED');
  }
});

test('(C) TOCTOU regression: the (B) map + entry fields are read EXACTLY ONCE', () => {
  const cleanEntry = {
    profitability_net: 1, profitability_gross: 1.5, profitability_fees: 0.3, profitability_slippage: 0.2,
    profitability_wins: 2, profitability_losses: 1, profitability_flats: 0, profitability_open: 0,
    profitability_closed_count: 3, profitability_win_rate: 2 / 3, profitability_win_loss_ratio: 2,
    profitability_profit_factor: null, profitability_evidence: 'SUFFICIENT', simulated: true, advisory_only: true
  };
  const dirtyMap = { 'w-dirty': { ...cleanEntry, executed: true } };
  let mapReads = 0;
  const hostileWp = {
    read_only: true,
    profitability_state: 'PROFITABILITY_READ_MODEL',
    simulated: true,
    get profitability_by_wallet() { mapReads += 1; return mapReads === 1 ? { 'w-1': cleanEntry } : dirtyMap; }
  };
  const r = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input', wallet_profitability: hostileWp,
    heuristic_thresholds: { min_closed_for_flags: 1 }
  });
  assert.equal(mapReads, 1, 'profitability_by_wallet must be read exactly once (snapshot)');
  assert.equal(r.profitability_flags_state, 'PROFITABILITY_FLAGS_READ_MODEL');
  assert.equal(Object.prototype.hasOwnProperty.call(r.profitability_flags_by_wallet, 'w-dirty'), false);
  assert.equal(JSON.stringify(r).includes('w-dirty'), false);

  let lossReads = 0;
  const hostileEntry = {
    ...cleanEntry,
    get profitability_losses() { lossReads += 1; return lossReads === 1 ? 0 : 99; }
  };
  const r2 = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input',
    wallet_profitability: { read_only: true, profitability_state: 'PROFITABILITY_READ_MODEL', profitability_by_wallet: { 'w-1': hostileEntry } },
    heuristic_thresholds: { min_closed_for_flags: 1 }
  });
  assert.equal(lossReads, 1, 'entry.profitability_losses must be read exactly once (snapshot)');
  assert.equal(r2.profitability_flags_by_wallet['w-1'].profitability_loss_dominant_flag, false);
});

// ===========================================================================
// (D) COPYABILITY ADVISORY — veto ordering
// ===========================================================================

const realBoundary = evaluateProfitabilityInputBoundary({
  purpose: 'profitability_input', paper_pnl_read_model: realPaperPnl, backtest_replay: realReplay
});
const realRiskFlags = evaluateProfitabilityRiskFlags({
  purpose: 'risk_flags_input', wallet_profitability: realWalletProfitability,
  heuristic_thresholds: { concentration_max_share: 0.5, min_closed_for_flags: 1 }
});

test('(D) descriptor + full veto ordering over the real chain', () => {
  const d = describeCopyabilityAdvisoryContract();
  assertSafe(d);
  assert.equal(d.contract, 'copyability-advisory-composer');
  assert.equal(d.simulated, true);
  assert.deepEqual([...d.supported_advisory_tokens], [
    'PROFITABILITY_ADVISORY_INSUFFICIENT_EVIDENCE',
    'PROFITABILITY_ADVISORY_NOT_COPY_SUITABLE',
    'PROFITABILITY_ADVISORY_PREFER_WATCH_ONLY',
    'PROFITABILITY_ADVISORY_KEEP_EVALUATING'
  ]);

  const r = evaluateCopyabilityAdvisory({
    purpose: 'copyability_advisory_input',
    profitability_input_boundary: realBoundary,
    wallet_profitability: realWalletProfitability,
    profitability_risk_flags: realRiskFlags
  });
  assertSafe(r);
  assert.equal(r.copyability_advisory_state, 'COPYABILITY_ADVISORY_READ_MODEL');
  assert.equal(r.simulated, true);
  const adv = (w) => r.profitability_advisory_by_wallet[w].profitability_advisory;

  // w-A: positive net + clear flags + sufficient evidence -> KEEP_EVALUATING
  assert.equal(adv('w-A'), 'PROFITABILITY_ADVISORY_KEEP_EVALUATING');
  // w-B: clean flags but non-positive net -> PREFER_WATCH_ONLY
  assert.equal(adv('w-B'), 'PROFITABILITY_ADVISORY_PREFER_WATCH_ONLY');
  // w-C: POSITIVE net (+7.4) BUT loss-dominant -> risk flag VETOES -> NOT_COPY_SUITABLE
  assert.equal(adv('w-C'), 'PROFITABILITY_ADVISORY_NOT_COPY_SUITABLE');
  assert.equal(r.profitability_advisory_by_wallet['w-C'].profitability_advisory_reasons.includes('loss_dominant_veto'), true);
  // w-D: POSITIVE net (+4.8) BUT one-hit concentration -> NOT_COPY_SUITABLE
  assert.equal(adv('w-D'), 'PROFITABILITY_ADVISORY_NOT_COPY_SUITABLE');
  assert.equal(r.profitability_advisory_by_wallet['w-D'].profitability_advisory_reasons.includes('single_position_concentration_veto'), true);

  // no result entry is a promotion and every entry stays advisory + simulated
  for (const ref of ['w-A', 'w-B', 'w-C', 'w-D']) {
    const e = r.profitability_advisory_by_wallet[ref];
    assert.equal(Object.isFrozen(e), true);
    assert.equal(e.advisory_only, true);
    assert.equal(e.simulated, true);
  }
});

test('(D) insufficient evidence and unevaluated flags dominate everything', () => {
  // (B) without min_sample_size -> every wallet INSUFFICIENT
  const insufficientB = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input', backtest_replay: realReplay
  });
  const flagsOverInsufficient = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input', wallet_profitability: insufficientB,
    heuristic_thresholds: { min_closed_for_flags: 1 }
  });
  const r = evaluateCopyabilityAdvisory({
    purpose: 'copyability_advisory_input',
    profitability_input_boundary: realBoundary,
    wallet_profitability: insufficientB,
    profitability_risk_flags: flagsOverInsufficient
  });
  for (const ref of ['w-A', 'w-B', 'w-C', 'w-D']) {
    assert.equal(r.profitability_advisory_by_wallet[ref].profitability_advisory,
      'PROFITABILITY_ADVISORY_INSUFFICIENT_EVIDENCE', `wallet ${ref}`);
  }

  // unevaluated thresholds -> INSUFFICIENT even with sufficient (B) evidence
  const unevaluatedFlags = evaluateProfitabilityRiskFlags({
    purpose: 'risk_flags_input', wallet_profitability: realWalletProfitability
  });
  const r2 = evaluateCopyabilityAdvisory({
    purpose: 'copyability_advisory_input',
    profitability_input_boundary: realBoundary,
    wallet_profitability: realWalletProfitability,
    profitability_risk_flags: unevaluatedFlags
  });
  for (const ref of ['w-A', 'w-B', 'w-C', 'w-D']) {
    assert.equal(r2.profitability_advisory_by_wallet[ref].profitability_advisory,
      'PROFITABILITY_ADVISORY_INSUFFICIENT_EVIDENCE', `wallet ${ref} unevaluated flags`);
  }
});

test('(D) non-clean components refused; missing -> UNCONFIGURED; hostile fail-closed', () => {
  const degBoundary = evaluateProfitabilityInputBoundary({
    purpose: 'profitability_input', paper_pnl_read_model: evaluatePaperPnlReadModel(undefined), backtest_replay: realReplay
  });
  const notValid = evaluateCopyabilityAdvisory({
    purpose: 'copyability_advisory_input',
    profitability_input_boundary: degBoundary,
    wallet_profitability: realWalletProfitability,
    profitability_risk_flags: realRiskFlags
  });
  assert.equal(notValid.copyability_advisory_state, 'COPYABILITY_ADVISORY_INVALID');
  assert.equal(notValid.reasons.includes('profitability_input_not_valid'), true);

  const missing = evaluateCopyabilityAdvisory({
    purpose: 'copyability_advisory_input',
    profitability_input_boundary: realBoundary,
    wallet_profitability: realWalletProfitability
  });
  assert.equal(missing.copyability_advisory_state, 'COPYABILITY_ADVISORY_UNCONFIGURED');

  const smug = evaluateCopyabilityAdvisory({
    purpose: 'copyability_advisory_input',
    profitability_input_boundary: realBoundary,
    wallet_profitability: { ...realWalletProfitability, executed: true },
    profitability_risk_flags: realRiskFlags
  });
  assert.equal(smug.copyability_advisory_state, 'COPYABILITY_ADVISORY_INVALID');

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCopyabilityAdvisory(h); });
    assert.equal(r.copyability_advisory_state, 'COPYABILITY_ADVISORY_UNCONFIGURED');
  }
});

test('(D) NO instruction-shaped output keys anywhere (advisory is not a command)', () => {
  const r = evaluateCopyabilityAdvisory({
    purpose: 'copyability_advisory_input',
    profitability_input_boundary: realBoundary,
    wallet_profitability: realWalletProfitability,
    profitability_risk_flags: realRiskFlags
  });
  const allKeys = new Set();
  for (const res of [
    r, realBoundary, realWalletProfitability, realRiskFlags,
    describeCopyabilityAdvisoryContract(), describeWalletProfitabilityContract(),
    describeProfitabilityRiskFlagsContract(),
    evaluateProfitabilitySuppression({}), evaluateProfitabilityForbiddenSurface({ purpose: 'x' }),
    evaluateProfitabilityHealth({})
  ]) {
    collectKeys(res, allKeys);
  }
  for (const k of allKeys) {
    assert.equal(/follow|unfollow|\bban\b|ban_|_ban|disable|apply|execute/i.test(k), false,
      `instruction-shaped key emitted: ${k}`);
  }
});

// ===========================================================================
// (E) SUPPRESSION — always suppressed
// ===========================================================================

test('(E) ALWAYS suppressed with the three not_*_authorized on every path', () => {
  const d = describeProfitabilitySuppressionContract();
  assertSafe(d);
  for (const inp of [undefined, null, {}, hostiles()[0], hostiles()[1]]) {
    let s;
    assert.doesNotThrow(() => { s = evaluateProfitabilitySuppression(inp); });
    assertSafe(s);
    assert.equal(s.suppressed, true);
    for (const t of ['not_execution_authorized', 'not_sign_authorized', 'not_send_authorized']) {
      assert.equal(s.suppression_reasons.includes(t), true, `missing ${t}`);
    }
  }
});

test('(E) component-specific codes added when unclean', () => {
  const blockedSurface = evaluateProfitabilityForbiddenSurface({ endpoint: 'http://LEAK' });
  const s = evaluateProfitabilitySuppression({
    purpose: 'profitability_suppression_input',
    profitability_surface: blockedSurface
  });
  assert.equal(s.suppression_reasons.includes('live_surface_detected'), true);
  assert.equal(s.suppression_reasons.includes('profitability_input_not_valid'), true); // boundary missing

  const invalidWp = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input',
    backtest_replay: Object.freeze({ send_review_state: 'X', read_only: true }),
    min_sample_size: 1
  });
  const s2 = evaluateProfitabilitySuppression({
    purpose: 'profitability_suppression_input',
    profitability_input_boundary: realBoundary,
    wallet_profitability: invalidWp
  });
  assert.equal(s2.suppression_reasons.includes('wallet_profitability_invalid'), true);
  assert.equal(s2.suppression_reasons.includes('profitability_input_not_valid'), false);
});

// ===========================================================================
// (F) FORBIDDEN SURFACE GUARD — NAME-only redaction
// ===========================================================================

test('(F) clean / blocked / redaction / hostile', () => {
  const d = describeProfitabilityForbiddenSurfaceContract();
  assertSafe(d);
  const clean = evaluateProfitabilityForbiddenSurface({ purpose: 'x' });
  assertSafe(clean);
  assert.equal(clean.profitability_surface_state, 'PROFITABILITY_SURFACE_CLEAN');

  for (const name of ['private_key', 'seed', 'signature', 'endpoint', 'rpc_url', 'serialized_tx', 'message_bytes']) {
    const planted = `PLANTED_${name.toUpperCase()}_VAL`;
    const r = evaluateProfitabilityForbiddenSurface({ [name]: planted });
    assertSafe(r);
    assert.equal(r.profitability_surface_state, 'PROFITABILITY_SURFACE_BLOCKED');
    assert.equal(r.forbidden_field_ref, name);
    assert.equal(JSON.stringify(r).includes(planted), false, `${name} value must be redacted`);
  }
  const sigR = evaluateProfitabilityForbiddenSurface({ signature: 'S' });
  assert.equal(sigR.key_material_detected, true);
  const epR = evaluateProfitabilityForbiddenSurface({ endpoint: 'E' });
  assert.equal(epR.key_material_detected, false);
  assert.equal(epR.live_surface_detected, true);

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateProfitabilityForbiddenSurface(h); });
    assert.equal(r.profitability_surface_state, 'PROFITABILITY_SURFACE_UNCONFIGURED');
  }
});

// ===========================================================================
// (G) HEALTH
// ===========================================================================

const realAdvisory = evaluateCopyabilityAdvisory({
  purpose: 'copyability_advisory_input',
  profitability_input_boundary: realBoundary,
  wallet_profitability: realWalletProfitability,
  profitability_risk_flags: realRiskFlags
});
const cleanSurface = evaluateProfitabilityForbiddenSurface({ purpose: 'x' });
const cleanSuppression = evaluateProfitabilitySuppression({
  purpose: 'profitability_suppression_input',
  profitability_input_boundary: realBoundary,
  wallet_profitability: realWalletProfitability,
  profitability_risk_flags: realRiskFlags,
  copyability_advisory: realAdvisory,
  profitability_surface: cleanSurface
});

const goodHealthInput = (over = {}) => ({
  profitability_input_boundary: realBoundary,
  wallet_profitability: realWalletProfitability,
  profitability_risk_flags: realRiskFlags,
  copyability_advisory: realAdvisory,
  profitability_suppression: cleanSuppression,
  profitability_surface: cleanSurface,
  ...over
});

test('(G) clean path -> SUPPRESSED; explicit not-suppressed -> REVIEWED_ADVISORY (opens nothing)', () => {
  const d = describeProfitabilityHealthContract();
  assertSafe(d);
  assert.equal(cleanSuppression.suppressed, true);
  const sup = evaluateProfitabilityHealth(goodHealthInput());
  assertSafe(sup);
  assert.equal(sup.profitability_health_state, 'PROFITABILITY_HEALTH_SUPPRESSED');

  const notSuppressed = Object.freeze({ suppressed: false, suppression_reasons: [], read_only: true });
  const rev = evaluateProfitabilityHealth(goodHealthInput({ profitability_suppression: notSuppressed }));
  assertSafe(rev);
  assert.equal(rev.profitability_health_state, 'PROFITABILITY_HEALTH_REVIEWED_ADVISORY');
  assert.equal(rev.can_send, false);
  assert.equal(rev.signer_ready, false);
});

test('(G) blocked / missing / hostile', () => {
  const blockedSurface = evaluateProfitabilityForbiddenSurface({ private_key: 'LEAK_PROF_G' });
  const b = evaluateProfitabilityHealth(goodHealthInput({ profitability_surface: blockedSurface }));
  assert.equal(b.profitability_health_state, 'PROFITABILITY_HEALTH_BLOCKED');
  assert.equal(JSON.stringify(b).includes('LEAK_PROF_G'), false);

  const invalidWp = evaluateWalletProfitability({
    purpose: 'wallet_profitability_input',
    backtest_replay: Object.freeze({ send_review_state: 'X', read_only: true }),
    min_sample_size: 1
  });
  const b2 = evaluateProfitabilityHealth(goodHealthInput({ wallet_profitability: invalidWp }));
  assert.equal(b2.profitability_health_state, 'PROFITABILITY_HEALTH_BLOCKED');

  const m = evaluateProfitabilityHealth(goodHealthInput({ copyability_advisory: undefined }));
  assert.equal(m.profitability_health_state, 'PROFITABILITY_HEALTH_UNCONFIGURED');

  const smug = evaluateProfitabilityHealth(goodHealthInput({
    wallet_profitability: { ...realWalletProfitability, can_send: true }
  }));
  assert.equal(smug.profitability_health_state, 'PROFITABILITY_HEALTH_BLOCKED');

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateProfitabilityHealth(h); });
    assert.equal(r.profitability_health_state, 'PROFITABILITY_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// Integration consistency + static guards
// ===========================================================================

test('integration: send-gate still refuses beside profitability intelligence read-models', () => {
  const gate = evaluateSendPreflight({ profitability: realWalletProfitability, advisory: realAdvisory });
  assert.equal(gate.ok, false);
  assert.equal(gate.can_send, false);
  assert.equal(gate.can_broadcast, false);
});

test('static guards: import-free src, no exec-true literal, no clock/RNG/network, no module-level mutable state, candidate + deferred-name discipline', () => {
  const srcPath = fileURLToPath(new URL('../src/profitability-intelligence-foundations.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');

  // import-free
  assert.equal(/^import\s/m.test(src), false, 'src must be import-free');
  assert.equal(/require\s*\(/.test(src), false);

  // strip string literals + comments, then scan CODE only
  const code = src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

  assert.equal(/can_send\s*:\s*true/.test(code), false);
  assert.equal(/can_broadcast\s*:\s*true/.test(code), false);
  assert.equal(/broadcast_permitted\s*:\s*true/.test(code), false);
  assert.equal(/executed\s*:\s*true/.test(code), false);
  assert.equal(/Date\s*\.\s*now|new\s+Date\b/.test(code), false, 'no clock');
  assert.equal(/Math\s*\.\s*random/.test(code), false, 'no RNG');
  assert.equal(/fetch\s*\(|WebSocket|XMLHttpRequest|process\s*\.\s*env|readFileSync/.test(code), false, 'no network/env/fs');
  assert.equal(/^(let|var)\s/m.test(code), false, 'no module-level mutable state');

  // candidate_* discipline: ONLY candidate_pnl_by_wallet (G22) appears in CODE.
  const codeCandidates = [...new Set(code.match(/candidate_[a-z0-9_]+/g) || [])];
  for (const c of codeCandidates) {
    assert.equal(c, 'candidate_pnl_by_wallet', `unexpected candidate name in code: ${c}`);
  }
  assert.equal(codeCandidates.length >= 0, true);
  // ... and the whole src (incl. prose/strings) never names any OTHER candidate_*
  const srcCandidates = [...new Set(src.match(/candidate_[a-z0-9_]+/g) || [])];
  for (const c of srcCandidates) {
    assert.equal(c, 'candidate_pnl_by_wallet', `unexpected candidate name in src: ${c}`);
  }

  // deferred SSOT intelligence enum NAMES must not appear anywhere in src
  for (const name of [
    'candidate_wallet_type', 'candidate_fake_profit_reason',
    'candidate_adverse_selection_severity', 'candidate_adverse_selection_reason',
    'candidate_copyability_veto_reason', 'candidate_pump_classification',
    'candidate_wallet_drift_reason', 'candidate_wallet_drift_recommendation',
    'candidate_profit_source_type', 'candidate_profit_source_copyability_class'
  ]) {
    assert.equal(src.includes(name), false, `deferred SSOT name leaked into src: ${name}`);
  }

  // ... and their deferred enum VALUE strings must not be used as tokens
  for (const valueToken of [
    'smart_money_wallet', 'kol_wallet', 'bot_wallet', 'insider_wallet',
    'dev_creator_wallet', 'mev_sniper_wallet', 'copycat_wallet', 'linked_cluster_wallet',
    'self_trading', 'wash_trading', 'fake_volume',
    'risky_wallet_type', 'fake_profit_risk', 'adverse_selection_high',
    'crowd_follow_decay', 'profit_concentration_one_hit', 'non_copyable_profit_source',
    'insufficient_evidence', 'late_entry_after_leader', 'latency_drag',
    'natural_pump', 'win_rate_degraded', 'keep_following', 'reduce_size',
    'pause_follow', 'switch_to_watch_only', 'require_review',
    'early_entry', 'exit_timing', 'copyable', 'partially_copyable', 'non_copyable'
  ]) {
    const re = new RegExp(`['"\`]${valueToken}['"\`]`);
    assert.equal(re.test(src), false, `deferred enum value string used as token: ${valueToken}`);
  }
});
