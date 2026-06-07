# Document 1 — Config & Policy Schema

> **Priority:** 02 — Implementation · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** defaults/validation/mutability

**الدور:** يحدّد القيم الافتراضية وقواعد التحقّق وقابلية التعديل والسلوك لكل حقل إعداد، وتطبيق ConfigVersioning، وتجاوزات per-wallet. **مبني على `ARCHITECTURE.md` (القرار) و`SSOT.md` (الأسماء الرسمية والقيم).**

**الحالة:** مكتملة / موسّعة بعد v1.8 Delta + F-Elimination + Waves 2–5 — الأقسام 1–17 مكتملة ومراجعة. §12 يستهلك SSOT Groups 22–27، و§13 يستهلك SSOT Groups 22–36 كـ candidate policy، و§14 يستهلك SSOT Group 38 / Wave 2، و§15 يستهلك SSOT Group 39 / Wave 3، و§16 يستهلك SSOT Group 40 / Wave 4، و§17 يستهلك SSOT Group 41 / Wave 5. كل إضافات Waves 2–5 تبقى candidate / policy-only إلى حين التثبيت التنفيذي، ولا تمنح execution authority ولا تغيّر EV gate أو Hard Risk أو Risk Gates أو SignerService.

> **Derived/readiness outputs:** `real_live_config_valid` · `config_migration_required` · `validation_status` هي **مخرجات derived/readiness/API مسجَّلة في SSOT (Group 10)**، لكنها **ليست Config fields ولا تُضاف إلى كائنات الإعداد**؛ مخرجات تحقّق/API/UX محسوبة لا إعدادات قابلة للتحرير.

---

## 1. Scope & Ownership (النطاق والملكية)

**Config يملك (حصراً):**
- `default values` — القيمة الافتراضية لكل حقل إعداد.
- `validation rules` — حدود الأرقام، تحقّق الـ enums، تحقّق التبعيات، التركيبات غير الآمنة، warnings مقابل hard rejects.
- `mutability` — هل الحقل قابل للتعديل، ومتى (لا مراكز مفتوحة / مع مراكز مفتوحة / مجمّد على المركز عند الدخول).
- `behavior` — أثر قيمة الإعداد على السلوك، وعلاقتها بإعدادات أخرى.
- `config_versioning application` — تطبيق قواعد الإصدار والتجميد (لا تقريرها — المبدأ مملوك لـ ARCHITECTURE §15.1).
- `per-wallet overrides` — أي إعدادات تُضبط لكل محفظة منسوخة على حدة.

**Config لا يملك:**
- `architectural meaning` — التعريف والقرار المعماري (مملوك لـ `ARCHITECTURE.md`).
- `API contracts` — عقود الطلب/الاستجابة (مملوكة لوثيقة API).
- `UX presentation` — كيف يُعرض الإعداد ويُتفاعَل معه (مملوك لوثيقة UX).
- `database schema` — التخزين والفهارس والعلاقات (مملوك لوثيقة Data Model).

**القاعدة الحاكمة (مستمرّة من SSOT):**
> **Every Config field must already exist in SSOT. No field before SSOT.**
> كل حقل في هذه الوثيقة يطابق `source_of_truth_field` مسجّلاً في `SSOT.md`. إن ظهرت حاجة لحقل إعداد جديد غير مسجّل: **يُوقَف**، يُقرَّر في ARCHITECTURE، يُسجَّل في SSOT، ثم يدخل Config.

**حدود حرجة مثبّتة (من جولات الحسم السابقة):**
- **Hard Risk vs EV:** Config تطبّق التمييز ولا تعيد تقريره. حدود Hard Risk (Group 6) مُلزِمة دائماً ولا يخفّضها `ev_gate_mode = warning_only`؛ عتبات EV (Group 7) تخضع لـ `ev_gate_mode`. التصنيف بالقائمة الصريحة لا باللاحقة (`max_expected_drawdown_pct` عتبة EV رغم بادئة `max_`).
- **تجميد الإصدار vs الأمان (§15.1):** Config تجمّد *إعدادات الاستراتيجية* على `config_version_at_entry` للمراكز المفتوحة، ولا تجمّد *طبقات الأمان والخروج* أبداً (تُطبَّق فوراً بأحدث نسخة). Config تطبّق هذا الفصل ولا تنقضه.
- **مصدر القرارات الأمنية المتخفّية كإعدادات:** قيم مثل `ev_gate_mode = strict` و`user_enabled_paper_gate = false` defaults محكومة بقواعد أمان في ARCHITECTURE، لا إعدادات حرّة؛ تُوسَم `safety_critical` في جدول mutability (§11).

---

## 2. Config Object Model (نموذج كائنات الإعداد)

ثمانية كائنات إعداد. كل كائن يضمّ حقولاً مسجّلة في SSOT حصراً (مع إحالة المجموعة). الحقول التي هي *قراءة/حالة* (Groups 1،3،4-per-position،5) **ليست إعدادات** ولا تدخل هذه الكائنات — يشير إليها Config للسياق فقط.

### 2.1 `global_config` — إعدادات عامة على مستوى النظام
- `user_enabled_paper_gate` (Group 4 · bool · default `false`)
- `ev_gate_mode` (Group 2 · `strict`|`warning_only` · default `strict`)
- `execution_mode` (Group 2 · 6 قيم)

> `operating_state` هو **runtime state** (حالة تشغيل/قراءة)، لا إعداد قابل للتحرير.

### 2.2 `brain_config` — إعدادات العقلين والحجم
- `strategy_brain` (Group 2 · `brain_a`|`brain_b`)
- `sizing_mode` (Group 2 · 3 قيم) · `sizing_value` (Group 8) · `capital_reference` (Group 8)

> `max_entry_slippage_vs_leader` نُقل إلى `per_wallet_config` (يُضبط لكل محفظة). أي default عام له يحتاج حقل SSOT مستقلاً (`default_max_entry_slippage_vs_leader`) — غير موجود الآن، فلا يُخترَع.

### 2.3 `per_wallet_config` — إعدادات كل محفظة منسوخة (overrides)
- `follow_enabled` (Group 8) · `copy_mode` (Group 2) · `take_profit_pct` (Group 2/SSOT)
- `partial_sell_policy` (Group 2) + عتبات `partial_sell_low/medium/high/major_threshold` (Group 8) + `min_mirror_sell_pct`
- `transfer_exit_policy` · `scale_in_policy` · `conflict_resolution` (Group 2)
- `copy_adds_enabled` · `copy_adds_for_follow_entry` (Group 8)
- `max_entry_slippage_vs_leader` (Group 4)
- `rebuy_cooldown` · `whipsaw_window` · `whipsaw_penalty` · `allow_whipsaw_reentry_override` (Group 8)
- Entry/Sizing Filters (Group 19 · toggle · default off): `fast_hunt_window_ms` · `require_pullback` · `chase_guard` · `min_token_readiness` · `max_entry_volatility` · `single_wallet_min_confidence` · `max_liquidity_share_pct`
- Exit Policy (Group 21 · toggle): `stop_loss_pct` · `max_time_in_position`

> **Runtime state لا config** (مكانها Data Model): `cumulative_ignored_sell` (يتراكم أثناء التداول) · `disable_new_adds` (يُفعَّل بأحداث المصفوفة، لا يحرّره المستخدم).

### 2.4 `risk_config` — حدود المخاطر الصلبة (Hard Risk)
- كل حقول Group 6: `max_daily_loss_pct` · `max_daily_loss_usdt` · `max_total_drawdown_pct` · `max_open_positions` · `max_position_size_pct` · `max_token_exposure_pct` · `max_creator_exposure_pct` · `max_cluster_exposure_pct` · `max_correlated_meme_exposure_pct`
- **كلها `safety_critical` ومُلزِمة دائماً.**

### 2.5 `ev_gate_config` — عتبات قبول EV
- كل حقول Group 7: `minimum_net_expectancy` · `minimum_profit_factor` · `minimum_lower_confidence_bound` · `minimum_sample_size` · `minimum_exit_success_rate` · `max_expected_drawdown_pct`
- **تخضع لـ `ev_gate_mode`** (strict تحجب / warning_only تحذير).

### 2.6 `execution_config` — إعدادات التنفيذ
- `execution_mode` (مرجع من global) · `bundle_ttl_slots` (Group 8) · `platform_fee_bps` (Group 8 · default `0`)
- (`platformFeeBps` = external Jupiter alias فقط، لا يُستخدم داخلياً)

### 2.7 `paper_config` — إعدادات الورقي
- `user_enabled_paper_gate` (مرجع من global) — يحدّد إن كان PAPER حاجباً ذاتياً أم استرشادياً.

> لا يُضاف `paper_real_divergence threshold` كإعداد قبل تسجيله رسمياً (ARCHITECTURE → SSOT، مثلاً `max_paper_real_divergence`). `paper_real_divergence` نفسه مؤشّر تشخيصي للعرض، لا إعداد.

### 2.8 `config_versioning` — إصدار الإعدادات
- `config_version` (Group 9) — revision id للإعدادات النشطة (جزء من نظام الإعدادات).
- قواعد الترحيل (migration) والتجميد — تطبيق §15.1.

> `config_version_at_entry` (Group 9) **حقل per-position يُكتب على المركز عند الدخول** (runtime/accounting)، لا إعداد يحرّره المستخدم — مرجع فقط هنا، تخزينه في Data Model.

> **التغطية والتمييز:** الكائنات الثمانية تستوعب حقول *الإعداد القابل للتكوين* في Groups 2،6،7،8،9 + (user_enabled_paper_gate، max_entry_slippage_vs_leader) من Group 4. أمّا **حقول الحالة/القراءة وruntime** فلا تدخل Config: states (Groups 1،5)، events/intents (Group 3)، per-position runtime (`current_control_brain`، `entry_brain`، `market_phase`، `active_exit_route`، `config_version_at_entry`)، وruntime متراكم (`cumulative_ignored_sell`، `disable_new_adds`) — مكانها Data Model. لا حقل إعداد يتيم، ولا حقل runtime مُقحَم كإعداد.

