// @soltrade/asset-transfer-intents — Asset Transfer Intent state machine + simulated ownership flip
// (Gate D / D1). SOURCE: docs/01-SSOT.md G15 (asset_transfer_intent_id, asset_transfer_status,
//   source/destination_execution_wallet_id, position_owner_wallet_id) + G11 (create/cancel command,
//   resource_type=asset_transfer, api_error_code) + G14 (audit) + docs/03-API §12.3 + docs/05-DATA §4.9.
//
// SIMULATED / in-memory / deterministic. This is an INTENT LEDGER + STATE MACHINE only. There is NO real
// asset/token transfer, NO transfer-boundary, NO transaction building/serialization, NO signing/sending,
// NO RPC/provider, NO DB writes, NO KeyManager, NO key material, NO rotation, NO sweep, NO REAL-LIVE.
//
// OWNERSHIP RULE: position_owner_wallet_id flips from source -> destination ONLY when
// asset_transfer_status reaches CONFIRMED. Before CONFIRMED it stays the source (current owner).
// SUBMITTED/CONFIRMED/FAILED are engine/chain-driven status updates, modelled here by simulate()
// (NOT API commands — SSOT exposes only create/cancel as commands).

import { ASSET_TRANSFER_STATUS } from '../../ssot-types/src/core-enums.mjs';
import { PERMISSION_ROLE, API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';

const PERM_ERR = 'PERMISSION_DENIED';
const STATE_ERR = 'COMMAND_NOT_ALLOWED_IN_STATE';
const IDEM_ERR = 'IDEMPOTENCY_CONFLICT';
for (const e of [PERM_ERR, STATE_ERR, IDEM_ERR]) if (!API_ERROR_CODE.includes(e)) throw new Error(`internal: ${e} missing`);
if (!PERMISSION_ROLE.includes('admin')) throw new Error('internal: admin role drift');

const RESOURCE = 'asset_transfer'; // SSOT G11 resource_type
const CREATE = 'create_asset_transfer_intent';
const CANCEL = 'cancel_asset_transfer_intent';
const isStr = (v) => typeof v === 'string' && v.length > 0;

// Legal asset_transfer_status transitions. CONFIRMED/FAILED/CANCELLED are terminal.
const ALLOWED = Object.freeze({
  PENDING: ['SUBMITTED', 'FAILED', 'CANCELLED'],
  SUBMITTED: ['CONFIRMED', 'FAILED', 'CANCELLED'],
  CONFIRMED: [],
  FAILED: [],
  CANCELLED: [],
});
const TERMINAL = new Set(['CONFIRMED', 'FAILED', 'CANCELLED']);

export function isTerminalTransferStatus(status) { return TERMINAL.has(status); }

export function createAssetTransferIntents({ walletRegistry, auditLog } = {}) {
  const audit = auditLog || createAuditLog();
  const byId = new Map();          // asset_transfer_intent_id -> record
  const byIdempotency = new Map(); // idempotency_key -> asset_transfer_intent_id
  let seq = 0;                     // deterministic id counter (no clock/random)

  const set = (rec) => { byId.set(rec.asset_transfer_intent_id, Object.freeze({ ...rec })); return byId.get(rec.asset_transfer_intent_id); };

  function record(command_type, req, audit_reason, api_error_code) {
    const entry = { command_type, resource_type: RESOURCE, audit_scope: RESOURCE, audit_actor: req.audit_actor, audit_reason, permission_role: req.permission_role };
    if (api_error_code) entry.api_error_code = api_error_code;
    if (isStr(req.idempotency_key)) entry.idempotency_key = req.idempotency_key;
    if (isStr(req.request_id)) entry.request_id = req.request_id;
    audit.append(entry);
  }

  // destination must be an ACTIVE execution wallet when the C0 registry is provided.
  function destinationEligible(id) {
    if (!walletRegistry) return true; // standalone mode: no registry coupling
    const w = walletRegistry.get(id);
    return !!w && w.execution_wallet_status === 'ACTIVE';
  }

  function createAssetTransferIntent(req = {}) {
    if (!isStr(req.audit_actor)) return { ok: false, reason: 'audit_actor_required' };
    if (req.permission_role !== 'admin') { record(CREATE, req, 'denied: admin_required', PERM_ERR); return { ok: false, api_error_code: PERM_ERR, reason: 'admin_required' }; }

    // Idempotency: duplicate key or explicit id => conflict.
    if (isStr(req.idempotency_key) && byIdempotency.has(req.idempotency_key)) { record(CREATE, req, 'duplicate_idempotency_key', IDEM_ERR); return { ok: false, api_error_code: IDEM_ERR, reason: 'duplicate_idempotency_key' }; }
    if (isStr(req.asset_transfer_intent_id) && byId.has(req.asset_transfer_intent_id)) { record(CREATE, req, 'duplicate_asset_transfer_intent_id', IDEM_ERR); return { ok: false, api_error_code: IDEM_ERR, reason: 'duplicate_asset_transfer_intent_id' }; }

    const source = req.source_execution_wallet_id;
    const destination = req.destination_execution_wallet_id;
    if (!isStr(source) || !isStr(destination)) { record(CREATE, req, 'source_and_destination_required'); return { ok: false, reason: 'source_and_destination_required' }; }
    if (source === destination) { record(CREATE, req, 'source_equals_destination'); return { ok: false, reason: 'source_equals_destination' }; }
    // source must be the current owner (position_owner_wallet_id).
    if (req.position_owner_wallet_id !== source) { record(CREATE, req, 'source_not_current_owner'); return { ok: false, reason: 'source_not_current_owner' }; }
    if (!destinationEligible(destination)) { record(CREATE, req, 'destination_not_eligible'); return { ok: false, reason: 'destination_not_eligible' }; }

    const id = isStr(req.asset_transfer_intent_id) ? req.asset_transfer_intent_id : `ati-${++seq}`;
    set({
      asset_transfer_intent_id: id,
      asset_transfer_status: 'PENDING',
      source_execution_wallet_id: source,
      destination_execution_wallet_id: destination,
      position_owner_wallet_id: source, // unchanged until CONFIRMED
    });
    if (isStr(req.idempotency_key)) byIdempotency.set(req.idempotency_key, id);
    record(CREATE, req, `${CREATE}:PENDING`);
    return { ok: true, asset_transfer_intent_id: id, asset_transfer_status: 'PENDING', position_owner_wallet_id: source };
  }

  function cancelAssetTransferIntent(asset_transfer_intent_id, ctx = {}) {
    const req = { ...ctx, asset_transfer_intent_id };
    if (!isStr(req.audit_actor)) return { ok: false, reason: 'audit_actor_required' };
    if (req.permission_role !== 'admin') { record(CANCEL, req, 'denied: admin_required', PERM_ERR); return { ok: false, api_error_code: PERM_ERR, reason: 'admin_required' }; }
    const cur = byId.get(asset_transfer_intent_id);
    if (!cur) { record(CANCEL, req, 'asset_transfer_intent_not_found'); return { ok: false, reason: 'asset_transfer_intent_not_found' }; }
    if (!ALLOWED[cur.asset_transfer_status].includes('CANCELLED')) {
      record(CANCEL, req, `illegal_cancel:${cur.asset_transfer_status}`, STATE_ERR);
      return { ok: false, api_error_code: STATE_ERR, reason: 'cancel_not_allowed_in_state', asset_transfer_status: cur.asset_transfer_status };
    }
    // PENDING -> direct cancel. SUBMITTED -> SIMULATED cancel (no on-chain guarantee). Ownership stays source.
    const simulated_after_submitted = cur.asset_transfer_status === 'SUBMITTED';
    set({ ...cur, asset_transfer_status: 'CANCELLED' });
    record(CANCEL, req, `${CANCEL}:CANCELLED${simulated_after_submitted ? ':simulated_no_onchain_guarantee' : ''}`);
    return { ok: true, asset_transfer_status: 'CANCELLED', simulated_cancel_after_submitted: simulated_after_submitted };
  }

  /**
   * SIMULATED engine/chain-driven status advance (NOT an API command, NOT user-attributed).
   * Enforces the legal asset_transfer_status graph; flips ownership ONLY on reaching CONFIRMED.
   */
  function simulate(asset_transfer_intent_id, toStatus) {
    const cur = byId.get(asset_transfer_intent_id);
    if (!cur) return { ok: false, reason: 'asset_transfer_intent_not_found' };
    if (!ASSET_TRANSFER_STATUS.includes(toStatus)) return { ok: false, reason: 'invalid_asset_transfer_status' };
    if (!ALLOWED[cur.asset_transfer_status].includes(toStatus)) {
      return { ok: false, api_error_code: STATE_ERR, reason: 'illegal_transition', from: cur.asset_transfer_status, to: toStatus };
    }
    const owner = toStatus === 'CONFIRMED' ? cur.destination_execution_wallet_id : cur.position_owner_wallet_id;
    set({ ...cur, asset_transfer_status: toStatus, position_owner_wallet_id: owner });
    return { ok: true, asset_transfer_status: toStatus, position_owner_wallet_id: owner };
    // NOTE: no real transfer happens. Ownership is an in-memory projection; flips only at CONFIRMED.
  }

  return Object.freeze({
    createAssetTransferIntent,
    cancelAssetTransferIntent,
    simulate,
    auditLog: audit,
    get(asset_transfer_intent_id) { return byId.get(asset_transfer_intent_id); },
    ownerOf(asset_transfer_intent_id) { const r = byId.get(asset_transfer_intent_id); return r && r.position_owner_wallet_id; },
    list() { return [...byId.values()]; },
    isTerminal(asset_transfer_intent_id) { const r = byId.get(asset_transfer_intent_id); return !!r && TERMINAL.has(r.asset_transfer_status); },
    get size() { return byId.size; },
    // No transfer. No transfer-boundary. No tx build/sign/send. No rotation. No sweep. No keys. No DB. No RPC.
  });
}

export const ASSET_TRANSFER_TRANSITIONS = ALLOWED;
