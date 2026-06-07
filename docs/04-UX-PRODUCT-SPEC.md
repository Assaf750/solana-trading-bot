# UX Product Spec

> **Priority:** 04 — Implementation · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** الشاشات والتدفّقات وحالات العرض

**الحالة:** معتمدة / موسّعة بعد v1.8 Delta + F-Elimination + Waves 1–5 — الأقسام 0–31 مكتملة ومراجعة. §25 يضيف أسطح v1.8 (Groups 22–27)، و§26 يضيف أسطح F-Elimination (Groups 22–36)، و§27 يستهلك SSOT Group 37 / Wave 1، و§28 يستهلك SSOT Group 38 / Wave 2، و§29 يستهلك SSOT Group 39 / Wave 3، و§30 يستهلك SSOT Group 40 / Wave 4، و§31 يستهلك SSOT Group 41 / Wave 5 — كلها للعرض فقط، candidate_*، UX يعرض ولا يحسب. كل إضافات Waves 1–5 تبقى panels/labels/warnings، ولا تمنح execution authority ولا تضيف أزرار تنفيذ ولا تغيّر EV gate أو Hard Risk أو Risk Gates أو SignerService.

**مبني على:** `00-ARCHITECTURE.md` · `01-SSOT.md` · `02-CONFIG…` · `03-API-CONTRACT.md`. يعرض مفرداتها ولا يعيد تعريفها.

---

## 0. UX Preflight — Display vs Field Decision (محسوم)

UX **يعرض الموجود، لا يخترع حقولاً**. الفرق الحاكم:

| النوع | المالك | أمثلة |
|---|---|---|
| حقل حالة/استجابة ثابت يظهر للمستخدم | **SSOT/API** (لا تخترعه UX) | `operating_state` · `position_state` · `real_live_config_valid` · `validation_status` · `api_error_code` · `audit_actor` |
| عنصر بصري بحت | **UX وحدها** (لا SSOT) | card layout · tabs · badges · colors · section grouping · empty states · copy text |

**قاعدة:** إن احتاجت الواجهة عرض شيء بلا حقل مؤصَّل (مثلاً مؤشّر مجمّع جديد)، **يُوقَف** ويُسجَّل في ARCHITECTURE→SSOT قبل عرضه كحقل — لا يُخترَع في UX. العرض البصري للحقول الموجودة (لون/شارة/ترتيب) ملك UX بلا تسجيل.

**نتيجة preflight:** الموجة الحالية تعرض حقولاً مؤصَّلة في SSOT (Groups 1–21، وموجة New-Coin Hunting في 16–21؛ وv1.8 Delta في 22–27). **labels البشرية، الشروح، الـ badges، tags النضارة (live/delayed/estimated/paper/real)، وتفضيلات الواجهة = UX-only** (لا تُسجَّل). لا فجوة حقول؛ أي فجوة تُرصَد لا تُخترَع. **مصدر بيانات الرادار الآن هو Opportunity API الـ read-only/read-oriented كما في `03-API-CONTRACT.md` §13** (`resource_type=opportunity` مسجّل في SSOT Group 11). UX لا يخترع endpoint أو resource جديداً، ولا يحوّل Opportunity/Radar إلى execution authority؛ مورد opportunity بلا buy command، بلا execution authority، وبلا P&L surface.

---

## 1. Scope & Ownership (النطاق والملكية)

**UX يملك (حصراً):**
- `الشاشات` — تكوين الصفحات والأقسام.
- `تدفّقات المستخدم` — مسارات المهام (تسجيل محفظة، تعديل إعداد، تفعيل REAL-LIVE…).
- `حالات العرض` — كيف تُعرض كل حالة (loading/empty/error/populated).
- `ترتيب المعلومات` — الأولوية البصرية والتجميع.
- `warnings / badges / confirmations` — التنبيهات البصرية وحوارات التأكيد.
- `طريقة إظهار حقول API/SSOT` — تنسيق العرض (لا الأسماء ولا المعاني).

**UX لا يملك:**
- `المعنى المعماري` (ARCHITECTURE) · `أسماء الحقول` (SSOT) · `API contracts` (Doc 03) · `defaults/validation/mutability` (Doc 02) · `DB schema` (Data Model).

**القاعدة الحاكمة:**
> كل حقل حالة/استجابة معروض = `source_of_truth_field` من SSOT. العناصر البصرية البحتة ملك UX. حقل جديد → ARCHITECTURE→SSOT أولاً.

---

## 2. UX Principles (مبادئ الواجهة)

1. **إدارة لا تقارير فقط:** الواجهة مركز تحكّم لإدارة التطبيق (registry, config, positions, safety)، لا لوحة قراءة سلبية. كل شاشة تربط العرض بأمر ممكن (حيث تسمح الصلاحية).

2. **الأمان مرئي دائماً:** `operating_state` و`real_live_config_valid` و`WARNING_CRITICAL` معروضة بوضوح في كل سياق ذي صلة. EXITS_ONLY/KILLED تظهر بصرياً فوراً ولا تُخفى.

3. **العرض يتبع الصلاحية:** الواجهة تعكس `permission_role` — viewer يرى بلا أزرار كتابة؛ الأوامر الحرجة (REAL-LIVE، kill switch، signer) تظهر فقط لمن يملك `admin`/`signer_control` مع تأكيد صريح.

4. **التمييز البصري بين الفئات:** Config (قابل للتحرير) · runtime state (قراءة) · derived (محسوب) تُعرض بتمييز بصري — المستخدم يرى ما يحرّره مقابل ما يُقرأ. محاولة تحرير قراءة ممنوعة في الواجهة قبل وصولها API.

5. **التأكيد للأفعال الخطرة:** تعديل Hard Risk، config migration، تفعيل REAL-LIVE، الخروج الطارئ، kill switch — كلها تتطلّب confirmation صريحاً يعرض الأثر (مثلاً «هذا يطبّق فوراً على كل المراكز»).

6. **الحقيقة من API لا الواجهة:** الواجهة لا تحسب safety/validation محلياً؛ تعرض `validation_status`/`real_live_config_valid` من API. لا تدّعي «صالح» بحساب خاص.

7. **البثّ لا الـ polling:** الشاشات الحيّة (positions, health, readiness) تُحدَّث عبر streams (Doc 03 §9)، مع مؤشّر اتصال/فجوة واضح.

8. **أسماء SSOT في الطبقة التقنية، لغة بشرية في العرض:** الواجهة تعرض تسميات مقروءة (labels) فوق `source_of_truth_field`؛ التسمية البشرية ملك UX، الاسم التقني يبقى SSOT (مثل `brain_a` → "Brain A / Bonding Curve").

9. **تجربة إنسانية أولاً (non-programmer):** الواجهة منصّة تشغيل كاملة لشخص عادي غير مبرمج — لا تتطلّب قراءة كود ولا CLI ولا فهم تفاصيل داخلية. كل شاشة تجيب: ما هذه الصفحة؟ ماذا يحدث الآن؟ ماذا أفعل تالياً؟ لماذا هذا مسموح/محظور؟ ما الذي تغيّر؟ هل البيانات live/delayed/estimated/paper/real؟

10. **ثنائية اللغة (عربي/إنجليزي) كمواطن أول:** labels عربية وإنجليزية · تخطيط RTL/LTR آمن · `source_of_truth_field` يبقى إنجليزياً canonical · الشروح/الأخطاء/التحذيرات/الحالات الفارغة/الـ onboarding/الـ tooltips قابلة للتوطين · العربية ليست لاحقة.

11. **تدفّقات موجّهة لا جداول خام:** الميزات تُقدَّم كـ guided workflows (§12.1)، لا جداول تقنية منعزلة.

12. **اكتشافية كاملة:** كل ميزة مدعومة لها مكان ظاهر في الواجهة (wallet tracking · copy modes · Radar · Decision Trace · Token Risk · Copyability · Entry/Sizing Filters · Exit Policy · Latency/Attribution · Risk/EV gates · execution mode · paper/live readiness · audit · settings/safety). لا ميزة مدفونة في الوثائق.

13. **إفصاح تدريجي (progressive disclosure):** ملخّص → سبب/شرح → تشخيص متقدّم → اسم canonical عند الحاجة فقط.

14. **تخصيص (UI preferences — UX-only):** لغة/اتجاه · أعمدة مرئية · views/filters محفوظة · presets للمخاطر/الخروج (تتسلسل لحقول Config وتمرّ validation، لا تتجاوزها) · تفضيلات تنبيه · وضع compact/detailed. التخزين server-persisted يُمثَّل عبر سطح التفضيلات المرشّح في §26.12 (candidate، غير منفّذ، لا يتجاوز config/risk).

15. **لا تنفيذ عرضي:** الواجهة تحمي المستخدم من سوء الفهم؛ لا زرّ شراء من اكتشاف، لا معاملة `accepted`/diagnostic كإذن تنفيذ، لا إخفاء سبب المنع (قائمة الرفض §13).

---

## 3. Product Navigation Model (نموذج التنقّل)

الواجهة مبنية حول **نموذج تنقّل منظم من 9 صفحات رئيسية**، مع شاشات تفصيلية كتبويبات أو advanced panels، كلٌّ يربط عرضاً مؤصَّلاً بأوامر API الممكنة:

> **نموذج التنقّل المنظَّم (9 صفحات رئيسة — للمستخدم العادي):** **1) Command Center · 2) Trading Workspace · 3) New Coin Radar · 4) Wallet Intelligence · 5) Analytics & Reports · 6) My Wallets & Funds · 7) Settings & Safety · 8) Alerts · 9) Help / Glossary.**
> - Decision Trace و Token Risk = تبويبات/تفاصيل داخل New Coin Radar / Opportunity Details.
> - Trade Timeline = داخل Trading Workspace / Selected Trade Details.
> - Raw Audit = داخل Analytics & Reports كعرض متقدّم.
> - Health/Streams = داخل Settings & Safety أو Command Center (تشخيص متقدّم).
> - **Existing detailed screens remain valid as subviews/advanced panels inside this 9-page navigation model, not as competing top-level navigation. الترقية إلى تنقّل علوي تتطلّب قرار ARCH→SSOT→UX منفصلاً قبل الاستخدام.** الجدول أدناه = جرد الشاشات التفصيلية ضمن هذا النموذج، لا تنقّل علوي منافس.

| القسم | يعرض (SSOT/API) | الأوامر (command_type) | الصلاحية |
|---|---|---|---|
| **Command Center** | `operating_state` · `real_live_config_valid` · ملخّص positions/health/readiness · تنبيهات `WARNING_CRITICAL` | `pause_system` · `resume_system` · `trigger_kill_switch` · `activate_real_live` | عرض للكل · أوامر حرجة لـ admin/signer_control |
| **Wallet Registry** | per-wallet config · `follow_enabled` · المراكز المرتبطة | `register_wallet` · `update_wallet_config` · `enable_wallet_follow` · `disable_wallet_follow` | operator+ |
| **Positions** | `position_state` · `entry_brain`/`current_control_brain` · `market_phase` · `active_exit_route` | `manual_exit_position` · `emergency_exit_position` | عرض للكل · خروج لـ operator/admin |
| **Readiness & Safety** | `real_live_config_valid` · `validation_status` · Readiness Checklist · Hard Risk completeness | (عرض + روابط لإصلاح config) | عرض للكل |
| **Config** | كائنات الإعداد الثمانية · `config_version` · mutability | `preview_config_update` · `update_config` · `apply_config_migration` | operator/admin حسب الحقل |
| **Health / Streams** | `provider_degraded` · `slot_lag` · `protocol_constant_status` · `bundle_status` · حالة streams | (عرض) | عرض للكل |
| **Audit** | `audit_actor` · `audit_scope` · `audit_reason` · `command_type` · النتيجة · `event_timestamp` | (استعلام read-only، cursor-based) | عرض حسب الصلاحية |
| **Execution Wallets & Signers** | `execution_wallet_id` · `execution_wallet_address` · `execution_wallet_status` · `signer_profile_id` · `signer_profile_status` · `asset_transfer_status` · `wallet_rotation_status` · `profit_sweep_policy` | `register_execution_wallet` · `activate_execution_wallet` · `drain_execution_wallet` · `revoke_execution_wallet` · `register_signer_profile` · `create_asset_transfer_intent` · `rotate_execution_wallet` · `sweep_profits` | admin/signer_control حسب الأمر |
| **New Coin Radar** | `token_opportunity` · `hunt_status` · `new_token_priority_score` (ترتيب) · Token Risk (derived) | **لا command تنفيذي جديد** (عرض + تنقّل) | عرض للكل |
| **Decision Trace** | `hunt_status` · `accepted_reason` · `rejected_reason` | read-only | عرض للكل |
| **Wallet Copyability** | `copyability_by_brain` · `crowd_follow_score` · `profit_concentration` · `tracked_wallet_status` | المتابعة عبر `enable_wallet_follow`/`disable_wallet_follow` | عرض للكل |
| **Token Risk** | `recycled_token_flag` · `name_impersonation_score` · `creator_launch_rate_flag` · `token_readiness_score` | (عرض) | عرض للكل |
| **Latency / Attribution** | `discovery_latency_ms` · `signal_to_execution_ms` · `latency_to_copy` · `entry_slippage_vs_leader` | (عرض) | عرض للكل |
| **Settings & Safety** | كائنات الإعداد الثمانية · `config_version` · `validation_status` · `real_live_config_valid` + Readiness (بلغة بشرية) | `preview_config_update` · `update_config` · `apply_config_migration` | حسب الحقل |
| **Reports / Audit** | `audit_actor` · `audit_scope` · `audit_reason` · `command_type` · attribution/أداء (تجميع بصري) | استعلام read-only | حسب الصلاحية |
| **Help / Glossary** | خريطة `source_of_truth_field` → label/شرح (محتوى UX ثابت) | (محتوى UX) | عرض للكل |

> **التنقّل يعكس الأمان:** Command Center و Readiness & Safety في المقدّمة دائماً؛ حالة `operating_state` مرئية من أي قسم (شريط علوي ثابت). لا يُخفى تحذير أمني خلف تنقّل.

> **Execution Wallets & Signers** يعرض محافظ التنفيذ والتوقيع، لا المحافظ المتبوعة. `wallet` في Wallet Registry = source/tracked wallet؛ `execution_wallet` = محفظتنا التي تملك وتوقّع (§4.3 · §12 · §11).

> **مفاهيم العرض المجمّعة ليست حقولاً جديدة (حاسم):**
> - **ملخّصات Command Center** (positions/health/readiness) = تجميع بصري من حقول API/SSOT القائمة، لا response fields جديدة. حقل مجمّع ثابت باسم مستقل (مثل `portfolio_summary`/`system_summary`) → يُسجَّل في SSOT أولاً.
> - **حالة streams** في Health/Streams = تُعرض من حقول Group 12/13 (`event_sequence` · `event_timestamp` · `subscription_id` · `stream_channel` · `payload_version` · `heartbeat_interval_ms`)، لا حقل جديد باسم `stream_status`.
> - **Readiness Checklist و Hard Risk completeness** = مفاهيم عرض تُبنى من `real_live_config_valid` · `validation_status` + اكتمال حقول Group 6 (`max_daily_loss_pct` · `max_daily_loss_usdt` · `max_total_drawdown_pct` · `max_open_positions` · `max_position_size_pct` · `max_token_exposure_pct` · `max_creator_exposure_pct` · `max_cluster_exposure_pct` · `max_correlated_meme_exposure_pct`)، لا حقول API جديدة ما لم تُسجَّل في SSOT.

---

## 4. Command Center (مركز التحكّم)

**Purpose:** نقطة الدخول التشغيلية — حالة النظام الكلية والتحكّم الحرج في لمحة، مع إبراز أي تحذير أمني فوراً.

**Displays (SSOT/API fields):** `operating_state` · `real_live_config_valid` · `validation_status` · `WARNING_CRITICAL` · عدّ المراكز المفتوحة (مشتقّ عرضاً من `position_state`) · `provider_degraded` · `protocol_constant_status`.

