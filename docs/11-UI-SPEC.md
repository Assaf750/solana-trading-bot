# 11-UI-SPEC.md — مواصفة الواجهة التشغيلية (UI Specification) — V3

> **الحالة:** مسودة V3 (تحديث incremental على V2، لا إعادة كتابة) — وثيقة تنفيذ UI **غير سلطوية**، مشتقّة من `04-UX-PRODUCT-SPEC.md`. تُقرأ بعد الوثائق المعتمدة 00–10.
> **النوع:** UI Component / Interaction / Workflow Spec.
> **القاعدة الحاكمة:** **لا اسم جديد.** كل ما داخل backticks اسم canonical قائم في SSOT، أو قيمة enum مسجّلة، أو مرجع وثيقة/قسم. أي اسم مطلوب وغير موجود يُذكر نصًّا مع وسم "يحتاج حوكمة" (بلا backticks) ولا يُدرَج كاسم فعلي.
> **تغييرات V3 (incremental):** تعميق Decision Visualization (§6) · قاعدة no-stale-as-live + Freshness/Stream Health (§13) · Safety UX hardening + Danger Zone (§15) · First-Run Onboarding + REAL-LIVE Readiness (§8) · معيار RTL/bidi + redundancy لوني (§18) · Command Palette وRight Inspector موحّد (§2) · Data Tables Standard (§12) · Tx/Landing Inspector (§10) · XAI explain-only (§16) · Error states بـ `request_id` + guided remediation (§14). **لا SSOT/API/Data/07-TEST/Design-System ضمن V3.**

---

## 0. Purpose & Non-Authority
تحويل قدرات المشروع إلى **واجهة تشغيل كاملة** لمستخدم لا يستخدم CLI (`10-AGENT-BUILD-PLAN §11`). الأسماء/المعاني من SSOT/ARCH؛ العناصر البصرية ملك UX (`04-UX §1`)؛ عند التعارض مع 00–10 تُغلَّب الوثيقة المعتمدة؛ لا تنقّل علوي جديد (Left Nav = الصفحات التسع، `04-UX §3`).

## 1. UI Philosophy — Decision / Copy / Exit Operating System
«Build a Solana Copy-Trading Operating System, not a dashboard.» — Command · Observe · Diagnose · Simulate · Configure · Exit · Audit. ليست منصّة شارتات/تحليل فني. مبادئ `04-UX §2`. **قاعدة "لا ميزة مدفونة":** كل قدرة لها سطح بمستوى سلطتها (read-only/diagnostic بلا زرّ · action-capable بفعل قائم مسموح · blocked يُعرض سبب التعطيل)؛ لا اختراع names/commands · لا candidate→implemented · لا شراء من Radar/Opportunity · لا P&L فيهما · لا أسرار في UI/logs/exports.

## 2. App Shell & Global Regions
permission-aware، أسماء قائمة فقط:
- **Top Bar:** `operating_state` · `real_live_config_valid` · `validation_status` · صحة المزوّد/التدفّق (`provider_degraded` · `slot_lag` · `last_confirmed_slot`) · وضع paper/real · اللغة/الاتجاه · تنبيهات `candidate_alert_severity` = critical · ساعة حداثة عامة (آخر تحديث).
- **Global Safety Banner (دائم عند الخطر):** عند `operating_state` ∈ {`EXITS_ONLY`·`PAUSED`·`KILLED`} أو عدم صلاحية `real_live_config_valid` أو `provider_degraded`؛ لا يُخفى ولا يُدمَج ولا يُعرض كـ empty state.
- **Left Navigation:** الصفحات التسع فقط.
- **Main Workspace:** محتوى الصفحة + workspace modes داخل الصفحة (لا صفحات جديدة).
- **Right Inspector (موحّد — V3):** سطح جانبي واحد سياقي؛ اختيار صف (Opportunity/Position/Wallet/Alert/Config field/Trade event/Provider) يفتح تفاصيله. **cross-page context linking:** الانتقال Radar→Opportunity→Position→Trade→Log يبقى متّصلًا والمفتّش يتبع العنصر المحدّد. Inspector الفرصة **بلا فعل تنفيذ وبلا P&L**.
- **Bottom Operations Panel:** ذيل تشغيلي حيّ يربط مفاهيم قائمة فقط — `intent_update` · صحة التدفّق · حالة `apply_config_migration` · مقتطفات `audit_event` (محجوبة الأسرار) · تنبيهات غير حرجة. ليس entity جديدًا.
- **Command Palette (V3):** يُبنى **حصراً فوق Catalog A (§5)** — تنقّل + actions قائمة ومسموحة فقط؛ fuzzy search · أوامر حديثة/مثبّتة · عرض الاختصارات · permission-aware (لا يُظهر فعلًا فوق صلاحية المستخدم). **الفعل الخطر يمرّ بمسار preview→confirm→audit، لا تنفيذ بضغطة.** لا commands جديدة، لا opportunity execution، لا "buy from Radar".
- **Notification/Alert Center:** صفحة Alerts. **Help/Glossary:** صفحة ثابتة دائمًا (consistent help).

