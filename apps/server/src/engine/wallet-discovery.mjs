// wallet-discovery.mjs — READ-ONLY on-chain wallet discovery. Two modes:
//  1) discoverTokenTraders(mint): given a token mint, scan its recent transactions and
//     surface the distinct wallets that actually TRADED it (balance changed / exited).
//  2) discoverFromLeaders(leaders): AUTOMATIC search — no mint needed. Take the operator's
//     followed leaders, find the tokens they recently bought, then surface OTHER wallets
//     that also trade those tokens (a "smart-money cluster"), ranked by overlap.
// No money, no execution — discovery is read-only and never a buy signal.
import { detectLeaderSwap } from './swap-detector.mjs';

const CHANGE_EPS = 1e-9; // ignore sub-dust float noise in uiAmount deltas

/** PURE: distinct owner wallets whose total `mint` balance actually changed in this tx.
 *  Balances are SUMMED per owner (an owner may hold the mint in several token accounts),
 *  so multi-account owners aren't mis-flagged and an exit (post total 0) counts as a change. */
export function extractTradersFromTx(txResult, mint) {
  try {
    const meta = txResult?.meta;
    if (!meta || meta.err) return [];
    const sumByOwner = (list) => {
      const m = new Map();
      for (const b of list || []) {
        if (b.mint === mint && b.owner) m.set(b.owner, (m.get(b.owner) || 0) + Number(b.uiTokenAmount?.uiAmount ?? 0));
      }
      return m;
    };
    const pre = sumByOwner(meta.preTokenBalances);
    const post = sumByOwner(meta.postTokenBalances);
    const owners = new Set();
    for (const owner of new Set([...pre.keys(), ...post.keys()])) {
      if (Math.abs((post.get(owner) ?? 0) - (pre.get(owner) ?? 0)) > CHANGE_EPS) owners.add(owner);
    }
    return [...owners];
  } catch {
    return [];
  }
}

/** Scan a token mint's recent signatures and rank the wallets that traded it. */
export async function discoverTokenTraders({ mint, rpc, maxSignatures = 60, maxResults = 30 }) {
  const sigRes = await rpc.rpc('getSignaturesForAddress', [mint, { limit: Math.min(150, maxSignatures) }]);
  if (!sigRes.ok) return { ok: false, error: sigRes.error };
  const sigs = (Array.isArray(sigRes.result) ? sigRes.result : []).filter((s) => !s.err).map((s) => s.signature);
  if (!sigs.length) return { ok: true, mint, scanned: 0, traders: [] };

  const counts = new Map();
  let scanned = 0;
  let fetchFailures = 0;
  let txWithTraders = 0;
  for (const sig of sigs) {
    const tx = await rpc.getTransaction(sig);
    scanned += 1;
    if (!tx.ok || !tx.result) { fetchFailures += 1; continue; }
    const traders = extractTradersFromTx(tx.result, mint);
    if (traders.length) txWithTraders += 1;
    for (const owner of traders) counts.set(owner, (counts.get(owner) || 0) + 1);
  }
  // Honest failure: if EVERY fetch failed this is an RPC outage, not "no traders".
  if (scanned > 0 && fetchFailures === scanned) return { ok: false, error: 'rpc_fetch_failed', scanned };

  // Drop ubiquitous accounts (AMM pool/vault or hyper-bot present in most scanned trades) —
  // they are the swap counterparty, not a wallet worth copying. Only when the sample is big
  // enough to be meaningful (>=10 trade-bearing txs) to avoid false positives on thin tokens.
  const poolCutoff = txWithTraders >= 10 ? txWithTraders * 0.7 : Infinity;
  let kept = [...counts.entries()].filter(([, n]) => n < poolCutoff);
  if (!kept.length) kept = [...counts.entries()]; // never return empty SOLELY because of the pool filter
  const traders = kept
    .map(([address, swaps_seen]) => ({ address, swaps_seen }))
    .sort((a, b) => b.swaps_seen - a.swaps_seen)
    .slice(0, maxResults);

  return { ok: true, mint, scanned, signatures_seen: sigs.length, fetch_failures: fetchFailures, traders, provenance: 'on_chain' };
}

/** PURE-ish: the token mints a wallet recently BOUGHT, most-frequent first.
 *  Returns null on an RPC failure (so the caller can tell an outage from "no recent buys"). */
async function recentBuyMints({ address, rpc, maxSignatures = 25 }) {
  const sigRes = await rpc.rpc('getSignaturesForAddress', [address, { limit: Math.min(60, maxSignatures) }]);
  if (!sigRes.ok) return null;
  const sigs = (Array.isArray(sigRes.result) ? sigRes.result : []).filter((s) => !s.err).map((s) => s.signature);
  const freq = new Map();
  for (const sig of sigs) {
    const tx = await rpc.getTransaction(sig);
    if (!tx.ok || !tx.result) continue;
    const swap = detectLeaderSwap({ tx: tx.result, leaderAddress: address });
    if (swap.kind === 'buy' && swap.mint) freq.set(swap.mint, (freq.get(swap.mint) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/**
 * AUTOMATIC discovery — no mint required. Bounded by design (caps on leaders/mints) so the
 * RPC budget is predictable. Surfaces wallets that co-trade the tokens your leaders buy,
 * ranked by how many of those tokens they share, excluding your own leaders.
 */
export async function discoverFromLeaders({ leaders, rpc, maxLeaders = 5, mintsPerLeader = 2, maxMints = 4, maxResults = 30 }) {
  const leaderList = (leaders || []).filter(Boolean);
  if (!leaderList.length) return { ok: true, scanned_leaders: 0, mints_seen: 0, traders: [], provenance: 'on_chain_leader_graph' };
  const leaderSet = new Set(leaderList);

  // 1) tokens the leaders recently bought
  const mintFreq = new Map();
  const scanned = leaderList.slice(0, maxLeaders);
  let leaderFailures = 0;
  for (const leader of scanned) {
    const mints = await recentBuyMints({ address: leader, rpc });
    if (mints == null) { leaderFailures += 1; continue; } // RPC failure (not "no buys")
    for (const m of mints.slice(0, mintsPerLeader)) mintFreq.set(m, (mintFreq.get(m) || 0) + 1);
  }
  // honest failure: if EVERY leader fetch failed, this is an RPC outage, not "no leaders"
  if (scanned.length > 0 && leaderFailures === scanned.length) return { ok: false, error: 'rpc_fetch_failed' };
  const topMints = [...mintFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxMints).map(([m]) => m);
  if (!topMints.length) {
    return { ok: true, scanned_leaders: Math.min(maxLeaders, leaderList.length), mints_seen: 0, traders: [], provenance: 'on_chain_leader_graph' };
  }

  // 2) co-traders of those tokens (excluding the leaders themselves), ranked by overlap
  const candidate = new Map(); // address -> count of distinct leader-tokens also traded
  for (const mint of topMints) {
    const d = await discoverTokenTraders({ mint, rpc, maxSignatures: 40, maxResults: 50 });
    if (!d.ok) continue;
    for (const t of d.traders) {
      if (leaderSet.has(t.address)) continue;
      candidate.set(t.address, (candidate.get(t.address) || 0) + 1);
    }
  }
  const traders = [...candidate.entries()]
    .map(([address, shared_tokens]) => ({ address, shared_tokens }))
    .sort((a, b) => b.shared_tokens - a.shared_tokens)
    .slice(0, maxResults);

  return {
    ok: true,
    scanned_leaders: Math.min(maxLeaders, leaderList.length),
    mints_seen: topMints.length,
    traders,
    provenance: 'on_chain_leader_graph',
  };
}
