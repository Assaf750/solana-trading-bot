# @soltrade/route-planning-foundations

Read-only / advisory **ONLY** route-planning foundation for **Stage-9** of the
architecture pipeline `data -> signal -> risk -> intent -> route -> sign -> send`.
This package builds **ONLY** the read-only/advisory `route` foundation, consuming
**Stage-8 intent-ledger outputs**.

## The core rule

A **candidate route plan is a READ-ONLY ADVISORY REPRESENTATION ONLY** — NOT an
order, NOT a transaction, NOT a signing permission, NOT a send permission, NOT
trading/transaction readiness.

`route_ready` / `order_ready` / `transaction_ready` / `signing_permitted` /
`can_send` / `live_quote_enabled` **ALL STAY `false` on every result** — a
candidate route review NEVER flips any readiness/execution/live-quote flag.
"Route reviewed / source valid / candidate route exists" is carried ONLY by
dedicated fields (`route_input_boundary_valid` / `eligible_for_route_review` /
`route_source_valid` / `candidate_route_valid` / `candidate_route_state`), never
by a readiness flag.

There is **NO** Jupiter call, **NO** live quote, **NO** aggregator call, **NO**
RPC route call, **NO** transaction build, **NO** order, **NO** signing, **NO**
send. The source tags `jupiter_disabled` / `aggregator_disabled` are **LOCAL
disabled markers** (NOT the SSOT execution mode) and NEVER enable Jupiter /
aggregator / live quote.

## Guarantees

- **Import-free, pure, deterministic** implementation — no `import`/`require`.
- No network primitive, live stream, live quote, aggregator/Jupiter/RPC route
  call, transaction build, system clock, persistence, secrets, or mutable
  module/global state.
- Every returned object is `Object.freeze` of fixed literals + fixed string-token
  codes from allowlists + whitelisted opaque refs; input values
  (secrets/endpoints) are NEVER echoed.
- **Fail-Safe-Not-Fail-Open**: hostile / throwing / uninspectable input returns a
  frozen refusal with reason `input_inspection_error` and NEVER throws; when in
  doubt -> `DEGRADED` / `REJECTED`, never advisory-feasible.

> Every identifier here is a **LOCAL function-I/O contract identifier**, NOT an
> SSOT name. This package adds NO name to `docs/01-SSOT.md`.

## Foundations

### (C) Route Input Boundary

Verifies route input comes **ONLY** from Stage-8 intent-ledger outputs (intent
input boundary, candidate intent record, intent ledger append, intent state
machine, intent audit envelope, intent suppression, intent health), never from
raw Stage-7 risk / Stage-6 signal / Stage-5 intelligence / Stage-4 ingestion
events or commands. Eligible only when the intent is **awaiting route review**
(`INTENT_AWAITING_ROUTE_REVIEW` + `INTENT_HEALTH_AWAITING_ROUTE_REVIEW` + not
suppressed + audit `INTENT_AUDIT_VALID`).

- `describeRouteInputBoundaryContract()`
- `validateRouteInputBoundary(input)`
- `evaluateRouteInputBoundary(input)`
- States: `ROUTE_INPUT_UNCONFIGURED` / `ROUTE_INPUT_INVALID` /
  `ROUTE_INPUT_DEGRADED` / `ROUTE_INPUT_VALID`.

### (D) Route Source / Provider Boundary

The route source is a **DISABLED / read-only descriptor TAG only** — no endpoint,
no SDK, no live call.

- `describeRouteSourceBoundaryContract()`
- `validateRouteSourceBoundary(input)`
- `evaluateRouteSourceBoundary(input)`
- Accepted tags: `mock_route_metadata` / `fixture_route_metadata` /
  `jupiter_disabled` / `aggregator_disabled` / `manual_route_review_disabled`.
- States: `ROUTE_SOURCE_UNCONFIGURED` / `ROUTE_SOURCE_INVALID` /
  `ROUTE_SOURCE_READ_ONLY_OK`.

### (E) Candidate Route Plan

A descriptive route plan from route metadata input ONLY, produced after a
`ROUTE_INPUT_VALID` boundary + `ROUTE_SOURCE_READ_ONLY_OK` source ONLY. Never an
order/transaction. NO `order_id` / `transaction_id` / `serialized_tx` /
`signature` / `quote_response` / `jupiter_route_object` / `swap_instruction` /
`compute_budget_instruction` field ever appears in output.

- `describeCandidateRoutePlanContract()`
- `validateCandidateRoutePlanInput(input)`
- `evaluateCandidateRoutePlan(input)`
- States: `CANDIDATE_ROUTE_UNCONFIGURED` / `CANDIDATE_ROUTE_INVALID` /
  `CANDIDATE_ROUTE_REJECTED` / `CANDIDATE_ROUTE_CANDIDATE`.

## Test

```
node --test test
```