---

## 3. Global Settings (`global_config`)

| field | default | validation | behavior | notes |
|---|---|---|---|---|
| `user_enabled_paper_gate` | `false` (SSOT) | bool | عند `true`: PAPER يصبح قيداً ذاتياً يحجب الدخول حتى اجتياز القبول. عند `false`: PAPER استرشادي لا حاجب | قيد ذاتي يفعّله المستخدم على نفسه، لا بوابة نظام (ARCHITECTURE §3) |
| `ev_gate_mode` | `strict` (SSOT/ARCHITECTURE) | enum: `strict`\|`warning_only` | `strict`: عتبات EV تحجب الدخول. `warning_only`: تتحوّل إلى `WARNING_CRITICAL` بلا حجب | **لا يتجاوز Hard Risk إطلاقاً**؛ `warning_only` يظهر دائماً في Readiness Checklist |
| `execution_mode` | — (user-defined, no SSOT default) | enum: `auto`\|`manual_approval`\|`helius_sender`\|`jito_send`\|`jito_bundle`\|`jupiter_route` | يحدّد مسار/أسلوب التنفيذ | **source الأساسي**؛ `execution_config.execution_mode` مرجع فقط لا نسخة مستقلّة |
| `usdc_quote_enabled` | `false` (SSOT G2) | bool | عند `false` (الافتراضي): توكنات USDC-quoted تُخطّى عبر `rejected_reason = unknown_quote_mint` (fail-safe). عند `true`: يُفعَّل مسار USDC-quoted | يستهلك `usdc_quote_enabled`/`quote_mint` (SSOT G2/G16)؛ **لا يتجاوز Hard Risk/EV gate**؛ السعر يُطبَّع داخلياً إلى USD |

> `operating_state` ليس هنا — runtime state للقراءة لا إعداد.

## 4. Brain Settings (`brain_config`)

| field | default | validation | behavior | notes |
|---|---|---|---|---|
| `strategy_brain` | — (scoping key, not a toggle) | enum: `brain_a`\|`brain_b` | **scoping key** يربط الإعدادات بكل عقل؛ ليس toggle يعطّل عقلاً (لا حقل تعطيل في SSOT). المنصّة تعمل بعقلين حسب السوق/الهجرة | تعطيل عقل يحتاج حقل SSOT مستقلاً (`brain_a_enabled`/`brain_b_enabled`) غير موجود الآن |
| `sizing_mode` | — (user-defined) | enum: `fixed_usd`\|`fixed_sol`\|`pct_of_capital` | يحدّد طريقة حساب حجم الصفقة | يقترن بـ `sizing_value` |
| `sizing_value` | — (user-defined) | number > 0؛ إن `pct_of_capital` فـ ≤ 100 | الرقم المقترن بـ `sizing_mode` | محكوم لاحقاً بـ `max_position_size_pct` (Hard Risk قد يخفّضه لا يرفعه) |
| `capital_reference` | — (user-defined) | required إن `sizing_mode = pct_of_capital` | مصدر رأس المال للنسبة | غير مستخدم في fixed_usd/fixed_sol |

> `max_entry_slippage_vs_leader` في `per_wallet_config` (§5).

## 5. Per-Wallet Config (`per_wallet_config` — overrides لكل محفظة منسوخة)

| field | default | validation | behavior | notes |
|---|---|---|---|---|
| `follow_enabled` | — (required, no implicit default) | must be explicitly set before wallet can be followed | إن لم يُضبط: المحفظة watch-only / غير قابلة للتنفيذ | المحفظة غير executable حتى يُضبط صراحةً |
| `copy_mode` | — (user-defined) | enum: `follow_entry_user_exit`\|`full_mirror` | يحدّد نمط النسخ (§4.2) | يحكم سلوك المصفوفة كله للمحفظة |
| `take_profit_pct` | — (user-defined) | number > 0, pct؛ **required when `copy_mode = follow_entry_user_exit`** | هدف الربح في `follow_entry_user_exit` | **ignored when `copy_mode = full_mirror`** |
| `partial_sell_policy` | follow_entry → `risk_modifier_only` · full_mirror → `proportional_mirror` (ARCHITECTURE) | enum (5 قيم) | كيف يُعامَل بيع المحفظة الجزئي | الافتراضي تابع لـ copy_mode. **توضيح سلوك `tighten_trailing_only`/`whale_sell_risk_modifier` (ARCH §4.2/§10):** whale sell = مُعدِّل خطر لا أمر بيع → يُضيِّق نطاق الـ trailing بدل panic؛ الـ band **volatility-scaled لا fixed %**؛ تهديد عقد مؤكّد (hook upgrade/authority/freeze change/graduation-block dump) يتجاوز الـ trailing إلى مسار الخروج الطارئ. لا قيمة config جديدة (سلوك/AC في BUILD/TEST) |
| `min_mirror_sell_pct` | — (user-defined) | number, pct | عتبة تنفيذ mirror sell؛ البيوع تحتها تُراكَم | يقترن بـ runtime `cumulative_ignored_sell` |
| `partial_sell_low_threshold` | — (user-defined) | number, pct؛ **must satisfy: low < medium < high < major** | عتبة «منخفض الخطر» | قاعدة الترتيب مُلزِمة في validation |
| `partial_sell_medium_threshold` | — (user-defined) | number, pct | عتبة «متوسط الخطر» | — |
| `partial_sell_high_threshold` | — (user-defined) | number, pct | عتبة «مرتفع الخطر» | — |
| `partial_sell_major_threshold` | — (user-defined) | number, pct | عتبة «إشارة خروج كبرى» | — |
| `transfer_exit_policy` | `no_auto_exit` | enum: `no_auto_exit`\|`de_risk_partial`\|`exit_on_transfer` | سلوك المركز عند transfer out | `disable_new_adds` تبقى مُلزِمة لأي transfer غير known_cluster مهما كانت القيمة |
| `scale_in_policy` | follow_entry → `no_add` · full_mirror → `mirror_proportional` | enum: `no_add`\|`mirror_proportional`\|`limited_add`؛ **`limited_add` requires `copy_adds_for_follow_entry = true`** | كيف تُعامَل زيادة المحفظة | `mirror_proportional` صالح أساساً لـ full_mirror · `no_add` افتراضي لـ follow_entry |
| `conflict_resolution` | `risk_signal_wins_by_default` | fixed single value | applies always | **not user-editable** unless ARCHITECTURE later adds alternatives (لا تُعرض كـ dropdown) |
| `copy_adds_enabled` | — (user-defined) | bool | يسمح بـ mirror scale-in في full_mirror | — |
| `copy_adds_for_follow_entry` | — (user-defined) | bool | يسمح بزيادة محدودة في follow_entry | — |
| `max_entry_slippage_vs_leader` | — (user-defined) | number, pct ≥ 0 | تجاوزه → reject/reduce/watch-only | المعادلة في SSOT/§4.2 |
| `rebuy_cooldown` | — (user-defined) | duration ≥ 0 | المدة قبل السماح بـ rebuy | — |
| `whipsaw_window` | — (user-defined) | duration ≥ 0 | الفاصل الذي يُصنّف whipsaw | — |
| `whipsaw_penalty` | — (user-defined) | number | خفض copyability عند whipsaw | — |
| `allow_whipsaw_reentry_override` | — (user-defined) | bool | re-entry فوري رغم whipsaw | override صريح |
| `fast_hunt_window_ms` | — (unset = disabled) | `duration_ms ≥ 0` عند الضبط | انتهاؤها → `hunt_status=expired`/`watch_only`/`rejected_reason=hunt_window_expired` حسب policy | Entry Filter (G19) · trading logic لا paper/backtest schedule ولا REAL-LIVE gate · لا يعفي من `max_entry_slippage_vs_leader` · **لا يوجد per-brain override/default مسجّل في SSOT؛ يبقى per-wallet فقط. إن احتيج override لكل عقل لاحقاً فلا يُفترض، بل يُدخَل كحقل candidate عبر ARCH→SSOT→CONFIG قبل الاستخدام (لا كائن Config تاسع)** |
| `require_pullback` | `false` | bool | منع الدخول دون ارتداد | Entry Filter (G19) · default off = لا أثر |
| `chase_guard` | `false` | bool | منع مطاردة الشمعة المرتفعة | Entry Filter (G19) · default off |
| `min_token_readiness` | — (unset = disabled) | number ضمن نطاق `token_readiness_score`؛ صالح فقط إذا كان scale الحقل المرجعي معروفاً (§10) | عتبة دنيا تقارن `token_readiness_score` (derived) | Entry Filter (G19) · يستهلك حقلاً مشتقاً لا يكتبه |
| `max_entry_volatility` | — (unset = disabled) | `number ≥ 0`؛ صالح فقط إذا كان scale المقياس المرجعي معروفاً (§10) | رفض الدخول عند تذبذب لحظي مرتفع | Entry Filter (G19) |
| `single_wallet_min_confidence` | — (unset = disabled) | number ضمن نطاق الثقة؛ صالح فقط إذا كان scale الثقة معروفاً (§10) | حدّ ثقة للدخول بإشارة محفظة واحدة | Entry Filter (G19) · **threshold يستهلك مخرجات Wallet Intelligence لا score مستقل** |
| `max_liquidity_share_pct` | — (unset = disabled) | `number, pct ∈ (0,100]` | قد **يخفض الحجم أو يرفض الدخول** حسب policy | Entry/Sizing Filter (G19) · **ليس Hard Risk Group 6** · يتعايش مع `max_position_size_pct` ولا يحلّ محلّه |
| `stop_loss_pct` | — (unset = disabled؛ الحضور = تفعيل) | `number > 0, pct` | **triggers exit only** يمرّ عبر Position Manager / Exit Feasibility / route health | Exit Policy (G21) · **ليس Hard Risk** · لا يضمن الخروج في السيولة الرقيقة · لا `stop_loss` toggle منفصل · mutability غير متماثلة (§11 حاشية 4) |
| `max_time_in_position` | — (unset = disabled؛ قيمة مضبوطة = تفعّل time-exit لهذه المحفظة) | `duration ≥ 0` | تجاوزها → time exit عبر Position Manager / Exit Feasibility | Exit Policy (G21) · لا يعتمد على toggle مسجَّل (`time_exit` مجرّد label في §13 لا حقل Config/SSOT) — الحضور = تفعيل · mutability غير متماثلة (§11 حاشية 4) |

