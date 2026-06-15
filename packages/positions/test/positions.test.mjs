import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createPositionsBook, createMemoryPositionStore, createJsonPositionStore,
  validatePositionTransition, deriveExitPlan,
} from '../src/index.mjs';

// deterministic id/time so parity assertions are exact
function book({ simulated = true } = {}) {
  let n = 0;
  const newId = (p) => `${p}_${String((n += 1)).padStart(4, '0')}`;
  const nowIso = () => '2026-06-15T00:00:00.000Z';
  return createPositionsBook({ store: createMemoryPositionStore(), newId, nowIso, simulated });
}
const ENTRY = { leader_address: 'L', wallet_id: 'w', token_mint: 'M', qty_ui: 100, decimals: 6, cost_usd: 50, fee_usd_est: 1, price_impact_pct: 0.1, copy_mode: 'follow_entry_user_exit', tp_pct: null, sl_pct: null };

function fakeIo({ corrupt = false, initial = null } = {}) {
  let stored = initial;
  return {
    readJson: (_n, fb) => (corrupt ? { value: fb, corrupt: true } : { value: stored ?? fb, corrupt: false }),
    writeJson: (_n, v) => { stored = v; },
    peek: () => stored,
  };
}

// ---------- open / fill ----------
test('parity: open a position from a buy fill (entry price = cost/qty, mark seeded, OPEN)', () => {
  const b = book();
  const p = b.recordEntry(ENTRY);
  assert.equal(p.position_state, 'OPEN');
  assert.equal(p.entry_price_usd, 0.5);
  assert.equal(p.mark_usd, 50);
  assert.equal(p.entry_fee_usd, 1); // simulated charges entry fee
  assert.deepEqual(p.mark_history, [50]);
  assert.equal(b.openCount(), 1);
});

test('parity: an additional buy fill opens a SEPARATE position (book does not average-merge)', () => {
  const b = book();
  b.recordEntry(ENTRY);
  const p2 = b.recordEntry({ ...ENTRY, qty_ui: 50, cost_usd: 40 });
  assert.equal(b.openCount(), 2);
  assert.equal(p2.entry_price_usd, 0.8); // its own avg price for that fill
});

// ---------- partial / full close + realized/unrealized + fees ----------
test('parity: partial close books realized, keeps position OPEN, rescales cost/qty/mark', () => {
  const b = book();
  const p = b.recordEntry(ENTRY);
  const r = b.recordExit({ position_id: p.position_id, fraction: 0.5, proceeds_usd: 30, fee_usd_est: 0, price_impact_pct: 0, reason: 'take_profit_tier1' });
  // realized = 30 - cost(25) - exitFee(0) - entryFeePart(0.5) = 4.5
  assert.deepEqual(r, { ok: true, realized_usd: 4.5, closed: false });
  const open = b.openPositions()[0];
  assert.equal(open.qty_ui, 50);
  assert.equal(open.cost_usd, 25);
  assert.equal(open.entry_fee_usd, 0.5);
  assert.equal(open.mark_usd, 25); // valid mark rescaled by (1-0.5)
  assert.equal(b.computeRealizedPnl(), 4.5);
});

test('parity: full close zeroes the position and books realized (incl. entry fee)', () => {
  const b = book();
  const p = b.recordEntry(ENTRY);
  const r = b.recordExit({ position_id: p.position_id, fraction: 1, proceeds_usd: 80, fee_usd_est: 2, reason: 'manual_close' });
  // realized = 80 - 50 - 2 - 1 = 27
  assert.deepEqual(r, { ok: true, realized_usd: 27, closed: true });
  assert.equal(b.openCount(), 0);
  assert.equal(b.summary().realized_pnl_usd, 27);
  assert.equal(b.summary().daily_realized_pnl_usd, 27);
});

test('parity: LIVE book (simulated:false) charges no entry fee at exit', () => {
  const b = book({ simulated: false });
  const p = b.recordEntry(ENTRY);
  assert.equal(p.entry_fee_usd, 0);
  const r = b.recordExit({ position_id: p.position_id, fraction: 1, proceeds_usd: 80, fee_usd_est: 2 });
  assert.equal(r.realized_usd, 28); // 80 - 50 - 2 - 0
});

test('parity: unrealized PnL uses valid mark; stale mark falls back to cost; peak tracked', () => {
  const b = book();
  const p = b.recordEntry(ENTRY);
  b.setMark(p.position_id, 60, 'valid');
  assert.equal(b.summary().unrealized_pnl_usd, 10);
  assert.equal(b.computeUnrealizedPnl(), 10);
  assert.equal(b.openPositions()[0].peak_pnl_pct, 20);
  b.setMark(p.position_id, 999, 'unavailable'); // stale -> not used for unrealized, not in history
  assert.equal(b.summary().unrealized_pnl_usd, 0);
});

