// docs-consistency.test.mjs — ADR-0001 Phase 11A. Final consistency guards: the canonical flags
// reference documents every runtime flag + the data-layer roles (open-by-design), the .env.example
// flags stay in sync with it, and every smoke/migrate script referenced by package.json exists.
// Read-only; no behavior. (Banned-wording scans are scoped to the fresh flags doc — ADR/legacy-audit
// legitimately quote the removed lock/gate vocabulary in their correction/audit notes.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const FLAGS_DOC = 'docs/architecture/live-first-runtime-flags.md';
const BANNED_READINESS = /live_send_enabled|live send\s*:?\s*off|structurally disabled|activation[_ ]required|owner-only|hard[_ ]stop/i;

const CANONICAL_FLAGS = [
  'STORAGE_BACKEND', 'HOT_STATE_BACKEND', 'EVENT_SINK_BACKEND', 'DIAGNOSTIC_BACKEND',
  // legacy rollback flags (RISK / PROVIDER / POSITIONS / DECISION_LEDGER) all removed in the hard legacy
  // purge — their absence as live flags is guarded by no-legacy-flags-guard.test.mjs.
  'POSTGRES_URL', 'REDIS_URL', 'CLICKHOUSE_URL',
  'RUN_POSTGRES_SMOKE', 'RUN_REDIS_SMOKE', 'RUN_CLICKHOUSE_SMOKE', 'RUN_FULL_STACK_SMOKE',
];

test('flags reference exists, documents every canonical flag, and is open-by-design clean', () => {
  assert.ok(existsSync(join(ROOT, FLAGS_DOC)), 'flags doc present');
  const md = read(FLAGS_DOC);
  for (const f of CANONICAL_FLAGS) assert.ok(md.includes(f), `flags doc must document ${f}`);
  assert.ok(!BANNED_READINESS.test(md), 'flags doc carries no lock/gate/hard-stop wording');
});

test('flags reference states the data-layer roles consistently', () => {
  const md = read(FLAGS_DOC);
  assert.match(md, /operational source of truth/i);            // Postgres
  assert.ok(/hot-state/i.test(md) && /never the source of truth/i.test(md)); // Redis, not SoT
  assert.match(md, /analytics-only/i);                          // ClickHouse
  assert.ok(/JSON/i.test(md) && /default/i.test(md));           // JSON default/fallback
  assert.ok(/Diagnostics/i.test(md) && /execution\s+testing/i.test(md)); // Diagnostics = testing entry
  assert.ok(/Paper/i.test(md) && /simulation/i.test(md));       // Paper = simulation/legacy
  assert.match(md, /monitoring only/i);                         // readiness monitoring only
  assert.match(md, /open-by-design/i);
});

test('.env.example *_BACKEND flags are all documented in the flags reference', () => {
  const env = read('infra/docker/.env.example');
  const md = read(FLAGS_DOC);
  const flags = [...env.matchAll(/^([A-Z_]+_BACKEND)=/gm)].map((m) => m[1]);
  assert.ok(flags.length >= 4, 'env example defines the storage/diagnostic backend flags');
  for (const f of [...new Set(flags)]) assert.ok(md.includes(f), `${f} (in .env.example) must be in the flags doc`);
});

test('every smoke/migrate script referenced by package.json exists on disk', () => {
  const pkg = JSON.parse(read('package.json'));
  const refs = Object.values(pkg.scripts || {}).flatMap((cmd) => [...String(cmd).matchAll(/node\s+(scripts\/[\w.-]+\.mjs)/g)].map((m) => m[1]));
  assert.ok(refs.length >= 5, 'package.json references the migrate + smoke scripts');
  for (const rel of [...new Set(refs)]) assert.ok(existsSync(join(ROOT, rel)), `referenced script missing: ${rel}`);
});

test('merge-readiness note exists (Phase 11A deliverable)', () => {
  assert.ok(existsSync(join(ROOT, 'docs', 'architecture', 'merge-readiness.md')));
});
