# Test Plan

> **Priority:** 07 — Implementation · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** طبقات الاختبار وبوّابات القبول ومعايير REAL-LIVE

**الحالة:** معتمدة / موسّعة بعد v1.8 Delta + F-Elimination + Waves 1–5 — الأقسام 0–15 مكتملة ومراجعة. §8 أُعيد تأطيره كحُرّاس المرفوض الدائم (F-Elimination)؛ §9 negative/acceptance لدلتا v1.8؛ §10 اختبارات F-Elimination (F1–F14 + provider/Opportunity/charts + cross-document + [F] cleanup) فوق SSOT Groups 22–36؛ §11 يستهلك SSOT Group 37 / Wave 1، و§12 يستهلك SSOT Group 38 / Wave 2، و§13 يستهلك SSOT Group 39 / Wave 3، و§14 يستهلك SSOT Group 40 / Wave 4، و§15 يستهلك SSOT Group 41 / Wave 5. كل إضافات Waves 1–5 تبقى candidate AC/regression، ولا تمنح execution authority ولا تضيف commands/runtime ولا تغيّر EV gate أو Hard Risk أو Risk Gates أو SignerService.

**مبني على:** الوثائق 00–06 + 09 المغلقة. **يتحقّق من السلوك والعقود والحُرّاس المقرَّرة، لا يعيد تعريفها.**

---

## 0. Test Plan Preflight — Verify, Don't Redecide (محسوم)

07 **يتحقّق من القرارات المغلقة، لا يعيد تقريرها.**

| النوع | المالك | دور الاختبار |
|---|---|---|
| السلوك/العقد/الاسم/الأمان | **00–06 + 09** (لا يُعاد فتحه) | الاختبار **يتحقّق** من تطبيقه |
| طبقات/بوّابات/معايير الاختبار | **07 وحده** | كيف نتحقّق، ما معيار القبول |

**قاعدة:** 07 لا يضيف حقول SSOT ولا يغيّر API/Data Model/سلوك. أي اسم في اختبار مأخوذ من SSOT. الاختبار يكشف انحرافاً عن القرار المغلق، لا يخترع قراراً.

> **نتيجة preflight:** صار اختبار البوّابات ذا معنى بعد إغلاق 09 — Risk Gates · config validity · execution wallet admission · SignerService readiness · KMS readiness · payload binding · approval freshness · Audit path · موانع REAL-LIVE كلها محدّدة وقابلة للاختبار. **موجة New-Coin Hunting (v1.8) + F-Elimination:** تُضاف §3 صفوف بوّابات + §4.12–§4.16 + §7.7 + §8 (حُرّاس المرفوض الدائم) + §10 (اختبارات F-Elimination) للتحقّق من مفردات SSOT Groups 16–36 وقدرات UX §12–§26 — دون إضافة حقول/أوامر.

---

## 1. Scope & Ownership (النطاق والملكية)

**07 يملك (حصراً):**
- `test layers` · `acceptance gates` · `regression suites`.
- `safety/fail-safe tests` · `API contract tests` · `config validation tests`.
- `Data Model source-of-truth tests` · `signer/security readiness tests`.
- `paper-to-real gate tests` · `REAL-LIVE block/pass criteria`.

**07 لا يملك:**
- `إعادة تعريف السلوك` (00) · `إضافة حقول SSOT` (01) · `تغيير API` (03) · `تغيير Data Model` (05) · `تشغيل فعلي` · `runbook incident response` (08).

**القاعدة الحاكمة:**
> 07 يتحقّق من 00–06+09. لا يعيد فتحها. كل اسم في اختبار من SSOT؛ الاختبار حارس الامتثال لا مصدر قرار.

---

## 2. Test Layers & Strategy (طبقات الاختبار والاستراتيجية)

طبقات متدرّجة من الوحدة إلى البوّابة النهائية:

**L1 — Unit:** منطق معزول (EV calc، state transitions، حسابات per-wallet) بأسماء SSOT.

**L2 — Contract:** عقود API (Doc 03) — request/response schemas · `command_type`/`resource_type`/`api_error_code` · idempotency · cursor pagination · permissions. التحقّق أن كل اسم من SSOT (No field before SSOT regression).

**L3 — Integration:** تكامل الخدمات (Build §3) — Stream→Decision→Risk→Execution(paper)→Storage · Event Bus · مصادر الحقيقة (PostgreSQL يفوز).

**L4 — Behavior:** السلوك المقرَّر — العقلان A/B · مصفوفة قرارات النسخ (§4.2) · migration handoff (§4.1) · EV gates · partial sells.

**L5 — Safety/Fail-Safe:** الحُرّاس — Hard Risk لا يُتجاوز · Fail Safe Not Fail Open · EXITS_ONLY triggers · kill switch · admission gate · SignerService readiness (09 §7).

**L6 — Gate/Acceptance:** البوّابات النهائية — paper-to-real · `real_live_config_valid` · REAL-LIVE Security Readiness (09 §7) · موانع REAL-LIVE.

> **استراتيجية:** L1–L4 تتحقّق من الصحّة الوظيفية؛ L5–L6 تتحقّق من **الأمان وعدم القابلية للتجاوز**. الأولوية للأخيرة: نظام يحسب صحيحاً لكن يمكن تجاوز حارسه = فشل. paper قبل real في كل طبقة.

---

## 3. Gate Test Matrix (مصفوفة اختبار البوّابات)

البوّابات الحرجة ومعيار اجتيازها (كلٌّ يتحقّق من قرار مغلق):

| البوّابة | المصدر | معيار الاجتياز (pass) | الفشل (fail → block) |
|---|---|---|---|
| Hard Risk enforcement | ARCHITECTURE §5/§10 · SSOT Group 6 | كل تجاوز للحدّ الكلّي مرفوض؛ per-wallet لا يتجاوز account-level | أي صفقة تتجاوز Hard Risk |
| warning_only ≠ disable | CONFIG §6/§7 · ARCHITECTURE §5 | `ev_gate_mode=warning_only` لا يعطّل loss caps (Hard Risk يبقى) | تعطيل حدّ خسارة بحجّة warning |
| missing Hard Risk = invalid | CONFIG · ARCHITECTURE §15.1 | غياب Hard Risk → `real_live_config_valid=false` | اعتبار الغياب «بلا حدّ» |
| No field before SSOT | SSOT (كل المجموعات) | كل field/command/resource في API مسجّل في SSOT | اسم خارج SSOT |
| connected_wallet not autonomous | ARCHITECTURE §4.3 · SECURITY §2 | `connected_wallet` يُرفَض في الـ hot path الآلي | استخدامه للآلي الحيّ |
| no signing without intent_id | SECURITY §3 | طلب توقيع بلا `intent_id` مرفوض | توقيع ad-hoc |
| payload binding | SECURITY §3 | payload ≠ Risk-approved/OrderBuilder → رفض | توقيع payload مستبدَل |
| approval freshness | SECURITY §3 | موافقة Risk بائتة → رفض | توقيع على موافقة منتهية |
| signer not ACTIVE → no sign | SECURITY §3–4 · API §12.2 | `DEGRADED`/`DISABLED`/`REVOKED` لا يوقّع | توقيع من signer غير ACTIVE |
| execution_wallet admission gate | ARCHITECTURE §4.3 · API §12.1 · SSOT Group 15 | لا `ACTIVE` إلا بعد funded + signer reachable + limits/config valid + key custody verified + not revoked | active-by-update أو بلا admission checks |
| WARMING_UP → no sign | ARCHITECTURE §4.3 · API §12.1 | محفظة `WARMING_UP` لا توقّع/تدخل | تنفيذ قبل admission |
| owner change only at CONFIRMED | ARCHITECTURE §4.3 · API §12.3 | `position_owner_wallet_id` يتغيّر فقط عند `asset_transfer_status=CONFIRMED` | بيع من غير مالك |
| config frozen, safety immediate | CONFIG · ARCHITECTURE §15.1 | مركز مفتوح يستمر على `config_version_at_entry`، لكن تشديد أمان/Hard Risk يطبّق فوراً | تغيير strategy يمسّ مركزاً مفتوحاً، أو تشديد أمان لا يطبّق فوراً |
| PostgreSQL wins | DATA MODEL §3/§6 | عند تعارض، PostgreSQL يفوز؛ ClickHouse/Redis يُعاد بناؤه | اعتماد ClickHouse/Redis كحقيقة |
| Redis cache no authorize | DATA MODEL §5.4/§7.7 | eligibility cache بائت لا يوقّع/يخوّل | توقيع بناءً على cache |
| paper: same order, no sign/no send | BUILD §4/§6 · ARCHITECTURE paper/live | paper يبني نفس order object ويمرّ بـ validation/Risk، لكن لا SignerService ولا توقيع/إرسال | paper يستدعي SignerService أو يرسل معاملة |
| Audit before/after signing | SECURITY §3 | كل توقيع مُسجَّل قبل/بعد | مسار توقيع صامت |
| REAL-LIVE blockers | SECURITY §7 | أي blocker نشط → REAL-LIVE BLOCKED | تنفيذ حيّ مع blocker نشط |
| REAL-LIVE combined readiness | SSOT Group 10 · CONFIG validation rules · API derived outputs · SECURITY §7 | REAL-LIVE يُسمح **فقط** إذا `real_live_config_valid=true` **و** Security Readiness Checklist = pass | فشل أحدهما → REAL-LIVE BLOCKED |
| discovery ≠ execution | ARCH §4.4 · SSOT G16 | mint مكتشَف وحده لا ينشئ تنفيذاً؛ الدخول wallet/cluster-led أو signal-confirmed | شراء من مجرّد ظهور mint |
| dex-only not approval | ARCH §4.4 · SSOT G17 | DexScreener وحدها → `rejected_reason=dex_only_signal`/watch_only | اعتبار dex-only موافقة تنفيذ |
| priority ranks only | SSOT G16 | `new_token_priority_score` يرتّب/يعرض فقط، لا EV ولا موافقة | استخدامه كإذن/درجة شراء |
| hunt_status pre-position | SSOT G16 | لا يحمل قيم `position_state`/`operating_state`؛ `entered`→`position_state=OPENING` | تداخل قيم أو تنفيذ من `accepted` |
| max_liquidity_share_pct ≠ Hard Risk | CONFIG §5/§11 · SSOT G19 | يخفض الحجم/يرفض حسب policy؛ غيابه لا يؤثّر `real_live_config_valid` | إدراجه في Group 6 أو حجب REAL-LIVE بغيابه |
| stop_loss_pct via Exit Feasibility | CONFIG §5 · SSOT G21 | يطلق exit عبر Position Manager/Exit Feasibility/route؛ ليس Hard Risk | اعتباره Hard Risk أو خروجاً مضموناً في سيولة رقيقة |
| derived-scale never silent pass | CONFIG §10 · SSOT G16/G18/G19 | عتبة على مقياس مجهول → reject/watch-only/warning | pass صامت عند scale مجهول |
| batch exit per-position safety | UX §14 · أوامر الخروج القائمة | جماعي = تكرار أوامر فردية، كل مركز عبر Exit Feasibility/state/route/permission بنتيجة مستقلّة | أمر خروج جماعي ذرّي أو تجاوز فحص مركز |
| derived/runtime/decision read-only | SSOT (derived) · UX | تحرير `hunt_status`/`*_reason`/الدرجات/الأعلام/`tracked_wallet_status`/الكمون → `READ_ONLY_FIELD_REJECTED` | كتابة على حقل derived |
| onboarding no wallet-update invention | UX §24 · SSOT G15 · API commands | onboarding يعرض `funding_wallet_id`/`funding_wallet_address`/`settlement_wallet_address` أو يوجّه لمسارات wallet/config قائمة فقط | اختراع/استدعاء أمر غير مسجّل (`update_funding_wallet`/`update_settlement_wallet`) أو أي wallet-update من الـ wizard |
| no rejected name as real field | §8 · §10 | لا اسم مرفوض دائماً (legacy P&L · current_price · atomic batch exit · buy/execute/submit) كحقل API/SSOT/Data أو command/resource (راجع §8) | تنفيذ اسم مرفوض كحقل/أمر حقيقي |

> **مبدأ §3:** كل صفّ اختبار أمني/سلامة هو **حارس عدم تجاوز**، لا مجرّد تحقّق وظيفي. الفشل = block لا warning (Fail Safe Not Fail Open). المصفوفة تجمع موانع SECURITY §7 + قواعد Hard Risk + مصادر الحقيقة في بوّابة اختبار واحدة قبل أي REAL-LIVE.

> **قاعدة positive + negative:** كل بوّابة في المصفوفة تحتاج **اختبارين على الأقل**: (1) positive/control يثبت أن المسار الصحيح يمرّ؛ (2) negative/adversarial يثبت أن التجاوز يُرفَض. **اختبار pass وحده غير كافٍ للبوّابات الأمنية** — قوّتها تثبت باختبارات الرفض.

---

## 4. Behavior Test Specs (مواصفات اختبار السلوك)

اختبار السلوك المقرَّر (ARCHITECTURE §4–§4.3)، لا البنية التقنية. كل سيناريو زوج صريح **positive + negative**، بقيم `migration_phase`/`copy_event`/`conflict_resolution` المعتمدة في SSOT.

### 4.1 Brain A / Bonding Curve
- positive: Brain A يتصرّف فقط حين `migration_phase` ضمن مراحل ما قبل handoff (`PRE_MIGRATION`/`MIGRATION_APPROACHING`).
- negative: Brain A لا يصدر قرارات دخول بعد `LP_MINTED`/`POST_MIGRATION_ACTIVE` أو بعد انتقال `current_control_brain` إلى Brain B.

### 4.2 Brain B / PumpSwap / Open Market
- positive: Brain B يتحكّم بعد `LP_MINTED`/`POST_MIGRATION_ACTIVE` ووجود canonical pool.
- negative: Brain B لا يدخل قبل اكتمال شروط handoff.

### 4.3 Migration Handoff
- positive: `complete=true` + ظهور الـ pool القانوني → تسليم لـ Brain B؛ التنفيذ عبر `current_control_brain`.
- positive: أثناء `MIGRATION_IN_PROGRESS` (limbo)، `EXITS_ONLY` يسمح بالخروج إذا كان `active_exit_route` صالحاً.
- negative: limbo → لا دخول جديد ولا scale-in.
- negative: mirror sell لا يُلغى بسبب limbo — ينتظر route صالحاً أو يُدار كـ exit pending (`leader_exit_migration_limbo`).

### 4.4 current_control_brain (Mixed Events)
- positive: leader exit أو partial sell أثناء الانتقال → التنفيذ عبر `current_control_brain` فقط.
- negative: Brain A وBrain B لا يصدران exit متضارباً لنفس المركز.

### 4.5 Copy Event Decision Matrix (§4.2)
- positive: `full_mirror` ينسخ خروج الـ leader (`leader_full_exit`).
- negative: `full_mirror` لا يبقى في المركز بعد خروج leader كامل إلا إذا غُيّر `copy_mode` صراحةً خارج هذا النمط (ليس toggle عادياً).
- negative: `follow_entry_user_exit` لا يخرج لمجرّد خروج الـ leader (يحتفظ).
- positive: في `follow_entry_user_exit`، الخروج يبقى قرار المستخدم/سياسات خروج النظام، لا mirror مباشر لخروج leader (لا «لا منطق خروج إطلاقاً»).
- positive: `transfer_cex_like` → `HIGH_EXIT_RISK` flag → تشديد الخروج/منع adds.
- negative: لا خلط بين classification flag (`HIGH_EXIT_RISK`) وقيمة `copy_event`.

### 4.6 Scale-in / Rebuy
- positive: في `full_mirror`، scale-in (`leader_scale_in`) يمرّ فقط ضمن `scale_in_policy` وحدود Hard Risk.
- positive: في `follow_entry_user_exit`، scale-in لا يحدث إلا إذا `copy_adds_enabled=true` والسياسة تسمح، مع احترام Hard Risk.
- negative: لا scale-in إذا `copy_adds_enabled` غير مفعّل.
- negative: لا scale-in يتجاوز `max_position_size_pct`/`max_token_exposure_pct`/Hard Risk.
- negative: `leader_rebuy` يخضع لـ `rebuy_cooldown` ولا يستعيد الحجم القديم تلقائياً.

### 4.7 Partial Sell / Cumulative Ignored Sell
- positive: `leader_partial_sell` تحت `min_mirror_sell_pct` يتراكم في `cumulative_ignored_sell`.
- positive: عند تجاوز التراكم العتبة (`partial_sell_*_threshold`)، mirror على المجموع المتراكم حسب `partial_sell_policy`.
- negative: لا تنفيذ لبيع جزئي منفرد تحت العتبة.
- negative: لا إسقاط للتراكم بعد بيوع صغيرة متكررة (منع تسرّب 9% × عدّة مرّات بلا mirror).

### 4.7a LeaderPositionReconstructor Correctness & Fail-Safe (Gap A)

> يستهلك `candidate_leader_position_change_pct` · `candidate_leader_balance_reconstruction_status` (SSOT Group 20) + `copy_event` القائم (ARCH §15.1 وحدة 3 · DATA §9.8a · API §15.8a · UX §26.8a). **acceptance criteria فقط — لا حقول/أوامر/سطوح جديدة؛ الاتّجاه/النوع من `copy_event` لا من حقل جديد.**

