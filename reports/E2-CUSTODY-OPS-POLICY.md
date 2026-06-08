# E2 — Custody Ops Policy / Checklist (governance artifact, doc-only)

> **DOC-ONLY.** No runtime code, no package, no `ALLOWLIST` change, no allowlist-path activation, no KMS/vault,
> no keys, no signing, no execution authority. References existing SSOT names only; introduces no new
> SSOT/API/DATA/CONFIG name. Statuses below (`DECIDED`/`UNDECIDED`/`BLOCKED`/`READY FOR IMPLEMENTATION REVIEW`)
> are **document statuses only**, not SSOT enums.
>
> **Purpose:** convert the eight open blockers from the E2 Go/No-Go review into governed decisions/checklist
> items. **All eight (B1–B8) are now `DECIDED`** (B8 activated the guard path, `DR-E2-B8-001`); aggregate is
> **READY FOR E2 IMPLEMENTATION REVIEW**. **E2 implementation itself has NOT started — it remains a separate,
> explicitly-approved PR** (see §9).
>
> **State at authoring:** `main` @ `79365c2` · 372/372 tests · `ALLOWLIST=[]` · declared path
> `packages/isolated-signer-runtime/src/` exists but is **not exempt** · keyless scaffolding (E0/E1/E2-0/E2-1) merged.
> Sources: `09-THREAT-SECURITY §2–§7`, `00-ARCHITECTURE §4.3`, `06-BUILD §4/§6`, `01-SSOT` G10/G15.

---

## 1. Custody vendor decision criteria — status: `DECIDED` (class level; ratified in `E2-RATIFICATION-B1-B2-VENDOR-DEPLOYMENT.md` — KMS/HSM class, vendor-neutral; specific instance deferred to deployment approval)
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

**Decision owner:** governance + `signer_control`. **Decision:** _DECIDED — KMS/HSM class, vendor-neutral; specific instance deferred to deployment approval (`DR-E2-B1B2-001`)._

---

## 2. Deployment boundary — status: `DECIDED` (boundary level; ratified in `E2-RATIFICATION-B1-B2-VENDOR-DEPLOYMENT.md` — isolated signer runtime in a separate container/process; tier (container vs VM) deferred to deployment approval)
- SignerService runs as an **isolated process/container**, separate from API, dashboard, and hot-path.
- **No API/UI/hot-path key access**: other services request a signature for a specific `intent_id` /
  `execution_wallet_id` / `signer_profile_id` and receive a signature or refusal — never a key.
- **Network boundaries:** signer reachable only by the execution path over a constrained internal channel;
  no inbound public exposure; no key egress.
- **No debug/core dumps in live**; no verbose memory logging for signer/execution (`09-THREAT §4/§5.10`).

**Decision owner:** governance + ops. **Decision:** _DECIDED — isolated signer runtime in a separate container/process boundary; tier (container vs VM) deferred to deployment approval (`DR-E2-B1B2-001`)._

---

## 3. Dual-control / `signer_control` ops — status: `DECIDED` (ratified in `E2-RATIFICATION-B3-DUAL-CONTROL.md` — `signer_control` separate from admin; requester ≠ approver; two-person rule for sensitive actions; operator roster deferred to ops provisioning)
- **Who approves custody changes:** holders of `permission_role = signer_control` (separate from `admin`).
- **Two-person rule for critical actions:** custody register/disable/revoke, `activate_real_live`,
  `trigger_kill_switch`, allowlist activation — **require `signer_control` + a second approver** (proposed; to be ratified).
- **Relation to commands:** `activate_real_live` checks `real_live_config_valid` + `09-THREAT §7` checklist;
  `trigger_kill_switch` and `revoke_signer_profile` require `signer_control`. Admin alone is insufficient for
  any signing-sensitive/custody action.

**Decision owner:** governance + `signer_control`. **Decision:** _DECIDED — dual-control: `signer_control` (separate from admin) + independent approver; requester ≠ approver; two-person rule for sensitive actions; operator roster deferred to ops provisioning (`DR-E2-B3-001`)._

---

