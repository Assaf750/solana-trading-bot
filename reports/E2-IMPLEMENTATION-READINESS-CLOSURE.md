# E2 — Implementation Readiness Closure Report (report/evidence-only)

> **REPORT / EVIDENCE-ONLY.** No runtime code, no package, no tool, no test, no `ALLOWLIST` change, no
> allowlist-path change, no KMS/Vault, no KeyManager, no crypto/signing library, no keys/secrets, no
> signing/sending, no execution authority. References existing SSOT names and already-merged artifacts only;
> introduces no new SSOT/API/DATA/CONFIG name. This report **reads and attests** the current state; it does
> **NOT** start E2 implementation.
>
> **State:** `main` @ `3e69ef4` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 386/386 tests · mechanism guard
> `allowlist=1 violations=0`.

---

## 1. Current state
- **All custody-ops blockers `DECIDED`:** B1–B8 = `DECIDED` (`reports/E2-CUSTODY-OPS-POLICY.md §8`).
- **Aggregate:** **READY FOR E2 IMPLEMENTATION REVIEW** (8 `DECIDED`, 0 `BLOCKED`).
- **Guard allowlist:** active `ALLOWLIST` holds **exactly one** path —
  `packages/isolated-signer-runtime/src/` — identical to `DECLARED_ALLOWLIST_PATHS`. No wildcard, no regex,
  no general bypass.
- **Verification at this commit:** drift PASS; mechanism guard PASS (`sources=70 fixtures=27 allowlist=1
  violations=0`); full tests 386/386.

## 2. Evidence inventory (already merged; cited, not modified)
| Evidence | Artifact | What it establishes |
|---|---|---|
| E0 — readiness evaluator | `packages/real-live-readiness/` | `evaluateRealLiveReadiness()` → `{ ready, blockers, prerequisite_for:'activate_real_live' }`; fail-safe; reference-only (no activation). |
| E1 — signer-service boundary | `packages/signer-service-boundary/` | `requestSign()` always returns `signed:false / can_sign:false / can_send:false`; audit before+after; never signs. |
| E2-0 — keyless custody lifecycle | `packages/keyless-custody-lifecycle/` | `custody_phase ∈ {idle,loaded,degraded,zeroized}`; fail-closed `DEGRADED`; least-privilege per `signer_profile_id`; revoke/disable/zeroize/panic; refuses key material. |
| E2-1 — isolated signer runtime skeleton | `packages/isolated-signer-runtime/` | capabilities-all-false skeleton; no live mechanism, no key, no signing authority. |
| H3 — carve-out model | `tools/check-mechanism-guards.mjs` (`isAllowlisted`/`scanText`) | per-path exemption for live mechanisms only; `allowlisted_but_key_material:*` keeps key material forbidden. |
| H4 — declared path | `DECLARED_ALLOWLIST_PATHS` | single declared isolated-signer path (declaration). |
| H5 — activation dry-run | `tools/check-mechanism-guards.h5.dryrun.test.mjs` · `reports/H5-ALLOWLIST-ACTIVATION-DRY-RUN.md` | activation proven testable before flipping the switch. |
| B8 — allowlist activation | `tools/check-mechanism-guards.b8.activation.test.mjs` · `reports/E2-RATIFICATION-B8-ALLOWLIST-ACTIVATION.md` (`DR-E2-B8-001`) | single declared path activated; key material still forbidden; fail-closed elsewhere. |
| E2-R1..R5 — ratification records | `DR-E2-B1B2-001`, `DR-E2-B3-001`, `DR-E2-B4B5-001`, `DR-E2-B6B7-001`, `DR-E2-B8-001` | governance decisions for B1–B8. |

## 3. Readiness checklist
**Ready for review (decided + evidenced):**
- Custody class/boundary (B1/B2), dual-control (B3), key-gen/rotation policy (B4/B5), break-glass + audit
  retention (B6/B7), allowlist activation (B8).
- Keyless scaffolding: readiness evaluator, signer-service boundary (never-signs), keyless custody lifecycle
  (fail-closed), isolated-signer skeleton (capabilities-all-false).
- Guard path activated for exactly one isolated-signer path, with key material hard-forbidden and fail-closed
  elsewhere.

**Remains separate approval (NOT in this report):**
- E2 implementation itself (real custody/signing in the isolated path).
- KMS/Vault integration (its own PR).
- Signing implementation (its own PR).
- REAL-LIVE activation (`activate_real_live`).

## 4. Remaining non-blocking ops parameters (pending their own provisioning approvals)
- **Vendor instance** (B1) — concrete KMS/HSM and non-exportability attestation.
- **Deployment tier** (B2) — container vs isolated VM + topology evidence.
- **Break-glass quorum/threshold** (B6) — numeric quorum + any third-reviewer rule.
- **Audit retention duration** (B7) — duration + archival approach (no secrets).
- **Post-incident review process** — owner + evidence-package SLA.
> These are ops/compliance parameters; none blocks "ready for review", and none is set here.

## 5. Strict next-step boundary
- **E2 implementation still requires an explicit, separate approval.** This report does not authorize it.
- **KMS integration = separate PR.**
- **Signing implementation = separate PR.**
- **No REAL-LIVE activation** under any circumstance in this report.
- No `ALLOWLIST` change, no new path, no candidate→implemented.

## 6. Risk controls that MUST be carried into any future E2 implementation
- **Key material never in repo / `.env` / DB / logs / cache / fixtures.**
- **Key material forbidden even inside the allowlist** (`allowlisted_but_key_material:*`).
- **Only the isolated-signer path is allowlisted**; no other path may be added without a separate governance decision.
- **Every path outside the allowlist stays fail-closed** for live mechanisms.
- **Fail-closed `DEGRADED`** on any custody/KMS uncertainty — never sign on unverified custody.
- **Zeroization** on revoke; **least-privilege** per `signer_profile_id`.
- **Audit before/after** for signing-sensitive and break-glass actions; append-only; references only.
- **Readiness per `09-THREAT §7`** with **zero `§7.8` blockers** before REAL-LIVE.

## 7. Final statement
- **READY FOR E2 IMPLEMENTATION REVIEW.**
- **NOT** `E2 IMPLEMENTATION STARTED`.
- **NOT** REAL-LIVE ready.
- **NOT** KMS integrated.
- **NOT** signing enabled.

---

**Confirmations:** Report/evidence-only · E2 implementation NOT started · No allowlist change · No KMS/Vault/
KeyManager introduced · No key material introduced · No execution authority introduced.
