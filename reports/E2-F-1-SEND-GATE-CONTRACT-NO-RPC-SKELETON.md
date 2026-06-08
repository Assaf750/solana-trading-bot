# E2-F-1 — Send Gate Contract / Fail-Closed No-RPC Skeleton (evidence)

> **CONTRACT / SKELETON-ONLY.** Adds a standalone, import-free `@soltrade/send-gate-contract` package
> (contract + fail-closed gate that ALWAYS refuses) **outside** the mechanism-guard allowlist, plus tests, a
> README, and this report. **No RPC / no provider SDK / no Solana/Jupiter/Helius/Jito / no send / no broadcast
> / no transaction building / no transaction serialization / no signing / no network / no KMS/Vault / no
> KeyManager / no configured-handle wiring / no key material / no DB / no migration / no Docker / no API / no
> mainnet / no REAL-LIVE.** No dependency, no root `package.json`/lockfile change, no `ALLOWLIST` change. No
> `candidate_*`→implemented. Introduces **no new SSOT/API/DATA/CONFIG name** (result-model/contract I/O fields
> are function-return/skeleton fields, not SSOT vocabulary — established precedent). **`can_send:false`
> repo-wide unchanged; readiness unchanged.**
>
> **State:** `main` @ `35d972b` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard `sources=81 fixtures=27 allowlist=1
> violations=0` · 527/527 tests · **NO SDK SELECTED YET**.

---

## 1. Scope
A first, off-live **send-gate contract + fail-closed skeleton** that fixes the *gate + refusal semantics* of
the future send phase **without any RPC, send, broadcast, or serialization**. It is the first item recommended
by `reports/E2-F-0-SEND-TESTNET-BROADCAST-BOUNDARY-DESIGN.md` (`pr-e2-f1-send-gate-contract-no-rpc`). Real
send/RPC/testnet broadcast remains a separate, explicitly-approved PR and is **not started** here.

## 2. Standalone package (outside the allowlist, fully scanned)
`packages/send-gate-contract/` is a standalone, **import-free** package — exactly like
`@soltrade/custody-provider-contract`. Because it has no live mechanism, it lives **outside** the allowlist
(`packages/isolated-signer-runtime/src/`) and is **fully scanned** by the mechanism guard, proving zero
forbidden families. Tests use **relative imports**, so there is **no root `package.json`/lockfile change and no
`npm install`** (package-local manifest only).

## 3. Send-gate contract surface
- `describeSendGateContract()` → frozen descriptor; `can_send`/`can_broadcast`/`can_serialize`/`has_rpc`/
  `is_live`/`accepts_key_material_input` all `false`; `requires_sign_only_success: true`; `status:
  'unconfigured_no_rpc'`.
- `createFailClosedSendGate()` → opaque gate; `isConfigured()===false`; exposes only `describe()` and
  `evaluateSendPreflight()` — **no** `send`/`broadcast`/`serialize`/`sendTransaction`/`submit`/`sign` method.
- `evaluateSendPreflight(input)` → pure; **always** returns the refused result.
- `refusesKeyMaterial(input?)` → predicate; `SEND_GATE_CONTRACT_STATUS` → `'unconfigured_no_rpc'`.

## 4. Fail-closed behavior
Every evaluation returns a frozen result built from **fixed literals**:
`{ ok:false, sent:false, broadcast:false, signature:null, transaction:null, serialized:null, can_send:false,
can_broadcast:false, can_serialize:false, has_rpc:false, is_live:false, status:'unconfigured_no_rpc',
reason:'send_gate_unconfigured_no_rpc', blockers:[…] }`. A perfectly valid-looking devnet/testnet request is
**still refused** (foundational `send_gate_unconfigured_no_rpc`: there is no RPC and no send path at all).

## 5. No-RPC / no-send / no-serialization model
The module is **import-free** and contains no `fetch(`, `new Connection(`, `.serialize(`, `sendTransaction`/
`sendRawTransaction`/`sendAndConfirmTransaction`, `new WebSocket`, `.query(`, `Keypair`, `KeyManager`, or
`activate_real_live(`. Indicator tokens are stored as **string literals** (lexer-blanked), so the guard's
code-scan sees no mechanism; detection is `.indexOf`-based. No transaction is built, serialized, signed, sent,
or broadcast; no network is contacted.

## 6. Mainnet / endpoint refusal model
Blockers recorded (in addition to the always-present foundational reason): `mainnet_indicator_blocked`
(mainnet/mainnet-beta/prod) · `endpoint_or_rpc_blocked` (http/https/ws/wss/rpc/endpoint/provider_url/cluster/
websocket/node_url/live_call) · `broadcast_or_send_indicator_blocked` (broadcast/send) ·
`serialized_or_raw_tx_blocked` (serialized/serialize/raw_tx/raw_transaction/transaction/wire_transaction/
tx_bytes/signed_transaction). Detection is conservative — over-refusal is **fail-safe-not-fail-open**.

## 7. Gate invariants (preconditions)
Send never happens without prior **sign-only success** (`sign_only_not_completed` when missing); readiness /
preflight / custody failures are blockers (`readiness_not_ready` / `preflight_not_ok` / `custody_not_active`).
Even with **every** precondition satisfied, the gate is still refused foundationally (no RPC/no send path).

## 8. Key-material refusal model
Conservative `looksLikeKeyMaterial` (PEM / long base58 / mnemonic-length word list / object exposing a
secret/private/seed/mnemonic/keypair field) → `key_material_not_accepted`. The result is built from fixed
literals, so a refused secret value is **never echoed**, and the result carries no `key`/`private`/`seed`/
`mnemonic`/`keypair`/`raw`/`handle` field.

## 9. Execution-authority surface
**None.** No `send`/`broadcast`/`serialize`/`sign`/`exportKey`/`loadKey`/`KeyManager`/RPC/provider/network. The
gate never activates and grants no execution authority. Global `capabilities()` (isolated-signer runtime) stays
all-false; **`can_send:false` repo-wide unchanged**.

## 10. Tests (authoritative evidence)
`packages/send-gate-contract/test/send-gate-contract.test.mjs` (17 tests): descriptor all-false; gate
fail-closed with no send/broadcast/serialize methods; valid-looking devnet/testnet **still refused**; mainnet
refused; endpoint/RPC refused; broadcast/send refused; serialized/raw tx refused; sign-only/readiness/preflight/
custody preconditions; key-material refused & never echoed; result never echoes request; package **not
allowlisted** (fully scanned); src **import-free**; src self-scan finds no forbidden mechanism; guard PASS
`allowlist=1 violations=0`.

## 11. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change** — still `['packages/isolated-signer-runtime/src/']`. Guard PASS `sources=81
  fixtures=27 allowlist=1 violations=0` (the new package's 2 `.mjs` are **fully scanned**, +2 sources).
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
Any RPC/send/broadcast mechanism · any tx build/serialize (`new Connection(` / `sendTransaction` / `.serialize(`)
· any provider SDK import / dependency install / lockfile change · any live provider call/endpoint/RPC URL · any
credential/secret/key material · any mainnet/REAL-LIVE · any `ALLOWLIST` change/new path · any new
SSOT/API/DATA/CONFIG name → ARCH→SSOT first · any `candidate_*`→implemented → **STOP**.

---

**Confirmations:** Send-gate skeleton only · No RPC/provider introduced · No send/broadcast introduced · No
transaction serialization introduced · No mainnet introduced · No REAL-LIVE activation · No KMS/Vault/KeyManager
introduced · No private key material introduced · No new execution authority introduced.
