# SSOT — Single Source of Truth / Glossary / State & Event Catalog

> **Priority:** 01 — Foundational (Name Gateway) · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** فهرس الأسماء المُلزِم

**الدور:** فهرس إلزامي للأسماء والحقول والحالات والـ enums، **مستخرَج من `ARCHITECTURE.md v1.8` ولا يضيف إليها**. أي حقل/enum/state/event/status/mode/policy/risk_flag/command لا يدخل أي وثيقة تنفيذية (Config / API / UX / Data Model / Build / Tests / Runbook / Security) قبل تسجيله هنا.

**تراتبية الملكية:** `ARCHITECTURE.md` تملك التعريف والقرار المعماري · `SSOT.md` يملك الفهرسة والاسم الرسمي والقيم المسموحة · Config يملك default/validation/mutability/behavior · API يملك العقود · UX يملك العرض والتفاعل · Data Model يملك التخزين. عند ظهور حقل ناقص/غامض أثناء الاستخراج: **يُحسَم في ARCHITECTURE أولاً ثم يُسجَّل هنا** — لا يُخترَع في SSOT.

**القاعدة الثابتة:** `No field before SSOT` (لكن SSOT لا يسبق ARCHITECTURE كمصدر قرار). الاسم الرسمي في الكود/API/DB هو `source_of_truth_field` فقط؛ الترجمة العربية شرحٌ لا اسم تنفيذ. أي صيغة بديلة (alias) مرفوضة ما لم تُسجَّل صراحةً كـ `deprecated`/`rejected`.

**الأعمدة:** term · source_of_truth_field · type · allowed_values · meaning · owner_document · used_by.

**الحالة:** اكتمل استخراج المجموعات 1–41. المجموعات 1–21 الأساس وNew-Coin Hunting · 22–27 v1.8 Delta candidates · **28–35 F-Elimination candidates (F1–F14)** · **36 Config Policy candidates (تستهلكها CONFIG §13)** · **37 Wave 1 Profit & Paper Truth candidates (تستهلك ARCH §15.9)** · **38 Wave 2 Discovery & Copy Safety candidates (تستهلك ARCH §15.10)** · **39 Wave 3 Reports & Honesty candidates (تستهلك ARCH §15.11)** · **40 Wave 4 Execution/Providers+Data candidates (تستهلك ARCH §15.12)** · **41 Wave 5 Local Ops & Readiness candidates (تستهلك ARCH §15.13)**. لا معلّقات حاجبة؛ كل الحقول الجديدة في Groups 22–41 تبقى `candidate_*` إلى حين تثبيت الأسماء النهائية بعد ARCH→SSOT. المؤجّلات/خارج النطاق مذكورة صراحةً ولا تُسجَّل. SSOT بوّابة للوثائق التنفيذية.

> **قاعدة الـ derived outputs:** حالة مستمرّة تُستعلَم → `derived_field`/`derived_status` · نتيجة عملية لحظية باسم API ثابت → `operation_result_field` · حساب داخلي بلا اسم API ثابت → لا يدخل SSOT.

---

## Group 1 — States (حالات)

### operating_state — حالة تشغيل النظام (المصدر: ARCHITECTURE §10)

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| حالة تشغيل النظام | `operating_state` | state (enum) | `WARMING_UP` · `ACTIVE` · `EXITS_ONLY` · `PAUSED` · `KILLED` | الحالة العامة التي تحكم ما يُسمح للنظام بفعله (دخول/خروج/تحديث) | ARCHITECTURE.md | Config · API · UX · Data Model · Build · Tests · Runbook · Security |
| تهيئة قبل التشغيل | `WARMING_UP` | state value | — | لا دخول ولا تقييم إشارات ولا بناء أوامر؛ تحديث caches + health فقط. الانتقال إلى `ACTIVE` تلقائي بعد اكتمال الجاهزية (priority-fee/Jito-tip cache · protocol constants · RPC green · stream sync · calibration priors · cost pipeline) | ARCHITECTURE.md | API · UX · Build · Tests · Runbook |
| نشط | `ACTIVE` | state value | — | تشغيل عادي: دخول وخروج مسموحان وفق البوابات. لا يُبلَغ إلا بعد اكتمال `WARMING_UP` | ARCHITECTURE.md | API · UX · Build · Tests · Runbook |
| خروج فقط | `EXITS_ONLY` | state value | — | لا صفقات جديدة؛ الخروج من المراكز المفتوحة مسموح. يُفعَّل عند: RPC degraded · stream desync · protocol uncertainty · memory pressure · migration limbo · model drift *warning* · فشل ردم فجوة stream / تجاوز نافذة backfill (24h). زوال تلقائي عند زوال السبب | ARCHITECTURE.md | API · UX · Build · Tests · Runbook · Security |
| موقوف | `PAUSED` | state value | — | لا دخول؛ خروج يدوي أو بقواعد أمان فقط؛ تحديثات caches/health مستمرة. استئناف تلقائي/يدوي، ويفضّل أن يمرّ عبر `WARMING_UP` إذا كانت caches أو health state غير مضمونة | ARCHITECTURE.md | API · UX · Build · Tests · Runbook |
| إيقاف صلب | `KILLED` | state value | — | Hard Kill: يمنع أي دخول/تشغيل عادي فوراً، **لكن يسمح بـ Emergency Exit** للمراكز المفتوحة إن كان أأمن من تركها. يُفعَّل عند: protocol constant *changed* · model drift *مؤكد* · daily loss/drawdown limit · global kill switch. **الاستئناف بتدخّل إنسان فقط** | ARCHITECTURE.md | API · UX · Build · Tests · Runbook · Security |

### position_state — حالة المركز المفتوح (المصدر: ARCHITECTURE §15.1 PositionLifecycleStateMachine)

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| حالة دورة حياة المركز | `position_state` | state (enum) | `OPENING` · `OPEN` · `PARTIALLY_EXITING` · `EXIT_PENDING` · `MIRROR_SELL_PENDING` · `MIGRATION_PENDING` · `CLOSED` · `CLOSED_WITH_DUST` · `FAILED_ENTRY` · `FAILED_EXIT` | حالة صريحة لكل مركز تمنع تنفيذ أمرين متعارضين عليه؛ لا action جديد إلا إن سمحت به الحالة الحالية | ARCHITECTURE.md | Config · API · UX · Data Model · Build · Tests |
| قيد الفتح | `OPENING` | state value | — | أمر الدخول قيد التنفيذ ولم يكتمل الـ fill بعد | ARCHITECTURE.md | API · UX · Data Model · Tests |
| مفتوح | `OPEN` | state value | — | مركز قائم مُدار وفق المصفوفة وقواعد الخروج | ARCHITECTURE.md | API · UX · Data Model · Tests |
| خروج جزئي جارٍ | `PARTIALLY_EXITING` | state value | — | تنفيذ بيع جزئي جارٍ (partial/mirror) على المركز | ARCHITECTURE.md | API · UX · Data Model · Tests |
| خروج معلّق | `EXIT_PENDING` | state value | — | نيّة خروج مسجّلة بانتظار التنفيذ (route/feasibility) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| بيع مرآة معلّق | `MIRROR_SELL_PENDING` | state value | — | نيّة mirror-sell معلّقة بانتظار route صالح (= نيّة §4.2، لا حالة مستقلّة) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| انتقال معلّق | `MIGRATION_PENDING` | state value | — | المركز أثناء `migration_phase = MIGRATION_IN_PROGRESS` (ربط لا تكرار — §4.1) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| مغلق | `CLOSED` | state value | — | المركز خرج بالكامل وأُغلق | ARCHITECTURE.md | API · UX · Data Model · Tests |
| مغلق بغبار متبقٍّ | `CLOSED_WITH_DUST` | state value | — | أُغلق مع بقاء dust قيمته أقل من تكلفة بيعه؛ بلا route checks أو مراقبة عالية التردد (متّسق مع §14) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| فشل دخول | `FAILED_ENTRY` | state value | — | تعذّر فتح المركز (فشل تنفيذ الدخول) | ARCHITECTURE.md | API · UX · Data Model · Tests · Runbook |
| فشل خروج | `FAILED_EXIT` | state value | — | تعذّر تنفيذ الخروج؛ يُمرَّر إلى FailedTransactionClassifier وسياسة الطوارئ | ARCHITECTURE.md | API · UX · Data Model · Tests · Runbook |

### migration_phase — مرحلة هجرة التوكن (المصدر: ARCHITECTURE §4.1 Migration Handoff Protocol)

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| مرحلة الهجرة | `migration_phase` | state (enum) | `PRE_MIGRATION` · `MIGRATION_APPROACHING` · `MIGRATION_IN_PROGRESS` · `LP_MINTED` · `POST_MIGRATION_ACTIVE` | طور انتقال التوكن من Pump.fun bonding curve إلى PumpSwap؛ يُكتشَف on-chain فقط (لا DexScreener) | ARCHITECTURE.md | API · UX · Data Model · Build · Tests |
| ما قبل الهجرة | `PRE_MIGRATION` | state value | — | التوكن على bonding curve، لا مؤشّر هجرة بعد (تحكّم Brain A) | ARCHITECTURE.md | API · UX · Tests |
| اقتراب الهجرة | `MIGRATION_APPROACHING` | state value | — | اقتراب من عتبة التخرّج (~85 SOL / ~$69k)؛ منع دخول جديد قرب graduation trap | ARCHITECTURE.md | API · UX · Tests |
| الهجرة جارية (limbo) | `MIGRATION_IN_PROGRESS` | state value | — | migration limbo: لا دخول/scale-in/بيع أعمى متكرّر؛ الخروج مسموح فقط عند route صالح + feasibility + slippage ضمن السقف | ARCHITECTURE.md | API · UX · Build · Tests · Runbook |
| سُكّت السيولة | `LP_MINTED` | state value | — | إنشاء الـ canonical PumpSwap pool؛ نقطة *مرشّحة* لتسليم التحكّم إلى Brain B بعد تحقّق canonical pool و route availability (LP_MINTED وحدها لا تكفي إن لم يصح الـ route بعد) | ARCHITECTURE.md | API · UX · Build · Tests |
| ما بعد الهجرة نشط | `POST_MIGRATION_ACTIVE` | state value | — | التوكن يُدار على PumpSwap/Open Market بواسطة Brain B (route/reverse quote/pool state) | ARCHITECTURE.md | API · UX · Build · Tests |

---

## Group 2 — Modes & Policies (أنماط وسياسات)

> **القيم أدناه حُسمت في ARCHITECTURE ثم سُجّلت هنا كقيم تنفيذية رسمية.** كل القيم مأخوذة من ARCHITECTURE.md (لا اختراع). السياسات الثلاث `transfer_exit_policy` · `scale_in_policy` · `conflict_resolution` أُقرّت قيمها في ARCHITECTURE ثم سُجّلت أدناه.

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| نمط النسخ | `copy_mode` | mode (enum) | `follow_entry_user_exit` · `full_mirror` | كيفية نسخ المحفظة لكل محفظة: دخول مع خروج المستخدم بهدفه، أو نسخ كامل شراءً وبيعاً (§1.1/§4.2) | ARCHITECTURE.md | Config · API · UX · Data Model · Tests |
| دخول + خروج المستخدم | `follow_entry_user_exit` | mode value | — | يدخل مع المحفظة ويخرج عند `take_profit_pct` أو قواعد الأمان؛ بيع المحفظة الجزئي/الكامل = risk modifier لا أمر | ARCHITECTURE.md | Config · API · UX · Tests |
| نسخ كامل | `full_mirror` | mode value | — | يتابع المحفظة شراءً وبيعاً (mirror نسبي)؛ خروجها الكامل → خروج كامل بشرط feasibility | ARCHITECTURE.md | Config · API · UX · Tests |
| وضع بوابة EV | `ev_gate_mode` | mode (enum) | `strict` · `warning_only` | يحدّد هل بوابات الربحية حاجبة أم تحذيرية (§5/§Pipeline 65%) | ARCHITECTURE.md | Config · API · UX · Tests · Runbook |
| صارم | `strict` | mode value | — | (الافتراضي) net_expectancy & profit_factor & LCB & drawdown & exit_success بوابات دخول فعلية تحجب | ARCHITECTURE.md | Config · API · UX · Tests |
| تحذيري فقط | `warning_only` | mode value | — | فشل بوابات الربحية → `WARNING_CRITICAL` بلا حجب (باختيار صريح)؛ **لا يتجاوز أي حدّ خسارة/طبقة أمان صلبة** | ARCHITECTURE.md | Config · API · UX · Tests · Runbook |
| وضع تحديد الحجم | `sizing_mode` | mode (enum) | `fixed_usd` · `fixed_sol` · `pct_of_capital` | طريقة تحديد حجم الصفقة التي يختارها المستخدم (§4) | ARCHITECTURE.md | Config · API · UX · Data Model · Tests |
| مبلغ ثابت بالدولار | `fixed_usd` | mode value | — | مبلغ ثابت بالدولار يُحوّل إلى SOL لحظة التنفيذ بسعر آنيّ | ARCHITECTURE.md | Config · API · UX · Tests |
| مبلغ ثابت بالـ SOL | `fixed_sol` | mode value | — | مبلغ ثابت بعملة SOL مباشرةً | ARCHITECTURE.md | Config · API · UX · Tests |
| نسبة من رأس المال | `pct_of_capital` | mode value | — | نسبة مئوية من رأس المال المتاح (`size = capital × pct`) | ARCHITECTURE.md | Config · API · UX · Tests |
| سياسة البيع الجزئي | `partial_sell_policy` | policy (enum) | `risk_modifier_only` · `proportional_mirror` · `ignore_below_threshold` · `tighten_trailing_only` · `manual_review` | كيف يُعامَل البيع الجزئي للمحفظة لكل محفظة (§4.2). الافتراضي: follow_entry → `risk_modifier_only`؛ full_mirror → `proportional_mirror` | ARCHITECTURE.md | Config · API · UX · Tests |
| سياسة الخروج عند التحويل | `transfer_exit_policy` | policy (enum) | `no_auto_exit` · `de_risk_partial` · `exit_on_transfer` | سلوك المركز عند transfer out: لا خروج (افتراضي) · de-risk جزئي عند تحويل عالي الخطر · خروج صريح باختيار المستخدم. (`disable_new_adds` تبقى منفصلة ومُلزِمة لأي transfer غير known_cluster) (§4.2) | ARCHITECTURE.md | Config · API · UX · Tests |
| سياسة الزيادة | `scale_in_policy` | policy (enum) | `no_add` · `mirror_proportional` · `limited_add` | كيف تُعامَل زيادة المحفظة لنفس التوكن: لا زيادة (follow_entry افتراضي) · نسخ نسبي (full_mirror) · زيادة محدودة بإعداد المستخدم بشرط EV/exposure/route (§4.2) | ARCHITECTURE.md | Config · API · UX · Tests |
| حسم تضارب المحافظ | `conflict_resolution` | policy (single value) | `risk_signal_wins_by_default` | عند تضارب عدة محافظ على نفس التوكن: تغلب إشارة الخطر ما لم تكن إشارة الشراء أقوى بوضوح بالـ score والـ EV. قيمة واحدة لا بدائل (§4.2) | ARCHITECTURE.md | Config · API · UX · Tests |
| العقل الاستراتيجي | `strategy_brain` | enum | `brain_a` · `brain_b` | اختيار/تمييز العقل (labels عرض: brain_a = Brain A/Bonding Curve · brain_b = Brain B/PumpSwap). ينطبق التطبيع ذاته على `current_control_brain`/`entry_brain`/`issuing_brain` (§4/§13) | ARCHITECTURE.md | Config · API · UX · Tests |
| وضع التنفيذ | `execution_mode` | enum | `auto` · `manual_approval` · `helius_sender` · `jito_send` · `jito_bundle` · `jupiter_route` | خيارات مسار/أسلوب التنفيذ (مطابقة 1:1 لـ labels §13) | ARCHITECTURE.md | Config · API · UX · Tests |
| تفعيل زوج USDC | `usdc_quote_enabled` | field (config flag, global policy) | `true` · `false` (default `false`) | يفعّل مسار USDC-quoted tokens؛ عند `false` تُخطّى توكنات USDC عبر `rejected_reason = unknown_quote_mint` وفق Fail-Safe-Not-Fail-Open؛ يستهلك `quote_mint` (G16)؛ لا يتجاوز Hard Risk/EV gate | ARCHITECTURE.md §4.1 | Config · API · UX · Data Model · Tests |

---

## Group 3 — Intents & Events (نوايا وأحداث)

> المؤصَّل بالكامل: `intent_type` · `failure_type` · `bundle_status`. و`copy_event` حُسم كـ enum رسمي من 17 قيمة مطابقة لسيناريوهات Copy Event Decision Matrix في ARCHITECTURE. مخرجات التصنيف `HIGH_EXIT_RISK` و`WHIPSAW_OR_MEV_LIKE` هي **classification flags ناتجة، لا قيم `copy_event`**.

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| نوع النيّة | `intent_type` | event (enum) | `BUY_INTENT` · `SELL_INTENT` · `SCALE_IN_INTENT` · `MIRROR_SELL_INTENT` · `EMERGENCY_EXIT_INTENT` · `CANCEL_INTENT` | نيّة التنفيذ المسجّلة في IntentLedger قبل بناء أي order (§15.1) | ARCHITECTURE.md | API · UX · Data Model · Build · Tests |
| معرّف النيّة | `intent_id` | field (id) | — | مُعرّف فريد لكل نيّة؛ لا OrderBuilder بلا `intent_id`، ولا retry بلا نفسه أو replacement intent صريح | ARCHITECTURE.md | API · Data Model · Build · Tests |
| العقل المُصدِر للنيّة | `issuing_brain` | field | = قيمة `current_control_brain` لحظة الإصدار | يربط كل intent بالعقل المسيطر لحظتَه (يمنع Brain A إصدار نيّة على مركز انتقل لـ Brain B) | ARCHITECTURE.md | API · Data Model · Build · Tests |
| نوع الفشل | `failure_type` | event (enum) | `SlippageExceeded` · `BlockhashExpired` · `AccountInUse` · `ComputeBudgetExceeded` · `InsufficientFunds` · `RouteInvalid` · `TokenAccountMissing` · `ProgramError` · `RPCDropped` · `BundleFailed` · `Unknown` | تصنيف فشل المعاملة في FailedTransactionClassifier؛ لكل نوع retry policy و`failed_attempt_cost` مستقلّ (§15) | ARCHITECTURE.md | API · UX · Data Model · Build · Tests · Runbook |
| حالة الـ bundle | `bundle_status` | status (enum) | `Pending` · `Failed` · `Landed` · `Invalid` · `STALE_BUNDLE` | حالة الـ Jito bundle عبر `getInflightBundleStatuses` (نافذة 5 دقائق)؛ `STALE_BUNDLE` = Pending بعد TTL بلا rebroadcast (§15) | ARCHITECTURE.md | API · UX · Data Model · Tests · Runbook |
| حدث rollback شبكي | `NETWORK_ROLLBACK_EVENT` | event | — | عند fork mismatch بعد `processed`؛ يُطلق سياسة خروج/إلغاء (§14) | ARCHITECTURE.md | API · Data Model · Tests · Runbook |
| حدث نسخ من المحفظة المتبوعة | `copy_event` | event (enum) | `leader_buy` · `leader_scale_in` · `leader_partial_sell` · `leader_full_exit` · `leader_transfer_out` · `transfer_known_cluster` · `transfer_unknown_single` · `transfer_split_unknown` · `transfer_cex_like` · `transfer_creator_dev` · `leader_rebuy` · `whipsaw_detected` · `multi_wallet_conflict` · `leader_inactive_token_weak` · `leader_exit_migration_limbo` · `leader_sell_route_unhealthy` · `entry_slippage_exceeds_leader` | حدث من المحفظة المنسوخة يُدخَل إلى Position Manager (الـ17 سيناريو، §4.2). مخرجات التصنيف (`HIGH_EXIT_RISK`/`WHIPSAW_OR_MEV_LIKE`) flags ناتجة لا قيم copy_event | ARCHITECTURE.md | API · UX · Data Model · Tests |
| إشارة خطر خروج عالية | `HIGH_EXIT_RISK` | classification flag | — | **flag ناتج** عن `copy_event = transfer_cex_like` (لا قيمة copy_event) (§4.2 صفّ 9) | ARCHITECTURE.md | API · UX · Tests |
| سلوك whipsaw/MEV | `WHIPSAW_OR_MEV_LIKE` | classification flag | — | **flag ناتج** عن `copy_event = whipsaw_detected` → خفض copyability ومنع re-entry فوري (لا قيمة copy_event) (§4.2 صفّ 12) | ARCHITECTURE.md | API · UX · Tests |

