// Types for profit-sweep.mjs (Gate D / D2). Simulated, owner-bound, candidate read-model. No live sweep.

export interface SweepConfig {
  candidate_balance_reconciliation_required?: boolean; // G36, default true
  candidate_profit_sweep_confirmation_required?: boolean; // G36, default true
  candidate_auto_sweep_enabled?: boolean; // G36, default false
}

export interface SweepRequest {
  execution_wallet_id: string;
  position_owner_wallet_id: string;
  settlement_wallet_id?: string;
  settlement_wallet_address?: string;
  profit_sweep_policy: string;            // SSOT G15
  profit_sweep_interval_ms?: number;
  candidate_profits_available_to_sweep?: number;
  candidate_execution_wallet_balance?: number;
  candidate_settlement_wallet_balance?: number;
  candidate_balance_provenance?: string;             // on_chain | derived
  candidate_balance_reconciliation_status?: string;  // reconciled | pending | mismatch
  permission_role?: string;               // 'admin' required
  audit_actor: string;                    // SSOT G14
  request_id?: string;
}

export interface CandidateSweepEvent {
  id: string;
  resource_type: 'profit_sweep';
  profit_sweep_policy: string;
  execution_wallet_id: string;
  position_owner_wallet_id: string;
  settlement_wallet_id: string | null;
  settlement_wallet_address: string | null;
  candidate_profits_available_to_sweep: number;
  candidate_execution_wallet_balance: number | null;
  candidate_settlement_wallet_balance: number | null;
  candidate_balance_provenance: string;
  candidate_balance_reconciliation_status: string;
}

export interface SweepResult {
  ok: boolean;
  reason?: string;
  api_error_code?: 'PERMISSION_DENIED';
  simulated?: boolean;
  executed?: boolean;
  eligible?: boolean;
  requires_confirmation?: boolean;
  profit_sweep_policy?: string;
  profit_sweep_interval_ms?: number | null;
  candidate_sweep_event?: CandidateSweepEvent;
}

export interface ProfitSweep {
  sweepProfits(req: SweepRequest): SweepResult;
  simulateConfirm(sweepEventId: string): { ok: boolean; reason?: string; simulated?: boolean; confirmed?: boolean; id?: string };
  readonly auditLog: unknown;
  readonly config: Readonly<Required<SweepConfig>>;
  isConfirmed(sweepEventId: string): boolean;
  candidateSweepEvents(): CandidateSweepEvent[];
  candidateSweepHistory(): CandidateSweepEvent[];
  readonly size: number;
}

export function createProfitSweep(deps?: { walletRegistry?: unknown; auditLog?: unknown; config?: SweepConfig }): ProfitSweep;
