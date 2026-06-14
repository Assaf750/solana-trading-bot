// holdings.mjs — read the execution wallet's SPL token balances (Token + Token-2022) via
// getTokenAccountsByOwner. Read-only; never on the trading path. Drops zero/empty accounts.
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export async function fetchHoldings({ rpc, owner }) {
  if (!rpc || typeof rpc.rpc !== 'function') return { ok: false, error: 'rpc_unavailable' };
  if (!owner) return { ok: false, error: 'no_owner' };
  const tokens = [];
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    // Token-2022 may be unsupported on some RPCs — skip a failing program, don't fail the whole call
    const r = await rpc.rpc('getTokenAccountsByOwner', [owner, { programId }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
    if (!r.ok) continue;
    for (const acc of r.result?.value || []) {
      const info = acc?.account?.data?.parsed?.info;
      const amt = info?.tokenAmount;
      const uiAmount = Number(amt?.uiAmount ?? 0);
      if (!info?.mint || !(uiAmount > 0)) continue; // drop empty / dust-zero accounts
      tokens.push({
        mint: info.mint,
        amount_ui: uiAmount,
        decimals: Number(amt?.decimals ?? 0),
        program: programId === TOKEN_2022_PROGRAM ? 'token-2022' : 'token',
      });
    }
  }
  tokens.sort((a, b) => b.amount_ui - a.amount_ui);
  return { ok: true, tokens };
}
