// @soltrade/data — append-only audit write path (SSOT G14/G11/G12).
// Append-only BY CONSTRUCTION: the returned writer exposes append + read only.
// There is intentionally NO update and NO delete method (security source of truth,
// docs/05-DATA §4.5 / §API 11). Entries are validated against AUDIT_COLUMNS and frozen.
// This is a logical write path; persistence binds to the append-only `audit_log` table
// (migrations/postgres/0003_audit_append_only.sql enforces no UPDATE/DELETE in the DB).

import { AUDIT_COLUMNS } from './schema.mjs';

const ALLOWED = new Set(AUDIT_COLUMNS);

export function createAuditLog(initialEntries = []) {
  const entries = [];

  function validateAndFreeze(entry) {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('audit entry must be an object');
    }
    for (const key of Object.keys(entry)) {
      if (!ALLOWED.has(key)) throw new Error(`unknown audit column (not in SSOT audit vocabulary): ${key}`);
    }
    return Object.freeze({ ...entry });
  }

  for (const e of initialEntries) entries.push(validateAndFreeze(e));

  return Object.freeze({
    /** Append one audit entry. Returns its index. The only write operation. */
    append(entry) {
      const frozen = validateAndFreeze(entry);
      entries.push(frozen);
      return entries.length - 1;
    },
    /** Read a copy of all entries (read-only). */
    list() {
      return entries.slice();
    },
    /** Read one entry by index. */
    get(index) {
      return entries[index];
    },
    get length() {
      return entries.length;
    },
    // No update(). No delete(). No clear(). Append-only by design.
  });
}
