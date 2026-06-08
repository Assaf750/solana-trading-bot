# E2-F-8 (Milestone 2) — Send-Gate ↔ RPC-Provider Contract Integration Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Wires
> `@soltrade/send-gate-contract` to CONSUME the `@soltrade/rpc-provider-contract` result **fail-closed** via one
> relative internal import — **no live RPC, no SDK, no dependency, no send/broadcast, no transaction
> serialization, no network call, no endpoint secret, no mainnet, no REAL-LIVE, no KMS/Vault/KeyManager, no
> ALLOWLIST change, no new SSOT name.** `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `4e354ba` (branch `pr-e2-f8-send-gate-rpc-provider-integration`) · B1–B8 `DECIDED`
> · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/src/']` ·
> mechanism guard `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 583/583 · **NO RPC PROVIDER
> SELECTED YET**.

---

## 1. Current state
`packages/send-gate-contract/` (fail-closed send gate, E2-F-1/2/5) and `packages/rpc-provider-contract/`
(fail-closed RPC-provider contract, Milestone 1) both exist and are fully scanned outside the allowlist. This
milestone connects them at the contract level — **read-only consumption**, still always refusing.

## 2. Implementation summary
- **One relative internal import** added to `src/send-gate-contract.mjs`:
  `import { evaluateRpcReadiness, validateRpcProviderConfig } from '../../rpc-provider-contract/src/index.mjs';`
  (the only import; no external/SDK/Solana/Jupiter/Helius/Jito/http/db).
- **`evaluateSendPreflight`** now consumes `input.rpc_provider` **inside the existing try/catch**, after the
  precondition checks and before the foundational refusal:
  - missing provider → blocker `rpc_provider_missing`;
  - `validateRpcProviderConfig(provider).status === 'invalid_key_material'` → blocker `rpc_provider_key_material`;
  - `evaluateRpcReadiness(provider).ready !== true` → blocker `rpc_provider_not_ready`.
  Readiness is **derived from the contract** (always `ready:false`), never trusted from a caller flag.
- **`describeSendGateContract()`** gains `consumes_rpc_provider: true` (function-return descriptor field, not
  SSOT); mirrored in `send-gate-contract.d.ts`. README updated (the single internal import + integration + new
  blockers). Result object is **unchanged fixed literals**; provider input is **never echoed**.

## 3. Tests summary
- Updated the send-gate self-scan import test to allow **only** the one relative `rpc-provider-contract` import
  (still forbids external/forbidden imports and `require()`); extended the descriptor test for
  `consumes_rpc_provider`.
- New `test/send-gate-rpc-provider-integration.test.mjs` — **13 integration tests** exercising the REAL imported
  send-gate + rpc-provider contracts: consume-and-still-refuse · missing provider · `not_ready` · valid testnet
  provider references-only/no-send · provider failure · mainnet provider · endpoint/rpc/provider_url refused &
  not echoed · sign-only + provider still refuses · no send/broadcast/serialize methods · hostile provider →
  frozen refusal · key-material provider refs refused & not echoed · import-clean (no network) · `can_send:false`.
- **Send-gate package suite 55/55; rpc-provider-contract 18/18 (unchanged); full suite 583/583.**

## 4. Fail-closed behavior
Every `evaluateSendPreflight` result stays frozen and `ok:false, sent:false, broadcast:false, signature:null,
transaction:null, serialized:null, can_send:false, can_broadcast:false, can_serialize:false, has_rpc:false,
status:'unconfigured_no_rpc', reason:'send_gate_unconfigured_no_rpc'`. The foundational refusal is always present.
Verified: a caller-**faked** `{ready:true, rpc_provider_ready:true}` provider still refuses (`rpc_provider_not_ready`
+ foundational, `can_send:false`) — readiness comes from the contract, not the caller.

## 5. RPC-provider consumption / sign-only continuity
A genuine sign-only success (`sign_only_success:true`) combined with any rpc_provider still refuses
(`can_send:false`) — provider readiness does not open send, consistent with E2-F-2. mainnet/endpoint/rpc
indicators in `rpc_provider` are refused (`mainnet_indicator_blocked`/`endpoint_or_rpc_blocked`) and never
echoed; key-material-shaped provider refs are refused (`rpc_provider_key_material`, delegated to the hardened
`validateRpcProviderConfig`) and never echoed; hostile/throwing provider input returns a frozen refusal
(`input_inspection_error`), never throws.

## 6. No-live / no-SDK / no-send / no-serialization confirmation
The integration is contract-to-contract only: no live RPC, no provider SDK, no dependency, no network/provider
call (both packages import-free of externals; send-gate imports only the sibling contract relatively), no
send/broadcast, no transaction build/serialization, no literal endpoint URL, no key material. The gate exposes
no `send`/`broadcast`/`serialize`/`sendTransaction`/`connect` method.

## 7. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — no new src file; the relative import is not a forbidden family; send-gate src stays fully scanned).

## 8. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 9. Remaining blockers / next approvals (each a separate, explicit decision)
- Exact RPC/provider + SDK/version selection (+supply-chain/lockfile review) — **NO RPC PROVIDER SELECTED YET**.
- Testnet endpoint provisioning (out-of-repo; no secret in repo); live testnet RPC spike (test-only, disabled by default).
- Testnet broadcast implementation; `signer_control` + two-person for send-sensitive activation; mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Send-gate consumes the rpc-provider contract fail-closed · No
live RPC · No RPC/provider SDK · No dependency · No live provider call · No send/broadcast introduced · No
transaction serialization · No mainnet · No REAL-LIVE activation · No KMS/Vault/KeyManager · No private key
material · No endpoint secret · No new execution authority · No new SSOT name · ALLOWLIST unchanged.
