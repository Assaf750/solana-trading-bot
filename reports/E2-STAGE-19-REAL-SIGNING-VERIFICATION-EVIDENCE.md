# E2 Stage-19 — Real Signing (SIGN-ONLY) — VERIFICATION + HARDENING CLOSURE EVIDENCE

> **Stage-19 closure (Phase D opener).** Real WebCrypto Ed25519 **sign-only** signing already existed in
> **`packages/isolated-signer-runtime`** (the single mechanism-guard ALLOWLIST entry) from the earlier governed
> E2-C3 PR series. Per Phase-D precondition #1, Stage 19 ran a **dedicated supply-chain/security review** of that
> code against the 11 binding Phase-D preconditions before closing — a verification/hardening stage, not a
> rebuild. **Review decision: `REVIEW_PASS`, 0 confirmed blockers**, with two binding hardening conditions which
> are now **implemented and regression-locked** in this same stage.
>
> **State on `main`:** `f8a8164` + this stage · full suite **1804/1804** (5 new hardening tests) · SSOT drift
> EXACT · mechanism guard `sources=115 fixtures=27 allowlist=1 violations=0` (ALLOWLIST line 121 unchanged) ·
> `can_send:true` absent repo-wide · global `capabilities()` all-false.

---

## 1. The dedicated security review (3 reviewers + arbiter)
Supply-chain · key-isolation · governance/isolation — all **pass**, arbiter independently re-verified all 11
preconditions with its own probes (and a 28-check no-key-leak battery):
- **(P1)** ALLOWLIST exactly `['packages/isolated-signer-runtime/src/']`, line 121 unchanged, violations=0.
- **(P2)** Zero dependencies; no third-party crypto anywhere; `node:crypto` webcrypto Ed25519 native on node
  v24.15.0 (probe true); no install/postinstall scripts.
- **(P3)** Signing key is a caller-supplied per-call non-extractable handle; never generated-and-persisted,
  closure-captured, property-read, or read from env/fs.
- **(P4)** Global `capabilities()` all-false; local `can_sign:true` descriptor is `test_gated` with
  `can_send:false`/`holds_key_material:false`; `evaluateSendPreflight` refuses beside a successful sign.
- **(P5)** No-key-leak battery passed: signature verifies over the bound digest only; tampered bytes rejected;
  `JSON.stringify` of results/audits free of key material; `exportKey(raw|pkcs8|jwk)` all refused on the
  non-extractable handle; key-material-shaped inputs refused; planted values never echoed.
- **(P6)** Audit before AND after every attempt; missing actor → zero-append refusal.
- **(P7)** No other `src` imports the package (only two TEST-only send-gate harnesses); imports are `node:crypto`
  + import-free sibling contract leaves.
- **(P8)** No RPC/wire/broadcast tokens; production custody stub forces `DEGRADED` so production cannot reach
  signing.
- **(P9/P10/P11)** Drift EXACT; suite green; no env/fs/real-key inputs.
- **Stage-11 chain:** the runtime preflight is strictly *tighter* than the signing-review verdict requirements
  (exact `ACTIVE` profile/wallet/operating states + custody configured-non-degraded + E0 readiness +
  risk_approved + real_live_config_valid + digest binding + approval freshness + intent/idempotency identity +
  upfront key-material refusal); nothing bypasses it.

## 2. Two binding hardening conditions — IMPLEMENTED this stage
1. **Deep key-material detector** (`packages/custody-provider-contract/src/custody-provider-contract.mjs`,
   `looksLikeKeyMaterial`): now recurses into nested objects/arrays for secret-bearing field NAMEs **and**
   applies the PEM / base58-blob / mnemonic-length patterns to string VALUEs of properties (not only a bare
   string input). Bounded depth (6) + node budget (256); exceeding the bound, an uninspectable object, or a
   throwing accessor all → refuse (fail-safe over-refusal). **+3 regression tests** (nested NAME; PEM/base58/
   mnemonic VALUEs under innocuous keys; depth/budget/hostile → refused).
2. **Audit fail-close** (`packages/isolated-signer-runtime/src/real-signing-path.mjs`): a throwing
   `audit.append` in the **before** phase refuses with `audit_unavailable_before` (no sign); a throwing append
   in the **after** phase **discards the computed signature** and refuses with `audit_unavailable_after` — no
   unaudited signed result can ever escape, and the audit error is never re-thrown or echoed. **+2 regression
   tests** (before-phase and after-phase throwing append).

The arbiter had classified both as *defense-in-depth* (it independently confirmed **zero actual leak** existed
even before the fixes, because production cannot reach signing and outputs/audits carry only fixed keys); landing
them now satisfies the binding conditions before any later send-path work.

## 3. My independent main-loop spot-check (7/7)
Global capabilities all-false; `exportKey` refused for raw/pkcs8/jwk on a non-extractable handle; planted
key-material refused and absent from result + audit; `evaluateSendPreflight` still refuses. Run then deleted.

## 4. Verification summary
| Layer | Result |
|---|---|
| Dedicated security review (3 reviewers + arbiter, 28-check battery) | REVIEW_PASS, 0 blockers |
| Hardening fixes + regressions | deep detector (+3) · audit fail-close (+2) |
| My independent spot-check | 7/7 |
| Full workspace suite | **1804/1804** (was 1799) |
| SSOT drift / mechanism guard | EXACT · `sources=115 allowlist=1 violations=0` (line 121 unchanged) |

## 5. Stage-20/21 must preserve (carried from the review)
ALLOWLIST stays the single entry; global `capabilities()` all-false; `can_send` false everywhere in the package;
production custody stub stays fail-closed until a separately-approved real custody/KMS track; package deps stay
empty (node:crypto only); no env/fs/network; audit before/after with missing-actor zero-append fail-close not
weakened; the only external imports of the package remain TEST-only. Testnet SEND (Stage 21) is behind its own
dedicated review.

---

**Stage-19 CLOSED.** Real signing is SIGN-ONLY, isolated, key-leak-proof (non-extractable per-call keys,
NAME-only redaction, audit-fail-closed), zero new dependency, behind a strictly-tighter preflight, with no send
path and global capabilities all-false. Dedicated security review PASS + both binding hardening conditions landed
and regression-locked. Suite 1804/1804 · drift EXACT · ALLOWLIST unchanged. **Next = Stage 20 (Key Management /
Custody / Execution-Wallet lifecycle — descriptors only; no real custody provider; owner-only).**
