# @soltrade/execution-wallet-lifecycle (Gate C / C3)

Execution Wallet **lifecycle security commands** — `drain` / `disable` / `revoke`.
Each command is a **state transition only**, gated by `permission_role`, with a **mandatory
append-only in-memory audit** entry. **MOCK / in-memory.**

> **Drain does not transfer assets.** It is a pure status flip to `DRAINING` via the C0 registry —
> no token transfer, no transaction, no draining movement of funds.
> **Revoke is terminal.** **Audit is append-only in-memory.** No execution authority is introduced.

## Source of truth
- `docs/01-SSOT.md` G11 (`command_type`, `permission_role`, `api_error_code`, `resource_type=execution_wallet`)
  · G14 (`audit_actor`, `audit_scope`, `audit_reason`) · G15 (`execution_wallet_status`: `DRAINING`/`DISABLED`/`REVOKED`)
- `docs/03-API-CONTRACT.md` §12.1 (`drain_execution_wallet`/`disable_execution_wallet`/`revoke_execution_wallet`)
- `docs/05-DATA-MODEL.md` §4.5 (append-only `audit_log`) · §4.7 (execution_wallets)

## API
```js
import { createExecutionWalletLifecycle } from '@soltrade/execution-wallet-lifecycle';
import { createExecutionWalletRegistry } from '@soltrade/execution-wallet-registry'; // C0
import { createAuditLog } from '@soltrade/data';

const walletRegistry = createExecutionWalletRegistry();
const auditLog = createAuditLog();
const lc = createExecutionWalletLifecycle({ walletRegistry, auditLog });

lc.drainExecutionWallet({ execution_wallet_id, permission_role, audit_actor });
lc.disableExecutionWallet({ execution_wallet_id, permission_role, audit_actor });
lc.revokeExecutionWallet({ execution_wallet_id, permission_role, audit_actor });
// -> { ok, command?, execution_wallet_status?, reason?, api_error_code? }
// lc.auditLog.list() -> append-only audit entries (one per attributed command)
```

## Commands, transitions, permissions
| command | → `execution_wallet_status` | permission_role |
|---|---|---|
| `drain_execution_wallet` | `DRAINING` | `signer_control` or `admin` |
| `disable_execution_wallet` | `DISABLED` | `signer_control` or `admin` |
| `revoke_execution_wallet` | `REVOKED` (terminal) | **`signer_control` only** |

Transition legality is owned by the C0 `execution_wallet_status` graph (not re-implemented here).
Illegal/terminal transitions return `COMMAND_NOT_ALLOWED_IN_STATE`; insufficient role returns `PERMISSION_DENIED`.

## Audit behavior
One append-only entry per attributed invocation (success **and** failure), keyed only with
`AUDIT_COLUMNS` (G14): `command_type`, `resource_type='execution_wallet'`, `audit_scope='execution_wallet'`,
`audit_actor`, `audit_reason`, `permission_role`, plus `api_error_code` on failure and optional
`request_id`/`idempotency_key`/`event_timestamp` pass-throughs. No clock is read (deterministic).
A command without `audit_actor` is rejected before any transition (`audit_actor_required`).

## Failure modes
`audit_actor_required` (no actor) · `PERMISSION_DENIED` (insufficient role) ·
`execution_wallet_not_found` · `COMMAND_NOT_ALLOWED_IN_STATE` (illegal/terminal transition).

## Not in scope (forbidden here, and absent)
No `asset_transfer` / `wallet_rotation` / `profit_sweep` · no `wallet_assignment_policy` ·
no actual draining transfer / token transfer · no transaction building/serialization ·
no signing/sending · no `KeyManager` · no private key / seed / keypair / mnemonic ·
no RPC / Solana / Jupiter / Helius / Jito · no DB writes / migrations · no API / dashboard ·
no REAL-LIVE · no Gate D/E · no execution adapter changes · no `candidate_*` promotion.
