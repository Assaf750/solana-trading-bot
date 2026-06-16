// trading-engine.test.mjs — ADR-0001 Phase 5F (ownership split) → Phase Engine-2 (physical extraction).
// The runtime trading orchestrator is OWNED by @soltrade/trading-engine (the PURE package): it holds the
// lifecycle state machine (deriveDesiredState, consumed by paper-engine) + the composition entry
// (composeTradingEngine). apps/server/engine/trading-engine.mjs composes the engine by INJECTING the
// mechanism-bound substrate (paper-engine) into the package — ZERO behavior change. These guards keep the
// orchestration in the package and the `paper_engine` status field (a UI contract) preserved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const { createTradingEngine } = await import('../src/engine/trading-engine.mjs');
const { createPaperEngine } = await import('../src/engine/paper-engine.mjs');
const pkg = await import('../../../packages/trading-engine/src/index.mjs');

test('createTradingEngine composes via the package (NOT a bare re-export of createPaperEngine)', () => {
  assert.equal(typeof createTradingEngine, 'function');
  assert.notEqual(createTradingEngine, createPaperEngine, 'composes through the package now, not a bare re-export');
  // the package composition delegates to the injected substrate -> zero behavior change
  const engine = { start() {} };
  assert.equal(pkg.composeTradingEngine({ substrateFactory: () => engine, deps: {} }), engine);
});

test('the runtime composition root (index.mjs) is owned by trading-engine, not paper-engine', () => {
  const idx = read('apps/server/src/index.mjs');
  assert.match(idx, /import \{ createTradingEngine \} from '\.\/engine\/trading-engine\.mjs'/, 'index imports createTradingEngine');
  assert.ok(!/createPaperEngine/.test(idx), 'index must not import/use createPaperEngine directly');
  assert.ok(!/\bpaperEngine\b/.test(idx), 'index must not use a paperEngine var');
  assert.match(idx, /const tradingEngine = createTradingEngine\(/, 'index builds the tradingEngine');
});

test('the API handler is owned by trading-engine (no paperEngine var); paper_engine status field preserved', () => {
  const api = read('apps/server/src/api.mjs');
  assert.ok(!/\bpaperEngine\b/.test(api), 'api must not use a paperEngine var');
  assert.match(api, /\btradingEngine\b/, 'api uses the tradingEngine param');
  assert.match(api, /paper_engine: 'not_started'/, 'the paper_engine status field (UI contract) is preserved');
});

test('Engine-2: apps/server composes via @soltrade/trading-engine; paper-engine is the substrate it consumes', () => {
  const te = read('apps/server/src/engine/trading-engine.mjs');
  assert.match(te, /from '\.\.\/\.\.\/\.\.\/\.\.\/packages\/trading-engine\/src\/index\.mjs'/, 'composes via the package');
  assert.match(te, /composeTradingEngine\(\{ substrateFactory: createPaperEngine/, 'injects the paper-engine substrate');
  assert.ok(!/export \{ createPaperEngine as createTradingEngine \}/.test(te), 'no longer a bare re-export');
  // the lifecycle state machine is OWNED by the package; paper-engine consumes it (no longer owns it)
  const pe = read('apps/server/src/engine/paper-engine.mjs');
  assert.match(pe, /import \{ deriveDesiredState \} from '\.\.\/\.\.\/\.\.\/\.\.\/packages\/trading-engine\/src\/index\.mjs'/, 'paper-engine consumes deriveDesiredState from the package');
  assert.match(pe, /export function createPaperEngine\(/, 'paper-engine still exports the substrate factory');
});
