-- ADR-0001 Phase 7A | ClickHouse free-form analytics event sink.
-- Append-only analytics ONLY — never command authority, never the operational/audit source of truth
-- (Postgres/JSON owns that). Generic event row: typed meta columns + a JSON payload for the body, so
-- DiagnosticRun / ProviderEvent / RouteQuote and future events share one sink without a migration each.
CREATE TABLE IF NOT EXISTS analytics_events (
  event_type      String,                              -- SSOT G12 (e.g. provider_health, route_quote, diagnostic_run)
  event_timestamp DateTime64(3),                       -- SSOT G12
  event_sequence  UInt64 DEFAULT 0,                    -- SSOT G12 (0 when not sequenced)
  payload         String DEFAULT '{}',                 -- JSON-encoded event body (storage-only)
  ingested_at     DateTime64(3) DEFAULT now64(3),      -- storage-only
  partition_date  Date DEFAULT toDate(event_timestamp) -- storage-only
) ENGINE = MergeTree ORDER BY (event_timestamp, event_type) PARTITION BY partition_date;
