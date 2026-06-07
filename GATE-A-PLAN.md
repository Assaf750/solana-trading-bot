# GATE-A-PLAN.md — خطة Gate A (توثيق وحوكمة قبل التنفيذ)

> **الحالة:** خطة توثيقية غير سلطوية (proposal). تُقرأ بعد `10-AGENT-BUILD-PLAN.md`.
> **النوع:** Implementation Plan proposal فقط. **لا تضيف أي اسم خارج SSOT**، ولا تُنشئ gates/milestones جديدة — كل تسلسل هنا **إسقاط حرفي** من `06-BUILD-SPEC §4/§6/§8.1` و Build Order في `CLAUDE.md` و Gates A–E في `10-AGENT-BUILD-PLAN.md §7`.
> **القاعدة الحاكمة:** المشروع الآن **DOCUMENTATION-ONLY**. كل ما يلي **مقترَح بلا تطبيق**؛ لا git/repo/Docker/migrations/config/code قبل موافقة صريحة ترفع القيد.
> **تاريخ الإصدار:** 2026-06-07.

---

## 0. نطاق هذه الخطة
تفصيل **Gate A — Foundations / Non-trading Baseline** فقط (أوّل بوّابة)، مع:
1. متطلّبات حوكمية يجب إغلاقها **قبل** أوّل سطر كود (Pre-Gate-A).
2. تفكيك Gate A إلى مراحل و **PRs مقترحة** (دون تطبيق).
3. بوّابة القبول `A → B` ومعايير «Definition of Done».

ما بعد Gate A (Gates B–E) محسوم في `10-AGENT-BUILD-PLAN.md §7` ولا يُعاد تعريفه هنا.

---

## 1. متطلّبات Pre-Gate-A (حوكمة/توثيق — يجب إغلاقها أولاً)

| # | المتطلّب | المرجع | الحالة | القرار المطلوب |
|---|---|---|---|---|
| PG-1 | حسم تعارض مسار `docs/` (الوثائق في الجذر مقابل مراجع `docs/...` و`@docs/01-SSOT.md`) | `IMPLEMENTATION-MEMO.md §4.1` | **مفتوح** | اختيار: نقل إلى `docs/` **أو** تصحيح المسارات في `CLAUDE.md`+`README.md`+`doc 10` |
| PG-2 | الموافقة على رفع قيد DOCUMENTATION-ONLY لبدء الكود (وتحديث `CLAUDE.md` تبعاً) | `CLAUDE.md` (DOCUMENTATION-ONLY) | **مفتوح** | قرار المستخدم الصريح |
| PG-3 | تأكيد أنّ Gate A **لا يحتاج أي اسم خارج SSOT** (كله `internal-only` أو أسماء SSOT قائمة) | `10-AGENT-BUILD-PLAN.md §8` | جاهز للتحقّق | مراجعة قائمة الأسماء أدناه (§3) |
| PG-4 | تثبيت سياسة الفروع/الـ PR والـ CI كحوكمة قبل الكود | `06-BUILD-SPEC §5` | **مفتوح** | الموافقة على نموذج PR في §4 |

> **لا يُنفَّذ أيّ بند تنفيذي من PG-1/PG-2 الآن.** PG-1 (إن اختير مساره) و PG-2 يفتحان الباب للمراحل أدناه.

---

## 2. ماذا يشمل Gate A بالضبط (من `06-BUILD-SPEC §6` و `10 §7`)
البنية الأساسية **بلا أي قدرة تداول**:
- repo layout · `ssot-types` و`contracts` typed من SSOT القائم.
- config loading + validation + mutability (`02-CONFIG`).
- migrations (PostgreSQL/ClickHouse) skeleton + **audit write path** (مبكّراً).
- health endpoints · `management-api` skeleton · dashboard shell.
- Foundations & Governance Cluster: provider onboarding boundary + single/multi mode skeleton (`candidate_provider_key_ref` reference-only) · Execution Trace hooks · health/incident · audit/observability hooks.
- **بترتيب Build Order الداخلي:** `cost-pipeline → calibration-store → rpc-health-monitor → protocol-constant-monitor`.

