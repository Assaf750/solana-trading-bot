# Threat & Security

> **Priority:** 09 — Implementation · **Part of:** Solana Copy-Trading Engine · **Governed by:** `CLAUDE.md` + `01-SSOT.md` (No field before SSOT) · **Owner role:** حضانة المفاتيح وعزل التوقيع ونموذج التهديد

**الحالة:** معتمدة / موسّعة بعد v1.8 Delta + F-Elimination + Waves 1–5 — الأقسام 0–11 مكتملة ومراجعة. §8 (T8) أُعيد تأطيره كتسرّب الأسماء المرفوضة دائماً؛ §9 ضوابط v1.8؛ §10 ضوابط أمان F-Elimination (F1–F14 + provider/Opportunity/charts + [F] cleanup) فوق SSOT Groups 22–36؛ **§11 Waves 1–5 Security Alignment (تثبيت أمني فقط، تستهلك ARCH §15.9–§15.13 + SSOT Groups 37–41، Cross-Document Audit PASS لكل موجة) دون implementation/commands.**

**مبني على:** الوثائق المقبولة لهذه الموجة: 00 · 01 · 02 · 03 · 04 · 05 · 07، مع موجة v1.8 New-Coin Hunting / Opportunity API. يفصّل الأثر الأمني ولا يقرّر fields أو API جديداً. **يفصّل الضوابط الأمنية المقرَّرة في §4.3 وBuild Spec، ولا يقرّر سلوكاً أو حقولاً أو API جديداً.**

> **ملاحظة حاكمة:** **لا REAL-LIVE ولا `isolated_signer` حقيقي قبل اكتمال هذه الوثيقة** (§4.3 · Build §4 gate). 09 يحسم شروط الأمان العميقة التي تجعل SignerService صالحاً للاستخدام الحقيقي.

---

## 0. Threat/Security Preflight — Detail, Don't Redecide (محسوم)

09 **يفصّل قرارات الأمان المقرَّرة، لا يخترعها.**

| النوع | المالك | مثال |
|---|---|---|
| قرار أمني معماري | **§4.3** (مقرَّر) | لا مفتاح في الواجهة/DB · التوقيع عبر signer معزول · لا REAL-LIVE قبل Key Management |
| تفصيل تنفيذ الأمان | **09 وحده** | *كيف* يُعزَل SignerService · مواقع الأسرار المسموحة/الممنوعة · سلوك revoke · حدود KMS |

**قاعدة:** أي اسم/حقل جديد يمرّ عبر ARCHITECTURE→SSOT أولاً. 09 يضيف **سياسات/حدود أمان** لا fields. لا يعيد تعريف API/Data Model/Build.

> **نتيجة preflight:** العزل ومنع المفاتيح في الواجهة/DB **محسومان في §4.3**؛ 09 يفصّل آليتهما. صلاحيات revoke (`revoke_signer_profile`/`revoke_execution_wallet` تحت `signer_control`) محسومة في API §12؛ 09 يفصّل سلوكها الأمني.

---

## 1. Scope & Ownership (النطاق والملكية)

**09 يملك (حصراً):**
- `key custody` — حضانة المفاتيح وأين تُخزَّن وكيف.
- `signer isolation` — نموذج عزل SignerService.
- `allowed / forbidden secret locations` — مواقع الأسرار المسموحة والممنوعة.
- `connected_wallet vs isolated_signer security rules`.
- `signer revoke/disable behavior` — السلوك الأمني (تفصيل §API 12).
- `KMS / secret vault boundaries`.
- `dev/test/live secret handling`.
- `threat model` للـ API/UI/hot path/signer.

**09 لا يملك:**
- `إعادة تعريف API` (Doc 03) · `إعادة تعريف Data Model` (Doc 05) · `تغيير Build services` (Doc 06) · `إضافة أسماء SSOT بلا ARCHITECTURE→SSOT` · `تنفيذ كود`.

**القاعدة الحاكمة:**
> 09 يفصّل أمن القرارات المغلقة (§4.3/§12/Build). لا يعيد فتحها. حقل/اسم جديد → ARCHITECTURE→SSOT أولاً.

---

## 2. Key Custody & Signing Boundary (حضانة المفاتيح وحدّ التوقيع)

**المبدأ الأساسي (من §4.3، مُفصَّل هنا):**
- **لا private key في الواجهة. لا seed phrase في قاعدة البيانات. لا توقيع من الواجهة.** التوقيع حصراً داخل SignerService معزول.

**مواقع الأسرار — مسموح/ممنوع:**
- **ممنوع منعاً باتّاً:** private key أو seed في الواجهة · في PostgreSQL/ClickHouse/Redis (Doc 05 ثبّت ذلك) · في `.env` للـ live · في logs/audit · في رسائل الـ stream · في أي shared cache.
- **مسموح:** المادة الحسّاسة للتوقيع **داخل SignerService isolated memory فقط**؛ مرجع آمن (`signer_profile_id`) في `signer_profiles` (Doc 05 §4.8) دون المفتاح نفسه؛ أسرار عبر KMS/secret vault بحدود §4.

**حدّ التوقيع:**
- كل توقيع يمرّ عبر SignerService؛ لا خدمة أخرى تملك مادة توقيع.
- Risk Gates قبل SignerService (Build §3): **لا توقيع صفقة دون موافقة المخاطر**.
- التوقيع يُربَط بـ `execution_wallet_id` + `signer_profile_id` صالحين (§API 12.6)؛ signer غير `ACTIVE` → لا توقيع.

