// market-filters.mjs — optional, quality (NOT fail-closed) entry filters that read cheap
// on-chain market data. FDV = total token supply (getTokenSupply) × the USD price/token derived
// from the entry quote. Off unless configured. When the data can't be read these filters SKIP
// (allow) rather than block — they're quality gates, not the fail-closed anti-rug safety screen.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

export async function checkMarketFilters({ mint, rpc, cfg, priceUsdPerToken }) {
  const mf = cfg?.market_filters || {};
  const minFdv = num(mf.min_fdv_usd);
  const maxFdv = num(mf.max_fdv_usd);
  if (!Number.isFinite(minFdv) && !Number.isFinite(maxFdv)) return { ok: true, reasons: [], skipped: [] };

  const reasons = [];
  const skipped = [];
  const s = rpc ? await rpc.rpc('getTokenSupply', [mint, { commitment: 'confirmed' }]) : { ok: false };
  const supplyUi = s.ok ? Number(s.result?.value?.uiAmount) : NaN;
  if (Number.isFinite(supplyUi) && supplyUi > 0 && Number.isFinite(priceUsdPerToken) && priceUsdPerToken > 0) {
    const fdv = supplyUi * priceUsdPerToken;
    if (Number.isFinite(minFdv) && fdv < minFdv) reasons.push(`fdv_${Math.round(fdv)}_below_min_${minFdv}`);
    if (Number.isFinite(maxFdv) && fdv > maxFdv) reasons.push(`fdv_${Math.round(fdv)}_above_max_${maxFdv}`);
  } else {
    skipped.push('fdv_data_unavailable'); // can't read supply/price -> allow (quality filter)
  }
  return { ok: reasons.length === 0, reasons, skipped };
}
