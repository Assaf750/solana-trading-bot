# @soltrade/config

مخطّط الإعداد + المُتحقِّق + قواعد القابلية للتعديل، مشتقّة من **`docs/02-CONFIG-AND-POLICY-SCHEMA.md` §2–§11** و**`docs/01-SSOT.md`**. الإعداد **الأساسي (غير-candidate)** فقط؛ إضافات candidate (§12–§17) خارج نطاق PR-A3.

## المحتوى
- `schema.mjs` / `.d.ts` — 8 كائنات إعداد + تعريف كل حقل: `rule` (نوع التحقّق) · `default` · `scope` · `mutable_when_open` · `applies_to_existing` · `safety_critical` (من §11). `ENUM_REFS` تستهلك enums من `@soltrade/ssot-types` (لا تعريف موازٍ). `HARD_RISK_FIELDS` · `EV_FIELDS` · `PARTIAL_SELL_ORDER`.
- `validate.mjs` / `.d.ts` — `validateConfig(config)` يطبّق §10: numeric bounds · enum · dependency · ordering · unknown-name · Hard Risk REAL-LIVE · EV/`ev_gate_mode`. يُرجِع مخرجات SSOT G10: `validation_status` · `real_live_config_valid` · `errors` · `warnings` · `unknown_names`.
- `fixtures/` — أمثلة dev وهمية: `valid-config.json` · `invalid-config.json` · `missing-hard-risk-config.json`.

## القواعد المطبّقة (من الوثائق، بلا threshold جديد)
- **bounds:** `_pct` في (0,100] أو [0,100] حسب الحقل · `_usdt` > 0 · المدد ≥ 0 · أعداد صحيحة > 0.
- **enum:** قيم من SSOT حصراً (عبر `@soltrade/ssot-types`).
- **dependency:** `take_profit_pct` مطلوب مع `follow_entry_user_exit` · `limited_add` يتطلّب `copy_adds_for_follow_entry=true` · `capital_reference` مطلوب مع `pct_of_capital` · `low<medium<high<major`.
- **Hard Risk REAL-LIVE:** غياب أي حدّ من الـ9 ⇒ `real_live_config_valid=false` (لا لانهائية ضمنية)؛ لا يمنع PAPER/الواجهة.
- **EV/`ev_gate_mode`:** strict تحجب الدخول عند النقص · warning_only ⇒ `WARNING_CRITICAL` بلا تجاوز Hard Risk.
- **unknown name ⇒ invalid** (No name before SSOT/02-CONFIG).

## الاستخدام
```js
import { validateConfig } from '@soltrade/config';
const r = validateConfig(myConfig); // { validation_status, real_live_config_valid, errors, warnings, unknown_names }
```

> **لا تحميل `.env` · لا migrations · لا DB · لا تنفيذ · لا قدرة تداول.** التحقّق منطقي بحت على كائن إعداد.
