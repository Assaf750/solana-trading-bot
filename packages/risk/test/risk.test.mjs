import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkEntryGates, validateHardRiskLimits, normalizeRiskResult, deriveRiskBudget,
  HARD_RISK_REQUIRED_FIELDS, REJECT_REASON_CODES,
} from '../src/index.mjs';
import { validateEntity } from '../../contracts/src/live-model.mjs';

const FULL_HR = {
  max_daily_loss_pct: 50, max_daily_loss_usdt: 1000, max_total_drawdown_pct: 80, max_open_positions: 5,
  max_position_size_pct: 10, max_token_exposure_pct: 20, max_creator_exposure_pct: 30,
  max_cluster_exposure_pct: 40, max_correlated_meme_exposure_pct: 50,
};
const cfg = (over = {}) => ({ hard_risk: { ...FULL_HR }, execution: { capital_limit: 1000 }, lists: {}, ...over });
const pf = (over = {}) => ({
  openCount: () => 0, tokenExposureUsd: () => 0, leaderExposureUsd: () => 0, dailyRealized: () => 0,
  summary: () => ({ realized_pnl_usd: 0, unrealized_pnl_usd: 0 }), ...over,
});
const base = () => ({ cfg: cfg(), portfolio: pf(), sizeUsd: 10, tokenMint: 'M', killBlocked: false, operatingState: 'ACTIVE' });

test('valid risk passes (allowed, no rejections, not a risk rejection)', () => {
  assert.deepEqual(checkEntryGates(base()), { allowed: true, rejections: [], riskRejection: false });
});

test('same inputs produce same outputs (pure)', () => {
  assert.deepEqual(checkEntryGates(base()), checkEntryGates(base()));
});

test('missing a mandatory limit => fail-closed reject (exact incomplete string)', () => {
  const hr = { ...FULL_HR }; delete hr.max_open_positions;
  const r = checkEntryGates({ ...base(), cfg: cfg({ hard_risk: hr }) });
  assert.equal(r.allowed, false);
  assert.ok(r.rejections.includes('hard_risk_incomplete:max_open_positions'), r.rejections.join(','));
});

test('invalid/corrupt config (no hard_risk, no capital) fails safe', () => {
  const r = checkEntryGates({ ...base(), cfg: { lists: {} } });
  assert.equal(r.allowed, false);
  assert.ok(r.rejections.some((x) => x.startsWith('hard_risk_incomplete:')));
  assert.ok(r.rejections.includes('capital_limit_missing'));
});

test('max position size breach rejects with exact string + riskRejection', () => {
  const r = checkEntryGates({ ...base(), sizeUsd: 200 }); // maxPos = 1000 * 10% = 100
  assert.equal(r.allowed, false);
  assert.ok(r.rejections.includes('position_size_200_exceeds_100'), r.rejections.join(','));
  assert.equal(r.riskRejection, true);
});

test('max token exposure breach rejects (exact string)', () => {
  const r = checkEntryGates({ ...base(), portfolio: pf({ tokenExposureUsd: () => 195 }) }); // 195+10=205 > 200
  assert.ok(r.rejections.includes('token_exposure_205_exceeds_200'), r.rejections.join(','));
  assert.equal(r.riskRejection, true);
});

test('max open positions breach rejects', () => {
  const r = checkEntryGates({ ...base(), portfolio: pf({ openCount: () => 5 }) });
  assert.ok(r.rejections.includes('max_open_positions_reached'));
});

test('creator/leader exposure breach rejects (the wallet/source-concentration cap)', () => {
  const r = checkEntryGates({ ...base(), leaderAddress: 'L', portfolio: pf({ leaderExposureUsd: () => 295 }) }); // 295+10=305 > 300
  assert.ok(r.rejections.includes('creator_exposure_305_exceeds_300'), r.rejections.join(','));
});

