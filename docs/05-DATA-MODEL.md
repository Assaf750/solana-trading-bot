# Data Model

> **Priority:** 05 — Implementation · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** الجداول والأعمدة والمفاتيح والفهارس والتخزين

**الحالة:** معتمدة / موسّعة بعد v1.8 Delta + F-Elimination + Waves 1–5 — الأقسام 0–14 مكتملة ومراجعة، بلا migrations فعلية. §8 يستهلك Groups 22–27، و§9 يضيف F-Elimination data additions فوق Groups 22–36، و§10 يستهلك SSOT Group 37 / Wave 1، و§11 يستهلك SSOT Group 38 / Wave 2، و§12 يستهلك SSOT Group 39 / Wave 3، و§13 يستهلك SSOT Group 40 / Wave 4، و§14 يستهلك SSOT Group 41 / Wave 5 — PostgreSQL core + runtime + ClickHouse + Redis/RAM. كل إضافات Waves 1–5 تبقى candidate derived/read-only projections/read-models/artifacts، ولا تمنح execution authority ولا تغيّر سلطة source-of-truth ولا EV gate/Hard Risk/Risk Gates/SignerService.

**مبني على:** `00-ARCHITECTURE.md` · `01-SSOT.md` · `02-CONFIG…` · `04-UX…` · `07-TEST-PLAN.md`. يخزّن مفرداتها ولا يعيد تعريفها. **`token_opportunities` يُكشَف فقط عبر Opportunity API الـ read-only/read-oriented المعرّف في `03-API-CONTRACT.md` §13؛ الروابط والمراجع التقنية storage-only تبقى مخفيّة عن payloads الـ API. مورد الفرصة بلا execution authority، بلا buy command، وبلا سطح P&L.**

---

## 0. Data Model Preflight — Storage-Field vs SSOT-Field (محسوم)

| النوع | المالك | أمثلة |
|---|---|---|
| عمود يُقرأ عبر API أو يمثّل state/derived/output معروفاً | **SSOT** (مؤصَّل) | `position_state` · `config_version` · `real_live_config_valid` · `audit_actor` · `created_at`/`updated_at` (Group 12) |
| عمود تخزين داخلي بحت | **Data Model وحده** (لا SSOT) | internal primary key (`id`) · technical foreign key · `partition_date` · index helper · `ingested_at` · internal ingestion cursor |

**قاعدة:** أي اسم جدول/عمود **سيظهر للواجهة أو API** يمرّ عبر SSOT أولاً. الأسماء الداخلية البحتة (لا تُعرض كعقد API) تبقى storage-only. التمييز: *هل يظهر في API response أو state معروف؟* → SSOT · *مفتاح/فهرس/طابع داخلي؟* → storage-only.

> **ملاحظة دقيقة:** `created_at`/`updated_at` مؤصَّلان في SSOT Group 12 (يظهران في API) — ليسا storage-only. أمّا `ingested_at`/`partition_date`/`id` الداخلية فـ storage-only.

---

## 1. Scope & Ownership (النطاق والملكية)

**Data Model يملك (حصراً):**
- `الجداول` · `الأعمدة` · `المفاتيح` (primary/foreign) · `العلاقات` · `الفهارس`.
- `retention / partitioning` — سياسات الاحتفاظ والتقسيم.
- `تخزين config/runtime/audit/cache` — أين وكيف يُخزَّن كل صنف.
- `حدود PostgreSQL / ClickHouse / Redis` — توزيع المحرّكات.

**Data Model لا يملك:**
- `المعنى المعماري` (ARCHITECTURE) · `أسماء API الجديدة` (SSOT) · `defaults/validation/mutability` (Config) · `UX presentation` (UX) · `قرارات التنفيذ واللغات النهائية`.

**القاعدة الحاكمة:**
> كل عمود API-facing = `source_of_truth_field` من SSOT. الأعمدة الداخلية البحتة storage-only. حقل API جديد → ARCHITECTURE→SSOT أولاً.

---

## 2. Storage Classification (تصنيف التخزين)

التمييز الثلاثي الذي رسّخناه (Config / runtime state / derived) + Audit يصبح **بنية تخزين فعلية**:

**أ. Config (قابل للتعديل، مُصدَّر versioning):** كائنات الإعداد الثمانية (Groups 2،6،7،8،9). يُخزَّن في جداول قابلة للتعديل مع `config_version`. التعديل يتبع mutability (§Config 8/11): استراتيجية مجمّدة على `config_version_at_entry`، أمان فوري.

**ب. Runtime state (يُكتب أثناء التشغيل، لا يحرّره المستخدم):** `operating_state` · `position_state` · `migration_phase` · `current_control_brain` · `entry_brain` · `market_phase` · `active_exit_route` · `cumulative_ignored_sell` · `disable_new_adds` · `config_version_at_entry` · `intent` fields (`intent_id`/`intent_type`/`issuing_brain`/`bundle_status`/`failure_type`). يُخزَّن في جداول الحالة الحيّة.

**ج. Derived outputs (محسوبة لا مخزّنة كحقيقة دائمة):** `real_live_config_valid` · `validation_status` · `config_migration_required`. **لا تُخزَّن كحقيقة دائمة** إلا بـ cache policy صريحة وإبطال واضح (تُحسَب من Config + runtime عند الطلب أو تُحدَّث في cache عند تغيّر مصادرها).

**د. Audit (append-only، غير قابل للتعديل/الحذف):** `audit_actor` · `audit_scope` · `audit_reason` · `command_type` · `resource_type` · `permission_role` · `request_id` · `event_timestamp` · `event_sequence` · النتيجة. تخزين أحادي الاتجاه (§API 11).

**هـ. Events / time-series (تدفّق عالي الحجم):** أحداث الـ stream · fills · replay data · metrics · backtest/forward observations. تخزين تحليلي زمني.

## 3. Storage Engine Allocation (توزيع محرّكات التخزين)

مطابقة لـ Tech Stack في `CLAUDE.md`/ARCHITECTURE:

**PostgreSQL (المصدر المعتمد للحالة المعاملاتية):** config · wallets · positions · intents · audit index · permissions · versioning. (ACID، علاقات، قراءات معاملاتية.)

**ClickHouse (التحليلات الزمنية عالية الحجم):** events · fills · replay data · metrics · time-series analytics · backtest/forward-test observations. (إدخال ضخم، استعلامات تجميعية، تقسيم زمني.)

**Redis / RAM (الـ hot path منخفض الكمون):** hot-path wallet sets · dedup keys (منع تكرار التنفيذ) · stream cursors (`last_seen_slot`/`last_confirmed_slot`) · short-lived runtime cache. (وصول دون كمون شبكة، متّسق مع «لا API call في الـ hot path».)

**Derived outputs:** `real_live_config_valid` · `validation_status` — لا تُخزَّن كحقيقة دائمة؛ تُحسَب أو تُكاش بإبطال صريح عند تغيّر Config/runtime المصدر.

> **مبدأ التوزيع:** الحالة المعاملاتية والعلاقات → PostgreSQL · الحجم الزمني الكبير → ClickHouse · الكمون المنخفض والـ dedup → Redis/RAM. لا يُخزَّن المشتقّ كحقيقة، ولا يُكتب الـ hot path في تخزين بطيء.

**قواعد مصدر الحقيقة (Source-of-Truth — مُلزِمة):**
1. **Redis/RAM طبقة إسقاط/cache لا مصدر حقيقة دائم.** hot-path wallet sets · dedup keys · stream cursors · runtime cache **يجب أن تكون قابلة لإعادة البناء** من PostgreSQL/ClickHouse streams أو أحداث runtime المعتمدة بعد إعادة التشغيل. لا تتحوّل RAM/Redis إلى حقيقة غير قابلة للاستعادة.
2. **Audit مصدره append-only أحادي.** PostgreSQL يملك audit ledger/index المعاملاتي الذي يستخدمه API؛ ClickHouse قد يخزّن إسقاطات تحليلية للـ audit/events لكن **لا يصبح المصدر المعتمد للـ Audit** (لا حقيقتان أمنيّتان — منع split-brain).
3. **الـ derived cache ليس حقيقة.** أي مخرج مشتقّ مُكاش **يخزّن علامات تبعيته/نسخته** (مثل `config_version` وطوابع/تسلسلات مصادر runtime) كي يُرفَض الـ cache البائت بدل عرضه كحقيقة. (قاعدة لا أسماء حقول جديدة الآن.)
4. **سلطة الأوامر في PostgreSQL لا ClickHouse.** كل حالة تشغيلية تؤثّر على الأوامر/المراكز/النوايا/الصلاحيات/بوابات الأمان **لها تمثيل معتمد في PostgreSQL**. ClickHouse يخزّن إسقاطات تحليلية/أحداث عالية الحجم وبيانات replay، **لا سلطة أوامر** — لا يعتمد تنفيذ position/intent على ClickHouse.

> **حدّ التأصيل:** الجداول أدناه (الأقسام القادمة) ستستخدم أسماء أعمدة API-facing من SSOT حصراً؛ الأعمدة الداخلية (`id`/`partition_date`/`ingested_at`/technical FKs) storage-only موسومة صراحةً.

---

## 4. PostgreSQL Core Tables (الجداول المعاملاتية الأساسية)

المصدر المعتمد لسلطة الأوامر. أعمدة API-facing بأسماء SSOT؛ الأعمدة الداخلية موسومة *(storage-only)*.

### 4.1 `config_versions`
سجلّ إصدارات الإعداد (Config، §Config 9). append على كل تعديل.
- `config_version` (SSOT · revision id) — مفتاح الإصدار.
- محتوى الإعداد: كائنات Groups 2،6،7،8،9 (مخزّنة كأعمدة أو JSONB منظّم بأسماء SSOT).
- `validation_status` (SSOT · لقطة وقت الحفظ) · `created_at` (SSOT) · `audit_actor` (SSOT · مَن أنشأ النسخة).
- *(storage-only):* `id` (PK داخلي) · `superseded_at` (طابع داخلي).
- **قاعدة:** الإصدارات immutable؛ التعديل = نسخة جديدة لا تحديث مكان. **`validation_status` المخزّن هنا save-time snapshot فقط؛ الجاهزية الحيّة و`real_live_config_valid` تُعاد حسابها من config الحالي + runtime، لا تعتمد على هذه اللقطة كحقيقة حيّة** (§قاعدة 3 — derived لا يُخزَّن كحقيقة).

### 4.2 `wallet_registry`
المحافظ المتبوعة (source) وper-wallet config. **محافظ نراقبها وننسخها، لا تملك أموالنا ولا توقّع.**
- `tracked_wallet_address` (SSOT Group 15 · عنوان المحفظة المتبوعة/source wallet).
- per-wallet config (Group 8: `copy_mode`/`sizing_*`/policies/thresholds…) · `follow_enabled` (SSOT) · `take_profit_pct` (SSOT).
- `config_version` (SSOT · النسخة المرتبطة) · `created_at`/`updated_at` (SSOT).
- *(storage-only):* `id` (PK · wallet identifier داخلي) · technical indexes.
- **قاعدة:** `wallet_registry` يخزّن المحافظ المتبوعة/source wallets **فقط، ولا يخزّن محافظ التنفيذ**. `tracked_wallet_address` عنوان متابعة لا محفظة تملك/توقّع. `follow_enabled` غير مضبوط → watch-only (§Config). تعطيله لا يحذف المراكز.
- **per-wallet config (v1.8 · Groups 19/21):** `fast_hunt_window_ms` · `require_pullback` · `chase_guard` · `min_token_readiness` · `max_entry_volatility` · `single_wallet_min_confidence` · `max_liquidity_share_pct` · `stop_loss_pct` · `max_time_in_position` تُحفَظ كـ **persisted fields / versioned config attributes داخل `wallet_registry`/`config_versions`، سواء طُبِّقت كأعمدة أو كـ structured config payloads** (لا قفل تصميم). **قاعدة:** per-wallet config (لا كائن إعداد تاسع) · unset = disabled/no-effect · `max_liquidity_share_pct` **ليس Hard Risk (Group 6)** — entry/sizing · `stop_loss_pct`/`max_time_in_position` Exit Policy · **لا toggle `stop_loss` ولا `time_exit`** (الحضور=تفعيل) · تشديد Exit Policy قد يُطبَّق فوراً مع audit، والتخفيف يسري على الدخول الجديد/migration (لا يكسر `config_version_at_entry`).

### 4.3 `positions`
المراكز المفتوحة/المغلقة (runtime state معتمد).
- `position_state` · `entry_brain` · `current_control_brain` · `market_phase` · `migration_phase` · `active_exit_route` (SSOT، runtime).
- `config_version_at_entry` (SSOT · مجمّد على الدخول) · `cumulative_ignored_sell` (SSOT · متراكم runtime).
- **ملكية التنفيذ (SSOT Group 15):** `position_owner_wallet_id` (المالك الحالي، هو وحده يبيع) · `entry_execution_wallet_id` (التي دخلت) · `current_execution_wallet_id`.
- `created_at`/`updated_at` (SSOT).
- *(storage-only):* `id` (PK) · FK لـ `wallet_registry` (technical، المحفظة المتبوعة المصدر) · FK لـ `execution_wallets` · FK لـ token/mint reference.
- **قاعدة:** runtime state read-only عبر API (§API 7)؛ الكتابة من المحرّك لا المستخدم. إعدادات الاستراتيجية مجمّدة على `config_version_at_entry`، الأمان فوري. **`position_owner_wallet_id` لا يتغيّر إلا بعد `asset_transfer_status = CONFIRMED`** (§4.3 ARCHITECTURE). `updated_at` يعكس آخر انتقال حالة runtime مُثبَّت، لا وقت تعديل مستخدم.

