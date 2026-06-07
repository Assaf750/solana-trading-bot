// Types for exit-manager.mjs (CANDIDATE-flagged). Names from SSOT G33 candidate batch-exit.

export interface PreviewPosition {
  id: string;
  position_state?: string; // SSOT G1 (or resolved via injected lifecycle)
}

export interface PreviewItem {
  id: string;
  candidate_batch_exit_preview_item_status: 'eligible' | 'blocked' | 'stale';
}

export interface PreviewResult {
  command: 'candidate_cmd_preview_batch_exit';
  preview_id: string;
  items: PreviewItem[];
  executed: false;
}

export interface RequestResultItem {
  id: string;
  intent_id?: string;
  candidate_batch_exit_result_status: 'submitted' | 'blocked' | 'skipped' | 'failed' | 'filled';
}

export interface RequestResult {
  ok: boolean;
  reason?: string;
  command?: 'candidate_cmd_request_batch_exit';
  per_position?: true;
  atomic?: false;
  executed?: false;
  results?: RequestResultItem[];
}

export interface ExitManager {
  command_preview: 'candidate_cmd_preview_batch_exit';
  command_request: 'candidate_cmd_request_batch_exit';
  previewBatchExit(positions?: PreviewPosition[]): PreviewResult;
  requestBatchExit(preview: PreviewResult, opts?: { intent_type?: string }): RequestResult;
}

export function createExitManager(deps?: { ledger?: unknown; lifecycle?: unknown }): ExitManager;
