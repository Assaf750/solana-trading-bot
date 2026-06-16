# Legacy Audit & Live-First Cleanup Plan (ADR-0001 Phase 9A)

**Binding rule:** Open-by-design. Ready when configured. No artificial locks. No activation gates. No
hard stops. Readiness is **monitoring only, not enforcement** (see `memory/open-by-design-runtime` and
Phase 8A-R). This document inventories legacy / wrapper / duplicate paths left after the Live-First
phases and classifies what may be pruned **later** — it executes only small, behavior-neutral cleanups
now.

> Status of this pass (9A): inventory + classification + small safe cleanups (doc wording + regression
> guards) only. **No component removed, no behavior changed.** Defaults are unchanged.
>
> **FINAL STATUS — hard legacy purge (Phase 3B-X) complete:** every legacy `legacy|package` rollback shim
> has now been REMOVED (RISK in 3B.2, PROVIDER in 3B.4, POSITIONS + DECISION_LEDGER in 3B-X). There are no
> legacy backend flags left; the `@soltrade/*` package paths are canonical and only. §2–§9 below are the
> historical phase log; **§10 is the authoritative final record.** A regression guard
> (`apps/server/test/no-legacy-flags-guard.test.mjs`) keeps the legacy flags from ever returning as live flags.

---

## 1. Classification summary

| Bucket | Meaning | Items |
|---|---|---|
| **Keep (not legacy)** | Active, correct, no action | JSON stores (default SoT), paper-engine/paper-portfolio (simulation substrate), kill-switch / hard-risk / signer-session (operator safety controls — NOT activation locks), Postgres/Redis/ClickHouse backends |
| **~~Keep as compatibility shim~~ → ALL REMOVED (§10)** | ~~Legacy path retained behind a flag~~ — every legacy backend shim has been deleted | none remaining: RISK removed 3B.2 §7, PROVIDER removed 3B.4 §9, POSITIONS + DECISION_LEDGER removed in the hard legacy purge §10 |
| **Needs migration later** | Larger move, own phase + tests required | Paper → Diagnostic Adapter (full), legacy pruning after a soak (Phase 3B), Rust signing/exec boundary |
| **Do not touch yet** | Out of scope / risky now | execution pipeline, risk/provider logic, activation command, JSON fallback removal |

---

## 2. Component inventory

