// ClickHouse migration runner (ADR-0001 Phase 7A). Applies migrations/clickhouse/*.sql in filename
// order via the apps/server ClickHouse HTTP client (mechanism host). ClickHouse runs ONE statement per
// HTTP query, so each file is split on ';'. Opt-in: needs CLICKHOUSE_URL (or CLICKHOUSE_HOST). Fails
// clearly. Lives OUTSIDE packages (root tooling) — never imported by packages.
//   Usage: EVENT_SINK_BACKEND=clickhouse CLICKHOUSE_URL=http://127.0.0.1:8123 CLICKHOUSE_DB=soltrade_dev npm run db:clickhouse:migrate
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseClickHouseConfig, createClickHouseClient } from '../apps/server/src/storage/clickhouse-client.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIG_DIR = join(ROOT, 'migrations', 'clickhouse');

const cfg = parseClickHouseConfig({ ...process.env, EVENT_SINK_BACKEND: 'clickhouse' });
if (!cfg.ok) {
  console.error(`db:clickhouse:migrate — config error: ${cfg.error}`);
  console.error('Set CLICKHOUSE_URL (or CLICKHOUSE_HOST/CLICKHOUSE_HTTP_PORT).');
  process.exit(1);
}

const files = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
if (!files.length) { console.error('db:clickhouse:migrate — no .sql files in migrations/clickhouse'); process.exit(1); }

// Strip `--` line comments BEFORE splitting on ';' — a ';' inside a comment (e.g. "SSOT names;
// storage-only ...") must NOT break statement splitting. ClickHouse DDL here has no '--' inside string
// literals, so trimming each line at its first '--' is safe.
const stripLineComments = (sql) => sql.split('\n').map((l) => { const i = l.indexOf('--'); return i >= 0 ? l.slice(0, i) : l; }).join('\n');
const statements = (sql) => stripLineComments(sql).split(';').map((s) => s.trim()).filter(Boolean);

const client = createClickHouseClient(cfg.clickhouse);
let applied = 0;
for (const f of files) {
  const stmts = statements(readFileSync(join(MIG_DIR, f), 'utf8'));
  process.stdout.write(`db:clickhouse:migrate — applying ${f} (${stmts.length} statement(s)) ... `);
  try {
    for (const stmt of stmts) await client.query(stmt);
    applied += 1;
    console.log('ok');
  } catch (e) {
    console.log('FAIL');
    console.error(`db:clickhouse:migrate — ${f} failed: ${e?.message || e}`);
    process.exit(1);
  }
}
console.log(`db:clickhouse:migrate — applied ${applied}/${files.length} migration file(s)`);
