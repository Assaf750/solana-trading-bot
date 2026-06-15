// @soltrade/decision-ledger — idempotent intent ledger + decision trace (ADR-0001 Phase 2A).
// Two cooperating surfaces over ONE pluggable store:
//  1) legacy-exact primitives (intentIdFor / claimIntent / setIntent / getIntent / listIntents /
//     pendingIntents) — byte-parity with apps/server live-executor's prior inline ledger, so the
//     server can delegate with zero behaviour change.
//  2) canonical lifecycle API (createExecutionIntent / mark* / validateIntentTransition /
//     appendDecisionTrace) over contracts INTENT_STATUS — the forward-looking surface; fail-closed
//     on corrupt/unknown/illegal-transition.
import { validateEntity, INTENT_STATUS } from '../../contracts/src/live-model.mjs';

// Default deterministic intent-id hash. The Node crypto module is confined (mechanism guard) to the
// isolated signer runtime, so the ledger uses a dependency-free FNV-1a hash by default; callers that
// need a specific id scheme (e.g. apps/server's sha256 ids) inject `intentIdFor` for exact parity.
function defaultIntentIdFor(parts) {
  const s = parts.join('|');
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i += 1) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `int_${h.toString(16).padStart(16, '0')}`;
}

const TRACE_ENTITY_KINDS = new Set([
  'Decision', 'ExecutionPlan', 'BroadcastAttempt', 'Confirmation', 'Fill', 'AuditEvent',
]);

// Canonical lifecycle transitions over contracts INTENT_STATUS. Fail-closed: anything not listed
// is illegal; terminal states have no outgoing transitions.
const TRANSITIONS = Object.freeze({
  CREATED: ['CLAIMED', 'PLANNED', 'SIGNED', 'FAILED_PRE_SEND', 'FAILED', 'CANCELLED'],
  CLAIMED: ['PLANNED', 'SIGNED', 'FAILED_PRE_SEND', 'FAILED', 'CANCELLED'],
  PLANNED: ['SIGNED', 'FAILED_PRE_SEND', 'FAILED', 'CANCELLED'],
  SIGNED: ['BROADCAST', 'FAILED_PRE_SEND', 'FAILED'],
  BROADCAST: ['CONFIRMED', 'FAILED'],
  CONFIRMED: ['FILLED', 'FAILED'],
  FILLED: [],
  FAILED_PRE_SEND: [],
  FAILED: [],
  DUPLICATE: [],
  CANCELLED: [],
});

export function validateIntentTransition(from, to) {
  if (!INTENT_STATUS.includes(from)) return { ok: false, error: `unknown_from_status:${from}` };
  if (!INTENT_STATUS.includes(to)) return { ok: false, error: `unknown_to_status:${to}` };
  if (!(TRANSITIONS[from] || []).includes(to)) return { ok: false, error: `illegal_transition:${from}->${to}` };
  return { ok: true };
}

