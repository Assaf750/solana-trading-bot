// storage-backend.test.mjs — ADR-0001 Phase 4B.1. Postgres direct switch for decision-ledger.
// pg is NEVER loaded here: postgres tests inject a mock client. json mode loads no pg.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-stg-'));

const { parseStorageBackendConfig, createPostgresExecutor } = await import('../src/storage/postgres-client.mjs');
const { createStorageBackend, createDecisionLedgerStore, createPositionStore } = await import('../src/storage/storage-backend.mjs');
const { createDecisionLedger } = await import('../../../packages/decision-ledger/src/index.mjs');
const { createPositionsBook } = await import('../../../packages/positions/src/index.mjs');

function mockPg() {
  const calls = [];
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (/^\s*SELECT/i.test(sql)) return { rows: [] };
      return { rowCount: 1 };
    },
  };
  return { client, calls };
}

// ---------- config parsing ----------
test('config: unset => json; explicit json => json (no pg config)', () => {
  assert.deepEqual(parseStorageBackendConfig({}), { ok: true, backend: 'json', pg: null });
  assert.deepEqual(parseStorageBackendConfig({ STORAGE_BACKEND: 'json' }), { ok: true, backend: 'json', pg: null });
});

test('config: postgres with DATABASE_URL => ok; without config => clear failure', () => {
  const ok = parseStorageBackendConfig({ STORAGE_BACKEND: 'postgres', DATABASE_URL: 'postgres://u@h/db' });
  assert.equal(ok.ok, true);
  assert.equal(ok.backend, 'postgres');
  assert.deepEqual(ok.pg, { connectionString: 'postgres://u@h/db' });
  const missing = parseStorageBackendConfig({ STORAGE_BACKEND: 'postgres' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /postgres_config_missing/);
});

test('config: POSTGRES_URL is accepted as an alias; PG* host vars also work', () => {
  assert.deepEqual(parseStorageBackendConfig({ STORAGE_BACKEND: 'postgres', POSTGRES_URL: 'postgres://u@h/db' }).pg, { connectionString: 'postgres://u@h/db' });
  const byHost = parseStorageBackendConfig({ STORAGE_BACKEND: 'postgres', PGHOST: 'h', PGUSER: 'u', PGDATABASE: 'db', PGPORT: '5433' });
  assert.equal(byHost.ok, true);
  assert.equal(byHost.pg.host, 'h');
  assert.equal(byHost.pg.port, 5433);
});

test('config: invalid backend => clear failure', () => {
  const r = parseStorageBackendConfig({ STORAGE_BACKEND: 'mongo' });
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid_storage_backend:mongo/);
});

// ---------- createStorageBackend ----------
test('createStorageBackend: json returns no executor (pg never loaded)', async () => {
  const b = await createStorageBackend({ env: { STORAGE_BACKEND: 'json' } });
  assert.deepEqual(b, { backend: 'json' });
});

test('createStorageBackend: postgres with injected client builds an executor; missing config throws', async () => {
  const { client } = mockPg();
  const b = await createStorageBackend({ env: { STORAGE_BACKEND: 'postgres', DATABASE_URL: 'postgres://x' }, pgClient: client });
  assert.equal(b.backend, 'postgres');
  assert.equal(typeof b.executor.query, 'function');
  await assert.rejects(() => createStorageBackend({ env: { STORAGE_BACKEND: 'postgres' } }), /storage_backend_config_error/);
  await assert.rejects(() => createStorageBackend({ env: { STORAGE_BACKEND: 'nope' } }), /storage_backend_config_error/);
});

// ---------- executor ----------
test('executor: query/execute pass sql+params to the client and normalize results', async () => {
  const { client, calls } = mockPg();
  const ex = createPostgresExecutor({ client });
  const rows = await ex.query('SELECT 1 WHERE x=$1', ['a']);
  assert.deepEqual(rows, []);
  assert.deepEqual(calls[0], { sql: 'SELECT 1 WHERE x=$1', params: ['a'] });
  const res = await ex.execute('INSERT INTO t VALUES ($1)', ['b']);
  assert.deepEqual(res, { ok: true, rowCount: 1 });
});