**Visual groupings (UX-only, no fields):** شريط حالة علوي ثابت · بطاقة "الوضع الآن" · لوحة تنبيهات · أزرار التحكّم الحرج مع فصل بصري واضح.

**User flows:** مراقبة الحالة ← عند تحذير: الانتقال للقسم المعني (Readiness/Health/Positions) ← تنفيذ أمر حرج بتأكيد.

**Actions / command_type:** `pause_system` · `resume_system` · `trigger_kill_switch` · `activate_real_live`.

**Permissions:** العرض للكل (`viewer`+)؛ `pause/resume` لـ `operator`+؛ `trigger_kill_switch` و`activate_real_live` لـ `admin`/`signer_control` حسب الأمر.

**States:** *loading*: هيكل بلا قيم وهمية. *empty*: نظام بلا محافظ/مراكز → دعوة لإعداد Config وWallet. *error*: تعذّر جلب الحالة → تحذير بصري + لا ادّعاء "سليم". *populated*: الحالة الحيّة عبر stream.

**Safety confirmations:** `activate_real_live` → تأكيد يعرض نتيجة فحص `real_live_config_valid` (يُمنع إن `false`). `trigger_kill_switch` → تأكيد صريح "يوقف كل دخول جديد ويحوّل لـ EXITS_ONLY/KILLED".

**Explicit non-fields / no local computation:** "ملخّص النظام"/"عدّ التنبيهات" عناصر عرض بشرية لا حقول (`system_summary`/`action_required_count` ليست response fields). **عدّ المراكز المفتوحة مشتقّ بصرياً من `position_state`، لا response field باسم `open_positions_count`؛ إن احتاجت الواجهة عدّاً رسمياً من API يُسجَّل في SSOT أولاً.** الواجهة لا تحسب `real_live_config_valid` محلياً — تعرضه من API.

## 5. Readiness & Safety (الجاهزية والأمان)

**Purpose:** هل النظام صالح للتشغيل الحيّ؟ ولماذا لا، إن لم يكن. مصدر الحقيقة لقرار REAL-LIVE.

**Displays (SSOT/API fields):** `real_live_config_valid` · `validation_status` · اكتمال Group 6 (Hard Risk) حقلاً حقلاً · `WARNING_CRITICAL` · `ev_gate_mode` (وأثره) · حالة وحدات Readiness Checklist (من ARCHITECTURE §15.1).

**Visual groupings (UX-only, no fields):** قائمة فحص بصرية (checklist) · تمييز بصري للناقص/المكتمل · روابط إصلاح تنقل لـ Config.

**User flows:** فحص الجاهزية ← رؤية البند الناقص (مثلاً حدّ Hard Risk غير مضبوط) ← الانتقال لـ Config لإصلاحه ← العودة وإعادة الفحص.

**Actions / command_type:** لا أوامر كتابة هنا (عرض + روابط)؛ التفعيل نفسه (`activate_real_live`) من Command Center.

**Permissions:** العرض للكل.

**States:** *loading*: هيكل القائمة. *empty*: لا ينطبق (دائماً ثمّة حالة جاهزية). *error*: تعذّر تقييم الجاهزية → يُعرض كـ "غير صالح/غير معروف"، لا "صالح". *populated*: القائمة الحيّة عبر `readiness_update` stream.

**Safety confirmations:** لا أوامر هنا؛ لكن إن قاد المستخدم لإصلاح Hard Risk، يطبّق Config تأكيداته.

**Explicit non-fields / no local computation:** "Readiness Checklist" و"Hard Risk completeness" مفاهيم عرض تُبنى من `real_live_config_valid`/`validation_status`/Group 6، لا حقول جديدة (`readiness_score`/`safety_banner` ليست response fields). الواجهة لا تقرّر الصلاحية بحساب خاص — تعرض `real_live_config_valid` من API.

## 6. Positions (المراكز)

**Purpose:** عرض المراكز المفتوحة/المغلقة وحالتها، وإتاحة أوامر الخروج المحكومة.

**Displays (SSOT/API fields):** `position_state` · `entry_brain` · `current_control_brain` · `market_phase` · `migration_phase` · `active_exit_route` · `config_version_at_entry` · `cumulative_ignored_sell` (قراءة) · المرتبط بـ `intent` (`intent_id`/`intent_type`/`bundle_status`/`failure_type`).

**Visual groupings (UX-only, no fields):** بطاقة لكل مركز · تجميع بصري حسب الحالة/العقل · مؤشّر بصري لمرحلة الهجرة · ترقيم cursor-based (`cursor`/`page_size`).

**User flows:** عرض المراكز ← فحص مركز ← (عند الحاجة) خروج يدوي/طارئ بتأكيد ← متابعة الـ intent الناتج.

**Actions / command_type:** `manual_exit_position` · `emergency_exit_position` · (`cancel_intent` على intent معلّق).

**Permissions:** العرض للكل؛ `manual_exit_position` لـ `operator`+؛ `emergency_exit_position` يظهر لـ `admin` افتراضاً، ويظهر/يتطلّب `signer_control` فقط عندما يمسّ الأمر signer revoke / key control / protected execution override (نفس منطق §API 7 — لا يُخفى كل خروج طارئ خلف signer_control).

**States:** *loading*: هياكل بطاقات. *empty*: لا مراكز → حالة فارغة واضحة (ليست خطأ). *error*: تعذّر الجلب → تحذير + لا عرض مراكز قديمة كأنها حيّة. *populated*: حيّ عبر `position_update` stream.

**Safety confirmations:** `manual_exit_position` → تأكيد يوضّح أنه يخضع لـ `current_control_brain` وexit feasibility (قد يتأخّر في migration limbo). `emergency_exit_position` → تأكيد مشدّد "مسار أمان، لا يتجاوز Hard Risk".

**Explicit non-fields / no local computation:** "نظرة عامة على المراكز" عرض بشري لا حقل (`position_overview` ليس response field). الواجهة لا تحسب P&L أو حالة الخروج محلياً — تعرض حقول API. **P&L لا يُحسب في الواجهة ولا يُشتق محلياً؛ الأسماء القديمة غير المسبوقة مرفوضة (rejected)، أمّا candidate P&L surfaces فتُعرض فقط من backend/data read-model كما في §26.1/§25.1 وبشرط mark gating للـ unrealized. Opportunity/Radar لا يملك P&L.** لا كتابة على حقول المركز (محاولتها → `READ_ONLY_FIELD_REJECTED`).

---

## 7. Wallet Registry (سجلّ المحافظ)

**Purpose:** إدارة المحافظ المنسوخة — تسجيل، ضبط per-wallet config، تفعيل/تعطيل المتابعة.

**Displays (SSOT/API fields):** per-wallet config (Group 8: `copy_mode`/`sizing_*`/policies/thresholds…) · `follow_enabled` · `take_profit_pct` · المراكز المرتبطة (`position_state`).

**Visual groupings (UX-only, no fields):** بطاقة لكل محفظة · تبويب config/positions · شارة حالة المتابعة (مشتقّة بصرياً من `follow_enabled`).

**User flows:** تسجيل محفظة ← ضبط config (مع validation حيّ من preview) ← تفعيل المتابعة ← متابعة المراكز.

**Actions / command_type:** `register_wallet` · `update_wallet_config` · `enable_wallet_follow` · `disable_wallet_follow`.

**Permissions:** `operator`+ للكتابة؛ العرض للكل.

**States:** *loading*: هياكل بطاقات. *empty*: لا محافظ → دعوة لتسجيل أولى. *error*: تعذّر الجلب → تحذير. *populated*: القائمة الحيّة.

**Safety confirmations:** `disable_wallet_follow` → تأكيد يوضّح **"يوقف الدخول/الإضافات الجديدة فقط، لا يغلق المراكز القائمة"** (§Config حاشية 3). `update_wallet_config` على حقل مجمّد ومركز مفتوح → تنبيه بأنه يسري على الإدخالات الجديدة لا القائمة.

**Explicit non-fields / no local computation:** "wallet_score"/"تقييم المحفظة" إن عُرض = visual grouping أو حقل مؤصَّل إن وُجد، لا اسم جديد يُخترَع. الواجهة لا تحسب صلاحية config المحفظة محلياً — تعرض `validation_status` من preview/update.

## 8. Config (الإعداد)

**Purpose:** عرض وتعديل كائنات الإعداد الثمانية محكوماً بـ mutability، مع إبراز ما هو safety-critical.

**Displays (SSOT/API fields):** كائنات الإعداد (Groups 2،6،7،8،9) · `config_version` · `validation_status` · `config_migration_required` (في استجابة التعديل) · تمييز `safety_critical` (من Mutability Matrix §Config 11).

**Visual groupings (UX-only, no fields):** تبويب حسب الكائن (global/brain/per-wallet/risk/ev/execution/paper/versioning) · تمييز بصري Config/runtime/derived · شارة "frozen at entry"/"immediate".

**USDC-quoted path toggle (يعرض/يضبط `usdc_quote_enabled` — global/advanced safety):** toggle ضمن global/advanced safety settings، **default = off**. نصّ تحذيري: «تفعيل مسار USDC-quoted لا يتجاوز Hard Risk/EV/Token Safety/Exit Feasibility». التغيير يمرّ عبر `preview_config_update` → validation → `update_config` (audit/config-version). عند off: توكنات USDC تُعرض skipped عبر `unknown_quote_mint`.

**User flows:** فتح الإعداد ← تعديل ← `preview_config_update` (يعرض validation_status + config_migration_required + الحقول المتأثّرة) ← تأكيد ← `update_config` ← (عند الحاجة) `apply_config_migration`.

**Actions / command_type:** `preview_config_update` · `update_config` · `apply_config_migration`.

**Permissions:** `operator` للحقول غير الحرجة · `admin` لـ Hard Risk · `apply_config_migration` لـ `admin` (+`signer_control` إن مسّ signing/security).

**States:** *loading*: هيكل النموذج. *empty*: لا ينطبق. *error*: فشل validation → يعرض `CONFIG_VALIDATION_FAILED`/`IMMUTABLE_FIELD_FROZEN`/`HARD_RISK_BYPASS_REJECTED` برسالة مقروءة. *populated*: القيم الحالية + `config_version`.

**Safety confirmations:** تعديل Hard Risk → تأكيد "يطبَّق فوراً على كل المراكز". `apply_config_migration` → تأكيد صريح بالأثر على المراكز القائمة. محاولة خفض Hard Risk عبر warning_only → تُمنع بصرياً قبل الإرسال + `HARD_RISK_BYPASS_REJECTED` إن وصلت.

**Explicit non-fields / no local computation:** "config_health"/"صحّة الإعداد" = visual grouping من `validation_status` + اكتمال Group 6، لا response field جديد. الواجهة لا تقرّر صلاحية الإعداد محلياً — تعرض `validation_status`/`real_live_config_valid` من API. `conflict_resolution` يُعرض كقيمة ثابتة غير قابلة للتحرير (لا dropdown).

## 9. Health / Streams (الصحّة والبثّ)

**Purpose:** صحّة المزوّدين والـ streams وثوابت البروتوكول، وحالة الاتصال الحيّ.

**Displays (SSOT/API fields):** `provider_degraded` · `slot_lag` · `last_seen_slot` · `last_confirmed_slot` · `protocol_constant_status` · `bundle_status` (مجمّع/نشط) · حقول الـ stream (Group 12/13: `event_sequence`/`event_timestamp`/`subscription_id`/`stream_channel`/`payload_version`/`heartbeat_interval_ms`).

**Visual groupings (UX-only, no fields):** لوحة صحّة المزوّد · مؤشّر فجوة stream (من انقطاع `event_sequence`) · شارة اتصال (من `heartbeat_interval_ms`).

**User flows:** مراقبة الصحّة ← عند `provider_degraded`/فجوة: فهم أثرها (EXITS_ONLY) ← الانتقال لـ Command Center إن لزم.

**Actions / command_type:** لا أوامر كتابة (عرض فقط).

**Permissions:** العرض للكل.

**States:** *loading*: هيكل اللوحات. *empty*: لا ينطبق. *error*: تعذّر جلب الصحّة → يُعرض كـ "degraded/unknown"، لا "سليم" (fail-safe بصري). *populated*: حيّ عبر `health_update` stream.

**Safety confirmations:** لا أوامر هنا.

**Explicit non-fields / no local computation:** "حالة streams"/"صحّة النظام" = تجميع بصري من حقول Group 5/12/13، لا حقل `stream_status`/`system_health` جديد. الواجهة لا تحسب degradation محلياً — تعرض `provider_degraded`/`slot_lag` من API.

## 10. Audit (التدقيق)

**Purpose:** استعراض سجلّ التدقيق — مَن فعل ماذا، متى، ولماذا، ونتيجته.

**Displays (SSOT/API fields):** `audit_actor` · `audit_scope` · `audit_reason` · `command_type` · `resource_type` · `permission_role` · `request_id` · `event_timestamp` · `event_sequence` · النتيجة (`api_error_code` عند الفشل).

**Visual groupings (UX-only, no fields):** جدول/خطّ زمني · فلاتر بصرية (حسب actor/scope/نوع) · ترقيم cursor-based (`cursor`/`page_size`).

**User flows:** فتح Audit ← فلترة (scope/actor/فترة) ← فحص حدث ← (للأحداث الحرجة) رؤية `audit_reason`.

**Actions / command_type:** لا أوامر كتابة — استعلام read-only فقط (Audit append-only، §API 11).

**Permissions:** العرض حسب الصلاحية (سجلّ الأمان قد يتطلّب `admin`).

**States:** *loading*: هيكل الجدول. *empty*: لا أحداث في النطاق → حالة فارغة. *error*: تعذّر الاستعلام → تحذير. *populated*: النتائج (cursor-based).

**Safety confirmations:** لا أوامر؛ Audit غير قابل للتعديل/الحذف عبر الواجهة (append-only).

**Explicit non-fields / no local computation:** "audit_summary"/"ملخّص التدقيق" = visual grouping لا response field. الواجهة لا تشتقّ هوية المنفّذ محلياً — تعرض `audit_actor` من API. **لا تُخترَع reason codes في UX؛ أي توسيع لسطح reason-code يمرّ عبر ARCH→SSOT→API/SEC/RUN قبل العرض.**

---

> **خاتمة الموجة الأساسية:** الأقسام السابقة تبقى تعريفات تفصيلية صالحة، وتُعرض الآن ضمن نموذج التنقل المنظم وامتدادات §12–§24. كل اسم مجمّع (`system_summary`/`open_positions_count`/`wallet_score`/`config_health`/`stream_status`/`audit_summary`) موسوم **visual grouping لا response field**؛ أيّ تحوّل لاسم API ثابت يمرّ عبر ARCHITECTURE → SSOT أولاً. لا حساب safety/validation محلي في أي شاشة — الحقيقة من API.

---

## 11. Execution Wallets & Signers Screen (شاشة محافظ التنفيذ والتوقيع — توسعة)

> توسعة رسمية للأجزاء 0–10 (لا تلغيها). تطبّق ARCHITECTURE §4.3 وAPI §12، وتعرض مفردات SSOT Group 15 وأوامر Group 11 المعتمدة. الأمان أولاً: لا مفاتيح/أسرار تُعرض إطلاقاً.

**Purpose:** إدارة محافظ التنفيذ والـ signers — تسجيل، تفعيل (admission gate)، تدوير، نقل أصول، كنس أرباح، مع إبراز حالة الأمان والأهلية بوضوح.

**Displays (SSOT/API fields):** `execution_wallet_id` · `execution_wallet_address` · `execution_wallet_status` · `key_custody_mode` · `signer_profile_id` · `signer_profile_status` · `asset_transfer_intent_id` · `asset_transfer_status` · `source_execution_wallet_id` · `destination_execution_wallet_id` · `wallet_rotation_status` · `rotation_trigger` · `rotation_from_execution_wallet_id` · `rotation_to_execution_wallet_id` · `profit_sweep_policy` · `profit_sweep_interval_ms` · `settlement_wallet_address` · ملكية المراكز (`position_owner_wallet_id`).

