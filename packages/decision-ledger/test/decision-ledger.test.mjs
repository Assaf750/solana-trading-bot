import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDecisionLedger, createMemoryIntentStore, createJsonIntentStore, validateIntentTransition,
} from '../src/index.mjs';

const fixedNow = () => '2026-06-15T00:00:00.000Z';
const ledger = (initial) => createDecisionLedger({ store: createMemoryIntentStore(initial), now: fixedNow });

// in-memory JSON io mimicking apps/server util.mjs { value, corrupt } shape
function fakeIo({ corrupt = false, initial = { intents: {} } } = {}) {
  let stored = initial;
  return {
    readJson: (_name, fallback) => (corrupt ? { value: fallback, corrupt: true } : { value: stored ?? fallback, corrupt: false }),
    writeJson: (_name, value) => { stored = value; },
    peek: () => stored,
  };
}

// ---------- legacy-exact idempotency primitives (golden parity with apps/server) ----------
test('parity: new intent claims OK with PENDING + notional_charged false', () => {
  const dl = ledger();
  const r = dl.claimIntent('int_a', { side: 'buy' });
  assert.deepEqual(r, { ok: true });
  const it = dl.getIntent('int_a');
  assert.equal(it.status, 'PENDING');
  assert.equal(it.notional_charged, false);
  assert.equal(it.ts, fixedNow());
});

test('parity: duplicate idempotency key is rejected with intent_duplicate_<status>', () => {
  const dl = ledger();
  dl.claimIntent('int_a', { side: 'buy' });
  const r2 = dl.claimIntent('int_a', { side: 'buy' });
  assert.deepEqual(r2, { ok: false, error: 'intent_duplicate_PENDING' });
});

test('parity: RETRYABLE statuses allow re-claim; non-retryable block (no double-spend)', () => {
  const dl = ledger();
  for (const s of ['FAILED_PRE_SEND', 'FAILED_SEND', 'FAILED_ON_CHAIN']) {
    dl.claimIntent('int_r', {});
    dl.setIntent('int_r', s);
    assert.equal(dl.claimIntent('int_r', {}).ok, true, `${s} must be retryable`);
  }
  for (const s of ['SENT', 'SENT_UNCONFIRMED', 'CONFIRMED']) {
    dl.claimIntent('int_b', {});
    dl.setIntent('int_b', s, { signature: 'x' });
    assert.equal(dl.claimIntent('int_b', {}).ok, false, `${s} must block (may have landed)`);
    dl.setIntent('int_b', 'FAILED_ON_CHAIN'); // reset for next loop iter
  }
});

test('parity: notional_charged is preserved across a retried (reverted) intent', () => {
  const dl = ledger();
  dl.claimIntent('int_c', {});
  dl.setIntent('int_c', 'FAILED_ON_CHAIN', { notional_charged: true });
  dl.claimIntent('int_c', {}); // retry
  assert.equal(dl.getIntent('int_c').notional_charged, true, 'cap charged once across retry');
});

test('parity: setIntent only updates existing; missing id is a no-op (fail-closed read)', () => {
  const dl = ledger();
  dl.setIntent('nope', 'CONFIRMED');
  assert.equal(dl.getIntent('nope'), null);
});

test('parity: confirmed intent is not mutated by an unrelated set on another id', () => {
  const dl = ledger();
  dl.claimIntent('int_keep', {});
  dl.setIntent('int_keep', 'CONFIRMED', { signature: 'SIG' });
  dl.claimIntent('int_other', {});
  assert.equal(dl.getIntent('int_keep').status, 'CONFIRMED');
  assert.equal(dl.getIntent('int_keep').signature, 'SIG');
});

test('parity: intentIdFor is deterministic, prefixed, 16-hex', () => {
  const dl = ledger();
  const id = dl.intentIdFor(['buy', 'leaderX', 'MintY', '123']);
  assert.equal(id, dl.intentIdFor(['buy', 'leaderX', 'MintY', '123']));
  assert.match(id, /^int_[0-9a-f]{16}$/);
});

test('parity: listIntents slices to limit; pendingIntents filters SENT*/with-signature', () => {
  const dl = ledger();
  dl.claimIntent('int_1', {}); dl.setIntent('int_1', 'SENT', { signature: 's1' });
  dl.claimIntent('int_2', {}); dl.setIntent('int_2', 'SENT_UNCONFIRMED', { signature: 's2' });
  dl.claimIntent('int_3', {}); dl.setIntent('int_3', 'CONFIRMED', { signature: 's3' }); // not pending
  dl.claimIntent('int_4', {}); dl.setIntent('int_4', 'SENT'); // no signature -> excluded
  const pend = dl.pendingIntents().map((p) => p.intent_id).sort();
  assert.deepEqual(pend, ['int_1', 'int_2']);
  assert.equal(dl.listIntents(2).length, 2);
});

// ---------- canonical lifecycle API ----------
const baseIntent = { intent_id: 'int_x', idempotency_key: 'key-1', intent_type: 'BUY_INTENT', token_mint: 'm' };

test('canonical: createExecutionIntent validates the contract and stores CREATED', () => {
  const dl = ledger();
  const r = dl.createExecutionIntent(baseIntent);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.intent.status, 'CREATED');
  assert.equal(dl.getIntent('int_x').idempotency_key, 'key-1');
});

