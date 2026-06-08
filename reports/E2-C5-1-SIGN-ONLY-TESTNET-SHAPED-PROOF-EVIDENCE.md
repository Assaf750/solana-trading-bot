# E2-C5-1 — Sign-Only Testnet/Devnet-Shaped Proof Evidence (report-only)

> **REPORT / EVIDENCE-ONLY.** Summarises the test evidence added in PR-E2-C5-1. No `src` change, no
> dependency, no `ALLOWLIST` change, no KMS/Vault, no KeyManager, no RPC/send, no transaction serialization, no
> mainnet, no REAL-LIVE. References existing artifacts only; introduces no new SSOT/API/DATA/CONFIG name.
> **Does NOT change readiness and does NOT claim REAL-LIVE readiness.** No network was contacted.
>
> **State:** `main` @ `0479564` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']`.

---

## 1. Scope
Test-only proof that the existing real **sign-only** path (E2-C3-4, `createRealSigningPath`) produces a valid
Ed25519 signature over a **testnet/devnet-shaped local payload**, verified **off-chain**, with **nothing sent**.
File: `packages/isolated-signer-runtime/test/sign-only-testnet-shaped-proof.test.mjs` (7 tests). The tests are
the authoritative evidence.

## 2. Testnet/devnet-shaping (no src network field)
The path has **no network awareness** (adding a `network`/endpoint field to `src` would be a new SSOT name — a
stop condition). So shaping + mainnet refusal live in a **test harness**:
- `buildTestnetSignRequest(payload, base)` accepts only `network ∈ {devnet, testnet, localnet}` and derives a
  local digest (`<network>:<ref>`) used as `payload_digest === approved_payload_digest`.
- A payload that is mainnet-shaped, or carries any endpoint/RPC/send/broadcast/URL indicator, is **refused**
  (throws `refused`) before any signing — no signature produced.

## 3. Off-chain verification
The signature is verified in-process with the ephemeral public key against the **bound digest only**
(`webcrypto.subtle.verify`). No chain submission, no RPC, no endpoint contacted.

## 4. Mainnet / endpoint refusal
Refused cases (no signature): `network:'mainnet'`, `network:'mainnet-beta'`, `rpc_endpoint:'…'`,
`broadcast:true`, `provider_url:'…'`, `cluster:'mainnet'`. The sign-only path keeps `can_send:false` regardless.

## 5. Gate-failure refusal
For testnet-shaped requests, every gate failure still refuses (signed:false, signature:null): wrong digest
(`payload_digest_mismatch`), `approval_stale`, `readiness_not_ready`, `custody_degraded`, `custody_unconfigured`.

## 6. Audit / no-leak
Audit before/after per attempt; keys ⊆ `AUDIT_COLUMNS`; audit contains **no** signature, digest, key, or
private data.

## 7. No key export / no static key
Ephemeral key is **non-extractable**; output carries no key/private/seed/mnemonic; `src` has no static
key-material literals; the package has **no `fixtures/` directory**.

## 8. No send / no RPC / no serialization
`src` (comment/string-stripped) has no `sendTransaction`/`sendRawTransaction`/`new Connection(`/`.serialize(`/
`buildTransaction`/`new Transaction`/`fetch(`/network imports. Output has `can_send:false`, no
`tx`/`serialized`/`raw`/`endpoint`/`rpc`.

## 9. Confinement / allowlist
`real-signing-path.mjs` is under the allowlisted path; `node:crypto` appears in `src` only within
`isolated-signer-runtime/src`; a forbidden crypto-lib import outside the path is still rejected;
`ALLOWLIST` unchanged (one path); mechanism guard PASS `allowlist=1`.

## 10. Effect on status
- **No readiness change.** B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`.
- **No REAL-LIVE readiness claimed.** A sign-only off-chain proof is cryptographic evidence, not a network
  action and not a REAL-LIVE gate.
- **Remaining (separate approvals):** E2-C6 (signing closure); KMS/custody-key sourcing, real send/testnet
  broadcast/mainnet, and REAL-LIVE are separate later decisions.

---

**Confirmations:** Sign-only testnet-shaped proof only · No RPC/send introduced · No transaction serialization
introduced · No KMS/Vault/KeyManager introduced · No persisted/static key material introduced · No REAL-LIVE
activation · No execution authority beyond the existing local sign-only path.
