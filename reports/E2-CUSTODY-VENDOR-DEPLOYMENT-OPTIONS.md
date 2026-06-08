# E2 — Custody Vendor & Deployment Options (comparison/decision report, doc-only)

> **DOC/REPORT-ONLY.** No runtime code, no package, no tools, no `ALLOWLIST` change, no allowlist-path
> activation, no KMS/vault, no keys, no signing, no execution authority. References existing SSOT names only;
> introduces no new SSOT/API/DATA/CONFIG name. Records a **preference**, not a final decision — vendor and
> deployment boundary remain `UNDECIDED` (B1/B2 in `reports/E2-CUSTODY-OPS-POLICY.md §8`).
>
> **Companion to:** `reports/E2-CUSTODY-OPS-POLICY.md` (B1 vendor, B2 deployment boundary).
> **State:** `main` @ `12e4f07` · 372/372 tests · `ALLOWLIST=[]`. Sources: `09-THREAT-SECURITY §2–§7`,
> `00-ARCHITECTURE §4.3`, `06-BUILD §4/§6`, `01-SSOT` G15/G10.

---

## 1. Custody options comparison
| Option | Where the key lives | Signs via | Automated REAL-LIVE? | Status today |
|---|---|---|---|---|
| **cloud KMS** | provider-managed key store; used in isolated signer memory at sign time | isolated SignerService | yes, after full readiness | candidate (B1 undecided) |
| **HSM** | dedicated hardware module; key non-exportable | isolated SignerService via HSM client | yes, after full readiness | candidate (B1 undecided) |
| **self-hosted vault** | operator-run secret vault | isolated SignerService | yes, after full readiness | candidate (B1 undecided) |
| **manual / `connected_wallet`** | user's wallet (Phantom/Solflare) | user, in their wallet | **no** — manual/test only; not via SignerService | allowed for manual approval only (`09-THREAT §2/§6`) |
| **mock / no-key (current)** | nowhere (refused) | nothing — keyless models only | N/A | **active on `main`** (E1/E2-0/E2-1) |

## 2. Criteria matrix
(✓ strong · ◐ partial/depends · ✗ weak · — n/a. Qualitative; no benchmarks run.)

| Criterion | cloud KMS | HSM | self-hosted vault | manual/connected | mock/no-key |
|---|---|---|---|---|---|
| key never leaves custody boundary | ✓ | ✓ (non-exportable) | ◐ (config-dependent) | ✓ (user-held) | — (no key) |
| signing latency (hot-path fit) | ◐ (network call) | ✓ (local HW) | ◐ | ✗ (human in loop) | — |
| auditability (before/after, `09-THREAT §3`) | ✓ | ✓ | ✓ | ◐ (off-system signing) | ✓ (audit modeled) |
| revoke/disable behavior (`revoke_/disable_signer_profile`) | ✓ | ✓ | ✓ | ◐ (user-controlled) | ✓ (modeled) |
| zeroization support (`09-THREAT §4`) | ◐ (provider-dependent) | ✓ | ◐ | — | ✓ (simulated) |
| deployment isolation (separate process) | ✓ | ✓ | ✓ | — | ✓ |
| operational complexity | ◐ | ✗ (HW ops) | ✗ (run vault) | ✓ (none) | ✓ (none) |
| vendor lock-in | ✗ (cloud-specific) | ◐ | ✓ (portable) | ✓ | ✓ |
| testnet/staging support (`09-THREAT §6`) | ✓ (separate test keys) | ◐ | ✓ | ✓ | ✓ |
| fit with `signer_profile_id` / `key_custody_mode=isolated_signer` | ✓ | ✓ | ✓ | ✗ (`connected_wallet`, not isolated) | ✓ (keyless model) |

## 3. Deployment boundary options
| Option | Isolation | Notes |
|---|---|---|
| same host, separate process | ◐ | minimum acceptable; shared kernel; no shared memory with API/UI/hot-path |
| separate container | ✓ | clear process/network boundary; preferred baseline |
| isolated VM | ✓✓ | strongest isolation; higher ops cost |
| managed-KMS client inside signer runtime | ✓ | signer runtime holds the KMS client; key used in isolated memory, never exported |
| **disallowed** | — | signer in API/dashboard process · key access from API/UI/hot-path · key on disk/`.env` · core/debug dumps in live · shared custody across environments |

## 4. Recommendation
- **Preferred:** **cloud KMS or HSM** as custody, **inside an isolated signer runtime in a separate container** (managed-KMS-client-in-signer pattern). HSM gives the strongest key non-exportability; cloud KMS gives lower ops complexity — final pick depends on operator infra (B1).
- **Fallback:** **self-hosted vault** in a separate container (portable, no cloud lock-in) — acceptable if it meets the §1 minimum controls in `E2-CUSTODY-OPS-POLICY §1`.
- **Disallowed:** `connected_wallet` for automated/REAL-LIVE signing; any in-process (API/UI/hot-path) key access; plaintext key on disk/`.env`; shared dev/test/live custody.
- **Remains undecided:** the specific vendor (cloud KMS vs HSM vs vault) and the container-vs-VM isolation tier — both require operator infra input and ratification (B1/B2 stay `UNDECIDED`).

## 5. Impact on E2 readiness checklist
- **B1 (vendor):** `UNDECIDED` → remains `UNDECIDED` (a **preference** is recorded: KMS/HSM in isolated container, vault fallback; no vendor ratified).
- **B2 (deployment boundary):** `UNDECIDED` → remains `UNDECIDED` (separate container preferred; container-vs-VM tier not ratified).
- **B3–B7:** unchanged `UNDECIDED`. **B8 (allowlist activation):** unchanged `BLOCKED`.
- **Aggregate:** **NOT READY / NO-GO** — this report narrows options but ratifies nothing; no item flips to `DECIDED`/`READY`.

## 6. Explicit constraints (unchanged, non-negotiable)
- No keys in repo / `.env` / DB / logs / cache / fixtures.
- No key export; key never leaves the isolated signer boundary.
- No signing before Risk / Intent / State checks **and** E0 readiness (`ready=true`) + E1 contract pass.
- No allowlist activation yet (`ALLOWLIST` stays `[]`); declaring the path (H4) / skeleton (E2-1) does not authorize it.
- Fail-closed: custody failure ⇒ `signer_profile_status = DEGRADED`; no signing on unverified custody.

## 7. Open Questions remaining after this report
1. Final vendor pick: cloud KMS vs HSM vs self-hosted vault (operator infra + cost + lock-in trade-off).
2. Isolation tier: separate container vs isolated VM.
3. KMS-client placement/permissions inside the signer runtime (least-privilege scope per `signer_profile_id`).
4. Testnet/staging custody instance separate from live (key separation per `09-THREAT §6`).
5. Latency budget for a network-KMS sign call vs hot-path requirements (informs KMS-vs-HSM).
6. Remaining B3–B7 policy decisions (dual-control, key gen/import, rotation/revocation, break-glass, audit retention) — owned by `E2-CUSTODY-OPS-POLICY`.

---

**Confirmations:** Doc/report-only · E2 implementation remains NO-GO · No allowlist activation · No KMS/Vault/KeyManager
introduced · No key material introduced · No execution authority introduced.
