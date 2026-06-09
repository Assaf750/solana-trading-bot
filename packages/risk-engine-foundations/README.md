# @soltrade/risk-engine-foundations

Read-only / advisory ONLY **risk** foundation for the architecture pipeline
`data -> signal -> risk -> intent -> route -> sign -> send`. This package builds
ONLY the `risk` stage, and only its read-only/advisory part, consuming **Stage-6
signal-engine outputs**. Every function is import-free, pure, deterministic, and
function-I/O-only. There is no network primitive, no live stream/WebSocket, no
system clock, no DB/Redis/Postgres/ClickHouse/filesystem/persistence, and no
secret handling. Results are `Object.freeze` of fixed literals + fixed reason
tokens drawn from allowlists. Hostile, throwing, or uninspectable input returns a
frozen refusal with reason `input_inspection_error` and never throws.

**THE CORE RULE:** a risk verdict is **NOT** a trade order, **NOT** an intent,
**NOT** a route, **NOT** a send permission, **NOT** trading readiness. It is
advisory / read-only ONLY. **Even a risk PASS is advisory.** `risk_ready` AND
`signal_ready` STAY `false` on every result — a risk verdict NEVER flips
`risk_ready` / `intent_ready` or any execution flag. "Risk passed advisory" is
carried ONLY by the dedicated fields `risk_passed_advisory` / `risk_blocked` /
`risk_*_state` / verdict states (e.g. `HARD_RISK_PASS_ADVISORY`,
`LIQUIDITY_EXIT_PASS_ADVISORY`), never by a readiness flag. Risk input comes ONLY
from Stage-6 signal outputs (signal input boundary, candidate signal, signal
score, signal suppression, signal health), never from raw ingestion events,
Stage-5 intelligence, endpoints, or execution commands. Forbidden
opportunity/execution/intent/route command keys (`buy` / `sell` / `execute` /
`submit` / `send` / `broadcast` / `swap` / `copy_now` / `trade_now` / `sign` /
`buy_opportunity` / `execute_opportunity` / `submit_opportunity` / `*_signal` /
`order` / `place_order` / `open_intent` / `create_intent` / `route` /
`plan_route`), smuggled trading flags, secrets, endpoints, and mainnet/REAL-LIVE
markers are refused as input and never emitted or echoed.

## (C) Risk Input Boundary (read-only)

`evaluateRiskInputBoundary` verifies that risk input comes ONLY from Stage-6
signal outputs. Each provided component (`signal_input_boundary`,
`candidate_signal`, `signal_score`, `signal_suppression`, `signal_health`) is
recognized as a Stage-6 result only if it carries a valid signal-layer state AND
`read_only === true`. A raw ingestion event or Stage-5 intelligence object in any
slot is refused (`raw_signal_input_refused`). A `RISK_INPUT_VALID` boundary opens
NO risk/intent/trading/routing readiness — `eligible_for_risk_evaluation` marks
the input shape only. States: `RISK_INPUT_UNCONFIGURED`, `RISK_INPUT_INVALID`,
`RISK_INPUT_DEGRADED`, `RISK_INPUT_VALID`. Required minimum components for VALID:
`signal_input_boundary` (`SIGNAL_INPUT_VALID`) + `candidate_signal` +
`signal_health` (`SIGNAL_READY_ADVISORY`).

## (D) Hard Risk Gate (read-only, advisory)

`evaluateHardRiskGate` evaluates advisory hard-risk from safe boolean/enum
metadata ONLY (`honeypot_indicator`, `freeze_authority_indicator`,
`mint_authority_indicator`, `owner_concentration_indicator`,
`blacklist_indicator`, `unknown_token_metadata`). No network, no live quote, no
clock. Fail-Safe-Not-Fail-Open: any hard blocker -> `HARD_RISK_BLOCKED`;
`unknown_token_metadata` with no blocker -> `HARD_RISK_DEGRADED` (NOT pass); all
clean -> `HARD_RISK_PASS_ADVISORY`. A PASS opens NO `intent_ready` /
`trading_ready` / `can_send` — it is advisory only. `risk_reason_codes` are drawn
from a fixed allowlist (`honeypot_indicator`, `freeze_authority_active`,
`mint_authority_active`, `owner_concentration_high`, `blacklist_indicator`,
`unknown_token_metadata`, `risk_factors_unknown`, `clean_factors_advisory`).

## (E) Liquidity / Exit Feasibility Risk (read-only, advisory)

`evaluateLiquidityExitRisk` derives a descriptive verdict from input buckets ONLY
(`liquidity_observed_bucket`, `exit_feasibility_bucket`, `slippage_risk_bucket`).
NO live quote, NO Jupiter, NO route — no quote/route/order field appears in any
output. Fail-Safe: thin liquidity OR poor exit OR high slippage ->
`LIQUIDITY_EXIT_BLOCKED`; any unknown / limited exit / medium slippage ->
`LIQUIDITY_EXIT_DEGRADED`; only adequate/deep liquidity + feasible exit + low
slippage -> `LIQUIDITY_EXIT_PASS_ADVISORY`. A PASS opens NO route / intent.

