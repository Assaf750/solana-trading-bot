# @soltrade/execution-wallet-pool (Gate D / D0)

Execution Wallet **Pool view + Assignment Policy** — chooses **which** eligible execution wallet
would take a new entry, under a configurable `wallet_assignment_policy`. **Selection only.**
Deterministic, in-memory, a read-view over the C0 `execution-wallet-registry`.

> **Selection is not execution.** This module does not open, fund, own, transfer, sign, or send
> anything. No asset transfer, no transfer-boundary, no rotation, no sweep, no KeyManager, no key
> material, no RPC/provider, no DB writes, no REAL-LIVE, no execution authority.

## Source of truth
- `docs/01-SSOT.md` G15 (`wallet_assignment_policy`, `execution_wallet_status`, `execution_wallet_id`/`_address`,
  `current_execution_wallet_id`/`entry_execution_wallet_id`, `tracked_wallet_address`) · G2 (`strategy_brain`) · G6 (Hard Risk limits)
- `docs/05-DATA-MODEL.md` §5.4 (`execution_wallet_runtime_eligibility`, read-only projection)
- `docs/03-API-CONTRACT.md` §12.2 (`set_execution_wallet_assignment_policy` — name reference only)

## API
```js
import { createExecutionWalletPool } from '@soltrade/execution-wallet-pool';
import { createExecutionWalletRegistry } from '@soltrade/execution-wallet-registry'; // C0

const pool = createExecutionWalletPool({ walletRegistry });
pool.setAssignmentPolicy('round_robin');
pool.listEligible();                 // ACTIVE-eligible wallets only (projection)
pool.assign({ /* per-policy inputs */ });
// -> { ok, assigned, execution_wallet_id?, wallet_assignment_policy?, reason? }
```

## Eligibility model
A wallet is eligible for a **new entry** iff `walletRegistry.isActionAllowed(id, 'new_entry') === true`,
which by C0's action policy is true **only for `execution_wallet_status === 'ACTIVE'`**. Therefore
`WARMING_UP`, `DISABLED`, `DRAINING`, `RETIRED`, `REVOKED` are **never** selected for new entries.

## Assignment policy (deterministic)
| `wallet_assignment_policy` | behavior | required input |
|---|---|---|
| `round_robin` | cursor over eligible (sorted by id) | — |
| `least_active` | fewest prior selections, tie-break by id | — |
| `per_strategy` | stable index by strategy | `strategy_brain` ∈ {brain_a,brain_b} |
| `per_source_wallet` | stable index by source | `tracked_wallet_address` |
| `manual_assignment` | caller-chosen wallet, must be eligible | `execution_wallet_id` |
| `risk_weighted` | least-loaded eligible, gated by Hard Risk | `hard_risk` = `{ risk_config, measured }` |

## Hard Risk aggregation (mock input only)
`risk_weighted` consumes an **aggregate** mock input `{ risk_config, measured }` (the nine SSOT G6
limits; same shape as `@soltrade/risk-gates`). The budget is **global, not per-wallet** — adding wallets
creates no new budget, so a larger pool **cannot bypass Hard Risk**. Missing/incomplete input →
fail-safe `risk_input_required`; aggregate `measured` ≥ any limit → `hard_risk_exhausted` (no assignment).
No live computation; no exposure is read from chain/provider.

## Failure modes
`no_eligible_execution_wallet` · `invalid_wallet_assignment_policy` · `manual_target_required` ·
`manual_target_not_eligible` · `strategy_brain_required` · `tracked_wallet_address_required` ·
`risk_input_required` · `hard_risk_exhausted`.

## Not in scope (forbidden here, and absent)
No `asset_transfer_intents` / `wallet_rotation_events` / `profit_sweep_events` · no transfer-boundary ·
no actual/token transfer · no transaction building/serialization · no signing/sending · no `KeyManager` ·
no key material · no RPC/Solana/Jupiter/Helius/Jito · no DB writes/migrations · no API/dashboard ·
no REAL-LIVE · no Gate E · no `candidate_*` promotion.
