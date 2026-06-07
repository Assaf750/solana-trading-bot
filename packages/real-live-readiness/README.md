# @soltrade/real-live-readiness (Gate E / E0)

REAL-LIVE **Readiness Checklist Evaluator** — a **pure, in-memory, deterministic** aggregation of
already-defined signals into a readiness verdict + an explicit blocker list, per
`09-THREAT-SECURITY §7` / §7.8 and `06-BUILD §4/§6`.

> **Readiness does not activate REAL-LIVE.** This evaluator is a **prerequisite** for `activate_real_live`;
> it never calls activation, never mutates state, and introduces no live mechanism: no KeyManager, no key
> material, no signing/sending, no transaction building/serialization, no RPC/provider, no DB writes,
> no REAL-LIVE activation, no mechanism-guard carve-out, no execution authority.
> **Fail-safe: any missing/unknown/invalid input ⇒ not ready.**

## Source of truth
- `docs/09-THREAT-SECURITY.md` §7 (readiness checklist) · §7.8 (explicit blockers)
- `docs/06-BUILD-SPEC.md` §4 (readiness gate rule) · §6 (Gate E)
- `docs/01-SSOT.md` G1/G5/G10/G15 (input states) · G11 (`REAL_LIVE_CONFIG_INVALID`, `resource_type=readiness`) · G14 (audit)

## API
```js
import { evaluateRealLiveReadiness, isRealLiveReady, createReadinessAuditLog } from '@soltrade/real-live-readiness';

const verdict = evaluateRealLiveReadiness(input);          // { ready, blockers, prerequisite_for }
const verdict2 = evaluateRealLiveReadiness(input, { auditLog, audit_actor }); // + append-only readiness audit
const ok = isRealLiveReady(input);                          // boolean
```

## Inputs (all caller-supplied; mock where applicable)
`real_live_config_valid` (bool) · `validation_status` (valid/warning/invalid) · `signer_profile_status`
(ACTIVE/DISABLED/REVOKED/DEGRADED) · `execution_wallet_status` · `operating_state` · `protocol_constant_status`
(green/changed) · `provider_degraded` (bool) · `slot_lag` (number) + `slot_lag_max` (mock threshold) ·
`audit_path_available` (bool, mock) · `admission_complete` (bool, mock) · `operator_checklist_complete` (bool, mock).

## Checks → ready iff all pass
| condition | required value | blocker code on failure |
|---|---|---|
| Hard Risk config complete | `real_live_config_valid === true` | `REAL_LIVE_CONFIG_INVALID` (SSOT) |
| config validation | `validation_status === 'valid'` | `config_validation_invalid` |
| signer profile | `signer_profile_status === 'ACTIVE'` | `signer_profile_not_active` |
| execution wallet | `execution_wallet_status === 'ACTIVE'` | `execution_wallet_not_active` |
| operating state | `operating_state === 'ACTIVE'` (EXITS_ONLY/KILLED/PAUSED/WARMING_UP → not ready) | `operating_state_not_ready` |
| protocol constants | `protocol_constant_status === 'green'` | `protocol_constant_changed` |
| provider health | `provider_degraded === false` | `provider_degraded` |
| slot lag | finite `slot_lag ≤ slot_lag_max` | `slot_lag_exceeded` |
| audit path | `audit_path_available === true` | `audit_path_unavailable` |
| admission | `admission_complete === true` | `admission_incomplete` |
| operator checklist | `operator_checklist_complete === true` | `operator_checklist_incomplete` |

## Readiness verdict model
Result-model `{ ready: boolean, blockers: [{ code, detail? }], prerequisite_for: 'activate_real_live' }`.
`ready === true` iff `blockers.length === 0`. **This is not a `readiness_status` enum** — SSOT keeps
`WARNING_CRITICAL` as the grounded readiness display and does not register `ready`/`not_ready`; this is an
internal result-model boolean only.

## Failure modes
Any input missing/undefined/unknown ⇒ its blocker is added ⇒ **not ready** (Fail-Safe-Not-Fail-Open).
The config-invalid blocker surfaces the SSOT api_error_code `REAL_LIVE_CONFIG_INVALID`.

## Audit (optional evidence)
If `{ auditLog, audit_actor }` is supplied, one **append-only** entry is recorded with
`resource_type`/`audit_scope`=`readiness`, `audit_actor`, `audit_reason` (verdict + blocker codes).
This is observability of `resource_type=readiness`, not a command.

## Not in scope (forbidden here, and absent)
No `activate_real_live` execution (reference name only) · no KeyManager / KMS / key custody ·
no private key / seed / keypair / mnemonic · no signing library · no transaction building/serialization ·
no signing/sending · no RPC/Solana/Jupiter/Helius/Jito · no live transfer/sweep/funding · no DB writes ·
no migrations · no API/dashboard · no mechanism-guard carve-out · no `candidate_*` promotion.
