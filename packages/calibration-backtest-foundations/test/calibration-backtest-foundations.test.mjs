// Tests for @soltrade/calibration-backtest-foundations (Stage-15 / Phase B).
// Builds REAL Stage-14 paper P&L inputs (via paper-execution-foundations),
// hand-computes divergence + replay numbers, cross-checks the finality rule
// against the existing packages/foundations CalibrationStore skeleton, and
// proves the fail-closed / no-leak / always-suppressed / flags-false spine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeCalibrationInputBoundaryContract,
  evaluateCalibrationInputBoundary,
  describeCalibrationDivergenceContract,
  evaluateCalibrationDivergence,
  describeBacktestDatasetDescriptorContract,
  evaluateBacktestDatasetDescriptor,
  describeBacktestReplayContract,
  evaluateBacktestReplay,
  describeCalibrationSuppressionContract,
  evaluateCalibrationSuppression,
  describeCalibrationForbiddenSurfaceContract,
  evaluateCalibrationForbiddenSurface,
  describeCalibrationHealthContract,
  evaluateCalibrationHealth
} from '../src/index.mjs';

import {
  evaluateCandidatePaperFill,
  evaluatePaperPnlReadModel
} from '../../paper-execution-foundations/src/index.mjs';
import { createCalibrationStore } from '../../foundations/src/index.mjs';
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

// ---------------------------------------------------------------------------
// REAL Stage-14 inputs
// ---------------------------------------------------------------------------

const mkFill = (o) => evaluateCandidatePaperFill({ purpose: 'candidate_paper_fill_input', ...o });

const realFills = [
  mkFill({ position_ref: 'P1', wallet_ref: 'w-1', side: 'buy', quantity: 2, price: 10, fee: 0.1, slippage: 0.1 }),
  mkFill({ position_ref: 'P1', wallet_ref: 'w-1', side: 'sell', quantity: 2, price: 12, fee: 0.1, slippage: 0.1 })
];
const realPaperPnl = evaluatePaperPnlReadModel({ purpose: 'paper_pnl_input', paper_fills: realFills });

test('preconditions: real Stage-14 paper P&L read-model', () => {
  assert.equal(realPaperPnl.paper_pnl_state, 'PAPER_PNL_READ_MODEL');
  assert.equal(realPaperPnl.simulated, true);
});

// CalibrationRecord builders (ARCHITECTURE §9 internal field names, consumed-only)
const finRec = (over = {}) => ({
  trade_id: 't-1', brain: 'brain_a', signal_bucket: 's', wallet_cluster: 'c',
  token_risk_bucket: 'low',
  simulated_fill_price: 100, real_fill_price: 100,
  simulated_slippage: 0.01, real_slippage: 0.01,
  simulated_exit: true, real_exit: true,
  failed_attempts_count: 0, rpc_latency_ms: 50, route_failure_flag: false,
  ordering_confidence: 0.9,
  timestamp_processed: 'tp', timestamp_confirmed: 'tc',
  ...over
});

// ===========================================================================
// (A) CALIBRATION INPUT BOUNDARY
// ===========================================================================

test('(A) descriptor: shape, states, safe flags', () => {
  const d = describeCalibrationInputBoundaryContract();
  assertSafe(d);
  assert.equal(d.contract, 'calibration-input-boundary');
  assert.equal(d.eligible_for_calibration, false);
  assert.deepEqual([...d.supported_states], [
    'CALIB_INPUT_UNCONFIGURED', 'CALIB_INPUT_INVALID',
    'CALIB_INPUT_DEGRADED', 'CALIB_INPUT_VALID'
  ]);
});

test('(A) missing input -> UNCONFIGURED; real read-model + records -> VALID', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateCalibrationInputBoundary(inp);
    assertSafe(r);
    assert.equal(r.calib_input_state, 'CALIB_INPUT_UNCONFIGURED');
  }
  const ok = evaluateCalibrationInputBoundary({
    purpose: 'calibration_input',
    paper_pnl_read_model: realPaperPnl,
    calibration_records: [finRec()]
  });
  assertSafe(ok);
  assert.equal(ok.calib_input_state, 'CALIB_INPUT_VALID');
  assert.equal(ok.eligible_for_calibration, true);
});

