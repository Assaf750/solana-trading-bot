# E2 — Key Generation / Import / Rotation / Revocation Policy (governance artifact, doc-only)

> **DOC/REPORT-ONLY.** No runtime code, no package, no tools, no `ALLOWLIST` change, no allowlist-path
> activation, no KMS/vault, no keys, no signing, no execution authority. References existing SSOT names only;
> introduces no new SSOT/API/DATA/CONFIG name. Statuses are document statuses only, not SSOT enums.
> This policy is **proposed, not ratified** — blockers **B4** and **B5** stay `UNDECIDED`
> (`E2-CUSTODY-OPS-POLICY §8`).
>
> **Companion to:** `reports/E2-CUSTODY-OPS-POLICY.md` (B4 key gen/import, B5 rotation/revocation),
> `E2-CUSTODY-VENDOR-DEPLOYMENT-OPTIONS.md`, `E2-DUAL-CONTROL-SIGNER-CONTROL-POLICY.md`.
> **State:** `main` @ `75621b3` · 372/372 tests · `ALLOWLIST=[]`. Sources: `09-THREAT-SECURITY §2/§4/§6`,
> `00-ARCHITECTURE §4.3`, `01-SSOT` G15 (signer/custody/rotation), G14 (audit), G11 (commands).

---

## 1. Key generation policy — status: `UNDECIDED` (proposed)
- **Generate inside KMS/HSM preferred** — the key is created within custody and is non-exportable; the
  application never sees plaintext.
- **Imported keys discouraged** — allowed only by exception with separate approval (§2).
- **No plaintext key in app memory** except inside the **isolated signer runtime during signing**, then zeroized
  (`09-THREAT §4`). No other process/layer ever holds plaintext.
- **No key in repo / `.env` / DB / logs / cache / fixtures** (enforced by the mechanism guard's key-material
  rules, including `allowlisted_but_key_material:*` even inside a future allowlisted path).
- **No test/live key crossover** — disposable, isolated dev/test keys only; never reused for live (§5).

## 2. Key import policy — status: `UNDECIDED` (proposed)
- **When allowed:** only when generation-in-custody is infeasible, by documented exception.
- **Required approvals:** dual-control (`signer_control` + second approver, per `E2-DUAL-CONTROL §2`).
- **Required audit:** before/after entries; actor + approval reference; reason; no secret content (§6).
- **Proof of non-persistence:** the import path must demonstrate the key is loaded into custody (KMS/HSM/vault)
  and **never written to disk/`.env`/DB/logs/cache** by the application.
- **Prohibition:** **no seed/mnemonic handling in application code** — seed/mnemonic never pass through app
  layers; `key_custody_mode = isolated_signer` only; `connected_wallet` is manual-only and out of scope here.

## 3. Rotation policy — status: `UNDECIDED` (proposed)
Triggers map 1:1 to the existing `rotation_trigger` enum (no new names):
| Trigger | `rotation_trigger` value | Notes |
|---|---|---|
| Time-based | `time_based` | cadence: _TBD_ |
| Trade-count-based | `trade_count_based` | threshold: _TBD_ |
| Risk-limit-based | `risk_limit_based` | tied to Hard Risk breaches |
| Compromise suspected | `compromise_suspected` | immediate; pairs with revoke (§4) |
| Signer degraded | (no dedicated trigger) | `signer_profile_status = DEGRADED` blocks signing; rotation initiated via `manual`/`risk_limit_based` per ops |
| Wallet retirement | `wallet_retirement` | end-of-life rotation |
| Manual operator-initiated | `manual` | dual-control required |

- Rotation flow uses `rotate_execution_wallet` and `wallet_rotation_status`
  (`NOT_REQUIRED`/`PENDING`/`IN_PROGRESS`/`COMPLETED`/`FAILED`) — the simulated composite already modeled in
  `@soltrade/wallet-rotation` (Gate D). Live rotation remains gated by E2 readiness.
- **Note:** "signer degraded" is a *state* (`DEGRADED`), not a `rotation_trigger` value; rotation on degradation
  is initiated through an existing trigger (`manual`/`risk_limit_based`). No new trigger name is introduced.

## 4. Revocation policy — status: `UNDECIDED` (proposed)
- **`revoke_signer_profile`** (`signer_control`): `signer_profile_status = REVOKED`; **terminal** — revoked signer
  is unusable thereafter; requires zeroize of custody material.
- **`disable_signer_profile`** (`signer_control`): makes the signer unusable (not necessarily terminal); rejects
  load/use until re-enabled per ops.
- **Zeroize requirement:** custody material cleared on revoke/shutdown/panic (modeled keyless in
  `@soltrade/keyless-custody-lifecycle`).
- **`DEGRADED` on custody failure:** KMS/vault failure ⇒ `signer_profile_status = DEGRADED` (fail-closed); no
  signing on unverified custody; not eligible for new entry until back to `ACTIVE`.
- **Terminal behavior:** `REVOKED` is terminal; no transition out; new signing requires a fresh signer profile.

## 5. Environment separation
- **dev/test/staging/live separated** (`09-THREAT §6`): separate custody instances; no shared keys across
  environments.
- **No live key in dev/test** — dev/test use mock or disposable, balance-limited, isolated test keys only.
- **No test key authorizes live** — test/staging keys never used for live trading; staging mainnet signing is
  manual-only until full live readiness.

## 6. Audit requirements
- **Attempts audited:** every generation / import / rotation / revocation attempt — success **and** failure.
- **Before/after entries:** signing-sensitive/custody actions record before and after (`09-THREAT §3`).
- **No secrets in audit:** references only — never key/seed/raw material.
- **Actor / approval references:** `audit_actor` (+ `permission_role`), `command_type`, approval reference and
  `request_id`/`idempotency_key` (no new fields; carried within existing `AUDIT_COLUMNS`).
- **Append-only:** consistent with the in-memory `createAuditLog` model and the DB-enforced `audit_log` table.

## 7. Checklist impact
- **B4 (key generation/import policy):** `UNDECIDED` → remains `UNDECIDED` (policy proposed; cadence/exception
  thresholds and import-exception process not ratified).
- **B5 (rotation/revocation policy + cadence):** `UNDECIDED` → remains `UNDECIDED` (triggers mapped; cadence/
  thresholds not ratified).
- **B1/B2/B3/B6/B7:** unchanged `UNDECIDED`. **B8:** unchanged `BLOCKED`.
- **Aggregate:** **NOT READY / NO-GO** — this report proposes policy but ratifies nothing.

## 8. Open Questions remaining
1. Rotation cadence/thresholds (time-based interval; trade-count threshold; risk-limit mapping).
2. Import-exception process: who approves, how non-persistence is proven/attested.
3. Whether key generation is HSM-only or KMS-managed (ties to B1 vendor decision).
4. Re-enable process after `disable_signer_profile` (and whether disable is ever reversible in live).
5. Zeroization verification approach (how "cleared" is evidenced without exposing material).
6. Testnet/staging custody instance provisioning and key lifecycle separate from live.

---

**Confirmations:** Doc/report-only · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/KeyManager
introduced · No key material introduced · No execution authority introduced.