**dev vs live:**
- **dev:** mock/test signer أو test key معزول فقط (Build §5). لا مفتاح حقيقي.
- **live:** `isolated_signer` حقيقي عبر KMS/secret vault، بعد اكتمال 09 وREAL-LIVE readiness.

**connected_wallet (حدّ أمني):** التدفّق اليدوي `connected_wallet` **لا يخزّن مفاتيح ولا يمرّ عبر SignerService.** التوقيع يتمّ داخل محفظة المستخدم (Phantom/Solflare) بموافقته، ويُسمح به فقط لمسارات manual approval/test — **لا يُستخدم في الـ hot path الآلي ولا REAL-LIVE الآلي** (SignerService لا يدير Phantom ولا يأخذ seed من connected wallet).

---

## 3. SignerService Isolation Model (نموذج عزل SignerService)

**العزل (تفصيل §4.3 وBuild §3):**
- SignerService **process/container منفصل**؛ لا يشارك ذاكرة مع API/UI/hot path.
- المفاتيح **لا تخرج من SignerService memory**؛ الخدمات الأخرى ترسل طلب توقيع وتستقبل توقيعاً، لا مفتاحاً.
- واجهة SignerService محدودة: طلب توقيع لـ intent محدّد (بـ `intent_id` + `execution_wallet_id` + `signer_profile_id`)، استجابة موقّعة أو رفض. لا واجهة لاستخراج/تصدير المفاتيح.
- **أي طلب توقيع بلا `intent_id` مرفوض.** لا توقيع ad-hoc خارج IntentLedger؛ كل توقيع يرتبط بـ `intent_id` + `execution_wallet_id` + `signer_profile_id` + Audit trail.
- **Audit قبل/بعد التوقيع:** كل signing request يُسجَّل في Audit قبل المحاولة وبعدها (`audit_actor`/`command_type`/`intent_id`/`execution_wallet_id`/`signer_profile_id`/النتيجة/الخطأ). **لا مسار توقيع صامت.**

**التحقّق عند التوقيع (لا يكفي cache):**
- SignerService/OrderBuilder يعيد التحقّق من `execution_wallet_status = ACTIVE` و`signer_profile_status = ACTIVE` وبوابات الأمان **عند البناء/التوقيع** (Doc 05 §5.4/§7.7 — cache أهلية بائت لا يوقّع).
- موافقة Risk Gates شرط مسبق؛ لا توقيع دون تمريرها.
- **SignerService لا يملك Risk Gates ولا يعيد حساب الاستراتيجية.** يتحقّق من وجود approval/authorization موثّق من Risk Gates/Execution path، ومن أن `execution_wallet_status`/`signer_profile_status` ما زالا صالحين لحظة التوقيع. **منطق المخاطر يبقى في Risk Gates** (لا تكرار له داخل signer، ولا توقيع بلا موافقته).
- **SignerService لا يبني order ولا يختار route ولا يقرّر amount/slippage/fees/tip.** بناء المعاملة ومسار التنفيذ مسؤولية Execution Adapter/OrderBuilder بعد Risk Gates. **SignerService يوقّع payload مسموحاً به فقط، أو يرفض** (صندوق توقيع لا OrderBuilder ثانٍ).
- **لا generic sign-arbitrary-bytes endpoint للتداول.** كل طلب توقيع يرجع إلى `intent_id` قائم + `execution_wallet_id` + `signer_profile_id` + نتيجة Risk Gates موافَق عليها + payload منتَج من OrderBuilder. أي عدم تطابق payload أو غياب ربط intent أو موافقة بائتة → رفض.
- **ربط الـ payload (payload binding):** SignerService يرفض أي payload لا يطابق الـ intent المعتمد ومسار OrderBuilder وموافقة Risk. عناصر مثل transaction fingerprint/canonical payload digest تُربَط بـ `intent_id` قبل التوقيع. **أي اختلاف في route/amount/slippage/fee/tip/blockhash policy بعد موافقة Risk يتطلّب إعادة بناء وموافقة Risk جديدة** (يمنع payload substitution). (digest/fingerprint مفهوم تنفيذي/أمني، لا حقل SSOT ما لم يظهر في API/Data Model.)
- **حداثة الموافقة (approval freshness):** موافقة Risk Gates لها عمر/صلاحية محدودة مرتبطة بـ intent/blockhash/route freshness. **SignerService يرفض توقيع موافقة بائتة أو منتهية أو مبنية على route/quote/fee/tip بائت** (Solana blockhash/route يتغيّر بسرعة؛ توقيع موافقة قديمة خطر). القيمة الرقمية للـ TTL تُحدَّد في Build/Runbook، لا هنا.

**revoke/disable (سلوك أمني، تفصيل §API 12.2):**
- `revoke_signer_profile` (`signer_control`) → `signer_profile_status = REVOKED`: المفتاح مسحوب نهائياً، المحافظ المرتبطة **غير مؤهّلة فوراً** للدخول الجديد.
- `disable_signer_profile` → `DISABLED`/`DEGRADED`: تعطيل مؤقّت، المحافظ المرتبطة غير مؤهّلة حتى تُعاد لـ signer `ACTIVE`.
- كل revoke/disable يدخل Audit دائماً (`audit_actor`/`audit_reason`).
- revoke لا يُلغي توقيعاً تمّ فعلاً on-chain (نهائية السلسلة)؛ يمنع التوقيعات اللاحقة فقط.

> **مبدأ §3:** SignerService صندوق معزول — يدخله طلب توقيع مُوافَق عليه من Risk Gates لـ intent/wallet/signer صالح، ويخرج منه توقيع. لا تخرج المفاتيح، ولا يوقّع دون تحقّق حيّ، ولا يُستخدم signer مسحوب/معطّل. هذا حارس REAL-LIVE الأساسي.

