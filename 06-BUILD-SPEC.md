# Build Spec

> **Priority:** 06 — Implementation · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** الخدمات واللغات والـ processes وترتيب البناء

**الحالة:** معتمدة / موسّعة بعد v1.8 Delta + F-Elimination + Waves 1–5 — الأقسام 0–14 مكتملة ومراجعة. §8 sequencing هندسي (المعمارية والقدرات مكتملة الآن، الترتيب هندسي لا تأجيل نطاق)؛ §9 قدرات بناء F-Elimination + Engineering Quality Standards فوق SSOT Groups 22–36؛ §10 يستهلك SSOT Group 37 / Wave 1، و§11 يستهلك SSOT Group 38 / Wave 2، و§12 يستهلك SSOT Group 39 / Wave 3، و§13 يستهلك SSOT Group 40 / Wave 4، و§14 يستهلك SSOT Group 41 / Wave 5. كل إضافات Waves 1–5 تبقى candidate build/verification expectations + static guards، ولا تمنح execution authority ولا تضيف commands/runtime ولا تغيّر EV gate أو Hard Risk أو Risk Gates أو SignerService.

**مبني على:** الوثائق المقبولة لهذه الموجة: 00 · 01 · 02 · 03 · 04 · 05 · 07 · 09. يترجمها إلى بناء/تحقق، ولا يعيد فتح قراراتها أو يضيف fields/API/commands. **يترجمها إلى بناء، لا يعيد فتح قراراتها.**

---

## 0. Build Spec Preflight — Translate, Don't Redecide (محسوم)

Build Spec **يترجم القرارات المعمارية إلى تنفيذ، لا يعيد تقريرها.**

| النوع | المالك | مثال |
|---|---|---|
| قرار سلوك/أمان/اسم/عقد | **00–05** (لا يُعاد فتحه هنا) | موضع SignerService المعزول (ARCHITECTURE §4.3) · أسماء SSOT · عقود API |
| قرار تنفيذ بحت | **Build Spec وحده** | أي لغة لكل خدمة · حدود الـ processes · ترتيب البناء · dev workflow |

**قاعدة:** أي حقل/resource جديد يظهر أثناء 06 يمرّ عبر SSOT أولاً. لكن المتوقّع أن 06 يضيف **services/modules** أكثر من fields. أي قرار يمسّ السلوك أو الأمان (لا مجرّد التنفيذ) يعود لـ ARCHITECTURE أولاً.

> **نتيجة preflight:** اختيار اللغات وتقسيم الخدمات قرارات تنفيذ. موضع SignerService المعزول قرار أمني **مأخوذ من §4.3** (Build يترجمه: عملية منفصلة)، لا يُخترَع هنا.

---

## 1. Scope & Ownership (النطاق والملكية)

**Build Spec يملك (حصراً):**
- `تقسيم الخدمات` · `اختيار اللغة لكل خدمة` · `حدود العمليات/processes`.
- `ترتيب البناء` · `dependency graph` · `safety activation gates للبناء المتكامل`.
- `local/dev/runtime workflow` · `Docker/WSL/Linux boundaries`.
- `أين يعيش SignerService` (تنفيذاً للقرار الأمني في §4.3).

**Build Spec لا يملك:**
- `المعنى المعماري` (ARCHITECTURE) · `أسماء SSOT` · `API contracts` (Doc 03) · `UX presentation` (Doc 04) · `DB schema` (Doc 05) · `تفاصيل threat/security العميقة` (Doc 09).

**القاعدة الحاكمة:**
> Build يترجم 00–05 إلى خدمات/لغات/processes/ترتيب بناء. لا يعيد فتح قرار مغلق. حقل/resource جديد → ARCHITECTURE→SSOT أولاً.

---

## 2. Language & Runtime Boundaries (حدود اللغات والتشغيل)

اختيار اللغة بحسب طبيعة كل طبقة (كمون/أمان/تحليل):

**Rust — الـ hot path وكل ما يمسّ التنفيذ والأمان منخفض الكمون:**
- stream ingestion · decision engine (العقلان A/B) · execution adapter · risk gates (Hard Risk enforcement) · signer boundary (تكامل SignerService) · low-latency services.
- السبب: كمون منخفض حتمي، أمان ذاكرة، لا GC pauses في المسار الحرج.

**TypeScript — الواجهة وطبقة الإدارة:**
- React dashboard/UI · admin/management API gateway (إن ناسب) · UX integration (Doc 04).
- السبب: نظام بيئي ناضج للواجهات، تكامل مباشر مع React.

**Python — التحليل دون الإنتاج الحيّ:**
- research · offline analytics · backtest/forward notebooks · تجارب ML.
- **حدّ صارم:** **لا hot path · لا signing · لا live execution في Python** (متّسق مع §4.3 ومنع API call في المسار الحرج).

**SQL — PostgreSQL:** schema/migrations (Doc 05 §4–5).
**ClickHouse SQL:** الجداول التحليلية (Doc 05 §6).
**Redis:** hot-path cache/dedup/cursors (Doc 05 §7).

> **حدّ اللغة الحاكم:** كل ما يقرّر/ينفّذ/يوقّع صفقة أو يفرض Hard Risk → Rust. التحليل غير الحيّ → Python. الواجهة/الإدارة → TypeScript. لا تتسرّب لغة التحليل إلى المسار الحرج.

---

## 3. Service Boundary Map (خريطة حدود الخدمات)

الخدمات كـ processes منفصلة، بحدود واضحة:

| الخدمة | اللغة | المسؤولية | الحدّ |
|---|---|---|---|
| **Stream Ingestion** | Rust | استقبال أحداث السلسلة/المزوّد، تحديث cursors | hot path؛ لا منطق قرار |
| **Decision Engine** | Rust | العقلان A/B، مصفوفة قرارات النسخ (§4.2)، EV gates | hot path؛ يقرأ config/runtime لا يكتب config |
| **Risk Gates** | Rust | فرض Hard Risk (Group 6) فوق كل المحافظ، Fail Safe | **طبقة فرض في مسار التنفيذ، لا sidecar اختياري**؛ account-level فوق per-wallet |
| **Execution Adapter** | Rust | بناء/إرسال الأوامر (OrderBuilder)، idempotency عبر `intent_id` | لا تنفيذ بلا execution_wallet/signer صالحين (§API 12.6) |
| **SignerService** | Rust | التوقيع المعزول حصراً | **عملية منفصلة معزولة؛ المفاتيح لا تخرج منها؛ لا API/UI/hot path يخلطها** (§4.3) |
| **Management API** | TypeScript | عقود API (Doc 03)، الأوامر، القراءة، auth/permissions/orchestration | **لا يوقّع، لا يبني أوامر on-chain، لا يتجاوز Risk Gates، لا يدخل hot path**؛ يقرأ PostgreSQL/streams ويستدعي خدمات Rust عبر عقود داخلية |
| **Dashboard/UI** | TypeScript/React | الواجهة (Doc 04) | عرض فقط؛ لا مفاتيح؛ لا توقيع؛ الحقيقة من API |
| **Analytics/Backtest** | Python | تحليل offline، backtest (Doc 05 §6) | لا hot path؛ لا live execution؛ لا signing |
| **Storage access** | module boundary (لكل خدمة) | repository modules تغلّف PostgreSQL/ClickHouse/Redis وتطبّق source-of-truth (Doc 05) | **module لا process مستقل**؛ سلطة schema/migrations تبقى Doc 05 |
| **Internal Event Bus** | message boundary | يربط Stream→Decision→Risk→Execution→Management/Audit | **لا أسماء أحداث خارج SSOT/API**؛ اختيار التقنية محدّد في §5 Dev/Runtime Workflow (sequencing هندسي داخل حدّ ثابت، يمنع coupling مباشر) |

> **حدّ SignerService (الأهمّ):** عملية منفصلة معزولة (§4.3). لا الواجهة ولا Management API ولا الـ hot path يحتوي مادة توقيع؛ يطلبون التوقيع عبر حدّ معزول، والمفاتيح تبقى داخل SignerService memory فقط (التفاصيل في 09-THREAT-SECURITY). **لا REAL-LIVE قبل اكتمال Key Management** (§4.3).

> **حدّ Risk Gates (إلزامي):** Risk Gates طبقة فرض في مسار التنفيذ. **أي order intent يمرّ عبر Risk Gates قبل Execution Adapter / SignerService. لا خدمة تستدعي SignerService لتوقيع صفقة دون موافقة المخاطر.**

> **حدّ التوقيع اليدوي:** توقيع `connected_wallet` (Phantom/Solflare) **بوساطة الواجهة، ومسموح فقط لتدفّقات الموافقة اليدوية/الاختبار. لا يستخدمه الـ hot path الآلي.** التنفيذ الآلي يتطلّب `isolated_signer`/SignerService (§4.3).

> **مبدأ الفصل:** كل خدمة process مستقلّ بمسؤولية واحدة. الـ hot path (Rust) معزول عن الإدارة/الواجهة. SignerService معزول عن الجميع. لا خلط بين طبقة تقرّر/تنفّذ وطبقة تعرض/تدير.

---

## 4. Build Order & Dependency Graph (ترتيب البناء والاعتماديات)

ترتيب مبنيّ على **قاعدة أمان:** البنية التحتية وطبقات الأمان قبل التنفيذ الحيّ. لا قفزة للتنفيذ قبل اكتمال حُرّاسه.

