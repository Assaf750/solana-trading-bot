// @soltrade/provider-adapters — Jupiter provider (ADR-0001 Phase 2D).
// Byte-for-byte port of apps/server engine/jupiter-client.mjs. USDC_MINT is injected (usdcMint)
// so the package does not import the engine's swap-detector; it defaults to the canonical mint.

const LITE_BASE = 'https://lite-api.jup.ag/swap/v1';
const PRO_BASE = 'https://api.jup.ag/swap/v1';
const USDC_DEFAULT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// `request` is the injected HTTP transport (fetch-compatible: (url, opts) => Response). Injected so
// the package stays free of live network primitives (mechanism-guard pure); the server passes fetch.
export function createJupiterProvider({ getApiKey, health, usdcMint = USDC_DEFAULT, request } = {}) {
  const USDC_MINT = usdcMint;
  let last = 0;
  let chain = Promise.resolve();

  function throttled(fn) {
    chain = chain.then(async () => {
      const wait = Math.max(0, 1100 - (Date.now() - last));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
      return fn();
    });
    return chain;
  }

  async function quote({ inputMint, outputMint, amountBaseUnits, slippageBps = 100 }) {
    return throttled(async () => {
      const t0 = Date.now();
      const rec = (r) => {
        if (health) { const up = r.ok || r.error === 'quote_no_route'; health.record('jupiter', up, Date.now() - t0, up ? null : r.error); }
        return r;
      };
      const key = typeof getApiKey === 'function' ? getApiKey() : null;
      const base = key ? PRO_BASE : LITE_BASE;
      const url = `${base}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${Math.floor(amountBaseUnits)}&slippageBps=${slippageBps}&swapMode=ExactIn`;
      const headers = key ? { 'x-api-key': key } : {};
      let attempt = 0;
      while (attempt < 3) {
        attempt += 1;
        try {
          const res = await request(url, { headers, signal: AbortSignal.timeout(8000) });
          if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
          if (!res.ok) return rec({ ok: false, error: `quote_http_${res.status}` });
          const j = await res.json();
          const outAmount = Number(j?.outAmount);
          if (!Number.isFinite(outAmount) || outAmount <= 0) return rec({ ok: false, error: 'quote_no_route' });
          const inAmount = Number(j?.inAmount);
          const priceImpactPct = Number(j?.priceImpactPct ?? 0) * 100;
          return rec({
            ok: true,
            inAmount: Number.isFinite(inAmount) ? inAmount : 0,
            outAmount,
            priceImpactPct: Number.isFinite(priceImpactPct) ? priceImpactPct : 0,
            routePlan: Array.isArray(j.routePlan) ? j.routePlan.length : 0,
            raw: j,
          });
        } catch (e) {
          if (attempt >= 3) return rec({ ok: false, error: `quote_failed_${String(e?.name || 'err')}` });
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      return rec({ ok: false, error: 'quote_retries_exhausted' });
    });
  }

  async function usdValueOf({ mint, qtyUi, decimals, slippageBps = 100 }) {
    if (mint === USDC_MINT) return { ok: true, usd: qtyUi, priceImpactPct: 0 };
    const amountBase = Math.floor(qtyUi * 10 ** decimals);
    if (amountBase <= 0) return { ok: false, error: 'zero_amount' };
    const q = await quote({ inputMint: mint, outputMint: USDC_MINT, amountBaseUnits: amountBase, slippageBps });
    if (!q.ok) return q;
    return { ok: true, usd: q.outAmount / 1e6, priceImpactPct: q.priceImpactPct };
  }

  async function paperBuy({ mint, sizeUsd, slippageBps }) {
    const q = await quote({ inputMint: USDC_MINT, outputMint: mint, amountBaseUnits: Math.floor(sizeUsd * 1e6), slippageBps });
    if (!q.ok) return q;
    return { ok: true, outAmountBase: q.outAmount, priceImpactPct: q.priceImpactPct };
  }

  async function swapTransaction({ quoteRaw, userPublicKey }) {
    return throttled(async () => {
      const key = typeof getApiKey === 'function' ? getApiKey() : null;
      const base = key ? PRO_BASE : LITE_BASE;
      try {
        const res = await request(`${base}/swap`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
          body: JSON.stringify({
            quoteResponse: quoteRaw,
            userPublicKey,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto',
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { ok: false, error: `swap_http_${res.status}` };
        const j = await res.json();
        if (!j?.swapTransaction) return { ok: false, error: 'swap_no_transaction' };
        return { ok: true, txBase64: j.swapTransaction };
      } catch (e) {
        return { ok: false, error: `swap_failed_${String(e?.name || 'err')}` };
      }
    });
  }

  return { quote, usdValueOf, paperBuy, swapTransaction };
}
