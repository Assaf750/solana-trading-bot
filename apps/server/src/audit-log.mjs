// audit-log.mjs — append-only audit trail (JSONL). Every command/critical transition lands here.
// RULE: no secret material ever enters an audit record (values are refs/masked upstream).
import { appendFileSync } from 'node:fs';
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

export function appendAudit({ audit_actor, audit_scope, audit_reason, command_type, detail }) {
  ensureDataDir();
  const record = {
    audit_id: newId('aud'),
    event_timestamp: nowIso(),
    audit_actor: audit_actor || 'system',
    audit_scope: audit_scope || 'config',
    audit_reason: audit_reason || '',
    command_type: command_type || null,
    detail: scrub(detail || {}),
  };
  appendFileSync(join(DATA_DIR, AUDIT_FILE), JSON.stringify(record) + '\n', { encoding: 'utf8', mode: 0o600 });
  return record;
}

import { readFileSync, existsSync } from 'node:fs';
export function readAuditTail(limit = 100) {
  const p = join(DATA_DIR, AUDIT_FILE);
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return { corrupt_line: true };
    }
  });
}