1. **Foundations** — repo layout · config loading · typed contracts (أسماء SSOT كأنواع).
2. **Data layer** — PostgreSQL migrations + repositories (Doc 05 §4–5) · ClickHouse + Redis adapters. **يشمل مبكّراً audit_log append-only repository + مسار كتابة Audit (تسجيل command/result)، لأن قرارات Risk/Signer/Execution يجب أن تكون قابلة للتدقيق قبل أي تنفيذ شبيه بالحيّ.**
3. **SignerService skeleton + security boundary** — العزل أولاً (§4.3)، حتى قبل استخدامه فعلياً.
4. **Risk Gates** — فرض Hard Risk (Group 6) كطبقة لا تُتجاوز.
5. **Execution Adapter في paper/test harness** — بناء الأوامر وidempotency دون تنفيذ حيّ. **يستخدم نفس order object ومسار التحقّق، لكن لا يستدعي SignerService ولا يوقّع/يرسل** (PAPER-LIVE: same order object, no sign/no send — §ARCHITECTURE).
6. **Stream Ingestion** — استقبال الأحداث + cursors.
7. **Decision Engine** — العقلان A/B + مصفوفة القرارات (§4.2) + EV gates.
8. **Management API** — عقود Doc 03 + الصلاحيات.
9. **Dashboard wiring** — ربط الواجهة (Doc 04).
10. **Analytics/Backtest** — التحليل offline (Doc 05 §6).
11. **Real-live readiness wiring** — ربط REAL-LIVE Readiness Checklist (§15.1).

**dependency graph (مبسّط):** Foundations → Data layer → {SignerService, Risk Gates} → Execution Adapter (paper) → Stream Ingestion → Decision Engine → Management API → Dashboard. Analytics فرع مستقلّ يقرأ Data layer. Real-live readiness يعتمد على اكتمال SignerService + Risk Gates + Audit + config validation + execution_wallet admission.

> **قاعدة البوّابة الحاكمة:** **لا REAL-LIVE ولا isolated_signer فعلي قبل اكتمال:** SignerService boundary + Risk Gates + Audit + config validation (`real_live_config_valid`) + execution_wallet admission gate (§API 12.1). الترتيب يضمن أن كل حارس أمان جاهز قبل أوّل تنفيذ حيّ.

> **مبدأ §4:** الأمان والبنية التحتية تُبنى أولاً (1–4)، ثم التنفيذ في paper (5)، ثم الإشارة والقرار (6–7)، ثم الإدارة/العرض (8–9)، وأخيراً REAL-LIVE (11) بعد اكتمال كل الحُرّاس. paper-to-real انتقال محكوم لا قفزة.

---

## 5. Dev / Runtime Workflow (بيئة التطوير والتشغيل)

بيئة محسومة دون تعقيد زائد. لا Kubernetes الآن.

**Development:** Windows host + WSL2 + Docker Desktop مقبول. التطوير داخل WSL2 (Linux) لتطابق بيئة التشغيل.

**Runtime production-like:** Linux + Docker Compose أولاً. **Kubernetes ليس في النطاق الهندسي للإصدار الأول** (خيار infra تشغيلي إن كبر النظام فعلاً، ضمن نفس حدود الخدمة/الأمان — ليس feature معلّقة).

**Local services (Docker Compose):** PostgreSQL + ClickHouse + Redis كحاويات محلية.

**Rust services:** تُشغَّل محلياً أو داخل containers حسب مرحلة البناء (§4).

**SignerService:** **process/container منفصل، لا داخل Dashboard ولا Management API** (تنفيذ §4.3). حدّ معزول حتى في dev. **Dev signer mode:** يبدأ بـ mock/test signer أو test key معزول فقط — **لا real private key ولا seed ولا live signer في dev `.env`.** أي `isolated_signer` حقيقي أو تكامل KMS/secret-vault ينتظر 09-THREAT-SECURITY وREAL-LIVE readiness.

**Internal Event Bus — Phase 1 (محسوم):** **Redis Streams** داخل Docker Compose. السبب: Redis موجود أصلاً في الـ stack (Doc 05 §7 للـ hot-path cache/dedup/cursors)، ويكفي للمراحل الأولى دون broker إضافي. **NATS** بديل تقني إن أثبتت Redis Streams قصوراً في fanout/backpressure/replay/latency — خيار infra ضمن نفس الحدّ لا feature معلّقة. الحدّ: لا أسماء أحداث خارج SSOT/API، التواصل عبر الحدّ لا coupling مباشر.

**Secrets:** **لا مفاتيح حقيقية في `.env` للـ live**؛ dev/test بقيم وهمية أو مفاتيح test معزولة فقط. التفاصيل النهائية (KMS/secret vault) في 09-THREAT-SECURITY.

> **مبدأ §5:** dev يطابق runtime (WSL2/Linux + Compose) لتفادي مفاجآت البيئة. SignerService معزول حتى محلياً. لا تعقيد تشغيلي (K8s/broker ثقيل) قبل أن يفرضه الحجم. لا أسرار حيّة في dev.

---

## 6. Integrated Platform Scope — Safety Activation Gates

> **المبدأ الحاكم:** المنصة تُبنى كوحدة متكاملة كما عرّفتها ARCH/SSOT/API/DATA/UX/TEST/SECURITY/BUILD. التقسيم أدناه **ليس مراحل نطاق ولا MVP لاحق**، بل **safety activation gates** تحدّد متى يُسمح بتفعيل صلاحيات أعلى (paper · execution wallet · multi-wallet · REAL-LIVE). كل قدرات v1.8 وF-Elimination في §8/§9 تبقى ضمن مواصفة البناء المتكامل، ولا تُستبعد بسبب هذه البوّابات.

**Gate A — Foundations / Non-trading Baseline:** repo layout · typed SSOT contracts · config loading · migrations · **audit write path** · health endpoints · Management API skeleton · Dashboard shell.

**Gate B — Paper Execution-Safe Baseline:** Stream Ingestion · Decision Engine skeleton · Risk Gates · Execution Adapter paper/test harness (same order object · no sign/no send) · persistence لـ positions/intents/audit.

**Gate C — Execution Wallet Admission Baseline:** `execution_wallets` · `signer_profiles` · admission gate · حالات `WARMING_UP`/`ACTIVE`/`DRAINING`/`REVOKED` · **محفظة تنفيذ واحدة قابلة للاستخدام أولاً** — والـ data/API/UX يدعم الـ pool أصلاً.

**Gate D — Multi-wallet / Rotation / Sweep Enablement:** `wallet_assignment_policy` · `asset_transfer_intents` · `wallet_rotation_events` · `profit_sweep_events` · محافظ تنفيذ متعدّدة · تدفّقات rotation/sweep.

**Gate E — REAL-LIVE Readiness Gate:** `real_live_config_valid` · Hard Risk مكتمل · signer boundary مكتمل · audit مكتمل · admission مكتمل · operator readiness checklist.

**خارج نطاق البنية التشغيلية الأساسية الحالية (infra/advanced ops، ليست قدرات F-Elimination معلّقة):** Kubernetes · ML live decisioning متقدّم · colocation · تفاصيل KMS تتجاوز الواجهة · تصلّب secret-vault الإنتاجي. **worker-wallet privacy/stealth modes مستبعدة أصلاً (مرفوضة في SSOT Group 15)، لا «خارج نطاق».**

> **قاعدة §6 الحاكمة: «Safety-gated activation is not scope deferral.»** كل العقود والقدرات (v1.8 + F-Elimination §8/§9) موجودة في البناء المتكامل؛ البوّابات لا تعني تأجيل قدرات. **التفعيل العملي** يبدأ بمسار محدود آمن (محفظة واحدة، paper أولاً)، ثم يفعّل صلاحيات أعلى **دون تغيير العقود الأساسية**. REAL-LIVE لا يبدأ إلا بعد readiness. **paper-to-real انتقال محكوم، لكنه لا يُعلّق قدرات البحث/التحليل/الشارتات/التقارير/الـ paper** — كلها ضمن البناء المتكامل.

> **اتّساق مع §4 والبوّابة:** ترتيب البوّابات يطابق Build Order (§4) وقاعدة البوّابة — paper كامل بكل الحُرّاس (Gate A/B) قبل أي محفظة تنفيذ (Gate C)، وREAL-LIVE (Gate E) بعد اكتمال signer/risk/audit/validation/admission. paper-to-real انتقال محكوم.

---

## 7. v1.8 New-Coin Hunting Build & Validation Coverage

> يترجم عقود موجة New-Coin Hunting المقبولة إلى بناء/تحقّق/حُرّاس — **لا سلوك/حقل/أمر/مورد جديد**. هذه الموجة **تنزل ضمن مراحل §4 القائمة** (Data layer · Stream Ingestion · Management API · Dashboard) — **لا مرحلة بناء جديدة ولا إعادة ترتيب لبوّابات §6**.

### 7.1 New data/model artifacts
- schema/migration generation يغطّي البُنى المقبولة: `token_opportunities` (Data §4.12) · `wallet_intelligence_projection` (Data §5.6) · حقول/سمات persistence لـ G19/G21 داخل `wallet_registry`/`config_versions` (**أعمدة أو structured payloads**، لا قفل تصميم).
- **لا تُولَّد الأسماء المرفوضة دائماً كأعمدة/كيانات** (legacy P&L · `current_price` · atomic batch exit · buy/execute/submit) · مراجع storage-only تبقى داخلية (`id` · token/mint technical reference · FK لـ `wallet_registry` · `source_events` · FK لـ `intents`/`positions`) ولا تُولَّد كحقول API · القدرات المُرقّاة تُبنى بأسمائها `candidate_*` المسجّلة في SSOT.
- يُحاذي **مرحلة §4 «Data layer»**.

