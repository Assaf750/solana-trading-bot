// orders.mjs — persistent limit-buy + DCA orders, and the PURE decision helpers that say when
// an order should fire and how its state advances. The engine polls these and routes a fire
// through the same gated manualBuy path; the helpers themselves do no I/O (unit-tested).
import { readJson, writeJson, newId, nowIso } from '../util.mjs';

const DEFAULT_FILE = 'orders.json';
const MAX_LIMIT_ATTEMPTS = 10; // a limit-buy that keeps getting rejected eventually gives up

/** Should this open order fire a buy now? Pure. */
export function shouldFire({ order, price, now }) {
  if (!order || order.status !== 'open') return false;
  if (order.type === 'limit_buy') return Number.isFinite(price) && price > 0 && price <= order.target_price_usd;
  if (order.type === 'dca') return Number.isFinite(now) && now >= order.next_at;
  return false;
}

/** New order state after an attempted fire (ok = the buy succeeded). Pure. */
export function nextOrderState({ order, ok, now, error = null }) {
  if (order.type === 'limit_buy') {
    if (ok) return { ...order, status: 'filled', filled_at: new Date(now).toISOString() };
    const attempts = (order.attempts || 0) + 1;
    return attempts >= MAX_LIMIT_ATTEMPTS
      ? { ...order, status: 'failed', attempts, last_error: error }
      : { ...order, attempts, last_error: error };
  }
  if (order.type === 'dca') {
    const done = (order.done || 0) + 1; // each slot is consumed whether it filled or not (terminates)
    const next_at = now + order.interval_sec * 1000;
    const base = { ...order, done, next_at, last_error: ok ? null : error };
    return done >= order.total ? { ...base, status: 'completed' } : base;
  }
  return order;
}

export function createOrdersStore({ file = DEFAULT_FILE } = {}) {
  function load() { return readJson(file, { orders: [] }).value; }
  function save(s) { writeJson(file, s); }

  function list() { return load().orders; }
  function openOrders() { return load().orders.filter((o) => o.status === 'open'); }

  function add(spec) {
    const s = load();
    const order = { order_id: newId('ord'), status: 'open', created_at: nowIso(), ...spec };
    s.orders.push(order);
    save(s);
    return order;
  }

  // Compare-and-set: only overwrite an order that is STILL 'open' in storage. pollOrders snapshots
  // an open order, awaits the (slow) buy, then writes the result here — if a cancel_order landed
  // during that await the persisted status is no longer 'open', so we DON'T resurrect/clobber it
  // (and a limit-buy that already fired can never be flipped back to 'open' and re-fire).
  function replace(order_id, updated) {
    const s = load();
    const i = s.orders.findIndex((o) => o.order_id === order_id);
    if (i === -1) return { ok: false, error: 'order_not_found' };
    if (s.orders[i].status !== 'open') return { ok: false, error: 'order_not_open' };
    s.orders[i] = { ...updated, order_id };
    save(s);
    return { ok: true, order: s.orders[i] };
  }

  function cancel(order_id) {
    const s = load();
    const o = s.orders.find((x) => x.order_id === order_id);
    if (!o) return { ok: false, error: 'order_not_found' };
    if (o.status !== 'open') return { ok: false, error: 'order_not_open' };
    o.status = 'cancelled';
    o.cancelled_at = nowIso();
    save(s);
    return { ok: true, order: o };
  }

  return { list, openOrders, add, replace, cancel };
}
