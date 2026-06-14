// market-filters.test.mjs — optional FDV entry filter (mocked rpc, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMarketFilters } from '../src/engine/market-filters.mjs';

const rpcSupply = (uiAmount) => ({ rpc: async (m) => (m === 'getTokenSupply' ? { ok: true, result: { value: { uiAmount } } } : { ok: false }) });

test('market-filters: off when no FDV bounds configured (no RPC call)', async () => {
  let called = false;
  const rpc = { rpc: async () => { called = true; return { ok: true }; } };
  const r = await checkMarketFilters({ mint: 'M', rpc, cfg: { market_filters: {} }, priceUsdPerToken: 1 });
  assert.deepEqual(r, { ok: true, reasons: [], skipped: [] });
  assert.equal(called, false);
});

test('market-filters: rejects FDV below the minimum', async () => {
  // supply 1,000,000 × $0.01 = $10,000 FDV; min 50,000 -> reject
  const r = await checkMarketFilters({ mint: 'M', rpc: rpcSupply(1_000_000), cfg: { market_filters: { min_fdv_usd: 50_000 } }, priceUsdPerToken: 0.01 });
  assert.equal(r.ok, false);
  assert.match(r.reasons[0], /below_min_50000/);
});

test('market-filters: rejects FDV above the maximum', async () => {
  // supply 1,000,000 × $1 = $1,000,000 FDV; max 500,000 -> reject
  const r = await checkMarketFilters({ mint: 'M', rpc: rpcSupply(1_000_000), cfg: { market_filters: { max_fdv_usd: 500_000 } }, priceUsdPerToken: 1 });
  assert.equal(r.ok, false);
  assert.match(r.reasons[0], /above_max_500000/);
});

test('market-filters: passes when FDV within [min,max]', async () => {
  const r = await checkMarketFilters({ mint: 'M', rpc: rpcSupply(1_000_000), cfg: { market_filters: { min_fdv_usd: 5_000, max_fdv_usd: 5_000_000 } }, priceUsdPerToken: 0.1 });
  assert.deepEqual(r, { ok: true, reasons: [], skipped: [] }); // FDV = 100,000
});

test('market-filters: SKIPS (allows) when supply/price unavailable — quality filter, not fail-closed', async () => {
  const r1 = await checkMarketFilters({ mint: 'M', rpc: { rpc: async () => ({ ok: false }) }, cfg: { market_filters: { min_fdv_usd: 1000 } }, priceUsdPerToken: 1 });
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.skipped, ['fdv_data_unavailable']);
  const r2 = await checkMarketFilters({ mint: 'M', rpc: rpcSupply(1_000_000), cfg: { market_filters: { min_fdv_usd: 1000 } }, priceUsdPerToken: null });
  assert.equal(r2.ok, true);
  assert.deepEqual(r2.skipped, ['fdv_data_unavailable']);
});
