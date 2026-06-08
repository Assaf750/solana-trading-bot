# E2 — Custody Ops Policy / Checklist (governance artifact, doc-only)

> **DOC-ONLY.** No runtime code, no package, no `ALLOWLIST` change, no allowlist-path activation, no KMS/vault,
> no keys, no signing, no execution authority. References existing SSOT names only; introduces no new
> SSOT/API/DATA/CONFIG name. Statuses below (`DECIDED`/`UNDECIDED`/`BLOCKED`/`READY FOR IMPLEMENTATION REVIEW`)
> are **document statuses only**, not SSOT enums.
>
> **Purpose:** convert the eight open blockers from the E2 Go/No-Go review into governed decisions/checklist
> items. **E2 implementation remains NO-GO until every item is `DECIDED` and reviewed** (see §9).
>
> **State at authoring:** `main` @ `79365c2` · 372/372 tests · `ALLOWLIST=[]` · declared path
> `packages/isolated-signer-runtime/src/` exists but is **not exempt** · keyless scaffolding (E0/E1/E2-0/E2-1) merged.
> Sources: `09-THREAT-SECURITY §2–§7`, `00-ARCHITECTURE §4.3`, `06-BUILD §4/§6`, `01-SSOT` G10/G15.

---

## 1. Custody vendor decision criteria — status: `UNDECIDED`
**Options:** cloud KMS · HSM · self-hosted secret vault. Vendor is an **implementation parameter within the
`09-THREAT §4` boundary**, not an architecture change.

**Minimum required controls (any chosen vendor MUST satisfy):**
- No plaintext secret outside the isolated signer's memory; **never** on disk/`.env`/DB/cache/logs/exports/backups.
- Least-privilege access scoped to a single `signer_profile_id`; no enumerate/export of unrelated secrets.
- Revocation that prevents any later use (maps to `revoke_signer_profile`).
- Fail-closed: custody failure ⇒ `signer_profile_status = DEGRADED` (no signing on unverified custody).
- Audited, access-controlled key load; supports zeroization on revoke/shutdown/panic.
- No live key in repo/`.env`/dev; dev/test keys disposable and isolated from live.

**Disallowed choices:** any vendor/config that stores plaintext keys at rest in app-accessible storage; shared
custody across environments (dev/test/live); a path that exposes raw key material to API/UI/hot-path; "bring
key in code/config". 

**Decision owner:** _TBD._ **Decision:** _UNDECIDED._

---

## 2. Deployment boundary — status: `UNDECIDED`
- SignerService runs as an **isolated process/container**, separate from API, dashboard, and hot-path.
- **No API/UI/hot-path key access**: other services request a signature for a specific `intent_id` /
  `execution_wallet_id` / `signer_profile_id` and receive a signature or refusal — never a key.
- **Network boundaries:** signer reachable only by the execution path over a constrained internal channel;
  no inbound public exposure; no key egress.
- **No debug/core dumps in live**; no verbose memory logging for signer/execution (`09-THREAT §4/§5.10`).

**Decision owner:** _TBD._ **Decision:** _UNDECIDED._

---

## 3. Dual-control / `signer_control` ops — status: `UNDECIDED`
- **Who approves custody changes:** holders of `permission_role = signer_control` (separate from `admin`).
- **Two-person rule for critical actions:** custody register/disable/revoke, `activate_real_live`,
  `trigger_kill_switch`, allowlist activation — **require `signer_control` + a second approver** (proposed; to be ratified).
- **Relation to commands:** `activate_real_live` checks `real_live_config_valid` + `09-THREAT §7` checklist;
  `trigger_kill_switch` and `revoke_signer_profile` require `signer_control`. Admin alone is insufficient for
  any signing-sensitive/custody action.

**Decision owner:** _TBD._ **Decision:** _UNDECIDED (two-person rule proposed, not ratified)._

---

## 4. Key generation / import policy — status: `UNDECIDED`
- **Generate inside KMS/HSM preferred** (key never leaves custody in plaintext).
- **Import only if documented and audited** (justified, approved, logged) — otherwise disallowed.
- **No plaintext key in app memory** except inside the **isolated signer runtime during signing**, then zeroized.
- **No key in repo / `.env` / DB / logs / cache / fixtures** (enforced today by the mechanism guard's
  key-material rules, including `allowlisted_but_key_material:*` even inside a future allowlisted path).

**Decision owner:** _TBD._ **Decision:** _UNDECIDED._

---

## 5. Rotation / revocation policy — status: `UNDECIDED`
- **Rotation triggers** (existing `rotation_trigger` values): `manual` · `time_based` · `trade_count_based` ·
  `risk_limit_based` · `compromise_suspected` · `wallet_retirement`. Cadence/thresholds: _TBD._
- **Revoke behavior:** `revoke_signer_profile` ⇒ `signer_profile_status = REVOKED` + **simulated→real zeroize**
  of custody material; revoked profile is unusable and inaccessible thereafter.
