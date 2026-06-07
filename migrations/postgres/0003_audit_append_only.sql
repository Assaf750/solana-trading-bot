-- PR-A4 | audit_log append-only enforcement — docs/05-DATA-MODEL.md §4.5 / §API 11.
-- audit_log is the security source of truth: INSERT only. UPDATE and DELETE are blocked
-- at the database level (defense in depth alongside the append-only write path in
-- @soltrade/data audit.mjs, which exposes no update/delete operation).

CREATE OR REPLACE FUNCTION audit_log_append_only_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only_guard();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only_guard();
