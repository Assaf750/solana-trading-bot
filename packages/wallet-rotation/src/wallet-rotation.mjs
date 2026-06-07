// @soltrade/wallet-rotation — Wallet Rotation orchestration (Gate D / D3). SIMULATED composite flow.
// SOURCE: docs/01-SSOT.md G15 (rotation_trigger, wallet_rotation_status, rotation_from/to_execution_wallet_id,
//   rotate_execution_wallet, complete_wallet_rotation, execution_wallet_status, asset_transfer_intent_id)
//   + G11 (resource_type=wallet_rotation, error codes) + G14 (audit) + docs/03-API §12.4 + docs/05-DATA §4.10.
//
// SIMULATED / in-memory / deterministic. It composes (by dependency injection only) C0 registry, C3
// lifecycle, D1 asset-transfer-intents, D2 profit-sweep. There is NO live transfer/sweep, NO token
// transfer, NO wallet funding, NO signer creation, NO admission gate, NO KeyManager, NO key material,
// NO transaction building/serialization, NO signing/sending, NO RPC/provider, NO DB writes, NO REAL-LIVE,
// NO execution authority.
//
// Commands (SSOT): rotate_execution_wallet, complete_wallet_rotation. The PENDING->IN_PROGRESS phase
// (start) and FAILED transition (simulateFail) are simulated orchestration hooks (not API commands),
// consistent with D1.simulate / D2.simulateConfirm. RETIRED is reached via a C0 state transition.

