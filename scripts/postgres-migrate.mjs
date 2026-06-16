// Postgres migration runner (ADR-0001 Phase 4C). Applies migrations/postgres/*.sql in filename order
// using the apps/server pg client (mechanism host). Opt-in: needs POSTGRES_URL/DATABASE_URL or PG*
// env. Fails clearly. Lives OUTSIDE packages (root tooling) — never imported by packages.
//   Usage: STORAGE_BACKEND=postgres POSTGRES_URL=postgres://user:pass@host:5432/db npm run db:postgres:migrate
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseStorageBackendConfig, createPgClient } from '../apps/server/src/storage/postgres-client.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIG_DIR = join(ROOT, 'migrations', 'postgres');

const cfg = parseStorageBackendConfig({ ...process.env, STORAGE_BACKEND: 'postgres' });
if (!cfg.ok) {
  console.error(`db:postgres:migrate — config error: ${cfg.error}`);
  console.error('Set POSTGRES_URL (or DATABASE_URL / PGHOST+PGUSER+PGDATABASE).');
  process.exit(1);
}

const files = readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
if (!files.length) { console.error('db:postgres:migrate — no .sql files in migrations/postgres'); process.exit(1); }

let client;
try {
  client = await createPgClient(cfg.pg); // dynamic import('pg'); clear error if pg not installed
} catch (e) {
  console.error(`db:postgres:migrate — ${e?.message || e}`);
  process.exit(1);
}

let applied = 0;
try {
  for (const f of files) {
    const sql = readFileSync(join(MIG_DIR, f), 'utf8');
    process.stdout.write(`db:postgres:migrate — applying ${f} ... `);
    try {
      await client.query(sql); // simple-query protocol: supports multiple statements + $$ bodies
      applied += 1;
      console.log('ok');
    } catch (e) {
      console.log('FAIL');
      console.error(`db:postgres:migrate — ${f} failed: ${e?.message || e}`);
      process.exit(1);
    }
  }
  console.log(`db:postgres:migrate — applied ${applied}/${files.length} migration(s)`);
} finally {
  await client.end?.();
}
