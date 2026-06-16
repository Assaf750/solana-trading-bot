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
(diagnostic adapter). Still pending restructure work after this pass: the Rust signing/execution boundary
and a production/CI/deploy checklist. (The Paper→Diagnostic checking-path migration was completed in §11.)

## 11. Phase 5E — Full Paper → Diagnostic migration (Diagnostics is the only checking path)

**Finding:** the paper-engine was already NOT a checking/preflight path — every paper-engine route is pure
simulation (positions / trades / engine-events / orders / latency / leader-insights / manual commands).
The diagnostics routes use the `DiagnosticExecutionAdapter`, never the paper-engine. The one check route
left outside Diagnostics was `/api/providers/test-connection` (an `rpc.testConnection()` probe), not
backed by the paper-engine.

**Done:**
- **Diagnostics is now ALWAYS on by default** — `index.mjs` builds the adapter unless
  `DIAGNOSTIC_BACKEND=legacy` (escape hatch). The adapter is read-only, so always-on adds no trading risk;
  this makes Diagnostics available as the single checking path.
- **`/api/providers/test-connection` removed.** The connectivity probe moved to a focused diagnostics
  route `POST /api/diagnostics/connectivity` (`adapter.runConnectivityCheck()`, which wraps the same
  `rpc.testConnection()` and carries the diagnostic safety block). The operator-UI callers (SetupWizard +
  MyWalletsFunds "Quick RPC check") + the `testProviderConnection` client method were rewired to it.
- **paper-engine KEPT** — it is the load-bearing simulation/trading engine (drives the simulated book and,
  in live mode, the live-executor), NOT a test path; it was never a deletion candidate. Run-mode wording
  already frames Paper as simulation (Phases 5C/5D).

**Tests:** `backend-defaults` (DIAGNOSTIC defaults ON); `server-core` (404 reworded — it is the
no-adapter-injected case, not an env default); `diagnostics-api` (added `/connectivity` to the disabled-404
list + an enabled-backend connectivity test); `open-by-design-guard` (new guard: `/api/providers/test-connection`
is gone, `/api/diagnostics/connectivity` exists, the client uses `diagnosticsConnectivity`).

**Docs:** `live-first-runtime-flags.md` (DIAGNOSTIC default → on; Diagnostics = the only checking surface;
connectivity replaced test-connection); this §11; `merge-readiness.md` (Paper→Diagnostic checking-path done).

**Outcome:** Diagnostics (`@soltrade/execution`) is the single path for preflight / provider / execution /
connectivity testing. Paper remains only an explicit local simulation. Still NOT a deletion: paper-engine
(needed for simulation + as the live orchestrator until a dedicated `trading-engine` extraction).

## 12. Phase 5F — Trading-engine extraction (name/ownership split from paper-engine)

The live/runtime orchestration is no longer NOMINALLY owned by `paper-engine`. New module
`apps/server/src/engine/trading-engine.mjs` is the canonical runtime orchestrator (ADR-0001 target:
`packages/trading-engine`). This is the **safe wrapper-first** step the plan allows — a name/ownership
move with **zero behavior change**; the implementation still physically lives in `paper-engine.mjs`.

**Done:**
- `trading-engine.mjs` re-exports the factory: `export { createPaperEngine as createTradingEngine }`.
  Because it is the *same* function reference, behavior is provably identical (guarded by a test).
- The runtime composition root (`index.mjs`) now imports `createTradingEngine` and uses a `tradingEngine`
  var; the API handler (`api.mjs`) param + all uses were renamed `paperEngine` → `tradingEngine`. No test
  injects that param, and the snake_case `paper_engine` **status field** (a UI contract read in App.jsx /
  CommandCenter / TradingWorkspace / SetupWizard / WalletIntelligence / risk-center) is intentionally
  **preserved** — renaming it would be a behavior change.
- `paper-engine.mjs` header reworded: it is the **simulation / implementation substrate** behind
  trading-engine (PAPER mode = simulated fills; LIVE execution is delegated to the injected liveExecutor,
  never signed in paper-engine). `createPaperEngine` is still exported (trading-engine re-exports it).

**Tests:** added `trading-engine.test.mjs` (createTradingEngine === createPaperEngine; index/api owned by
trading-engine with no `paperEngine` var; `paper_engine` status field preserved; re-export shape).
`paper-engine.test.mjs` is unchanged — it still tests the implementation substrate directly.

**Deferred (a later phase):** physically extract the live orchestration (leader-stream → copy pipeline →
liveExecutor) into a PURE `packages/trading-engine`, leaving `paper-engine.mjs` as a simulation-only book.
That is a large code move; this phase only split the name/ownership so the runtime no longer reads as
"paper owns live."

