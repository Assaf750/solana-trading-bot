// grpc-ingestor.mjs — Yellowstone/Geyser gRPC leader-trade subscription. Mirrors the lifecycle
// of apps/server subscribeWallets (connect, bounded-backoff reconnect, gap timer, keepalive) and
// emits the SAME callbacks, so it is a drop-in replacement behind that interface. The actual
// gRPC client is lazy-loaded (or injected for tests) so importing this module never requires the
// optional @triton-one/yellowstone-grpc dependency to be installed.
import { parseYellowstoneUpdate } from './parse.mjs';

const COMMITMENT_CONFIRMED = 1; // yellowstone CommitmentLevel.CONFIRMED

export function createGrpcIngestor({
  endpoint, token, addresses,
  onLeaderActivity, onUp, onGap,
  gapMs = 120000, keepAliveMs = 30000, clientFactory,
}) {
  let stream = null;
  let closed = false;
  let backoff = 1000;
  let downSince = null;
  let gapTimer = null;
  let keepAlive = null;

  async function makeClient() {
    if (clientFactory) return clientFactory({ endpoint, token });
    const mod = await import('@triton-one/yellowstone-grpc');
    const Client = mod.default?.default || mod.default || mod.Client;
    return new Client(endpoint, token, undefined);
  }

  function buildRequest() {
    return {
      accounts: {}, slots: {},
      transactions: {
        leaders: {
          accountInclude: addresses, accountExclude: [], accountRequired: [],
          vote: false, failed: false,
        },
      },
      transactionsStatus: {}, blocks: {}, blocksMeta: {}, entry: {},
      commitment: COMMITMENT_CONFIRMED, accountsDataSlice: [],
    };
  }

  function writeRequest(s, req) {
    return new Promise((resolve, reject) => {
      try { s.write(req, (err) => (err ? reject(err) : resolve())); }
      catch (e) { reject(e); }
    });
  }

  async function connect() {
    if (closed) return;
    let client;
    try { client = await makeClient(); } catch { scheduleReconnect(); return; }
    try { stream = await client.subscribe(); } catch { scheduleReconnect(); return; }

    stream.on('data', (update) => {
      try {
        if (update?.pong) return; // keepalive reply
        const parsed = parseYellowstoneUpdate(update);
        if (parsed && onLeaderActivity) onLeaderActivity(parsed);
      } catch { /* malformed frame — ignore, the stream continues */ }
    });
    stream.on('error', () => { try { stream.end?.(); } catch { /* already closing */ } scheduleReconnect(); });
    stream.on('end', () => scheduleReconnect());
    stream.on('close', () => scheduleReconnect());

    try { await writeRequest(stream, buildRequest()); }
    catch { scheduleReconnect(); return; }

    backoff = 1000;
    downSince = null;
    if (gapTimer) { clearTimeout(gapTimer); gapTimer = null; }
    keepAlive = setInterval(() => { writeRequest(stream, { ping: { id: 1 } }).catch(() => {}); }, keepAliveMs);
    if (onUp) onUp({ provider: 'yellowstone' });
  }

  function scheduleReconnect() {
    if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
    if (closed) return;
    if (!downSince) {
      downSince = Date.now();
      gapTimer = setTimeout(() => { if (onGap && !closed) onGap(); }, gapMs);
    }
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 60000);
  }

  connect();
  return {
    close() {
      closed = true;
      if (gapTimer) clearTimeout(gapTimer);
      if (keepAlive) clearInterval(keepAlive);
      try { stream?.end?.(); } catch { /* fine */ }
    },
  };
}
