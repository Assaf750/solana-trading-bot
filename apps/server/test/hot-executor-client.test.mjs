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
        let resp;
        if (req.op === 'ping') resp = { ok: true, op: 'pong' };
        else if (req.op === 'sign_bundle') resp = { ok: true, intent_id: req.intent_id, signed_txs: req.unsigned_txs.map((t) => `SIGNED_${t}`) };
        else if (req.op === 'build_submit') resp = { ok: true, intent_id: req.intent_id, request: { jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: [req.signed_tx_base64, { encoding: 'base64', skipPreflight: req.skip_preflight, maxRetries: req.max_retries }] } };
        else if (req.op === 'build_bundle') resp = { ok: true, intent_id: req.intent_id, request: { jsonrpc: '2.0', id: 1, method: 'sendBundle', params: [req.signed_txs, { encoding: 'base64' }] } };
        else resp = { ok: true, intent_id: req.intent_id, signature: `SIG_${req.unsigned_tx_base64}`, signed_tx_base64: 'SIGNED', signer_address: 'ADDR' };
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

test('hot-executor-client: signBundle signs every leg in order (Phase Rust-3)', async () => {
  const client = createHotExecutorClient({ binPath: 'mock', spawnFn: mockSpawn });
  const r = await client.signBundle({ txsBase64: ['SWAP', 'TIP'], seed: Buffer.from([1, 2]) });
  assert.deepEqual(r, { ok: true, signed: ['SIGNED_SWAP', 'SIGNED_TIP'] });
  client.close();
});

test('hot-executor-client: buildSubmit returns the Rust-assembled sendTransaction body (Phase Rust-4)', async () => {
  const client = createHotExecutorClient({ binPath: 'mock', spawnFn: mockSpawn });
  const r = await client.buildSubmit({ signedTxBase64: 'TX', skipPreflight: false, maxRetries: 3 });
  assert.equal(r.ok, true);
  assert.equal(r.body.method, 'sendTransaction');
  assert.deepEqual(r.body.params, ['TX', { encoding: 'base64', skipPreflight: false, maxRetries: 3 }]);
  client.close();
});

test('hot-executor-client: buildBundle returns the Rust-assembled sendBundle body (Phase Rust-4)', async () => {
  const client = createHotExecutorClient({ binPath: 'mock', spawnFn: mockSpawn });
  const r = await client.buildBundle({ signedTxs: ['SWAP', 'TIP'] });
  assert.equal(r.ok, true);
  assert.equal(r.body.method, 'sendBundle');
  assert.deepEqual(r.body.params, [['SWAP', 'TIP'], { encoding: 'base64' }]);
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

test('hot-executor-client: a mismatched correlation id is refused (not handed back as a signature)', async () => {
  function badSpawn() {
    const stdout = new PassThrough();
    const handlers = {};
    return {
      stdout,
      stdin: {
        writable: true,
        // echo a WRONG intent_id to simulate a desynced/stray response line
        write() { stdout.write(`${JSON.stringify({ ok: true, intent_id: 'WRONG', signature: 'X', signed_tx_base64: 'Y', signer_address: 'Z' })}\n`); return true; },
        end() {},
      },
      on(ev, cb) { handlers[ev] = cb; return this; },
      kill() {},
    };
  }
  const client = createHotExecutorClient({ binPath: 'mock', spawnFn: badSpawn });
  const r = await client.sign({ txBase64: 'ABC', seed: Buffer.from([1]) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'response_mismatch');
  client.close();
});

test('hot-executor-client: a spawn failure resolves to an error (never throws)', async () => {
  const client = createHotExecutorClient({ binPath: 'mock', spawnFn: () => { throw new Error('ENOENT'); } });
  const r = await client.sign({ txBase64: 'ABC', seed: Buffer.from([1]) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'executor_spawn_failed');
});
