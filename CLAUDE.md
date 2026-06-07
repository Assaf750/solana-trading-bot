# CLAUDE.md — Solana Smart-Money Copy-Trading Engine

> ملف توجيه وكيل Claude Code. يُقرأ أولاً في كل جلسة. يبقى مختصراً ويحيل للوثائق المرقّمة في `docs/`.

## Project Overview
محرّك تداول كمّي خاص على Solana: **صيد العملات الجديدة + نسخ wallet-led**. مُحسَّن لاكتشاف/ترتيب فرص التوكنات الجديدة عبر New Coin Radar / `TokenOpportunity` / Decision Trace، مع نسخ المحافظ الرابحة بنمطين قابلين للتعديل لكل محفظة: `follow_entry_user_exit` و`full_mirror`. عقلان: Brain A (Pump.fun bonding curve) وBrain B (PumpSwap/Open Market) مع تسليم تحكّم عند الهجرة. **التنفيذ يبقى wallet/cluster/signal-led افتراضياً؛ اكتشاف mint وحده ليس إشارة شراء؛ `resource_type=opportunity` / `TokenOpportunity` مفاهيم pre-position/read-oriented؛ لا discovery-only execution mode.**

## Tech Stack
- **Hot path:** Rust · **Dashboard:** TypeScript
- **Data streams:** Helius LaserStream gRPC + Triton/Yellowstone gRPC
- **Routing:** Jupiter Swap API v2 (api.jup.ag + مفتاح API إلزامي)
- **Execution:** Helius Sender + Jito (sendTransaction/Bundle) · **Tip:** bundles.jito.wtf
- **Storage:** PostgreSQL + ClickHouse + Redis + RAM HashSet

## القواعد الحاكمة (لا تُخالَف)
1. **No field before SSOT.** أي field/enum/state/event/status/mode/policy/risk_flag/command لا يُستخدَم في أي كود أو وثيقة قبل تسجيله في `docs/01-SSOT.md`. ظهر حقل جديد؟ أوقِف → أقرّه في `docs/00-ARCHITECTURE.md` → سجّله في SSOT → ثم استخدمه. **يشمل المنع صراحةً:** fields · enums · API request/response fields · Data columns/entities · `command_type` · `api_error_code` · `resource_type` · `stream_channel` · `event_type` · `audit_scope` · Config thresholds — لا يُضاف أيّ منها دون **Architecture → SSOT → الوثيقة التنفيذية**.
2. **تراتبية الملكية:** ARCHITECTURE يملك القرار · SSOT يملك الأسماء الرسمية والقيم · Config يملك default/validation/mutability/behavior · API/UX/Data Model تستهلك ولا تعيد التعريف.
3. **الاسم الرسمي = `source_of_truth_field` في SSOT فقط.** الترجمة العربية شرح لا اسم تنفيذ. لا aliases (انظر Rejected Aliases في SSOT).
4. **Fail Safe Not Fail Open.** عند الشكّ: توقّف أو EXITS_ONLY، لا تستمرّ بالشراء.
5. **Hard Risk vs EV:** حدود Hard Risk مُلزِمة دائماً ولا يتجاوزها `ev_gate_mode = warning_only`. عتبات EV تخضع لـ `ev_gate_mode`. التصنيف بالقائمة الصريحة لا باللاحقة.
6. **REAL-LIVE قرار المستخدم** (لا بوابة ورقي حاجبة)، **لكن** config غير صالح لـ REAL-LIVE إن غابت حدود Hard Risk (لا لانهائية ضمنية).
7. **لا API call خارجي في الـ hot path** (cache + async refresh). **لا مفاتيح خاصة في الواجهة/اللوقات** (SignerService معزول). **لا REAL-LIVE قبل اكتمال Key Management.**
8. **Config vs runtime state:** ما يحرّره المستخدم = Config · ما يُقرأ = state · ما يُحسب أثناء التشغيل (`cumulative_ignored_sell`, `disable_new_adds`, `config_version_at_entry`) = runtime (Data Model)، لا Config.