> **Runtime لا config:** `cumulative_ignored_sell` · `disable_new_adds` (Data Model).

> **Per-wallet execution eligibility:** المحفظة **غير قابلة للتنفيذ** حتى يُضبط `follow_enabled` صراحةً وتكون الحقول المطلوبة لكل محفظة صالحة (`copy_mode` على الأقل). بدونها: watch-only.

## 6. Risk Settings (`risk_config` — Hard Risk, مُلزِمة دائماً)

| field | default | validation | behavior | notes |
|---|---|---|---|---|
| `max_daily_loss_pct` | — (user-defined) | number > 0, pct | تجاوزه → Daily Loss Kill (KILLED) | Hard Risk |
| `max_daily_loss_usdt` | — (user-defined) | number > 0, usdt | تجاوزه → USDT Loss Kill | Hard Risk · قيمة مطلقة |
| `max_total_drawdown_pct` | — (user-defined) | number > 0, pct | حد drawdown صلب على الحساب | Hard Risk · يختلف عن `max_expected_drawdown_pct` (EV) |
| `max_open_positions` | — (user-defined) | integer > 0 | حد المراكز المتزامنة | Hard Risk |
| `max_position_size_pct` | — (user-defined) | number > 0, pct | حد حجم المركز الواحد | Hard Risk · يسقف `sizing_value` |
| `max_token_exposure_pct` | — (user-defined) | number > 0, pct | حد التعرّض لتوكن | Hard Risk |
| `max_creator_exposure_pct` | — (user-defined) | number > 0, pct | حد التعرّض لمنشئ | Hard Risk |
| `max_cluster_exposure_pct` | — (user-defined) | number > 0, pct | حد التعرّض لكلاستر | Hard Risk |
| `max_correlated_meme_exposure_pct` | — (user-defined) | number > 0, pct | حد تعرّض الميمات المترابطة | Hard Risk |

> **كلها `safety_critical`** — لا يخفّضها `ev_gate_mode = warning_only`. تطبَّق فوراً بأحدث نسخة على كل المراكز (لا تُجمَّد — §15.1).

> **Hard Risk requirement (حاسم):** لا لانهائية ضمنية. **قيمة Hard Risk المفقودة = config غير صالح لـ REAL-LIVE، لا «بلا حدّ».** غياب أي حدّ مخاطرة يجعل تكوين REAL-LIVE غير صالح (لا يمنع الواجهة ولا PAPER، لكن يمنع اعتبار REAL-LIVE config صالحاً). هذا منعٌ لـ default خطير ضمني، لا اختراع default.

## 7. EV / Acceptance Settings (`ev_gate_config` — تخضع لـ `ev_gate_mode`)

| field | default | validation | behavior | notes |
|---|---|---|---|---|
| `minimum_net_expectancy` | — (user-defined) | number؛ يجب > 0 منطقياً | عتبة الـ Net Expectancy بعد التكاليف | EV threshold |
| `minimum_profit_factor` | — (user-defined) | number > 0 | عتبة Profit Factor | EV threshold |
| `minimum_lower_confidence_bound` | — (user-defined) | number | عتبة LCB | EV threshold · يُحسَب على العيّنة الفعّالة |
| `minimum_sample_size` | — (user-defined) | integer > 0 | أدنى حجم عيّنة (فعّال بعد clustering) | EV threshold |
| `minimum_exit_success_rate` | — (user-defined) | number, pct 0–100 | أدنى احتمال نجاح خروج | EV threshold |
| `max_expected_drawdown_pct` | — (user-defined) | number > 0, pct | أقصى drawdown متوقّع من توزيع EV | **EV threshold لا Hard Risk** رغم بادئة `max_` |

> في `strict` تحجب هذه العتبات الدخول؛ في `warning_only` تتحوّل إلى `WARNING_CRITICAL` بلا حجب، **ولا تتجاوز Hard Risk**.

> **EV threshold requirement (حاسم):** قيمة EV المفقودة **لا تعني «EV passed»**. عند `ev_gate_mode = strict`: عتبات EV المفقودة **تحجب الدخول** (لا يمكن تقييم strict بلا قيم). عند `warning_only`: المفقودة تُنتج `WARNING_CRITICAL` وتعطّل EV acceptance scoring بلا ادّعاء نجاح، **ولا تتجاوز Hard Risk**.

---

## 8. Mutability Rules (قواعد قابلية التعديل)

تطبيق §15.1 (ConfigVersioning) لا تقريره. التعديل يقع في أربع فئات:

1. **mutable while no open positions** — معظم إعدادات الاستراتيجية والـ per-wallet: تُعدَّل بحرّية ما دامت لا مراكز مفتوحة على المحفظة/النظام.
2. **frozen per-position at entry** — إعدادات الاستراتيجية والدخول (`copy_mode`, `take_profit_pct`, `sizing_mode`/`sizing_value`, عتبات النسخ، `partial_sell_policy`, `scale_in_policy`, `transfer_exit_policy`) تُجمَّد على `config_version_at_entry` للمركز المفتوح؛ تعديلها يطبَّق على المراكز الجديدة فقط، أو يحتاج config migration صريحاً للمراكز القائمة.
3. **applied immediately (never frozen)** — طبقات الأمان والخروج وحدود Hard Risk (`risk_config` كاملاً) + Kill Switches + Exit Feasibility + تشديد trailing/خفض المخاطر: تُطبَّق فوراً بأحدث نسخة على **كل** المراكز بما فيها المفتوحة. **الأمان لا يُجمَّد على نسخة أضعف.**
4. **requires config migration** — تعديل إعداد استراتيجية مجمّد ليسري على مركز مفتوح قائم: يحتاج قرار config migration صريحاً يدخل Audit Trail.

> **القاعدة الفاصلة:** أمان فوري دائماً · استراتيجية مجمّدة على الدخول · لا تجميد يحبس مركزاً على أمان أضعف.

## 9. Config Versioning (`config_versioning`)

| field | default | validation | behavior | notes |
|---|---|---|---|---|
| `config_version` | يُولَّد تلقائياً | revision id (integer monotonic أو immutable hash — يحدّده التنفيذ) | يتغيّر مع كل تعديل settings؛ كل تعديل يدخل Audit Trail | revision للإعدادات النشطة |

**قواعد الإصدار:**
- المراكز الجديدة تأخذ `config_version` الحالية في `config_version_at_entry`.
- المراكز المفتوحة تبقى على `config_version_at_entry` لإعدادات الاستراتيجية (frozen)، وتطبّق آخر نسخة لطبقات الأمان (immediate).
- ترقية مركز مفتوح لنسخة أحدث = config migration صريح، مُسجَّل.
- `config_version_at_entry` حقل **per-position runtime/accounting** (Data Model)، لا إعداد.

## 10. Validation Rules (قواعد التحقّق)

**أنواع التحقّق:**
- **numeric bounds:** كل `_pct` ضمن نطاق نسبة معقول (> 0، والنسب المئوية ≤ 100 حيث ينطبق)؛ `_usdt` > 0؛ المدد ≥ 0؛ الأعداد الصحيحة (`max_open_positions`, `minimum_sample_size`) > 0.
- **enum validation:** كل حقل enum يُقبل فقط من قيمه المسجّلة في SSOT (لا قيم خارجها، لا aliases مرفوضة).
- **dependency validation:** `take_profit_pct` required إذا `copy_mode = follow_entry_user_exit` ومتجاهَل إذا `full_mirror` · `scale_in_policy = limited_add` يتطلّب `copy_adds_for_follow_entry = true` · `capital_reference` required إذا `sizing_mode = pct_of_capital` · عتبات البيع الجزئي: `low < medium < high < major`.
- **unsafe combinations (hard reject):** غياب أي حدّ Hard Risk → config **غير صالح لـ REAL-LIVE** (لا لانهائية ضمنية) · `follow_enabled` غير مضبوط → المحفظة watch-only لا قابلة للتنفيذ.
- **warnings vs hard rejects:** عتبات EV المفقودة → في `strict` hard reject (تحجب الدخول)؛ في `warning_only` → `WARNING_CRITICAL` بلا ادّعاء EV-pass، **لا تتجاوز Hard Risk** · `ev_gate_mode = warning_only` نفسه → `WARNING_CRITICAL` دائم في Readiness.
- **New-Coin Hunting filters (G19/G21) — numeric bounds:** `fast_hunt_window_ms` `duration_ms ≥ 0` · `max_liquidity_share_pct` `pct ∈ (0,100]` · `stop_loss_pct` `pct > 0` · `max_time_in_position` `duration ≥ 0` · `require_pullback`/`chase_guard` bool · `min_token_readiness`/`max_entry_volatility`/`single_wallet_min_confidence` أرقام ضمن نطاق الحقل المرجعي.
- **optional / default-disabled:** التسعة كلها اختيارية؛ unset = disabled/no-effect؛ **غيابها لا يؤثّر على `real_live_config_valid`** (ليست Hard Risk).
- **derived-scale rule:** عتبة `min_token_readiness`/`single_wallet_min_confidence`/`max_entry_volatility` صالحة **فقط إذا كان scale الحقل/النموذج المرجعي معروفاً ومتوافقاً في runtime/schema**؛ إذا كان مجهولاً/غير متاح → **never silent pass**: السلوك reject/watch-only/warning حسب policy.
- **activation:** `stop_loss_pct` الحضور = تفعيل (لا toggle منفصل) · `max_time_in_position` قيمة مضبوطة = تفعّل time-exit لهذه المحفظة (لا يعتمد على toggle مسجَّل).
- **blocking:** فلاتر الدخول «when enabled as config filter» (reject/watch_only/reduce size) · `stop_loss_pct`/`max_time_in_position` «triggers exit only» عبر Exit Feasibility/route health · **لا شيء منها Hard Risk ولا يحجب REAL-LIVE**.

