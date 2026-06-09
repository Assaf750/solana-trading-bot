// @soltrade/wallet-token-intelligence-foundations — type declarations
//
// Read-only wallet/token observation intelligence. Observation/summary only;
// never a signal/recommendation/intent/route. No network, clock, persistence,
// or secrets.

export type WalletObservationState =
  | 'WALLET_OBS_UNCONFIGURED'
  | 'WALLET_OBS_INVALID'
  | 'WALLET_OBS_DEGRADED'
  | 'WALLET_OBS_READ_ONLY_OK';

export type TokenObservationState =
  | 'TOKEN_OBS_UNCONFIGURED'
  | 'TOKEN_OBS_INVALID'
  | 'TOKEN_OBS_DEGRADED'
  | 'TOKEN_OBS_READ_ONLY_OK';

export type WalletTokenRelationshipState =
  | 'RELATIONSHIP_UNCONFIGURED'
  | 'RELATIONSHIP_INVALID'
  | 'RELATIONSHIP_DEGRADED'
  | 'RELATIONSHIP_READ_ONLY_OK';

export interface IntelSafeFlags {
  read_only: true;
  live_stream_enabled: false;
  network_call_made: false;
  endpoint_resolved: false;
  has_secret: false;
  signal_ready: false;
  trading_ready: false;
  risk_ready: false;
  intent_ready: false;
  routing_ready: false;
  can_send: false;
  can_broadcast: false;
  can_serialize: false;
  signing_permitted: false;
  broadcast_permitted: false;
  is_live: false;
  mainnet_enabled: false;
  real_live: false;
}

// --- Wallet Observation ---

export interface WalletObservationContractDescriptor extends IntelSafeFlags {
  contract: 'wallet-observation-intelligence';
  version: string;
  test_only: true;
  supported_states: readonly WalletObservationState[];
  observations_only: true;
  wallet_observation_state: WalletObservationState;
  status: WalletObservationState;
  reasons: readonly string[];
  note: string;
}

export interface WalletObservationValidationResult extends IntelSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface WalletObservationResult extends IntelSafeFlags {
  valid: boolean;
  wallet_observation_state: WalletObservationState;
  wallet_ref?: string;
  observed_event_count: number;
  observed_swap_count: number;
  observed_mint_count: number;
  observed_balance_change_count: number;
  first_observed_ref?: string;
  last_observed_ref?: string;
  status: WalletObservationState;
  reasons: readonly string[];
}

export function describeWalletObservationIntelligenceContract(): WalletObservationContractDescriptor;
export function validateWalletObservationInput(input: unknown): WalletObservationValidationResult;
export function evaluateWalletObservationIntelligence(input: unknown): WalletObservationResult;

// --- Token Observation ---

export interface TokenObservationContractDescriptor extends IntelSafeFlags {
  contract: 'token-observation-intelligence';
  version: string;
  test_only: true;
  supported_states: readonly TokenObservationState[];
  observations_only: true;
  token_observation_state: TokenObservationState;
  status: TokenObservationState;
  reasons: readonly string[];
  note: string;
}

export interface TokenObservationValidationResult extends IntelSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface TokenObservationResult extends IntelSafeFlags {
  valid: boolean;
  token_observation_state: TokenObservationState;
  token_ref?: string;
  observed_event_count: number;
  observed_mint_count: number;
  observed_pool_count: number;
  observed_swap_count: number;
  observed_wallet_count: number;
  first_observed_ref?: string;
  last_observed_ref?: string;
  status: TokenObservationState;
  reasons: readonly string[];
}

export function describeTokenObservationIntelligenceContract(): TokenObservationContractDescriptor;
export function validateTokenObservationInput(input: unknown): TokenObservationValidationResult;
export function evaluateTokenObservationIntelligence(input: unknown): TokenObservationResult;

// --- Wallet-Token Relationship ---

export interface WalletTokenRelationshipContractDescriptor extends IntelSafeFlags {
  contract: 'wallet-token-relationship';
  version: string;
  test_only: true;
  supported_states: readonly WalletTokenRelationshipState[];
  observations_only: true;
  relationship_state: WalletTokenRelationshipState;
  status: WalletTokenRelationshipState;
  reasons: readonly string[];
  note: string;
}

export interface WalletTokenRelationshipValidationResult extends IntelSafeFlags {
  valid: boolean;
  recognized: boolean;
  reasons: readonly string[];
}

export interface WalletTokenRelationshipResult extends IntelSafeFlags {
  valid: boolean;
  relationship_state: WalletTokenRelationshipState;
  wallet_ref?: string;
  token_ref?: string;
  relationship_event_count: number;
  observed_interaction_types: readonly string[];
  first_seen_ref?: string;
  last_seen_ref?: string;
  status: WalletTokenRelationshipState;
  reasons: readonly string[];
}

export function describeWalletTokenRelationshipContract(): WalletTokenRelationshipContractDescriptor;
export function validateWalletTokenRelationshipInput(input: unknown): WalletTokenRelationshipValidationResult;
export function evaluateWalletTokenRelationship(input: unknown): WalletTokenRelationshipResult;
