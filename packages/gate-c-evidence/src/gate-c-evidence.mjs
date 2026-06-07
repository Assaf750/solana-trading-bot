// @soltrade/gate-c-evidence — Gate C closure evidence harness (PR-C4). EVIDENCE / test-only.
// Wires the already-merged Gate C modules together IN-MEMORY to prove the single-execution-wallet
// lifecycle: register (C0) -> signer references (C1) -> admission WARMING_UP->ACTIVE (C2) ->
// drain/disable/revoke + audit (C3). It is a thin orchestrator over existing gated modules:
// NO new runtime feature, NO new SSOT names, NO logic beyond wiring.
//
// FORBIDDEN HERE (and absent): asset transfer / rotation / sweep, token transfer, transaction
// building/serialization, signing/sending, KeyManager, key material, RPC/provider, DB writes,
// REAL-LIVE, Gate D, Gate E, execution authority, candidate_* promotion.

import { createExecutionWalletRegistry } from '../../execution-wallet-registry/src/index.mjs';
import { createSignerProfilesRegistry } from '../../signer-profiles-registry/src/index.mjs';
import { createAdmissionGate } from '../../execution-wallet-admission/src/index.mjs';
import { createExecutionWalletLifecycle } from '../../execution-wallet-lifecycle/src/index.mjs';
import { createAuditLog } from '../../data/src/index.mjs';

/** Build a fully-wired Gate C harness sharing one wallet registry + one in-memory audit log. */
export function createGateCHarness() {
  const walletRegistry = createExecutionWalletRegistry(); // C0
  const signerRegistry = createSignerProfilesRegistry();  // C1 (references only)
  const auditLog = createAuditLog();                       // @soltrade/data (append-only)
  const admission = createAdmissionGate({ walletRegistry, signerRegistry });       // C2
  const lifecycle = createExecutionWalletLifecycle({ walletRegistry, auditLog });  // C3
  return Object.freeze({ walletRegistry, signerRegistry, auditLog, admission, lifecycle });
}

/**
 * Provision a single execution wallet up to ACTIVE:
 *   C0 register (-> WARMING_UP) ; C1 register signer + transition ACTIVE (signer_control) ;
 *   C2 admission (-> ACTIVE) when all mock conditions + real_live_config_valid hold.
 * Returns a step-by-step trace; throws nothing (results carry ok/reason).
 */
export function provisionAndAdmit(harness, { wallet, signer, request }) {
  const trace = {};
  trace.register = harness.walletRegistry.register(wallet);
  trace.register_signer = harness.signerRegistry.register(signer, { permission_role: 'signer_control' });
  trace.activate_signer = harness.signerRegistry.transition(signer.signer_profile_id, 'ACTIVE', { permission_role: 'signer_control' });
  trace.status_before_admission = harness.walletRegistry.get(wallet.execution_wallet_id)?.execution_wallet_status;
  trace.admission = harness.admission.activateExecutionWallet(request);
  trace.status_after_admission = harness.walletRegistry.get(wallet.execution_wallet_id)?.execution_wallet_status;
  return trace;
}

/** Read the current execution_wallet_status of a wallet (evidence helper). */
export function walletStatus(harness, execution_wallet_id) {
  return harness.walletRegistry.get(execution_wallet_id)?.execution_wallet_status;
}
