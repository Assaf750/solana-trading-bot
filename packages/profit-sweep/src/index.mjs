// @soltrade/profit-sweep — Profit Sweep orchestration (Gate D / D2). Simulated, owner-bound, candidate.
// In-memory, deterministic. No actual sweep; no token transfer; no tx build/serialize/sign/send;
// no KeyManager; no key material; no RPC; no DB; no rotation; no new asset_transfer_intents;
// no REAL-LIVE; no execution authority; no UX/API/Opportunity-Radar exposure. candidate_ preserved.
export * from './profit-sweep.mjs';
