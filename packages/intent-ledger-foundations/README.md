# @soltrade/intent-ledger-foundations

Read-only / advisory **intent foundation** for **Stage-8** of the architecture
pipeline `data -> signal -> risk -> intent -> route -> sign -> send`. This package
builds ONLY the read-only/advisory `intent` foundation, consuming **Stage-7
risk-engine outputs** (`@soltrade/risk-engine-foundations`).

> **THE CORE RULE:** a candidate intent record is an **AUDITABLE REPRESENTATION
> ONLY** — **NOT** an order, **NOT** a route, **NOT** a transaction, **NOT** a
> signing permission, **NOT** a send permission, **NOT** trading/route readiness.
> **No execution of any kind.**

This is a separate package from `@soltrade/intent-ledger` (the pre-existing
SSOT-vocabulary package). **Every identifier here is a LOCAL function-I/O contract
identifier**, NOT an SSOT name — no SSOT intent vocabulary is used, and no name is
added to `docs/01-SSOT.md`.

## Guarantees

- **Import-free, pure, deterministic.** The implementation `.mjs` contains no
  `import`/`require`. No network primitive, no live stream, no system clock
  (`Date.now`/`new Date`), no `process.env`, no `fs`, no persistence (DB / Redis /
  Postgres / ClickHouse / localStorage), and **no mutable module/global state**.
- **The ledger is PURE.** `previous_records` is passed in as a function argument
  and is **never stored**; record count is computed from the passed array.
- **Readiness/execution flags STAY false.** Every result spreads `intentSafeFlags()`
  with `read_only: true` plus 20 forbidden flags (`intent_ready`, `route_ready`,
  `order_ready`, `transaction_ready`, `risk_ready`, `signal_ready`, `can_send`,
  `signing_permitted`, `mainnet_enabled`, `real_live`, …) all `false`. A candidate
  intent **never flips any readiness/execution flag**. Existence is carried only by
  dedicated fields (`candidate_intent_valid` / `candidate_intent_state` /
  `eligible_for_candidate_intent` / `intent_record_ref` / `append_valid`).
- **Fail-Safe-Not-Fail-Open.** Hostile / throwing / uninspectable input returns a
  **frozen** refusal with reason `input_inspection_error` and never throws.
  Smuggled forbidden flags / execution commands / secrets / endpoints / mainnet /
  raw non-risk input are refused and **never echoed**. No `order_id` / `route_id` /
  `transaction_id` / `serialized_tx` / `signature` / `quote` / `jupiter_route` /
  `send` / `broadcast` field ever appears in any output.

## Exports

### (C) Intent input boundary
Verifies intent input comes **only** from Stage-7 risk outputs (never raw Stage-6
signals, Stage-5 intelligence, or Stage-4 events). Eligible only when risk is
**advisory-pass** (`risk_verdict = RISK_PASS_ADVISORY` + `risk_health =
RISK_HEALTH_PASS_ADVISORY` + not suppressed). Risk BLOCKED/DEGRADED -> not eligible.

- `describeIntentInputBoundaryContract()`
- `validateIntentInputBoundary(input)`
- `evaluateIntentInputBoundary(input)` — states
  `INTENT_INPUT_UNCONFIGURED | INTENT_INPUT_INVALID | INTENT_INPUT_DEGRADED | INTENT_INPUT_VALID`

### (D) Candidate intent record
A descriptive, auditable record produced **after a risk advisory-pass only**.
Never an order/route/transaction.

- `describeCandidateIntentRecordContract()`
- `validateCandidateIntentRecordInput(input)`
- `evaluateCandidateIntentRecord(input)` — states
  `CANDIDATE_INTENT_UNCONFIGURED | CANDIDATE_INTENT_INVALID | CANDIDATE_INTENT_REJECTED | CANDIDATE_INTENT_RECORDED`,
  `intent_kind: 'candidate_trade_intent'`.

### (E) Intent ledger append / evaluate
Append-only ledger **semantics**, evaluated **purely / in-memory only**. No
persistence (`persistence_performed: false`), no module-level array.

