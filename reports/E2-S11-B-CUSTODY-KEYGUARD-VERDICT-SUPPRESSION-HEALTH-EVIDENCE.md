# E2 Stage-11 / PR-S11-B — Signer Custody-Readiness Advisory + Private-Key Forbidden Surface Guard + Signing-Review Verdict / Suppression / Health Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends the final
> five read-only/advisory `signing-review`-layer foundations to **`@soltrade/signing-review-foundations`**: **Signer
> Custody-Readiness Advisory** (Part F), **Private-Key Forbidden Surface Guard** (Part G), **Signing-Review Verdict**
> (Part H), **Signing-Review Suppression** (Part I), and **Signing-Review Health** (Part J). All are pure, import-free,
> function-I/O-only, deterministic, fail-closed (Fail-Safe-Not-Fail-Open). **A signing-review verdict/health is a
> READ-ONLY ADVISORY REPRESENTATION ONLY — it REVIEWS signing PREREQUISITES from safe metadata; it is NOT signing,
> NOT a signature, NOT a private key, NOT key material, NOT a signing permission, NOT a send permission, NOT
> signing/trading readiness.** **No real signing, no SignerService activation, no private key / seed / mnemonic /
> keypair material of any kind, no crypto signing call, no send/broadcast.** `can_send:false` repo-wide unchanged;
> `ALLOWLIST` unchanged; the pre-existing `signer-*`/`custody-*` packages untouched.
>
> **State:** appended on `main` @ `8291b56` (branch `pr-s11-b-custody-keyguard-verdict-suppression-health`, `main + 1`,
> parent == main) · append-only (no new src file; 4 files changed) · `ALLOWLIST=['packages/isolated-signer-runtime/
> src/']` · mechanism guard `sources=101 fixtures=27 allowlist=1 violations=0` · SSOT drift EXACT baseline · full
> suite **1503/1503** · signing-review-foundations **76/76** · 11 new exports (20 total).

---

## 1. Scope — five appended foundations (Parts F–J)
Appended to `packages/signing-review-foundations/src/signing-review-foundations.mjs` (+ `.d.ts`, test, README).
**Append-only** — no new src file; the PR-S11-A Parts C/D/E are untouched. 11 new exports (total 20):
`describeSignerCustodyReadinessAdvisoryContract` · `validateSignerCustodyReadinessAdvisoryInput` ·
`evaluateSignerCustodyReadinessAdvisory` (F); `describePrivateKeyForbiddenSurfaceContract` ·
`evaluatePrivateKeyForbiddenSurface` (G); `describeSigningReviewVerdictContract` · `evaluateSigningReviewVerdict`
(H); `describeSigningReviewSuppressionContract` · `evaluateSigningReviewSuppression` (I);
`describeSigningReviewHealthContract` · `evaluateSigningReviewHealth` (J).

## 2. Signer Custody-Readiness Advisory (Part F)
States `SIGNER_CUSTODY_READINESS_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_REJECTED` / `_ACCEPTABLE_ADVISORY`.
Built from **safe metadata buckets only** (`key_custody_mode_bucket` ∈ unknown/connected_wallet/isolated_signer;
`signer_profile_status_bucket` ∈ unknown/active/disabled/revoked/degraded; `dual_control_bucket` ∈
unknown/not_required/required_unsatisfied/required_satisfied; `signer_reachability_bucket` ∈
unknown/unreachable/reachable; `custody_verification_bucket` ∈ unknown/unverified/verified). Fail-closed:
`revoked`/`disabled` status → `_REJECTED`; `required_unsatisfied` dual-control → `_REJECTED`; unknown/unverified/
unreachable → `_DEGRADED`. **Even `_ACCEPTABLE_ADVISORY` opens NO `signer_ready`/`signing_permitted`** — it is an
advisory review of prerequisites, never a permission. Spot-check confirmed `revoked → _REJECTED` and all 24 flags
false on both `_ACCEPTABLE_ADVISORY` and `_REJECTED`.

## 3. Private-Key Forbidden Surface Guard (Part G) — the crux of PR-S11-B
`evaluatePrivateKeyForbiddenSurface()` scans **top-level keys only** (deterministic, bounded, pure) against a frozen
forbidden-NAME allowlist (`private_key`/`privateKey`/`secret_key`/`secretKey`/`keypair`/`keyPair`/`mnemonic`/`seed`/
`seed_phrase`/`seedPhrase`/`secret_seed`/`raw_key`/`rawKey`/`signing_key`/`signingKey`/`signer_secret`/`signerSecret`/
`ed25519_secret`/`ed25519Secret`/`signature`/`signatures`/`signed_tx`/`signedTransaction`/`signed_transaction`).
- **Clean** descriptor (none present) → `PRIVATE_KEY_SURFACE_CLEAN`, all detection booleans false.
- **Any key/seed/keypair name** present → `PRIVATE_KEY_SURFACE_BLOCKED`, `key_material_detected:true`,
  `private_key_detected:true`, `forbidden_field_detected:true`, `forbidden_field_ref` = the matched **NAME only**.
