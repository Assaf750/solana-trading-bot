# @soltrade/profit-sweep (Gate D / D2)

Profit Sweep **orchestration** — `sweep_profits` over `profit_sweep_policy`, owner-bound, with a
reconciliation gate and a **simulated** confirmation step. **Simulated / in-memory / deterministic.**
All balance/sweep figures are **`candidate_*` read-model inputs**, not on-chain truth.

> **Sweep is simulated only.** No actual sweep, no token transfer, no transaction
> building/serialization, no signing/sending, no RPC/provider, no DB writes, no KeyManager, no key
> material, no rotation, no new `asset_transfer_intents`, no REAL-LIVE, no execution authority,
> no UX/API/dashboard exposure, no Opportunity/Radar P&L. **`candidate_` prefixes are preserved.**

## Source of truth
- `docs/01-SSOT.md` G15 (`profit_sweep_policy`, `profit_sweep_interval_ms`, `settlement_wallet_id`/`_address`, `sweep_profits`, `execution_wallet_id`, `position_owner_wallet_id`) · G31 (candidate balance/sweep read-model) · G36 (candidate sweep config) · G11 (`resource_type=profit_sweep`, errors) · G14 (audit)
- `docs/03-API-CONTRACT.md` §12.5 · `docs/05-DATA-MODEL.md` §4.11 (`profit_sweep_events`)

## API
```js
import { createProfitSweep } from '@soltrade/profit-sweep';
const sweep = createProfitSweep({ walletRegistry /* C0, optional */, auditLog, config });
sweep.sweepProfits(req);          // command: sweep_profits (admin)
sweep.simulateConfirm(eventId);   // simulated engine confirmation (not a command)
sweep.candidateSweepEvents();     // append-only ledger of recorded candidate_sweep_event
sweep.candidateSweepHistory();    // confirmed sweeps only
```

## Sweep event model
`sweep_profits` with `profit_sweep_policy = manual` appends one `candidate_sweep_event` (append-only;
carries only SSOT/candidate fields + a storage-only `id`). It is **not final** until confirmed.
`auto_immediate`/`periodic` **do not execute** — they return eligibility/orchestration only.

## Owner-bound rules
Sweep is allowed only from the owning wallet: `execution_wallet_id === position_owner_wallet_id`
(else `not_owner_bound`). When the C0 registry is injected, that wallet must exist and be `ACTIVE`
or `DRAINING` (DRAINING may sweep per G15) — else `execution_wallet_not_sweepable`.

## Reconciliation rules
When `candidate_balance_reconciliation_required` (default `true`), the sweep requires
`candidate_balance_reconciliation_status === 'reconciled'`; `pending`/`mismatch`/invalid →
`reconciliation_not_reconciled`. `candidate_balance_provenance` must be `on_chain`/`derived` →
else `invalid_balance_provenance`.

## Confirmation model
A manual sweep returns `requires_confirmation` (per `candidate_profit_sweep_confirmation_required`,
default `true`). The event is **not confirmed/final** until a **simulated** `simulateConfirm(id)` engine
hook marks it — only then does it enter `candidate_sweep_history`. Confirmation is tracked internally
(not a stored status field) and never moves funds.

## Audit behavior
Append-only in-memory (`@soltrade/data createAuditLog`); one entry per attributed `sweep_profits`
command, success **and** failure; keys ⊆ `AUDIT_COLUMNS`; `resource_type`/`audit_scope`=`profit_sweep`.
`simulateConfirm` is an engine hook (not a command). The events ledger is also append-only.

## Failure modes
`audit_actor_required` · `PERMISSION_DENIED` (admin_required) · `invalid_profit_sweep_policy` ·
`not_owner_bound` · `execution_wallet_not_sweepable` · `invalid_balance_provenance` ·
`reconciliation_not_reconciled` · `no_profits_to_sweep` · `sweep_event_not_found` · `already_confirmed`.

## Candidate usage
Consumes existing **deferred** candidate names with prefix preserved (never promoted/registered):
`candidate_execution_wallet_balance`, `candidate_settlement_wallet_balance`,
`candidate_profits_available_to_sweep`, `candidate_sweep_event`, `candidate_sweep_history`,
`candidate_balance_provenance` {on_chain·derived}, `candidate_balance_reconciliation_status`
{reconciled·pending·mismatch}; config `candidate_balance_reconciliation_required`,
`candidate_profit_sweep_confirmation_required`, `candidate_auto_sweep_enabled`.

## Not in scope (forbidden here, and absent)
No actual/live sweep · no token transfer · no new `asset_transfer_intents` · no `wallet_rotation_events` ·
no transfer-boundary · no transaction building/serialization · no signing/sending · no `KeyManager` ·
no key material · no RPC/Solana/Jupiter/Helius/Jito · no DB writes/migrations · no API/dashboard ·
no UX balance/P&L truth · no Opportunity/Radar P&L · no REAL-LIVE · no Gate E · no `candidate_*` promotion.
