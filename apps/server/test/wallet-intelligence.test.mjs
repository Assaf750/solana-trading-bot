// wallet-intelligence.test.mjs — pure copyability assessment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessCopyability } from '../src/engine/wallet-intelligence.mjs';

const dist = (o = {}) => [
  { key: 'gt_500', count: o.gt_500 || 0 }, { key: 'b_200_500', count: o.b_200_500 || 0 },
  { key: 'b_0_200', count: o.b_0_200 || 0 }, { key: 'b_neg50_0', count: o.b_neg50_0 || 0 }, { key: 'lt_neg50', count: o.lt_neg50 || 0 },
];
const stats = (o) => ({ status: 'sufficient', trades_closed: 10, win_rate: 0.6, avg_hold_seconds: 1800, realized_pnl_sol: 5, distinct_tokens: 8, outcome_distribution: dist(o.d), bot_signals: { rapid_flip_ratio: 0, sold_more_than_bought_tokens: 0, ...o.bot }, ...o });

test('copyability: clean profitable swing wallet => copy_allowed / smart_money', () => {
  const r = assessCopyability({ stats: stats({ d: { b_0_200: 6, gt_500: 1, lt_neg50: 1 } }) });
  assert.equal(r.classification, 'smart_money');
  assert.equal(r.tier, 'copy_allowed');
  assert.ok(r.scores.copyability >= 65);
});

test('copyability: fast flipper => sniper, high latency sensitivity, not copy_allowed', () => {
  const r = assessCopyability({ stats: stats({ avg_hold_seconds: 20, bot: { rapid_flip_ratio: 0.3 } }) });
  assert.equal(r.classification, 'sniper');
  assert.ok(r.scores.latency_sensitivity >= 80);
  assert.equal(r.tier, 'degraded'); // latency too high to copy profitably
});

test('copyability: wash trading => banned', () => {
  const r = assessCopyability({ stats: stats({ bot: { rapid_flip_ratio: 0.6 } }) });
  assert.equal(r.flags.wash_trading, true);
  assert.equal(r.tier, 'banned');
});

test('copyability: dev/airdrop dumper => dev_suspect + fake_profit + banned', () => {
  const r = assessCopyability({ stats: stats({ distinct_tokens: 1, bot: { sold_more_than_bought_tokens: 3 } }) });
  assert.equal(r.flags.dev_suspect, true);
  assert.equal(r.flags.fake_profit, true);
  assert.equal(r.tier, 'banned');
  assert.equal(r.profit_source, 'airdrop_or_dump');
});

test('copyability: net-negative clean wallet => degraded', () => {
  const r = assessCopyability({ stats: stats({ win_rate: 0.3, realized_pnl_sol: -2, d: { lt_neg50: 4, b_0_200: 6 } }) });
  assert.equal(r.tier, 'degraded');
});

test('copyability: too few trades => insufficient_data (null scores)', () => {
  const r = assessCopyability({ stats: { status: 'low_confidence', trades_closed: 2, win_rate: 1, realized_pnl_sol: 1, outcome_distribution: dist(), bot_signals: {} } });
  assert.equal(r.tier, 'insufficient_data');
  assert.equal(r.scores.copyability, null);
});

test('copyability: liquidity_compatibility derives from buy-size consistency', () => {
  const events = [{ kind: 'buy', quoteSol: 1, ts: 1 }, { kind: 'buy', quoteSol: 1.1, ts: 2 }, { kind: 'buy', quoteSol: 0.9, ts: 3 }];
  const r = assessCopyability({ stats: stats({ d: { b_0_200: 8 } }), events });
  assert.ok(r.scores.liquidity_compatibility != null && r.scores.liquidity_compatibility > 60); // consistent sizing
  assert.ok(r.typical_trade_sol > 0);
});
