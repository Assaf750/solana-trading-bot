// Types for execution-wallet-registry.mjs. Names from SSOT G15 + DATA §4.7. No key material.

export interface ExecutionWalletInput {
  execution_wallet_id: string;
  execution_wallet_address?: string;
  execution_wallet_creation_mode?: 'manual' | 'automatic_policy';
  funding_wallet_id?: string;
  settlement_wallet_id?: string;
}

export interface ExecutionWalletRecord {
  execution_wallet_id: string;
  execution_wallet_address: string | null;
  execution_wallet_status: string; // SSOT G15
  execution_wallet_creation_mode: string;
  funding_wallet_id: string | null;
  settlement_wallet_id: string | null;
}

export interface RegistryResult {
  ok: boolean;
  reason?: string;
  api_error_code?: 'COMMAND_NOT_ALLOWED_IN_STATE';
  execution_wallet_id?: string;
  execution_wallet_status?: string;
  from?: string;
  to?: string;
}

export interface ExecutionWalletRegistry {
  register(input: ExecutionWalletInput): RegistryResult;
  transition(execution_wallet_id: string, toStatus: string): RegistryResult;
  isActionAllowed(execution_wallet_id: string, action: 'new_entry' | 'new_admission' | 'exit' | string): boolean;
  get(execution_wallet_id: string): ExecutionWalletRecord | undefined;
  list(): ExecutionWalletRecord[];
  isTerminal(execution_wallet_id: string): boolean;
  readonly size: number;
}

export function isTerminalWalletStatus(status: string): boolean;
export function createExecutionWalletRegistry(): ExecutionWalletRegistry;
export const EXECUTION_WALLET_TRANSITIONS: Readonly<Record<string, readonly string[]>>;
export const EXECUTION_WALLET_ACTION_POLICY: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