- **transfer ≠ sell:** positive: `copy_event = transfer_known_cluster` لا يُحتسب نسبة بيع؛ `candidate_leader_position_change_pct` لا يُمثَّل كبيع ولا يُطلق خروجاً أعمى. negative: احتساب `transfer_known_cluster` كبيع/نسبة بيع = fail · خروج تلقائي على مجرّد transfer = fail.
- **transfer unknown/risky:** positive: `leader_transfer_out` لوجهة غير known cluster يبقى ليس بيعاً؛ قد يرفع الخطر/`disable_new_adds` حسب السياسة القائمة (§4.8). negative: توليد نسبة بيع وهمية من transfer = fail.
- **partial sell %:** positive: بيع جزئي للقائد → `candidate_leader_position_change_pct` يعكس النسبة الصحيحة **بعد خصم التحويل/تعديل الـ cluster داخلياً**، والاتّجاه من `copy_event = leader_partial_sell`. negative: نسبة غير معدَّلة بالتحويل/الـ cluster = fail.
- **full exit:** positive: معنى الخروج الكامل من `copy_event = leader_full_exit` (المقدار قد يظهر في `candidate_leader_position_change_pct` لكن الدلالة من `copy_event`). negative: إدخال/اعتماد `full_exit_detected` كحقل = fail.
- **scale-in:** positive: مقدار الزيادة عبر `candidate_leader_position_change_pct`، والاتّجاه من `copy_event = leader_scale_in`. negative: إدخال `candidate_leader_buy_percentage` كحقل = fail.
- **low_confidence / unavailable → fail-safe:** positive: `candidate_leader_balance_reconstruction_status ∈ {low_confidence, unavailable}` → سلوك حذِر (watch-only/manual-review/خفض الإجراء) عبر §4.2/§10. negative: افتراض 0% = fail · افتراض 100% = fail · mirror أعمى = fail.
- **read-only:** negative: محاولة كتابة أيٍّ من الحقلين → `READ_ONLY_FIELD_REJECTED` (لا كتابة).
- **UX/API honesty:** negative: عرض reconstruction غير المتاح كرقم مؤكّد = fail · حساب الواجهة لهما محلياً = fail · قبول API لهما في write request = fail.
- **raw internal vars forbidden:** negative: ظهور `leader_wallet_balance_before`/`leader_wallet_balance_after`/`leader_cluster_balance`/`transfer_adjusted_balance` كحقل API/Data/UX = fail (مدخلات حساب داخلية فقط).
- **duplicate fields forbidden:** negative: ظهور `candidate_leader_sell_percentage`/`candidate_leader_buy_percentage`/`full_exit_detected`/`partial_exit_detected` كحقول = fail.
- **no authority expansion:** negative: منح execution/command authority = fail · فتح `buy_opportunity`/`execute_opportunity`/`submit_opportunity` = fail · إضافة leader P&L = fail · إضافة `copy_event` جديد = fail.
- **evidence:** fixture القائد يحوّل 40% لـ known cluster ثم يبيع 30% من الباقي → `candidate_leader_position_change_pct` = نسبة البيع الفعلية بعد الخصم (لا 30% من الأصل الكامل، ولا احتساب التحويل بيعاً)؛ وfixture بمصدر إعادة بناء مفقود → `unavailable` + سلوك حذِر لا 0%/100%.

### 4.8 Transfer-out / disable_new_adds
- positive: `transfer_known_cluster` لا يُعامَل كبيع تلقائي.
- positive: `transfer_unknown_single`/`transfer_split_unknown`/`transfer_cex_like`/`transfer_creator_dev` → رفع الخطر و`disable_new_adds` حسب القرار.
- positive: `transfer_exit_policy` يطبّق عند transfer-out.
- positive: `disable_new_adds` يمنع new entries/scale-in فقط.
- negative: لا مساواة بين `transfer_known_cluster` و`transfer_cex_like`/unknown.
- negative: `disable_new_adds` لا يُجبر إغلاق مركز قائم ولا يمنع exit/emergency exit (runtime state لا أمر خروج).

### 4.9 Multi-wallet Conflict
- positive: عند تعارض buy/hold/sell من عدة محافظ (`multi_wallet_conflict`)، `conflict_resolution = risk_signal_wins_by_default` يرجّح إشارة الخطر.
- negative: لا تتجاوز أغلبية buy ضعيفة إشارة exit/high-risk موثوقة دون قواعد الترجيح المعتمدة (score/EV).
- negative: التعرّض الكلّي عبر المحافظ لا يتجاوز Hard Risk (account-level فوق per-wallet).

### 4.10 Execution Wallet Assignment
- positive: `wallet_assignment_policy` يختار `execution_wallet_id` مؤهّلاً فقط (`ACTIVE` + signer `ACTIVE`).
- positive: محفظة `DRAINING` لا تُستخدم لدخول جديد، لكنها قد تبقى صالحة للخروج/التسوية/الكنس المصرّح به.
- negative: لا اختيار لمحفظة `DRAINING`/`WARMING_UP`/`REVOKED` للدخول الجديد (`DRAINING` ليست تعطيلاً كاملاً يمنع الخروج/sweep).
- negative: لا استخدام لمحفظة يتجاوز اختيارها account-level Hard Risk.

### 4.11 Asset Transfer / Ownership
- positive: `position_owner_wallet_id` يتغيّر عند `asset_transfer_status=CONFIRMED`.
- negative: لا بيع من execution wallet لا تملك الأصل؛ بيع قبل CONFIRMED → `COMMAND_NOT_ALLOWED_IN_STATE`.

> **مبدأ §4:** الاختبار يتحقّق من **السلوك كما قرّرته ARCHITECTURE**، بقيم SSOT الدقيقة، بزوج control + adversarial لكل سيناريو. السلوك الخاطئ = فشل اختبار لا انحراف.

> **Adversarial fixtures إلزامية:** كل behavior suite يحوي fixtures عدائية لا happy-path فقط: leader sells in slices below threshold · transfer إلى unknown/CEX-like · migration limbo with pending exit · signer revoked بين القرار والتوقيع · wallet assignment يُرجِع محفظة بائتة/غير ACTIVE. هذه الحالات تكشف الفشل، لا المسار الطبيعي.

---

### 4.12 New-Coin Hunting Lifecycle (hunt_status)
- positive: `hunt_status` يسير `discovered → ranked → gated → accepted/rejected/watch_only/expired → entered`.
- positive: عند `entered` يُسلَّم لـ `position_state=OPENING` ويملك ما بعده.
- negative: mint مكتشَف وحده لا ينشئ `BUY_INTENT` (لا تنفيذ من اكتشاف).
- negative: `accepted` لا يمنح إذن شراء مباشر ولا ينشئ زرّ/أمر شراء.
- negative: إشارة DexScreener وحدها → `rejected_reason=dex_only_signal` أو `watch_only`، لا تنفيذ.
- negative: `new_token_priority_score` لا يدخل EV ولا يوافق تنفيذاً (ترتيب/عرض فقط).
- negative: `hunt_status` لا يحمل قيمة من `position_state`/`operating_state` (لا CLOSED/EXITS_ONLY/WARMING_UP).
- negative: لا badge باسم HUNTABLE كحالة قابلة للتنفيذ.
- negative: `accepted_reason`/`rejected_reason` read-only (لا كتابة).

### 4.13 Entry / Sizing Filters (Group 19)
- positive: الفلاتر unset = disabled/no-effect؛ غيابها لا يؤثّر على `real_live_config_valid`.
- positive: `fast_hunt_window_ms` المنتهية → `hunt_status=expired`/`watch_only`/`rejected_reason=hunt_window_expired`.
- positive: `max_liquidity_share_pct` يخفض الحجم أو يرفض الدخول حسب policy.
- negative: `max_liquidity_share_pct` ليس Hard Risk (ليس في Group 6؛ غيابه لا يحجب REAL-LIVE).
- negative: `fast_hunt_window_ms` لا يعفي من `max_entry_slippage_vs_leader`؛ ليس paper/backtest schedule ولا REAL-LIVE gate.
- negative (derived-scale): `min_token_readiness`/`single_wallet_min_confidence`/`max_entry_volatility` على مقياس مرجعي مجهول/غير متاح → reject/watch-only/warning، **never silent pass**.
- negative: `single_wallet_min_confidence` يستهلك مخرجات Wallet Intelligence لا score مستقل يُكتب.

### 4.14 Exit Policy (Group 21)
- positive: `stop_loss_pct` يطلق exit عبر Position Manager / Exit Feasibility / route health.
- positive: `max_time_in_position` قيمة مضبوطة = تفعّل time-exit لتلك المحفظة.
- positive (mutability): تشديد `stop_loss_pct`/`max_time_in_position` يطبّق فوراً على المراكز المفتوحة مع audit؛ التخفيف للجديد فقط أو يحتاج config migration.
- negative: `stop_loss_pct` ليس Hard Risk ولا يضعف حدّاً/Kill Switch؛ لا يضمن الخروج في السيولة الرقيقة.
- negative: لا toggle مسجّل باسم `time_exit` (الحضور = تفعيل) · لا `stop_loss` toggle منفصل.

### 4.15 Wallet Intelligence & Decision Outputs (read-only)
- positive: `tracked_wallet_status` derived/read-only؛ لا يفتح تنفيذاً وحده.
- positive: `tracked_wallet_status=banned` = سياسة متابعة فقط — لا حظر أمني لمحفظة تنفيذ ولا إغلاق مراكز تلقائي.
- negative: محاولة كتابة `copyability_by_brain`/`crowd_follow_score`/`profit_concentration`/`tracked_wallet_status` → `READ_ONLY_FIELD_REJECTED`.
- negative: لا خلط بين `tracked_wallet_status` (سياسة متابعة) و`follow_enabled` (نيّة المستخدم) و`execution_wallet_status` (حالة المفاتيح).

### 4.16 UX / Trading-Workspace Guardrails
- positive: batch exit = multi-select UI + تكرار `manual_exit_position`/`emergency_exit_position` لكل مركز، بنتيجة per-position: submitted / blocked / failed / skipped.
- negative: لا أمر ذرّي `exit_all_positions`/`batch_exit_all_positions` مسجّل أو مُستدعى.
- negative: مرور مركز للفحص لا يعني مرور البقية؛ لا خروج جماعي صامت؛ كل مركز عبر Exit Feasibility/state/route/permission.
- negative: Professional Chart Workspace لا يخترع price/candle fields.
- negative: P&L لا يُحسب في الواجهة كمصدر حقيقة؛ legacy/unprefixed P&L names **مرفوضة (rejected)**، أمّا candidate P&L فيُقبل فقط من backend/data read-model وبأسماء `candidate_*`، مع mark gating للـ unrealized (`candidate_mark_status=valid`).
- negative: التصدير لا يتضمّن إطلاقاً private keys/seed phrases/secrets/signer credentials/auth tokens (redaction).
- positive: `funding_wallet_id`/`funding_wallet_address`/`settlement_wallet_address` تُعرض كحقول قائمة؛ balances/profits-to-sweep/sweep history مُرقّاة candidate (`candidate_execution_wallet_balance`/`candidate_profits_available_to_sweep`/`candidate_sweep_history`) تُختبر في §10.6 — بشرط provenance/reconciliation وحجب الكنس عند mismatch وبلا مفاتيح خام.
- positive (onboarding): onboarding يعرض العناوين القائمة أو يوجّه لمسار wallet/config قائم معتمد.
- negative (onboarding): لا يُنشئ/يستدعي `update_funding_wallet`/`update_settlement_wallet` أو أي wallet-update جديد؛ إنشاء/تعديل funding/settlement لا يُخترَع خارج SSOT/API ما لم يدعمه command/config flow قائم.
- positive: presets = قوالب UX تمرّ Config validation/preview ولا تتجاوز Hard Risk/Exit Feasibility.
- positive (acceptance i18n): AR/EN + RTL حاضرة كمعايير قبول (labels/tooltips/empty/warnings/confirmations/reports قابلة للتوطين، بلا أعطال اتجاه).
- positive (acceptance nav): التنقّل يستخدم نموذج 9 صفحات (Command Center · Trading Workspace · New Coin Radar · Wallet Intelligence · Analytics & Reports · My Wallets & Funds · Settings & Safety · Alerts · Help/Glossary).
- positive (acceptance nav): Decision Trace · Token Risk · Trade Timeline = tabs/details/subviews لا صفحات رئيسية منافسة.
- negative (acceptance nav): لا عودة لعبارات «الشاشات السبع»/«سبعة أقسام رئيسة»؛ ولا ترقية شاشة تفصيلية إلى top-level منافس دون اعتماد صريح لاحق.

---

## 5. Source-of-Truth & Data Tests (اختبارات مصدر الحقيقة والبيانات)

اختبار قواعد مصدر الحقيقة (DATA MODEL §3 القواعد الأربع)، لا إعادة تعريفها. كلٌّ positive + negative.

### 5.1 PostgreSQL Authority
- positive: `positions`/`intents`/`config_versions`/`execution_wallets`/`signer_profiles`/`audit_log` تُقرأ كمصادر حقيقة من PostgreSQL.
- negative: عند تعارض ClickHouse أو Redis مع PostgreSQL، **يفوز PostgreSQL** وتُعاد بناء الإسقاطات.

### 5.2 ClickHouse Projection
- positive: ClickHouse يخزّن `stream_events`/`trade_fills`/`execution_outcomes`/`metrics_timeseries` كإسقاطات تحليلية.
- positive: `trade_fills`/`execution_outcomes` تُستخدم للتحليل/replay فقط.
- negative: لا يُحسم `position_state`/`bundle_status`/`execution_wallet_status`/`signer_profile_status` من ClickHouse.
- negative: لا يُستخدم ClickHouse كـ command authority أو accounting authority.
- negative: لا تُحسم كمية المركز/الرسوم/P&L/terminal accounting من ClickHouse وحده؛ أي fill يؤثّر على position accounting أو intent finalization له تمثيل/ارتباط معتمد في PostgreSQL أو مسار accounting تشغيلي معتمد.

### 5.3 Redis/RAM Cache
- positive: `hot_wallet_sets`/`dedup_keys`/`stream_cursors`/`runtime_cache` للتسريع فقط.
- negative: `dedup_keys` لا تلغي terminal intent في PostgreSQL (عند تعارض، PostgreSQL يفوز).
- negative: `execution_wallet_hot_eligibility_cache` لا يسمح بتوقيع إذا صار signer `REVOKED`.
- negative: `hot_wallet_sets` البائتة تُبطَل عند تغيّر `follow_enabled`/`config_version`.
- positive: `stream_cursors` تسرّع الاستئناف وتُصالَح مع `provider_stream_state`.
- negative: لا تُستخدم `stream_cursors` وحدها لتقرير finality/rollback؛ عند تعارض مع `provider_stream_state` أو أحداث PostgreSQL → يُعاد بناء/تصحيح cursor.
- positive: `quote_fee_tip_cache` يُستخدم فقط إذا fresh وضمن صلاحيته القصيرة.
- negative: quote/fee/tip بائت لا يُستخدم لحساب EV ولا بناء order.
- positive: `curve_pool_state_cache` يُستخدم فقط مع freshness/source markers صالحة.
- negative: عند stream gap أو slot lag أو `protocol_constant_status=changed` → يُرفَض الـ cache ويُفعَّل مسار safety/EXITS_ONLY حسب السياسة.

### 5.4 Derived Readiness Cache
- positive: `derived_readiness_cache` يمرّ فقط إذا كانت dependency/version markers حديثة.
- negative: stale `derived_readiness_cache` لا يمرّر REAL-LIVE.
- negative: `real_live_config_valid` لا يُعامَل كحقيقة مخزّنة إذا تغيّر config أو Hard Risk (يُعاد الحساب).
- positive: REAL-LIVE readiness تمرّ فقط عند `real_live_config_valid=true` **و** Security Readiness Checklist = pass.
- negative: `real_live_config_valid=true` وحدها لا تكفي إذا Security Readiness فشلت.
- negative: Security Readiness pass وحدها لا تكفي إذا `real_live_config_valid=false`.

### 5.5 Audit Append-only
- positive: signing/revoke/disable/critical commands تُكتب في `audit_log` (بـ `event_timestamp` الرسمي).
- positive: `revoke_signer_profile`/`disable_signer_profile`/`activate_execution_wallet`/`drain_execution_wallet`/signing attempts/kill switch/REAL-LIVE activation تُسجَّل في `audit_log`.
- negative: لا UPDATE/DELETE لـ `audit_log`.
- negative: signing attempt بلا audit before/after = fail.
- negative: أي critical command بلا audit entry = fail.

### 5.6 Data Retention / Terminal Intent
- positive: terminal intents تُحتفظ لأغراض idempotency/audit.
- positive: إعادة إرسال نفس `idempotency_key`/`intent_id` بعد terminal state تُرجِع الحالة terminal المسجّلة ولا تنشئ intent جديداً.
- negative: لا hard-delete لـ terminal intent طالما توجد `positions` أو audit entries مرتبطة.
- negative: حذف terminal intent يسمح بتكرار شراء/بيع سابق = fail.

> **مبدأ §5:** الهدف ليس إثبات أن التخزين يعمل، بل إثبات أن **PostgreSQL يبقى مصدر الحقيقة** وأن ClickHouse/Redis/cache لا تتحوّل إلى سلطة قرار. كل اختبار negative هو حارس ضد انقلاب الإسقاط إلى حقيقة — خاصةً «cache لا يخوّل توقيعاً» و«PostgreSQL يفوز عند التعارض».

---

## 6. Paper-to-Real Gate Procedure (إجراء بوّابة الانتقال من Paper إلى Real)

يحوّل الوثائق المغلقة (Build/Security/Config) إلى **إجراء قبول مرحلي**، لا سلوك جديد. كلٌّ positive + negative.

### 6.1 Paper Path Acceptance
- positive: paper يستخدم نفس order object ونفس validation/Risk path؛ يكتب `positions`/`intents`/audit؛ يسمح باختبار Decision/Risk/Storage دون توقيع.
- negative: paper لا يستدعي SignerService · لا يوقّع · لا يرسل on-chain.
- negative: paper path **ينتج صفر outbound signing calls وصفر on-chain send/bundle calls**؛ أي استدعاء لـ SignerService أو Jito send/bundle أو مسار إرسال معاملة حيّة = fail (قابل للقياس في test harness).

### 6.2 Execution Wallet Admission Test
- positive: `execution_wallet` لا تصبح `ACTIVE` إلا بعد admission checks (funded + signer reachable + limits/config valid + key custody verified + not revoked)؛ `WARMING_UP` تبقى non-signing.
- negative: update عام لا يجعلها `ACTIVE`؛ `DRAINING`/`WARMING_UP`/`REVOKED` لا تُستخدم للدخول الجديد.