- **Zeroize requirement:** custody material cleared on revoke/shutdown/panic (modeled keyless in `keyless-custody-lifecycle`).
- **Mapping to existing names:** `revoke_signer_profile`, `disable_signer_profile`, `rotate_execution_wallet`,
  `wallet_rotation_status` (`NOT_REQUIRED`/`PENDING`/`IN_PROGRESS`/`COMPLETED`/`FAILED`) — no new names.

**Decision owner:** _TBD._ **Decision:** _UNDECIDED (cadence/thresholds undecided)._

---

## 6. Emergency break-glass — status: `UNDECIDED`
- **Allowed:** a controlled, audited recovery to halt/secure (e.g. `trigger_kill_switch`, drain/revoke) that
  **never exposes plaintext** and **never bypasses** Risk Gates or the OperatingStateMachine.
- **Forbidden:** any path that extracts/exports key material, signs without Risk approval, or skips audit.
- **Audit requirements:** every break-glass action recorded append-only (actor/scope/reason); no secret content.
- **Invariant:** break-glass **never bypasses Risk/OperatingStateMachine**; it can only move toward safer states
  (EXITS_ONLY/KILLED/revoke), not enable execution.

**Decision owner:** _TBD._ **Decision:** _UNDECIDED._

---

## 7. Audit retention — status: `UNDECIDED`
- **Must retain:** every signing attempt (before/after), custody lifecycle events, revoke/disable/rotation,
  `activate_real_live`/`trigger_kill_switch`, allowlist-activation decisions — actor, scope, reason, outcome.
- **No secrets in audit:** no keys/seed/raw payloads; references only (`signer_profile_id`, `intent_id` in reason).
- **Append-only requirement:** audit is append-only (no update/delete), consistent with the in-memory
  `createAuditLog` model and the DB-enforced `audit_log` table.
- **Retention duration:** _placeholder — TBD_ (financial/audit events not purged by maintenance).

**Decision owner:** _TBD._ **Decision:** _UNDECIDED (duration placeholder)._

---

## 8. E2 readiness checklist (blockers → checklist items)
| # | Item | Status |
|---|---|---|
| B1 | Custody vendor (KMS/HSM/vault) chosen + minimum controls ratified (§1) — options compared in `E2-CUSTODY-VENDOR-DEPLOYMENT-OPTIONS.md` (preference recorded, vendor **not** ratified) | **UNDECIDED** |
| B2 | Deployment boundary defined (isolated process; no API/UI/hot-path key access; no dumps) (§2) — options compared in `E2-CUSTODY-VENDOR-DEPLOYMENT-OPTIONS.md` (separate container preferred, tier **not** ratified) | **UNDECIDED** |
| B3 | Dual-control / `signer_control` ops + two-person rule ratified (§3) — policy proposed in `E2-DUAL-CONTROL-SIGNER-CONTROL-POLICY.md` (proposed, **not** ratified) | **UNDECIDED** |
| B4 | Key generation/import policy decided (§4) — policy proposed in `E2-KEY-GENERATION-ROTATION-POLICY.md` (proposed, **not** ratified) | **UNDECIDED** |
| B5 | Rotation/revocation policy + cadence decided (§5) — policy proposed in `E2-KEY-GENERATION-ROTATION-POLICY.md` (triggers mapped; cadence **not** ratified) | **UNDECIDED** |
| B6 | Emergency break-glass procedure defined (§6) — procedure proposed in `E2-BREAKGLASS-AUDIT-RETENTION-POLICY.md` (proposed, **not** ratified) | **UNDECIDED** |
| B7 | Audit retention decided (§7) — policy proposed in `E2-BREAKGLASS-AUDIT-RETENTION-POLICY.md` (append-only/no-secrets affirmed; duration **not** ratified) | **UNDECIDED** |
| B8 | Allowlist activation of the declared path approved (separate governance decision) | **BLOCKED** (not approved) |
| R | E0 readiness `ready=true` + E1 contract green + Risk/OperatingState/admission/signer all `ACTIVE` + audit path active, on testnet/devnet first | **READY FOR IMPLEMENTATION REVIEW** (mechanism present; gated on B1–B8) |

**Aggregate readiness:** **NOT READY** — 7 `UNDECIDED` + 1 `BLOCKED`.

---

## 9. Explicit NO-GO statement
- **E2 implementation (real KMS/custody/signing) remains NO-GO** until **every** checklist item B1–B7 is
  `DECIDED` and reviewed, and B8 (allowlist activation) is separately approved.
- **H5 / allowlist activation remains a separate approval** — declaring the path (H4) and creating the skeleton
  (E2-1) do **not** authorize activation; `ALLOWLIST` stays `[]`.
- **KMS/Vault integration remains a separate approval** — even after B1–B8, real custody/signing requires its own
  PR with positive isolation tests, fail-closed `DEGRADED`, zeroization, least-privilege, and `09-THREAT §7`
  readiness with zero `§7.8` blockers.
- **Fail-safe stance:** until then, the system stays fully keyless/simulated; the mechanism guard remains
  fail-closed (`ALLOWLIST=[]`), and no live signing/sending/transfer is possible.

---

**Confirmations:** Doc-only · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/KeyManager
introduced · No key material introduced · No execution authority introduced.
