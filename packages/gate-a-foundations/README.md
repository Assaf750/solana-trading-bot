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