> **Derived/readiness outputs:** `real_live_config_valid` · `config_migration_required` · `validation_status` هي **مخرجات derived/readiness/API مسجَّلة في SSOT (Group 10)**، لكنها **ليست Config fields ولا تُضاف إلى كائنات الإعداد**؛ مخرجات تحقّق/API/UX محسوبة لا إعدادات قابلة للتحرير.

## 11. Unified Mutability Matrix (المصفوفة الموحّدة)

`mutable_when_open` = هل يُعدَّل والمركز مفتوح · `applies_to_existing` = هل يسري على المراكز القائمة · `safety_critical` = حدّ أمان/خسارة لا يُخفَّض بـ warning_only.

| field | scope | default | mutable_when_open | applies_to_existing | safety_critical | source_of_truth_field |
|---|---|---|---|---|---|---|
| `user_enabled_paper_gate` | global | `false` | yes | n/a | no | `user_enabled_paper_gate` |
| `ev_gate_mode` | global | `strict` | yes | yes (gating) | partial¹ | `ev_gate_mode` |
| `execution_mode` | global | — | yes | new entries | no | `execution_mode` |
| `strategy_brain` | brain | — (scoping key) | n/a | n/a | no | `strategy_brain` |
| `sizing_mode` | brain | — | frozen at entry | new entries | no | `sizing_mode` |
| `sizing_value` | brain | — | frozen at entry | new entries | no | `sizing_value` |
| `capital_reference` | brain | — | frozen at entry | new entries | no | `capital_reference` |
| `follow_enabled` | per-wallet | — (required) | yes | yes³ | no | `follow_enabled` |
| `copy_mode` | per-wallet | — | frozen at entry | new entries | no | `copy_mode` |
| `take_profit_pct` | per-wallet | — | frozen at entry | new entries | no | `take_profit_pct` |
| `partial_sell_policy` | per-wallet | تابع لـ copy_mode | frozen at entry | new entries | no | `partial_sell_policy` |
| `min_mirror_sell_pct` | per-wallet | — | frozen at entry | new entries | no | `min_mirror_sell_pct` |
| `partial_sell_low_threshold` | per-wallet | — | frozen at entry | new entries | no | `partial_sell_low_threshold` |
| `partial_sell_medium_threshold` | per-wallet | — | frozen at entry | new entries | no | `partial_sell_medium_threshold` |
| `partial_sell_high_threshold` | per-wallet | — | frozen at entry | new entries | no | `partial_sell_high_threshold` |
| `partial_sell_major_threshold` | per-wallet | — | frozen at entry | new entries | no | `partial_sell_major_threshold` |
| `transfer_exit_policy` | per-wallet | `no_auto_exit` | frozen at entry | new entries | no² | `transfer_exit_policy` |
| `scale_in_policy` | per-wallet | تابع لـ copy_mode | frozen at entry | new entries | no | `scale_in_policy` |
| `conflict_resolution` | per-wallet | `risk_signal_wins_by_default` | fixed | fixed | no | `conflict_resolution` |
| `copy_adds_enabled` | per-wallet | — | frozen at entry | new entries | no | `copy_adds_enabled` |
| `copy_adds_for_follow_entry` | per-wallet | — | frozen at entry | new entries | no | `copy_adds_for_follow_entry` |
| `max_entry_slippage_vs_leader` | per-wallet | — | frozen at entry | new entries | no | `max_entry_slippage_vs_leader` |
| `rebuy_cooldown` | per-wallet | — | frozen at entry | new entries | no | `rebuy_cooldown` |
| `whipsaw_window` | per-wallet | — | frozen at entry | new entries | no | `whipsaw_window` |
| `whipsaw_penalty` | per-wallet | — | frozen at entry | new entries | no | `whipsaw_penalty` |
| `allow_whipsaw_reentry_override` | per-wallet | — | frozen at entry | new entries | no | `allow_whipsaw_reentry_override` |
| `fast_hunt_window_ms` | per-wallet (لا per-brain في SSOT) | — | frozen at entry | new entries | no | `fast_hunt_window_ms` |
| `require_pullback` | per-wallet | `false` | frozen at entry | new entries | no | `require_pullback` |
| `chase_guard` | per-wallet | `false` | frozen at entry | new entries | no | `chase_guard` |
| `min_token_readiness` | per-wallet | — | frozen at entry | new entries | no | `min_token_readiness` |
| `max_entry_volatility` | per-wallet | — | frozen at entry | new entries | no | `max_entry_volatility` |
| `single_wallet_min_confidence` | per-wallet | — | frozen at entry | new entries | no | `single_wallet_min_confidence` |
| `max_liquidity_share_pct` | per-wallet | — | frozen at entry | new entries | no | `max_liquidity_share_pct` |
| `stop_loss_pct` | per-wallet | — | asymmetric⁴ | tighten: immediate (audited) · loosen: new/migration⁴ | no | `stop_loss_pct` |
| `max_time_in_position` | per-wallet | — | asymmetric⁴ | tighten: immediate (audited) · loosen: new/migration⁴ | no | `max_time_in_position` |
| `max_daily_loss_pct` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_daily_loss_pct` |
| `max_daily_loss_usdt` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_daily_loss_usdt` |
| `max_total_drawdown_pct` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_total_drawdown_pct` |
| `max_open_positions` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_open_positions` |
| `max_position_size_pct` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_position_size_pct` |
| `max_token_exposure_pct` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_token_exposure_pct` |
| `max_creator_exposure_pct` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_creator_exposure_pct` |
| `max_cluster_exposure_pct` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_cluster_exposure_pct` |
| `max_correlated_meme_exposure_pct` | risk | — (required) | yes | **yes (immediate)** | **yes** | `max_correlated_meme_exposure_pct` |
| `minimum_net_expectancy` | ev_gate | — | yes | gating | partial¹ | `minimum_net_expectancy` |
| `minimum_profit_factor` | ev_gate | — | yes | gating | partial¹ | `minimum_profit_factor` |
| `minimum_lower_confidence_bound` | ev_gate | — | yes | gating | partial¹ | `minimum_lower_confidence_bound` |
| `minimum_sample_size` | ev_gate | — | yes | gating | partial¹ | `minimum_sample_size` |
| `minimum_exit_success_rate` | ev_gate | — | yes | gating | partial¹ | `minimum_exit_success_rate` |
| `max_expected_drawdown_pct` | ev_gate | — | yes | gating | partial¹ | `max_expected_drawdown_pct` |
| `bundle_ttl_slots` | execution | — | yes | new sends | no | `bundle_ttl_slots` |
| `platform_fee_bps` | execution | `0` | yes | new sends | no | `platform_fee_bps` |
| `config_version` | versioning | auto | n/a | n/a | no | `config_version` |

**حواشٍ:**
1. **partial¹ (EV):** ليست Hard Risk، لكنها بوابة دخول في `strict`؛ `warning_only` يخفّضها لتحذير. تخضع لـ `ev_gate_mode`، لا تُخفَّض حدود الخسارة معها.
2. **no² (transfer_exit_policy):** ليست safety_critical كقيمة، لكن `disable_new_adds` المرتبطة بالتحويل تبقى مُلزِمة runtime مهما كانت القيمة.
3. **yes³ (follow_enabled):** تعطيله يمنع الدخول الجديد والإضافات الجديدة لتلك المحفظة. **لا يُجبر إغلاق المراكز القائمة** — تبقى محكومة بـ Position Manager وقواعد الخروج وHard Risk. (`follow_enabled = false` يوقف النسخ الجديد، لا يساوي أمر خروج.)
4. **asymmetric⁴ (Exit Policy — `stop_loss_pct` · `max_time_in_position`):** القيمة الأساسية تُسجَّل عند الدخول لأغراض reproducibility. **التشديد/de-risk** (تضييق الوقف / تقصير المدّة) يجوز تطبيقه **فوراً على المراكز المفتوحة مع audit** (اتّساقاً مع فئة 3 §8). **التخفيف/زيادة المخاطر** (توسيع الوقف / إطالة المدّة) يطبَّق على **المراكز الجديدة فقط أو يحتاج config migration صريحاً**. كلاهما **ليس Hard Risk**، وكل أمر خروج يمرّ عبر Position Manager / Exit Feasibility / route health.

> **Runtime/state (ليست في المصفوفة — Data Model لا Config):** `operating_state` · `position_state` · `migration_phase` · `current_control_brain` · `entry_brain` · `market_phase` · `active_exit_route` · `cumulative_ignored_sell` · `disable_new_adds` · `config_version_at_entry`.

---

## 12. v1.8 Delta — Config Additions (candidate, تستهلك SSOT Groups 22–27)

> أسماء `candidate_*` بانتظار التثبيت بعد ARCH→SSOT. لا تغيّر هذه الإضافات أي Hard Risk ولا تُضعف بوابة أمان. كلها تخضع لقواعد §8 (Mutability) و§10 (Validation) القائمة.

### 12.1 P&L / Cost-basis
- `candidate_cost_basis_method` — enum: `fifo` (افتراضي) · `average`. **safety_critical: no**؛ يؤثّر على حساب realized فقط (Read-Model خلفي، ARCH §15.2). تغييره يكتب config version جديدة ولا يُعاد احتساب سجلّات finalized بأثر رجعي إلا عبر migration صريح.

