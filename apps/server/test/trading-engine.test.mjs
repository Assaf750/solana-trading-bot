// trading-engine.test.mjs — ADR-0001 Phase 5F. The live/runtime trading orchestrator is now OWNED by
// trading-engine.mjs (createTradingEngine); paper-engine.mjs is the simulation/implementation substrate
// behind it. This guards the name/ownership move WITHOUT a behavior change: createTradingEngine is the
// exact same factory as createPaperEngine (re-export), the runtime composition root consumes the new
// name, and the `paper_engine` status field (a UI contract) is preserved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const { createTradingEngine } = await import('../src/engine/trading-engine.mjs');
const { createPaperEngine } = await import('../src/engine/paper-engine.mjs');

test('createTradingEngine is the canonical runtime orchestrator — exact same factory as createPaperEngine (no behavior change)', () => {
  assert.equal(typeof createTradingEngine, 'function');
  assert.equal(createTradingEngine, createPaperEngine, 'trading-engine re-exports the paper-engine factory — identical behavior');
});

test('the runtime composition root (index.mjs) is owned by trading-engine, not paper-engine', () => {
  const idx = read('apps/server/src/index.mjs');
  assert.match(idx, /import \{ createTradingEngine \} from '\.\/engine\/trading-engine\.mjs'/, 'index imports createTradingEngine');
  assert.ok(!/createPaperEngine/.test(idx), 'index must not import/use createPaperEngine directly');
  assert.ok(!/\bpaperEngine\b/.test(idx), 'index must not use a paperEngine var (renamed to tradingEngine)');
  assert.match(idx, /const tradingEngine = createTradingEngine\(/, 'index builds the tradingEngine');
});

test('the API handler is owned by trading-engine (no paperEngine var); paper_engine status field preserved', () => {
  const api = read('apps/server/src/api.mjs');
  assert.ok(!/\bpaperEngine\b/.test(api), 'api must not use a paperEngine var (renamed to tradingEngine)');
  assert.match(api, /\btradingEngine\b/, 'api uses the tradingEngine param');
  assert.match(api, /paper_engine: 'not_started'/, 'the paper_engine status field (UI contract) is preserved');
});

test('trading-engine.mjs re-exports the factory; paper-engine.mjs still exports the implementation', () => {
  assert.match(read('apps/server/src/engine/trading-engine.mjs'), /export \{ createPaperEngine as createTradingEngine \}/);
  assert.match(read('apps/server/src/engine/paper-engine.mjs'), /export function createPaperEngine\(/);
});