---

## Group 4 — Operational Fields (حقول تشغيلية)

> كل الحقول أدناه مؤصَّلة صراحةً في ARCHITECTURE.md (§4.1/§4.2/§15.1/§13). تمييز اسم رسمي واحد: `disable_new_adds` هو المعتمد؛ صيغة `disable_adds` (وردت مرّة في صفّ split §4.2) **alias مرفوض → يُوحَّد إلى `disable_new_adds`**.

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| العقل المسيطر الحالي | `current_control_brain` | field (per-position) | `brain_a` · `brain_b` | العقل الذي يدير المركز الآن؛ كل أحداث المصفوفة تُنفَّذ عبره (§4.1). Brain A/Brain B = labels عرض فقط | ARCHITECTURE.md | API · UX · Data Model · Build · Tests |
| عقل الدخول | `entry_brain` | field (per-position) | `brain_a` · `brain_b` | العقل الذي فُتح به المركز؛ يبقى للسجل ولا يتغيّر بعد الهجرة | ARCHITECTURE.md | API · Data Model · Tests |
| طور سوق المركز | `market_phase` | field (per-position) | = قيم `migration_phase` | طور السوق الحالي للمركز (يعكس `migration_phase`) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| مسار الخروج النشط | `active_exit_route` | field (per-position) | — (route reference) | الـ route المعتمد حالياً لخروج المركز (Pump.fun curve / PumpSwap / Jupiter) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| منع الإضافات الجديدة | `disable_new_adds` | field (flag, bool) | `true` · `false` | يمنع *زيادة* المركز فقط (لا بيع)؛ يُفعَّل عند أي transfer out لوجهة غير `known cluster` وحالات الخطر (§4.2) | ARCHITECTURE.md | Config · API · UX · Data Model · Tests |
| البيوع الصغيرة المتراكمة | `cumulative_ignored_sell` | field (per-wallet, number/pct) | — | مجموع البيوع الجزئية تحت `min_mirror_sell_pct`؛ يُنفَّذ mirror عند تجاوز المجموع العتبة ثم reset = 0 (§4.2) | ARCHITECTURE.md | Config · API · Data Model · Tests |
| أقصى انزلاق دخول مقابل القائد | `max_entry_slippage_vs_leader` | field (per-wallet, number/pct) | — | الحد الأقصى لفرق سعر دخولنا عن دخول المحفظة؛ تجاوزه → reject/reduce/watch-only. المعادلة: `(our_expected_entry_price − leader_entry_price) / leader_entry_price` (§4.2) | ARCHITECTURE.md | Config · API · UX · Tests |
| بوابة الورقي الذاتية | `user_enabled_paper_gate` | field (flag, bool) | `true` · `false` (default `false`) | إن فعّله المستخدم أصبح PAPER قيداً ذاتياً يحجب الدخول حتى اجتياز القبول؛ افتراضاً PAPER استرشادي لا حاجب (§3/§Pipeline 5%) | ARCHITECTURE.md | Config · API · UX · Tests |

---

## Group 5 — Infrastructure / Health / Readiness (حالات البنية والصحّة والجاهزية)

> **تنبيه استخراج مهم:** حالات البنية في ARCHITECTURE.md **موصوفة كأعلام منطقية (flags) وحقول قيمية وسلوك، لا كـ enums حالة معدّدة رسمياً**. لذلك سُجِّل المؤصَّل صراحةً (`provider_degraded`, `slot_lag`, `last_seen_slot`, `last_confirmed_slot`, `WARNING_CRITICAL`)، وحُسمت الحالات المركّبة بعدم اختراع enums إضافية إلا حيث ثُبّت ذلك صراحةً (`protocol_constant_status = green | changed`).

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| تدهور المزوّد | `provider_degraded` | field (flag, bool) | `true` · `false` | يُفعَّل عند تأخّر المزوّد الأساسي عن أقرانه فوق العتبة → منع دخول + EXITS_ONLY أو failover (§15 SlotLagMonitor) | ARCHITECTURE.md | API · UX · Tests · Runbook |
| تأخّر الـ slot | `slot_lag` | field (number) | — | فرق أعلى slot مرصود بين المزوّد الأساسي وأقرانه؛ يُسجَّل في RPCHealthMonitor والـ Audit Trail (§15) | ARCHITECTURE.md | API · UX · Data Model · Tests · Runbook |
| آخر slot مرصود | `last_seen_slot` | field (number) | — | آخر slot استقبله الـ stream؛ يُستخدم في StreamGapRecovery (§15) | ARCHITECTURE.md | API · Data Model · Tests · Runbook |
| آخر slot مؤكّد | `last_confirmed_slot` | field (number) | — | آخر slot موثوق للـ replay/backfill عند reconnect (نافذة 24h) (§15) | ARCHITECTURE.md | API · Data Model · Tests · Runbook |
| تحذير حرج معروض | `WARNING_CRITICAL` | status (display) | — | تحذير يُعرض بصدق دون حجب (نقص Readiness أو `ev_gate_mode = warning_only`)؛ نصّ ثابت لحالة warning-only (§5/§15.1) | ARCHITECTURE.md | UX · API · Runbook |
| حالة ثوابت البروتوكول | `protocol_constant_status` | status (enum) | `green` · `changed` | حالة ProtocolConstantMonitor؛ `changed` → `KILLED` (§10) | ARCHITECTURE.md | API · UX · Tests · Runbook |

### قرارات إغلاق enums البنية (محسومة — لا تُخترَع enums زائدة)
- **`provider_health` / `rpc_degradation_state`:** **لا enum مستقل.** يُمثَّل بالمؤصَّل: `provider_degraded` (bool) + `slot_lag` (value). أي عرض ثلاثي (green/degraded/down) يُحسَم في UX/Ops لا هنا.
- **`stream_gap_status`:** **لا enum مستقل.** يُمثَّل بـ `last_seen_slot`/`last_confirmed_slot` + انعكاس النتيجة في `operating_state = EXITS_ONLY` عند gap غير قابل للردم.
- **`slot_lag_status`:** **لا enum مستقل.** يكفي `slot_lag` (value) + `provider_degraded` (bool).
- **`bundle_observer_status`:** **لا enum مستقل.** يكفي `bundle_status` (Group 3)؛ ومكوّن الـ observer يدخل Readiness Checklist كـ active/missing.
- **`protocol_constant_status`:** ✅ مُثبَّت أعلاه (`green` · `changed`).
- **`readiness_status`:** يُبقى `WARNING_CRITICAL` كـ display/status مؤصَّل؛ لا تُضاف `ready`/`not_ready` الآن.


---

## Group 6 — Risk Limits (حدود المخاطر الصلبة — Hard Risk)

> كلها **Hard Risk limits**: مُلزِمة دائماً، لا يتجاوزها `ev_gate_mode = warning_only` (ARCHITECTURE §5/§10). `_pct` = نسبة · `_usdt` = قيمة مطلقة.

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| أقصى خسارة يومية (نسبة) | `max_daily_loss_pct` | field (number, pct) | — | حد الخسارة اليومية كنسبة؛ تجاوزه → Daily Loss Kill (KILLED) | ARCHITECTURE.md | Config · API · UX · Tests · Runbook |
| أقصى خسارة يومية (USDT) | `max_daily_loss_usdt` | field (number, usdt) | — | حد الخسارة اليومية بقيمة USDT مطلقة؛ تجاوزه → USDT Loss Kill | ARCHITECTURE.md | Config · API · UX · Tests · Runbook |
| أقصى drawdown إجمالي | `max_total_drawdown_pct` | field (number, pct) | — | حد drawdown صلب على الحساب/المحفظة؛ مُلزِم دائماً (يختلف عن `max_expected_drawdown_pct` الخاص بـ EV) | ARCHITECTURE.md | Config · API · UX · Tests · Runbook |
| أقصى عدد مراكز مفتوحة | `max_open_positions` | field (integer) | — | حد عدد المراكز المتزامنة | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى حجم مركز | `max_position_size_pct` | field (number, pct) | — | حد حجم المركز الواحد كنسبة من رأس المال | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى تعرّض لتوكن | `max_token_exposure_pct` | field (number, pct) | — | حد التعرّض الكلي لتوكن واحد كنسبة | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى تعرّض لمنشئ | `max_creator_exposure_pct` | field (number, pct) | — | حد التعرّض لتوكنات منشئ واحد كنسبة | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى تعرّض لكلاستر | `max_cluster_exposure_pct` | field (number, pct) | — | حد التعرّض لكلاستر محافظ واحد كنسبة | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى تعرّض ميمات مترابطة | `max_correlated_meme_exposure_pct` | field (number, pct) | — | حد التعرّض الكلي لميمات مترابطة (correlation risk) كنسبة | ARCHITECTURE.md | Config · API · UX · Tests |

## Group 7 — EV Acceptance Thresholds (عتبات قبول EV)

> كلها **EV thresholds**: تخضع لـ `ev_gate_mode` (strict تحجب / warning_only → WARNING_CRITICAL)، ولا تتجاوز Hard Risk (ARCHITECTURE §5).

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| أدنى توقّع صافٍ | `minimum_net_expectancy` | field (number) | — | الحد الأدنى للـ Net Expectancy بعد كل التكاليف (يجب > 0) | ARCHITECTURE.md | Config · API · UX · Tests |
| أدنى profit factor | `minimum_profit_factor` | field (number) | — | الحد الأدنى لـ Profit Factor | ARCHITECTURE.md | Config · API · UX · Tests |
| أدنى حدّ ثقة سفلي | `minimum_lower_confidence_bound` | field (number) | — | الحد الأدنى لـ Lower Confidence Bound (LCB) | ARCHITECTURE.md | Config · API · UX · Tests |
| أدنى حجم عيّنة | `minimum_sample_size` | field (integer) | — | الحد الأدنى لحجم العيّنة (الفعّال، بعد تصحيح clustering) | ARCHITECTURE.md | Config · API · UX · Tests |
| أدنى معدّل نجاح خروج | `minimum_exit_success_rate` | field (number, pct) | — | الحد الأدنى لاحتمال نجاح الخروج | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى drawdown متوقّع | `max_expected_drawdown_pct` | field (number, pct) | — | **EV threshold** (لا Hard Risk): أقصى drawdown متوقّع من توزيع EV؛ يخضع لـ `ev_gate_mode` | ARCHITECTURE.md | Config · API · UX · Tests |

## Group 8 — Per-Wallet / Sizing / Execution Config (إعدادات per-wallet والحجم والتنفيذ)

> الفئة B: سلوكها محسوم في ARCHITECTURE (§4/§4.2/§13/§15)، سُجّلت هنا قبل دخول Config.

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| قيمة الحجم | `sizing_value` | field (number) | — | الرقم المقترن بـ `sizing_mode` (دولار/SOL/نسبة) | ARCHITECTURE.md | Config · API · UX · Tests |
| مرجع رأس المال | `capital_reference` | field | — | مصدر رأس المال المستخدَم عند `sizing_mode = pct_of_capital` | ARCHITECTURE.md | Config · API · Tests |
| تفعيل المتابعة | `follow_enabled` | field (flag, bool) | `true` · `false` | تفعيل/تعطيل متابعة محفظة منسوخة | ARCHITECTURE.md | Config · API · UX · Tests |
| تفعيل نسخ الزيادات | `copy_adds_enabled` | field (flag, bool) | `true` · `false` | يسمح بـ mirror scale-in في full_mirror | ARCHITECTURE.md | Config · API · UX · Tests |
| نسخ الزيادات لـ follow_entry | `copy_adds_for_follow_entry` | field (flag, bool) | `true` · `false` | يسمح بزيادة محدودة في follow_entry_user_exit | ARCHITECTURE.md | Config · API · UX · Tests |
| مهلة إعادة الشراء | `rebuy_cooldown` | field (duration) | — | المدة قبل السماح بـ rebuy بعد خروج | ARCHITECTURE.md | Config · API · UX · Tests |
| نافذة whipsaw | `whipsaw_window` | field (duration) | — | الفاصل الذي يُصنّف الدخول/الخروج السريع كـ whipsaw | ARCHITECTURE.md | Config · API · UX · Tests |
| عقوبة whipsaw | `whipsaw_penalty` | field (number) | — | خفض copyability عند رصد whipsaw | ARCHITECTURE.md | Config · API · Tests |
| تجاوز إعادة الدخول بعد whipsaw | `allow_whipsaw_reentry_override` | field (flag, bool) | `true` · `false` | يسمح بـ re-entry فوري رغم whipsaw (override صريح) | ARCHITECTURE.md | Config · API · UX · Tests |
| عتبة بيع جزئي منخفضة | `partial_sell_low_threshold` | field (number, pct) | — | عتبة تصنيف البيع الجزئي «منخفض الخطر» | ARCHITECTURE.md | Config · API · UX · Tests |
| عتبة بيع جزئي متوسطة | `partial_sell_medium_threshold` | field (number, pct) | — | عتبة «متوسط الخطر» | ARCHITECTURE.md | Config · API · UX · Tests |
| عتبة بيع جزئي مرتفعة | `partial_sell_high_threshold` | field (number, pct) | — | عتبة «مرتفع الخطر» | ARCHITECTURE.md | Config · API · UX · Tests |
| عتبة بيع جزئي كبرى | `partial_sell_major_threshold` | field (number, pct) | — | عتبة «إشارة خروج كبرى» | ARCHITECTURE.md | Config · API · UX · Tests |
| نسبة جني الربح | `take_profit_pct` | field (number, pct) | — | هدف الربح per-wallet المستخدَم عند `copy_mode = follow_entry_user_exit`؛ يُتجاهَل عند `full_mirror`؛ يكمّل `stop_loss_pct` لكنه **ليس Hard Risk** | ARCHITECTURE.md | Config · API · UX · Tests |
| أدنى نسبة بيع مرآة | `min_mirror_sell_pct` | field (number, pct) | — | عتبة per-wallet لتنفيذ mirror sell في `full_mirror`؛ بيوع القائد تحتها تتراكم في runtime `cumulative_ignored_sell` حتى بلوغ العتبة ثم reset حسب السياسة القائمة (§4.2) | ARCHITECTURE.md | Config · API · UX · Data Model · Tests |
| TTL الـ bundle | `bundle_ttl_slots` | field (integer, slots) | — | عمر الـ Jito bundle بالـ slots؛ إعداد لا رقم ثابت (§14/§15) | ARCHITECTURE.md | Config · API · Tests · Runbook |
| رسوم المنصّة (داخلي) | `platform_fee_bps` | field (number, bps) | — (default `0`) | رسوم المنصّة بالـ basis points؛ canonical داخلي. default 0 (§15 PlatformFeeGuard) | ARCHITECTURE.md | Config · API · Tests |
| رسوم المنصّة (Jupiter) | `platformFeeBps` | external alias | — | **external Jupiter alias فقط** لـ `platform_fee_bps` (لا canonical داخلي) | ARCHITECTURE.md | API |

## Group 9 — Config Versioning (إصدار الإعدادات)

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| نسخة الإعدادات | `config_version` | field (revision id) | — (integer/hash — يحدّده Config) | revision id للإعدادات النشطة (monotonic أو immutable id) | ARCHITECTURE.md | Config · API · Data Model · Tests |
| نسخة إعدادات الدخول | `config_version_at_entry` | field (revision id, per-position) | — | نسخة الإعدادات التي دخل بها المركز؛ تُجمّد عليها إعدادات الاستراتيجية (لا الأمان) (§15.1) | ARCHITECTURE.md | Config · API · Data Model · Tests |

## Rejected Aliases (أسماء مرفوضة — لا تُستخدم)

| rejected alias | canonical | السبب |
|---|---|---|
| `max_drawdown_allowed` | `max_total_drawdown_pct` (Hard Risk) **أو** `max_expected_drawdown_pct` (EV) | غامض: لا يميّز drawdown الحقيقي عن expected drawdown من EV |
| `max_position_size` | `max_position_size_pct` | بلا وحدة — لبس النسبة بالقيمة المطلقة |
| `max_token_exposure` | `max_token_exposure_pct` | بلا وحدة |
| `max_correlated_meme_exposure` | `max_correlated_meme_exposure_pct` | بلا وحدة |
| `platformFeeBps` | `platform_fee_bps` | camelCase خارجي؛ يبقى external Jupiter alias فقط لا canonical داخلي |
| `leader_user_price_delta` | `entry_slippage_vs_leader` | إعادة استخدام اسم §4.2؛ قياس محقّق مقابل عتبة `max_entry_slippage_vs_leader` |
| `name_spoof_risk` | `name_impersonation_score` | توحيد تسمية إشارة انتحال الاسم |
| `opportunity_class` | `hunt_status` | توحيد دورة حياة الفرصة في enum واحد |
| `max_token_age_for_entry` | `fast_hunt_window_ms` | دمج اسمين لمفهوم نافذة الصيد |
| `entry_window_ms` | `fast_hunt_window_ms` | دمج اسمين لمفهوم نافذة الصيد |
| `copy_entry_user_exit` | `follow_entry_user_exit` | alias مرفوض للنمط الافتراضي |
| `max_position_size_sol` | — (مرفوض) | مغطّى بـ `sizing_mode = fixed_sol` + `max_position_size_pct` |
| token/opportunity `WARMING_UP` | — (مرفوض) | يصطدم بـ `operating_state`/`execution_wallet_status`؛ الجاهزية عبر `token_readiness_score`/`min_token_readiness` لا حالة |
| `wallet_trust_score` (مركّب مُعتم) | مكوّنات Group 18 + `candidate_wallet_net_copyability_rank` | درجة مركّبة واحدة تُخفي السبب وتغري بـ Goodhart؛ نُبقي المكوّنات شفّافة + ranking (v1.8) |
| `approved_copy_signal` | `copy_signal_candidate` (`candidate_opportunity_lifecycle`) | الاسم يوحي بأمر تنفيذ؛ الفرصة ليست أمر شراء (v1.8) |
| `buy_opportunity` / `execute_opportunity` | — (مرفوض دائماً) | لا تحويل radar/`accepted` إلى تنفيذ مباشر |
| order-book / depth field في سياق AMM | `candidate_liquidity_drain_metric` / `candidate_expected_slippage_estimate` | لا CLOB في Pump.fun/PumpSwap؛ depth فقط حيث يدعمه المصدر (v1.8) |
| `apply_recommendation` (تطبيق مباشر) | `preview_recommendation_application` → `request_config_update_from_recommendation` → `apply_config_version` | لا auto-apply ولا مسّ strategy/risk/live مباشرةً (v1.8) |
| `realized_pnl` · `unrealized_pnl` · `fees_paid` · `slippage_cost` · `net_pnl` · `fee_amount` (legacy غير مسبوقة) | `candidate_realized_pnl` · `candidate_unrealized_pnl` · `candidate_fees_total` · `candidate_slippage_cost` (G22) | F1: الأسماء القديمة غير المسبوقة مرفوضة؛ المسار = read-model المسبوق فقط |
| `current_price` / `candidate_current_price` | `candidate_current_mark_view` (read-view) + `candidate_mark_*` (G28) | F2: لا «current price» مجهول/مستقل؛ كل سعر type+provenance+timestamp+status |
| `exit_all_positions` · `batch_exit_all_positions` (atomic bypass) | `candidate_cmd_preview_batch_exit` → `candidate_cmd_request_batch_exit` (orchestration per-position، G33) | F9: الأمر الذرّي مرفوض للأبد؛ لا mass exit صامت يتجاوز per-position checks |
| `behavior_shift_flag` | `candidate_wallet_behavior_drift_flag` (G26) | حُسم في v1.8؛ لا يُستخدم الاسم القديم |


