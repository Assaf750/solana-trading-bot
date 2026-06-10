# @soltrade/send-broadcast-review-foundations

Read-only / advisory ONLY **send / broadcast-review** foundation for **Stage-12**
of the architecture pipeline `data -> signal -> risk -> intent -> route -> sign ->
send`. It consumes **Stage-11 signing-review** outputs and produces descriptive,
advisory representations only.

## The core rule

A send/broadcast-review / descriptor is a **READ-ONLY ADVISORY REPRESENTATION
ONLY** — it **DESCRIPTIVELY REVIEWS send/broadcast PREREQUISITES from safe
metadata**, derived from the Stage-11 signing-review outputs. It is **NOT**
sending, **NOT** broadcasting, **NOT** an RPC call, **NOT** a serialized
transaction, **NOT** a signature, **NOT** a send/broadcast permission, and
**NOT** send/broadcast readiness.

`can_send`, `can_broadcast`, `broadcast_permitted`, `serialized_ready`,
`message_bytes_ready` (and every other readiness/execution flag) **stay `false`
on every result** — including every `*_VALID` / `*_READ_ONLY_OK` /
`*_ACCEPTABLE_ADVISORY` / `*_PASS_ADVISORY` / `*_REVIEWED_ADVISORY` state. A
send-review NEVER flips any readiness/execution flag. "Input valid /
sender-boundary valid / descriptor exists" is carried ONLY by dedicated fields
(`send_review_input_boundary_valid`, `eligible_for_send_review`,
`sender_provider_boundary_valid`, `candidate_send_review_valid`,
`candidate_send_review_state`), never by a readiness flag.

There is **no** network primitive, no live stream, no live quote, no
aggregator/Jupiter/RPC route call, **no real signing**, **no real sending**, **no
real broadcasting**, no RPC connection, no transaction build, no serialization, no
message bytes, no send, no system clock, no persistence, no secrets, and no
mutable module/global state. The implementation `.mjs` is import-free, pure, and
deterministic; every returned object is `Object.freeze`d over fixed literals +
fixed string-token codes from allowlists + whitelisted opaque refs, and never
echoes input values (secrets/endpoints/serialized-tx/signature/key-material).

> Every identifier here is a **LOCAL function-I/O contract identifier, NOT an
> SSOT name.** This package adds NO name to `docs/01-SSOT.md`. Bucket/state values
> that overlap SSOT vocabulary (`helius`/`jito`/`active`/`disabled`/`revoked`/
> `degraded`/`none`/`low`/`medium`/`high`) are **consumed as advisory input bucket
> values only**, never live provider/execution behavior. The source tags
> `helius_sender_disabled` / `jito_sender_disabled` / `rpc_provider_disabled` /
> `disabled_sender` are LOCAL disabled markers (NOT provider/RPC calls) — they
> NEVER connect, send, or broadcast.

## Critical security posture

This stage NEVER produces, accepts, resolves, contacts, or echoes ANY endpoint /
RPC URL / serialized transaction / signed transaction / signature / message-bytes
/ broadcast-payload / private-key material. There is **no** endpoint, RPC client,
serialized transaction, signature, or send/broadcast call anywhere in `src` — not
as a value, a field, a call, or a literal (except as fixed string literals inside
the FORBIDDEN-FIELD-NAME allowlist arrays used by the Part-E / Part-G screens to
**reject** such input, and in prose). The Stage-12 layer integrates with the
existing fail-closed `send-gate-contract` at the **test level only** — and the
gate STILL refuses (`ok:false` / `can_send:false`) alongside a Stage-12
`PASS_ADVISORY` verdict.

## Foundations

The package exposes eight read-only/advisory foundations (Parts C-J), each with a
`describe* / validate* / evaluate*` (or `describe* / evaluate*`) trio:

- **(C) Send-Review Input Boundary** — `describeSendReviewInputBoundaryContract`,
  `validateSendReviewInputBoundary`, `evaluateSendReviewInputBoundary`. Verifies
  send-review input comes ONLY from Stage-11 signing-review outputs (signing-review
  verdict + signing-review health), never raw tx-build / route / earlier-stage /
  commands. Eligible only when the signing-review is `SIGNING_REVIEW_PASS_ADVISORY`
  and the health is not BLOCKED/UNCONFIGURED. States:
  `SEND_REVIEW_INPUT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_VALID`.

- **(D) Sender / Provider Boundary** — `describeSenderProviderBoundaryContract`,
  `validateSenderProviderBoundary`, `evaluateSenderProviderBoundary`. The
  sender/provider source is a DISABLED / read-only descriptor TAG only — no RPC,
  no endpoint, no send, no broadcast. `helius_sender_disabled` /
  `jito_sender_disabled` / `rpc_provider_disabled` / `disabled_sender` are accepted
  ONLY as disabled/read-only markers (`sender_disabled:true`,
  `broadcast_performed:false`, `rpc_connected:false`, `endpoint_resolved:false`,
  `network_call_made:false`). States: `SENDER_PROVIDER_UNCONFIGURED` / `_INVALID` /
  `_READ_ONLY_OK`.

