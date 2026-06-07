# 12-DESIGN-SYSTEM.md — نظام التصميم البصري/التفاعلي (Design System)

> **الحالة:** مسودة للمراجعة — وثيقة **غير سلطوية**، طبقة **visual / interaction فقط**، مشتقّة من `04-UX-PRODUCT-SPEC.md` و`11-UI-SPEC.md`. تُقرأ بعدهما.
> **النوع:** Design System (tokens · components · patterns · presentation). **ليست** SSOT ولا API ولا Observability Spec ولا مصدر حقيقة للبيانات.
> **قاعدتان حاكمتان:** (1) ما داخل `backticks` اسم **canonical قائم** في SSOT/API/UX أو مرجع وثيقة/قسم؛ **أسماء design tokens تُكتب نصًّا عاديًا لا داخل backticks** لأنها ليست أسماء canonical. (2) **لا اسم/enum/command/resource/event/api_error_code/threshold جديد**، ولا إعادة تعريف `04-UX`/`11-UI-SPEC`؛ DS يعرض ولا يحسب ولا يقرّر truth.

---

## 0. Purpose & Non-Authority
يضبط `12-DESIGN-SYSTEM` **الشكل والسلوك البصري** لواجهة المشروع كي تكون متّسقة وقابلة للبناء Frontend-wise. يستهلك أسماء/معاني SSOT/API/UX القائمة ولا يعيد تعريفها؛ المكوّنات والتدفّقات معرّفة في `11-UI-SPEC`، وهذه الوثيقة تعطيها **grammar بصريًّا** لا تكرّرها. badge/metric tokens **بصرية فقط، لا data enums**؛ أي ترقية إلى data enum أو API value تمرّ ARCH→SSOT. عند التعارض تُغلَّب الوثيقة المعتمدة.

## 1. Design Principles
1. **Traceability first** — لا قرار بلا أثر مرئي (decision/audit).
2. **Safety over speed illusion** — السرعة لا تبرّر زرًّا خطرًا بلا preview/confirm/audit.
3. **Explain before act** — السبب يسبق الفعل.
4. **Honest latency** — اعرض التأخّر/stale/copy delay بصدق، لا تُخفِه.
5. **Progressive disclosure** — ملخّص → evidence → raw عند الطلب (beginner/advanced).
6. **No raw secrets** — لا مفاتيح/أسرار خام في UI/logs/exports.
7. **Bilingual clarity** — العربية والإنجليزية واضحتان لا ترجمة حرفية.
8. **Charts are evidence, not control surfaces** — الشارت ثانوي display-only؛ **console قرار/نسخ/خروج لا trading terminal**.

## 2. Design Tokens
> أسماء الـ tokens أدناه **أمثلة تصميمية غير canonical** (نصّ عادي، لا backticks). الأرقام إرشاد بصري لا عتبات حوكمة.
- **Color:** عائلات دلالية — critical · warning · info · success · neutral · stale · degraded · simulated · paper · real · read-only · blocked. كل لون يقابله نص+أيقونة (لا لون وحده).
- **Typography:** سلّم محدود — page-title · section-title · body · meta · mono؛ أرقام tabular للجداول؛ خط عربي مقروء في الكثافة العالية.
- **Spacing:** سلّم 4/8 (space-1 … space-n).
- **Radius / Border / Elevation / Shadow:** سلالم محدودة لتمييز البطاقات/الطبقات.
- **Motion:** قصيرة وهادفة (feedback/transition)؛ بلا حركة زخرفية تشتّت في المراقبة الطويلة.
- **Z-index / Layering:** Top Bar · Banner · Drawer/Inspector · Modal · Toast.
- **Density:** comfortable · compact · audit-dense.
- **Theme:** dark افتراضي (مراقبة طويلة) + light كامل.