### 6.3 Signer Readiness Dry-run
- positive: dry-run يتحقّق من `signer_profile_status=ACTIVE` + payload binding + approval freshness + audit path؛ في dev/test يستخدم mock/test signer فقط.
- negative: لا live private key في dev/test؛ `DEGRADED`/`DISABLED`/`REVOKED` لا يوقّع؛ stale approval أو payload mismatch يُرفَض.
- negative: signer dry-run **لا ينتج توقيعاً حيّاً قابلاً لإعادة الاستخدام ولا معاملة جاهزة للإرسال**؛ يتحقّق من binding/freshness/audit path فقط.

### 6.4 Risk + Config Readiness Gate
- positive: `real_live_config_valid=true` فقط عند اكتمال Hard Risk وvalidation؛ `warning_only` لا يعطّل Hard Risk.
- negative: missing Hard Risk = invalid؛ Hard Risk fail يمنع REAL-LIVE حتى مع `ev_gate_mode=warning_only`.

### 6.5 Security Readiness Gate
- positive: SECURITY §7 checklist pass + KMS/vault ready + audit before/after signing + `signer_control` منفصل عن admin.
- negative: KMS degraded · audit unavailable · `connected_wallet` مختار للآلي الحيّ · live key في `.env`/logs/db/cache → block.

### 6.6 Real-live Blocked/Pass Decision
- positive: محاولة تفعيل REAL-LIVE نفسها **مُدقّقة** (`audit_actor`/`permission_role`/نتيجة الجاهزية/قائمة blockers إن وُجدت).
- **pass (كل الشروط معاً):** paper accepted · execution wallet admission pass · signer dry-run pass · `real_live_config_valid=true` · Security Readiness = pass · لا blocker نشط.
- **block:** أي فشل في واحد من الشروط أعلاه → **REAL-LIVE BLOCKED**.
- negative: تفعيل REAL-LIVE بلا audit entry = fail.
- negative: قرار block **لا يُلتَف عليه** بتغيير `execution_mode` ولا بتأكيد المشغّل وحده؛ أسباب الـ blocker تُعرَض من البوّابة الفاشلة لا تُجمَع في «فشل عام».

> **قاعدة §6 الحاكمة: Paper-to-real is a gate, not a mode toggle.** لا ينتقل النظام إلى REAL-LIVE بمجرّد تغيير `execution_mode`. الانتقال يتطلّب اجتياز: paper acceptance + execution wallet admission + signer readiness + Risk/Config readiness + Security readiness. أي blocker (SECURITY §7) يمنع REAL-LIVE — block لا warning (Fail Safe Not Fail Open).

---

## 7. Regression Suite & Final Acceptance (مجموعة الانحدار ومعايير القبول النهائية)

تغلق Test Plan عبر regression suites ومعايير قبول، لا سلوك جديد.

### 7.1 SSOT / Contract Regression
- No field before SSOT: كل `command_type`/`resource_type`/`api_error_code`/field في API موجود في SSOT.
- أي field جديد في test/API/UX/Data Model بلا SSOT = fail.

### 7.2 Safety Regression
- Hard Risk لا يُتجاوز · `warning_only` لا يعطّل loss caps · missing Hard Risk = invalid · `EXITS_ONLY` لا يسمح بدخول جديد · kill switch يمنع الدخول/التنفيذ غير المسموح.

### 7.3 Security Regression
- no signing without `intent_id` · no generic signing · payload binding · approval freshness · `DEGRADED`/`DISABLED`/`REVOKED` لا يوقّع · `connected_wallet` لا يُستخدم في الـ hot path الآلي.

### 7.4 Data Source-of-Truth Regression
- PostgreSQL wins · ClickHouse لا يصبح command/accounting authority · Redis cache لا يخوّل توقيعاً · stale `derived_readiness_cache` لا يمرّر REAL-LIVE · `audit_log` append-only.

### 7.5 Paper-to-Real Regression
- paper same order object · paper no sign/no send (zero outbound) · execution wallet admission required · signer dry-run لا ينتج توقيعاً حيّاً قابلاً للإرسال · REAL-LIVE activation مُدقّق.

### 7.6 Final Acceptance Criteria
Document 07 يجتاز **فقط إذا:**
- كل اختبارات Gate Matrix (§3) تمرّ؛
- كل اختبارات Behavior (§4) تمرّ؛
- كل اختبارات Source-of-Truth/Data (§5) تمرّ؛
- كل اختبارات Paper-to-Real (§6) تمرّ؛
- كل اختبارات New-Coin Hunting & v1.8 Behavior (§4.12–§4.16) تمرّ؛
- كل حُرّاس §8 Rejected/Forbidden تمرّ (لا اسم مرفوض ظهر كحقل/أمر حقيقي)؛
- regression §7.7 يمرّ؛
- لا blocker REAL-LIVE نشط؛
- الفشل في بوّابات safety/security يحجب (block) لا ينبّه (warn).

> **مبدأ §7:** Test Plan ليس قائمة فحص مرّة واحدة — هو **regression دائم**. كل قاعدة غير قابلة للكسر (No field before SSOT · Hard Risk · isolated signing · PostgreSQL authority · paper-to-real gate) لها اختبار انحدار يمنع التراجع الصامت. القبول النهائي = اجتياز الكل + صفر blocker + الفشل الأمني يحجب لا ينبّه (Fail Safe Not Fail Open).

### 7.7 New-Coin Hunting & v1.8 Regression
- discovery ≠ execution · dex-only → no approval · `new_token_priority_score` ranks-only · `hunt_status` pre-position only · `accepted` ≠ buy.
- `max_liquidity_share_pct` not Hard Risk · `stop_loss_pct` exits only via Exit Feasibility · derived-scale **never silent pass** · no `time_exit`/`stop_loss` toggle invented.
- batch exit = per-position orchestration only (no atomic `exit_all_positions`/`batch_exit_all_positions`) · no silent mass exit.
- derived/runtime/decision read-only · `tracked_wallet_status=banned` = follow-policy only.
- onboarding no wallet-update invention · funding/settlement create/update not invented outside SSOT/API.
- 9-page navigation model holds; stale «الشاشات السبع»/«سبعة أقسام رئيسة» does not return.
- no local P&L as source of truth · export redaction of secrets · no rejected name (legacy P&L · current_price · atomic batch exit · buy/execute/submit) as real API/SSOT/Data field/command/resource.

---

## 8. F-Elimination — Rejected / Forbidden Guards (حُرّاس المرفوض الدائم)

> بعد F-Elimination لم تبقَ عناصر `[F]` غامضة: المُرقّى صار candidate يُختبر في §10، والمرفوض دائماً يُحرَس هنا. الحارس يمنع ظهور **الأسماء المرفوضة** كحقول/أوامر/موارد مسجّلة.

**القاعدة الحاكمة:**
> الأسماء المرفوضة دائماً **يجب ألا تظهر** كحقول SSOT، أو حقول API request/response، أو أعمدة/كيانات Data Model، أو `command_type`/`resource_type`/`api_error_code`، أو سلوك UI قابل للتنفيذ، أو قيمة source-of-truth — لا الآن ولا لاحقاً. المرشّحات المُرقّاة (former [F]) تُسجَّل بأسمائها `candidate_*` في SSOT Groups 22–36 وتُختبر في §10.

**القائمة المرفوضة دائماً (Rejected/Forbidden):**
- أسماء P&L القديمة غير المسبوقة: `realized_pnl` · `unrealized_pnl` · `fees_paid` · `slippage_cost` · `net_pnl` · `fee_amount` (legacy aliases).
- `current_price` / `candidate_current_price` (البديل `candidate_current_mark_view`).
- الأمر الذرّي `exit_all_positions` / `batch_exit_all_positions` (البديل §10 preview→request per-position).
- `buy_opportunity` / `execute_opportunity` / `submit_opportunity` · تنفيذ من `accepted` · أمر من `new_token_priority_score`.

**guard tests:**
- ظهور أيٍّ من القائمة المرفوضة كحقل/أمر/مورد مسجّل في API/SSOT/Data = **fail**.
- الواجهة لا تعرض أيّاً منها كقيمة حقيقية ولا كزرّ قابل للتنفيذ.
- المُرقّى (former [F]) يجب أن يظهر فقط بأسمائه `candidate_*` المسجّلة في SSOT وعبر أسطحه المخصّصة (§10)، لا كحقل خام غير مسبوق.

> **مبدأ §8:** بعد F-Elimination، الحارس يفصل **candidate مُرقّى مسجّل** (مسموح، §10) عن **مرفوض دائم** (ممنوع للأبد). لا «pending/deferred/مؤجل» — كل عنصر إمّا candidate أو rejected/forbidden.

---

## 9. v1.8 Delta — Negative Tests & Acceptance Criteria

> تتحقّق من ثوابت v1.8 المستهلِكة لـ SSOT Groups 22–27. كل بند قابل للاختبار. (تكمّل §3/§4/§7 ولا تكرّرها.)

### 9.1 Negative Tests (يجب أن تفشل المحاولة)
- **no `buy_opportunity`/`execute_opportunity`:** أي أمر يحوّل radar item أو `accepted`/`copy_signal_candidate` إلى تنفيذ = **fail**.
- **no Radar execution:** `new_token_priority_score`/`hunt_status` لا يمنحان إذن شراء.
- **no `accepted` = buy:** الانتقال إلى تنفيذ يتطلّب مسار wallet/cluster-led عبر البوابات.
- **no UI P&L math:** حساب أي قيمة P&L في الواجهة = **fail**؛ كل P&L من backend read-model (`candidate_*`).
- **no raw provider key leakage:** ظهور raw provider key في أي API request/response/log/report/diagnostic-bundle/backup/export = **fail**؛ `candidate_provider_key_ref` فقط.
- **no auto-apply recommendation:** أي تعديل strategy/risk/live من توصية بلا preview→validation→permission→audit→config-version = **fail**.
- **sandbox isolation:** أي تعديل live/risk/signer/execution من Strategy Sandbox = **fail** (paper-only).
- **maintenance scope:** `purge_data`/`restart_service`/`backup`/`export_diagnostic_bundle` من دور operator عادي = **fail**؛ purge يحذف audit مالي = **fail**؛ restart مع pending intents حرجة/active signing = **fail**.
- **mark gating:** عرض `candidate_unrealized_pnl` كرقم موثوق و`candidate_mark_status ≠ valid` = **fail**.
- **provenance gating:** عرض OHLCV `display_only` كحقيقة تنفيذ = **fail**.
- **legacy names:** ظهور اسم غير مسبوق (`realized_pnl`…) كحقل API/SSOT/Data مسجّل = **fail** (§8).

### 9.2 Acceptance Criteria (يجب أن تنجح)
- single-provider: فشل المزوّد الوحيد ينقل النظام إلى `EXITS_ONLY` مع تحذير blind-spot.
- Execution Trace: كل صفقة تحمل 12 طابعاً + 5 latencies + attempt/fee counters + `failure_origin` مُصنَّف.
- leader vs our entry: يظهران كعلامتين **متمايزتين** على الشارت.
- P&L read-model: realized يتبع lot-based/FIFO منسوب التكاليف؛ unrealized يُعرض فقط مع mark `valid` (source/timestamp/confidence/status).
- Paper: كل قيم paper موسومة `simulated`؛ paper ليس حاجز live افتراضياً (إلا `user_enabled_paper_gate`).
- export: markdown/csv/parquet/jsonl بلا أسرار؛ purge يحفظ audit المالي.
- النظام قادر على إنتاج حالة «no proven edge» و«wallet profitable but not copyable».
- opportunity resource: read-only، بلا P&L، بلا command — قراءة فقط (§13).

---

## 10. F-Elimination — Tests & Acceptance (candidate, تستهلك SSOT Groups 22–36)

> acceptance/negative/contract/consistency على مستوى التوثيق — لا implementation code · لا migrations · لا live · لا runbook. المُرقّى يُختبر كـ candidate، والمرفوض كـ rejected/forbidden. لا «pending/later/مؤجل» مفتوحة.

### 10.1 P&L (F1)
- positive: `candidate_realized_pnl`/`candidate_unrealized_pnl`/`candidate_fees_total`/`candidate_slippage_cost`/`candidate_paper_pnl`/`candidate_pnl_by_wallet`/`_by_copy_mode`/`_by_brain`/`candidate_remaining_daily_loss_budget` read-only من backend/data read-model.
- negative: حساب P&L في UX = fail · `candidate_unrealized_pnl` بلا `candidate_mark_status=valid` (stale/unavailable/low_confidence/display_only) كقيمة موثوقة = fail · أي P&L على Opportunity/Radar = fail · ظهور `realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount` كحقل = fail.

### 10.2 Price / Mark (F2)
- positive: كل سعر API/مرئي يحمل type/provenance/timestamp/status/confidence حيث ينطبق · `candidate_current_mark_view` كـ display/read-view فقط.
- negative: `candidate_current_price` = fail · display-only كحقيقة تنفيذ = fail · order-book في AMM بلا مصدر order-book فعلي = fail.

### 10.3 Trade Event / Journal (F3)
- positive: `candidate_trade_event`/`candidate_trade_journal` read view/append-only · enum الأنواع مطابق SSOT (signal_observed/decision/risk/build/sign/send/land/fill/partial_fill/exit_attempt/exit_fill/close/failure) · يربط intent/position/execution-wallet/leader attribution.
- negative: سرّ في حدث/journal = fail · تعديل Audit من عرض الـ timeline = fail.

### 10.4 Wallet-Token Performance (F4)
- positive: point-in-time/survivorship-free · badge اكتمال التكاليف.
- negative: `candidate_wt_net_result` يُعامَل كاملاً بينما `candidate_wt_cost_completeness_status≠complete` = fail · ranking أعمى يرتّب نتيجة ناقصة كـ complete = fail.

### 10.5 Discovery Signals (F5)
- positive: cluster/early/repeat تُعرض مع confidence/provenance.
- negative: low-confidence cluster كحقيقة معروفة = fail · منح تنفيذ من هذه المقاييس = fail · نسخ أعمى من `candidate_early_buyer_rank`/`candidate_cluster_id`/`candidate_repeat_winner_metric` وحدها = fail.

### 10.6 Balances / Sweep (F6)
- positive: payload الرصيد يحمل provenance/reconciliation · سجلّ الكنس append-only · تأكيد الكنس مطلوب.
- negative: `mismatch` لا يحجب الكنس = fail · كنس من محفظة غير مالكة = fail · raw/private key/seed/signer credential في الأرصدة/الكنس/التصدير = fail.

### 10.7 Position Token Identity (F7)
- positive: mint canonical · تحذير `spoof_suspected` ظاهر.
- negative: symbol/name كحقيقة تنفيذ/مطابقة = fail · تنفيذ بالاسم بدل mint = fail.

### 10.8 Leader Attribution (F8)
- positive: read-only · confidence/provenance حيث ينطبق · عرض التعارض/تعدّد القادة.
- negative: الإسناد يمنح تنفيذاً = fail · طيّ صامت لتعدّد/تعارض القادة = fail.

### 10.9 Batch Exit (F9)
- negative: `exit_all_positions`/`batch_exit_all_positions` كأمر = fail (rejected/forbidden).
- positive: المسار preview→request فقط (`candidate_cmd_preview_batch_exit`→`candidate_cmd_request_batch_exit`) · request يتطلّب `candidate_batch_exit_preview_id` حديثاً وصالحاً · preview expired/stale → request مرفوض · `candidate_batch_exit_preview_item_status` ∈ {eligible/blocked/stale} · `candidate_batch_exit_result_status` per-position ∈ {submitted/blocked/failed/skipped/filled} · كل مركز نيّة مستقلّة تمرّ ownership/route/exit-feasibility/risk/signer/audit.
- negative: mass exit صامت = fail.

### 10.10 Alerts (F10)
- positive: `candidate_alert_severity` ∈ {info/warning/critical} · `candidate_alert_category` ∈ {security/risk/provider/data/ops/execution/wallet}.
- negative: إسكات security+critical كتجاوز = fail · ack يحذف/يخفي حقائق الحدث = fail · تفضيل يكتم تنبيهاً أمنياً/مخاطرياً حرجاً إلزامياً = fail.

### 10.11 Reports / Exports (F11)
- positive: صيغ markdown/csv/parquet/jsonl · artifact يحمل provenance/generated_at · missing-metric ∈ {show_unavailable/omit/block_report}.
- negative: اختلاق مقياس مفقود = fail · سرّ/raw key/private key/seed/signer credential/partial secret في report/export/log/diagnostic/backup = fail.

### 10.12 Preferences (F12)
- positive: UI/user state · ar/en · rtl/ltr.
- negative: تفضيل يعدّل strategy/risk/live/signer = fail · وضع beginner/advanced يخفي تحذيراً حرجاً للأمان = fail.

### 10.13 Glossary (F13)
- positive: يربط SSOT · ar/en · system_managed افتراضاً.
- negative: المسرد يعيد تعريف/يضيف اسم SSOT = fail · admin_editable بلا صلاحية = fail · المسرد ينشئ config/حقل تنفيذي = fail.

### 10.14 Onboarding (F14)
- positive: حالة/مراجع فقط · provider progress عبر `candidate_provider_key_ref` بعد التسجيل.
- negative: raw provider key/private key/seed/signer credential/partial secret في onboarding = fail · تجاوز readiness gate = fail · إنشاء أمر wallet/config خارج SSOT/API = fail.

### 10.15 Provider Key Flow (F15)
- positive: raw key عبر secret registration flow فقط · بعد التسجيل `candidate_provider_key_ref` فقط في payloads/UI · test connection عبر key_ref.
- negative: raw key في browser state/reports/exports/logs/diagnostics/backups = fail.

### 10.16 Opportunity / Radar (F16)
- negative: P&L على Opportunity/Radar = fail · execution authority = fail · `buy_opportunity`/`execute_opportunity`/`submit_opportunity` = fail · `accepted` كـ buy = fail · `new_token_priority_score` كدرجة شراء = fail · ربط ضمني Opportunity→تنفيذ = fail.
- positive: former F items تظهر فقط عبر أسطحها candidate المخصّصة لا داخل Opportunity payload.

### 10.17 Charts (F17)
- positive: مكتبة احترافية لا engine من الصفر · OHLCV display-only يحمل provenance · overlays من trade-event/journal + entries/fills/exits + leader attribution + mark/price provenance.
- negative: order-book في AMM بلا مصدر فعلي = fail · اختراع حقل سعر في UX = fail.

