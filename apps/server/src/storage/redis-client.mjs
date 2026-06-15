// redis-client.mjs (apps/server — mechanism host, ADR-0001 Phase 6A).
// redis lives ONLY here (apps/server), loaded via DYNAMIC import so HOT_STATE_BACKEND=memory never
// loads it. Redis is HOT-STATE ONLY (cache / locks / cursors / rate-limits) — NEVER source of truth;
// every entry is rebuildable from Postgres/JSON. Packages stay pure: they get the @soltrade/hot-state
// interface; the Redis implementation of it lives here. See docs/architecture/package-boundaries.md.
import { createMemoryHotStateStore } from '../../../../packages/hot-state/src/index.mjs';

let _tok = 0;
const defaultGenToken = () => `tok_${(_tok += 1)}`;

/** Resolve { backend, redis } from env. Fail-clear: invalid backend or redis-without-config errors. */
export function parseRedisConfig(env = {}) {
  const raw = String(env.HOT_STATE_BACKEND || 'memory').trim().toLowerCase();
  if (raw !== 'memory' && raw !== 'redis') {
    return { ok: false, backend: raw, error: `invalid_hot_state_backend:${raw} (expected memory|redis)` };
  }
  if (raw === 'memory') return { ok: true, backend: 'memory', redis: null };

  const url = env.REDIS_URL || env.HOT_STATE_REDIS_URL || null;
  const host = env.REDIS_HOST || null;
  if (!url && !host) {
    return { ok: false, backend: 'redis', error: 'redis_config_missing: set REDIS_URL (or REDIS_HOST/REDIS_PORT)' };
  }
  const redis = url ? { url } : { url: `redis://${host}:${Number(env.REDIS_PORT || 6379)}` };
  return { ok: true, backend: 'redis', redis };
}

/** Create + connect a real node-redis client. DYNAMIC import so memory mode never requires the dep. */
export async function createRedisClient(redisConfig) {
  let mod;
  try {
    mod = await import('redis');
  } catch (e) {
    throw new Error(`redis_driver_unavailable: install 'redis' or use HOT_STATE_BACKEND=memory (${e?.message || e})`);
  }
  const createClient = mod.createClient || mod.default?.createClient;
  if (!createClient) throw new Error('redis_driver_invalid: createClient not found');
  const client = createClient({ url: redisConfig.url });
  await client.connect();
  return client;
}

/**
 * Wrap a node-redis-v4-like client as a hot-state store implementing the @soltrade/hot-state interface.
 * Errors are normalized to clear `redis_op_failed:<op>:` messages (no silent swallow). NOTE: this is
 * the raw store; graceful fail-open wrapping (cache-miss on Redis error) is added when it is wired into
 * the runtime in Phase 6B — 6A is foundation only.
 */
export function createRedisHotStateStore({ client, genToken = defaultGenToken } = {}) {
  if (!client || typeof client.get !== 'function') throw new Error('redis_hot_state_requires_client');
  const wrap = async (op, fn) => { try { return await fn(); } catch (e) { throw new Error(`redis_op_failed:${op}:${e?.code || e?.message || 'error'}`); } };

  const get = (key) => wrap('get', () => client.get(key));
  const set = (key, value, ttlMs) => wrap('set', async () => {
    const opts = Number.isFinite(ttlMs) && ttlMs > 0 ? { PX: ttlMs } : undefined;
    await client.set(key, String(value), opts);
    return { ok: true };
  });
  const del = (key) => wrap('del', async () => ({ ok: (await client.del(key)) > 0 }));

  const lock = (key, ttlMs) => wrap('lock', async () => {
    const token = genToken();
    const opts = { NX: true };
    if (Number.isFinite(ttlMs) && ttlMs > 0) opts.PX = ttlMs;
    const r = await client.set(`lock:${key}`, token, opts); // SET NX [PX] -> 'OK' or null
    return r ? { ok: true, token } : { ok: false, token: null };
  });
  const unlock = (key, token = null) => wrap('unlock', async () => {
    const cur = await client.get(`lock:${key}`); // foundation: get-then-del (6B may upgrade to a Lua CAS)
    if (cur != null && (token == null || cur === token)) { await client.del(`lock:${key}`); return { ok: true }; }
    return { ok: false };
  });
  const incrRateLimit = (key, ttlMs) => wrap('incr', async () => {
    const n = await client.incr(`rl:${key}`);
    if (n === 1 && Number.isFinite(ttlMs) && ttlMs > 0) await client.pExpire(`rl:${key}`, ttlMs); // window on first hit
    return n;
  });

  const getCursor = (name) => get(`cursor:${name}`);
  const setCursor = (name, value) => set(`cursor:${name}`, value);
  const getJson = async (key) => { const v = await get(key); try { return v == null ? null : JSON.parse(v); } catch { return null; } };
  const setJson = (key, obj, ttlMs) => set(key, JSON.stringify(obj ?? null), ttlMs);

  return {
    backend: 'redis',
    get, set, del, lock, unlock, incrRateLimit, getCursor, setCursor,
    getProviderHealth: () => getJson('provider_health'),
    setProviderHealth: (snap, ttlMs) => setJson('provider_health', snap, ttlMs),
    getReadiness: () => getJson('readiness'),
    setReadiness: (obj, ttlMs) => setJson('readiness', obj, ttlMs),
  };
}

/**
 * Build the hot-state backend from env. memory (DEFAULT) needs no Redis; redis connects (or uses an
 * injected client for tests). Mirrors createStorageBackend({ env, pgClient }). Throws clearly on bad
 * config — never silently downgrades.
 */
export async function createHotStateBackend({ env = {}, redisClient = null } = {}) {
  const cfg = parseRedisConfig(env);
  if (!cfg.ok) throw new Error(`hot_state_backend_config_error: ${cfg.error}`);
  if (cfg.backend === 'memory') return { backend: 'memory', store: createMemoryHotStateStore() };
  const client = redisClient || await createRedisClient(cfg.redis);
  return { backend: 'redis', store: createRedisHotStateStore({ client }), client };
}
