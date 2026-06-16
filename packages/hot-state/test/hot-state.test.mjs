// @soltrade/hot-state — memory store tests (ADR-0001 Phase 6A). Pure; no redis. Uses an injected
// clock so TTL expiry is deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryHotStateStore } from '../src/index.mjs';

// controllable clock + deterministic tokens
function harness(start = 1000) {
  let t = start; let n = 0;
  const store = createMemoryHotStateStore({ now: () => t, genToken: () => `tok_${(n += 1)}` });
  return { store, advance: (ms) => { t += ms; }, at: () => t };
}

// ---------- get / set / del ----------
test('get/set/del roundtrip; missing key -> null', async () => {
  const { store } = harness();
  assert.equal(await store.get('k'), null);
  await store.set('k', 'v');
  assert.equal(await store.get('k'), 'v');
  await store.set('num', 42);
  assert.equal(await store.get('num'), '42'); // values are stringified
  assert.deepEqual(await store.del('k'), { ok: true });
  assert.equal(await store.get('k'), null);
});

// ---------- TTL ----------
test('ttl: a key expires once the injected clock passes its window', async () => {
  const { store, advance } = harness();
  await store.set('k', 'v', 5000);
  advance(4999);
  assert.equal(await store.get('k'), 'v');
  advance(1); // now == expiry -> expired
  assert.equal(await store.get('k'), null);
});

test('no ttl => persists across clock advances', async () => {
  const { store, advance } = harness();
  await store.set('k', 'v');
  advance(10_000_000);
  assert.equal(await store.get('k'), 'v');
});

// ---------- locks ----------
test('lock: acquire, second acquire fails while held, unlock releases, re-lock works', async () => {
  const { store } = harness();
  const a = await store.lock('job', 10_000);
  assert.equal(a.ok, true);
  assert.ok(a.token);
  const b = await store.lock('job', 10_000);
  assert.equal(b.ok, false, 'already held');
  assert.deepEqual(await store.unlock('job', a.token), { ok: true });
  const c = await store.lock('job', 10_000);
  assert.equal(c.ok, true, 're-acquired after release');
});

test('lock: a held lock auto-expires after its ttl', async () => {
  const { store, advance } = harness();
  assert.equal((await store.lock('job', 1000)).ok, true);
  assert.equal((await store.lock('job', 1000)).ok, false);
  advance(1000);
  assert.equal((await store.lock('job', 1000)).ok, true, 'expired lock is re-acquirable');
});

test('unlock: wrong token does not release', async () => {
  const { store } = harness();
  const a = await store.lock('job', 10_000);
  assert.deepEqual(await store.unlock('job', 'not-the-token'), { ok: false });
  assert.equal((await store.lock('job', 10_000)).ok, false, 'still held');
  assert.deepEqual(await store.unlock('job', a.token), { ok: true });
});

// ---------- rate limit ----------
test('incrRateLimit: counts up within the window, resets after expiry', async () => {
  const { store, advance } = harness();
  assert.equal(await store.incrRateLimit('ip', 1000), 1);
  assert.equal(await store.incrRateLimit('ip', 1000), 2);
  assert.equal(await store.incrRateLimit('ip', 1000), 3);
  advance(1000); // window closes
  assert.equal(await store.incrRateLimit('ip', 1000), 1, 'new window');
});

// ---------- cursors ----------
test('cursor: set/get is namespaced and independent of generic keys', async () => {
  const { store } = harness();
  assert.equal(await store.getCursor('leader-stream'), null);
  await store.setCursor('leader-stream', 'sig_123');
  assert.equal(await store.getCursor('leader-stream'), 'sig_123');
});

// ---------- idempotency keys ----------
test('idempotency: first claim wins; a duplicate returns the stored result (replay)', async () => {
  const { store } = harness();
  const first = await store.claimIdempotencyKey('req-1', 10_000, { result: 42 });
  assert.deepEqual(first, { claimed: true, existing: null });
  const dup = await store.claimIdempotencyKey('req-1', 10_000, { result: 999 });
  assert.equal(dup.claimed, false);
  assert.deepEqual(dup.existing, { result: 42 }, 'duplicate returns the ORIGINAL stored value');
  assert.deepEqual(await store.readIdempotencyKey('req-1'), { result: 42 });
});

test('idempotency: release frees the key; a window expiry frees it too', async () => {
  const { store, advance } = harness();
  await store.claimIdempotencyKey('req-2', 5000, { v: 1 });
  await store.releaseIdempotencyKey('req-2');
  assert.equal(await store.readIdempotencyKey('req-2'), null);
  assert.equal((await store.claimIdempotencyKey('req-2', 5000, { v: 2 })).claimed, true, 're-claim after release');
  advance(5000);
  assert.equal(await store.readIdempotencyKey('req-2'), null, 'expired after ttl');
});

// ---------- provider-health / readiness JSON caches ----------
test('provider-health + readiness: JSON roundtrip; ttl honored', async () => {
  const { store, advance } = harness();
  assert.equal(await store.getProviderHealth(), null);
  await store.setProviderHealth({ rpc: { status: 'healthy' } });
  assert.deepEqual(await store.getProviderHealth(), { rpc: { status: 'healthy' } });
  await store.setReadiness({ readiness: 'valid', blockers: [] }, 2000);
  assert.deepEqual(await store.getReadiness(), { readiness: 'valid', blockers: [] });
  advance(2000);
  assert.equal(await store.getReadiness(), null, 'readiness cache expired');
});
