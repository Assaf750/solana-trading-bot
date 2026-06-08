// Type declarations for @soltrade/custody-provider-contract (Gate E / E2-A).
// Contract/stub only. No live mechanism, no key material, no execution authority.

export type CustodyProviderStatus = 'unconfigured';

export interface CustodyProviderContractDescriptor {
  readonly contract: 'custody-provider';
  readonly version: string;
  readonly can_export_key: false;
  readonly holds_key_material: false;
  readonly can_sign: false;
  readonly can_send: false;
  readonly accepts_key_material_input: false;
  readonly is_live: false;
  readonly status: CustodyProviderStatus;
  readonly operations: readonly string[];
  readonly note: string;
}

export interface CustodyProviderFailClosedResult {
  readonly ok: false;
  readonly status: CustodyProviderStatus;
  readonly operation: string;
  readonly reason: string;
}

export interface UnconfiguredCustodyProvider {
  readonly status: CustodyProviderStatus;
  isConfigured(): false;
  describe(): CustodyProviderContractDescriptor;
  health(): CustodyProviderFailClosedResult;
  use(request?: unknown): CustodyProviderFailClosedResult;
}

export interface CustodyProviderSelectionResult {
  readonly ok: false;
  readonly status: CustodyProviderStatus;
  readonly reason: string;
  readonly provider: UnconfiguredCustodyProvider;
}

export function describeCustodyProviderContract(): CustodyProviderContractDescriptor;
export function createUnconfiguredCustodyProvider(): UnconfiguredCustodyProvider;
export function selectCustodyProvider(selection?: unknown): CustodyProviderSelectionResult;
export function refusesKeyMaterial(input?: unknown): boolean;
export const CUSTODY_PROVIDER_CONTRACT_STATUS: CustodyProviderStatus;
