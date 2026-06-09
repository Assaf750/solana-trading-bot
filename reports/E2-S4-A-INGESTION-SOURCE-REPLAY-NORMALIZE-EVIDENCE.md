# E2 Stage-4 / PR-S4-A — Ingestion Source Descriptor + Normalized Event Envelope + Replay/Mock Harness Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/data-ingestion-foundations`** package with the read-only data-ingestion core: **Source Descriptor**
> (Part C), **Normalized Event Envelope** (Part E), and **Replay/Mock Ingestion Harness** (Part D). All are pure,
> import-free, function-I/O-only, deterministic, fail-closed. **Read-only / replay-mock only: no network primitive,
> no live stream, no WebSocket, no system clock, no endpoint/secret in repo, no dependency.** Ingestion events are
> **observations only** — never signals, never trade intents — and no result opens trading/signal/risk/routing
> readiness. `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `874a851` (branch `pr-s4-a-ingestion-source-replay-normalize`) · B1–B8 `DECIDED` ·
> aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/src/']` ·
> mechanism guard `sources=87 fixtures=27 allowlist=1 violations=0` · full suite **952/952**.

---

## 1. New package
`packages/data-ingestion-foundations/` — `package.json` (no dependencies), `src/index.{mjs,d.ts}`,
`src/data-ingestion-foundations.{mjs,d.ts}`, `test/data-ingestion-foundations.test.mjs`, `README.md`. Import-free,
pure, function-I/O-only; results are `Object.freeze` of fixed literals + whitelisted opaque refs + counts.

## 2. Ingestion Source Descriptor (Part C)
- `describeIngestionSourceDescriptorContract()` · `validateIngestionSourceDescriptor()` · `evaluateIngestionSourceBoundary()`.
- States `INGESTION_SOURCE_UNCONFIGURED` / `INGESTION_SOURCE_INVALID` / `INGESTION_SOURCE_READ_ONLY_OK`.
- A source is a **TAG only** ∈ {`mock_replay`, `fixture_replay`, `helius_laserstream_disabled`,
  `triton_yellowstone_disabled`, `rpc_read_only_reference`} — never a live endpoint. Helius/Triton tags are accepted
  **only as disabled/read-only** (`live_stream_enabled:false`). Missing/unknown source, endpoint URL, secret,
  mainnet, or smuggled trading flag → fail-closed; values never echoed.

## 3. Normalized Event Envelope (Part E)
- `describeNormalizedIngestionEventContract()` · `validateNormalizedIngestionEvent()` · `normalizeIngestionEvent()`.
- Event types are **observations only**: `wallet_transaction_observed`, `token_account_change_observed`,
  `swap_observed`, `mint_observed`, `pool_observed`, `balance_change_observed`. An observation is **never** a signal
  or trade intent.
- The normalized envelope copies **only whitelisted opaque refs** (`event_ref`, `source_ref`, `observed_at_ref`,
  `event_type`, `wallet_ref`, `token_ref`, `signature_ref`, `slot_ref`) + `read_only:true`. A secret/endpoint/
  execution-command/mainnet field → event refused (not normalized) and **never echoed**.

## 4. Replay / Mock Ingestion Harness (Part D)
- `describeReplayIngestionHarnessContract()` · `validateReplayIngestionBatch()` · `evaluateReplayIngestionBatch()`.
- States `REPLAY_BATCH_UNCONFIGURED` / `REPLAY_BATCH_INVALID` / `REPLAY_BATCH_DEGRADED` / `REPLAY_BATCH_READ_ONLY_OK`.
- Reads **only** fixture event objects passed as a function argument — no file/env/network/WebSocket/live-stream/
  persistence. Requires the `read_only`/`no_network`/`no_live_stream`/`no_send`/`no_broadcast`/`no_sign`/`no_mainnet`/
  `no_real_live` attestations true. Normalizes each event and returns **counts only** (`normalized_count`,
  `invalid_count`, `quarantined_count`, `duplicate_count`); empty batch → `DEGRADED` (no readiness); malformed/
  unknown events → `DEGRADED` with counts; smuggled trading flag / secret / endpoint / non-fixture source →
  `REPLAY_BATCH_INVALID`. A valid batch is read-only only and opens no trading/signal/risk/routing readiness.

