# @soltrade/isolated-signer-runtime (Gate E) — E2-1 skeleton + E2-B STUB WIRING

The **isolated-signer path** (`DECLARED_ALLOWLIST_PATHS`, PR-H4; **activated** in `ALLOWLIST` by B8,
`DR-E2-B8-001`). It contains the E2-1 **skeleton** (capabilities all-false) and the E2-B custody lifecycle
**WIRING over a STUB provider**.

> **This is stub wiring, NOT a KMS integration and NOT signing.** No real custody provider, no KMS/secret-vault,
> no KeyManager, no key custody, no private key/seed/keypair/mnemonic, no crypto/signing library, no transaction
> building/serialization, no signing/sending, no RPC/provider, no live transfer/sweep/funding, no DB writes, no
> REAL-LIVE activation, no execution authority. **No signature is ever produced.**

## E2-B custody lifecycle wiring (stub provider)
`createIsolatedCustodyLifecycle({ auditLog })` wires the keyless custody lifecycle (E2-0,
`@soltrade/keyless-custody-lifecycle`) to the custody provider **contract/stub** (E2-A,
`@soltrade/custody-provider-contract`). The provider is **always `unconfigured`**, so:
- **Fail-closed:** `requestLoad`/`use` can never succeed — they return `{ ok:false }` with
  `refusal_reason:'custody_unavailable_degraded'` and `recommended_signer_profile_status:'DEGRADED'`.
- **Least-privilege:** operations are scoped per `signer_profile_id` (delegated to the keyless lifecycle);
  one profile never grants another.
