# E2-F-19 — ProtocolConstantMonitor Read-Only Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a
> **ProtocolConstantMonitor** to `@soltrade/rpc-provider-contract` that **read-only evaluates** a protocol-constants
> observation RESULT against an EXPECTED baseline and derives a **state** — `UNCONFIGURED` / `DEGRADED` /
> `READ_ONLY_CONSTANTS_OK` / `READ_ONLY_CONSTANTS_STALE` / `READ_ONLY_CONSTANTS_MISMATCH`. **Protocol constants are
> NEVER trading readiness, routing, send, broadcast, or signing** — every trading/exec flag is fixed `false` on
> every result. Observation failure → **DEGRADED or UNCONFIGURED (fail-closed), never ready-to-trade**. Pure
> function: no network call, no in-repo network primitive, no system clock (staleness is an explicit deterministic
> parameter), no endpoint resolution, no SDK/dependency, no endpoint/secret echo (mismatch reported as a count
> only). **No mainnet, no REAL-LIVE.** `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `dcf8550` (branch `pr-e2-f19-protocol-constant-monitor-read-only`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard
> `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 852/852.

---

## 1. Current state
`rpc-provider-contract` holds the fail-closed provider contract + F9–F12 layers + F13–F16 spike/approval/supply-chain/
binding layers + F17 Live Testnet RPC Read-Only Spike + F18 RPCHealthMonitor. This milestone adds the
**ProtocolConstantMonitor** — **additive**; existing exports unchanged; `send-gate-contract` unaffected (85/85).
It mirrors the F18 read-only health-monitor pattern.

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeProtocolConstantMonitorContract()` → frozen descriptor (supported states, all trading/exec flags false, `constants_are_not_trading_readiness:true`).
- `validateProtocolConstantsResult(constantsResult)` — recognizes the observation-result shape + screens forbidden indicators.
- `evaluateProtocolConstantHealth(constantsResult, expected, staleness)` — derives the state.
Constants `PROTOCOL_CONSTANT_STATES` (5) + `PC_FORBIDDEN_TRUE_FLAGS` (10) + `PC_TESTNET_ENVS` + module-internal
helpers `pcInvariantFlags` (single fixed-false flag builder), `pcIsStale` (deterministic, no clock), and
`pcMismatchCount` (counts mismatched expected keys only — never captures/echoes values). **No import; no network
primitive; no system clock; no dependency.**

## 3. State mapping (fail-closed)
| Input | State | Reason |
|---|---|---|
| no / non-object / hostile result | `UNCONFIGURED` | `no_constants_result` / `input_inspection_error` |
| smuggled trading/exec flag true, or non-testnet env | `UNCONFIGURED` | `forbidden_trading_indicator_blocked` / `mainnet_or_nontestnet_environment_blocked` |
| observation unavailable (`observed` missing / `observed_ok !== true`) | `DEGRADED` | `constants_not_observed` |
| `observed != expected` | `READ_ONLY_CONSTANTS_MISMATCH` | `protocol_constants_mismatch` (mismatch_count) |
| matched + stale (`age_ms > max_age_ms` / `is_stale`) | `READ_ONLY_CONSTANTS_STALE` | `protocol_constants_stale` |
| matched + fresh | `READ_ONLY_CONSTANTS_OK` | — |

Mismatch takes precedence over staleness. `read_only_constants_ok` is `true` **only** for `READ_ONLY_CONSTANTS_OK`.

## 4. Constants-are-not-trading-readiness proof
Every result of describe/validate/evaluate carries the fixed-false invariant flags from `pcInvariantFlags()`:
`trading_ready`, `routing_ready`, `can_send`, `can_broadcast`, `can_serialize`, `broadcast_permitted`,
`signing_permitted`, `has_rpc`, `is_live`, `real_live`, `network_call_made`, `configured`, `ready`,
`endpoint_echoed` — **all false** on every state. No code path sets any true; the `.d.ts` pins each to the literal
type `false`. A `READ_ONLY_CONSTANTS_OK` state is **not** trading readiness, routing, or send.

## 5. Provider/observation-failure fail-closed proof
Observation unavailable → **`DEGRADED`**; unrecognized/forbidden/hostile input → **`UNCONFIGURED`** — never a
ready-to-trade outcome. No failure path yields any trading/exec capability.

## 6. No-network / no-clock / no-echo proof
No `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync` and no system-clock
call (no current-time read, no `Date` construction) anywhere in the F-19 src. Staleness is derived only from the
explicit `staleness` parameter. Results are built from fixed literals + the derived state enum + a numeric
`mismatch_count` + fixed reason tokens — **no observed value / endpoint / secret is ever echoed**: a result whose
input carries `leaked_endpoint:'https://…'`/`leaked_key:'…'` (and a sneaky observed value) yields a serialization
containing **none** of those markers. Mismatch is reported as a **count only** (no values/names).

## 7. Fail-closed behavior
All results frozen/fixed-literal; smuggled trading/exec indicators or non-testnet env → `UNCONFIGURED`; hostile/
throwing input (Proxy) → frozen `UNCONFIGURED` with `input_inspection_error`, **never throws**.

## 8. Send-gate continuity summary
`send-gate-contract` untouched — 85/85 green; the monitor adds no send/RPC/routing path.

## 9. No-live-trading / no-SDK / no-secret confirmation
Module remains **import-free**; no network primitive; no SDK/dependency; no endpoint resolution; no
send/broadcast/serialize/signing; no KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE;
constants state never exposes `has_rpc`/`can_send` as trading readiness.

## 10. Tests summary
~34 new monitor proofs (P1–P34 + static guard) appended to `rpc-provider-contract.test.mjs`.
**rpc-provider-contract suite 257/257 (was 255); send-gate-contract 85/85 (unchanged); full suite 852/852.**
Independent main-loop behavioral spot-check: 26/26 PASS.

## 11. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive; no network primitive; tokens are string values).

## 12. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; a `READ_ONLY_CONSTANTS_OK` state is **not** trading readiness; **`can_send:false`
repo-wide unchanged**.

## 13. Remaining blockers / next approvals (each a separate, explicit decision)
- Consuming the constants state in higher layers (entry gating / KILLED-on-`changed` enforcement) — **not
  started**; the monitor only reports a read-only constants state and grants no readiness.
- Stage 3+ (data ingestion, signal engine, risk engine, routing, paper execution, signing, broadcast, mainnet,
  REAL-LIVE) — each a separate, explicitly-approved decision.

---

**Confirmations:** Implementation-first milestone · ProtocolConstantMonitor consumes a protocol-constants
observation result only · Derives a read-only state (UNCONFIGURED / DEGRADED / READ_ONLY_CONSTANTS_OK /
READ_ONLY_CONSTANTS_STALE / READ_ONLY_CONSTANTS_MISMATCH) · Constants are NOT trading readiness / routing / send /
broadcast / signing (all trading/exec flags fixed false on every result) · Observation failure → DEGRADED/
UNCONFIGURED fail-closed · No network call · No in-repo network primitive · No system clock (deterministic
staleness param) · No endpoint resolution · No SDK import · No dependency · No endpoint/secret in repo · No
observed-value/endpoint/secret echoed (mismatch as count only) · No send/broadcast/serialization/signing · No
KMS/Vault/KeyManager · No private key material · No mainnet · No REAL-LIVE · No constants/has_rpc as trading
readiness · No new execution authority · No new SSOT name · ALLOWLIST unchanged.
