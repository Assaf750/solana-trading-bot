# E2 Stage-9 / PR-S9-B — Route Feasibility/Slippage + Execution Plan Preview + Route Suppression + Route Health Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends four
> read-only/advisory `route`-layer foundations to `@soltrade/route-planning-foundations`: **Route Feasibility /
> Slippage Advisory** (Part F), **Execution Plan Preview** (Part G), **Route Suppression / Rejection** (Part H), and
> **Route Health / Status** (Part I). All are pure, import-free, function-I/O-only, deterministic, fail-closed
> (Fail-Safe-Not-Fail-Open), and consume PRIOR route results (candidate route plan + feasibility + preview +
> suppression) and safe input buckets. **A route feasibility/preview/health result is a READ-ONLY ADVISORY
> REPRESENTATION ONLY — NOT an order, NOT a transaction, NOT a signing permission, NOT a send permission. Even
> `ROUTE_HEALTH_PREVIEW_READY` and a feasible-advisory route do NOT open `transaction_ready`/`signing_permitted`/
> `can_serialize`/`can_send`. An execution plan preview is NOT a transaction — it carries only the fixed marker
> `requires_next_stage:'transaction_build_review'`.** No Jupiter/live-quote/aggregator call, no transaction build,
> no serialization, no signing, no send. `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `30ccb07` (branch `pr-s9-b-feasibility-preview-suppression-health`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=97 fixtures=27 allowlist=1
> violations=0` (append-only — `sources` stays 97) · full suite **1352/1352** · route-planning-foundations **72/72**.

---

## 1. Route Feasibility / Slippage Advisory (Part F)
- `describeRouteFeasibilityContract()` · `validateRouteFeasibilityInput()` · `evaluateRouteFeasibility()`.
- States `ROUTE_FEASIBILITY_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_REJECTED` / `_FEASIBLE_ADVISORY`. Advisory
  evaluation from **input buckets ONLY** (no live quote): `route_quality_bucket`/`estimated_slippage_bucket`/
  `liquidity_bucket`/`hop_count_bucket`. Output: `route_feasibility_state`, `route_feasible_advisory`,
  `route_rejected`, `route_reason_codes` (fixed allowlist). Rules (Fail-Safe): REJECTED on `poor` quality / `high`
  slippage / `thin` liquidity; DEGRADED on any `unknown` / `many` hops / `medium` slippage; `FEASIBLE_ADVISORY` only
  on acceptable/good + low/medium slippage + adequate/deep liquidity + single/few hops. **Feasible opens no
  order/transaction/sign/send; no quote/order/tx field.**

## 2. Execution Plan Preview (Part G)
- `describeExecutionPlanPreviewContract()` · `validateExecutionPlanPreviewInput()` · `evaluateExecutionPlanPreview()`.
- States `EXECUTION_PLAN_PREVIEW_UNCONFIGURED` / `_INVALID` / `_REJECTED` / `_SUPPRESSED` / `_PREVIEW_VALID`.
  Consumes a candidate route plan + feasibility result. Output: `execution_plan_preview_valid`,
  `execution_plan_preview_state`, `preview_ref`, `route_plan_ref`, `intent_record_ref`, `preview_reason_codes`,
  **`requires_next_stage:'transaction_build_review'` (fixed string marker only — NOT a readiness flag)**. Candidate
  not `CANDIDATE_ROUTE_CANDIDATE` or feasibility not `ROUTE_FEASIBILITY_FEASIBLE_ADVISORY` → rejected/suppressed;
  `no_transaction_build!==true`/`no_order!==true`/`no_signing!==true`/`no_send!==true` or smuggled tx/instruction/
  sign/send key → `INVALID`; feasible + valid → `PREVIEW_VALID`. **FORBIDDEN in output (verified absent):
  `order_id`, `transaction_id`, `serialized_tx`, serialized transaction, `instruction_array`, `message_bytes`,
  `signature`, `signer`, `broadcast_target`, `endpoint`.** Preview opens no `transaction_ready`/`signing_permitted`/
  `can_serialize`/`can_send`.

## 3. Route Suppression / Rejection (Part H)
- `describeRouteSuppressionContract()` · `evaluateRouteSuppression()`.
- Output: `suppressed`, `suppression_reasons` (allowlist). `suppression_reasons` allowlist (ONLY these):
  `intent_not_awaiting_route_review` · `route_source_invalid` · `route_metadata_missing` ·
  `route_feasibility_failed` · `high_slippage` · `thin_liquidity` · `route_quality_poor` · `not_order_authorized` ·
  `not_transaction_authorized` · `not_sign_authorized` · `not_send_authorized` · `not_execution_authorized`. The
  five `not_*_authorized` are always present when emitting — **a route is never order/transaction/sign/send/
  execution authorized at this layer.** Invalid boundary/source, missing route/metadata, or a REJECTED feasibility →
  suppressed (with the matching reason). **An advisory-valid feasible route still carries the `not_*_authorized`
  reasons and never progresses to order/tx/sign/send. Suppression opens no `transaction_ready`/`signing_permitted`/
  `can_send` and creates no order/transaction.**

