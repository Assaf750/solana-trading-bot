// audit-log.mjs — append-only audit trail. Default = JSONL (json mode). When an audit store is
// injected (STORAGE_BACKEND=postgres, ADR-0001 Phase 4B.3) records go to Postgres instead. The public
// surface (appendAudit / readAuditTail) is unchanged; index.mjs calls configureAuditStore() at boot.
// RULE: no secret material ever enters an audit record (values are refs/masked upstream).
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, ensureDataDir, newId, nowIso } from './util.mjs';

const AUDIT_FILE = 'audit.jsonl';
const FORBIDDEN_KEYS = ['api_key', 'private_key', 'secret', 'seed', 'passphrase', 'keypair', 'mnemonic', 'raw_key'];

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.some((f) => k.toLowerCase().includes(f))) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = scrub(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Audit log over an optional injected store (store=null => JSONL). Returns { appendAudit, readAuditTail }. */
export function createAuditLog({ store = null } = {}) {
  function appendAudit({ audit_actor, audit_scope, audit_reason, command_type, detail } = {}) {
    const record = {
      audit_id: newId('aud'),
      event_timestamp: nowIso(),
      audit_actor: audit_actor || 'system',
      audit_scope: audit_scope || 'config',
      audit_reason: audit_reason || '',
      command_type: command_type || null,
      detail: scrub(detail || {}),
    };
    if (store) { store.append(record); return record; } // postgres (validates fail-closed + persists)
    ensureDataDir();
    appendFileSync(join(DATA_DIR, AUDIT_FILE), JSON.stringify(record) + '\n', { encoding: 'utf8', mode: 0o600 });
    return record;
  }

  function readAuditTail(limit = 100) {
    if (store) return store.recent(limit);
    const p = join(DATA_DIR, AUDIT_FILE);
    if (!existsSync(p)) return [];
    const lines = readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map((l) => {
      try { return JSON.parse(l); } catch { return { corrupt_line: true }; }
    });
  }

  return { appendAudit, readAuditTail };
}

// Default instance (JSONL) + a one-time swap used by the boot wiring. The standalone exports delegate
// to the active instance so every existing caller (and `audit: appendAudit` deps) is unchanged.
let _active = createAuditLog();
export function configureAuditStore(store) { _active = createAuditLog({ store: store || null }); }
export function appendAudit(args) { return _active.appendAudit(args); }
export function readAuditTail(limit) { return _active.readAuditTail(limit); }
