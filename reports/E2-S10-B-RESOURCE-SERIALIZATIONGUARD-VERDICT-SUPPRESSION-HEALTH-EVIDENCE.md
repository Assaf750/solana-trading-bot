# E2 Stage-10 / PR-S10-B — Resource Advisory + Serialization Forbidden Surface Guard + Review Verdict + Suppression + Health Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Appends five
> read-only/advisory `transaction-build-review`-layer foundations to `@soltrade/transaction-build-review-foundations`:
> **Account/Instruction/Compute Budget Advisory** (Part F), **Serialization Forbidden Surface Guard** (Part G),
> **Transaction Build Review Verdict** (Part H), **Transaction Build Suppression/Rejection** (Part I), and
> **Transaction Build Health/Status** (Part J). All are pure, import-free, function-I/O-only, deterministic,
> fail-closed (Fail-Safe-Not-Fail-Open). **A resource advisory / serialization-surface result / review verdict /
> health is a READ-ONLY ADVISORY REPRESENTATION ONLY — NOT a transaction, NOT a serialized transaction, NOT message
> bytes, NOT a signing permission, NOT a send permission. Even `TX_BUILD_REVIEW_PASS_ADVISORY` and
> `TX_BUILD_HEALTH_REVIEWED_ADVISORY` do NOT open `transaction_ready`/`serialized_ready`/`message_bytes_ready`/
> `signing_permitted`/`can_serialize`/`can_send`. The serialization guard REDACTS forbidden values (`forbidden_field_ref`
> = field NAME only, never the value).** No real transaction build, no serialization, no message bytes, no signing,
> no send. `can_send:false` repo-wide unchanged; `ALLOWLIST` unchanged.
>
> **State:** built on `main` @ `c63ea8f` (branch `pr-s10-b-resource-serializationguard-verdict-suppression-health`,
> `main + 1`) · `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=99 fixtures=27
> allowlist=1 violations=0` (append-only — `sources` stays 99) · full suite **1427/1427** ·
> transaction-build-review-foundations **75/75**.

---

## 1. Account / Instruction / Compute Budget Advisory (Part F)
- `describeTransactionBuildResourceAdvisoryContract()` · `validateTransactionBuildResourceAdvisoryInput()` ·
  `evaluateTransactionBuildResourceAdvisory()`. States `TX_BUILD_RESOURCE_UNCONFIGURED` / `_INVALID` / `_DEGRADED` /
  `_REJECTED` / `_ACCEPTABLE_ADVISORY`. From **input buckets only** (spec-canonical: account/instruction/compute =
  `unknown`/`low`/`medium`/`high`/`too_high`; transaction_size = `unknown`/`small`/`medium`/`large`/`too_large`;
  lookup_table = `unknown`/`not_needed`/`maybe_needed`/`required_unresolved`). REJECTED on `too_high` accounts/
  instructions/compute / `too_large` size / `required_unresolved` lookup; DEGRADED on any `unknown` / `high` compute;
  `ACCEPTABLE_ADVISORY` only on the acceptable range. **Acceptable opens no transaction/serialize/sign/send; no
  transaction/message/instruction field.**

## 2. Serialization Forbidden Surface Guard (Part G)
- `describeSerializationForbiddenSurfaceContract()` · `evaluateSerializationForbiddenSurface()`. States
  `SERIALIZATION_SURFACE_UNCONFIGURED` / `_CLEAN` / `_BLOCKED`. Detects forbidden serialization/transaction artifact
  field names (`serialized_tx`/`serializedTransaction`/`message_bytes`/`messageBytes`/`base64_tx`/`base64Transaction`/
  `transaction`/`transaction_object`/`VersionedTransaction`/`TransactionMessage`/`MessageV0`/`signature`/
  `signatures`/`signer`/`private_key`/`secret_key`/`recentBlockhash`/`blockhash`/`feePayer`/`instruction_array`/
  `instructions`/`account_metas`/`lookup_table_accounts`/`broadcast_target`). Output: `serialization_artifact_detected`,
  `forbidden_field_detected`, **`forbidden_field_ref` = the matched field NAME only (REDACTED — NEVER the value)**.
  Clean object → `SERIALIZATION_SURFACE_CLEAN`; any forbidden field present → `SERIALIZATION_SURFACE_BLOCKED`.
  **Verified: a planted secret value in a forbidden field is NEVER present in the output (`JSON.stringify` check).**
  The detection booleans `serialization_artifact_detected`/`forbidden_field_detected` are **detection outputs** (true
  = blocked) — they are NOT readiness/exec flags and are not in `TX_FORBIDDEN_TRUE_FLAGS`.

