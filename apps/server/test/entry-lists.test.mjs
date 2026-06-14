// entry-lists.test.mjs — token allow/deny lists in the pure entry gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEntryGates } from '../src/engine/risk-gates.mjs';

const MINT_A = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT_B = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

// minimal portfolio stub (only reached if no early rejection fires)
const pf = { openCount: () => 0, tokenExposureUsd: () => 0, leaderExposureUsd: () => 0, dailyRealized: () => 0, summary: () => ({ realized_pnl_usd: 0, unrealized_pnl_usd: 0 }) };
const base = { portfolio: pf, sizeUsd: 10, killBlocked: false, operatingState: 'ACTIVE' };

test('lists: a blacklisted mint is rejected (policy block, not a risk rejection)', () => {
  const r = checkEntryGates({ ...base, cfg: { lists: { token_blacklist: [MINT_A] } }, tokenMint: MINT_A });
  assert.ok(r.rejections.includes('token_blacklisted'));
  assert.equal(r.riskRejection, false);
  assert.equal(r.allowed, false);
});

test('lists: whitelist non-empty rejects a mint not on it', () => {
  const r = checkEntryGates({ ...base, cfg: { lists: { token_whitelist: [MINT_A] } }, tokenMint: MINT_B });
  assert.ok(r.rejections.includes('token_not_whitelisted'));
});

test('lists: a whitelisted mint passes the list check (no list rejection)', () => {
  const r = checkEntryGates({ ...base, cfg: { lists: { token_whitelist: [MINT_A] } }, tokenMint: MINT_A });
  assert.ok(!r.rejections.includes('token_not_whitelisted'));
  assert.ok(!r.rejections.includes('token_blacklisted'));
});

test('lists: no lists configured => no list rejections', () => {
  const r = checkEntryGates({ ...base, cfg: {}, tokenMint: MINT_A });
  assert.ok(!r.rejections.includes('token_blacklisted'));
  assert.ok(!r.rejections.includes('token_not_whitelisted'));
});