**Visual groupings (UX-only, no fields):** بطاقة لكل محفظة تنفيذ · شارة حالة (مشتقّة بصرياً من `execution_wallet_status`) · شارة signer (من `signer_profile_status`) · لوحة تدوير · قائمة نقل أصول معلّقة · لوحة vault/كنس · تمييز بصري للمحافظ غير المؤهّلة (signer معطّل).

**User flows:** تسجيل محفظة (`WARMING_UP`) ← تفعيل بعد الفحوص (`activate`) ← إسناد policy ← (عند الحاجة) تدوير/نقل أصل/كنس. ولوضع buy/sell: إنشاء asset transfer ← متابعة الحالة حتى `CONFIRMED` ← انتقال الملكية.

**Actions / command_type:** `register_execution_wallet` · `activate_execution_wallet` · `drain_execution_wallet` · `disable_execution_wallet` · `revoke_execution_wallet` · `set_execution_wallet_assignment_policy` · `register_signer_profile` · `disable_signer_profile` · `revoke_signer_profile` · `create_asset_transfer_intent` · `cancel_asset_transfer_intent` · `rotate_execution_wallet` · `complete_wallet_rotation` · `sweep_profits`.

**Permissions:** العرض حسب الصلاحية (قد يتطلّب admin لرؤية المحافظ/التوقيع)؛ `register/activate/drain/disable` لـ `admin`؛ `revoke_execution_wallet`/`revoke_signer_profile`/`register_signer_profile` لـ `signer_control`؛ `create_asset_transfer_intent`/`sweep_profits`/`rotate` لـ `admin` (+`signer_control` للحرج).

**States:** *loading*: هياكل بطاقات. *empty*: لا محافظ تنفيذ → دعوة لتسجيل أولى. *error*: تعذّر الجلب → تحذير + لا عرض حالة قديمة كأنها حيّة. *populated*: حيّ. *WARMING_UP*: المحفظة الجديدة تُعرض «قيد الفحص — غير مؤهّلة بعد» بصرياً، لا «جاهزة».

**Safety confirmations:** `activate_execution_wallet` → تأكيد يعرض نتيجة الفحوص (funded/signer/limits/custody/not-revoked)، يُمنع إن لم تكتمل. `revoke_*` → تأكيد مشدّد «إبطال نهائي». `create_asset_transfer_intent` → تأكيد يوضّح «الملكية لا تنتقل إلا عند CONFIRMED». `rotate_execution_wallet` → تأكيد بتدفّق التدوير. `sweep_profits` → تأكيد «يكنس للوجهة المعتمدة، لا يغيّرها».

**Explicit non-fields / no local computation:** «wallet limits / last used / last sweep / wallet health / signer health / rotation progress» كلها **visual groupings لا response fields** (`wallet_limits`/`last_used_at`/`last_sweep_at`/`last_sweep_status`/`wallet_health`/`signer_health`/`rotation_progress` ليست مسجّلة — تمرّ عبر ARCHITECTURE→SSOT→API إن لزمت). الواجهة لا تقرّر أهلية محفظة محلياً — تعرض `execution_wallet_status`/`signer_profile_status` من API. **لا تعرض ولا تطلب private key/seed إطلاقاً** (التوقيع معزول، §4.3).

> **قاعدة الأمان البصرية:** محفظة `WARMING_UP` أو `signer_profile_status` غير `ACTIVE` → تُعرض «غير مؤهّلة للدخول الجديد» بوضوح، لا تبدو جاهزة. وvault (`settlement`/`funding`) يُعرض كمحفظة لا تتداول.

---

## 12. Operator Experience & Guided Product (تجربة المشغّل والمنتج الموجَّه)

> طبقة عامّة تطبّق مبادئ §2.9–§2.15 على كل المنتج: تشغيل لشخص عادي غير مبرمج، ثنائي اللغة، قائم على workflows، مع شرح وتخصيص وAllowed Now. لا حقول SSOT جديدة؛ labels/شروح/تفضيلات = UX-only.

### 12.1 Guided Workflows (تدفّقات موجّهة)
بدل الجداول الخام، يقدّم المنتج مسارات: البدء/الإعداد · إضافة محفظة متبوعة · فهم جودة المحفظة (Copyability) · ضبط نمط النسخ · ضبط المخاطر والخروج · مراقبة فرص العملات الجديدة · مراجعة سبب القبول/الرفض · مراقبة المراكز · الأداء/Attribution · التحضير لـ paper/test/live · الاستجابة للتحذيرات والأفعال المحظورة. كل تدفّق يربط عرضاً مؤصَّلاً بأمر `command_type` قائم حيث تسمح `permission_role`.

### 12.2 Config Explainability (شرح الإعداد — لا schema dump)
لكل حقل قابل للضبط: label بشري (عربي/EN) · شرح · سلوك default/off · أثر التفعيل · يؤثّر على الدخول الجديد أم المراكز المفتوحة · الفئة (Hard Risk / EV threshold / Entry Filter / Exit Policy / display-only) · مثال عند الفائدة. حقول v1.8:

| field (canonical) | label عربي / EN | شرح بشري | الفئة · السلوك |
|---|---|---|---|
| `fast_hunt_window_ms` | نافذة الصيد السريع / Fast hunt window | المدّة القصوى بعد ظهور التوكن للسماح بالدخول؛ بعدها الفرصة `watch_only`/`expired` | Entry Filter · unset = معطّل (لا أثر) · دخول جديد فقط · ليس Hard Risk |
| `require_pullback` | اشتراط الارتداد / Require pullback | لا يدخل إلا بعد ارتداد سعري | Entry Filter · default off · دخول جديد |
| `chase_guard` | حارس المطاردة / Chase guard | يمنع الدخول خلف شمعة صاعدة بعنف | Entry Filter · default off |
| `min_token_readiness` | أدنى جاهزية للتوكن / Min token readiness | لا يدخل إن كانت جاهزية التوكن دون العتبة (يقرأ مؤشّراً محسوباً) | Entry Filter · unset = معطّل |
| `max_entry_volatility` | أقصى تذبذب للدخول / Max entry volatility | يرفض الدخول عند تذبذب لحظي مرتفع | Entry Filter · unset = معطّل |
| `single_wallet_min_confidence` | أدنى ثقة لمحفظة واحدة / Single-wallet min confidence | حدّ الثقة للدخول بإشارة محفظة واحدة | Entry Filter · يقرأ ذكاء المحفظة |
| `max_liquidity_share_pct` | أقصى حصّة من السيولة / Max liquidity share % | يحدّ حصّة صفقتك من سيولة البركة؛ قد يقلّل الحجم أو يرفض | Entry/Sizing · **ليس Hard Risk** · يتعايش مع حدّ حجم المركز |
| `stop_loss_pct` | نسبة وقف الخسارة / Stop-loss % | يطلق خروجاً عند خسارة بهذه النسبة؛ يمرّ بجدوى الخروج (قد لا يُنفَّذ فوراً في سيولة رقيقة) | Exit Policy · **ليس Hard Risk** · تشديده فوري (audited) · تخفيفه للجديد/migration |
| `max_time_in_position` | أقصى زمن في المركز / Max time in position | يطلق خروجاً زمنياً بعد هذه المدّة | Exit Policy · ضبط قيمة = تفعيل |

> الحقول display-only تُشرَح أيضاً بلغة بشرية، مثال: `entry_slippage_vs_leader` → «فرق دخولي عن المحفظة القائدة» → «كلما زاد، صارت النسخة أسوأ بسبب التأخير/الانزلاق».

### 12.3 Progressive Disclosure (إفصاح تدريجي)
طبقات: ملخّص → سبب → متقدّم → canonical. مثال رفض: «هذه الفرصة مرفوضة» → «إشارة DexScreener وحدها لا تكفي للتنفيذ» → `rejected_reason = dex_only_signal`.

### 12.4 Customization & Preferences (تخصيص — UI-only)
لغة AR/EN · اتجاه RTL/LTR · أعمدة الرادار/الجداول · views/filters محفوظة · عروض config per-wallet · presets مخاطر/خروج · تفضيلات تنبيه · compact/detailed.

> **Presets:** قوالب UX **تعبّئ حقول Config المسجّلة فقط**، تخضع لـ validation/preview قبل الحفظ، وتُظهر بالضبط أي حقول Config ستغيّرها. **ليست حقولاً جديدة · لا تتجاوز Config validation · لا تتجاوز Hard Risk · لا تتجاوز Exit Feasibility.**

> **User preferences:** التفضيلات المحفوظة server-side تُمثَّل عبر سطح التفضيلات المرشّح في §26.12؛ تبقى candidate (غير منفّذة) ولا تُعدِّل strategy/risk/live/signer config.

### 12.5 Allowed Now (على مستوى المنتج)
لوحة تشرح بلغة غير تقنية: ما يمكن للنظام فعله الآن · ما لا يمكنه · لماذا فعل محظور · ما الذي يغيّره المستخدم إن أمكن · **نوع المنع**: Hard Risk · EV · state (`operating_state`) · route · Exit Feasibility · signer/key · config validation · derived read-only.

### 12.6 Bilingual / RTL
كل §12–§13 RTL عربية مع EN؛ labels بشرية ملك UX فوق `source_of_truth_field` (مبدأ 8/10).

> **Help / Glossary:** محتوى يربط `source_of_truth_field` بـ label/شرح. الحفظ/التحرير server-side يُمثَّل عبر سطح المسرد المرشّح في §26.13؛ يربط SSOT **ولا يعيد تعريفه** (system_managed افتراضاً، admin_editable permissioned فقط).

---

## 13. New-Coin Hunting Surface (سطح اكتشاف العملات الجديدة)

> توسعة تطبّق ARCHITECTURE §4.4 وتعرض مفردات SSOT Groups 16–21. **كلها عرض/تشخيص؛ لا command_type تنفيذي جديد، ولا زرّ شراء من اكتشاف.** الحقول القابلة للتحرير (فلاتر G19/G21) تُضبط في Settings & Safety / Wallet Registry فقط.

### 13.1 New Coin Radar
- **Purpose:** عرض/ترتيب فرص العملات الجديدة (مراقبة وتشخيص) — لا اتخاذ قرار تنفيذ.
- **Displays (SSOT):** `token_opportunity` · `hunt_status` · `new_token_priority_score` (ترتيب/طابور فقط) · مؤشّرات Token Risk (§13.3) · Latency (§13.5).
- **Quote-mint badge (UX-only، يعرض `quote_mint`):** `Quote: WSOL` · `Quote: USDC` · `Quote: Unknown`. عند `quote_mint=unknown` أو USDC معروف لكن `usdc_quote_enabled=false`: تُعرض البطاقة كـ **skipped / unsupported current policy** (سبب `unknown_quote_mint`)، **بلا زرّ شراء ولا تحوّل إلى manual buy shortcut**.
- **Visual groupings (UX-only):** جدول/بطاقات مرتّبة بـ `new_token_priority_score` · شارات `hunt_status` (§13.7) · tags نضارة.
- **Actions / command_type:** لا شيء تنفيذي (عرض + تنقّل).
- **Permissions:** عرض للكل.
- **States:** loading: هياكل · empty: لا فرص · error: لا عرض قديم كأنه حيّ · populated: حيّ عبر stream حين يتوفّر.
- **Safety:** لا زرّ شراء من اكتشاف · `new_token_priority_score` للترتيب لا «درجة شراء» · ترتيب أعلى ≠ تنفيذ.
- **Explicit non-fields:** «عدد الفرص»/`opportunities_count` عرض بشري لا حقل · «huntability» مرفوضة كمفهوم.

### 13.2 Decision Trace / Timeline
- **Purpose:** لماذا قُبِلت/رُفِضت فرصة — خطّ زمني للقرار.
- **Displays (SSOT):** انتقالات `hunt_status` · `accepted_reason` · `rejected_reason` (مربوطة بـ `failure_type`/`api_error_code`/بوابات EV/Risk/Token-2022/route القائمة).
- **Actions:** read-only.
- **Safety:** الأسباب **تسجّل لا تَحجب/تُجيز**؛ لا تحرير على `accepted_reason`/`rejected_reason`/`hunt_status` (محاولة → `READ_ONLY_FIELD_REJECTED`).
- **Explicit non-fields:** لا تُخترَع حقول أسباب جديدة في UX؛ أي أسباب إضافية تستخدم حقول SSOT/API القائمة أو تمرّ ARCH→SSOT→API قبل العرض.

### 13.3 Token Risk Panel
- **Purpose:** إشارات خطر التوكن التشخيصية.
- **Displays (SSOT):** `recycled_token_flag` · `name_impersonation_score` · `creator_launch_rate_flag` · `token_readiness_score`.
- **honeypot-by-upgrade (عرض):** عند ظهور `candidate_token_safety_reason = hook_upgraded_mid_hold` يُعرض كـ **تحذير / سبب emergency-exit** على المركز (لا كمكوّن دخول)؛ الأدلّة/provenance القائمة تُعرض كدليل تشخيصي فقط. **لا hash field جديد · لا زرّ.**
- **Exit feasibility / liquidity (help text):** عند وجود `wash_fake_activity_risk`، يوضَّح أن exit feasibility يستخدم **effective liquidity لا raw reserves** (label/help/warning فقط — لا حقل UX جديد).
- **Safety:** **derived/display، ليست بوابات**؛ تتحوّل لرفض **فقط** عبر عتبة Config مسجّلة (`min_token_readiness`)؛ لا تحرير (derived).

### 13.4 Wallet Copyability Panel
- **Purpose:** ذكاء المحفظة المتبوعة وقابلية نسخها.
- **Displays (SSOT):** `copyability_by_brain` · `crowd_follow_score` · `profit_concentration` · `tracked_wallet_status`.
- **Actions:** المتابعة عبر `enable_wallet_follow`/`disable_wallet_follow` (Wallet Registry).
- **Safety:** `tracked_wallet_status` **derived/read-only، لا يفتح تنفيذاً وحده**؛ `banned` = **سياسة متابعة لا حظر أمني ولا إغلاق مراكز**؛ متمايز عن `follow_enabled` (نيّة) و`execution_wallet_status` (مفاتيح، §11).

### 13.4a Wallet Decision Trace (Gap E — تأليف عرضي فقط)
- **Purpose:** «لماذا هذه المحفظة بهذه الحالة» — أثر قرار على مستوى المحفظة (نظير §13.2 للفرصة لكن للمحفظة).
- **طبيعته:** **تأليف عرضي/read-only فوق حقول SSOT/API القائمة** — **ليس مورداً ولا `resource_type` ولا حقل/endpoint/أمر/اسم SSOT جديد** (لا `wallet_decision_trace`/`decision_trace_view`/`wallet_decision_score`). الواجهة **لا تحسب مخاطر/ميزة محلياً** ولا تستبدل `tracked_wallet_status`.
- **عرض متدرّج (Displays — حقول قائمة فقط):** **ملخّص:** `tracked_wallet_status`. **السبب الأساسي (حيث توفّر):** `candidate_copyability_component_veto`/`candidate_copyability_veto_reason` (§28.7a) · `candidate_edge_health_status` (§28.7b) · `candidate_wallet_drift_reason`/`candidate_wallet_drift_recommendation` · `candidate_adverse_selection_severity` · `insufficient_evidence` حيثما ظهرت. **تشخيصات داعمة:** `copyability_by_brain`/`crowd_follow_score`/`profit_concentration` · `candidate_fake_profit_adjusted_edge` · `candidate_profit_source_copyability_class` · `candidate_wallet_type` · إعادة بناء القائد `candidate_leader_position_change_pct`/`candidate_leader_balance_reconstruction_status` (§26.8a) · أمان التوكن `candidate_token_safety_reason` · `accepted_reason`/`rejected_reason` حيث صلتها. **الحقول الـ canonical في advanced mode فقط.**
- **Safety:** **`insufficient_evidence` ليست آمنة · أداء Paper ليس ميزة Real · `no_edge_suspected` استشاري لا أمر · `banned` سياسة متابعة/تقييم لا حظر أمني لمحفظة تنفيذ.** لا حقل قابل للتحرير · لا حساب محلي · لا أزرار تنفيذ/buy/mirror/promote-to-copy · لا auto-ban/auto-close/auto-config/auto-disable · لا forced live blocker · لا `copy_event` جديد · لا opportunity execution. **أي فعل للمشغّل عبر تدفّقات wallet/config/user/permission/audit القائمة فقط.**
- **Explicit non-fields / no local computation:** لا تُخترَع حقول/أسباب/score جديدة؛ الأثر **تجميع بصري** لأسباب مُسجَّلة تُعرَض من API (نظير قاعدة §13.2). أي سبب إضافي يمرّ ARCH→SSOT→API قبل العرض.

