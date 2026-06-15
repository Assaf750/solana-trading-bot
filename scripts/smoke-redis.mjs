// Redis hot-state smoke test (ADR-0001 Phase 6A). Proves HOT_STATE_BACKEND=redis works end to end:
// connect -> build backend -> lock/unlock -> set/get(ttl) -> incrRateLimit -> cursor -> provider-health
// cache. OPT-IN and NOT part of `node --test`: it SKIPS (exit 0) unless RUN_REDIS_SMOKE=1 or REDIS_URL
// is set. Redis is hot-state ONLY (never SoT). Lives OUTSIDE packages (root tooling).
import { createHotStateBackend } from '../apps/server/src/storage/redis-client.mjs';

const env = process.env;
const enabled = env.RUN_REDIS_SMOKE === '1' || env.REDIS_URL;
if (!enabled) {
  console.log('smoke:redis — SKIPPED (set RUN_REDIS_SMOKE=1 and REDIS_URL to run).');
  process.exit(0);
}

const fail = (msg, e) => { console.error(`smoke:redis — FAIL: ${msg}${e ? `: ${e.message || e}` : ''}`); process.exit(1); };

const backend = await createHotStateBackend({ env: { ...env, HOT_STATE_BACKEND: 'redis' } }).catch((e) => fail('createHotStateBackend', e));
if (!backend || backend.backend !== 'redis') fail('expected a redis backend');
const s = backend.store;
const ns = `smoke_${Date.now()}`;

// lock / unlock
const a = await s.lock(ns, 5000).catch((e) => fail('lock', e));
if (!a.ok) fail('lock not acquired');
if ((await s.lock(ns, 5000)).ok) fail('held lock must not be re-acquired');
if (!(await s.unlock(ns, a.token)).ok) fail('unlock failed');

// set / get (+ ttl) / del
await s.set(`${ns}:k`, 'v', 5000).catch((e) => fail('set', e));
if (await s.get(`${ns}:k`) !== 'v') fail('get mismatch');
await s.del(`${ns}:k`);

// rate limit
if (await s.incrRateLimit(`${ns}:rl`, 5000) !== 1) fail('rate limit first');
if (await s.incrRateLimit(`${ns}:rl`, 5000) !== 2) fail('rate limit second');

// cursor + provider-health cache
await s.setCursor(`${ns}:cur`, 'sig_1');
if (await s.getCursor(`${ns}:cur`) !== 'sig_1') fail('cursor mismatch');
await s.setProviderHealth({ rpc: { status: 'healthy' }, smoke: ns }, 5000);
const ph = await s.getProviderHealth();
if (!ph || ph.smoke !== ns) fail('provider-health cache mismatch');

// best-effort cleanup of the smoke namespace
try {
  for (const k of [`lock:${ns}`, `rl:${ns}:rl`, `cursor:${ns}:cur`, 'provider_health']) await backend.client?.del?.(k);
} catch (e) { console.warn(`smoke:redis — cleanup warning: ${e?.message || e}`); }

await backend.client?.quit?.().catch(() => {});
console.log('smoke:redis — OK: lock + ttl set/get + rate-limit + cursor + provider-health verified against Redis.');
process.exit(0);
