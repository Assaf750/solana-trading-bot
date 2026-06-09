# @soltrade/data-ingestion-foundations

Stage-4 Data Ingestion Foundation core — **read-only / replay-mock only**.

This package is import-free, function-I/O-only, pure, and deterministic. It performs
**no network call, no live stream, no system clock read, and no file/DB/Redis/persistence**.
It never sends, broadcasts, serializes, or signs anything, and it introduces no dependency.
Every result is a frozen object of fixed literals + whitelisted opaque refs + counts +
fixed reason tokens. Hostile or throwing input returns a frozen refusal with reason
`input_inspection_error` and never throws.

Ingestion events are **OBSERVATIONS ONLY** — never signals, never trade intents. No result
opens trading, signal, risk, or routing readiness; every result carries the safe-flag
attestations (`trading_ready:false`, `can_send:false`, `is_live:false`, `real_live:false`, …).

## Ingestion Source Descriptor (read-only, metadata-only)

A source is a **TAG**, never a live endpoint: `mock_replay`, `fixture_replay`,
`helius_laserstream_disabled`, `triton_yellowstone_disabled`, `rpc_read_only_reference`.
The Helius/Triton tags are accepted **only** as disabled/read-only (`live_stream_enabled:false`).
No endpoint URL, secret, or credential is accepted or echoed; any such input fails closed
with a fixed reason token. `source_ref` is echoed back only when valid and only as one of the
known fixed tags — never an endpoint. No network; opens no trading readiness.

- `describeIngestionSourceDescriptorContract()`
- `validateIngestionSourceDescriptor(input)`
- `evaluateIngestionSourceBoundary(input)` → `INGESTION_SOURCE_UNCONFIGURED` /
  `INGESTION_SOURCE_INVALID` / `INGESTION_SOURCE_READ_ONLY_OK`

## Normalized Ingestion Event Envelope (observations only)

Normalizes a raw fixture event into an envelope that copies **only** whitelisted opaque refs
(`event_ref`, `source_ref`, `observed_at_ref`, `event_type`, `wallet_ref`, `token_ref`,
`signature_ref`, `slot_ref`). No secret, endpoint, private key, or execution command is ever
copied. Supported observation types: `wallet_transaction_observed`,
`token_account_change_observed`, `swap_observed`, `mint_observed`, `pool_observed`,
`balance_change_observed`. An accepted/interesting event is **not** an execution intent — these
are observations only, never signals or trade intents. No network; no live stream; no secret;
no trading readiness.

- `describeNormalizedIngestionEventContract()`
- `validateNormalizedIngestionEvent(rawEvent)`
- `normalizeIngestionEvent(rawEvent)`

## Replay / Mock Ingestion Harness (read-only, fixtures only)

Reads **only** fixture event objects passed as a function argument — no file, env, network,
WebSocket, live stream, or persistence. The batch envelope must attest `purpose:
'replay_ingestion_batch'`, a `mock_replay`/`fixture_replay` `source_ref`, and all required
read-only attestations (`read_only`, `no_network`, `no_live_stream`, `no_send`, `no_broadcast`,
`no_sign`, `no_mainnet`, `no_real_live`). Each event is normalized via the envelope above and
the result reports **counts only** (normalized / invalid / quarantined / duplicate) plus a
state and fixed reason tokens — no event payload values beyond the whitelisted opaque refs are
ever echoed. A valid batch is read-only only and opens **no** trading/signal/risk/routing
readiness. States: `REPLAY_BATCH_UNCONFIGURED` / `REPLAY_BATCH_INVALID` / `REPLAY_BATCH_DEGRADED`
/ `REPLAY_BATCH_READ_ONLY_OK`.

- `describeReplayIngestionHarnessContract()`
- `validateReplayIngestionBatch(input)`
- `evaluateReplayIngestionBatch(input)`

## Ingestion Dedupe / Idempotency (read-only, deterministic)

A **pure, deterministic** function over a list of opaque `event_refs` (plus optional
`prior_seen_refs`). It performs **no DB/Redis/ClickHouse/PostgreSQL/filesystem/network/persistence**
and reads **no system clock**. The input envelope must attest `purpose: 'ingestion_dedupe'` and
carry an `event_refs` array; forbidden trading flags, execution commands, secret-named fields, and
endpoint/mainnet values all fail closed with fixed reason tokens. The result reports **counts only**
(`accepted_count` / `duplicate_count` / `quarantined_count`) — ref *values* are never echoed, only
counts, the state, and fixed tokens. `persistence_performed` is **always false**: dedupe never
persists anything. A dedupe result opens **no** trading readiness and keeps `read_only:true` with all
trading/signal/risk/routing flags false. States: `DEDUPE_UNCONFIGURED` / `DEDUPE_INVALID` /
`DEDUPE_DEGRADED` / `DEDUPE_OK`.

- `describeIngestionDedupeContract()`
- `evaluateIngestionDedupe(input)`

## Ingestion Cursor / Checkpoint (read-only, no persistence)

A **pure, deterministic** function over opaque cursor refs plus an **explicit deterministic
age/staleness parameter** (`is_stale`, or `age_ms`/`max_age_ms`) — there is **no system clock read**.
It performs **no DB/filesystem/network/persistence**. The input must attest `purpose:
'ingestion_cursor'` and carry a non-empty `current_cursor_ref`; forbidden trading flags, execution
commands, secret-named fields, and endpoint/mainnet values fail closed. `next_cursor_ref` echoes
**only** an opaque cursor ref already validated free of URL/secret/mainnet. A cursor **never
authorizes a live stream** (`live_stream_enabled:false`), and a valid **checkpoint never implies
persistence** (`persistence_performed:false` always). A cursor result opens **no** trading readiness.
States: `CURSOR_UNCONFIGURED` / `CURSOR_INVALID` / `CURSOR_VALID` / `CURSOR_STALE`.

- `describeIngestionCursorContract()`
- `evaluateIngestionCursor(input)`

## Ingestion Health / Status (read-only aggregator)

A read-only aggregator that **consumes** the source-descriptor boundary result, the replay-batch
result, the dedupe result, and the cursor result, then derives an ingestion operational state. It
performs **no network/clock/persistence** and never echoes any endpoint/secret or input value. Any
forbidden trading flag, or any live-stream/network/mainnet indicator smuggled as `true` on a
component, forces `INGESTION_BLOCKED`. Even `INGESTION_REPLAY_READY` opens **no**
trading/signal/risk/routing readiness — replay-ready is not trading/signal/risk/routing readiness.
States: `INGESTION_UNCONFIGURED` / `INGESTION_DEGRADED` / `INGESTION_REPLAY_READY` /
`INGESTION_BLOCKED` / `INGESTION_STALE`.

- `describeIngestionHealthContract()`
- `evaluateIngestionHealth(inputs)`
