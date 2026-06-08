// @soltrade/keyless-custody-lifecycle — Keyless Custody Lifecycle Model (Gate E / E2-0).
// Mock / in-memory / deterministic — NO KEYS. Models custody load/use/zeroize lifecycle, fail-closed
// DEGRADED, least-privilege, revoke/disable/shutdown/panic. No key material; no KMS/vault; no KeyManager;
// no crypto/signing library; no tx build/serialize; no signing/sending; no RPC; no DB; no REAL-LIVE;
// no mechanism-guard carve-out; no execution authority.
export * from './keyless-custody-lifecycle.mjs';
