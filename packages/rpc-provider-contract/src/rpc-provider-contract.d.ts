// Type declarations for @soltrade/rpc-provider-contract (Gate E / E2-F-7).
// Contract/fail-closed skeleton only. NOT an RPC client. No live mechanism, no RPC/endpoint/send/broadcast,
// no key material, no execution authority.

export type RpcProviderStatus = 'unconfigured_no_rpc';

export type RpcProviderConfigStatus =
  | 'reference_valid_no_rpc'
  | 'unconfigured_no_rpc'
  | 'invalid'
  | 'invalid_key_material';

export interface RpcProviderContractDescriptor {
  readonly contract: 'rpc-provider';
  readonly version: string;
  readonly configured: false;
  readonly has_rpc: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly accepts_key_material_input: false;
  readonly is_live: false;
  readonly status: RpcProviderStatus;
  readonly operations: readonly string[];
  readonly note: string;
}

export interface RpcProviderConfigValidationResult {
  readonly valid: boolean;
  readonly status: RpcProviderConfigStatus;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
}

export interface RpcReadinessResult {
  readonly ready: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly live_rpc_enabled: false;
  readonly status: RpcProviderStatus;
  readonly reason: 'rpc_provider_unconfigured_no_rpc';
  readonly blockers: readonly string[];
}

export interface FailClosedRpcProvider {
  readonly status: RpcProviderStatus;
  isConfigured(): false;
  describe(): RpcProviderContractDescriptor;
  validateConfig(config?: unknown): RpcProviderConfigValidationResult;
  evaluateReadiness(input?: unknown): RpcReadinessResult;
}

export function describeRpcProviderContract(): RpcProviderContractDescriptor;
export function createFailClosedRpcProvider(): FailClosedRpcProvider;
export function validateRpcProviderConfig(config?: unknown): RpcProviderConfigValidationResult;
export function evaluateRpcReadiness(input?: unknown): RpcReadinessResult;
export function refusesKeyMaterial(input?: unknown): boolean;
export const RPC_PROVIDER_CONTRACT_STATUS: RpcProviderStatus;

// --- PR-E2-F-9: provider registry (contract-only, Helius enabled reference-only, 3 slots, fail-closed, no-live) ---

export const RPC_PROVIDER_MAX_SLOTS: 3;

export interface RpcProviderRegistryDescriptor {
  readonly contract: 'rpc-provider-registry';
  readonly version: string;
  readonly max_provider_slots: 3;
  readonly supported_provider_refs: readonly ['helius'];
  readonly doc_listed_disabled_provider_refs: readonly ['triton', 'yellowstone'];
  readonly configured: false;
  readonly has_rpc: false;
  readonly can_send: false;
  readonly is_live: false;
  readonly status: RpcProviderStatus;
  readonly note: string;
}

export type RpcProviderSlotsStatus =
  | 'unconfigured_no_rpc'
  | 'within_capacity_no_rpc'
  | 'over_capacity'
  | 'invalid';

export interface RpcProviderSlotsNormalization {
  readonly count: number;
  readonly within_capacity: boolean;
  readonly max_provider_slots: 3;
  readonly status: RpcProviderSlotsStatus;
}

export type RpcProviderSelectionStatus =
  | 'selection_valid_no_rpc'
  | 'unconfigured_no_rpc'
  | 'invalid';

export interface RpcProviderSelectionResult {
  readonly valid: boolean;
  readonly status: RpcProviderSelectionStatus;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
  readonly can_send: false;
  readonly slot_count: number;
  readonly max_provider_slots: 3;
}

export function describeRpcProviderRegistry(): RpcProviderRegistryDescriptor;
export function listSupportedRpcProviderRefs(): readonly ['helius'];
export function normalizeRpcProviderSlots(input?: unknown): RpcProviderSlotsNormalization;
export function validateRpcProviderSelection(selection?: unknown): RpcProviderSelectionResult;
