# Deploy runbook (Phase Deploy-1)

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

## Networking & the Host-header guard

- The image sets `SOLTRADE_HOST=0.0.0.0` so Docker port-forwarding reaches the server (it binds loopback
  by default outside Docker — `SOLTRADE_HOST` unset → `127.0.0.1`, unchanged for non-Docker runs).
- `apps/server` keeps its anti-DNS-rebinding **Host-header guard**: it only answers requests whose `Host`
  is `localhost` / `127.0.0.1` / `::1` (port stripped). So:
  - Publish the port to loopback (`-p 127.0.0.1:8787:8787`) and access via `http://127.0.0.1:8787`.
  - To expose it on a LAN / domain, front it with a reverse proxy that sets `Host: localhost`
    (e.g. nginx `proxy_set_header Host localhost;`). The guard is a security feature and is **unchanged**.

## Rust hot-executor (official signer) — build or pass `HOT_EXECUTOR_BIN`

The Rust hot-executor is the official **signing** boundary and is **network-free by design** (Phase
Rust-2): it signs and builds pure payloads, but the actual network POST (sendTransaction / Jito bundle),
retries, and intent-ledger idempotency stay in the JS control plane. So the container needs **no extra
network egress for the signer** — it only signs over stdin/stdout.

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

## What Deploy-1 does NOT do (out of scope, by design)

- **No secrets** are baked into the image (creds/keys are run-time env / mounted secrets only).
- **No registry push** — the image is built locally / in CI but not published.
- **No cloud deploy** — there is no target environment, orchestrator manifest, or deploy step yet.
- **No real Docker full-stack smoke in CI** — CI only proves the image *builds*; run the live smoke per
  `local-full-stack.md` against real services before production.

## Reproduce CI locally

```bash
node --test                                                   # tests + architecture guards
cd apps/operator-ui && npm ci && npm run build && cd ../..     # UI build
cd services/hot-executor && cargo build --locked && cargo test && cd ../..  # Rust crate
docker build -t soltrade:ci .                                  # production image
```
