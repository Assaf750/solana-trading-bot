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
