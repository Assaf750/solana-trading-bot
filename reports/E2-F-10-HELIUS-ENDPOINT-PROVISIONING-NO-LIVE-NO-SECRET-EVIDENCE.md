# E2-F-10 — Helius Endpoint Provisioning (no-live, no-secret) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a
> CONTRACT-ONLY, **reference-only** Helius endpoint-provisioning layer to `@soltrade/rpc-provider-contract` —
> **no live RPC, no SDK, no dependency, no endpoint URL, no API key, no secret/token, no send/broadcast, no
> transaction serialization, no mainnet, no REAL-LIVE.** Everything fail-closed. `can_send:false` repo-wide
> unchanged.
>
> **State:** built on `main` @ `d7906d1` (branch `pr-e2-f10-helius-endpoint-provisioning-no-live`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/
> src/']` · mechanism guard `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 626/626.

---

## 1. Current state
`packages/rpc-provider-contract/` already holds the fail-closed RPC-provider contract + the F9 provider registry
(Helius enabled, 3 slots). This milestone adds an **endpoint-provisioning** layer — **additive**; the existing
exports (`validateRpcProviderConfig`/`evaluateRpcReadiness`/registry/…) are unchanged, so send-gate (M2) and the
registry (F9) are unaffected.

## 2. Implementation summary
New, additive, function-I/O-only exports (no SSOT name):
- `describeHeliusEndpointProvisioningContract()` → `{contract:'helius-endpoint-provisioning', provider_ref:'helius', supported_environments:['devnet','testnet','localnet'], max_provider_slots:3, configured:false, has_rpc:false, ready:false, can_send:false, is_live:false, status:'unconfigured_no_rpc'}`.
- `validateHeliusEndpointProvisioning(input)` — single slot.
- `validateProviderEndpointRefs(selection)` — 1–3 slots.
New constant `SECRET_INDICATOR_TOKENS=['secret','token','credential','apikey','api_key','private_key','privatekey']`
(string-literal match values). Reuses the hardened `validateRpcProviderConfig` per slot (not weakened).

## 3. Helius endpoint provisioning summary
Only `{ provider_ref:'helius', environment∈{devnet,testnet,localnet}, endpoint_ref:'<opaque reference>' }` is
accepted (`provisioning_valid_no_live`). Refused & **never echoed**: `http(s)://`/`wss://`/`provider_url`/
`rpc_endpoint`/`api_key`/`url` (via `ENDPOINT_RPC_TOKENS`) · `secret`/`token`/`credential`/`apikey`/`private_key`
in `endpoint_ref` (`endpoint_secret_indicator_blocked`) · `mainnet`/`prod` (`mainnet_or_nontestnet_environment_blocked`)
· key-material (`key_material_not_accepted`) · unknown fields (`unknown_field_rejected`).

## 4. endpoint_ref reference-only model
`endpoint_ref` is an **opaque reference string** — never a URL/host/credential. Missing → `endpoint_ref_missing`
(stays unconfigured, never live). A valid shape is references-only and stays `configured:false, has_rpc:false,
ready:false, can_send:false, is_live:false, status:'unconfigured_no_rpc'`.

## 5. One/two/three slot capacity summary
`validateProviderEndpointRefs` supports 1–3 slots: 0 → `no_provider_slots`/`unconfigured_no_rpc`; >3 →
`too_many_provider_slots`; unknown → `unknown_provider`; triton/yellowstone → `provider_not_enabled`; duplicate
`endpoint_ref` → `duplicate_endpoint_ref`. No slot ever becomes live (verified: 3 distinct-ref helius slots →
valid, `slot_count:3`, `can_send:false`).

## 6. Fail-closed behavior
All results frozen/fixed-literal, never echo endpoint/secret values (URL/`LEAK`/PEM markers proven absent from
`JSON.stringify`); `validateHeliusEndpointProvisioning`/`validateProviderEndpointRefs` wrapped in try/catch →
hostile/throwing input → `input_inspection_error` / `invalid`, **never throws**. No input yields
configured/has_rpc/ready/can_send/is_live true.

## 7. Tests summary
26 new provisioning test blocks (covering all 30 required proofs P1–P30), incl. a test-only cross-package import
of `send-gate-contract` (proof 24). **rpc-provider-contract suite 61/61 (was 35); send-gate-contract 55/55
(unchanged); full suite 626/626.**

## 8. No-live / no-SDK / no-endpoint-secret / no-send confirmation
Module remains **import-free**; no RPC/provider/Solana/Jupiter/Helius/Jito SDK import; no dependency; no
network/provider call; **no literal endpoint URL / API key in src** (only bare scheme match-tokens); no
send/broadcast; no transaction build/serialization; provider object exposes no send/broadcast/serialize method.

## 9. Send-gate continuity
Existing `validateRpcProviderConfig`/`evaluateRpcReadiness` unchanged → send-gate 55/55 still green; a provisioned
Helius provider (`{provider_ref:'helius',environment:'devnet',endpoint_ref:'…'}`) through
`send-gate.evaluateSendPreflight` still returns `can_send:false`.

## 10. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive to an existing src file; provider/secret tokens are string values).

## 11. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 12. Remaining blockers / next approvals (each a separate, explicit decision)
- Provider **live** integration (real endpoint provisioning out-of-repo binding an `endpoint_ref` to an actual
  endpoint; SDK/version + supply-chain/lockfile review) — **not started**.
- Live testnet RPC spike (test-only, disabled by default); testnet broadcast; `signer_control` + two-person;
  mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Contract-only Helius endpoint provisioning (reference-only) ·
endpoint_ref is an opaque reference · No live RPC · No RPC/provider SDK · No dependency · No live provider call ·
No literal endpoint URL · No endpoint secret/API key · No raw endpoint · No send/broadcast · No transaction
serialization · No mainnet (as accepted value) · No REAL-LIVE · No KMS/Vault/KeyManager · No private key material
· No new execution authority · No new SSOT name · ALLOWLIST unchanged.
