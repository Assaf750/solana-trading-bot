// run-modes.test.mjs — pure run-mode derivation + catalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRunMode, runModesCatalog } from '../src/engine/run-modes.mjs';

const st = (o = {}) => ({
  mode: o.mode || 'paper',
  vault: { vault_unlocked: o.unlocked ?? false },
  signer: { key_imported: o.keyImported ?? false, session_active: o.session ?? false },
  operating_state: { operating_state: o.op || 'WARMING_UP' },
  kill_switch: { global: { engaged: o.kill ?? false } },
  readiness: { blockers: (o.blockers || []).map((b) => ({ blocker: b })) },
});

test('derive: locked paper vault => read_only', () => {
  assert.equal(deriveRunMode(st({ mode: 'paper', unlocked: false })), 'read_only');
});
test('derive: unlocked paper => paper', () => {
  assert.equal(deriveRunMode(st({ mode: 'paper', unlocked: true })), 'paper');
});
test('derive: real_live but no session => live_armed', () => {
  assert.equal(deriveRunMode(st({ mode: 'real_live', unlocked: true, session: false, op: 'WARMING_UP' })), 'live_armed');
});
test('derive: real_live + unlocked + session + ACTIVE => live_active', () => {
  assert.equal(deriveRunMode(st({ mode: 'real_live', unlocked: true, session: true, op: 'ACTIVE' })), 'live_active');
});
test('derive: kill switch engaged => read_only regardless of mode', () => {
  assert.equal(deriveRunMode(st({ mode: 'real_live', unlocked: true, session: true, op: 'ACTIVE', kill: true })), 'read_only');
});
test('derive: KILLED op => read_only', () => {
  assert.equal(deriveRunMode(st({ mode: 'real_live', unlocked: true, session: true, op: 'KILLED' })), 'read_only');
});

test('catalog: paper missing requirements reflect real blockers', () => {
  const c = runModesCatalog(st({ mode: 'paper', unlocked: false, blockers: ['rpc_provider_not_configured'] }));
  const paper = c.modes.find((m) => m.id === 'paper');
  assert.ok(paper.needs.includes('Unlock the vault'));
  assert.ok(paper.needs.includes('Configure an RPC key'));
  assert.equal(c.active, 'read_only');
});

test('catalog: live_active needs list clears as state satisfies it', () => {
  const c = runModesCatalog(st({ mode: 'real_live', unlocked: true, session: true, op: 'ACTIVE' }));
  const la = c.modes.find((m) => m.id === 'live_active');
  assert.deepEqual(la.needs, []);
  assert.equal(la.active, true);
});

test('catalog: testnet is reported unavailable (not wired)', () => {
  const c = runModesCatalog(st({}));
  assert.equal(c.modes.find((m) => m.id === 'testnet').available, false);
});
