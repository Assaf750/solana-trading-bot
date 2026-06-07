# IMPLEMENTATION-MEMO.md — مذكرة التنفيذ (Implementation Memo)

> **الحالة:** مذكرة توثيقية غير سلطوية (planning note). تُقرأ بعد الوثائق المعتمدة `00`–`12`.
> **النوع:** Implementation Memo فقط — **ليست** Architecture/SSOT/API/UX/Security/Runbook، ولا تضيف أي `field`/`enum`/`state`/`event`/`command_type`/`resource_type`/`api_error_code`/threshold/اسم جديد.
> **القاعدة الحاكمة:** عند أي تعارض بين هذه المذكرة وأي من `00`–`12`/`CLAUDE.md`/`README.md` تُغلَّب الوثيقة المعتمدة ويُصحَّح هذا الملف. المشروع الآن **DOCUMENTATION-ONLY**: لا كود، لا migrations، لا Docker، لا config تنفيذي، لا live.
> **تاريخ الإصدار:** 2026-06-07.

---

## 0. الغرض
إعطاء صورة حالة موجزة ودقيقة قبل أي تنفيذ، وتحديد التعارضات وملاحظات الجاهزية التي يجب حسمها حوكمياً **قبل** فتح Gate A للكود. هذه المذكرة لا تبدأ تنفيذاً ولا ترفع قيد DOCUMENTATION-ONLY.

---

## 1. ما هو المشروع (موجز)
محرّك تداول كمّي خاص على Solana: **صيد العملات الجديدة + نسخ المحافظ الرابحة (wallet-led)**. عقلان: Brain A (Pump.fun bonding curve) و Brain B (PumpSwap/Open Market) مع تسليم تحكّم عند الهجرة. المبدأ الثابت: **اكتشاف mint وحده ليس إشارة شراء**، وكل تنفيذ يمرّ عبر مسار wallet/signal-led + Risk Gates + Exit Feasibility + عزل signer + Audit + فصل الأوضاع.

---

## 2. الحالة الراهنة — توثيق وحوكمة فقط
- **15 ملفاً معتمداً:** `CLAUDE.md` + `README.md` + 13 وثيقة مرقّمة (`00`–`12`).
- **النسخة:** v1.8 + F-Elimination + **Waves 1–5** — كل موجة اجتازت Cross-Document Audit (PASS).
- **SSOT:** `01-SSOT.md` يضمّ **41 مجموعة** (Groups 1–41):
  - 1–21: الأساس (states · modes · intents/events · risk · EV · per-wallet · versioning · API · audit · signer · discovery · exit ...).
  - 22–27: v1.8 candidate · 28–36: F-Elimination candidate (36 = Config Policy) · 37–41: Waves 1–5 candidate.
- **خطة البناء جاهزة:** `10-AGENT-BUILD-PLAN.md` يسقط Gates A–E و Build Order على task packets.
- **لا يوجد بعد:** كود · repo skeleton · migrations · Docker · أي تحويل `candidate_*` إلى implemented.

---

## 3. المعمارية التقنية المحسومة (مرجع سريع)
| الطبقة | القرار |
|---|---|
| Hot path | Rust · Dashboard: TypeScript |
| Data streams | Helius LaserStream gRPC + Triton/Yellowstone |
| Routing | Jupiter Swap API v2 (مفتاح إلزامي) |
| Execution | Helius Sender + Jito · Tip: bundles.jito.wtf |
| Storage | PostgreSQL + ClickHouse + Redis + RAM HashSet |
| Event bus (Phase 1) | Redis Streams (NATS بديل عند الحاجة) |
| Dev/Runtime | WSL2 + Docker Compose · لا Kubernetes الآن |

**Build Order الإلزامي (من `CLAUDE.md` و `06-BUILD-SPEC §4`):**
`CostPipeline → CalibrationStore → RPCHealthMonitor → ProtocolConstantMonitor → SignerService/KeyManager → PositionLifecycleStateMachine → IntentLedger`.

**Dependency graph (`06-BUILD-SPEC §4`):**
`Foundations → Data layer → {SignerService, Risk Gates} → Execution Adapter (paper) → Stream Ingestion → Decision Engine → Management API → Dashboard`. Analytics فرع مستقلّ يقرأ Data layer.

