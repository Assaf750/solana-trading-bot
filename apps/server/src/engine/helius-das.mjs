// helius-das.mjs — thin wrapper over the Helius DAS getAsset RPC method, used ONLY to enrich
// token display metadata (name/symbol/logo) for mints the Jupiter token list doesn't cover yet
// (e.g. brand-new pump.fun launches). Helius-only: on a non-Helius RPC the method errors and
// every call returns null, so callers degrade to the short mint. Never on the trading path.
export function createDas({ rpc }) {
  async function getAssetMeta(mint) {
    if (!rpc || typeof rpc.rpc !== 'function' || !mint) return null;
    const r = await rpc.rpc('getAsset', { id: mint }); // DAS params are an object, not an array
    if (!r.ok || !r.result) return null;
    const md = r.result.content?.metadata || {};
    const links = r.result.content?.links || {};
    const symbol = md.symbol || null;
    const name = md.name || null;
    if (!symbol && !name) return null;
    return { symbol, name, icon: links.image || null };
  }
  return { getAssetMeta };
}
