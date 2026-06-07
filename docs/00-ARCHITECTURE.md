# ARCHITECTURE.md

> **Priority:** 00 — Foundational (Decision Source) · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** وثيقة القرار العليا
## Custom Solana Smart-Money / Pump.fun / PumpSwap Trading Engine

**نسخة:** 1.8
**النطاق:** التصميم الكامل للمنصة، شاملاً PAPER-LIVE و REAL-LIVE.
**ملاحظة صدق أساسية:** هذه المنصة مصمّمة *لاختبار* وجود alpha، لا لافتراضه. وجود ربح صافٍ بعد كل التكاليف فرضية غير مُثبتة تجريبياً، والنظام بُني ليقيسها بأمانة قبل المخاطرة بمال حقيقي. هذا الذكر الصريح جزء من التصميم، لا تحفّظ خارجه.
**ملاحظة واقعية على copy-trading (مضافة في 1.6):** تتبّع المحافظ **تفاعلي بطبعه** — تدخل دائماً *بعد* المحفظة الهدف، ومهما بلغت سرعة الشبكة فالسعر قد يكون تحرّك في تلك النافذة. لا يوجد دليل عام قاطع على ربحية صافية مستدامة من نسخ smart money بعد التكاليف والكمون و adverse selection (على Pump.fun تتخرّج ~1–2% فقط من العملات). يُعامَل الـ edge هنا كفرضية تُختبَر بأمانة عبر القياس والمعايرة (PAPER اختياري + tranche حية صغيرة)، لا كحقيقة مُسلَّمة. (قرار الانتقال إلى REAL-LIVE للمستخدم؛ لا بوابة حاجبة.)

---

## 1. هوية النظام (System Identity)

نظام تداول كمّي (Quantitative Trading System) خاص بالكامل على شبكة Solana، يراقب المحافظ الذكية، يفحص التوكنات، يقدّر القيمة المتوقعة، ينفّذ، يراقب المركز، ويخرج آلياً.

**النظام هو:** محرك قرار مستقل يبني تقييمه بنفسه ويستخدم Helius / Jito / Jupiter / Bitquery / Birdeye كأدوات بيانات وتنفيذ.

**النظام ليس:** Blind Copy Bot، ولا Trojan/Maestro wrapper، ولا أداة dev/volume manipulation، ولا تداولاً يدوياً.

---

## 1.1 توجّه التطبيق ونطاقه (Application Scope — حد لا يُتجاوز)

**التطبيق لا يخرج عن هذين المسارين، وأي ميزة لا تخدمهما خارج النطاق:**

1. **اكتشاف المحافظ الناجحة والرابحة** بأفضل الطرق والأساليب — تنقيب وتقييم المحافظ (point-in-time، خالٍ من تحيّز البقاء)، كشف smart money / KOL، وترتيبها حسب جودتها وقابلية نسخها (copyability) واستمراريتها بعد التكاليف.

2. **تتبّع هذه المحافظ ونسخها** بأحد نمطين يحدّدهما المستخدم **لكل محفظة على حدة**:
   - **نمط الخروج بهدف ربح (`copy_mode = follow_entry_user_exit`):** يدخل النظام مع المحفظة (شراء)، ويخرج عند **نسبة ربح يحدّدها المستخدم** (`take_profit_pct`) أو وفق قواعد الخروج/الأمان (stop, time exit, liquidity drain, exit feasibility).
   - **نمط النسخ الكامل (`copy_mode = full_mirror`):** يتابع المحفظة شراءً وبيعاً (يدخل عند دخولها ويخرج عند خروجها)، مع إبقاء طبقات الأمان فعّالة (exit feasibility, rug/safety checks).

**التحكّم لكل محفظة منسوخة (per-wallet config):** المستخدم يعدّل إعدادات كل محفظة مستقلةً: `copy_mode` · `take_profit_pct` (في نمط الخروج بالهدف) · `sizing_mode`/`sizing_value` (الحجم: دولار/SOL/% — انظر §4) · حدود المخاطر الخاصة بالمحفظة · تفعيل/تعطيل المتابعة. الإعدادات تمنح حرية كاملة في *كيفية* النسخ، بينما تبقى طبقات الأمان (Kill Switches, Exit Feasibility, Position Accounting, Audit Trail, Duplicate Protection, Mode Separation) فعّالة لأنها لا تخصّ توجّه التطبيق بل سلامته التشغيلية.

> أي توسعة مستقبلية (استراتيجيات غير قائمة على نسخ المحافظ، أصول أخرى، صناعة سوق…) تُعدّ **خارج نطاق هذا التطبيق** ما لم يُعِد المستخدم تعريف النطاق صراحةً.

**توضيح نطاق صيد العملات الجديدة (New-Coin Hunting Scope Clarification):** المنتج مُحسَّن صراحةً لصيد العملات الجديدة على Solana (Pump.fun / PumpSwap / DEX discovery surfaces): اكتشاف الـ mint، ترتيب الفرص، الرادار، Decision Trace، وتشخيص الكمون مكوّنات **منتج أساسية لا رفاهية**. **لكن ظهور mint جديد وحده ليس إشارة شراء ولا يفتح تنفيذاً تلقائياً.** التنفيذ يبقى ضمن نظام النسخ القائم؛ الافتراضي `follow_entry_user_exit`، بينما `full_mirror` خيار متقدّم per-wallet وتبقى كل بوابات الأمان فعّالة. والدخول مشروط بإشارة محفظة/cluster أو فرصة signal-confirmed + token readiness + فحص Token-2022/الأمان (§14) + route/liquidity + Exit Feasibility + EV واعٍ بالكمون + sizing/risk. **DEX discovery surfaces / DexScreener / DEX Screener-like feeds هي enrichment/display/ranking فقط، وليست execution truth أو مصدر موافقة تنفيذ.** أي `discovery-only automatic entry` يبقى **خارج النطاق الحالي ولا يُسجَّل كـ mode/enum الآن**؛ إضافته مستقبلاً تتطلّب إعادة تعريف نطاق صريحة من المستخدم. (لا blind mint-sniping.)

---

## 2. المبادئ المعمارية (Architectural Principles)

1. **Fail Safe, Not Fail Open** — عند أي شك أو خلل، يتوقف النظام أو يقتصر على الخروج، لا أن يستمر بالشراء.
2. **Audit Everything** — كل قرار وكل أمر وكل fill (وهمي أو حقيقي) يُسجَّل في Audit Trail غير قابل للتعديل.
3. **Same Brain, Different Send** — PAPER-LIVE و REAL-LIVE يستخدمان نفس العقل والفلاتر والقرار؛ الفرق الوحيد أن PAPER يحاكي التنفيذ وREAL يرسله.
4. **Hot Path RAM-only** — مسار القرار الحار داخل الذاكرة فقط: لا Postgres sync، لا Redis sync، لا HTTP خارجي blocking، لا RPC simulate إجباري في مسار Brain A، لا اعتماد على UI. الكتابة async إلى queue.
5. **Pipeline Isolation** — كل وحدة لها مدخلات ومخرجات واضحة؛ فشل وحدة لا يُفسد أخرى.
6. **Edge Is Earned, Not Assumed** — تتبّع المحافظ مصدر إشارة، لا edge مُثبت. يصبح edge فقط بعد إثبات copyability + net profitability + repeatability + survival-after-costs.
7. **Strategy as Plugin** — الفلاتر وقواعد الدخول/الخروج قابلة للتفعيل والتعطيل والتعديل؛ أمّا طبقة التحكم والإيقاف والتسجيل فموجودة دائماً.

---

## 2.1 قرارات معمارية مُمَهِّدة (v1.8 Delta — Complete Architecture Now, Phased Build Later)

> هذه القرارات تعرّف الشكل النهائي للنظام الآن، بينما يحدّد `06-BUILD-SPEC.md` سلّم التنفيذ المرحلي. الحقول الجديدة الناشئة عنها مسجّلة في `01-SSOT.md`؛ ما لم يُسمَّ نهائياً يبقى بادئة `candidate_*`.

1. **Cost-basis Policy** — محاسبة lot-based مرتبطة بـ intents/fills، الافتراضي **FIFO** للربح المحقّق (realized). كل التكاليف (priority fee · Jito tip · ATA rent · DEX fees · failed-attempt cost · slippage) منسوبة للـ trade/intent المعني.
2. **Mark Price Policy** — لا mark مجهول المصدر. **unrealized = mark + source + timestamp + confidence + status**؛ في أسواق AMM نفضّل executable/route quote أو liquidity-aware estimate على display price، ولا يُعرض mark بحالة غير `valid` كرقم موثوق.
3. **P&L as Backend Read-Model** — كل قيم P&L (realized/unrealized/fees/slippage/paper) مشتقّة read-only يحسبها الخلفي (CostPipeline + Position layer). **يُمنع حساب P&L في الواجهة كمصدر حقيقة.**
4. **Recommendation Layer is Advisory** — التوصيات اقتراحات فقط: validation-required، لا تطبيق تلقائي، ولا تعدّل strategy/risk/live config إلا عبر مسار config الرسمي (preview → validation → permission → audit → config-version).

---

## 3. نمطا التشغيل (Operating Modes)

### PAPER-LIVE
بيانات/أسعار/محافظ/إشارات/quotes حقيقية، وأوامر مبنية كأنها حقيقية، **لكن التنفيذ يُحاكى** عبر `execution_simulator` (لا quote كسعر تنفيذ)، ولا توقيع ولا إرسال أموال.

### REAL-LIVE
نفس العقل والقرار والأمر، مع توقيع وإرسال حقيقي وتسجيل fill حقيقي.

### الواجهة الموحّدة: ExecutionAdapter
```
ExecutionAdapter:
  simulate_order()    # نموذج تعبئة واقعي (يُستعمل في PAPER، ومرجع للمقارنة في REAL)
  build_order()       # بناء الأمر — مشترك بين الوضعين
  send_order()        # PAPER: no-op منطقي / REAL: توقيع وإرسال
  observe_fill()      # تسجيل النتيجة (وهمية أو حقيقية)
  calibrate_model()   # تغذية نتائج REAL لتصحيح نموذج PAPER
```

**التداول الورقي والانتقال إلى REAL-LIVE (قرار المستخدم):** PAPER-LIVE متاح كأداة قياس ومعايرة (يقارن الـ fills الوهمية بالحقيقية، يغذّي `calibrate_model`)، **لكنه غير إلزامي ولا يحجب REAL-LIVE**. لا توجد بوابة قبول تمنع التشغيل الحي؛ **الحكم النهائي في الانتقال إلى REAL-LIVE للمستخدم وحده** ومتى شاء. تبقى مؤشّرات الجودة (`net_expectancy`, `profit_factor`, `sample_size`, `paper_real_divergence`) متاحة للعرض والاسترشاد إن رغب المستخدم في تشغيل PAPER أولاً، دون أي إلزام. (ملاحظة هندسية محايدة: التشغيل الحي المباشر يحمل مخاطر مالية حقيقية، وهذا قرار المستخدم الكامل؛ هذه الأداة خاصة به ولماله، ولست مستشاراً مالياً.)

---

## 4. العقلان الاستراتيجيان (Dual Decision Brains)

محرك واحد، عقلان قرار، طبقات مشتركة (Risk / Execution / Audit / Wallet Intelligence).

| | **Brain A — Pump.fun Bonding Curve** | **Brain B — PumpSwap / Open Market** |
|---|---|---|
| الطبيعة | سرعة أعلى، سيولة أضعف | سيولة أعمق، إشارات أهدأ بعد الهجرة |
| الحجم | **يحدّده المستخدم** (مبلغ ثابت بالدولار، أو بعملة SOL، أو نسبة % من رأس المال) | **يحدّده المستخدم** (مبلغ ثابت بالدولار، أو بعملة SOL، أو نسبة % من رأس المال) |
| المخاطر | creator / bundled wallets / graduation trap | route quality / holder behavior / post-migration strength |
| حساب الخروج | **curve math محلي في RAM** (لا RPC في hot path) | reverse quote + route check + simulate عند الحاجة |
| حساس لـ | curve state و freshness | عمق السيولة وجودة الـ route |

**سبب الفصل:** فيزياء الـ bonding curve تختلف كلياً عن فيزياء الـ AMM؛ دمجهما في نموذج واحد يلوّث الإشارات. **PumpSwap هو الـ AMM الأصلي لـ Pump.fun** (استبدل ترحيل Raydium منذ 20 مارس 2025؛ الترحيل الآن فوري بلا رسم ~6 SOL القديم، مع رسم تخرّج اسمي ~0.015 SOL)، والسوق يهاجر إليه بنسبة 95%+. العتبة ~$69k mcap ≈ **~85 SOL** (القيمة الحتمية on-chain هي ~85 SOL والـ $69K تطفو مع سعر SOL). وهذه العتبة لزوج SOL؛ **تختلف عتبة/تكلفة التخرّج لزوج USDC** وتُقرأ live حسب `quote_mint`.

**تحديد حجم السيولة (Position Sizing — بيد المستخدم):** في كلا العقلين، **المستخدم هو من يحدّد حجم كل صفقة** بإحدى ثلاث طرق قابلة للاختيار لكل عقل/كل محفظة منسوخة:
- `sizing_mode = fixed_usd` → مبلغ ثابت بالدولار (يُحوّل إلى SOL لحظة التنفيذ بسعر آنيّ).
- `sizing_mode = fixed_sol` → مبلغ ثابت بعملة SOL مباشرةً.
- `sizing_mode = pct_of_capital` → نسبة مئوية من رأس المال المتاح (`size = capital × pct`).

الحقول: `sizing_mode` · `sizing_value` (الرقم: دولار/SOL/نسبة) · `capital_reference` (المصدر عند pct). يبقى الحجم المُختار **محكوماً بحدود المخاطر** (`max_position_size_pct`, `max_token_exposure_pct`, liquidity-vs-size) وبفحص جدوى الخروج قبل الدخول — أي أن النظام قد يخفّض الحجم المطلوب إن تجاوز قيد سيولة أو خطر، لكنه لا يرفعه فوق ما حدّده المستخدم. (الحدود حماية كمّية لا تجاوزاً لاختيار المستخدم.)

> **تحديث بروتوكول حرج (1.6):** منذ 12 نوفمبر 2025 تُطلق عملات Pump.fun الجديدة عبر تعليمة `create_v2` تحت **برنامج Token-2022** (لا Metaplex القديم؛ `create` القديمة ما زالت تعمل لكنها ستُهمَل لاحقاً). إذًا **Brain A يفترض mints من نوع Token-2022 افتراضياً** ويفحص امتداداتها قبل أي تداول (انظر §14). كما أن الرسوم أصبحت **ديناميكية (Dynamic Fees V1 / Project Ascend، سبتمبر 2025):** على bonding curve الحالية ≈ Creator 0.30% + Protocol 0.95% + LP 0% = إجمالي 1.25%؛ وعلى PumpSwap بعد التخرّج رسوم منشئ متدرّجة من 0.95% تنخفض تدريجياً إلى 0.05% عند بلوغ mcap مرتفع. **تُقرأ جداول الرسوم live ولا تُثبَّت في الكود.**

---

## 4.1 بروتوكول تسليم العقل عند الهجرة (Migration Handoff Protocol)

كل مركز يحمل ثلاثة حقول حالة تُحدِّد من يديره: `entry_brain` (العقل الذي دخل به، يبقى للتاريخ) · `current_control_brain` (العقل المسيطر الآن) · `market_phase`.

**مراحل الهجرة (Migration Phases):** `PRE_MIGRATION` → `MIGRATION_APPROACHING` → `MIGRATION_IN_PROGRESS` → `LP_MINTED` → `POST_MIGRATION_ACTIVE`.

**مصدر الحقيقة on-chain (لا DexScreener ولا أي واجهة):**
- **أساسي:** `bonding_curve.complete == true` · رصد تعليمة `migrate` · إنشاء الـ canonical PumpSwap pool (`pAMMBay…fXEA`) مقابل WSOL · توفّر route عبر PumpSwap/Jupiter.
- **مساعد فقط (لا يؤكّد الهجرة وحده):** `real_token_reserves == 0` ومقاييس استنزاف المنحنى. **لا يُعتمد `real_token_reserves == 0` منفرداً لتأكيد الهجرة.**

**اقتران quote mint (Quote-Mint Pairing — تحديث بروتوكول 21 مايو 2026):** يستطيع منشئو Pump.fun اقتران التوكن بـ **USDC** بدل SOL، فلم يعد افتراض WSOL وحده آمناً لاكتشاف الـ canonical pool ولا لحساب السعر/التخرّج. **يُكتشَف `quote_mint` لكل توكن on-chain** ويتفرّع عليه:
- **canonical pool:** يُشتقّ عنوان PumpSwap pool حسب `quote_mint` (`wsol` → الزوج مقابل WSOL · `usdc` → الزوج مقابل USDC) — لا عنوان pool مفترَض بزوج واحد.
- **عتبات التخرّج/الهجرة:** تُقرأ live حسب `quote_mint` (عتبات USDC تختلف عن SOL)؛ **لا تُثبَّت عتبة SOL واحدة في الكود** (يتّسق مع قراءة جداول الرسوم/العتبات live، §1.6).
- **حساب السعر/EV:** يُطبَّع كل سعر داخلياً إلى **USD** قبل EV/slippage/cost (الـ P&L أصلاً بالـ USDC)؛ **يُمنع خلط حساب مقوّم بـ SOL مع آخر مقوّم بـ USDC** (يفسد P&L/slippage/EV).
- **fail-safe:** `quote_mint = unknown` ⇒ **skip لا صفقة مشوّهة** (`rejected_reason = unknown_quote_mint`)، اتساقاً مع Fail-Safe-Not-Fail-Open.
- مسار USDC **خلف feature flag** `usdc_quote_enabled` (CONFIG §3 `global_config`، الافتراضي skip) حتى يكتمل اختباره.

**قاعدة التسليم:**
- إذا دخل المركز عبر Brain A ثم تحقّق `LP_MINTED` / `POST_MIGRATION_ACTIVE`: يبقى `entry_brain = Brain A` للسجل، ويصبح `current_control_brain = Brain B`. عندها يتولّى Brain B: route health · reverse quote · pool liquidity · exit execution.
- أثناء `MIGRATION_IN_PROGRESS` (migration limbo): **لا دخول جديد، لا scale-in، لا محاولات بيع عمياء متكرّرة.** الخروج مسموح **فقط** إذا وُجد route صالح ومرّ exit feasibility والانزلاق ضمن السقف (متّسق مع EXITS_ONLY الذي يمنع الدخول لا الخروج).

**قاعدة العقل المسيطر (Current Control Brain Rule):** كل صفوف Copy Event Decision Matrix أدناه تُنفَّذ **بواسطة `current_control_brain` الحالي**: إن كان Brain A → curve math / local state؛ إن كان Brain B → route / reverse quote / AMM pool state. لا يُقرأ أي حدث نسخ خارج العقل المسيطر لحظتَه.

---

## 4.2 سياسة سلوك المحفظة المتبوعة ومصفوفة قرارات النسخ (Followed Wallet Behavior — Copy Event Decision Matrix)

تحكم هذه المصفوفة سلوك المركز **بعد الدخول** عند تغيّر أفعال المحفظة المنسوخة. كل قرار يُنفَّذ عبر `current_control_brain`، وتحت طبقات الأمان المشتركة التي لا تُعطَّل.

**الـ Protected Route (تصحيح مفاهيمي ثابت):** الـ Jito/protected route **يقلّل خطر MEV/sandwich ولا يضمن الـ landing**. البيع عالي الانزلاق لا يُرسَل عبر fallback عادي؛ إذا تجاوز الانزلاقُ الحدَّ → إمّا protected route، أو split exit، أو cancel/wait حتى يتحسّن الـ route. أي protected route يبقى خاضعاً لـ BundleStatusObserver و TTL و exit feasibility و EV/loss cap.

**فحوص الأمان المشتركة لكل صفوف المصفوفة:** exit feasibility · route health · slippage cap · migration state · `max_entry_slippage_vs_leader` (للدخول/الإضافة) · BundleStatusObserver عند مسار Jito.

