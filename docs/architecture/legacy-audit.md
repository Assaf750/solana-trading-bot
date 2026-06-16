# Legacy Audit & Live-First Cleanup Plan (ADR-0001 Phase 9A)

**Binding rule:** Open-by-design. Ready when configured. No artificial locks. No activation gates. No
hard stops. Readiness is **monitoring only, not enforcement** (see `memory/open-by-design-runtime` and
Phase 8A-R). This document inventories legacy / wrapper / duplicate paths left after the Live-First
phases and classifies what may be pruned **later** — it executes only small, behavior-neutral cleanups
now.

> Status of this pass (9A): inventory + classification + small safe cleanups (doc wording + regression
> guards) only. **No component removed, no behavior changed.** Defaults are unchanged.

---

## 1. Classification summary

| Bucket | Meaning | Items |
|---|---|---|
| **Keep (not legacy)** | Active, correct, no action | JSON stores (default SoT), paper-engine/paper-portfolio (simulation substrate), kill-switch / hard-risk / signer-session (operator safety controls — NOT activation locks), Postgres/Redis/ClickHouse backends |
| **Keep as compatibility shim** | Legacy path retained behind a flag (default = new package); rollback insurance | `*_BACKEND=legacy` paths (PROVIDER / DECISION_LEDGER / POSITIONS / RISK) |
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

### Env flags (all currently live — none dead/obsolete)
`STORAGE_BACKEND` (json|postgres) · `HOT_STATE_BACKEND` (memory|redis) · `EVENT_SINK_BACKEND` (none|clickhouse) ·
`DIAGNOSTIC_BACKEND` (legacy|package) · `PROVIDER_BACKEND` / `DECISION_LEDGER_BACKEND` / `POSITIONS_BACKEND` / `RISK_BACKEND` (legacy|package, default package) ·
`SOLTRADE_PORT` · `SOLTRADE_DATA_DIR` · `RUN_POSTGRES_SMOKE` / `RUN_REDIS_SMOKE` / `RUN_CLICKHOUSE_SMOKE`.

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
needs a dead-code proof per export and is not attempted in 9A.
