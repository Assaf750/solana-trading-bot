// @soltrade/trading-engine tests (ADR-0001 Phase Engine-2 / Engine-3). Pure: the lifecycle state machine
// (deriveDesiredState), the composition entry (composeTradingEngine), and the leader-insights logic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveDesiredState, composeTradingEngine, ENGINE_STATES,
  recommendLeader, scoreLeader, finalizeLeaderInsights,
} from '../src/index.mjs';

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

// ---------- leader insights (Phase Engine-3) ----------
test('recommendLeader: enough-sample branch keys off the EV-gate verdict', () => {
  assert.equal(recommendLeader({ stats: { trades: 10, total_realized: 5 }, minSample: 5, evGateRejected: false }), 'follow');
  assert.equal(recommendLeader({ stats: { trades: 10, total_realized: 5 }, minSample: 5, evGateRejected: true }), 'drop');
});

test('recommendLeader: below-sample uses net realized; no trades => watch', () => {
  assert.equal(recommendLeader({ stats: { trades: 2, total_realized: 3 }, minSample: 5 }), 'follow');
  assert.equal(recommendLeader({ stats: { trades: 2, total_realized: -1 }, minSample: 5 }), 'watch');
  assert.equal(recommendLeader({ stats: { trades: 0, total_realized: 0 }, minSample: 5 }), 'watch');
  // non-finite minSample => never the enough-sample branch (falls to the trades>0 rule)
  assert.equal(recommendLeader({ stats: { trades: 9, total_realized: 4 }, minSample: NaN, evGateRejected: true }), 'follow');
});

test('scoreLeader: realized PnL weighted by win rate', () => {
  assert.equal(scoreLeader({ total_realized: 100, win_rate: 1 }), 100);   // 100 * (0.5 + 0.5)
  assert.equal(scoreLeader({ total_realized: 100, win_rate: 0 }), 50);    // 100 * 0.5
  assert.equal(scoreLeader({ total_realized: -20, win_rate: 0.5 }), -15); // -20 * 0.75
});

test('finalizeLeaderInsights: ranks by score (best first) + groups addresses by recommendation', () => {
  const leaders = [
    { leader: 'A', score: 10, recommendation: 'follow' },
    { leader: 'B', score: 50, recommendation: 'drop' },
    { leader: 'C', score: 30, recommendation: 'follow' },
    { leader: 'D', score: 5, recommendation: 'watch' },
  ];
  const out = finalizeLeaderInsights({ mode: 'paper', leaders });
  assert.equal(out.mode, 'paper');
  assert.deepEqual(out.leaders.map((x) => x.leader), ['B', 'C', 'A', 'D']); // sorted by score desc
  assert.deepEqual(out.recommendation, { follow: ['C', 'A'], drop: ['B'], watch: ['D'] });
  assert.deepEqual(finalizeLeaderInsights({}), { mode: null, leaders: [], recommendation: { follow: [], drop: [], watch: [] } });
});