| # | الحدث (Event) | الكشف (Detection) | `follow_entry_user_exit` | `full_mirror` |
|---|---|---|---|---|
| 1 | Followed wallet **buy** | buy/swap داخل التوكن | دخول إذا مرّ EV + cost + exit feasibility | دخول إذا مرّ EV + cost + exit feasibility |
| 2 | **Scale-in** (شراء إضافي لنفس التوكن) | buy إضافي | افتراضاً لا نسخ للزيادة؛ تُعامل كإشارة ثقة/خطر فقط. زيادة محدودة فقط إن فعّل المستخدم `copy_adds_for_follow_entry` (بشرط EV + exposure) | mirror scale-in **نسبي** بشرط `copy_adds_enabled` + عدم تجاوز `max_position_size_pct`/`max_token_exposure_pct` + EV صالح + route صالح + ليس migration limbo + عدم تجاوز `max_entry_slippage_vs_leader` |
| 3 | **Partial sell** (<100%) | sell أقل من كامل حيازة المحفظة | risk modifier فقط + تشديد trailing حسب العتبات (≤10% خطر منخفض · >10–30% متوسط · >30–50% مرتفع · >50% إشارة خروج كبرى) | mirror sell **نسبي** إن تجاوز `min_mirror_sell_pct`؛ والبيوع تحت العتبة تُراكَم في `cumulative_ignored_sell` ثم تُنفَّذ عند تجاوز المجموع للعتبة (ثم reset = 0) |
| 4 | **Full exit** (100% أو رصيد < dust) | sell كامل/تحت عتبة الغبار | لا بيع مباشر. `followed_wallet_exited = true` · `disable_new_adds` · تشديد trailing. الخروج فقط عند قاعدة داخلية (TP/trailing/liquidity drain/route failure/creator-cluster risk/EV deterioration) | `sell_100%` افتراضاً بشرط exit feasibility و route صالح. (لا `break_full_mirror_on_strong_market`: من أراد البقاء يبدّل `copy_mode` يدوياً إلى follow_entry_user_exit) |
| 5 | **Transfer out** (SPL transfer لا swap/sell) | تحويل خارج، ليس بيعاً | **transfer ≠ sell: لا بيع تلقائي**؛ وأي وجهة غير `known cluster` تُفعّل `disable_new_adds` + ترفع الخطر حسب التصنيف (انظر Transfer Add Policy أدناه) | المثل: لا نسخ للتحويل، لا بيع تلقائي، و`disable_new_adds` لأي وجهة غير known cluster |
| 6 | Transfer إلى **cluster معروف** | تصنيف الوجهة = known cluster | متابعة على مستوى الكلاستر (`leader = cluster_position`)؛ **لا `disable_new_adds` تلقائياً** (الإضافة لاحقاً مسموحة إن صحّ EV/route/exposure ولا إشارة توزيع أخرى) | المثل |
| 7 | Transfer إلى **wallet مجهول مفرد** | وجهة واحدة غير مصنّفة | `disable_new_adds = true` · `increase_distribution_risk = true` · تشديد الخروج · لا بيع تلقائي | المثل |
| 8 | **Split** إلى عدة محافظ مجهولة | عدة وجهات جديدة | `disable_new_adds = true` · `increase_distribution_risk = high` · `tighten_trailing` · مراقبة ضغط البيع | المثل |
| 9 | Transfer إلى **CEX/deposit-like** | تصنيف الوجهة | `disable_new_adds = true` · `HIGH_EXIT_RISK` · تشديد الخروج · de-risk جزئي اختياري حسب إعداد المستخدم | المثل |
| 10 | Transfer إلى **creator/dev cluster** | تصنيف الوجهة | `disable_new_adds = true` · `creator_cluster_risk_exit` قابل للتفعيل · تصعيد risk level فوراً (critical) | المثل |
| 11 | **Sells then rebuys** | بيع ثم إعادة شراء | لا re-entry تلقائي إلا بـ EV جديد صالح + انقضاء cooldown | re-entry فقط إذا سمح `rebuy_policy` + انقضى cooldown + ليس whipsaw + EV صالح. **الـ rebuy حدث دخول جديد:** الحجم من `sizing_mode` الحالي لا استرجاعاً للحجم القديم |
| 12 | **Whipsaw** (دخول وخروج سريع جداً) | فاصل زمني < `whipsaw_window` | تصنيف `WHIPSAW_OR_MEV_LIKE` · خفض copyability · `wallet_behavior_risk = high` · منع re-entry فوري إلا بـ `allow_whipsaw_reentry_override` | المثل |
| 13 | **تضارب عدة محافظ** | محافظ تختلف على نفس التوكن | Conflict Resolution (أدناه)؛ افتراضاً `no_adds` + تشديد الخروج | المثل |
| 14 | **خمول المحفظة مع ضعف التوكن** | توقّف نشاط + تدهور | لا انتظار للمحفظة؛ قواعد الخروج الداخلية (time exit/liquidity drain/route failure/EV deterioration) | المثل |
| 15 | **خروج المحفظة أثناء migration limbo** | sell أثناء `MIGRATION_IN_PROGRESS` | لا بيع أعمى متكرّر؛ انتظار route صالح؛ إن غاب → EXITS_ONLY / migration-aware monitoring | نيّة mirror-sell تبقى **pending** حتى يظهر route صالح، ولا تُلغى إلا بإعداد المستخدم أو محرّك الخطر |
| 16 | **بيع المحفظة بينما الـ route غير صحي** | route unhealthy | لا فرض route سيّئ؛ protected/split exit إن سُمح؛ وإلا انتظار صلاحية الـ route أو سياسة الطوارئ | المثل |
| 17 | **Entry slippage vs leader مرتفع** | تجاوز `max_entry_slippage_vs_leader` | reject entry أو تقليل الحجم أو watch-only | المثل |

**Canonical `copy_event` identifiers (للسيناريوهات الـ17 أعلاه):** `leader_buy` · `leader_scale_in` · `leader_partial_sell` · `leader_full_exit` · `leader_transfer_out` · `transfer_known_cluster` · `transfer_unknown_single` · `transfer_split_unknown` · `transfer_cex_like` · `transfer_creator_dev` · `leader_rebuy` · `whipsaw_detected` · `multi_wallet_conflict` · `leader_inactive_token_weak` · `leader_exit_migration_limbo` · `leader_sell_route_unhealthy` · `entry_slippage_exceeds_leader`. هذه المعرّفات تُسمّي سيناريوهات المصفوفة الموجودة فقط ولا تُدخل سلوكاً جديداً. ومخرجات التصنيف مثل `HIGH_EXIT_RISK` و`WHIPSAW_OR_MEV_LIKE` تبقى **classification flags ناتجة عن الحدث، لا قيم `copy_event`**.

**حسم تضارب عدة محافظ (Multi-Wallet Conflict Resolution):** عند اختلاف المحافظ على نفس التوكن، لا add جديد افتراضاً، ويُحسب: `net_followed_wallet_flow` · `weighted_wallet_score` · `sell_pressure_ratio` · `buy_pressure_ratio` · `cluster_relation` · `wallet_quality_rank` · `recent_exit_quality`. القواعد: محافظ أعلى جودة تبيع ومنخفضة الجودة تشتري → `confidence_down` + `no_adds` + تشديد الخروج · محافظ أعلى جودة تزيد ومنخفضة تبيع → `confidence_neutral`/ارتفاع طفيف حسب الـ score، ولا زيادة إلا بـ EV قوي · تدفّق متعارض بلا ترجيح واضح → `no_adds` + مراقبة خروج أشد · تجاوز `sell_pressure_ratio` للعتبة → `exit_reduce_or_tighten` حسب `copy_mode`. **القاعدة العامة (Fail Safe): في التضارب تغلب إشارة الخطر ما لم تكن إشارة الشراء أقوى بوضوح بالـ score والـ EV.**

**سياسة الإضافة عند التحويل (Followed Wallet Transfer Add Policy — قاعدة موحّدة):** `transfer ≠ sell`، فلا خروج تلقائي على مجرّد تحويل. لكن **أي transfer out إلى وجهة غير مصنّفة كـ `known cluster` يُفعّل `disable_new_adds` فوراً على هذا المركز**، لأن التحويل الخارج إشارة خطر على *مصدر الإشارة* (بداية توزيع محتملة). لا نميّز بين مفرد ومتعدّد في *أصل* القرار (منع الإضافة)، بل في *درجة* الخطر فقط: `known cluster` = لا منع، تتبّع على مستوى الكلاستر · `unknown single` = medium/high risk · `unknown split` = high distribution risk · `CEX-like` = high exit risk · `creator/dev cluster` = critical risk. **تمييز جوهري يجب تثبيته:** `disable_new_adds` لا يعني `sell` — هو يمنع *زيادة المركز* فقط؛ والخروج يبقى محكوماً بـ exit feasibility / route health / liquidity / trailing-time exit / creator-cluster risk / `copy_mode` / إعداد المستخدم.

**عتبات البيع الجزئي (قابلة للتعديل لكل محفظة):** بدل أرقام مثبّتة، تُضبط كحقول: `partial_sell_low_threshold` · `partial_sell_medium_threshold` · `partial_sell_high_threshold` · `partial_sell_major_threshold`، وتترجَم إلى شدّة تعديل الخطر (≤ low = منخفض · low–medium = متوسط · medium–high = مرتفع · > high = إشارة خروج كبرى). و`partial_sell_policy` تأخذ إحدى القيم: `risk_modifier_only` · `proportional_mirror` · `ignore_below_threshold` · `tighten_trailing_only` · `manual_review`. الافتراضي: `follow_entry_user_exit` → `risk_modifier_only`؛ `full_mirror` → `proportional_mirror`.

**whale-sell ⇒ تضييق لا panic (توضيح سلوك `tighten_trailing_only`/`whale_sell_risk_modifier`):** بيع القائد/الحوت **مُعدِّل خطر لا أمر بيع**؛ يُضيِّق نطاق الـ trailing بدل الخروج الفوري. **الـ band يكون volatility-scaled** (∝ التذبذب المحقّق) **لا fixed %**. **استثناء حاسم:** تهديد على مستوى العقد (hook upgrade · authority/freeze change · graduation-block dump مؤكّد) **يتجاوز الـ trailing** ويذهب مباشرة إلى مسار الخروج الطارئ (يتّسق مع honeypot-by-upgrade §14/Pipeline 90%–100%). درجة التضييق دالة في نسبة البيع من سيولة الـ pool وسلوك المحفظة البائعة التاريخي.

**معادلة الانزلاق مقابل القائد (Entry Slippage vs Leader):** `entry_slippage_vs_leader = (our_expected_entry_price − leader_entry_price) / leader_entry_price`، حيث `leader_entry_price` سعر دخول المحفظة المنسوخة و`our_expected_entry_price` من الـ quote (Brain B) أو curve math (Brain A). إذا تجاوز `max_entry_slippage_vs_leader` → reject / reduce size / watch-only حسب إعداد المستخدم. (هذا تجسيد لكون copy-trading تفاعلياً: ندخل دائماً بعد القائد، فيُقاس فرق الدخول صراحةً لا يُفترض.)

**القاعدة الختامية (Followed Wallet Event ≠ Execution Order):** كل حدث من المحفظة المنسوخة هو **input إلى Position Manager، لا أمر تنفيذ**. لا يُنفَّذ إلا إذا اجتمع: `copy_mode` يسمح · `current_control_brain` يوافق · entry/exit feasibility تمرّ · route health يمرّ · slippage ضمن الحدود · risk settings تسمح.

**الحقول لكل محفظة منسوخة (per-wallet):** `copy_mode` · `partial_sell_policy` · `min_mirror_sell_pct` · `cumulative_ignored_sell` · `partial_sell_low_threshold` · `partial_sell_medium_threshold` · `partial_sell_high_threshold` · `partial_sell_major_threshold` · `copy_adds_enabled` · `copy_adds_for_follow_entry` · `scale_in_policy` · `transfer_exit_policy` · `conflict_resolution` · `max_entry_slippage_vs_leader` · `rebuy_cooldown` · `whipsaw_window` · `whipsaw_penalty` · `allow_whipsaw_reentry_override`. ولكل مركز مفتوح: `entry_brain` · `current_control_brain` · `market_phase` · `active_exit_route`. **ولا يُضاف إطلاقاً** `allow_hold_if_market_strong` ولا `break_full_mirror_on_strong_market` لأنهما يكسران معنى `full_mirror`.

---

## 4.3 بروتوكول محافظ التنفيذ والتوقيع (Execution Wallet & Signing Protocol)

> **التمييز الأساسي (أبجدية):** المحفظة المتبوعة (tracked/source wallet) شيء، ومحفظة التنفيذ (execution wallet) شيء آخر تماماً. الأولى **نراقبها وننسخها** (§4.2، `wallet_registry`)؛ الثانية **تملك أموالنا وتوقّع صفقاتنا**. لا يُخلط بينهما أبداً.

### أنواع المحافظ (ثلاثة)
- **Tracked / Source wallet:** محفظة الحوت/الذكية التي نراقبها (موجودة، §4.2). لا تملك أموالنا ولا توقّع.
- **Execution wallet:** محفظتنا التي تشتري/تبيع وتوقّع. لها رصيد وحدود وحالة.
- **Vault / Settlement wallet:** محفظة منفصلة لاستقبال الأرباح وتمويل محافظ التنفيذ. **خارج الـ hot path** (لا تُستخدم في التنفيذ المباشر).

### نمطا التوقيع (key_custody_mode — كلاهما مدعوم)
- **`connected_wallet` (manual_approval):** محفظة لامركزية متّصلة (Phantom/Solflare). كل صفقة تحتاج موافقة توقيع المستخدم. مناسب للاختبار والمراجعة، لا للتنفيذ الآلي السريع.
- **`isolated_signer` (auto):** محفظة تنفيذ ساخنة عبر **SignerService معزول**. مناسب للتنفيذ الآلي والنسخ الفوري وتعدّد المحافظ.

### القاعدة الأمنية الأساسية (تُبنى أولاً قبل أي ميزة)
- **لا private key في الواجهة. لا seed phrase في قاعدة البيانات. لا توقيع من الواجهة.** التوقيع حصراً داخل SignerService معزول.
- **لا REAL-LIVE قبل اكتمال Key Management** (متّسق مع §15.1 وREAL-LIVE Readiness). الانتقال للتنفيذ الحيّ يتحقّق من جاهزية إدارة المفاتيح.
- تفاصيل العزل/التخزين/التدوير الأمني تُفصَّل في `09-THREAT-SECURITY`؛ هنا القرار المعماري فقط.

### تعدّد محافظ التنفيذ (Execution Wallet Pool)
المنصّة تدير **مجموعة محافظ تنفيذ** (العدد غير ثابت — يحدّده المستخدم). المحرّك يختار محفظة التنفيذ لكل صفقة وفق **`wallet_assignment_policy`** (قيم مرشّحة: `round_robin` · `least_active` · `per_strategy` · `per_source_wallet` · `manual_assignment` · `risk_weighted`).
- لكل محفظة تنفيذ **حالة** (`execution_wallet_status` مرشّح: `WARMING_UP` · `ACTIVE` · `DISABLED` · `DRAINING` · `RETIRED` · `REVOKED`) وحدودها الخاصة (per-wallet limits). المحفظة الجديدة تبدأ `WARMING_UP` ولا تصبح `ACTIVE` حتى تجتاز فحوص: funded · signer reachable · limits configured · key custody verified · not revoked. ومحفظة مفتاحها مسحوب/معطّل → `REVOKED` (لا مجرّد `DISABLED`).
- **إنشاء المحافظ:** `execution_wallet_creation_mode` (مرشّح: `manual` · `automatic_policy`). أي محفظة مُنشأة تلقائياً تبدأ `WARMING_UP` ولا تدخل `ACTIVE` قبل اجتياز signer/key/risk/funding checks.
- **معرّف vs عنوان:** التمييز صارم — `execution_wallet_id` (معرّف داخلي) ≠ `execution_wallet_address` (عنوان on-chain). لا خلط.
- **SignerService:** لكل محفظة `signer_profile_id` بحالة `signer_profile_status` (مرشّح: `ACTIVE` · `DISABLED` · `REVOKED` · `DEGRADED`) — حالة الـ signer مستقلّة عن `key_custody_mode` (الأخير يقول كيف يُوقَّع، الأولى تقول هل الـ signer جاهز).
- **القاعدة الحاكمة (لا تُخرَق):** تعدّد المحافظ **ليس وسيلة لتجاوز حدود المخاطر**. حدود Hard Risk (Group 6) **على مستوى الحساب الكلّي تبقى فوق الجميع**؛ حدود كل محفظة تُضاف تحتها لا فوقها. التعرّض الكلّي يُجمَع عبر كل المحافظ.
- **`wallet_registry` ≠ `execution_wallets`:** الأولى محافظ متبوعة (source)، الثانية محافظنا التي تملك وتوقّع. لا resource/table مشترك بلا فصل صريح.

### ملكية الأصل (Position Ownership — أبجدية Solana)
- على Solana: **مَن يملك التوكن هو من يستطيع بيعه.** إن اشترت محفظة تنفيذ، فالتوكن فيها، وهي التي تبيع.
- **الافتراضي:** نفس محفظة التنفيذ التي فتحت المركز هي التي تغلقه. كل مركز يحمل `position_owner_wallet_id` (المالك الحالي) + `entry_execution_wallet_id` (التي دخلت) + `current_execution_wallet_id`.
- **«محفظة شراء / محفظة بيع» وضع خاص لا افتراضي:** يتطلّب نقل أصل صريحاً عبر `asset_transfer_intent_id` بحالة `asset_transfer_status` (مرشّح: `PENDING` · `SUBMITTED` · `CONFIRMED` · `FAILED` · `CANCELLED`). **لا يتغيّر `position_owner_wallet_id` إلا بعد `asset_transfer_status = CONFIRMED`.** ومحاولة بيع من محفظة غير مالكة تُرفَض (`COMMAND_NOT_ALLOWED_IN_STATE`). يمنع بيعاً مزدوجاً أو فقدان tracking.

### تدوير المحافظ (Wallet Rotation)
إنشاء محفظة تنفيذ جديدة ونقل الأصول إليها، لأسباب تشغيلية مشروعة: عزل المخاطر · تنظيم رأس المال · فصل الاستراتيجيات · الاستجابة لاشتباه اختراق · تقاعد محفظة.
- **`rotation_trigger` (مرشّح):** `manual` · `time_based` · `trade_count_based` · `risk_limit_based` · `compromise_suspected` · `wallet_retirement`.
- **`wallet_rotation_status` (مرشّح):** `NOT_REQUIRED` · `PENDING` · `IN_PROGRESS` · `COMPLETED` · `FAILED`.
- **تدفّق التدوير:** إنشاء/توليد محفظة (`WARMING_UP`) → تمويلها → وسم القديمة `DRAINING` → إيقاف الدخول الجديد عليها → إغلاق/كنس الأصول المتبقّية → تقاعدها `RETIRED` → **كل خطوة تدخل Audit**.
- التدوير لا يكسر ملكية المركز: المراكز المفتوحة على القديمة تُغلق أو تُنقَل صراحةً بتحديث `position_owner_wallet_id` (بعد `asset_transfer_status = CONFIRMED`).

### معالجة أرباح الـ Vault (Profit Settlement)
الأرباح تُوجَّه إلى محفظة التسوية (`settlement_wallet_id`/`settlement_wallet_address`) وفق **`profit_sweep_policy` (مرشّح):**
- `auto_immediate` — كنس الأرباح فور تحقّقها.
- `manual` — لا كنس إلا بأمر المستخدم.
- `periodic` — كنس دوري بفاصل `profit_sweep_interval_ms` (بوحدة صريحة).
- الـ vault خارج الـ hot path؛ الكنس عملية مُدارة مُدقّقة، لا تتداخل مع التنفيذ.
- **Funding wallet:** محفظة تمويل محافظ التنفيذ (`funding_wallet_id`/`funding_wallet_address`). **قد تكون هي نفسها `settlement_wallet` في الإعداد البسيط، أو منفصلة** إذا اختار المستخدم فصل التمويل عن استقبال الأرباح. الفصل **اختيار معماري لا افتراض إلزامي**. في كلتا الحالتين كلاهما **خارج الـ hot path ولا يفتح/يغلق صفقات**.
- **قاعدة حماية:** `settlement_wallet`/`funding_wallet`/vault **لا تُستخدم للدخول أو الخروج من الصفقات**. أي أمر تداول منها يُرفَض إلا إذا غُيّر دورها صراحةً وأُعيدت مراجعتها عبر Security.

> **حدّ المرحلة:** هذا القسم **قرار معماري**. الأسماء المرشّحة أعلاه **لا تُعتمد كأسماء رسمية قبل تسجيلها في SSOT (Group 15 مقترحة)**. وتصميم Data Model/API/UX/Security لهذه الطبقة يلي تسجيل SSOT.

### معادلة الـ EV تُبنى بثلاث طبقات (لا طبقة واحدة)
1. **تكاليف حتمية تُقاس live لهذه الصفقة:** entry slippage + price impact (من الـ quote / curve math)، priority fee (Helius Priority Fee API)، Jito tip (tip-floor oracle لآخر الكتل، لا الحد الأدنى الثابت)، base fee، compute unit cost، ATA rent.
2. **تقدير خروج من الحالة الحالية (بوابة Exit Feasibility):** reverse quote (Brain B) أو curve math محلي (Brain A). تقدير محافظ؛ الرقم الحقيقي يُسجَّل بعد الخروج فعلاً.
3. **احتمالات مُعايَرة من cohort (priors مبوّبة):** `win_rate`, `avg_net_winner`, `avg_net_loser`, `P(fill)`, `P(exit_success)`, `failed_attempt_rate`, `route_failure_rate`. ليست خصائص صفقة واحدة؛ تأتي من event-replay backtest + معايرة PAPER، مبوّبة حسب نوع الإشارة/المحفظة/مخاطر التوكن.

البوابة (مرحلة 65%) تدمج الثلاثة → **توزيع نتائج** → تأخذ `Lower Confidence Bound`. الدخول فقط إذا `LCB > safety_margin`.

### معادلة التوقع الصافي
```
Net Expectancy =
    (win_rate        × avg_net_winner)
  − (loss_rate       × avg_net_loser)
  − fees − priority_fees − jito_tips
  − failed_attempt_cost
  − entry_slippage − exit_slippage
  − route_failure_cost − ata_rent_leakage
```

