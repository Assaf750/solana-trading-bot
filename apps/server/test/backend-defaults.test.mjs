// backend-defaults.test.mjs — ADR-0001 Phase 9B. Proves the SAFE defaults hold: the legacy|package
// engine flags default to the PACKAGE backend (legacy is a rollback shim, only on an explicit 'legacy'),
// and the storage trio defaults to json / memory / none. A regression guard so a default never silently
// flips to a legacy/heavier backend. Read-only (source patterns + pure config parsing) — no behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const code = (src) => src.replace(/\/\/.*$/gm, ''); // strip line comments before pattern checks

const { parseStorageBackendConfig } = await import('../src/storage/postgres-client.mjs');
const { parseRedisConfig } = await import('../src/storage/redis-client.mjs');
const { parseClickHouseConfig } = await import('../src/storage/clickhouse-client.mjs');

// ---------- engine rollback flags default to the package backend ----------
// (RISK_BACKEND was removed in Phase 3B.2 — its shim is gone; see the removal guard below.)
test('DECISION_LEDGER / POSITIONS flags gate legacy ONLY on the literal "legacy" (default = package)', () => {
  const cases = [
    ['DECISION_LEDGER_BACKEND', 'apps/server/src/engine/live-executor.mjs', /process\.env\.DECISION_LEDGER_BACKEND\s*===\s*'legacy'/],
    ['POSITIONS_BACKEND', 'apps/server/src/engine/paper-portfolio.mjs', /process\.env\.POSITIONS_BACKEND\s*!==\s*'legacy'/],
  ];
  for (const [flag, file, re] of cases) {
    const src = code(read(file));
    assert.ok(re.test(src), `${flag} must select legacy only on the literal 'legacy' (default=package)`);
    assert.ok(!/\|\|\s*'legacy'/.test(src), `${flag} must never default TO legacy`);
  }
});

test('RISK_BACKEND shim is REMOVED (3B.2): risk-gates delegates to @soltrade/risk, no env dispatch', () => {
  const src = read('apps/server/src/engine/risk-gates.mjs');
  assert.ok(!/process\.env\.RISK_BACKEND/.test(src), 'risk-gates.mjs must no longer dispatch on RISK_BACKEND'); // the explanatory comment may name it
  assert.ok(!/legacyCheckEntryGates/.test(src), 'the legacy in-process gate must be gone');
  assert.match(src, /from '\.\.\/\.\.\/\.\.\/\.\.\/packages\/risk\/src\/index\.mjs'/, 'delegates to @soltrade/risk');
});

test('PROVIDER_BACKEND defaults to package across every provider shim', () => {
  for (const f of ['jupiter-client', 'rpc-client', 'provider-health', 'helius-das', 'jito-tip-tx']) {
    const src = code(read(`apps/server/src/engine/${f}.mjs`));
    assert.ok(/process\.env\.PROVIDER_BACKEND\s*===\s*'legacy'/.test(src), `${f}: PROVIDER_BACKEND legacy only on explicit 'legacy'`);
    assert.ok(!/\|\|\s*'legacy'/.test(src), `${f}: must never default to legacy`);
  }
});

test('DIAGNOSTIC_BACKEND is opt-in (constructs the adapter only on explicit "package"; default = off)', () => {
  assert.ok(/process\.env\.DIAGNOSTIC_BACKEND\s*===\s*'package'/.test(code(read('apps/server/src/index.mjs'))));
});

// ---------- storage trio config defaults (pure parsing) ----------
test('storage trio defaults are safe with empty env: json / memory / none', () => {
  assert.equal(parseStorageBackendConfig({}).backend, 'json');
  assert.equal(parseRedisConfig({}).backend, 'memory');
  assert.equal(parseClickHouseConfig({}).backend, 'none');
});
