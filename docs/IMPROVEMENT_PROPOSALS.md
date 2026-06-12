# IMPROVEMENT_PROPOSALS — Competitor-Informed (Category C, proposal-only)

> **Phase 5.5 of `production-release-readiness-gate`.** Ideas learned from leading Solana/crypto trading platforms, classified per the Competitor Benchmark Rule. **Category C items are proposals ONLY — never auto-implemented.** Each new trading strategy, execution behavior, or money-touching change requires the operator's explicit approval **and** an SSOT update first. This protects the operator, who does not review code personally.
>
> **Not an SSOT document** (`docs/00`–`12` are untouched and authoritative).

**Date:** 2026-06-11 · **Branch:** `release-gate/local-live/2026-06-11`

---

## 0. الخلاصة للمالك (عربي أولاً)

قارنّا تطبيقك بأشهر منصّات تداول سولانا. **النتيجة المطمئنة:** أغلب «ميزات الأمان» التي تتباهى بها تلك المنصّات (كشف honeypot، صلاحية الـ mint/freeze، تركّز كبار المالكين، إعدادات الانزلاق ورسوم الأولوية، مكافحة MEV، TP/SL، أوضاع النسخ) **موجودة أصلاً في معماريّتك وأكثر صرامة** — لأنها fail-closed وقائمة على veto ومقيَّمة point-in-time. لم نغيّر شيئاً منها لأنها أفضل من المرجع.

ما يلي **مقترحات فقط** (Category C): أفكار جديدة تمسّ سلوك التداول أو تتطلّب تعديل SSOT. **لا تُنفَّذ تلقائياً.** أي تبنّ يحتاج موافقتك الصريحة + تحديث SSOT أولاً.

---

## 1. مرجع المقارنة (ماذا تمكّنا من قراءته)

| المنصّة | الحالة | ملاحظة |
|---|---|---|
| https://bitsgap.com/ | تمّت القراءة | GRID/DCA/BTD/LOOP/COMBO/QFL bots · TP/SL · Smart Take Profit · Demo + Backtesting · ROI/24h dashboard · AI tips |
| https://goodcrypto.app/solana-trading-bot/ | تمّت القراءة | Grid/DCA/Sniper bots · TP/SL + trailing · MPC non-custodial wallet · DEX screener · onboarding 3 خطوات («coming soon») |
| https://soltradingbot.com/ | **تعذّر (HTTP 403)** | محجوب آلياً؛ لم نقرأ المحتوى — لم نخترع له ميزات |
| https://gmgn.ai/?chain=sol | **تعذّر (HTTP 403)** | محجوب آلياً؛ لم نقرأ المحتوى |
| https://trojan.com/blog/best-solana-trading-terminal-2026-comparison | **تعذّر (HTTP 403)** | محجوب آلياً؛ لم نقرأ المحتوى |

> الأفكار أدناه المنسوبة لـ «نمط شائع في طرفيّات سولانا» مستخلصة كـ **مفاهيم فئوية معروفة**، لا كنسخ من صفحات لم نتمكّن من قراءتها. لم نَنسخ نصّاً/كوداً/علامة من أي موقع، ولم نُضِف أي نداء لأي منصّة خارجية.

---

## 2. ما هو موجود أصلاً وأفضل من المرجع (تغيير: لا شيء)

