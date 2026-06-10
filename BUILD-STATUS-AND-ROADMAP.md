# BUILD-STATUS-AND-ROADMAP.md — حالة البناء وخريطة الطريق إلى 100%

> **النوع:** وثيقة حالة/تخطيط حيّة غير سلطوية (living status + roadmap). تُقرأ بعد `CLAUDE.md` و`README.md`.
> **القاعدة الحاكمة:** عند أي تعارض مع `docs/00`–`12` / `CLAUDE.md` / `01-SSOT.md` تُغلَّب الوثيقة المعتمدة ويُصحَّح هذا الملف. لا تضيف أي اسم SSOT/API/CONFIG/DATA جديد. لا تُحوِّل `candidate_*` إلى implemented.
> **آخر تحديث:** 2026-06-10 · **الحالة على main:** `a466ed3` · full suite **1503/1503** · mechanism guard `sources=101 allowlist=1 violations=0` · SSOT drift baseline ثابت · `can_send:true` غائب repo-wide · ALLOWLIST = `Object.freeze(['packages/isolated-signer-runtime/src/'])`.

---

## 0. ملخص تنفيذي
المشروع محرّك تداول كمّي على Solana لصيد العملات الجديدة ونسخ المحافظ الرابحة (wallet-led). تمّ بناء **العمود الفقري للأنبوب** `data → signal → risk → intent → route → sign → send` كسلسلة **حزم أساس read-only/advisory** نقيّة، fail-closed، بلا تنفيذ حيّ، بلا توقيع، بلا إرسال. كل مرحلة تستهلك مخرجات المرحلة السابقة وتنتج تمثيلاً وصفياً قابلاً للتدقيق فقط، ولا تفتح أي readiness/execution flag. الكود الحالي **سليم** (تدقيق متعدّد الوكلاء + حُرّاس آلية + drift + تدقيق مستقل = صفر عيوب). **الباقي إلى 100%** = إكمال طبقتي review للتوقيع والإرسال، ثمّ المحاكاة (paper) والمعايرة (calibration) — حيث تُقاس الربحية أوّل مرة بلا مال حقيقي — ثمّ البيانات الحيّة وواجهة المشغّل، ثمّ التوقيع الحقيقي والتنفيذ على testnet، وأخيراً تفعيل REAL-LIVE على mainnet خلف كل بوّابات الجاهزية/Hard-Risk/الأمان.

---

## 1. ما أُنجِز (DONE) — أساس الأنبوب read-only/advisory

| Stage | الحزمة / الإغلاق | exports | اختبارات الحزمة | commit الإغلاق |
|---|---|---|---|---|
| 2 | RPC Provider Foundations (`rpc-provider-contract`) — health/protocol-constant/spike boundaries | — | 257 | `08c3f28` |
| 3 | Gate-A Closure (`gate-a-foundations`) — config validation + audit path + readiness aggregation + status shell | — | 60 | `874a851` |
| 4 | Data Ingestion Foundation (`data-ingestion-foundations`) — source descriptor + replay/mock + normalized event + dedupe/cursor + health | — | 72 | `6d86d89` |
| 5 | Wallet/Token Intelligence Foundation (`wallet-token-intelligence-foundations`) — wallet/token obs + relationship + diagnostics + health | — | 63 | `8f5058a` |
| 6 | Signal Engine Foundation (`signal-engine-foundations`) — input boundary + wallet-led/token-activity candidate + scoring + suppression + health | 15 | 88 | `4aad905` |
| 7 | Risk Engine Foundation (`risk-engine-foundations`) — input boundary + hard-risk + liquidity/exit + exposure + verdict + suppression + health | 18 | 70 | `afcfd75` |
| 8 | Intent Ledger Foundation (`intent-ledger-foundations`) — input boundary + candidate record + in-memory ledger + state machine + audit envelope + suppression + health | 18 | 75 | `bf18d44` |
| 9 | Route / Execution-Planning Foundation (`route-planning-foundations`) — input/source boundary + candidate route + feasibility + execution-plan preview + suppression + health | 19 | 72 | `09c7212` |
| 10 | Transaction-Build-Review Foundation (`transaction-build-review-foundations`) — input/source boundary + candidate descriptor + resource advisory + **serialization-forbidden-surface guard (redacting)** + verdict + suppression + health | 20 | 75 | `5ba9631` |
| 11 | Signing-Review Foundation (`signing-review-foundations`) — input boundary + signer/custody boundary + candidate signing-review descriptor + custody-readiness advisory + **private-key-forbidden-surface guard (redacting NAME-only)** + verdict + **always-suppressed** suppression + health | 20 | 76 | `a466ed3` |