---

## Group 10 — Derived API / Readiness Outputs (مخرجات مشتقّة)

> **ليست Config fields ولا Data Model fields دائمة.** نتائج مشتقّة (computed) لها أسماء API/UX ثابتة، فتُسجَّل هنا التزاماً بـ No field before SSOT. **قاعدة التصنيف:** حالة مستمرّة تُستعلَم → `derived_field`/`derived_status` · نتيجة عملية لحظية باسم ثابت → `operation_result_field` · حساب داخلي بلا اسم API ثابت → لا يدخل SSOT.

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| صلاحية تكوين REAL-LIVE | `real_live_config_valid` | derived_field / readiness_result | bool | هل تكوين REAL-LIVE صالح بناءً على Hard Risk completeness وقواعد التحقّق (§Config 6/10). اختزال bool لـ `validation_status` في نطاق REAL-LIVE | ARCHITECTURE.md | API · UX · Runbook · Tests |
| حالة التحقّق | `validation_status` | derived_status | `valid` · `warning` · `invalid` | نتيجة تحقّق عامة لنطاق config أو resource محدّد؛ الأعمّ الذي يختزله `real_live_config_valid` لنطاق REAL-LIVE | ARCHITECTURE.md | API · UX · Tests |
| الحاجة إلى ترحيل الإعداد | `config_migration_required` | operation_result_field | bool | نتيجة لحظية لعملية تعديل إعدادات؛ `true` إذا مسّ التعديل إعداداً مجمّداً على مراكز مفتوحة ويتطلّب migration صريحاً (§Config 8/9). **ليست حالة دائمة ولا Config field** — تظهر في استجابة عملية تعديل/معاينة الإعداد | ARCHITECTURE.md | API · UX · Tests |

---

## Group 11 — API Contract Vocabulary (مفردات عقد API)

> مفردات تنفيذية لـ API (أسماء request/response/command/error/role/resource). السلوك مأخوذ من ARCHITECTURE/Config؛ هنا تُسجَّل الأسماء فقط (لا سلوك جديد).

### permission_role — أدوار الصلاحيات

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| دور الصلاحية | `permission_role` | enum | `viewer` · `operator` · `admin` · `signer_control` | مستوى صلاحية عملية API. `signer_control` صلاحية منفصلة حسّاسة للتوقيع/المفاتيح **ليست رتبة أعلى من admin تلقائياً** | ARCHITECTURE.md | API · UX · Tests · Security |

### resource_type — أنواع الموارد

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| نوع المورد | `resource_type` | enum | `config` · `wallet` · `position` · `intent` · `readiness` · `audit` · `health` · `execution_wallet` · `signer_profile` · `asset_transfer` · `wallet_rotation` · `profit_sweep` · `opportunity` | المورد الذي يديره API. `intent` محوري للـ idempotency. `execution_wallet`/`signer_profile`/`asset_transfer`/`wallet_rotation`/`profit_sweep` طبقة التنفيذ والتوقيع (§4.3). `wallet` = المحافظ المتبوعة (source) منفصل عن `execution_wallet`. **`opportunity` = مورد قراءة لـ TokenOpportunity ما قبل المركز (New Coin Radar / Decision Trace / diagnostics)، read-oriented بلا execution authority ولا أمر ضمني ولا شراء مباشر ولا discovery-only execution** | ARCHITECTURE.md | API · UX · Data Model · Tests |

### command_type — أنواع الأوامر

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| نوع الأمر | `command_type` | enum | (انظر القائمة أدناه) | أوامر API المنطقية (لا routes/HTTP methods) | ARCHITECTURE.md | API · UX · Tests · Runbook |

قيم `command_type`:
- على config: `preview_config_update` · `update_config` · `apply_config_migration`
- على wallet: `register_wallet` · `update_wallet_config` · `enable_wallet_follow` · `disable_wallet_follow` (لا يغلق المراكز القائمة)
- على position/intent: `manual_exit_position` (يخضع لـ Position Manager و`current_control_brain`) · `emergency_exit_position` (مسار أمان، لا يتجاوز Hard Risk) · `cancel_intent`
- تشغيل حرج: `pause_system` · `resume_system` · `trigger_kill_switch` (يتطلّب `signer_control`) · `activate_real_live` (يتحقّق من `real_live_config_valid`) · `revoke_signer` (يتطلّب `signer_control`)
- على execution_wallet: `register_execution_wallet` · `update_execution_wallet` · `activate_execution_wallet` (admission gate: ينقل إلى `ACTIVE` بعد funded + signer reachable + limits configured + key custody verified + not revoked؛ يُرفَض إن `signer_profile_status` غير صالح أو Hard Risk config غير مكتمل؛ admin + `signer_control` إن ربط signer/غيّر custody) · `drain_execution_wallet` (ينقل إلى `DRAINING`: يمنع الدخول الجديد، يُبقي exits/sweeps/asset transfers المصرّح بها حتى `RETIRED`) · `disable_execution_wallet` · `revoke_execution_wallet` (يتطلّب `signer_control`) · `set_execution_wallet_assignment_policy`
- على signer_profile: `register_signer_profile` (يتطلّب `signer_control`) · `disable_signer_profile` · `revoke_signer_profile` (يتطلّب `signer_control`)
- على asset_transfer: `create_asset_transfer_intent` · `cancel_asset_transfer_intent`
- على wallet_rotation: `rotate_execution_wallet` · `complete_wallet_rotation`
- على profit_sweep: `sweep_profits`

> **v1.8 candidate commands** (Groups 24/25/27 — مثل `register_provider`/`request_config_update_from_recommendation`/`start_export_job`/`purge_data`) تبقى `candidate_*` حتى التسمية النهائية بعد اعتماد `03-API-CONTRACT.md`. **لا تُعامَل كقيم `command_type` منفّذة قبل إقرار API.**

### api_error_code — رموز الأخطاء

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| رمز خطأ API | `api_error_code` | enum | (انظر القائمة أدناه) | رمز خطأ ثابت في استجابة API | ARCHITECTURE.md | API · UX · Tests |

قيم `api_error_code`:
- `HARD_RISK_BYPASS_REJECTED` — محاولة تجاوز Hard Risk (مثل warning_only يخفّض حدّ خسارة)
- `REAL_LIVE_CONFIG_INVALID` — تنفيذ حيّ و`real_live_config_valid = false`
- `IDEMPOTENCY_CONFLICT` — تكرار أمر بنفس مفتاح idempotency/`intent_id`
- `PERMISSION_DENIED` — خرق حدّ الصلاحية
- `CONFIG_VALIDATION_FAILED` — فشل تحقّق إعداد (`validation_status = invalid`)
- `IMMUTABLE_FIELD_FROZEN` — تعديل إعداد مجمّد على مركز مفتوح بلا migration
- `READ_ONLY_FIELD_REJECTED` — محاولة كتابة runtime/derived (مثل `operating_state`, `validation_status`)
- `COMMAND_NOT_ALLOWED_IN_STATE` — أمر ممنوع بسبب `operating_state`/`position_state` (مثل دخول جديد في EXITS_ONLY)
- `RESOURCE_NOT_FOUND` — مورد غير موجود

---

## Group 12 — API Envelope / Transport Fields (حقول المظروف والنقل)

> حقول مظروف عامة تظهر في معظم API/stream payloads. ليست منطق أعمال؛ اتفاقية نقل. سُجّلت لأنها أسماء response/payload ثابتة (No field before SSOT). pagination = cursor-based (لا `page` تقليدي إلا إن لزم لاحقاً).

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| معرّف الطلب | `request_id` | infra_field (id) | — | معرّف فريد لكل طلب API (تتبّع/audit) | ARCHITECTURE.md | API · Tests · Runbook |
| مفتاح idempotency | `idempotency_key` | infra_field (id) | — | مفتاح منع تكرار أوامر الكتابة؛ يُربَط بـ `intent_id` لأوامر التداول | ARCHITECTURE.md | API · Tests |
| وقت الإنشاء | `created_at` | infra_field (timestamp) | ISO 8601 | وقت إنشاء المورد/السجل | ARCHITECTURE.md | API · UX · Data Model |
| وقت التحديث | `updated_at` | infra_field (timestamp) | ISO 8601 | وقت آخر تحديث للمورد | ARCHITECTURE.md | API · UX · Data Model |
| مؤشّر الصفحة | `cursor` | infra_field | — | cursor للترقيم (positions/audit/events)؛ أقل هشاشة من page | ARCHITECTURE.md | API · UX |
| حجم الصفحة | `page_size` | infra_field (integer) | — | عدد العناصر في الصفحة | ARCHITECTURE.md | API · UX |
| حقل الترتيب | `sort_by` | infra_field | — | الحقل المُرتَّب عليه (اسم source_of_truth_field صالح) | ARCHITECTURE.md | API · UX |
| اتجاه الترتيب | `sort_order` | infra_field (enum) | `asc` · `desc` | اتجاه الترتيب | ARCHITECTURE.md | API · UX |
| رسالة الخطأ | `error_message` | infra_field (string) | — | رسالة مقروءة مرافقة لـ `api_error_code` | ARCHITECTURE.md | API · UX |
| تفاصيل الخطأ | `error_details` | infra_field (object) | — | تفاصيل بنيوية اختيارية للخطأ (الحقل المخالف…) | ARCHITECTURE.md | API · UX · Tests |
| تسلسل الحدث | `event_sequence` | infra_field (integer) | — | رقم تسلسلي رتيب لرسائل الـ stream (كشف الفجوات/الترتيب) | ARCHITECTURE.md | API · UX · Tests |
| وقت الحدث | `event_timestamp` | infra_field (timestamp) | ISO 8601 | وقت رسالة الـ stream | ARCHITECTURE.md | API · UX |
| نوع رسالة الـ stream | `event_type` | infra_field (classifier enum) | `position_update` · `intent_update` · `readiness_update` · `health_update` · `config_update` · `audit_event` · `error_event` · `opportunity_update` | **classifier عام لرسائل الـ stream فقط** — ليس بديلاً عن `copy_event`/`intent_type`/`failure_type`. يصنّف نوع الرسالة المبثوثة؛ داخل `position_update` يظهر `position_state`، وداخل `intent_update` يظهر `intent_type`/`bundle_status`/`failure_type`، وقد يظهر `copy_event` داخل الرسالة المناسبة. **`opportunity_update` = classifier لرسائل read-model للفرص؛ الـ payload يحمل حقول opportunity المسجّلة فقط (G16/G17/G18/G20) + الحقول العامة المسجّلة؛ بلا execution authority ولا يعني buy/submit** | ARCHITECTURE.md | API · UX · Tests |

---

## Group 13 — Stream Subscription / Protocol Fields (حقول اشتراك وبروتوكول الـ stream)

> مفردات بروتوكول الاشتراك في WebSocket/event-stream (آلية الاشتراك، لا حقول الرسالة — تلك في Group 12). ليست قرار تداول/أمان؛ تُسجَّل لأنها أسماء عقد ثابتة (No field before SSOT).

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| معرّف الاشتراك | `subscription_id` | stream_field / id | — | معرّف اشتراك نشط؛ للإلغاء والتتبّع وإعادة الاشتراك | ARCHITECTURE.md | API · UX · Tests · Runbook |
| قناة الاشتراك | `stream_channel` | stream_field / enum | `position` · `intent` · `readiness` · `health` · `config` · `audit` · `error` · `opportunity` | نطاق الاشتراك العام؛ يتحكّم في أي `event_type` payloads تُبَثّ. **لا يحلّ محل `event_type`** (القناة = النطاق، event_type = نوع الرسالة داخله). **`opportunity` = قناة اشتراك read-only لتحديثات الفرص؛ تحمل `event_type=opportunity_update` حصراً** | ARCHITECTURE.md | API · UX · Tests |
| إصدار الـ payload | `payload_version` | stream_field / version | — | إصدار شكل رسالة الـ stream؛ لا يغيّر معنى حقول SSOT المؤصّلة | ARCHITECTURE.md | API · UX · Tests · Runbook |
| فاصل الـ heartbeat | `heartbeat_interval_ms` | stream_field / duration_ms | — | الفاصل المتوقّع (ملّي ثانية) بين heartbeat messages/health pings لإبقاء اتصال الـ stream | ARCHITECTURE.md | API · UX · Tests · Runbook |

---

## Group 14 — Audit Vocabulary (مفردات التدقيق)

> حقول Audit مرئية عبر API (audit resource / `audit_event`)، لا تفاصيل تخزين داخلية. تُسجَّل لأنها أسماء response ثابتة. (حقول النقل `http_status`/`retry_after_ms` مؤجّلة عمداً حتى تلزم سياسة نقل/خطأ.)

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| منفّذ الحدث | `audit_actor` | audit_field / identity_reference | — | هوية المنفّذ (مستخدم/نظام) الذي أصدر الأمر أو التغيير؛ **أدقّ من `permission_role`** (الدور يقول أيّ صلاحية، actor يقول مَن) | ARCHITECTURE.md | API · UX · Data Model · Tests · Security |
| نطاق الحدث | `audit_scope` | audit_field / enum-or-reference | (يرتبط بـ `resource_type`: config·wallet·position·intent·readiness·health·opportunity) | نطاق الحدث المدقّق. **`opportunity` = نطاق observability/قراءة المورد (أو إجراءات معتمدة مستقبلية إن وُجدت)؛ لا يضيف command authority؛ قراءات الفرص لا تتطلّب command audit إلا بسياسة observability قائمة؛ تحديثات config/wallet تبقى تحت Audit القائم** | ARCHITECTURE.md | API · UX · Data Model · Tests · Security |
| سبب الحدث | `audit_reason` | audit_field / string-or-code | — | سبب التغيير/الأمر/التحوّل الحرج (KILLED، REAL-LIVE activation، signer revoke، config migration). لا enum تفصيلي الآن؛ reason codes تُفصَّل لاحقاً في Runbook/Security إن لزمت | ARCHITECTURE.md | API · UX · Data Model · Tests · Security |

---

## Group 15 — Execution Wallet / Signer Vocabulary (مفردات محافظ التنفيذ والتوقيع)

> طبقة محافظ التنفيذ والتوقيع (§4.3). تمييز صارم: `_id` معرّف داخلي · `_address` عنوان on-chain. `wallet_registry` (محافظ متبوعة) منفصل تماماً عن `execution_wallets` (محافظنا التي تملك وتوقّع). تفاصيل المفاتيح/العزل في 09-THREAT-SECURITY.

### حقول الهوية والعناوين

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| عنوان المحفظة المتبوعة | `tracked_wallet_address` | domain_field / solana_public_key | — | عنوان المحفظة التي نراقبها وننسخها (source، §4.2) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| معرّف محفظة التنفيذ | `execution_wallet_id` | domain_field / id | — | معرّف داخلي لمحفظة تنفيذ تملك أموالنا وتوقّع | ARCHITECTURE.md | API · UX · Data Model · Tests · Security |
| عنوان محفظة التنفيذ | `execution_wallet_address` | domain_field / solana_public_key | — | العنوان on-chain لمحفظة التنفيذ | ARCHITECTURE.md | API · UX · Data Model · Tests |
| معرّف محفظة التسوية | `settlement_wallet_id` | domain_field / id | — | معرّف داخلي لمحفظة استقبال الأرباح (vault) | ARCHITECTURE.md | API · UX · Data Model |
| عنوان محفظة التسوية | `settlement_wallet_address` | domain_field / solana_public_key | — | العنوان on-chain لمحفظة التسوية | ARCHITECTURE.md | API · UX · Data Model |
| معرّف محفظة التمويل | `funding_wallet_id` | domain_field / id | — | معرّف داخلي لمحفظة تمويل محافظ التنفيذ | ARCHITECTURE.md | API · UX · Data Model |
| عنوان محفظة التمويل | `funding_wallet_address` | domain_field / solana_public_key | — | العنوان on-chain لمحفظة التمويل | ARCHITECTURE.md | API · UX · Data Model |
| مالك المركز | `position_owner_wallet_id` | domain_field / id (per-position) | — | محفظة التنفيذ المالكة للأصل حالياً؛ هي وحدها تستطيع البيع. لا يتغيّر إلا بعد `asset_transfer_status = CONFIRMED` | ARCHITECTURE.md | API · UX · Data Model · Tests |
| محفظة دخول المركز | `entry_execution_wallet_id` | domain_field / id (per-position) | — | محفظة التنفيذ التي فتحت المركز (للسجل) | ARCHITECTURE.md | API · Data Model · Tests |
| محفظة المركز الحالية | `current_execution_wallet_id` | domain_field / id (per-position) | — | محفظة التنفيذ التي تدير المركز الآن | ARCHITECTURE.md | API · Data Model · Tests |

### حقول الـ Signer

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| معرّف ملف الـ signer | `signer_profile_id` | domain_field / id | — | معرّف ملف توقيع مرتبط بمحفظة تنفيذ | ARCHITECTURE.md | API · Data Model · Security · Tests |
| نمط حضانة المفتاح | `key_custody_mode` | enum | `connected_wallet` · `isolated_signer` | كيف يُوقَّع: محفظة متّصلة (يدوي) أو signer معزول (آلي) | ARCHITECTURE.md | API · UX · Security · Tests |
| حالة ملف الـ signer | `signer_profile_status` | enum | `ACTIVE` · `DISABLED` · `REVOKED` · `DEGRADED` | جاهزية الـ signer (مستقلّة عن نمط الحضانة) | ARCHITECTURE.md | API · UX · Security · Tests |

### حقول الحالة والسياسة

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| حالة محفظة التنفيذ | `execution_wallet_status` | enum | `WARMING_UP` · `ACTIVE` · `DISABLED` · `DRAINING` · `RETIRED` · `REVOKED` | حالة المحفظة؛ الجديدة تبدأ WARMING_UP ولا تصبح ACTIVE قبل اجتياز funding/signer/key/limits checks؛ المسحوبة REVOKED | ARCHITECTURE.md | API · UX · Data Model · Tests · Security |
| سياسة إسناد المحافظ | `wallet_assignment_policy` | enum | `round_robin` · `least_active` · `per_strategy` · `per_source_wallet` · `manual_assignment` · `risk_weighted` | كيف يختار المحرّك محفظة تنفيذ لكل صفقة | ARCHITECTURE.md | Config · API · UX · Tests |
| نمط إنشاء المحافظ | `execution_wallet_creation_mode` | enum | `manual` · `automatic_policy` | يدوي أو إنشاء تلقائي بسياسة؛ التلقائي يبدأ WARMING_UP | ARCHITECTURE.md | Config · API · UX · Tests |

