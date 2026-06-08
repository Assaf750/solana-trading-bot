# E2-F-0 — Send / Testnet Broadcast Boundary Design & Threat Review (report-only)

> **REPORT / DESIGN-ONLY.** No code, no tests, no package, no tool, no dependency install, no `ALLOWLIST`
> change, no `package.json`/lockfile change. **No RPC / no provider SDK / no send / no broadcast / no
> transaction building / no transaction serialization / no KMS/Vault / no KeyManager / no key material / no
> mainnet / no REAL-LIVE.** References already-merged artifacts only; introduces **no new SSOT/API/DATA/CONFIG
> name** (existing SSOT names are cited as *design context only*, none implemented). **Does NOT change readiness
> and claims no SEND / BROADCAST / KMS / REAL-LIVE readiness.** No network was or will be contacted by this PR.
>
> **State:** `main` @ `3dfd9b9` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 510/510 tests · mechanism guard
> `allowlist=1 violations=0` · **NO SDK SELECTED YET** · `can_send:false`.

---

## 1. Current state / evidence read (@ `3dfd9b9`)

The send/broadcast boundary is being designed **on top of** the following already-merged, fail-closed evidence:

| Track | Closed by | What is proven today |
|---|---|---|
| **Sign-only signing** | `reports/E2-C6-SIGNING-CLOSURE.md` (and E2-C3-0…E2-C5-1) | A real Ed25519 **sign-only** capability inside the one allowlisted path, behind preflight + E0 readiness + audit-before/after + custody gates; signs **only** the bound `approved_payload_digest`; arbitrary-bytes signing impossible. |
| **Testnet/devnet-shaped proof** | `reports/E2-C5-1-SIGN-ONLY-TESTNET-SHAPED-PROOF-EVIDENCE.md` + `test/sign-only-testnet-shaped-proof.test.mjs` | The sign-only path produces a valid Ed25519 signature over a **testnet/devnet-shaped local payload**, verified **off-chain**, with **nothing sent**. Mainnet/endpoint/RPC/broadcast payloads are **refused before signing**. |
| **No-SDK custody/KMS** | `reports/E2-KMS-11-NO-SDK-CUSTODY-KMS-CLOSURE.md` (KMS-0…KMS-10) | A fail-closed, contract-shaped custody/KMS surface (opaque non-exportable key-handle interface + provider skeleton + config validation/hardening) with **no SDK, no real provider, no live calls, no key material, no activation**. `isConfigured()===false`; `resolveKeyHandle()` → `handle:null`, `DEGRADED`. **NO SDK SELECTED YET.** |

**Capability invariant (unchanged):** the runtime's global `capabilities()` is **all-false**
(`can_sign:false, can_send:false, has_key_material:false, live_mechanisms:false, allowlisted:false`). Only a
**local** sign-only descriptor reports `can_sign:true` (sign-only / test-gated). **`can_send` is `false`
everywhere** — there is no send path, no RPC, no serialization, no provider call anywhere in the repo. The
mechanism guard keeps `tx-send` (`sendTransaction`/`sendRawTransaction`/`sendAndConfirmTransaction`),
`tx-serialize` (`.serialize(`), `rpc-connection` (`new Connection(`), `http-fetch`, and `websocket`
**HARD-forbidden** — including inside the one allowlisted path.

**Net:** signing is real but **off-chain and confined**; custody/KMS is **contract-only / no-SDK**; **nothing is
broadcast**. E2-F is the first time "actually putting bytes on a network" is even *designed* — and this PR
designs the boundary only.

## 2. The E2-F boundary (what send is, and is not, in this engine)

**Send / broadcast is a separate phase (E2-F+), not a continuation of signing.** A signature is cryptographic
proof; a broadcast is an irreversible network action with real-money consequences. They are deliberately split:

1. **E2-F-0 (this PR) = design + threat review only.** No mechanism. It fixes the boundary, the threat list,
   the required future tests, and the first-safe next step.
2. **RPC / send requires its own explicitly-approved PR** — never folded into a signing or custody PR. The first
   such PR is **testnet-only, off-live or no-live-RPC**, gate-contract / design-with-tests, and adds the send
   path behind a gate **before** any live endpoint is ever contacted.
3. **Mainnet and REAL-LIVE are out of scope for the entire E2-F track** and remain distinct, later decisions
   (`09-THREAT §7` readiness + zero `§7.8` blockers; `signer_control` + two-person rule).

