// token-metadata.test.mjs — display-only mint resolver (mocked fetch, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokenMetadata } from '../src/engine/token-metadata.mjs';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

function mockFetch(rowsByMint, counter = {}) {
  counter.calls = 0;
  return async (url) => {
    counter.calls += 1;
    const query = decodeURIComponent(String(url).split('query=')[1] || '');
    const mints = query.split(',');
    const arr = mints.filter((m) => rowsByMint[m]).map((m) => ({ id: m, ...rowsByMint[m] }));
    return { ok: true, json: async () => arr };
  };
}

test('token-metadata: resolves symbol/name/icon from the upstream search', async () => {
  const md = createTokenMetadata({ fetchImpl: mockFetch({ [USDC]: { symbol: 'USDC', name: 'USD Coin', icon: 'u.png' } }) });
  const out = await md.resolve([USDC]);
  assert.deepEqual(out[USDC], { symbol: 'USDC', name: 'USD Coin', icon: 'u.png' });
});

test('token-metadata: caches positives — a second resolve does not refetch', async () => {
  const counter = {};
  const md = createTokenMetadata({ fetchImpl: mockFetch({ [BONK]: { symbol: 'Bonk', name: 'Bonk', icon: 'b.png' } }, counter) });
  await md.resolve([BONK]);
  await md.resolve([BONK]);
  assert.equal(counter.calls, 1, 'cached on the second call');
});

test('token-metadata: dedupes within a single call', async () => {
  const counter = {};
  const md = createTokenMetadata({ fetchImpl: mockFetch({ [USDC]: { symbol: 'USDC', name: 'USD Coin' } }, counter) });
  await md.resolve([USDC, USDC, USDC]);
  assert.equal(counter.calls, 1);
});

test('token-metadata: filters out invalid mints (no upstream call for junk)', async () => {
  const counter = {};
  const md = createTokenMetadata({ fetchImpl: mockFetch({}, counter) });
  const out = await md.resolve(['not-a-mint', '', null, 123]);
  assert.deepEqual(out, {});
  assert.equal(counter.calls, 0, 'no call when nothing is a valid mint');
});

test('token-metadata: unknown mint -> negative cached, omitted from result', async () => {
  const counter = {};
  const md = createTokenMetadata({ fetchImpl: mockFetch({}, counter) }); // upstream returns nothing
  const out = await md.resolve([BONK]);
  assert.equal(out[BONK], undefined);
  await md.resolve([BONK]); // within neg-TTL: should not refetch
  assert.equal(counter.calls, 1);
});

test('token-metadata: a fetch failure degrades to {} (never throws)', async () => {
  const md = createTokenMetadata({ fetchImpl: async () => { throw new Error('network down'); } });
  const out = await md.resolve([USDC]);
  assert.deepEqual(out, {});
});

test('token-metadata: negative cache expires, then a later listing resolves', async () => {
  let clock = 1_000_000;
  const rows = {};
  const counter = { calls: 0 };
  const fetchImpl = async (url) => {
    counter.calls += 1;
    const q = decodeURIComponent(String(url).split('query=')[1] || '');
    const arr = q.split(',').filter((m) => rows[m]).map((m) => ({ id: m, ...rows[m] }));
    return { ok: true, json: async () => arr };
  };
  const md = createTokenMetadata({ fetchImpl, now: () => clock });
  assert.equal((await md.resolve([BONK]))[BONK], undefined); // miss -> neg cache
  clock += 6 * 60 * 1000; // advance past the 5m negative TTL
  rows[BONK] = { symbol: 'Bonk', name: 'Bonk' }; // now it lists
  assert.equal((await md.resolve([BONK]))[BONK].symbol, 'Bonk');
  assert.equal(counter.calls, 2);
});
