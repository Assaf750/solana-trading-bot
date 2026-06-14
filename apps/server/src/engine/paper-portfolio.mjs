// paper-portfolio.mjs — simulated portfolio: positions, FIFO trades, realized/unrealized
// P&L, daily loss tracking. ALWAYS labeled simulated. Persisted (atomic writes).
import { readJson, writeJson, newId, nowIso } from '../util.mjs';

const DEFAULT_FILE = 'paper-portfolio.json';
const MARK_HISTORY_MAX = 48; // bounded per-position mark series for real (non-synthetic) charts

const EMPTY = {
  simulated: true,
  positions: [], // {position_id, leader_address, wallet_id, token_mint, qty_ui, decimals, cost_usd, entry_price_usd, entry_ts, position_state, copy_mode, tp_pct, sl_pct, mark_usd, mark_ts, mark_status}
  trades: [],    // {trade_id, position_id, side, token_mint, qty_ui, price_usd, value_usd, fee_usd_est, price_impact_pct, ts, reason, simulated:true}
  realized_pnl_usd: 0,
  daily: { date: null, realized_pnl_usd: 0, entries_blocked: false },
};

export function createPaperPortfolio({ file = DEFAULT_FILE, simulated = true } = {}) {
  const FILE = file;
  function load() {
    const v = readJson(FILE, null).value || { ...structuredClone(EMPTY), simulated };
    v.simulated = simulated;
    const today = new Date().toISOString().slice(0, 10);
    if (v.daily?.date !== today) v.daily = { date: today, realized_pnl_usd: 0, entries_blocked: false };
    return v;
  }
  function save(s) { writeJson(FILE, s); }

  function state() { return load(); }

  function openPositions() { return load().positions.filter((p) => p.position_state === 'OPEN'); }

  function tokenExposureUsd(mint) {
    return openPositions().filter((p) => p.token_mint === mint)
      .reduce((a, p) => a + (p.mark_usd ?? p.cost_usd), 0);
  }

  // open exposure to all positions copied from one leader (creator/source-concentration proxy)
  function leaderExposureUsd(leader) {
    return openPositions().filter((p) => p.leader_address === leader)
      .reduce((a, p) => a + (p.mark_usd ?? p.cost_usd), 0);
  }

  function openCount() { return openPositions().length; }

  function dailyRealized() { return load().daily.realized_pnl_usd; }

  function recordEntry({ leader_address, wallet_id, token_mint, qty_ui, decimals, cost_usd, fee_usd_est, price_impact_pct, copy_mode, tp_pct, sl_pct, intent_id = null }) {
    const s = load();
    const position = {
      position_id: newId('pos'),
      leader_address, wallet_id, token_mint,
      qty_ui, decimals,
      cost_usd, entry_price_usd: qty_ui > 0 ? cost_usd / qty_ui : 0,
      entry_ts: nowIso(),
      position_state: 'OPEN',
      copy_mode, tp_pct, sl_pct,
      mark_usd: cost_usd, mark_ts: nowIso(), mark_status: 'valid',
      mark_history: [Math.round(cost_usd * 1e6) / 1e6], // seed the real mark series with the entry value
      intent_id, // live intent that opened this position (for SENT_UNCONFIRMED reconciliation)
      simulated,
    };
    s.positions.push(position);
    s.trades.push({
      trade_id: newId('trd'), position_id: position.position_id, side: 'buy', token_mint,
      qty_ui, price_usd: position.entry_price_usd, value_usd: cost_usd,
      fee_usd_est, price_impact_pct, ts: nowIso(), reason: 'leader_buy_copied', simulated,
    });
    save(s);
    return position;
  }

  /** Sell a fraction (0..1] of a position at a quoted USD value for that fraction. */
  function recordExit({ position_id, fraction = 1, proceeds_usd, fee_usd_est, price_impact_pct, reason }) {
    const s = load();
    const p = s.positions.find((x) => x.position_id === position_id && x.position_state === 'OPEN');
    if (!p) return { ok: false, error: 'position_not_open' };
    // reject a non-finite payout — a NaN realized would permanently poison lifetime + daily P&L
    // (persisted) and silently disable the daily-loss circuit breaker (NaN >= cap is always false).
    if (!Number.isFinite(proceeds_usd)) return { ok: false, error: 'invalid_proceeds' };
    const f = Math.min(1, Math.max(0, fraction));
    const qtySold = p.qty_ui * f;
    const costPart = p.cost_usd * f;
    const realized = proceeds_usd - costPart - (fee_usd_est || 0);
    p.qty_ui -= qtySold;
    p.cost_usd -= costPart;
    p.realized_usd = (p.realized_usd || 0) + realized; // per-position net P&L (sums partials) for leader stats
    if (f >= 1 || p.qty_ui <= 0) {
      p.position_state = 'CLOSED';
      p.qty_ui = 0; p.cost_usd = 0;
      p.closed_at = nowIso();
    } else if (Number.isFinite(p.mark_usd) && p.mark_status === 'valid') {
      // partial exit: shrink the mark to the remaining quantity so unrealized P&L isn't inflated
      // in the window before the next markPass re-quotes the position. Only rescale a VALID mark —
      // scaling a stale ('unavailable') mark would compound an already-untrustworthy figure.
      p.mark_usd *= (1 - f);
      p.mark_ts = nowIso();
    }
    s.realized_pnl_usd += realized;
    s.daily.realized_pnl_usd += realized;
    s.trades.push({
      trade_id: newId('trd'), position_id, side: 'sell', token_mint: p.token_mint,
      qty_ui: qtySold, price_usd: qtySold > 0 ? proceeds_usd / qtySold : 0, value_usd: proceeds_usd,
      fee_usd_est, price_impact_pct, ts: nowIso(), reason, simulated,
    });
    save(s);
    return { ok: true, realized_usd: realized, closed: p.position_state === 'CLOSED' };
  }

  function setMark(position_id, mark_usd, mark_status = 'valid') {
    const s = load();
    const p = s.positions.find((x) => x.position_id === position_id);
    if (!p) return;
    p.mark_usd = mark_usd;
    p.mark_ts = nowIso();
    p.mark_status = mark_status;
    // append only REAL (valid, finite) marks to the history -> the UI draws a true price line,
    // not a synthetic seeded one. Stale ('unavailable') quotes are skipped to avoid flat noise.
    if (mark_status === 'valid' && Number.isFinite(mark_usd)) {
      p.mark_history = [...(p.mark_history || []), Math.round(mark_usd * 1e6) / 1e6].slice(-MARK_HISTORY_MAX);
      // track the highest P&L % seen (size-independent) — drives the trailing stop, survives restarts.
      if (p.cost_usd > 0) {
        const pct = (mark_usd - p.cost_usd) / p.cost_usd * 100;
        p.peak_pnl_pct = Math.max(p.peak_pnl_pct ?? pct, pct);
      }
    }
    save(s);
  }

  /** Mark a position as needing manual reconciliation (e.g. a confirmed on-chain exit whose
   *  real proceeds couldn't be read). Keeps it out of the auto TP/SL loop; never fabricates P&L. */
  function flagNeedsReconciliation(position_id, reason) {
    const s = load();
    const p = s.positions.find((x) => x.position_id === position_id);
    if (!p) return { ok: false, error: 'position_not_found' };
    p.needs_reconciliation = reason || true;
    p.mark_ts = nowIso();
    save(s);
    return { ok: true };
  }

  /** Resolve a needs_reconciliation position with the operator's REAL proceeds (read from an
   *  explorer): books realized P&L (so the daily-loss breaker sees it), closes the position,
   *  and clears the flag — the only path that retires a flagged position into the books. */
  function resolveReconciliation(position_id, proceeds_usd) {
    const s = load();
    const p = s.positions.find((x) => x.position_id === position_id && x.position_state === 'OPEN');
    if (!p) return { ok: false, error: 'position_not_open' };
    if (!p.needs_reconciliation) return { ok: false, error: 'not_flagged' };
    if (!Number.isFinite(proceeds_usd) || proceeds_usd < 0) return { ok: false, error: 'invalid_proceeds' };
    const realized = proceeds_usd - p.cost_usd;
    const qtySold = p.qty_ui;
    s.trades.push({
      trade_id: newId('trd'), position_id, side: 'sell', token_mint: p.token_mint,
      qty_ui: qtySold, price_usd: qtySold > 0 ? proceeds_usd / qtySold : 0, value_usd: proceeds_usd,
      fee_usd_est: 0, price_impact_pct: 0, ts: nowIso(), reason: 'manual_reconciliation', simulated,
    });
    s.realized_pnl_usd += realized;
    s.daily.realized_pnl_usd += realized;
    p.realized_usd = (p.realized_usd || 0) + realized;
    p.position_state = 'CLOSED';
    p.qty_ui = 0; p.cost_usd = 0;
    p.closed_at = nowIso();
    delete p.needs_reconciliation;
    save(s);
    return { ok: true, realized_usd: realized, closed: true };
  }

  /** Realized-history stats for one leader, from this book's CLOSED positions (each carries its
   *  net realized_usd). Feeds the EV quality gate. profit_factor = Infinity when there are no losses. */
  function leaderStats(leader) {
    const closed = load().positions.filter(
      (p) => p.leader_address === leader && p.position_state === 'CLOSED' && Number.isFinite(p.realized_usd),
    );
    const rs = closed.map((p) => p.realized_usd);
    const n = rs.length;
    const wins = rs.filter((x) => x > 0);
    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = -rs.filter((x) => x < 0).reduce((a, b) => a + b, 0);
    const total = rs.reduce((a, b) => a + b, 0);
    return {
      trades: n,
      wins: wins.length,
      total_realized: total,
      avg_realized: n ? total / n : 0,
      gross_profit: grossProfit,
      gross_loss: grossLoss,
      profit_factor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
      win_rate: n ? wins.length / n : 0,
    };
  }

  /** Count of the leader's most-recent CONSECUTIVE losing closed positions (auto-pause trigger). */
  function leaderConsecutiveLosses(leader) {
    const closed = load().positions
      .filter((p) => p.leader_address === leader && p.position_state === 'CLOSED' && p.closed_at && Number.isFinite(p.realized_usd))
      .sort((a, b) => (a.closed_at < b.closed_at ? 1 : -1)); // newest first
    let n = 0;
    for (const p of closed) { if (p.realized_usd < 0) n += 1; else break; }
    return n;
  }

  function setEntriesBlocked(blocked) {
    const s = load();
    s.daily.entries_blocked = Boolean(blocked);
    save(s);
  }

  /** Record that a position's first-tier partial take-profit has fired (drives break-even + dedupe). */
  function markTp1Done(position_id) {
    const s = load();
    const p = s.positions.find((x) => x.position_id === position_id);
    if (!p) return;
    p.tp1_done = true;
    save(s);
  }

  function summary() {
    const s = load();
    const open = s.positions.filter((p) => p.position_state === 'OPEN');
    const unrealized = open.reduce((a, p) => a + ((p.mark_status === 'valid' ? p.mark_usd : p.cost_usd) - p.cost_usd), 0);
    return {
      simulated,
      open_positions: open.length,
      realized_pnl_usd: round2(s.realized_pnl_usd),
      unrealized_pnl_usd: round2(unrealized),
      daily_realized_pnl_usd: round2(s.daily.realized_pnl_usd),
      entries_blocked: s.daily.entries_blocked,
      trade_count: s.trades.length,
    };
  }

  return {
    state, openPositions, openCount, tokenExposureUsd, leaderExposureUsd, dailyRealized,
    leaderStats, leaderConsecutiveLosses,
    recordEntry, recordExit, setMark, setEntriesBlocked, markTp1Done, flagNeedsReconciliation, resolveReconciliation, summary,
  };
}

function round2(n) { return Math.round(n * 100) / 100; }
