// Type declarations for @soltrade/send-gate-contract (Gate E / E2-F-1).
// Contract/fail-closed skeleton only. No live mechanism, no RPC/send, no key material, no execution authority.

export type SendGateStatus = 'unconfigured_no_rpc';

export interface SendGateContractDescriptor {
  readonly contract: 'send-gate';
  readonly version: string;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly has_rpc: false;
  readonly is_live: false;
  readonly accepts_key_material_input: false;
  readonly requires_sign_only_success: true;
  readonly status: SendGateStatus;
  readonly operations: readonly string[];
  readonly note: string;
}

export interface SendPreflightResult {
  readonly ok: false;
  readonly sent: false;
  readonly broadcast: false;
  readonly signature: null;
  readonly transaction: null;
  readonly serialized: null;
  readonly can_send: false;
  readonly can_broadcast: false;
  readonly can_serialize: false;
  readonly has_rpc: false;
  readonly is_live: false;
  readonly status: SendGateStatus;
  readonly reason: 'send_gate_unconfigured_no_rpc';
  readonly blockers: readonly string[];
}

export interface FailClosedSendGate {
  readonly status: SendGateStatus;
  isConfigured(): false;
  describe(): SendGateContractDescriptor;
  evaluateSendPreflight(request?: unknown): SendPreflightResult;
}

export function describeSendGateContract(): SendGateContractDescriptor;
export function evaluateSendPreflight(input?: unknown): SendPreflightResult;
export function createFailClosedSendGate(): FailClosedSendGate;
export function refusesKeyMaterial(input?: unknown): boolean;
export const SEND_GATE_CONTRACT_STATUS: SendGateStatus;
