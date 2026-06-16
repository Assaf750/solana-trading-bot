// hot-state-backend.test.mjs — ADR-0001 Phase 6A. parseRedisConfig + createHotStateBackend +
// createRedisHotStateStore. redis is NEVER loaded: redis tests inject a mock client; memory mode
// (the default) loads no redis. Mirrors storage-backend.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { parseRedisConfig, createHotStateBackend, createRedisHotStateStore } = await import('../src/storage/redis-client.mjs');

// node-redis-v4-like mock (records calls, honors NX)
function mockRedis() {
  const calls = []; const data = new Map();
  const client = {
    get: async (k) => { calls.push(['get', k]); return data.has(k) ? data.get(k) : null; },
    set: async (k, v, opts) => { calls.push(['set', k, v, opts]); if (opts?.NX && data.has(k)) return null; data.set(k, String(v)); return 'OK'; },
    del: async (k) => { calls.push(['del', k]); return data.delete(k) ? 1 : 0; },
    incr: async (k) => { calls.push(['incr', k]); const n = Number(data.get(k) || 0) + 1; data.set(k, String(n)); return n; },
    pExpire: async (k, ms) => { calls.push(['pExpire', k, ms]); return true; },
  };
  return { client, calls, data };
}

// ---------- config ----------
test('config: unset => memory; explicit memory => memory (no redis config)', () => {
  assert.deepEqual(parseRedisConfig({}), { ok: true, backend: 'memory', redis: null });
  assert.deepEqual(parseRedisConfig({ HOT_STATE_BACKEND: 'memory' }), { ok: true, backend: 'memory', redis: null });
});

test('config: redis with REDIS_URL => ok; REDIS_HOST builds a url; missing => clear failure', () => {
  assert.deepEqual(parseRedisConfig({ HOT_STATE_BACKEND: 'redis', REDIS_URL: 'redis://h:6379' }), { ok: true, backend: 'redis', redis: { url: 'redis://h:6379' } });
  assert.deepEqual(parseRedisConfig({ HOT_STATE_BACKEND: 'redis', REDIS_HOST: 'h', REDIS_PORT: '6380' }).redis, { url: 'redis://h:6380' });
  const missing = parseRedisConfig({ HOT_STATE_BACKEND: 'redis' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /redis_config_missing/);
});

test('config: invalid backend => clear failure', () => {
  const r = parseRedisConfig({ HOT_STATE_BACKEND: 'memcached' });
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid_hot_state_backend:memcached/);
});

// ---------- createHotStateBackend ----------
test('createHotStateBackend: memory returns a working store, no redis loaded', async () => {
  const b = await createHotStateBackend({ env: { HOT_STATE_BACKEND: 'memory' } });
  assert.equal(b.backend, 'memory');
  const a = await b.store.lock('job', 1000);
  assert.equal(a.ok, true);
  assert.equal((await b.store.lock('job', 1000)).ok, false);
});

test('createHotStateBackend: redis with injected client builds a store; bad config throws', async () => {
  const { client } = mockRedis();
  const b = await createHotStateBackend({ env: { HOT_STATE_BACKEND: 'redis', REDIS_URL: 'redis://x' }, redisClient: client });
  assert.equal(b.backend, 'redis');
  assert.equal(typeof b.store.lock, 'function');
  await assert.rejects(() => createHotStateBackend({ env: { HOT_STATE_BACKEND: 'redis' } }), /hot_state_backend_config_error/);
  await assert.rejects(() => createHotStateBackend({ env: { HOT_STATE_BACKEND: 'nope' } }), /hot_state_backend_config_error/);
});

// ---------- redis store over mock client ----------
test('redis store: set(ttl) uses PX; get/del map to client; requires a client', async () => {
  const { client, calls, data } = mockRedis();
  const store = createRedisHotStateStore({ client });
  await store.set('k', 'v', 5000);
  assert.deepEqual(calls.find((c) => c[0] === 'set'), ['set', 'k', 'v', { PX: 5000 }]);
  assert.equal(await store.get('k'), 'v');
  assert.deepEqual(await store.del('k'), { ok: true });
  assert.equal(data.has('k'), false);
  assert.throws(() => createRedisHotStateStore({}), /redis_hot_state_requires_client/);
});

test('redis store: lock uses SET NX PX; second acquire fails; unlock is token-checked', async () => {
  const { client, calls } = mockRedis();
  const store = createRedisHotStateStore({ client, genToken: () => 'T1' });
  const a = await store.lock('job', 1000);
  assert.deepEqual(a, { ok: true, token: 'T1' });
  const setCall = calls.find((c) => c[0] === 'set' && c[1] === 'lock:job');
  assert.deepEqual(setCall[3], { NX: true, PX: 1000 });
  assert.deepEqual(await store.lock('job', 1000), { ok: false, token: null }, 'held');
  assert.deepEqual(await store.unlock('job', 'wrong'), { ok: false });
  assert.deepEqual(await store.unlock('job', 'T1'), { ok: true });
});

test('redis store: incrRateLimit increments and sets the window on the first hit only', async () => {
  const { client, calls } = mockRedis();
  const store = createRedisHotStateStore({ client });
  assert.equal(await store.incrRateLimit('ip', 1000), 1);
  assert.equal(await store.incrRateLimit('ip', 1000), 2);
  const expires = calls.filter((c) => c[0] === 'pExpire');
  assert.equal(expires.length, 1, 'pExpire only on the first incr');
  assert.deepEqual(expires[0], ['pExpire', 'rl:ip', 1000]);
});

test('redis store: cursor + provider-health/readiness JSON roundtrip', async () => {
  const { client } = mockRedis();
  const store = createRedisHotStateStore({ client });
  await store.setCursor('leader', 'sig_1');
  assert.equal(await store.getCursor('leader'), 'sig_1');
  await store.setProviderHealth({ rpc: { status: 'down' } });
  assert.deepEqual(await store.getProviderHealth(), { rpc: { status: 'down' } });
});

test('redis store: idempotency claim uses SET NX; duplicate returns the stored value; release frees it', async () => {
  const { client, calls } = mockRedis();
  const store = createRedisHotStateStore({ client });
  const first = await store.claimIdempotencyKey('req-1', 5000, { result: 7 });
  assert.deepEqual(first, { claimed: true, existing: null });
  const setCall = calls.find((c) => c[0] === 'set' && c[1] === 'idem:req-1');
  assert.deepEqual(setCall[3], { NX: true, PX: 5000 });
  const dup = await store.claimIdempotencyKey('req-1', 5000, { result: 999 });
  assert.deepEqual(dup, { claimed: false, existing: { result: 7 } });
  assert.deepEqual(await store.readIdempotencyKey('req-1'), { result: 7 });
  assert.deepEqual(await store.releaseIdempotencyKey('req-1'), { ok: true });
});

test('redis store: a client error is normalized to redis_op_failed (no silent swallow)', async () => {
  const failing = { get: async () => { const e = new Error('conn'); e.code = 'ECONNREFUSED'; throw e; } };
  const store = createRedisHotStateStore({ client: failing });
  await assert.rejects(() => store.get('k'), /redis_op_failed:get:ECONNREFUSED/);
});
