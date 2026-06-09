# E2 Stage-3 / PR-S3-B — Gate-A Readiness Aggregator + Status/Dashboard Shell Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends two
> read-only Gate-A foundations to `@soltrade/gate-a-foundations`: the **Readiness Aggregator** (Part E) — which
> consumes the Stage-2 RPCHealthMonitor + ProtocolConstantMonitor results and the Gate-A config + audit results and
> derives a Gate-A operational state — and the **Status / Dashboard Shell** (Part F) — a read-only, status-only
> shell with **no execution commands**. Neither opens trading readiness; **even `GATE_A_READY_READ_ONLY` keeps
> every trading/exec flag false**. Pure, import-free, function-I/O-only; no network/clock/dependency/endpoint/secret.
> `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `2f7ef6b` (branch `pr-s3-b-gate-a-readiness-aggregator-status-shell`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/
> src/']` · mechanism guard `sources=85 fixtures=27 allowlist=1 violations=0` · full suite **912/912**.

---

## 1. Readiness Aggregator (Part E)
- `describeGateAReadinessAggregatorContract()` · `evaluateGateAReadiness(inputs)`.
- Consumes four read-only result objects: `rpc_health` (Stage-2 RPCHealthMonitor), `protocol_constants` (Stage-2
  ProtocolConstantMonitor), `config_readiness` (Gate-A config), `audit_path` (Gate-A audit).
- States: `GATE_A_UNCONFIGURED` / `GATE_A_DEGRADED` / `GATE_A_READY_READ_ONLY` / `GATE_A_BLOCKED`.
- Fail-closed mapping (precedence): hostile/throwing → `GATE_A_UNCONFIGURED`; a smuggled forbidden trading/exec
  flag on the top-level inputs **or any of the four component results** → `GATE_A_BLOCKED`; `CONFIG_INVALID` /
  `AUDIT_INVALID` → `GATE_A_BLOCKED`; any component missing/unrecognized or in its `*UNCONFIGURED` state →
  `GATE_A_UNCONFIGURED`; any component degraded/stale/mismatch → `GATE_A_DEGRADED`; **only** all four at their
  fully-valid read-only state (`READ_ONLY_HEALTHY` + `READ_ONLY_CONSTANTS_OK` + `CONFIG_VALID_READ_ONLY` +
  `AUDIT_PATH_VALID`) → `GATE_A_READY_READ_ONLY`. `gate_a_ready_read_only:true` **only** for that state.

## 2. Status / Dashboard Shell (Part F)
- `describeGateAStatusShellContract()` · `evaluateGateAStatusShell(gateAReadinessResult)`.
- Maps the readiness state → a display status: `GATE_A_READY_READ_ONLY`→`read_only_ready`,
  `GATE_A_DEGRADED`→`degraded`, `GATE_A_BLOCKED`→`blocked`, else `unconfigured`.
- Result keys are confined to safe status fields: `stage:'gate_a'`, `status`, `can_trade:false`, `can_send:false`,
  `can_broadcast:false`, `requires_next_stage:'data_ingestion'`, `read_only:true`, `status_only:true`,
  `has_execution_commands:false` (+ the invariant flags). **No execution command** (`buy`/`sell`/`execute`/
  `submit`/`send`/`broadcast`/`swap`/`copy_now`/`trade_now`) and **no function-valued key** — proven absent.

## 3. Readiness / status ≠ trading readiness
Every aggregator and shell result spreads the shared invariant-flags object with **all** of `trading_ready`,
`routing_ready`, `can_send`, `can_broadcast`, `can_serialize`, `signing_permitted`, `broadcast_permitted`,
`is_live`, `real_live`, `mainnet_enabled`, `has_rpc` fixed `false` — on **every** state including
`GATE_A_READY_READ_ONLY` / `read_only_ready`. No code path sets any true.

## 4. Hardening applied during build (transparent)
The build workflow's security lens raised a non-blocking defense-in-depth note: `GATE_A_FORBIDDEN_TRUE_FLAGS`
omitted `routing_ready`, so a smuggled `routing_ready:true` input would not itself force `GATE_A_BLOCKED` (though
the output always fixes it false). Per the "fail-closed not fail-open" governing rule I **added `routing_ready`**
to the forbidden-true-flags list. Now a smuggled `routing_ready:true` on the top-level inputs or inside any
component → `GATE_A_BLOCKED` (and `CONFIG_INVALID`/`AUDIT_INVALID` for config/audit), completing the screen. The
60 existing tests still pass (none relied on a true `routing_ready` passing); re-verified.

## 5. Real Stage-2 consumption (no network)
The aggregator src is **import-free** and consumes passed-in result objects; the **tests** import the real Stage-2
producers (`evaluateRpcHealthFromSpike`, `evaluateProtocolConstantHealth`, `evaluateLiveTestnetRpcReadOnlySpike`)
from `rpc-provider-contract` via a relative path and drive the F17 spike with an **in-memory fake caller** — so
the aggregator is proven against **real** RPCHealthMonitor/ProtocolConstantMonitor results with **zero network
egress**.

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/invalid/forbidden/hostile input → fail-closed; no input value echoed
(results are fixed literals + state + fixed reason tokens — a leaked endpoint field on the input does not appear in
the output); hostile/throwing input → frozen `GATE_A_UNCONFIGURED` / `unconfigured` shell, **never throws**.

## 7. Tests summary
Appended to `test/gate-a-foundations.test.mjs`: setup (real Stage-2 inputs) + E1–E14 aggregator proofs + F1–F12
shell proofs + S5–S7 static guards. **gate-a-foundations suite 60/60 (30 prior + 30 new); send-gate-contract
85/85 (continuity); full suite 912/912.** Independent main-loop behavioral spot-check (incl. the `routing_ready`
hardening): 13/13 PASS.

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=85 fixtures=27 allowlist=1 violations=0` — **`sources` stays
85** (PR-S3-B appends to existing files; adds no new src file). SSOT drift **unchanged at baseline**.

## 9. No-live / no-SDK / no-secret / no-execution-command confirmation
Module import-free; no network primitive / system clock; no SDK/dependency; no endpoint URL/secret in src/README;
no send/broadcast/serialize/signing; no KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE;
the status shell exposes **no execution command**; readiness/status are **not** trading readiness.

## 10. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; `GATE_A_READY_READ_ONLY` is **not** trading readiness; `can_send:false` repo-wide
unchanged.

---

**Confirmations:** Gate-A readiness aggregator (read-only, consumes Stage-2 + Gate-A config/audit, fail-closed) ·
Gate-A status/dashboard shell (read-only, status-only, NO execution commands) · Readiness/status are NOT trading
readiness (all trading/exec flags fixed false, incl. GATE_A_READY_READ_ONLY) · `routing_ready` hardening added ·
No network primitive · No system clock · No dependency · No endpoint/secret in repo · No secret echoed · No
send/broadcast/serialize/signing · No KMS/Vault/KeyManager · No private key material · No mainnet · No REAL-LIVE ·
No buy/sell/execute/submit/send/broadcast/swap/copy_now/trade_now · No new SSOT name · ALLOWLIST unchanged ·
`can_send:false` unchanged · send-gate-contract green.
