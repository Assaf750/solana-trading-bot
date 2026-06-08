# E2-C3-3 — Real Signing Wiring Design & Threat Review (report-only)

> **REPORT / DESIGN-ONLY.** No code, no package, no tool, no dependency install, no crypto/signing import, no
> `ALLOWLIST` change, no KMS/Vault, no KeyManager, no key material, no signing/sending, no RPC, no REAL-LIVE.
> References existing artifacts only; introduces no new SSOT/API/DATA/CONFIG name. **This report does NOT change
> readiness status and does NOT wire or perform real signing.** It designs the wiring and sets the gate
> conditions for a *future, separately-approved* E2-C3-4.
>
> **State:** `main` @ `c8de044` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 454/454 tests · mechanism guard
> `allowlist=1 violations=0`.

---

## 1. Current state (read from `main`)
Inside the one allowlisted path (`packages/isolated-signer-runtime/src/`):
- **WebCrypto adapter skeleton** (E2-C3-2): `describeWebcryptoSigningAdapter()` (caps all-false, not wired),
  `probeWebcryptoEd25519Support()` (generates+discards an ephemeral key; never touches private key),
  `attemptSign()` **always fail-closed**. `node:crypto` is referenced as a local capability only.
- **Signing-adapter contract + no-op** (E2-C1): fail-closed `sign()`; never exports keys.
- **Mock signer** (E2-C2): runs only after `preflight_ok`; produces no real signature.
- **Preflight gate** (E2-C0) with **E0 readiness** (E2-E) and **audit before/after** (E2-D).
- **Custody lifecycle wiring** (E2-B) over the custody-provider **stub** (E2-A): fail-closed DEGRADED.
- `capabilities()` all-false; nothing signs; no key material; no send/RPC.

## 2. Proposed real sign-only wiring (DESIGN — not implemented)
A future `createRealSigningPath({ auditLog, custody })` inside the allowlisted path would compose the EXISTING
pieces; it adds no new gate and no bypass:
```
attemptRealSign(input)
  1. gate = createSigningPreflightGate({ auditLog })        // E2-C0/D/E: preflight + readiness + audit before/after
  2. result = gate.evaluate(input)                          // audit BEFORE + AFTER happen here
  3. if (!result.preflight_ok) -> return { ...result }      // fail-closed; NO signature
  4. custody = createIsolatedCustodyLifecycle(...)          // E2-B; provider stub -> DEGRADED today (so step 3 already blocks)
     // (real custody key sourcing is a SEPARATE track; with the stub, this path can never reach signing yet)
  5. // ONLY here, with a bound digest + custody-held key, WebCrypto Ed25519 signs the EXACT approved digest
  6. return { ok:true, signed:true, signature:<bytes>, can_send:false, ... }   // sign-only; never sends
```
- **Key sourcing:** the signing key comes from custody at runtime (never source/repo). With the current
  custody **stub** the path is fail-closed (DEGRADED) and **cannot reach step 5** — i.e. E2-C3-4 can be merged
  and exercised with an ephemeral/test key in-memory only, while real custody/KMS remains a separate track.
- **Composition, not new gates:** reuses `evaluateSigningPreflight`/readiness/audit/custody as-is. No new SSOT
  field, no new command, no allowlist change.

## 3. Exact preconditions before ANY signature (all must hold)
`preflight_ok === true` · `readiness_ready === true` · `risk_approved === true` ·
`signer_profile_status === 'ACTIVE'` · `execution_wallet_status === 'ACTIVE'` · `operating_state === 'ACTIVE'` ·
custody/provider **not** `DEGRADED` · custody/provider **not** `unconfigured` ·
`payload_digest === approved_payload_digest` (payload binding) · approval freshness valid
(`approval_age_slots <= max_approval_age_slots`) · `audit_actor` present · `blockers` empty.
> All of these are already enforced by the existing preflight + readiness gate; E2-C3-4 must NOT weaken any.

## 4. Proposed output envelope (sign-only)
- **Success:** `{ ok:true, signed:true, signature:<Uint8Array/base64 of the Ed25519 signature over the bound
  digest>, can_send:false, intent_id, note:'sign-only; not sent; not REAL-LIVE' }`.
- **Blocked:** the existing fail-closed envelope `{ preflight_ok:false, signed:false, signature:null,
  can_send:false, blockers:[…] }` (+ `recommended_signer_profile_status:'DEGRADED'` where custody unsafe).
- **Invariants:** `can_send:false` always · **no transaction** · **no serialization** · **no RPC** · **no
  REAL-LIVE activation** · no key/private data in the result.