## 3. App Shell Visual Grammar
> التخطيط والسلوك البصري لمناطق `11-UI-SPEC §2` (لا إعادة تعريف محتواها):
- **Top Bar:** يعرض `operating_state` · `real_live_config_valid` · `validation_status` · صحة المزوّد/التدفّق · وضع paper/real (تمييز لوني قاطع) · اللغة/الاتجاه · ساعة حداثة. ثابت دائمًا.
- **Global Safety Banner:** شريط دائم غير قابل للتجاهل عند `operating_state` ∈ {`EXITS_ONLY`·`PAUSED`·`KILLED`} أو عدم صلاحية `real_live_config_valid` أو `provider_degraded`؛ لون critical + نص + أيقونة؛ لا يُدمَج ولا يُخفى.
- **Left Navigation:** الصفحات التسع فقط؛ عرض ثابت قابل للطيّ.
- **Main Workspace:** منطقة العمل + workspace modes داخل الصفحة (لا صفحات جديدة).
- **Right Inspector:** drawer جانبي ثابت العرض، سياقي، permission-aware؛ يتبع العنصر المحدّد.
- **Bottom Operations Panel:** شريط سفلي قابل للطيّ، تدفّق حيّ، مقتطفات محجوبة الأسرار.
- **Command Palette:** overlay مركزي (Cmd/Ctrl-K)؛ بحث + actions مسموحة فقط؛ الفعل الخطر يفتح preview لا تنفيذًا.

