// Types for gate-c-evidence.mjs (PR-C4). Evidence harness only — no new runtime feature.

export interface GateCHarness {
  walletRegistry: unknown; // C0
  signerRegistry: unknown; // C1
  auditLog: unknown;       // @soltrade/data createAuditLog() (append-only)
  admission: unknown;      // C2
  lifecycle: unknown;      // C3
}

export interface ProvisionInput {
  wallet: Record<string, unknown>;
  signer: Record<string, unknown>;
  request: Record<string, unknown>;
}

export interface ProvisionTrace {
  register: Record<string, unknown>;
  register_signer: Record<string, unknown>;
  activate_signer: Record<string, unknown>;
  status_before_admission?: string;
  admission: Record<string, unknown>;
  status_after_admission?: string;
}

export function createGateCHarness(): GateCHarness;
export function provisionAndAdmit(harness: GateCHarness, input: ProvisionInput): ProvisionTrace;
export function walletStatus(harness: GateCHarness, execution_wallet_id: string): string | undefined;
