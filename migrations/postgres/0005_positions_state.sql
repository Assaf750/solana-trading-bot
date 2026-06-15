-- ADR-0001 Phase 4B.2 | positions Postgres backing (build-phase). Separate from the designed §4.3
-- columnar `positions` table — this is a fast, denormalized direct-switch store keyed by (book,
-- position_id) with the full operational position object as JSONB, plus a per-book aggregates row
-- ({trades, realized_pnl_usd, daily, simulated}). apps/server loads it into a synchronous in-memory
-- working copy at boot and write-through-persists (parity with the JSON book). Normalising into §4.3
-- is a later refinement. No private key / seed / signer material (09-THREAT-SECURITY).

CREATE TABLE IF NOT EXISTS positions_state (
  book           TEXT NOT NULL,          -- which book: 'paper-portfolio' | 'live-portfolio'
  position_id    TEXT NOT NULL,          -- SSOT G-position id
  token_ref      TEXT,                   -- token/mint reference (storage-only key)
  position_state TEXT,                   -- SSOT G1
  opened_at      TIMESTAMPTZ,
  closed_at      TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  position       JSONB NOT NULL,         -- full operational position object
  PRIMARY KEY (book, position_id)
);

CREATE TABLE IF NOT EXISTS positions_book_meta (
  book        TEXT PRIMARY KEY,          -- 'paper-portfolio' | 'live-portfolio'
  meta        JSONB NOT NULL,            -- { simulated, trades[], realized_pnl_usd, daily }
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
