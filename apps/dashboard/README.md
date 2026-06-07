# @soltrade/dashboard (shell — Gate A)

Dashboard **shell** تشخيصي read-only. يعرض حالة النظام/الصحّة/القيود، مع AR/EN + RTL/LTR. **بلا أزرار/عناصر تداول أو تنفيذ.**

## المحتوى
- `index.html` — صفحة shell ثابتة (بلا موارد خارجية/CDN).
- `i18n.mjs` — سلاسل AR/EN + اتجاه (`ar→rtl`, `en→ltr`). labels عرض فقط.
- `main.mjs` — `renderShell(state, locale)` دالة نقيّة تُخرج HTML الـ shell: أقسام **الحالة · الصحّة · القيود/التحذيرات** + مبدّل اللغة. **لا أزرار تداول.** المقاييس المفقودة تُعرض `unavailable` (لا تُختلق).

## القواعد
- **read-only / diagnostic** · الصحّة لا تعني trading readiness (ملاحظة ظاهرة دائماً).
- **لا execution controls** (لا buy/sell/exit) · لا أسماء مرفوضة كـ labels/أزرار.
- **لا اتصالات شبكة** (الـ shell لا يجلب؛ يعرض state مُمرَّر أو placeholders).
- AR/EN كسطح قبول: نفس المفاتيح في اللغتين؛ `dir` يتبدّل مع اللغة.

## AR/EN + RTL
`dirFor('ar') = 'rtl'` · `dirFor('en') = 'ltr'`؛ مبدّل اللغة يعيد الرسم ويضبط `document.documentElement.dir`.

> **لا قدرة تداول · لا signing/sending · لا execution adapter/stream/decision.**