---

## 4. KMS / Secret Vault Boundary (حدّ إدارة المفاتيح والأسرار)

> العلاقة بين SignerService وKMS/secret vault، **دون اختيار vendor نهائي مبكراً** (الحدّ المعماري لا المنتج).

**المبادئ:**
- **KMS/secret vault مصدر حضانة السرّ في live.** المفتاح/المادة الحسّاسة تُحفظ هناك، لا في الكود ولا الـ repo.
- **SignerService لا يخزّن السرّ دائماً على disk.** يحمّله ضمن عملية مقيّدة عند الحاجة في memory معزولة، لا persistence على قرص بنصّ صريح.
- **لا secret plaintext في logs/env/db/cache** (تأكيد §2 لكل الطبقات).
- **تحميل/استخدام المفتاح عبر عملية مقيّدة ومراجَعة** — وصول محدود، مُدقّق، بأقلّ صلاحية.
- **فشل KMS/secret vault → `signer_profile_status = DEGRADED` أو منع التوقيع** (Fail Safe: لا توقيع على حضانة غير مؤكّدة). **`DEGRADED` حالة غير مؤهّلة للتوقيع الحيّ — تُعرض للتشخيص فقط، ولا توقّع ولا تسمح بدخول جديد حتى تعود `ACTIVE`.**
- **revocation تمنع أي استخدام لاحق للسرّ** (متّسق مع `revoke_signer_profile` §API 12.2 / §3).
- **صلاحية أقل (least-privilege):** SignerService يستخدم **فقط** مادة التوقيع المرتبطة بـ `signer_profile_id` المطلوب؛ **لا يسرد/يصدّر كل المفاتيح، لا يعدّد أسراراً غير ذات صلة، لا يصل لأسرار signer profiles معطّلة/مسحوبة** (اختراق جزئي لا يمنح نطاق مفاتيح أوسع).
- **تصفير الذاكرة (zeroization):** مادة التوقيع في ذاكرة SignerService **تُصفَّر عند revoke/shutdown/panic path حيثما أمكن، وبعد الاستخدام إن سمح نمط الحضانة**. **تُمنع core dumps وdebug dumps وmemory verbose logging لـ SignerService في live mode** («لا تخزين على disk» لا يكفي إن سرّبت الـ dumps السرّ).

**الحدّ:**
- KMS/secret vault طبقة حضانة؛ SignerService طبقة توقيع. لا تخلط: الـ vault يحفظ/يصدر وصولاً مقيّداً، وSignerService يوقّع داخل عزله. لا يخرج السرّ بنصّ صريح إلى أي طبقة أخرى.
- اختيار vendor (HSM/cloud KMS/secret vault) هو parameter تنفيذي/تشغيلي داخل هذا الحدّ، ولا يغيّر المبادئ أعلاه. أي اختيار vendor يجب أن يحافظ على: no plaintext secrets · least privilege · revoke · no live key in `.env` · SignerService boundary.

> **مبدأ §4:** الحضانة (KMS/vault) منفصلة عن التوقيع (SignerService)، وكلاهما منفصل عن باقي النظام. السرّ لا يُكتب بنصّ صريح في أي مكان دائم، وفشل الحضانة يمنع التوقيع لا يتجاوزه. هذا يكمل حارس REAL-LIVE: لا توقيع حيّ دون حضانة مؤكّدة معزولة.

---

## 5. Threat Model — Attack Surfaces (نموذج التهديد حسب السطح)

سطوح الهجوم وضوابطها (تجميع لما تقرّر عبر الوثائق + ضوابط §2–4):

### 5.1 UI / Dashboard
- لا يطلب/يعرض private key أو seed. `connected_wallet` يدوي فقط (§2). لا local computation لحقائق الأمان (الحقيقة من API، Doc 04). لا عرض أسرار.

### 5.2 Management API
- فرض الصلاحيات (`permission_role`)؛ `signer_control` منفصل عن admin. لا bypass لـ Risk Gates. **لا endpoint يوقّع مباشرة** (التوقيع عبر SignerService فقط).

### 5.3 Hot Path / Stream / Decision
- cache بائت لا يوقّع (Doc 05 §5/§7). Risk Gates إلزامية. stream poisoning / provider lag / فجوة → لا يفتح entries؛ يفعّل EXITS_ONLY (Doc 05 §5.2 · ARCHITECTURE §15).

### 5.4 Execution Adapter / OrderBuilder
- لا بناء order بلا `intent_id`. لا إرسال بلا موافقة Risk. route/amount/slippage/fees من OrderBuilder لا SignerService (§3). idempotency تمنع التكرار.

### 5.5 SignerService
- no generic sign-arbitrary-bytes (§3). no key export. لا توقيع لـ `DEGRADED`/`DISABLED`/`REVOKED` (§3–4). Audit لكل محاولة توقيع. zeroization عند revoke/shutdown/panic (§4).

### 5.6 KMS / Secret Vault
- least-privilege (§4). لا تسريب plaintext. fail closed (فشل → DEGRADED/منع). revoke يمنع الاستخدام اللاحق.

### 5.7 Database / Redis / ClickHouse
- لا أسرار في PostgreSQL/ClickHouse/Redis (Doc 05 · §2). Audit append-only (Doc 05 §4.5). **Redis cache لا يخوّل توقيعاً** (eligibility بائت لا يوقّع، Doc 05 §7.7).

