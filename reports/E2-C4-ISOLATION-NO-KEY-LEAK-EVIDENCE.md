# E2-C4 — Isolation & No-Key-Leak Evidence (report-only)

> **REPORT / EVIDENCE-ONLY.** Summarises the test evidence added in PR-E2-C4. No code/src change, no
> dependency, no `ALLOWLIST` change, no KMS/Vault, no KeyManager, no send/RPC, no transaction serialization, no
> REAL-LIVE. Does **not** change readiness and does **not** request KMS or send. References existing artifacts
> only; introduces no new SSOT/API/DATA/CONFIG name.
>
> **State:** `main` @ `a552f5d` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']`.

---

## 1. Scope
Dedicated positive-isolation / no-key-leak test pass for the **real SIGN-ONLY path** (E2-C3-4,
`createRealSigningPath`), in `packages/isolated-signer-runtime/test/real-signing-isolation.test.mjs`
(test-only). This report summarises the evidence; the tests are the authoritative proof.

## 2. Gate-failure matrix (every failure refuses a signature)
Each of these returns `signed:false`, `signature:null`, `can_send:false`, `ok≠true`, with the expected blocker:
`risk_not_approved` · `readiness_not_ready` · `signer_not_active` · `execution_wallet_not_active` ·
`operating_state_not_active` · `custody_degraded` · `custody_unconfigured` · `payload_digest_mismatch` ·
`approval_stale` · `audit_actor_required` (with **no audit append**) · `no_signing_material` (missing key).

## 3. Happy path (sign-only)
Signs **only** the bound approved digest; the signature **verifies** with the ephemeral public key; `can_send`
is false; output carries no `tx`/`transaction`/`serialized`/`raw`/`bytes`.

## 4. Arbitrary-bytes refusal
Extra `message`/`payload` fields are ignored — the signature verifies **only** against the bound
`approved_payload_digest`, never against arbitrary bytes. Signing arbitrary bytes is structurally impossible.

## 5. No-key-leak
- **Output:** no `key`/`privateKey`/`private_key`/`secret`/`seed`/`mnemonic`/`keypair` fields; the ephemeral
  private key is **non-extractable**.
- **Errors:** an induced `sign_error` (passing a verify-only public key) fails closed with `signature:null` and
  no key material in the result.
- **Audit:** contains no signature, no digest, no key/private data; keys ⊆ `AUDIT_COLUMNS`.
- **Source:** no static key-material literals (PEM / long base58 / mnemonic / seed phrase) in `src`; the
  package has **no `fixtures/` directory** (no fixture keys).

## 6. Audit before/after
Every attempt records a `real_sign_before` and an after entry (`real_sign_after_signed_sign_only_no_send` on
success, `real_sign_after_refused:<…>` on refusal). Keys ⊆ `AUDIT_COLUMNS` (no extra columns). Missing
`audit_actor` → fail-closed with **no** append.

## 7. No send / no RPC / no serialization
`src` (comment/string-stripped) contains no `sendTransaction`/`sendRawTransaction`/`new Connection(`/
`.serialize(`/`buildTransaction`/`new Transaction`/`fetch(`/`axios`/`node:net|http|dgram`.

## 8. Confinement / allowlist
- `real-signing-path.mjs` is **under the allowlisted path** (`isAllowlisted(...) === true`).
- `node:crypto` appears in `src` **only** within `packages/isolated-signer-runtime/src/` across all packages.
- A forbidden crypto-lib import **outside** the path is still rejected (`@noble/curves` → `crypto-signing-lib-import`;
  `@solana/web3.js` → `solana-sdk-import`).
- `ALLOWLIST` unchanged (exactly one path); mechanism guard PASS `allowlist=1`.

## 9. Capabilities
- Global `capabilities()` all-false (`can_sign:false`, `can_send:false`, `has_key_material:false`,
  `live_mechanisms:false`).
- Only `describeRealSigningPath()` reports `can_sign:true` — **local, sign-only, test-gated** — with
  `can_send:false`. The WebCrypto-adapter and mock-signer descriptors keep `can_send:false`.

## 10. Effect on status
- **No readiness change.** B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`.
- **No KMS, no send, no testnet, no mainnet, no REAL-LIVE** requested or introduced.
- **Remaining (separate approvals):** E2-C5 (sign-only testnet proof), E2-C6 (closure); KMS/custody-key
  sourcing and send/mainnet/REAL-LIVE are separate later decisions.

---

**Confirmations:** Isolation/test evidence only · No KMS/Vault/KeyManager introduced · No persisted/static key
material introduced · No send/RPC introduced · No transaction serialization introduced · No REAL-LIVE
activation · No execution authority beyond the existing local sign-only test-gated path.
