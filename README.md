# Documentation Index — Solana Copy-Trading Engine

الوثائق المرقّمة `00`–`12` موجودة في مجلّد `docs/`؛ و`CLAUDE.md` و`README.md` في جذر المشروع. الوثائق مرقّمة حسب **أولوية البناء**. الرقم الأدنى = أساس يجب قراءته أولاً. وكيل Claude Code يقرأ `CLAUDE.md` أولاً.

| # | الوثيقة | الدور | الحالة |
|---|---|---|---|
| 00 | `00-ARCHITECTURE.md` | القرار الأعلى — التعريفات/السلوك/البوّابات + New-Coin Hunting §4.4 + **v1.8 §2.1/§15.2–§15.7 · §15.8 قرارات F-Elimination (F1–F14) · §15.9–§15.13 Waves 1–5 addenda** | معتمدة (v1.8 + F-Elimination + Waves 1–5) |
| 01 | `01-SSOT.md` | فهرس الأسماء/الحالات/الـ enums — «No field before SSOT» · **Groups 1–41** (22–27 = v1.8 · 28–36 = F-Elimination `candidate_*`، 36 = Config Policy · 37–41 = Waves 1–5 `candidate_*`) | معتمدة (v1.8 + F-Elimination + Waves 1–5) |
| 02 | `02-CONFIG-AND-POLICY-SCHEMA.md` | defaults · validation · mutability · per-wallet + **§13 F-Elimination config · §14–§17 Waves 2–5 (تستهلك Groups 38–41)** | معتمدة (1–17) |
| 03 | `03-API-CONTRACT.md` | عقد API منطقي / WebSocket + Opportunity API read-only + **§15 F-Elimination · §16–§20 Waves 1–5 (read-only/status/diagnostic)** | معتمدة (0–20) |
| 04 | `04-UX-PRODUCT-SPEC.md` | Operator Experience · Radar · Workspace · AR/EN + **§26 F-Elimination · §27–§31 Waves 1–5 (panels/labels/warnings)** | معتمدة (0–31) |
| 05 | `05-DATA-MODEL.md` | PostgreSQL/ClickHouse/Redis · runtime · audit + **§9 F-Elimination · §10–§14 Waves 1–5 (projections/read-models/artifacts)** | معتمدة (0–14) |
| 06 | `06-BUILD-SPEC.md` | اللغات · الخدمات · ترتيب البناء + **§6 Safety Activation Gates · §8 Build Capability Clusters · §9 Build Capabilities + Engineering Quality Standards · §10–§14 Waves 1–5 (build/verification/static guards)** | معتمدة (0–14) |
| 07 | `07-TEST-PLAN.md` | طبقات الاختبار · بوّابات القبول + **§8 Rejected/Forbidden Guards · §10 F-Elimination Tests · §11–§15 Waves 1–5 (AC/cross-doc/regression) · §16 Research Integration · §17 UI Acceptance Tests (11-UI-SPEC §18.3 Gate Mapping)** | معتمدة (0–17) |
| 08 | `08-RUNBOOK-OPS.md` | التشغيل · الطوارئ · الاسترداد + **§10 Operational Tuning Latitude · §13 F-Elimination Operational Procedures** | معتمدة (0–13) |
| 09 | `09-THREAT-SECURITY.md` | حضانة المفاتيح · عزل التوقيع + **§10 F-Elimination Security Controls** | معتمدة (0–10) |
| 10 | `10-AGENT-BUILD-PLAN.md` | خطة تنفيذ وكيل غير سلطوية — Gates A–E · single-provider-first · candidate guard | معتمدة |
| 11 | `11-UI-SPEC.md` | مواصفة واجهة تشغيلية غير سلطوية — Decision/Copy/Exit Operating System · 9 pages · no CLI for user · no chart-trading/technical-analysis-first UI | معتمدة |
| 12 | `12-DESIGN-SYSTEM.md` | نظام تصميم بصري/تفاعلي غير سلطوي — design tokens · components · badges · tables · timelines · states · Danger Zone · RTL/bidi · visual/interaction only | معتمدة |

> **التساق:** الوثائق **00–12 معتمدة**. الوثائق **00–09 متّسقة** بعد v1.8 + F-Elimination + **Waves 1–5 Documentation Correction Package** (كل موجة Cross-Document Audit PASS)، وتستهلك SSOT Groups 1–41؛ و**`07-TEST` يتضمّن الآن §16 Research Integration و§17 UI Acceptance Tests**. الوثائق **10 و11 و12 غير سلطوية** وتستهلك الوثائق السابقة (10 = خطة تنفيذ Gates A–E · 11 = مواصفة واجهة Decision/Copy/Exit · 12 = نظام تصميم بصري/تفاعلي مشتقّ من `04-UX`/`11-UI-SPEC`، visual/interaction only، لا يضيف SSOT/API/Data/command/event/error ولا يغيّر معنى الوثائق السابقة). **Documentation-only / Governance-only — لا code/runtime/migrations/live/commands؛ `candidate_*` ليست implemented.** سلسلة Waves 1–5: ARCH §15.9–§15.13 → SSOT Groups 37–41 → CONFIG §14–§17 → API §16–§20 → DATA §10–§14 → UX §27–§31 → BUILD §10–§14 → TEST §11–§15.

