# EXISTING_STATE_REPORT — Solana Smart-Money Copy-Trading Engine

> **تقرير الحالة القائمة** — خريطة كاملة لما هو موجود فعلاً في التطبيق، مبنية بقراءة كل وحدة وصفحة وخدمة وإعداد وتقرير في المستودع، وبتشغيل أوامر تحقّق حقيقية. أُنتِج **قبل أي إصلاح** في جولة بوّابة الجاهزية (`release-gate/local-live/2026-06-11`)، ويُحدَّث في نهاية الجولة لمقارنة قبل/بعد.
>
> **ليس هذا التقرير من وثائق SSOT المحفوظة (`docs/00`–`12`).** تلك لا تُعدَّل. هذا ملف جديد للحوكمة التشغيلية فقط.

**Mode:** `local-live` · **Flag:** `--fix` (الافتراضي) · **Branch:** `release-gate/local-live/2026-06-11` (مفرّع من `main` @ `59801c7`) · **Date:** 2026-06-11

---

## 0. الخلاصة بلغة المالك (عربي أولاً)

التطبيق **مكتمل بنيوياً** ومُتحقَّق منه: المحرّك كله (الاكتشاف → الترتيب → المخاطر → النيّة → المسار → مراجعة التوقيع → مراجعة الإرسال → أثر القرار) مبنيّ كسلسلة وحدات **نقيّة، fail-closed، بلا أي صلاحية تنفيذ**. كل الاختبارات تمرّ (**1854/1854**)، والحارسان (SSOT drift · mechanism guard) أخضران.

**المهم لمالك غير مبرمج:** لا يوجد في الكود أي عيب يمنع التشغيل المحلي الآمن. ما يمنع التداول الحقيقي ليس عيباً برمجياً، بل **مدخلات لا يملكها إلا أنت** (مفاتيح المزوّدين بالمرجع، محفظة مموَّلة، إعداد الموقّع، قرار حوكمة منفصل لمحوّل الإرسال). لذلك الحُكم النهائي هو **`OPERATOR_INPUT_REQUIRED`** — جاهز بنيوياً، بانتظار مدخلاتك، **وليس** عيباً يحتاج برمجة.

**القاعدة الثابتة:** تفعيل المال الحقيقي مفتاحٌ بيدك أنت — النظام مبنيّ حتى الوصول إليه ولا يُلقيه تلقائياً أبداً.

---

## 1. منهجية بناء هذا التقرير (دليل منفَّذ)

| فحص | الأمر المنفَّذ | النتيجة |
|---|---|---|
| السلسلة الزمنية النظيفة | `git status --porcelain` | نظيف (لا تغييرات) |
| الرأس = origin | `git rev-parse HEAD` / `origin/main` | كلاهما `59801c7` |
| المزوّد البعيد | `git remote -v` | `origin https://github.com/Assaf750/solana-trading-bot.git` |
| انحراف SSOT | `node tools/check-ssot-drift.mjs` | **PASS** — `core=31 api=6 config=63 data=152 mig=4 candidate(ssot=113, included=30, deferred=83) cmd=13 forbidden=30` |
| حارس الآليات | `node tools/check-mechanism-guards.mjs` | **PASS** — `sources=119 fixtures=27 allowlist=1 violations=0` |
| مجموعة الاختبارات | `node --test` | **1854 pass · 0 fail · 0 skip** (≈1.27s) |
| بناء واجهة المشغّل | `cd apps/operator-ui && npm run build` | **✓ built in 457ms** · dist ≈ 230 kB js (72.5 kB gzip) |
| شبكة داخل الواجهة | `grep -rnE "fetch\(|new WebSocket|XMLHttpRequest|axios|EventSource" src` | **NONE** |
| مسارات تنفيذ ممنوعة | `grep -rnE "buy_opportunity|execute_opportunity|submit_opportunity" src` | **NONE** (تظهر فقط كقوائم منع داخل الحرّاس الدفاعية في `packages/*/src`) |
| `can_send:true` | `grep -rn "can_send" … | grep true` | **NONE** على مستوى المستودع |

---

