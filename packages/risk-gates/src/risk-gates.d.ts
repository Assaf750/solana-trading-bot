// Types for risk-gates.mjs. Limit names are the nine SSOT G6 Hard Risk fields.

export interface HardRiskViolation {
  limit: string;
  limit_value: number;
  measured_value: number;
}

export interface HardRiskInput {
  risk_config?: Record<string, number>;
  measured?: Record<string, number>;
  ev_gate_mode?: 'strict' | 'warning_only';
}

export interface HardRiskResult {
  decision: 'allow' | 'block';
  violations: HardRiskViolation[];
  missing_limits: string[];
  unverifiable: string[];
  real_live_config_valid: boolean;
  hard_risk_enforced: true;
  api_error_code?: 'HARD_RISK_BYPASS_REJECTED';
  reason?: 'hard_risk_limit_exceeded' | 'hard_risk_limit_missing' | 'hard_risk_unverifiable';
}

export function evaluateHardRisk(input?: HardRiskInput): HardRiskResult;
export const HARD_RISK_LIMIT_NAMES: readonly string[];
export const HARD_RISK_BLOCK_CODE: 'HARD_RISK_BYPASS_REJECTED';
