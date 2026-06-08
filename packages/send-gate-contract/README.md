# @soltrade/send-gate-contract

**Gate E / E2-F-1 — Send Gate CONTRACT + FAIL-CLOSED SKELETON. Contract/skeleton only. This is NOT a sender.**

This package defines *what a send gate must be* and ships a *fail-closed gate that always refuses*. It contains
**no live mechanism**: no RPC/provider client, no Solana/Jupiter/Helius/Jito, no transaction building or
serialization, no signing/sending, no broadcast, no network call, no KMS/vault, no `KeyManager`, no key
material, no DB. It performs no work, contacts nothing, and never produces a signature.

## Milestone 2 — consumes the rpc-provider contract (fail-closed)
This gate **consumes the sibling `@soltrade/rpc-provider-contract` CONTRACT result** in a fail-closed way. It
imports `evaluateRpcReadiness` / `validateRpcProviderConfig` (relative, internal — no external/SDK import) and
**derives** provider readiness/config from the contract — it never trusts a caller-supplied readiness flag. This
is **NOT** live integration: `evaluateRpcReadiness` is always not-ready and `validateRpcProviderConfig` never
configures, so a supplied `rpc_provider` always yields `rpc_provider_not_ready` and a missing one yields
`rpc_provider_missing`. The foundational refusal (`send_gate_unconfigured_no_rpc`) remains **always present**, so
every evaluation still resolves to refused. No live RPC, no SDK, no dependency, no send/broadcast, no
serialization is introduced.

## Milestone 3 — consumes the endpoint binding harness (fail-closed)
This gate also **consumes the sibling `@soltrade/rpc-provider-contract` F11 endpoint-reference BINDING HARNESS**
(`bindEndpointReferenceForTest` / `validateEndpointReferenceBinding`) in a fail-closed way — same relative,
internal import (still the **only** import; no external/SDK import). The harness reads **no env**, reads **no
secret file**, contacts **no provider**, accepts **no URL / API key / secret**, returns **no raw endpoint**, and
makes **no network call**.

The consumption is **opt-in and test-only**: it runs **only when** the request supplies an
`endpoint_binding_map`. The optional test-only input shape is:

```
{
  rpc_provider:        { provider_ref: 'helius', environment: 'devnet', endpoint_ref: '<opaque-ref>' },
  endpoint_binding_map: { '<opaque-ref>': { bound: true, provider_ref: 'helius',
                                            environment: 'devnet', endpoint_kind: 'reference_only' } }
}
```

`rpc_provider` is reused as the binding **input** and `endpoint_binding_map` is a test-only **in-memory** map of
opaque reference-only entries. Readiness is **derived from the contract**, never from a caller flag.

**Even a valid reference-bound Helius binding still refuses.** A successful bind does **not** open send: the gate
records the fixed blocker `endpoint_binding_no_live`, `can_send` stays `false`, and the foundational
`send_gate_unconfigured_no_rpc` is still present, so the result remains refused. The whole block stays inside the
gate's `try/catch`, so a hostile `rpc_provider` **or** hostile `endpoint_binding_map` yields the existing
`input_inspection_error` refusal and never throws. No live RPC, no SDK, no dependency, no endpoint URL, no
secret, no send/broadcast, no serialization is introduced. `describeSendGateContract()` records
`consumes_endpoint_binding: true` (a function-return descriptor field, not SSOT).

### Endpoint-binding blocker vocabulary
- `endpoint_binding_input_no_live` — the supplied binding **input** shape is acceptable as opaque references but
  is still reference-only and **never live** (a valid shape never opens send).
- `endpoint_binding_not_bound` — the endpoint_ref did not resolve to a bound test-only reference entry (unbound
  or invalid binding).
- `endpoint_binding_no_live` — even a **valid** reference-bound binding still refuses send (always recorded on a
  successful bind).
- `endpoint_binding:*` — the harness's own fixed reason tokens, surfaced with an `endpoint_binding:` prefix (e.g.
  `endpoint_binding:endpoint_ref_unbound`, `endpoint_binding:endpoint_or_rpc_indicator_blocked`,
  `endpoint_binding:endpoint_secret_indicator_blocked`, `endpoint_binding:mainnet_or_nontestnet_environment_blocked`,
  `endpoint_binding:key_material_not_accepted`, `endpoint_binding:endpoint_ref_provider_mismatch`,
  `endpoint_binding:endpoint_ref_environment_mismatch`, `endpoint_binding:input_inspection_error`). These are
  fixed-literal strings and **never echo input values**.

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
- `describeSendGateContract()` → frozen capability descriptor (all send/broadcast/serialize/RPC/live caps `false`;
  `consumes_rpc_provider: true` records that the gate consumes the rpc-provider contract result fail-closed;
  `consumes_endpoint_binding: true` records that the gate consumes the F11 endpoint-reference binding harness
  fail-closed — even a valid reference-bound binding still refuses).
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
- `rpc_provider_missing` — no `rpc_provider` supplied on the request (consumed from the rpc-provider contract).
- `rpc_provider_not_ready` — the rpc-provider contract reports not-ready (always, since it never configures).
- `rpc_provider_key_material` — the rpc-provider contract classified the provider config as key-material.
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