### 4.4 `intents`
سجلّ النوايا (IntentLedger §15.1، محور idempotency).
- `intent_id` (SSOT) · `intent_type` · `issuing_brain` · `bundle_status` · `failure_type` (SSOT).
- **منفّذ النيّة (SSOT Group 15):** `execution_wallet_id` · `signer_profile_id` (أي محفظة/signer نفّذ).
- `idempotency_key` (SSOT Group 12) · `created_at`/`updated_at` (SSOT).
- *(storage-only):* `id` (PK) · FK لـ `positions` (technical) · FK لـ `execution_wallets`/`signer_profiles` · internal retry/replacement linkage.
- **قاعدة:** لا OrderBuilder بلا `intent_id`؛ `idempotency_key` فريد يمنع تكرار التنفيذ (§API 11). **لا تنفيذ بلا `execution_wallet_id` صالح و`signer_profile_id` صالح** (§API 12.6). append + تحديث حالة محكوم. **Terminal intents تُحتفظ لأغراض audit/idempotency، ولا تُحذف hard-delete طالما توجد positions أو audit entries مرتبطة بها** (حذفها يكسر idempotency history وAudit linkage).

### 4.5 `audit_log`
سجلّ التدقيق append-only (مصدر الحقيقة الأمني، §API 11 / §قاعدة 2 أعلاه).
- `audit_actor` · `audit_scope` · `audit_reason` (SSOT Group 14).
- `command_type` · `resource_type` · `permission_role` (SSOT Group 11) · `request_id` · `idempotency_key` (SSOT Group 12، للأوامر التنفيذية).
- `event_sequence` · `event_timestamp` (SSOT Group 12) · النتيجة (`api_error_code` عند الفشل، SSOT).
- *(storage-only):* `id` (PK تسلسلي) · `partition_date` (تقسيم داخلي).
- **قاعدة:** append-only صارم — لا UPDATE/DELETE عبر API أو التطبيق. أخطاء الأمان تُسجَّل دائماً. **`event_timestamp` هو الزمن الرسمي لحدث Audit؛ لا نضيف `created_at` منفصلاً إلى `audit_log` حالياً** — إن لزم وقت إدخال تخزيني لاحقاً يكون storage-only لا API-facing.

### 4.6 `permissions` / operator identities
ربط الهويات بالأدوار.
- `permission_role` (SSOT Group 11) · `audit_actor` reference (هوية المنفّذ).
- `created_at`/`updated_at` (SSOT).
- *(storage-only):* `id` (PK) · credential/session storage داخلي (تفاصيله في 09-THREAT-SECURITY لا هنا).
- **قاعدة:** `signer_control` صلاحية منفصلة لا تُمنح تلقائياً مع admin (§API 3). تفاصيل المفاتيح/التوقيع في Security لا Data Model.

> **ملاحظة سلطة:** كل جدول أعلاه هو المصدر المعتمد لما يخصّه. derived outputs (`real_live_config_valid`/`validation_status` الحيّ) **لا جدول حقيقة لها** — تُحسَب من `config_versions` + `positions` + runtime، أو تُكاش بعلامات تبعية (§قاعدة 3).

### 4.7 `execution_wallets`
محافظنا التي تملك وتوقّع (طبقة §4.3، **منفصلة عن `wallet_registry` المتبوعة**).
- `execution_wallet_id` · `execution_wallet_address` · `execution_wallet_status` · `key_custody_mode` · `signer_profile_id` (SSOT Group 15).
- `funding_wallet_id` · `settlement_wallet_id` (SSOT Group 15؛ قد يشيران لنفس vault أو منفصلين).
- `created_at`/`updated_at` (SSOT).
- *(storage-only):* `id` (PK) · FK لـ `signer_profiles` (technical).
- **قاعدة:** المحفظة تبدأ `WARMING_UP`، لا `ACTIVE` إلا بعد admission gate (§API 12.1). **لا private key/seed في الجدول إطلاقاً** (العزل في 09-THREAT-SECURITY). vault خارج hot path. **لا تُخزَّن wallet-level risk limits هنا كأعمدة رسمية الآن؛ أي حدود خاصة بمحفظة تنفيذ تؤثّر على القرارات أو تظهر في API/UX تمرّ عبر ARCHITECTURE → SSOT → Config/API أولاً** (`wallet_limits` حُصر كـ visual grouping، لا يُعاد إدخاله من باب Data Model).
- **علاقة funding/settlement:** `funding_wallet_id` و`settlement_wallet_id` يشيران إلى wallet identities معتمدة **خارج hot path**. قد تكونا execution wallets موسومة بدور funding/settlement، أو vault wallet records تُفصَّل لاحقاً في Security/Operations. **لا يُفترَض أن كل funding/settlement wallet مؤهّلة للتداول**، ولا تُستخدم للدخول/الخروج إلا إذا أصبحت execution wallet صراحةً عبر admission gate (تخزينها بجانب execution wallet لا يمنحها أهلية تداول).

### 4.8 `signer_profiles`
ملفات التوقيع المرتبطة بمحافظ التنفيذ.
- `signer_profile_id` · `key_custody_mode` · `signer_profile_status` (SSOT Group 15).
- `created_at`/`updated_at` (SSOT).
- *(storage-only):* `id` (PK).
- **قاعدة:** **لا private key ولا seed phrase في الجدول** — مرجع آمن فقط؛ تفاصيل الحضانة/KMS في 09-THREAT-SECURITY. تعطيل/إبطال signer يجعل المحافظ المرتبطة غير مؤهّلة للدخول (§API 12.2).

### 4.9 `asset_transfer_intents`
نوايا نقل ملكية أصل بين محافظ التنفيذ (وضع buy/sell wallet الخاص).
- `asset_transfer_intent_id` · `asset_transfer_status` · `source_execution_wallet_id` · `destination_execution_wallet_id` (SSOT Group 15).
- `idempotency_key` (SSOT Group 12) · `created_at`/`updated_at` (SSOT).
- *(storage-only):* `id` (PK) · FK لـ `positions` (الأصل المنقول) · FK لمحفظتي المصدر/الهدف (technical).
- **قاعدة:** الملكية (`position_owner_wallet_id`) لا تتغيّر إلا عند `asset_transfer_status = CONFIRMED`. الحالات terminal (CONFIRMED/FAILED/CANCELLED) لا تُلغى.

### 4.10 `wallet_rotation_events`
أحداث تدوير محافظ التنفيذ.
- `wallet_rotation_status` · `rotation_trigger` · `rotation_from_execution_wallet_id` · `rotation_to_execution_wallet_id` (SSOT Group 15).
- `created_at`/`updated_at` (SSOT).
- *(storage-only):* `id` (PK) · FK لمحفظتي from/to (technical).
- **قاعدة:** كل خطوة تدوير تدخل Audit (§4.3 ARCHITECTURE). التدفّق: from→DRAINING→كنس→RETIRED · to→WARMING_UP→ACTIVE بعد الفحوص.

### 4.11 `profit_sweep_events`
أحداث كنس الأرباح إلى محفظة التسوية.
- `profit_sweep_policy` · `profit_sweep_interval_ms` · `settlement_wallet_id`/`settlement_wallet_address` (SSOT Group 15).
- `created_at` (SSOT).
- *(storage-only):* `id` (PK) · FK لـ `execution_wallets` المصدر (technical) · مبلغ/توقيع الكنس الداخلي.
- **قاعدة:** الكنس لا يغيّر إعداد التسوية/التمويل (§API 12.5). **لا `last_sweep_at`/`last_sweep_status` كأعمدة API** — «آخر كنس» تجميع من هذه الأحداث؛ حقل API ثابت يمرّ عبر SSOT أولاً. **مصدر الكنس يبقى FK تخزيني داخلي حالياً ولا يظهر كـ response field؛ إن احتاج API/UX عرضه باسم ثابت (مثل `profit_sweep_source_execution_wallet_id`) يُسجَّل في SSOT أولاً.** vault لا يتداول.

> **ملاحظة فصل:** `execution_wallets` ≠ `wallet_registry` (الأولى محافظنا، الثانية المتبوعة) — جدولان منفصلان لا FK مباشر بينهما إلا عبر `positions` (التي تربط المحفظة المتبوعة المصدر بمحفظة التنفيذ المالكة).

### 4.12 `token_opportunities`
سجلّ قرار الفرصة ما قبل المركز (New-Coin Hunting، PostgreSQL core).
- `hunt_status` (SSOT Group 16 · lifecycle ما قبل المركز) · `new_token_priority_score` · `recycled_token_flag` · `name_impersonation_score` · `creator_launch_rate_flag` · `token_readiness_score` (SSOT Group 16 · derived diagnostic).
- `accepted_reason` · `rejected_reason` (SSOT Group 17 · derived decision outputs).
- **diagnostics (SSOT Group 20 · observed/derived):** `discovery_latency_ms` · `signal_to_execution_ms` · `latency_to_copy` · `entry_slippage_vs_leader`.
- `copyability_by_brain` snapshot (SSOT Group 18 · derived؛ المصدر §5.6).
- *(storage-only):* `id` (PK) · token/mint reference (technical، ليس API field) · FK لـ `wallet_registry` (attribution مصدر الفرصة الداخلي) · `source_events` (مراجع تخزينية لمدخلات event/projection) · **zero-or-one** FK لـ `intents` · **zero-or-one** FK لـ `positions` · `created_at`/`updated_at`.
- **قاعدة (token/mint reference):** خاص بـ `token_opportunities` كمفتاح داخلي/technical reference (storage-only)، **ولا يضيف token mint/symbol إلى payload الفرصة.** هوية التوكن على المركز تُعالَج عبر projection المركز المخصّص في §9.7، لا داخل Opportunity payload.
- **قاعدة (pre-position):** **لا يملك أموالاً، لا يوقّع، لا execution authority.** `hunt_status=entered` يُسلِّم لـ `position_state=OPENING` (§4.3) وما بعده يملكه المركز.
- **قاعدة (`entry_slippage_vs_leader`):** optional observed diagnostic يُلحَق بعد fill/reconciliation عند قابليته للقياس. **ليس P&L ولا execution authority؛ الحجب/الرفض يبقى عبر عتبة Config `max_entry_slippage_vs_leader`.** لا alias `leader_user_price_delta`. **لا P&L/price columns هنا.**
- **قاعدة (الأسباب):** `accepted_reason` يُستخدم **فقط** عند `hunt_status ∈ {accepted, entered}` · `rejected_reason` عند `hunt_status ∈ {rejected, expired, watch_only}` إن لم تدخل الفرصة. الأسباب **outputs للقرار لا سلطة تنفيذ/حجب بذاتها**؛ read-only عبر API (كتابة → `READ_ONLY_FIELD_REJECTED`).
- **قاعدة (provenance):** `source_events` و FK لـ `wallet_registry` **storage-only**؛ attribution مصدر الفرصة فقط. هوية التوكن على المركز وleader attribution على المركز تُعالَجان عبر projections المركز المخصّصة في §9.7/§9.8، **لا داخل Opportunity payload**. تبقى Opportunity ما قبل المركز، read-only، بلا P&L، بلا execution authority، وبلا ربط ضمني Opportunity→تنفيذ.
- **قاعدة (API):** **كشف الـ API محصور بعقد Opportunity API الـ read-only (§13).** المراجع التقنية الداخلية وsource_events وtoken/mint references وFK لـ intents/positions والحقول storage-only تبقى مخفيّة ما لم تُرقَّ صراحةً عبر ARCH→SSOT→API/Data.

---

## 5. Runtime State Tables (جداول الحالة التشغيلية)

> **§5 فئتان (لا الكل projections):**
> 1. **Authoritative runtime state في PostgreSQL** حين تحكم الحالة الأوامر مباشرةً — مثل `operating_runtime_state`.
> 2. **Projections/caches قابلة لإعادة البناء** للمراقبة والـ hot path والواجهة — مثل `position_runtime_index` · `execution_wallet_runtime_eligibility` · `derived_readiness_cache`.
>
> هذا يحفظ «سلطة الأوامر في PostgreSQL» (§قاعدة 4) ولا يناقضه. لا private key/seed. derived لا يُعرض إن صار stale.

### 5.1 `operating_runtime_state`
الحالة التشغيلية الحيّة للنظام.
- `operating_state` (SSOT · WARMING_UP/ACTIVE/EXITS_ONLY/PAUSED/KILLED) · `disable_new_adds` (SSOT) · `updated_at` (SSOT).
- *(storage-only):* `id` (PK مفرد/singleton) · آخر سبب تحوّل داخلي.
- **قاعدة:** المصدر المعتمد لـ `operating_state` هو هذا الجدول في PostgreSQL (سلطة الأوامر §قاعدة 4)؛ Redis قد يكاشه كـ projection. التحوّلات الحرجة (KILLED) تدخل Audit.