| فكرة المرجع | يقابلها في تطبيقك (SSOT) | لماذا تطبيقك أصرم |
|---|---|---|
| فحص honeypot / mint authority / freeze | `candidate_token_safety_reason` (mint_authority_active · freeze_authority_active · transfer_hook_active · …) + مكوّنا `token2022_extension_risk`/`token_authority_risk` | بآلية **veto** على الجاهزية + fail-safe على الامتداد غير المعروف (يُرفض لا يُفترض آمناً) |
| كشف تركّز كبار المالكين / rug | `candidate_token_concentration_dimension` (holder_concentration · top_holder_risk · creator_dump_behavior · bundled_wallets) | يغذّي veto الجاهزية؛ تركّز المنشئ/العنقود ليس طلباً طبيعياً |
| كشف pump صناعي / wash | `candidate_pump_classification` + `candidate_fake_profit_*` | الربح الظاهري لا يرفع copyability حتى تُخصَم مخاطر الزيف |
| TP / SL | `take_profit_pct` · `stop_loss_pct` | SL **لا يضمن الخروج** في السيولة الرقيقة (صريح)، يمرّ عبر Exit Feasibility |
| إعدادات الانزلاق / رسوم الأولوية | `max_entry_slippage_vs_leader` · `candidate_priority_fee` · `candidate_jito_tip` | محكومة، ضمن CostPipeline، وداخل P&L الواقعي |
| مكافحة MEV | Jito bundle + `WHIPSAW_OR_MEV_LIKE` flag | يخفض copyability ويمنع re-entry فوري |
| أوضاع النسخ | `follow_entry_user_exit` (افتراضي آمن) · `full_mirror` (Advanced-only، تفعيل صريح) | الافتراضي الآمن، و full_mirror ليس default ضمنيّاً |
| Backtest / Demo | Calibration & Backtest (Stage 15) + Paper Execution (Stage 14) | point-in-time · survivorship-free · TOCTOU-proof |
| محفظة non-custodial | Custody / Execution-Wallet Lifecycle + Isolated SIGN-ONLY signer | المفاتيح لا تُعرض/تُخزَّن/تُصدَّر؛ توقيع معزول لكل نداء |

**القرار:** تبقى كما هي. سُجِّلت المقارنة، لم يتغيّر شيء.

---

## 3. مقترحات Category C (موافقة المالك + تحديث SSOT أولاً — لا تنفيذ تلقائي)

> لكل مقترح: الفكرة · المُلهِم · الفائدة · الخطر · أثر SSOT · تقدير الجهد.

### C-1 — سلالم TP/SL متدرّجة (laddered/partial take-profit)
- **الفكرة:** خروج جزئي على مستويات ربح متعدّدة (مثلاً 25% عند ×2، 25% عند ×3) بدل هدف واحد.
- **المُلهِم:** Bitsgap (Smart Take Profit) · نمط شائع في طرفيّات سولانا.
- **الفائدة:** تثبيت ربح تدريجي وتقليل ندم التوقيت.
- **الخطر:** يضاعف نوايا الخروج؛ يجب أن يبقى كلٌّ منها تحت Exit Feasibility وidempotency؛ لا يضمن الخروج في السيولة الرقيقة.
- **أثر SSOT:** يتطلّب حقل سياسة جديد (`candidate_*` tp_ladder) عبر ARCH→SSOT→CONFIG؛ يبني على `take_profit_pct` و preview→request per-position الموجود.
- **الجهد:** متوسط (سياسة + اختبارات + UI إعداد). **يبقى محاكى حتى تُحلّ حدود المالك.**

### C-2 — أزرار إعداد مسبقة للانزلاق/رسوم الأولوية (slippage / priority-fee presets)
- **الفكرة:** أزرار «محافظ / متوازن / عدواني» تملأ قيم انزلاق ورسوم أولوية موجودة أصلاً.
- **المُلهِم:** نمط شائع (GMGN/Trojan فئوياً) · Bitsgap.
- **الفائدة:** أسرع وأوضح لمشغّل غير مبرمج؛ لا سلوك جديد.
- **الخطر:** منخفض جداً — مجرّد تعبئة حقول قائمة. **يجب أن تبقى محايدة/OFF حتى يختار المالك** (أقرب لـ Category B لو طُبِّقت كأزرار خاملة).
- **أثر SSOT:** لا حقول جديدة (تستهلك `max_entry_slippage_vs_leader`/`candidate_priority_fee`/`candidate_jito_tip`)؛ مجرّد عرض إعداد.
- **الجهد:** منخفض. *ملاحظة:* لم تُطبَّق هذه الجولة لإبقاء الواجهة read-only/simulated صرفة؛ متروكة كمقترح مُفعَّل عند ربط الإعدادات الحيّة.

