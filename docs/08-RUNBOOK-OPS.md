# Runbook / Ops

> **Priority:** 08 — Implementation · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** التشغيل اليومي · الجاهزية · الطوارئ · الاسترداد

**الحالة:** معتمدة / موسّعة بعد v1.8 Delta + F-Elimination + Waves 1–5 — الأقسام 0–14 مكتملة ومراجعة. §10 أُعيد تأطيره كهامش ضبط تشغيلي (لا قرارات معلّقة)؛ §12 إجراءات v1.8؛ §13 إجراءات F-Elimination (F1–F14 + provider/Opportunity/charts/maintenance + [F] cleanup) فوق SSOT Groups 22–36 دون كود؛ **§14 Waves 1–5 Runbook Alignment (تشغيل/سياسة فقط، تستهلك ARCH §15.9–§15.13 + SSOT Groups 37–41، Cross-Document Audit PASS لكل موجة) دون كود/أوامر جديدة.**

**مبني على:** الوثائق المقبولة لهذه الموجة: 00 · 01 · 02 · 03 · 04 · 05 · 06 · 07 · 09. يشغّل القرارات المقبولة ولا يعيد تعريف fields/API/commands/config. **يستهلك Build (06) وTest (07) وSecurity (09) ويحوّلها إلى إجراءات تشغيل، لا يعيد تعريفها.**

---

## 0. Runbook/Ops Preflight — Operate, Don't Redecide (محسوم)

08 **تشغّل النظام المبنيّ، لا تعيد تقرير قراراته.**

| النوع | المالك | دور Runbook |
|---|---|---|
| السلوك/العقد/الأمان/البناء | **00–07 + 09** (لا يُعاد فتحه) | Runbook **يشغّله** |
| إجراءات التشغيل/الطوارئ/الاسترداد | **08 وحده** | كيف نشغّل، نراقب، نوقف، نسترد |

**قاعدة:** 08 يفترض البناء قائماً. لا يضيف حقول SSOT ولا يغيّر API/Data Model/Security/Test. أي اسم في إجراء مأخوذ من SSOT. **Runbook لا يحوّل blockers إلى warnings.**

> **نتيجة preflight:** 08 يجمع هامش الضبط التشغيلي (TTLs رقمية · vendor KMS كخيار تشغيلي · K8s · monitoring/alerting · incident response)، لكنه **لا يقرّر سلوكاً أو أمناً جديداً** — يطبّق ما حُسم في 00–07+09.

---

## 1. Scope & Ownership (النطاق والملكية)

**08 يملك (حصراً):**
- `إجراءات التشغيل اليومية` · `startup/shutdown` · `تشغيل الخدمات ومراقبة الصحة`.
- `observability/metrics/alerts` · `REAL-LIVE activation runbook` · `emergency stop/kill switch procedure`.
- `incident response` · `rotation/sweep operational procedures`.
- `backup/restore/reconciliation` · `deployment and recovery procedures`.

**08 لا يملك:**
- `إعادة تعريف المعمارية` (00) · `إضافة حقول SSOT بلا بوّابة` (01) · `تغيير API` (03) · `تغيير Data Model` (05) · `تغيير Security model` (09) · `تغيير Test Plan` (07) · `تنفيذ كود`.

**القاعدة الحاكمة:**
> 08 يشغّل 00–07+09. لا يعيد فتحها. كل اسم في إجراء من SSOT؛ Runbook منفّذ تشغيلي لا مصدر قرار. blockers تبقى block.

**Always-on Exit Manager (عملية إدارة الخروج الدائمة) — تحصين تشغيلي للمشغّل المنفرد:** عملية منفصلة وظيفتها **الوحيدة** احترام TP/SL/trailing/time-exit/emergency-exit للمراكز المفتوحة، تبقى حيّة حتى لو تعطّل/قُتِل محرّك الدخول. **حدودها:** لا authority للدخول · تخضع كاملاً لـ SignerService المعزول/Hard Risk/position ownership/Exit Feasibility/route health/Audit («always-on» ليست bypass، §5.3) · تحترم `EXITS_ONLY`/`KILLED` القائمتين · **heartbeat watchdog + paging/alerting** عند توقّف محرّك الدخول/فشل heartbeat/تعذّر خروج مركز مفتوح/kill ليلي. **لا حالة تشغيل ولا اسم SSOT جديد** — توقّع معماري-تشغيلي (BUILD §8.2).

**قرارات تأجيل البنية التحتية (Infrastructure Deferral — قرار محوكم بعتبات، لا «مؤجّل» منتج غامض):** هذه قرارات *بنية تحتية* (لا قدرات منتج)، تبقى خارج النطاق الحالي وتُعاد فقط عند تحقّق مؤشرات اقتصادية/تشغيلية مُسجَّلة:
- **لا ShredStream decoder الآن** — البنية على LaserStream/Yellowstone المُدارة؛ يُعاد التقييم فقط إذا أثبتت السجلّات أن فرق ~100–150ms كان سيحوّل نصيباً ذا دلالة من الفرص المفوّتة إلى Net Business PnL موجب (بالدولار قبل أي بناء).
- **لا self-hosted validator / swQoS peering الآن** — swQoS عبر Helius Sender المُدار بلا credits؛ يُعاد التقييم فقط عند اجتماع: managed infra spend مرتفع ماديّاً **و** ربح إجمالي مستدام **و** بلوغ سقوف rate/latency فعلية.
- **لا co-location** — بلا قيمة لنسخ تفاعلي؛ يُعاد التقييم فقط عند إضافة استراتيجيات same-slot.
- **مبدأ:** عتبات إعادة-تقييم مُسجَّلة، لا التزام بناء.

---

## 2. Operational Readiness Model (نموذج الجاهزية التشغيلية)

**حالات التشغيل (operating_state، SSOT G1):** `WARMING_UP` · `ACTIVE` · `EXITS_ONLY` · `PAUSED` · `KILLED`. Runbook يشغّل الانتقالات المصرّح بها، لا يخترع حالات.

**الجاهزية متدرّجة (تطابق MVP §6 وBuild §4):**
- **Foundations up:** PostgreSQL/ClickHouse/Redis + audit write path + health endpoints تعمل.
- **Paper ready:** Stream/Decision/Risk/Execution(paper) تعمل دون توقيع/إرسال.
- **Execution wallet ready:** admission gate يعمل؛ محفظة واحدة `ACTIVE` على الأقل.
- **REAL-LIVE ready:** **الشرطان معاً** — `real_live_config_valid=true` **و** REAL-LIVE Security Readiness Checklist (09 §7) = pass.

**القاعدة الحاكمة للـ REAL-LIVE:** أي فشل في audit أو signer أو KMS أو Hard Risk → **REAL-LIVE BLOCKED** (لا warning). Runbook يعرض قائمة blockers من البوّابة الفاشلة، لا يلتفّ عليها.

> **TTLs والقيم الرقمية التشغيلية:** Runbook هو المكان الطبيعي لتحديد القيم الرقمية التشغيلية (approval freshness TTL · cache TTLs · `profit_sweep_interval_ms` · heartbeat) — لكن **ضمن القواعد المحسومة** (الموافقة البائتة تُرفَض، الـ cache البائت يُرفَض)؛ الرقم ضبط تشغيلي، القاعدة محسومة في 09/05. **أي TTL رقمي يُضاف يجب أن يكون قابلاً للاختبار في 07، ويُعامَل تجاوزه كرفض لا warning** عندما يتعلّق بـ approval freshness أو quote/fee/tip أو cache safety.

---

## 3. Daily Operations / Startup & Shutdown (التشغيل اليومي · الإقلاع والإيقاف)

