// paper-portfolio.mjs — the simulated/live portfolio book (positions, FIFO trades, realized/unrealized
// P&L, daily loss tracking). The positions/portfolio book is OWNED by @soltrade/positions (ADR-0001
// Phase 2B) — the canonical and only path. The store is injected by the host (STORAGE_BACKEND=postgres
// provides a Postgres-backed store; default = the JSON store), and the book logic is identical either
// way. Always carries the `simulated` flag. (The legacy in-process book was removed in the hard legacy
// purge — see docs/architecture/legacy-audit.md §10.)
import { readJson, writeJson, newId, nowIso } from '../util.mjs';
import { createPositionsBook, createJsonPositionStore } from '../../../../packages/positions/src/index.mjs';

const DEFAULT_FILE = 'paper-portfolio.json';

export function createPaperPortfolio({ file = DEFAULT_FILE, simulated = true, positionStore = null } = {}) {
  return createPositionsBook({
    store: positionStore || createJsonPositionStore({ file, readJson, writeJson }),
    newId,
    nowIso,
    simulated,
  });
}
