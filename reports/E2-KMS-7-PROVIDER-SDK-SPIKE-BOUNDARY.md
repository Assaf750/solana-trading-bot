# E2-KMS-7 — Provider SDK Spike Boundary & Threat Review (report-only)

> **REPORT / BOUNDARY-ONLY.** No code, no tests, no package, no tool, no dependency install, no KMS/Vault SDK
> import, no real provider, no provider live calls, no KeyManager, no key material, no signing, no RPC/send, no
> transaction serialization, no mainnet, no REAL-LIVE. References merged artifacts only; introduces no new
> SSOT/API/DATA/CONFIG name. **Does NOT change readiness and runs/installs no SDK.** It sets the boundary for a
> *future, separately-approved* SDK spike.
>
> **State:** `main` @ `8fdbea4` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 505/505 tests · mechanism guard
> `allowlist=1 violations=0` · NOT READY FOR KMS/SEND/REAL-LIVE.

---

## 1. Current evidence (read from `main`)
- **Sign-only chain closed** (E2-C6): bound-digest signing behind preflight + readiness + audit + custody;
  off-chain verify; `can_send:false`.
- **Custody key-handle interface** (E2-KMS-1) + **fail-closed key-handle wiring** (E2-KMS-2): unconfigured/
  DEGRADED handle never reaches signing.
- **Real KMS adapter design** (E2-KMS-3), **no-SDK provider skeleton** (E2-KMS-4), **KMS SDK selection/gate**
  (E2-KMS-5), **provider config validation no-SDK** (E2-KMS-6): contract-shaped, fail-closed, no SDK, no live
  provider, no key material.

## 2. SDK spike boundary (conditions any future spike MUST obey)
- **Test-only** — the spike lives under `test/` (or a clearly-isolated spike harness); **no production import
  path**, no `src` runtime dependency on the SDK.
- **No live provider call by default** — a real call requires its **own separate approval** (and would be the
  KMS implementation PR, not a spike); the spike validates SDK assumptions with **mocked/local** behaviour.
- **No mainnet, no REAL-LIVE** — devnet/testnet shaping only if any network notion appears; sending excluded.
- **No key material** — no plaintext/raw private key/seed/mnemonic/keypair; keys (if any) are ephemeral,
  non-extractable, never exported/persisted.
- **No send / no RPC / no transaction serialization** — the spike never broadcasts, never serialises a tx.
- **Confined dependency** — if the spike imports an SDK at all, it is a **separate, explicitly-approved**
  dependency-adding PR; this report adds nothing.

## 3. Threat review
- **SDK dependency / supply-chain risk** — pin + integrity-check; minimal surface; evaluate before adoption;
  the SDK import is a governed, separate PR.
- **Live-call leakage** — default no live calls; any endpoint contact is mocked/local in a spike; real calls
  are a separate approval; the mechanism guard forbids network families outside the allowlisted path.
- **Accidental credential/config exposure** — no credentials/secrets in repo/env/db/logs/cache/fixtures; the
  spike uses references only; redaction applies to any output.
- **Wrong provider environment** — environment must be testnet-family (per E2-KMS-6); mainnet/prod blocked.
- **Wrong key alias/id** — wrong/unknown reference must refuse (no fallback); resolution stays fail-closed.
- **Plaintext fallback** — forbidden; provider unavailable/invalid → DEGRADED, never a plaintext/in-app key.
- **Audit leakage** — refs-only (AUDIT_COLUMNS); no key/signature/digest in audit.
- **Permission overreach** — least-privilege (sign-only on the bound key); never export/admin scope.
- **`signer_control` bypass** — provisioning/custody/live-call enablement requires `signer_control` +
  two-person rule (B3); admin alone insufficient; break-glass cannot bypass (B6).

## 4. Required future tests (at the spike PR)
- **SDK import confined to the explicit spike scope only** — no `src`/production import path imports it.
- **No live calls by default** — the spike does not contact any endpoint unless a separate approval enables it.
- **Missing credentials fail closed** — absent/invalid credentials → DEGRADED/refuse, never a fallback.
- **Wrong env / key ref refuses** — testnet-only; mainnet/prod and wrong alias/id refuse.
- **No key material returned** — no raw key in output/audit/errors; non-exportable handles only.
- **No audit leakage** — keys ⊆ AUDIT_COLUMNS; no key/signature/digest.
- **Guard remains controlled** — `allowlist=1`; any SDK usage stays inside the allowlisted path; non-allowlisted
  paths stay fail-closed.

## 5. Stop conditions
- Any **SDK import in this report** → **STOP** (report-only).
- Any **dependency install** → **STOP**.
- Any **provider live call** → **STOP**.
- Any **credential / secret / key material** → **STOP**.
- Any **new SSOT field/name** → **STOP → ARCH/SSOT** first.
- Any **RPC / send / transaction serialization** → **STOP**.
- Any **REAL-LIVE / mainnet** → **STOP** (distinct later decision).

## 6. First-safe-implementation recommendation (NOT started)
- **`pr-e2-kms-8-provider-sdk-spike-test-only-no-live-calls`** — a **test-only** spike that validates SDK
  assumptions with **no live calls** (mocked/local), no production wiring, no mainnet — only if a chosen SDK is
  approved for evaluation as a separate dependency-adding decision; or
- **`pr-e2-kms-8-sdk-dependency-review-report`** — a **report** reviewing a specific SDK's surface/supply-chain
  before any install (still **no SDK**).
- **Not started; requires a new explicit approval and §4–§5 conditions.**

## 7. Governance approvals required before any spike
- **Explicit, separate approval** for the spike PR (this report runs/installs nothing).
- **Adding any SDK dependency** is its own governed decision (supply-chain review + pin).
- **Enabling any live provider call** → separate approval + `signer_control` + two-person rule (B3).
- **Vendor instance (B1) + deployment tier (B2)**, **send/mainnet**, and **REAL-LIVE** each remain separate
  decisions.

## 8. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; any SDK usage would stay inside the allowlisted path in a separate PR. Mechanism
  guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS / SEND / REAL-LIVE** unchanged.

---

**Confirmations:** Report/boundary-only · No KMS/Vault/KeyManager introduced · No private key material
introduced · No provider live calls introduced · No new signing introduced · No RPC/send introduced · No
transaction serialization introduced · No REAL-LIVE activation · No new execution authority introduced.