## 3. Transaction Build Review Verdict (Part H)
- `describeTransactionBuildReviewVerdictContract()` · `evaluateTransactionBuildReviewVerdict()`. **Consumes** input
  boundary + source + descriptor + resource advisory + serialization guard. States `TX_BUILD_REVIEW_UNCONFIGURED` /
  `_DEGRADED` / `_BLOCKED` / `_PASS_ADVISORY`. Output: `tx_build_review_state`, `tx_build_review_passed_advisory`,
  `tx_build_blocked`, `tx_build_reason_codes`, `tx_build_explanation_codes`. Serialization-blocked / any component
  invalid / non-PREVIEW-ready inputs / resource REJECTED → `BLOCKED`; missing component → `UNCONFIGURED`; degraded →
  `DEGRADED`; all clean → `PASS_ADVISORY`. Reason/explanation codes from fixed allowlists — **contain no
  tx/message/sign/send artifact tokens**. **Even `TX_BUILD_REVIEW_PASS_ADVISORY` opens no transaction_ready/
  serialized_ready/signing_permitted/can_serialize/can_send.**

## 4. Transaction Build Suppression / Rejection (Part I)
- `describeTransactionBuildSuppressionContract()` · `evaluateTransactionBuildSuppression()`. Output: `suppressed`,
  `suppression_reasons` (allowlist incl. always-present `not_serialization_authorized` / `not_sign_authorized` /
  `not_send_authorized` / `not_execution_authorized`). Invalid boundary/source, missing descriptor, REJECTED
  resources, or a serialization artifact → suppressed (with the matching reason). **An advisory-clean tx-build review
  is STILL suppressed for serialize/sign/send (the `not_*_authorized` reasons). Suppression opens no
  `transaction_ready`/`can_serialize`/`signing_permitted`/`can_send` and creates no transaction.**

## 5. Transaction Build Health / Status (Part J)
- `describeTransactionBuildHealthContract()` · `evaluateTransactionBuildHealth()`. **Consumes** input boundary +
  source + descriptor + resource advisory + serialization guard + verdict + suppression. States
  `TX_BUILD_HEALTH_UNCONFIGURED` / `_DEGRADED` / `_REVIEWED_ADVISORY` / `_SUPPRESSED` / `_BLOCKED`. Fail-closed:
  smuggled flag/secret/mainnet/REAL-LIVE / invalid boundary/source / serialization-blocked / verdict-blocked →
  `BLOCKED`; missing → `UNCONFIGURED`; suppressed → `SUPPRESSED`; verdict pass + not suppressed → `REVIEWED_ADVISORY`;
  else `DEGRADED`. **Every state keeps all 23 flags false; `TX_BUILD_HEALTH_REVIEWED_ADVISORY` opens no
  transaction/serialize/sign/send.**

## 6. Advisory / not-transaction/serialization/sign/send invariant
Every Part F/G/H/I/J result spreads the existing shared `txSafeFlags()` (reused unchanged from PR-S10-A):
`read_only:true` and the 23 flags `signal_ready`/`trading_ready`/`risk_ready`/`intent_ready`/`routing_ready`/
`route_ready`/`order_ready`/`transaction_ready`/`serialized_ready`/`message_bytes_ready`/`can_send`/`can_broadcast`/
`can_serialize`/`signing_permitted`/`broadcast_permitted`/`is_live`/`mainnet_enabled`/`real_live`/
`live_stream_enabled`/`network_call_made`/`endpoint_resolved`/`live_quote_enabled`/`has_secret` = **false** — on
**every** state, including `TX_BUILD_RESOURCE_ACCEPTABLE_ADVISORY`, `SERIALIZATION_SURFACE_CLEAN`/`_BLOCKED`,
`TX_BUILD_REVIEW_PASS_ADVISORY`, and `TX_BUILD_HEALTH_REVIEWED_ADVISORY`. No output carries a real
transaction/serialization/signature artifact field. **No tx-build-review → transaction / serialization / signing /
send / trading-readiness conversion.**

