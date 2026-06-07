// Types for paper-e2e.mjs. Paper orchestration only — no execution authority.

export interface PaperScenario {
  events?: unknown[];
  signal?: Record<string, unknown>;
  intent?: Record<string, unknown>;
  position?: { id?: string; entry_brain?: string; config_version_at_entry?: unknown };
  exec_ctx?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  mark?: { candidate_mark_status?: string; mark?: number };
}

export interface PaperPipelineResult {
  ok: boolean;
  simulated: true;
  completed: boolean;
  stopped_at?: string;
  signed?: false;
  executed?: false;
  is_valid_on_chain?: false;
  position_state?: string;
  stages: Record<string, unknown>;
}

export function runPaperPipeline(scenario?: PaperScenario, deps?: Record<string, unknown>): PaperPipelineResult;
export { evaluateRpcHealth } from '../../foundations/src/rpc-health-monitor';
