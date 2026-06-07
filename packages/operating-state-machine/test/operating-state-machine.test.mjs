import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createOperatingStateMachine, evaluateTarget } from '../src/operating-state-machine.mjs';
import { OPERATING_STATE } from '../../ssot-types/src/core-enums.mjs';
import { decideDraft } from '../../decision-engine/src/decision-engine.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const GREEN = { provider_degraded: false, protocol_constant_status: 'green', slot_lag: 1 };

test('provider_degraded -> EXITS_ONLY', () => {
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  const r = m.apply({ ...GREEN, provider_degraded: true });
  assert.equal(r.operating_state, 'EXITS_ONLY');
  assert.equal(r.warning, 'WARNING_CRITICAL');
});

test('unsafe slot_lag -> EXITS_ONLY', () => {
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  assert.equal(m.apply({ ...GREEN, slot_lag: 50 }).operating_state, 'EXITS_ONLY');
});

test('stream_gap -> EXITS_ONLY', () => {
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  assert.equal(m.apply({ ...GREEN, stream_gap: true }).operating_state, 'EXITS_ONLY');
});

test('unknown/unverifiable health -> EXITS_ONLY (no fail-open)', () => {
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  assert.equal(m.apply({}).operating_state, 'EXITS_ONLY');                                  // nothing known
  assert.equal(m.apply({ provider_degraded: false }).operating_state, 'EXITS_ONLY');         // protocol unknown
  assert.equal(m.apply({ protocol_constant_status: 'green' }).operating_state, 'EXITS_ONLY'); // provider unknown
  assert.equal(m.apply({ ...GREEN, protocol_constant_status: 'weird' }).operating_state, 'EXITS_ONLY'); // unverifiable
});

test('protocol_constant_status=changed -> KILLED (sticky, human reset only)', () => {
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  assert.equal(m.apply({ ...GREEN, protocol_constant_status: 'changed' }).operating_state, 'KILLED');
  // sticky: even fully-green signals do NOT auto-recover from KILLED
  assert.equal(m.apply(GREEN).operating_state, 'KILLED');
  // only an explicit human reset moves out (to WARMING_UP)
  assert.equal(m.operatorReset().operating_state, 'WARMING_UP');
});

test('all-green confirmed -> ACTIVE', () => {
  const m = createOperatingStateMachine({ initial: 'WARMING_UP', slot_lag_threshold: 5 });
  assert.equal(m.apply(GREEN).operating_state, 'ACTIVE');
});

test('EXITS_ONLY blocks new entries and permits exits only', () => {
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  m.apply({ ...GREEN, provider_degraded: true }); // -> EXITS_ONLY
  assert.equal(m.isActionAllowed('entry'), false, 'entry must be blocked');
  assert.equal(m.isActionAllowed('exit'), true, 'exit must be permitted');
  assert.equal(m.isActionAllowed('diagnostic'), true);
});

test('KILLED blocks unsafe actions (entry & exit), permits safe diagnostics', () => {
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  m.apply({ ...GREEN, protocol_constant_status: 'changed' }); // -> KILLED
  assert.equal(m.isActionAllowed('entry'), false);
  assert.equal(m.isActionAllowed('exit'), false);
  assert.equal(m.isActionAllowed('diagnostic'), true);
});

test('integration: EXITS_ONLY gates a new entry even when the decision recommends it', () => {
  // A perfectly valid wallet-led recommendation...
  const rec = decideDraft({
    copy_event: 'leader_buy', wallet_signal: true, migration_phase: 'PRE_MIGRATION', ev_gate_mode: 'strict',
    ev_gate_config: { minimum_net_expectancy: 0.05, minimum_profit_factor: 1.5, minimum_lower_confidence_bound: 0.1, minimum_sample_size: 30, minimum_exit_success_rate: 70, max_expected_drawdown_pct: 40 },
    ev_metrics: { minimum_net_expectancy: 0.2, minimum_profit_factor: 2, minimum_lower_confidence_bound: 0.3, minimum_sample_size: 80, minimum_exit_success_rate: 85, max_expected_drawdown_pct: 20 },
  });
  assert.equal(rec.decision, 'recommended');
  // ...is still NOT admissible as an entry while the system is EXITS_ONLY.
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  m.apply({ ...GREEN, provider_degraded: true });
  const entryAdmissible = rec.decision === 'recommended' && m.isActionAllowed('entry');
  assert.equal(entryAdmissible, false, 'EXITS_ONLY must veto a new entry regardless of recommendation');
});

test('action policy values are valid operating_state keys; unknown action denied', () => {
  const m = createOperatingStateMachine({ initial: 'ACTIVE', slot_lag_threshold: 5 });
  m.apply(GREEN);
  assert.equal(m.isActionAllowed('nonsense'), false);
  for (const s of ['WARMING_UP', 'ACTIVE', 'EXITS_ONLY', 'PAUSED', 'KILLED']) assert.ok(OPERATING_STATE.includes(s));
});

test('no network / DB / signing / live provider in source', () => {
  const BAD = /(signTransaction|sendTransaction|buildTransaction|\.serialize\(|@solana\/|helius|triton|yellowstone|jito|jupiter|new WebSocket|node:net|node:http|node:fs|\bfetch\b|axios|undici|https?:\/\/|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|\bpg\b)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `forbidden mechanism in ${fn}`);
  }
});

test('no forbidden names and no secrets in source', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
