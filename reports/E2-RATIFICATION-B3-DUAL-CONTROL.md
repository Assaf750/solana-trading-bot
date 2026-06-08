# E2 — Ratification Decision Record: B3 (Dual-Control / `signer_control` Ops)

> **DOC/REPORT-ONLY governance decision record.** No runtime code, no package, no tools, no `ALLOWLIST`
> change, no allowlist-path activation, no KMS/vault, no keys, no signing, no execution authority. References
> existing SSOT names only; introduces no new SSOT/API/DATA/CONFIG name.
>
> This record **ratifies B3 only**, flipping its checklist status `UNDECIDED → DECIDED`. It does **NOT** touch
> B1/B2 (already `DECIDED`), B4–B7 (`UNDECIDED`), or B8 (`BLOCKED`), and it does **NOT** make E2 READY (§10).
>
> **State:** `main` @ `1ffa8fb` · 372/372 tests · `ALLOWLIST=[]`. Filled per the E2-8 template.

---

## 1. decision_id
`DR-E2-B3-001`

## 2. blocker_covered
**B3** (dual-control / `signer_control` ops) **only**. (B1/B2 unchanged `DECIDED`; B4–B7 `UNDECIDED`; B8 `BLOCKED`.)

## 3. selected_option
**Dual-control with `signer_control` + an independent approver**, ratifying the policy in
`E2-DUAL-CONTROL-SIGNER-CONTROL-POLICY.md`:
- `signer_control` is a **separate, narrower, more-sensitive grant**, not auto-derived from `admin`.
- **`admin` alone is insufficient** for signing-sensitive / custody actions.
- **requester ≠ approver** (separation of duties).
- **Two-person rule (`signer_control` + a distinct approver) required for:** custody changes
  (`register_/disable_/revoke_signer_profile`), signer revoke/disable, allowlist-activation request,
  `activate_real_live`, `trigger_kill_switch`, emergency break-glass.
- **Approvals are audit-referenced and contain no secrets** (references only; before/after; append-only).
- **No `signer_control` action bypasses Risk Gates or the OperatingStateMachine** — it can only authorize
  within those gates, never override them.

**Deferred (ops provisioning, not a status):** the **named operator roster** for `signer_control` and the exact
two-person mechanics (synchronous co-approval vs request→approve window) are operational provisioning bound to
deployment/ops setup — recorded as residual/revisit (§7/§8), not a middle status.

## 4. alternatives_considered
| Option | Disposition |
|---|---|
| admin-only approval | **rejected** — admin compromise would suffice for custody/signing; no containment (`09-THREAT §5.8`) |
| `signer_control`-only single approver | **rejected** — single-person critical action; no separation of duties |
| **dual-control: `signer_control` + independent approver** | **selected** — separation of duties + containment |
| external quorum / multisig process | **deferred/out-of-scope** — heavier governance; may be revisited for highest-impact actions, not required to ratify B3 |

## 5. approvers_required
- **Governance:** ratifies the dual-control policy (this record).
- **Security / ops:** confirms operability of two-person flow at provisioning.
- **`signer_control`:** B3 governs `signer_control` itself; ratification is signing-sensitive → `signer_control`
  participation + two-person rule applies to this decision.

## 6. evidence_references
- `reports/E2-DUAL-CONTROL-SIGNER-CONTROL-POLICY.md` (the policy being ratified).
- `reports/E2-POLICY-RATIFICATION-READINESS.md` (B3 readiness row, required evidence).
- `reports/E2-RATIFICATION-DECISION-RECORD-TEMPLATE.md` (record format).
- `reports/E2-RATIFICATION-B1-B2-VENDOR-DEPLOYMENT.md` (deployment-boundary context for where `signer_control` operates).
> All evidence documentary; **no secrets, no key material** — references/attestations only.

## 7. residual_risks
- **Operator roster not yet named** — the concrete `signer_control` holders and second-approver pool are pending
  ops provisioning; until then the rule exists but its assignees do not. Owner: governance + ops.
- **Two-person mechanics unfinalized** — sync co-approval vs request→approve window pending. Owner: ops.
- **Policy unproven at runtime** — enforcement is documentary until a Gate-E implementation PR (separately approved).

## 8. rollback_or_revisit_conditions
- Operator-compromise incident → re-open B3 (roster/mechanics review).
- Inability to staff distinct requester/approver (separation of duties) → re-open B3.
- Highest-impact actions found to need multisig/quorum → revisit (add external quorum).
- Any conflict surfaced by later B4–B7 ratification → re-open affected decision.

## 9. status_before → status_after
| Blocker | status_before | status_after |
|---|---|---|
| B3 dual-control / `signer_control` | `UNDECIDED` | **`DECIDED`** (dual-control: `signer_control` + independent approver; roster deferred to ops) |

## 10. Impact on aggregate readiness
- B3 is now **`DECIDED`**. B1/B2 remain `DECIDED`.
- **B4–B7 remain `UNDECIDED`; B8 remains `BLOCKED`.**
- **Aggregate: NOT READY — 4 `UNDECIDED` (B4–B7) + 3 `DECIDED` (B1–B3) + 1 `BLOCKED` (B8) → E2 remains NO-GO.**
- H5/allowlist activation, B8, operator-roster provisioning, and KMS integration each remain **separate
  approvals**. Marking B3 DECIDED introduces **no** runtime change, **no** allowlist activation, **no** execution authority.

---

**Confirmations:** Doc/report-only · B3 ratified (governance decision documented here) · B1/B2 `DECIDED`, B4–B7
`UNDECIDED`, B8 `BLOCKED` · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/KeyManager
introduced · No key material introduced · No execution authority introduced.
