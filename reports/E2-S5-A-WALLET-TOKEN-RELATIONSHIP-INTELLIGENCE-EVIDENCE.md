# E2 Stage-5 / PR-S5-A — Wallet Observation + Token Observation + Wallet-Token Relationship Intelligence Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Creates the new
> **`@soltrade/wallet-token-intelligence-foundations`** package with three read-only intelligence foundations
> **derived from Stage-4 normalized ingestion events**: **Wallet Observation** (Part C), **Token Observation**
> (Part D), and **Wallet-Token Relationship** (Part E). All are pure, import-free, function-I/O-only, deterministic,
> fail-closed. **An observation is never a signal; a token diagnostic is never a buy recommendation.** No result
> opens signal/trading/risk/intent/routing readiness. **No network primitive, no live stream, no system clock, no
> persistence, no endpoint/secret, no dependency.** `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `6d86d89` (branch `pr-s5-a-wallet-token-relationship-intel`) · B1–B8 `DECIDED` ·
> aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/src/']` ·
> mechanism guard `sources=89 fixtures=27 allowlist=1 violations=0` · full suite **1020/1020**.

---

## 1. New package
`packages/wallet-token-intelligence-foundations/` — `package.json` (no dependencies), `src/index.{mjs,d.ts}`,
`src/wallet-token-intelligence-foundations.{mjs,d.ts}`, `test/…`, `README.md`. Import-free, pure, function-I/O-only.
The intelligence functions **consume Stage-4 normalized ingestion events passed in** (src import-free); the tests
build **real** normalized events via `data-ingestion-foundations`'s `normalizeIngestionEvent` (relative
cross-package import).

## 2. Wallet Observation Intelligence (Part C)
- `describeWalletObservationIntelligenceContract()` · `validateWalletObservationInput()` · `evaluateWalletObservationIntelligence()`.
- States `WALLET_OBS_UNCONFIGURED` / `WALLET_OBS_INVALID` / `WALLET_OBS_DEGRADED` / `WALLET_OBS_READ_ONLY_OK`.
- Output: `wallet_ref` (opaque), `observed_event_count`, `observed_swap_count`, `observed_mint_count`,
  `observed_balance_change_count`, `first_observed_ref`, `last_observed_ref`. A swap/mint observation **does not
  become a signal**; emits no buy/sell/copy signal, recommendation, intent, route, or priority.

## 3. Token Observation Intelligence (Part D)
- `describeTokenObservationIntelligenceContract()` · `validateTokenObservationInput()` · `evaluateTokenObservationIntelligence()`.
- States `TOKEN_OBS_*`. Output: `token_ref`, `observed_event_count`, `observed_mint_count`, `observed_pool_count`,
  `observed_swap_count`, `observed_wallet_count` (distinct wallet refs). A pool/mint observation **does not become
  opportunity execution**; an `accepted` field **does not open trading**; `buy_opportunity`/`execute_opportunity`/
  `submit_opportunity` are **refused**; no P&L, no price/stop-loss guarantee.

## 4. Wallet-Token Relationship (Part E)
- `describeWalletTokenRelationshipContract()` · `validateWalletTokenRelationshipInput()` · `evaluateWalletTokenRelationship()`.
- States `RELATIONSHIP_*`. Output: `wallet_ref`, `token_ref`, `relationship_event_count`,
  `observed_interaction_types` (sorted unique observed event-types), `first_seen_ref`, `last_seen_ref`. Repeated
  interactions **do not become a copy signal**; early observation **does not become an early-buyer signal**; emits
  no copy recommendation, leader signal, risk approval, intent, execution priority, or position open/close command.

## 5. Intelligence ≠ signal / trading readiness
Every wallet/token/relationship result spreads a shared `intelSafeFlags()`: `read_only:true` and
`signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`can_send`/`can_broadcast`/
`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/
`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`has_secret` = **false** — on **every** state,
including `*_READ_ONLY_OK`. No code path sets any true. The only echoed input is opaque `wallet_ref`/`token_ref`/
`*_ref` (screened) + fixed counts + the fixed observed-event-type enum + fixed reason tokens.

## 6. Fail-closed / no-echo / hostile-input
Missing/unknown/smuggled-forbidden-flag/exec-or-opportunity-command/secret/endpoint/mainnet input → fail-closed
(`*_UNCONFIGURED`/`*_INVALID`); a per-event forbidden indicator → `*_INVALID`; secret/endpoint values **never
echoed** (results are counts + state + fixed reason tokens); both hostile-proxy variants (throwing-accessor and
function-returning, via an `intelUninspectable` guard + try/catch) → frozen `*_UNCONFIGURED` with
`input_inspection_error`, **never throws**. Forbidden opportunity/execution literals
(`buy_opportunity`/`execute_opportunity`/`submit_opportunity`/…) appear **only** in the refusal list — never
emitted.

## 7. Tests summary
New `test/wallet-token-intelligence-foundations.test.mjs` — 36 proofs (W1–W11, T1–T9, R1–R9, descriptors, static
guards), built against **real** Stage-4 normalized events. **new-package suite 36/36; data-ingestion-foundations
72/72; send-gate-contract 85/85; full suite 1020/1020.** Independent main-loop behavioral spot-check: 20/20 PASS.

## 8. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=89 fixtures=27 allowlist=1 violations=0` — **`sources` rose
87 → 89** (the two new package src files); `allowlist=1`/`violations=0` unchanged. SSOT drift **unchanged at
baseline**.

## 9. No-live / no-signal / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no DB/Redis/Postgres/ClickHouse/persistence; no SDK/dependency; no endpoint/secret in
src/README; no signal/risk/intent/routing/paper-exec/signing/send/broadcast; no KMS/Vault/KeyManager; no private
key material; no mainnet; no REAL-LIVE.

## 10. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; intelligence read-only state is **not** signal/trading/risk/intent/routing readiness;
`can_send:false` repo-wide unchanged.

---

**Confirmations:** New `wallet-token-intelligence-foundations` package · Wallet/Token observation + Wallet-Token
relationship intelligence (read-only, derived from Stage-4 ingestion, summaries only) · An observation never
becomes a signal; a token diagnostic never a buy recommendation · No result opens signal/trading/risk/intent/
routing readiness · No data→signal conversion · No network primitive · No live stream · No system clock · No
persistence · No dependency · No endpoint/secret in repo · No secret echoed · No signing/send/broadcast/serialize
· No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged · data-ingestion
+ gate-a + rpc-provider + send-gate green.
