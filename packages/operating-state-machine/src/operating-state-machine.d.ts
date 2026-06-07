// Types for operating-state-machine.mjs. Names from SSOT G1 (operating_state) + G5.

export interface HealthSignals {
  provider_degraded?: boolean;       // SSOT G5
  slot_lag?: number;                 // SSOT G5
  stream_gap?: boolean;              // internal derived signal (from last_seen/confirmed slot)
  protocol_constant_status?: string; // SSOT G5 (green|changed)
}

export interface StateResult {
  operating_state: string;           // SSOT G1
  reason: string;
  warning?: 'WARNING_CRITICAL' | null; // SSOT G5
}

export interface OperatingStateMachine {
  getState(): StateResult;
  apply(signals: HealthSignals): StateResult;
  operatorReset(): StateResult;
  isActionAllowed(action: 'entry' | 'exit' | 'emergency_exit' | 'diagnostic' | string): boolean;
}

export function evaluateTarget(signals?: HealthSignals, options?: { slot_lag_threshold?: number }): { operating_state: string; reason: string; warning?: 'WARNING_CRITICAL' };
export function createOperatingStateMachine(opts?: { initial?: string; slot_lag_threshold?: number }): OperatingStateMachine;
export const OPERATING_ACTION_POLICY: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