### 12.2 Retention / Export (القيم التشغيلية في 08-RUNBOOK)
- `candidate_retention_profile` — enum: `30d` · `90d` · `180d` · `custom`. القيم الافتراضية تُحدَّد في RUNBOOK لا هنا. **purge لا يحذف audit المالي** (يُنفَّذ عبر `candidate_cmd_purge_data` admin/local-ops).
- `candidate_export_format` — enum: `markdown` · `csv` · `parquet` · `jsonl`.

### 12.3 Providers (ARCH §15.4)
- `candidate_provider_mode` — enum: `single` · `multi` (الافتراضي `multi`). في `single`: تحذير blind-spot دائم + سقوط تلقائي إلى `EXITS_ONLY` عند فشل المزوّد (لا حالة جديدة).
- `candidate_provider_role` — enum: `hot_path` · `enrichment` · `research` · `backup`.
- `candidate_provider_tier` — enum: `fast` · `standard` · `free` · `backup`. مزوّد `research`/`free` معزول عن hot path.
- المفاتيح: تُخزَّن كـ `candidate_provider_key_ref` (مرجع سرّ) فقط — لا raw key في config (انظر 09-THREAT-SECURITY).

### 12.4 Copy / Exit
- `candidate_duplicate_follow_guard` — field (per-wallet/global): `on` افتراضاً؛ يمنع متابعة مكرّرة لنفس wallet/cluster.
- **Exit templates/presets (اختياري):** طبقة presets فوق `stop_loss_pct`/`take_profit_pct`/`max_time_in_position` القائمة؛ **الافتراضي يبقى `take_profit_pct` بسيطاً**. لا حقول خروج جديدة تتجاوز Exit Feasibility/route health.

### 12.5 Reports / Recommendations
- `candidate_report_template_id` — enum: `trade_evaluation` · `failure_analysis` · `custom`.
- **Recommendation Layer = advisory (ARCH §15.5):** لا إعداد يطبّق توصية تلقائياً. أي تبنٍّ يمرّ عبر تدفّق config الرسمي (`preview_config_update` → validation → `update_config` → config version) — لا auto-mutation لـ strategy/risk/live.

### 12.6 Paper (تأكيد لا تغيير)
- `user_enabled_paper_gate` يبقى `false` افتراضاً (PAPER استرشادي؛ إن فعّله المستخدم فهو **قيد ذاتي** لا بوابة نظام). Strategy Sandbox / A-B **paper-only** ولا يعدّل live/risk/signer/execution config.

---

## 13. F-Elimination — Config Additions (candidate, تستهلك ARCH §15.8 + SSOT Groups 22–36)

> defaults/validation/mutability/policy فقط — لا data schema · لا API endpoints · لا UX screens. الحقول الـ data-level مسجّلة في SSOT (Groups 22–35). **مفاتيح السياسة في هذا القسم مسجّلة في SSOT Group 36 وتبقى `candidate_*` config-versioned؛ لا تُحوَّل إلى implemented ولا تتجاوز Hard Risk/signer/live.**

### 13.1 P&L / Cost-basis (F1)
- `candidate_cost_basis_method` — default `fifo` · allowed `fifo`/`average` · **config-versioned**؛ التغيير يؤثّر على الحسابات المستقبلية فقط. **سجلّات P&L التاريخية finalized لا تُكتب فوقها افتراضياً؛ أي إعادة احتساب تُنتَج كـ report/artifact منفصل مُدقَّق له `config_version` وprovenance وgenerated_at ووسم واضح، ولا يعدّل السجلّات finalized إلا عبر migration مستقبلي مُعتمَد منفصلاً.**
- حقول P&L **ليست config قابلة لتحرير المستخدم** (read-model خلفي).
- legacy مرفوضة: `realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`. **Opportunity/Radar بلا P&L config.**

### 13.2 Price / Mark display policy (F2)
- `candidate_price_status_display_policy` — allowed `show_valid_only`/`show_with_warning`/`hide_unavailable` · default `show_valid_only`.
- `candidate_mark_price_source_preference` — allowed `executable_quote_first`/`route_quote_first`/`liquidity_estimate_first`/`display_last` · default `executable_quote_first`.
- لا `candidate_current_price`. `candidate_current_mark_view` = display/read-view لا يُضبَط كمصدر حقيقة. **display-only لا يُستخدم لقرار تنفيذ.**

### 13.3 Wallet-token cost completeness (F4)
- `candidate_wt_cost_completeness_display_policy` — allowed `complete_only`/`show_estimated_with_warning`/`show_all_with_badges` · default `show_estimated_with_warning`.
- `candidate_wt_net_result` لا يُعرض «كاملاً» إلا إذا `candidate_wt_cost_completeness_status=complete`؛ **partial/estimated/unavailable يجب كشفها للـ API/UX كـ status/badge إلزامي عند تحديث تلك الوثائق؛ CONFIG لا يسمح بتقديمها كـ complete**؛ لا ranking أعمى بنتيجة ناقصة.

### 13.4 Early-buyer / Cluster / Repeat (F5)
- `candidate_cluster_confidence_min` — **default `0.8`** · allowed `0.0–1.0`.
- `candidate_cluster_usage_policy` — allowed `diagnostic_only`/`ranking_weight`/`block_only_when_confirmed` · default `diagnostic_only`.
- **هذه الإشارات لا تخوّل تنفيذاً وحدها؛ cluster احتمالي؛ low-confidence لا يُعامَل كـ known cluster.**

### 13.5 Balances / Sweep (F6)
- `candidate_balance_reconciliation_required` — default `true`.
- `candidate_profit_sweep_confirmation_required` — default `true` (للكنس اليدوي/بمبادرة المستخدم).
- `candidate_auto_sweep_enabled` — default `false`.
- **لا كنس من محفظة لا تملك الأصل · لا raw key/secret في config الأرصدة/الكنس · يحترم `profit_sweep_policy` القائم · mismatch يحجب الكنس ويعرض تحذيراً ولا يخترع أرصدة.**

### 13.6 Token identity display (F7)
- `candidate_token_identity_display_policy` — allowed `mint_required`/`symbol_with_trust_badge`/`hide_untrusted_symbol` · default `symbol_with_trust_badge`.
- **mint canonical · symbol/name display/untrusted · `spoof_suspected` يعرض تحذيراً ولا يصير execution truth.**

### 13.7 Leader attribution (F8)
- `candidate_attribution_confidence_min` — **default `0.8`** · allowed `0.0–1.0`.
- `candidate_multi_leader_attribution_policy` — allowed `show_all`/`primary_plus_conflicts`/`hide_low_confidence` · default `primary_plus_conflicts`.
- **الإسناد لا يخوّل تنفيذاً (تحليل/تقرير/trace فقط)؛ التعارض لا يُطوى صامتاً.**

### 13.8 Batch exit orchestration (F9)
- `candidate_batch_exit_preview_ttl_ms` — **required · default `10000` ms**.
- `candidate_batch_exit_max_positions` — **required · default `10`**.
- `candidate_batch_exit_requires_confirmation` — default `true`.
- `candidate_batch_exit_allow_partial_submission` — default `true` (للمؤهّلة فقط).
- **`exit_all_positions`/`batch_exit_all_positions` الذرّيان مرفوضان للأبد · request يتطلّب `candidate_batch_exit_preview_id` · يُرفَض إن انتهت صلاحية/تقادَم الـ preview · كل مركز نيّة مستقلّة تمرّ ownership/route/feasibility/risk/signer/audit · لا mass exit صامت.**

### 13.9 Alerts (F10)
- `candidate_alert_severity_policy` · `candidate_alert_delivery_preferences` · `candidate_alert_ack_required_for` (يشمل security+critical افتراضاً).
- `candidate_alert_severity`: info/warning/critical · `candidate_alert_category`: security/risk/provider/data/ops/execution/wallet.
- **security + critical لا تُسكت كتجاوز؛ التفضيلات لا تكتم تنبيهات الأمان/المخاطر الحرجة الإلزامية.**

### 13.10 Reports / Exports (F11)
- `candidate_export_format` — allowed `markdown`/`csv`/`parquet`/`jsonl`.
- `candidate_report_template_id` — allowed `trade_evaluation`/`failure_analysis`/`custom` (قائم).
- `candidate_report_redaction_policy` — default `strict`.
- `candidate_report_missing_metric_policy` — allowed `show_unavailable`/`omit`/`block_report` · default `show_unavailable`.
- **التقارير لا تخترع مقاييس · التصدير بلا أسرار · raw provider keys/private keys/seeds/signer credentials/partial secrets غير قابلة للتصدير أبداً · report artifacts تتطلّب provenance وgenerated_at كـ requirement على API/Data؛ CONFIG لا يسمح بـ artifact تقرير بلا دلالات provenance/timestamp.**

### 13.11 Preferences (F12)
- `candidate_pref_language` (ar/en) · `candidate_pref_direction` (rtl/ltr) · `candidate_pref_mode` (beginner/advanced) · visible columns/saved views/saved filters/notification preferences (تفضيلات مستخدم).
- **التفضيلات ليست trading config · لا تتجاوز risk/live/signer/config · تغيير تفضيل لا يعدّل strategy/risk config.**

### 13.12 Glossary (F13)
- `candidate_glossary_edit_policy` — allowed `system_managed`/`admin_editable` · default `system_managed`. locale يدعم ar/en.
- **المسرد يربط SSOT ولا يعيد تعريفه · محتوى/مساعدة لا config تنفيذي.**

### 13.13 Onboarding progress (F14)
- `candidate_onboarding_store_progress` — default `true`. يستخدم `candidate_ob_selected_mode`/`_provider_setup_progress`/`_paper_setup_progress`/`_live_readiness_education_progress`.
- **يخزّن حالة الخطوات والمراجع فقط — لا raw provider key/private key/seed/signer credential/partial secret · provider progress عبر `candidate_provider_key_ref` بعد التسجيل · لا تجاوز readiness gates ولا أوامر خارج SSOT/API.**

