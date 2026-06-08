# E2-C3-0 — Real Signing Library Selection & Signing Implementation Gate (report-only)

> **REPORT / GOVERNANCE-ONLY.** No code, no package, no tool, no dependency install, no crypto/signing import,
> no `ALLOWLIST` change, no KMS/Vault, no KeyManager, no key material, no signing/sending, no RPC, no
> REAL-LIVE. References existing artifacts only; introduces no new SSOT/API/DATA/CONFIG name. **This report
> does NOT change readiness status and does NOT start real signing.** It compares options and sets the gate
> conditions for a *future, separately-approved* E2-C3.
>
> **State:** `main` @ `e2f7cd0` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 445/445 tests · mechanism guard
> `allowlist=1 violations=0`.

---

## 1. Current state (read from `main`)
- E2 signing scaffolding complete through E2-C2 inside the **one** allowlisted path
  (`packages/isolated-signer-runtime/src/`): custody-provider **stub** (E2-A), custody-lifecycle **wiring**
  (E2-B), signing **preflight gate** (E2-C0) with **audit before/after** (E2-D), **E0 readiness + fail-closed
  DEGRADED** (E2-E), signing-adapter **contract + no-op** (E2-C1), and **mock signer** (E2-C2).
- Nothing signs: `capabilities()` all-false; every signing path returns `signed:false`/`signature:null`/
  `can_send:false`. No crypto/signing library, no key material, no KMS/Vault, no send/RPC.
- **Guard fact:** `crypto-signing-lib-import` (`@noble/`, `tweetnacl`, `bs58`, `ed25519`, `@solana/web3.js`)
  and `solana-sdk-import` (`@solana/`) are rejected **everywhere except** the allowlisted path; key material
  is HARD-forbidden even there. So any chosen library must be imported **only** under
  `packages/isolated-signer-runtime/src/`.

## 2. Library options matrix (analysis only — NO dependency installed)
Solana signatures are **Ed25519**. The signing operation needed is "sign a fixed, approved payload digest with
a custody-held key" — **sign-only**, no transaction construction, no network.

| Option | Ed25519 sign-only? | Usable w/o RPC/send? | Prevents arbitrary-bytes signing? | Confinable to allowlisted path? | Supply-chain | Dep size / surface | no-key-export testable | no-send/no-RPC testable |
|---|---|---|---|---|---|---|---|---|
| **Native WebCrypto** (`node:crypto` / `crypto.subtle`) | Ed25519 supported in modern Node (`subtle.sign('Ed25519',…)` / `sign('ed25519')`) | **Yes** — pure local, no network | Yes — caller passes the exact bound digest; no tx parser | **Yes** — but `node:crypto` is on the guard's `node-network`? No — guard forbids `node:(net|http|https|dgram|tls)`, **not** `node:crypto`; still must live in the allowlisted path by policy | **Best** — platform built-in, no third-party dep | Zero added dep | Yes (key handle stays in custody; never returned) | Yes (no network API used) |
| **`@noble/curves` (ed25519)** | Yes — audited Ed25519 | **Yes** — pure, no network | Yes — signs given bytes only | Yes — single focused module | **Good** — widely audited, minimal deps | Small, focused | Yes | Yes |
| **`tweetnacl`** | Yes — `nacl.sign.detached` | **Yes** — pure, no network | Yes — signs given bytes only | Yes | **OK** — mature but older; less active | Small | Yes | Yes |
| **`@solana/web3.js`** | Yes (via `Keypair`/`nacl`), but bundles **transaction + Connection + send** | No — drags `Connection`/`sendRawTransaction`/serialization surface | Weaker — invites tx-object signing, not raw-digest discipline | Poor — large surface; pulls send/RPC families the guard rejects | Larger transitive tree | **Large** | Harder (key in `Keypair`) | Harder (send surface present) |

## 3. Recommended option (recommendation only — NOT an implementation)
**Primary recommendation: native WebCrypto Ed25519 (`node:crypto`)**, with **`@noble/curves` (ed25519) as the
fallback** if a WebCrypto Ed25519 gap is hit on the target runtime.
- **Rationale:** zero third-party dependency (smallest supply-chain surface), pure-local sign-only (no network
  surface at all), signs exactly the bytes handed to it (supports strict payload-binding / no-arbitrary-bytes),
  and is trivially confinable to the allowlisted path. `node:crypto` is **not** on the guard's network family
  (`node:net|http|https|dgram|tls`), so it does not trip `node-network-import`; it must still live only in the
  allowlisted path **by policy**.
- **`@noble/curves` fallback** keeps the same sign-only, no-network, audited profile with a tiny focused dep.