### 13.5 Latency / Attribution Panel
- **Purpose:** تشخيص الكمون ونسب الفروق.
- **Displays (SSOT):** `discovery_latency_ms` · `signal_to_execution_ms` · `latency_to_copy` · `entry_slippage_vs_leader` (القياس المحقّق).
- **Landing-bias diagnostic (يعرض `candidate_landing_outcome_by_heat_bucket`):** تبويب {attempted · landed · failed · expired · skipped} حسب heat bucket و(route/provider/fee bucket حيث مناسب). **تشخيص فقط — لا gate · لا auto-config · لا recommendation auto-apply.**
- **Safety:** تشخيص فقط — **لا يحجب بنفسه**؛ الحجب فقط عبر عتبة Config `max_entry_slippage_vs_leader` (تُعرض كقيمة Config منفصلة).

### 13.6 Allowed Now (سطح الاكتشاف)
- **Displays (SSOT):** `hunt_status` (`accepted`/`entered` مقابل `watch_only`/`gated`/`rejected`/`expired`) + حالة البوابات القائمة + `operating_state`.
- **Safety (حاسم):** يفصل **executable** (wallet/cluster-confirmed وبوابات مارّة) عن **discovery-only (غير قابل للتنفيذ)**؛ mint مكتشَف وحده → «مراقبة فقط، غير قابل للتنفيذ». **`accepted` ليست إذن شراء ولا تنشئ زرّ شراء.** EXITS_ONLY/KILLED تمنع الدخول بصرياً.

### 13.7 Cross-Cutting (badges · freshness · alerts · category · RTL)

**خريطة الـ badges النهائية (لا HUNTABLE):**

| badge / عربي | المصدر (SSOT) |
|---|---|
| DISCOVERED / مكتشفة | `hunt_status = discovered` |
| RANKED / مرتبة | `hunt_status = ranked` |
| UNDER_EVALUATION / قيد التقييم | `hunt_status = gated` |
| ACCEPTED / مقبولة *(«اجتازت التقييم — تحتاج مسار تنفيذ آمن»)* | `hunt_status = accepted` |
| ENTERED / تم الدخول | `hunt_status = entered` |
| WATCH_ONLY / مراقبة فقط | `hunt_status = watch_only` |
| EXPIRED / انتهت النافذة | `hunt_status = expired` |
| REJECTED / مرفوضة | `hunt_status = rejected` |
| DEX_ONLY / إشارة DEX فقط | `rejected_reason = dex_only_signal` |
| LATE_CHASE / مطاردة متأخرة | **UX-only** warning من `fast_hunt_window_ms`/`chase_guard` (ليس state/enum) |

- **`accepted` ليست تنفيذاً مباشراً**؛ الدخول يبقى wallet/cluster-led أو signal-confirmed وعبر كل بوابات التنفيذ.
- **Freshness tags:** live (من stream) · delayed (فجوة/قديم) · estimated (derived غير مؤكَّد) — UX-only.
- **Alert de-dup:** دمج تنبيهات الاكتشاف/التشخيص المكرّرة (UX-only)؛ **لا يُدمَج أبداً** تنبيه أمني (`operating_state`/`WARNING_CRITICAL`/exit).
- **Category distinction (مبدأ 4):** Config-editable = فلاتر G19/G21 (تُحرَّر في Settings & Safety/Wallet Registry) · runtime = `hunt_status` · derived = الدرجات/الأعلام/الكمون/copyability/`tracked_wallet_status` (read-only؛ تحرير → `READ_ONLY_FIELD_REJECTED`).
- **RTL/i18n:** كل اللوحات RTL عربية مع EN.

### 13.8 Rejected UX Behaviors (سلوكيات مرفوضة)
تُرفض في الواجهة: شارة **HUNTABLE** (محظورة كلياً) · زرّ شراء من اكتشاف mint · DexScreener-only كموافقة تنفيذ · `new_token_priority_score` كـ «درجة شراء» · جعل أي حقل derived/runtime/decision قابلاً للتحرير · تقديم `accepted` كإذن شراء مباشر · الإيحاء بأن `full_mirror` يتجاوز الأمان · إخفاء سبب المنع · أي زرّ تنفيذ خارج نموذج الأوامر/الموارد القائم · أي preset يتجاوز validation/Hard Risk/Exit Feasibility.

---

> **الأقسام 14–24 (UX Addendum):** تحوّل التطبيق إلى منتج تشغيل يومي لشخص عادي غير مبرمج. كل عنصر موسوم: **[E]** EXISTING_SSOT_BACKED · **[U]** UX_ONLY. **عناصر [F] السابقة حُسمت في F-Elimination:** المُرقّى يُمثَّل كـ candidate UX surfaces في §26؛ والمرفوض يبقى Rejected/Forbidden صراحةً. لا يُترك أي عنصر «pending/مؤجّل»؛ أي إشارة لتاريخ [F] هنا تُحيل إلى §26 أو إلى قائمة Rejected/Forbidden فقط، ولا تُعرَض أي قدرة مُرقّاة كأنها implemented.

## 14. Trading Workspace (مساحة التداول)

**Purpose:** مركز التداول الحيّ — مراكز، شارت، خروج محكوم. ليست جدولاً فقط.

**Live Trades:** `position_state` [E] · `entry_brain`/`current_control_brain` [E] · `market_phase`/`migration_phase` [E] · `active_exit_route` [E] · الـ intent المرتبط (`intent_id`/`intent_type`/`bundle_status`/`failure_type`) [E] · أهداف الإعداد `take_profit_pct`/`stop_loss_pct`/`max_time_in_position` [E] · `execution_wallet_address`/`position_owner_wallet_id` [E] · أزرار نسخ [U].
- هوية التوكن على المركز → §26.7 (mint canonical/symbol trust) · السعر/المسافة للهدف-الوقف → §26.2 (`candidate_current_mark_view`، لا `current_price`) · إسناد القائد على المركز → §26.8 · زمن منذ الدخول مشتقّ عرضاً. **P&L:** الأسماء غير المسبوقة **مرفوضة (rejected)**؛ القيم المسبوقة (`candidate_realized_pnl`/`candidate_unrealized_pnl`…) تُعرض من backend read-model فقط (§26.1/§25.1)، بلا حساب محلي، وunrealized بشرط mark `valid`.

**Professional Chart Workspace:** لوحة شارت للتوكن/المركز المحدّد [U layout] · التبويبات/التخطيط [U] · خطوط أهداف TP/SL من `take_profit_pct`/`stop_loss_pct` [E] · latency/slippage markers من `entry_slippage_vs_leader`/`*_ms` [E] · علامات دخول/خروج وleader signal markers وtrade replay وprice/candle → عبر أسطح §26.2/§26.3/§26.8/§26.17 (candidate، بمكتبة احترافية + provenance). **لا اختراع حقول سعر في UX · لا order-book في AMM.**

**Exit actions:** `manual_exit_position` [E] · `emergency_exit_position` [E] · `cancel_intent` على intent معلّق [E].

**Batch exit:**
- multi-select UI = **[U]**.
- تكرار `manual_exit_position`/`emergency_exit_position` لكل مركز محدّد = **[E] command orchestration** — كل مركز يمرّ منفرداً عبر `permission_role`/`position_state`/route/Position Manager/Exit Feasibility، وينتج confirmation/result مستقلّاً.
- أمر ذرّي `exit_all_positions`/`batch_exit_all_positions` = **مرفوض دائماً (forbidden)**؛ البديل الآمن preview→request per-position في §26.9.

> **Batch orchestration must show per-position result: submitted / blocked / failed / skipped. One position passing checks does not imply the others passed. No silent mass exit.**

**Safety:** لا شراء من mint · لا تجاوز أمان لكل مركز · معاينة المراكز المتأثّرة قبل الخروج الجماعي · إظهار سبب تعذّر الخروج من `failure_type`/`active_exit_route`/`position_state`/`operating_state` [E].

## 15. Trade Timeline / Journal (الخطّ الزمني للصفقة)

**Purpose:** «ماذا حدث لهذه الصفقة» — منفصل عن Audit («من فعل ماذا»).

**Displays (من حقول قائمة [E]):** `hunt_status` · `accepted_reason` · `rejected_reason` · `intent_type` · `intent_id` · `bundle_status` · `failure_type` · `position_state` · `copy_event` · `event_timestamp` · `audit_reason` عند اللزوم.

**Trade Event / Journal:** يُمثَّل عبر `candidate_trade_event`/`candidate_trade_journal` في §26.3 — candidate UX surface (غير منفّذ) بلا أسرار. **UX-only:** بناء/عرض الخطّ الزمني وفصله بصرياً عن Audit [U].

## 16. Wallet Intelligence & Token Research (ذكاء المحافظ وبحث التوكن)

### 16.1 Followed & Watch-only Wallets
**Displays [E]:** المنسوخة (`follow_enabled=true` + `tracked_wallet_status=copy_allowed`) · watch-only (`watch_only`) · candidate · degraded · banned-as-follow-policy (`banned` = **سياسة متابعة لا حظر أمني ولا إغلاق مراكز**) · مؤشّرات `copyability_by_brain`/`crowd_follow_score`/`profit_concentration`.
**Actions [E]:** تعديل إعدادات النسخ لكل محفظة (`copy_mode` + per-wallet config) عبر `update_wallet_config` · المبلغ/الحجم (`sizing_mode`/`sizing_value`/`capital_reference`) · سياسة الخروج (`take_profit_pct`/`stop_loss_pct`/`max_time_in_position`) · إيقاف النسخ (`disable_wallet_follow`).
**Promoted (candidate):** آخر إشارات كل محفظة (`last_signal_at`) · الأداء بعد النسخ → P&L by wallet في §26.1 · سعة `max_followed_wallets`.

### 16.2 Token Wallet Profit Explorer
**Shell [U]:** لصق mint → تخطيط نتائج. **Promoted (candidate):** wallet-token performance → §26.4 (مع badge اكتمال التكاليف) · early buyers/clusters/repeat winners → §26.5 (مع confidence/provenance، احتمالي لا حقيقة). creator-linked: `creator_launch_rate_flag` [E]؛ `tracked_wallet_status` [E]. **لا نسخ أعمى من هذه المقاييس · لا تُقدَّم كأنها implemented.**

## 17. Portfolio & P&L Analytics (المحفظة والأداء)

