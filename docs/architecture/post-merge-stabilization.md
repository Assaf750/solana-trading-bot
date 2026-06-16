# Post-Merge Stabilization — Live-First baseline

Verification pass on a fresh branch off `main` after Live-First Runtime Unification became the official
baseline. **No code changed** — no runtime error was found; this is a report-only commit. Defaults,
trading behavior, and legacy shims are all unchanged.

## Baseline
- **`main` commit:** `f8cd076` (`Merge: Live-First Runtime Unification becomes the main baseline (ADR-0001)`)
- **Tag:** `live-first-baseline`
- **Branch:** `feat/post-merge-stabilization` (from `main` @ `f8cd076`)
- **Date:** 2026-06-16

## Verification (from the fresh branch)
| Gate | Result |
|---|---|
| `node --test` (full) | **2253 passed / 0 failed** |
| mechanism guard | **PASS** — sources=144, fixtures=27, allowlist=1, violations=0 |
| package-boundary guard | green |
| open-by-design guard | green |
| backend-defaults guard | green |
| docs-consistency guard | green |
| (the four guards above, run together) | 25 passed / 0 failed |
| `vite build` (operator-ui) | green (built in ~0.6s) |
| `smoke:postgres` skip (no env) | SKIPPED, exit 0 |
| `smoke:redis` skip (no env) | SKIPPED, exit 0 |
| `smoke:clickhouse` skip (no env) | SKIPPED, exit 0 |
| `smoke:full-stack` skip (no env) | SKIPPED, exit 0 |

## Optional real docker smoke
- **NOT RUN** — the Docker daemon is unavailable in this environment
  (`dockerDesktopLinuxEngine` not running). The smoke scripts are verified via their opt-in skip path;
  run the live stack per `docs/runbooks/local-full-stack.md` once Docker is available:
  `docker compose -f infra/docker/compose.yaml up -d postgres redis clickhouse` → migrations →
  `RUN_*_SMOKE=1 npm run smoke:*` → `RUN_FULL_STACK_SMOKE=1 SOLTRADE_BASE_URL=http://127.0.0.1:8787 npm run smoke:full-stack`.

## Conclusion
Baseline is stable: full suite + all guards + vite build green; every external-service smoke is correctly
opt-in (no service is required for `node --test`). No operational error found, so no code was modified.

## Known follow-ups (NOT started here — by design)
- **Phase 3B** — prune legacy shims + unused exports after a production soak (defaults guarded by
  `backend-defaults.test.mjs`).
- **Rust signing/exec boundary** — deferred (ADR-0001 target).
- **Full Paper → Diagnostic engine migration** — Paper stays the simulation substrate until then.

References: `docs/architecture/merge-readiness.md`, `docs/architecture/live-first-runtime-flags.md`,
`docs/architecture/legacy-audit.md`, `docs/runbooks/local-full-stack.md`.
