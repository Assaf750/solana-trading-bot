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

## Note on identifiers

All identifiers here (`RISK_INPUT_*`, `HARD_RISK_*`, `LIQUIDITY_EXIT_*`,
`risk_passed_advisory`, etc.) are **LOCAL function-I/O contract identifiers** for
this read-only/advisory foundation package — they are NOT SSOT vocabulary and add
no API/CONFIG/DATA names.
