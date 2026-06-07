// @soltrade/decision-engine — Decision Engine SKELETON (Gate B / B6).
// SOURCE: docs/00-ARCHITECTURE.md §4/§4.1/§4.2/§5 + docs/01-SSOT.md G1/G2/G3/G7 + docs/02-CONFIG §7.
// Produces DECISION DRAFTS / RECOMMENDATIONS only. NEVER executes, NEVER builds an order, NEVER signs/sends.
// Deterministic, local. NO network/provider, NO DB, NO execution-adapter call.
//
// INVARIANTS:
//  - is_executable=false and is_order=false on EVERY result (a recommendation is not a buy/execution).
//  - mint discovery alone is NOT a buy signal: a wallet/signal-led input is required.
//  - EV gate: strict blocks the recommendation on unmet/missing thresholds; warning_only downgrades
//    to a WARNING_CRITICAL recommendation but NEVER grants execution and NEVER bypasses Hard Risk.

import { COPY_EVENT, MIGRATION_PHASE } from '../../ssot-types/src/core-enums.mjs';
import { EV_FIELDS } from '../../config/src/schema.mjs';
import { estimateCost } from '../../foundations/src/cost-pipeline.mjs';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const NOTE = 'decision draft / recommendation only — NOT an order, NOT execution';

const ENTRY_EVENTS = new Set(['leader_buy', 'leader_scale_in', 'leader_rebuy']);
const NEUTRAL_EVENTS = new Set(['transfer_known_cluster']);
// Everything else in COPY_EVENT is treated as a risk/exit-side signal (risk wins).

const HANDOVER_PHASES = new Set(['LP_MINTED', 'POST_MIGRATION_ACTIVE']);

function routeBrain(migration_phase) {
  // Brain B once the canonical pool is minted / post-migration; Brain A otherwise.
  return HANDOVER_PHASES.has(migration_phase) ? 'brain_b' : 'brain_a';
}

function classifyCopyEvent(ce) {
  if (ENTRY_EVENTS.has(ce)) return 'entry';
  if (NEUTRAL_EVENTS.has(ce)) return 'neutral';
  return 'risk';
}

function evaluateEv(ev_metrics, ev_gate_config, mode) {
  const cfg = ev_gate_config || {};
  const m = ev_metrics || {};
  const failed = [];
  for (const name of EV_FIELDS) {
    const limit = cfg[name];
    const val = m[name];
    if (!isNum(limit)) { failed.push({ name, reason: 'missing_threshold' }); continue; }
    if (!isNum(val)) { failed.push({ name, reason: 'missing_metric' }); continue; }
    const pass = name === 'max_expected_drawdown_pct' ? val <= limit : val >= limit;
    if (!pass) failed.push({ name, reason: 'not_met' });
  }
  return { passed: failed.length === 0, failed, mode };
}

const base = () => ({ is_executable: false, is_order: false, recommendation: false, note: NOTE });

/**
 * Produce a decision DRAFT for a wallet/signal-led context. Never executes.
 * @param ctx { copy_event?, wallet_signal?, migration_phase?, hunt_status?, ev_metrics?, ev_gate_config?, ev_gate_mode?, cost? }
 */
export function decideDraft(ctx = {}) {
  const b = base();
  const hasCopyEvent = ctx.copy_event != null;
  if (hasCopyEvent && !COPY_EVENT.includes(ctx.copy_event)) {
    return { ...b, decision: 'rejected', reason: 'invalid_copy_event' };
  }
  if (ctx.migration_phase != null && !MIGRATION_PHASE.includes(ctx.migration_phase)) {
    return { ...b, decision: 'rejected', reason: 'invalid_migration_phase' };
  }

  // Wallet/signal-led requirement — mint discovery alone is NOT a buy signal.
  const walletSignal = ctx.wallet_signal === true || hasCopyEvent;
  if (!walletSignal) {
    return { ...b, decision: 'insufficient_signal', reason: 'mint_discovery_not_buy_signal' };
  }

  const strategy_brain = routeBrain(ctx.migration_phase);
  const copy_event_category = hasCopyEvent ? classifyCopyEvent(ctx.copy_event) : 'wallet_signal';

  // Risk-side copy event wins (no entry recommendation).
  if (copy_event_category === 'risk') {
    return { ...b, decision: 'rejected', reason: 'risk_signal', strategy_brain, copy_event: ctx.copy_event, copy_event_category };
  }

  // Optional cost availability (CostPipeline) — cannot recommend without a priceable cost.
  if (ctx.cost) {
    const c = estimateCost(ctx.cost);
    if (!c.priceable) {
      return { ...b, decision: 'rejected', reason: 'cost_unavailable', strategy_brain, copy_event: ctx.copy_event, copy_event_category };
    }
  }

  // EV gate.
  const mode = ctx.ev_gate_mode || 'strict';
  const ev = evaluateEv(ctx.ev_metrics, ctx.ev_gate_config, mode);
  if (!ev.passed) {
    if (mode === 'strict') {
      return { ...b, decision: 'rejected', reason: 'ev_gate_blocked', strategy_brain, copy_event: ctx.copy_event, copy_event_category, ev };
    }
    // warning_only: advisory recommendation, NEVER executable, never bypasses Hard Risk.
    return { ...b, decision: 'recommended', recommendation: true, reason: 'ev_warning_only', warning: 'WARNING_CRITICAL', strategy_brain, copy_event: ctx.copy_event, copy_event_category, ev };
  }

  return { ...b, decision: 'recommended', recommendation: true, reason: 'ok', strategy_brain, copy_event: ctx.copy_event, copy_event_category, ev };
}

export const DECISION_VALUES = Object.freeze(['recommended', 'rejected', 'insufficient_signal']);