## 3. Design System
semantic colors (لا تمييز بالخطر باللون وحده) · typography scale · spacing 4/8px · density modes · مكوّنات (badges · cards · tables · timelines · modals · toasts · drawers) · حالات العناصر موحّدة (hover·focus·pressed·selected·disabled) · حالات الصفحة (loading·empty·stale·degraded·blocked·error·populated) · danger/confirmation modal يعرض الأثر الدقيق.

## 4. Per-Page Component Spec (الصفحات التسع)
بنية كل صفحة: الغرض · الهدف · المصدر · المكوّنات · الجداول/الأعمدة · الفلاتر · الأفعال المسموحة · أسباب التعطيل · Inspector · ربط Bottom Panel · الحالات · beginner/advanced · audit/provenance · redaction · AR/EN. (تفصيل الصفحات كما في V2: Command Center · Trading Workspace · New Coin Radar · Wallet Intelligence · Analytics & Reports · My Wallets & Funds · Settings & Safety · Alerts · Help/Glossary — تستهلك أسماء SSOT القائمة لكل صفحة.)

## 5. Feature Completeness Contract + Traceability Matrix + Catalog A
عقد ثنائي الوجه: لكل قدرة سطح بمستوى سلطتها؛ قدرات معيّنة بلا سطح تنفيذ (opportunity/radar/discovery/`accepted`/diagnostic)؛ candidate يظهر موسومًا candidate.

### Traceability Matrix (نموذج، يُستكمَل لكل قدرة)
| Capability / SSOT | Page | Component | R/O أو Action | Permission | State/Mode | Audit/Provenance | Disabled reason | Empty/Error | No-new-name |
|---|---|---|---|---|---|---|---|---|---|
| `operating_state` | Command Center | status + actions | Action | `admin`/`signer_control` | يحترم الحالة | `audit_event` | خارج الصلاحية | n/a | ✓ |
| `hunt_status`/`new_token_priority_score` | New Coin Radar | ranked list | R/O | `viewer`+ | — | provenance | n/a | "لا فرص" | ✓ |
| P&L read-model (`§26.1`) | Analytics | tables | R/O | `viewer`+ | mark صالح للـ unrealized | provenance | n/a | unavailable | ✓ |
| `manual_exit_position` | Trading Workspace | preview→confirm | Action | `operator`/`admin` | يحترم `position_state` | `audit_event` | `COMMAND_NOT_ALLOWED_IN_STATE` | n/a | ✓ |
| execution wallet cmds | My Wallets & Funds | محمي | Action | `admin`/`signer_control` | admission gate | `audit_event` | سبب الرفض | n/a | ✓ |
| provider key flow | Settings & Safety | onboarding (candidate) | Action (candidate) | `admin` | `candidate_provider_key_ref` | `audit_event` | `candidate_err_provider_unconfigured` | n/a | ✓ candidate |
| `candidate_landing_outcome_by_heat_bucket` | Workspace/Analytics | تبويب تشخيصي | R/O diagnostic | `viewer`+ | — | provenance | لا gate/auto-config | "لا عيّنة" | ✓ |

### Catalog A — Command & Action Catalog
كل أمر/فعل **قائم** فقط (لا أمر جديد):

