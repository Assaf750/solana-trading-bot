# @soltrade/gate-a-foundations

Gate-A Stage-3 foundations: read-only, pure, import-free helpers for evaluating
basic operational configuration and the audit path. No network primitive, no
system clock, no secret/env/file reads. Every result is a frozen literal and
hostile/throwing input returns a frozen refusal (`reason: input_inspection_error`)
rather than throwing. A valid config or audit path is **read-only** and NEVER
opens trading readiness, send, broadcast, signing, routing, mainnet, or REAL-LIVE
(all invariant flags are always `false`).

## Gate-A Config Validation (read-only)

Validates that basic operational config can be evaluated; missing/invalid config
fails closed. Forbidden trading indicators, secret-looking fields, and
mainnet/non-testnet environments are blocked.

- `describeGateAConfigValidationContract()` — frozen descriptor of the contract.
- `validateGateAConfig(config)` — `{ valid, recognized, reasons, ...invariantFlags }`.
- `evaluateGateAConfigReadiness(config)` — `{ valid, config_state, config_valid_read_only, status, reasons, ...invariantFlags }`.

States: `CONFIG_UNCONFIGURED` · `CONFIG_INVALID` · `CONFIG_VALID_READ_ONLY` · `CONFIG_DEGRADED`.
A `CONFIG_VALID_READ_ONLY` config is read-only only — it does not open trading readiness.

## Gate-A Audit Path (read-only)

Validates a test-only audit envelope carries a non-hidden `decision_ref` +
`actor_ref` + `reason_code` and attests no secret/private-key material and no
live execution. A missing decision/reason ref is treated as `AUDIT_INVALID`
(hidden decision), never silently degraded. The audit path cannot be bypassed.

- `describeGateAAuditPathContract()` — frozen descriptor of the contract.
- `validateGateAAuditEnvelope(envelope)` — `{ valid, recognized, reasons, ...invariantFlags }`.
- `evaluateGateAAuditPath(envelope)` — `{ valid, audit_state, audit_path_valid, status, reasons, ...invariantFlags }`.

States: `AUDIT_UNCONFIGURED` · `AUDIT_INVALID` · `AUDIT_DEGRADED` · `AUDIT_PATH_VALID`.

## Gate-A Readiness Aggregator (read-only)

Consumes the four read-only inputs — the Stage-2 RPCHealthMonitor result
(`rpc_health`), the ProtocolConstantMonitor result (`protocol_constants`), the
Gate-A config-readiness result (`config_readiness`), and the Gate-A audit-path
result (`audit_path`) — and derives a single Gate-A operational state. Provider,
observation, config, or audit failure fails closed: a forbidden trading indicator
or known-invalid config/audit yields `GATE_A_BLOCKED`; a missing or unconfigured
component yields `GATE_A_UNCONFIGURED`; anything not fully ready yields
`GATE_A_DEGRADED` with fixed component reason tokens. The aggregator makes no
network call, reads no env/secret, and never echoes any input value.

- `describeGateAReadinessAggregatorContract()` — frozen descriptor of the contract.
- `evaluateGateAReadiness(inputs)` — `{ valid, gate_a_state, gate_a_ready_read_only, status, reasons, ...invariantFlags }`.

States: `GATE_A_UNCONFIGURED` · `GATE_A_DEGRADED` · `GATE_A_READY_READ_ONLY` · `GATE_A_BLOCKED`.

**Readiness is NOT trading readiness.** Even at `GATE_A_READY_READ_ONLY` every
trading/exec invariant flag (`trading_ready`, `can_send`, `can_broadcast`,
`signing_permitted`, `is_live`, `real_live`, `mainnet_enabled`, …) stays `false`.

## Gate-A Status / Dashboard Shell (read-only, status-only)

Maps the Gate-A readiness state to a display status. The shell is **status-only**
and contains NO execution command (no buy/sell/execute/submit/send/broadcast/
swap/copy_now/trade_now); `can_trade`, `can_send`, and `can_broadcast` are fixed
`false`, and `requires_next_stage` is `data_ingestion`. It never echoes any input
value.

- `describeGateAStatusShellContract()` — frozen descriptor of the contract.
- `evaluateGateAStatusShell(gateAReadinessResult)` — `{ stage, status, can_trade, can_send, can_broadcast, requires_next_stage, read_only, status_only, has_execution_commands, ...invariantFlags }`.

Statuses: `read_only_ready` · `degraded` · `blocked` · `unconfigured`
(mapped from `GATE_A_READY_READ_ONLY` / `GATE_A_DEGRADED` / `GATE_A_BLOCKED` / else).
