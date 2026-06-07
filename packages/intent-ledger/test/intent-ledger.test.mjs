import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createIntentLedger, assertOrderHasIntent, isTerminalBundleStatus } from '../src/intent-ledger.mjs';
import { INTENT_TYPE } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sample = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'sample-intent.json'), 'utf8'));

test('no intent without intent_id (and no order object without intent reference)', () => {
  const led = createIntentLedger();
  const r = led.create({ intent_type: 'BUY_INTENT', idempotency_key: 'k1' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'intent_id_required');
  assert.throws(() => assertOrderHasIntent({}), /intent reference/);
  assert.equal(assertOrderHasIntent({ intent_id: 'x' }), 'x');
});

test('valid intent is created; intent_type validated against SSOT G3', () => {
  const led = createIntentLedger();
  const r = led.create(sample());
  assert.equal(r.ok, true);
  assert.equal(r.intent_id, 'intent-dev-0001');
  assert.equal(led.size, 1);
  assert.ok(INTENT_TYPE.includes(led.get('intent-dev-0001').intent_type));
  assert.equal(led.create({ ...sample(), intent_id: 'x', idempotency_key: 'y', intent_type: 'BOGUS' }).reason, 'invalid_intent_type');
});

test('idempotency conflict is rejected with IDEMPOTENCY_CONFLICT', () => {
  const led = createIntentLedger();
  assert.equal(led.create(sample()).ok, true);
  const dup = led.create({ ...sample(), intent_id: 'intent-dev-0002' }); // same idempotency_key
  assert.equal(dup.ok, false);
  assert.equal(dup.api_error_code, 'IDEMPOTENCY_CONFLICT');
  assert.ok(API_ERROR_CODE.includes(dup.api_error_code));
  assert.equal(dup.existing_intent_id, 'intent-dev-0001');
  // duplicate intent_id is also a conflict
  const dup2 = led.create({ ...sample(), idempotency_key: 'other' });
  assert.equal(dup2.api_error_code, 'IDEMPOTENCY_CONFLICT');
});

test('terminal intent is retained and there is no delete API', () => {
  const led = createIntentLedger();
  led.create(sample());
  led.updateStatus('intent-dev-0001', { bundle_status: 'Landed' });
  assert.equal(led.isTerminal('intent-dev-0001'), true);
  for (const m of ['delete', 'remove', 'clear', 'drop']) assert.equal(led[m], undefined, `must NOT expose ${m}`);
  assert.equal(led.list().length, 1, 'terminal intent must be retained');
  assert.equal(isTerminalBundleStatus('Pending'), false);
  assert.equal(isTerminalBundleStatus('Invalid'), true);
});

test('retry requires explicit replacement (new intent_id + new idempotency_key)', () => {
  const led = createIntentLedger();
  led.create(sample());
  // reusing same idempotency_key => conflict (no silent retry)
  assert.equal(led.create(sample()).api_error_code, 'IDEMPOTENCY_CONFLICT');
  // replacement must use a new intent_id and new idempotency_key
  assert.equal(led.createReplacement('intent-dev-0001', { ...sample() }).reason, 'replacement_requires_new_intent_id');
  assert.equal(led.createReplacement('intent-dev-0001', { ...sample(), intent_id: 'intent-dev-0002' }).reason, 'replacement_requires_new_idempotency_key');
  const ok = led.createReplacement('intent-dev-0001', { intent_id: 'intent-dev-0002', intent_type: 'BUY_INTENT', idempotency_key: 'idem-dev-0002' });
  assert.equal(ok.ok, true);
  assert.equal(led.get('intent-dev-0002').replaces_intent_id, 'intent-dev-0001');
});

test('audit interface is mock/in-memory only (no DB write)', () => {
  const led = createIntentLedger();
  led.create(sample());
  const entries = led.auditEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].resource_type, 'intent');
  // injectable custom sink works (interface-only)
  const captured = [];
  const led2 = createIntentLedger({ audit: { append: (e) => captured.push(e), list: () => captured.slice() } });
  led2.create({ ...sample(), intent_id: 'i9', idempotency_key: 'k9' });
  assert.equal(captured.length, 1);
});

test('no DB writes / execution / signing / network in source', () => {
  const DBX = /(INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|\bpg\b|clickhouse|node:fs|writeFileSync|signTransaction|sendTransaction|\bfetch\b|axios|undici|https?:\/\/|@solana\/)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(DBX.test(code), false, `db/exec/network usage in ${fn}`);
  }
});

test('no forbidden names and no secrets in source/fixtures', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  for (const fn of [...readdirSync(SRC).map((f) => join(SRC, f)), join(HERE, '..', 'fixtures', 'sample-intent.json')]) {
    if (!/\.(mjs|json)$/.test(fn)) continue;
    const code = readFileSync(fn, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