**Legacy (rejected/forbidden):** الأسماء غير المسبوقة `realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`pnl_by_*` **مرفوضة**. **candidate read-model (تُعرض من backend فقط — §26.1/§25.1):** `candidate_realized_pnl`/`candidate_unrealized_pnl`/`candidate_fees_total`/`candidate_slippage_cost`/`candidate_paper_pnl`/`candidate_pnl_by_wallet`/`_by_brain`/`_by_copy_mode` + `candidate_remaining_daily_loss_budget`؛ unrealized بشرط `candidate_mark_status=valid`. **Existing [E]:** `entry_slippage_vs_leader`. **UX-only [U]:** trade count عرضاً مشتقّاً · التخطيط. **لا P&L محسوب محلياً كمصدر حقيقة — العرض من backend/data read-model فقط · لا P&L على Opportunity/Radar.**

## 18. My Wallets & Funds (محافظي وأموالي)

**Execution/signer [E]:** `execution_wallet_id`/`execution_wallet_address`/`execution_wallet_status` · `key_custody_mode` · `signer_profile_id`/`signer_profile_status` · `wallet_rotation_status` · `profit_sweep_policy`/`profit_sweep_interval_ms` · `settlement_wallet_address` · `position_owner_wallet_id`.
**Funding wallet:** `funding_wallet_id`/`funding_wallet_address` = **[E]** · الأرصدة/المتاح للكنس/sweep history تُمثَّل كـ candidate في §26.6 (`candidate_execution_wallet_balance`/`candidate_profits_available_to_sweep`/`candidate_sweep_history`) — غير منفّذة، مع reconciliation/provenance، وحجب الكنس عند mismatch، وبلا مفاتيح خام.
**Actions [E]:** `sweep_profits` · `create_asset_transfer_intent`/`asset_transfer_status`. **UX-only [U]:** أزرار نسخ العناوين.
**Safety:** **لا عرض ولا طلب private key/seed إطلاقاً** · عزل signer · تأكيدات خطرة [E principle].

## 19. Reports & Export (التقارير والتصدير)

**UX-only [U]:** One-click Markdown System Intelligence Report · CSV/JSON — قالب فوق بيانات API المتاحة.
**أقسام القالب [E]:** System Status (`operating_state`/`real_live_config_valid`) · Config Summary · Risk Readiness (اكتمال Group 6) · Followed/Watch-only (`tracked_wallet_status`/`follow_enabled`) · Execution Wallets · Open Positions (`position_state`) · Rejected Opportunities (`rejected_reason`) · Latency (`*_ms`/`entry_slippage_vs_leader`) · Failures (`failure_type`) · Recent Audit (`audit_*`). **P&L/Closed-economic:** الأسماء القديمة غير المسبوقة **مرفوضة (rejected)**؛ أمّا أقسام candidate P&L فتُدرَج فقط حين تأتي من backend/data read-model (`candidate_*` — §26.1/§26.11) وتُعلَّم بوضوح؛ القيم المفقودة تتبع `candidate_report_missing_metric_policy` (show_unavailable/omit/block_report) — لا اختلاق أرقام. **[U]:** Canonical Field Appendix.
**Redaction:** **لا تتضمّن التصديرات إطلاقاً private keys/seed phrases/secrets/signer credentials/auth tokens** · العناوين تُدرَج إن كانت ظاهرة للمستخدم مع **وضع redaction اختياري** · الأقسام بلا بيانات تتبع missing-metric policy ولا تُختلق أرقامها · صيغ التصدير markdown/csv/parquet/jsonl. المورد المحفوظ للتقارير server-side يُمثَّل كـ candidate في §26.11 (مع provenance/generated_at وredaction policy).

## 20. Alerts Center (مركز التنبيهات)

**Existing-backed alerts [E]:** opportunity discovered/rejected (`hunt_status`/`rejected_reason`) · DEX-only (`rejected_reason=dex_only_signal`) · exit failed (`failure_type`) · route invalid (`active_exit_route`/`rejected_reason=route_invalid`) · latency spike (`*_ms`) · wallet degraded (`tracked_wallet_status=degraded`) · REAL-LIVE invalid (`real_live_config_valid=false`) · signer/execution degraded (`execution_wallet_status`/`signer_profile_status`). late chase = سياق `fast_hunt_window_ms`/`chase_guard` [U/E]. near TP/SL: الأهداف [E]، و«القرب» يُحتسَب من `candidate_current_mark_view` (§26.2) مع mark `valid` — لا `candidate_current_price`.
**UX-only [U]:** تجميع/de-dup بصري. **Persisted alerts (candidate — §26.10):** قواعد/تفضيلات/أحداث/إقرارات التنبيه (`candidate_alert_rule`/`_preference`/`_event`/`_ack`). **Rule:** **تنبيهات فئة security مع critical لا تُدمَج/تُخفى/تُسكت أبداً.**

## 21. Visual Design System (النظام البصري) — [U] بالكامل

light theme أولاً · خلفية off-white · تباين مريح · typography واضح · cards/tables/panels · أخضر ربح/أحمر خسارة/أصفر تحذير/رمادي watch-only · نظام badges واضح · شريط حالة علوي لاصق (`operating_state` دائماً مرئي [E مصدر]) · compact/detailed · responsive · accessibility contrast · أسلوب تداول احترافي بلا ازدحام · معايير AR/EN + RTL/LTR (كل label/tooltip/empty-state/warning/confirmation/report قابل للتوطين، بلا أعطال اتجاه).

## 22. Beginner / Advanced Mode (وضع المبتدئ/المتقدّم) — [U] بالكامل

Beginner: شروح بسيطة، أسماء حقول أقل، أفعال موجّهة. Advanced: أسماء canonical · `intent_id` · `failure_type` · تشخيص الكمون. **تفضيل عرض فقط؛ لا يُخفي تحذيرات الأمان في أي وضع** (`operating_state`/`WARNING_CRITICAL`/EXITS_ONLY دائماً ظاهرة).

## 23. Help / Glossary (المساعدة والمسرد) — [U] محتوى

AR/EN · `source_of_truth_field` → label → شرح. أمثلة: `watch_only` · `accepted` · Exit Feasibility · DexScreener-only · `follow_enabled` مقابل `tracked_wallet_status` · `execution_wallet_status`. المسرد القابل للتحرير/المحفوظ server-side يُمثَّل كـ candidate في §26.13 (يربط SSOT ولا يعيد تعريفه؛ system_managed افتراضاً، admin_editable permissioned).

## 24. Onboarding Wizard (معالج البدء)

**Steps:** اختيار اللغة/الاتجاه [U] · اختيار beginner/advanced [U] · أول محفظة متبوعة (`register_wallet`) [E] · `copy_mode` [E] · أساسيات الدخول/الخروج (فلاتر G19/G21) [E] · ضبط Hard Risk (Group 6 عبر `update_config`) [E] · البدء في paper/watch إن اختار المستخدم **بلا paper timeline إجباري** (`user_enabled_paper_gate`) [E] · شرح live readiness/البوابات (`real_live_config_valid`) [E].
**Funding/settlement:** عرض `funding_wallet_id`/`funding_wallet_address`/`settlement_wallet_address` = **[E]** · اختيار/تأكيد قيم مُعدّة سلفاً = **[E]** إن جاءت من API/config · **إنشاء/تعديل** funding/settlement من الـ onboarding **لا يُخترَع خارج SSOT/API**؛ يمرّ فقط عبر command/config flow معتمد.

> **The onboarding wizard must not invent wallet-update commands. It can guide the user to existing wallet/config flows; any new wallet setup/update operation must pass Architecture → SSOT → API.**

**UX-only [U]:** تخطيط الـ wizard. **Promoted (candidate):** الأرصدة → §26.6 · تقدّم الـ onboarding المحفوظ → §26.14 (حالة/مراجع فقط، بلا أسرار، لا تجاوز readiness).

> **سلوكيات UX مرفوضة (شاملة §14–§24):** زرّ شراء من mint · تنفيذ من `accepted` · DexScreener-only كموافقة · `new_token_priority_score` كدرجة شراء · تحرير حقول derived/runtime/decision · إخفاء سبب المنع · batch exit يتجاوز Exit Feasibility لكل مركز · خروج جماعي صامت · P&L محلي كمصدر حقيقة · تصدير مفاتيح/seeds/أسرار/tokens · شارة **HUNTABLE** · إدخال تفضيلات/تقارير/أوامر محافظ صامتاً كحقول/أوامر API. **صراحةً (F-Elimination):** أسماء P&L القديمة غير المسبوقة (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`) **rejected** · `candidate_current_price` **rejected** (البديل `candidate_current_mark_view`) · الأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` **forbidden** (البديل §26.9 preview→request) · `buy_opportunity`/`execute_opportunity`/`submit_opportunity` **forbidden**. (المقابل: القدرات المُرقّاة candidate في §26.)

---

## 25. v1.8 Delta — UX Surfaces (candidate, تستهلك SSOT Groups 22–27)

> أسماء `candidate_*` بانتظار التثبيت. مبادئ ثابتة: **UX يعرض ولا يحسب** · لا P&L محلي كمصدر حقيقة · Radar/Opportunity ليس زر شراء · `accepted` ليست buy · لا private/raw key. الأسماء القديمة غير المسبوقة **مرفوضة (rejected)**؛ هذه الأسطح تعرض read-model المسبوق فقط.

### 25.1 P&L Analytics (ترقية §17 — عرض backend read-model)
- §17 يعرض الآن P&L من **backend read-model** عبر `candidate_realized_pnl`/`candidate_unrealized_pnl`/`candidate_fees_total`/`candidate_slippage_cost`/`candidate_pnl_by_wallet`/`_by_copy_mode`/`_by_brain` و`candidate_remaining_daily_loss_budget`. **لا حساب محلي.**
- **unrealized يُعرض فقط مع `candidate_mark_status = valid`**؛ غير ذلك يُوسَم (stale/unavailable/low_confidence/display_only) ولا يُقدَّم كرقم موثوق. الأسماء غير المسبوقة (`realized_pnl`…) **مرفوضة (rejected)**.
- **قاعدة العرض:** realized وpaper P&L لا يُعرضان إلا إذا أتيا من backend read-model؛ وunrealized/mark-to-market لا يُعرضان إلا عند وجود mark metadata صارمة و`candidate_mark_status=valid`. القيم الناقصة تُعرض unavailable ولا تُختلق. لا حساب في UX · لا P&L على Opportunity/Radar.

### 25.2 Paper Portfolio (موسوم simulated)
- شاشة مستقلّة: paper positions/trades + paper PnL **موسومة `simulated` دائماً** (`candidate_paper_portfolio`/`candidate_paper_pnl`). تشغيل محفظة paper · تحويل paper→real (قرار المستخدم). تقرير paper يومي. **لا تُقدَّم كحقيقة بلا معايرة.**

### 25.3 Provider Setup Wizard
- إدخال سرّ آمن → اختبار اتصال (عبر `key_ref` بعد التسجيل) → role/tier/mode → enable/disable. عرض `candidate_provider_connection_status`. توصية «أضف مزوّداً ثانياً» (advisory). تحذير blind-spot دائم في `single`. **لا عرض raw key إطلاقاً.**

### 25.4 Strategy Sandbox (paper-only)
- مقارنة A-B على نفس الإشارات (`candidate_strategy_sandbox_run`). **paper-only صراحةً — لا يعدّل live/risk/signer/execution config.** مقارنة copy modes/sizing/TP على نفس الإشارات.

### 25.5 شاشات تشخيص تجميعية
- **غير مالية (تُبنى مبكراً):** «أكثر أسباب الرفض» (فوق `rejected_reason`) · «أكثر أسباب الفشل» (فوق `failure_origin`/`failure_type`) · accept-vs-reject (`candidate_filter_strictness_metric`) · net-copyability ranking (`candidate_wallet_net_copyability_rank`) · copy-mode comparison.
- **مالية (تتبع P&L read-model):** «لماذا لم نربح اليوم» · «أكثر الرسوم أكلاً» · «أسوأ المحافظ عند النسخ».
- dashboards: `candidate_storage_usage_metric`/`candidate_data_quality_metric` · `candidate_app_version`.

### 25.6 Recommendations Panel (advisory)
- عرض `candidate_recommendation` (+type/status). أزرار: preview → request-config-update (تمرّ عبر تدفّق config الرسمي). **لا زر «apply» مباشر يعدّل strategy/risk/live.**

### 25.7 Charts (ترقية §14 — مكتبة احترافية)
- مكتبة جاهزة (lightweight-charts/TradingView) — **لا engine من الصفر**. شموع من `candidate_ohlcv` تحمل `candidate_ohlcv_provenance`؛ display-only لا يُعرض كحقيقة تنفيذ. علامات: leader-entry مقابل our-entry **متمايزتان** · entry/exit/rejected · trade replay. في AMM: `candidate_liquidity_drain_metric`/`candidate_expected_slippage_estimate` بدل order-book.

### 25.8 Jobs / Maintenance من الواجهة (permissioned)
- run-jobs/import/open-reports/export (markdown/csv/parquet/jsonl) = permissioned، research≠execution، **لا تتجاوز risk/signer/secret/audit**. أزرار صيانة (restart/backup/purge/diagnostic-bundle) = **admin/local-ops only** مع شروط المنع (pending intents حرجة/أسرار/مفاتيح خام/audit مالي). شاشة incidents.

### 25.9 Freshness & Lifecycle
- وسوم freshness تشمل `paper`/`real`/`simulated`/`estimated`/`display_only`. تصنيف الفرصة `candidate_opportunity_lifecycle` (watch_only/diagnostic/executable_candidate/**copy_signal_candidate**) — **الأخيرة ليست أمر شراء**.

---

## 26. F-Elimination — UX Surfaces (candidate, تستهلك SSOT Groups 22–36)

> شاشات/حالات/labels/flows/display-rules/badges فقط — لا API contracts · لا DB schema · لا test cases · لا code/migrations/live. كل اسم مسجّل في SSOT (Groups 22–36) ويبقى `candidate_*` (أو label واضح لا يدّعي implemented). **UX يعرض ولا يحسب.** لا «pending/later/مؤجل» مفتوحة.

### 26.1 P&L UX (F1)
عرض من backend/data read-model فقط (لا حساب محلي): `candidate_realized_pnl`/`candidate_unrealized_pnl`/`candidate_fees_total`/`candidate_slippage_cost`/`candidate_paper_pnl`/`candidate_pnl_by_wallet`/`_by_copy_mode`/`_by_brain`/`candidate_remaining_daily_loss_budget`. **unrealized يُعرض فقط مع `candidate_mark_status=valid`؛ وإلا badge/تحذير (stale/unavailable/low_confidence/display_only) ولا يُقدَّم كموثوق.** لا P&L على Opportunity/Radar. labels قديمة مرفوضة (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`).

### 26.2 Price / Mark UX (F2)
كل سعر ظاهر يحمل `candidate_price_type`/`_provenance`/`_timestamp`/`_status`/`_confidence` + `candidate_current_mark_view`/`candidate_display_price`/`candidate_quote_price`/`candidate_fill_price`/`candidate_entry_price`/`candidate_quote_impact`. **لا `candidate_current_price` · display-only لا يُستخدم كحقيقة تنفيذ · شاشات AMM تستخدم لغة quote-impact/expected-slippage/liquidity-drain لا order-book ما لم يوجد order-book فعلي.**

### 26.3 Trade Event / Journal UX (F3)
Timeline/Journal للصفقة عبر `candidate_trade_event`/`candidate_trade_event_type`/`candidate_trade_id`/`candidate_trade_journal`: عرض signal→decision→risk→build→sign→send→land→fill/partial_fill→exit_attempt/exit_fill→close/failure حيث توفّر. يخدم replay/debug/reports/charts؛ **بلا أسرار**.

### 26.4 Wallet-Token Performance UX (F4)
عروض Smart Money/Wallet Intelligence: `candidate_wallet_token_performance`/`candidate_wt_net_result`/`candidate_wt_cost_completeness_status`/`candidate_wt_holding_time`/`candidate_wt_entry_timing`/`_exit_timing`/`candidate_wt_repeat_behavior`/`candidate_wt_point_in_time`. **وسم point-in-time/survivorship-free · badge اكتمال التكاليف · net_result لا يُعرض «كاملاً» إلا إذا status=complete · لا ranking أعمى بنتيجة ناقصة.**

### 26.5 Discovery Signals UX (F5)
عرض `candidate_early_buyer_rank`/`candidate_repeat_winner_metric`/`candidate_cluster_id`/`candidate_cluster_confidence`/`candidate_cluster_method`/`candidate_cluster_provenance` **مع confidence/provenance دائماً؛ احتمالي؛ لا execution authority منها.**

### 26.6 My Wallets & Funds UX (F6)
عرض `candidate_execution_wallet_balance`/`candidate_settlement_wallet_balance`/`candidate_funding_wallet_balance`/`candidate_profits_available_to_sweep`/`candidate_sweep_event`/`candidate_sweep_history`/`candidate_balance_provenance`/`candidate_balance_reconciliation_status`. **عرض provenance/reconciliation · `mismatch` يحجب الكنس مع تحذير · لا كنس من غير مالك · لا مفاتيح خام في الواجهة · تأكيد الكنس إلزامي · `auto_sweep` افتراضياً off · عرض سجلّ الكنس.**

### 26.7 Position Token Identity UX (F7)
على المراكز/الشارت/التقارير: `candidate_position_token_mint` (canonical) · `candidate_position_token_symbol`/`candidate_position_token_name` (display) · `candidate_token_identity_provenance` · `candidate_token_symbol_trust`. **mint canonical · symbol/name display/untrusted · تحذير `spoof_suspected` ظاهر · symbol/name ليست execution truth.**

### 26.8 Leader Attribution UX (F8)
على المراكز المنسوخة: `candidate_position_attribution`/`candidate_followed_wallet_id`/`candidate_leader_entity_id`/`candidate_attribution_cluster_id`/`candidate_signal_source`/`candidate_attribution_confidence`/`candidate_attribution_multi_leader`. **read-only · لا execution authority · عرض التعارض/تعدّد القادة دون طيّ صامت · يدعم leader-vs-copier.**

### 26.8a Leader Position Change UX (Gap A · داخل Decision Trace / تفاصيل المركز / إسناد القائد)
عرض داخل Decision Trace / position detail / leader attribution / شرح حدث النسخ (مدعوم بـ API §15.8a · DATA §9.8a): `candidate_leader_position_change_pct` · `candidate_leader_balance_reconstruction_status` (`reconstructed`/`partial`/`low_confidence`/`unavailable`). **display/read-only فقط** — **الواجهة لا تحسبهما محلياً، لا تسمح بتحريرهما، ولا تستخدمهما كأزرار/أوامر.** الاتّجاه/النوع من `copy_event` القائم (`leader_partial_sell`/`leader_full_exit`/`leader_scale_in`) لا من حقل/زر جديد؛ و`candidate_leader_position_change_pct` يُعرض كـ **مقدار** تغيّر مركز القائد بعد خصم التحويل/الـ cluster داخلياً. **إذا `candidate_leader_balance_reconstruction_status ∈ {unavailable, low_confidence}` يعرض شرحاً حذِراً/fail-safe: لا 0% ولا 100% ولا إيحاء بأن mirror أعمى آمن** — بصياغة مثل «إعادة البناء غير متاحة — مراجعة يدوية / إجراء محافظ مُوصى». أمثلة عرض: «بيع جزئي للقائد: 30% [reconstructed]» · «تغيّر مركز القائد غير متاح — معالجة محافظة». **لا تكشف الواجهة أرصدة داخلية خام** (`leader_wallet_balance_before/after`/`leader_cluster_balance`/`transfer_adjusted_balance`)، ولا `candidate_leader_sell_percentage`/`candidate_leader_buy_percentage`، ولا `full_exit_detected`/`partial_exit_detected` (تكرار `copy_event`)، ولا leader P&L، ولا `copy_event` جديد، ولا صفحة/زر جديد.

**Explicit non-fields / no local computation:** «نسبة تغيّر القائد»/«ثقة إعادة البناء» تُعرَضان من API §15.8a فقط؛ الواجهة لا تشتقّ النسبة ولا تقدّر الثقة محلياً، ولا تُحوّل الحالة إلى زرّ تنفيذ/mirror. محاولة كتابتهما → `READ_ONLY_FIELD_REJECTED` (سلوك القائم).

