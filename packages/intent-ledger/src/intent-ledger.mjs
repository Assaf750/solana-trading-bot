// @soltrade/intent-ledger — IntentLedger (Gate B / B2).
// SOURCE: docs/00-ARCHITECTURE.md §15.1 (IntentLedger) + docs/05-DATA-MODEL.md §4.4 (intents)
// + docs/01-SSOT.md G3/G12 + docs/03-API-CONTRACT §11 (idempotency).
// Deterministic, in-memory only. NO real DB writes, NO execution, NO signing/sending, NO network.
//
// INVARIANTS:
//  - No intent without intent_id; no order object without an intent reference.
//  - idempotency_key (and intent_id) are unique -> duplicates rejected with IDEMPOTENCY_CONFLICT.
//  - Terminal intents are retained (no delete API at all).
//  - Retry requires an explicit replacement (new intent_id + new idempotency_key).

import { INTENT_TYPE, BUNDLE_STATUS, FAILURE_TYPE } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';

const CONFLICT = 'IDEMPOTENCY_CONFLICT'; // SSOT G11 (must exist)
if (!API_ERROR_CODE.includes(CONFLICT)) throw new Error('internal: IDEMPOTENCY_CONFLICT missing from api_error_code');

// Terminal bundle outcomes (SSOT G3 values). Pending / STALE_BUNDLE are NOT terminal.
const TERMINAL_BUNDLE = new Set(['Landed', 'Failed', 'Invalid']);

const isStr = (v) => typeof v === 'string' && v.length > 0;

/** Guard: an order object must carry an intent reference (intent_id). */
export function assertOrderHasIntent(order) {
  if (!order || typeof order !== 'object' || !isStr(order.intent_id)) {
    throw new Error('no order object without an intent reference (intent_id required)');
  }
  return order.intent_id;
}

export function isTerminalBundleStatus(bundle_status) {
  return TERMINAL_BUNDLE.has(bundle_status);
}

function validateNew(intent) {
  if (intent == null || typeof intent !== 'object') return 'intent_required';
  if (!isStr(intent.intent_id)) return 'intent_id_required';
  if (!INTENT_TYPE.includes(intent.intent_type)) return 'invalid_intent_type';
  if (!isStr(intent.idempotency_key)) return 'idempotency_key_required';
  if (intent.bundle_status != null && !BUNDLE_STATUS.includes(intent.bundle_status)) return 'invalid_bundle_status';
  if (intent.failure_type != null && !FAILURE_TYPE.includes(intent.failure_type)) return 'invalid_failure_type';
  return null;
}

export function createIntentLedger({ audit } = {}) {
  const byId = new Map();   // intent_id -> frozen record
  const byIdem = new Map(); // idempotency_key -> intent_id
  const auditSink = audit || createAuditLog(); // in-memory append-only; NOT a DB

  const audited = (entry) => auditSink.append({ resource_type: 'intent', ...entry });

  function insert(intent, replacesId) {
    const err = validateNew(intent);
    if (err) return { ok: false, reason: err };
    if (byIdem.has(intent.idempotency_key) || byId.has(intent.intent_id)) {
      const existing = byIdem.get(intent.idempotency_key) ?? intent.intent_id;
      return { ok: false, api_error_code: CONFLICT, reason: 'duplicate_command', existing_intent_id: existing };
    }
    const rec = Object.freeze({
      ...intent,
      replaces_intent_id: replacesId ?? null, // internal retry/replacement linkage (DATA §4.4 storage-only)
      updated_at: intent.updated_at ?? intent.created_at ?? null,
    });
    byId.set(rec.intent_id, rec);
    byIdem.set(rec.idempotency_key, rec.intent_id);
    audited({ idempotency_key: rec.idempotency_key, request_id: rec.request_id });
    return { ok: true, intent_id: rec.intent_id };
  }

  return Object.freeze({
    create(intent) {
      return insert(intent, null);
    },
    get(intent_id) {
      return byId.get(intent_id);
    },
    list() {
      return [...byId.values()];
    },
    updateStatus(intent_id, patch = {}) {
      const cur = byId.get(intent_id);
      if (!cur) return { ok: false, reason: 'intent_not_found' };
      if (patch.bundle_status != null && !BUNDLE_STATUS.includes(patch.bundle_status)) return { ok: false, reason: 'invalid_bundle_status' };
      if (patch.failure_type != null && !FAILURE_TYPE.includes(patch.failure_type)) return { ok: false, reason: 'invalid_failure_type' };
      const next = Object.freeze({
        ...cur,
        bundle_status: patch.bundle_status ?? cur.bundle_status,
        failure_type: patch.failure_type ?? cur.failure_type,
        updated_at: patch.updated_at ?? cur.updated_at,
      });
      byId.set(intent_id, next);
      audited({ idempotency_key: next.idempotency_key });
      return { ok: true };
    },
    isTerminal(idOrRecord) {
      const rec = typeof idOrRecord === 'string' ? byId.get(idOrRecord) : idOrRecord;
      return !!rec && TERMINAL_BUNDLE.has(rec.bundle_status);
    },
    /** Retry path: requires a NEW intent (new intent_id + new idempotency_key). */
    createReplacement(originalIntentId, replacement) {
      const orig = byId.get(originalIntentId);
      if (!orig) return { ok: false, reason: 'original_not_found' };
      if (replacement == null || typeof replacement !== 'object') return { ok: false, reason: 'replacement_required' };
      if (replacement.intent_id === originalIntentId) return { ok: false, reason: 'replacement_requires_new_intent_id' };
      if (replacement.idempotency_key === orig.idempotency_key) return { ok: false, reason: 'replacement_requires_new_idempotency_key' };
      return insert(replacement, originalIntentId);
    },
    auditEntries() {
      return auditSink.list();
    },
    get size() {
      return byId.size;
    },
    // NO delete / remove / clear — terminal & non-terminal intents are retained (DATA §4.4).
  });
}
