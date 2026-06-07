# 10-AGENT-BUILD-PLAN.md — خطة بناء الوكيل (Agent Build Plan)

> **الحالة:** مسودة للمراجعة — وثيقة تنفيذ غير سلطوية. تُقرأ بعد الوثائق المعتمدة 00–09.
> **النوع:** Implementation / Agent Build Plan. **ليست** Architecture ولا SSOT ولا API ولا UX ولا Security model ولا Runbook بديل.
> **القاعدة الحاكمة:** هذه الوثيقة **تترجم وتنفّذ** ما أقرّته الوثائق المرقّمة؛ لا تضيف أي `field`/`enum`/`state`/`event`/`command_type`/`resource_type`/`api_error_code`/threshold/اسم جديد. كل اسم تقني مذكور هنا **قائم بالفعل في SSOT**.

---

## 0. مدخل

محرّك تداول كمّي خاص على Solana (صيد عملات جديدة + نسخ wallet-led). هذه الوثيقة تحوّل المعمارية والقدرات المكتملة (v1.8 + F-Elimination + Waves 1–5) إلى **خطة تنفيذ قابلة للتشغيل بواسطة Claude Code / AI coding agent**، بمسار واحد واضح من skeleton إلى paper end-to-end ثم real-live readiness.

الوثيقة لا تعرّف نطاقًا جديدًا للمنتج. النطاق محسوم في `00-ARCHITECTURE` و`06-BUILD-SPEC`. ما تضيفه هنا هو **ترتيب التنفيذ، شكل المهمّة، بوابات القبول، الممنوعات، والتسليمات** — لا أكثر.

---

## 1. Purpose & Non-Authority

**الغرض:** إعطاء الوكيل خطة تنفيذ منضبطة تُسقِط Build Gates A–E و Build Order على task packets قابلة للبناء والتحقّق، مع الحفاظ التامّ على حدود الحوكمة.

**حدود السلطة (Non-Authority):**
- لا تملك هذه الوثيقة أي اسم رسمي. مصدر الأسماء الوحيد هو `01-SSOT.md`.
- عند أي تعارض بين هذه الوثيقة وأي من 00–09، **تُغلَّب الوثيقة المعتمدة** ويُصحَّح هذا الملف.
- لا تنشئ هذه الوثيقة gates ولا milestones ولا تسلسلًا جديدًا. كل تسلسل هنا **إسقاط حرفي** من `06-BUILD-SPEC §4/§6/§8.1` و Build Order في `CLAUDE.md`.
- ترتيب الملكية يبقى: ARCHITECTURE يملك القرار · SSOT يملك الأسماء والقيم · Config يملك default/validation/mutability · API/UX/Data تستهلك.

---

## 2. Agent Operating Rules

كيف يقرأ الوكيل وينفّذ، ومتى يتوقّف:

1. **اقرأ قبل أن تكتب.** قبل لمس أي ملف، اقرأ الوثيقة ذات الصلة. لا تفترض حقلًا غير موجود في SSOT.
2. **No name before SSOT.** ظهرت حاجة لاسم غير موجود؟ **توقّف** ولا تخترعه — ارفع سؤال حوكمة (ARCH → SSOT) وعلّق المهمّة.
3. **توقّف عند الغموض المعماري** بدل الاختراع.
4. **Fail Safe Not Fail Open.** عند الشكّ في مسار التنفيذ: `EXITS_ONLY` أو توقّف، لا استمرار بالشراء.
5. **لا تتجاوز الحُرّاس.** كل order intent يمرّ عبر Risk Gates قبل Execution Adapter / SignerService. لا خدمة تستدعي SignerService دون موافقة المخاطر.
6. **ملف واحد لكل جولة توثيق** إلا بإذن صريح؛ ونظّف التعارضات داخل الملف بدل مجرّد الإضافة (ينطبق على تعديلات الوثائق، لا على بناء الكود).
7. **candidate يبقى candidate.** بناء skeleton حول اسم `candidate_*` لا يحوّله إلى implemented (انظر §14).
8. **لا تعتمد على summary فقط؛ افحص محتوى الملف الفعلي.**

---

## 3. Source Documents Reading Order

ترتيب القراءة الإلزامي (مطابق لـ `CLAUDE.md`)، SSOT قبل أي استخدام لأي اسم:

