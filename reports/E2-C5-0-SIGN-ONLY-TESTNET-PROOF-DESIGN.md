# E2-C5-0 — Sign-Only Testnet Proof Design & Boundary (report-only)

> **REPORT / DESIGN-ONLY.** No code, no package, no tool, no dependency install, no crypto/signing import, no
> `ALLOWLIST` change, no RPC/send, no transaction serialization, no KMS/Vault, no KeyManager, no key material,
> no mainnet, no REAL-LIVE. References existing artifacts only; introduces no new SSOT/API/DATA/CONFIG name.
> **This report does NOT change readiness status and does NOT execute any testnet/devnet signing or sending.**
> It defines the boundary and designs a *future, separately-approved* E2-C5.
>
> **State:** `main` @ `555955c` · B1–B8 `DECIDED` · aggregate **READY FOR E2 IMPLEMENTATION REVIEW** ·
> `ALLOWLIST=['packages/isolated-signer-runtime/src/']` · 475/475 tests · mechanism guard
> `allowlist=1 violations=0`.

---

## 1. Current state (read from `main`)
- Real **sign-only** path exists in the one allowlisted path (E2-C3-4, `createRealSigningPath`): signs ONLY the
  bound approved digest behind the existing gate (preflight + readiness + audit + custody), with an
  ephemeral non-extractable WebCrypto key supplied per-call; `can_send:false` always.
- **E2-C4** isolation evidence: every gate failure refuses; arbitrary-bytes impossible; no key/audit leak; no
  send/RPC/serialize in `src`; real signing confined to the allowlisted path; global `capabilities()` all-false.
- No KMS/Vault, no key material, no send/RPC, no serialization, no mainnet.

## 2. What "sign-only testnet proof" means (boundary)
A sign-only testnet proof demonstrates that the sign-only path can produce a **valid Ed25519 signature** over a
**testnet/devnet-shaped local payload**, verified **off-chain**, with **nothing sent**:
- **Local / devnet-shaped payload only** — a payload/digest tagged as testnet/devnet; **no mainnet payload**.
- **Off-chain verification only** — verify the signature with the public key in-process; **no chain submission**.
- **No broadcast** · **no RPC** · **no transaction serialization** · **no mainnet** · **`can_send:false`**.
> "Testnet proof" here is a **cryptographic** proof (sign+verify of a testnet-shaped payload), **not** a network
> action. It never touches any RPC endpoint or network.

## 3. Future E2-C5 design (NOT implemented here)
- **Reuse the existing real sign-only path** (`createRealSigningPath`) unchanged — no new signing engine.
- **Testnet/devnet-shaping proof:** the input/digest carries an explicit network tag (e.g. a
  `network: 'devnet'|'testnet'` field on the *test* input, or a digest prefixed with a devnet marker). The
  proof asserts the signed digest corresponds to a testnet/devnet-shaped payload — purely a labelling/derivation
  check in the test; it adds **no** SSOT field unless ARCH/SSOT approves one (a stop condition).
- **Mainnet prevention:** a `network: 'mainnet'` (or mainnet-shaped) input/endpoint MUST be **refused/ignored**
  — the proof signs nothing for mainnet and exposes no endpoint. Preferably enforced as a hard refusal in the
  test harness (and, if any code is added, a fail-closed guard inside the allowlisted path).
- **`can_send:false` preserved:** the sign-only path already pins `can_send:false`; E2-C5 must not add any send.
- **No-send/no-RPC/no-serialize proof:** reuse the E2-C4-style source scans (no `sendTransaction`/`new Connection(`/
  `.serialize(`/network imports) plus result-shape assertions (no `tx`/`serialized`/`raw`/endpoint).
- **Preference: test-only.** The proof should be expressible as tests over the existing path. Any code change is
  tightly scoped, fail-closed, and inside the allowlisted path only.

## 4. Threat review
- **Accidental mainnet** — mainnet-shaped payloads/endpoints MUST be refused; the proof is devnet/testnet-shaped
  only and submits nothing. No endpoint is ever contacted.
