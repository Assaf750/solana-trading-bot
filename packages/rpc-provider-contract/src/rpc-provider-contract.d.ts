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

// --- PR-E2-F-10: Helius endpoint provisioning (contract-only, reference-only, fail-closed, no-live/no-secret) ---

export interface HeliusEndpointProvisioningDescriptor {
  readonly contract: 'helius-endpoint-provisioning';
  readonly version: string;
  readonly provider_ref: 'helius';
  readonly supported_environments: readonly ['devnet', 'testnet', 'localnet'];
  readonly max_provider_slots: 3;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly is_live: false;
  readonly status: RpcProviderStatus;
  readonly note: string;
}

export type HeliusEndpointProvisioningStatus =
  | 'provisioning_valid_no_live'
  | 'unconfigured_no_rpc'
  | 'invalid';

export interface HeliusEndpointProvisioningResult {
  readonly valid: boolean;
  readonly status: HeliusEndpointProvisioningStatus;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly is_live: false;
}

export interface ProviderEndpointRefsResult {
  readonly valid: boolean;
  readonly status: HeliusEndpointProvisioningStatus;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly is_live: false;
  readonly slot_count: number;
  readonly max_provider_slots: 3;
}

export function describeHeliusEndpointProvisioningContract(): HeliusEndpointProvisioningDescriptor;
export function validateHeliusEndpointProvisioning(input?: unknown): HeliusEndpointProvisioningResult;
export function validateProviderEndpointRefs(selection?: unknown): ProviderEndpointRefsResult;

// --- PR-E2-F-11: endpoint-reference binding harness (test-only, reference-only, fail-closed, no-live/no-secret) ---

export interface EndpointReferenceBindingHarnessDescriptor {
  readonly contract: 'endpoint-reference-binding-harness';
  readonly version: string;
  readonly test_only: true;
  readonly reads_env: false;
  readonly reads_secret_files: false;
  readonly provider_ref: 'helius';
  readonly supported_environments: readonly ['devnet', 'testnet', 'localnet'];
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly is_live: false;
  readonly network_call_made: false;
  readonly status: RpcProviderStatus;
  readonly note: string;
}

export type EndpointReferenceBindingStatus =
  | 'reference_bound_no_live'
  | 'unbound'
  | 'unconfigured_no_rpc'
  | 'invalid';

export interface EndpointReferenceBindingValidationResult {
  readonly valid: boolean;
  readonly status: EndpointReferenceBindingStatus;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly is_live: false;
  readonly network_call_made: false;
}

export interface EndpointReferenceBindingResult {
  readonly bound: boolean;
  readonly valid: boolean;
  readonly status: EndpointReferenceBindingStatus;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly is_live: false;
  readonly network_call_made: false;
}

export function describeEndpointReferenceBindingHarness(): EndpointReferenceBindingHarnessDescriptor;
export function validateEndpointReferenceBinding(input?: unknown): EndpointReferenceBindingValidationResult;
export function bindEndpointReferenceForTest(input?: unknown, bindingMap?: unknown): EndpointReferenceBindingResult;

// --- PR-E2-F-13: live RPC spike boundary (contract-only, test-only, no-broadcast, no-live/no-secret) ---

export interface LiveRpcSpikeBoundaryDescriptor {
  readonly contract: 'live-rpc-spike-boundary';
  readonly version: string;
  readonly test_only: true;
  readonly purpose: 'live_rpc_spike_boundary';
  readonly provider_ref: 'helius';
  readonly supported_environments: readonly ['devnet', 'testnet', 'localnet'];
  readonly requires_no_broadcast: true;
  readonly requires_bound_endpoint_ref: true;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly live_rpc_call_made: false;
  readonly network_call_made: false;
  readonly broadcast_permitted: false;
  readonly status: RpcProviderStatus;
  readonly note: string;
}

export type LiveRpcSpikeBoundaryStatus =
  | 'live_rpc_spike_boundary_no_live'
  | 'unconfigured_no_rpc'
  | 'invalid';

