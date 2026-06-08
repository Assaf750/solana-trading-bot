# E2-KMS-1 — Custody Provider Key-Handle Interface Extension (evidence, report portion)

> **Interface/stub-only.** Extends the custody-provider **contract** (`@soltrade/custody-provider-contract`)
> with an **opaque key-handle interface** and a **fail-closed** key-handle resolution. No real provider, no
> KMS/Vault SDK, no KeyManager, no key material, no signing, no RPC/send, no transaction serialization, no
> dependency, no `ALLOWLIST` change, no REAL-LIVE. Introduces no new SSOT/API/DATA/CONFIG name (contract/return
> names are function-return properties). Does NOT change readiness.
>
> **State:** `main` @ `42a5424` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']`.

---

## 1. What was added (interface only)
- `describeKeyHandleContract()` — frozen descriptor of the contract a custody/KMS key handle MUST satisfy:
  `kind:'key-handle'`, `opaque:true`, `exportable:false`, `can_export_key:false`, `holds_raw_private_key:false`,
  `accepts_key_material_input:false`, `can_sign:false`, `status:'unconfigured'`. No export/sign methods.
- `resolveCustodyKeyHandle(selection)` and `provider.resolveKeyHandle(request)` — **always fail-closed**:
  `{ ok:false, status:'unconfigured', handle:null, can_sign:false, can_export_key:false, reason,
  recommended_signer_profile_status:'DEGRADED' }`. Refuses key-material input.
- The contract descriptor now embeds `key_handle: describeKeyHandleContract()` and lists `resolveKeyHandle` in
  `operations`. `CUSTODY_KEY_HANDLE_KIND` exported.

## 2. Key-handle interface model
Opaque, non-exportable handle. There is **no real handle** in this PR — resolution returns `handle:null`. A real
KMS-backed handle (and the SDK to source it) is a **separate, explicitly-approved PR**.

## 3. Fail-closed provider-selection & DEGRADED mapping
`selectCustodyProvider` stays `unconfigured` by default; `resolveCustodyKeyHandle`/`provider.resolveKeyHandle`
always return no handle + `recommended_signer_profile_status:'DEGRADED'` (custody unavailable/unconfigured →
DEGRADED; never sign on unverified custody).

## 4. Key-material refusal / no key exposure
Raw key / seed / mnemonic / keypair-shaped input is refused (`reason:'key_material_not_accepted'`), never
echoed; `handle` is always `null`; no key/private/raw field appears in any result.

## 5. Execution-authority surface
None. No `sign`/`send`/`serialize`/`KeyManager`/KMS SDK; descriptor caps all-false; the package stays
import-free and outside the mechanism-guard allowlist (fully scanned).

## 6. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS/SEND/REAL-LIVE** unchanged.

## 7. Remaining (separate approvals)
- Real KMS-backed key-handle adapter (KMS SDK) — separate implementation PR; signer_control + two-person rule;
  vendor instance (B1)/deployment tier (B2).
- Wiring a custody-sourced handle into the sign-only path — separate PR.
- Send / mainnet / REAL-LIVE — separate later decisions.

---

**Confirmations:** Interface/stub only · No KMS/Vault/KeyManager introduced · No private key material
introduced · No signing introduced · No RPC/send introduced · No transaction serialization introduced · No
REAL-LIVE activation · No new execution authority introduced.