## (F) Exposure / Limit Risk (read-only, advisory)

`evaluateExposureLimitRisk` derives an advisory verdict from safe enum input ONLY
(`exposure_bucket`, `wallet_limit_state`, `token_limit_state`). NO position
lifecycle, NO live balance, NO clock. Fail-Safe: exposure `over_limit` OR
wallet/token limit `blocked` -> `EXPOSURE_LIMIT_BLOCKED`; any `unknown` OR
`near_limit` -> `EXPOSURE_LIMIT_DEGRADED`; only exposure `within_limit` +
wallet_limit `ok` + token_limit `ok` -> `EXPOSURE_LIMIT_PASS_ADVISORY`. A PASS
opens NO intent / routing / trading. `risk_reason_codes` are drawn from a fixed
allowlist (`exposure_unknown`, `exposure_near_limit`, `exposure_over_limit`,
`wallet_limit_unknown`, `wallet_limit_near`, `wallet_limit_blocked`,
`token_limit_unknown`, `token_limit_near`, `token_limit_blocked`,
`exposure_within_limit_advisory`).

## (G) Risk Verdict / Explanation (read-only, advisory)

`evaluateRiskVerdict` aggregates the three prior advisory risk results
(`hard_risk`, `liquidity_exit`, `exposure`) by their dedicated `*_state` fields
into a single advisory verdict + explanation. Fail-Safe: a smuggled forbidden
flag / execution command / secret / endpoint / mainnet on any component ->
`RISK_BLOCKED`; missing any of the three components -> `RISK_UNCONFIGURED`; any
component blocked -> `RISK_BLOCKED`; any component degraded/unconfigured/invalid ->
`RISK_DEGRADED`; all three advisory-pass -> `RISK_PASS_ADVISORY`. **CRITICAL:**
even `RISK_PASS_ADVISORY` opens NO `intent_ready` / `routing_ready` /
`trading_ready` / `can_send`. Reason codes (`hard_risk_blocked`,
`liquidity_exit_blocked`, `exposure_limit_blocked`, `hard_risk_degraded`,
`liquidity_exit_degraded`, `exposure_limit_degraded`, `risk_components_incomplete`)
and explanation codes (`hard_risk_pass`, `liquidity_exit_pass`,
`exposure_limit_pass`, `all_components_advisory_pass`) contain NO order/route/send
token.

## (H) Risk Suppression / Rejection (read-only)

`evaluateRiskSuppression` prevents progression to intent when risk is incomplete /
blocked / degraded. It emits REASONS ONLY and creates **NO intent**. Risk is NEVER
intent/route/execution authorized at this layer, so `not_intent_authorized` +
`not_route_authorized` + `not_execution_authorized` are ALWAYS present when
emitting. Missing/unconfigured verdict -> `suppressed:true` + `risk_not_evaluated`;
`RISK_BLOCKED` verdict -> `suppressed:true` + the matching `*_blocked` reason(s);
`RISK_DEGRADED` -> `suppressed:true` + `risk_degraded`; `RISK_PASS_ADVISORY` ->
`suppressed:false` but STILL no intent (only the `not_*_authorized` reasons).
Suppression opens NO `intent_ready` / `routing_ready` / `trading_ready`.

## (I) Risk Health / Status (read-only, advisory)

`evaluateRiskHealth` consumes the risk input boundary + hard-risk + liquidity-exit
+ exposure + verdict + suppression and derives a STATUS ONLY. Fail-Safe: a
smuggled forbidden trading flag (top-level or any component) OR secret OR mainnet
OR REAL-LIVE OR invalid `risk_input_boundary` (`RISK_INPUT_INVALID`) OR any
component blocked (verdict `RISK_BLOCKED`) -> `RISK_HEALTH_BLOCKED`; missing
required component -> `RISK_HEALTH_UNCONFIGURED`; `risk_suppression.suppressed ===
true` -> `RISK_HEALTH_SUPPRESSED`; `RISK_INPUT_VALID` + verdict
`RISK_PASS_ADVISORY` + not suppressed -> `RISK_HEALTH_PASS_ADVISORY`; else
`RISK_HEALTH_DEGRADED`. **CRITICAL:** `RISK_HEALTH_PASS_ADVISORY` is advisory
read-only, NOT intent / routing / trading readiness.

## Note on identifiers

All identifiers here (`RISK_INPUT_*`, `HARD_RISK_*`, `LIQUIDITY_EXIT_*`,
`risk_passed_advisory`, etc.) are **LOCAL function-I/O contract identifiers** for
this read-only/advisory foundation package — they are NOT SSOT vocabulary and add
no API/CONFIG/DATA names.