### 13.14 Provider key flow (تأكيد)
- raw provider key يُقبل فقط عبر secret flow آمن؛ بعد التسجيل **config يشير إلى `candidate_provider_key_ref` فقط**؛ **لا raw key في config files/browser state/reports/exports/logs/diagnostics/backups.**

### 13.15 يبقى مرفوضاً (CONFIG)
لا `buy_opportunity`/`execute_opportunity`/`submit_opportunity` · لا Radar/accepted execution authority · لا `candidate_current_price` · لا `exit_all_positions`/`batch_exit_all_positions` الذرّيان · لا persistence لـ raw provider key · لا UX P&L math · لا Opportunity/Radar P&L · لا order-book في AMM · لا guaranteed stop loss.

---

## 14. Wave 2 — Discovery & Copy Safety Config Policies (candidate, تستهلك ARCH §15.10 + SSOT Group 38)

> **defaults / validation / mutability / policy behavior فقط** — لا Architecture meaning · لا SSOT naming · لا API/Data/UX/Test/Build · لا runtime · لا migrations فعلية. كل config field مسجّل في **SSOT Group 38** (أو اسم قائم). **لا تصنيف/مقياس (taxonomy/pump/concentration/drift/learning/adverse-selection) يمنح execution authority وحده · لا auto-ban · لا auto-config change · `full_mirror` ليس default.** أي عتبة غير مسجّلة في SSOT = **requires_ssot_followup** (لا تُخترَع هنا).

### 14.1 Wallet Taxonomy policy (W2-01)
- `candidate_wallet_type`/`_confidence`/`_provenance`: **derived/read-only — لا تُكتب كـ config يدوياً** (mutability: none / system-derived). low-confidence لا يُعامَل كحقيقة. الأنواع الخطرة (insider/dev/sniper/copycat) **لا ترفع copyability تلقائياً** ولا تمنح تنفيذاً. **threshold** مثل minimum confidence: **requires_ssot_followup** (لا اسم config جديد الآن) — سياسة وصفية فقط: قرارات follow/size لا تُبنى على نوع low-confidence.

### 14.2 Token Concentration policy (W2-02)
- `candidate_token_concentration_dimension`/`_risk`/`_reason`: **derived/read-only**. policy: التركّز **يغذّي `candidate_token_readiness_component`** (G37) ويمكنه **`candidate_token_readiness_component_veto`** (حجب الجاهزية حتى لو الإجمالي جيد). تركّز creator/dev/cluster **لا يُعامَل كطلب طبيعي**. **لا execution authority**. عتبات الـ veto للتركّز: **requires_ssot_followup** (تُحسم لاحقاً عبر readiness component policy) — لا اسم config جديد الآن.

### 14.3 Natural vs Artificial Pump policy (W2-03)
- `candidate_pump_classification`/`_reason`/`_confidence`: **derived/read-only**. policy: `artificial_*` يخفض readiness/copyability أو يحوّل إلى watch_only/rejection (يتكامل مع `candidate_fake_profit_*` G37) · `natural_pump` **لا يعني دخولاً تلقائياً** · `unknown_or_insufficient_evidence` **لا يُعامَل كـ natural demand**. **ارتفاع السعر الخام وحده ليس proof ولا execution authority.** عتبات التحويل: **requires_ssot_followup**.

### 14.4 Wallet Drift policy (W2-04)
- `candidate_wallet_drift_signal`/`_reason`/`_recommendation` (يبني على `candidate_wallet_behavior_drift_flag` G26): **advisory/read-only**. التوصيات {keep_following · reduce_size · pause_follow · switch_to_watch_only · require_review} **لا تُطبَّق على config تلقائياً ولا تغلق مراكز**؛ أي reduce/pause/switch يمرّ عبر **user/config flow رسمي** (نظير recommendation→preview→validation→permission→audit). عتبات الـ drift: **requires_ssot_followup**.

### 14.5 Default Copy Mode policy (W2-05) — قرار CONFIG رئيسي
- **default `copy_mode` للمحفظة المتبوعة الجديدة = `follow_entry_user_exit`** (الافتراضي الآمن؛ يحسم سلوك §5 «user-defined» عند الغياب بقيمة آمنة، لا يفرض إن اختار المستخدم صراحةً). يعيد استخدام `copy_mode` (Group 2) و`candidate_copy_mode_default_policy` (Group 38).
- **`full_mirror` Advanced-only · ليس default عاماً · لا يُفعَّل ضمنياً عند إضافة محفظة.**
- **validation rules (تكمّل §10):** (1) محفظة متبوعة جديدة **بلا `copy_mode` صريح → `follow_entry_user_exit`** (لا watch-only فقط، ولا full_mirror). (2) **`full_mirror` يتطلّب enablement صريحاً per-wallet** (advanced confirmation). (3) **migration:** إعداد قديم بلا `copy_mode` واضح → safe default `follow_entry_user_exit` **أو** require review — **لا يجعل `full_mirror` افتراضياً أبداً**.
- **requires_ssot_followup:** اسم حقل «advanced confirmation / explicit full_mirror enablement flag» **غير مسجّل في SSOT** — لم يُضَف هنا؛ يبقى policy text حتى يُسجَّل في SSOT (ARCH→SSOT) قبل أن يصير config field. لا config default لـ `full_mirror`.

### 14.6 Creator / Cluster Learning policy (W2-06)
- `candidate_creator_cluster_learning`/`_metric`/`_recommendation`/`_confidence`/`_provenance`: **advisory/read-only**. التوصيات {avoid · watch_only · reduce_size · allow_small_paper · eligible_for_normal_evaluation} **لا تُطبَّق على config تلقائياً** (عبر recommendation/user/config flow). **لا auto-ban بلا evidence** · low-confidence ليس حقيقة. **point-in-time مطلوب في backtest/replay** عبر `candidate_wt_point_in_time` (لا تعلّم من المستقبل). عتبات التعلّم: **requires_ssot_followup**.

### 14.7 Adverse Selection policy (W2-07)
- `candidate_adverse_selection_metric`/`_reason`/`_severity`: **derived/read-only**. inputs: `candidate_leader_vs_copier_delta` · `latency_to_copy` · `entry_slippage_vs_leader` · `candidate_wt_exit_timing` (+ route/quote degradation · failed/late exits). policy: `severity=high` **قد يغذّي** copyability/watch_only/reduce_size **كتوصية advisory** — **لا config auto-change · لا execution authority · لا يخلط ربح القائد بربح التابع.** عتبات الـ severity: **requires_ssot_followup**.

> **خلاصة §14 (CONFIG):** القرار المثبّت: **`copy_mode` default للمحفظة الجديدة = `follow_entry_user_exit`؛ `full_mirror` Advanced-only وليس default ولا silent.** بقية إشارات Wave 2 **derived/read-only/advisory**: concentration قد يفعل veto عبر readiness component (G37) لا كأمر تنفيذ · drift/learning/adverse-selection **لا تطبّق config تلقائياً ولا auto-ban** · **لا execution authority من أي إشارة W2 وحدها**. كل عتبة غير مسجّلة = requires_ssot_followup. **No API/Data/UX/Test/Build surface · no runtime · no migrations فعلية في هذه الموجة.**

---

## 15. Wave 3 — Reports & Honesty Config Policies (candidate, تستهلك ARCH §15.11 + SSOT Group 39)

> **report/disclosure policy · missing-metric policy · disclaimer policy · advisory/blocking behavior فقط** — لا Architecture meaning · لا SSOT naming · لا API/Data/UX/Test/Build · لا runtime · لا migrations · لا report template implementation. كل config field مسجّل في **SSOT Group 39** (أو اسم قائم). **لا تقرير/مقياس/disclaimer يمنح execution authority · لا تغيير سلوك EV gate/Hard Risk · لا execution mode · لا خلط Paper/Testnet/Real-Live · warning_only ليس clean pass · unavailable/insufficient evidence ليس صفراً.** أي اسم/threshold/template ID غير مسجّل = **requires_ssot_followup**.

### 15.1 Daily Unified Report policy (W3-01)
- `candidate_daily_unified_report` (report_definition instance): **يفرض فصل الأقسام** عبر `candidate_report_section` (paper_results/real_live_results/testnet_results/rejected_opportunities/failed_trades/open_risk/provider_health/config_changes/safety_gate_state/data_quality_issues/major_alerts) · `candidate_report_context` (simulated/testnet/real_live) **إلزامي ولا يُخلَط**. **missing metric** عبر `candidate_report_missing_metric_policy` = `show_unavailable` (insufficient evidence لا صفر، يعيد استخدام سياسة §13.10/G36). **derived/read-only — لا execution authority.**

