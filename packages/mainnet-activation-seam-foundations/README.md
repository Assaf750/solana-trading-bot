# @soltrade/mainnet-activation-seam-foundations

Read-only / advisory ONLY **MAINNET REAL-LIVE ACTIVATION SEAM** foundation for
**Stage-23 — the FINAL build stage**. This package is the mainnet analogue of the
Stage-17 live-stream seam and the Stage-21 testnet-send seam: it builds everything
**UP TO** the real-money activation switch and **NOTHING past it**. It describes
what real mainnet REAL-LIVE activation *would* require and **CANNOT self-activate
under ANY input**. Real-money activation is the **OWNER's physical, out-of-repo
decision** — this package can NEVER flip `can_send`, broadcast, sign, send, or
activate REAL-LIVE.

## The core rule (never-ready by construction)

- `activation_performed:false` AND `real_live_activated:false` AND `can_send:false`
  are **FIXED LITERALS on every state** of every foundation.
- `MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION` is **HARDCODED `met:false`**,
  so `seam_ready` can **NEVER** be `true` in-package — even with every other
  requirement satisfied and even under **forged truthy inputs**. A real mainnet send
  adapter is a **SEPARATE owner-gated / reviewed / allowlisted** decision, NOT this.
- The mechanism-guard `ALLOWLIST` stays **EXACTLY** `['packages/isolated-signer-runtime/src/']`.
  This package adds **no second entry**, imports nothing external, and is fully
  scanned by the guard.

## Safety invariants

- **No live primitive.** No `fetch` / `WebSocket` / `Connection` / `sendTransaction`
  / `.serialize()` / socket / grpc; no Solana / Jupiter / Helius / Jito / db import;
  no signing / crypto primitive; no clock / RNG / env / filesystem. Import-free
  implementation (relative-internal only at the package edge).
- **Hard-Risk preserved, never re-implemented.** The seam **consumes** a real-live
  readiness verdict (by shape: `ready===true` with zero blockers required) plus a
  Hard-Risk completeness signal, and treats *not-ready / incomplete-Hard-Risk /
  missing* as **fail-safe** (the seam stays not-ready). **No implicit infinity**:
  `capital_limit` must be a finite number `> 0`, else the requirement is `met:false`.
- **Secrets by reference only.** A mainnet RPC endpoint is an opaque
  `endpoint_ref` (shape-checked); raw key / endpoint / url / seed are refused and
  **never echoed** (NAME-only redaction). No real key / wallet / funds in repo
  (`endpoint_in_repo:false` / `key_in_repo:false` / `funds_in_repo:false`).
- **Frozen, never-throws.** Every result is `Object.freeze`-d and carries a
  `SafeFlags()` spread (`read_only:true` + 24 exec/readiness flags `false`).
  Hostile / throwing / uninspectable input returns a frozen refusal. TOCTOU defense:
  input is snapshotted **once** (single shallow spread) and all screening +
  classification walk the same snapshot.
- **No new SSOT name.** Every identifier is a LOCAL `MAINNET_*` / `mainnet_*`
  function-I/O contract identifier. SSOT Group 1 `operating_state` values
  (`WARMING_UP` / `ACTIVE` / `EXITS_ONLY` / `PAUSED` / `KILLED`) are consumed-only
  by VALUE. No `candidate_*` name is declared.

## Foundations

| Fn | What it is |
|----|------------|
| **(A)** `evaluateMainnetActivationSeam` | The CORE never-ready seam descriptor. States `MAINNET_SEAM_UNCONFIGURED` / `_INVALID` / `_DESCRIPTOR`. `seam_requirements` includes the seven `MAINNET_REQ_*` tokens; the adapter-allowlist one is hardcoded `met:false`. Opens nothing. |
| **(B)** `evaluateGlobalKillSwitch` | Pure read-model over `{ kill_engaged, reason? }`. States `MAINNET_KILL_ENGAGED` / `_NOT_ENGAGED`. Default / missing / unknown -> fail-safe **ENGAGED**. |
| **(C)** `evaluateEmergencyExit` | Pure read-model describing the EXITS_ONLY-shaped `exit_only_advisory` posture from `operating_state` / kill signals. Never trades. |
| **(D)** `evaluateMainnetActivationSuppression` | ALWAYS `suppressed:true`, carrying `not_activate_authorized` + `not_send_authorized` + `not_execution_authorized` on every path. |
| **(E)** `evaluateMainnetForbiddenSurface` | NAME-only redacting guard (key material + live/endpoint + api_key/bearer/token + raw mainnet). `isValidMainnetEndpointRef(ref)` shape-checks an opaque ref. |
| **(F)** `evaluateMainnetActivationHealth` | Aggregates A–E + the kill switch + the real-live-readiness verdict + send-gate refusal. There is **no ready/activated state** — the best attainable state is `MAINNET_ACTIVATION_HEALTH_SUPPRESSED`. |

Each foundation also has a `describe*Contract()` returning a frozen descriptor.

## Run

```
node --test packages/mainnet-activation-seam-foundations/test/*.test.mjs
node --test                              # full suite (green)
node tools/check-ssot-drift.mjs          # SSOT drift (EXACT)
node tools/check-mechanism-guards.mjs    # allowlist=1 (isolated-signer only), violations=0
```
