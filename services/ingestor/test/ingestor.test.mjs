// ingestor.test.mjs — gRPC ingestor: pure mapping + lifecycle wiring (no network, no real dep).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { parseYellowstoneUpdate } from '../src/parse.mjs';
import { createGrpcIngestor } from '../src/grpc-ingestor.mjs';
import { b58encode } from '../src/base58.mjs';

test('parse: maps a Yellowstone tx update to the engine swap-detector shape', () => {
  const owner = b58encode(Buffer.alloc(32, 7));
  const update = {
    transaction: {
      signature: Buffer.alloc(64, 1),
      transaction: {
        transaction: { message: { accountKeys: [Buffer.alloc(32, 7), Buffer.alloc(32, 9)] } },
        meta: {
          err: null,
          preBalances: [1000, 0], postBalances: [900, 0],
          preTokenBalances: [{ owner, mint: 'MINT', uiTokenAmount: { uiAmount: 0, decimals: 6, amount: '0' } }],
          postTokenBalances: [{ owner, mint: 'MINT', uiTokenAmount: { uiAmount: 5, decimals: 6, amount: '5000000' } }],
        },
      },
    },
  };
  const r = parseYellowstoneUpdate(update);
  assert.ok(r && r.signature, 'signature base58-decoded');
  assert.equal(r.tx.transaction.message.accountKeys[0], owner, 'pubkey bytes base58-encoded');
  assert.equal(r.tx.meta.postTokenBalances[0].uiTokenAmount.uiAmount, 5);
  assert.deepEqual(r.tx.meta.preBalances, [1000, 0]);
});

test('parse: drops failed tx and malformed update', () => {
  assert.equal(parseYellowstoneUpdate(null), null);
  assert.equal(parseYellowstoneUpdate({ transaction: { transaction: { meta: { err: { InstructionError: [] } } } } }), null);
  assert.equal(parseYellowstoneUpdate({ transaction: { transaction: { meta: { err: null } } } }), null, 'no signature -> null');
});

test('parse: uiAmountString fallback when uiAmount absent', () => {
  const update = {
    transaction: {
      signature: Buffer.alloc(64, 2),
      transaction: {
        transaction: { message: { accountKeys: [] } },
        meta: { err: null, postTokenBalances: [{ owner: 'O', mint: 'M', uiTokenAmount: { uiAmountString: '12.5', decimals: 6 } }] },
      },
    },
  };
  const r = parseYellowstoneUpdate(update);
  assert.equal(r.tx.meta.postTokenBalances[0].uiTokenAmount.uiAmount, 12.5);
});

test('ingestor: wires a mock gRPC stream -> onUp + onLeaderActivity; close() stops it', async () => {
  const stream = new EventEmitter();
  stream.write = (_req, cb) => { if (cb) cb(); return true; };
  stream.end = () => {};
  let up = 0;
  const events = [];
  const ing = createGrpcIngestor({
    endpoint: 'mock:0',
    addresses: ['L'],
    clientFactory: () => ({ subscribe: async () => stream }),
    onUp: () => { up += 1; },
    onLeaderActivity: (e) => events.push(e),
    onGap: () => {},
  });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(up, 1, 'onUp fired after a successful subscribe');

  const owner = b58encode(Buffer.alloc(32, 3));
  stream.emit('data', {
    transaction: {
      signature: Buffer.alloc(64, 2),
      transaction: {
        transaction: { message: { accountKeys: [Buffer.alloc(32, 3)] } },
        meta: { err: null, preBalances: [10], postBalances: [9], preTokenBalances: [],
          postTokenBalances: [{ owner, mint: 'M', uiTokenAmount: { uiAmount: 1, decimals: 6 } }] },
      },
    },
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(events.length, 1, 'leader activity delivered through the stream');
  assert.ok(events[0].signature);
  stream.emit('data', { pong: true });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(events.length, 1, 'keepalive pong is ignored');
  ing.close();
});
