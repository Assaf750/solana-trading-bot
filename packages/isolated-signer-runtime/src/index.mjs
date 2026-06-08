// @soltrade/isolated-signer-runtime — Isolated Signer Runtime (Gate E).
// E2-1 skeleton (capabilities all-false) + E2-B custody lifecycle WIRING over the E2-A custody provider
// STUB. Still NO signing, NO key material, NO live provider integration, NO execution authority: the stub
// provider is always "unconfigured", so custody load/use are fail-closed (DEGRADED). The path is activated
// in the mechanism guard's ALLOWLIST (B8), but key material stays HARD-forbidden even here.
export * from './isolated-signer-runtime.mjs';
export * from './custody-lifecycle-wiring.mjs';
export * from './signing-preflight-gate.mjs';