**خارج Gate A صراحةً:** أي signing/sending · Risk Gates enforcement حيّة · decision/execution فعلي · أي محفظة تنفيذ (هذه Gates B+).

---

## 3. الأسماء (No name before SSOT)
- **غالبية Gate A داخلية بحتة** ⇒ تُوسَم `none — internal-only` (repo skeleton · Docker Compose · CI · lint/format · مجلّدات الخدمات · test fixtures). هذه **لا تتطلّب توقّفاً حوكمياً** (`10 §8`).
- الأسماء القائمة في SSOT التي ستُستهلَك كـ types/contracts فقط (أمثلة، تُؤكَّد عند التنفيذ): config keys في `02-CONFIG`/SSOT G6–G9 · audit vocabulary (G14) · health/readiness (G5) · provider vocabulary candidate (G24/G40: `candidate_provider_mode` · `candidate_provider_role` · `candidate_provider_tier` · `candidate_provider_key_ref` · `candidate_err_provider_unconfigured` + أوامر provider candidate).
- **قاعدة:** أيّ اسم user/API/runtime/config يظهر ولا مدخل له في SSOT ⇒ **توقّف وارفع `ARCH → SSOT`**، لا تخترع.

---

## 4. المراحل و PRs المقترحة (proposal — لا تطبيق)

> كل PR يتبع شكل task packet في `10-AGENT-BUILD-PLAN.md §8` ويحمل `No-SSOT-Drift check: PASS`. الترتيب يحترم Build Order و dependency graph. **مقترح فقط.**

### PR-A0 — Repo & Governance Bootstrap *(internal-only)*
- **GOAL:** مستودع قابل للبناء + حسم PG-1.
- **المحتوى:** `git init` · حلّ تعارض مسار `docs/` (حسب قرار PG-1) · repo skeleton (`/services` · `/apps` · `/packages` · `/migrations` · `/infra/docker`) · `.gitignore` · README تطويري داخلي · سياسة فروع.
- **SSOT NAMES:** none — internal-only.
- **DONE:** الشجرة قائمة · ترتيب القراءة في الوثائق يطابق البنية الفعلية.

### PR-A1 — Local Infra (Docker Compose) *(internal-only)*
- **GOAL:** PostgreSQL + ClickHouse + Redis محلياً (`06-BUILD-SPEC §5`).
- **المحتوى:** `infra/docker/compose` للحاويات الثلاث فقط · لا أسرار حيّة · قيم dev وهمية/معزولة.
- **DONE:** `compose up` يقلع الخدمات الثلاث محلياً.

### PR-A2 — `ssot-types` + `contracts` *(SSOT-consuming)*
- **GOAL:** أنواع/عقود مشتقّة من SSOT القائم بلا اسم خارج SSOT.
- **المحتوى:** `packages/ssot-types` · `packages/contracts` (تستهلك `03-API`) · vocabulary-drift guard أوّلي.
- **SSOT NAMES:** أسماء SSOT قائمة فقط (تُدرَج في الـ packet).
- **DONE:** types تُولَّد · فحص drift يمرّ · candidate يبقى candidate (لا حذف بادئة).

### PR-A3 — Config Loading + Validation + Mutability *(SSOT-consuming)*
- **GOAL:** تحميل/تحقّق الإعداد حسب `02-CONFIG`.
- **المحتوى:** loader · validation · mutability per-wallet · **Hard Risk إلزامي لـ REAL-LIVE** (config غير صالح لـ REAL-LIVE إن غابت حدود Hard Risk).
- **DONE:** config صالح/غير صالح يُكتشَف صحيحاً · لا threshold جديد.