### 10.18 Cross-Document Consistency
- كل اسم candidate API-facing في API/UX/DATA موجود في SSOT Groups 22–36 = pass (وإلا fail).
- مفاتيح CONFIG §13 موجودة في SSOT Group 36.
- صيغ التصدير متطابقة عبر SSOT/CONFIG/API/DATA/UX/TEST = `markdown/csv/parquet/jsonl`.
- أسماء أوامر المزوّد مطابقة لـ SSOT حرفياً: `candidate_cmd_register_provider`/`candidate_cmd_test_provider_connection`/`candidate_cmd_disable_provider`/`candidate_cmd_set_provider_role`.
- `candidate_current_price` يظهر فقط في سياق rejected/forbidden.
- legacy P&L aliases تظهر فقط في سياق rejected/forbidden.
- لا وثيقة تقول إن عناصر F السابقة ما زالت pending.

### 10.19 Legacy [F] Cleanup
- لا تبقى صياغة «[F] pending» في الأقسام الفاعلة = pass.
- العناصر المُرقّاة السابقة مُشار إليها كـ candidate capabilities.
- العناصر المرفوضة السابقة مُشار إليها كـ Rejected/Forbidden.
- لا صياغة «later/مؤجل/pending» مفتوحة = pass.

---

## 11. Wave 1 — Profit & Paper Truth — Tests & Acceptance (candidate, تستهلك SSOT Group 37)

> acceptance/negative/consistency/regression على مستوى التوثيق — **لا implementation code · لا migrations · لا live · لا تشغيل tests فعلي.** يُحوّل §15.9 (ARCH) + Group 37 (SSOT) + §16 (API) + §10 (DATA) + §27 (UX) + §10 (BUILD) إلى AC قابلة للاختبار. كل الأسماء API-facing من **SSOT Group 37** أو أسماء قائمة سابقاً — **لا حقل جديد هنا.** Paper موسوم `simulated` ولا يُخلَط بـ real/live؛ unavailable ≠ صفر.

### 11.1 Anti-Fake Edge (W1-01)
- **positive:** محفظة بأرباح حقيقية غير مشبوهة تحتفظ بترتيبها · محفظة بـ `candidate_fake_profit_risk` تُظهر `candidate_fake_profit_reason` واضحاً (self_trading/wash_trading/fake_volume/linked_wallet_circular_activity/creator_dev_controlled_trading/artificial_liquidity_activity_loop).
- **negative:** ربح من self/wash/fake-volume يرفع الترتيب = fail · `candidate_wallet_net_copyability_rank` يزيد بسبب fake profit = fail · fake profit يظهر كـ copyable edge = fail · `candidate_fake_profit_*` writable = fail.
- **pass:** `candidate_fake_profit_adjusted_edge` يخصم/يحجب الترقية، وreason يظهر في API §16.1/UX §27.1/report.
- **fail:** أي fake profit يرفع copyability أو يُعرض كـ «smart money قوية».
- **evidence:** حالة wash معروفة + قبل/بعد للترتيب (لا ارتفاع) + reason مسجّل.
- **example:** Wallet X apparent +180% → reason=wash_trading → adjusted_edge مخصوم، rank لم يرتفع.

### 11.2 Profit Source Attribution (W1-02)
- **positive:** الربح يُفكَّك في `candidate_profit_source_attribution` إلى `candidate_profit_source_type` وكل عنصر بـ `candidate_profit_source_copyability_class` · `candidate_copyable_profit_share`/`_non_copyable_profit_share` متسقان.
- **negative:** insider_non_copyable_information يظهر كـ copyable edge = fail · artificial_pump_profit يدخل copyable_share = fail · non_repeatable_luck_one_off يرفع توصية النسخ = fail.
- **pass:** copyable/non_copyable shares متّسقة، والتقرير يشرح «لماذا محفظة رابحة قد لا تصلح للنسخ».
- **fail:** ربح غير قابل للنسخ يُعامَل كميزة قابلة للنسخ.
- **evidence:** محفظة insider تُصنَّف non_copyable ولا تُرفَع copyability.
- **example:** copyable_share=65% · non_copyable_share=35% (insider) → توصية النسخ تستند للقابل فقط.

### 11.3 token_readiness_score Components (W1-03)
- **positive:** readiness يُعرَض كـ `token_readiness_score` + `candidate_token_readiness_component`(`_type`/`_reason`/`_veto`) · component غير متوفّر يظهر `unavailable` لا رقماً مختلقاً.
- **negative:** تمرير token مع `candidate_token_readiness_component_veto=true` رغم إجمالي جيد = fail · عرض readiness كرقم معتم بلا مكوّنات = fail · منح المكوّنات execution authority = fail.
- **pass:** veto يحجب الجاهزية بوضوح والسبب يظهر في API §16.3/UX §27.3/report.
- **fail:** token خطر يمرّ بسبب score إجمالي غامض.
- **evidence:** حالة holder_risk=HIGH(veto) تحجب رغم إجمالي مرتفع.
- **example:** «Overall good, but holder_risk veto blocks readiness».

### 11.3a Token-2022 / Authority Safety (Gap B)

> يستهلك مفردات SSOT Group 37 المُسجَّلة: `candidate_token_readiness_component_type` ∈ {`token2022_extension_risk`, `token_authority_risk`} · `candidate_token_safety_reason` (الإحدى عشرة قيمة) · آلية الـ veto القائمة `candidate_token_readiness_component_veto` · والقيمة القائمة `rejected_reason = token2022_dangerous_extension`. مصدر القرار ARCHITECTURE §14 + §7 (decode 30% / gate 50%) + فلتر `token2022` allow/deny §13. **acceptance criteria فقط — لا حقل/أمر/سطح جديد، لا تغيير سلوك؛ يُعاد استخدام مكوّن الجاهزية وآلية الـ veto القائمين (W1-03).**

- **positive (dangerous extension → veto):** `permanent_delegate` يُنتج `candidate_token_readiness_component_type = token2022_extension_risk` مع `candidate_token_safety_reason = permanent_delegate` و`candidate_token_readiness_component_veto = true`؛ والمثل لـ `pausable` و`default_account_state_frozen`. الرفض النهائي عبر `rejected_reason = token2022_dangerous_extension` (لا قيمة رفض جديدة).
- **positive (hidden-amount/variable-amount extensions ممثَّلة لا صامتة):** `confidential_transfer` · `scaled_ui_amount` · `interest_bearing_mint` تظهر كلٌّ عبر `candidate_token_safety_reason` المطابق تحت `token2022_extension_risk`؛ **لا يمرّ أيٌّ منها كـ «آمن» صامتاً**.
- **positive (authority risk → veto):** `mint_authority_active` و`freeze_authority_active` يُنتجان `candidate_token_readiness_component_type = token_authority_risk` مع `candidate_token_safety_reason` المطابق و`candidate_token_readiness_component_veto = true`.
- **positive (known safe exception):** `transfer_hook_active` بحالة program ID فارغ/مُعطّل (مثل PYUSD) يجوز أن يُصنَّف `candidate_token_safety_reason = known_safe_exception` بـ `veto = false`، **شرط ظهور provenance يبرّر الاستثناء** (يُفحَص الامتداد بحالته الفعلية لا بمجرد وجوده — ARCH §14).
- **positive (unknown/unsupported → fail-safe):** `unknown_unsupported_extension` **لا يُعامَل كآمن**؛ يُعرَض unsupported/unavailable ويفشل بأمان (veto/سلوك حذِر)، لا pass صامت.
- **positive (unavailable source ≠ safe):** غياب/تعذّر مصدر فحص أمان التوكن → `unavailable`/unsupported (متّسق مع قاعدة W1-03 «component غير متوفّر يظهر unavailable لا رقماً مختلقاً»)، **لا يُفترَض آمناً ولا يُمرَّر**.
- **negative:** امتداد خطر (`permanent_delegate`/`pausable`/`default_account_state_frozen`/active dangerous `transfer_hook_active`) يمرّ بـ `veto = false` = fail · `confidential_transfer`/`scaled_ui_amount`/`interest_bearing_mint` يمرّ صامتاً كآمن = fail · `unknown_unsupported_extension` يُعامَل كآمن = fail · مصدر فحص مفقود يُفترَض آمناً = fail · `mint_authority_active`/`freeze_authority_active` بلا `token_authority_risk`/veto = fail · `known_safe_exception` بلا provenance = fail.
- **negative (لا تجاوز للهوية):** هذه المكوّنات/الأسباب تمنح execution authority أو command authority أو تفتح `buy_opportunity`/`execute_opportunity`/`submit_opportunity` = fail · ترقيتها إلى Hard Risk group = fail · تمثيلها كحقل token-risk عام أو حقل لكل امتداد = fail · إدخال `update_authority` كـ veto لجدوى البيع = fail (يبقى سياق spoofing/metadata عبر `name_impersonation_score` فقط).
- **pass:** الامتداد/السلطة الخطرة تحجب الجاهزية عبر الـ veto القائم بسبب صريح من `candidate_token_safety_reason`، والاستثناء الآمن مفسَّر بـ provenance، والمجهول/المفقود يفشل بأمان — كلّه بإعادة استخدام مكوّن W1-03 بلا أسماء جديدة.
- **fail:** أي token خطر/مجهول يمرّ بسبب score إجمالي غامض أو افتراض «آمن» عند غياب الدليل.
- **evidence:** عيّنة mint بكل من: `permanent_delegate`(veto) · `pausable`(veto) · `default_account_state_frozen`(veto) · `confidential_transfer`/`scaled_ui_amount`/`interest_bearing_mint`(ممثَّلة) · `transfer_hook_active` نشط(veto) مقابل program فارغ(`known_safe_exception` + provenance) · `mint_authority_active`/`freeze_authority_active`(veto) · `unknown_unsupported_extension`(fail-safe) · مصدر مفقود(unavailable).
- **example:** «Overall readiness good, but `token_authority_risk` veto (freeze_authority_active) blocks readiness» · «`transfer_hook_active` → known_safe_exception (program ID empty, provenance: on-chain) → no veto».

### 11.4 Realistic Paper Simulation (W1-04)
- **positive:** Paper P&L يُظهر `candidate_paper_pnl_gross_theoretical` و`candidate_paper_pnl_execution_aware`؛ الأخير يحتسب fees/slippage/تأخير/فشل حيث متاح (`candidate_paper_cost_impact`/`_failure_impact`) · كل قيمة موسومة `simulated`.
- **negative:** ideal-only paper output = fail · gross theoretical يُعرض كدليل ربحية = fail · unavailable impact يتحوّل صفراً = fail · خلط Paper مع Real/Live = fail.
- **pass:** التقرير يُبرز execution-aware، وcost/failure impact يظهر أو `unavailable`.
- **fail:** Paper P&L مثالي فقط أو غير موسوم `simulated`.
- **evidence:** حقن blockhash_expiry/route_failure ينعكس في execution-aware.
- **example:** gross +22% → execution-aware +9% بعد التكاليف؛ failure_impact يذكر فشل إرسال واحد.

### 11.5 Paper Outcome States (W1-05)
- **positive:** كل paper trade له `candidate_paper_outcome_state` (reached_target/exited_with_loss/failed_entry/failed_exit/exit_unavailable/route_failed/expired/rejected_by_policy/still_open/force_closed_by_safety) + `candidate_paper_outcome_reason`.
- **negative:** paper trade بلا outcome = fail · خلط outcome مع `position_state` = fail · failed outcome بلا سبب/`candidate_failure_origin` حيث متاح = fail.
- **pass:** كل صفقة paper قابلة للتفسير، الطوابع عبر `candidate_ts_*`.
- **fail:** صفقة paper ambiguous أو بلا reason.
- **evidence:** عيّنة بكل الحالات، وتمييز صريح عن `position_state`.
- **example:** outcome=exit_unavailable · reason=route_failed.

### 11.6 Paper Aggregation Report (W1-06)
- **positive:** التقرير يدعم dimensions (wallet/mode/strategy/token_class/period) ويحسب/يعرض `unavailable` للمقاييس (max_drawdown/win_rate/avg_win/avg_loss/profit_factor/expectancy/median_hold_time/average_hold_time/failed_trade_rate/rejected_opportunity_count/exit_failure_rate/slippage_impact/latency_impact/fees_impact).
- **negative:** خلط Paper مع Real/Live = fail · مقياس مفقود يظهر صفراً = fail · تقرير Paper بلا simulated context = fail · بلا disclaimer = fail.
- **pass:** يفصل paper/simulated، يعرض `candidate_report_provenance`/`_generated_at`، disclaimer «الأداء الورقي لا يثبت ربحية مستقبلية».
- **fail:** Paper report يخلط مع live أو يختلق أرقاماً.
- **evidence:** artifact بأبعاد/مقاييس + unavailable + disclaimer.
- **example:** Wallet Y · 7d: win_rate 41% · profit_factor 1.18 · latency_impact `unavailable`.

### 11.7 Paper↔Real Divergence (W1-07)
- **positive:** `candidate_paper_real_divergence` يقارن `simulated_*` مع `real_*` حيث متاح عبر dimensions (fill/slippage/exit_success/latency/provider_reliability)، و`candidate_paper_real_divergence_status` ∈ within_band/elevated/high.
- **negative:** `status=high` يضيف gate حاجباً جديداً = fail · `status=high` بلا warning = fail · ادّعاء real validity وreal data غير متاحة = fail.
- **pass:** `high` يظهر warning/readiness signal ويغذّي Calibration/Readiness القائمة، والتقرير يوضح «Paper متفائل مقابل الواقع».
- **fail:** divergence high مخفي أو يتحوّل gate حاجباً بلا قرار معماري.
- **evidence:** عيّنة `high` تُنتج تحذيراً دون حجب REAL-LIVE.
- **example:** slippage divergence p95=140bps → WARNING.

### 11.8 Point-in-time / Survivorship (W1-08)
- **positive:** تقييم محفظة عند T يستخدم بيانات ≤ T فقط · المحافظ dead/failed/disappeared تبقى في الـ cohort · التقرير يعرض point-in-time/no-future-leakage/survivorship-free **فقط مع evidence** (يُربط `candidate_wt_point_in_time` حيث ينطبق).
- **negative:** استخدام بيانات > T = fail · حذف المحافظ الفاشلة من العينة = fail · ادّعاء survivorship-free بلا evidence = fail · اكتشاف Smart Money بناءً على نتيجة مستقبلية = fail.
- **pass:** test plan يثبت temporal cutoff T وحفظ الـ cohort.
- **fail:** أي leakage أو survivorship bias غير موسوم.
- **evidence:** إعادة بناء حالة T (لا بيانات > T) + وجود المحافظ المنقرضة في العينة.
- **example:** discovery@T يستبعد أي swap بـ ts>T؛ dead wallets حاضرة.

### 11.9 Cross-Document Consistency (W1)
- كل أسماء W1 في Test Plan موجودة في **SSOT Group 37** أو أسماء قائمة سابقاً = pass (وإلا fail) · **لا field جديد ظهر في Test Plan**.
- API §16 مطابق لـ SSOT Group 37 · Data §10 يستخدم projections/read-models فقط · UX §27 بلا أزرار تنفيذ · Build §10 بلا runtime/migrations.
- Paper موسوم `simulated` في كل الوثائق · **No Paper/Real mixing** · `unavailable` لا يتحوّل صفراً.
- fake profit لا يرفع copyability · non_copyable لا يدخل copyable edge · point-in-time/survivorship-free لا يُدّعى بلا evidence.