### بوابات القبول الملزِمة (Binding) مقابل المؤشرات التشخيصية (Diagnostic)
- **بوابات الربحية (EV acceptance thresholds — خاضعة لـ `ev_gate_mode`):** `minimum_net_expectancy` (Net Expectancy > 0 بعد كل التكاليف)، `minimum_profit_factor`، `minimum_lower_confidence_bound`، `minimum_exit_success_rate`، `minimum_sample_size` مُحقَّق، `max_expected_drawdown_pct`. في `ev_gate_mode = strict` (الافتراضي) هذه **بوابات دخول فعلية تحجب**؛ في `warning_only` تتحوّل إلى `WARNING_CRITICAL` ولا تحجب إن اختار المستخدم ذلك صراحةً.
- **حدود الخسارة والأمان الصلبة (Hard Risk limits — مُلزِمة دائماً، لا يتجاوزها `warning_only` إطلاقاً):** Global Kill Switch · Exit Feasibility Gate · Duplicate Transaction Protection · Mode Separation · Signer/Key Safety · Emergency Stop · وحدود المخاطر المسمّاة: `max_daily_loss_pct` · `max_daily_loss_usdt` · `max_total_drawdown_pct` · `max_open_positions` · `max_position_size_pct` · `max_token_exposure_pct` · `max_creator_exposure_pct` · `max_cluster_exposure_pct` · `max_correlated_meme_exposure_pct`. **القاعدة المعتمدة:** `warning_only` يخفّض بوابات الربحية (EV thresholds) إلى تحذيرات فقط؛ ولا يعطّل أي حدّ من Hard Risk أو طبقة أمان تشغيلي.
- **قاعدة الفصل (Hard Risk vs EV — لا قاعدة آلية بالاسم):** التصنيف بالقائمة الصريحة لا باللاحقة. **Hard Risk** = القائمة المسمّاة أعلاه فقط (مُلزِمة دائماً). **EV acceptance** = القائمة المسمّاة في بند بوابات الربحية فقط (تخضع لـ `ev_gate_mode`). ملاحظة: `max_expected_drawdown_pct` هو **EV threshold لا Hard Risk** رغم بادئة `max_` — ولهذا لا تُعتمد قاعدة «كل `max_*` صلب». **وحدات التسمية:** `_pct` = نسبة مئوية · `_usdt` = قيمة مطلقة بـ USDT · `_bps` = basis points.
- **تشخيصية فقط (لا تُستهدَف ولا تكون بوابة مستقلة):** `win_rate`, `avg_net_winner`, `avg_net_loser`, `payoff_ratio`.

> **فخ Goodhart:** `win_rate` يُقاس ولا يُستهدَف. استهدافه يدفع النظام لجني الرابحين مبكراً وترك الخاسرين يركضون = win rate مرتفع وexpectancy منهار.

> **الذيول السمينة:** عوائد الميمكوين fat-tailed، فحجم العينة يجب أن يكون كبيراً (مئات الصفقات)، والقبول على الحد الأدنى للثقة في expectancy لا على التقدير النقطي.

---

## 4.4 طبقة صيد العملات الجديدة والفرص الـ Wallet-Led (New-Coin Hunting & Wallet-Led Opportunity Layer)

طبقة **ما قبل المركز** تُنظّم الاكتشاف والترتيب والفحص والقرار. **ربط لا تكرار:** تُغذّي مسارَي النسخ القائمين، ويتولّى ما بعد الدخول §4.2 و§15.1 (Position & Intent)، وتعبيرها التشغيلي مراحل §7 (Signal Detection 20% → Entry Decision 70%). لا تكرّر العقلين (§4)، الهجرة (§4.1)، Token-2022 (§14)، Blockhash/Retry/FailedTransactionClassifier (§15)، أو Exit Feasibility — بل تربطها.

**4.4.1 كيان `TokenOpportunity` (ما قبل المركز).** كائن قرار يجمع: `mint` · `source_events` · العقل الموجَّه إليه (`copyability_by_brain`) · أعلام الاكتشاف · الـ scores · نتائج البوابات · `hunt_status` · `accepted_reason`/`rejected_reason`. **لا يملك أموالاً ولا ينفّذ ولا يوقّع**، ومتمايز كلياً عن `Position`. **فرصة واحدة → صفر أو intent واحد، وقد ينتج عنه صفر أو مركز واحد بعد fill/reconciliation.** لا يكرّر حقول `Position`/`Intent`.

**4.4.2 دورة حياة `hunt_status` (ما قبل المركز فقط).** القيم: `discovered` → `ranked` → `gated` → (`accepted` → `entered`) | `rejected` | `watch_only` | `expired`. **عند `accepted` يجوز إنشاء intent إذا كانت كل بوابات ما قبل الإرسال صالحة** (لا حتمية إنشاء intent في كل حالة). وعند `entered` **يُسلَّم التحكّم إلى PositionLifecycleStateMachine بحالة `position_state = OPENING`** ويملك `position_state` كل ما بعدها. **يُمنع** استخدام قيم تصطدم بـ `operating_state`/`position_state` (لا `CLOSED` · `EXITS_ONLY` · `MONITORING` هنا).

**4.4.2a تصنيف الفرصة للعرض (`candidate_opportunity_lifecycle` — derived).** طبقة عرض مشتقّة فوق `hunt_status` توضّح للمستخدم درجة الجاهزية: `watch_only` · `diagnostic` · `executable_candidate` · `copy_signal_candidate`. **`copy_signal_candidate` ليست أمر شراء ولا تفتح `buy_opportunity`** — التنفيذ يبقى wallet/cluster-led عبر البوابات. (تصنيف لا يكرّر `hunt_status` بل يخدم UX؛ يُسجَّل كـ `candidate_*` في SSOT.)

**4.4.3 إشارات مرحلة الاكتشاف (diagnostic افتراضاً).** تُحسب على `TokenOpportunity`: `recycled_token_flag` · `name_impersonation_score` · `creator_launch_rate_flag` · `token_readiness_score`. **افتراضاً تشخيصية/عرض لا تحجب**؛ متّسقة مع بوابة التوكن §7 (50%) و§14 لا بديلة عنهما. **إذا تحوّلت أي إشارة إلى بوابة حاجبة لاحقاً، تُسجَّل في SSOT وConfig/Test قبل تفعيلها** (لا حجب تلقائي الآن).

**4.4.4 الترتيب وذكاء المحافظ.** `new_token_priority_score` = **ترتيب/عرض/أولوية طابور فقط**: لا يدخل EV كإشارة موافقة، لا يوافق على تنفيذ، لا يتجاوز Risk/Exit/Signer/Intent؛ يُربط بـ `RequestQueueThrottler` priority lanes (§15) للفرز، **على أن تكون أولوية الرادار/الاكتشاف أدنى من lanes الخروج وفحوص الأمان والـ trade-critical execution، مع السماح لها بترتيب طابور تقييم الفرص والرادار دون تجاوز بوابات التنفيذ**. حقول قابلية النسخ: `copyability_by_brain` (A/B/كلاهما) · `crowd_follow_score` (تآكل الميزة بالازدحام) · `profit_concentration` (تركّز أرباح المحفظة في رمز واحد — تجسيد «one-hit» §7). [`candidate_wallet_behavior_drift_flag` يحلّ محلّ `behavior_shift_flag` القديم — drift/behavior-change مشتقّ read-only ضمن Wallet Analytics (§15.7)، لا يفتح تنفيذاً وحده.]

**4.4.5 `tracked_wallet_status` (مشتقّ، read-only).** تقييم النظام للمحفظة المتبوعة، مشتقّ من Wallet Intelligence: `candidate` · `watch_only` · `copy_allowed` · `degraded` · `banned`. **لا يُكتب يدوياً عبر API، ولا يفتح تنفيذاً وحده.** و**`banned` هنا حالة تقييم/سياسة متابعة، وليست حظراً أمنياً لمحفظة التنفيذ ولا تعني إغلاق مراكز قائمة تلقائياً.** تمييز رسمي ثلاثي: `follow_enabled` = **نيّة المستخدم** · `tracked_wallet_status` = **تقييم النظام للمحفظة المتبوعة** · `execution_wallet_status` (§4.3/G15) = **حالة محفظة التنفيذ/المفاتيح**. مثال: `follow_enabled = true` مع `tracked_wallet_status = degraded` → لا نسخ أعمى؛ خفض ثقة أو تحويل إلى watch/risk-adjusted حسب السياسة.

> **تجميع copyability عبر veto صريح (Gap C — قرار معماري؛ الأسماء/التفاصيل تُسجَّل في SSOT لاحقاً):** `tracked_wallet_status` يُشتقّ من **مكوّنات Wallet Intelligence الشفّافة** (§15.7: `copyability_by_brain` · `crowd_follow_score` · `profit_concentration` · `candidate_wallet_net_copyability_rank` · `candidate_leader_vs_copier_delta` · `candidate_fake_profit_adjusted_edge` · `candidate_profit_source_copyability_class` · `candidate_wallet_type` · `candidate_adverse_selection_severity` · `candidate_wallet_drift_*`) **لا من score مركّب مُعتم** (يبقى مرفوضاً — لا `wallet_trust_score` ولا `copyability_score` رقمي مُعتم ولا ranking-score جديد). هذه المكوّنات قد تُنتج لاحقاً **غلاف veto/سبب copyability صريح** (أسماء مرشّحة تُحسَم في SSOT، نظير veto/reason الجاهزية في §15.9 W1-03). **عند وجود copyability veto نشط: لا تُرقَّى المحفظة إلى `copy_allowed`**، وتُحَلّ الحالة **بتحفّظ** إلى `watch_only` أو `degraded` حسب الشدّة/السياق/السياسة، مع سبب مفسَّر «لماذا ليست قابلة للنسخ». **`banned` يبقى حالة تقييم/سياسة متابعة** — لا حظر أمني لمحفظة التنفيذ، ولا إغلاق مراكز قائمة تلقائياً، ولا تغيير config تلقائي. **الـ veto/السبب يفسّران الحالة فقط** ولا ينشئان: execution authority · command authority · `copy_event` جديد · مسار تنفيذ opportunity · auto-ban · auto-close · auto-config (متّسق مع ثوابت Wave 2: «drift/learning/adverse-selection advisory بلا auto-ban/auto-config»). `tracked_wallet_status` يبقى derived/read-only كما أعلاه (الكتابة اليدوية مرفوضة).

**4.4.6 فلاتر دخول اختيارية (default: غير مفعّل = لا أثر).** تُشكّل قرار الدخول الـ wallet-led ولا تنشئ دخولاً مستقلاً: `fast_hunt_window_ms` (نافذة الصيد — منطق تداول أصيل يبني على فلتر `token_age` §13؛ **ليس جدول اختبار ولا قيد على REAL-LIVE**؛ انتهاؤها → `hunt_status = expired` أو `watch_only` أو `rejected_reason = hunt_window_expired` حسب policy؛ **لا يعفي من `max_entry_slippage_vs_leader`**) · `require_pullback` · `chase_guard` · `min_token_readiness` · `max_entry_volatility` · `single_wallet_min_confidence` (**threshold config يستهلك مخرجات Wallet Intelligence، لا score مستقل**) · `max_liquidity_share_pct` (**حصّة الصفقة من السيولة المتاحة؛ فلتر دخول/حجم قد يخفض الحجم أو يرفض الدخول حسب السياسة، لكنه ليس Hard Risk Group 6، ويتعايش مع `max_position_size_pct` ولا يحلّ محلّه**). تفاصيل default/range/behavior تُترك لـ Config بعد تسجيل SSOT.

**4.4.7 `accepted_reason` / `rejected_reason`.** أساس Decision Trace: `accepted_reason`/`rejected_reason` = **primary enum reason**، ويمكن أن يدعمهما Decision Trace بقائمة أسباب مساعدة لاحقاً؛ **SSOT يحسم إن كانا مفردين أو قائمة، لكن لا تُبنى taxonomy موازية**. أمثلة قبول: `wallet_signal_confirmed` · `cluster_signal_confirmed` · `token_readiness_pass` · `exit_feasibility_pass`. أمثلة رفض: `dex_only_signal` · `ev_negative` · `route_invalid` · `exit_feasibility_fail` · `token2022_dangerous_extension` · `hard_risk_block` · `slippage_vs_leader_exceeded` · `same_cluster_not_independent` · `hunt_window_expired` · `liquidity_share_exceeded`. تُربط حيث أمكن بـ `failure_type`/`api_error_code`/بوابات القبول (EV §7 / Risk §10) لتفادي الازدواج. (لا حقول أسباب جديدة تُضاف خارج SSOT الآن.)

**4.4.8 تشخيص الكمون (diagnostic).** `discovery_latency_ms` · `signal_to_execution_ms` · `latency_to_copy` · `leader_user_price_delta`. **`leader_user_price_delta` اسم مرشّح للقياس المحقّق لفرق الدخول عن القائد، والاسم النهائي يحسمه SSOT خصوصاً لعدم الازدواج مع `entry_slippage_vs_leader` / `max_entry_slippage_vs_leader`** (الأخير عتبة config بمعادلتها القائمة — قياس مقابل حدّ).

**4.4.9 الرادار وDecision Trace كسطح منتج.** `New Coin Radar` يعرض المراحل `discovered → gated` حيّةً؛ Decision Trace يجمع `gated → accepted/rejected` لكل فرصة من reason enums؛ الشارات تعكس `hunt_status`. **سطوح عرض مرتبطة ببيانات القرار، لا تتجاوز أي بوابة دخول.** تفاصيل الشاشات تخصّ Doc 04.

**4.4.10 قواعد مُلزِمة لهذه الطبقة.** (1) **لا دخول تلقائي بمجرد mint**؛ التنفيذ wallet/signal-led افتراضاً. (2) **DexScreener إثراء/عرض/ترتيب فقط** (متّسق §4.1/§14)؛ `dex_only_signal` لا يكفي للتنفيذ. (3) **لا جدول paper/backtest إلزامي يحجب REAL-LIVE** (القرار للمستخدم — §3)، **لكن طبقات السلامة غير قابلة للتجاوز**: Exit Feasibility · Hard Risk وRisk & Safety Layer (§10) · signer isolation · key custody · idempotency · duplicate protection · audit · mode separation · و`real_live_config_valid`، وقيود REAL-LIVE/Key Management في §3/§4.3/§15.1. (4) لا تُسجَّل أي mode/enum لـ discovery-only الآن.

> **حدّ المرحلة:** الأسماء أعلاه (`hunt_status`, `TokenOpportunity`, `new_token_priority_score`, `fast_hunt_window_ms`, `tracked_wallet_status`, reason enums، أعلام الاكتشاف، حقول قابلية النسخ والكمون) **مرشّحة ولا تُعتمد رسمياً قبل تسجيلها في SSOT** (مجموعات مقترحة: Discovery/Hunting · Wallet Intelligence · Entry Filters · Latency · Lifecycle reasons). (مطابق لقاعدة §4.3.)

---

## 6. منهجية الـ Backtest والتحقق (Validation)

- **Event Replay لا Candles:** تخزين كل حدث (slot, block_time, signature, program_id, wallet, mint, curve/pool state before/after, trade_side/size, price_before/after, liquidity, route_available, fees_estimate, migration_state).
- **Backtest = أداة استبعاد، لا إثبات ربحية.** يُعامل كـ **upper-bound** لأنه لا يعيد بناء أثر دخولنا على السوق ولا ردّ فعل المنافسين (المشكلة العكسية / market impact).
- **Conservative Replay** عند غياب ترتيب موثوق داخل الـ slot: نفترض أننا بعد الإشارة، نضيف fill penalty، نمنع ادعاء same-slot advantage، ونضيف `ordering_confidence: high/medium/low` (إشارات low لا تُستعمل لرفع الـ sizing).
- **Point-in-Time Wallet Selection:** كل محفظة تُقيَّم بمعلومات ما قبل لحظة T فقط. ممنوع بناء registry من future-winners.
- **Walk-Forward / Train-Validation-Test:** لا يُلمَس أي parameter بعد رؤية الـ test set.
- **مصدر الثقة النهائي:** backtest يستبعد السيئ → forward PAPER-LIVE على بيانات حية غير مرئية (أسابيع) → أول دفعة REAL-LIVE صغيرة جداً (تؤدي دوراً مزدوجاً: معايرة fill حقيقي + تأكيد edge مصغّر) → التوسّع فقط عند تطابق REAL مع PAPER على عينة كبيرة. **الـ sizing confidence من المعايرة الحية، لا من EV التاريخي.**
- **توصية معايرة (اختيارية، غير حاجبة):** يُنصح هندسياً ببدء REAL-LIVE بحجم صغير لمعايرة الـ fill الحقيقي، والتوسّع بعد تطابق REAL مع PAPER ضمن `paper_real_divergence` على عينة كافية. لكن هذا **اقتراح استرشادي لا قيد إلزامي**: الحجم الأولي والتوسّع قرار المستخدم، والنظام يعرض `paper_real_divergence` و`effective_sample_size` للمساعدة دون أن يحجب أو يقفل أي شيء.

### ضوابط منهجية إلزامية (مضافة في 1.6 — سدّ ثغرات إحصائية)
- **Survivorship-Free Wallet Cohort:** انتقاء المحافظ "الرابحة حالياً" يضخّم العوائد لأنه يهمل المحافظ التي أُفلست/اختفت (نظير إدراج العملات الفاشلة). يُبنى cohort المحافظ **point-in-time خالياً من تحيّز البقاء**: تُدرَج كل محفظة كانت مؤهَّلة لحظة T بمعلومات ما قبل T فقط، بما فيها المحافظ التي ماتت لاحقاً.
- **Regime Coverage (مكافحة period-selection bias):** أداء memecoin يعتمد بشدة على نظام السوق. يُمنع القبول بناءً على فترة صاعدة وحدها؛ يجب تغطية **أنظمة متعددة** (نشوة + ركود + تقلّب عالٍ/crash على الأقل)، مع وسم كل run بـ `regime_label`.
- **Sample Independence / Clustering Correction:** الصفقات المتزامنة على نفس الـ narrative/الـ token مترابطة، فـ **حجم العينة الفعّال (`effective_sample_size`) أصغر بكثير من عدد الصفقات الخام**. تُصحَّح فترات الثقة (LCB) على أساس العينة الفعّالة لا العدد الخام، وإلا انهارت الثقة الإحصائية في الـ expectancy.
- **Self-Impact Inverse Problem:** لا يمكن قياس market impact الخاص بنا من بيانات تاريخية لم نتداول فيها أصلاً (المشكلة العكسية). يُعايَر عبر **tranche live صغير ضمن انتقال PAPER → REAL**، خصوصاً على small-caps ذات الـ order books الرقيقة؛ ويُدخَل الأثر المُعايَر في EV قبل أي توسّع.
- **Latency / Ordering في same-slot copy:** يندر التنفيذ في نفس slot المحفظة الهدف؛ يُفترض **+1 slot على الأقل** ويُدمَج انزلاق الدخول الناتج عن تحرّك السعر في تلك النافذة ضمن `adverse_selection_pen`.

---

## 7. الـ Pipeline الكامل End-to-End (0 → 100)

