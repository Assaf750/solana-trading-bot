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
- **Diagnostics** (`@soltrade/execution`) — the official surface for **readiness / provider / execution
  testing** (read-only pre-flight; never trades).
- **Paper** — **simulation / legacy** sandbox portfolio model only; never a readiness or execution-test
  tool.

## Flag table
| Flag | Values | Default | Role |
|---|---|---|---|
| `STORAGE_BACKEND` | `json` \| `postgres` | `json` | Operational SoT store (decision-ledger / positions / audit). |
| `POSTGRES_URL` (or `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`) | URL / parts | — | Postgres connection (used only when `STORAGE_BACKEND=postgres`). |
| `HOT_STATE_BACKEND` | `memory` \| `redis` | `memory` | Hot-state cache (never SoT). |
| `REDIS_URL` (or `REDIS_HOST`/`REDIS_PORT`) | URL / parts | — | Redis connection (used only when `HOT_STATE_BACKEND=redis`). |
| `EVENT_SINK_BACKEND` | `none` \| `clickhouse` | `none` | Analytics-only event sink (never SoT). |
| `CLICKHOUSE_URL` (or `CLICKHOUSE_HOST`/`CLICKHOUSE_HTTP_PORT` + `CLICKHOUSE_DB`/`USER`/`PASSWORD`) | URL / parts | — | ClickHouse connection (used only when `EVENT_SINK_BACKEND=clickhouse`). |
| `DIAGNOSTIC_BACKEND` | `legacy` \| `package` | `legacy` | `package` wires the DiagnosticExecutionAdapter (+ `/api/diagnostics/*`); `legacy` = off (opt-in). |
| `DECISION_LEDGER_BACKEND` | `package` \| `legacy` | `package` | decision-ledger owner = `@soltrade/decision-ledger`; `legacy` = in-process rollback shim. |
| `POSITIONS_BACKEND` | `package` \| `legacy` | `package` | positions book owner = `@soltrade/positions`; `legacy` = rollback shim. |
| `PROVIDER_BACKEND` | `package` \| `legacy` | `package` | providers owner = `@soltrade/provider-adapters`; `legacy` = rollback shim. |
| `SOLTRADE_PORT` | number | `8787` | server HTTP port. |
| `SOLTRADE_DATA_DIR` | path | `data/` | JSON store directory. |
| `RUN_POSTGRES_SMOKE` / `RUN_REDIS_SMOKE` / `RUN_CLICKHOUSE_SMOKE` / `RUN_FULL_STACK_SMOKE` | `1` | unset | opt-in gates for the smoke scripts (never part of `node --test`). |
| `SOLTRADE_BASE_URL` | URL | — | optional API target for `smoke:full-stack`. |

## Defaults are locked
The remaining rollback flags (`PROVIDER_BACKEND` / `DECISION_LEDGER_BACKEND` / `POSITIONS_BACKEND`)
select `legacy` ONLY on the literal `'legacy'` (so the default is the package backend);
`STORAGE`/`HOT_STATE`/`EVENT_SINK` default to `json`/`memory`/`none`; `DIAGNOSTIC` is opt-in.
This is enforced by `apps/server/test/backend-defaults.test.mjs` — defaults cannot silently flip.

## Removed flags
- `RISK_BACKEND` — **removed in Phase 3B.2** (after 3B.1 proved legacy↔package parity). The hard-risk
  gate now delegates straight to `@soltrade/risk`; setting `RISK_BACKEND` has no effect.

See `docs/runbooks/local-full-stack.md` to run the whole stack and `docs/architecture/legacy-audit.md`
for the legacy/shim inventory.
