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

## Endpoint reference binding harness (test-only, reference-only, no-live/no-secret)
**Gate E / PR-E2-F-11 — a CONTRACT-ONLY endpoint-reference BINDING HARNESS.** It is additive: it does not change
any existing export or behaviour. It proves that an opaque `endpoint_ref` can be **bound** to a **TEST-ONLY
IN-MEMORY binding map** and **stay fail-closed**. It is **NOT live**: it reads **no env**, reads **no secret
file**, contacts **no provider**, accepts **no URL / API key / secret**, returns **no raw endpoint**, makes **no
network call**, and **never** sets `has_rpc` / `ready` / `can_send` / `is_live` true. "Binding" here means a pure
in-memory lookup that **classifies** whether an `endpoint_ref` is present in a caller-supplied test-only map of
opaque reference-only entries — it binds, activates, and contacts **nothing real**. Input + binding-entry shape
validation **reuses** the hardened `validateHeliusEndpointProvisioning` + `looksLikeKeyMaterial` + the existing
indicator token lists — they are **not weakened**.

### Allowed binding input
The binding `input` is the same **opaque-reference** shape validated elsewhere in this contract: a `provider_ref`
(the enabled `helius` reference), a testnet-family `environment` (`devnet` / `testnet` / `localnet`), and a
**required** non-empty opaque `endpoint_ref` string. There is **no endpoint URL, no host, no scheme, no API key,
no secret, and no token** anywhere in the shape.

### Test-only binding-map shape
The `bindingMap` is a **TEST-ONLY plain object** supplied by the caller (a test), mapping `endpoint_ref` → an
opaque reference-only entry of the form `{ bound: true, provider_ref, environment, endpoint_kind:
'reference_only' }`. It exists **only in memory for a test** — it is never read from env or a secret file and
never wired to anything live. The entry holds **opaque references only**: no URL, no host, no scheme, no API key,
no secret, no token, no key material. Any `has_rpc` / `ready` / `can_send` / `is_live` / `configured` flag on an
entry is **ignored and never trusted** — the result flags are **fixed literals** (all false).

### Forbidden indicators (prose — no real URL/key shown)
A binding-map entry is **screened exactly like an input** (its keys OR string values, shallow + one nested level,
case-insensitive substring). It is **refused** (and never echoed) if it carries: an *endpoint / RPC / provider-URL
/ cluster / websocket / url* indicator (→ `endpoint_or_rpc_indicator_blocked`); a *secret / token / credential /
api-key / private-key* indicator (→ `endpoint_secret_indicator_blocked`); a *mainnet / prod* indicator (→
`mainnet_or_nontestnet_environment_blocked`); or key-material-shaped content (→ `key_material_not_accepted`). No
literal endpoint URL or API key is shown here or accepted anywhere.

### Binding surface
- `describeEndpointReferenceBindingHarness()` → frozen descriptor: `contract:
  'endpoint-reference-binding-harness'`, `version`, `test_only: true`, `reads_env: false`, `reads_secret_files:
  false`, `provider_ref: 'helius'`, `supported_environments: ['devnet','testnet','localnet']`, all of
  `configured`/`has_rpc`/`ready`/`can_send`/`is_live`/`network_call_made` `false`, `status:
  'unconfigured_no_rpc'`, plus a one-line `note`.
- `validateEndpointReferenceBinding(input)` → validates a single binding **input** shape as opaque references
  (reuses `validateHeliusEndpointProvisioning`). Frozen `{ valid, status, reasons, configured: false, has_rpc:
  false, ready: false, can_send: false, is_live: false, network_call_made: false }`. A valid shape uses status
  `reference_bound_no_live`; otherwise the provisioning status is propagated. **Never throws** — a
  hostile/throwing accessor returns a fixed `status: 'invalid'`, `reasons: ['input_inspection_error']` refusal.
  Input is **never echoed**.
- `bindEndpointReferenceForTest(input, bindingMap)` → the harness **core**. Validates the input shape, requires a
  non-null plain-object `bindingMap`, looks up `bindingMap[input.endpoint_ref]`, screens the entry like an input,
  and checks `provider_ref` / `environment` match. Frozen `{ bound, valid, status, reasons, configured: false,
  has_rpc: false, ready: false, can_send: false, is_live: false, network_call_made: false }`. `bound` is true
  **only** when there are no reasons and the entry is present with `bound === true`; the result flags are **fixed
  literals** (all false) and any entry flags are **ignored**. **Never throws** — a hostile/throwing accessor
  returns a fixed `bound: false`, `status: 'invalid'`, `reasons: ['input_inspection_error']` refusal. Input /
  `endpoint_ref` / binding-entry VALUES are **never echoed**.