```
0%   — System Boot
       Load: settings, mode, strategy brains, wallet registry (point-in-time),
       risk limits, profit acceptance settings, cost model, calibration store,
       protocol constants, RPC provider profiles, TTL policies, connection pools,
       worker policy, fill model, EV model, kill switch state.

5%   — Safety / Permission Gate
       Reject all entries if: kill switch active | daily loss exceeded |
       USDT loss limit exceeded | max drawdown | max open positions |
       token/creator/cluster exposure | correlation risk | model drift active |
       RPC degraded | protocol constants changed | user-disabled brain.
       (هذه حدود أمان دائمة لا تُعطَّل.)
       If user_enabled_paper_gate = true: reject entries if paper acceptance
       not passed. Default: paper acceptance is advisory, not blocking
       (الانتقال إلى REAL-LIVE قرار المستخدم — §3؛ والبوابة هنا قيد ذاتي
       اختياري يفعّله المستخدم على نفسه، لا بوابة يفرضها النظام).

10%  — Redundant Multi-Stream Monitoring
       Streams: Helius LaserStream gRPC, Triton/Yellowstone gRPC, third provider.
       Rules: first-to-arrive processing, dedup, source latency/reliability score,
       commitment tracking, stream desync detector, rollback detector.
       Targets: Pump.fun, PumpSwap, smart wallets, creator wallets, pools,
       holder clusters, migration events, liquidity changes.

20%  — Signal Detection
       smart wallet buy/sell | new token | creator activity | curve acceleration |
       migration | liquidity drain | holder concentration change | wash pattern |
       MEV bot pattern | route availability change.

30%  — Decode (minimal in hot path; full decode async)
       Pump.fun instruction | bonding curve state | PumpSwap pool state |
       SPL mint | Token-2022 owner/extensions | wallet behavior | creator profile |
       holder distribution | route candidates | migration status.

35%  — Strategy Router  → Brain A (Bonding Curve) | Brain B (PumpSwap/Open Market)

40%  — Wallet Intelligence
       point-in-time eligibility | min sample size | recency decay |
       out-of-sample score | edge decay detector | copyability score |
       cluster mapping | closed-loop wash detector | sybil cluster detector |
       MEV bot classifier | same-slot buy/sell detector | positional trader filter.
       Blacklist: dev | insider | wash | one-hit | uncopyable sniper |
       sandwich/arbitrage bots | developer-controlled wallets.

50%  — Token / Market Gate
       Reject/score: mint authority | freeze authority | Token-2022 risk |
       creator risk | bundled wallets | top holder concentration |
       volume authenticity | liquidity | migration state | graduation trap |
       sell route availability | market state vs strategy config.

55%  — Exit Feasibility Gate
       Brain A: local curve exit math + state freshness check + dust logic.
       Brain B: reverse quote + route check + optional simulateTransaction.
       Migration: MIGRATION_IN_PROGRESS lock | LP_MINTED unlock |
       dust threshold | ATA close plan.
       Reject if: cannot exit safely | exit cost destroys edge | state stale |
       route unreliable.
       Wash-adjusted liquidity: السيولة المُدخَلة في exit-feasibility/slippage ليست raw
       reserves وحدها؛ تُخصَم بدليل `wash_fake_activity_risk` (W1-03) قبل الحساب — wash-inflated
       volume ليس عمق خروج قابل للتحقّق. دليل wash قوي → خفض effective liquidity أو خفض ثقة
       exit-feasibility؛ وإذا صار الخروج غير آمن يُرفَض عبر `exit_feasibility_fail` (لا قيمة/بوابة
       جديدة). Invariant: عمق الـ pool المُعلَن ليس عمق خروج ما لم يُخصَم منه نشاط الـ wash.

60%  — Cost Pipeline
       entry slippage | exit slippage | price impact | base fee | priority fee |
       Jito tip | compute unit cost | ATA rent cost | ATA close recovery |
       failed attempt cost | route failure cost | adverse selection penalty.
       Reject if cost-adjusted edge below safety margin.

65%  — EV Distribution Engine
       Inputs: live deterministic costs + exit estimate + cohort priors +
       failure model + adverse selection penalty + RPC quality score.
       Output: EV distribution, lower confidence bound, failure probability,
       expected drawdown, exit success probability (+ diagnostics: win_rate,
       avg_winner, avg_loser).
       ev_gate_mode = strict (default): accept only if net_expectancy &
       profit_factor & LCB & drawdown & exit_success all pass.
       ev_gate_mode = warning_only: failed profitability gates → WARNING_CRITICAL
       (لا حجب إن اختاره المستخدم صراحةً)، لكن hard loss/safety gates تبقى مُلزِمة
       دائماً. warning_only يخفّض بوابات الربحية فقط، لا يعطّل ضوابط المخاطر.

70%  — Entry Decision
       Require: enabled gates pass | cost valid | EV valid | risk settings allow |
       RPC health good | protocol constants unchanged | no migration limbo |
       no stale state | user settings allow.

75%  — Liquidity-Based Sizing
       size = f(exit liquidity, risk budget, wallet confidence, brain type,
       correlation exposure, daily loss remaining, position limits,
       RPC degradation state). Never size from historical EV alone.

80%  — Build Order
       route | swap tx | compute budget | priority fee | Jito tip if needed |
       ATA create if needed | ATA close plan if exit | V0 transaction | ALT if needed |
       idempotency key | signature tracking | bundle TTL | blockhash expiry policy.
       Jupiter Swap API v2: Router/Metis (تعليمات خام، تحكّم كامل/CPI) للمسار المخصّص؛
       Ultra (محرّك تنفيذ متكامل: Iris + RTSE + Beam + JupiterZ) للمسار المُدار.
       (api.jup.ag + مفتاح API إلزامي.)

82%  — Pre-Send Micro-Check
       state freshness | mint owner | token program | authority state |
       route freshness | pool freshness | protocol constants version | RPC health.
       Reject if stale or changed. (يحمي من stale state وتغيّر route وToken-2022،
       لا من ادعاء إعادة تفعيل صلاحيات مُلغاة.)

85%  — Execution Adapter
       PAPER-LIVE: same order object → execution_simulator → record simulated
       fill / hypothetical fees / failures. No sign, no send.
       REAL-LIVE: sign → send (Helius Sender default; Jito sendTransaction/Bundle
       when ordering/atomicity needed) → dedup signatures →
       no duplicate rebuilt tx before expiry/cancel → private/protected route for
       high-slippage sells → bundle TTL enforcement → record real fill/failure.

90%  — Position Monitor
       price | liquidity | route health | exit feasibility | creator behavior |
       smart wallet behavior | holder clusters | migration state |
       commitment upgrade (processed→confirmed) | transfer-hook upgrade-authority/identity re-check |
       periodic sell-simulation (Token-2022 held positions) | time in position |
       dust state | paper-real divergence | model drift signals | RPC heartbeat.

95%  — Calibration / Drift / Infra Control
       Update: fill model | slippage model | failure model | fee/tip model |
       exit model | RPC provider score.
       Kill/Pause if: model drift | paper-real divergence high |
       live slippage worse than model p95 | failed rate worse than p95 |
       realized EV below confidence band | exit success deteriorates |
       protocol constants changed | stream desync | memory pressure high.

100% — Exit Engine
       take profit | trailing exit | time exit | liquidity drain exit |
       route failure exit | hook-upgraded honeypot exit (Token-2022 transfer-hook upgraded mid-hold → emergency exit attempt) | creator sell risk exit | cluster sell pressure exit |
       migration-aware exit | model drift exit | daily loss kill | global kill switch.
       Whale sell = risk modifier only (ليس أمر بيع مباشر).
       Post-exit: dust classification | ATA close instruction | ATA sweeper |
       position closed accounting.
```

> **Edge Health / No-Edge Advisory (Gap D — قرار معماري؛ يوضّح «edge decay detector» في §7 pipeline / 40% Wallet Intelligence؛ الأسماء/القيم تُسجَّل في SSOT لاحقاً):** «edge decay detector» المذكور في مرحلة 40% أعلاه هو **تجميع استشاري per-wallet لصحّة الميزة (Edge Health)، لا بوابة تنفيذ جديدة**. يجمع **إشارات قائمة فقط**: paper-real divergence (`candidate_paper_real_divergence_status`) · adverse selection (`candidate_adverse_selection_severity`) · Net Business PnL (`candidate_net_business_pnl`/`_status` — ربح الصفقة لا يعني ربح الأعمال) · leader-vs-copier delta (`candidate_leader_vs_copier_delta`) · slippage vs leader (`entry_slippage_vs_leader`) · كلفة المحاولة الفاشلة (`candidate_failed_attempt_cost`) · wallet drift (`candidate_wallet_drift_signal`/`_reason`/`_recommendation`) · copyability veto/reason (§4.4.5) · `tracked_wallet_status` · كفاية الدليل/حجم العيّنة (`minimum_sample_size`/`candidate_paper_settings_evidence_status`). السطح المستقبلي المقترح (إن أُقِرّ لاحقاً) = **حالة مشتقّة/read-only واحدة نظير `candidate_edge_health_status`** بمعانٍ تكافئ `healthy`/`weakening`/`insufficient_evidence`/`no_edge_suspected` (الأسماء/القيم النهائية لجولة SSOT، لا تُسجَّل هنا). **`no_edge_suspected` استشاري لا blocker · `insufficient_evidence` ليست صفر مخاطر ولا دليل ميزة · أداء Paper لا يُمثَّل كميزة Real.** قد يغذّي تدفّقات التوصية القائمة وإشارات Calibration Kill/Pause القائمة (حيث معرّفة). **لا يُنشئ:** forced live blocker · إغلاق مراكز/تغيير config/حظر محافظ/تعطيل دخول **تلقائياً** · command/execution authority · `copy_event` جديد · opportunity execution. **أي فعل للمشغّل يبقى عبر تدفّقات user/config/permission/audit القائمة** (التوصية تُعاد من المفردات القائمة `candidate_wallet_drift_recommendation`/`candidate_recommendation_type`، لا مفردات جديدة). **لا `candidate_uncopyable_flag` ولا edge score مُعتم.**

---

## 8. الوحدات (Modules)

### وحدات أساسية (Core)
`StreamMonitor` · `SignalDetector` · `Decoder` · `StrategyRouter` · `WalletIntelligence` · `TokenMarketGate` · `ExitFeasibilityEngine` · `CostPipeline` · `EVDistributionEngine` · `EntryDecision` · `PositionSizer` · `OrderBuilder` · `ExecutionAdapter` · `PositionMonitor` · `ExitEngine` · `RiskEngine` · `CalibrationStore` · `AuditTrail`

### وحدات التحصين الإنتاجي (Production Hardening)
`CostPipeline` · `CalibrationStore` · `RPCHealthMonitor` · `ProtocolConstantMonitor` · `MigrationStateMachine` · `TokenAccountSweeper` · `DustClassifier` · `WalletSybilDetector` · `MEVBotClassifier` · `StreamDeduplicator` · `MemoryTTLManager` · `ConnectionPoolManager` · `PreSendSafetyCheck` · `BundleTTLPolicy` · `ComputeBudgetEstimator` · `SignerService` · `KeyManager` · `SlotLagMonitor` · `RequestQueueThrottler` · `ALTMonitor` · `RPCQuorumPolicy` · `JitoTipPolicy` · `CreditBudgetTracker` · `InfrastructurePnL` · `TransactionRetryPolicy` · `StreamGapRecovery` · `FailedTransactionClassifier` · `BundleStatusObserver` · `ProviderCapabilityMatrix` · `QuoteStalenessContract` · `FeeSourceOfTruth` · `PlatformFeeGuard`

> ملاحظة بناء عملية (ليست تقسيماً للتصميم): الوثيقة كاملة وكل الوحدات جزء من المنصة. لكن عند كتابة الكود، `CostPipeline` و`CalibrationStore` يُكتبان أولاً لأنهما شرط عمل بوابة EV؛ ووحدات الـ live hardening (`RPCHealthMonitor`, `ProtocolConstantMonitor`, `TokenAccountSweeper`, `PreSendSafetyCheck`, `BundleTTLPolicy`) **و`SignerService` + `KeyManager` (إلزامية)** تُكتب جميعاً قبل تفعيل REAL-LIVE.

---

## 9. مخططات الوحدات الأساسية (Key Schemas)

### CostPipeline — مصدر كل رقم
```
CostEstimate {
  // حتمي — يُقاس live قبل الإرسال
  entry_slippage_bps:      from quote / curve math
  price_impact_bps:        from quote (priceImpactPct) / curve math
  base_fee_lamports:       default_reference فقط (~5000/sig) — القيمة الفعلية من fee model / network config
  priority_fee_lamports:   Helius Priority Fee API
  jito_tip_lamports:       Jito tip-floor oracle (percentiles آخر الكتل) — config/provider-derived, لا hardcode
  compute_unit_limit:      ComputeBudgetEstimator (profiled/cached للـ A، simulate للـ B)
  compute_unit_price:      من سياسة الرسوم
  ata_rent_lamports:       إن لزم إنشاء ATA
  ata_close_recovery:      lamports تُسترد عند الإغلاق (رصيد = 0)

  // تقديري — من الحالة الحالية
  est_exit_slippage_bps:   reverse quote (B) / curve math (A)
  est_exit_cost:           محسوب

  // احتمالي — من cohort priors (CalibrationStore)
  p_fill:                  مُعايَر
  p_exit_success:          مُعايَر
  failed_attempt_cost:     ≈ base + priority fee (الـ Jito tip لا يُدفع غالباً إلا عند الإدراج)
  route_failure_cost:      مُعايَر
  adverse_selection_pen:   مُعايَر (دخول أسوأ + خروج أبطأ من المحفظة المنسوخة)
}
```

**قاعدة Cost Pipeline ↔ Hot Path (إلزامية):** المسار الحار لا يُجري أي API call خارجي. كل بيانات الرسوم/الـ tip/الـ quote تُقرأ من **cache حديث داخل RAM**، ويُحدَّث الـ cache **async خارج الـ hot path**، مع **TTL لكل نوع بيانات**:
- `priority_fee` و`jito_tip`: TTL مرن (~ثانية–ثانيتان)، يحدّثهما worker خلفي يقرأ Helius/Jito دورياً.
- **Brain A** يسعّر الدخول والخروج من **curve/pool state المتدفّق في RAM** (لا Jupiter quote، لا RPC) — أطزج مصدر ممكن.
- **Brain B** يستخدم quote/route مع **TTL ضيق جداً** (مئات المللي ثانية)، والـ Pre-Send Micro-Check (82%) يلتقط أي staleness.
- إذا انتهت صلاحية أي cache حرج → **reject الصفقة أو الانتقال إلى EXITS_ONLY**، لا الاستمرار بقيمة قديمة.

### CalibrationStore — ما يُخزَّن للمعايرة
```
CalibrationRecord {
  trade_id, brain, signal_bucket, wallet_cluster, token_risk_bucket
  simulated_fill_price, real_fill_price
  simulated_slippage, real_slippage
  simulated_exit, real_exit
  failed_attempts_count, rpc_latency_ms, route_failure_flag
  ata_rent_paid, ata_rent_recovered, dust_event_flag
  ordering_confidence
  timestamp_processed, timestamp_confirmed
}
```
ملاحظة: في PAPER الخالص لا توجد `real_*` بعد، فابدأ بـ priors متشائمة مشتقة من event-replay؛ قوة المعايرة تنشط مع أول دفعة REAL صغيرة.

---

## 10. طبقة المخاطر والأمان (Risk & Safety Layer)

### حدود يحددها المستخدم (قيمةً) ولا تُحذف (وجوداً)
`max_daily_loss_pct` · `max_daily_loss_usdt` · `max_total_drawdown_pct` · `max_open_positions` · `max_position_size_pct` · `max_token_exposure_pct` · `max_creator_exposure_pct` · `max_cluster_exposure_pct` · `max_correlated_meme_exposure_pct`

### ثوابت لا تُحذف من المنصة
`Global Kill Switch` · `Daily Loss Kill` · `USDT Loss Kill` · `Model Drift Kill` · `Exit Feasibility Gate` · `Position Accounting` · `Audit Trail` · `Mode Separation` · `Duplicate Transaction Protection` · `Emergency Stop`

### آلة حالات التشغيل (Operating State Machine)
خمس حالات بدل ثنائية «يعمل/يتوقف»:

| الحالة | دخول جديد | خروج آلي | مراقبة | الاستئناف |
|---|---|---|---|---|
| **WARMING_UP** | ✗ | ✗ | ✓ (caches + health) | تلقائي بعد اكتمال الجاهزية |
| **ACTIVE** | ✓ | ✓ | ✓ | — |
| **EXITS_ONLY** | ✗ | ✓ | ✓ | تلقائي عند زوال السبب |
| **PAUSED** | ✗ | يدوي/قواعد أمان فقط | ✓ | تلقائي/يدوي |
| **KILLED** | ✗ | **Emergency Exit فقط** (إن كان أأمن من ترك المركز) | محدودة | **إنسان فقط** |

- **WARMING_UP** (عند Boot أو العودة من PAUSED): لا دخول، لا تقييم إشارات دخول، لا بناء أوامر — فقط تحديث الـ caches وتشغيل health checks. الانتقال إلى **ACTIVE** فقط بعد تحقّق *كل* ما يلي: priority-fee cache fresh · Jito-tip cache fresh · protocol constants loaded · RPC health green · stream sync healthy · calibration priors loaded · cost pipeline ready. (يمنع اتخاذ قرار على cache ناقص — متّسق مع قاعدة Cost Pipeline ↔ Hot Path.)

- **EXITS_ONLY** تُفعَّل عند: RPC degraded · stream desync · protocol uncertainty · memory pressure · migration limbo · model drift *warning*. لا صفقات جديدة، لكن الخروج من المراكز المفتوحة مسموح.
- **KILLED** (Hard Kill) تُفعَّل عند: protocol constant *changed* · model drift *مؤكد* · daily loss / drawdown limit · global kill switch. **ليست تجميداً كاملاً:** تمنع أي دخول جديد وأي تشغيل عادي فوراً، لكنها **تسمح بـ Emergency Exit** للمراكز المفتوحة إذا كان الخروج أأمن من تركها مكشوفة (وفق سياسة الأمان). أي استئناف للنظام يحتاج تدخّل إنسان.

### Audit Trail (تعريف تقني)
- **append-only**: لا تعديل ولا حذف لأي سجل.
- كل سجل يحتوي `hash` للسجل السابق (سلسلة hash) → أي تعديل لاحق يظهر كفساد في السلسلة.
- يسجّل: كل قرار، كل أمر، كل fill (وهمي/حقيقي)، كل تغيّر حالة تشغيل، كل تفعيل kill/pause.
- اختياري لاحقاً: تصدير يومي إلى Parquet / Cold Storage.

### User Control Boundary (حدود تحكّم المستخدم)
- كل **فلتر استراتيجي** قابل للتفعيل/التعطيل.
- كل **قيمة/عتبة** قابلة للتعديل.
- لكن هذه الطبقات **لا تُحذف ولا تُعطَّل** تحت أي إعداد: `Position Accounting` · `Audit Trail` · `Global Kill Switch` · `Duplicate Transaction Protection` · `Mode Separation` · `Exit Feasibility Gate`. الإعدادات تمنح حرية الاستراتيجية، لا تجاوز الأمان. (لا توجد بوابة قبول ورقي حاجبة — الانتقال إلى REAL-LIVE قرار المستخدم؛ انظر §3.)

### إدارة المفاتيح وأمان التوقيع (Key Management & Signing Security) — شرط قبل REAL-LIVE
- **لا مفاتيح خاصة في الواجهة أبداً**، ولا في logs أو audit payloads.
- **لا قراءة للمفتاح من `.env` عند كل صفقة.** يُحمَّل عند System Boot من **KMS / Secret Manager / secure local vault**، ويبقى **داخل ذاكرة الـ signer فقط**.
- التوقيع داخل **`SignerService` منفصل** ومعزول عن الـ dashboard والـ api_gateway؛ المحرك يرسل *signing_intent* ويستقبل *tx_signature*.
- **REAL-LIVE signer معزول** بيئةً وصلاحياتٍ (process/host منفصل).
- **wallet allowlist** + صلاحيات سحب/تحويل محدودة (لا صلاحيات مفتوحة).
- **emergency revoke / disable signer** من الواجهة، فوري (يرتبط بـ Global Kill Switch / KILLED). عند KILLED أو revoke: تعطيل الـ signer فوراً + **best-effort zeroization** للمادة السرية من الذاكرة إن كان مدعوماً.
- كل توقيع يُسجَّل كـ `signing_intent + tx_signature` فقط في الـ Audit Trail **دون كشف المفتاح** إطلاقاً.
- مبدأ: تسريب مفتاح = خسارة كاملة لا رجعة فيها؛ تُعامَل إدارة المفاتيح بأعلى من أي اعتبار أداء.

> Stop Loss وحده ليس حماية في السيولة الضعيفة. الحماية الأساسية: position size vs liquidity + exit feasibility before entry + continuous exit feasibility + time exit + liquidity drain exit + creator/cluster behavior exit.

---

## 11. التقنيات (Tech Stack)

