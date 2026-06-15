// clickhouse-client.mjs (apps/server — mechanism host, ADR-0001 Phase 7A).
// ClickHouse is an APPEND-ONLY analytics/event sink — NEVER source of truth (Postgres/JSON owns
// operational state; Redis is hot-state). The HTTP mechanism (fetch) lives ONLY here; packages stay
// pure and receive the INJECTED writeEvent via @soltrade/storage createInjectedEventWriter.
// Writes are FAIL-OPEN: a sink error returns { ok:false } and NEVER throws into the caller, so losing
// ClickHouse can never affect trading. See docs/architecture/package-boundaries.md.
import { createInjectedEventWriter } from '../../../../packages/storage/src/index.mjs';

/** Resolve { backend, clickhouse } from env. Fail-clear: invalid backend or clickhouse-without-config. */
export function parseClickHouseConfig(env = {}) {
  const raw = String(env.EVENT_SINK_BACKEND || 'none').trim().toLowerCase();
  if (raw !== 'none' && raw !== 'clickhouse') {
    return { ok: false, backend: raw, error: `invalid_event_sink_backend:${raw} (expected none|clickhouse)` };
  }
  if (raw === 'none') return { ok: true, backend: 'none', clickhouse: null };

  const url = env.CLICKHOUSE_URL || env.CLICKHOUSE_HTTP_URL || null;
  const host = env.CLICKHOUSE_HOST || null;
  if (!url && !host) {
    return { ok: false, backend: 'clickhouse', error: 'clickhouse_config_missing: set CLICKHOUSE_URL (or CLICKHOUSE_HOST/CLICKHOUSE_HTTP_PORT)' };
  }
  const base = (url || `http://${host}:${Number(env.CLICKHOUSE_HTTP_PORT || 8123)}`).replace(/\/+$/, '');
  const clickhouse = {
    url: base,
    database: env.CLICKHOUSE_DB || env.CLICKHOUSE_DATABASE || 'default',
    user: env.CLICKHOUSE_USER || 'default',
    password: env.CLICKHOUSE_PASSWORD || '',
  };
  return { ok: true, backend: 'clickhouse', clickhouse };
}

/**
 * Thin ClickHouse HTTP client over the injected `request` (fetch-compatible). No SDK dependency.
 *  - insert(table, rows) -> POST ?query=INSERT ... FORMAT JSONEachRow, body = newline-delimited JSON
 *  - query(sql)          -> POST body=sql (DDL / SELECT); returns response text
 *  - ping()              -> GET /ping
 */
export function createClickHouseClient(cfg, { request = (u, o) => fetch(u, o) } = {}) {
  if (!cfg || !cfg.url) throw new Error('clickhouse_client_requires_url');
  const headers = { 'X-ClickHouse-User': cfg.user || 'default', 'X-ClickHouse-Key': cfg.password || '' };
  const db = cfg.database || 'default';
  const safeText = async (res) => { try { return await res.text(); } catch { return ''; } };

  async function post({ query, body }) {
    const qp = new URLSearchParams({ database: db });
    if (query) qp.set('query', query);
    const res = await request(`${cfg.url}/?${qp.toString()}`, { method: 'POST', headers, body: body ?? '' });
    if (!res.ok) throw new Error(`clickhouse_http_${res.status}:${(await safeText(res)).slice(0, 160)}`);
    return res;
  }

  return {
    async insert(table, rows) {
      const list = Array.isArray(rows) ? rows : [rows];
      const body = list.map((r) => JSON.stringify(r)).join('\n');
      await post({ query: `INSERT INTO ${table} FORMAT JSONEachRow`, body });
      return { ok: true, count: list.length };
    },
    async query(sql) { return safeText(await post({ body: sql })); },
    async ping() { try { const res = await request(`${cfg.url}/ping`, { method: 'GET', headers }); return !!res.ok; } catch { return false; } },
  };
}

const defaultNow = () => new Date().toISOString();
// ClickHouse DateTime64 wants 'YYYY-MM-DD HH:MM:SS.sss' — normalize an ISO string.
const chTime = (v) => (typeof v === 'string' && v ? v.replace('T', ' ').replace('Z', '').slice(0, 23) : null);

/** Normalize any mapped record into the analytics_events row shape (typed meta + JSON payload). */
function toEventRow(rec = {}, now) {
  const r = rec || {};
  const event_type = r.event_type || r.kind || (r.payload && r.payload.kind) || 'event';
  const tsRaw = r.event_timestamp || r.created_at || r.quoted_at || r.at || (r.payload && r.payload.created_at) || now();
  const event_timestamp = chTime(tsRaw) || chTime(now());
  const event_sequence = Number(r.event_sequence || 0) || 0;
  let payload;
  if (r.payload !== undefined) payload = r.payload;
  else { const { event_type: _a, event_timestamp: _b, event_sequence: _c, ...rest } = r; payload = rest; }
  return { event_type, event_timestamp, event_sequence, payload: JSON.stringify(payload ?? {}) };
}

/**
 * ClickHouse event writer (the injected writeEvent). FAIL-OPEN: returns { ok:false } on any error and
 * never throws — an analytics outage must never break a trade. Accepts records from the storage mappers
 * (mapProviderEventToRecord / mapDiagnosticRunToRecord / any { event_type, event_timestamp, payload }).
 */
export function createClickHouseEventWriter({ client, table = 'analytics_events', now = defaultNow } = {}) {
  if (!client || typeof client.insert !== 'function') throw new Error('clickhouse_event_writer_requires_client');
  async function writeEvent(record) {
    try {
      await client.insert(table, [toEventRow(record, now)]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `clickhouse_write_failed:${e?.message || 'error'}` };
    }
  }
  return { writeEvent };
}

/**
 * Build the event-sink backend from env. none (DEFAULT) is a no-op writer; clickhouse builds the HTTP
 * writer (or uses an injected client for tests). Mirrors createStorageBackend / createHotStateBackend.
 * Throws clearly on bad config — never silently downgrades.
 */
export async function createEventSinkBackend({ env = {}, clickHouseClient = null, request } = {}) {
  const cfg = parseClickHouseConfig(env);
  if (!cfg.ok) throw new Error(`event_sink_backend_config_error: ${cfg.error}`);
  if (cfg.backend === 'none') {
    return { backend: 'none', writer: createInjectedEventWriter({ writeEvent: async () => ({ ok: true, sink: 'none' }) }) };
  }
  const client = clickHouseClient || createClickHouseClient(cfg.clickhouse, request ? { request } : undefined);
  const chWriter = createClickHouseEventWriter({ client });
  return { backend: 'clickhouse', writer: createInjectedEventWriter({ writeEvent: chWriter.writeEvent }), client };
}
