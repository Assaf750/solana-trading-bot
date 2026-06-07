// Types for gate-d-evidence.mjs (PR-D4). Evidence harness only — no new runtime feature.

export interface GateDHarness {
  walletRegistry: unknown; // C0
  lifecycle: unknown;      // C3
  transfers: unknown;      // D1
  sweep: unknown;          // D2
  pool: unknown;           // D0
  rotation: unknown;       // D3
}

export interface RotationContext {
  permission_role?: string;
  audit_actor: string;
}

export function createGateDHarness(opts?: { wallets?: Array<Record<string, unknown>>; activate?: string[] }): GateDHarness;
export function runRotationComposite(
  h: GateDHarness,
  opts: { rotate_request: Record<string, unknown>; ctx: RotationContext; withSweep?: boolean }
): Record<string, unknown>;
