# E2 Stage-4 / PR-S4-B — Ingestion Dedupe/Idempotency + Cursor/Checkpoint + Ingestion Health/Status Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends three
> read-only foundations to `@soltrade/data-ingestion-foundations`: **Dedupe/Idempotency** (Part F1), **Cursor/
> Checkpoint** (Part F2), and **Ingestion Health/Status** (Part G). All are pure, import-free, function-I/O-only,
> deterministic, fail-closed. **No DB/Redis/ClickHouse/PostgreSQL/filesystem/network/persistence, no system clock,
> no dependency.** A cursor **never** authorizes a live stream; a checkpoint **never** implies persistence
> (`persistence_performed:false` always). No result opens trading/signal/risk/routing readiness. `can_send:false`
> repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `59842a2` (branch `pr-s4-b-ingestion-dedupe-cursor-health`) · B1–B8 `DECIDED` ·
> aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/src/']` ·
> mechanism guard `sources=87 fixtures=27 allowlist=1 violations=0` · full suite **984/984**.

---

## 1. Dedupe / Idempotency (Part F1)
- `describeIngestionDedupeContract()` · `evaluateIngestionDedupe(input)`.
- States `DEDUPE_UNCONFIGURED` / `DEDUPE_INVALID` / `DEDUPE_DEGRADED` / `DEDUPE_OK`. Pure function over a list of
  opaque `event_refs` (+ optional `prior_seen_refs`); returns **counts only** (`accepted_count`/`duplicate_count`/
  `quarantined_count`). Duplicate refs (within batch or in prior-seen) counted; empty/non-string refs quarantined
  (→ `DEDUPE_DEGRADED`). Deterministic (counts depend only on input order). `persistence_performed:false` always.
  Smuggled trading flag / wrong purpose / non-array `event_refs` → `DEDUPE_INVALID` (fail-closed).

## 2. Cursor / Checkpoint (Part F2)
- `describeIngestionCursorContract()` · `evaluateIngestionCursor(input)`.
- States `CURSOR_UNCONFIGURED` / `CURSOR_INVALID` / `CURSOR_VALID` / `CURSOR_STALE`. Pure over opaque cursor refs +
  an **explicit deterministic** age/staleness param (`is_stale` / `age_ms` / `max_age_ms` — **no system clock**).
  `CURSOR_VALID` → `checkpoint_valid:true` + `next_cursor_ref` (opaque, screened); stale → `CURSOR_STALE`,
  `checkpoint_valid:false`. **A cursor never authorizes a live stream** (`live_stream_enabled:false` always); **a
  valid checkpoint never implies persistence** (`persistence_performed:false` always). Smuggled trading flag /
  secret / endpoint → `CURSOR_INVALID` & never echoed.

## 3. Ingestion Health / Status (Part G)
- `describeIngestionHealthContract()` · `evaluateIngestionHealth(inputs)`.
- States `INGESTION_UNCONFIGURED` / `INGESTION_DEGRADED` / `INGESTION_REPLAY_READY` / `INGESTION_BLOCKED` /
  `INGESTION_STALE`. **Consumes** the source-boundary + replay-batch + dedupe + cursor result objects. Fail-closed
  ordering: smuggled forbidden trading flag (top-level or any component) → `INGESTION_BLOCKED`; a component with
  `live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`mainnet_enabled`/`real_live` true →
  `INGESTION_BLOCKED`; any component `*_INVALID` → `INGESTION_BLOCKED`; missing/unconfigured component →
  `INGESTION_UNCONFIGURED`; stale cursor → `INGESTION_STALE`; **only** all-green (source READ_ONLY_OK + batch
  READ_ONLY_OK + dedupe OK + cursor VALID) → `INGESTION_REPLAY_READY`; else `INGESTION_DEGRADED`.

## 4. Read-only / not-trading invariant
Every dedupe/cursor/health result spreads the shared `ingSafeFlags()`: `read_only:true` and
`trading_ready`/`signal_ready`/`risk_ready`/`routing_ready`/`can_send`/`can_broadcast`/`can_serialize`/
`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/`live_stream_enabled`/
`network_call_made`/`endpoint_resolved` = **false** — on **every** state, **including** `INGESTION_REPLAY_READY` and
`CURSOR_VALID`. No code path sets any true. `ingestion_replay_ready:true` only for `INGESTION_REPLAY_READY`.

## 5. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/invalid/forbidden/secret/endpoint/live-stream input → fail-closed; values
never echoed (results are counts + state + fixed reason tokens; the only opaque echo is the cursor's
`next_cursor_ref`, already screened for URL/secret/mainnet); hostile/throwing input → frozen `*_UNCONFIGURED` with
`input_inspection_error`, **never throws**.

**Hostile-proxy hardening (added during pre-merge review):** the pre-merge verification surfaced that a Proxy whose
accessors return non-throwing **functions** (rather than throwing) caused dedupe/cursor to classify it as
`DEDUPE_INVALID`/`CURSOR_INVALID` (still fully fail-closed — frozen, no throw, no trading flags — but a different
status token than the throwing-accessor case). Per "fail-closed not fail-open" and for a consistent taxonomy, an
**uninspectable input** (a critical field of function type) now converges to `*_UNCONFIGURED` across dedupe, cursor,
and health — matching the throwing-accessor catch path. Real-data rule violations (e.g. a genuine smuggled
`can_send:true`) remain `*_INVALID`. Verified: both hostile-proxy variants → frozen `*_UNCONFIGURED`, no throw;
normal behavior and the 72/72 suite unchanged.

## 6. Tests summary
Appended to `test/data-ingestion-foundations.test.mjs`: F-D1–F-D8 (dedupe), F-C1–F-C8 (cursor), F-H1–F-H12 (health,
built from **real** Part C/D component results), G4–G6 descriptors, S5–S7 static guards.
**data-ingestion-foundations suite 72/72 (40 prior + 32 new); send-gate-contract 85/85 (continuity); full suite
984/984.** Independent main-loop behavioral spot-check: 19/19 PASS.

## 7. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=87 fixtures=27 allowlist=1 violations=0` — **`sources` stays
87** (PR-S4-B appends to existing files; adds no new src file). SSOT drift **unchanged at baseline**.

## 8. No-live / no-persistence / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no DB/Redis/ClickHouse/PostgreSQL/filesystem/persistence; no SDK/dependency; no endpoint/secret in
src/README; no send/broadcast/serialize/signing; no KMS/Vault/KeyManager; no private key material; no mainnet; no
REAL-LIVE.

## 9. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; `INGESTION_REPLAY_READY` is **not** trading/signal/risk/routing readiness;
`can_send:false` repo-wide unchanged.

---

**Confirmations:** Ingestion dedupe/idempotency (pure, deterministic, counts-only, persistence_performed:false) ·
Ingestion cursor/checkpoint (deterministic age, no clock, cursor never authorizes a live stream, checkpoint !=
persistence) · Ingestion health/status aggregator (consumes source+batch+dedupe+cursor, fail-closed) · No result
opens trading/signal/risk/routing readiness (incl. INGESTION_REPLAY_READY) · No DB/Redis/ClickHouse/PostgreSQL/
filesystem/persistence · No network primitive · No system clock · No dependency · No endpoint/secret in repo · No
secret echoed · No send/broadcast/serialize/signing · No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST
unchanged · `can_send:false` unchanged · send-gate green.
