# API Contract

> **Priority:** 03 — Implementation · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** عقود request/response والأوامر والأخطاء والـ streams

**الحالة:** معتمدة / موسّعة بعد v1.8 Delta + F-Elimination + Waves 1–5 — الأجزاء 0–20 مكتملة ومراجعة. §14 يستهلك SSOT Groups 22–27، و§15 يستهلك SSOT Groups 22–36، و§16 يستهلك SSOT Group 37 / Wave 1، و§17 يستهلك SSOT Group 38 / Wave 2، و§18 يستهلك SSOT Group 39 / Wave 3، و§19 يستهلك SSOT Group 40 / Wave 4، و§20 يستهلك SSOT Group 41 / Wave 5. كل إضافات Waves 1–5 تبقى candidate/read-only/status/diagnostic/advisory حيث ينطبق، ولا تمنح execution authority ولا تضيف commands أو write endpoints ولا تغيّر EV gate أو Hard Risk أو Risk Gates أو SignerService.

**مبني على:** `00-ARCHITECTURE.md` (القرار) · `01-SSOT.md` (الأسماء) · `02-CONFIG-AND-POLICY-SCHEMA.md` (الإعدادات). لا يعيد تعريف أيٍّ منها.

---

## 0. API Preflight — Derived Outputs & SSOT Decision (محسوم)

قبل أي عقد، حُسم تسجيل المخرجات المشتقّة في SSOT (Group 10) لتفادي كسر `No field before SSOT`:

| field | SSOT type | ظهوره في API |
|---|---|---|
| `real_live_config_valid` | `derived_field / readiness_result` (bool) | read-only في readiness/config endpoints |
| `validation_status` | `derived_status` (`valid`\|`warning`\|`invalid`) | read-only في config/resource validation |
| `config_migration_required` | `operation_result_field` (bool) | يُرجَع في استجابة عملية تعديل/معاينة الإعداد فقط |

**القاعدة الحاكمة للـ derived outputs (من SSOT):** حالة مستمرّة تُستعلَم → `derived_field`/`derived_status` · نتيجة عملية لحظية باسم API ثابت → `operation_result_field` · حساب داخلي بلا اسم API ثابت → لا يدخل SSOT (ولا يكون response field باسم ثابت). أي مخرج API جديد يتبع هذا التصنيف ويُسجَّل في SSOT قبل استخدامه.

---

## 1. Scope & Ownership (النطاق والملكية)

**API يملك (حصراً):**
- `request/response schemas` — أشكال الطلب والاستجابة.
- `commands` — الأوامر التشغيلية (تعديل إعداد، تحكّم مركز، تسجيل محفظة…).
- `response fields` — حقول الاستجابة (بأسماء SSOT حصراً).
- `error codes` — رموز الأخطاء ودلالاتها.
- `permissions` — حدود الصلاحيات لكل عملية.
- `idempotency contracts` — ضمانات عدم التكرار (مرتبطة بـ `intent_id` من SSOT).
- `event stream payloads` — حمولات الـ WebSocket/event-stream.

**API لا يملك:**
- `architectural meaning` — التعريف والقرار (مملوك لـ `00-ARCHITECTURE.md`).
- `config defaults/validation/mutability` — مملوكة لـ `02-CONFIG-AND-POLICY-SCHEMA.md`؛ API يعرضها ويستدعي قواعدها، لا يعيد تعريفها.
- `UX presentation` — مملوك لوثيقة UX.
- `DB schema` — مملوك لـ Data Model.

**القاعدة الحاكمة:**
> **No field before SSOT.** كل request/response/error/event field يطابق `source_of_truth_field` في `01-SSOT.md`. حقل جديد؟ أوقِف → ARCHITECTURE → SSOT → ثم API.

---

## 2. API Principles (مبادئ API)

1. **Read/Write Separation:** عمليات القراءة (config، positions، wallets، readiness، audit) تُفصَل عن أوامر الكتابة/التحكّم. حقول القراءة تشمل state/runtime (Groups 1،3،4-per-position،5) ومخرجات Group 10 — كلها read-only عبر API (لا تُعدَّل).

2. **Config vs Runtime vs Derived:** API يميّز ثلاثتها صراحةً — *Config* (يُكتب عبر أوامر تعديل، محكوم بـ mutability §Config 8/11) · *Runtime state* (`operating_state`, `position_state`, `cumulative_ignored_sell`, `disable_new_adds`… read-only) · *Derived* (Group 10، محسوب read-only). لا يسمح API بكتابة runtime أو derived مباشرةً.

3. **Safety Boundary غير قابل للتجاوز عبر API:** لا عملية API تعطّل Hard Risk أو تتجاوز Fail Safe. `ev_gate_mode = warning_only` يُضبط عبر API لكنه **لا يخفّض Hard Risk** (يُرفَض أي طلب يحاول ذلك بـ error code مخصّص). أوامر التحكّم الحرجة (Kill Switch، emergency exit، signer revoke) لها مسار صلاحيات مشدّد.

4. **Idempotency إلزامية للكتابة:** كل أمر كتابة/تنفيذ يحمل مفتاح idempotency؛ أوامر التداول تُربَط بـ `intent_id` (SSOT) — لا تكرار شراء/بيع بسبب retry أو duplicate. (يطبّق IntentLedger §15.1.)

5. **REAL-LIVE eligibility صريحة:** أي عملية تنقل النظام/المحفظة إلى تنفيذ حيّ تتحقّق من `real_live_config_valid`؛ إن كان `false` (حدود Hard Risk ناقصة) تُرفَض أو تُرجِع `validation_status = invalid` مع السبب. الانتقال قرار المستخدم، لكن لا تنفيذ حيّ على config غير صالح.

6. **Audit Everything:** كل أمر كتابة وكل تعديل إعداد يدخل Audit Trail (يطبّق مبدأ ARCHITECTURE). استعلامات Audit عبر endpoints مخصّصة للقراءة.

7. **Streams over polling:** الحالة الحيّة (positions، opportunity read-model، operating_state، provider health، readiness) تُبَثّ عبر WebSocket/event-stream، لا HTTP polling (متّسق مع قاعدة «اشتراكات فقط» في ARCHITECTURE).

8. **أسماء SSOT حصراً:** كل اسم في عقد API هو `source_of_truth_field`؛ لا aliases (Rejected Aliases في SSOT مرفوضة)، و`platformFeeBps` external alias لا يظهر كحقل داخلي (يُستخدم `platform_fee_bps`).

---

## 3. Authentication / Permissions Preflight (تمهيد المصادقة والصلاحيات)

> **محسوم في SSOT Group 11** (API Contract Vocabulary). الأسماء أدناه معتمدة.

**مبدأ الصلاحيات:** كل عملية API محكومة بدور؛ العمليات الحرجة (Kill Switch، emergency exit، signer revoke، الانتقال إلى REAL-LIVE) تتطلّب أعلى مستوى. القراءة منفصلة عن الكتابة عن التحكّم الحرج.

**أدوار `permission_role` (SSOT Group 11):**
- `viewer` — قراءة فقط (positions، opportunities، config، readiness، audit). لا كتابة.
- `operator` — viewer + تعديل config غير الحرج + أوامر تداول ضمن الحدود.
- `admin` — operator + تعديل Hard Risk + الانتقال إلى REAL-LIVE + config migration.
- `signer_control` — صلاحية منفصلة مشدّدة للتوقيع/التحكّم بالمفاتيح (Kill Switch، signer revoke). **مفصولة عن admin** (مبدأ فصل الصلاحيات الأمنية — لا تُمنح تلقائياً مع admin).

**مبادئ مثبّتة (تدخل العقود لاحقاً):**
- المصادقة تسبق كل عملية؛ لا عملية مجهولة.
- العمليات الأمنية الحرجة لا تُمنح بدور عام؛ تحتاج `signer_control` صراحةً.
- خرق حدّ الصلاحية → `PERMISSION_DENIED`.

## 4. Resource Model (نموذج الموارد)

> الموارد التي يديرها API. الأسماء معتمدة في SSOT Group 11.

**الموارد `resource_type` (SSOT Group 11):**
- `config` — كائنات الإعداد الثمانية (§Config 2). قراءة + تعديل محكوم بـ mutability.
- `wallet` — سجلّ المحافظ المنسوخة (per-wallet config + حالة المتابعة).
- `position` — المراكز المفتوحة/المغلقة (runtime state، read-only عبر API + أوامر تحكّم محدّدة).
- `intent` — النوايا المسجّلة (IntentLedger §15.1)، محورية للـ idempotency والتنفيذ؛ read-only + `cancel_intent`.
- `readiness` — حالة الجاهزية (`real_live_config_valid`, Readiness Checklist) — read-only.
- `audit` — سجلّ التدقيق — read-only (استعلام).
- `health` — صحّة المزوّدين/الـ streams/البروتوكول (`provider_degraded`, `slot_lag`, `protocol_constant_status`) — read-only feed.
- `opportunity` — مورد قراءة لـ TokenOpportunity ما قبل المركز (New Coin Radar / Decision Trace / diagnostics) — **read-oriented، بلا execution authority، بلا أمر ضمني، بلا شراء من mint، بلا تنفيذ من `accepted`، بلا discovery-only execution. لا `command_type` للفرص** (§13).

**الأوامر `command_type` (SSOT Group 11):**
- على `config`: تعديل/معاينة إعداد (يُرجِع `config_migration_required`, `validation_status`).
- على `wallet`: تسجيل/تعديل/تفعيل (`follow_enabled`) — لا أمر يبيع مركزاً (تعطيل المتابعة ≠ خروج، §Config حاشية 3).
- على `position`: أوامر تحكّم محدودة (manual exit إن سمح execution_mode، emergency exit) — محكومة بـ `current_control_brain` وطبقات الأمان.
- أوامر تشغيل حرجة: Kill Switch، signer revoke، الانتقال إلى REAL-LIVE — تتطلّب `signer_control`/`admin` وتتحقّق من `real_live_config_valid`.

**رموز الأخطاء `api_error_code` (SSOT Group 11):**
- `HARD_RISK_BYPASS_REJECTED` — محاولة تجاوز Hard Risk (مثلاً warning_only يخفّض حدّ خسارة).
- `REAL_LIVE_CONFIG_INVALID` — محاولة تنفيذ حيّ و`real_live_config_valid = false`.
- `IDEMPOTENCY_CONFLICT` — تكرار أمر بنفس مفتاح idempotency/`intent_id`.
- `PERMISSION_DENIED` — خرق حدّ الصلاحية.
- `CONFIG_VALIDATION_FAILED` — فشل تحقّق إعداد (`validation_status = invalid`).
- `IMMUTABLE_FIELD_FROZEN` — محاولة تعديل إعداد مجمّد على مركز مفتوح بلا migration.
- `READ_ONLY_FIELD_REJECTED` — محاولة كتابة runtime/derived (مثل `operating_state`, `validation_status`).
- `COMMAND_NOT_ALLOWED_IN_STATE` — أمر ممنوع بسبب `operating_state`/`position_state` (مثل دخول جديد في EXITS_ONLY).
- `RESOURCE_NOT_FOUND` — مورد غير موجود.

> **أرضية API نظيفة:** الأنواع الأربعة (`permission_role` · `resource_type` · `command_type` · `api_error_code`) مسجّلة في **SSOT Group 11**. العقود التفصيلية §5–7 تستخدم هذه الأسماء المعتمدة حصراً.

> **Execution Wallet Extension Resources (Group 11 + §12):** `execution_wallet` · `signer_profile` · `asset_transfer` · `wallet_rotation` · `profit_sweep` معتمدة في SSOT Group 11 ومفصّلة في §12. `wallet` يبقى مورد المحفظة المتبوعة (source)؛ `execution_wallet` مورد محفظتنا التي توقّع/تموّل. منفصلان تماماً.

> **Execution Wallet Extension Commands (Group 11 + §12):** أوامر الموارد الجديدة معتمدة في SSOT Group 11 ومفصّلة في §12، تشمل: `register_execution_wallet` · `activate_execution_wallet` · `drain_execution_wallet` · `disable_execution_wallet` · `revoke_execution_wallet` · `set_execution_wallet_assignment_policy` · `register_signer_profile` · `disable_signer_profile` · `revoke_signer_profile` · `create_asset_transfer_intent` · `cancel_asset_transfer_intent` · `rotate_execution_wallet` · `complete_wallet_rotation` · `sweep_profits`. فقرة §4 تعرض النموذج العام؛ §12 المصدر التفصيلي.

---

## 5. Config API Contracts (عقود إعداد)

