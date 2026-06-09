# E2 Stage-6 / PR-S6-A — Signal Input Boundary + Wallet-led + Token-Activity Candidate Signals Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/signal-engine-foundations`** package with the first three read-only/advisory `signal`-layer
> foundations **derived from Stage-5 intelligence results**: **Signal Input Boundary** (Part C), **Wallet-led
> Candidate Signal** (Part D), and **Token Activity Candidate Signal** (Part E). All are pure, import-free,
> function-I/O-only, deterministic, fail-closed. **A candidate signal is NOT a buy order, NOT a copy permission, NOT
> trading readiness, NOT risk approval, NOT an intent, NOT a route** — it is advisory/read-only ONLY. **No network
> primitive, no live stream, no system clock, no persistence, no endpoint/secret, no dependency.** `can_send:false`
> repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `8f5058a` (branch `pr-s6-a-signal-input-boundary-candidates`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=91 fixtures=27 allowlist=1
> violations=0` · full suite **1096/1096** · signal-engine-foundations **49/49**.

---

## 1. New package
`packages/signal-engine-foundations/` — `package.json` (no dependencies), `src/index.{mjs,d.ts}`,
`src/signal-engine-foundations.{mjs,d.ts}`, `test/signal-engine-foundations.test.mjs`, `README.md`. Import-free,
pure, function-I/O-only; results are `Object.freeze` of fixed literals + whitelisted opaque refs + counts/buckets +
fixed string-token reason codes. The signal functions **consume Stage-5 intelligence results passed in** (src
import-free); the tests build **real** Stage-5 results via the `wallet-token-intelligence-foundations` evaluators
(which themselves consume `data-ingestion-foundations`'s `normalizeIngestionEvent`).

## 2. Signal Input Boundary (Part C)
- `describeSignalInputBoundaryContract()` · `validateSignalInputBoundary()` · `evaluateSignalInputBoundary()`.
- States `SIGNAL_INPUT_UNCONFIGURED` / `SIGNAL_INPUT_INVALID` / `SIGNAL_INPUT_DEGRADED` / `SIGNAL_INPUT_VALID`.
- Verifies signal input comes **only from Stage-5 intelligence outputs** (wallet/token observation + relationship +
  diagnostics + intelligence health), each recognized by its `*_state` field and carrying `read_only:true` — **not
  raw events, endpoints, or trading commands**. Output: `input_boundary_valid`, `eligible_for_candidate_signal`,
  `signal_input_state`, `read_only:true`, `advisory_only:true`. A **raw ingestion event** passed directly →
  `raw_ingestion_event_refused` → `SIGNAL_INPUT_INVALID`. An `INTELLIGENCE_BLOCKED`/component-`*_INVALID` health →
  INVALID. Only all-present + read-only + `INTELLIGENCE_READY_READ_ONLY` → `SIGNAL_INPUT_VALID` with
  `eligible_for_candidate_signal:true` (still no readiness flags).

## 3. Wallet-led Candidate Signal (Part D)
- `describeWalletLedCandidateSignalContract()` · `validateWalletLedSignalInput()` · `evaluateWalletLedCandidateSignal()`.
- States `WALLET_LED_UNCONFIGURED` / `_INVALID` / `_SUPPRESSED` / `_CANDIDATE`. Output: `candidate_signal_valid`,
  `candidate_signal_state`, `signal_kind:'wallet_led_candidate'`, `wallet_ref`, `token_ref`, `reason_codes`
  (allowlist: `wallet_activity_observed` · `wallet_token_relationship_observed` · `repeat_interaction_observed` ·
  `sufficient_observation_density` · `insufficient_observations`), `explanation_refs`, `confidence_bucket`
  (`none`/`low`/`medium`/`high` — descriptive only, **never a trade size, slippage, stop-loss, or numeric score**).
  Insufficient observations → `WALLET_LED_SUPPRESSED`. A smuggled buy/sell/copy/execute/order key → `WALLET_LED_INVALID`.
  **No buy/sell/copy order, no intent, no route, no execution priority, no position command, no trade size.**

## 4. Token Activity Candidate Signal (Part E)
- `describeTokenActivityCandidateSignalContract()` · `validateTokenActivitySignalInput()` · `evaluateTokenActivityCandidateSignal()`.
- States `TOKEN_ACTIVITY_UNCONFIGURED` / `_INVALID` / `_SUPPRESSED` / `_CANDIDATE`. Output: `candidate_signal_valid`,
  `candidate_signal_state`, `signal_kind:'token_activity_candidate'`, `token_ref`, `reason_codes` (allowlist:
  `token_activity_observed` · `pool_observed` · `mint_observed` · `multi_wallet_activity_observed` ·
  `insufficient_token_observations`), `confidence_bucket`. A mint/pool observation **never becomes a buy
  opportunity**; `buy_opportunity`/`execute_opportunity`/`submit_opportunity` keys → `TOKEN_ACTIVITY_INVALID`; an
  `accepted:true` field **opens no execution** (ignored, never echoed, all flags stay false).

## 5. Candidate signal ≠ trading readiness
Every boundary/wallet-led/token-activity result spreads a shared `sigSafeFlags()`: `read_only:true` and
`signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`can_send`/`can_broadcast`/
`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/
`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`has_secret` = **false** — on **every** state,
including `SIGNAL_INPUT_VALID`, `WALLET_LED_CANDIDATE`, and `TOKEN_ACTIVITY_CANDIDATE`. **`signal_ready` stays
false** — "a candidate signal exists" is carried only by `candidate_signal_valid` / `candidate_signal_state` /
`eligible_for_candidate_signal`, never by an execution/readiness flag. No code path sets any true. **No
signal→intent / signal→route / signal→order / signal→copy-execution conversion.**

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/unknown/raw-event/smuggled-forbidden-flag/exec-or-opportunity-command/
secret/endpoint/mainnet input → fail-closed (`*_UNCONFIGURED`/`*_INVALID`); secret/endpoint values **never echoed**
(results are state + fixed reason/allowlist tokens + opaque refs); both hostile-proxy variants (throwing-accessor
and function-returning, via a `sigUninspectable` guard + try/catch) → frozen `*_UNCONFIGURED` with
`input_inspection_error`, **never throws**.

## 7. Tests summary
New `test/signal-engine-foundations.test.mjs` — 49 proofs built against **real** Stage-5 intelligence results,
covering every required Stage-6 Parts-C/D/E test: missing input → fail-closed · invalid intelligence health →
fail-closed · valid read-only intelligence → boundary valid only · raw ingestion event → refused · smuggled
risk/intent/route/trading flags → refused · endpoint/API key/secret/token → refused & never echoed ·
mainnet/REAL-LIVE → refused · hostile input (throwing + function-returning proxy) → frozen, no throw · insufficient
observations → suppressed · valid wallet-led/token-activity → candidate advisory only · candidate opens no
trading/intent/routing/can_send · `buy_opportunity`/`execute_opportunity`/`submit_opportunity` refused ·
`accepted:true` opens no execution · descriptors · static guards (import-free, no `can_send:true`, zero deps).
**signal-engine-foundations 49/49; full suite 1096/1096** (1047 + 49). Independent main-loop behavioral
spot-check: **15/15 PASS** (real Stage-5 inputs).

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=91 fixtures=27 allowlist=1 violations=0` — **`sources` rose
89 → 91** (the two new package src `.mjs` files); `allowlist=1`/`violations=0` unchanged. SSOT drift **unchanged at
baseline** (`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13
forbidden=30`). No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract identifiers.

## 9. No-live / no-signal-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no DB/Redis/Postgres/ClickHouse/persistence; no SDK/dependency; no endpoint/secret in
src/README; no risk engine / intent ledger / route planning / Jupiter / paper execution / position lifecycle; no
signing/send/broadcast/serialize; no KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 10. Readiness impact
None — a candidate-signal / boundary-valid state is **not** trading/risk/intent/routing readiness; the pipeline
(`data → signal → risk → …`) is advanced only into the read-only/advisory `signal` foundation; `can_send:false`
repo-wide unchanged.

---

**Confirmations:** New `signal-engine-foundations` package · Signal input boundary (Stage-5-only, raw events
refused) · Wallet-led + token-activity candidate signals (advisory, allowlisted reason codes, descriptive
confidence bucket) · A candidate signal is not a buy order / copy permission / trading readiness / risk approval /
intent / route · No signal→intent/route/order/copy-execution conversion · No network primitive · No live stream ·
No system clock · No persistence · No dependency · No endpoint/secret in repo · No secret echoed · No
signing/send/broadcast/serialize · No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged ·
`can_send:false` unchanged · intelligence + data-ingestion + gate-a + rpc-provider + send-gate green.
