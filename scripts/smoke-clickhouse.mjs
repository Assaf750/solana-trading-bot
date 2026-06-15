// ClickHouse event-sink smoke test (ADR-0001 Phase 7A). Proves EVENT_SINK_BACKEND=clickhouse works
// end to end: build sink -> write a test event -> read it back from analytics_events. OPT-IN and NOT
// part of `node --test`: SKIPS (exit 0) unless RUN_CLICKHOUSE_SMOKE=1 or CLICKHOUSE_URL is set. Run the
// migration first (npm run db:clickhouse:migrate). ClickHouse is append-only analytics (never SoT) —
// the smoke row is left in place. Lives OUTSIDE packages (root tooling).
import { createEventSinkBackend } from '../apps/server/src/storage/clickhouse-client.mjs';
import { mapProviderEventToRecord } from '../packages/storage/src/index.mjs';

const env = process.env;
const enabled = env.RUN_CLICKHOUSE_SMOKE === '1' || env.CLICKHOUSE_URL;
if (!enabled) {
  console.log('smoke:clickhouse — SKIPPED (set RUN_CLICKHOUSE_SMOKE=1 and CLICKHOUSE_URL to run).');
  process.exit(0);
}

const fail = (msg, e) => { console.error(`smoke:clickhouse — FAIL: ${msg}${e ? `: ${e.message || e}` : ''}`); process.exit(1); };
const ns = `smoke_${Date.now()}`;

const sink = await createEventSinkBackend({ env: { ...env, EVENT_SINK_BACKEND: 'clickhouse' } }).catch((e) => fail('createEventSinkBackend', e));
if (!sink || sink.backend !== 'clickhouse') fail('expected a clickhouse backend');

// connectivity
if (!(await sink.client.ping())) fail('ping failed (is ClickHouse up + reachable?)');

// write a test event (FAIL-OPEN writer returns { ok })
const w = await sink.writer.writeEvent(mapProviderEventToRecord({ kind: 'smoke', at: new Date().toISOString(), smoke: ns }));
if (!w.ok) fail('writeEvent', w.error);

// read it back
let count = 0;
try {
  const text = await sink.client.query(`SELECT count() FROM analytics_events WHERE event_type = 'smoke' AND payload LIKE '%${ns}%'`);
  count = Number(String(text).trim());
} catch (e) { fail('read-back query', e); }
if (!(count >= 1)) fail(`read-back found ${count} rows (expected >= 1)`);

console.log(`smoke:clickhouse — OK: ping + write + read-back verified against ClickHouse (analytics_events, ${count} smoke row).`);
process.exit(0);
