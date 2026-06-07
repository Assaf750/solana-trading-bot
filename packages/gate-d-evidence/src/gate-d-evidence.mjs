// @soltrade/gate-d-evidence — Gate D closure evidence harness (PR-D4). EVIDENCE / test-only.
// Wires the already-merged Gate D modules together IN-MEMORY to prove the multi-wallet / asset-transfer /
// sweep / rotation flows compose correctly: D0 pool + assignment, D1 asset-transfer-intents, D2 profit-sweep,
// D3 wallet-rotation (over C0 registry + C3 lifecycle). Thin orchestrator over existing simulated modules:
// NO new runtime feature, NO new SSOT names, NO logic beyond wiring.
//
// FORBIDDEN HERE (and absent): live transfer/sweep, token transfer, transfer-boundary, wallet funding,
// signer creation, admission gate, KeyManager, key material, transaction building/serialization,
// signing/sending, RPC/provider, DB writes, REAL-LIVE, Gate E, execution authority.

import { createExecutionWalletRegistry } from '../../execution-wallet-registry/src/index.mjs';   // C0
import { createExecutionWalletLifecycle } from '../../execution-wallet-lifecycle/src/index.mjs';  // C3
import { createExecutionWalletPool } from '../../execution-wallet-pool/src/index.mjs';            // D0
import { createAssetTransferIntents } from '../../asset-transfer-intents/src/index.mjs';          // D1
import { createProfitSweep } from '../../profit-sweep/src/index.mjs';                             // D2
import { createWalletRotation } from '../../wallet-rotation/src/index.mjs';                       // D3
import { createAuditLog } from '../../data/src/index.mjs';

/** Build a fully-wired Gate D harness sharing one C0 registry; each layer has its own audit log. */
export function createGateDHarness({ wallets = [], activate = [] } = {}) {
  const walletRegistry = createExecutionWalletRegistry();
  for (const w of wallets) walletRegistry.register(w);
  for (const id of activate) walletRegistry.transition(id, 'ACTIVE');

  const lifecycle = createExecutionWalletLifecycle({ walletRegistry, auditLog: createAuditLog() });    // C3
  const transfers = createAssetTransferIntents({ walletRegistry, auditLog: createAuditLog() });        // D1
  const sweep = createProfitSweep({ walletRegistry, auditLog: createAuditLog() });                     // D2
  const pool = createExecutionWalletPool({ walletRegistry });                                          // D0
  const rotation = createWalletRotation({ walletRegistry, lifecycle, transfers, sweep, auditLog: createAuditLog() }); // D3
  return Object.freeze({ walletRegistry, lifecycle, transfers, sweep, pool, rotation });
}

/**
 * Drive the full simulated rotation composite end-to-end and return a step trace:
 *   rotate (PENDING) -> start (IN_PROGRESS + old DRAINING + D1 transfer) -> confirm transfer (D1) ->
 *   optional sweep + confirm (D2) -> complete (COMPLETED + old RETIRED).
 * ctx = { permission_role, audit_actor }. `withSweep` toggles the optional sweep requirement.
 */
export function runRotationComposite(h, { rotate_request, ctx, withSweep = false } = {}) {
  const t = {};
  t.rotate = h.rotation.rotateExecutionWallet({ ...rotate_request, ...ctx });
  t.rotation_id = t.rotate.id;
  t.start = h.rotation.start(t.rotation_id, ctx);
  t.old_status_after_start = h.walletRegistry.get(rotate_request.rotation_from_execution_wallet_id)?.execution_wallet_status;
  const atiId = h.rotation.get(t.rotation_id)?.asset_transfer_intent_id;
  t.asset_transfer_intent_id = atiId;
  h.transfers.simulate(atiId, 'SUBMITTED');
  t.transfer_confirm = h.transfers.simulate(atiId, 'CONFIRMED');
  t.owner_after_confirm = h.transfers.ownerOf(atiId);

  let completeCtx = { ...ctx };
  if (withSweep) {
    const ev = h.sweep.sweepProfits({
      execution_wallet_id: rotate_request.rotation_from_execution_wallet_id,
      position_owner_wallet_id: rotate_request.rotation_from_execution_wallet_id,
      profit_sweep_policy: 'manual',
      candidate_profits_available_to_sweep: 1,
      candidate_balance_provenance: 'on_chain',
      candidate_balance_reconciliation_status: 'reconciled',
      ...ctx,
    }).candidate_sweep_event;
    h.sweep.simulateConfirm(ev.id);
    t.sweep_event_id = ev.id;
    completeCtx = { ...ctx, require_sweep: true, sweep_event_id: ev.id };
  }
  t.complete = h.rotation.completeWalletRotation(t.rotation_id, completeCtx);
  t.old_status_after_complete = h.walletRegistry.get(rotate_request.rotation_from_execution_wallet_id)?.execution_wallet_status;
  t.rotation_status = h.rotation.get(t.rotation_id)?.wallet_rotation_status;
  return t;
}