### Startup (ترتيب آمن، يطابق Build §4)
1. Foundations: PostgreSQL/ClickHouse/Redis + audit write path. **إذا فشل audit write path، لا يبدأ Risk/Execution/Signer في أي وضع live-like؛ التشغيل يبقى diagnostic/paper-read-only حتى يعود audit** (Audit شرط قبل الحُرّاس، لا مجرّد مراقبة).
2. SignerService (معزول) — يبدأ دون مفاتيح حيّة في dev/test؛ KMS/vault في live. **تشغيله هنا = بدء العملية فقط، لا السماح بالتوقيع؛ يبقى non-signing حتى اكتمال Risk Gates + KMS/vault readiness + execution wallet admission + Security Readiness. أي signing قبل اكتمال هذه البوّابات = incident.**
3. Risk Gates.
4. Execution Adapter (paper أولاً).
5. Stream Ingestion → Decision Engine.
6. Management API → Dashboard.
7. التحقّق من الصحّة قبل أي تفعيل: provider streams · slot lag · `protocol_constant_status`.

### Shutdown (آمن)
- إيقاف الدخول الجديد أولاً عبر الحالة المناسبة: `disable_new_adds` (منع إضافات/دخول لمحفظة أو مسار محدّد) · `EXITS_ONLY` (السماح بالخروج ومنع الدخول) · `PAUSED` (إيقاف أوسع حسب السياسة). **لا يُستخدم أيٌّ منها كأمر بيع قسري بحدّ ذاته.**
- SignerService: zeroization عند الإيقاف (09 §4).
- لا إيقاف قسري يترك intents معلّقة دون تسجيل Audit.

### Health monitoring (يومي)
- مراقبة `provider_degraded` · `slot_lag` · `last_confirmed_slot` · `protocol_constant_status`.
- عند stream gap أو slot lag → `EXITS_ONLY` حسب السياسة (لا دخول على حالة بائتة).
- عند `protocol_constant_status=changed` أو تغيّر بروتوكولي حرج → **تصعيد إلى المسار الأمني الأعلى حسب ARCHITECTURE، وقد يصل إلى `KILLED` لا `EXITS_ONLY` فقط** (لا تسطيح للحالات الحرجة).
- مراقبة جاهزية SignerService/KMS؛ `signer_profile_status=DEGRADED` → غير موقّع، تنبيه.

> **مبدأ §3:** الإقلاع يتبع ترتيب البناء الأمني (الحُرّاس قبل التنفيذ)، والإيقاف يحمي المراكز والـ intents وAudit. لا تفعيل قبل تأكيد الصحّة. التشغيل اليومي يراقب إشارات الـ safety ويحترم `EXITS_ONLY` تلقائياً عند تدهور المصدر.

---

## 4. REAL-LIVE Activation Runbook (إجراء تفعيل التنفيذ الحيّ)

إجراء تشغيل لتفعيل REAL-LIVE، لا قرار جديد. يطبّق بوّابة 07 §6 وSecurity 09 §7.

### 4.1 Pre-activation Prerequisites
- Document 09 مكتمل · Document 07 gates تمرّ · audit write path متاح · KMS/vault ready · `signer_profile_status=ACTIVE` · `execution_wallet_status=ACTIVE` · provider health مقبول.

### 4.2 Readiness Verification Sequence
- تحقّق `real_live_config_valid=true`.
- تحقّق REAL-LIVE Security Readiness Checklist (09 §7) = pass.
- تحقّق لا blockers نشطة (09 §7).
- تحقّق paper-to-real gate (07 §6) = pass.
- **قبل activation النهائي مباشرةً:** يُعاد تشغيل signer dry-run وpaper-to-real gate check للتأكّد أن payload binding وapproval freshness وaudit path ما زالت صالحة. أي stale approval أو payload mismatch أو audit failure يمنع activation (readiness قد تتغيّر بين الفحص والتفعيل).

### 4.3 Operator Confirmation
- المشغّل يرى readiness result وقائمة blockers.
- الأفعال الحسّاسة تتطلّب `signer_control` (منفصل عن admin).
- **التأكيد لا يتجاوز أي blocker** (تأكيد المشغّل ليس override).

### 4.4 Activation Attempt and Audit
- محاولة التفعيل نفسها تُسجَّل في `audit_log` (`audit_actor`/`permission_role`/النتيجة pass-block/قائمة blockers).
- لا تفعيل صامت — كل محاولة مُدقّقة.

### 4.5 Blocked Activation Handling
- أي blocker → **REAL-LIVE BLOCKED**.
- لا override بتغيير `execution_mode` ولا بتأكيد المشغّل وحده.
- أسباب الـ blocker تُعرَض من البوّابة الفاشلة (لا «فشل عام»).
- **قائمة blockers actionable:** كل blocker يعرض مصدره ونوعه والإجراء التشغيلي المطلوب أو الوثيقة المرجعية (لا رسالة عامة).
- **محاولة activation المرفوضة لا تغيّر `execution_mode` إلى live، ولا تترك config/runtime state يوحي بأن النظام حيّ؛ تبقى الحالة السابقة سارية حتى اجتياز البوّابة كاملة.**
- **rollback عند فشل جزئي:** إذا فشلت محاولة التفعيل بعد بدء الانتقال، يُرجَع إلى آخر حالة آمنة معروفة (`PAUSED` أو `EXITS_ONLY` حسب نوع الفشل) مع تسجيل audit؛ **لا يبقى النظام في حالة نصف مفعّلة (half-live)**.

### 4.6 Post-activation Monitoring
- مراقبة KMS/signer/audit/provider/`slot_lag` باستمرار.
- **أي تدهور في KMS/signer/audit/Hard Risk/provider health لا يكتفي بتنبيه بصري؛ يُنتج انتقالاً تشغيلياً مناسباً (`EXITS_ONLY`/`PAUSED`/`KILLED`) حسب السياسة، مع audit** (Runbook لا يحوّل blockers إلى notifications).
- protocol changed قد يصل `KILLED`.
- إذا صارت readiness غير صالحة (signer DEGRADED، KMS فشل، audit انقطع) → لا دخول جديد، وتصعيد حسب الخطورة.

> **مبدأ §4:** تفعيل REAL-LIVE إجراء مُدقّق ذو بوّابة مزدوجة (config + security)، لا toggle. المشغّل ينفّذ بعد اجتياز البوّابات، لا يتجاوزها. وبعد التفعيل، المراقبة مستمرّة: أي تدهور في حارس يعيد النظام إلى وضع آمن تلقائياً (Fail Safe Not Fail Open).

---

## 5. Emergency Stop / Kill Switch Procedure (إجراء الإيقاف الطارئ)

تشغيل الإيقاف الطارئ، لا إعادة تعريف Kill Switch (محسوم في ARCHITECTURE §10/§15).

### 5.1 Trigger Conditions
- Hard Risk breach · `protocol_constant_status=changed`/critical protocol drift · اشتباه اختراق KMS/signer · audit write path غير متاح في live · stream corruption/severe lag · محاولة توقيع غير مصرّح بها.

### 5.2 Immediate Actions
**Severity mapping (يمنع الاجتهاد وقت الطوارئ):**
- provider stream gap / moderate slot lag → `EXITS_ONLY` غالباً + منع الدخول الجديد.
- audit write path unavailable في live-like → `PAUSED`/`KILLED` حسب الأثر، لا توقيع جديد.
- `protocol_constant_status=changed`/protocol drift حرج → تصعيد أعلى، قد يصل `KILLED`.
- اشتباه اختراق KMS/signer → تعطيل التوقيع فوراً + `PAUSED`/`KILLED` حسب النطاق.
- unauthorized signing attempt → incident عالي الخطورة، تعطيل signer المعني، audit، قد يصل `KILLED`.

**الإجراءات:**
- إيقاف الدخول الجديد فوراً.
- الانتقال إلى `EXITS_ONLY`/`PAUSED`/`KILLED` حسب الشدّة.
- **إذا كان الـ trigger مرتبطاً بـ KMS/SignerService/signing anomaly، فأوّل إجراء هو منع التوقيع الجديد قبل أي recovery أو diagnosis — لا يُترَك signer `ACTIVE` أثناء التحقيق.**
- حفظ Audit وstate snapshots.