**Where send eventually lands in SSOT (design context only — none implemented here):** a future send phase will
consume **existing** SSOT vocabulary — `execution_mode` (`helius_sender` · `jito_send` · `jito_bundle` ·
`jupiter_route` · `manual_approval` · `auto`), `bundle_status` (`Pending` · `Failed` · `Landed` · `Invalid` ·
`STALE_BUNDLE`), `bundle_ttl_slots`, Execution Trace timestamps `candidate_ts_sent` / `candidate_ts_landed`,
`failure_type` (`BundleFailed` · `BlockhashExpired` · `RPCDropped` · …), `candidate_failure_origin`
(`provider`/`route`/`bundle`/…), and `NETWORK_ROLLBACK_EVENT`. **This PR implements none of them.** Any genuinely
new field (e.g. a real `network` / endpoint / RPC-URL field that does not already exist in SSOT) is a
**stop condition → ARCH → SSOT first**, before any code.

**Boundary invariants that must survive into E2-F:**
- Send is **gated, never implicit** — a valid signature must **never** auto-broadcast.
- **Sign and send are distinct capabilities** — `can_sign:true` must not imply `can_send:true`.
- **Testnet-first** — devnet/testnet/localnet only; mainnet is a separate decision and is **refused** by default.
- The **one-allowlisted-path** rule and **key-material HARD-forbidden everywhere** rule are unchanged.

## 3. Threat review (send/broadcast phase)

| # | Threat | Failure it would cause | Control carried into E2-F |
|---|---|---|---|
| T1 | **Accidental mainnet** | Real-money broadcast on the wrong cluster. | Testnet-family allowlist (`devnet`/`testnet`/`localnet`); mainnet/`mainnet-beta`/prod **refused** by default (reuse the E2-C5-1 / KMS-10 refusal pattern); mainnet is a separate explicit decision, never a default. |
| T2 | **Hidden / implicit RPC** | A provider/endpoint contacted without an approved send PR. | `rpc-connection` (`new Connection(`), `http-fetch`, `websocket` stay HARD-forbidden — even in the allowlisted path; a live endpoint may appear only in a dedicated, approved send PR, behind a gate. |
| T3 | **Serialization creep** | `.serialize(` / transaction-building slips in under a "signing" or "proof" PR. | `tx-serialize` stays HARD-forbidden repo-wide; transaction building/serialization is its own gated step in the send phase, never bundled with signing. |
| T4 | **Endpoint / config leakage** | RPC URL / provider creds / endpoint in repo / env / logs / audit / report. | Endpoint/URL/`rpc`/`provider_url`/`broadcast`/`send`/`websocket`/live-call indicators stay **blocked** in config values (E2-KMS-10); audit/report stay **refs-only** (`AUDIT_COLUMNS`); secrets via `candidate_provider_key_ref` only — never raw. |
| T5 | **Replay / stale approval** | A signature/approval reused to broadcast a different or expired intent. | Send must re-check the same bound-digest + freshness gate that signing uses (`payload_digest_mismatch`, `approval_stale`); a send is valid only for its own fresh, approved intent; idempotency via `idempotency_key`/`intent_id`. |
| T6 | **Gate bypass** | Send reached without preflight / readiness / custody / risk gates. | Send must sit **behind the existing gate chain** (preflight + E0 readiness + custody DEGRADED fail-closed + Hard-Risk + `real_live_config_valid`); any uncertainty → fail-closed refusal, never broadcast. |
| T7 | **Signing/sending mismatch** | Bytes broadcast differ from the bytes that were approved/signed. | Send must broadcast **only** the exact signed, bound payload; no re-encode/mutate between sign and send; mismatch → refuse. |
| T8 | **Audit leakage** | Signature / digest / key / raw payload / endpoint written to audit or reports. | Audit before/after on every send attempt; keys ⊆ `AUDIT_COLUMNS`; **no** signature/digest/key/private/endpoint in audit or reports (carry forward E2-C / KMS controls). |
| T9 | **Capability drift** | Global `can_send` flips true, or send "leaks" outside the allowlisted path. | Global `capabilities()` stays all-false until a separate send decision; send mechanism confined to the one allowlisted path; `ALLOWLIST` length stays `1`. |

## 4. Required future tests (for the eventual E2-F send PRs — none added here)

