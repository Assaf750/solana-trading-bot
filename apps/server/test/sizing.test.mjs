// sizing.test.mjs — pure position-size helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proportionalLeaderUsd } from '../src/engine/sizing.mjs';

test('proportional: copies valuePct% of the leader buy', () => {
  assert.equal(proportionalLeaderUsd({ leaderUsd: 1000, valuePct: 10 }), 100);
  assert.equal(proportionalLeaderUsd({ leaderUsd: 500, valuePct: 25 }), 125);
});

test('proportional: clamps to the position-size cap when configured', () => {
  // 50% of a $4000 whale buy = $2000, but cap = $1000 * 10% = $100 -> clamped to 100
  assert.equal(proportionalLeaderUsd({ leaderUsd: 4000, valuePct: 50, capUsd: 1000, maxPosPct: 10 }), 100);
  // under the cap -> unchanged
  assert.equal(proportionalLeaderUsd({ leaderUsd: 200, valuePct: 50, capUsd: 1000, maxPosPct: 10 }), 100);
});

test('proportional: returns null when it cannot size safely', () => {
  assert.equal(proportionalLeaderUsd({ leaderUsd: 0, valuePct: 10 }), null);
  assert.equal(proportionalLeaderUsd({ leaderUsd: NaN, valuePct: 10 }), null);
  assert.equal(proportionalLeaderUsd({ leaderUsd: 1000, valuePct: 0 }), null);
  assert.equal(proportionalLeaderUsd({ leaderUsd: 1000, valuePct: null }), null);
});
