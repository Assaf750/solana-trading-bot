# E2-F-12 — Send-Gate consumes Endpoint Binding Harness (fail-closed) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Wires
> `@soltrade/send-gate-contract` to CONSUME the F11 endpoint-reference binding harness in
> `@soltrade/rpc-provider-contract` — fully **fail-closed**. Even a valid reference-bound Helius binding does
> **not** open send. **No live RPC, no SDK, no dependency, no env/secret read, no endpoint URL, no API key, no
> send/broadcast, no transaction serialization, no mainnet, no REAL-LIVE.** `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `d9597ff` (branch `pr-e2-f12-send-gate-endpoint-binding-fail-closed`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/
> src/']` · mechanism guard `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 683/683.

---

## 1. Current state
`rpc-provider-contract` holds the provider contract + F9 registry + F10 provisioning + F11 endpoint-reference
binding harness. `send-gate-contract` already consumed `validateRpcProviderConfig`/`evaluateRpcReadiness`
fail-closed (M2). This milestone adds consumption of the F11 binding harness — **send-gate only is modified**;
`rpc-provider-contract` is untouched (its 88 tests stay green).

## 2. Implementation summary
- Extended the **one** relative internal import to also pull `bindEndpointReferenceForTest` +
  `validateEndpointReferenceBinding` from `../../rpc-provider-contract/src/index.mjs` (still the only import; no
  external/SDK).
- `evaluateSendPreflight(input)` now consumes optional `input.rpc_provider` + `input.endpoint_binding_map`
  (test-only function inputs) **inside the existing try/catch**, after the rpc_provider consumption and before
  the foundational refusal: it surfaces the binding input shape via `validateEndpointReferenceBinding(prov)` and
  delegates to `bindEndpointReferenceForTest(prov, bindingMap)`. Readiness is derived from the **contract**, never
  from caller flags.
- `describeSendGateContract()` gains `consumes_endpoint_binding:true` (function-return field; `consumes_rpc_provider:true` retained); mirrored in `.d.ts`.

## 3. Send-gate endpoint-binding consumption summary
New blockers (fixed-literal strings, never echo input): `endpoint_binding_input_no_live` (a valid binding-input
shape), `endpoint_binding_not_bound` (no/empty/missing binding), `endpoint_binding_no_live` (a **valid**
reference-bound binding — never opens send), and the harness's own reasons surfaced under an `endpoint_binding:`
prefix (e.g. `endpoint_binding:endpoint_ref_provider_mismatch`, `endpoint_binding:endpoint_ref_environment_mismatch`,
`endpoint_binding:endpoint_or_rpc_indicator_blocked`, `endpoint_binding:endpoint_secret_indicator_blocked`,
`endpoint_binding:mainnet_or_nontestnet_environment_blocked`, `endpoint_binding:key_material_not_accepted`,
`endpoint_binding:input_inspection_error`).

## 4. Valid Helius binding still refused summary
A valid binding `{rpc_provider:{provider_ref:'helius',environment:'devnet',endpoint_ref:'helius-devnet-ref'},
endpoint_binding_map:{'helius-devnet-ref':{bound:true,provider_ref:'helius',environment:'devnet',endpoint_kind:
'reference_only'}}}` → `ok:false`, `can_send:false`, `has_rpc:false`, `is_live:false`, `sent:false`,
`broadcast:false`, `reason:'send_gate_unconfigured_no_rpc'`, with `endpoint_binding_no_live` recorded. Verified.

## 5. Fail-closed behavior
Every result is the frozen fixed-literal refusal. Missing/empty binding → `endpoint_binding_not_bound`; provider/
env mismatch, URL/`api_key`/`secret`/`token`/key-material in the binding → refused & **never echoed** (markers
proven absent); faked `has_rpc:true`/`ready:true`/`can_send:true` in the binding entry and faked
`rpc_provider_ready:true` in the request are **ignored**; hostile/throwing `rpc_provider` **or** hostile/throwing
`endpoint_binding_map` (getter/Proxy) → frozen refusal (`input_inspection_error`), never throws/echoes.

## 6. Sign-only continuity summary
A genuine sign-only success (`sign_only_success:true`) + a valid endpoint binding still refuses
(`can_send:false`) — readiness/binding never opens send. Continuous with E2-F-2/F-8.

## 7. Tests summary
New `test/send-gate-endpoint-binding-fail-closed.test.mjs` (30 proofs) against the REAL imported send-gate +
rpc-provider contracts. **send-gate suite 85/85 (55 existing + 30 new); rpc-provider-contract 88/88 (unchanged);
full suite 683/683.**

## 8. No-live / no-SDK / no-env / no-secret / no-send confirmation
send-gate src has exactly **one** import — the relative internal `../../rpc-provider-contract/src/index.mjs`
(4 names); **no** external/SDK/Solana/Jupiter/Helius/Jito import; **no** `process.env`/`node:fs`/`node:process`/
`readFileSync`/`fetch`/`new Connection`/`WebSocket`; no literal endpoint URL/API key; no send/broadcast/
serialization; gate exposes no send/broadcast/serialize/sendTransaction/connect method.

## 9. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — no new src file; the relative import is not a forbidden family).

## 10. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 11. Remaining blockers / next approvals (each a separate, explicit decision)
- Provider **live** integration (real endpoint provisioning out-of-repo via a real out-of-repo secret source;
  SDK/version + supply-chain/lockfile review) — **not started**.
- Live testnet RPC spike (test-only, disabled by default); testnet broadcast; `signer_control` + two-person;
  mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Send-gate consumes the endpoint binding harness fail-closed ·
Even a valid reference-bound Helius binding still refuses (can_send:false) · No live RPC · No RPC/provider SDK ·
No dependency · No live provider call · No env/secret read · No literal endpoint URL · No endpoint secret/API key
· No raw endpoint · No send/broadcast · No transaction serialization · No mainnet · No REAL-LIVE · No
KMS/Vault/KeyManager · No private key material · No new execution authority · No new SSOT name · ALLOWLIST
unchanged.