export interface LiveRpcSpikeBoundaryRequestResult {
  readonly valid: boolean;
  readonly status: LiveRpcSpikeBoundaryStatus;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly live_rpc_call_made: false;
  readonly network_call_made: false;
  readonly broadcast_permitted: false;
}

export interface LiveRpcSpikeBoundaryResult {
  readonly valid: boolean;
  readonly boundary_passed: boolean;
  readonly status: LiveRpcSpikeBoundaryStatus;
  readonly provider_ref?: 'helius';
  readonly environment?: string;
  readonly bound: boolean;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly live_rpc_call_made: false;
  readonly network_call_made: false;
  readonly broadcast_permitted: false;
}

export function describeLiveRpcSpikeBoundaryContract(): LiveRpcSpikeBoundaryDescriptor;
export function validateLiveRpcSpikeBoundaryRequest(input?: unknown): LiveRpcSpikeBoundaryRequestResult;
export function evaluateLiveRpcSpikeBoundary(input?: unknown, bindingMap?: unknown): LiveRpcSpikeBoundaryResult;

export type LiveRpcSpikeApprovalGateStatus =
  | 'live_rpc_spike_approval_gate_valid_no_live'
  | 'unconfigured_no_rpc'
  | 'invalid';

export interface LiveRpcSpikeApprovalGateDescriptor {
  readonly contract: 'live-rpc-spike-approval-gate';
  readonly version: string;
  readonly test_only: true;
  readonly purpose: 'live_rpc_spike_approval_gate';
  readonly target: 'testnet_rpc_spike';
  readonly provider_ref: 'helius';
  readonly supported_environments: readonly string[];
  readonly requires_separate_live_spike_pr: true;
  readonly requires_out_of_repo_endpoint_binding: true;
  readonly requires_supply_chain_review: true;
  readonly requires_post_spike_revoke_or_disable: true;
  readonly requires_no_broadcast: true;
  readonly requires_no_send: true;
  readonly requires_no_mainnet: true;
  readonly requires_no_real_live: true;
  readonly approval_record_valid: false;
  readonly approval_gate_passed: false;
  readonly live_rpc_authorized: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
  readonly status: RpcProviderStatus;
  readonly note: string;
}

export interface LiveRpcSpikeApprovalGateRecordResult {
  readonly valid: boolean;
  readonly approval_record_valid: boolean;
  readonly status: LiveRpcSpikeApprovalGateStatus;
  readonly reasons: readonly string[];
  readonly live_rpc_authorized: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
}

export interface LiveRpcSpikeApprovalGateResult {
  readonly valid: boolean;
  readonly approval_record_valid: boolean;
  readonly approval_gate_passed: boolean;
  readonly status: LiveRpcSpikeApprovalGateStatus;
  readonly provider_ref?: 'helius';
  readonly environment?: string;
  readonly reasons: readonly string[];
  readonly requires_separate_live_spike_pr: true;
  readonly live_rpc_authorized: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
}

export function describeLiveRpcSpikeApprovalGateContract(): LiveRpcSpikeApprovalGateDescriptor;
export function validateLiveRpcSpikeApprovalGate(input?: unknown): LiveRpcSpikeApprovalGateRecordResult;
export function evaluateLiveRpcSpikeApprovalGate(input?: unknown): LiveRpcSpikeApprovalGateResult;

// ---- PR-E2-F-15 — RPC Client / SDK Supply-Chain Review Gate (contract-only, no-network) ----
// Validates the SHAPE of a supply-chain review RECORD for a FUTURE RPC client/SDK dependency. An approved
// review authorizes NOTHING live and adds NO dependency/network — a separate integration PR + lockfile +
// supply-chain review are still required. No network / fetch / endpoint resolution / SDK import / dependency.

export type RpcClientSupplyChainGateStatus =
  | 'rpc_client_supply_chain_review_valid_no_network'
  | 'unconfigured_no_rpc'
  | 'invalid';

