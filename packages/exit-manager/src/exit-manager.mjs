// @soltrade/exit-manager — Exit Manager (Gate B / B7) — CANDIDATE-FLAGGED.
// SOURCE: docs/01-SSOT.md G33 (candidate batch-exit) + docs/03-API §15 + docs/00-ARCH §4.2.
// Implements ONLY the governed candidate path: preview -> request PER-POSITION.
// candidate_* names are kept verbatim and remain CANDIDATE (not implemented, not final).
//
// HARD RULES:
//  - NO atomic / mass exit; the always-forbidden mass-exit commands are never implemented.
//  - preview does NOT execute; request does NOT execute/sign/send — it records SEPARATE per-position intents.
//  - candidate_ prefixes preserved everywhere; no candidate -> implemented.

import { CANDIDATE_COMMANDS } from '../../contracts/src/candidate-commands.mjs';
import { CANDIDATE_ENUMS } from '../../ssot-types/src/candidate-enums.mjs';
import { INTENT_TYPE } from '../../ssot-types/src/core-enums.mjs';

// Governed candidate names (must exist in SSOT/contracts; kept candidate).
const CMD_PREVIEW = 'candidate_cmd_preview_batch_exit';
const CMD_REQUEST = 'candidate_cmd_request_batch_exit';
for (const c of [CMD_PREVIEW, CMD_REQUEST]) {
  if (!CANDIDATE_COMMANDS.includes(c)) throw new Error(`internal: ${c} not a registered candidate command`);
}
const PREVIEW_ITEM_STATUS = CANDIDATE_ENUMS.candidate_batch_exit_preview_item_status; // eligible|blocked|stale
const RESULT_STATUS = CANDIDATE_ENUMS.candidate_batch_exit_result_status;             // submitted|blocked|failed|skipped|filled
for (const s of ['eligible', 'blocked', 'stale']) if (!PREVIEW_ITEM_STATUS.includes(s)) throw new Error('internal: preview status drift');
for (const s of ['submitted', 'blocked', 'skipped']) if (!RESULT_STATUS.includes(s)) throw new Error('internal: result status drift');

const EXITABLE = new Set(['OPEN', 'PARTIALLY_EXITING', 'EXIT_PENDING', 'MIRROR_SELL_PENDING', 'MIGRATION_PENDING']);
const TERMINAL = new Set(['CLOSED', 'CLOSED_WITH_DUST', 'FAILED_ENTRY']);

const isStr = (v) => typeof v === 'string' && v.length > 0;

function previewItemStatus(position_state) {
  if (EXITABLE.has(position_state)) return 'eligible';
  if (TERMINAL.has(position_state)) return 'blocked';
  return 'stale'; // OPENING / FAILED_EXIT / unknown / missing
}

export function createExitManager({ ledger, lifecycle } = {}) {
  const previews = new Map(); // preview_id -> { items, consumed }
  let previewSeq = 0;
  let intentSeq = 0;

  function resolveState(item) {
    if (item && isStr(item.position_state)) return item.position_state;
    if (lifecycle && item && isStr(item.id)) {
      const rec = lifecycle.get(item.id);
      return rec ? rec.position_state : null;
    }
    return null;
  }

  return Object.freeze({
    command_preview: CMD_PREVIEW,   // candidate command name (kept candidate)
    command_request: CMD_REQUEST,   // candidate command name (kept candidate)

    /** candidate_cmd_preview_batch_exit — per-position preview. Does NOT execute. */
    previewBatchExit(positions = []) {
      const list = Array.isArray(positions) ? positions : [];
      const items = list.map((p) => ({
        id: p && p.id,
        candidate_batch_exit_preview_item_status: previewItemStatus(resolveState(p)),
      }));
      previewSeq += 1;
      const preview_id = `preview-${previewSeq}`;
      previews.set(preview_id, { items, consumed: false });
      return { command: CMD_PREVIEW, preview_id, items, executed: false };
    },

    /** candidate_cmd_request_batch_exit — accepted only on a fresh/valid preview; PER-POSITION intents. */
    requestBatchExit(preview, { intent_type } = {}) {
      if (preview == null || !isStr(preview.preview_id)) return { ok: false, reason: 'invalid_preview' };
      const tracked = previews.get(preview.preview_id);
      if (!tracked) return { ok: false, reason: 'unknown_preview' };
      if (tracked.consumed) return { ok: false, reason: 'stale_or_consumed_preview' };
      const it = intent_type ?? 'SELL_INTENT';
      if (!INTENT_TYPE.includes(it)) return { ok: false, reason: 'invalid_intent_type' };

      const results = [];
      for (const item of tracked.items) {
        const st = item.candidate_batch_exit_preview_item_status;
        if (st !== 'eligible') {
          results.push({ id: item.id, candidate_batch_exit_result_status: st === 'blocked' ? 'blocked' : 'skipped' });
          continue;
        }
        // SEPARATE per-position intent — never a single atomic operation.
        intentSeq += 1;
        const intent = {
          intent_id: `exit-intent-${item.id}-${intentSeq}`,
          intent_type: it,
          idempotency_key: `exit-${item.id}-${preview.preview_id}`,
        };
        let status = 'submitted';
        if (ledger) {
          const r = ledger.create(intent);
          if (!r.ok) status = 'skipped'; // e.g., idempotency conflict -> not a new submission
        }
        results.push({ id: item.id, intent_id: intent.intent_id, candidate_batch_exit_result_status: status });
      }
      tracked.consumed = true; // single-use: a request consumes its preview
      return { ok: true, command: CMD_REQUEST, per_position: true, atomic: false, executed: false, results };
    },
  });
}