## 4. Component Library
قواعد بصرية لكل مكوّن (قابلة للبناء):
- **Cards:** للملخّصات (health · readiness · risk · provider)؛ عنوان + قيمة + حالة + meta (timestamp/source).
- **Tables:** sticky header · sort/filter/search · saved views · pinned columns · expandable rows تفتح Inspector · `tabular-nums` · zebra · hover actions · حالات stale/degraded/unavailable داخل الخلية. لا جداول متداخلة مزدحمة.
- **Timelines:** أفقي/رأسي؛ كل خطوة = status + timestamp + source + reason؛ تُستخدم لـ decision/intent/position/route-exit/audit.
- **Modals:** للأفعال الخطرة فقط؛ تعرض الأثر الدقيق (§8).
- **Toasts:** عابرة للمعلومات؛ **critical لا يكون toast عابرًا** بل Banner/Alert Center.
- **Drawers:** Right Inspector + اللوحات السياقية.
- **Buttons:** هرمية واضحة (primary/secondary/ghost/**danger**)؛ disabled يعرض السبب عند hover/focus.
- **Inputs/Tooltips:** tooltip للمصطلح يربط Help/Glossary.

## 5. Badge Taxonomy
> **visual tokens فقط** — كل badge = لون + نص + أيقونة (لا لون وحده). يعكس قيمًا قائمة للعرض، **لا يُعرّف enum جديدًا**.
- **Status badges:** يعكس `operating_state` / `hunt_status` / `position_state` / `bundle_status`.
- **Risk badges:** يعكس Hard Risk / EV / `wash_fake_activity_risk` / token-safety (`transfer_hook_active`/`token2022_extension_risk`/`hook_upgraded_mid_hold`).
- **Freshness badges:** live / stale / degraded / reconnecting — مشتقّ من `provider_degraded`/`slot_lag`/`last_confirmed_slot`/`last_seen_slot`/`stream_cursors`.
- **Truth-mode badges:** live / delayed / estimated / inferred / **simulated** / **paper** / **real** — مستقلّ عن الحداثة.
- **Read-only / candidate badges:** للأسطح read-only/diagnostic وللأسطح المرشّحة (candidate-aware).
- **Quote badge:** يعكس `quote_mint` (wsol/usdc/unknown)؛ unknown → skipped بلا زرّ.

## 6. Metric & Status Presentation Patterns
> **عرض فقط — لا حساب، لا تعريف truth، لا مصدر بيانات، لا fields.** instrumentation/data contract يبقى في Build/Observability وSSOT/API/DATA.
- كل metric يُعرض بـ: label بشري + value + **source** + **timestamp** + **freshness** + **truth-mode** + رابط provenance/Inspector.
- **unavailable ≠ 0** — المفقود يُعرض "unavailable" مع سببه (`candidate_report_missing_metric_policy`)، لا صفر.
- **estimated/inferred ≠ on-chain truth** — يُوسَم صراحةً.
- أي metric مالي/خطر يفتح Inspector/provenance؛ لا ثقة زائفة برقم بلا سياق.
- **عائلات العرض (عدسة تنظيم فقط):** System/Infrastructure health · Freshness/Truth · Copy/Decision quality · Execution/Landing · Route/Liquidity/Exit · Risk/Safety/Mode · UI performance · Audit/Reporting. كلٌّ يعرض أسماءه القائمة (مثل `discovery_latency_ms`/`signal_to_execution_ms`/`entry_slippage_vs_leader`/`failure_type`/`active_exit_route`).
- **financial/risk-adjusted** (drawdown/Sharpe/Sortino/exposure): تُعرض في Analytics/Reports فقط — **لا داخل Opportunity/Radar** (لا خلط decision context بـ portfolio context). **لا threshold رقمي جديد** (INP/FPS = مرجع tooling لاحق، لا عتبة هنا).

## 7. State Presentation
لكل سطح/صفحة معالجة بصرية موحّدة:
- **loading:** skeleton لا spinner فارغ.
- **empty:** يشرح ماذا يفعل المستخدم (لا "no data" صامتة).
- **stale / degraded / reconnecting:** تمييز بصري لا يُخلط مع live (no-stale-as-live).
- **blocked:** يعرض سبب الحجب + الصلاحية المطلوبة.
- **error:** ماذا/أين/لماذا؟ هل في خطر؟ الخطوة التالية؟ + `request_id` (إن أتاحه API) + Retry/Fix + Open logs/audit.
- **unavailable / partial:** كما §6 (لا 0).
- **populated:** الحالة الطبيعية.

## 8. Danger Zone & Confirmation Patterns
- **Danger Zone:** منطقة بصرية مميّزة (لون danger + فصل مكاني عن الأفعال الحميدة) للأفعال المدمّرة: `trigger_kill_switch` · `emergency_exit_position` · `activate_real_live` · `revoke_signer`/revoke wallet · sweep/rotation/asset transfer.
- **Confirmation flow بصريًّا:** preview (يعرض الأثر الدقيق + route/exit feasibility حيث ينطبق) → confirm عالي الاحتكاك (typed/impact summary للمدمّر/الذي لا يُتراجع) → نتيجة + أثر `audit_event`.
- العنوان والزر يصفان الفعل صراحةً؛ لا زرّ خطر بضغطة واحدة؛ disabled يعرض السبب.

## 9. Secret-Safe Settings Presentation
- مفاتيح المزوّد تُعرض كـ **masked reference** فقط بعد الحفظ — `candidate_provider_key_ref`، **لا raw key أبدًا** (UI/logs/exports/backups/diagnostics/browser state).
- عرض: validation status · آخر تحقّق · سبب الفشل · حالة `candidate_provider_mode`.
- أثر `audit_event` حول register/rotate/revoke؛ الأفعال الخطرة عبر §8.

## 10. RTL/bidi & i18n Visual Rules
- العربية والإنجليزية مواطنان أولان؛ الاتجاه ينقلب كاملًا عبر logical properties.
- **LTR islands** داخل النص العربي للعناوين/tx/hashes/الأرقام/المبالغ/timestamps داخل حاويات bidi-safe (عزل ثنائي الاتجاه) كي لا تنكسر في الجداول.
- label بشري عربي/إنجليزي؛ الاسم التقني القائم يظهر عند الحاجة (`source_of_truth_field` إنجليزي canonical).
- الفاصلة العربية والأرقام tabular في الجداول.

## 11. Accessibility Visual Specifics (WCAG 2.2 AA)
- حجم الهدف ≥ 24×24 CSS px · focus مرئي وغير محجوب (Focus Not Obscured/Appearance) · **لا حالة باللون وحده** (لون+نص+أيقونة) · keyboard navigation كامل · screen-reader labels للحالات/الأفعال الحرجة · بدائل للسحب (Dragging) · Consistent Help ثابت · Redundant Entry.

## 12. Mobile Monitoring-Only Layout
- **Desktop:** التشغيل الكامل (decision trace · settings · reports · wallet management · emergency workflows).
- **Tablet:** monitoring/review/alerts/position details + إقرارات آمنة محدودة (read-oriented).
- **Mobile:** alerts/health/positions monitoring فقط؛ Command Center يتحوّل بطاقات صحّة؛ critical alerts بطاقات كبيرة. **لا أفعال خطرة · لا provider key entry · لا Trading Workspace كامل · لا emergency exit** (إلا بقرار حوكمي لاحق وتجربة confirmation منفصلة).

## 13. AI Explain-Only Presentation
- زرّ **Explain** داخل Inspector/Help، بوسم AI واضح + مراجع provenance/trace.
- **يشرح فقط:** لماذا رُفضت فرصة (`rejected_reason` + Decision Trace) · لماذا مركز في خطر · معنى مصطلح عبر `candidate_glossary_content`/`candidate_glossary_sot_mapping` (مثل `hook_upgraded_mid_hold`) · سبب فشل مفتاح مزوّد · الخطوة التالية.
- **بلا سلطة فعل:** لا auto-trading · لا auto-apply · لا إرسال أوامر · لا تغيير مفاتيح/مزوّدين · لا إخفاء تحذير. أي فعل يبقى عبر preview/confirm/audit. يستهلك بيانات قائمة من API/Data، لا يحسب truth.

## 14. Do/Don't Examples
- **Radar:** Do = جدول فرص + badges + Decision Trace في Inspector. Don't = زرّ شراء أو P&L داخل Radar/Opportunity.
- **Exit:** Do = `manual_exit_position`/`emergency_exit_position` عبر preview → route/exit feasibility (`active_exit_route`) → permission/risk/signer → confirm → `audit_event` → result. Don't = quick sell بضغطة بلا feasibility، أو order ticket، أو بيع من الشارت.
- **Stale metric:** Do = badge stale + timestamp + توقّف عن تقديمه كـ live. Don't = عرض رقم قديم بمظهر live.
- **Unavailable metric:** Do = "unavailable" + السبب. Don't = عرض 0.
- **Secret:** Do = masked `candidate_provider_key_ref` بعد الحفظ. Don't = إظهار raw key بعد الحفظ أو في export/log.
- **RTL:** Do = نص عربي + wallet address/tx كجزيرة LTR معزولة. Don't = ترك العنوان/الرقم ينقلب داخل RTL.
- **AI:** Do = Explain-only يفسّر ويُحيل provenance. Don't = مساعد ينفّذ/يطبّق/يغيّر إعدادًا.

## 15. Non-Authority & No-Drift Guard
1. DS يستهلك أسماء قائمة فقط؛ أسماء design tokens **ليست canonical** ولا توضع داخل backticks.
2. badge/metric tokens **بصرية لا data enums**؛ أي ترقية إلى enum/API value → ARCH→SSOT (تُذكر نصًّا "يحتاج حوكمة").
3. **لا** `field`/`enum`/`command_type`/`resource_type`/`event_type`/`api_error_code`/`stream_channel`/`audit_scope`/threshold جديد.
4. DS **لا يعيد تعريف** `04-UX`/`11-UI-SPEC` ولا يكرّرهما؛ يضيف grammar بصريًّا فقط.
5. DS **ليس مصدر حقيقة** ولا Observability Spec؛ المؤشّرات تُعرض ولا تُحسب، والـ instrumentation في Build.
6. الحُرّاس الموروثة سارية: لا candlestick/RSI/EMA/MACD/100+ indicators · لا TradingView clone/Order Ticket/Trading Platform/DOM · لا buy من Radar/Opportunity · لا P&L داخلها · لا quick sell بلا feasibility · لا raw secrets · لا مساعد ينفّذ · candidate يبقى candidate.

> **خلاصة:** `12-DESIGN-SYSTEM` طبقة عرض وتفاعل تجعل الواجهة متّسقة وقابلة للبناء، تستهلك أسماء SSOT/API/UX القائمة، بـ design tokens غير canonical، وبادجات/مؤشّرات بصرية لا بياناتية — دون توسعة SSOT/API ودون إعادة تعريف أي وثيقة.
