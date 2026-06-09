# E2 Stage-8 / PR-S8-B — Intent State Machine + Audit Envelope + Suppression/Rejection + Health Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends four
> read-only/advisory `intent`-layer foundations to `@soltrade/intent-ledger-foundations`: **Intent State Machine**
> (Part F), **Intent Audit Envelope** (Part G), **Intent Suppression / Rejection** (Part H), and **Intent Health /
> Status** (Part I). All are pure, import-free, function-I/O-only, deterministic, fail-closed
> (Fail-Safe-Not-Fail-Open), and consume PRIOR intent results (candidate record + ledger append + audit +
> suppression + state). **An intent state/audit/health is an AUDITABLE REPRESENTATION ONLY — NOT an order, NOT a
> route, NOT a transaction, NOT a signing permission, NOT a send permission. Even `INTENT_AWAITING_ROUTE_REVIEW`
> does NOT mean a route is ready or executed — it only marks that a later stage (Stage 9) MAY review a route. The
> audit envelope carries NO secret/key material. Suppression creates NO route/order.** No network primitive, no
> persistence/DB, no live stream, no system clock, no endpoint/secret, no dependency. `can_send:false` repo-wide
> unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `21676a1` (branch `pr-s8-b-state-audit-suppression-health`, `main + 1`) ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=95 fixtures=27 allowlist=1
> violations=0` (append-only — `sources` stays 95) · full suite **1280/1280** · intent-ledger-foundations **75/75**.

---

## 1. Intent State Machine (Part F)
- `describeIntentStateMachineContract()` · `evaluateIntentStateTransition(input)`.
- States `INTENT_UNCONFIGURED` / `INTENT_CANDIDATE_RECORDED` / `INTENT_REJECTED` / `INTENT_SUPPRESSED` /
  `INTENT_BLOCKED` / `INTENT_AWAITING_ROUTE_REVIEW`. Output: `intent_state`, `awaiting_route_review`. Transitions:
  missing → `INTENT_UNCONFIGURED`; invalid/smuggled → `INTENT_BLOCKED`; valid candidate (or `record`) →
  `INTENT_CANDIDATE_RECORDED`; rejection → `INTENT_REJECTED`; suppression → `INTENT_SUPPRESSED`;
  `request_route_review` on a recorded candidate → `INTENT_AWAITING_ROUTE_REVIEW`. **CRITICAL:
  `INTENT_AWAITING_ROUTE_REVIEW` keeps all 20 readiness/exec flags false (`routing_ready`/`route_ready`/
  `transaction_ready`/`can_send` false) — it does NOT mean a route is ready or executed.**

## 2. Intent Audit Envelope (Part G)
- `describeIntentAuditEnvelopeContract()` · `validateIntentAuditEnvelope()` · `evaluateIntentAuditEnvelope()`.
- States `INTENT_AUDIT_UNCONFIGURED` / `INTENT_AUDIT_INVALID` / `INTENT_AUDIT_VALID`. Output: `intent_audit_valid`,
  `audit_state`, `audit_required:true`, `audit_complete`. Every candidate intent must be **auditable, without
  secrets**: missing audit input → `UNCONFIGURED`; missing `reason_codes`/`decision_ref`/`intent_record_ref`/
  `actor_ref` → `INTENT_AUDIT_INVALID` (refused — **no hidden decision, no missing reason**); any
  secret/private-key/seed/signer-credential/auth-token/endpoint material → `INTENT_AUDIT_INVALID` and **never
  echoed**; smuggled execution/forbidden flag → `INVALID`; complete + clean → `INTENT_AUDIT_VALID`. Output carries
  only opaque refs + fixed reason codes + state — **no `private_key`/`seed`/`signer_credential`/`auth_token`/
  `endpoint`/`raw_wallet_secret`.**

## 3. Intent Suppression / Rejection (Part H)
- `describeIntentSuppressionContract()` · `evaluateIntentSuppression()`.
- Output: `suppressed`, `suppression_reasons` (allowlist). `suppression_reasons` allowlist (ONLY these):
  `risk_not_passed` · `audit_missing` · `candidate_intent_invalid` · `duplicate_intent_record` ·
  `route_not_reviewed` · `not_route_authorized` · `not_order_authorized` · `not_sign_authorized` ·
  `not_send_authorized` · `not_execution_authorized`. The five `not_*_authorized` are always present when emitting —
  **an intent is never route/order/sign/send/execution authorized at this layer.** Missing/invalid candidate, risk
  not `RISK_PASS_ADVISORY`, audit not `INTENT_AUDIT_VALID`, duplicate ledger record, or `route_reviewed !== true` →
  suppressed. **An advisory-valid intent (candidate recorded + risk pass + audit valid + not duplicate) is STILL
  suppressed for routing/sign/send** (`route_not_reviewed` + the `not_*_authorized` reasons) — it never progresses
  to routing/sign/send at this layer. **Suppression opens no `routing_ready`/`route_ready`/`signing_permitted`/
  `can_send` and creates no route/order.**

## 4. Intent Health / Status (Part I)
- `describeIntentHealthContract()` · `evaluateIntentHealth()`.
- **Consumes** intent input boundary + candidate intent + ledger append + intent state + audit + suppression. States
  `INTENT_HEALTH_UNCONFIGURED` / `_DEGRADED` / `_CANDIDATE_RECORDED` / `_AWAITING_ROUTE_REVIEW` / `_SUPPRESSED` /
  `_BLOCKED`. Fail-closed ordering: smuggled forbidden flag (top-level or any component) / secret / mainnet /
  REAL-LIVE / invalid intent input boundary / invalid audit → `INTENT_HEALTH_BLOCKED`; missing required component →
  `INTENT_HEALTH_UNCONFIGURED`; `suppression.suppressed` → `INTENT_HEALTH_SUPPRESSED`; state
  `INTENT_AWAITING_ROUTE_REVIEW` → `INTENT_HEALTH_AWAITING_ROUTE_REVIEW`; recorded candidate + audit valid + not
  suppressed → `INTENT_HEALTH_CANDIDATE_RECORDED`; else `INTENT_HEALTH_DEGRADED`. **Every state keeps all 20 flags
  false; `INTENT_HEALTH_AWAITING_ROUTE_REVIEW` opens no routing/route/transaction/can_send.**

## 5. Auditable representation / not order/route/tx/sign/send invariant
Every Part F/G/H/I result spreads the existing shared `intentSafeFlags()` (reused unchanged from PR-S8-A):
`read_only:true` and the 20 flags `signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/
`route_ready`/`order_ready`/`transaction_ready`/`can_send`/`can_broadcast`/`can_serialize`/`signing_permitted`/
`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/`live_stream_enabled`/`network_call_made`/
`endpoint_resolved`/`has_secret` = **false** — on **every** state, including `INTENT_CANDIDATE_RECORDED`,
`INTENT_AWAITING_ROUTE_REVIEW`, `INTENT_AUDIT_VALID`, and `INTENT_HEALTH_AWAITING_ROUTE_REVIEW`.
`intent_ready`/`route_ready`/`order_ready`/`transaction_ready` **stay false**. No output contains an
`order_id`/`route_id`/`transaction_id`/`serialized_tx`/`signature`/`quote`/`jupiter_route` field, nor any
`private_key`/`seed`/`signer_credential`/`auth_token`/`endpoint`. **No intent → route / order / transaction /
signing / send / trading-readiness conversion.**

## 6. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/invalid/smuggled-forbidden-flag/exec-command/secret/key/endpoint/mainnet
input → fail-closed (`*_UNCONFIGURED` / `*_INVALID` / `*_BLOCKED` / suppressed); secret/key/endpoint/mainnet values
**never echoed** (outputs are state + fixed allowlist/reason tokens + opaque refs); both hostile-proxy variants
(throwing-accessor and function-returning, via the reused `intentUninspectable` guard + try/catch) → frozen
`*_UNCONFIGURED`, **never throws**.

## 7. Append-only / helper reuse
Appended to the existing `intent-ledger-foundations.mjs`/`.d.ts`/README/test — **no new src file** (mechanism guard
`sources` stays 95); existing functions and the shared `intentSafeFlags`/`intentScreen`/`intentUninspectable`/
`INTENT_*` helpers are reused **unmodified** (git diff shows zero deletions in the src `.mjs`); no module-level
mutable state introduced. Exactly 4 files differ vs main. (The shared one-level-deep input-screening model from
PR-S8-A is reused unchanged: a forbidden flag/secret buried inside an arbitrary *extra* top-level object that is not
a recognized component slot is not flagged BLOCKED — but even then **no readiness/exec flag flips true and no secret
is echoed**, so no mechanism opens and no secret leaks; documented, not a regression.)

## 8. Tests summary
Appended to `test/intent-ledger-foundations.test.mjs` (state-machine, audit-envelope, suppression, health,
descriptors, static guards), built against **real** prior intent results over the real Stage-7 risk chain.
**intent-ledger-foundations 75/75 (37 prior + 38 new); full suite 1280/1280** (1242 + 38). Independent main-loop
behavioral spot-check: **20/20 PASS** (state UNCONFIGURED/CANDIDATE_RECORDED/REJECTED/AWAITING_ROUTE_REVIEW-all-
flags-false; audit VALID/INVALID-missing-decision/secret-INVALID-never-echoed; suppression advisory-valid-still-
suppressed-with-not_*_authorized/risk-not-passed; health UNCONFIGURED/BLOCKED-on-invalid-boundary-or-audit/
AWAITING-all-flags-false/smuggled-flag-&-secret-&-mainnet→BLOCKED-never-echoed; hostile proxies frozen).

## 9. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=95 fixtures=27 allowlist=1 violations=0` — **`sources` stays
95** (append, no new src file). SSOT drift **unchanged at baseline**
(`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30`).
No new SSOT/API/CONFIG/DATA name; no SSOT intent vocabulary introduced; pre-existing `packages/intent-ledger`
untouched.