### 15.2 Report Definitions Catalog policy (W3-02)
- `candidate_report_catalog` + `candidate_report_definition_type` (الـ13 نوعاً): **القوالب الرسمية لا تستبدلها custom reports** (custom مسموحة لا تحلّ محلّها). كل تعريف (`candidate_report_definition`/`candidate_report_template_id`) **يحمل/يطلب:** scope · context (`candidate_report_context`) · dimensions · metrics · evidence/provenance (`candidate_report_provenance`) · missing-metric policy · disclaimer requirements (§15.4) · paper/real separation. **لا template IDs نهائية جديدة غير مسجّلة** (requires_ssot_followup)؛ يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence` (G37).

### 15.3 Weekly Comparison Report policy (W3-03)
- `candidate_weekly_comparison_report` + `candidate_weekly_comparison_axis` (wallet/copy_mode/brain/provider/strategy/token_class/config_before_after/paper_real_divergence/creator_cluster_cohort/adverse_selection_impact): **`config_before_after` يحترم `config_version_at_entry`** (§9) · **لا auto-apply من التقرير** · **لا خلط Paper/Real/Live** · الفروقات المفقودة `unavailable` (عبر `candidate_report_missing_metric_policy`).

### 15.4 Disclaimer Standard policy (W3-04)
- `candidate_report_disclaimer_requirement` (past_performance_not_future_profitability/paper_not_live_profitability/backtest_requires_point_in_time_evidence/results_affected_by_cost_latency_provider_data_quality/high_confidence_not_certainty/recommendations_are_advisory_until_user_config_flow) · `candidate_report_disclaimer_required_for` (paper/backtest/weekly/recommendation/promotion). **policy:** **إلزامي للتقارير الحساسة · لا يختفي في advanced mode · ليس بديلاً عن gates · لا يجعل تقريراً غير صالح صالحاً** · التوصيات تبقى advisory حتى تمرّ عبر user/config flow.

### 15.5 Net Business PnL policy (W3-05)
- `candidate_net_business_pnl_report`/`candidate_net_business_pnl`/`candidate_business_cost_component` (provider_credit_cost/rpc_streaming_cost/infra_storage_export_report_cost/subscription_provider_cost)/`candidate_net_business_pnl_status` (complete/partial/unavailable): **derived reporting surface فقط — ليس بديلاً لـ trade P&L · لا execution authority.** المدخلات: trade net P&L (`candidate_realized_pnl`/`candidate_fees_total`/`candidate_slippage_cost` G22) + costs المتاحة (§16 RPC/Credit · `candidate_storage_usage_metric` G27). **unavailable/partial لا يتحوّل صفراً · positive trade P&L لا يعني positive business P&L.** **لا runtime cost field جديد** · أي cost source غير مسجّل = **requires_ssot_followup**.

### 15.6 warning_only Report Tag policy (W3-06)
- `candidate_warning_only_report_tag` + `candidate_report_gate_context` (clean_pass/warning_only_advisory/blocked) فوق `ev_gate_mode`/`warning_only`/`WARNING_CRITICAL`: **read-only reporting disclosure فقط.** **لا يغيّر EV gate behavior · لا يضعف Hard Risk · لا execution mode.** أي result/report أُنتج أثناء `warning_only` **يحمل disclosure** · **`warning_only_advisory` لا يظهر كـ `clean_pass`** · **failed EV لا يختفي** بسبب warning_only · **لا report promotion بلا disclosure**.

> **خلاصة §15 (CONFIG):** سياسات تقارير فقط: report context إلزامي وفصل Paper/Testnet/Real-Live · missing metric `show_unavailable` لا صفر · القوالب الرسمية لا تستبدلها custom · weekly بلا auto-apply ويحترم config_version · disclaimer إلزامي لا يختفي advanced وليس بديلاً عن gates · Net Business PnL طبقة مشتقّة (positive trade P&L ≠ positive business P&L، unavailable/partial لا صفر) · warning_only وسم read-only لا يغيّر EV gate/Hard Risk ولا يُعرَض clean pass. **لا execution authority من reports/metrics/disclaimers · كل threshold/template ID غير مسجّل = requires_ssot_followup · No API/Data/UX/Test/Build · no runtime · no migrations.**

---

## 16. Wave 4 — Execution / Providers + Data Config Policies (candidate, تستهلك ARCH §15.12 + SSOT Group 40)

> **policy/validation/mutability/missing-value/advisory boundaries فقط** — لا Architecture · لا SSOT field creation · لا API/Data/UX/Test/Build · لا runtime/provider connection implementation · لا commands. كل اسم مسجّل في **SSOT Group 40** (أو قائم). **توثيقي بحت: لا provider raw key/secret/credential · لا provider connection/execution command · لا provider setup impl · لا storage pricing/billing fields نهائية · لا report generation/template IDs نهائية · لا numeric threshold نهائي غير مسجّل.** **لا إشارة provider/execution/data-cost/opportunity تمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · المفقود unavailable/partial لا صفر/clean.** أي threshold/سياسة رقمية = **requires_ssot_followup**.

### 16.1 Provider Latency Comparison policy (W4-01)
- `candidate_provider_latency_metric`/`_latency_type` (stream/quote/route/send/confirmation_finality/provider_response_error)/`_latency_comparison`: **derived/read-only — observability/reporting/advisory فقط** (يعيد استخدام Execution Trace `candidate_ts_*` بالإحالة + `provider_degraded`/`slot_lag`). **latency مفقودة → unavailable لا صفر · best/worst لا يغيّر provider selection تلقائياً · fast provider ليس safe/executable · لا execution authority.** أي latency threshold رقمي = **requires_ssot_followup**.

### 16.2 Rate-limit & Provider Cost Monitor policy (W4-02)
- `candidate_provider_rate_limit_monitor`/`_provider_cost_metric` (rate_limit/quota_usage/credit_usage/request_cost/period_cost/cost_per_trade/cost_per_report/cost_per_job/throttling_backoff_state/provider_degradation)/`_provider_cost_attribution_status` (complete/partial/unavailable): **derived/advisory/observability.** يُغذّي `candidate_net_business_pnl`/`candidate_business_cost_component` (§15.5) **دون إعادة تعريفه** (يعيد استخدام §16 ARCH RPC/Credit Budget بالإحالة). **attribution مفقود → partial/unavailable لا صفر · توفّر المزوّد وكلفته إشارتان منفصلتان · لا execution authority · لا provider billing/pricing field جديد.** أي rate-limit/threshold رقمي = **requires_ssot_followup**.

### 16.3 Fork / Rollback policy (W4-03)
- `candidate_finality_state` (no_rollback_detected/rollback_risk/fork_detected/rollback_confirmed/finality_uncertain)/`candidate_rollback_fork_reason`: **حالة/حدث finality مستقل** (يعيد استخدام `NETWORK_ROLLBACK_EVENT`/`provider_degraded`/`slot_lag`). **rollback-affected data لا تُعامَل كحقيقة نهائية وتحمل warning/provenance** · قد يؤدي لاحقاً إلى degraded/read-only/watch_only/`EXITS_ONLY` **حسب policy لاحقة لا gate جديد هنا** · **لا تغيير Risk Gates/Hard Risk · لا execution authority · `no_rollback_detected` لا يعني مزوّداً كاملاً أو تنفيذاً آمناً.**

### 16.4 Provider Onboarding & Key/Connection Validation policy (W4-04)
- `candidate_provider_onboarding_status`/`_provider_type` (helius/jito/jupiter/generic_rpc/generic_stream)/`_provider_capability_status`/`_provider_connection_test_status`/`_provider_onboarding_failure_reason` (يعيد استخدام `candidate_provider_key_ref` كمرجع/حالة فقط). **key handling: raw keys/secrets/credentials ممنوعة · browser/UI/report/export بلا key material · `candidate_provider_key_ref` فقط.** **connection test status ليس trading readiness · Jupiter key/connection validation حالة صريحة عند استخدام quotes/routes · provider readiness لا يتجاوز SignerService/Risk Gates/admission gates · لا provider connection command · لا provider setup impl.** أي advanced-confirmation/key-permission field غير مسجّل = **requires_ssot_followup** (لا يُضاف).

### 16.5 Storage Cost + Survivorship-Safe Retention policy (W4-05)
- `candidate_storage_cost_report`/`_storage_cost_component` (data_type/retention_period/volume/hot_cold_archive_tier/report_export_artifacts/replay_backtest_datasets)/`_retention_impact_warning`/`_pruning_safety_status` (safe/survivorship_risk/point_in_time_risk/audit_integrity_risk): **derived/advisory** (يعيد استخدام `candidate_storage_usage_metric` + يربط بـ `candidate_net_business_pnl`). **storage cost مفقود → partial/unavailable لا صفر.** **retention reduction/purge policy يحذّر إن أثّر على historical wallet discovery · dead/failed/disappeared wallets · replay/backtest validity · audit/trade/accounting records** · **cost-saving deletion لا يخلق survivorship bias صامتاً ولا يكسر point-in-time/survivorship-free · لا storage pricing fields نهائية · لا purge command جديد.** أي retention threshold/tier pricing = **requires_ssot_followup**.

### 16.6 Rejected Opportunity Re-evaluation policy (W4-06)
- `candidate_rejected_opportunity_reevaluation`/`_reevaluation_trigger` (liquidity_improved/route_health_improved/holder_risk_improved/creator_risk_improved/pump_confidence_improved/concentration_risk_improved/provider_data_quality_improved/exit_feasibility_improved)/`_reevaluation_recommendation` (keep_rejected/keep_watch_only/review_again/eligible_for_paper/eligible_for_normal_evaluation): **derived/advisory فقط** (يعيد استخدام `hunt_status`/`watch_only`/`candidate_rejected_reason`). يحفظ original rejection reason + new evidence مفاهيمياً. **لا buy/execute · لا auto-open position · لا auto-config · تحسّن الفرصة لا يثبت edge · `eligible_for_normal_evaluation` لا يعني execution-ready.**

### 16.7 Best Paper Settings This Week Advisory policy (W4-07)
- `candidate_best_paper_settings_advisory`/`_paper_settings_recommendation`/`_paper_settings_evidence_status` (sufficient/insufficient_evidence/unavailable): **Paper-only · advisory فقط · no auto-apply · لا live promotion بلا gates/disclosure** (يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence`/`candidate_weekly_comparison_report`/`candidate_report_disclaimer_requirement`). **يعرض sample size/confidence/time period/mode/strategy/copy_mode/fees/slippage/latency/failure impact/paper-real divergence (حيث متاح)** · **insufficient_evidence/unavailable لا صفر ولا نجاح · best paper setting ليس live-ready · advisory حتى user/config flow · لا config application command.**

### 16.8 Graduation Trap States policy (W4-08)
- `candidate_graduation_trap_state` (graduation_pending/migration_limbo/post_graduation_exit_unsafe/post_graduation_liquidity_fragile/post_graduation_route_unhealthy/post_graduation_watch_only/graduation_trap_confirmed): يرتبط بـ `MIGRATION_IN_PROGRESS`/migration limbo (§operating-state)/Brain handoff/`candidate_token_readiness_component`/exit feasibility **دون إعادة تعريف**. **يؤثّر على readiness/exit feasibility/reports · لا execution authority · لا gate جديد هنا (future policy) · graduation لا يعني exit safety · `post_graduation_watch_only` لا يعني buy/execute · غياب دليل route/liquidity/exit ليس clean/safe.**

