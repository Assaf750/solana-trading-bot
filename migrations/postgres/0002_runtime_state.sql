-- PR-A4 | PostgreSQL runtime-state tables (skeleton) — docs/05-DATA-MODEL.md §5.
-- operating_runtime_state is authoritative; the rest are rebuildable projections/caches.
-- API-facing columns use SSOT names; "storage-only" columns are internal.

-- §5.1 operating_runtime_state (authoritative; controls commands)
CREATE TABLE IF NOT EXISTS operating_runtime_state (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only (singleton)
  operating_state TEXT NOT NULL,                  -- SSOT G1
  disable_new_adds BOOLEAN,                        -- SSOT G4
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_transition_reason_internal TEXT             -- storage-only
);

-- §5.2 provider_stream_state (rebuildable; provider/stream health)
CREATE TABLE IF NOT EXISTS provider_stream_state (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only
  provider_degraded       BOOLEAN,                 -- SSOT G5
  slot_lag                BIGINT,                  -- SSOT G5
  last_seen_slot          BIGINT,                  -- SSOT G5
  last_confirmed_slot     BIGINT,                  -- SSOT G5
  protocol_constant_status TEXT,                   -- SSOT G5
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider_keys_internal  TEXT                     -- storage-only
);

-- §5.3 position_runtime_index (projection of positions)
CREATE TABLE IF NOT EXISTS position_runtime_index (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only
  position_state             TEXT,                 -- SSOT G1 (projected)
  current_execution_wallet_id TEXT,               -- SSOT G15 (projected)
  position_owner_wallet_id   TEXT,                 -- SSOT G15 (projected)
  position_fk                BIGINT                -- storage-only FK to positions (authority)
);

-- §5.4 execution_wallet_runtime_eligibility (derived projection; no API SSOT columns)
CREATE TABLE IF NOT EXISTS execution_wallet_runtime_eligibility (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only
  execution_wallet_fk BIGINT,                      -- storage-only FK
  signer_profile_fk   BIGINT,                      -- storage-only FK
  dependency_markers  JSONB                        -- storage-only (rebuild markers)
);

-- §5.5 derived_readiness_cache (cache of derived outputs; not a source of truth)
CREATE TABLE IF NOT EXISTS derived_readiness_cache (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only
  real_live_config_valid BOOLEAN,                  -- SSOT G10 (derived; cached)
  validation_status      TEXT,                     -- SSOT G10 (derived; cached)
  dependency_markers     JSONB                     -- storage-only (config_version + runtime markers)
);

-- §5.6 wallet_intelligence_projection (derived read-only; base columns only)
CREATE TABLE IF NOT EXISTS wallet_intelligence_projection (
  wallet_registry_fk BIGINT,                       -- storage-only FK
  copyability_by_brain JSONB,                       -- SSOT G18 (derived)
  crowd_follow_score   NUMERIC,                    -- SSOT G18 (derived)
  profit_concentration NUMERIC,                    -- SSOT G18 (derived)
  tracked_wallet_status TEXT,                       -- SSOT G18 (derived)
  dependency_markers   JSONB,                       -- storage-only
  rebuilt_at           TIMESTAMPTZ                  -- storage-only
);

-- Skeleton only: generic types, no production indexes/tuning. Dev-apply target.
