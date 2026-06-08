# E2-F-14 — Live RPC Spike Runbook + Approval Gate (doc / contract boundary only) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a
> CONTRACT-ONLY, **test-only** Live RPC Spike **Approval Gate** to `@soltrade/rpc-provider-contract` plus a
> **Live Testnet RPC Spike Approval Runbook** (`docs/08-RUNBOOK-OPS.md §15`). The gate validates the **shape of an
> approval RECORD** for a *future* testnet spike — an approved record authorizes **nothing live**. **No live RPC,
> no endpoint resolution, no SDK, no dependency, no env/secret read, no endpoint URL, no API key, no raw endpoint,
> no send/broadcast, no transaction serialization, no mainnet, no REAL-LIVE.** Everything fail-closed.
> `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `c6f0d71` (branch `pr-e2-f14-live-rpc-spike-runbook-approval-gate`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/
> src/']` · mechanism guard `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 742/742.

---

## 1. Current state
`rpc-provider-contract` holds the fail-closed provider contract + F9 registry + F10 endpoint provisioning + F11
binding harness + F13 Live RPC Spike **Boundary**; `send-gate-contract` consumes them fail-closed (F8/F12). This
milestone adds an **approval gate** layer — **additive**; existing exports are unchanged, so send-gate and the
F9–F13 layers are unaffected. F13 = boundary (request+binding shape); F14 = the human **approval record** that
must precede (but never replaces) a separate, explicitly-approved live-spike PR.

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeLiveRpcSpikeApprovalGateContract()` → frozen descriptor (`test_only:true`, `purpose:'live_rpc_spike_approval_gate'`, `target:'testnet_rpc_spike'`, all four `requires_*` + four `requires_no_*` true, `approval_record_valid:false`/`approval_gate_passed:false`/`live_rpc_authorized:false`, every capability/`*_call_made`/`real_live`/`broadcast_permitted` flag false, `status:'unconfigured_no_rpc'`).
- `validateLiveRpcSpikeApprovalGate(input)` — approval-record shape only.
- `evaluateLiveRpcSpikeApprovalGate(input)` — the gate core (no bindingMap).
Constants `APPROVAL_GATE_REQUIRED_TRUE` (8 attestations) + `APPROVAL_GATE_KNOWN_FIELDS` (13 fields). Reuses the
hardened `validateHeliusEndpointProvisioning` (on the 3 reference fields only), `looksLikeKeyMaterial`, and
`BROADCAST_SEND_BOUNDARY_TOKENS` (not weakened). Mirrors the F-13 style exactly: try/catch-wrapped, results from
`Object.freeze` of FIXED LITERALS, fixed string-token reasons, hostile input → frozen `input_inspection_error`.

## 3. Approval gate summary
`evaluateLiveRpcSpikeApprovalGate(input)` validates the record shape and, even when the record is fully valid,
yields `{ approval_record_valid:true, approval_gate_passed:true, status:'live_rpc_spike_approval_gate_valid_no_live',
provider_ref:'helius', environment:'devnet', requires_separate_live_spike_pr:true, live_rpc_authorized:false,
configured:false, has_rpc:false, ready:false, can_send:false, can_broadcast:false, can_serialize:false,
is_live:false, real_live:false, network_call_made:false, live_rpc_call_made:false, broadcast_permitted:false }`
(the only echoed fields are the recognized literal `'helius'` and the testnet environment enum — never
endpoint/secret/record values). `requires_separate_live_spike_pr:true` is a **fixed-literal invariant** (not
echoed input): an approved record authorizes nothing live; a separate PR is always still required.

## 4. Runbook summary
`docs/08-RUNBOOK-OPS.md §15 — Live Testnet RPC Spike Approval Runbook` (additive, after §14) states all 15
mandatory points: (1) F13/F14 perform no live RPC; (2) any later live spike needs a separate PR + separate
approval; (3) testnet/devnet/localnet only; (4) mainnet forbidden; (5) broadcast/send forbidden; (6) raw endpoint
forbidden in-repo; (7) endpoint/API key/secret out-of-repo only; (8) any SDK/dependency needs supply-chain +
lockfile review in a separate PR; (9) any network call needs explicit approval in a separate PR; (10) a live-spike
result does not open send; (11) testnet broadcast needs a separate PR; (12) REAL-LIVE/mainnet needs separate
governance, not this path; (13) post-spike revoke/disable or cleanup must be documented; (14) failure mode is
fail-closed; (15) endpoint/secret/raw provider config is never stored in the repo (incl. backups/exports/
diagnostics/logs). Operator prose only — no new SSOT/API/CONFIG/DATA name.