- **اللغات:** Rust للـ hot path؛ TypeScript للـ dashboard والربط.
- **Data Streams:** Helius LaserStream gRPC + Triton/Yellowstone gRPC (Dragon's Mouth) + مزود ثالث (redundancy + dedup + first-to-arrive). **تنبيه طريقة:** `transactionSubscribe` **ليست طريقة WebSocket قياسية في Solana** بل خاصة بـ Helius (Enhanced WebSockets / LaserStream) أو تُحاكى عبر filter في Yellowstone gRPC؛ الطرق القياسية: slotSubscribe / accountSubscribe / logsSubscribe / signatureSubscribe / programSubscribe. LaserStream متوافق drop-in مع Yellowstone، ويدعم **historical replay/backfill لنافذة 24 ساعة فقط** (لا backfill من أي slot قديم تعسّفي)، متاح من خطة Professional فأعلى.
- **Wallet Intelligence:** Birdeye (Wallet PnL / Top Traders) + Bitquery (Pump.fun/PumpSwap trades, creation, holdings, curve progress, migration) + Cielo/Solscan enrichment + Internal Wallet Score.
- **Routing:** Jupiter **Swap API v2** عبر `api.jup.ag` (**مفتاح API إلزامي** من portal.jup.ag؛ بدونه استجابة 401 — `lite-api.jup.ag` في طور الإهمال). مساران: **Router/Metis (تعليمات خام)** للتحكّم الكامل في التعليمات والإرسال وCPI (وهو مسار محرّكنا)؛ **Ultra** محرّك تنفيذ متكامل (Iris/RTSE/Beam/JupiterZ) للمسار المُدار. Metis ما زال محرّك التوجيه (تحوّل إلى public good بدعم best-effort).
- **Execution:** Helius Sender (يرسل **بالتوازي** إلى validators عبر SWQoS وإلى Jito معاً) افتراضياً — بلا استهلاك credits، يتطلب `skipPreflight=true` + tip + priority fee + `maxRetries=0`، حد افتراضي ~6 TPS؛ Jito sendTransaction/Bundle للترتيب/الذرية (حتى 5 معاملات، atomic، أو تفشل كلياً)؛ fallback متدرّج مع idempotency.
- **Jito BAM (Block Assembly Marketplace) — واقع mainnet:** أُطلق على mainnet في 25 سبتمبر 2025، وتجاوز **20% من stake الشبكة بحلول يناير 2026** (>270 validator). معمارية PBS: BAM Nodes داخل **TEEs** (mempool مشفّر + attestations on-chain)، مع **Plugins** و**Application-Controlled Execution (ACE)**. يجعل ترتيب المعاملات داخل الـ slot أكثر شفافيةً ومقاومةً للـ MEV — تُعاد معايرة افتراضات الترتيب وسياسة الـ tip/bundle عند تغيّر حصته.
- **Tip sizing:** Jito tip-floor oracle عبر `https://bundles.jito.wtf/api/v1/bundles/tip_floor` (مئويات 25/50/75/95/99 + `ema_landed_tips_50th_percentile`) أو بثّ `wss://.../tip_stream`. **الحد الأدنى تابع للمزوّد:** بروتوكولياً 1000 lamports عبر Jito المباشر، بينما **Helius Sender يفرض 0.0002 SOL** للمسار المزدوج (أو 0.000005 SOL مع `?swqos_only=true`) — لا تخلط بين الرقمين. كل قيم الحد الأدنى **config/provider-derived لا hardcode**، وتُقرأ من إعداد/مزوّد لا من منطق القرار. حسابات الـ tip لا تُوضع في ALT، ويُجعل الـ tip ضمن آخر معاملة في الـ bundle (مقاومة uncle-bandit).
- **Storage:** PostgreSQL (الحالة) · ClickHouse (الأحداث/التحليلات/event-replay) · Redis (التوزيع) · RAM HashSet (المسار السريع) · Cold store (أرشفة).
- **Connections:** HTTP keep-alive، gRPC persistent channels، connection pool per provider، timeouts، circuit breaker، backoff. ممنوع فتح TCP لكل quote/simulate.
- **فصل مسار القراءة/البثّ عن مسار الإرسال (Read/Send Path Separation):** عقد ومسارات الـ Read/Index/Stream منفصلة عن مسار Send/Landing/Confirmation؛ ازدحام عقد القراءة لا يُبطئ الإرسال، والإرسال يستخدم endpoints/pools لأقلّ كمون وأفضل landing. **الفصل لا يعني تضارباً بين مصادر الحقيقة؛ read/index/stream يزوّد القرار، أمّا send/landing/confirmation فيرسل ويؤكّد، وكل reconciliation يعود إلى Intent/Position/Audit.** (تحصين لا module مكرّر.)

---

## 12. عزل الواجهة (UI Isolation — مهم لمرحلتك القادمة)

```
trading_daemon  →  event_bus  →  api_gateway  →  dashboard_ui
```
- محرك التداول **لا يعتمد** على الواجهة، والواجهة **لا تبطّئ** الـ hot path.
- الواجهة تقرأ snapshots/events فقط (read-only على الحالة الحية).
- كل ما يحتاجه المستخدم (الإعدادات، المؤشرات التشخيصية، سجل الصفقات، PnL، حالة الإيقافات، الموافقات اليدوية) يُعرض من الـ api_gateway.
- نمط التنفيذ: **آلي 100% أساساً**، مع طبقة موافقات يدوية اختيارية ثانوية (`auto_execution_enabled`, `manual_approval_enabled`).

---

## 13. الإعدادات الكاملة في الواجهة (Settings)

```
Trading Mode:      PAPER-LIVE | REAL-LIVE   (التبديل قرار المستخدم — لا بوابة حاجبة)
                   user_enabled_paper_gate = false (افتراضاً؛ PAPER استرشادي.
                   إن فعّله المستخدم أصبح قيداً ذاتياً اختاره هو لا يفرضه النظام)
Strategy Brain:    Brain A (Bonding Curve) | Brain B (PumpSwap/Open Market)
Execution:         Auto | Manual Approval | Helius Sender | Jito send | Jito Bundle | Jupiter Route Mode

Position Sizing:   sizing_mode = fixed_usd | fixed_sol | pct_of_capital
                   sizing_value (دولار/SOL/نسبة) | capital_reference

Copy Settings:     (لكل محفظة منسوخة على حدة — انظر §4.2)
                   copy_mode = follow_entry_user_exit | full_mirror
                   take_profit_pct (في نمط الخروج بالهدف) | per_wallet_risk_limits |
                   follow_enabled (تفعيل/تعطيل المتابعة) |
                   partial_sell_policy | min_mirror_sell_pct | cumulative_ignored_sell |
                   partial_sell_low/medium/high/major_threshold |
                   copy_adds_enabled | copy_adds_for_follow_entry | scale_in_policy |
                   transfer_exit_policy | conflict_resolution |
                   max_entry_slippage_vs_leader | rebuy_cooldown |
                   whipsaw_window | whipsaw_penalty | allow_whipsaw_reentry_override

Quality / EV Settings:
                   ev_gate_mode = strict | warning_only (default = strict)
                   minimum_net_expectancy | minimum_profit_factor |
                   minimum_lower_confidence_bound | minimum_sample_size |
                   max_expected_drawdown_pct | minimum_exit_success_rate
   (strict = بوابات ربحية حاجبة فعلية. warning_only = تُعرض كـ WARNING_CRITICAL
   ولا تحجب باختيار المستخدم، لكن حدود الخسارة والأمان الصلبة تبقى مُلزِمة دائماً.)

Diagnostics:       win_rate | avg_net_winner | avg_net_loser | payoff_ratio |
                   failed_attempt_rate | slippage_distribution | paper_real_divergence

Risk:              max_daily_loss_pct | max_daily_loss_usdt | max_total_drawdown_pct |
                   max_open_positions | max_position_size_pct |
                   max_token_exposure_pct | max_creator_exposure_pct |
                   max_cluster_exposure_pct | max_correlated_meme_exposure_pct

Filters (toggle):  wallet_score | creator_risk | bundled_wallet | graduation_trap |
                   top_holder | fake_volume | liquidity | route_quality |
                   exit_feasibility | token_age | token2022 (allow/deny)

Exit (toggle):     take_profit | trailing | time_exit | liquidity_drain |
                   route_failure | creator_exit | whale_sell_risk_modifier
```

---

## 14. حالات خاصة على سولانا (Solana-Specific Handling)

- **ATA rent:** يُحسب كتكلفة دخول؛ إغلاق الحساب برصيد صفر يعيد الإيجار → `TokenAccountSweeper` دوري + `ATA close plan` بعد الخروج.
- **Dust:** إن كانت قيمة الـ dust أقل من تكلفة بيعها → `CLOSED_WITH_DUST`، بلا route checks أو مراقبة عالية التردد.
- **Token-2022:** **فحص إلزامي لا اختياري** (لأن Pump.fun `create_v2` يصدر mints من نوع Token-2022 افتراضياً منذ نوفمبر 2025). رفض/تسعير حذِر حتى يُبنى parser كامل للامتدادات الخطرة وتُحتسب آثارها في EV. القائمة الموسّعة: `TransferFeeConfig` (قد يتغيّر بتأخير epochين فيُفشل الخروج) · `TransferHook` (TOCTOU + حسابات إضافية تكبّر المعاملة) · `NonTransferable` · `PermanentDelegate` (سحب/حرق أي رصيد دون إذن إضافي — الأخطر) · `DefaultAccountState=Frozen` · **`Pausable`** (إيقاف التحويلات = DoS على الخروج) · **`ScaledUiAmount`** (مضاعف يربك حساب الكمية/السعر) · **`ConfidentialTransfer` وتفرّعاتها** (`ConfidentialTransferFee`, `ConfidentialMintBurn` — تُخفي المبالغ فتكسر التحقق من الكمية المستلَمة) · **`InterestBearingMint`** (كمية متغيّرة زمنياً) · `MemoTransfer`. **قاعدة:** يُفحَص الامتداد بحالته الفعلية لا بمجرد وجوده (مثلاً بعض الرموز لها `TransferHook` مُهيّأ لكن program ID فارغ/مُعطّل — كـ PYUSD).
- **Token-2022 (honeypot-by-upgrade):** برنامج الـ `TransferHook` نفسه قد يكون **قابلاً للترقية**؛ توكن يجتاز فحص الدخول قد يتحوّل honeypot قبل الخروج عبر ترقية الـ hook ليمنع البيع (نظير «upgrade authority = honeypot» في EVM). **قاعدة الدخول:** يُرفَض الدخول على توكن برنامج الـ hook فيه يحمل **سلطة ترقية حيّة** (يُفضَّل immutable/`None`) أو يُقصَر على تقييم حذِر — عبر مكوّن الجاهزية القائم `token2022_extension_risk` (لا قيمة دخول جديدة). **الخطر زمني** يُعاد فحصه طوال الاحتفاظ (Position Monitor §15.1 / Pipeline 90%) وليس عند الدخول فقط.
- **Commitment/Rollback:** `processed` للإشارة السريعة (Brain A) لكنه قابل للـ rollback؛ Position Monitor يتابع الوصول إلى `confirmed`؛ عند fork mismatch → `NETWORK_ROLLBACK_EVENT` وسياسة خروج/إلغاء.
- **Migration:** `MIGRATION_APPROACHING` → `MIGRATION_IN_PROGRESS` → `LP_MINTED` → `POST_MIGRATION_ACTIVE`. لا تجميد للخروج عند 99.9%؛ منع الدخول الجديد قرب graduation trap؛ إيقاف محاولات البيع التي تحرق الرسوم أثناء الهجرة؛ إعادة التفعيل بعد `LP_MINTED`.
- **High-slippage sell:** عبر Jito/protected route فقط، أو cancel إن لا يوجد مسار محمي.
- **Bundle:** `bundle_ttl_slots` كإعداد (لا رقم ثابت)؛ التحقق عبر `getInflightBundleStatuses` (نافذة 5 دقائق فقط — بعدها خطأ 500 — يرجّع Pending/Failed/Landed/Invalid) ثم `getBundleStatuses` للتاريخي (تواقيع + slot)؛ إسقاط أي bundle خارج TTL بلا إعادة بث؛ الـ tip شرط النظر في المزاد ولا يضمن الإدراج أو الـ landing.

---

## 15. سياسات التحصين التشغيلي (Operational Hardening Policies)

### SlotLagMonitor (داخل RPCHealthMonitor)
يشترك في `slotSubscribe` من أكثر من مزود ويقارن أعلى slot مرصود. إذا تأخّر المزود الأساسي عن أقرانه أكثر من العتبة → `provider_degraded = true` → منع الدخول الجديد + EXITS_ONLY أو provider failover. يُسجَّل `slot_lag` في RPCHealthMonitor والـ Audit Trail. (يمنع Brain A من حساب EV على حالة متأخرة رغم أن المزود يبدو متصلاً.)

### Calibration Finality Policy (داخل CalibrationStore)
سجلات `processed`/`confirmed` تُحفظ كـ **provisional observations** (للمراقبة الفورية فقط)، ولا تدخل في **long-term EV priors** إلا بعد `finalized`. عند rollback أو fork mismatch: تُوسَم السجلات المرتبطة `mark_invalid` أو تُزال عبر retroactive purge. (يمنع تلوّث نموذج EV بنتائج لم تَنهَ على السلسلة.)

### RequestQueueThrottler
batching للطلبات المتشابهة + dedup للمكرر + per-provider rate limits + backoff + circuit breaker. تقسيم إلى priority lanes: (1) hot cache refresh، (2) exit checks، (3) trade-critical enrichment، (4) analytics/dashboard. **قاعدة:** أي enrichment غير ضروري للدخول الفوري لا يدخل hot path. (يمنع انهيار النظام أو حظره من Birdeye/Bitquery/Jupiter/Helius عند كثافة الإشارات.)

### ALTMonitor (Brain B / V0)
يراقب الـ Address Lookup Tables المستخدمة في V0 transactions. لا بناء V0 إذا كانت ALT stale؛ يتحقق من freshness عند الـ commitment المطلوب؛ إن تعذّر إثبات الطزاجة → rebuild route أو reject. يُسجَّل ALT freshness في Build Order metadata.

### RPCQuorumPolicy (للصفقات الكبيرة/الحساسة فقط)
يُفعَّل **فقط** عند: `position_size > threshold` · state anomaly · provider confidence low · route/curve state حساس. القاعدة: استعلام الحالة من 3 مزودين، قبول إذا اتفق 2 من 3 ضمن tolerance؛ إن لم يتحقق النصاب → `DATA_ANOMALY` → reject. **ليس إلزامياً لكل صفقة** (يضيف latency غير ضروري).

### JitoTipPolicy (مع EV Cap)
base tip من tip-floor oracle (`bundles.jito.wtf/api/v1/bundles/tip_floor` — مئويات 25/50/75/95/99 + `ema_landed_tips_50th_percentile`، أو بثّ `tip_stream`)، + **volatility multiplier** عند: buy acceleration · same-slot demand spike · high-value signal · launch hype regime. الـ multiplier **مسقوف بـ EV cap**: إذا جعل الـ tip المطلوبُ Net Expectancy غير مقبول → reject trade. **الحد الأدنى تابع للمزوّد:** 1000 lamports بروتوكولياً عبر Jito المباشر، 0.0002 SOL عبر Helius Sender المزدوج (أو 0.000005 SOL مع swqos_only). (الـ tip يرفع احتمالية الإدراج ولا يضمن الـ landing؛ حسابات الـ tip لا تُوضع في ALT، والـ tip ضمن آخر معاملة بالـ bundle ضد uncle-bandit.)

### TransactionRetryPolicy
كل transaction تحمل `last_valid_block_height`. **ممنوع بناء transaction جديدة** قبل: blockhash expiry · أو cancel/abandon state واضح · أو فشل مؤكد. كل retry يخضع لـ `idempotency_key` + signature tracking + blockhash TTL + EV cost check + duplicate-fill protection. عند انتهاء صلاحية blockhash: تُلغى النسخة القديمة منطقياً ثم تُبنى أخرى بتوقيع جديد. (منطق rebroadcast مخصص؛ RPC rebroadcast الافتراضي لا يكفي وقت الازدحام، والـ retry ليس spam.)

### StreamGapRecovery
كل stream يحتفظ بـ `last_seen_slot` و`last_confirmed_slot`. عند reconnect: **replay/backfill من آخر slot موثوق** (LaserStream يدعم historical replay **ضمن نافذة 24 ساعة فقط** — لا backfill تعسّفي من أي slot قديم). إذا تعذّر ردم الفجوة (أو تجاوزت نافذة الـ 24 ساعة) → النظام EXITS_ONLY. إشارات الفجوة غير المؤكدة **لا تدخل EV priors**. كل gap يُسجَّل في Audit Trail وRPCHealthMonitor.

### FailedTransactionClassifier
يصنّف الفشل إلى: `SlippageExceeded` · `BlockhashExpired` · `AccountInUse` · `ComputeBudgetExceeded` · `InsufficientFunds` · `RouteInvalid` · `TokenAccountMissing` · `ProgramError` · `RPCDropped` · `BundleFailed` · `Unknown`. كل فشل يدخل CalibrationStore، ولكل نوع retry policy مختلفة. **`failed_attempt_cost` ليس رقماً عاماً واحداً** بل مفصّل حسب السبب (وإلا أصبحت المعايرة عمياء).

### BundleStatusObserver
بعد `sendBundle`، الصفقة **ليست ناجحة بمجرد `bundle_id`**. يراقب عبر `getInflightBundleStatuses` (**نافذة 5 دقائق فقط** — بعدها خطأ 500): Pending · Failed · Landed · Invalid. Pending بعد TTL → `STALE_BUNDLE` بلا rebroadcast. Failed → يُمرَّر إلى FailedTransactionClassifier. Landed → `observe_fill`. للتأكيد التاريخي بعد النافذة → `getBundleStatuses` ثم `getSignatureStatuses` كـ fallback دُفعي.

### ProviderCapabilityMatrix
لكل مزوّد: `supports_streaming` · `supports_historical_replay` · `supports_priority_fee_api` · `supports_sender` · `supports_jito` · `supports_swqos` · `supports_batching` · `supports_websocket` · `supports_grpc` · `rate_limit_profile` · `credit_model` · `regional_endpoints` · `failover_priority`. ترتبط بـ RPCHealthMonitor · CreditBudgetTracker · ExecutionProviderPolicy · RequestQueueThrottler. (تمنع فوضى التبديل بين المزودين.)

### QuoteStalenessContract
كل quote يحمل: `quote_slot` · `quote_timestamp` · `route_hash` · `input_amount` · `expected_out` · `price_impact`. يُمنع استخدامه إذا: TTL expired · route_hash changed · pool state changed · price impact تجاوز الحد. **Brain B لا يبني order من quote قديم**، وPreSendSafetyCheck يتحقق من route freshness.

### FeeSourceOfTruth
مصدر حقيقة واحد لكل تكلفة: `base_fee` ← Solana fee model / live calculator (5000 lamports/sig، 50% يُحرق؛ يُحتسب حتى عند الفشل) · `priority_fee` ← Helius `getPriorityFeeEstimate` (مستويات min/low/medium/high/veryHigh/unsafeMax = مئويات 0/25/50/75/95/100؛ مع `recommended:true` يرجّع الوسيط أو 10,000 microLamports أيهما أكبر؛ يحلّل آخر ~150 block) · `compute_unit_limit` ← ComputeBudgetEstimator (ضع `setComputeUnitLimit` أولاً ثم `setComputeUnitPrice`؛ الرسم = ceil(CU_price × CU_limit / 1e6)، محسوب على الحد المطلوب لا المستهلك) · `jito_tip` ← Jito tip oracle (`bundles.jito.wtf` tip_floor / tip_stream) · platform/provider fees ← ProviderCapabilityMatrix + InfrastructurePnL. (يمنع خلط مصادر التكلفة في الكود.)

### PlatformFeeGuard
`platformFeeBps = 0` افتراضاً. أي platform fee (Jupiter Swap API v2: `platformFeeBps` في الـ quote + `feeAccount` في الـ swap) يجب أن تظهر في CostPipeline؛ يُمنع بناء swap فيه fee غير مصرّح؛ وإن أُضيفت لاحقاً تدخل في `net_expectancy`. (الـ `feeAccount` حساب referral token تابع لسلطة المشروع عبر برنامج الإحالة Jupiter — PDA بالبذور `["project", base]`؛ يُنشأ من نوع Token-2022 عند الحاجة لاقتطاع رسوم على mints بنظام Token-2022.)

---

## 15.1 المعمارية التشغيلية للمركز والنوايا (Position & Intent Operational Layer)

سبع وحدات تشغيلية موجزة تُسند ما حُسم في §4.1/§4.2، **مرتبطة بالآليات القائمة لا مكرّرة لها**. التفاصيل الدقيقة (كل transitions آلة الحالات) تُترك لطبقة التنفيذ.

**1) PositionLifecycleStateMachine.** كل مركز يحمل حالة صريحة تمنع تنفيذ أمرين متعارضين عليه: `OPENING` · `OPEN` · `PARTIALLY_EXITING` · `EXIT_PENDING` · `MIRROR_SELL_PENDING` · `MIGRATION_PENDING` · `CLOSED` · `CLOSED_WITH_DUST` · `FAILED_ENTRY` · `FAILED_EXIT`. القاعدة: لا action جديد إلا إن سمحت به الحالة الحالية. **ربط لا تكرار:** `MIGRATION_PENDING` = المركز أثناء `MIGRATION_IN_PROGRESS` المعرّف في §4.1 (لا حالة مستقلّة)، و`MIRROR_SELL_PENDING` = نيّة الـ mirror-sell المعلّقة في §4.2؛ و`CLOSED_WITH_DUST` متّسق مع منطق الـ dust في §14.

**2) IntentLedger.** كل إجراء يبدأ بنيّة مسجَّلة قبل بناء أي order: `BUY_INTENT` · `SELL_INTENT` · `SCALE_IN_INTENT` · `MIRROR_SELL_INTENT` · `EMERGENCY_EXIT_INTENT` · `CANCEL_INTENT`. **لا OrderBuilder بلا `intent_id`، ولا retry بلا نفس `intent_id` أو replacement intent صريح** (يكمّل الـ idempotency وsignature tracking القائمين، ويمنع تكرار شراء/بيع بسبب retry أو stream duplicate أو migration pending). **ربط بالعقل:** كل intent يحمل `issuing_brain = current_control_brain` لحظة الإصدار، فلا يُصدر Brain A نيّة على مركز انتقل تحكّمه إلى Brain B.

**3) LeaderPositionReconstructor.** شرط مسبق لكل سياسات §4.2 (لا Partial Sell Policy ولا Full Exit Policy بلا رصيد قائد محسوب بدقّة). يعيد بناء: `leader_wallet_balance_before/after` · `leader_cluster_balance` · `transfer_adjusted_balance` · `sell_percentage` · `buy_percentage` · `full_exit_detected` · `partial_exit_detected`. (يمنع حساب «باع 30%» أو «خروج كامل» خطأً.)

> **تمييز internal مقابل explainable (Gap A — قرار معماري):** المتغيّرات المُعدَّدة أعلاه (`leader_wallet_balance_before/after` · `leader_cluster_balance` · `transfer_adjusted_balance` · `sell_percentage` · `buy_percentage` · `full_exit_detected` · `partial_exit_detected`) **حساب داخلي تنفيذي فقط** — لا تُسجَّل كحقول SSOT/API/Data/UX. المخرَجان الوحيدان القابلان للتفسير المُعدّان للتسجيل لاحقاً في SSOT (جولة منفصلة) هما: **`candidate_leader_position_change_pct`** = مقدار تغيّر مركز القائد **بعد خصم التحويل/تعديل الـ cluster** (مقياس واحد محايد للبيع والإضافة)، و**`candidate_leader_balance_reconstruction_status`** = حالة/ثقة إعادة البناء (read-only). **اتّجاه/نوع التغيّر لا يحتاج حقلاً جديداً؛ يأتي من قيم `copy_event` القائمة** (`leader_partial_sell` · `leader_full_exit` · `leader_scale_in`) — فلا تُضاف `full_exit_detected`/`partial_exit_detected` (تكرار `copy_event`)، ولا `candidate_leader_sell_percentage`/`candidate_leader_buy_percentage` (مغطّاة بالاسم المحايد)، ولا أي leader P&L، ولا reconstruction object/resource عريض. **خصم التحويل/الـ cluster جزء من الحساب لا قيمة حالة** — فلا `transfer_adjusted` كقيمة status؛ والقيم اللاحقة المعتمدة في SSOT تكافئ `reconstructed` · `partial` · `low_confidence` · `unavailable`. **Fail-safe:** إذا كانت إعادة البناء `unavailable` أو منخفضة الثقة، **لا يُفترَض 0% ولا 100% ولا mirror أعمى**؛ بل سلوك حذِر (watch-only / manual-review / خفض الإجراء) عبر طبقات السياسة القائمة (§4.2/§10)، اتّساقاً مع Fail-Safe-Not-Fail-Open. (توضيح معماري فقط: **لا command/execution authority، ولا API/Data column/UX panel/Test/Config جديد في هذه الجولة**؛ الأسماء `candidate_*` تبقى مرشّحة حتى تثبيتها في SSOT.)