| Component | Current role | New owner | Still used by | Removal risk | Recommended action |
|---|---|---|---|---|---|
| `engine/jupiter-client.mjs` `legacyCreateJupiterClient` | in-process Jupiter client | `@soltrade/provider-adapters` (quote-provider) | `PROVIDER_BACKEND=legacy` only (default=package) | Low (default off) | deprecate later (3B) after soak |
| `engine/rpc-client.mjs` `legacyCreateRpcClient` | in-process RPC client | `@soltrade/provider-adapters` (rpc) | `PROVIDER_BACKEND=legacy` only | Low | deprecate later (3B) |
| `engine/provider-health.mjs` `legacyCreateProviderHealth` | in-process health monitor | `@soltrade/provider-adapters` (health) | `PROVIDER_BACKEND=legacy` only | Low | deprecate later (3B) |
| `engine/helius-das.mjs` `legacyCreateDas` | DAS metadata fallback | `@soltrade/provider-adapters` (metadata-provider) | `PROVIDER_BACKEND=legacy` only | Low | deprecate later (3B) |
| `engine/jito-tip-tx.mjs` `legacy*` | tip tx builder + tip select | `@soltrade/provider-adapters` (bundle-provider) | `PROVIDER_BACKEND=legacy` only | Low | deprecate later (3B) |
| `index.mjs` `legacyJitoSendBundle` / `legacyGetJitoTipFloor` | bundle send + tip floor | `@soltrade/provider-adapters` (jito) | `PROVIDER_BACKEND=legacy` only | Low | deprecate later (3B) |
| `engine/live-executor.mjs` `legacyLedger` | in-process decision-ledger | `@soltrade/decision-ledger` + `@soltrade/storage` | `DECISION_LEDGER_BACKEND=legacy` only (default=package) | Low | deprecate later (3B) |
| `engine/paper-portfolio.mjs` legacy store | in-process positions store | `@soltrade/positions` + `@soltrade/storage` | `POSITIONS_BACKEND=legacy` only (default=package) | Low | deprecate later (3B) |
| `engine/risk-gates.mjs` `legacyCheckEntryGates` | in-process entry gate | `@soltrade/risk` | `RISK_BACKEND=legacy` only (default=package) | Low | deprecate later (3B) |
| `engine/paper-engine.mjs` + `paper-portfolio.mjs` | simulation engine + book | (target) `@soltrade/execution` Diagnostic Adapter | server (paper book, history, analytics) | **High** | keep; migrate in a later Paper→Diagnostic phase; never a "readiness" tool |
| JSON stores (`util.mjs` readJson/writeJson) | default operational store (vault/config/ledger/positions/audit) | `STORAGE_BACKEND=postgres` (optional) | server by default (`STORAGE_BACKEND=json`) | **High** | KEEP — default SoT; do not remove the JSON fallback |
| `DIAGNOSTIC_BACKEND=legacy` (default) | "no diagnostic adapter wired" (not a duplicate impl) | `@soltrade/execution` when `=package` | server default | None | keep; consider flipping default to `package` in a later phase |
| Hot-state / event-sink backends | optional Redis cache / ClickHouse analytics | `@soltrade/hot-state`, `@soltrade/storage` event-writer | server when enabled (defaults: memory / none) | None | keep; never SoT |

> **Update (3B-X, final):** every legacy row in the table above has now been REMOVED — the six
> `PROVIDER_BACKEND` rows in 3B.4 (§9), `risk-gates.mjs legacyCheckEntryGates` in 3B.2 (§7), and the
> `live-executor.mjs legacyLedger` + `paper-portfolio.mjs` legacy book in the hard legacy purge (§10).
> The table is the original 9A inventory; **no legacy backend shim remains.**

### Env flags (live operational backends only — no legacy rollback flags remain)
`STORAGE_BACKEND` (json|postgres) · `HOT_STATE_BACKEND` (memory|redis) · `EVENT_SINK_BACKEND` (none|clickhouse) ·
`DIAGNOSTIC_BACKEND` (legacy|package, opt-in adapter — a real operational toggle, not a legacy rollback) ·
`SOLTRADE_PORT` · `SOLTRADE_DATA_DIR` · `RUN_POSTGRES_SMOKE` / `RUN_REDIS_SMOKE` / `RUN_CLICKHOUSE_SMOKE`.
The legacy backend flags `RISK_BACKEND` / `PROVIDER_BACKEND` / `POSITIONS_BACKEND` / `DECISION_LEDGER_BACKEND`
are all removed (guarded by `apps/server/test/no-legacy-flags-guard.test.mjs`).

---

## 3. Small safe cleanups executed in 9A (wording + guards only)

- **Docs/UI wording → open-by-design** (no behavior change):
  - `docs/ADR-0001-*.md`: added a Phase-8A-R correction note; reworded the "activation gate that never
    opens / `can_send=false` locks everything / structural lock" framing into open-by-design capability
    language; clarified that kill-switch / risk / session bounds are **operator controls**, not
    activation locks.
  - `docs/RESTRUCTURE_PLAN.md`: "owner-only" → "owner-managed".
  - `apps/operator-ui/src/pages/HelpGlossary.jsx`: reworded the "how do I go to real trading?" answer —
    removed "owner-only" + "never activates until every condition is met"; now "becomes available once
    configured; you decide when to start."
