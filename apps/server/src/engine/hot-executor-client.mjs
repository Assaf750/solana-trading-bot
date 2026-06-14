// hot-executor-client.mjs — Node client for the Rust services/hot-executor process.
// Manages a persistent child and talks JSON-lines over stdin/stdout. The Rust loop processes one
// request per line in order, so responses are correlated FIFO. Used ONLY when the owner enables
// the Rust signer backend (config.execution.signer_backend = 'rust' + HOT_EXECUTOR_BIN set); the
// live-executor falls back to in-process signing on any failure, so this can never block a sign.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export function createHotExecutorClient({ binPath, args = [], spawnFn = spawn } = {}) {
  let child = null;
  let rl = null;
  let seq = 0;
  const queue = []; // FIFO of pending { resolve, expectId }

  function failAll(reason) {
    const pending = queue.splice(0);
    for (const r of pending) r.resolve({ ok: false, error: reason });
  }

  function ensure() {
    if (child) return;
    child = spawnFn(binPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const r = queue.shift();
      if (!r) return; // unsolicited line — ignore
      let parsed;
      try { parsed = JSON.parse(line); }
      catch { r.resolve({ ok: false, error: 'invalid_response' }); return; }
      // FIFO desync guard: if we expected a correlation id and the echo doesn't match, refuse the
      // response rather than hand a mismatched signature back to the money path (caller falls back).
      if (r.expectId != null && parsed.intent_id != null && parsed.intent_id !== r.expectId) {
        r.resolve({ ok: false, error: 'response_mismatch' });
        return;
      }
      r.resolve(parsed);
    });
    child.on('exit', () => { child = null; rl = null; failAll('executor_exited'); });
    child.on('error', () => { child = null; rl = null; failAll('executor_error'); });
  }

  function request(obj, expectId = null) {
    return new Promise((resolve) => {
      try { ensure(); } catch { resolve({ ok: false, error: 'executor_spawn_failed' }); return; }
      if (!child || !child.stdin || child.stdin.writable === false) {
        resolve({ ok: false, error: 'executor_unavailable' });
        return;
      }
      queue.push({ resolve, expectId });
      try { child.stdin.write(`${JSON.stringify(obj)}\n`); }
      catch { /* exit/error handler will fail the pending request */ }
    });
  }

  /** Sign a serialized tx via the Rust signer. Returns the same shape as tx-signer.mjs. */
  async function sign({ txBase64, seed }) {
    const seedArr = Buffer.isBuffer(seed) ? [...seed] : seed;
    const id = `c${seq += 1}`; // correlation nonce echoed back as intent_id
    const r = await request({ op: 'sign', intent_id: id, unsigned_tx_base64: txBase64, seed: seedArr }, id);
    if (r.ok) {
      return { ok: true, signedTxBase64: r.signed_tx_base64, signatureB58: r.signature, signerAddress: r.signer_address };
    }
    return { ok: false, error: r.error || 'sign_failed' };
  }

  function ping() { return request({ op: 'ping' }); }

  function close() {
    try { child?.stdin?.end(); } catch { /* fine */ }
    try { child?.kill(); } catch { /* fine */ }
    child = null;
    rl = null;
    failAll('client_closed');
  }

  return { sign, ping, close };
}