عمليات على `resource_type = config`. كل الحقول من SSOT (Groups 2،6،7،8،9). التعديل محكوم بـ mutability (§Config 8/11).

**`preview_config_update`** (dry-run command — لا read عام): يحاكي تعديلاً دون تطبيقه. **يتطلّب صلاحية مساوية للحقل المُراد تعديله** (viewer لا يختبر تعديلاً على Hard Risk أو migration). يُرجِع: `validation_status` · `config_migration_required` · أسماء `source_of_truth_field` المتأثّرة وحالة تجميدها. لا يكتب شيئاً.

**`update_config`** (`operator` للحقول غير الحرجة · `admin` لـ Hard Risk): يطبّق تعديل إعداد. يتحقّق: تطابق أسماء SSOT · validation rules (§Config 10) · mutability. الأخطاء: `CONFIG_VALIDATION_FAILED` (`validation_status = invalid`) · `IMMUTABLE_FIELD_FROZEN` (إعداد مجمّد على مركز مفتوح) · `HARD_RISK_BYPASS_REJECTED` (محاولة خفض Hard Risk عبر warning_only) · `READ_ONLY_FIELD_REJECTED` (محاولة كتابة runtime/derived) · `PERMISSION_DENIED`. يُرجِع `config_version` الجديد و`config_migration_required`.

> **قاعدة عدم الترحيل الصامت:** إن مسّ التعديل حقولاً مجمّدة (strategy-frozen) ومراكز مفتوحة قائمة، يُنشئ `update_config` نسخة `config_version` جديدة **للإدخالات الجديدة فقط، ولا يعدّل المراكز القائمة**. تبقى المراكز القائمة على `config_version_at_entry` ما لم يُنفَّذ `apply_config_migration` صراحةً. (يحفظ ConfigVersioning §Config 9 — لا تطبّق Hard Risk استثناءً: حدود المخاطر تُطبَّق فوراً على كل المراكز كما في §Config 11.)

> **استهلاك `usdc_quote_enabled` (global policy — SSOT G2 / CONFIG §3):** يُقرأ ضمن `global_config` ويُحدَّث عبر مسارات config القائمة (`preview_config_update`/`update_config`) — **لا command جديد ولا error code جديد**. عند `usdc_quote_enabled=false` (الافتراضي): توكنات USDC-quoted تُخطّى عبر `rejected_reason = unknown_quote_mint` حسب Config/SSOT، **لا عبر API error جديد**. لا يتجاوز Hard Risk/EV gate.

**`apply_config_migration`** (`admin` + explicit confirmation): يرحّل إعداداً مجمّداً ليسري على مركز مفتوح قائم (§Config 9). صريح ومُسجَّل في Audit. **إن مسّ الترحيل سلوكاً خاصاً بالتوقيع/الأمان (signer/security-critical) يتطلّب `signer_control` أيضاً** (لا كل migration، فقط ما يمسّ signing/security). يُرجِع `config_version` المُرحَّل.

**قواعد ثابتة:** غياب حدّ Hard Risk → `validation_status = invalid` و`real_live_config_valid = false` (لا يمنع حفظ config، يمنع REAL-LIVE) · عتبات EV المفقودة في `strict` → invalid؛ في `warning_only` → `validation_status = warning` بلا ادّعاء EV-pass · `conflict_resolution` غير قابل للتعديل (محاولة تعديله → `IMMUTABLE_FIELD_FROZEN` أو `READ_ONLY_FIELD_REJECTED`).

## 6. Wallet Registry API Contracts (عقود سجلّ المحافظ)

عمليات على `resource_type = wallet`. حقول per-wallet من SSOT (Groups 2،4،8).

**`register_wallet`** (`operator`): يسجّل محفظة للمتابعة. `follow_enabled` required (§Config). المحفظة watch-only حتى يُضبط. يتحقّق من صحّة per-wallet config. أخطاء: `CONFIG_VALIDATION_FAILED` · `PERMISSION_DENIED`.

**`update_wallet_config`** (`operator`): يعدّل per-wallet config (محكوم بـ mutability — frozen at entry للمراكز المفتوحة). dependency validation (§Config 10): `take_profit_pct` required إن follow_entry · `scale_in_policy=limited_add` يحتاج `copy_adds_for_follow_entry` · عتبات البيع متصاعدة. أخطاء: `IMMUTABLE_FIELD_FROZEN` · `CONFIG_VALIDATION_FAILED`.

**`enable_wallet_follow` / `disable_wallet_follow`** (`operator`): يضبط `follow_enabled`. **التعطيل يمنع الدخول/الإضافات الجديدة فقط، لا يغلق المراكز القائمة** (§Config حاشية 3) — تبقى محكومة بـ Position Manager وقواعد الخروج وHard Risk. (`disable_wallet_follow` ≠ أمر خروج.)

**قراءة:** حالة المحفظة (config + `follow_enabled` + المراكز المرتبطة) read-only.

## 7. Position / Intent API Contracts (عقود المراكز والنوايا)

عمليات على `resource_type = position` و`intent`. المراكز runtime state (read-only) + أوامر تحكّم محدودة.

**قراءة position** (أي دور): `position_state` · `entry_brain` · `current_control_brain` · `market_phase` · `active_exit_route` · `cumulative_ignored_sell` · `config_version_at_entry` — كلها read-only (محاولة كتابتها → `READ_ONLY_FIELD_REJECTED`).

**`manual_exit_position`** (`operator`): خروج يدوي إن سمح `execution_mode`. **يخضع لـ Position Manager و`current_control_brain`** (Brain A: curve math · Brain B: route/reverse quote) وطبقات الأمان وexit feasibility. لا يتجاوز migration limbo (ينتظر route صالح). أخطاء: `COMMAND_NOT_ALLOWED_IN_STATE` (مثل أثناء migration limbo بلا route) · `PERMISSION_DENIED`.

**`emergency_exit_position`** (`admin` افتراضاً · `signer_control` إن مسّ الأمر signer revoke / key control / protected execution override): مسار أمان للخروج الطارئ. **لا يتجاوز Hard Risk ولا Fail Safe**؛ يُستخدَم ضمن KILLED إن كان الخروج أأمن من الترك (§ARCHITECTURE). مُسجَّل في Audit. (الخروج الطارئ نفسه لا يُربَط بالمفاتيح؛ فقط العمليات المرتبطة بالتوقيع/المفاتيح تتطلّب `signer_control`.)

**`cancel_intent`** (`operator`): يلغي نيّة معلّقة (`intent_type = CANCEL_INTENT`). يربط بـ `intent_id`. **مسموح فقط للنوايا pending / not-yet-landed؛ إن كانت landed أو failed أو terminal → `COMMAND_NOT_ALLOWED_IN_STATE`** (cancel لا يلغي صفقة نُفّذت). أخطاء أخرى: `IDEMPOTENCY_CONFLICT` · `RESOURCE_NOT_FOUND` (intent غير موجود).

**قراءة intent** (أي دور): `intent_id` · `intent_type` · `issuing_brain` · `bundle_status` · `failure_type` — read-only (IntentLedger §15.1).

**idempotency:** كل أمر تنفيذ يحمل مفتاح idempotency مربوطاً بـ `intent_id`؛ التكرار → `IDEMPOTENCY_CONFLICT`. لا تكرار شراء/بيع بسبب retry أو duplicate.

---

> **Infra Envelope / Transport Fields (محسومة — SSOT Group 12):** حقول المظروف العامة مسجّلة الآن: `request_id` · `idempotency_key` · `created_at` · `updated_at` · `cursor` · `page_size` · `sort_by` · `sort_order` (`asc`/`desc`) · `error_message` · `error_details` · `event_sequence` · `event_timestamp` · `event_type`. pagination = cursor-based (`cursor` + `page_size`)، لا `page` تقليدي. **`event_type` = classifier عام لرسائل الـ stream فقط، لا بديل عن `copy_event`/`intent_type`/`failure_type`.** §8–9 تستخدم هذه الأسماء المعتمدة.

---

## 8. Runtime / Health Feeds (تغذيات الحالة والصحّة — read-only)

تغذيات قراءة فقط (streams، لا polling). كل الحقول من SSOT (Groups 1،3،4،5،10،12). لا كتابة عبرها (محاولة الكتابة → `READ_ONLY_FIELD_REJECTED`).

**readiness feed** (`event_type = readiness_update`): يبثّ `real_live_config_valid` · `validation_status` · حالة مكوّنات Readiness Checklist · تحذير `WARNING_CRITICAL` (بما فيه warning-only الدائم إن `ev_gate_mode = warning_only`).

**health feed** (`event_type = health_update`): يبثّ `provider_degraded` · `slot_lag` · `last_seen_slot` · `last_confirmed_slot` · `protocol_constant_status` · `bundle_status` (للـ bundles النشطة، رؤية مجمّعة). يعكس مشغّلات EXITS_ONLY/KILLED عند حدوثها. *(حاشية: `bundle_status` في `health_update` رؤية مجمّعة/للـ bundles النشطة فقط؛ حالة الـ bundle لكل نيّة تبقى في `intent_update` — لا يحلّ health محلّ intent feed.)*

**config feed** (`event_type = config_update`): يبثّ `config_version` الحالي عند أي تعديل + `validation_status`. لا يبثّ قيم الإعدادات الحسّاسة كاملة (تُقرأ عبر config resource المحكوم بالصلاحيات).

**position read-model feed** (`event_type = position_update`): يبثّ `position_state` · `entry_brain` · `current_control_brain` · `market_phase` · `active_exit_route` · `migration_phase` لكل مركز. read-only.

**intent read-model feed** (`event_type = intent_update`): يبثّ `intent_id` · `intent_type` · `issuing_brain` · `bundle_status` · `failure_type` لكل نيّة. read-only (IntentLedger §15.1).

**audit feed** (`event_type = audit_event`): يبثّ أحداث Audit Trail (أوامر الكتابة، تعديلات الإعداد، التحوّلات الحرجة). استعلام تاريخي عبر audit resource (cursor-based).

**opportunity read-model feed** (`event_type = opportunity_update`, `stream_channel = opportunity`): يبثّ تحديثات read-model للفرص ما قبل المركز — `hunt_status` · `new_token_priority_score` · الأعلام/الدرجات التشخيصية · `accepted_reason`/`rejected_reason` · `copyability_by_brain` · الكمون/`entry_slippage_vs_leader` (حقول SSOT المسجّلة فقط). **read-only — بلا buy/submit ضمني، بلا command authority** (الكتابة → `READ_ONLY_FIELD_REJECTED`). يشمل أيضاً (read-only، استهلاك أسماء مسجّلة فقط): `quote_mint` كحقل pairing/discovery (`wsol`/`usdc`/`unknown`)؛ و`rejected_reason` قد يحمل `unknown_quote_mint`؛ و`candidate_landing_outcome_by_heat_bucket` كتشخيص observability read-only حيث يُعرض. **لا تمنح هذه الحقول execution authority · لا `buy_opportunity`/`execute_opportunity`/`submit_opportunity` · لا تنفيذ من `accepted` · لا P&L داخل Opportunity/Radar.**

## 9. Event Streams / WebSocket (بثّ الأحداث)

**المبدأ:** اشتراكات فقط، لا HTTP polling (ARCHITECTURE). كل رسالة تحمل مظروف Group 12.

**مظروف الرسالة (envelope — Group 12):** `event_type` (إحدى قيم SSOT المعتمدة) · `event_sequence` (تسلسل رتيب) · `event_timestamp` · payload (حقول من SSOT حسب النوع).

**قيم `event_type` المعتمدة من SSOT تشمل الآن:** `position_update` · `intent_update` · `readiness_update` · `health_update` · `config_update` · `audit_event` · `error_event` · `opportunity_update`. **لا `event_type` خارج SSOT** (wallet_update/provider_update… يُمثَّل داخل الأنواع المعتمدة أو يُوقَف ويُسجَّل في SSOT أولاً).

**الترتيب (ordering):** `event_sequence` رقم رتيب لكشف الفجوات والترتيب؛ المستهلك يكتشف الفجوة بانقطاع التسلسل.

**التوقيت:** `event_timestamp` (ISO 8601) لكل رسالة.

**معالجة الفجوات (gap handling):** على مستوى السلسلة (chain) يُستخدَم `last_seen_slot`/`last_confirmed_slot` للـ replay/backfill ضمن نافذة المزوّد (24h لـ LaserStream)؛ تجاوزها → EXITS_ONLY (ARCHITECTURE §15). على مستوى الـ stream نفسه، انقطاع `event_sequence` يطلب إعادة مزامنة.