export interface RpcClientSupplyChainGateDescriptor {
  readonly contract: 'rpc-client-supply-chain-gate';
  readonly version: string;
  readonly test_only: true;
  readonly purpose: 'rpc_client_supply_chain_review';
  readonly requires_lockfile_review: true;
  readonly requires_supply_chain_review: true;
  readonly requires_separate_integration_pr: true;
  readonly requires_pinned_version: true;
  readonly requires_no_network: true;
  readonly requires_no_send: true;
  readonly requires_no_broadcast: true;
  readonly requires_no_serialize: true;
  readonly requires_no_mainnet: true;
  readonly requires_no_real_live: true;
  readonly review_record_valid: false;
  readonly supply_chain_gate_passed: false;
  readonly live_rpc_authorized: false;
  readonly network_capability: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
  readonly status: RpcProviderStatus;
  readonly note: string;
}

export interface RpcClientSupplyChainReviewResult {
  readonly valid: boolean;
  readonly review_record_valid: boolean;
  readonly status: RpcClientSupplyChainGateStatus;
  readonly reasons: readonly string[];
  readonly live_rpc_authorized: false;
  readonly network_capability: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
}

export interface RpcClientSupplyChainGateResult {
  readonly valid: boolean;
  readonly review_record_valid: boolean;
  readonly supply_chain_gate_passed: boolean;
  readonly status: RpcClientSupplyChainGateStatus;
  readonly reasons: readonly string[];
  readonly requires_separate_integration_pr: true;
  readonly live_rpc_authorized: false;
  readonly network_capability: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
}

export function describeRpcClientSupplyChainGateContract(): RpcClientSupplyChainGateDescriptor;
export function validateRpcClientSupplyChainReview(input?: unknown): RpcClientSupplyChainReviewResult;
export function evaluateRpcClientSupplyChainGate(input?: unknown): RpcClientSupplyChainGateResult;

export type OutOfRepoEndpointBindingStatus =
  | 'out_of_repo_endpoint_binding_valid_no_live'
  | 'unconfigured_no_rpc'
  | 'invalid';

export interface OutOfRepoEndpointBindingAdapterDescriptor {
  readonly contract: 'out-of-repo-endpoint-binding-adapter';
  readonly version: string;
  readonly test_only: true;
  readonly purpose: 'out_of_repo_endpoint_binding_adapter';
  readonly provider_ref: 'helius';
  readonly supported_environments: readonly string[];
  readonly supported_binding_source_kinds: readonly string[];
  readonly requires_out_of_repo_secret_source: true;
  readonly requires_separate_live_binding_pr: true;
  readonly requires_no_network: true;
  readonly requires_no_send: true;
  readonly requires_no_broadcast: true;
  readonly requires_no_serialize: true;
  readonly requires_no_mainnet: true;
  readonly requires_no_real_live: true;
  readonly secret_in_repo: false;
  readonly endpoint_in_repo: false;
  readonly binding_descriptor_valid: false;
  readonly boundary_passed: false;
  readonly live_rpc_authorized: false;
  readonly network_capability: false;
  readonly resolved: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
  readonly status: RpcProviderStatus;
  readonly note: string;
}

export interface OutOfRepoEndpointBindingDescriptorResult {
  readonly valid: boolean;
  readonly binding_descriptor_valid: boolean;
  readonly status: OutOfRepoEndpointBindingStatus;
  readonly reasons: readonly string[];
  readonly live_rpc_authorized: false;
  readonly network_capability: false;
  readonly resolved: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
}

export interface OutOfRepoEndpointBindingBoundaryResult {
  readonly valid: boolean;
  readonly binding_descriptor_valid: boolean;
  readonly boundary_passed: boolean;
  readonly status: OutOfRepoEndpointBindingStatus;
  readonly provider_ref?: 'helius';
  readonly environment?: string;
  readonly binding_source_kind?: string;
  readonly reasons: readonly string[];
  readonly requires_separate_live_binding_pr: true;
  readonly live_rpc_authorized: false;
  readonly network_capability: false;
  readonly resolved: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly broadcast_permitted: false;
}

export function describeOutOfRepoEndpointBindingAdapterContract(): OutOfRepoEndpointBindingAdapterDescriptor;
export function validateOutOfRepoEndpointBindingDescriptor(input?: unknown): OutOfRepoEndpointBindingDescriptorResult;
export function evaluateOutOfRepoEndpointBindingBoundary(input?: unknown): OutOfRepoEndpointBindingBoundaryResult;

