// helius-das.mjs — thin wrapper over the Helius DAS getAsset RPC method, used ONLY to enrich
// token display metadata (name/symbol/logo) for mints the Jupiter token list doesn't cover yet
// (e.g. brand-new pump.fun launches). Helius-only: on a non-Helius RPC the method errors and
// every call returns null, so callers degrade to the short mint. Never on the trading path.
//
// DAS metadata is OWNED by @soltrade/provider-adapters (ADR-0001 Phase 2D). The PROVIDER_BACKEND
// legacy in-process resolver was REMOVED in Phase 3B.4 after 3B.3 proved byte-identical getAssetMeta
// output (hit / miss / bad rpc) over an injected stub rpc client.
import { createHeliusProvider } from '../../../../packages/provider-adapters/src/index.mjs';

export function createDas(args) {
  return createHeliusProvider(args);
}
