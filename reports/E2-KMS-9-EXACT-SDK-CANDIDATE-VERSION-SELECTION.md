# E2-KMS-9 — Exact SDK Candidate / Version Selection Gate (report-only)

> **REPORT / SELECTION-GATE-ONLY.** No code, no tests, no package, no tool, no dependency install, no KMS/Vault
> SDK import, no real provider, no provider live calls, no KeyManager, no key material, no signing, no RPC/send,
> no transaction serialization, no mainnet, no REAL-LIVE. References merged artifacts only; introduces no new
> SSOT/API/DATA/CONFIG name. **Does NOT change readiness and selects/installs no SDK.**
>
> **State:** `main` @ `e52a82c` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 505/505 tests · mechanism guard
> `allowlist=1 violations=0` · NOT READY FOR KMS/SEND/REAL-LIVE.

---

## 1. Current evidence chain (read from `main`)
Sign-only chain closed (E2-C6) · custody key-handle interface (E2-KMS-1) · fail-closed wiring (E2-KMS-2) ·
real KMS adapter design (E2-KMS-3) · no-SDK provider skeleton (E2-KMS-4) · KMS SDK selection/gate (E2-KMS-5) ·
provider config validation no-SDK (E2-KMS-6) · SDK spike boundary (E2-KMS-7) · SDK dependency/supply-chain
review (E2-KMS-8). No real KMS, no SDK, no key material, no live calls.

## 2. Gate rule
**No SDK spike begins before an EXACT SDK / package / version is chosen** — and an exact version is only
lockable at **B1 vendor-instance provisioning** (with a non-exportability + Ed25519 attestation for the chosen
instance). This report selects nothing binding; it gates the selection.

## 3. Candidate-selection matrix (analysis only — NO SDK installed/selected)
> **Version status is `unknown — requires provisioning + supply-chain approval` for every SDK candidate.** This
> report does not pin a version (locking a version belongs to the B1 provisioning approval; no registry/network
> lookups are performed here, and no version numbers are invented).

| Candidate | Pkg/version status | Dep/transitive risk | Postinstall/native risk | Credential handling | Live-call default | No-live-call testability | Ed25519 / non-exportable | No raw-key exposure | Auditability | Permission model | Env separation | Lockfile impact |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Official cloud KMS SDK** | unknown — needs approval | moderate-large transitive | must verify (no surprise) | IAM/short-lived | mockable; off by default in spike | good (SDK mocks) | **verify Ed25519** at B1 | sign-API only | provider + app audit | least-privilege IAM | per-key/env | larger diff |
| **Vendor HSM/custody SDK** | unknown — needs approval | vendor-specific, can be large | must verify | vendor policy | mockable | varies | strongest non-exportability (verify) | sign-API only | strong | vendor policy + IAM | per-key/env | larger diff |
| **Minimal REST client wrapper** | n/a (own thin client) — still needs approval to build | **smallest** | none (own code) | we control (refs only) | explicit; off by default | **best** (trivial mock) | depends on provider API (verify) | we control | app audit + provider logs | we scope | we scope | minimal diff |
| **No-SDK continuation** | n/a | none | none | n/a (no live key) | none | n/a | n/a (no live key yet) | n/a | app audit only | n/a | n/a | none |

## 4. Decision
**`NO SDK SELECTED YET`.** The in-repo evidence is insufficient to lock an exact SDK/package/version: vendor
instance (B1) and deployment tier (B2) are not provisioned, no Ed25519/non-exportability attestation exists for
a concrete instance, and no supply-chain/lockfile review of a specific version has been performed (and none is
performed here — no network/registry calls, no invented versions). **Continue the no-SDK path.** A binding SDK
selection requires a separate provisioning + supply-chain approval.

## 5. Required gates before ANY SDK spike
- **Exact package + exact version** stated and approved.
- **Supply-chain review** (provenance, maintenance, advisories) of that exact version.
- **Lockfile diff review** — every added/changed transitive dependency reviewed.
- **No postinstall surprises**; **no native binary** unless explicitly approved.
- **No production import path** — SDK confined to test/spike scope.
- **No live call by default**; **no credentials** in repo/env-examples/logs.

## 6. Required future tests (at the spike PR, if an SDK is later selected)
- SDK import **confined to test/spike scope**; no production import path imports it.
- **Missing credentials fail closed** (DEGRADED/refuse, no fallback).
- **Provider call disabled by default**.
- **Wrong env / key ref refuses** (testnet-only; mainnet/prod and wrong alias/id refuse).
- **No key material returned**; non-exportable handles only.
- **No audit leakage** (keys ⊆ AUDIT_COLUMNS; no key/signature/digest).
- **Guard remains `allowlist=1`**; SDK usage stays inside the allowlisted path.

## 7. Stop conditions
- Any **SDK import in this report** → **STOP** (report-only).
- Any **dependency install** → **STOP**.
- Any **provider live call** → **STOP**.
- Any **credential / secret / key material** → **STOP**.
- Any **new SSOT field/name** → **STOP → ARCH/SSOT** first.
- Any **RPC / send / transaction serialization** → **STOP**.
- Any **REAL-LIVE / mainnet** → **STOP** (distinct later decision).

## 8. First-safe-implementation recommendation (NOT started)
- Given the decision **`NO SDK SELECTED YET`**: **`pr-e2-kms-10-no-sdk-provider-config-hardening`** — continue
  hardening the no-SDK config-validation/skeleton path (fail-closed), with **no SDK, no dependency, no live
  call**.
- Only **if** an exact SDK + version is later approved (with §5 gates):
  **`pr-e2-kms-10-provider-sdk-spike-test-only-no-live-calls`** (test-only, no live calls).
- **Neither is started; each requires a new explicit approval.**

## 9. Governance approvals required
- **Selecting/adding any SDK** is a separate governed decision (exact name/version + supply-chain review +
  lockfile diff + B1/B2 provisioning).
- **`signer_control` + two-person rule** (B3) for enabling any live provider call / custody provisioning.
- **send/mainnet** and **REAL-LIVE** each remain separate later decisions.

## 10. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS / SEND / REAL-LIVE** unchanged.

---

**Confirmations:** Report/selection-gate-only · NO SDK SELECTED YET (continue no-SDK path) · No KMS/Vault/
KeyManager introduced · No private key material introduced · No provider live calls introduced · No new signing
introduced · No RPC/send introduced · No transaction serialization introduced · No REAL-LIVE activation · No new
execution authority introduced.