## 5. Threat review
- **Arbitrary-bytes signing forbidden** — sign ONLY the digest equal to `approved_payload_digest`; reject any
  other bytes.
- **Payload-digest binding mandatory** (`payload_digest === approved_payload_digest`).
- **Approval freshness mandatory** (`approval_age_slots <= max_approval_age_slots`).
- **No key export** — key handle stays in custody/WebCrypto; private key never returned/logged/audited;
  WebCrypto private key non-extractable.
- **No key material in repo/`.env`/DB/logs/cache/fixtures** (guard `allowlisted_but_key_material:*` in force).
- **No audit leakage** — audit stays refs-only (AUDIT_COLUMNS); no payload/digest/signature/key in audit.
- **No send / no RPC** — sending is out of E2-C3 (E2-F+).
- **No transaction serialization** — sign-only; no tx object.
- **No mainnet** — sign-only proof is local/testnet; mainnet is a separate decision.

## 6. Required positive isolation tests (before E2-C3-4 merge)
- Every gate failure refuses a signature (preflight/readiness/risk/signer/exec-wallet/operating/custody/
  payload-binding/approval-freshness/missing-audit_actor/blockers).
- Happy path signs ONLY a bound LOCAL payload digest, signature **verifies**, and `can_send:false`.
- Wrong digest refuses; stale approval refuses; readiness blocker refuses; custody DEGRADED/unconfigured
  refuses; missing `audit_actor` refuses (no partial audit).
- Audit before/after on ALL attempts; keys ⊆ AUDIT_COLUMNS; no secrets/payload/signature in audit.
- Output contains no key/raw/private data; no `bytes`/`tx`/`transaction`/`serialized`/`raw` send surface.
- No send/RPC/serialize anywhere; guard still `allowlist=1`; key material HARD-forbidden in source.
- **Capabilities decision explicit:** whether `capabilities()`/a runtime descriptor exposes `can_sign:true`
  (sign-only, never `can_send`) is an explicit part of the E2-C3-4 approval.

## 7. Stop conditions
- Any **KMS/Vault** need → STOP; **separate KMS PR** (E2-C3-4 may use an in-memory ephemeral/test key only,
  never persisted).
- Any **transaction serialization** → STOP.
- Any **send / RPC / mainnet / REAL-LIVE** → STOP (separate decisions).
- Any **new SSOT name** → STOP → ARCH/SSOT first.
- Any **static/persisted key material** → STOP.

## 8. Guard impact review
- **No `ALLOWLIST` change.** Real signing (E2-C3-4) lives ONLY under `packages/isolated-signer-runtime/src/`;
  `node:crypto`/Ed25519 already permitted there (E2-C3-2). `tx-send`/`rpc-connection`/third-party crypto libs
  stay forbidden. The cross-repo mechanism guard in `tools/` stays unchanged; key material HARD-forbidden in
  source even in the allowlisted path.
- The package's local CODE scan already permits `node:crypto`+`Ed25519`; E2-C3-4 may need to permit accessing
  the WebCrypto key handle (e.g. signing) **inside the adapter** — that change, if any, is part of the
  E2-C3-4 review and must keep `private[_-]?key`/`secret[_-]?key`/`keypair`/`mnemonic` literals forbidden.

## 9. First-safe-implementation PR recommendation (NOT started)
**`pr-e2-c3-4-real-signing-wiring-sign-only`** — wire WebCrypto Ed25519 **sign-only** behind the existing
gate (preflight + readiness + audit + custody), signing ONLY a bound digest with an in-memory ephemeral/test
key, `can_send:false`, no send/RPC/serialize/mainnet. **Only under a new explicit approval and §3–§7
conditions.** (Alternatively, E2-C4-style isolation-test scaffolding could land first if preferred.)

## 10. Governance approvals required before E2-C3-4
- **Explicit, separate approval** to wire real signing (this report wires nothing).
- **Signing-sensitive → `signer_control` + two-person rule** (per `DR-E2-B3-001`).
- Decision on whether any capability flips to `can_sign:true` (sign-only; never `can_send`).
- Real custody/KMS key sourcing remains a **separate** track; send/mainnet/REAL-LIVE separate decisions.

## 11. Effect on status
- **No readiness change.** B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`.
- **Real signing not wired / not started.** This report is design + gate conditions only.

---

**Confirmations:** Report/design-only · Real signing wiring not started · No code · No dependency installed ·
No crypto/signing import introduced · No KMS/Vault/KeyManager introduced · No key material introduced · No
`ALLOWLIST` change · No execution authority introduced.
