# E2-F-16 — Out-of-Repo Endpoint Binding Adapter Boundary (no-secret-in-repo) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a
> CONTRACT-ONLY, **test-only** Out-of-Repo Endpoint Binding **Adapter Boundary** to
> `@soltrade/rpc-provider-contract`. It validates the **shape of a binding DESCRIPTOR** that describes how an
> `endpoint_ref` will LATER be bound to an **out-of-repo** source — proving (a) no endpoint / API-key / secret /
> token ever enters the code, tests, or docs, and (b) binding metadata alone never opens `has_rpc` / `can_send` /
> `live_rpc_authorized`. The REAL out-of-repo binding is **NOT implemented here and is a separate PR**. **No live
> RPC, no endpoint resolution, no network call, no fetch/WebSocket/Connection, no SDK import, no dependency, no
> env/secret read, no endpoint URL, no API key/secret/token, no private key material, no send/broadcast, no
> transaction serialization, no mainnet, no REAL-LIVE, no KMS/Vault/KeyManager integration.** Everything
> fail-closed. `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `1062be6` (branch `pr-e2-f16-out-of-repo-endpoint-binding-adapter-boundary-no-secret`)
> · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard
> `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 802/802.

---

## 1. Current state
`rpc-provider-contract` holds the fail-closed provider contract + F9 registry + F10 endpoint provisioning + F11
binding harness + F13 Live RPC Spike Boundary + F14 Live RPC Spike Approval Gate + F15 Supply-Chain Review Gate;
`send-gate-contract` consumes them fail-closed (F8/F12). This milestone adds an **out-of-repo binding adapter
boundary** — **additive**; existing exports are unchanged, so send-gate and the F9–F15 layers are unaffected.
F16 defines the *boundary* for a future binding to an out-of-repo endpoint/secret source; it binds nothing and
adds no dependency.

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeOutOfRepoEndpointBindingAdapterContract()` → frozen descriptor (`test_only:true`, `purpose:'out_of_repo_endpoint_binding_adapter'`, `provider_ref:'helius'`, supported environments + `supported_binding_source_kinds`, the `requires_*` + `requires_no_*` true, `secret_in_repo:false`/`endpoint_in_repo:false`, `binding_descriptor_valid:false`/`boundary_passed:false`/`live_rpc_authorized:false`/`network_capability:false`/`resolved:false`, every capability/`*_call_made`/`real_live`/`broadcast_permitted` flag false, `status:'unconfigured_no_rpc'`).
- `validateOutOfRepoEndpointBindingDescriptor(input)` — descriptor shape only.
- `evaluateOutOfRepoEndpointBindingBoundary(input)` — the boundary core.
Constants `BINDING_SOURCE_KINDS` (3) + `OOR_BINDING_REQUIRED_TRUE` (8) + `OOR_BINDING_REQUIRED_FALSE` (2) +
`OOR_BINDING_KNOWN_FIELDS` (15). Reuses the hardened `validateHeliusEndpointProvisioning` (3 reference fields
only) + `BROADCAST_SEND_BOUNDARY_TOKENS` (not weakened). Mirrors the F-14/F-15 fail-closed style. **No import; no
dependency added.**

## 3. Binding-adapter boundary summary
`evaluateOutOfRepoEndpointBindingBoundary(input)` validates the descriptor shape and, even when fully valid,
yields `{ binding_descriptor_valid:true, boundary_passed:true, status:'out_of_repo_endpoint_binding_valid_no_live',
provider_ref:'helius', environment:'devnet', binding_source_kind:'env_out_of_repo',
requires_separate_live_binding_pr:true, live_rpc_authorized:false, network_capability:false, resolved:false,
configured:false, has_rpc:false, ready:false, can_send:false, can_broadcast:false, can_serialize:false, is_live:false,
real_live:false, network_call_made:false, live_rpc_call_made:false, broadcast_permitted:false }`. When
`boundary_passed`, only the recognized literal `'helius'`, the validated testnet environment enum, and the
validated `binding_source_kind` enum are echoed — **never `endpoint_ref` or any freeform value**.
`requires_separate_live_binding_pr:true` is a **fixed-literal invariant** (not echoed input): the REAL out-of-repo
binding is always a separate PR.

## 4. Test-only binding descriptor model summary
Allowed input: `{ purpose:'out_of_repo_endpoint_binding_adapter', provider_ref:'helius',
environment∈{devnet,testnet,localnet}, endpoint_ref:'<opaque ref>',
binding_source_kind∈{env_out_of_repo, secret_manager_out_of_repo, operator_provided_out_of_repo},
secret_in_repo:false, endpoint_in_repo:false, no_network:true, no_send:true, no_broadcast:true, no_serialize:true,
no_mainnet:true, no_real_live:true, requires_out_of_repo_secret_source:true, requires_separate_live_binding_pr:true }`.
`binding_source_kind` is a **classification TAG** of where the real endpoint/secret lives *outside the repo* —
never the value itself; it is validated by exact enum match. Unknown fields rejected.

## 5. No-secret-in-repo model summary
`secret_in_repo` and `endpoint_in_repo` must each be attested **`false`** (missing or `true` → refused).
`endpoint_ref` is an opaque reference screened by the reused provisioning validator (URL/secret/key-material/
mainnet → refused & never echoed). A smuggled `api_key`/`secret`/`token` **field** is rejected as an unknown field
and never echoed. **No endpoint URL / raw endpoint / API key / secret / token / private key material exists
anywhere in the src, tests, or docs** — the only key-shaped strings in tests are obvious fakes injected as hostile
inputs, each asserted *not echoed*. (Guard-trap avoided: whole-record `looksLikeKeyMaterial` is **not** called,
because the legitimate field name `secret_in_repo` contains `'secret'` and would false-trip the secret-named-key
check; endpoint_ref key-material screening is delegated to provisioning, and `binding_source_kind` is exact-enum
matched so `secret_manager_out_of_repo` passes without false-tripping.)

## 6. Fake-binding stays closed summary
A "fake binding" — a descriptor with smuggled `has_rpc:true`/`can_send:true`/`is_live:true`/`real_live:true`/
`network_call_made:true`/`live_rpc_authorized:true`/`resolved:true` extra fields — is **rejected** (those are
unknown fields, `boundary_passed:false`) and **every result flag stays `false`**. Binding metadata alone never
opens any live/RPC/send capability.

## 7. No-network / no-resolution / no-SDK / no-dependency summary
The boundary makes **no** network/fetch/endpoint-resolution call and imports **no** SDK; `no_network` must be
attested true; `network_capability:false`, `network_call_made:false`, and `resolved:false` always. `package.json`
has **no** dependency added.

## 8. Separate-live-binding-PR / out-of-repo-secret-source requirements summary
`requires_separate_live_binding_pr` / `requires_out_of_repo_secret_source` must each be attested true (missing →
refused), and the result always emits `requires_separate_live_binding_pr:true` as a fixed invariant — the boundary
grants no binding/live authority; the actual out-of-repo binding is a distinct, separately-approved PR sourcing the
endpoint/secret from outside the repo.

## 9. Fail-closed model summary
All results frozen/fixed-literal; the valid path never sets any capability/`live_rpc_authorized`/`network_capability`/
`resolved`/`real_live`/`*_call_made`/`broadcast_permitted` true; URL/secret/`api_key`/`token`/key-material/mainnet/
broadcast/send/serialize → refused & **never echoed**; faked live flags ignored; both validators try/catch-wrapped
→ hostile/throwing input → frozen refusal (`input_inspection_error`), never throws/echoes.

## 10. Send-gate continuity summary
`send-gate-contract` untouched (no src change) — its 85/85 stay green; the boundary adds no send/RPC path.

## 11. No-live / no-SDK / no-env / no-secret / no-send confirmation
Module remains **import-free**; **no `process.env`, no `node:fs`/`node:process`, no `readFileSync`, no `fetch`/
`WebSocket`/`new Connection`**; no SDK/dependency; no live RPC call; no endpoint resolution; **no literal endpoint
URL / API key in src** (only bare scheme match-tokens + obvious test placeholders proven not echoed); no
send/broadcast/serialization; provider object exposes no send/broadcast/serialize method.

## 12. Documentation summary
README §"Out-of-Repo Endpoint Binding Adapter Boundary (test-only, no-secret-in-repo)" documents that the real
binding is out-of-repo and not implemented, and that binding metadata alone authorizes nothing live. This report
records the same.

## 13. Tests summary
~40 new boundary proofs (H1–H40 + static guard groups) appended to `rpc-provider-contract.test.mjs`.
**rpc-provider-contract suite 207/207 (was 180); send-gate-contract 85/85 (unchanged); full suite 802/802.**
Independent main-loop behavioral spot-check: 30/30 PASS.

## 14. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive to an existing src file; tokens are string values).

## 15. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 16. Remaining blockers / next approvals (each a separate, explicit decision)
- The **actual** out-of-repo endpoint binding (real endpoint/secret sourced from an out-of-repo location — env /
  secret manager / operator-provided — behind the existing fail-closed boundary, with no secret entering the repo)
  — **not started**; this PR only defines its boundary.
- RPC client/SDK integration (F15 supply-chain gate path); live testnet RPC spike; testnet broadcast; send
  implementation; `signer_control` + two-person; KMS SDK / real provider adapter; mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Contract-only out-of-repo endpoint binding adapter boundary
(test-only descriptor validation) · The real out-of-repo binding is NOT implemented and is a separate PR · An
approved descriptor grants no live authority · Binding metadata alone does not open has_rpc/can_send · No endpoint
URL/raw endpoint in repo · No API key/secret/token in repo · No private key material · No env/secret read · No
network call · No fetch/WebSocket/Connection · No SDK import · No dependency · No endpoint resolution · No live RPC
· No send/broadcast · No transaction serialization · No mainnet (as accepted value) · No REAL-LIVE · No
KMS/Vault/KeyManager integration · No new execution authority · No new SSOT name · ALLOWLIST unchanged.
