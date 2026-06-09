# E2 Stage-6 — Signal Engine Foundation Closure Evidence

> **DOC/REPORT-ONLY closure artifact.** Certifies that **Stage 6 — Signal Engine Foundation** is complete and
> merged into `main`: a **read-only / advisory / deterministic** `signal`-layer that produces **candidate signal
> representations** from Stage-5 intelligence — signal input boundary, wallet-led candidate, token-activity
> candidate, scoring/explanation, suppression/rejection, and signal health/status. **A candidate signal is NOT a
> buy order, NOT a copy permission, NOT trading readiness, NOT risk approval, NOT an intent, NOT a route. Even
> `score_bucket='high'` is not buy/copy/intent. Suppression is NOT a risk engine. `SIGNAL_READY_ADVISORY` is not
> trading readiness.** No code/runtime/contract change in this report; it records the closed state of
> `main @ b9344a5`.
>
> **State:** Stage 6 started from `main @ 8f5058a` (Stage 5 closed). Now `main @ b9344a5` ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=91 fixtures=27 allowlist=1
> violations=0` · full suite **1135/1135** · signal-engine-foundations **88/88** ·
> wallet-token-intelligence-foundations **63/63** · data-ingestion-foundations **72/72** · gate-a-foundations
> **60/60** · rpc-provider-contract **257/257** · send-gate-contract **85/85**.

---

## 1. Stage 6 started after Stage 5 was closed
Stage 6 began from `main @ 8f5058a` — the Stage-5 (Wallet/Token Intelligence Foundation) closure commit
(`reports/E2-STAGE-5-WALLET-TOKEN-INTELLIGENCE-FOUNDATION-CLOSURE-EVIDENCE.md`). Stage 5 delivered read-only
intelligence derived from Stage-4 normalized observations (wallet/token observation, relationship, diagnostics,
intelligence health) and proved an observation never becomes a signal. Stage 6 builds the **read-only/advisory
`signal` foundation that consumes Stage-5 intelligence results** — and advances the pipeline no further than
read-only candidate signals.

## 2. Stage-6 PRs (linear, fast-forward)
| PR | Commit | Title |
|---|---|---|
| PR-S6-A | `b789fbd` | Signal Input Boundary + Wallet-led + Token-activity candidate signals (read-only/advisory) |
| PR-S6-B | `b9344a5` | Signal Scoring/Explanation + Suppression/Rejection + Signal Health/Status (read-only/advisory) |

Each was built implementation-first via a multi-agent build workflow (implementation + build-test + security +
governance/scope + behavioral lenses + arbiter), verified in the main loop with an independent behavioral
spot-check, and merged `--ff-only` after a **separate** multi-agent pre-merge verification returned
`CLEAR_TO_MERGE` with 0 blockers; each carries its own evidence file (`reports/E2-S6-A-…md`, `reports/E2-S6-B-…md`).
Both PRs' build and pre-merge workflows returned GREEN/CLEAR_TO_MERGE with 0 blockers.

## 3. Signal Engine foundations present (new `@soltrade/signal-engine-foundations` package, 15 exports)
All foundations are pure, import-free, function-I/O-only, deterministic, fail-closed. Entry points verified present
in `src/signal-engine-foundations.mjs` (re-exported via `src/index.mjs`):

- **Signal Input Boundary** (Part C) — `describeSignalInputBoundaryContract` / `validateSignalInputBoundary` /
  `evaluateSignalInputBoundary`. States `SIGNAL_INPUT_UNCONFIGURED` / `_INVALID` / `_DEGRADED` / `_VALID`. Input must
  come **only from Stage-5 intelligence outputs**; a raw ingestion event / endpoint / command is refused
  (`raw_ingestion_event_refused`). `SIGNAL_INPUT_VALID` sets `eligible_for_candidate_signal` but **no readiness
  flag**.
- **Wallet-led Candidate Signal** (Part D) — `describeWalletLedCandidateSignalContract` /
  `validateWalletLedSignalInput` / `evaluateWalletLedCandidateSignal`. States `WALLET_LED_*`,
  `signal_kind:'wallet_led_candidate'`, allowlisted `reason_codes`, descriptive `confidence_bucket`. **Never a
  buy/sell/copy order, intent, route, execution priority, position command, or trade size.**
- **Token Activity Candidate Signal** (Part E) — `describeTokenActivityCandidateSignalContract` /
  `validateTokenActivitySignalInput` / `evaluateTokenActivityCandidateSignal`. States `TOKEN_ACTIVITY_*`,
  `signal_kind:'token_activity_candidate'`. A mint/pool observation never becomes a buy opportunity;
  `buy_opportunity`/`execute_opportunity`/`submit_opportunity` refused; `accepted:true` opens no execution.
- **Signal Scoring / Explanation** (Part F) — `describeCandidateSignalScoringContract` /
  `evaluateCandidateSignalScore`. `score_bucket:'none'|'low'|'medium'|'high'` (descriptive only) + allowlisted
  `explanation_codes`. **Even `score_bucket='high'` is not buy/copy/intent and opens no trading/intent/route/
  can_send; no trade-size/slippage/order field.**
- **Signal Suppression / Rejection** (Part G) — `describeSignalSuppressionContract` / `evaluateSignalSuppression`.
  Allowlisted `suppression_reasons` (incl. always-present `not_risk_checked` / `not_intent_authorized` /
  `not_execution_authorized`). **This is NOT a risk engine — it is suppression BEFORE risk; it opens no
  risk/intent/trading readiness.**
- **Signal Health / Status** (Part H) — `describeSignalHealthContract` / `evaluateSignalHealth`. **Consumes** the
  boundary + candidate signals + score + suppression results → `SIGNAL_UNCONFIGURED` / `SIGNAL_DEGRADED` /
  `SIGNAL_READY_ADVISORY` / `SIGNAL_SUPPRESSED` / `SIGNAL_BLOCKED`, fail-closed. **`SIGNAL_READY_ADVISORY` is
  advisory read-only — not trading/risk/intent/routing readiness.**

The signal functions consume Stage-5 intelligence results **passed in** (src import-free); the tests build **real**
Stage-5 results via the `wallet-token-intelligence-foundations` evaluators (over `data-ingestion-foundations`'s
`normalizeIngestionEvent`).

## 4. Everything read-only / advisory — never signal-execution / trading / risk readiness
Every boundary/candidate/score/suppression/health result spreads a shared `sigSafeFlags()`: `read_only:true` and
`signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`can_send`/`can_broadcast`/
`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/
`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`has_secret` = **false** — on **every** state,
including `SIGNAL_INPUT_VALID`, `WALLET_LED_CANDIDATE`, `TOKEN_ACTIVITY_CANDIDATE`, `score_bucket='high'`, and
`SIGNAL_READY_ADVISORY`. **`signal_ready` stays false** — "a candidate signal exists" is carried only by dedicated
fields (`candidate_signal_valid` / `candidate_signal_state` / `eligible_for_candidate_signal` / `score_bucket` /
`signal_ready_advisory`), never by an execution/readiness flag. No code path sets any true. **No signal/score →
intent / route / order / copy-execution / trading-readiness conversion.** A smuggled trading/live/mainnet flag,
secret, endpoint, execution/opportunity command, or raw event → fail-closed (`*_INVALID` / `SIGNAL_BLOCKED`); values
never echoed; hostile/throwing/uninspectable input → frozen `*_UNCONFIGURED`, never throws.

