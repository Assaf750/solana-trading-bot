# E2 Phase-C Gate — Integration + Regression + Preconditions Compliance — EVIDENCE

> **Phase Gate record (documentation-only).** The multi-agent **Phase-C Gate** ran over the completed Phase C
> (Stages 17–18) at `main` @ `0a6572d`. **Decision: `PHASE_C_GATE_PASS` — 0 confirmed blockers.** Three auditors
> (e2e render chain · regression+guards · preconditions compliance) all pass; the arbiter independently re-ran
> everything, including live sweeps.

---

## 1. Gate verdict
| Auditor | Verdict | Blockers |
|---|---|---|
| E2E Render Chain | pass | 0 |
| Regression + Guards | pass | 0 |
| Preconditions Compliance (all 11 Phase-C preconditions, one by one) | pass | 0 |
| **Gate Arbiter** | **PHASE_C_GATE_PASS** | **0 confirmed** |

## 2. Independently verified (arbiter live sweeps)
- Suite **1799/1799** (0 fail/skip); SSOT drift EXACT; mechanism guard `sources=115 allowlist=1 violations=0`
  (line 121 byte-identical); clean tree; `HEAD == origin/main == 0a6572d`.
- **Seam structurally never-ready:** all 5 allowed source tags × all-met checklist × forged
  `seam_ready_advisory`/`activation_performed` inputs → still `seam_ready_advisory:false`,
  `activation_performed:false`, adapter-review requirement hardcoded unmet.
- **Gap advisory provably capped:** vocabulary exactly `{LIVE_ADVISORY_NONE, LIVE_ADVISORY_EXITS_ONLY_SHAPED}`;
  pathological sweep produced no KILLED-shaped output.
- XSS escaped-only; secrets refused + absent from serialization; security notices unhideable; unbadged paper
  models refused; `evaluateSendPreflight` refuses even forged-satisfied requests; zero exec-true literals (the
  only `can_sign:true` is the pre-existing allowlisted sign-only test-gated descriptor with `can_send:false`).

## 3. Phase-D preconditions (binding on every Phase-D commit) — adopted verbatim
1. **A dedicated supply-chain/security review must PASS before any code touches
   `packages/isolated-signer-runtime`**, which must REMAIN the single mechanism-guard ALLOWLIST entry
   (line 121 byte-identical; allowlist=1; violations=0).
2. **WebCrypto Ed25519 via the `node:crypto` builtin only** — no new dependency (direct or transitive) without
   its own supply-chain report; dependency sets stay empty/unchanged otherwise.
3. **Ephemeral/testnet keys only** — no mainnet key material ever (repo/tests/fixtures/logs/env); keys explicitly
   supplied per-call, never generated-and-persisted; non-extractable where supported.
4. **SIGN-ONLY scope:** no send path of any kind; send-gate keeps refusing; `can_send`/`can_broadcast`/
   `broadcast_permitted` false repo-wide; runtime `capabilities()` stay all-false globally.
5. **Key material never serialized/exported/logged/echoed/stringify-reachable** — dedicated no-key-leak battery
   over every result, error path, and audit record (NAME-only redaction).
6. **Mandatory audit record before AND after every signing operation** (intent/profile correlation); audit
   failure fail-closes the sign.
7. **Signer-runtime isolation preserved:** no other package imports it; source hygiene stays clean repo-wide.
8. **Testnet SEND is a separate later stage** behind its own gate/review; Phase D adds no RPC/wire/broadcast
   capability; the live seam stays never-ready in-package.
9. Hard-Risk/readiness/advisory caps untouched; SSOT drift baseline EXACT unless a governed ARCH→SSOT change
   ships first.
10. Full regression green at every Phase-D merge (suite 0 fail/0 skip, both guards, clean tree, origin sync).
11. **Owner-only inputs stay outside the repo entirely** (real provider keys, real wallet keys, funds); provider
    flow by reference only; real-money activation remains an explicit owner decision outside this mandate.

## 4. Decision
**Phase C is coherent, the preconditions held, and no execution authority exists anywhere. The Phase-C Gate
PASSES; Phase D (Stage 19 — Real Signing SIGN-ONLY, behind precondition #1's dedicated review) opens.**
