# E2 Stage-13 — End-to-End Decision-Trace Orchestrator — EVIDENCE

> **IMPLEMENTATION-FIRST stage (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/pipeline-decision-trace-foundations`** package — a pure read-only/advisory **END-TO-END
> DECISION-TRACE ORCHESTRATOR** that COMPOSES the already-computed terminal RESULTS of Stages 6–12 into (1) one
> deterministic ordered **Decision Trace** (per-stage outcome + decisive reason) and (2) a full-pipeline
> **health/status read-model**. It performs **no execution**: it does not run any stage, does not sign, does not
> send, does not broadcast — it is a pure COMPOSER over results passed in. `can_send`/`can_broadcast`/`signer_ready`
> and every readiness/execution flag stay false. This **completes the read-only/advisory review pipeline (Stages
> 4–12) end-to-end**.
>
> **State:** built on `main` @ `813c67b` (branch `pr-s13-decision-trace`, `main + 1`, parent == main) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` unchanged · mechanism guard `sources=105 fixtures=27
> allowlist=1 violations=0` · SSOT drift EXACT baseline · full suite **1613/1613** · pipeline-decision-trace-
> foundations **34/34** · independent main-loop spot-check **66/66**.

---

## 1. New package
`packages/pipeline-decision-trace-foundations/` (`@soltrade/pipeline-decision-trace-foundations`, v0.0.0, type
module, no dependencies). **Import-free** src — it consumes the prior stages' terminal RESULTS passed in as a bundle;
the test **copies the upstream real Stage-4→12 chain builders verbatim** to produce real terminal results, then
assembles the bundle. 14 exports across 7 foundations (A–G).

## 2. The seven foundations
| Part | Foundation | Role |
|---|---|---|
| A | Decision-Trace Input Boundary | validates the bundle of stage terminal results; eligible only when all present + well-formed; fail-closed on smuggle/raw/hostile |
| B | Decision-Trace Composer | deterministic ordered `trace_entries` (6 stages) + `overall_outcome` |
| C | Pipeline Health Read-Model | worst-state-wins aggregate (`PIPELINE_HEALTH_*`) |
| D | Pipeline Decision Verdict | end-to-end `PIPELINE_DECISION_*` (REVIEWED_ADVISORY only end-to-end) |
| E | Pipeline Decision Suppression | always-suppressed |
| F | Pipeline Forbidden Surface Guard | redacting NAME-only guard over the whole bundle |
| G | Pipeline Decision Health | overall health; clean path → SUPPRESSED |

**Stage bundle slots** (each recognized ONLY by `read_only:true` + its known terminal state field, discovered by
reading the upstream src): `signal_health.signal_state` · `risk_verdict.risk_verdict_state` +
`risk_health.risk_health_state` · `intent_terminal.intent_state` + `intent_health.intent_health_state` ·
`route_verdict.execution_plan_preview_state` + `route_health.route_health_state` ·
`signing_review_verdict.signing_review_state` + `signing_review_health.signing_review_health_state` ·
`send_review_verdict.send_review_state` + `send_review_health.send_review_health_state`.

## 3. The composer copies only allowlisted fields (no copy-through)
Each `trace_entries` entry copies **only** `{ stage (fixed enum), stage_state (the recognized state STRING),
decisive_reason (from a fixed 9-code allowlist), advanced:boolean, blocked:boolean }`. It **never** copies an
endpoint/url/serialized-tx/signed-tx/signature/private-key/secret field from any input. Fixed order
`[signal, risk, intent, route, signing_review, send_review]`. `overall_outcome` ∈
`{reviewed_advisory_all_stages, blocked_at_stage, degraded, unconfigured}` — `reviewed_advisory_all_stages` only when
every stage advanced to its terminal-advisory state and nothing blocked.

## 4. Orchestrator ≠ execution
Every result spreads a shared `traceSafeFlags()`: `read_only:true` + the **24** exec/readiness flags = false (incl.
`can_send`, `can_broadcast`, `signer_ready`, `signing_permitted`, `transaction_ready`, `network_call_made`,
`is_live`, `mainnet_enabled`, `real_live`) — on **every** state including `PIPELINE_TRACE_INPUT_VALID`,
`PIPELINE_DECISION_REVIEWED_ADVISORY`, `PIPELINE_DECISION_HEALTH_REVIEWED_ADVISORY`. Because the upstream
signing/send-review healths are always-suppressed, the **clean pipeline path resolves to `PIPELINE_HEALTH_SUPPRESSED`
/ `PIPELINE_DECISION_HEALTH_SUPPRESSED`** — the orchestrator never self-promotes to "reviewed". Suppression (E)
**always** carries `not_execution_authorized` / `not_sign_authorized` / `not_send_authorized` on every path
(including hostile/missing).

## 5. Pipeline Forbidden Surface Guard (Part F)
Scans top-level keys against a frozen forbidden-NAME list combining key-material names
(`private_key`/`secret_key`/`keypair`/`mnemonic`/`seed`/`signing_key`/`signature`/`signed_tx`/`signed_transaction`)
and live names (`endpoint`/`endpoint_url`/`rpc_url`/`provider_url`/`node_url`/`ws_url`/`serialized_tx`/
`serialized_transaction`/`wire_transaction`/`raw_tx`/`raw_transaction`/`tx_bytes`/`message_bytes`/`broadcast_payload`/
`send_payload`). Any forbidden name → `PIPELINE_SURFACE_BLOCKED` with `forbidden_field_ref` = NAME only (value
provably absent from `JSON.stringify`); detection booleans are DETECTION outputs (true == BLOCKED == safe), not
readiness flags; hostile → `PIPELINE_SURFACE_UNCONFIGURED`, never throws.

## 6. Verification
- **Build workflow (impl + 4 review lenses + arbiter):** GREEN, 0 confirmed blockers. Arbiter independently re-ran
  all gates and planted 4 forbidden VALUES across the top level + 6 bundle slots: all 7 evaluators return
  Object.frozen + `read_only:true` outputs with the planted values provably absent from `JSON.stringify`, all 24
  flags false, never throwing.
- **My independent main-loop verification:** full suite **1613/1613**; SSOT drift EXACT baseline; mechanism guard
  `sources=105 fixtures=27 allowlist=1 violations=0`; src import-free; 14 exports; `can_send/can_broadcast:true`
  absent repo-wide in src.
- **My independent behavioral spot-check: 66/66 PASS** (temp script, run then deleted): Part-F guard redaction for 8
  planted key-material/live VALUES (each absent from `JSON.stringify`, `forbidden_field_ref` == NAME); suppression
  always carrying the three `not_*_authorized` tokens on clean/undefined/hostile; composer emits exactly 6 ordered
  stage entries copying only the 5 allowlisted keys, `reviewed_advisory_all_stages` on the clean bundle; **no
  copy-through** — a forbidden field planted inside a slot makes the whole trace `blocked_at_stage` with **zero
  entries** and the planted VALUE absent from the trace JSON; a top-level forbidden name → boundary INVALID, value
  never echoed; composer/health/verdict/decision-health all frozen with all 24 flags false.

## 7. Governance / guard / scope
SSOT drift EXACT baseline (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83)
cmd=13 forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract
identifiers; stage-name and consumed state values overlapping SSOT enums are consumed-only. `ALLOWLIST` single entry
(line 121) unchanged; `tools/` and `docs/00`–`12` untouched; only the new package was added; `sources` rose +2.

---

**Confirmations:** New `pipeline-decision-trace-foundations` package (7 foundations A–G, 14 exports) · a pure
read-only COMPOSER over Stages 6–12 terminal results · no execution / no running a stage / no sign / no send /
no broadcast · deterministic 6-stage ordered Decision Trace copying ONLY stage+state+allowlisted-reason (no
copy-through of any endpoint/serialized/signature/key field) · full-pipeline health read-model (worst-state-wins;
clean path SUPPRESSED) · always-suppressed · Pipeline Forbidden Surface Guard redacting NAME-only · all 24 exec/
readiness flags false on every state · fail-closed (never throws) · src import-free · no network/clock/persistence/
dependency · no new SSOT name · ALLOWLIST unchanged · drift EXACT · `can_send`/`can_broadcast` false repo-wide ·
full suite 1613/1613 · package 34/34 · independent spot-check 66/66 · `docs/00`–`12` untouched. **This completes the
end-to-end read-only/advisory review pipeline (Stages 4–12).**
