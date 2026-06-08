# E2-F-4 — RPC/Provider Selection & Testnet Broadcast Implementation Gate (report-only)

> **REPORT / GATE-ONLY (decision matrix + threat review).** No code, no tests, no package, no tool, no
> dependency install, no `ALLOWLIST` change, no root `package.json`/lockfile change. **No RPC / no provider SDK
> / no Solana·Jupiter·Helius·Jito / no send / no broadcast / no transaction building / no transaction
> serialization / no KMS·Vault / no KeyManager / no configured-handle wiring / no key material / no endpoint
> secret or API key / no mainnet / no REAL-LIVE.** References already-merged artifacts only; introduces **no new
> SSOT/API/DATA/CONFIG name** (existing names cited as design context only). **Selects no provider** — it only
> frames the decision and its gate. **Does NOT change readiness. `can_send:false` repo-wide unchanged.**
>
> **State:** `main` @ `99090f0` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=81 fixtures=27 allowlist=1
> violations=0` · 538/538 tests · **NO SDK SELECTED YET**.

---

## 1. Current state / evidence read (@ `99090f0`)
This gate is framed on top of the following closed, fail-closed chains:
- **Sign-only signing** closed (E2-C6): real Ed25519 **sign-only** behind the gate; bound-digest only; off-chain proof; `can_send:false`.
- **No-SDK custody/KMS** closed (E2-KMS-11): contract-shaped, fail-closed; **NO SDK SELECTED YET**.
- **No-RPC send-gate** closed (E2-F-3): designed boundary (F-0) + fail-closed send-gate contract/skeleton (F-1) + sign-only→send-gate wiring evidence (F-2). `evaluateSendPreflight()` always refuses; a genuine sign-only success does **not** unlock send.
- **`can_send:false` repo-wide**; global `capabilities()` all-false; `tx-send`/`tx-serialize`/`rpc-connection`/`http-fetch`/`websocket` HARD-forbidden (incl. inside the one allowlisted path).

## 2. RPC/provider / testnet-broadcast options matrix (EVALUATION ONLY — no selection)
Five candidate directions, scored on the evaluation axes in §3. **None is selected here**; selection is a separate, explicitly-approved decision.

| # | Option | What it is | Net posture |
|---|---|---|---|
| O1 | **No-RPC continuation** | Stay at the closed no-RPC send-gate; no network at all. | Safest; zero new surface; no send. |
| O2 | **Mocked / off-live provider harness** | A test-only fake provider (no real network) to exercise gate/refusal/failure semantics. | Safe; proves wiring without any live endpoint; no dependency required. |
| O3 | **Testnet-only RPC provider** | A devnet/testnet RPC endpoint (provisioned out-of-repo), live RPC **disabled by default**, mainnet refused. | Introduces a live endpoint surface; testnet-first; needs endpoint isolation + provisioning approval. |
| O4 | **Managed RPC provider (testnet tier)** | A managed/hosted RPC (testnet) behind a provider key reference. | Adds SDK/credential surface; supply-chain + lockfile review; key via reference only, never raw. |
| O5 | **Self-hosted RPC** | An operator-run node (testnet). | Largest ops/supply-chain surface; endpoint isolation + ops hardening required. |

## 3. Evaluation axes (applied to each option)
Each option is assessed against: **no-mainnet-by-default** · **testnet/devnet support** · **endpoint isolation** · **no implicit send** · **transaction-serialization risk** · **dependency/SDK surface** · **credential/endpoint-leakage risk** · **rate-limit/failure behavior** · **auditability** · **rollback/failure handling** · **supply-chain/lockfile impact**.

| Axis | O1 No-RPC | O2 Mock/off-live | O3 Testnet RPC | O4 Managed RPC | O5 Self-hosted |
|---|---|---|---|---|---|
| no-mainnet-by-default | inherent | inherent | required (refuse mainnet) | required | required |
| testnet/devnet support | n/a | simulated | yes | yes | yes |
| endpoint isolation | n/a | n/a (no endpoint) | required | required | required |
| no implicit send | inherent | inherent | gated (never implicit) | gated | gated |
| serialization risk | none | none | deferred (separate approval) | deferred | deferred |
| dependency/SDK surface | none | none | low–med | med–high (SDK) | med |
| credential/endpoint leakage | none | none | endpoint ref only, no secret in repo | key ref only, no raw key | endpoint ref only |
| rate-limit/failure behavior | n/a | simulated | must fail-closed | must fail-closed | must fail-closed |
| auditability | full | full | refs-only audit | refs-only audit | refs-only audit |
| rollback/failure handling | n/a | simulated via existing names | existing `NETWORK_ROLLBACK_EVENT`/`failure_type` | same | same |
| supply-chain/lockfile | none | none | low | **review required (lockfile diff)** | low–med |

**Reading:** safety increases left→right cost/surface. O1/O2 add **no live surface**; O3–O5 each require their own approval, endpoint isolation, and (for O4) a supply-chain/lockfile review. Eventual send semantics map onto **existing** SSOT vocabulary — `execution_mode`, `bundle_status`, `bundle_ttl_slots`, Execution Trace `candidate_ts_sent`/`candidate_ts_landed`, `failure_type` (`BundleFailed`/`BlockhashExpired`/`RPCDropped`), `candidate_failure_origin`, `NETWORK_ROLLBACK_EVENT` — **none implemented here**; any genuinely new field is a stop condition → ARCH→SSOT first.

## 4. Testnet broadcast implementation gate
Before ANY live broadcast is implemented, ALL of the following must hold (each a separate, explicit approval):
1. **Provider chosen** (O1–O5) with rationale and the evaluation axes addressed.
2. **Exact SDK / package / version** (if any) + **supply-chain review + lockfile diff**.
3. **Testnet endpoint provisioned out-of-repo** (no endpoint/credential/URL in repo/env-example/logs); live RPC **disabled by default**.
4. **Endpoint isolation** + mainnet refusal by default.
5. **Send remains behind the existing gate** (sign-only success + send-gate pass + readiness + custody + Hard-Risk); send never implicit.
6. **Serialization** is its own separately-approved step (not bundled with RPC).
7. **`signer_control` + two-person** for any send-sensitive activation; **mainnet/REAL-LIVE** a distinct later decision.

## 5. Threat review (RPC/provider/broadcast phase)
| # | Threat | Control carried into the eventual PR |
|---|---|---|
| R1 | Accidental mainnet | testnet/devnet allowlist; mainnet/prod refused by default; mainnet a separate decision. |
| R2 | Hidden/implicit RPC | `rpc-connection`/`http-fetch`/`websocket` stay HARD-forbidden until a dedicated, approved PR; live RPC disabled by default. |
| R3 | Serialization creep | `tx-serialize` stays HARD-forbidden; serialization is its own gated step. |
| R4 | Endpoint/credential leakage | endpoint/credential/URL never in repo/env-example/logs/audit; references only; reports redact. |
| R5 | Implicit broadcast | a valid signature never auto-broadcasts; send behind the gate, never implicit. |
| R6 | Provider failure / rate-limit | fail-closed on failure/throttle; reuse `provider_degraded`/`slot_lag`/`failure_type`/`candidate_failure_origin`; never fail-open. |
| R7 | Rollback / fork | reuse existing `NETWORK_ROLLBACK_EVENT`; affected data tagged, not treated as final. |
| R8 | Supply-chain (SDK) | exact version pin + supply-chain review + lockfile diff before any dependency. |
| R9 | Audit leakage | audit before/after, keys ⊆ `AUDIT_COLUMNS`; no endpoint/credential/signature/digest/key. |

## 6. Recommendation (recommendation only — no selection, do NOT start)
- **Keep the first next step OFF-LIVE.** The first follow-up should remain a **no-live-RPC / off-live harness** (O2) or a **provider-selection report fixing an exact version** — **not** a live RPC integration.
- **Do NOT finalize a live RPC provider in this report.** A live provider (O3–O5) requires its own separate approval with endpoint provisioning + (for SDK) supply-chain/lockfile review.

## 7. Required future tests (for the eventual PRs — none added here)
- No mainnet endpoints; testnet/devnet-only endpoint allowlist; **live RPC disabled by default**.
- Missing endpoint → **refuses** (fail-closed); provider failure/throttle → refuses/fail-closed.
- **No implicit broadcast**; **no send** unless sign-only success **and** send-gate passes.
- Audit before/after, **refs-only**; no endpoint/credential/key leakage in output/audit/errors.
- **No serialization** unless explicitly approved.
- Rollback/failure-event behavior using **existing names only** (`NETWORK_ROLLBACK_EVENT`/`failure_type`/`candidate_failure_origin`).

## 8. Stop conditions
- Any **RPC/provider import** → STOP.
- Any **dependency install** → STOP.
- Any **endpoint credential or URL in repo/env-example/logs** → STOP.
- Any **send/broadcast implementation** → STOP.
- Any **transaction build/serialization** → STOP.
- Any **mainnet endpoint/name/config** → STOP.
- Any **REAL-LIVE activation** → STOP.
- Any **KMS/Vault SDK or configured-handle wiring** → STOP.
- Any **private key material** → STOP.
- Any **new SSOT field/name** → STOP → ARCH/SSOT first.
- Any **`ALLOWLIST` change / new allowlist path** → STOP.

## 9. First-safe implementation recommendation (next step — NOT started)
- **`pr-e2-f5-no-live-rpc-send-gate-harness`** — test-only / off-live provider harness exercising the send-gate
  refusal + failure semantics against a simulated (no-live-RPC) boundary; **no real RPC, no SDK, no send**; or
- **`pr-e2-f5-provider-selection-report-exact-version`** — a report fixing the exact provider/SDK/version with
  a supply-chain/lockfile review, **still no integration**.

Either keeps the next step **off-live**. **Not started by this PR.**

## 10. Governance approvals required (each a separate, explicit decision)
- **Exact RPC/provider choice** (O1–O5) with rationale.
- **Exact SDK / package / version** if any dependency is proposed.
- **Supply-chain review + lockfile diff.**
- **Testnet endpoint provisioning approval** (out-of-repo; no secret in repo).
- **`signer_control` + two-person** for send-sensitive activation.
- **Mainnet / REAL-LIVE** — distinct later approval (`09-THREAT §7` readiness + zero `§7.8` blockers).

## 11. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; mechanism guard PASS `sources=81 fixtures=27 allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR RPC/SEND/BROADCAST/REAL-LIVE** unchanged; **`can_send:false` repo-wide unchanged**.

---

**Confirmations:** Report-only · No code/tests introduced · No RPC/provider introduced · No send/broadcast
introduced · No transaction serialization introduced · No mainnet introduced · No REAL-LIVE activation · No
KMS/Vault/KeyManager introduced · No private key material introduced · No endpoint secret introduced · No new
execution authority introduced.
