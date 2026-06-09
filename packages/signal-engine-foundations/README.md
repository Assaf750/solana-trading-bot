# @soltrade/signal-engine-foundations

Read-only / advisory ONLY **signal** foundation for the architecture pipeline
`data -> signal -> risk -> intent -> route -> sign -> send`. This package builds
ONLY the `signal` stage, and only its read-only/advisory part. Every function is
import-free, pure, deterministic, and function-I/O-only. There is no network
primitive, no live stream/WebSocket, no system clock, no DB/Redis/Postgres/
ClickHouse/filesystem/persistence, and no secret handling. Results are
`Object.freeze` of fixed literals + counts/buckets + whitelisted opaque refs +
fixed reason tokens. Hostile, throwing, or uninspectable input returns a frozen
refusal with reason `input_inspection_error` and never throws.

**THE CORE RULE:** a candidate signal is **NOT** a buy order, **NOT** a copy
permission, **NOT** trading readiness, **NOT** risk approval, **NOT** an intent,
**NOT** a route. It is advisory / read-only ONLY. `signal_ready` STAYS `false` on
every result — "a candidate signal exists" is carried ONLY by the dedicated
fields `candidate_signal_valid` / `candidate_signal_state` /
`eligible_for_candidate_signal`, never by a readiness/execution flag. Input comes
ONLY from Stage-5 intelligence outputs (wallet/token observation, relationship,
diagnostics, intelligence health), never from raw ingestion events, endpoints,
or execution commands. Forbidden opportunity/execution command keys
(`buy_opportunity` / `execute_opportunity` / `submit_opportunity` / `buy` /
`sell` / `copy_now` / `trade_now` / `execute` / `submit` / `send` / `broadcast` /
`swap` / `sign` / `order` / `place_order` / `*_signal`), smuggled trading flags,
secrets, endpoints, and mainnet/REAL-LIVE markers are refused as input and never
emitted or echoed.

## (C) Signal Input Boundary (read-only)

`evaluateSignalInputBoundary` verifies that signal input comes ONLY from Stage-5
intelligence outputs. Each provided component is recognized as a Stage-5 result
only if its state field is present with an allowed value AND `read_only === true`.
A raw ingestion event in any slot is refused (`raw_ingestion_event_refused`). A
`SIGNAL_INPUT_VALID` boundary opens NO signal/trading/risk/intent/routing
readiness — `eligible_for_candidate_signal` marks input shape only. States:
`SIGNAL_INPUT_UNCONFIGURED`, `SIGNAL_INPUT_INVALID`, `SIGNAL_INPUT_DEGRADED`,
`SIGNAL_INPUT_VALID`. Required minimum components for VALID: `wallet_observation`
+ `token_observation` + `intelligence_health` (all read-only-ok / ready).

## (D) Wallet-Led Candidate Signal (read-only, advisory)

`evaluateWalletLedCandidateSignal` derives a descriptive candidate from wallet
activity intelligence ONLY (with optional relationship/diagnostics). It is NEVER
a buy/sell/copy order. `reason_codes` is a frozen array drawn from a fixed
allowlist only (`wallet_activity_observed`, `wallet_token_relationship_observed`,
`repeat_interaction_observed`, `sufficient_observation_density`,
`insufficient_observations`). `confidence_bucket` (`none`/`low`/`medium`/`high`)
is DESCRIPTIVE only — derived from observed counts, never a trade size, slippage,
stop-loss, or numeric score. Insufficient observations (wallet not
`WALLET_OBS_READ_ONLY_OK` or zero observed events) -> `WALLET_LED_SUPPRESSED`.
States: `WALLET_LED_UNCONFIGURED`, `WALLET_LED_INVALID`, `WALLET_LED_SUPPRESSED`,
`WALLET_LED_CANDIDATE`.

## (E) Token Activity Candidate Signal (read-only, advisory)

