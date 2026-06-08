# E2-KMS-6 — Provider Config Validation (no SDK) Evidence (report portion)

> **Config-validation / interface-only.** Adds `validateProviderConfig()` to
> `@soltrade/custody-provider-contract`: validation-only, fail-closed, **no SDK, no live provider, no provider
> live calls, no KeyManager, no key material, no signing, no RPC/send, no transaction serialization, no
> dependency, no `ALLOWLIST` change, no REAL-LIVE, no activation.** Introduces no new SSOT/API/DATA/CONFIG name
> (config/result fields are function-param/return properties). Does NOT change readiness.
>
> **State:** `main` @ `eb69674` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']`.

---

## 1. Provider config validation
`validateProviderConfig(config)` → `{ valid, status, reasons[], activated:false, recommended_signer_profile_status?, note }`.
It checks **shape only**; it never contacts a provider, loads an SDK, returns a handle, or activates anything.

## 2. Provider reference model
- `provider_ref` — required **opaque reference string** (not a secret, not an endpoint/URL).
- `key_alias` / `key_id` — optional **opaque reference strings only** (no endpoints/URLs/secrets).
- Any URL/endpoint/RPC/mainnet/prod indicator in a reference → blocked.

## 3. Environment separation model
- `environment` must be **testnet-family** (`devnet`/`testnet`/`localnet`).
- `mainnet`/`mainnet-beta`/`prod` (or any non-testnet value) → **blocked**
  (`mainnet_or_nontestnet_environment_blocked`).
- A mainnet/prod indicator mixed into a testnet config → **mismatch blocked**
  (`env_ref_mismatch_mainnet_in_testnet`).

## 4. Fail-closed behavior
Missing/malformed config → `valid:false`, `recommended_signer_profile_status:'DEGRADED'`. A `valid` shape
(`reference_valid_no_sdk`) **does NOT configure/activate** — `createProviderAdapterSkeleton(...).isConfigured()`
stays `false` and `resolveKeyHandle()` stays fail-closed (`handle:null`, DEGRADED). `activated:false` always.

## 5. Key-material refusal
Key-material-shaped config → `invalid_key_material` (`key_material_not_accepted`), never echoed; the result
carries no `key`/`private`/`seed`/`mnemonic`/`keypair`/`handle`/`raw` field.

## 6. No-live-provider / no-SDK
Package stays **import-free**; no SDK/network/KeyManager/sign; descriptor caps all-false; mechanism guard
fully scans the package (it is outside the allowlist).

## 7. Execution-authority surface
None. No `sign`/`send`/`serialize`/`exportKey`/`loadKey`/`KeyManager`/KMS SDK; validation never activates.

## 8. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS/SEND/REAL-LIVE** unchanged.

## 9. Remaining (separate approvals)
Real KMS-backed adapter (SDK + live provider + activation) — separate implementation PR (signer_control +
two-person rule; B1/B2 provisioning); wiring a configured handle into the sign-only path — separate PR;
send/mainnet/REAL-LIVE — separate later decisions.

---

**Confirmations:** Config-validation/interface only · No KMS/Vault/KeyManager introduced · No private key
material introduced · No provider live calls introduced · No new signing introduced · No RPC/send introduced ·
No transaction serialization introduced · No REAL-LIVE activation · No new execution authority introduced.
