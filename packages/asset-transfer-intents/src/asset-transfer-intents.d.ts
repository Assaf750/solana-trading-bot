// Types for asset-transfer-intents.mjs (Gate D / D1). Simulated state machine — no live transfer.

export interface CreateTransferRequest {
  asset_transfer_intent_id?: string;
  source_execution_wallet_id: string;
  destination_execution_wallet_id: string;
  position_owner_wallet_id: string; // current owner; must equal source
  permission_role?: string;         // 'admin' required (SSOT G11 / API §12.3)
  audit_actor: string;              // SSOT G14
  idempotency_key?: string;
  request_id?: string;
}

export interface PermissionContext {
  permission_role?: string;
  audit_actor: string;
  idempotency_key?: string;
  request_id?: string;
}

export interface TransferResult {
  ok: boolean;
  reason?: string;
  api_error_code?: 'PERMISSION_DENIED' | 'COMMAND_NOT_ALLOWED_IN_STATE' | 'IDEMPOTENCY_CONFLICT';
  asset_transfer_intent_id?: string;
  asset_transfer_status?: string;
  position_owner_wallet_id?: string;
  simulated_cancel_after_submitted?: boolean;
  from?: string;
  to?: string;
}

export interface AssetTransferRecord {
  asset_transfer_intent_id: string;
  asset_transfer_status: string;
  source_execution_wallet_id: string;
  destination_execution_wallet_id: string;
  position_owner_wallet_id: string;
}

export interface AssetTransferIntents {
  createAssetTransferIntent(req: CreateTransferRequest): TransferResult;
  cancelAssetTransferIntent(asset_transfer_intent_id: string, ctx: PermissionContext): TransferResult;
  simulate(asset_transfer_intent_id: string, toStatus: string): TransferResult; // simulated engine/chain update
  readonly auditLog: unknown;
  get(asset_transfer_intent_id: string): AssetTransferRecord | undefined;
  ownerOf(asset_transfer_intent_id: string): string | undefined;
  list(): AssetTransferRecord[];
  isTerminal(asset_transfer_intent_id: string): boolean;
  readonly size: number;
}

export function isTerminalTransferStatus(status: string): boolean;
export function createAssetTransferIntents(deps?: { walletRegistry?: unknown; auditLog?: unknown }): AssetTransferIntents;
export const ASSET_TRANSFER_TRANSITIONS: Readonly<Record<string, readonly string[]>>;
