// Stage-18 test suite for @soltrade/operator-dashboard-foundations
// node:test + node:assert/strict. Deterministic. Renders REAL backend
// read-models built via the real upstream chains (Stage-14 paper fills ->
// P&L; Stage-15 backtest replay -> Stage-16 profitability/advisory; Stage-17
// stream health + readiness checklist; Stage-13 decision trace + a faithful
// stand-in for the heavy full-advisory chain). Proves the XSS-escape /
// no-secret-leak / unavailable-never-0 / SIMULATED-badge / never-hide-security
// / read-only-inert-html / fail-closed / frozen / TOCTOU spine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeDecisionTracePanelContract,
  renderDecisionTracePanel,
  describePipelineHealthPanelContract,
  renderPipelineHealthPanel,
  describePaperPnlPanelContract,
  renderPaperPnlPanel,
  describeProfitabilityAdvisoryPanelContract,
  renderProfitabilityAdvisoryPanel,
  describeStreamHealthPanelContract,
  renderStreamHealthPanel,
  describeSecurityNoticesPanelContract,
  renderSecurityNoticesPanel,
  describeOperatorDashboardContract,
  assembleOperatorDashboard
} from '../src/index.mjs';

import {
  evaluateCandidatePaperFill,
  evaluatePaperPnlReadModel
} from '../../paper-execution-foundations/src/index.mjs';
import { evaluateBacktestReplay } from '../../calibration-backtest-foundations/src/index.mjs';
import {
  evaluateProfitabilityInputBoundary,
  evaluateWalletProfitability,
  evaluateProfitabilityRiskFlags,
  evaluateCopyabilityAdvisory
} from '../../profitability-intelligence-foundations/src/index.mjs';
import {
  evaluateStreamHealthReadModel,
  evaluateLiveReadinessChecklist
} from '../../live-stream-boundary-foundations/src/index.mjs';
import {
  evaluatePipelineDecisionTrace,
  evaluatePipelineHealthReadModel
} from '../../pipeline-decision-trace-foundations/src/index.mjs';

// ---------------------------------------------------------------------------
// shared assertion helpers
// ---------------------------------------------------------------------------

const FORBIDDEN_TRUE_FLAGS = [
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
];

const RENDER_STATES = [
  'DASH_RENDER_OK', 'DASH_RENDER_UNAVAILABLE', 'DASH_RENDER_INVALID',
  'DASH_RENDER_REFUSED'
];

function assertDashSafe(r) {
  assert.equal(Object.isFrozen(r), true, 'result must be frozen');
  assert.equal(Object.isFrozen(r.reasons), true, 'reasons must be frozen');
  assert.equal(r.read_only, true, 'read_only must be true');
  assert.equal(r.advisory_only, true, 'advisory_only must be true');
  assert.equal(typeof r.html, 'string', 'html must be a string');
  assert.equal(RENDER_STATES.includes(r.render_state), true, 'LOCAL render_state');
  for (const f of FORBIDDEN_TRUE_FLAGS) {
    assert.equal(r[f], false, `${f} must be false on every result`);
  }
}

function hostiles() {
  const throwingProxy = new Proxy({}, {
    get() { throw new Error('hostile-get'); },
    ownKeys() { throw new Error('hostile-keys'); },
    getOwnPropertyDescriptor() { throw new Error('hostile-desc'); }
  });
  const throwingGetter = Object.defineProperty({}, 'lang', {
    enumerable: true,
    get() { throw new Error('hostile-getter'); }
  });
  return [
    null, undefined, 42, 'a-string', [], true,
    throwingProxy, throwingGetter,
    { lang: 'en', decision_trace: () => {} },
    { lang: 'en', paper_pnl_read_model: { read_only: true, paper_pnl_state: 'PAPER_PNL_READ_MODEL', simulated: true, positions: { p: () => {} } } }
  ];
}

// counting getter: serves firstValue on the FIRST read, laterValue afterwards.
function withCountedField(base, field, firstValue, laterValue) {
  let reads = 0;
  const obj = { ...base };
  Object.defineProperty(obj, field, {
    enumerable: true,
    configurable: true,
    get() { reads += 1; return reads === 1 ? firstValue : laterValue; }
  });
  return { obj, reads: () => reads };
}

// ---------------------------------------------------------------------------
// REAL upstream chains
// ---------------------------------------------------------------------------

const mkFill = (o) => evaluateCandidatePaperFill({ purpose: 'candidate_paper_fill_input', ...o });

// P0 closed (+4 gross), P1 open w/ VALID mark (unrealized 5), P2 open w/o mark
const realPaperFills = [
  mkFill({ position_ref: 'P0', wallet_ref: 'w-A', side: 'buy', quantity: 2, price: 10, fee: 0.1, slippage: 0.1 }),
  mkFill({ position_ref: 'P0', wallet_ref: 'w-A', side: 'sell', quantity: 2, price: 12, fee: 0.1, slippage: 0.1 }),
  mkFill({ position_ref: 'P1', wallet_ref: 'w-B', side: 'buy', quantity: 1, price: 10, fee: 0.1, slippage: 0 }),
  mkFill({ position_ref: 'P2', wallet_ref: 'w-B', side: 'buy', quantity: 1, price: 10, fee: 0.1, slippage: 0 })
];
const realPaperPnl = evaluatePaperPnlReadModel({
  purpose: 'paper_pnl_input',
  paper_fills: realPaperFills,
  marks: { P1: { mark_price: 15, mark_status_bucket: 'valid' } }
});

// Stage-15 replay -> Stage-16 profitability chain (same shape the Stage-16
// suite uses; hand-computed: w-A 2W 1L closed=3 net>0, w-D one-hit closed=1)
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
const realWalletProfitability = evaluateWalletProfitability({
  purpose: 'wallet_profitability_input', backtest_replay: realReplay, min_sample_size: 3
});
const realRiskFlags = evaluateProfitabilityRiskFlags({
  purpose: 'risk_flags_input',
  wallet_profitability: realWalletProfitability,
  heuristic_thresholds: { min_closed_for_flags: 1 }
});
const realBoundary = evaluateProfitabilityInputBoundary({
  purpose: 'profitability_input', paper_pnl_read_model: realPaperPnl, backtest_replay: realReplay
});
const realAdvisory = evaluateCopyabilityAdvisory({
  purpose: 'copyability_advisory_input',
  profitability_input_boundary: realBoundary,
  wallet_profitability: realWalletProfitability,
  profitability_risk_flags: realRiskFlags
});

