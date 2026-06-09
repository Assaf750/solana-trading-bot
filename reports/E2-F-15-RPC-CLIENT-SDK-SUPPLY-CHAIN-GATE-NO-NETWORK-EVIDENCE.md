# E2-F-15 — RPC Client / SDK Supply-Chain Review Gate (no-network) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a
> CONTRACT-ONLY, **test-only** RPC Client / SDK **Supply-Chain Review Gate** to `@soltrade/rpc-provider-contract`.
> It validates the **shape of a supply-chain review RECORD** for any *future* RPC client/SDK dependency and proves
> such a dependency can **never become a live capability through this gate** — it introduces **no dependency, no
> SDK import, no network**. **No live RPC, no network call, no fetch/WebSocket/Connection, no endpoint resolution,
> no endpoint URL, no API key/secret/token, no env/secret read, no send/broadcast, no transaction serialization,
> no mainnet, no REAL-LIVE.** Everything fail-closed. `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `604def1` (branch `pr-e2-f15-rpc-client-sdk-supply-chain-gate-no-network`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/
> src/']` · mechanism guard `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 775/775.

---

## 1. Current state
`rpc-provider-contract` holds the fail-closed provider contract + F9 registry + F10 endpoint provisioning + F11
binding harness + F13 Live RPC Spike Boundary + F14 Live RPC Spike Approval Gate; `send-gate-contract` consumes
them fail-closed (F8/F12). This milestone adds a **supply-chain review gate** — **additive**; existing exports are
unchanged, so send-gate and the F9–F14 layers are unaffected. F15 is the governance gate that any FUTURE RPC
client/SDK dependency must pass on paper before a separate integration PR; it adds no dependency itself.

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeRpcClientSupplyChainGateContract()` → frozen descriptor (`test_only:true`, `purpose:'rpc_client_supply_chain_review'`, the four `requires_*` + four `requires_no_*` true, `review_record_valid:false`/`supply_chain_gate_passed:false`/`live_rpc_authorized:false`/`network_capability:false`, every capability/`*_call_made`/`real_live`/`broadcast_permitted` flag false, `status:'unconfigured_no_rpc'`).
- `validateRpcClientSupplyChainReview(input)` — review-record shape only.
- `evaluateRpcClientSupplyChainGate(input)` — the gate core.
Constants `SUPPLY_CHAIN_REQUIRED_TRUE` (10 attestations) + `SUPPLY_CHAIN_KNOWN_FIELDS` (13 fields) +
`CLIENT_METADATA_ENDPOINT_TOKENS` (URL schemes only). Mirrors the F-14 fail-closed style: try/catch-wrapped,
results from `Object.freeze` of FIXED LITERALS, fixed string-token reasons, hostile input → frozen
`input_inspection_error`. Reuses `looksLikeKeyMaterial`, `SECRET_INDICATOR_TOKENS`, `MAINNET_TOKENS`,
`BROADCAST_SEND_BOUNDARY_TOKENS` (not weakened). **No import; no dependency added.**

## 3. Supply-chain gate summary
`evaluateRpcClientSupplyChainGate(input)` validates the record shape and, even when fully valid, yields
`{ review_record_valid:true, supply_chain_gate_passed:true, status:'rpc_client_supply_chain_review_valid_no_network',
requires_separate_integration_pr:true, live_rpc_authorized:false, network_capability:false, configured:false,
has_rpc:false, ready:false, can_send:false, can_broadcast:false, can_serialize:false, is_live:false, real_live:false,
network_call_made:false, live_rpc_call_made:false, broadcast_permitted:false }`. `requires_separate_integration_pr:true`
is a **fixed-literal invariant** (not echoed input): an approved review authorizes nothing live and adds no
dependency/network; a separate integration PR + lockfile + supply-chain review are always still required. **No
freeform input (`client_ref`/`client_version`) is ever echoed.**

## 4. Test-only review record model summary
Allowed input: `{ purpose:'rpc_client_supply_chain_review', client_ref:'<opaque package name>',
client_version:'<pinned version string>', no_network:true, no_send:true, no_broadcast:true, no_serialize:true,
no_mainnet:true, no_real_live:true, requires_lockfile_review:true, requires_supply_chain_review:true,
requires_separate_integration_pr:true, requires_pinned_version:true }`. `client_ref`/`client_version` are **opaque
metadata** — never an endpoint/secret. All 10 attestations required-true; unknown fields rejected.

