// @soltrade/custody-provider-contract — Custody Provider CONTRACT + STUB (Gate E / E2-A).
// SOURCE: docs/00-ARCHITECTURE.md §4.3 (SignerService isolation) + docs/09-THREAT-SECURITY §2/§3/§7 +
// reports/E2-IMPLEMENTATION-PLAN (E2-A: adapter interface / provider-selection stub).
//
// CONTRACT/STUB ONLY — there is NO live mechanism here. This module describes what a custody provider MUST
// be (an opaque component that NEVER exports keys and is fail-closed) and ships a provider-selection STUB
// that always resolves to an "unconfigured" provider. It performs no work.
//
// ABSENT BY DESIGN (and forbidden here): KMS/vault client, KeyManager, crypto/signing library, key material
// (private key / seed / mnemonic / keypair), transaction building/serialisation, signing/sending,
// RPC/provider calls, DB access, REAL-LIVE activation, execution authority. The opaque handle below is a
// plain label string, not a key and not a credential.

const UNCONFIGURED = 'unconfigured';

// Is the given input "key-material-shaped"? Used ONLY to REFUSE such input — never to accept/store/return it.
// Heuristic, conservative: strings that look like PEM, a long base58 blob, or a multi-word mnemonic, or any
// object that advertises secret/key fields. The contract refuses the whole call rather than inspect deeply.
function looksLikeKeyMaterial(input) {
  if (input == null) return false;
  if (typeof input === 'string') {
    const s = input.trim();
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) return true;       // PEM private key
    if (/^[1-9A-HJ-NP-Za-km-z]{64,}$/.test(s)) return true;              // long base58 blob
    if (s.split(/\s+/).length >= 12) return true;                        // mnemonic-length word list
    return false;
  }
  if (typeof input === 'object') {
    // refuse any object that exposes a secret/key-bearing field
    for (const k of Object.keys(input)) {
      if (/secret|private|seed|mnemonic|keypair|key_material|raw_key/i.test(k)) return true;
    }
  }
  return false;
}

// A frozen fail-closed result. `ok` is always false; `status` is always "unconfigured".
function failClosed(operation, reason) {
  return Object.freeze({
    ok: false,
    status: UNCONFIGURED,
    operation,
    reason: reason || 'custody provider is not configured (contract/stub only)',
  });
}

// The CONTRACT descriptor: what any conforming custody provider must expose, with every execution-bearing
// capability pinned to false. Read-only; describes intent, performs nothing.
export function describeCustodyProviderContract() {
  return Object.freeze({
    contract: 'custody-provider',
    version: '0.0.0',
    // capabilities — all false by construction (this is a contract/stub, not an implementation)
    can_export_key: false,    // a conforming provider must NEVER export key material
    holds_key_material: false, // this contract/stub holds none
    can_sign: false,
    can_send: false,
    accepts_key_material_input: false, // inputs that look like key material are refused
    is_live: false,
    status: UNCONFIGURED,
    // the operations a provider exposes — here all resolve fail-closed
    operations: Object.freeze(['describe', 'health', 'use', 'resolveKeyHandle']),
    key_handle: describeKeyHandleContract(), // the opaque key-handle interface (E2-KMS-1)
    note: 'Contract + stub only (E2-A; key-handle interface E2-KMS-1). Opaque provider; never exports keys; '
      + 'fail-closed. No KMS/vault, no KeyManager, no crypto, no key material, no signing/sending, no RPC/DB, '
      + 'no execution authority.',
  });
}

// ---- E2-KMS-1: opaque key-handle INTERFACE (no real handle, no signing, no export) ----

const KEY_HANDLE_KIND = 'key-handle';

// Describes the CONTRACT any custody/KMS key handle MUST satisfy: opaque, non-exportable, no raw private key,
// no seed/mnemonic/keypair, no export method, no signing method. This is an interface descriptor ONLY — there
// is no real handle here, and resolution is always fail-closed (a real KMS adapter is a separate PR).
export function describeKeyHandleContract() {
  return Object.freeze({
    kind: KEY_HANDLE_KIND,
    opaque: true,                  // callers only ever hold an opaque reference, never key bytes
    exportable: false,             // a conforming handle is NON-exportable
    can_export_key: false,         // no export method exists
    holds_raw_private_key: false,  // never exposes a raw private key
    accepts_key_material_input: false, // raw key/seed/mnemonic/keypair input is refused
    can_sign: false,               // signing is NOT part of this PR; a real adapter is separate
    is_live: false,
    status: UNCONFIGURED,
    note: 'Key-handle INTERFACE only (E2-KMS-1). Opaque, non-exportable; never exposes a raw private key; no '
      + 'seed/mnemonic/keypair; no export method; no signing here; no KMS SDK; no network. Real KMS adapter '
      + 'is a separate, explicitly-approved PR.',
  });
}

// A fail-closed key-handle resolution result. There is NO handle (null) until a real provider is configured,
// and any custody/KMS unavailability maps to a DEGRADED recommendation.
function failClosedHandle(reason) {
  return Object.freeze({
    ok: false,
    status: UNCONFIGURED,
    handle: null,                 // no handle: nothing is configured (real adapter = separate PR)
    can_sign: false,
    can_export_key: false,
    reason,
    recommended_signer_profile_status: 'DEGRADED', // fail-closed: never sign on unverified/unavailable custody
  });
}