1. `CLAUDE.md`
2. `README.md`
3. `docs/00-ARCHITECTURE.md`
4. `docs/01-SSOT.md`
5. `docs/02-CONFIG-AND-POLICY-SCHEMA.md`
6. `docs/03-API-CONTRACT.md`
7. `docs/05-DATA-MODEL.md`
8. `docs/04-UX-PRODUCT-SPEC.md`
9. `docs/07-TEST-PLAN.md`
10. `docs/08-RUNBOOK-OPS.md`
11. `docs/09-THREAT-SECURITY.md`
12. `docs/06-BUILD-SPEC.md`
13. `docs/10-AGENT-BUILD-PLAN.md` (هذا الملف — تنفيذي فقط)

كل task packet يجب أن يذكر **source docs** التي يشتقّ منها (انظر §8).

---

## 4. Build Philosophy

- **Safety-first:** الحُرّاس (Risk Gates · SignerService boundary · Audit · config validation · admission) تُبنى قبل أي تنفيذ حيّ. الترتيب ليس تفضيلًا بل شرط سلامة.
- **Paper-before-real:** paper end-to-end كامل بكل الحُرّاس قبل أي محفظة تنفيذ، و REAL-LIVE بعد اكتمال signer/risk/audit/validation/admission.
- **Integrated build, not MVP phasing:** المعمارية والقدرات مكتملة. Gates A–E هي **safety activation gates** لا مراحل نطاق. لا «MVP later» ولا «future F» ولا «pending capability».
- **UI-first enough, no CLI dependency for the user:** المستخدم النهائي يشغّل كل شيء عبر الواجهة. CLI للمطوّر/الـ local-ops فقط (انظر §11).
- **Single Provider First, Multi Provider Ready:** يبدأ التطبيق بمزوّد واحد رسميًا (انظر §5)، والتصميم قابل للتوسعة دون تغيير حوكمي.

---

## 5. Single Provider First, Multi Provider Ready

> قاعدة تنفيذ تستهلك أسماء SSOT القائمة فقط. **لا اسم/state/error/config جديد لهذه النقطة.**

**المبدأ:** التطبيق يبدأ ويعمل End-to-End بمزوّد واحد بوصفه **وضع تشغيل رسمي مدعوم** (`candidate_provider_mode = single`)، وليس حالة ناقصة أو degraded-by-default. README §36 و `06-BUILD-SPEC §8.1` (Foundations & Governance Cluster) يضعان single/multi mode في العنقود الأول.

### 5.1 وضع single
- `candidate_provider_mode = single` مسار مدعوم بقيود (SSOT G40: «single مدعوم بقيود؛ فشله → EXITS_ONLY»).
- **single mode لا يعتمد على peer comparison** لأنها غير متاحة بلا أقران.
- صحة المزوّد الواحد تُقاس بإشارات **مطلقة** بأسماء قائمة:
  - connection / heartbeat
  - `slot_lag`
  - `last_confirmed_slot` / `last_seen_slot` freshness
  - cursor progress (`stream_cursors` / `provider_stream_state`)
  - route/quote availability حيث ينطبق (Jupiter)
  - provider-specific latency/rate observations
- ملاحظة دقّة: `provider_degraded` (SSOT G1) معرّف **نسبيًّا مقابل الأقران**؛ لذلك في single mode تُستخدَم الإشارات المطلقة أعلاه. لا يُعاد تعريف `provider_degraded` ولا يُضاف بديل.

### 5.2 سلوك الفشل (بدلالة `candidate_provider_role`)
- فشل مزوّد بدور `hot_path` (chain/RPC حرج) → انتقال تشغيلي إلى `EXITS_ONLY`، أو تصعيد أعلى (حتى `KILLED`) حسب الشدّة وسياسة `08-RUNBOOK-OPS §3/§5`.
- **فجوة opportunity / `enrichment` stream وحدها لا تُطلِق `EXITS_ONLY`** (مطابق `CLAUDE.md`: «فجوة opportunity stream وحدها لا تُطلِق EXITS_ONLY»).
- لا دخول جديد على حالة بائتة؛ يُعرض السبب بوضوح عبر مسارات UX/Ops القائمة.
- single-provider بلا مفتاح مُسجَّل → `candidate_err_provider_unconfigured` (اسم قائم، لا جديد).

### 5.3 جاهزية التوسعة إلى multi (enhancement path لاحق)
عند `candidate_provider_mode = multi` لاحقًا، تُفعَّل (بأسماء/أدوار قائمة، دون تغيير حوكمي):
- peer comparison و `provider_degraded` النسبي
- first-to-arrive dedup
- failover بين أدوار (`hot_path` / `backup`)
- provider-relative degradation