test('canonical: invalid intent rejected; duplicate id and duplicate idempotency-key rejected', () => {
  const dl = ledger();
  assert.equal(dl.createExecutionIntent({ intent_id: 'a' }).error, 'invalid_execution_intent');
  dl.createExecutionIntent(baseIntent);
  assert.equal(dl.createExecutionIntent(baseIntent).error, 'intent_id_exists');
  assert.equal(dl.createExecutionIntent({ ...baseIntent, intent_id: 'int_y' }).error, 'idempotent_duplicate');
});

test('canonical: full happy lifecycle CREATED→PLANNED→SIGNED→BROADCAST→CONFIRMED→FILLED', () => {
  const dl = ledger();
  dl.createExecutionIntent(baseIntent);
  assert.equal(dl.markIntentPlanned('int_x').ok, true);
  assert.equal(dl.markIntentSigned('int_x').ok, true);
  assert.equal(dl.markIntentBroadcast('int_x', { signature: 'S' }).ok, true);
  assert.equal(dl.markIntentConfirmed('int_x').ok, true);
  assert.equal(dl.markIntentFilled('int_x').ok, true);
  assert.equal(dl.getIntent('int_x').status, 'FILLED');
});

test('canonical: illegal transition and unknown intent are rejected (fail-closed)', () => {
  const dl = ledger();
  dl.createExecutionIntent(baseIntent);
  dl.markIntentPlanned('int_x'); dl.markIntentSigned('int_x');
  dl.markIntentBroadcast('int_x'); dl.markIntentConfirmed('int_x');
  const bad = dl.markIntentPlanned('int_x'); // CONFIRMED -> PLANNED illegal
  assert.equal(bad.ok, false);
  assert.match(bad.error, /illegal_transition:CONFIRMED->PLANNED/);
  assert.equal(dl.markIntentSigned('ghost').error, 'unknown_intent');
});

test('canonical: markIntentFailed routes pre_send vs post-send', () => {
  const dl = ledger();
  dl.createExecutionIntent(baseIntent);
  assert.equal(dl.markIntentFailed('int_x', { pre_send: true, error: 'e' }).intent.status, 'FAILED_PRE_SEND');
  const dl2 = ledger();
  dl2.createExecutionIntent(baseIntent);
  dl2.markIntentPlanned('int_x'); dl2.markIntentSigned('int_x');
  assert.equal(dl2.markIntentFailed('int_x').intent.status, 'FAILED');
});

test('validateIntentTransition: unknown statuses and illegal edges rejected, legal allowed', () => {
  assert.equal(validateIntentTransition('NOPE', 'SIGNED').ok, false);
  assert.equal(validateIntentTransition('SIGNED', 'NOPE').ok, false);
  assert.equal(validateIntentTransition('SIGNED', 'CONFIRMED').ok, false); // must pass through BROADCAST
  assert.equal(validateIntentTransition('SIGNED', 'BROADCAST').ok, true);
  assert.equal(validateIntentTransition('FILLED', 'FAILED').ok, false); // terminal
});

test('appendDecisionTrace: validates known entity kinds, stores trace, free notes allowed', () => {
  const dl = ledger();
  dl.createExecutionIntent(baseIntent);
  const good = dl.appendDecisionTrace('int_x', { kind: 'Decision', data: { decision_id: 'd1', signal_id: 's1', token_mint: 'm', outcome: 'accept', is_executable: true, created_at: fixedNow() } });
  assert.equal(good.ok, true, JSON.stringify(good));
  const bad = dl.appendDecisionTrace('int_x', { kind: 'Decision', data: { decision_id: 'd2' } });
  assert.equal(bad.error, 'invalid_Decision');
  dl.appendDecisionTrace('int_x', { kind: 'note', message: 'hello' });
  assert.equal(dl.getTrace('int_x').length, 2);
});

// ---------- storage adapter + corrupt fail-closed ----------
test('json store: persists via injected io and round-trips', () => {
  const io = fakeIo();
  const dl = createDecisionLedger({ store: createJsonIntentStore({ file: 'intent-ledger.json', readJson: io.readJson, writeJson: io.writeJson }), now: fixedNow });
  dl.claimIntent('int_p', { side: 'sell' });
  assert.equal(io.peek().intents.int_p.status, 'PENDING');
  assert.equal(dl.getIntent('int_p').detail.side, 'sell');
});

test('corrupt ledger: canonical API fails closed; legacy claim preserves prior behaviour', () => {
  const io = fakeIo({ corrupt: true });
  const store = createJsonIntentStore({ file: 'intent-ledger.json', readJson: io.readJson, writeJson: io.writeJson });
  const dl = createDecisionLedger({ store, now: fixedNow });
  assert.equal(dl.createExecutionIntent(baseIntent).error, 'ledger_corrupt');
  assert.equal(dl.markIntentSigned('int_x').error, 'ledger_corrupt');
  assert.equal(dl.appendDecisionTrace('int_x', { kind: 'note' }).error, 'ledger_corrupt');
  assert.equal(dl.claimIntent('int_legacy', {}).ok, true); // legacy primitive unchanged (parity)
});

test('createDecisionLedger requires a valid store', () => {
  assert.throws(() => createDecisionLedger({}), /decision_ledger_requires_store/);
});
