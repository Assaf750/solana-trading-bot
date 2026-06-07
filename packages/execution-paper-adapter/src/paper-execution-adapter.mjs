// @soltrade/execution-paper-adapter — PAPER execution adapter / test harness (Gate B / B4).
// SOURCE: docs/00-ARCHITECTURE.md §3 (PAPER-LIVE: "same order object -> execution_simulator ->
// record simulated fill / hypothetical fees / failures. No sign, no send.") + §4/§5 guards.
//
// PIPELINE (order matters — guards precede the simulator):
//   1) IntentLedger : no order without intent_id (and the intent must be registered).
//   2) Risk Gates   : decision=block stops paper execution (warning_only never bypasses Hard Risk).
//   3) Signer Bndry : called ONLY to prove signed=false / signature=null (never signs, never sends).
//   4) Lifecycle    : in-memory position_state transition (optional).
//   5) Simulator    : deterministic simulated fill via CostPipeline (or injected failure).
//
// INVARIANTS: executed=false, is_valid_on_chain=false, signed=false, signature=null — every path.
// NO real signing, NO sending, NO transaction serialization, NO RPC/provider, NO DB writes, NO network.

import { evaluateHardRisk } from '../../risk-gates/src/risk-gates.mjs';
import { assertOrderHasIntent } from '../../intent-ledger/src/intent-ledger.mjs';
import { createSignerBoundary } from '../../signer-boundary/src/signer-boundary.mjs';
import { estimateCost } from '../../foundations/src/cost-pipeline.mjs';
import { FAILURE_TYPE } from '../../ssot-types/src/core-enums.mjs';

const isStr = (v) => typeof v === 'string' && v.length > 0;
const NOTE = 'PAPER simulation: same order object, no sign, no send; simulated result is NOT valid on-chain';

function envelope(intent_id, extra) {
  return {
    mode: 'paper',
    executed: false,
    is_valid_on_chain: false,
    signed: false,
    signature: null,
    intent_id: intent_id ?? null,
    note: NOTE,
    ...extra,
  };
}

export function createPaperExecutionAdapter({ ledger, lifecycle, signer } = {}) {
  const signerBoundary = signer || createSignerBoundary();

  return Object.freeze({
    /**
     * Simulate (paper) the execution of an order. Never signs, never sends.
     * @param order { intent_id, ... }
     * @param ctx { risk_config, measured, ev_gate_mode?, signer_profile_id, signer_profile_status,
     *              key_custody_mode?, position_id?, to_state?, cost?, inject_failure? }
     */
    simulate(order = {}, ctx = {}) {
      // 1) IntentLedger guard — no order without an intent reference.
      const intent_id = order && order.intent_id;
      if (!isStr(intent_id)) {
        return envelope(null, { simulated: false, blocked_by: 'intent_ledger', reason: 'intent_id_required' });
      }
      if (ledger && !ledger.get(intent_id)) {
        return envelope(intent_id, { simulated: false, blocked_by: 'intent_ledger', reason: 'intent_not_registered' });
      }

      // 2) Risk Gates — must pass BEFORE anything else (Hard Risk always enforced).
      const risk = evaluateHardRisk({ risk_config: ctx.risk_config, measured: ctx.measured, ev_gate_mode: ctx.ev_gate_mode });
      if (risk.decision === 'block') {
        return envelope(intent_id, { simulated: false, blocked_by: 'risk_gates', risk });
      }

      // 3) Signer boundary — used only to PROVE no signing happens.
      const signerResult = signerBoundary.requestSignature({
        mode: 'paper',
        signer_profile_id: ctx.signer_profile_id,
        signer_profile_status: ctx.signer_profile_status,
        key_custody_mode: ctx.key_custody_mode,
      });
      if (signerResult.signed !== false || signerResult.signature !== null) {
        throw new Error('invariant violated: signer boundary must never produce a signature');
      }

      // 4) Position lifecycle — in-memory transition only (optional).
      let lifecycleResult;
      if (lifecycle && ctx.position_id && ctx.to_state) {
        lifecycleResult = lifecycle.transition(ctx.position_id, ctx.to_state);
        if (!lifecycleResult.ok) {
          return envelope(intent_id, { simulated: false, blocked_by: 'position_lifecycle', risk, signer: signerResult, lifecycle: lifecycleResult });
        }
      }

      // 5) Simulator — deterministic. Injected failure first (test harness), else cost-based fill.
      if (ctx.inject_failure != null) {
        if (!FAILURE_TYPE.includes(ctx.inject_failure)) {
          return envelope(intent_id, { simulated: false, blocked_by: 'simulator', reason: 'invalid_failure_type', risk, signer: signerResult, lifecycle: lifecycleResult });
        }
        return envelope(intent_id, { simulated: true, failure: { simulated: true, failure_type: ctx.inject_failure }, risk, signer: signerResult, lifecycle: lifecycleResult });
      }

      const cost = estimateCost(ctx.cost || {});
      if (!cost.priceable) {
        return envelope(intent_id, { simulated: true, failure: { simulated: true, reason: cost.reason }, risk, signer: signerResult, lifecycle: lifecycleResult });
      }
      return envelope(intent_id, {
        simulated: true,
        simulated_fill: { simulated: true, is_valid_on_chain: false, total_cost_lamports: cost.total_cost_lamports },
        risk,
        signer: signerResult,
        lifecycle: lifecycleResult,
      });
      // No sign(), no send(), no submit(), no serializeTransaction() — by design.
    },
  });
}