## 4. Key generation / import policy — status: `DECIDED` (ratified in `E2-RATIFICATION-B4-B5-KEY-ROTATION.md` — generate-in-custody default; import exception-only + dual-control + non-persistence proof; no seed/mnemonic in app code; no plaintext key anywhere)
- **Generate inside KMS/HSM preferred** (key never leaves custody in plaintext).
- **Import only if documented and audited** (justified, approved, logged) — otherwise disallowed.
- **No plaintext key in app memory** except inside the **isolated signer runtime during signing**, then zeroized.
- **No key in repo / `.env` / DB / logs / cache / fixtures** (enforced today by the mechanism guard's
  key-material rules, including `allowlisted_but_key_material:*` even inside a future allowlisted path).

**Decision owner:** governance + `signer_control`. **Decision:** _DECIDED — generate-in-custody default; import exception-only (dual-control + non-persistence proof); no seed/mnemonic in app code; no plaintext key anywhere (`DR-E2-B4B5-001`)._

---

## 5. Rotation / revocation policy — status: `DECIDED` (ratified in `E2-RATIFICATION-B4-B5-KEY-ROTATION.md` — triggers per `rotation_trigger`; `revoke_signer_profile` terminal+zeroize; `disable_signer_profile` unusable until governed re-enable; KMS failure → `DEGRADED`; cadence/thresholds deferred to ops)
- **Rotation triggers** (existing `rotation_trigger` values): `manual` · `time_based` · `trade_count_based` ·
  `risk_limit_based` · `compromise_suspected` · `wallet_retirement`. Cadence/thresholds: _TBD._
- **Revoke behavior:** `revoke_signer_profile` ⇒ `signer_profile_status = REVOKED` + **simulated→real zeroize**
  of custody material; revoked profile is unusable and inaccessible thereafter.
- **Zeroize requirement:** custody material cleared on revoke/shutdown/panic (modeled keyless in `keyless-custody-lifecycle`).
- **Mapping to existing names:** `revoke_signer_profile`, `disable_signer_profile`, `rotate_execution_wallet`,
  `wallet_rotation_status` (`NOT_REQUIRED`/`PENDING`/`IN_PROGRESS`/`COMPLETED`/`FAILED`) — no new names.

**Decision owner:** governance + ops. **Decision:** _DECIDED — triggers per `rotation_trigger`; `revoke_signer_profile` terminal+zeroize; `disable_signer_profile` unusable until governed re-enable; KMS failure → `DEGRADED`; cadence/thresholds deferred to ops (`DR-E2-B4B5-001`)._

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
> Ratification readiness assessed in `reports/E2-POLICY-RATIFICATION-READINESS.md` (no status flipped there; ratification is a separate governance decision). Decision-record form in `reports/E2-RATIFICATION-DECISION-RECORD-TEMPLATE.md` (template only — ratifies nothing; B1–B7 only, B8 excluded).

