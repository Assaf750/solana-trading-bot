// jupiter-client.mjs — Jupiter quote client (quote / usdValueOf / paperBuy / swapTransaction).
// Jupiter calls are OWNED by @soltrade/provider-adapters (ADR-0001 Phase 2D). The PROVIDER_BACKEND
// legacy in-process client was REMOVED in Phase 3B.4 after 3B.3 proved byte-identical parity
// (quote / usdValueOf over a shared global-fetch mock). The server injects USDC_MINT + fetch into the
// package provider, which keeps the 1 req/sec rate limiter and the api.jup.ag / lite endpoint logic.
import { USDC_MINT } from './swap-detector.mjs';
import { createJupiterProvider } from '../../../../packages/provider-adapters/src/index.mjs';

export function createJupiterClient(args) {
  return createJupiterProvider({ ...args, usdcMint: USDC_MINT, request: (u, o) => fetch(u, o) });
}