## 10. No-live / no-execution / no-persistence / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no DB/Redis/Postgres/ClickHouse/filesystem/persistence; no mutable module/global
state; no SDK/dependency; no endpoint/secret in src/README; no routing/Jupiter/route planning/quote; no transaction
build/serialization; no order; no paper execution / position lifecycle; no signing/send/broadcast; no
KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 11. Readiness impact
None — intent state/audit/suppression/health states are **not** route/order/transaction/signing/send/trading
readiness; `INTENT_AWAITING_ROUTE_REVIEW` is a read-only marker, not route readiness; the pipeline
(`data → signal → risk → intent → route → …`) is advanced only within the read-only/advisory `intent` foundation;
`can_send:false` repo-wide unchanged.

---

**Confirmations:** Intent state machine (`INTENT_AWAITING_ROUTE_REVIEW` opens no routing/route/transaction/can_send)
· Intent audit envelope (no secret/key material; missing reason/decision refused; never echoed) · Intent
suppression/rejection (reasons only; advisory-valid intent still not progressed; creates no route/order; always
`not_route/order/sign/send/execution_authorized`) · Intent health/status (consumes boundary+candidate+ledger+state+
audit+suppression; `AWAITING_ROUTE_REVIEW` advisory-only) · No intent→route/order/transaction/signing/send
conversion · Append-only (sources stays 95) · No network primitive · No persistence/DB · No live stream · No system
clock · No dependency · No endpoint/secret in repo · No secret echoed · No signing/send/broadcast/serialize · No
mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged · `can_send:false` unchanged · prior intent + risk +
signal + intelligence + ingestion + gate-a + rpc-provider + send-gate green.