// Stage-17 stream health + readiness checklist
const realGapExceeded = evaluateStreamHealthReadModel({
  last_seen_slot: 200, last_confirmed_slot: 100, max_backfill_window_slots: 10
});
const realSynced = evaluateStreamHealthReadModel({
  last_seen_slot: 100, last_confirmed_slot: 100, max_backfill_window_slots: 10
});
const realChecklist = evaluateLiveReadinessChecklist({
  priority_fee_cache_warm: true, protocol_constants_green: true,
  rpc_health_green: false, stream_synced: null,
  calibration_priors_loaded: true, cost_pipeline_ready: true
});

// Stage-13: real (degraded/unconfigured) trace + real pipeline health
const realTrace = evaluatePipelineDecisionTrace({});
const realPipelineHealth = evaluatePipelineHealthReadModel({});

// faithful stand-in for the heavy full-advisory trace (same terminal shape
// the Stage-13 composer emits — frozen, read_only, fixed 6-stage entries)
const traceEntry = (stage, st) => Object.freeze({
  stage, stage_state: st, decisive_reason: 'reviewed_advisory', advanced: true, blocked: false
});
const advisoryTraceStandin = Object.freeze({
  read_only: true,
  advisory_only: true,
  overall_outcome: 'reviewed_advisory_all_stages',
  status: 'reviewed_advisory_all_stages',
  reasons: Object.freeze(['reviewed_advisory_all_stages']),
  trace_entries: Object.freeze([
    traceEntry('signal', 'SIGNAL_PASS_ADVISORY'),
    traceEntry('risk', 'RISK_PASS_ADVISORY'),
    traceEntry('intent', 'INTENT_READY_ADVISORY'),
    traceEntry('route', 'ROUTE_READY_ADVISORY'),
    traceEntry('signing_review', 'SIGNING_REVIEWED_ADVISORY'),
    traceEntry('send_review', 'SEND_REVIEWED_ADVISORY')
  ])
});

test('preconditions: the real upstream chains are green', () => {
  for (const f of realPaperFills) assert.equal(f.paper_fill_state, 'CANDIDATE_PAPER_FILL_DESCRIPTOR');
  assert.equal(realPaperPnl.paper_pnl_state, 'PAPER_PNL_READ_MODEL');
  assert.equal(realPaperPnl.simulated, true);
  assert.equal(typeof realPaperPnl.positions.P1.candidate_unrealized_pnl, 'number');
  assert.equal(realPaperPnl.positions.P2.candidate_unrealized_pnl, null);
  assert.equal(realReplay.backtest_replay_state, 'BACKTEST_REPLAY_READ_MODEL');
  assert.equal(realWalletProfitability.profitability_state, 'PROFITABILITY_READ_MODEL');
  assert.equal(realAdvisory.copyability_advisory_state, 'COPYABILITY_ADVISORY_READ_MODEL');
  assert.equal(realGapExceeded.stream_health_state, 'LIVE_STREAM_HEALTH_GAP_EXCEEDED');
  assert.equal(realGapExceeded.live_stream_advisory, 'LIVE_ADVISORY_EXITS_ONLY_SHAPED');
  assert.equal(realSynced.stream_health_state, 'LIVE_STREAM_HEALTH_SYNCED');
  assert.equal(realChecklist.live_readiness_state, 'LIVE_READINESS_CHECKLIST');
  assert.equal(typeof realTrace.overall_outcome, 'string');
  assert.equal(Array.isArray(realTrace.trace_entries), true);
  assert.equal(typeof realPipelineHealth.pipeline_health_state, 'string');
});

// ===========================================================================
// contracts
// ===========================================================================

test('contracts: frozen, safe flags, LOCAL identifiers', () => {
  const contracts = [
    [describeDecisionTracePanelContract(), 'operator-dashboard-decision-trace-panel'],
    [describePipelineHealthPanelContract(), 'operator-dashboard-pipeline-health-panel'],
    [describePaperPnlPanelContract(), 'operator-dashboard-paper-pnl-panel'],
    [describeProfitabilityAdvisoryPanelContract(), 'operator-dashboard-profitability-advisory-panel'],
    [describeStreamHealthPanelContract(), 'operator-dashboard-stream-health-panel'],
    [describeSecurityNoticesPanelContract(), 'operator-dashboard-security-notices-panel'],
    [describeOperatorDashboardContract(), 'operator-dashboard-assembler']
  ];
  for (const [d, id] of contracts) {
    assert.equal(Object.isFrozen(d), true);
    assert.equal(d.contract, id);
    assert.equal(d.read_only, true);
    assert.equal(d.advisory_only, true);
    assert.equal(d.test_only, true);
    assert.deepEqual([...d.supported_render_states], RENDER_STATES);
    assert.deepEqual([...d.supported_langs], ['ar', 'en']);
    assert.equal(String(d.panel_kind).startsWith('dash_'), true, 'LOCAL dash_* panel kind');
    for (const f of FORBIDDEN_TRUE_FLAGS) assert.equal(d[f], false);
  }
});

// ===========================================================================
// (2) decision trace panel
// ===========================================================================

test('(2) real Stage-13 trace renders; stand-in advisory trace renders all 6 stages in order', () => {
  const r1 = renderDecisionTracePanel({ decision_trace: realTrace, lang: 'en' });
  assertDashSafe(r1);
  assert.equal(r1.render_state, 'DASH_RENDER_OK');
  assert.equal(r1.html.includes(realTrace.overall_outcome), true);

  const r2 = renderDecisionTracePanel({ decision_trace: advisoryTraceStandin, lang: 'en' });
  assertDashSafe(r2);
  assert.equal(r2.render_state, 'DASH_RENDER_OK');
  const order = ['signal', 'risk', 'intent', 'route', 'signing_review', 'send_review'];
  let last = -1;
  for (const stage of order) {
    const i = r2.html.indexOf('<td>' + stage + '</td>');
    assert.equal(i > last, true, `stage ${stage} must appear in fixed order`);
    last = i;
  }
  assert.equal(r2.html.includes('SIGNING_REVIEWED_ADVISORY'), true);
  assert.equal(r2.html.includes('reviewed_advisory_all_stages'), true);
});

