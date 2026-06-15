// storage-backend.mjs (apps/server — mechanism host, ADR-0001 Phase 4B.1).
// Resolves STORAGE_BACKEND=json|postgres and builds the decision-ledger store. json = the existing
// JSON store (no pg loaded). postgres = a sync facade over an in-memory working copy loaded from
// Postgres at init() and write-through-persisted (Postgres is the durable source of truth). This
// keeps decision-ledger/live-executor synchronous and UNCHANGED (parity). No dual-write, no backfill.
import { readJson, writeJson } from '../util.mjs';
import { createJsonIntentStore } from '../../../../packages/decision-ledger/src/index.mjs';
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
