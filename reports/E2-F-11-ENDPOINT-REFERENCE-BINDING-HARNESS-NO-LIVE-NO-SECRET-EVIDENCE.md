# E2-F-11 — Endpoint Reference Binding Harness (no-live, no-secret) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a
> CONTRACT-ONLY, **test-only** endpoint-reference binding harness to `@soltrade/rpc-provider-contract`: it binds
> an `endpoint_ref` to a **test-only in-memory** binding map and stays fail-closed. **Reads no env, reads no
> secret file, contacts no provider; no live RPC, no SDK, no dependency, no endpoint URL, no API key, no
> secret/token, no raw endpoint, no send/broadcast, no transaction serialization, no mainnet, no REAL-LIVE.**
> `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `2c04946` (branch `pr-e2-f11-endpoint-reference-binding-harness-no-live`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/
> src/']` · mechanism guard `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 653/653.

---

## 1. Current state
`packages/rpc-provider-contract/` holds the provider contract + F9 registry + F10 Helius endpoint provisioning.
This milestone adds an **endpoint-reference binding harness** — **additive**; existing exports
(`validateRpcProviderConfig`/`evaluateRpcReadiness`/registry/provisioning/…) are unchanged, so send-gate (M2) and
the F9/F10 layers are unaffected.

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeEndpointReferenceBindingHarness()` → `{contract:'endpoint-reference-binding-harness', test_only:true, reads_env:false, reads_secret_files:false, provider_ref:'helius', supported_environments:['devnet','testnet','localnet'], configured:false, has_rpc:false, ready:false, can_send:false, is_live:false, network_call_made:false, status:'unconfigured_no_rpc'}`.
- `validateEndpointReferenceBinding(input)` — reuses `validateHeliusEndpointProvisioning`; result all-flags-false incl. `network_call_made:false`.
- `bindEndpointReferenceForTest(input, bindingMap)` — the harness core.
Reuses the hardened `validateHeliusEndpointProvisioning`/`looksLikeKeyMaterial`/`SECRET_INDICATOR_TOKENS`/
`ENDPOINT_RPC_TOKENS`/`MAINNET_TOKENS` (not weakened).

## 3. endpoint_ref binding harness summary
`bindEndpointReferenceForTest(input, bindingMap)`: validates the input slot (Helius/testnet/opaque endpoint_ref);
rejects a non-object/null/array `bindingMap`; looks up `bindingMap[input.endpoint_ref]`; **screens the binding
entry** (its string values shallow+one nested level, and unknown key names) for URL/RPC/`api_key`/`provider_url`
(`ENDPOINT_RPC_TOKENS`), `secret`/`token`/`credential` (`SECRET_INDICATOR_TOKENS`), `mainnet`/`prod`
(`MAINNET_TOKENS`), and key-material (`looksLikeKeyMaterial`) — refusing & never echoing; and checks
provider/environment mismatch. **Entry `has_rpc`/`ready`/`can_send`/`is_live`/`configured` flags are never
trusted** — result flags are fixed `false` literals.

## 4. Reference-only binding model
Allowed input `{provider_ref:'helius', environment∈{devnet,testnet,localnet}, endpoint_ref:'<opaque>'}` + a
test-only in-memory map `{ '<opaque-ref>': { bound:true, provider_ref:'helius', environment:'devnet',
endpoint_kind:'reference_only' } }`. A valid binding → `bound:true` / `reference_bound_no_live` **but** stays
`configured:false, has_rpc:false, ready:false, can_send:false, is_live:false, network_call_made:false`. No env
read, no secret-file read, no network call.

## 5. Fail-closed behavior
Missing/empty binding → `endpoint_ref_unbound`; provider mismatch → `endpoint_ref_provider_mismatch`; environment
mismatch → `endpoint_ref_environment_mismatch`; URL/`api_key`/`secret`/`token`/`provider_url`/`rpc_endpoint`/raw
endpoint in the binding/input → refused & never echoed; mainnet/prod refused; key-material (ref or binding value)
refused & never echoed; faked `has_rpc:true`/`ready:true` in the entry **ignored**. `validateEndpointReferenceBinding`
and `bindEndpointReferenceForTest` are try/catch-wrapped → hostile/throwing input **or** hostile/throwing binding
map → frozen refusal (`input_inspection_error`), never throws, never echoes.

## 6. Tests summary
27 new binding test blocks (covering all 32 required proofs), incl. a test-only cross-package import of
`send-gate-contract` (proof 25). **rpc-provider-contract suite 88/88 (was 61); send-gate-contract 55/55
(unchanged); full suite 653/653.**

## 7. No-live / no-SDK / no-endpoint-secret / no-send confirmation
Module remains **import-free**; **no `process.env`, no `node:fs`/`node:process`, no `readFileSync`, no `fetch`** —
no env/secret-file read, no network. No RPC/provider/Solana/Jupiter/Helius/Jito SDK import; no dependency; **no new
literal endpoint URL / API key in src** (only pre-existing bare scheme match-tokens); no send/broadcast; no
transaction build/serialization; provider object exposes no send/broadcast/serialize method.

## 8. Send-gate continuity
Existing `validateRpcProviderConfig`/`evaluateRpcReadiness` unchanged → send-gate 55/55 still green; a Helius
binding input through `send-gate.evaluateSendPreflight` still returns `can_send:false`.

## 9. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive to an existing src file; tokens are string values).

## 10. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 11. Remaining blockers / next approvals (each a separate, explicit decision)
- Provider **live** integration (real endpoint provisioning out-of-repo binding an `endpoint_ref` to an actual
  endpoint via a real, out-of-repo secret source; SDK/version + supply-chain/lockfile review) — **not started**.
- Live testnet RPC spike (test-only, disabled by default); testnet broadcast; `signer_control` + two-person;
  mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Contract-only endpoint-reference binding harness (test-only,
reference-only) · Reads no env / no secret files · No live RPC · No RPC/provider SDK · No dependency · No live
provider call · No literal endpoint URL · No endpoint secret/API key · No raw endpoint · No send/broadcast · No
transaction serialization · No mainnet (as accepted value) · No REAL-LIVE · No KMS/Vault/KeyManager · No private
key material · No new execution authority · No new SSOT name · ALLOWLIST unchanged.