## 13. Phase Rust-1 — hot-executor made the official signing/execution boundary

`services/hot-executor` (Rust, fee-payer-locked ed25519) is now the OFFICIAL signer instead of an opt-in.
Open-by-design / ready-when-configured: the in-process `tx-signer.mjs` stays as the documented dev/local +
**fail-safe fallback** (any hot-executor failure falls back to it), so a missing/dead helper can never
block a live signature. No activation gate, no hard stop — readiness is informational.

**Current state (before):** hot-executor ran only when `HOT_EXECUTOR_BIN` was set AND the operator flipped
`execution.signer_backend` to `rust` (default was `node` = in-process). CI built+tested the crate (CI-1)
but the runtime didn't prefer it.

**Done:**
- `execution.signer_backend` **default flipped `node` → `rust`** (config-service.mjs; enum + validation
  unchanged). With the gate `signer_backend === 'rust' && hotSigner`, the runtime now PREFERS the
  hot-executor whenever the binary is configured; `node` is the explicit in-process dev/local override.
  When the binary is absent, `hotSigner` is null → graceful in-process fallback (ready-when-configured).
- **Runtime readiness gained a `signing_backend` capability** (api.mjs + a new `signerBackend` probe in
  index.mjs that pings the helper): `available` (configured + responding) / `not_configured` (no binary,
  in-process active) / `unavailable` (configured but down, still falls back). It is added to
  `capability_status` + the body but **never changes `overall`** (informational; guarded by a test).
- **Docs/headers** position hot-executor as official + in-process as the dev/local fail-safe fallback
  (live-executor.mjs, hot-executor-client.mjs, tx-signer.mjs, index.mjs). `.env.example` gained a
  `HOT_EXECUTOR_BIN` section; `live-first-runtime-flags.md` documents the flag + the signing-boundary role;
  `merge-readiness.md` + `ci.md` updated.
- **Operator UI**: the Runtime-readiness card shows a `signing_backend` badge (backend + status).

**Tests:** `runtime-readiness.test.mjs` gained a `signing_backend` test (capability values + proof it never
changes `overall`). `live-executor.test.mjs` is unchanged (the `signer_backend: 'rust'` routing + fallback
tests still pass — the gate is unchanged, only the default moved). The Rust crate's 8 `cargo test` cases
run in CI (Phase CI-1).

**Not changed (safety):** the fail-safe fallback to in-process signing is intact — the Rust boundary is
preferred, never mandatory, so live signing can never be blocked by a helper problem. Deferred: making the
crate the signer requires the operator to build + deploy the binary; a future phase may move more of the
execution path (submit/bundle) into the crate.

## 14. Phase Engine-2 — physical `packages/trading-engine` extraction (begun; pure-first)

Phase 5F split the engine name/ownership with a wrapper (`apps/server/engine/trading-engine.mjs` re-exported
`createPaperEngine`). Engine-2 begins the PHYSICAL extraction: a real, PURE `@soltrade/trading-engine`
package now OWNS the orchestration logic + the composition entry. Pure-first because `paper-engine.mjs` is
mechanism-bound (fs / rpc / jupiter / liveExecutor) and cannot move into a package wholesale — so the first
extraction is the genuinely pure slice, with the impure substrate INJECTED. Zero behavior change.

**Created:** `packages/trading-engine/` (package.json + src/index.mjs + src/index.d.ts + test). It imports
NO mechanisms (pure; passes the package-boundary/mechanism guard with no allowlist change). It exports:
- `deriveDesiredState(inputs)` — the engine **lifecycle state machine**, extracted byte-for-byte from
  paper-engine's in-line `desiredState()` (ordering kill > vault > rpc > wallets > operator-pause > active).
- `composeTradingEngine({ substrateFactory, deps })` — the composition entry: builds the runtime engine
  from an injected substrate (today returns it unchanged → zero behavior change).
- `ENGINE_STATES` — the lifecycle state constants.

**Wired:**
- `apps/server/engine/paper-engine.mjs` now imports `deriveDesiredState` and its `desiredState()` just
  gathers the inputs (killBlocked / vaultUnlocked / rpcConfigured / followedCount / operatingState) and
  delegates — the state-machine LOGIC is owned by the package, not paper-engine.
- `apps/server/engine/trading-engine.mjs` no longer re-exports paper-engine; it imports
  `composeTradingEngine` from the package and injects `createPaperEngine` as the substrate. `index.mjs` is
  unchanged (`createTradingEngine(deps)` builds the same engine as before).

**Tests/docs:** `packages/trading-engine/test` (state-machine branches + composition delegation);
`apps/server/test/trading-engine.test.mjs` updated (composes via the package; paper-engine consumes the
state machine; `paper_engine` status field preserved). `paper-engine.test.mjs` unchanged (75 tests still
exercise the substrate). flags doc Trading-engine role + merge-readiness updated.