test('daily-loss breach rejects (usdt + pct)', () => {
  const r = checkEntryGates({ ...base(), portfolio: pf({ dailyRealized: () => -1000 }) });
  assert.ok(r.rejections.includes('daily_loss_limit_usdt_hit'));
  assert.ok(r.rejections.includes('daily_loss_limit_pct_hit'));
});

test('warning_only EV cannot relax hard-risk: a violation still rejects; EV config is ignored', () => {
  const withWarnEv = { ev_gate: { mode: 'warning_only' }, ev_gate_mode: 'warning_only' };
  const violate = checkEntryGates({ ...base(), sizeUsd: 200, cfg: cfg(withWarnEv) });
  assert.equal(violate.allowed, false);
  assert.ok(violate.rejections.includes('position_size_200_exceeds_100'));
  // and EV config does not change a clean pass either (gate never consults EV)
  assert.deepEqual(checkEntryGates({ ...base(), cfg: cfg(withWarnEv) }), checkEntryGates(base()));
});

test('state blocks (kill/pause/entries-blocked) reject but are NOT risk rejections', () => {
  assert.equal(checkEntryGates({ ...base(), killBlocked: true }).riskRejection, false);
  assert.ok(checkEntryGates({ ...base(), killBlocked: true }).rejections.includes('kill_switch_engaged'));
  assert.ok(checkEntryGates({ ...base(), operatingState: 'PAUSED' }).rejections.includes('operating_state_PAUSED_blocks_entry'));
  assert.ok(checkEntryGates({ ...base(), entriesBlocked: true }).rejections.includes('entries_blocked_daily_loss'));
});

test('token allow/deny lists are policy blocks, not risk rejections', () => {
  const bl = checkEntryGates({ ...base(), cfg: cfg({ lists: { token_blacklist: ['M'] } }) });
  assert.ok(bl.rejections.includes('token_blacklisted'));
  assert.equal(bl.riskRejection, false);
  const wl = checkEntryGates({ ...base(), cfg: cfg({ lists: { token_whitelist: ['OTHER'] } }) });
  assert.ok(wl.rejections.includes('token_not_whitelisted'));
});

// ---- additive surface ----
test('validateHardRiskLimits: complete vs incomplete', () => {
  assert.deepEqual(validateHardRiskLimits(cfg()), { ok: true, missing: [] });
  const r = validateHardRiskLimits({ hard_risk: {} });
  assert.equal(r.ok, false);
  assert.equal(r.missing.length, 9);
  assert.equal(HARD_RISK_REQUIRED_FIELDS.length, 9);
});

test('normalizeRiskResult: fail-closed normalization', () => {
  assert.deepEqual(normalizeRiskResult({ allowed: true, rejections: [], riskRejection: false }), { allowed: true, rejections: [], riskRejection: false });
  assert.deepEqual(normalizeRiskResult(null), { allowed: false, rejections: ['invalid_risk_result'], riskRejection: false });
  assert.equal(normalizeRiskResult({ allowed: true, rejections: ['x'] }).allowed, false);
});

test('deriveRiskBudget: produces a contracts-valid RiskBudget; fail-closed without a cap', () => {
  const b = deriveRiskBudget({ cfg: cfg(), portfolio: pf({ tokenExposureUsd: () => 50 }), sizeUsd: 10, tokenMint: 'M' });
  assert.equal(validateEntity('RiskBudget', b).ok, true, JSON.stringify(b));
  assert.equal(b.max_notional_usd, 200);
  assert.equal(b.within_budget, true); // 50+10 <= 200
  const noCap = deriveRiskBudget({ cfg: { execution: { capital_limit: 1000 }, hard_risk: {} }, portfolio: pf(), sizeUsd: 10, tokenMint: 'M' });
  assert.equal(noCap.within_budget, false); // unknown cap => fail-closed
});

test('REJECT_REASON_CODES exposes the static codes', () => {
  for (const c of ['kill_switch_engaged', 'capital_limit_missing', 'max_open_positions_reached']) {
    assert.ok(REJECT_REASON_CODES.includes(c), c);
  }
});
