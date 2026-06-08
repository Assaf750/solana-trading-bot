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
