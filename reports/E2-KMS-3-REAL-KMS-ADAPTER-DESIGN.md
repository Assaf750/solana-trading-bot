# E2-KMS-3 — Real KMS Adapter Design & Provider-Selection Threat Review (report-only)

> **REPORT / DESIGN-ONLY.** No code, no tests, no package, no tool, no dependency install, no KMS/Vault SDK
> import, no real provider, no provider live calls, no KeyManager, no key material, no signing, no RPC/send, no
> transaction serialization, no mainnet, no REAL-LIVE. References already-merged artifacts only; introduces no
> new SSOT/API/DATA/CONFIG name. **Does NOT change readiness and integrates no KMS.** It designs a *future,
> separately-approved* KMS adapter PR.
>
> **State:** `main` @ `f7961a4` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 495/495 tests · mechanism guard
> `allowlist=1 violations=0` · NOT READY FOR KMS/SEND/REAL-LIVE.

---

## 1. Current evidence (read from `main`)
- **Sign-only path closed** (E2-C6): signs ONLY the bound approved digest behind preflight + readiness + audit +
  custody; off-chain verify; `can_send:false`; no send/RPC/serialization.
- **Custody key-handle interface** (E2-KMS-1): `describeKeyHandleContract()` (opaque, non-exportable, no raw
  key, no export/sign method); `resolveCustodyKeyHandle()` fail-closed (`handle:null`, DEGRADED).
- **Fail-closed wiring proven** (E2-KMS-2): an unconfigured/DEGRADED handle never reaches signing — the
  sign-only path returns `no_signing_material`; DEGRADED/unconfigured custody refuses even with a real
  ephemeral key; key material refused at both layers; no leak.

## 2. Real KMS adapter design (NOT implemented here)
A future adapter implements the existing custody-provider **contract** without changing its shape:
- **Implements the contract** — `describe()/describeKeyHandle()/resolveKeyHandle()` backed by a real KMS, only
  when explicitly configured; until then it stays `unconfigured` and fail-closed.
- **Returns an OPAQUE non-exportable key handle ONLY** — never a raw private key; `can_export_key:false`;
  `holds_raw_private_key:false`. The sign-only path uses the handle to sign the bound digest (as today) and
  never reads/returns/exports the private component.
- **Refuses raw private key / seed / mnemonic / keypair** — input refusal delegated (as today); no key-material
  literal in source.
- **Fails to `DEGRADED`** — any KMS outage/permission error/misconfiguration/unavailability →
  `recommended_signer_profile_status:'DEGRADED'`, no handle, no signature.
- **Stays inside approved boundaries** — lives in the allowlisted path; KMS SDK import (if any) is the
  **implementation** PR; signer_control + two-person rule (B3); vendor instance (B1) + deployment tier (B2)
  provisioning; isolated-signer boundary.

## 3. Provider selection design
- **Default `unconfigured`** — `selectCustodyProvider()` returns the unconfigured provider until configured.
- **Explicit provider config only in a separate PR** — no implicit/auto configuration; configuration is a
  governed action.
- **Vendor-instance approval before activation** (B1) — a specific KMS/HSM instance + non-exportability
  attestation is approved at provisioning, not here.
- **No fallback to plaintext** — if the configured provider is unavailable/invalid → DEGRADED, never a
  plaintext/in-app key.
- **No cross-environment key reuse** — keys/handles are environment-scoped (devnet/testnet/mainnet are
  separate; mainnet is a distinct later decision); no reuse across environments.

## 4. Threat review
- **Key export** — non-exportable handle; no `exportKey`; private key never returned/logged/audited.
- **Plaintext leakage** — no plaintext/raw key in source/env/db/logs/cache/fixtures; raw input refused.
- **KMS permission overreach** — least-privilege per `signer_profile_id` (B1 minimum controls); the adapter
  requests only sign-capability on the bound key, never export/admin.
- **Wrong key alias/id** — a wrong/unknown key reference must **refuse** (no signature), not sign with a
  fallback; resolution is fail-closed by default.
- **Provider outage** — fail-closed `DEGRADED`; never sign on unverified/unavailable custody.
- **Audit leakage** — refs-only (AUDIT_COLUMNS); no key/signature/digest in audit.
- **`signer_control` bypass** — provisioning/custody changes require `signer_control` + two-person rule (B3);
  admin alone insufficient; break-glass cannot bypass (B6).
- **Environment mix-up** — environment-scoped handles; no cross-env reuse; mainnet separate decision.
- **Signing outside the allowlisted path** — guard keeps real signing confined to
  `packages/isolated-signer-runtime/src/`; key material HARD-forbidden there; everything else fail-closed.

## 5. Required future tests (at the KMS implementation PR)
- KMS adapter **never returns a raw key**; handle is **opaque/non-exportable**.
- **KMS failure → `DEGRADED`** (outage/permission/misconfig), no signature.
- **Wrong key id/alias refuses** (no signature, no fallback).
- **Unconfigured refuses** (no handle).
- **Audit has no secrets** (keys ⊆ AUDIT_COLUMNS; no key/signature/digest).
- **Sign-only remains bound-digest only** — arbitrary bytes impossible.
- **No send / no RPC / no serialization**; **no mainnet / no REAL-LIVE**.

## 6. Stop conditions
- Any **KMS/Vault SDK import** → **implementation PR only** (never a design report).
- Any **real provider live call** → **implementation PR only**.
- Any **new SSOT field/name** (provider/key-id/alias/network/endpoint) → **STOP → ARCH/SSOT** first.
- Any **plaintext / raw private key / seed / mnemonic / keypair** → **STOP**.
- Any **RPC / send / transaction serialization** → **STOP**.
- Any **REAL-LIVE / mainnet** → **STOP** (distinct later decision).

## 7. First-safe-implementation recommendation (NOT started)
- **`pr-e2-kms-4-provider-adapter-skeleton-no-sdk`** — a provider-adapter **skeleton** that implements the
  contract shape, stays `unconfigured`/fail-closed, **no real KMS SDK**, no live call; or
- **`pr-e2-kms-4-provider-config-validation-report`** — a config-validation **report** of what a real provider
  config must satisfy (still no SDK).
- **Not started; requires a new explicit approval and §5–§6 conditions.**

## 8. Governance approvals required before any KMS implementation
- **Explicit, separate approval** for the KMS adapter PR (this report integrates nothing).
- **Signing-sensitive / custody → `signer_control` + two-person rule** (B3); admin alone insufficient.
- **Vendor instance (B1) + deployment tier (B2)** provisioning approvals before a real KMS source is used.
- A real **KMS SDK** import, any **new SSOT name**, **send/mainnet**, and **REAL-LIVE** are each separate
  decisions.

## 9. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; KMS work would stay inside the allowlisted path; KMS SDK import (if any) is a
  separate implementation PR. Mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS / SEND / REAL-LIVE** unchanged.

---

**Confirmations:** Report/design-only · No KMS/Vault/KeyManager introduced · No private key material introduced ·
No provider live calls introduced · No new signing introduced · No RPC/send introduced · No transaction
serialization introduced · No REAL-LIVE activation · No new execution authority introduced.
