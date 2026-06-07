// @soltrade/data — Redis/RAM projection adapter (docs/05-DATA §7).
// PROJECTION/CACHE ONLY — never a source of truth, always rebuildable from PostgreSQL/
// ClickHouse/stream events. Namespaces are restricted to the registered SSOT-doc set.
//
// EXPLICIT NON-GOALS (PR-A4): NO live trading event bus, NO publish/subscribe execution
// channel, NO order routing, NO secrets (no key/seed/signer material may be stored here).
// This default implementation is in-memory (no live Redis connection) — a thin adapter
// boundary only.

import { REDIS_NAMESPACES } from './schema.mjs';

const NAMESPACES = new Set(Object.keys(REDIS_NAMESPACES));
const SECRET_HINT = /(private[_-]?key|seed|mnemonic|signer[_-]?material|secret|api[_-]?key)/i;

export function createRedisProjectionAdapter() {
  const store = new Map(); // namespace -> Map<key, value>

  function bucket(namespace) {
    if (!NAMESPACES.has(namespace)) throw new Error(`unknown redis namespace (not in SSOT-doc set): ${namespace}`);
    if (!store.has(namespace)) store.set(namespace, new Map());
    return store.get(namespace);
  }

  function guardNoSecret(key) {
    if (typeof key === 'string' && SECRET_HINT.test(key)) {
      throw new Error('refusing to store secret-like material in a Redis projection (forbidden)');
    }
  }

  return Object.freeze({
    namespaces: Object.freeze([...NAMESPACES]),
    set(namespace, key, value) {
      guardNoSecret(key);
      bucket(namespace).set(key, value);
    },
    get(namespace, key) {
      return bucket(namespace).get(key);
    },
    has(namespace, key) {
      return bucket(namespace).has(key);
    },
    /** Projection: a namespace can always be discarded and rebuilt from its source. */
    rebuild(namespace) {
      bucket(namespace); // validate name
      store.set(namespace, new Map());
    },
    rebuildSource(namespace) {
      if (!NAMESPACES.has(namespace)) throw new Error(`unknown redis namespace: ${namespace}`);
      return REDIS_NAMESPACES[namespace].rebuild_source;
    },
    // No publish(). No subscribe(). No order/exec channel. Projection cache only.
  });
}
