# E2 — Ratification Decision Record: B1 (Custody Vendor) & B2 (Deployment Boundary)

> **DOC/REPORT-ONLY governance decision record.** No runtime code, no package, no tools, no `ALLOWLIST`
> change, no allowlist-path activation, no KMS/vault, no keys, no signing, no execution authority. References
> existing SSOT names only; introduces no new SSOT/API/DATA/CONFIG name.
>
> This record **ratifies B1 and B2 only** (governance decision documented herein), flipping their checklist
> status `UNDECIDED → DECIDED` at the **class/boundary level**. It does **NOT** touch B3–B7 (`UNDECIDED`) or
> B8 (`BLOCKED`), and it does **NOT** make E2 READY — see §10.
>
> **State:** `main` @ `ed7ca3c` · 372/372 tests · `ALLOWLIST=[]`. Filled per the E2-8 template.

---

## 1. decision_id
`DR-E2-B1B2-001`

## 2. blockers_covered
**B1** (custody vendor) and **B2** (deployment boundary) **only**. (B3–B7 unchanged; B8 out of scope.)

## 3. selected_option
- **B1 — Custody vendor class:** **KMS/HSM class, vendor-neutral.** The custody source for `isolated_signer`
  is a KMS or HSM; the **specific vendor instance remains an ops parameter requiring a later deployment
  approval** (not named here). Minimum controls (per `E2-CUSTODY-OPS-POLICY §1`) are ratified as mandatory for
  whichever instance is later chosen: no plaintext outside isolated signer memory; least-privilege per
  `signer_profile_id`; revocation; fail-closed → `signer_profile_status = DEGRADED`; no key in repo/`.env`/DB/
  logs/cache/fixtures.
- **B2 — Deployment boundary:** **isolated signer runtime in a separate container/process boundary**, with
  **no API/UI/hot-path key access**, **no core/debug dumps in live**, and **no plaintext persistence**. The
  concrete isolation tier (container vs isolated VM) and topology evidence are bound to the later deployment
  approval; the **boundary rule itself is ratified now**.

## 4. alternatives_considered
| Option | Class | Disposition |
|---|---|---|
| cloud KMS | custody | **selected (within KMS/HSM class)** — vendor instance deferred |
| HSM | custody | **selected (within KMS/HSM class)** — strongest non-exportability; instance deferred |
| self-hosted vault | custody | **not selected for primary** — higher ops attack surface; config-dependent non-exportability (E2-3 matrix) |
| connected_wallet / manual | custody | **rejected for automated/REAL-LIVE** — not `isolated_signer`; manual-only (`09-THREAT §2/§6`) |
| mock / no-key | custody | current keyless mode; not a live custody choice |
| same-host process | deployment | **not selected as target** — weakest isolation (shared kernel) |
| separate container | deployment | **selected (baseline)** — clear process/network boundary |
| isolated VM | deployment | **acceptable stronger tier** — tier choice deferred to deployment approval |

## 5. approvers_required
- **Governance:** ratifies the class/boundary decision (this record).
- **Security / ops:** confirms minimum controls (B1) and boundary topology (B2) at deployment.
- **`signer_control`:** required for B1 (custody class is signing-sensitive) and for the later vendor-instance
  approval; two-person rule applies to the instance selection (per `E2-DUAL-CONTROL §2`).

## 6. evidence_references
- `reports/E2-CUSTODY-VENDOR-DEPLOYMENT-OPTIONS.md` (B1/B2 options + criteria matrix).
- `reports/E2-POLICY-RATIFICATION-READINESS.md` (B1/B2 readiness rows, required evidence).
- `reports/E2-RATIFICATION-DECISION-RECORD-TEMPLATE.md` (record format).
- `reports/E2-CUSTODY-OPS-POLICY.md` §1/§2 (minimum controls / boundary rules).
> All evidence is documentary; **no secrets, no key material** — references/attestations only.

## 7. residual_risks
- **Vendor instance not yet named** — the concrete KMS/HSM and its non-exportability attestation are pending
  deployment approval; until then no instance-specific assurance exists. Owner: security/ops.
- **Isolation tier (container vs VM) not finalized** — boundary rule ratified, tier pending. Owner: ops.
- **Class decision relies on documentary criteria** — no runtime custody exists yet (keyless), so behavior is
  unproven until a Gate-E implementation PR (separately approved).

## 8. rollback_or_revisit_conditions
- Vendor instance fails minimum-controls attestation at deployment → B1 re-opens.
- Chosen deployment cannot guarantee no-API/UI/hot-path key access or no-dumps → B2 re-opens.
- Compromise/incident affecting custody assumptions → re-open B1/B2.
- Any conflict surfaced by later B3–B7 ratification → re-open affected decision.

## 9. status_before → status_after
| Blocker | status_before | status_after |
|---|---|---|
| B1 custody vendor (class) | `UNDECIDED` | **`DECIDED`** (KMS/HSM class, vendor-neutral; instance deferred) |
| B2 deployment boundary | `UNDECIDED` | **`DECIDED`** (isolated separate container/process; tier deferred) |

## 10. Impact on aggregate readiness
- B1 and B2 are now **`DECIDED`** (class/boundary level).
- **B3–B7 remain `UNDECIDED`; B8 remains `BLOCKED`.**
- **Aggregate: NOT READY — 5 `UNDECIDED` + 1 `BLOCKED` → E2 implementation remains NO-GO.**
- H5/allowlist activation, B8, vendor-instance selection, and KMS integration each remain **separate
  approvals**. Marking B1/B2 DECIDED introduces **no** runtime change, **no** allowlist activation, and **no**
  execution authority.

---

**Confirmations:** Doc/report-only · B1/B2 ratified at class/boundary level (governance decision documented here)
· B3–B7 `UNDECIDED`, B8 `BLOCKED` · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/
KeyManager introduced · No key material introduced · No execution authority introduced.
