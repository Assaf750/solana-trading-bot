# @soltrade/transaction-build-review-foundations

Read-only / advisory ONLY **transaction-build-review** foundation for **Stage-10**
of the architecture pipeline `data -> signal -> risk -> intent -> route -> sign ->
send`. It consumes **Stage-9 route / execution-plan-preview** outputs and produces
descriptive, advisory representations only.

## The core rule

A transaction-build review / descriptor is a **READ-ONLY ADVISORY REPRESENTATION
ONLY** — it is **NOT** a transaction, **NOT** a serialized transaction, **NOT**
message bytes, **NOT** a signing permission, **NOT** a send permission, and
**NOT** transaction/trading readiness.

`transaction_ready`, `serialized_ready`, `message_bytes_ready`,
`signing_permitted`, `can_serialize`, `can_send` (and every other
readiness/execution flag) **stay `false` on every result**. A tx-build review
NEVER flips any readiness/execution/serialization flag. "Input valid / source
valid / descriptor exists" is carried ONLY by dedicated fields
(`tx_build_input_boundary_valid`, `eligible_for_tx_build_review`,
`tx_build_source_valid`, `candidate_tx_build_descriptor_valid`,
`candidate_tx_build_state`), never by a readiness flag.

There is **no** network primitive, no live stream, no live quote, no
aggregator/Jupiter/RPC route call, **no transaction build**, **no
serialization**, **no message bytes**, **no signing**, **no send**, no system
clock, no persistence, no secrets, and no mutable module/global state. The
implementation `.mjs` is import-free, pure, and deterministic; every returned
object is `Object.freeze`d over fixed literals + fixed string-token codes from
allowlists + whitelisted opaque refs, and never echoes input values
(secrets/endpoints/forbidden artifacts).

> Every identifier here is a **LOCAL function-I/O contract identifier, NOT an
> SSOT name.** This package adds NO name to `docs/01-SSOT.md`. The source tags
> `solana_tx_builder_disabled` / `jupiter_tx_builder_disabled` are LOCAL disabled
> markers (NOT SDK/builder calls) — they NEVER build a transaction or call a
> builder.

## Foundations

### (C) Transaction-Build Input Boundary
`describeTransactionBuildInputBoundaryContract()` ·
`validateTransactionBuildInputBoundary(input)` ·
`evaluateTransactionBuildInputBoundary(input)`

Verifies that tx-build-review input comes ONLY from Stage-9 route outputs (route
input boundary, route source boundary, candidate route plan, route feasibility,
execution plan preview, route suppression, route health) — never from raw
Stage-8 intent / Stage-7 risk / Stage-6 signal / Stage-5 intelligence / Stage-4
events. States: `TX_BUILD_INPUT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` /
`_VALID`. Eligible (`TX_BUILD_INPUT_VALID`) only when the execution plan preview
is `EXECUTION_PLAN_PREVIEW_PREVIEW_VALID`, route health is
`ROUTE_HEALTH_PREVIEW_READY`, and the route is not suppressed. Anything weaker is
fail-closed to `_DEGRADED` / `_UNCONFIGURED`; blocked/invalid components, smuggled
flags/commands, secrets, endpoints, and mainnet/REAL-LIVE markers → `_INVALID`
(never echoed).

### (D) Transaction Build Source / Builder Boundary
`describeTransactionBuildSourceBoundaryContract()` ·
`validateTransactionBuildSourceBoundary(input)` ·
`evaluateTransactionBuildSourceBoundary(input)`

The tx-build source/builder is a DISABLED / read-only descriptor TAG only —
`mock_tx_build_metadata`, `fixture_tx_build_metadata`,
`solana_tx_builder_disabled`, `jupiter_tx_builder_disabled`,
`manual_tx_review_disabled`. No endpoint, no SDK, no builder, no live call, no
serialization, no signing, no send. States: `TX_BUILD_SOURCE_UNCONFIGURED` /
`_INVALID` / `_READ_ONLY_OK`. `builder_disabled` stays `true` and
`transaction_build_performed` / `serialization_performed` stay `false` always.

### (E) Candidate Transaction Build Descriptor
`describeCandidateTransactionBuildDescriptorContract()` ·
`validateCandidateTransactionBuildDescriptorInput(input)` ·
`evaluateCandidateTransactionBuildDescriptor(input)`

A descriptive descriptor produced from tx-build METADATA buckets ONLY, after a
`TX_BUILD_INPUT_VALID` boundary + `TX_BUILD_SOURCE_READ_ONLY_OK` source. States:
`CANDIDATE_TX_BUILD_UNCONFIGURED` / `_INVALID` / `_REJECTED` / `_DEGRADED` /
`_DESCRIPTOR`. Over-threshold metadata (`too_high` accounts/instructions/compute,
`too_large` size, `required_unresolved` lookup table) → `_REJECTED` (Fail-Safe);
unknown buckets → `_DEGRADED`; clean metadata → `_DESCRIPTOR`. The descriptor
opens NO `transaction_ready` / `serialized_ready` / `signing_permitted` /
`can_serialize` / `can_send`, and never emits any `transaction` / `serialized_tx`
/ `message_bytes` / `instruction_array` / `signature` / `blockhash` / `feePayer`
/ `signer` / `broadcast_target` / `endpoint` field.

## Test

```
node --test test
```

Tests build a REAL Stage-4 → 5 → 6 → 7 → 8 → 9 chain (via the lower-stage
evaluators) to an `EXECUTION_PLAN_PREVIEW_PREVIEW_VALID` +
`ROUTE_HEALTH_PREVIEW_READY` state and feed it into the Stage-10 tx-build-review
foundation, covering Parts C/D/E plus a static source guard.
