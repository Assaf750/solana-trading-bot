// @soltrade/provider-adapters — Jito provider (ADR-0001 Phase 2D).
// Pure tip helpers byte-for-byte from engine/jito-tip-tx.mjs (b58decode injected) + the bundle/tip
// network helpers ported from index.mjs (bundle url injected via getBundleUrl -> { ok, url, error }).

const SYSTEM_PROGRAM = Buffer.alloc(32);

function shortvec(n) {
  const out = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v >>>= 7;
    if (v) out.push(b | 0x80);
    else { out.push(b); break; }
  }
  return Buffer.from(out);
}

/** Build the buildTipTransferTx fn bound to an injected b58decode (parity with engine helper). */
export function makeTipTransferBuilder(b58decode) {
  if (typeof b58decode !== 'function') throw new Error('tip_builder_requires_b58decode');
  return function buildTipTransferTx({ owner, tipAccount, lamports, recentBlockhash }) {
    const ownerKey = Buffer.from(b58decode(owner));
    const tipKey = Buffer.from(b58decode(tipAccount));
    const blockhash = Buffer.from(b58decode(recentBlockhash));
    if (ownerKey.length !== 32 || tipKey.length !== 32 || blockhash.length !== 32) {
      throw new Error('tip_tx_bad_key_length');
    }
    if (!Number.isInteger(lamports) || lamports <= 0) throw new Error('tip_tx_bad_lamports');
    const header = Buffer.from([1, 0, 1]);
    const keys = Buffer.concat([ownerKey, tipKey, SYSTEM_PROGRAM]);
    const data = Buffer.alloc(12);
    data.writeUInt32LE(2, 0);
    data.writeBigUInt64LE(BigInt(lamports), 4);
    const instruction = Buffer.concat([
      Buffer.from([2]),
      shortvec(2), Buffer.from([0, 1]),
      shortvec(data.length), data,
    ]);
    const message = Buffer.concat([header, shortvec(3), keys, blockhash, shortvec(1), instruction]);
    const tx = Buffer.concat([shortvec(1), Buffer.alloc(64), message]);
    return tx.toString('base64');
  };
}

/** Pick the Jito tip in lamports (pure; byte-for-byte parity with the engine helper). */
export function selectTipLamports({ floor, percentile = 50, fixedLamports = 10000, maxLamports = null }) {
  const fixed = Number.isFinite(fixedLamports) && fixedLamports > 0 ? Math.floor(fixedLamports) : 10000;
  const cap = Math.max(fixed, Number.isFinite(maxLamports) && maxLamports > 0 ? Math.floor(maxLamports) : fixed);
  const buckets = [25, 50, 75, 95, 99];
  const pn = Number(percentile);
  const pct = Number.isFinite(pn) ? buckets.reduce((a, b) => (Math.abs(b - pn) < Math.abs(a - pn) ? b : a), 50) : 50;
  const sol = floor ? Number(floor[`landed_tips_${pct}th_percentile`]) : NaN;
  if (!Number.isFinite(sol) || sol <= 0) return fixed;
  const lamports = Math.floor(sol * 1e9);
  return Math.max(fixed, Math.min(lamports, cap));
}

/**
 * Jito network provider. getBundleUrl() -> { ok, url, error } resolves the block-engine URL (the
 * caller does the vault lookup, keeping secrets out of the package). sendBundle/getTipFloor are a
 * byte-for-byte port of the index.mjs glue (same payloads + error strings).
 */
// `request` is the injected HTTP transport (fetch-compatible) so the package stays mechanism-guard
// pure; the server passes fetch. tip helpers are pure.
export function createJitoProvider({ getBundleUrl, b58decode, request, tipFloorUrl = 'https://bundles.jito.wtf/api/v1/bundles/tip_floor' } = {}) {
  const buildTipTransferTx = typeof b58decode === 'function' ? makeTipTransferBuilder(b58decode) : undefined;

  async function sendBundle(txsBase64) {
    const u = typeof getBundleUrl === 'function' ? getBundleUrl() : null;
    if (!u || !u.ok || !u.url) return { ok: false, error: (u && u.error) || 'jito_url_unset' };
    try {
      const res = await request(`${u.url.replace(/\/+$/, '')}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendBundle', params: [txsBase64, { encoding: 'base64' }] }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { ok: false, error: `jito_http_${res.status}` };
      const j = await res.json();
      if (j.error) return { ok: false, error: `jito_${j.error.code ?? 'err'}` };
      if (!j.result) return { ok: false, error: 'jito_no_bundle_id' };
      return { ok: true, result: j.result };
    } catch (e) {
      return { ok: false, error: `jito_failed_${String(e?.name || 'err')}` };
    }
  }

  async function getTipFloor() {
    try {
      const res = await request(tipFloorUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const j = await res.json();
      return Array.isArray(j) ? j[0] : j;
    } catch {
      return null;
    }
  }

  return { sendBundle, getTipFloor, buildTipTransferTx, selectTipLamports };
}