- **Regression guards added** (`apps/server/test/open-by-design-guard.test.mjs`): fail the build if the
  banned lock/gate/hard-stop vocabulary returns to the runtime-readiness API response or the Diagnostics
  UI source, or if Paper is reframed as a readiness/execution-test tool.

## 4. Do NOT touch yet (explicitly out of scope)

paper-engine removal · JSON fallback removal · legacy route removal · removing used wrappers · any change
to execution / risk / provider logic or the activation command. Unused-export pruning is deferred: it
needs a dead-code proof per export and is not attempted in 9A/9B.

## 5. Phase 9B — safe shim cleanup executed (no removal, no behavior/default change)

| Item | Action | Status | Safety proof |
|---|---|---|---|
| Default-backend invariants | Added `apps/server/test/backend-defaults.test.mjs` | **guarded** | PROVIDER / DECISION_LEDGER / POSITIONS / RISK select `legacy` only on the literal `'legacy'` (default = package); STORAGE/HOT_STATE/EVENT_SINK default json/memory/none; DIAGNOSTIC opt-in. Read-only source-pattern + pure-config test. |
| `risk-gates.mjs` / `live-executor.mjs` legacy dispatch | Added a deprecation-timeline comment (prune in 3B after soak) | **deprecated-commented** | comment-only; the `RISK_BACKEND` / `DECISION_LEDGER_BACKEND` dispatch is unchanged (still default=package). |

All compatibility shims are **KEPT** (rollback insurance) and remain default-off; nothing was removed.
Defaults are now locked by a regression test so they cannot silently flip. Actual shim removal stays in
Phase 3B (after a production soak).

## 6. Phase 3B.1 — legacy-shim behavior guarded before pruning (no removal)

Added `apps/server/test/legacy-shim-guard.test.mjs` — **behavioral** coverage of the legacy shims so a
future removal (3B.2) is safe. Still **no deletion, no behavior/default change**.

| Flag | What was checked (behaviorally) | Status |
|---|---|---|
| `RISK_BACKEND` | `checkEntryGates`: legacy output is **byte-identical** to package (allow + reject paths); default + unknown resolve to package | **parity-guarded** |
| `PROVIDER_BACKEND` | `createProviderHealth` builds a working monitor (record→snapshot) under legacy / default / unknown | **behavior-guarded** |
| `POSITIONS_BACKEND` | `createPaperPortfolio` book accepts an entry (recordEntry → openCount) under legacy / default / unknown | **behavior-guarded** |
| `DECISION_LEDGER_BACKEND` | dispatch source-guarded (`=== 'legacy' ? legacyLedger : packageLedger`); heavy to instantiate, so behavior left to its existing live-executor tests | **source-guarded** |

What was checked: each shim runs under `=legacy`, the package backend is the default, and an unknown
value never falls back to legacy. What was NOT removed: nothing — paper-engine, JSON fallback, routes,
and all four shims remain. What is now protected: RISK legacy↔package parity + PROVIDER/POSITIONS
instantiation across flag values (in addition to the Phase-9B default-pattern guards).

**Recommended 3B.2 targets** (only after a soak, each behind its own small PR): once RISK parity has
held, remove `legacyCheckEntryGates` + the `RISK_BACKEND` dispatch (delegate straight to `@soltrade/risk`);
then the PROVIDER family (`legacyCreate*` in jupiter-client / rpc-client / provider-health / helius-das /
jito-tip-tx) once provider parity is added; `POSITIONS_BACKEND` legacy book; `DECISION_LEDGER_BACKEND`
`legacyLedger` last (most sensitive). Keep JSON fallback + paper-engine.

## 7. Phase 3B.2 — legacy shim prune batch 1 (RISK_BACKEND removed)

**Removed:** the `RISK_BACKEND` legacy shim. `apps/server/src/engine/risk-gates.mjs` no longer carries
`legacyCheckEntryGates` or the `process.env.RISK_BACKEND` dispatch — it now re-exports `checkEntryGates`
straight from `@soltrade/risk`. Safe because Phase 3B.1 proved the legacy output was byte-identical to the
package on both the allow and reject paths, and the only caller (`paper-engine.mjs`) already ran the
package path by default. No behavior change (parity), no default change, no API/UI change.

