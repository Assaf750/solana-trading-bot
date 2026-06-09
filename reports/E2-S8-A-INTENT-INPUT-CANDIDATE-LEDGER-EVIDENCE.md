# E2 Stage-8 / PR-S8-A — Intent Input Boundary + Candidate Intent Record + Intent Ledger Append/Evaluate Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/intent-ledger-foundations`** package with the first three read-only/advisory `intent`-layer
> foundations **derived from Stage-7 risk-engine outputs**: **Intent Input Boundary** (Part C), **Candidate Intent
> Record** (Part D), and **Intent Ledger Append/Evaluate** (Part E, pure / in-memory only). All are pure,
> import-free, function-I/O-only, deterministic, fail-closed (Fail-Safe-Not-Fail-Open). **A candidate intent record
> is an AUDITABLE REPRESENTATION ONLY — NOT an order, NOT a route, NOT a transaction, NOT a signing permission, NOT
> a send permission, NOT trading/route readiness.** The ledger is **pure / in-memory** (`previous_records` passed
> in; `persistence_performed:false`; no mutable module state). **No network primitive, no persistence/DB, no live
> stream, no system clock, no endpoint/secret, no dependency.** `can_send:false` repo-wide unchanged; `ALLOWLIST`
> unchanged.
>
> **State:** built on `main` @ `afcfd75` (branch `pr-s8-a-intent-input-candidate-ledger`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=95 fixtures=27 allowlist=1
> violations=0` · full suite **1242/1242** · intent-ledger-foundations **37/37**.

---

## 1. New package
`packages/intent-ledger-foundations/` (distinct from the pre-existing `packages/intent-ledger`) — `package.json`
(no dependencies), `src/index.{mjs,d.ts}`, `src/intent-ledger-foundations.{mjs,d.ts}`,
`test/intent-ledger-foundations.test.mjs`, `README.md`. Import-free, pure, function-I/O-only; results are
`Object.freeze` of fixed literals + fixed string-token codes + whitelisted opaque refs. The intent functions
**consume Stage-7 risk results passed in** (src import-free); the tests build **real** Stage-7 results via the
`risk-engine-foundations` evaluators (over real Stage-6 signals over real Stage-5 intelligence over real Stage-4
normalized events).

## 2. Intent Input Boundary (Part C)
- `describeIntentInputBoundaryContract()` · `validateIntentInputBoundary()` · `evaluateIntentInputBoundary()`.
- States `INTENT_INPUT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_VALID`. Verifies intent input comes **only from
  Stage-7 risk outputs** (risk input boundary + hard-risk + liquidity-exit + exposure + risk verdict + risk
  suppression + risk health), each recognized by its risk-layer state field and carrying `read_only:true` — **not
  raw signal, raw intelligence, raw events, or trading commands**. Output: `intent_input_boundary_valid`,
  `eligible_for_candidate_intent`, `intent_input_state`. A raw signal/intelligence/event in any slot →
  `raw_non_risk_input_refused` → `INVALID`. **risk BLOCKED / DEGRADED / suppressed / not-`RISK_HEALTH_PASS_ADVISORY`
  → fail-closed / not eligible** (`INTENT_INPUT_DEGRADED`). Only `risk_verdict=RISK_PASS_ADVISORY` +
  `risk_health=RISK_HEALTH_PASS_ADVISORY` + not suppressed → `INTENT_INPUT_VALID` with
  `eligible_for_candidate_intent:true` (still no readiness flags).

## 3. Candidate Intent Record (Part D)
- `describeCandidateIntentRecordContract()` · `validateCandidateIntentRecordInput()` · `evaluateCandidateIntentRecord()`.
- States `CANDIDATE_INTENT_UNCONFIGURED` / `_INVALID` / `_REJECTED` / `_RECORDED`. Output: `candidate_intent_valid`,
  `candidate_intent_state`, `intent_kind:'candidate_trade_intent'`, `intent_record_ref`, `wallet_ref`, `token_ref`,
  `risk_verdict_ref`, `signal_ref`, `reason_codes` (fixed allowlist), `audit_required:true`. A risk verdict that is
  not `RISK_PASS_ADVISORY` (or an invalid intent input boundary) → `CANDIDATE_INTENT_REJECTED` (no candidate
  intent). A smuggled order/route/transaction/sign/send key or forbidden flag/secret/endpoint →
  `CANDIDATE_INTENT_INVALID`. **FORBIDDEN in output (verified absent): `order_id`, `route_id`, `transaction_id`,
  `serialized_tx`, `signature`, `private_key`, real trade size, slippage execution config, `quote`,
  `jupiter_route`, send/broadcast flag.** A candidate intent opens no `route_ready`/`transaction_ready`/
  `signing_permitted`/`can_send`.

## 4. Intent Ledger Append / Evaluate (Part E)
- `describeIntentLedgerContract()` · `validateIntentLedgerAppend()` · `evaluateIntentLedgerAppend()`.
- States `INTENT_LEDGER_UNCONFIGURED` / `_INVALID` / `_DUPLICATE` / `_APPEND_EVALUATED`. **Pure / in-memory only:**
  `previous_records` is an array passed as a function argument; `ledger_record_count` is derived from it; there is
  **no mutable module/global state** and **no `.push` into any module-level array**. Output: `append_valid`,
  `ledger_state`, `ledger_record_count`, `appended_record_ref`, `duplicate_record_detected`, `audit_required:true`,
  **`persistence_performed:false` (always)**. A `candidate_intent_record` that is not `CANDIDATE_INTENT_RECORDED` →
  `INTENT_LEDGER_INVALID` (append refused); a `previous_records` entry with the same `intent_record_ref` →
  `INTENT_LEDGER_DUPLICATE` (append refused); else `INTENT_LEDGER_APPEND_EVALUATED` (evaluated in-memory only).
  **No DB / filesystem / persistence / network / event bus / command dispatch.** Append opens no
  routing/signing/send/broadcast.

## 5. Intent record ≠ order / route / transaction / signing / send
Every boundary/candidate/ledger result spreads a shared `intentSafeFlags()`: `read_only:true` and the **20**
execution/readiness flags `signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`route_ready`/
`order_ready`/`transaction_ready`/`can_send`/`can_broadcast`/`can_serialize`/`signing_permitted`/
`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/`live_stream_enabled`/`network_call_made`/
`endpoint_resolved`/`has_secret` = **false** — on **every** state, including `INTENT_INPUT_VALID`,
`CANDIDATE_INTENT_RECORDED`, and `INTENT_LEDGER_APPEND_EVALUATED`. **`intent_ready`/`route_ready`/`order_ready`/
`transaction_ready` stay false** — "a candidate intent exists / was append-evaluated" is carried only by dedicated
fields (`candidate_intent_valid` / `candidate_intent_state` / `eligible_for_candidate_intent` / `intent_record_ref`
/ `append_valid`), never by an execution/readiness flag. **No intent → route / order / transaction / signing /
send / trading-readiness conversion.**

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/unknown/raw-input/smuggled-forbidden-flag/exec-command/secret/endpoint/
mainnet input → fail-closed (`*_UNCONFIGURED`/`*_INVALID`/`*_REJECTED`); secret/endpoint values **never echoed**;
both hostile-proxy variants (throwing-accessor and function-returning, via an `intentUninspectable` guard +
try/catch) → frozen `*_UNCONFIGURED` with `input_inspection_error`, **never throws**.

## 7. Tests summary
New `test/intent-ledger-foundations.test.mjs` — 37 proofs built against **real** Stage-7 risk results, covering
every required Stage-8 Parts-C/D/E test (missing/invalid/blocked/degraded risk → fail-closed/not-eligible · advisory
pass → boundary valid only · raw signal refused · smuggled route/order/tx/sign/send flags → refused ·
endpoint/key/secret → refused & never echoed · mainnet/REAL-LIVE → refused · hostile → frozen no throw · candidate
record only on risk pass · no order_id/route_id/transaction_id/serialized_tx/signature/quote field · append
in-memory only with `persistence_performed:false` · duplicate detected · invalid candidate append refused) ·
descriptors · static guards (import-free, no `can_send:true`, no mutable module ledger array). **intent-ledger-
foundations 37/37; full suite 1242/1242** (1205 + 37). Independent main-loop behavioral spot-check: **15/15 PASS**
(real Stage-7 inputs).

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=95 fixtures=27 allowlist=1 violations=0` — **`sources` rose
93 → 95** (the two new package src `.mjs` files); `allowlist=1`/`violations=0` unchanged. SSOT drift **unchanged at
baseline** (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13
forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract identifiers; no
SSOT intent vocabulary (`intent_id`/`intent_type`/`BUY_INTENT`/`IntentLedger`/`issuing_brain`) introduced; the
pre-existing `packages/intent-ledger` is untouched.

## 9. No-live / no-execution / no-persistence / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no DB/Redis/Postgres/ClickHouse/filesystem/persistence; no mutable module/global
state; no SDK/dependency; no endpoint/secret in src/README; no routing/Jupiter/route planning/quote; no transaction
build/serialization; no order; no paper execution / position lifecycle; no signing/send/broadcast; no
KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 10. Readiness impact
None — an intent-input-valid / candidate-recorded / append-evaluated state is **not** route/order/transaction/
signing/send/trading readiness; the pipeline (`data → signal → risk → intent → route → …`) is advanced only into
the read-only/advisory `intent` foundation; `can_send:false` repo-wide unchanged.

---

**Confirmations:** New `intent-ledger-foundations` package (distinct from pre-existing `intent-ledger`) · Intent
input boundary (Stage-7-only; raw signal/intelligence refused; risk must be advisory-pass) · Candidate intent
record (auditable representation only; no order_id/route_id/transaction_id/serialized_tx/signature/quote) · Intent
ledger append (pure/in-memory; `persistence_performed:false`; no mutable module state) · An intent record is not an
order / route / transaction / signing permission / send permission · No intent→route/order/tx/signing/send
conversion · No network primitive · No persistence/DB · No live stream · No system clock · No dependency · No
endpoint/secret in repo · No secret echoed · No signing/send/broadcast/serialize · No mainnet · No REAL-LIVE · No
new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged · risk + signal + intelligence + ingestion +
gate-a + rpc-provider + send-gate green.
