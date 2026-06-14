// exit-rules.test.mjs — pure exit-decision helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trailingStopHit } from '../src/engine/exit-rules.mjs';

test('trailing: off when trailingPct is unset / null / <= 0', () => {
  assert.equal(trailingStopHit({ pnlPct: -50, peakPct: 80, trailingPct: null }), false);
  assert.equal(trailingStopHit({ pnlPct: -50, peakPct: 80, trailingPct: 0 }), false);
});

test('trailing: not armed until peak reaches the trail distance', () => {
  // peaked at +10% but trail is 20% -> never armed, even a full round-trip to 0 does not trail-exit
  assert.equal(trailingStopHit({ pnlPct: 0, peakPct: 10, trailingPct: 20 }), false);
});

test('trailing: armed and giving back >= trail distance exits', () => {
  // peak +30% (armed, since 30 >= 20). Back to +0% => give-back = (1 - 1.0/1.3) ≈ 23% >= 20 -> exit.
  assert.equal(trailingStopHit({ pnlPct: 0, peakPct: 30, trailingPct: 20 }), true);
  // still only ~10% off the peak (+17% from +30%) -> hold
  assert.equal(trailingStopHit({ pnlPct: 17, peakPct: 30, trailingPct: 20 }), false);
});

test('trailing: holds at the peak (no give-back)', () => {
  assert.equal(trailingStopHit({ pnlPct: 50, peakPct: 50, trailingPct: 20 }), false);
});

test('trailing: non-finite inputs are safe (no exit)', () => {
  assert.equal(trailingStopHit({ pnlPct: NaN, peakPct: 50, trailingPct: 20 }), false);
  assert.equal(trailingStopHit({ pnlPct: 10, peakPct: NaN, trailingPct: 20 }), false);
});
