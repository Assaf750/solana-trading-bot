# @soltrade/pipeline-decision-trace-foundations

Read-only / advisory ONLY **end-to-end Decision-Trace** foundation for **Stage-13**
of the architecture pipeline `data -> signal -> risk -> intent -> route -> sign ->
send`.

Stage-13 **composes** the already-computed **terminal RESULTS** of Stages 6-12
(passed in as args) into:

1. **ONE deterministic ordered Decision Trace** — one entry per stage in the fixed
   order `[signal, risk, intent, route, signing_review, send_review]`, each showing
   that stage's outcome (the copied state string) + the decisive reason; and
2. a **full-pipeline health / status read-model** and an aggregate decision verdict.

It performs **NO execution**: it does not run the stages, does not sign, does not
send, does not broadcast. It is a **pure composer** over results passed in. Every
result is `Object.freeze`d and spreads the shared `traceSafeFlags()` —
`read_only:true` plus **all 24** exec/readiness flags `false`. `can_send` /
`can_broadcast` / `signer_ready` / `signing_permitted` / `broadcast_permitted`
**stay false on every state**, including the fully-reviewed
`PIPELINE_DECISION_REVIEWED_ADVISORY`. "The whole pipeline was reviewed end-to-end"
is carried ONLY by `pipeline_decision_state` / `pipeline_decision_reviewed_advisory`
/ `overall_outcome` / `pipeline_health_state` — never by a readiness flag.

## Hard invariants

- **Import-free** `src` (consumes stage RESULTS passed in as args; tests import the
  upstream chain to build real inputs).
- Pure, deterministic, function-I/O-only: no system clock, no RNG, no
  fetch/WebSocket/Connection/network, no fs/persistence, no module-level mutable
  state.
- The composed trace **copies ONLY** an allowlisted stage name (fixed enum), a stage
  state STRING, and a `decisive_reason` from a fixed reason-code allowlist. It NEVER
  copies through an endpoint / url / serialized-tx / signed-tx / signature /
  private-key / secret field. A planted forbidden VALUE in any input is provably
  absent from `JSON.stringify` of every Stage-13 output.
- **Fail-Safe-Not-Fail-Open**: missing / unknown / raw / smuggled / hostile /
  uninspectable input → a frozen `*_UNCONFIGURED` / `_INVALID` / `_DEGRADED` /
  `_BLOCKED` state; **never throws**.
- Adds **no** SSOT / API / CONFIG / DATA name. All identifiers are LOCAL
  function-I/O contract identifiers; stage-name and state values overlapping SSOT
  enums are consumed-only.

## Foundations

Each foundation exposes a `describe*Contract()` + `evaluate*()` pair:

| Part | Function | Output state field |
|---|---|---|
| A | `evaluatePipelineDecisionTraceInputBoundary` | `pipeline_trace_input_state` |
| B | `evaluatePipelineDecisionTrace` | `overall_outcome` + ordered `trace_entries` |
| C | `evaluatePipelineHealthReadModel` | `pipeline_health_state` |
| D | `evaluatePipelineDecisionVerdict` | `pipeline_decision_state` |
| E | `evaluatePipelineDecisionSuppression` | always `suppressed:true` + `not_*_authorized` |
| F | `evaluatePipelineForbiddenSurface` | `pipeline_surface_state` |
| G | `evaluatePipelineDecisionHealth` | `pipeline_decision_health_state` |

### Health worst-state-wins

`PIPELINE_HEALTH_*`: any missing → `UNCONFIGURED`, else `BLOCKED` beats `DEGRADED`
beats `SUPPRESSED` beats `REVIEWED_ADVISORY`. The signing/send-review healths' clean
path is `*_SUPPRESSED` by design (always-suppressed upstream), so the **pipeline
clean path is `PIPELINE_HEALTH_SUPPRESSED`**.

## Test

```
node --test packages/pipeline-decision-trace-foundations/test/*.test.mjs
```
