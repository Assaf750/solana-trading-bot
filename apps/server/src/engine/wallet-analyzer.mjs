// wallet-analyzer.mjs — READ-ONLY historical wallet intelligence (GMGN-style decision read).
// Fetches a wallet's recent on-chain history, classifies swaps, and computes a
// point-in-time read-model: win rate, FIFO realized PnL (in SOL), trade-outcome
// distribution, avg hold, and bot/wash signals. No money, no signing — analytics only.
import { detectLeaderSwap } from './swap-detector.mjs';
import { assessCopyability } from './wallet-intelligence.mjs';

const RAPID_FLIP_SECONDS = 5;
const OUTCOME_BUCKETS = [
  { key: 'gt_500', label: '>500%', min: 500 },
  { key: 'b_200_500', label: '200%~500%', min: 200, max: 500 },
  { key: 'b_0_200', label: '0%~200%', min: 0, max: 200 },
  { key: 'b_neg50_0', label: '-50%~0%', min: -50, max: 0 },
  { key: 'lt_neg50', label: '<-50%', max: -50 },
];

function bucketFor(pct) {
  if (pct >= 500) return 'gt_500';
  if (pct >= 200) return 'b_200_500';
  if (pct >= 0) return 'b_0_200';
  if (pct >= -50) return 'b_neg50_0';
  return 'lt_neg50';
}

/**
 * PURE: compute wallet stats from normalized swap events.
 * events: [{ kind:'buy'|'sell', mint, qtyUi, quoteSol, ts(seconds) }, ...] (any order)
 * Returns a structured read-model; status reflects evidence sufficiency (never fabricates).
 */
export function computeWalletStats(events, { solPriceUsd = null } = {}) {
  const clean = (events || [])
    .filter((e) => e && (e.kind === 'buy' || e.kind === 'sell') && e.mint && Number.isFinite(e.ts))
    .sort((a, b) => a.ts - b.ts);

  if (clean.length === 0) {
    return { status: 'insufficient_evidence', provenance: 'on_chain', sample_size: 0 };
  }

  const lotsByMint = new Map(); // mint -> [{ qty, cost, ts }]
  const boughtQty = new Map();
  const soldQty = new Map();
  const lastBuyTs = new Map();
  let rapidFlips = 0;
  const closes = []; // { realizedSol, costSol, pct, holdSeconds }

  for (const e of clean) {
    const qty = Math.abs(e.qtyUi || 0);
    const quote = Math.abs(e.quoteSol || 0);
    if (e.kind === 'buy') {
      if (!lotsByMint.has(e.mint)) lotsByMint.set(e.mint, []);
      lotsByMint.get(e.mint).push({ qty, cost: quote, ts: e.ts });
      boughtQty.set(e.mint, (boughtQty.get(e.mint) || 0) + qty);
      lastBuyTs.set(e.mint, e.ts);
    } else { // sell
      soldQty.set(e.mint, (soldQty.get(e.mint) || 0) + qty);
      const lb = lastBuyTs.get(e.mint);
      if (lb != null && e.ts - lb <= RAPID_FLIP_SECONDS) rapidFlips += 1;
      // FIFO match against buy lots
      let remaining = qty;
      const lots = lotsByMint.get(e.mint) || [];
      let matchedCost = 0;
      let matchedQty = 0;
      let weightedHold = 0;
      while (remaining > 1e-12 && lots.length) {
        const lot = lots[0];
        const take = Math.min(remaining, lot.qty);
        const lotCostPortion = lot.qty > 0 ? lot.cost * (take / lot.qty) : 0;
        matchedCost += lotCostPortion;
        matchedQty += take;
        weightedHold += (e.ts - lot.ts) * take;
        lot.qty -= take;
        lot.cost -= lotCostPortion;
        remaining -= take;
        if (lot.qty <= 1e-12) lots.shift();
      }
      if (matchedQty > 0 && matchedCost > 0) {
        const proceedsForMatched = quote * (matchedQty / qty);
        const realizedSol = proceedsForMatched - matchedCost;
        const pct = (realizedSol / matchedCost) * 100;
        closes.push({ realizedSol, costSol: matchedCost, pct, holdSeconds: weightedHold / matchedQty });
      }
    }
  }

  const tradesClosed = closes.length;
  const wins = closes.filter((c) => c.realizedSol > 0).length;
  const realizedSol = closes.reduce((a, c) => a + c.realizedSol, 0);
  const avgHold = tradesClosed ? closes.reduce((a, c) => a + c.holdSeconds, 0) / tradesClosed : null;

  const distribution = Object.fromEntries(OUTCOME_BUCKETS.map((b) => [b.key, 0]));
  for (const c of closes) distribution[bucketFor(c.pct)] += 1;

  let soldGtBought = 0;
  for (const [mint, sold] of soldQty) if (sold > (boughtQty.get(mint) || 0) * 1.0001) soldGtBought += 1;

  const distinctTokens = new Set(clean.map((e) => e.mint)).size;
  const status = tradesClosed >= 5 ? 'sufficient' : tradesClosed > 0 ? 'low_confidence' : 'insufficient_evidence';

  return {
    status,
    provenance: 'on_chain',
    point_in_time: true,
    sample_size: clean.length,
    distinct_tokens: distinctTokens,
    trades_closed: tradesClosed,
    win_rate: tradesClosed ? wins / tradesClosed : null,
    realized_pnl_sol: round(realizedSol, 6),
    realized_pnl_usd: solPriceUsd != null ? round(realizedSol * solPriceUsd, 2) : null,
    avg_hold_seconds: avgHold != null ? Math.round(avgHold) : null,
    outcome_distribution: OUTCOME_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: distribution[b.key] })),
    bot_signals: {
      // GMGN-style "phishing check" surface, computed from real history (read-only)
      rapid_buy_sell_within_5s: rapidFlips,
      rapid_flip_ratio: tradesClosed ? round(rapidFlips / Math.max(1, clean.filter((e) => e.kind === 'sell').length), 4) : 0,
      sold_more_than_bought_tokens: soldGtBought,
    },
    cost_basis_note: 'SOL-denominated, FIFO, fees excluded — directional read, not exact accounting',
  };
}