### 5.3 What Remains Allowed
- في `EXITS_ONLY`: exits/emergency exits حسب السياسة.
- في `PAUSED`: لا دخول جديد؛ عمليات محدودة.
- في `KILLED`: emergency exit فقط حسب ARCHITECTURE، واستئناف إنساني فقط.
- **Emergency exit لا يتجاوز الملكية أو Hard Risk أو audit:** لا بيع من execution wallet لا تملك الأصل، ولا توقيع بلا intent/audit حتى في الطوارئ («emergency» ليست bypass للضوابط الأساسية).
- **Evidence preservation:** عند incident أمني تُحفظ snapshots تشغيلية (intents/positions/audit/provider state/signer status) **دون حفظ أسرار أو payloads حساسة أو private material** — الهدف forensic/reconciliation لا نسخ secrets.
- **سلوك الخروج أثناء migration-limbo (prestaging):** بين اكتمال الـ bonding curve وتهيئة الـ PumpSwap pool **لا route صالح**. القواعد: لا افتراض route (`route_health` unhealthy حتى إثبات route فعلي) · لا panic/blind retry على route غائب · نيّة الخروج/الـ mirror-sell تبقى **pending/pre-staged** (تتّسق `MIRROR_SELL_PENDING`/`EXIT_PENDING`)، لا تُلغى إلا بإعداد المستخدم/محرّك الخطر · **الإطلاق فور تهيئة الـ pool** ومرور route/exit-feasibility/slippage · أثناء limbo: migration-aware monitoring / `EXITS_ONLY` حسب السياسة. **لا enum/حالة جديدة.**

### 5.4 Audit Requirements
- كل trigger/action/result يُسجَّل في `audit_log`.
- **لا silent kill switch.**
- `audit_actor`/`permission_role`/reason/state transition تُسجَّل.

### 5.5 Recovery from KILLED / PAUSED
- **لا عودة من `KILLED` تلقائياً.**
- recovery يحتاج operator review.
- blockers يجب أن تختفي.
- **REAL-LIVE activation gate (§4) يُعاد كاملاً قبل الرجوع للحيّ.**
- **operator review وحده لا يكفي:** العودة من `KILLED`/`PAUSED` إلى live تتطلّب إعادة اجتياز §4 كاملاً (بما فيه `real_live_config_valid=true` وSecurity Readiness pass) — «أنا موافق» لا يتجاوز البوّابة.

### 5.6 Operator Communication
- إشعار المشغّل بالحالة والسبب والإجراء المطلوب.
- قائمة actionable (مصدر/نوع/إجراء) كما في §4.5.
- لا رسائل غامضة عن حالة طارئة.

> **مبدأ §5:** الإيقاف الطارئ يفضّل الأمان على الاستمرارية دائماً (Fail Safe Not Fail Open). الانتقال للحالة الأشدّ حسب الخطورة، كل شيء مُدقّق، لا kill صامت، ولا عودة تلقائية من `KILLED` — الرجوع للحيّ يمرّ بالبوّابة الكاملة من جديد.

---

## 6. Rotation / Sweep Operational Procedures (إجراءات التدوير والكنس)

تشغّل طبقة execution wallet المحسومة (§4.3 · API §12 · Data Model §4)، لا تعيد تعريفها. كلٌّ مُدقّق.

### 6.1 Execution Wallet Rotation
- لا تبدأ rotation إلا بمحفظة destination مؤهّلة أو `WARMING_UP` ضمن admission.
- **`WARMING_UP` للتحضير/admission أثناء rotation فقط: لا تُستخدم للدخول الجديد، ولا تصبح destination trading wallet، ولا تُحوَّل إليها الملكية التشغيلية إلا بعد أن تصبح `ACTIVE` وتكتمل admission؛ أي transfer يؤثّر على `position_owner_wallet_id` يبقى مشروطاً بـ `asset_transfer_status=CONFIRMED`.**
- لا استخدام لمحفظة `REVOKED` أو غير `ACTIVE` للدخول الجديد.
- `DRAINING` لا يدخل جديداً لكنه قد يخرج/ينقل/يكنس حسب السياسة.
- `wallet_rotation_status`: `PENDING → IN_PROGRESS → COMPLETED`؛ كل خطوة audit.

### 6.2 Asset Transfer Operation
- `source_execution_wallet_id`/`destination_execution_wallet_id` واضحان.
- **`position_owner_wallet_id` لا يتغيّر إلا عند `asset_transfer_status=CONFIRMED`.**
- transfer failure (`FAILED`) لا يغيّر `position_owner_wallet_id`.

### 6.3 Profit Sweep Operation
- sweep إلى `settlement_wallet_id` **لا يجعل vault يتداول**.
- sweep **لا يغيّر config الوجهة**؛ تغيير وجهة التسوية/التمويل يتمّ عبر مسار Config/API المعتمد لا عبر عملية sweep (API §12.5 · ARCHITECTURE §4.3).
- `auto_immediate`/`manual`/`periodic` تخضع للسياسة المعتمدة (`profit_sweep_interval_ms` للـ periodic).

### 6.4 DRAINING / Retirement Flow
- `DRAINING` يمنع الدخول الجديد، يسمح بالخروج/settlement/sweep المصرّح.
- لا يُعامَل كـ `ACTIVE` للدخول.
- الانتقال إلى `RETIRED` بعد إخلاء الأصول.

### 6.5 Failure Handling
- failed transfer/rotation/sweep يبقى مُدقّقاً.
- لا ownership change عند failed transfer.
- **لا half-rotated wallet state** — التدوير الفاشل يعود لحالة معروفة (القديمة تبقى مالكة حتى CONFIRMED).

### 6.6 Audit / Reconciliation
- كل rotation/transfer/sweep يُسجَّل في `audit_log`.
- reconciliation يتحقّق من: owner wallet · balances · intents · sweep events (PostgreSQL يفوز عند التعارض).

> **مبدأ §6:** إجراءات التدوير/الكنس تشغيلية فوق طبقة محسومة. الثوابت: الملكية تنتقل عند CONFIRMED فقط · vault لا يتداول · sweep لا يغيّر الوجهة · DRAINING للخروج لا الدخول · لا حالة نصف مدوّرة · كل شيء audit. الفشل يعود لحالة آمنة معروفة، لا غموض.

---

## 7. Incident Response Procedures (إجراءات الاستجابة للحوادث)

تحوّل الحالات الأمنية/التشغيلية إلى خطوات استجابة، لا تعيد تعريف الحوادث.

### 7.1 Incident Classification
- **Security:** signing anomaly · اشتباه key/signer/KMS · unauthorized signing request.
- **Data:** تباعد PostgreSQL/ClickHouse/Redis · audit unavailable · terminal intent inconsistency.
- **Provider:** stream gap · severe slot lag · `provider_degraded`.
- **Protocol:** `protocol_constant_status=changed`.
- **Operator:** سوء استخدام صلاحية · محاولة تفعيل live غير مصرّح بها.

**Operational state mapping (يربط بخريطة §5.2):**
- Security (signer/KMS/signing) → `PAUSED`/`KILLED` حسب النطاق + تعطيل التوقيع أولاً.
- Data (audit unavailable / PostgreSQL authority uncertainty) → `PAUSED`/diagnostic حتى استعادة السلطة.
- Provider (gap/severe lag) → `EXITS_ONLY` غالباً حتى المصالحة.
- Protocol (`protocol_constant_status=changed`) → تصعيد قد يصل `KILLED`.
- Operator (unauthorized live activation/signing-sensitive) → `PAUSED`/`KILLED` حسب الخطورة + audit + مراجعة صلاحيات.

### 7.2 Initial Containment
- إيقاف الدخول الجديد.
- الانتقال إلى `EXITS_ONLY`/`PAUSED`/`KILLED` حسب severity (خريطة §5.2).
- **تعطيل التوقيع أولاً إن كان signer/KMS متورّطاً.**
- حفظ audit/state snapshots بلا أسرار.

### 7.3 Diagnosis / Evidence
- جمع `audit_log` · intents · positions · provider state · signer status.
- **لا private key/seed/signer material في حزمة الأدلّة.**
- PostgreSQL يبقى السلطة في reconciliation.
- **في الحوادث الحرجة، لا تبدأ recovery mutation أو projection rebuild قبل حفظ snapshot كافٍ (audit/intents/positions/provider/signer)، إلا إذا كان التأخير يزيد الخطر؛ أي تجاوز يُسجَّل في audit مع السبب** (إعادة البناء السريعة قد تمحو آثار السبب الجذري).