### 5.2 `provider_stream_state`
صحّة المزوّدين والـ streams.
- `provider_degraded` · `slot_lag` · `last_seen_slot` · `last_confirmed_slot` · `protocol_constant_status` (SSOT Group 5) · `updated_at`.
- *(storage-only):* `id` (PK) · مفاتيح مزوّد داخلية.
- **قاعدة:** قابل لإعادة البناء من أحداث المزوّد/الـ stream. **مصدر معتمد لمراقبة صحّة المزوّد/الـ stream، لكنه لا يتجاوز `operating_runtime_state` أو Hard Risk أو صلاحيات الأوامر**؛ تأثيره على الأوامر يمرّ عبر policy/operating state لا كاختصار مباشر (لا يوقف/يفتح أوامر بنفسه خارج سياسة التشغيل). يغذّي مشغّلات EXITS_ONLY (§ARCHITECTURE §15).

### 5.3 `position_runtime_index`
فهرس تشغيلي سريع للمراكز المفتوحة (للمراقبة/الاستعلام الحيّ).
- يعكس `position_state` · `current_execution_wallet_id` · `position_owner_wallet_id` (قراءة من `positions`).
- *(storage-only):* `id`/FK لـ `positions` · مفاتيح فهرسة.
- **قاعدة:** **projection من `positions` (السلطة)**، لا نسخة حقيقة. يُعاد بناؤه من `positions`. لا كتابة مباشرة تتجاوز `positions`.

### 5.4 `execution_wallet_runtime_eligibility`
أهلية محافظ التنفيذ للحظة (للـ hot path والواجهة).
- يعكس أهلية مشتقّة من: `execution_wallet_status` + `signer_profile_status` + اكتمال config + runtime checks.
- *(storage-only):* `id`/FK لـ `execution_wallets`/`signer_profiles` · علامات تبعية.
- **قاعدة:** **projection لا حقيقة.** الحقيقة تبقى في `execution_wallets` + `signer_profiles` + `config_versions` + runtime health checks. محفظة `WARMING_UP` أو signer غير `ACTIVE` → غير مؤهّلة. يُعاد بناؤه بالكامل من المصادر المعتمدة. **يسرّع العرض والـ hot path، لكنه لا يكفي وحده للتوقيع أو الإرسال: OrderBuilder يعيد التحقّق من `execution_wallet_status` و`signer_profile_status` وبوابات الأمان عند البناء/الإرسال** (قيمة eligibility مكاشة وحدها لا ترسل صفقة بعد تعطيل/إبطال signer).

### 5.5 `derived_readiness_cache`
cache اختياري لمخرجات الجاهزية المشتقّة (أداء فقط).
- يكاش `real_live_config_valid` · `validation_status` (derived، SSOT Group 10).
- *(storage-only):* `id` · **dependency/version markers** (`config_version` + طوابع/تسلسلات مصادر runtime).
- **قاعدة (§قاعدة 3):** **ليس حقيقة دائمة.** يخزّن علامات التبعية كي يُرفَض الـ cache البائت بدل عرضه. إن صار stale (تغيّر `config_version` أو مصدر runtime) → لا يُعرض؛ يُعاد الحساب من `config_versions` + `positions` + runtime. غياب الـ cache لا يمنع الحساب.

### 5.6 `wallet_intelligence_projection`
ذكاء المحافظ المشتقّ (read-only، New-Coin Hunting).
- `copyability_by_brain` · `crowd_follow_score` · `profit_concentration` · `tracked_wallet_status` (SSOT Group 18 · derived).
- **(Gap C · SSOT Group 18 · derived/read-only):** `candidate_copyability_component_veto` · `candidate_copyability_veto_reason` (`risky_wallet_type`/`fake_profit_risk`/`adverse_selection_high`/`crowd_follow_decay`/`profit_concentration_one_hit`/`non_copyable_profit_source`/`insufficient_evidence`). **يفسّران `tracked_wallet_status` ولا يحلّان محلّه**؛ يُعاد بناؤهما من مكوّنات copyability القائمة (`copyability_by_brain`/`crowd_follow_score`/`profit_concentration`/`candidate_wallet_net_copyability_rank`/`candidate_leader_vs_copier_delta`/`candidate_fake_profit_adjusted_edge`/`candidate_profit_source_copyability_class`/`candidate_wallet_type`/`candidate_adverse_selection_severity`/`candidate_wallet_drift_*`) — **بلا score مُعتم (لا `wallet_trust_score`/`copyability_score`/ranking-score جديد)**. `candidate_copyability_component_veto = true` → لا ترقية إلى `copy_allowed` (حلّ متحفّظ `watch_only`/`degraded`). **لا execution/command authority · لا auto-ban/auto-close/auto-config · لا `copy_event` جديد · لا opportunity execution؛ تخضع لقاعدة §5.6 نفسها (projection لا حقيقة، يُعاد بناؤها عند التعارض مع المصدر، `banned` سياسة متابعة فقط).**
- **(Gap D · SSOT Group 26 · derived/read-only · advisory):** `candidate_edge_health_status` (`healthy`/`weakening`/`insufficient_evidence`/`no_edge_suspected`). **يشرح صحّة ميزة المحفظة per-wallet ولا يحلّ محلّ `tracked_wallet_status`**؛ يُعاد بناؤه من **إشارات قائمة فقط** (`candidate_paper_real_divergence_status` · `candidate_adverse_selection_severity` · `candidate_net_business_pnl`+`_status` · `candidate_leader_vs_copier_delta` · `entry_slippage_vs_leader` · `candidate_failed_attempt_cost` · `candidate_wallet_drift_signal`/`_reason`/`_recommendation` · `candidate_copyability_component_veto`+`_reason` · `tracked_wallet_status` · `minimum_sample_size`/`candidate_paper_settings_evidence_status`). **advisory-only:** `no_edge_suspected` تحذير لا تعطيل تلقائي · `insufficient_evidence` ليست صفر مخاطر ولا دليل ميزة · Paper لا يُمثَّل كميزة Real. التوصية تُعاد من المفردات القائمة (`candidate_wallet_drift_recommendation`/`candidate_recommendation_type`) — **لا مفردات/score جديد ولا `candidate_uncopyable_flag` ولا edge score مُعتم**. **لا execution/command authority · لا auto-ban/auto-close/auto-config/auto-disable · لا forced live blocker · لا `copy_event` جديد · لا opportunity execution؛ تخضع لقاعدة §5.6 (projection لا حقيقة، يُعاد بناؤها عند التعارض مع المصدر).**
- *(storage-only):* FK لـ `wallet_registry` · dependency/source markers · `rebuilt_at`.
- **قاعدة:** **projection لا حقيقة.** may be stored in PostgreSQL for read consistency، لكنه **derived projection**: عند تعارضه مع `wallet_observations` (§6.4) أو `wallet_registry` أو config-version/source/dependency markers → **يُعاد بناؤه**. **لا يخوّل تنفيذاً، ولا يتجاوز `follow_enabled`، ولا يتجاوز `execution_wallet_status`.** derived/read-only (لا كتابة API). **`tracked_wallet_status=banned` = سياسة متابعة فقط، لا حظر أمني لمحفظة تنفيذ ولا إغلاق مراكز تلقائي.**

> **مبدأ §5:** `operating_runtime_state` حالة معتمدة (تحكم الأوامر)؛ بقيّة الجداول projections/caches تشغيلية. السلطة تبقى في PostgreSQL core tables (§4) + `operating_runtime_state` + الأحداث. الـ projections/caches قابلة لإعادة البناء بعد إعادة التشغيل ولا تصبح مصدر حقيقة بديلاً.

---

## 6. ClickHouse Analytical Tables (الجداول التحليلية)

> **إسقاط تحليلي/أحداث/replay فقط — لا يصبح سلطة أوامر أبداً.** الحقيقة التشغيلية تبقى في PostgreSQL (§4). الحقول API-facing تستخدم أسماء SSOT؛ الأعمدة الداخلية (`ingested_at`/`partition_date`/`source_topic`/`batch_id`/order keys) storage-only.

### 6.1 `stream_events`
أرشيف أحداث الـ stream (تحليل/إعادة تشغيل).
- `event_type` · `event_sequence` · `event_timestamp` (SSOT Group 12) · حمولة الحدث بأسماء SSOT.
- *(storage-only):* `ingested_at` · `partition_date` (تقسيم زمني) · `source_topic`.
- **قاعدة:** أرشيف تحليلي؛ لا مصدر حقيقة لحالة حيّة. تسلسل الأحداث الحيّ يبقى في الـ stream/PostgreSQL.

### 6.2 `trade_fills`
تنفيذات الصفقات (fills) للتحليل.
- `intent_id` · `execution_wallet_id` · `signer_profile_id` (SSOT) · `event_timestamp` (SSOT).
- *(storage-only):* `ingested_at` · `partition_date`.
- **حقول fill المرشّحة (candidate — لا تُعتمد كأسماء SSOT قبل الحسم):** `fill_price` · `fill_amount` · `slippage_bps` · `realized_pnl`. تُجمَع لجولة حسم إن ظهرت في API/UX؛ حتى ذلك internal تحليلية لا response fields.
- **قاعدة:** `trade_fills` في ClickHouse إسقاط تحليلي عالي الحجم. **أي fill يؤثّر على position accounting أو intent finalization أو post-exit accounting يجب أن يكون له تمثيل/ارتباط معتمد في PostgreSQL** عبر `intents`/`positions`/audit أو جدول محاسبة تشغيلي يُحسم لاحقاً. **ClickHouse لا يصبح المصدر الوحيد للكمية أو الرسوم أو حالة المركز** (الحساب الحقيقي وP&L لا يعتمدان على جدول تحليلي).

### 6.3 `execution_outcomes`
نتائج محاولات التنفيذ (transaction attempts/outcomes).
- `intent_id` · `bundle_status` · `failure_type` (SSOT) · `event_timestamp` (SSOT).
- *(storage-only):* `ingested_at` · `partition_date` · معرّف محاولة داخلي · توقيع المعاملة.
- **قاعدة:** سجلّ نتائج تحليلي؛ **الحالة المعتمدة للنيّة (`bundle_status`/`failure_type`/terminal state) تبقى في `intents` داخل PostgreSQL. عند التعارض، PostgreSQL يفوز، وClickHouse يُعاد بناؤه أو يُصحَّح** (يحمي idempotency وterminal-state retention من الاعتماد على ClickHouse).

### 6.4 `wallet_observations`
ملاحظات تحليلية على المحافظ المتبوعة (سلوك القادة).
- `tracked_wallet_address` (SSOT) · `copy_event` (SSOT Group 3) · `event_timestamp` (SSOT).
- *(storage-only):* `ingested_at` · `partition_date`.
- **قاعدة:** تحليل سلوك المحافظ المتبوعة؛ لا يحكم أوامر مباشرةً (قرار النسخ عبر العقلين §4.2).

### 6.5 `replay_backtest_observations`
ملاحظات الـ backtest/forward replay.
- `event_timestamp` (SSOT) · مراجع السيناريو/النافذة.
- *(storage-only):* `ingested_at` · `partition_date` · معرّف تشغيل backtest داخلي.
- **قاعدة:** تحليلية بحتة. **لا تُستخدم وحدها لتفعيل REAL-LIVE ولا لتجاوز `real_live_config_valid` أو Hard Risk** (الجاهزية من config الحالي + runtime، لا من backtest).

### 6.6 `metrics_timeseries`
مقاييس زمنية (أداء/تشغيل).
- `event_timestamp` (SSOT) · قيم المقاييس.
- *(storage-only):* `ingested_at` · `partition_date` · مفاتيح المقياس الداخلية.
- **قاعدة:** تحليلية؛ لا سلطة أوامر. **لا يحدّد `real_live_config_valid` ولا `validation_status` مباشرةً**؛ يغذّي observability/التحليل، لكن الجاهزية الحيّة تُحسَب من مصادر PostgreSQL/runtime المعتمدة (لا metric مثل degraded_count/latency_p95 يقرّر الجاهزية من ClickHouse وحده).

> **مبدأ §6:** ClickHouse إسقاط تحليلي/أحداث/replay. **لا حقيقة لـ `position_state`/`intent`/`execution_wallet_status`/`signer_profile_status`/`operating_state`/`asset_transfer_status`/`wallet_rotation_status`** — أي نسخة منها هنا projection للتحليل، والحقيقة في PostgreSQL. **`audit_log` في PostgreSQL يبقى المصدر الرسمي للـ Audit**؛ أي audit هنا projection تحليلي. backtest/replay لا يرفع الثقة التشغيلية وحده.

