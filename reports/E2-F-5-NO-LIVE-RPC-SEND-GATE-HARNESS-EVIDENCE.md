# E2-F-5 — No-live-RPC Send-Gate Harness Evidence (test/report-only)

> **TEST / EVIDENCE-ONLY.** Adds one test (`packages/send-gate-contract/test/no-live-rpc-send-gate-harness.test.mjs`)
> and this report. **No `src` change in any package** · no dependency · no root `package.json`/lockfile change ·
> no `ALLOWLIST` change. **No RPC / no provider SDK / no Solana·Jupiter·Helius·Jito / no provider live call / no
> literal endpoint URL / no endpoint secret or API key / no send / no broadcast / no transaction building / no
> transaction serialization / no KMS·Vault / no KeyManager / no configured-handle wiring / no key material / no
> mainnet / no REAL-LIVE.** Introduces **no new SSOT/API/DATA/CONFIG name** (the harness model fields are
> test-local). **`can_send:false` repo-wide unchanged; readiness unchanged.**
>
> **State:** `main` @ `20c3d00` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=81 fixtures=27 allowlist=1
> violations=0` · 551/551 tests · **NO SDK SELECTED YET**.

---

## 1. Current state (@ `20c3d00`)
The first-safe off-live option from E2-F-4: an off-live harness that exercises the send-gate refusal/failure
semantics with **no live RPC**. Sign-only chain closed · no-SDK custody/KMS chain closed · no-RPC send-gate
chain closed (F-0…F-3) · RPC/provider selection + broadcast gate framed (F-4, **no provider selected**) ·
`can_send:false` repo-wide.

## 2. E2-F-5 test/report-only scope
A **no-live-RPC harness built entirely inside the test** (`harnessAttemptSend(request, providerState)`): a pure
model of what a future send attempt would consult, with **no provider/SDK import and no network call**. It
delegates the decision to the **existing, unmodified** `evaluateSendPreflight` and only annotates a **simulated**
provider state. It **never sends/broadcasts/serializes** (`sent:false, broadcast:false, serialized:null,
network_call_made:false`). No `src` is modified; the harness is test scaffold only. 13 tests; the tests are the
authoritative evidence.

## 3. No-live-RPC harness summary
The harness has no real provider object — `providerState` is a plain simulated record
(`live_rpc_enabled`/`endpoint_present`/`provider_status`). It performs **no network I/O**; the test file imports
only node builtins (`node:test`/`node:assert`/`node:crypto`/`node:fs`/`node:url`) and local repo modules — **no
provider/SDK/Solana/http/db import** (asserted by an import-specifier scan).

## 4. Provider-failure fail-closed summary
Simulated `provider_status:'failed'` → harness blocker `provider_failed_fail_closed`; nothing sent, no network
call, gate refuses. Failure never opens send (fail-safe-not-fail-open).

## 5. Missing-endpoint refusal summary
Simulated `endpoint_present:false` (even with `live_rpc_enabled:true`) → harness blocker `missing_endpoint`;
nothing sent. Live RPC is **disabled by default** (`DEFAULT_PROVIDER.live_rpc_enabled === false` →
`live_rpc_disabled_by_default`).

## 6. Mainnet / endpoint refusal summary
Requests carrying mainnet indicators (`mainnet`/`prod`) → gate `mainnet_indicator_blocked`; endpoint/RPC/
provider-URL field names (`rpc_endpoint`/`provider_url`/`cluster`) → gate `endpoint_or_rpc_blocked` — **before
any send**. Placeholders only; **no literal endpoint URL** anywhere in the test.

## 7. No-implicit-broadcast summary
Even with a simulated "ready" provider (`live_rpc_enabled:true`, `endpoint_present:true`,
`provider_status:'configured'`) and all request preconditions satisfied, the gate still refuses foundationally
(`send_gate_unconfigured_no_rpc`), `network_call_made===false`, and `can_broadcast`/`can_serialize` stay false —
**no send, no broadcast, no serialization**.

## 8. Sign-only → send-gate refusal continuity
Reusing the **existing real sign-only path** (genuine success: `ok:true`, `signed:true`, `can_send:false`,
ephemeral non-extractable key), a derived request through the harness is **still refused**
(`sign.can_send===false && gate.can_send===false`) — continuous with E2-F-2.

## 9. No endpoint/credential/key leakage
Harness/gate output never echoes a request-borne endpoint or secret marker (`ENDPOINT_MARKER_F5`/
`SECRET_MARKER_F5` absent); the gate result carries no key/private/seed/mnemonic/keypair/raw/handle/endpoint/
credential/api_key field; key-material input is refused (`key_material_not_accepted`). Sign-only audit keys ⊆
`AUDIT_COLUMNS` with no signature/endpoint.

## 10. No-RPC / no-send / no-serialization boundary
The harness models the send seam without crossing it: no RPC, no provider call, no transaction build, no
serialization, no broadcast, no network. `src` is unchanged → guard `sources=81` unchanged; `send-gate-contract/
src` remains **not allowlisted** and fully scanned; guard PASS `allowlist=1 violations=0`.

## 11. Hostile-input refusal
A hostile/throwing **request** → gate returns a frozen refusal (`input_inspection_error`), no throw; a
hostile/throwing **provider state** → harness returns a frozen refusal (`harness_input_inspection_error`), no
throw; neither echoes the error message.

## 12. Execution-authority surface
**None** — no `src` change; the harness never sends and makes no network call; `can_send:false` repo-wide
unchanged; global `capabilities()` all-false.

## 13. Remaining blockers / next approvals (each a separate, explicit decision)
- **RPC / provider selection** + **exact SDK / package / version** (+ supply-chain review + lockfile diff).
- **Testnet endpoint provisioning** (out-of-repo; no secret in repo); live RPC disabled by default.
- **Testnet send / broadcast implementation PR** (testnet-first, behind this gate).
- **`signer_control` + two-person** for send-sensitive activation; **mainnet / REAL-LIVE** (distinct later).

## 14. Stop conditions
Any `src` change introducing a mechanism · any RPC/provider import / live call · any dependency install · any
endpoint credential/URL in repo/env-example/logs · any send/broadcast impl · any tx build/serialization · any
mainnet endpoint/name/config · any REAL-LIVE · any KMS/Vault SDK or configured-handle wiring · any private key
material · any new SSOT/API/DATA/CONFIG name → ARCH/SSOT first · any `ALLOWLIST` change/new path → **STOP**.

## 15. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; guard PASS `sources=81 fixtures=27 allowlist=1 violations=0` (test files not scanned; `src` unchanged).
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR RPC/SEND/BROADCAST/REAL-LIVE** unchanged; **`can_send:false` repo-wide unchanged**.

---

**Confirmations:** Test/report-only · No `src` change · No RPC/provider introduced · No provider live call
introduced · No send/broadcast introduced · No transaction serialization introduced · No mainnet introduced ·
No REAL-LIVE activation · No KMS/Vault/KeyManager introduced · No private key material introduced · No endpoint
secret introduced · No new execution authority introduced.