### حقول نقل الأصول

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| معرّف نيّة نقل الأصل | `asset_transfer_intent_id` | domain_field / id | — | نيّة نقل أصل بين محافظ التنفيذ (وضع buy/sell wallet الخاص) | ARCHITECTURE.md | API · Data Model · Tests |
| محفظة مصدر النقل | `source_execution_wallet_id` | domain_field / id | — | محفظة التنفيذ المالكة حالياً والمُرسِلة للأصل في asset transfer | ARCHITECTURE.md | API · Data Model · Tests |
| محفظة وجهة النقل | `destination_execution_wallet_id` | domain_field / id | — | محفظة التنفيذ المستقبِلة للأصل عند `asset_transfer_status = CONFIRMED` | ARCHITECTURE.md | API · Data Model · Tests |
| حالة نقل الأصل | `asset_transfer_status` | enum | `PENDING` · `SUBMITTED` · `CONFIRMED` · `FAILED` · `CANCELLED` | حالة النقل؛ الملكية لا تتغيّر إلا عند `CONFIRMED` | ARCHITECTURE.md | API · UX · Data Model · Tests |

### حقول التدوير والتسوية

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| مُطلِق التدوير | `rotation_trigger` | enum | `manual` · `time_based` · `trade_count_based` · `risk_limit_based` · `compromise_suspected` · `wallet_retirement` | سبب تدوير المحفظة | ARCHITECTURE.md | Config · API · UX · Tests |
| حالة التدوير | `wallet_rotation_status` | enum | `NOT_REQUIRED` · `PENDING` · `IN_PROGRESS` · `COMPLETED` · `FAILED` | حالة عملية التدوير | ARCHITECTURE.md | API · UX · Data Model · Tests |
| محفظة مصدر التدوير | `rotation_from_execution_wallet_id` | domain_field / id | — | محفظة التنفيذ التي تُدوَّر إلى `DRAINING`/`RETIRED` | ARCHITECTURE.md | API · Data Model · Tests |
| محفظة وجهة التدوير | `rotation_to_execution_wallet_id` | domain_field / id | — | محفظة التنفيذ الجديدة/البديلة التي تصبح مؤهّلة بعد WARMING_UP/ACTIVE checks | ARCHITECTURE.md | API · Data Model · Tests |
| سياسة كنس الأرباح | `profit_sweep_policy` | enum | `auto_immediate` · `manual` · `periodic` | كيف تُكنَس الأرباح إلى محفظة التسوية | ARCHITECTURE.md | Config · API · UX · Tests |
| فاصل كنس الأرباح | `profit_sweep_interval_ms` | field (duration_ms) | — | الفاصل (ملّي ثانية) عند `profit_sweep_policy = periodic` | ARCHITECTURE.md | Config · API · Tests |

> **مستبعد عمداً (لا يُسجَّل):** `worker_wallet_address` · `wallet_privacy_mode` · `stealth_rotation_policy` · `anti_analysis_policy` — خارج النطاق المطلوب (تعدّد/تنظيم/أمان/تدوير)، لا طبقة تمويه.
---

## Group 16 — Discovery / New-Coin Hunting (اكتشاف العملات الجديدة)

> طبقة ما قبل المركز (ARCHITECTURE §4.4). الأسماء مستخرَجة من §4.4 المعتمدة. `resource_type=opportunity` مسجّل في Group 11 كمورد read-oriented/read-only للفرص، بلا execution authority ولا command authority.

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| كيان الفرصة | `token_opportunity` (term: `TokenOpportunity`) | domain_entity / pre_position_entity | — | كيان قرار **ما قبل المركز** (runtime composite)؛ لا يملك أموالاً ولا يوقّع ولا ينفّذ، ومتمايز عن `Position` و`Intent`. blocks_exec: **no**. `resource_type=opportunity` is registered in Group 11 as read-only/read-oriented (§4.4.1) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| دورة حياة الفرصة | `hunt_status` | state (enum) — pre-position | `discovered` · `ranked` · `gated` · `accepted` · `rejected` · `watch_only` · `expired` · `entered` | دورة حياة الفرصة ما قبل المركز؛ عند `entered` يُسلَّم لـ `position_state = OPENING` ويملك ما بعده. blocks_exec: **reflects decision only** (ليس gate). لا يستخدم قيم `operating_state`/`position_state` (§4.4.2) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| أولوية العملة الجديدة | `new_token_priority_score` | derived_field (number) | — | ترتيب/طابور/عرض فقط؛ يُربط بـ RequestQueueThrottler lanes دون تجاوز exit/safety/trade-critical. blocks_exec: **no** — لا يدخل EV ولا يوافق على تنفيذ (§4.4.4) | ARCHITECTURE.md | API · UX · Tests |
| عملة معاد تدويرها | `recycled_token_flag` | derived_field (flag, bool) | `true` · `false` | كشف عملة معاد تدويرها. blocks_exec: **diagnostic only** افتراضاً؛ ترقية لبوابة → تُسجَّل في SSOT/Config/Test أولاً (§4.4.3) | ARCHITECTURE.md | API · UX · Tests |
| درجة انتحال الاسم | `name_impersonation_score` | derived_field (number) | — | درجة انتحال اسم عملة شهيرة. blocks_exec: **diagnostic only**. canonical (`name_spoof_risk` rejected alias) | ARCHITECTURE.md | API · UX · Tests |
| وسم منشئ مزرعة | `creator_launch_rate_flag` | derived_field (flag, bool) | `true` · `false` | وسم منشئ بمعدّل إطلاق مرتفع. blocks_exec: **diagnostic only** | ARCHITECTURE.md | API · UX · Tests |
| درجة جاهزية التوكن | `token_readiness_score` | derived_field (number) | — | درجة جاهزية التوكن. blocks_exec: **diagnostic only**؛ يقابله عتبة config `min_token_readiness` (Group 19) | ARCHITECTURE.md | API · UX · Tests |
| mint الاقتران (quote) | `quote_mint` | field (canonical symbolic enum — عائلة الزوج لا raw mint pubkey) | `wsol` · `usdc` · `unknown` | الجانب المقابل في الزوج للتوكن، enum رمزي canonical يحدّد عائلة الزوج (لا عنوان mint فعلي)؛ مصدر تفرّع canonical pool/عتبات التخرّج/تطبيع السعر؛ canonical execution truth (نظير `candidate_position_token_mint`)؛ `unknown` ⇒ skip. blocks_exec: **branch key** — يحدّد مسار pool/quote ويُفعّل skip عند `unknown` | ARCHITECTURE.md §4.1 | Config · API · UX · Data Model · Tests |

---

## Group 17 — Opportunity Decision Reasons (أسباب قرار الفرصة)

> مفردات lifecycle/decision لا discovery. تُربط بـ بوابات/مفردات الفشل القائمة (`failure_type`/`api_error_code`/EV/Risk/Token-2022/route) ولا تُبنى taxonomy موازية. Decision Trace قد يحمل قائمة أسباب مساعدة لاحقاً — لا تُضاف حقول أسباب إضافية الآن بلا إقرار ARCHITECTURE/SSOT صريح.

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| سبب القبول | `accepted_reason` | derived_field / enum / primary_reason | `wallet_signal_confirmed` · `cluster_signal_confirmed` · `token_readiness_pass` · `exit_feasibility_pass` (قابلة للتوسّع) | السبب الأساسي للقبول، عند `hunt_status = accepted`/`entered`. blocks_exec: **reflects decision only** — لا يوافق على التنفيذ بنفسه (§4.4.7) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| سبب الرفض | `rejected_reason` | derived_field / enum / primary_reason | `dex_only_signal` · `ev_negative` · `route_invalid` · `exit_feasibility_fail` · `token2022_dangerous_extension` · `hard_risk_block` · `slippage_vs_leader_exceeded` · `same_cluster_not_independent` · `hunt_window_expired` · `liquidity_share_exceeded` · `unknown_quote_mint` (قابلة للتوسّع) | سبب عدم المضي، عند `hunt_status = rejected`/`expired`/`watch_only`. `unknown_quote_mint` = quote mint غير معروف أو غير مدعوم بالسياسة الحالية (مثل USDC والـ feature flag معطّل) — fail-safe skip لا صفقة مشوّهة. blocks_exec: **reflects decision only** — لا يحجب بنفسه (§4.4.7) | ARCHITECTURE.md | API · UX · Data Model · Tests |

---

## Group 18 — Wallet Intelligence / Copyability (ذكاء المحافظ وقابلية النسخ)

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| قابلية النسخ حسب العقل | `copyability_by_brain` | derived_field (enum) | `brain_a` · `brain_b` · `both` · `none` | العقل/العقول التي تكون المحفظة قابلة للنسخ عبرها. blocks_exec: **diagnostic only**. متّسق مع `strategy_brain` | ARCHITECTURE.md | API · UX · Data Model · Tests |
| ازدحام النسخ | `crowd_follow_score` | derived_field (number) | — | تآكل الميزة بازدحام النسخ. blocks_exec: **diagnostic only** | ARCHITECTURE.md | API · UX · Tests |
| تركّز الأرباح | `profit_concentration` | derived_field (number) | — | تركّز أرباح المحفظة في رمز واحد (تجسيد «one-hit»، §7). blocks_exec: **diagnostic only** | ARCHITECTURE.md | API · UX · Tests |
| حالة المحفظة المتبوعة | `tracked_wallet_status` | derived_status (enum), read-only | `candidate` · `watch_only` · `copy_allowed` · `degraded` · `banned` | تقييم النظام للمحفظة المتبوعة، مشتقّ read-only. blocks_exec: **reflects decision only** — لا يفتح تنفيذاً وحده، وقد يخفض الثقة/يحوّل لـ watch حسب السياسة (ليس gate صلباً). `banned` = سياسة متابعة لا حظر أمني ولا إغلاق مراكز. منفصل عن `follow_enabled` (نيّة المستخدم) و`execution_wallet_status` (مفاتيح). لا يُكتب عبر API (§4.4.5) | ARCHITECTURE.md | API · UX · Data Model · Tests |
| veto مكوّن قابلية النسخ | `candidate_copyability_component_veto` | bool (derived), read-only | true · false | (Gap C · ARCH §4.4.5) مكوّن copyability عالي الخطورة يمنع ترقية المحفظة إلى `copy_allowed` رغم ranking إجمالي جيد؛ منع Goodhart على score واحد مُعتم. **يفسّر `tracked_wallet_status` ولا يحلّ محلّه.** blocks_exec: **reflects decision only** — لا execution/command authority · لا auto-ban/auto-close/auto-config · لا `copy_event` جديد · لا opportunity execution | ARCHITECTURE.md | API · UX · Data Model · Tests |
| سبب veto قابلية النسخ | `candidate_copyability_veto_reason` | enum (derived), read-only | `risky_wallet_type` · `fake_profit_risk` · `adverse_selection_high` · `crowd_follow_decay` · `profit_concentration_one_hit` · `non_copyable_profit_source` · `insufficient_evidence` | (Gap C · ARCH §4.4.5) لماذا ليست قابلة للنسخ / لم تُرقَّ إلى `copy_allowed`. كل قيمة تُطابق مكوّناً قائماً 1:1: risky_wallet_type↔`candidate_wallet_type` (G38) · fake_profit_risk↔`candidate_fake_profit_adjusted_edge` (G37) · adverse_selection_high↔`candidate_adverse_selection_severity` (G38) · crowd_follow_decay↔`crowd_follow_score` (G18) · profit_concentration_one_hit↔`profit_concentration` (G18) · non_copyable_profit_source↔`candidate_profit_source_copyability_class` (G37) · insufficient_evidence↔low-confidence/`unknown_or_insufficient_evidence`. **متمايز عن `candidate_wallet_drift_reason`** (انحراف زمني بعد التفعيل، لا veto نسخ ثابت). blocks_exec: **reflects decision only** | ARCHITECTURE.md | API · UX · Data Model · Tests |

> **حُسم في v1.8:** `behavior_shift_flag` لم يعد مؤجّلاً — سُجِّل كـ `candidate_wallet_behavior_drift_flag` ضمن Group 26 (متمايزاً عن edge-decay detector/`wallet_behavior_risk` القائمين). **لا يُستخدم الاسم القديم.**

> **دلالات Gap C (تجميع copyability veto):** الاسمان `candidate_copyability_component_veto`/`candidate_copyability_veto_reason` derived/read-only **يفسّران `tracked_wallet_status` ولا يحلّان محلّه**. `candidate_copyability_component_veto = true` → **لا ترقية إلى `copy_allowed`**؛ حلّ متحفّظ إلى `watch_only`/`degraded` حسب الشدّة/السياق/السياسة. `banned` يبقى سياسة متابعة/تقييم — لا حظر أمني لمحفظة التنفيذ، ولا إغلاق مراكز، ولا تغيير config تلقائي. يعيد استخدام مكوّنات copyability القائمة (G18/G26/G37/G38) **بلا score مُعتم — لا `wallet_trust_score` (rejected alias) ولا `copyability_score` رقمي جديد ولا ranking-score جديد**. لا execution/command authority · لا `copy_event` جديد · لا opportunity execution · لا auto-ban/auto-close/auto-config. أي threshold/سياسة default مرافقة = **CONFIG follow-up** لاحقاً، لا تُضاف الآن.

---

## Group 19 — Entry / Sizing Filters (فلاتر الدخول والحجم — toggle)

> فلاتر اختيارية؛ الافتراضي **غير مفعّل = لا أثر**. سلوك default/range يُفصَّل في Config بعد هذا التسجيل (§4.4.6).

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| نافذة الصيد | `fast_hunt_window_ms` | field (duration_ms) · config (per-wallet/per-brain) | — | نافذة زمنية للدخول السريع تبني على `token_age`. blocks_exec: **when enabled as config filter** (انتهاؤها → `hunt_status=expired`/`watch_only`/`rejected_reason=hunt_window_expired`)؛ ليس Hard Risk ولا قيد على REAL-LIVE؛ لا يعفي من `max_entry_slippage_vs_leader` | ARCHITECTURE.md | Config · API · UX · Tests |
| اشتراط الارتداد | `require_pullback` | field (flag, bool) · config | `true` · `false` | منع الدخول دون ارتداد. blocks_exec: **when enabled as config filter**. default false | ARCHITECTURE.md | Config · API · UX · Tests |
| حارس المطاردة | `chase_guard` | field (flag, bool) · config | `true` · `false` | منع مطاردة الشمعة المرتفعة. blocks_exec: **when enabled as config filter**. default off | ARCHITECTURE.md | Config · API · UX · Tests |
| أدنى جاهزية توكن | `min_token_readiness` | field (number) · config | — | عتبة دنيا تقارن `token_readiness_score` (Group 16). blocks_exec: **when enabled as config filter** | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى تذبذب دخول | `max_entry_volatility` | field (number) · config | — | رفض الدخول عند تذبذب لحظي مرتفع. blocks_exec: **when enabled as config filter** | ARCHITECTURE.md | Config · API · UX · Tests |
| أدنى ثقة لمحفظة مفردة | `single_wallet_min_confidence` | field (number) · config (threshold) | — | حدّ ثقة للدخول بإشارة محفظة واحدة؛ **threshold يستهلك مخرجات Wallet Intelligence لا score مستقل**. blocks_exec: **when enabled as config filter** | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى حصّة من السيولة | `max_liquidity_share_pct` | field (number, pct) · config | — | حصّة الصفقة من السيولة المتاحة (حماية self-impact). blocks_exec: **may reduce size or reject entry by policy; not Hard Risk** (ليس Group 6)؛ يتعايش مع `max_position_size_pct` ولا يحلّ محلّه (§4.4.6) | ARCHITECTURE.md | Config · API · UX · Tests |

---

## Group 20 — Latency / Observability Diagnostics (تشخيص الكمون والرصد)

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| كمون الاكتشاف | `discovery_latency_ms` | derived_field (number, ms) | — | كمون اكتشاف الحدث. blocks_exec: **diagnostic only** | ARCHITECTURE.md | API · UX · Tests · Runbook |
| كمون الإشارة→التنفيذ | `signal_to_execution_ms` | derived_field (number, ms) | — | الكمون من الإشارة إلى التنفيذ. blocks_exec: **diagnostic only** | ARCHITECTURE.md | API · UX · Tests · Runbook |
| كمون النسخ | `latency_to_copy` | derived_field (number, ms) | — | كمون النسخ الكلي. blocks_exec: **diagnostic only** | ARCHITECTURE.md | API · UX · Tests · Runbook |
| انزلاق الدخول مقابل القائد | `entry_slippage_vs_leader` | derived_field (number, pct) | — | القياس المحقّق لفرق سعر دخولنا عن القائد (معادلة §4.2). blocks_exec: **diagnostic only** — الحجب عبر العتبة `max_entry_slippage_vs_leader` (Group 4) لا عبر هذا القياس. `leader_user_price_delta` = rejected alias | ARCHITECTURE.md | API · UX · Tests · Runbook |
| مقدار تغيّر مركز القائد | `candidate_leader_position_change_pct` | derived_field (number, pct) | — | (Gap A · §15.1 وحدة 3) مقدار تغيّر مركز القائد **بعد خصم التحويل/تعديل الـ cluster** (مقياس واحد محايد للبيع والإضافة). الاتّجاه/النوع لا يُخزَّن هنا — يأتي من `copy_event` القائم (`leader_partial_sell`/`leader_full_exit`/`leader_scale_in`). المتغيّرات الخام (`leader_wallet_balance_before/after` · `leader_cluster_balance` · `transfer_adjusted_balance`) **internal-only لا تُسجَّل**؛ و`candidate_leader_sell_percentage`/`candidate_leader_buy_percentage` و`full_exit_detected`/`partial_exit_detected` **مرفوضة** (مغطّاة بالاسم المحايد / تكرار `copy_event`). blocks_exec: **diagnostic only** — لا execution/command authority · لا يحلّ محلّ `copy_event` · ليس leader P&L | ARCHITECTURE.md | API · UX · Data Model · Tests |
| حالة موثوقية إعادة بناء رصيد القائد | `candidate_leader_balance_reconstruction_status` | enum (derived) | `reconstructed` · `partial` · `low_confidence` · `unavailable` | (Gap A · §15.1 وحدة 3) حالة/ثقة إعادة البناء، read-only. عند `unavailable`/`low_confidence` → **fail-safe: لا يُفترَض 0% ولا 100% ولا mirror أعمى**؛ سلوك حذِر (watch-only/manual-review/خفض الإجراء) عبر طبقات السياسة القائمة (§4.2/§10). خصم التحويل/الـ cluster جزء من الحساب لا قيمة status (لا `transfer_adjusted`). blocks_exec: **diagnostic only / reflects reliability** — لا execution/command authority | ARCHITECTURE.md | API · UX · Data Model · Tests |
| انحياز الـ landing حسب حرارة التوكن | `candidate_landing_outcome_by_heat_bucket` | derived (diagnostic projection), read-only | تبويب {attempted · landed · failed · expired · skipped} حسب token-heat bucket، متقاطعاً مع fee/tip/slippage bucket و provider/route bucket | يقيس انحياز التنفيذ على مستوى البنية: هل النظام يفشل في الـ landing تحديداً على أسخن التوكنات فيميل fill set الحيّ للصفقات الباردة (tip inflation أثناء الـ hype)؟ token-heat bucket مشتقّ من إشارات الازدحام القائمة (Jito tip-floor percentile / priority-fee percentile / launch-hype regime في JitoTipPolicy §15) — لا score حرارة معتم جديد. **متمايز عن `candidate_adverse_selection_metric` (G38)** (يقيس adverse selection في جودة النسخ)؛ هذا يقيس انحياز الـ landing التنفيذي حسب الحرارة. blocks_exec: **diagnostic only — لا execution authority · لا gate جديد · لا auto-config** | ARCHITECTURE.md §15 (JitoTipPolicy/FailedTransactionClassifier) | API · UX · Tests |