export function createDecisionLedger({
  store,
  now = () => new Date().toISOString(),
  retryableStatuses = ['FAILED_PRE_SEND', 'FAILED_SEND', 'FAILED_ON_CHAIN'],
  intentIdFor = defaultIntentIdFor,
} = {}) {
  if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
    throw new Error('decision_ledger_requires_store');
  }
  const RETRYABLE = new Set(retryableStatuses);

  function read() {
    const r = store.read();
    const value = (r && r.value && typeof r.value === 'object') ? r.value : { intents: {} };
    if (!value.intents || typeof value.intents !== 'object') value.intents = {};
    return { value, corrupt: !!(r && r.corrupt) };
  }
  function save(value) { store.write(value); }

  // ---- legacy-exact idempotency primitives (parity with apps/server live-executor) ----
  function claimIntent(intent_id, detail) {
    const { value } = read();
    const existing = value.intents[intent_id];
    if (existing && !RETRYABLE.has(existing.status)) {
      return { ok: false, error: `intent_duplicate_${existing.status}` };
    }
    value.intents[intent_id] = { status: 'PENDING', ts: now(), detail, notional_charged: existing?.notional_charged === true };
    save(value);
    return { ok: true };
  }
  function setIntent(intent_id, status, extra = {}) {
    const { value } = read();
    if (value.intents[intent_id]) {
      value.intents[intent_id] = { ...value.intents[intent_id], status, ...extra, updated_at: now() };
      save(value);
    }
  }
  function getIntent(intent_id) { return read().value.intents[intent_id] || null; }
  function listIntents(limit = 50) {
    return Object.entries(read().value.intents).slice(-limit).map(([id, v]) => ({ intent_id: id, ...v }));
  }
  function pendingIntents() {
    return Object.entries(read().value.intents)
      .filter(([, v]) => (v.status === 'SENT' || v.status === 'SENT_UNCONFIRMED') && v.signature)
      .map(([intent_id, v]) => ({ intent_id, status: v.status, signature: v.signature, detail: v.detail || {} }));
  }

  // ---- canonical lifecycle API (contracts INTENT_STATUS); fail-closed ----
  function createExecutionIntent(fields = {}) {
    const record = { ...fields, status: 'CREATED', created_at: fields.created_at || now() };
    const v = validateEntity('ExecutionIntent', record);
    if (!v.ok) return { ok: false, error: 'invalid_execution_intent', errors: v.errors };
    const { value, corrupt } = read();
    if (corrupt) return { ok: false, error: 'ledger_corrupt' };
    if (value.intents[record.intent_id]) return { ok: false, error: 'intent_id_exists' };
    for (const it of Object.values(value.intents)) {
      if (it && it.idempotency_key && it.idempotency_key === record.idempotency_key) {
        return { ok: false, error: 'idempotent_duplicate' };
      }
    }
    value.intents[record.intent_id] = record;
    save(value);
    return { ok: true, intent: record };
  }
  function transitionTo(intent_id, to, patch = {}) {
    const { value, corrupt } = read();
    if (corrupt) return { ok: false, error: 'ledger_corrupt' };
    const cur = value.intents[intent_id];
    if (!cur) return { ok: false, error: 'unknown_intent' };
    const chk = validateIntentTransition(cur.status, to);
    if (!chk.ok) return chk;
    value.intents[intent_id] = { ...cur, ...patch, status: to, updated_at: now() };
    save(value);
    return { ok: true, intent: value.intents[intent_id] };
  }
  const markIntentPlanned = (id, patch) => transitionTo(id, 'PLANNED', patch);
  const markIntentSigned = (id, patch) => transitionTo(id, 'SIGNED', patch);
  const markIntentBroadcast = (id, patch) => transitionTo(id, 'BROADCAST', patch);
  const markIntentConfirmed = (id, patch) => transitionTo(id, 'CONFIRMED', patch);
  const markIntentFilled = (id, patch) => transitionTo(id, 'FILLED', patch);
  function markIntentFailed(id, opts = {}) {
    const { pre_send = false, ...patch } = opts;
    return transitionTo(id, pre_send ? 'FAILED_PRE_SEND' : 'FAILED', patch);
  }

  function appendDecisionTrace(intent_id, entry) {
    if (!intent_id || typeof intent_id !== 'string') return { ok: false, error: 'intent_id_required' };
    if (!entry || typeof entry !== 'object') return { ok: false, error: 'entry_required' };
    if (entry.kind && TRACE_ENTITY_KINDS.has(entry.kind)) {
      const v = validateEntity(entry.kind, entry.data);
      if (!v.ok) return { ok: false, error: `invalid_${entry.kind}`, errors: v.errors };
    }
    const { value, corrupt } = read();
    if (corrupt) return { ok: false, error: 'ledger_corrupt' };
    if (!value.traces || typeof value.traces !== 'object') value.traces = {};
    if (!Array.isArray(value.traces[intent_id])) value.traces[intent_id] = [];
    value.traces[intent_id].push({ ...entry, at: entry.at || now() });
    save(value);
    return { ok: true };
  }
  function getTrace(intent_id) {
    const t = read().value.traces;
    return (t && Array.isArray(t[intent_id])) ? t[intent_id] : [];
  }

  return {
    intentIdFor, claimIntent, setIntent, getIntent, listIntents, pendingIntents,
    createExecutionIntent, markIntentPlanned, markIntentSigned, markIntentBroadcast,
    markIntentConfirmed, markIntentFilled, markIntentFailed,
    validateIntentTransition, appendDecisionTrace, getTrace,
  };
}