### 5.8 Operator / Permission
- `signer_control` منفصل عن admin (§API 3). revoke/disable مُدقّق دائماً. لا تصعيد صلاحية صامت. الأوامر الحرجة (kill switch/revoke/REAL-LIVE) بصلاحية مشدّدة + تأكيد.
- **اختراق operator/admin:** حتى لو اختُرقت صلاحية admin، **لا تكفي وحدها للتوقيع أو استخراج المفاتيح**؛ الأوامر الحرجة تحتاج `signer_control` + Risk Gates + Audit + admission state. أي محاولة تصعيد أو revoke/enable/signing-sensitive action تُسجَّل وتُعرض كحادثة أمنية. (فصل admin عن `signer_control` حاجز عند اختراق المشغّل، لا تجميل.)

### 5.9 Dependency / Supply Chain
- لا مكتبات signing/wallet/RPC غير مثبتة بلا مراجعة. lockfiles وإصدارات pinned (Rust/TypeScript/Python). container images pinned/versioned. أي تحديث dependency يمسّ signing/execution/RPC يحتاج مراجعة أمنية + regression test. لا build من مصدر مجهول ولا install scripts غير موثوقة داخل بيئة signer.

### 5.10 Logging / Telemetry Leakage
- logs/metrics/traces **لا تحتوي private keys/seed/plaintext secrets ولا signed raw payloads غير ضرورية.** أي transaction payload/signature/wallet address يُسجَّل بالحدّ الأدنى للتدقيق مع redaction حيث يلزم. **Debug logging ممنوع في live للـ signer/execution** (تمنع التسريب الزائد لا كل observability).

### 5.11 New-Coin Hunting / Opportunity & Radar Surface
- مورد/feed الفرص **read-only لا يخوّل تنفيذاً**؛ الرادار/الترتيب **عرض لا إشارة شراء**؛ cache/projection بائت لا يخوّل (Doc 05 §6/§7). تفاصيل التهديدات والضوابط في §8.

> **مبدأ §5:** كل سطح له ضوابط مأخوذة من القرارات المغلقة — لا ضابط جديد، بل تجميع دفاعي. الخيط الجامع: **الأمان غير قابل للتجاوز عبر أي سطح** (لا UI يحسب أمناً، لا API يوقّع، لا cache يخوّل، لا signer يبني/يصدّر، لا secret يتسرّب). دفاع متعدّد الطبقات حول حارس REAL-LIVE.

---

## 6. Dev / Test / Live Secret Handling (التعامل مع الأسرار عبر البيئات)

### 6.1 Development
- mock signer أو test key معزول فقط. **لا live private key في `.env` · لا seed phrase · لا `isolated_signer` حقيقي.** أسرار وهمية/اختبار آمنة فقط (Build §5).
- **أي test key في dev يجب أن يكون disposable، محدود الرصيد، غير مرتبط بأي live wallet، وغير قابل لإعادة استخدامه في test/staging أو live.** mock signer هو الافتراضي؛ test key يُستخدم فقط عند الحاجة لاختبار توقيع محلي معزول (منع عادة وضع مفاتيح حقيقية في dev).

### 6.2 Test / Staging
- test keys معزولة، **لا مشاركة مفاتيح مع live.** test vault/KMS منفصل عن live. reset/revoke ممكن بلا أثر على live.
- **يستخدم testnet/devnet أو sandbox مضبوط فقط؛ لا يشغّل REAL-LIVE mainnet signing آلياً.** أي تفاعل mainnet في staging يتطلّب موافقة مشغّل صريحة ويبقى يدوياً/غير آلي ما لم تُستوفَ كامل live readiness (منع تحوّل staging إلى «live مصغّر» بلا ضبط).

### 6.3 Live / REAL-LIVE
- `isolated_signer` فقط. KMS/secret vault إلزامي. **no plaintext key on disk · no `.env` live secret.** `signer_control` + REAL-LIVE readiness مطلوبان. `DEGRADED`/`DISABLED`/`REVOKED` لا يوقّع.

### 6.4 Secret Handling Matrix

| environment | allowed signer mode | allowed secret source | forbidden | live trading? |
|---|---|---|---|---|
| Development | mock / test signer | test/fake secrets معزولة | live key · seed · real isolated_signer · `.env` live secret | لا |
| Test / Staging | test signer (isolated test keys) | test vault/KMS منفصل | مشاركة مفاتيح live · أسرار live | لا (test فقط) |
| Live / REAL-LIVE | `isolated_signer` فقط | KMS/secret vault | plaintext key on disk · `.env` secret · connected_wallet للآلي | نعم — بعد readiness + signer_control |

> **مبدأ §6:** فصل صارم بين البيئات — لا مفتاح live يلمس dev/test، ولا مفتاح dev/test يخوّل live trading. الانتقال إلى live يتطلّب `isolated_signer` + KMS + readiness + `signer_control`، ولا يحدث بمفاتيح اختبار أو أسرار `.env`. هذا يكمل حدّ «لا REAL-LIVE قبل Key Management».

---

## 7. REAL-LIVE Security Readiness Checklist (قائمة جاهزية الأمان للتنفيذ الحيّ)

> **gate نهائي.** التنفيذ الحيّ لا يبدأ إلا باستيفاء كل البنود. يربط ضوابط 09 بـ §15.1 وREAL-LIVE readiness و`real_live_config_valid`.

**7.1 Key custody readiness:** KMS/secret vault مهيّأ · لا live key في `.env` · لا plaintext key على disk · least privilege متحقّق · revocation مُختبَر · سياسة zeroization/crash-dump فعّالة.

