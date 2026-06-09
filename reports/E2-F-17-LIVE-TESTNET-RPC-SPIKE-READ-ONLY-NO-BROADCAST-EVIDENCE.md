# E2-F-17 — Live Testnet RPC Spike (read-only / no-broadcast) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a limited,
> isolated **live read-only RPC spike** capability (health/version only) on **devnet/testnet/localnet** to
> `@soltrade/rpc-provider-contract`, gated on the **F14 approval + F15 supply-chain + F16 out-of-repo binding**
> records, **fail-closed by default**. The actual read-only call is performed by an **out-of-repo caller function
> injected at runtime** — the repo contains **no network primitive, no endpoint, no URL, no secret** (src or test).
> A successful read-only health/version check opens **NOTHING** for trading/send: `has_rpc`, `can_send`,
> `trading_ready`, `broadcast_permitted`, `signing_permitted`, `is_live`, `real_live` stay **false**. **No mainnet,
> no REAL-LIVE, no send, no broadcast, no transaction build, no serialization, no signing, no KMS/Vault/KeyManager,
> no private key material, no in-repo endpoint/secret.** `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `8cb6a78` (branch `pr-e2-f17-live-testnet-rpc-spike-read-only-no-broadcast`) ·
> B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · mechanism guard
> `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 846/846.

---