| command/action | Page | Component | Permission | Allowed state | preview | confirm | audit | result | prohibited context |
|---|---|---|---|---|---|---|---|---|---|
| `pause_system` | Command Center | زر | `admin` | أي حالة فعّالة | — | ✓ | ✓ | الحالة الجديدة | — |
| `resume_system` | Command Center | زر | `admin` | `PAUSED`/`EXITS_ONLY` | — | ✓ | ✓ | الحالة | يُفضّل المرور بـ `WARMING_UP` |
| `trigger_kill_switch` | Command Center | زر خطر (Danger Zone) | `signer_control` | أي حالة | ✓ | ✓ | ✓ | `KILLED` | — |
| `activate_real_live` | Command Center | زر محمي (Danger Zone) | `admin`/`signer_control` | يتطلّب صلاحية `real_live_config_valid` | ✓ | ✓ | ✓ | تفعيل | معطّل عند عدم الصلاحية |
| `manual_exit_position` | Trading Workspace | preview | `operator`/`admin` | حسب `position_state` | ✓ | ✓ | ✓ | intent | في حالة لا تسمح → `COMMAND_NOT_ALLOWED_IN_STATE` |
| `emergency_exit_position` | Trading Workspace | مسار أمان (Danger Zone) | `operator`/`admin` | حسب الحالة | ✓ | ✓ | ✓ | intent | لا يتجاوز Hard Risk |
| `cancel_intent` | Trading Workspace | زر | `operator`/`admin` | intent معلّق | ✓ | ✓ | ✓ | إلغاء | — |
| batch exit preview→request per-position | Trading Workspace | preview per-position | `operator`/`admin` | حسب الحالة | ✓ | ✓ | ✓ | per-position | لا أمر ذرّي `exit_all_positions`/`batch_exit_all_positions` |
| `register_wallet`/`update_wallet_config`/`enable_wallet_follow`/`disable_wallet_follow` | Wallet Intelligence / My Wallets | نماذج | `operator`/`admin` | — | ✓ | ✓ | ✓ | نتيجة | `disable_wallet_follow` لا يغلق المراكز |
| `register_execution_wallet`/`update_execution_wallet`/`activate_execution_wallet`/`drain_execution_wallet`/`disable_execution_wallet`/`revoke_execution_wallet`/`set_execution_wallet_assignment_policy` | My Wallets & Funds | نماذج محمية | `admin`/`signer_control` | admission gate | ✓ | ✓ | ✓ | الحالة | `revoke_execution_wallet` يتطلّب `signer_control` |
| `register_signer_profile`/`disable_signer_profile`/`revoke_signer_profile`/`revoke_signer` | My Wallets / Settings & Safety | محمي (Danger Zone) | `signer_control` | — | ✓ | ✓ | ✓ | `signer_profile_status` | — |
| `create_asset_transfer_intent`/`cancel_asset_transfer_intent`/`rotate_execution_wallet`/`complete_wallet_rotation`/`sweep_profits` | My Wallets & Funds | نماذج | `admin`/`signer_control` | حسب الحالة | ✓ | ✓ | ✓ | intent/تدوير | — |
| `preview_config_update`/`update_config`/`apply_config_migration` | Settings & Safety | محرّر config | حسب الحقل | validation | ✓ | ✓ | ✓ | `config_version` | تجاوز validation ممنوع |

**ممنوع أن يظهر كزرّ:** `buy_opportunity` · `execute_opportunity` · `submit_opportunity` · `exit_all_positions` · `batch_exit_all_positions` · شراء من Radar/`accepted` · trading from chart.

## 6. Decision Visualization & Copy/Exit Timeline Standard — مكوّنات مفصّلة (V3, P0.1)
> ليست charting. كل مكوّن: ماذا يعرض · حقول SSOT القائمة · حالاته · ما لا يظهر. لا candles/RSI/EMA/MACD.

### 6.1 Opportunity Decision Timeline
- **العرض:** خط زمني أفقي لأحداث القرار: discovery → `quote_mint` pairing → leader signal (`copy_event`) → evaluation → بوابات → `hunt_status` (`discovered`·`ranked`·`gated`·`accepted`·`rejected`·`watch_only`·`expired`·`entered`) → `accepted_reason`/`rejected_reason`.
- **الحقول:** `hunt_status` · `quote_mint` · `copy_event` · `new_token_priority_score` (ترتيب) · `rejected_reason` (قد يحمل `unknown_quote_mint`) · provenance.
- **الحالات:** loading skeleton · empty ("لا فرص") · stale (وسم الحداثة، §13). **لا زرّ شراء · لا P&L.**