**حُرّاس قائمة (Gate-A/H ومسبقة):** `send-gate-contract` (85)، `isolated-signer-runtime` (مُفعَّل في ALLOWLIST، skeleton/no-key)، إضافة لحزم Gate B–E السابقة (risk-gates · intent-ledger · position-lifecycle · execution-paper-adapter · decision-engine · exit-manager · paper-portfolio · execution-wallet-* · signer-* · custody-* · real-live-readiness) الموجودة كـ skeletons محوكمة.

**الثوابت المحفوظة في كل المراحل:** كل نتيجة `read_only:true` وكل أعلام readiness/execution = `false` (incl. `can_send`/`can_serialize`/`signing_permitted`/`transaction_ready`/`serialized_ready`/`message_bytes_ready`/`route_ready`/`order_ready`/`intent_ready`/`risk_ready`/`signal_ready`/`live_quote_enabled`/`mainnet_enabled`/`real_live`). كل حزمة import-free، deterministic، fail-closed، بلا module-level mutable state، بلا network/clock/persistence/secret؛ كل eligibility تشترط الحالة النهائية الصحيحة للمرحلة السابقة؛ الأسرار/المسارات/artifacts التسلسل لا تُكرَّر أبداً (redaction). **لا SSOT name جديد · ALLOWLIST ثابت · drift baseline ثابت.**

> **ما لم يبدأ بعد (مغلق صراحةً):** أي بناء transaction حقيقي · serialization/message-bytes/signature · توقيع حقيقي · send/broadcast حقيقي · Jupiter live/live quote/aggregator · بيانات حيّة فعلية (Helius LaserStream / Triton-Yellowstone) · paper execution مُشغَّل · mainnet · REAL-LIVE.

---

## 2. نموذج العمل لكل مرحلة (Definition of Done — مراجعة واختبارات بعد كل إنجاز)
كل Stage يُنفَّذ بالدورة الثابتة التالية، ولا يُدمج جزء إلا وهو **PASS بلا blockers**، **fast-forward only**، `branch = main + 1`، parent مطابق لـ main:
1. **Inventory** مختصر (ملفات · package · أسماء SSOT؟ · dependencies؟ · guard delta).
2. **Multi-agent build workflow** (≥5 أدوار: implementation · build-test · security-guard · governance/SSOT · behavioral + arbiter) — implementation-first (code+tests).
3. **Main-loop verification** مستقلّة + **behavioral spot-check** على مدخلات حقيقية من المرحلة السابقة.
4. **Evidence report** لكل PR داخلي (`reports/E2-...`).
5. **Separate multi-agent pre-merge workflow** يعيد التحقّق ويُرجِع `CLEAR_TO_MERGE` بصفر blockers.
6. **ff-merge** ثمّ **post-merge verification**.
7. **Stage closure report** + **Stage Final Report** ثمّ **STOP** (لا مرحلة تالية بلا أمر صريح).

**بوّابة على مستوى الطور (Phase Gate):** بعد إنهاء طور كامل (A–E أدناه) تُجرى **مراجعة تكامل عبر-المراحل + regression كامل + توقيع حوكمي/أمني** قبل فتح الطور التالي. الحُرّاس الإلزامية الخضراء في كل دمج: `check-ssot-drift` (baseline ثابت) · `check-mechanism-guards` (`allowlist=1 violations=0`) · full `node --test` · `can_send:true` غائب repo-wide · ALLOWLIST غير معدّل · scope = الملفات المسموحة فقط.

---

## 3. خريطة الطريق إلى 100% — الأطوار والمراحل المتبقّية

> كل مرحلة أدناه تتبع نموذج §2. التعيين إلى Gates A–E من `10-AGENT-BUILD-PLAN §7` و`06-BUILD §6` (Safety Activation Gates). **لا يُبدأ أي طور تالٍ بلا أمر مستخدم صريح ومنفصل.**