test('(A) raw earlier-stage results refused; bad records refused', () => {
  const raw = evaluateCalibrationInputBoundary({
    purpose: 'calibration_input',
    paper_pnl_read_model: Object.freeze({ pipeline_decision_state: 'PIPELINE_DECISION_REVIEWED_ADVISORY', read_only: true }),
    calibration_records: []
  });
  assert.equal(raw.calib_input_state, 'CALIB_INPUT_INVALID');
  assert.equal(raw.reasons.includes('raw_non_paper_pnl_input_refused'), true);

  const badRec = evaluateCalibrationInputBoundary({
    purpose: 'calibration_input',
    paper_pnl_read_model: realPaperPnl,
    calibration_records: [{ ...finRec(), trade_id: '' }]
  });
  assert.equal(badRec.calib_input_state, 'CALIB_INPUT_INVALID');

  const invModel = evaluatePaperPnlReadModel(undefined); // UNCONFIGURED model
  const deg = evaluateCalibrationInputBoundary({
    purpose: 'calibration_input',
    paper_pnl_read_model: invModel,
    calibration_records: []
  });
  assert.equal(deg.calib_input_state, 'CALIB_INPUT_DEGRADED');
});

test('(A) smuggle + hostile -> fail-closed, never throws', () => {
  const smug = evaluateCalibrationInputBoundary({
    purpose: 'calibration_input', paper_pnl_read_model: realPaperPnl,
    calibration_records: [], can_send: true
  });
  assert.equal(smug.calib_input_state, 'CALIB_INPUT_INVALID');
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCalibrationInputBoundary(h); });
    assert.equal(r.calib_input_state, 'CALIB_INPUT_UNCONFIGURED');
  }
});

// ===========================================================================
// (B) CALIBRATION DIVERGENCE — hand-computed numbers
// ===========================================================================

test('(B) descriptor: shape, states, safe flags, simulated', () => {
  const d = describeCalibrationDivergenceContract();
  assertSafe(d);
  assert.equal(d.contract, 'calibration-divergence-read-model');
  assert.equal(d.simulated, true);
});

test('(B) hand-computed fill divergence + band classification', () => {
  // pairs (100,102),(100,98),(100,100) -> mean(|d|/real) = (2/102 + 2/98 + 0)/3
  const expected = (2 / 102 + 2 / 98 + 0) / 3;
  const records = [
    finRec({ trade_id: 'a', simulated_fill_price: 100, real_fill_price: 102 }),
    finRec({ trade_id: 'b', simulated_fill_price: 100, real_fill_price: 98 }),
    finRec({ trade_id: 'c', simulated_fill_price: 100, real_fill_price: 100 })
  ];
  const r = evaluateCalibrationDivergence({
    purpose: 'divergence_input', calibration_records: records,
    divergence_bands: { fill: { elevated: 0.05, high: 0.15 } }
  });
  assertSafe(r);
  assert.equal(r.simulated, true);
  assert.equal(near(r.dimensions.fill.metric, expected), true, `fill metric ${r.dimensions.fill.metric} != ${expected}`);
  assert.equal(r.dimensions.fill.classification, 'WITHIN_BAND');
  assert.equal(r.dimensions.fill.pair_count, 3);
  assert.equal(r.finalized_count, 3);

  // tighter bands flip the classification (boundary: >= elevated -> ELEVATED)
  const e = evaluateCalibrationDivergence({
    purpose: 'divergence_input', calibration_records: records,
    divergence_bands: { fill: { elevated: 0.013, high: 0.10 } }
  });
  assert.equal(e.dimensions.fill.classification, 'ELEVATED');
  assert.equal(e.calibration_divergence_state, 'CALIB_DIVERGENCE_ELEVATED');
  const h = evaluateCalibrationDivergence({
    purpose: 'divergence_input', calibration_records: records,
    divergence_bands: { fill: { elevated: 0.001, high: 0.013 } }
  });
  assert.equal(h.dimensions.fill.classification, 'HIGH');
  assert.equal(h.calibration_divergence_state, 'CALIB_DIVERGENCE_HIGH');
});

