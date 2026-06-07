// @soltrade/asset-transfer-intents — Asset Transfer Intent state machine + simulated ownership flip (D1).
// Simulated, in-memory, deterministic. No live transfer; no transfer-boundary; no token transfer;
// no tx build/serialize/sign/send; no KeyManager; no key material; no RPC; no DB; no rotation/sweep;
// no REAL-LIVE; no execution authority.
export * from './asset-transfer-intents.mjs';
