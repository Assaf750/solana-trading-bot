// @soltrade/isolated-signer-runtime — WebCrypto Sign-Only Adapter SKELETON (Gate E / E2-C3-2).
// SOURCE: docs/00-ARCHITECTURE.md §4.3 + docs/09-THREAT-SECURITY §3/§7 + reports/E2-C3-0 (recommended:
//   native WebCrypto Ed25519, sign-only, no RPC/send) + reports/E2-C plan.
//
// SKELETON ONLY — uses WebCrypto as a LOCAL CAPABILITY (support probe) but performs NO project signing. It is
// NOT wired to custody, NOT wired to the preflight gate, and NEVER produces a real signature here. Its
// attemptSign() is ALWAYS fail-closed. The actual ephemeral sign/verify proof lives in tests (test-only).
//
// ABSENT BY DESIGN (and forbidden here): real project/custody signing, third-party crypto libs
// (@solana/web3.js / @noble / tweetnacl / bs58), KMS/vault, KeyManager, key material, transaction
// building/serialisation, signing/sending, RPC/provider, DB, REAL-LIVE, execution authority. This module
// NEVER reads, stores, returns, or exports any private key: the support probe generates an ephemeral key and
// DISCARDS it without touching the private component.

import { webcrypto } from 'node:crypto';
import { refusesKeyMaterial } from '../../custody-provider-contract/src/index.mjs';

const STATUS = 'skeleton';
const BACKEND = 'webcrypto';
const ALGORITHM = 'Ed25519';

// Read-only descriptor. Every execution capability is false; explicitly NOT wired to custody/preflight.
export function describeWebcryptoSigningAdapter() {
  return Object.freeze({
    component: 'isolated-signer-webcrypto-adapter',
    status: STATUS,
    backend: BACKEND,
    algorithm: ALGORITHM,
    can_sign: false,
    can_send: false,
    holds_key_material: false,
    can_export_key: false,
    is_live: false,
    wired_to_custody: false,
    wired_to_preflight: false,
    note: 'E2-C3-2 skeleton: WebCrypto local capability only; NOT wired to custody/preflight; NO project '
      + 'signing; NO key export; real signing requires separate E2-C3 approval.',
  });
}

// LOCAL CAPABILITY PROBE (clearly marked). Detects whether WebCrypto supports the algorithm by attempting a
// key generation and DISCARDING the result — it never accesses, returns, or exports the private component, and
// never signs a project payload. Returns a boolean. No I/O, no logging of secrets.
export async function probeWebcryptoEd25519Support() {
  const subtle = webcrypto && webcrypto.subtle;
  if (!subtle || typeof subtle.generateKey !== 'function') return false;
  try {
    await subtle.generateKey({ name: ALGORITHM }, false, ['sign', 'verify']); // result intentionally discarded
    return true;
  } catch {
    return false;
  }
}

// Create the skeleton adapter. attemptSign() is ALWAYS fail-closed (skeleton, not wired). It refuses
// key-material input and never produces a real signature.
export function createWebcryptoSigningAdapter() {
  return Object.freeze({
    describe: describeWebcryptoSigningAdapter,
    status: STATUS,
    probeSupport: probeWebcryptoEd25519Support,

    attemptSign(request) {
      if (refusesKeyMaterial(request)) {
        return Object.freeze({ ok: false, status: STATUS, signed: false, signature: null, can_send: false, reason: 'key_material_not_accepted' });
      }
      // Skeleton: NOT wired to custody/preflight -> no project signing. Always fail-closed.
      return Object.freeze({ ok: false, status: STATUS, signed: false, signature: null, can_send: false, reason: 'skeleton_not_wired_to_custody_preflight' });
    },
  });
}

export const WEBCRYPTO_SIGNING_ADAPTER_STATUS = STATUS;
