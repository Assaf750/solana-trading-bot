// market-filters.mjs — optional, quality (NOT fail-closed) entry filters that read cheap
// on-chain market data:
//   - FDV  = total token supply (getTokenSupply) × the USD price/token from the entry quote.
//   - min holders = a cheap "at least N token accounts" check via the Helius DAS getTokenAccounts
//     (a strong concentration/anti-rug proxy; Helius-only).
// Off unless configured. When the data can't be read each filter SKIPS (allows) rather than
// blocks — these are quality gates, not the fail-closed anti-rug safety screen.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

export async function checkMarketFilters({ mint, rpc, cfg, priceUsdPerToken }) {
  const mf = cfg?.market_filters || {};
  const minFdv = num(mf.min_fdv_usd);
  const maxFdv = num(mf.max_fdv_usd);
  const minHolders = num(mf.min_holders);
  const wantFdv = Number.isFinite(minFdv) || Number.isFinite(maxFdv);
  const wantHolders = Number.isFinite(minHolders) && minHolders > 0;
  if (!wantFdv && !wantHolders) return { ok: true, reasons: [], skipped: [] };

  const reasons = [];
  const skipped = [];

  if (wantFdv) {
    const s = rpc ? await rpc.rpc('getTokenSupply', [mint, { commitment: 'confirmed' }]) : { ok: false };
    const supplyUi = s.ok ? Number(s.result?.value?.uiAmount) : NaN;
    if (Number.isFinite(supplyUi) && supplyUi > 0 && Number.isFinite(priceUsdPerToken) && priceUsdPerToken > 0) {
      const fdv = supplyUi * priceUsdPerToken;
      if (Number.isFinite(minFdv) && fdv < minFdv) reasons.push(`fdv_${Math.round(fdv)}_below_min_${minFdv}`);
      if (Number.isFinite(maxFdv) && fdv > maxFdv) reasons.push(`fdv_${Math.round(fdv)}_above_max_${maxFdv}`);
    } else {
      skipped.push('fdv_data_unavailable');
    }
  }

  if (wantHolders) {
    // DAS getTokenAccounts (Helius): request up to minHolders accounts; fewer back => fewer holders.
    const lim = Math.min(1000, Math.ceil(minHolders));
    const ta = rpc ? await rpc.rpc('getTokenAccounts', { mint, limit: lim, page: 1 }) : { ok: false };
    const accts = ta.ok ? ta.result?.token_accounts : null;
    if (Array.isArray(accts)) {
      if (accts.length < minHolders) reasons.push(`holders_${accts.length}_below_min_${minHolders}`);
    } else {
      skipped.push('holders_data_unavailable'); // non-Helius / error -> allow (quality filter)
    }
  }

  return { ok: reasons.length === 0, reasons, skipped };
}