Updated with it: `live-first-runtime-flags.md` (RISK_BACKEND moved to a "Removed flags" note);
`backend-defaults.test.mjs` (RISK dropped from the dispatch-pattern check + a removal guard added);
`legacy-shim-guard.test.mjs` (RISK section now asserts the env var is inert); `docs-consistency.test.mjs`
(RISK dropped from the canonical-flag list). `.env.example` never referenced `RISK_BACKEND`.

**PROVIDER_BACKEND — deferred to 3B.3 (NOT removed).** It is wider + higher-risk: the dispatch spans
five engine files (`jupiter-client`, `rpc-client`, `provider-health`, `helius-das`, `jito-tip-tx`) plus
the in-process `legacyJitoSendBundle` / `legacyGetJitoTipFloor` in `index.mjs`, and only
`provider-health` has a behavioral parity guard so far. Removing it needs provider-by-provider parity
coverage first. Remaining shims after 3B.2: `PROVIDER_BACKEND`, `DECISION_LEDGER_BACKEND`,
`POSITIONS_BACKEND` (all kept, default-off, behind their flags).

## 8. Phase 3B.3 — provider shim parity proven; removal DEFERRED to 3B.4 (NOT removed)

Added `apps/server/test/provider-shim-parity.test.mjs` — **behavioral legacy↔package parity** for the
cleanly-testable PROVIDER_BACKEND dispatch points (no real network: pure helpers, injected clock, shared
global-`fetch` mock, injected stub rpc). **Decision: PROVIDER_BACKEND is NOT removed in 3B.3** — two
dispatch points cannot be parity-proven by a unit test, so per the conservative rule (remove only when
parity is proven *clearly* for every point) the flag stays. No removal, no behavior/default change.

| Dispatch point | File | Parity coverage (3B.3) | Removable? |
|---|---|---|---|
| `selectTipLamports` | `engine/jito-tip-tx.mjs` | **proven** — pure; legacy === package over percentile/floor/cap cases | yes |
| `buildTipTransferTx` | `engine/jito-tip-tx.mjs` | **proven** — pure; legacy base64 === package base64 (valid 32-byte b58 inputs) | yes |
| `createProviderHealth` | `engine/provider-health.mjs` | **proven** — injected constant clock; snapshot deepEqual over a recorded sequence | yes |
| `quote` / `usdValueOf` | `engine/jupiter-client.mjs` | **proven** — shared global-`fetch` mock; deepEqual on priced route, no-route, HTTP error | yes |
| `rpc` | `engine/rpc-client.mjs` | **proven** — shared global-`fetch` mock; deepEqual on result, JSON-RPC error, HTTP error | yes |
| `getAssetMeta` | `engine/helius-das.mjs` | **proven** — injected stub rpc; deepEqual on hit, miss, bad rpc | yes |
| `subscribeWallets` | `engine/rpc-client.mjs` | **NOT proven** — long-lived WS + gRPC stream; behaviour is event-driven (reconnect/backoff/gap timers), not a request→response a unit test can compare | **blocker** |
| `legacyJitoSendBundle` / `legacyGetJitoTipFloor` | `index.mjs` | **NOT proven** — inline in the boot file (not module exports); network bundle-send, not unit-testable in isolation | **blocker** |

In all 6 proven points the legacy output is byte-identical to `@soltrade/provider-adapters`, the package
backend is the default (unset), and an unknown flag value resolves to the package backend (never legacy).

