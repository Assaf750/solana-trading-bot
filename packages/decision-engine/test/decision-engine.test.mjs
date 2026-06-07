import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { decideDraft } from '../src/decision-engine.mjs';
import { COPY_EVENT, STRATEGY_BRAIN } from '../../ssot-types/src/core-enums.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const ctx = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'decision-context.json'), 'utf8'));

const assertNeverExecutable = (r) => {
  assert.equal(r.is_executable, false, 'is_executable must always be false');
  assert.equal(r.is_order, false, 'is_order must always be false');
};

test('happy path: wallet-led entry + EV pass -> recommended (but NOT executable)', () => {
  const r = decideDraft(ctx());
  assert.equal(r.decision, 'recommended');
  assert.equal(r.recommendation, true);
  assertNeverExecutable(r);
  assert.match(r.note, /NOT an order, NOT execution/i);
  assert.ok(STRATEGY_BRAIN.includes(r.strategy_brain));
});

test('recommendation does not mean execution (no order, not executable, on every result)', () => {
  for (const c of [ctx(), {}, { wallet_signal: true }, { copy_event: 'leader_full_exit', wallet_signal: true }]) {
    assertNeverExecutable(decideDraft(c));
  }
});

test('mint discovery alone is NOT a buy signal (needs wallet/signal-led input)', () => {
  const r = decideDraft({ hunt_status: 'discovered', migration_phase: 'PRE_MIGRATION' }); // no copy_event / wallet_signal
  assert.equal(r.decision, 'insufficient_signal');
  assert.equal(r.reason, 'mint_discovery_not_buy_signal');
  assertNeverExecutable(r);
});

test('risk-side copy_event is rejected (risk signal wins)', () => {
  const r = decideDraft({ ...ctx(), copy_event: 'leader_full_exit' });
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reason, 'risk_signal');
  assert.equal(r.copy_event_category, 'risk');
});

test('EV strict blocks recommendation when thresholds are not met/missing', () => {
  const c = ctx();
  c.ev_metrics = { ...c.ev_metrics, minimum_profit_factor: 0.5 }; // below threshold
  const r = decideDraft(c);
  assert.equal(r.decision, 'rejected');
  assert.equal(r.reason, 'ev_gate_blocked');
  assert.ok(r.ev.failed.some((f) => f.name === 'minimum_profit_factor'));
  // missing metric under strict also blocks
  const c2 = ctx(); delete c2.ev_metrics.minimum_net_expectancy;
  assert.equal(decideDraft(c2).decision, 'rejected');
});

test('warning_only does NOT bypass Hard Risk and does NOT grant execution', () => {
  const c = ctx();
  c.ev_gate_mode = 'warning_only';
  c.ev_metrics = { ...c.ev_metrics, minimum_profit_factor: 0.1 }; // would fail EV
  const r = decideDraft(c);
  assert.equal(r.decision, 'recommended');
  assert.equal(r.warning, 'WARNING_CRITICAL');
  assertNeverExecutable(r); // still not executable
});

test('brain routing: pre-migration -> brain_a; post/LP_MINTED -> brain_b', () => {
  assert.equal(decideDraft({ ...ctx(), migration_phase: 'PRE_MIGRATION' }).strategy_brain, 'brain_a');
  assert.equal(decideDraft({ ...ctx(), migration_phase: 'LP_MINTED' }).strategy_brain, 'brain_b');
  assert.equal(decideDraft({ ...ctx(), migration_phase: 'POST_MIGRATION_ACTIVE' }).strategy_brain, 'brain_b');
});

test('invalid copy_event / migration_phase rejected (SSOT enums)', () => {
  assert.equal(decideDraft({ copy_event: 'nope', wallet_signal: true }).reason, 'invalid_copy_event');
  assert.equal(decideDraft({ wallet_signal: true, migration_phase: 'nope' }).reason, 'invalid_migration_phase');
  assert.ok(COPY_EVENT.includes('leader_buy'));
});

test('does NOT import or call the execution adapter / build orders', () => {
  const BAD = /(execution-paper-adapter|paper-execution-adapter|\.simulate\(|createPaperExecutionAdapter|intent_id|signTransaction|sendTransaction|buildTransaction|\.serialize\()/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `execution/order coupling in ${fn}`);
  }
});

test('no network / DB / signing in source', () => {
  const BAD = /(\bfetch\b|axios|undici|https?:\/\/|@solana\/|new WebSocket|node:net|node:http|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|\bpg\b|node:fs|writeFileSync|sendTransaction|signTransaction)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `network/db/signing in ${fn}`);
  }
});

test('no forbidden names and no secrets in source/fixtures', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  const files = [...readdirSync(SRC).map((f) => join(SRC, f)), join(HERE, '..', 'fixtures', 'decision-context.json')];
  for (const fn of files) {
    if (!/\.(mjs|json)$/.test(fn)) continue;
    const code = readFileSync(fn, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
