-- PR-A4 | PostgreSQL core tables (skeleton) — docs/05-DATA-MODEL.md §4.
-- API-facing columns use SSOT names; columns marked "storage-only" are internal.
-- NO private key / seed / signer material columns anywhere (09-THREAT-SECURITY).
-- Dev-only skeleton: types are generic; tuning/indexes/constraints come later.

-- §4.1 config_versions
CREATE TABLE IF NOT EXISTS config_versions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK (see note below)
  config_version    TEXT NOT NULL,                 -- SSOT G9
  config_payload    JSONB,                         -- storage-only: SSOT Groups 2,6,7,8,9 payload
  validation_status TEXT,                          -- SSOT G10 (save-time snapshot only)
  audit_actor       TEXT,                          -- SSOT G14
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(), -- SSOT G12
  superseded_at     TIMESTAMPTZ                    -- storage-only
);

-- §4.2 wallet_registry (followed/source wallets only — never execution wallets)
CREATE TABLE IF NOT EXISTS wallet_registry (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  tracked_wallet_address     TEXT NOT NULL,        -- SSOT G15
  follow_enabled             BOOLEAN,              -- SSOT G8
  take_profit_pct            NUMERIC,              -- SSOT
  copy_mode                  TEXT,                 -- SSOT G2
  per_wallet_config_payload  JSONB,                -- storage-only: per-wallet config (G8/G19/G21)
  config_version             TEXT,                 -- SSOT G9
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §4.3 positions (authoritative runtime state)
CREATE TABLE IF NOT EXISTS positions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  position_state             TEXT NOT NULL,        -- SSOT G1
  entry_brain                TEXT,                 -- SSOT G4
  current_control_brain      TEXT,                 -- SSOT G4
  market_phase               TEXT,                 -- SSOT G4
  migration_phase            TEXT,                 -- SSOT G1
  active_exit_route          TEXT,                 -- SSOT G4
  config_version_at_entry    TEXT,                 -- SSOT G9 (frozen at entry)
  cumulative_ignored_sell    NUMERIC,              -- SSOT G4 (runtime accumulator)
  position_owner_wallet_id   TEXT,                 -- SSOT G15 (only owner may sell)
  entry_execution_wallet_id  TEXT,                 -- SSOT G15
  current_execution_wallet_id TEXT,                -- SSOT G15
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  wallet_registry_fk         BIGINT,               -- storage-only FK (source followed wallet)
  execution_wallet_fk        BIGINT,               -- storage-only FK
  token_ref                  TEXT                  -- storage-only token/mint reference
);

-- §4.4 intents (IntentLedger; idempotency pivot)
CREATE TABLE IF NOT EXISTS intents (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  intent_id            TEXT NOT NULL,              -- SSOT G3
  intent_type          TEXT NOT NULL,             -- SSOT G3
  issuing_brain        TEXT,                       -- SSOT G3
  bundle_status        TEXT,                       -- SSOT G3
  failure_type         TEXT,                       -- SSOT G3
  execution_wallet_id  TEXT,                       -- SSOT G15
  signer_profile_id    TEXT,                       -- SSOT G15
  idempotency_key      TEXT,                       -- SSOT G12
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  position_fk          BIGINT,                     -- storage-only FK
  execution_wallet_fk  BIGINT,                     -- storage-only FK
  signer_profile_fk    BIGINT,                     -- storage-only FK
  retry_linkage        TEXT                        -- storage-only
);

-- §4.5 audit_log (append-only — enforcement in 0003_audit_append_only.sql)
CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK (sequential)
  audit_actor      TEXT,                           -- SSOT G14
  audit_scope      TEXT,                           -- SSOT G14
  audit_reason     TEXT,                           -- SSOT G14
  command_type     TEXT,                           -- SSOT G11
  resource_type    TEXT,                           -- SSOT G11
  permission_role  TEXT,                           -- SSOT G11
  request_id       TEXT,                           -- SSOT G12
  idempotency_key  TEXT,                           -- SSOT G12 (executive commands)
  event_sequence   BIGINT,                         -- SSOT G12
  event_timestamp  TIMESTAMPTZ NOT NULL DEFAULT now(), -- SSOT G12 (official audit time)
  api_error_code   TEXT,                           -- SSOT G11 (result on failure)
  partition_date   DATE                            -- storage-only partition key
);

-- §4.6 permissions / operator identities
CREATE TABLE IF NOT EXISTS permissions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  permission_role  TEXT NOT NULL,                  -- SSOT G11
  audit_actor      TEXT,                           -- SSOT G14 (identity reference)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  credential_ref   TEXT                            -- storage-only reference (NO secret value; see 09-SECURITY)
);