---

## Group 21 — Exit Policy (سياسة الخروج — toggle params)

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| نسبة وقف الخسارة | `stop_loss_pct` | field (number, pct) · config (per-wallet) | — | عتبة وقف خسارة اختيارية. blocks_exec: **triggers exit only** — يطلق بيعاً يمرّ عبر Exit Feasibility/route health (لا يضمن الخروج في السيولة الرقيقة)؛ **ليس Hard Risk** ولا يضعف أي حدّ/Kill Switch. يقابل `take_profit_pct` (§4.4/§10) | ARCHITECTURE.md | Config · API · UX · Tests |
| أقصى زمن في المركز | `max_time_in_position` | field (duration) · config (per-wallet) | — | مدّة قصوى في المركز؛ بارامتر لـ `time_exit` toggle (§13). blocks_exec: **triggers exit only** | ARCHITECTURE.md | Config · API · UX · Tests |

---

## Group 22 — P&L Read-Model (مشتقّ خلفي — v1.8 candidate)

> derived/read-only فقط (ARCHITECTURE §2.1 / §15.2). أسماء `candidate_*` بانتظار التثبيت النهائي. **يُمنع حساب P&L في الواجهة.**

| term | source_of_truth_field | type | allowed_values | meaning | owner_document | used_by |
|---|---|---|---|---|---|---|
| ربح محقّق | `candidate_realized_pnl` | derived (USDC) | — | lot-based/FIFO، منسوب التكاليف | ARCHITECTURE.md §15.2 | API · UX · Data · Tests |
| ربح غير محقّق | `candidate_unrealized_pnl` | derived (USDC) | — | لا يُعرض إلا مع mark صالح (vocab الآن/بناء مؤجَّل) | ARCHITECTURE.md §15.2 | API · UX · Data |
| سعر التقييم | `candidate_mark_price` | derived | — | يحمل الحقول التالية إلزاماً | ARCHITECTURE.md §2.1 | Data · API |
| مصدر التقييم | `candidate_mark_source` | enum | executable_quote · route_quote · liquidity_estimate · display | تفضيل executable في AMM | ARCHITECTURE.md §2.1 | Data · API |
| زمن التقييم | `candidate_mark_timestamp` | field (ts) | — | — | ARCHITECTURE.md §2.1 | Data · API |
| ثقة التقييم | `candidate_mark_confidence` | derived | 0.0–1.0 | — | ARCHITECTURE.md §2.1 | Data · API |
| حالة التقييم | `candidate_mark_status` | enum | valid · stale · unavailable · low_confidence · display_only | غير `valid` لا يُعرض كرقم موثوق | ARCHITECTURE.md §2.1 | API · UX · Tests |
| إجمالي الرسوم | `candidate_fees_total` | derived (USDC) | — | priority+tip+ATA rent+DEX fees per intent/trade | ARCHITECTURE.md §15.2 | API · UX · Data |
| كلفة الانزلاق | `candidate_slippage_cost` | derived | — | مقابل quote/leader | ARCHITECTURE.md §15.2 | API · Data |
| ربح ورقي | `candidate_paper_pnl` | derived (simulated) | — | موسوم simulated دائماً | ARCHITECTURE.md §15.2 | API · UX |
| ربح per-wallet | `candidate_pnl_by_wallet` | derived | — | تجميع | ARCHITECTURE.md §15.2 | API · UX |
| ربح per-mode | `candidate_pnl_by_copy_mode` | derived | — | تجميع | ARCHITECTURE.md §15.2 | API · UX |
| ربح per-brain | `candidate_pnl_by_brain` | derived | — | تجميع | ARCHITECTURE.md §15.2 | API · UX |
| متبقّي حدّ الخسارة اليومي | `candidate_remaining_daily_loss_budget` | derived | — | مشتق من daily-loss limit (Group 6) | ARCHITECTURE.md §15.2 | API · UX |

## Group 23 — Execution Trace (تتبّع الصفقة — v1.8 candidate)

> ARCHITECTURE §15.3. السلسلة الزمنية الكاملة (12 طابعاً) + 5 latencies + counters.

| term | source_of_truth_field | type | meaning |
|---|---|---|---|
| طوابع زمنية | `candidate_ts_signal_observed … candidate_ts_closed` | fields (ts) | 12: observed/discovered/decision_start/decision_end/order_built/risk_decided/signer_requested/signed/sent/landed/filled/closed |
| فجوات latency | `candidate_lat_discovery_to_decision` · `_build_to_sign` · `_sign_to_send` · `_send_to_landing` · `_landing_to_fill` | derived | 5 فجوات مشتقّة |
| عدّاد المحاولات | `candidate_attempt_count_per_intent` | field | عدد محاولات الإرسال |
| رسوم المحاولة | `candidate_fee_per_attempt` | field | per attempt |
| كلفة المحاولة الفاشلة | `candidate_failed_attempt_cost` | field/derived | تثبيت موجود داخلياً |
| priority/tip | `candidate_priority_fee` · `candidate_jito_tip` | fields | تثبيت كحقول رسمية |
| انزلاق الدخول مقابل quote | `candidate_entry_slippage_vs_quote` | derived | نظير `entry_slippage_vs_leader` |
| نسبة المزوّد | `candidate_provider_attribution` | field | earliest/confirming |
| أصل الفشل | `candidate_failure_origin` | enum | provider/route/signer/risk/liquidity/blockhash/bundle/fill (توسعة `failure_type`) |

## Group 24 — Provider Vocabulary (المزوّدون — v1.8 candidate)

> ARCHITECTURE §15.4. المفاتيح بالمرجع فقط (§09).

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| نمط المزوّد | `candidate_provider_mode` | enum (config) | single · multi | single مدعوم بقيود؛ فشله → EXITS_ONLY |
| دور المزوّد | `candidate_provider_role` | enum | hot_path · enrichment · research · backup | عزل البحث عن hot path |
| فئة المزوّد | `candidate_provider_tier` | enum | fast · standard · free · backup | — |
| حالة الاتصال | `candidate_provider_connection_status` | derived | untested · connected · degraded · failed | — |
| مرجع المفتاح | `candidate_provider_key_ref` | field | — | **مرجع سرّ فقط** لا raw key |
| أوامر | `candidate_cmd_register_provider` · `candidate_cmd_test_provider_connection` · `candidate_cmd_disable_provider` · `candidate_cmd_set_provider_role` | commands | — | permissioned |
| خطأ | `candidate_err_provider_unconfigured` | api_error_code | — | single-provider بلا مفتاح |

## Group 25 — Recommendation Layer (advisory — v1.8 candidate)

> ARCHITECTURE §15.5. advisory فقط؛ لا apply مباشر.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| توصية | `candidate_recommendation` | resource | — | كائن advisory |
| نوع التوصية | `candidate_recommendation_type` | enum | slow_provider · low_tip · tp_suggestion · sizing_suggestion · exclude_wallet · add_provider · tp_suitability · time_of_day_regime | — |
| حالة التوصية | `candidate_recommendation_status` | enum | open · converted_to_config_request · dismissed · superseded | لا «applied» مباشر؛ التبنّي فقط عبر مسار config-version بعد preview/validation/permission/audit |
| أوامر | `candidate_cmd_preview_recommendation_application` · `candidate_cmd_request_config_update_from_recommendation` | commands | — | تمرّ عبر مسار config الرسمي؛ لا auto-apply |
| كشف ملاءمة TP | `candidate_tp_suitability_flag` | derived | — | per-wallet |
| نظام أوقات اليوم | `candidate_time_of_day_regime` | derived | — | تحليل |

## Group 26 — Wallet Analytics Extensions / Opportunity / Charts (v1.8 candidate)

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| ترتيب net-copyability | `candidate_wallet_net_copyability_rank` | derived | — | لا raw PnL (توسعة Group 18) |
| فرق القائد عن الناسخ | `candidate_leader_vs_copier_delta` | derived | — | بعد fees/slippage/latency |
| علم copycat | `candidate_is_copycat_flag` | derived | — | تمييز leader أصلي |
| انحراف السلوك | `candidate_wallet_behavior_drift_flag` | derived | — | **حسم `behavior_shift_flag` المؤجَّل سابقاً** |
| أقصى drawdown لو نُسخت | `candidate_wallet_max_drawdown_if_copied` | derived | — | per-wallet تاريخي |
| متوسط الاحتفاظ | `candidate_wallet_avg_hold_time` | derived | — | — |
| كلفة الفرصة | `candidate_opportunity_cost_estimate` | derived | — | أموال محجوزة |
| baseline | `candidate_baseline_benchmark_return` | derived | — | مقابل شراء عشوائي |
| حماية المتابعة المكرّرة | `candidate_duplicate_follow_guard` | field (config) | on/off | نفس wallet/cluster |
| تصنيف الفرصة للعرض | `candidate_opportunity_lifecycle` | enum (derived) | watch_only · diagnostic · executable_candidate · copy_signal_candidate | ليست أمر شراء (ARCH §4.4.2a) |
| معيار صرامة الفلاتر | `candidate_filter_strictness_metric` | derived | — | accept-vs-reject |
| مصدر الشموع | `candidate_ohlcv_source` | field | — | قرار Data/Build |
| provenance الشموع | `candidate_ohlcv_provenance` | enum | provider · derived_from_swaps · delayed · estimated · executable_route_aware | display-only لا يُعرض كحقيقة تنفيذ |
| تصريف السيولة | `candidate_liquidity_drain_metric` · `candidate_expected_slippage_estimate` | derived | — | بديل order-book في AMM |
| حالة صحّة الميزة (advisory) | `candidate_edge_health_status` | enum (derived), read-only · advisory | `healthy` · `weakening` · `insufficient_evidence` · `no_edge_suspected` | (Gap D · ARCH §7 Edge Health) تجميع استشاري per-wallet لصحّة الميزة من **إشارات قائمة فقط** (`candidate_paper_real_divergence_status` · `candidate_adverse_selection_severity` · `candidate_net_business_pnl`+`_status` · `candidate_leader_vs_copier_delta` · `entry_slippage_vs_leader` · `candidate_failed_attempt_cost` · `candidate_wallet_drift_signal`/`_reason`/`_recommendation` · `candidate_copyability_component_veto`+`_reason` · `tracked_wallet_status` · `minimum_sample_size`/`candidate_paper_settings_evidence_status`). **advisory-only — لا forced live blocker.** `no_edge_suspected` = تحذير لا تعطيل تلقائي · `insufficient_evidence` ليست صفر مخاطر ولا دليل ميزة · Paper لا يُمثَّل كميزة Real. التوصية تُعاد من المفردات القائمة (`candidate_wallet_drift_recommendation`/`candidate_recommendation_type`) — لا مفردات جديدة. قد يغذّي تدفّق التوصية وCalibration Kill/Pause القائمين. **لا execution/command authority · لا auto-ban/auto-close/auto-config/auto-disable · لا `copy_event` جديد · لا opportunity execution · لا `candidate_uncopyable_flag` ولا edge score مُعتم.** عتبات التجميع = CONFIG follow-up لاحقاً |

## Group 27 — Data / Retention / Reports / Ops (v1.8 candidate)

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| طريقة cost-basis | `candidate_cost_basis_method` | enum (config) | fifo (افتراضي) · average | ARCH §2.1 |
| ملف الاحتفاظ | `candidate_retention_profile` | enum (config) | 30d · 90d · 180d · custom | القيم في RUNBOOK، لا أرقام في SSOT |
| صيغة التصدير | `candidate_export_format` | enum | markdown · csv · parquet · jsonl | — |
| مهمّة تصدير | `candidate_export_job` | resource | — | dataset بحثي |
| أمر بدء التصدير | `candidate_cmd_start_export_job` | command | — | permissioned |
| مقاييس التشغيل | `candidate_storage_usage_metric` · `candidate_data_quality_metric` | derived | — | dashboards |
| أمر التطهير | `candidate_cmd_purge_data` | command | — | admin/local-ops؛ يستثني audit مالي |
| أوامر صيانة | `candidate_cmd_restart_service` · `candidate_cmd_backup` · `candidate_cmd_export_diagnostic_bundle` | commands | — | admin/local-ops؛ شروط منع (pending intents/أسرار/مفاتيح خام) |
| إصدار التطبيق | `candidate_app_version` | derived | — | عرض |
| قالب التقرير | `candidate_report_template_id` | enum (config) | trade_evaluation · failure_analysis · custom | — |
| علم SL غير منفّذ | `candidate_stop_loss_unfilled_due_to_liquidity` | derived | — | تقرير |
| Paper Portfolio / Sandbox | `candidate_paper_portfolio` · `candidate_strategy_sandbox_run` | resources | — | sandbox **paper-only** لا يمسّ live/risk/signer |

---

## Group 28 — Price Taxonomy (F2 — F-Elimination candidate)

> ARCH §15.8/§15.6. كل سعر يحمل type+provenance+timestamp+status/confidence حيث ينطبق. **لا `candidate_current_price`** (مرفوض).

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| نوع السعر | `candidate_price_type` | enum | display · executable_quote · mark · fill · quote | تمييز إلزامي |
| مصدر السعر | `candidate_price_provenance` | enum | provider · derived_from_swaps · delayed · estimated · executable_route_aware | provenance إلزامي |
| سعر الدخول | `candidate_entry_price` | derived | — | من fills، read-only |
| عرض السعر الحالي | `candidate_current_mark_view` | derived (view) | — | read-view فوق `candidate_mark_price`+`candidate_mark_status`؛ ليس مصدراً مستقلاً |
| سعر التعبئة | `candidate_fill_price` | field | — | فعلي من fill |
| سعر العرض السعري | `candidate_quote_price` | field | — | من route/quote |
| سعر العرض | `candidate_display_price` | field | — | display-only لا حقيقة تنفيذ |
| أثر العرض السعري | `candidate_quote_impact` | derived | — | بديل order-book في AMM |
| زمن السعر | `candidate_price_timestamp` | field (ts) | — | metadata عام لكل سعر |
| حالة السعر | `candidate_price_status` | enum | valid · stale · unavailable · low_confidence · display_only | metadata عام (مستقل عن `candidate_mark_status` الخاص بالـ mark في G22) |
| ثقة السعر | `candidate_price_confidence` | derived | 0.0–1.0 | حيث ينطبق |

## Group 29 — Trade Event / Journal (F3 — F-Elimination candidate)

> ARCH §15.8/§15.3. مرتبط بـ Execution Trace (لا تكرار). بلا أسرار.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| حدث التداول | `candidate_trade_event` | resource | — | حدث مرتبط بالـ intent/position/trade |
| نوع الحدث | `candidate_trade_event_type` | enum | signal_observed · decision · risk · build · sign · send · land · fill · partial_fill · exit_attempt · exit_fill · close · failure | — |
| معرّف الصفقة | `candidate_trade_id` | field | — | يربط الأحداث |
| دفتر الصفقة | `candidate_trade_journal` | resource (view) | — | عرض قراءة فوق الأحداث (replay/reports/charts/debug) |

## Group 30 — Wallet-Token Performance & Discovery Signals (F4/F5 — F-Elimination candidate)

> ARCH §15.8/§15.7. point-in-time/survivorship-free؛ cluster احتمالي؛ لا نسخ أعمى.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| أداء المحفظة-التوكن | `candidate_wallet_token_performance` | projection/resource | — | per-(wallet,token) |
| النتيجة الصافية | `candidate_wt_net_result` | derived | — | بعد التكاليف حيث توفّر |
| اكتمال التكاليف | `candidate_wt_cost_completeness_status` | enum | complete · partial · estimated · unavailable | لا net كامل إن نقصت التكاليف |
| زمن الاحتفاظ | `candidate_wt_holding_time` | derived | — | — |
| توقيت الدخول/الخروج | `candidate_wt_entry_timing` · `candidate_wt_exit_timing` | derived | — | — |
| السلوك المتكرّر | `candidate_wt_repeat_behavior` | derived | — | — |
| نقطة زمنية | `candidate_wt_point_in_time` | field | — | علم منهجي survivorship-free |
| ترتيب المشتري المبكر | `candidate_early_buyer_rank` | derived | — | استدلال احتمالي |
| مقياس المتكرّر الرابح | `candidate_repeat_winner_metric` | derived | — | استدلال احتمالي |
| معرّف العنقود | `candidate_cluster_id` | field | — | ليس حقيقة مطلقة |
| ثقة العنقود | `candidate_cluster_confidence` | derived | 0.0–1.0 | — |
| طريقة العنقود | `candidate_cluster_method` | field | — | — |
| provenance العنقود | `candidate_cluster_provenance` | enum | on_chain · heuristic · provider_enrichment · manual_review · mixed | — |

## Group 31 — Wallet Balances / Sweep (F6 — F-Elimination candidate)

> ARCH §15.8/§4.3. ownership-bound؛ بلا أسرار؛ redaction في التصدير/النسخ.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| رصيد محفظة التنفيذ | `candidate_execution_wallet_balance` | derived | — | عرض/تسوية لا توقيع |
| رصيد محفظة التسوية | `candidate_settlement_wallet_balance` | derived | — | — |
| رصيد محفظة التمويل | `candidate_funding_wallet_balance` | derived | — | — |
| أرباح قابلة للكنس | `candidate_profits_available_to_sweep` | derived | — | — |
| حدث الكنس | `candidate_sweep_event` | resource | — | عبر `sweep_profits` القائم (ownership-bound) |
| سجلّ الكنس | `candidate_sweep_history` | resource (view) | — | — |
| provenance الرصيد | `candidate_balance_provenance` | enum | on_chain · derived | — |
| حالة المطابقة | `candidate_balance_reconciliation_status` | enum | reconciled · pending · mismatch | — |

## Group 32 — Position Token Identity & Leader Attribution (F7/F8 — F-Elimination candidate)

> ARCH §15.8/§4.2. mint canonical؛ symbol/name untrusted لا execution truth؛ الإسناد لا يخوّل تنفيذاً.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| mint المركز | `candidate_position_token_mint` | field | — | **canonical** (تنفيذ/مطابقة) |
| رمز المركز | `candidate_position_token_symbol` | field (display) | — | untrusted، ليس execution truth |
| اسم المركز | `candidate_position_token_name` | field (display) | — | untrusted |
| provenance الهوية | `candidate_token_identity_provenance` | enum | on_chain_mint · token_metadata · provider_enrichment · user_label · unknown | — |
| ثقة الرمز | `candidate_token_symbol_trust` | enum | verified · unverified · spoof_suspected | منع spoofing |
| إسناد المركز | `candidate_position_attribution` | composite | — | سبب الدخول |
| المحفظة المتبوعة | `candidate_followed_wallet_id` | field | — | — |
| كيان القائد | `candidate_leader_entity_id` | field | — | — |
| عنقود الإسناد | `candidate_attribution_cluster_id` | field | — | — |
| مصدر الإشارة | `candidate_signal_source` | enum | followed_wallet · wallet_cluster · new_coin_radar · manual_review · system_diagnostic | — |
| ثقة الإسناد | `candidate_attribution_confidence` | derived | 0.0–1.0 | — |
| تعدّد القادة | `candidate_attribution_multi_leader` | list | — | معالجة التعارض (§4.2) |