### PR-A4 — Data Layer + Audit Write Path *(SSOT-consuming)*
- **GOAL:** migrations skeleton + `audit_log` append-only **مبكّراً** (قبل أي قرار Risk/Signer/Execution).
- **المحتوى:** Postgres/ClickHouse migrations skeleton · audit append-only repository · Redis adapter · **لا تُولَّد الأسماء المرفوضة كأعمدة/كيانات** · storage-only تبقى داخلية.
- **SSOT NAMES:** audit vocabulary (G14) وأسماء data القائمة.
- **DONE:** migrations تُطبَّق على بيئة dev · audit write path حيّ وقابل للتدقيق.

### PR-A5 — Build-Order Foundations Modules *(internal/SSOT-consuming)*
- **GOAL:** `cost-pipeline → calibration-store → rpc-health-monitor → protocol-constant-monitor` بالترتيب.
- **المحتوى:** هياكل الوحدات الأربع كـ foundations قبل ما يليها (لا تنفيذ تداول).
- **DONE:** الوحدات الأربع قائمة ومختبَرة unit حسب ترتيبها.

### PR-A6 — Health + Management API Skeleton + Dashboard Shell *(SSOT-consuming)*
- **GOAL:** health endpoints · `management-api` skeleton · dashboard shell بلا قدرة تداول.
- **المحتوى:** health/readiness (G5) · API skeleton (يستهلك `03-API`، read-only، لا أوامر فرص، لا `api_error_code` جديد) · dashboard shell · **AR/EN + RTL** كسطح قبول.
- **DONE:** dashboard shell يقلع · health أخضر (≠ trading readiness).

> **ملاحظة فرع Analytics:** Analytics/Reports/Charts فرع مستقلّ يقرأ Data layer، يُبنى بالتوازي بعد PR-A4 دون منح execution authority (`10 §7` ملاحظة Analytics).

---

## 5. بوّابة القبول `A → B` (Definition of Done لـ Gate A)
من `10-AGENT-BUILD-PLAN.md §9` و `06-BUILD-SPEC §6`:
- config validation تعمل.
- audit write path حيّ.
- health endpoints قائمة.
- contracts typed من SSOT **بلا اسم خارج SSOT**.
- dashboard shell يقلع.
- **حُرّاس عامّة لكل PR:** Build/Test خضراء · لا drift في المفردات · candidate guard (`10 §14`) يمرّ · لا أسرار في أي artifact.

**لا انتقال إلى Gate B** قبل اكتمال ما سبق.

---

## 6. ما لا يُفعَل في Gate A (تذكير حُرّاس)
- لا signing/sending · لا توقيع حيّ · SignerService skeleton/boundary فقط (mock).
- لا Risk Gates enforcement حيّة على تنفيذ فعلي (تُبنى وتُفعَّل في مسارها بـ Gate B).
- لا أوامر فرص · لا أمر خروج ذرّي · لا P&L محلي كمصدر حقيقة.
- لا raw provider key في أي مكان · provider عبر `candidate_provider_key_ref` فقط.
- لا تحويل أي `candidate_*` إلى implemented.

---

## 7. التسليمات عند إغلاق Gate A
حسب `10-AGENT-BUILD-PLAN.md §13`:
- Code diff summary (لكل PR) · Tests run (unit/contract/integration/safety) · Docs impact · Open questions · **No-SSOT-drift check: PASS/FAIL**.
- تقرير اجتياز بوّابة `A → B` + حالة الحُرّاس + ملخّص ما يفتحه الانتقال إلى Gate B.

---

## 8. الخطوة التالية المطلوبة منك
1. حسم **PG-1** (مسار `docs/`): نقل أم تصحيح مسارات؟
2. حسم **PG-2**: الموافقة على رفع DOCUMENTATION-ONLY لبدء الكود (مع تحديث `CLAUDE.md`).
3. مراجعة ترتيب PRs أعلاه والموافقة عليه أو تعديله.

**حتى صدور الموافقة، لا يُنفَّذ أيّ بند تنفيذي — هذه الخطة توثيقية بحتة.**
