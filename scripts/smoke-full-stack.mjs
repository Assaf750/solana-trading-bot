// Full-stack smoke (ADR-0001 Phase 10A). Verifies the WIRED Live-First stack is reachable end to end:
// Postgres (operational SoT) + Redis (hot-state cache) + ClickHouse (analytics-only) + (optionally) the
// server's read-only API. OPT-IN and NOT part of `node --test`: SKIPS (exit 0) unless
// RUN_FULL_STACK_SMOKE=1. Sends NO transaction and changes no trading behavior. Each backend is checked
// per its own *_BACKEND env; a backend left at its safe default is reported as a skip, not a failure.
import { createStorageBackend } from '../apps/server/src/storage/storage-backend.mjs';
import { createHotStateBackend } from '../apps/server/src/storage/redis-client.mjs';
import { createEventSinkBackend } from '../apps/server/src/storage/clickhouse-client.mjs';

const env = process.env;
if (env.RUN_FULL_STACK_SMOKE !== '1') {
  console.log('smoke:full-stack — SKIPPED (set RUN_FULL_STACK_SMOKE=1; configure STORAGE/HOT_STATE/EVENT_SINK + URLs).');
  process.exit(0);
}

const results = [];
const record = (name, status, detail) => { results.push({ name, status, detail }); console.log(`  ${status === 'ok' ? '✓' : status === 'skip' ? '·' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

// ---- Postgres (operational SoT) ----
let pgClient;
try {
  const b = await createStorageBackend({ env });
  if (b.backend !== 'postgres') record('postgres', 'skip', `STORAGE_BACKEND=${b.backend} (default; not exercised)`);
  else { await b.executor.query('SELECT 1', []); pgClient = b.client; record('postgres', 'ok', 'SELECT 1'); }
} catch (e) { record('postgres', 'fail', e?.message || String(e)); }

// ---- Redis (hot-state cache; never SoT) ----
let redisBackend;
try {
  redisBackend = await createHotStateBackend({ env });
  if (redisBackend.backend !== 'redis') record('redis', 'skip', `HOT_STATE_BACKEND=${redisBackend.backend} (default; not exercised)`);
  else { await redisBackend.store.set('__fullstack_probe__', '1', 5000); await redisBackend.store.get('__fullstack_probe__'); record('redis', 'ok', 'set/get'); }
} catch (e) { record('redis', 'fail', e?.message || String(e)); }

// ---- ClickHouse (analytics-only; never SoT) ----
let chBackend;
try {
  chBackend = await createEventSinkBackend({ env });
  if (chBackend.backend !== 'clickhouse') record('clickhouse', 'skip', `EVENT_SINK_BACKEND=${chBackend.backend} (default; not exercised)`);
  else record('clickhouse', (await chBackend.client.ping()) ? 'ok' : 'fail', 'ping');
} catch (e) { record('clickhouse', 'fail', e?.message || String(e)); }

// ---- Optional read-only API checks (no transaction) ----
const base = env.SOLTRADE_BASE_URL;
if (base) {
  const hdr = { 'x-soltrade-client': '1' };
  const check = async (name, method, path, body) => {
    try {
      const res = await fetch(`${base}${path}`, { method, headers: body ? { ...hdr, 'content-type': 'application/json' } : hdr, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
      record(name, res.ok ? 'ok' : 'fail', `HTTP ${res.status}`);
    } catch (e) { record(name, 'fail', e?.message || String(e)); }
  };
  await check('api:runtime/readiness', 'GET', '/api/runtime/readiness');
  await check('api:analytics/summary', 'GET', '/api/analytics/summary?hours=24');
  await check('api:diagnostics/run', 'POST', '/api/diagnostics/run', {}); // read-only pre-flight; never trades
} else {
  record('api', 'skip', 'set SOLTRADE_BASE_URL=http://127.0.0.1:8787 to also check the API');
}

// ---- best-effort cleanup ----
try { await pgClient?.end?.(); } catch { /* ignore */ }
try { await redisBackend?.client?.quit?.(); } catch { /* ignore */ }

const failed = results.filter((r) => r.status === 'fail');
if (failed.length) { console.error(`smoke:full-stack — FAIL: ${failed.map((r) => r.name).join(', ')}`); process.exit(1); }
console.log('smoke:full-stack — OK (all configured backends reachable; no transaction sent).');
process.exit(0);