test('(B) exit_success rate divergence by hand; provider_reliability rate', () => {
  const records = [
    finRec({ trade_id: 'a', simulated_exit: true, real_exit: true }),
    finRec({ trade_id: 'b', simulated_exit: true, real_exit: false }),
    finRec({ trade_id: 'c', simulated_exit: false, real_exit: false }),
    finRec({ trade_id: 'd', simulated_exit: true, real_exit: false, route_failure_flag: true })
  ];
  // simRate 3/4, realRate 1/4 -> metric 0.5 ; failure rate 1/4 = 0.25
  const r = evaluateCalibrationDivergence({
    purpose: 'divergence_input', calibration_records: records,
    divergence_bands: { exit_success: { elevated: 0.2, high: 0.6 }, provider_reliability: { elevated: 0.3, high: 0.5 } }
  });
  assert.equal(near(r.dimensions.exit_success.metric, 0.5), true);
  assert.equal(r.dimensions.exit_success.classification, 'ELEVATED');
  assert.equal(near(r.dimensions.provider_reliability.metric, 0.25), true);
  assert.equal(r.dimensions.provider_reliability.classification, 'WITHIN_BAND');
  // overall = worst classified = ELEVATED
  assert.equal(r.calibration_divergence_state, 'CALIB_DIVERGENCE_ELEVATED');
});

test('(B) finality rule: non-finalized excluded; missing band -> UNCLASSIFIED; latency always UNCLASSIFIED', () => {
  const records = [
    finRec({ trade_id: 'a', simulated_fill_price: 100, real_fill_price: 150 }),
    { ...finRec({ trade_id: 'b', simulated_fill_price: 100, real_fill_price: 100 }), timestamp_confirmed: null }
  ];
  const r = evaluateCalibrationDivergence({
    purpose: 'divergence_input', calibration_records: records, divergence_bands: {}
  });
  assert.equal(r.finalized_count, 1);
  assert.equal(r.non_finalized_count, 1);
  assert.equal(r.dimensions.fill.pair_count, 1);
  assert.equal(r.dimensions.fill.classification, 'UNCLASSIFIED');
  assert.equal(r.dimensions.fill.reasons.includes('missing_divergence_band'), true);
  assert.equal(r.dimensions.latency.classification, 'UNCLASSIFIED');
  assert.equal(r.dimensions.latency.reasons.includes('no_paired_latency_metric'), true);
  // all unclassified -> overall UNCLASSIFIED (never silently WITHIN_BAND)
  assert.equal(r.calibration_divergence_state, 'CALIB_DIVERGENCE_UNCLASSIFIED');
});

test('(B) pessimistic at zero finalized; cross-check vs CalibrationStore skeleton', () => {
  const nonFinal = [{ ...finRec({ trade_id: 'x' }), timestamp_confirmed: null }];
  const r = evaluateCalibrationDivergence({
    purpose: 'divergence_input', calibration_records: nonFinal,
    divergence_bands: { fill: { elevated: 0.05, high: 0.15 } }
  });
  assert.equal(r.finalized_count, 0);
  assert.equal(r.reasons.includes('pessimistic_no_finalized_records'), true);
  assert.equal(r.calibration_divergence_state, 'CALIB_DIVERGENCE_UNCLASSIFIED');

  // the existing stateful skeleton agrees on finality semantics
  const store = createCalibrationStore();
  for (const rec of nonFinal) store.add(rec);
  assert.equal(store.finalizedCount(), 0);
  const priors = store.getPriors({ brain: 'brain_a', signal_bucket: 's', wallet_cluster: 'c', token_risk_bucket: 'low' });
  assert.equal(priors.source, 'pessimistic_default');
  assert.equal(priors.p_fill, 0);

  const store2 = createCalibrationStore();
  const fin = [finRec({ trade_id: 'a' }), finRec({ trade_id: 'b' })];
  for (const rec of fin) store2.add(rec);
  const r2 = evaluateCalibrationDivergence({ purpose: 'divergence_input', calibration_records: fin, divergence_bands: {} });
  assert.equal(store2.finalizedCount(), r2.finalized_count);
});

