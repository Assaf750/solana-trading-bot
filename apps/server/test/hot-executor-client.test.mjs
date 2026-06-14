// hot-executor-client.test.mjs — Node<->Rust JSON-lines client (mock spawn, no real binary).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createHotExecutorClient } from '../src/engine/hot-executor-client.mjs';

function mockSpawn() {
  const stdout = new PassThrough();
  const handlers = {};
  const child = {
    stdout,
    stdin: {
      writable: true,
      write(line) {
        const req = JSON.parse(line);
        const resp = req.op === 'ping'
          ? { ok: true, op: 'pong' }
          : { ok: true, signature: `SIG_${req.unsigned_tx_base64}`, signed_tx_base64: 'SIGNED', signer_address: 'ADDR' };
        stdout.write(`${JSON.stringify(resp)}\n`);
        return true;
      },
      end() {},
    },
    on(ev, cb) { handlers[ev] = cb; return this; },
    kill() {},
  };
  return child;
}

test('hot-executor-client: sign maps the Rust response to the tx-signer shape', async () => {
  const client = createHotExecutorClient({ binPath: 'mock', spawnFn: mockSpawn });
  const r = await client.sign({ txBase64: 'ABC', seed: Buffer.from([1, 2, 3]) });
  assert.deepEqual(r, { ok: true, signedTxBase64: 'SIGNED', signatureB58: 'SIG_ABC', signerAddress: 'ADDR' });
  const p = await client.ping();
  assert.equal(p.op, 'pong');
  client.close();
});

test('hot-executor-client: concurrent requests correlate FIFO', async () => {
  const client = createHotExecutorClient({ binPath: 'mock', spawnFn: mockSpawn });
  const [a, b, c] = await Promise.all([
    client.sign({ txBase64: 'A', seed: Buffer.from([1]) }),
    client.sign({ txBase64: 'B', seed: Buffer.from([2]) }),
    client.sign({ txBase64: 'C', seed: Buffer.from([3]) }),
  ]);
  assert.equal(a.signatureB58, 'SIG_A');
  assert.equal(b.signatureB58, 'SIG_B');
  assert.equal(c.signatureB58, 'SIG_C');
  client.close();
});

test('hot-executor-client: a spawn failure resolves to an error (never throws)', async () => {
  const client = createHotExecutorClient({ binPath: 'mock', spawnFn: () => { throw new Error('ENOENT'); } });
  const r = await client.sign({ txBase64: 'ABC', seed: Buffer.from([1]) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'executor_spawn_failed');
});
