// @soltrade/wallet-rotation — Wallet Rotation orchestration (Gate D / D3). Simulated composite flow.
// In-memory, deterministic; composes C0/C3/D1/D2 by dependency injection. No live transfer/sweep;
// no token transfer; no funding; no signer creation; no admission gate; no KeyManager; no key material;
// no tx build/serialize/sign/send; no RPC; no DB; no REAL-LIVE; no execution authority.
export * from './wallet-rotation.mjs';
