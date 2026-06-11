// jupiter-client.mjs — Jupiter quote client with a 1 req/sec rate limiter (provider
// budgets respected). Uses the owner's api.jup.ag key when configured; otherwise the
// free lite endpoint. Quotes only in M3 (no swap execution here).
import { USDC_MINT } from './swap-detector.mjs';

const LITE_BASE = 'https://lite-api.jup.ag/swap/v1';
const PRO_BASE = 'https://api.jup.ag/swap/v1';

export function createJupiterClient({ getApiKey }) {
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
      const key = typeof getApiKey === 'function' ? getApiKey() : null;
      const base = key ? PRO_BASE : LITE_BASE;
      const url = `${base}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${Math.floor(amountBaseUnits)}&slippageBps=${slippageBps}&swapMode=ExactIn`;
      const headers = key ? { 'x-api-key': key } : {};
      let attempt = 0;
      // bounded retry with backoff (never infinite)
      while (attempt < 3) {
        attempt += 1;
        try {
          const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
          if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
          if (!res.ok) return { ok: false, error: `quote_http_${res.status}` };
          const j = await res.json();
          if (!j?.outAmount) return { ok: false, error: 'quote_no_route' };
          return {
            ok: true,
            inAmount: Number(j.inAmount),
            outAmount: Number(j.outAmount),
            priceImpactPct: Number(j.priceImpactPct ?? 0) * 100,
            routePlan: Array.isArray(j.routePlan) ? j.routePlan.length : 0,
          };
        } catch (e) {
          if (attempt >= 3) return { ok: false, error: `quote_failed_${String(e?.name || 'err')}` };
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      return { ok: false, error: 'quote_retries_exhausted' };
    });
  }

  /** USD value of qty (ui units) of a token, via token -> USDC quote. */
  async function usdValueOf({ mint, qtyUi, decimals }) {
    if (mint === USDC_MINT) return { ok: true, usd: qtyUi, priceImpactPct: 0 };
    const amountBase = Math.floor(qtyUi * 10 ** decimals);
    if (amountBase <= 0) return { ok: false, error: 'zero_amount' };
    const q = await quote({ inputMint: mint, outputMint: USDC_MINT, amountBaseUnits: amountBase });
    if (!q.ok) return q;
    return { ok: true, usd: q.outAmount / 1e6, priceImpactPct: q.priceImpactPct };
  }

  /** Simulated buy: spend sizeUsd of USDC into the token. Returns expected qty + impact. */
  async function paperBuy({ mint, sizeUsd, slippageBps }) {
    const q = await quote({ inputMint: USDC_MINT, outputMint: mint, amountBaseUnits: Math.floor(sizeUsd * 1e6), slippageBps });
    if (!q.ok) return q;
    return { ok: true, outAmountBase: q.outAmount, priceImpactPct: q.priceImpactPct };
  }

  return { quote, usdValueOf, paperBuy };
}