**4) TransferDestinationConfidence.** يثبّت تعريف «known cluster» الذي تعتمده §4.2: `destination_type ∈ {known_cluster, probable_cluster, unknown_wallet, split_unknown, cex_like, creator_dev_cluster, burn_or_lock, program_account}` مع `confidence_score: 0.0–1.0`. القاعدة: **فقط `known_cluster` بثقة عالية → متابعة على مستوى cluster؛ كل ما عداه (بما فيه `probable_cluster`) → `disable_new_adds`** (لا يُعتبر «محتمل الارتباط» كأنه مؤكّد).

**5) Do-Not-Trade Registry (طبقة إنفاذ موحّدة).** **ليست قائمة منع ثانية** — هي runtime enforcement layer تقرأ من الـ blacklists القائمة وتوحّد إنفاذها (مصدر حقيقة واحد). المفاتيح: token mint · creator wallet · cluster id · leader wallet · program id · pool/route id. عند أي match: `reject entry` · `allow exit only` · تسجيل السبب في Audit Trail.

**6) ConfigVersioning (مع فصل حرج بين الاستراتيجية والأمان).** الإعدادات الحالية تحمل `config_version` (revision id للإعدادات النشطة)، وكل مركز يحمل `config_version_at_entry` (نسخة الإعدادات التي دخل بها، تُستخدم لتجميد إعدادات الاستراتيجية على المركز المفتوح)؛ وكل تعديل settings يدخل Audit Trail. **الفصل الإلزامي:** إعدادات *الاستراتيجية والدخول* (`take_profit_pct`, `sizing_mode`, `copy_mode`, عتبات النسخ) **تُجمَّد** على نسخة الدخول للمراكز المفتوحة (reproducibility)، وتُرحَّل صراحةً فقط بقرار config migration. أمّا *طبقات الأمان والخروج* (Kill Switches, Exit Feasibility, تشديد trailing/خفض المخاطر) **فلا تُجمَّد أبداً وتُطبَّق فوراً بأحدث نسخة على كل المراكز** — متّسق مع مبدأ بقاء طبقات الأمان فعّالة دائماً. (الأمان لا يُحبَس مركزٌ على نسخة أضعف منه.)

**7) REAL-LIVE Readiness Checklist (تحذير غير حاجب).** تعرض الواجهة جاهزية: SignerService · KeyManager · AuditTrail · RPCHealthMonitor (green) · ProtocolConstantMonitor (green) · CostPipeline · CalibrationStore · BundleStatusObserver · FailedTransactionClassifier · PositionLifecycleStateMachine · IntentLedger. عند نقص أيٍّ منها → `WARNING_CRITICAL` معروض بوضوح وصدق دون إخفاء المخاطر، **لكن لا يتحوّل إلى gate حاجب** (الانتقال إلى REAL-LIVE قرار المستخدم وحده — §3). وإذا كان `ev_gate_mode = warning_only` يعرض دائماً: `WARNING_CRITICAL: EV gate is warning-only. Profitability gates are not blocking. Hard loss limits remain active.` (تحذير دائم ما دام مفعّلاً، لا لحظي). الغرض: حرية المستخدم دون تشغيل أعمى.

---

## 15.2 نموذج P&L كـ Read-Model خلفي (P&L Read-Model)

> derived/read-only فقط. يحسبه الخلفي (CostPipeline + Position layer)؛ **يُمنع حساب P&L في الواجهة كمصدر حقيقة** (التحقّق في `07-TEST-PLAN.md`). الحقول الناشئة مسجّلة كـ `candidate_*` في `01-SSOT.md`.

- **Realized PnL** — lot-based، FIFO افتراضاً (§2.1)، بالـ USDC، منسوب التكاليف كاملةً (priority/tip/ATA rent/DEX fees/failed-attempt/slippage).
- **Unrealized PnL** — لا يُعرض رقماً إلا مع mark صالح: **unrealized = mark + source + timestamp + confidence + status**. الحالة `status ∈ {valid, stale, unavailable, low_confidence, display_only}`؛ غير `valid` لا يُقدَّم كرقم موثوق.
- **Mark source** (AMM): تفضيل executable/route quote أو liquidity-aware estimate على display price.
- **Fees/Slippage attribution** — `fees_total` و`slippage_cost` منسوبان لكل intent/trade.
- **Paper P&L** — نظير realized/unrealized في فضاء paper، موسوم `simulated` دائماً، ولا يُقدَّم كحقيقة بلا معايرة.
- **تجميعات مشتقّة** — per-wallet · per-copy_mode · per-brain · `remaining_daily_loss_budget`.
- **بناء مرحلي:** realized + paper يدخلان مبكراً؛ unrealized/mark-to-market = vocabulary الآن، بناء/عرض لاحقاً بشرط mark صارم (§06).

## 15.3 نموذج تتبّع الصفقة (Execution Trace)

نموذج أول-درجة فوق pipeline §7 يربط كل صفقة بسلسلة زمنية كاملة (**12 طابعاً**): `observed · discovered · decision_start · decision_end · order_built · risk_decided · signer_requested · signed · sent · landed · filled · closed`، ومنها تُشتقّ خمس فجوات latency: `discovery→decision · build→sign · sign→send · send→landing · landing→fill`. ويحمل: `attempt_count_per_intent` · `fee_per_attempt` · `failed_attempt_cost` · `priority_fee` · `jito_tip` · `entry_slippage_vs_leader` + `entry_slippage_vs_quote` · `provider_attribution` (earliest/confirming) · `failure_origin ∈ {provider, route, signer, risk, liquidity, blockhash, bundle, fill}`. الغرض: تشخيص «أين ضاع الوقت/المال» وفصل فشل البنية عن فشل الاستراتيجية. (يعتمد على IntentLedger §15.1 ولا يكرّره.)

## 15.4 أنماط تشغيل المزوّدين (Provider Operating Modes)

- **`provider_mode ∈ {single, multi}`** — single **وضع مدعوم بقيود**: تحذير blind-spot دائم، وعند فشل المزوّد الوحيد يسقط النظام تلقائياً إلى `EXITS_ONLY` (لا حالة جديدة — يُعاد استخدام آلة الحالات §10).
- **`provider_role ∈ {hot_path, enrichment, research, backup}`** و**`provider_tier ∈ {fast, standard, free, backup}`** — مزوّد البحث المجاني/البطيء معزول عن الـ hot path.
- **Onboarding** — تسجيل مزوّد + إدخال سرّ آمن + اختبار اتصال + role/tier + enable/disable + توصية «أضف مزوّداً ثانياً» (advisory).
- **أمن المفتاح** — بعد الإدخال الأول يُستخدم `provider_key_ref` فقط؛ لا raw key في API/UI/DB/logs/reports/diagnostics/exports (انظر §09). فصل provider health عن strategy failure قائم (§15 RPCHealthMonitor/FailedTransactionClassifier).

## 15.5 طبقة التوصيات (Recommendation Layer — Advisory)

طبقة advisory فوق CalibrationStore: تقترح ولا تقرّر. الأنواع: `slow_provider · low_tip · tp_suggestion · sizing_suggestion · exclude_wallet · add_provider · tp_suitability · time_of_day_regime`. **لا تطبيق تلقائي ولا تعديل strategy/risk/live مباشر**؛ أي تبنٍّ يمرّ: `preview_recommendation_application` → `request_config_update_from_recommendation` → preview → validation → permission → audit → `apply_config_version`. تُبنى بعد امتلاء CalibrationStore ببيانات حقيقية (وإلا التوصيات بلا معنى).

## 15.6 قرار بنية الشارت (Chart Architecture)

تُستخدم **مكتبة احترافية جاهزة** (lightweight-charts افتراضياً لخفّتها ودعم RTL، أو TradingView Charting Library عند الحاجة) — **لا يُبنى chart engine من الصفر**. مصدر الشموع `ohlcv_source` يحمل **provenance** ∈ `{provider, derived_from_swaps, delayed, estimated, executable_route_aware}`؛ display-only لا يُعرض كحقيقة تنفيذ. في أسواق AMM/Pump.fun/PumpSwap **لا order-book/depth** — تُستبدل بـ liquidity-curve / quote-impact / expected-slippage / liquidity-drain؛ depth فقط حيث يدعمه المصدر فعلاً. علامات الشارت تستهلك حقولاً قائمة (TP/SL/leader-vs-our-entry/rejected) ولا تخترع حقول سعر.

## 15.7 امتدادات تحليلات المحفظة (Wallet Analytics Extensions)

توسعة Wallet Intelligence (§7/§8) بمقاييس مشتقّة per-wallet: `net_copyability_rank` (لا raw PnL) · `leader_vs_copier_delta` (بعد fees/slippage/latency) · `is_copycat_flag` · `wallet_behavior_drift_flag` (حسم المؤجَّل سابقاً) · `max_drawdown_if_copied` · `avg_hold_time` · `opportunity_cost_estimate` · `baseline_benchmark_return` (مقابل شراء عشوائي). **يُرفض score مركّب مُعتم للمحفظة** (خطر Goodhart) لصالح مكوّنات شفّافة + ranking. وحماية `duplicate_follow_guard` لنفس wallet/cluster.

---

## 15.8 إزالة عناصر [F] — قدرات مُرقّاة (F-Elimination v1.8, decisions only)

> قرارات معمارية فقط لإزالة كل عناصر `[F]` المتبقّية: لا يبقى «pending/future» غامض. كل عنصر = ✅ترقية الآن · ♻️إعادة صياغة آمنة · ⛔رفض دائم. الأسماء الناشئة `candidate_*` تُسجَّل في `01-SSOT.md` (التفاصيل في API/Data/UX/Test لاحقاً، لا هنا). الثوابت القائمة (Fail-Safe · Hard Risk · عزل Signer · ownership · No field before SSOT) غير متأثّرة.

