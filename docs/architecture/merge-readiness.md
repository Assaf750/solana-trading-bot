# Merge Readiness — `feat/live-first-unification` (ADR-0001 Phase 11A)

Final consistency review before merging the Live-First branch into `main`. **Merging changes no runtime
behavior**: every new backend is opt-in and the safe defaults (`json` / `memory` / `none` / `legacy`)
are unchanged, so a default deployment behaves exactly as before.

## Status
- **Branch:** `feat/live-first-unification` (last phase commit `c557989`, Phase 11A) — **promoted to
  `main` as the official baseline on 2026-06-16** (merge `--no-ff`, 25 phase commits).
- **Green guard:** full `node --test` green (**2253** passing, 0 failing); mechanism guard PASS;
  package-boundary, open-by-design, paper-as-readiness, backend-defaults, and docs-consistency guards all
  green; vite build green; all four smoke scripts SKIP without env.
- **External services:** never required for `node --test` (postgres/redis tests use mocks; smokes are
  opt-in and SKIP without env).

## Phases delivered (24 commits)
1 (contracts/SSOT) → 2A–2D (decision-ledger / positions / risk / provider extraction into pure
packages) → 3A (package-boundary hardening) → 4A (pure storage kernel) → 4B.1/4B.2/4B.3 + 4C (Postgres
operational SoT behind `STORAGE_BACKEND`, runtime-enabled) → 5A–5D (DiagnosticExecutionAdapter + API +
UI; Paper repositioned as simulation, Diagnostics is the testing entry) → 6A/6B/6C (Redis hot-state:
foundation, provider-health/readiness cache, idempotency keys) → 7A/7B/7C (ClickHouse analytics:
event-writer, non-critical event wiring, read/insights) → 8A→8A-R (runtime-readiness endpoint,
corrected to open-by-design) → 9A/9B (legacy audit + safe shim cleanup) → 10A (full-stack runbook +
smoke) → 11A (this review + flags reference + merge note).

## Known intentional leftovers (by design — NOT blockers)
- **Legacy shims — ALL REMOVED** (hard legacy purge complete): RISK (3B.2), PROVIDER (3B.4), POSITIONS +
  DECISION_LEDGER (3B-X). No `*_BACKEND=legacy` rollback flags remain; the `@soltrade/*` package paths are
  canonical and only (guarded by `apps/server/test/no-legacy-flags-guard.test.mjs`).
- **paper-engine kept** as the simulation / sandbox portfolio substrate (never a readiness tool).
- **JSON fallback kept** as the default operational store (snapshot / recovery).
- **Rust signing/exec boundary is the OFFICIAL signer** (Phase Rust-1) — `services/hot-executor` is
  preferred whenever configured (`HOT_EXECUTOR_BIN` set; `signer_backend` defaults to `rust`), with the
  in-process signer as the documented fail-safe fallback. Remaining: the operator builds + deploys the
  binary, and a future phase may extract more of the execution path into the crate.
- **Stream-cursor wiring deferred** — the ingestor is push-based gRPC with no durable polling cursor;
  the `getCursor`/`setCursor` capability is ready but unwired (would change ingestion behavior).
- **Unused-export pruning deferred** — needs a dead-code proof per export (Phase 3B).

## Invariants verified
- PostgreSQL = operational source of truth (when chosen); Redis = hot-state, never SoT; ClickHouse =
  analytics-only; JSON = default/fallback.
- Readiness = **monitoring only** (open-by-design); no artificial gates in API / UI / docs (guarded by
  tests).
- packages stay pure (no pg/redis/clickhouse/fetch/WebSocket/SDK); `apps/server` is the only mechanism
  host (mechanism + package-boundary guards green).
- Trading pipeline, risk, provider, and live-executor logic unchanged across all phases.

## Recommended merge strategy
1. Review + merge `feat/live-first-unification` into `main` (no behavior change at default settings).
2. Adopt backends incrementally in production via the flags in
   `docs/architecture/live-first-runtime-flags.md` (start `STORAGE_BACKEND=postgres`, then Redis, then
   ClickHouse), using `docs/runbooks/local-full-stack.md` to validate locally first.
3. ~~Schedule **Phase 3B** (legacy-shim pruning)~~ **DONE** — the legacy-shim purge completed across
   Phases 3B.1–3B.4 + the hard legacy purge (3B-X); all `*_BACKEND=legacy` rollback paths are removed.
   The Paper→Diagnostic checking-path migration is **DONE** (Phase 5E — Diagnostics is the only
   preflight/provider/execution/connectivity test path, on by default; `/api/providers/test-connection`
   retired). The `trading-engine` name/ownership split is **DONE** (Phase 5F — the runtime consumes
   `createTradingEngine`; paper-engine is the simulation/implementation substrate behind it; zero behavior
   change). Production CI hardening is **DONE** (Phase CI-1 — tests+guards / UI build / Rust crate jobs).
   The Rust signing/execution boundary is **DONE as the official signer** (Phase Rust-1 — preferred when
   configured, fail-safe in-process fallback, `signing_backend` readiness capability). The physical
   `packages/trading-engine` extraction is **BEGUN** (Phase Engine-2 — the pure package owns the lifecycle
   state machine + composition entry; apps/server composes by injecting the paper-engine substrate; zero
   behavior change). Dead-export pruning is **DONE** (Phase Clean-1 — the duplicate rpc-client stream
   helpers removed; coverage moved to the live package copies). **Remaining restructure work** (the
   authoritative list lives in `legacy-audit.md` §16): (1) the engine physical extraction is **in
   progress** — `packages/trading-engine` now owns the lifecycle state machine (Engine-2) and the
   leader-insights logic (Engine-3); remaining slices: supervisor loop / command lifecycle / fills /
   status() assembly (mechanism-bound — need rpc/jupiter/stores/liveExecutor injected); (2) deploy — the image
   build is **DONE** (Phase Deploy-1: Dockerfile + CI `docker` job + deploy runbook); registry push +
   cloud deploy remain; (3) Rust submit/bundle deepening — **DECIDED not now** (Phase Rust-2: the boundary
   stays at signing; the network POST stays in JS by design; the signer is kept network-free, guarded);
   (4) the `services/*` unused-scaffold audit is **DONE** (Phase Services-Audit: 13 empty placeholder dirs
   removed; `services/` = `hot-executor` + `ingestor` + `analytics`). Net open items: engine extraction
   slices, and deploy registry-push / cloud-deploy.
