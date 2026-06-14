// rpc-transport.test.mjs — subscribeWallets picks the gRPC transport when an endpoint is
// configured, and the WebSocket path otherwise. No network: the gRPC factory is injected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRpcClient } from '../src/engine/rpc-client.mjs';

test('subscribeWallets uses the gRPC ingestor when an endpoint is configured', () => {
  const calls = [];
  const rpc = createRpcClient({
    getRpcUrl: () => null,
    getGrpcEndpoint: () => ({ endpoint: 'grpc.example:443', token: 'tok' }),
    grpcIngestorFactory: (args) => { calls.push(args); return { close() { calls.push('closed'); } }; },
  });
  const cbs = { onLeaderActivity: () => {}, onUp: () => {}, onGap: () => {} };
  const sub = rpc.subscribeWallets({ addresses: ['L1', 'L2'], ...cbs });
  assert.equal(calls.length, 1, 'gRPC factory invoked exactly once');
  assert.equal(calls[0].endpoint, 'grpc.example:443');
  assert.equal(calls[0].token, 'tok');
  assert.deepEqual(calls[0].addresses, ['L1', 'L2']);
  assert.equal(typeof calls[0].onLeaderActivity, 'function');
  sub.close();
  assert.equal(calls[1], 'closed', 'close() routes to the gRPC ingestor');
});

test('subscribeWallets falls back to WebSocket when no gRPC endpoint is configured', () => {
  let factoryCalled = false;
  const rpc = createRpcClient({
    getRpcUrl: () => null, // no ws url either -> connect() schedules a reconnect, then we close
    getGrpcEndpoint: () => null,
    grpcIngestorFactory: () => { factoryCalled = true; return { close() {} }; },
  });
  const sub = rpc.subscribeWallets({ addresses: ['L1'], onLeaderActivity: () => {}, onUp: () => {}, onGap: () => {} });
  assert.equal(factoryCalled, false, 'gRPC factory NOT used on the WebSocket path');
  sub.close(); // clears the pending reconnect timer (no leaked timer keeps the process alive)
});

test('subscribeWallets uses WebSocket when getGrpcEndpoint is absent (back-compat)', () => {
  let factoryCalled = false;
  const rpc = createRpcClient({ getRpcUrl: () => null, grpcIngestorFactory: () => { factoryCalled = true; return { close() {} }; } });
  const sub = rpc.subscribeWallets({ addresses: ['L1'], onLeaderActivity: () => {}, onUp: () => {}, onGap: () => {} });
  assert.equal(factoryCalled, false);
  sub.close();
});