## Documents
- `docs/00-ARCHITECTURE.md` — APPROVED (v1.8 §2.1/§15.2–§15.7 · §15.8 F-Elimination F1–F14 · **§15.9–§15.13 Waves 1–5 addenda**)
- `docs/01-SSOT.md` — APPROVED, **Groups 1–41** (22–27 = v1.8 · 28–36 = F-Elimination `candidate_*`، 36 = Config Policy · **37–41 = Waves 1–5 `candidate_*`**)
- `docs/02-CONFIG-AND-POLICY-SCHEMA.md` — APPROVED (1–17 · §13 F-Elimination config · **§14–§17 Waves 2–5**)
- `docs/03-API-CONTRACT.md` — APPROVED (0–20 · Opportunity API read-only · §15 F-Elimination surfaces · **§16–§20 Waves 1–5**)
- `docs/04-UX-PRODUCT-SPEC.md` — APPROVED (0–31 · §26 F-Elimination UX · **§27–§31 Waves 1–5**)
- `docs/05-DATA-MODEL.md` — APPROVED (0–14 · §9 F-Elimination Data Model · **§10–§14 Waves 1–5**)
- `docs/06-BUILD-SPEC.md` — APPROVED (0–14 · §6 Safety Activation Gates · §8 Build Capability Clusters · §9 F-Elimination Build Capabilities + Engineering Quality Standards · **§10–§14 Waves 1–5**)
- `docs/07-TEST-PLAN.md` — APPROVED (0–15 · §8 Rejected/Forbidden Guards · §10 F-Elimination Tests · **§11–§15 Waves 1–5**)
- `docs/08-RUNBOOK-OPS.md` — APPROVED (0–13 · §10 Operational Tuning Latitude · §13 F-Elimination ops)
- `docs/09-THREAT-SECURITY.md` — APPROVED (0–10 · §10 F-Elimination Security Controls)
- `docs/10-AGENT-BUILD-PLAN.md` — APPROVED (خطة تنفيذ وكيل غير سلطوية · Gates A–E · single-provider-first · candidate guard)
- `docs/11-UI-SPEC.md` — APPROVED (مواصفة واجهة تشغيلية غير سلطوية · Decision/Copy/Exit Operating System · 9 pages · no CLI for user · no chart-trading/technical-analysis-first UI)
- `docs/12-DESIGN-SYSTEM.md` — APPROVED (نظام تصميم غير سلطوي · visual/interaction only · design tokens/components/patterns · لا SSOT/API · مشتق من UX/UI)
- `README.md` — APPROVED (index/summary بعد F-Elimination + Waves 1–5)

**Current state: v1.8 + F-Elimination + Waves 1–5 Documentation Correction Package integrated as `candidate_*` (Cross-Document Audit PASS لكل موجة: Wave 1 Profit & Paper Truth · Wave 2 Discovery & Copy Safety · Wave 3 Reports & Honesty · Wave 4 Execution/Providers+Data · Wave 5 Local Ops & Readiness). المعمارية والقدرات مكتملة، والتطبيق يُبنى كوحدة متكاملة (Safety Activation Gates لا scope deferral). DOCUMENTATION-ONLY** — لا كود، لا migrations، لا live، لا commands، ولا تحويل `candidate_*` إلى implemented أو أسماء نهائية قبل تثبيتها في SSOT والموافقة الحوكمية النهائية.

### Gate A Activation (رفع محدود جداً لـ DOCUMENTATION-ONLY)
**رُفِع قيد DOCUMENTATION-ONLY رفعاً محدوداً جداً لغرض Gate A (Foundations / non-trading baseline) فقط** — لا يشمل أي مرحلة لاحقة. تفاصيل النطاق في `IMPLEMENTATION-MEMO.md` و`GATE-A-PLAN.md`.
- **المسموح حالياً: PR-A0 فقط** (repo bootstrap: `git init` · نقل الوثائق إلى `docs/` · skeleton فارغ · `.gitignore`/`.gitattributes` · `CONTRIBUTING.md` + `PULL_REQUEST_TEMPLATE.md`). **بعد دمج PR-A0 يُطلب PR-A1 بقرار منفصل صريح؛ لا PR-A1 أو ما بعده تلقائياً.**
- **يبقى ممنوعاً حتى مع هذا الرفع:** signing/sending · أي قدرة تداول · secrets/مفاتيح · config حي/تنفيذي · migrations تنفيذية · **Docker قبل موافقة PR-A1** · تحويل أي `candidate_*` إلى implemented · أي اسم خارج SSOT.
- البوّابات الأعلى (paper · execution wallet · multi-wallet · REAL-LIVE) تبقى مغلقة بشروط readiness كما في `06-BUILD §6`.

### قاعدة [F]
**`[F]` وسم تاريخي فقط.** عناصر [F] السابقة **حُسمت**: المُرقّى = **`candidate_*` capability محوكمة** (مسجّلة في SSOT Groups 22–36، لها موضع في ARCH/API/DATA/UX/TEST/RUN/SEC/BUILD)؛ المرفوض = **Rejected/Forbidden**. **لا يجوز التعامل مع أي [F] سابق كعمل غامض مؤجّل، ولا وصف قدرة F-Elimination بأنها future/MVP later/pending.**