### 7.4 Service-specific Response
- **Signer/KMS:** تعطيل التوقيع، revoke/disable signer profile عند الحاجة.
- **Provider:** `EXITS_ONLY`، stream reconciliation، cursor rebuild.
- **Data:** PostgreSQL سلطة، إعادة بناء ClickHouse/Redis projections. **إعادة البناء لا تغيّر PostgreSQL authority ولا تُعدّل `positions`/`intents`/`audit_log` إلا عبر مسار تصحيح معتمد ومُدقّق** (لا يتحوّل rebuild إلى تعديل حقيقة).
- **Protocol:** تصعيد إلى `KILLED` إن تغيّرت الثوابت تغيّراً حرجاً.
- **Operator:** تُراجَع صلاحيات `permission_role` و`signer_control`، وتُعطَّل/تُدوَّر صلاحيات الوصول عند الحاجة (لا تُغلَق الحادثة دون مراجعة فصل admin/signer_control).

### 7.5 Communication / Escalation
- ملخّص الحادثة actionable: source · severity · الخدمة المتأثّرة · blocker · الإجراء المطلوب.
- لا رسالة فشل عامة.
- فصل `signer_control`/admin يبقى مفروضاً.

### 7.6 Recovery / Post-incident Review
- **لا recovery إلى REAL-LIVE دون بوّابة §4 كاملة.**
- blockers يجب أن تُزال.
- اختبارات/بوّابات 07 ذات الصلة يجب أن تمرّ.
- post-incident review يسجّل root cause وregression test إن لزم.
- **إغلاق الحادثة ≠ جاهزية REAL-LIVE:** بعد الإغلاق يُعاد §4 activation gate و07 tests ذات الصلة قبل الرجوع للحيّ.

> **مبدأ §7:** الاستجابة للحوادث تطبّق نفس مبادئ النظام تحت الضغط: containment أولاً (الأمان قبل الاستمرارية) · evidence بلا أسرار · PostgreSQL سلطة · لا عودة للحيّ دون البوّابة الكاملة · كل شيء actionable ومُدقّق. الحادثة تُغلق بـ root cause وحارس انحدار يمنع تكرارها.

---

## 8. Backup / Restore / Reconciliation (النسخ والاسترداد والمصالحة)

يغطّي الاسترداد والمصالحة دون تغيير Data Model (يطبّق قواعد مصدر الحقيقة §3 Doc 05).

### 8.1 Backup Scope
- PostgreSQL authoritative: `config_versions` · `wallet_registry` · `execution_wallets` · `signer_profiles` · `positions` · `intents` · `audit_log`.
- **`signer_profiles` backup = metadata/status/references فقط؛ لا private keys ولا seeds ولا signing material مفكوك ولا KMS plaintext ولا secret-vault export** (منع التباس profile metadata بالسرّ الفعلي).
- **لا secrets في backup** (لا key/seed/signer material).
- ClickHouse/Redis يُعاد بناؤهما من المصادر حسب الحالة (projections لا backup حرج).
- **تفريق authority/readiness:** استعادة PostgreSQL مطلوبة للسلطة؛ إعادة بناء ClickHouse/Redis مطلوبة للجاهزية التحليلية/hot-path. إن كانت projections مفقودة/بائتة، يبقى النظام diagnostic/paper-read-only، **ولا يدخل REAL-LIVE حتى تصبح الـ projections/caches المطلوبة سليمة**.

### 8.2 Restore Order
- PostgreSQL أولاً.
- **`audit_log` integrity check:** التحقّق من append-only continuity وترتيب `event_timestamp` حيثما ينطبق وغياب truncation/deletion غير مصرّح بها. **أي فشل في سلامة Audit يحجب الاسترداد الحيّ** (Audit ليس جدولاً عادياً؛ قصّه = فقدان قابلية التحقيق).
- اتّساق `config_versions`/`positions`/`intents`.
- بعدها projections: ClickHouse ثم Redis/RAM.
- **اختبار الاسترداد (restore drill) شرط:** لا يُعدّ backup صالحاً تشغيلياً حتى ينجح restore drill يتحقّق من استعادة PostgreSQL وسلامة `audit_log` واتّساق config/positions/intents وإعادة بناء projections — **دون تفعيل REAL-LIVE** (backup غير مختبر قد يكون وهماً).

### 8.3 Reconciliation Sources
- PostgreSQL authority.
- on-chain observations للتحقّق من ownership/balances (تحقّق تشغيلي/on-chain، لا API field جديد).
- provider streams للمصالحة.
- **ClickHouse/Redis لا يفوزان على PostgreSQL.**

### 8.4 Projection Rebuild
- إعادة بناء ClickHouse/Redis **لا تغيّر الحقيقة**.
- stale cache يُرفَض.
- `stream_cursors` تُصالَح مع `provider_stream_state`.

### 8.5 Wallet / Ownership Reconciliation
- `position_owner_wallet_id` يطابق confirmed asset transfer/on-chain ownership.
- لا بيع من wallet لا تملك الأصل.
- failed transfer لا يغيّر الملكية.
- **on-chain reconciliation قد يكشف عدم تطابق، لكنه لا يُعدّل `positions`/`intents`/ownership صامتاً؛ أي تصحيح يمرّ عبر مسار تصحيح معتمد ومُدقّق** (on-chain للتحقّق لا bypass لتعديل الحقيقة).

### 8.6 Post-restore Gates
- بعد restore، النظام **لا يعود إلى REAL-LIVE تلقائياً**.
- **أي بيئة مُستعادة تبدأ non-live** (`PAUSED`/diagnostic/paper)؛ الخدمات المُستعادة **لا تستأنف `ACTIVE`/REAL-LIVE تلقائياً من الحالة المحفوظة**.
- إعادة §4 activation gate كاملة قبل live.

> **مبدأ §8:** الاسترداد يحترم مصدر الحقيقة — PostgreSQL يُستعاد أولاً وهو السلطة، الـ projections تُعاد بناؤها لا تُستعاد كحقيقة، والملكية تُصالَح مع on-chain/CONFIRMED. لا عودة للحيّ بعد restore دون البوّابة الكاملة (§4) — استرداد ≠ جاهزية حيّة.

---

## 9. Observability / Metrics / Alerts (المراقبة والمقاييس والتنبيهات)

يحدّد ما يُراقَب ويُنبَّه عليه، دون API fields جديدة أو vendor. الإشارات بأسماء SSOT.

### 9.1 Health Signals
- service health · audit write path · PostgreSQL/ClickHouse/Redis health · SignerService health · provider health.
- **الإشارات العامة (service/database health) operational signals، لا SSOT fields جديدة؛ إذا تحوّلت أيٌّ منها إلى API response field ثابت لاحقاً، تمرّ عبر SSOT أولاً.**

### 9.2 Safety / Risk Alerts
- Hard Risk breach · missing Hard Risk config · `real_live_config_valid=false`.
- **`warning_only` لا يخفّض تنبيهات Hard Risk** (يبقى critical).

### 9.3 Signer / KMS Alerts
- `signer_profile_status != ACTIVE` · KMS/vault degraded · unauthorized signing request · signing attempt بلا audit · payload mismatch/stale approval.

### 9.4 Data Authority Alerts
- تباعد PostgreSQL/ClickHouse/Redis · `audit_log` integrity issue · stale `derived_readiness_cache` · terminal intent inconsistency.

### 9.5 Stream / Provider Alerts
- `provider_degraded` · `slot_lag` · stream gap · `protocol_constant_status=changed`.

### 9.6 Execution Wallet / Rotation Alerts
- `execution_wallet_status` ليس `ACTIVE` حين يلزم · محفظة `DRAINING` مختارة لدخول جديد · failed transfer/rotation/sweep · ownership mismatch.
- **ownership mismatch يمنع أي sell/exit من execution wallet لا تملك الأصل حتى تكتمل المصالحة أو التصحيح المُدقّق** (من أخطر تنبيهات طبقة Execution Wallet).

