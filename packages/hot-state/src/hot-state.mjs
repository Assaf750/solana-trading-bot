// @soltrade/hot-state — pure hot-state interface + in-memory reference store (ADR-0001 Phase 6A).
//
// Hot-state is a CACHE layer: locks, TTL'd keys, rate-limit counters, ingestion cursors, and
// cached provider-health / readiness snapshots. It is NEVER the source of truth — Postgres/JSON owns
// the durable state (ADR-0001 §8), and every hot-state entry is rebuildable from the SoT. Losing
// Redis must only cost a cache warm-up, never data.
//
// PURITY (mechanism-guard): no redis/ioredis import, no network, no timers. The clock is INJECTED
// (`now`) so TTL is deterministic + testable; the Redis-backed implementation of this SAME interface
// lives in apps/server (the mechanism host) — see apps/server/src/storage/redis-client.mjs.
//
// THE INTERFACE (both the memory store here and the Redis store in apps/server implement it; all async
// so callers are backend-agnostic):
//   get(key)                       -> Promise<string|null>
//   set(key, value, ttlMs?)        -> Promise<{ ok }>
//   del(key)                       -> Promise<{ ok }>
//   lock(key, ttlMs)               -> Promise<{ ok, token }>      // ok=false when already held
//   unlock(key, token?)            -> Promise<{ ok }>            // token-checked release
//   incrRateLimit(key, ttlMs)      -> Promise<number>            // count in the current window
//   getCursor(name) / setCursor(name, value)
//   getProviderHealth() / setProviderHealth(snapshot, ttlMs?)
//   getReadiness() / setReadiness(obj, ttlMs?)

let _seq = 0;
const defaultGenToken = () => `tok_${(_seq += 1)}`;
const defaultNow = () => Date.now();

/**
 * Pure in-memory hot-state store (the `memory` backend + the reference/test double for the Redis one).
 * @param deps.now      injected clock () => epoch ms (deterministic TTL; defaults to wall clock)
 * @param deps.genToken injected lock-token generator (defaults to an in-process sequence)
 */
export function createMemoryHotStateStore({ now = defaultNow, genToken = defaultGenToken } = {}) {
  const map = new Map(); // key -> { value: string, expiresAt: number|null }
  const expiry = (ttlMs) => (Number.isFinite(ttlMs) && ttlMs > 0 ? now() + ttlMs : null);
  function live(key) {
    const e = map.get(key);
    if (!e) return null;
    if (e.expiresAt != null && now() >= e.expiresAt) { map.delete(key); return null; } // lazy TTL expiry
    return e;
  }

  async function get(key) { const e = live(key); return e ? e.value : null; }
  async function set(key, value, ttlMs) { map.set(key, { value: String(value), expiresAt: expiry(ttlMs) }); return { ok: true }; }
  async function del(key) { return { ok: map.delete(key) }; }

  async function lock(key, ttlMs) {
    const k = `lock:${key}`;
    if (live(k)) return { ok: false, token: null }; // already held (and not expired)
    const token = genToken();
    map.set(k, { value: token, expiresAt: expiry(ttlMs) });
    return { ok: true, token };
  }
  async function unlock(key, token = null) {
    const k = `lock:${key}`;
    const e = live(k);
    if (e && (token == null || e.value === token)) { map.delete(k); return { ok: true }; }
    return { ok: false };
  }

  async function incrRateLimit(key, ttlMs) {
    const k = `rl:${key}`;
    const e = live(k);
    if (!e) { map.set(k, { value: '1', expiresAt: expiry(ttlMs) }); return 1; } // first hit opens the window
    const n = Number(e.value) + 1;
    map.set(k, { value: String(n), expiresAt: e.expiresAt }); // keep the window's original expiry
    return n;
  }

  const getCursor = (name) => get(`cursor:${name}`);
  const setCursor = (name, value) => set(`cursor:${name}`, value);
  const getJson = async (key) => { const v = await get(key); try { return v == null ? null : JSON.parse(v); } catch { return null; } };
  const setJson = (key, obj, ttlMs) => set(key, JSON.stringify(obj ?? null), ttlMs);

  // idempotency: first claim wins (built on the set-if-absent primitive); a duplicate returns the
  // stored result so a retry/double-submit replays rather than repeats. Rebuildable cache — never SoT.
  async function claimIdempotencyKey(key, ttlMs, value = null) {
    const k = `idem:${key}`;
    const e = live(k);
    if (e) { try { return { claimed: false, existing: JSON.parse(e.value) }; } catch { return { claimed: false, existing: null }; } }
    map.set(k, { value: JSON.stringify(value ?? null), expiresAt: expiry(ttlMs) });
    return { claimed: true, existing: null };
  }
  const readIdempotencyKey = (key) => getJson(`idem:${key}`);
  const releaseIdempotencyKey = (key) => del(`idem:${key}`);

  return {
    backend: 'memory',
    get, set, del, lock, unlock, incrRateLimit, getCursor, setCursor,
    claimIdempotencyKey, readIdempotencyKey, releaseIdempotencyKey,
    getProviderHealth: () => getJson('provider_health'),
    setProviderHealth: (snap, ttlMs) => setJson('provider_health', snap, ttlMs),
    getReadiness: () => getJson('readiness'),
    setReadiness: (obj, ttlMs) => setJson('readiness', obj, ttlMs),
  };
}
