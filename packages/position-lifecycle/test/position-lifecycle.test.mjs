import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createPositionLifecycle, isTerminalState } from '../src/position-lifecycle.mjs';
import { POSITION_STATE } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sample = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'sample-position.json'), 'utf8'));

function openOne() {
  const lc = createPositionLifecycle();
  assert.equal(lc.open(sample()).ok, true);
  return lc;
}

test('open creates OPENING with frozen entry_brain & config_version_at_entry', () => {
  const lc = openOne();
  const p = lc.get('pos-dev-0001');
  assert.equal(p.position_state, 'OPENING');
  assert.equal(p.entry_brain, 'brain_a');
  assert.equal(p.current_control_brain, 'brain_a');
  assert.equal(p.config_version_at_entry, 1);
  assert.equal(p.market_phase, 'PRE_MIGRATION');
  // invalid open inputs rejected
  const lc2 = createPositionLifecycle();
  assert.equal(lc2.open({ id: 'x', entry_brain: 'bogus', config_version_at_entry: 1 }).reason, 'invalid_entry_brain');
  assert.equal(lc2.open({ id: 'y', entry_brain: 'brain_a' }).reason, 'config_version_at_entry_required');
});

test('valid transitions pass; full happy path to CLOSED', () => {
  const lc = openOne();
  assert.equal(lc.transition('pos-dev-0001', 'OPEN').ok, true);
  assert.equal(lc.transition('pos-dev-0001', 'EXIT_PENDING').ok, true);
  assert.equal(lc.transition('pos-dev-0001', 'CLOSED').ok, true);
  assert.equal(lc.get('pos-dev-0001').position_state, 'CLOSED');
});

test('illegal transition is rejected with COMMAND_NOT_ALLOWED_IN_STATE', () => {
  const lc = openOne(); // OPENING
  const r = lc.transition('pos-dev-0001', 'CLOSED'); // OPENING cannot jump to CLOSED
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.ok(API_ERROR_CODE.includes(r.api_error_code));
  assert.equal(lc.transition('pos-dev-0001', 'NOPE').reason, 'invalid_position_state');
});

test('terminal/closed positions never reopen', () => {
  const lc = openOne();
  lc.transition('pos-dev-0001', 'OPEN');
  lc.transition('pos-dev-0001', 'CLOSED');
  assert.equal(lc.isTerminal('pos-dev-0001'), true);
  for (const to of POSITION_STATE.filter((s) => s !== 'CLOSED')) {
    assert.equal(lc.transition('pos-dev-0001', to).ok, false, `CLOSED must not -> ${to}`);
  }
  assert.equal(isTerminalState('FAILED_ENTRY'), true);
  assert.equal(isTerminalState('OPEN'), false);
});

test('FAILED_EXIT can retry exit but never reopens to OPEN', () => {
  const lc = openOne();
  lc.transition('pos-dev-0001', 'OPEN');
  lc.transition('pos-dev-0001', 'FAILED_EXIT');
  assert.equal(lc.transition('pos-dev-0001', 'OPEN').ok, false, 'FAILED_EXIT must not reopen to OPEN');
  assert.equal(lc.transition('pos-dev-0001', 'EXIT_PENDING').ok, true, 'FAILED_EXIT may retry exit');
});

test('no two conflicting actions: a pending state blocks a conflicting pending', () => {
  const lc = openOne();
  lc.transition('pos-dev-0001', 'OPEN');
  lc.transition('pos-dev-0001', 'EXIT_PENDING');
  // EXIT_PENDING cannot switch to MIRROR_SELL_PENDING (conflicting concurrent exit path)
  assert.equal(lc.transition('pos-dev-0001', 'MIRROR_SELL_PENDING').ok, false);
});

test('config_version_at_entry & entry_brain are frozen (no setter; survive transitions)', () => {
  const lc = openOne();
  lc.transition('pos-dev-0001', 'OPEN');
  const p = lc.get('pos-dev-0001');
  assert.equal(p.config_version_at_entry, 1);
  assert.equal(p.entry_brain, 'brain_a');
  for (const m of ['setConfigVersion', 'setEntryBrain', 'delete', 'reopen']) {
    assert.equal(lc[m], undefined, `must NOT expose ${m}`);
  }
});

test('current_control_brain handover only via migration (LP_MINTED+), entry_brain unchanged', () => {
  const lc = openOne();
  lc.transition('pos-dev-0001', 'OPEN');
  // handover before LP_MINTED is rejected
  assert.equal(lc.handoverControlBrain('pos-dev-0001', 'brain_b').ok, false);
  // advance migration forward to LP_MINTED
  assert.equal(lc.advanceMigrationPhase('pos-dev-0001', 'MIGRATION_APPROACHING').ok, true);
  assert.equal(lc.advanceMigrationPhase('pos-dev-0001', 'MIGRATION_IN_PROGRESS').ok, true);
  assert.equal(lc.advanceMigrationPhase('pos-dev-0001', 'LP_MINTED').ok, true);
  // backward migration rejected
  assert.equal(lc.advanceMigrationPhase('pos-dev-0001', 'PRE_MIGRATION').ok, false);
  // now handover allowed
  const h = lc.handoverControlBrain('pos-dev-0001', 'brain_b');
  assert.equal(h.ok, true);
  assert.equal(lc.get('pos-dev-0001').current_control_brain, 'brain_b');
  assert.equal(lc.get('pos-dev-0001').entry_brain, 'brain_a', 'entry_brain stays frozen');
  assert.equal(lc.get('pos-dev-0001').market_phase, 'LP_MINTED', 'market_phase mirrors migration_phase');
});

test('no DB writes / execution / signing / network in source', () => {
  const DBX = /(INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|\bpg\b|clickhouse|node:fs|writeFileSync|signTransaction|sendTransaction|\bfetch\b|axios|undici|https?:\/\/|@solana\/|node:net|node:http)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(DBX.test(code), false, `db/exec/network in ${fn}`);
  }
});

test('no forbidden names and no secrets in source/fixtures', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  const files = [...readdirSync(SRC).map((f) => join(SRC, f)), join(HERE, '..', 'fixtures', 'sample-position.json')];
  for (const fn of files) {
    if (!/\.(mjs|json)$/.test(fn)) continue;
    const code = readFileSync(fn, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