test('(B) purity + record with forbidden name refuses whole input (value never echoed)', () => {
  const records = [finRec({ trade_id: 'a' })];
  const args = { purpose: 'divergence_input', calibration_records: records, divergence_bands: { fill: { elevated: 0.05, high: 0.15 } } };
  const r1 = evaluateCalibrationDivergence(args);
  const r2 = evaluateCalibrationDivergence(args);
  assert.deepEqual(JSON.parse(JSON.stringify(r1)), JSON.parse(JSON.stringify(r2)));

  const bad = evaluateCalibrationDivergence({
    purpose: 'divergence_input',
    calibration_records: [{ ...finRec({ trade_id: 'z' }), private_key: 'LEAK_B_KEYVAL' }],
    divergence_bands: {}
  });
  assert.equal(bad.calibration_divergence_state, 'CALIB_DIVERGENCE_INVALID');
  assert.equal(JSON.stringify(bad).includes('LEAK_B_KEYVAL'), false);

  const exec = evaluateCalibrationDivergence({
    purpose: 'divergence_input',
    calibration_records: [{ ...finRec({ trade_id: 'y' }), executed: true }],
    divergence_bands: {}
  });
  assert.equal(exec.calibration_divergence_state, 'CALIB_DIVERGENCE_INVALID');

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCalibrationDivergence(h); });
    assert.equal(r.calibration_divergence_state, 'CALIB_DIVERGENCE_UNCONFIGURED');
  }
});

// ===========================================================================
// (C) BACKTEST DATASET DESCRIPTOR — point-in-time / survivorship-free
// ===========================================================================

const rec = (ref, rank, wallet, over = {}) => ({ record_ref: ref, as_of_rank: rank, wallet_ref: wallet, ...over });

const goodDataset = (over = {}) => ({
  purpose: 'backtest_dataset_input',
  records: [rec('r1', 1, 'w-1'), rec('r2', 2, 'w-1'), rec('r3', 2, 'w-2'), rec('r4', 3, 'w-ext')],
  cohort_wallets: [
    { wallet_ref: 'w-1', status_bucket: 'active' },
    { wallet_ref: 'w-2', status_bucket: 'active' },
    { wallet_ref: 'w-ext', status_bucket: 'extinct' }
  ],
  ...over
});

test('(C) descriptor: shape + clean dataset -> DESCRIPTOR (pit + survivorship-free; equal ranks allowed)', () => {
  const d = describeBacktestDatasetDescriptorContract();
  assertSafe(d);
  assert.equal(d.contract, 'backtest-dataset-descriptor');

  const r = evaluateBacktestDatasetDescriptor(goodDataset());
  assertSafe(r);
  assert.equal(r.backtest_dataset_state, 'BACKTEST_DATASET_DESCRIPTOR');
  assert.equal(r.point_in_time_ok, true);
  assert.equal(r.survivorship_free, true);
  assert.equal(r.record_count, 4);
  assert.equal(r.wallet_count, 3);
  assert.equal(r.extinct_wallet_count, 1);
});

test('(C) out-of-order rank -> INVALID future_leakage_order_violation', () => {
  const r = evaluateBacktestDatasetDescriptor(goodDataset({
    records: [rec('r1', 2, 'w-1'), rec('r2', 1, 'w-1'), rec('r3', 3, 'w-2'), rec('r4', 4, 'w-ext')]
  }));
  assert.equal(r.backtest_dataset_state, 'BACKTEST_DATASET_INVALID');
  assert.equal(r.reasons.includes('future_leakage_order_violation'), true);
});

