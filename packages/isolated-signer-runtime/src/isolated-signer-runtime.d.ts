// Types for isolated-signer-runtime.mjs (Gate E / E2-1). Skeleton only — no keys, no live mechanism.

export interface IsolatedSignerCapabilities {
  can_sign: false;
  can_send: false;
  has_key_material: false;
  live_mechanisms: false;
  allowlisted: false;
  status: string;
}

export interface IsolationBoundaryDescription extends IsolatedSignerCapabilities {
  note: string;
}

export function capabilities(): IsolatedSignerCapabilities;
export function describeIsolationBoundary(): IsolationBoundaryDescription;
export const ISOLATED_SIGNER_RUNTIME_STATUS: string;
