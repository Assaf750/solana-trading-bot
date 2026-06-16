// @soltrade/trading-engine — type surface (hand-written, ADR-0001 Phase Engine-2).

export type EngineState =
  | 'stopped'
  | 'stopped_killed'
  | 'waiting_vault_unlock'
  | 'waiting_rpc_config'
  | 'no_followed_wallets'
  | 'paused_by_operator'
  | 'connecting'
  | 'active'
  | 'exits_only_stream_gap';

export const ENGINE_STATES: Readonly<{
  STOPPED: 'stopped';
  STOPPED_KILLED: 'stopped_killed';
  WAITING_VAULT_UNLOCK: 'waiting_vault_unlock';
  WAITING_RPC_CONFIG: 'waiting_rpc_config';
  NO_FOLLOWED_WALLETS: 'no_followed_wallets';
  PAUSED_BY_OPERATOR: 'paused_by_operator';
  CONNECTING: 'connecting';
  ACTIVE: 'active';
  EXITS_ONLY_STREAM_GAP: 'exits_only_stream_gap';
}>;

export interface DesiredStateInputs {
  killBlocked: boolean;
  vaultUnlocked: boolean;
  rpcConfigured: boolean;
  followedCount: number;
  operatingState: string;
}

export function deriveDesiredState(inputs: DesiredStateInputs): EngineState;

export function composeTradingEngine<T>(opts: { substrateFactory: (deps: any) => T; deps: any }): T;
