-- ADR-0001 Phase 4B.3 | operational audit append-only in Postgres (build-phase). Mirrors the JSONL
-- audit record (audit-log.mjs); the security source of truth stays append-only — INSERT only, UPDATE
-- and DELETE blocked at the DB level (defense in depth; the app exposes no update/delete). Separate
-- from the designed §4.5 audit_log table (this is the fast direct-switch store). No secret material
-- (records are scrubbed upstream; 09-THREAT-SECURITY).

CREATE TABLE IF NOT EXISTS audit_events (
  audit_id        TEXT PRIMARY KEY,                 -- record id (newId('aud'))
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(), -- SSOT G12
  audit_actor     TEXT,                             -- SSOT G14
  audit_scope     TEXT,                             -- SSOT G14
  audit_reason    TEXT,                             -- SSOT G14
  command_type    TEXT,                             -- SSOT G11
  payload         JSONB,                            -- scrubbed detail (+ any non-column fields)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_events_append_only_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only_guard();

DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only_guard();