test('executor: errors normalized to clear pg_query_failed / pg_execute_failed; requires client', async () => {
  const bad = createPostgresExecutor({ client: { query: async () => { const e = new Error('boom'); e.code = '42P01'; throw e; } } });
  await assert.rejects(() => bad.query('SELECT 1'), /pg_query_failed:42P01/);
  await assert.rejects(() => bad.execute('INSERT 1'), /pg_execute_failed:42P01/);
  assert.throws(() => createPostgresExecutor({}), /postgres_executor_requires_client/);
});

// ---------- decision-ledger over the Postgres store (mock executor) ----------
async function pgLedger() {
  const { client, calls } = mockPg();
  const backend = await createStorageBackend({ env: { STORAGE_BACKEND: 'postgres', DATABASE_URL: 'postgres://x' }, pgClient: client });
  const store = await createDecisionLedgerStore(backend); // init() runs SELECTs (mock -> [])
  const dl = createDecisionLedger({ store, now: () => '2026-06-16T00:00:00.000Z', intentIdFor: (p) => `int_${p.join('')}` });
  return { dl, store, calls };
}

test('pg store init runs SELECTs; claimIntent persists an intent row; duplicate rejected (in-memory)', async () => {
  const { dl, store, calls } = await pgLedger();
  assert.ok(calls.some((c) => /SELECT intent_id, intent FROM decision_ledger_intents/.test(c.sql)), 'init loaded intents');
  assert.equal(dl.claimIntent('int_a', { side: 'buy' }).ok, true);
  assert.equal(dl.claimIntent('int_a', { side: 'buy' }).ok, false, 'duplicate refused');
  await store.flush();
  const up = calls.find((c) => /INSERT INTO decision_ledger_intents/.test(c.sql));
  assert.ok(up, 'intent upserted');
  assert.equal(up.params[0], 'int_a');
  assert.equal(up.params[1].status, 'PENDING'); // legacy claim shape persisted
});

test('pg store: canonical ExecutionIntent maps to the expected persisted record shape; transitions persist', async () => {
  const { dl, store, calls } = await pgLedger();
  const intent = { intent_id: 'int_x', idempotency_key: 'k1', intent_type: 'BUY_INTENT', token_mint: 'M', size_usd: 25 };
  assert.equal(dl.createExecutionIntent(intent).ok, true);
  assert.equal(dl.markIntentPlanned('int_x').ok, true);
  assert.equal(dl.markIntentSigned('int_x').ok, true);
  assert.equal(dl.markIntentPlanned('int_x').ok, false, 'illegal transition refused'); // SIGNED -> PLANNED
  await store.flush();
  const ups = calls.filter((c) => /INSERT INTO decision_ledger_intents/.test(c.sql) && c.params[0] === 'int_x');
  const last = ups[ups.length - 1].params[1];
  assert.equal(last.intent_id, 'int_x');
  assert.equal(last.idempotency_key, 'k1');
  assert.equal(last.intent_type, 'BUY_INTENT');
  assert.equal(last.status, 'SIGNED'); // CREATED -> PLANNED -> SIGNED
});

test('pg store: a DB error at init fails clearly (no silent fallback)', async () => {
  const failing = { query: async () => { throw new Error('down'); } };
  const backend = await createStorageBackend({ env: { STORAGE_BACKEND: 'postgres', DATABASE_URL: 'postgres://x' }, pgClient: failing });
  await assert.rejects(() => createDecisionLedgerStore(backend), /pg_query_failed/);
});

