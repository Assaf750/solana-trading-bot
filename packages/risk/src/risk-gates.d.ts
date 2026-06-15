// @soltrade/risk — hard-risk entry gate + risk surface. Types.

export const HARD_RISK_REQUIRED_FIELDS: readonly string[];
export const REJECT_REASON_CODES: readonly string[];

export interface EntryGateArgs {
  cfg: any;
  portfolio: {
    openCount(): number;
    tokenExposureUsd(mint: string): number;
    dailyRealized(): number;
    summary?: () => { realized_pnl_usd?: number; unrealized_pnl_usd?: number };
    leaderExposureUsd?: (leader: string) => number;
  };
  sizeUsd: number;
  tokenMint?: string | null;
  killBlocked: boolean;
  operatingState: string;
  entriesBlocked?: boolean;
  leaderAddress?: string | null;
}
export interface EntryGateResult { allowed: boolean; rejections: string[]; riskRejection: boolean; }
export function checkEntryGates(args: EntryGateArgs): EntryGateResult;

export function validateHardRiskLimits(cfg: any): { ok: boolean; missing: string[] };
export function normalizeRiskResult(r: any): EntryGateResult;

export interface RiskBudgetShape {
  scope: string;
  used_notional_usd: number;
  daily_loss_usd: number;
  within_budget: boolean;
  max_notional_usd?: number;
  remaining_usd?: number;
}
export function deriveRiskBudget(args: {
  cfg: any; portfolio?: any; sizeUsd?: number; tokenMint?: string | null; scope?: string | null;
}): RiskBudgetShape;