## 7. Fail-closed / no-echo / hostile-input
All results frozen/fixed-literal; missing/invalid/smuggled-forbidden-flag/exec-command/secret/endpoint/mainnet/
serialization-artifact input → fail-closed (`*_UNCONFIGURED` / `*_INVALID` / `*_BLOCKED` / suppressed);
secret/endpoint/mainnet/forbidden-artifact **values never echoed** (the serialization guard emits only the redacted
field NAME); both hostile-proxy variants (throwing-accessor and function-returning, via the reused `txUninspectable`
guard + try/catch) → frozen `*_UNCONFIGURED`, **never throws**.

## 8. Append-only / helper reuse
Appended to the existing `transaction-build-review-foundations.mjs`/`.d.ts`/README/test — **no new src file**
(mechanism guard `sources` stays 99); existing functions and the shared `txSafeFlags`/`txScreen`/`txUninspectable`/
`TX_*` helpers and the **spec-canonical bucket enums** (`medium`/`not_needed`/`maybe_needed` — no `moderate`/`none`/
`resolved` synonyms) are reused **unmodified**; no module-level mutable state introduced. Exactly 4 files differ vs
main.

## 9. Tests summary
Appended to `test/transaction-build-review-foundations.test.mjs` (resource advisory, serialization guard incl. a
planted-secret no-echo proof, review verdict, suppression, health, descriptors, static guards), built against
**real** prior tx-build results over the real Stage-9 `EXECUTION_PLAN_PREVIEW_PREVIEW_VALID` chain.
**transaction-build-review-foundations 75/75 (37 prior + 38 new); full suite 1427/1427** (1389 + 38). Independent
main-loop behavioral spot-check: **27/27 PASS** (resource unknown/too_high/required_unresolved/acceptable;
serialization guard CLEAN + BLOCKED-with-redaction on serialized_tx/signature/blockhash/VersionedTransaction/
instruction_array/private_key with planted values never echoed; verdict PASS_ADVISORY-all-flags-false + no-artifact-
tokens / BLOCKED / UNCONFIGURED; suppression artifact + not_*_authorized; health UNCONFIGURED/BLOCKED/
REVIEWED_ADVISORY + smuggled-flag-&-secret-&-mainnet→BLOCKED-never-echoed; hostile proxies frozen).

## 10. Guard / allowlist / drift impact
`ALLOWLIST` unchanged. Mechanism guard PASS `sources=99 fixtures=27 allowlist=1 violations=0` — **`sources` stays
99** (append, no new src file). SSOT drift **unchanged at baseline**
(`core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30`).
No new SSOT/API/CONFIG/DATA name.

## 11. No-live / no-transaction-build / no-execution / no-SDK confirmation
Module import-free; no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/`readFileSync`/
system clock; no live stream; no Jupiter/aggregator/live-quote/RPC-route call; no real transaction build /
serialization / message bytes; no DB/Redis/Postgres/ClickHouse/filesystem/persistence; no mutable module/global
state; no SDK/dependency; no endpoint/secret in src/README; no signing/send/broadcast; no KMS/Vault/KeyManager; no
private key material; no mainnet; no REAL-LIVE.

## 12. Readiness impact
None — resource/serialization-surface/verdict/suppression/health states are **not** transaction/serialization/
signing/send/trading readiness; `TX_BUILD_HEALTH_REVIEWED_ADVISORY` is a read-only marker; the pipeline
(`data → signal → risk → intent → route → sign → send`) is advanced only within the read-only/advisory
transaction-build-**review** foundation (no real build); `can_send:false` repo-wide unchanged.

---

**Confirmations:** Resource advisory (buckets only; too_high/too_large/required_unresolved → rejected; acceptable →
advisory) · Serialization forbidden surface guard (detects artifact field names; `forbidden_field_ref` redacted
NAME-only; planted values never echoed; detection booleans are not readiness flags) · Review verdict
(`PASS_ADVISORY` not transaction/serialization; codes carry no tx/sign/send artifact token) · Suppression (reasons
only; advisory-clean still not serialize/sign/send; always `not_serialization/sign/send/execution_authorized`) ·
Health (consumes all; `REVIEWED_ADVISORY` advisory-only) · No tx-build→transaction/serialization/signing/send
conversion · Append-only (sources stays 99) · No real transaction build · No Jupiter live call · No live quote · No
serialization · No network primitive · No system clock · No persistence · No dependency · No endpoint/secret in repo
· No secret echoed · No signing/send/broadcast · No mainnet · No REAL-LIVE · No new SSOT name · ALLOWLIST unchanged ·
`can_send:false` unchanged · route + intent + risk + signal + intelligence + ingestion + gate-a + rpc-provider +
send-gate green.