### 6.2 Leader vs Copier Timeline
- **العرض:** مقارنة جنبًا‑إلى‑جنب: فعل القائد (`copy_event`) مقابل فعلنا/سبب عدم الدخول؛ فرق التوقيت والسعر.
- **الحقول:** `discovery_latency_ms` · `signal_to_execution_ms` · `entry_slippage_vs_leader` · شرح copyability (`copyability_by_brain` · `candidate_copyability_component_veto`/`candidate_copyability_veto_reason`) · adverse selection (`§26.8`).

### 6.3 Position Lifecycle Timeline
- **العرض:** مراحل المركز كـ state timeline مع أحداثها.
- **الحقول:** `position_state` (`OPENING`·`OPEN`·`PARTIALLY_EXITING`·`EXIT_PENDING`·`MIRROR_SELL_PENDING`·`MIGRATION_PENDING`·`CLOSED`·`CLOSED_WITH_DUST`·`FAILED_ENTRY`·`FAILED_EXIT`) · `intent_type` · أحداث أمان أثناء الاحتفاظ مثل `hook_upgraded_mid_hold` (كتحذير mid-hold، §6.5).

### 6.4 Exit Feasibility Visualization
- **العرض:** "هل الخروج ممكن الآن؟" — عمق السيولة الحقيقي مقابل الخام، انزلاق متوقع، مسار الخروج وحالته.
- **الحقول:** `active_exit_route` (route unavailable/restored) · effective liquidity مقابل raw liquidity (علاقة Data `05-DATA §359`، **تُعرض من Data لا تُحسَب في UI**) · `wash_fake_activity_risk` · `migration_phase`/`MIGRATION_IN_PROGRESS`.

### 6.5 Safety / Decision Trace
- **العرض:** قائمة بوابات (Risk Gates) مع pass/fail وسبب لكل بوابة.
- **الحقول:** Hard Risk · EV gate (`ev_gate_mode`) · token safety عبر `candidate_token_safety_reason` (`transfer_hook_active` · `token2022_extension_risk`) · `hook_upgraded_mid_hold` كسبب **emergency-exit/mid-hold لا مكوّن دخول** (بلا hash field/زرّ؛ الرفض النهائي `token2022_dangerous_extension`) · `unknown_quote_mint` كسبب skip.

### 6.6 Landing Diagnostic
- **العرض:** سبب الهبوط/الفشل لكل intent/trade + تبويب الانحياز.
- **الحقول:** `candidate_landing_outcome_by_heat_bucket` (تبويب {attempted·landed·failed·expired·skipped}، diagnostic only، لا gate/auto-config) · `bundle_status` · `failure_type` · `candidate_failure_origin`. (انظر Tx/Landing Inspector §10.)

### 6.7 Optional market-context chart
display-only, provenance-backed (`§26.17`، مكتبة احترافية لا engine من الصفر). أداة عرض اختيارية؛ لا candlesticks/indicators كشرط؛ Trading Platform/Broker مرفوض.

## 7. Providers & API Keys — Flow B
Onboarding (`candidate_provider_mode` = single baseline / multi لاحقًا · `candidate_provider_role` · `candidate_provider_tier`) → إدخال مفاتيح Helius/Jupiter/Jito/المزوّد → `candidate_cmd_test_provider_connection` → `candidate_cmd_register_provider` → بعد الحفظ **`candidate_provider_key_ref` فقط، لا raw key أبدًا** → صحّة (`provider_degraded`·`slot_lag`·`last_confirmed_slot`) → `candidate_cmd_disable_provider`/`candidate_cmd_set_provider_role`. single-provider يعمل End-to-End؛ فشل hot_path → انتقال تشغيلي صحيح؛ فجوة enrichment وحدها لا تُطلِق `EXITS_ONLY`؛ بلا مفتاح → `candidate_err_provider_unconfigured`. (أوامر المزوّد candidate حتى إقرار `03-API`.)

## 8. First-Run Onboarding & REAL-LIVE Readiness (V3, P0.4)
> تدفّق كامل عبر UI، **بلا CLI**. يستهلك أسماء onboarding المرشّحة القائمة.

