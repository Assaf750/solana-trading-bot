import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../src/core-enums.mjs';
import { CANDIDATE_ENUMS, CANDIDATE_FIELDS } from '../src/candidate-enums.mjs';
import { FORBIDDEN_NAMES } from '../src/forbidden.mjs';
import { runDriftCheck } from '../../../tools/check-ssot-drift.mjs';

test('drift guard passes (no name outside SSOT, no forbidden, candidate prefixes intact)', () => {
  const { ok, errors } = runDriftCheck();
  assert.equal(ok, true, 'drift errors:\n' + errors.join('\n'));
});

test('core enums are frozen and non-empty', () => {
  for (const [name, values] of Object.entries(core.CORE_ENUMS)) {
    assert.ok(Array.isArray(values) && values.length > 0, `${name} must be non-empty`);
    assert.ok(Object.isFrozen(values), `${name} must be frozen`);
    assert.equal(new Set(values).size, values.length, `${name} must have unique values`);
  }
});

test('no forbidden/rejected name appears as a core enum name or value', () => {
  const forbidden = new Set(FORBIDDEN_NAMES);
  const declared = new Set([
    ...Object.keys(core.CORE_ENUMS),
    ...Object.values(core.CORE_ENUMS).flat(),
  ]);
  for (const n of declared) assert.equal(forbidden.has(n), false, `forbidden name leaked: ${n}`);
});

test('every candidate name keeps its candidate_ prefix (no candidate->implemented)', () => {
  for (const n of Object.keys(CANDIDATE_ENUMS)) assert.match(n, /^candidate_/, `${n} lost prefix`);
  for (const n of CANDIDATE_FIELDS) assert.match(n, /^candidate_/, `${n} lost prefix`);
});

test('forbidden registry includes the always-forbidden execution names', () => {
  const forbidden = new Set(FORBIDDEN_NAMES);
  for (const n of ['buy_opportunity', 'execute_opportunity', 'submit_opportunity',
    'exit_all_positions', 'batch_exit_all_positions', 'current_price', 'realized_pnl', 'HUNTABLE']) {
    assert.ok(forbidden.has(n), `expected ${n} in forbidden registry`);
  }
});

test('known SSOT enum shapes are exact', () => {
  assert.deepEqual([...core.OPERATING_STATE], ['WARMING_UP', 'ACTIVE', 'EXITS_ONLY', 'PAUSED', 'KILLED']);
  assert.deepEqual([...core.COPY_MODE], ['follow_entry_user_exit', 'full_mirror']);
  assert.equal(core.COPY_EVENT.length, 17);
});