> **Fill/accounting candidates (أسماء قديمة/غير مسبوقة — لا تُعتمد كأسماء SSOT/API):** الأسماء غير المسبوقة `fill_price` · `fill_amount` · `slippage_bps` · `realized_pnl` · `unrealized_pnl` · `fee_amount` · `net_pnl` · `execution_latency_ms` تبقى **غير معتمدة كأسماء SSOT/API-facing**. **v1.8 يرقّي أسماء read-model المسبوقة** `candidate_realized_pnl` · `candidate_unrealized_pnl` · `candidate_fees_total` · `candidate_slippage_cost` عبر Groups 22–27 (§8). أعمدة fill/accounting الخام تبقى internal تحليلية/storage-only حتى تُرقَّى صراحةً عبر ARCH→SSOT→API/Data. **مبادئ ثابتة:** `realized_pnl` غير المسبوق ليس الاسم النهائي · P&L لا يخصّ مورد opportunity · ClickHouse ليس المصدر الوحيد لـ P&L (الحساب الحقيقي backend/data read-model مرتبط بـ PostgreSQL) · UX ممنوع من حساب P&L محلياً.

> **Latency / Diagnostics (New-Coin Hunting · SSOT Group 20):** `discovery_latency_ms` · `signal_to_execution_ms` · `latency_to_copy` · `entry_slippage_vs_leader` — observed/derived diagnostics؛ تُخزَّن على `token_opportunities` (§4.12) و/أو تُسقَط في ClickHouse `metrics_timeseries`/`execution_outcomes`. `entry_slippage_vs_leader` = القياس المحقّق؛ العتبة `max_entry_slippage_vs_leader` تبقى Config threshold. **لا alias `leader_user_price_delta`. diagnostics لا تخوّل تنفيذاً.**

> **عناصر New-Coin Hunting [F] السابقة — لم تعد pending غامضة (حُسمت في F-Elimination):** الحقول المُرقّاة تُخزَّن عبر أسطح candidate المخصّصة في §9.1–§9.17؛ الأسماء القديمة غير المسبوقة لـ P&L (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`) و`current_price` تبقى **مرفوضة (rejected)**؛ أوامر الخروج الجماعي الذرّية (`exit_all_positions`/`batch_exit_all_positions`) تبقى **مرفوضة (forbidden)**. تبقى Opportunity نفسها بلا P&L/execution authority، والحقول المُرقّاة تظهر **فقط عبر projections/resources المخصّصة لها، لا داخل Opportunity payload** ما لم يسمح SSOT/API صراحةً. («Fill/accounting candidates» أعلاه: الأسماء غير المسبوقة rejected، والمسبوقة candidate read-model عبر §9.)

---

## 7. Redis / RAM Projections (طبقة الـ hot path والـ cache)

> **projections/cache فقط — ليست source of truth.** كل مفتاح قابل لإعادة البناء من PostgreSQL authoritative + ClickHouse/stream events + provider state. لا حالة غير قابلة للاستعادة بعد restart. **لا أسرار** (key/seed/signer material) إطلاقاً.

### 7.1 `hot_wallet_sets`
مجموعات المحافظ المتبوعة الساخنة للمطابقة السريعة في الـ hot path.
- **rebuild source:** `wallet_registry` (PostgreSQL). يُعاد بناؤه بالكامل عند boot.
- **قاعدة:** projection خالص؛ لا حقيقة. **يُعاد بناؤه عند الإقلاع، ويُبطَل/يُعاد عند تغيّر `wallet_registry` أو `follow_enabled` أو `config_version` المرتبط. أي محفظة متبوعة مُعطّلة أو غير مفعّلة تُزال من مطابقة الـ hot path قبل أن تنتج عنها إدخالات جديدة** (hot set بائت بعد تعطيل محفظة قد ينتج دخولاً من محفظة لم تعد مفعّلة).

### 7.2 `dedup_keys`
مفاتيح منع تكرار التنفيذ في الـ hot path.
- مرتبطة بـ `intent_id`/`idempotency_key` (SSOT).
- **قاعدة:** تمنع التكرار في الـ hot path **فقط**. **الحقيقة المعتمدة للنيّة/idempotency تبقى في `intents` (PostgreSQL)؛ عند التعارض PostgreSQL يفوز ويُعاد بناء dedup.** TTL/invalidation حسب نافذة التنفيذ.

### 7.3 `stream_cursors`
مؤشّرات تقدّم الـ stream للتسريع.
- `last_seen_slot` · `last_confirmed_slot` (SSOT Group 5).
- **قاعدة:** للتسريع؛ **تُصالَح مع `provider_stream_state` و/أو events بعد restart. لا تُستخدم وحدها لتقرير finality أو rollback.**

### 7.4 `runtime_cache`
cache عام قصير العمر لقيم runtime متكرّرة.
- **قاعدة:** **TTL إلزامي.** قابل لإعادة البناء من المصادر المعتمدة. لا حقيقة دائمة.

### 7.5 `quote_fee_tip_cache`
cache قصير العمر لعروض الأسعار/الرسوم/الإكراميات (Cost Pipeline).
- **قاعدة:** **TTL إلزامي.** يساعد Cost Pipeline، لكن **أي quote/fee/tip بائت يُرفَض ولا يُستخدم لحساب EV أو بناء أمر** (لا EV truth دائم منه).

### 7.6 `curve_pool_state_cache`
cache لحالة منحنى/pool (Brain A/B) للتسريع.
- *(storage-only):* freshness/source markers (طابع slot/مصدر).
- **قاعدة:** **TTL + freshness markers إلزامية.** عند فجوة stream أو `slot_lag` أو تغيّر `protocol_constant_status` → **يُرفَض الـ cache ويُفعَّل مسار safety/EXITS_ONLY حسب السياسة** (لا بناء أمر على حالة pool بائتة).
- **اشتقاق pool حسب `quote_mint` (ARCH §4.1):** اشتقاق عنوان PumpSwap pool يتفرّع على `quote_mint`: مسار `wsol` (الزوج مقابل WSOL) ومسار `usdc` (الزوج مقابل USDC)؛ `unknown` ⇒ لا اشتقاق وskip (`rejected_reason = unknown_quote_mint`). تطبيع السعر إلى **USD داخلياً** قبل أي حساب EV/slippage/cost؛ **لا خلط حساب SOL/USDC**. مسار USDC محكوم بـ `usdc_quote_enabled` (CONFIG §3).

### 7.7 `execution_wallet_hot_eligibility_cache`
cache أهلية محافظ التنفيذ للـ hot path.
- يعكس أهلية مشتقّة (مثل `execution_wallet_runtime_eligibility` §5.4).
- **قاعدة:** **TTL إلزامي.** يسرّع القرار، لكن **لا يوقّع ولا يرسل وحده: OrderBuilder يعيد التحقّق من `execution_wallet_status` + `signer_profile_status` + بوابات الأمان قبل التوقيع/الإرسال** (cache أهلية بائت لا يرسل بعد تعطيل/إبطال signer).

> **مبدأ §7:** كل شيء هنا projection/cache قابل لإعادة البناء، لا source of truth. PostgreSQL يفوز عند أي تعارض (intents/dedup، state/cursors). **لا private key ولا seed ولا signer material ولا decrypted secrets ولا KMS plaintext في Redis/RAM** — المواد الحسّاسة للتوقيع في SignerService isolated memory فقط (تفاصيلها في 09-THREAT-SECURITY). أي cache يحكم قراراً تنفيذياً (eligibility/quote/pool) يُرفَض بائتاً ويُعاد التحقّق من المصدر.

> **Cache-status candidates (مرشّحة — لا تُعتمد):** `cache_status` · `hot_wallet_count` · `dedup_status` · `quote_cache_age` · `fee_cache_age` · `tip_cache_age` · `pool_cache_status` · `eligibility_cache_status` — internal/visual الآن؛ تمرّ عبر SSOT إن صارت API response fields.

---

## 8. v1.8 Delta — Data Model Additions (candidate, تستهلك SSOT Groups 22–27)

> كل الأسماء `candidate_*` بانتظار التثبيت بعد ARCH→SSOT. مبدأ الملكية قائم: PostgreSQL مصدر الحقيقة للقرارات/الـ audit؛ ClickHouse تحليلي لا مصدر أوامر؛ Redis/RAM projection قابل لإعادة البناء. **P&L كله Read-Model مشتق (لا يُحسب في الواجهة).**

### 8.1 P&L Read-Model (مشتق — ARCH §15.2)
> **`candidate_pnl_lots` و`candidate_mark_records` أسماء حاويات تخزين/projection على مستوى DATA فقط — ليست API-facing fields ولا SSOT vocabulary، ولا تظهر في API/UX payloads. الحقول API-facing داخلها هي المسجّلة في SSOT: `candidate_realized_pnl`/`candidate_unrealized_pnl`/`candidate_mark_*` وحقول السعر/الميتاداتا.**
- **`candidate_pnl_lots`** (مشتق من `positions`/`intents`/`trade_fills`): lot-based، FIFO افتراضاً؛ مصدر `candidate_realized_pnl`. منسوب التكاليف (priority/tip/ATA rent/DEX fees/failed-attempt/slippage).
- **`candidate_mark_records`**: تحمل `source` / `timestamp` / `confidence` / `status` (valid/stale/unavailable/low_confidence/display_only) — مصدر `candidate_unrealized_pnl`. لا mark بلا هذه الحقول. تفضيل executable/route quote في AMM.
- تجميعات مشتقّة (ClickHouse/read-model): per-wallet/per-copy_mode/per-brain · `candidate_remaining_daily_loss_budget`. فضاء **paper** منفصل وموسوم `simulated`.

### 8.2 Execution Trace persistence (ARCH §15.3)
- **`candidate_execution_trace`**: النواة المرتبطة بالـ intent في PostgreSQL (روابط/حالات)، والطوابع الزمنية (12)/الـ latencies/عدّادات attempt/fee في ClickHouse (`execution_outcomes` extension). `candidate_failure_origin` يوسّع تصنيف الفشل القائم.

### 8.3 Recommendations store (advisory — ARCH §15.5)
- **`candidate_recommendations`** (PostgreSQL): `type`/`status`/payload/source-metrics + **recommendation audit**. لا يكتب config؛ التبنّي يمرّ عبر مسار config الرسمي فيُسجَّل كـ config version عادية.

### 8.4 Provider registry (ARCH §15.4 / 09-THREAT-SECURITY)
- **`candidate_provider_registry`** (PostgreSQL): `provider_mode`/`role`/`tier`/`connection_status` + **`provider_key_ref` فقط**. **لا raw key/secret في الجدول ولا في أي projection/backup/export.** المفاتيح في secret store/SignerService-isolated فقط.

### 8.5 Export / Retention (القيم في 08-RUNBOOK)
- **`candidate_export_jobs`** (artifacts: markdown/csv/parquet/jsonl) — research dataset، معزول عن hot path، بلا أسرار.
- retention/purge مرتبطان بـ `candidate_retention_profile`؛ **audit المالي مستثنى من purge** (append-only، terminal retention). raw-events قابلة للحذف مع حفظ summaries حسب الـ profile.
- dashboards: `candidate_storage_usage_metric` / `candidate_data_quality_metric` (derived، لا تؤثّر على hot path).

### 8.6 Charts data (ARCH §15.6)
- **`candidate_ohlcv`**: يحمل `candidate_ohlcv_provenance` (provider/derived_from_swaps/delayed/estimated/executable_route_aware). display-only لا يُقدَّم كحقيقة تنفيذ. في AMM: `candidate_liquidity_drain_metric`/`candidate_expected_slippage_estimate` بدل order-book/depth.
- **effective vs raw liquidity (wash-adjusted):** `candidate_expected_slippage_estimate` و`candidate_liquidity_drain_metric` يُحسبان على **effective liquidity** = reserves مخصومة بكسر الـ wash المستمدّ من `wash_fake_activity_risk` (لا reserves خام). الخصم **علاقة حساب** داخل هذه المشتقّات؛ لا حقل جديد. عند تعذّر تقدير كسر الـ wash بثقة → fail-safe: تُعامَل الثقة كأدنى (لا تُفترَض depth كاملة). يتّسق مع invariant الـ Exit Feasibility Gate (ARCH §7/55%).

### 8.7 Wallet analytics projection (توسعة §5.6)
- توسعة `wallet_intelligence_projection` بـ: `candidate_wallet_net_copyability_rank` · `_leader_vs_copier_delta` · `_is_copycat_flag` · `candidate_wallet_behavior_drift_flag` (حسم المؤجَّل) · `_max_drawdown_if_copied` · `_avg_hold_time` · `candidate_opportunity_cost_estimate` · `candidate_baseline_benchmark_return`. **لا score مركّب مُعتم — مكوّنات + ranking.**

---

## 9. F-Elimination — Data Model Additions (candidate, تستهلك SSOT Groups 22–36)

> storage entities / projections / read-models / relationships / provenance / retention على مستوى التوثيق — لا API routes · لا UX · لا test cases · لا code/migrations/live. **كل API-facing field/enum/resource في §9 مسجّل في SSOT Groups 22–36 ويبقى `candidate_*`؛ أمّا أسماء حاويات التخزين الداخلية مثل `candidate_pnl_lots` و`candidate_mark_records` فهي DATA-layer storage-only containers ولا تظهر في API/UX payloads.** PostgreSQL مصدر الحقيقة للقرارات/الـ audit · ClickHouse تحليلي لا مصدر أوامر · Redis/RAM projection قابل لإعادة البناء. **لا «pending/later/مؤجل» مفتوحة.**

### 9.1 P&L Read-Model (F1)
- `candidate_pnl_lots` (مشتق من positions/intents/trade_fills، lot-based/FIFO) مصدر `candidate_realized_pnl`؛ `candidate_unrealized_pnl` من `candidate_mark_records`؛ `candidate_fees_total`/`candidate_slippage_cost`/`candidate_paper_pnl`/`candidate_pnl_by_wallet`/`_by_copy_mode`/`_by_brain`/`candidate_remaining_daily_loss_budget` تجميعات read-model. **(`candidate_pnl_lots`/`candidate_mark_records` = حاويات DATA-layer storage-only، لا API-facing — انظر §8.1.)**
- **سجلّات P&L التاريخية finalized غير قابلة للتعديل افتراضياً (immutable)؛ إعادة الاحتساب = report/artifact منفصل بـ config_version/provenance/generated_at؛ لا تعديل finalized إلا بـ migration مُعتمَد منفصلاً.**
- backend/data read-model فقط · **لا P&L على Opportunity/Radar** · legacy مرفوضة (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`).