التصميم يجب أن يبقي حدود الواجهة (provider-adapters) محايدة للعدد، بحيث لا يفترض الكود مزوّدًا واحدًا في بنيته الداخلية رغم بدء التشغيل بواحد.

---

## 6. Repository Skeleton

يعكس انقسام اللغة وحدود الخدمات في `06-BUILD-SPEC`. (أسماء مجلّدات تنظيمية فقط — ليست أسماء SSOT.)

```
/services            # Rust — hot path & enforcement
  /stream-ingestion
  /decision-engine
  /risk-gates
  /execution-adapter
  /signer-service
  /exit-manager
  /provider-adapters            # حدود محايدة للعدد (single→multi ready)
  /cost-pipeline                # Build Order: CostPipeline
  /calibration-store            # Build Order: CalibrationStore
  /rpc-health-monitor           # Build Order: RPCHealthMonitor
  /protocol-constant-monitor    # Build Order: ProtocolConstantMonitor
  /position-lifecycle-state-machine  # Build Order: PositionLifecycleStateMachine
  /intent-ledger                # Build Order: IntentLedger

/apps                # TypeScript
  /dashboard
  /management-api               # TypeScript حسب 06-BUILD-SPEC §3 Service Boundary Map

/packages            # shared
  /ssot-types                   # types مولّدة/مشتقّة من SSOT القائم
  /contracts                    # عقود API/داخلية (تستهلك 03-API)
  /test-fixtures

/migrations
  /postgres
  /clickhouse

/infra
  /docker                       # compose: PostgreSQL · ClickHouse · Redis
```

> **حدّ Risk Gates:** `risk-gates` طبقة فرض في مسار التنفيذ، **لا sidecar اختياري**. `management-api` لا يوقّع ولا يبني أوامر on-chain ولا يتجاوز Risk Gates ولا يدخل hot path.

---

## 7. Build Gates A–E Implementation Plan

> إسقاط حرفي لـ `06-BUILD-SPEC §6` (Gates A–E) و dependency graph (§4): Foundations → Data → {SignerService, Risk Gates} → Execution Adapter (paper) → Stream Ingestion → Decision Engine → Management API → Dashboard؛ Analytics فرع مستقلّ يقرأ Data layer. **لا ترقيم milestone موازٍ.**

### Gate A — Foundations / Non-trading Baseline
البنية الأساسية بلا أي قدرة تداول.
- repo layout · `ssot-types` و`contracts` typed من SSOT القائم.
- config loading + validation + mutability حسب `02-CONFIG`.
- migrations (PostgreSQL/ClickHouse) skeleton + **audit write path**.
- health endpoints · `management-api` skeleton · dashboard shell.
- Foundations & Governance Cluster: provider onboarding boundary + single/multi mode skeleton (provider-adapters، `candidate_provider_key_ref` reference-only) · Execution Trace hooks · health/incident · audit/observability hooks.
- **داخليًّا بترتيب Build Order:** `cost-pipeline` → `calibration-store` → `rpc-health-monitor` → `protocol-constant-monitor` كوحدات foundations قبل ما يليها.

### Gate B — Paper Execution-Safe Baseline
- `signer-service` boundary (mock/skeleton — لا توقيع حيّ) → `risk-gates` (فرض Hard Risk، Group 6) **قبل** Execution Adapter.
- `execution-adapter` بوضع paper/test harness: **same order object · no sign · no send**.
- `stream-ingestion` (single-provider أولًا، §5) → `decision-engine` skeleton.
- persistence لـ positions/intents/audit · `position-lifecycle-state-machine` · `intent-ledger`.
- `exit-manager` ضمن المسار الورقي (batch exit preview→request per-position، بلا أمر ذرّي).
- Paper Portfolio (موسوم simulated) · realized + paper P&L read-model (backend/data، لا حساب في الواجهة).

### Gate C — Execution Wallet Admission Baseline
- `execution_wallets` · `signer_profiles` · admission gate.
- حالات المحفظة: `WARMING_UP` / `ACTIVE` / `DRAINING` / `REVOKED`.
- **محفظة تنفيذ واحدة قابلة للاستخدام أولًا** — مع بقاء data/API/UX داعمة للـ pool أصلًا.

### Gate D — Multi-wallet / Rotation / Sweep Enablement
- `wallet_assignment_policy` · `asset_transfer_intents` · `wallet_rotation_events` · `profit_sweep_events`.
- محافظ تنفيذ متعدّدة · تدفّقات rotation/sweep.

