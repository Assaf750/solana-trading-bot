// holdings.test.mjs — execution-wallet SPL balance reader (mocked rpc, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchHoldings } from '../src/engine/holdings.mjs';

function acc(mint, uiAmount, decimals = 6) {
  return { account: { data: { parsed: { info: { mint, tokenAmount: { uiAmount, decimals, amount: String(uiAmount) } } } } } };
}

test('holdings: lists non-empty balances across Token + Token-2022, sorted desc', async () => {
  let call = 0;
  const rpc = { rpc: async (method) => {
    if (method !== 'getTokenAccountsByOwner') return { ok: false };
    call += 1;
    return call === 1
      ? { ok: true, result: { value: [acc('MintA', 5), acc('MintB', 100), acc('MintC', 0)] } } // token
      : { ok: true, result: { value: [acc('Mint2022', 42, 0)] } }; // token-2022
  } };
  const r = await fetchHoldings({ rpc, owner: 'OWNER' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.tokens.map((t) => t.mint), ['MintB', 'Mint2022', 'MintA']); // 100, 42, 5; MintC(0) dropped
  assert.equal(r.tokens.find((t) => t.mint === 'Mint2022').program, 'token-2022');
});

test('holdings: a failing Token-2022 program is skipped, not fatal', async () => {
  const rpc = { rpc: async (method) => {
    if (method !== 'getTokenAccountsByOwner') return { ok: false };
    // first program ok, second (token-2022) errors
    return rpc._n++ === 0 ? { ok: true, result: { value: [acc('MintA', 7)] } } : { ok: false, error: 'rpc_-32601' };
  }, _n: 0 };
  const r = await fetchHoldings({ rpc, owner: 'OWNER' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.tokens.map((t) => t.mint), ['MintA']);
});

test('holdings: guards missing rpc / owner', async () => {
  assert.equal((await fetchHoldings({ rpc: null, owner: 'O' })).ok, false);
  assert.equal((await fetchHoldings({ rpc: { rpc: async () => ({ ok: true, result: { value: [] } }) }, owner: '' })).error, 'no_owner');
});

test('holdings: empty wallet returns ok with no tokens', async () => {
  const rpc = { rpc: async () => ({ ok: true, result: { value: [] } }) };
  const r = await fetchHoldings({ rpc, owner: 'OWNER' });
  assert.deepEqual(r, { ok: true, tokens: [] });
});