### 9.2 Mark / Price storage (F2)
- `candidate_mark_records` تحمل `candidate_mark_price`/`_source`/`_timestamp`/`_confidence`/`_status`. كائنات/عروض السعر تحمل `candidate_price_type`/`_provenance`/`_timestamp`/`_status`/`_confidence` + `candidate_entry_price`/`candidate_current_mark_view`/`candidate_fill_price`/`candidate_quote_price`/`candidate_display_price`/`candidate_quote_impact`.
- **لا `candidate_current_price` · display ليس execution truth · AMM يخزّن quote-impact/liquidity-drain/expected-slippage لا order-book · كل سجلّ/عرض سعر يحمل type/provenance/timestamp/status/confidence حيث ينطبق.**

### 9.3 Trade Event / Journal (F3)
- `candidate_trade_event` (**append-only** في ClickHouse للأحداث عالية الحجم، روابط PG عبر intent/position) · `candidate_trade_event_type` (signal_observed/decision/risk/build/sign/send/land/fill/partial_fill/exit_attempt/exit_fill/close/failure) · `candidate_trade_id` · `candidate_trade_journal` (read view).
- مرتبط بـ intent/position/execution-wallet/leader attribution حيث ينطبق · **بلا أسرار** · يخدم replay/reports/charts/debug.

### 9.4 Wallet-Token Performance (F4)
- `candidate_wallet_token_performance` (projection): `candidate_wt_net_result` · `candidate_wt_cost_completeness_status` · `candidate_wt_holding_time` · `candidate_wt_entry_timing`/`_exit_timing` · `candidate_wt_repeat_behavior` · `candidate_wt_point_in_time`.
- **point-in-time/survivorship-free · net_result لا يُعتبر complete إلا إذا status=complete · partial/estimated/unavailable تُخزَّن/تُكشَف كـ status · لا ranking أعمى بنتيجة ناقصة · فهرسة per-(wallet,token) + provenance.**

### 9.5 Discovery Signals (F5)
- projections: `candidate_early_buyer_rank` · `candidate_repeat_winner_metric` · `candidate_cluster_id` · `candidate_cluster_confidence` · `candidate_cluster_method` · `candidate_cluster_provenance`.
- **احتمالية لا حقيقة · confidence/provenance إلزامية · low-confidence لا يُخزَّن/يُعرض كـ known cluster · لا execution authority.**

### 9.6 Balances / Sweep (F6)
- storage/projections: `candidate_execution_wallet_balance`/`candidate_settlement_wallet_balance`/`candidate_funding_wallet_balance` · `candidate_profits_available_to_sweep` · `candidate_sweep_event` (**append-only**) · `candidate_sweep_history` · `candidate_balance_provenance` · `candidate_balance_reconciliation_status`.
- **لا raw keys/secrets · الأرصدة تتطلّب provenance/on-chain reconciliation · `mismatch` يُخزَّن ويحجب الكنس downstream · لا أرصدة مخترَعة · لا كنس من غير مالك · redaction في backup/export.**

### 9.7 Position Token Identity (F7)
- توسعة projection المركز: `candidate_position_token_mint` (**canonical**) · `candidate_position_token_symbol` · `candidate_position_token_name` · `candidate_token_identity_provenance` · `candidate_token_symbol_trust` (verified/unverified/spoof_suspected).
- **mint canonical · symbol/name display/untrusted · spoof_suspected يُخزَّن/يُعرض كحالة تحذير · symbol/name ليست execution truth.**

### 9.8 Position Leader Attribution (F8)
- projection: `candidate_position_attribution` · `candidate_followed_wallet_id` · `candidate_leader_entity_id` · `candidate_attribution_cluster_id` · `candidate_signal_source` · `candidate_attribution_confidence` · `candidate_attribution_multi_leader`.
- **read-only · يدعم leader-vs-copier · لا execution authority · التعارض/تعدّد القادة لا يُطوى صامتاً.**

### 9.8a Leader Position Change Reconstruction (Gap A · يستهلك SSOT Group 20 — لا Groups 22–36)
- projection (read-only/derived): يربط حدث القائد بمخرَجَي إعادة البناء المُسجَّلين في SSOT Group 20 — `candidate_leader_position_change_pct` · `candidate_leader_balance_reconstruction_status` (`reconstructed`/`partial`/`low_confidence`/`unavailable`) — مع مراجع قائمة فقط: position reference (نظير §9.8) · `tracked_wallet_address` (SSOT) · token/`mint` reference (نظير §9.7) · `copy_event` (SSOT Group 3 · §6.4 `wallet_observations`) · `event_timestamp` (SSOT) · provenance/source markers (نظير §9.x).
- **الاتّجاه/النوع من `copy_event`** (`leader_partial_sell`/`leader_full_exit`/`leader_scale_in`) — لا حقل اتّجاه جديد. `candidate_leader_position_change_pct` يخزّن **المقدار فقط بعد خصم التحويل/تعديل الـ cluster داخلياً**؛ الخروج الكامل **يُشتقّ من `copy_event = leader_full_exit`** لا من boolean مستقلّ.
- **مدخلات حساب داخلية فقط (ليست حقول Data Model):** `leader_wallet_balance_before/after` · `leader_cluster_balance` · `transfer_adjusted_balance` تُوصَف كمدخلات حساب داخلية تُثبت تطبيق خصم التحويل/الـ cluster، **ولا تُخزَّن كأعمدة Data/API**. **لا تُضاف** `candidate_leader_sell_percentage`/`candidate_leader_buy_percentage` · `full_exit_detected`/`partial_exit_detected` (تكرار `copy_event`) · أي leader P&L · أي reconstruction object/resource عريض · أي command/execution table · أي `copy_event` جديد.
- **fail-safe:** `unavailable`/`low_confidence` **لا تُفسَّر 0% ولا 100% ولا mirror أعمى**؛ المستهلكون يلتزمون السلوك الحذِر (watch-only/manual-review/خفض الإجراء) عبر طبقات السياسة القائمة (§4.2/§10) — اتّساقاً مع ARCHITECTURE §15.1 وحدة 3 وFail-Safe-Not-Fail-Open.
- **قاعدة:** **projection لا حقيقة · read-only (لا كتابة API) · لا execution/command authority.** إن خُزِّن كـ read-model معتمد فـ **PostgreSQL يفوز** عند التعارض ويُعاد بناؤه؛ وأي نسخة في ClickHouse (`wallet_observations` §6.4) **تحليلية/replay فقط** (متّسق مع §6). الغرض: replay/audit reproducibility لإثبات `transfer ≠ sell` ودقّة نسبة البيع الجزئي واشتقاق الخروج الكامل من `copy_event` ومعالجة الـ cluster/transfer، دون إدخال المتغيّرات الخام كحقول.

### 9.9 Batch Exit (F9)
- data model: `candidate_batch_exit_request` · `candidate_batch_exit_preview_id` · `candidate_batch_exit_preview_item_status` (eligible/blocked/stale) · `candidate_batch_exit_preview_valid_until` · `candidate_batch_exit_result_status` (submitted/blocked/failed/skipped/filled).
- **لا `exit_all_positions`/`batch_exit_all_positions` · preview وrequest سجلّات auditable · request يشير إلى preview حديث صالح · نتيجة per-position تُخزَّن مستقلّة · كل مركز نيّة خروج مستقلّة · لا mass exit صامت.**

### 9.10 Alerts (F10)
- storage: `candidate_alert_rule` · `candidate_alert_event` (**append-only**) · `candidate_alert_ack` · `candidate_alert_severity` (info/warning/critical) · `candidate_alert_category` (security/risk/provider/data/ops/execution/wallet) · `candidate_alert_source` · `candidate_alert_preference`.
- **security+critical لا تُكتم كتجاوز · ack لا يحذف/يخفي حقائق الحدث · التفضيلات لا تكتم التنبيهات الإلزامية.**

### 9.11 Reports / Exports (F11)
- storage/resources: `candidate_report_definition` · `candidate_report_artifact` · `candidate_export_history` · `candidate_report_provenance` · `candidate_report_generated_at` · `candidate_export_job` · `candidate_export_format` (markdown/csv/parquet/jsonl) · `candidate_report_template_id` · `candidate_report_redaction_policy` · `candidate_report_missing_metric_policy`.
- **لا اختلاق مقاييس · artifact يتطلّب provenance+generated_at · لا أسرار/raw keys/private keys/seeds/signer credentials/partial secrets · export history يسجّل redaction policy وmissing-metric policy.**

### 9.12 Preferences (F12)
- storage: `candidate_ui_preferences` (+ `candidate_pref_language` ar/en · `_direction` rtl/ltr · `_mode` beginner/advanced · `_visible_columns`/`_saved_views`/`_saved_filters`/`_notifications`).
- **UI/user state لا trading config · لا تعدّل strategy/risk/live/signer · مخزَّنة منفصلةً عن config_versioned trading config.**

### 9.13 Glossary (F13)
- storage (server-side، versioned): `candidate_glossary_content` · `candidate_glossary_version` · `candidate_glossary_locale` (ar/en) · `candidate_glossary_sot_mapping` · `candidate_glossary_edit_policy` (system_managed default / admin_editable permissioned).
- **يربط SSOT ولا يعيد تعريفه.**

### 9.14 Onboarding Progress (F14)
- storage: `candidate_onboarding_progress` · `candidate_ob_steps`/`_completion_state`/`_selected_mode`/`_language_direction`/`_first_wallet_progress`/`_provider_setup_progress`/`_paper_setup_progress`/`_live_readiness_education_progress` · `candidate_onboarding_store_progress`.
- **حالة/مراجع فقط — لا raw provider key/private key/seed/signer credential/partial secret · provider progress عبر `candidate_provider_key_ref` بعد التسجيل · لا تجاوز readiness gates.**

### 9.15 Provider Key Flow (storage)
- **raw provider key لا يُخزَّن إطلاقاً في جداول/artifacts/تخزين شبيه بالـ log؛ يُخزَّن `candidate_provider_key_ref` فقط كمرجع؛ لا raw key في exports/reports/backups/diagnostics/browser state؛ المادة السرّية في secret manager خارجي آمن لا في هذا النموذج.**

### 9.16 Opportunity / Radar Guard (data)
- **تخزين/read-model الفرصة بلا P&L وبلا execution authority؛ عناصر F-Elimination المُرقّاة تُخزَّن عبر projections/resources مخصّصة لا داخل payload الفرصة؛ لا ربط ضمني Opportunity→تنفيذ.**

### 9.17 Retention / Redaction
- **audit المالي وتاريخ trade-event لا يُحذفان بالـ purge العادي (terminal retention/append-only)؛ exports/backups/diagnostic bundles تحجب الأسرار؛ تخزين report/export يسجّل redaction policy؛ purge يحفظ السجلّات الحرجة للـ audit.** يتّسق مع `candidate_retention_profile` (Group 27).

---

## 10. Wave 1 — Profit & Paper Truth — Data Model Additions (candidate, تستهلك SSOT Group 37)

> projections / read-models / relationships / provenance على مستوى التوثيق — **لا API routes · لا UX · لا test cases · لا code/migrations/SQL/live.** كل API-facing field/enum/resource مسجّل في **SSOT Group 37** ويبقى `candidate_*`. **كلها derived/read-only projections قابلة لإعادة البناء — لا manual writes**؛ PostgreSQL يبقى مصدر الحقيقة للقرارات/الـ audit، وClickHouse تحليلي لا مصدر أوامر. **Paper موسوم `simulated` ولا يُخلَط مع real/live.** لا اسم خارج SSOT؛ ولا حاويات تخزين جديدة (يُعاد استخدام القائمة).