### C-3 — لوحة فحص أمان رمز موحّدة قبل القبول (token safety pre-check panel)
- **الفكرة:** بطاقة تجمع كل إشارات الأمان الموجودة (authority · extensions · concentration · pump) بإشارة ضوئية واحدة في Radar/Workspace.
- **المُلهِم:** GMGN/Trojan (فئوياً) لوحات فحص الرمز.
- **الفائدة:** قرار أوضح للمشغّل دون إخفاء أي تحذير.
- **الخطر:** منخفض إن بقيت **عرضاً** للـ veto القائم ولم تصبح بديلاً عنه؛ ممنوع أن تُسكِت أي تحذير أمني.
- **أثر SSOT:** لا حقول جديدة (تجميع عرضي لـ G16/G37/G38 القائمة)؛ غالباً Category A عند التطبيق على الواجهة.
- **الجهد:** منخفض–متوسط (عرض فقط).

### C-4 — تتبّع محفظة بتدفّق مباشر + إشعار صفقة القائد (live wallet activity feed)
- **الفكرة:** تدفّق زمني لحركة المحافظ المتبوعة مع إشعار فوري عند صفقة قائد.
- **المُلهِم:** نمط wallet-tracker شائع (GMGN/Trojan فئوياً).
- **الفائدة:** وعي أسرع بإشارات النسخ.
- **الخطر:** يتطلّب بيانات حيّة (مزوّد بمرجع) — خارج النطاق الحالي read-only؛ يجب أن يبقى عرضاً لا أمر تنفيذ (لا تدفّق Radar→تنفيذ).
- **أثر SSOT:** يستهلك `candidate_trade_event`/`copy_event`/Live-Stream Boundary القائمة؛ غالباً لا حقول جديدة، لكن يحتاج تفعيل البث الحيّ (مدخل مالك + قرار حوكمة).
- **الجهد:** متوسط–مرتفع (يعتمد على تفعيل البيانات الحيّة).

### C-5 — استراتيجيات مستقلّة (DCA / Grid / Sniper autonomous)
- **الفكرة:** بوتات تداول مستقلّة عن نسخ المحافظ (شراء دوري/شبكي/قنص).
- **المُلهِم:** Bitsgap (GRID/DCA/COMBO) · GoodCrypto (Sniper).
- **الفائدة:** تنويع أنماط الكسب.
- **الخطر:** **عالٍ ومتعارض مع فلسفة المشروع.** التطبيق صراحةً **wallet/cluster/signal-led**؛ «اكتشاف mint وحده ليس إشارة شراء» و«لا discovery-only execution mode». هذه الاستراتيجيات تخلق سلطة تنفيذ مستقلّة عن إشارة المحفظة.
- **أثر SSOT:** **جوهري** — يخالف القواعد الحاكمة الحالية؛ يحتاج قرار معماري صريح في `00-ARCHITECTURE` قبل أي SSOT.
- **الجهد:** مرتفع جداً. **توصية: رفض/تأجيل** ما لم يقرّر المالك تغيير فلسفة المنتج عبر الحوكمة.

### C-6 — مساعد ضبط استرشادي (AI tuning hints) للإعدادات Paper
- **الفكرة:** اقتراحات استرشادية لأفضل إعدادات Paper بناءً على نتائج المحاكاة/المعايرة.
- **المُلهِم:** Bitsgap (AI Assistant tips).
- **الفائدة:** يسرّع تعلّم المشغّل.
- **الخطر:** منخفض إن بقي **advisory/Paper-only** ولا يطبّق config تلقائياً (يتّسق مع `candidate_best_paper_settings_advisory` القائم — advisory لا auto-apply، لا live promotion بلا gates).
- **أثر SSOT:** يبني على `candidate_best_paper_settings_advisory`/`candidate_recommendation_*` القائمة؛ غالباً لا حقول جديدة.
- **الجهد:** متوسط. **يبقى Paper-only و advisory.**

---

