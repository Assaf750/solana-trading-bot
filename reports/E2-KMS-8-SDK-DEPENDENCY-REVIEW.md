# E2-KMS-8 — SDK Dependency Surface / Supply-Chain Review (report-only)

> **REPORT / REVIEW-ONLY.** No code, no tests, no package, no tool, no dependency install, no KMS/Vault SDK
> import, no real provider, no provider live calls, no KeyManager, no key material, no signing, no RPC/send, no
> transaction serialization, no mainnet, no REAL-LIVE. References merged artifacts only; introduces no new
> SSOT/API/DATA/CONFIG name. **Does NOT change readiness and installs/imports no SDK.** It reviews dependency
> criteria for a *future, separately-approved* SDK decision.
>
> **State:** `main` @ `a9e18f4` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 505/505 tests · mechanism guard
> `allowlist=1 violations=0` · NOT READY FOR KMS/SEND/REAL-LIVE.

---

## 1. Current evidence chain (read from `main`)
Sign-only chain closed (E2-C6) · custody key-handle interface (E2-KMS-1) · fail-closed key-handle wiring
(E2-KMS-2) · real KMS adapter design (E2-KMS-3) · no-SDK provider skeleton (E2-KMS-4) · KMS SDK selection/gate
(E2-KMS-5) · provider config validation no-SDK (E2-KMS-6) · SDK spike boundary (E2-KMS-7). No real KMS, no SDK,
no key material, no live calls.

## 2. SDK candidate review criteria
| Criterion | What to require |
|---|---|
| Official vendor SDK vs REST/minimal client | prefer the smallest surface that meets the need; a thin REST/minimal client can beat a heavy SDK |
| Dependency count | minimal direct deps |
| Transitive dependency surface | small, audited transitive tree; no sprawling graph |
| Signing / key-export behavior | sign-API only; **non-exportable** keys; never returns raw key |
| Network / live-call surface | calls confined + mockable; no implicit background calls |
| Credential handling | references/short-lived creds only; **no plaintext/static** creds in repo/env-examples/logs |
| Auditability | provider-side audit logs + app audit (refs-only) |
| Ed25519 / non-exportable support | **Ed25519 verified** at the chosen instance; non-exportable confirmed |
| Permission model | least-privilege (sign-only on the bound key); no export/admin scope |
| Testability without live calls | can be exercised mocked/local in a spike; no mandatory network |
| Supply-chain / pinning | pinned version + integrity (lockfile); provenance; no postinstall/native-binary surprises |

## 3. Options matrix (analysis only — NO SDK installed)
| Option | Dep/transitive surface | Sign-only / non-exportable | Live-call surface | Credential handling | Testability w/o live | Supply-chain risk | Notes |
|---|---|---|---|---|---|---|---|
| **Official cloud KMS SDK** | moderate-large transitive | yes (verify Ed25519) | managed; mockable | IAM/short-lived | good (SDK mocks) | moderate (pin/verify) | lowest-ops if Ed25519 supported |
| **Vendor HSM/custody SDK** | vendor-specific, can be large | strongest non-exportability | vendor API; mockable | vendor policy | varies | moderate-high | strongest containment; heavier integration |
| **Minimal REST client wrapper** | **smallest** (own thin client) | depends on provider API; we control surface | explicit calls only | we control | **best** (trivial to mock) | **lowest** (no heavy SDK) | most control, more code to own/maintain |
| **No-SDK / config-only continuation** | none | n/a (no live key yet) | none | n/a | n/a | none | current posture; fully fail-closed |
> **Lean (recommendation only):** if Ed25519 + non-exportable is confirmed at the chosen instance, a **minimal
> REST client wrapper** (smallest supply-chain surface, best testability) or an **official cloud KMS SDK** are
> the top candidates; HSM/custody SDK is the strongest-containment heavier tier. **The concrete choice + exact
> package/version is a separate approval (with B1 instance selection).**

## 4. Required future dependency gates (before any install)
- **Exact package name + version** stated and approved before install.
- **Lockfile diff review** — every added/changed transitive dep reviewed.
- **No postinstall surprises** — no install scripts that run code/fetch binaries unexpectedly.
- **No native-binary surprise** unless explicitly approved.
- **No production import path in a spike** — SDK import confined to test/spike scope.
- **No live call by default** — disabled unless a separate approval enables it.
- **No credentials** in repo / env-examples / logs.

## 5. Required future tests (at the SDK PR)
- **SDK import confined to test/spike scope**; no production import path imports it.
- **Missing credentials fail closed** (DEGRADED/refuse, no fallback).
- **Provider call disabled by default**; enabled only under a separate approval.
- **No key material returned**; non-exportable handles only.
- **No audit leakage** (keys ⊆ AUDIT_COLUMNS; no key/signature/digest).
- **Guard remains `allowlist=1`**; SDK usage stays inside the allowlisted path; non-allowlisted paths fail-closed.

## 6. Stop conditions
- Any **SDK import in this report** → **STOP** (report-only).
- Any **dependency install** → **STOP**.
- Any **provider live call** → **STOP**.
- Any **credential / secret / key material** → **STOP**.
- Any **new SSOT field/name** → **STOP → ARCH/SSOT** first.
- Any **RPC / send / transaction serialization** → **STOP**.
- Any **REAL-LIVE / mainnet** → **STOP** (distinct later decision).

## 7. First-safe-implementation recommendation (NOT started)
- **`pr-e2-kms-9-provider-sdk-spike-test-only-no-live-calls`** — a **test-only** spike (no live calls,
  mocked/local, no production wiring, no mainnet) **only after** an exact SDK + version is approved with §4
  gates; or
- **Continue no-SDK config-validation** if no SDK is adopted — the current posture stays fully fail-closed.
- **Not started; requires a new explicit approval and §4–§6 conditions.**

## 8. Governance approvals required before any SDK adoption
- **Explicit, separate approval** for adding a dependency (exact name/version + supply-chain review + lockfile
  diff).
- **`signer_control` + two-person rule** (B3) for enabling any live provider call / custody provisioning.
- **Vendor instance (B1) + deployment tier (B2)** approvals; **send/mainnet** and **REAL-LIVE** each separate.

## 9. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; any SDK usage would stay inside the allowlisted path in a separate PR. Mechanism
  guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS / SEND / REAL-LIVE** unchanged.

---

**Confirmations:** Report/review-only · No KMS/Vault/KeyManager introduced · No private key material introduced ·
No provider live calls introduced · No new signing introduced · No RPC/send introduced · No transaction
serialization introduced · No REAL-LIVE activation · No new execution authority introduced.