// ---------- json backend store still works (no pg) ----------
test('json backend returns a working JSON store (read/write), pg untouched', async () => {
  const store = await createDecisionLedgerStore({ backend: 'json' });
  assert.equal(typeof store.read, 'function');
  assert.equal(typeof store.write, 'function');
  const dl = createDecisionLedger({ store, now: () => 'T', intentIdFor: (p) => `int_${p.join('')}` });
  assert.equal(dl.claimIntent('int_j', { side: 'buy' }).ok, true);
  assert.equal(dl.getIntent('int_j').status, 'PENDING');
});

// ---------- positions over the Postgres store (Phase 4B.2) ----------
const ENTRY = { leader_address: 'L', wallet_id: 'w', token_mint: 'M', qty_ui: 100, decimals: 6, cost_usd: 50, fee_usd_est: 1, price_impact_pct: 0.1, copy_mode: 'follow_entry_user_exit', tp_pct: null, sl_pct: null };

async function pgBook() {
  const { client, calls } = mockPg();
  const backend = await createStorageBackend({ env: { STORAGE_BACKEND: 'postgres', DATABASE_URL: 'postgres://x' }, pgClient: client });
  const store = await createPositionStore(backend, { file: 'live-portfolio.json', simulated: false });
  let n = 0;
  const book = createPositionsBook({ store, newId: (p) => `${p}_${(n += 1)}`, nowIso: () => '2026-06-16T00:00:00.000Z', simulated: false });
  return { book, store, calls };
}

test('pg position store: init reads positions; recordEntry persists a row + book meta (expected shape)', async () => {
  const { book, store, calls } = await pgBook();
  assert.ok(calls.some((c) => /SELECT position FROM positions_state/.test(c.sql)), 'init loaded positions');
  const p = book.recordEntry(ENTRY);
  await store.flush();
  const posUp = calls.find((c) => /INSERT INTO positions_state/.test(c.sql));
  assert.ok(posUp, 'position row upserted');
  assert.equal(posUp.params[0], 'live-portfolio'); // book namespace
  assert.equal(posUp.params[1], p.position_id);
  assert.equal(posUp.params[2], 'M'); // token_ref
  assert.equal(posUp.params[3], 'OPEN'); // position_state
  assert.equal(posUp.params[6].position_id, p.position_id); // full position JSONB
  assert.ok(calls.some((c) => /INSERT INTO positions_book_meta/.test(c.sql)), 'book meta upserted');
});

test('pg position store: setMark + full close persist updated state (CLOSED + closed_at)', async () => {
  const { book, store, calls } = await pgBook();
  const p = book.recordEntry(ENTRY);
  book.setMark(p.position_id, 60, 'valid');
  const r = book.recordExit({ position_id: p.position_id, fraction: 1, proceeds_usd: 80, fee_usd_est: 0, reason: 'manual_close' });
  assert.equal(r.closed, true);
  await store.flush();
  const ups = calls.filter((c) => /INSERT INTO positions_state/.test(c.sql) && c.params[1] === p.position_id);
  const last = ups[ups.length - 1];
  assert.equal(last.params[3], 'CLOSED');
  assert.ok(last.params[5], 'closed_at set');
  assert.equal(last.params[6].position_state, 'CLOSED');
});

test('pg position store: init failure fails clearly (no silent fallback)', async () => {
  const failing = { query: async () => { throw new Error('down'); } };
  const backend = await createStorageBackend({ env: { STORAGE_BACKEND: 'postgres', DATABASE_URL: 'postgres://x' }, pgClient: failing });
  await assert.rejects(() => createPositionStore(backend, { file: 'live-portfolio.json', simulated: false }), /pg_query_failed/);
});

test('json position store backend works (no pg); book roundtrip + parity surface', async () => {
  const store = await createPositionStore({ backend: 'json' }, { file: 'paper-portfolio.json', simulated: true });
  let n = 0;
  const book = createPositionsBook({ store, newId: (p) => `${p}_${(n += 1)}`, nowIso: () => '2026-06-16T00:00:00.000Z', simulated: true });
  const p = book.recordEntry(ENTRY);
  assert.equal(book.openCount(), 1);
  assert.equal(book.openPositions()[0].position_id, p.position_id);
});