**F1 · P&L legacy — ♻️إعادة صياغة (تسمية):** الأسماء القديمة غير المسبوقة (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`) **مرفوضة كـ aliases**؛ المسار الرسمي يبقى read-model خلفي مرشّح (§15.2): backend/data فقط · **لا حساب P&L في الواجهة** · **لا P&L على Opportunity/Radar** · unrealized فقط مع mark صالح (source/timestamp/confidence/status) · lot-based/FIFO افتراضاً.

**F2 · Price Taxonomy — ✅ترقية (يوسّع §15.6):** تصنيف صريح للسعر `candidate_price_type ∈ {display, executable_quote, mark, fill, quote}`، وكل سعر يحمل `candidate_price_provenance` + timestamp + status/confidence حيث ينطبق. **السعر الحالي = `candidate_current_mark_view`** (read-view مشتقّ من mark، لا «current_price» مستقل مجهول). في AMM: liquidity-drain / expected-slippage / quote-impact — **لا افتراض order-book**. لا سعر يخترعه UI.

**F3 · Trade Event / Journal — ✅ترقية (يوسّع §15.3):** مفهوم trade-event/journal رسمي مرتبط بـ Execution Trace (نفس الطوابع الزمنية، لا تكرار)؛ أحداث من signal→close/failure مرتبطة بـ intent/position/trade/execution-wallet/leader حيث ينطبق؛ يخدم replay/reports/charts/debugging؛ **بلا تسريب أسرار**.

**F4 · Wallet-Token Performance — ✅ترقية (يوسّع §15.7):** أداء per-(wallet,token) كجزء من اكتشاف Smart Money؛ **point-in-time وsurvivorship-bias-free**؛ net result يحمل **حالة اكتمال التكاليف** (complete/partial/estimated/unavailable) — لا يُعرض كاملاً إن كانت التكاليف ناقصة؛ copyability لا raw profit.

**F5 · Early-buyer / Cluster / Repeat — ✅ترقية (مع ثقة):** هذه استدلالات **احتمالية** تحمل confidence/method/provenance، **ليست حقيقة مطلقة**؛ **لا نسخ أعمى** منها وحدها؛ read-only تشخيصية لا تمنح تنفيذاً.

**F6 · Balances / Sweep — ✅ترقية:** رؤية المحافظ والأموال قدرةٌ منتجية؛ الأرصدة وسجلّ الكنس **مرتبطة بالملكية** (تتّسق مع Position Ownership §4.3) — **لا بيع/كنس من محفظة لا تملك الأصل**؛ تحمل provenance / reconciliation؛ **بلا أسرار/مفاتيح**.

**F7 · Token Identity on Position — ✅ترقية:** `mint`/address **canonical** (مصدر الحقيقة للتنفيذ/المطابقة)؛ symbol/name **عرض/untrusted** بحقول provenance/trust وقد تكون متغيّرة — **ليست execution truth** (منع spoofing، يتّسق مع `name_impersonation_score` §4.4).

**F8 · Leader Attribution on Position — ✅ترقية (يوسّع §4.2):** المراكز المنسوخة تعرف followed-wallet/leader-entity/cluster/signal-source/attribution-confidence حيث ينطبق، مع معالجة تعدّد القادة (يتّسق مع conflict resolution §4.2)؛ تدعم leader-vs-copier؛ **الإسناد لا يمنح execution authority**.

**F9 · Batch Exit — ♻️إعادة صياغة آمنة:** الأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` **مرفوض للأبد**. النموذج الآمن = **preview → request → نوايا خروج per-position**، كلٌّ يمرّ مستقلاً بـ ownership/route/Exit-Feasibility/risk/signer/audit (يتّسق مع §15.1)؛ نتائج per-position؛ **لا mass exit صامت**؛ الطوارئ مُدقَّقة ومُصرَّح بها ولا تتجاوز Hard Risk. **لا يُقبل request إلا بناءً على preview حديث وصالح؛ وإذا انتهت صلاحية الـ preview أو تغيّرت حالة مركز/route/ownership/signer/risk وجب توليد preview جديد** (منع استخدام معلومات stale).

**F10 · Persisted Alerts — ✅ترقية:** قواعد/أحداث/إقرار تنبيهات كقدرة منتجية؛ **`severity` (info/warning/critical) منفصلة عن `category` (security/risk/provider/data/ops/execution/wallet)**؛ **تنبيهات `category=security` مع `severity=critical` غير قابلة للإسكات كتجاوز**؛ بلا تسريب أسرار.

**F11 · Persisted Reports — ✅ترقية:** تعريفات/قوالب/artifacts/سجلّ تصدير محفوظة؛ **لا اختلاق مقاييس مفقودة** (تُوسَم unavailable/pending)؛ redaction + provenance + generation timestamp إلزامية.

**F12 · Persisted Preferences — ✅ترقية:** تفضيلات الواجهة (لغة/اتجاه/وضع/أعمدة/views/filters/إشعارات) قدرةٌ منتجية UI-only؛ **لا تتجاوز config/risk/live/signer** — أي أثر تداولي يمرّ عبر config الرسمي.

**F13 · Persisted Glossary — ♻️إعادة صياغة:** المسرد/المساعدة محتوى **قابل للإصدار** (AR/EN) يربط `source_of_truth_field`، **لا يعيد تعريف SSOT** ولا يضيف أسماء؛ تحرير permissioned وإلا system-managed.

**F14 · Onboarding Progress — ✅ترقية:** تتبّع تقدّم الإعداد (خطوات/إكمال/وضع/لغة/محفظة أولى/مزوّد/paper/تثقيف جاهزية live)؛ **يخزّن حالة الخطوات والمراجع فقط — لا أسرار/raw key/private key/seed/signer credential**؛ provider progress بـ `provider_key_ref` فقط؛ **لا أوامر wallet/config خارج SSOT/API ولا تجاوز readiness gates**.

> **خلاصة F-Elimination:** لم يبقَ عنصر `[F]` غامض. المُرقّى → candidate (مصمَّم، غير منفّذ)؛ المرفوض دائماً → atomic batch-exit + أسماء P&L القديمة غير المسبوقة + symbol/name كحقيقة تنفيذ. كل اسم جديد `candidate_*` بانتظار تثبيت SSOT.

---

## 15.9 ملحق معماري — Wave 1: صدق الربحية والـ Paper (Profit & Paper Truth Architectural Addendum)

> **قرارات معمارية فقط** (مبادئ · تدفّق · قيود · حالات · تبعات). **لا أسماء SSOT نهائية، ولا API contract، ولا Data Model schema هنا.** كل حقل/enum/مقياس جديد يلمّح إليه هذا القسم يحمل وسم **«must be registered in SSOT before API/Data/UX use»**، ولا يُولَّد كاسم `candidate_*` جديد قبل مساره `ARCH → SSOT`. الثوابت القائمة (Fail-Safe · Hard Risk · عزل Signer · accepted≠buy · diagnostics/opportunity read-only · simulated-tagging · mark valid · No field before SSOT) غير متأثّرة. هذا القسم **يوسّع** أقساماً قائمة بالإحالة لا بالتكرار.

**W1-01 · كشف الربح الوهمي ومنع الـ Edge الزائف (Anti-Fake Edge) — يوسّع §15.7 وWallet Intelligence (Pipeline 40%):** الربح **الظاهري** لمحفظة لا يُعدّ edge قابلاً للنسخ إذا نتج عن: self-trading · wash trading · fake volume · linked-wallet circular activity · creator/dev-controlled trading · artificial liquidity/activity loops. الكاشفات موجودة أصلاً (closed-loop wash detector · sybil cluster detector · volume authenticity · blacklist) — الإضافة المعمارية هي **الربط الإلزامي بين الكشف والتقييم**: أي ربح يحمل fake-profit risk **يُوسَم ويُخصَم** من تقييم الـ edge قبل أي ترتيب. درجات تقييم المحفظة (copyability/score المعتمدة في SSOT) **لا ترتفع بسبب ربح وهمي**. تصنيف fake-profit **حاجز ضد الترقية لا معلومة جانبية**، وكل `fake_profit_reason` ينتقل لاحقاً إلى reports/UX (الأسماء/الأعلام must be registered in SSOT before API/Data/UX use). **Invariant:** *“apparent profit is not copyable edge until fake-profit risk is cleared or discounted.”*

**W1-02 · تفكيك مصدر الربح (Profit Source Attribution) — يوسّع §15.7 (`leader_vs_copier_delta`) وCopyability:** ربح المحفظة يُفكَّك معمارياً إلى مصادر: early entry · token selection quality · exit timing · insider/non-copyable information · execution/speed advantage · artificial pump profit · non-repeatable luck/one-off. كل مصدر يُصنَّف **copyable / partially copyable / non-copyable**. الربح الناتج عن insider أو artificial pump أو one-off luck **لا يرفع copyability كـ edge**. هذا التفكيك **شرط مسبق لتوصية النسخ، لا تقرير بعديّ فقط**، ونتيجته تظهر لاحقاً في report/UX (read-model/أسماء must be registered in SSOT before API/Data/UX use). يتّسق مع كون الاستدلالات احتمالية تحمل confidence/provenance (§15.8 F5) ولا تمنح execution authority.

**W1-03 · مكوّنات `token_readiness_score` الشفّافة — يوسّع Token/Market Gate (Pipeline 50%) و§4.4:** `token_readiness_score` **لا يبقى رقماً معتماً**؛ يتكوّن من مكوّنات صريحة: token age · liquidity · route health · volatility · holder risk · creator risk · exit feasibility · slippage risk · migration/graduation state · provider/route reliability · wash/fake activity risk. **كل component له reason، والـ score النهائي explainable.** **component عالي الخطورة يمكنه حجب الجاهزية حتى لو كان الإجمالي جيداً** (veto لا متوسّط فقط). **يُمنع Goodhart-style optimization على score واحد معتم.** أي component جديد must be registered in SSOT before API/Data/UX use.

**W1-04 · محاكاة Paper واقعية (Execution-Aware) — يوسّع §3 (ExecutionAdapter/PAPER) و§15.2 (Paper P&L) و§9 (CostPipeline/CalibrationStore):** Paper Trading **execution-aware لا ideal-only**؛ يحاكي/يحتسب: fees · slippage · priority fees · failed sends · blockhash expiry · route failure · quote staleness · delayed execution · partial/unavailable exit · provider failure · RPC lag · transaction rejection (الآلية قائمة: `execution_simulator` · `FailedTransactionClassifier` · `failed_attempt_cost`/`route_failure_cost`). **Paper P&L يفرّق صراحةً بين gross theoretical P&L و execution-aware simulated P&L.** **ideal-only paper result لا يُقبل كدليل ربحية.** Paper **يسجّل أسباب الفشل لا يخفيها**، وكل نتيجة موسومة `simulated` لا `real`.

**W1-05 · حالات نتيجة الصفقة الورقية (Paper Outcome States) — يوسّع §15.1 (PositionLifecycleStateMachine) و§15.2:** لكل paper trade **outcome state** من الفئات المعمارية: reached_target · exited_with_loss · failed_entry · failed_exit · exit_unavailable · route_failed · expired · rejected_by_policy · still_open · force_closed_by_safety. **لا paper trade مبهم بلا نتيجة.** كل outcome يحتاج لاحقاً reason code وtimestamps (enum/reason code/الطوابع must be registered in SSOT before API/Data/UX use)، وحالات النتيجة **تغذّي التقارير والتجميع** (W1-06).

**W1-06 · قالب تجميع Paper (Paper Aggregation Report) — يوسّع §15.2 وEV diagnostics (Pipeline 65%) وReports (F11 §15.8):** تجميع معماري حسب الأبعاد: wallet · mode · strategy · token class · period. المقاييس: max drawdown · win rate · avg win · avg loss · profit factor · expectancy · median/average hold time · failed trade rate · rejected opportunity count · exit failure rate · slippage impact · latency impact · fees impact. **القواعد:** **لا يخلط Paper مع Real/Live**؛ كل مخرجاته تحمل سياق simulated/reporting؛ **metric مفقود يظهر `unavailable` ولا يُختلق**؛ يدعم مقارنة المحافظ/الاستراتيجيات لكنه **لا يثبت ربحية مستقبلية**. أي مقياس impact جديد must be registered in SSOT before API/Data/UX use.

**W1-07 · مقياس انحراف Paper↔Real — يوسّع Calibration (Pipeline 95%) و§9 (CalibrationStore simulated_* مقابل real_*) وReadiness Checklist (§15.1/UX §13):** مقياس يقارن: simulated vs real لكلٍّ من fill · slippage · exit success · latency · provider reliability. **ارتفاع divergence يطلق warning.** **لا يُضيف هذا gate حاجباً جديداً على قرار المستخدم بالانتقال إلى REAL-LIVE (§3)؛ يغذّي فقط الـ gate الأمني القائم** (Calibration Kill/Pause عند paper-real divergence high). **يجب أن يظهر divergence في التقارير قبل أي ترقية من paper إلى real/live.** الهدف المعماري: **كشف تفاؤل Paper مقابل الواقع.** أسماء المقياس/التقرير must be registered in SSOT before API/Data/UX use.

**W1-08 · قاعدة point-in-time ومنع تسرّب المستقبل (Survivorship/Leakage) — يوسّع §1.1 و§6 (Validation) وWallet Discovery (§15.7):** تقييم المحفظة عند زمن T **يستخدم بيانات ≤ T فقط** — **لا future leakage.** **المحافظ التي فشلت أو اختفت أو ماتت تبقى ضمن العينة التاريخية** (لا survivorship bias). **لا يُكتشف Smart Money بناءً على نتائج حدثت بعد وقت التقييم.** أي ranking أو backtest أو wallet discovery يخالف ذلك **يُعدّ غير صالح** (يتّسق مع §6 «point-in-time/out-of-sample» و§15.8 F4 «point-in-time/survivorship-free»). هذه قاعدة تحقّق (AC) لا تتطلّب حقلاً؛ تثبيتها كاختبار في 07-TEST-PLAN لاحقاً.

> **خلاصة Wave 1 (معماري فقط):** الربح الظاهري ليس edge حتى تُزال/تُخصَم مخاطر الزيف · المصدر غير القابل للنسخ لا يرفع copyability · readiness درجة مفسَّرة لا معتمة (مع veto للمكوّن الخطر) · Paper execution-aware لا مثالي ولا يُخلَط بـ real · لكل paper trade نتيجة صريحة · divergence يكشف تفاؤل Paper · التقييم point-in-time بلا تسرّب أو تحيّز بقاء. **كل اسم/حقل/enum/مقياس مُلمَّح إليه: must be registered in SSOT before API/Data/UX use.**

---

## 15.10 ملحق معماري — Wave 2: الاكتشاف وأمان النسخ (Discovery & Copy Safety Architectural Addendum)

> **قرارات معمارية فقط** (مبادئ · تصنيفات · حدود · invariants · تدفّق · علاقات مخاطر). **لا أسماء SSOT نهائية، ولا API contract، ولا Data Model schema، ولا config defaults تنفيذية هنا.** كل اسم/enum/metric/read-model يلمّح إليه هذا القسم يحمل وسم **«must be registered in SSOT before API/Data/UX/Test/Config use»**. الثوابت القائمة غير متأثّرة (Fail-Safe · Hard Risk · عزل Signer · accepted≠buy · diagnostics/opportunity read-only · No field before SSOT · Wave 1 §15.9). **لا تصنيف/مقياس في هذا القسم يمنح execution authority وحده**؛ القرار يبقى wallet/cluster/signal-led عبر البوابات (§4.4). يوسّع أقساماً قائمة بالإحالة لا التكرار.

**W2-01 · تصنيف المحافظ (Wallet Taxonomy) — يوسّع Wallet Intelligence (40%) و§15.7/§15.9 W1-01:** تصنيف معماري للمحفظة المتبوعة/المرصودة: `smart_money_wallet` (أداء صافٍ مستدام قابل للنسخ بعد التكاليف) · `kol_wallet` (تأثير/تضخيم لا بالضرورة edge قابل للنسخ) · `bot_wallet` (نمط آلي عالي التردّد) · `insider_wallet` (معلومة غير قابلة للنسخ) · `dev_creator_wallet` (محفظة منشئ/مطوّر) · `mev_sniper_wallet` (same-slot/sandwich/سرعة غير قابلة للنسخ) · `copycat_wallet` (ناسخ لا قائد أصلي) · `linked_cluster_wallet` (مرتبطة/عنقودية). **المؤشرات المعمارية:** سلوك same-slot/المطابقة الزمنية · ارتباط العنقود · تكرار قابلية النسخ · ملكية/علاقة المنشئ · أنماط wash/سيولة (تتكامل مع W1-01). **التأثير:** يُغذّي wallet intelligence/copyability؛ و`copycat`/`insider`/`dev`/`sniper` **لا يرفعون copyability تلقائياً**. **التصنيف احتمالي** يحمل confidence/provenance حين تكون الأدلّة غير حاسمة (يتّسق §15.8 F5)، و**low-confidence لا يُعرَض كحقيقة مؤكدة**، ولا يمنح تنفيذاً وحده. **Invariant:** *“wallet profitability is not enough; wallet type and copyability class must be understood before follow/size decisions.”*

**W2-02 · تفاصيل تركّز التوكن (Token Concentration) — يوسّع Token/Market Gate (50%) و§4.4 و§15.9 W1-03:** أبعاد خطر التركّز في العملات الجديدة (Pump.fun/PumpSwap): creator/dev concentration · holder concentration · bundled wallets · linked early buyers · top holder risk · creator previous-launch quality · creator dump behavior · cluster ownership concentration. **التأثير المعماري:** تُغذّي Token/Market Gate و`token_readiness_score`؛ **تركّز عالٍ يمكنه حجب الجاهزية حتى لو كان الإجمالي جيداً** (veto، يتّسق §15.9 W1-03)؛ تركّز creator/dev أو cluster **لا يُعامَل كطلب طبيعي**؛ الأسباب تظهر لاحقاً في risk panel/reports. **لا يُعدّ التوكن جاهزاً إذا كان الخروج غير واقعي** بسبب تركّز الملكية أو سيولة هشّة (يتّسق Exit Feasibility Gate 55%).

**W2-03 · تمييز الـ Pump الطبيعي عن المصطنع (Natural vs Artificial Pump) — يوسّع Signal Detection (20%) و§15.9 W1-01:** تصنيف معماري منفصل عن السعر الخام: `natural_pump` · `artificial_pump_linked_wallets` · `artificial_pump_wash_trading` · `kol_or_bot_amplified_pump` · `creator_dev_manipulated_pump` · `unknown_or_insufficient_evidence`. **القواعد:** التصنيف **منفصل عن السعر الخام**؛ pump طبيعي **لا يعني دخولاً تلقائياً**؛ artificial pump **يخفض readiness/copyability أو يسبّب watch_only/rejection**؛ يحمل reason/confidence لاحقاً؛ يتكامل مع W1-01 fake-profit و wash/fake activity risk. **Invariant:** *ارتفاع السعر وحده ليس دليل demand حقيقي.*

**W2-04 · تنبيه انحراف سلوك المحفظة (Wallet Drift Alert) — يوسّع §15.8 F10 (Alerts) و§4.2 و follow controls:** بعد تفعيل المتابعة، انحراف السلوك (win rate↓ · slippage↑ · exits أبطأ · توكنات أردأ · صار copycat-like/bot-like · انتقل لسلوك insider/dev-like · `copyability_score`↓ · fake-profit risk↑) **يُنتج alert/recommendation** لاحقاً. التوصية ∈ {keep following · reduce size · pause follow · switch to watch_only · require review}. **حدود الأمان:** الـ alert **لا يغلق المراكز تلقائياً · لا يغيّر config وحده**؛ أي pause/reduce يمرّ عبر user/config flow (يتّسق §15.5 advisory + §12 UI isolation)؛ والـ alert **explainable** (سبب واضح).

**W2-05 · سياسة النمط الافتراضي للنسخ (Default Copy Mode Policy) — يوسّع §1.1 (copy_mode):** **`follow_entry_user_exit` هو الافتراضي المعماري الآمن**، و**`full_mirror` وضع متقدّم (Advanced) فقط** يتطلّب enablement صريحاً per-wallet، ويُعرَض لاحقاً بتحذير واضح لأنه ينسخ exits/adds ويزيد التعرّض للسلوك غير القابل للنسخ. **`full_mirror` لا يكون default عاماً ولا يُفعَّل ضمنياً عند إضافة محفظة.** **القيمة الافتراضية التنفيذية (config default) تُحسم لاحقاً في `02-CONFIG-AND-POLICY-SCHEMA.md` بعد مرورها عبر SSOT** — هذا القسم يثبّت **المبدأ والـ safety expectation** فقط، لا قيمة config. **Invariant:** *“new followed wallets must not silently start in full_mirror behavior.”*

**W2-06 · تعلّم جودة المنشئ/العنقود (Creator/Cluster Learning) — يوسّع Token/Market Gate (50%) و§15.5 (Recommendation) و§15.9 W1-08:** جودة creator/cluster **ليست snapshot بل إشارة تعلّم تاريخية**: creator/cluster historical quality · creator dump rate · post-launch survival quality · average exit feasibility · repeated rug/exit-failure behavior · paper/live outcome attribution by creator/cluster · cluster repeat manipulation pattern. **الإشارة توصي** بـ {avoid · watch_only · reduce size · allow small paper · eligible for normal evaluation}. **الحدود:** **لا auto-ban بلا evidence** · low-confidence ليس حقيقة مؤكدة · **يجب الحفاظ على point-in-time عند backtest** (لا تعلّم من المستقبل، يتّسق §15.9 W1-08) · لا تمنح تنفيذاً وحدها.

**W2-07 · مقياس الاختيار المعاكس (Adverse Selection Metric) — يوسّع §intro (copy تفاعلي) و§4.2 (leader-vs-copier) و§15.9 W1-02/W1-07:** يقيس كم edge ضاع لأننا دخلنا **بعد** القائد، وزيادة الانزلاق بسبب التأخّر، وهل نَنسخ أسوأ جزء من الحركة، وهل المحفظة **مربحة لنفسها لا للتابع** بسبب latency/slippage/route/exit feasibility. **المدخلات:** leader-vs-copier delta · `latency_to_copy` · `entry_slippage_vs_leader` · exit timing delta · route/quote degradation · failed/late exits. **التأثير:** يؤثّر على copyability وقد يحوّل المحفظة من follow إلى watch_only/reduce size؛ **لا يخلط ربح القائد بربح التابع.** **Invariant:** *“leader profitability does not imply copier profitability.”*

> **Wave 2 Architectural Invariants (مثبّتة):** (1) نوع المحففظة يُفهَم قبل copyability · (2) نشاط fake/wash/artificial لا يصير edge · (3) تركّز التوكن يمكنه veto للجاهزية · (4) الـ pump ليس demand إلا بدليل طبيعي · (5) drift بعد التفعيل observable وexplainable · (6) `full_mirror` لا يكون default صامتاً أبداً · (7) جودة creator/cluster تاريخية وpoint-in-time · (8) ربحية القائد لا تعني ربحية التابع · (9) adverse selection قد يُفني copyability · (10) **لا شيء من تصنيفات/مقاييس Wave 2 يمنح execution authority وحده** — القرار wallet/cluster/signal-led عبر البوابات. **كل اسم/enum/metric/read-model مُلمَّح إليه: must be registered in SSOT before API/Data/UX/Test/Config use؛ وأي config default (مثل W2-05) يُحسم في 02-CONFIG بعد SSOT.**

---

## 15.11 ملحق معماري — Wave 3: التقارير والصدق (Reports & Honesty Architectural Addendum)

> **قرارات معمارية فقط** (مبادئ تقارير · حدود صدق · invariants · سياق قياس · منع خلط). **لا أسماء SSOT نهائية، ولا API contract، ولا Data Model schema، ولا config defaults، ولا report template IDs نهائية هنا.** كل اسم/metric/report-definition/tag يلمّح إليه هذا القسم يحمل وسم **«must be registered in SSOT before API/Data/UX/Test/Build/Config use»**. الثوابت القائمة غير متأثّرة (Fail-Safe · Hard Risk · عزل Signer · لا UI P&L math · Paper موسوم simulated · §15.9/§15.10). **لا تقرير/مقياس/disclaimer يمنح execution authority وحده · لا خلط Paper/Testnet/Real-Live · لا يُعرَض الأداء السابق/الورقي كضمان ربحية مستقبلية.**

**W3-01 · التقرير اليومي الموحّد (Daily Unified Report) — يوسّع Reports (§15.8 F11) و§15.9 (Paper) و§15.2 (P&L):** واجهة قرار تشغيلية يومية تجمع: Paper · Real/Live · Testnet · rejected opportunities · failed trades · open risk · provider health · config changes · safety/gate state · data-quality issues · major alerts. **القواعد:** موحّد كعرض **لا كحساب مخلوط** — Paper/Real-Live/Testnet في **أقسام منفصلة** بحساباتها؛ أي رقم بلا evidence يظهر **unavailable/insufficient evidence لا صفر**؛ كل قسم يذكر **context (simulated/testnet/real-live)**؛ **لا execution authority**. أي report definition/template ID لاحقاً → SSOT.

**W3-02 · كتالوج تعريفات التقارير (Report Definitions Catalog) — يوسّع §15.8 F11 (`candidate_report_definition`):** النظام يحتاج **قوالب رسمية** لا custom غامضة فقط، تشمل على الأقل: daily unified · per-wallet · per-token · failed-trade · rejected-opportunity · copy-mode · provider · creator/cluster · strategy/mode · paper-aggregation (§15.9 W1-06) · paper-real-divergence (§15.9 W1-07) · net-business-PnL (W3-05) · weekly-comparison (W3-03). **كل تعريف يحدّد:** scope · context · dimensions · metrics · evidence/provenance · missing-metric policy (unavailable لا اختلاق) · disclaimer requirements · Paper/Real separation. custom reports مسموحة لاحقاً **لا تستبدل القوالب الرسمية**. أي template/report ID → SSOT.

**W3-03 · تقرير المقارنة الأسبوعي (Weekly Comparison) — يوسّع Analytics/Reports و§9 (Config Versioning):** يقارن wallets · copy modes · brains · providers · strategies · token classes · configs before/after · paper-vs-real divergence · creator/cluster cohorts · adverse-selection impact. **القواعد:** يساعد القرار **لا يثبت ربحية مستقبلية**؛ before/after config **يحترم `config_version_at_entry`**؛ لا خلط Paper/Real-Live؛ الفروقات المفقودة **unavailable**؛ يُبرز **ما تغيّر ولماذا قد يكون الأداء تغيّر**؛ **لا auto-apply من التقرير**.

**W3-04 · معيار الإخلاء الموحّد (Disclaimer Standard) — يوسّع §15.5 (advisory) و§15.9 (Paper):** يظهر في تقارير Paper/Backtest/Weekly/Recommendation/Promotion: «الأداء السابق لا يثبت ربحية مستقبلية» · «Paper لا يثبت ربحية live» · «Backtest قد يكون غير صالح إن غاب دليل point-in-time» · «النتائج متأثّرة بـ fees/slippage/latency/provider/data quality» · «High confidence ليس يقيناً» · «التوصيات advisory ما لم تمرّ عبر user/config flow صريح». **القواعد:** ليس نصاً زخرفياً — يظهر حين يُحتمَل سوء الفهم؛ **لا يختفي في advanced mode**؛ **ليس بديلاً عن gates**؛ **لا يجعل تقريراً غير صالح صالحاً**. أي نص/label رسمي → UX/SSOT حسب الحاجة.

**W3-05 · سطح الربح التجاري الصافي (Net Business PnL) — يوسّع §15.2 (P&L) و§16 (RPC/Credit Budget) و§15.8 F1:** **طبقة تقارير مشتقّة فوق P&L القائم، ليست بديلاً لـ trade P&L، ولا حقل تكلفة بنية جديد في ARCH.** يعتمد لاحقاً على: trade net P&L · fees/slippage · provider credits/costs · RPC/streaming costs · infra/storage/export/report costs (إن متاحة) · subscription/provider costs (إن قابلة للنسبة). **التكاليف من cost/provider/credit/infra paths القائمة أو التي ستُسجَّل لاحقاً عبر SSOT.** التكلفة غير المتاحة → **unavailable/partial لا صفر**؛ الهدف: قد تكون الصفقات رابحة والعمل ككل خاسراً بعد تكلفة البنية؛ **لا execution authority**؛ لا يُخلَط مع wallet-level P&L بلا توضيح. **Invariant:** *“positive trade P&L does not imply positive business P&L.”*

**W3-06 · وسم `ev_gate_mode=warning_only` التقريري — يوسّع §7 (EV Gate) و Reports:** **وسم تقريري read-only فقط** يظهر في النتائج/التقارير التي حدثت أثناء `warning_only`. **لا يغيّر سلوك EV gate · لا يضعف Hard Risk · لا يضيف execution mode · لا يبرّر قراءة النتائج كأنها اجتازت gate حاجبة.** أي result/report أُنتج أثناء warning-only **يجب أن يكشف هذا السياق**؛ التقرير يميّز بين **blocked/pass gate behavior** و**warning-only advisory behavior**؛ استخدام warning_only **لا يخفي failed EV**؛ **لا report promotion بلا disclosure**. **Invariant:** *“warning_only results must not be presented as clean pass results.”*

> **Wave 3 Architectural Invariants (مثبّتة):** (1) التقارير تُنير القرار **ولا تمنح execution authority** · (2) Paper/Testnet/Real-Live تبقى منفصلة في التقارير · (3) unavailable/insufficient evidence لا يصير صفراً · (4) تعريفات التقارير صريحة لا custom ضمني · (5) الأداء السابق/الورقي/backtest ليس دليل ربحية مستقبلية/حيّة · (6) تقارير التوصيات advisory ما لم تمرّ عبر user/config flow · (7) **positive trade P&L لا يعني positive business P&L** · (8) **warning_only لا يُقدَّم كـ clean pass** · (9) سياق التقرير يكشف simulated/testnet/real-live/warning-only · (10) غياب دليل point-in-time يُبطل ادّعاء الربح التاريخي. **كل اسم/metric/report-definition/tag مُلمَّح إليه: must be registered in SSOT before API/Data/UX/Test/Build/Config use؛ ولا report template IDs نهائية في ARCH.**

---

## 15.12 ملحق معماري — Wave 4: التنفيذ والمزوّدون والبيانات (Execution / Providers + Data Architectural Addendum)

> **قرارات معمارية فقط** (مبادئ · حدود · invariants · علاقات قياس · observability/advisory). **توثيقي بحت في هذه الموجة: لا live/testnet/mainnet · لا runtime/backend/frontend · لا provider keys/connection فعلي · لا execution/provider-connection commands · لا API/Data/SSOT/Config fields · لا provider setup implementation · لا report template IDs نهائية.** كل اسم/metric/state/tag يلمّح إليه هذا القسم يحمل **«must be registered in SSOT before API/Data/UX/Test/Build/Config use»**. الثوابت القائمة غير متأثّرة: **لا تغيير سلوك EV gate · Hard Risk · Risk Gates · SignerService · Fail-Safe-not-Fail-Open · عزل Signer · accepted≠buy** (§5/§7/§4). **لا provider/execution/data-cost/opportunity signal يمنح execution authority وحده · لا خلط Paper/Testnet/Real-Live · أي توصية advisory حتى تمرّ عبر user/config flow.**

**W4-01 · مقارنة Latency للمزوّدين (Provider Latency Comparison) — يوسّع execution trace/provider attribution (§16 pre / slot_lag/RPCHealthMonitor):** قياس latency لكل مزوّد كجزء من provider observability، يفرّق: stream · quote · route · send · confirmation/finality · provider response/error latency. المقارنة best/worst **observability/reporting/advisory** تظهر لاحقاً في reports/ops panels. **latency وحدها ليست execution authority · لا تغيير provider selection تلقائياً دون policy/user/config flow · latency مفقودة → unavailable لا صفر.** **Invariant:** *“fast provider does not imply safe or executable provider.”*

**W4-02 · مراقبة Rate-limit وتكلفة المزوّد (Rate-limit & Provider Cost Monitor) — يوسّع §16 (RPC/Credit Budget) و§15.11 W3-05 (Net Business PnL):** monitor لكل مزوّد: rate limits · quota usage · credit usage · request cost · provider cost per period · cost per trade/report/job (حيث attributable) · throttling/backoff state · provider degradation. **observability/advisory — لا execution authority · لا يخفي أن تكلفة المزوّد قد تجعل business PnL سالباً · يرتبط بـ Net Business PnL (W3-05) دون إعادة تعريفه · attribution مفقود → partial/unavailable لا صفر · لا provider billing fields نهائية الآن.** **Invariant:** *“provider availability and provider affordability are separate signals.”*

**W4-03 · صياغة Fork/Rollback (Fork / Rollback Formalization) — يوسّع provider stream state/finality (§16 pre / EXITS_ONLY §operating-state):** fork/rollback **حالة/حدث finality مستقل لا يُدفَن داخل stream gap**؛ يؤثّر على confidence/finality/readiness/reports؛ أي data مشتقّة أثناء rollback risk تحمل warning/provenance. قد يؤدي لاحقاً إلى degraded/read-only/watch_only/EXITS_ONLY **حسب policy لاحقة لا gate جديد الآن**. **لا تغيير Risk Gates/Hard Risk · لا execution authority من rollback detector · reports تميّز rollback/fork context.** **Invariant:** *“unfinalized or rollback-affected data must not be treated as final truth.”*

**W4-04 · onboarding المزوّدين وتحقّق المفاتيح/الاتصال (Provider Onboarding & Key/Connection Validation) — يوسّع provider setup/capability (§ provider key flow):** يغطّي Helius · Jito · Jupiter · generic RPC/stream provider. يوضّح: role/capability · required key/ref (إن وُجد) · test connection · permission/capability status · rate-limit/cost awareness · health/readiness · common failure reasons. **Jupiter key/connection validation حالة مستقلة صريحة إن استُخدم للـ quotes/routes.** **لا raw keys في ARCH · لا key fields تنفيذية الآن · key material خارج browser/UI/report/export · test connection ليس execution readiness · provider readiness لا يتجاوز signer/risk/admission gates.** **Invariant:** *“provider connection success is not trading readiness.”*

**W4-05 · سياسة تكلفة التخزين وتحذير الاحتفاظ الآمن للبقاء (Storage Cost Policy + Survivorship-Safe Retention Warning) — يوسّع data retention/storage/reports (§ retention/`candidate_storage_usage_metric`):** storage cost حسب data type · retention period · volume · hot/cold/archive tier · report/export artifacts · replay/backtest datasets. **storage pruning لا يجوز أن يكسر point-in-time/survivorship-free analysis**؛ أي حذف/تقليل احتفاظ **يحذّر** إن أثّر على historical wallet discovery · dead/failed/disappeared wallets · replay/backtest validity · audit/trade/accounting records. يرتبط بـ Net Business PnL حيث أمكن · storage cost مفقود → unavailable/partial لا صفر · **لا storage pricing fields نهائية الآن.** **Invariant:** *“cost-saving deletion must not silently create survivorship bias.”*

**W4-06 · إعادة تقييم الفرص المرفوضة وتنبيهها (Rejected Opportunity Re-evaluation & Alert) — يوسّع watch_only/opportunity lifecycle/alerts (§4.4.2 hunt_status · §15.10 W2):** rejected/watch_only يُعاد تقييمها عند تحسّن: liquidity · route health · holder risk · creator risk · pump classification confidence · concentration risk · provider/data quality · exit feasibility. **re-evaluation ينتج alert/recommendation فقط — لا يحوّل rejected إلى buy/execute · لا يفتح position تلقائياً · لا auto-config**؛ يحفظ original rejection reason + new evidence؛ **تحسّن الفرصة لا يثبت edge.** **Invariant:** *“re-evaluated opportunity is not an execution command.”*

**W4-07 · توصية أفضل إعدادات Paper لهذا الأسبوع (Best Paper Settings This Week Advisory) — يوسّع paper reports/recommendations (§15.9 W1 · §15.11 W3-03/W3-04):** يعتمد على **Paper-only results**، **advisory لا auto-apply**؛ يعرض sample size · confidence · time period · mode/strategy/copy_mode · fees/slippage/latency/failure impact · paper-real divergence (إن وُجد) · disclaimer أن paper لا يثبت ربحية live. **لا تغيير config تلقائياً · لا ترويج live بلا gates · عينة صغيرة/ناقصة → insufficient evidence · يميّز best paper settings عن safe live settings.** **Invariant:** *“best paper setting is not a live-ready setting.”*

**W4-08 · حالات فخّ التخرّج (Graduation Trap States) — يوسّع migration/Token Market Gate/Brain handoff (§ migration limbo / MIGRATION_IN_PROGRESS):** token قد يبدو قابلاً للتداول بعد graduation/migration لكن الخروج/السيولة/route health غير آمن. حالات مفاهيمية: graduation_pending · migration_limbo · post_graduation_exit_unsafe · post_graduation_liquidity_fragile · post_graduation_route_unhealthy · post_graduation_watch_only · graduation_trap_confirmed. تؤثّر على readiness/exit feasibility/reports. **لا execution authority · لا gate جديد الآن (سياسة لاحقة) · تظهر في Token Risk/Reports لاحقاً · ترتبط بـ Brain handoff/migration state دون إعادة تعريفه.** **Invariant:** *“graduation is not proof of exit safety.”*

> **Wave 4 Architectural Invariants (مثبّتة):** (1) المزوّد السريع لا يعني آمناً/قابلاً للتنفيذ · (2) توفّر المزوّد وكلفته إشارتان منفصلتان · (3) البيانات غير النهائية/المتأثّرة بـ rollback لا تُعامَل كحقيقة نهائية · (4) نجاح اتصال المزوّد ليس جاهزية تداول · (5) الحذف لتوفير التكلفة لا يخلق survivorship bias صامتاً · (6) الفرصة المعاد تقييمها ليست أمر تنفيذ · (7) أفضل إعداد Paper ليس إعداداً جاهزاً للـ live · (8) التخرّج ليس دليل أمان خروج · (9) **إشارات provider/execution/data-cost لا تمنح execution authority** · (10) غياب دليل cost/latency/provider/storage لا يصير صفراً أو clean status. **كل اسم/metric/state/tag مُلمَّح إليه: must be registered in SSOT before API/Data/UX/Test/Build/Config use؛ لا تغيير EV gate/Hard Risk/Risk Gates/SignerService؛ توثيقي بحت بلا live/runtime/provider activation.**

---

## 15.13 ملحق معماري — Wave 5: التشغيل المحلي والجاهزية (Local Ops & Readiness Architectural Addendum)

> **قرارات معمارية فقط** (مبادئ · حدود · invariants · علاقات تشغيل محلي · ماذا يجب أن يظهر لاحقاً في Local Ops/Health/Settings/Reports). **توثيقي/معماري بحت في هذه الموجة: لا runtime/backend/frontend · لا scripts/launcher/Docker implementation · لا DB migrations · لا CLI/service-control commands · لا restart/shutdown/backup/restore/purge/migration/rollback commands · لا keys/secrets/credentials · لا live/testnet/mainnet activation · لا provider setup implementation.** كل اسم/metric/report/status/field يلمّح إليه هذا القسم يحمل **«must be registered in SSOT before API/Data/UX/Test/Build/Config use»**. الثوابت القائمة غير متأثّرة: **لا تغيير سلوك EV gate · Hard Risk · Risk Gates · SignerService · Fail-Safe-not-Fail-Open · عزل Signer · Audit Everything** (§2/§5/§7). **Local Ops surfaces = observability/operator guidance فقط ما لم يوجد command قائم مصرّح في العقود؛ أي زر صيانة لاحق gated/audited/permissioned لا free action · لا Local Ops status/health/version/log يمنح execution authority · health green لا يعني trading readiness · المفقود unavailable/unknown لا clean.**

**W5-01 · سير التشغيل المحلي UI-first (Local Run UI-first Workflow) — يوسّع local operations/runbook/readiness:** التشغيل المحلي **يُفهَم من الواجهة لا من قراءة الكود**؛ يوضّح: الخدمات المطلوبة · الحالة الحالية · الناقص · الخطوة التالية · أين تظهر logs/health/version-migration-config state. **UI-first لا يحذف runbook بل تشرح الواجهة المسار · لا launcher/scripts/commands فعلية الآن · local run status ليس trading readiness · Local run ready ≠ Real-Live ready · missing service → degraded/unavailable لا clean.** **Invariant:** *“local app running is not trading readiness.”*

**W5-02 · شاشة صحة التشغيل المحلي (Local Ops Health Screen) — يوسّع health/observability (RPCHealthMonitor/SignerService `signer_profile_status` §providers):** لوحة موحّدة تغطّي صحة PostgreSQL · ClickHouse · Redis · API · UI · Stream Ingestion · Decision Engine · SignerService · Provider connectivity/readiness · Job Runner (إن وُجد) · Data quality · Queue/backlog · Config/migration state · Disk/storage pressure · Audit/log pipeline. **read-only/diagnostic في هذه المرحلة · health green لا يعني execution-safe · SignerService health لا يعني permission to sign · Provider health لا يعني trading readiness · أي control/restart لاحق عبر API/SSOT/permission/audit · service unavailable → unavailable/degraded لا stack trace فقط · لا restart buttons/commands الآن.** **Invariant:** *“service health is diagnostic, not execution permission.”*

**W5-03 · معيار logs المشغّل (Operator Logs UX Standard) — يوسّع diagnostics/logs (Audit Trail §2):** logs **مفهومة للمشغّل لا stack traces فقط**؛ كل log مهم يحمل: severity · category · timestamp · service · correlation/request/job id (عند توفّره) · user-facing summary · technical detail (عند الحاجة) · safe next action. **logs تُخفي (redact) الأسرار · raw keys/tokens/secrets ممنوعة في logs/exports/diagnostics · stack trace كـ detail لا الرسالة الوحيدة · warnings لا تختفي في advanced mode · log health لا يمنح execution authority.** **Invariant:** *“operator log clarity must not leak secrets.”*

**W5-04 · حالة الترحيلات والإصدار (Migrations & Version Status) — يوسّع version/migration (MigrationStateMachine/`config_version_at_entry`):** حالة واضحة تغطّي app version · API version · DB schema version · config schema version · contracts/API docs version · current config version · migration status · pending migrations · failed migrations · rollback availability · compatibility status بين app/API/DB/config/contracts. **read-only/diagnostic في هذه الجولة · version mismatch يظهر بوضوح · migration failed لا يظهر clean · current version display لا يعني system readiness · migration state لا يغيّر Risk Gates · لا migration commands/implementation الآن · لا automatic destructive migration · لا rollback command الآن.** **Invariant:** *“version compatibility is a prerequisite signal, not execution authority.”*

**W5-05 · إجراء الترقية والرجوع (Upgrade / Rollback Procedure) — يوسّع upgrade/rollback:** يحافظ على data · config · audit log · migration history · report artifacts · provider refs (بلا كشف أسرار) · local operator settings (حيث آمن). خطة الترقية توضّح preflight checks · backup requirement · migration compatibility · rollback path · blocked conditions · post-upgrade health verification. **rollback لا يفقد audit ولا يغيّر التاريخ · failed upgrade → incident/blocker · لا upgrade/rollback commands الآن · لا automatic destructive rollback · لا secrets في backup/export · upgrade success ليس trading readiness.** **Invariant:** *“upgrade success is not trading readiness.”*

**W5-06 · سياسة أفعال الصيانة الآمنة (Safe Maintenance Actions Policy) — يوسّع maintenance actions/Kill Switches (§Emergency Stop):** تغطّي لاحقاً restart service · safe shutdown · backup · restore · export diagnostics · clear cache · reindex/rebuild projections · migration check · config rollback preview. **لا commands فعلية الآن · أي action لاحق permissioned/audited/previewed (حيث مدمّر/خطر)/blocked (حين unsafe)/explainable/reversible (حيث أمكن).** **shutdown لا يترك intents معلقة · restart لا يتم أثناء active signing أو critical pending intents إلا بسياسة آمنة · backup بلا raw secrets · restore لا يكسر audit/history/config compatibility · clear cache لا يحذف source-of-truth · rebuild projections لا يغيّر سلطة PostgreSQL.** **Invariant:** *“maintenance actions must be safe-by-default, audited, and non-authoritative over source-of-truth.”*

**W5-07 · ربط مصفوفة حالة التنفيذ (Implementation Status Matrix Linkage) — يوسّع implementation status (IMPLEMENTATION_STATUS_MATRIX):** تفرّق الوثائق بين implemented · partially_implemented · documented_only · candidate · not_built · blocked · deprecated. **Status Matrix ليست تقريراً إدارياً بل boundary تمنع قراءة candidate كأنه built · كل Local Ops capability يظهر status واضح · UI لا تعرض candidate كأنها implemented · build/test لاحقاً يتحقّق من status labels · no “documented means built” · status لا يمنح execution authority · unknown → unknown/not_verified لا implemented.** **Invariant:** *“documented capability is not implemented capability.”*

> **Wave 5 Architectural Invariants (مثبّتة):** (1) تشغيل التطبيق محلياً ليس جاهزية تداول · (2) صحة الخدمة تشخيصية لا إذن تنفيذ · (3) وضوح log المشغّل لا يسرّب أسراراً · (4) توافق الإصدار إشارة شرط مسبق لا execution authority · (5) نجاح الترقية ليس جاهزية تداول · (6) أفعال الصيانة safe-by-default/audited/غير سلطوية على source-of-truth · (7) القدرة الموثّقة ليست قدرة مبنية · (8) غياب دليل health/version/migration/log → unavailable/unknown لا clean · (9) **Local Ops status لا يغيّر سلوك EV gate/Hard Risk/Risk Gates/SignerService** · (10) لا فعل Local Ops يتجاوز audit/permissions/source-of-truth. **كل اسم/metric/report/status/field مُلمَّح إليه: must be registered in SSOT before API/Data/UX/Test/Build/Config use؛ توثيقي/معماري بحت بلا runtime/scripts/launcher/commands/migrations/secrets/live.**

---

## 16. نموذج ميزانية الـ RPC والـ Credits (RPC / Credit Budget Model)

**المراقبة بالاشتراكات لا بالـ polling:**
- المنصة **لا تعتمد على HTTP polling** للمراقبة. المراقبة عبر **LaserStream / Yellowstone gRPC / WebSocket subscriptions**، مع احتساب credits / streaming cost حسب نموذج كل مزوّد.
- confirmation الافتراضي عبر `signatureSubscribe` أو stream events. `getSignatureStatuses` كـ **fallback / batch check** فقط، لا polling أساسي.

**واقع التسعير:**
- **لا تفترض 1 request = 1 credit**؛ لكل مزوّد pricing model مختلف (requests، stream bytes، parsed streams...).
- **نموذج مزدوج عند Helius:** credits للـ RPC + **data add-on بتسعير ثابت بالـ TB** للبثّ (LaserStream / Enhanced WebSockets — يبدأ بترتيب ~$400/شهر لـ ~5TB). أي أن تكلفة البثّ تتحدّد بحجم البيانات (stream bytes / TB) لا بالـ credits صرفاً. LaserStream على mainnet من خطة Professional فأعلى. (Helius Sender نفسه بلا استهلاك credits.)
- لا تُقدَّر التكلفة من عدد الـ requests وحده، بل لكل مرحلة في دورة حياة الإشارة: `credits_per_signal` · `credits_per_rejected_signal` · `credits_per_paper_trade` · `credits_per_real_attempt` · `credits_per_filled_trade` · `credits_per_exit` · `credits_per_closed_position`.

**انضباط إعادة المحاولة (Retry):**
- الـ retries ليست spam عشوائي؛ تخضع لـ idempotency + blockhash TTL + duplicate protection + **EV cost check**.
- Helius Sender / Jito قد يقللان retry spam لكن **لا يضمنان landing**.
- Jito Bundle ذرّي إن landed، لكنه **لا يضمن الإدراج** → فحص `getBundleStatuses` إلزامي.

**CreditBudgetTracker:**
```
CreditBudgetTracker {
  provider, method
  credits_used, request_count, stream_bytes
  cost_per_signal, cost_per_attempt
  cost_per_filled_trade, cost_per_closed_position
  monthly_projected_cost
}
```

**الربط بالربحية الحقيقية (Business-Level):**
- `CreditBudgetTracker` يغذّي **`InfrastructurePnL`**.
- **`Net Business PnL` = Trade Net PnL − (Infrastructure / Credit / Stream costs)**. نظام موجب على مستوى الصفقة قد يكون **سالباً على مستوى الأعمال** بعد تكاليف البنية. القبول النهائي والتوسّع يُقاسان على **Net Business PnL**، لا Trade PnL وحده.

---

## 17. خارطة V2 (Future — ليست جزءاً من بناء الـ Core)

تُضاف فقط بعد إثبات edge قابل للقياس: Geographic colocation · multi-region execution nodes · leader-location routing · Worker Wallets Architecture (البداية: single execution wallet + strict concurrency lock) · direct TPU sending · advanced MEV routing (Astralane/Lil-JIT/ACE كـ Execution Research Slots) · full zero-copy decoder optimization. **ملاحظة (1.6):** Jito BAM لم يعد بنداً مستقبلياً — هو واقع mainnet مذكور في §11؛ ما يبقى بحثياً هنا هو **BAM Plugins وACE المخصّصان** كأدوات تنفيذ متقدّمة لا أصل البنية.

---

## ملحق: قواعد النظام الثابتة

لا شراء أعمى · لا نسخ أعمى · لا دخول بلا route خروج · لا دخول إذا التوكن غير آمن · لا دخول إذا السيولة لا تتحمل الحجم · لا دخول عند graduation trap الخطر · لا خروج فقط لأن الحوت خرج (إلا في نمط full_mirror الذي اختاره المستخدم صراحةً للمحفظة) · لا اعتماد على GoPlus/RugCheck وحدها · لا اعتماد على Trojan كعقل · لا Jito Bundle لكل صفقة · لا تعطيل لطبقة الأمان في REAL-LIVE · لا استهداف win rate · **الانتقال إلى REAL-LIVE قرار المستخدم — لا بوابة قبول حاجبة (التداول الورقي اختياري للاسترشاد)** · **الحجم يحدّده المستخدم (دولار/SOL/% من رأس المال) محكوماً بحدود المخاطر فقط** · **لا API call خارجي داخل الـ hot path (cache + async refresh فقط)** · **لا مفاتيح خاصة في الواجهة/اللوقات؛ التوقيع في SignerService معزول** · **لا REAL-LIVE قبل اكتمال Key Management** · **KILLED لا يحبس مركزاً: يسمح بالخروج الطارئ إن كان أأمن** · **لا ACTIVE قبل اكتمال WARMING_UP** · **لا tip يقتل EV (مسقوف بـ EV cap)** · **لا تدخل الـ priors إلا سجلات finalized** · **لا HTTP polling للمراقبة (اشتراكات فقط)** · **الربحية تُقاس على Net Business PnL بعد تكاليف البنية، لا Trade PnL وحده** · **`bundle_id` لا يعني landed (راقب getInflightBundleStatuses ضمن نافذة 5 دقائق)** · **لا بناء order من quote قديم/route hash متغيّر** · **`platformFeeBps = 0` افتراضاً وأي fee تظهر في CostPipeline** · **`failed_attempt_cost` مفصّل حسب سبب الفشل لا رقم عام** · **فحص Token-2022 إلزامي (لا اختياري) على كل mint جديد — Pump.fun يصدر Token-2022** · **لا افتراض رسوم Pump.fun ثابتة — تُقرأ جداول Dynamic Fees live** · **مفتاح Jupiter API إلزامي على api.jup.ag (لا اعتماد على lite-api المُهمَل)** · **الحد الأدنى للـ tip تابع للمزوّد (لا رقم موحّد)** · **transactionSubscribe طريقة مزوّد-محدّدة لا RPC قياسية** · **backfill LaserStream محدود بـ 24 ساعة — تجاوزها → EXITS_ONLY** · **cohort المحافظ خالٍ من تحيّز البقاء point-in-time** · **القياس يُصحَّح على حجم العينة الفعّال لا العدد الخام** · **market impact يُعايَر live (tranche) لا من تاريخ لم نتداول فيه** · **افتراض +1 slot على الأقل في same-slot copy** · **كل أحداث النسخ بعد الدخول تُنفّذ عبر `current_control_brain` الحالي (انظر §4.1/§4.2)** · **كشف الهجرة on-chain فقط (complete=true + migrate + canonical pool)؛ DexScreener ليس مصدر حقيقة، و`real_token_reserves == 0` مساعد لا يؤكّد وحده** · **التحويل (transfer) ليس بيعاً — لا خروج تلقائي عليه، لكن أي transfer out لوجهة غير `known cluster` يُفعّل `disable_new_adds` فوراً (منع زيادة لا بيع)** · **في full_mirror: البيوع تحت `min_mirror_sell_pct` تُراكَم لا تُهمَل** · **لا `break_full_mirror_on_strong_market`: من أراد البقاء يبدّل copy_mode يدوياً** · **rebuy حدث دخول جديد بحجم `sizing_mode` الحالي لا استرجاع للحجم القديم** · **في تضارب المحافظ تغلب إشارة الخطر ما لم تكن إشارة الشراء أقوى بوضوح بالـ score والـ EV** · **protected route يقلّل MEV ولا يضمن landing — البيع عالي الانزلاق لا يُرسَل عبر fallback عادي** · **PAPER استرشادي افتراضاً (`user_enabled_paper_gate = false`)؛ إن فعّله المستخدم فهو قيد ذاتي لا بوابة نظام** · **`ev_gate_mode` افتراضه `strict` (بوابات ربحية حاجبة)؛ و`warning_only` يخفّض بوابات الربحية إلى تحذير فقط ولا يعطّل أي حدّ خسارة أو طبقة أمان صلبة**.