---

## 4. تعارضات المسارات والملفات (يجب حسمها قبل Gate A)

### 4.1 [حرج] تعارض مسار `docs/`
- **الواقع:** كل الوثائق (`00`–`12` + `CLAUDE.md` + `README.md`) موجودة في **جذر المجلد** `C:\Users\assaf\Desktop\soltrade\` مباشرةً — **لا يوجد مجلد `docs/`**.
- **التعارض:** الملفات التالية تشير إلى الوثائق بمسار `docs/...`:
  - `CLAUDE.md` — قسم *Documents* و*ترتيب القراءة* (مثل `docs/00-ARCHITECTURE.md`)، و**سطر الاستيراد `@docs/01-SSOT.md`** في نهاية الملف.
  - `README.md` — يشير ضمنياً إلى نفس التراتبية.
  - `10-AGENT-BUILD-PLAN.md §3` — *Source Documents Reading Order* يسرد `docs/00-...` حتى `docs/10-...`.
- **الأثر:** أي وكيل بناء يتبع ترتيب القراءة، أو أي أداة تتبع `@docs/01-SSOT.md`، **سيفشل في إيجاد الملفات**. هذا خطر اتّساق حوكمي مباشر (SSOT لا يُحمَّل).
- **الخيارات (قرار حوكمي مطلوب — لا يُطبَّق الآن):**
  - (أ) **نقل** الوثائق `00`–`12` إلى مجلد `docs/` (يبقي `CLAUDE.md`/`README.md` في الجذر) — يطابق النصّ القائم بأقلّ تعديل نصّي.
  - (ب) **تصحيح المسارات** في `CLAUDE.md` + `README.md` + `10-AGENT-BUILD-PLAN.md` لتشير إلى الجذر (إزالة بادئة `docs/`).
  - **التوصية:** الخيار (أ) أنظف لأنه يحافظ على النصّ المعتمد كما هو ويجعل البنية مطابقة للوثائق؛ لكنه قرار ملكية يخصّ `00-ARCHITECTURE`/الحوكمة. **لا تنفيذ قبل الموافقة.**

### 4.2 لا يوجد git repository
- البيئة الحالية **ليست** مستودع git.
- خطة Gate A (repo layout · CI · contracts typed) تفترض مستودعاً. سيُحتاج `git init` كأوّل خطوة **داخل** Gate A — وهو إجراء تنفيذي يُؤجَّل حتى الموافقة على بدء الكود.

### 4.3 مجلد الذاكرة
- `…/memory/` الخاص بالجلسة غير موجود بعد؛ سيُنشأ تلقائياً عند أوّل حفظ ذاكرة. لا أثر على الحوكمة.

---

## 5. الثوابت غير القابلة للتفاوض (تُفحَص في كل خطوة لاحقة)
- **No name before SSOT** — أي اسم user/API/runtime/config غير مسجّل ⇒ توقّف وارفع `ARCH → SSOT`.
- **candidate يبقى candidate** — skeleton ≠ promotion · لا حذف بادئة `candidate_` · لا نقل إلى implemented دون قرار صريح.
- **Fail Safe Not Fail Open** — عند الشكّ: توقّف أو `EXITS_ONLY`.
- لا تجاوز `order → sign → send` · SignerService معزول · **لا توقيع/إرسال حيّ قبل Gate E**.
- لا أسرار في logs/exports/backups/diagnostics · provider عبر `candidate_provider_key_ref` فقط.
- لا أوامر فرص (`buy_opportunity`/`execute_opportunity`/`submit_opportunity`) · لا أمر خروج ذرّي · لا P&L محلي كمصدر حقيقة · لا P&L على Opportunity/Radar.

---

## 6. الخلاصة والتوصية
المعمارية والقدرات **مكتملة توثيقياً** (v1.8 + F-Elimination + Waves 1–5)، والمشروع جاهز معرفياً لبدء Gate A. **قبل** بدء أي كود يجب حسم بند **§4.1 (تعارض مسار `docs/`)** حوكمياً لأنه يكسر تحميل SSOT. خطة Gate A التفصيلية والمراحل و PRs المقترحة في `GATE-A-PLAN.md` — **مقترحة فقط، بلا تطبيق، بانتظار الموافقة.**
