# @soltrade/send-gate-contract

**Gate E / E2-F-1 — Send Gate CONTRACT + FAIL-CLOSED SKELETON. Contract/skeleton only. This is NOT a sender.**

This package defines *what a send gate must be* and ships a *fail-closed gate that always refuses*. It contains
**no live mechanism**: no RPC/provider client, no Solana/Jupiter/Helius/Jito, no transaction building or
serialization, no signing/sending, no broadcast, no network call, no KMS/vault, no `KeyManager`, no key
material, no DB. It performs no work, contacts nothing, and never produces a signature.

## Why a standalone package (outside the allowlist)
A pure contract/skeleton has no live mechanism, so it lives **outside** the mechanism guard's allowlist
(`packages/isolated-signer-runtime/src/`) and is **fully scanned** — proving it carries zero forbidden
families. The allowlisted path is reserved for *future, separately-approved live* send/execution code; a
fail-closed skeleton does not belong there. Real send / RPC / testnet broadcast is a separate, explicitly
approved PR and is **not started** here.

## Contract
A conforming send gate is a component that:
- **never sends** (`can_send: false`), **never broadcasts** (`can_broadcast: false`),
- **never builds or serializes a transaction** (`can_serialize: false`),
- has **no RPC/provider surface** (`has_rpc: false`, `is_live: false`),
- **refuses key-material input** (`accepts_key_material_input: false`),
- **requires prior sign-only success** (`requires_sign_only_success: true`) — send never happens without it,
- is **fail-closed**: every evaluation resolves to refused (`ok: false`) until a real, separately-approved send
  path is integrated.

## API (contract/skeleton)
- `describeSendGateContract()` → frozen capability descriptor (all send/broadcast/serialize/RPC/live caps `false`).
- `createFailClosedSendGate()` → opaque gate; `isConfigured()` is `false`; exposes only `describe()` and
  `evaluateSendPreflight()` — **no** `send`/`broadcast`/`serialize` method.
- `evaluateSendPreflight(input)` → pure; **always** returns the refused result below.
- `refusesKeyMaterial(input?)` → predicate used to assert refusal behaviour.
- `SEND_GATE_CONTRACT_STATUS` → `'unconfigured_no_rpc'`.

## Fail-closed result (always)
```
{
  ok: false, sent: false, broadcast: false,
  signature: null, transaction: null, serialized: null,
  can_send: false, can_broadcast: false, can_serialize: false, has_rpc: false, is_live: false,
  status: 'unconfigured_no_rpc',
  reason: 'send_gate_unconfigured_no_rpc',
  blockers: [ ... ]
}
```
The result is built from **fixed literals** — request input is never echoed and no signature is ever produced.
A perfectly valid-looking devnet/testnet request is **still refused** (foundational `send_gate_unconfigured_no_rpc`:
there is no RPC and no send path at all).

## Refusal / blocker vocabulary
- `key_material_not_accepted` — key-material-shaped input (refused, never echoed).
- `mainnet_indicator_blocked` — any `mainnet` / `mainnet-beta` / `prod` indicator.
- `endpoint_or_rpc_blocked` — endpoint / RPC / provider-URL / cluster / websocket indicator.
- `broadcast_or_send_indicator_blocked` — broadcast / send intent.
- `serialized_or_raw_tx_blocked` — serialized / raw / wire transaction indicator.
- `sign_only_not_completed` — prior sign-only success is missing.
- `readiness_not_ready` / `preflight_not_ok` / `custody_not_active` — gate preconditions unmet.
- `input_inspection_error` — a hostile/throwing accessor in the request; inspection is caught and the request
  is still refused (never re-thrown, never echoed) — fail-safe-not-fail-open.
- `send_gate_unconfigured_no_rpc` — **foundational**, always present: no RPC, no send path.

## Failure model
`unconfigured_no_rpc` is the only state. There is no configured/live branch. No operation does I/O, crypto,
signing, serialization, broadcast, or any network call.

## Explicitly NOT in this package
RPC/provider SDK · Solana/Jupiter/Helius/Jito · transaction building/serialization · signing/sending · broadcast
· network call · KMS/Vault · `KeyManager` · configured-handle wiring · private keys/seeds/keypairs/mnemonics ·
DB writes · REAL-LIVE activation · execution authority · any `ALLOWLIST`/allowlist-path change.

## Next steps (each a separate, explicitly-approved PR)
Real send/testnet-broadcast work — testnet-first, behind this gate, with its own RPC/provider decision — is a
separate PR and is **not started** by this package. **Mainnet / REAL-LIVE activation is a distinct later
decision and is not started by any of these.**
