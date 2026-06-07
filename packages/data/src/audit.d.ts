// Types for audit.mjs. Append-only audit write path.

export interface AuditEntry {
  audit_actor?: string;
  audit_scope?: string;
  audit_reason?: string;
  command_type?: string;
  resource_type?: string;
  permission_role?: string;
  request_id?: string;
  idempotency_key?: string;
  event_sequence?: number;
  event_timestamp?: string;
  /** Result code on failure. */
  api_error_code?: string;
}

export interface AppendOnlyAuditLog {
  /** The only write operation. Returns the new entry index. */
  append(entry: AuditEntry): number;
  list(): AuditEntry[];
  get(index: number): AuditEntry | undefined;
  readonly length: number;
  // Intentionally no update / delete / clear.
}

export function createAuditLog(initialEntries?: AuditEntry[]): AppendOnlyAuditLog;
