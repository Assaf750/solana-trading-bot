// swap-detector.mjs — PURE: classify a leader wallet's transaction as buy/sell from
// pre/post token balances. No network, fully testable.
//
// Heuristic (robust for AMM swaps incl. Pump.fun/PumpSwap/Jupiter):
//  - deltas of the leader's token accounts by mint (postTokenBalances - preTokenBalances)
//  - quote mints (wSOL/USDC) + native SOL delta = the paying/receiving side
//  - exactly-one non-quote mint with positive delta + negative quote flow => BUY
//  - exactly-one non-quote mint with negative delta + positive quote flow => SELL
//  - post amount ~ 0 on a sell => full exit, else partial
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DEFAULT_QUOTES = new Set([WSOL_MINT, USDC_MINT]);

// decimals from a uiTokenAmount, deriving from raw amount/uiAmount when the field is absent
// (some enhanced/partial payloads omit it) so downstream base-unit sizing isn't computed against 0.
function tokenDecimals(u) {
  if (Number.isFinite(u?.decimals)) return u.decimals;
  const raw = Number(u?.amount); const ui = Number(u?.uiAmount);
  if (raw > 0 && ui > 0) return Math.round(Math.log10(raw / ui));
  return 0;
}

export function detectLeaderSwap({ tx, leaderAddress, quoteMints = DEFAULT_QUOTES }) {
  try {
    const meta = tx?.meta;
    if (!meta || meta.err) return { kind: null, reason: meta?.err ? 'tx_failed' : 'no_meta' };

    // SUM balances by mint across ALL the leader's token accounts for that mint: a wallet can
    // hold one mint in several token accounts, so keying by mint alone (last-write-wins) would
    // mis-compute the delta and the sell fraction / full-exit flag that drive the mirrored sell.
    const preByMint = new Map();  // mint -> summed pre uiAmount
    const postByMint = new Map(); // mint -> { amount: summed post uiAmount, decimals }
    for (const b of meta.preTokenBalances || []) {
      if (b.owner !== leaderAddress) continue;
      preByMint.set(b.mint, (preByMint.get(b.mint) || 0) + Number(b.uiTokenAmount?.uiAmount ?? 0));
    }
    for (const b of meta.postTokenBalances || []) {
      if (b.owner !== leaderAddress) continue;
      const ex = postByMint.get(b.mint);
      const amt = Number(b.uiTokenAmount?.uiAmount ?? 0);
      if (ex) ex.amount += amt;
      else postByMint.set(b.mint, { amount: amt, decimals: tokenDecimals(b.uiTokenAmount) });
    }
    // a mint present in pre but absent from post = account(s) closed on a full exit -> post 0,
    // and we still need its decimals (carried from the pre row) for base-unit sizing.
    for (const b of meta.preTokenBalances || []) {
      if (b.owner !== leaderAddress) continue;
      if (!postByMint.has(b.mint)) postByMint.set(b.mint, { amount: 0, decimals: tokenDecimals(b.uiTokenAmount) });
    }
    const deltas = new Map(); // mint -> { delta (ui), post (ui), decimals }
    for (const mint of new Set([...preByMint.keys(), ...postByMint.keys()])) {
      const preAmt = preByMint.get(mint) || 0;
      const postEntry = postByMint.get(mint) || { amount: 0, decimals: 0 };
      deltas.set(mint, { delta: postEntry.amount - preAmt, post: postEntry.amount, decimals: postEntry.decimals });
    }

    // native SOL delta for the leader (index in accountKeys)
    let solDelta = 0;
    const keys = tx?.transaction?.message?.accountKeys || [];
    const idx = keys.findIndex((k) => (typeof k === 'string' ? k : k?.pubkey) === leaderAddress);
    if (idx >= 0 && Array.isArray(meta.preBalances) && Array.isArray(meta.postBalances)) {
      solDelta = (meta.postBalances[idx] - meta.preBalances[idx]) / 1e9;
    }

    let quoteFlow = solDelta; // + means leader received quote, - means leader paid quote
    let solQuote = solDelta;  // SOL/wSOL side of the quote flow (for fill-price reconstruction)
    let usdcQuote = 0;        // USDC side of the quote flow
    const targets = [];
    for (const [mint, d] of deltas) {
      if (quoteMints.has(mint)) {
        quoteFlow += d.delta;
        if (mint === WSOL_MINT) solQuote += d.delta;
        else if (mint === USDC_MINT) usdcQuote += d.delta;
      } else if (Math.abs(d.delta) > 0) targets.push({ mint, ...d });
    }
    if (targets.length !== 1) return { kind: null, reason: targets.length === 0 ? 'no_token_delta' : 'multi_token_ambiguous' };

    const t = targets[0];
    if (t.delta > 0 && quoteFlow < 0) {
      // quoteSpentSol/Usdc let the engine price the leader's fill (drift guard); a buy spends quote
      return {
        kind: 'buy', mint: t.mint, uiDelta: t.delta, post: t.post, decimals: t.decimals,
        quoteSpent: -quoteFlow,
        quoteSpentSol: solQuote < 0 ? -solQuote : 0,
        quoteSpentUsdc: usdcQuote < 0 ? -usdcQuote : 0,
      };
    }
    if (t.delta < 0 && quoteFlow > 0) {
      const fullExit = t.post <= Math.abs(t.delta) * 1e-6 || t.post === 0;
      return {
        kind: 'sell', mint: t.mint, uiDelta: t.delta, post: t.post, decimals: t.decimals,
        quoteReceived: quoteFlow, fullExit, soldFraction: t.post + Math.abs(t.delta) > 0 ? Math.abs(t.delta) / (t.post + Math.abs(t.delta)) : 1,
      };
    }
    return { kind: null, reason: 'direction_unclear' };
  } catch {
    return { kind: null, reason: 'parse_error' }; // fail-safe: unparseable => no signal
  }
}