**Deferred:** moving the heavier orchestration (the supervisor loop, command lifecycle, fills) into the
package — that requires inverting more mechanism dependencies (inject rpc/jupiter/stores into pure logic)
and is a large, behavior-sensitive move. paper-engine remains the mechanism-bound substrate until then.

## 15. Phase Clean-1 — dead-export prune + final restructure audit (no behavior change)

**Pruned (proven dead):** the three pure stream helpers in `apps/server/engine/rpc-client.mjs`
(`isHeliusHost` / `buildWalletSubscriptions` / `parseStreamNotification`) were DUPLICATE dead copies — the
runtime uses the LIVE copies in `@soltrade/provider-adapters` (`packages/provider-adapters/src/rpc.mjs`),
and the rpc-client copies were imported only by a test. Removed them; `rpc-client.mjs` is now just the
thin wrapper that injects the gRPC ingestor / fetch / WebSocket into `createRpcProvider`. The three test
cases moved to `packages/provider-adapters/test` (they now exercise the LIVE copies, which previously had
no direct coverage). No runtime behavior change.

**Audited, NOT removed (each needs its own scoped phase):**
- **`services/*` unconnected scaffold** — only `services/ingestor` is JS-wired into apps/server (the gRPC
  ingestor) and `services/hot-executor` is used via its binary (`HOT_EXECUTOR_BIN`, Phase Rust-1). The
  other ~14 dirs (analytics, calibration-store, cost-pipeline, decision-engine, execution-adapter,
  exit-manager, intent-ledger, position-lifecycle-state-machine, protocol-constant-monitor,
  provider-adapters, risk-gates, rpc-health-monitor, signer-service [empty], stream-ingestion) are the
  ADR parallel-package world and are NOT imported by the runtime. Removing them is not a "clear" prune —
  it needs a per-dir audit (cross-references, build status, whether any are planned wiring). Tracked in the
  final remaining list below.
