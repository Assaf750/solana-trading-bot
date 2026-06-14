// parse.mjs — PURE: map a Yellowstone gRPC transaction update to the exact shape the engine's
// swap-detector consumes ({ signature, tx:{ transaction:{message:{accountKeys[]}}, meta } }).
// No network, fully testable. The b58 encoder is injectable so the server can pass its own and
// keep a single source of truth.
import { b58encode } from './base58.mjs';

function mapTokenBalance(b) {
  const ui = b?.uiTokenAmount || {};
  const uiAmount = ui.uiAmount != null ? Number(ui.uiAmount)
    : (ui.uiAmountString != null ? Number(ui.uiAmountString) : 0);
  return {
    owner: b?.owner,                 // yellowstone delivers owner/mint as base58 strings already
    mint: b?.mint,
    uiTokenAmount: { uiAmount, decimals: ui.decimals, amount: ui.amount },
  };
}

/** Returns { signature, tx } or null (malformed / failed tx -> no signal). */
export function parseYellowstoneUpdate(update, { b58 = b58encode } = {}) {
  const t = update?.transaction;
  const inner = t?.transaction;                 // the actual transaction envelope
  if (!t || !inner) return null;
  const meta = inner.meta || t.meta;
  if (meta?.err) return null;                   // failed tx carries no copy signal

  const sigBytes = t.signature || inner.signature || inner.transaction?.signatures?.[0];
  if (!sigBytes) return null;
  const signature = typeof sigBytes === 'string' ? sigBytes : b58(sigBytes);

  const msg = inner.transaction?.message || inner.message || {};
  const accountKeys = (msg.accountKeys || []).map((k) => (typeof k === 'string' ? k : b58(k)));

  const tx = {
    transaction: { message: { accountKeys } },
    meta: {
      err: meta?.err || null,
      preBalances: meta?.preBalances || [],
      postBalances: meta?.postBalances || [],
      preTokenBalances: (meta?.preTokenBalances || []).map(mapTokenBalance),
      postTokenBalances: (meta?.postTokenBalances || []).map(mapTokenBalance),
    },
  };
  return { signature, tx };
}