## Group 33 — Batch Exit Orchestration (F9 — F-Elimination candidate)

> ARCH §15.8/§15.1. **الأمر الذرّي مرفوض للأبد**؛ preview→request؛ request على preview حديث فقط.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| طلب الخروج الجماعي | `candidate_batch_exit_request` | resource | — | per-position intents |
| أمر المعاينة | `candidate_cmd_preview_batch_exit` | command | — | معاينة per-position بلا تنفيذ |
| معرّف المعاينة | `candidate_batch_exit_preview_id` | field | — | يربط request بـ preview حديث |
| حالة عنصر المعاينة | `candidate_batch_exit_preview_item_status` | enum | eligible · blocked · stale | حالة المركز داخل الـ preview قبل الطلب |
| صلاحية المعاينة | `candidate_batch_exit_preview_valid_until` | field (ts) | — | بعدها يلزم preview جديد (ARCH يشترط preview حديث وصالح) |
| أمر الطلب | `candidate_cmd_request_batch_exit` | command | — | **لا يُقبل إلا على preview حديث وصالح** |
| حالة النتيجة per-position | `candidate_batch_exit_result_status` | enum | submitted · blocked · failed · skipped · filled | نتيجة بعد الإرسال (مختلفة عن حالة عنصر المعاينة) |

## Group 34 — Alerts (F10 — F-Elimination candidate)

> ARCH §15.8. severity منفصلة عن category؛ security+critical لا تُسكت كتجاوز.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| قاعدة تنبيه | `candidate_alert_rule` | resource | — | — |
| حدث تنبيه | `candidate_alert_event` | resource | — | — |
| إقرار تنبيه | `candidate_alert_ack` | resource | — | — |
| شدّة التنبيه | `candidate_alert_severity` | enum | info · warning · critical | منفصلة عن category |
| فئة التنبيه | `candidate_alert_category` | enum | security · risk · provider · data · ops · execution · wallet | — |
| مصدر التنبيه | `candidate_alert_source` | field | — | — |
| تفضيل التنبيه | `candidate_alert_preference` | resource | — | **security+critical غير قابلة للإسكات كتجاوز** |

## Group 35 — Reports / Preferences / Glossary / Onboarding (F11–F14 — F-Elimination candidate)

> ARCH §15.8. لا اختلاق مقاييس؛ preferences ليست config/risk bypass؛ glossary لا يعيد تعريف SSOT؛ onboarding بلا أسرار.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| تعريف تقرير | `candidate_report_definition` | resource | — | يوسّع `candidate_report_template_id` |
| artifact تقرير | `candidate_report_artifact` | resource | — | الصيغة عبر `candidate_export_format` (markdown/csv/jsonl/parquet) |
| سجلّ التصدير | `candidate_export_history` | resource | — | يوسّع `candidate_export_job` |
| provenance التقرير | `candidate_report_provenance` | field | — | — |
| زمن توليد التقرير | `candidate_report_generated_at` | field (ts) | — | — |
| تفضيلات الواجهة | `candidate_ui_preferences` | resource | — | UI-only، ليست config/risk bypass |
| لغة | `candidate_pref_language` | enum | ar · en | — |
| اتجاه | `candidate_pref_direction` | enum | rtl · ltr | — |
| وضع | `candidate_pref_mode` | enum | beginner · advanced | — |
| أعمدة ظاهرة | `candidate_pref_visible_columns` | field | — | — |
| عروض محفوظة | `candidate_pref_saved_views` | field | — | — |
| مرشّحات محفوظة | `candidate_pref_saved_filters` | field | — | — |
| تفضيلات الإشعارات | `candidate_pref_notifications` | field | — | — |
| محتوى المسرد | `candidate_glossary_content` | resource (content) | — | لا يعيد تعريف SSOT |
| إصدار المسرد | `candidate_glossary_version` | field | — | versioned |
| لغة المسرد | `candidate_glossary_locale` | enum | ar · en | — |
| خريطة المسرد لـ SSOT | `candidate_glossary_sot_mapping` | field | — | يشير لـ `source_of_truth_field` لا يعيد تعريفه |
| تقدّم الـ onboarding | `candidate_onboarding_progress` | resource | — | حالة/مراجع فقط، **بلا أسرار** |
| خطوات | `candidate_ob_steps` | field | — | — |
| حالة الإكمال | `candidate_ob_completion_state` | field | — | — |
| الوضع المختار | `candidate_ob_selected_mode` | enum | beginner · advanced | — |
| لغة/اتجاه | `candidate_ob_language_direction` | field | — | — |
| تقدّم المحفظة الأولى | `candidate_ob_first_wallet_progress` | field | — | لا مفاتيح |
| تقدّم إعداد المزوّد | `candidate_ob_provider_setup_progress` | field | — | `provider_key_ref` فقط |
| تقدّم إعداد paper | `candidate_ob_paper_setup_progress` | field | — | — |
| تقدّم تثقيف جاهزية live | `candidate_ob_live_readiness_education_progress` | field | — | لا تجاوز readiness |

---

## Group 36 — Config Policy Candidates (F-Elimination — تستهلك CONFIG §13)

> مفاتيح **سياسة config** (defaults/validation/mutability) الناشئة عن F-Elimination. كلها `candidate_*` config-versioned، **ليست trading config تتجاوز Hard Risk/signer/live**، ولا تُحوَّل إلى implemented. تُستهلك في `02-CONFIG §13`.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| سياسة عرض حالة السعر | `candidate_price_status_display_policy` | enum (config) | show_valid_only · show_with_warning · hide_unavailable | default `show_valid_only` (F2) |
| تفضيل مصدر mark | `candidate_mark_price_source_preference` | enum (config) | executable_quote_first · route_quote_first · liquidity_estimate_first · display_last | default `executable_quote_first` (F2) |
| سياسة عرض اكتمال التكاليف | `candidate_wt_cost_completeness_display_policy` | enum (config) | complete_only · show_estimated_with_warning · show_all_with_badges | default `show_estimated_with_warning` (F4) |
| حدّ ثقة العنقود الأدنى | `candidate_cluster_confidence_min` | field (number/threshold, config) | 0.0–1.0 | عتبة محافظة (F5) |
| سياسة استخدام العنقود | `candidate_cluster_usage_policy` | enum (config) | diagnostic_only · ranking_weight · block_only_when_confirmed | default `diagnostic_only`؛ لا تخويل تنفيذ (F5) |
| إلزام مطابقة الرصيد | `candidate_balance_reconciliation_required` | bool (config) | true · false | default `true` (F6) |
| إلزام تأكيد الكنس | `candidate_profit_sweep_confirmation_required` | bool (config) | true · false | default `true` للكنس اليدوي (F6) |
| تفعيل الكنس التلقائي | `candidate_auto_sweep_enabled` | bool (config) | true · false | default `false` (F6) |
| سياسة عرض هوية التوكن | `candidate_token_identity_display_policy` | enum (config) | mint_required · symbol_with_trust_badge · hide_untrusted_symbol | default `symbol_with_trust_badge`؛ mint canonical (F7) |
| حدّ ثقة الإسناد الأدنى | `candidate_attribution_confidence_min` | field (number/threshold, config) | 0.0–1.0 | عتبة محافظة (F8) |
| سياسة تعدّد القادة | `candidate_multi_leader_attribution_policy` | enum (config) | show_all · primary_plus_conflicts · hide_low_confidence | default `primary_plus_conflicts`؛ لا طيّ صامت للتعارض (F8) |
| TTL معاينة الخروج الجماعي | `candidate_batch_exit_preview_ttl_ms` | duration_ms (config) | — | required · default قصير/محافظ (F9) |
| أقصى مراكز للخروج الجماعي | `candidate_batch_exit_max_positions` | integer (config) | — | required · default محافظ (F9) |
| إلزام تأكيد الخروج الجماعي | `candidate_batch_exit_requires_confirmation` | bool (config) | true · false | default `true` (F9) |
| السماح بإرسال جزئي | `candidate_batch_exit_allow_partial_submission` | bool (config) | true · false | default `true` للمؤهّلة فقط (F9) |
| سياسة شدّة التنبيه | `candidate_alert_severity_policy` | policy (config) | — | يحترم severity/category؛ security+critical لا تُكتم (F10) |
| تفضيلات تسليم التنبيه | `candidate_alert_delivery_preferences` | preference (config) | — | لا تكتم الإلزامي (F10) |
| إلزام إقرار التنبيه لـ | `candidate_alert_ack_required_for` | field/list (config) | — | يشمل security+critical افتراضاً (F10) |
| سياسة redaction التقرير | `candidate_report_redaction_policy` | enum (config) | strict | default `strict` (F11) |
| سياسة المقياس المفقود | `candidate_report_missing_metric_policy` | enum (config) | show_unavailable · omit · block_report | default `show_unavailable`؛ لا اختلاق (F11) |
| سياسة تحرير المسرد | `candidate_glossary_edit_policy` | enum (config) | system_managed · admin_editable | default `system_managed` (F13) |
| تخزين تقدّم الـ onboarding | `candidate_onboarding_store_progress` | bool (config) | true · false | default `true`؛ بلا أسرار (F14) |

---

## Group 37 — Wave 1: Profit & Paper Truth (candidate)

> ARCHITECTURE §15.9. تحويل مفاهيم Wave 1 إلى أسماء محكومة `candidate_*` فقط — **بانتظار التثبيت النهائي بعد إقرار ARCHITECTURE**. **لا API/Data/UX/Test هنا.** يوسّع مجموعات قائمة بإعادة الاستخدام لا التكرار (G16/G18/G22/G23/G26/G27/G30/G35). أي **threshold/سياسة default** مرافق (مثل عتبات `candidate_fake_profit_risk`/`candidate_paper_real_divergence_status`/`candidate_token_readiness_component_veto`) **follow-up في CONFIG §13/Group 36**، لا يُضاف الآن.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| مخاطر الربح الوهمي | `candidate_fake_profit_risk` | derived | — | (W1-01) درجة/مستوى اشتباه ربح وهمي؛ تُخصَم من تقييم edge قبل أي ترتيب |
| سبب الربح الوهمي | `candidate_fake_profit_reason` | enum | self_trading · wash_trading · fake_volume · linked_wallet_circular_activity · creator_dev_controlled_trading · artificial_liquidity_activity_loop | (W1-01) ينتقل لاحقاً إلى reports/UX |
| edge بعد خصم الزيف | `candidate_fake_profit_adjusted_edge` | derived | — | (W1-01) يخفض `candidate_wallet_net_copyability_rank` (G26) ولا يرفع copyability؛ يعيد استخدام `candidate_is_copycat_flag` (G26) + cluster signals (G30) والكاشفات في ARCH (closed-loop wash/sybil). **Invariant:** apparent profit ليس copyable edge حتى تُزال/تُخصَم مخاطر الزيف |
| تفكيك مصدر الربح | `candidate_profit_source_attribution` | projection/derived | — | (W1-02) شرط مسبق لتوصية النسخ لا تقرير بعديّ |
| نوع مصدر الربح | `candidate_profit_source_type` | enum | early_entry · token_selection_quality · exit_timing · insider_non_copyable_information · execution_speed_advantage · artificial_pump_profit · non_repeatable_luck_one_off | (W1-02) inputs: `candidate_leader_vs_copier_delta` (G26) · `candidate_wt_entry_timing`/`candidate_wt_exit_timing` (G30) |
| صنف قابلية النسخ للمصدر | `candidate_profit_source_copyability_class` | enum | copyable · partially_copyable · non_copyable | (W1-02) insider/artificial_pump/one-off = non_copyable ولا ترفع copyability كـ edge |
| حصّة الربح القابل للنسخ | `candidate_copyable_profit_share` · `candidate_non_copyable_profit_share` | derived | — | (W1-02) read-model حصص المصدر |
| مكوّن جاهزية التوكن | `candidate_token_readiness_component` | derived (per-component) | — | (W1-03) يفكّك `token_readiness_score` (G16) — لا يبقى رقماً معتماً |
| نوع المكوّن | `candidate_token_readiness_component_type` | enum | token_age · liquidity · route_health · volatility · holder_risk · creator_risk · exit_feasibility · slippage_risk · migration_graduation_state · provider_route_reliability · wash_fake_activity_risk · token2022_extension_risk · token_authority_risk | (W1-03) creator_risk↔`creator_launch_rate_flag` (G16) · migration_graduation_state↔migration states (G1) · wash_fake_activity_risk↔`candidate_fake_profit_*`. **(Gap B / مصدر القرار ARCHITECTURE §14 + §7 decode 30%/gate 50% + فلتر `token2022` allow/deny §13):** `token2022_extension_risk` يفكّك خطر امتدادات Token-2022، و`token_authority_risk` يفكّك خطر سلطات الـ mint (mint/freeze authority). سببهما المعدَّد من `candidate_token_safety_reason` (أدناه) لا من الـ reason الحرّ العام؛ كلاهما يستخدم آلية الـ veto القائمة (`candidate_token_readiness_component_veto`)، ولا يُنشئ Hard Risk group ولا بوابة جديدة (الفحص إلزامي قائم في ARCHITECTURE §14) |
| سبب المكوّن | `candidate_token_readiness_component_reason` | derived | — | (W1-03) score explainable |
| veto المكوّن | `candidate_token_readiness_component_veto` | bool (derived) | true · false | (W1-03) مكوّن عالي الخطورة يحجب الجاهزية رغم إجمالي جيد؛ منع Goodhart على score واحد معتم |
| سبب أمان التوكن | `candidate_token_safety_reason` | enum (derived) | mint_authority_active · freeze_authority_active · permanent_delegate · pausable · transfer_hook_active · default_account_state_frozen · confidential_transfer · scaled_ui_amount · interest_bearing_mint · unknown_unsupported_extension · known_safe_exception · hook_upgraded_mid_hold | (Gap B · مصدر القرار ARCHITECTURE §14) السبب المعدَّد للمكوّنين `token2022_extension_risk`/`token_authority_risk` فقط (لا يُستخدم للمكوّنات العامة الأخرى). derived/read-only. يجعل بوابة Token-2022/authority الإلزامية القائمة (ARCH §14) **قابلة للإحالة والتحقّق** دون اختراع حقل token-risk عام ولا حقل مستقلّ لكل امتداد. `mint_authority_active`/`freeze_authority_active` = `token_authority_risk`؛ الباقي (عدا `known_safe_exception` و`hook_upgraded_mid_hold`) = `token2022_extension_risk`. **`hook_upgraded_mid_hold` خطر زمني أثناء الاحتفاظ لا مكوّن دخول؛ يُوصَل بمسار الخروج الطارئ (Position Monitor 90%/Exit Engine 100%) لا ببوابة الدخول؛ الدخول يعيد استخدام `transfer_hook_active`/`token2022_extension_risk`، والرفض النهائي يبقى `rejected_reason = token2022_dangerous_extension`؛ أدلّة المقارنة (slot · hook identity سابق/حالي · upgrade-authority status · sell-simulation result · emergency-exit decision) تُحفظ في Audit/provenance القائمة — لا حقل hash مستقل** |

> **دلالات أمان التوكن (Gap B · توثيقية — لا سلوك جديد، مصدرها ARCHITECTURE §14):**
> 1. **الامتداد الخطر أو حالة السلطة غير الآمنة** تُمثَّل كمكوّن جاهزية (`token2022_extension_risk`/`token_authority_risk`) وتحجب عبر آلية الـ veto القائمة `candidate_token_readiness_component_veto`؛ والرفض النهائي يستخدم القيمة القائمة `rejected_reason = token2022_dangerous_extension` (Group 17) — **لا قيمة رفض جديدة تُضاف.**
> 2. **`known_safe_exception`** = لا veto، **لكنه يبقى قابلاً للتفسير عبر provenance** (مثل `TransferHook` بـ program ID فارغ/مُعطّل كـ PYUSD، وفق ARCH §14 «يُفحَص الامتداد بحالته الفعلية لا بمجرد وجوده»).
> 3. **`unknown_unsupported_extension`** **لا يُعامَل كآمن**؛ هو unsupported/unavailable ويفشل بأمان (fail-safe → veto/حذِر) اتّساقاً مع ARCH §14 «رفض/تسعير حذِر حتى يُبنى parser كامل».
> 4. **`mint_authority_active` / `freeze_authority_active`** = token authority risks (component `token_authority_risk`)، وليست Hard Risk (Group 6) ولا بوابة مستقلّة جديدة.
> 5. **`update_authority`** **لا يُضاف كـ veto لجدوى البيع في هذه الجولة** (لا يمنع البيع على Solana)؛ يبقى سياق spoofing/metadata عبر `name_impersonation_score` (Group 16) فقط، ما لم تُلزِم ARCHITECTURE بغير ذلك صراحةً.
| ربح ورقي نظري إجمالي | `candidate_paper_pnl_gross_theoretical` | derived (simulated) | — | (W1-04) مثالي بلا تكاليف/فشل؛ **لا يُقبل وحده كدليل ربحية** |
| ربح ورقي واعٍ بالتنفيذ | `candidate_paper_pnl_execution_aware` | derived (simulated) | — | (W1-04) بعد fees/slippage/failures/latency؛ يوسّع `candidate_paper_pnl` (G22، يبقى موسوماً simulated) |
| أثر التكلفة المحاكى | `candidate_paper_cost_impact` | derived (simulated) | — | (W1-04) drag التكاليف؛ مصدره CostPipeline (لا حقول مكرّرة) |
| أثر الفشل المحاكى | `candidate_paper_failure_impact` | derived (simulated) | — | (W1-04) عوامل الفشل تُسنَد إلى `candidate_failure_origin` (G23: provider/route/signer/risk/liquidity/blockhash/bundle/fill) + FailedTransactionClassifier — لا حقول مكرّرة |
| حالة نتيجة الصفقة الورقية | `candidate_paper_outcome_state` | enum | reached_target · exited_with_loss · failed_entry · failed_exit · exit_unavailable · route_failed · expired · rejected_by_policy · still_open · force_closed_by_safety | (W1-05) لكل paper trade حالة؛ **مختلفة عن runtime `position_state` (G1)** — تصنيف terminal للتقرير لا حالة دورة حياة |
| سبب نتيجة الورقية | `candidate_paper_outcome_reason` | enum/field | — | (W1-05) الفشل يشير إلى `candidate_failure_origin` (G23)؛ الطوابع عبر Execution Trace `candidate_ts_*` (G23) |
| تقرير تجميع Paper | `candidate_paper_aggregation_report` | resource (report_definition instance) | — | (W1-06) context **simulated** · لا خلط مع real/live · يوسّع `candidate_report_definition` (G35)/`candidate_report_template_id` (G27) |
| بُعد التجميع | `candidate_paper_aggregation_dimension` | enum | wallet · mode · strategy · token_class · period | (W1-06) — |
| مقياس التجميع | `candidate_paper_aggregation_metric` | enum | max_drawdown · win_rate · avg_win · avg_loss · profit_factor · expectancy · median_hold_time · average_hold_time · failed_trade_rate · rejected_opportunity_count · exit_failure_rate · slippage_impact · latency_impact · fees_impact | (W1-06) متداخل مع `candidate_wallet_avg_hold_time`/`candidate_wallet_max_drawdown_if_copied` (G26) — إعادة استخدام؛ المفقود `show_unavailable` عبر `candidate_report_missing_metric_policy` (G36)، **لا اختلاق** |
| انحراف Paper↔Real | `candidate_paper_real_divergence` | derived (metric) | — | (W1-07) مصدره CalibrationStore `simulated_*` مقابل `real_*` (ARCH §9) |
| بُعد الانحراف | `candidate_paper_real_divergence_dimension` | enum | fill · slippage · exit_success · latency · provider_reliability | (W1-07) — |
| حالة الانحراف | `candidate_paper_real_divergence_status` | enum | within_band · elevated · high | (W1-07) `high` يغذّي Calibration Kill/Pause القائم (ARCH 95%)؛ **ليس gate حاجباً جديداً** على قرار REAL-LIVE؛ يظهر في التقارير قبل أي ترقية paper→real |

