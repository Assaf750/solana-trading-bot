// @soltrade/decision-ledger — ledger API. Types.
import type { IntentStore } from './store';

export interface OkResult { ok: true; [k: string]: any; }
export interface ErrResult { ok: false; error: string; errors?: string[]; }
export type LedgerResult = OkResult | ErrResult;
export interface TransitionCheck { ok: boolean; error?: string; }

export function validateIntentTransition(from: string, to: string): TransitionCheck;

export interface DecisionLedger {
  // legacy-exact primitives
  intentIdFor(parts: string[]): string;
  claimIntent(intentId: string, detail?: any): { ok: boolean; error?: string };
  setIntent(intentId: string, status: string, extra?: any): void;
  getIntent(intentId: string): any | null;
  listIntents(limit?: number): any[];
  pendingIntents(): Array<{ intent_id: string; status: string; signature: string; detail: any }>;
  // canonical lifecycle
  createExecutionIntent(fields: any): LedgerResult;
  markIntentPlanned(id: string, patch?: any): LedgerResult;
  markIntentSigned(id: string, patch?: any): LedgerResult;
  markIntentBroadcast(id: string, patch?: any): LedgerResult;
  markIntentConfirmed(id: string, patch?: any): LedgerResult;
  markIntentFilled(id: string, patch?: any): LedgerResult;
  markIntentFailed(id: string, opts?: { pre_send?: boolean; [k: string]: any }): LedgerResult;
  validateIntentTransition(from: string, to: string): TransitionCheck;
  appendDecisionTrace(intentId: string, entry: { kind?: string; data?: any; [k: string]: any }): LedgerResult;
  getTrace(intentId: string): any[];
}

export function createDecisionLedger(opts: {
  store: IntentStore;
  now?: () => string;
  retryableStatuses?: string[];
}): DecisionLedger;
