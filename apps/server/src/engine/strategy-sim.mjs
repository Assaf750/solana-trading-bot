// strategy-sim.mjs — PURE, deterministic strategy preview. Reuses the EXACT exit-decision
// functions the live money path uses (exit-rules.mjs) and mirrors the paper-engine markPass
// exit ORDER, so the preview never drifts from real behavior. It does NOT use or invent market
// data: it walks an explicitly-hypothetical P&L%-over-time path (a scenario the operator picks,
// like a what-if calculator) and reports exactly what the engine's exit logic would do on it.
//
// All values are P&L percentages of the original cost (size-independent), matching exit-rules.
import { trailingStopHit, firstTierHit, breakevenStopHit } from './exit-rules.mjs';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

/**
 * Walk a P&L%-over-time path applying the engine's exit order:
 *   1) trailing stop (full)  2) break-even after tp1 (full)
 *   3) first-tier partial TP (once)  4) full TP (full)  5) full SL (full)
 * Partial TP1 sells tp1_sell_pct of the REMAINING position and arms break-even (tp1_done),
 * exactly as performExit/markTp1Done do. One exit action per tick.
 *
 * @param {object} strategy  copy_defaults-shaped: take_profit_pct, stop_loss_pct,
 *                           trailing_stop_pct, tp1_pct, tp1_sell_pct, breakeven_after_tp1
 * @param {number[]} pricePath  P&L% of cost at each tick (e.g. [0, 12, 30, ...])
 * @returns {{
 *   events: Array<{i:number, pnl_pct:number, action:string, reason:string, fraction:number, realized_pct:number, remaining:number}>,
 *   equity_curve: number[],     // marked equity (realized + remaining*pnl) at each tick, % of cost
 *   realized_pct: number,       // banked P&L %, weighted by fraction sold
 *   remaining: number,          // open fraction left at the end (0 = fully exited)
 *   marked_pct: number,         // realized + remaining*final pnl (total mark-to-market %)
 *   closed: boolean,
 *   exit_reason: string|null,   // the reason that fully closed it, if any
 *   final_pnl_pct: number|null
 * }}
 */
export function simulateStrategy({ strategy = {}, pricePath = [] } = {}) {
  const tp = num(strategy.take_profit_pct ?? strategy.tp_pct);
  const sl = num(strategy.stop_loss_pct ?? strategy.sl_pct);
  const trailingPct = num(strategy.trailing_stop_pct);
  const tp1Pct = num(strategy.tp1_pct);
  const tp1SellRaw = num(strategy.tp1_sell_pct);
  const tp1SellFrac = Number.isFinite(tp1SellRaw) && tp1SellRaw > 0 ? Math.min(1, Math.max(0.01, tp1SellRaw / 100)) : 0.5;
  const breakevenAfterTp1 = strategy.breakeven_after_tp1 === true;

  let remaining = 1;
  let realized = 0;
  let peak = NaN;
  let tp1Done = false;
  let exitReason = null;
  let finalPnl = null;
  const events = [];
  const equity = [];

  const bankFull = (i, pnlPct, reason) => {
    realized += remaining * pnlPct;
    events.push({ i, pnl_pct: round(pnlPct), action: 'exit_full', reason, fraction: round(remaining), realized_pct: round(realized), remaining: 0 });
    remaining = 0;
    exitReason = reason;
  };

  for (let i = 0; i < pricePath.length; i++) {
    const pnlPct = num(pricePath[i]);
    if (!Number.isFinite(pnlPct)) continue;
    finalPnl = pnlPct;
    peak = Math.max(Number.isFinite(peak) ? peak : pnlPct, pnlPct);
    equity.push(round(realized + remaining * pnlPct));
    if (remaining <= 0) continue; // already closed — equity stays flat at realized

    // 1) trailing stop — full exit
    if (trailingStopHit({ pnlPct, peakPct: peak, trailingPct })) { bankFull(i, pnlPct, 'trailing_stop_hit'); continue; }
    // 2) break-even stop on the moonbag (only after tp1 banked) — full exit
    if (breakevenStopHit({ pnlPct, tp1Done, breakevenAfterTp1 })) { bankFull(i, pnlPct, 'breakeven_stop'); continue; }
    // 3) first-tier partial TP — sell a fraction of remaining, arm break-even, one action this tick
    if (firstTierHit({ pnlPct, tp1Pct, done: tp1Done })) {
      const sold = remaining * tp1SellFrac;
      realized += sold * pnlPct;
      remaining -= sold;
      const closedByTier = remaining <= 1e-9;
      if (closedByTier) { remaining = 0; exitReason = 'take_profit_tier1'; }
      else { tp1Done = true; } // arms break-even, mirrors markTp1Done (only when it still rides)
      events.push({ i, pnl_pct: round(pnlPct), action: closedByTier ? 'exit_full' : 'partial_tp', reason: 'take_profit_tier1', fraction: round(sold), realized_pct: round(realized), remaining: round(remaining) });
      continue;
    }
    // 4) full take-profit
    if (Number.isFinite(tp) && pnlPct >= tp) { bankFull(i, pnlPct, 'take_profit_hit'); continue; }
    // 5) full stop-loss
    if (Number.isFinite(sl) && pnlPct <= -sl) { bankFull(i, pnlPct, 'stop_loss_hit'); continue; }
  }

  const closed = remaining <= 0;
  const marked = realized + (closed ? 0 : remaining * (Number.isFinite(finalPnl) ? finalPnl : 0));
  return {
    events,
    equity_curve: equity,
    realized_pct: round(realized),
    remaining: round(remaining),
    marked_pct: round(marked),
    closed,
    exit_reason: exitReason,
    final_pnl_pct: Number.isFinite(finalPnl) ? round(finalPnl) : null,
  };
}

function round(v) { return Math.round(v * 100) / 100; }

// ---- Hypothetical scenarios (NOT market data) ------------------------------------------------
// Each returns a deterministic P&L%-over-time path the operator can preview a strategy against.
// Reproducible (no randomness): a fixed shape labelled by what it represents.
function ramp(from, to, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(from + (to - from) * (i / (n - 1)));
  return out;
}

export const SCENARIOS = {
  steady_climb: { label: 'Steady climb to +80%', build: () => ramp(0, 80, 40) },
  pump_then_dump: { label: 'Pump to +120% then dump to -40%', build: () => [...ramp(0, 120, 18), ...ramp(115, -40, 22)] },
  moon: { label: 'Moonshot to +300%', build: () => ramp(0, 300, 40) },
  slow_bleed: { label: 'Slow bleed to -50%', build: () => ramp(0, -50, 40) },
  instant_rug: { label: 'Instant rug (-92%)', build: () => [0, -25, -55, -78, -88, -92, -94, -95] },
  // choppy uptrend: deterministic drift + oscillation (no RNG), nets to ~+60%
  choppy_up: { label: 'Choppy uptrend (~+60%, volatile)', build: () => {
    const out = [];
    for (let i = 0; i < 40; i++) out.push(round((60 * i) / 39 + 18 * Math.sin(i / 1.7)));
    return out;
  } },
};

export function listScenarios() {
  return Object.entries(SCENARIOS).map(([key, s]) => ({ key, label: s.label }));
}

/** Run a named scenario through simulateStrategy. Throws on unknown scenario. */
export function runScenario({ strategy, scenario } = {}) {
  const s = SCENARIOS[scenario];
  if (!s) return { ok: false, error: 'unknown_scenario' };
  const path = s.build();
  return { ok: true, scenario, label: s.label, price_path: path.map(round), result: simulateStrategy({ strategy, pricePath: path }) };
}
