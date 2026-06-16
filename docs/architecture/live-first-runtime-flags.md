# Live-First Runtime Flags (ADR-0001 — canonical reference)

Single source of truth for every runtime flag introduced by the Live-First phases. **Open-by-design:**
all backends are opt-in; the safe defaults need no external service and `node --test` never requires
one. Readiness is **monitoring only**, not enforcement — capabilities simply become available once
configured; there are no artificial gates.

## Data-layer roles
- **PostgreSQL** — the **operational source of truth** when `STORAGE_BACKEND=postgres` (decision-ledger,
  positions, audit). 
- **Redis** — **hot-state** cache (locks / cursors / rate-limits / idempotency). It is **never the
  source of truth**; entries are rebuildable and every access is fail-open.
- **ClickHouse** — **analytics-only**, append-only event sink. Never the source of truth; writes are
  fail-open and never affect trading.
- **JSON** — the **default** local store + fallback / snapshot / recovery; unchanged and always kept.
- **Diagnostics** (`@soltrade/execution`) — the **only** surface for **readiness / provider / execution
  testing** (read-only pre-flight; never trades). On by default since Phase 5E; the connectivity check
  (`/api/diagnostics/connectivity`) replaced the legacy `/api/providers/test-connection` probe.
- **Trading engine** (`engine/trading-engine.mjs` → ADR-0001 `packages/trading-engine`) — the runtime
  orchestrator that owns the live path (leader stream → copy pipeline → liveExecutor) and the simulated
  book. paper-engine is its implementation substrate (Phase 5F name/ownership split).
- **Paper** — **simulation** sandbox portfolio model only (the trading engine runs the simulated book in
  paper mode); never a readiness or execution-test tool. All checking goes through Diagnostics.
- **Signing / execution boundary** (`services/hot-executor`, Rust) — the **official** signer (ADR-0001
  Phase Rust-1). Preferred whenever configured (`HOT_EXECUTOR_BIN` set; `execution.signer_backend`
  defaults to `rust`); the in-process `tx-signer.mjs` is the documented dev/local + **fail-safe fallback**
  (any hot-executor failure falls back to it, so signing is never blocked). Runtime readiness reports
  `signing_backend` as `available` / `not_configured` / `unavailable` — **informational only**, not a gate.

## Flag table
| Flag | Values | Default | Role |
|---|---|---|---|
| `STORAGE_BACKEND` | `json` \| `postgres` | `json` | Operational SoT store (decision-ledger / positions / audit). |
| `POSTGRES_URL` (or `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`) | URL / parts | — | Postgres connection (used only when `STORAGE_BACKEND=postgres`). |
| `HOT_STATE_BACKEND` | `memory` \| `redis` | `memory` | Hot-state cache (never SoT). |
| `REDIS_URL` (or `REDIS_HOST`/`REDIS_PORT`) | URL / parts | — | Redis connection (used only when `HOT_STATE_BACKEND=redis`). |
| `EVENT_SINK_BACKEND` | `none` \| `clickhouse` | `none` | Analytics-only event sink (never SoT). |
| `CLICKHOUSE_URL` (or `CLICKHOUSE_HOST`/`CLICKHOUSE_HTTP_PORT` + `CLICKHOUSE_DB`/`USER`/`PASSWORD`) | URL / parts | — | ClickHouse connection (used only when `EVENT_SINK_BACKEND=clickhouse`). |
| `DIAGNOSTIC_BACKEND` | on (default) \| `legacy` | on | The DiagnosticExecutionAdapter — the **only** checking path (`/api/diagnostics/*`: status / run / provider-test / connectivity) — is wired by default (Phase 5E). Read-only (never trades). Set `legacy` only to disable it. |
| `HOT_EXECUTOR_BIN` | path | — | Path to the Rust `services/hot-executor` binary. When set, it becomes the official signer (the live-executor prefers it; falls back to in-process on any failure). Unset = in-process dev/local signer. Not a gate — surfaced as the `signing_backend` readiness capability. |
| `SOLTRADE_PORT` | number | `8787` | server HTTP port. |
| `SOLTRADE_DATA_DIR` | path | `data/` | JSON store directory. |
| `RUN_POSTGRES_SMOKE` / `RUN_REDIS_SMOKE` / `RUN_CLICKHOUSE_SMOKE` / `RUN_FULL_STACK_SMOKE` | `1` | unset | opt-in gates for the smoke scripts (never part of `node --test`). |
| `SOLTRADE_BASE_URL` | URL | — | optional API target for `smoke:full-stack`. |

## Defaults are locked
No legacy rollback flags remain — the risk gate, providers, positions book, and intent ledger each
delegate to their `@soltrade/*` package (the only path; see "Removed flags"). The operational backends
default safely with empty env: `STORAGE_BACKEND`/`HOT_STATE_BACKEND`/`EVENT_SINK_BACKEND` →
`json`/`memory`/`none`, and `DIAGNOSTIC_BACKEND` is opt-in. Enforced by
`apps/server/test/backend-defaults.test.mjs` (operational defaults) +
`apps/server/test/no-legacy-flags-guard.test.mjs` (no legacy flag is live) — defaults cannot silently flip.

## Removed flags
All legacy `legacy|package` rollback shims have been removed; each owner package is now the only path.
- `RISK_BACKEND` — **removed in Phase 3B.2** (after 3B.1 proved legacy↔package parity). The hard-risk
  gate now delegates straight to `@soltrade/risk`; setting it has no effect.
- `PROVIDER_BACKEND` — **removed in Phase 3B.4** (after 3B.3/3B.4 proved legacy↔package parity for all
  six dispatch points — jupiter, rpc incl. the `subscribeWallets` streaming trace, provider-health,
  helius-das, jito-tip, and the index.mjs jito bundle/tip-floor glue). Providers delegate straight to
  `@soltrade/provider-adapters`; setting it has no effect.
- `POSITIONS_BACKEND` / `DECISION_LEDGER_BACKEND` — **removed in the hard legacy purge (Phase 3B-X)**.
  The positions book delegates straight to `@soltrade/positions` and the intent ledger to
  `@soltrade/decision-ledger`; the store is still injected by `STORAGE_BACKEND` (JSON default or
  Postgres), so the data layer is unchanged. Setting either flag has no effect.

See `docs/runbooks/local-full-stack.md` to run the whole stack and `docs/architecture/legacy-audit.md`
for the legacy/shim inventory.
