# Runbook — Local Full-Stack (Live-First runtime)

Bring up the whole new architecture locally, end to end: **PostgreSQL + Redis + ClickHouse + server +
operator UI + diagnostics + readiness + analytics**. This is a development/verification runbook — it does
**not** change trading behavior and sends no transactions.

## Design invariants (do not violate)
- **Open-by-design.** Readiness is **monitoring only**, not enforcement — capabilities report
  `available | not_configured | degraded | unavailable`; there are no artificial gates.
- **PostgreSQL = operational source of truth** (when `STORAGE_BACKEND=postgres`).
- **Redis = hot-state cache** (locks/cursors/rate-limits/idempotency) — **never the source of truth**;
  every entry is rebuildable, and a Redis outage is fail-open (a cache miss).
- **ClickHouse = analytics-only** append-only event sink — never the source of truth; writes are
  fail-open and never affect trading.
- These backends are **opt-in**. The safe defaults stay `STORAGE_BACKEND=json`,
  `HOT_STATE_BACKEND=memory`, `EVENT_SINK_BACKEND=none`, `DIAGNOSTIC_BACKEND=legacy`; `node --test`
  never requires any external service.

## 0. Prerequisites
- Node 20+ and Docker (Compose v2).
- From the repo root.

## 1. Install
```bash
npm install                      # installs the single root deps (pg, redis)
cd apps/operator-ui && npm install && cd ../..
```

## 2. Start the datastores
```bash
cp infra/docker/.env.example infra/docker/.env     # local DEV dummy creds (gitignored)
docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env up -d postgres redis clickhouse
docker compose -f infra/docker/compose.yaml ps      # all three healthy
```

## 3. Configure the full-stack env
Export these for the migrate / smoke / server steps (derived from `infra/docker/.env.example`):
```bash
export STORAGE_BACKEND=postgres
export HOT_STATE_BACKEND=redis
export EVENT_SINK_BACKEND=clickhouse
export DIAGNOSTIC_BACKEND=package
export POSTGRES_URL=postgres://soltrade:devpassword@127.0.0.1:5432/soltrade_dev
export REDIS_URL=redis://127.0.0.1:6379
export CLICKHOUSE_URL=http://127.0.0.1:8123
export CLICKHOUSE_DB=soltrade_dev CLICKHOUSE_USER=soltrade CLICKHOUSE_PASSWORD=devpassword
```
(PowerShell: `$env:STORAGE_BACKEND='postgres'` etc.)

## 4. Apply migrations
```bash
npm run db:postgres:migrate      # migrations/postgres/*.sql
npm run db:clickhouse:migrate    # migrations/clickhouse/*.sql (analytics_events)
```

## 5. Smoke each datastore (opt-in; safe, no transactions)
```bash
RUN_POSTGRES_SMOKE=1   npm run smoke:postgres     # connect + audit + decision-ledger + positions
RUN_REDIS_SMOKE=1      npm run smoke:redis        # lock/ttl + rate-limit + cursor + idempotency
RUN_CLICKHOUSE_SMOKE=1 npm run smoke:clickhouse   # ping + write + read-back analytics_events
RUN_FULL_STACK_SMOKE=1 npm run smoke:full-stack   # all three reachable + (optional) API endpoints
```
Each smoke **SKIPS cleanly (exit 0)** when its env is absent and is never part of `node --test`.

## 6. Run the server
```bash
node apps/server/src/index.mjs   # listens on http://127.0.0.1:8787 (SOLTRADE_PORT to override)
```
Boot is fail-open: if Redis/ClickHouse are unreachable the server still starts (cache/analytics
degrade; trading is unaffected).

## 7. Run the operator UI
- Served by the server once built: `cd apps/operator-ui && npm run build` → open http://127.0.0.1:8787
- Or dev mode with HMR: `cd apps/operator-ui && npm run dev` → open http://127.0.0.1:5173 (it calls the
  server on :8787).

## 8. Verify end-to-end (read-only)
```bash
curl -s http://127.0.0.1:8787/api/runtime/readiness  | jq    # capability status; monitoring only
curl -s -XPOST http://127.0.0.1:8787/api/diagnostics/run -H 'content-type: application/json' \
     -H 'x-soltrade-client: 1' -d '{}' | jq                  # pre-flight DiagnosticRun (never trades)
curl -s 'http://127.0.0.1:8787/api/analytics/summary?hours=24' | jq   # optional ClickHouse insights
```
- `runtime/readiness`: `storage.backend=postgres`, `hot_state.backend=redis`, `event_sink.backend=clickhouse`,
  `live_execution.status` becomes `available` once its config is complete (open-by-design).
- **Diagnostics page** (UI → "Diagnostics"): Runtime readiness card, Execution test, Provider test, and
  the Analytics insights card (counts + last events once events have been written).

## 9. Tear down
```bash
docker compose -f infra/docker/compose.yaml down            # add -v to also drop the volumes
```

## Notes
- Real-money trading stays the operator's decision and is configured separately; nothing in this runbook
  starts it, and no transaction is sent.
- To return to the zero-dependency defaults, unset the `*_BACKEND` vars (json / memory / none / legacy).