### 16.9 Cross-W4 Config Rules
- إشارات provider/execution/data-cost/opportunity **derived/read-only/advisory** ما لم تنصّ policy قائمة على غير ذلك · **لا execution authority · لا auto-execution · لا auto-config · لا provider connection/execution command · لا raw key/secret/credential field · key material خارج browser/UI/report/export** · connection success ليس trading readiness · fast provider ليس آمناً/قابلاً للتنفيذ · توفّر/كلفة منفصلان · rollback-affected ليست نهائية · cost-saving deletion لا يخلق survivorship bias · re-evaluated ليست أمر تنفيذ · best paper ليس live-ready · graduation ليس exit-safe · **المفقود unavailable/partial لا صفر/clean · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · لا Wave 5+.**

> **خلاصة §16 (CONFIG):** سياسات Wave 4 observability/advisory فقط: latency/cost/rollback/onboarding/storage/re-evaluation/best-paper/graduation كلها derived/read-only/advisory بلا execution authority · key material عبر `candidate_provider_key_ref` فقط بلا raw key · المفقود unavailable/partial لا صفر · pruning آمن للبقاء (survivorship-free/point-in-time) · best paper ليس live-ready · graduation ليس exit-safe. **كل threshold/pricing/template ID غير مسجّل = requires_ssot_followup · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · No API/Data/UX/Test/Build · no runtime · no commands · no provider setup impl.**

---

## 17. Wave 5 — Local Ops & Readiness Config Policies (candidate, تستهلك ARCH §15.13 + SSOT Group 41)

> **policy/validation/display/missing-value/advisory boundaries فقط** — لا Architecture · لا SSOT field creation · لا API/Data/UX/Test/Build · لا runtime/scripts/launcher/Docker · لا commands. كل اسم مسجّل في **SSOT Group 41** (أو قائم). **توثيقي بحت: لا raw key/secret/credential · لا service-control/restart/shutdown/backup/restore/purge/rollback/migration command · لا config default رقمي/threshold نهائي غير مسجّل.** **Local run/health/version/logs/implementation status لا يمنح execution authority · health green ليس trading readiness · SignerService health ليس permission to sign · provider health ليس trading readiness · documented_only/candidate ليس implemented · unknown/unavailable/not_verified لا clean/ready/implemented · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService.** أي threshold/سياسة رقمية = **requires_ssot_followup**.

### 17.1 Local Run UI-first Workflow policy (W5-01)
- `candidate_local_run_workflow_status` (not_started/checking/ready_for_local_use/degraded/blocked/unknown)/`candidate_required_local_service`/`candidate_local_run_missing_requirement`/`candidate_local_run_next_action`/`candidate_local_run_evidence_status` (present/partial/missing/stale/unknown): **display/status/validation فقط.** **Local app running ≠ trading readiness · `ready_for_local_use` لا تعني REAL-LIVE ready · missing evidence → degraded/unavailable/unknown لا clean · `candidate_local_run_next_action` = guidance فقط لا command · لا execution authority.**

### 17.2 Local Ops Health Screen policy (W5-02)
- `candidate_local_ops_health`/`candidate_local_ops_service_type` (الـ15)/`candidate_local_ops_service_status` (healthy/degraded/unavailable/unknown/not_configured/blocked)/`candidate_local_ops_health_reason`/`candidate_local_ops_health_next_action`؛ يعيد استخدام `signer_profile_status`/`operating_state`/`candidate_provider_onboarding_status`/`candidate_data_quality_metric`/`candidate_storage_usage_metric`. **read-only/diagnostic.** **`healthy` لا تعني execution-safe · SignerService `healthy` لا يعني permission to sign · provider_connectivity `healthy` لا يعني trading readiness · service unavailable → unavailable/degraded لا stack trace فقط · لا restart/test/connect command · لا execution authority.**

### 17.3 Operator Logs UX Standard policy (W5-03)
- `candidate_operator_log_event`/`_severity` (info/warning/error/critical)/`_category` (الـ13)/`_service`/`_correlation_ref`/`_user_summary`/`_technical_detail`/`_safe_next_action`/`_redaction_status` (redacted/not_required/redaction_failed/blocked_contains_secret/unknown): **logs مفهومة للمشغّل.** **stack trace = `candidate_operator_log_technical_detail` لا الرسالة الوحيدة · secrets/raw keys/tokens ممنوعة · `blocked_contains_secret` يحجب العرض/التصدير · warnings لا تختفي advanced · logs لا تمنح execution authority.**

### 17.4 Migrations & Version Status policy (W5-04)
- `candidate_api_version_status`/`candidate_db_schema_version`/`candidate_config_schema_version`/`candidate_contracts_version_status`/`candidate_migration_status` (up_to_date/pending/running/failed/blocked/unknown)/`candidate_pending_migration`/`candidate_failed_migration`/`candidate_rollback_availability` (available/unavailable/blocked/not_supported/unknown)/`candidate_version_compatibility_status` (compatible/incompatible/warning/unknown/not_verified)؛ يعيد استخدام `candidate_app_version`/`config_version`/`config_version_at_entry`/`migration_phase`/`MIGRATION_IN_PROGRESS`. **read-only display/status.** **failed/pending/blocked/unknown لا تظهر clean · `compatible` شرط مسبق فقط لا execution authority · current version display ليس system/trading readiness · mismatch واضح · لا migration command · لا rollback command · لا destructive migration.**

### 17.5 Upgrade / Rollback Procedure policy (W5-05)
- `candidate_upgrade_preflight_status` (pass/warning/blocked/failed/unavailable/unknown)/`candidate_upgrade_backup_requirement` (satisfied/required_missing/not_required/blocked/unknown)/`candidate_upgrade_migration_compatibility` (compatible/incompatible/warning/unknown/not_verified)/`candidate_rollback_path_status` (available/unavailable/blocked/invalid/unknown)/`candidate_upgrade_blocked_reason`/`candidate_post_upgrade_health_verification` (pass/warning/failed/blocked/unavailable/unknown)/`candidate_upgrade_incident_status` (none/open/blocked/mitigated/resolved/unknown): **procedure status فقط.** **`pass` لا يعني trading readiness · backup/export بلا raw secrets · rollback لا يفقد audit/history/config · failed upgrade → incident/blocker · لا upgrade/rollback/backup/restore command.**

### 17.6 Safe Maintenance Actions policy (W5-06)
- `candidate_maintenance_action_type` (restart_service/safe_shutdown/backup/restore/export_diagnostics/clear_cache/reindex_rebuild_projections/migration_check/config_rollback_preview)/`candidate_maintenance_action_status` (unavailable/preview_required/permitted/blocked/running/completed/failed/unknown)/`candidate_maintenance_permission_status` (permitted/denied/requires_permission/unavailable/unknown)/`candidate_maintenance_audit_status` (audit_ready/audit_missing/audit_failed/not_required/unknown)/`candidate_maintenance_preview_status` (preview_available/preview_required/preview_missing/not_required/unknown)/`candidate_maintenance_block_reason`/`candidate_maintenance_reversibility_status` (reversible/partially_reversible/irreversible/unknown)/`candidate_safe_shutdown_status` (safe_to_shutdown/blocked_pending_intents/blocked_active_signing/blocked_critical_jobs/unknown): **policy/states فقط لا commands.** **أي فعل لاحق permissioned + audited + previewed (حيث يلزم) + blocked when unsafe.** **safe_shutdown لا يترك pending intents · restart لا أثناء active signing أو critical jobs · backup بلا raw secrets · restore لا يكسر audit/history/config · clear_cache لا يحذف source-of-truth · reindex/rebuild projections لا يغيّر سلطة PostgreSQL · لا execution authority.**

### 17.7 Implementation Status Matrix Linkage policy (W5-07)
- `candidate_implementation_status` (implemented/partially_implemented/documented_only/candidate/not_built/blocked/deprecated)/`candidate_implementation_status_evidence`/`candidate_implementation_status_source`/`candidate_capability_status_label`/`candidate_status_verified_at`/`candidate_status_verification_state` (verified/not_verified/stale/unknown): **status/display فقط.** **`documented_only` ≠ implemented · `candidate` ≠ built · unknown → not_verified/unknown لا implemented · status label لا يمنح execution authority · capability لا تظهر جاهزة دون evidence · يربط بـ `IMPLEMENTATION_STATUS_MATRIX.md` ولا يغيّرها.**

### 17.8 Cross-W5 Config Rules
- لا field خارج SSOT Group 41/القائم · لا command جديد · لا scripts/launcher/runtime · لا raw key/secret/credential · لا service-control command · لا backup/restore/restart/shutdown/purge/rollback/migration command · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا auto-execution · لا auto-config · لا live/testnet/mainnet · health/version/log/status/display لا تمنح execution authority · missing/unknown/not_verified/unavailable لا clean/ready/implemented · documented_only/candidate لا implemented.

> **خلاصة §17 (CONFIG):** سياسات Wave 5 display/status/validation فقط: local run/health/logs/version/upgrade/maintenance/implementation-status كلها read-only/diagnostic بلا execution authority · local running ≠ trading readiness · health green ≠ execution-safe وsigner health ≠ permission to sign · logs تُخفي الأسرار و`blocked_contains_secret` يحجب · version compatible شرط مسبق لا authority · upgrade pass ≠ trading readiness · maintenance policy/states فقط (permissioned/audited/previewed/blocked، لا commands، غير سلطوية على source-of-truth) · documented_only/candidate ≠ implemented (unknown → not_verified) · المفقود unavailable/unknown/not_verified لا clean/ready/implemented. **كل threshold/default غير مسجّل = requires_ssot_followup · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · No API/Data/UX/Test/Build · no runtime/scripts/launcher · no commands · no raw keys/secrets.**
