// @soltrade/positions — pure exit-decision helpers. Types.

export function trailingStopHit(args: { pnlPct: number; peakPct: number; trailingPct: number }): boolean;
export function firstTierHit(args: { pnlPct: number; tp1Pct: number; done?: boolean }): boolean;
export function breakevenStopHit(args: { pnlPct: number; tp1Done?: boolean; breakevenAfterTp1?: boolean }): boolean;

export interface ExitPlan { shouldExit: boolean; fraction: number; reason: string | null; }
export function deriveExitPlan(args: {
  pnlPct?: number; peakPct?: number; trailingPct?: number;
  tp1Pct?: number; tp1Done?: boolean; tp1SellPct?: number;
  breakevenAfterTp1?: boolean; tpPct?: number; slPct?: number;
}): ExitPlan;
