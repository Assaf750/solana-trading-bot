# @soltrade/intent-ledger (Gate B / B2)

IntentLedger حتمي **in-memory**، مشتقّ من `docs/00-ARCHITECTURE §15.1` و`docs/05-DATA-MODEL §4.4 (intents)` و`docs/01-SSOT G3/G12` و`docs/03-API §11`. **بلا DB writes حقيقية · بلا execution · بلا signing/sending · بلا شبكة.**

## المحتوى
- `intent-ledger.mjs` / `.d.ts` — `createIntentLedger({ audit? })` → `{ create, get, list, updateStatus, isTerminal, createReplacement, auditEntries, size }` + `assertOrderHasIntent(order)` + `isTerminalBundleStatus(s)`.
- `fixtures/sample-intent.json` — نيّة dev (بلا أسرار).

## lifecycle / idempotency
- `create` يتطلّب `intent_id` + `intent_type` (G3) + `idempotency_key` (G12)؛ يتحقّق من enums G3.
- تكرار `idempotency_key`/`intent_id` → `{ ok:false, api_error_code:'IDEMPOTENCY_CONFLICT', existing_intent_id }` (لا إنشاء).
- `updateStatus` يحدّث `bundle_status`/`failure_type` (قيم G3) — لا حذف.
- **terminal** عندما `bundle_status ∈ {Landed, Failed, Invalid}`؛ **terminal/non-terminal يُحتفظ بهما (لا delete API)**.
- **retry = replacement صريح:** `createReplacement(originalId, replacement)` يتطلّب `intent_id` جديداً + `idempotency_key` جديداً (مربوط داخلياً عبر `replaces_intent_id`).
- `assertOrderHasIntent` يرفض أي order بلا `intent_id`.

## repository / interface
- repository **in-memory** (Map) — قابل للاستبدال بـ adapter لاحقاً.
- `audit` interface **حقن اختياري**؛ الافتراضي `@soltrade/data createAuditLog` (in-memory append-only، **بلا DB**)؛ القيود `resource_type='intent'` + أعمدة audit القائمة فقط.

## الأسماء (SSOT/API/DATA فقط)
`intent_id`·`intent_type`·`bundle_status`·`failure_type`·`idempotency_key`·`request_id`·`issuing_brain`·`execution_wallet_id`·`signer_profile_id` + `IDEMPOTENCY_CONFLICT` + `resource_type='intent'`. **لا `api_error_code` جديد** (`reason` داخلي).

> **لا قدرة تنفيذ/تداول · لا توقيع/إرسال · لا DB writes/migrations · لا RPC/providers.** يسجّل النوايا فقط؛ التنفيذ (لاحقاً) يمرّ عبر Risk Gates + adapter منفصلين.
