// @soltrade/signer-service-boundary — SignerService Isolation Boundary contract (Gate E / E1).
// Mock / in-memory / deterministic. Never signs, never sends; holds no key material; no crypto/signing
// library; no KeyManager/KMS; no transaction building/serialization; no RPC/provider; no REAL-LIVE; no
// execution authority. signed:false/signature:null/is_valid_on_chain:false/can_sign:false/can_send:false always.
export * from './signer-service-boundary.mjs';
