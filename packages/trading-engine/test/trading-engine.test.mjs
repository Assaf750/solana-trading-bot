// @soltrade/trading-engine tests (ADR-0001 Phase Engine-2). Pure: the lifecycle state machine
// (deriveDesiredState) and the composition entry (composeTradingEngine over an injected substrate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveDesiredState, composeTradingEngine, ENGINE_STATES } from '../src/index.mjs';

const base = { killBlocked: false, vaultUnlocked: true, rpcConfigured: true, followedCount: 1, operatingState: 'ACTIVE' };

test('deriveDesiredState: returns active when everything is ready', () => {
  assert.equal(deriveDesiredState(base), 'active');
});

test('deriveDesiredState: precedence kill > vault > rpc > wallets > operator-pause', () => {
  assert.equal(deriveDesiredState({ ...base, killBlocked: true }), 'stopped_killed');
  // kill beats every other not-ready condition
  assert.equal(deriveDesiredState({ killBlocked: true, vaultUnlocked: false, rpcConfigured: false, followedCount: 0, operatingState: 'KILLED' }), 'stopped_killed');
  assert.equal(deriveDesiredState({ ...base, vaultUnlocked: false }), 'waiting_vault_unlock');
  assert.equal(deriveDesiredState({ ...base, rpcConfigured: false }), 'waiting_rpc_config');
  assert.equal(deriveDesiredState({ ...base, followedCount: 0 }), 'no_followed_wallets');
  assert.equal(deriveDesiredState({ ...base, operatingState: 'PAUSED' }), 'paused_by_operator');
  assert.equal(deriveDesiredState({ ...base, operatingState: 'KILLED' }), 'paused_by_operator');
});

test('deriveDesiredState: followedCount coerces + guards (0 / undefined / "1")', () => {
  assert.equal(deriveDesiredState({ ...base, followedCount: 0 }), 'no_followed_wallets');
  assert.equal(deriveDesiredState({ ...base, followedCount: undefined }), 'no_followed_wallets');
  assert.equal(deriveDesiredState({ ...base, followedCount: 2 }), 'active');
});

test('ENGINE_STATES is frozen + carries the lifecycle values', () => {
  assert.equal(ENGINE_STATES.ACTIVE, 'active');
  assert.equal(ENGINE_STATES.EXITS_ONLY_STREAM_GAP, 'exits_only_stream_gap');
  assert.ok(Object.isFrozen(ENGINE_STATES));
});

test('composeTradingEngine: builds the engine from the injected substrate factory (passes deps through)', () => {
  const deps = { config: {}, marker: 42 };
  const engine = { start() {}, status() { return { paper_engine: 'stopped' }; } };
  let seen = null;
  const built = composeTradingEngine({ substrateFactory: (d) => { seen = d; return engine; }, deps });
  assert.equal(built, engine, 'returns the substrate-built engine unchanged (zero behavior change)');
  assert.equal(seen, deps, 'passes the deps straight to the substrate');
});

test('composeTradingEngine: throws when no substrate factory is injected (pure — never builds its own)', () => {
  assert.throws(() => composeTradingEngine({ deps: {} }), /trading_engine_requires_substrate/);
  assert.throws(() => composeTradingEngine({}), /trading_engine_requires_substrate/);
});
