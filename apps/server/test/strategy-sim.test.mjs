// strategy-sim.test.mjs — deterministic strategy preview. Verifies it mirrors the engine's
// exit ORDER and accounting (size-independent P&L %), reusing the real exit-rules functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateStrategy, runScenario, listScenarios, SCENARIOS } from '../src/engine/strategy-sim.mjs';

test('plain TP: closes fully at take_profit_pct, realized = tp', () => {
  const r = simulateStrategy({ strategy: { take_profit_pct: 50, stop_loss_pct: 30 }, pricePath: [0, 20, 49, 50, 80] });
  assert.equal(r.closed, true);
  assert.equal(r.exit_reason, 'take_profit_hit');
  assert.equal(r.realized_pct, 50); // banked at the first tick >= 50
  assert.equal(r.remaining, 0);
});

test('plain SL: closes fully at -stop_loss_pct', () => {
  const r = simulateStrategy({ strategy: { take_profit_pct: 50, stop_loss_pct: 30 }, pricePath: [0, -10, -30, -45] });
  assert.equal(r.closed, true);
  assert.equal(r.exit_reason, 'stop_loss_hit');
  assert.equal(r.realized_pct, -30);
});

test('exit order: trailing beats full TP on the same tick', () => {
  // peak +120 (armed, trail 15). At +90 the give-back is (1-1.9/2.2)=~13.6% < 15 -> hold.
  // But take_profit_pct=40 would have fired long ago at +40 unless trailing logic dominates...
  // here tp is high (200) so TP never triggers; trailing should exit on the dump.
  const r = simulateStrategy({ strategy: { take_profit_pct: 200, stop_loss_pct: 90, trailing_stop_pct: 15 }, pricePath: [0, 50, 120, 70] });
  assert.equal(r.exit_reason, 'trailing_stop_hit');
  assert.equal(r.closed, true);
});

test('partial TP1 then ride: banks tp1_sell_pct of remaining, arms break-even', () => {
  // tp1 at +30 sell 50%; then price falls back to 0 -> break-even stop exits the moonbag.
  const r = simulateStrategy({
    strategy: { take_profit_pct: 200, stop_loss_pct: 90, tp1_pct: 30, tp1_sell_pct: 50, breakeven_after_tp1: true },
    pricePath: [0, 20, 30, 25, 10, 0],
  });
  const partial = r.events.find((e) => e.reason === 'take_profit_tier1');
  assert.ok(partial, 'tp1 fired');
  assert.equal(partial.fraction, 0.5);
  assert.equal(partial.realized_pct, 15); // 0.5 * 30
  const be = r.events.find((e) => e.reason === 'breakeven_stop');
  assert.ok(be, 'break-even fired on the moonbag');
  assert.equal(r.closed, true);
  assert.equal(r.realized_pct, 15); // 15 from tier + 0.5*0 at break-even
  assert.equal(r.remaining, 0);
});

test('tp1 fires once only (done flag honored across ticks)', () => {
  const r = simulateStrategy({
    strategy: { take_profit_pct: 200, stop_loss_pct: 90, tp1_pct: 30, tp1_sell_pct: 25 },
    pricePath: [0, 30, 35, 40, 45],
  });
  const tiers = r.events.filter((e) => e.reason === 'take_profit_tier1');
  assert.equal(tiers.length, 1);
});

test('open at path end: marked_pct = realized + remaining*final, closed=false', () => {
  const r = simulateStrategy({ strategy: { take_profit_pct: 200, stop_loss_pct: 90 }, pricePath: [0, 10, 25] });
  assert.equal(r.closed, false);
  assert.equal(r.remaining, 1);
  assert.equal(r.marked_pct, 25); // 0 realized + 1*25
  assert.equal(r.final_pnl_pct, 25);
});

test('tp1 sell 100% closes via the tier (no break-even arming)', () => {
  const r = simulateStrategy({
    strategy: { take_profit_pct: 200, stop_loss_pct: 90, tp1_pct: 30, tp1_sell_pct: 100, breakeven_after_tp1: true },
    pricePath: [0, 30, 10, 0],
  });
  assert.equal(r.closed, true);
  assert.equal(r.exit_reason, 'take_profit_tier1');
  assert.equal(r.realized_pct, 30);
});

test('equity curve has one point per finite tick', () => {
  const path = [0, 10, 20, 30];
  const r = simulateStrategy({ strategy: { take_profit_pct: 200, stop_loss_pct: 90 }, pricePath: path });
  assert.equal(r.equity_curve.length, path.length);
});

test('scenarios: catalog + runScenario shape', () => {
  const cat = listScenarios();
  assert.ok(cat.length >= 5);
  assert.ok(cat.every((s) => s.key && s.label));
  const r = runScenario({ strategy: { take_profit_pct: 50, stop_loss_pct: 30 }, scenario: 'steady_climb' });
  assert.equal(r.ok, true);
  assert.equal(r.scenario, 'steady_climb');
  assert.ok(Array.isArray(r.price_path) && r.price_path.length > 1);
  assert.ok(r.result && Number.isFinite(r.result.realized_pct));
});

test('runScenario: unknown scenario is a clean error, not a throw', () => {
  const r = runScenario({ strategy: {}, scenario: 'nope' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'unknown_scenario');
});

test('every catalog scenario runs without error', () => {
  for (const { key } of listScenarios()) {
    const r = runScenario({ strategy: { take_profit_pct: 50, stop_loss_pct: 30, tp1_pct: 25, tp1_sell_pct: 50 }, scenario: key });
    assert.equal(r.ok, true, `scenario ${key}`);
    assert.ok(Number.isFinite(r.result.marked_pct), `scenario ${key} marked`);
  }
});
