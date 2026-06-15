// @soltrade/positions — book API. Types.
import type { PositionStore } from './store';
import type { ExitPlan } from './exit-rules';

export interface TransitionCheck { ok: boolean; error?: string; }
export function validatePositionTransition(from: string, to: string): TransitionCheck;

export interface ExitResult { ok: boolean; error?: string; realized_usd?: number; closed?: boolean; }
export interface PortfolioSummary {
  simulated: boolean;
  open_positions: number;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
  daily_realized_pnl_usd: number;
  entries_blocked: boolean;
  trade_count: number;
}

export interface PositionsBook {
  // legacy-exact surface
  state(): any;
  openPositions(): any[];
  openCount(): number;
  tokenExposureUsd(mint: string): number;
  leaderExposureUsd(leader: string): number;
  dailyRealized(): number;
  leaderStats(leader: string): any;
  leaderConsecutiveLosses(leader: string): number;
  recordEntry(args: any): any;
  recordExit(args: any): ExitResult;
  setMark(positionId: string, markUsd: number, markStatus?: string): void;
  setEntriesBlocked(blocked: boolean): void;
  markTp1Done(positionId: string): void;
  flagNeedsReconciliation(positionId: string, reason?: any): { ok: boolean; error?: string };
  resolveReconciliation(positionId: string, proceedsUsd: number): ExitResult;
  summary(): PortfolioSummary;
  // canonical API
  createPosition(args: any): any;
  applyFill(fill: any): any;
  closePosition(positionId: string, opts?: { proceeds_usd?: number; fee_usd_est?: number; price_impact_pct?: number; reason?: string }): ExitResult;
  updatePositionMark(positionId: string, markUsd: number, markStatus?: string): { ok: boolean; error?: string };
  computeUnrealizedPnl(position?: any): number;
  computeRealizedPnl(): number;
  deriveExitPlan: typeof import('./exit-rules').deriveExitPlan;
  validatePositionTransition(from: string, to: string): TransitionCheck;
  listOpenPositions(): any[];
  summarizePortfolio(): PortfolioSummary;
}

export function createPositionsBook(opts: {
  store: PositionStore;
  newId: (prefix: string) => string;
  nowIso: () => string;
  simulated?: boolean;
}): PositionsBook;

export type { ExitPlan };
