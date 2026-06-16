// audit-log.test.mjs — ADR-0001 Phase 4B.3. Audit append-only over json (default) or Postgres.
// pg is never loaded: postgres tests inject a mock client/executor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-aud-'));

const { createAuditLog, appendAudit, readAuditTail, configureAuditStore } = await import('../src/audit-log.mjs');
const { createStorageBackend, createAuditStore, createPostgresAuditStore } = await import('../src/storage/storage-backend.mjs');

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
const memExecutor = () => {
  const calls = [];
  return { calls, query: async () => [], execute: async (sql, params) => { calls.push({ sql, params }); return { ok: true }; } };
};

// ---------- json (default) ----------
test('json audit log: appendAudit writes a scrubbed record; readAuditTail returns the tail', () => {
  const log = createAuditLog();
  const rec = log.appendAudit({ audit_scope: 'intent', audit_reason: 'r1', command_type: 'open_signer_session', detail: { private_key: 'NOPE', intent_id: 'i1' } });
  assert.match(rec.audit_id, /^aud_/);
  assert.equal(rec.audit_scope, 'intent');
  assert.equal(rec.detail.private_key, '[REDACTED]', 'secrets scrubbed');
  assert.equal(rec.detail.intent_id, 'i1');
  const tail = log.readAuditTail(50);
  assert.ok(tail.some((r) => r.audit_id === rec.audit_id));
});

// ---------- injected store ----------
test('createAuditLog({store}) routes append/read to the store', () => {
  const got = [];
  const store = { append: (r) => { got.push(r); return r; }, recent: (n) => got.slice(-n) };
  const log = createAuditLog({ store });
  const rec = log.appendAudit({ audit_scope: 'config', audit_reason: 'x', detail: { a: 1 } });
  assert.equal(got[0], rec);
  assert.deepEqual(log.readAuditTail(5), [rec]);
});

test('configureAuditStore swaps the standalone surface; null resets to json', () => {
  const got = [];
  configureAuditStore({ append: (r) => { got.push(r); return r; }, recent: (n) => got.slice(-n) });
  const rec = appendAudit({ audit_scope: 'config', audit_reason: 'via-standalone' });
  assert.equal(got.length, 1);
  assert.equal(readAuditTail(1)[0], rec);
  configureAuditStore(null); // reset to JSONL (test isolation)
  const j = appendAudit({ audit_scope: 'config', audit_reason: 'back-to-json' });
  assert.match(j.audit_id, /^aud_/);
});

// ---------- Postgres audit store ----------
test('pg audit store: init SELECT; append validates + persists; recent from ring (sync)', async () => {
  const { client, calls } = mockPg();
  const backend = await createStorageBackend({ env: { STORAGE_BACKEND: 'postgres', DATABASE_URL: 'postgres://x' }, pgClient: client });
  const store = await createAuditStore(backend);
  assert.ok(calls.some((c) => /SELECT[\s\S]*FROM audit_events/.test(c.sql)), 'init loaded recent audit');
  const rec = store.append({ audit_id: 'aud_1', event_timestamp: '2026-06-16T00:00:00.000Z', audit_actor: 'op', audit_scope: 'intent', audit_reason: 'live_sign_requested', command_type: null, detail: { intent_id: 'i1' } });
  assert.equal(rec.audit_id, 'aud_1');
  assert.equal(store.recent(10).length, 1); // ring is synchronous
  await store.flush();
  const ins = calls.find((c) => /INSERT INTO audit_events/.test(c.sql));
  assert.ok(ins, 'append-only INSERT persisted');
  assert.equal(ins.params[0], 'aud_1');
  assert.equal(ins.params[6].detail.intent_id, 'i1'); // payload JSONB
});

test('pg audit store is append-only (no update/delete) and rejects invalid AuditEvent fail-closed', () => {
  const store = createPostgresAuditStore({ executor: memExecutor() });
  assert.equal(typeof store.append, 'function');
  assert.equal(typeof store.recent, 'function');
  assert.equal(store.update, undefined);
  assert.equal(store.delete, undefined);
  assert.equal(store.put, undefined);
  // missing audit_reason => invalid contracts AuditEvent => fail-closed (not persisted)
  assert.throws(() => store.append({ audit_id: 'a', event_timestamp: 't', audit_actor: 'op', audit_scope: 'x' }), /invalid_AuditEvent/);
});

test('pg audit store: recent ring is bounded (cacheLimit)', () => {
  const store = createPostgresAuditStore({ executor: memExecutor(), cacheLimit: 2 });
  for (let i = 1; i <= 3; i += 1) {
    store.append({ audit_id: `aud_${i}`, event_timestamp: '2026-06-16T00:00:00.000Z', audit_actor: 'op', audit_scope: 'config', audit_reason: 'r', command_type: null, detail: {} });
  }
  const r = store.recent(10);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((x) => x.audit_id), ['aud_2', 'aud_3']);
});

test('pg audit store: init failure fails clearly (no silent fallback)', async () => {
  const failing = { query: async () => { throw new Error('down'); } };
  const backend = await createStorageBackend({ env: { STORAGE_BACKEND: 'postgres', DATABASE_URL: 'postgres://x' }, pgClient: failing });
  await assert.rejects(() => createAuditStore(backend), /pg_query_failed/);
});

test('json backend => createAuditStore returns null (audit-log keeps JSONL; no pg)', async () => {
  assert.equal(await createAuditStore({ backend: 'json' }), null);
  assert.equal(await createAuditStore(), null);
});
