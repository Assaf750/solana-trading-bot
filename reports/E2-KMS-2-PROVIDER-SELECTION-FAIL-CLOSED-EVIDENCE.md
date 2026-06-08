# E2-KMS-2 — Provider-Selection Fail-Closed Wiring Evidence (report-only)

> **Test/evidence-only.** Summarises the test evidence added in PR-E2-KMS-2. No `src` change, no dependency, no
> `tools`/`ALLOWLIST` change, no real provider, no KMS/Vault SDK, no KeyManager, no key material, no new
> signing, no RPC/send, no transaction serialization, no REAL-LIVE. References merged artifacts only;
> introduces no new SSOT/API/DATA/CONFIG name. Does NOT change readiness.
>
> **State:** `main` @ `9a1c29f` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']`.

---

## 1. Scope
End-to-end **fail-closed** proof: an unconfigured/DEGRADED custody key-handle (E2-KMS-1,
`resolveCustodyKeyHandle` → `handle:null`) **never reaches signing** in the real sign-only path (E2-C3-4).
File: `packages/isolated-signer-runtime/test/custody-keyhandle-fail-closed-wiring.test.mjs` (7 tests).

## 2. Provider-selection fail-closed
`resolveCustodyKeyHandle(...)` returns `{ ok:false, status:'unconfigured', handle:null, can_sign:false,
recommended_signer_profile_status:'DEGRADED' }` for all inputs — default unconfigured, no live provider, no
KMS SDK, no network.

## 3. Key-handle unconfigured/DEGRADED → no signing
- Feeding the resolved `handle` (`null`) into `createRealSigningPath().attemptSign(input, handle)` yields
  fail-closed **`no_signing_material`** (`signed:false`, `signature:null`, `can_send:false`).
- DEGRADED/unconfigured custody in the preflight (`custody_phase:'degraded'` / `provider_status:'unconfigured'`)
  is blocked **at the gate** (`custody_degraded` / `custody_unconfigured`) with
  `recommended_signer_profile_status:'DEGRADED'` — **even when a real ephemeral key is supplied**.

## 4. Key-material refusal (both layers)
Raw key/seed/mnemonic/keypair-shaped input is refused at handle resolution (`key_material_not_accepted`) and at
the sign-only path; never echoed in the result.

## 5. No live-provider surface
`custody-provider-contract/src` is **import-free** and contains no live mechanism (no `sign`/`sendTransaction`/
`.serialize(`/`Keypair`/`KeyManager`/`Connection`/`fetch`/RPC). The package stays outside the allowlist and is
fully scanned by the real mechanism guard.

## 6. Audit / no-leak
A refused attempt is audited **before/after** (`real_sign_before` / `real_sign_after_refused:no_signing_material`);
keys ⊆ `AUDIT_COLUMNS`; no key/signature/digest/private data in audit.

## 7. Guard / capabilities / readiness
- Guard PASS `allowlist=1 violations=0`; `ALLOWLIST` unchanged; cross-repo guard unchanged.
- Global `capabilities()` all-false.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS/SEND/REAL-LIVE** unchanged.

## 8. Remaining (separate approvals)
Real KMS-backed key-handle adapter (KMS SDK) — separate PR (signer_control + two-person rule; B1/B2); wiring a
real custody-sourced handle into the sign-only path — separate PR; send/mainnet/REAL-LIVE — separate later
decisions.

---

**Confirmations:** Interface/evidence only · No KMS/Vault/KeyManager introduced · No private key material
introduced · No new signing introduced · No RPC/send introduced · No transaction serialization introduced · No
REAL-LIVE activation · No new execution authority introduced.