### 26.9 Batch Exit UX (F9)
**preview أولاً** عبر `candidate_cmd_preview_batch_exit` ثم `candidate_cmd_request_batch_exit`، باستخدام `candidate_batch_exit_preview_id`/`candidate_batch_exit_preview_item_status`/`candidate_batch_exit_preview_valid_until`/`candidate_batch_exit_result_status`. **لا زرّ باسم `exit_all_positions` ولا `batch_exit_all_positions` · multi-select مسموح لكن preview إلزامي يعرض eligible/blocked/stale لكل مركز · request مُعطَّل إن انتهت صلاحية/تقادَم الـ preview · نتيجة مستقلّة لكل مركز · لا mass exit صامت · تأكيد إلزامي.**

### 26.10 Alerts UX (F10)
Alerts Center: `candidate_alert_rule`/`candidate_alert_event`/`candidate_alert_ack`/`candidate_alert_severity` (info/warning/critical)/`candidate_alert_category` (security/risk/provider/data/ops/execution/wallet)/`candidate_alert_source`/`candidate_alert_preference`. **security+critical لا تُسكت · ack لا يخفي حقائق الحدث · التفضيلات لا تكتم التنبيهات الإلزامية.**

### 26.11 Reports / Exports UX (F11)
`candidate_report_definition`/`candidate_report_artifact`/`candidate_export_history`/`candidate_report_provenance`/`candidate_report_generated_at`/`candidate_export_job`/`candidate_export_format` (markdown/csv/parquet/jsonl)/`candidate_report_template_id`/`candidate_report_redaction_policy`/`candidate_report_missing_metric_policy`. **المقاييس المفقودة تُعرض unavailable/omitted/blocked حسب policy · لا اختلاق · لا أسرار · عرض provenance/generated_at وredaction policy.**

### 26.12 Preferences UX (F12)
`candidate_ui_preferences` (+ `candidate_pref_language` ar/en · `_direction` rtl/ltr · `_mode` beginner/advanced · `_visible_columns`/`_saved_views`/`_saved_filters`/`_notifications`). **UI state لا trading config · تغييرها لا يعدّل strategy/risk/live/signer · دعم AR/EN وRTL/LTR.**

### 26.13 Glossary / Help UX (F13)
`candidate_glossary_content`/`candidate_glossary_version`/`candidate_glossary_locale`/`candidate_glossary_sot_mapping`/`candidate_glossary_edit_policy`. **يربط SSOT ولا يعيد تعريفه · ar/en · system_managed افتراضاً · admin_editable permissioned فقط.**

### 26.14 Onboarding UX (F14)
`candidate_onboarding_progress` + `candidate_ob_steps`/`_completion_state`/`_selected_mode`/`_language_direction`/`_first_wallet_progress`/`_provider_setup_progress`/`_paper_setup_progress`/`_live_readiness_education_progress` + `candidate_onboarding_store_progress`. **حالة/مراجع فقط · لا raw provider key/private key/seed/signer credential/partial secret · provider progress عبر key_ref بعد التسجيل · لا تجاوز readiness gates · لا أوامر خارج SSOT/API.**

### 26.15 Provider Key Flow UX (F15)
raw provider key يُدخَل **مرّة واحدة** في secret registration flow؛ بعدها تعرض الواجهة `candidate_provider_key_ref` فقط؛ **لا raw key في browser state/reports/exports/logs/diagnostics/backups**؛ test connection عبر key_ref بعد التسجيل.

### 26.16 Opportunity / Radar Guard UX (F16)
Radar read-only/read-oriented · Opportunity بلا P&L · `accepted` ليست buy · `new_token_priority_score` ترتيب/عرض فقط · **لا زرّ buy/execute/submit opportunity · لا ربط ضمني Opportunity→تنفيذ.**

### 26.17 Charts UX (F17)
مكتبة احترافية (لا engine من الصفر) · هوية التوكن بـ mint canonical + badges ثقة الرمز · overlays من trade-event/journal + entries/fills/exits + leader attribution + mark/price provenance · OHLCV display-only يعرض provenance · شاشات AMM تستخدم quote-impact/liquidity-drain/expected-slippage حيث لا order-book.

---

## 27. Wave 1 — Profit & Paper Truth — UX Surfaces (candidate, تستهلك SSOT Group 37)

> عرض/سلوك/تحذيرات فقط — **لا schema · لا API · لا DB · لا أزرار write/execution جديدة · لا live/testnet/mainnet.** الأسماء API-facing من **SSOT Group 37** فقط (labels/شروح/badges بشرية = UX-only حسب §0). **كل قيمة Paper تحمل وسم `simulated` ولا تُعرَض كأموال حقيقية ولا تُخلَط مع real/live.** المقياس المفقود يُعرَض `unavailable` لا صفراً. AR/EN + RTL/LTR حيث ينطبق.

### 27.1 Anti-Fake Edge UX (W1-01) — توسعة §13.4 Wallet Copyability + §16 Wallet Intelligence
- **Displays (SSOT):** `candidate_fake_profit_risk` · `candidate_fake_profit_reason` · `candidate_fake_profit_adjusted_edge`.
- **Behavior:** عند ربح ظاهري مشكوك فيه يظهر **تحذير واضح** يذكر السبب (self_trading · wash_trading · fake_volume · linked_wallet_circular_activity · creator_dev_controlled_trading · artificial_liquidity_activity_loop). المحفظة **لا تُعرَض كـ «smart money قوية»** إذا كان الربح وهمياً.
- **User wording:** «الربح الظاهري خُصِم ولم يُعامَل كـ edge قابل للنسخ — السبب: …» (apparent profit was discounted / not treated as copyable edge).
- **Safety:** derived/read-only · لا تحرير · `candidate_fake_profit_adjusted_edge` يظهر كسبب انخفاض الترتيب لا كرفع له.

### 27.2 Profit Source Attribution UX (W1-02) — توسعة §13.4/§16 (wallet detail / copyability explanation)
- **Displays (SSOT):** `candidate_profit_source_attribution` (breakdown) · `candidate_profit_source_type` · `candidate_profit_source_copyability_class` · `candidate_copyable_profit_share` · `candidate_non_copyable_profit_share`.
- **Behavior:** breakdown لمصدر الربح، كل عنصر بـ class (copyable / partially_copyable / non_copyable). عناصر insider_non_copyable_information / artificial_pump_profit / non_repeatable_luck_one_off **لا تُعرَض كـ edge قابل للنسخ**.
- **User wording:** يشرح «لماذا محفظة رابحة قد لا تكون مناسبة للنسخ» (مثال: «65% فقط من الربح قابل للنسخ؛ 35% insider غير قابل للتكرار»).
- **Safety:** derived/read-only.

### 27.3 token_readiness_score Components UX (W1-03) — توسعة §13.3 Token Risk Panel + New Coin Radar
- **Displays (SSOT):** `candidate_token_readiness_component` + `candidate_token_readiness_component_type` (token_age/liquidity/route_health/volatility/holder_risk/creator_risk/exit_feasibility/slippage_risk/migration_graduation_state/provider_route_reliability/wash_fake_activity_risk) + `candidate_token_readiness_component_reason` + `candidate_token_readiness_component_veto`.
- **Behavior:** **لا يُعرَض `token_readiness_score` كرقم وحيد** — يُعرَض breakdown لكل component مع سببه؛ `component_veto=true` يظهر **كسبب حجب واضح**.
- **User wording:** «الدرجة الإجمالية تبدو جيدة، لكن holder_risk (veto) يحجب الجاهزية.»
- **Safety:** derived/display، ليست بوابة بنفسها (الحجب عبر `min_token_readiness`/veto)؛ Opportunity يبقى بلا P&L.

### 27.4 Realistic Paper Simulation UX (W1-04) — توسعة §25.2 Paper Portfolio / §25.4 Sandbox / §17 P&L
- **Displays (SSOT):** `candidate_paper_pnl_gross_theoretical` · `candidate_paper_pnl_execution_aware` · `candidate_paper_cost_impact` · `candidate_paper_failure_impact`.
- **Behavior:** يُعرَض الفرق بين **Gross theoretical** و**Execution-aware**؛ **execution-aware هو الرقم البارز/الأساسي**، وgross theoretical ثانوي ومُوسَم «مرجعي نظري — ليس دليل ربحية». cost impact وfailure impact ظاهران. كل قيمة بوسم **`simulated`**.
- **Safety:** لا تُعرَض كأموال حقيقية · impact غير المتوفّر `unavailable` لا يُختلق.

### 27.5 Paper Outcome States UX (W1-05) — توسعة §15 Trade Journal / §6 Positions / Paper Trades table
- **Displays (SSOT):** `candidate_paper_outcome_state` · `candidate_paper_outcome_reason`.
- **Behavior:** كل صفقة paper تُظهر outcome مفهوماً (reached_target · exited_with_loss · failed_entry · failed_exit · exit_unavailable · route_failed · expired · rejected_by_policy · still_open · force_closed_by_safety) مع reason؛ **لا صفقة paper غامضة بلا نتيجة**.
- **User wording:** توضيح صريح أن `candidate_paper_outcome_state` (تصنيف terminal لصفقة paper للتقرير) **مختلف عن `position_state`** (حالة دورة حياة runtime).
- **Safety:** display فقط · لا زرّ تنفيذ.

### 27.6 Paper Aggregation Report UX (W1-06) — توسعة §19 Reports / §26.11
- **Displays (SSOT):** `candidate_paper_aggregation_report` + filters `candidate_paper_aggregation_dimension` (wallet/mode/strategy/token_class/period) + `candidate_paper_aggregation_metric` (max_drawdown/win_rate/avg_win/avg_loss/profit_factor/expectancy/median_hold_time/average_hold_time/failed_trade_rate/rejected_opportunity_count/exit_failure_rate/slippage_impact/latency_impact/fees_impact).
- **Behavior:** قالب تقرير Paper Aggregation بفلاتر الأبعاد والمقاييس؛ المقياس المفقود `unavailable` (لا صفر)؛ **context = paper/simulated، لا خلط مع real/live** (قسم real منفصل بصرياً).
- **Disclaimer (إلزامي):** «الأداء الورقي لا يثبت ربحية مستقبلية حيّة — إشارة اختبار لا ضمان.»
- **Safety:** display/report فقط.

### 27.7 Paper↔Real Divergence UX (W1-07) — توسعة §5 Readiness / §25.5 Calibration / §19 Reports
- **Displays (SSOT):** `candidate_paper_real_divergence` + `candidate_paper_real_divergence_dimension` (fill/slippage/exit_success/latency/provider_reliability) + `candidate_paper_real_divergence_status` (within_band/elevated/high).
- **Behavior:** يُعرَض الانحراف لكل بُعد؛ `status=high` يُظهر **تحذيراً واضحاً** يفهم منه المستخدم أن «Paper متفائل مقابل الواقع». يغذّي Readiness/Calibration **القائمين** فقط.
- **Safety:** **ليس gate حاجباً جديداً** (قرار REAL-LIVE للمستخدم §5)؛ تحذير/إشارة readiness لا حجب.

### 27.8 Point-in-time / Survivorship UX Note (W1-08) — §16 Wallet Discovery / Backtest / Analytics reports
- **لا حقل/شاشة جديدة بأسماء غير مسجّلة.** أي تقرير اكتشاف/backtest يدّعي صلاحية تاريخية يعرض بوضوح: **point-in-time · no future leakage · survivorship-free cohort** (يُربط بـ `candidate_wt_point_in_time` حيث ينطبق).
- **Behavior:** إن لم تتوفّر الأدلّة، **لا يُعرَض الادّعاء** — بدلاً منه «insufficient evidence / survivorship-free غير مُثبَت». التحقّق نفسه follow-up في 07-TEST-PLAN.

> **مبدأ §27:** الواجهة تمنع القراءة الخاطئة للنتائج — Paper موسوم simulated ولا يبدو أموالاً حقيقية ولا يُخلَط بـ real · الربح الوهمي يظهر كتحذير لا كـ edge · readiness بمكوّنات + veto لا رقم معتم · gross theoretical ليس دليل ربحية · المقياس المفقود `unavailable` لا صفر · divergence تحذير لا gate · ادّعاء survivorship-free لا يظهر بلا دليل. **لا أزرار تنفيذ/شراء جديدة · لا أسماء API-facing خارج SSOT · لا live/testnet/mainnet.**

---

## 28. Wave 2 — Discovery & Copy Safety — UX Surfaces (candidate, تستهلك SSOT Group 38)

> عرض/سلوك/تحذيرات فقط — **لا schema · لا API · لا DB · لا Config · لا أزرار write/execution جديدة · لا live/testnet/mainnet.** الأسماء API-facing من **SSOT Group 38** فقط (labels/شروح/badges بشرية = UX-only حسب §0). **لا execution authority من أي إشارة W2 · لا auto-ban · لا auto-config · `full_mirror` ليس default ولا مُحدَّد تلقائياً · low-confidence = «غير مؤكد» لا حقيقة · unknown pump ≠ demand · غياب الدليل = «insufficient evidence» لا «صفر مخاطر».** AR/EN + RTL/LTR.

### 28.1 Wallet Taxonomy UX (W2-01) — توسعة §13.4 Copyability + §16 Wallet Intelligence/Details
- **Displays (SSOT):** `candidate_wallet_type` (الأنواع الثمانية) · `candidate_wallet_type_confidence` · `candidate_wallet_type_provenance`.
- **Behavior:** يُعرَض النوع **كتصنيف احتمالي** مع confidence/provenance؛ **low-confidence يظهر «uncertain / insufficient evidence» لا كحقيقة**. الأنواع الخطرة (`insider_wallet`/`dev_creator_wallet`/`mev_sniper_wallet`/`copycat_wallet`) **بتحذير واضح**، و`smart_money_wallet` وحده **لا يعني قابل للنسخ**. يُربط بتحذيرات fake-profit (§27.1).
- **Safety:** derived/read-only · **لا زر follow/تنفيذ تلقائي من النوع** · لا execution authority.

### 28.2 Token Concentration UX (W2-02) — توسعة §13.3 Token Risk Panel + Radar + Token Opportunity details
- **Displays (SSOT):** `candidate_token_concentration_dimension` (creator_dev_concentration/holder_concentration/bundled_wallets/linked_early_buyers/top_holder_risk/creator_previous_launch_quality/creator_dump_behavior/cluster_ownership_concentration) · `candidate_token_concentration_risk` · `candidate_token_concentration_reason`.
- **Behavior:** تُعرَض الأبعاد بوضوح؛ عند الحجب تُربَط بـ `candidate_token_readiness_component_veto` (§27.3). **تركّز creator/dev/cluster لا يُعرَض كطلب طبيعي**؛ **التوكن لا يبدو جاهزاً إذا منع التركّز exit feasibility**.
- **Safety:** derived/display، ليست بوابة بنفسها · لا execution authority.

### 28.3 Natural vs Artificial Pump UX (W2-03) — توسعة §13 Token Signal / Pump Analysis / Radar
- **Displays (SSOT):** `candidate_pump_classification` (الفئات الست) · `candidate_pump_classification_reason` · `candidate_pump_classification_confidence`.
- **Behavior:** يُعرَض التصنيف **منفصلاً عن السعر الخام**؛ `unknown_or_insufficient_evidence` يظهر **كحالة غير مؤكدة/تحذير لا كـ natural demand**؛ `artificial_*` يظهر كسبب watch_only/rejection/readiness reduction؛ `natural_pump` **لا يظهر كإذن دخول تلقائي**. يُربط بتحذيرات fake-profit/wash (§27.1).
- **Safety:** display فقط · لا زر تنفيذ · لا execution authority.

### 28.4 Wallet Drift Alert UX (W2-04) — توسعة §20 Alerts Center + Followed Wallet Monitor + §16 Wallet Details
- **Displays (SSOT):** `candidate_wallet_drift_signal` · `candidate_wallet_drift_reason` (التسعة) · `candidate_wallet_drift_recommendation` (الخمس).
- **Behavior:** عند drift **alert واضح** بالسبب؛ التوصيات {keep_following · reduce_size · pause_follow · switch_to_watch_only · require_review} تظهر **advisory فقط**. **لا تطبيق تلقائي · لا إغلاق مراكز**؛ أي action لاحق عبر config/user flow القائم (لا زر تنفيذ جديد في هذه الموجة).
- **Safety:** advisory/read-only.