## 5. Client-metadata indicator policy (defect fixed during build)
`client_ref`/`client_version` are scanned with a **narrow** `CLIENT_METADATA_ENDPOINT_TOKENS =
['http://','https://','ws://','wss://']` (URL schemes only) — **not** the broad `ENDPOINT_RPC_TOKENS`. A
supply-chain review of an *RPC client* legitimately names a package like `rpc-client-pkg` / `helius-rpc-sdk`, so
the bare descriptive words `rpc`/`sdk`/`client`/`endpoint` must **not** be false-blocked (the test-agent caught
that the canonical valid record could not pass because `client_ref` contained `rpc`; fixed in-loop). What is
refused is a genuine endpoint **URL surface** (a scheme) smuggled into metadata. **Secrets
(`SECRET_INDICATOR_TOKENS`), mainnet (`MAINNET_TOKENS`), key-material (`looksLikeKeyMaterial`), and
broadcast/send/serialize (`BROADCAST_SEND_BOUNDARY_TOKENS`) screening are unchanged and still refuse & never echo.**

## 6. No-network / no-SDK / no-dependency model summary
The gate makes **no** network/fetch/endpoint-resolution call and imports **no** SDK; `no_network` must be attested
true (missing → refused); `network_capability:false` and `network_call_made:false` always. `package.json` has **no**
dependency/devDependency added.

## 7. Separate-integration-PR / lockfile / supply-chain / pinned-version requirements
`requires_separate_integration_pr` / `requires_lockfile_review` / `requires_supply_chain_review` /
`requires_pinned_version` must each be attested true (missing any → refused), and the result always emits
`requires_separate_integration_pr:true` as a fixed invariant — the gate grants no integration/live authority; the
actual client/SDK integration is a distinct, separately-approved PR behind a lockfile + supply-chain review.

## 8. Fail-closed model summary
All results frozen/fixed-literal; the valid path never sets any capability/`live_rpc_authorized`/`network_capability`/
`real_live`/`*_call_made`/`broadcast_permitted` true; URL-scheme/secret/`api_key`/`token`/key-material/mainnet/
broadcast/send/serialize → refused & **never echoed**; faked `has_rpc:true`/`can_send:true`/`is_live:true`/
`real_live:true`/`network_call_made:true` → ignored; both validators try/catch-wrapped → hostile/throwing input →
frozen refusal (`input_inspection_error`), never throws/echoes.

## 9. Send-gate continuity summary
`send-gate-contract` untouched (no src change) — its 85/85 stay green; the supply-chain gate adds no send/RPC path.

## 10. No-live / no-SDK / no-env / no-secret / no-send confirmation
Module remains **import-free**; **no `process.env`, no `node:fs`/`node:process`, no `readFileSync`, no `fetch`/
`WebSocket`/`new Connection`**; no SDK/dependency; no live RPC call; no endpoint resolution; **no literal endpoint
URL / API key in src** (only bare scheme match-tokens); no send/broadcast/serialization; provider object exposes
no send/broadcast/serialize method.

## 11. Tests summary
~40 new supply-chain proofs (G1–G40, incl. the rewritten G29 proving descriptive names are allowed while URL
schemes are refused) appended to `rpc-provider-contract.test.mjs`. **rpc-provider-contract suite 180/180 (was 147);
send-gate-contract 85/85 (unchanged); full suite 775/775.** Independent main-loop behavioral spot-check: 31/31 PASS.

## 12. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive to an existing src file; tokens are string values).

## 13. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 14. Remaining blockers / next approvals (each a separate, explicit decision)
- The **actual** RPC client/SDK integration (real out-of-repo dependency selection + lockfile pinning +
  supply-chain review + a real client behind the existing fail-closed boundary) — **not started**; this PR only
  defines the supply-chain review gate that must precede it.
- Live testnet RPC spike; testnet broadcast; send implementation; `signer_control` + two-person; KMS SDK / real
  provider adapter; mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Contract-only RPC client/SDK supply-chain review gate
(test-only record validation) · An approved review grants no live authority and adds no dependency/network · No
live RPC · No network call · No fetch/WebSocket/Connection · No endpoint resolution · No RPC/provider SDK · No
dependency · No live provider call · No env/secret read · No literal endpoint URL · No endpoint secret/API key ·
No raw endpoint · No send/broadcast · No transaction serialization · No mainnet (as accepted value) · No REAL-LIVE
· No KMS/Vault/KeyManager · No private key material · No new execution authority · No new SSOT name · ALLOWLIST
unchanged.
