// trading-engine.mjs — the apps/server composition entry for the runtime trading engine. Phase Engine-2
// began the physical extraction: the orchestration is now OWNED by @soltrade/trading-engine (the pure
// package), which holds the lifecycle state machine (deriveDesiredState, consumed by paper-engine) and
// the composition entry (composeTradingEngine). This module composes the runtime engine by INJECTING the
// mechanism-bound substrate (paper-engine.mjs — leader-stream / fills / simulated book / liveExecutor
// delegation) into the package. ZERO behavior change: the composed engine is exactly createPaperEngine(deps).
//
// NOTE: the engine's status() still returns the `paper_engine` health field — a stable operator-UI
// contract, intentionally retained. A later phase moves more orchestration into the package and the
// substrate shrinks to a simulation-only book.
import { composeTradingEngine } from '../../../../packages/trading-engine/src/index.mjs';
import { createPaperEngine } from './paper-engine.mjs';

export function createTradingEngine(deps) {
  return composeTradingEngine({ substrateFactory: createPaperEngine, deps });
}