## 1. Current state
`rpc-provider-contract` holds the fail-closed provider contract + F9–F12 layers + F13 Live RPC Spike Boundary +
F14 Live RPC Spike Approval Gate + F15 Supply-Chain Review Gate + F16 Out-of-Repo Endpoint Binding Boundary;
`send-gate-contract` consumes them fail-closed. This milestone adds the **read-only RPC spike** — **additive**;
existing exports unchanged. F17 is the first layer that *models a live call*, and it does so **without any in-repo
network primitive**: the call is delegated to an out-of-repo injected caller, gated on F14+F15+F16, fail-closed by
default.

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeLiveTestnetRpcReadOnlySpikeContract()` → frozen descriptor (read-only methods `getVersion`/`getHealth`, testnet environments, all trading/exec flags false, `status:'unconfigured_no_rpc'`).
- `validateLiveTestnetRpcReadOnlySpikeRequest(input)` — **sync** request-shape validation.
- `async evaluateLiveTestnetRpcReadOnlySpike(input, outOfRepoReadOnlyCaller)` — the spike core (dependency injection).
Constants `READ_ONLY_RPC_METHODS` (`getVersion`/`getHealth`) + `F17_SPIKE_REQUIRED_TRUE` (9) +
`F17_SPIKE_REQUIRED_FALSE` (1) + `F17_SPIKE_KNOWN_FIELDS` (16) + module-internal `f17IsHealthyReadOnlyResult`
(boolean-only, never echoes the raw caller result). Reuses `validateHeliusEndpointProvisioning`, `TESTNET_ENVS`,
and the three gate evaluators `evaluateLiveRpcSpikeApprovalGate` (F14) / `evaluateRpcClientSupplyChainGate` (F15) /
`evaluateOutOfRepoEndpointBindingBoundary` (F16). **No import; no network primitive; no dependency.**

## 3. No-in-repo-network design summary
The mechanism guard scans `packages/*/src/**/*.mjs` and forbids `fetch(`/`new Connection`/`new WebSocket`/
`sendTransaction`; "no ALLOWLIST change" means a real network call cannot live in src. Therefore the actual
read-only RPC call is performed by an **out-of-repo caller function injected as the second parameter**
(`outOfRepoReadOnlyCaller`). The repo holds **no network primitive, no endpoint, no URL, no secret** — in src OR
test. The repo's tests inject an **in-memory fake caller** (returns a canned `{solana-core:'1.18.0'}` / `'ok'`),
so the whole test suite makes **zero network egress**.

## 4. Default fail-closed proof
With **no caller** (the default), an otherwise-valid request returns `spike_authorized:true, spike_attempted:false,
live_rpc_call_made:false, read_only_health_ok:false, reasons:['out_of_repo_binding_unavailable'],
status:'unconfigured_no_rpc'` and every trading/exec flag false — **no call is made**. If the out-of-repo binding
isn't safely available, the spike fails closed rather than inventing or storing an endpoint.

## 5. Read-only path proof
With an injected caller and a valid request (`environment∈{devnet,testnet,localnet}`,
`rpc_method∈{getVersion,getHealth}`, F14+F15+F16 records passing), the caller is invoked **only** with the
validated read-only method, and a healthy result yields `spike_attempted:true, live_rpc_call_made:true,
read_only_health_ok:true, status:'live_testnet_rpc_read_only_spike_ok'`. **Even on success**, `has_rpc`,
`can_send`, `trading_ready`, `can_broadcast`, `can_serialize`, `is_live`, `real_live`, `broadcast_permitted`,
`signing_permitted`, `network_call_made` all stay **false** — a healthy read does not open trading/send readiness.

## 6. Mainnet / REAL-LIVE / send / broadcast / serialize / signing refusal proof
`environment` outside the testnet set (`mainnet`/`prod`) → `mainnet_or_nontestnet_environment_blocked`;
`rpc_method` not in `{getVersion,getHealth}` (e.g. `sendTransaction`) → `non_read_only_method_blocked`; missing any
`read_only`/`no_send`/`no_broadcast`/`no_serialize`/`no_sign`/`no_mainnet`/`no_real_live` attestation → refused. In
**all** these cases `spike_authorized:false` and the injected caller is **NEVER invoked** (verified with a
throw-if-called caller that never fires). `requires_separate_send_pr:true` is a fixed-literal invariant on every
result — send/broadcast/mainnet/REAL-LIVE remain separate, explicitly-approved PRs.

## 7. No-endpoint / no-secret / no-echo proof
`endpoint_in_repo` must be attested `false`; a smuggled `endpoint_url`/`api_key`/`secret`/`token` **field** →
`unknown_field_rejected` and never echoed. The raw caller result is **reduced to a single derived boolean** and
never stored/echoed: a leaky caller returning `{endpoint:'https://secret-rpc.internal', apiKey:'SECRET123'}` still
yields `read_only_health_ok:true` while the serialized result contains **neither** marker (`endpoint_echoed:false`).
No endpoint/URL/secret appears anywhere in src, README, or this report.

## 8. Cleanup / revoke / disable evidence
The evaluator **retains no reference** to the injected caller or any endpoint: every result is a frozen object of
fixed-literal flags + booleans, with `binding_retained:false`. After the spike returns, there is no stored
endpoint, no stored caller, and no resolved-endpoint value — the out-of-repo binding is released (consistent with
the F14 `requires_post_spike_revoke_or_disable` attestation). The capability is opt-in per call (a caller must be
re-supplied out-of-repo each time); there is no persistent enablement.

## 9. Fail-closed behavior
All results frozen/fixed-literal; the valid/success path never sets any trading/exec flag true; mainnet/non-read-only/
missing-attestation/bad-record/unknown-field → refused; a throwing caller → frozen refusal `read_only_caller_error`
(no throw, no call recorded as successful); hostile/throwing input → frozen refusal `input_inspection_error`
(never throws, caller never invoked because validation fails first).

## 10. Send-gate continuity summary
`send-gate-contract` untouched — its 85/85 stay green; the spike adds no send/RPC path to the send gate.

## 11. No-live-trading / no-SDK / no-secret confirmation
Module remains **import-free**; **no `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`process.env`/`node:fs`/
`readFileSync`** anywhere in src; no SDK/dependency; the only RPC call is the injected out-of-repo caller; a
successful read-only spike does **not** open `has_rpc`/`can_send`/trading readiness; no send/broadcast/serialize/
signing; no KMS/Vault/KeyManager; no private key material; no mainnet; no REAL-LIVE.

## 12. Tests summary
~42 new spike proofs (K1–K42 + static guards) appended to `rpc-provider-contract.test.mjs`, all using in-memory
fake callers (no real network). **rpc-provider-contract suite 251/251 (was 207); send-gate-contract 85/85
(unchanged); full suite 846/846.** Independent main-loop behavioral spot-check: 28/28 PASS.

## 13. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive to an existing src file; no network primitive introduced; tokens are string values).

## 14. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
SEND/BROADCAST/REAL-LIVE**; a read-only health spike is **not** trading readiness; **`can_send:false` repo-wide
unchanged**.

## 15. Remaining blockers / next approvals (each a separate, explicit decision)
- The operator-run **actual** read-only spike against a real devnet/testnet endpoint (supplying the out-of-repo
  caller + endpoint outside the repo) — enabled by this harness but performed out-of-repo; the repo makes no
  network call.
- Testnet **broadcast**; **send** implementation; transaction build/serialization; `signer_control` + two-person;
  KMS SDK / real provider adapter; mainnet / REAL-LIVE — each a separate, explicitly-approved PR.

---

**Confirmations:** Implementation-first milestone · Live read-only RPC spike (getVersion/getHealth) on
devnet/testnet/localnet only · Performed via an out-of-repo injected caller; no in-repo network primitive ·
Fail-closed by default (no caller → no call) · Gated on F14+F15+F16 records · A successful read-only spike opens
NOTHING for trading/send (has_rpc/can_send/trading_ready/broadcast/signing stay false) · mainnet/REAL-LIVE/
non-read-only method/send/broadcast/serialize/sign refused, caller never invoked · No endpoint URL/raw endpoint/
API key/secret/token in repo · No endpoint/secret echoed (endpoint_echoed:false) · No retained binding
(binding_retained:false) · No SDK import · No dependency · No transaction build/serialization · No signing · No
KMS/Vault/KeyManager · No private key material · No new execution authority · No new SSOT name · ALLOWLIST
unchanged.
