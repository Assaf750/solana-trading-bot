# E2 Stage-5 / PR-S5-B — Wallet/Token Diagnostics (advisory) + Intelligence Health/Status Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends two
> read-only foundations to `@soltrade/wallet-token-intelligence-foundations`: **Wallet/Token Diagnostics** (Part F,
> advisory) and **Intelligence Health/Status** (Part G, aggregator). Both are pure, import-free, function-I/O-only,
> deterministic, fail-closed. **A diagnostic is advisory/read-only ONLY — never a gate, recommendation, signal,
> risk approval, intent, or auto-config.** No result opens signal/trading/risk/intent/routing readiness — including
> `INTELLIGENCE_READY_READ_ONLY`. **No network primitive, no live stream, no system clock, no persistence, no
> endpoint/secret, no dependency.** `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `6d2c65a` (branch `pr-s5-b-intel-diagnostics-health`, `main + 1`) · B1–B8 `DECIDED` ·
> aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/src/']` ·
> mechanism guard `sources=89 fixtures=27 allowlist=1 violations=0` · full suite **1047/1047**.

---

## 1. Wallet/Token Diagnostics (Part F)
- `describeWalletTokenDiagnosticsContract()` · `evaluateWalletTokenDiagnostics(input)`.
- States `DIAGNOSTICS_UNCONFIGURED` / `DIAGNOSTICS_INVALID` / `DIAGNOSTICS_READ_ONLY_OK`.
- Consumes prior **wallet/token/relationship observation results** (Parts C/D/E) passed in. Output `diagnostics` is a
  **frozen array of FIXED allowlisted tag strings only** from `INTEL_DIAGNOSTIC_TAGS`
  (`wallet_activity_observed`, `token_activity_observed`, `relationship_observed`, `mixed_event_types_observed`,
  `insufficient_observations`, `diagnostic_only`); any computed tag not in the allowlist is filtered out.
- **A diagnostic is advisory/read-only ONLY** — never a gate, recommendation, signal, risk approval, intent,
  execution priority, or auto-config; it **never** opens signal/trading/risk/intent/routing readiness. Wrong
  `purpose`, a smuggled forbidden trading flag (top-level or on any component), an execution/opportunity command, a
  secret field, or an endpoint/mainnet value → `DIAGNOSTICS_INVALID` (fail-closed); values never echoed.

## 2. Intelligence Health / Status (Part G)
- `describeIntelligenceHealthContract()` · `evaluateIntelligenceHealth(inputs)`.
- States `INTELLIGENCE_UNCONFIGURED` / `INTELLIGENCE_DEGRADED` / `INTELLIGENCE_READY_READ_ONLY` /
  `INTELLIGENCE_BLOCKED`. **Consumes** the wallet-observation + token-observation + relationship + diagnostics
  result objects. Fail-closed ordering: a smuggled forbidden trading flag on the top level or **any** component →
  `INTELLIGENCE_BLOCKED`; any component `*_INVALID` → `INTELLIGENCE_BLOCKED`; a missing/`null`-state component →
  `INTELLIGENCE_UNCONFIGURED`; any component `*_UNCONFIGURED` → `INTELLIGENCE_UNCONFIGURED`; **only** all-green
  (wallet READ_ONLY_OK + token READ_ONLY_OK + relationship READ_ONLY_OK + diagnostics READ_ONLY_OK) →
  `INTELLIGENCE_READY_READ_ONLY`; else `INTELLIGENCE_DEGRADED` (with degraded-component reasons).
- **`INTELLIGENCE_READY_READ_ONLY` is NOT signal/trading/risk/intent/routing readiness** — it is a read-only
  health/status only; `intelligence_ready_read_only:true` only for that state.

## 3. Read-only / not-signal / not-trading invariant
Every diagnostics/health result spreads the shared `intelSafeFlags()`: `read_only:true` and
`signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/`can_send`/`can_broadcast`/
`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/
`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`has_secret` = **false** — on **every** state,
including `DIAGNOSTICS_READ_ONLY_OK` and `INTELLIGENCE_READY_READ_ONLY`. No code path sets any true. The only echoed
values are the fixed allowlisted diagnostic-tag enum + fixed state/reason tokens — no input value is echoed.

## 4. Fail-closed / no-echo / hostile-input
All results `Object.freeze` of fixed literals; missing/unknown/wrong-purpose/smuggled-forbidden-flag/exec-or-
opportunity-command/secret/endpoint/mainnet input → fail-closed (`*_UNCONFIGURED`/`*_INVALID`/`INTELLIGENCE_BLOCKED`);
secret/endpoint values **never echoed**; both hostile-proxy variants (throwing-accessor and function-returning, via
the shared `intelUninspectable` guard + try/catch) → frozen `*_UNCONFIGURED` with `input_inspection_error`, **never
throws**. Forbidden opportunity/execution literals appear **only** in screening — never emitted. Reuses the
established `intelSafeFlags`/`intelScreen`/`intelHasForbiddenTrueFlag`/`intelUninspectable`/`INTEL_SAFE_REF_FIELD_NAMES`
helpers from PR-S5-A (no new screening surface).

## 5. Tests summary
Appended to `test/wallet-token-intelligence-foundations.test.mjs`: Part F (diagnostics) + Part G (intelligence
health) proofs incl. descriptors and static guards, built against **real** Part C/D/E component results.
**new-package suite 63/63 (36 prior + 27 new); data-ingestion-foundations 72/72; send-gate-contract 85/85; full
suite 1047/1047.** Independent main-loop behavioral spot-check: **19/19 PASS** (smoke matched the spec
`function DIAGNOSTICS_UNCONFIGURED true INTELLIGENCE_UNCONFIGURED false false`; covered safe-flags-false-on-every-
state incl. READ_ONLY_OK/READY, wrong-purpose→INVALID, smuggled-flag→INVALID/BLOCKED, advisory tags, READY only
when all-4-green and still no readiness, component-INVALID→BLOCKED, missing→UNCONFIGURED, degraded path, both
hostile-proxy variants→UNCONFIGURED-no-throw, secret/endpoint→INVALID-never-echoed).

## 6. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=89 fixtures=27 allowlist=1 violations=0` — **`sources` stays
89** (PR-S5-B appends to existing files; adds no new src file). SSOT drift **unchanged at baseline**
(`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30`).

## 7. No-live / no-signal / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no DB/Redis/Postgres/ClickHouse/persistence; no SDK/dependency; no endpoint/secret in
src/README; no signal/risk/intent/routing/paper-exec/signing/send/broadcast; no KMS/Vault/KeyManager; no private
key material; no mainnet; no REAL-LIVE.

## 8. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; diagnostics/health read-only states are **not** signal/trading/risk/intent/routing
readiness; `can_send:false` repo-wide unchanged.

---

**Confirmations:** Wallet/token diagnostics (advisory, fixed allowlisted tags only, never a gate/recommendation/
signal) · Intelligence health/status aggregator (consumes wallet/token/relationship/diagnostics, fail-closed) · No
result opens signal/trading/risk/intent/routing readiness (incl. `INTELLIGENCE_READY_READ_ONLY`) · No
observation→signal / diagnostic→buy-recommendation conversion · No network primitive · No live stream · No system
clock · No persistence · No dependency · No endpoint/secret in repo · No secret echoed · No signing/send/broadcast/
serialize · No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged ·
intelligence + data-ingestion + gate-a + rpc-provider + send-gate green.