### الطور A — إكمال أنبوب المراجعة read-only/advisory (بلا تنفيذ) — *Gate A/B*
- **Stage 11 — Signing-Review Foundation — ✅ DONE (`a466ed3`):** مراجعة جاهزية التوقيع وصفياً فقط (signer-profile/custody-readiness descriptors من metadata · `key_custody_mode` advisory · dual-control review · `signer_profile_status` review) + **Private-Key Forbidden Surface Guard** (يحجب أي اسم مفتاح/seed/keypair/signature ويُرجِع `forbidden_field_ref` = الاسم فقط، والقيمة المزروعة غائبة عن `JSON.stringify`) + verdict + **suppression دائمة الكتم لـ sign/send** (`not_sign/send/execution_authorized` على كل مسار) + health. يستهلك `TX_BUILD_REVIEW_PASS_ADVISORY`. **بلا أي private key material · بلا توقيع حقيقي · بلا تفعيل SignerService.** كل أعلام readiness/signing = false على كل حالة (incl. PASS_ADVISORY/ACCEPTABLE_ADVISORY/REVIEWED_ADVISORY). الحزمة: `signing-review-foundations` · 20 export · 76 اختبار. إغلاق: `reports/E2-STAGE-11-...-CLOSURE-EVIDENCE.md`.
- **Stage 12 — Send/Broadcast-Review Foundation — ⏭️ التالي (يتطلّب أمراً صريحاً منفصلاً):** مراجعة شروط الإرسال وصفياً فقط (provider/sender descriptors disabled/read-only · bundle/tip advisory buckets · idempotency/intent review). يتكامل مع `send-gate-contract` القائم (الذي يبقى fail-closed). **بلا send/broadcast حقيقي · `can_send`/`can_broadcast` يبقيان false.**
- **Stage 13 — End-to-End Decision-Trace Orchestrator (read-only):** تركيب المراحل 4–12 في **Decision Trace** واحد deterministic + full-pipeline health/status read-model، يُظهر سبب القبول/الرفض لكل قرار عبر الأنبوب. لا تنفيذ. **Phase-A Gate:** مراجعة تكامل + regression كامل + توقيع حوكمي/أمني.

### الطور B — المحاكاة والمعايرة (قابل للتنفيذ، بلا مال حقيقي — هنا تُقاس الربحية أوّل مرة) — *Gate B*
- **Stage 14 — Paper Execution Engine:** ربط الأنبوب بـ `execution-paper-adapter` لإنتاج fills محاكاة (simulated دائماً) + `candidate_paper_portfolio` + P&L read-model (realized FIFO · unrealized بشرط mark صالح · fees/slippage/latency/failure-aware · per-wallet/mode/brain). **بلا live · بلا signer · بلا تنفيذ حقيقي.**
- **Stage 15 — Calibration & Backtest Harness:** `CalibrationStore` + معايرة point-in-time/survivorship-free + `candidate_paper_real_divergence` + تغذية بوّابات EV (`net_expectancy`/`profit_factor`/LCB/`exit_success`) + replay/backtest datasets. **بلا future leakage · المحافظ المنقرضة ضمن العيّنة.**
- **Stage 16 — Strategy & Wallet Profitability Intelligence:** تعميق ذكاء الربح: `candidate_net_business_pnl` · `candidate_wallet_net_copyability_rank` · fake-profit/adverse-selection/crowd-decay · creator/cluster learning · best-paper-settings advisory · reports/exports + alerts. **advisory فقط · لا auto-apply · لا P&L على Opportunity/Radar.** **Phase-B Gate:** مراجعة + regression + إثبات ربحية paper مع disclaimers (paper ≠ live).

### الطور C — البيانات الحيّة (read-only) + واجهة المشغّل — *Gate B→C*
- **Stage 17 — Live Data Integration (read-only):** تفعيل الاستقبال الحيّ الفعلي (Helius LaserStream gRPC / Triton-Yellowstone) خلف المحوّلات المُعطّلة حالياً، مع provider onboarding عبر `candidate_provider_key_ref` فقط (لا raw key) + New Coin Radar / `TokenOpportunity` read-model حيّ + RPCHealthMonitor/SlotLag حيّ + StreamGapRecovery. **read-only enrichment · لا تنفيذ · لا توقيع · WARMING_UP→ACTIVE/EXITS_ONLY منطق الجاهزية.**
- **Stage 18 — Operator Dashboard / UI:** واجهة TypeScript حسب `11-UI-SPEC` + `12-DESIGN-SYSTEM` (Decision/Copy/Exit Operating System · 9 صفحات · AR/EN · RTL/LTR · beginner/advanced · derived read-only · لا CLI للمستخدم · لا chart-trading-first · المقاييس غير المتوفّرة `unavailable`). **Phase-C Gate:** مراجعة + UI acceptance tests (`07-TEST §17`) + regression.

