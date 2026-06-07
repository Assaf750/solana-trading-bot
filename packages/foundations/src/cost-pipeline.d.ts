// Types for cost-pipeline.mjs (ARCHITECTURE §9 CostEstimate, internal).

export interface CostEstimateInput {
  entry_slippage_bps?: number;
  price_impact_bps?: number;
  base_fee_lamports?: number;
  priority_fee_lamports?: number;
  jito_tip_lamports?: number;
  compute_unit_limit?: number;
  compute_unit_price?: number;
  ata_rent_lamports?: number;
  ata_close_recovery?: number;
  est_exit_slippage_bps?: number;
  est_exit_cost?: number;
  p_fill?: number;
  p_exit_success?: number;
  failed_attempt_cost?: number;
  route_failure_cost?: number;
  adverse_selection_pen?: number;
  platform_fee_bps?: number;
  /** Caller-marked stale critical caches (TTL enforced upstream). */
  stale?: string[];
}

export interface CostEstimateResult {
  priceable: boolean;
  reason?: string;
  total_cost_lamports?: number;
  breakdown?: Record<string, number>;
}

export function estimateCost(input: CostEstimateInput): CostEstimateResult;
export const COST_CRITICAL_INPUTS: readonly string[];