- **Signature-only name** (`signature`/`signed_tx`/…) → `_BLOCKED` with `private_key_detected:false`.
- **REDACTION PROVEN:** the planted field VALUE is **never echoed** — for planted `private_key`/`seed`/`mnemonic`/
  `secret_key`/`keypair`/`signing_key`/`signature` values, the value is provably **absent from `JSON.stringify`** of
  the result; `forbidden_field_ref` carries the NAME, never the value.
- The detection booleans `key_material_detected`/`private_key_detected`/`forbidden_field_detected` are **DETECTION
  outputs (true == BLOCKED == the SAFE state); they are NOT readiness/execution/signing flags.** A BLOCKED result
  keeps **all 24** exec/readiness flags false.
- Hostile/throwing/uninspectable input → frozen `PRIVATE_KEY_SURFACE_UNCONFIGURED`, **never throws**.

## 4. Signing-Review Verdict (Part H)
`evaluateSigningReviewVerdict()` aggregates the 5 components (input boundary C + signer/custody boundary D +
candidate descriptor E + custody-readiness advisory F + private-key surface G). States `SIGNING_REVIEW_UNCONFIGURED`
/ `_DEGRADED` / `_BLOCKED` / `_PASS_ADVISORY`. Ordering (Fail-Safe-Not-Fail-Open): smuggled forbidden flag / exec
command / secret / endpoint / mainnet on top-level or any component → `_BLOCKED`; private-key surface BLOCKED OR any
component `*_INVALID` OR input not VALID OR custody not READ_ONLY_OK OR descriptor not present OR readiness REJECTED →
`_BLOCKED`; any of the 5 missing → `_UNCONFIGURED`; readiness/descriptor DEGRADED → `_DEGRADED`; all clean →
`_PASS_ADVISORY`. **CRITICAL: even `SIGNING_REVIEW_PASS_ADVISORY` opens NO `signer_ready`/`signing_permitted`/
`transaction_ready`/`can_serialize`/`can_send`** — "review passed" is carried ONLY by `signing_review_state`/
`signing_review_passed_advisory`. Spot-check confirmed PASS_ADVISORY keeps all 24 flags false, and a BLOCKED-surface
component drives `_BLOCKED` without echoing the leaked value.

## 5. Signing-Review Suppression (Part I) — sign/send ALWAYS suppressed
`evaluateSigningReviewSuppression()` **ALWAYS** emits `suppressed:true` carrying `not_sign_authorized` /
`not_send_authorized` / `not_execution_authorized` — these three are appended on **every** path (clean, blocked,
hostile, missing). Additional reason codes (`tx_build_not_reviewed`/`signer_custody_invalid`/`signer_metadata_missing`/
`signer_not_ready`/`dual_control_unsatisfied`/`key_material_detected`/`signature_detected`) are added when the
corresponding component is not clean. Spot-check confirmed the three `not_*_authorized` tokens are present on both the
clean input AND a key-material-blocked input, `suppressed:true`, all 24 flags false, and no leaked value echoed.

## 6. Signing-Review Health (Part J)
`evaluateSigningReviewHealth()` aggregates the 5 components + verdict + suppression. States
`SIGNING_REVIEW_HEALTH_UNCONFIGURED` / `_DEGRADED` / `_REVIEWED_ADVISORY` / `_SUPPRESSED` / `_BLOCKED`. Because the
suppression layer is **always suppressed:true** for sign/send, the **standard clean path yields `_SUPPRESSED`** —
the system never auto-promotes itself to "reviewed". `_REVIEWED_ADVISORY` is reachable only with an explicit
not-suppressed object, and **even then opens nothing** (all 24 flags false, `can_send`/`signer_ready` false). Invalid
boundary/custody, surface BLOCKED, or verdict BLOCKED → `_BLOCKED`; missing any required component → `_UNCONFIGURED`.
Spot-check confirmed: real clean path → `_SUPPRESSED` (all flags false); explicit not-suppressed → `_REVIEWED_ADVISORY`
(all flags STILL false).

