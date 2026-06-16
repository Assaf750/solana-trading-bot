// jito-tip-tx.mjs — Jito tip helpers (build the unsigned SystemProgram.transfer tip tx + pick the
// tip in lamports). PURE — no network. These are OWNED by @soltrade/provider-adapters (ADR-0001
// Phase 2D). The PROVIDER_BACKEND legacy in-process helpers were REMOVED in Phase 3B.4 after 3B.3
// proved byte-identical output (selectTipLamports over percentile/floor/cap cases; buildTipTransferTx
// base64 over valid 32-byte keys). buildTipTransferTx is bound to the engine's b58decode so the
// package stays mechanism-pure; selectTipLamports is re-exported unchanged.
import { b58decode } from './base58.mjs';
import { makeTipTransferBuilder, selectTipLamports } from '../../../../packages/provider-adapters/src/index.mjs';

export const buildTipTransferTx = makeTipTransferBuilder(b58decode);
export { selectTipLamports };