-- §4.7 execution_wallets (our wallets that own/sign — NO key material stored)
CREATE TABLE IF NOT EXISTS execution_wallets (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  execution_wallet_id       TEXT NOT NULL,         -- SSOT G15
  execution_wallet_address  TEXT,                  -- SSOT G15
  execution_wallet_status   TEXT NOT NULL,         -- SSOT G15
  key_custody_mode          TEXT,                  -- SSOT G15
  signer_profile_id         TEXT,                  -- SSOT G15
  funding_wallet_id         TEXT,                  -- SSOT G15
  settlement_wallet_id      TEXT,                  -- SSOT G15
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  signer_profile_fk         BIGINT                 -- storage-only FK
);

-- §4.8 signer_profiles (reference only — NO private key / seed)
CREATE TABLE IF NOT EXISTS signer_profiles (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  signer_profile_id     TEXT NOT NULL,             -- SSOT G15
  key_custody_mode      TEXT,                       -- SSOT G15
  signer_profile_status TEXT NOT NULL,             -- SSOT G15
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §4.9 asset_transfer_intents
CREATE TABLE IF NOT EXISTS asset_transfer_intents (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  asset_transfer_intent_id        TEXT NOT NULL,   -- SSOT G15
  asset_transfer_status           TEXT NOT NULL,   -- SSOT G15
  source_execution_wallet_id      TEXT,            -- SSOT G15
  destination_execution_wallet_id TEXT,            -- SSOT G15
  idempotency_key                 TEXT,            -- SSOT G12
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  position_fk                     BIGINT,          -- storage-only FK
  source_fk                       BIGINT,          -- storage-only FK
  destination_fk                  BIGINT           -- storage-only FK
);

-- §4.10 wallet_rotation_events
CREATE TABLE IF NOT EXISTS wallet_rotation_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  wallet_rotation_status            TEXT,          -- SSOT G15
  rotation_trigger                  TEXT,          -- SSOT G15
  rotation_from_execution_wallet_id TEXT,          -- SSOT G15
  rotation_to_execution_wallet_id   TEXT,          -- SSOT G15
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_fk                           BIGINT,        -- storage-only FK
  to_fk                             BIGINT         -- storage-only FK
);

-- §4.11 profit_sweep_events
CREATE TABLE IF NOT EXISTS profit_sweep_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  profit_sweep_policy        TEXT,                 -- SSOT G15
  profit_sweep_interval_ms   BIGINT,               -- SSOT G15
  settlement_wallet_id       TEXT,                 -- SSOT G15
  settlement_wallet_address  TEXT,                 -- SSOT G15
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_execution_wallet_fk BIGINT,               -- storage-only FK
  sweep_amount_internal      NUMERIC               -- storage-only
);

-- §4.12 token_opportunities (pre-position decision record; read-oriented, no execution authority, no P&L)
CREATE TABLE IF NOT EXISTS token_opportunities (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- storage-only PK
  hunt_status              TEXT,                   -- SSOT G16
  new_token_priority_score NUMERIC,               -- SSOT G16 (ranking only)
  recycled_token_flag      BOOLEAN,               -- SSOT G16
  name_impersonation_score NUMERIC,               -- SSOT G16
  creator_launch_rate_flag BOOLEAN,               -- SSOT G16
  token_readiness_score    NUMERIC,               -- SSOT G16
  accepted_reason          TEXT,                   -- SSOT G17
  rejected_reason          TEXT,                   -- SSOT G17
  discovery_latency_ms     BIGINT,                -- SSOT G20
  signal_to_execution_ms   BIGINT,                -- SSOT G20
  latency_to_copy          BIGINT,                -- SSOT G20
  entry_slippage_vs_leader NUMERIC,               -- SSOT G20 (observed diagnostic; not P&L)
  copyability_by_brain     JSONB,                  -- SSOT G18 (derived snapshot)
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(), -- storage-only
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(), -- storage-only
  token_ref                TEXT,                   -- storage-only token/mint reference
  wallet_registry_fk       BIGINT,                 -- storage-only FK (source attribution)
  source_events            JSONB,                  -- storage-only references
  intent_fk                BIGINT,                 -- storage-only zero-or-one FK
  position_fk              BIGINT                  -- storage-only zero-or-one FK
);

-- Skeleton only: generic types, no production indexes/tuning. Dev-apply target.
