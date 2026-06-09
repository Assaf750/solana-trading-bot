# E2 Stage-9 / PR-S9-A — Route Input Boundary + Route Source/Provider Boundary + Candidate Route Plan Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/route-planning-foundations`** package with the first three read-only/advisory `route`-layer
> foundations **derived from Stage-8 intent-ledger outputs**: **Route Input Boundary** (Part C), **Route Source /
> Provider Boundary** (Part D), and **Candidate Route Plan** (Part E). All are pure, import-free, function-I/O-only,
> deterministic, fail-closed (Fail-Safe-Not-Fail-Open). **A candidate route plan is a READ-ONLY ADVISORY
> REPRESENTATION ONLY — NOT an order, NOT a transaction, NOT a signing permission, NOT a send permission, NOT
> trading/transaction readiness.** **No Jupiter call, no live quote, no aggregator call, no RPC route call, no
> transaction build, no order, no signing, no send.** `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `bf18d44` (branch `pr-s9-a-route-input-source-candidate`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=97 fixtures=27 allowlist=1
> violations=0` · full suite **1314/1314** · route-planning-foundations **34/34**.

---

## 1. New package
`packages/route-planning-foundations/` — `package.json` (no dependencies), `src/index.{mjs,d.ts}`,
`src/route-planning-foundations.{mjs,d.ts}`, `test/route-planning-foundations.test.mjs`, `README.md`. Import-free,
pure, function-I/O-only; results are `Object.freeze` of fixed literals + fixed string-token codes + whitelisted
opaque refs. The route functions **consume Stage-8 intent results passed in** (src import-free); the tests build a
**real** Stage-4→5→6→7→8 chain to an `INTENT_AWAITING_ROUTE_REVIEW` state via the foundation evaluators.

## 2. Route Input Boundary (Part C)
- `describeRouteInputBoundaryContract()` · `validateRouteInputBoundary()` · `evaluateRouteInputBoundary()`.
- States `ROUTE_INPUT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_VALID`. Verifies route input comes **only from
  Stage-8 intent outputs** (intent input boundary + candidate record + ledger append + state + audit + suppression +
  health), each recognized by its intent-layer state field and carrying `read_only:true` — **not raw risk, signal,
  intelligence, events, or trading commands**. Output: `route_input_boundary_valid`, `eligible_for_route_review`,
  `route_input_state`. A raw risk/signal/intelligence/event in any slot → `raw_non_intent_input_refused` → `INVALID`.
  **Intent not awaiting route review (`intent_state !== INTENT_AWAITING_ROUTE_REVIEW`), intent suppressed, blocked
  health, or invalid audit → fail-closed / not eligible** (`ROUTE_INPUT_DEGRADED`/`INVALID`). Only intent awaiting
  route review (`INTENT_AWAITING_ROUTE_REVIEW` + `INTENT_HEALTH_AWAITING_ROUTE_REVIEW`) + not suppressed +
  `INTENT_AUDIT_VALID` → `ROUTE_INPUT_VALID` with `eligible_for_route_review:true` (still no readiness flags).

## 3. Route Source / Provider Boundary (Part D)
- `describeRouteSourceBoundaryContract()` · `validateRouteSourceBoundary()` · `evaluateRouteSourceBoundary()`.
- States `ROUTE_SOURCE_UNCONFIGURED` / `_INVALID` / `_READ_ONLY_OK`. A route source is a **disabled/read-only
  descriptor TAG only** ∈ {`mock_route_metadata`, `fixture_route_metadata`, `jupiter_disabled`,
  `aggregator_disabled`, `manual_route_review_disabled`} — never an endpoint, SDK, or live call. Output:
  `route_source_valid`, `route_source_state`, **`live_quote_enabled:false`**, **`network_call_made:false`**,
  **`endpoint_resolved:false`**, **`provider_disabled:true`**. `jupiter_disabled`/`aggregator_disabled` are accepted
  **only as disabled/read-only** — they NEVER enable Jupiter/aggregator/live quote. Missing → `UNCONFIGURED`;
  unknown tag → `INVALID`; an endpoint URL field / api_key/secret/token / smuggled live_quote/network/
  route-execution flag / mainnet/REAL-LIVE → `INVALID` and **never echoed**.

## 4. Candidate Route Plan (Part E)
- `describeCandidateRoutePlanContract()` · `validateCandidateRoutePlanInput()` · `evaluateCandidateRoutePlan()`.
- States `CANDIDATE_ROUTE_UNCONFIGURED` / `_INVALID` / `_REJECTED` / `_CANDIDATE` (with a degraded path on
  weak metadata). Output: `candidate_route_valid`, `candidate_route_state`, `route_plan_ref`, `intent_record_ref`,
  `route_kind:'candidate_route_plan'`, `route_reason_codes` (fixed allowlist). Built from **route metadata input
  buckets ONLY** (`route_hop_count_bucket`/`liquidity_bucket`/`estimated_slippage_bucket`/`route_quality_bucket`)
  with `requires_live_quote:false` + `no_transaction_build:true` required. `route_input_boundary` not
  `ROUTE_INPUT_VALID` or `route_source_boundary` not `ROUTE_SOURCE_READ_ONLY_OK` → rejected/unconfigured;
  `requires_live_quote!==false` or `no_transaction_build!==true` → `CANDIDATE_ROUTE_INVALID`; `many` hops / `poor`
  quality / `thin` liquidity / `high` slippage → rejected/degraded (Fail-Safe); smuggled order/tx/sign/send/quote/
  instruction key → `CANDIDATE_ROUTE_INVALID`. **FORBIDDEN in output (verified absent): `order_id`,
  `transaction_id`, `serialized_tx`, `signature`, `private_key`, `quote_response`, `jupiter_route_object`,
  `executable_instruction`, `swap_instruction`, `compute_budget_instruction`, send/broadcast flag.** Candidate route
  opens no `transaction_ready`/`signing_permitted`/`can_send`.

