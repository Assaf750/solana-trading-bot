// Type declarations for @soltrade/signing-adapter-contract (Gate E / E2-C1).
// Contract/no-op only. No live mechanism, no crypto, no key material, no execution authority.

export type SigningAdapterStatus = 'unconfigured';

export interface SigningAdapterContractDescriptor {
  readonly contract: 'signing-adapter';
  readonly version: string;
  readonly can_sign: false;
  readonly can_send: false;
  readonly holds_key_material: false;
  readonly can_export_key: false;
  readonly is_live: false;
  readonly status: SigningAdapterStatus;
  readonly requires: readonly string[];
  readonly note: string;
}

export interface SigningAdapterFailClosedResult {
  readonly ok: false;
  readonly status: SigningAdapterStatus;
  readonly signed: false;
  readonly signature: null;
  readonly can_send: false;
  readonly reason: string;
}

export interface NoopSigningAdapter {
  readonly status: SigningAdapterStatus;
  isConfigured(): false;
  describe(): SigningAdapterContractDescriptor;
  sign(request?: unknown): SigningAdapterFailClosedResult;
}

export function describeSigningAdapterContract(): SigningAdapterContractDescriptor;
export function createNoopSigningAdapter(): NoopSigningAdapter;
export function signingAdapterRefusesKeyMaterial(input?: unknown): boolean;
export const SIGNING_ADAPTER_CONTRACT_STATUS: SigningAdapterStatus;