### 10.1 Anti-Fake Edge (W1-01) — توسعة `wallet_intelligence_projection` (§5.6/§8.7)
- توسعة projection ذكاء المحافظ بـ: `candidate_fake_profit_risk` · `candidate_fake_profit_reason` (self_trading/wash_trading/fake_volume/linked_wallet_circular_activity/creator_dev_controlled_trading/artificial_liquidity_activity_loop) · `candidate_fake_profit_adjusted_edge`.
- **derived/computed، read-only، لا manual write.** **provenance:** مشتقّة من كاشفات wash/sybil/closed-loop (ARCH §40%) + `candidate_cluster_*` (§9.5) + volume authenticity (Token Gate)؛ تحمل source/dependency markers مثل بقيّة §5.6.
- **relation:** `candidate_fake_profit_adjusted_edge` يخفض `candidate_wallet_net_copyability_rank` (§8.7) ولا يرفعه؛ **الربح الوهمي لا يرفع الترتيب.** **projection لا حقيقة:** يُعاد بناؤه عند تعارضه مع `wallet_observations` (§6.4)/source markers.

### 10.2 Profit Source Attribution (W1-02) — توسعة `wallet_intelligence_projection` (§5.6/§8.7)
- nested projection/list per wallet: `candidate_profit_source_attribution` يحوي عناصر `candidate_profit_source_type` (early_entry/token_selection_quality/exit_timing/insider_non_copyable_information/execution_speed_advantage/artificial_pump_profit/non_repeatable_luck_one_off) مع `candidate_profit_source_copyability_class` (copyable/partially_copyable/non_copyable) لكل عنصر؛ + `candidate_copyable_profit_share` · `candidate_non_copyable_profit_share`.
- **derived/computed، read-only.** **relation:** inputs `candidate_leader_vs_copier_delta` (§8.7) · `candidate_wt_entry_timing`/`_exit_timing` (§9.4)؛ point-in-time/survivorship-free يتّسق مع §9.4. **`non_copyable` لا يدخل في copyable edge ولا يرفع الترتيب.**

### 10.3 token_readiness_score Components (W1-03) — توسعة `token_opportunities` (§4.12)
- component list per token/opportunity: `candidate_token_readiness_component` (عناصر) · `candidate_token_readiness_component_type` (token_age/liquidity/route_health/volatility/holder_risk/creator_risk/exit_feasibility/slippage_risk/migration_graduation_state/provider_route_reliability/wash_fake_activity_risk) · `candidate_token_readiness_component_reason` · `candidate_token_readiness_component_veto`.
- **derived/computed، read-only.** **relation مع `token_readiness_score` (§4.12، SSOT Group 16):** الدرجة تُعرَض مع مكوّناتها — **لا رقم معتم**؛ `component_veto=true` يمكنه حجب الجاهزية رغم إجمالي جيد. **provenance لكل component** (creator_risk↔`creator_launch_rate_flag` · wash_fake_activity_risk↔§10.1 · migration_graduation_state↔migration phases §4.3). يبقى ضمن `token_opportunities` (pre-position، **بلا P&L**).

### 10.4 Realistic Paper Simulation (W1-04) — توسعة P&L read-model (§8.1/§9.1)
- جانب paper من read-model: `candidate_paper_pnl_gross_theoretical` · `candidate_paper_pnl_execution_aware` · `candidate_paper_cost_impact` · `candidate_paper_failure_impact`.
- **derived/computed، read-only، `simulated` دائماً، لا خلط مع real/live.** **source:** مشتقّ من `candidate_pnl_lots` (paper side، §9.1) + CostPipeline (cost_impact) + FailedTransactionClassifier/`candidate_failure_origin` (failure_impact) + CalibrationStore `simulated_*` (ClickHouse `trade_fills`/`execution_outcomes` §6.2/§6.3).
- **`gross_theoretical` لا يُستخدم كمصدر ربحية منفصل** (مرجع نظري فقط)؛ **impact غير المتوفّر لا يُختلق** (يُوسَم unavailable). يوسّع `candidate_paper_pnl` (§9.1) ولا يكرّره.

### 10.5 Paper Outcome States (W1-05) — paper trade projection (يُجاور §5.3/§6.2)
- projection لكل paper trade: `candidate_paper_outcome_state` (reached_target/exited_with_loss/failed_entry/failed_exit/exit_unavailable/route_failed/expired/rejected_by_policy/still_open/force_closed_by_safety) · `candidate_paper_outcome_reason`.
- **derived/read-only · لا paper trade بلا outcome state.** **relation:** الطوابع عبر Execution Trace `candidate_ts_*` (§8.2)؛ الفشل يشير إلى `candidate_failure_origin` (§8.2/§9.x). **متمايز عن `position_state` (§4.3/§5.3):** outcome = تصنيف terminal لصفقة paper للتقرير/التجميع، **لا حالة دورة حياة runtime** ولا يُكتب على `positions`.

### 10.6 Paper Aggregation Report (W1-06) — توسعة Reports (§9.11)
- report artifact/read-model: `candidate_paper_aggregation_report` (instance من `candidate_report_definition`/`candidate_report_template_id`) · `candidate_paper_aggregation_dimension` (wallet/mode/strategy/token_class/period) · `candidate_paper_aggregation_metric` (max_drawdown/win_rate/avg_win/avg_loss/profit_factor/expectancy/median_hold_time/average_hold_time/failed_trade_rate/rejected_opportunity_count/exit_failure_rate/slippage_impact/latency_impact/fees_impact).
- **derived/computed، read-only · context = paper/simulated · لا خلط مع real/live · المقياس المفقود `show_unavailable` عبر `candidate_report_missing_metric_policy` (§9.11/Group 36، لا اختلاق).** يُعيد استخدام `candidate_wallet_avg_hold_time`/`_max_drawdown_if_copied` (§8.7) حيث ينطبق؛ artifact يحمل `candidate_report_provenance`/`_generated_at`.

### 10.7 Paper↔Real Divergence (W1-07) — calibration/readiness projection (يُجاور §6.3/§6.6)
- projection: `candidate_paper_real_divergence` · `candidate_paper_real_divergence_dimension` (fill/slippage/exit_success/latency/provider_reliability) · `candidate_paper_real_divergence_status` (within_band/elevated/high).
- **derived/computed، read-only.** **source:** CalibrationStore `simulated_*` مقابل `real_*` (ClickHouse `trade_fills`/`execution_outcomes` §6.2/§6.3 + `metrics_timeseries` §6.6). **`high` = warning/readiness signal** يغذّي Calibration Kill/Pause **القائم** (ARCH 95%) — **لا gate جديد**؛ قابل للظهور في reports (§10.6/§9.11) قبل أي ترقية paper→real.

### 10.8 Point-in-time / Survivorship — Data Model Note (W1-08)
- **لا حقل/حاوية جديدة.** ملاحظة على datasets اكتشاف/backtest المحافظ (`replay_backtest_observations` §6.5 · `wallet_observations` §6.4 · `wallet_intelligence_projection` §5.6): **تحفظ point-in-time evaluation (بيانات ≤ T) · no future leakage · المحافظ المنقرضة/الفاشلة/المختفية تبقى ضمن الـ cohort التاريخي (survivorship-free).**
- يُعاد استخدام `candidate_wt_point_in_time` (§9.4) كعلَم منهجي. **إن تعذّر إثبات ذلك من البيانات، يجب ألّا تدّعي reports/API صلاحية survivorship-free.** التحقّق نفسه follow-up في 07-TEST-PLAN — **لا runtime field جديد.**

> **مبدأ §10:** كل ما سبق **derived projections/read-models قابلة لإعادة البناء** لا مصادر حقيقة؛ PostgreSQL/audit يبقيان السلطة، وClickHouse تحليلي. fake profit لا يرفع الترتيب · non_copyable خارج الـ edge · readiness بمكوّنات + veto لا رقم معتم · paper مشتقّ execution-aware وموسوم simulated ولا يُخلَط بـ real · لكل paper trade outcome متمايز عن position_state · divergence إشارة تغذّي gate قائم لا جديد · datasets الاكتشاف point-in-time/survivorship-free. **No new field outside SSOT Group 37 · no migrations · no API/UX/Test/Build here.**

---

## 11. Wave 2 — Discovery & Copy Safety — Data Model Additions (candidate, تستهلك SSOT Group 38)

> projections / read-models / relationships / provenance على مستوى التوثيق — **لا API routes · لا UX · لا test cases · لا code/migrations/SQL/live.** كل API-facing field/enum مسجّل في **SSOT Group 38** ويبقى `candidate_*`. **كلها derived/read-only projections قابلة لإعادة البناء — لا manual writes** (وadvisory عند drift/learning/adverse-selection)؛ PostgreSQL/audit السلطة، ClickHouse تحليلي. **لا execution authority · لا auto-ban · لا auto-config · لا `full_mirror` ضمني · لا أسرار · لا اسم خارج SSOT · لا حاويات تخزين جديدة (يُعاد استخدام القائمة).**

### 11.1 Wallet Taxonomy (W2-01) — توسعة `wallet_intelligence_projection` (§5.6/§8.7)
- توسعة projection ذكاء المحافظ بـ: `candidate_wallet_type` (enum الأنواع الثمانية) · `candidate_wallet_type_confidence` · `candidate_wallet_type_provenance`.
- **derived/computed، read-only، rebuildable** (projection لا حقيقة، يُعاد بناؤه عند تعارضه مع `wallet_observations` §6.4/source markers). **relation:** copycat↔`candidate_is_copycat_flag` (§8.7) · linked_cluster↔`candidate_cluster_id` (§9.5) · يتقاطع مع `candidate_fake_profit_*` (§10.1). **low-confidence لا يُخزَّن/يُعرَض كحقيقة مؤكدة** · **insider/dev/sniper/copycat لا يرفعون `candidate_wallet_net_copyability_rank` (§8.7)** · لا execution authority.
- **provenance:** `candidate_wallet_type_provenance` (on_chain/heuristic/provider_enrichment/manual_review/mixed) إلزامي.

### 11.2 Token Concentration (W2-02) — توسعة `token_opportunities` (§4.12)
- projection: `candidate_token_concentration_dimension` (الأبعاد الثمانية) · `candidate_token_concentration_risk` · `candidate_token_concentration_reason`.
- **derived/computed، read-only.** **relation:** يغذّي `candidate_token_readiness_component` (§10.3)؛ الحجب يظهر عبر `candidate_token_readiness_component_veto`. **creator/dev/cluster concentration لا يُعامَل كطلب طبيعي** · لا execution authority.
- **provenance/source:** من holder/creator/cluster/early-buyer data حيث متاح (`creator_launch_rate_flag` §4.12/§16، `candidate_cluster_id` §9.5)؛ يبقى ضمن `token_opportunities` (pre-position، **بلا P&L**).

### 11.3 Natural vs Artificial Pump (W2-03) — توسعة token signal projection (§4.12 / §6.1 `stream_events`)
- projection: `candidate_pump_classification` (الفئات الست) · `candidate_pump_classification_reason` · `candidate_pump_classification_confidence`.
- **derived/computed، read-only، منفصل عن raw price movement** (لا يُشتقّ من السعر وحده). **relation:** يتقاطع مع `candidate_fake_profit_*` (§10.1) و wash/fake activity. **`unknown_or_insufficient_evidence` لا يُترجَم إلى natural demand**؛ `artificial_*` يصبح reason لـ watch_only/rejection/readiness reduction **لا command** · لا execution authority.

### 11.4 Wallet Drift Alert (W2-04) — توسعة `wallet_intelligence_projection`/Alerts (§5.6/§9.10)
- projection: `candidate_wallet_drift_signal` · `candidate_wallet_drift_reason` (التسعة) · `candidate_wallet_drift_recommendation` (الخمس).
- **derived/read-only/advisory.** يبني على `candidate_wallet_behavior_drift_flag` (§8.7) ولا يكرّره. **التوصيات projection/read-model فقط — لا تكتب config · لا تغلق مراكز · لا auto-config**؛ أي reduce/pause/switch عبر user/config flow (نظير Recommendations §8.3).

### 11.5 Default Copy Mode Policy — Data Model Note (W2-05)
- **لا storage field/حاوية جديدة.** ملاحظة على `per_wallet_config`/`wallet_registry` (يعيد استخدام `copy_mode`، `candidate_copy_mode_default_policy`): محفظة متبوعة جديدة **بلا `copy_mode` صريح → تُحَل إلى `follow_entry_user_exit`**؛ الـ `copy_mode` المُخزَّن per-wallet يجب أن يكون واضحاً بعد validation؛ legacy/migrated wallet بلا `copy_mode` واضح → safe-default أو require review؛ **لا يُخزَّن `full_mirror` ضمنياً أبداً**؛ `full_mirror` يتطلّب explicit per-wallet enablement. **لا advanced-flag غير مسجّل** (requires_ssot_followup) · **لا تغيير CONFIG.**

### 11.6 Creator / Cluster Learning (W2-06) — projection تاريخي (يُجاور §6.4 `wallet_observations`/§6.5 `replay_backtest_observations`)
- projection تاريخي (لا snapshot): `candidate_creator_cluster_learning` · `candidate_creator_cluster_learning_metric` (الثمانية) · `candidate_creator_cluster_learning_recommendation` (الخمس) · `_confidence` · `_provenance`.
- **derived/read-only/advisory.** **point-in-time** عبر `candidate_wt_point_in_time` (§9.4) — **no future leakage** (المحافظ/الإطلاقات الفاشلة تبقى في العينة التاريخية). **no auto-ban · no config auto-change · low-confidence ليس حقيقة.** **source/provenance:** من creator/cluster token outcomes · exit feasibility · paper/live outcomes حيث متاح (`candidate_cluster_id` §9.5، `creator_launch_rate_flag` §4.12).

