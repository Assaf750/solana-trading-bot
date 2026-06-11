# E2 Stage-23 — Mainnet REAL-LIVE Activation Seam — EVIDENCE

> **Stage-23 (Phase E) — the FINAL build stage.** Creates `@soltrade/mainnet-activation-seam-foundations`: a
> **never-ready, read-only mainnet REAL-LIVE activation seam** — the mainnet analogue of the Stage-17 live-stream
> seam and Stage-21 testnet-send seam. It describes exactly what real mainnet activation would require and
> **CANNOT self-activate under ANY input.** Real-money activation is the **owner's physical switch**; this stage
> builds everything up to the switch and stops. Nothing here can flip `can_send`, sign, send, broadcast, or
> activate REAL-LIVE.
>
> **State:** built on `main` @ `668336e` (branch `pr-s23-mainnet-activation-seam`, `main + 1`, parent == main) ·
> mechanism guard `sources=119 fixtures=27 allowlist=1 violations=0` (**ALLOWLIST EXACTLY the single
> isolated-signer entry**) · SSOT drift EXACT · full suite **1854/1854** · package **20/20** · independent
> spot-check **14/14** · all existing packages UNMODIFIED.

---

## 1. The six foundations (13 exports)
| Part | Foundation | Behavior |
|---|---|---|
| A | **Mainnet-Activation Seam** (the crux) | `activation_performed`/`real_live_activated`/`seam_ready`/`can_send` FIXED false on every state; `MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION` **hardcoded met:false** → never ready even with all other reqs met + forged truthy; consumes a real-live-readiness verdict (ready===true + 0 blockers) + `capital_limit` (finite > 0) by shape; `required_owner_inputs` documented; `endpoint_in_repo`/`key_in_repo`/`funds_in_repo` fixed false |
| B | Global Kill-Switch read-model | fail-safe **ENGAGED** on default/missing/unknown/non-bool; only explicit `kill_engaged:false` disengages |
| C | Emergency-Exit read-model | EXITS_ONLY-shaped advisory posture from operating_state; never trades |
| D | Suppression | always-suppressed (`not_activate`/`not_send`/`not_execution`_authorized) |
| E | Forbidden Surface Guard | NAME-only redaction + `isValidMainnetEndpointRef` shape-check |
| F | Activation Health | **no ready/activated state exists** — best attainable is `_SUPPRESSED`; kill engaged / surface blocked / not-ready / send-gate-not-refusing → `_BLOCKED` |

## 2. Never-activates guarantee (build arbiter 896-combo sweep + my 14/14 spot-check)
- A **maximal clean input** (all 6 owner reqs satisfiable + a genuinely-ready readiness verdict) + **forged truthy**
  `seam_ready`/`activation_performed`/`real_live_activated`/`can_send` → the seam still returns all of those
  **false**. The adapter-allowlist requirement is the **sole structural blocker** (proven: the other six reach
  met:true on clean input while the adapter req stays met:false and seam_ready stays false).
- Kill switch fail-safe ENGAGED when unknown; not-ready readiness / missing / `capital_limit` 0/neg/Infinity/NaN →
  requirement met:false; raw mainnet URL/key/PEM/base58 refused and absent from JSON; `send-gate` still
  `ok:false`/`can_send:false` beside it; hostile proxies → frozen refusal, never throw; suppression always carries
  the three `not_*_authorized`.
- Static: src import-free; zero live network/signing/crypto/clock/env/RNG primitive in code (only prose + literal
  field-name arrays); no `can_send:true`/`seam_ready:true`/`activation_performed:true` literal; no module-level
  mutable state; no new candidate_*; LOCAL `MAINNET_*` naming.

## 3. Required owner inputs to actually activate mainnet REAL-LIVE (documented; NONE in repo)
1. An explicit **owner go-decision** (the physical switch — never thrown by the system).
2. A **funded mainnet wallet** supplied out-of-repo (no key/seed/funds in repo).
3. A **mainnet RPC endpoint by reference** (opaque `endpoint_ref` resolved out-of-repo; no URL/secret in repo).
4. An explicit **capital/exposure limit** (finite > 0).
5. **All gates green** + a genuinely-ready REAL-LIVE readiness verdict (complete Hard-Risk, no implicit infinity).
6. A **separate owner governance/ALLOWLIST decision** authorizing a dedicated mainnet send adapter (its own
   review + supply-chain review) — distinct from this stage and the testnet one.

## 4. Verification
| Layer | Result |
|---|---|
| Build workflow (impl + 3 lenses + arbiter, 896-combo never-activates sweep) | GREEN, 0 blockers |
| Package / full suite | 20/20 · 1854/1854 |
| Independent spot-check | 14/14 |
| SSOT drift / mechanism guard | EXACT · `sources=119 allowlist=1 violations=0` (single entry) |

---

**Stage-23 boundary CLOSED to the owner switch.** The mainnet activation seam is built up to — and provably
**cannot pass** — the never-ready switch in-package; no live primitive; secrets by reference; kill-switch fail-safe
engaged; send-gate still refuses; ALLOWLIST single entry unchanged; suite 1854/1854. **Real-money mainnet
activation requires the documented owner inputs + a separate owner-gated, separately-allowlisted, separately-reviewed
adapter — it is the owner's physical decision, built up to but never thrown autonomously. Next = Phase-E Gate, then
the Final Delivery Report.**