- **No-implicit-broadcast:** a valid signature must **not** trigger any send; `can_send` stays `false` until an explicit, gated send call.
- **Testnet-only / mainnet refusal:** send refuses mainnet/`mainnet-beta`/prod and any endpoint/RPC/broadcast indicator before any network action.
- **Gate-failure refusal:** every gate failure (`payload_digest_mismatch`, `approval_stale`, `readiness_not_ready`, `custody_degraded`, `custody_unconfigured`, risk/`real_live_config_invalid`) refuses to send.
- **Sign↔send identity:** the broadcast bytes equal the signed/approved bound payload; any mutation → refuse.
- **No-leak:** no endpoint/RPC/key/signature/digest in output, audit, errors, or source; no static endpoint/key literals; no `fixtures/`.
- **Confinement / allowlist:** send mechanism only under `packages/isolated-signer-runtime/src/`; `ALLOWLIST` length `1`; guard `allowlist=1 violations=0`.
- **Audit before/after:** per send attempt; keys ⊆ `AUDIT_COLUMNS`; refs-only.
- **No-live-RPC harness first:** the first send tests run against a **simulated/no-live-RPC** boundary (off-live), proving the gate/refusal logic without contacting any network.

## 5. Stop conditions

- Any **RPC / send / broadcast** mechanism, or `new Connection(` / `sendTransaction` / `sendRawTransaction` / `sendAndConfirmTransaction` → **STOP**.
- Any **transaction building / serialization** (`.serialize(` / `new Transaction` / `buildTransaction`) → **STOP**.
- Any **provider SDK import** or **dependency install** / lockfile change → **STOP**.
- Any **live provider call** / endpoint / RPC URL → **STOP**.
- Any **credential / secret / key material** (key/seed/mnemonic/keypair/PEM/base58 blob) → **STOP**.
- Any **mainnet / REAL-LIVE** → **STOP** (separate, distinct decision).
- Any **`ALLOWLIST` change** / new allowlist path → **STOP**.
- Any **new SSOT/API/DATA/CONFIG name** (e.g. a real `network`/endpoint field) → **STOP → ARCH → SSOT first**.
- Any **`candidate_*` → implemented** promotion → **STOP**.

## 6. First-safe recommendation (next step — NOT started)

Recommended next PR (design-with-tests, **no live RPC**), one of:
- **`pr-e2-f1-testnet-send-design-tests-no-live-rpc`** — add **test-only / off-live** evidence that a send-gate
  contract refuses correctly (mainnet refusal, gate-failure refusal, no-implicit-broadcast, sign↔send identity)
  against a **simulated / no-live-RPC** boundary; **no real send, no RPC, no SDK**; or
- **`pr-e2-f1-send-gate-contract-no-rpc`** — a **contract/skeleton** send-gate in the allowlisted path that is
  **always fail-closed** (`can_send:false`, refuses), with **no RPC / no serialization / no SDK**, mirroring the
  E2-C3-2 / KMS-4 skeleton pattern.

Either keeps the **first** send work to **gate + refusal semantics**, off-live, before any live endpoint is ever
introduced. **Not started by this PR.**

## 7. Forbidden in this PR (and carried into the E2-F track)

No KMS/Vault integration · No KeyManager · No private keys/seeds/keypairs/mnemonics/test wallets · No crypto
library · No signing library · No transaction building · No transaction serialization · No signing/sending · No
RPC/Solana/Jupiter/Helius/Jito · No provider live calls · No live transfer/sweep/funding · No DB writes · No
migrations · No new config · No Docker changes · No API/dashboard · No REAL-LIVE activation · No
`candidate_*`→implemented · No `ALLOWLIST` change · No new allowlist path · No new
user/API/runtime/config/data/audit/risk/signer/intent/position/execution-wallet/readiness/error name outside
SSOT/API/DATA/CONFIG.

## 8. Guard / allowlist & readiness impact

- **No `ALLOWLIST` change**; mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`;
  **NOT READY FOR SEND / BROADCAST / KMS / REAL-LIVE** unchanged. **`can_send:false`** unchanged.

---

**Confirmations:** Report / design-only · No send/broadcast introduced · No RPC introduced · No provider SDK
introduced · No transaction serialization introduced · No KMS/Vault/KeyManager introduced · No private key
material introduced · No new signing introduced · No REAL-LIVE activation · No `ALLOWLIST`/allowlist-path change
· No new SSOT name introduced · No new execution authority introduced.