test('(2) missing stage entries render unavailable — never invented', () => {
  const partial = Object.freeze({
    read_only: true,
    overall_outcome: 'degraded',
    trace_entries: Object.freeze([traceEntry('signal', 'SIGNAL_PASS_ADVISORY')]),
    reasons: Object.freeze(['degraded'])
  });
  const r = renderDecisionTracePanel({ decision_trace: partial, lang: 'en' });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('unavailable'), true);
  assert.equal(r.html.includes('<td>send_review</td>'), true);
});

test('(2) missing / unrecognized model -> DASH_RENDER_UNAVAILABLE (unavailable text)', () => {
  const missing = renderDecisionTracePanel({ lang: 'en' });
  assertDashSafe(missing);
  assert.equal(missing.render_state, 'DASH_RENDER_UNAVAILABLE');
  assert.equal(missing.html.includes('unavailable'), true);

  const unrecognized = renderDecisionTracePanel({
    decision_trace: { overall_outcome: 'x', trace_entries: [] }, lang: 'en' // no read_only
  });
  assert.equal(unrecognized.render_state, 'DASH_RENDER_UNAVAILABLE');
  assert.equal(unrecognized.reasons.includes('unrecognized_decision_trace'), true);
});

test('(2) lang must be ar|en — anything else (incl. missing) -> DASH_RENDER_INVALID', () => {
  for (const lang of [undefined, null, 'fr', 'EN', 'ar-SA', 7]) {
    const r = renderDecisionTracePanel({ decision_trace: advisoryTraceStandin, lang });
    assertDashSafe(r);
    assert.equal(r.render_state, 'DASH_RENDER_INVALID');
    assert.equal(r.reasons.includes('lang_invalid'), true);
  }
});

test('(2) XSS plants in trace fields appear ESCAPED — never raw/executable', () => {
  const xssTrace = {
    read_only: true,
    overall_outcome: ']]>outcome',
    trace_entries: [
      { stage: 'signal', stage_state: '<script>alert(1)</script>', decisive_reason: '" onerror=alert(1)', advanced: true, blocked: false },
      { stage: 'risk', stage_state: "x' onmouseover='steal()", decisive_reason: 'stage_blocked', advanced: false, blocked: true }
    ],
    reasons: ['x']
  };
  const r = renderDecisionTracePanel({ decision_trace: xssTrace, lang: 'en' });
  assertDashSafe(r);
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(r.html.includes('<script'), false, 'no raw script tag');
  assert.equal(r.html.includes('&quot; onerror=alert(1)'), true);
  assert.equal(r.html.includes('" onerror='), false, 'no raw attribute-breaking quote');
  assert.equal(r.html.includes('x&#39; onmouseover=&#39;steal()'), true);
  assert.equal(r.html.includes("x' onmouseover='"), false);
  assert.equal(r.html.includes(']]&gt;outcome'), true);
  assert.equal(r.html.includes(']]>outcome'), false);
});