// Resolve a custody key handle. Fail-closed: with no real provider configured this ALWAYS returns no handle
// and a DEGRADED recommendation. Refuses key-material input. No KMS SDK, no network, no signing.
export function resolveCustodyKeyHandle(selection) {
  if (looksLikeKeyMaterial(selection)) return failClosedHandle('key_material_not_accepted');
  return failClosedHandle('no_key_handle_unconfigured_provider');
}

// An "unconfigured" custody provider: an opaque object whose every operation is fail-closed and which refuses
// any key-material input. It cannot sign, cannot send, cannot export keys, and holds nothing.
export function createUnconfiguredCustodyProvider() {
  const provider = {
    status: UNCONFIGURED,
    isConfigured() { return false; },
    describe() { return describeCustodyProviderContract(); },
    describeKeyHandle() { return describeKeyHandleContract(); },
    health() { return failClosed('health', 'no provider configured'); },
    // `use` is the single generic operation a future provider would expose; here it always fails closed and
    // refuses key-material input. It NEVER accepts, stores, or returns key material.
    use(request) {
      if (looksLikeKeyMaterial(request)) {
        return Object.freeze({ ok: false, status: UNCONFIGURED, operation: 'use', reason: 'key material refused' });
      }
      return failClosed('use', 'no provider configured');
    },
    // resolveKeyHandle resolves an OPAQUE key handle — always fail-closed here (no real provider). Never
    // returns a key; maps to DEGRADED. A real KMS-backed handle is a separate PR.
    resolveKeyHandle(request) { return resolveCustodyKeyHandle(request); },
  };
  return Object.freeze(provider);
}

// Provider-selection STUB. Whatever is requested, with nothing configured it ALWAYS resolves to the
// unconfigured (fail-closed) provider. It never returns a live/configured provider and never imports a SDK.
export function selectCustodyProvider(selection) {
  if (looksLikeKeyMaterial(selection)) {
    // selection input must be a reference/label only — never key material
    return Object.freeze({
      ok: false,
      status: UNCONFIGURED,
      reason: 'key material refused in provider selection',
      provider: createUnconfiguredCustodyProvider(),
    });
  }
  return Object.freeze({
    ok: false,
    status: UNCONFIGURED,
    reason: 'no custody provider configured (E2-A contract/stub only)',
    provider: createUnconfiguredCustodyProvider(),
  });
}

// ---- E2-KMS-4: provider adapter SKELETON (no SDK, fail-closed) ----

// A contract-shaped provider adapter SKELETON. It has NO SDK, NO network, NO live provider, and NO key
// material. It is NEVER configured (a real KMS-backed adapter is a separate PR), so `isConfigured()` is always
// false and `resolveKeyHandle()` is always fail-closed (no handle, DEGRADED). `config` is reference-only: it is
// inspected only to refuse key material and to report a status; it is never used to contact anything.
export function createProviderAdapterSkeleton(config) {
  const configHasKeyMaterial = looksLikeKeyMaterial(config);
  const hasRef = config != null && typeof config === 'object'
    && typeof config.provider_ref === 'string' && config.provider_ref.length > 0;
  // a reference may be present, but there is NO SDK -> still not configured; key material in config is invalid.
  const config_status = configHasKeyMaterial ? 'invalid_key_material' : (hasRef ? 'reference_present_no_sdk' : 'unconfigured');

  return Object.freeze({
    is_skeleton: true,
    has_sdk: false,
    config_status,
    isConfigured() { return false; }, // skeleton has no SDK; never configured

    describe() {
      return Object.freeze({
        contract: 'custody-provider',
        adapter: 'skeleton',
        is_skeleton: true,
        has_sdk: false,
        can_export_key: false,
        holds_raw_private_key: false,
        can_sign: false,
        is_live: false,
        status: UNCONFIGURED,
        config_status,
        note: 'E2-KMS-4 provider adapter SKELETON: contract-shaped, fail-closed; NO SDK, NO network, NO live '
          + 'provider, NO key material, NO signing, NO export. Real KMS-backed adapter is a separate PR.',
      });
    },

    describeKeyHandle() { return describeKeyHandleContract(); },

    // Always fail-closed: refuses key material, refuses invalid config, and (with no SDK) never resolves a
    // real handle. Returns no handle + a DEGRADED recommendation.
    resolveKeyHandle(request) {
      if (looksLikeKeyMaterial(request)) return failClosedHandle('key_material_not_accepted');
      if (configHasKeyMaterial) return failClosedHandle('config_invalid_key_material');
      return failClosedHandle('skeleton_no_sdk');
    },
  });
}

// Explicit predicate the rest of the system can use to assert refusal behaviour in tests/diagnostics.
export function refusesKeyMaterial(input) {
  return looksLikeKeyMaterial(input);
}

export const CUSTODY_PROVIDER_CONTRACT_STATUS = UNCONFIGURED;
export const CUSTODY_KEY_HANDLE_KIND = KEY_HANDLE_KIND;