test('(C) future-knowledge key -> INVALID', () => {
  const r = evaluateBacktestDatasetDescriptor(goodDataset({
    records: [rec('r1', 1, 'w-1', { future_alpha: 1 }), rec('r4', 3, 'w-ext'), rec('r3', 4, 'w-2')]
  }));
  assert.equal(r.backtest_dataset_state, 'BACKTEST_DATASET_INVALID');
  assert.equal(r.reasons.includes('future_knowledge_field_refused'), true);
});

test('(C) dropped extinct wallet -> INVALID survivorship_risk; declared-inactive ok; dropped active -> DEGRADED', () => {
  const dropped = evaluateBacktestDatasetDescriptor(goodDataset({
    records: [rec('r1', 1, 'w-1'), rec('r3', 2, 'w-2')]
  }));
  assert.equal(dropped.backtest_dataset_state, 'BACKTEST_DATASET_INVALID');
  assert.equal(dropped.reasons.includes('survivorship_risk'), true);
  assert.equal(dropped.survivorship_free, false);

  const declared = evaluateBacktestDatasetDescriptor(goodDataset({
    records: [rec('r1', 1, 'w-1'), rec('r3', 2, 'w-2')],
    declared_inactive_wallet_refs: ['w-ext']
  }));
  assert.equal(declared.backtest_dataset_state, 'BACKTEST_DATASET_DESCRIPTOR');
  assert.equal(declared.survivorship_free, true);

  const missingActive = evaluateBacktestDatasetDescriptor(goodDataset({
    records: [rec('r1', 1, 'w-1'), rec('r4', 2, 'w-ext')]
  }));
  assert.equal(missingActive.backtest_dataset_state, 'BACKTEST_DATASET_DEGRADED');
  assert.equal(missingActive.reasons.includes('missing_cohort_wallet'), true);
});

test('(C) hostile/smuggle fail-closed', () => {
  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateBacktestDatasetDescriptor(h); });
    assert.equal(r.backtest_dataset_state, 'BACKTEST_DATASET_UNCONFIGURED');
  }
  const smug = evaluateBacktestDatasetDescriptor(goodDataset({
    records: [rec('r1', 1, 'w-1', { can_send: true }), rec('r4', 2, 'w-ext'), rec('r3', 3, 'w-2')]
  }));
  assert.equal(smug.backtest_dataset_state, 'BACKTEST_DATASET_INVALID');
});

// ===========================================================================
// (D) BACKTEST REPLAY — hand-computed FIFO per wallet
// ===========================================================================

const replayDataset = () => ({
  records: [rec('r1', 1, 'w-1'), rec('r2', 2, 'w-1'), rec('r3', 2, 'w-2')],
  cohort_wallets: [
    { wallet_ref: 'w-1', status_bucket: 'active' },
    { wallet_ref: 'w-2', status_bucket: 'extinct' }
  ]
});

// w-1: buy 10@1(f.1,s.05) + buy 5@2(f.1,s.05) @r1 ; sell 12@3(f.2,s.1) @r2
//   FIFO gross = (3-1)*10 + (3-2)*2 = 22 ; fees .4 ; slip .2 ; net 21.4 ; P1 open
// w-2: buy 4@5(f.2) + sell 4@4(f.2,s.1) @r3 -> gross -4 ; net -4.5 ; closed loss
const replayFills = () => ({
  r1: [
    mkFill({ position_ref: 'P1', wallet_ref: 'w-1', side: 'buy', quantity: 10, price: 1, fee: 0.1, slippage: 0.05 }),
    mkFill({ position_ref: 'P1', wallet_ref: 'w-1', side: 'buy', quantity: 5, price: 2, fee: 0.1, slippage: 0.05 })
  ],
  r2: [
    mkFill({ position_ref: 'P1', wallet_ref: 'w-1', side: 'sell', quantity: 12, price: 3, fee: 0.2, slippage: 0.1 })
  ],
  r3: [
    mkFill({ position_ref: 'P2', wallet_ref: 'w-2', side: 'buy', quantity: 4, price: 5, fee: 0.2, slippage: 0 }),
    mkFill({ position_ref: 'P2', wallet_ref: 'w-2', side: 'sell', quantity: 4, price: 4, fee: 0.2, slippage: 0.1 })
  ]
});

