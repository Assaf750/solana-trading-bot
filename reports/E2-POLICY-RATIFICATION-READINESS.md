# E2 — Policy Ratification Readiness Report (governance artifact, doc-only)

> **DOC/REPORT-ONLY.** No runtime code, no package, no tools, no `ALLOWLIST` change, no allowlist-path
> activation, no KMS/vault, no keys, no signing, no execution authority. References existing SSOT names only;
> introduces no new SSOT/API/DATA/CONFIG name. Statuses are document statuses only, not SSOT enums.
> **This report changes NO checklist status:** B1–B7 stay `UNDECIDED`, B8 stays `BLOCKED`. Ratification does
> **not** happen via this PR (see §4).
>
> **Aggregates:** `reports/E2-CUSTODY-OPS-POLICY.md` (checklist B1–B8), `E2-CUSTODY-VENDOR-DEPLOYMENT-OPTIONS.md`
> (B1/B2), `E2-DUAL-CONTROL-SIGNER-CONTROL-POLICY.md` (B3), `E2-KEY-GENERATION-ROTATION-POLICY.md` (B4/B5),
> `E2-BREAKGLASS-AUDIT-RETENTION-POLICY.md` (B6/B7).
> **State:** `main` @ `fb1124e` · 372/372 tests · `ALLOWLIST=[]`. Sources: `09-THREAT-SECURITY §3–§7`,
> `00-ARCHITECTURE §4.3/§10`, `06-BUILD §4/§6`, `01-SSOT` G11/G14/G15.

---

## 1. Ratification readiness matrix (B1–B7)
| # | Blocker | Policy doc exists? | Decision required to ratify | Who must approve | Required evidence | Residual risk | Status |
|---|---|---|---|---|---|---|---|
| B1 | Custody vendor + minimum controls | ✓ (vendor-options) | Pick vendor (KMS/HSM/vault); ratify min-controls | governance + `signer_control` | vendor controls attestation; non-exportability proof | wrong vendor → weak custody | **UNDECIDED** |
| B2 | Deployment boundary | ✓ (vendor-options) | Pick isolation tier (container/VM); confirm no API/UI/hot-path key access | governance + ops | deployment topology; no-dumps config | shared boundary → key exposure | **UNDECIDED** |
| B3 | Dual-control / `signer_control` ops | ✓ (dual-control) | Ratify operator roster + two-person rule | governance + `signer_control` | named roster; SoD matrix | single-person critical action | **UNDECIDED** |
| B4 | Key generation/import policy | ✓ (key-gen-rotation) | Ratify gen-in-custody + import-exception process | governance + `signer_control` | non-persistence proof; import approvals | imported/plaintext key leak | **UNDECIDED** |
| B5 | Rotation/revocation + cadence | ✓ (key-gen-rotation) | Ratify cadence/thresholds | governance + ops | cadence values; revoke/zeroize evidence | stale/compromised key | **UNDECIDED** |
| B6 | Emergency break-glass | ✓ (breakglass-audit) | Ratify quorum/threshold + review process | governance + `signer_control` | quorum rule; post-incident review SLA | uncontrolled break-glass | **UNDECIDED** |
| B7 | Audit retention | ✓ (breakglass-audit) | Ratify retention duration + archival | governance + compliance | duration; archival (no secrets) | insufficient forensics | **UNDECIDED** |

**All seven have a proposed policy document; none is ratified.** Ratification = a human/governance decision (§4).

## 2. B8 — Allowlist activation
- **Status:** **BLOCKED** (not approved).
- **Why not now:** activation moves the declared path (`packages/isolated-signer-runtime/src/`) into the
  mechanism guard's `ALLOWLIST`, opening live-mechanism imports/calls there. That must not happen until B1–B7
  are ratified and real custody is about to be built — opening the door before the room is built.
- **Prerequisites before any H5:** B1–B7 all `DECIDED`+reviewed; readiness row R conditions confirmable
  (E0 `ready=true`, E1 contract, Risk/OperatingState/admission/signer `ACTIVE`, audit path); explicit, separate
  governance approval to activate; and even then H5 stays **declaration/test-only** (no live mechanism), with
  real KMS integration a further separate approval.

## 3. Cross-policy consistency review
- **B1/B2 (vendor/deployment) ↔ B4/B5 (key gen/rotation):** consistent — generate-in-custody (B4) requires a
  custody vendor (B1) inside the isolated boundary (B2); rotation/revocation (B5) operates within that custody.
  No conflict.
- **B3 (dual-control) ↔ B6 (break-glass):** consistent — break-glass actions are signing-sensitive and inherit
  the B3 `signer_control` + two-person rule; break-glass adds incident gating, never relaxes B3. No conflict.
- **B7 (audit retention) ↔ all sensitive actions:** consistent — every B3/B4/B5/B6 action and custody/operating
  transition is audited append-only with no secrets and retained per B7. No conflict.
- **Guard/`ALLOWLIST` ↔ all:** consistent — `ALLOWLIST=[]` keeps everything fail-closed regardless of policy
  text; key material stays forbidden in source even in a future allowlisted path. No conflict.
- **Result:** **no cross-policy conflicts identified.**

## 4. Ratification procedure
- **How a blocker becomes `DECIDED`:** a human/governance decision records the chosen option(s), approvers,
  evidence, and residual-risk acceptance for that blocker — captured in a **future ratification PR / decision
  record** that edits the checklist status with explicit approval.
- **Required review:** governance + `signer_control` (and ops/compliance where noted in §1). Two-person rule
  applies to signing-sensitive ratifications (B1/B3/B4/B6).
- **Not via this PR:** **E2-7 does not ratify anything** and changes no status. It only assesses readiness to
  ratify and the procedure to do so.

## 5. Final recommendation
- **E2 implementation remains NO-GO** (B1–B7 `UNDECIDED`, B8 `BLOCKED`).
- **Next step after E2-7** should be a **ratification PR / decision record** (per §4) that flips specific B1–B7
  items to `DECIDED` with recorded approvals/evidence — **not H5**. H5 (allowlist activation declaration/test)
  and KMS integration each remain **separate explicit approvals**, and only after ratification.
- Until ratification, the system stays fully keyless/simulated; the mechanism guard stays fail-closed.

## 6. Open Questions remaining
1. Who constitutes "governance" for ratification, and the quorum for each blocker class.
2. Where decision records live (a `decisions/` log vs editing the checklist directly) and their format.
3. Sequence of ratification (all-at-once vs per-blocker) and dependencies (B1 before B4/B5).
4. Evidence artifacts acceptable for non-exportability / non-persistence / zeroization without exposing material.
5. Whether a testnet/devnet custody dry-run (no live mainnet) is required as evidence before B1/B2 ratification.
6. Confirmation that ratification needs no new SSOT/API/DATA/CONFIG name (decisions reference existing names only).

---

**Confirmations:** Doc/report-only · No status changed (B1–B7 `UNDECIDED`, B8 `BLOCKED`) · E2 implementation remains
NO-GO · No allowlist activation · No KMS/Vault/KeyManager introduced · No key material introduced · No execution
authority introduced.