### 9.7 Alert Severity and Operational Action
- **INFO:** visibility فقط.
- **WARNING:** انتباه المشغّل، لا safety bypass.
- **CRITICAL:** انتقال تشغيلي (`EXITS_ONLY`/`PAUSED`/`KILLED`) حسب السياسة.
- **أي تنبيه critical لـ signer/KMS/audit/Hard Risk لا يُعامَل كـ visual-only** — ينتج انتقالاً تشغيلياً (لا notification فقط).
- **metrics/alerts لا تصبح مصدر حقيقة:** PostgreSQL يبقى سلطة الحالة/المحاسبة/Audit؛ أي metric يعارض PostgreSQL أو Security/Config readiness لا يغيّر القرار، بل يفتح incident/reconciliation.
- **أي انتقال ناتج عن alert حرج يُسجَّل في `audit_log`** (source/severity/action/result) — لا transition صامتة بسبب alert.
- **acknowledge/silence لا يساوي override:** لا يزيل blocker ولا يسمح بـ REAL-LIVE؛ إزالة blocker تحتاج معالجة السبب واجتياز البوّابة ذات الصلة.

> **مبدأ §9:** المراقبة امتداد لمبدأ Fail Safe — التنبيه الأمني الحرج **ينتج فعلاً تشغيلياً لا مجرّد إشعار**. الإشارات بأسماء SSOT، والـ severity مربوط بانتقال حالة، و`warning_only` لا يخفّض الأمان. لا تنبيه أمني حرج يبقى بصرياً.

---

## 10. Operational Tuning Latitude (هامش الضبط التشغيلي — القواعد محسومة)

يجمع قيم الضبط التشغيلي (أرقام/vendor) في مكان واحد — **القاعدة محسومة في 00–07/09، والمشغّل يضبط الرقم/الـ vendor فقط ضمن تلك القاعدة، لا قرار feature معلّق**. ليست هذه عناصر F-Elimination (تلك حُسمت candidate/rejected)، بل هامش تشغيلي تقني.

### 10.1 Numeric TTLs and Thresholds
- **Operator-set (tunable, ضمن قاعدة محسومة):** approval freshness TTL · quote/fee/tip cache TTL · curve/pool cache TTL · heartbeat interval · alert thresholds · `profit_sweep_interval_ms`.
- **Rule:** الأرقام تشغيلية، لكن القاعدة محسومة — stale = reject لا warning عند التوقيع/EV/cache safety. أي رقم يُضاف قابل للاختبار في 07.

### 10.2 KMS / Secret-vault Vendor
- **Operator-set (tunable, ضمن قاعدة محسومة):** AWS KMS · GCP KMS · HashiCorp Vault · HSM · غيرها.
- **Rule:** اختيار vendor لا يغيّر Security model — لا plaintext secrets · least privilege · revoke · no live key in `.env` · SignerService boundary.

### 10.3 Kubernetes / Orchestration
- **Operator-set (tunable, ضمن قاعدة محسومة):** K8s ليس في MVP؛ Linux + Docker Compose هو runtime production-like الأول.
- **Rule:** إضافة K8s لاحقاً لا تغيّر service boundaries ولا SignerService isolation ولا source-of-truth rules.

### 10.4 Observability / Alerting Vendor
- **Operator-set (tunable, ضمن قاعدة محسومة):** Prometheus/Grafana/PagerDuty/SIEM أو غيرها.
- **Rule:** vendor لا يغيّر alert semantics — CRITICAL safety/security alerts تنتج انتقالاً تشغيلياً لا visual-only.

### 10.5 Backup Retention / RPO / RTO
- **Operator-set (tunable, ضمن قاعدة محسومة):** retention schedule · RPO/RTO numeric targets · backup storage vendor.
- **Rule:** backup غير مختبر لا يُعدّ صالحاً · restore يبدأ non-live · no secrets in backups.

### 10.6 Incident Tooling and Escalation
- **Operator-set (tunable, ضمن قاعدة محسومة):** ticketing system · incident templates · escalation contacts · forensic tooling.
- **Rule:** incident semantics محسومة في §7 — containment first · evidence بلا أسرار · no live recovery without §4 gate.

### 10.7 Closure Rule for Tuning Values
أي قيمة ضبط تشغيلي تُحدَّد لاحقاً يجب أن:
1. لا يكسر 00–07 أو 09.
2. لا يضيف field ثابت بلا SSOT.
3. يكون قابلاً للاختبار في 07 إن أثّر على safety/security/readiness.
4. لا يحوّل blocker إلى warning.

> **مبدأ §10:** كل قيمة هنا **رقم أو vendor، لا قاعدة**. القواعد الأمنية والسلوكية ومصادر الحقيقة محسومة في 00–07/09 ولا تُفتَح. الضبط التشغيلي ضمن حدود ثابتة — وأي قيمة تُحدَّد لاحقاً تمرّ بقاعدة الإغلاق (§10.7): لا تكسر المغلق، لا تضيف اسماً بلا بوّابة، قابلة للاختبار، ولا تحوّل blocker إلى warning. **هذا هامش تشغيلي تقني، وليس feature معلّقاً (F-Elimination حسمت كل feature إلى candidate أو rejected/forbidden).**

---

## 11. New-Coin Hunting / Opportunity Operations (v1.8)

> يشغّل قرارات موجة New-Coin Hunting المقبولة — **لا حقل/أمر/مورد/رمز/عتبة جديد**. يحيل لإجراءات الحوادث (§7) والتنبيهات (§9) القائمة **دون تعديل جدول §9 ولا إضافة alert enum**.

### 11.1 Opportunity / Radar interpretation
- حالات `hunt_status`: `discovered` · `ranked` · `gated` · `accepted` · `entered` · `watch_only` · `expired` · `rejected`.
- **قواعد:** `accepted` ليست إشارة شراء · ترتيب الرادار ليس موافقة تنفيذ · `new_token_priority_score` عرض/ترتيب فقط · لا شراء من mint discovery · لا DexScreener-only execution · `resource_type=opportunity` read-only.
- **توضيح `accepted` تشغيلياً:** `accepted` = اجتازت فرصة التقييم، لكنها **ليست إذن شراء ولا زر تنفيذ**. إن لم تتحوّل إلى `entered` عبر المسار الآمن، يتعامل المشغّل معها كفرصة مراقبة/تشخيص ويفحص Allowed Now/البوّابات، **لا ينفّذ يدوياً**.

### 11.2 Decision Trace reason handling
- `rejected_reason`: `dex_only_signal` · `ev_negative` · `route_invalid` · `exit_feasibility_fail` · `token2022_dangerous_extension` · `hard_risk_block` · `slippage_vs_leader_exceeded` · `same_cluster_not_independent` · `hunt_window_expired` · `liquidity_share_exceeded`.
- **إرشاد:** لا تجاوز يدوي للبوّابات · watch-only ليست قابلة للتنفيذ · افحص اللوحة/المصدر · عدّل Config **فقط عبر تدفّق الإعداد المعتمد** عند اللزوم · لا تحوير مباشر للأسباب/الحالة.

### 11.3 Token Risk diagnostics
- `recycled_token_flag` · `name_impersonation_score` · `creator_launch_rate_flag` · `token_readiness_score`.
- **قواعد:** diagnostic/read-only · لا تحرير يدوي · ليست موافقة تنفيذ · ليست حاجزاً صلباً ما لم يرقّها Config/Test لاحقاً · عند الاشتباه اترك watch-only/reject واجمع report/export.

### 11.4 Wallet Copyability / tracked wallet ops
- `tracked_wallet_status`: `candidate` · `watch_only` · `copy_allowed` · `degraded` · `banned`.
- **قواعد:** منفصل عن `follow_enabled` وعن `execution_wallet_status` · `banned` = تقييم سياسة متابعة لا حظر محفظة تنفيذ · تغيير نية المتابعة/per-wallet config **فقط عبر تدفّق wallet/config المعتمد** · **لا إغلاق مراكز قائمة لمجرّد تغيّر حالة المحفظة المتبوعة** ما لم تُطلِق سياسة الخروج القائمة ذلك.