**7.2 SignerService readiness:** process/container معزول · لا generic sign endpoint · لا توقيع بلا `intent_id` · payload binding مفروض · approval freshness مفروضة · لا بناء معاملات داخل SignerService.

**7.3 Risk/approval readiness:** Risk Gates إلزامية قبل التوقيع · الموافقة لا تكون بائتة · Hard Risk لا يُتجاوز · `warning_only` لا يعطّل حدود الخسارة.

**7.4 Execution wallet readiness:** `execution_wallet_status = ACTIVE` فقط بعد admission · `signer_profile_status = ACTIVE` · `DEGRADED`/`DISABLED`/`REVOKED` لا يوقّع · `WARMING_UP` لا يوقّع.

**7.5 Environment readiness:** البيئة = live فقط · مفاتيح test/staging غائبة · `connected_wallet` غير مستخدم للآلي الحيّ · KMS/vault live profile منفصل عن test.

**7.6 Audit/observability readiness:** Audit قبل/بعد التوقيع · revoke/disable مُدقّق · لا secret في logs/traces · أحداث الأمان مرئية.

**7.7 Operator permission readiness:** `signer_control` منفصل عن admin · الأوامر الحرجة تتطلّب تأكيداً · admin مخترَق وحده لا يوقّع/يستخرج/يُبطل صامتاً.

**7.8 Explicit blockers — يُمنع REAL-LIVE إذا:** Document 09 غير مكتمل · جاهزية signer غير معروفة · KMS degraded · `signer_profile_status` ليس ACTIVE · `execution_wallet_status` ليس ACTIVE · موافقة Risk بائتة/مفقودة · payload digest mismatch · مسار كتابة Audit غير متاح · live key مكتشَف في `.env`/log/db/cache · `connected_wallet` مختار للآلي الحيّ.

> **مبدأ §7:** هذا الحارس النهائي يجمع كل ضوابط 09 في بوّابة واحدة. **أي بند ناقص أو blocker نشط → لا REAL-LIVE** (Fail Safe Not Fail Open). يكمل `real_live_config_valid` (الذي يحرس اكتمال Hard Risk config) بحارس أمني يحرس اكتمال حضانة المفاتيح والتوقيع المعزول — لا تنفيذ حيّ دون كليهما.

---

## 8. New-Coin Hunting Threats & Controls (v1.8)

> تجميع دفاعي من قرارات مغلقة لموجة New-Coin Hunting — لا ضابط/حقل/أمر جديد. كل diagnostic هنا **read-only لا يحجب وحده**؛ أي ترقية إلى blocking gate تمرّ عبر **Architecture → SSOT → Config → Test** أولاً.

**T1 Recycled token:** مهاجم يعيد استخدام branding/symbol/سياق اجتماعي أو يطلق توكناً «معاد تدويره» لاستغلال افتراضات النسخ/الرادار. **الضوابط:** `recycled_token_flag` diagnostic/read-only، لا يوافق تنفيذاً؛ يُعرض في Token Risk Panel + Decision Trace؛ أي ترقية إلى blocking gate تمرّ عبر Architecture→SSOT→Config→Test.

**T1b Creator launch-rate / launch-farm abuse:** منشئ يطلق عدداً كبيراً من التوكنات أو يعيد تدوير أنماط إطلاق لاستدراج الرادار أو الناسخين. **الضوابط:** `creator_launch_rate_flag` diagnostic/read-only، **لا يوافق تنفيذاً ولا يحجب وحده**؛ يظهر في Token Risk / Decision Trace؛ أي ترقية إلى blocking gate تمرّ عبر Architecture→SSOT→Config→Test.

**T2 Name impersonation / spoofing:** اسم/metadata يقلّد توكناً/مشروعاً/KOL معروفاً. **الضوابط:** `name_impersonation_score` diagnostic/read-only؛ محاولات الكتابة → `READ_ONLY_FIELD_REJECTED`؛ ليس موافقة تنفيذ؛ أي ترقية إلى blocking gate تمرّ عبر Architecture→SSOT→Config→Test.

**T3 DexScreener-only misleading signal:** سطح DEX يجعل التوكن جذّاباً دون تأكيد wallet/cluster/signal. **الضوابط:** يُخرَّط إلى `rejected_reason=dex_only_signal` أو watch-only؛ لا شراء من dex-only؛ لا شراء من mint discovery؛ `resource_type=opportunity` read-only؛ محاولات التنفيذ من dex-only/`accepted`/mint → `COMMAND_NOT_ALLOWED_IN_STATE`.

**T4 Crowd-follow decay / overcrowded copy:** ازدحام ناسخين على محفظة واحدة يُضعف الـ edge ويسوّئ الـ fills. **الضوابط:** `crowd_follow_score` read-only derived؛ `new_token_priority_score` ترتيب فقط لا سلطة تنفيذ؛ `entry_slippage_vs_leader` observed diagnostic؛ الحجب يبقى عبر عتبات Config المعتمدة لا عبر diagnostics مباشرة؛ لا P&L محلي ولا ادّعاء edge؛ أي ترقية إلى blocking gate تمرّ عبر Architecture→SSOT→Config→Test.

**T5 New Coin Radar misuse (ترتيب/`accepted` كإشارة شراء):** **الضوابط:** لا buy من mint؛ لا execution من `accepted`؛ `new_token_priority_score` ترتيب فقط؛ `resource_type=opportunity` read-only؛ **لا `command_type` للفرص** (API §4/§13 + Test §4.12/§4.16).

