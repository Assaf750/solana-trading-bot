# @soltrade/contracts

مفردات عقد API المنطقي مشتقّة من **`docs/01-SSOT.md`** (تملك الأسماء) و**`docs/03-API-CONTRACT.md`** (تستهلكها). **لا اسم خارج SSOT · لا execution authority للفرص.**

## المحتوى
- `api-vocabulary.mjs` / `.d.ts` — `permission_role` · `resource_type` · `command_type` · `api_error_code` · `event_type` · `stream_channel` + حقول المظروف (G12) وحقول Audit (G14).
- `candidate-commands.mjs` / `.d.ts` — أوامر/أخطاء **candidate** (`candidate_cmd_*` · `candidate_err_*`). **ليست قيم `command_type` منفّذة**؛ تبقى candidate حتى اعتماد `03-API-CONTRACT`.

## الحوكمة (مفروضة بالاختبارات)
- **لا أمر للفرص** (`buy_/execute_/submit_opportunity` غير موجودة) · **لا أمر خروج ذرّي** (`exit_all_positions`/`batch_exit_all_positions`) — البديل preview→request per-position.
- `opportunity` = `resource_type` للقراءة فقط، بلا `command_type`.
- لا اسم مرفوض في المفردات · candidate يحتفظ ببادئته.

## الاستخدام
```js
import { COMMAND_TYPE, API_ERROR_CODE, EVENT_TYPE, RESOURCE_TYPE } from '@soltrade/contracts';
```