## 3‑bis. مقارنة GMGN الحيّة (2026-06-12، عبر Claude-in-Chrome)

تصفّحنا فعلياً صفحة محفظة على **GMGN** (`gmgn.ai/sol/address/…`) ومقابلها واجهة A الحيّة.

**طُبِّق فوراً (آمن، قراءة فقط — ليس Category C):**
- **محلّل تاريخ المحفظة** (`wallet-analyzer.mjs` + زر «🔍 تحليل» في Wallet Intelligence): يجلب تاريخ المحفظة on-chain ويحسب win rate / realized PnL (FIFO, SOL) / توزيع نتائج الصفقات / متوسط الاحتفاظ / إشارات بوت (buy-sell خلال 5ث، sold>bought). **مُتحقَّق مقابل GMGN: win rate لدينا 66.7–69.2% مقابل 69.45% لـ GMGN على نفس المحفظة.** read-only، يخرِّط مفاهيم G30/G37/G38 القائمة.

**Category C من GMGN (مقترحات — لم تُنفَّذ، تحتاج موافقة + SSOT):**

### C-7 — توزيع متوسط Market Cap عند الشراء (Avg Buy MC distribution)
- **الفكرة:** GMGN يعرض في أي نطاق MC تشتري المحفظة ($0–100k / $100k–500k / >$500k).
- **الفائدة:** يكشف هل القائد يصطاد عملات دقيقة جداً (خطر) أم أنضج.
- **الخطر:** منخفض (قراءة)، لكن يحتاج جلب MC لكل توكن وقت الصفقة (بيانات إضافية).
- **النوع:** [شكل/بيانات] — قابل للإضافة لاحقاً للمحلّل.

### C-8 — تاريخ أعمق + نطاقات زمنية (1D/7D/30D/All)
- **الفكرة:** GMGN يحسب على نوافذ زمنية ويعرض تقويم PnL يومي. محلّلنا حالياً يمسح آخر ~75 معاملة فقط.
- **الفائدة:** قراءة أدقّ وأطول.
- **الخطر:** يضاعف نداءات RPC (تكلفة credits) — يحتاج paging محكوم وتخزين.
- **النوع:** [بيانات] — توسعة للمحلّل.

### C-9 — أعلاف اكتشاف (Trenches/Trending) + متتبّعات اجتماعية (X/Telegram)
- **الفكرة:** GMGN يعرض عملات رائجة ومتتبّع تويتر/تيليجرام مرتبط بالمحافظ.
- **الخطر:** **عالٍ على الفلسفة** — اكتشاف-فقط يقترب من «mint discovery كإشارة»، وهو ممنوع في معماريّتك (wallet/cluster/signal-led). أي تنفيذ من هذه الأعلاف مرفوض.
- **النوع:** [سلوك] — للعرض الاسترشادي فقط إن نُفّذ، بلا أي مسار تنفيذ.

### C-10 — زر «Wallet Copy» يضبط النسخ تلقائياً
- **الفكرة:** GMGN ينسخ بضغطة مع إعداداته.
- **الحالة عندك:** موجود فعلاً لكن **بقصد**: تسجيل + متابعة + بوّابات. لا حاجة لنسخ سلوك «الضغطة الصامتة» — تأكيدك حماية لك.
- **النوع:** [سلوك] — لا يُنفَّذ (يضعف بوّابة).

## 4. الحدود الصارمة المطبَّقة في هذه الجولة

- استخلصنا **مفاهيم وأنماطاً فقط**؛ لم نَنسخ نصّاً/كوداً/علامة/أصولاً من أي موقع.
- لم نُضِف أي نداء لتلك المنصّات أو لأي API/تتبّع خارجي إلى التطبيق.
- **لم تُضعِف أي فكرة benchmark أي بوّابة أو حدّ أو قاعدة أمان قائمة.**
- ما هو موجود وأفضل من المرجع بقي كما هو (§2).
- **لم يُطبَّق أي مقترح Category C تلقائياً.** كلها بانتظار موافقة المالك + تحديث SSOT.
