# E2 Stage-11 / PR-S11-A — Signing-Review Input Boundary + Signer/Custody Boundary + Candidate Signing-Review Descriptor Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/signing-review-foundations`** package with the first three read-only/advisory `signing-review`-layer
> foundations **derived from Stage-10 transaction-build-review outputs**: **Signing-Review Input Boundary** (Part C),
> **Signer Profile / Custody Boundary** (Part D), and **Candidate Signing-Review Descriptor** (Part E). All are
> pure, import-free, function-I/O-only, deterministic, fail-closed (Fail-Safe-Not-Fail-Open). **A signing-review/
> descriptor is a READ-ONLY ADVISORY REPRESENTATION ONLY — it REVIEWS signing PREREQUISITES from safe metadata; it
> is NOT signing, NOT a signature, NOT a private key, NOT key material, NOT a signing permission, NOT a send
> permission, NOT signing/trading readiness.** **No real signing, no SignerService activation, no private key / seed
> / mnemonic / keypair material of any kind, no crypto signing call, no send/broadcast.** `can_send:false` repo-wide
> unchanged; `ALLOWLIST` unchanged; the pre-existing `signer-*`/`custody-*` packages untouched.
>
> **State:** built on `main` @ `2fbe869` (branch `pr-s11-a-signing-input-signer-descriptor`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=101 fixtures=27 allowlist=1
> violations=0` · full suite **1461/1461** · signing-review-foundations **34/34**.

---

## 1. New package
`packages/signing-review-foundations/` (distinct from the pre-existing `signer-boundary`/`signer-profiles-registry`/
`signer-service-boundary`/`signing-adapter-contract`/`custody-provider-contract`/`keyless-custody-lifecycle`/
`isolated-signer-runtime`) — `package.json` (no dependencies), `src/index.{mjs,d.ts}`,
`src/signing-review-foundations.{mjs,d.ts}`, `test/signing-review-foundations.test.mjs`, `README.md`. Import-free,
pure, function-I/O-only. The functions **consume Stage-10 tx-build results passed in** (src import-free); the tests
build a **real** Stage-4→10 chain to a `TX_BUILD_REVIEW_PASS_ADVISORY` + `TX_BUILD_HEALTH_REVIEWED_ADVISORY` state.

## 2. Signing-Review Input Boundary (Part C)
- `describeSigningReviewInputBoundaryContract()` · `validateSigningReviewInputBoundary()` ·
  `evaluateSigningReviewInputBoundary()`. States `SIGNING_REVIEW_INPUT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` /
  `_VALID`. Input must come **only from Stage-10 tx-build-review outputs**; raw route/earlier/events refused
  (`raw_non_tx_build_input_refused`). `eligible_for_signing_review` only when
  `tx_build_review_state===TX_BUILD_REVIEW_PASS_ADVISORY` + `tx_build_health_state===TX_BUILD_HEALTH_REVIEWED_ADVISORY`
  + not suppressed; tx-build blocked/suppressed/serialization-blocked/review-not-pass → fail-closed/not eligible.

## 3. Signer Profile / Custody Boundary (Part D)
- `describeSignerCustodyBoundaryContract()` · `validateSignerCustodyBoundary()` · `evaluateSignerCustodyBoundary()`.
  States `SIGNER_CUSTODY_UNCONFIGURED` / `_INVALID` / `_READ_ONLY_OK`. A signer source is a **disabled/read-only
  descriptor TAG only** ∈ {`mock_signer_metadata`, `fixture_signer_metadata`, `isolated_signer_disabled`,
  `connected_wallet_disabled`, `manual_signing_review_disabled`}; output asserts **`signer_disabled:true`**,
  **`signing_performed:false`**, **`key_loaded:false`**, **`key_material_present:false`**, `network_call_made:false`,
  `endpoint_resolved:false`. `isolated_signer_disabled`/`connected_wallet_disabled` NEVER load a key, sign, or
  activate a signer; endpoint/secret/private-key/seed/keypair material refused & never echoed.

## 4. Candidate Signing-Review Descriptor (Part E)
- `describeCandidateSigningReviewDescriptorContract()` · `validateCandidateSigningReviewDescriptorInput()` ·
  `evaluateCandidateSigningReviewDescriptor()`. States `CANDIDATE_SIGNING_REVIEW_*`.
  `signing_review_kind:'candidate_signing_review_descriptor'`; built from **safe metadata buckets only**
  (`key_custody_mode_bucket` ∈ unknown/connected_wallet/isolated_signer; `signer_profile_status_bucket` ∈
  unknown/active/disabled/revoked/degraded; `dual_control_bucket` ∈ unknown/not_required/required_unsatisfied/
  required_satisfied; `signer_reachability_bucket` ∈ unknown/unreachable/reachable). **No `private_key`/`secret_key`/
  `keypair`/`mnemonic`/`seed`/`signature`/`signed_tx`/`transaction`/`serialized_tx`/`message_bytes`.**
  `requires_key_material`/`requires_signing`/`requires_network` true → INVALID; revoked/disabled status,
  required-unsatisfied dual-control, or unreachable signer → rejected/degraded (Fail-Safe). Descriptor opens no
  `signer_ready`/`signing_permitted`/`transaction_ready`/`can_send`.

## 5. Signing-review ≠ signing / key material / send
Every result spreads a shared `signSafeFlags()`: `read_only:true` and the **24** flags `signal_ready`/
`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`route_ready`/`order_ready`/`transaction_ready`/
`serialized_ready`/`message_bytes_ready`/`signer_ready`/`signing_permitted`/`broadcast_permitted`/`can_send`/
`can_broadcast`/`can_serialize`/`is_live`/`mainnet_enabled`/`real_live`/`live_stream_enabled`/`network_call_made`/
`endpoint_resolved`/`live_quote_enabled`/`has_secret` = **false** — on **every** state, including
`SIGNING_REVIEW_INPUT_VALID`, `SIGNER_CUSTODY_READ_ONLY_OK`, and `CANDIDATE_SIGNING_REVIEW_DESCRIPTOR`.
`signer_ready`/`signing_permitted`/`transaction_ready`/`can_send` **stay false** (`signer_disabled:true` is the only
positive assertion — the safe state). No output carries a private-key/seed/keypair/signature/transaction artifact
field. **No signing-review → signing / send / transaction / trading-readiness conversion.**

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/unknown/raw-input/smuggled-forbidden-flag/exec-or-sign-or-send-command/
secret/endpoint/mainnet/**private-key-material** input → fail-closed (`*_UNCONFIGURED`/`*_INVALID`/`*_REJECTED`);
secret/endpoint/**key-material** values **never echoed** (a planted `private_key`/`seed` value is provably absent
from `JSON.stringify`); both hostile-proxy variants (throwing-accessor and function-returning, via a
`signUninspectable` guard + try/catch) → frozen `*_UNCONFIGURED`, **never throws**.

## 7. Tests summary
New `test/signing-review-foundations.test.mjs` — 34 proofs built against a **real** Stage-10
`TX_BUILD_REVIEW_PASS_ADVISORY` chain, covering every required Stage-11 Parts-C/D/E test (missing/invalid/suppressed/
review-not-pass → fail-closed/not-eligible · PASS_ADVISORY+REVIEWED_ADVISORY → boundary valid only · raw route/
earlier refused · smuggled sign/send/key flags refused · endpoint/key/secret/private_key/seed refused & never
echoed · mainnet/REAL-LIVE refused · hostile frozen · signer source disabled-tags-only with `key_loaded:false`/
`key_material_present:false` · descriptor only on valid input+source · revoked/required-unsatisfied/unreachable →
rejected/degraded · no private_key/secret_key/keypair/mnemonic/seed/signature/signed_tx/transaction/serialized_tx/
message_bytes field) · descriptors · static guards (import-free, no `can_send:true`, no mutable module state, no
private-key/seed VALUE literal). **signing-review-foundations 34/34; full suite 1461/1461** (1427 + 34).
Independent main-loop behavioral spot-check: **17/17 PASS** (real Stage-10 inputs, incl. planted-private-key
no-echo).

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=101 fixtures=27 allowlist=1 violations=0` — **`sources` rose
99 → 101** (the two new package src `.mjs` files); `allowlist=1`/`violations=0` unchanged. SSOT drift **unchanged at
baseline** (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13
forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract identifiers;
bucket values overlapping SSOT Group 15 (`connected_wallet`/`isolated_signer`/`active`/`disabled`/`revoked`/
`degraded`) are consumed-only input bucket values, not added to docs.

## 9. No-signing / no-key-material / no-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`.sign(`/`process.env`/`node:fs`/
`readFileSync`/system clock; no live stream; no SignerService activation; **no private key / seed / mnemonic /
keypair material (value, field, call, or literal) anywhere — forbidden names appear only in the descriptor's
forbidden-field allowlist + prose**; no DB/Redis/Postgres/ClickHouse/filesystem/persistence; no mutable module/
global state; no SDK/dependency; no endpoint/secret in src/README; no real signing/send/broadcast/serialize; no
mainnet; no REAL-LIVE.

## 10. Readiness impact
None — a signing-review-input-valid / signer-custody-valid / candidate-descriptor state is **not** signing/send/
transaction/trading readiness; the pipeline (`data → … → route → sign → send`) is advanced only into the read-only/
advisory signing-**review** foundation (no real signing); `can_send:false` repo-wide unchanged.

---

**Confirmations:** New `signing-review-foundations` package (distinct from pre-existing signer-*/custody-*,
untouched) · Signing-review input boundary (Stage-10-only; raw route/earlier refused; review must be PASS_ADVISORY +
REVIEWED_ADVISORY) · Signer/custody boundary (disabled/read-only tags only; never loads a key or signs;
`key_material_present:false`) · Candidate signing-review descriptor (safe metadata buckets only; no private_key/seed/
keypair/signature/transaction) · A signing-review is not signing / a signature / a private key / a signing
permission / a send permission · No signing-review→signing/send/transaction conversion · No real signing · No
private key material (never produced/accepted/echoed) · No SignerService activation · No network primitive · No
system clock · No persistence · No dependency · No endpoint/secret in repo · No secret/key echoed · No real
signing/send/broadcast · No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged · `can_send:false`
unchanged · tx-build + route + intent + risk + signal + intelligence + ingestion + gate-a + rpc-provider + send-gate
green.
