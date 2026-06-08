// Type declarations for @soltrade/custody-provider-contract (Gate E / E2-A).
// Contract/stub only. No live mechanism, no key material, no execution authority.

export type CustodyProviderStatus = 'unconfigured';

export interface KeyHandleContractDescriptor {
  readonly kind: 'key-handle';
  readonly opaque: true;
  readonly exportable: false;
  readonly can_export_key: false;
  readonly holds_raw_private_key: false;
  readonly accepts_key_material_input: false;
  readonly can_sign: false;
  readonly is_live: false;
  readonly status: CustodyProviderStatus;
  readonly note: string;
}

export interface KeyHandleResolveResult {
  readonly ok: false;
  readonly status: CustodyProviderStatus;
  readonly handle: null;
  readonly can_sign: false;
  readonly can_export_key: false;
  readonly reason: string;
  readonly recommended_signer_profile_status: 'DEGRADED';
}

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
  readonly key_handle: KeyHandleContractDescriptor;
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
  describeKeyHandle(): KeyHandleContractDescriptor;
  health(): CustodyProviderFailClosedResult;
  use(request?: unknown): CustodyProviderFailClosedResult;
  resolveKeyHandle(request?: unknown): KeyHandleResolveResult;
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
export type ProviderAdapterConfigStatus = 'unconfigured' | 'reference_present_no_sdk' | 'invalid_key_material';

export interface ProviderAdapterSkeletonDescriptor {
  readonly contract: 'custody-provider';
  readonly adapter: 'skeleton';
  readonly is_skeleton: true;
  readonly has_sdk: false;
  readonly can_export_key: false;
  readonly holds_raw_private_key: false;
  readonly can_sign: false;
  readonly is_live: false;
  readonly status: CustodyProviderStatus;
  readonly config_status: ProviderAdapterConfigStatus;
  readonly note: string;
}

export interface ProviderAdapterSkeleton {
  readonly is_skeleton: true;
  readonly has_sdk: false;
  readonly config_status: ProviderAdapterConfigStatus;
  isConfigured(): false;
  describe(): ProviderAdapterSkeletonDescriptor;
  describeKeyHandle(): KeyHandleContractDescriptor;
  resolveKeyHandle(request?: unknown): KeyHandleResolveResult;
}

export interface ProviderConfigValidationResult {
  readonly valid: boolean;
  readonly status: 'reference_valid_no_sdk' | 'invalid' | 'invalid_key_material' | CustodyProviderStatus;
  readonly reasons: readonly string[];
  readonly activated: false;
  readonly recommended_signer_profile_status?: 'DEGRADED';
  readonly note?: string;
}

export function refusesKeyMaterial(input?: unknown): boolean;
export function describeKeyHandleContract(): KeyHandleContractDescriptor;
export function resolveCustodyKeyHandle(selection?: unknown): KeyHandleResolveResult;
export function createProviderAdapterSkeleton(config?: unknown): ProviderAdapterSkeleton;
export function validateProviderConfig(config?: unknown): ProviderConfigValidationResult;
export const CUSTODY_PROVIDER_CONTRACT_STATUS: CustodyProviderStatus;
export const CUSTODY_KEY_HANDLE_KIND: 'key-handle';