- **Zeroization:** idempotent `zeroize`; `revoke`/`shutdown`/`panic` zeroize simulated state.
- **Key-material refusal:** PEM/base58/mnemonic/`secret`/`private`/`seed`/`keypair`-shaped input is refused
  (via the contract's `refusesKeyMaterial` + the keyless gate); never stored or returned.
- **Capabilities stay all-false:** `describeCustodyLifecycle()` reports `can_sign:false`, `can_send:false`,
  `has_key_material:false`, `provider_status:'unconfigured'`.

## E2-C0 signing preflight gate (mock / no signing)
`evaluateSigningPreflight(input)` / `createSigningPreflightGate({ auditLog })` evaluate whether the theoretical
preconditions for signing hold — **without signing**. They check `risk_approved`, `real_live_config_valid`,
`signer_profile_status==='ACTIVE'`, `execution_wallet_status==='ACTIVE'`, `operating_state==='ACTIVE'`, custody
not `degraded`/`unconfigured`, payload-digest binding (mock), approval freshness (mock), and presence of
`intent_id`/`idempotency_key`. Each failure adds a `blocker`. The result is a **non-signing envelope**:
`{ preflight_ok, can_attempt_signing:false, signed:false, signature:null, can_send:false, blockers:[…] }`.
**Even when `preflight_ok:true`, it never signs or sends** — real signing requires a separate E2-C approval.
Key-material-shaped input is refused. No crypto, no serialization, no key.

### E2-C3-4 real signing path — SIGN-ONLY (gated; ephemeral test key; no send/RPC/REAL-LIVE)
`createRealSigningPath({ auditLog }).attemptSign(input, signerKey)` produces a WebCrypto **Ed25519 signature
over the EXACT approved, bound digest** — and only that — behind the existing gate (preflight + readiness +
audit before/after + custody). It **never sends**, never builds/serialises a transaction, never calls RPC, and
never activates REAL-LIVE (`can_send:false` always). The signing key is an **ephemeral, non-extractable**
WebCrypto handle **supplied by the caller (test-mode input)**; this module never generates, persists, exports,
or literalises a key, and never reads a private key as a property. With the production custody stub the
preflight is fail-closed (DEGRADED), so this path cannot reach signing in production; real custody/KMS key
sourcing is a separate track. Arbitrary-bytes signing is structurally impossible (only `approved_payload_digest`
is signed). Audit before/after on every attempt (keys ⊆ `AUDIT_COLUMNS`; no signature/digest/key in audit).
`describeRealSigningPath()` reports `can_sign:true` **only locally** (sign-only, test-gated); the **global
`capabilities()` stays all-false**. This is **test/ephemeral key only — no KMS, no send, no mainnet, not
REAL-LIVE.**

### E2-C3-2 WebCrypto sign-only adapter skeleton (skeleton only, NOT wired)
`createWebcryptoSigningAdapter()` / `describeWebcryptoSigningAdapter()` / `probeWebcryptoEd25519Support()` add a
**skeleton** that references WebCrypto (`node:crypto`) as a **local capability** only. The descriptor reports
all execution caps `false` and `wired_to_custody:false`, `wired_to_preflight:false`. `attemptSign()` is
**always fail-closed** (`signed:false`, `signature:null`, `can_send:false`, reason
`skeleton_not_wired_to_custody_preflight`) and refuses key-material input. `probeWebcryptoEd25519Support()`
only checks support by generating and **discarding** an ephemeral key — it never accesses, returns, or exports
a private key, and never signs a project payload. **No third-party crypto dependency, no KMS/Vault, no
KeyManager, no custody/preflight wiring, no transaction/serialize/send/RPC.** `capabilities()` stays all-false.
The actual ephemeral sign/verify proof lives in tests. Real project signing remains a separate **E2-C3**
approval.

### E2-C3-1 native WebCrypto Ed25519 probe (test-only capability check, NOT E2-C3)
A **test-only** probe (`test/webcrypto-signing-probe.test.mjs`) checks whether `node:crypto.webcrypto.subtle`
supports Ed25519 and, if so, that an **ephemeral** key generated in test memory can sign+verify a **local test
payload** (and reject a tampered one). It is **not** E2-C3 implementation: no project/transaction signing, no
custody/preflight wiring, no dependency, no persisted/static key material, no key export (private key is
non-extractable), no `src` change, and `capabilities()` stays all-false. If Ed25519 is unsupported in the
environment, the probe records that a fallback (`@noble/curves`) will be needed later and **does not fail the
suite**. Real signing remains a separate **E2-C3** approval.

### E2-C2 mock signer adapter wiring (mock only, no real signing)
`createMockSignerAdapter({ auditLog })` wires the preflight gate (preflight + readiness + audit before/after)
to the signing-adapter **contract** (`@soltrade/signing-adapter-contract`). `attemptMockSign(input)` runs the
**mock** branch **only after `preflight_ok===true`**, and even then produces **no real signature**
(`signed:false`, `signature:null`, `can_send:false`, `mock:true`, `adapter_status:'mock'`). On any preflight
failure it returns the blockers and never "succeeds". The contract's no-op adapter stays fail-closed
throughout (`contract_noop_ok:false`). No crypto, no key, no KMS, no send, no serialization; key-material
input is refused. Real signing requires a separate **E2-C3** approval.

### E2-E readiness integration + fail-closed `DEGRADED` (gate only, no REAL-LIVE)
The preflight now consumes the **E0 real-live readiness evaluator** (`@soltrade/real-live-readiness`) as a
**hard precondition**: if readiness is not ready (any readiness blocker), the preflight adds `readiness_not_ready`
and fails — no signing, no sending. Unsafe custody (`degraded` / `unconfigured` / unknown provider) is
fail-closed and the envelope carries `recommended_signer_profile_status:'DEGRADED'`. Readiness inputs are
**mock/result-model only**. This is a readiness **gate** — it never activates REAL-LIVE and never calls
`activate_real_live`. The envelope invariants are unchanged: `signed:false`, `signature:null`, `can_send:false`,
no bytes/tx/serialized/raw.

### E2-D audit before/after (evidence only, no signing)
`createSigningPreflightGate({ auditLog })` records **before + after** the preflight for **every** attempt
(success and refusal), append-only, **refs only**: `resource_type`/`audit_scope='signer_profile'`,
`audit_actor`, `audit_reason` (carries the outcome + `intent_id`/`signer_profile_id` as identifier refs),
and `request_id`/`idempotency_key` when present. Entries use **only `AUDIT_COLUMNS`** — no new audit field —
and contain **no secrets, no raw payload, no payload digest, no transaction bytes, no signature**. With an
`auditLog` configured, a missing `audit_actor` is **fail-closed with no append** (no partial entry). This is
audit evidence around a non-signing preflight — **not** real signing.

## Allowlist status — activated for THIS path only (B8)
`ALLOWLIST = ['packages/isolated-signer-runtime/src/']` (one path, no wildcard). Live-mechanism checks are
exempt **only here**; **key material in source stays HARD-forbidden** (`allowlisted_but_key_material:*`), and
every other path stays fail-closed. This PR adds **no** live mechanism — only stub wiring.

## Surface
```js
import { capabilities, describeIsolationBoundary,
         createIsolatedCustodyLifecycle, describeCustodyLifecycle } from '@soltrade/isolated-signer-runtime';

capabilities();              // { can_sign:false, can_send:false, has_key_material:false, live_mechanisms:false, allowlisted:false, status:'skeleton' }
describeCustodyLifecycle();  // { status:'stub_wiring', provider_status:'unconfigured', can_sign:false, can_send:false, has_key_material:false, ... }

const lc = createIsolatedCustodyLifecycle({ auditLog });
lc.requestLoad({ audit_actor:'op', signer_profile_id:'sp1', signer_profile_status:'ACTIVE', key_custody_mode:'isolated_signer' });
// -> { ok:false, refusal_reason:'custody_unavailable_degraded', recommended_signer_profile_status:'DEGRADED', ... }
```
There is no `sign`/`send`/`serialize`/`loadKey`/`KeyManager` surface and no signature is produced.

## Source of truth
- `docs/00-ARCHITECTURE.md` §4.3 (SignerService isolation) · `docs/09-THREAT-SECURITY.md` §3/§4/§7 (isolation, fail-closed DEGRADED, zeroization, least-privilege)
- `CONTRIBUTING.md` §5.1 (mechanism guard PR-H2/H3/H4 + B8 activation)

## Not in scope (forbidden here, and absent)
No real provider integration · no KMS/vault · no KeyManager · no key custody · no key material ·
no crypto/signing library · no transaction building/serialization · no signing/sending ·
no RPC/Solana/Jupiter/Helius/Jito · no DB writes · no API/dashboard · no REAL-LIVE · no `candidate_*` promotion ·
no `ALLOWLIST`/allowlist-path change.

## Next steps (each a separate, explicitly-approved PR)
E2-C signing implementation · E2-D audit before/after · E2-E readiness + fail-closed `DEGRADED` ·
E2-F testnet-only proof · E2-G closure. **REAL-LIVE activation is a separate later decision.**
