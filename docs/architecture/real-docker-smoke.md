# Real Docker Full-Stack Smoke — Live-First baseline

End-to-end run of the full Live-First stack against **real Docker** (Postgres + Redis + ClickHouse +
server + diagnostics + analytics). Two real operational bugs in the smoke/migrate tooling were found and
fixed; no architecture or trading behavior changed.

## Run
- **Date:** 2026-06-16
- **Branch / baseline:** `feat/real-docker-smoke` off `main` `f8cd076` (tag `live-first-baseline`)
- **Docker:** Engine 29.4.1
- **Env:** `STORAGE_BACKEND=postgres`, `HOT_STATE_BACKEND=redis`, `EVENT_SINK_BACKEND=clickhouse`,
  `DIAGNOSTIC_BACKEND=package`; `POSTGRES_URL`/`REDIS_URL`/`CLICKHOUSE_URL` from `infra/docker/.env`
  (copied from `.env.example`, gitignored).

## Services (docker compose)
| Service | Container | Status |
|---|---|---|
| postgres | `soltrade-postgres` | Up, **healthy** |
| redis | `soltrade-redis` | Up, **healthy** |
| clickhouse | `soltrade-clickhouse` | Up, **healthy** |

## Migrations
- **Postgres:** `npm run db:postgres:migrate` → **6/6 OK** (0001…0006).
- **ClickHouse:** `npm run db:clickhouse:migrate` → first run **FAILED** (HTTP 400 syntax) → fixed (see
  below) → **2/2 OK** (`0001_analytical_tables.sql` 6 statements, `0002_analytics_events.sql` 1).

## Smokes (against the real stack)
| Smoke | Result |
|---|---|
| `RUN_POSTGRES_SMOKE=1 npm run smoke:postgres` | **OK** — connection + audit + decision-ledger + positions |
| `RUN_REDIS_SMOKE=1 npm run smoke:redis` | **OK** — lock + ttl + rate-limit + cursor + provider-health |
| `RUN_CLICKHOUSE_SMOKE=1 npm run smoke:clickhouse` | **OK** — ping + write + read-back (after exit fix; exit 0) |
| `RUN_FULL_STACK_SMOKE=1 npm run smoke:full-stack` (datastores) | **OK** — postgres / redis / clickhouse reachable |
| `RUN_FULL_STACK_SMOKE=1 SOLTRADE_BASE_URL=… npm run smoke:full-stack` (with server) | **OK** — + API: runtime/readiness, analytics/summary, diagnostics/run all HTTP 200 |

## Wired API (server with the full stack)
- `GET /api/runtime/readiness` → `overall: not_configured` (open-by-design — no RPC/signer config yet);
  `storage{backend:postgres, available}`, `hot_state{backend:redis, available}`,
  `event_sink{backend:clickhouse, available}`. Banned lock/gate vocabulary scan: **none**.
- `GET /api/analytics/summary` → `status: available`, `diagnostic_runs: 1` (read from real ClickHouse).
- `POST /api/diagnostics/run` → `kind: preflight`, `overall: fail` (connectivity has no RPC URL —
  expected), `safety.no_transaction_sent: true` (read-only; never trades).

## Fixes applied (operational bugs only — no architecture change)
1. **`scripts/clickhouse-migrate.mjs`** — strip `--` line comments **before** splitting on `;`. A `;`
   inside a comment (`-- … SSOT names; "storage-only" …`) was breaking statement splitting, producing a
   non-comment fragment that ClickHouse rejected (HTTP 400). Re-run → 2/2 OK.
2. **`scripts/smoke-clickhouse.mjs` + `scripts/smoke-full-stack.mjs`** — on success set `process.exitCode`
   instead of calling `process.exit()`. Forcing exit while the global `fetch` (undici) keep-alive socket
   was still open triggered a libuv assertion (`UV_HANDLE_CLOSING`, `async.c:76`) on Windows → the smoke
   printed OK but aborted with a non-zero code (127). Now exits cleanly (0).

## Post-fix verification
- full `node --test`: **2253 / 0**; mechanism guard PASS; both changed smokes still SKIP cleanly without
  env (exit 0); all three changed scripts pass `node --check`.

## Notes
- `npm install` generated a root `package-lock.json` (the repo did not track one); left untracked — track
  or ignore as a separate dependency-management decision.
- `docker compose down` run at the end (data volumes kept); re-up via `docs/runbooks/local-full-stack.md`.

## Known follow-ups (not started)
- Phase 3B — legacy-shim + unused-export pruning after a soak.
- Rust signing/exec boundary.
- Full Paper → Diagnostic engine migration.