test('(D) descriptor + hand-computed per-wallet FIFO replay', () => {
  const d = describeBacktestReplayContract();
  assertSafe(d);
  assert.equal(d.contract, 'backtest-replay-read-model');
  assert.equal(d.simulated, true);

  const r = evaluateBacktestReplay({
    purpose: 'backtest_replay_input', dataset: replayDataset(), paper_fills_by_record: replayFills()
  });
  assertSafe(r);
  assert.equal(r.backtest_replay_state, 'BACKTEST_REPLAY_READ_MODEL');
  assert.equal(r.simulated, true);
  const w1 = r.candidate_pnl_by_wallet['w-1'];
  const w2 = r.candidate_pnl_by_wallet['w-2'];
  assert.equal(near(w1.gross, 22), true, `w1 gross ${w1.gross}`);
  assert.equal(near(w1.fees, 0.4), true);
  assert.equal(near(w1.slippage, 0.2), true);
  assert.equal(near(w1.net, 21.4), true, `w1 net ${w1.net}`);
  assert.equal(w1.backtest_open, 1);
  assert.equal(w1.backtest_wins + w1.backtest_losses + w1.backtest_flats, 0);
  assert.equal(near(w2.gross, -4), true);
  assert.equal(near(w2.net, -4.5), true);
  assert.equal(w2.backtest_losses, 1);
  assert.equal(w2.backtest_open, 0);
  assert.equal(Object.isFrozen(w1), true);
  assert.equal(w1.simulated, true);
});

test('(D) determinism + dataset re-validated internally + mismatches refused', () => {
  const args = { purpose: 'backtest_replay_input', dataset: replayDataset(), paper_fills_by_record: replayFills() };
  assert.deepEqual(
    JSON.parse(JSON.stringify(evaluateBacktestReplay(args))),
    JSON.parse(JSON.stringify(evaluateBacktestReplay(args)))
  );

  // dirty dataset (dropped extinct wallet) -> replay refused
  const dirty = evaluateBacktestReplay({
    purpose: 'backtest_replay_input',
    dataset: { records: [rec('r1', 1, 'w-1')], cohort_wallets: replayDataset().cohort_wallets },
    paper_fills_by_record: {}
  });
  assert.equal(dirty.backtest_replay_state, 'BACKTEST_REPLAY_INVALID');
  assert.equal(dirty.reasons.includes('dataset_not_clean'), true);

  // wallet mismatch between fill and record -> refused
  const mismatch = evaluateBacktestReplay({
    purpose: 'backtest_replay_input', dataset: replayDataset(),
    paper_fills_by_record: { r1: [mkFill({ position_ref: 'P1', wallet_ref: 'w-2', side: 'buy', quantity: 1, price: 1 })] }
  });
  assert.equal(mismatch.backtest_replay_state, 'BACKTEST_REPLAY_INVALID');
  assert.equal(mismatch.reasons.includes('fill_wallet_mismatch'), true);
});

test('(D) execution-shaped / forbidden-named fills refuse the whole replay (no echo)', () => {
  const execFill = { position_ref: 'P1', wallet_ref: 'w-1', side: 'buy', quantity: 1, price: 1, executed: true };
  const r1 = evaluateBacktestReplay({
    purpose: 'backtest_replay_input', dataset: replayDataset(),
    paper_fills_by_record: { r1: [execFill] }
  });
  assert.equal(r1.backtest_replay_state, 'BACKTEST_REPLAY_INVALID');

  const keyFill = { position_ref: 'P1', wallet_ref: 'w-1', side: 'buy', quantity: 1, price: 1, private_key: 'LEAK_D_KEYVAL' };
  const r2 = evaluateBacktestReplay({
    purpose: 'backtest_replay_input', dataset: replayDataset(),
    paper_fills_by_record: { r1: [keyFill] }
  });
  assert.equal(r2.backtest_replay_state, 'BACKTEST_REPLAY_INVALID');
  assert.equal(JSON.stringify(r2).includes('LEAK_D_KEYVAL'), false);

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateBacktestReplay(h); });
    assert.equal(r.backtest_replay_state, 'BACKTEST_REPLAY_UNCONFIGURED');
  }
});

