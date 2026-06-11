# @soltrade/live-stream-boundary-foundations

Stage-17 (Phase-C opener): the **LIVE DATA INTEGRATION (READ-ONLY) boundary layer** — everything **up to** the activation seam, and nothing past it. Import-free, pure, deterministic, fail-closed. **No live connection is made anywhere in this package**; real transport belongs only in a clearly-marked future adapter package that does not exist yet and requires its own separate review.

## Foundations (A–G)

| # | Foundation | Evaluate | States |
|---|---|---|---|
| A | Live-source descriptor boundary | `evaluateLiveSourceBoundary` | `LIVE_SOURCE_UNCONFIGURED / _INVALID / _READ_ONLY_OK` |
| B | Live-activation seam descriptor | `evaluateLiveActivationSeam` | `LIVE_SEAM_UNCONFIGURED / _INVALID / _DESCRIPTOR` |
| C | Stream-health / gap read-model | `evaluateStreamHealthReadModel` | `LIVE_STREAM_HEALTH_UNCONFIGURED / _INVALID / _SYNCED / _GAP_RECOVERABLE / _GAP_EXCEEDED / _DEGRADED` |
| D | Live-readiness checklist read-model | `evaluateLiveReadinessChecklist` | `LIVE_READINESS_UNCONFIGURED / _INVALID / _CHECKLIST` |
| E | Live suppression | `evaluateLiveSuppression` | always `suppressed:true` |
| F | Live forbidden surface guard | `evaluateLiveForbiddenSurface` | `LIVE_SURFACE_UNCONFIGURED / _CLEAN / _BLOCKED` |
| G | Live-boundary health | `evaluateLiveBoundaryHealth` | `LIVE_BOUNDARY_HEALTH_UNCONFIGURED / _DEGRADED / _REVIEWED_ADVISORY / _SUPPRESSED / _BLOCKED` (clean path → `_SUPPRESSED`) |

Each foundation also ships a `describe*Contract()`.

## Hard rules

- A live source is a **disabled / read-only descriptor tag only** (`live_helius_laserstream_disabled`, `live_triton_yellowstone_disabled`, `generic_grpc_stream_disabled`, `fixture_stream`, `mock_stream`). Any enabled/live-active tag, URL, endpoint, credential field, or raw credential value is refused and never echoed (NAME-only redaction).
- Provider secrets travel **by reference only** (`provider_key_ref`); the ref itself is refused when secret-shaped (`://`, whitespace, > 128 chars, base58-blob/PEM shape) and its value is never echoed.
- The activation seam **describes** what activation would require and **never activates**: `activation_performed:false` is a fixed literal, `LIVE_REQ_SEPARATE_ADAPTER_REVIEW` is hardcoded `met:false` (the adapter does not exist yet), so `seam_ready_advisory` is **always false in this package**. Activation — when it ever happens — never grants execution authority.
- Stream gap / provider degradation alone never escalates beyond **EXITS_ONLY-shaped** read-model advisory (never KILLED-shaped). `max_backfill_window_slots` is caller-supplied and **never defaulted**.
- SSOT Group 5 names (`last_seen_slot`, `last_confirmed_slot`, `slot_lag`, `provider_degraded`) are **consumed-only input field names**; SSOT Group 1 operating-state values are **consumed-only advisory vocabulary**. This package adds **no SSOT name** and never writes any operating state.
- Every result is frozen, spreads the 24 read-only/exec-false flags, never throws on hostile input, and snapshots every consumed object **once** (TOCTOU defense).

## Test

```
node --test packages/live-stream-boundary-foundations/test/
```
