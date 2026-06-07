// Types for paper-execution-adapter.mjs. PAPER/test harness only.

import type { IntentLedger } from '../../intent-ledger/src/intent-ledger';
import type { PositionLifecycle } from '../../position-lifecycle/src/position-lifecycle';
import type { SignerBoundary } from '../../signer-boundary/src/signer-boundary';

export interface PaperOrder {
  intent_id?: string;
  [k: string]: unknown;
}

export interface PaperContext {
  risk_config?: Record<string, number>;
  measured?: Record<string, number>;
  ev_gate_mode?: 'strict' | 'warning_only';
  signer_profile_id?: string;
  signer_profile_status?: string;
  key_custody_mode?: string;
  position_id?: string;
  to_state?: string;
  cost?: Record<string, unknown>;
  inject_failure?: string; // a SSOT G3 failure_type to deterministically simulate
}

export interface PaperResult {
  mode: 'paper';
  executed: false;
  is_valid_on_chain: false;
  signed: false;
  signature: null;
  intent_id: string | null;
  note: string;
  simulated: boolean;
  blocked_by?: 'intent_ledger' | 'risk_gates' | 'position_lifecycle' | 'simulator';
  reason?: string;
  risk?: unknown;
  signer?: unknown;
  lifecycle?: unknown;
  simulated_fill?: { simulated: true; is_valid_on_chain: false; total_cost_lamports: number };
  failure?: { simulated: true; failure_type?: string; reason?: string };
}

export interface PaperExecutionAdapter {
  simulate(order?: PaperOrder, ctx?: PaperContext): PaperResult;
}

export function createPaperExecutionAdapter(deps?: {
  ledger?: IntentLedger;
  lifecycle?: PositionLifecycle;
  signer?: SignerBoundary;
}): PaperExecutionAdapter;