**W1-08 (لا حقل SSOT جديد — قاعدة/مصطلحات تحقّق):** point-in-time/survivorship — التقييم عند زمن T ببيانات ≤ T فقط، **no future leakage**، والمحافظ المنقرضة/الفاشلة تبقى ضمن العينة التاريخية (`survivorship_free_wallet_cohort`). تُعيد استخدام `candidate_wt_point_in_time` (G30) وتتقاطع مع §6/§1.1/§15.9 W1-08. **المصطلحات** `point_in_time_evaluation` · `no_future_leakage` · `survivorship_free_wallet_cohort` = قواعد تحقّق لا runtime fields، **تثبيتها follow-up في 07-TEST-PLAN** (لا API/Data field).

> **خلاصة Group 37:** الأسماء أعلاه `candidate_*` فقط، derived/enum/resource، تُعيد استخدام G16/G18/G22/G23/G26/G27/G30/G35 ولا تكرّرها؛ fake-profit لا يرفع copyability · المصدر non_copyable لا يُعرض كـ edge · readiness مفسَّرة بمكوّنات مع veto · Paper يفرّق gross-theoretical عن execution-aware ويبقى simulated ولا يُخلَط بـ real · لكل paper trade outcome · divergence إشارة تحذير تغذّي gate أمني قائم لا gate جديد · point-in-time قاعدة tests لا حقل. **إضافة Gap B (token safety):** المكوّنان `token2022_extension_risk`/`token_authority_risk` + enum `candidate_token_safety_reason` يفكّكان بوابة Token-2022/authority الإلزامية القائمة (ARCHITECTURE §14) ويجعلانها قابلة للإحالة/التحقّق — يستخدمان آلية الـ veto القائمة والقيمة القائمة `rejected_reason = token2022_dangerous_extension`، **بلا حقل token-risk عام، بلا حقل لكل امتداد، بلا Hard Risk group، بلا command/API/Data/UX/Test هنا**؛ الفلتر `token2022 allow/deny` قائم في CONFIG (§13) وACs التحقّق = TEST follow-up (جولة لاحقة). عتبات/defaults المرافقة = CONFIG follow-up. **No API/Data/UX/Test surface in this wave.**

---

## Group 38 — Wave 2: Discovery & Copy Safety (candidate)

> ARCHITECTURE §15.10. تحويل مفاهيم Wave 2 إلى أسماء محكومة `candidate_*` فقط — **بانتظار التثبيت بعد إقرار ARCHITECTURE**. **لا API/Data/UX/Test/Build/CONFIG هنا · لا config default · لا execution authority لأي تصنيف/مقياس · لا auto-ban · لا auto-config.** يوسّع G16/G18/G20/G25/G26/G30/G37 بإعادة الاستخدام لا التكرار. أي **threshold/سياسة default** مرافق (مثل عتبات concentration/drift/severity أو القيمة الافتراضية لـ `copy_mode`) = **CONFIG §13 follow-up**، لا يُضاف الآن.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| نوع المحفظة | `candidate_wallet_type` | enum (derived) | smart_money_wallet · kol_wallet · bot_wallet · insider_wallet · dev_creator_wallet · mev_sniper_wallet · copycat_wallet · linked_cluster_wallet | (W2-01) تصنيف read-only؛ copycat↔`candidate_is_copycat_flag` (G26) · linked_cluster↔`candidate_cluster_id` (G30)؛ **insider/dev/sniper/copycat لا يرفعون copyability**؛ لا execution authority |
| ثقة نوع المحفظة | `candidate_wallet_type_confidence` | derived | 0.0–1.0 | (W2-01) احتمالي؛ low-confidence لا يُعرَض كحقيقة مؤكدة |
| provenance النوع | `candidate_wallet_type_provenance` | enum | on_chain · heuristic · provider_enrichment · manual_review · mixed | (W2-01) نظير `candidate_cluster_provenance` (G30) |
| بُعد تركّز التوكن | `candidate_token_concentration_dimension` | enum (derived) | creator_dev_concentration · holder_concentration · bundled_wallets · linked_early_buyers · top_holder_risk · creator_previous_launch_quality · creator_dump_behavior · cluster_ownership_concentration | (W2-02) creator_previous_launch_quality↔`creator_launch_rate_flag` (G16) · cluster_*↔`candidate_cluster_id` (G30) |
| مخاطر التركّز | `candidate_token_concentration_risk` | derived | — | (W2-02) يغذّي `candidate_token_readiness_component` (G37، holder_risk/creator_risk) ويمكنه veto الجاهزية؛ لا execution authority |
| سبب التركّز | `candidate_token_concentration_reason` | derived | — | (W2-02) يظهر لاحقاً في risk panel/reports؛ تركّز creator/dev/cluster ليس طلباً طبيعياً |
| تصنيف الـ pump | `candidate_pump_classification` | enum (derived) | natural_pump · artificial_pump_linked_wallets · artificial_pump_wash_trading · kol_or_bot_amplified_pump · creator_dev_manipulated_pump · unknown_or_insufficient_evidence | (W2-03) منفصل عن السعر الخام؛ artificial → يخفض readiness/copyability أو watch_only/rejection؛ يتكامل مع `candidate_fake_profit_*` (G37) |
| سبب التصنيف | `candidate_pump_classification_reason` | derived | — | (W2-03) — |
| ثقة التصنيف | `candidate_pump_classification_confidence` | derived | 0.0–1.0 | (W2-03) ارتفاع السعر وحده ليس proof؛ لا execution authority |
| إشارة انحراف المحفظة | `candidate_wallet_drift_signal` | derived | — | (W2-04) بعد التفعيل؛ يبني على `candidate_wallet_behavior_drift_flag` (G26) ولا يكرّره |
| سبب الانحراف | `candidate_wallet_drift_reason` | enum | win_rate_degraded · average_slippage_worsened · exits_became_slower · lower_quality_tokens · copycat_like_behavior · bot_like_behavior · insider_dev_like_behavior · copyability_degraded · fake_profit_risk_increased | (W2-04) — |
| توصية الانحراف | `candidate_wallet_drift_recommendation` | enum (advisory) | keep_following · reduce_size · pause_follow · switch_to_watch_only · require_review | (W2-04) **advisory/read-only — لا تطبّق config تلقائياً ولا تغلق مراكز**؛ أي pause/reduce عبر user/config flow (نظير `candidate_recommendation_type` G25) |
| تعلّم المنشئ/العنقود | `candidate_creator_cluster_learning` | projection (derived) | — | (W2-06) إشارة تاريخية لا snapshot؛ تعيد استخدام `candidate_cluster_id` (G30)/`creator_launch_rate_flag` (G16) |
| مقياس التعلّم | `candidate_creator_cluster_learning_metric` | enum | creator_historical_quality · cluster_historical_quality · creator_dump_rate · post_launch_survival_quality · average_exit_feasibility · repeated_rug_exit_failure_behavior · paper_live_outcome_attribution_by_creator_cluster · cluster_repeat_manipulation_pattern | (W2-06) **point-in-time** عبر `candidate_wt_point_in_time` (G30) — لا تعلّم من المستقبل |
| توصية التعلّم | `candidate_creator_cluster_learning_recommendation` | enum (advisory) | avoid · watch_only · reduce_size · allow_small_paper · eligible_for_normal_evaluation | (W2-06) advisory؛ **لا auto-ban بلا evidence**؛ لا execution authority |
| ثقة/provenance التعلّم | `candidate_creator_cluster_learning_confidence` · `candidate_creator_cluster_learning_provenance` | derived · enum | 0.0–1.0 · (نظير `candidate_cluster_provenance`) | (W2-06) low-confidence ليس حقيقة مؤكدة |
| مقياس الاختيار المعاكس | `candidate_adverse_selection_metric` | derived | — | (W2-07) inputs: `candidate_leader_vs_copier_delta` (G26) · `latency_to_copy` (G20) · `entry_slippage_vs_leader` (G20) · `candidate_wt_exit_timing` (G30) · route/quote degradation · failed/late exits؛ **لا يخلط ربح القائد بربح التابع** |
| سبب الاختيار المعاكس | `candidate_adverse_selection_reason` | enum | late_entry_after_leader · slippage_from_delay · copied_worst_part_of_move · latency_drag · route_quote_degradation · failed_or_late_exit | (W2-07) — |
| شدّة الاختيار المعاكس | `candidate_adverse_selection_severity` | enum | low · elevated · high | (W2-07) يؤثّر على copyability وقد يغذّي watch_only/reduce_size (advisory)؛ **لا config auto-change · لا execution authority** |

**W2-05 (لا enum جديد — policy marker، يعيد استخدام `copy_mode` Group 2):** `candidate_copy_mode_default_policy` = ملاحظة سياسة معمارية: **الافتراضي الآمن `follow_entry_user_exit`**، و`full_mirror` **Advanced-only** يتطلّب enablement صريحاً per-wallet ولا يكون default عاماً ولا يُفعَّل ضمنياً. **القيمة الافتراضية التنفيذية تُحسم في `02-CONFIG-AND-POLICY-SCHEMA.md` بعد SSOT** — لا config default هنا، ولا يُسجَّل `full_mirror` كافتراضي. (يتّسق §1.1/§15.10 W2-05؛ `copy_entry_user_exit` = rejected alias قائم.)

> **خلاصة Group 38:** الأسماء `candidate_*` فقط، enum/derived/projection/advisory، تُعيد استخدام G16/G18/G20/G25/G26/G30/G37 ولا تكرّرها · نوع المحفظة لا يرفع copyability للأنواع الخطرة ولا يمنح تنفيذاً · تركّز التوكن يمكنه veto عبر readiness component (G37) · pump منفصل عن السعر الخام ويتكامل مع fake-profit · drift وlearning **advisory read-only بلا auto-ban/auto-config** · adverse selection لا يخلط ربح القائد بالتابع · W2-05 policy marker بلا config default و`full_mirror` ليس default. **عتبات/defaults = CONFIG follow-up. No API/Data/UX/Test/Build surface in this wave.**

---

## Group 39 — Wave 3: Reports & Honesty (candidate)

> ARCHITECTURE §15.11. تحويل مفاهيم Wave 3 إلى أسماء محكومة `candidate_*` فقط — **بانتظار التثبيت بعد إقرار ARCHITECTURE**. **لا API/Data/UX/Test/Build/CONFIG هنا · لا config default · لا report template IDs نهائية تنفيذية · لا execution authority لأي تقرير/مقياس/disclaimer · لا تغيير سلوك EV gate/Hard Risk · لا خلط Paper/Testnet/Real-Live.** يوسّع G2 (`ev_gate_mode`/`warning_only`) · G22 (P&L) · G27 (`candidate_report_template_id`/`candidate_storage_usage_metric`) · G35 (Reports F11) · G37 (Paper) بإعادة الاستخدام لا التكرار. أي threshold/سياسة = **CONFIG follow-up**.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| التقرير اليومي الموحّد | `candidate_daily_unified_report` | resource (report_definition instance) | — | (W3-01) يوسّع `candidate_report_definition` (G35)؛ أقسام منفصلة لا حساب مخلوط · لا execution authority |
| سياق التقرير | `candidate_report_context` | enum | simulated · testnet · real_live | (W3-01) فصل إلزامي؛ **لا خلط Paper/Testnet/Real-Live** |
| قسم التقرير | `candidate_report_section` | enum | paper_results · real_live_results · testnet_results · rejected_opportunities · failed_trades · open_risk · provider_health · config_changes · safety_gate_state · data_quality_issues · major_alerts | (W3-01) المقياس المفقود `show_unavailable`/insufficient_evidence لا صفر (عبر `candidate_report_missing_metric_policy` G36) |
| كتالوج التقارير | `candidate_report_catalog` | resource | — | (W3-02) قوالب رسمية؛ custom لا تستبدلها |
| نوع تعريف التقرير | `candidate_report_definition_type` | enum | daily_unified_report · per_wallet_report · per_token_report · failed_trade_report · rejected_opportunity_report · copy_mode_report · provider_report · creator_cluster_report · strategy_mode_report · paper_aggregation_report · paper_real_divergence_report · net_business_pnl_report · weekly_comparison_report | (W3-02) يعيد استخدام `candidate_paper_aggregation_report` (G37)/`candidate_paper_real_divergence` (G37)؛ كل تعريف يحدّد scope/context/dimensions/metrics/evidence(`candidate_report_provenance`)/missing-metric/disclaimer/paper-real-separation |
| تقرير المقارنة الأسبوعي | `candidate_weekly_comparison_report` | resource (report_definition instance) | — | (W3-03) يساعد القرار لا يثبت ربحية مستقبلية؛ لا auto-apply |
| محور المقارنة الأسبوعي | `candidate_weekly_comparison_axis` | enum | wallet · copy_mode · brain · provider · strategy · token_class · config_before_after · paper_real_divergence · creator_cluster_cohort · adverse_selection_impact | (W3-03) `config_before_after` يحترم `config_version_at_entry` (G9)؛ المفقود unavailable؛ لا خلط Paper/Real |
| متطلّب الإخلاء | `candidate_report_disclaimer_requirement` | enum | past_performance_not_future_profitability · paper_not_live_profitability · backtest_requires_point_in_time_evidence · results_affected_by_cost_latency_provider_data_quality · high_confidence_not_certainty · recommendations_are_advisory_until_user_config_flow | (W3-04) ليس بديلاً عن gates · لا يصحّح تقريراً غير صالح · لا يختفي في advanced mode |
| الإخلاء مطلوب لـ | `candidate_report_disclaimer_required_for` | enum/list | paper · backtest · weekly · recommendation · promotion | (W3-04) — |
| تقرير الربح التجاري الصافي | `candidate_net_business_pnl_report` | resource (report_definition instance) | — | (W3-05) **طبقة تقارير مشتقّة فوق P&L القائم، ليست بديلاً لـ trade P&L** |
| الربح التجاري الصافي | `candidate_net_business_pnl` | derived | — | (W3-05) = trade net P&L (`candidate_realized_pnl`/`candidate_fees_total`/`candidate_slippage_cost` G22) − تكاليف التشغيل؛ **positive trade P&L لا يعني positive business P&L** · لا execution authority |
| مكوّن تكلفة الأعمال | `candidate_business_cost_component` | enum | provider_credit_cost · rpc_streaming_cost · infra_storage_export_report_cost · subscription_provider_cost | (W3-05) المدخلات من مسارات cost/provider/credit/infra القائمة (§16 RPC/Credit Budget · `candidate_storage_usage_metric` G27)؛ **لا حقل تكلفة بنية جديد في ARCH** |
| حالة الربح التجاري | `candidate_net_business_pnl_status` | enum | complete · partial · unavailable | (W3-05) **unavailable/partial لا صفر** |
| سياق بوّابة التقرير | `candidate_report_gate_context` | enum | clean_pass · warning_only_advisory · blocked | (W3-06) يميّز سلوك البوّابة وقت القرار؛ **warning_only_advisory لا يُعرَض كـ clean_pass** |
| وسم warning_only التقريري | `candidate_warning_only_report_tag` | derived (flag, read-only) | true · false | (W3-06) يكشف أن النتيجة/التقرير أُنتج أثناء `ev_gate_mode=warning_only` (G2)؛ **read-only · لا يغيّر EV gate · لا يضعف Hard Risk · لا execution mode · لا report promotion بلا disclosure · failed EV لا يختفي** (يتّسق `WARNING_CRITICAL` G1) |

> **خلاصة Group 39:** الأسماء `candidate_*` فقط، resource/enum/derived، تُعيد استخدام G2/G9/G22/G27/G35/G37 ولا تكرّرها · التقارير تفصل Paper/Testnet/Real-Live ولا تمنح execution authority · المفقود unavailable لا صفر · القوالب رسمية لا custom ضمني · disclaimer ليس بديلاً عن gates ولا يصحّح تقريراً غير صالح · Net Business PnL طبقة مشتقّة (positive trade P&L ≠ positive business P&L) وبلا حقل تكلفة بنية جديد · `warning_only` وسم تقريري read-only لا يغيّر EV gate/Hard Risk ولا يُعرَض كـ clean pass. **عتبات/defaults/template IDs نهائية = CONFIG/SSOT follow-up. No API/Data/UX/Test/Build surface in this wave.**

---

## Group 40 — Wave 4: Execution / Providers + Data (candidate)

