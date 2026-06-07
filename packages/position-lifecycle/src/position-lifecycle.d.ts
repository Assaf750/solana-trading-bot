// Types for position-lifecycle.mjs. Names from positions table (DATA §4.3) + SSOT G1/G2/G4/G9.

export interface PositionRecord {
  /** Internal storage-only identifier (DATA §4.3). */
  id: string;
  position_state: string;            // SSOT G1
  entry_brain: string;               // SSOT G2 (frozen)
  current_control_brain: string;     // SSOT G4
  migration_phase: string;           // SSOT G1
  market_phase: string;              // SSOT G4 (mirrors migration_phase)
  active_exit_route: string | null;  // SSOT G4
  config_version_at_entry: unknown;  // SSOT G9 (frozen)
}

export interface OpenInput {
  id: string;
  entry_brain: string;
  config_version_at_entry: unknown;
  migration_phase?: string;
  active_exit_route?: string | null;
}

export interface LifecycleResult {
  ok: boolean;
  reason?: string;
  api_error_code?: 'COMMAND_NOT_ALLOWED_IN_STATE';
  id?: string;
  position_state?: string;
  migration_phase?: string;
  current_control_brain?: string;
  from?: string;
  to?: string;
}

export interface PositionLifecycle {
  open(position: OpenInput): LifecycleResult;
  transition(id: string, toState: string): LifecycleResult;
  advanceMigrationPhase(id: string, toPhase: string): LifecycleResult;
  handoverControlBrain(id: string, toBrain: string): LifecycleResult;
  get(id: string): PositionRecord | undefined;
  list(): PositionRecord[];
  isTerminal(id: string): boolean;
  auditEntries(): Record<string, unknown>[];
  readonly size: number;
}

export function isTerminalState(position_state: string): boolean;
export function createPositionLifecycle(opts?: { audit?: { append(e: Record<string, unknown>): number; list(): Record<string, unknown>[] } }): PositionLifecycle;
export const POSITION_TRANSITIONS: Readonly<Record<string, readonly string[]>>;
export const POSITION_TERMINAL_STATES: readonly string[];