**error_event:** يحمل `api_error_code` + `error_message` + `error_details` (Group 12) للأخطاء غير المرتبطة بطلب محدّد (مثل degradation notification).

---

> **Stream Subscription / Protocol Fields (محسومة — SSOT Group 13):** `subscription_id` · `stream_channel` (position·intent·readiness·health·config·audit·error·**opportunity** — قناة read-only لرسائل `opportunity_update`) · `payload_version` · `heartbeat_interval_ms`. **`stream_channel` يحدّد نطاق الاشتراك العام، و`event_type` يحدّد نوع الرسالة داخل ذلك النطاق — لا يحلّ أحدهما محلّ الآخر.**
>
> **قاعدة الإغلاق المزدوجة:** لا رسالة stream تُدخِل `event_type` خارج SSOT · لا payload اشتراك يُدخِل `stream_channel`/stream field خارج SSOT.

---

## 10. Error Codes (رموز الأخطاء — تفصيل)

كل خطأ يُرجَع بـ `api_error_code` (Group 11) + `error_message` (مقروء) + `error_details` (بنيوي اختياري، Group 12). لا رمز خارج enum المعتمد.

| `api_error_code` | المعنى | حالة الإطلاق النموذجية |
|---|---|---|
| `HARD_RISK_BYPASS_REJECTED` | محاولة تجاوز/خفض حدّ Hard Risk | `update_config` يحاول خفض حدّ خسارة عبر warning_only، أو أمر يتخطّى ضابط مخاطر |
| `REAL_LIVE_CONFIG_INVALID` | تنفيذ حيّ وتكوين REAL-LIVE غير صالح | `activate_real_live` و`real_live_config_valid = false` (حدّ Hard Risk ناقص) |
| `IDEMPOTENCY_CONFLICT` | تكرار أمر بنفس مفتاح idempotency/`intent_id` | retry لأمر تداول سبق تنفيذه، أو `idempotency_key` مكرّر |
| `PERMISSION_DENIED` | خرق حدّ الصلاحية | دور أدنى من المطلوب (مثل viewer يحاول `update_config`) |
| `CONFIG_VALIDATION_FAILED` | فشل تحقّق إعداد | `validation_status = invalid` (numeric bounds/enum/dependency) |
| `IMMUTABLE_FIELD_FROZEN` | تعديل إعداد مجمّد على مركز مفتوح بلا migration | `update_config` يمسّ strategy-frozen field ومركز مفتوح قائم |
| `READ_ONLY_FIELD_REJECTED` | محاولة كتابة runtime/derived | محاولة ضبط `operating_state`/`position_state`/`validation_status`/`cumulative_ignored_sell` |
| `COMMAND_NOT_ALLOWED_IN_STATE` | أمر ممنوع بسبب الحالة | دخول جديد في `operating_state = EXITS_ONLY`؛ `cancel_intent` لنيّة landed؛ `manual_exit` في migration limbo بلا route |
| `RESOURCE_NOT_FOUND` | مورد غير موجود | `resource_type`/id غير موجود (intent/position/wallet/opportunity) |

**قواعد عامة:** الخطأ لا يكشف أسراراً (لا مفاتيح، لا تفاصيل توقيع) · `error_details` يذكر الحقل/القيد المخالف باسم `source_of_truth_field` لا قيمة حسّاسة · أخطاء الأمان (`HARD_RISK_BYPASS_REJECTED`, `REAL_LIVE_CONFIG_INVALID`) تدخل Audit دائماً.

