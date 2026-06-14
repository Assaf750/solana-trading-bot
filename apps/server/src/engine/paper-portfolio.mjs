// paper-portfolio.mjs — simulated portfolio: positions, FIFO trades, realized/unrealized
// P&L, daily loss tracking. ALWAYS labeled simulated. Persisted (atomic writes).
import { readJson, writeJson, newId, nowIso } from '../util.mjs';

const DEFAULT_FILE = 'paper-portfolio.json';

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

  function recordEntry({ leader_address, wallet_id, token_mint, qty_ui, decimals, cost_usd, fee_usd_est, price_impact_pct, copy_mode, tp_pct, sl_pct }) {
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
    if (f >= 1 || p.qty_ui <= 0) {
      p.position_state = 'CLOSED';
      p.qty_ui = 0; p.cost_usd = 0;
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
    save(s);
  }

  function setEntriesBlocked(blocked) {
    const s = load();
    s.daily.entries_blocked = Boolean(blocked);
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
    recordEntry, recordExit, setMark, setEntriesBlocked, summary,
  };
}

function round2(n) { return Math.round(n * 100) / 100; }