| # | Item | Status |
|---|---|---|
| B1 | Custody vendor (KMS/HSM/vault) chosen + minimum controls ratified (§1) — ratified in `E2-RATIFICATION-B1-B2-VENDOR-DEPLOYMENT.md` (`DR-E2-B1B2-001`): **KMS/HSM class, vendor-neutral**; specific instance deferred to deployment approval | **DECIDED** (class level) |
| B2 | Deployment boundary defined (isolated process; no API/UI/hot-path key access; no dumps) (§2) — ratified in `E2-RATIFICATION-B1-B2-VENDOR-DEPLOYMENT.md` (`DR-E2-B1B2-001`): **isolated separate container/process**; tier deferred to deployment approval | **DECIDED** (boundary level) |
| B3 | Dual-control / `signer_control` ops + two-person rule ratified (§3) — ratified in `E2-RATIFICATION-B3-DUAL-CONTROL.md` (`DR-E2-B3-001`): `signer_control` separate from admin; requester ≠ approver; two-person rule; operator roster deferred to ops | **DECIDED** |
| B4 | Key generation/import policy decided (§4) — ratified in `E2-RATIFICATION-B4-B5-KEY-ROTATION.md` (`DR-E2-B4B5-001`): generate-in-custody default; import exception-only + dual-control + non-persistence proof; no seed/mnemonic; no plaintext key | **DECIDED** |
| B5 | Rotation/revocation policy + cadence decided (§5) — ratified in `E2-RATIFICATION-B4-B5-KEY-ROTATION.md` (`DR-E2-B4B5-001`): triggers per `rotation_trigger`; revoke terminal+zeroize; disable→governed re-enable; KMS failure → DEGRADED; cadence deferred to ops | **DECIDED** (cadence deferred) |
| B6 | Emergency break-glass procedure defined (§6) — ratified in `E2-RATIFICATION-B6-B7-BREAKGLASS-AUDIT.md` (`DR-E2-B6B7-001`): incident-only; dual-control `signer_control`+independent approver (admin insufficient); safer-state-only actions (`trigger_kill_switch`/`revoke_signer`/`revoke_/disable_signer_profile`/`EXITS_ONLY`/`PAUSED`/`KILLED`); no key exposure / no Risk-Gate / no OperatingStateMachine bypass / no REAL-LIVE; quorum/threshold deferred to ops | **DECIDED** (quorum deferred) |
| B7 | Audit retention decided (§7) — ratified in `E2-RATIFICATION-B6-B7-BREAKGLASS-AUDIT.md` (`DR-E2-B6B7-001`): all sensitive events retained; append-only; references-only/no-secrets; before/after for sensitive attempts; purge preserves financial/security audit; retention duration deferred to compliance/ops | **DECIDED** (duration deferred) |
| B8 | Allowlist activation of the declared path approved (separate governance decision) — ratified in `E2-RATIFICATION-B8-ALLOWLIST-ACTIVATION.md` (`DR-E2-B8-001`): single declared path `packages/isolated-signer-runtime/src/` moved into `ALLOWLIST`; no wildcard/general bypass; key material still HARD-forbidden; fail-closed elsewhere; **E2 implementation not started** | **DECIDED** (guard activation only) |
| R | E0 readiness `ready=true` + E1 contract green + Risk/OperatingState/admission/signer all `ACTIVE` + audit path active, on testnet/devnet first | **READY FOR IMPLEMENTATION REVIEW** (mechanism present; gated on B1–B8) |

**Aggregate readiness:** **READY FOR E2 IMPLEMENTATION REVIEW** — 8 `DECIDED` (B1–B8). All custody-ops blockers are decided and the single declared isolated-signer path is activated in the guard (`ALLOWLIST=['packages/isolated-signer-runtime/src/']`). **This does NOT start E2 implementation:** real KMS/custody/signing is a separate, explicitly-approved PR (§9), and deferred ops/compliance parameters (break-glass quorum, audit retention duration, post-incident review, vendor instance, deployment tier) remain pending their own approvals.

---

## 9. Explicit E2-implementation gate statement (post-B8)
- **B1–B8 are all `DECIDED`** and the single declared isolated-signer path is activated in the guard
  (`ALLOWLIST=['packages/isolated-signer-runtime/src/']`, ratified `DR-E2-B8-001`). Aggregate is
  **READY FOR E2 IMPLEMENTATION REVIEW**.
- **E2 implementation (real KMS/custody/signing) has NOT started and remains a separate, explicitly-approved
  PR.** B8 activation is **guard-scope only**: it exempts one path from live-mechanism checks so a future
  isolated-signer package can be built; it adds no live mechanism. The package at that path is still a
  capabilities-all-false skeleton (PR-E2-1).
- **KMS/Vault integration remains a separate approval** — real custody/signing requires its own PR with
  positive isolation tests, fail-closed `DEGRADED`, zeroization, least-privilege, and `09-THREAT §7`
  readiness with zero `§7.8` blockers.
- **Deferred ops/compliance parameters remain pending their own approvals** — break-glass quorum/threshold
  (B6), audit retention duration (B7), post-incident review process, custody vendor instance (B1), and
  deployment tier (B2).
- **Fail-safe stance:** until an implementation PR lands, the system stays fully keyless/simulated; the
  mechanism guard stays fail-closed **everywhere except the one activated path**, key material stays
  HARD-forbidden even inside it, and no live signing/sending/transfer is possible.

---

**Confirmations:** Guard/governance-only · B1–B8 `DECIDED` · Single declared path activated (no wildcard/general
bypass) · Key material HARD-forbidden even inside the allowlist · Fail-closed everywhere else · E2
implementation NOT started · No KMS/Vault/KeyManager introduced · No key material introduced · No execution
authority introduced.
