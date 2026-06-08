# E2-KMS-10 — No-SDK Provider Config Hardening Evidence (report portion)

> **No-SDK config-hardening / interface-only.** Hardens `validateProviderConfig()` in
> `@soltrade/custody-provider-contract`: validation-only, fail-closed, **no SDK, no real provider, no provider
> live calls, no KeyManager, no key material, no signing, no RPC/send, no transaction serialization, no
> dependency, no `ALLOWLIST` change, no REAL-LIVE, no activation.** Introduces no new SSOT/API/DATA/CONFIG name
> (result/reason strings are function-return properties). Does NOT change readiness. **NO SDK SELECTED YET.**
>
> **State:** `main` @ `ce9f55b` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']`.

---

## 1. Provider config hardening
`validateProviderConfig(config)` remains validation-only and adds two hardening rules on top of E2-KMS-6:
1. **Unknown-field rejection** — only `provider_ref`/`environment`/`key_alias`/`key_id` are permitted; any other
   field → `unknown_field_rejected`.
2. **Endpoint/live-call indicator block** — any string value containing `https?://`/`wss?://`/`rpc`/`endpoint`/
   `provider_url`/`broadcast`/`send`/`websocket`/`live_call` → `endpoint_or_live_call_indicator_blocked`.

## 2. Provider reference hardening
`provider_ref` required opaque string (no endpoint/URL/mainnet); `key_alias`/`key_id` optional opaque
references; surprise fields rejected; live-call/endpoint values blocked across the whole config.

## 3. Environment separation hardening
`environment ∈ {devnet, testnet, localnet}`; mainnet/prod/non-testnet blocked; mainnet/prod mixed into a
testnet config → `env_ref_mismatch_mainnet_in_testnet`. No cross-environment key reuse implied — references are
env-scoped and never activate.

## 4. Dangerous-field rejection
Unknown fields (e.g. `rpc_endpoint`, `provider_url`, `broadcast`, `send`, arbitrary keys) → rejected;
endpoint/URL/live-call indicators in values (incl. `wss://` and bare `send`) → blocked.

## 5. Fail-closed behavior
A valid shape (`reference_valid_no_sdk`) is **references-only** and `activated:false` — it does **not** configure
or activate anything. `createProviderAdapterSkeleton(...).isConfigured()` stays `false`; `resolveKeyHandle()`
stays fail-closed (`handle:null`, `recommended_signer_profile_status:'DEGRADED'`). No plaintext fallback.

## 6. Key-material refusal
Key-material-shaped config → `invalid_key_material` (`key_material_not_accepted`), never echoed; the result
carries no `key`/`private`/`seed`/`mnemonic`/`keypair`/`handle`/`raw` field.

## 7. No-live-provider / no-SDK
Package stays **import-free**; no SDK/network/KeyManager/sign; mechanism guard fully scans it (outside the
allowlist). **NO SDK SELECTED YET** (per E2-KMS-9); a real SDK/KMS adapter is a separate, explicitly-approved PR.

## 8. Execution-authority surface
None. No `sign`/`send`/`serialize`/`exportKey`/`loadKey`/`KeyManager`/KMS SDK; validation never activates.

## 9. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS/SEND/REAL-LIVE** unchanged.

## 10. Remaining (separate approvals)
SDK selection + real KMS-backed adapter (SDK + live provider + activation) — separate implementation PR
(signer_control + two-person rule; B1/B2 provisioning); wiring a configured handle into the sign-only path —
separate PR; send/mainnet/REAL-LIVE — separate later decisions.

---

**Confirmations:** No-SDK config-hardening only · No KMS/Vault/KeyManager introduced · No private key material
introduced · No provider live calls introduced · No new signing introduced · No RPC/send introduced · No
transaction serialization introduced · No REAL-LIVE activation · No new execution authority introduced.