function round(n, d) { const f = 10 ** d; return Math.round(n * f) / f; }

// Shared SOL/USD price cache (60s) so the bulk "analyze all" loop doesn't re-quote per wallet.
let solPriceCache = { usd: null, at: 0 };
async function cachedSolPriceUsd(jupiter) {
  if (solPriceCache.usd != null && Date.now() - solPriceCache.at < 60000) return solPriceCache.usd;
  const p = await jupiter.quote({ inputMint: 'So11111111111111111111111111111111111111112', outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amountBaseUnits: 1e9 });
  if (p.ok) { solPriceCache = { usd: p.outAmount / 1e6, at: Date.now() }; return solPriceCache.usd; }
  return null; // refresh failed: return null rather than serving a stale price as current
}

/**
 * Fetch + analyze a wallet's recent history. Bounded (maxSignatures), rate-limited by
 * the rpc client. Read-only: getSignaturesForAddress + getTransaction only. A wider window
 * (150) captures more buy lots so high-volume wallets aren't dropped to insufficient_evidence.
 */
export async function analyzeWallet({ address, rpc, jupiter, maxSignatures = 150 }) {
  const sigRes = await rpc.rpc('getSignaturesForAddress', [address, { limit: Math.min(200, maxSignatures) }]);
  if (!sigRes.ok) return { ok: false, error: sigRes.error };
  const sigs = (Array.isArray(sigRes.result) ? sigRes.result : []).filter((s) => !s.err).map((s) => s.signature);
  if (!sigs.length) return { ok: true, stats: computeWalletStats([]), fetched: 0, signatures_scanned: 0 };

  const events = [];
  let fetched = 0;
  for (const sig of sigs) {
    const tx = await rpc.getTransaction(sig);
    fetched += 1;
    if (!tx.ok || !tx.result) continue;
    const ts = tx.result.blockTime;
    const swap = detectLeaderSwap({ tx: tx.result, leaderAddress: address });
    if (swap.kind === 'buy') events.push({ kind: 'buy', mint: swap.mint, qtyUi: swap.uiDelta, quoteSol: swap.quoteSpent, ts });
    else if (swap.kind === 'sell') events.push({ kind: 'sell', mint: swap.mint, qtyUi: swap.uiDelta, quoteSol: swap.quoteReceived, ts });
  }

  const solPriceUsd = await cachedSolPriceUsd(jupiter);
  const stats = computeWalletStats(events, { solPriceUsd });
  const intelligence = assessCopyability({ stats, events });

  return { ok: true, fetched, signatures_scanned: sigs.length, stats, intelligence };
}
