import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { runPaperPipeline, evaluateRpcHealth } from '../src/paper-e2e.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const happy = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'happy-scenario.json'), 'utf8'));

test('paper end-to-end completes (ingestion -> decision -> risk -> intent -> adapter -> lifecycle -> portfolio -> audit)', () => {
  const r = runPaperPipeline(happy());
  assert.equal(r.completed, true);
  assert.equal(r.simulated, true);
  // signer/adapter invariants
  assert.equal(r.signed, false);
  assert.equal(r.executed, false);
  assert.equal(r.is_valid_on_chain, false);
  // stage outcomes
  assert.equal(r.stages.decision.decision, 'recommended');
  assert.equal(r.stages.intent.ok, true);
  assert.ok(r.stages.paper_adapter.simulated_fill, 'expected a simulated fill');
  assert.equal(r.position_state, 'OPEN');
  // candidate, simulated P&L read-model
  assert.equal(r.stages.portfolio.simulated, true);
  assert.equal(typeof r.stages.portfolio.candidate_realized_pnl, 'number');
  assert.equal(r.stages.portfolio.unrealized.candidate_mark_status, 'valid');
  // in-memory audit recorded
  assert.ok(r.stages.audit.intent_entries >= 1);
  assert.ok(r.stages.audit.position_entries >= 1);
});

test('Risk Gates block stops the paper path (no fill, position stays OPENING)', () => {
  const s = happy();
  s.exec_ctx.measured = { ...s.exec_ctx.measured, max_daily_loss_pct: 999 };
  const r = runPaperPipeline(s);
  assert.equal(r.completed, false);
  assert.equal(r.stopped_at, 'adapter:risk_gates');
  assert.equal(r.stages.paper_adapter.blocked_by, 'risk_gates');
  assert.equal(r.stages.paper_adapter.simulated_fill, undefined);
});

test('no order without intent_id (pipeline stops at intent_ledger)', () => {
  const s = happy();
  delete s.intent.intent_id;
  const r = runPaperPipeline(s);
  assert.equal(r.stopped_at, 'intent_ledger');
  assert.equal(r.stages.intent.ok, false);
});

test('rejected/insufficient decision stops before any intent/execution', () => {
  const s = happy();
  delete s.signal.copy_event;
  delete s.signal.wallet_signal; // mint discovery alone
  const r = runPaperPipeline(s);
  assert.equal(r.stopped_at, 'decision');
  assert.equal(r.stages.decision.decision, 'insufficient_signal');
  assert.equal(r.stages.intent, undefined);
});

test('provider_degraded is detectable (EXITS_ONLY trigger evidence)', () => {
  const h = evaluateRpcHealth([
    { provider: 'p1', slot: 100, primary: true },
    { provider: 'p2', slot: 130 },
  ], { slot_lag_threshold: 5 });
  assert.equal(h.provider_degraded, true);
  assert.equal(h.slot_lag, 30);
});

test('no DB / network / signing / serialization in source', () => {
  const BAD = /(signTransaction|sendTransaction|sendRawTransaction|buildTransaction|\.serialize\(|@solana\/|new WebSocket|node:net|node:http|node:fs|\bfetch\b|axios|undici|https?:\/\/|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|\bpg\b)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `db/network/signing in ${fn}`);
  }
});

test('no REAL-LIVE / Gate-C / UX-API / opportunity-radar-PnL coupling in source', () => {
  const BAD = /(REAL[_-]?LIVE|real_live|activate_real_live|gate[_ -]?c|createServer|res\.json|app\.get|express|dashboard)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `forbidden coupling in ${fn}`);
  }
});

test('no forbidden names / candidate prefix integrity / no secrets', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  const files = [...readdirSync(SRC).map((f) => join(SRC, f)), join(HERE, '..', 'fixtures', 'happy-scenario.json')];
  for (const fn of files) {
    if (!/\.(mjs|json)$/.test(fn)) continue;
    const raw = readFileSync(fn, 'utf8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
    // any candidate_ token keeps its prefix (no bare stripped form introduced)
    for (const m of raw.matchAll(/candidate_[a-z_]+/g)) assert.match(m[0], /^candidate_/);
  }
});