// ---------------------------------------------------------------------------------------------------------
// E2-F-17 — Live testnet RPC spike (read-only / no-broadcast). Read-only health/version only; out-of-repo
// injected caller performs the actual call; default fail-closed; opens NOTHING for trading/send/broadcast.
// ---------------------------------------------------------------------------------------------------------

export type LiveTestnetRpcReadOnlySpikeStatus =
  | 'live_testnet_rpc_read_only_spike_valid_no_call'
  | 'live_testnet_rpc_read_only_spike_ok'
  | 'unconfigured_no_rpc'
  | 'invalid';

export type OutOfRepoReadOnlyRpcCaller = (method: string) => unknown | Promise<unknown>;

export interface LiveTestnetRpcReadOnlySpikeDescriptor {
  readonly contract: 'live-testnet-rpc-read-only-spike';
  readonly version: string;
  readonly test_only: true;
  readonly purpose: 'live_testnet_rpc_read_only_spike';
  readonly supported_environments: readonly string[];
  readonly supported_read_only_methods: readonly string[];
  readonly requires_out_of_repo_binding: true;
  readonly requires_separate_send_pr: true;
  readonly requires_read_only: true;
  readonly requires_no_send: true;
  readonly requires_no_broadcast: true;
  readonly requires_no_serialize: true;
  readonly requires_no_sign: true;
  readonly requires_no_mainnet: true;
  readonly requires_no_real_live: true;
  readonly endpoint_in_repo: false;
  readonly request_valid: false;
  readonly spike_authorized: false;
  readonly spike_attempted: false;
  readonly live_rpc_call_made: false;
  readonly read_only_health_ok: false;
  readonly method_read_only: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly trading_ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly broadcast_permitted: false;
  readonly signing_permitted: false;
  readonly network_call_made: false;
  readonly endpoint_echoed: false;
  readonly binding_retained: false;
  readonly status: RpcProviderStatus;
  readonly note: string;
}

export interface LiveTestnetRpcReadOnlySpikeRequestResult {
  readonly valid: boolean;
  readonly request_valid: boolean;
  readonly status: LiveTestnetRpcReadOnlySpikeStatus;
  readonly reasons: readonly string[];
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly trading_ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly broadcast_permitted: false;
  readonly signing_permitted: false;
  readonly network_call_made: false;
  readonly live_rpc_call_made: false;
  readonly read_only_health_ok: false;
  readonly endpoint_echoed: false;
}

export interface LiveTestnetRpcReadOnlySpikeResult {
  readonly valid: boolean;
  readonly request_valid: boolean;
  readonly spike_authorized: boolean;
  readonly spike_attempted: boolean;
  readonly live_rpc_call_made: boolean;
  readonly read_only_health_ok: boolean;
  readonly method_read_only: boolean;
  readonly status: LiveTestnetRpcReadOnlySpikeStatus;
  readonly environment?: string;
  readonly rpc_method?: string;
  readonly reasons: readonly string[];
  readonly requires_separate_send_pr: true;
  readonly requires_out_of_repo_binding: true;
  readonly endpoint_echoed: false;
  readonly binding_retained: false;
  readonly configured: false;
  readonly has_rpc: false;
  readonly ready: false;
  readonly trading_ready: false;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly is_live: false;
  readonly real_live: false;
  readonly broadcast_permitted: false;
  readonly signing_permitted: false;
  readonly network_call_made: false;
}

export function describeLiveTestnetRpcReadOnlySpikeContract(): LiveTestnetRpcReadOnlySpikeDescriptor;
export function validateLiveTestnetRpcReadOnlySpikeRequest(input?: unknown): LiveTestnetRpcReadOnlySpikeRequestResult;
export function evaluateLiveTestnetRpcReadOnlySpike(input?: unknown, outOfRepoReadOnlyCaller?: OutOfRepoReadOnlyRpcCaller): Promise<LiveTestnetRpcReadOnlySpikeResult>;