### 11.4a Edge Health Advisory response (Gap D — استجابة بشرية، advisory فقط)
استجابة المشغّل عند `candidate_edge_health_status ∈ {weakening, no_edge_suspected, insufficient_evidence}` (SSOT Group 26 · ARCH §7 Edge Health). **الإجراء يدوي/بشري وadvisory فقط — لا فعل تلقائي من الـ runbook.**
- **1) افحص الإشارات المصدر (read-only):** `candidate_paper_real_divergence_status` · `candidate_adverse_selection_severity` · `candidate_net_business_pnl`/`_status` · `candidate_leader_vs_copier_delta` · `entry_slippage_vs_leader` · `candidate_failed_attempt_cost` · `candidate_wallet_drift_signal`/`_reason` · `candidate_copyability_component_veto`/`_reason` · `tracked_wallet_status` · حالة كفاية الدليل/العيّنة (`minimum_sample_size`/`candidate_paper_settings_evidence_status`).
- **2) صنّف السبب:** تدهور مؤقّت · دليل غير كافٍ · no-edge محتمل · مشكلة data-quality/provider · انحراف سلوك المحفظة.
- **3) راجع التوصية القائمة إن توفّرت** (`candidate_wallet_drift_recommendation`/`candidate_recommendation_type`): require_review · reduce_size · pause_follow · switch_to_watch_only · keep_following.
- **4) أي فعل يختاره المشغّل يمرّ عبر تدفّقات user/config/permission/audit القائمة** (recommendation → preview → validation → permission → audit) — لا تجاوز بوابات.
- **5) `weakening`:** قد يوصى بمراجعة وحجم متحفّظ **عبر التدفّقات القائمة فقط**.
- **6) `no_edge_suspected`:** قد يوصى بالتحويل إلى watch-only أو إيقاف المتابعة **عبر تدفّق wallet/config القائم فقط** — تحذير استشاري لا أمر.
- **7) `insufficient_evidence`:** يوصى بجمع مزيد من الدليل / مراقبة paper-only / مراجعة watch-only — **لا يُعامَل كآمن**.
- **قواعد ثابتة (wording):** Edge Health **advisory** · `no_edge_suspected` **ليس أمر تنفيذ** · `insufficient_evidence` **ليست صفر مخاطر** · أداء Paper **ليس ميزة Real** · أي فعل **بموافقة المشغّل ومُدقَّق عبر التدفّقات القائمة** · **لا إغلاق مراكز قائمة تلقائياً بهذه الحالة** · **لا تغيير config تلقائياً بهذه الحالة** · لا auto-ban/auto-disable · لا forced live blocker · لا silent action.

### 11.5 Latency diagnostics
- `discovery_latency_ms` · `signal_to_execution_ms` · `latency_to_copy` · `entry_slippage_vs_leader`.
- **قواعد:** diagnostic/read-only · `entry_slippage_vs_leader` قياس محقّق والعتبة `max_entry_slippage_vs_leader` · الكمون العالي → **تحقيق stream/provider لا override تنفيذ** · لا تفسير P&L محلي.

### 11.6 Opportunity stream stale/gap handling
- اكتشف فقدان/تقادم `opportunity_update` · علّم العرض stale/delayed · resync/backfill · قارن مع مصدر الحقيقة PostgreSQL · لا تنفيذ من cache/stream بائت.
- **فجوة opportunity feed وحدها لا تُطلِق EXITS_ONLY** · خرق replay/نافذة/مزوّد حرج على مستوى السلسلة يبقى محكوماً بإجراء EXITS_ONLY القائم (§5/§7).
- **لا alert enum جديد في هذه الدلتا ولا تعديل لجدول تنبيهات §9** (إحالة للنموذج القائم عند اللزوم).

### 11.7 Read-only API mutation attempts
- `READ_ONLY_FIELD_REJECTED` على حقول الفرص (محاولة تعديل `hunt_status`/الأسباب/الدرجات/الأعلام/الكمون/`copyability_by_brain`).
- **إرشاد:** عامِله كسوء استخدام عميل/مشغّل أو bug · راجع audit/observability · أصلح UI/client workflow · **لا تضف bypass**.

### 11.8 Blocked execution attempts
- شراء من mint discovery · تنفيذ من `accepted` · DexScreener-only execution · `buy_opportunity`/`execute_opportunity`/`submit_opportunity` غير المسجّلة · batch exit ذرّي غير مسجّل · تحديث funding/settlement من onboarding عبر أمر غير مسجّل.
- **سلوك الخطأ القائم فقط:** `COMMAND_NOT_ALLOWED_IN_STATE` أو سلوك أمر/إعداد غير معروف/غير صالح · **لا رمز خطأ جديد**.

