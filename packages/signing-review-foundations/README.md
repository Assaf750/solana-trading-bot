# @soltrade/signing-review-foundations

Read-only / advisory ONLY **signing-review** foundation for **Stage-11** of the
architecture pipeline `data -> signal -> risk -> intent -> route -> sign -> send`.
It consumes **Stage-10 transaction-build-review** outputs and produces
descriptive, advisory representations only.

## The core rule

A signing-review / descriptor is a **READ-ONLY ADVISORY REPRESENTATION ONLY** —
it **REVIEWS signing PREREQUISITES from safe metadata**. It is **NOT** signing,
**NOT** a signature, **NOT** a private key, **NOT** key material, **NOT** a
signing permission, **NOT** a send permission, and **NOT** signing/trading
readiness.

`signer_ready`, `signing_permitted`, `transaction_ready`, `serialized_ready`,
`message_bytes_ready`, `can_send`, `can_serialize` (and every other
readiness/execution/signing flag) **stay `false` on every result**. A
signing-review NEVER flips any readiness/execution/signing flag. "Input valid /
signer-boundary valid / descriptor exists" is carried ONLY by dedicated fields
(`signing_review_input_boundary_valid`, `eligible_for_signing_review`,
`signer_custody_boundary_valid`, `candidate_signing_review_valid`,
`candidate_signing_review_state`), never by a readiness flag.

There is **no** network primitive, no live stream, no live quote, no
aggregator/Jupiter/RPC route call, **no real signing**, **no SignerService
activation**, **no private key / seed / mnemonic / keypair material of any kind**,
**no crypto signing call**, no transaction build, no serialization, no message
bytes, no send, no system clock, no persistence, no secrets, and no mutable
module/global state. The implementation `.mjs` is import-free, pure, and
deterministic; every returned object is `Object.freeze`d over fixed literals +
fixed string-token codes from allowlists + whitelisted opaque refs, and never
echoes input values (secrets/endpoints/key-material).

> Every identifier here is a **LOCAL function-I/O contract identifier, NOT an
> SSOT name.** This package adds NO name to `docs/01-SSOT.md`. The bucket VALUES
> that overlap SSOT Group 15 vocabulary (`key_custody_mode =
> connected_wallet|isolated_signer`; `signer_profile_status =
> active|disabled|revoked|degraded`) are **consumed as advisory input bucket
> values only**, never actual key handling. The source tags
> `isolated_signer_disabled` / `connected_wallet_disabled` are LOCAL disabled
> markers (NOT SignerService calls) — they NEVER load a key, sign, or activate a
> signer.

## Critical security posture

This stage NEVER produces, accepts, loads, stores, or echoes ANY
private-key/seed/keypair/signature material. There is **no** private key, secret
key, seed, mnemonic, keypair, signing key, or real signature anywhere in `src` —
not as a value, a field, a call, or a literal (except as fixed string literals
inside the FORBIDDEN-FIELD-NAME allowlist arrays used by the Part-E descriptor
screen to **reject** such input, and in prose). `key_custody_mode` is reviewed as
an **advisory metadata bucket only** (the descriptive mode label), never actual
key handling.

## Foundations

The package exposes three read-only/advisory foundations, each with a
`describe* / validate* / evaluate*` (or `describe* / evaluate*`) trio:

- **(C) Signing-Review Input Boundary** —
  `describeSigningReviewInputBoundaryContract`,
  `validateSigningReviewInputBoundary`, `evaluateSigningReviewInputBoundary`.
  Verifies signing-review input comes ONLY from Stage-10 tx-build-review outputs,
  never raw route / earlier-stage / commands. Eligible only when the tx-build
  review is `TX_BUILD_REVIEW_PASS_ADVISORY` + `TX_BUILD_HEALTH_REVIEWED_ADVISORY`
  + not suppressed. States: `SIGNING_REVIEW_INPUT_UNCONFIGURED` /
  `_INVALID` / `_DEGRADED` / `_VALID`.

- **(D) Signer Profile / Custody Boundary** —
  `describeSignerCustodyBoundaryContract`, `validateSignerCustodyBoundary`,
  `evaluateSignerCustodyBoundary`. The signer/custody source is a DISABLED /
  read-only descriptor TAG only — no SignerService, no key load, no network.
  `isolated_signer_disabled` / `connected_wallet_disabled` are accepted ONLY as
  disabled/read-only markers; they NEVER load a key, sign, or activate a signer
  (`signer_disabled:true`, `signing_performed:false`, `key_loaded:false`,
  `key_material_present:false`). States: `SIGNER_CUSTODY_UNCONFIGURED` /
  `_INVALID` / `_READ_ONLY_OK`.

