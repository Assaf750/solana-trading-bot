// token-metadata.mjs — resolve a mint -> { symbol, name, icon } via Jupiter's public
// token search (no API key), with positive + negative caching. DISPLAY ONLY: this never
// runs on the trading hot path and a trade decision never depends on it. Any failure or
// unknown mint degrades to null so the UI falls back to the short mint address.
const SEARCH_BASE = 'https://lite-api.jup.ag/tokens/v2/search';
const TTL_MS = 24 * 60 * 60 * 1000;   // positive cache: 24h (names rarely change)
const NEG_TTL_MS = 5 * 60 * 1000;     // negative cache: 5m (a brand-new mint may list later)
const BATCH = 50;                     // mints per upstream request (comma-separated query)
const MAX_CACHE = 5000;               // bound the cache so the Radar's ever-changing mints can't grow it forever
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function createTokenMetadata({ fetchImpl = fetch, now = () => Date.now() } = {}) {
  const cache = new Map(); // mint -> { meta: {symbol,name,icon}|null, exp: epoch_ms }
  let last = 0;
  let chain = Promise.resolve();

  // Keep the cache bounded: drop expired entries first, then the oldest (Map preserves insertion
  // order) until under the cap. Prevents unbounded growth on a long-running server.
  function evict(t) {
    if (cache.size <= MAX_CACHE) return;
    for (const [k, v] of cache) if (v.exp <= t) cache.delete(k);
    while (cache.size > MAX_CACHE) {
      const k = cache.keys().next().value;
      if (k === undefined) break;
      cache.delete(k);
    }
  }

  // serialize + space upstream calls (~1.6 req/s) so display lookups never starve the
  // shared Jupiter budget the trading engine relies on for quotes.
  function throttled(fn) {
    chain = chain.then(async () => {
      const wait = Math.max(0, 600 - (now() - last));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      last = now();
      return fn();
    });
    return chain;
  }

  async function fetchBatch(mints) {
    try {
      const res = await fetchImpl(`${SEARCH_BASE}?query=${mints.join(',')}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return {};
      const arr = await res.json();
      const out = {};
      for (const t of Array.isArray(arr) ? arr : []) {
        if (t?.id) out[t.id] = { symbol: t.symbol || null, name: t.name || null, icon: t.icon || null };
      }
      return out;
    } catch {
      return {}; // network/timeout/parse — treat as "unknown", caller degrades gracefully
    }
  }

  async function resolve(rawMints) {
    const mints = [...new Set((Array.isArray(rawMints) ? rawMints : []).filter((m) => typeof m === 'string' && BASE58.test(m)))];
    const result = {};
    const missing = [];
    const t = now();
    for (const m of mints) {
      const c = cache.get(m);
      if (c && c.exp > t) { if (c.meta) result[m] = c.meta; }
      else missing.push(m);
    }
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const found = await throttled(() => fetchBatch(batch));
      for (const m of batch) {
        const meta = found[m] || null;
        cache.set(m, { meta, exp: now() + (meta ? TTL_MS : NEG_TTL_MS) });
        if (meta) result[m] = meta;
      }
    }
    evict(now());
    return result;
  }

  return { resolve };
}