### 11.9 Reports / exports
- الأسماء القديمة غير المسبوقة لـ P&L و`current_price` **مرفوضة (rejected)**؛ الأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` **forbidden**. القدرات المُرقّاة (P&L/price/trade_event/wallet-token/balances/sweep/alerts/reports…) تظهر في التقارير **فقط** بأسمائها `candidate_*` من backend/data read-model **ولا تُربط بـ Opportunity/Radar**. التصدير يحجب الأسرار · لا اختلاق مقاييس مفقودة (show_unavailable/omit/block_report) · القيم الناقصة تُعرض unavailable لا تُختلق.

### 11.10 Operator checklist (حوادث الفرص v1.8)
- أكّد `hunt_status` → افحص `accepted_reason`/`rejected_reason` → افحص Token Risk → افحص Wallet Copyability → افحص الكمون → افحص نضارة الـ stream → افحص بوّابة Config إن لزم → **لا تجاوز read-only/البوّابات** → صدّر report عند اللزوم → **صعّد فقط عند شرط سلسلة/مزوّد/أمان**.

> **مبدأ §11:** Runbook يشغّل قرارات v1.8 المقبولة فقط — لا حقل/أمر/مورد/رمز/عتبة Config جديد. `accepted` ليست إذن شراء؛ الرادار/الترتيب عرض لا موافقة؛ watch-only غير قابلة للتنفيذ؛ diagnostics read-only غير حاجبة بذاتها؛ فجوة opportunity feed لا تُطلِق EXITS_ONLY؛ لا تجاوز يدوي؛ لا ادّعاء أن stop loss يضمن الخروج؛ لا كشف أسرار.

---

## 12. v1.8 Delta — Operational Procedures (candidate)

> إجراءات تشغيل تستهلك SSOT Groups 22–27. لا كود، لا live. كل اسم `candidate_*`.

### 12.1 Single-Provider Failure
- في `candidate_provider_mode = single`: عند فشل المزوّد الوحيد، ينتقل النظام تلقائياً إلى `EXITS_ONLY` (آلة الحالات §10 القائمة) مع تنبيه blind-spot. الإجراء: تأكيد الانتقال → معالجة المصدر/المفتاح → فحص اتصال (`test_provider_connection` عبر `key_ref`) → عودة مُتحكَّم بها. توصية تشغيلية دائمة: إضافة مزوّد ثانٍ.

### 12.2 Provider Key Flow (Ops)
- المفاتيح تُدخَل مرة واحدة في secret store؛ بعدها **`candidate_provider_key_ref` فقط**. **يُمنع ظهور raw key في logs/reports/diagnostic bundles/backups/exports.** أي تسريب = حادث أمني (§7 + 09-THREAT §9).

### 12.3 Maintenance Commands (admin/local-ops only)
- `candidate_cmd_restart_service`: **محظور** أثناء pending intents حرجة أو active signing — يُنتظر التصفية الآمنة (§3 safe shutdown) أولاً.
- `candidate_cmd_backup`: **بلا مفاتيح خام/أسرار** (يُعاد استخدام §8.1).
- `candidate_cmd_purge_data`: **لا يحذف audit المالي** (append-only/terminal retention)؛ يتطلّب تأكيداً.
- `candidate_cmd_export_diagnostic_bundle`: **بلا أسرار** (redaction، §7.3).
- كلها **ليست أوامر operator عادية**.

### 12.4 Retention / Storage (القيم التشغيلية)
- `candidate_retention_profile` الافتراضي: **30d** (raw events) · **90d/180d** (summaries) · `custom` بإذن admin. raw events تُحذف مع حفظ summaries؛ audit مالي مستثنى.
- **Storage sizing policy:** تقدير شهري متوقّع للحجم (events/fills/traces) يُراقَب عبر `candidate_storage_usage_metric`؛ تجاوز العتبة → تنبيه + مراجعة profile.

### 12.5 App Update / Incident Screen
- **Update procedure:** إيقاف آمن (لا intents معلّقة) → نسخة احتياطية → ترقية → migration status → readiness checklist (§4) → استئناف. لا live إلا بعد readiness كاملة.
- **Incident screen:** يعرض الحوادث المفتوحة + blockers + آخر الإجراءات؛ يربط بـ §7. عرض `candidate_app_version`/`config_version`.

---

## 13. F-Elimination — Operational Procedures (candidate, تستهلك SSOT Groups 22–36)

> إجراءات تشغيل/incident/diagnostics/backup/purge على مستوى التوثيق — لا API contracts · لا DB schema · لا UX · لا test cases · لا code/migrations/live. المُرقّى = إجراءات candidate؛ المرفوض = rejected/forbidden تشغيلياً. لا «pending/later/مؤجل» مفتوحة.

### 13.1 P&L ops (F1)
P&L يُعرض/يُستخدم فقط من backend/data read-model (`candidate_realized_pnl`/`candidate_unrealized_pnl`/`candidate_fees_total`/`candidate_slippage_cost`/`candidate_paper_pnl`/`candidate_pnl_by_wallet`/`candidate_pnl_by_copy_mode`/`candidate_pnl_by_brain`/`candidate_remaining_daily_loss_budget`) — **لا حساب UX/يدوي كحقيقة**؛ unrealized موثوق فقط عند `candidate_mark_status=valid` (وإلا warning/unavailable)؛ **لا P&L على Opportunity/Radar**؛ legacy aliases rejected. سجلّات P&L التاريخية finalized لا تُعدَّل — أي إعادة احتساب = report/artifact منفصل بـ provenance/generated_at.

### 13.2 Price / Mark ops (F2)
لا «current price» مجهول — استخدم `candidate_current_mark_view` كعرض؛ كل سعر تشغيلي يحمل provenance/timestamp/status/confidence؛ display-only لا يُتّخذ به قرار تنفيذ؛ AMM troubleshooting بـ quote-impact/liquidity-drain/expected-slippage لا order-book إلا بمصدر order-book فعلي. `candidate_current_price` مرفوض.

### 13.3 Trade Event / Journal ops (F3)
عند التحقيق في صفقة: **trade journal = ماذا حدث للصفقة · audit = من فعل ماذا/متى/لماذا** — لا تُخلط؛ بلا أسرار؛ **event gaps تظهر كتشخيص لا تُغطّى**؛ يخدم replay/debug/reports.

### 13.4 Wallet-Token Performance ops (F4)
Smart Money ranking لا يعتمد `candidate_wt_net_result` وحده؛ `candidate_wt_cost_completeness_status` (complete/partial/estimated/unavailable) يحدّد الاكتمال؛ **لا blind ranking بنتيجة ناقصة**؛ point-in-time/survivorship-free يُتحقَّق منه في التقارير.

### 13.5 Discovery Signals ops (F5)
early-buyer/cluster/repeat إشارات تحليلية **لا authorization**؛ cluster احتمالي؛ low-confidence ليس حقيقة؛ التحقيق يعرض confidence/method/provenance.

### 13.6 Balances / Sweep ops (F6)
`mismatch` يحجب الكنس؛ **لا كنس من غير مالك**؛ تأكيد الكنس مطلوب؛ `auto_sweep` افتراضياً false؛ سجلّ الكنس append-only/auditable؛ **لا raw key في diagnostics/backups/exports**؛ provenance/reconciliation تظهر في الحوادث.

### 13.7 Token Identity ops (F7)
mint/address canonical؛ symbol/name display/untrusted؛ `spoof_suspected` → warning؛ **لا تنفيذ بناءً على symbol/name**.

### 13.8 Leader Attribution ops (F8)
الإسناد يدعم analysis/debug/reports **لا يمنح تنفيذاً**؛ التعارض/تعدّد القادة يُعرَض لا يُطوى صامتاً؛ confidence/provenance مطلوبة.

### 13.9 Batch Exit ops (F9)
`exit_all_positions`/`batch_exit_all_positions` **forbidden دائماً**؛ المشغّل يستخدم batch exit المتحكَّم فقط: **preview → request → نوايا per-position**؛ preview حديث وصالح إلزامي؛ expired/stale → preview جديد؛ حالة per-position تُعرَض؛ **لا mass exit صامت**؛ كل مركز يمرّ ownership/route/exit-feasibility/risk/signer/audit؛ طوارئ batch exit تبقى permissioned ومُدقَّقة.

### 13.10 Alerts ops (F10)
severity (info/warning/critical) · category (security/risk/provider/data/ops/execution/wallet)؛ **security+critical لا تُسكت**؛ ack لا يحذف/يخفي الحدث؛ التفضيلات لا تكتم الإلزامي؛ الحوادث تذكر alert source/category/severity.

### 13.11 Reports / Exports ops (F11)
صيغ markdown/csv/parquet/jsonl؛ artifacts بـ provenance/generated_at؛ missing-metric ∈ {show_unavailable/omit/block_report}؛ لا اختلاق؛ strict redaction افتراضياً؛ **لا أسرار/raw provider keys/private keys/seeds/signer credentials/partial secrets في reports/exports/logs/diagnostics/backups**؛ **purge يحفظ السجلّات الحرجة للـ audit/المالية/trade-event**.

### 13.12 Preferences / Glossary / Onboarding ops (F12/F13/F14)
التفضيلات UI/user state لا تعدّل strategy/risk/live/signer؛ المسرد يربط SSOT ولا يعيد تعريفه؛ onboarding حالة/مراجع فقط — **لا raw provider key/private key/seed/signer credential/partial secret**، لا تجاوز readiness gates، ولا أوامر wallet/config خارج SSOT/API.

### 13.13 Provider Key Flow ops (F15)
raw provider key عبر secret registration flow الآمن فقط؛ بعده العمليات تستخدم `candidate_provider_key_ref`؛ **لا طباعة raw key في logs/reports/diagnostics/backups/exports**؛ test connection عبر key_ref؛ حوادث المزوّد تشير إلى provider id/key_ref/status لا raw key.

### 13.14 Opportunity / Radar ops guard (F16)
Opportunity/Radar read-only/read-oriented؛ **لا P&L · `accepted` ليست buy · `new_token_priority_score` ترتيب/عرض · لا buy/execute/submit · لا ربط ضمني Opportunity→تنفيذ · DexScreener-only ليست موافقة تنفيذ**.

### 13.15 Charts ops (F17)
troubleshooting بمخرجات مكتبة احترافية؛ OHLCV display-only يعرض provenance؛ AMM بـ quote-impact/liquidity-drain/expected-slippage حيث لا order-book؛ overlays من trade-event/journal + fills/exits + attribution + mark/price provenance.

### 13.16 Maintenance / Backup / Purge / Diagnostics
diagnostic bundles تحجب الأسرار؛ backups بلا raw keys/seeds/private keys/signer credentials؛ **purge يحفظ السجلّات الحرجة (audit/مالية/trade-event)**؛ restart محجوب أثناء توقيع نشط أو نوايا حرجة معلّقة؛ أوامر الصيانة الخطرة admin/local-ops only؛ export diagnostic bundle لا يتضمّن raw provider keys.

### 13.17 Legacy [F] Cleanup (تشغيلياً)
لا عنصر F سابق يبقى «pending»؛ المُرقّى = قدرات candidate تشغيلية (§13.1–§13.15)؛ المرفوض = Rejected/Forbidden: legacy P&L aliases · `current_price`/`candidate_current_price` · الأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` · `buy_opportunity`/`execute_opportunity`/`submit_opportunity`. لا صياغة later/مؤجل/pending مفتوحة.