**T6 Opportunity stream poisoning / stale reads:** stream بائت/مؤخّر/مسموم يضلّل المشغّل. **الضوابط:** المظروف يحمل `event_sequence`/`event_timestamp`/`payload_version`؛ وسوم stale/delayed/estimated في UX؛ PostgreSQL يفوز؛ ClickHouse/Redis projections لا تخوّل تنفيذاً (Doc 05 §6/§7)؛ قراءات الفرص read-only. **opportunity stream gap/stale read → resync/backfill + عرض stale/delayed؛ خرق replay/نافذة على مستوى السلسلة يبقى محكوماً بقاعدة EXITS_ONLY القائمة. الـ opportunity feed وحده لا يخوّل تنفيذاً ولا يُنشئ انتقال حالة جديداً.**

**T7 Read-only opportunity API mutation:** عميل يحاول تعديل `hunt_status`/الأسباب/الدرجات/الأعلام/الكمون/`copyability_by_brain`. **الضوابط:** → `READ_ONLY_FIELD_REJECTED`؛ audit/observability حسب السياسة القائمة؛ لا رمز خطأ جديد؛ لا تحوير derived.

**T8 rejected-name leakage:** تسرّب الأسماء **المرفوضة دائماً** كحقول حقيقية يبقى **ممنوعاً**: أسماء P&L القديمة غير المسبوقة (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`) · `current_price`/`candidate_current_price` · الأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` · `buy_opportunity`/`execute_opportunity`/`submit_opportunity`. **الضوابط:** Test §8 guard (المرفوض الدائم)؛ القدرات المُرقّاة في F-Elimination تظهر **فقط** بأسمائها `candidate_*` المسجّلة في SSOT Groups 22–36 وعبر أسطحها المخصّصة؛ القيم المفقودة تُعلَّم unavailable (لا تُختلق)؛ التصدير يحجب الأسرار. **candidate P&L مسموح فقط عبر مسار backend/data read-model المعتمد**، لا يكشف أسراراً، لا يُحسب في UX، ولا يُربط بـ Opportunity/Radar.

**T9 Honeypot-by-upgrade (transfer-hook authority weaponized mid-hold):** برنامج الـ transfer-hook قابل للترقية، فتوكن يجتاز فحص الدخول قد يتحوّل غير قابل للبيع قبل الخروج (exit-DoS / خسارة رأس مال). **الضوابط:** رفض الدخول على توكن برنامج الـ hook فيه سلطة ترقية حيّة (عبر مكوّن الجاهزية `token2022_extension_risk`، لا قيمة دخول جديدة)؛ إعادة فحص upgrade-authority/identity + sell-simulation دوري **أثناء الاحتفاظ** (Position Monitor §15.1/Pipeline 90%)؛ تغيّر الـ hook ⇒ `candidate_token_safety_reason = hook_upgraded_mid_hold` ومسار emergency exit (Exit Engine 100%) محكوماً بـ ownership/Hard Risk/Audit؛ الرفض النهائي يبقى `rejected_reason = token2022_dangerous_extension`. `freeze_authority`/`permanent_delegate` تبقى red flags قائمة. **لا حقل hash مستقل** — أدلّة المقارنة في Audit/provenance.

> **مبدأ §8:** ضوابط موجة الهنتنغ تفصيل أمني لقرارات مغلقة لا قرار جديد. **diagnostics تشخيصية read-only لا حواجز** (الحجب عبر Config المعتمد فقط)؛ مورد/feed الفرص **read-only لا يخوّل تنفيذاً**؛ لا شراء من mint/dex-only/`accepted`؛ الأسماء المرفوضة دائماً (Test §8) لا تتسرّب كحقول، والمُرقّى يظهر بأسمائه `candidate_*` فقط. لا `command_type`/`api_error_code`/state جديد، ولا ادّعاء أن stop loss يضمن الخروج في سيولة رقيقة، ولا كشف أسرار/مفاتيح.

---

## 9. v1.8 Delta — Security Controls (candidate)

> تستهلك SSOT Groups 22–27. لا تُضعف أي ضابط قائم؛ تمدّد قواعد الأسرار والصلاحيات.

### 9.1 Provider Key Flow
- المفاتيح في secret store/KMS فقط؛ التطبيق يستخدم **`candidate_provider_key_ref`** (مرجع). **يُمنع raw provider key في:** UI/browser state · DB tables · logs · reports · diagnostic bundles · backups · exports · API responses العادية. `test_provider_connection` يعمل عبر `key_ref` بعد التسجيل، لا raw key. تسريب raw key = حادث (يرفع incident، §5).

### 9.2 Jobs from UI
- تشغيل jobs من الواجهة **permissioned**؛ **لا يتجاوز risk/signer/secret/audit**. **research jobs ≠ execution jobs** (فصل صارم). export/import لا يحملان أسراراً.

### 9.3 Maintenance & Redaction
- `candidate_cmd_backup` بلا مفاتيح خام · `candidate_cmd_export_diagnostic_bundle` بلا أسرار (redaction إلزامي) · `candidate_cmd_purge_data` لا يحذف audit مالي · أوامر الصيانة admin/local-ops only، مع شروط المنع (pending intents/active signing).

### 9.4 P&L / Recommendations
- P&L read-model مشتق بلا أسرار؛ التقارير تخضع للـ redaction القائم (لا مفاتيح/seed/signer credentials). طبقة التوصيات **advisory** لا تعدّل strategy/risk/live تلقائياً — كل تبنٍّ يمرّ مسار config الرسمي (preview→validation→permission→audit).

### 9.5 ثوابت لا تتغيّر
- عزل SignerService · لا توقيع bytes عشوائية · intent-bound/approval-fresh/payload-bound · لا private key/seed في UI/DB/logs/reports — **كلها سارية بلا تعديل** (§2–§7).

---

## 10. F-Elimination — Security Controls (candidate, تستهلك SSOT Groups 22–36)

> threat model/boundaries/secret-handling/invariants/redaction على مستوى التوثيق — لا API contracts · لا DB schema · لا UX · لا test cases · لا runbook · لا code/migrations/live. المُرقّى = أسطح أمان candidate؛ المرفوض = حدود rejected/forbidden. لا «pending/later/مؤجل» مفتوحة.

### 10.1 P&L security (F1)
P&L من backend/data read-model فقط؛ UX/manual ليس مصدر حقيقة؛ unrealized موثوق فقط مع `candidate_mark_status=valid` (وإلا تحذير/غير متاح)؛ **لا P&L على Opportunity/Radar**؛ legacy aliases (`realized_pnl`/`unrealized_pnl`/`fees_paid`/`slippage_cost`/`net_pnl`/`fee_amount`) **rejected**؛ سجلّات P&L التاريخية finalized **لا تُعاد كتابتها صامتاً** — recalculation = artifact/report منفصل بـ provenance/generated_at.

### 10.2 Price / Mark security (F2)
لا «current price» مجهول؛ `candidate_current_mark_view` display/read-view فقط؛ كل سعر يحمل provenance/timestamp/status/confidence حيث ينطبق؛ **display-only لا يدخل قرار execution/risk/signer**؛ AMM لا يفترض order-book (quote-impact/liquidity-drain/expected-slippage)؛ `candidate_current_price` **rejected**.

### 10.3 Trade Event / Journal security (F3)
trade journal **بلا أسرار**؛ event gaps لا تُخفى؛ journal لا يبدّل/يحلّ محلّ audit (**audit = من فعل ماذا/متى/لماذا · journal = ماذا حدث للصفقة**)؛ event/journal لا يحوي raw keys/signer material/provider secrets.

### 10.4 Wallet-Token Performance / Discovery security (F4/F5)
wallet-token performance وearly-buyer/cluster/repeat إشارات تحليلية **لا تمنح execution authority**؛ cost-completeness/status/provenance تُعرض لمنع تضليل المشغّل؛ cluster احتمالي وlow-confidence ليس حقيقة؛ **لا blind ranking/copy من نتيجة ناقصة أو من cluster/early/repeat وحدها**.

### 10.5 Balances / Sweep security (F6)
`mismatch` يحجب الكنس؛ **لا كنس من غير مالك**؛ تأكيد الكنس مطلوب؛ سجلّ/audit الكنس لا يُحذف صامتاً؛ **لا raw keys/secrets في balance/sweep payloads/diagnostics/backups/exports**؛ provenance/reconciliation مطلوبة.

### 10.6 Token Identity security (F7)
mint/address canonical؛ symbol/name display/untrusted؛ `spoof_suspected` تحذير ظاهر؛ **لا execution بناءً على symbol/name**.

### 10.7 Leader Attribution security (F8)
الإسناد read-only **لا يخوّل تنفيذاً**؛ تعدّد/تعارض القادة لا يُطوى صامتاً؛ confidence/provenance مطلوبة.

### 10.8 Batch Exit security (F9)
`exit_all_positions`/`batch_exit_all_positions` **forbidden**؛ النموذج المسموح preview→request→نوايا per-position؛ request يتطلّب preview حديثاً وصالحاً؛ expired/stale → مرفوض؛ كل مركز يمرّ ownership/route/exit-feasibility/risk/signer/audit؛ **لا mass exit صامت**؛ طوارئ batch exit تبقى permissioned ومُدقَّقة.

### 10.9 Alerts security (F10)
severity منفصلة عن category؛ **security+critical لا تُسكت**؛ ack لا يخفي/يحذف الحقائق؛ التفضيلات لا تكتم التنبيهات الأمنية/المخاطرية الحرجة الإلزامية؛ alert source/category/severity تُحفَظ.

### 10.10 Reports / Exports / Diagnostics security (F11)
صيغ markdown/csv/parquet/jsonl؛ artifacts بـ provenance/generated_at؛ **لا اختلاق مقاييس**؛ strict redaction افتراضياً؛ **لا أسرار/raw provider keys/private keys/seeds/signer credentials/partial secrets في reports/exports/logs/diagnostics/backups**؛ **purge يحفظ السجلّات الحرجة (audit/مالية/trade-event)**.

### 10.11 Preferences / Glossary / Onboarding security (F12/F13/F14)
التفضيلات UI/user state **لا تعدّل strategy/risk/live/signer**؛ المسرد يربط SSOT ولا يعيد تعريفه؛ onboarding حالة/مراجع فقط — **لا raw provider key/private key/seed/signer credential/partial secret**، لا تجاوز readiness gates، ولا أوامر wallet/config خارج SSOT/API.

### 10.12 Provider Key Flow security (F15)
raw provider key عبر secret registration flow الآمن فقط؛ بعد التسجيل `candidate_provider_key_ref` فقط في payloads/UI/ops؛ **لا raw key في browser state/reports/exports/logs/diagnostics/backups**؛ test connection عبر key_ref؛ حوادث المزوّد تشير إلى provider id/key_ref/status لا raw key.

### 10.13 Opportunity / Radar security guard (F16)
Opportunity/Radar read-only/read-oriented؛ **لا P&L · `accepted` ليست buy · `new_token_priority_score` ترتيب/عرض · لا buy/execute/submit · لا ربط ضمني Opportunity→تنفيذ · DexScreener-only ليست موافقة تنفيذ**.

### 10.14 Charts security (F17)
overlays الشارت display/diagnostic ما لم تُسنَد بـ execution/trade-event/price provenance؛ OHLCV display-only يتطلّب provenance؛ AMM لا يُوحي بـ order-book حيث لا يوجد؛ **لا قرار تنفيذ من حالة شارت بصرية فقط**.

### 10.15 Legacy [F] Cleanup (security)
لا عنصر F سابق يبقى «pending»؛ المُرقّى = أسطح أمان candidate (§10.1–§10.14)؛ المرفوض = Rejected/Forbidden: legacy P&L aliases · `current_price`/`candidate_current_price` · الأمر الذرّي `exit_all_positions`/`batch_exit_all_positions` · `buy_opportunity`/`execute_opportunity`/`submit_opportunity`. لا صياغة later/مؤجل/pending مفتوحة.

---

## 11. Waves 1–5 Security Alignment (تثبيت أمني، تستهلك ARCH §15.9–§15.13 + SSOT Groups 37–41)

> **security alignment فقط — لا implementation · لا commands · لا code/migrations/live · لا حقول/enums/config defaults جديدة · لا API/Data/UX/Test/Build redefinition.** Waves 1–5 اكتملت **Cross-Document Audit PASS** كحزمة توثيقية. 09 يفصّل الأثر الأمني ولا يقرّر جديداً؛ هذا القسم يثبّت أن أسطح Waves 1–5 (خصوصاً Wave 4 Providers/Data وWave 5 Local Ops) لا تُضعِف أي ضابط قائم (§2–§10).

**11.1 لا تسرّب أسرار (يمدّد §9.1/§10.10/§10.12).** لا raw key/secret/credential/seed/signer material في: logs · exports · backups · diagnostics · browser/UI state · API payloads · report artifacts · operator logs · Local Ops health/version/upgrade artifacts. أي تسريب = حادث (§5). يشمل ذلك صراحةً أسطح Wave 5: Operator Logs · Local Ops Health · Migration/Version status · Upgrade/Rollback artifacts · Maintenance status · Implementation-Status matrix.

**11.2 Provider key reference فقط (يمدّد §9.1/§10.12).** `candidate_provider_key_ref` يبقى **reference/status فقط، لا key material**؛ Wave 4 provider onboarding/health وWave 5 provider_connectivity service status يستخدمان المرجع/الحالة لا المفتاح الخام؛ test connection عبر key_ref؛ حوادث المزوّد تشير إلى provider id/key_ref/status.

**11.3 Operator Logs redaction (يمدّد §10.10).** Operator logs **تُخفي الأسرار** إلزامياً؛ `candidate_operator_log_redaction_status=blocked_contains_secret` **يحجب display/export/artifact publication**؛ stack trace يظهر كـ technical_detail لا الرسالة الوحيدة؛ التحذيرات الأمنية/الحرجة لا تُكتم (يمدّد §10.9 alerts).

**11.4 SignerService / Local Ops boundary (يمدّد §2/§3).** SignerService `healthy`/`signer_profile_status` في Local Ops Health **ليس permission to sign** — التوقيع يبقى محكوماً بـ §2/§3 (intent-bound · approval-fresh · payload-bound · Risk Gates قبل التوقيع · re-verify عند البناء/التوقيع). **Local Ops health/status لا يتجاوز signer controls** ولا يمنح execution authority. provider connection success ليس trading readiness.

**11.5 Maintenance / Backup / Restore (يمدّد §9.3/§10.10).** أفعال الصيانة (Wave 5 policy/status labels) **لا تتجاوز permissions/audit/source-of-truth**؛ `candidate_safe_shutdown_status` يحترم pending intents/active signing/critical jobs؛ backup **بلا raw secrets**؛ restore لا يكسر audit/history/config؛ clear_cache لا يحذف source-of-truth؛ rebuild/reindex projections **لا يغيّر سلطة PostgreSQL** (PostgreSQL مصدر الحقيقة)؛ purge يحفظ السجلّات الحرجة (audit/مالية/trade-event).

**11.6 لا execution authority من التشخيص (يمدّد §8/§10).** لا execution authority من reports · provider metrics/latency/cost · health · logs · version/migration status · upgrade preflight · paper results · implementation status. documented_only/candidate ليست implemented؛ unknown/unavailable/not_verified ليست clean/ready/implemented (لا تُقرأ كاجتياز أمني).

**11.7 ثوابت لا تتغيّر (تأكيد §9.5).** عزل SignerService · لا توقيع bytes عشوائية · intent-bound/approval-fresh/payload-bound · لا private key/seed في UI/DB/logs/reports · **لا تغيير EV gate / Hard Risk / Risk Gates / SignerService** بسبب أي سطح Waves 1–5 · REAL-LIVE يبقى محكوماً بـ §7 readiness/blockers — **كلها سارية بلا تعديل**.

> **مبدأ §11:** أسطح Waves 1–5 تفصيل/عرض أمني read-only لا يُضعِف أي ضابط مغلق. لا أسرار في أي مخرَج (logs/exports/backups/diagnostics/UI/API/reports/operator-logs)؛ key reference فقط؛ signer/Local-Ops health ليس permission to sign ولا trading readiness؛ الصيانة permissioned/audited/non-authoritative على source-of-truth؛ لا execution authority من تشخيص/تقرير/حالة؛ documented_only/candidate ليست implemented. **لا implementation/commands/migrations/live · لا تغيير الحُرّاس · لا تغيير 00–07 · لا Wave 6+.**
