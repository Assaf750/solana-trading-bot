# E2-F-9 — Multi-Provider Registry / Helius First (no-live, no-SDK) Evidence

> **IMPLEMENTATION-FIRST milestone (code + tests; this report is the evidence, written after).** Adds a
> CONTRACT-ONLY provider registry to `@soltrade/rpc-provider-contract` supporting up to 3 provider slots, with
> **Helius as the only enabled provider reference** — **no live RPC, no SDK, no dependency, no endpoint URL, no
> API key, no secret, no send/broadcast, no transaction serialization, no mainnet, no REAL-LIVE.** Everything
> fail-closed. `can_send:false` repo-wide unchanged.
>
> **State:** built on `main` @ `7e9a359` (branch `pr-e2-f9-multi-provider-registry-helius-first`) · B1–B8
> `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** · `ALLOWLIST=['packages/isolated-signer-runtime/
> src/']` · mechanism guard `sources=83 fixtures=27 allowlist=1 violations=0` · full suite 600/600 · **NO RPC
> PROVIDER LIVE — references only**.

---

## 1. Current state
`packages/rpc-provider-contract/` (fail-closed RPC-provider contract) and `packages/send-gate-contract/` (consumes
it fail-closed) both exist. This milestone adds a **registry / provider-slots** layer to `rpc-provider-contract`,
**additive** — the existing exports (`validateRpcProviderConfig`/`evaluateRpcReadiness`/…) are unchanged, so
send-gate (Milestone 2) is unaffected.

## 2. Docs alignment summary
Provider roles are not mixed: **`helius`** = the only **enabled** provider reference now (reference-only, no
live). **`triton`/`yellowstone`** = doc-listed **disabled/future** references only (placeholders; not enabled,
not live). **Jito** (execution/bundle) and **Jupiter** (routing) are **not** RPC providers in this contract and
are excluded from the registry.

## 3. Provider registry summary
New, additive, function-I/O-only surface (no SSOT name):
- `describeRpcProviderRegistry()` → `{contract:'rpc-provider-registry', max_provider_slots:3, supported_provider_refs:['helius'], doc_listed_disabled_provider_refs:['triton','yellowstone'], configured:false, has_rpc:false, can_send:false, is_live:false, status:'unconfigured_no_rpc'}`.
- `listSupportedRpcProviderRefs()` → `['helius']`.
- `normalizeRpcProviderSlots(input)` → `{count, within_capacity, max_provider_slots:3, status}` — structural summary only, never echoes slot contents.
- `validateRpcProviderSelection(selection)` → `{valid, status, reasons[], configured:false, has_rpc:false, can_send:false, slot_count, max_provider_slots:3}`.
- `RPC_PROVIDER_MAX_SLOTS = 3`.
Per-slot shape/mainnet/endpoint/key-material/unknown-field is delegated to the **hardened** `validateRpcProviderConfig`; the registry adds the enabled-ref / capacity / duplicate gating on top.

## 4. Helius support summary
A Helius slot `{provider_ref:'helius', environment∈{devnet,testnet,localnet}, optional endpoint_ref}` is accepted
as **references-only** (`selection_valid_no_rpc`, `valid:true`) but stays `configured:false, has_rpc:false,
can_send:false` — no URL/API-key/secret/mainnet/live. Verified end-to-end: a Helius provider fed through
`send-gate-contract.evaluateSendPreflight` still returns `can_send:false`.

## 5. Three-provider capacity summary
`max_provider_slots = 3`. 1–3 slots are representable (`within_capacity:true`); **0 → `no_provider_slots` /
`unconfigured_no_rpc`**; **>3 → `too_many_provider_slots` / `over_capacity`**. Helius is the only enabled ref now;
`triton`/`yellowstone` slots are refused as `provider_not_enabled`; unknown refs → `unknown_provider`; duplicate
refs → `duplicate_provider`. No slot ever becomes live.

## 6. Fail-closed behavior
Every registry result is frozen, built from fixed literals, and **never echoes** any slot/provider_ref/endpoint/
secret value (verified: PEM/URL/secret markers absent from `JSON.stringify`). `validateRpcProviderSelection` and
`normalizeRpcProviderSlots` are wrapped in try/catch → a hostile/throwing accessor returns a frozen
`input_inspection_error` / `invalid` result and **never throws**. No selection yields
configured/has_rpc/ready/can_send/is_live true.

## 7. Tests summary
17 new registry test cases added to `rpc-provider-contract.test.mjs` covering all 22 required proofs (incl. a
test-only cross-package import of `send-gate-contract` to confirm Helius-via-send-gate still refuses). **rpc-
provider-contract suite 35/35 (was 18); send-gate-contract 55/55 (unchanged); full suite 600/600.**

## 8. No-live / no-SDK / no-endpoint / no-send confirmation
Module remains **import-free**; no RPC/provider/Solana/Jupiter/Helius/Jito SDK import (provider tokens are string
**values**, not import specifiers); no dependency; no network/provider call; no literal endpoint URL; no
send/broadcast; no transaction build/serialization; the provider object exposes no send/broadcast/serialize/
sendTransaction/connect method.

## 9. Guard / allowlist impact
No `ALLOWLIST` change (one path); mechanism guard PASS `sources=83 fixtures=27 allowlist=1 violations=0`
(unchanged — additive to an existing src file, no new src `.mjs`; the new provider tokens are string values).

## 10. Readiness impact
None — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`; **NOT READY FOR
RPC/SEND/BROADCAST/REAL-LIVE**; **`can_send:false` repo-wide unchanged**.

## 11. Remaining blockers / next approvals (each a separate, explicit decision)
- Provider **live** integration (exact endpoint provisioning out-of-repo; SDK/version + supply-chain/lockfile review) — **not started**.
- Live testnet RPC spike (test-only, disabled by default); testnet broadcast; `signer_control` + two-person; mainnet/REAL-LIVE.

---

**Confirmations:** Implementation-first milestone · Contract-only provider registry (Helius enabled reference-only;
triton/yellowstone doc-listed/disabled; Jito/Jupiter excluded as non-RPC) · No live RPC · No RPC/provider SDK · No
dependency · No live provider call · No literal endpoint URL · No endpoint secret/API key · No send/broadcast · No
transaction serialization · No mainnet (as accepted value) · No REAL-LIVE · No KMS/Vault/KeyManager · No private
key material · No new execution authority · No new SSOT name · ALLOWLIST unchanged.
