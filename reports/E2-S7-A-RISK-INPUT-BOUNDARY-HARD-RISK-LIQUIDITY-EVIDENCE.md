# E2 Stage-7 / PR-S7-A — Risk Input Boundary + Hard Risk Gate + Liquidity/Exit Feasibility Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/risk-engine-foundations`** package with the first three read-only/advisory `risk`-layer foundations
> **derived from Stage-6 signal-engine outputs**: **Risk Input Boundary** (Part C), **Hard Risk Gate Evaluation**
> (Part D), and **Liquidity / Exit Feasibility Risk** (Part E). All are pure, import-free, function-I/O-only,
> deterministic, fail-closed (Fail-Safe-Not-Fail-Open). **A risk verdict is NOT a trade order, NOT an intent, NOT a
> route, NOT a send permission, NOT trading readiness** — it is advisory/read-only ONLY; even a risk PASS is
> advisory. **No network primitive, no live quote, no Jupiter, no route, no live stream, no system clock, no
> persistence, no endpoint/secret, no dependency.** `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `4aad905` (branch `pr-s7-a-risk-input-hard-liquidity`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=93 fixtures=27 allowlist=1
> violations=0` · full suite **1171/1171** · risk-engine-foundations **36/36**.

---

## 1. New package
`packages/risk-engine-foundations/` — `package.json` (no dependencies), `src/index.{mjs,d.ts}`,
`src/risk-engine-foundations.{mjs,d.ts}`, `test/risk-engine-foundations.test.mjs`, `README.md`. Import-free, pure,
function-I/O-only; results are `Object.freeze` of fixed literals + fixed string-token reason codes from allowlists.
The risk functions **consume Stage-6 signal results passed in** (src import-free); the tests build **real** Stage-6
results via the `signal-engine-foundations` evaluators (over real Stage-5 intelligence over real Stage-4 normalized
events).

## 2. Risk Input Boundary (Part C)
- `describeRiskInputBoundaryContract()` · `validateRiskInputBoundary()` · `evaluateRiskInputBoundary()`.
- States `RISK_INPUT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_VALID`.
- Verifies risk input comes **only from Stage-6 signal outputs** (signal input boundary + candidate signal + signal
  score + signal suppression + signal health), each recognized by its signal-layer state field and carrying
  `read_only:true` — **not raw events, raw intelligence, endpoints, or trading commands**. Output:
  `risk_input_boundary_valid`, `eligible_for_risk_evaluation`, `risk_input_state`, `read_only:true`,
  `advisory_only:true`. A raw ingestion event or raw Stage-5 intelligence result passed directly →
  `raw_signal_input_refused` → `RISK_INPUT_INVALID`. `SIGNAL_BLOCKED` health / component `*_INVALID` → INVALID.
  Only all-present + read-only + `SIGNAL_READY_ADVISORY` health + `SIGNAL_INPUT_VALID` boundary → `RISK_INPUT_VALID`
  with `eligible_for_risk_evaluation:true` (still no readiness flags).

## 3. Hard Risk Gate Evaluation (Part D)
- `describeHardRiskGateContract()` · `validateHardRiskInput()` · `evaluateHardRiskGate()`.
- States `HARD_RISK_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_BLOCKED` / `_PASS_ADVISORY`. Output:
  `hard_risk_state`, `risk_blocked`, `risk_passed_advisory`, `risk_reason_codes`, `read_only:true`,
  `advisory_only:true`. Evaluates **safe boolean/enum `risk_factors` metadata from input ONLY** (no network):
  `honeypot_indicator` / `freeze_authority_indicator` / `mint_authority_indicator` / `owner_concentration_indicator`
  / `blacklist_indicator` / `unknown_token_metadata`. `risk_reason_codes` allowlist: `honeypot_indicator` ·
  `freeze_authority_active` · `mint_authority_active` · `owner_concentration_high` · `blacklist_indicator` ·
  `unknown_token_metadata` · `risk_factors_unknown` · `clean_factors_advisory`. Rules (Fail-Safe): missing
  `risk_factors` → `HARD_RISK_DEGRADED`; any honeypot/freeze/mint/blacklist/owner-concentration indicator →
  `HARD_RISK_BLOCKED`; `unknown_token_metadata` → `HARD_RISK_DEGRADED` (not pass); all clean →
  `HARD_RISK_PASS_ADVISORY`. **No execution/trade/intent/route/order/position approval; PASS opens no
  `intent_ready`/`trading_ready`/`can_send`.**

