# E2 Stage-20 — Key Management / Custody / Execution-Wallet Lifecycle — VERIFICATION + HARDENING CLOSURE EVIDENCE

> **Stage-20 closure (Phase D).** The custody + execution-wallet lifecycle layer already existed (Gate C/D PR
> series): `execution-wallet-registry`, `execution-wallet-admission`, `execution-wallet-lifecycle`,
> `execution-wallet-pool`, `wallet-rotation`, `signer-profiles-registry`, `keyless-custody-lifecycle`,
> `signer-service-boundary`/`signer-boundary`/`custody-provider-contract`. Per the Phase-D preconditions, Stage 20
> ran a **dedicated verification/composition review** of this layer — a verification stage, not a rebuild.
>
> **The review did its job: REVIEW_FAIL with one confirmed blocker**, fixed and regression-locked here, then a
> **re-review confirmed the blocker closed** (both fresh reviewers PASS, 0 blockers; the re-review arbiter agent
> stalled without emitting a verdict, so the binding confirmation was completed by an independent main-loop
> arbiter-equivalent probe — see §3).
>
> **State on `main`:** `3ff105f` + this stage (`2deca30`) · full suite **1810/1810** (+6 hardening tests) ·
> SSOT drift EXACT · mechanism guard `sources=115 fixtures=27 allowlist=1 violations=0` (ALLOWLIST line 121
> byte-identical) · no real KMS/custody provider · no raw key anywhere.

---

## 1. The defect the review caught (and the fix)
**Blocker (confirmed by 2 reviewers + arbiter):** six lifecycle entry points threw a `TypeError` on
`null`/uninspectable (throwing-getter) input instead of returning a structured refusal, violating the Phase-D
precondition **"hostile/uninspectable input → refused, never throws."** Critically: **no fail-open existed** —
the throw preceded any state mutation (`admission(null)` admitted nothing, etc.) — but the enumerated invariant
was unmet, and the test suite was green only because no test exercised `null` input.

**Fix (the reviewer-suggested shape), applied to all six:** a `null`/non-object/array guard returning the
resource's existing refusal shape, **plus an outer `try/catch` body wrap** so a throwing-getter property access
becomes `invalid_request` rather than an exception —
`execution-wallet-registry.register` · `signer-profiles-registry.register` ·
`execution-wallet-admission.activateExecutionWallet` · `execution-wallet-lifecycle.run`
(drain/disable/revoke/...) · `wallet-rotation.rotateExecutionWallet` · `execution-wallet-pool.assign`. **+6
per-package regression tests** (null/undefined/number/string/array/throwing-Proxy → `doesNotThrow` + `ok:false`).
This makes "refused, never throws" uniform across Gate C/D/E.

## 2. What the review verified clean (mitigating + positive findings)
- **Keyless / no raw key:** key/seed/mnemonic/keypair plants (incl. nested) refused and never echoed in result
  or audit; custody is keyless/stub; provider secrets by reference only.
- **Admission fail-closed:** `WARMING_UP → ACTIVE` only after permission(admin|signer_control) + WARMING_UP +
  signer `ACTIVE` + custody mode present + custody verified + funded + signer reachable + `real_live_config_valid`
  (Hard-Risk complete); each missing precondition → refused.
- **signer_control is a separate sensitive permission** for revoke/kill/signer-bind.
- **Total + fail-closed state machines** with sticky terminals (REVOKED/RETIRED no outgoing except
  RETIRED→REVOKED); illegal transitions → `COMMAND_NOT_ALLOWED_IN_STATE`, never execute; ownership changes only
  on a CONFIRMED asset-transfer descriptor; rotation retires the old wallet only after transfer (and sweep)
  confirmed.
- **Audit before/after** on transitions/commands, AUDIT_COLUMNS-only, no secrets; mechanism guard ALLOWLIST
  single entry; no lifecycle package allowlisted; no live mechanism / dependency / network / clock / RNG.

## 3. Verification summary
| Layer | Result |
|---|---|
| Dedicated verification review (3 reviewers + arbiter) | REVIEW_FAIL → 1 confirmed blocker (hostile-input throw) |
| Hardening fix + regressions (`2deca30`) | 6 entry points guarded + 6 tests |
| Re-review reviewers (blocker-closed + regression/scope) | 2× PASS, 0 blockers |
| Re-review arbiter agent | stalled (no verdict emitted) — superseded by the independent probe below |
| Independent main-loop confirmation (6 entry points × 6 hostile inputs + no-fail-open + happy-path + key-material) | **39/39 PASS** |
| Full workspace suite | **1810/1810** (was 1804) |
| SSOT drift / mechanism guard | EXACT · `sources=115 allowlist=1 violations=0` (line 121 unchanged) |

## 4. Stage-21 must preserve (carried from the review conditions)
Keyless/no-raw-key on every input path; admission fail-closed gate; `signer_control` as separate permission;
total fail-closed state machines with sticky terminals + ownership-on-CONFIRMED-only; audit before/after with
AUDIT_COLUMNS-only entries; single ALLOWLIST entry (testnet send mechanism, if any, lives only inside it);
SSOT drift EXACT; REAL-LIVE/mainnet/real funds out of scope and owner-only.

---

**Stage-20 CLOSED.** Custody + execution-wallet lifecycle verified against the Phase-D preconditions; the review
caught a real fail-closed gap at 6 entry points, now fixed and regression-locked, re-review PASS. Keyless, no raw
key, signer_control-gated, fail-closed state machines, audit retention — all confirmed. Suite 1810/1810 · drift
EXACT · ALLOWLIST unchanged. **Next = Stage 21 (Testnet/Devnet Execution — first real send path, testnet only,
behind its own dedicated send-path security review; reaches the owner-input seam).**
