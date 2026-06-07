// Types for wallet-rotation.mjs (Gate D / D3). Simulated composite orchestration — no live transfer/sweep.

export interface RotateRequest {
  rotation_trigger: string;                 // SSOT G15
  rotation_from_execution_wallet_id: string;
  rotation_to_execution_wallet_id: string;
  permission_role?: string;                 // 'admin' required
  audit_actor: string;                      // SSOT G14
  request_id?: string;
}

export interface RotationContext {
  permission_role?: string;
  audit_actor: string;
  request_id?: string;
  require_sweep?: boolean;     // runtime orchestration param
  sweep_event_id?: string;    // runtime orchestration param (D2 candidate_sweep_event id)
}

export interface RotationResult {
  ok: boolean;
  reason?: string;
  api_error_code?: 'PERMISSION_DENIED' | 'COMMAND_NOT_ALLOWED_IN_STATE';
  id?: string;
  wallet_rotation_status?: string;
  rotation_from_execution_wallet_id?: string;
  rotation_to_execution_wallet_id?: string;
  asset_transfer_intent_id?: string;
  detail?: string;
  from?: string;
}

export interface RotationRecord {
  id: string;
  resource_type: 'wallet_rotation';
  wallet_rotation_status: string;
  rotation_trigger: string;
  rotation_from_execution_wallet_id: string;
  rotation_to_execution_wallet_id: string;
  asset_transfer_intent_id: string | null;
}

export interface WalletRotation {
  rotateExecutionWallet(req: RotateRequest): RotationResult;
  start(rotationId: string, ctx: RotationContext): RotationResult;          // simulated orchestration step
  completeWalletRotation(rotationId: string, ctx: RotationContext): RotationResult;
  simulateFail(rotationId: string): RotationResult;                          // simulated engine hook
  readonly auditLog: unknown;
  get(rotationId: string): RotationRecord | undefined;
  list(): RotationRecord[];
  isTerminal(rotationId: string): boolean;
  readonly size: number;
}

export function isTerminalRotationStatus(status: string): boolean;
export function createWalletRotation(deps: {
  walletRegistry: unknown; lifecycle: unknown; transfers: unknown; sweep: unknown; auditLog?: unknown;
}): WalletRotation;
export const WALLET_ROTATION_TRANSITIONS: Readonly<Record<string, readonly string[]>>;
