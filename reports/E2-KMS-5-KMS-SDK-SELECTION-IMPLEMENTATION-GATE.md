# E2-KMS-5 — KMS SDK Selection & Provider Implementation Gate (report-only)

> **REPORT / SELECTION-ONLY.** No code, no tests, no package, no tool, no dependency install, no KMS/Vault SDK
> import, no real provider, no provider live calls, no KeyManager, no key material, no signing, no RPC/send, no
> transaction serialization, no mainnet, no REAL-LIVE. References merged artifacts only; introduces no new
> SSOT/API/DATA/CONFIG name. **Does NOT change readiness and selects/installs no SDK.** It sets the
> implementation gate for a *future, separately-approved* KMS PR.
>
> **State:** `main` @ `7ece861` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 500/500 tests · mechanism guard
> `allowlist=1 violations=0` · NOT READY FOR KMS/SEND/REAL-LIVE.

---

## 1. Current evidence (read from `main`)
- **Sign-only chain closed** (E2-C6): bound-digest signing behind preflight + readiness + audit + custody;
  off-chain verify; `can_send:false`; no send/RPC/serialization.
- **Custody key-handle interface** (E2-KMS-1): opaque, non-exportable; no export/sign method; fail-closed.
- **Provider/key-handle fail-closed wiring** (E2-KMS-2): an unconfigured/DEGRADED handle never reaches signing.
- **Real KMS adapter design** (E2-KMS-3) and **no-SDK provider-adapter skeleton** (E2-KMS-4): contract-shaped,
  always `unconfigured`/DEGRADED, no SDK, no network, no key material.

## 2. KMS/Vault options matrix (analysis only — NO SDK installed)
Requirement: an **Ed25519, non-exportable** signing key whose **opaque handle** the isolated signer uses to
sign the bound digest — never a raw private key; fail-closed `DEGRADED` on any failure.

| Option | Non-exportable key | Ed25519 sign-only / key-handle | No raw-key exposure | Auditability | Least-privilege perm model | Isolation/deployment fit | Ops complexity | Fail-closed DEGRADED | Env separation | SDK/surface risk |
|---|---|---|---|---|---|---|---|---|---|---|
| **Cloud KMS / HSM-class** (managed) | **Yes** (keys non-exportable by config) | **Yes** for many; **verify Ed25519** at instance selection | Yes — sign API returns signature, not key | strong (provider audit logs + app audit) | fine-grained IAM per key/alias | good — managed service behind isolated signer | low-moderate | maps outage/permission error → DEGRADED | per-key/alias, per-env projects | moderate (managed SDK; pin/verify) |
| **HSM-backed managed custody** | **Yes** (HSM non-exportable) | depends on vendor; **verify Ed25519** | Yes | strong | vendor policy + IAM | good — strongest non-exportability | moderate | yes | per-key/env | moderate-high (vendor SDK) |
| **Self-hosted Vault/HSM** | config-dependent (can be non-exportable) | Vault transit / HSM PKCS#11; **verify Ed25519** | Yes if configured (no export) | self-managed audit | self-managed policy | higher attack surface to operate | **high** | yes | self-managed per-env | higher (self-run + SDK) |
| **No-KMS / current stub** (today) | n/a (no key) | n/a | n/a (handle:null) | app audit only | n/a | n/a | minimal | always DEGRADED | n/a | none |

> **Leaning (recommendation only, NOT a selection):** a **cloud KMS / HSM-class** managed service with
> **verified Ed25519 + non-exportable keys** is the lowest-ops, strongest-containment baseline; HSM-backed is an
> acceptable stronger tier; self-hosted Vault/HSM is heavier ops and higher surface. **The concrete vendor
> instance is chosen at B1 provisioning, not here.**

## 3. Recommended implementation gate (must ALL hold before any KMS implementation)
- **No implementation until vendor-instance approval** (B1) — including a non-exportability + Ed25519
  attestation for the chosen instance.
- **No SDK except in a separate PR** — the KMS/Vault SDK import lands only in the implementation PR.
- **`signer_control` + two-person approval** (B3) for the KMS PR and for provisioning; admin alone insufficient.
- **B1/B2 provisioning required** — custody instance (B1) + deployment/isolation tier (B2) approved first.
- **No plaintext fallback** — provider unavailable/invalid → DEGRADED, never an in-app/plaintext key.
- **No cross-environment key reuse** — keys/handles env-scoped; mainnet is a distinct later decision.

## 4. Required future tests (at the KMS implementation PR)
- SDK adapter **never returns a raw key**; **non-exportable handle only**.
- **Provider outage → `DEGRADED`** (no signature).
- **Wrong key id/alias refuses**; **insufficient permission refuses** (no fallback).
- **No audit leakage** (keys ⊆ AUDIT_COLUMNS; no key/signature/digest).
- **No key material** in repo / `.env` / DB / logs / cache / fixtures.
- **Signing remains bound-digest only**; **no send/RPC/serialization**; **no mainnet/REAL-LIVE**.

## 5. Stop conditions
- Any **SDK import in this report** → **STOP** (report-only).
- Any **dependency install** → **STOP**.
- Any **provider live call** → **STOP**.
- Any **new SSOT field/name** (provider/key-id/alias/network/endpoint) → **STOP → ARCH/SSOT** first.
- Any **plaintext / private key material** → **STOP**.
- Any **RPC / send / transaction serialization** → **STOP**.
- Any **REAL-LIVE / mainnet** → **STOP** (distinct later decision).

## 6. First-safe-implementation recommendation (NOT started)
- **`pr-e2-kms-6-provider-sdk-spike-test-only`** — a **test-only** spike validating SDK assumptions
  (e.g. Ed25519 non-exportable sign behaviour) **in an isolated test harness**, **no production wiring, no
  src dependency, no live mainnet** — only if a chosen vendor SDK is approved for evaluation; or
- **`pr-e2-kms-6-provider-config-validation-no-sdk`** — a config-validation **report/skeleton** of what a real
  provider config must satisfy (still **no SDK**).
- **Not started; requires a new explicit approval and §3–§5 conditions.**

## 7. Governance approvals required before any KMS implementation
- **Explicit, separate approval** for the KMS PR (this report installs/selects nothing binding).
- **`signer_control` + two-person rule** (B3) — signing-sensitive/custody.
- **Vendor instance (B1) + deployment tier (B2)** provisioning approvals.
- A real **KMS SDK** import, any **new SSOT name**, **send/mainnet**, and **REAL-LIVE** are each separate decisions.

## 8. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; the KMS adapter (and any SDK import) would stay inside the allowlisted path in a
  separate implementation PR. Mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS / SEND / REAL-LIVE** unchanged.

---

**Confirmations:** Report/selection-only · No KMS/Vault/KeyManager introduced · No private key material
introduced · No provider live calls introduced · No new signing introduced · No RPC/send introduced · No
transaction serialization introduced · No REAL-LIVE activation · No new execution authority introduced.