`evaluateTokenActivityCandidateSignal` derives a descriptive candidate from token
intelligence ONLY. A mint/pool observation NEVER becomes a buy opportunity or
opportunity execution; `buy_opportunity` / `execute_opportunity` /
`submit_opportunity` keys drive `TOKEN_ACTIVITY_INVALID`. An `accepted:true` field
in the input is IGNORED (never read as execution authority) and never surfaces in
the result; the output keeps all flags false. `reason_codes` allowlist only
(`token_activity_observed`, `pool_observed`, `mint_observed`,
`multi_wallet_activity_observed`, `insufficient_token_observations`). States:
`TOKEN_ACTIVITY_UNCONFIGURED`, `TOKEN_ACTIVITY_INVALID`,
`TOKEN_ACTIVITY_SUPPRESSED`, `TOKEN_ACTIVITY_CANDIDATE`.

## (F) Candidate Signal Scoring / Explanation (read-only, advisory)

`evaluateCandidateSignalScore` aggregates Stage-6 candidate signal RESULTS (Part
D/E outputs, with an optional `boundary`) into a DESCRIPTIVE `score_bucket`
(`none`/`low`/`medium`/`high`). The bucket is derived ONLY from how many valid
candidates exist and their `confidence_bucket` — it is NEVER a trade size,
slippage, stop-loss, order, or numeric trading score, and the result carries no
size/slippage/order field. It opens NO execution authority: even
`score_bucket='high'` keeps `signal_ready` / `trading_ready` / `intent_ready` /
`routing_ready` / `can_send` `false`. No candidates -> `'none'`; suppressed/invalid
candidates with none valid -> `'low'` or `'none'` plus `suppression_reasons`.
`explanation_codes` allowlist only (`wallet_led_candidate_present`,
`token_activity_candidate_present`, `multiple_candidates_present`,
`relationship_supported`, `sufficient_observation_density`,
`no_candidates_present`); `suppression_reasons` reuse the Part G allowlist. States:
`SIGNAL_SCORE_UNCONFIGURED`, `SIGNAL_SCORE_INVALID`, `SIGNAL_SCORE_SUPPRESSED`,
`SIGNAL_SCORE_DESCRIBED`.

## (G) Signal Suppression / Rejection (read-only, advisory)

`evaluateSignalSuppression` prevents insufficient candidates from appearing ready
by emitting suppression REASONS only. It is **NOT a risk engine** — suppression
happens BEFORE risk and opens NO `risk_ready` / `intent_ready` / `trading_ready`
(all stay `false`). `suppression_reasons` is drawn from a fixed allowlist ONLY:
`insufficient_observations`, `missing_wallet_context`, `missing_token_context`,
`relationship_not_observed`, `diagnostic_only`, `not_risk_checked`,
`not_intent_authorized`, `not_execution_authorized`. Whenever reasons are emitted,
`not_risk_checked` + `not_intent_authorized` + `not_execution_authorized` are
ALWAYS included — a signal is never risk-checked, intent-authorized, or
execution-authorized at this layer. Missing wallet context -> suppressed +
`missing_wallet_context`; missing token context -> suppressed +
`missing_token_context`; diagnostic-only input -> suppressed + `diagnostic_only`.

## (H) Signal Health / Status (read-only, advisory)

`evaluateSignalHealth` consumes `{ signal_input_boundary, candidate_signals[],
score, suppression }` and derives a status ONLY. Ordering: a smuggled forbidden
trading flag / secret / mainnet / REAL-LIVE in any component, or an invalid
signal-input boundary (`SIGNAL_INPUT_INVALID`), -> `SIGNAL_BLOCKED`; a missing
required component -> `SIGNAL_UNCONFIGURED`; `suppression.suppressed === true` or
all candidates suppressed -> `SIGNAL_SUPPRESSED`; boundary `SIGNAL_INPUT_VALID` +
>=1 valid candidate + score not `'none'` + not suppressed ->
`SIGNAL_READY_ADVISORY`; else `SIGNAL_DEGRADED`. `SIGNAL_READY_ADVISORY` is
ADVISORY read-only ONLY — NOT trading / risk / intent / routing readiness — and
`signal_ready` plus every execution flag STAY `false` in every state.

## Naming note

All identifiers exported here (states, reason codes, contract names) are local
function-I/O contract identifiers, NOT SSOT vocabulary. This package adds no new
SSOT / API / CONFIG / DATA name and converts no `candidate_*` to implemented.
