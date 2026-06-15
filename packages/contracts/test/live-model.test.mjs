import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_MODEL_ENTITIES, ENTITY_SPECS, DATA_OWNERSHIP, LIVE_MODEL_ENUMS,
  TRADE_SIDE, INTENT_STATUS, validateEntity, isEntity, assertEntity,
} from '../src/live-model.mjs';

const KERNEL_PACKAGES = new Set([
  'contracts', 'config', 'storage', 'provider-adapters', 'ingestion', 'token-safety',
  'wallet-intelligence', 'risk', 'decision-ledger', 'positions', 'execution', 'safety',
  'trading-engine', 'audit',
]);
const STORES = new Set(['postgres', 'redis', 'clickhouse', 'json', 'ephemeral', 'vault']);

test('exactly the 21 ADR-0001 entities exist, with specs + ownership for each', () => {
  assert.equal(LIVE_MODEL_ENTITIES.length, 21);
  assert.equal(new Set(LIVE_MODEL_ENTITIES).size, 21, 'no duplicate entity names');
  for (const e of LIVE_MODEL_ENTITIES) {
    assert.ok(ENTITY_SPECS[e], `missing ENTITY_SPECS for ${e}`);
    assert.ok(DATA_OWNERSHIP[e], `missing DATA_OWNERSHIP for ${e}`);
  }
  assert.deepEqual(Object.keys(ENTITY_SPECS).sort(), [...LIVE_MODEL_ENTITIES].sort());
  assert.deepEqual(Object.keys(DATA_OWNERSHIP).sort(), [...LIVE_MODEL_ENTITIES].sort());
});

test('data-ownership uses only known kernel packages and storage backends; sot ∈ stores', () => {
  for (const e of LIVE_MODEL_ENTITIES) {
    const o = DATA_OWNERSHIP[e];
    assert.ok(KERNEL_PACKAGES.has(o.pkg), `${e}: unknown owning package ${o.pkg}`);
    assert.ok(STORES.has(o.sot), `${e}: unknown sot ${o.sot}`);
    for (const s of o.stores) assert.ok(STORES.has(s), `${e}: unknown store ${s}`);
    assert.ok(o.stores.includes(o.sot), `${e}: sot ${o.sot} must be one of its stores`);
  }
});

test('every enums + spec object is frozen (immutable contracts)', () => {
  assert.ok(Object.isFrozen(LIVE_MODEL_ENTITIES));
  assert.ok(Object.isFrozen(ENTITY_SPECS));
  assert.ok(Object.isFrozen(DATA_OWNERSHIP));
  for (const arr of Object.values(LIVE_MODEL_ENUMS)) assert.ok(Object.isFrozen(arr));
});

test('validateEntity: accepts a well-formed ExecutionIntent', () => {
  const intent = {
    intent_id: 'i1', idempotency_key: 'k1', intent_type: 'BUY_INTENT',
    token_mint: 'So111...', size_usd: 25, status: 'CREATED', created_at: '2026-06-15T00:00:00Z',
  };
  const r = validateEntity('ExecutionIntent', intent);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(isEntity('ExecutionIntent', intent));
  assert.equal(assertEntity('ExecutionIntent', intent), intent);
});

test('validateEntity: flags missing required, bad enum, and wrong type', () => {
  const bad = { token_mint: 'm', side: 'sideways', in_amount: 'lots', out_amount: 1, route_valid: true };
  const r = validateEntity('RouteQuote', bad); // missing quoted_at, bad side enum, in_amount type
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes('enum:side'), r.errors.join(','));
  assert.ok(r.errors.includes('type:in_amount'), r.errors.join(','));
  assert.ok(r.errors.includes('missing:quoted_at'), r.errors.join(','));
});

test('validateEntity: rejects unknown entity and non-objects; assertEntity throws', () => {
  assert.equal(validateEntity('Nope', {}).ok, false);
  assert.equal(validateEntity('Position', null).ok, false);
  assert.equal(validateEntity('Position', []).ok, false);
  assert.throws(() => assertEntity('Fill', { fill_id: 'x' }), /invalid Fill/);
});

test('reused SSOT enums are enforced inside live entities (Position.state)', () => {
  assert.equal(isEntity('Position', { position_id: 'p', token_mint: 'm', state: 'OPEN' }), true);
  assert.equal(isEntity('Position', { position_id: 'p', token_mint: 'm', state: 'BOGUS' }), false);
  assert.ok(TRADE_SIDE.includes('buy') && INTENT_STATUS.includes('CONFIRMED'));
});

test('unified contracts entry re-exports SSOT + API + live-model with no star-collision', async () => {
  const idx = await import('../src/index.mjs');
  assert.ok(Array.isArray(idx.OPERATING_STATE), 'SSOT enum surfaced');
  assert.ok(Array.isArray(idx.COMMAND_TYPE), 'API vocabulary surfaced');
  assert.ok(Array.isArray(idx.LIVE_MODEL_ENTITIES), 'live-model surfaced');
  assert.equal(typeof idx.validateEntity, 'function');
});
