// provider-stream-parity.test.mjs — ADR-0001 Phase 3B.4. Streaming-parity harness for
// rpc.subscribeWallets — the one PROVIDER_BACKEND dispatch point that is not a simple request→response.
// It drives a scripted WebSocket scenario through createRpcClient with a fake socket + mock timers (NO
// network) and pins the full observable trace: subscriptions sent, onUp, onLeaderActivity (logs + inline
// tx + ignored malformed/errored frames), onGap after the gap window, and bounded-backoff reconnect.
//
// This golden trace was confirmed BYTE-IDENTICAL between the legacy in-process client and the
// @soltrade/provider-adapters package (driven through the same scenario via PROVIDER_BACKEND) before the
// legacy shim was removed in 3B.4 — so it both proved removal-safety and now guards the package stream
// behaviour. The gRPC transport dispatch is covered separately by rpc-transport.test.mjs.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRpcClient } from '../src/engine/rpc-client.mjs';

// run the scripted WS scenario through a fresh client; return the observable callback/IO trace
function runWsScenario() {
  const trace = [];
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; sockets.push(this); }
    send(d) { this.sent.push(d); }
    close() { trace.push('ws.close#' + sockets.indexOf(this)); }
  }
  const prevWS = globalThis.WebSocket;
  globalThis.WebSocket = FakeWS;
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    const client = createRpcClient({ getRpcUrl: () => 'http://rpc.test', getGrpcEndpoint: () => null });
    const sub = client.subscribeWallets({
      addresses: ['L1', 'L2'],
      onLeaderActivity: (a) => trace.push(['activity', a]),
      onUp: (u) => trace.push(['up', u]),
      onGap: () => trace.push(['gap']),
      gapMs: 500,
    });
    const s0 = sockets[0];
    s0.onopen(); // sends the subscriptions + onUp
    trace.push(['s0.subs', s0.sent.map((s) => JSON.parse(s)).map((m) => ({ method: m.method, mentions: m.params?.[0]?.mentions }))]);
    s0.onmessage({ data: JSON.stringify({ method: 'logsNotification', params: { result: { value: { signature: 'sigA', err: null } } } }) });
    s0.onmessage({ data: JSON.stringify({ method: 'transactionNotification', params: { result: { value: { signature: 'sigB', transaction: { transaction: { x: 1 }, meta: { y: 2 } } } } } }) });
    s0.onmessage({ data: 'not json{' });          // malformed -> ignored
    s0.onmessage({ data: JSON.stringify({ method: 'logsNotification', params: { result: { value: { signature: 'sigC', err: 'boom' } } } }) }); // errored -> ignored
    s0.onclose();             // keepalive cleared + scheduleReconnect (downSince set, gap+reconnect timers armed)
    mock.timers.tick(500);    // gapMs -> onGap fires once
    mock.timers.tick(500);    // reach backoff(1000) -> reconnect connect() -> socket 1
    sockets[1].onopen();      // re-subscribes + onUp again
    trace.push(['reconnect.subs', sockets[1].sent.length]);
    sub.close();              // teardown -> closes the live socket, clears timers
    trace.push(['sockets', sockets.length]);
    return trace;
  } finally {
    mock.timers.reset();
    globalThis.WebSocket = prevWS;
  }
}

test('subscribeWallets WS streaming trace matches the 3B.4 golden (confirmed legacy ≡ package before removal)', () => {
  assert.deepEqual(runWsScenario(), [
    ['up', { provider: 'generic' }],
    ['s0.subs', [{ method: 'logsSubscribe', mentions: ['L1'] }, { method: 'logsSubscribe', mentions: ['L2'] }]],
    ['activity', { signature: 'sigA', tx: null }],
    ['activity', { signature: 'sigB', tx: { transaction: { x: 1 }, meta: { y: 2 } } }],
    ['gap'],
    ['up', { provider: 'generic' }],
    ['reconnect.subs', 2],
    'ws.close#1',
    ['sockets', 2],
  ]);
});

// gRPC dispatch parity: when an endpoint is configured the package routes to the injected ingestor
// factory with the caller's args (the same contract the legacy client used) — no WebSocket created.
test('subscribeWallets routes to the injected gRPC ingestor with the caller args (no WS path)', () => {
  const calls = [];
  let wsBuilt = 0;
  const prevWS = globalThis.WebSocket;
  globalThis.WebSocket = class { constructor() { wsBuilt += 1; } };
  try {
    const client = createRpcClient({
      getRpcUrl: () => 'http://rpc.test',
      getGrpcEndpoint: () => ({ endpoint: 'grpc.x:443', token: 'tok' }),
      grpcIngestorFactory: (a) => { calls.push({ endpoint: a.endpoint, token: a.token, addresses: a.addresses, gapMs: a.gapMs }); return { close() { calls.push('closed'); } }; },
    });
    const sub = client.subscribeWallets({ addresses: ['L1', 'L2'], onLeaderActivity: () => {}, onUp: () => {}, onGap: () => {}, gapMs: 777 });
    sub.close();
  } finally { globalThis.WebSocket = prevWS; }
  assert.deepEqual(calls, [{ endpoint: 'grpc.x:443', token: 'tok', addresses: ['L1', 'L2'], gapMs: 777 }, 'closed']);
  assert.equal(wsBuilt, 0, 'no WebSocket is created when the gRPC transport is used');
});
