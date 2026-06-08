# E2 — Ratification Decision Record: B6 (Emergency Break-glass) & B7 (Audit Retention)

> **DOC/REPORT-ONLY governance decision record.** No runtime code, no package, no tools, no `ALLOWLIST`
> change, no allowlist-path activation, no KMS/vault, no keys, no signing, no execution authority. References
> existing SSOT names only; introduces no new SSOT/API/DATA/CONFIG name.
>
> This record **ratifies B6 and B7 only**, flipping their checklist status `UNDECIDED → DECIDED`. It does
> **NOT** touch B1–B5 (already `DECIDED`) or B8 (`BLOCKED`), and it does **NOT** make E2 READY (§10).
>
> **State:** `main` @ `d1d7412` · 372/372 tests · `ALLOWLIST=[]`. Filled per the E2-8 template.

---

## 1. decision_id
`DR-E2-B6B7-001`

## 2. blockers_covered
**B6** (emergency break-glass) and **B7** (audit retention) **only**. (B1–B5 unchanged `DECIDED`; B8 unchanged `BLOCKED`.)

## 3. selected_option
- **B6 — Emergency break-glass:**
  - **Incident-only** — invoked solely in a genuine incident (suspected key/operator compromise, custody
    failure, runaway behavior, chain/provider critical breach) where normal flows are insufficient and **a safer
    state is the goal**.
  - **Dual-control: `signer_control` + an independent approver (two-person rule)**; requester ≠ approver.
    **`admin` alone is insufficient** (per B3 `DR-E2-B3-001`, `09-THREAT §5.8`).
  - **Allowed emergency actions move only toward safer states:** `trigger_kill_switch`, `revoke_signer`,
    `revoke_signer_profile`, `disable_signer_profile`, and the operating-state moves `EXITS_ONLY` · `PAUSED` ·
    `KILLED` (via the OperatingStateMachine).
  - **Break-glass cannot bypass Risk Gates or the OperatingStateMachine** — it can only authorize within those
    gates and only move toward safer states; it can never force `ACTIVE`/entry.
  - **Break-glass cannot expose/export keys or plaintext** under any incident.
  - **Break-glass cannot activate REAL-LIVE** (`activate_real_live` is never a break-glass action).
  - **Emergency exit, if ever needed, stays within the existing Risk / OperatingStateMachine / ownership /
    exit-feasibility paths** (`00-ARCH §10/§14`) and introduces **no new execution authority**.
- **B7 — Audit retention:**
  - **All custody/signing/security-sensitive events are retained** — break-glass requests+approvals,
    `trigger_kill_switch`, `revoke_signer`/`revoke_/disable_signer_profile`, custody-status and
    `signer_profile_status` changes, `operating_state` transitions, rotation/revocation, `activate_real_live`
    attempts, and allowlist-activation decisions.
  - **Audit is append-only** (consistent with the in-memory `createAuditLog` model and the DB-enforced
    append-only `audit_log`).
  - **Audit contains references only — no secrets, no key material, no raw payloads.**
  - **Before/after audit entries are required for sensitive attempts** (signing-sensitive + break-glass actions),
    using existing `AUDIT_COLUMNS` only.
  - **Purge/archive must preserve financial/security audit integrity** — maintenance/purge tooling never deletes
    financial/security audit (`candidate_cmd_purge_data` excludes financial audit, `06-BUILD`/SSOT G27).

**Deferred (ops/compliance parameters, not a status):** break-glass **quorum/threshold** and whether a third
reviewer is required for kill-switch vs revoke; audit **retention duration** and cold-storage/archival approach
(no secrets); the **post-incident review process/owner and evidence-package SLA**. These are operational/
compliance parameters — recorded as residual/revisit (§7/§8), **not** a middle status.

## 4. alternatives_considered
| Option | Disposition |
|---|---|
| no break-glass (no emergency path) | **rejected** — leaves no governed response to compromise/custody failure |
| admin-only break-glass | **rejected** — admin compromise would suffice; no separation of duties (`09-THREAT §5.8`) |
| `signer_control`-only single approver | **rejected** — single-person critical action; no two-person containment |
| **dual-control break-glass (`signer_control` + independent approver)** | **selected** — separation of duties + containment |
| unrestricted emergency powers | **rejected** — would bypass Risk Gates/OperatingStateMachine; could expose keys / force execution |
| **limited safer-state-only emergency powers** | **selected** — only `KILLED`/`PAUSED`/`EXITS_ONLY`/revoke/disable; never enables execution |
| short audit retention | **rejected as sole model** — insufficient forensics for security/financial incidents |
| long/regulated audit retention | **selected at policy level** — concrete duration deferred to compliance/ops |
| **append-only retention** | **selected** — tamper-evident; references-only, no secrets |

