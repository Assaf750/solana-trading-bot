// @soltrade/paper-e2e — paper end-to-end orchestration + Gate B evidence (Gate B / B9).
// Wires the PAPER path only, all in-memory, all simulated:
//   replay ingestion -> decision (skeleton) -> [adapter: risk gates -> signer boundary (no sign)
//   -> position lifecycle] using the intent ledger -> paper portfolio (candidate P&L) -> in-memory audit.
//
// NO live trading, NO REAL-LIVE, NO Gate C, NO RPC/provider/network, NO signing/sending, NO DB writes.
// Reuses existing package outputs only; introduces no SSOT/API/DATA names.

import { createStreamIngestion } from '../../stream-ingestion/src/stream-ingestion.mjs';
import { decideDraft } from '../../decision-engine/src/decision-engine.mjs';
import { createIntentLedger } from '../../intent-ledger/src/intent-ledger.mjs';
import { createPositionLifecycle } from '../../position-lifecycle/src/position-lifecycle.mjs';
import { createPaperExecutionAdapter } from '../../execution-paper-adapter/src/paper-execution-adapter.mjs';
import { createPaperPortfolio } from '../../paper-portfolio/src/paper-portfolio.mjs';
import { evaluateRpcHealth } from '../../foundations/src/rpc-health-monitor.mjs';

/**
 * Run the paper pipeline for one scenario. Deterministic, in-memory, simulated.
 * @param scenario { events, signal, intent, position, exec_ctx, fill, mark }
 * @param deps optional injected in-memory instances
 */
export function runPaperPipeline(scenario = {}, deps = {}) {
  const ingestion = deps.ingestion || createStreamIngestion();
  const ledger = deps.ledger || createIntentLedger();
  const lifecycle = deps.lifecycle || createPositionLifecycle();
  const portfolio = deps.portfolio || createPaperPortfolio();
  const adapter = deps.adapter || createPaperExecutionAdapter({ ledger, lifecycle });

  const stages = {};

  // 1) replay/mock ingestion
  stages.ingestion = ingestion.replay(scenario.events || []);

  // 2) decision engine skeleton -> draft/recommendation (never execution)
  const decision = decideDraft(scenario.signal || {});
  stages.decision = decision;
  if (decision.decision !== 'recommended') {
    return { ok: true, simulated: true, completed: false, stopped_at: 'decision', stages };
  }

  // 3) intent ledger — no order without intent_id
  const created = ledger.create(scenario.intent || {});
  stages.intent = created;
  if (!created.ok) {
    return { ok: true, simulated: true, completed: false, stopped_at: 'intent_ledger', stages };
  }

  // open the position (OPENING)
  stages.position_open = lifecycle.open(scenario.position || {});

  // 4) paper adapter — internally enforces Risk Gates -> Signer boundary (no sign) -> lifecycle -> simulator
  const sim = adapter.simulate({ intent_id: created.intent_id }, scenario.exec_ctx || {});
  stages.paper_adapter = sim;
  if (sim.blocked_by) {
    return { ok: true, simulated: true, completed: false, stopped_at: `adapter:${sim.blocked_by}`, signed: sim.signed, executed: sim.executed, stages };
  }

  // 5) paper portfolio — candidate P&L read-model from the SIMULATED fill
  if (scenario.fill && scenario.position && scenario.position.id) {
    portfolio.addSimulatedFill({ position_ref: scenario.position.id, ...scenario.fill });
  }
  stages.portfolio = scenario.position && scenario.position.id
    ? portfolio.getPortfolio(scenario.position.id, scenario.mark)
    : null;

  // 6) audit (in-memory, append-only) recorded by the ledger + lifecycle
  stages.audit = {
    intent_entries: ledger.auditEntries().length,
    position_entries: lifecycle.auditEntries().length,
  };

  return {
    ok: true,
    simulated: true,
    completed: true,
    signed: sim.signed,                 // false
    executed: sim.executed,             // false
    is_valid_on_chain: sim.is_valid_on_chain, // false
    position_state: lifecycle.get(scenario.position.id)?.position_state,
    stages,
  };
}

// Re-exported for the EXITS_ONLY / single-provider evidence (provider_degraded detection).
export { evaluateRpcHealth };
