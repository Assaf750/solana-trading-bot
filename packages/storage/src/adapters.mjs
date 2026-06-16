// @soltrade/storage — store adapters (ADR-0001 Phase 4A). All mechanisms are INJECTED; this file
// imports no node:fs, no db driver, no network. KV store interface: get(id)/put(id,rec)/list()/has(id).

/** In-memory KV store (tests / ephemeral). Insertion order preserved (Map). */
export function createMemoryStore() {
  const map = new Map();
  return {
    get: (id) => (map.has(id) ? map.get(id) : null),
    put: (id, rec) => { map.set(id, rec); },
    list: () => [...map.values()],
    has: (id) => map.has(id),
    size: () => map.size,
  };
}

/**
 * JSON-backed KV store over INJECTED readJson/writeJson (apps/server util.mjs shape:
 * readJson(file, fallback) -> { value, corrupt }). NO node:fs here — the host injects the IO.
 * The whole collection lives under one JSON doc: { [collection]: { [id]: record } }.
 */
export function createInjectedJsonStore({ readJson, writeJson, file, collection = 'records' } = {}) {
  if (typeof readJson !== 'function' || typeof writeJson !== 'function' || !file) {
    throw new Error('injected_json_store_requires_readJson_writeJson_and_file');
  }
  const load = () => {
    const r = readJson(file, { [collection]: {} });
    const v = (r && typeof r === 'object' && 'value' in r) ? r.value : r;
    const doc = (v && typeof v === 'object') ? v : { [collection]: {} };
    if (!doc[collection] || typeof doc[collection] !== 'object') doc[collection] = {};
    return doc;
  };
  return {
    get: (id) => { const d = load(); return d[collection][id] ?? null; },
    put: (id, rec) => { const d = load(); d[collection][id] = rec; writeJson(file, d); },
    list: () => Object.values(load()[collection]),
    has: (id) => id in load()[collection],
  };
}

/**
 * SQL KV store SHAPE (Phase 4A — no real driver). Delegates to INJECTED query/execute with a
 * structured operation descriptor; apps/server (Phase 4B) supplies a real pg-backed query/execute.
 * NO `pg` import, no SQL strings here — this only proves the shape + the injection seam.
 */
export function createInjectedSqlStore({ query, execute, table } = {}) {
  if (typeof query !== 'function' || typeof execute !== 'function' || !table) {
    throw new Error('injected_sql_store_requires_query_execute_and_table');
  }
  return {
    get: (id) => query({ op: 'select_by_id', table, id }),
    put: (id, rec) => execute({ op: 'upsert', table, id, record: rec }),
    list: () => query({ op: 'select_all', table }) || [],
    has: (id) => query({ op: 'exists', table, id }) === true,
  };
}

/**
 * Event-writer SHAPE for append-only analytical sinks (ClickHouse). Delegates to INJECTED writeEvent.
 * NO clickhouse driver import — apps/server (Phase 4B) supplies the real writer.
 */
export function createInjectedEventWriter({ writeEvent } = {}) {
  if (typeof writeEvent !== 'function') throw new Error('injected_event_writer_requires_writeEvent');
  return { writeEvent: (rec) => writeEvent(rec) };
}
