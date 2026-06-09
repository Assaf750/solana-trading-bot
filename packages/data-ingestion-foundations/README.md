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