## 4. Route Health / Status (Part I)
- `describeRouteHealthContract()` · `evaluateRouteHealth()`.
- **Consumes** route input boundary + source boundary + candidate route + feasibility + preview + suppression. States
  `ROUTE_HEALTH_UNCONFIGURED` / `_DEGRADED` / `_CANDIDATE_REVIEWED` / `_PREVIEW_READY` / `_SUPPRESSED` / `_BLOCKED`.
  Fail-closed ordering: smuggled forbidden flag (top-level or any component) / secret / mainnet / REAL-LIVE / invalid
  route input boundary / invalid route source → `ROUTE_HEALTH_BLOCKED`; missing required component →
  `ROUTE_HEALTH_UNCONFIGURED`; `route_suppression.suppressed` → `ROUTE_HEALTH_SUPPRESSED`; valid preview →
  `ROUTE_HEALTH_PREVIEW_READY`; candidate + feasible → `ROUTE_HEALTH_CANDIDATE_REVIEWED`; else `ROUTE_HEALTH_DEGRADED`.
  **Every state keeps all 21 flags false; `ROUTE_HEALTH_PREVIEW_READY` opens no transaction/signing/can_serialize/
  can_send.**

## 5. Advisory / not-order/transaction/sign/send invariant
Every Part F/G/H/I result spreads the existing shared `routeSafeFlags()` (reused unchanged from PR-S9-A):
`read_only:true` and the 21 flags `signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/
`route_ready`/`order_ready`/`transaction_ready`/`can_send`/`can_broadcast`/`can_serialize`/`signing_permitted`/
`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/`live_stream_enabled`/`network_call_made`/
`endpoint_resolved`/`live_quote_enabled`/`has_secret` = **false** — on **every** state, including
`ROUTE_FEASIBILITY_FEASIBLE_ADVISORY`, `EXECUTION_PLAN_PREVIEW_PREVIEW_VALID`, and `ROUTE_HEALTH_PREVIEW_READY`.
`route_ready`/`order_ready`/`transaction_ready`/`signing_permitted`/`can_send`/`live_quote_enabled` **stay false**.
No output contains an `order_id`/`transaction_id`/`serialized_tx`/`instruction_array`/`message_bytes`/`signature`/
`signer`/`broadcast_target`/`quote_response`/`swap_instruction`/`endpoint` field. **No route → order / transaction /
signing / send / trading-readiness conversion.**

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/invalid/smuggled-forbidden-flag/exec-command/secret/endpoint/mainnet input
→ fail-closed (`*_UNCONFIGURED` / `*_INVALID` / `*_REJECTED` / `*_BLOCKED` / suppressed); secret/endpoint/mainnet
values **never echoed**; both hostile-proxy variants (throwing-accessor and function-returning, via the reused
`routeUninspectable` guard + try/catch) → frozen `*_UNCONFIGURED`, **never throws**.

## 7. Append-only / helper reuse
Appended to the existing `route-planning-foundations.mjs`/`.d.ts`/README/test — **no new src file** (mechanism guard
`sources` stays 97); existing functions and the shared `routeSafeFlags`/`routeScreen`/`routeUninspectable`/`ROUTE_*`
helpers are reused **unmodified** (git diff shows zero deletions in the src `.mjs`); no module-level mutable state
introduced. Exactly 4 files differ vs main.

## 8. Tests summary
Appended to `test/route-planning-foundations.test.mjs` (feasibility, preview, suppression, health, descriptors,
static guards), built against **real** prior route results over the real Stage-8 awaiting-route-review chain.
**route-planning-foundations 72/72 (34 prior + 38 new); full suite 1352/1352** (1314 + 38). Independent main-loop
behavioral spot-check: **19/19 PASS** (feasibility unknown/poor/high/thin/feasible; preview valid+marker+no-exec-
field/infeasible-rejected/smuggled-tx-INVALID; suppression infeasible+advisory-valid both carry not_*_authorized;
health UNCONFIGURED/BLOCKED/PREVIEW_READY-all-flags-false/smuggled-flag-&-secret-&-mainnet→BLOCKED-never-echoed;
hostile proxies frozen).

## 9. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=97 fixtures=27 allowlist=1 violations=0` — **`sources` stays
97** (append, no new src file). SSOT drift **unchanged at baseline**
(`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30`).
No new SSOT/API/CONFIG/DATA name; no SSOT route vocabulary introduced.

## 10. No-live / no-Jupiter / no-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no Jupiter/aggregator/live-quote/RPC-route call; no DB/Redis/Postgres/ClickHouse/
filesystem/persistence; no mutable module/global state; no SDK/dependency; no endpoint/secret in src/README; no
transaction build/serialization; no order; no swap/compute-budget instruction; no paper execution / position
lifecycle; no signing/send/broadcast; no KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 11. Readiness impact
None — feasibility/preview/suppression/health states are **not** order/transaction/signing/send/trading readiness;
`ROUTE_HEALTH_PREVIEW_READY` is a read-only marker, not transaction readiness; the pipeline
(`data → signal → risk → intent → route → sign → send`) is advanced only within the read-only/advisory `route`
foundation; `can_send:false` repo-wide unchanged.

---

**Confirmations:** Route feasibility/slippage advisory (buckets only; poor/high/thin → rejected; good+low+deep+single
→ feasible advisory) · Execution plan preview (`PREVIEW_VALID` not a transaction; `requires_next_stage` fixed marker;
no order_id/transaction_id/serialized_tx/instruction_array/message_bytes/signature/signer/broadcast_target) · Route
suppression/rejection (reasons only; advisory-valid route still not progressed; creates no order/tx; always
`not_order/transaction/sign/send/execution_authorized`) · Route health/status (consumes boundary+source+candidate+
feasibility+preview+suppression; `PREVIEW_READY` advisory-only) · No route→order/transaction/signing/send conversion ·
Append-only (sources stays 97) · No Jupiter live call · No live quote · No aggregator call · No network primitive ·
No system clock · No persistence · No dependency · No endpoint/secret in repo · No secret echoed · No transaction
build/serialize · No signing/send/broadcast · No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged ·
`can_send:false` unchanged · prior route + intent + risk + signal + intelligence + ingestion + gate-a + rpc-provider
+ send-gate green.
