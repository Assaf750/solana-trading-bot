// Types for intent-ledger.mjs. Names from intents table (DATA §4.4) + SSOT G3/G12.

export interface IntentRecord {
  intent_id: string;
  intent_type: string;            // SSOT G3
  idempotency_key: string;        // SSOT G12
  issuing_brain?: string;
  bundle_status?: string;         // SSOT G3
  failure_type?: string;          // SSOT G3
  execution_wallet_id?: string;
  signer_profile_id?: string;
  request_id?: string;            // SSOT G12
  created_at?: string;
  updated_at?: string;
  /** Internal retry/replacement linkage (DATA §4.4 storage-only). */
  replaces_intent_id?: string | null;
}

export interface CreateResult {
  ok: boolean;
  intent_id?: string;
  reason?: string;
  api_error_code?: 'IDEMPOTENCY_CONFLICT';
  existing_intent_id?: string;
}

export interface UpdateResult {
  ok: boolean;
  reason?: string;
}

export interface AuditSink {
  append(entry: Record<string, unknown>): number;
  list(): Record<string, unknown>[];
}

export interface IntentLedger {
  create(intent: IntentRecord): CreateResult;
  get(intent_id: string): IntentRecord | undefined;
  list(): IntentRecord[];
  updateStatus(intent_id: string, patch?: { bundle_status?: string; failure_type?: string; updated_at?: string }): UpdateResult;
  isTerminal(idOrRecord: string | IntentRecord): boolean;
  createReplacement(originalIntentId: string, replacement: IntentRecord): CreateResult;
  auditEntries(): Record<string, unknown>[];
  readonly size: number;
}

export function assertOrderHasIntent(order: { intent_id?: string } | null | undefined): string;
export function isTerminalBundleStatus(bundle_status: string): boolean;
export function createIntentLedger(opts?: { audit?: AuditSink }): IntentLedger;
