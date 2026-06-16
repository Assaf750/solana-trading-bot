// storage-backend.mjs (apps/server — mechanism host, ADR-0001 Phase 4B.1).
// Resolves STORAGE_BACKEND=json|postgres and builds the decision-ledger store. json = the existing
// JSON store (no pg loaded). postgres = a sync facade over an in-memory working copy loaded from
// Postgres at init() and write-through-persisted (Postgres is the durable source of truth). This
// keeps decision-ledger/live-executor synchronous and UNCHANGED (parity). No dual-write, no backfill.
import { readJson, writeJson } from '../util.mjs';
import { createJsonIntentStore } from '../../../../packages/decision-ledger/src/index.mjs';
import { createJsonPositionStore } from '../../../../packages/positions/src/index.mjs';
import { mapAuditEventToRecord } from '../../../../packages/storage/src/index.mjs';
import { parseStorageBackendConfig, createPgClient, createPostgresExecutor } from './postgres-client.mjs';

const INTENTS_FILE = 'intent-ledger.json';

/** Build the active storage backend. Fail-clear (throws) on bad config; never silent-fallback. */
export async function createStorageBackend({ env = {}, pgClient = null } = {}) {
  const cfg = parseStorageBackendConfig(env);
  if (!cfg.ok) throw new Error(`storage_backend_config_error:${cfg.error}`);
  if (cfg.backend === 'json') return { backend: 'json' };
  const client = pgClient || (await createPgClient(cfg.pg));
  const executor = createPostgresExecutor({ client });
  return { backend: 'postgres', executor, client };
}

/**
 * Postgres-backed decision-ledger store. Exposes the synchronous read()/write() document interface
 * decision-ledger expects, over an in-memory working copy. init() loads from Postgres; write()
 * updates memory synchronously and schedules a serialized write-through persist; flush() awaits it.
 * Build-phase: persists the whole working set (low volume) — a per-row delta is a later refinement.
 */
export function createPostgresDecisionLedgerStore({ executor } = {}) {
  if (!executor || typeof executor.query !== 'function' || typeof executor.execute !== 'function') {
    throw new Error('postgres_decision_ledger_store_requires_executor');
  }
  let doc = { intents: {}, traces: {} };
  let chain = Promise.resolve();
  let lastError = null;

  async function init() {
    const intentRows = await executor.query('SELECT intent_id, intent FROM decision_ledger_intents', []);
    const traceRows = await executor.query('SELECT intent_id, entries FROM decision_ledger_traces', []);
    const d = { intents: {}, traces: {} };
    for (const row of intentRows || []) d.intents[row.intent_id] = row.intent;
    for (const row of traceRows || []) d.traces[row.intent_id] = row.entries;
    doc = d;
    return d;
  }

  async function persist(value) {
    for (const [id, intent] of Object.entries(value.intents || {})) {
      await executor.execute(
        'INSERT INTO decision_ledger_intents (intent_id, intent) VALUES ($1, $2) ON CONFLICT (intent_id) DO UPDATE SET intent = $2, updated_at = now()',
        [id, intent],
      );
    }
    for (const [id, entries] of Object.entries(value.traces || {})) {
      await executor.execute(
        'INSERT INTO decision_ledger_traces (intent_id, entries) VALUES ($1, $2) ON CONFLICT (intent_id) DO UPDATE SET entries = $2, updated_at = now()',
        [id, entries],
      );
    }
  }

  function read() { return { value: doc, corrupt: false }; }
  function write(value) {
    doc = value;
    const snapshot = { intents: { ...(value.intents || {}) }, traces: { ...(value.traces || {}) } };
    chain = chain.then(() => persist(snapshot)).catch((e) => { lastError = e; });
  }
  async function flush() {
    await chain;
    if (lastError) { const e = lastError; lastError = null; throw e; }
  }

  return { read, write, init, flush };
}

/** Return the decision-ledger store for the active backend (json store, or initialized pg store). */
export async function createDecisionLedgerStore(backend) {
  if (!backend || backend.backend === 'json') {
    return createJsonIntentStore({ file: INTENTS_FILE, readJson, writeJson, fallback: { intents: {} } });
  }
  if (backend.backend === 'postgres') {
    const store = createPostgresDecisionLedgerStore({ executor: backend.executor });
    await store.init();
    return store;
  }
  throw new Error(`unknown_storage_backend:${backend.backend}`);
}

/**
 * Postgres-backed positions book store. Same pattern as the decision-ledger store: a synchronous
 * in-memory working copy (read()/write() document interface the positions book expects), loaded from
 * Postgres at init() and write-through-persisted. `book` namespaces the rows (paper vs live). The full
 * operational position object is stored as JSONB; per-book aggregates (trades/realized/daily/simulated)
 * live in positions_book_meta. Build-phase: persists the whole working set (low volume).
 */
