# E2-F-18 — RPCHealthMonitor Real Read-Only Integration Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds an
> **RPCHealthMonitor** to `@soltrade/rpc-provider-contract` that **consumes the F17 read-only spike RESULT only**
> and derives a **health state** — `UNCONFIGURED` / `DEGRADED` / `READ_ONLY_HEALTHY` / `READ_ONLY_STALE`.
> **Health is NEVER trading readiness, routing, send, broadcast, or signing** — every trading/exec flag is fixed
> `false` on **every** result. Provider failure / unavailable out-of-repo caller → **DEGRADED or UNCONFIGURED
> (fail-closed), never ready-to-trade**. The monitor is a **pure function**: no network call, no endpoint
> resolution, no SDK/dependency, no in-repo network primitive, no system clock (staleness is an explicit
> deterministic parameter), no endpoint/secret echo. **No mainnet, no REAL-LIVE.** `can_send:false` repo-wide
> unchanged.
>
> **State:** built on `main` @ `d177a05` (branch `pr-e2-f18-rpc-health-monitor-read-only-integration`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard
> `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 850/850.

---

## 1. Current state
`rpc-provider-contract` holds the fail-closed provider contract + F9–F12 layers + F13–F16 spike/approval/supply-chain/
binding layers + F17 Live Testnet RPC Read-Only Spike (injection-based). This milestone adds the **RPCHealthMonitor**
that turns an F17 spike result into a health state — **additive**; existing exports unchanged; `send-gate-contract`
unaffected (85/85).

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeRpcHealthMonitorContract()` → frozen descriptor (supported health states, all trading/exec flags false, `health_is_not_trading_readiness:true`).
- `validateRpcHealthSpikeResult(spikeResult)` — recognizes the F17 spike-result shape + screens for forbidden indicators.
- `evaluateRpcHealthFromSpike(spikeResult, staleness)` — the monitor core; derives the health state.
Constants `RPC_HEALTH_STATES` (4) + `HEALTH_FORBIDDEN_TRUE_FLAGS` (10) + `HEALTH_READ_ONLY_METHODS`
(`getVersion`/`getHealth`) + `HEALTH_TESTNET_ENVS` (`devnet`/`testnet`/`localnet`) + module-internal helpers
`f18HealthInvariantFlags` (the single fixed-false flag builder shared by every result) and `f18IsStale`
(deterministic, no clock). **No import; no network primitive; no system clock; no dependency.**

## 3. Health-state mapping (fail-closed)
| Input | Health state | Reason |
|---|---|---|
| no / non-object / hostile spike result | `UNCONFIGURED` | `no_spike_result` / `input_inspection_error` |
| `spike_authorized !== true` (bad records / mainnet / non-read-only at spike time) | `UNCONFIGURED` | `spike_not_authorized` |
| authorized but caller unavailable (`spike_attempted:false`) | `DEGRADED` | `caller_unavailable` |
| authorized + attempted but `read_only_health_ok !== true` (caller error/unhealthy) | `DEGRADED` | `read_only_health_check_failed` |
| `read_only_health_ok:true`, not stale | `READ_ONLY_HEALTHY` | — |
| `read_only_health_ok:true`, stale (`age_ms > max_age_ms` / `is_stale`) | `READ_ONLY_STALE` | `read_only_result_stale` |
| smuggled trading/exec flag true, non-testnet env, or non-read-only method on the result | `UNCONFIGURED` | `forbidden_trading_indicator_blocked` / `mainnet_or_nontestnet_environment_blocked` / `non_read_only_method_blocked` |

`read_only_healthy` is `true` **only** for `READ_ONLY_HEALTHY` (false for STALE/DEGRADED/UNCONFIGURED).

## 4. Health-is-not-trading-readiness proof
Every result of describe/validate/evaluate carries the fixed-false invariant flags from the single
`f18HealthInvariantFlags()` builder: `trading_ready`, `routing_ready`, `can_send`, `can_broadcast`,
`can_serialize`, `broadcast_permitted`, `signing_permitted`, `has_rpc`, `is_live`, `real_live`,
`network_call_made`, `configured`, `ready`, `endpoint_echoed` — **all false**. There is **no code path** that sets
any of them true; `grep` for any such flag `: true` in the F-18 region returns 0. A read-only health spike — even
`READ_ONLY_HEALTHY` — is **not** trading readiness, routing, or send.

## 5. Provider-failure fail-closed proof
A provider/caller failure (caller unavailable, caller throws, unhealthy result) maps to **`DEGRADED`**, and an
unauthorized/unrecognized/forbidden input maps to **`UNCONFIGURED`** — **never** to a ready-to-trade outcome. No
failure path yields any trading/exec capability.

## 6. No-network / no-clock / no-echo proof
The monitor is a pure consumer: **no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/
`readFileSync`** and **no system-clock call** (no current-time read, no `Date` construction) anywhere in src.
Staleness is derived only from the explicit `staleness` parameter (`is_stale` / `age_ms` / `max_age_ms`). Results
are built from fixed literals + the derived health-state enum + fixed reason tokens — **no input value is ever
echoed**: a result carrying `leaked_endpoint:'https://…'`/`leaked_key:'…'` yields a result whose serialization
contains **neither** marker (`endpoint_echoed:false`).

## 7. Fail-closed behavior
All results frozen/fixed-literal; smuggled trading/exec indicators, non-testnet env, non-read-only method →
`UNCONFIGURED`; hostile/throwing input (Proxy) → frozen `UNCONFIGURED` with `input_inspection_error`, **never
throws**.

## 8. Send-gate continuity summary
`send-gate-contract` untouched — 85/85 green; the monitor adds no send/RPC/routing path.

## 9. No-live-trading / no-SDK / no-secret confirmation
Module remains **import-free**; no network primitive; no SDK/dependency; no endpoint resolution; no
send/broadcast/serialize/signing; no KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE; health
state never exposes `has_rpc`/`can_send` as trading readiness.

## 10. Tests summary
~32 new monitor proofs (M1–M32 + static guards) appended to `rpc-provider-contract.test.mjs`, building **real**
F17 spike results (via `evaluateLiveTestnetRpcReadOnlySpike` with canonical F14/F15/F16 records + in-memory fake
callers; no real network). **rpc-provider-contract suite 255/255 (was 251); send-gate-contract 85/85 (unchanged);
full suite 850/850.** Independent main-loop behavioral spot-check: 25/25 PASS.

## 11. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive; no network primitive; tokens are string values).

## 12. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; a `READ_ONLY_HEALTHY` health state is **not** trading readiness; **`can_send:false`
repo-wide unchanged**.

## 13. Remaining blockers / next approvals (each a separate, explicit decision)
- Consuming the health state in higher layers (routing/entry gating) — **not started**; the monitor only reports a
  read-only health state and grants no readiness.
- Testnet broadcast; send implementation; transaction build/serialization; `signer_control` + two-person; KMS SDK /
  real provider adapter; mainnet / REAL-LIVE — each a separate, explicitly-approved PR.

---

**Confirmations:** Implementation-first milestone · RPCHealthMonitor consumes the F17 read-only spike result only ·
Derives a read-only health state (UNCONFIGURED / DEGRADED / READ_ONLY_HEALTHY / READ_ONLY_STALE) · Health is NOT
trading readiness / routing / send / broadcast / signing (all trading/exec flags fixed false on every result) ·
Provider failure → DEGRADED/UNCONFIGURED fail-closed, never ready-to-trade · No network call · No in-repo network
primitive · No system clock (deterministic staleness param) · No endpoint resolution · No SDK import · No
dependency · No endpoint URL/raw endpoint/API key/secret in repo · No endpoint/secret echoed · No send/broadcast/
serialization/signing · No KMS/Vault/KeyManager · No private key material · No mainnet · No REAL-LIVE · No
has_rpc/health as trading readiness · No new execution authority · No new SSOT name · ALLOWLIST unchanged.
