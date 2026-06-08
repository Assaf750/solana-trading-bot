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
- `key_material_not_accepted` — key-material-shaped input (refused, never echoed). This includes a secret-NAMED
  field, a key-material-shaped STRING (PEM / long base58 / mnemonic), AND a key-material-shaped string **value**
  smuggled into an opaque reference field (e.g. `provider_ref` / `endpoint_ref`) — such a value is never accepted
  as a "valid reference".
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

## Provider registry (Helius first, 3 slots, no-live)
**Gate E / PR-E2-F-9 — a CONTRACT-ONLY provider registry over up to 3 provider SLOTS.** It is additive: it does
not change any existing export or behaviour. It carries **no live mechanism** — no SDK, no dependency, no endpoint
URL, no API key, no secret, no send. Every result is **fail-closed** (`configured: false`, `has_rpc: false`,
`can_send: false`, `is_live: false`) and is built from **fixed literals** + a numeric count + frozen reason
tokens; slot contents / `provider_ref` / endpoint values are **never echoed**. Per-slot validation **reuses** the
hardened `validateRpcProviderConfig` (shape + testnet + endpoint + key-material + unknown-field) — it is not
weakened.

### Docs alignment (provider roles — do NOT mix)
- **`helius`** — the **only ENABLED** provider reference now (reference-only, **NO live**).
- **`triton`, `yellowstone`** — **doc-listed DISABLED/future** references only (placeholders; **not enabled, not
  live**). A slot naming one of these is rejected with `provider_not_enabled`.
- **Jito** (execution/bundle) and **Jupiter** (routing) are **NOT RPC providers** in this contract and are
  **excluded** from the registry.

The provider tokens `'helius'` / `'triton'` / `'yellowstone'` are **string-literal VALUES** (provider references),
never import specifiers — the module stays import-free and guard-safe.

### Registry surface
- `RPC_PROVIDER_MAX_SLOTS` → `3`.
- `describeRpcProviderRegistry()` → frozen descriptor: `contract: 'rpc-provider-registry'`, `version`,
  `max_provider_slots: 3`, `supported_provider_refs: ['helius']`,
  `doc_listed_disabled_provider_refs: ['triton','yellowstone']`, all of `configured`/`has_rpc`/`can_send`/`is_live`
  `false`, `status: 'unconfigured_no_rpc'`, plus a one-line `note`.
- `listSupportedRpcProviderRefs()` → frozen `['helius']`.
- `normalizeRpcProviderSlots(input)` → frozen `{ count, within_capacity (count>=1 && count<=3),
  max_provider_slots: 3, status }`. Coerces input (`Array` → itself · `{slots:Array}` → `slots` · a single
  slot-shaped object → `[it]` · `null`/`undefined`/other → `[]`), counts entries (iteration capped to guard huge
  inputs), and **never echoes slot contents**. `status` is `unconfigured_no_rpc` (count 0) ·
  `within_capacity_no_rpc` · `over_capacity`. **Never throws** — a hostile/throwing accessor returns
  `{ count: 0, within_capacity: false, max_provider_slots: 3, status: 'invalid' }`.
- `validateRpcProviderSelection(selection)` → frozen `{ valid, status, reasons, configured: false,
  has_rpc: false, can_send: false, slot_count, max_provider_slots: 3 }`. Coerces to a slots array (same coercion),
  validates each slot via `validateRpcProviderConfig` (per-slot reasons propagated as fixed tokens), then
  classifies each slot's `provider_ref` against the enabled / doc-listed-disabled lists. A `valid` selection is
  **references-only** and stays `configured: false` / `has_rpc: false` / `can_send: false` (**NOT live**). The
  result is built from **fixed literal** reason tokens + a numeric `slot_count` — slot / `provider_ref` / endpoint
  / secret VALUES are **never echoed**. **Never throws** — a hostile/throwing accessor returns a fixed
  `status: 'invalid'`, `reasons: ['input_inspection_error']` refusal.

### Selection reason vocabulary (`validateRpcProviderSelection`)
- `no_provider_slots` — zero slots after coercion.
- `too_many_provider_slots` — more than 3 slots.
- `provider_not_enabled` — slot names a doc-listed DISABLED reference (`triton` / `yellowstone`).
- `unknown_provider` — slot names a reference outside the enabled and doc-listed lists.
- `duplicate_provider` — the same enabled reference appears in more than one slot.
- *(propagated per-slot from `validateRpcProviderConfig`)* `missing_config`, `missing_provider_ref`,
  `mainnet_or_nontestnet_environment_blocked`, `endpoint_or_rpc_indicator_blocked`,
  `send_or_broadcast_indicator_blocked`, `key_material_not_accepted`, `unknown_field_rejected`,
  `input_inspection_error`.

Selection status values: `selection_valid_no_rpc` (valid references-only selection of 1–3 enabled providers) ·
`unconfigured_no_rpc` (zero slots) · `invalid` (any blocking reason). Slots normalization status values:
`unconfigured_no_rpc` · `within_capacity_no_rpc` · `over_capacity` · `invalid`.

