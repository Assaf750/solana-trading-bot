# E2 — Ratification Decision Record TEMPLATE (governance artifact, doc-only)

> **DOC/REPORT-ONLY TEMPLATE.** No runtime code, no package, no tools, no `ALLOWLIST` change, no allowlist-path
> activation, no KMS/vault, no keys, no signing, no execution authority. References existing SSOT names only;
> introduces no new SSOT/API/DATA/CONFIG name. Statuses are document statuses only, not SSOT enums.
> **This template changes NO checklist status:** B1–B7 stay `UNDECIDED`, B8 stays `BLOCKED`. Filling this
> template here does **not** ratify anything — a status change happens **only** in a later, separately-approved
> ratification PR (see §5).
>
> **Companion to:** `reports/E2-CUSTODY-OPS-POLICY.md` (checklist), `E2-POLICY-RATIFICATION-READINESS.md`
> (readiness matrix), and the B1–B7 policy reports.
> **State:** `main` @ `7832c8e` · 372/372 tests · `ALLOWLIST=[]`. Sources: `09-THREAT-SECURITY §3–§7`,
> `00-ARCHITECTURE §4.3/§10`, `06-BUILD §4/§6`, `01-SSOT` G11/G14/G15.

---

## 1. Decision record fields (fill one record per blocker)
> Copy the block below into a future ratification PR. **`blocker_id` MUST be one of B1–B7 only** (B8 is out of
> scope for this template — see §4). `status_after` is a *placeholder*; it is only applied by the ratification PR.

```
decision_id:            <DR-E2-Bn-NNN>           # stable id for the decision record
blocker_id:             <B1 | B2 | B3 | B4 | B5 | B6 | B7>   # B8 NOT allowed here
title:                  <one line>
selected_option:        <the chosen option>
alternatives_considered:<options weighed + why rejected>
required_approvers:     <governance roles required (see §2)>
signer_control_approval:<yes/no + which signer_control holder(s)>   # required for B1/B3/B4/B6
two_person_rule:        <yes/no + the two distinct approvers>       # required for signing-sensitive blockers
evidence_refs:          <links/refs to required evidence (see §3); NO secrets, NO keys>
residual_risks:         <risks accepted, with owner>
rollback_or_revisit:    <condition that re-opens this decision (e.g. vendor change, incident)>
status_before:          UNDECIDED
status_after:           <DECIDED — APPLIED ONLY IN A LATER RATIFICATION PR; leave as proposal here>
audit_reference:        <audit_actor + reason ref; append-only; no secrets>
```

## 2. Approval rules
| Blocker | Approves | `signer_control`? | Two-person rule? | Admin alone CANNOT |
|---|---|---|---|---|
| B1 vendor | governance + `signer_control` | **required** | **required** | choose/ratify custody vendor |
| B2 deployment | governance + ops | recommended | recommended | define key-access boundary |
| B3 dual-control | governance + `signer_control` | **required** | **required** | set operator roster / SoD |
| B4 key gen/import | governance + `signer_control` | **required** | **required** | authorize key gen/import |
| B5 rotation/revocation | governance + ops | recommended | recommended | set rotation/revoke policy |
| B6 break-glass | governance + `signer_control` | **required** | **required** | define break-glass authority |
| B7 audit retention | governance + compliance | not required | not required | set retention (no secrets) |

- **`signer_control` vs `admin`:** `signer_control` is a separate, narrower, more-sensitive grant. **`admin`
  alone can never** ratify B1/B3/B4/B6, approve signing/custody, or stand in for `signer_control`.
- **Two-person rule** applies to all signing-sensitive ratifications (B1/B3/B4/B6): requester ≠ approver.

## 3. Evidence requirements (per blocker, before ratification)
- **B1 (vendor):** vendor minimum-controls attestation; non-exportability proof; least-privilege scope; revoke support.
- **B2 (deployment):** topology showing isolated process/container; no API/UI/hot-path key access; no-dumps config.
- **B3 (dual-control):** named operator roster; separation-of-duties matrix; two-person mechanics.
- **B4 (key gen/import):** generate-in-custody proof; for any import, the documented exception + non-persistence proof.
- **B5 (rotation/revocation):** cadence/thresholds; revoke→zeroize evidence; `DEGRADED`-on-failure behavior.
- **B6 (break-glass):** quorum/threshold; post-incident review SLA; proof break-glass cannot bypass Risk/OperatingStateMachine.
- **B7 (audit retention):** retention duration; archival approach (no secrets); append-only guarantee.
> **All evidence must contain NO secrets and NO key material** — references/attestations only.

## 4. Prohibited uses
This template **must not** be used to:
- activate **H5** or move the declared path into `ALLOWLIST`;
- change **B8** (allowlist activation) — B8 stays `BLOCKED` and is a separate governance decision;
- mark **E2 implementation** READY/GO;
- introduce **KMS/Vault/KeyManager/keys/crypto/signing** of any kind;
- flip any status in this PR (status changes happen only in a later ratification PR, §5).

## 5. Ratification flow
1. **Draft:** author a decision record (fill §1) for a B1–B7 blocker — *no status change*.
2. **Review:** governance + required approvers (§2) review against evidence (§3).
3. **Approval:** approvers sign off; two-person rule applied where required.
4. **Merge (ratification PR):** a **separate, explicitly-approved PR** edits the checklist status
   `UNDECIDED → DECIDED` for that blocker, citing the decision record. **This template PR does none of that.**

## 6. Checklist impact
- **B1–B7:** remain `UNDECIDED` (template adds a form, ratifies nothing).
- **B8:** remains `BLOCKED`.
- **Aggregate:** **NOT READY / NO-GO** — unchanged.

## 7. Open Questions remaining
1. Where ratified decision records are stored (a `decisions/` log vs editing the checklist) and naming (`DR-E2-Bn-NNN`).
2. Whether one ratification PR may cover multiple blockers or must be per-blocker.
3. Quorum definition for "governance" and for break-glass-class approvals.
4. Acceptable evidence artifact formats (attestation vs test output) without exposing material.
5. Whether a testnet/devnet custody dry-run (no live mainnet) is required evidence for B1/B2.

---

**Confirmations:** Doc/report-only · Template only — ratifies nothing · No status changed (B1–B7 `UNDECIDED`,
B8 `BLOCKED`) · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/KeyManager introduced ·
No key material introduced · No execution authority introduced.