## 5. Valid approval record summary
Allowed input: `{ purpose:'live_rpc_spike_approval_gate', target:'testnet_rpc_spike', provider_ref:'helius',
environment∈{devnet,testnet,localnet}, endpoint_ref:'<opaque>', no_broadcast:true, no_send:true, no_mainnet:true,
no_real_live:true, requires_separate_live_spike_pr:true, requires_out_of_repo_endpoint_binding:true,
requires_supply_chain_review:true, requires_post_spike_revoke_or_disable:true }`. A valid record passes the
**gate only** — it never sets `live_rpc_authorized`/`has_rpc`/`ready`/`can_send`/`is_live`/`real_live` true and
makes no network/live RPC call.

## 6. Separate-live-spike-PR requirement
`requires_separate_live_spike_pr` must be attested `true` in the record (missing → refused), **and** the result
always emits `requires_separate_live_spike_pr:true` as a fixed invariant — the gate explicitly does not grant
live authority; the actual live spike is a distinct, separately-approved PR.

## 7. Out-of-repo endpoint binding requirement
`requires_out_of_repo_endpoint_binding` must be attested `true` (missing → refused). `endpoint_ref` is an opaque
reference only; URL/`provider_url`/`rpc_endpoint`/`api_key`/`secret`/key-material in any field → refused & never
echoed. No endpoint is stored or resolved in the repo.

## 8. Supply-chain review requirement
`requires_supply_chain_review` must be attested `true` (missing → refused) — acknowledging that any later SDK/
dependency is gated behind a separate supply-chain + lockfile review PR. This PR adds **no** dependency.

## 9. No-broadcast / no-send / no-mainnet / no-real-live summary
All four `no_broadcast`/`no_send`/`no_mainnet`/`no_real_live` must be attested `true` (missing any → refused).
Any `broadcast`/`send`/`serialize` field (key or value) → `broadcast_or_send_indicator_blocked`; mainnet/prod
environment → refused via the reused provisioning validator; result `can_broadcast:false`/`can_serialize:false`/
`real_live:false`/`broadcast_permitted:false` always.

## 10. Fail-closed behavior
All results frozen/fixed-literal; the valid path never sets any capability/`*_call_made`/`live_rpc_authorized`/
`real_live`/`broadcast_permitted` true; URL/raw-endpoint/`provider_url`/`rpc_endpoint`/`api_key`/`secret`/`token`/
key-material/mainnet/prod → refused & **never echoed**; faked `ready:true`/`has_rpc:true`/`can_send:true`/
`is_live:true`/`real_live:true`/`network_call_made:true` → ignored, result flags stay false;
`validateLiveRpcSpikeApprovalGate`/`evaluateLiveRpcSpikeApprovalGate` try/catch-wrapped → hostile/throwing input
→ frozen refusal (`input_inspection_error`), never throws/echoes.

## 11. Tests summary
45 new approval-gate proofs (S1–S45) appended to `rpc-provider-contract.test.mjs` against the REAL imported
exports. **rpc-provider-contract suite 147/147 (was 119); send-gate-contract 85/85 (unchanged); full suite
742/742.** Independent main-loop behavioral spot-check: 27/27 PASS.

## 12. No-live / no-SDK / no-env / no-secret / no-send confirmation
Module remains **import-free**; **no `process.env`, no `node:fs`/`node:process`, no `readFileSync`, no `fetch`/
`WebSocket`/`new Connection`**; no SDK/dependency; no live RPC call; no endpoint resolution; **no literal endpoint
URL / API key in src** (only pre-existing bare scheme match-tokens); no send/broadcast/serialization; provider
object exposes no send/broadcast/serialize method.

## 13. Send-gate continuity summary
`send-gate-contract` untouched (no src change) — its 85/85 stay green; the approval gate adds no send path.

## 14. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive to an existing src file; tokens are string values).

## 15. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains **READY FOR E2 IMPLEMENTATION REVIEW**; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 16. Remaining blockers / next approvals (each a separate, explicit decision)
- The **actual** live testnet RPC spike (real out-of-repo endpoint binding + a real RPC client/SDK +
  supply-chain/lockfile review + testnet-only approval) — **not started**; this PR only adds the approval gate +
  runbook that must precede it.
- Testnet broadcast; send implementation; `signer_control` + two-person; KMS SDK / real provider adapter;
  mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Contract-only Live RPC Spike Approval Gate (test-only record
validation) · An approved record grants no live authority · No live RPC call · No endpoint resolution · No
RPC/provider SDK · No dependency · No live provider call · No env/secret read · No literal endpoint URL · No
endpoint secret/API key · No raw endpoint · No send/broadcast · No transaction serialization · No mainnet (as
accepted value) · No REAL-LIVE · No KMS/Vault/KeyManager · No private key material · No new execution authority ·
No new SSOT name · ALLOWLIST unchanged.