## 2. هيكل المستودع (ما يوجد فعلاً)

```
soltrade/
├── docs/                 13 وثيقة SSOT (00–12) — مرجع محوكم، READ-ONLY (+ هذا التقرير + الدليل + المقترحات)
├── packages/             53 حزمة foundation نقيّة (ESM .mjs + .d.ts + node --test)
├── apps/
│   ├── dashboard/        shell تشخيصي read-only (Gate A) — دالة render نقيّة، بلا أزرار تداول
│   ├── management-api/   API إدارة read-only (GET فقط) — استماع محلي inbound فقط، بلا اتصال صادر
│   └── operator-ui/      واجهة Vite+React 9 صفحات — read-only فوق fixtures محاكاة، قابلة للنقر
├── tools/                حارس انحراف SSOT + حارس الآليات + fixtures (READ-ONLY حوكمياً)
├── reports/              أدلّة المراحل (E2-STAGE-* · E2-PHASE-*-GATE-* · FINAL-DELIVERY · OPERATOR-UI)
└── CLAUDE.md, README.md, BUILD-STATUS-AND-ROADMAP.md
```

- **مدير الحزم:** npm workspaces (`packages/*`). واجهة المشغّل **ليست** عضو workspace (تثبيت node_modules محلي خاص بها).
- **اللغات/الأطر:** Hot path مُصمَّم لـ Rust (`services/` غير مُنشأة بعد — Gate A لم يطلبها) · الوحدات الحالية كلها **JavaScript ESM** نقيّة بلا تبعيات runtime · الواجهة **React + Vite v5** · الاختبار **node:test** المدمج.
- **التبعيات:** الحزم بصفر تبعيات runtime؛ الواجهة وحدها تستهلك React/Vite محلياً.

---

## 3. جدول الحالة لكل وحدة/قدرة

> الحالات: `working` · `exists-but-broken` · `exists-but-disconnected` · `mock-only` · `missing` · `forbidden`.
> «مُتحقَّق (دليل منفَّذ)؟» = هل تمرّ اختباراته في تشغيل هذه الجولة فعلاً.

### 3.1 خطّ مراجعة القرار (Stages 4–13)

| القدرة/الوحدة | في SSOT؟ | الكود موجود؟ | موصول E2E؟ | مُختبَر؟ | يعمل (دليل منفَّذ)؟ | الحالة |
|---|---|---|---|---|---|---|
| RPC Provider Foundations | نعم (G5/G24) | نعم | نعم | 257 | ✓ ضمن 1854 | working |
| Data Ingestion Foundation | نعم (G16) | نعم | نعم | 72 | ✓ | working |
| Wallet/Token Intelligence | نعم (G18/G30) | نعم | نعم | 63 | ✓ | working |
| Signal Engine Foundation | نعم (G3/G16) | نعم | نعم | 88 | ✓ | working |
| Risk Engine Foundation | نعم (G6/G7) | نعم | نعم | 70 | ✓ | working |
| Intent Ledger Foundation | نعم (G3) | نعم | نعم | 75 | ✓ | working |
| Route/Execution-Planning | نعم (G4) | نعم | نعم | 72 | ✓ | working |
| Transaction-Build-Review | نعم (G23) | نعم | نعم | 75 | ✓ | working |
| Signing-Review Foundation | نعم (G15) | نعم | نعم | 76 | ✓ | working |
| Send/Broadcast-Review | نعم (G3/G12) | نعم | نعم | 76 | ✓ | working |
| End-to-End Decision Trace | نعم (G23) | نعم | نعم | 34 | ✓ | working |

### 3.2 قياس الربحية (Stages 14–16، محاكى)

| القدرة | في SSOT؟ | الكود؟ | موصول؟ | مُختبَر؟ | يعمل؟ | الحالة |
|---|---|---|---|---|---|---|
| Paper Execution + FIFO P&L read-model | نعم (G22/G37) | نعم | نعم | 29 | ✓ | working (simulated) |
| Calibration & Backtest (point-in-time, survivorship-free, TOCTOU-proof) | نعم (G37 W1-08) | نعم | نعم | 28 | ✓ | working (simulated) |
| Strategy/Wallet Profitability Intelligence (copyability advisory, veto) | نعم (G18/G26/G37/G38) | نعم | نعم | 29 | ✓ | working (advisory) |

