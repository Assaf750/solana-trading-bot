# E2-F-13 — Live RPC Spike Boundary Contract (test-only, no-broadcast) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a
> CONTRACT-ONLY "Live RPC Spike Boundary" to `@soltrade/rpc-provider-contract`: it validates the **shape** of a
> FUTURE testnet RPC spike *request* but executes **no live RPC**. **No live RPC call, no endpoint resolution,
> no env/secret read, no `fetch`/`WebSocket`/`Connection`, no SDK, no dependency, no send/broadcast/serialize,
> no mainnet, no REAL-LIVE.** Everything fail-closed. `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `5cb86a7` (branch `pr-e2-f13-live-rpc-spike-boundary-test-only`) · B1–B8 `DECIDED`
> · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/src/']` ·
> mechanism guard `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 714/714.

---

## 1. Current state
`rpc-provider-contract` holds the provider contract + F9 registry + F10 provisioning + F11 binding harness;
`send-gate-contract` consumes them fail-closed (F8/F12). This milestone adds a **spike-boundary** layer —
**additive**; existing exports are unchanged, so send-gate and the F9–F11 layers are unaffected.

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeLiveRpcSpikeBoundaryContract()` → frozen descriptor (`test_only:true`, `purpose:'live_rpc_spike_boundary'`, `requires_no_broadcast:true`, `requires_bound_endpoint_ref:true`, all capability/`*_call_made`/`broadcast_permitted` flags false, `status:'unconfigured_no_rpc'`).
- `validateLiveRpcSpikeBoundaryRequest(input)` — request-shape only.
- `evaluateLiveRpcSpikeBoundary(input, bindingMap)` — boundary core (reuses `bindEndpointReferenceForTest`).
New constant `BROADCAST_SEND_BOUNDARY_TOKENS=['broadcast','send','serialize']`. Reuses the hardened
`validateHeliusEndpointProvisioning`/`bindEndpointReferenceForTest`/key-material/token helpers (not weakened).

## 3. Live RPC spike boundary summary
`evaluateLiveRpcSpikeBoundary(input, bindingMap)` validates the request shape and binds the `endpoint_ref` against
a **test-only in-memory** map — performing **no** endpoint resolution / live RPC / network. Even a valid
request + valid binding yields `{ valid:true, boundary_passed:true, status:'live_rpc_spike_boundary_no_live',
provider_ref:'helius', environment:'devnet', bound:true, configured:false, has_rpc:false, ready:false,
can_send:false, can_broadcast:false, can_serialize:false, is_live:false, live_rpc_call_made:false,
network_call_made:false, broadcast_permitted:false }` (the only echoed fields are the recognized literal
`'helius'` and the testnet environment enum — never endpoint/secret/binding values).

## 4. Test-only request model
Allowed input: `{ provider_ref:'helius', environment∈{devnet,testnet,localnet}, endpoint_ref:'<opaque>',
purpose:'live_rpc_spike_boundary', no_broadcast:true }` + a test-only in-memory `bindingMap`. **Design note /
defect fixed during build:** `validateLiveRpcSpikeBoundaryRequest` validates **only** the 3 provisioning fields
(`provider_ref`/`environment`/`endpoint_ref`) against the reused provisioning validator and handles
`purpose`/`no_broadcast` separately — otherwise the required `purpose` value (`'live_rpc_spike_boundary'`
contains `'rpc'`) and the required `no_broadcast` key (contains `'broadcast'`) would falsely trip the reused
validator. The broadcast/send/serialize scan explicitly **excludes** the legitimate `no_broadcast` key and the
fixed `purpose` literal while still refusing genuine `broadcast`/`send`/`serialize` fields. (The test-agent
caught this as a NO_GO; fixed in-loop; the spec's canonical valid request now passes.)

## 5. No-broadcast boundary summary
`no_broadcast:true` is **required** → missing → `no_broadcast_required`; any `broadcast:true`/`send:true`/
`serialize:true` (key or value) → `broadcast_or_send_indicator_blocked`; result `broadcast_permitted:false` always.

## 6. endpoint_ref binding requirement summary
The boundary requires a **bound** `endpoint_ref` via the F11 harness — missing/unbound → `endpoint_ref_unbound`
(+ `endpoint_binding:<reason>` prefixed); missing `endpoint_ref` / provider mismatch / environment mismatch →
refused. No endpoint resolution; the binding map is test-only/in-memory.

## 7. Fail-closed behavior
All results frozen/fixed-literal; valid path never sets any capability/`*_call_made`/`broadcast_permitted` flag
true; URL/raw-endpoint/`provider_url`/`rpc_endpoint`/`api_key`/`secret`/`token`/key-material/mainnet/prod →
refused & **never echoed** (markers proven absent); faked `ready:true`/`has_rpc:true`/`can_send:true`/
`is_live:true`/`network_call_made:true` (in request or binding entry) → ignored/refused, result flags stay false;
`validateLiveRpcSpikeBoundaryRequest`/`evaluateLiveRpcSpikeBoundary` try/catch-wrapped → hostile/throwing request
**or** binding map → frozen refusal (`input_inspection_error`), never throws/echoes.

## 8. Tests summary
31 new boundary test blocks (covering all 40 proofs S1–S40). **rpc-provider-contract suite 119/119 (was 88);
send-gate-contract 85/85 (unchanged); full suite 714/714.**

## 9. No-live / no-SDK / no-env / no-secret / no-send confirmation
Module remains **import-free**; **no `process.env`, no `node:fs`/`node:process`, no `readFileSync`, no `fetch`/
`WebSocket`/`new Connection`**; no SDK/dependency; no live RPC call; no endpoint resolution; **no literal
endpoint URL / API key in src** (only pre-existing bare scheme match-tokens); no send/broadcast/serialization;
provider object exposes no send/broadcast/serialize method.

## 10. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive to an existing src file; tokens are string values).

## 11. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 12. Remaining blockers / next approvals (each a separate, explicit decision)
- The **actual** live testnet RPC spike (real endpoint provisioning out-of-repo + a real RPC client/SDK +
  supply-chain/lockfile review + testnet-only approval) — **not started**; this PR only defines its boundary.
- Testnet broadcast; `signer_control` + two-person; mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Contract-only live RPC spike boundary (test-only request
validation) · No live RPC call · No endpoint resolution · No RPC/provider SDK · No dependency · No live provider
call · No env/secret read · No literal endpoint URL · No endpoint secret/API key · No raw endpoint · No
send/broadcast · No transaction serialization · No mainnet (as accepted value) · No REAL-LIVE · No
KMS/Vault/KeyManager · No private key material · No new execution authority · No new SSOT name · ALLOWLIST
unchanged.