- **(E) Candidate Send-Review Descriptor** —
  `describeCandidateSendReviewDescriptorContract`,
  `validateCandidateSendReviewDescriptorInput`,
  `evaluateCandidateSendReviewDescriptor`. A descriptive descriptor from safe send
  metadata buckets ONLY (`sender_mode_bucket`, `bundle_bucket`, `tip_bucket`,
  `idempotency_bucket`, `intent_binding_bucket`), after a `SEND_REVIEW_INPUT_VALID`
  boundary + `SENDER_PROVIDER_READ_ONLY_OK` boundary. Never an endpoint, serialized
  transaction, or signature. States: `CANDIDATE_SEND_REVIEW_UNCONFIGURED` /
  `_INVALID` / `_REJECTED` / `_DEGRADED` / `_DESCRIPTOR`.

- **(F) Send-Readiness Advisory** — `describeSendReadinessAdvisoryContract`,
  `validateSendReadinessAdvisoryInput`, `evaluateSendReadinessAdvisory`. An
  advisory derived from safe input metadata buckets ONLY (`sender_status_bucket`,
  `idempotency_bucket`, `intent_binding_bucket`, `bundle_bucket`, `tip_bucket`).
  Fail-closed on a live/enabled sender (smuggled flag), unbound idempotency, or
  unbound intent binding -> `_REJECTED`. `_ACCEPTABLE_ADVISORY` opens NO
  `can_send` / `can_broadcast` / `broadcast_permitted`. States:
  `SEND_READINESS_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_REJECTED` /
  `_ACCEPTABLE_ADVISORY`.

- **(G) Broadcast / Live Forbidden Surface Guard** —
  `describeBroadcastForbiddenSurfaceContract`, `evaluateBroadcastForbiddenSurface`.
  Proves Stage-12 neither produces nor accepts endpoint / serialized-transaction /
  signature / broadcast-payload material. Scans ONLY top-level keys for forbidden
  field NAMES and reports a REDACTED `forbidden_field_ref` (the matched NAME only —
  NEVER the VALUE). The detection booleans (`live_surface_detected` /
  `broadcast_material_detected` / `forbidden_field_detected`) are DETECTION outputs
  (true == found == the SAFE BLOCKED state), NOT readiness flags;
  `broadcast_material_detected` is true for a transaction/signature/payload-shaped
  name and false for an endpoint-only name. States:
  `BROADCAST_SURFACE_UNCONFIGURED` / `_CLEAN` / `_BLOCKED`.

- **(H) Send-Review Verdict** — `describeSendReviewVerdictContract`,
  `evaluateSendReviewVerdict`. Aggregates the input boundary (C) + sender/provider
  boundary (D) + candidate descriptor (E) + send-readiness advisory (F) + broadcast
  surface (G) into an advisory verdict. A PASS is ADVISORY ONLY — even
  `SEND_REVIEW_PASS_ADVISORY` opens NO `can_send` / `can_broadcast` /
  `broadcast_permitted`. States: `SEND_REVIEW_UNCONFIGURED` / `_DEGRADED` /
  `_BLOCKED` / `_PASS_ADVISORY`.

- **(I) Send-Review Suppression / Rejection** —
  `describeSendReviewSuppressionContract`, `evaluateSendReviewSuppression`.
  Prevents progression; reasons only. Creates NO send, NO broadcast. A send-review
  is NEVER send / broadcast / execution authorized at this layer, so
  `not_send_authorized` + `not_broadcast_authorized` + `not_execution_authorized`
  are ALWAYS emitted on EVERY path (clean, blocked, hostile, missing).

- **(J) Send-Review Health / Status** — `describeSendReviewHealthContract`,
  `evaluateSendReviewHealth`. Consumes input boundary (C) + sender/provider
  boundary (D) + descriptor (E) + send-readiness advisory (F) + broadcast surface
  (G) + verdict (H) + suppression (I); derives status only. Because the suppression
  layer is ALWAYS suppressed, the standard clean path resolves to `_SUPPRESSED`;
  `_REVIEWED_ADVISORY` is reachable ONLY with an explicit not-suppressed object and
  STILL opens nothing. States: `SEND_REVIEW_HEALTH_UNCONFIGURED` / `_DEGRADED` /
  `_REVIEWED_ADVISORY` / `_SUPPRESSED` / `_BLOCKED`.

## Fail-Safe-Not-Fail-Open

Every `evaluate*` / `validate*` wraps its body in `try/catch` and returns a
FROZEN refusal with reason `input_inspection_error` — it NEVER throws. A hostile
`Proxy` (throwing-accessor or function-returning-accessor) returns a frozen
`*_UNCONFIGURED`. Missing input -> `*_UNCONFIGURED`. A smuggled forbidden flag /
execution command / secret / endpoint / mainnet / broadcast-material / raw
earlier-stage input -> `*_INVALID` / `*_BLOCKED` (never echoed). When in doubt ->
`DEGRADED` / `REJECTED`, never advisory-pass.

## Tests

```
node --test test
```

The suite builds a REAL Stage-4..11 chain (via the lower-stage evaluators) to a
`SIGNING_REVIEW_PASS_ADVISORY` verdict + signing-review health, then feeds the
Stage-12 send/broadcast-review foundations, covering every required case from
Parts C/D/E/F/G/H/I/J, a send-gate-contract integration-consistency check, and a
static source guard.
