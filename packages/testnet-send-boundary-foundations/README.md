# @soltrade/testnet-send-boundary-foundations

Read-only / advisory **TESTNET-SEND BOUNDARY** foundation for **Stage-21**
(Testnet/Devnet Execution seam). Builds everything **UP TO** the
testnet-broadcast activation seam and **NOTHING** past it — exactly mirroring the
Stage-17 live-stream boundary, which stops honestly at the owner-input seam.

A **real testnet broadcast** needs owner inputs that are absent from the repo and
a **separate allowlist / governance decision**. This package delivers everything
up to that seam and nothing beyond it.

## Hard guarantees

- **No live primitive.** The package imports no `fetch` / `XMLHttpRequest` /
  `WebSocket` / `Connection` / `sendTransaction` / `sendRawTransaction` /
  `sendAndConfirmTransaction` / `.serialize()` / socket / grpc, and no
  Solana / Jupiter / Helius / Jito / http-client / `node:net|http|https` / db
  import. The default (no injected out-of-repo caller) is **fail-closed: no send**.
  `can_send` / `can_broadcast` stay **FIXED false** on every path.
- **Never-ready activation seam.** `evaluateTestnetActivationSeam` exposes a
  hardcoded `TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION` with
  `met:false`, so `send_ready_advisory` and `can_send` can **NEVER** be true
  in-package — across *all* met-combinations of the other requirements (mirror
  of Stage-17 `LIVE_REQ_SEPARATE_ADAPTER_REVIEW`).
- **Mainnet hard-refusal.** Any `mainnet` / `mainnet-beta` / `prod` indicator in
  any field/value (including nested one level) → refuse. The cluster must be an
  explicit `devnet | testnet | localnet` enum tag; a default/missing tag →
  refuse.
- **Sign-only/send separation is structural.** The package imports no
  signing/crypto primitive and produces no signature; it consumes only a Stage-19
  signature **descriptor** (`{ signed:true, signature:<string>, can_send:false,
  mode:'sign_only' }`) by presence/shape (opaque) and **never re-signs**.
- **Secrets by reference only.** A testnet RPC endpoint is an opaque
  `endpoint_ref` (shape-checked: refuses `://`, whitespace, `>128` chars,
  base58-blob/PEM, mainnet). Raw key / endpoint / url / api_key are refused and
  never echoed (NAME-only redaction).
- Every result is frozen, carries `read_only:true` plus the 24
  exec/readiness flags all false, never throws (fail-closed), and snapshots input
  once (TOCTOU).

## Foundations (A–H)

| | Contract | Evaluate |
|---|---|---|
| A | `describeTestnetSendInputBoundaryContract` | `evaluateTestnetSendInputBoundary` |
| B | `describeTestnetActivationSeamContract` | `evaluateTestnetActivationSeam` |
| C | `describeTestnetSendIdempotencyContract` | `evaluateTestnetSendIdempotency` |
| D | `describeTestnetFailedSendClassContract` | `evaluateTestnetFailedSendClass` |
| E | `describeTestnetBundleStatusContract` | `evaluateTestnetBundleStatus` |
| F | `describeTestnetSendSuppressionContract` | `evaluateTestnetSendSuppression` |
| G | `describeTestnetForbiddenSurfaceContract` | `evaluateTestnetForbiddenSurface` + `isValidEndpointRef` |
| H | `describeTestnetSendHealthContract` | `evaluateTestnetSendHealth` |

- **(A)** Verifies inputs come only from a Stage-19 sign-only-shaped
  `signing_result`, a Stage-12 `SEND_REVIEW_PASS_ADVISORY` `send_review`, a
  testnet cluster enum tag, and an `intent_id`. `eligible_for_testnet_send` is
  true only when all four hold — and it is not a send permission.
- **(B)** The core never-ready seam descriptor. Opens nothing.
- **(C)** Idempotency read-model: one `intent_id` → at most one send. First-seen
  is advisory and does **not** authorize a send.
- **(D)** Maps a failure indicator to the existing SSOT Group 3 `failure_type`
  values (consumed by VALUE; unknown → `Unknown`).
- **(E)** Observes the SSOT Group 3 `bundle_status` values; classifies
  `STALE_BUNDLE` when Pending past a caller-supplied (never defaulted) ttl.
- **(F)** Always suppressed: `not_send_authorized` + `not_broadcast_authorized` +
  `not_execution_authorized` on every path.
- **(G)** NAME-only redacting forbidden-surface guard + `endpoint_ref`
  shape-checker.
- **(H)** Aggregates A–G; the clean path lands on `_SUPPRESSED`.

## SSOT

Every identifier here is a **LOCAL function-I/O contract identifier**, not an
SSOT name; this package adds **no** name to `docs/01-SSOT.md`. SSOT Group 3
`failure_type` and `bundle_status` values are **consumed-only by VALUE**. No new
`candidate_*` name is introduced.

## Frozen-refusing siblings (NOT modified)

`send-gate-contract`, `rpc-provider-contract`,
`send-broadcast-review-foundations`, and `isolated-signer-runtime` stay
frozen-refusing and outside the mechanism-guard ALLOWLIST. A real send adapter is
a **separate future owner governance decision**, explicitly **not** part of
Stage 21.

## Test

```
node --test packages/testnet-send-boundary-foundations/test/*.test.mjs
```