**Opportunity (§13) — الحالات المحجوبة بإعادة استخدام القيم القائمة (لا رمز جديد):** كتابة على حقل derived/runtime/decision للفرصة (`hunt_status`/`accepted_reason`/`rejected_reason`/الدرجات/الأعلام/الكمون/`entry_slippage_vs_leader`/`copyability_by_brain`) → `READ_ONLY_FIELD_REJECTED` · محاولة شراء من mint أو تنفيذ من `accepted` أو DexScreener-only execution → `COMMAND_NOT_ALLOWED_IN_STATE` · فرصة غير موجودة → `RESOURCE_NOT_FOUND` · خرق صلاحية → `PERMISSION_DENIED` · اسم legacy مرفوض (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`) أو اسم غير مسجّل في SSOT في الطلب كحقل حقيقي → رفض كحقل غير معروف/غير صالح (validation القائم) · أمر batch exit ذرّي غير مسجّل / أمر تحديث funding-settlement من onboarding غير مسجّل → رفض كأمر غير معروف أو `COMMAND_NOT_ALLOWED_IN_STATE`.

## 11. Idempotency / Audit Requirements (عدم التكرار والتدقيق)

**Idempotency (إلزامية للكتابة):**
- كل أمر كتابة/تنفيذ يحمل `idempotency_key` (Group 12)؛ أوامر التداول تُربَط بـ `intent_id` (IntentLedger §15.1).
- إعادة الإرسال بنفس المفتاح **لا تكرّر الأثر**: تُرجِع نتيجة العملية الأصلية أو `IDEMPOTENCY_CONFLICT` إن كانت قيد التنفيذ.
- لا OrderBuilder بلا `intent_id`، ولا retry بلا نفس `intent_id` أو replacement intent صريح (ARCHITECTURE). يمنع تكرار شراء/بيع بسبب retry أو duplicate landing.
- `request_id` (Group 12) لكل طلب للتتبّع؛ مستقلّ عن `idempotency_key` (الأخير لمنع التكرار، الأول للتتبّع).

**Audit (Audit Everything):**
- كل أمر كتابة وكل تعديل إعداد وكل تحوّل حرج (KILLED، REAL-LIVE activation، signer revoke) يدخل Audit Trail عبر `event_type = audit_event`.
- سجلّ Audit يربط: `command_type` · `resource_type` · `audit_actor` · `permission_role` · `audit_scope` · `audit_reason` · `request_id` · `idempotency_key`/`intent_id` (للأوامر التنفيذية) · `event_sequence` · `event_timestamp` · النتيجة (نجاح/`api_error_code`).
- أخطاء الأمان تُسجَّل دائماً (محاولات `HARD_RISK_BYPASS_REJECTED`/`REAL_LIVE_CONFIG_INVALID`).
- استعلام Audit: read-only، cursor-based (`cursor` + `page_size`)، مرتّب بـ `event_sequence`/`event_timestamp`.
- Audit Trail **غير قابل للتعديل أو الحذف عبر API** (append-only؛ التفاصيل التشغيلية للتخزين في Data Model/Runbook).

---

> **Audit fields (محسومة — SSOT Group 14):** `audit_actor` (هوية المنفّذ، أدقّ من `permission_role`) · `audit_scope` (نطاق الحدث، يرتبط بـ `resource_type`) · `audit_reason` (سبب التحوّل الحرج). **حقول النقل مثل `http_status` و`retry_after_ms` غير مسجّلة في SSOT حالياً ولا تظهر في API payloads؛ إن احتيجت سياسة نقل/خطأ لها فلا تُستخدم ضمن API قبل ARCH→SSOT→API كأسماء candidate واضحة.**

---

## 12. Execution Wallet / Signer API Extension (توسعة محافظ التنفيذ والتوقيع)

> توسعة رسمية للأجزاء 0–11 (لا تلغيها). تطبّق ARCHITECTURE §4.3 وتستخدم SSOT Group 15 (مفردات) + Group 11 (الموارد/الأوامر الموسّعة). الأمان أولاً: لا private key في الواجهة، لا توقيع منها.

### 12.1 Execution Wallet (`resource_type = execution_wallet`)

**قراءة** (أي دور): الحقول المؤصَّلة في SSOT Group 15 فقط — `execution_wallet_id` · `execution_wallet_address` · `execution_wallet_status` · `key_custody_mode` · `signer_profile_id`. أي عرض لـ «حدود المحفظة» أو «آخر استخدام» يكون **تجميعاً من config/audit/intent data موجودة**، أو **حقلاً API ثابتاً لا يُضاف إلا بعد تسجيله في SSOT** (`wallet_limits`/`last_used_at` غير مسجّلين الآن). لا تُعرض أسرار المفاتيح إطلاقاً.

**`register_execution_wallet`** (`admin`): يسجّل محفظة تنفيذ جديدة. تبدأ `execution_wallet_status = WARMING_UP`. لا تصبح ACTIVE تلقائياً. أخطاء: `CONFIG_VALIDATION_FAILED` · `PERMISSION_DENIED`.

**`activate_execution_wallet`** (`admin` · + `signer_control` إن ربط signer/غيّر custody): **admission gate** — ينقل إلى `ACTIVE` فقط بعد: funded · signer reachable · limits configured · key custody verified · not revoked. يُرفَض إن `signer_profile_status` غير صالح أو Hard Risk config غير مكتمل (`REAL_LIVE_CONFIG_INVALID` إن كان للتنفيذ الحيّ). **ليس update عاماً.** أخطاء: `COMMAND_NOT_ALLOWED_IN_STATE` (فحوص غير مكتملة) · `PERMISSION_DENIED`.

**`update_execution_wallet`** (`admin`): يعدّل حدود/إعدادات المحفظة. **لا ينقل إلى `ACTIVE`** (ذلك لـ activate) ولا إلى `REVOKED` (ذلك لـ revoke). أخطاء: `COMMAND_NOT_ALLOWED_IN_STATE`.

**`drain_execution_wallet`** (`admin`): ينقل إلى `DRAINING` — يمنع الدخول الجديد، يُبقي exits/sweeps/asset transfers المصرّح بها حتى `RETIRED`. انتقال تشغيلي مُدقّق (محوري في التدوير).

**`disable_execution_wallet`** (`admin`): تعطيل مؤقّت (`DISABLED`)؛ لا يغلق المراكز القائمة قسراً (تبقى محكومة بـ Position Manager وHard Risk).

**`revoke_execution_wallet`** (`signer_control`): إبطال نهائي (`REVOKED`) — مفتاح مسحوب/مخترق. مُسجَّل في Audit دائماً.

**`set_execution_wallet_assignment_policy`** (`admin`): يضبط `wallet_assignment_policy`. **لا يتجاوز Hard Risk الكلّي** (التعرّض يُجمَع عبر كل المحافظ).

### 12.2 Signer Profile (`resource_type = signer_profile`)

**قراءة** (حسب الصلاحية): `signer_profile_id` · `key_custody_mode` · `signer_profile_status`. **لا أسرار مفاتيح/KMS** (تفاصيلها في 09-THREAT-SECURITY).

**`register_signer_profile`** (`signer_control`): يسجّل ملف توقيع. أخطاء: `PERMISSION_DENIED`.
**`disable_signer_profile`** (`admin`): تعطيل مؤقّت (`DISABLED`/`DEGRADED`).
**`revoke_signer_profile`** (`signer_control`): إبطال (`REVOKED`) — مُسجَّل في Audit دائماً.

> **قاعدة أهلية:** تعطيل أو إبطال signer profile يجعل محافظ التنفيذ المرتبطة به **غير مؤهّلة للدخول الجديد** حتى تُعاد إلى signer profile بحالة `ACTIVE` أو تُوسَم `DRAINING`/`RETIRED` صراحةً. (لا حالة جديدة — قاعدة تشغيلية.)

### 12.3 Asset Transfer (`resource_type = asset_transfer`)

نقل ملكية أصل بين محافظ التنفيذ (وضع buy/sell wallet الخاص).

**`create_asset_transfer_intent`** (`admin` · + `signer_control` إن مسّ النقل signer/key custody أو نقلاً إلى محفظة غير مفعّلة): ينشئ `asset_transfer_intent_id` بحالة `asset_transfer_status = PENDING`. مربوط بـ `idempotency_key`. **`position_owner_wallet_id` لا يتغيّر إلا عند `asset_transfer_status = CONFIRMED`.** محاولة بيع من محفظة غير مالكة → `COMMAND_NOT_ALLOWED_IN_STATE`. (نقل الملكية أعلى حساسية من trade عادي — ليس `operator`.)

**`cancel_asset_transfer_intent`** (`admin`): يلغي نقلاً غير مكتمل. `PENDING` → إلغاء مباشر. `SUBMITTED` → **لا يضمن إلغاء on-chain**؛ يحاول إبطال المتابعة إن لم يصبح `CONFIRMED` بعد، وإلا `COMMAND_NOT_ALLOWED_IN_STATE`. `CONFIRMED`/`FAILED`/`CANCELLED` → terminal، لا يُلغى.

**قراءة:** `asset_transfer_intent_id` · `asset_transfer_status` · `source_execution_wallet_id` · `destination_execution_wallet_id`.

### 12.4 Wallet Rotation (`resource_type = wallet_rotation`)

**`rotate_execution_wallet`** (`admin` · + `signer_control` إن أنشأ signer جديداً): يبدأ تدويراً وفق `rotation_trigger`؛ `wallet_rotation_status = PENDING → IN_PROGRESS`. التدفّق: إنشاء (`WARMING_UP`) → تمويل → القديمة `DRAINING` → كنس → `RETIRED`. كل خطوة Audit.

**`complete_wallet_rotation`** (`admin`): يُنهي التدوير (`COMPLETED`)؛ يتحقّق أن الأصول نُقلت (`asset_transfer_status = CONFIRMED`) والقديمة `RETIRED`. أخطاء: `COMMAND_NOT_ALLOWED_IN_STATE` (تدوير غير مكتمل).

**قراءة:** `wallet_rotation_status` · `rotation_trigger` · `rotation_from_execution_wallet_id` · `rotation_to_execution_wallet_id`.

### 12.5 Profit Sweep (`resource_type = profit_sweep`)

**`sweep_profits`** (`admin`): يكنس الأرباح إلى `settlement_wallet_id` **المُعتمَد حالياً** وفق `profit_sweep_policy`. **لا يغيّر إعداد محفظة التسوية/التمويل** — تغيير وجهة الأموال يمرّ عبر config/security-controlled update flow منفصل (فصل «تنفيذ كنس» عن «تغيير الوجهة»). الـ vault خارج hot path. **`settlement_wallet`/`funding_wallet` لا تتداول** — أمر تداول منها → `COMMAND_NOT_ALLOWED_IN_STATE`.

**قراءة:** `profit_sweep_policy` · `profit_sweep_interval_ms` · `settlement_wallet_address`. أي عرض لـ «آخر كنس» = تجميع من Audit/profit_sweep events، لا response field؛ حقل مثل `last_sweep_at`/`last_sweep_status` يمرّ عبر SSOT أولاً إن لزم.

### 12.6 أثر على الموارد القائمة (positions / intents)

- **positions** تحمل الآن (قراءة، runtime): `position_owner_wallet_id` · `entry_execution_wallet_id` · `current_execution_wallet_id`. كلها read-only عبر API (الكتابة من المحرّك).
- **intents** تحمل الآن: `execution_wallet_id` · `signer_profile_id` (أي محفظة/signer نفّذ النيّة). read-only.
- **قاعدة مُلزِمة:** كل أمر تنفيذ يُربَط بـ `execution_wallet_id` و`signer_profile_id`؛ لا تنفيذ بلا محفظة/signer محدّدين. التعرّض الكلّي عبر كل المحافظ يخضع لـ Hard Risk (Group 6) فوق حدود كل محفظة.

> **Audit إلزامي:** كل أوامر §12 تدخل Audit Trail (`audit_actor`/`audit_scope`/`audit_reason`)؛ أوامر الأمان (`revoke_*`, `activate_execution_wallet`, `rotate_*`) تُسجَّل دائماً مع السبب.

---

## 13. Opportunity API (`resource_type = opportunity` — read-only)

مورد قراءة لطبقة New-Coin Hunting يمثّل الكيان `token_opportunity` ما قبل المركز. **`resource_type=opportunity` يمثّل مفهوم المورد/read-model، وليس حقل payload إلزامياً.** الأسماء كلها معتمدة في SSOT (Groups 16/17/18/20 + مفردات API/stream المسجّلة). **لا `command_type` للفرص · بلا execution authority · بلا أمر ضمني.**

**قراءة** (`viewer` فما فوق · بلا `signer_control` · بلا صلاحية تنفيذ): عمليات/عروض قراءة فقط عبر مظروف الاستعلام المسجّل (`cursor`/`page_size`/`sort_by`/`sort_order`):
- **list opportunities** (New Coin Radar): ترشيح بـ `hunt_status`، ترتيب بـ `new_token_priority_score`.
- **read opportunity details.**
- **Decision Trace view** و **Diagnostics view**: عروض قراءة منطقية فوق payload التفاصيل — **ليست موارد ولا `resource_type` ولا حقول SSOT جديدة** (لا `decision_trace_view`/`diagnostics_view` كأسماء حقول).
- **قاعدة:** الترتيب/الترشيح **سلوك عرض/قراءة فقط ولا يمنح موافقة تنفيذ**؛ `new_token_priority_score` ترتيب/عرض لا EV ولا إذن شراء.

**حقول الـ payload (حقول SSOT المسجّلة فقط):**
- G16: `hunt_status` · `new_token_priority_score` · `recycled_token_flag` · `name_impersonation_score` · `creator_launch_rate_flag` · `token_readiness_score`.
- G17: `accepted_reason` · `rejected_reason`.
- G18: `copyability_by_brain`.
- G20: `discovery_latency_ms` · `signal_to_execution_ms` · `latency_to_copy` · `entry_slippage_vs_leader`.
- مشترك/مظروف مسجّل: `request_id` · `created_at` · `updated_at` · `cursor` · `page_size` · `sort_by` · `sort_order` · `event_sequence` · `event_timestamp` · `payload_version`.
- **applicability:** `accepted_reason` يظهر فقط عند `hunt_status ∈ {accepted, entered}` · `rejected_reason` عند `hunt_status ∈ {rejected, expired, watch_only}`.

**لا تُكشَف storage-only / روابط داخلية (v1.8):** `id` الداخلي · token/mint technical reference · FK لـ `wallet_registry` · `source_events` · FK لـ `intents`/`positions`. **payload الفرصة لا يكشف `intent_id` ولا روابط position؛ ارتباط التنفيذ/المركز يُمثَّل عبر أسطح position/intent/trade-event/attribution المخصّصة حيث ينطبق؛ لا يُسمح بأي ربط ضمني Opportunity→تنفيذ.** أمّا token mint/symbol على `Position` وleader attribution على `Position` فتُكشَف عبر **أسطح المركز المخصّصة (§15.7/§15.8)، لا داخل payload الفرصة**.

**read-only enforcement:** `hunt_status`/`accepted_reason`/`rejected_reason`/الدرجات/الأعلام/الكمون/`entry_slippage_vs_leader`/`copyability_by_brain` كلها read-only؛ محاولة الكتابة → `READ_ONLY_FIELD_REJECTED`.

**قيود الأوامر/التحديث:** رفض `buy_opportunity`/`execute_opportunity`/`submit_opportunity` · شراء من mint · تنفيذ من `accepted` · أمر من `new_token_priority_score` · discovery-only execution · `exit_all_positions`/`batch_exit_all_positions` الذرّي. حقول Config (Groups 19/21) تُحدَّث **فقط** عبر تدفّق config/wallet القائم (`update_config`/`update_wallet_config`)، لا عبر تحوير مورد opportunity. **`stop_loss_pct` بلا toggle `stop_loss` · `max_time_in_position` بلا toggle `time_exit` · `max_liquidity_share_pct` ليس Hard Risk · الحقول derived غير قابلة للضبط.**

**Audit/الأمان:** قراءات الفرص read-oriented ولا تنشئ أحداث command audit بذاتها ما لم تسجّل سياسة observability القائمة القراءات؛ `audit_scope=opportunity` نطاق observability/قراءة فقط؛ تحديثات config/wallet تبقى تحت Audit القائم. **لا أسرار/مفاتيح/seed/signer credentials/auth tokens في response الفرص.**

**حقول لا تُكشَف داخل payload الفرصة نفسه:** عناصر `[F]` السابقة التي رُقّيت في F-Elimination تُكشَف عبر **أسطحها المرشّحة المخصّصة في §15** (price taxonomy · trade event/journal · wallet-token performance · discovery signals · position token identity · leader attribution · balances/sweep · alerts · reports · preferences · glossary · onboarding)، **وليس عبر Opportunity payload**. تبقى Opportunity **read-only/read-oriented بلا P&L · بلا buy command · بلا execution authority**. الأسماء القديمة غير المسبوقة (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`) والأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` تبقى **مرفوضة دائماً** (Rejected، لا تظهر كحقول/أوامر).

---

## 14. v1.8 Delta — API Surfaces (candidate, تستهلك SSOT Groups 22–27)

> كل الأسماء `candidate_*` بانتظار التثبيت بعد ARCH→SSOT (انظر ملاحظة command_type في SSOT Group 11). المبادئ القائمة سارية: runtime/derived **read-only**؛ لا كتابة `position_state`/`real_live_config_valid`؛ كل write **idempotent**؛ لا `buy_opportunity`.

### 14.1 P&L Read-Model (read-only — ARCH §15.2)
- موارد قراءة مشتقّة على **المركز/الصفقة/التجميعات** (لا على الفرصة): `candidate_realized_pnl` · `candidate_unrealized_pnl` · `candidate_fees_total` · `candidate_slippage_cost` · `candidate_paper_pnl` · `candidate_pnl_by_wallet`/`_by_copy_mode`/`_by_brain` · `candidate_remaining_daily_loss_budget`.
- **mark إلزامي للـ unrealized:** يُعاد `candidate_mark_source`/`_timestamp`/`_confidence`/`_status`؛ **إذا `mark_status ≠ valid` لا يُقدَّم unrealized كرقم موثوق** (يُوسَم بالحالة). محاولة كتابة أي حقل P&L → `READ_ONLY_FIELD_REJECTED`.
- **حلّ تعارض §13:** استبعاد P&L من مورد **opportunity** يبقى قائماً (الفرصة ما قبل المركز بلا P&L)؛ الرفع الجديد يخصّ read-model المركز/الصفقة فقط. **يجب على 07-TEST فرض هذا الفصل: حقول P&L المرشّحة تُعامَل كـ candidate API surfaces، بينما أسماء P&L القديمة غير المسبوقة تبقى rejected/forbidden.**

### 14.2 Execution Trace (read-only — ARCH §15.3)
- مورد قراءة per trade/intent: السلسلة الزمنية (12 طابعاً) + 5 latencies + `candidate_attempt_count_per_intent`/`_fee_per_attempt`/`_failed_attempt_cost`/`_priority_fee`/`_jito_tip`/`_entry_slippage_vs_quote`/`_provider_attribution`/`_failure_origin`.

### 14.3 Paper Portfolio (read + control)
- read: `candidate_paper_portfolio` (positions/trades/paper PnL موسومة `simulated`). commands: تشغيل محفظة paper · تحويل paper→real (قرار المستخدم). Strategy Sandbox **paper-only**.

### 14.4 Recommendations (advisory — لا apply مباشر)
- read: `candidate_recommendation` (+ `_type`/`_status`). commands: `candidate_cmd_preview_recommendation_application` · `candidate_cmd_request_config_update_from_recommendation` → يولّدان طلباً يمرّ عبر `preview_config_update`→validation→permission→audit→`update_config`/`apply_config_version`. **لا أمر يطبّق توصية تلقائياً على strategy/risk/live.**

### 14.5 Provider Management (commands + read)
- commands (permissioned): `candidate_cmd_register_provider` · `candidate_cmd_test_provider_connection` (عبر `key_ref` بعد التسجيل) · `candidate_cmd_disable_provider` · `candidate_cmd_set_provider_role`. read: `candidate_provider_connection_status`/`_role`/`_tier`/`_mode`. خطأ: `candidate_err_provider_unconfigured` (single-provider بلا مفتاح). **raw key لا يظهر في أي request/response/audit** — `key_ref` فقط.

### 14.6 Data / Export / Maintenance
- export: `candidate_cmd_start_export_job` → `candidate_export_job` (markdown/csv/parquet/jsonl، بلا أسرار). read: `candidate_storage_usage_metric`/`_data_quality_metric`/`candidate_app_version`.
- **admin/local-ops only:** `candidate_cmd_purge_data` (يستثني audit مالي) · `candidate_cmd_restart_service` (محظور مع pending intents حرجة/active signing) · `candidate_cmd_backup` (بلا مفاتيح خام) · `candidate_cmd_export_diagnostic_bundle` (بلا أسرار). **ليست أوامر operator عادية.**
- **jobs من الواجهة:** permissioned، research≠execution، **لا تتجاوز risk/signer/secret/audit**.

### 14.7 ملاحظة عقود
هذه الأسطح candidate ولا تُفعَّل كـ `command_type`/`resource_type` نهائية قبل تثبيت الأسماء في SSOT. لا تضيف aliases غير مسجّلة. كل أمر له permission_role وaudit.

---

## 15. F-Elimination — API Surfaces (candidate, تستهلك SSOT Groups 22–36)

> عقود مستوى-توثيق فقط — لا DB schema · لا UX screens · لا test cases · لا code/migrations/live. كل اسم مسجّل في SSOT (Groups 22–36) ويبقى `candidate_*` (لا يُفعَّل كـ `command_type`/`resource_type` نهائي قبل اعتماد API). كل write **idempotent + permissioned + audited**؛ runtime/derived **read-only**؛ **لا «pending/later» مفتوحة**.

### 15.1 P&L Read-Model (F1)
read-only من backend/data read-model: `candidate_realized_pnl` · `candidate_unrealized_pnl` · `candidate_fees_total` · `candidate_slippage_cost` · `candidate_paper_pnl` · `candidate_pnl_by_wallet`/`_by_copy_mode`/`_by_brain` · `candidate_remaining_daily_loss_budget`. **لا UX-local calc · لا P&L على Opportunity/Radar.** unrealized يتطلّب `candidate_mark_price`/`_source`/`_timestamp`/`_confidence`/`_status` (وإن `≠ valid` يُوسَم لا يُقدَّم كموثوق). legacy مرفوضة في API: `realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`. إعادة الاحتساب التاريخي تظهر **كـ report/artifact فقط** لا تعديل سجلّات finalized. كتابة أي حقل P&L → `READ_ONLY_FIELD_REJECTED`.

### 15.2 Price Taxonomy (F2)
كائن السعر يحمل: `candidate_price_type` (display/executable_quote/mark/fill/quote) · `candidate_price_provenance` · `candidate_price_timestamp` · `candidate_price_status` · `candidate_price_confidence`. حقول: `candidate_entry_price` · `candidate_current_mark_view` · `candidate_fill_price` · `candidate_quote_price` · `candidate_display_price` · `candidate_quote_impact`. **لا `candidate_current_price`** · display للعرض فقط · executable/route quote متمايز عن mark/fill/display · AMM: liquidity-drain/expected-slippage/quote-impact لا order-book.

### 15.3 Trade Event / Journal (F3)
read-only event/stream + journal view: `candidate_trade_event` · `candidate_trade_event_type` (signal_observed/decision/risk/build/sign/send/land/fill/partial_fill/exit_attempt/exit_fill/close/failure) · `candidate_trade_id` · `candidate_trade_journal`. يربط `intent_id`/position/execution-wallet/leader-followed حيث ينطبق؛ **بلا أسرار**؛ يخدم replay/reports/charts/debug.

### 15.4 Wallet-Token Performance (F4)
read-only: `candidate_wallet_token_performance` · `candidate_wt_net_result` · `candidate_wt_cost_completeness_status` · `candidate_wt_holding_time` · `candidate_wt_entry_timing`/`_exit_timing` · `candidate_wt_repeat_behavior` · `candidate_wt_point_in_time`. **point-in-time/survivorship-free**؛ `net_result` لا يظهر «complete» إلا إذا `cost_completeness_status=complete`؛ partial/estimated/unavailable حقل status صريح؛ لا ranking أعمى بنتيجة ناقصة.

### 15.5 Discovery Signals (F5)
read-only مع confidence/provenance دائماً: `candidate_early_buyer_rank` · `candidate_repeat_winner_metric` · `candidate_cluster_id` · `candidate_cluster_confidence` · `candidate_cluster_method` · `candidate_cluster_provenance`. **احتمالي · لا execution authority · low-confidence ليس حقيقة معروفة.**

### 15.6 Balances / Sweep (F6)
read-only: `candidate_execution_wallet_balance` · `candidate_settlement_wallet_balance` · `candidate_funding_wallet_balance` · `candidate_profits_available_to_sweep` · `candidate_sweep_event` · `candidate_sweep_history` · `candidate_balance_provenance` · `candidate_balance_reconciliation_status`. الكنس عبر أمر `sweep_profits` القائم (ownership-bound)؛ **mismatch يحجب الكنس · لا كنس من غير مالك · لا أسرار في payloads · لا أرصدة مخترَعة.**

### 15.7 Position Token Identity (F7)
on-position read-model: `candidate_position_token_mint` (canonical) · `candidate_position_token_symbol` · `candidate_position_token_name` · `candidate_token_identity_provenance` · `candidate_token_symbol_trust` (verified/unverified/spoof_suspected). **mint canonical للتنفيذ/المطابقة · symbol/name display/untrusted وليست execution truth · spoof_suspected يُكشَف بوضوح.**

### 15.8 Position Leader Attribution (F8)
on-position read-model: `candidate_position_attribution` · `candidate_followed_wallet_id` · `candidate_leader_entity_id` · `candidate_attribution_cluster_id` · `candidate_signal_source` · `candidate_attribution_confidence` · `candidate_attribution_multi_leader`. **read-only · لا execution authority · التعارض/تعدّد القادة لا يُطوى صامتاً · يدعم leader-vs-copier.**

### 15.8a Leader Position Change Reconstruction (Gap A · يستهلك SSOT Group 20)
on-position/leader-diagnostic read-model (مدعوم بـ DATA §9.8a): `candidate_leader_position_change_pct` · `candidate_leader_balance_reconstruction_status` (`reconstructed`/`partial`/`low_confidence`/`unavailable`). **response/read-only فقط — لا تُقبَل في write request؛ محاولة الكتابة → `READ_ONLY_FIELD_REJECTED`.** **لا command authority · لا execution authority · لا تحلّ محلّ `copy_event`.** الاتّجاه/النوع من `copy_event` القائم (`leader_partial_sell`/`leader_full_exit`/`leader_scale_in`) لا من حقل جديد؛ و`candidate_leader_position_change_pct` = **مقدار** تغيّر مركز القائد بعد خصم التحويل/تعديل الـ cluster داخلياً. **إذا `candidate_leader_balance_reconstruction_status ∈ {unavailable, low_confidence}` فلا يُمثَّل التغيّر كرقم مؤكّد، ولا يُوحى بـ 0% أو 100% أو mirror آمن** (المستهلك يلتزم السلوك الحذِر القائم §4.2/§10 — ARCH §15.1 وحدة 3). **لا تُكشَف أرصدة داخلية خام** (`leader_wallet_balance_before/after`/`leader_cluster_balance`/`transfer_adjusted_balance`)، ولا `candidate_leader_sell_percentage`/`candidate_leader_buy_percentage`، ولا `full_exit_detected`/`partial_exit_detected` (تكرار `copy_event`)، ولا leader P&L، ولا `copy_event` جديد، ولا endpoint/أمر كتابة جديد.

### 15.9 Batch Exit Orchestration (F9)
commands: `candidate_cmd_preview_batch_exit` → `candidate_cmd_request_batch_exit`. resources/fields: `candidate_batch_exit_request` · `candidate_batch_exit_preview_id` · `candidate_batch_exit_preview_item_status` (eligible/blocked/stale) · `candidate_batch_exit_preview_valid_until` · `candidate_batch_exit_result_status` (submitted/blocked/failed/skipped/filled). **`exit_all_positions`/`batch_exit_all_positions` مرفوضان · preview قبل request · request يتطلّب `candidate_batch_exit_preview_id` حديثاً وصالحاً (expired/stale → رفض) · كل مركز نيّة مستقلّة تمرّ ownership/route/exit-feasibility/risk/signer/audit · نتائج per-position · لا mass exit صامت · permissioned بلا تجاوز Hard Risk/signer/ownership.**

### 15.10 Alerts (F10)
resources + read/write permissioned: `candidate_alert_rule` · `candidate_alert_event` · `candidate_alert_ack` · `candidate_alert_severity` (info/warning/critical) · `candidate_alert_category` (security/risk/provider/data/ops/execution/wallet) · `candidate_alert_source` · `candidate_alert_preference`. **security+critical لا تُسكت كتجاوز · التفضيلات لا تكتم التنبيهات الإلزامية · ack أمر لكنه لا يُخفي حقائق الأمان.**

### 15.11 Reports / Exports (F11)
resources/commands: `candidate_report_definition` · `candidate_report_artifact` · `candidate_export_history` · `candidate_report_provenance` · `candidate_report_generated_at` · `candidate_cmd_start_export_job` · `candidate_export_job` · `candidate_export_format` (markdown/csv/parquet/jsonl) · `candidate_report_template_id` · `candidate_report_redaction_policy` · `candidate_report_missing_metric_policy` (show_unavailable/omit/block_report). **لا اختلاق مقاييس · strict redaction · artifact يتطلّب provenance+generated_at · لا أسرار/raw keys/seeds/signer credentials/partial secrets في أي payload/export.**

### 15.12 Preferences (F12)
resource: `candidate_ui_preferences` (+ `candidate_pref_language` ar/en · `candidate_pref_direction` rtl/ltr · `candidate_pref_mode` beginner/advanced · `candidate_pref_visible_columns`/`_saved_views`/`_saved_filters`/`_notifications`). **user/UI state لا trading config · لا تعدّل strategy/risk/live/signer.**

### 15.13 Glossary (F13)
resource: `candidate_glossary_content` · `candidate_glossary_version` · `candidate_glossary_locale` (ar/en) · `candidate_glossary_sot_mapping` · `candidate_glossary_edit_policy` (system_managed default / admin_editable permissioned). **لا يعيد تعريف SSOT · يربط `source_of_truth_field`.**

### 15.14 Onboarding Progress (F14)
resource: `candidate_onboarding_progress` · `candidate_ob_steps`/`_completion_state`/`_selected_mode`/`_language_direction`/`_first_wallet_progress`/`_provider_setup_progress`/`_paper_setup_progress`/`_live_readiness_education_progress` · `candidate_onboarding_store_progress`. **حالة/مراجع فقط — لا raw provider key/private key/seed/signer credential/partial secret · provider progress عبر `candidate_provider_key_ref` بعد التسجيل · لا أوامر خارج SSOT/API ولا تجاوز readiness gates.**

### 15.15 Provider Key Flow (تأكيد)
raw provider key يُقبل **فقط** عبر secret registration flow الآمن؛ بعد التسجيل كل payloads العادية تستخدم `candidate_provider_key_ref`؛ `candidate_cmd_test_provider_connection` عبر key_ref بعد التسجيل؛ **لا raw key في browser state/reports/exports/logs/diagnostics/backups.**

### 15.16 Opportunity / Radar Guard (تأكيد)
Opportunity API يبقى read-only/read-oriented (§13): **لا buy command · لا P&L surface · لا execution authority · `accepted` ليست buy · Radar لا يُرسِل تنفيذاً.**

### 15.17 Errors / Permission Behavior
يُعاد استخدام الرموز القائمة: `PERMISSION_DENIED` · `CONFIG_VALIDATION_FAILED` · `READ_ONLY_FIELD_REJECTED` · `COMMAND_NOT_ALLOWED_IN_STATE` · `HARD_RISK_BYPASS_REJECTED`. سلوكيات F-Elimination: كتابة read-model → `READ_ONLY_FIELD_REJECTED` · request batch-exit بلا preview حديث → رفض (سلوك موصوف، لا رمز جديد غير مسجّل) · إسكات security+critical → مرفوض. **لا تُخترَع رموز جديدة غير مسجّلة في SSOT.**

---

## 16. Wave 1 — Profit & Paper Truth — API Surfaces (candidate, تستهلك SSOT Group 37)

> عقود مستوى-توثيق فقط — **لا DB schema · لا UX screens · لا test cases · لا code/migrations/live.** كل اسم مسجّل في **SSOT Group 37** ويبقى `candidate_*` (لا يُفعَّل كـ `resource_type`/`command_type` نهائي قبل اعتماد API). **كل هذه الأسطح read-only/derived — لا write commands** (كتابة أيّ منها → `READ_ONLY_FIELD_REJECTED`، رمز قائم لا جديد). **Paper موسوم `simulated` ولا يُخلَط مع real/live.** المقاييس غير المتوفّرة تتبع `candidate_report_missing_metric_policy=show_unavailable` (لا اختلاق). أي اسم غير مسجّل في SSOT **لا يُضاف** (انظر requires_ssot_followup في التقرير).

### 16.1 Anti-Fake Edge (W1-01)
يوسّع wallet analytics / copyability read-model (يُجاور §15.4/§15.5 وGroup 18/26): `candidate_fake_profit_risk` · `candidate_fake_profit_reason` (self_trading/wash_trading/fake_volume/linked_wallet_circular_activity/creator_dev_controlled_trading/artificial_liquidity_activity_loop) · `candidate_fake_profit_adjusted_edge`. **derived/read-only.** يعيد استخدام `candidate_is_copycat_flag` وcluster signals (§15.5). **الربح الوهمي لا يرفع copyability:** `candidate_fake_profit_adjusted_edge` يخفض `candidate_wallet_net_copyability_rank` (G26) ولا يرفعه، ويُعرَض مع reason. **حجب الترقية لا معلومة جانبية.**

### 16.2 Profit Source Attribution (W1-02)
يوسّع wallet/copyability read-model: `candidate_profit_source_attribution` · `candidate_profit_source_type` (early_entry/token_selection_quality/exit_timing/insider_non_copyable_information/execution_speed_advantage/artificial_pump_profit/non_repeatable_luck_one_off) · `candidate_profit_source_copyability_class` (copyable/partially_copyable/non_copyable) · `candidate_copyable_profit_share` · `candidate_non_copyable_profit_share`. **derived/read-only.** كل `source_type` يُعاد مع `copyability_class` (explanation structure)؛ **`non_copyable` (insider/artificial_pump/one-off) لا يُعرَض كـ copyable edge.** inputs من `candidate_leader_vs_copier_delta` (G26) و`candidate_wt_entry_timing`/`_exit_timing` (§15.4).

### 16.3 token_readiness_score Components (W1-03)
يوسّع opportunity/token readiness response (§13 + Group 16): `candidate_token_readiness_component` · `candidate_token_readiness_component_type` (token_age/liquidity/route_health/volatility/holder_risk/creator_risk/exit_feasibility/slippage_risk/migration_graduation_state/provider_route_reliability/wash_fake_activity_risk) · `candidate_token_readiness_component_reason` · `candidate_token_readiness_component_veto`. **derived/read-only.** الـ response يتيح **breakdown لكل component** ولا يُعيد `token_readiness_score` رقماً معتماً وحده؛ **`component_veto=true` يظهر بوضوح** ويعكس حجب الجاهزية رغم إجمالي جيد. (Opportunity يبقى read-only بلا P&L — §13/§15.16.) **توسعة read-only:** حيث يُعرَض `candidate_token_safety_reason` ضمن token/position safety trace، قد يحمل القيمة `hook_upgraded_mid_hold` كتشخيص **safety/exit أثناء الاحتفاظ** (لا مكوّن دخول)؛ **لا endpoint/command/hash field جديد** — الأدلّة في Audit/provenance القائمة، والرفض النهائي للدخول يبقى `token2022_dangerous_extension`.

### 16.4 Realistic Paper Simulation (W1-04)
يوسّع paper/P&L read-model (§14.1/§15.1، ARCH §15.9): `candidate_paper_pnl_gross_theoretical` · `candidate_paper_pnl_execution_aware` · `candidate_paper_cost_impact` · `candidate_paper_failure_impact`. **derived/read-only، `simulated` دائماً، لا تُعرَض كـ real.** `execution_aware` يوسّع `candidate_paper_pnl` (§14.1) ومشتقّ من CostPipeline/FailedTransactionClassifier/Calibration (failure factors عبر `candidate_failure_origin` §14.2)؛ **لا breakdown مُختلَق عند unavailable** (يُوسَم). **gross_theoretical لا يُقدَّم كدليل ربحية وحده.**

### 16.5 Paper Outcome States (W1-05)
يوسّع paper trade read-model: `candidate_paper_outcome_state` · `candidate_paper_outcome_reason`. enum:
```
type CandidatePaperOutcomeState =
  | "reached_target" | "exited_with_loss" | "failed_entry" | "failed_exit"
  | "exit_unavailable" | "route_failed" | "expired" | "rejected_by_policy"
  | "still_open" | "force_closed_by_safety";
