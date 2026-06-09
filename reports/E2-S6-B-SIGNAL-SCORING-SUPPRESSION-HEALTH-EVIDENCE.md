# E2 Stage-6 / PR-S6-B — Signal Scoring/Explanation + Suppression/Rejection + Signal Health/Status Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends three
> read-only/advisory `signal`-layer foundations to `@soltrade/signal-engine-foundations`: **Signal Scoring /
> Explanation** (Part F), **Signal Suppression / Rejection** (Part G), and **Signal Health / Status** (Part H).
> All are pure, import-free, function-I/O-only, deterministic, fail-closed, and consume PRIOR signal results
> (candidate signals + boundary + score + suppression). **Even `score_bucket='high'` is NOT a buy/copy/intent/route
> and opens no trading readiness. Suppression is NOT a risk engine — it is suppression BEFORE risk.
> `SIGNAL_READY_ADVISORY` is advisory read-only, not trading/risk/intent/routing readiness.** No network primitive,
> no live stream, no system clock, no persistence, no endpoint/secret, no dependency. `can_send:false` repo-wide
> unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `b789fbd` (branch `pr-s6-b-signal-scoring-suppression-health`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=91 fixtures=27 allowlist=1
> violations=0` (append-only — `sources` stays 91) · full suite **1135/1135** · signal-engine-foundations
> **88/88**.

---

## 1. Signal Scoring / Explanation (Part F)
- `describeCandidateSignalScoringContract()` · `evaluateCandidateSignalScore(input)`.
- Input `{ purpose:'candidate_signal_score_input', candidate_signals:[…wallet-led/token-activity candidate results], boundary (optional) }`.
- Output frozen `{ score_valid, score_bucket:'none'|'low'|'medium'|'high', explanation_codes:[…allowlist], suppression_reasons:[…allowlist], status, reasons:[…], advisory_only:true, read_only:true, …sigSafeFlags() }`.
- `score_bucket` is **descriptive only** (derived from count of valid candidates + their `confidence_bucket`) — **never a trade size, slippage, stop-loss, order, or numeric trading score.** No candidates → `'none'`; suppressed/invalid candidates → `'low'`/`'none'` with `suppression_reasons`; valid multiple candidates → a bucket only. **CRITICAL: even `score_bucket='high'` keeps `trading_ready`/`intent_ready`/`routing_ready`/`can_send`/`signal_ready` false.** `explanation_codes` allowlist: `wallet_led_candidate_present` · `token_activity_candidate_present` · `multiple_candidates_present` · `relationship_supported` · `sufficient_observation_density` · `no_candidates_present`.

## 2. Signal Suppression / Rejection (Part G)
- `describeSignalSuppressionContract()` · `evaluateSignalSuppression(input)`.
- Output frozen `{ suppressed, suppression_reasons:[…allowlist], status, reasons:[…], advisory_only:true, read_only:true, …sigSafeFlags() }`.
- `suppression_reasons` allowlist (ONLY these): `insufficient_observations` · `missing_wallet_context` · `missing_token_context` · `relationship_not_observed` · `diagnostic_only` · `not_risk_checked` · `not_intent_authorized` · `not_execution_authorized`. `not_risk_checked`/`not_intent_authorized`/`not_execution_authorized` are always present when emitting — **a signal is never risk-checked / intent-authorized / execution-authorized at this layer.** **This is NOT a risk engine; it is suppression BEFORE risk.** Missing wallet/token context → suppressed; diagnostic-only → suppressed. **Suppression opens NO `risk_ready`/`intent_ready`/`trading_ready` (all stay false).**

## 3. Signal Health / Status (Part H)
- `describeSignalHealthContract()` · `evaluateSignalHealth(inputs)`.
- **Consumes** the signal input boundary + candidate signals + score + suppression result objects. States
  `SIGNAL_UNCONFIGURED` / `SIGNAL_DEGRADED` / `SIGNAL_READY_ADVISORY` / `SIGNAL_SUPPRESSED` / `SIGNAL_BLOCKED`.
  Output frozen `{ valid:(state!==SIGNAL_BLOCKED), signal_state, signal_ready_advisory:(state===SIGNAL_READY_ADVISORY), status, reasons:[…], advisory_only:true, read_only:true, …sigSafeFlags() }`.
- Fail-closed ordering: smuggled forbidden trading flag (top-level or any component) / secret / mainnet / REAL-LIVE /
  invalid `signal_input_boundary` → `SIGNAL_BLOCKED`; missing required component → `SIGNAL_UNCONFIGURED`;
  `suppression.suppressed` or all candidates suppressed → `SIGNAL_SUPPRESSED`; boundary VALID + ≥1 valid candidate +
  score not `'none'` + not suppressed → `SIGNAL_READY_ADVISORY`; else `SIGNAL_DEGRADED`. **`SIGNAL_READY_ADVISORY`
  is advisory read-only — NOT trading/risk/intent/routing readiness.**

## 4. Advisory / not-trading invariant
Every Part F/G/H result spreads the existing shared `sigSafeFlags()` (reused unchanged from PR-S6-A):
`read_only:true` and `signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`can_send`/
`can_broadcast`/`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/
`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`has_secret` = **false** — on **every** state,
including `score_bucket='high'`, `SIGNAL_READY_ADVISORY`, and any non-suppressed result. `signal_ready` **stays
false**. No output contains a trade size / slippage / stop-loss / order field. **No score/signal → intent / route /
order / copy-execution / trading-readiness conversion.**

## 5. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/invalid/smuggled-forbidden-flag/exec-command/secret/endpoint/mainnet input
→ fail-closed (`*_UNCONFIGURED` / `*_INVALID` / `SIGNAL_BLOCKED`); secret/endpoint/mainnet values **never echoed**
(outputs are state + fixed allowlist/reason tokens, filtered via `.includes()` against frozen allowlists); both
hostile-proxy variants (throwing-accessor and function-returning, via the reused `sigUninspectable` guard +
try/catch) → frozen `*_UNCONFIGURED` with `input_inspection_error`, **never throws**.

## 6. Append-only / helper reuse
Appended to the existing `signal-engine-foundations.mjs`/`.d.ts`/README/test — **no new src file** (so mechanism
guard `sources` stays 91); existing functions and the shared `sigSafeFlags`/`sigScreen`/`sigUninspectable`/`SIG_*`
helpers are reused **unmodified**. Exactly 4 files differ vs main.

## 7. Tests summary
Appended to `test/signal-engine-foundations.test.mjs` (F1–F12 scoring, SU1–SU11 suppression, HE1–HE12 health,
descriptors, static guards), built against **real** prior signal results (Part C/D/E evaluators over real Stage-5
intelligence). **signal-engine-foundations 88/88 (49 prior + 39 new); full suite 1135/1135** (1096 + 39).
Independent main-loop behavioral spot-check: **15/15 PASS** (score none/bucket + no trade fields + flags false;
suppression missing-context + `not_risk_checked` + risk flags false; health UNCONFIGURED/BLOCKED/READY_ADVISORY/
SUPPRESSED; smuggled trading-flag & secret/mainnet → BLOCKED never echoed; hostile proxies frozen).

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=91 fixtures=27 allowlist=1 violations=0` — **`sources` stays
91** (append, no new src file). SSOT drift **unchanged at baseline**
(`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30`).
No new SSOT/API/CONFIG/DATA name — all identifiers are local function-I/O contract identifiers.

## 9. No-live / no-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no DB/Redis/Postgres/ClickHouse/persistence; no SDK/dependency; no endpoint/secret in
src/README; no risk engine / intent ledger / route planning / Jupiter / paper execution / position lifecycle; no
signing/send/broadcast/serialize; no KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 10. Readiness impact
None — score/suppression/health states are **not** trading/risk/intent/routing readiness; the pipeline
(`data → signal → risk → …`) is advanced only within the read-only/advisory `signal` foundation; `can_send:false`
repo-wide unchanged.

---

**Confirmations:** Signal scoring/explanation (descriptive `score_bucket` only; `high` ≠ buy/copy/intent; no
trade-size/slippage/order field) · Signal suppression/rejection (reasons only; NOT a risk engine; suppression
before risk; opens no risk/intent/trading readiness) · Signal health/status (consumes boundary+candidates+score+
suppression; `SIGNAL_READY_ADVISORY` advisory-only) · No score/signal → intent/route/order/copy-execution
conversion · Append-only (sources stays 91) · No network primitive · No live stream · No system clock · No
persistence · No dependency · No endpoint/secret in repo · No secret echoed · No signing/send/broadcast/serialize ·
No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged · prior signal +
intelligence + ingestion + gate-a + rpc-provider + send-gate green.