test('(2) planted secret NAME / endpoint VALUE -> REFUSED; the value is NEVER anywhere in the result', () => {
  const secretName = renderDecisionTracePanel({
    decision_trace: { ...advisoryTraceStandin, private_key: 'LEAK_DASH_PK_VALUE_111' }, lang: 'en'
  });
  assertDashSafe(secretName);
  assert.equal(secretName.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(secretName.reasons.includes('forbidden_surface_name_blocked'), true);
  assert.equal(JSON.stringify(secretName).includes('LEAK_DASH_PK_VALUE_111'), false);

  const endpointValue = renderDecisionTracePanel({
    decision_trace: { ...advisoryTraceStandin, note_ref: 'wss://leak.example/stream' }, lang: 'en'
  });
  assert.equal(endpointValue.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(endpointValue.reasons.includes('forbidden_value_blocked'), true);
  assert.equal(JSON.stringify(endpointValue).includes('leak.example'), false);

  // nested plant inside an entry is refused too
  const nested = renderDecisionTracePanel({
    decision_trace: {
      read_only: true,
      overall_outcome: 'degraded',
      trace_entries: [{ stage: 'signal', stage_state: 'X', decisive_reason: 'y', api_key: 'LEAK_DASH_APIKEY_222' }],
      reasons: []
    },
    lang: 'en'
  });
  assert.equal(nested.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(JSON.stringify(nested).includes('LEAK_DASH_APIKEY_222'), false);
});

test('(2) smuggled execution flag / command key -> REFUSED', () => {
  const flag = renderDecisionTracePanel({
    decision_trace: { ...advisoryTraceStandin, can_send: true }, lang: 'en'
  });
  assert.equal(flag.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(flag.reasons.includes('forbidden_flag_blocked'), true);

  const cmd = renderDecisionTracePanel({
    decision_trace: { ...advisoryTraceStandin, buy_opportunity: { mint: 'x' } }, lang: 'en'
  });
  assert.equal(cmd.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(cmd.reasons.includes('execution_command_blocked'), true);
});

test('(2) TOCTOU: counting getter on the consumed model is read EXACTLY ONCE; the first value renders', () => {
  const { obj, reads } = withCountedField(
    { ...advisoryTraceStandin }, 'overall_outcome',
    'reviewed_advisory_all_stages', 'HACKED_LATER_VALUE'
  );
  const r = renderDecisionTracePanel({ decision_trace: obj, lang: 'en' });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(reads(), 1, 'property must be read exactly once (snapshot-once)');
  assert.equal(r.html.includes('reviewed_advisory_all_stages'), true);
  assert.equal(r.html.includes('HACKED_LATER_VALUE'), false);
});

// ===========================================================================
// (3) pipeline health panel
// ===========================================================================

test('(3) real pipeline health renders state chip + reasons; unknown state -> unavailable', () => {
  const r = renderPipelineHealthPanel({ pipeline_health: realPipelineHealth, lang: 'en' });
  assertDashSafe(r);
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes(realPipelineHealth.pipeline_health_state), true);
  for (const reason of realPipelineHealth.reasons) {
    assert.equal(r.html.includes(reason), true);
  }

  const standin = Object.freeze({
    read_only: true, pipeline_health_state: 'PIPELINE_HEALTH_SUPPRESSED',
    reasons: Object.freeze(['pipeline_health_suppressed'])
  });
  const r2 = renderPipelineHealthPanel({ pipeline_health: standin, lang: 'en' });
  assert.equal(r2.render_state, 'DASH_RENDER_OK');
  assert.equal(r2.html.includes('PIPELINE_HEALTH_SUPPRESSED'), true);

  const unknown = renderPipelineHealthPanel({
    pipeline_health: { read_only: true, pipeline_health_state: 'TOTALLY_NEW_STATE', reasons: [] },
    lang: 'en'
  });
  assert.equal(unknown.render_state, 'DASH_RENDER_UNAVAILABLE');
  assert.equal(unknown.reasons.includes('unrecognized_pipeline_health'), true);
  assert.equal(unknown.html.includes('TOTALLY_NEW_STATE'), false, 'unknown state string is not echoed');
});

test('(3) decision_health slot is accepted as the alternate input name', () => {
  const r = renderPipelineHealthPanel({ decision_health: realPipelineHealth, lang: 'ar' });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes(realPipelineHealth.pipeline_health_state), true);
});

// ===========================================================================
// (4) paper P&L panel
// ===========================================================================

test('(4) real paper P&L renders: SIMULATED badge, verbatim totals, per-bucket tables', () => {
  const r = renderPaperPnlPanel({ paper_pnl_read_model: realPaperPnl, lang: 'en' });
  assertDashSafe(r);
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('dash-badge-simulated'), true);
  assert.equal(r.html.includes('SIMULATED'), true);
  // backend totals verbatim (String of the model's own numbers)
  assert.equal(r.html.includes(String(realPaperPnl.candidate_realized_pnl)), true);
  assert.equal(r.html.includes(String(realPaperPnl.candidate_fees_total)), true);
  assert.equal(r.html.includes(String(realPaperPnl.candidate_paper_pnl)), true);
  // per-wallet aggregation rendered from the model's buckets
  assert.equal(r.html.includes('w-A'), true);
  assert.equal(r.html.includes(String(realPaperPnl.candidate_pnl_by_wallet['w-A'].candidate_paper_pnl)), true);
  // mark-valid unrealized renders as the model's number
  assert.equal(r.html.includes(String(realPaperPnl.positions.P1.candidate_unrealized_pnl)), true);
});

test('(4) null unrealized renders unavailable — and NEVER 0', () => {
  const r = renderPaperPnlPanel({ paper_pnl_read_model: realPaperPnl, lang: 'en' });
  const i = r.html.indexOf('<td>P2</td>');
  assert.equal(i > -1, true);
  const row = r.html.slice(i, r.html.indexOf('</tr>', i));
  // cells: ref | realized | fees | slippage | unrealized | mark_status
  const cells = row.split('</td>');
  const unrealizedCell = cells[4];
  assert.equal(unrealizedCell.includes('unavailable'), true, 'P2 unrealized must render unavailable');
  assert.equal(/>\s*0\s*$/.test(unrealizedCell), false, 'null unrealized must never render as 0');
  assert.equal(unrealizedCell.includes('>0'), false, 'no 0 in the unrealized cell');
  // and in Arabic
  const ar = renderPaperPnlPanel({ paper_pnl_read_model: realPaperPnl, lang: 'ar' });
  assert.equal(ar.html.includes('غير متاح'), true);
  assert.equal(ar.html.includes('محاكاة'), true, 'Arabic SIMULATED badge');
});

test('(4) the renderer NEVER computes totals — model numbers are shown verbatim even when inconsistent', () => {
  const inconsistent = {
    read_only: true, paper_pnl_state: 'PAPER_PNL_READ_MODEL', simulated: true,
    candidate_realized_pnl: 1, candidate_fees_total: 2, candidate_slippage_cost: 3,
    candidate_paper_pnl: 123.456, // NOT 1-2-3: a computing renderer would show -4
    positions: {}, candidate_pnl_by_wallet: {}, candidate_pnl_by_copy_mode: {}, candidate_pnl_by_brain: {},
    reasons: []
  };
  const r = renderPaperPnlPanel({ paper_pnl_read_model: inconsistent, lang: 'en' });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('123.456'), true, 'model total verbatim');
  assert.equal(r.html.includes('-4'), false, 'no renderer-side arithmetic');
});

test('(4) missing metrics render unavailable (never fabricated); UNCONFIGURED model -> unavailable panel with badge', () => {
  const sparse = {
    read_only: true, paper_pnl_state: 'PAPER_PNL_READ_MODEL', simulated: true,
    candidate_paper_pnl: 7,
    positions: {}, reasons: []
    // candidate_realized_pnl / fees / slippage / bucket maps all missing
  };
  const r = renderPaperPnlPanel({ paper_pnl_read_model: sparse, lang: 'en' });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('unavailable'), true);
  assert.equal(r.html.includes('<td>7</td>'), true);

  const unconf = renderPaperPnlPanel({ paper_pnl_read_model: evaluatePaperPnlReadModel(undefined), lang: 'en' });
  assertDashSafe(unconf);
  assert.equal(unconf.render_state, 'DASH_RENDER_UNAVAILABLE');
  assert.equal(unconf.reasons.includes('paper_pnl_not_read_model'), true);
  assert.equal(unconf.html.includes('SIMULATED'), true, 'badge whenever the model carries simulated:true');
});