### 3.3 بيانات حيّة + واجهة (Stages 17–18، read-only)

| القدرة | في SSOT؟ | الكود؟ | موصول؟ | مُختبَر؟ | يعمل؟ | الحالة |
|---|---|---|---|---|---|---|
| Live-Stream Boundary (disabled-by-default, gap→EXITS_ONLY-shaped) | نعم (G5/G13) | نعم | حدّ منطقي read-only | 60 | ✓ | working (read-only, لا اتصال) |
| Operator Dashboard render (XSS-safe HTML نقيّ) | نعم (G35/UX) | نعم | نعم | 40 | ✓ | working (render نقيّ) |
| `apps/operator-ui` (9 صفحات قابلة للنقر) | UX/UI spec | نعم | فوق fixtures محاكاة | بناء ✓ | ✓ build 457ms | working (simulated, read-only) |
| `apps/dashboard` (shell تشخيصي) | UX spec | نعم | render نقيّ | (Gate A) | — | exists (read-only shell) |
| `apps/management-api` (GET-only، inbound محلي) | API §4/§8/§13 | نعم | router نقيّ | (Gate A) | — | exists (read-only, لا outbound) |

### 3.4 التوقيع/الإرسال/التفعيل (Stages 19–23، fail-closed حتى مفتاح المالك)

| القدرة | في SSOT؟ | الكود؟ | موصول؟ | مُختبَر؟ | يعمل؟ | الحالة |
|---|---|---|---|---|---|---|
| Isolated Signer Runtime (WebCrypto Ed25519 **SIGN-ONLY**، مفاتيح لكل نداء غير قابلة للاستخراج، audit fail-closed) | نعم (G15) | نعم | الإدخال الوحيد في ALLOWLIST | (ضمن 1854) | ✓ | working (sign-only، بلا send) |
| Custody / Execution-Wallet Lifecycle (آلات حالة fail-closed، `signer_control`-gated، keyless) | نعم (G15) | نعم | نعم | (+6 hardening) | ✓ | working (keyless) |
| `send-gate-contract` (يرفض على كل مسار) | نعم | نعم | نعم | ✓ | ✓ يرفض دائماً | working-as-refusal |
| Testnet-Send Boundary | نعم | نعم | **never-ready seam** | 24 | ✓ لا يُفعَّل أبداً | forbidden-until-owner (متعمَّد) |
| Mainnet Activation Seam | نعم | نعم | **never-ready seam** (`met:false` مثبَّت) | 20 | ✓ لا يُفعَّل أبداً | forbidden-until-owner (متعمَّد) |
| REAL-LIVE Readiness + Hard-Risk wiring (لا لانهائية ضمنية: 9 حدود مطلوبة منتهية) | نعم (G6/G10) | نعم | نعم | (verify) | ✓ | working |

### 3.5 مسارات ممنوعة دائماً (يجب أن تبقى مغلقة)

| المسار | الحالة | الدليل |
|---|---|---|
| `buy_opportunity` / `execute_opportunity` / `submit_opportunity` | `forbidden` (مغلق) | تظهر **فقط** داخل قوائم منع/allowlist دفاعية في `packages/*/src`؛ لا أمر مُصدَر، ولا تدفّق بيانات من Radar/Opportunity إلى أي دالة تنفيذ/توقيع |
| أي تدفّق Radar/Opportunity → تنفيذ | `forbidden` (مغلق) | `resource_type=opportunity` read-only؛ لا `command_type` للفرص |
| أمر خروج ذرّي (`exit_all_positions`) | `forbidden` (مغلق) | البديل preview→request per-position فقط |
| كشف/طبع أي سرّ (seed/مفتاح/توكن) | لا وجود | لا PEM/base58 طويل/mnemonic في المصدر؛ المفاتيح بالمرجع `provider_key_ref` فقط |

---

## 4. الفجوات — كلها مدخلات مالك، لا عيوب كود

