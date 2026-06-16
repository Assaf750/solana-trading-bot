// legacy-shim-guard.test.mjs — ADR-0001 Phase 3B.1. BEHAVIORAL coverage of the legacy compatibility
// shims BEFORE any future removal (3B.2). For each *_BACKEND flag this confirms: the legacy branch still
// works when =legacy, the package backend is the default (unset), and an unknown value resolves to the
// package backend (never legacy). No behavior change — these are read-only guards. The flags are read at
// call time, so process.env can be toggled per assertion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// set the data dir BEFORE importing engine modules (util captures it at load) — for the positions book
process.env.SOLTRADE_DATA_DIR = mkdtempSync(join(tmpdir(), 'soltrade-shim-'));

const { checkEntryGates } = await import('../src/engine/risk-gates.mjs');
const { createProviderHealth } = await import('../src/engine/provider-health.mjs');
const { createPaperPortfolio } = await import('../src/engine/paper-portfolio.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// run `fn` with process.env[key] forced to `val` (undefined => unset), then restore
function withEnv(key, val, fn) {
  const prev = process.env[key];
  if (val === undefined) delete process.env[key]; else process.env[key] = val;
  try { return fn(); } finally { if (prev === undefined) delete process.env[key]; else process.env[key] = prev; }
}

// ---------- RISK_BACKEND — shim REMOVED in 3B.2; the env var is now inert (confirmed below) ----------
const FULL_HR = {
  max_daily_loss_pct: 50, max_daily_loss_usdt: 1000, max_total_drawdown_pct: 80, max_open_positions: 5,
  max_position_size_pct: 10, max_token_exposure_pct: 20, max_creator_exposure_pct: 30,
  max_cluster_exposure_pct: 40, max_correlated_meme_exposure_pct: 50,
};
const cfg = (over = {}) => ({ hard_risk: { ...FULL_HR }, execution: { capital_limit: 1000 }, lists: {}, ...over });
const pf = () => ({ openCount: () => 0, tokenExposureUsd: () => 0, leaderExposureUsd: () => 0, dailyRealized: () => 0, summary: () => ({ realized_pnl_usd: 0, unrealized_pnl_usd: 0 }) });
const baseArgs = () => ({ cfg: cfg(), portfolio: pf(), sizeUsd: 10, tokenMint: 'M', killBlocked: false, operatingState: 'ACTIVE' });

// Phase 3B.2 REMOVED the RISK_BACKEND shim — the env var is no longer read; checkEntryGates always uses
// @soltrade/risk. Confirm the value has no effect and the verdicts are still correct (allow + reject).
test('RISK_BACKEND: shim removed (3B.2) — env value has no effect; gate is @soltrade/risk', () => {
  for (const args of [baseArgs(), { ...baseArgs(), killBlocked: true }]) {
    const verdict = checkEntryGates(args);
    assert.deepEqual(withEnv('RISK_BACKEND', 'legacy', () => checkEntryGates(args)), verdict, 'RISK_BACKEND=legacy is ignored now');
    assert.deepEqual(withEnv('RISK_BACKEND', 'garbage', () => checkEntryGates(args)), verdict, 'unknown value is ignored');
  }
  assert.equal(checkEntryGates(baseArgs()).allowed, true);
  assert.equal(checkEntryGates({ ...baseArgs(), killBlocked: true }).allowed, false);
  const src = readFileSync(join(ROOT, 'apps', 'server', 'src', 'engine', 'risk-gates.mjs'), 'utf8');
  assert.ok(!/process\.env\.RISK_BACKEND|legacyCheckEntryGates/.test(src), 'risk-gates no longer carries the RISK shim'); // comment may name the removed flag
});

// ---------- PROVIDER_BACKEND — both monitors are usable under every flag value ----------
test('PROVIDER_BACKEND: legacy + default + unknown all build a working provider-health monitor', () => {
  for (const val of ['legacy', undefined, 'garbage']) {
    const m = withEnv('PROVIDER_BACKEND', val, () => createProviderHealth());
    assert.equal(typeof m.record, 'function', `record present (PROVIDER_BACKEND=${val})`);
    assert.equal(typeof m.snapshot, 'function', `snapshot present (PROVIDER_BACKEND=${val})`);
    m.record('rpc', true, 10, null);
    assert.ok(m.snapshot().rpc, `snapshot reflects a recorded provider (PROVIDER_BACKEND=${val})`);
  }
});

// ---------- POSITIONS_BACKEND — both books accept an entry under every flag value ----------
const ENTRY = { leader_address: 'L', wallet_id: 'w', token_mint: 'M', qty_ui: 100, decimals: 6, cost_usd: 50, fee_usd_est: 1, price_impact_pct: 0.1, copy_mode: 'follow_entry_user_exit', tp_pct: null, sl_pct: null };
test('POSITIONS_BACKEND: legacy + default + unknown all build a working positions book', () => {
  for (const [val, file] of [['legacy', 'shim-legacy.json'], [undefined, 'shim-pkg.json'], ['garbage', 'shim-unknown.json']]) {
    const book = withEnv('POSITIONS_BACKEND', val, () => createPaperPortfolio({ file, simulated: true }));
    const p = book.recordEntry(ENTRY);
    assert.ok(p && p.position_id, `recordEntry returns a position (POSITIONS_BACKEND=${val})`);
    assert.equal(book.openCount(), 1, `book tracks the open position (POSITIONS_BACKEND=${val})`);
  }
});

// ---------- DECISION_LEDGER_BACKEND — heavy to instantiate; source-guard the dispatch (default=package) ----------
test('DECISION_LEDGER_BACKEND: dispatch selects legacy ONLY on the literal "legacy" (default = package)', () => {
  const src = readFileSync(join(ROOT, 'apps', 'server', 'src', 'engine', 'live-executor.mjs'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.match(src, /process\.env\.DECISION_LEDGER_BACKEND\s*===\s*'legacy'\s*\?\s*legacyLedger\s*:\s*packageLedger/);
  assert.ok(!/\|\|\s*'legacy'/.test(src), 'must never default to legacy');
});