## 5. approvers_required
- **Governance:** ratifies the break-glass and audit-retention policies (this record).
- **Security / ops:** sets break-glass quorum/threshold and post-incident review process at provisioning.
- **`signer_control`:** B6 is signing-sensitive (custody/emergency authority) → `signer_control` + two-person
  rule (B3) apply to this ratification and to any break-glass invocation.
- **Compliance / audit owner:** ratifies B7 retention duration and archival approach (no secrets).

## 6. evidence_references
- `reports/E2-BREAKGLASS-AUDIT-RETENTION-POLICY.md` (the B6/B7 policy being ratified).
- `reports/E2-POLICY-RATIFICATION-READINESS.md` (B6/B7 readiness rows, required evidence).
- `reports/E2-RATIFICATION-DECISION-RECORD-TEMPLATE.md` (record format).
- `reports/E2-RATIFICATION-B1-B2-VENDOR-DEPLOYMENT.md` (`DR-E2-B1B2-001`) · `reports/E2-RATIFICATION-B3-DUAL-CONTROL.md`
  (`DR-E2-B3-001`, dual-control inherited by break-glass) · `reports/E2-RATIFICATION-B4-B5-KEY-ROTATION.md`
  (`DR-E2-B4B5-001`, revoke/disable behavior reused by break-glass).
> All evidence documentary; **no secrets, no key material** — references/attestations only.

## 7. residual_risks
- **Break-glass quorum/threshold not yet set** — the dual-control rule is ratified; the numeric quorum and any
  third-reviewer requirement (kill-switch vs revoke) are pending. Owner: governance + `signer_control`.
- **Audit retention duration not yet set** — append-only / no-secrets / financial-audit-preservation are
  ratified; the concrete duration and archival approach are pending. Owner: compliance + ops.
- **Post-incident review process undefined in detail** — review owner and evidence-package SLA pending. Owner:
  security/ops.
- **Policy unproven at runtime** — enforcement is documentary until a Gate-E implementation PR (separately approved).

## 8. rollback_or_revisit_conditions
- Operator/key-compromise incident → re-open B6 (quorum/threshold and review process).
- Inability to staff distinct requester/approver for break-glass (separation of duties) → re-open B6.
- New regulatory/compliance requirement on retention → re-open B7 (duration/archival).
- A purge/archive path found able to drop financial/security audit → re-open B7 immediately.
- Any conflict surfaced by B8 (allowlist activation) governance → re-open affected decision.

## 9. status_before → status_after
| Blocker | status_before | status_after |
|---|---|---|
| B6 emergency break-glass | `UNDECIDED` | **`DECIDED`** (incident-only; dual-control `signer_control`+independent approver; admin insufficient; safer-state-only actions; no key exposure / no Risk-Gate / no OperatingStateMachine bypass / no REAL-LIVE; quorum deferred) |
| B7 audit retention | `UNDECIDED` | **`DECIDED`** (all sensitive events retained; append-only; references-only/no-secrets; before/after for sensitive attempts; purge preserves financial/security audit; duration deferred) |

## 10. Impact on aggregate readiness
- B6 and B7 are now **`DECIDED`**. B1–B5 remain `DECIDED`.
- **With B6/B7 DECIDED, B1–B7 are all `DECIDED`; B8 remains `BLOCKED`.**
- **Aggregate: NOT READY — 7 `DECIDED` (B1–B7) + 1 `BLOCKED` (B8) → E2 remains NO-GO.**
- **E2 implementation remains NO-GO because B8 / allowlist activation is not approved** (`ALLOWLIST=[]`).
  H5/allowlist activation, B8, break-glass quorum / audit-duration / review-process provisioning, vendor-instance
  selection, and KMS integration each remain **separate approvals**. Marking B6/B7 DECIDED introduces **no**
  runtime change, **no** allowlist activation, and **no** execution authority.

---

**Confirmations:** Doc/report-only · B6/B7 ratified (governance decision documented here) · B1–B5 `DECIDED`,
B8 `BLOCKED` · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/KeyManager introduced ·
No key material introduced · No execution authority introduced.
