# E2 Stage-7 / PR-S7-B — Exposure/Limit Risk + Risk Verdict + Risk Suppression + Risk Health Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends four
> read-only/advisory `risk`-layer foundations to `@soltrade/risk-engine-foundations`: **Exposure / Limit Risk**
> (Part F), **Risk Verdict / Explanation** (Part G), **Risk Suppression / Rejection** (Part H), and **Risk Health /
> Status** (Part I). All are pure, import-free, function-I/O-only, deterministic, fail-closed
> (Fail-Safe-Not-Fail-Open), and consume PRIOR risk results (hard-risk + liquidity-exit + exposure + verdict +
> suppression) and safe enum input. **Even `RISK_PASS_ADVISORY` and `RISK_HEALTH_PASS_ADVISORY` are NOT an intent,
> NOT a route, NOT trading readiness, NOT a send permission. Suppression creates NO intent.** No network primitive,
> no live quote/Jupiter, no live stream, no system clock, no persistence, no endpoint/secret, no dependency.
> `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `9713d7f` (branch `pr-s7-b-exposure-verdict-suppression-health`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=93 fixtures=27 allowlist=1
> violations=0` (append-only — `sources` stays 93) · full suite **1205/1205** · risk-engine-foundations **70/70**.

---

## 1. Exposure / Limit Risk (Part F)
- `describeExposureLimitRiskContract()` · `validateExposureLimitRiskInput()` · `evaluateExposureLimitRisk()`.
- States `EXPOSURE_LIMIT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_BLOCKED` / `_PASS_ADVISORY`. Advisory
  evaluation from **safe enum input ONLY**: `exposure_bucket` (`unknown`/`within_limit`/`near_limit`/`over_limit`),
  `wallet_limit_state` (`unknown`/`ok`/`near_limit`/`blocked`), `token_limit_state` (same). Output:
  `exposure_risk_state`, `risk_blocked`, `risk_passed_advisory`, `risk_reason_codes` (fixed allowlist). Rules
  (Fail-Safe): BLOCKED on `over_limit` / wallet `blocked` / token `blocked`; DEGRADED on any `unknown` / `near_limit`;
  `PASS_ADVISORY` only on `within_limit` + wallet `ok` + token `ok`. PASS opens no intent/routing/trading.

## 2. Risk Verdict / Explanation (Part G)
- `describeRiskVerdictContract()` · `evaluateRiskVerdict()`.
- **Consumes** the hard-risk + liquidity-exit + exposure result objects. States `RISK_UNCONFIGURED` /
  `RISK_DEGRADED` / `RISK_BLOCKED` / `RISK_PASS_ADVISORY`. Output: `risk_verdict_state`, `risk_passed_advisory`,
  `risk_blocked`, `risk_reason_codes` (allowlist), `risk_explanation_codes` (allowlist). Ordering: smuggled forbidden
  flag/exec/secret/endpoint → `RISK_BLOCKED`; missing any of the 3 components → `RISK_UNCONFIGURED`; any component
  blocked → `RISK_BLOCKED`; any degraded/unconfigured → `RISK_DEGRADED`; all three advisory-pass →
  `RISK_PASS_ADVISORY`. **Even `RISK_PASS_ADVISORY` opens no `intent_ready`/`routing_ready`/`trading_ready`/
  `can_send`; reason/explanation codes contain no order/route/send token.**

## 3. Risk Suppression / Rejection (Part H)
- `describeRiskSuppressionContract()` · `evaluateRiskSuppression()`.
- Output: `suppressed`, `suppression_reasons` (allowlist). `suppression_reasons` allowlist (ONLY these):
  `risk_not_evaluated` · `hard_risk_blocked` · `liquidity_exit_blocked` · `exposure_limit_blocked` ·
  `risk_degraded` · `not_intent_authorized` · `not_route_authorized` · `not_execution_authorized`.
  `not_intent_authorized`/`not_route_authorized`/`not_execution_authorized` are always present when emitting — **risk
  is never intent/route/execution authorized at this layer.** Missing/unconfigured verdict → suppressed +
  `risk_not_evaluated`; `RISK_BLOCKED` → suppressed + matching `*_blocked`; `RISK_DEGRADED` → suppressed +
  `risk_degraded`; `RISK_PASS_ADVISORY` → **not suppressed but STILL no intent** (only the `not_*_authorized`
  reasons). **Suppression opens no `intent_ready`/`routing_ready`/`trading_ready` and creates no intent.**