- **Hidden RPC/send** — forbidden; source scans assert no `sendTransaction`/`new Connection(`/`fetch(`/network
  imports; `can_send:false`.
- **Transaction serialization creep** — forbidden; no `.serialize(`/`buildTransaction`/tx object; sign-only over
  a digest.
- **Key leakage** — ephemeral non-extractable key, supplied per-call, never returned/exported/persisted; no key
  in output/audit/errors/source (carried from E2-C4).
- **Audit leakage** — audit stays refs-only (AUDIT_COLUMNS); no signature/digest/key in audit.
- **Arbitrary-bytes signing** — structurally impossible; only the bound approved digest is signed.
- **Replay / stale approval** — approval freshness + payload binding enforced by the existing gate; the proof
  must keep these checks (stale/replayed approvals refuse).

## 5. Required tests (before any E2-C5 implementation)
- Sign-only **testnet/devnet-shaped** payload: signature **verifies off-chain**; `can_send:false`.
- **Mainnet-shaped** payload/endpoint: **refused** (no signature, no endpoint exposure).
- Endpoint/RPC fields on input: **refused or ignored** (never used; no network call).
- No `send`/`Connection`/RPC/provider imports; no `.serialize(`/transaction build (source scan).
- `can_send:false` everywhere; output has no `tx`/`serialized`/`raw`/endpoint.
- Audit before/after with **no secrets** (keys ⊆ AUDIT_COLUMNS; no signature/digest/key).
- No key export / no key leak (output/audit/errors/source).
- Wrong digest / stale approval / readiness blocker / custody DEGRADED/unconfigured all **refuse**.

## 6. Stop conditions
- Any **RPC/send** → STOP.
- Any **transaction serialization** → STOP.
- Any **mainnet** payload/endpoint → STOP.
- Any **KMS/Vault** need → STOP; **separate KMS PR** (E2-C5 uses the existing ephemeral/test key model only).
- Any **new SSOT name** → STOP → ARCH/SSOT first (e.g. if a real `network`/endpoint field is proposed).
- Any **static/persisted key material** → STOP.

## 7. Guard impact review
- **No `ALLOWLIST` change.** E2-C5 stays inside the allowlisted path; `node:crypto`/Ed25519 already permitted
  there; `tx-send`/`rpc-connection`/third-party crypto libs stay forbidden everywhere; cross-repo guard in
  `tools/` unchanged; key material HARD-forbidden in source.

## 8. First-safe-implementation PR recommendation (NOT started)
**`pr-e2-c5-1-sign-only-testnet-shaped-proof`** — **test-only (preferred)** or tightly-scoped, fail-closed
implementation inside the allowlisted path: prove the sign-only path signs+verifies a **devnet/testnet-shaped**
payload off-chain, refuses mainnet-shaped payloads/endpoints, keeps `can_send:false`, and contains no
broadcast/RPC/serialization. **No broadcast · no RPC · no mainnet · not started.** Requires a new explicit
approval and §5–§6 conditions.

## 9. Governance approvals required before E2-C5
- **Explicit, separate approval** for E2-C5 (this report executes nothing).
- If E2-C5 introduces any real `network`/endpoint **field/name**, that is **STOP → ARCH/SSOT** first.
- Signing-sensitive scope → `signer_control` + two-person rule (per `DR-E2-B3-001`) if any signing behaviour
  changes.
- **Send / mainnet / REAL-LIVE remain out of scope** and are separate later decisions; KMS/custody-key sourcing
  is a separate track.

## 10. Effect on status
- **No readiness change.** B1–B8 remain `DECIDED`; aggregate remains `READY FOR E2 IMPLEMENTATION REVIEW`.
- **No testnet/devnet signing or sending performed.** Design + boundary + gate conditions only.

---

**Confirmations:** Report/design-only · No testnet execution / no send · No code · No dependency installed · No
crypto/signing import introduced · No RPC/send introduced · No transaction serialization introduced · No
KMS/Vault/KeyManager introduced · No key material introduced · No `ALLOWLIST` change · No execution authority
introduced.
