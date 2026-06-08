# E2-KMS-0 — KMS / Custody-Key Sourcing Design & Threat Review (report-only)

> **REPORT / DESIGN-ONLY.** No code, no tests, no package, no tool, no dependency install, no KMS/Vault SDK
> import, no KeyManager, no key material, no RPC/send, no transaction serialization, no mainnet, no REAL-LIVE.
> References already-merged artifacts only; introduces no new SSOT/API/DATA/CONFIG name. **Does NOT change
> readiness and does NOT integrate any KMS/custody source.** It designs a *future, separately-approved* KMS PR.
>
> **State:** `main` @ `424ac17` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 482/482 tests · mechanism guard
> `allowlist=1 violations=0` · E2-C sign-only chain **closed** (READY FOR SIGN-ONLY REVIEW CLOSURE; NOT READY
> FOR KMS/SEND/REAL-LIVE).

---

## 1. Current sign-only state (read from `main`)
- Real **sign-only** path (`createRealSigningPath`) in the one allowlisted path: signs ONLY the bound approved
  digest behind preflight + readiness + audit before/after + custody; `can_send:false`; off-chain verify.
- The signing key is currently an **ephemeral, non-extractable WebCrypto handle supplied per-call (test-mode)**.
  No KMS/custody-key sourcing; no key material in repo/env/db/logs/cache/fixtures; no send/RPC/serialization.
- Custody is the E2-A **contract/stub** (always `unconfigured`) wired by E2-B; with the stub the preflight is
  fail-closed (DEGRADED) before signing.

## 2. KMS / custody-key sourcing design (NOT implemented here)
The change is **how the signing key is sourced** — not new gates and not new authority:
- **Replace the per-call test `signerKey`** with a key handle obtained from a custody/KMS source **at runtime**,
  resolved through the existing custody-provider contract (E2-A) once a real provider is configured. The
  sign-only path keeps signing ONLY the bound digest; its envelope/invariants are unchanged.
- **Non-exportable-key policy preserved** — the custody/KMS key is **never exportable**; the path uses a handle
  to sign and **never** reads/returns/exports the private component (as today). `node:crypto`/Ed25519 stays the
  only crypto, confined to the allowlisted path; a KMS SDK, if any, would be a **separate implementation PR**.
- **Raw key material refused** — raw private key / seed / mnemonic / keypair **never** accepted as input;
  refusal is delegated (as today) so no key-material literal enters source.
- **Provider wiring** — `selectCustodyProvider()` (E2-A) would resolve a **real** provider only when configured;
  until then it stays `unconfigured` and the path stays fail-closed. Connecting a real provider is a separate PR.
- **Fail-closed `DEGRADED`** — any KMS/custody failure, unavailability, or `unconfigured` provider →
  `recommended_signer_profile_status:'DEGRADED'`, no signature (reuse the existing E2-B/E2-E behavior).
- **No new SSOT name** unless ARCH→SSOT approves one (e.g. a real provider/key-handle field).

## 3. Threat review
- **Key export risk** — keys non-exportable; the path never exports/returns a private key; no `exportKey`.
- **Plaintext key risk** — no plaintext/raw key in source/env/db/logs/cache/fixtures; raw key input refused.
- **App-memory exposure** — only an opaque non-extractable handle lives in memory; never the raw private bytes;
  isolated-signer boundary (B1/B2) confines it.
- **Audit leakage** — audit stays refs-only (AUDIT_COLUMNS); no key/signature/digest in audit.
- **KMS outage / degraded** — fail-closed `DEGRADED`; never sign on unverified/unavailable custody.
- **Provider misconfiguration** — `unconfigured`/invalid provider → refuse (custody_unconfigured); no silent
  fallback.
- **`signer_control` / dual-control bypass** — KMS provisioning + custody actions require `signer_control` +
  two-person rule (B3, `DR-E2-B3-001`); admin alone insufficient; break-glass cannot bypass (B6).
- **Replay / stale approval** — payload binding + approval freshness enforced by the existing gate; unchanged.
- **Signing outside the allowlisted path** — guard keeps real signing confined to
  `packages/isolated-signer-runtime/src/`; key material HARD-forbidden there; everything else fail-closed.

## 4. Required future tests (before/at the KMS implementation PR)
- **No key export** — no `exportKey`; private key never returned/logged/audited.
- **No key material** in repo / `.env` / DB / logs / cache / fixtures (source + fixture scans).
- **Provider failure → `DEGRADED`** — KMS/custody failure yields fail-closed DEGRADED, no signature.
- **Unconfigured provider refuses** — no signature when the provider is `unconfigured`.
- **`signer_control` approval required** for provisioning/custody changes (two-person rule).
- **No audit leakage** — keys ⊆ AUDIT_COLUMNS; no key/signature/digest.
- **Signing remains bound-digest only** — arbitrary-bytes impossible; only `approved_payload_digest` signed.
- **No send / no RPC / no serialization** introduced by the KMS PR.

## 5. Stop conditions
- Any **KMS/Vault SDK import** → **separate implementation PR** (not in any design report).
- Any **new SSOT field/name** (provider/key-handle/network/endpoint) → **STOP → ARCH/SSOT** first.
- Any **plaintext / raw private key / seed / mnemonic / keypair** → **STOP**.
- Any **RPC / send / transaction serialization** → **STOP** (separate decisions).
- Any **REAL-LIVE / mainnet** → **STOP** (distinct later decision).

## 6. First-safe-implementation recommendation (NOT started)
**`pr-e2-kms-1-custody-provider-adapter-interface-extension`** (or `pr-e2-kms-1-provider-selection-fail-closed`)
— extend the custody-provider **contract/selection** to resolve a key handle **interface** (still fail-closed /
`unconfigured` by default; **no real KMS SDK** yet), proving the sign-only path consumes a custody-sourced
handle while everything stays DEGRADED until a real provider is separately approved. **Not started; requires a
new explicit approval and §4–§5 conditions.**

## 7. Governance approvals required before any KMS PR
- **Explicit, separate approval** for the KMS/custody-key sourcing PR (this report integrates nothing).
- **Signing-sensitive / custody → `signer_control` + two-person rule** (B3); admin alone insufficient.
- **Vendor instance (B1) + deployment tier (B2)** provisioning approvals before a real KMS source is used.
- A real **KMS SDK** import, any **new SSOT name**, **send/mainnet**, and **REAL-LIVE** are each separate
  decisions.

## 8. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; KMS work would stay inside the allowlisted path; KMS SDK import (if any) is a
  separate implementation PR. Mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR KMS / SEND / REAL-LIVE** unchanged.

---

**Confirmations:** Report/design-only · No KMS/Vault/KeyManager introduced · No private key material introduced ·
No RPC/send introduced · No transaction serialization introduced · No REAL-LIVE activation · No new execution
authority introduced.
