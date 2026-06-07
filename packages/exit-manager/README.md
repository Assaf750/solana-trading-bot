# @soltrade/exit-manager (Gate B / B7) — CANDIDATE-flagged

Exit Manager **candidate-flagged فقط**، يطبّق مسار الحوكمة المعتمد: **`candidate_cmd_preview_batch_exit` → `candidate_cmd_request_batch_exit` per-position**. مشتقّ من `docs/01-SSOT G33` و`docs/03-API §15` و`docs/00-ARCH §4.2`. **كل أسماء `candidate_*` تبقى candidate** (لا حذف بادئة، لا ترقية إلى implemented).

## القواعد الصارمة
- **لا أمر خروج ذرّي / mass exit · لا `exit_all_positions` · لا `batch_exit_all_positions`** (مرفوضة للأبد).
- **preview لا ينفّذ** · **request لا ينفّذ/يوقّع/يرسل** — يسجّل **نوايا منفصلة per-position** فقط (عبر IntentLedger).
- لا توقيع/إرسال · لا transaction building · لا RPC/providers · لا DB writes · لا network.

## المحتوى
- `exit-manager.mjs` / `.d.ts` — `createExitManager({ ledger?, lifecycle? })` → `{ previewBatchExit, requestBatchExit, command_preview, command_request }`.
- `fixtures/positions.json`.

## preview flow (`candidate_cmd_preview_batch_exit`)
لكل مركز → `candidate_batch_exit_preview_item_status`: `OPEN`/`PARTIALLY_EXITING`/`EXIT_PENDING`/`MIRROR_SELL_PENDING`/`MIGRATION_PENDING` → `eligible` · terminal → `blocked` · غير ذلك/مجهول → `stale`. يُرجِع `preview_id` صالحاً لمرة واحدة. **`executed:false`.**

## request per-position flow (`candidate_cmd_request_batch_exit`)
يُقبل فقط على معاينة صالحة غير مُستهلَكة؛ لكل عنصر `eligible` → **intent منفصل per-position** (`intent_id`/`idempotency_key` مستقلّان) عبر IntentLedger، نتيجة `candidate_batch_exit_result_status='submitted'` · `blocked`→`blocked` · `stale`→`skipped`. **`per_position:true`، `atomic:false`، `executed:false`.**

## candidate usage summary
commands: `candidate_cmd_preview_batch_exit`/`candidate_cmd_request_batch_exit` (من contracts) · statuses: `candidate_batch_exit_preview_item_status`/`candidate_batch_exit_result_status` (من ssot-types) — كلها **candidate محفوظة البادئة**. `intent_type` (G3) للنوايا per-position.

> **candidate لا يتحول إلى implemented · لا قدرة تداول · request لا ينفّذ مباشرةً.** التنفيذ الورقي (إن لزم) يمرّ عبر Paper Adapter المنفصل (B4) عبر الـ intents per-position.