// ===========================================================================
// (E) SUPPRESSION — always suppressed
// ===========================================================================

test('(E) ALWAYS suppressed with the three not_*_authorized on every path', () => {
  const d = describeCalibrationSuppressionContract();
  assertSafe(d);
  for (const inp of [undefined, null, {}, hostiles()[0], hostiles()[1]]) {
    let s;
    assert.doesNotThrow(() => { s = evaluateCalibrationSuppression(inp); });
    assertSafe(s);
    assert.equal(s.suppressed, true);
    for (const t of ['not_execution_authorized', 'not_sign_authorized', 'not_send_authorized']) {
      assert.equal(s.suppression_reasons.includes(t), true, `missing ${t}`);
    }
  }
});

test('(E) component-specific codes added when unclean', () => {
  const blockedSurface = evaluateCalibrationForbiddenSurface({ endpoint: 'http://LEAK' });
  const s = evaluateCalibrationSuppression({
    purpose: 'calibration_suppression_input',
    calibration_surface: blockedSurface
  });
  assert.equal(s.suppression_reasons.includes('live_surface_detected'), true);
  assert.equal(s.suppression_reasons.includes('calibration_input_not_valid'), true); // boundary missing
});

// ===========================================================================
// (F) FORBIDDEN SURFACE GUARD — NAME-only redaction
// ===========================================================================

test('(F) clean / blocked / redaction / hostile', () => {
  const d = describeCalibrationForbiddenSurfaceContract();
  assertSafe(d);
  const clean = evaluateCalibrationForbiddenSurface({ purpose: 'x' });
  assertSafe(clean);
  assert.equal(clean.calibration_surface_state, 'CALIB_SURFACE_CLEAN');

  for (const name of ['private_key', 'seed', 'signature', 'endpoint', 'rpc_url', 'serialized_tx', 'message_bytes']) {
    const planted = `PLANTED_${name.toUpperCase()}_VAL`;
    const r = evaluateCalibrationForbiddenSurface({ [name]: planted });
    assertSafe(r);
    assert.equal(r.calibration_surface_state, 'CALIB_SURFACE_BLOCKED');
    assert.equal(r.forbidden_field_ref, name);
    assert.equal(JSON.stringify(r).includes(planted), false, `${name} value must be redacted`);
  }
  const sigR = evaluateCalibrationForbiddenSurface({ signature: 'S' });
  assert.equal(sigR.key_material_detected, true);
  const epR = evaluateCalibrationForbiddenSurface({ endpoint: 'E' });
  assert.equal(epR.key_material_detected, false);
  assert.equal(epR.live_surface_detected, true);

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCalibrationForbiddenSurface(h); });
    assert.equal(r.calibration_surface_state, 'CALIB_SURFACE_UNCONFIGURED');
  }
});

// ===========================================================================
// (G) HEALTH
// ===========================================================================

const cleanBoundary = evaluateCalibrationInputBoundary({
  purpose: 'calibration_input', paper_pnl_read_model: realPaperPnl, calibration_records: [finRec()]
});
const cleanDivergence = evaluateCalibrationDivergence({
  purpose: 'divergence_input', calibration_records: [finRec()],
  divergence_bands: { fill: { elevated: 0.05, high: 0.15 } }
});
const cleanDataset = evaluateBacktestDatasetDescriptor(goodDataset());
const cleanReplay = evaluateBacktestReplay({
  purpose: 'backtest_replay_input', dataset: replayDataset(), paper_fills_by_record: replayFills()
});
const cleanSurface = evaluateCalibrationForbiddenSurface({ purpose: 'x' });
const cleanSuppression = evaluateCalibrationSuppression({
  purpose: 'calibration_suppression_input',
  calibration_input_boundary: cleanBoundary,
  calibration_divergence: cleanDivergence,
  backtest_dataset_descriptor: cleanDataset,
  backtest_replay: cleanReplay,
  calibration_surface: cleanSurface
});

