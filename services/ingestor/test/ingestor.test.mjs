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

test('base58: all-zero input encodes without an extra leading 1 (System Program = 32 ones)', () => {
  assert.equal(b58encode(Buffer.alloc(32, 0)), '1'.repeat(32));
  assert.equal(b58encode(Buffer.from([0])), '1');
  assert.equal(b58encode(Buffer.from([0, 0])), '11');
});

test('ingestor: a single teardown (error+end+close) schedules exactly ONE reconnect', async () => {
  let subscribes = 0;
  const makeStream = () => {
    const s = new EventEmitter();
    s.write = (_r, cb) => { if (cb) cb(); return true; };
    s.end = () => {};
    return s;
  };
  let current;
  const ing = createGrpcIngestor({
    endpoint: 'mock:0', addresses: ['L'], initialBackoffMs: 5,
    clientFactory: () => ({ subscribe: async () => { subscribes += 1; current = makeStream(); return current; } }),
    onUp: () => {}, onLeaderActivity: () => {}, onGap: () => {},
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(subscribes, 1, 'initial subscribe');
  // one teardown fires all three events — must NOT schedule three parallel reconnects
  current.emit('error'); current.emit('end'); current.emit('close');
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(subscribes, 2, 'exactly one reconnect, not 2-3 duplicate streams');
  ing.close();
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