### What blocks removal, and what 3B.4 needs
1. **`rpc.subscribeWallets` streaming parity.** Build a streaming-parity harness: inject the *same* stub
   `wsFactory` + `grpcIngestorFactory` into both the legacy and package clients, drive an identical
   scripted sequence of fake leader events / disconnects / gaps, and assert the `onLeaderActivity` /
   `onUp` / `onGap` callbacks fire identically. Until that harness exists, streaming parity is asserted
   only structurally (both paths consume the same injected factories; the package is a byte-for-byte port
   of the legacy stream loop) — not good enough to *prove* removal-safety by test.
2. **`index.mjs` jito glue.** `legacyJitoSendBundle` / `legacyGetJitoTipFloor` are inline in the boot
   file and reach the network, so they are not unit-testable as-is. 3B.4 should either extract them into a
   small testable module and add a mock-parity test against `jitoProvider.sendBundle` / `getTipFloor`, or
   remove them under a documented manual-soak sign-off (the package jito provider is already the default
   and a byte-for-byte port).

Once both blockers have parity coverage (or a documented soak sign-off), 3B.4 can delete every
`legacyCreate*` / `legacy*` provider path + the `process.env.PROVIDER_BACKEND` dispatch in all five engine
files and `index.mjs`, make the wrappers package-only (mirroring the 3B.2 RISK removal), and move
`PROVIDER_BACKEND` to the "Removed flags" note. Remaining shims after 3B.3: `PROVIDER_BACKEND` (parity
5/6, removal pending the two blockers), `DECISION_LEDGER_BACKEND`, `POSITIONS_BACKEND` (all kept,
default-off, behind their flags).

## 9. Phase 3B.4 — both blockers closed; PROVIDER_BACKEND REMOVED

The two 3B.3 blockers were closed and parity was proven for **all 6/6** dispatch points, so the
`PROVIDER_BACKEND` legacy shim was removed (the package was already the default, so the active runtime is
unchanged — this deletes the unused rollback path).

**Blocker 1 — `rpc.subscribeWallets` streaming parity (closed).** Built a streaming-parity harness
(fake `WebSocket` + `node:test` `mock.timers`, no network) that drives an identical scripted scenario —
open → subscriptions → `logsNotification` → inline `transactionNotification` → malformed/errored frames →
close → gap window → bounded-backoff reconnect — through the **real legacy and real package** clients via
the flag, and asserted the full observable trace (`onUp` / `onLeaderActivity` / `onGap` / re-subscribe /
socket count) was **byte-identical**, plus identical gRPC-ingestor dispatch args. The harness is retained
as `apps/server/test/provider-stream-parity.test.mjs` (now driving the package path against that golden
trace; gRPC dispatch also covered by `rpc-transport.test.mjs`).

**Blocker 2 — `index.mjs` jito glue (closed).** Proved `legacyJitoSendBundle` / `legacyGetJitoTipFloor`
byte-identical to the package `createJitoProvider.sendBundle` / `getTipFloor` over a shared mock `request`
across every branch (url unset / unavailable / HTTP error / JSON-RPC error / no-result / success + tip
floor array/object/null). The inline glue was deleted; `index.mjs` now calls `jitoProvider` directly.

**Removed:** `legacyCreateJupiterClient` (jupiter-client), `legacyCreateRpcClient` (rpc-client),
`legacyCreateProviderHealth` (provider-health), `legacyCreateDas` (helius-das), `legacyBuildTipTransferTx`
/ `legacySelectTipLamports` (jito-tip-tx), and `legacyJitoSendBundle` / `legacyGetJitoTipFloor` (index.mjs),
plus every `process.env.PROVIDER_BACKEND` dispatch. Each wrapper now delegates straight to
`@soltrade/provider-adapters` (the server still injects the live mechanisms — fetch, WebSocket, the gRPC
ingestor factory, USDC_MINT, the vault-resolved bundle URL). The pure RPC helpers (`isHeliusHost`,
`buildWalletSubscriptions`, `parseStreamNotification`) stay exported (used by `rpc-transport.test.mjs`).