export function createPostgresPositionStore({ executor, book } = {}) {
  if (!executor || typeof executor.query !== 'function' || typeof executor.execute !== 'function') {
    throw new Error('postgres_position_store_requires_executor');
  }
  if (!book) throw new Error('postgres_position_store_requires_book');
  let doc = null; // null => empty book (book load() falls back to EMPTY, matching the JSON store)
  let chain = Promise.resolve();
  let lastError = null;

  async function init() {
    const posRows = await executor.query('SELECT position FROM positions_state WHERE book = $1 ORDER BY opened_at NULLS LAST, position_id', [book]);
    const metaRows = await executor.query('SELECT meta FROM positions_book_meta WHERE book = $1', [book]);
    const positions = (posRows || []).map((r) => r.position);
    const meta = (metaRows && metaRows[0] && metaRows[0].meta) || null;
    if (!positions.length && !meta) { doc = null; return doc; }
    doc = {
      simulated: meta ? meta.simulated : undefined,
      positions,
      trades: (meta && meta.trades) || [],
      realized_pnl_usd: (meta && meta.realized_pnl_usd) || 0,
      daily: (meta && meta.daily) || { date: null, realized_pnl_usd: 0, entries_blocked: false },
    };
    return doc;
  }

  async function persist(value) {
    await executor.execute(
      'INSERT INTO positions_book_meta (book, meta) VALUES ($1, $2) ON CONFLICT (book) DO UPDATE SET meta = $2, updated_at = now()',
      [book, { simulated: value.simulated, trades: value.trades || [], realized_pnl_usd: value.realized_pnl_usd || 0, daily: value.daily }],
    );
    for (const p of value.positions || []) {
      await executor.execute(
        'INSERT INTO positions_state (book, position_id, token_ref, position_state, opened_at, closed_at, position) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (book, position_id) DO UPDATE SET token_ref = $3, position_state = $4, opened_at = $5, closed_at = $6, position = $7, updated_at = now()',
        [book, p.position_id, p.token_mint ?? null, p.position_state ?? null, p.entry_ts ?? null, p.closed_at ?? null, p],
      );
    }
  }

  function read() { return { value: doc, corrupt: false }; }
  function write(value) {
    doc = value;
    const snapshot = { simulated: value.simulated, positions: [...(value.positions || [])], trades: value.trades, realized_pnl_usd: value.realized_pnl_usd, daily: value.daily };
    chain = chain.then(() => persist(snapshot)).catch((e) => { lastError = e; });
  }
  async function flush() {
    await chain;
    if (lastError) { const e = lastError; lastError = null; throw e; }
  }

  return { read, write, init, flush };
}

/** Return the positions book store for the active backend (json store, or initialized pg store). */
export async function createPositionStore(backend, { file, simulated = true } = {}) {
  if (!file) throw new Error('create_position_store_requires_file');
  if (!backend || backend.backend === 'json') {
    return createJsonPositionStore({ file, readJson, writeJson });
  }
  if (backend.backend === 'postgres') {
    const store = createPostgresPositionStore({ executor: backend.executor, book: file.replace(/\.json$/, '') });
    await store.init();
    return store;
  }
  throw new Error(`unknown_storage_backend:${backend.backend}`);
}

function auditRowToRecord(r) {
  return {
    audit_id: r.audit_id,
    event_timestamp: r.event_timestamp,
    audit_actor: r.audit_actor,
    audit_scope: r.audit_scope,
    audit_reason: r.audit_reason,
    command_type: r.command_type ?? null,
    detail: (r.payload && r.payload.detail) ?? r.payload ?? {},
  };
}

/**
 * Postgres append-only audit store. append(record) validates the record SYNCHRONOUSLY via
 * @soltrade/storage (contracts AuditEvent — fail-closed) so an invalid record is rejected on the spot
 * (preserving the synchronous fail-closed audit-before-sign guarantee), then write-through-INSERTs
 * (build-phase write-behind; durability via flush()). A bounded in-memory ring serves recent()
 * synchronously (loaded from Postgres at init()). No update/delete (append-only).
 */
export function createPostgresAuditStore({ executor, cacheLimit = 500 } = {}) {
  if (!executor || typeof executor.query !== 'function' || typeof executor.execute !== 'function') {
    throw new Error('postgres_audit_store_requires_executor');
  }
  const ring = [];
  let chain = Promise.resolve();
  let lastError = null;

  async function init() {
    const rows = await executor.query(
      'SELECT audit_id, event_timestamp, audit_actor, audit_scope, audit_reason, command_type, payload FROM audit_events ORDER BY event_timestamp DESC, audit_id DESC LIMIT $1',
      [cacheLimit],
    );
    ring.length = 0;
    for (const r of (rows || []).slice().reverse()) ring.push(auditRowToRecord(r)); // chronological
    return ring.length;
  }

  function append(record) {
    // synchronous fail-closed validation (translate legacy record -> contracts AuditEvent)
    const evt = {
      audit_scope: record.audit_scope, audit_reason: record.audit_reason, command_type: record.command_type,
      actor_ref: record.audit_actor, detail: record.detail, at: record.event_timestamp,
    };
    const mapped = mapAuditEventToRecord(evt); // throws invalid_AuditEvent on bad input
    ring.push(record);
    if (ring.length > cacheLimit) ring.shift();
    const params = [record.audit_id, record.event_timestamp, record.audit_actor, record.audit_scope, record.audit_reason, record.command_type ?? null, mapped.payload ?? { detail: record.detail }];
    chain = chain.then(() => executor.execute(
      'INSERT INTO audit_events (audit_id, event_timestamp, audit_actor, audit_scope, audit_reason, command_type, payload) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      params,
    )).catch((e) => { lastError = e; });
    return record;
  }

  function recent(limit = 100) { return ring.slice(-limit); }
  async function flush() {
    await chain;
    if (lastError) { const e = lastError; lastError = null; throw e; }
  }

  return { append, recent, init, flush };
}

/** Audit store for the active backend: json => null (audit-log uses its JSONL default); postgres =>
 *  an initialized append-only Postgres audit store. */
export async function createAuditStore(backend) {
  if (!backend || backend.backend === 'json') return null;
  if (backend.backend === 'postgres') {
    const store = createPostgresAuditStore({ executor: backend.executor });
    await store.init();
    return store;
  }
  throw new Error(`unknown_storage_backend:${backend.backend}`);
}
