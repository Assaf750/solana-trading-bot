# E2 — Emergency Break-glass & Audit Retention Policy (governance artifact, doc-only)

> **DOC/REPORT-ONLY.** No runtime code, no package, no tools, no `ALLOWLIST` change, no allowlist-path
> activation, no KMS/vault, no keys, no signing, no execution authority. References existing SSOT names only;
> introduces no new SSOT/API/DATA/CONFIG name. Statuses are document statuses only, not SSOT enums.
> This policy is **proposed, not ratified** — blockers **B6** and **B7** stay `UNDECIDED`
> (`E2-CUSTODY-OPS-POLICY §8`).
>
> **Companion to:** `reports/E2-CUSTODY-OPS-POLICY.md` (B6 break-glass, B7 audit retention),
> `E2-DUAL-CONTROL-SIGNER-CONTROL-POLICY.md`, `E2-KEY-GENERATION-ROTATION-POLICY.md`.
> **State:** `main` @ `d9c19ad` · 372/372 tests · `ALLOWLIST=[]`. Sources: `09-THREAT-SECURITY §3/§5.8/§7`,
> `00-ARCHITECTURE §4.3/§10/§14`, `01-SSOT` G1 (operating_state), G11 (commands/audit), G14 (audit), G15.

---

## 1. Emergency break-glass policy — status: `UNDECIDED` (proposed)
- **When allowed:** only in a genuine incident (suspected key/operator compromise, custody failure, runaway
  behavior, chain/provider critical breach) where normal flows are insufficient and **safer state is the goal**.
- **Who requests it:** an operator (requester) with a recorded incident reason. Cannot self-approve.
- **Who approves it:** a `permission_role = signer_control` holder, **distinct** from the requester (dual-control,
  per `E2-DUAL-CONTROL §2`).
- **Relation to `signer_control`:** all break-glass actions are signing-sensitive ⇒ require `signer_control`;
  `admin` alone is insufficient (`09-THREAT §5.8`).
- **Two-person rule:** break-glass requires `signer_control` + a second approver; quorum/threshold = _TBD_.
- **Still forbidden even during break-glass** (§3): key exposure/export, Risk Gates bypass, OperatingStateMachine
  bypass, signing without E1/E2 checks, REAL-LIVE activation, unauthorized live transfer/sweep/funding. Break-glass
  can only move **toward** safer states, never enable execution.

## 2. Allowed emergency actions
| Action | SSOT command / state | Effect |
|---|---|---|
| Kill switch | `trigger_kill_switch` | `operating_state = KILLED`; halts new execution; human-only resume |
| Revoke signer | `revoke_signer` · `revoke_signer_profile` | `signer_profile_status = REVOKED` (terminal) + zeroize; prevents later use |
| Disable signer | `disable_signer_profile` | signer unusable (rejects load/use) |
| Move to exits-only | (OperatingStateMachine) | `operating_state = EXITS_ONLY` — no new entries; exits allowed |
| Pause | `pause_system` / `resume_system` | `operating_state = PAUSED` — no entries; resume via `WARMING_UP` |
| Kill | `trigger_kill_switch` | `operating_state = KILLED` |

- **Emergency exit:** allowed **only** through the existing Risk / OperatingStateMachine / ownership / Exit-Feasibility
  path — break-glass does **not** create a new exit authority and does **not** bypass those checks
  (`00-ARCH §10/§14`). `KILLED` permits emergency exit of open positions only where safer than holding.

## 3. Forbidden emergency actions
- **Key exposure / export** — never reveal/export key material under any incident.
- **Bypass Risk Gates** — no signing/execution without a fresh Risk approval.
- **Bypass OperatingStateMachine** — cannot force `ACTIVE`/entry; can only move toward safer states.
- **Signing without E1/E2 checks** — the SignerService contract (E1) + custody checks (E2) still apply.
- **REAL-LIVE activation** — break-glass never activates `activate_real_live`.
- **Unauthorized live transfer/sweep/funding** — no asset movement beyond authorized exits/sweeps under the
  existing gated flows.

## 4. Audit retention policy — status: `UNDECIDED` (proposed)
- **What is retained:** all security/custody/signing-sensitive events — break-glass requests+approvals,
  `trigger_kill_switch`, `revoke_/disable_signer_profile`, `revoke_signer`, custody-status changes,
  `operating_state` transitions, rotation/revocation, `activate_real_live` attempts, allowlist-activation decisions.
- **Retention duration:** _placeholder — TBD_ (financial/audit/security events are **not** purged by maintenance;
  purge tooling must preserve audit, per `06-BUILD`/SSOT G27 `candidate_cmd_purge_data` excludes financial audit).
- **Append-only:** consistent with the in-memory `createAuditLog` model and the DB-enforced append-only `audit_log`.
- **No secrets in audit:** references only — never key/seed/raw payloads.
- **Fields/content (existing `AUDIT_COLUMNS` only):** `audit_actor`, `permission_role`, `command_type`,
  `request_id`, `idempotency_key`, approval reference (encoded in `audit_reason`), `audit_scope`, `audit_reason`,
  `event_timestamp`/`event_sequence` where applicable.
- **Before/after records:** signing-sensitive and break-glass actions record before and after (`09-THREAT §3`).

## 5. Forensics / incident review
- **Evidence package:** an assembled, read-only view from append-only audit (no secrets) for an incident window.
- **Incident timeline:** ordered events via `event_sequence`/`event_timestamp` (no clock invented here; sourced
  from existing audit fields).
- **Custody-status changes:** transitions of custody lifecycle (keyless model) and `signer_profile_status`
  (`ACTIVE`/`DEGRADED`/`DISABLED`/`REVOKED`).
- **Signer profile status changes:** every `signer_profile_status` transition with actor/reason.
- **`operating_state` transitions:** `WARMING_UP`/`ACTIVE`/`EXITS_ONLY`/`PAUSED`/`KILLED` with trigger/reason.
- **Readiness blockers:** the E0 readiness verdict + blocker list at the incident time (`real_live_config_valid`,
  signer/wallet/operating status, provider/slot/protocol, audit-path) — for "why ready/not-ready" reconstruction.
- **Reuse, not new fields:** forensics is a read assembly over existing audit/state; introduces no new SSOT field.

## 6. Checklist impact
- **B6 (emergency break-glass procedure):** `UNDECIDED` → remains `UNDECIDED` (procedure proposed; quorum/threshold
  and post-incident review process not ratified).
- **B7 (audit retention):** `UNDECIDED` → remains `UNDECIDED` (append-only/no-secrets affirmed; **duration** not ratified).
- **B1–B5:** unchanged `UNDECIDED`. **B8:** unchanged `BLOCKED`.
- **Aggregate:** **NOT READY / NO-GO** — this report proposes policy but ratifies nothing; B8 (allowlist activation)
  remains a separate approval.

## 7. Open Questions remaining
1. Break-glass quorum/threshold and whether a reviewer (third role) is required for kill switch vs revoke.
2. Audit retention **duration** (regulatory/operational) and cold-storage/archival approach (no secrets).
3. Post-incident review process and owner; SLA for evidence-package assembly.
4. Whether emergency-exit-during-`KILLED` needs an explicit per-incident authorization vs standing policy.
5. Forensics access control (who may read evidence packages) and redaction guarantees.
6. Interaction of break-glass with `activate_real_live` readiness state at incident time.

---

**Confirmations:** Doc/report-only · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/KeyManager
introduced · No key material introduced · No execution authority introduced.
