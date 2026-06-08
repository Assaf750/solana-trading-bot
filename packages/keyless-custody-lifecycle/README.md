# @soltrade/keyless-custody-lifecycle (Gate E / E2-0)

Keyless **Custody Lifecycle Model** — an in-memory, mock state machine for the signer custody lifecycle
(`load → use → zeroize`), with fail-closed `DEGRADED`, least-privilege per `signer_profile_id`, and
`revoke`/`disable`/`shutdown`/`panic`. **NO KEYS.**

> **No key material. No KMS/vault. No KeyManager. No crypto/signing library. No signing/sending.**
> Key material is **refused, never stored or returned** (there is none here at all). Sign-like results
> always carry `signed:false`, `signature:null`, `is_valid_on_chain:false`, `can_sign:false`, `can_send:false`.
> No transaction building/serialization, no RPC/provider, no DB writes, no REAL-LIVE, no mechanism-guard
> carve-out (`ALLOWLIST` stays `[]`), no execution authority.

## Source of truth
- `docs/09-THREAT-SECURITY.md` §3 (isolation, audit before/after) · §4 (fail-closed `DEGRADED`, zeroization, least-privilege, revocation)
- `docs/01-SSOT.md` G15 (`signer_profile_id`, `signer_profile_status`, `key_custody_mode`/`isolated_signer`, `revoke_signer_profile`/`disable_signer_profile`) · G11 (`permission_role=signer_control`) · G14 (audit)

## API
```js
import { createKeylessCustodyLifecycle } from '@soltrade/keyless-custody-lifecycle';
const c = createKeylessCustodyLifecycle({ auditLog });
c.requestLoad(req);              // mock load -> loaded/usable (NO key, NO signature)
c.use(req);                      // mock use  -> usable (NO signature)
c.reportCustodyFailure(req);     // -> DEGRADED (fail-closed)
c.revoke(id, signerControlCtx);  // signer_control: simulated zeroize + terminal
c.disable(id, signerControlCtx); // signer_control: unusable
c.zeroize(id, ctx);              // idempotent simulated zeroize
c.shutdown(ctx); c.panic(ctx);   // simulated zeroize of all sessions
```

## Lifecycle internal states (result-model only, NOT SSOT)
`custody_phase ∈ { idle, loaded, degraded, zeroized }` per `signer_profile_id` session. These are internal
result-model states — **not registered in SSOT and not exposed as API/domain fields**.

## Fail-closed behavior
`custody_available !== true` on load/use ⇒ transition to `DEGRADED` (recommend `signer_profile_status=DEGRADED`),
**no load/use**. `signer_profile_status` non-ACTIVE (DISABLED/REVOKED/DEGRADED/unknown) ⇒ reject.
`key_custody_mode !== isolated_signer` ⇒ reject. (Fail-Safe-Not-Fail-Open.)

## Zeroize model
`revoke` (signer_control) ⇒ simulated zeroize + terminal (`zeroized`, unusable); `shutdown`/`panic` ⇒
zeroize all sessions; `zeroize` is **idempotent**. No key exists → zeroize is a state transition + audit
event only.

## Least-privilege model
Every operation's `signer_profile_id` must match its own session; a session for profile A grants nothing
for profile B. Revoked/zeroized → `session_zeroized`; disabled → `session_disabled`.

## Audit behavior
Append-only in-memory (`@soltrade/data createAuditLog`); one entry per attributed lifecycle/security event
(attempt + outcome), success **and** failure; keys ⊆ `AUDIT_COLUMNS`; `resource_type`/`audit_scope`=`signer_profile`;
`command_type`=`revoke_signer_profile`/`disable_signer_profile` for those; missing `audit_actor` ⇒ refuse pre-audit.

## Mock inputs (NOT SSOT fields)
`custody_available` (KMS/vault availability) and the `custody_phase` result-model state are **mock /
internal**, registered nowhere in SSOT/contracts/config/data.

## Failure modes
`invalid_request` · `key_material_not_accepted` · `audit_actor_required` · `missing_signer_profile_id` ·
`invalid_signer_profile_status`/`signer_not_active` · `custody_not_isolated_signer` ·
`custody_unavailable_degraded` · `not_loaded` · `signer_control_required` · `session_zeroized` · `session_disabled`.

## Not in scope (forbidden here, and absent)
No real key custody · no KMS/vault · no KeyManager · no crypto/signing library · no private key/seed/keypair/mnemonic ·
no transaction building/serialization · no signing/sending · no RPC/Solana/Jupiter/Helius/Jito ·
no live transfer/sweep/funding · no DB writes · no API/dashboard · no REAL-LIVE activation ·
no mechanism-guard allowlist/carve-out · no `candidate_*` promotion.