---

## 14. Waves 1–5 Runbook Alignment (محاذاة تشغيلية، تستهلك ARCH §15.9–§15.13 + SSOT Groups 37–41)

> **محاذاة تشغيل/سياسة فقط — لا commands فعلية جديدة · لا code/runtime/migrations/SQL/scripts/launcher · لا live/testnet/mainnet · لا حقول/enums/config defaults جديدة.** Waves 1–5 (Profit & Paper Truth · Discovery & Copy Safety · Reports & Honesty · Execution/Providers+Data · Local Ops & Readiness) اكتملت **Cross-Document Audit PASS** لكل موجة كحزمة **توثيقية بحتة**. Runbook **يشغّل** ما حُسم في 00–07+09 ولا يعيد تعريفه؛ هذا القسم يثبّت كيف تُقرأ أسطح Wave 5 تشغيلياً.

**14.1 Local Ops & Readiness (Wave 5) تشغيلياً.** أسطح Local Run / Local Ops Health / Operator Logs / Version-Migration / Upgrade-Rollback / Maintenance Policy / Implementation-Status هي **observability/operator guidance/status read-only فقط** (تطابق §3 health monitoring + §7 incident + §8 backup/restore القائمة). **لا تحوّل Runbook إلى commands جديدة.** أي إجراء صيانة مستقبلي يبقى عبر النموذج المحسوم: **permissioned · audited · previewed where risky · blocked when unsafe · non-authoritative over source-of-truth** (تطابق §12.3 maintenance commands admin/local-ops only القائمة، لا أوامر إضافية).

**14.2 ثوابت القراءة التشغيلية (لا تتغيّر).** `candidate_local_run_workflow_status=ready_for_local_use` = **Local use only لا REAL-LIVE ready** · local app running ليس trading readiness · `candidate_local_ops_service_status=healthy` ليس execution-safe · SignerService `healthy`/`signer_profile_status` ليس permission to sign (التوقيع يبقى محكوماً بـ §2/§3/§4 + Risk Gates) · provider connectivity `healthy` ليس trading readiness · `candidate_version_compatibility_status=compatible` شرط مسبق لا execution authority · `candidate_implementation_status=documented_only`/`candidate` ليس implemented · `candidate_status_verification_state=unknown/not_verified` وأي `unavailable` ليست clean/ready/implemented (تطابق §2 readiness الفاشل = BLOCKED لا warning).

**14.3 الصيانة الآمنة (Wave 5 ↔ §3/§12 القائمة).** `candidate_safe_shutdown_status` يحترم pending intents / active signing / critical jobs (تطابق §3 safe shutdown + §12.3) — **لا إيقاف يترك intents معلّقة دون Audit** · backup/export **بلا raw secrets** (تطابق §8.1 + §12.2/§12.3) · restore لا يكسر audit/history/config · clear_cache لا يحذف source-of-truth · rebuild/reindex projections **لا يغيّر سلطة PostgreSQL** (PostgreSQL تبقى مصدر الحقيقة؛ ClickHouse/Redis projections) · Operator Logs تُخفي الأسرار و`candidate_operator_log_redaction_status=blocked_contains_secret` يحجب العرض/التصدير/نشر artifact (تطابق §7.3 redaction).

**14.4 ما لا يتغيّر.** **لا تغيير EV gate / Hard Risk / Risk Gates / SignerService** بسبب أي إشارة Local Ops/health/version/log/status · لا execution authority من أي منها · REAL-LIVE يبقى محكوماً بـ §2/§4 + 09 §7 (readiness/signer/Hard-Risk/security gates) · blockers تبقى block لا warnings.

> **مبدأ §14:** Wave 5 Local Ops تشغيلياً = مراقبة/إرشاد/حالة read-only تُكمّل §3/§7/§8/§12 القائمة، لا أوامر/قرارات جديدة. health green/local running/upgrade pass/version compatible ليست trading readiness ولا execution authority؛ documented_only/candidate ليست implemented؛ المفقود unavailable/unknown/not_verified لا clean/ready؛ الصيانة آمنة افتراضياً ومُدقَّقة وغير سلطوية على source-of-truth. **لا code/commands/migrations/live · لا تغيير 00–07 · لا تغيير الحُرّاس · لا Wave 6+.**

---

## 15. Live Testnet RPC Spike Approval Runbook

> **operator prose / سياسة تشغيل فقط — لا حقول/enums/config/API/SSOT جديدة · لا code/commands/scripts/launcher · لا live/testnet/mainnet يُشغَّل هنا.** هذا القسم يصف **بوّابة موافقة** (approval gate) لـ RPC spike مستقبلي على testnet. البوّابة نفسها (`packages/rpc-provider-contract` — `describeLiveRpcSpikeApprovalGateContract` / `validateLiveRpcSpikeApprovalGate` / `evaluateLiveRpcSpikeApprovalGate`) **contract/test-only** تتحقّق من **شكل سجلّ الموافقة** فقط ولا تمنح أي سلطة تنفيذ حيّة. سجلّ «موافَق عليه» يُنتج `approval_record_valid=true`/`approval_gate_passed=true` لكنّ `live_rpc_authorized=false` وكل أعلام القدرة/الحيّ false، و`requires_separate_live_spike_pr=true` ثابتة — أي **لا يأذن بشيء حيّ**.

النقاط الإلزامية الخمس عشرة (fail-closed، غير قابلة للتخفيف):

1. **F-13/F-14 لا تنفّذان أي RPC حيّ.** هما طبقة contract/boundary/approval-gate تتحقّق من الشكل فقط؛ لا resolution / network / send / serialize / SDK / env / secret.
2. **أي RPC spike حيّ لاحق يتطلّب PR منفصلاً + موافقة منفصلة** صريحة؛ سجلّ الموافقة هنا لا يكفي ولا يبدأ شيئاً.
3. **الـ spike الحيّ على testnet/devnet/localnet فقط** — لا بيئة أخرى.
4. **mainnet ممنوع** في هذا المسار مطلقاً.
5. **broadcast/send ممنوعان** — الـ spike لا يبثّ ولا يرسل أي معاملة.
6. **endpoint خام ممنوع داخل الـ repo** — لا URL/مزوّد حيّ في الكود/الوثائق/الإعداد.
7. **endpoint / API key / secret خارج الـ repo فقط** (out-of-repo binding) — لا يُخزَّن داخل المستودع.
8. **أي SDK/dependency يتطلّب مراجعة supply-chain + lockfile** في PR منفصل قبل أي استخدام.
9. **أي network call يتطلّب موافقة صريحة** في PR منفصل.
10. **أي نتيجة من spike حيّ لا تفتح send** — اجتياز الـ spike ليس إذناً بالإرسال/البثّ.
11. **أي انتقال إلى testnet broadcast يتطلّب PR منفصلاً.**
12. **أي REAL-LIVE/mainnet يتطلّب حوكمة منفصلة** (readiness/signer/Hard-Risk/security gates في 06-BUILD §6 + 09 §7) — **لا عبر هذا المسار.**
13. **بعد الـ spike يجب توثيق revoke/disable أو cleanup** للمرجع/التجربة (post-spike revoke-or-disable).
14. **وضع الفشل fail-closed** — عند الشكّ/الغموض ترفض البوّابة (لا fail-open، لا تنفيذ).
15. **endpoint/secret/raw provider config لا يُخزَّن في الـ repo إطلاقاً** — حتّى في backups/exports/diagnostics/logs.

> **مبدأ §15:** بوّابة موافقة الـ RPC spike contract/test-only؛ سجلّ موافَق عليه لا يمنح سلطة حيّة، ويبقى مطلوباً PR منفصل + out-of-repo endpoint binding + supply-chain review قبل أي spike. لا تغيير EV gate / Hard Risk / Risk Gates / SignerService، ولا حقول/أوامر/SSOT جديدة في هذا القسم.