import { WALLET_ROTATION_STATUS, ROTATION_TRIGGER } from '../../ssot-types/src/core-enums.mjs';
import { PERMISSION_ROLE, API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';

const PERM_ERR = 'PERMISSION_DENIED';
const STATE_ERR = 'COMMAND_NOT_ALLOWED_IN_STATE';
for (const e of [PERM_ERR, STATE_ERR]) if (!API_ERROR_CODE.includes(e)) throw new Error(`internal: ${e} missing`);
if (!PERMISSION_ROLE.includes('admin')) throw new Error('internal: admin role drift');

const RESOURCE = 'wallet_rotation'; // SSOT G11 resource_type
const ROTATE = 'rotate_execution_wallet';
const COMPLETE = 'complete_wallet_rotation';
const isStr = (v) => typeof v === 'string' && v.length > 0;

// Legal wallet_rotation_status transitions. COMPLETED/FAILED terminal.
const ALLOWED = Object.freeze({
  NOT_REQUIRED: ['PENDING'],
  PENDING: ['IN_PROGRESS', 'FAILED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
});
const TERMINAL = new Set(['COMPLETED', 'FAILED']);

export function isTerminalRotationStatus(status) { return TERMINAL.has(status); }

export function createWalletRotation({ walletRegistry, lifecycle, transfers, sweep, auditLog } = {}) {
  if (!walletRegistry || typeof walletRegistry.get !== 'function') throw new Error('wallet-rotation requires C0 walletRegistry');
  if (!lifecycle || typeof lifecycle.drainExecutionWallet !== 'function') throw new Error('wallet-rotation requires C3 lifecycle');
  if (!transfers || typeof transfers.createAssetTransferIntent !== 'function') throw new Error('wallet-rotation requires D1 transfers');
  if (!sweep || typeof sweep.isConfirmed !== 'function') throw new Error('wallet-rotation requires D2 sweep');
  const audit = auditLog || createAuditLog();
  const byId = new Map(); // rotation id -> record
  let seq = 0;

  const set = (rec) => { byId.set(rec.id, Object.freeze({ ...rec })); return byId.get(rec.id); };
  const statusOf = (id) => { const w = walletRegistry.get(id); return w && w.execution_wallet_status; };

  function record(command_type, ctx, audit_reason, api_error_code) {
    const entry = { command_type, resource_type: RESOURCE, audit_scope: RESOURCE, audit_actor: ctx.audit_actor, audit_reason, permission_role: ctx.permission_role };
    if (api_error_code) entry.api_error_code = api_error_code;
    if (isStr(ctx.request_id)) entry.request_id = ctx.request_id;
    audit.append(entry);
  }

  // rotate_execution_wallet (command, admin): create rotation event at PENDING. Validates from/to.
  function rotateExecutionWallet(req = {}) {
    if (!isStr(req.audit_actor)) return { ok: false, reason: 'audit_actor_required' };
    if (req.permission_role !== 'admin') { record(ROTATE, req, 'denied: admin_required', PERM_ERR); return { ok: false, api_error_code: PERM_ERR, reason: 'admin_required' }; }
    if (!ROTATION_TRIGGER.includes(req.rotation_trigger)) { record(ROTATE, req, 'invalid_rotation_trigger'); return { ok: false, reason: 'invalid_rotation_trigger' }; }
    const from = req.rotation_from_execution_wallet_id;
    const to = req.rotation_to_execution_wallet_id;
    if (!isStr(from) || !isStr(to)) { record(ROTATE, req, 'rotation_wallet_not_found'); return { ok: false, reason: 'rotation_wallet_not_found' }; }
    if (from === to) { record(ROTATE, req, 'rotation_from_equals_to'); return { ok: false, reason: 'rotation_from_equals_to' }; }
    const fromStatus = statusOf(from);
    const toStatus = statusOf(to);
    if (!fromStatus || !toStatus) { record(ROTATE, req, 'rotation_wallet_not_found'); return { ok: false, reason: 'rotation_wallet_not_found' }; }
    if (fromStatus === 'REVOKED' || toStatus === 'REVOKED') { record(ROTATE, req, 'rotation_wallet_revoked'); return { ok: false, reason: 'rotation_wallet_revoked' }; }
    // new wallet must already be admitted/ACTIVE (admission is C2, not here).
    if (toStatus !== 'ACTIVE') { record(ROTATE, req, `rotation_to_not_active:${toStatus}`); return { ok: false, reason: 'rotation_to_not_active' }; }
    if (fromStatus !== 'ACTIVE') { record(ROTATE, req, `rotation_from_not_active:${fromStatus}`); return { ok: false, reason: 'rotation_from_not_active' }; }

    const id = `rot-${++seq}`;
    set({
      id, // storage-only PK convention
      resource_type: RESOURCE,
      wallet_rotation_status: 'PENDING',
      rotation_trigger: req.rotation_trigger,
      rotation_from_execution_wallet_id: from,
      rotation_to_execution_wallet_id: to,
      asset_transfer_intent_id: null, // recorded at start
    });
    record(ROTATE, req, `${ROTATE}:PENDING:${id}`);
    return { ok: true, id, wallet_rotation_status: 'PENDING', rotation_from_execution_wallet_id: from, rotation_to_execution_wallet_id: to };
  }

  /**
   * start — SIMULATED orchestration step (PENDING->IN_PROGRESS phase of rotate_execution_wallet; NOT a
   * separate API command). Drains the old wallet via C3 and creates the (simulated) asset transfer via D1.
   */
  function start(rotationId, ctx = {}) {
    const cur = byId.get(rotationId);
    if (!cur) return { ok: false, reason: 'rotation_not_found' };
    if (!isStr(ctx.audit_actor)) return { ok: false, reason: 'audit_actor_required' };
    if (ctx.permission_role !== 'admin') { record(ROTATE, ctx, 'denied: admin_required', PERM_ERR); return { ok: false, api_error_code: PERM_ERR, reason: 'admin_required' }; }
    if (cur.wallet_rotation_status !== 'PENDING') { record(ROTATE, ctx, `rotation_not_pending:${cur.wallet_rotation_status}`, STATE_ERR); return { ok: false, api_error_code: STATE_ERR, reason: 'rotation_not_pending' }; }

    // old wallet -> DRAINING via C3 (state transition only).
    const drained = lifecycle.drainExecutionWallet({ execution_wallet_id: cur.rotation_from_execution_wallet_id, permission_role: ctx.permission_role, audit_actor: ctx.audit_actor });
    if (!drained.ok) { record(ROTATE, ctx, `drain_failed:${drained.reason || ''}`); return { ok: false, reason: 'drain_failed', detail: drained.reason, api_error_code: drained.api_error_code }; }

    // create the (simulated) asset move old -> new via D1.
    const t = transfers.createAssetTransferIntent({
      source_execution_wallet_id: cur.rotation_from_execution_wallet_id,
      destination_execution_wallet_id: cur.rotation_to_execution_wallet_id,
      position_owner_wallet_id: cur.rotation_from_execution_wallet_id,
      permission_role: ctx.permission_role,
      audit_actor: ctx.audit_actor,
    });
    if (!t.ok) { record(ROTATE, ctx, `transfer_create_failed:${t.reason || ''}`); return { ok: false, reason: 'transfer_create_failed', detail: t.reason, api_error_code: t.api_error_code }; }

    set({ ...cur, wallet_rotation_status: 'IN_PROGRESS', asset_transfer_intent_id: t.asset_transfer_intent_id });
    record(ROTATE, ctx, `${ROTATE}:IN_PROGRESS:${rotationId}`);
    return { ok: true, wallet_rotation_status: 'IN_PROGRESS', asset_transfer_intent_id: t.asset_transfer_intent_id };
    // NOTE: no funds move. C3 drain + D1 create are state-machine/intent operations only.
  }

  // complete_wallet_rotation (command, admin): COMPLETED only if transfer CONFIRMED (+ sweep if required),
  // then old wallet DRAINING -> RETIRED via C0. ctx.require_sweep / ctx.sweep_event_id are runtime params.
  function completeWalletRotation(rotationId, ctx = {}) {
    const cur = byId.get(rotationId);
    if (!cur) return { ok: false, reason: 'rotation_not_found' };
    if (!isStr(ctx.audit_actor)) return { ok: false, reason: 'audit_actor_required' };
    if (ctx.permission_role !== 'admin') { record(COMPLETE, ctx, 'denied: admin_required', PERM_ERR); return { ok: false, api_error_code: PERM_ERR, reason: 'admin_required' }; }
    if (TERMINAL.has(cur.wallet_rotation_status)) { record(COMPLETE, ctx, `terminal:${cur.wallet_rotation_status}`, STATE_ERR); return { ok: false, api_error_code: STATE_ERR, reason: 'rotation_terminal' }; }
    if (cur.wallet_rotation_status !== 'IN_PROGRESS') { record(COMPLETE, ctx, `rotation_not_in_progress:${cur.wallet_rotation_status}`, STATE_ERR); return { ok: false, api_error_code: STATE_ERR, reason: 'rotation_not_in_progress' }; }

    // asset transfer must be CONFIRMED (verified via D1, simulated).
    const ati = cur.asset_transfer_intent_id ? transfers.get(cur.asset_transfer_intent_id) : null;
    if (!ati || ati.asset_transfer_status !== 'CONFIRMED') { record(COMPLETE, ctx, 'asset_transfer_not_confirmed', STATE_ERR); return { ok: false, api_error_code: STATE_ERR, reason: 'asset_transfer_not_confirmed' }; }

    // sweep confirmation required only when requested (runtime).
    if (ctx.require_sweep === true) {
      if (!isStr(ctx.sweep_event_id)) { record(COMPLETE, ctx, 'sweep_event_required', STATE_ERR); return { ok: false, api_error_code: STATE_ERR, reason: 'sweep_event_required' }; }
      if (sweep.isConfirmed(ctx.sweep_event_id) !== true) { record(COMPLETE, ctx, 'sweep_not_confirmed', STATE_ERR); return { ok: false, api_error_code: STATE_ERR, reason: 'sweep_not_confirmed' }; }
    }

    // old wallet DRAINING -> RETIRED via C0 state transition (retirement policy satisfied).
    if (statusOf(cur.rotation_from_execution_wallet_id) === 'DRAINING') {
      const ret = walletRegistry.transition(cur.rotation_from_execution_wallet_id, 'RETIRED');
      if (!ret.ok) { record(COMPLETE, ctx, `retire_failed:${ret.reason || ''}`); return { ok: false, reason: 'retire_failed', detail: ret.reason, api_error_code: ret.api_error_code }; }
    }

    set({ ...cur, wallet_rotation_status: 'COMPLETED' });
    record(COMPLETE, ctx, `${COMPLETE}:COMPLETED:${rotationId}`);
    return { ok: true, wallet_rotation_status: 'COMPLETED' };
  }

  /** simulateFail — SIMULATED engine hook (NOT a command). PENDING/IN_PROGRESS -> FAILED (terminal). */
  function simulateFail(rotationId) {
    const cur = byId.get(rotationId);
    if (!cur) return { ok: false, reason: 'rotation_not_found' };
    if (!ALLOWED[cur.wallet_rotation_status].includes('FAILED')) return { ok: false, api_error_code: STATE_ERR, reason: 'cannot_fail_in_state', from: cur.wallet_rotation_status };
    set({ ...cur, wallet_rotation_status: 'FAILED' });
    return { ok: true, wallet_rotation_status: 'FAILED' };
  }

  return Object.freeze({
    rotateExecutionWallet,
    start,
    completeWalletRotation,
    simulateFail,
    auditLog: audit,
    get(rotationId) { return byId.get(rotationId); },
    list() { return [...byId.values()]; },
    isTerminal(rotationId) { const r = byId.get(rotationId); return !!r && TERMINAL.has(r.wallet_rotation_status); },
    get size() { return byId.size; },
    // No live transfer/sweep. No funding. No signer creation. No admission. No keys. No DB. No RPC.
  });
}

export const WALLET_ROTATION_TRANSITIONS = ALLOWED;