- `describeIntentLedgerContract()`
- `validateIntentLedgerAppend(input)`
- `evaluateIntentLedgerAppend(input)` — states
  `INTENT_LEDGER_UNCONFIGURED | INTENT_LEDGER_INVALID | INTENT_LEDGER_DUPLICATE | INTENT_LEDGER_APPEND_EVALUATED`

### (F) Intent state machine
Evaluates the **state** for a candidate intent **without execution**. An intent
state is an auditable representation only.

- `describeIntentStateMachineContract()`
- `evaluateIntentStateTransition(input)` — states
  `INTENT_UNCONFIGURED | INTENT_CANDIDATE_RECORDED | INTENT_REJECTED | INTENT_SUPPRESSED | INTENT_BLOCKED | INTENT_AWAITING_ROUTE_REVIEW`

> **CRITICAL:** `INTENT_AWAITING_ROUTE_REVIEW` does **NOT** mean a route is ready
> or executed — it only records that a later stage (Stage 9) **may** review a
> route. Every readiness/execution flag (`routing_ready`, `route_ready`,
> `transaction_ready`, `can_send`, `signing_permitted`, …) **stays false** in
> every state.

### (G) Intent audit envelope
Every candidate intent must be **auditable, without secrets**. The output carries
**only** opaque refs + fixed reason codes + state — no `private_key` / `seed` /
`signer_credential` / `auth_token` / `endpoint` / `raw_wallet_secret`.

- `describeIntentAuditEnvelopeContract()`
- `validateIntentAuditEnvelope(input)`
- `evaluateIntentAuditEnvelope(input)` — states
  `INTENT_AUDIT_UNCONFIGURED | INTENT_AUDIT_INVALID | INTENT_AUDIT_VALID`.
  Missing `reason_codes` / `decision_ref` / `intent_record_ref`/`actor_ref` ->
  `INTENT_AUDIT_INVALID` (no hidden decision, no missing reason). Any secret /
  endpoint / mainnet material or smuggled execution flag is refused and **never
  echoed**.

### (H) Intent suppression / rejection
Prevents an intent from progressing; **reasons only**. Creates **no route/order**.

- `describeIntentSuppressionContract()`
- `evaluateIntentSuppression(input)` — `suppression_reasons` drawn only from a
  fixed allowlist. The `not_route_authorized` + `not_order_authorized` +
  `not_sign_authorized` + `not_send_authorized` + `not_execution_authorized`
  reasons are **always** attached. An advisory-valid intent (candidate recorded +
  risk pass + audit valid + not duplicate) is **still** suppressed for
  routing/sign/send (`route_not_reviewed` + the `not_*_authorized` reasons) — it
  never progresses to routing/sign/send at this layer. Suppression opens **no**
  `routing_ready` / `route_ready` / `signing_permitted` / `can_send`.

### (I) Intent health / status
Consumes the intent input boundary + candidate intent + ledger append + state
machine + audit + suppression and derives a **status only**.

- `describeIntentHealthContract()`
- `evaluateIntentHealth(inputs)` — states
  `INTENT_HEALTH_UNCONFIGURED | INTENT_HEALTH_DEGRADED | INTENT_HEALTH_CANDIDATE_RECORDED | INTENT_HEALTH_AWAITING_ROUTE_REVIEW | INTENT_HEALTH_SUPPRESSED | INTENT_HEALTH_BLOCKED`.
  Smuggled forbidden flag / secret / mainnet / REAL-LIVE / invalid boundary /
  invalid audit -> `INTENT_HEALTH_BLOCKED`. Every state keeps all 20 flags false;
  `INTENT_HEALTH_AWAITING_ROUTE_REVIEW` does **not** open
  routing/route/transaction/can_send.

## Test

```
node --test packages/intent-ledger-foundations/test
```

Tests build **real** Stage-7 risk results via `@soltrade/risk-engine-foundations`
(which consume real Stage-6/Stage-5/Stage-4 chains) to feed the intent evaluators.
