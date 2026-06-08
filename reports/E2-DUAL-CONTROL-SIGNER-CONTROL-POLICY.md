# E2 — Dual-Control / `signer_control` Ops Policy (governance artifact, doc-only)

> **DOC/REPORT-ONLY.** No runtime code, no package, no tools, no `ALLOWLIST` change, no allowlist-path
> activation, no KMS/vault, no keys, no signing, no execution authority. References existing SSOT names only;
> introduces no new SSOT/API/DATA/CONFIG name. Statuses are document statuses only, not SSOT enums.
> This policy is **proposed, not ratified** — blocker **B3** stays `UNDECIDED` (`E2-CUSTODY-OPS-POLICY §8`).
>
> **Companion to:** `reports/E2-CUSTODY-OPS-POLICY.md` (B3), `reports/E2-CUSTODY-VENDOR-DEPLOYMENT-OPTIONS.md`.
> **State:** `main` @ `5702b88` · 372/372 tests · `ALLOWLIST=[]`. Sources: `09-THREAT-SECURITY §3/§5.8/§7`,
> `00-ARCHITECTURE §4.3/§10`, `01-SSOT` G11 (`permission_role`, command_type), G14 (audit), G15.

---

## 1. `signer_control` operational meaning
- **Who holds it:** a small, named set of operators granted `permission_role = signer_control` — the only role
  authorized for signing-sensitive / custody actions. Distinct grant, **not** auto-derived from `admin`.
- **`admin` vs `signer_control`:** `admin` manages config/wallets/operations; `signer_control` governs signer
  custody and the most dangerous controls. `signer_control` is **not a higher rank than admin** — it is a
  **separate, narrower, more sensitive** grant (SSOT G11; `09-THREAT §5.8`).
- **Why `admin` alone is insufficient:** if an `admin` credential is compromised, it must **not** be able to
  sign, extract keys, revoke/enable signers, activate REAL-LIVE, or trip the kill switch. Separating
  `signer_control` from `admin` is a containment boundary at operator compromise (`09-THREAT §5.8`), not cosmetic.

## 2. Dual-control rules (two-person approval)
The following require **`signer_control` + a second distinct approver** (proposed):
| Action | SSOT command / state | Why two-person |
|---|---|---|
| Custody change (register/disable/revoke signer) | `register_signer_profile` · `disable_signer_profile` · `revoke_signer_profile` | controls signing material |
| Signer profile revoke/disable | `revoke_signer_profile` · `disable_signer_profile` | irreversible/limiting |
| Allowlist activation request | (governance; mechanism-guard `ALLOWLIST`) | opens live-mechanism path |
| REAL-LIVE activation | `activate_real_live` (checks `real_live_config_valid`) | enables live execution |
| Kill switch | `trigger_kill_switch` · `revoke_signer` | systemic safety control |
| Emergency break-glass | (see §6) | last-resort, high-impact |

> Single-person execution of any of the above is **forbidden** (§5).

## 3. Approval flow (separation of duties)
- **Requester:** proposes the action (records intent/reason). Cannot self-approve.
- **Approver:** a `signer_control` holder, **distinct** from the requester, who authorizes.
- **Reviewer:** (where required) a second authority confirming policy/readiness before execution.
- **`audit_actor`:** every step records the acting identity (`audit_actor` is more precise than `permission_role`).
- **Separation-of-duties:** requester ≠ approver; no single identity holds all roles for a critical action;
  approval reference is bound to the specific command/`intent_id`/`idempotency_key`.

## 4. Required audit fields / content (`09-THREAT §3`, SSOT G14)
- **No secrets:** never any key/seed/raw payload in audit — references only.
- **`audit_reason`:** why the action was taken.
- **Actor identity:** `audit_actor` (+ `permission_role`).
- **Approval reference:** ties requester→approver(→reviewer) to the action (carried in `audit_reason`/`request_id`;
  no new field introduced).
- **Command reference:** `command_type` (+ `idempotency_key`/`request_id`).
- **Retention reference:** per `E2-CUSTODY-OPS-POLICY §7` (append-only; financial/audit events not purged).
- **Append-only:** before/after entries for signing-sensitive actions; no silent path (`09-THREAT §3`).

## 5. Forbidden flows
- **Single-person REAL-LIVE activation** — `activate_real_live` without two-person approval.
- **Admin-only signer custody change** — any custody/signer change authorized by `admin` without `signer_control`.
- **`signer_control` bypassing Risk Gates** — signing/execution authorized without a fresh Risk approval
  (SignerService verifies Risk approval; it does not re-decide or bypass it, `09-THREAT §3`).
- **Any approval that includes key material** — approvals carry references, never keys/seeds.
- **Any approval outside append-only audit** — no off-audit/silent approval or execution path.

## 6. Incident / emergency rules
- **Kill switch (`trigger_kill_switch`):** `signer_control` + audit; moves toward safety (`operating_state = KILLED`),
  human-only resume. Halts new execution; emergency exit allowed only if safer than holding.
- **Revoke signer (`revoke_signer` / `revoke_signer_profile`):** `signer_control` + audit; prevents later use; zeroize.
- **Pause / EXITS_ONLY / KILLED:** `pause_system`/`resume_system` and automatic `EXITS_ONLY`/`KILLED` per the
  OperatingStateMachine remain in force; incident handling **never bypasses** them.
- **Break-glass constraints:** controlled, audited, never exposes plaintext, never signs without Risk, never
  bypasses Risk Gates or the OperatingStateMachine; can only move toward safer states, not enable execution.

## 7. Checklist impact
- **B3 (dual-control / `signer_control` ops + two-person rule):** `UNDECIDED` → remains `UNDECIDED` (policy
  **proposed** here, not ratified; operator roster + two-person rule require sign-off).
- **B1/B2/B4–B7:** unchanged `UNDECIDED`. **B8:** unchanged `BLOCKED`.
- **Aggregate:** **NOT READY / NO-GO** — this report proposes a policy but ratifies nothing.

## 8. Open Questions remaining
1. Named operator roster for `signer_control` (who, how many, rotation of operators).
2. Two-person rule mechanics: synchronous co-approval vs request→approve windows; quorum for break-glass.
3. Reviewer role: required for which actions (REAL-LIVE/allowlist-activation) vs approver-only.
4. Approval-reference representation in audit (reason/request_id encoding) — confirm no new SSOT field needed.
5. Break-glass authorization threshold and post-incident review process.
6. Interaction with `activate_real_live` readiness (E0) + `real_live_config_valid` at approval time.

---

**Confirmations:** Doc/report-only · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/KeyManager
introduced · No key material introduced · No execution authority introduced.
