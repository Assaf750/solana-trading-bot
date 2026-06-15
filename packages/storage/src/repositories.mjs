// @soltrade/storage — repository interfaces (ADR-0001 Phase 4A). Each repository wraps an INJECTED
// store/writer (memory / injected-JSON / injected-SQL shape / injected event-writer) and uses the
// pure mappers + contracts validators. Repositories own NO connection mechanism. Fail-closed on
// invalid entities; refuse unknown entities; assert data ownership from DATA_OWNERSHIP.
import { recordMapperFor, mapProviderEventToRecord } from './mappers.mjs';
import { createInjectedSqlStore } from './adapters.mjs';

function assertKvStore(store) {
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function' || typeof store.list !== 'function') {
    throw new Error('repository_requires_kv_store');
  }
}

/** Generic keyed repository for an entity that has a single id field. */
function createKvRepository({ entity, store }) {
  const m = recordMapperFor(entity); // throws on unknown entity / missing ownership
  if (!m.idField) throw new Error(`entity_${entity}_has_no_id_field`);
  assertKvStore(store);
  return Object.freeze({
    entity,
    ownership: m.ownership,
    get(id) { const rec = store.get(id); return rec ? m.fromRecord(rec) : null; },
    put(obj) {
      const id = obj && obj[m.idField];
      if (!id) throw new Error(`${entity}_missing_${m.idField}`);
      store.put(id, m.toRecord(obj)); // toRecord validates (fail-closed)
      return obj;
    },
    list() { return store.list().map((rec) => m.fromRecord(rec)); },
  });
}

export function createDecisionLedgerRepository({ store }) { return createKvRepository({ entity: 'ExecutionIntent', store }); }
export function createPositionRepository({ store }) { return createKvRepository({ entity: 'Position', store }); }
export function createDiagnosticRepository({ store }) { return createKvRepository({ entity: 'DiagnosticRun', store }); }

/** Append-only audit repository — no update/delete (matches the DB-level append-only guard). */
export function createAuditRepository({ store, now = () => new Date().toISOString() } = {}) {
  const m = recordMapperFor('AuditEvent');
  assertKvStore(store);
  let seq = 0;
  return Object.freeze({
    entity: 'AuditEvent',
    ownership: m.ownership,
    append(obj) {
      seq += 1;
      store.put(`audit:${String(seq).padStart(12, '0')}:${now()}`, m.toRecord(obj)); // toRecord validates
      return obj;
    },
    list() { return store.list().map((rec) => m.fromRecord(rec)); },
  });
}

/** Write-only analytical event repository (ClickHouse-shaped) over an injected event writer. */
export function createProviderEventRepository({ writer } = {}) {
  if (!writer || typeof writer.writeEvent !== 'function') throw new Error('provider_event_repository_requires_writer');
  return Object.freeze({
    entity: 'ProviderEvent',
    write(event) { return writer.writeEvent(mapProviderEventToRecord(event)); },
  });
}

/** Phase 4A SQL repository SHAPE: a keyed repository over the injected-SQL store. No driver import;
 *  query/execute are injected by apps/server in Phase 4B. */
export function createInjectedSqlRepository({ entity, query, execute, table }) {
  return createKvRepository({ entity, store: createInjectedSqlStore({ query, execute, table }) });
}
