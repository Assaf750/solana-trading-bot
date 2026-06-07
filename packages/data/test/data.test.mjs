import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createAuditLog } from '../src/audit.mjs';
import { createRedisProjectionAdapter } from '../src/redis-adapter.mjs';
import { PG_TABLES, CH_TABLES, ALL_TABLES, AUDIT_COLUMNS, API_DATA_NAMES } from '../src/schema.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

function readMigrations() {
  const dirs = [join(ROOT, 'migrations', 'postgres'), join(ROOT, 'migrations', 'clickhouse')];
  const files = [];
  for (const d of dirs) for (const fn of readdirSync(d)) if (fn.endsWith('.sql')) files.push(join(d, fn));
  return files.map((p) => ({ path: p, sql: readFileSync(p, 'utf8') }));
}

test('audit log is append-only by construction (append/list/get only)', () => {
  const audit = createAuditLog();
  assert.equal(typeof audit.append, 'function');
  assert.equal(typeof audit.list, 'function');
  assert.equal(audit.update, undefined, 'must NOT expose update');
  assert.equal(audit.delete, undefined, 'must NOT expose delete');
  assert.equal(audit.clear, undefined, 'must NOT expose clear');
  const i = audit.append({ command_type: 'pause_system', resource_type: 'config', audit_actor: 'op1', event_sequence: 1 });
  assert.equal(i, 0);
  assert.equal(audit.length, 1);
  assert.ok(Object.isFrozen(audit.get(0)), 'entries must be frozen (immutable)');
});

test('audit log rejects columns outside SSOT audit vocabulary', () => {
  const audit = createAuditLog();
  assert.throws(() => audit.append({ not_an_audit_column: 1 }), /unknown audit column/);
  // every allowed audit column is accepted
  const entry = Object.fromEntries(AUDIT_COLUMNS.map((c) => [c, c === 'event_sequence' ? 1 : 'x']));
  assert.doesNotThrow(() => audit.append(entry));
});

test('migrations contain NO forbidden/rejected names as columns/entities', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE'); // word-boundary scan below
  for (const { path, sql } of readMigrations()) {
    for (const n of forbidden) {
      assert.equal(new RegExp(`\\b${n}\\b`).test(sql), false, `forbidden name ${n} found in ${path}`);
    }
    assert.equal(/\bHUNTABLE\b/.test(sql), false, `HUNTABLE found in ${path}`);
  }
});

test('audit_log is append-only at the DB level (no UPDATE/DELETE; triggers present)', () => {
  const migs = readMigrations();
  const guard = migs.find((m) => /0003_audit_append_only/.test(m.path));
  assert.ok(guard, '0003_audit_append_only.sql must exist');
  assert.match(guard.sql, /BEFORE UPDATE ON audit_log/i);
  assert.match(guard.sql, /BEFORE DELETE ON audit_log/i);
  assert.match(guard.sql, /RAISE EXCEPTION/i);
  // No migration issues UPDATE/DELETE statements against audit_log.
  for (const { path, sql } of migs) {
    assert.equal(/UPDATE\s+audit_log\b/i.test(sql), false, `UPDATE audit_log in ${path}`);
    assert.equal(/DELETE\s+FROM\s+audit_log\b/i.test(sql), false, `DELETE audit_log in ${path}`);
  }
});

test('no secrets / key material columns in migrations', () => {
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|secret_key|signer_material|raw[_-]?key)/i;
  for (const { path, sql } of readMigrations()) {
    assert.equal(SECRET.test(sql), false, `secret-like column in ${path}`);
  }
  // execution_wallets / signer_profiles must not declare key/seed columns.
  for (const tbl of ['execution_wallets', 'signer_profiles']) {
    for (const col of [...PG_TABLES[tbl].api, ...PG_TABLES[tbl].storage_only]) {
      assert.equal(/(private|seed|mnemonic|secret)/i.test(col), false, `${tbl}.${col} looks secret-bearing`);
    }
  }
});

test('every API-facing data name is in SSOT / 05-DATA and not forbidden', () => {
  const docs = ['docs/01-SSOT.md', 'docs/05-DATA-MODEL.md']
    .map((p) => readFileSync(join(ROOT, p), 'utf8'));
  const backtick = new Set();
  for (const text of docs) for (const m of text.matchAll(/`([^`]+)`/g)) {
    for (const tok of m[1].split(/[^A-Za-z0-9_]+/)) if (tok) backtick.add(tok);
  }
  const forbidden = new Set(FORBIDDEN_NAMES);
  for (const name of API_DATA_NAMES) {
    assert.ok(backtick.has(name), `data name not found in SSOT/05-DATA: ${name}`);
    assert.equal(forbidden.has(name), false, `forbidden data name: ${name}`);
  }
});

test('engine separation: ClickHouse holds no command-authority state tables', () => {
  // PostgreSQL owns authoritative state; ClickHouse is analytical/events/replay only.
  assert.ok('audit_log' in PG_TABLES && PG_TABLES.audit_log.append_only === true);
  assert.equal('audit_log' in CH_TABLES, false, 'audit must not be a ClickHouse source of truth');
  for (const t of ['positions', 'intents', 'operating_runtime_state']) {
    assert.ok(t in PG_TABLES, `${t} must be PostgreSQL`);
    assert.equal(t in CH_TABLES, false, `${t} must not be ClickHouse authority`);
  }
});

test('redis adapter is projection-only (restricted namespaces, no event bus, no secrets)', () => {
  const r = createRedisProjectionAdapter();
  assert.equal(r.publish, undefined, 'must NOT expose publish (no trading event bus)');
  assert.equal(r.subscribe, undefined, 'must NOT expose subscribe');
  assert.throws(() => r.set('not_a_namespace', 'k', 1), /unknown redis namespace/);
  r.set('hot_wallet_sets', 'w1', true);
  assert.equal(r.get('hot_wallet_sets', 'w1'), true);
  r.rebuild('hot_wallet_sets');
  assert.equal(r.has('hot_wallet_sets', 'w1'), false, 'rebuild must clear (projection)');
  assert.throws(() => r.set('runtime_cache', 'private_key', 'x'), /secret/i);
});