- **First-run wizard (خطوات قصيرة + checklist مستمر):** يستهلك `candidate_onboarding_progress` · `candidate_ob_steps` · `candidate_ob_completion_state` · `candidate_ob_selected_mode` · `candidate_ob_language_direction` · `candidate_ob_first_wallet_progress` · `candidate_ob_provider_setup_progress` · `candidate_ob_paper_setup_progress` · `candidate_ob_live_readiness_education_progress`.
- **التسلسل:** اللغة/الاتجاه → provider setup (Flow B §7) → API key flow → wallet setup → copy config (Flow C §9) → paper test → readiness checklist. يُفضَّل تجربة القيمة في paper قبل أي مخاطرة.
- **REAL-LIVE readiness checklist:** بوابات مرئية — `real_live_config_valid` · Hard Risk مكتمل · `signer_profile_status` = `ACTIVE` · `execution_wallet_status` = `ACTIVE` (admission) · audit متاح · provider health مقبول. **REAL-LIVE locked** حتى اكتمال البوابات؛ `activate_real_live` معطّل مع سبب حتى الصلاحية.

## 9. Wallet & Copy Configuration — Flow C
`register_wallet`→`update_wallet_config` · `tracked_wallet_status` (`candidate`·`watch_only`·`copy_allowed`·`degraded`·`banned`، derived read-only) · لماذا نتبع/نرفض/نخفض الحجم (`candidate_copyability_component_veto`+`candidate_copyability_veto_reason` · `candidate_edge_health_status`) · `copy_mode` (`follow_entry_user_exit`/`full_mirror`، لا `full_mirror` صامت) · per-wallet config + limits عبر `preview_config_update`→`update_config` (validation) · `follow_enabled`/`enable_wallet_follow`/`disable_wallet_follow` (لا يغلق مراكز) · leader attribution/cluster (`§26.8`/`§26.5`). derived read-only؛ تحرير → `READ_ONLY_FIELD_REJECTED`؛ لا نسخ أعمى.

## 10. Positions / Intents / Trades / Logs — Flow D + Tx/Landing Inspector (V3, P1.9)
- **Flow D:** المراكز عبر `position_state`؛ intents عبر `intent_type` (`BUY_INTENT`·`SELL_INTENT`·`SCALE_IN_INTENT`·`MIRROR_SELL_INTENT`·`EMERGENCY_EXIT_INTENT`·`CANCEL_INTENT`) و`intent_update`؛ محاولات/فشل عبر `bundle_status` (`Pending`·`Failed`·`Landed`·`Invalid`·`STALE_BUNDLE`) و`failure_type` (`SlippageExceeded`·`BlockhashExpired`·`AccountInUse`·`ComputeBudgetExceeded`·`InsufficientFunds`·`RouteInvalid`·`TokenAccountMissing`·`ProgramError`·`RPCDropped`·`BundleFailed`·`Unknown`)؛ partial/emergency exits؛ execution trace + `candidate_failure_origin` (`provider`·`route`·`signer`·`risk`·`liquidity`·`blockhash`·`bundle`·`fill`)، `§25`؛ audit (`audit_event`/`audit_actor`) مع redaction.
- **Tx/Landing Inspector (V3):** لكل intent/trade يعرض **بأسماء قائمة فقط، بلا API جديد**: سبب الفشل (`failure_type`)، أصله (`candidate_failure_origin`)، حالة الـ bundle (`bundle_status`)، والكمون (`discovery_latency_ms`/`signal_to_execution_ms`). يفسّر أسباب مثل تجاوز الانزلاق/انتهاء blockhash/تجاوز compute عبر قيم `failure_type` القائمة. (أي حقل تشخيصي أعمق غير موجود في هذه enums = يحتاج حوكمة، لا يُفترض.)

## 11. Reports & Exports — Flow E
Markdown + CSV/Parquet/JSONL حيث يُسمح (`§26.11`) · redaction إلزامي · provenance على الأرقام · المفقود يُعرض unavailable (`candidate_report_missing_metric_policy`) · artifacts تُفتح/تُنزَّل في Analytics · كل تصدير يُسجَّل `audit_event` · بدء التصدير قدرة candidate (Group 27) حتى إقرار API.

