# E2-F-2 — Sign-only → Send-gate Fail-Closed Wiring Evidence (test/report-only)

> **TEST / EVIDENCE-ONLY.** Adds one test (`packages/send-gate-contract/test/sign-only-to-send-gate-fail-closed.test.mjs`)
> and this report. **No `src` change in any package** · no dependency · no root `package.json`/lockfile change ·
> no `ALLOWLIST` change. **No RPC / no provider SDK / no Solana·Jupiter·Helius·Jito / no send / no broadcast /
> no transaction building / no transaction serialization / no signing-in-src / no network / no KMS·Vault / no
> KeyManager / no configured-handle wiring / no key material / no DB / no migration / no Docker / no API / no
> mainnet / no REAL-LIVE.** No `candidate_*`→implemented. Introduces **no new SSOT/API/DATA/CONFIG name** (the
> test reuses existing modules unmodified). **`can_send:false` repo-wide unchanged; readiness unchanged.**
>
> **State:** `main` @ `8b77bad` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=81 fixtures=27 allowlist=1
> violations=0` · 538/538 tests · **NO SDK SELECTED YET**.

---

## 1. Scope
Test-only **wiring evidence** that a genuine SIGN-ONLY success does **not** grant send. The test imports the
**existing, unmodified** real sign-only path (E2-C3-4, `createRealSigningPath` in
`packages/isolated-signer-runtime/src`) and the **existing, unmodified** send-gate contract (E2-F-1,
`evaluateSendPreflight` in `packages/send-gate-contract/src`), and proves — at the seam between them — that the
send gate is fail-closed. **No `src` is modified; the wiring lives only in the test harness.** This is the
recommended `pr-e2-f2` follow-up to E2-F-1; real send/RPC/broadcast remains a separate, explicitly-approved PR.

## 2. Sign-only → send-gate evidence
The test produces a **real** sign-only result via the existing path (ephemeral non-extractable WebCrypto
Ed25519 key, established E2-C5-1 pattern): `{ ok:true, signed:true, signature:<base64>, can_send:false,
mode:'sign_only' }`. A request derived from it (`sign_only_success:true`, all preconditions met, clean devnet)
is fed to `evaluateSendPreflight`, which **refuses**: `ok:false`, `sent:false`, `broadcast:false`,
`can_send:false`, `can_broadcast:false`, `can_serialize:false`, `reason:'send_gate_unconfigured_no_rpc'`. The
crux assertion: **`sign.can_send === false && send.can_send === false`** — a genuine signature does not unlock
send.

## 3. Fail-closed behavior
Every send-gate result in the test is the frozen, fixed-literal refusal (signature/transaction/serialized all
`null`; every capability `false`; foundational reason `send_gate_unconfigured_no_rpc`). A perfectly
valid-looking devnet/testnet/localnet request (post sign-only) is **still refused** with no specific threat
blocker — only the foundational one.

## 4. No-RPC / no-send / no-serialization
The test contacts no network and performs no send/broadcast/serialization. The sign-only path's own
`can_send:false` and the send gate's `can_send:false` are both asserted. The send gate exposes **no**
`send`/`broadcast`/`serialize`/`sendTransaction`/`submit`/`sign`/`connect` method. `src` is unchanged, so the
mechanism guard's `sources=81` count is unchanged.

## 5. Mainnet / endpoint refusal
Derived send requests carrying mainnet indicators (`mainnet`/`mainnet-beta`/`prod`) → `mainnet_indicator_blocked`;
endpoint/RPC/provider-URL fields (`rpc_endpoint`/`provider_url`/`wss://`/`cluster`) → `endpoint_or_rpc_blocked`.

## 6. Raw / serialized transaction refusal
Derived send requests carrying serialized/raw/wire transaction fields (`serialized`/`raw_transaction`/
`transaction`/`wire_transaction`) → `serialized_or_raw_tx_blocked`.

## 7. Key-material refusal
Key-material-shaped input (PEM / object exposing secret/private/seed/mnemonic/keypair) → `key_material_not_accepted`,
refused and **never echoed** (`SECRET_MARKER_F2` absent from output; result carries no key/private/seed/
mnemonic/keypair/raw/handle field). `refusesKeyMaterial` is asserted on the same shapes.

## 8. Hostile-input hardening verification
A hostile/throwing accessor (getter that throws, Proxy with a throwing `ownKeys` trap) makes
`evaluateSendPreflight` **return a frozen refusal** (blocker `input_inspection_error`) and **not throw**; the
caught error message is never echoed. Verifies the E2-F-1 hardening holds at the wiring seam.

## 9. Audit / output hygiene
With the sign-only path's audit log enabled, audit keys ⊆ `AUDIT_COLUMNS` and contain no signature/digest/key.
The send-gate output, even when fed a request carrying the real signature + a secret + an endpoint URL, echoes
**none** of them (no signature, no `SECRET_MARKER_F2`, no `leak.example`) and records
`endpoint_or_rpc_blocked` + `key_material_not_accepted`.

## 10. Execution-authority surface
**None.** No `src` change; no send/broadcast/serialize/RPC/network introduced; the genuine signature grants no
send. Global `capabilities()` (isolated-signer runtime) stays all-false; **`can_send:false` repo-wide unchanged**.

## 11. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change** — still `['packages/isolated-signer-runtime/src/']`. Guard PASS `sources=81
  fixtures=27 allowlist=1 violations=0` (test files are not scanned; `src` unchanged → source count unchanged).
  `send-gate-contract/src` remains **not allowlisted**.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR SEND / BROADCAST / KMS / REAL-LIVE** unchanged.

## 12. Remaining blockers / next approvals (each a separate, explicit decision)
- **Real send / testnet broadcast** — testnet-first, behind this gate, with its own RPC/provider decision
  (separate PR; not started).
- **RPC/provider SDK selection** (+ supply-chain review + lockfile diff).
- **KMS / custody-key sourcing** + configured-handle wiring into the sign-only path.
- **Mainnet / REAL-LIVE** — distinct later decisions (`09-THREAT §7` readiness + zero `§7.8` blockers;
  `signer_control` + two-person rule).

## 13. Stop conditions
Any `src` change introducing a mechanism · any RPC/send/broadcast · any tx build/serialize · any provider SDK
import / dependency / lockfile change · any live provider call/endpoint/RPC URL · any credential/secret/key
material · any mainnet/REAL-LIVE · any `ALLOWLIST` change/new path · any new SSOT/API/DATA/CONFIG name → ARCH→SSOT
first · any `candidate_*`→implemented → **STOP**.

---

**Confirmations:** Test/report-only · No `src` change · No RPC/provider introduced · No send/broadcast
introduced · No transaction serialization introduced · No mainnet introduced · No REAL-LIVE activation · No
KMS/Vault/KeyManager introduced · No private key material introduced · No new execution authority introduced.