- **Stale wording** — a scan found no remaining `legacy backend` / `rollback shim` / `paper owns` framing
  in runtime `src` (prior phases' wording cleanups were thorough).

## 16. Final restructure remaining list (as of Phase Clean-1)

Everything below is OPEN; everything in §1–§15 is DONE.

1. **Engine physical extraction — next slices.** Move the heavier orchestration from
   `apps/server/engine/paper-engine.mjs` into `@soltrade/trading-engine`: the supervisor loop
   (`superviseTick` / `startSubscription` transitions), the command lifecycle (`closePosition` /
   `resolvePosition` / `manualBuy` / `manualSell` / `addOrder` / `cancelOrder`), and the fills/exits
   pipeline. Requires dependency-inversion (inject rpc / jupiter / stores / liveExecutor into pure logic).
2. **Deploy / image pipeline.** Image build (Deploy-1) + **registry push (Deploy-2, §21)** are **DONE**
   (GHCR publish workflow + `deploy/compose.prod.example.yml` + the production deployment plan). REMAINING:
   cloud-specific orchestration (a Kubernetes/Nomad manifest or managed-platform deploy step + its secret
   store) — left to the operator; the Compose-based path is provided.
3. **Rust as hot-path execution owner — REOPENED + EXPANDING (Phases Rust-3 §22, Rust-4 §23; supersedes the
   Rust-2 §20 "signing-only" close).** Rust's direction is the hot-path execution owner, expanding from
   signing one safe step at a time. **DONE:** the whole executed Jito bundle is Rust-signed (Rust-3
   `sign_bundle`); **the submit + bundle request BODIES are now Rust-assembled (Rust-4 `build_submit` /
   `build_bundle`), with JS fallback.** **STILL JS by design:** the network POST (submit / Jito bundle) +
   decision-ledger idempotency. **NEXT (the only remaining step):** move the POST itself into the signer —
   gated on a *measured* latency win (§20 criterion; needs an HTTP/async stack, so it stays out until
   justified). `select_tip` stays a Rust primitive but is deliberately unwired (tip-math/reserve parity — §23).
4. **`services/*` unused-scaffold audit — DONE** (Phase Services-Audit, §18): 13 empty placeholder dirs
   removed; `services/` now holds only the real, used dirs (`hot-executor`, `ingestor`, `analytics`).

## 17. Phase Deploy-1 — Docker image + CI build (no behavior change)

A production-runnable image build path. The app behavior is unchanged; the only code change is an
env-configurable bind host (default preserved).

- **`Dockerfile`** (multi-stage) + **`.dockerignore`**: stage 1 builds the operator UI (`npm ci` +
  `npm run build`); stage 2 (`node:20-slim`) installs the root runtime deps (`pg` + `redis`, the only
  ones — pure JS, `--workspaces=false`), copies `apps/server` + `packages` + `services/ingestor` + the
  built UI dist, and runs `node apps/server/src/index.mjs`. Postgres/Redis/ClickHouse are external (env);
  no secrets baked in. Validated locally: image builds, the container boots, `/api/runtime/readiness`
  returns 200 (overall `not_configured`, `read_only:true`), the UI is served (GET `/` → 200), and the
  CSRF/Host guards still apply (a header-less POST → 403, the route is wired not 404).
- **Bind host:** added `SOLTRADE_HOST` (default `127.0.0.1` → NO behavior change for non-Docker runs); the
  image sets `SOLTRADE_HOST=0.0.0.0` so Docker port-forwarding works. The anti-DNS-rebinding Host-header
  guard in `server.mjs` is unchanged (still requires a localhost Host) — deploy publishes the port to
  127.0.0.1 / fronts it with a reverse proxy that sets `Host: localhost` (see deploy runbook).
- **CI:** new `docker` job in `.github/workflows/ci.yml` — `docker build` (no push, no deploy); fails only
  if the image cannot build.
- **Docs:** `docs/runbooks/deploy.md` (build/run, env, the Host-header guard, how to build/pass
  `HOT_EXECUTOR_BIN` for the Rust signer, and the explicit out-of-scope: no secrets baked, no registry
  push, no cloud deploy).

**Out of scope (still §16.2 remaining):** registry push, a real cloud deploy / orchestrator manifest, and
secrets-management integration.

## 18. Phase Services-Audit — classify + purge unconnected `services/*` scaffold (no behavior change)

Full audit of every `services/*` dir (content size + every cross-reference in apps / packages / scripts /
docs / CI / Dockerfile / compose / tests).

| service | evidence | class | action |
|---|---|---|---|
| `hot-executor` | 7 files, 474 Rust lines; used via `HOT_EXECUTOR_BIN` + the CI `rust` job | binary-runtime | KEEP |
| `ingestor` | 8 files, 320 JS lines; imported by `apps/server` (`createGrpcIngestor`) + copied into the image | wired-runtime | KEEP |
| `analytics` | 17 files, real Python (backtest / leader-scoring + 4 unittest cases); ADR-documented offline ClickHouse sidecar (advisory) | keep-for-next-phase | KEEP |
| `provider-adapters` · `risk-gates` · `intent-ledger` | `.gitkeep` only (0 code); superseded by `packages/provider-adapters` · `packages/risk` · `packages/decision-ledger` | package-duplicate | **DELETE** |
| `decision-engine` · `execution-adapter` · `exit-manager` · `position-lifecycle-state-machine` · `calibration-store` · `cost-pipeline` · `protocol-constant-monitor` · `rpc-health-monitor` · `signer-service` · `stream-ingestion` | `.gitkeep` only (0 code); 0 references; not in runtime / CI / Docker | empty-scaffold / placeholder | **DELETE** |

**Removed:** the 13 empty placeholder dirs (each held only a `.gitkeep`). None was imported anywhere, in
the Dockerfile (it copies only `services/ingestor`), or in CI (only `services/hot-executor`), so deletion
is behavior-neutral. `services/` now contains exactly the three real dirs: `hot-executor`, `ingestor`,
`analytics`.

**Kept `analytics`** because it is real, tested, standalone Python with an explicit ADR plan (offline
analytics over ClickHouse, advisory-only) — not scaffold. It is not wired into the Node runtime and is not
built by CI/Docker; wiring it (or moving it under a dedicated path) is future work, not this phase.

**Docs:** this §18; §16.4 marked done; `merge-readiness.md` updated. The Dockerfile / CI / deploy.md were
unaffected (they reference only the kept dirs). The ADR / RESTRUCTURE_PLAN architecture-plan docs are left
as historical records (they describe the target design, not live paths).

## 19. Phase Engine-3 — second pure slice into `packages/trading-engine` (leader insights; no behavior change)

After Engine-2 (the lifecycle state machine), extracted the **leader-insights** pure logic — the
follow/drop/watch recommendation, the ranking score, and the insights roll-up — byte-for-byte from
paper-engine's `leaderInsights()`. Pure-first as before: the impure data-gathering (per-leader stats from
the store, the EV-gate verdict) stays in paper-engine; the package owns the decision/score/roll-up.

- **New `packages/trading-engine/src/leader-insights.mjs`** (+ `.d.ts`, re-exported from `index.mjs`):
  `recommendLeader({ stats, minSample, evGateRejected })` → 'follow'|'drop'|'watch';
  `scoreLeader({ total_realized, win_rate })` → number; `finalizeLeaderInsights({ mode, leaders })` →
  ranks by score (best first) + groups addresses by recommendation. Imports NO mechanisms (passes the
  package-boundary/mechanism guard).
