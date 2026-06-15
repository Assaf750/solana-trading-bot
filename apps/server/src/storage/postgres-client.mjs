// postgres-client.mjs (apps/server — mechanism host, ADR-0001 Phase 4B.1).
// pg lives ONLY here (apps/server), loaded via DYNAMIC import so STORAGE_BACKEND=json never loads it.
// Packages stay pure: they receive an injected executor (query/execute). See package-boundaries.md.

/** Resolve { backend, pg } from env. Fail-clear: invalid backend or postgres-without-config errors. */
export function parseStorageBackendConfig(env = {}) {
  const raw = String(env.STORAGE_BACKEND || 'json').trim().toLowerCase();
  if (raw !== 'json' && raw !== 'postgres') {
    return { ok: false, backend: raw, error: `invalid_storage_backend:${raw} (expected json|postgres)` };
  }
  if (raw === 'json') return { ok: true, backend: 'json', pg: null };

  const url = env.DATABASE_URL || env.PG_URL || null;
  const host = env.PGHOST || env.PG_HOST || null;
  if (!url && !host) {
    return { ok: false, backend: 'postgres', error: 'postgres_config_missing: set DATABASE_URL (or PGHOST/PGUSER/PGDATABASE)' };
  }
  const pg = url
    ? { connectionString: url }
    : {
      host,
      port: Number(env.PGPORT || env.PG_PORT || 5432),
      database: env.PGDATABASE || env.PG_DATABASE || undefined,
      user: env.PGUSER || env.PG_USER || undefined,
      password: env.PGPASSWORD || env.PG_PASSWORD || undefined,
    };
  return { ok: true, backend: 'postgres', pg };
}

/** Create a real pg Pool. DYNAMIC import so json mode never requires the dependency. */
export async function createPgClient(pgConfig) {
  let pg;
  try {
    pg = await import('pg');
  } catch (e) {
    throw new Error(`postgres_driver_unavailable: install 'pg' or use STORAGE_BACKEND=json (${e?.message || e})`);
  }
  const Pool = pg.default?.Pool || pg.Pool;
  if (!Pool) throw new Error('postgres_driver_invalid: pg.Pool not found');
  return new Pool(pgConfig);
}

/**
 * Wrap a pg-like client ({ query(sql, params) }) as a normalized executor.
 *  - query(sql, params)  -> Promise<rows[]>
 *  - execute(sql, params) -> Promise<{ ok, rowCount }>
 * Errors are normalized to clear `pg_query_failed:` / `pg_execute_failed:` messages (no silent swallow).
 */
export function createPostgresExecutor({ client } = {}) {
  if (!client || typeof client.query !== 'function') throw new Error('postgres_executor_requires_client');
  async function query(sql, params = []) {
    try {
      const r = await client.query(sql, params);
      return Array.isArray(r) ? r : (r?.rows ?? []);
    } catch (e) {
      throw new Error(`pg_query_failed:${e?.code || e?.message || 'error'}`);
    }
  }
  async function execute(sql, params = []) {
    try {
      const r = await client.query(sql, params);
      return { ok: true, rowCount: r?.rowCount ?? 0 };
    } catch (e) {
      throw new Error(`pg_execute_failed:${e?.code || e?.message || 'error'}`);
    }
  }
  return { query, execute };
}
