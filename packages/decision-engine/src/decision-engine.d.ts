// Types for decision-engine.mjs. Decision DRAFTS only — never executes.

export interface DecisionContext {
  copy_event?: string;            // SSOT G3
  wallet_signal?: boolean;        // internal: a followed-wallet / cluster signal is present
  migration_phase?: string;       // SSOT G1 (brain routing)
  hunt_status?: string;           // SSOT G16 (discovery context)
  ev_metrics?: Record<string, number>;     // measured EV values keyed by G7 threshold names
  ev_gate_config?: Record<string, number>; // SSOT G7 thresholds
  ev_gate_mode?: 'strict' | 'warning_only';
  cost?: Record<string, unknown>; // optional CostEstimate input
}

export interface EvVerdict {
  passed: boolean;
  failed: { name: string; reason: string }[];
  mode: string;
}

export interface DecisionDraft {
  decision: 'recommended' | 'rejected' | 'insufficient_signal';
  recommendation: boolean;
  /** Always false — a recommendation is never executable. */
  is_executable: false;
  /** Always false — never an order object. */
  is_order: false;
  note: string;
  reason: string;
  strategy_brain?: string;        // SSOT G2
  copy_event?: string;            // SSOT G3
  copy_event_category?: 'entry' | 'risk' | 'neutral' | 'wallet_signal';
  ev?: EvVerdict;
  warning?: 'WARNING_CRITICAL';   // SSOT G5
}

export function decideDraft(ctx?: DecisionContext): DecisionDraft;
export const DECISION_VALUES: readonly string[];