```
**derived/read-only · لا paper trade بلا outcome state.** **مختلف عن `position_state` (runtime lifecycle، §7):** outcome هو تصنيف terminal لصفقة paper للتقرير لا حالة دورة حياة. الطوابع تُعاد عبر Execution Trace `candidate_ts_*` القائمة (§14.2)؛ الفشل يشير إلى `candidate_failure_origin`.

### 16.6 Paper Aggregation Report (W1-06)
يوسّع Reports/Exports (§15.11): `candidate_paper_aggregation_report` (report_definition instance عبر `candidate_report_definition`/`candidate_report_template_id`) · `candidate_paper_aggregation_dimension` (wallet/mode/strategy/token_class/period) · `candidate_paper_aggregation_metric` (max_drawdown/win_rate/avg_win/avg_loss/profit_factor/expectancy/median_hold_time/average_hold_time/failed_trade_rate/rejected_opportunity_count/exit_failure_rate/slippage_impact/latency_impact/fees_impact). **read-only · context = paper/simulated · لا خلط مع real/live · المقياس المفقود `show_unavailable` (لا اختلاق، عبر `candidate_report_missing_metric_policy`).** يُعيد استخدام `candidate_wallet_avg_hold_time`/`_max_drawdown_if_copied` (G26) حيث ينطبق.

### 16.7 Paper↔Real Divergence (W1-07)
يوسّع calibration/readiness/report read-model (ARCH §9/95% · §15.11): `candidate_paper_real_divergence` · `candidate_paper_real_divergence_dimension` (fill/slippage/exit_success/latency/provider_reliability) · `candidate_paper_real_divergence_status` (within_band/elevated/high). **derived/read-only.** `status=high` ينتج **warning/readiness signal** ويغذّي Calibration Kill/Pause **القائم** فقط — **ليس gate API حاجباً جديداً** على قرار REAL-LIVE (قرار المستخدم §3). يظهر في التقارير **قبل** أي ترقية paper→real. المصدر: CalibrationStore `simulated_*` مقابل `real_*`.

### 16.8 Point-in-time / Survivorship — Contract Note (W1-08)
**لا حقل API جديد.** ملاحظة عقد على أسطح wallet discovery / backtest / wallet analytics: أي مخرَج يدّعي صلاحية تاريخية **يجب أن يكون point-in-time (بيانات ≤ T) · no future leakage · survivorship-free cohort (المحافظ المنقرضة/الفاشلة ضمن العينة).** يُستخدم `candidate_wt_point_in_time` (§15.4) كعلَم منهجي حيث ينطبق. **إن لم تتوفّر الأدلّة، يجب ألّا يدّعي الـ response صلاحية survivorship-free.** التحقّق نفسه follow-up في 07-TEST-PLAN — لا runtime field.

### 16.9 Errors / Permission Behavior (تأكيد)
يُعاد استخدام الرموز القائمة فقط: كتابة أي read-model من §16 → `READ_ONLY_FIELD_REJECTED` · خرق صلاحية → `PERMISSION_DENIED`. **لا write endpoints جديدة · لا رموز خطأ جديدة · لا aliases خارج SSOT Group 37.** أي اسم يلزم ولم يُسجَّل في SSOT يُترَك (requires_ssot_followup) ولا يُضاف هنا.

---

## 17. Wave 2 — Discovery & Copy Safety — API Surfaces (candidate, تستهلك SSOT Group 38)

> عقود مستوى-توثيق فقط — **لا DB schema · لا UX screens · لا test cases · لا code/migrations/live.** كل اسم مسجّل في **SSOT Group 38** (أو اسم قائم) ويبقى `candidate_*`. **كل هذه الأسطح read-only/derived (وadvisory عند drift/learning/adverse-selection) — لا write endpoints · لا commands جديدة** (كتابة أيّ منها → `READ_ONLY_FIELD_REJECTED`، رمز قائم). **لا تصنيف/مقياس يمنح execution authority · لا auto-ban · لا auto-config · `full_mirror` ليس default.** أي اسم/threshold غير مسجّل في SSOT **لا يُضاف** (requires_ssot_followup في التقرير).

### 17.1 Wallet Taxonomy (W2-01)
يوسّع wallet intelligence/analytics/copyability read-model (§15.4/§15.5/§16.1): `candidate_wallet_type` (smart_money_wallet/kol_wallet/bot_wallet/insider_wallet/dev_creator_wallet/mev_sniper_wallet/copycat_wallet/linked_cluster_wallet) · `candidate_wallet_type_confidence` · `candidate_wallet_type_provenance`. **derived/read-only.** يعيد استخدام `candidate_is_copycat_flag` · `candidate_cluster_id` (§15.5) · `candidate_fake_profit_*` (§16.1). **low-confidence لا يُعرَض كحقيقة مؤكدة** · **insider/dev/sniper/copycat لا يرفعون `candidate_wallet_net_copyability_rank` تلقائياً** · لا execution authority.

### 17.2 Token Concentration (W2-02)
يوسّع opportunity/token readiness response (§13/§16.3): `candidate_token_concentration_dimension` (creator_dev_concentration/holder_concentration/bundled_wallets/linked_early_buyers/top_holder_risk/creator_previous_launch_quality/creator_dump_behavior/cluster_ownership_concentration) · `candidate_token_concentration_risk` · `candidate_token_concentration_reason`. **derived/read-only.** يُظهر أنها **تغذّي `candidate_token_readiness_component`** (§16.3)، وعند الحجب يظهر عبر **`candidate_token_readiness_component_veto`**. **creator/dev/cluster concentration لا يُعرَض كطلب طبيعي** · لا execution authority · لا thresholds مُضافة (requires_ssot_followup).

### 17.3 Natural vs Artificial Pump (W2-03)
يوسّع token opportunity/signal response (§13): `candidate_pump_classification` (natural_pump/artificial_pump_linked_wallets/artificial_pump_wash_trading/kol_or_bot_amplified_pump/creator_dev_manipulated_pump/unknown_or_insufficient_evidence) · `candidate_pump_classification_reason` · `candidate_pump_classification_confidence`. **derived/read-only، منفصل عن السعر الخام** (ارتفاع السعر وحده ليس proof) · `unknown_or_insufficient_evidence` **لا يُعرَض كـ natural demand** · `artificial_*` يظهر كسبب watch_only/rejection/readiness reduction **لا كأمر**. يعيد استخدام `candidate_fake_profit_*` (§16.1).

### 17.4 Wallet Drift Alert (W2-04)
يوسّع wallet analytics/alerts/recommendations (§15.10 Alerts/§16): `candidate_wallet_drift_signal` · `candidate_wallet_drift_reason` (win_rate_degraded/average_slippage_worsened/exits_became_slower/lower_quality_tokens/copycat_like_behavior/bot_like_behavior/insider_dev_like_behavior/copyability_degraded/fake_profit_risk_increased) · `candidate_wallet_drift_recommendation` (keep_following/reduce_size/pause_follow/switch_to_watch_only/require_review). **read-only/advisory.** يبني على `candidate_wallet_behavior_drift_flag` (§15.8 F8/analytics). **التوصية لا تطبّق config تلقائياً · لا تغلق مراكز · لا command** — أي reduce/pause/switch عبر user/config flow القائم.

### 17.5 Default Copy Mode Policy — API validation/read contract (W2-05)
contract note على wallet config response/validation (لا write جديد): يعيد استخدام `copy_mode` (follow_entry_user_exit/full_mirror) و`candidate_copy_mode_default_policy`. **القواعد:** محفظة متبوعة جديدة **بلا `copy_mode` صريح → يُحَل إلى `follow_entry_user_exit`** · **`full_mirror` ليس default ويتطلّب explicit per-wallet enablement** · legacy/migration بلا `copy_mode` واضح → safe default أو requires review، **ولا يتحوّل إلى `full_mirror`**. **لا حقل API جديد لـ advanced confirmation** (غير مسجّل في SSOT → requires_ssot_followup) · **لا write command جديد · لا تغيير CONFIG.**

### 17.6 Creator / Cluster Learning (W2-06)
يوسّع creator/cluster risk/wallet intelligence/token risk read-model: `candidate_creator_cluster_learning` · `candidate_creator_cluster_learning_metric` (creator_historical_quality/cluster_historical_quality/creator_dump_rate/post_launch_survival_quality/average_exit_feasibility/repeated_rug_exit_failure_behavior/paper_live_outcome_attribution_by_creator_cluster/cluster_repeat_manipulation_pattern) · `candidate_creator_cluster_learning_recommendation` (avoid/watch_only/reduce_size/allow_small_paper/eligible_for_normal_evaluation) · `_confidence` · `_provenance`. **read-only/advisory · no auto-ban · no auto-config · low-confidence ليس حقيقة.** **contract note:** point-in-time مطلوب (يعيد استخدام `candidate_wt_point_in_time`، §15.4) — لا تعلّم من المستقبل.

### 17.7 Adverse Selection (W2-07)
يوسّع copyability/wallet analytics/copy diagnostics read-model (§16.7 divergence مجاور): `candidate_adverse_selection_metric` · `candidate_adverse_selection_reason` (late_entry_after_leader/slippage_from_delay/copied_worst_part_of_move/latency_drag/route_quote_degradation/failed_or_late_exit) · `candidate_adverse_selection_severity` (low/elevated/high). **derived/read-only.** يعيد استخدام `candidate_leader_vs_copier_delta` · `latency_to_copy` · `entry_slippage_vs_leader` · `candidate_wt_exit_timing`. **لا يخلط ربح القائد بربح التابع** · `severity=high` يظهر كـ **advisory warning/watch_only/reduce_size reason لا command** · لا execution authority · لا config auto-change.

### 17.7a Copyability Veto (Gap C · يستهلك SSOT Group 18)
يوسّع wallet intelligence/copyability read-model (مدعوم بـ DATA §5.6 · بجوار `copyability_by_brain`/`crowd_follow_score`/`profit_concentration`/`tracked_wallet_status`): `candidate_copyability_component_veto` (bool) · `candidate_copyability_veto_reason` (`risky_wallet_type`/`fake_profit_risk`/`adverse_selection_high`/`crowd_follow_decay`/`profit_concentration_one_hit`/`non_copyable_profit_source`/`insufficient_evidence`). **response/read-only فقط — لا تُقبَل في write request؛ محاولة الكتابة → `READ_ONLY_FIELD_REJECTED`.** **يفسّران `tracked_wallet_status` ولا يحلّان محلّه**؛ عند `candidate_copyability_component_veto = true` **لا تُمثَّل المحفظة كـ `copy_allowed`** بل تُحَلّ بتحفّظ إلى `watch_only`/`degraded` حسب الشدّة/السياق/السياسة. `banned` يبقى سياسة متابعة/تقييم — **لا حظر أمني لمحفظة التنفيذ، ولا إغلاق مراكز، ولا تغيير config تلقائي.** يعيد استخدام مكوّنات copyability القائمة (G18/G26/G37/G38) **بلا score مُعتم — لا `wallet_trust_score`، ولا `copyability_score` رقمي، ولا ranking-score جديد يُكشَف.** **لا command authority · لا execution authority · لا auto-ban/auto-close/auto-config · لا `copy_event` جديد · لا opportunity execution.**

### 17.7b Edge Health Advisory (Gap D · يستهلك SSOT Group 26)
يوسّع wallet intelligence/copyability read-model (مدعوم بـ DATA §5.6 · بجوار §17.7a): `candidate_edge_health_status` (`healthy`/`weakening`/`insufficient_evidence`/`no_edge_suspected`). **response/read-only فقط — لا تُقبَل في write request؛ محاولة الكتابة → `READ_ONLY_FIELD_REJECTED`.** **advisory-only**؛ يشرح صحّة ميزة المحفظة per-wallet و**لا يحلّ محلّ `tracked_wallet_status`**. تجميع من إشارات قائمة فقط (`candidate_paper_real_divergence_status`/`candidate_adverse_selection_severity`/`candidate_net_business_pnl`+`_status`/`candidate_leader_vs_copier_delta`/`entry_slippage_vs_leader`/`candidate_failed_attempt_cost`/`candidate_wallet_drift_*`/`candidate_copyability_component_veto`+`_reason`/`tracked_wallet_status`/كفاية الدليل). **`no_edge_suspected` تحذير استشاري لا تعطيل تلقائي · `insufficient_evidence` لا يُمثَّل كصفر مخاطر ولا دليل ميزة · أداء Paper لا يُمثَّل كميزة Real.** التوصية للمشغّل تُعاد من المفردات القائمة (`candidate_wallet_drift_recommendation`/`candidate_recommendation_type`) — **لا مفردات/score جديد**. قد يغذّي تدفّق التوصية وCalibration Kill/Pause القائمين. **لا command/execution authority · لا auto-ban/auto-close/auto-config/auto-disable · لا forced live blocker · لا `copy_event` جديد · لا opportunity execution · لا `candidate_uncopyable_flag` ولا edge score مُعتم.**

### 17.8 Errors / Permission Behavior (تأكيد)
يُعاد استخدام الرموز القائمة فقط: كتابة أي read-model من §17 → `READ_ONLY_FIELD_REJECTED` · خرق صلاحية → `PERMISSION_DENIED`. **لا write endpoints/commands جديدة · لا رموز خطأ جديدة · لا aliases خارج SSOT Group 38 · لا execution authority/auto-ban/auto-config · `full_mirror` ليس default.** أي اسم غير مسجّل في SSOT يُترَك (requires_ssot_followup).

---

## 18. Wave 3 — Reports & Honesty — API Surfaces (candidate, تستهلك SSOT Group 39)

> عقود مستوى-توثيق فقط — **لا DB schema · لا UX · لا test cases · لا code/migrations/live · لا report generation implementation.** كل اسم مسجّل في **SSOT Group 39** (أو قائم) ويبقى `candidate_*`. **كل هذه الأسطح read-only/report/derived — لا write endpoints · لا commands جديدة** (كتابة → `READ_ONLY_FIELD_REJECTED`). **لا execution authority من تقرير/مقياس/disclaimer · لا تغيير سلوك EV gate/Hard Risk · لا execution mode · لا خلط Paper/Testnet/Real-Live · `warning_only` ليس clean_pass · unavailable/insufficient evidence ليس صفراً.** أي اسم/template ID غير مسجّل = requires_ssot_followup.

### 18.1 Daily Unified Report (W3-01)
read-only report surface (يوسّع §15.11 Reports/§16): `candidate_daily_unified_report` (instance من `candidate_report_definition` §15.4 F11) · `candidate_report_context` (simulated/testnet/real_live) · `candidate_report_section` (paper_results/real_live_results/testnet_results/rejected_opportunities/failed_trades/open_risk/provider_health/config_changes/safety_gate_state/data_quality_issues/major_alerts) · `candidate_report_missing_metric_policy`. **أقسام منفصلة لا حساب مخلوط · context إلزامي · المقياس المفقود `show_unavailable`/insufficient evidence لا صفر · لا execution authority · لا write.**

### 18.2 Report Definitions Catalog (W3-02)
read-only catalog surface: `candidate_report_catalog` · `candidate_report_definition_type` (daily_unified_report/per_wallet_report/per_token_report/failed_trade_report/rejected_opportunity_report/copy_mode_report/provider_report/creator_cluster_report/strategy_mode_report/paper_aggregation_report/paper_real_divergence_report/net_business_pnl_report/weekly_comparison_report) · `candidate_report_definition` · `candidate_report_template_id` · `candidate_report_provenance` · `candidate_report_missing_metric_policy`. **القوالب الرسمية لا تستبدلها custom · كل تعريف يحمل scope/context/dimensions/metrics/evidence/missing-metric/disclaimer/paper-real-separation · لا template IDs نهائية غير مسجّلة (requires_ssot_followup) · لا command توليد جديد.** يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence` (§16).