## v1.8 New-Coin Hunting / Opportunity — قواعد الوكيل
- النظام مُحسَّن لصيد العملات الجديدة على Solana + نسخ wallet-led.
- `TokenOpportunity` / `resource_type=opportunity` مفاهيم **read-oriented / pre-position**.
- New Coin Radar عرض/ترتيب **لا موافقة تنفيذ** · `accepted` **ليست إذن شراء** · اكتشاف mint وحده **ليس إشارة شراء** · DexScreener-only **لا يوافق تنفيذاً** · **لا discovery-only execution mode** · **لا `command_type` للفرص** · **لا execution authority عبر `opportunity_update`** · `new_token_priority_score` **ترتيب فقط** · حقول derived/runtime/decision **read-only**.

**Rejected/Forbidden (لا تُولَّد كحقول/أوامر حقيقية):** أسماء P&L القديمة غير المسبوقة `realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount` · `current_price`/`candidate_current_price` (البديل `candidate_current_mark_view`) · الأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` (البديل preview→request per-position) · `buy_opportunity`/`execute_opportunity`/`submit_opportunity`. **Promoted (candidate، عبر مسارها المعتمد ARCH→SSOT→API/DATA/UX/TEST/RUN/SEC/BUILD):** P&L read-model · price/mark taxonomy · trade event/journal · wallet-token performance · early-buyer/cluster/repeat signals · balances/sweep · position token identity · leader attribution · batch exit preview→request · alerts · reports/exports · preferences · glossary · onboarding progress · provider key flow · charts/replay/provenance — بأسماء `candidate_*` المسجّلة، بشروطها (mark valid · simulated · provenance)، backend/data-owned لا UX-local، ولا P&L على Opportunity/Radar.

**ممنوع توليد/تنفيذ:** `buy_opportunity` · `execute_opportunity` · `submit_opportunity` · `exit_all_positions` · `batch_exit_all_positions` · toggle `stop_loss` · toggle `time_exit` · `api_error_code` جديد · `operating_state` جديد · raw REST يتجاوز العقد المنطقي command/resource · P&L محلي كمصدر حقيقة · **لا تعريف `HUNTABLE` كـ badge / UI enum / executable state مطلقاً (يجوز ذكره فقط كنص منع/رفض داخل الوثائق)** · زر شراء مباشر من mint discovery · تنفيذ من `accepted`.

**توقّعات UX:** نموذج 9 صفحات · مشغّل غير مبرمج · AR/EN · RTL/LTR · beginner/advanced · derived diagnostics read-only · **لا إخفاء تحذيرات أمان** · المقاييس غير المتوفّرة تُعرض `unavailable` (لا تُختلق) حسب `candidate_report_missing_metric_policy` · التصدير يحجب الأسرار.

**الأمان/السلامة:** لا private keys/seed/signer credentials/auth tokens في export/log/docs · عزل signer · فصل الأوضاع · Exit Feasibility · Hard Risk · audit · idempotency/منع التكرار · **stop loss لا يضمن الخروج** في السيولة الرقيقة · **فجوة opportunity stream وحدها لا تُطلِق EXITS_ONLY** · خرق chain/provider الحرج يتبع EXITS_ONLY القائم.

**توقّعات التحقّق (عند تعديل docs/code لاحقاً):** drift المفردات بين SSOT/API/Data/Test · لا تسرّب اسم مرفوض دائماً كحقل/أمر حقيقي · لا أمر فرص مُولَّد · لا `api_error_code` جديد · لا storage-only مكشوف عبر API · حقول derived/runtime/decision تبقى read-only · حُرّاس Build/Test خضراء · candidate يظهر بأسمائه `candidate_*` المسجّلة فقط.

## Build Order (حين يبدأ الكود)
ابنِ بهذا الترتيب: `CostPipeline` → `CalibrationStore` → `RPCHealthMonitor` → `ProtocolConstantMonitor` → `SignerService`/`KeyManager` → `PositionLifecycleStateMachine` → `IntentLedger`. وحدات الـ live hardening وSignerService/KeyManager **إلزامية قبل تفعيل REAL-LIVE**.

## Workflow Preferences
- اقرأ الوثيقة ذات الصلة قبل الكتابة؛ لا تفترض حقلاً غير موجود في SSOT.
- عند الغموض المعماري: اسأل/أوقِف بدل الاختراع.
- التغييرات على الوثائق تُدمج كنصّ أصلي بلا سجل تغييرات (تفضيل المستخدم).

## v1.8 Delta — قواعد عمل صارمة (لأي تعديل لاحق)
1. **No field before SSOT** — لا حقل/أمر/مورد/enum خارج ARCH→SSOT→API/Data/UX/Test.
2. كل أسماء v1.8 الجديدة تبقى **`candidate_*`** حتى اعتماد الاسم النهائي في SSOT؛ **لا تحويلها إلى implemented**.
3. **لا `buy_opportunity` ولا `execute_opportunity`** ولا أي تحويل radar→تنفيذ.
4. **Radar/Opportunity/`accepted`/`new_token_priority_score` لا تمنح execution authority**؛ `copy_signal_candidate` ليست أمر شراء.
5. **لا P&L في UX كمصدر حقيقة**؛ P&L **backend/data read-model فقط**؛ **Opportunity/Radar بلا P&L**. unrealized يُعرض فقط مع `candidate_mark_status=valid`.
6. **Provider secrets:** raw key ممنوع؛ بعد التسجيل **`provider_key_ref` فقط** — لا raw key في UI/DB/logs/reports/diagnostics/backups/exports.
7. **Diagnostic bundles/logs/reports/backups/exports بلا أسرار** (redaction إلزامي).
8. **Strategy Sandbox paper-only** — لا يمسّ live/risk/signer/execution config.
9. **Recommendations advisory-only، لا auto-apply** — كل تبنٍّ عبر preview→validation→permission→audit→config-version.
10. **Maintenance commands admin/local-ops only** — لا تتجاوز pending critical intents/active signing/audit preservation (purge لا يحذف audit مالي).
11. **Charts:** مكتبة احترافية؛ **لا custom engine من الصفر** إلا بتبرير معماري. **OHLCV يحتاج provenance**؛ display-only لا يُعرض كحقيقة تنفيذ.
12. **AMM لا يعني order-book** — استخدم liquidity-drain/expected-slippage حين لا يوجد order-book.
13. **Integrated Build — Safety Activation Gates, not scope deferral** — المعمارية والقدرات (v1.8 + F-Elimination) مكتملة، والتطبيق يُبنى كوحدة متكاملة. `06-BUILD §6` = Safety Activation Gates (Gates A–E، لا MVP phasing) · `§8` = Build Capability Clusters · `§9` = F-Elimination Build Capabilities + Engineering Quality Standards. **REAL-LIVE = gate/activation بشرط readiness — لا يعلّق research/paper/charts/reports.** لا «MVP later»/«future F»/«pending capability».
14. **لا كود، لا migrations، لا live** ضمن مرحلة التوثيق هذه — **عدا الرفع المحدود جداً لـ Gate A (PR-A0 فقط حالياً)** الموضّح في قسم «Gate A Activation» أعلاه. يبقى ممنوعاً: signing/sending · تداول · secrets/مفاتيح · config حي · migrations تنفيذية · Docker قبل PR-A1 · candidate→implemented.



## ترتيب القراءة
1. `CLAUDE.md` (هذا الملف) → 2. `README.md` → 3. `docs/00-ARCHITECTURE.md` → 4. `docs/01-SSOT.md` → 5. `docs/02-CONFIG` → 6. `docs/03-API` → 7. `docs/05-DATA` → 8. `docs/04-UX` → 9. `docs/07-TEST` → 10. `docs/08-RUNBOOK` → 11. `docs/09-SECURITY` → 12. `docs/06-BUILD` → 13. `docs/10-AGENT-BUILD-PLAN.md` → 14. `docs/11-UI-SPEC.md` → 15. `docs/12-DESIGN-SYSTEM.md`. **SSOT قبل أي استخدام لأي اسم/حقل؛ CLAUDE لا يناقض README.**

## قواعد تعديل الوثائق لاحقاً
- أي field/command/resource جديد: **ARCH → SSOT → CONFIG/API/DATA/UX/TEST/RUN/SEC/BUILD** حسب الحاجة.
- **لا تعدّل أكثر من ملف في الجولة الواحدة** إلا بإذن صريح.
- عند تعديل ملف، **نظّف التعارضات القديمة داخل نفس الملف** — لا تكتفِ بإضافة قسم جديد.
- **لا تترك صياغة pending/later/مؤجّل** لأي قدرة منتج.
- إذا وجدت اسماً غير موجود في SSOT، **توقّف وارجع إلى SSOT أولاً**.
- **لا تعتمد على summary فقط؛ افحص محتوى الملف.**
- `candidate_*`: لا تحذف الـ prefix · لا تعيد تسميته بلا ARCH→SSOT · لا تنشئ candidate جديداً خارج SSOT · لا تنقله إلى implemented (كوداً أو وثيقةً) دون قرار صريح.

## التنفيذ الحي والأسرار (غير قابلة للتفاوض)
- **لا live activation** دون اجتياز readiness/signer/Hard-Risk/security gates.
- **لا raw provider key** في browser/logs/reports/exports/backups/diagnostics؛ provider flow عبر `candidate_provider_key_ref` بعد التسجيل.
- **لا private key/seed/signer credential** في UI/DB/logs/reports.
- **SignerService isolation وRisk Gates غير قابلة للتفاوض؛ لا تجاوز order/sign/send.**

@docs/01-SSOT.md
