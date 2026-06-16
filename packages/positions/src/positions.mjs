// @soltrade/positions — position lifecycle + portfolio book (ADR-0001 Phase 2B).
// The legacy-named methods (recordEntry/recordExit/setMark/summary/...) are a byte-for-byte port of
// apps/server engine/paper-portfolio.mjs so the server delegates with zero behaviour change. The
// canonical aliases (createPosition/applyFill/closePosition/updatePositionMark/...) are the
// forward-looking surface and fail closed on a corrupt store. The Node crypto module is NOT used
// here (id/time helpers are injected by the host), keeping the mechanism-guard confinement intact.
import { POSITION_STATE } from '../../ssot-types/src/core-enums.mjs';
import { deriveExitPlan } from './exit-rules.mjs';

const MARK_HISTORY_MAX = 48;

const EMPTY = {
  simulated: true,
  positions: [],
  trades: [],
  realized_pnl_usd: 0,
  daily: { date: null, realized_pnl_usd: 0, entries_blocked: false },
};

// Canonical POSITION_STATE transitions (fail-closed). The current book only uses OPEN->CLOSED, but
// validatePositionTransition covers the full SSOT lifecycle for forward code.
const POSITION_TRANSITIONS = Object.freeze({
  OPENING: ['OPEN', 'FAILED_ENTRY'],
  OPEN: ['PARTIALLY_EXITING', 'EXIT_PENDING', 'MIRROR_SELL_PENDING', 'MIGRATION_PENDING', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  PARTIALLY_EXITING: ['OPEN', 'EXIT_PENDING', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  EXIT_PENDING: ['OPEN', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  MIRROR_SELL_PENDING: ['OPEN', 'CLOSED', 'CLOSED_WITH_DUST', 'FAILED_EXIT'],
  MIGRATION_PENDING: ['OPEN', 'CLOSED', 'FAILED_EXIT'],
  CLOSED: [],
  CLOSED_WITH_DUST: [],
  FAILED_ENTRY: [],
  FAILED_EXIT: [],
});

export function validatePositionTransition(from, to) {
  if (!POSITION_STATE.includes(from)) return { ok: false, error: `unknown_from_state:${from}` };
  if (!POSITION_STATE.includes(to)) return { ok: false, error: `unknown_to_state:${to}` };
  if (!(POSITION_TRANSITIONS[from] || []).includes(to)) return { ok: false, error: `illegal_transition:${from}->${to}` };
  return { ok: true };
}

function round2(n) { return Math.round(n * 100) / 100; }

export function createPositionsBook({ store, newId, nowIso, simulated = true } = {}) {
  if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
    throw new Error('positions_book_requires_store');
  }
  if (typeof newId !== 'function' || typeof nowIso !== 'function') {
    throw new Error('positions_book_requires_id_and_time');
  }

  function load() {
    const v = store.read().value || { ...structuredClone(EMPTY), simulated };
    v.simulated = simulated;
    const today = nowIso().slice(0, 10);
    if (v.daily?.date !== today) v.daily = { date: today, realized_pnl_usd: 0, entries_blocked: false };
    return v;
  }
  function save(s) { store.write(s); }
  function isCorrupt() { return !!store.read().corrupt; }

  function state() { return load(); }
  function openPositions() { return load().positions.filter((p) => p.position_state === 'OPEN'); }

  function tokenExposureUsd(mint) {
    return openPositions().filter((p) => p.token_mint === mint)
      .reduce((a, p) => a + (p.mark_usd ?? p.cost_usd), 0);
  }
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
      mark_history: [Math.round(cost_usd * 1e6) / 1e6],
      intent_id,
      entry_fee_usd: simulated ? (fee_usd_est || 0) : 0,
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

  function recordExit({ position_id, fraction = 1, proceeds_usd, fee_usd_est, price_impact_pct, reason }) {
    const s = load();
    const p = s.positions.find((x) => x.position_id === position_id && x.position_state === 'OPEN');
    if (!p) return { ok: false, error: 'position_not_open' };
    if (!Number.isFinite(proceeds_usd)) return { ok: false, error: 'invalid_proceeds' };
    const f = Math.min(1, Math.max(0, fraction));
    const qtySold = p.qty_ui * f;
    const costPart = p.cost_usd * f;
    const entryFeePart = (p.entry_fee_usd || 0) * f;
    const realized = proceeds_usd - costPart - (fee_usd_est || 0) - entryFeePart;
    p.qty_ui -= qtySold;
    p.cost_usd -= costPart;
    p.entry_fee_usd = (p.entry_fee_usd || 0) - entryFeePart;
    p.realized_usd = (p.realized_usd || 0) + realized;
    if (f >= 1 || p.qty_ui <= 0) {
      p.position_state = 'CLOSED';
      p.qty_ui = 0; p.cost_usd = 0; p.entry_fee_usd = 0;
      p.closed_at = nowIso();
    } else if (Number.isFinite(p.mark_usd) && p.mark_status === 'valid') {
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
    if (mark_status === 'valid' && Number.isFinite(mark_usd)) {
      p.mark_history = [...(p.mark_history || []), Math.round(mark_usd * 1e6) / 1e6].slice(-MARK_HISTORY_MAX);
      if (p.cost_usd > 0) {
        const pct = (mark_usd - p.cost_usd) / p.cost_usd * 100;
        p.peak_pnl_pct = Math.max(p.peak_pnl_pct ?? pct, pct);
      }
    }
    save(s);
  }

  function flagNeedsReconciliation(position_id, reason) {
    const s = load();
    const p = s.positions.find((x) => x.position_id === position_id);
    if (!p) return { ok: false, error: 'position_not_found' };
    p.needs_reconciliation = reason || true;
    p.mark_ts = nowIso();
    save(s);
    return { ok: true };
  }

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

  function leaderConsecutiveLosses(leader) {
    const closed = load().positions
      .filter((p) => p.leader_address === leader && p.position_state === 'CLOSED' && p.closed_at && Number.isFinite(p.realized_usd))
      .sort((a, b) => (a.closed_at < b.closed_at ? 1 : -1));
    let n = 0;
    for (const p of closed) { if (p.realized_usd < 0) n += 1; else break; }
    return n;
  }

  function setEntriesBlocked(blocked) {
    const s = load();
    s.daily.entries_blocked = Boolean(blocked);
    save(s);
  }

  function markTp1Done(position_id) {
    const s = load();
    const p = s.positions.find((x) => x.position_id === position_id);
    if (!p) return;
    p.tp1_done = true;
    save(s);
  }

  function unrealizedFor(p) { return (p.mark_status === 'valid' ? p.mark_usd : p.cost_usd) - p.cost_usd; }

  function summary() {
    const s = load();
    const open = s.positions.filter((p) => p.position_state === 'OPEN');
    const unrealized = open.reduce((a, p) => a + unrealizedFor(p), 0);
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

  // ---- canonical API (forward-looking; fail-closed on corrupt store) ----
  function createPosition(args) {
    if (isCorrupt()) return { ok: false, error: 'positions_corrupt' };
    return recordEntry(args);
  }
  function applyFill(fill = {}) {
    if (isCorrupt()) return { ok: false, error: 'positions_corrupt' };
    if (fill.side === 'sell') return recordExit(fill);
    return recordEntry(fill);
  }
  function closePosition(position_id, { proceeds_usd, fee_usd_est, price_impact_pct, reason = 'close' } = {}) {
    if (isCorrupt()) return { ok: false, error: 'positions_corrupt' };
    return recordExit({ position_id, fraction: 1, proceeds_usd, fee_usd_est, price_impact_pct, reason });
  }
  function updatePositionMark(position_id, mark_usd, mark_status = 'valid') {
    if (isCorrupt()) return { ok: false, error: 'positions_corrupt' };
    setMark(position_id, mark_usd, mark_status);
    return { ok: true };
  }
  function computeUnrealizedPnl(position) {
    if (position) return unrealizedFor(position);
    return openPositions().reduce((a, p) => a + unrealizedFor(p), 0);
  }
  function computeRealizedPnl() { return load().realized_pnl_usd; }
  function listOpenPositions() { return openPositions(); }
  function summarizePortfolio() { return summary(); }

  return {
    // legacy-exact surface (apps/server delegates to these)
    state, openPositions, openCount, tokenExposureUsd, leaderExposureUsd, dailyRealized,
    leaderStats, leaderConsecutiveLosses,
    recordEntry, recordExit, setMark, setEntriesBlocked, markTp1Done,
    flagNeedsReconciliation, resolveReconciliation, summary,
    // canonical API (ADR-0001)
    createPosition, applyFill, closePosition, updatePositionMark,
    computeUnrealizedPnl, computeRealizedPnl, deriveExitPlan, validatePositionTransition,
    listOpenPositions, summarizePortfolio,
  };
}
