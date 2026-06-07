// @soltrade/real-live-readiness — REAL-LIVE Readiness Checklist Evaluator (Gate E / E0).
// Pure, in-memory, deterministic. Aggregates existing signals into a readiness verdict + blockers.
// Prerequisite for activate_real_live; does NOT activate. No KeyManager; no key material; no signing/
// sending; no transaction building/serialization; no RPC/provider; no DB; no REAL-LIVE; no execution authority.
export * from './real-live-readiness.mjs';