### 11.7 Adverse Selection (W2-07) — توسعة copyability/copy diagnostics projection (§8.7 / §6.3 `execution_outcomes`)
- projection: `candidate_adverse_selection_metric` · `candidate_adverse_selection_reason` (الستة) · `candidate_adverse_selection_severity` (low/elevated/high).
- **derived/computed، read-only.** **relation/source:** `candidate_leader_vs_copier_delta` (§8.7) · `latency_to_copy` (§5/§6) · `entry_slippage_vs_leader` · `candidate_wt_exit_timing` (§9.4) · route/quote degradation · failed/late exits (`execution_outcomes` §6.3). **لا يخلط ربح القائد بربح التابع** · `severity=high` advisory فقط (قد يغذّي watch_only/reduce_size توصية) · **لا execution authority · لا config auto-change.**

> **مبدأ §11:** كل ما سبق **derived projections/read-models قابلة لإعادة البناء** لا مصادر حقيقة؛ PostgreSQL/audit السلطة، ClickHouse تحليلي. نوع المحفظة لا يرفع الترتيب للأنواع الخطرة · concentration يفعل veto عبر readiness component لا كأمر · pump منفصل عن السعر الخام · drift/learning/adverse-selection **advisory read-only بلا auto-ban/auto-config** · W2-05 note بلا حقل جديد ولا `full_mirror` ضمني · learning point-in-time/survivorship-free. **No new field outside SSOT Group 38 · no migrations · no API/CONFIG/UX/Test/Build here.**

---

## 12. Wave 3 — Reports & Honesty — Data Model Additions (candidate, تستهلك SSOT Group 39)

> report artifacts / report definitions / projections / provenance على مستوى التوثيق — **لا API routes · لا UX · لا test cases · لا code/migrations/SQL/live · لا report generation implementation.** كل API-facing field/enum مسجّل في **SSOT Group 39** ويبقى `candidate_*`. **كلها derived/read-only report read-models قابلة لإعادة البناء — لا manual writes · لا raw secrets**؛ PostgreSQL/audit السلطة، ClickHouse تحليلي. **لا execution authority لأي تقرير/مقياس/disclaimer · لا تغيير سلوك EV gate/Hard Risk · لا execution mode · لا خلط Paper/Testnet/Real-Live · `warning_only` ليس clean_pass · unavailable/insufficient evidence ليس صفراً · positive trade P&L لا يعني positive business P&L.** يعيد استخدام حاويات التقارير القائمة (§ stores: `candidate_report_artifact`/`_definition`/`_template_id`/`_provenance`/`_generated_at`/`_missing_metric_policy`) لا حاويات جديدة.

### 12.1 Daily Unified Report (W3-01) — report artifact/read-model
- `candidate_daily_unified_report` (instance من `candidate_report_definition`/`candidate_report_template_id`) · `candidate_report_context` (simulated/testnet/real_live) · `candidate_report_section` (paper_results/real_live_results/testnet_results/rejected_opportunities/failed_trades/open_risk/provider_health/config_changes/safety_gate_state/data_quality_issues/major_alerts) · `candidate_report_missing_metric_policy`.
- **derived/read-only، rebuildable.** **لا خلط Paper/Testnet/Real-Live في التخزين أو projection** (أقسام منفصلة لكل context). المقياس المفقود `show_unavailable`/insufficient evidence **لا صفر**. artifact يحمل `candidate_report_provenance`/`candidate_report_generated_at`. لا execution authority.

### 12.2 Report Definitions Catalog (W3-02) — catalog read-model/metadata
- `candidate_report_catalog` · `candidate_report_definition_type` (الـ13 نوعاً) · `candidate_report_definition` · `candidate_report_template_id` · `candidate_report_provenance` · `candidate_report_missing_metric_policy`.
- **read-model/metadata، read-only.** القوالب الرسمية **لا تستبدلها custom**. كل تعريف يربط scope/context/dimensions/metrics/evidence(`candidate_report_provenance`)/missing-metric/disclaimer(§12.4)/paper-real-separation. يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence` (§10) كأنواع مسجّلة. **لا template IDs نهائية غير مسجّلة (requires_ssot_followup) · لا report generation implementation.**

### 12.3 Weekly Comparison Report (W3-03) — projection
- `candidate_weekly_comparison_report` (instance) · `candidate_weekly_comparison_axis` (wallet/copy_mode/brain/provider/strategy/token_class/config_before_after/paper_real_divergence/creator_cluster_cohort/adverse_selection_impact) · `config_version_at_entry` · `candidate_report_missing_metric_policy`.
- **derived/read-only.** `config_before_after` يحترم **`config_version_at_entry`** (§ config snapshots) · **no auto-apply** · **لا خلط Paper/Real/Live** · الفروقات المفقودة `unavailable`. relation مع report artifacts/`candidate_report_provenance` القائمة.

### 12.4 Disclaimer Standard (W3-04) — report metadata
- `candidate_report_disclaimer_requirement` (past_performance_not_future_profitability/paper_not_live_profitability/backtest_requires_point_in_time_evidence/results_affected_by_cost_latency_provider_data_quality/high_confidence_not_certainty/recommendations_are_advisory_until_user_config_flow) · `candidate_report_disclaimer_required_for` (paper/backtest/weekly/recommendation/promotion).
- **metadata على `candidate_report_definition`/artifact، read-only.** **لا يصحّح report invalid · لا execution authority · لا يختفي في advanced mode كـ data condition.**

### 12.5 Net Business PnL (W3-05) — derived report/read-model
- `candidate_net_business_pnl_report` (instance) · `candidate_net_business_pnl` · `candidate_business_cost_component` (provider_credit_cost/rpc_streaming_cost/infra_storage_export_report_cost/subscription_provider_cost) · `candidate_net_business_pnl_status` (complete/partial/unavailable).
- **derived reporting surface فقط — ليس بديلاً لـ trade P&L · لا execution authority.** **source/provenance:** من P&L read-model (`candidate_realized_pnl`/`candidate_fees_total`/`candidate_slippage_cost` §10/§9) + provider/credit/infra/storage paths المتاحة (`candidate_storage_usage_metric` §11 ops + §16 RPC/Credit) **فقط**. **cost source غير متاح → partial/unavailable لا صفر · positive trade P&L لا يعني positive business P&L · لا runtime cost source field غير مسجّل** (requires_ssot_followup).

### 12.6 warning_only Report Tag (W3-06) — report/result metadata projection
- `candidate_report_gate_context` (clean_pass/warning_only_advisory/blocked) · `candidate_warning_only_report_tag` (true/false) فوق `ev_gate_mode`/`warning_only`/`WARNING_CRITICAL`.
- **read-only report/result metadata.** **`warning_only_advisory` لا يُخزَّن/يُعرَض كـ `clean_pass` · failed EV لا يختفي · لا يغيّر EV gate · لا يضعف Hard Risk · لا execution mode · لا report promotion بلا disclosure.** relation مع decision-time config/gate state؛ **إن استخدم التقرير snapshot يحتفظ بسياق gate وقت القرار** (يتّسق `config_version_at_entry`/decision-time snapshots).

> **مبدأ §12:** كل ما سبق **report read-models/artifacts/projections derived قابلة لإعادة البناء** لا مصادر حقيقة؛ PostgreSQL/audit السلطة، ClickHouse تحليلي. context إلزامي وفصل Paper/Testnet/Real-Live · المقياس المفقود unavailable لا صفر · القوالب الرسمية لا تستبدلها custom · weekly يحترم config_version بلا auto-apply · disclaimer metadata لا يصحّح تقريراً غير صالح · Net Business PnL مشتقّ (trade≠business، unavailable/partial لا صفر) بلا حقل تكلفة جديد · warning_only metadata read-only لا يُعرَض clean pass ولا يخفي failed EV. **No new field outside SSOT Group 39 · no migrations · no report generation impl · no API/CONFIG/UX/Test/Build here.**

---

## 13. Wave 4 — Execution / Providers + Data — Data Model Additions (candidate, تستهلك SSOT Group 40)

> projections / read-models / report+diagnostic artifacts / provenance على مستوى التوثيق — **لا API routes · لا UX · لا test cases · لا code/migrations/SQL/live · لا provider setup/connection implementation · لا report generation impl.** كل API-facing field/enum مسجّل في **SSOT Group 40** ويبقى `candidate_*`. **كلها derived/read-only/advisory/diagnostic projections قابلة لإعادة البناء — لا manual writes**؛ PostgreSQL/audit السلطة، ClickHouse تحليلي. **لا provider raw key/secret/credential مُخزَّن · key material خارج browser/UI/report/export/API payloads/backups/diagnostics · لا provider connection/execution command.** **لا إشارة provider/execution/data-cost/opportunity تمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · المفقود unavailable/partial لا صفر/clean.** يعيد استخدام الكيانات القائمة بالتوسعة لا الإنشاء.

### 13.1 Provider Latency Comparison (W4-01) — توسعة Execution Trace / provider observability (§6.3 `execution_outcomes` / §6.1 `stream_events` / RPCHealthMonitor)
- projection: `candidate_provider_latency_metric` · `candidate_provider_latency_type` (stream/quote/route/send/confirmation_finality/provider_response_error) · `candidate_provider_latency_comparison`.
- **derived/computed، read-only، rebuildable.** source: execution trace `candidate_ts_*` + provider attribution + stream health + quote/route/send/confirmation timing (+ `provider_degraded`/`slot_lag`). **comparison best/worst كـ derived projection/report artifact لا قرار تنفيذ · latency مفقودة → unavailable لا صفر · no auto provider selection · لا execution authority.**

### 13.2 Rate-limit & Provider Cost Monitor (W4-02) — projection (provider usage/credit budget)
- projection: `candidate_provider_rate_limit_monitor` · `candidate_provider_cost_metric` (rate_limit/quota_usage/credit_usage/request_cost/period_cost/cost_per_trade/cost_per_report/cost_per_job/throttling_backoff_state/provider_degradation) · `candidate_provider_cost_attribution_status` (complete/partial/unavailable).
- **derived/read-only، rebuildable.** source/provenance: provider usage logs / §16 credit budget paths / job-report-trade attribution (حيث متاح). يُغذّي `candidate_net_business_pnl`/`candidate_business_cost_component` (§12.5) **دون إعادة تعريف**. **partial/unavailable لا صفر · availability وaffordability منفصلتان · لا provider billing/pricing fields جديدة · لا execution authority.**

### 13.3 Fork / Rollback (W4-03) — finality/network state projection + event artifact
- projection/artifact مستقل: `candidate_finality_state` (no_rollback_detected/rollback_risk/fork_detected/rollback_confirmed/finality_uncertain) · `candidate_rollback_fork_reason`.
- **derived/read-only.** relation: `stream_events` (§6.1)/provider state/slot tracking (`slot_lag`)/finality observations (`NETWORK_ROLLBACK_EVENT`/`provider_degraded`). **rollback-affected data تحمل warning/provenance ولا تُعامَل كحقيقة نهائية · لا gate جديد · لا تغيير Risk Gates/Hard Risk · `no_rollback_detected` ليس execution-safe · لا execution authority.**

### 13.4 Provider Onboarding & Key/Connection Validation (W4-04) — onboarding/readiness diagnostic projection
- projection: `candidate_provider_onboarding_status` · `candidate_provider_type` (helius/jito/jupiter/generic_rpc/generic_stream) · `candidate_provider_capability_status` · `candidate_provider_connection_test_status` · `candidate_provider_onboarding_failure_reason`. يعيد استخدام `candidate_provider_key_ref` **كمرجع إلى secret system لا قيمة سرية**.
- **derived/read-only.** **raw keys/secrets/credentials ممنوعة — لا تخزين key material · no raw key in report artifacts/diagnostics/backups.** **connection test status ليس trading readiness · Jupiter key/connection validation حالة diagnostic عند استخدام quotes/routes · provider readiness لا يتجاوز SignerService/Risk Gates/admission gates · لا provider connection command · لا provider setup implementation.**

### 13.5 Storage Cost + Survivorship-Safe Retention (W4-05) — storage cost report artifact/read-model
- artifact/read-model: `candidate_storage_cost_report` · `candidate_storage_cost_component` (data_type/retention_period/volume/hot_cold_archive_tier/report_export_artifacts/replay_backtest_datasets) · `candidate_retention_impact_warning` · `candidate_pruning_safety_status` (safe/survivorship_risk/point_in_time_risk/audit_integrity_risk).
- **derived/read-only.** يعيد استخدام `candidate_storage_usage_metric` + يربط بـ `candidate_net_business_pnl`. **retention impact warning يشير إلى الفئات المتأثّرة:** historical wallet discovery · dead/failed/disappeared wallets · replay/backtest datasets · audit/trade/accounting records. **storage cost مفقود → partial/unavailable لا صفر · pruning/cost-saving deletion لا يكسر point-in-time/survivorship-free analysis · لا purge command · لا storage pricing/billing fields نهائية.** relation: report artifacts/storage usage/replay datasets (§6.5)/audit retention.

### 13.6 Rejected Opportunity Re-evaluation (W4-06) — projection (opportunity lifecycle)
- projection: `candidate_rejected_opportunity_reevaluation` · `candidate_reevaluation_trigger` (liquidity_improved/route_health_improved/holder_risk_improved/creator_risk_improved/pump_confidence_improved/concentration_risk_improved/provider_data_quality_improved/exit_feasibility_improved) · `candidate_reevaluation_recommendation` (keep_rejected/keep_watch_only/review_again/eligible_for_paper/eligible_for_normal_evaluation).
- **derived/read-only/advisory.** يعيد استخدام `hunt_status`/`watch_only`/`candidate_rejected_reason` (§4.12 `token_opportunities`، pre-position بلا P&L). **must preserve:** original rejection reason · original evidence snapshot · new evidence snapshot · comparison/provenance. **لا buy/execute · لا auto-open position · لا auto-config · improved opportunity لا يثبت edge · `eligible_for_normal_evaluation` ليس execution-ready.**

### 13.7 Best Paper Settings This Week Advisory (W4-07) — advisory report artifact/read-model (Paper-only)
- artifact/read-model: `candidate_best_paper_settings_advisory` · `candidate_paper_settings_recommendation` · `candidate_paper_settings_evidence_status` (sufficient/insufficient_evidence/unavailable).
- **derived/read-only/advisory، context = Paper-only.** يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence` (§10)/`candidate_weekly_comparison_report`/`candidate_report_disclaimer_requirement` (§12). يحمل/يربط: sample size · confidence · time period · mode/strategy/copy_mode · fees/slippage/latency/failure impact · paper-real divergence (إن وُجد) · disclaimer. **insufficient_evidence/unavailable لا صفر ولا success · best paper setting ليس live-ready · لا auto-apply · لا live promotion بلا gates/disclosure.**

