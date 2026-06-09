# E2 Stage-10 / PR-S10-A — Transaction-Build Input Boundary + Source/Builder Boundary + Candidate TX-Build Descriptor Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/transaction-build-review-foundations`** package with the first three read-only/advisory
> `transaction-build-review`-layer foundations **derived from Stage-9 route/execution-plan-preview outputs**:
> **Transaction-Build Input Boundary** (Part C), **Transaction Build Source / Builder Boundary** (Part D), and
> **Candidate Transaction Build Descriptor** (Part E). All are pure, import-free, function-I/O-only, deterministic,
> fail-closed (Fail-Safe-Not-Fail-Open). **A transaction-build review/descriptor is a READ-ONLY ADVISORY
> REPRESENTATION ONLY — NOT a transaction, NOT a serialized transaction, NOT message bytes, NOT a signing
> permission, NOT a send permission.** **No real transaction object / `VersionedTransaction` / `TransactionMessage`
> / `MessageV0` / instruction array / serialization / `message_bytes` / signature / blockhash / fee payer; no
> Jupiter/live-quote/aggregator/RPC call; no signing/send.** `can_send:false` repo-wide unchanged; `ALLOWLIST`
> unchanged.
>
> **State:** built on `main` @ `09c7212` (branch `pr-s10-a-txbuild-input-source-descriptor`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=99 fixtures=27 allowlist=1
> violations=0` · full suite **1389/1389** · transaction-build-review-foundations **37/37**.

---

## 1. New package
`packages/transaction-build-review-foundations/` — `package.json` (no dependencies), `src/index.{mjs,d.ts}`,
`src/transaction-build-review-foundations.{mjs,d.ts}`, `test/transaction-build-review-foundations.test.mjs`,
`README.md`. Import-free, pure, function-I/O-only; results are `Object.freeze` of fixed literals + fixed
string-token codes + whitelisted opaque refs. The functions **consume Stage-9 route results passed in** (src
import-free); the tests build a **real** Stage-4→9 chain to an `EXECUTION_PLAN_PREVIEW_PREVIEW_VALID` +
`ROUTE_HEALTH_PREVIEW_READY` state via the foundation evaluators.

## 2. Transaction-Build Input Boundary (Part C)
- `describeTransactionBuildInputBoundaryContract()` · `validateTransactionBuildInputBoundary()` ·
  `evaluateTransactionBuildInputBoundary()`. States `TX_BUILD_INPUT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` /
  `_VALID`. Input must come **only from Stage-9 route outputs**; raw intent/risk/signal/events refused
  (`raw_non_route_input_refused`). `eligible_for_tx_build_review` only when
  `execution_plan_preview_state===EXECUTION_PLAN_PREVIEW_PREVIEW_VALID` +
  `route_health_state===ROUTE_HEALTH_PREVIEW_READY` + not suppressed; route blocked/suppressed/preview-not-ready →
  fail-closed/not eligible.

## 3. Transaction Build Source / Builder Boundary (Part D)
- `describeTransactionBuildSourceBoundaryContract()` · `validateTransactionBuildSourceBoundary()` ·
  `evaluateTransactionBuildSourceBoundary()`. States `TX_BUILD_SOURCE_UNCONFIGURED` / `_INVALID` / `_READ_ONLY_OK`.
  A source is a **disabled/read-only descriptor TAG only** ∈ {`mock_tx_build_metadata`, `fixture_tx_build_metadata`,
  `solana_tx_builder_disabled`, `jupiter_tx_builder_disabled`, `manual_tx_review_disabled`}; output asserts
  **`builder_disabled:true`**, **`transaction_build_performed:false`**, **`serialization_performed:false`**,
  `network_call_made:false`, `endpoint_resolved:false`. `solana_tx_builder_disabled`/`jupiter_tx_builder_disabled`
  NEVER build a transaction or call a builder; endpoint/secret/build-flags refused & never echoed.

## 4. Candidate Transaction Build Descriptor (Part E)
- `describeCandidateTransactionBuildDescriptorContract()` · `validateCandidateTransactionBuildDescriptorInput()` ·
  `evaluateCandidateTransactionBuildDescriptor()`. States `CANDIDATE_TX_BUILD_*`. `tx_build_kind:'candidate_tx_build_descriptor'`;
  built from metadata buckets only. **No `transaction_id`/`transaction`/`VersionedTransaction`/`TransactionMessage`/
  `MessageV0`/`serialized_tx`/`message_bytes`/`base64`/`instruction_array`/`account_metas`/`recentBlockhash`/
  `blockhash`/`feePayer`/`signature`/`signer`.** `requires_serialization!==false`/`requires_signing!==false`/
  `requires_network!==false` → INVALID; `too_high` accounts/instructions/compute / `too_large` size /
  `required_unresolved` lookup table → rejected/degraded.
- **Metadata bucket vocabulary (spec-canonical):** account/instruction/compute = `unknown`/`low`/`medium`/`high`/
  `too_high`; transaction_size = `unknown`/`small`/`medium`/`large`/`too_large`; lookup_table = `unknown`/
  `not_needed`/`maybe_needed`/`required_unresolved`; priority_fee = `unknown`/`low`/`medium`/`high`.

## 5. Spec-conformance correction (transparent)
The multi-agent build produced an internally-consistent package but used **bucket-value synonyms** that deviated
from the Stage-10 spec's enumerated values (`moderate` instead of `medium`; `none`/`resolved` instead of
`not_needed`/`maybe_needed`). My independent main-loop behavioral spot-check (using the spec's canonical values)
surfaced this: the valid-fixture descriptor was incorrectly returning `CANDIDATE_TX_BUILD_INVALID`. **Fix:** the
six bucket-enum constants in `src` and the test fixture were corrected to the spec's canonical values
(`medium`/`not_needed`/`maybe_needed`); the `.d.ts`/README carried no enumerated literals (generic types). After
the fix: descriptor with spec buckets → `CANDIDATE_TX_BUILD_DESCRIPTOR`; too_high/too_large/required_unresolved →
rejected/degraded; package 37/37; full suite 1389/1389; guard `sources=99` unchanged.

## 6. Tx-build review ≠ transaction / serialization / signing / send
Every result spreads a shared `txSafeFlags()`: `read_only:true` and the **23** flags `signal_ready`/`trading_ready`/
`risk_ready`/`intent_ready`/`routing_ready`/`route_ready`/`order_ready`/`transaction_ready`/`serialized_ready`/
`message_bytes_ready`/`can_send`/`can_broadcast`/`can_serialize`/`signing_permitted`/`broadcast_permitted`/
`is_live`/`mainnet_enabled`/`real_live`/`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/
`live_quote_enabled`/`has_secret` = **false** — on **every** state, including `TX_BUILD_INPUT_VALID`,
`TX_BUILD_SOURCE_READ_ONLY_OK`, and `CANDIDATE_TX_BUILD_DESCRIPTOR`. `transaction_ready`/`serialized_ready`/
`message_bytes_ready`/`signing_permitted`/`can_serialize`/`can_send` **stay false** — review/descriptor existence is
carried only by dedicated fields (`tx_build_input_boundary_valid`/`eligible_for_tx_build_review`/
`tx_build_source_valid`/`candidate_tx_build_descriptor_valid`/`candidate_tx_build_state`), never by a readiness flag
(`builder_disabled:true` is the only positive assertion — the safe state). No output carries a real-transaction /
serialization / signature / blockhash artifact field. **No tx-build-review → transaction / serialization / signing /
send / trading-readiness conversion.**

## 7. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/unknown/raw-input/smuggled-forbidden-flag/exec-or-serialize-or-sign-or-send-command/
secret/endpoint/mainnet input → fail-closed (`*_UNCONFIGURED`/`*_INVALID`/`*_REJECTED`); secret/endpoint values
**never echoed**; both hostile-proxy variants (throwing-accessor and function-returning, via a `txUninspectable`
guard + try/catch) → frozen `*_UNCONFIGURED` with `input_inspection_error`, **never throws**.

## 8. Tests summary
New `test/transaction-build-review-foundations.test.mjs` — 37 proofs built against a **real** Stage-9
`EXECUTION_PLAN_PREVIEW_PREVIEW_VALID` chain, covering every required Stage-10 Parts-C/D/E test (missing/invalid/
suppressed/preview-not-ready → fail-closed/not-eligible · preview-valid+ready → boundary valid only · raw intent/
risk/signal refused · smuggled tx/serialize/sign/send flags refused · endpoint/key/secret refused & never echoed ·
mainnet/REAL-LIVE refused · hostile frozen · source disabled-tags-only · descriptor only on valid input+source ·
too_high/too_large/required_unresolved → rejected/degraded · no transaction/serialized_tx/message_bytes/
instruction_array/signature/blockhash/feePayer field) · descriptors · static guards (import-free, no `can_send:true`,
no mutable module state). **transaction-build-review-foundations 37/37; full suite 1389/1389** (1352 + 37).
Independent main-loop behavioral spot-check: **all checks PASS after the bucket-vocabulary correction** (real
Stage-9 inputs).

## 9. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=99 fixtures=27 allowlist=1 violations=0` — **`sources` rose
97 → 99** (the two new package src `.mjs` files); `allowlist=1`/`violations=0` unchanged. SSOT drift **unchanged at
baseline** (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13
forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract identifiers.

## 10. No-live / no-transaction-build / no-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no Jupiter/aggregator/live-quote/RPC-route call; no real transaction build /
serialization / message bytes; no DB/Redis/Postgres/ClickHouse/filesystem/persistence; no mutable module/global
state; no SDK/dependency; no endpoint/secret in src/README; no signing/send/broadcast; no KMS/Vault/KeyManager; no
private key material; no mainnet; no REAL-LIVE.

## 11. Readiness impact
None — a tx-build-input-valid / source-valid / candidate-descriptor state is **not** transaction/serialization/
signing/send/trading readiness; the pipeline (`data → signal → risk → intent → route → sign → send`) is advanced
only into the read-only/advisory transaction-build-**review** foundation (no real build); `can_send:false` repo-wide
unchanged.

---

**Confirmations:** New `transaction-build-review-foundations` package · TX-build input boundary (Stage-9-only; raw
intent/risk/signal refused; preview must be PREVIEW_VALID + PREVIEW_READY) · TX-build source/builder boundary
(disabled/read-only tags only; `solana_tx_builder_disabled`/`jupiter_tx_builder_disabled` never build;
`builder_disabled:true`/`transaction_build_performed:false`/`serialization_performed:false`) · Candidate tx-build
descriptor (metadata buckets only, spec-canonical vocabulary; no transaction/serialized_tx/message_bytes/
instruction_array/signature/blockhash/feePayer) · A tx-build review/descriptor is not a transaction / serialized
transaction / message bytes / signing permission / send permission · No tx-build→transaction/serialization/signing/
send conversion · No real transaction build · No Jupiter live call · No live quote · No serialization · No network
primitive · No system clock · No persistence · No dependency · No endpoint/secret in repo · No secret echoed · No
signing/send/broadcast · No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged · `can_send:false`
unchanged · route + intent + risk + signal + intelligence + ingestion + gate-a + rpc-provider + send-gate green.