## 5. Defect found & fixed during build (transparent)
The build workflow's review phase hit an **infrastructure error** (the parallel review-lens agents did not emit
StructuredOutput), so it returned no GREEN/NEEDS_FIX — but the implement+test phases had produced the package, and
my own verification surfaced **8 failing package tests**: `normalizeIngestionEvent` rejected valid events because
the shared secret-field screen matched the legitimate **`token_ref`** field name (it contains the substring
"token", matching the secret pattern), which cascaded into the batch (DEGRADED instead of READ_ONLY_OK). This is
the same substring-collision class seen earlier. **Fix:** exempt the known **safe opaque-ref field names**
(`event_ref`/`source_ref`/`observed_at_ref`/`event_type`/`wallet_ref`/`token_ref`/`signature_ref`/`slot_ref`/
`batch_ref`/`descriptor_ref`/`purpose`) from the secret-**name** scan, while (a) still flagging real secret-named
fields (`api_key`/`secret`/`private_key`/`auth_token`/bare `token`/…) and (b) still URL/mainnet-scanning **every**
value (so a URL/secret smuggled into `token_ref` is still blocked & never echoed). After the fix: 40/40 package
tests, 952/952 full, and the no-echo/secret-blocking invariants verified intact.

## 6. Read-only / not-trading / not-signal invariant
Every source/normalize/batch result spreads a shared safe-flag set: `read_only:true` and
`trading_ready`/`signal_ready`/`risk_ready`/`routing_ready`/`can_send`/`can_broadcast`/`can_serialize`/
`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/`live_stream_enabled`/
`network_call_made`/`endpoint_resolved`/`has_secret` = **false**. No code path sets any true. Data does not become
signal; an observation does not become an execution intent.

## 7. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/unknown/secret/endpoint/mainnet/exec-command/forbidden-flag input →
fail-closed; secret/endpoint values never echoed; `evaluateReplayIngestionBatch` returns only counts + state +
fixed reason tokens; hostile/throwing input → frozen refusal (`input_inspection_error` / `normalized:false`),
never throws.

## 8. Tests summary
New `test/data-ingestion-foundations.test.mjs` — 40 proofs (source SD1–SD10, normalize N1–N12 + whitelist,
replay R1–R12, descriptors, static guards). **data-ingestion-foundations suite 40/40; send-gate-contract 85/85
(continuity); full suite 952/952.** Independent main-loop behavioral spot-check: 12/12 PASS.

## 9. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=87 fixtures=27 allowlist=1 violations=0` — **`sources` rose
85 → 87** (the two new package src files); `allowlist=1`/`violations=0` unchanged. SSOT drift **unchanged at
baseline**.

## 10. No-live / no-SDK / no-secret confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no SDK/dependency; no endpoint URL/secret in src/README; no send/broadcast/serialize/signing; no
KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 11. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; ingestion read-only state is **not** trading/signal/risk/routing readiness;
`can_send:false` repo-wide unchanged.

---

**Confirmations:** New `data-ingestion-foundations` package · Source descriptor (metadata-only, tags only, no
endpoint/secret) · Normalized event envelope (observations only, whitelist-copied refs, never signals/intents) ·
Replay/mock harness (fixtures only, no file/env/network/WebSocket/live-stream/persistence) · Read-only; no result
opens trading/signal/risk/routing readiness · No network primitive · No system clock · No dependency · No
endpoint/secret in repo · No secret echoed · No send/broadcast/serialize/signing · No mainnet · No REAL-LIVE · No
new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged · send-gate green.
