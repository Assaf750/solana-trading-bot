// Types for schema.mjs. Names owned by docs/05-DATA-MODEL.md + docs/01-SSOT.md.

export interface TableDef {
  engine: 'postgres' | 'clickhouse';
  /** API-facing columns (SSOT names). */
  api: readonly string[];
  /** Internal columns (PK/FK/partition/ingest markers) — NOT API fields. */
  storage_only: readonly string[];
  append_only?: boolean;
  projection?: boolean;
}

export interface RedisNamespaceDef {
  rebuild_source: string;
  ttl?: boolean;
}

export const PG_TABLES: Readonly<Record<string, TableDef>>;
export const CH_TABLES: Readonly<Record<string, TableDef>>;
export const REDIS_NAMESPACES: Readonly<Record<string, RedisNamespaceDef>>;
export const ALL_TABLES: Readonly<Record<string, TableDef>>;
export const AUDIT_COLUMNS: readonly string[];
export const API_DATA_NAMES: readonly string[];
