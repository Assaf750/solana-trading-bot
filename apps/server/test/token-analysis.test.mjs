// token-analysis.test.mjs — pure scoring + Token-2022 extension classification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyExtensions, computeTokenScores, EXTENSION_INFO } from '../src/engine/token-analysis.mjs';

test('classifyExtensions: maps known extensions + flags trading impact', () => {
  const c = classifyExtensions([{ extension: 'permanentDelegate' }, { extension: 'transferFeeConfig' }, 'uninitialized', { extension: 'weirdNew' }]);
  assert.equal(c.length, 3); // uninitialized dropped
  const pd = c.find((x) => x.key === 'permanentDelegate');
  assert.equal(pd.risk, 'high');
  assert.equal(pd.affects_trading, true);
  const unknown = c.find((x) => x.key === 'weirdNew');
  assert.equal(unknown.risk, 'info'); // unrecognized -> info, not crash
});

test('scores: a clean, sellable, deep-liquidity token is suitable', () => {
  const s = computeTokenScores({
    mintAuthorityActive: false, freezeAuthorityActive: false, metadataMutable: false,
    extensionKeys: [], sellable: true, slippagePct: 2, fdvUsd: 500000, priceUsd: 0.01,
    topHolderPct: 30, holderCount: 800, traderCount: 4, dataComplete: true,
  });
  assert.equal(s.final_verdict, 'suitable');
  assert.ok(s.copyability_score >= 60);
  assert.ok(s.risk_score < 40);
});

test('scores: live mint + freeze authority drive high risk', () => {
  const s = computeTokenScores({
    mintAuthorityActive: true, freezeAuthorityActive: true, extensionKeys: [],
    sellable: true, slippagePct: 5, fdvUsd: 100000, priceUsd: 0.01, topHolderPct: 20, dataComplete: true,
  });
  assert.ok(s.risk_score >= 55);
  assert.ok(s.reasons.some((r) => r.code === 'mint_authority_active'));
  assert.ok(s.reasons.some((r) => r.code === 'freeze_authority_active'));
});

test('scores: no sell route => honeypot => high_risk regardless', () => {
  const s = computeTokenScores({
    mintAuthorityActive: false, freezeAuthorityActive: false, extensionKeys: [],
    sellable: false, slippagePct: null, fdvUsd: 100000, priceUsd: 0.01, dataComplete: true,
  });
  assert.equal(s.final_verdict, 'high_risk');
  assert.ok(s.reasons.some((r) => r.code === 'no_sell_route'));
});

test('scores: nonTransferable extension is severe', () => {
  const s = computeTokenScores({ extensionKeys: ['nonTransferable'], sellable: true, slippagePct: 1, dataComplete: true, priceUsd: 0.01 });
  assert.ok(s.risk_score >= 40);
  assert.ok(s.reasons.some((r) => r.code === 'ext_nonTransferable'));
});

test('scores: incomplete data => unanalyzable', () => {
  const s = computeTokenScores({ dataComplete: false });
  assert.equal(s.final_verdict, 'unanalyzable');
});

test('scores are clamped 0..100', () => {
  const s = computeTokenScores({
    mintAuthorityActive: true, freezeAuthorityActive: true,
    extensionKeys: ['permanentDelegate', 'nonTransferable', 'transferHook', 'defaultAccountState'],
    sellable: false, slippagePct: 90, topHolderPct: 95, priceUsd: null, dataComplete: true,
  });
  assert.ok(s.risk_score <= 100 && s.risk_score >= 0);
  assert.equal(s.final_verdict, 'high_risk');
});
