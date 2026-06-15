// orders.test.mjs — pure limit/DCA decision helpers + the store CRUD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-ord-'));
const { shouldFire, nextOrderState, createOrdersStore } = await import('../src/engine/orders.mjs');

test('shouldFire: limit_buy fires only at/below target price', () => {
  const o = { type: 'limit_buy', status: 'open', target_price_usd: 0.001 };
  assert.equal(shouldFire({ order: o, price: 0.0012 }), false);
  assert.equal(shouldFire({ order: o, price: 0.001 }), true);
  assert.equal(shouldFire({ order: o, price: 0.0008 }), true);
  assert.equal(shouldFire({ order: o, price: null }), false);
  assert.equal(shouldFire({ order: { ...o, status: 'filled' }, price: 0.0005 }), false); // not open
});

test('shouldFire: dca fires when now reaches next_at', () => {
  const o = { type: 'dca', status: 'open', next_at: 1000 };
  assert.equal(shouldFire({ order: o, now: 999 }), false);
  assert.equal(shouldFire({ order: o, now: 1000 }), true);
});

test('nextOrderState: limit_buy filled on success', () => {
  const r = nextOrderState({ order: { type: 'limit_buy', status: 'open' }, ok: true, now: 0 });
  assert.equal(r.status, 'filled');
  assert.ok(r.filled_at);
});

test('nextOrderState: limit_buy stays open and counts attempts, fails after 10', () => {
  let o = { type: 'limit_buy', status: 'open' };
  for (let i = 0; i < 9; i += 1) o = nextOrderState({ order: o, ok: false, now: 0, error: 'gates_refused' });
  assert.equal(o.status, 'open');
  assert.equal(o.attempts, 9);
  o = nextOrderState({ order: o, ok: false, now: 0, error: 'gates_refused' });
  assert.equal(o.status, 'failed');
  assert.equal(o.attempts, 10);
});

test('nextOrderState: dca advances slot + next_at, completes after total (success or fail)', () => {
  let o = { type: 'dca', status: 'open', total: 2, done: 0, interval_sec: 60 };
  o = nextOrderState({ order: o, ok: true, now: 1000 });
  assert.equal(o.done, 1);
  assert.equal(o.next_at, 1000 + 60 * 1000);
  assert.equal(o.status, 'open');
  o = nextOrderState({ order: o, ok: false, now: 2000, error: 'route_invalid' }); // a failed slot still consumes
  assert.equal(o.done, 2);
  assert.equal(o.status, 'completed');
  assert.equal(o.last_error, 'route_invalid');
});

test('store: replace is compare-and-set — a cancelled order is not clobbered (poll/cancel race)', () => {
  const store = createOrdersStore({ file: 'orders-cas.json' });
  const o = store.add({ type: 'limit_buy', mint: 'M', size_usd: 10, target_price_usd: 0.001, decimals: 6 });
  // simulate: pollOrders snapshotted it open and fired; meanwhile the user cancelled it
  store.cancel(o.order_id);
  const r = store.replace(o.order_id, { ...o, status: 'filled' }); // stale write from the in-flight poll
  assert.equal(r.ok, false);
  assert.equal(r.error, 'order_not_open');
  assert.equal(store.list().find((x) => x.order_id === o.order_id).status, 'cancelled'); // stays cancelled
});

test('store: add / list / cancel', () => {
  const store = createOrdersStore({ file: 'orders-test.json' });
  const o = store.add({ type: 'limit_buy', mint: 'M', size_usd: 10, target_price_usd: 0.001, decimals: 6 });
  assert.ok(o.order_id);
  assert.equal(store.openOrders().length >= 1, true);
  const c = store.cancel(o.order_id);
  assert.equal(c.ok, true);
  assert.equal(c.order.status, 'cancelled');
  assert.equal(store.cancel(o.order_id).error, 'order_not_open'); // already cancelled
  assert.equal(store.cancel('nope').error, 'order_not_found');
});