## 12. Data Tables Standard (V3, P1.8)
لـ Positions/Intents/Trades/Logs/Reports وكل جدول كثيف:
- **virtualized** للأداء · **sort/filter/search** (حيث عمليّ) · **grouping** · **pinned/frozen columns** · **saved views** (عبر التفضيلات القائمة `§26.12`) · **expandable rows + inline drill-down** (يفتح Right Inspector) · hover actions · zebra striping · `tabular-nums` للأرقام · تصدير **بلا أسرار**.
- **التعطيل:** أعمدة derived/runtime read-only؛ تحرير → `READ_ONLY_FIELD_REJECTED`. (Query builder خادمي متقدّم خارج V3 — مشروط API/Data لاحقًا.)

## 13. Data Truth, Freshness & Stream Health — no-stale-as-live (V3, P0.2)
> قاعدة قبول: **لا تُعرض بيانات قديمة كأنها live.**
- **لكل data surface:** timestamp ظاهر · وسم truth-mode (live/delayed/estimated/paper/real، مستقلّ عن الحداثة) · حالة freshness.
- **الحالات البصرية الصريحة:** `live` · `stale` · `degraded` · `reconnecting` — لكلٍّ تمييز بصري لا يُخلط مع live.
- **المصدر:** `provider_degraded` · `slot_lag` · `last_confirmed_slot` · `last_seen_slot` · `stream_cursors`. تدهور المصدر يظهر فورًا في Top Bar + Global Safety Banner، وينعكس على الصفحات.
- **الحقيقة من API/Data لا UI:** لا حساب صحّة/حداثة محليًّا؛ الواجهة تعرض القيم القائمة.

## 14. UI States + Error States (V3, P1.11)
- **UI states** (بصرية، لا enum): loading·empty·stale·degraded·blocked·error·populated.
- **Error state يجيب:** ماذا/أين/لماذا؟ هل الأموال/المركز/المفتاح بخطر؟ ما الإجراء التالي؟ + **`request_id`** (إن أتاحه API) قابل للنسخ + **guided remediation** (خطوات إصلاح) + Open logs/Open audit + Retry/Fix. المفقود يُعرض unavailable لا صفر/اختلاق.

## 15. Safety UX Standard — hardened (V3, P0.3)
كل فعل مالي/أمني خطر: **preview → permission → validation → risk/signer check → confirm (يعرض الأثر) → audit (`audit_event`) → result.** يشمل `activate_real_live`·`trigger_kill_switch`·`pause_system`/`resume_system`/أفعال `EXITS_ONLY`· config changes · provider key registration (candidate) · wallet admission · `manual_exit_position`/`emergency_exit_position` · `sweep_profits`/rotation/asset transfer · signer/execution wallet actions.
- **Danger Zone pattern (V3):** الأفعال المدمّرة (`emergency_exit_position` · `trigger_kill_switch` · `revoke_execution_wallet`/`revoke_signer` · `activate_real_live`) في منطقة خطر مميّزة، **تأكيد عالي الاحتكاك**، و**مفصولة مكانيًا** عن الأفعال الحميدة، وعنوان/زرّ يصفان الفعل صراحةً.
- **disabled reasons دائمة الظهور** (لا زرّ معطّل بلا سبب) · **redaction** (لا raw secrets) · **فصل paper/live بصري قاطع** · **critical warnings لا تُخفى/تُسكت/تُدمَج** (`candidate_alert_category`=security مع `candidate_alert_severity`=critical).

## 16. XAI Assistant — explain-only (V3, P1.10)
مساعد داخل الواجهة **يشرح فقط**، يستهلك أسماء/بيانات قائمة:
- **يشرح:** لماذا رُفضت فرصة (`rejected_reason` + Safety/Decision Trace §6.5) · لماذا مركز في خطر (Exit Feasibility §6.4 + Token-2022) · معنى `hook_upgraded_mid_hold` ومصطلحات أخرى (عبر `candidate_glossary_content`/`candidate_glossary_sot_mapping`) · كيف تُصلح مفتاح مزوّد (Flow B §7) · ما الخطوة التالية.
- **ممنوع:** auto-trading · auto-apply · حساب حقائق تنفيذ محليًّا. **أي فعل يبقى عبر preview/confirm/audit.** مستويات شرح متدرّجة (ملخّص → سبب → تفاصيل). لا اسم/أمر جديد.