## 4. Liquidity / Exit Feasibility Risk (Part E)
- `describeLiquidityExitRiskContract()` · `validateLiquidityExitRiskInput()` · `evaluateLiquidityExitRisk()`.
- States `LIQUIDITY_EXIT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_BLOCKED` / `_PASS_ADVISORY`. **Descriptive from
  input buckets ONLY — no live quote, no Jupiter, no route.** Input buckets: `liquidity_observed_bucket`
  (`unknown`/`thin`/`adequate`/`deep`), `exit_feasibility_bucket` (`unknown`/`poor`/`limited`/`feasible`),
  `slippage_risk_bucket` (`unknown`/`high`/`medium`/`low`). Output: `liquidity_exit_state`, `exit_feasible_advisory`,
  `risk_blocked`, `risk_reason_codes`. Rules (Fail-Safe): BLOCKED on liquidity `thin` / exit `poor` / slippage
  `high`; DEGRADED on any `unknown` / exit `limited` / slippage `medium`; `PASS_ADVISORY` only on
  `adequate`/`deep` + `feasible` + acceptable slippage. **No quote/route/order field in any output; advisory pass
  opens no route/intent.**

## 5. Risk verdict ≠ intent / route / trading readiness
Every boundary/hard-risk/liquidity result spreads a shared `riskSafeFlags()`: `read_only:true` and
`signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`can_send`/`can_broadcast`/
`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/
`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`has_secret` = **false** — on **every** state,
including `RISK_INPUT_VALID`, `HARD_RISK_PASS_ADVISORY`, and `LIQUIDITY_EXIT_PASS_ADVISORY`. **`risk_ready` stays
false** — "risk passed advisory" is carried only by `risk_passed_advisory` / `exit_feasible_advisory` /
`risk_blocked` / the `*_state` field, never by an execution/readiness flag. No code path sets any true. **No risk →
intent / route / order / copy-execution / trading-readiness conversion.**

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/unknown/raw-input/smuggled-forbidden-flag/exec-or-route-command/secret/
endpoint/mainnet input → fail-closed (`*_UNCONFIGURED`/`*_INVALID`/`*_BLOCKED`); secret/endpoint values **never
echoed** (results are state + fixed reason-allowlist tokens); both hostile-proxy variants (throwing-accessor and
function-returning, via a `riskUninspectable` guard + try/catch) → frozen `*_UNCONFIGURED` with
`input_inspection_error`, **never throws**. Fail-Safe-Not-Fail-Open: when in doubt → DEGRADED/BLOCKED, never
advisory-pass.

## 7. Tests summary
New `test/risk-engine-foundations.test.mjs` — 36 proofs built against **real** Stage-6 signal results, covering
every required Stage-7 Parts-C/D/E test: missing signal input → fail-closed · invalid signal health → fail-closed ·
valid advisory signal → boundary valid only · raw ingestion/intelligence event → refused · smuggled intent/route/
trading flags → refused · endpoint/API key/secret/token → refused & never echoed · mainnet/REAL-LIVE → refused ·
hostile input → frozen, no throw · no risk factors → degraded · clean factors → advisory pass only · honeypot/
freeze/blacklist → blocked · unknown metadata → degraded · pass opens no intent/trading/can_send · thin liquidity /
poor exit / high slippage → blocked · adequate/deep + feasible → advisory pass only · no quote/route/order field ·
descriptors · static guards. **risk-engine-foundations 36/36; full suite 1171/1171** (1135 + 36). Independent
main-loop behavioral spot-check: **17/17 PASS** (real Stage-6 inputs).

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=93 fixtures=27 allowlist=1 violations=0` — **`sources` rose
91 → 93** (the two new package src `.mjs` files); `allowlist=1`/`violations=0` unchanged. SSOT drift **unchanged at
baseline** (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13
forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract identifiers.

## 9. No-live / no-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no live quote / Jupiter / route; no DB/Redis/Postgres/ClickHouse/persistence; no
SDK/dependency; no endpoint/secret in src/README; no intent ledger / trade intent / route planning / paper
execution / position lifecycle / transaction build; no signing/send/broadcast/serialize; no KMS/Vault/KeyManager;
no private key material; no mainnet; no REAL-LIVE.

## 10. Readiness impact
None — a risk-input-valid / hard-risk-pass / liquidity-pass state is **not** intent/routing/trading readiness; the
pipeline (`data → signal → risk → intent → …`) is advanced only into the read-only/advisory `risk` foundation;
`can_send:false` repo-wide unchanged.

---

**Confirmations:** New `risk-engine-foundations` package · Risk input boundary (Stage-6-only; raw events/
intelligence refused) · Hard risk gate (safe metadata only; honeypot/freeze/mint/blacklist/owner-concentration →
blocked; clean → advisory pass) · Liquidity/exit feasibility (input buckets only; no live quote/Jupiter/route) · A
risk verdict is not a trade order / intent / route / send permission / trading readiness · No risk→intent/route/
order/copy-execution conversion · No network primitive · No live quote · No live stream · No system clock · No
persistence · No dependency · No endpoint/secret in repo · No secret echoed · No signing/send/broadcast/serialize ·
No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged · signal +
intelligence + ingestion + gate-a + rpc-provider + send-gate green.
