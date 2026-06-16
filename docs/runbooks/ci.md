# CI runbook (Phase CI-1)

`.github/workflows/ci.yml` runs on every `push` and `pull_request`. It upgraded the former
`node --test`-only check into a real pipeline that guards the Live-First refactor before the Rust
signing/execution boundary lands.

## What CI protects (blocking — all three jobs must pass)

| Job | Runs | Protects |
|---|---|---|
| **Tests + architecture guards** | `node --test`, then the smokes in skip-clean mode | Every unit/integration test **and** the architecture / package-boundary / mechanism-guard code-hygiene checks (they run inside the suite). Then `npm run smoke:{postgres,redis,clickhouse,full-stack}` must each load and **SKIP cleanly (exit 0)** with no env — catching a broken smoke import even though the smokes never touch live services. |
| **Operator UI build** | `npm ci` + `npm run build` (in `apps/operator-ui`) | The Vite production build of the operator console — a broken import, JSX error, or bad dependency fails here. |
| **Rust hot-executor** | `cargo build --locked` + `cargo test` (in `services/hot-executor`) | The latency-critical fee-payer-locked ed25519 signing crate (the future execution boundary). `--locked` keeps the build reproducible against the tracked `Cargo.lock`. |

The jobs are independent and run in parallel; any failure blocks the merge.

## package-lock policy (resolved)

- **`apps/operator-ui/package-lock.json` IS tracked** → the UI job uses **`npm ci`** (reproducible,
  cache-keyed on the lockfile). This is the one place a reproducible dependency tree matters (the bundle).
- **The root has NO tracked lockfile, by design.** The server (`apps/server`) and `packages/*` have
  **zero runtime dependencies for tests** — `pg` and `redis` are declared in the root `package.json` but
  are **dynamically imported only in `STORAGE_BACKEND=postgres` / `HOT_STATE_BACKEND=redis` runtime mode**,
  never during `node --test` or the smoke skip-checks. So the test job installs **nothing** and needs no
  root lockfile. (An untracked `package-lock.json` may appear locally after `npm install`; do not commit
  it.) If a future change adds a root *build/test-time* dependency, track the root lockfile and switch the
  test job to `npm ci` at that point.

## What stays MANUAL (not in CI)

- **Real Docker full-stack smoke** — bringing up live Postgres / Redis / ClickHouse and running
  `RUN_FULL_STACK_SMOKE=1 npm run smoke:full-stack` (+ the per-service smokes with real URLs). It needs
  real services, so CI only proves the smokes **skip-clean**; run the real smoke per
  `docs/runbooks/local-full-stack.md` before adopting a backend in production.
- **Deploy / image publish** — there is no deploy pipeline yet (a later phase).

## Notes

- The Rust job relies on the Rust toolchain pre-installed on `ubuntu-latest` (no setup action). If a
  runner lacks `cargo`, add a toolchain setup step.
- Node version is pinned to `20` for both Node jobs.
- To reproduce CI locally: `node --test` · `cd apps/operator-ui && npm ci && npm run build` ·
  `cd services/hot-executor && cargo build --locked && cargo test` · `npm run smoke:full-stack` (skips).