### 7.2 API contract generation/validation
- توليد/تحقّق العقد يشمل: `resource_type=opportunity` (read-only) · `event_type=opportunity_update` · `stream_channel=opportunity` · `audit_scope=opportunity`.
- **لا توليد أوامر للفرص · لا `api_error_code` جديد · لا REST خام** · الحقول derived/runtime/decision تُوسَم **read-only** في العقد المُولَّد.
- يُحاذي **مرحلة §4 «Management API»**.

### 7.3 Runtime / stream validation
- payload `opportunity_update` يشمل **حقول SSOT المعتمدة فقط** (G16/G17/G18/G20) · المظروف يستخدم `event_sequence`/`event_timestamp`/`payload_version` القائمة · **لا execution authority عبر الـ stream**.
- يُحاذي **مرحلة §4 «Stream Ingestion»**.

### 7.4 Config validation build coverage (G19/G21)
- الحقول: `fast_hunt_window_ms` · `require_pullback` · `chase_guard` · `min_token_readiness` · `max_entry_volatility` · `single_wallet_min_confidence` · `max_liquidity_share_pct` · `stop_loss_pct` · `max_time_in_position`.
- التحقّق يضمن: **per-wallet config · لا كائن إعداد تاسع · unset = disabled/no-effect · لا toggle `stop_loss` ولا `time_exit` · `max_liquidity_share_pct` ليس Hard Risk · `stop_loss_pct` Exit Policy لا Hard Risk**.
- قاعدة **derived-scale** ممثّلة في validation harness ومربوطة بـ **Test §4.13** (بلا إعادة تعريف زائدة في Build).

### 7.5 UX/build artifact guardrails (static checks)
- لا زرّ شراء من mint discovery · لا execution من `accepted` · لا P&L محلي كمصدر حقيقة · لا أمر ذرّي `exit_all_positions`/`batch_exit_all_positions` · لا حقول أسرار في مسارات report/export · **AR/EN + RTL مُضمّنة كسطح قبول** (جزء من البناء الآن، ليست إضافة اختيارية منفصلة).

### 7.6 Test integration & vocabulary-drift gate
- مراجع: Test §4.12–§4.16 · §7.7 Regression · §8 Rejected/Forbidden Guards · §10 F-Elimination Tests.
- **بوّابة تطابق المفردات عبر الوثائق (guardrail لا ميزة):**
  - `resource_type=opportunity` مُسجَّل في SSOT ويُستهلَك في API **read-only** فقط.
  - `event_type=opportunity_update` و`stream_channel=opportunity` **متطابقان بين SSOT وAPI**.
  - `audit_scope=opportunity` نطاق قراءة/observability فقط.
  - `token_opportunities` موجود في Data Model كتخزين، لكن **التخزين لا يعني command ولا execution authority**.
  - **أي mismatch بين SSOT/API/Data/Test في هذه المفردات → فشل بوّابة البناء.**
- **بوّابة البناء تفشل إذا:** ظهرت أسماء مرفوضة دائماً (legacy P&L · `current_price` · atomic batch exit · buy/execute/submit) كحقول/أوامر API/Data/SSOT مُولَّدة · ظهر أمر للفرص · ظهر `api_error_code` جديد · كُشِفت حقول storage-only في API · صارت حقول derived/runtime/decision قابلة للكتابة.
- **قاعدة ضد grep أعمى:** **HUNTABLE والأسماء المرفوضة دائماً قد تظهر فقط كنص منع/رفض في وثائق UX/Test/Security/Build؛ ويجب ألا تظهر كـ UI enum/badge definition، API request/response field، Data column/entity، `command_type`، `resource_type`، executable action، أو قيمة source-of-truth.** الفحص يفشل على التعريف/التوليد الحقيقي لا على ذكرها كمنع.

### 7.7 Security/build guardrails
- **لا private keys/seed/signer credentials/auth tokens في الوثائق/المخطّطات/التصدير المُولَّدة · لا تخفيف signer/REAL-LIVE · لا discovery-only execution · لا توسيع RPC deanonymization/obfuscation.**

> **مبدأ §7:** Build يترجم عقود v1.8 المقبولة إلى بناء/تحقّق/حُرّاس — لا سلوك/حقل/أمر/مورد جديد. الفرص read-only عبر مراحل §4 القائمة؛ HUNTABLE/الأسماء المرفوضة نصّ منع لا artifact؛ derived غير قابلة للكتابة؛ drift المفردات = فشل بناء؛ الأمان غير قابل للتجاوز (Fail-Safe). بوّابات §6 وترتيب البناء §4 بلا تغيير.

