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
    operations: Object.freeze(['describe', 'health', 'use']),
    note: 'Contract + stub only (E2-A). Opaque provider; never exports keys; fail-closed. No KMS/vault, no '
      + 'KeyManager, no crypto, no key material, no signing/sending, no RPC/DB, no execution authority.',
  });
}

// An "unconfigured" custody provider: an opaque object whose every operation is fail-closed and which refuses
// any key-material input. It cannot sign, cannot send, cannot export keys, and holds nothing.
export function createUnconfiguredCustodyProvider() {
  const provider = {
    status: UNCONFIGURED,
    isConfigured() { return false; },
    describe() { return describeCustodyProviderContract(); },
    health() { return failClosed('health', 'no provider configured'); },
    // `use` is the single generic operation a future provider would expose; here it always fails closed and
    // refuses key-material input. It NEVER accepts, stores, or returns key material.
    use(request) {
      if (looksLikeKeyMaterial(request)) {
        return Object.freeze({ ok: false, status: UNCONFIGURED, operation: 'use', reason: 'key material refused' });
      }
      return failClosed('use', 'no provider configured');
    },
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

// Explicit predicate the rest of the system can use to assert refusal behaviour in tests/diagnostics.
export function refusesKeyMaterial(input) {
  return looksLikeKeyMaterial(input);
}

export const CUSTODY_PROVIDER_CONTRACT_STATUS = UNCONFIGURED;
