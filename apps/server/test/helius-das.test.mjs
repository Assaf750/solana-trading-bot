// helius-das.test.mjs — Helius DAS getAsset metadata wrapper (mocked rpc, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDas } from '../src/engine/helius-das.mjs';

test('das: maps getAsset content -> {symbol,name,icon}', async () => {
  const rpc = { rpc: async (m, p) => {
    assert.equal(m, 'getAsset');
    assert.deepEqual(p, { id: 'MINT' }); // DAS params are an object
    return { ok: true, result: { content: { metadata: { name: 'Pepe', symbol: 'PEPE' }, links: { image: 'p.png' } } } };
  } };
  assert.deepEqual(await createDas({ rpc }).getAssetMeta('MINT'), { symbol: 'PEPE', name: 'Pepe', icon: 'p.png' });
});

test('das: returns null on non-Helius / error / empty metadata', async () => {
  assert.equal(await createDas({ rpc: { rpc: async () => ({ ok: false, error: 'rpc_-32601' }) } }).getAssetMeta('M'), null);
  assert.equal(await createDas({ rpc: { rpc: async () => ({ ok: true, result: { content: { metadata: {} } } }) } }).getAssetMeta('M'), null);
  assert.equal(await createDas({ rpc: null }).getAssetMeta('M'), null);
});