> **ما لا يُولَّد كأسماء/أوامر حقيقية:** legacy/unprefixed P&L aliases · `current_price`/`candidate_current_price` · الأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` · `buy_opportunity`/`execute_opportunity`/`submit_opportunity` · أي أمر Opportunity تنفيذي · `command_type`/`api_error_code`/`operating_state` جديد · مورد API يتجاوز `opportunity` المقبول. **أمّا العناصر التي كانت سابقاً خارج v1.8 ثم رُقّيت في F-Elimination** — trade event/journal · wallet-token performance · balances/sweep history · position token identity · leader attribution · persisted alerts/reports/preferences/glossary/onboarding — **فتُبنى فقط كـ candidate capabilities عبر §9 وبأسماء SSOT Groups 22–36، لا كأسماء legacy ولا كحقول داخل Opportunity payload.** **ملاحظة:** candidate P&L read-model يُعالَج في §8/§9، backend/data-owned — لا UX-local ولا Opportunity-owned.

---

## 8. v1.8 + F-Elimination — Build Sequencing (Architecture & Capabilities Complete Now; Engineering Sequencing Only)

> المعمارية والعقود (ARCH/SSOT/API/Data/UX/Test) تعرّف الشكل النهائي الآن، وكل القدرات (v1.8 + F-Elimination candidate) مواصَفة بالكامل؛ هذا القسم **ترتيب بناء هندسي** فقط، **لا تأجيل نطاق**. لا قدرة تُترَك «معلّقة»: المُرقّى = قدرة candidate يملكها module عند التنفيذ، والمرفوض = forbidden. كل اسم `candidate_*` حتى التثبيت.

### 8.1 Build Capability Clusters — Integrated Build, Engineering Sequencing Only
> التطبيق يُبنى كوحدة متكاملة؛ كل cluster جزء من مواصفة البناء، وأي ترتيب تنفيذ داخلي **sequencing هندسي لا تأجيل نطاق** — لا قدرة F-Elimination تُترَك «مرحلة لاحقة».
- **Foundations & Governance Cluster:** Provider Onboarding + single/multi mode · Execution Trace · health/incident · مفردات P&L مسجّلة · audit/observability hooks.
- **Paper / Execution-Safe Cluster:** Paper Portfolio · **realized + paper PnL** read-model · radar lifecycle · accept-vs-reject · batch-exit preview→request per-position · alerts.
- **Data / Analytics / Reports Cluster:** Wallet analytics (copyability/leader-vs-copier/drift) · wallet-token performance + cost-completeness · early-buyer/cluster/repeat (confidence/provenance) · تقارير + templates · «أسباب الرفض/الفشل» (غير مالية) · latency breakdown · **export markdown/csv/parquet/jsonl**.
- **Charts / Replay / Market-Visualization Cluster:** charts (مكتبة احترافية) + markers/replay · unrealized/mark viz · trade-event/journal overlays · «لماذا لم نربح/أكثر الرسوم/أسوأ المحافظ».
- **Recommendations / Sandbox Advisory Cluster:** Recommendation layer (advisory) · Strategy Sandbox A-B · time-of-day · TP-suitability. (لا auto-anything — مرفوض دائماً.)
- **Real-Live Readiness Gate Cluster:** REAL-LIVE قرار المستخدم بشرط readiness/signer/Hard-Risk — **gate/activation decision، وليس عذراً لتعليق القدرات البحثية/التحليلية/الورقية/الشارتات** (هذه كلها ضمن البناء المتكامل).

### 8.2 قرارات بناء
- **Charts:** مكتبة احترافية جاهزة (lightweight-charts افتراضي / TradingView) — **لا chart engine من الصفر**. `candidate_ohlcv` يحمل `candidate_ohlcv_provenance` إلزامياً؛ display-only لا يُقدَّم كحقيقة تنفيذ.
- **Jobs:** research jobs معزولة عن execution jobs في الـ pipeline (لا تتجاوز risk/signer).
- **P&L:** backend/data read-model فقط؛ **لا UX math**.
- **ثوابت:** Fail-Safe · Hard Risk دائمة · عزل Signer · accepted≠buy · diagnostics/opportunity read-only · No field before SSOT — غير متأثّرة بالمراحل.
- **Always-on Exit Manager (process expectation):** عملية تشغيلية مستقلة (تفصيلها في RUNBOOK §1/§5) تُبنى ويُتحقَّق منها: وظيفتها الوحيدة احترام TP/SL/trailing/emergency-exit للمراكز المفتوحة، تبقى حيّة لو تعطّل محرّك الدخول؛ **لا authority للدخول**؛ تخضع لـ SignerService/Hard Risk/ownership/Audit (ليست bypass). لا حالة SSOT جديدة.
- **Vol-scaled trailing (build/AC):** whale sell يُضيِّق نطاق الـ trailing (vol-scaled لا fixed %) ولا يُطلق panic؛ تهديد عقد مؤكّد (hook upgrade/authority/freeze change) ⇒ emergency path يتجاوز الـ trailing (يتّسق ARCH §4.2/§10/§14). توضيح سلوك لا enum جديد.

---

## 9. F-Elimination — Build Capabilities & Quality Standards (candidate, تستهلك SSOT Groups 22–36)

> service/module ownership · boundaries · sequencing هندسي · observability hooks على مستوى البناء — لا API/DB/UX/test/runbook/security جديد. المُرقّى = قدرات بناء candidate يملكها module؛ المرفوض = forbidden build output. **لا staged MVP يترك قدرة معلّقة؛ الترتيب الداخلي sequencing هندسي لا تأجيل نطاق.** لا «pending/later/مؤجل» مفتوحة.

### 9.1 Build Framing
المُرقّى (former F) = candidate build capabilities (module يملك حدود service/contract لها عند التنفيذ، وإن كانت candidate توثيقياً)؛ المرفوض = forbidden outputs (legacy P&L · `current_price` · atomic batch exit · buy/execute/submit). candidate لا تعني implemented الآن، لكن البناء يملك حدودها. أي ترتيب تنفيذ = sequencing هندسي لا تأجيل قدرة.

### 9.2 P&L (F1)
module: backend/data **P&L read-model** يملك `candidate_realized_pnl`/`candidate_unrealized_pnl`/`candidate_fees_total`/`candidate_slippage_cost`/`candidate_paper_pnl`/`candidate_pnl_by_wallet`/`candidate_pnl_by_copy_mode`/`candidate_pnl_by_brain`/`candidate_remaining_daily_loss_budget` (حاويات DATA `candidate_pnl_lots`/`candidate_mark_records`). **يمنع البناء أي browser/local P&L math** (الواجهة تستهلك read-model فقط)؛ mark gating للـ unrealized؛ finalized immutable؛ recalculation = report/artifact منفصل بـ provenance/generated_at عبر module التقارير؛ **لا P&L على Opportunity/Radar**؛ legacy aliases rejected.

### 9.3 Price / Mark (F2)
module/read-view لتصنيف السعر: `candidate_price_type`/`_provenance`/`_timestamp`/`_status`/`_confidence` + `candidate_current_mark_view` (display/read-view) + fill/quote/display/entry/quote_impact. **لا `candidate_current_price`**؛ AMM بـ quote-impact/liquidity-drain/expected-slippage لا order-book.

### 9.4 Trade Event / Journal (F3)
module/boundary لـ trade event/journal (append/read) يربط intent/position/fills/leader attribution؛ **بلا أسرار**؛ يخدم replay/reports/charts/debug؛ **audit module منفصل**.

### 9.5 Wallet-Token Performance / Discovery (F4/F5)
projection module: `candidate_wallet_token_performance` + cost-completeness + point-in-time/survivorship-free data path؛ early-buyer/cluster/repeat projections بـ confidence/method/provenance؛ **لا execution authority من هذه المقاييس**.

### 9.6 Balances / Sweep (F6)
balances/funds read-model + reconciliation + sweep history؛ `mismatch` يحجب الكنس؛ **لا كنس من غير مالك · لا raw key في أي مخرج رصيد/كنس**.

### 9.7 Position Token Identity / Leader Attribution (F7/F8)
position projection يتضمّن mint/address canonical + symbol/name display/trust badge semantics؛ leader attribution projection مع حفظ التعارض/تعدّد القادة؛ **الإسناد لا يخوّل تنفيذاً**.

### 9.8 Batch Exit (F9)
**لا atomic `exit_all_positions`/`batch_exit_all_positions`**؛ مسار البناء المسموح: preview service/module → request command → نوايا per-position؛ preview freshness/valid-until؛ per-position eligibility/status/result؛ كل مركز يمرّ ownership/route/exit-feasibility/risk/signer/audit؛ طوارئ batch تبقى permissioned ومُدقَّقة.

### 9.9 Alerts (F10)
module boundaries لـ rules/events/ack/preferences؛ severity منفصلة عن category؛ **security+critical لا تُسكت · ack لا يخفي الحقائق · التفضيلات لا تكتم الإلزامي**.

### 9.10 Reports / Exports (F11)
build ownership لـ report definitions/artifacts/export jobs/export history؛ **صيغ markdown/csv/parquet/jsonl**؛ provenance/generated_at؛ missing-metric policy (show_unavailable/omit/block_report)؛ strict redaction؛ **لا أسرار/raw keys/private keys/seeds/signer credentials/partial secrets**؛ **purge يحفظ audit/مالي/trade-event**.

### 9.11 Preferences / Glossary / Onboarding (F12/F13/F14)
module تفضيلات منفصل عن trading config (**لا يعدّل strategy/risk/live/signer**)؛ glossary content يربط SSOT ولا يعيد تعريفه؛ onboarding progress حالة/مراجع فقط — **لا أسرار**، لا تجاوز readiness gates، لا أوامر wallet/config خارج SSOT/API؛ **AR/EN + RTL/LTR ضمن متطلبات البناء**.

### 9.12 Provider Key Flow (F15)
secure provider key registration boundary؛ النظام العادي يخزّن/يستخدم `candidate_provider_key_ref` فقط؛ **لا raw provider key في build artifacts/browser state/logs/reports/exports/diagnostics/backups**؛ test connection عبر key_ref؛ artifacts الحوادث تشير إلى provider id/key_ref/status فقط.

### 9.13 Opportunity / Radar Guard (F16)
Opportunity/Radar read-only/read-oriented؛ **لا P&L · لا execution authority · `accepted` ليست buy · `new_token_priority_score` ترتيب/عرض · لا buy/execute/submit · لا ربط ضمني Opportunity→تنفيذ · DexScreener-only ليست موافقة تنفيذ**.

### 9.14 Charts (F17)
تكامل مكتبة احترافية (lightweight-charts/TradingView) **لا engine من الصفر**؛ overlays من trade-event/journal + fills/exits + leader attribution + mark/price provenance؛ OHLCV display-only يتطلّب provenance؛ AMM بـ quote-impact/liquidity-drain/expected-slippage حيث لا order-book؛ **لا قرار تنفيذ من حالة شارت فقط**.

### 9.15 Maintenance / Diagnostics / Backup / Purge (build constraints)
diagnostic bundles تحجب الأسرار؛ backups تستثني raw keys/seeds/private keys/signer credentials؛ **purge يحفظ audit/مالي/trade-event**؛ restart محجوب أثناء active signing أو نوايا حرجة معلّقة؛ أوامر الصيانة الخطرة admin/local-ops only؛ export diagnostic bundle يستثني raw provider keys.

### 9.16 Cross-Document Build Consistency
- كل اسم candidate API-facing يستخدمه BUILD موجود في SSOT Groups 22–36.
- مفاتيح CONFIG §13 موجودة في SSOT Group 36.
- صيغ التصدير متطابقة: `markdown/csv/parquet/jsonl`.
- أسماء أوامر المزوّد مطابقة لـ SSOT: `candidate_cmd_register_provider`/`candidate_cmd_test_provider_connection`/`candidate_cmd_disable_provider`/`candidate_cmd_set_provider_role`.
- الأسماء المرفوضة لا تظهر كحقول/أوامر/modules حقيقية: legacy P&L aliases · `current_price`/`candidate_current_price` · `exit_all_positions`/`batch_exit_all_positions` · `buy_opportunity`/`execute_opportunity`/`submit_opportunity`.

### 9.17 Engineering Quality Standards (acceptance criteria قابلة للاختبار)
- **Modularity:** كل capability لها module owner واضح → build review gate.
- **Encapsulation:** لا module يتجاوز boundary غيره → فحص الحدود.
- **Pipeline contracts:** Stream→Decision→Risk→Execution→Storage عقود واضحة → contract check.
- **Reusability:** shared read-model/projection components لا تتكرر عشوائياً → review.
- **Customization:** config/preferences منفصلة عن strategy/risk/live/signer → اختبار عدم التجاوز (TEST §10.12).
- **Performance/Latency/Throughput:** hot path لا يعتمد على UX/reports/glossary → فصل المسارات.
- **Bottleneck detection:** metrics/logs health hooks بلا أسرار → redaction check.
- **Scalability:** projections/reports/exports ليست source of truth → PG authority check.
- **Uptime/health:** health/readiness checks واضحة → probe.
- **Readability/Maintainability:** كل module موثّق بمسؤولية وحدود → doc review.
- **Refactoring rules:** لا field/command جديد بلا ARCH→SSOT→API/DATA/UX/TEST → governance gate.
- **Observability:** logs/metrics/audit/service-health/job-status/runtime-status/data-quality/latency/error panels مع redaction → observability check.
- **Acceptance:** لكل معيار check أو test reference أو build-review gate.

---

## 10. Wave 1 — Profit & Paper Truth — Build & Verification (candidate, تستهلك SSOT Group 37)

> **build/verification expectations فقط — لا runtime code · لا backend/frontend · لا migrations/SQL · لا build فعلي · لا live/testnet/mainnet.** يترجم §15.9 (ARCH) + Group 37 (SSOT) + §16 (API) + §10 (DATA) + §27 (UX) إلى ما **يجب أن يكون قابلاً للبناء/التحقّق لاحقاً**. كل المخرجات **derived/read-only projections بلا manual write path**؛ لا اسم خارج SSOT؛ Paper موسوم `simulated` ولا يُخلَط بـ real/live؛ unavailable أفضل من رقم مختلق. أي field/command جديد يبقى محكوماً بـ `ARCH→SSOT→API/DATA/UX/TEST` (governance gate §9.17).

### 10.1 Build Framing
- لا تُفعَّل أيّ capability كاسم نهائي قبل تثبيت SSOT؛ كلها `candidate_*`. هذا القسم **sequencing/verification هندسي لا تأجيل نطاق** (يتّسق مع §8). ملكية الوحدات تتبع §3 (research/analytics وreport generation معزولة عن hot path وعن risk/signer).

### 10.2 Anti-Fake Edge (W1-01)
- **Build:** يدمج pipeline اكتشاف الزيف (wash/sybil/closed-loop/volume-authenticity من §4 wallet intelligence) لإنتاج `candidate_fake_profit_risk`/`_reason`/`_adjusted_edge` كـ projection ضمن `wallet_intelligence_projection` (DATA §10.1)، قابل للعرض لاحقاً في API §16.1/UX §27.1.
- **Verify (static/build-review):** المخرجات derived/read-only **بلا write path**؛ **build يمنع ranking pipeline من رفع `candidate_wallet_net_copyability_rank` بسبب fake profit** (الزيف يخفض/يخصم لا يرفع) → ranking-protection check؛ provenance إلزامية على كل reason.

### 10.3 Profit Source Attribution (W1-02)
- **Build:** projection stage يفكّك مصدر الربح إلى `candidate_profit_source_type` مع `candidate_profit_source_copyability_class` و`candidate_copyable_profit_share`/`_non_copyable_profit_share`، يعتمد على `candidate_leader_vs_copier_delta` و`candidate_wt_entry_timing`/`_exit_timing` حيث متاح؛ output derived/rebuildable.
- **Verify:** **build يمنع مصادر `non_copyable` (insider/artificial_pump/one-off) من الدخول في copyable edge/ترتيب النسخ** → copyable-share integrity check؛ point-in-time يتّسق مع §10.8.

### 10.4 token_readiness_score Components (W1-03)
- **Build:** readiness pipeline يُخرج breakdown مكوّنات (`candidate_token_readiness_component`/`_type`/`_reason`/`_veto`) لا score معتماً فقط؛ كل component **قابل للتوليد أو `unavailable`** (لا اختلاق).
- **Verify:** **build artifact/projection يُظهر `component_veto`**، وstatic check يمنع تمرير الجاهزية حين `veto=true` رغم إجمالي جيد؛ المكوّنات **لا تمنح execution authority** (تبقى ضمن `token_opportunities` pre-position، بلا P&L).

### 10.5 Realistic Paper Simulation (W1-04)
- **Build:** Paper simulator (عند تنفيذه لاحقاً) **يدمج CostPipeline + FailedTransactionClassifier + CalibrationStore** (موجودة في build order §4) لإنتاج `candidate_paper_pnl_execution_aware` + `candidate_paper_cost_impact` + `candidate_paper_failure_impact` إلى جانب `candidate_paper_pnl_gross_theoretical` (مرجعي).
- **Verify:** **ideal-only paper build output غير كافٍ** (يجب وجود execution-aware) → paper-realism check؛ كل قيمة Paper موسومة `simulated`؛ unavailable impact لا يُختلق؛ **لا خلط مع real/live** في أي artifact.

### 10.6 Paper Outcome States (W1-05)
- **Build:** paper trade projection لا يُخرج صفقة بلا `candidate_paper_outcome_state` (+`_reason`)؛ failure outcomes تُربط بـ `candidate_failure_origin`، والطوابع بـ `candidate_ts_*` حيث متاح.
- **Verify:** static check «no paper trade without outcome»؛ وتمييز build صريح بين `candidate_paper_outcome_state` و runtime `position_state` (لا كتابة على `positions`).

### 10.7 Paper Aggregation Report (W1-06)
- **Build:** report generator لاحقاً ينتج `candidate_paper_aggregation_report` عبر dimensions (wallet/mode/strategy/token_class/period) وmetrics (max_drawdown/win_rate/avg_win/avg_loss/profit_factor/expectancy/median_hold_time/average_hold_time/failed_trade_rate/rejected_opportunity_count/exit_failure_rate/slippage_impact/latency_impact/fees_impact)، مع `candidate_report_provenance`/`_generated_at`.
- **Verify:** **report generator يفصل paper/simulated عن real/live** → no-mixing check؛ المقياس المفقود `unavailable` عبر `candidate_report_missing_metric_policy` (لا اختلاق)؛ كل artifact يحمل provenance/generated context؛ Paper artifact يحمل disclaimer (UX §27.6) — لا يُقدَّم كضمان ربح مستقبلي.

### 10.8 Paper↔Real Divergence (W1-07)
- **Build:** calibration build stage يقارن `simulated_*` مع `real_*` (CalibrationStore، DATA §10.7) لإنتاج `candidate_paper_real_divergence` عبر dimensions (fill/slippage/exit_success/latency/provider_reliability) و`candidate_paper_real_divergence_status` (within_band/elevated/high)؛ قابل للتقرير.
- **Verify:** `status=high` ينتج **warning/readiness signal** يغذّي Calibration/Readiness القائمة — static check يثبت أنه **لا gate حاجب جديد** على REAL-LIVE (قرار المستخدم §6)؛ يظهر في reports قبل أي ترقية paper→real.

### 10.9 Point-in-time / Survivorship (W1-08)
- **Build:** replay/backtest وwallet-discovery jobs (research pipeline، معزولة عن execution §3/§8.2) **تحفظ temporal cutoff T**؛ datasets **لا تحذف wallets dead/failed/disappeared** من العينة (survivorship-free)؛ تُستخدم `candidate_wt_point_in_time` كعلَم منهجي. **لا field جديد.**
- **Verify:** static/build check: **أي artifact بلا evidence لا يدّعي survivorship-free/point-in-time validity** (وإلا fail)؛ no-future-leakage check (لا بيانات > T في تقييم T). التفاصيل النهائية للاختبار في 07-TEST-PLAN.

### 10.10 Cross-Document & Quality Gates (تأكيد)
- كل اسم API-facing في §10 موجود في **SSOT Group 37** (وإلا governance gate يرفضه)؛ حاويات DATA-layer storage-only (مثل `candidate_pnl_lots`) لا تظهر API/UX.
- يُعاد استخدام معايير §9.17 (modularity/encapsulation/pipeline contracts/observability/PG authority): **projections/reports ليست source of truth** (PG authority check)، research≠execution، redaction بلا أسرار، **لا field/command جديد بلا ARCH→SSOT**.
- **لا يُبنى/يُفعَّل الآن:** أي runtime/backend/frontend · migrations · live/testnet/mainnet · أوامر تشغيل خارج SSOT/API · أسماء مرفوضة (legacy P&L · `current_price` · atomic batch exit · buy/execute/submit opportunity).

> **مبدأ §10:** Wave 1 قابلة للبناء/التحقّق لاحقاً دون أن تتحوّل إلى كلام: ranking محميّ من الربح الوهمي · non_copyable خارج الـ edge · readiness بمكوّنات + veto · Paper execution-aware موسوم simulated وغير مخلوط بـ real · لكل paper trade outcome · aggregation بلا اختلاق ومع disclaimer · divergence إشارة لا gate · datasets الاكتشاف point-in-time/survivorship-free. **لا كود · لا migrations · لا أسماء خارج SSOT · لا live.**

---

## 11. Wave 2 — Discovery & Copy Safety — Build & Verification (candidate, تستهلك SSOT Group 38)

> **build/verification expectations فقط — لا runtime code · لا backend/frontend · لا migrations/SQL · لا build فعلي · لا live/testnet/mainnet.** يترجم §15.10 (ARCH) + Group 38 (SSOT) + §14 (CONFIG) + §17 (API) + §11 (DATA) + §28 (UX) إلى ما **يجب أن يكون قابلاً للبناء/التحقّق لاحقاً**. كل المخرجات **derived/read-only projections** (وadvisory عند drift/learning/adverse-selection) **بلا manual write path**؛ لا اسم خارج SSOT؛ research/analytics معزولة عن hot path وعن risk/signer (§3). أي field/command جديد محكوم بـ `ARCH→SSOT→API/DATA/UX/TEST/CONFIG` (governance gate §9.17). **لا execution authority · لا auto-ban · لا auto-config · لا `full_mirror` default/صامت.**

### 11.1 Wallet Taxonomy (W2-01)
- **Build:** taxonomy pipeline يبني projection (`candidate_wallet_type`/`_confidence`/`_provenance`) من wallet observations/clusters/`candidate_is_copycat_flag`/`candidate_fake_profit_*`، ضمن `wallet_intelligence_projection` (DATA §11.1)، قابل للعرض في API §17.1/UX §28.1.
- **Verify (static/build-review):** output derived/read-only بلا write؛ **low-confidence لا يُعامَل كحقيقة**؛ **الأنواع الخطرة (insider/dev/sniper/copycat) لا ترفع `candidate_wallet_net_copyability_rank`** → taxonomy-copyability check؛ **static check يمنع منح taxonomy أي execution authority**.

### 11.2 Token Concentration (W2-02)
- **Build:** concentration pipeline يبني `candidate_token_concentration_dimension`/`_risk`/`_reason` من holder/creator/cluster/early-buyer data، يغذّي `candidate_token_readiness_component` (§10.3/§11.2).
- **Verify:** الحجب يظهر عبر `candidate_token_readiness_component_veto`؛ **static check: concentration لا يُعامَل كطلب طبيعي ولا execution authority**؛ **unavailable source → `unavailable`/insufficient evidence لا «صفر مخاطر»**.

### 11.3 Natural vs Artificial Pump (W2-03)
- **Build:** pump classifier يبني `candidate_pump_classification`/`_reason`/`_confidence` **منفصلاً عن raw price movement** (يتقاطع مع `candidate_fake_profit_*`).
- **Verify:** **raw price movement وحده لا يكفي** → price-not-proof check؛ **`unknown_or_insufficient_evidence` لا يتحوّل إلى `natural_pump`**؛ `artificial_*` يغذّي watch_only/rejection/readiness reduction **reason لا command**؛ static check ضد تحويل pump إلى buy/execute authority.

### 11.4 Wallet Drift Alert (W2-04)
- **Build:** drift pipeline يراقب تغيّر أداء المحفظة بعد التفعيل وينتج `candidate_wallet_drift_signal`/`_reason`/`_recommendation` (يبني على `candidate_wallet_behavior_drift_flag`)، قابل للظهور في alerts/recommendations.
- **Verify:** recommendations **advisory only** → **no config write · no position close · no auto-config** (static check)؛ أي action عبر user/config flow القائم.
- **Method note (drift detection):** **CUSUM / Page-CUSUM** على السلسلة المعيارية للعائد/win-rate المتدحرج طريقة أولى مرشّحة (online، bounded detection delay): change-point ضد المحفظة ⇒ `candidate_edge_health_status` → `weakening`؛ drift مستدام ⇒ recommendation عبر `candidate_wallet_drift_recommendation` القائم. PELT/HMM بدائل لاحقة. **طريقة تنفيذ لا تغيّر أي مفردة/قيمة؛ لا حقل SSOT جديد؛ advisory (لا auto-ban/auto-config).** Verify (إن نُفِّذت): no-future-leakage في حساب الـ change-point · bounded detection behavior · لا تغيّر EV gate/Hard Risk.

### 11.5 Default Copy Mode (W2-05)
- **Build/validation:** محفظة متبوعة جديدة **بلا `copy_mode` صريح → `follow_entry_user_exit`**؛ **`full_mirror` never selected by default**؛ legacy بلا `copy_mode` واضح → safe-default أو requires review؛ **never persist implicit `full_mirror`** (يعيد استخدام `copy_mode`/`candidate_copy_mode_default_policy`).
- **Verify (static):** **no default `full_mirror` · no silent `full_mirror` · no advanced-confirmation field unless SSOT exists** (وإلا fail → requires_ssot_followup). **لا تغيير CONFIG هنا.**

### 11.6 Creator / Cluster Learning (W2-06)
- **Build:** learning pipeline يبني **historical projection لا snapshot** (`candidate_creator_cluster_learning`/`_metric`/`_recommendation`/`_confidence`/`_provenance`)، مع **point-in-time cutoff محفوظ** عبر `candidate_wt_point_in_time` (research pipeline معزولة §3/§8.2).
- **Verify:** **no-future-leakage check**؛ **failed/dead/disappeared launches تبقى ضمن العينة** (survivorship-free) حيث ينطبق؛ low-confidence لا يُبنى كحقيقة؛ recommendations advisory؛ **no auto-ban · no auto-config**.

### 11.7 Adverse Selection (W2-07)
- **Build:** adverse-selection pipeline يقيس خسارة الـ edge بين القائد والتابع (`candidate_adverse_selection_metric`/`_reason`/`_severity`)، يستخدم `candidate_leader_vs_copier_delta`/`latency_to_copy`/`entry_slippage_vs_leader`/`candidate_wt_exit_timing` + route/quote degradation + failed/late exits (DATA §11.7).
- **Verify:** **static check: لا يخلط leader P&L بـ copier P&L**؛ `severity=high` advisory only؛ **no execution authority · no config auto-change**.

### 11.8 Cross-W2 Build Guards (static)
- (1) لا إشارة W2 تمنح execution authority · (2) لا توصية W2 تطبّق config تلقائياً · (3) no auto-ban · (4) no silent `full_mirror` · (5) no `full_mirror` default · (6) low-confidence ليس حقيقة · (7) unknown pump ليس natural demand · (8) concentration ≠ demand · (9) ربحية القائد لا تعني ربحية التابع · (10) unavailable/insufficient evidence لا يتحوّل «صفر مخاطر» · (11) مخرجات W2 derived/read-only/advisory · (12) **لا اسم خارج SSOT Group 38/القائم** (governance gate) · (13) **لا command/resource جديد**.

> **مبدأ §11:** Wave 2 قابلة للبناء/التحقّق لاحقاً دون تحوّل إلى كلام: نوع المحفظة احتمالي ولا يرفع copyability للأنواع الخطرة ولا يمنح تنفيذاً · concentration يفعل veto عبر readiness component لا كأمر · pump منفصل عن السعر ولا «unknown=demand» · drift/learning/adverse-selection **advisory بلا auto-ban/auto-config** · learning point-in-time/survivorship-free · adverse selection لا يخلط ربح القائد بالتابع · **`full_mirror` ليس default/صامت**. **لا كود · لا migrations · لا أوامر جديدة · لا أسماء خارج SSOT · لا API/CONFIG/Data/UX/Test edits هنا · لا live.**

---

## 12. Wave 3 — Reports & Honesty — Build & Verification (candidate, تستهلك SSOT Group 39)

> **build/verification expectations فقط — لا runtime code · لا backend/frontend · لا migrations/SQL · لا build فعلي · لا report generation implementation · لا report template IDs نهائية · لا live/testnet/mainnet.** يترجم §15.11 (ARCH) + Group 39 (SSOT) + §15 (CONFIG) + §18 (API) + §12 (DATA) + §29 (UX) إلى ما **يجب أن يكون قابلاً للبناء/التحقّق لاحقاً**. كل المخرجات **derived/read-only report artifacts/read-models** بلا manual write path؛ لا اسم خارج SSOT؛ reporting/analytics معزولة عن hot path وعن risk/signer (§3). أي field/command جديد محكوم بـ governance gate (§9.17). **لا تقرير/مقياس/disclaimer يمنح execution authority · لا تغيير سلوك EV gate/Hard Risk · لا execution mode · لا خلط Paper/Testnet/Real-Live · `warning_only_advisory` ليس `clean_pass` · unavailable/insufficient evidence ليس صفراً.**

### 12.1 Daily Unified Report (W3-01)
- **Build:** report build/artifact stage لاحقاً ينتج `candidate_daily_unified_report` كـ **read-only artifact** (instance من `candidate_report_definition`)، بأقسام `candidate_report_section` (الـ11) مفصولة و`candidate_report_context` (simulated/testnet/real_live) واضح، قابل للعرض في API §18.1/UX §29.1.
- **Verify (static/build-review):** **لا خلط Paper/Testnet/Real-Live** · المقياس المفقود عبر `candidate_report_missing_metric_policy` **لا يتحوّل zero** · artifact يحفظ `candidate_report_provenance`/`candidate_report_generated_at` · لا execution authority.

### 12.2 Report Definitions Catalog (W3-02)
- **Build:** build يتحقّق لاحقاً من كتالوج التعريفات الرسمية (`candidate_report_catalog`/`candidate_report_definition_type` الـ13/`candidate_report_definition`/`candidate_report_template_id`/`candidate_report_provenance`/`candidate_report_missing_metric_policy`).
- **Verify:** **القوالب الرسمية لا تستبدلها custom (static check)** · كل تعريف **يصرّح:** scope/context/dimensions/metrics/evidence(provenance)/missing-metric/disclaimer/paper-real-separation · **لا template IDs نهائية غير مسجّلة (requires_ssot_followup) · لا report generation implementation الآن.** يعيد استخدام `candidate_paper_aggregation_report`/`candidate_paper_real_divergence` (§10).

### 12.3 Weekly Comparison Report (W3-03)
- **Build:** weekly report build/projection stage لاحقاً يدعم محاور `candidate_weekly_comparison_axis` (الـ10) ضمن `candidate_weekly_comparison_report`.
- **Verify:** `config_before_after` **يحفظ/يستخدم `config_version_at_entry`** · **static check: التقرير لا يطبّق config تلقائياً (no auto-apply)** · **لا خلط Paper/Real/Live** · الفروقات المفقودة `unavailable` (عبر `candidate_report_missing_metric_policy`).

### 12.4 Disclaimer Standard (W3-04)
- **Build:** report build/artifact validation لاحقاً يتحقّق أن التقارير الحساسة (`candidate_report_disclaimer_required_for`: paper/backtest/weekly/recommendation/promotion) تحمل `candidate_report_disclaimer_requirement` (الستة).
- **Verify (static):** **advanced mode لا يكبت disclaimers المطلوبة** · **disclaimer لا يجعل تقريراً غير صالح صالحاً** · **disclaimer لا يحلّ محلّ gates** · **recommendations advisory حتى user/config flow.**

### 12.5 Net Business PnL (W3-05)
- **Build:** Net Business PnL build stage لاحقاً = **derived report only** (`candidate_net_business_pnl_report`/`candidate_net_business_pnl`/`candidate_business_cost_component` الأربعة/`candidate_net_business_pnl_status` complete/partial/unavailable)، مدخلاته trade P&L (`candidate_realized_pnl`/`candidate_fees_total`/`candidate_slippage_cost`) + costs المتاحة (`candidate_storage_usage_metric` + §16 RPC/Credit).
- **Verify (static):** **unavailable/partial لا يتحوّل zero** · **positive trade P&L لا يعني positive business P&L** · **لا runtime cost source field غير مسجّل** (requires_ssot_followup) · **Net Business PnL لا يمنح execution authority** · **wallet-level P&L لا يُخلَط مع business-level بلا label/context.**

### 12.6 warning_only Report Tag (W3-06)
- **Build:** report/result metadata build stage لاحقاً يحفظ gate context وقت القرار (`candidate_report_gate_context`: clean_pass/warning_only_advisory/blocked · `candidate_warning_only_report_tag` true/false) فوق `ev_gate_mode`/`warning_only`/`WARNING_CRITICAL`.
- **Verify (static):** **`warning_only_advisory` لا يظهر كـ `clean_pass`** · **failed EV لا يختفي** · **لا يغيّر EV gate behavior** · **لا يضعف Hard Risk** · **لا execution mode جديد** · **لا report promotion بلا disclosure.**

### 12.7 Cross-W3 Build Guards (static)
- (1) لا تقرير/مقياس/disclaimer يمنح execution authority · (2) لا apply/auto-apply من تقارير W3 · (3) لا خلط Paper/Testnet/Real-Live · (4) report context إلزامي عند احتمال الالتباس · (5) unavailable/insufficient evidence ليس zero · (6) القوالب الرسمية لا تُستبدَل صامتاً بـ custom · (7) weekly يحترم `config_version_at_entry` · (8) disclaimers مطلوبة للتقارير الحساسة · (9) disclaimer لا يجعل تقريراً غير صالح صالحاً · (10) advanced mode لا يخفي disclaimers المطلوبة · (11) Net Business PnL derived reporting فقط · (12) positive trade P&L لا يعني positive business P&L · (13) `warning_only_advisory` ليس `clean_pass` · (14) warning_only لا يغيّر EV gate behavior · (15) warning_only لا يضعف Hard Risk · (16) failed EV يبقى مرئياً تحت warning_only · (17) **لا report generation implementation هنا** · (18) **لا اسم خارج SSOT Group 39/القائم** (governance gate) · (19) **لا command/resource جديد**.

> **مبدأ §12:** Wave 3 قابلة للبناء/التحقّق لاحقاً دون تحوّل إلى كلام: التقرير اليومي artifact read-only بأقسام منفصلة وcontext واضح · القوالب الرسمية لا تستبدلها custom · weekly يحترم config_version بلا auto-apply · disclaimer إلزامي لا يُكبَت ولا يصحّح تقريراً غير صالح · Net Business PnL derived (trade≠business، unavailable/partial لا zero) بلا حقل تكلفة جديد · warning_only metadata لا يُعرَض clean_pass ولا يخفي failed EV ولا يغيّر EV gate/Hard Risk. **لا كود · لا migrations · لا report generation impl · لا أوامر جديدة · لا أسماء خارج SSOT · لا API/CONFIG/Data/UX/Test edits هنا · لا live.**

---

## 13. Wave 4 — Execution / Providers + Data — Build & Verification (candidate, تستهلك SSOT Group 40)

> **build/verification expectations فقط — لا runtime code · لا backend/frontend · لا migrations/SQL · لا build فعلي · لا provider setup/connection implementation · لا report generation impl · لا live/testnet/mainnet.** يترجم §15.12 (ARCH) + Group 40 (SSOT) + §16 (CONFIG) + §19 (API) + §13 (DATA) + §30 (UX) إلى ما **يجب أن يكون قابلاً للبناء/التحقّق لاحقاً**. كل المخرجات **derived/read-only/advisory/diagnostic projections/artifacts** بلا manual write path؛ لا اسم خارج SSOT؛ provider/cost/observability معزولة عن hot path وعن risk/signer (§3). أي field/command جديد محكوم بـ governance gate (§9.17). **لا provider raw key/secret/credential · key material خارج browser/UI/report/export/API payloads/backups/diagnostics · لا provider connection/execution/purge command · لا تقرير/مقياس يمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا خلط Paper/Testnet/Real-Live · المفقود unavailable/partial لا صفر/clean.**

### 13.1 Provider Latency Comparison (W4-01)
- **Build:** provider latency projection/read-model من execution trace/provider attribution/timing (`candidate_provider_latency_metric`/`_latency_type` الستة/`_latency_comparison`؛ reuse `candidate_ts_*`/`provider_degraded`/`slot_lag`).
- **Verify (static):** missing latency = unavailable لا صفر · best/worst **لا يولّد provider auto-selection** · fast provider ليس safe/executable · **no execution authority.**

### 13.2 Rate-limit & Provider Cost Monitor (W4-02)
- **Build:** provider cost/rate-limit monitor projection (`candidate_provider_rate_limit_monitor`/`_provider_cost_metric` العشرة/`_provider_cost_attribution_status` complete/partial/unavailable).
- **Verify (static):** partial/unavailable لا صفر · availability وaffordability منفصلتان · يُغذّي `candidate_net_business_pnl`/`candidate_business_cost_component` **دون إعادة تعريف** · **no billing/pricing fields نهائية · no execution authority.**

### 13.3 Fork / Rollback (W4-03)
- **Build:** finality/network state projection + event artifact مستقل (`candidate_finality_state` الخمسة/`candidate_rollback_fork_reason`؛ reuse `NETWORK_ROLLBACK_EVENT`/`provider_degraded`/`slot_lag`).
- **Verify (static):** rollback-affected data **تحمل warning/provenance ولا تُعامَل كحقيقة نهائية** · `no_rollback_detected` ليس execution-safe · **no new gate · no Risk Gates/Hard Risk change · no execution authority.**

### 13.4 Provider Onboarding & Key/Connection Validation (W4-04)
- **Build:** provider onboarding/readiness diagnostic projection (`candidate_provider_onboarding_status`/`_provider_type` الخمسة/`_provider_capability_status`/`_provider_connection_test_status`/`_provider_onboarding_failure_reason`؛ reuse `candidate_provider_key_ref` reference only).
- **Verify (static):** **no raw key/secret/credential fields · key material خارج browser/UI/report/export/API payloads/backups/diagnostics** · connection success ليس trading readiness · Jupiter validation diagnostic عند استخدام quotes/routes · provider readiness **لا يتجاوز SignerService/Risk Gates/admission gates** · **no provider connection command · no provider setup implementation.**

### 13.5 Storage Cost + Survivorship-Safe Retention (W4-05)
- **Build:** storage cost/report artifact (`candidate_storage_cost_report`/`_storage_cost_component` الستة/`_retention_impact_warning`/`_pruning_safety_status` safe/survivorship_risk/point_in_time_risk/audit_integrity_risk؛ reuse `candidate_storage_usage_metric`/`candidate_net_business_pnl`).
- **Verify (static):** missing storage cost = partial/unavailable لا صفر · retention warning **يشير إلى الفئات المتأثّرة** (historical discovery/dead-failed wallets/replay-backtest/audit) · **cost-saving deletion لا يخلق survivorship bias · no purge command · no storage pricing/billing fields نهائية · no execution authority.**

### 13.6 Rejected Opportunity Re-evaluation (W4-06)
- **Build:** rejected/watch_only re-evaluation projection (`candidate_rejected_opportunity_reevaluation`/`_reevaluation_trigger` الثمانية/`_reevaluation_recommendation` الخمسة؛ reuse `hunt_status`/`watch_only`/`candidate_rejected_reason`).
- **Verify (static):** **must preserve original rejection reason + original/new evidence snapshots + provenance** · re-evaluation **لا ينتج buy/execute/open-position** · no auto-config · improved opportunity لا يثبت edge · `eligible_for_normal_evaluation` ليس execution-ready.

### 13.7 Best Paper Settings This Week Advisory (W4-07)
- **Build:** best paper settings advisory report artifact (Paper-only context) (`candidate_best_paper_settings_advisory`/`_paper_settings_recommendation`/`_paper_settings_evidence_status` sufficient/insufficient_evidence/unavailable؛ reuse `candidate_paper_aggregation_report`/`_paper_real_divergence`/`_weekly_comparison_report`/`_report_disclaimer_requirement`).
- **Verify (static):** insufficient_evidence/unavailable لا صفر ولا success · **must carry** sample size/confidence/time period/mode/strategy/copy_mode/fees/slippage/latency/failure impact/paper-real divergence/disclaimer (حيث متاح) · **best paper setting ليس live-ready · no auto-apply · no live promotion بلا gates/disclosure.**

### 13.8 Graduation Trap States (W4-08)
- **Build:** token risk/readiness projection (`candidate_graduation_trap_state` السبعة؛ reuse `migration_phase`/`MIGRATION_IN_PROGRESS`/`candidate_token_readiness_component`).
- **Verify (static):** يؤثّر على readiness/exit feasibility/reports · **no execution authority · no new gate here · graduation ليس exit safety · `post_graduation_watch_only` لا يعني buy/execute · missing route/liquidity/exit evidence ليس clean/safe.**

### 13.9 Cross-W4 Build Guards (static)
- (1) أسطح W4 projections/read-models/report/diagnostic فقط · (2) لا execution authority من حقول W4 · (3) لا buy/execute/submit/write/open-position command · (4) no auto-execution · (5) no auto-config · (6) no provider connection command · (7) no provider setup implementation · (8) no raw key/secret/credential fields · (9) key material خارج browser/UI/report/export/API payloads/backups/diagnostics · (10) connection success ليس trading readiness · (11) fast provider ليس safe/executable · (12) availability وaffordability منفصلتان · (13) rollback-affected data ليست نهائية · (14) cost-saving deletion لا يخلق survivorship bias · (15) re-evaluated opportunity ليست أمر تنفيذ · (16) best paper ليس live-ready · (17) graduation ليس exit-safe · (18) المفقود unavailable/partial لا صفر/clean · (19) no EV gate change · (20) no Hard Risk change · (21) no Risk Gates change · (22) no SignerService change · (23) no Paper/Testnet/Real-Live mixing · (24) no Wave 5+.

> **مبدأ §13:** Wave 4 قابلة للبناء/التحقّق لاحقاً دون تحوّل إلى كلام: latency/cost/rollback/onboarding/storage/re-evaluation/best-paper/graduation كلها derived/read-only/advisory/diagnostic بلا execution authority · key material عبر `candidate_provider_key_ref` فقط بلا raw key · المزوّد السريع/المتصل ليس آمناً/جاهزاً · توفّر وكلفة منفصلان · بيانات rollback موسومة لا نهائية · pruning آمن للبقاء · re-evaluated ليست أمر تنفيذ · best paper ليس live-ready · graduation ليس exit-safe · المفقود unavailable/partial لا صفر. **لا كود · لا migrations/SQL · لا provider setup/connection impl · لا raw keys · لا أوامر/commands جديدة · لا report generation impl · لا أسماء خارج SSOT · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · لا API/CONFIG/Data/UX/Test edits هنا · لا live.**

---

## 14. Wave 5 — Local Ops & Readiness — Build & Verification (candidate, تستهلك SSOT Group 41)

> **build/verification expectations + static guards فقط — لا code · لا migrations/SQL · لا backend/frontend · لا scripts/launcher/runtime · لا commands · لا provider setup/connection impl · لا live/testnet/mainnet.** يترجم §15.13 (ARCH) + Group 41 (SSOT) + §17 (CONFIG) + §20 (API) + §14 (DATA) + §31 (UX) إلى ما **يجب أن يكون قابلاً للبناء/التحقّق لاحقاً**. كل المخرجات **derived/read-only/status/diagnostic projections/read-models/artifacts** بلا manual write path؛ لا اسم خارج SSOT؛ Local Ops معزولة عن hot path وعن risk/signer (§3). أي field/command جديد محكوم بـ governance gate (§9.17). **لا raw key/secret/credential · لا secrets في logs/artifacts/diagnostics/backups · لا service-control/restart/shutdown/backup/restore/purge/rollback/migration command · لا تقرير/مقياس/status يمنح execution authority · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · health green ليس trading readiness · documented_only/candidate ليس implemented · المفقود unavailable/unknown/not_verified لا clean/ready/implemented · PostgreSQL/source-of-truth authority محفوظة وrebuild projections لا يغيّرها.**

### 14.1 Local Run UI-first Workflow (W5-01)
- **Build:** local-run read-model يُنتَج من health/config/service observations (`candidate_local_run_workflow_status`/`_required_local_service`/`_local_run_missing_requirement`/`_local_run_next_action`/`_local_run_evidence_status`)؛ checklist كـ status/read-only لا command surface؛ evidence مرئي.
- **Verify (static):** `candidate_local_run_next_action` لا يُربَط بـ command endpoints · `ready_for_local_use` ليس REAL-LIVE ready · local app running لا يَسِم trading readiness · missing/stale/unknown لا تظهر clean · **لا launcher/runtime/script requirement هنا.**

### 14.2 Local Ops Health Screen (W5-02)
- **Build:** health projection يدعم الـ15 service type (`candidate_local_ops_health`/`_local_ops_service_type`/`_local_ops_service_status`/`_local_ops_health_reason`/`_local_ops_health_next_action`؛ reuse `signer_profile_status`/`operating_state`/`candidate_provider_onboarding_status`/`candidate_data_quality_metric`/`candidate_storage_usage_metric`)؛ كل status بـ reason + safe next-action؛ degraded/unavailable explainable.
- **Verify (static):** `healthy` ≠ execution-safe · SignerService `healthy` ≠ permission to sign · provider_connectivity `healthy` ≠ trading readiness · **لا يتجاوز EV gate/Hard Risk/Risk Gates/SignerService · لا restart/test/connect command · read-only/diagnostic.**

### 14.3 Operator Logs (W5-03)
- **Build:** logs قابلة للبناء كـ operator read-model/artifact فوق audit/log sources (`candidate_operator_log_event`/`_severity`/`_category`/`_service`/`_correlation_ref`/`_user_summary`/`_technical_detail`/`_safe_next_action`/`_redaction_status`)؛ كل حدث بـ user_summary/severity/category/service/correlation + redaction status؛ technical_detail ثانوي؛ redaction قبل display/export/artifact.
- **Verify (static):** **raw secrets/keys/tokens لا تظهر في logs/artifacts/diagnostics/backups · `blocked_contains_secret` يحجب display/export/artifact · stack trace ليس الرسالة الوحيدة · safe next action لا يصير command · logs لا تمنح execution authority.**

### 14.4 Migrations & Version Status (W5-04)
- **Build:** version/migration projection كـ read-only metadata/check output (`candidate_api_version_status`/`_db_schema_version`/`_config_schema_version`/`_contracts_version_status`/`_migration_status`/`_pending_migration`/`_failed_migration`/`_rollback_availability`/`_version_compatibility_status`؛ reuse `candidate_app_version`/`config_version`/`config_version_at_entry`/`migration_phase`/`MIGRATION_IN_PROGRESS`)؛ failed/pending كـ blocker/status artifacts؛ compatibility auditable.
- **Verify (static):** failed/pending/blocked/unknown لا تظهر clean · `compatible` prerequisite only لا execution authority · current version display ليس trading readiness · mismatch مرئي · **لا migration/rollback command · لا destructive migration · لا migration implementation.**

### 14.5 Upgrade / Rollback Procedure (W5-05)
- **Build:** upgrade/rollback readiness artifact كـ status/provenance/check-output فقط (`candidate_upgrade_preflight_status`/`_upgrade_backup_requirement`/`_upgrade_migration_compatibility`/`_rollback_path_status`/`_upgrade_blocked_reason`/`_post_upgrade_health_verification`/`_upgrade_incident_status`)؛ rollback path مرئي غير قابل للتنفيذ؛ failed → incident/blocker.
- **Verify (static):** preflight `pass` ليس trading readiness · `rollback_path_status=available` لا يعني وجود rollback command · backup/export artifacts بلا raw secrets · failed upgrade لا يظهر clean · **لا upgrade/rollback/backup/restore command · لا implementation.**

### 14.6 Safe Maintenance Actions Policy (W5-06)
- **Build:** maintenance action types build-visible كـ policy/status labels فقط (`candidate_maintenance_action_type`/`_action_status`/`_permission_status`/`_audit_status`/`_preview_status`/`_block_reason`/`_reversibility_status`/`_safe_shutdown_status`)؛ permission/audit/preview/block/reversibility/safe-shutdown كـ status/readiness لا execution؛ projection rebuild safety يحفظ سلطة PostgreSQL.
- **Verify (static):** action types **لا تنشئ command endpoints · لا service-control table/command · لا restart/shutdown/backup/restore/purge/rollback/migration command** · safe_shutdown لا يُوسَم safe مع pending intents/active signing/critical jobs · backup status بلا raw secrets · restore يحفظ audit/history/config · clear_cache لا يحذف source-of-truth · rebuild projections لا يغيّر سلطة PostgreSQL · **لا execution authority.**

### 14.7 Implementation Status Matrix (W5-07)
- **Build:** implementation status artifact/read-model مرتبط بـ Wave 0 `IMPLEMENTATION_STATUS_MATRIX.md` (أو status artifact لاحق) (`candidate_implementation_status`/`_implementation_status_evidence`/`_implementation_status_source`/`_capability_status_label`/`_status_verified_at`/`_status_verification_state`)؛ كل capability label بـ status + evidence/source + verification state؛ build/static checks تمنع تقديم candidate/documented كـ implemented دون evidence.
- **Verify (static):** `documented_only` ≠ implemented · `candidate` ≠ built · unknown/not_verified لا يظهر implemented · capability لا تظهر ready دون evidence · status لا يمنح execution authority · **no “documented means built”.**

### 14.8 Cross-W5 Build Guards (static)
- (1) لا field خارج SSOT Group 41/القائم · (2) لا command endpoint/resource من W5 · (3) لا service-control command · (4) لا restart command · (5) لا shutdown command · (6) لا backup command · (7) لا restore command · (8) لا purge command · (9) لا rollback command · (10) لا migration command · (11) لا provider connection command · (12) لا scripts/launcher/runtime · (13) لا migrations/SQL/backend/frontend impl · (14) لا raw key/secret/credential fields · (15) لا secrets في logs/artifacts/diagnostics/backups · (16) `ready_for_local_use` ليس REAL-LIVE ready · (17) health green ليس trading readiness · (18) SignerService `healthy` ليس permission to sign · (19) provider health ليس trading readiness · (20) failed/pending/blocked/unknown migration ليس clean · (21) preflight `pass` ليس trading readiness · (22) maintenance action types ليست executable commands · (23) documented_only/candidate ليس implemented · (24) unknown/not_verified ليس implemented · (25) missing/unknown/unavailable لا clean/ready · (26) لا execution authority من local ops/health/logs/version/status · (27) لا auto-execution · (28) لا auto-config · (29) لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · (30) projection rebuild لا يغيّر سلطة PostgreSQL/source-of-truth · (31) لا live/testnet/mainnet · (32) لا Wave 6+.

> **مبدأ §14:** Wave 5 قابلة للبناء/التحقّق لاحقاً دون تحوّل إلى كلام: local run/health/logs/version/upgrade/maintenance/implementation-status كلها derived/read-only/status/diagnostic بلا execution authority · local running ليس trading readiness · health green ليس execution-safe وsigner health ليس permission to sign · logs تُخفي الأسرار و`blocked_contains_secret` يحجب · version compatible شرط مسبق لا authority · upgrade pass ليس trading readiness وbackup بلا raw secrets · maintenance policy/states فقط (لا command table، غير سلطوية على source-of-truth) · documented_only/candidate ليس implemented (unknown → not_verified) · المفقود unavailable/unknown/not_verified لا clean/ready/implemented. **لا كود · لا migrations/SQL · لا scripts/launcher/runtime · لا أوامر/commands · لا raw keys/secrets · لا أسماء خارج SSOT · لا تغيير EV gate/Hard Risk/Risk Gates/SignerService · rebuild projections لا يغيّر source-of-truth · لا API/CONFIG/Data/UX/Test edits هنا · لا live.**