### 28.5 Default Copy Mode UX (W2-05) — توسعة Add Followed Wallet / §7 Wallet Config UI
- **Displays (SSOT):** `copy_mode` (`follow_entry_user_exit`/`full_mirror`) · `candidate_copy_mode_default_policy`.
- **Behavior:** عند عدم تحديد المستخدم، تعرض الواجهة أن **الافتراضي الآمن = `follow_entry_user_exit`**؛ **`full_mirror` يظهر كـ Advanced Mode فقط وغير مُحدَّد افتراضياً**، مع **تحذير صريح**: ينسخ exits/adds · يزيد مخاطر السلوك غير القابل للنسخ · لا يناسب المحافظ ذات non-copyable profit أو high adverse selection. **legacy wallet بلا `copy_mode` واضح → safe default أو «requires review»**.
- **Safety:** **لا `full_mirror` صامت/افتراضي** · **لا advanced-confirmation field غير مسجّل** — UX wording فقط (لا حقل API/Config جديد).

### 28.6 Creator / Cluster Learning UX (W2-06) — توسعة Creator/Cluster Risk panel / §16 Token Details / §19 Reports
- **Displays (SSOT):** `candidate_creator_cluster_learning` + `_metric` + `_recommendation` (avoid/watch_only/reduce_size/allow_small_paper/eligible_for_normal_evaluation) + `_confidence` + `_provenance`.
- **Behavior:** يُعرَض **historical learning لا snapshot**؛ low-confidence **«غير مؤكد»**؛ التوصيات **advisory فقط**؛ **point-in-time warning** عند نقص الدليل. **سجلّ creator/cluster السيّئ لا يمنع كل شيء كحقيقة مطلقة بلا evidence**.
- **Safety:** **لا auto-ban · لا auto-config** · advisory/read-only.

### 28.7 Adverse Selection UX (W2-07) — توسعة §13.4 Copyability / §16 Wallet Details / §19 Paper Reports / Copy Diagnostics
- **Displays (SSOT):** `candidate_adverse_selection_metric` · `candidate_adverse_selection_reason` (late_entry_after_leader/slippage_from_delay/copied_worst_part_of_move/latency_drag/route_quote_degradation/failed_or_late_exit) · `candidate_adverse_selection_severity` (low/elevated/high).
- **Behavior:** تشرح الواجهة بوضوح أن **ربح القائد لا يعني ربح التابع**؛ تُعرَض الأسباب؛ `severity=high` **تحذير واضح** قد يدعم watch_only/reduce_size **كتوصية advisory**.
- **Safety:** **لا يخلط leader P&L بـ copier P&L** · لا زر تنفيذ · لا auto-config · لا execution authority.

### 28.7a Copyability Veto UX (Gap C) — توسعة §13.4 Wallet Copyability / §16 Wallet Intelligence (يستهلك SSOT Group 18)
- **Displays (SSOT):** `candidate_copyability_component_veto` (true/false) · `candidate_copyability_veto_reason` (`risky_wallet_type`/`fake_profit_risk`/`adverse_selection_high`/`crowd_follow_decay`/`profit_concentration_one_hit`/`non_copyable_profit_source`/`insufficient_evidence`). مدعوم بـ API §17.7a · DATA §5.6.
- **Behavior:** عرض **display/read-only** يشرح «لماذا ليست المحفظة قابلة للنسخ» بالسبب المعدَّد؛ يفسّر `tracked_wallet_status` ولا يحلّ محلّه. عند `candidate_copyability_component_veto = true` **لا تُعرَض المحفظة كـ `copy_allowed`**، بل بحالة متحفّظة `watch_only`/`degraded` حسب الشدّة/السياق/السياسة. `insufficient_evidence` يُعرَض كـ «دليل غير كافٍ» لا «صفر مخاطر» ولا «قابلة للنسخ».
- **Safety:** الواجهة **لا تحسبهما محلياً ولا تسمح بتحريرهما ولا تستخدمهما كأزرار/أوامر**؛ محاولة الكتابة → `READ_ONLY_FIELD_REJECTED`. **لا score مُعتم معروض — لا `wallet_trust_score` ولا `copyability_score` رقمي ولا ranking-score جديد.** `banned` = سياسة متابعة/تقييم — لا حظر أمني لمحفظة التنفيذ، لا إغلاق مراكز، لا تغيير config. **لا أزرار auto-ban/auto-close/auto-config/execute/buy/mirror/promote-to-copy · لا `copy_event` جديد · لا opportunity execution · لا leader P&L.**

### 28.7b Edge Health Advisory UX (Gap D) — توسعة §13.4 Wallet Copyability / §16 Wallet Intelligence / Decision Trace (يستهلك SSOT Group 26)
- **Displays (SSOT):** `candidate_edge_health_status` (`healthy`/`weakening`/`insufficient_evidence`/`no_edge_suspected`). مدعوم بـ API §17.7b · DATA §5.6.
- **Behavior:** عرض **display/read-only · advisory** يشرح صحّة ميزة المحفظة per-wallet و**لا يحلّ محلّ `tracked_wallet_status`**. التوصية للمشغّل تُعاد من المفردات القائمة (`candidate_wallet_drift_recommendation`/`candidate_recommendation_type`). أمثلة عرض (labels/توصيات لا أزرار): «Edge health: weakening — review recommended» · «No edge suspected — switch to watch-only recommended» · «Insufficient evidence — paper/live proof unavailable». **`no_edge_suspected` تحذير استشاري لا تعطيل تلقائي · `insufficient_evidence` = «دليل غير كافٍ» لا صفر مخاطر ولا دليل ميزة · أداء Paper لا يُعرَض كميزة Real.**
- **Safety:** الواجهة **لا تحسبه محلياً ولا تسمح بتحريره ولا تستخدمه كزرّ/أمر**؛ محاولة الكتابة → `READ_ONLY_FIELD_REJECTED`. **لا أزرار auto-ban/auto-close/auto-config/auto-disable/execute/buy/mirror/promote-to-copy · لا forced live blocker · لا `copy_event` جديد · لا opportunity execution · لا `candidate_uncopyable_flag` · لا `paper_only_recommended`/`disable_new_entries_recommended` · لا edge/trust score مُعتم · لا leader P&L.**

> **مبدأ §28:** الواجهة تمنع القراءة الخاطئة لإشارات Wave 2 — نوع المحفظة احتمالي (low-confidence «غير مؤكد») والأنواع الخطرة بتحذير ولا ترفع copyability · التركّز سياق مخاطر/جاهزية لا طلب طبيعي ويمكنه veto · الـ pump منفصل عن السعر و«unknown ≠ demand» · drift/learning/adverse-selection **advisory** لا تطبيق تلقائي · ربح القائد ≠ ربح التابع · **`full_mirror` ليس default ولا صامت** مع تحذير صريح · غياب الدليل = insufficient evidence لا صفر مخاطر. **لا أزرار تنفيذ جديدة · لا أسماء API-facing خارج SSOT · لا auto-ban/auto-config · لا live/testnet/mainnet.** الواجهة تمنع القراءة الخاطئة لإشارات Wave 2 — نوع المحفظة احتمالي (low-confidence «غير مؤكد») والأنواع الخطرة بتحذير ولا ترفع copyability · التركّز سياق مخاطر/جاهزية لا طلب طبيعي ويمكنه veto · الـ pump منفصل عن السعر و«unknown ≠ demand» · drift/learning/adverse-selection **advisory** لا تطبيق تلقائي · ربح القائد ≠ ربح التابع · **`full_mirror` ليس default ولا صامت** مع تحذير صريح · غياب الدليل = insufficient evidence لا صفر مخاطر. **لا أزرار تنفيذ جديدة · لا أسماء API-facing خارج SSOT · لا auto-ban/auto-config · لا live/testnet/mainnet.**

---

## 29. Wave 3 — Reports & Honesty — UX Surfaces (candidate, تستهلك SSOT Group 39)

> عرض/تخطيط تقارير/تحذيرات/labels فقط — **لا schema · لا API · لا DB · لا Config · لا أزرار تنفيذ/«apply»/توليد جديدة · لا report generation implementation · لا live/testnet/mainnet.** الأسماء API-facing من **SSOT Group 39** فقط (labels/شروح/badges بشرية = UX-only حسب §0). **لا تقرير/مقياس/disclaimer يمنح execution authority · لا تغيير سلوك EV gate/Hard Risk · لا execution mode · لا خلط Paper/Testnet/Real-Live بصرياً أو حسابياً · `warning_only_advisory` ليس `clean_pass` · unavailable/insufficient evidence ليس صفراً · لا عرض الأداء السابق/Paper/Backtest كضمان ربحية مستقبلية.** AR/EN + RTL/LTR.

### 29.1 Daily Unified Report UX (W3-01) — Reports / Daily Report / Operator Summary
- **Displays (SSOT):** `candidate_daily_unified_report` · `candidate_report_context` (badges: simulated/testnet/real_live) · `candidate_report_section` (paper_results/real_live_results/testnet_results/rejected_opportunities/failed_trades/open_risk/provider_health/config_changes/safety_gate_state/data_quality_issues/major_alerts) · `candidate_report_missing_metric_policy`.
- **Behavior:** واجهة موحّدة لكن **الأقسام مفصولة بوضوح** مع **context badges**؛ **لا خلط بصري/حسابي بين Paper/Testnet/Real-Live**؛ المقياس المفقود يظهر **«unavailable / insufficient evidence» لا صفر**.
- **Safety:** **لا زر تنفيذ أو «apply» في التقرير** · لا execution authority.

### 29.2 Report Definitions Catalog UX (W3-02) — Reports / Report Library / Export Center
- **Displays (SSOT):** `candidate_report_catalog` · `candidate_report_definition_type` (الـ13 نوعاً) · `candidate_report_definition` · `candidate_report_template_id` · `candidate_report_provenance` · `candidate_report_missing_metric_policy`.
- **Behavior:** كتالوج القوالب الرسمية؛ **custom report يظهر كـ «custom» لا كبديل رسمي**. كل report card يعرض: scope · context · dimensions · metrics · evidence/provenance · missing-metric policy · disclaimer requirements · paper/real separation.
- **Safety:** **لا زر توليد تقرير جديد ما لم يدعمه API قائم** · القوالب الرسمية لا تستبدلها custom.

### 29.3 Weekly Comparison Report UX (W3-03) — Reports / Weekly Review / Strategy Evaluation
- **Displays (SSOT):** `candidate_weekly_comparison_report` · `candidate_weekly_comparison_axis` (wallet/copy_mode/brain/provider/strategy/token_class/config_before_after/paper_real_divergence/creator_cluster_cohort/adverse_selection_impact) · `config_version_at_entry` · `candidate_report_missing_metric_policy`.
- **Behavior:** before/after config **يعرض `config_version_at_entry`**؛ التقرير يشرح **«ما تغيّر» لا «ما يجب تنفيذه تلقائياً»**؛ الفروقات المفقودة **unavailable**.
- **Safety:** **لا auto-apply من التقرير** · لا خلط Paper/Real/Live.

### 29.4 Disclaimer Standard UX (W3-04) — تقارير paper/backtest/weekly/recommendation/promotion
- **Displays (SSOT):** `candidate_report_disclaimer_requirement` (past_performance_not_future_profitability/paper_not_live_profitability/backtest_requires_point_in_time_evidence/results_affected_by_cost_latency_provider_data_quality/high_confidence_not_certainty/recommendations_are_advisory_until_user_config_flow) · `candidate_report_disclaimer_required_for` (paper/backtest/weekly/recommendation/promotion).
- **Behavior:** تظهر **واضحة في واجهة التقرير وليست نصاً مدفوناً**؛ **لا تختفي في advanced mode**.
- **Safety:** **ليست بديلاً عن gates · لا تصحّح تقريراً غير صالح** · التوصيات advisory حتى user/config flow.

### 29.5 Net Business PnL UX (W3-05) — P&L / Reports / Business Summary
- **Displays (SSOT):** `candidate_net_business_pnl_report` · `candidate_net_business_pnl` · `candidate_business_cost_component` (provider_credit_cost/rpc_streaming_cost/infra_storage_export_report_cost/subscription_provider_cost) · `candidate_net_business_pnl_status` (complete/partial/unavailable). يعيد استخدام `candidate_realized_pnl`/`candidate_fees_total`/`candidate_slippage_cost`/`candidate_storage_usage_metric`.
- **Behavior:** يُعرَض **منفصلاً عن trade P&L** مع شرح صريح أن **positive trade P&L لا يعني positive business P&L**؛ unavailable/partial **لا يظهر كصفر**.
- **Safety:** **لا يُعرَض كإذن تنفيذ · لا خلط wallet-level P&L مع business-level بلا label** · لا execution authority.

### 29.6 warning_only Report Tag UX (W3-06) — Report headers / Decision Trace / Promotion / Weekly
- **Displays (SSOT):** `candidate_report_gate_context` (clean_pass/warning_only_advisory/blocked) · `candidate_warning_only_report_tag` (true/false) فوق `ev_gate_mode`/`warning_only`/`WARNING_CRITICAL`.
- **Behavior:** **badge واضح** عند `warning_only_advisory`؛ **لا يظهر كـ `clean_pass`**؛ **لا يبدو كنجاح**؛ failed EV **لا يختفي**.
- **Safety:** **لا report promotion بلا disclosure · لا تغيير EV gate behavior · لا execution mode · لا execution authority.**

> **مبدأ §29:** الواجهة تمنع القراءة الخاطئة للتقارير — التقرير اليومي موحّد لكن Paper/Testnet/Real-Live **مفصولة بصرياً وحسابياً** مع context badges · المقياس المفقود unavailable لا صفر · القوالب الرسمية لا تستبدلها custom · weekly يشرح «ما تغيّر» بلا auto-apply ويحترم config_version · disclaimer واضح لا مدفون ولا يختفي advanced وليس بديلاً عن gates · Net Business PnL business-level منفصل عن trade P&L (positive trade P&L ≠ positive business P&L، unavailable/partial لا صفر) · `warning_only_advisory` badge صريح لا يُعرَض كـ clean_pass ولا يخفي failed EV. **لا أزرار تنفيذ/«apply»/توليد جديدة · لا أسماء API-facing خارج SSOT · لا تغيير EV gate/Hard Risk · لا execution mode/authority · لا live/testnet/mainnet.**

---

## 30. Wave 4 — Execution / Providers + Data — UX Surfaces (candidate, تستهلك SSOT Group 40)

> عرض/تخطيط لوحات/تحذيرات/labels فقط — **لا schema · لا API · لا DB · لا Config · لا React runtime · لا provider setup/connection implementation · لا أزرار تنفيذ/connect/test/purge/apply/open-position جديدة · لا live/testnet/mainnet.** الأسماء API-facing من **SSOT Group 40** فقط (labels/badges بشرية = UX-only حسب §0). **لا عرض raw key/secret/credential أبداً · key material خارج browser/UI/report/export/diagnostics.** **لا إشارة provider/execution/data-cost/opportunity تمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · المفقود unavailable/partial لا صفر/clean.** قواعد الصياغة: لا «safe» إلا إن كانت الحالة safe فعلاً حسب SSOT/policy · لا «ready» للتنفيذ عند provider connection فقط · لا «best paper» كـ «best live» · لا «graduated» كـ «safe» · unavailable ليس 0 · partial ليس complete · لا إخفاء warnings في advanced. AR/EN + RTL/LTR.

