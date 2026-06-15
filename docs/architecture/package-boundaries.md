# Package Boundaries — Mechanism Injection Rule

- **Status:** Adopted (ADR-0001 Phase 3A)
- **Date:** 2026-06-15
- **Enforced by:** `tools/check-mechanism-guards.mjs` (mechanism rules) + `test/architecture/package-boundary.test.mjs` (layering + confinement). Both run under `node --test`.
- **Origin:** formalized after Phase 2D, where extracting provider calls into `packages/provider-adapters` collided with the mechanism guard. The resolution — keep the logic in the package, inject the mechanism — is now the standing rule.

## The rule

1. **`packages/*` are the pure domain kernel.** They contain domain/adapter **logic** only: decisions, state machines, validation, pure mapping, and *interfaces*. They are deterministic and side-effect-free by default.
2. **`apps/server` owns runtime mechanisms.** Network (`fetch`/`WebSocket`), filesystem, process/boot wiring, secrets/vault, and the composition root live in `apps/server`.
3. **`services/*` own external-runtime mechanisms.** Out-of-process boundaries (Rust signer/executor, Node gRPC ingestor, Python analytics) own their own transports.
4. **Packages may define interfaces and accept injected mechanisms.** A package declares what it needs (e.g. `request`, `wsFactory`, `grpcIngestorFactory`, `b58decode`, `readJson`/`writeJson`, a db client) as constructor/factory parameters; the impure layer supplies the real implementation.
5. **Packages may NOT import `apps/*` or `services/*`.** Dependency direction is one-way: `apps → packages`, never the reverse, and never `packages → services`.
6. **Packages may NOT directly import/use live mechanisms:** `node:crypto`, `node:fs`, `fetch(`, `new WebSocket(`, provider SDKs (`@solana/*`, `@jup-ag/*`, or specifiers matching `jupiter|helius|jito`), crypto-signing libs (`bs58`, `ed25519`, `@noble/*`, `tweetnacl`), HTTP clients (`axios`/`node-fetch`/`undici`/`got`/`superagent`), `node:net|http|https|dgram|tls`, or db drivers (`pg`/`postgres`/`clickhouse`/`@clickhouse/*`/`redis`/`ioredis`). Also no `.serialize(` / `Keypair`/`fromSecretKey`/`fromSeed`/`generateKeyPair` / `KeyManager` / `.query(`/`createPool` / `activate_real_live(`.
7. **One carve-out only.** `packages/isolated-signer-runtime/src/` is the single allowlisted path (governance `DR-E2-B8-001`), exempt from the live-mechanism checks (it uses `node:crypto` webcrypto) — but key material in source stays hard-forbidden even there. `ALLOWLIST.length === 1`; adding a path requires a separate governance decision.

## Why

Two parallel worlds (running `apps/server` vs. designed `packages/*`) were the core problem ADR-0001 fixes. If packages could reach for mechanisms directly, they would (a) drift back into impure, hard-to-test, hard-to-wire code, and (b) re-create the coupling. Keeping packages pure makes them the trustworthy single source of truth for logic, trivially unit-testable, and swappable across runtimes (the same `decision-ledger`/`positions` logic runs over a JSON adapter today and Postgres tomorrow with no logic change).

## Storage-planning note (Phase 4 — Postgres / Redis / ClickHouse)

The storage phase MUST use **dependency injection** for db clients — the same pattern as `provider-adapters` (transport injection) and `decision-ledger`/`positions` (`readJson`/`writeJson` injection):

- **`packages/storage`** defines repository **interfaces** and **pure mapping** (row ⇄ domain entity) only.
- **`apps/server`** creates the actual `pg` / `redis` / `clickhouse` clients (those imports + `.query(`/`createPool` live in `apps/server`, which is not guard-scanned).
- The clients are **passed into** `packages/storage` at construction.
- **No db-driver import inside `packages/storage`.** A `import pg from 'pg'` or a `.query(` there fails the guard.

## How it's enforced

- `tools/check-mechanism-guards.mjs` scans `packages/*/src/**/*.mjs` for forbidden imports + code mechanisms + fixture secrets (Layers A/B/C).
- `test/architecture/package-boundary.test.mjs` re-runs the guard and adds the layering/confinement assertions (no `apps`/`services` imports, `node:crypto`/`node:fs` confinement, no provider-SDK/db-driver imports, single allowlist).
- Both are part of the green-guard; a violation fails `node --test`.