## Helius endpoint provisioning (reference-only, no-live/no-secret)
**Gate E / PR-E2-F-10 — a CONTRACT-ONLY Helius endpoint-provisioning layer.** It is additive: it does not
change any existing export or behaviour. "Provisioning" here means **classifying the shape** of a reference-only
provisioning description — it provisions, activates, and contacts **nothing**. It carries **no live mechanism**:
no live RPC, no SDK, no dependency, no endpoint URL, no API key, no secret/token, no send. Every result is
**fail-closed** (`configured: false`, `has_rpc: false`, `ready: false`, `can_send: false`, `is_live: false`) and
is built from **fixed literals** + frozen reason tokens + a numeric `slot_count`; input / `endpoint_ref` / secret
values are **never echoed**. Per-slot shape validation **reuses** the hardened `validateRpcProviderConfig`
(testnet-family environment; refuses mainnet / url / api_key / rpc / provider_url; refuses key material; rejects
unknown fields; treats `endpoint_ref` as an optional opaque reference that refuses endpoint/url/rpc indicators) —
it is **not weakened**.

### Allowed shape
A provisioning slot is the same **opaque-reference** shape validated elsewhere in this contract: a `provider_ref`
(must be the enabled `helius` reference), a testnet-family `environment` (`devnet` / `testnet` / `localnet`), and a
**required** `endpoint_ref` that is a **non-empty opaque reference string** — a label/handle that names an endpoint
by reference only. There is **no endpoint URL, no host, no scheme, no API key, no secret, and no token** anywhere
in the shape.

### Forbidden indicators (prose — no real URL/key shown)
The `endpoint_ref` must stay an opaque reference. It is **refused** (conservatively, by case-insensitive substring)
if it carries any **secret-style indicator** — the words for a *secret*, a *token*, a *credential*, an *api key*
(spelled either as one word or with an underscore), or a *private key* (spelled either as one word or with an
underscore). Beyond these secret indicators, the reused `validateRpcProviderConfig` independently refuses any
*endpoint / RPC / URL / provider-URL / cluster / websocket* indicator and any *mainnet / prod* indicator, and
refuses key-material-shaped input. No literal endpoint URL or API key is shown here or accepted anywhere.

### Provisioning surface
- `describeHeliusEndpointProvisioningContract()` → frozen descriptor: `contract:
  'helius-endpoint-provisioning'`, `version`, `provider_ref: 'helius'`, `supported_environments:
  ['devnet','testnet','localnet']`, `max_provider_slots: 3`, all of `configured`/`has_rpc`/`ready`/`can_send`/
  `is_live` `false`, `status: 'unconfigured_no_rpc'`, plus a one-line `note`.
- `validateHeliusEndpointProvisioning(input)` → **single-slot** validation. Frozen `{ valid, status, reasons,
  configured: false, has_rpc: false, ready: false, can_send: false, is_live: false }`. Reuses
  `validateRpcProviderConfig` for the shape, classifies `provider_ref` (enabled `helius` vs. doc-listed disabled
  `triton`/`yellowstone` → `provider_not_enabled` vs. `unknown_provider`), and requires `endpoint_ref` to be a
  present, opaque reference free of secret indicators. **Never throws** — a hostile/throwing accessor returns a
  fixed `status: 'invalid'`, `reasons: ['input_inspection_error']` refusal.
- `validateProviderEndpointRefs(selection)` → **multi-slot** (1–3) validation. Frozen `{ valid, status, reasons,
  configured: false, has_rpc: false, ready: false, can_send: false, is_live: false, slot_count,
  max_provider_slots: 3 }`. Coerces to a slots array (`Array` → itself · `{slots:Array}` → `slots` · a single
  slot-shaped object → `[it]` · else → `[]`), validates each slot via `validateHeliusEndpointProvisioning`
  (per-slot reasons propagated as fixed tokens), and detects duplicate `endpoint_ref` across slots. The result is
  built from **fixed literals** + a numeric `slot_count` — slot / `endpoint_ref` / secret values are **never
  echoed**. **Never throws** — a hostile/throwing accessor returns a fixed `status: 'invalid'`, `reasons:
  ['input_inspection_error']`, `slot_count: 0` refusal.

### Provisioning reason vocabulary
- `endpoint_ref_missing` — `endpoint_ref` is absent or not a non-empty string.
- `endpoint_secret_indicator_blocked` — `endpoint_ref` carries a secret / token / credential / api-key /
  private-key indicator (refused; never echoed).
- `duplicate_endpoint_ref` — the same `endpoint_ref` appears in more than one slot (`validateProviderEndpointRefs`).
- *(also)* `provider_not_enabled` / `unknown_provider`, plus the per-slot tokens propagated from
  `validateRpcProviderConfig` (`missing_config`, `missing_provider_ref`,
  `mainnet_or_nontestnet_environment_blocked`, `endpoint_or_rpc_indicator_blocked`,
  `send_or_broadcast_indicator_blocked`, `key_material_not_accepted`, `unknown_field_rejected`,
  `input_inspection_error`), and the multi-slot tokens `no_provider_slots` / `too_many_provider_slots`.

Provisioning status values: `provisioning_valid_no_live` (valid references-only provisioning shape — still **NOT
live**) · `unconfigured_no_rpc` (missing `endpoint_ref`/`provider_ref`/environment, or zero slots) · `invalid`
(any other blocking reason). A `valid` provisioning shape configures/activates **nothing**.

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