### Binding reason vocabulary
- `endpoint_ref_unbound` — the `endpoint_ref` is absent from the binding map, or the map is missing / not a
  plain object, or the matched entry is not `bound: true`.
- `endpoint_ref_provider_mismatch` — the bound entry's `provider_ref` does not match the input's `provider_ref`.
- `endpoint_ref_environment_mismatch` — the bound entry's `environment` does not match the input's `environment`.
- *(also)* the screened-entry tokens `endpoint_or_rpc_indicator_blocked` / `endpoint_secret_indicator_blocked` /
  `mainnet_or_nontestnet_environment_blocked` / `key_material_not_accepted`, plus the per-input tokens propagated
  from `validateHeliusEndpointProvisioning` (`endpoint_ref_missing`, `provider_not_enabled`, `unknown_provider`,
  `missing_config`, `missing_provider_ref`, `mainnet_or_nontestnet_environment_blocked`,
  `endpoint_or_rpc_indicator_blocked`, `unknown_field_rejected`, `input_inspection_error`).

Binding status values: `reference_bound_no_live` (the `endpoint_ref` matched a test-only in-memory reference entry
— still **NOT live**) · `unbound` (`endpoint_ref` not bound) · `unconfigured_no_rpc` (missing core input fields,
propagated from provisioning) · `invalid` (any other blocking reason). A `bound` result binds/activates **nothing
real**, makes **no network call**, and reads **no env / secret**.

## Live RPC spike boundary (test-only, no-broadcast, no-live)
**Gate E / PR-E2-F-13 — a CONTRACT-ONLY "Live RPC Spike Boundary".** It is additive: it does not change any
existing export or behaviour. It **describes / validates the conditions of a FUTURE testnet RPC spike REQUEST** and
executes **NO live RPC**. It is **NOT live** in any way: **no** live RPC call, **no** endpoint resolution, **no**
env/secret read, **no** fetch / WebSocket / Connection, **no** SDK / dependency, and **no** send / broadcast /
serialize. A spike boundary **never sends, never broadcasts, never serializes** — it must be a **no-broadcast**
request **bound** to a **TEST-ONLY in-memory** endpoint reference. Everything is **fail-closed**: every result
field is a **fixed literal** (all false / not-ready / not-live), input / `endpoint_ref` / secret / binding values
are **never echoed**, and `provider_ref` is only ever the recognized literal `helius` while `environment` is only
a recognized testnet enum value. The layer **reuses** the hardened `bindEndpointReferenceForTest` +
`validateHeliusEndpointProvisioning` + `looksLikeKeyMaterial` + the existing indicator token lists — they are
**not weakened**. A real testnet RPC spike (a live call) is a separate, explicitly-approved PR and is **not
started** here.

### Allowed request shape
A spike-boundary `input` is the same **opaque-reference** shape validated elsewhere in this contract, plus two
spike-only fields: a `provider_ref` (the enabled `helius` reference), a testnet-family `environment` (`devnet` /
`testnet` / `localnet`), a **required** non-empty opaque `endpoint_ref` string, a `purpose` that **must** equal
`live_rpc_spike_boundary`, and a `no_broadcast` flag that **must** be exactly `true`. Known request fields are
**only** `provider_ref`, `environment`, `endpoint_ref`, `purpose`, `no_broadcast` — any other field (including a
smuggled `has_rpc` / `ready` / `can_send` / `is_live` / `configured` / `broadcast` / `live_rpc_call_made` flag) is
an unknown field and is **rejected**. There is **no endpoint URL, no host, no scheme, no API key, no secret, and no
token** anywhere in the shape.

### Test-only binding map
The `bindingMap` is the same **TEST-ONLY in-memory** map used by the binding harness: a caller-supplied plain
object mapping `endpoint_ref` → `{ bound: true, provider_ref, environment, endpoint_kind: 'reference_only' }`. It
exists **only in memory for a test**, is never read from env or a secret file, and is never wired to anything live.
The boundary requires the request's `endpoint_ref` to be **bound** in this map (via the reused
`bindEndpointReferenceForTest`); any entry flag is **ignored and never trusted**.