### Gate E — REAL-LIVE Readiness Gate
- `real_live_config_valid` · Hard Risk مكتمل · signer boundary مكتمل · audit مكتمل · admission مكتمل · operator readiness checklist.
- **قاعدة البوّابة:** لا REAL-LIVE ولا `isolated_signer` فعلي قبل اكتمال SignerService boundary + Risk Gates + Audit + config validation + execution_wallet admission gate.

> **Analytics / Reports / Charts / Recommendations / Sandbox:** فرع مستقلّ يقرأ Data layer (Clusters §8.1)، يُبنى بالتوازي بعد Gate A/B دون منح execution authority؛ REAL-LIVE لا يعلّق القدرات البحثية/التحليلية/الورقية/الشارتات.

---

## 8. Task Packet Format

كل مهمّة يسلّمها الوكيل تتبع هذا الشكل بالضبط:

```
TASK: <معرّف قصير>
GATE: <A | B | C | D | E | Analytics-branch>
GOAL: <هدف واحد قابل للقياس>
SOURCE DOCS: <الوثائق/الأقسام التي يشتقّ منها — إلزامي>
SSOT NAMES USED: <أسماء SSOT المستخدمة، أو `none — internal-only` إن لم توجد أسماء API-facing/runtime/config>
FILES TO TOUCH: <مسارات>
FORBIDDEN CHANGES: <ما لا يُلمَس — يرث §12>
IMPLEMENTATION STEPS: <خطوات>
TESTS: <unit | contract | integration | safety>
DONE CRITERIA: <شروط القبول، تربط بـ §9>
```

قاعدة التوقّف: غياب أسماء SSOT **لا يعني التوقّف** إذا كانت المهمّة داخلية بحتة ولا تُنتج `field`/API/`command`/`resource`/`event`/config — مثل Docker Compose · repo skeleton · CI · lint/format · test fixtures داخلية · modules داخلية لا تظهر في API/UX/Data. هذه يُسمح لها بـ `none — internal-only`. **التوقّف مطلوب فقط** عند ظهور اسم user-facing أو API-facing أو runtime/config غير مسجّل في SSOT ⇒ عندها أوقِف وارفع جولة حوكمة، لا تنفّذ.

---

## 9. Acceptance Gates

لا ينتقل البناء من Gate إلى التالي إلا باكتمال شروط واضحة:

- **A → B:** config validation تعمل · audit write path حيّ · health endpoints · contracts typed من SSOT بلا اسم خارج SSOT · dashboard shell يقلع.
- **B → C:** paper end-to-end يعمل (ingestion→decision→risk-gates→execution-adapter paper→positions/intents/audit) · Risk Gates تفرض Hard Risk · SignerService boundary لا يوقّع/يرسل · single-provider failure ينتج الانتقال التشغيلي الصحيح (§5.2).
- **C → D:** admission gate يقبل محفظة تنفيذ واحدة · حالات المحفظة الأربع تعمل · audit للقبول.
- **D → E:** multi-wallet + rotation/sweep موثّقة وتعمل في paper.
- **E (REAL-LIVE):** `real_live_config_valid` + Hard Risk + signer + audit + admission مكتملة + operator checklist. **قرار المستخدم، بشرط readiness — لا half-live.**

كل بوابة تتطلّب: حُرّاس Build/Test خضراء · لا drift في المفردات · candidate guard (§14) يمرّ.

---

## 10. Testing Per Gate

لكل Gate أربع طبقات (تستهلك `07-TEST-PLAN`):
- **Unit:** منطق كل وحدة.
- **Contract:** عقود API/داخلية مطابقة لـ `03-API` و SSOT (لا حقل خارج SSOT).
- **Integration:** المسار عبر الحدود (مثلًا ingestion→decision→risk-gates→execution-adapter paper).
- **Safety:** Rejected/Forbidden guards (`07-TEST-PLAN §8`)، Fail-Safe، `EXITS_ONLY` عند تدهور المصدر، وعدم تجاوز Risk/Signer.

اختبارات خاصّة بـ §5: single-provider health بالإشارات المطلقة · فشل `hot_path` → `EXITS_ONLY` · فجوة `enrichment` وحدها لا تُطلِق `EXITS_ONLY`.

---

## 11. CLI vs UI Boundary

- **المستخدم النهائي:** كل شيء عبر الواجهة. **لا يعتمد تشغيل المستخدم على CLI** إطلاقًا.
- **المطوّر / local-ops:** يجوز CLI للبناء والاختبار والتشغيل المحلّي.
- أوامر الصيانة الخطرة admin/local-ops only، ولا تتجاوز pending critical intents / active signing / audit preservation (purge لا يحذف audit مالي).
- لا تُنشأ أوامر صيانة كأسماء implemented خارج ما هو مسجّل candidate في SSOT.

