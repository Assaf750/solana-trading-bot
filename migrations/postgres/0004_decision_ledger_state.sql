-- ADR-0001 Phase 4B.1 | decision-ledger Postgres backing (build-phase, document-per-intent).
-- The decision-ledger keeps a synchronous in-memory working copy (parity with the JSON store);
-- apps/server loads it from here at boot and write-through-persists. Build-phase shape: one row per
-- intent / per trace as JSONB. Normalising into the columnar §4.4 `intents` table (via
-- @soltrade/storage mappers) is a later refinement — see docs/architecture/package-boundaries.md.
-- No private key / seed / signer material columns (09-THREAT-SECURITY).

CREATE TABLE IF NOT EXISTS decision_ledger_intents (
  intent_id   TEXT PRIMARY KEY,          -- SSOT G3 (idempotency pivot)
  intent      JSONB NOT NULL,            -- the ledger intent record (operational + canonical fields)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_ledger_traces (
  intent_id   TEXT PRIMARY KEY,          -- SSOT G3
  entries     JSONB NOT NULL,            -- ordered decision-trace entries for the intent
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
