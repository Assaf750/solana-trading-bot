// hot-executor-client.mjs — Node client for the Rust services/hot-executor process, the OFFICIAL
// signing/execution boundary (ADR-0001 Phase Rust-1). Manages a persistent child and talks JSON-lines
// over stdin/stdout; the Rust loop processes one request per line in order, so responses are correlated
// FIFO. The live-executor PREFERS this whenever it is configured (signer_backend defaults to 'rust' +
// HOT_EXECUTOR_BIN set) and falls back to in-process signing on ANY failure, so it can never block a sign.
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

  /** Sign EVERY unsigned leg of an execution bundle (Phase Rust-3). Returns { ok, signed:[base64,…] } in
   *  input order, or { ok:false } so the caller can fall back to in-process signing. The JS control plane
   *  builds the legs and POSTs the bundle (idempotency stays in JS); the signer never touches the network. */
  async function signBundle({ txsBase64, seed }) {
    const seedArr = Buffer.isBuffer(seed) ? [...seed] : seed;
    const id = `c${seq += 1}`;
    const r = await request({ op: 'sign_bundle', intent_id: id, unsigned_txs: txsBase64, seed: seedArr }, id);
    if (r.ok && Array.isArray(r.signed_txs)) return { ok: true, signed: r.signed_txs };
    return { ok: false, error: r.error || 'sign_bundle_failed' };
  }

  /** Build the JSON-RPC `sendTransaction` request BODY via Rust (Phase Rust-4) — PURE assembly, no
   *  network. Returns { ok, body } (the full {jsonrpc,id,method,params} object) or { ok:false } so the
   *  caller can fall back to JS-built assembly. The JS control plane still performs the POST (with its
   *  retries / health / error-mapping) and owns the decision-ledger idempotency. */
  async function buildSubmit({ signedTxBase64, skipPreflight = false, maxRetries = 3 }) {
    const id = `c${seq += 1}`;
    const r = await request({ op: 'build_submit', intent_id: id, signed_tx_base64: signedTxBase64, skip_preflight: skipPreflight, max_retries: maxRetries }, id);
    if (r.ok && r.request) return { ok: true, body: r.request };
    return { ok: false, error: r.error || 'build_submit_failed' };
  }

  /** Build the Jito `sendBundle` request BODY via Rust (Phase Rust-4). Returns { ok, body } (the full
   *  {jsonrpc,id,method,params} object) or { ok:false } so the caller can fall back to JS assembly. The
   *  POST + idempotency stay in JS; the signer never touches the network. */
  async function buildBundle({ signedTxs }) {
    const id = `c${seq += 1}`;
    const r = await request({ op: 'build_bundle', intent_id: id, signed_txs: signedTxs }, id);
    if (r.ok && r.request) return { ok: true, body: r.request };
    return { ok: false, error: r.error || 'build_bundle_failed' };
  }

  function ping() { return request({ op: 'ping' }); }

  function close() {
    try { child?.stdin?.end(); } catch { /* fine */ }
    try { child?.kill(); } catch { /* fine */ }
    child = null;
    rl = null;
    failAll('client_closed');
  }

  return { sign, signBundle, buildSubmit, buildBundle, ping, close };
}