## 17. Customization
Layer 1 عرض (AR/EN·RTL/LTR·beginner/advanced·compact/detailed·light/dark) · Layer 2 workspace (saved layouts/landing/workspace per workflow عبر `§26.12`) · Layer 3 جداول (columns·sort·filter·grouping·saved views·export). **Layer 4–5 (config/safety) ليست تخصيصًا:** تحرير `copy_mode`/sizing/exit policy/Hard Risk يتسلسل إلى Config ويمرّ validation — لا UI-local، لا تجاوز. Presets = معاينة فقط تكشف حقول config المتغيّرة، بلا bypass.

## 18. Accessibility / i18n / RTL-bidi / Performance + UI Acceptance Gates + Prohibited + No-Drift Guard

### 18.1 Accessibility / i18n
WCAG 2.2 AA (حجم الهدف الأدنى 24×24 CSS px · Focus Not Obscured · Focus Appearance · Dragging Movements · Consistent Help · Redundant Entry · Accessible Authentication) · keyboard navigation · visible focus · AR/EN + RTL/LTR (`source_of_truth_field` إنجليزي canonical).

### 18.2 RTL/bidi standard + color redundancy (V3, P0.5)
- **bidi isolation:** عناوين المحافظ، tx ids، أرقام، مبالغ، timestamps **تبقى LTR معزولة** داخل النص العربي (logical properties · `dir="auto"` · عزل ثنائي الاتجاه للأرقام/المعرّفات) كي لا تنكسر داخل تخطيط RTL.
- **color redundancy:** **لا حالة باللون وحده** — كل حالة = لون + نص + أيقونة (status label). يطبَّق على badges/freshness/safety/الجداول.
- خطوط عربية مقروءة في الكثافة العالية؛ المحاذاة المنطقية تنعكس صحيحًا بين RTL/LTR.

### 18.3 UI Acceptance Gates
كل backend capability له UI surface (Matrix §5) · كل أمر مسموح له preview/confirm/audit/result (Catalog A) · لا أمر مرفوض كزرّ · كل جدول sort/filter/search حيث عمليّ · كل data surface له timestamp/freshness/truth-mode (no-stale-as-live §13) · كل error بسبب + إجراء + `request_id` إن وُجد · كل secret flow يثبت redaction · REAL-LIVE محجوب حتى readiness · كل صفحة AR/EN + RTL/LTR · critical warnings لا تُخفى · لا stale-as-live · لا CLI لإنجاز مهمة. (الاختبارات الفعلية لهذه البوابات = حزمة `07-TEST` لاحقًا.)

### 18.4 Prohibited UI Patterns + No-SSOT-Drift / Candidate Guard
**مرفوض:** candlestick-first UI · RSI/EMA/MACD requirement · 100+ indicators · technical-analysis-first workspace · Order Ticket · Trading Platform/Broker API · DOM/order-book assumption · chart-based manual execution · manual buy/sell from chart · TradingView-like trader workspace كنواة · شراء من Radar/Opportunity · P&L داخل Opportunity/Radar · حساب P&L/freshness محلي · عرض raw secrets · إخفاء تحذير أمني · تنقّل علوي جديد خارج الصفحات التسع · mobile dangerous actions.
**حارس عدم الانزياح:** (1) كل اسم تقني له مدخل في SSOT؛ غير الموجود يُذكر نصًّا "يحتاج حوكمة" بلا backticks. (2) candidate يبقى candidate (لا حذف prefix · لا إعادة تسمية بلا ARCH→SSOT · لا نقل إلى implemented). (3) لا `field`/`enum`/`command_type`/`resource_type`/`event_type`/`api_error_code`/`stream_channel`/`audit_scope`/threshold جديد. (4) أوامر المزوّد و"بدء التصدير" candidate حتى إقرار API. (5) UI states بصرية لا enum.

> **خلاصة V3:** تعميق incremental لمكوّنات القرار والأمان والحداثة وOnboarding وRTL والمساعد التفسيري، بأسماء SSOT القائمة فقط، مع كل حُرّاس الأمان والحوكمة — دون SSOT/API/Data/07-TEST/Design-System.