## نطاق v1.8 — New-Coin Hunting / Opportunity
النظام يدعم صراحةً صيد العملات الجديدة على Solana مع النسخ wallet-led، ويشمل: New Coin Radar · `TokenOpportunity` / opportunity read-model · Decision Trace · Token Risk diagnostics · Wallet Copyability · **Opportunity API read-only** · تحديثات `opportunity_update` stream · واجهة لمشغّل غير مبرمج بالعربية/الإنجليزية.

## حدود الأمان
- اكتشاف mint وحده **ليس إشارة شراء**.
- فرصة `accepted` **ليست إذن شراء**.
- **لا يوجد `buy_opportunity` / `execute_opportunity` / `submit_opportunity`، ولا أي أمر يحوّل Radar/Opportunity/`accepted` إلى تنفيذ مباشر.**
- ترتيب New Coin Radar **عرض/ترتيب فقط**.
- `resource_type=opportunity` **read-only** · **لا يوجد أمر للفرص** · **لا discovery-only execution mode**.
- إشارة DexScreener-only **لا توافق تنفيذاً**.
- كل تنفيذ يمرّ عبر المسار wallet/cluster/signal-led المُعدّ + Risk Gates + Exit Feasibility + عزل signer + Audit + فصل الأوضاع.

## v1.8 Delta — ما أُضيف تصميماً
صُمِّمت في ARCH/SSOT/API/Data/UX/Test كـ `candidate_*`:
- **Paper Portfolio** (موسوم simulated) · **P&L backend/data read-model** (realized lot-based/FIFO · unrealized بشرط mark صالح · fees/slippage · per-wallet/mode/brain) — **لا حساب في الواجهة، ولا P&L للفرصة**.
- **Execution Trace** (12 طابعاً زمنياً + 5 latencies + attempt/fee counters + failure_origin).
- **Provider modes** (single/multi · role/tier · onboarding) مع **provider_key_ref فقط** بعد التسجيل (لا raw key).
- **Professional charts** بمكتبة (lightweight-charts/TradingView، لا engine من الصفر) مع **OHLCV provenance** إلزامي؛ في AMM: liquidity-drain/expected-slippage بدل order-book.
- **Recommendation layer advisory-only** (لا auto-apply؛ عبر مسار config الرسمي) · **Strategy Sandbox paper-only**.
- **Retention/Export/Reporting** (profiles 30/90/180 · markdown/csv/parquet/jsonl · purge يحفظ audit مالي).

## F-Elimination Status
- **لم تعد عناصر `[F]` تعني pending.** كل عنصر [F] سابق حُسم: **promoted → candidate capability** بأسماء `candidate_*` مسجّلة في SSOT، أو **rejected → Rejected/Forbidden**.
- **لا شيء يبقى «مؤجّل/لاحق» كقدرة غير محسومة.**
- **`candidate_*`** = **governed candidate capability**. مرشّحات F-Elimination مسجّلة في SSOT Groups 22–36، ومرشّحات Waves 1–5 مسجّلة في Groups 37–41 — وكلها تملك موضعاً في ARCH/API/DATA/UX/TEST/RUN/SEC/BUILD. **كل `candidate_*` لا تعني implemented حتى اعتمادها تنفيذياً عبر المسار الحوكمي.**
- التطبيق يُبنى **كوحدة متكاملة**؛ **safety gates (Build §6) ليست scope deferral**.

### Promoted candidate capabilities (موجز)
P&L backend/data read-model · price/mark taxonomy · trade event/journal · wallet-token performance · early-buyer/cluster/repeat-winner signals · balances/sweep · position token identity · leader attribution · batch exit preview→request · alerts · reports/exports · preferences · glossary · onboarding progress · provider key flow · Opportunity/Radar guards · charts/replay/provenance. (التفاصيل في §15 API · §9 DATA · §26 UX · §13 RUNBOOK · §10 SECURITY · §9 BUILD.)

### Rejected / Forbidden (صراحةً)
- أسماء P&L القديمة غير المسبوقة: `realized_pnl` · `unrealized_pnl` · `fees_paid` · `slippage_cost` · `net_pnl` · `fee_amount`.
- `current_price` / `candidate_current_price` (البديل `candidate_current_mark_view`).
- الأمر الذرّي `exit_all_positions` / `batch_exit_all_positions` (البديل preview→request per-position).
- `buy_opportunity` / `execute_opportunity` / `submit_opportunity`.
- P&L على Opportunity/Radar · حساب P&L محلي في UX · تخزين/كشف raw provider key · افتراض order-book في AMM · ضمان stop loss · DexScreener-only كموافقة تنفيذ · `accepted` كأمر شراء.