## 4. Risk Health / Status (Part I)
- `describeRiskHealthContract()` · `evaluateRiskHealth()`.
- **Consumes** risk input boundary + hard-risk + liquidity-exit + exposure + verdict + suppression. States
  `RISK_HEALTH_UNCONFIGURED` / `_DEGRADED` / `_PASS_ADVISORY` / `_SUPPRESSED` / `_BLOCKED`. Output:
  `risk_health_state`, `risk_health_pass_advisory`. Fail-closed ordering: smuggled forbidden trading flag (top-level
  or any component) / secret / mainnet / REAL-LIVE / invalid risk_input_boundary / any blocked component →
  `RISK_HEALTH_BLOCKED`; missing required component → `RISK_HEALTH_UNCONFIGURED`; `risk_suppression.suppressed` →
  `RISK_HEALTH_SUPPRESSED`; boundary `RISK_INPUT_VALID` + verdict `RISK_PASS_ADVISORY` + not suppressed →
  `RISK_HEALTH_PASS_ADVISORY`; else `RISK_HEALTH_DEGRADED`. **`RISK_HEALTH_PASS_ADVISORY` is advisory read-only —
  NOT intent/routing/trading readiness.**

## 5. Advisory / not-intent invariant
Every Part F/G/H/I result spreads the existing shared `riskSafeFlags()` (reused unchanged from PR-S7-A):
`read_only:true` and `signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`can_send`/
`can_broadcast`/`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/
`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`has_secret` = **false** — on **every** state,
including `EXPOSURE_LIMIT_PASS_ADVISORY`, `RISK_PASS_ADVISORY`, and `RISK_HEALTH_PASS_ADVISORY`. **`risk_ready` stays
false.** No output contains a quote/route/order/intent_id field. **No risk → intent / route / order /
copy-execution / trading-readiness conversion.**

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/invalid/smuggled-forbidden-flag/exec-command/secret/endpoint/mainnet input
→ fail-closed (`*_UNCONFIGURED` / `*_INVALID` / `*_BLOCKED` / suppressed); secret/endpoint/mainnet values **never
echoed** (outputs are state + fixed allowlist/reason tokens, filtered via `.includes()` against frozen allowlists);
both hostile-proxy variants (throwing-accessor and function-returning, via the reused `riskUninspectable` guard +
try/catch) → frozen `*_UNCONFIGURED` (`evaluateRiskSuppression` → frozen suppressed), **never throws**.

## 7. Append-only / helper reuse
Appended to the existing `risk-engine-foundations.mjs`/`.d.ts`/README/test — **no new src file** (mechanism guard
`sources` stays 93); existing functions and the shared `riskSafeFlags`/`riskScreen`/`riskUninspectable`/`RISK_*`
helpers are reused **unmodified** (git diff shows zero deletions in the src `.mjs`). Exactly 4 files differ vs main.

## 8. Tests summary
Appended to `test/risk-engine-foundations.test.mjs` (Exposure F-*, Verdict G-*, Suppression H-*, Health I-*,
descriptors, static guards), built against **real** prior risk results. **risk-engine-foundations 70/70 (36 prior +
34 new); full suite 1205/1205** (1171 + 34). Independent main-loop behavioral spot-check: **22/22 PASS** (exposure
over/within/unknown; verdict all-pass/blocked/missing + no order/route/send code; suppression missing/pass; health
UNCONFIGURED/BLOCKED/PASS_ADVISORY/SUPPRESSED; smuggled trading-flag & secret/mainnet → BLOCKED never echoed;
hostile proxies frozen across all 4 fns).

## 9. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=93 fixtures=27 allowlist=1 violations=0` — **`sources` stays
93** (append, no new src file). SSOT drift **unchanged at baseline**
(`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30`).
No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract identifiers.

## 10. No-live / no-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no live quote / Jupiter / route; no DB/Redis/Postgres/ClickHouse/persistence; no
SDK/dependency; no endpoint/secret in src/README; no intent ledger / trade intent / route planning / paper
execution / position lifecycle / transaction build; no signing/send/broadcast/serialize; no KMS/Vault/KeyManager;
no private key material; no mainnet; no REAL-LIVE.

## 11. Readiness impact
None — exposure/verdict/suppression/health states are **not** intent/routing/trading readiness; the pipeline
(`data → signal → risk → intent → …`) is advanced only within the read-only/advisory `risk` foundation;
`can_send:false` repo-wide unchanged.

---

**Confirmations:** Exposure/limit risk (safe enum only; over/blocked → BLOCKED; within+ok → advisory pass) · Risk
verdict/explanation (aggregates hard-risk+liquidity+exposure; `RISK_PASS_ADVISORY` not intent/route; codes carry no
order/route/send) · Risk suppression/rejection (reasons only; creates no intent; always `not_intent/route/
execution_authorized`) · Risk health/status (consumes boundary+components+verdict+suppression; `RISK_HEALTH_
PASS_ADVISORY` advisory-only) · No risk → intent/route/order/copy-execution conversion · Append-only (sources stays
93) · No network primitive · No live quote · No live stream · No system clock · No persistence · No dependency · No
endpoint/secret in repo · No secret echoed · No signing/send/broadcast/serialize · No mainnet · No REAL-LIVE · No
new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged · prior risk + signal + intelligence + ingestion +
gate-a + rpc-provider + send-gate green.