test('(4) a READ_MODEL not marked simulated:true is REFUSED — paper truth stays visibly simulated', () => {
  const r = renderPaperPnlPanel({
    paper_pnl_read_model: { read_only: true, paper_pnl_state: 'PAPER_PNL_READ_MODEL', positions: {}, reasons: [] },
    lang: 'en'
  });
  assert.equal(r.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(r.reasons.includes('simulated_marking_missing'), true);
});

test('(4) XSS plant in a position ref appears escaped; planted private_key VALUE refused + absent', () => {
  const xss = {
    read_only: true, paper_pnl_state: 'PAPER_PNL_READ_MODEL', simulated: true,
    candidate_realized_pnl: 1, candidate_fees_total: 0, candidate_slippage_cost: 0, candidate_paper_pnl: 1,
    positions: { '<script>alert(1)</script>': { candidate_realized_pnl: 1, candidate_unrealized_pnl: null } },
    candidate_pnl_by_wallet: {}, candidate_pnl_by_copy_mode: {}, candidate_pnl_by_brain: {}, reasons: []
  };
  const r = renderPaperPnlPanel({ paper_pnl_read_model: xss, lang: 'en' });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(r.html.includes('<script'), false);

  const leak = renderPaperPnlPanel({
    paper_pnl_read_model: { ...realPaperPnl, positions: { P9: { private_key: 'LEAK_DASH_PAPER_KEY_333' } } },
    lang: 'en'
  });
  assert.equal(leak.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(JSON.stringify(leak).includes('LEAK_DASH_PAPER_KEY_333'), false);
});

// ===========================================================================
// (5) profitability advisory panel
// ===========================================================================

test('(5) real advisory + profitability render: chips, both-language advisory caption, verbatim ratios', () => {
  const r = renderProfitabilityAdvisoryPanel({
    copyability_advisory: realAdvisory,
    wallet_profitability: realWalletProfitability,
    lang: 'en'
  });
  assertDashSafe(r);
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  // permanent caption in BOTH languages
  assert.equal(r.html.includes('advisory only — not a command'), true);
  assert.equal(r.html.includes('استشاري فقط — ليس أمراً'), true);
  // advisory tokens as text chips (whatever the real chain produced)
  for (const [ref, entry] of Object.entries(realAdvisory.profitability_advisory_by_wallet)) {
    assert.equal(r.html.includes(ref), true);
    assert.equal(r.html.includes(entry.profitability_advisory), true);
  }
  // win_rate verbatim (w-A = 2/3 from the real chain)
  const wA = realWalletProfitability.profitability_by_wallet['w-A'];
  assert.equal(r.html.includes(String(wA.profitability_win_rate)), true);
  // simulated badge — the Stage-16 models are simulated:true
  assert.equal(r.html.includes('dash-badge-simulated'), true);
});

test('(5) profit_factor is always null upstream and always renders unavailable; null ratio -> unavailable', () => {
  for (const e of Object.values(realWalletProfitability.profitability_by_wallet)) {
    assert.equal(e.profitability_profit_factor, null, 'upstream invariant');
  }
  const r = renderProfitabilityAdvisoryPanel({
    wallet_profitability: realWalletProfitability, lang: 'en'
  });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  // w-D: one closed win, zero losses -> win_loss_ratio null -> unavailable cell
  const i = r.html.indexOf('<td>w-D</td>');
  assert.equal(i > -1, true);
  const row = r.html.slice(i, r.html.indexOf('</tr>', i));
  assert.equal(row.includes('unavailable'), true);
  // every wallet row must show unavailable for profit_factor (never faked)
  for (const ref of Object.keys(realWalletProfitability.profitability_by_wallet)) {
    const j = r.html.indexOf('<td>' + ref + '</td>');
    const wrow = r.html.slice(j, r.html.indexOf('</tr>', j));
    assert.equal(wrow.includes('unavailable'), true, `${ref} profit_factor must render unavailable`);
  }
});

test('(5) advisory-only input works; neither model -> UNAVAILABLE; non-read-model states -> UNAVAILABLE', () => {
  const advOnly = renderProfitabilityAdvisoryPanel({ copyability_advisory: realAdvisory, lang: 'en' });
  assert.equal(advOnly.render_state, 'DASH_RENDER_OK');

  const none = renderProfitabilityAdvisoryPanel({ lang: 'en' });
  assert.equal(none.render_state, 'DASH_RENDER_UNAVAILABLE');

  const unconf = renderProfitabilityAdvisoryPanel({
    copyability_advisory: evaluateCopyabilityAdvisory(undefined), lang: 'en'
  });
  assert.equal(unconf.render_state, 'DASH_RENDER_UNAVAILABLE');
  assert.equal(unconf.reasons.includes('no_recognized_profitability_model'), true);
});

test('(5) smuggled secret in a wallet entry -> REFUSED + value absent', () => {
  const r = renderProfitabilityAdvisoryPanel({
    wallet_profitability: {
      ...realWalletProfitability,
      profitability_by_wallet: {
        'w-X': { profitability_net: 1, seed_phrase: 'LEAK_DASH_SEED_444' }
      }
    },
    lang: 'en'
  });
  assert.equal(r.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(JSON.stringify(r).includes('LEAK_DASH_SEED_444'), false);
});

// ===========================================================================
// (6) stream health panel
// ===========================================================================

test('(6) gap-exceeded advisory renders a VISIBLE warning that a hide smuggle cannot suppress', () => {
  const r = renderStreamHealthPanel({
    stream_health: realGapExceeded, readiness_checklist: realChecklist,
    lang: 'en', hide: true, collapse: true
  });
  assertDashSafe(r);
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('LIVE_STREAM_HEALTH_GAP_EXCEEDED'), true);
  assert.equal(r.html.includes('dash-warning'), true, 'visible warning block');
  assert.equal(r.html.includes('LIVE_ADVISORY_EXITS_ONLY_SHAPED'), true);
  assert.equal(r.html.includes('<details'), false, 'safety warning is never collapsed');
  assert.equal(r.html.includes(String(realGapExceeded.gap_slots)), true);
});

test('(6) synced stream renders no warning; checklist met / not met / not verified', () => {
  const r = renderStreamHealthPanel({
    stream_health: realSynced, readiness_checklist: realChecklist, lang: 'en'
  });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('dash-warning'), false);
  assert.equal(r.html.includes('LIVE_CHECK_PRIORITY_FEE_CACHE_WARM: met'), true);
  assert.equal(r.html.includes('LIVE_CHECK_RPC_HEALTH_GREEN: not met'), true);
  assert.equal(r.html.includes('LIVE_CHECK_STREAM_SYNCED: not verified'), true);
});

test('(6) checklist-only and stream-only inputs work; neither -> UNAVAILABLE; Arabic labels render', () => {
  const onlyChecklist = renderStreamHealthPanel({ readiness_checklist: realChecklist, lang: 'en' });
  assert.equal(onlyChecklist.render_state, 'DASH_RENDER_OK');
  const onlyStream = renderStreamHealthPanel({ stream_health: realSynced, lang: 'en' });
  assert.equal(onlyStream.render_state, 'DASH_RENDER_OK');
  const none = renderStreamHealthPanel({ lang: 'en' });
  assert.equal(none.render_state, 'DASH_RENDER_UNAVAILABLE');

  const ar = renderStreamHealthPanel({
    stream_health: realGapExceeded, readiness_checklist: realChecklist, lang: 'ar'
  });
  assert.equal(ar.html.includes('تحذير'), true);
  assert.equal(ar.html.includes('غير مستوفى'), true);
  assert.equal(ar.html.includes('لم يُتحقَّق'), true);
});

test('(6) an unknown checklist item shape renders not verified; unrecognized models -> UNAVAILABLE', () => {
  const weird = renderStreamHealthPanel({
    readiness_checklist: {
      read_only: true, live_readiness_state: 'LIVE_READINESS_CHECKLIST',
      checklist: [{ item: 'LIVE_CHECK_SOMETHING', met: 'maybe' }], all_met: false, reasons: []
    },
    lang: 'en'
  });
  assert.equal(weird.render_state, 'DASH_RENDER_OK');
  assert.equal(weird.html.includes('LIVE_CHECK_SOMETHING: not verified'), true);

  const unrecognized = renderStreamHealthPanel({
    stream_health: { read_only: true, stream_health_state: 'SOME_NEW_STATE' }, lang: 'en'
  });
  assert.equal(unrecognized.render_state, 'DASH_RENDER_UNAVAILABLE');
});

// ===========================================================================
// (7) security notices panel
// ===========================================================================

const CRITICAL_TEXT_EN = 'Signer isolation degraded — review immediately';
const CRITICAL_TEXT_AR = 'تدهور عزل الموقّع — راجع فوراً';

test('(7) critical/security notices are ALWAYS visible — hide:true smuggles are ignored', () => {
  const r = renderSecurityNoticesPanel({
    notices: [
      { severity: 'critical', text_en: CRITICAL_TEXT_EN, text_ar: CRITICAL_TEXT_AR, hide: true },
      { severity: 'security', text_en: 'Forbidden surface detected upstream', text_ar: 'سطح محظور', hidden: true }
    ],
    lang: 'en',
    hide: true
  });
  assertDashSafe(r);
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes(CRITICAL_TEXT_EN), true, 'critical text fully visible');
  assert.equal(r.html.includes('Forbidden surface detected upstream'), true);
  assert.equal(r.html.includes('<details'), false, 'critical/security never collapsed');
  assert.equal(r.html.includes('dash-notice-critical'), true);
});