## 7. Signing-review ≠ signing / key material / send
Every result spreads the shared `signSafeFlags()`: `read_only:true` + the **24** flags (`signal_ready`/`trading_ready`/
`risk_ready`/`intent_ready`/`routing_ready`/`route_ready`/`order_ready`/`transaction_ready`/`serialized_ready`/
`message_bytes_ready`/`signer_ready`/`signing_permitted`/`broadcast_permitted`/`can_send`/`can_broadcast`/
`can_serialize`/`is_live`/`mainnet_enabled`/`real_live`/`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/
`live_quote_enabled`/`has_secret`) = **false** on **every** state of all five foundations, including
`_ACCEPTABLE_ADVISORY`, `_PASS_ADVISORY`, and `_REVIEWED_ADVISORY`. No output carries a private-key/seed/keypair/
signature/transaction artifact field.

## 8. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/unknown/raw-input/smuggled-forbidden-flag/exec-or-sign-or-send-command/
secret/endpoint/mainnet/**private-key-material** input → fail-closed (`*_UNCONFIGURED`/`*_INVALID`/`*_REJECTED`/
`*_BLOCKED`); secret/endpoint/**key-material** values **never echoed** (planted `private_key`/`seed`/`mnemonic`/
`keypair` values provably absent from `JSON.stringify`); both hostile-proxy variants (throwing-accessor and
function-returning, via the `signUninspectable` guard + try/catch) → frozen `*_UNCONFIGURED`, **never throws**.

## 9. Tests + independent verification
- **Package:** `signing-review-foundations` **76/76** (was 34 after PR-S11-A; +42 for Parts F–J), built against a
  **real** Stage-4→10 `TX_BUILD_REVIEW_PASS_ADVISORY` + `TX_BUILD_HEALTH_REVIEWED_ADVISORY` chain.
- **Full workspace suite:** **1503/1503** (was 1461; +42).
- **Independent main-loop behavioral spot-check: 70/70 PASS** (temp script, run then deleted) against the same real
  Stage-10 chain — explicitly asserting: clean→`PRIVATE_KEY_SURFACE_CLEAN`; planted `private_key`/`seed`/`mnemonic`/
  `secret_key`/`keypair`/`signing_key`→`_BLOCKED` with `key_material_detected:true`, `forbidden_field_ref`==NAME, and
  the planted VALUE absent from `JSON.stringify`; `signature`→`_BLOCKED` with `private_key_detected:false`; hostile→
  `_UNCONFIGURED` (no throw); readiness revoked→`_REJECTED`; verdict all-clean→`_PASS_ADVISORY` with all 24 flags
  false and no `can_send`/`signer_ready`/`signing_permitted`/`transaction_ready`; suppression ALWAYS carries
  `not_sign/send/execution_authorized` (clean AND blocked); health real-clean→`_SUPPRESSED`, explicit-not-suppressed→
  `_REVIEWED_ADVISORY`, both all-flags-false. The spot-check independently re-derived the always-suppressed invariant
  (one initially-wrong assertion in the spot-check was the spot-check's, not the code's; corrected to the stronger
  `_SUPPRESSED` expectation).

## 10. Guard / allowlist / drift / static impact
`ALLOWLIST` unchanged (single entry `packages/isolated-signer-runtime/src/`, line 121). Mechanism guard PASS
`sources=101 fixtures=27 allowlist=1 violations=0` — **`sources` unchanged at 101** (append-only; no new src file).
SSOT drift **EXACT baseline** (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83)
cmd=13 forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract
identifiers; bucket/state-enum names overlapping SSOT Group 15 (`connected_wallet`/`isolated_signer`/`active`/
`disabled`/`revoked`/`degraded`) are consumed-only input bucket values, not added to docs. `can_send:true` absent
repo-wide; no module-level mutable state; no planted private-key/seed VALUE literal in src. `docs/00`–`12` untouched.

---

**Confirmations:** Append-only (no new src file; PR-S11-A C/D/E untouched) · Custody-readiness advisory (safe buckets
only; revoked/required-unsatisfied→REJECTED; ACCEPTABLE_ADVISORY opens nothing) · Private-Key Forbidden Surface Guard
(scans NAMES only; BLOCKED on any key/seed/keypair/signature name; `forbidden_field_ref`==NAME; planted VALUE provably
absent from JSON; detection booleans true==BLOCKED-not-readiness) · Verdict (PASS_ADVISORY opens NO signer/signing/
transaction/can_send) · Suppression (ALWAYS suppressed:true carrying not_sign/send/execution_authorized) · Health
(real clean path → SUPPRESSED; REVIEWED_ADVISORY opens nothing) · A signing-review is not signing / a signature / a
private key / a signing permission / a send permission · No real signing · No private key material (never produced/
accepted/echoed) · No SignerService activation · No network primitive · No system clock · No persistence · No
dependency · No endpoint/secret in repo · No real signing/send/broadcast · No mainnet · No REAL-LIVE · No new SSOT
name · ALLOWLIST unchanged · `can_send:false` unchanged · full suite 1503/1503 · package 76/76 · independent spot-check
70/70.