---

## 12. Prohibited Agent Actions

يرث هذا القسم قوائم المنع القائمة في `CLAUDE.md` و`README`؛ لا يوسّعها ولا يخفّفها:

- **لا أسماء جديدة:** لا `field`/`enum`/`state`/`event_type`/`command_type`/`resource_type`/`api_error_code`/`stream_channel`/`audit_scope`/config threshold خارج ARCH→SSOT.
- **لا أوامر/تحويلات فرص:** `buy_opportunity` · `execute_opportunity` · `submit_opportunity` · أي radar/`accepted`→تنفيذ. لا `command_type` للفرص. لا discovery-only execution mode. لا `HUNTABLE` كـ badge/enum/state.
- **لا أوامر خروج ذرّية:** `exit_all_positions` / `batch_exit_all_positions` (البديل preview→request per-position).
- **لا P&L محلي في الواجهة كمصدر حقيقة؛** P&L backend/data read-model فقط؛ لا P&L على Opportunity/Radar؛ unrealized فقط مع mark صالح.
- **لا تجاوز للحُرّاس:** لا bypass لـ Risk Gates أو SignerService أو ترتيب order→sign→send.
- **لا أسرار:** لا raw provider key / private key / seed / signer credential / auth token في UI/DB/logs/reports/exports/backups/diagnostics. provider عبر `candidate_provider_key_ref` فقط.
- **لا توقيع/إرسال حيّ** قبل اكتمال Gate E.
- **لا auto-apply** لأي توصية؛ كل تبنٍّ preview→validation→permission→audit→config-version.
- **لا custom chart engine من الصفر** بلا تبرير معماري؛ OHLCV display-only يحتاج provenance.

---

## 13. Deliverables Per Task / Gate

ما يسلّمه الوكيل بعد كل task و عند إغلاق كل Gate:

- **Code diff summary** (ما تغيّر ولماذا).
- **Tests run** (unit/contract/integration/safety + النتيجة).
- **Docs impact** (هل لمست المهمّة فهم أي وثيقة؟ — عادة لا، لأن doc 10 تنفيذي).
- **Open questions** (أي غموض معماري وُقِف عنده).
- **No-SSOT-drift check** (§14) صريح: PASS/FAIL.

عند إغلاق Gate: تقرير اجتياز Acceptance Gate (§9) + حالة الحُرّاس + ملخّص ما يفتحه الانتقال للـ Gate التالي.

---

## 14. No-SSOT-Drift / Candidate Guard

حارس إلزامي يُفحَص في كل task و كل Gate:

1. **لا اسم خارج SSOT:** كل `field`/`enum`/`event`/`command`/`resource`/`api_error_code` مستخدَم له مدخل في `01-SSOT.md`. وُجد اسم بلا مدخل ⇒ **توقّف**، ارفع ARCH→SSOT، لا تنفّذ.
2. **candidate يبقى candidate:**
   - لا حذف الـ `candidate_` prefix.
   - لا إعادة تسمية بلا ARCH→SSOT.
   - لا إنشاء candidate جديد خارج SSOT.
   - لا نقل candidate إلى implemented (كوداً أو وثيقةً) دون قرار حوكمي صريح.
3. بناء types/adapters/tests **حول** الأسماء القائمة مسموح؛ لكنه **لا يثبّت** قدرة candidate كـ implemented product capability بدون قرار. skeleton ≠ promotion.
4. أسماء provider في الكود تطابق SSOT حرفيًّا: `candidate_provider_mode` · `candidate_provider_role` · `candidate_provider_tier` · `candidate_provider_key_ref` · `candidate_err_provider_unconfigured` · `candidate_cmd_register_provider` · `candidate_cmd_test_provider_connection` · `candidate_cmd_disable_provider` · `candidate_cmd_set_provider_role`.
5. المقاييس غير المتوفّرة تُعرض `unavailable`/`unknown`/`not_verified` — لا صفر ولا اختلاق ولا clean.
6. health green ليس trading readiness؛ documented/candidate ليس implemented.

> **خلاصة:** doc 10 ينفّذ Gates A–E و Build Order بأسماء SSOT القائمة فقط، single-provider وضع رسمي مدعوم، وكل ترقية candidate→implemented تمرّ عبر الحوكمة لا عبر مجرّد بناء skeleton.
