# E2 Stage-21 — Testnet/Devnet Execution — TESTNET-SEND BOUNDARY (never-ready seam) — EVIDENCE

> **Stage-21 (Phase D).** A dedicated **send-path security review of the PLAN** (Phase-D precondition #8) returned
> **PLAN_APPROVED, approved_approach = `build_seam_descriptors_only`, 0 blockers**: a full self-contained testnet
> send adapter is structurally impossible in-repo (real broadcast needs owner inputs that are correctly absent,
> and a live network primitive must not enter a non-allowlisted package, and a dedicated send-adapter ALLOWLIST
> entry is a *separate* owner governance decision). So Stage 21 builds the new
> **`@soltrade/testnet-send-boundary-foundations`** — the fail-closed send-path + a **never-ready
> testnet-activation seam** + testnet-SHAPED proof (NO real network) — stopping honestly at the owner-input
> boundary, exactly like the Stage-17 live-stream seam.
>
> **State:** built on `main` @ `308bdd3` (branch `pr-s21-testnet-send-boundary`, `main + 1`, parent == main) ·
> mechanism guard `sources=117 fixtures=27 allowlist=1 violations=0` (**ALLOWLIST EXACTLY
> `['packages/isolated-signer-runtime/src/']` — no second entry**) · SSOT drift EXACT · full suite **1834/1834**
> · package **24/24** · independent spot-check **16/16** · the four frozen siblings (send-gate-contract,
> rpc-provider-contract, send-broadcast-review-foundations, isolated-signer-runtime) **UNMODIFIED**.

---

## 1. The eight foundations (18 exports)
| Part | Foundation | Behavior |
|---|---|---|
| A | Testnet-Send Input Boundary | consumes a Stage-19 sign-only DESCRIPTOR (shape only — never re-signs) + Stage-12 `SEND_REVIEW_PASS_ADVISORY` + explicit `devnet`/`testnet`/`localnet` tag + intent_id; **MAINNET HARD-REFUSAL** (any mainnet/mainnet-beta/prod token incl. nested → `mainnet_refused`); raw key/endpoint/url refused, never echoed |
| B | **Testnet-Activation Seam** (the crux) | `activation_performed:false` + `send_ready_advisory:false` FIXED literals; `endpoint_in_repo`/`key_in_repo`/`secret_in_repo` fixed false; `TESTNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION` **hardcoded met:false** → seam can NEVER be ready in-package across all met-combinations; `required_owner_inputs` documents exactly what the owner must supply out-of-repo |
| C | Idempotency Guard | one `intent_id` → at most one send; duplicate → `DUPLICATE_REFUSED`; first-seen is non-authorizing (`can_send` stays false) |
| D | Failed-Send Classifier | maps to existing `failure_type` VALUE vocabulary (consumed-only); unknown → `Unknown` |
| E | Bundle-Status Observer | consumes `bundle_status` VALUEs; STALE detection past caller-supplied ttl (never defaulted) |
| F | Suppression | always-suppressed (`not_send`/`not_broadcast`/`not_execution`_authorized) |
| G | Forbidden Surface Guard | NAME-only redaction (key + endpoint/url + api_key/bearer/token + mainnet); `isValidEndpointRef` shape-check (opaque short ref only) |
| H | Health | clean path → SUPPRESSED |

## 2. Security spine (build arbiter + my 16/16 spot-check)
- **No live primitive:** zero `fetch`/`WebSocket`/`Connection`/`sendTransaction`/`.serialize()`/socket/grpc/
  Solana/Jupiter/Helius/Jito in src (only prose in the header comment). `can_send`/`can_broadcast` fixed-false on
  every path; default (no injected caller) = fail-closed.
- **Seam never-ready:** proven across all 8 presence-flag combinations + forged truthy
  `send_ready_advisory`/`activation_performed`/`can_send` inputs — all stay false.
- **Mainnet hard-refused** top-level and nested; **secrets by reference** (URL/PEM/base58/long refs refused,
  values absent from `JSON.stringify`).
- **Sign-only/send separation structural** (no signing/crypto import; consumes only the signature descriptor).
- **send-gate-contract still refuses** (`ok:false`/`can_send:false`) beside everything; hostile proxies → frozen
  refusal, never throw; TOCTOU snapshot-once; all results frozen + 24 flags false.

## 3. Required owner inputs to actually broadcast on testnet (documented; NONE in repo)
From the approved plan, the seam enumerates what the owner must supply out-of-repo:
1. A **testnet/devnet RPC endpoint by reference only** (opaque `endpoint_ref` resolved out-of-repo at activation
   time; no URL/API-key in repo).
2. A **funded testnet/devnet wallet/keypair** supplied out-of-repo (repo holds no key/seed/funds).
3. An **out-of-repo broadcast caller** injected at runtime (the package carries no network primitive).
4. An explicit, separate **owner governance/ALLOWLIST decision** (a new DR-E2 ratification) authorizing a
   dedicated send-adapter package path — *distinct from* this stage and not bundled into it.
5. That adapter's **own dedicated security review + supply-chain review** for any RPC client/SDK.
6. An owner **approval record** attesting no-mainnet / no-real-live and acknowledging the separate-PR /
   separate-allowlist / out-of-repo-binding / funded-wallet / supply-chain requirements.

## 4. Verification
| Layer | Result |
|---|---|
| Plan review (3 reviewers + arbiter) | PLAN_APPROVED `build_seam_descriptors_only`, 0 blockers |
| Build workflow (impl + 3 lenses + arbiter) | GREEN, 0 blockers |
| Package / full suite | 24/24 · 1834/1834 |
| Independent spot-check | 16/16 |
| SSOT drift / mechanism guard | EXACT · `sources=117 allowlist=1 violations=0` (single entry) |

---

**Stage-21 boundary CLOSED to the owner-input seam.** Testnet send is built up to — and provably **cannot pass** —
the never-ready activation seam in-package; no live primitive; mainnet hard-refused; secrets by reference; sign-only/
send separation structural; send-gate still refuses; ALLOWLIST single entry unchanged; suite 1834/1834. **A real
testnet broadcast requires the documented owner inputs + a separate owner-gated, separately-allowlisted,
separately-reviewed adapter. Next = Phase-D Gate, then Phase E (Stage 22 readiness/Hard-Risk wiring; Stage 23
mainnet-activation seam — built to the switch, owner-decision only).**
