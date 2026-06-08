# @soltrade/signer-service-boundary (Gate E / E1)

SignerService **Isolation Boundary** — the request/response **contract** for the isolated signing seam.
**Mock / in-memory / deterministic.** It validates a signing request against the Risk / Intent / State /
payload-binding / approval-freshness gates and **always returns a non-signature envelope**.

> **No real signing. No key material. No execution authority.** The boundary NEVER signs, NEVER sends,
> builds no transaction, performs no serialization, imports no crypto/signing library, has no
> KeyManager/KMS, holds no private key/seed/keypair (refuses it), and makes no RPC/provider call.
> Every result is `signed:false`, `signature:null`, `is_valid_on_chain:false`, `can_sign:false`, `can_send:false`.

## Source of truth
- `docs/00-ARCHITECTURE.md` §4.3 (SignerService isolation) · `docs/09-THREAT-SECURITY.md` §3 (isolation model, payload binding, approval freshness, audit before/after)
- `docs/01-SSOT.md` G1 (`operating_state`) · G10 (`real_live_config_valid`) · G11 (`resource_type=signer_profile`, audit) · G15 (`signer_profile_status`, `execution_wallet_status`)

## API
```js
import { createSignerServiceBoundary } from '@soltrade/signer-service-boundary';
const sb = createSignerServiceBoundary({ auditLog });
sb.capabilities();        // { can_sign:false, can_send:false, mock:true }
sb.requestSign(req);      // { signed:false, signature:null, is_valid_on_chain:false, can_sign:false, can_send:false, contract_valid, refusal_reason? }
```

## Boundary contract
Always-`false` envelope (`signed`/`signature`/`is_valid_on_chain`/`can_sign`/`can_send`) + `contract_valid`
(did all gates pass?) + `refusal_reason?` + echoed `intent_id`/`idempotency_key`. **`contract_valid:true`
never means a signature was produced** — it only reports that, in a real system, the request would be
eligible to enter the isolated SignerService.

## Status / Risk / State checks (ordered; no signing before any)
key material refused → `intent_id` present → `idempotency_key` present → **Risk** (`risk_approved===true`)
→ **State** (`signer_profile_status==='ACTIVE'` · `execution_wallet_status==='ACTIVE'` ·
`operating_state==='ACTIVE'` · `real_live_config_valid===true`) → payload binding → approval freshness.
Any non-ACTIVE/invalid/missing input ⇒ refuse (fail-safe).

## Payload binding (mock)
`payload_digest === approved_payload_digest` — **opaque mock reference strings, no hashing, no crypto
library**. Missing ⇒ `payload_binding_missing`; mismatch ⇒ `payload_binding_mismatch`.

## Approval freshness (mock)
Numeric `approval_age_slots ≤ max_approval_age_slots` — **mock, no blockhash, no RPC**. Missing ⇒
`approval_freshness_missing`; stale ⇒ `approval_stale`.

## Audit behavior
Append-only in-memory (`@soltrade/data createAuditLog`). **Two entries per attributed attempt** — before
(`signer_request_before:intent=<id>`) and after (`signer_request_after:contract_valid` /
`:refused:<reason>`). Keys ⊆ `AUDIT_COLUMNS`; `resource_type`/`audit_scope`=`signer_profile`; `intent_id`
carried inside `audit_reason` (no `intent_id` audit column). Missing `audit_actor` ⇒ refuse before any audit.

## Mock contract inputs (NOT SSOT fields)
`risk_approved`, `payload_digest`/`approved_payload_digest`, `approval_age_slots`/`max_approval_age_slots`
are **mock inputs** representing existing concepts; per `09-THREAT §3` digest/fingerprint and approval-TTL
are implementation/security concepts, not SSOT fields. None is registered in SSOT/contracts/config/data.

## Failure modes
`invalid_request` · `audit_actor_required` · `key_material_not_accepted` · `missing_intent_id` ·
`missing_idempotency_key` · `risk_not_approved` · `invalid_signer_profile_status`/`signer_not_active` ·
`invalid_execution_wallet_status`/`execution_wallet_not_active` · `invalid_operating_state`/`operating_state_not_active` ·
`real_live_config_invalid` · `payload_binding_missing`/`payload_binding_mismatch` ·
`approval_freshness_missing`/`approval_stale`.

## Not in scope (forbidden here, and absent)
No real signing/sending · no crypto/signing library · no KeyManager/KMS/vault · no key custody ·
no private key/seed/keypair/mnemonic · no transaction building/serialization · no RPC/Solana/Jupiter/Helius/Jito ·
no live transfer/sweep/funding · no DB writes · no API/dashboard · no REAL-LIVE activation ·
no mechanism-guard allowlist/carve-out (H3 stays `allowlist=0`) · no `candidate_*` promotion.