### 18.3 Weekly Comparison Report (W3-03)
read-only report surface: `candidate_weekly_comparison_report` · `candidate_weekly_comparison_axis` (wallet/copy_mode/brain/provider/strategy/token_class/config_before_after/paper_real_divergence/creator_cluster_cohort/adverse_selection_impact) · `config_version_at_entry` · `candidate_report_missing_metric_policy`. **`config_before_after` يحترم `config_version_at_entry` · لا auto-apply · لا خلط Paper/Real/Live · الفروقات المفقودة `unavailable`.**

### 18.4 Disclaimer Standard (W3-04)
report metadata/requirements: `candidate_report_disclaimer_requirement` (past_performance_not_future_profitability/paper_not_live_profitability/backtest_requires_point_in_time_evidence/results_affected_by_cost_latency_provider_data_quality/high_confidence_not_certainty/recommendations_are_advisory_until_user_config_flow) · `candidate_report_disclaimer_required_for` (paper/backtest/weekly/recommendation/promotion). **يظهر كـ requirements/metadata في report definitions/responses · لا يمنح صلاحية ولا يصحّح تقريراً غير صالح · لا يختفي في advanced mode.**

### 18.5 Net Business PnL (W3-05)
read-only/derived report surface: `candidate_net_business_pnl_report` · `candidate_net_business_pnl` · `candidate_business_cost_component` (provider_credit_cost/rpc_streaming_cost/infra_storage_export_report_cost/subscription_provider_cost) · `candidate_net_business_pnl_status` (complete/partial/unavailable). يعيد استخدام `candidate_realized_pnl`/`candidate_fees_total`/`candidate_slippage_cost` (§16.4/§15.1 P&L) · `candidate_storage_usage_metric` (§14.6). **derived reporting فقط · ليس بديلاً لـ trade P&L · لا execution authority · unavailable/partial لا صفر · positive trade P&L لا يعني positive business P&L · لا cost source field غير مسجّل (requires_ssot_followup).**

