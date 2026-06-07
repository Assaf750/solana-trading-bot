// Types for core-enums.mjs. Values are owned by docs/01-SSOT.md.

export type OperatingState = 'WARMING_UP' | 'ACTIVE' | 'EXITS_ONLY' | 'PAUSED' | 'KILLED';
export type PositionState =
  | 'OPENING' | 'OPEN' | 'PARTIALLY_EXITING' | 'EXIT_PENDING' | 'MIRROR_SELL_PENDING'
  | 'MIGRATION_PENDING' | 'CLOSED' | 'CLOSED_WITH_DUST' | 'FAILED_ENTRY' | 'FAILED_EXIT';
export type MigrationPhase =
  | 'PRE_MIGRATION' | 'MIGRATION_APPROACHING' | 'MIGRATION_IN_PROGRESS' | 'LP_MINTED' | 'POST_MIGRATION_ACTIVE';

export type CopyMode = 'follow_entry_user_exit' | 'full_mirror';
export type EvGateMode = 'strict' | 'warning_only';
export type SizingMode = 'fixed_usd' | 'fixed_sol' | 'pct_of_capital';
export type PartialSellPolicy =
  | 'risk_modifier_only' | 'proportional_mirror' | 'ignore_below_threshold' | 'tighten_trailing_only' | 'manual_review';
export type TransferExitPolicy = 'no_auto_exit' | 'de_risk_partial' | 'exit_on_transfer';
export type ScaleInPolicy = 'no_add' | 'mirror_proportional' | 'limited_add';
export type ConflictResolution = 'risk_signal_wins_by_default';
export type StrategyBrain = 'brain_a' | 'brain_b';
export type ExecutionMode =
  | 'auto' | 'manual_approval' | 'helius_sender' | 'jito_send' | 'jito_bundle' | 'jupiter_route';

export type IntentType =
  | 'BUY_INTENT' | 'SELL_INTENT' | 'SCALE_IN_INTENT' | 'MIRROR_SELL_INTENT' | 'EMERGENCY_EXIT_INTENT' | 'CANCEL_INTENT';
export type FailureType =
  | 'SlippageExceeded' | 'BlockhashExpired' | 'AccountInUse' | 'ComputeBudgetExceeded' | 'InsufficientFunds'
  | 'RouteInvalid' | 'TokenAccountMissing' | 'ProgramError' | 'RPCDropped' | 'BundleFailed' | 'Unknown';
export type BundleStatus = 'Pending' | 'Failed' | 'Landed' | 'Invalid' | 'STALE_BUNDLE';
export type CopyEvent =
  | 'leader_buy' | 'leader_scale_in' | 'leader_partial_sell' | 'leader_full_exit' | 'leader_transfer_out'
  | 'transfer_known_cluster' | 'transfer_unknown_single' | 'transfer_split_unknown' | 'transfer_cex_like'
  | 'transfer_creator_dev' | 'leader_rebuy' | 'whipsaw_detected' | 'multi_wallet_conflict'
  | 'leader_inactive_token_weak' | 'leader_exit_migration_limbo' | 'leader_sell_route_unhealthy'
  | 'entry_slippage_exceeds_leader';
export type CopyEventClassificationFlag = 'HIGH_EXIT_RISK' | 'WHIPSAW_OR_MEV_LIKE';

export type ProtocolConstantStatus = 'green' | 'changed';
export type ValidationStatus = 'valid' | 'warning' | 'invalid';

export type KeyCustodyMode = 'connected_wallet' | 'isolated_signer';
export type SignerProfileStatus = 'ACTIVE' | 'DISABLED' | 'REVOKED' | 'DEGRADED';
export type ExecutionWalletStatus = 'WARMING_UP' | 'ACTIVE' | 'DISABLED' | 'DRAINING' | 'RETIRED' | 'REVOKED';
export type WalletAssignmentPolicy =
  | 'round_robin' | 'least_active' | 'per_strategy' | 'per_source_wallet' | 'manual_assignment' | 'risk_weighted';
