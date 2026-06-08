# E2 — Ratification Decision Record: B4 (Key Generation/Import) & B5 (Rotation/Revocation)

> **DOC/REPORT-ONLY governance decision record.** No runtime code, no package, no tools, no `ALLOWLIST`
> change, no allowlist-path activation, no KMS/vault, no keys, no signing, no execution authority. References
> existing SSOT names only; introduces no new SSOT/API/DATA/CONFIG name.
>
> This record **ratifies B4 and B5 only**, flipping their checklist status `UNDECIDED → DECIDED`. It does
> **NOT** touch B1–B3 (already `DECIDED`), B6/B7 (`UNDECIDED`), or B8 (`BLOCKED`), and it does **NOT** make
> E2 READY (§10).
>
> **State:** `main` @ `0062e44` · 372/372 tests · `ALLOWLIST=[]`. Filled per the E2-8 template.

---

## 1. decision_id
`DR-E2-B4B5-001`

## 2. blockers_covered
**B4** (key generation/import) and **B5** (rotation/revocation) **only**. (B1–B3 `DECIDED`; B6/B7 `UNDECIDED`; B8 `BLOCKED`.)

## 3. selected_option
- **B4 — Key generation/import:**
  - **Default: generate non-exportable keys inside KMS/HSM-class custody** (per B1 `DR-E2-B1B2-001`).
  - **Key import is exception-only** — requires dual-control (`signer_control` + independent approver, B3),
    audit, and **proof of non-persistence**.
  - **No seed/mnemonic handling in application code.**
  - **No plaintext key in repo/`.env`/DB/logs/cache/fixtures** (enforced by the mechanism guard's key-material
    rules, including `allowlisted_but_key_material:*` even inside a future allowlisted path).
- **B5 — Rotation/revocation:**
  - **Rotation triggers follow the existing `rotation_trigger` enum** (`manual` · `time_based` ·
    `trade_count_based` · `risk_limit_based` · `compromise_suspected` · `wallet_retirement`); flow via
    `rotate_execution_wallet` / `wallet_rotation_status`.
  - **`revoke_signer_profile` is terminal and requires zeroize** (`signer_profile_status = REVOKED`, unusable thereafter).
  - **`disable_signer_profile` makes the signer unusable** until a **separate governed re-enable path**.
  - **KMS/custody failure → `signer_profile_status = DEGRADED` (fail-closed)** — no signing on unverified custody.

**Deferred (ops parameters, not a status):** cadence/thresholds for `time_based`/`trade_count_based`/`risk_limit_based`
rotation, and the concrete import-exception process, remain ops parameters — recorded as residual/revisit (§7/§8),
not a middle status.

## 4. alternatives_considered
| Option | Disposition |
|---|---|
| generate-in-KMS/HSM (non-exportable) | **selected (default)** — strongest non-exportability |
| import existing key | **exception-only** — dual-control + non-persistence proof; otherwise disallowed |
| app-managed key | **rejected** — plaintext in app memory/persistence; violates custody boundary |
| seed/mnemonic import | **rejected** — no seed/mnemonic in app code (`09-THREAT §2`) |
| manual rotation only | **rejected as sole model** — insufficient for compromise/time/risk triggers |
| policy/cadence-based rotation | **selected** — via existing `rotation_trigger` (cadence deferred to ops) |
| revoke vs disable | **both retained** — `revoke` terminal+zeroize; `disable` reversible via governed re-enable |

## 5. approvers_required
- **Governance:** ratifies the key-gen/import and rotation/revocation policies (this record).
- **Security / ops:** sets cadence/thresholds and import-exception process at provisioning.
- **`signer_control`:** B4/B5 are signing-sensitive (custody material) → `signer_control` + two-person rule (B3)
  apply to this ratification and to any import exception / revoke.

## 6. evidence_references
- `reports/E2-KEY-GENERATION-ROTATION-POLICY.md` (the policy being ratified).
- `reports/E2-POLICY-RATIFICATION-READINESS.md` (B4/B5 readiness rows, required evidence).
- `reports/E2-RATIFICATION-DECISION-RECORD-TEMPLATE.md` (record format).
- `reports/E2-RATIFICATION-B1-B2-VENDOR-DEPLOYMENT.md` (B1 custody class context) · `reports/E2-RATIFICATION-B3-DUAL-CONTROL.md` (B3 dual-control context).
> All evidence documentary; **no secrets, no key material** — references/attestations/proofs-of-non-persistence only.

## 7. residual_risks
- **Cadence/thresholds not yet set** — rotation cadence and trade/risk thresholds pending ops; the *triggers* are
  ratified, the *values* are not. Owner: security/ops.
- **Import-exception process undefined in detail** — the rule (exception-only + dual-control + non-persistence
  proof) is ratified; the concrete attestation procedure is pending. Owner: governance + security.
- **Re-enable path for `disable` not yet specified** — disable is ratified as unusable-until-governed-re-enable;
  the re-enable procedure is pending. Owner: governance + `signer_control`.
- **Policy unproven at runtime** — enforcement is documentary until a Gate-E implementation PR (separately approved).

## 8. rollback_or_revisit_conditions
- Chosen vendor cannot generate non-exportable keys (B1 instance) → re-open B4.
- An import exception cannot prove non-persistence → reject the exception; B4 re-affirms generate-in-custody.
- Compromise/incident → re-open B5 (rotation cadence / revoke behavior).
- Any conflict surfaced by later B6/B7 ratification → re-open affected decision.

## 9. status_before → status_after
| Blocker | status_before | status_after |
|---|---|---|
| B4 key generation/import | `UNDECIDED` | **`DECIDED`** (generate-in-custody default; import exception-only; no seed/mnemonic; no plaintext) |
| B5 rotation/revocation | `UNDECIDED` | **`DECIDED`** (triggers per `rotation_trigger`; revoke terminal+zeroize; disable→governed re-enable; DEGRADED fail-closed; cadence deferred) |

## 10. Impact on aggregate readiness
- B4 and B5 are now **`DECIDED`**. B1–B3 remain `DECIDED`.
- **B6/B7 remain `UNDECIDED`; B8 remains `BLOCKED`.**
- **Aggregate: NOT READY — 2 `UNDECIDED` (B6, B7) + 5 `DECIDED` (B1–B5) + 1 `BLOCKED` (B8) → E2 remains NO-GO.**
- H5/allowlist activation, B8, cadence/import-exception/re-enable provisioning, vendor-instance selection, and
  KMS integration each remain **separate approvals**. Marking B4/B5 DECIDED introduces **no** runtime change,
  **no** allowlist activation, **no** execution authority.

---

**Confirmations:** Doc/report-only · B4/B5 ratified (governance decision documented here) · B1–B3 `DECIDED`,
B6/B7 `UNDECIDED`, B8 `BLOCKED` · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/
KeyManager introduced · No key material introduced · No execution authority introduced.
