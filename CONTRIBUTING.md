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
استخدم `PULL_REQUEST_TEMPLATE.md` في الجذر (يفرض: Goal · Scope · SSOT names · No-SSOT-drift · Candidate guard · Secrets check · Tests/checks · Docs impact · No trading authority introduced). كل PR يحمل وصفاً بشكل task packet (`docs/10-AGENT-BUILD-PLAN.md §8`):
```
TASK · GATE · GOAL · SOURCE DOCS · SSOT NAMES USED · FILES TO TOUCH
FORBIDDEN CHANGES · IMPLEMENTATION STEPS · TESTS · DONE CRITERIA
```
ويرفق عند الإغلاق: diff summary · tests run · docs impact · **No-SSOT-drift check: PASS/FAIL** · open questions.

## 5.1 CI / Hardening Guards
`.github/workflows/ci.yml` يشغّل الحُرّاس آلياً على كل push/PR (بلا تبعيات/شبكة): `node tools/check-ssot-drift.mjs` ثم `node tools/check-mechanism-guards.mjs` ثم `node --test`. محلياً: `npm run check:all` (= drift guard + mechanism guard + tests) أو `npm run check:ssot-drift` / `npm run check:mechanism-guards` / `npm test`.

**Mechanism guard (`tools/check-mechanism-guards.mjs`, PR-H2):** حارس مركزي code-only يمنع آليات Gate-D/Gate-E الحيّة قبل وقتها في `packages/*/src/*.mjs`: live asset/token transfer · transaction build/serialize/sign/send · RPC/provider live calls · Solana/Jupiter/Helius/Jito imports/endpoints · KeyManager · key material (private key/seed/keypair/mnemonic) · REAL-LIVE activation calls. يتجاهل التعليقات و(لآليات الكود) السلاسل النصّية لتفادي false positives في نصوص المنع وأسماء SSOT المحوكمة وقوائم الرفض؛ يفحص الـ imports عبر محدّدات import/require فقط؛ يفحص الـ fixtures عن أسرار/مفاتيح. لا يغيّر أي منطق runtime.

**Carve-out allowlist (PR-H3):** `ALLOWLIST` في الحارس **مغلق افتراضياً (فارغ)** — لا مسار مُعفى، والسلوك مطابق تماماً للسابق (fail-closed في كل مكان). نموذج الـ carve-out موجود ومُختبَر فقط ليستعمله Gate E لاحقاً بمسار **isolated signer/execution واحد صريح** (`packages/<isolated-signer>/src/`) **مع اختبارات عزل خاصّة به**. المسار المُعفى يُسمح فيه بآليات التنفيذ الحيّة **فقط**، أمّا **مادة المفاتيح في الشيفرة فتبقى ممنوعة حتى داخله** (`allowlisted_but_key_material:*`) — المفاتيح تأتي من KMS/secret vault وقت التشغيل لا من المستودع. لا wildcard ولا bypass عام؛ المطابقة بحدود مقطع المسار فقط. **لا يُفتح أي package موجود، ولا يُغيَّر أي منطق runtime.**

**Declared allowlist path (PR-H4):** `DECLARED_ALLOWLIST_PATHS = ['packages/isolated-signer-runtime/src/']` هو **إعلان مسار فقط، لا تفعيل**. المسار **غير موجود** (لا package ولا placeholder) و**ليس** مضافاً إلى `ALLOWLIST` — `ALLOWLIST` يبقى `[]` والحارس fail-closed في كل مكان. الإعلان **لا يفعّل KMS ولا signing ولا crypto ولا أي live mechanism**، ولا يُعفي أي شيء اليوم. **التفعيل** = نقل هذا المسار إلى `ALLOWLIST` في PR لاحق منفصل (قبل وجود custody/signing حقيقي هناك) مع اختبارات عزل إيجابية. حتى بعد التفعيل، **مادة المفاتيح في الشيفرة تبقى ممنوعة داخل المسار** (`allowlisted_but_key_material:*`).

## 6. حُرّاس غير قابلة للتفاوض (تُفحَص في كل PR)
- **No name before SSOT** — اسم user/API/runtime/config غير مسجّل ⇒ توقّف وارفع `ARCH → SSOT`.
- **candidate يبقى candidate** — لا حذف بادئة `candidate_` · skeleton ≠ promotion.
- **Fail Safe Not Fail Open** · لا تجاوز `order → sign → send` · SignerService معزول.
- لا أسرار في logs/exports/backups · provider عبر `candidate_provider_key_ref` فقط.
- لا أوامر فرص · لا أمر خروج ذرّي · لا P&L محلي كمصدر حقيقة.

## 7. ترتيب البناء (مرجع)
Gates: `A Foundations → B Paper → C Wallet Admission → D Multi-wallet → E REAL-LIVE`.
Build Order: `CostPipeline → CalibrationStore → RPCHealthMonitor → ProtocolConstantMonitor → SignerService/KeyManager → PositionLifecycleStateMachine → IntentLedger`.