**Updated with it:** `live-first-runtime-flags.md` (PROVIDER_BACKEND → "Removed flags"); `backend-defaults.test.mjs`
(PROVIDER removal guard — no env dispatch, no legacy impl, delegates to the package);
`legacy-shim-guard.test.mjs` (PROVIDER section asserts the env var is inert + the source no longer
dispatches); `docs-consistency.test.mjs` (PROVIDER_BACKEND dropped from the canonical-flag list);
`provider-shim-parity.test.mjs` (reframed: the 3B.3 parity tests now double as package behavioural
coverage + proof the flag is inert). `.env.example` never referenced `PROVIDER_BACKEND`.

**Remaining shims after 3B.4:** `DECISION_LEDGER_BACKEND`, `POSITIONS_BACKEND` (both kept, default-off,
behind their flags). Keep JSON fallback + paper-engine.

## 10. Phase 3B-X — Hard legacy purge (ALL legacy backend shims removed)

The last two rollback shims were deleted, completing the legacy purge. The package paths were already the
defaults, so the active runtime is unchanged — this removes the unused legacy code and the flags.

**Removed:**
- `engine/live-executor.mjs` — deleted the `legacyLedger` in-process intent ledger + the
  `process.env.DECISION_LEDGER_BACKEND` dispatch (and the now-dead `RETRYABLE_SET`). The executor now uses
  `@soltrade/decision-ledger` directly (`createDecisionLedger`), with the store still injected by the host
  (`STORAGE_BACKEND` = JSON default or Postgres). `claimIntent`/`setIntent`/idempotency are unchanged.
- `engine/paper-portfolio.mjs` — deleted the legacy in-process positions book + the
  `process.env.POSITIONS_BACKEND` branch (and the now-dead `EMPTY` / `MARK_HISTORY_MAX` / `round2`). The
  book now comes from `@soltrade/positions` (`createPositionsBook`) directly, store injected by the host.

**Tests:**
- Deleted `legacy-shim-guard.test.mjs` (it guarded the legacy rollback paths — all now gone) and
  `provider-shim-parity.test.mjs` (legacy-vs-package framing).
- Added `no-legacy-flags-guard.test.mjs` — asserts none of `RISK_BACKEND` / `PROVIDER_BACKEND` /
  `POSITIONS_BACKEND` / `DECISION_LEDGER_BACKEND` is read as a live `process.env` flag in runtime code
  (apps/server/src, packages, services), none is defined in `.env.example`, and the canonical flags doc
  lists them only under "Removed flags".
- Added `provider-behavior.test.mjs` — clean package-behaviour coverage of the provider wrappers (no
  legacy framing), replacing the deleted shim-parity file.
- `backend-defaults.test.mjs` slimmed to the live operational flags (storage trio + `DIAGNOSTIC_BACKEND`).
- `docs-consistency.test.mjs` — `DECISION_LEDGER_BACKEND` / `POSITIONS_BACKEND` dropped from the canonical
  flag list. `provider-stream-parity.test.mjs` comments de-legacy-framed (kept as the streaming regression).

**Docs:** `live-first-runtime-flags.md` — the two rows removed; "Defaults are locked" reworded (no legacy
flags remain); "Removed flags" now lists all four. This document — final-status banner + §10.

**Net result:** no legacy backend flags, no rollback shims. Canonical owners: `@soltrade/risk`,
`@soltrade/provider-adapters`, `@soltrade/positions`, `@soltrade/decision-ledger`. KEPT (not legacy):
JSON store (default SoT / fallback), paper-engine (simulation substrate), the real operational backends
(Postgres / Redis / ClickHouse via `STORAGE`/`HOT_STATE`/`EVENT_SINK`), and `DIAGNOSTIC_BACKEND`
(opt-in diagnostic adapter). Still pending restructure work: full Paper→Diagnostic migration, the Rust
signing/execution boundary, and a production/CI/deploy checklist.