## 4. Rejected / deferred options
- **`@solana/web3.js` — rejected for E2-C3.** It bundles transaction building, serialization, `Connection`,
  and send — exactly the surfaces E2-C must NOT introduce. Any future need for it is a **separate** decision
  (E2-F send / later), not part of sign-only E2-C3.
- **`tweetnacl` — deferred/acceptable-but-not-primary.** Works for detached Ed25519 sign, but offers no
  advantage over native WebCrypto and adds a third-party dep; kept as a secondary fallback only.
- **`bs58` and any base58 dep — out of scope here.** Encoding is not signing; not needed for sign-only.

## 5. Conditions for the real E2-C3 (must ALL hold)
- **Real signing inside the allowlisted path only** (`packages/isolated-signer-runtime/src/`); rejected elsewhere.
- **No send / no RPC** in E2-C3 (`tx-send`/`rpc-connection` stay forbidden; sending is E2-F+).
- **No transaction serialization** unless separately and explicitly approved (raw-digest signing only).
- **Sign only after** preflight + readiness (`ready=true`) + audit before/after + custody not
  `DEGRADED`/`unconfigured` — i.e. reuse the existing E2-C0/D/E gate; no new bypass.
- **Arbitrary-bytes signing forbidden** — sign only the digest equal to `approved_payload_digest`.
- **Payload binding mandatory** (`payload_digest===approved_payload_digest`).
- **Approval freshness mandatory** (`approval_age_slots<=max_approval_age_slots`).
- **Audit before/after mandatory** (refs-only, AUDIT_COLUMNS only; no payload/digest/signature/key in audit).
- **Key material never** in repo / `.env` / DB / logs / cache / fixtures; **no key export** (guard
  `allowlisted_but_key_material:*` stays in force inside the path).
- In E2-C3 the key may be a **test/ephemeral key generated at runtime inside the isolated path and never
  persisted** — it must never be committed; real custody/KMS key sourcing remains a **separate** track.

## 6. Required positive isolation tests before any E2-C3 merge
- **Sign-only happy path:** with a valid preflight + readiness + bound digest, a real signature is produced
  **and verifies** against the public key — and `can_send` stays false (no send path exists).
- **Arbitrary-bytes refusal:** signing is refused when `payload_digest !== approved_payload_digest`.
- **Gate enforcement:** no signature when preflight fails / readiness not ready / custody DEGRADED/unconfigured.
- **No key export / no key leak:** key never appears in the return value, audit, logs, or errors (adversarial scan).
- **No send / no RPC:** source contains no `tx-send`/`rpc-connection`/network import; result has no
  bytes/tx/transaction/serialized/raw and no broadcast path.
- **Confinement:** the crypto/signing import exists ONLY under the allowlisted path; guard still passes with
  `allowlist=1` and key material still HARD-forbidden in source.
- **Audit before/after:** every sign attempt audited, refs-only, keys ⊆ AUDIT_COLUMNS.
- **Capabilities:** `capabilities()` may expose `can_sign:true` ONLY within the isolated runtime descriptor if
  approved; the package-level skeleton invariants and no-send stay intact. (Whether to flip any capability is
  itself part of the E2-C3 approval.)

## 7. Governance approvals required before the real E2-C3
- **Explicit, separate approval to introduce the crypto/signing dependency** (or to use `node:crypto`) — this
  is the key gate; nothing is installed by this report.
- **Signing-sensitive → `signer_control` + two-person rule** (per `DR-E2-B3-001`).
- Library choice (WebCrypto vs `@noble/curves`) confirmed at approval time with a supply-chain check.
- Send / mainnet / REAL-LIVE remain **out of scope** and require their own separate decisions.

## 8. Stop conditions
- **Any need for a new SSOT name → STOP → ARCH/SSOT first** (e.g. a new field/enum/command).
- **Any need for real KMS/Vault → STOP; separate KMS PR** (E2-C3 may use a runtime ephemeral/test key in the
  isolated path, never persisted; real custody is its own track).
- **Any need for send / RPC / mainnet / REAL-LIVE → STOP; out of E2-C3** (separate later decisions).
- **Any key material would touch repo/env/db/logs/cache/fixtures → STOP** (forbidden; guard enforces).

## 9. Effect on status
- **No readiness change.** B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`.
- **Real signing not started.** This report is analysis + gate conditions only.
- **First safe next step after this report:** the real **E2-C3** PR (real Ed25519 sign-only inside the
  allowlisted path) — **only** under a new explicit approval and the §5–§7 conditions; or E2-C4 isolation
  tests scaffolding if preferred first.

---

**Confirmations:** Report/governance-only · Real signing not started · No crypto/signing library introduced ·
No dependency installed · No KMS/Vault/KeyManager introduced · No key material introduced · No `ALLOWLIST`
change · No execution authority introduced.