لا توجد فجوة من نوع «كود ناقص/معطوب/وهمي في مسار إنتاج». الفجوات الوحيدة **خارجية يملكها المالك** (انظر §4 في `reports/E2-FINAL-DELIVERY-REPORT.md` للقائمة الكاملة المرتّبة testnet ثم mainnet): مفاتيح المزوّدين بالمرجع · نقاط نهاية RPC/stream بمرجع opaque · محافظ مموَّلة خارج المستودع · مجموعة Hard-Risk المنتهية الكاملة (9 حقول) · `capital_limit` منتهٍ > 0 · قرار حوكمة ALLOWLIST منفصل ومُراجَع لمحوّل الإرسال (testnet ثم mainnet منفصلان) · قرار المالك الفيزيائي للتفعيل · إطفاء kill switch صراحةً.

---

## 5. قبل/بعد — مُحدَّث بعد بناء طبقة التطبيق الكاملة (M1–M4)

> **تغيّر جوهري بأمر المالك الصريح (2026-06-11):** «أريد أن يعمل البرنامج لا أريده للقراءة فقط». بُنيت طبقة التطبيق الحقيقية فوق الأساس المُتحقَّق — البرنامج الآن **يعمل فعلاً**.

- **قبل:** أساس مكتمل لكنه read-only (1854/1854) — واجهة عرض فوق fixtures، بلا خادم، بلا تنفيذ.
- **بعد (المُنجَز والمُتحقَّق بأوامر منفَّذة):**
  | Milestone | المحتوى | commit |
  |---|---|---|
  | M1 | `apps/server`: خزنة مشفّرة (scrypt+AES-256-GCM) · إعدادات بفحص · سجل محافظ · kill switch هرمي محفوظ · حالات تشغيل · جلسات موقّع محدودة · أمر API + SSE · `START.bat` | `7eee500` |
  | M2 | الواجهة موصولة بالخادم: حفظ حقيقي للإعدادات/الحدود · إدخال مفاتيح مقنّعة · تسجيل/متابعة محافظ · kill switch يعمل · حالة حية | `78976f2` |
  | M3 | محرك ورقي ببيانات حية: بث mainnet WS · كشف صفقات القادة · بوّابات مخاطر fail-safe · جدوى خروج قبل الدخول · أسعار Jupiter · TP/SL · **مُتحقَّق على mainnet** (شراء حقيقي رُصد ورُفض fail-safe + عرض ذهاب-إياب $10→$10.002) | `dd9ebcb` |
  | M4 | مسار REAL-LIVE الحقيقي: توقيع Ed25519 (يرفض fee-payer غريب) · سجل نوايا (منع تكرار on-chain) · audit-قبل-التوقيع fail-closed · فحص رصيد قبل الإرسال · تأكيد + قراءة التعبئة من السلسلة · بوّابة `activate_real_live` حقيقية (قائمة حواجز صادقة + تأكيد مكتوب) · إلغاء التفعيل متاح دائماً | `0121629` |
- **E2E المُنفَّذ في هذه الجولة:** تفعيل بلا إعداد → 6 حواجز صادقة · إكمال كل المدخلات → صفر حواجز · بلا تأكيد مكتوب → رفض · بالتأكيد → `real_live` + `armed_real_money` · kill switch → KILLED + قفل الموقّع فوراً · فك + إلغاء → عودة للورقي.
- **التحقّق النهائي:** المجموعة **1893/1893** (1854 أساس + 39 خادم/محرك/منفّذ) · SSOT drift EXACT · mechanism guard `sources=119 allowlist=1 violations=0` · بناء الواجهة ✓.
- **غير مُمَسّ:** `packages/` · `docs/00`–`12` · `tools/` · ALLOWLIST (إدخال واحد) · لا أسرار في git (`data/` خارج git).
- **الحُكم:** `OPERATOR_INPUT_REQUIRED` — البرنامج كامل ويعمل؛ التداول الحقيقي يحتاج فقط مدخلاتك (مفاتيح، محفظة ممولة، حدود، تفعيلك الصريح) — وكلها شاشات جاهزة في الواجهة.