### 18.6 warning_only Report Tag (W3-06)
read-only report/result metadata: `candidate_report_gate_context` (clean_pass/warning_only_advisory/blocked) · `candidate_warning_only_report_tag` (true/false) فوق `ev_gate_mode`/`warning_only`/`WARNING_CRITICAL`. **disclosure فقط لا behavior · `warning_only_advisory` لا يظهر كـ `clean_pass` · failed EV لا يختفي · لا يغيّر EV gate · لا يضعف Hard Risk · لا execution mode · لا report promotion بلا disclosure · لا execution authority.**

### 18.7 Errors / Permission Behavior (تأكيد)
يُعاد استخدام الرموز القائمة فقط: كتابة أي read-model/report من §18 → `READ_ONLY_FIELD_REJECTED` · خرق صلاحية → `PERMISSION_DENIED`. **لا write endpoints/commands جديدة · لا report generation implementation · لا رموز خطأ جديدة · لا aliases خارج SSOT Group 39 · لا execution authority · لا تغيير EV gate/Hard Risk · لا خلط Paper/Testnet/Real-Live.** أي اسم/template ID غير مسجّل في SSOT يُترَك (requires_ssot_followup).

---

## 19. Wave 4 — Execution / Providers + Data — API Surfaces (candidate, تستهلك SSOT Group 40)

> عقود مستوى-توثيق فقط — **لا DB · لا UX · لا test · لا code/migrations/live · لا provider setup/connection implementation.** كل اسم مسجّل في **SSOT Group 40** (أو قائم) ويبقى `candidate_*`. **كل هذه الأسطح read-only/report/diagnostic/advisory — لا write endpoints · لا commands جديدة** (كتابة → `READ_ONLY_FIELD_REJECTED`). **لا provider raw key/secret/credential في requests/responses · key material خارج browser/UI/report/export/API payloads · لا provider connection/execution command.** **لا إشارة provider/execution/data-cost/opportunity تمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · المفقود unavailable/partial لا صفر/clean.** أي اسم غير مسجّل = requires_ssot_followup.

### 19.1 Provider Latency Comparison (W4-01)
read-only diagnostic/observability surface: `candidate_provider_latency_metric` · `candidate_provider_latency_type` (stream_latency/quote_latency/route_latency/send_latency/confirmation_finality_latency/provider_response_error_latency) · `candidate_provider_latency_comparison`. يعيد استخدام `provider_degraded`/`slot_lag` + Execution Trace `candidate_ts_*` (§16 attribution) بالإحالة. **latency مفقودة → unavailable لا صفر · best/worst advisory · لا auto provider selection · fast provider ليس safe/executable · لا execution authority · لا write.**

### 19.2 Rate-limit & Provider Cost Monitor (W4-02)
read-only monitor/report surface: `candidate_provider_rate_limit_monitor` · `candidate_provider_cost_metric` (rate_limit/quota_usage/credit_usage/request_cost/period_cost/cost_per_trade/cost_per_report/cost_per_job/throttling_backoff_state/provider_degradation) · `candidate_provider_cost_attribution_status` (complete/partial/unavailable). يُغذّي `candidate_net_business_pnl`/`candidate_business_cost_component` (§18.5) **دون إعادة تعريفه**. **partial/unavailable لا صفر · availability وaffordability منفصلتان · لا provider billing/pricing fields جديدة · لا execution authority · لا write.**

### 19.3 Fork / Rollback (W4-03)
read-only finality/network state surface: `candidate_finality_state` (no_rollback_detected/rollback_risk/fork_detected/rollback_confirmed/finality_uncertain) · `candidate_rollback_fork_reason`. يعيد استخدام `NETWORK_ROLLBACK_EVENT`/`provider_degraded`/`slot_lag`. **rollback-affected data يظهر warning/provenance ولا يُعامَل كحقيقة نهائية · لا gate جديد · لا تغيير Risk Gates/Hard Risk · `no_rollback_detected` ليس execution-safe · لا execution authority · لا write.**

