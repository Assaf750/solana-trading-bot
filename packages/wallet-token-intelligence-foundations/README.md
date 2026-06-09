# @soltrade/wallet-token-intelligence-foundations

Read-only wallet/token observation intelligence foundations for Stage-5. Every
function is import-free, pure, deterministic, and function-I/O-only. There is no
network primitive, no live stream/WebSocket, no system clock, no DB/Redis/
Postgres/ClickHouse/filesystem/persistence, and no secret handling. Results are
`Object.freeze` of fixed literals + counts + whitelisted opaque refs + fixed
reason tokens. Hostile, throwing, or uninspectable input returns a frozen
refusal with reason `input_inspection_error` and never throws.

CRITICAL: intelligence here is OBSERVATION / SUMMARY ONLY. An observation NEVER
becomes a signal; a token diagnostic NEVER becomes a buy recommendation; no
result opens signal/trading/risk/intent/routing readiness. Forbidden
opportunity/execution command keys (`buy_opportunity` / `execute_opportunity` /
`submit_opportunity` / `buy` / `sell` / `copy_now` / `trade_now` / `execute` /
`submit` / `send` / `broadcast` / `sign` / `*_signal`) are rejected as input and
never emitted.

## Wallet Observation Intelligence (read-only)

Derived from Stage-4 normalized ingestion events. `evaluateWalletObservationIntelligence`
produces a descriptive wallet summary only — observed event/swap/mint/balance-change
counts plus first/last opaque event refs. An observation is NEVER a signal and opens
no signal/trading/risk/intent/routing readiness; it emits no buy/sell/copy signal,
recommendation, intent, route, or priority. States: `WALLET_OBS_UNCONFIGURED`,
`WALLET_OBS_INVALID`, `WALLET_OBS_DEGRADED`, `WALLET_OBS_READ_ONLY_OK`.

## Token Observation Intelligence (read-only)

Derived from Stage-4 normalized ingestion events. `evaluateTokenObservationIntelligence`
produces a descriptive token summary only — observed event/mint/pool/swap counts plus
a distinct-wallet count. It is NEVER a buy recommendation, opportunity acceptance, or
execution/route intent; there is no P&L and no price/stop-loss guarantee, and an
accepted observation does not become a buy order. States: `TOKEN_OBS_UNCONFIGURED`,
`TOKEN_OBS_INVALID`, `TOKEN_OBS_DEGRADED`, `TOKEN_OBS_READ_ONLY_OK`.

## Wallet-Token Relationship (read-only)

Derived from observed events only. `evaluateWalletTokenRelationship` summarizes the
relationship between a wallet ref and a token ref — a relationship event count plus the
sorted set of observed interaction types (fixed observed event-type strings only) and
first/last opaque refs. It is NEVER a copy recommendation, leader signal, early-buyer
signal, risk approval, intent, execution priority, or position open/close command.
States: `RELATIONSHIP_UNCONFIGURED`, `RELATIONSHIP_INVALID`, `RELATIONSHIP_DEGRADED`,
`RELATIONSHIP_READ_ONLY_OK`. No network, clock, persistence, or secret.
