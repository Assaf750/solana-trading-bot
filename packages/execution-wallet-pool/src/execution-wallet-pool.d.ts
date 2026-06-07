// Types for execution-wallet-pool.mjs (Gate D / D0). Selection only — no transfer/rotation/sweep.

export interface HardRiskInput {
  risk_config: Record<string, number>; // nine SSOT G6 Hard Risk limits
  measured: Record<string, number>;    // aggregate measured per dimension (same nine names)
}

export interface AssignRequest {
  wallet_assignment_policy?: string;   // SSOT G15 (overrides the active policy)
  execution_wallet_id?: string;        // manual_assignment target
  strategy_brain?: string;             // per_strategy key (SSOT G2)
  tracked_wallet_address?: string;     // per_source_wallet key (SSOT G15)
  hard_risk?: HardRiskInput;           // risk_weighted mock input (aggregate; required)
}

export interface AssignResult {
  ok: boolean;
  assigned: boolean;
  execution_wallet_id?: string;
  wallet_assignment_policy?: string;
  reason?: string;
}

export interface EligibleWallet {
  execution_wallet_id: string;
  execution_wallet_address: string | null;
  execution_wallet_status: string;
}

export interface ExecutionWalletPool {
  readonly SET_POLICY_COMMAND: 'set_execution_wallet_assignment_policy';
  setAssignmentPolicy(value: string): { ok: boolean; wallet_assignment_policy?: string; reason?: string };
  getAssignmentPolicy(): string | null;
  listEligible(): EligibleWallet[];
  isEligible(execution_wallet_id: string): boolean;
  assign(req?: AssignRequest): AssignResult;
}

export function createExecutionWalletPool(deps: { walletRegistry: unknown }): ExecutionWalletPool;
export const WALLET_ASSIGNMENT_POLICIES: readonly string[];