### 30.1 Provider Latency Comparison UX (W4-01) — Provider Health / Execution Trace / Ops panels
- **Displays (SSOT):** `candidate_provider_latency_metric` · `candidate_provider_latency_type` (stream_latency/quote_latency/route_latency/send_latency/confirmation_finality_latency/provider_response_error_latency) · `candidate_provider_latency_comparison` (+`provider_degraded`/`slot_lag`/`candidate_ts_*` بالإحالة).
- **Behavior:** latency حسب النوع + best/worst comparison **كتشخيص فقط**؛ **latency مفقودة → unavailable لا صفر · fast provider لا يظهر كـ safe/executable.**
- **Safety:** **لا زر switch provider/auto-select جديد · لا execution authority.**

### 30.2 Rate-limit & Provider Cost Monitor UX (W4-02) — Provider Health / Cost Monitor / Business Summary
- **Displays (SSOT):** `candidate_provider_rate_limit_monitor` · `candidate_provider_cost_metric` (rate_limit/quota_usage/credit_usage/request_cost/period_cost/cost_per_trade/cost_per_report/cost_per_job/throttling_backoff_state/provider_degradation) · `candidate_provider_cost_attribution_status` (complete/partial/unavailable). يُربَط بصرياً بـ `candidate_net_business_pnl`/`candidate_business_cost_component` (§29.5) دون إعادة تعريف.
- **Behavior:** **partial/unavailable لا يظهر كصفر · provider availability ≠ provider affordability** (موضّح بصرياً).
- **Safety:** **لا عرض provider cost كإذن تنفيذ · لا billing/pricing UI fields نهائية غير مسجّلة · لا execution authority.**

### 30.3 Fork / Rollback UX (W4-03) — Network Health / Provider Health / Decision Trace / Reports
- **Displays (SSOT):** `candidate_finality_state` (no_rollback_detected/rollback_risk/fork_detected/rollback_confirmed/finality_uncertain) · `candidate_rollback_fork_reason` (+`NETWORK_ROLLBACK_EVENT`/`provider_degraded`/`slot_lag`).
- **Behavior:** rollback-affected data يظهر **warning/provenance**؛ **`no_rollback_detected` لا يظهر كـ safe/executable.**
- **Safety:** **لا زر تنفيذ/gate جديد في UX · لا تغيير Risk Gates/Hard Risk · لا execution authority.**

### 30.4 Provider Onboarding & Key/Connection Validation UX (W4-04) — Provider Setup / Provider Health / Settings
- **Displays (SSOT):** `candidate_provider_onboarding_status` · `candidate_provider_type` (helius/jito/jupiter/generic_rpc/generic_stream) · `candidate_provider_capability_status` · `candidate_provider_connection_test_status` · `candidate_provider_onboarding_failure_reason` · `candidate_provider_key_ref` **كمرجع/حالة فقط**.
- **Behavior:** **raw keys/secrets/credentials لا تظهر أبداً · لا key material في browser/UI/report/export/diagnostics**؛ **connection success لا يظهر كـ trading readiness**؛ Jupiter key/connection validation يظهر بوضوح عند استخدام quotes/routes.
- **Safety:** **provider readiness لا يتجاوز SignerService/Risk Gates/admission gates · لا زر connect/test جديد ما لم يكن API command قائماً مسموحاً · لا provider connection command · لا execution authority.**

### 30.5 Storage Cost + Survivorship-Safe Retention UX (W4-05) — Storage / Data Retention / Reports / Business Summary
- **Displays (SSOT):** `candidate_storage_cost_report` · `candidate_storage_cost_component` (data_type/retention_period/volume/hot_cold_archive_tier/report_export_artifacts/replay_backtest_datasets) · `candidate_retention_impact_warning` · `candidate_pruning_safety_status` (safe/survivorship_risk/point_in_time_risk/audit_integrity_risk). يعيد استخدام `candidate_storage_usage_metric`/`candidate_net_business_pnl`.
- **Behavior:** storage cost مفقود → **partial/unavailable لا صفر**؛ retention impact warning يوضّح التأثير على historical wallet discovery/dead-failed-disappeared wallets/replay-backtest datasets/audit-trade-accounting records؛ **cost-saving deletion لا يظهر كخيار آمن إن كسر survivorship-free/point-in-time.**
- **Safety:** **لا purge button جديد · لا storage pricing/billing fields نهائية · لا execution authority.**

### 30.6 Rejected Opportunity Re-evaluation UX (W4-06) — Opportunity Details / Watchlist / Alerts / Radar
- **Displays (SSOT):** `candidate_rejected_opportunity_reevaluation` · `candidate_reevaluation_trigger` (8) · `candidate_reevaluation_recommendation` (keep_rejected/keep_watch_only/review_again/eligible_for_paper/eligible_for_normal_evaluation) (+`hunt_status`/`watch_only`/`candidate_rejected_reason`).
- **Behavior:** يظهر **كتنبيه/توصية فقط** مع original rejection reason + new evidence snapshot/comparison؛ **improved opportunity لا يثبت edge · `eligible_for_normal_evaluation` لا يعني execution-ready.**
- **Safety:** **لا buy/execute/apply/open-position button · لا auto-config · لا execution authority.**

### 30.7 Best Paper Settings This Week Advisory UX (W4-07) — Paper Reports / Weekly Review / Strategy Evaluation
- **Displays (SSOT):** `candidate_best_paper_settings_advisory` · `candidate_paper_settings_recommendation` · `candidate_paper_settings_evidence_status` (sufficient/insufficient_evidence/unavailable). يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence`/`candidate_weekly_comparison_report`/`candidate_report_disclaimer_requirement`.
- **Behavior:** advisory board «Best Paper Settings This Week» مع **Paper-only context badge إلزامي**؛ يعرض sample size/confidence/time period/mode/strategy/copy_mode/fees/slippage/latency/failure impact/paper-real divergence (إن وُجد)/disclaimer أن paper لا يثبت live profitability؛ **insufficient_evidence/unavailable لا يظهر كنجاح · best paper setting لا يظهر كـ live-ready.**
- **Safety:** **لا auto-apply · لا زر تطبيق إعدادات مباشر · لا live promotion بلا gates/disclosure.**

### 30.8 Graduation Trap States UX (W4-08) — Token Risk / Opportunity Details / Migration / Reports
- **Displays (SSOT):** `candidate_graduation_trap_state` (graduation_pending/migration_limbo/post_graduation_exit_unsafe/post_graduation_liquidity_fragile/post_graduation_route_unhealthy/post_graduation_watch_only/graduation_trap_confirmed) (+`migration_phase`/`MIGRATION_IN_PROGRESS`/`candidate_token_readiness_component`).
- **Behavior:** **graduation لا يظهر كأنه exit-safe · `post_graduation_watch_only` لا يعني buy/execute · غياب route/liquidity/exit evidence لا يظهر clean/safe**؛ الحالة تؤثّر على readiness/exit feasibility/report explanation.
- **Safety:** **لا execution authority · لا gate جديد في UX.**

> **مبدأ §30:** الواجهة تمنع القراءة الخاطئة لإشارات Wave 4 — latency/cost/rollback/onboarding/storage/re-evaluation/best-paper/graduation كلها read-only/advisory/diagnostic · المزوّد السريع/المتصل لا يظهر كـ safe/executable/ready · توفّر ≠ كلفة · بيانات rollback موسومة لا نهائية · **لا عرض raw key/secret أبداً** · pruning غير الآمن للبقاء لا يظهر كخيار آمن · الفرصة المعاد تقييمها تنبيه لا أمر تنفيذ · best paper ليس live-ready · graduation ليس exit-safe · unavailable/partial لا صفر/complete. **لا أزرار تنفيذ/connect/test/purge/apply/open-position جديدة · لا أسماء API-facing خارج SSOT · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا execution authority · لا live/testnet/mainnet · لا Wave 5+.**

---

## 31. Wave 5 — Local Ops & Readiness — UX Surfaces (candidate, تستهلك SSOT Group 41)

> عرض/تخطيط panels/labels/warnings/explanations فقط — **لا schema · لا API · لا DB · لا Config · لا React/components/code · لا frontend implementation · لا أزرار تنفيذ/connect/test/run/restart/shutdown/backup/restore/purge/rollback/migration كأفعال تنفيذية · لا scripts/launcher/runtime · لا live/testnet/mainnet.** الأسماء API-facing من **SSOT Group 41** فقط (labels/badges بشرية = UX-only حسب §0). **لا عرض raw key/secret/credential أبداً · لا secrets في logs/diagnostics/exports/backups.** **Local run/health/version/logs/status لا يمنح execution authority · health green ليس trading readiness · SignerService health ليس permission to sign · provider health ليس trading readiness · documented_only/candidate ليس implemented · unknown/unavailable/not_verified لا clean/ready/implemented · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService.** UX copy تشغيلي واضح: لا stack trace فقط · لا رسائل غامضة · warnings لا تختفي في advanced mode. AR/EN + RTL/LTR.

### 31.1 Local Run UI-first Workflow UX (W5-01) — Local Run / Getting Started panel
- **Displays (SSOT):** `candidate_local_run_workflow_status` (not_started/checking/ready_for_local_use/degraded/blocked/unknown) status badge · `candidate_required_local_service` checklist · `candidate_local_run_missing_requirement` list · `candidate_local_run_next_action` (إرشاد نصي/تعليمي) · `candidate_local_run_evidence_status` badge (present/partial/missing/stale/unknown).
- **Rules:** `ready_for_local_use` يظهر «Local use only» لا «Trading ready» · local app running ≠ trading readiness · missing/stale/unknown لا تظهر clean · `candidate_local_run_next_action` لا يظهر كزر command · **لا «Run/Start/Fix automatically» action · لا execution authority.**

### 31.2 Local Ops Health Screen UX (W5-02) — Local Ops Health Screen موحّدة
- **Displays (SSOT):** `candidate_local_ops_health` · service cards/table للخدمات الـ15 عبر `candidate_local_ops_service_type` (postgresql/clickhouse/redis/api/ui/stream_ingestion/decision_engine/signer_service/provider_connectivity/job_runner/data_quality/queue_backlog/config_migration_state/disk_storage_pressure/audit_log_pipeline) · لكل خدمة `candidate_local_ops_service_status` badge (healthy/degraded/unavailable/unknown/not_configured/blocked) + `candidate_local_ops_health_reason` + `candidate_local_ops_health_next_action`. يعيد استخدام `signer_profile_status`/`operating_state`/`candidate_provider_onboarding_status`/`candidate_data_quality_metric`/`candidate_storage_usage_metric`.
- **Rules:** `healthy` لا تعني execution-safe · SignerService `healthy` لا يعني permission to sign · provider_connectivity `healthy` لا يعني trading readiness · degraded/unavailable = summary + reason + safe next action لا stack trace فقط · **لا restart/test/connect buttons · لا execution authority.**

### 31.3 Operator Logs UX (W5-03) — Operator Logs panel
- **Displays (SSOT):** filters by `candidate_operator_log_severity` (info/warning/error/critical)/`candidate_operator_log_category` (الـ13)/`candidate_operator_log_service`؛ log row: `candidate_operator_log_event` · severity · category · service · timestamp (من envelope/source إن وُجد) · `candidate_operator_log_correlation_ref` · `candidate_operator_log_user_summary` · `candidate_operator_log_technical_detail` (collapsed by default) · `candidate_operator_log_safe_next_action` (guidance) · `candidate_operator_log_redaction_status` badge.
- **Rules:** stack trace لا الرسالة الوحيدة · technical_detail collapsed/secondary · user_summary واضح · **secrets/raw keys/tokens لا تظهر · `blocked_contains_secret` يحجب display/export ويظهر كتحذير redaction · log clarity لا يسرّب secrets · logs لا تمنح execution authority.**

### 31.4 Migrations & Version Status UX (W5-04) — Version & Migration Status panel
- **Displays (SSOT):** `candidate_app_version` · `candidate_api_version_status` · `candidate_db_schema_version` · `candidate_config_schema_version` · `candidate_contracts_version_status` · `config_version`/`config_version_at_entry` (current config) · `candidate_migration_status` (up_to_date/pending/running/failed/blocked/unknown) · `candidate_pending_migration` · `candidate_failed_migration` · `candidate_rollback_availability` · `candidate_version_compatibility_status` (+`migration_phase`/`MIGRATION_IN_PROGRESS`).
- **Rules:** failed/pending/blocked/unknown لا تظهر clean · `compatible` كـ prerequisite only لا execution-ready · current version display لا يعني trading readiness · mismatch واضح مع reason · **لا migration/rollback buttons · لا destructive action.**

### 31.5 Upgrade / Rollback Procedure UX (W5-05) — Upgrade / Rollback Readiness panel
- **Displays (SSOT):** `candidate_upgrade_preflight_status` · `candidate_upgrade_backup_requirement` · `candidate_upgrade_migration_compatibility` · `candidate_rollback_path_status` · `candidate_upgrade_blocked_reason` · `candidate_post_upgrade_health_verification` · `candidate_upgrade_incident_status` (مع صياغة «status only»).
- **Rules:** `pass` لا يعني trading readiness · backup/export لا يحتوي raw secrets · rollback path status ليس command · failed upgrade يظهر incident/blocker · **لا upgrade/rollback/backup/restore buttons · لا implementation/automation implication.**

### 31.6 Safe Maintenance Actions Policy UX (W5-06) — Maintenance Actions Policy panel
- **Displays (SSOT):** action types كـ **policy/readiness labels فقط** عبر `candidate_maintenance_action_type` (restart_service/safe_shutdown/backup/restore/export_diagnostics/clear_cache/reindex_rebuild_projections/migration_check/config_rollback_preview)؛ لكل نوع: `candidate_maintenance_action_status` · `candidate_maintenance_permission_status` · `candidate_maintenance_audit_status` · `candidate_maintenance_preview_status` · `candidate_maintenance_block_reason` · `candidate_maintenance_reversibility_status` · `candidate_safe_shutdown_status` (حيث relevant).
- **Rules:** action types **labels لا clickable executable buttons** · **لا «Run now»/«Restart»/«Shutdown»/«Backup»/«Restore»/«Purge»/«Rollback»/«Migrate» buttons** · safe_shutdown blocked by pending intents/active signing/critical jobs · backup بلا raw secrets · restore لا يكسر audit/history/config · clear_cache لا يحذف source-of-truth · rebuild projections لا يغيّر سلطة PostgreSQL · **لا execution authority.**

### 31.7 Implementation Status Matrix UX (W5-07) — Implementation Status / Capability Matrix panel
- **Displays (SSOT):** `candidate_capability_status_label` · `candidate_implementation_status` (implemented/partially_implemented/documented_only/candidate/not_built/blocked/deprecated) · `candidate_implementation_status_evidence` · `candidate_implementation_status_source` · `candidate_status_verified_at` · `candidate_status_verification_state` (verified/not_verified/stale/unknown).
- **Rules:** `documented_only` ≠ implemented · `candidate` ≠ built · unknown/not_verified لا يظهر implemented · capability لا تظهر ready دون evidence · status لا يمنح execution authority · no “documented means built” · يربط بـ `IMPLEMENTATION_STATUS_MATRIX.md` كعرض لا تعديل.

> **مبدأ §31:** الواجهة تمنع القراءة الخاطئة لإشارات Wave 5 — local run/health/logs/version/upgrade/maintenance/implementation-status كلها panels/labels/warnings read-only/diagnostic · local running لا يظهر كـ trading ready · health green لا execution-safe وsigner health لا permission to sign · **لا عرض raw key/secret أبداً** و`blocked_contains_secret` يحجب · stack trace ليس الرسالة الوحيدة وwarnings لا تختفي advanced · maintenance action types labels لا أزرار تنفيذ · documented_only/candidate لا implemented (unknown → not_verified) · unavailable/unknown/not_verified لا clean/ready/implemented. **لا أزرار تنفيذ/connect/test/run/restart/shutdown/backup/restore/purge/rollback/migration · لا أسماء API-facing خارج SSOT · لا frontend/code · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا execution authority · لا live/testnet/mainnet · لا Wave 6+.**
