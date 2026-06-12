// wallet-discovery.mjs — READ-ONLY on-chain wallet discovery. Given a token mint,
// scan its recent transactions and surface the distinct wallets that traded it,
// ranked by activity. The operator can then analyze + follow them (wallet-led copy).
// No money, no execution — discovery is read-only and never a buy signal.
const QUOTE_MINTS = new Set([
  'So11111111111111111111111111111111111111112', // wSOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
]);

/** PURE: distinct owner wallets whose balance in `mint` changed in this tx. */
export function extractTradersFromTx(txResult, mint) {
  try {
    const meta = txResult?.meta;
    if (!meta || meta.err) return [];
    const pre = new Map();
    for (const b of meta.preTokenBalances || []) {
      if (b.mint === mint && b.owner) pre.set(b.owner, Number(b.uiTokenAmount?.uiAmount ?? 0));
    }
    const owners = new Set();
    for (const b of meta.postTokenBalances || []) {
      if (b.mint !== mint || !b.owner) continue;
      const before = pre.get(b.owner) ?? 0;
      const after = Number(b.uiTokenAmount?.uiAmount ?? 0);
      if (Math.abs(after - before) > 0) owners.add(b.owner);
    }
    // owners that fully exited (present pre, absent post)
    for (const [owner, amt] of pre) if (amt > 0) owners.add(owner);
    return [...owners];
  } catch {
    return [];
  }
}

/** Scan a token mint's recent signatures and rank the wallets that traded it. */
export async function discoverTokenTraders({ mint, rpc, maxSignatures = 60, maxResults = 30 }) {
  const sigRes = await rpc.rpc('getSignaturesForAddress', [mint, { limit: Math.min(150, maxSignatures) }]);
  if (!sigRes.ok) return { ok: false, error: sigRes.error };
  const sigs = (sigRes.result || []).filter((s) => !s.err).map((s) => s.signature);
  if (!sigs.length) return { ok: true, mint, scanned: 0, traders: [] };

  const counts = new Map();
  let scanned = 0;
  for (const sig of sigs) {
    const tx = await rpc.getTransaction(sig);
    scanned += 1;
    if (!tx.ok || !tx.result) continue;
    for (const owner of extractTradersFromTx(tx.result, mint)) {
      if (QUOTE_MINTS.has(owner)) continue;
      counts.set(owner, (counts.get(owner) || 0) + 1);
    }
  }
  const traders = [...counts.entries()]
    .map(([address, swaps_seen]) => ({ address, swaps_seen }))
    .sort((a, b) => b.swaps_seen - a.swaps_seen)
    .slice(0, maxResults);

  return { ok: true, mint, scanned, signatures_seen: sigs.length, traders, provenance: 'on_chain' };
}
