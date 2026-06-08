# E2 — Ratification Decision Record: B8 (Allowlist Activation)

> **GOVERNANCE / GUARD-ONLY decision record + activation.** This PR activates the single declared
> isolated-signer path in the mechanism guard's `ALLOWLIST`. It does **NOT** start E2 implementation, and
> introduces no KMS/Vault, KeyManager, crypto/signing library, keys, signing/sending, transaction
> building/serialization, RPC/provider calls, DB writes, migrations, config, API, dashboard, or REAL-LIVE
> activation. References existing SSOT names only; introduces no new SSOT/API/DATA/CONFIG name.
>
> This record **ratifies B8 only**, flipping its checklist status `BLOCKED → DECIDED`. It does **NOT** change
> the substance of B1–B7 (already `DECIDED`).
>
> **State:** `main` @ `5b6a367` · `ALLOWLIST` before = `[]` → after = `['packages/isolated-signer-runtime/src/']`.
> Filled per the E2-8 template (B8 is outside that template's B1–B7 form, so this record adapts it explicitly).

---

## 1. decision_id
`DR-E2-B8-001`

## 2. blocker_covered
**B8** (allowlist activation of the declared path) **only**. (B1–B7 unchanged `DECIDED`.)

## 3. selected_option
**Activate only the declared isolated-signer-runtime path** in the guard's `ALLOWLIST`:
- `ALLOWLIST` becomes **exactly one** entry: `packages/isolated-signer-runtime/src/` (identical to
  `DECLARED_ALLOWLIST_PATHS`). **No other path, no wildcard, no regex, no general bypass.**
- The activated path is exempt from the **live-mechanism** checks (FORBIDDEN_IMPORTS + FORBIDDEN_CODE) **only**.
  **Hardcoded key material stays HARD-FORBIDDEN even inside it** (`allowlisted_but_key_material:*`).
- **Every other path stays fail-closed** — live mechanisms anywhere else are still rejected.
- The package at that path is currently a **capabilities-all-false skeleton** (PR-E2-1); activation adds **no**
  live mechanism by itself.
- **E2 implementation does not begin here** — building real custody/signing in the isolated path requires a
  **separate** approval.

## 4. alternatives_considered
| Option | Disposition |
|---|---|
| keep B8 `BLOCKED` | **rejected** — would indefinitely block the (already governed) isolated-signer path despite B1–B7 DECIDED |
| activate a broad package allowlist | **rejected** — opens many paths; defeats fail-closed containment |
| **activate the single declared path only** | **selected** — minimal, exactly one governed path; everything else stays closed |
| activate with a wildcard/regex | **rejected** — non-auditable; could over-match siblings; no general bypass allowed |
| separate repo/process only (no allowlist entry) | **deferred/out-of-scope** — a stronger deployment topology may still apply later (B2), but does not replace the in-repo guard's single-path exemption |

## 5. approvers_required
- **Governance:** ratifies the activation decision (this record).
- **Security / ops:** confirms the activation is single-path, no-wildcard, key-material-still-forbidden, and
  fail-closed elsewhere.
- **`signer_control`:** allowlist activation is signing-sensitive (it opens the isolated-signer path) →
  `signer_control` + two-person rule (B3) apply to this decision.

## 6. evidence_references
- **H3 carve-out model** — `tools/check-mechanism-guards.mjs` `isAllowlisted`/`scanText` allowlist mechanism +
  `allowlisted_but_key_material:*` (key material never exempt).
- **H4 declared path** — `DECLARED_ALLOWLIST_PATHS = ['packages/isolated-signer-runtime/src/']` (declaration).
- **E2-1 isolated signer runtime skeleton** — `packages/isolated-signer-runtime/` capabilities-all-false.
- **H5 dry-run evidence** — `tools/check-mechanism-guards.h5.dryrun.test.mjs` + `reports/H5-ALLOWLIST-ACTIVATION-DRY-RUN.md`
  (activation was proven testable before flipping the switch).
- **B8 activation tests** — `tools/check-mechanism-guards.b8.activation.test.mjs` (this PR).
- **E2-R1/R2/R3/R4 ratification records** — `DR-E2-B1B2-001`, `DR-E2-B3-001`, `DR-E2-B4B5-001`, `DR-E2-B6B7-001`
  (B1–B7 context).
> All evidence documentary/executable; **no secrets, no key material** — references/attestations + tests only.

## 7. residual_risks
- **An exempt path can host live mechanisms once a real package is built there** — mitigated: only that single
  path is exempt, key material stays forbidden, and building real custody/signing needs a separate approval
  with its own positive isolation tests (`09-THREAT §7`). Owner: governance + `signer_control`.
- **Misuse if additional paths were added later** — mitigated by the single-path, no-wildcard invariant and
  the B8.* tests asserting `ALLOWLIST.length === 1`. Any new path = a new governance decision.
- **Activation is guard-scope only** — it does not itself prove runtime isolation; that is verified when an
  implementation PR lands. Until then the path holds only a skeleton.

## 8. rollback_or_revisit_conditions
- Any need to add a second path → a **separate** governance decision (this record authorizes only one path).
- Compromise/incident affecting the isolated-signer assumptions → re-open B8 (consider de-activation).
- If a future deployment chooses separate-repo/process isolation instead → revisit whether the in-repo
  exemption is still required.
- Key material ever found in the exempt path → immediate guard failure (`allowlisted_but_key_material:*`) and
  re-open B8.

## 9. status_before → status_after
| Blocker | status_before | status_after |
|---|---|---|
| B8 allowlist activation | `BLOCKED` | **`DECIDED`** (single declared path activated; no wildcard; key material still forbidden; fail-closed elsewhere; E2 implementation not started) |

## 10. Impact on aggregate readiness
- B8 is now **`DECIDED`**. With B1–B7 already `DECIDED`, **B1–B8 are all `DECIDED`**.
- **Aggregate: READY FOR E2 IMPLEMENTATION REVIEW** — all custody-ops blockers are decided and the guard path
  is activated.
- **This does NOT start E2 implementation.** Real KMS/custody/signing in the isolated path is a **separate,
  explicitly-approved** PR with positive isolation tests, fail-closed `DEGRADED`, zeroization, least-privilege,
  and `09-THREAT §7` readiness with zero `§7.8` blockers. Deferred ops/compliance parameters (break-glass
  quorum, audit retention duration, post-incident review, vendor instance, deployment tier) remain pending
  their own provisioning approvals.

---

**Confirmations:** Governance/guard-only · B8 ratified and activated (single declared path) · B1–B7 `DECIDED` ·
No wildcard / no general bypass · Key material HARD-forbidden even inside the allowlist · Fail-closed everywhere
else · E2 implementation NOT started · No KMS/Vault/KeyManager introduced · No key material introduced · No
execution authority introduced.