### Forbidden indicators (prose — no real URL/key shown)
Because a spike boundary never sends/broadcasts/serializes, the request is **refused** (and never echoed) if it
carries any **broadcast / send / serialize** indicator anywhere in its keys or values (for example a `broadcast`,
`send`, or `serialize` key, or such a flag set true) → `broadcast_or_send_indicator_blocked`. Beyond that, the
reused `validateHeliusEndpointProvisioning` independently refuses any *endpoint / RPC / URL / provider-URL /
cluster / websocket* indicator, any *secret / token / credential / api-key / private-key* indicator on the
`endpoint_ref`, any *mainnet / prod* indicator, and any key-material-shaped content. No literal endpoint URL or API
key is shown here or accepted anywhere.

### Faked-flag invariant
Any `has_rpc` / `ready` / `can_send` / `is_live` / `network_call_made` / `configured` / `broadcast` /
`live_rpc_call_made` field arriving on the input is **ignored for the result** — the result flags are **fixed
literals, all false**. If such a flag arrives as an unknown request field it is also **refused**
(`unknown_field_rejected`) — but even if tolerated, the result flags stay false.

### Spike-boundary surface
- `describeLiveRpcSpikeBoundaryContract()` → frozen descriptor: `contract: 'live-rpc-spike-boundary'`, `version`,
  `test_only: true`, `purpose: 'live_rpc_spike_boundary'`, `provider_ref: 'helius'`, `supported_environments:
  ['devnet','testnet','localnet']`, `requires_no_broadcast: true`, `requires_bound_endpoint_ref: true`, all of
  `configured`/`has_rpc`/`ready`/`can_send`/`can_broadcast`/`can_serialize`/`is_live`/`live_rpc_call_made`/
  `network_call_made`/`broadcast_permitted` `false`, `status: 'unconfigured_no_rpc'`, plus a one-line `note`.
- `validateLiveRpcSpikeBoundaryRequest(input)` → validates the **request shape only** (not the binding). Frozen
  `{ valid, status, reasons, configured: false, has_rpc: false, ready: false, can_send: false, can_broadcast:
  false, can_serialize: false, is_live: false, live_rpc_call_made: false, network_call_made: false,
  broadcast_permitted: false }`. Reuses `validateHeliusEndpointProvisioning` for the provider / environment /
  `endpoint_ref` / secret / key-material / mainnet shape (reasons propagated), requires `purpose ===
  'live_rpc_spike_boundary'` and `no_broadcast === true`, refuses any broadcast/send/serialize indicator, and
  rejects unknown fields. **Never throws** — a hostile/throwing accessor returns a fixed `status: 'invalid'`,
  `reasons: ['input_inspection_error']` refusal. Endpoint / secret values are **never echoed**.
- `evaluateLiveRpcSpikeBoundary(input, bindingMap)` → the boundary **core**. Validates the request shape, then
  reuses `bindEndpointReferenceForTest` against the test-only in-memory map; if not bound it pushes
  `endpoint_ref_unbound` and surfaces the binding reasons under an `endpoint_binding:` prefix. Frozen `{ valid,
  boundary_passed, status, provider_ref?, environment?, bound, reasons, configured: false, has_rpc: false, ready:
  false, can_send: false, can_broadcast: false, can_serialize: false, is_live: false, live_rpc_call_made: false,
  network_call_made: false, broadcast_permitted: false }`. `boundary_passed` (and `valid`) is true **only** when
  there are no reasons; `provider_ref` (only ever the literal `helius`) and `environment` (only a recognized
  testnet enum value) are echoed **only when valid**. The result flags are **fixed literals** (all false).
  **Never throws** — a hostile/throwing accessor returns a fixed `boundary_passed: false`, `status: 'invalid'`,
  `reasons: ['input_inspection_error']` refusal. Input / `endpoint_ref` / binding / secret values are **never
  echoed**.

### Spike-boundary reason vocabulary
- `purpose_invalid` — `purpose` is not exactly `live_rpc_spike_boundary`.
- `no_broadcast_required` — `no_broadcast` is not exactly `true`.
- `broadcast_or_send_indicator_blocked` — a `broadcast` / `send` / `serialize` indicator appears in the request
  (refused; never echoed).
- `endpoint_ref_unbound` — the request's `endpoint_ref` is not bound in the test-only in-memory map (the binding
  refusal reasons are surfaced under an `endpoint_binding:` prefix).