## 5. Candidate route ≠ order / transaction / signing / send
Every result spreads a shared `routeSafeFlags()`: `read_only:true` and the **21** flags `signal_ready`/
`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`route_ready`/`order_ready`/`transaction_ready`/
`can_send`/`can_broadcast`/`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/
`real_live`/`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`live_quote_enabled`/`has_secret` =
**false** — on **every** state, including `ROUTE_INPUT_VALID`, `ROUTE_SOURCE_READ_ONLY_OK`, and
`CANDIDATE_ROUTE_CANDIDATE`. `route_ready`/`order_ready`/`transaction_ready`/`live_quote_enabled` **stay false** —
"route reviewed / source valid / candidate route exists" is carried only by dedicated fields
(`route_input_boundary_valid` / `eligible_for_route_review` / `route_source_valid` / `candidate_route_valid` /
`candidate_route_state`), never by an execution/readiness flag (`provider_disabled:true` is the only positive
assertion — it means the provider IS disabled, the safe state). **No route → order / transaction / signing / send /
trading-readiness conversion.**

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/unknown/raw-input/smuggled-forbidden-flag/exec-or-quote-command/secret/
endpoint/mainnet input → fail-closed (`*_UNCONFIGURED`/`*_INVALID`/`*_REJECTED`); secret/endpoint values **never
echoed**; both hostile-proxy variants (throwing-accessor and function-returning, via a `routeUninspectable` guard +
try/catch) → frozen `*_UNCONFIGURED` with `input_inspection_error`, **never throws**.

## 7. Tests summary
New `test/route-planning-foundations.test.mjs` — 34 proofs built against a **real** Stage-8
`INTENT_AWAITING_ROUTE_REVIEW` chain, covering every required Stage-9 Parts-C/D/E test (missing/invalid/not-awaiting/
suppressed intent → fail-closed/not-eligible · valid awaiting → boundary valid only · raw risk/signal/intelligence
refused · smuggled order/tx/sign/send flags refused · endpoint/key/secret refused & never echoed · mainnet/REAL-LIVE
refused · hostile frozen · source missing/unknown → fail-closed · mock/fixture → read-only only · jupiter_disabled
disabled-only · candidate only on valid input+source · high hop/bad quality → rejected/degraded · no order_id/
transaction_id/serialized_tx/signature/quote_response/jupiter_route_object/swap_instruction field) · descriptors ·
static guards (import-free, no `can_send:true`, no mutable module state). **route-planning-foundations 34/34; full
suite 1314/1314** (1280 + 34). Independent main-loop behavioral spot-check: **16/16 PASS** (real Stage-8 inputs).

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=97 fixtures=27 allowlist=1 violations=0` — **`sources` rose
95 → 97** (the two new package src `.mjs` files); `allowlist=1`/`violations=0` unchanged. SSOT drift **unchanged at
baseline** (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13
forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract identifiers; no
SSOT route vocabulary (`active_exit_route`/`execution_mode=jupiter_route`) introduced (`jupiter_disabled`/
`aggregator_disabled` are local disabled markers).

## 9. No-live / no-Jupiter / no-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no Jupiter/aggregator/live-quote/RPC-route call; no DB/Redis/Postgres/ClickHouse/
filesystem/persistence; no mutable module/global state; no SDK/dependency; no endpoint/secret in src/README; no
transaction build/serialization; no order; no swap/compute-budget instruction; no paper execution / position
lifecycle; no signing/send/broadcast; no KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 10. Readiness impact
None — a route-input-valid / source-valid / candidate-route state is **not** order/transaction/signing/send/trading
readiness; the pipeline (`data → signal → risk → intent → route → sign → send`) is advanced only into the
read-only/advisory `route` foundation; `can_send:false` repo-wide unchanged.

---

**Confirmations:** New `route-planning-foundations` package · Route input boundary (Stage-8-only; raw risk/signal/
intelligence refused; intent must be awaiting route review) · Route source/provider boundary (disabled/read-only
tags only; `jupiter_disabled` never enables Jupiter/live quote; `live_quote_enabled:false`/`provider_disabled:true`)
· Candidate route plan (metadata buckets only; no order_id/transaction_id/serialized_tx/signature/quote_response/
jupiter_route_object/swap_instruction) · A candidate route plan is not an order / transaction / signing permission /
send permission · No route→order/transaction/signing/send conversion · No Jupiter live call · No live quote · No
aggregator call · No network primitive · No system clock · No persistence · No dependency · No endpoint/secret in
repo · No secret echoed · No transaction build/serialize · No signing/send/broadcast · No mainnet · No REAL-LIVE ·
No new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged · intent + risk + signal + intelligence +
ingestion + gate-a + rpc-provider + send-gate green.