> **`candidate_*`** = مرشّحات **معتمدة حوكمياً** لكنها **ليست implemented ولا أسماء نهائية** حتى تثبيتها في SSOT/API/Data/Build.

## Research Integration (Pack #1 + Pack #2)
- **Research Integration Pack #1** أضاف **خمسة أسماء فقط**: `quote_mint` · `usdc_quote_enabled` · `unknown_quote_mint` · `hook_upgraded_mid_hold` · `candidate_landing_outcome_by_heat_bucket`. **Pack #2 أضاف صفر أسماء جديدة.**
- الدلالات: `quote_mint` = enum رمزي canonical لعائلة الزوج (لا raw mint pubkey) · `usdc_quote_enabled` = global policy/config flag · `unknown_quote_mint` = rejected/skip reason · `hook_upgraded_mid_hold` = سبب safety/exit أثناء الاحتفاظ (لا مكوّن دخول) · `candidate_landing_outcome_by_heat_bucket` = diagnostic only (لا gate ولا auto-config).
- أرقام البحث تبقى **Evidence Log** فقط، ولا تتحوّل إلى config thresholds.
- **بلا تغيير سلوكي** في: Hard Risk · EV Gate · SignerService · منع تنفيذ Opportunity/Radar · لا P&L داخل Opportunity/Radar · Candidate guard.

## تجربة المشغّل (UX)
نموذج تنقّل **9 صفحات**: Command Center · Trading Workspace · New Coin Radar · Wallet Intelligence · Analytics & Reports · My Wallets & Funds · Settings & Safety · Alerts · Help/Glossary. مع: beginner/advanced · AR/EN + RTL/LTR · Live Trades · Wallet Intelligence · Analytics & Reports · My Wallets & Funds · Alerts · Help/Glossary · تقرير Markdown بنقرة واحدة. **المقاييس غير المتوفّرة تُعرض `unavailable` (لا تُختلق)، حسب `candidate_report_missing_metric_policy`.**

## الأسرار / السلامة
- التصديرات **لا تتضمّن أبداً** private keys / seed phrases / signer credentials / auth tokens.
- **stop loss لا يضمن الخروج** في السيولة الرقيقة.
- الخروج الطارئ/اليدوي يخضع لـ ownership / route / Exit Feasibility / Audit / signer controls.

## بناء المشروع
- **06-BUILD لم يعد يستخدم MVP phasing لقدرات F-Elimination.**
- **§6 = Integrated Platform Scope — Safety Activation Gates** (Gates A–E) داخل build متكامل.
- **§8 = Build Capability Clusters** (بناء متكامل، sequencing هندسي لا تأجيل نطاق).
- **§9 = Build Capabilities + Engineering Quality Standards** (معايير قابلة للاختبار).
- **REAL-LIVE = gate/activation decision** بشرط readiness/signer/Hard-Risk — **وليس سبباً لتعليق research/paper/charts/reports** (كلها ضمن البناء المتكامل).

## إرشادات Claude / المطوّرين
- لا تُضِف field/command/resource إلا عبر **ARCH → SSOT → CONFIG/API/DATA/UX/TEST** حسب الحاجة.
- قبل استخدام أي `candidate_*` تأكّد أنه مسجّل في **SSOT Groups 22–41** أو في مجموعة SSOT اللاحقة المعتمدة صراحةً.
- **لا تحوّل candidate إلى implemented** لمجرّد وجوده في README — هو قدرة محوكمة لا كود منفّذ.
- لا تُعِد تسمية/إحياء **rejected aliases**؛ لا تُضِف أوامر **opportunity تنفيذية**.
- لا تُدخِل **raw provider keys** في logs/exports/backups/diagnostics/browser state.
- لا تترك صياغة **pending/later/مؤجّل** لأي قدرة منتج.

## القاعدة الحاكمة
كل ما في الوثائق 02+ يستهلك أسماء `01-SSOT.md` ولا يعيد تعريفها. أي حقل جديد: ARCHITECTURE → SSOT → ثم الوثيقة التنفيذية. **المعمارية والقدرات (v1.8 + F-Elimination) مكتملة الآن، والتطبيق يُبنى كوحدة متكاملة؛ الأسماء الجديدة `candidate_*` حتى التثبيت، والبوّابات safety activation لا scope deferral.** **REAL-LIVE يبقى قرار المستخدم، لكنه لا يعمل دون readiness/signer/Hard-Risk/security gates صالحة.**