## 5. Stage-6 closure invariants (verified on `main @ b9344a5`)
| Invariant | Result |
|---|---|
| Signal input boundary present (Stage-5-only; raw events/endpoints/commands refused) | **PASS** |
| Wallet-led candidate signal present (advisory; never a buy/sell/copy order) | **PASS** |
| Token activity candidate signal present (advisory; buy/execute/submit_opportunity refused) | **PASS** |
| Signal scoring/explanation present (descriptive bucket; high ≠ buy/copy/intent) | **PASS** |
| Signal suppression/rejection present (reasons only; not a risk engine) | **PASS** |
| Signal health/status present (read-only aggregator, fail-closed) | **PASS** |
| Everything read-only/advisory; candidate signal not a trade order | **PASS** |
| score/high confidence is not buy/copy/intent; SIGNAL_READY_ADVISORY not trading readiness | **PASS** |
| No signal→intent / signal→route / signal→order / signal→copy-execution conversion | **PASS** |
| No risk engine / no intent ledger / no routing / no Jupiter introduced | **PASS** (none) |
| No paper execution / no position lifecycle / no transaction build / no serialization | **PASS** (none) |
| No live stream / no WebSocket / no network primitive in src | **PASS** (import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`) |
| No system clock / no persistence / no `process.env` / no `node:fs` | **PASS** |
| No endpoint URL / raw endpoint / API key / secret / token in repo | **PASS** (none; refused & never echoed) |
| No SDK / new dependency | **PASS** (`signal-engine-foundations` declares none) |
| No signing / send / broadcast / serialize | **PASS** (none) |
| No mainnet / no REAL-LIVE | **PASS** |
| `ALLOWLIST` unchanged | **PASS** — `Object.freeze(['packages/isolated-signer-runtime/src/'])` (single entry, line 121) |
| `can_send:false` unchanged | **PASS** — no `can_send: true` anywhere in `packages/*/src` |
| sibling packages green | **PASS** — intel 63/63 · ingestion 72/72 · gate-a 60/60 · rpc-provider 257/257 · send-gate 85/85 |
| mechanism guard | **PASS** — `sources=91 fixtures=27 allowlist=1 violations=0` (`sources` 89 → 91 = PR-S6-A's two new package src files; PR-S6-B appended, no new src file) |
| SSOT drift | **PASS / unchanged** — `core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30` |
| No new SSOT/API/CONFIG/DATA name | **PASS** — all identifiers are local function-I/O contract identifiers; `docs/01-SSOT.md` unchanged |
| full suite | **PASS** — 1135/1135 |

## 6. Stage 6 opens no risk / intent / routing / execution / live stream
Stage 6 delivered **only** read-only / advisory / deterministic signal foundations derived from Stage-5
intelligence. It does **not** open or enable: the risk engine, hard-risk gate implementation, an intent ledger,
trade intents, route planning, Jupiter, paper execution, position lifecycle, transaction build/serialization,
signing, send, broadcast, KMS/Vault, a live data stream, mainnet, or REAL-LIVE. A candidate signal, `score_bucket`,
`SIGNAL_READY_ADVISORY`, and `eligible_for_candidate_signal` are **advisory read-only — not trading/risk/intent/
routing readiness**. The pipeline order (`data → signal → risk → intent → route → sign → send`) is advanced only
into the read-only/advisory `signal` foundation.

## 7. Readiness posture (unchanged)
**NOT READY FOR RISK/INTENT/ROUTING/SEND/BROADCAST/REAL-LIVE**; `can_send:false` repo-wide; the signal layer grants
no execution authority.

## 8. Next stage (a separate, explicitly-approved decision — NOT started)
Stage 7 and beyond — the **Risk Engine** (the first consumer that would gate a candidate signal against Hard Risk /
EV before any intent), intent ledger, paper trading, routing (Jupiter), transaction build, signing, broadcast,
KMS/Vault, a live ingestion stream, mainnet, REAL-LIVE — are all out of scope and **not started**; each requires a
new, separate order. **No candidate signal / score / health output from Stage 6 grants any execution authority or
becomes an intent/route/order.**

---

**Stage-6 closure confirmation:** Signal Engine Foundation closed (`main @ b9344a5`) · signal input boundary +
wallet-led candidate + token-activity candidate + scoring/explanation + suppression/rejection + signal
health/status all present (15 exports) · everything read-only/advisory · a candidate signal is not a buy order /
copy permission / trading readiness / risk approval / intent / route · score/high not buy/copy/intent ·
SIGNAL_READY_ADVISORY not trading readiness · suppression is not a risk engine · no signal→intent/route/order/
copy-execution conversion · no risk engine · no intent · no routing · no Jupiter · no paper execution · no position
lifecycle · no transaction build · no serialization · no signing · no send/broadcast · no live stream · no network
primitive in src · no system clock · no persistence · no endpoint/secret · no SDK/dependency · no mainnet · no
REAL-LIVE · `ALLOWLIST` unchanged · `can_send:false` unchanged · intelligence + data-ingestion + gate-a +
rpc-provider + send-gate green · mechanism guard green · SSOT drift baseline unchanged · Stage 6 opens no
risk/intent/routing/execution/live-stream.
