# E2-C6 — Signing Implementation Closure (report-only)

> **REPORT / CLOSURE-ONLY.** No code, no tests, no package, no tool, no dependency, no `ALLOWLIST` change, no
> KMS/Vault, no KeyManager, no RPC/send, no transaction serialization, no mainnet, no REAL-LIVE. References
> already-merged artifacts only; introduces no new SSOT/API/DATA/CONFIG name. **Does NOT change readiness and
> does NOT claim KMS / send / REAL-LIVE readiness.**
>
> **State:** `main` @ `cdcadda` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 482/482 tests · mechanism guard
> `allowlist=1 violations=0`.

---

## 1. Closure scope
Closes the **E2-C sign-only signing** chain: a real Ed25519 **sign-only** capability inside the one allowlisted
path, behind the existing gate, proven by isolation/no-leak and a testnet/devnet-shaped off-chain proof — with
**no** KMS/custody-key sourcing, **no** send/RPC, **no** serialization, **no** mainnet, **no** REAL-LIVE.

## 2. E2-C chain summary (all merged)
| PR | Artifact | What it established |
|---|---|---|
| E2-C3-0 | `reports/E2-C3-0-REAL-SIGNING-LIBRARY-SELECTION.md` | Library selection: **native WebCrypto Ed25519** (fallback `@noble/curves`); `@solana/web3.js` rejected for E2-C3. |
| E2-C3-1 | `test/webcrypto-signing-probe.test.mjs` | Test-only probe: Ed25519 WebCrypto support; ephemeral non-extractable sign/verify; no dependency, no project signing. |
| E2-C3-2 | `src/webcrypto-signing-adapter.mjs` | WebCrypto **skeleton**: support probe (key discarded), `attemptSign()` fail-closed; `node:crypto` permitted in the path; not wired. |
| E2-C3-3 | `reports/E2-C3-3-REAL-SIGNING-WIRING-DESIGN.md` | Design of the real sign-only wiring composing existing gates; threat review; gate conditions. |
| E2-C3-4 | `src/real-signing-path.mjs` | **Real sign-only wiring**: signs ONLY the bound approved digest behind preflight+readiness+audit+custody; ephemeral key supplied per-call; `can_send:false`. |
| E2-C4 | `test/real-signing-isolation.test.mjs` + `reports/E2-C4-ISOLATION-NO-KEY-LEAK-EVIDENCE.md` | Isolation/no-key-leak evidence: gate-failure refusal, arbitrary-bytes impossible, no leak (output/audit/errors/source), confinement, capabilities. |
| E2-C5-0 | `reports/E2-C5-0-SIGN-ONLY-TESTNET-PROOF-DESIGN.md` | Testnet-proof boundary/design: off-chain only, no broadcast/RPC/serialize/mainnet. |
| E2-C5-1 | `test/sign-only-testnet-shaped-proof.test.mjs` + `reports/E2-C5-1-SIGN-ONLY-TESTNET-SHAPED-PROOF-EVIDENCE.md` | Testnet/devnet-shaped sign + **off-chain verify**; mainnet/endpoint refusal; gate-failure refusal; no leak. |

Signing modules in the allowlisted path: `signing-preflight-gate.mjs` (preflight + readiness + audit
before/after), `webcrypto-signing-adapter.mjs` (skeleton), `mock-signer-adapter.mjs` (mock), `real-signing-path.mjs`
(real sign-only).

## 3. Completed (done)
- **Sign-only wiring** behind the existing gate (preflight + E0 readiness + audit before/after + custody).
- **Bound-digest signing only** — signs solely `approved_payload_digest`; arbitrary-bytes signing impossible.
- **Off-chain verification** of the produced Ed25519 signature.
- **Audit before/after** on every attempt; keys ⊆ `AUDIT_COLUMNS`; no signature/digest/key/private in audit.
- **No-key-leak** — ephemeral non-extractable key supplied per-call; never exported/persisted/returned; no
  static key material in source; no `fixtures/`.
- **No send / no RPC / no serialization** in `src`.
- **Testnet/devnet-shaped proof only**, mainnet/endpoint/RPC/send refused before signing.
- **Confinement** — real signing only under `packages/isolated-signer-runtime/src/`; `ALLOWLIST` one path;
  global `capabilities()` all-false (only a local sign-only descriptor reports `can_sign:true`).

## 4. Not completed (out of E2-C scope)
- **No KMS/Vault / custody-key sourcing** — the signing key is an ephemeral/test handle supplied per-call;
  real custody/KMS sourcing is a separate track.
- **No KeyManager.**
- **No send / no RPC** — nothing is broadcast; no provider/endpoint is contacted.
- **No transaction building / serialization.**
- **No real testnet broadcast** — the testnet proof is cryptographic/off-chain only.
- **No mainnet.**
- **No REAL-LIVE activation.**

## 5. Final readiness statement
- **READY FOR SIGN-ONLY IMPLEMENTATION REVIEW CLOSURE.**
- **NOT READY FOR KMS.**
- **NOT READY FOR SEND.**
- **NOT READY FOR REAL-LIVE.**

## 6. Remaining approvals (each a separate, explicit decision)
- **KMS / custody-key sourcing PR** — integrate a real custody/KMS source for the signing key (separate; not
  started; signing-sensitive → `signer_control` + two-person rule).
- **Send / testnet broadcast PR** — any actual broadcast/RPC (E2-F+), testnet first; never mainnet without its
  own decision.
- **Mainnet / REAL-LIVE approval** — a distinct decision with `09-THREAT §7` readiness and zero `§7.8` blockers.
- **Any new SSOT name** (e.g. a real `network`/endpoint field) must go **ARCH → SSOT first**.

## 7. Risk controls to carry forward
- **Key material never** in repo / `.env` / DB / logs / cache / fixtures.
- **No key export**; private keys non-extractable; custody-sourced at runtime (when KMS lands).
- **Audit refs-only** (AUDIT_COLUMNS); no signature/digest/key in audit.
- **`can_send:false`** until a separate send decision; no serialization/RPC/send.
- **`ALLOWLIST` remains exactly one path**; key material HARD-forbidden even there; everything else fail-closed.
- **KMS and REAL-LIVE are separate gates** — sign-only readiness does not imply either.

## 8. Guard / allowlist & readiness impact
- **No `ALLOWLIST` change**; mechanism guard PASS `allowlist=1 violations=0`; cross-repo guard unchanged.
- **No readiness change** — B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`.

---

**Confirmations:** Report-only · No KMS/Vault/KeyManager introduced · No RPC/send introduced · No transaction
serialization introduced · No REAL-LIVE activation · No new execution authority introduced.