### 11.10 Regression Guards (W1)
- legacy/unprefixed P&L aliases (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`) كحقل حقيقي = fail (يتّسق §8).
- `current_price`/`candidate_current_price` = fail (rejected) · `buy_opportunity`/`execute_opportunity`/`submit_opportunity` = fail · atomic `exit_all_positions`/`batch_exit_all_positions` = fail.
- write access إلى أي حقل W1 derived/read-only → `READ_ONLY_FIELD_REJECTED` (وإلا fail) · Paper P&L ideal-only = fail · Paper/Real report mixing = fail.
- fake-profit ranking uplift = fail · future leakage = fail · survivorship-biased cohort = fail.

> **مبدأ §11:** Wave 1 مغلقة باختبارات قبول/انحدار: الربح الوهمي لا يرفع الترتيب · المصدر غير القابل للنسخ خارج الـ edge · readiness بمكوّنات + veto لا رقم معتم · Paper execution-aware موسوم simulated وغير مخلوط بـ real · لكل paper trade outcome متمايز عن position_state · aggregation بلا اختلاق ومع disclaimer · divergence تحذير لا gate جديد · datasets الاكتشاف point-in-time/survivorship-free. **لا اسم خارج SSOT · لا تغيير وثائق أخرى · لا live.**

---

## 12. Wave 2 — Discovery & Copy Safety — Tests & Acceptance (candidate, تستهلك SSOT Group 38)

> acceptance/negative/consistency/regression على مستوى التوثيق — **لا implementation code · لا migrations · لا live · لا تشغيل tests فعلي.** يُحوّل §15.10 (ARCH) + Group 38 (SSOT) + §14 (CONFIG) + §17 (API) + §11 (DATA) + §28 (UX) + §11 (BUILD) إلى AC قابلة للاختبار. كل الأسماء API-facing من **SSOT Group 38** أو قائمة — **لا حقل جديد هنا.** **لا execution authority من إشارات W2 · لا auto-ban · لا auto-config · `full_mirror` ليس default/صامت.**

### 12.1 Wallet Taxonomy (W2-01)
- **positive:** كل `candidate_wallet_type` يظهر مع `candidate_wallet_type_confidence`/`_provenance` · low-confidence يظهر «uncertain/insufficient evidence» · يساعد copyability explanation.
- **negative:** insider/dev/sniper/copycat يرفعون copyability = fail · low-confidence كحقيقة = fail · taxonomy يمنح execution authority = fail · `smart_money_wallet` وحده يفعّل follow/execute = fail.
- **pass:** النوع مفسَّر بلا execution authority، والأنواع الخطرة بتحذير.
- **fail:** النوع يرفع الترتيب أو يفعّل follow/execute وحده.
- **evidence:** محفظة insider بثقة عالية لا ترفع `candidate_wallet_net_copyability_rank`؛ محفظة low-confidence تُعرَض uncertain.
- **example:** type=mev_sniper_wallet (conf 0.8) → تحذير، copyability لا ترتفع.

### 12.2 Token Concentration (W2-02)
- **positive:** أبعاد `candidate_token_concentration_dimension` تظهر مع `_risk`/`_reason` · تغذّي `candidate_token_readiness_component` · high concentration يُنتج veto عبر `candidate_token_readiness_component_veto`.
- **negative:** creator/dev/cluster concentration كطلب طبيعي = fail · concentration يمنح execution authority = fail · unavailable source كـ zero risk = fail.
- **pass:** high concentration يحجب الجاهزية أو يظهر كخطر واضح بسبب، في API/UX/report.
- **fail:** token عالي التركّز يظهر جاهزاً بلا سبب/veto أو كطلب طبيعي.
- **evidence:** top_holder_risk عالٍ → component_veto=true؛ مصدر غائب → unavailable.
- **example:** cluster_ownership_concentration=HIGH → readiness veto + reason.

### 12.3 Natural vs Artificial Pump (W2-03)
- **positive:** `candidate_pump_classification` منفصل عن raw price، يظهر مع `_reason`/`_confidence` · `artificial_*` يظهر كسبب watch_only/rejection/readiness reduction.
- **negative:** raw price movement وحده كـ natural_pump = fail · `unknown_or_insufficient_evidence` كـ natural demand = fail · التصنيف يضيف buy/execute/submit = fail · `natural_pump` = دخول تلقائي = fail.
- **pass:** price-not-proof محفوظ · unknown يظهر uncertain · artificial يخفّض الجاهزية/يحوّل للمراقبة.
- **fail:** price spike يتحوّل demand/entry بلا evidence.
- **evidence:** سلسلة wash → artificial_pump_wash_trading؛ price up بلا أدلّة → unknown.
- **example:** classification=kol_or_bot_amplified_pump → readiness reduction.

### 12.4 Wallet Drift Alert (W2-04)
- **positive:** drift بعد التفعيل يظهر كـ `candidate_wallet_drift_signal` مع `candidate_wallet_drift_reason` · `candidate_wallet_drift_recommendation` advisory (يبني على `candidate_wallet_behavior_drift_flag`).
- **negative:** drift يغلق مراكز تلقائياً = fail · يغيّر config تلقائياً = fail · يضيف command = fail · recommendation تطبّق نفسها = fail.
- **pass:** alert/recommendation واضحان، والقرار عبر user/config flow.
- **fail:** drift يؤدي إلى pause/reduce/config change/position close تلقائياً.
- **evidence:** reason=copyability_degraded → recommendation=reduce_size (advisory، بلا تطبيق).
- **example:** drift→require_review دون تنفيذ تلقائي.

### 12.5 Default Copy Mode Policy (W2-05)
- **positive:** محفظة متبوعة جديدة بلا `copy_mode` صريح → `follow_entry_user_exit` · `full_mirror` Advanced-only · legacy بلا `copy_mode` واضح → safe-default أو requires review.
- **negative:** `full_mirror` default = fail · silent full_mirror = fail · implicit persisted full_mirror = fail · advanced confirmation field غير مسجّل في SSOT = fail · onboarding/add-wallet يختار full_mirror تلقائياً = fail.
- **pass:** default آمن وواضح؛ `full_mirror` يتطلّب explicit per-wallet enablement.
- **fail:** أي مسار إضافة محفظة بـ full_mirror دون اختيار صريح.
- **evidence:** add-wallet بلا اختيار → copy_mode=follow_entry_user_exit؛ لا حقل confirmation جديد.
- **example:** legacy wallet بلا copy_mode → requires review، لا full_mirror.

### 12.6 Creator / Cluster Learning (W2-06)
- **positive:** `candidate_creator_cluster_learning` historical لا snapshot · `_confidence`/`_provenance` ظاهرة · point-in-time محفوظ عبر `candidate_wt_point_in_time` · `_recommendation` advisory.
- **negative:** future leakage = fail · حذف failed/dead/disappeared launches من العينة = fail · low-confidence كحقيقة = fail · auto-ban = fail · auto-config = fail · avoid/reduce/watch_only تطبّق تلقائياً = fail.
- **pass:** يشرح تاريخياً ويوصي فقط.
- **fail:** creator/cluster يسبّب ban/config change تلقائي أو يستخدم بيانات مستقبلية.
- **evidence:** تقييم@T يستبعد بيانات>T؛ الإطلاقات الفاشلة حاضرة في العينة.
- **example:** creator dump_rate عالٍ تاريخياً → recommendation=watch_only (advisory).

### 12.7 Adverse Selection (W2-07)
- **positive:** `candidate_adverse_selection_metric` يقيس فقدان edge بين القائد والتابع · `_severity` مع `_reason` · high severity يظهر advisory warning.
- **negative:** خلط leader P&L بـ copier P&L = fail · leader profitability = copier profitability = fail · high يمنح execution authority = fail · high يغيّر config تلقائياً = fail.
- **pass:** النظام يشرح لماذا محفظة رابحة قد لا تكون رابحة للتابع.
- **fail:** ranking/copyability يخلط ربح القائد بالتابع أو يتجاهل latency/slippage.
- **evidence:** `candidate_leader_vs_copier_delta` سالب رغم ربح القائد → severity=high.
- **example:** reason=latency_drag + slippage_from_delay → severity=high (advisory).

### 12.7a Copyability Veto (Gap C · يستهلك SSOT Group 18)

> يستهلك `candidate_copyability_component_veto` · `candidate_copyability_veto_reason` (ARCH §4.4.5 · DATA §5.6 · API §17.7a · UX §28.7a). **acceptance/regression فقط — لا حقول/أوامر/سطوح جديدة؛ كل reason يُطابق مكوّناً قائماً 1:1.**

- **risky wallet type:** positive: نوع خطر (insider/dev/sniper/copycat عبر `candidate_wallet_type`) → `candidate_copyability_component_veto=true` + `candidate_copyability_veto_reason=risky_wallet_type`؛ المحفظة **لا تُرقَّى إلى `copy_allowed`**. negative: نوع خطر يُرقّى إلى copy_allowed = fail.
- **fake profit:** positive: ربح self/wash/circular → `fake_profit_risk` (يبني على `candidate_fake_profit_adjusted_edge`). negative: fake profit يرفع copyability/ranking إلى copy_allowed = fail.
- **high adverse selection:** positive: `candidate_adverse_selection_severity=high` → `adverse_selection_high`. negative: عرضه كـ copyable edge = fail.
- **crowd-follow decay:** positive: ازدحام نسخ مرتفع (`crowd_follow_score`) → `crowd_follow_decay`. negative: معاملته كـ social proof إيجابي = fail.
- **profit concentration one-hit:** positive: تركّز ربح في رمز واحد (`profit_concentration`) → `profit_concentration_one_hit`. negative: معاملته كـ edge مستقرّ متكرّر = fail.
- **non-copyable profit source:** positive: insider/artificial-pump/one-off (`candidate_profit_source_copyability_class=non_copyable`) → `non_copyable_profit_source`. negative: دخوله copyable edge = fail.
- **insufficient evidence:** positive: دليل غير كافٍ/low-confidence → `insufficient_evidence`. negative: عرضه كـ «صفر مخاطر» = fail · كـ `copy_allowed` = fail.
- **status behavior:** positive: `candidate_copyability_component_veto=true` → `tracked_wallet_status ≠ copy_allowed`، حلّ متحفّظ `watch_only`/`degraded` حسب الشدّة/السياق/السياسة.
- **read-only:** negative: كتابة `tracked_wallet_status`/`candidate_copyability_component_veto`/`candidate_copyability_veto_reason` → `READ_ONLY_FIELD_REJECTED`.
- **UX/API honesty:** negative: API يقبلهما في write request = fail · UX يحسبهما محلياً = fail · UX لا يشرح سبب عدم القابلية = fail.
- **opaque score forbidden:** negative: ظهور `wallet_trust_score`/`copyability_score` مُعتم/ranking-score جديد كحقل معتمد = fail.
- **no authority expansion:** negative: منح execution/command authority = fail · auto-ban/auto-close/auto-config = fail · `copy_event` جديد = fail · opportunity execution = fail · إغلاق مراكز قائمة تلقائياً = fail.
- **banned semantics:** positive: `banned` = سياسة متابعة/تقييم فقط. negative: معاملته كحظر أمني لمحفظة التنفيذ = fail · إغلاق مراكز تلقائي = fail · تغيير config تلقائي = fail.
- **evidence:** محفظة `wallet_type=insider_wallet` (conf عالية) → veto=true + reason=risky_wallet_type + `tracked_wallet_status` ليست copy_allowed؛ ومحفظة بأدلّة ناقصة → reason=insufficient_evidence لا «صفر مخاطر».

### 12.7b Edge Health Advisory (Gap D · يستهلك SSOT Group 26)

> يستهلك `candidate_edge_health_status` (ARCH §7 Edge Health · DATA §5.6 · API §17.7b · UX §28.7b) + إشارات قائمة فقط. **acceptance/regression فقط — advisory-first؛ لا حقول/أوامر/سطوح جديدة.**

- **healthy:** positive: دليل كافٍ وغياب إشارات edge سلبية كبيرة → قد يكون `healthy`. negative: `healthy` يمنح execution authority = fail.
- **weakening:** positive: ارتفاع `candidate_paper_real_divergence_status`/تدهور `candidate_leader_vs_copier_delta`/سوء `entry_slippage_vs_leader`/`candidate_wallet_drift_signal`/ارتفاع `candidate_failed_attempt_cost` → قد يُنتج `weakening`؛ advisory مع توصية review/reduce_size من المفردات القائمة. negative: `weakening` يطبّق config/يغلق مركزاً تلقائياً = fail.
- **no_edge_suspected:** positive: تركيبة سلبية مستمرّة (divergence عالٍ + adverse_selection عالٍ + `candidate_net_business_pnl` سالب + drift/copyability متدهورة) → قد يُنتج `no_edge_suspected` **كتحذير استشاري**. negative: إغلاق مراكز/تعطيل دخول/حظر محفظة/تغيير config **تلقائياً** = fail · معاملته كأمر تنفيذ = fail.
- **insufficient_evidence:** positive: عيّنة غير كافية/دليل غير متاح/low-confidence (`minimum_sample_size`/`candidate_paper_settings_evidence_status`) → `insufficient_evidence`. negative: معاملته كصفر مخاطر = fail · كدليل ميزة = fail.
- **paper ≠ real:** negative: أداء Paper يُمثَّل كميزة Real = fail · ترقية paper→real/live بلا إظهار `candidate_paper_real_divergence_status` = fail · إشارة paper-only تصير live proof = fail.
- **read-only:** negative: كتابة `candidate_edge_health_status` → `READ_ONLY_FIELD_REJECTED` · حساب الواجهة له محلياً = fail.
- **recommendation reuse:** positive: التوصية من `candidate_wallet_drift_recommendation`/`candidate_recommendation_type` القائمة. negative: مفردة توصية/سبب جديدة = fail · `paper_only_recommended`/`disable_new_entries_recommended` كقيمة = fail.
- **no authority expansion:** negative: منح execution/command authority = fail · forced live blocker = fail · auto-ban/auto-close/auto-config/auto-disable = fail · `copy_event` جديد = fail · opportunity execution = fail · إغلاق مراكز قائمة تلقائياً = fail.
- **forbidden fields/scores:** negative: ظهور `candidate_uncopyable_flag` كحقل = fail · edge score مُعتم/`wallet_trust_score` كحقل = fail · enum سبب/توصية جديد = fail.
- **honesty:** negative: إخفاء ميزة ميتة/متدهورة كأنها رابحة = fail · عرض `no_edge_suspected` كأمر = fail · عرض `insufficient_evidence` كآمن = fail.
- **evidence:** محفظة: divergence=high + adverse=high + net_business_pnl سالب + drift=copyability_degraded → `no_edge_suspected` (تحذير + توصية switch_to_watch_only advisory، بلا فعل تلقائي)؛ محفظة عيّنتها أقلّ من `minimum_sample_size` → `insufficient_evidence` لا `healthy`.

### 12.7c Wallet Decision Trace (Gap E · تأليف عرضي — UX §13.4a)

> أثر قرار المحفظة = **تأليف عرضي/read-only فوق حقول قائمة فقط** (UX §13.4a). **acceptance/regression فقط — صفر أسماء جديدة.**

- **composition-only:** positive: الأثر عرض/تجميع فوق حقول مُسجَّلة. negative: إنشاء حقل/مورد/endpoint/أمر/اسم SSOT جديد للأثر = fail.
- **existing fields only:** positive: يعرض/يُعيد استخدام مُسجَّلة فقط (`tracked_wallet_status` · `candidate_copyability_component_veto`/`_reason` · `candidate_edge_health_status` · `candidate_wallet_drift_reason`/`_recommendation` · `candidate_adverse_selection_severity` · `candidate_fake_profit_adjusted_edge` · `candidate_profit_source_copyability_class` · `candidate_wallet_type` · `candidate_leader_position_change_pct`/`candidate_leader_balance_reconstruction_status` · `candidate_token_safety_reason` · `accepted_reason`/`rejected_reason`). negative: أي سبب/حقل غير مُسجَّل = fail.
- **no new resource:** negative: ظهور `wallet_decision_trace` كحقل/مورد/`resource_type` = fail · `decision_trace_view` كحقل = fail.
- **no new taxonomy:** negative: إدخال taxonomy أسباب موازية = fail؛ يُعيد استخدام حقول reason/status القائمة فقط.
- **no opaque score:** negative: `wallet_decision_score`/`wallet_trust_score`/score مُعتم = fail.
- **read-only / no local calc:** positive: الأثر read-only. negative: حساب الواجهة مخاطر/ميزة محلياً = fail · تحرير أي مُدخَل/مُخرَج للأثر = fail.
- **honesty:** negative: عرض `insufficient_evidence` كآمن = fail · أداء Paper كميزة Real = fail · `no_edge_suspected` كأمر = fail · `banned` كحظر أمني لمحفظة تنفيذ = fail.
- **layered display:** positive: ملخّص → سبب أساسي → تشخيصات داعمة → canonical في advanced (canonical عرض فقط).
- **no authority expansion:** negative: منح execution/command authority = fail · أزرار buy/sell/execute/mirror/promote-to-copy = fail · auto-ban/auto-close/auto-config/auto-disable = fail · `copy_event` جديد = fail · opportunity execution = fail.
- **action routing:** positive: أي فعل عبر تدفّقات wallet/config/user/permission/audit القائمة؛ الأثر تفسير لا فعل.
- **evidence:** محفظة `watch_only` بسبب veto=true (reason=risky_wallet_type) + `edge_health=weakening` → الأثر يعرض الملخّص + السببين من الحقول القائمة، read-only، بلا اسم/score جديد ولا زرّ فعل.

### 12.7d Classifier Validation Minimums (Gap F · Test-only)

> حدود تحقّق دنيا للمصنّفات القائمة عبر **fixtures مُعنوَنة** (لا precision/recall رقمي صلب)، بإعادة استخدام منهجية «control + adversarial» و«Adversarial fixtures إلزامية» (§4). **صفر أسماء جديدة · لا score مصنّف/جودة · لا حقل/enum/Config.** كل عائلة مصنّف تتطلّب: positive + negative + adversarial fixtures · حارس false-positive · حارس false-negative · confidence/provenance حيث يعرضهما المصنّف · point-in-time/survivorship-free حيث يهمّ الزمن · low-confidence ليست حقيقة · insufficient_evidence ليست آمنة/دليل ميزة · **لا ترقية `copy_allowed` ولا execution authority من مخرَج منخفض الثقة/المصنّف وحده**.

- **wash / fake profit (`candidate_fake_profit_risk`/`_reason`/`candidate_fake_profit_adjusted_edge`):** positive: fixture wash/self/circular/fake-volume → fake-profit risk+reason. negative(FP): تداول عالي التردّد شرعي **لا** يُوسَم wash بلا دليل = شرط. negative(FN): نمط wash واضح لا يمرّ صامتاً. fail: fake profit يرفع ranking/copyability.
- **sybil / cluster (`candidate_cluster_id`/`_confidence`/`_method`/`_provenance`/`candidate_cluster_confidence_min`):** positive: fixture sybil/cluster معروف → تصنيف مع confidence/provenance. negative(FP): محافظ غير مرتبطة لا تُعنقَد بلا دليل. fail: cluster منخفض الثقة يُعرَض كـ known cluster.
- **wallet taxonomy (`candidate_wallet_type`/`_confidence`/`_provenance`):** positive: dev/insider/sniper/copycat مع confidence/provenance حيث توفّر. negative(FP): متداول عادي لا يُصنَّف خطراً بلا دليل. fail: النوع الخطر يرقّي `copy_allowed`.
- **creator/dev linkage (`candidate_creator_cluster_learning_confidence`/`_provenance` · creator signals):** positive: fixture مرتبط بالمنشئ/المطوّر يُكشَف مع provenance. negative(FP): منشئ غير مرتبط يبقى unlinked. fail: linkage يُستخدَم كـ copyable edge.
- **adverse selection (`candidate_adverse_selection_severity`):** positive: fixture adverse عالٍ → severity=high. negative(FP): محايد/منخفض لا يُصعَّد بلا دليل. fail: high يُعرَض كـ copyable edge.
- **wallet drift (`candidate_wallet_drift_signal`/`_reason`/`_recommendation`):** positive: fixture انحراف سلوك → signal+reason+recommendation. negative(FP): سلوك مستقرّ لا يُطلِق drift. fail: التوصية تتحوّل لفعل تلقائي (تبقى advisory).
- **crowd-follow / crowding (`crowd_follow_score`):** positive: fixture ازدحام/تآكل → يُكشَف. negative(FP): متابعة مستقلّة عضوية لا تُعامَل تآكلاً بلا دليل. fail: الازدحام يُعامَل social proof إيجابياً.
- **profit source attribution (`candidate_profit_source_copyability_class`):** positive: insider/artificial-pump/one-off → `non_copyable`. negative(FP): سلوك قابل للنسخ متكرّر لا يُوسَم non_copyable خطأً. fail: non_copyable يدخل copyable edge.
- **point-in-time / survivorship-free discovery (`candidate_wt_point_in_time`/`minimum_sample_size`):** positive: اكتشاف عند T يستخدم بيانات ≤ T فقط · المحافظ الميتة/الفاشلة/المختفية تبقى في الـ cohort. fail: تسرّب من المستقبل = fail · cohort متحيّز بقاءً = fail · عيّنة < `minimum_sample_size` تُعامَل كافية = fail.
- **confidence/evidence honesty (عام):** fail: low-confidence يُعرَض كحقيقة · insufficient_evidence يُعرَض آمناً أو دليل ميزة · المفقود يُعرَض صفراً بدل unavailable/insufficient.
- **copyability protection (عام):** fail: مخرَج منخفض الثقة/insufficient_evidence يرقّي `tracked_wallet_status` إلى `copy_allowed` · مخرَج مصنّف وحده يفتح execution/command authority أو opportunity execution.
- **fixture requirements (عام):** كل عائلة مصنّف تملك ≥ positive + negative + adversarial · حالات حارس FP وFN · provenance/point-in-time metadata حيث صلتها.

### 12.8 Cross-Document Consistency (W2)
- كل أسماء W2 في Test Plan موجودة في **SSOT Group 38** أو قائمة = pass (وإلا fail) · **لا field جديد في Test Plan**.
- ARCH §15.10 مفاهيم فقط · CONFIG §14 يثبت default copy mode ولا يجعل full_mirror default · API §17 read-only/derived/advisory · Data §11 projections/read-models/notes · UX §28 بلا أزرار تنفيذ · Build §11 بلا runtime/migrations/commands.
- no execution authority من W2 · no auto-ban · no auto-config · full_mirror not default/silent · low-confidence not fact · unknown pump not demand · concentration not demand · ربحية القائد لا تعني ربحية التابع · unavailable/insufficient evidence not zero risk · لا اسم خارج SSOT.

### 12.9 Regression Guards (W2)
- taxonomy يرفع copyability لـ insider/dev/sniper/copycat = fail · low-confidence كحقيقة = fail.
- concentration كطلب طبيعي = fail · concentration بمصدر غائب كـ zero risk = fail.
- price spike كـ natural pump = fail · `unknown_or_insufficient_evidence` كـ natural_pump = fail.
- drift يوقف/يغلق مراكز تلقائياً = fail · drift يغيّر config تلقائياً = fail.
- `full_mirror` default = fail · silent full_mirror = fail · implicit persisted full_mirror = fail.
- creator/cluster auto-ban = fail · auto-config = fail · future leakage = fail · survivorship bias = fail.
- adverse selection high يصير execution authority = fail · leader P&L مخلوط بـ copier P&L = fail.
- إشارة W2 تُدخِل buy/execute/submit = fail · أي command/resource جديد = fail · advanced confirmation field بلا SSOT = fail.

> **مبدأ §12:** Wave 2 مغلقة باختبارات قبول/انحدار: نوع المحفظة احتمالي ولا يرفع copyability للأنواع الخطرة ولا يمنح تنفيذاً · التركّز يفعل veto لا طلباً طبيعياً · pump منفصل عن السعر و«unknown ليس demand» · drift/learning/adverse-selection advisory بلا auto-ban/auto-config · learning point-in-time/survivorship-free · ربحية القائد لا تعني ربحية التابع · `full_mirror` ليس default/صامت. **لا اسم خارج SSOT · لا تغيير وثائق أخرى · لا live.**

---

## 13. Wave 3 — Reports & Honesty — Tests & Acceptance (candidate, تستهلك SSOT Group 39)

> acceptance/negative/consistency/regression على مستوى التوثيق — **لا implementation code · لا migrations · لا live · لا تشغيل tests فعلي · لا report generation implementation · لا final template IDs.** يُحوّل §15.11 (ARCH) + Group 39 (SSOT) + §15 (CONFIG) + §18 (API) + §12 (DATA) + §29 (UX) + §12 (BUILD) إلى AC قابلة للاختبار. كل الأسماء API-facing من **SSOT Group 39** أو قائمة — **لا حقل جديد هنا.** **لا تقرير/مقياس/disclaimer يمنح execution authority · لا تغيير سلوك EV gate/Hard Risk · لا execution mode · لا خلط Paper/Testnet/Real-Live · `warning_only_advisory` ليس `clean_pass` · unavailable/insufficient evidence ليس صفراً · لا عرض الأداء السابق/Paper/Backtest كضمان ربحية.**

### 13.1 Daily Unified Report (W3-01)
- **positive:** `candidate_daily_unified_report` بأقسام `candidate_report_section` (الـ11) مفصولة · كل section يحمل `candidate_report_context` (simulated/testnet/real_live) عند الحاجة · المقياس المفقود `show_unavailable`/insufficient evidence (عبر `candidate_report_missing_metric_policy`).
- **negative:** خلط Paper/Testnet/Real-Live بصرياً/حسابياً = fail · missing metric كصفر = fail · report يمنح execution authority = fail · زر apply/execute من التقرير = fail.
- **pass:** موحّد لكنه يفصل السياقات ويعرض evidence/provenance؛ كل missing موسومة لا مختلقة.
- **fail:** Paper ضمن Real/Live · unavailable كـ 0 · التقرير يفعّل/يوصي بتنفيذ تلقائي.
- **evidence:** قسم paper_results بـ context=simulated منفصل؛ مقياس غائب=unavailable لا 0.
- **example:** daily report بـ real_live_results + testnet_results في أقسام مستقلة بـ provenance.

### 13.2 Report Definitions Catalog (W3-02)
- **positive:** `candidate_report_catalog` يعرض `candidate_report_definition_type` (الـ13)؛ كل `candidate_report_definition` يصرّح scope/context/dimensions/metrics/evidence(`candidate_report_provenance`)/missing-metric/disclaimer/paper-real-separation.
- **negative:** custom report يستبدل official = fail · template ID نهائي غير مسجّل = fail · report generation command جديد = fail · definition بلا missing-metric policy = fail.
- **pass:** كتالوج رسمي واضح بـ provenance ومتطلبات كل تقرير.
- **fail:** custom كبديل رسمي · definition ناقص scope/context أو paper/real separation.
- **evidence:** net_business_pnl_report/weekly_comparison_report ضمن الأنواع الرسمية بسماتها الثماني.
- **example:** custom report موسوم «custom» لا يحجب daily_unified_report الرسمي.

### 13.3 Weekly Comparison Report (W3-03)
- **positive:** `candidate_weekly_comparison_report` يدعم `candidate_weekly_comparison_axis` (الـ10) · `config_before_after` يستخدم `config_version_at_entry` · الفروقات المفقودة `unavailable`.
- **negative:** report يطبّق config تلقائياً = fail · خلط Paper/Real/Live = fail · missing comparison كصفر = fail · weekly يثبت ربحية مستقبلية = fail.
- **pass:** يشرح «ما تغيّر ولماذا قد يتغيّر الأداء» بلا auto-apply.
- **fail:** يقترح/يطبّق config مباشرة · يستخدم config version خاطئ/مفقود.
- **evidence:** محور config_before_after يعرض config_version_at_entry للطرفين؛ فرق غائب=unavailable.
- **example:** paper_real_divergence axis دون خلط الحسابات.

### 13.4 Disclaimer Standard (W3-04)
- **positive:** التقارير الحساسة (`candidate_report_disclaimer_required_for`: paper/backtest/weekly/recommendation/promotion) تحمل `candidate_report_disclaimer_requirement` (الستة).
- **negative:** advanced mode يخفي disclaimers = fail · disclaimer يصحّح report invalid = fail · يحلّ محلّ gates = fail · يمنح execution authority = fail · recommendation تطبّق نفسها بسبب disclaimer = fail.
- **pass:** disclaimer واضح في مكان مرئي.
- **fail:** report حساس بلا disclaimer · disclaimer مدفون/مخفي advanced · يُستخدم لتجاوز gate أو تصحيح تقرير ناقص evidence.
- **evidence:** paper report يحمل paper_not_live_profitability؛ backtest يحمل backtest_requires_point_in_time_evidence.
- **example:** recommendation report بـ recommendations_are_advisory_until_user_config_flow ظاهر.

### 13.5 Net Business PnL (W3-05)
- **positive:** `candidate_net_business_pnl_report` derived منفصل عن trade P&L · `candidate_net_business_pnl_status` (complete/partial/unavailable) · `candidate_business_cost_component` (الأربعة) · positive trade P&L لا يعني positive business P&L.
- **negative:** unavailable/partial كصفر = fail · Net Business PnL كـ execution authority = fail · خلط wallet-level مع business-level بلا label = fail · runtime cost source field غير مسجّل = fail.
- **pass:** يوضّح complete/partial/unavailable؛ business-level label واضح.
- **fail:** costs مفقودة كصفر · يُستخدم كإذن تنفيذ · trade P&L موجب يُعرض كـ business P&L موجب بلا احتساب/disclosure.
- **evidence:** cost غائب → status=partial + مكوّن unavailable (reuse `candidate_realized_pnl`/`_fees_total`/`_slippage_cost`/`_storage_usage_metric`).
- **example:** trade P&L موجب + infra costs عالية → net_business_pnl سالب أو partial.

### 13.6 warning_only Report Tag (W3-06)
- **positive:** كل report/result تأثّر بـ `warning_only` يعرض disclosure · `candidate_report_gate_context` (clean_pass/warning_only_advisory/blocked) · `candidate_warning_only_report_tag` (true/false) · failed EV يبقى مرئياً.
- **negative:** `warning_only_advisory` كـ `clean_pass` = fail · warning_only يغيّر EV gate behavior = fail · يضعف Hard Risk = fail · يضيف execution mode = fail · report promotion بلا disclosure = fail.
- **pass:** يوضّح أن النتيجة advisory لا clean pass.
- **fail:** warning_only يخفي failed EV · يظهر كنجاح clean · promotion بلا disclosure.
- **evidence:** نتيجة أُنتجت أثناء `ev_gate_mode=warning_only` → tag=true + gate_context=warning_only_advisory (يتّسق `WARNING_CRITICAL`).
- **example:** promotion report يكشف warning_only_advisory بوضوح لا clean_pass.

### 13.7 Cross-Document Consistency (W3)
- كل أسماء W3 في Test Plan موجودة في **SSOT Group 39** أو قائمة = pass (وإلا fail) · **لا field جديد في Test Plan**.
- ARCH §15.11 مفاهيم فقط · CONFIG §15 policy/disclosure بلا تغيير EV gate/Hard Risk · API §18 read-only/report/derived · Data §12 report artifacts/projections · UX §29 بلا أزرار تنفيذ/توليد · Build §12 بلا runtime/migrations/commands/generation.
- لا execution authority من reports/metrics/disclaimers · لا تغيير EV gate/Hard Risk · لا execution mode · لا خلط Paper/Testnet/Real-Live · unavailable/insufficient evidence ليس zero · القوالب الرسمية لا تستبدلها custom · disclaimers لا تختفي advanced ولا تجعل invalid valid · Net Business PnL derived reporting only · positive trade P&L لا يعني positive business P&L · `warning_only_advisory` ليس `clean_pass` · failed EV يبقى مرئياً تحت warning_only · لا report generation implementation · لا final template IDs غير مسجّلة · لا اسم خارج SSOT.

### 13.8 Regression Guards (W3)
- Paper/Testnet/Real-Live report mixing = fail · missing metric/insufficient evidence كصفر = fail.
- daily report يمنح execution authority = fail · report apply/auto-apply = fail.
- custom report يستبدل official definition = fail · report definition بلا scope/context/dimensions/metrics/provenance/missing-policy/disclaimer = fail.
- weekly يطبّق config تلقائياً = fail · weekly يتجاهل `config_version_at_entry` = fail.
- تقرير حساس بلا disclaimer = fail · advanced يخفي disclaimer = fail · disclaimer يتجاوز gates = fail · disclaimer يجعل invalid report valid = fail.
- Net Business PnL يُعامَل كـ trade P&L = fail · يستخدم costs مفقودة كصفر = fail · positive trade P&L يُعرَض positive business P&L بلا cost evidence = fail.
- `warning_only_advisory` كـ `clean_pass` = fail · failed EV مخفي بـ warning_only = fail · warning_only يغيّر EV gate behavior = fail · يضعف Hard Risk = fail · ينشئ execution mode = fail · promotion بلا warning_only disclosure = fail.
- إشارة W3 تُدخِل buy/execute/submit = fail · أي command/resource جديد = fail · final report template ID بلا SSOT = fail.

> **مبدأ §13:** Wave 3 مغلقة باختبارات قبول/انحدار: التقرير اليومي موحّد بأقسام/context مفصولة · المقياس المفقود unavailable لا صفر · القوالب الرسمية لا تستبدلها custom · weekly يحترم config_version بلا auto-apply ولا يثبت ربحية مستقبلية · disclaimer إلزامي لا يُخفى ولا يصحّح تقريراً غير صالح · Net Business PnL derived (trade≠business، unavailable/partial لا صفر) · `warning_only_advisory` ليس `clean_pass` وfailed EV يبقى مرئياً. **لا اسم خارج SSOT · لا تغيير وثائق أخرى · لا live.**

---

## 14. Wave 4 — Execution / Providers + Data — Tests & Acceptance (candidate, تستهلك SSOT Group 40)

> acceptance/negative/consistency/regression على مستوى التوثيق — **لا implementation code · لا migrations · لا live · لا تشغيل tests فعلي · لا provider setup/connection impl · لا report generation impl.** يُحوّل §15.12 (ARCH) + Group 40 (SSOT) + §16 (CONFIG) + §19 (API) + §13 (DATA) + §30 (UX) + §13 (BUILD) إلى AC قابلة للاختبار. كل الأسماء API-facing من **SSOT Group 40** أو قائمة — **لا حقل جديد هنا.** **لا provider raw key/secret/credential · key material خارج كل المخارج · لا provider connection/execution/purge command · لا تقرير/مقياس يمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · المفقود unavailable/partial لا صفر/clean.**

### 14.1 Provider Latency Comparison (W4-01)
- **positive:** `candidate_provider_latency_metric`/`_latency_type` (الستة)/`_latency_comparison` (+`provider_degraded`/`slot_lag`/`candidate_ts_*`) · best/worst تشخيصي · latency مفقودة → unavailable.
- **negative:** latency مفقودة كصفر = fail · fast provider كـ safe/executable = fail · comparison يغيّر provider selection تلقائياً = fail · execution authority = fail · write/command = fail.
- **pass:** projection/report يوضّح النوع/المصدر/الحالة. **fail:** provider سريع كجاهز للتنفيذ · missing=0 · best→auto-select.
- **evidence:** stream_latency عالٍ + send_latency مفقود=unavailable؛ comparison بلا auto-select.
- **example:** أسرع مزوّد بـ provider_degraded لا يظهر executable.

### 14.2 Rate-limit & Provider Cost Monitor (W4-02)
- **positive:** `candidate_provider_rate_limit_monitor`/`_provider_cost_metric` (العشرة)/`_provider_cost_attribution_status` (complete/partial/unavailable) · يربط بـ `candidate_net_business_pnl`/`candidate_business_cost_component` · availability وaffordability منفصلتان.
- **negative:** partial/unavailable كصفر = fail · provider cost يمنح execution authority = fail · billing/pricing field نهائي غير مسجّل = fail · يعيد تعريف Net Business PnL = fail.
- **pass:** cost report يوضّح attribution status وmissing evidence. **fail:** missing cost كصفر · availability كـ affordability · cost يفعّل قرار تنفيذ.
- **evidence:** cost_per_trade غائب → attribution=partial؛ توفّر مرتفع + كلفة مرتفعة معاً.
- **example:** مزوّد متاح لكن مكلف → business PnL سالب محتمل دون منع تنفيذ.

### 14.3 Fork / Rollback (W4-03)
- **positive:** `candidate_finality_state` (الخمسة)/`candidate_rollback_fork_reason` (+`NETWORK_ROLLBACK_EVENT`/`provider_degraded`/`slot_lag`) · rollback-affected data warning/provenance · حالة مستقلة لا stream gap فقط.
- **negative:** rollback-affected كحقيقة نهائية = fail · `no_rollback_detected` كـ execution-safe = fail · gate جديد = fail · تغيير Risk Gates/Hard Risk = fail · execution authority = fail.
- **pass:** report/API/UX يوضّح finality state والسبب/provenance. **fail:** rollback data كحقيقة نهائية · rollback detector ينشئ gate/command تنفيذ.
- **evidence:** rollback_confirmed → البيانات موسومة؛ no_rollback_detected لا يرفع readiness.
- **example:** fork_detected يظهر context في decision trace لا يمنح تنفيذاً.

### 14.4 Provider Onboarding & Key/Connection Validation (W4-04)
- **positive:** `candidate_provider_onboarding_status`/`_provider_type` (الخمسة)/`_provider_capability_status`/`_provider_connection_test_status`/`_provider_onboarding_failure_reason` (+`candidate_provider_key_ref` مرجع فقط) · onboarding تشخيصي · Jupiter validation عند quotes/routes.
- **negative:** raw key/secret/credential في API/UI/report/export/diagnostics/backups = fail · connection success كـ trading readiness = fail · provider readiness يتجاوز SignerService/Risk Gates/admission gates = fail · provider connection command = fail · provider setup implementation = fail · execution authority = fail.
- **pass:** key material غائب، الحالة تشخيصية فقط. **fail:** raw key في أي output · connection success يفعّل readiness/execution · provider setup command يظهر.
- **evidence:** Jupiter connection_test_status=ok لا يرفع trading readiness؛ key_ref مرجع لا قيمة.
- **example:** helius onboarding ناجح لا يتجاوز signer/risk gates.

### 14.5 Storage Cost + Survivorship-Safe Retention (W4-05)
- **positive:** `candidate_storage_cost_report`/`_storage_cost_component` (الستة)/`_retention_impact_warning`/`_pruning_safety_status` (safe/survivorship_risk/point_in_time_risk/audit_integrity_risk) · retention warning يوضّح الفئات المتأثّرة · يرتبط بـ Net Business PnL.
- **negative:** missing storage cost كصفر = fail · cost-saving deletion كآمن مع survivorship bias = fail · purge command = fail · storage pricing/billing fields نهائية = fail · execution authority = fail.
- **pass:** pruning safety واضح ويمنع القراءة الخاطئة. **fail:** deletion يخلق survivorship bias بصمت · point-in-time loss بلا warning · missing cost كصفر.
- **evidence:** حذف dead/failed wallets → pruning_safety_status=survivorship_risk + warning؛ cost غائب=partial.
- **example:** تقليص retention للـ replay datasets → point_in_time_risk warning.

### 14.6 Rejected Opportunity Re-evaluation (W4-06)
- **positive:** `candidate_rejected_opportunity_reevaluation`/`_reevaluation_trigger` (الثمانية)/`_reevaluation_recommendation` (الخمسة) (+`hunt_status`/`watch_only`/`candidate_rejected_reason`) · يحفظ original reason + original/new evidence snapshots/provenance · alert/recommendation فقط.
- **negative:** re-evaluation تنتج buy/execute/open-position = fail · auto-config = fail · improved opportunity كدليل edge = fail · `eligible_for_normal_evaluation` كـ execution-ready = fail · execution authority = fail.
- **pass:** comparison يشرح ما تغيّر دون فتح تنفيذ. **fail:** rejected→buy/execute · eligible_for_paper يفتح position · تحسّن السيولة كدليل edge.
- **evidence:** liquidity_improved → recommendation=review_again (advisory)؛ snapshots محفوظة.
- **example:** exit_feasibility_improved → eligible_for_paper لا فتح مركز.

### 14.7 Best Paper Settings This Week Advisory (W4-07)
- **positive:** `candidate_best_paper_settings_advisory`/`_paper_settings_recommendation`/`_paper_settings_evidence_status` (sufficient/insufficient_evidence/unavailable) Paper-only (+`candidate_paper_aggregation_report`/`_paper_real_divergence`/`_weekly_comparison_report`/`_report_disclaimer_requirement`) · يعرض sample size/confidence/time period/mode/strategy/copy_mode/fees/slippage/latency/failure impact/paper-real divergence/disclaimer.
- **negative:** best paper setting كـ live-ready = fail · auto-apply = fail · live promotion بلا gates/disclosure = fail · Paper كضمان live profitability = fail · execution authority = fail.
- **pass:** advisory موسوم Paper-only مع evidence. **fail:** best paper كإعداد live آمن · report يطبّق config · insufficient evidence كنجاح.
- **evidence:** عينة صغيرة → evidence_status=insufficient_evidence لا success؛ Paper-only badge.
- **example:** أفضل إعداد Paper يحمل disclaimer ولا يُروَّج live.

### 14.8 Graduation Trap States (W4-08)
- **positive:** `candidate_graduation_trap_state` (السبعة) (+`migration_phase`/`MIGRATION_IN_PROGRESS`/`candidate_token_readiness_component`) · يؤثّر على readiness/exit feasibility/reports · token risk detail يشرح الحالة.
- **negative:** graduation كـ exit-safe = fail · `post_graduation_watch_only` كـ buy/execute = fail · missing route/liquidity/exit evidence كـ clean/safe = fail · gate جديد = fail · execution authority = fail.
- **pass:** graduation trap ظاهر ومربوط بالجاهزية/الخروج. **fail:** migration/graduation يجعل التوكن safe · trap يحوّل opportunity إلى تنفيذ · missing exit evidence كـ clean.
- **evidence:** post_graduation_exit_unsafe → readiness/exit feasibility منخفض في التقرير.
- **example:** graduation_trap_confirmed يظهر في Token Risk لا يمنح تنفيذاً.

### 14.9 Cross-Document Consistency (W4)
- كل أسماء W4 في Test Plan موجودة في **SSOT Group 40** أو قائمة = pass (وإلا fail) · **لا field جديد في Test Plan**.
- ARCH §15.12 مفاهيم فقط · SSOT G40 مصدر الأسماء · CONFIG §16 policy/missing-evidence/advisory boundaries · API §19 read-only/advisory/diagnostic/report · Data §13 projections/read-models/report artifacts · UX §30 labels/warnings/panels بلا أزرار تنفيذ/connect/test/purge/apply/open-position · Build §13 build/verification expectations.
- لا execution authority · لا buy/execute/submit/write/open-position command · لا auto-execution · لا auto-config · لا provider connection command · لا provider setup implementation · لا raw key/secret/credential (fields أو displays) · key material خارج browser/UI/report/export/API payloads/backups/diagnostics · connection success ليس trading readiness · fast provider ليس safe/executable · availability وaffordability منفصلتان · rollback-affected ليست نهائية · cost-saving deletion لا يخلق survivorship bias · re-evaluated ليست أمر تنفيذ · best paper ليس live-ready · graduation ليس exit-safe · المفقود unavailable/partial لا صفر/clean · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · لا Wave 5+.

### 14.10 Regression Guards (W4)
- missing latency كصفر = fail · fast provider كـ safe/executable = fail · best/worst auto-selection = fail · latency يمنح execution authority = fail.
- missing provider cost كصفر = fail · availability كـ affordability = fail · provider cost يفعّل تنفيذاً = fail · provider cost يعيد تعريف Net Business PnL = fail.
- rollback-affected data كحقيقة نهائية = fail · `no_rollback_detected` كـ execution-safe = fail · rollback detector ينشئ gate/command = fail.
- raw key/secret/credential يتسرّب في API/UI/report/export/diagnostics/backups = fail · key material خارج secret system مُخزَّن = fail · connection test success كـ trading readiness = fail · provider readiness يتجاوز SignerService/Risk Gates/admission gates = fail · provider connection/setup command = fail.
- missing storage cost كصفر = fail · retention deletion يخلق survivorship bias = fail · point-in-time/audit data loss بلا warning = fail · purge command = fail.
- rejected re-evaluation تنشئ buy/execute/open-position = fail · re-evaluation auto-config = fail · improved opportunity كدليل edge = fail · `eligible_for_normal_evaluation` كـ execution-ready = fail.
- best paper settings كـ live-ready = fail · best paper auto-apply config = fail · paper advisory مُروَّج live بلا gates/disclosure = fail · insufficient/unavailable paper evidence كنجاح = fail.
- graduation كـ exit-safe = fail · `post_graduation_watch_only` كـ buy/execute = fail · missing route/liquidity/exit evidence كـ clean/safe = fail.
- إشارة W4 تُدخِل buy/execute/submit command = fail · provider connection command = fail · أي command/resource جديد = fail · تغيّر EV gate behavior = fail · تُضعِف Hard Risk/Risk Gates/SignerService = fail · تدخل Wave 5 scope = fail.

> **مبدأ §14:** Wave 4 مغلقة باختبارات قبول/انحدار: latency/cost/rollback/onboarding/storage/re-evaluation/best-paper/graduation كلها read-only/advisory/diagnostic بلا execution authority · key material عبر `candidate_provider_key_ref` فقط بلا raw key · المزوّد السريع/المتصل ليس آمناً/جاهزاً · توفّر وكلفة منفصلان · بيانات rollback موسومة لا نهائية · pruning آمن للبقاء · re-evaluated ليست أمر تنفيذ · best paper ليس live-ready · graduation ليس exit-safe · المفقود unavailable/partial لا صفر. **لا اسم خارج SSOT · لا تغيير وثائق أخرى · لا live · لا Wave 5+.**

---

## 15. Wave 5 — Local Ops & Readiness — Tests & Acceptance (candidate, تستهلك SSOT Group 41)

> acceptance/negative/consistency/regression على مستوى التوثيق — **لا implementation code · لا migrations/SQL · لا تشغيل tests فعلي · لا scripts/launcher/runtime · لا commands · لا live.** يُحوّل §15.13 (ARCH) + Group 41 (SSOT) + §17 (CONFIG) + §20 (API) + §14 (DATA) + §31 (UX) + §14 (BUILD) إلى AC قابلة للاختبار. كل الأسماء API-facing من **SSOT Group 41** أو قائمة — **لا حقل جديد هنا.** **لا raw key/secret/credential · لا secrets في logs/artifacts/diagnostics/backups · لا service-control/restart/shutdown/backup/restore/purge/rollback/migration command · لا تقرير/مقياس/status يمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · health green ليس trading readiness · documented_only/candidate ليس implemented · المفقود unavailable/unknown/not_verified لا clean/ready/implemented · PostgreSQL/source-of-truth authority محفوظة.**

### 15.1 Local Run UI-first Workflow (W5-01)
- **positive:** `candidate_local_run_workflow_status` (الستة)/`candidate_required_local_service` checklist/`candidate_local_run_missing_requirement`/`candidate_local_run_evidence_status` (present/partial/missing/stale/unknown)/`candidate_local_run_next_action` (إرشاد فقط).
- **negative:** `ready_for_local_use` كـ REAL-LIVE ready = fail · local app running كـ trading readiness = fail · missing/stale/unknown evidence كـ clean = fail · `candidate_local_run_next_action` كـ command/button = fail · launcher/runtime/script requirement = fail.
- **pass:** status/checklist/missing/evidence مرئية وnext_action نصي. **fail:** running→trading ready · missing→clean · next_action→زر.
- **evidence:** PostgreSQL+API موجودان وRedis missing → status=degraded/blocked + missing requirement واضح.
- **example:** لوحة Local Run بلا زر fix/run؛ next_action نص إرشادي.

### 15.2 Local Ops Health Screen (W5-02)
- **positive:** `candidate_local_ops_health`/`candidate_local_ops_service_type` (الـ15)/`candidate_local_ops_service_status` (healthy/degraded/unavailable/unknown/not_configured/blocked)/`candidate_local_ops_health_reason`/`candidate_local_ops_health_next_action` (+`signer_profile_status`/`operating_state`/`candidate_provider_onboarding_status`/`candidate_data_quality_metric`/`candidate_storage_usage_metric`)؛ degraded/unavailable بـ summary مفهوم.
- **negative:** `healthy` كـ execution-safe = fail · SignerService `healthy` كـ permission to sign = fail · provider_connectivity `healthy` كـ trading readiness = fail · restart/test/connect command/button = fail · bypass EV gate/Hard Risk/Risk Gates/SignerService = fail.
- **pass:** كل خدمة بـ status/reason/next-action تشخيصي. **fail:** healthy→execution-safe · signer healthy→permission to sign · stack trace فقط.
- **evidence:** signer_service healthy لكن `signer_profile_status` ليس ACTIVE → healthy diagnostic + warning «not permission to sign».
- **example:** بطاقات الخدمات الـ15 بلا أزرار تحكّم.

### 15.3 Operator Logs (W5-03)
- **positive:** log row بـ `candidate_operator_log_severity`/`_category`/`_service`/`_correlation_ref`/`_user_summary`/`_technical_detail` (collapsed)/`_safe_next_action`/`_redaction_status`؛ user_summary واضح؛ redaction status ظاهر؛ `blocked_contains_secret` يحجب display/export/artifact.
- **negative:** stack trace كالرسالة الوحيدة = fail · raw secrets/keys/tokens تظهر = fail · `safe_next_action` كـ command = fail · logs تمنح execution authority = fail.
- **pass:** technical_detail ثانوي وsecrets محجوبة. **fail:** secret يظهر/يُصدَّر · stack trace وحيد · next action→command.
- **evidence:** log يحوي token قبل redaction → `redaction_status=blocked_contains_secret`، لا عرض ولا تصدير.
- **example:** صف log بـ summary + detail مطويّ + redaction badge.

### 15.4 Migrations & Version Status (W5-04)
- **positive:** `candidate_api_version_status`/`_db_schema_version`/`_config_schema_version`/`_contracts_version_status`/`_migration_status` (الستة)/`_pending_migration`/`_failed_migration`/`_rollback_availability`/`_version_compatibility_status` (+`candidate_app_version`/`config_version`/`config_version_at_entry`/`migration_phase`/`MIGRATION_IN_PROGRESS`)؛ mismatch واضح.
- **negative:** failed/pending/blocked/unknown كـ clean = fail · `compatible` كـ execution authority = fail · current version كـ trading readiness = fail · migration/rollback command = fail · destructive migration = fail.
- **pass:** الإصدارات/الحالات/التوافق مرئية وmismatch ظاهر. **fail:** failed→clean · compatible→authority · زر migrate/rollback.
- **evidence:** `candidate_migration_status=failed` + pending migration → status failed/blocked + failed migration ظاهر، لا clean.
- **example:** لوحة الإصدارات بلا أزرار migrate/rollback.

### 15.5 Upgrade / Rollback Procedure (W5-05)
- **positive:** `candidate_upgrade_preflight_status`/`_upgrade_backup_requirement`/`_upgrade_migration_compatibility`/`_rollback_path_status`/`_upgrade_blocked_reason`/`_post_upgrade_health_verification`/`_upgrade_incident_status` (status/provenance/check-output فقط)؛ failed → incident/blocker؛ backup/export بلا raw secrets.
- **negative:** preflight `pass` كـ trading readiness = fail · `rollback_path_status=available` كـ rollback command = fail · failed upgrade كـ clean = fail · upgrade/rollback/backup/restore command = fail · implementation implication = fail.
- **pass:** كل الحالات مرئية «status only». **fail:** pass→trading ready · available→command · failed→clean.
- **evidence:** preflight pass لكن post-upgrade health warning → لا trading-ready badge + warning/blocker.
- **example:** لوحة Upgrade Readiness بلا أزرار تنفيذ.

### 15.6 Safe Maintenance Actions Policy (W5-06)
- **positive:** `candidate_maintenance_action_type` (التسعة) كـ labels/`candidate_maintenance_action_status`/`_permission_status`/`_audit_status`/`_preview_status`/`_block_reason`/`_reversibility_status`/`_safe_shutdown_status`؛ safe_shutdown يراعي pending intents/active signing/critical jobs؛ restore يحفظ audit/history/config؛ rebuild projections يحفظ سلطة PostgreSQL.
- **negative:** action types تنشئ command endpoints = fail · service-control command = fail · restart/shutdown/backup/restore/purge/rollback/migration command = fail · safe_shutdown safe مع pending intents/active signing/critical jobs = fail · backup status بـ raw secrets = fail · clear_cache يحذف source-of-truth = fail · rebuild projections يغيّر PostgreSQL authority = fail · execution authority = fail.
- **pass:** labels/status فقط بلا أزرار تنفيذ. **fail:** label→executable · safe_shutdown safe مع intent معلّق.
- **evidence:** pending intent موجود → `candidate_safe_shutdown_status=blocked_pending_intents`، safe_shutdown blocked، لا زر Shutdown.
- **example:** لوحة Maintenance Policy labels فقط.

### 15.7 Implementation Status Matrix (W5-07)
- **positive:** `candidate_capability_status_label`/`candidate_implementation_status` (السبعة)/`_implementation_status_evidence`/`_implementation_status_source`/`_status_verified_at`/`_status_verification_state` (verified/not_verified/stale/unknown)؛ يربط بـ `IMPLEMENTATION_STATUS_MATRIX.md`؛ unknown/not_verified واضح.
- **negative:** `documented_only` كـ implemented = fail · `candidate` كـ built = fail · unknown/not_verified كـ implemented = fail · capability ready دون evidence = fail · status يمنح execution authority = fail · “documented means built” = fail.
- **pass:** كل capability بـ status + evidence/source + verification state. **fail:** documented_only→implemented · candidate→built · ready بلا evidence.
- **evidence:** feature موثّقة بلا evidence → `candidate_implementation_status=documented_only` + `candidate_status_verification_state=not_verified`، لا implemented/ready.
- **example:** مصفوفة القدرات تُظهر candidate/documented_only دون وسم implemented.

### 15.8 Cross-Document Consistency (W5)
- كل أسماء W5 في Test Plan موجودة في **SSOT Group 41** أو قائمة = pass (وإلا fail) · **لا field جديد في Test Plan**.
- ARCH §15.13 مفاهيمي فقط · SSOT G41 مصدر الأسماء · CONFIG §17 policy/status فقط · API §20 read-only/status/diagnostic/advisory · DATA §14 projections/read-models/artifacts · UX §31 panels/labels/warnings · BUILD §14 build/verification/static guards.
- لا command endpoint/button · لا service-control command · لا restart/shutdown/backup/restore/purge/rollback/migration command · لا provider connection command · لا scripts/launcher/runtime · لا migrations/SQL · لا code/backend/frontend · لا raw key/secret/credential (fields أو displays) · لا secrets في logs/artifacts/diagnostics/backups · health green لا trading readiness · SignerService healthy لا permission to sign · provider health لا trading readiness · failed/pending/blocked/unknown لا clean · preflight pass لا trading readiness · documented_only/candidate لا implemented · unknown/not_verified لا implemented · missing/unknown/unavailable لا clean/ready · logs لا stack trace فقط · `blocked_contains_secret` يحجب display/export/artifact · safe_shutdown يحترم pending intents/active signing/critical jobs · projection rebuild لا يغيّر PostgreSQL/source-of-truth · لا execution authority · لا auto-execution · لا auto-config · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا live/testnet/mainnet · لا Wave 6+.

### 15.9 Regression Guards (W5)
- local run ready → REAL-LIVE ready = fail · local app running → trading readiness = fail · evidence missing/stale/unknown → clean = fail · next_action → command = fail.
- health green → execution-safe = fail · signer_service healthy → permission to sign = fail · provider_connectivity healthy → trading readiness = fail · degraded/unavailable → stack trace only = fail.
- logs expose raw secret/key/token = fail · `blocked_contains_secret` still displayed/exported = fail · safe_next_action → command = fail.
- version compatible → execution authority = fail · failed/pending migration → clean = fail · rollback available → rollback command = fail · preflight pass → trading readiness = fail · backup evidence contains raw secrets = fail · failed upgrade → clean = fail.
- maintenance action type → executable command = fail · safe_shutdown safe with pending intents = fail · restart allowed during active signing = fail · clear_cache deletes source-of-truth = fail · rebuild projections changes PostgreSQL authority = fail.
- documented_only → implemented = fail · candidate → built = fail · unknown/not_verified → implemented = fail · missing/unknown/unavailable → clean/ready = fail.
- W5 adds command/resource = fail · service-control command = fail · migration/SQL/runtime/script/launcher = fail · exposes raw key/secret/credential = fail · changes EV gate/Hard Risk/Risk Gates/SignerService = fail · enters live/testnet/mainnet = fail · opens Wave 6 = fail.

> **مبدأ §15:** Wave 5 مغلقة باختبارات قبول/انحدار: local run/health/logs/version/upgrade/maintenance/implementation-status كلها read-only/status/diagnostic بلا execution authority · local running ليس trading readiness · health green ليس execution-safe وsigner health ليس permission to sign · logs تُخفي الأسرار و`blocked_contains_secret` يحجب · version compatible شرط مسبق لا authority · upgrade pass ليس trading readiness وbackup بلا raw secrets · maintenance labels/states فقط (لا أزرار تنفيذ، غير سلطوية على source-of-truth) · documented_only/candidate ليس implemented (unknown → not_verified) · المفقود unavailable/unknown/not_verified لا clean/ready/implemented. **لا اسم خارج SSOT · لا تغيير وثائق أخرى · لا live · لا Wave 6+.**

---

## 16. Research Integration — Tests & Acceptance (Pack #1 + Pack #2)

> اختبارات قبول للإدراجات المعتمدة من حزمتَي دمج البحث. **لا اسم خارج الأسماء الخمسة المسجّلة** (`quote_mint` · `unknown_quote_mint` · `usdc_quote_enabled` · `hook_upgraded_mid_hold` · `candidate_landing_outcome_by_heat_bucket`). Pack #2 = صفر أسماء جديدة.

### 16.1 USDC quote-mint (Pack#1-1)
- **pass:** `quote_mint=unknown` ⇒ skip · اشتقاق pool صحيح لكل `wsol`/`usdc` · السعر مُطبَّع داخلياً إلى USD · USDC والـ `usdc_quote_enabled=false` ⇒ skip عبر `rejected_reason=unknown_quote_mint`.
- **fail:** صفقة على quote mint مجهول · خلط حساب SOL/USDC في P&L/slippage/EV · عتبة SOL واحدة مثبّتة للزوجين · `usdc_quote_enabled` يتجاوز Hard Risk/EV gate.

### 16.2 Token-2022 honeypot-by-upgrade (Pack#1-2)
- **pass:** hook بسلطة ترقية حيّة عند الدخول ⇒ veto عبر `token2022_extension_risk` · ترقية أثناء الاحتفاظ ⇒ emergency exit attempt · sell-simulation دوري يكتشف عدم القابلية مبكراً · `hook_upgraded_mid_hold` يُوصَل بمسار الخروج · الرفض النهائي `token2022_dangerous_extension`.
- **fail:** `hook_upgraded_mid_hold` يُستخدم كمكوّن دخول · حقل hash مستقل جديد في SSOT · ترقية الـ hook أثناء الاحتفاظ بلا إعادة فحص/emergency · emergency exit يتجاوز ownership/Hard Risk/Audit.

### 16.3 Always-on Exit Manager (Pack#1-3)
- **pass:** بقاء إدارة الخروج (TP/SL/emergency) بعد قتل محرّك الدخول · paging عند kill ليلي/فشل heartbeat.
- **fail:** فتح مركز جديد من exit-manager · تجاوز ownership/Hard Risk/Audit بحجّة «emergency» · حالة operating_state جديدة لأجله.

### 16.4 Landing-bias observability (Pack#1-4)
- **pass:** `candidate_landing_outcome_by_heat_bucket` diagnostic-only · متمايز عن `candidate_adverse_selection_metric`.
- **fail:** استخدامه كـ gate/execution authority · auto-config منه · score حرارة معتم جديد · خلطه مع G38.

### 16.5 Wash-adjusted exit liquidity (Pack#2-1)
- **pass:** exit-feasibility/slippage على effective liquidity (reserves مخصومة بالـ wash عبر `wash_fake_activity_risk`) · wash قوي ⇒ خفض depth/ثقة أو `exit_feasibility_fail` · تعذّر تقدير الـ wash ⇒ fail-safe (ثقة أدنى).
- **fail:** حساب من raw reserves رغم دليل wash قوي · ابتكار قيمة/بوابة wash جديدة بدل المسار القائم · wash-inflated volume يُعرض كعمق خروج.

### 16.6 Migration-limbo exit prestaging (Pack#2-2)
- **pass:** لا بيع أعمى أثناء limbo · النيّة pre-staged · الإطلاق عند أول route صالح بعد تهيئة الـ pool · `route_health` unhealthy حتى إثبات route.
- **fail:** افتراض route أثناء limbo · retry أعمى على route غائب · إلغاء النيّة المعلّقة تلقائياً بلا سبب مستخدم/خطر · enum/حالة جديدة.

### 16.7 Vol-scaled trailing + whale tightening (Pack#2-3)
- **pass:** whale sell يُضيِّق الـ band ولا panic · الـ band vol-scaled · تهديد عقد مؤكّد ⇒ emergency path يتجاوز trailing.
- **fail:** panic exit على كل whale sell · band ثابت % يتجاهل التذبذب · تهديد عقد يُعامَل كإشارة سعر عادية · enum جديد.

### 16.8 CUSUM drift method (Pack#2-4 — إن نُفِّذت)
- **pass:** no-future-leakage في الـ change-point · bounded detection · الإشارة advisory.
- **fail:** auto-ban/auto-config منها · تغيير `candidate_edge_health_status` كمفردة · تغيّر EV gate/Hard Risk.

### 16.9 Cross-Document Consistency (Research Integration)
- كل اسم جديد مسجّل في SSOT/CONFIG قبل أي استخدام API/Data/UX = pass (وإلا fail) · Pack #2 لا يضيف أي اسم جديد = pass · أرقام البحث (Pine/Solidus/CoinGecko) في Evidence Log لا config/thresholds = pass.

> **مبدأ §16:** خمسة أسماء جديدة فقط (كلها Pack #1)؛ `quote_mint` حقيقة market-structure (G16) لا candidate؛ `usdc_quote_enabled` سياسة عامة (G2→CONFIG §3) لا F-Elimination؛ `hook_upgraded_mid_hold` خروج لا دخول؛ `candidate_landing_outcome_by_heat_bucket` diagnostic؛ wash-adjusted/limbo/trailing/CUSUM بلا أسماء جديدة. **لا enum/gate/command خارج المذكور · لا تحويل candidate إلى implemented · لا P&L في Opportunity/Radar · لا إعادة تعريف لحالات exit/migration · Hard Risk/Signer/EV gate بلا تغيير سلوكي.**

---

## 17. UI Acceptance Tests — 11-UI-SPEC §18.3 Gate Mapping

> طبقة **Mapping + Gap-Fill**، لا إعادة كتابة. تحوّل بوّابات `11-UI-SPEC §18.3` إلى اختبارات قبول داخل خطة الاختبار الرسمية. **لا اسم خارج SSOT · لا SSOT/API/Data/command/event/error/threshold جديد · لا تغيير لمعنى `11-UI-SPEC` أو أي وثيقة أخرى.**

### 17.0 Preflight & Non-Duplication
- §17 **يحيل** الاختبارات القائمة ولا يكرّرها؛ يلتزم §0 (Verify, Don't Redecide).
- **candidate-aware:** أي AC يلمس سطحًا مرشّحًا (alerts/provider/glossary/onboarding/charts/preferences) يُوسَم candidate ولا يُعامَل implemented؛ لا «pending/deferred» (مبدأ §8: إمّا candidate أو rejected).
- يستهلك أسماء قائمة فقط؛ أي اسم غير موجود يُذكر نصًّا "يحتاج حوكمة" بلا backticks، ولا يُدرَج كاسم فعلي.
- المفقود يُعرض `unavailable`/`unknown`/`not_verified` لا صفر/clean/implemented.

### 17.1 Gate → Test Mapping
لكل بوّابة في `11-UI-SPEC §18.3`: الاختبار القائم المُعاد استخدامه · الفجوة · AC الجديد عند الحاجة.

| UI Gate (§18.3) | اختبارات قائمة (reuse) | فجوة؟ | AC جديد |
|---|---|---|---|
| كل قدرة لها UI surface (Matrix §5) | §10 (F1–F17) · §15.7 Implementation Status Matrix · §4.15 | تغطية شاملة عبر Traceability Matrix | UI-AC-07 |
| كل أمر مسموح له preview/confirm/audit/result (Catalog A) | §4.16 · §4.10 · §6.x · §4.11 | اكتمال per-Catalog-A | UI-AC-07 |
| لا أمر مرفوض كزرّ | **§8 (كامل)** · §10.16 · §4.16 | — (reuse فقط) | — |
| كل جدول sort/filter/search حيث عمليّ | — | غير مغطّى | UI-AC-05 |
| كل data surface timestamp/freshness/truth-mode (no-stale-as-live) | §5.4 (readiness cache) · §14.1/§14.2 (provider) | بوّابة UI freshness غير مغطّاة | UI-AC-01 |
| كل error بسبب + إجراء + `request_id` إن وُجد | §15.3 (operator logs) | error-state UI غير مغطّى | UI-AC-08 |
| secret redaction | **§4.16 · §10.15 · §7.3 · §15.x** | — (reuse فقط) | — |
| REAL-LIVE محجوب حتى readiness | **§6.1–6.6 · §7.5** | — (reuse فقط) | — |
| كل صفحة AR/EN + RTL/LTR | §4.16 (AR/EN+RTL acceptance) | bidi isolation + no-color-only | UI-AC-04 |
| critical warnings لا تُخفى | §10.10 (Alerts) | عدم الإخفاء/الدمج/الإسكات كـ UI AC | UI-AC-02/UI-AC-08 |
| لا stale-as-live | §5.4 | حالة UI صريحة | UI-AC-01 |
| لا CLI لإنجاز مهمة | §15.1 (W5-01 UI-first) | تأكيد no-CLI للمستخدم النهائي | UI-AC-07 |
| No Opportunity Execution / لا P&L في Radar | **§8 · §10.16 · §4.16** | — (reuse فقط) | — |
| Provider key redaction / `candidate_provider_key_ref` فقط | **§10.15 · §14.4** | — (reuse فقط) | — |

### 17.2 New UI Acceptance Criteria (UI-AC-NN)
> صيغة acceptance قابلة للفحص (pass/fail). الأدوات (Playwright/Axe/Lighthouse/visual-regression) أمثلة غير ملزمة، لا stack مفروض، لا threshold جديد.

**UI-AC-01 — No-stale-as-live / freshness / truth-mode**
- pass: كل data surface يحمل timestamp + وسم truth-mode (live/delayed/estimated/paper/real) + حالة freshness · تدهور المصدر (`provider_degraded`/`slot_lag`/`last_confirmed_slot`/`last_seen_slot`/`stream_cursors`) يُظهر `stale`/`degraded`/`reconnecting` بتمييز بصري · يظهر في Top Bar + Global Safety Banner.
- fail: عرض بيانات قديمة كأنها live · حساب freshness محليًّا في UI بدل القيم القائمة · إخفاء تدهور المصدر.

**UI-AC-02 — Permission / role visibility & action gating**
- pass: العرض والأفعال تتبع `permission_role` · `viewer` لا يرى أفعال كتابة/خطر · `operator`/`admin`/`signer_control` يرون المسموح لهم فقط · أفعال `signer_control` (مثل revoke) محجوبة عن غيرهم.
- fail: ظهور فعل فوق صلاحية المستخدم · تجاوز الصلاحية عبر Command Palette.

**UI-AC-03 — WCAG 2.2 AA**
- pass: keyboard navigation · visible focus (Focus Not Obscured/Focus Appearance) · target size ≥ 24×24 CSS px · Consistent Help · Redundant Entry · Accessible Authentication · Dragging alternatives.
- fail: فعل يعتمد drag بلا بديل · هدف < 24×24 · تركيز محجوب/غير مرئي.

**UI-AC-04 — RTL/bidi & i18n isolation**
- pass: AR/EN + RTL/LTR · عناوين المحافظ/tx ids/الأرقام/المبالغ/timestamps معزولة LTR داخل العربية بلا كسر بصري · `source_of_truth_field` إنجليزي canonical · كل حالة = لون + نص + أيقونة (no color-only).
- fail: كسر اتجاه في الجداول · حالة باللون وحده · عنوان/معرّف ينقلب داخل RTL.

**UI-AC-05 — Performance / data-dense UI**
- pass: جداول كبيرة virtualized · logs مُصفّحة (paginated) · sort/filter/search حيث عمليّ · feedback تفاعلي سريع؛ أي هدف رقمي مثل INP يُعامَل كمرجع tooling لاحق (Build/Design-System)، لا كعتبة حوكمة داخل §07 · لا تجميد الواجهة عند logs/tables كبيرة.
- fail: تجميد/تعليق عند البيانات الكبيرة · تحميل غير مُصفّح للسجلات.

**UI-AC-06 — XAI assistant explain-only**
- pass: المساعد يشرح فقط (لماذا رُفضت فرصة عبر `rejected_reason`/Safety-Trace · لماذا مركز في خطر · معنى `hook_upgraded_mid_hold` عبر `candidate_glossary_content`/`candidate_glossary_sot_mapping` · إصلاح مفتاح مزوّد · الخطوة التالية) · يستهلك بيانات قائمة من API/Data.
- fail: auto-apply · auto-trading · حساب حقائق تنفيذ محليًّا · أي فعل لا يمرّ preview/confirm/audit.

**UI-AC-07 — Feature surface & per-Catalog-A gating completeness**
- pass: كل قدرة في Traceability Matrix (§5) لها UI surface بمستوى سلطتها · كل أمر في Catalog A له المسار المناسب (preview/confirm/audit/result) حسب الخطر · read-only/diagnostic بلا زرّ · blocked يُظهر disabled-reason · لا مهمة مستخدم تتطلّب CLI.
- fail: قدرة بلا surface · أمر بلا audit/confirm حسب خطره · زرّ معطّل بلا سبب · مهمة تتطلّب CLI.

**UI-AC-08 — UI states coverage & error states**
- pass: كل صفحة/سطح يغطّي loading · empty · stale · degraded · blocked · error · populated · error state يجيب (ماذا/أين/لماذا/هل في خطر/الخطوة التالية) + `request_id` إن أتاحه API + خطوات إصلاح + Open logs/audit + Retry/Fix · critical warnings (`candidate_alert_severity`=critical / `candidate_alert_category`=security) لا تُخفى/تُدمَج/تُسكت.
- fail: حالة مفقودة تظهر كـ populated فارغ · error بلا سبب/إجراء · تحذير حرج مدموج/مُسكت · UI state يتحوّل إلى enum مسجّل.

**UI-AC-09 — Cross-page context linking & Right Inspector integrity**
- pass: التتبّع Radar→Opportunity→Position→Trade→Log متّصل · Right Inspector واحد سياقي يتبع العنصر المحدّد ويحترم `permission_role` · Inspector الفرصة بلا فعل تنفيذ وبلا P&L.
- fail: Inspector الفرصة يعرض زرّ شراء أو P&L · انقطاع السياق بين الصفحات · Inspector يتجاوز الصلاحية.

**UI-AC-10 — Decision Visualization field integrity**
- pass: Opportunity Decision Timeline (`hunt_status`/`quote_mint`/`accepted_reason`/`rejected_reason`) · Leader vs Copier (`discovery_latency_ms`/`signal_to_execution_ms`/`entry_slippage_vs_leader`/`copyability_by_brain`) · Position Lifecycle (`position_state`/`intent_type`) · Exit Feasibility (`active_exit_route`/effective-vs-raw liquidity من Data/`wash_fake_activity_risk`/`migration_phase`) · Safety/Decision Trace (`ev_gate_mode`/`transfer_hook_active`/`token2022_extension_risk`/`hook_upgraded_mid_hold` كخروج) · Landing Diagnostic (`candidate_landing_outcome_by_heat_bucket`/`bundle_status`/`failure_type`/`candidate_failure_origin`) — كلٌّ يربط حقله القائم.
- fail: candlestick/RSI/EMA/MACD/100+ indicators كمتطلّب · Order Ticket/Trading Platform/DOM · اختراع price/candle fields · `hook_upgraded_mid_hold` كمكوّن دخول · `candidate_landing_outcome_by_heat_bucket` كـ gate · حساب liquidity/P&L محليًّا في UI.

### 17.3 Cross-Document Consistency (UI) + Regression Guards
- لا تعارض §17 مع §4.16 / §8 / §10 / §16 (إحالة لا تكرار) = pass.
- لا أمر مرفوض (`buy_opportunity`/`execute_opportunity`/`submit_opportunity`/`exit_all_positions`/`batch_exit_all_positions`) يظهر كزرّ = pass.
- لا تحويل candidate (المرشّحات بادئة candidate_) إلى implemented · لا UI state يتحوّل إلى enum مسجّل = pass.
- لا XAI auto-apply/auto-trading · لا stale-as-live · لا raw secrets في UI/logs/exports · لا P&L داخل Radar/Opportunity (mark gating: `candidate_current_mark_view` / `candidate_mark_status` = valid) · لا chart-trading/technical-analysis-first = pass.
- كل اسم داخل §17 مسجّل في SSOT قبل أي استخدام؛ غير الموجود يُذكر نصًّا "يحتاج حوكمة" = pass (وإلا fail).

> **مبدأ §17:** طبقة قبول للواجهة تربط بوّابات `11-UI-SPEC §18.3` بالاختبارات القائمة (§4.16/§8/§10/§16/§6) وتسدّ الفجوات بـ UI-AC-01..10 فقط — تمنع واجهة «جميلة لكن ناقصة أو غير آمنة»، بأسماء SSOT القائمة، بلا اسم/threshold/stack جديد، وبلا تغيير لأي وثيقة أخرى.