- **(E) Candidate Signing-Review Descriptor** —
  `describeCandidateSigningReviewDescriptorContract`,
  `validateCandidateSigningReviewDescriptorInput`,
  `evaluateCandidateSigningReviewDescriptor`. A descriptive descriptor from safe
  signer metadata buckets ONLY (`key_custody_mode_bucket`,
  `signer_profile_status_bucket`, `dual_control_bucket`,
  `signer_reachability_bucket`), after a `SIGNING_REVIEW_INPUT_VALID` boundary +
  `SIGNER_CUSTODY_READ_ONLY_OK` custody boundary. Never a signature or key
  material. States: `CANDIDATE_SIGNING_REVIEW_UNCONFIGURED` / `_INVALID` /
  `_REJECTED` / `_DEGRADED` / `_DESCRIPTOR`.

- **(F) Signer / Key-Custody Readiness Advisory** —
  `describeSignerCustodyReadinessAdvisoryContract`,
  `validateSignerCustodyReadinessAdvisoryInput`,
  `evaluateSignerCustodyReadinessAdvisory`. An advisory derived from safe input
  metadata buckets ONLY (`key_custody_mode_bucket`,
  `signer_profile_status_bucket`, `dual_control_bucket`,
  `signer_reachability_bucket`, `custody_verification_bucket`). It REVIEWS custody
  prerequisites — it is NOT signing, a signature, a key, key material, or a
  signing/send permission. `_ACCEPTABLE_ADVISORY` opens NO signing/transaction/send
  (every readiness flag stays `false`). States:
  `SIGNER_CUSTODY_READINESS_UNCONFIGURED` / `_INVALID` / `_DEGRADED` /
  `_REJECTED` / `_ACCEPTABLE_ADVISORY`.

- **(G) Private-Key Forbidden Surface Guard** —
  `describePrivateKeyForbiddenSurfaceContract`,
  `evaluatePrivateKeyForbiddenSurface`. Proves Stage-11 neither produces nor
  accepts private-key / seed / keypair / signature material. Scans ONLY top-level
  keys for forbidden field NAMES and reports a REDACTED `forbidden_field_ref` (the
  matched NAME only — NEVER the VALUE). The detection booleans
  (`key_material_detected` / `private_key_detected` / `forbidden_field_detected`)
  are DETECTION outputs (true == found == the SAFE BLOCKED state), NOT readiness
  flags. States: `PRIVATE_KEY_SURFACE_UNCONFIGURED` / `_CLEAN` / `_BLOCKED`.

- **(H) Signing-Review Verdict** —
  `describeSigningReviewVerdictContract`, `evaluateSigningReviewVerdict`.
  Aggregates the input boundary (C) + signer/custody boundary (D) + candidate
  descriptor (E) + custody-readiness advisory (F) + private-key surface (G) into
  an advisory verdict. A PASS is ADVISORY ONLY — even `SIGNING_REVIEW_PASS_ADVISORY`
  opens NO `signer_ready` / `signing_permitted` / `transaction_ready` /
  `can_serialize` / `can_send`. States: `SIGNING_REVIEW_UNCONFIGURED` /
  `_DEGRADED` / `_BLOCKED` / `_PASS_ADVISORY`.

- **(I) Signing-Review Suppression / Rejection** —
  `describeSigningReviewSuppressionContract`, `evaluateSigningReviewSuppression`.
  Prevents progression; reasons only. Creates NO signing. A signing-review is
  NEVER sign / send / execution authorized at this layer, so `not_sign_authorized`
  + `not_send_authorized` + `not_execution_authorized` are ALWAYS emitted — even
  an advisory-clean signing-review is STILL suppressed for sign/send.

- **(J) Signing-Review Health / Status** —
  `describeSigningReviewHealthContract`, `evaluateSigningReviewHealth`. Consumes
  input boundary (C) + signer/custody boundary (D) + descriptor (E) +
  custody-readiness advisory (F) + private-key surface (G) + verdict (H) +
  suppression (I); derives status only. `_REVIEWED_ADVISORY` does NOT open
  signer / signing / transaction / send. States:
  `SIGNING_REVIEW_HEALTH_UNCONFIGURED` / `_DEGRADED` / `_REVIEWED_ADVISORY` /
  `_SUPPRESSED` / `_BLOCKED`.

## Fail-Safe-Not-Fail-Open

Every `evaluate*` / `validate*` wraps its body in `try/catch` and returns a
FROZEN refusal with reason `input_inspection_error` — it NEVER throws. A hostile
`Proxy` (throwing-accessor or function-returning-accessor) returns a frozen
`*_UNCONFIGURED`. Missing input -> `*_UNCONFIGURED`. A smuggled forbidden flag /
execution command / secret / endpoint / mainnet / key-material / raw earlier-stage
input -> `*_INVALID` (never echoed). When in doubt -> `DEGRADED` / `REJECTED`,
never advisory-pass.

## Tests

```
node --test test
```

The suite builds a REAL Stage-4..10 chain (via the lower-stage evaluators) to a
`TX_BUILD_REVIEW_PASS_ADVISORY` + `TX_BUILD_HEALTH_REVIEWED_ADVISORY` state, then
feeds the Stage-11 signing-review foundations, covering every required case from
Parts C/D/E/F/G/H/I/J plus a static source guard.
