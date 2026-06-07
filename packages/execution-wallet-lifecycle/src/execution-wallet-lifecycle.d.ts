// Types for execution-wallet-lifecycle.mjs (Gate C / C3). State transitions only — no asset transfer.

export interface LifecycleRequest {
  execution_wallet_id: string;
  permission_role?: string; // SSOT G11 (signer_control required for revoke)
  audit_actor: string;      // SSOT G14 — required to attribute the audit entry
  request_id?: string;
  idempotency_key?: string;
  event_timestamp?: string;
}

export interface LifecycleResult {
  ok: boolean;
  command?: 'drain_execution_wallet' | 'disable_execution_wallet' | 'revoke_execution_wallet';
  execution_wallet_status?: string; // SSOT G15
  reason?: string;
  api_error_code?: 'PERMISSION_DENIED' | 'COMMAND_NOT_ALLOWED_IN_STATE';
  from?: string;
  to?: string;
}

export interface ExecutionWalletLifecycle {
  readonly commands: readonly string[];
  readonly auditLog: unknown; // @soltrade/data createAuditLog() (append-only, in-memory)
  drainExecutionWallet(req: LifecycleRequest): LifecycleResult;
  disableExecutionWallet(req: LifecycleRequest): LifecycleResult;
  revokeExecutionWallet(req: LifecycleRequest): LifecycleResult;
}

export function createExecutionWalletLifecycle(deps: { walletRegistry: unknown; auditLog?: unknown }): ExecutionWalletLifecycle;
export const LIFECYCLE_COMMANDS: readonly string[];