- **`paper-engine.mjs`** `leaderInsights()` now gathers the impure inputs (it still runs `checkEvGate`
  ONLY when there is enough sample, exactly as before) and delegates the recommendation / score / roll-up
  to the package. Output is identical — guarded by the existing `paper-engine.test` leaderInsights test
  (recommendation, profit_factor rounding, score sort, grouping) which is unchanged and still green.
- **Tests:** package test gained `recommendLeader` / `scoreLeader` / `finalizeLeaderInsights` cases;
  `apps/server/test/trading-engine.test.mjs` gained an Engine-3 ownership guard (paper-engine imports +
  delegates to the package helpers). `merge-readiness.md` updated.

**Still in paper-engine (mechanism-bound, future slices):** the supervisor loop, the command lifecycle,
fills/exits, and `status()` assembly — they need rpc / jupiter / stores / liveExecutor injected before they
can move into the pure package.

## 20. Phase Rust-2 — execution boundary evaluated; formally closed at signing (no behavior change)

**Question:** move tx submit / Jito bundle SEND into `services/hot-executor`, or document that the Rust
boundary is signing-only for now?

**Findings (current state):**
- The Rust crate handles ops `sign` + the PURE payload helpers `build_submit` (sendTransaction body),
  `build_bundle` (Jito bundle body), `select_tip` (tip-floor math). Its deps are crypto/encoding/serde only
  — **no HTTP / async-runtime crate; it never opens a socket.** `submit.rs`'s own header states this is
  intentional ("PURE (no network): the TS control plane performs the actual POST ... retries, and the
  intent ledger (idempotency) stays in TS").
- The JS client (`hot-executor-client.mjs`) exposes only `sign` / `ping` / `close`; the `build_*`/`select_tip`
  ops exist + are cargo-tested but are not wired (the JS layer builds its own bodies via
  `@soltrade/provider-adapters` + `jito-tip-tx`, which are parity-proven).
- The SEND is entirely JS: `live-executor.submitSigned()` → `rpc.rpc('sendTransaction', …)` or the Jito
  path `jitoSendBundle([...])`, with retries + the decision-ledger intent idempotency in JS.

**Decision: do NOT deepen now — keep the boundary at signing.** Rationale: moving the POST into the
fee-payer-locked signer would add an HTTP client + async runtime to the most security-critical component,
enlarging its attack surface, while the latency-relevant body/tip math is *already* compiled in Rust as
pure helpers. The clean split — **Rust = sign (+ pure payload/tip math), network-free; JS = network POST +
retries + intent-ledger idempotency** — is the correct architecture. No execution path changed.

**Added (guard, prevents responsibility mixing):** `apps/server/test/rust-boundary-guard.test.mjs` —
(a) `services/hot-executor/Cargo.toml` must carry no HTTP/async crate (reqwest/hyper/tokio/ureq/… ), so the
signer stays network-free; (b) `live-executor` sends via `rpc.sendTransaction` / `jitoSendBundle`; (c) the
hot-executor client surface is `sign`/`ping`/`close` only (it never POSTs). Docs: §16.3 marked decided;
`merge-readiness.md` + `deploy.md` note the network-free signing boundary.

**Revisit criterion:** only a *measured* latency win from a single sign+submit round-trip would justify
adding a network stack to the signer; until then, signing-only is the intended, guarded boundary.

> **Superseded in part by Phase Rust-3 (§22).** The *network-free* half of this decision still holds (the
> POST stays in JS), but the "signing-only" framing was reopened: Rust is now the hot-path **execution
> owner**, expanding from signing one safe step at a time. The first expansion (the Jito tip leg is now
> Rust-signed via the new `sign_bundle` op) shipped in §22; the signer remains network-free.

## 21. Phase Deploy-2 — registry push + production deployment plan (no app/runtime change)

Upgraded Deploy-1 (build-only) to a real publish + deploy path. No application behavior change; the only
image change is an additive `HEALTHCHECK`.

- **`.github/workflows/publish.yml`** — builds + pushes the image to **GHCR** on a version tag (`v*`) or a
  manual `workflow_dispatch` (deliberate publish; CI's `docker` job already validates the build on push/PR).
  Auth uses the built-in `GITHUB_TOKEN` (`permissions: packages: write`) — **no repo secret added**; no app
  secret is baked into the image. Tags via `docker/metadata-action`: `:sha-<commit>` (immutable rollback
  target), `:vX.Y.Z` (tag pushes), `:latest` (default branch).
- **`Dockerfile`** gained a `HEALTHCHECK` (node `fetch` of `/api/runtime/readiness`; curl/wget are absent in
  slim; Host 127.0.0.1 satisfies the rebinding guard). Verified: the container reports `healthy`.
- **`deploy/compose.prod.example.yml`** — the app service on the published image, loopback-published, env
  placeholders + a `.env` (not committed), external-datastore notes, optional `HOT_EXECUTOR_BIN` mount. No
  real secrets.
- **`docs/runbooks/deploy.md`** — added "Publishing the image (GHCR)" + "Production deployment plan" (env
  matrix, external datastores, reverse proxy/Host, health/readiness gating, and **image-tag-based
  rollback** — redeploy a prior `:sha-…`, never a legacy code path). Out-of-scope updated (registry push
  done; cloud-specific orchestration remains).

**Verified:** node --test green; cargo `--locked` + test 8/8; vite build OK; **docker build OK + the
container reports `healthy`** (HEALTHCHECK); smokes skip; both workflow YAMLs parse. The publish push to
GHCR runs on a tag / manual dispatch (owner-triggered) — CI (the 4 build/test jobs) stays green on push.

## 22. Phase Rust-3 — Rust reframed from signer to hot-path EXECUTION OWNER (first safe expansion)

Rust-2 (§20) formally *closed* the boundary at signing. Rust-3 **reopens it deliberately**: Rust's stated
direction is now the **hot-path execution owner**, expanding outward from signing one safe, tested step at a
time — NOT a big-bang move of the network POST. This phase establishes the new boundary + ships the first
expansion. **The signer stays network-free this phase** (the actual POST + idempotency remain in JS); the
revisit criterion from §20 (a *measured* latency need) still governs whether a socket is ever added.

**New boundary (as of Rust-3):**
- **Rust = hot-path execution owner** — signs *every* leg of the executed bundle (`sign` for the swap +
  the new **`sign_bundle`** op for the whole bundle) and provides the pure execution-assembly primitives
  (`build_submit` / `build_bundle` / `select_tip`). Still **network-free** — no HTTP/async crate.
- **JS = control plane** — builds the unsigned legs, performs the network POST (`rpc.sendTransaction` /
  `jitoSendBundle`), and owns the decision-ledger **idempotency** (`claimIntent`). Unchanged.

**First safe expansion shipped — the Jito bundle's TIP leg is now Rust-signed.** Before Rust-3, even in
`signer_backend='rust'` the swap leg was Rust-signed but the bundle's *tip* leg was always signed
in-process (JS) — a silent gap where part of the executed bundle bypassed the official signer. Now:
- **Rust** `services/hot-executor/src/main.rs` gained the `sign_bundle` op (`unsigned_txs[]` → `signed_txs[]`,
  fee-payer-locked per leg, reusing `sign_serialized_transaction` byte-for-byte; any bad/empty leg → error
  so the caller falls back). + cargo tests (`sign_bundle_signs_every_leg`, `…rejects_empty_and_bad_leg`).
- **JS client** `hot-executor-client.mjs` gained `signBundle({ txsBase64, seed })` → `{ ok, signed:[…] }`;
  the surface is now `sign` / `signBundle` / `ping` / `close` (still **never POSTs**).
- **`live-executor.submitSigned()`** jito path: when `signer_backend='rust'` + `hotSigner.signBundle`, the
  tip leg is signed via Rust, so the **whole** bundle `[swap, tip]` is Rust-signed; **fail-safe** — any
  hot-executor failure falls back to in-process tip signing, so a dead/missing helper can never block the
  bundle. No other execution path changed; the `'node'` backend and non-jito sends are untouched.

**Guard (reframed, prevents undeliberate growth + a network signer):**
`apps/server/test/rust-boundary-guard.test.mjs` now asserts the *execution-owner* boundary — (a)
`Cargo.toml` carries **no HTTP/async crate** (the signer stays network-free; a socket needs a documented
decision); (b) the network POST + idempotency stay in JS (`rpc.sendTransaction` + `jitoSendBundle` +
`claimIntent` in live-executor); (c) the client surface is `sign`/`signBundle`/`ping`/`close` and **never**
references `sendTransaction`/`sendBundle`. Together these let Rust grow as the execution owner while keeping
each step deliberate and the signer off the network.

**Tests:** cargo `sign_bundle` cases (10/10); `hot-executor-client.test.mjs` `signBundle` FIFO case;
`live-executor.test.mjs` two jito+rust integration cases (the tip leg is Rust-signed → bundle =
`[rust swap, rust tip]`; and the fallback path signs the tip in-process when `signBundle` fails).

**Verified:** node --test green; cargo `--locked` + test **10/10**; docker build OK; smokes skip; UI
unchanged (no vite build needed). Docs: this §22; §16.3 reframed (below); §20 references this reopening;
`merge-readiness.md` + `deploy.md` updated to say Rust is the execution owner (not signing-only).

**Next safe expansions (open, same deliberate cadence):** wire `build_submit`/`build_bundle` so the *request
body* assembly is Rust-owned end-to-end (still JS POST); only then — and only on a measured latency win —
revisit moving the POST itself (§20 criterion).

## 23. Phase Rust-4 — Rust owns the submit/bundle request-BODY assembly (POST stays in JS)

The next deliberate step flagged in §22: the Rust hot-executor now assembles the **request bodies** for both
send paths, while the JS control plane still performs the POST (with its retries / health / error-mapping)
and owns decision-ledger idempotency. **Still network-free** — no socket added to the signer; §20's revisit
criterion (a measured latency need) continues to govern ever moving the POST itself.

Before Rust-4, the `build_submit` / `build_bundle` / `select_tip` ops existed in Rust + were unit-tested, but
were **unwired** — the JS layer assembled its own bodies (`rpc(method, params)` and Jito `sendBundle(txs)`
each built `{jsonrpc,id,method,params}` internally). Now the bodies are sourced from Rust when configured.

- **Rust** `services/hot-executor`: ops unchanged (already present); added **op-dispatch (handle-level)
  cargo tests** for `build_submit` / `build_bundle` / `select_tip` (the `Response.request` body + the
  `>5`-leg / missing-field error paths — the exact contract the JS client consumes). Cargo: **13 tests**.
- **JS client** `hot-executor-client.mjs`: new `buildSubmit({ signedTxBase64, skipPreflight, maxRetries })`
  and `buildBundle({ signedTxs })` → `{ ok, body }` (the full JSON-RPC body) or `{ ok:false }` for fallback.
  Surface is now `sign / signBundle / buildSubmit / buildBundle / ping / close` — still **never POSTs**.
- **Transports accept an optional pre-built body** (backward-compatible): `@soltrade/provider-adapters`
  `rpc(method, params, { body })` and Jito `sendBundle(txsBase64, { body })` POST the given body verbatim
  when supplied, else assemble it as before. `method` stays the health-record label. `.d.ts` updated;
  `index.mjs` `jitoSendBundle` forwards the opts.
- **`live-executor.submitSigned()`**: both paths now build the body via Rust when `signer_backend='rust'` +
  the client method is present, then pass it to the JS POST; **fail-safe** — any failure leaves the body
  null and the JS transport assembles it (byte-for-byte the same params). The RPC error codes (`rpc_*`) the
  caller keys idempotency off are produced by the JS POST, unchanged. **No behavior change**: the Rust body
  is semantically identical to the JS one (same method/params; JSON key order is irrelevant to JSON-RPC).

**`select_tip` deliberately NOT wired (documented).** The Rust `select_tip` op uses different semantics
(level→percentile, 1000-lamport protocol floor, no fixed/cap) than the JS `selectTipLamports` (bucket-snap +
configurable `fixedLamports` floor + `maxLamports` cap). The balance-reserve check (`maxTipReserveLamports`)
mirrors the **JS** cap, so routing the live tip through Rust would change the tip amount AND break the
reserve invariant. The JS selector stays authoritative; `select_tip` remains a tested Rust primitive only.

**Guard** `rust-boundary-guard.test.mjs` (reframed for Rust-4): (a) `Cargo.toml` still carries **no
HTTP/async crate**; (b) the POST + idempotency stay in JS (`rpc.rpc('sendTransaction'`, `jitoSendBundle(`,
`claimIntent(`); (c) the client surface includes `buildSubmit`/`buildBundle` and holds **no network
primitive** (the old method-name-string proxy was replaced with a real `fetch`/`http`/`WebSocket` check,
since the JSDoc now legitimately names the methods); (d) **new:** the live-executor sources the body from
Rust when available (`hotSigner.buildSubmit` / `hotSigner.buildBundle`) and carries it to the JS POST
(`{ body: submitBody }` / `{ body: bundleBody }`).

**Tests:** cargo **13/13**; `provider-adapters` — each transport POSTs a pre-built body verbatim; client —
`buildSubmit`/`buildBundle` return the assembled body; live-executor — 4 cases (submit body from Rust +
fallback; bundle body from Rust + fallback). **Verified:** node `--test` full suite green; cargo
`--locked` + test 13/13; docker build OK; UI unchanged (no vite build); smokes skip.

**Next (open, same cadence):** the only remaining Rust execution-ownership step is moving the **POST itself**
into the signer — gated on §20's *measured* latency criterion (would require adding an HTTP/async stack, so
it stays out until justified). Until then the split is: **Rust = sign + assemble (network-free); JS = POST +
idempotency.**

## 24. Phase Rust-5 — Rust understands a buy/sell execution command (the execution envelope)

Rust-3 added per-leg signing; Rust-4 added per-body assembly. Rust-5 **consolidates** them: a single op,
`build_execution_plan`, that understands a whole buy/sell execution command as one unit — sign EVERY leg AND
assemble the submit/bundle body in ONE call, returning a self-describing **envelope**. This cuts the hot path
from two JS↔Rust round-trips (sign, then build) to one, and makes "the execution command" a first-class Rust
concept. **Still network-free, still no idempotency/db in Rust** — the JS control plane persists the
deterministic signature, performs the POST, and owns the intent ledger.

**The envelope** (`hotSigner.buildExecutionPlan({ unsignedTxs, seed, mode, side, skipPreflight, maxRetries })`
→ `{ ok, envelope }`):
```
envelope = {
  mode: "rpc" | "jito",        // which submit path this plan targets
  leg_count: N,
  side: "buy" | "sell",        // metadata, echoed
  signatures: [b58, …],        // per-leg fee-payer signatures; signatures[0] = the swap's on-chain tx id
  signed_txs: [base64, …],     // the signed legs (swap [+ Jito tip])
  submit_body | bundle_body    // the assembled JSON-RPC body for the chosen mode
}
```

- **Rust** `services/hot-executor/src/main.rs`: new `build_execution_plan` op — signs each unsigned leg
  (fee-payer-locked, reusing `sign_serialized_transaction`), then builds `submit_body` (rpc, exactly one leg)
  or `bundle_body` (jito) from the freshly-signed legs. Rejects empty legs / `rpc` mode with >1 leg /
  unknown mode / a bad leg. New `Request.execution_mode` + `Request.side`, new `Response.envelope`. + cargo
  tests (rpc mode, jito mode, bad-input matrix). Cargo: **16 tests**.
- **JS client** `hot-executor-client.mjs`: new `buildExecutionPlan(...)` → `{ ok, envelope }` (or `{ ok:false }`
  for fallback). Surface is now `sign / signBundle / buildSubmit / buildBundle / buildExecutionPlan / ping /
  close` — still **no network primitive** (stdin/stdout only).
- **`live-executor`**: new `buildEnvelopePlan()` helper is the **preferred** path in `executeSwapInner` — it
  determines the mode (jito needs a fresh blockhash + the unsigned tip leg, built in JS via the parity-proven
  `buildTipTransferTx`), calls `build_execution_plan`, then returns `{ signed, doPost }`. The money path:
  persists `SENT_PENDING` with `envelope.signatures[0]` **before** the POST (so an ambiguous send stays
  reconcilable), then `doPost()` POSTs via the existing JS transports (`jitoSendBundle` / `rpc.rpc`) carrying
  the envelope body. **Fail-safe at every step** — if `build_execution_plan` is absent (older binary), errors,
  or returns an incomplete envelope, it falls back to the existing path: sign the swap (Rust `sign` or
  in-process) + `submitSigned` (with its own Rust-3/Rust-4 logic + fallbacks). The jito `doPost` also falls
  back to a plain RPC send if the bundle POST fails — a Jito outage can never block the send.

**Invariants preserved (money path):** the deterministic fee-payer signature is still persisted BEFORE
broadcasting; idempotency (`claimIntent`) is unchanged and in JS; the balance/tip reserve check is unchanged;
`select_tip` stays the unwired JS-authoritative selector (§23); the `'node'` backend and the entire
non-envelope path are untouched. No behavior change at default settings — the envelope produces the same
signed txs + the same request bodies, just in one call.

**Guard** `rust-boundary-guard.test.mjs` (reframed for Rust-5): (a) `Cargo.toml` still carries no HTTP/async
crate; (b) POST + idempotency stay in JS; (c) the client surface includes `buildExecutionPlan` and holds no
network primitive; (d) Rust-4 body-sourcing still asserted; (e) **new:** the live-executor uses
`hotSigner.buildExecutionPlan` via `buildEnvelopePlan`, reads `env.signatures[0]`, and persists `SENT_PENDING`
before the POST.

**Tests:** cargo **16/16**; client — `buildExecutionPlan` returns a signed+assembled envelope (rpc + jito);
live-executor — 3 cases (jito envelope used + JS posts it; rpc envelope used + JS posts it; fallback to the
sign+submit path when `build_execution_plan` fails). **Verified:** node `--test` full suite green; cargo
`--locked` + test 16/16; docker build OK; UI unchanged (no vite build); smokes skip.

**Next (open, same cadence — unchanged):** the only remaining step is moving the **POST itself** into the
signer, gated on §20's *measured* latency criterion. The split stays: **Rust = sign + assemble the whole
execution command (network-free); JS = POST + idempotency.**
