// @soltrade/isolated-signer-runtime — Custody Lifecycle WIRING with STUB provider (Gate E / E2-B).
// SOURCE: docs/00-ARCHITECTURE.md §4.3 (SignerService isolation) + docs/09-THREAT-SECURITY §3/§4/§7
//   (fail-closed DEGRADED, zeroization, least-privilege) + reports/E2-IMPLEMENTATION-PLAN (E2-B).
//
// STUB WIRING ONLY. This wires the existing keyless custody lifecycle (E2-0) to the custody provider
// CONTRACT/STUB (E2-A) inside the allowlisted isolated-signer path. The provider is ALWAYS "unconfigured",
// so load/use can NEVER succeed: every attempt is fail-closed and maps to a recommended DEGRADED status.
//
// ABSENT BY DESIGN (and forbidden here): real custody provider integration, KeyManager, crypto/signing
// library, key material, transaction building/serialisation, signing/sending, RPC/provider calls, DB writes,
// REAL-LIVE activation, execution authority. No signature is ever produced. Key-material input is refused.

import { createKeylessCustodyLifecycle } from '../../keyless-custody-lifecycle/src/index.mjs';
import { selectCustodyProvider, refusesKeyMaterial } from '../../custody-provider-contract/src/index.mjs';

const STATUS = 'stub_wiring';
const PROVIDER_UNCONFIGURED = 'unconfigured';

// Read-only descriptor for the wiring. Every execution-bearing capability stays false: this is wiring over a
// stub provider, not an implementation. No signing, no key, no send.
export function describeCustodyLifecycle() {
  return Object.freeze({
    component: 'isolated-signer-custody-lifecycle-wiring',
    status: STATUS,
    provider_status: PROVIDER_UNCONFIGURED,
    can_sign: false,
    can_send: false,
    has_key_material: false,
    is_live: false,
    note: 'E2-B stub wiring: keyless lifecycle + unconfigured custody provider stub. Fail-closed; no signing, '
      + 'no key, no send, no provider integration, no execution authority.',
  });
}

// Create the wired isolated-signer custody lifecycle. Delegates ALL validation, least-privilege (per
// signer_profile_id), zeroize/revoke/disable/shutdown/panic, and key-material refusal to the keyless
// lifecycle. The provider selection stub forces custody availability to false (unconfigured) so no load/use
// can ever succeed.
export function createIsolatedCustodyLifecycle({ auditLog } = {}) {
  const keyless = createKeylessCustodyLifecycle({ auditLog });

  // Resolve the custody provider. With the E2-A stub this is ALWAYS unconfigured -> not available.
  function resolveAvailability(request) {
    const selection = request && typeof request === 'object' ? request.provider_selection : undefined;
    const selected = selectCustodyProvider(selection);
    // available only if a configured provider were returned (never true with the stub)
    return selected.ok === true && selected.status !== PROVIDER_UNCONFIGURED;
  }

  // Defence-in-depth: refuse key-material-shaped input before anything else (keyless also refuses).
  function refuseEarly(request) {
    if (refusesKeyMaterial(request)) {
      return Object.freeze({
        ok: false,
        signed: false,
        signature: null,
        can_sign: false,
        can_send: false,
        refusal_reason: 'key_material_not_accepted',
        provider_status: PROVIDER_UNCONFIGURED,
      });
    }
    return null;
  }

  // Build the request handed to the keyless lifecycle. custody availability is dictated by the provider stub
  // (always false), and can NEVER be forced true by the caller.
  function withProviderAvailability(request) {
    const base = request && typeof request === 'object' ? request : {};
    return { ...base, custody_available: resolveAvailability(request) };
  }

  return Object.freeze({
    describeCustodyLifecycle,
    provider_status: PROVIDER_UNCONFIGURED,

    // Wired load: provider unconfigured -> keyless returns fail-closed DEGRADED. No key, no signature.
    requestLoad(request = {}) {
      const refused = refuseEarly(request);
      if (refused) return refused;
      return keyless.requestLoad(withProviderAvailability(request));
    },

    // Wired use: requires LOADED (never reachable with the stub) -> fail-closed. No signature ever.
    use(request = {}) {
      const refused = refuseEarly(request);
      if (refused) return refused;
      return keyless.use(withProviderAvailability(request));
    },

    // Custody failure -> fail-closed DEGRADED (delegated).
    reportCustodyFailure(request = {}) { return keyless.reportCustodyFailure(request); },

    // Zeroize / revoke / disable / shutdown / panic -> delegated (idempotent zeroize; least-privilege).
    zeroize(signer_profile_id, ctx = {}) { return keyless.zeroize(signer_profile_id, ctx); },
    revoke(signer_profile_id, ctx = {}) { return keyless.revoke(signer_profile_id, ctx); },
    disable(signer_profile_id, ctx = {}) { return keyless.disable(signer_profile_id, ctx); },
    shutdown(ctx = {}) { return keyless.shutdown(ctx); },
    panic(ctx = {}) { return keyless.panic(ctx); },

    get(signer_profile_id) { return keyless.get(signer_profile_id); },
    list() { return keyless.list(); },
    auditLog: keyless.auditLog,
    // No sign(). No send(). No serialise(). No provider integration. By design.
  });
}

export const CUSTODY_LIFECYCLE_WIRING_STATUS = STATUS;
