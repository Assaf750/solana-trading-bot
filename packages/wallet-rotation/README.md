# @soltrade/wallet-rotation (Gate D / D3)

Wallet Rotation **orchestration** — a **simulated composite flow** that rotates an execution wallet by
composing C0 (registry), C3 (lifecycle), D1 (asset transfers), and D2 (profit sweep) **via dependency
injection only**. **Simulated / in-memory / deterministic.**

> **Rotation is simulated orchestration only.** No live transfer or sweep, no token transfer, no wallet
> funding, no signer creation, no admission gate, no KeyManager, no key material, no transaction
> building/serialization, no signing/sending, no RPC/provider, no DB writes, no REAL-LIVE, no execution
> authority. Sub-steps reuse the already-merged simulated modules; nothing here moves funds.

## Source of truth
- `docs/01-SSOT.md` G15 (`rotation_trigger`, `wallet_rotation_status`, `rotation_from_/to_execution_wallet_id`, `rotate_execution_wallet`, `complete_wallet_rotation`, `execution_wallet_status`, `asset_transfer_intent_id`) · G11 (`resource_type=wallet_rotation`, errors) · G14 (audit)
- `docs/03-API-CONTRACT.md` §12.4 · `docs/05-DATA-MODEL.md` §4.10 (`wallet_rotation_events`)

## API
```js
import { createWalletRotation } from '@soltrade/wallet-rotation';
const rot = createWalletRotation({ walletRegistry /*C0*/, lifecycle /*C3*/, transfers /*D1*/, sweep /*D2*/, auditLog });
rot.rotateExecutionWallet(req);          // command: rotate_execution_wallet (admin) -> PENDING
rot.start(rotationId, ctx);              // simulated orchestration: PENDING -> IN_PROGRESS (+drain +transfer)
rot.completeWalletRotation(rotationId, ctx); // command: complete_wallet_rotation (admin) -> COMPLETED
rot.simulateFail(rotationId);            // simulated engine hook -> FAILED
```

## Rotation event model
In-memory append-only ledger; each record carries SSOT fields + a storage-only `id` (`rot-<n>`) and the
`asset_transfer_intent_id` recorded at `start`. `wallet_rotation_status`:
`NOT_REQUIRED→PENDING→IN_PROGRESS→COMPLETED|FAILED` (COMPLETED/FAILED terminal).

## Orchestration flow (simulated)
1. `rotateExecutionWallet` (admin) → create event `PENDING`. Validates: from/to exist, neither `REVOKED`,
   **to is `ACTIVE`** (must already be admitted via C2 — no admission here), from is `ACTIVE`, from ≠ to.
2. `start` (simulated step, admin) → `IN_PROGRESS`; drains old wallet via **C3** (`→ DRAINING`); creates the
   asset move via **D1** (`createAssetTransferIntent`, source=old, destination=new, owner=old), recording
   `asset_transfer_intent_id`.
3. `completeWalletRotation` (admin) → `COMPLETED` only when completion requirements hold; transitions old
   wallet `DRAINING → RETIRED` via **C0**.
4. `simulateFail` → `FAILED` (engine hook; from PENDING/IN_PROGRESS).

## Dependency injection
`{ walletRegistry, lifecycle, transfers, sweep, auditLog }` — all injected; the orchestrator never
constructs signers, KeyManagers, providers, or DB clients.

## Completion requirements
- rotation is `IN_PROGRESS`;
- recorded `asset_transfer_intent_id` is `CONFIRMED` (verified via D1; transfer is simulated-confirmed
  externally with `transfers.simulate(id,'CONFIRMED')`);
- if `ctx.require_sweep === true`, `ctx.sweep_event_id` must be `sweep.isConfirmed(...) === true`;
- old wallet (`DRAINING`) is transitioned to `RETIRED`.
Any unmet requirement → reject (rotation stays `IN_PROGRESS`, retryable; never auto-`FAILED`).

## Permission policy
`rotate_execution_wallet` / `start` / `complete_wallet_rotation` require `permission_role === 'admin'`
(no signer creation, so no `signer_control` needed). `simulateFail` is an engine hook (not a command).

## Audit behavior
This module's own append-only in-memory log; one entry per attributed command, success **and** failure;
`command_type` ∈ {`rotate_execution_wallet`, `complete_wallet_rotation`}; `resource_type`/`audit_scope`=`wallet_rotation`.
C3/D1/D2 additionally audit their own sub-commands in their own logs. The rotation events ledger is append-only.

## Failure modes
`audit_actor_required` · `PERMISSION_DENIED` · `invalid_rotation_trigger` · `rotation_from_equals_to` ·
`rotation_wallet_not_found` · `rotation_to_not_active` · `rotation_from_not_active` · `rotation_wallet_revoked` ·
`rotation_not_found` · `rotation_not_pending` · `rotation_not_in_progress` · `drain_failed` ·
`transfer_create_failed` · `asset_transfer_not_confirmed` · `sweep_event_required` · `sweep_not_confirmed` ·
`COMMAND_NOT_ALLOWED_IN_STATE` (terminal).

## Not in scope (forbidden here, and absent)
No live transfer/sweep · no token transfer · no transfer-boundary · no wallet funding · no signer creation ·
no admission gate · no transaction building/serialization · no signing/sending · no `KeyManager` ·
no key material · no RPC/Solana/Jupiter/Helius/Jito · no DB writes/migrations · no API/dashboard ·
no REAL-LIVE · no Gate E · no `candidate_*` promotion.