### الطور D — التوقيع الحقيقي والتنفيذ على testnet (أمان Gate C/D) — *Gate C/D*
- **Stage 19 — Real Signing Implementation (SIGN-ONLY):** تفعيل `isolated-signer-runtime` (ALLOWLIST مُهيّأ) بـ WebCrypto Ed25519 · sign-only · مفتاح ephemeral/testnet · isolation + no-key-leak tests + audit before/after. **بلا send · بلا mainnet · بلا REAL-LIVE.**
- **Stage 20 — Key Management / Custody / Execution-Wallet Lifecycle:** KMS/Vault adapter (بعد supply-chain review منفصل) · execution-wallet admission/drain/revoke/rotation/sweep · `signer_control` dual-control · break-glass + audit retention. **`signer_control` صلاحية منفصلة · لا raw key في UI/DB/logs/exports.**
- **Stage 21 — Testnet/Devnet Execution:** إرسال حقيقي على testnet **فقط** (Helius Sender / Jito send/bundle خلف `send-gate-contract`) · IntentLedger idempotency · FailedTransactionClassifier · bundle status observer. **mainnet ممنوع · REAL-LIVE ممنوع.** **Phase-D Gate:** مراجعة أمنية كاملة + isolation/no-key-leak + regression + توقيع `signer_control`.

### الطور E — تفعيل REAL-LIVE على mainnet (Gate E — قرار المستخدم النهائي) — *Gate E*
- **Stage 22 — REAL-LIVE Readiness + Hard-Risk Wiring:** ربط `real_live_config_valid` + Hard-Risk limits (daily-loss/drawdown/exposure kills) + Calibration Kill/Pause + Readiness Checklist (priority-fee/Jito-tip cache · protocol constants · RPC green · stream sync · calibration priors · cost pipeline) + `activate_real_live` command path. **config غير صالح لـ REAL-LIVE إن غابت حدود Hard Risk.**
- **Stage 23 — Mainnet REAL-LIVE Activation:** التفعيل النهائي خلف كل البوّابات بقرار مستخدم صريح، برأس مال محدود ومراقَب + global kill switch + Emergency Exit. **يبقى Fail-Safe-Not-Fail-Open.** **Phase-E Gate:** توقيع جاهزية نهائي + خطة rollback/incident.

---

## 4. تسلسل البناء الإلزامي (مرجع — من `CLAUDE.md`/`06-BUILD §4`)
`CostPipeline → CalibrationStore → RPCHealthMonitor → ProtocolConstantMonitor → SignerService/KeyManager → PositionLifecycleStateMachine → IntentLedger`. وحدات live hardening وSignerService/KeyManager **إلزامية قبل REAL-LIVE**. الأطوار أعلاه تحترم هذا الترتيب: المعايرة (B) قبل الحيّ (C)، والتوقيع المعزول (D) قبل التفعيل (E).

## 5. مخاطر/قرارات حوكمية مفتوحة قبل الأطوار اللاحقة
- **أي اسم جديد** يلزم لأي مرحلة (مثل signing-review/send-review states) يبقى **function-I/O local فقط** (سابقة معتمدة) أو يمرّ `ARCH → SSOT` قبل الاستخدام — لا اسم خارج SSOT.
- **dependency جديدة** (signing lib · KMS SDK · chart lib · stream client) تتطلّب **تقرير supply-chain منفصل** قبل الإضافة؛ والأفضل تأجيلها لأبعد طور ممكن.
- **REAL-LIVE / send / mainnet / private key** تبقى مغلقة بشروط `06-BUILD §6` ولا تُفتح إلا بأمر مستخدم صريح لكل طور.

## 6. الخلاصة
الكود الحالي سليم وكل الحُرّاس خضراء. الطريق إلى 100% واضح ومتدرّج: **مراجعة → محاكاة/معايرة (قياس الربح) → بيانات حيّة + واجهة → توقيع معزول + testnet → REAL-LIVE**. الترتيب يضع **قياس الربحية والأمان قبل المال الحقيقي**، وهو الأذكى لمحرّك يستهدف الربح. يبدأ كل طور بأمر مستخدم صريح ومنفصل، وينتهي بمراجعة واختبارات وبوّابة حوكمية.
