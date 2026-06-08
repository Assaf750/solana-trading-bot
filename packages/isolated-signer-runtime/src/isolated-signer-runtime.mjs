// @soltrade/isolated-signer-runtime — Isolated Signer Runtime SKELETON (Gate E / E2-1).
// SOURCE: docs/00-ARCHITECTURE.md §4.3 (SignerService isolation) + docs/09-THREAT-SECURITY §3/§4.
//
// SKELETON ONLY — no behavior, no keys, no live mechanism. This is the declared isolated-signer path
// (PR-H4 `DECLARED_ALLOWLIST_PATHS`), now created as an EMPTY, SAFE placeholder. It is NOT activated in
// the mechanism guard's ALLOWLIST (which stays []), so this source is fully scanned and any live
// mechanism added here WOULD be rejected until a future, separately-approved PR activates the path.
//
// FORBIDDEN HERE (and absent): KMS/secret-vault, KeyManager, key custody, private key/seed/keypair/
// mnemonic, crypto/signing library, transaction building/serialization, signing/sending, RPC/provider,
// live transfer/sweep/funding, DB writes, REAL-LIVE activation, execution authority. There is NO key
// material and NO signing authority here.

const STATUS = 'skeleton';

// Capabilities — all false by construction. This runtime cannot sign or send anything; it holds no key.
export function capabilities() {
  return Object.freeze({
    can_sign: false,
    can_send: false,
    has_key_material: false,
    live_mechanisms: false,
    allowlisted: false, // not activated in the mechanism guard's ALLOWLIST
    status: STATUS,
  });
}

// A read-only description of the isolation boundary intent. Text/status only — no behavior.
export function describeIsolationBoundary() {
  return Object.freeze({
    status: STATUS,
    note: 'Isolated signer runtime skeleton (Gate E / E2-1): declared path, no live mechanism, no key, no signing authority. Not activated in ALLOWLIST.',
    ...capabilities(),
  });
}

export const ISOLATED_SIGNER_RUNTIME_STATUS = STATUS;
