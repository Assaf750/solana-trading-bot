// @soltrade/paper-portfolio — Paper Portfolio + P&L read-model (Gate B / B8) — CANDIDATE-FLAGGED.
// SOURCE: docs/00-ARCHITECTURE.md §2.1/§15.2 (P&L backend read-model) + docs/01-SSOT.md G22/G28.
// BACKEND-ONLY, in-memory, paper/simulated. candidate_* names kept candidate (not implemented, not final).
//
// HARD RULES:
//  - P&L is a backend read-model, NOT a source of truth, NOT exposed to UX, NEVER on Opportunity/Radar.
//  - candidate_unrealized_pnl is computed/returned ONLY when candidate_mark_status === 'valid';
//    a stale/invalid/unavailable mark yields NO unrealized truth (null).
//  - Only paper/simulated fills are accepted (is_valid_on_chain:true is rejected). Every output is simulated.
//  - No execution/signing/sending, no network/provider, no DB writes. candidate_ prefixes preserved.

import { CANDIDATE_ENUMS } from '../../ssot-types/src/candidate-enums.mjs';

const MARK_STATUS = CANDIDATE_ENUMS.candidate_mark_status; // valid|stale|unavailable|low_confidence|display_only
if (!MARK_STATUS.includes('valid')) throw new Error('internal: candidate_mark_status drift');

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;

export function createPaperPortfolio() {
  // position_ref -> { lots:[{qty,price}], realized, fees, slippage }
  const book = new Map();

  function pos(ref) {
    if (!book.has(ref)) book.set(ref, { lots: [], realized: 0, fees: 0, slippage: 0 });
    return book.get(ref);
  }

  function addSimulatedFill(fill = {}) {
    if (!isStr(fill.position_ref)) return { ok: false, reason: 'position_ref_required' };
    if (fill.is_valid_on_chain === true) return { ok: false, reason: 'only_simulated_fills_accepted' };
    if (fill.side !== 'buy' && fill.side !== 'sell') return { ok: false, reason: 'invalid_side' };
    if (!isNum(fill.quantity) || fill.quantity <= 0) return { ok: false, reason: 'invalid_quantity' };
    if (!isNum(fill.price) || fill.price < 0) return { ok: false, reason: 'invalid_price' };
    const fee = isNum(fill.fee) ? fill.fee : 0;
    const slippage = isNum(fill.slippage) ? fill.slippage : 0;

    const p = pos(fill.position_ref);
    p.fees += fee;
    p.slippage += slippage;

    if (fill.side === 'buy') {
      p.lots.push({ qty: fill.quantity, price: fill.price });
    } else {
      let remaining = fill.quantity;
      while (remaining > 0 && p.lots.length > 0) {
        const lot = p.lots[0];
        const m = Math.min(remaining, lot.qty);
        p.realized += (fill.price - lot.price) * m; // FIFO realized (simulated)
        lot.qty -= m;
        remaining -= m;
        if (lot.qty === 0) p.lots.shift();
      }
      // remaining > 0 (over-sell) is ignored in this paper model (no short positions).
    }
    return { ok: true, simulated: true };
  }

  function openQuantity(p) {
    return p.lots.reduce((s, l) => s + l.qty, 0);
  }
  function avgOpenCost(p) {
    const q = openQuantity(p);
    if (q === 0) return 0;
    return p.lots.reduce((s, l) => s + l.qty * l.price, 0) / q;
  }

  /** Realized read-model (candidate, simulated). */
  function getRealized(position_ref) {
    const p = pos(position_ref);
    return {
      simulated: true,
      candidate_realized_pnl: p.realized,
      candidate_fees_total: p.fees,
      candidate_slippage_cost: p.slippage,
    };
  }

  /** Unrealized read-model — ONLY a real number when candidate_mark_status === 'valid'. */
  function getUnrealized(position_ref, mark = {}) {
    const status = mark.candidate_mark_status;
    if (!MARK_STATUS.includes(status)) {
      return { simulated: true, candidate_unrealized_pnl: null, candidate_mark_status: status ?? null, unrealized_available: false, reason: 'invalid_mark_status' };
    }
    if (status !== 'valid') {
      return { simulated: true, candidate_unrealized_pnl: null, candidate_mark_status: status, unrealized_available: false, reason: 'mark_not_valid' };
    }
    if (!isNum(mark.mark)) {
      return { simulated: true, candidate_unrealized_pnl: null, candidate_mark_status: status, unrealized_available: false, reason: 'mark_value_missing' };
    }
    const p = pos(position_ref);
    const q = openQuantity(p);
    const unrealized = (mark.mark - avgOpenCost(p)) * q;
    return { simulated: true, candidate_unrealized_pnl: unrealized, candidate_mark_status: 'valid', unrealized_available: true };
  }

  /** Combined backend read-model (simulated). */
  function getPortfolio(position_ref, mark) {
    return {
      simulated: true,
      position_ref,
      ...getRealized(position_ref),
      unrealized: getUnrealized(position_ref, mark || {}),
      open_quantity: openQuantity(pos(position_ref)),
    };
  }

  return Object.freeze({
    addSimulatedFill,
    getRealized,
    getUnrealized,
    getPortfolio,
    positions() { return [...book.keys()]; },
  });
}

export const MARK_STATUS_VALUES = MARK_STATUS;