export type ExecutionWalletCreationMode = 'manual' | 'automatic_policy';
export type AssetTransferStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
export type RotationTrigger =
  | 'manual' | 'time_based' | 'trade_count_based' | 'risk_limit_based' | 'compromise_suspected' | 'wallet_retirement';
export type WalletRotationStatus = 'NOT_REQUIRED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type ProfitSweepPolicy = 'auto_immediate' | 'manual' | 'periodic';

export type HuntStatus =
  | 'discovered' | 'ranked' | 'gated' | 'accepted' | 'rejected' | 'watch_only' | 'expired' | 'entered';
export type QuoteMint = 'wsol' | 'usdc' | 'unknown';
export type AcceptedReason =
  | 'wallet_signal_confirmed' | 'cluster_signal_confirmed' | 'token_readiness_pass' | 'exit_feasibility_pass';
export type RejectedReason =
  | 'dex_only_signal' | 'ev_negative' | 'route_invalid' | 'exit_feasibility_fail' | 'token2022_dangerous_extension'
  | 'hard_risk_block' | 'slippage_vs_leader_exceeded' | 'same_cluster_not_independent' | 'hunt_window_expired'
  | 'liquidity_share_exceeded' | 'unknown_quote_mint';

export const OPERATING_STATE: readonly OperatingState[];
export const POSITION_STATE: readonly PositionState[];
export const MIGRATION_PHASE: readonly MigrationPhase[];
export const COPY_MODE: readonly CopyMode[];
export const EV_GATE_MODE: readonly EvGateMode[];
export const SIZING_MODE: readonly SizingMode[];
export const PARTIAL_SELL_POLICY: readonly PartialSellPolicy[];
export const TRANSFER_EXIT_POLICY: readonly TransferExitPolicy[];
export const SCALE_IN_POLICY: readonly ScaleInPolicy[];
export const CONFLICT_RESOLUTION: readonly ConflictResolution[];
export const STRATEGY_BRAIN: readonly StrategyBrain[];
export const EXECUTION_MODE: readonly ExecutionMode[];
export const INTENT_TYPE: readonly IntentType[];
export const FAILURE_TYPE: readonly FailureType[];
export const BUNDLE_STATUS: readonly BundleStatus[];
export const COPY_EVENT: readonly CopyEvent[];
export const COPY_EVENT_CLASSIFICATION_FLAG: readonly CopyEventClassificationFlag[];
export const PROTOCOL_CONSTANT_STATUS: readonly ProtocolConstantStatus[];
export const WARNING_CRITICAL: 'WARNING_CRITICAL';
export const VALIDATION_STATUS: readonly ValidationStatus[];
export const KEY_CUSTODY_MODE: readonly KeyCustodyMode[];
export const SIGNER_PROFILE_STATUS: readonly SignerProfileStatus[];
export const EXECUTION_WALLET_STATUS: readonly ExecutionWalletStatus[];
export const WALLET_ASSIGNMENT_POLICY: readonly WalletAssignmentPolicy[];
export const EXECUTION_WALLET_CREATION_MODE: readonly ExecutionWalletCreationMode[];
export const ASSET_TRANSFER_STATUS: readonly AssetTransferStatus[];
export const ROTATION_TRIGGER: readonly RotationTrigger[];
export const WALLET_ROTATION_STATUS: readonly WalletRotationStatus[];
export const PROFIT_SWEEP_POLICY: readonly ProfitSweepPolicy[];
export const HUNT_STATUS: readonly HuntStatus[];
export const QUOTE_MINT: readonly QuoteMint[];
export const ACCEPTED_REASON: readonly AcceptedReason[];
export const REJECTED_REASON: readonly RejectedReason[];

export const CORE_ENUMS: Readonly<Record<string, readonly string[]>>;
