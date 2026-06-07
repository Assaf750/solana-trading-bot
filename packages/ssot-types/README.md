# @soltrade/ssot-types

أنواع/قيم مشتقّة من **`docs/01-SSOT.md`** فقط. **لا اسم خارج SSOT.**

## المحتوى
- `core-enums.mjs` / `.d.ts` — enums الأساس (Groups 1–17): states · modes/policies · intents/events · health · signer/execution-wallet · discovery/opportunity. قيم runtime مجمّدة + أنواع TypeScript.
- `candidate-enums.mjs` / `.d.ts` — registry لـ enums **candidate** (Groups 22–41). **مجموعة أساسية أوّلية (preliminary)** — لا تشمل بعد كل candidate enums في SSOT؛ تُستكمَل في PRs لاحقة (لا قطع صامت). **كل مفتاح يحتفظ ببادئة `candidate_`؛ وجوده هنا لا يحوّله إلى implemented.**
- `forbidden.mjs` / `.d.ts` — سجلّ الأسماء المرفوضة/الممنوعة (Rejected Aliases + الممنوعات العامة) مع البديل canonical والسبب.

## الحوكمة
- **No name before SSOT** · candidate يبقى candidate · لا أسماء مرفوضة كحقول/قيم حقيقية.
- يُتحقَّق آلياً عبر `tools/check-ssot-drift.mjs` و`node --test`.

## الاستخدام
```js
import { OPERATING_STATE, CORE_ENUMS, CANDIDATE_ENUMS, FORBIDDEN_NAMES } from '@soltrade/ssot-types';
```
الأنواع: `import type { OperatingState, CopyMode } from '@soltrade/ssot-types';`
