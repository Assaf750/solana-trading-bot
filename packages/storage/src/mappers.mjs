// @soltrade/storage — record mappers (ADR-0001 Phase 4A). Pure: domain entity <-> persistence
// record. Column names follow the designed schema (migrations/postgres + migrations/clickhouse,
// SSOT names); domain fields without a dedicated column go into a JSONB `payload` (idiomatic in the
// schema). Every mapper validates against @soltrade/contracts (fail-closed) and refuses unknown
// entities. node:* / db drivers are NOT imported here — see docs/architecture/package-boundaries.md.
import { validateEntity, LIVE_MODEL_ENTITIES, DATA_OWNERSHIP } from '../../contracts/src/live-model.mjs';

// domain field -> persistence column (only fields that map to a real schema column). Everything else
// is preserved losslessly in `payload`.
export const FIELD_MAPS = Object.freeze({
  ExecutionIntent: { intent_id: 'intent_id', intent_type: 'intent_type', idempotency_key: 'idempotency_key', created_at: 'created_at' },
  Position: { state: 'position_state', token_mint: 'token_ref', opened_at: 'created_at', updated_at: 'updated_at' },
  AuditEvent: { audit_scope: 'audit_scope', audit_reason: 'audit_reason', command_type: 'command_type', actor_ref: 'audit_actor', at: 'event_timestamp' },
  DiagnosticRun: { created_at: 'event_timestamp' },
  RouteQuote: { token_mint: 'token_ref', quoted_at: 'event_timestamp' },
});

// the domain id field per entity (null = no single id; append-only / write-only).
export const ID_FIELD = Object.freeze({
  ExecutionIntent: 'intent_id', Position: 'position_id', DiagnosticRun: 'run_id',
  AuditEvent: null, RouteQuote: null,
});

function toRecordRaw(entity, obj) {
  const fmap = FIELD_MAPS[entity] || {};
  const rec = {};
  const payload = {};
  for (const [field, val] of Object.entries(obj)) {
    if (fmap[field]) rec[fmap[field]] = val;
    else payload[field] = val;
  }
  if (Object.keys(payload).length) rec.payload = payload;
  return rec;
}

function fromRecordRaw(entity, rec) {
  const fmap = FIELD_MAPS[entity] || {};
  const inv = {};
  for (const [field, col] of Object.entries(fmap)) inv[col] = field;
  const out = { ...(rec.payload || {}) };
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'payload') continue;
    if (inv[k]) out[inv[k]] = v; // storage-only columns (id/FKs/updated_at-without-domain) are ignored
  }
  return out;
}

/** Mapper for a Live-First entity. Refuses unknown entities and entities with no data-ownership. */
export function recordMapperFor(entityName) {
  if (!LIVE_MODEL_ENTITIES.includes(entityName)) throw new Error(`unknown_entity:${entityName}`);
  if (!DATA_OWNERSHIP[entityName]) throw new Error(`no_data_ownership:${entityName}`);
  return Object.freeze({
    entity: entityName,
    ownership: DATA_OWNERSHIP[entityName],
    idField: ID_FIELD[entityName] ?? null,
    toRecord(obj) {
      const v = validateEntity(entityName, obj);
      if (!v.ok) throw new Error(`invalid_${entityName}:${v.errors.join(',')}`);
      return toRecordRaw(entityName, obj);
    },
    fromRecord(rec) {
      if (!rec || typeof rec !== 'object') throw new Error(`invalid_record_${entityName}:not_an_object`);
      const obj = fromRecordRaw(entityName, rec);
      const v = validateEntity(entityName, obj);
      if (!v.ok) throw new Error(`invalid_record_${entityName}:${v.errors.join(',')}`);
      return obj;
    },
  });
}

// Named convenience mappers (ADR-0001 Phase 4A scope).
export const mapExecutionIntentToRecord = (o) => recordMapperFor('ExecutionIntent').toRecord(o);
export const mapRecordToExecutionIntent = (r) => recordMapperFor('ExecutionIntent').fromRecord(r);
export const mapPositionToRecord = (o) => recordMapperFor('Position').toRecord(o);
export const mapRecordToPosition = (r) => recordMapperFor('Position').fromRecord(r);
export const mapAuditEventToRecord = (o) => recordMapperFor('AuditEvent').toRecord(o);
export const mapRecordToAuditEvent = (r) => recordMapperFor('AuditEvent').fromRecord(r);
export const mapDiagnosticRunToRecord = (o) => recordMapperFor('DiagnosticRun').toRecord(o);
export const mapRecordToDiagnosticRun = (r) => recordMapperFor('DiagnosticRun').fromRecord(r);

// Provider/analytical events (ClickHouse stream_events shape). Free-form (not a contract entity):
// meta columns event_type/event_sequence/event_timestamp + JSONB payload for the rest.
export function mapProviderEventToRecord(event = {}) {
  const {
    event_type = event.kind || 'provider_event',
    event_sequence,
    event_timestamp = event.at ?? event.created_at ?? event.quoted_at ?? null,
    kind, at, created_at, quoted_at, // consumed into meta above; not duplicated in payload
    ...rest
  } = event;
  const rec = { event_type, event_timestamp, payload: rest };
  if (event_sequence !== undefined && event_sequence !== null) rec.event_sequence = event_sequence;
  return rec;
}
export function mapRecordToProviderEvent(rec = {}) {
  const out = { event_type: rec.event_type, event_timestamp: rec.event_timestamp, ...(rec.payload || {}) };
  if (rec.event_sequence !== undefined && rec.event_sequence !== null) out.event_sequence = rec.event_sequence;
  return out;
}