> ARCHITECTURE §15.12. تحويل مفاهيم Wave 4 إلى أسماء محكومة `candidate_*` فقط — **بانتظار التثبيت بعد إقرار ARCHITECTURE**. **توثيقي بحت: لا API/Data/UX/Test/Build/CONFIG هنا · لا config default · لا provider raw key/secret/credential field · لا provider connection/execution command · لا report template IDs نهائية.** يوسّع G1 (`provider_degraded`/`slot_lag`/`NETWORK_ROLLBACK_EVENT`) · G8 (`hunt_status`/`watch_only`/rejection) · G23 (Execution Trace `candidate_ts_*`/`candidate_failure_origin`) · G27 (`candidate_storage_usage_metric`/`candidate_data_quality_metric`/`candidate_provider_key_ref`) · G37 (`candidate_token_readiness_component`/`candidate_paper_aggregation_report`/`candidate_paper_real_divergence`) · G39 (`candidate_weekly_comparison_report`/`candidate_report_disclaimer_requirement`/`candidate_net_business_pnl`/`candidate_business_cost_component`) + operating-state (`MIGRATION_IN_PROGRESS`/migration limbo) بإعادة الاستخدام لا التكرار. **لا إشارة provider/execution/data-cost/opportunity تمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · المفقود unavailable/partial لا صفر/clean.** أي threshold/سياسة = **CONFIG follow-up**.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| مقياس latency للمزوّد | `candidate_provider_latency_metric` | derived | — | (W4-01) يعيد استخدام Execution Trace `candidate_ts_*` (G23)؛ observability؛ مفقود → unavailable لا صفر |
| نوع latency | `candidate_provider_latency_type` | enum | stream_latency · quote_latency · route_latency · send_latency · confirmation_finality_latency · provider_response_error_latency | (W4-01) — |
| مقارنة latency للمزوّدين | `candidate_provider_latency_comparison` | derived (read-only/advisory) | — | (W4-01) best/worst؛ **لا execution authority · لا auto provider selection** (المزوّد السريع ليس آمناً/قابلاً للتنفيذ) |
| مراقبة rate-limit/تكلفة المزوّد | `candidate_provider_rate_limit_monitor` | derived (advisory/observability) | — | (W4-02) يعيد استخدام §16 RPC/Credit Budget؛ **لا execution authority** |
| مقياس تكلفة المزوّد | `candidate_provider_cost_metric` | enum | rate_limit · quota_usage · credit_usage · request_cost · period_cost · cost_per_trade · cost_per_report · cost_per_job · throttling_backoff_state · provider_degradation | (W4-02) يرتبط بـ `candidate_net_business_pnl`/`candidate_business_cost_component` (G39) دون إعادة تعريف |
| حالة إسناد تكلفة المزوّد | `candidate_provider_cost_attribution_status` | enum | complete · partial · unavailable | (W4-02) **partial/unavailable لا صفر** (التوفّر والكلفة إشارتان منفصلتان) |
| حالة finality (fork/rollback) | `candidate_finality_state` | enum | no_rollback_detected · rollback_risk · fork_detected · rollback_confirmed · finality_uncertain | (W4-03) يعيد استخدام `NETWORK_ROLLBACK_EVENT`/`slot_lag`/`provider_degraded` (G1)؛ **حدث/حالة مستقلة لا تُدفَن في stream gap · لا gate جديد · لا execution authority** |
| سبب rollback/fork | `candidate_rollback_fork_reason` | field | — | (W4-03) البيانات المتأثّرة **موسومة بـ warning/provenance لا تُعامَل كحقيقة نهائية** |
| حالة onboarding المزوّد | `candidate_provider_onboarding_status` | derived | — | (W4-04) connection success ليس trading readiness |
| نوع المزوّد | `candidate_provider_type` | enum | helius · jito · jupiter · generic_rpc · generic_stream | (W4-04) — |
| حالة قدرة المزوّد | `candidate_provider_capability_status` | field/enum | — | (W4-04) role/capability/permission |
| حالة اختبار اتصال المزوّد | `candidate_provider_connection_test_status` | field | — | (W4-04) Jupiter key/connection validation حالة مستقلة؛ **لا provider connection command** |
| سبب فشل onboarding | `candidate_provider_onboarding_failure_reason` | field | — | (W4-04) يعيد استخدام `candidate_provider_key_ref` (G27) **key reference/status فقط — لا raw key/secret · readiness لا يتجاوز signer/risk/admission gates** |
| تقرير تكلفة التخزين | `candidate_storage_cost_report` | derived | — | (W4-05) يعيد استخدام `candidate_storage_usage_metric` (G27)؛ يرتبط بـ Net Business PnL؛ **مفقود → partial/unavailable لا صفر** |
| مكوّن تكلفة التخزين | `candidate_storage_cost_component` | enum | data_type · retention_period · volume · hot_cold_archive_tier · report_export_artifacts · replay_backtest_datasets | (W4-05) **لا storage pricing fields نهائية الآن** |
| تحذير أثر الاحتفاظ | `candidate_retention_impact_warning` | field/flag | — | (W4-05) يحذّر إن أثّر على historical discovery/dead-failed wallets/replay-backtest/audit |
| حالة أمان الـ pruning | `candidate_pruning_safety_status` | enum | safe · survivorship_risk · point_in_time_risk · audit_integrity_risk | (W4-05) **الحذف لتوفير التكلفة لا يخلق survivorship bias صامتاً · لا يكسر point-in-time/survivorship-free** |
| إعادة تقييم فرصة مرفوضة | `candidate_rejected_opportunity_reevaluation` | derived (advisory) | — | (W4-06) يعيد استخدام `hunt_status`/`watch_only`/`candidate_rejected_reason` (G8)؛ يحفظ original reason + new evidence؛ **لا buy/execute · لا auto-open · لا auto-config · تحسّن الفرصة لا يثبت edge** |
| مُحفّز إعادة التقييم | `candidate_reevaluation_trigger` | enum | liquidity_improved · route_health_improved · holder_risk_improved · creator_risk_improved · pump_confidence_improved · concentration_risk_improved · provider_data_quality_improved · exit_feasibility_improved | (W4-06) — |
| توصية إعادة التقييم | `candidate_reevaluation_recommendation` | enum | keep_rejected · keep_watch_only · review_again · eligible_for_paper · eligible_for_normal_evaluation | (W4-06) advisory فقط |
| توصية أفضل إعدادات Paper | `candidate_best_paper_settings_advisory` | derived (report/advisory) | — | (W4-07) **Paper-only · advisory لا auto-apply · لا live promotion بلا gates**؛ يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence` (G37)/`candidate_weekly_comparison_report`/`candidate_report_disclaimer_requirement` (G39) |
| توصية إعدادات Paper | `candidate_paper_settings_recommendation` | field | — | (W4-07) mode/strategy/copy_mode + fees/slippage/latency/failure impact؛ best paper setting ليس live-ready setting |
| حالة دليل إعدادات Paper | `candidate_paper_settings_evidence_status` | enum | sufficient · insufficient_evidence · unavailable | (W4-07) عينة صغيرة/ناقصة → insufficient_evidence لا صفر |
| حالة فخّ التخرّج | `candidate_graduation_trap_state` | enum | graduation_pending · migration_limbo · post_graduation_exit_unsafe · post_graduation_liquidity_fragile · post_graduation_route_unhealthy · post_graduation_watch_only · graduation_trap_confirmed | (W4-08) يرتبط بـ migration state (`MIGRATION_IN_PROGRESS`/migration limbo)/Brain handoff/`candidate_token_readiness_component` (G37)/exit feasibility دون إعادة تعريف؛ **يؤثّر على readiness/exit feasibility/reports · لا execution authority · لا gate جديد (graduation ليس دليل أمان خروج)** |

> **خلاصة Group 40:** الأسماء `candidate_*` فقط، enum/derived/advisory/observability، تُعيد استخدام G1/G8/G23/G27/G37/G39 + operating-state ولا تكرّرها · المزوّد السريع/المتصل ليس آمناً/جاهزاً للتداول · التوفّر والكلفة إشارتان منفصلتان · بيانات rollback موسومة لا نهائية · الحذف لا يخلق survivorship bias · الفرصة المعاد تقييمها ليست أمر تنفيذ · أفضل إعداد Paper ليس live-ready · التخرّج ليس دليل أمان خروج · المفقود unavailable/partial لا صفر · **لا provider raw key/secret · لا provider connection/execution command · لا execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService**. **عتبات/defaults/template IDs نهائية = CONFIG/SSOT follow-up. No API/Data/UX/Test/Build surface in this wave.**

---

## Group 41 — Wave 5: Local Ops & Readiness (candidate)

> ARCHITECTURE §15.13. تحويل مفاهيم Wave 5 إلى أسماء محكومة `candidate_*` فقط — **بانتظار التثبيت بعد إقرار ARCHITECTURE**. **توثيقي بحت: لا API/Data/UX/Test/Build/CONFIG هنا · لا config default · لا commands/scripts/launcher · لا service-control/restart/shutdown/backup/restore/purge/migration/rollback command field · لا raw key/secret/credential field · لا provider setup implementation.** يوسّع `config_version`/`config_version_at_entry` · `signer_profile_status` · `operating_state` · `migration_phase`/`MIGRATION_IN_PROGRESS` (MigrationStateMachine) · `candidate_provider_key_ref`/`candidate_provider_onboarding_status` (G40 provider health) · `candidate_data_quality_metric`/`candidate_storage_usage_metric` (G27) · `candidate_app_version` (القائم) · Audit Trail بإعادة الاستخدام لا التكرار. **Local Ops/health/version/log/status لا يمنح execution authority · health green ليس trading readiness · documented/candidate ليس implemented · المفقود unavailable/unknown/not_verified لا clean/implemented · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService.** أي threshold/سياسة = **CONFIG follow-up**.

| term | source_of_truth_field | type | allowed_values | meaning |
|---|---|---|---|---|
| حالة سير التشغيل المحلي | `candidate_local_run_workflow_status` | enum | not_started · checking · ready_for_local_use · degraded · blocked · unknown | (W5-01) local app running ليس trading readiness · ready_for_local_use ≠ Real-Live ready |
| خدمة محلية مطلوبة | `candidate_required_local_service` | field | — | (W5-01) checklist |
| متطلب محلي ناقص | `candidate_local_run_missing_requirement` | field | — | (W5-01) missing → degraded/unavailable لا clean |
| الخطوة المحلية التالية | `candidate_local_run_next_action` | field | — | (W5-01) guidance لا command |
| حالة دليل التشغيل المحلي | `candidate_local_run_evidence_status` | enum | present · partial · missing · stale · unknown | (W5-01) provenance |
| صحة التشغيل المحلي | `candidate_local_ops_health` | derived (read-only/diagnostic) | — | (W5-02) health green ليس execution-safe |
| نوع الخدمة | `candidate_local_ops_service_type` | enum | postgresql · clickhouse · redis · api · ui · stream_ingestion · decision_engine · signer_service · provider_connectivity · job_runner · data_quality · queue_backlog · config_migration_state · disk_storage_pressure · audit_log_pipeline | (W5-02) — |
| حالة الخدمة | `candidate_local_ops_service_status` | enum | healthy · degraded · unavailable · unknown · not_configured · blocked | (W5-02) يعيد استخدام `signer_profile_status`/G40 provider health/`candidate_data_quality_metric`؛ **SignerService health ليس permission to sign · Provider health ليس trading readiness** |
| سبب حالة الصحة | `candidate_local_ops_health_reason` | field | — | (W5-02) unavailable/degraded لا stack trace فقط |
| الإجراء التالي للصحة | `candidate_local_ops_health_next_action` | field | — | (W5-02) أي control/restart لاحق عبر API/SSOT/permission/audit — **لا command الآن** |
| حدث log المشغّل | `candidate_operator_log_event` | derived | — | (W5-03) يعيد استخدام Audit Trail؛ مفهوم للمشغّل |
| شدّة الـ log | `candidate_operator_log_severity` | enum | info · warning · error · critical | (W5-03) — |
| فئة الـ log | `candidate_operator_log_category` | enum | ops · provider · data · config · migration · job · api · ui · signer · security · audit · execution · storage | (W5-03) — |
| خدمة الـ log | `candidate_operator_log_service` | field | — | (W5-03) — |
| مرجع الترابط | `candidate_operator_log_correlation_ref` | field | — | (W5-03) correlation/request/job id |
| ملخّص للمستخدم | `candidate_operator_log_user_summary` | field | — | (W5-03) لا stack trace كرسالة وحيدة |
| تفصيل تقني | `candidate_operator_log_technical_detail` | field | — | (W5-03) stack trace كـ detail فقط |
| إجراء آمن تالٍ | `candidate_operator_log_safe_next_action` | field | — | (W5-03) — |
| حالة الإخفاء (redaction) | `candidate_operator_log_redaction_status` | enum | redacted · not_required · redaction_failed · blocked_contains_secret · unknown | (W5-03) **raw keys/tokens/secrets ممنوعة · log clarity لا يسرّب secrets · log health لا يمنح execution authority** |
| حالة إصدار API | `candidate_api_version_status` | derived | — | (W5-04) يعيد استخدام `candidate_app_version` لإصدار التطبيق |
| إصدار مخطّط DB | `candidate_db_schema_version` | derived | — | (W5-04) — |
| إصدار مخطّط config | `candidate_config_schema_version` | derived | — | (W5-04) يعيد استخدام `config_version`/`config_version_at_entry` للإصدار الحالي |
| حالة إصدار العقود | `candidate_contracts_version_status` | derived | — | (W5-04) contracts/API docs |
| حالة الترحيل | `candidate_migration_status` | enum | up_to_date · pending · running · failed · blocked · unknown | (W5-04) يعيد استخدام MigrationStateMachine/`migration_phase`؛ failed لا يظهر clean · **لا migration command/destructive** |
| ترحيل معلّق | `candidate_pending_migration` | field | — | (W5-04) — |
| ترحيل فاشل | `candidate_failed_migration` | field | — | (W5-04) — |
| توفّر rollback | `candidate_rollback_availability` | enum | available · unavailable · blocked · not_supported · unknown | (W5-04) عرض فقط · **لا rollback command الآن** |
| حالة توافق الإصدار | `candidate_version_compatibility_status` | enum | compatible · incompatible · warning · unknown · not_verified | (W5-04) mismatch واضح · current version display ليس system/trading readiness · لا يغيّر Risk Gates |
| حالة preflight الترقية | `candidate_upgrade_preflight_status` | enum | pass · warning · blocked · failed · unavailable · unknown | (W5-05) — |
| متطلب backup للترقية | `candidate_upgrade_backup_requirement` | enum | satisfied · required_missing · not_required · blocked · unknown | (W5-05) **لا secrets في backup/export** |
| توافق ترحيل الترقية | `candidate_upgrade_migration_compatibility` | enum | compatible · incompatible · warning · unknown · not_verified | (W5-05) — |
| حالة مسار rollback | `candidate_rollback_path_status` | enum | available · unavailable · blocked · invalid · unknown | (W5-05) rollback لا يفقد audit/history/config |
| سبب حجب الترقية | `candidate_upgrade_blocked_reason` | field | — | (W5-05) — |
| تحقّق صحة ما بعد الترقية | `candidate_post_upgrade_health_verification` | enum | pass · warning · failed · blocked · unavailable · unknown | (W5-05) upgrade success ليس trading readiness |
| حالة حادثة الترقية | `candidate_upgrade_incident_status` | enum | none · open · blocked · mitigated · resolved · unknown | (W5-05) failed upgrade → incident/blocker · **لا upgrade/rollback/backup/restore command** |
| نوع فعل الصيانة | `candidate_maintenance_action_type` | enum | restart_service · safe_shutdown · backup · restore · export_diagnostics · clear_cache · reindex_rebuild_projections · migration_check · config_rollback_preview | (W5-06) policy/names فقط — **لا commands** |
| حالة فعل الصيانة | `candidate_maintenance_action_status` | enum | unavailable · preview_required · permitted · blocked · running · completed · failed · unknown | (W5-06) — |
| حالة صلاحية الصيانة | `candidate_maintenance_permission_status` | enum | permitted · denied · requires_permission · unavailable · unknown | (W5-06) permissioned |
| حالة تدقيق الصيانة | `candidate_maintenance_audit_status` | enum | audit_ready · audit_missing · audit_failed · not_required · unknown | (W5-06) audited |
| حالة معاينة الصيانة | `candidate_maintenance_preview_status` | enum | preview_available · preview_required · preview_missing · not_required · unknown | (W5-06) previewed where destructive/risky |
| سبب حجب الصيانة | `candidate_maintenance_block_reason` | field | — | (W5-06) blocked when unsafe |
| حالة قابلية العكس | `candidate_maintenance_reversibility_status` | enum | reversible · partially_reversible · irreversible · unknown | (W5-06) reversible where possible |
| حالة الإيقاف الآمن | `candidate_safe_shutdown_status` | enum | safe_to_shutdown · blocked_pending_intents · blocked_active_signing · blocked_critical_jobs · unknown | (W5-06) **shutdown لا يترك intents معلقة · restart لا أثناء active signing/critical pending intents إلا بسياسة آمنة · backup بلا raw secrets · restore لا يكسر audit/history/config · clear cache لا يحذف source-of-truth · rebuild projections لا يغيّر سلطة PostgreSQL · لا execution authority** |
| حالة التنفيذ | `candidate_implementation_status` | enum | implemented · partially_implemented · documented_only · candidate · not_built · blocked · deprecated | (W5-07) **documented ليس implemented · candidate لا يظهر built · status لا يمنح execution authority** |
| دليل حالة التنفيذ | `candidate_implementation_status_evidence` | field | — | (W5-07) — |
| مصدر حالة التنفيذ | `candidate_implementation_status_source` | field | — | (W5-07) — |
| وسم حالة القدرة | `candidate_capability_status_label` | field | — | (W5-07) كل Local Ops capability يظهر status واضح |
| طابع تحقّق الحالة | `candidate_status_verified_at` | field | — | (W5-07) timestamp |
| حالة تحقّق الحالة | `candidate_status_verification_state` | enum | verified · not_verified · stale · unknown | (W5-07) unknown → unknown/not_verified لا implemented · build/test لاحقاً يتحقّق من labels |

> **خلاصة Group 41:** الأسماء `candidate_*` فقط، enum/derived/diagnostic، تُعيد استخدام config_version/signer_profile_status/operating_state/migration_phase/G27/G40 provider-health/`candidate_app_version`/Audit Trail ولا تكرّرها · تشغيل التطبيق محلياً ليس trading readiness · صحة الخدمة تشخيصية لا إذن تنفيذ (signer health ليس permission to sign) · log clarity لا يسرّب secrets · توافق الإصدار شرط مسبق لا execution authority · upgrade success ليس trading readiness · أفعال الصيانة policy/states فقط (safe-by-default/audited/غير سلطوية على source-of-truth، لا commands) · documented ليس implemented (unknown → not_verified) · المفقود unavailable/unknown/not_verified لا clean/implemented · **لا commands/scripts/launcher · لا raw key/secret/credential · لا migration/backup/restore/restart/shutdown/purge/rollback command · لا execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService**. **عتبات/defaults نهائية = CONFIG/SSOT follow-up. No API/Data/UX/Test/Build surface in this wave.**

---

---



**No blocking pending items.** الحقول الجديدة مسجّلة في Groups 22–41 ببادئة `candidate_*` بانتظار **التسمية النهائية بعد إقرار ARCHITECTURE** (Group 37 = Wave 1، ARCH §15.9؛ Group 38 = Wave 2، ARCH §15.10؛ Group 39 = Wave 3 Reports & Honesty، ARCH §15.11؛ Group 40 = Wave 4 Execution/Providers+Data، ARCH §15.12؛ Group 41 = Wave 5 Local Ops & Readiness، ARCH §15.13). **F-Elimination (F1–F14):** كل عناصر `[F]` السابقة حُسمت — مُرقّاة candidate (Groups 28–35) أو مرفوضة دائماً (Rejected Aliases: الأمر الذرّي للخروج الجماعي · أسماء P&L القديمة غير المسبوقة · `current_price`). **مفاتيح سياسة config المرافقة مسجّلة في Group 36 (تستهلكها CONFIG §13).** `behavior_shift_flag` حُسم كـ `candidate_wallet_behavior_drift_flag` (Group 26). يبقى خارج النطاق صراحةً: `discovery_only_mode` · `RESEARCH_ONLY` · `ADVANCED_DISABLED_BY_DEFAULT` · `resource_type=opportunity` write · raw REST execution routes · `buy_opportunity`.

**خلاصة إغلاق المجموعات 1–15** (تاريخي): اكتمل استخراج المجموعات الخمس عشرة، وحُسمت كل المعلّقات بما فيها API Vocabulary (11) وEnvelope (12) وStream Subscription (13) وAudit Vocabulary (14) وExecution Wallet/Signer (15). خلاصة الإغلاق:

**أُثبتت بـ machine values:** `strategy_brain` (brain_a/brain_b، ويشمل current_control_brain/entry_brain/issuing_brain) · `execution_mode` (6 قيم) · `copy_event` (17 معرّفاً) · `transfer_exit_policy` (3) · `scale_in_policy` (3) · `conflict_resolution` (قيمة واحدة) · `protocol_constant_status` (green/changed).
**توحيد تسمية:** `disable_adds` = rejected alias؛ canonical = `disable_new_adds` (صُحّح في ARCHITECTURE §4.2).
**أُغلقت دون enum (إبقاء المؤصَّل):** `provider_health`/`rpc_degradation_state` · `stream_gap_status` · `slot_lag_status` · `bundle_observer_status`.
**display مؤصَّل دون توسّع:** `readiness_status` → `WARNING_CRITICAL`.

> **القاعدة الحاكمة مستمرة:** `No field before SSOT`. أي حقل/enum/state/event جديد يظهر في الوثائق التنفيذية القادمة (Config/API/UX/Data Model/Build/Tests/Runbook/Security) يُقرّ في ARCHITECTURE أولاً، ثم يُسجَّل هنا، قبل استخدامه. SSOT جاهزة كبوّابة مستمرة لوثائق API/UX/Data Model/Build/Tests/Runbook/Security.
