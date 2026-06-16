# Deploy runbook (Phases Deploy-1 + Deploy-2)

A production-runnable Docker image: it builds the operator UI and runs `apps/server` (which also serves
the built UI). Postgres / Redis / ClickHouse stay **external** and are wired via env. Open-by-design: the
server starts on safe defaults (`json` / `memory` / `none`) and idles honestly until configured.

## Build

```bash
docker build -t soltrade .
```

Multi-stage (`Dockerfile`): stage 1 runs `npm ci` + `npm run build` for `apps/operator-ui`; stage 2
(`node:20-slim`) installs the root runtime deps (`pg` + `redis`, the only ones — pure JS), copies
`apps/server` + `packages` + `services/ingestor` + the built UI dist, and runs `node apps/server/src/index.mjs`.

CI validates this on every push/PR (`.github/workflows/ci.yml` → the `docker` job: `docker build`, no push).

## Publishing the image (GHCR)

`.github/workflows/publish.yml` builds + pushes to **GitHub Container Registry** on a version tag (`v*`) or
a **manual run** (Actions → "Publish image" → Run workflow). Auth is the built-in `GITHUB_TOKEN`
(`permissions: packages: write`) — **no repo secret is added**, and no app secret is baked into the image.

Tags pushed: `:sha-<commit>` (immutable — the rollback target), `:vX.Y.Z` (on a tag push), `:latest`
(default branch). Pull with:

```bash
docker pull ghcr.io/assaf750/solana-trading-bot:latest      # or :sha-<commit> to pin a deploy
```

(CI's `docker` job already proves the build; publish only adds the push. Trigger the first publish via the
Run-workflow button or a `v0.1.0` tag.)

## Run

Safe default (JSON store, in-memory hot-state, no analytics, in-process signer):

```bash
docker run -d --name soltrade -p 127.0.0.1:8787:8787 -v soltrade-data:/data soltrade
# → http://127.0.0.1:8787
```

Full stack (external Postgres / Redis / ClickHouse — run migrations first, see `local-full-stack.md`):

```bash
docker run -d --name soltrade -p 127.0.0.1:8787:8787 -v soltrade-data:/data \
  -e STORAGE_BACKEND=postgres   -e POSTGRES_URL=postgres://USER:PASS@HOST:5432/DB \
  -e HOT_STATE_BACKEND=redis    -e REDIS_URL=redis://HOST:6379 \
  -e EVENT_SINK_BACKEND=clickhouse -e CLICKHOUSE_URL=http://HOST:8123 \
  soltrade
```

All flags are documented in `docs/architecture/live-first-runtime-flags.md`. `POSTGRES_URL` etc. carry
credentials — pass them at **run** time (env / env-file / orchestrator secret), never baked into the image.

## Production deployment plan

Deploy the **published image** with external datastores; never bake secrets in. A ready-to-edit example is
`deploy/compose.prod.example.yml` (copy → `compose.prod.yml`, fill a local `.env`, then
`docker compose -f compose.prod.yml up -d`).

**Env matrix** (full reference: `live-first-runtime-flags.md`):

| Concern | Env | Notes |
|---|---|---|
| Bind / port | `SOLTRADE_HOST` (image `0.0.0.0`) · `SOLTRADE_PORT` (8787) | publish to `127.0.0.1` + reverse proxy |
| JSON store | `SOLTRADE_DATA_DIR` (`/data`) | mount a volume to persist |
| Operational SoT | `STORAGE_BACKEND=postgres` + `POSTGRES_URL` | run `db:postgres:migrate` first |
| Hot-state cache | `HOT_STATE_BACKEND=redis` + `REDIS_URL` | never SoT; fail-open |
| Analytics sink | `EVENT_SINK_BACKEND=clickhouse` + `CLICKHOUSE_URL` | run `db:clickhouse:migrate` first |
| Diagnostics | `DIAGNOSTIC_BACKEND` | on by default |
| Signer / executor | `HOT_EXECUTOR_BIN` | Rust hot-path execution owner (mount a linux binary; signs the whole executed bundle); else in-process fallback |

- **External datastores:** Postgres (operational SoT) / Redis (hot-state) / ClickHouse (analytics) are
  external — managed services or your own. Point the app at them via the `*_URL` env; run migrations before
  switching a backend on.
- **Reverse proxy / Host header:** see "Networking & the Host-header guard" below — publish to loopback and
  front with a proxy that sets `Host: localhost`.
