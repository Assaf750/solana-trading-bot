# E2 Phase-D Gate — Real Signing / Custody / Testnet-Send Integration + Security Sign-off — EVIDENCE

> The multi-agent **Phase-D Gate** ran over the completed Phase D (Stages 19–21) at `main` @ `e2a1d06`.
> **Decision: `PHASE_D_GATE_PASS` — 0 confirmed blockers.** Three auditors (sign/send isolation · regression+guards
> · preconditions+owner-seam) all pass; the arbiter independently re-ran the toolchain and a 38/38 end-to-end
> sign→send-boundary probe.

---

## 1. Gate verdict
| Auditor | Verdict | Blockers |
|---|---|---|
| Sign/Send Isolation | pass | 0 |
| Regression + Guards | pass | 0 |
| Preconditions + Owner-Seam | pass | 0 |
| **Gate Arbiter** | **PHASE_D_GATE_PASS** | **0 confirmed** |

## 2. Independently verified (arbiter 38/38 probe + toolchain)
- **SIGN-ONLY end to end:** a real Stage-19 gated sign over a clean preflight with an ephemeral **non-extractable**
  Ed25519 key (`extractable===false`; `exportKey(pkcs8)` threw) produced a **genuine** signature (`webcrypto.verify`
  true vs the bound digest, false vs tampered bytes), `can_send:false`, `mode:'sign_only'`, with no
  tx/serialized/endpoint/sent/broadcast key.
- **Send boundary:** Stage-21 consumed the signature **by shape only**; `can_send`/`can_broadcast`/
  `broadcast_permitted` stayed false; signature value never echoed; a `can_send:true` signing_result was refused;
  the activation seam stayed **never-ready** even with all 4 owner refs present + forged truthy inputs.
- **send-gate-contract** returns `ok:false` (can_send/can_broadcast/sent/broadcast false, signature null) beside
  everything; **mainnet hard-refused** top-level and nested.
- **Key hygiene:** nested secret_key name + value-shaped base58 refused with no signature emitted; throwing
  `audit.append` in the before-phase fail-closed the sign; audit blobs carry neither signature nor digest.
- **Custody fail-closed** on null/undefined/number/string/array/throwing-getter for all entry points (never throw).
- **Regression/isolation:** suite **1834/1834** (0 skip); SSOT drift EXACT; mechanism guard `sources=117
  allowlist=1 violations=0` (line 121 byte-identical via `od -c`); zero `*:true` send assignments in src; no
  cross-package signer import; no new dependency; clean tree; `HEAD == origin/main == e2a1d06`.

## 3. Phase-E preconditions (binding) — adopted verbatim
1. **Stage 22** wires `real_live_config_valid` to REQUIRE a COMPLETE Hard-Risk limit set with **no implicit
   infinity** (all `max_daily_loss_*`/`max_total_drawdown_pct`/`max_open_positions`/`max_position_size_pct`/
   `max_token|creator|cluster|correlated_meme_exposure_pct` present & finite) + ALL kills (daily-loss, drawdown,
   protocol-constant-changed, model-drift, global kill switch) + the full readiness checklist; any missing/unknown/
   invalid limit → fail-safe NOT-ready.
2. Stage 22 stays strictly READ-ONLY/advisory (pure result-models, no auto-activation); `can_send`/`can_broadcast`
   fixed false; `activate_real_live` stays a `signer_control`-gated command that only checks
   `real_live_config_valid` and cannot itself sign/send; Hard-Risk never weakened by `ev_gate_mode=warning_only`.
3. **Stage 23** builds ONLY a never-ready mainnet-activation SEAM (mirrors Stage-21): `activation_performed` &
   `send_ready_advisory` hardcoded false; a separate-send-adapter-allowlist governance decision hardcoded
   met:false; **documents the exact owner inputs** (owner-funded mainnet wallet out-of-repo, mainnet RPC endpoint
   ref out-of-repo, explicit capital/exposure limit, explicit owner go-decision, separate mainnet send-adapter
   allowlist governance decision); CANNOT self-activate under any input incl. forged truthy.
4. Stage 23 exposes the global kill switch + Emergency Exit ONLY as read-models in non-allowlisted src (no live
   primitive); a real mainnet send adapter remains a SEPARATE owner-gated/reviewed/allowlisted decision, not part
   of Phase E.
5. mainnet, real funds, real keys, provider secrets stay **OWNER-ONLY and OUTSIDE the repo** throughout Phase E;
   secrets by opaque reference only, never echoed; no key material as an emitted value anywhere.
6. ISOLATION every merge: ALLOWLIST stays the single isolated-signer entry; no new package imports the signer
   runtime in src; no live network primitive in non-allowlisted src; non-extractable per-call keys; audit
   fail-closes before AND after; custody entry points stay fail-closed on hostile input.
7. No new external dependency; No-field-before-SSOT; SSOT drift stays EXACT (or governed ARCH→SSOT only).
8. Every Phase-E merge fully green (suite 0 skip, both guards, clean tree, origin sync); a dedicated review
   precedes any code touching signing/sending/custody/activation surfaces.

## 4. Decision
**Phase D is coherent, sign-only/send-isolated, key-leak-proof, mainnet-refusing, and owner-seam-honest. The
Phase-D Gate PASSES; Phase E (Stage 22 readiness/Hard-Risk wiring; Stage 23 mainnet-activation seam) opens under
the preconditions above.**
