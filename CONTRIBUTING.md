# CONTRIBUTING — Development & Branch/PR Policy (Internal)

> دليل تطويري داخلي. **ليس** وثيقة حوكمة سلطوية ولا يضيف أي اسم خارج `docs/01-SSOT.md`. عند أي تعارض مع `CLAUDE.md` أو `docs/00`–`12` تُغلَّب الوثيقة المعتمدة.

## 1. الحالة الحالية
- المشروع في مرحلة **DOCUMENTATION-ONLY** عدا رفع محدود جداً لغرض **Gate A فقط** (Foundations / non-trading baseline).
- **ممنوع الآن:** أي تداول · signing/sending · Docker تشغيلي · migrations فعلية · config تنفيذي · secrets/مفاتيح · تحويل أي `candidate_*` إلى implemented · أي اسم خارج SSOT.

## 2. بنية المستودع
```
CLAUDE.md, README.md        # في الجذر (تُقرأ أولاً)
docs/00..12-*.md            # الوثائق المعتمدة (SSOT في docs/01-SSOT.md)
IMPLEMENTATION-MEMO.md      # مذكرة التنفيذ (planning)
GATE-A-PLAN.md              # خطة Gate A (planning)
services/                   # Rust — hot path & enforcement (skeleton)
apps/                       # TypeScript — dashboard, management-api (skeleton)
packages/                   # ssot-types, contracts, test-fixtures (skeleton)
migrations/                 # postgres, clickhouse (skeleton فارغ — لا migrations بعد)
infra/docker/               # skeleton فارغ — لا Docker بعد
```
> مجلّدات الخدمات **أسماء تنظيمية فقط** (ليست أسماء SSOT). المجلّدات الحالية placeholders فارغة (`.gitkeep`).

## 3. ترتيب القراءة (إلزامي قبل أي تعديل)
`CLAUDE.md → README.md → docs/00-ARCHITECTURE → docs/01-SSOT → docs/02-CONFIG → docs/03-API → docs/05-DATA → docs/04-UX → docs/07-TEST → docs/08-RUNBOOK → docs/09-SECURITY → docs/06-BUILD → docs/10-AGENT-BUILD-PLAN → docs/11-UI-SPEC → docs/12-DESIGN-SYSTEM`.
**SSOT قبل استخدام أي اسم.**

## 4. سياسة الفروع
- `main` — الأساس المعتمد (baseline). لا commit مباشر لعمل PR.
- فرع لكل PR من خطة البناء: `pr-a0-bootstrap`, `pr-a1-...`, `pr-a2-...` (نمط: `pr-<gate><n>-<slug>`).
- لا يُدمج فرع PR إلا باجتياز بوّابة القبول الخاصة به (`GATE-A-PLAN.md §5` لـ Gate A).

## 5. سياسة الـ PR (بسيطة)
كل PR يحمل وصفاً بشكل task packet (`docs/10-AGENT-BUILD-PLAN.md §8`):
```
TASK · GATE · GOAL · SOURCE DOCS · SSOT NAMES USED · FILES TO TOUCH
FORBIDDEN CHANGES · IMPLEMENTATION STEPS · TESTS · DONE CRITERIA
```
ويرفق عند الإغلاق: diff summary · tests run · docs impact · **No-SSOT-drift check: PASS/FAIL** · open questions.

## 6. حُرّاس غير قابلة للتفاوض (تُفحَص في كل PR)
- **No name before SSOT** — اسم user/API/runtime/config غير مسجّل ⇒ توقّف وارفع `ARCH → SSOT`.
- **candidate يبقى candidate** — لا حذف بادئة `candidate_` · skeleton ≠ promotion.
- **Fail Safe Not Fail Open** · لا تجاوز `order → sign → send` · SignerService معزول.
- لا أسرار في logs/exports/backups · provider عبر `candidate_provider_key_ref` فقط.
- لا أوامر فرص · لا أمر خروج ذرّي · لا P&L محلي كمصدر حقيقة.

## 7. ترتيب البناء (مرجع)
Gates: `A Foundations → B Paper → C Wallet Admission → D Multi-wallet → E REAL-LIVE`.
Build Order: `CostPipeline → CalibrationStore → RPCHealthMonitor → ProtocolConstantMonitor → SignerService/KeyManager → PositionLifecycleStateMachine → IntentLedger`.
