// trading-engine.mjs — the canonical live/runtime trading orchestrator (ADR-0001 target:
// `packages/trading-engine`). The runtime composition root (index.mjs) consumes `createTradingEngine`;
// it owns the live path: leader-wallet stream -> swap detection -> copy-trade decision/risk pipeline ->
// liveExecutor (real money) OR the simulated book (paper mode).
//
// Phase 5F separated the OWNERSHIP/name from `paper-engine.mjs`: the implementation still physically
// lives in paper-engine.mjs (which holds BOTH the live orchestration and the simulated book), so this
// module re-exports its factory under the canonical name. This is a name/ownership move ONLY — same
// factory, same interface, ZERO behavior change. A later phase extracts the live orchestration into a
// pure `packages/trading-engine` and leaves paper-engine as a simulation-only substrate.
//
// NOTE: the engine's `status()` still returns the `paper_engine` health field — that is a stable API
// contract consumed across the operator UI, so the field name is intentionally retained.
export { createPaperEngine as createTradingEngine } from './paper-engine.mjs';