test('parity: non-finite proceeds rejected; exit on missing/closed position rejected', () => {
  const b = book();
  const p = b.recordEntry(ENTRY);
  assert.deepEqual(b.recordExit({ position_id: p.position_id, proceeds_usd: NaN }), { ok: false, error: 'invalid_proceeds' });
  assert.deepEqual(b.recordExit({ position_id: 'ghost', proceeds_usd: 10 }), { ok: false, error: 'position_not_open' });
});

test('parity: sell-side proceeds + leaderStats/profit_factor reflect closed positions', () => {
  const b = book();
  const p = b.recordEntry(ENTRY);
  b.recordExit({ position_id: p.position_id, fraction: 1, proceeds_usd: 80, fee_usd_est: 0 }); // realized 80-50-1 = 29
  const s = b.leaderStats('L');
  assert.equal(s.trades, 1);
  assert.equal(s.wins, 1);
  assert.equal(s.total_realized, 29);
  assert.equal(s.profit_factor, Infinity); // no losses
});

// ---------- canonical aliases ----------
test('canonical: createPosition/applyFill/closePosition route to the book', () => {
  const b = book();
  const p = b.createPosition(ENTRY);
  assert.equal(p.position_state, 'OPEN');
  const r = b.closePosition(p.position_id, { proceeds_usd: 80, fee_usd_est: 2, reason: 'close' });
  assert.equal(r.closed, true);
  assert.equal(r.realized_usd, 27);
  const p2 = b.applyFill({ ...ENTRY, side: 'buy' });
  assert.equal(p2.position_state, 'OPEN');
});

// ---------- transitions ----------
test('validatePositionTransition: legal OPEN->CLOSED; illegal + unknown rejected (fail-closed)', () => {
  assert.equal(validatePositionTransition('OPEN', 'CLOSED').ok, true);
  assert.equal(validatePositionTransition('OPENING', 'OPEN').ok, true);
  assert.equal(validatePositionTransition('CLOSED', 'OPEN').ok, false); // terminal
  assert.equal(validatePositionTransition('OPEN', 'OPEN').ok, false);
  assert.equal(validatePositionTransition('FOO', 'OPEN').ok, false);
  assert.equal(validatePositionTransition('OPEN', 'BAR').ok, false);
});

// ---------- corrupt / missing fail-closed ----------
test('corrupt store: canonical API fails closed; legacy recordEntry preserves prior behaviour', () => {
  const io = fakeIo({ corrupt: true });
  const store = createJsonPositionStore({ file: 'live-portfolio.json', readJson: io.readJson, writeJson: io.writeJson });
  let n = 0;
  const b = createPositionsBook({ store, newId: (p) => `${p}_${(n += 1)}`, nowIso: () => '2026-06-15T00:00:00.000Z' });
  assert.deepEqual(b.createPosition(ENTRY), { ok: false, error: 'positions_corrupt' });
  assert.deepEqual(b.updatePositionMark('x', 1), { ok: false, error: 'positions_corrupt' });
  // legacy primitive still behaves as before (corrupt -> treated as empty, parity)
  const p = b.recordEntry(ENTRY);
  assert.equal(p.position_state, 'OPEN');
});

test('missing state: a fresh book summarizes to an empty, finite portfolio', () => {
  const b = book();
  assert.deepEqual(b.summary(), {
    simulated: true, open_positions: 0, realized_pnl_usd: 0, unrealized_pnl_usd: 0,
    daily_realized_pnl_usd: 0, entries_blocked: false, trade_count: 0,
  });
});

// ---------- deriveExitPlan composition ----------
test('deriveExitPlan: trailing > breakeven > tp1 > hard tp > hard sl priority + reasons', () => {
  assert.deepEqual(deriveExitPlan({ pnlPct: 10, peakPct: 60, trailingPct: 30 }), { shouldExit: true, fraction: 1, reason: 'trailing_stop_hit' });
  assert.deepEqual(deriveExitPlan({ pnlPct: 0, tp1Done: true, breakevenAfterTp1: true }), { shouldExit: true, fraction: 1, reason: 'breakeven_stop' });
  assert.deepEqual(deriveExitPlan({ pnlPct: 50, tp1Pct: 40, tp1Done: false, tp1SellPct: 25 }), { shouldExit: true, fraction: 0.25, reason: 'take_profit_tier1' });
  assert.deepEqual(deriveExitPlan({ pnlPct: 120, tpPct: 100 }), { shouldExit: true, fraction: 1, reason: 'take_profit_hit' });
  assert.deepEqual(deriveExitPlan({ pnlPct: -40, slPct: 30 }), { shouldExit: true, fraction: 1, reason: 'stop_loss_hit' });
  assert.deepEqual(deriveExitPlan({ pnlPct: 5 }), { shouldExit: false, fraction: 0, reason: null });
});

test('createPositionsBook requires store + id/time helpers', () => {
  assert.throws(() => createPositionsBook({}), /requires_store/);
  assert.throws(() => createPositionsBook({ store: createMemoryPositionStore() }), /requires_id_and_time/);
});