- **Health / readiness:** the image ships a `HEALTHCHECK` (GET `/api/runtime/readiness` → 200). Externally,
  gate traffic on `GET /api/runtime/readiness` returning `200` with `read_only: true` and the expected
  `capability_status` (e.g. `storage: available`) — it is monitoring-only and never trades.
- **Rollback is image-tag based** (never a legacy code path): redeploy a previous immutable tag —
  `docker pull ghcr.io/assaf750/solana-trading-bot:sha-<previousCommit>` and restart. The data layer
  (Postgres / JSON / …) is unaffected by an app-image rollback; the image tag is the only rollback lever.

## Networking & the Host-header guard

- The image sets `SOLTRADE_HOST=0.0.0.0` so Docker port-forwarding reaches the server (it binds loopback
  by default outside Docker — `SOLTRADE_HOST` unset → `127.0.0.1`, unchanged for non-Docker runs).
- `apps/server` keeps its anti-DNS-rebinding **Host-header guard**: it only answers requests whose `Host`
  is `localhost` / `127.0.0.1` / `::1` (port stripped). So:
  - Publish the port to loopback (`-p 127.0.0.1:8787:8787`) and access via `http://127.0.0.1:8787`.
  - To expose it on a LAN / domain, front it with a reverse proxy that sets `Host: localhost`
    (e.g. nginx `proxy_set_header Host localhost;`). The guard is a security feature and is **unchanged**.

## Rust hot-executor (hot-path execution owner) — build or pass `HOT_EXECUTOR_BIN`

The Rust hot-executor is the **hot-path execution owner** (Phases Rust-3/Rust-4, expanding from the Phase
Rust-1 official signer) and is **network-free by design**: it signs **every leg of the executed bundle** (the
swap *and* the Jito tip leg via `sign_bundle`, Rust-3) and **assembles the submit + bundle request bodies**
(`build_submit` / `build_bundle`, Rust-4) — but the actual network POST (sendTransaction / Jito bundle),
retries, and intent-ledger idempotency stay in the JS control plane (which falls back to JS-built bodies if
the helper is absent). So the container needs **no extra network egress for the signer** — it only talks over
stdin/stdout. Rust expands as the execution owner one safe, tested step at a time; the only remaining step
(the POST itself) stays in JS until a measured latency win justifies moving it (see
`docs/architecture/legacy-audit.md` §22–§23).

The base image runs the in-process signer (fail-safe fallback); readiness shows
`signing_backend = not_configured`. To activate the official Rust signer, provide a **Linux** binary and
set `HOT_EXECUTOR_BIN`:

- **Option A — mount a prebuilt Linux binary** (build it on a Linux host or in a rust container; a Windows/
  macOS binary will NOT run in the linux image):
  ```bash
  # build a linux binary, then:
  docker run -d -p 127.0.0.1:8787:8787 -v soltrade-data:/data \
    -v /abs/host/hot-executor:/opt/hot-executor:ro -e HOT_EXECUTOR_BIN=/opt/hot-executor soltrade
  ```
- **Option B — extend the image** with a rust build stage (add to your own Dockerfile):
  ```dockerfile
  FROM rust:1-slim AS hot-executor-build
  WORKDIR /b
  COPY services/hot-executor ./
  RUN cargo build --release --locked
  # in the runtime stage:
  COPY --from=hot-executor-build /b/target/release/hot-executor /usr/local/bin/hot-executor
  ENV HOT_EXECUTOR_BIN=/usr/local/bin/hot-executor
  ```

Either way the live-executor prefers it when present and falls back to in-process on any failure
(Phase Rust-1) — so signing is never blocked.

## Still out of scope (after Deploy-2)

- **No app secrets** are ever baked into the image — creds/keys are run-time env / mounted secrets only.
- **No cloud-specific orchestration** — no Kubernetes/Nomad manifests or a managed-platform deploy step.
  The image + the GHCR publish workflow + `deploy/compose.prod.example.yml` give a Compose-based deploy
  path; a specific cloud target (and its secret store) is left to the operator.
- **No real Docker full-stack smoke in CI** — CI proves the image *builds* (and publish pushes it); run the
  live smoke per `local-full-stack.md` against real services before production.

## Reproduce CI locally

```bash
node --test                                                   # tests + architecture guards
cd apps/operator-ui && npm ci && npm run build && cd ../..     # UI build
cd services/hot-executor && cargo build --locked && cargo test && cd ../..  # Rust crate
docker build -t soltrade:ci .                                  # production image
```
