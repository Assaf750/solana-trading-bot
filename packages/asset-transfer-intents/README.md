# @soltrade/asset-transfer-intents (Gate D / D1)

Asset Transfer **Intent state machine** + **simulated ownership flip**. An intent ledger over
`asset_transfer_status` that models moving ownership of a position's asset between execution wallets.
**Simulated / in-memory / deterministic.**

> **No live transfer.** There is no token transfer, no transfer-boundary, no transaction
> building/serialization, no signing/sending, no RPC/provider, no DB writes, no KeyManager,
> no key material, no rotation, no sweep, no REAL-LIVE, no execution authority.
> **Ownership flips only on `CONFIRMED`.**

## Source of truth
- `docs/01-SSOT.md` G15 (`asset_transfer_intent_id`, `asset_transfer_status`, `source_/destination_execution_wallet_id`, `position_owner_wallet_id`) · G11 (`create_/cancel_asset_transfer_intent`, `resource_type=asset_transfer`, error codes) · G14 (audit)
- `docs/03-API-CONTRACT.md` §12.3 · `docs/05-DATA-MODEL.md` §4.9

## State machine
```
create -> PENDING
PENDING   -> SUBMITTED | FAILED | CANCELLED
SUBMITTED -> CONFIRMED | FAILED | CANCELLED
CONFIRMED | FAILED | CANCELLED  (terminal)
```
`create`/`cancel` are **admin commands**. `SUBMITTED`/`CONFIRMED`/`FAILED` are **engine/chain-driven**
status updates modelled by `simulate(intentId, toStatus)` — SSOT exposes no submit/confirm command;
only create/cancel are commands.

## Ownership flip
`position_owner_wallet_id` = `source_execution_wallet_id` until `CONFIRMED`, then
`destination_execution_wallet_id`. **The flip happens only on reaching `CONFIRMED`.** `FAILED`/`CANCELLED`
never flip ownership. `create` requires `position_owner_wallet_id === source` and `source !== destination`.

## Idempotency
`idempotency_key` and explicit `asset_transfer_intent_id` are unique; a duplicate → `IDEMPOTENCY_CONFLICT`.
Auto-ids are a deterministic in-memory counter (`ati-<n>`); no clock, no randomness.

## Permission policy
`create_asset_transfer_intent` / `cancel_asset_transfer_intent` require `permission_role === 'admin'`
(ownership transfer is higher-sensitivity than a normal trade; not `operator`). `simulate` is an engine
hook (not a command, not user-attributed).

## Audit behavior
Append-only in-memory (`@soltrade/data createAuditLog`); one entry per **attributed command**
(create/cancel), success **and** failure; keys ⊆ `AUDIT_COLUMNS`; `resource_type`/`audit_scope`=`asset_transfer`.
A command without `audit_actor` is rejected before any effect (no append).

## cancel semantics
`PENDING` → direct cancel. `SUBMITTED` → **simulated** cancel only (`simulated_cancel_after_submitted: true`);
this does **not** imply an on-chain cancel. `CONFIRMED`/`FAILED`/`CANCELLED` → terminal → `COMMAND_NOT_ALLOWED_IN_STATE`.

## Failure modes
`audit_actor_required` · `PERMISSION_DENIED` (admin_required) · `IDEMPOTENCY_CONFLICT` ·
`source_and_destination_required` · `source_equals_destination` · `source_not_current_owner` ·
`destination_not_eligible` (when C0 registry injected — destination must be `ACTIVE`) ·
`asset_transfer_intent_not_found` · `COMMAND_NOT_ALLOWED_IN_STATE`.

## Not in scope (forbidden here, and absent)
No live/token transfer · no transfer-boundary · no `wallet_rotation_events` / `profit_sweep_events` ·
no transaction building/serialization · no signing/sending · no `KeyManager` · no key material ·
no RPC/Solana/Jupiter/Helius/Jito · no DB writes/migrations · no API/dashboard · no REAL-LIVE ·
no Gate E · no `candidate_*` promotion.