test('(7) info may collapse into a pure details/summary toggle — but stays in the document', () => {
  const r = renderSecurityNoticesPanel({
    notices: [
      { severity: 'info', text_en: 'Routine info line', text_ar: 'سطر معلومات', hide: true },
      { severity: 'critical', text_en: CRITICAL_TEXT_EN, text_ar: CRITICAL_TEXT_AR, hide: true }
    ],
    lang: 'en'
  });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.html.includes('<details'), true, 'info collapsed');
  assert.equal(r.html.includes('Routine info line'), true, 'collapsed info still present');
  const criticalIdx = r.html.indexOf(CRITICAL_TEXT_EN);
  const detailsIdx = r.html.indexOf('<details');
  const detailsEnd = r.html.indexOf('</details>');
  assert.equal(criticalIdx > -1, true);
  assert.equal(criticalIdx < detailsIdx || criticalIdx > detailsEnd, true,
    'critical text must not live inside the collapsed details');
});

test('(7) unknown severity is fail-safe critical; Arabic text selected for ar; XSS escaped', () => {
  const r = renderSecurityNoticesPanel({
    notices: [
      { severity: 'whatever', text_en: 'Unknown severity notice', text_ar: 'تنبيه بشدة مجهولة', hide: true },
      { severity: 'warning', text_en: '<script>alert(1)</script>', text_ar: 'تحذير' }
    ],
    lang: 'ar'
  });
  assert.equal(r.render_state, 'DASH_RENDER_OK');
  assert.equal(r.reasons.includes('unknown_severity_treated_as_critical'), true);
  assert.equal(r.html.includes('تنبيه بشدة مجهولة'), true, 'ar text selected + visible');
  assert.equal(r.html.includes('dash-notice-critical'), true);
  assert.equal(r.html.includes('<details'), false);

  const en = renderSecurityNoticesPanel({
    notices: [{ severity: 'warning', text_en: '<script>alert(1)</script>', text_ar: 'x' }], lang: 'en'
  });
  assert.equal(en.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(en.html.includes('<script'), false);
});

test('(7) notices missing -> UNAVAILABLE; empty -> no notices; planted secret VALUE -> REFUSED + absent', () => {
  const missing = renderSecurityNoticesPanel({ lang: 'en' });
  assert.equal(missing.render_state, 'DASH_RENDER_UNAVAILABLE');

  const empty = renderSecurityNoticesPanel({ notices: [], lang: 'en' });
  assert.equal(empty.render_state, 'DASH_RENDER_OK');
  assert.equal(empty.html.includes('no notices'), true);

  const leak = renderSecurityNoticesPanel({
    notices: [{ severity: 'critical', text_en: 'x', bearer_token: 'LEAK_DASH_BEARER_555' }],
    lang: 'en'
  });
  assert.equal(leak.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(JSON.stringify(leak).includes('LEAK_DASH_BEARER_555'), false);
});

// ===========================================================================
// (8) assembler
// ===========================================================================

function realPanels(lang) {
  return [
    renderDecisionTracePanel({ decision_trace: realTrace, lang }),
    renderPipelineHealthPanel({ pipeline_health: realPipelineHealth, lang }),
    renderPaperPnlPanel({ paper_pnl_read_model: realPaperPnl, lang }),
    renderProfitabilityAdvisoryPanel({
      copyability_advisory: realAdvisory, wallet_profitability: realWalletProfitability, lang
    }),
    renderStreamHealthPanel({ stream_health: realGapExceeded, readiness_checklist: realChecklist, lang }),
    renderSecurityNoticesPanel({
      notices: [{ severity: 'critical', text_en: CRITICAL_TEXT_EN, text_ar: CRITICAL_TEXT_AR }], lang
    })
  ];
}

test('(8) assembles a full static inert document: en -> ltr, ar -> rtl, bilingual footer, inline token CSS', () => {
  const en = assembleOperatorDashboard({ panels: realPanels('en'), lang: 'en', title_ref: 'ops-board-1' });
  assertDashSafe(en);
  assert.equal(en.render_state, 'DASH_RENDER_OK');
  assert.equal(en.html.startsWith('<!DOCTYPE html>'), true);
  assert.equal(en.html.includes('<html lang="en" dir="ltr">'), true);
  assert.equal(en.html.includes('READ-ONLY OPERATOR VIEW — no commands'), true);
  assert.equal(en.html.includes('عرض المشغّل للقراءة فقط — لا أوامر'), true);
  assert.equal(en.html.includes('--dash-color-simulated'), true, 'design-token-named custom properties');
  assert.equal(en.html.includes('ops-board-1'), true);
  assert.equal(en.html.includes(CRITICAL_TEXT_EN), true, 'critical notice carried into the page');
  assert.equal(en.html.includes('dash-warning'), true, 'exits-only-shaped warning carried into the page');

  const ar = assembleOperatorDashboard({ panels: realPanels('ar'), lang: 'ar' });
  assert.equal(ar.render_state, 'DASH_RENDER_OK');
  assert.equal(ar.html.includes('<html lang="ar" dir="rtl">'), true);
  assert.equal(ar.html.includes('محاكاة'), true, 'Arabic SIMULATED badge in the page');
});

test('(8) the assembled page is INERT: no form/button/input/script/fetch/external src/handler attr injection', () => {
  const page = assembleOperatorDashboard({ panels: realPanels('en'), lang: 'en' }).html;
  assert.equal(/<form\b/i.test(page), false, 'no form');
  assert.equal(/<button\b/i.test(page), false, 'no button');
  assert.equal(/<input\b/i.test(page), false, 'no input');
  assert.equal(/<script\b/i.test(page), false, 'no script');
  assert.equal(/<iframe\b|<img\b|<link\b|<a\s/i.test(page), false, 'no embedded/external elements');
  assert.equal(/fetch\s*\(/i.test(page), false, 'no fetch');
  assert.equal(/\bsrc\s*=/i.test(page), false, 'no src= anywhere');
  assert.equal(/javascript:/i.test(page), false, 'no javascript: URL');
});

test('(8) refuses anything that is not a recognized FROZEN render result, and any forbidden panel markup', () => {
  const notFrozen = assembleOperatorDashboard({
    panels: [{ html: '<p>x</p>', render_state: 'DASH_RENDER_OK', reasons: [], read_only: true }],
    lang: 'en'
  });
  assert.equal(notFrozen.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(notFrozen.reasons.includes('panel_not_render_result'), true);

  const realPanel = renderSecurityNoticesPanel({ notices: [], lang: 'en' });
  const tamperedMarkup = Object.freeze({ ...realPanel, html: '<form action="steal"><button>buy</button></form>' });
  const refused = assembleOperatorDashboard({ panels: [tamperedMarkup], lang: 'en' });
  assert.equal(refused.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(refused.reasons.includes('panel_html_forbidden_markup'), true);
  assert.equal(refused.html.includes('<form'), false, 'forbidden markup never reaches the document');

  const flagged = Object.freeze({ ...realPanel, can_send: true });
  const refusedFlag = assembleOperatorDashboard({ panels: [flagged], lang: 'en' });
  assert.equal(refusedFlag.render_state, 'DASH_RENDER_REFUSED');

  const arbitraryObject = assembleOperatorDashboard({ panels: [Object.freeze({ foo: 1 })], lang: 'en' });
  assert.equal(arbitraryObject.render_state, 'DASH_RENDER_REFUSED');
});

test('(8) XSS in title_ref is escaped; endpoint-shaped title_ref is refused and never echoed', () => {
  const xss = assembleOperatorDashboard({
    panels: realPanels('en'), lang: 'en', title_ref: '<script>alert(1)</script>" onerror=alert(2)'
  });
  assert.equal(xss.render_state, 'DASH_RENDER_OK');
  assert.equal(xss.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;&quot; onerror=alert(2)'), true);
  assert.equal(xss.html.includes('<script'), false);

  const endpoint = assembleOperatorDashboard({
    panels: realPanels('en'), lang: 'en', title_ref: 'https://evil.example/exfil'
  });
  assert.equal(endpoint.render_state, 'DASH_RENDER_REFUSED');
  assert.equal(JSON.stringify(endpoint).includes('evil.example'), false);
});

test('(8) lang invalid -> INVALID; panels missing -> UNAVAILABLE; empty panels -> unavailable main', () => {
  const bad = assembleOperatorDashboard({ panels: realPanels('en'), lang: 'de' });
  assert.equal(bad.render_state, 'DASH_RENDER_INVALID');
  assert.equal(bad.reasons.includes('lang_invalid'), true);

  const noPanels = assembleOperatorDashboard({ lang: 'en' });
  assert.equal(noPanels.render_state, 'DASH_RENDER_UNAVAILABLE');
  assert.equal(noPanels.reasons.includes('panels_missing'), true);

  const empty = assembleOperatorDashboard({ panels: [], lang: 'en' });
  assert.equal(empty.render_state, 'DASH_RENDER_OK');
  assert.equal(empty.html.includes('unavailable'), true);
});

// ===========================================================================
// cross-cutting: hostile battery, freeze, leak scan
// ===========================================================================

const ALL_RENDERERS = [
  renderDecisionTracePanel, renderPipelineHealthPanel, renderPaperPnlPanel,
  renderProfitabilityAdvisoryPanel, renderStreamHealthPanel,
  renderSecurityNoticesPanel, assembleOperatorDashboard
];

test('hostile inputs: every renderer returns a frozen error panel and never throws', () => {
  for (const fn of ALL_RENDERERS) {
    for (const h of hostiles()) {
      const r = fn(h);
      assertDashSafe(r);
      assert.notEqual(r.render_state, 'DASH_RENDER_OK');
    }
  }
});

test('deep hostile component: a throwing nested getter fails closed (unavailable), never throws', () => {
  const evil = {};
  Object.defineProperty(evil, 'positions', {
    enumerable: true,
    get() { throw new Error('nested-hostile'); }
  });
  evil.read_only = true;
  evil.paper_pnl_state = 'PAPER_PNL_READ_MODEL';
  evil.simulated = true;
  const r = renderPaperPnlPanel({ paper_pnl_read_model: evil, lang: 'en' });
  assertDashSafe(r);
  assert.equal(r.render_state, 'DASH_RENDER_UNAVAILABLE');
  assert.equal(r.reasons.includes('input_inspection_error'), true);
});

test('no planted VALUE ever appears in any refused result (stringify-wide leak scan)', () => {
  const plants = {
    private_key: 'LEAK_WIDE_PK_777', api_key: 'LEAK_WIDE_API_888',
    endpoint: 'wss://leak.wide/endpoint', secret: 'LEAK_WIDE_SECRET_999'
  };
  const results = [
    renderDecisionTracePanel({ decision_trace: { ...advisoryTraceStandin, ...plants }, lang: 'en' }),
    renderPipelineHealthPanel({ pipeline_health: { ...realPipelineHealth, ...plants }, lang: 'en' }),
    renderPaperPnlPanel({ paper_pnl_read_model: { ...realPaperPnl, ...plants }, lang: 'en' }),
    renderProfitabilityAdvisoryPanel({ wallet_profitability: { ...realWalletProfitability, ...plants }, lang: 'en' }),
    renderStreamHealthPanel({ stream_health: { ...realGapExceeded, ...plants }, lang: 'en' }),
    renderSecurityNoticesPanel({ notices: [{ severity: 'critical', text_en: 'x', ...plants }], lang: 'en' })
  ];
  for (const r of results) {
    assertDashSafe(r);
    assert.equal(r.render_state, 'DASH_RENDER_REFUSED');
    const flat = JSON.stringify(r);
    assert.equal(flat.includes('LEAK_WIDE'), false);
    assert.equal(flat.includes('leak.wide'), false);
  }
});

// ===========================================================================
// static guards
// ===========================================================================

test('static guards: import-free src, no network/clock/RNG/env/fs, no module-level mutable state, candidate discipline', () => {
  const srcPath = fileURLToPath(new URL('../src/operator-dashboard-foundations.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');

  // import-free src (consumes read-model JSON passed in; no dependency)
  assert.equal(/^import\s/m.test(src), false, 'src must be import-free');
  assert.equal(/\brequire\s*\(/.test(src), false);

  // strip comments + string literals, then scan CODE only
  const code = src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

  // no network primitive tokens in code
  assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket|new\s+Connection\s*\(|createConnection|dgram|Socket\s*\(/.test(code), false, 'no network primitive');
  // no clock / RNG / env / fs
  assert.equal(/Date\s*\.\s*now|new\s+Date\b/.test(code), false, 'no clock');
  assert.equal(/Math\s*\.\s*random/.test(code), false, 'no RNG');
  assert.equal(/process\s*\.\s*env/.test(code), false, 'no env');
  assert.equal(/readFileSync|writeFileSync|createReadStream|node:fs/.test(code), false, 'no fs');
  // no module-level mutable state
  assert.equal(/^(let|var)\s/m.test(code), false, 'no module-level let/var');
  // no execution/readiness flag forced true anywhere in code
  for (const f of FORBIDDEN_TRUE_FLAGS) {
    const re = new RegExp(f + String.raw`\s*:\s*true`);
    assert.equal(re.test(code), false, `${f}: true literal must not exist`);
  }
  // candidate_* discipline: ONLY the registered G22 P&L field names of the
  // consumed paper read-model may appear (consumed-only) — zero minted names
  const allowedCandidates = new Set([
    'candidate_realized_pnl', 'candidate_fees_total', 'candidate_slippage_cost',
    'candidate_paper_pnl', 'candidate_unrealized_pnl', 'candidate_mark_status',
    'candidate_pnl_by_wallet', 'candidate_pnl_by_copy_mode', 'candidate_pnl_by_brain'
  ]);
  const codeCandidates = [...new Set(code.match(/candidate_[a-z0-9_]+/g) || [])];
  for (const c of codeCandidates) {
    assert.equal(allowedCandidates.has(c), true, `candidate name ${c} must be consumed-only G22`);
  }
  // SSOT G1 operating_state VALUES never minted as code/string literals
  assert.equal(/['"](WARMING_UP|ACTIVE|EXITS_ONLY|PAUSED|KILLED)['"]/.test(src), false,
    'operating_state values must not appear as literals');
  // no live transport literal anywhere in src
  assert.equal(/https?:\/\/|wss:\/\/|grpc:\/\//.test(src), false, 'no URL literal in src');
});

test('static guards: index.mjs is a bare re-export; package.json declares no dependencies', () => {
  const indexSrc = readFileSync(fileURLToPath(new URL('../src/index.mjs', import.meta.url)), 'utf8');
  assert.equal(indexSrc.trim(), "export * from './operator-dashboard-foundations.mjs';");
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(pkg.name, '@soltrade/operator-dashboard-foundations');
  assert.equal(pkg.version, '0.0.0');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.dependencies, undefined, 'no dependencies');
  assert.equal(pkg.devDependencies, undefined, 'no devDependencies');
});
