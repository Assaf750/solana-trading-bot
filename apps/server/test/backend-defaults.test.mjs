// backend-defaults.test.mjs — proves the LIVE operational backend flags default safely: the storage
// trio (STORAGE_BACKEND / HOT_STATE_BACKEND / EVENT_SINK_BACKEND) resolves to json / memory / none with
// empty env, and the diagnostic surface is opt-in. These are real operational backends, not legacy
// rollback shims. The legacy rollback flags (RISK / PROVIDER / POSITIONS / DECISION_LEDGER) were all
// removed in the hard legacy purge — that is guarded by no-legacy-flags-guard.test.mjs. Read-only.
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

test('DIAGNOSTIC_BACKEND is opt-in (constructs the adapter only on explicit "package"; default = off)', () => {
  assert.ok(/process\.env\.DIAGNOSTIC_BACKEND\s*===\s*'package'/.test(code(read('apps/server/src/index.mjs'))));
});

test('storage trio defaults are safe with empty env: json / memory / none', () => {
  assert.equal(parseStorageBackendConfig({}).backend, 'json');
  assert.equal(parseRedisConfig({}).backend, 'memory');
  assert.equal(parseClickHouseConfig({}).backend, 'none');
});