### 19.4 Provider Onboarding & Key/Connection Validation (W4-04)
read-only provider setup/readiness/diagnostic surface: `candidate_provider_onboarding_status` · `candidate_provider_type` (helius/jito/jupiter/generic_rpc/generic_stream) · `candidate_provider_capability_status` · `candidate_provider_connection_test_status` · `candidate_provider_onboarding_failure_reason`. يعيد استخدام `candidate_provider_key_ref` **كمرجع فقط**. **raw keys/secrets/credentials ممنوعة · responses لا تعرض key material · connection test status ليس trading readiness · Jupiter key/connection validation حالة عند استخدام quotes/routes · provider readiness لا يتجاوز SignerService/Risk Gates/admission gates · لا provider connection command · لا provider setup implementation · لا write.**

### 19.5 Storage Cost + Survivorship-Safe Retention (W4-05)
read-only storage cost/report surface: `candidate_storage_cost_report` · `candidate_storage_cost_component` (data_type/retention_period/volume/hot_cold_archive_tier/report_export_artifacts/replay_backtest_datasets) · `candidate_retention_impact_warning` · `candidate_pruning_safety_status` (safe/survivorship_risk/point_in_time_risk/audit_integrity_risk). يعيد استخدام `candidate_storage_usage_metric` + يربط بـ `candidate_net_business_pnl`. **storage cost مفقود → partial/unavailable لا صفر · retention impact warning يظهر عند التأثير على historical wallet discovery/dead-failed-disappeared wallets/replay-backtest validity/audit-trade-accounting records · cost-saving deletion لا يخلق survivorship bias صامتاً · لا purge command جديد · لا storage pricing/billing fields نهائية · لا execution authority.**

### 19.6 Rejected Opportunity Re-evaluation (W4-06)
read-only/advisory opportunity surface: `candidate_rejected_opportunity_reevaluation` · `candidate_reevaluation_trigger` (liquidity_improved/route_health_improved/holder_risk_improved/creator_risk_improved/pump_confidence_improved/concentration_risk_improved/provider_data_quality_improved/exit_feasibility_improved) · `candidate_reevaluation_recommendation` (keep_rejected/keep_watch_only/review_again/eligible_for_paper/eligible_for_normal_evaluation). يعيد استخدام `hunt_status`/`watch_only`/`candidate_rejected_reason`؛ original rejection reason + new evidence واضحان بالإحالة. **لا buy/execute · لا auto-open position · لا auto-config · improved opportunity لا يثبت edge · `eligible_for_normal_evaluation` ليس execution-ready · لا write.**

### 19.7 Best Paper Settings This Week Advisory (W4-07)
read-only/advisory report surface (Paper-only context): `candidate_best_paper_settings_advisory` · `candidate_paper_settings_recommendation` · `candidate_paper_settings_evidence_status` (sufficient/insufficient_evidence/unavailable). يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence`/`candidate_weekly_comparison_report`/`candidate_report_disclaimer_requirement`. يحمل sample size/confidence/time period/mode/strategy/copy_mode/fees/slippage/latency/failure impact/paper-real divergence (حيث متاح)/disclaimer. **insufficient_evidence/unavailable لا صفر ولا success · best paper setting ليس live-ready · لا auto-apply · لا live promotion بلا gates/disclosure · لا write.**

### 19.8 Graduation Trap States (W4-08)
read-only token risk/readiness/report surface: `candidate_graduation_trap_state` (graduation_pending/migration_limbo/post_graduation_exit_unsafe/post_graduation_liquidity_fragile/post_graduation_route_unhealthy/post_graduation_watch_only/graduation_trap_confirmed). يعيد استخدام `MIGRATION_IN_PROGRESS`/migration_phase/`candidate_token_readiness_component` + exit feasibility. **يؤثّر على readiness/exit feasibility/reports · لا execution authority · لا gate جديد هنا · graduation ليس exit safety · `post_graduation_watch_only` لا يعني buy/execute · غياب دليل route/liquidity/exit ليس clean/safe · لا write.**

### 19.9 Errors / Permission Behavior + Cross-W4 (تأكيد)
يُعاد استخدام الرموز القائمة فقط: كتابة أي read-model من §19 → `READ_ONLY_FIELD_REJECTED` · خرق صلاحية → `PERMISSION_DENIED`. **كل أسطح §19 read-only/advisory/diagnostic/reporting · لا buy/execute/submit/write endpoint · لا commands · لا provider connection/setup · لا raw key/secret/credential في payloads · لا execution authority · لا auto-execution/auto-config · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · المفقود unavailable/partial لا صفر/clean.** أي اسم/threshold/template ID غير مسجّل في SSOT Group 40 يُترَك (requires_ssot_followup).

---

## 20. Wave 5 — Local Ops & Readiness — API Surfaces (candidate, تستهلك SSOT Group 41)

> عقود مستوى-توثيق فقط — **لا DB · لا UX · لا test · لا code/scripts/launcher/runtime/migrations/live · لا provider setup/connection implementation.** كل اسم مسجّل في **SSOT Group 41** (أو قائم) ويبقى `candidate_*`. **كل هذه الأسطح read-only/status/diagnostic/advisory — لا write endpoints · لا commands جديدة** (كتابة → `READ_ONLY_FIELD_REJECTED`). **لا service-control/restart/shutdown/backup/restore/purge/rollback/migration command · لا provider connection command · لا raw key/secret/credential في payloads أو displays.** **Local run/health/version/logs/status لا يمنح execution authority · health green ليس trading readiness · SignerService health ليس permission to sign · provider health ليس trading readiness · documented_only/candidate ليس implemented · unknown/unavailable/not_verified لا clean/ready/implemented · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا live/testnet/mainnet.** أي اسم غير مسجّل = requires_ssot_followup.

### 20.1 Local Run UI-first Workflow (W5-01)
read-only status/readiness read-model: `candidate_local_run_workflow_status` (not_started/checking/ready_for_local_use/degraded/blocked/unknown) · `candidate_required_local_service` (checklist read-only) · `candidate_local_run_missing_requirement` · `candidate_local_run_next_action` (guidance string/structured hint فقط) · `candidate_local_run_evidence_status` (present/partial/missing/stale/unknown). **`ready_for_local_use` لا تعني REAL-LIVE ready · local app running ≠ trading readiness · missing/stale/unknown لا تظهر clean · `candidate_local_run_next_action` ليس command · لا execution authority · لا write.**

### 20.2 Local Ops Health Screen (W5-02)
unified read-only/diagnostic health read-model: `candidate_local_ops_health` · `candidate_local_ops_service_type` (الـ15) · `candidate_local_ops_service_status` (healthy/degraded/unavailable/unknown/not_configured/blocked) · `candidate_local_ops_health_reason` · `candidate_local_ops_health_next_action`. يعيد استخدام `signer_profile_status`/`operating_state`/`candidate_provider_onboarding_status`/`candidate_data_quality_metric`/`candidate_storage_usage_metric`. **`healthy` لا تعني execution-safe · SignerService `healthy` لا يعني permission to sign · provider_connectivity `healthy` لا يعني trading readiness · unavailable/degraded ليس stack trace فقط · لا restart/test/connect command · لا execution authority · لا write.**

### 20.3 Operator Logs (W5-03)
operator log read-model (list/detail): `candidate_operator_log_event` · `candidate_operator_log_severity` (info/warning/error/critical) · `candidate_operator_log_category` (الـ13) · `candidate_operator_log_service` · `candidate_operator_log_correlation_ref` · `candidate_operator_log_user_summary` · `candidate_operator_log_technical_detail` · `candidate_operator_log_safe_next_action` (guidance فقط) · `candidate_operator_log_redaction_status` (redacted/not_required/redaction_failed/blocked_contains_secret/unknown). **stack trace يظهر كـ `candidate_operator_log_technical_detail` لا الرسالة الوحيدة · secrets/raw keys/tokens ممنوعة · `blocked_contains_secret` يحجب العرض/التصدير · no raw secrets في API payloads · logs لا تمنح execution authority · لا write.**

### 20.4 Migrations & Version Status (W5-04)
version/migration read-models: `candidate_api_version_status` · `candidate_db_schema_version` · `candidate_config_schema_version` · `candidate_contracts_version_status` · `candidate_migration_status` (up_to_date/pending/running/failed/blocked/unknown) · `candidate_pending_migration` · `candidate_failed_migration` (read-only details) · `candidate_rollback_availability` (available/unavailable/blocked/not_supported/unknown) · `candidate_version_compatibility_status` (compatible/incompatible/warning/unknown/not_verified). يعيد استخدام `candidate_app_version`/`config_version`/`config_version_at_entry`/`migration_phase`/`MIGRATION_IN_PROGRESS`. **failed/pending/blocked/unknown لا تظهر clean · `compatible` شرط مسبق فقط لا execution authority · current version display ليس trading readiness · mismatch واضح · لا migration command · لا rollback command · لا destructive migration · لا write.**

### 20.5 Upgrade / Rollback Procedure (W5-05)
upgrade readiness/preflight read-models: `candidate_upgrade_preflight_status` (pass/warning/blocked/failed/unavailable/unknown) · `candidate_upgrade_backup_requirement` (satisfied/required_missing/not_required/blocked/unknown) · `candidate_upgrade_migration_compatibility` (compatible/incompatible/warning/unknown/not_verified) · `candidate_rollback_path_status` (available/unavailable/blocked/invalid/unknown) · `candidate_upgrade_blocked_reason` · `candidate_post_upgrade_health_verification` (pass/warning/failed/blocked/unavailable/unknown) · `candidate_upgrade_incident_status` (none/open/blocked/mitigated/resolved/unknown). **`pass` لا يعني trading readiness · backup/export بلا raw secrets · rollback status ليس command · failed upgrade → incident/blocker · لا upgrade/rollback/backup/restore command · لا implementation · لا write.**

### 20.6 Safe Maintenance Actions Policy (W5-06)
maintenance policy/status read-model: `candidate_maintenance_action_type` (restart_service/safe_shutdown/backup/restore/export_diagnostics/clear_cache/reindex_rebuild_projections/migration_check/config_rollback_preview) · `candidate_maintenance_action_status` (unavailable/preview_required/permitted/blocked/running/completed/failed/unknown) · `candidate_maintenance_permission_status` (permitted/denied/requires_permission/unavailable/unknown) · `candidate_maintenance_audit_status` (audit_ready/audit_missing/audit_failed/not_required/unknown) · `candidate_maintenance_preview_status` (preview_available/preview_required/preview_missing/not_required/unknown) · `candidate_maintenance_block_reason` · `candidate_maintenance_reversibility_status` (reversible/partially_reversible/irreversible/unknown) · `candidate_safe_shutdown_status` (safe_to_shutdown/blocked_pending_intents/blocked_active_signing/blocked_critical_jobs/unknown). **no command endpoints · action types policy labels لا executable commands · safe_shutdown لا يترك pending intents · restart لا أثناء active signing/critical jobs · backup بلا raw secrets · restore لا يكسر audit/history/config · clear_cache لا يحذف source-of-truth · rebuild projections لا يغيّر سلطة PostgreSQL · لا execution authority · لا write.**

### 20.7 Implementation Status Matrix (W5-07)
implementation status read-model: `candidate_implementation_status` (implemented/partially_implemented/documented_only/candidate/not_built/blocked/deprecated) · `candidate_implementation_status_evidence` · `candidate_implementation_status_source` · `candidate_capability_status_label` · `candidate_status_verified_at` · `candidate_status_verification_state` (verified/not_verified/stale/unknown). **`documented_only` ≠ implemented · `candidate` ≠ built · unknown/not_verified لا يظهر implemented · status لا يمنح execution authority · capability لا تظهر ready دون evidence · يقرأ/يعرض `IMPLEMENTATION_STATUS_MATRIX.md`/status artifact ولا يغيّره · لا write.**

### 20.8 Errors / Permissions / Cross-W5 (تأكيد)
يُعاد استخدام الرموز القائمة فقط: كتابة أي W5 field/read-model من §20 → `READ_ONLY_FIELD_REJECTED` · خرق صلاحية → `PERMISSION_DENIED` (لا error code جديد). **كل أسطح §20 read-only/status/diagnostic/advisory · لا command/service-control endpoint · لا backup/restore/restart/shutdown/purge/rollback/migration command · لا provider connection command · لا raw key/secret/credential في payloads · لا runtime/scripts/launcher · لا live/testnet/mainnet · لا execution authority · لا auto-execution/auto-config · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · health green ليس trading readiness · missing/unknown/not_verified/unavailable لا clean/ready/implemented · documented_only/candidate لا implemented · لا Wave 6+.** أي اسم/threshold غير مسجّل في SSOT Group 41 يُترَك (requires_ssot_followup).
