// Types for paper-portfolio.mjs (CANDIDATE-flagged, backend-only). Names from SSOT G22/G28.

export interface SimulatedFill {
  position_ref: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee?: number;
  slippage?: number;
  /** Must not be true — only simulated fills are accepted. */
  is_valid_on_chain?: boolean;
}

export interface MarkContext {
  candidate_mark_status?: string; // SSOT G22 (valid|stale|unavailable|low_confidence|display_only)
  mark?: number;
}

export interface RealizedReadModel {
  simulated: true;
  candidate_realized_pnl: number;
  candidate_fees_total: number;
  candidate_slippage_cost: number;
}

export interface UnrealizedReadModel {
  simulated: true;
  candidate_unrealized_pnl: number | null; // null unless candidate_mark_status === 'valid'
  candidate_mark_status: string | null;
  unrealized_available: boolean;
  reason?: string;
}

export interface PortfolioReadModel extends RealizedReadModel {
  position_ref: string;
  unrealized: UnrealizedReadModel;
  open_quantity: number;
}

export interface PaperPortfolio {
  addSimulatedFill(fill: SimulatedFill): { ok: boolean; reason?: string; simulated?: true };
  getRealized(position_ref: string): RealizedReadModel;
  getUnrealized(position_ref: string, mark?: MarkContext): UnrealizedReadModel;
  getPortfolio(position_ref: string, mark?: MarkContext): PortfolioReadModel;
  positions(): string[];
}

export function createPaperPortfolio(): PaperPortfolio;
export const MARK_STATUS_VALUES: readonly string[];
