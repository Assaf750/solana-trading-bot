-- PR-A4 | ClickHouse analytical tables (skeleton) — docs/05-DATA-MODEL.md §6.
-- Analytical/events/replay projection ONLY — never command authority, never the audit
-- source of truth. API-facing columns use SSOT names; "storage-only" columns are internal.
-- No raw fill price / P&L columns (those are rejected/candidate names — excluded).

-- §6.1 stream_events
CREATE TABLE IF NOT EXISTS stream_events (
  event_type     String,                           -- SSOT G12
  event_sequence UInt64,                           -- SSOT G12
  event_timestamp DateTime64(3),                   -- SSOT G12
  ingested_at    DateTime64(3) DEFAULT now64(3),   -- storage-only
  source_topic   String,                           -- storage-only
  partition_date Date DEFAULT toDate(event_timestamp) -- storage-only
) ENGINE = MergeTree ORDER BY (event_timestamp, event_sequence) PARTITION BY partition_date;

-- §6.2 trade_fills (analytical; PostgreSQL keeps authoritative accounting)
CREATE TABLE IF NOT EXISTS trade_fills (
  intent_id          String,                       -- SSOT G3
  execution_wallet_id String,                      -- SSOT G15
  signer_profile_id  String,                       -- SSOT G15
  event_timestamp    DateTime64(3),                -- SSOT G12
  ingested_at        DateTime64(3) DEFAULT now64(3), -- storage-only
  partition_date     Date DEFAULT toDate(event_timestamp) -- storage-only
) ENGINE = MergeTree ORDER BY (event_timestamp, intent_id) PARTITION BY partition_date;

-- §6.3 execution_outcomes
CREATE TABLE IF NOT EXISTS execution_outcomes (
  intent_id      String,                           -- SSOT G3
  bundle_status  String,                           -- SSOT G3
  failure_type   String,                           -- SSOT G3
  event_timestamp DateTime64(3),                   -- SSOT G12
  ingested_at    DateTime64(3) DEFAULT now64(3),   -- storage-only
  attempt_id_internal String,                      -- storage-only
  tx_signature_internal String,                    -- storage-only
  partition_date Date DEFAULT toDate(event_timestamp) -- storage-only
) ENGINE = MergeTree ORDER BY (event_timestamp, intent_id) PARTITION BY partition_date;

-- §6.4 wallet_observations
CREATE TABLE IF NOT EXISTS wallet_observations (
  tracked_wallet_address String,                   -- SSOT G15
  copy_event     String,                           -- SSOT G3
  event_timestamp DateTime64(3),                   -- SSOT G12
  ingested_at    DateTime64(3) DEFAULT now64(3),   -- storage-only
  partition_date Date DEFAULT toDate(event_timestamp) -- storage-only
) ENGINE = MergeTree ORDER BY (event_timestamp, tracked_wallet_address) PARTITION BY partition_date;

-- §6.5 replay_backtest_observations
CREATE TABLE IF NOT EXISTS replay_backtest_observations (
  event_timestamp DateTime64(3),                   -- SSOT G12
  ingested_at    DateTime64(3) DEFAULT now64(3),   -- storage-only
  backtest_run_id_internal String,                 -- storage-only
  partition_date Date DEFAULT toDate(event_timestamp) -- storage-only
) ENGINE = MergeTree ORDER BY event_timestamp PARTITION BY partition_date;

-- §6.6 metrics_timeseries
CREATE TABLE IF NOT EXISTS metrics_timeseries (
  event_timestamp DateTime64(3),                   -- SSOT G12
  ingested_at    DateTime64(3) DEFAULT now64(3),   -- storage-only
  metric_keys_internal String,                     -- storage-only
  partition_date Date DEFAULT toDate(event_timestamp) -- storage-only
) ENGINE = MergeTree ORDER BY event_timestamp PARTITION BY partition_date;
