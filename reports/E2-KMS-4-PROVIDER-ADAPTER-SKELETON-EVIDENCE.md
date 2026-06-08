# E2-KMS-4 — Provider Adapter Skeleton (no SDK) Evidence (report portion)

> **Skeleton/interface-only.** Adds a contract-shaped, fail-closed provider adapter SKELETON to
> `@soltrade/custody-provider-contract`. **No SDK, no real provider, no provider live calls, no KeyManager, no
> key material, no signing, no export, no RPC/send, no transaction serialization, no dependency, no
> `ALLOWLIST` change, no REAL-LIVE.** Introduces no new SSOT/API/DATA/CONFIG name (descriptor/result/config
> fields are function-return/param properties). Does NOT change readiness.
>
> **State:** `main` @ `08ee07f` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']`.

---

## 1. Provider adapter skeleton
`createProviderAdapterSkeleton(config)` → `{ is_skeleton:true, has_sdk:false, config_status, isConfigured()->false,
describe(), describeKeyHandle(), resolveKeyHandle(request) }`. Contract-shaped; no SDK; no network; no live
provider; no key material; **no `sign`/`exportKey` methods**.

## 2. Fail-closed behavior
`isConfigured()` is always `false` (no SDK). `resolveKeyHandle()` always returns
`{ ok:false, status:'unconfigured', handle:null, can_sign:false, can_export_key:false, reason,
recommended_signer_profile_status:'DEGRADED' }` — reuses the existing `failClosedHandle`.

## 3. DEGRADED mapping
Every resolution → `recommended_signer_profile_status:'DEGRADED'`, no handle. `config_status` ∈
`{ unconfigured, reference_present_no_sdk, invalid_key_material }`; even a present `provider_ref` stays
`reference_present_no_sdk` (no SDK ⇒ not configured ⇒ fail-closed).

## 4. Key-material refusal
Key-material-shaped `config` or `request` is refused (`config_invalid_key_material` /
`key_material_not_accepted`), never echoed; `handle:null`. Delegated to `looksLikeKeyMaterial`.

## 5. No-live-provider / no-SDK
The package stays **import-free** and outside the mechanism-guard allowlist (fully scanned). Descriptor reports
`has_sdk:false`, `is_live:false`, `can_sign:false`, `can_export_key:false`. The package's own import-free +
case-sensitive live-mechanism scans cover the new code.

## 6. Execution-authority surface
None. No `sign`/`send`/`serialize`/`exportKey`/`loadKey`/`KeyManager`/KMS SDK; descriptor caps all-false.

## 7. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS/SEND/REAL-LIVE** unchanged.

## 8. Remaining (separate approvals)
Real KMS-backed adapter (KMS SDK + live provider) — separate implementation PR (signer_control + two-person
rule; B1/B2 provisioning); wiring a configured handle into the sign-only path — separate PR; send/mainnet/
REAL-LIVE — separate later decisions.

---

**Confirmations:** Skeleton/interface only · No KMS/Vault/KeyManager introduced · No private key material
introduced · No provider live calls introduced · No new signing introduced · No RPC/send introduced · No
transaction serialization introduced · No REAL-LIVE activation · No new execution authority introduced.
