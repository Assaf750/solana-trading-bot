# @soltrade/rpc-provider-contract

**Gate E / E2-F-7 — RPC Provider CONTRACT + FAIL-CLOSED SKELETON. Contract/skeleton only. This is NOT an RPC client.**

This package defines *what an RPC provider boundary must be* and ships a *fail-closed provider that is never
configured and always reports not-ready*. It contains **no live mechanism**: no RPC/provider client or SDK, no
Solana/Jupiter/Helius/Jito, no endpoint URL, no network call, no transaction building or serialization, no
signing/sending, no broadcast, no KMS/vault, no `KeyManager`, no key material, no DB. It performs no work and
contacts nothing.

## Why a standalone package (outside the allowlist)
A pure contract/skeleton has no live mechanism, so it lives **outside** the mechanism guard's allowlist
(`packages/isolated-signer-runtime/src/`) and is **fully scanned** — proving it carries zero forbidden families.
The allowlisted path is reserved for *future, separately-approved live* RPC/execution code; a fail-closed
skeleton does not belong there. A real RPC provider / live endpoint is a separate, explicitly-approved PR and is
**not started** here. The result-model field names below are function-return names, **not** SSOT/API/CONFIG
vocabulary.

## Contract
A conforming RPC provider boundary is a component that:
- is **never configured** by this skeleton (`configured: false`) and has **no RPC surface** (`has_rpc: false`),
- **never sends** (`can_send: false`) and **never broadcasts** (`can_broadcast: false`),
- has **no live surface** (`is_live: false`),
- **refuses key-material input** (`accepts_key_material_input: false`),
- is **fail-closed**: every readiness evaluation resolves to not-ready (`ready: false`) until a real,
  separately-approved RPC path is integrated.

## API (contract/skeleton)
- `describeRpcProviderContract()` → frozen capability descriptor (all rpc/send/broadcast/live caps `false`).
- `createFailClosedRpcProvider()` → opaque provider; `isConfigured()` is `false`; exposes only `describe()`,
  `validateConfig()`, and `evaluateReadiness()` — **no** `send`/`broadcast`/`serialize`/`sendTransaction`/
  `connect`/`rpc`/`submit` method.
- `validateRpcProviderConfig(config)` → validation-only shape check of **opaque references** (no SDK, no live
  call, no activation). A `valid` shape is references-only and **does not configure** (`configured: false`,
  `has_rpc: false`). Known fields ONLY: `provider_ref`, `environment`, `endpoint_ref`.
- `evaluateRpcReadiness(input)` → pure; **always** returns the not-ready result below. `input` is a *simulated*
  readiness description, never a live probe.
- `refusesKeyMaterial(input?)` → predicate used to assert key-material refusal in tests/diagnostics.
- `RPC_PROVIDER_CONTRACT_STATUS` → `'unconfigured_no_rpc'`.

## Fail-closed readiness result (always)
```
{
  ready: false,
  configured: false, has_rpc: false, can_send: false, can_broadcast: false, live_rpc_enabled: false,
  status: 'unconfigured_no_rpc',
  reason: 'rpc_provider_unconfigured_no_rpc',
  blockers: [ ... ]
}
```
The result is built from **fixed literals** — input is never echoed and nothing is ever sent. A perfectly
valid-looking devnet/testnet input is **still not-ready** (foundational `rpc_provider_unconfigured_no_rpc`:
there is no RPC and no live path at all). Input inspection is wrapped in `try/catch`, so a hostile/throwing
accessor **returns** a refusal and the evaluator **never throws** — fail-safe-not-fail-open.

## Refusal / blocker vocabulary
Readiness blockers (`evaluateRpcReadiness`):
- `live_rpc_disabled_by_default` — live RPC is off unless `input.live_rpc_enabled === true`.
- `missing_endpoint` — `input.endpoint_present !== true`.
- `provider_failed` — `input.provider_status === 'failed'`.
- `mainnet_indicator_blocked` — any `mainnet` / `mainnet-beta` / `prod` indicator.
- `endpoint_or_rpc_blocked` — endpoint / RPC / provider-URL / cluster / websocket indicator.
- `send_or_broadcast_indicator_blocked` — broadcast / send intent.
- `key_material_not_accepted` — key-material-shaped input (refused, never echoed).
- `input_inspection_error` — a hostile/throwing accessor; inspection is caught and the input is still refused.
- `rpc_provider_unconfigured_no_rpc` — **foundational**, always present and always last: no RPC, no live path.

Config validation reasons (`validateRpcProviderConfig`):
- `missing_config`, `missing_provider_ref` — required references absent.
- `mainnet_or_nontestnet_environment_blocked` — `environment` not in `{devnet,testnet,localnet}`, or a
  mainnet/prod indicator anywhere.
- `endpoint_or_rpc_indicator_blocked` — endpoint / RPC / URL indicator in a reference value.
- `send_or_broadcast_indicator_blocked` — broadcast / send indicator.
- `key_material_not_accepted` → status `invalid_key_material`.
- `unknown_field_rejected` — any field outside the known reference fields.

Config status values: `reference_valid_no_rpc` (valid references-only shape) · `unconfigured_no_rpc` (missing
core fields) · `invalid_key_material` (key material) · `invalid` (other blocked indicators).

## Failure model
`unconfigured_no_rpc` is the only contract status. There is no configured/live branch. No operation does I/O,
crypto, signing, serialization, broadcast, or any network call.

## Explicitly NOT in this package
RPC/provider SDK · Solana/Jupiter/Helius/Jito · live endpoint URL · network call · transaction
building/serialization · signing/sending · broadcast · KMS/Vault · `KeyManager` · configured-handle wiring ·
private keys/seeds/keypairs/mnemonics · DB writes · mainnet · REAL-LIVE activation · execution authority · any
`ALLOWLIST`/allowlist-path change.

## Evidence
This milestone is **implementation-first**: the package ships the contract + fail-closed skeleton, and **the
tests are the proof** (added by the test-agent). The mechanism guard fully scans this non-allowlisted package;
the suite asserts the import-free shape, the always-not-ready / always-invalid behaviour, key-material refusal,
indicator blocking, and that no send/broadcast/RPC method is ever exposed.

## Next steps (each a separate, explicitly-approved PR)
A real RPC provider integration — testnet-first, with its own endpoint/provider decision, behind this fail-closed
boundary — is a separate PR and is **not started** by this package. **Mainnet / REAL-LIVE activation is a
distinct later decision and is not started here.**