- *(also)* `unknown_field_rejected`, plus the per-request tokens propagated from
  `validateHeliusEndpointProvisioning` (`endpoint_ref_missing`, `endpoint_secret_indicator_blocked`,
  `provider_not_enabled`, `unknown_provider`, `missing_config`, `missing_provider_ref`,
  `mainnet_or_nontestnet_environment_blocked`, `endpoint_or_rpc_indicator_blocked`, `key_material_not_accepted`,
  `input_inspection_error`).

Spike-boundary status values: `live_rpc_spike_boundary_no_live` (the future-spike request is well-formed and the
`endpoint_ref` matched a test-only in-memory reference entry — still **NOT live**) · `unconfigured_no_rpc` (unbound
`endpoint_ref` or an unconfigured request shape) · `invalid` (any other blocking reason). A `boundary_passed`
result resolves / calls / sends **nothing**, makes **no network call**, and reads **no env / secret**.

## Live RPC Spike Approval Gate (test-only)
`describeLiveRpcSpikeApprovalGateContract` / `validateLiveRpcSpikeApprovalGate` / `evaluateLiveRpcSpikeApprovalGate`
(E2-F-14) validate the **SHAPE of an approval RECORD** for a FUTURE testnet RPC spike — they do not run, bind, or
authorize one. A well-formed record requires `purpose === 'live_rpc_spike_approval_gate'`,
`target === 'testnet_rpc_spike'`, the `helius` reference + a testnet/devnet/localnet `environment` + an opaque
`endpoint_ref`, and the boolean attestations `no_broadcast` / `no_send` / `no_mainnet` / `no_real_live` /
`requires_separate_live_spike_pr` / `requires_out_of_repo_endpoint_binding` / `requires_supply_chain_review` /
`requires_post_spike_revoke_or_disable` all `true`.

Even an **approved** record yields `approval_record_valid: true` / `approval_gate_passed: true` but
`live_rpc_authorized: false`, every capability/live flag (`can_send` / `can_broadcast` / `can_serialize` /
`is_live` / `real_live` / `network_call_made` / `live_rpc_call_made` / `broadcast_permitted`) `false`, and the
FIXED-LITERAL invariant `requires_separate_live_spike_pr: true`. In other words the gate authorizes **NOTHING
live**: a separate live-spike PR + out-of-repo endpoint binding + supply-chain review are always still required.
It performs **no** live RPC / endpoint resolution / network / send / SDK and reads **no** env / secret;
broadcast/send/serialize indicators, key-material-shaped input, and unknown fields are refused, and a
hostile/throwing accessor returns a frozen `input_inspection_error` refusal (never throws). Status values:
`live_rpc_spike_approval_gate_valid_no_live` · `unconfigured_no_rpc` · `invalid`.

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

## RPC Client / SDK Supply-Chain Review Gate (test-only, no-network)
`describeRpcClientSupplyChainGateContract()` / `validateRpcClientSupplyChainReview(input)` /
`evaluateRpcClientSupplyChainGate(input)` validate the **SHAPE** of a *supply-chain review RECORD* for a
**FUTURE** RPC client/SDK dependency. The record carries only **opaque client metadata** (`client_ref` name +
`client_version`) plus boolean attestations (`no_network` / `no_send` / `no_broadcast` / `no_serialize` /
`no_mainnet` / `no_real_live`, and `requires_lockfile_review` / `requires_supply_chain_review` /
`requires_separate_integration_pr` / `requires_pinned_version`).

An accepted record yields `review_record_valid: true` / `supply_chain_gate_passed: true` — but
`live_rpc_authorized: false`, `network_capability: false`, and **every** capability/live flag
(`configured` / `has_rpc` / `ready` / `can_send` / `can_broadcast` / `can_serialize` / `is_live` / `real_live` /
`network_call_made` / `live_rpc_call_made` / `broadcast_permitted`) stays `false`, plus
`requires_separate_integration_pr: true`. In other words, an approved review **authorizes NOTHING live and adds
NO dependency/network** — a separate integration PR + lockfile + supply-chain review are **still required**.

This gate performs **no network / fetch / endpoint resolution / SDK import / dependency**, and reads **no
env/secret**. A real endpoint **URL surface** (an `http(s)://` / `ws(s)://` scheme) / secret / key-material /
mainnet indicator in any field is **refused and never echoed** (no freeform input is reflected back) — while a
descriptive RPC/SDK package name (containing words like `rpc`/`sdk`/`client`/`endpoint`) is **allowed**, since the
gate stores/resolves nothing. A hostile/throwing input returns a frozen refusal with reason
`input_inspection_error` and never throws.