### 13.8 Graduation Trap States (W4-08) — token risk/readiness projection
- projection: `candidate_graduation_trap_state` (graduation_pending/migration_limbo/post_graduation_exit_unsafe/post_graduation_liquidity_fragile/post_graduation_route_unhealthy/post_graduation_watch_only/graduation_trap_confirmed) مرتبط بـ `token_opportunities`/token risk/migration state حيث ينطبق.
- **derived/read-only.** يعيد استخدام `migration_phase`/`MIGRATION_IN_PROGRESS` + `candidate_token_readiness_component` + exit feasibility **دون إعادة تعريف**. **يؤثّر على readiness/exit feasibility/reports · لا execution authority · لا gate جديد هنا · graduation ليس exit safety · `post_graduation_watch_only` لا يعني buy/execute · غياب دليل route/liquidity/exit ليس clean/safe.**

> **مبدأ §13:** كل ما سبق **derived/read-only/advisory/diagnostic projections+artifacts قابلة لإعادة البناء** لا مصادر حقيقة؛ PostgreSQL/audit السلطة، ClickHouse تحليلي. المزوّد السريع/المتصل ليس آمناً/جاهزاً · توفّر وكلفة منفصلان · بيانات rollback موسومة لا نهائية · key material عبر `candidate_provider_key_ref` فقط بلا raw key مُخزَّن · pruning آمن للبقاء (survivorship-free/point-in-time) · الفرصة المعاد تقييمها ليست أمر تنفيذ مع حفظ snapshots/provenance · best paper ليس live-ready · graduation ليس exit-safe · المفقود unavailable/partial لا صفر. **No new field outside SSOT Group 40 · no migrations/SQL · no provider setup/connection impl · no raw keys · no execution authority · no EV gate/Hard Risk/Risk Gates/SignerService change · no API/CONFIG/UX/Test/Build here.**

---

## 14. Wave 5 — Local Ops & Readiness — Data Model Additions (candidate, تستهلك SSOT Group 41)

> projections / read-models / status+diagnostic artifacts / provenance على مستوى التوثيق — **لا API routes · لا UX · لا test cases · لا code/migrations/SQL/tables فعلية/live · لا scripts/launcher/runtime · لا provider setup/connection implementation.** كل API-facing field/enum مسجّل في **SSOT Group 41** ويبقى `candidate_*`. **كلها derived/read-only/status/diagnostic projections+artifacts قابلة لإعادة البناء — لا manual writes · لا command/resource تنفيذي**؛ PostgreSQL/audit السلطة، ClickHouse تحليلي. **لا raw key/secret/credential مُخزَّن · لا secrets في logs/artifacts/diagnostics/backups · لا service-control/restart/shutdown/backup/restore/purge/rollback/migration command.** **Local run/health/version/logs/status لا يمنح execution authority · health green ليس trading readiness · SignerService health ليس permission to sign · provider health ليس trading readiness · documented_only/candidate ليس implemented · unknown/unavailable/not_verified لا clean/ready/implemented · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · PostgreSQL/source-of-truth authority محفوظة وrebuild projections لا يغيّرها.** يعيد استخدام الكيانات القائمة بالتوسعة لا الإنشاء.

### 14.1 Local Run UI-first Workflow (W5-01) — projection/read-model
- projection: `candidate_local_run_workflow_status` (not_started/checking/ready_for_local_use/degraded/blocked/unknown) · `candidate_required_local_service` · `candidate_local_run_missing_requirement` · `candidate_local_run_next_action` · `candidate_local_run_evidence_status` (present/partial/missing/stale/unknown).
- **derived/read-only، rebuildable** من health/config/service observations؛ **لا launcher/command state**؛ evidence/provenance يوضّح مصدر الحالة. **`ready_for_local_use` ≠ REAL-LIVE ready · local app running ≠ trading readiness · missing/stale/unknown لا تظهر clean · `candidate_local_run_next_action` guidance لا command · لا execution authority.**

### 14.2 Local Ops Health Screen (W5-02) — unified health projection
- projection: `candidate_local_ops_health` · `candidate_local_ops_service_type` (الـ15) · `candidate_local_ops_service_status` (healthy/degraded/unavailable/unknown/not_configured/blocked) · `candidate_local_ops_health_reason` · `candidate_local_ops_health_next_action`. يعيد استخدام `signer_profile_status`/`operating_state`/`candidate_provider_onboarding_status`/`candidate_data_quality_metric`/`candidate_storage_usage_metric`.
- **derived/read-only/diagnostic.** sources: service heartbeat/status observations · provider health · data quality · storage usage · config/migration state · queue/backlog/job runner (حيث قائم). **لا operational control tables.** **`healthy` ليس execution-safe · SignerService `healthy` ليس permission to sign · provider_connectivity `healthy` ليس trading readiness · unavailable/degraded ليس stack trace فقط · لا restart/test/connect command · لا execution authority.**

### 14.3 Operator Logs (W5-03) — read-model/artifact فوق Audit/log sources
- read-model: `candidate_operator_log_event` · `candidate_operator_log_severity` (info/warning/error/critical) · `candidate_operator_log_category` (الـ13) · `candidate_operator_log_service` · `candidate_operator_log_correlation_ref` · `candidate_operator_log_user_summary` · `candidate_operator_log_technical_detail` · `candidate_operator_log_safe_next_action` · `candidate_operator_log_redaction_status` (redacted/not_required/redaction_failed/blocked_contains_secret/unknown).
- **derived/read-only.** يرجع request/job/correlation IDs حيث متاح؛ user_summary شرح تشغيلي؛ technical_detail قد يحوي stack trace **بعد redaction فقط**؛ safe_next_action guidance. **raw keys/secrets/tokens ممنوعة · `blocked_contains_secret` يحجب العرض/التصدير/نشر artifact · stack trace لا الرسالة الوحيدة · no raw secrets في data artifacts · logs لا تمنح execution authority.**

### 14.4 Migrations & Version Status (W5-04) — version/migration projection
- projection: `candidate_api_version_status` · `candidate_db_schema_version` · `candidate_config_schema_version` · `candidate_contracts_version_status` · `candidate_migration_status` (up_to_date/pending/running/failed/blocked/unknown) · `candidate_pending_migration` · `candidate_failed_migration` (read-only artifacts) · `candidate_rollback_availability` (available/unavailable/blocked/not_supported/unknown) · `candidate_version_compatibility_status` (compatible/incompatible/warning/unknown/not_verified). يعيد استخدام `candidate_app_version`/`config_version`/`config_version_at_entry`/`migration_phase`/`MIGRATION_IN_PROGRESS`.
- **derived/read-only، rebuildable** من app/config metadata + migration observations + audit/history. **failed/pending/blocked/unknown لا تظهر clean · `compatible` شرط مسبق فقط لا execution authority · current version display ليس trading readiness · mismatch واضح · لا migration command · لا rollback command · لا destructive migration.**

### 14.5 Upgrade / Rollback Procedure (W5-05) — readiness artifact
- artifact: `candidate_upgrade_preflight_status` (pass/warning/blocked/failed/unavailable/unknown) · `candidate_upgrade_backup_requirement` (satisfied/required_missing/not_required/blocked/unknown) · `candidate_upgrade_migration_compatibility` (compatible/incompatible/warning/unknown/not_verified) · `candidate_rollback_path_status` (available/unavailable/blocked/invalid/unknown) · `candidate_upgrade_blocked_reason` · `candidate_post_upgrade_health_verification` (pass/warning/failed/blocked/unavailable/unknown) · `candidate_upgrade_incident_status` (none/open/blocked/mitigated/resolved/unknown).
- **derived/read-only.** يخزّن status/provenance/check outputs فقط؛ يشير لـ backup requirement status **بلا تخزين raw secret material**؛ incident/blocker read-only. **`pass` ليس trading readiness · backup/export artifacts بلا raw secrets · rollback status ليس command · failed upgrade → incident/blocker · لا upgrade/rollback/backup/restore command · لا implementation.**

### 14.6 Safe Maintenance Actions Policy (W5-06) — policy/status projection
- projection: `candidate_maintenance_action_type` (restart_service/safe_shutdown/backup/restore/export_diagnostics/clear_cache/reindex_rebuild_projections/migration_check/config_rollback_preview) · `candidate_maintenance_action_status` (unavailable/preview_required/permitted/blocked/running/completed/failed/unknown) · `candidate_maintenance_permission_status` (permitted/denied/requires_permission/unavailable/unknown) · `candidate_maintenance_audit_status` (audit_ready/audit_missing/audit_failed/not_required/unknown) · `candidate_maintenance_preview_status` (preview_available/preview_required/preview_missing/not_required/unknown) · `candidate_maintenance_block_reason` · `candidate_maintenance_reversibility_status` (reversible/partially_reversible/irreversible/unknown) · `candidate_safe_shutdown_status` (safe_to_shutdown/blocked_pending_intents/blocked_active_signing/blocked_critical_jobs/unknown).
- **derived/read-only — يمثّل هل action type permitted/blocked/preview-required، لا تنفيذ الفعل.** يرجع audit readiness/pending intents/active signing/critical jobs/source-of-truth impact/projection rebuild safety. **action types policy labels لا executable commands · no command table · safe_shutdown يراعي pending intents/active signing/critical jobs · backup بلا raw secrets · restore يحفظ audit/history/config · clear_cache لا يحذف source-of-truth · rebuild projections لا يغيّر سلطة PostgreSQL · لا execution authority.**

### 14.7 Implementation Status Matrix (W5-07) — status artifact/read-model
- artifact: `candidate_implementation_status` (implemented/partially_implemented/documented_only/candidate/not_built/blocked/deprecated) · `candidate_implementation_status_evidence` · `candidate_implementation_status_source` · `candidate_capability_status_label` · `candidate_status_verified_at` · `candidate_status_verification_state` (verified/not_verified/stale/unknown).
- **derived/read-only.** يقرأ/يمثّل `IMPLEMENTATION_STATUS_MATRIX.md` **دون تغييره**؛ كل capability label يحمل status + evidence/source + verification state حيث متاح. **`documented_only` ≠ implemented · `candidate` ≠ built · unknown/not_verified لا يظهر implemented · status لا يمنح execution authority · capability لا تظهر ready دون evidence · no “documented means built”.**

> **مبدأ §14:** كل ما سبق **derived/read-only/status/diagnostic projections+artifacts قابلة لإعادة البناء** لا مصادر حقيقة؛ PostgreSQL/audit السلطة، ClickHouse تحليلي. local app running ليس trading readiness · health green ليس execution-safe وsigner health ليس permission to sign · logs تُخفي الأسرار و`blocked_contains_secret` يحجب · version compatible شرط مسبق لا authority · upgrade pass ليس trading readiness وbackup/export بلا raw secrets · maintenance policy/states فقط (لا command table، غير سلطوية على source-of-truth) · documented_only/candidate ليس implemented (unknown → not_verified) · المفقود unavailable/unknown/not_verified لا clean/ready/implemented. **No new field outside SSOT Group 41 · no migrations/SQL/tables · no scripts/launcher/runtime · no commands · no raw keys/secrets · no execution authority · no EV gate/Hard Risk/Risk Gates/SignerService change · rebuild projections لا يغيّر source-of-truth · no API/CONFIG/UX/Test/Build here.**
