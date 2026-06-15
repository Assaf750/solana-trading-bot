// @soltrade/provider-adapters — Helius DAS provider (ADR-0001 Phase 2D).
// Byte-for-byte port of apps/server engine/helius-das.mjs. Helius-only metadata enrichment; on a
// non-Helius RPC the method errors and every call returns null (callers degrade to the short mint).
export function createHeliusProvider({ rpc } = {}) {
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