const goodHealthInput = (over = {}) => ({
  calibration_input_boundary: cleanBoundary,
  calibration_divergence: cleanDivergence,
  backtest_dataset_descriptor: cleanDataset,
  backtest_replay: cleanReplay,
  calibration_suppression: cleanSuppression,
  calibration_surface: cleanSurface,
  ...over
});

test('(G) clean path -> SUPPRESSED (always-suppressed upstream); explicit not-suppressed -> REVIEWED_ADVISORY (opens nothing)', () => {
  const d = describeCalibrationHealthContract();
  assertSafe(d);
  assert.equal(cleanSuppression.suppressed, true);
  const sup = evaluateCalibrationHealth(goodHealthInput());
  assertSafe(sup);
  assert.equal(sup.calibration_health_state, 'CALIB_HEALTH_SUPPRESSED');

  const notSuppressed = Object.freeze({ suppressed: false, suppression_reasons: [], read_only: true });
  const rev = evaluateCalibrationHealth(goodHealthInput({ calibration_suppression: notSuppressed }));
  assertSafe(rev);
  assert.equal(rev.calibration_health_state, 'CALIB_HEALTH_REVIEWED_ADVISORY');
  assert.equal(rev.can_send, false);
  assert.equal(rev.signer_ready, false);
});

test('(G) blocked / missing / hostile', () => {
  const blockedSurface = evaluateCalibrationForbiddenSurface({ private_key: 'LEAK_G' });
  const b = evaluateCalibrationHealth(goodHealthInput({ calibration_surface: blockedSurface }));
  assert.equal(b.calibration_health_state, 'CALIB_HEALTH_BLOCKED');
  assert.equal(JSON.stringify(b).includes('LEAK_G'), false);

  const m = evaluateCalibrationHealth(goodHealthInput({ backtest_replay: undefined }));
  assert.equal(m.calibration_health_state, 'CALIB_HEALTH_UNCONFIGURED');

  for (const h of hostiles()) {
    let r;
    assert.doesNotThrow(() => { r = evaluateCalibrationHealth(h); });
    assert.equal(r.calibration_health_state, 'CALIB_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// Integration consistency + static guards
// ===========================================================================

test('integration: send-gate still refuses beside calibration/backtest read-models', () => {
  const gate = evaluateSendPreflight({ calibration: cleanDivergence, replay: cleanReplay });
  assert.equal(gate.ok, false);
  assert.equal(gate.can_send, false);
  assert.equal(gate.can_broadcast, false);
});

test('static guards: import-free src, no exec-true literal, no clock/RNG/network, no module-level mutable state, candidate discipline', () => {
  const srcPath = fileURLToPath(new URL('../src/calibration-backtest-foundations.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');

  // import-free (the only allowed import form would be none at all)
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
  assert.equal(/Date\s*\.\s*now|new\s+Date\b/.test(code), false, 'no clock');
  assert.equal(/Math\s*\.\s*random/.test(code), false, 'no RNG');
  assert.equal(/fetch\s*\(|WebSocket|XMLHttpRequest|process\s*\.\s*env|readFileSync/.test(code), false, 'no network/env/fs');
  assert.equal(/^(let|var)\s/m.test(code), false, 'no module-level mutable state');

  // candidate_* discipline: ONLY candidate_pnl_by_wallet (G22) appears in src.
  const candidates = [...new Set(src.match(/candidate_[a-z0-9_]+/g) || [])];
  const ALLOWED = ['candidate_pnl_by_wallet'];
  // prose in the header mentions a few registered/deferred names for documentation;
  // restrict the check to CODE (string-stripped) occurrences:
  const codeCandidates = [...new Set(code.match(/candidate_[a-z0-9_]+/g) || [])];
  for (const c of codeCandidates) {
    assert.equal(ALLOWED.includes(c), true, `unexpected candidate name in code: ${c}`);
  }
  assert.equal(candidates.length >= 1, true);

  // the deferred divergence-status enum value string must not appear as a token
  assert.equal(/['"]within_band['"]/.test(src), false, 'deferred enum value strings must not be used');
});
