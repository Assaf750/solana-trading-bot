# @soltrade/decision-engine (Gate B / B6)

Decision Engine **skeleton** — يُنتج **مسوّدات قرار/توصيات فقط**، مشتقّ من `docs/00-ARCHITECTURE §4/§5` و`docs/01-SSOT G1/G2/G3/G7` و`docs/02-CONFIG §7`. **لا execution authority · لا بناء order · لا توقيع/إرسال · لا شبكة/مزوّد · لا DB · لا استدعاء execution-adapter.**

## المحتوى
- `decision-engine.mjs` / `.d.ts` — `decideDraft(ctx)` → decision draft.
- `fixtures/decision-context.json` — سياق dev.

## decision flow
1. **wallet/signal-led:** بلا `copy_event` ولا `wallet_signal` → `decision='insufficient_signal'` (**اكتشاف mint وحده ليس إشارة شراء**).
2. **brain routing:** `strategy_brain` من `migration_phase` (`LP_MINTED`/`POST_MIGRATION_ACTIVE`→`brain_b`، غيره `brain_a`).
3. **copy_event:** تصنيف `entry`/`risk`/`neutral`؛ **risk → `rejected`** (إشارة الخطر تغلب).
4. **cost (اختياري):** غير priceable → `rejected reason cost_unavailable`.
5. **EV gate:** `strict` يحجب عند فشل/نقص أي عتبة G7 (`ev_gate_blocked`) · `warning_only` → `recommended` + `WARNING_CRITICAL`، **`is_executable=false` دائماً**.

## recommendation / result model
`{ decision: recommended|rejected|insufficient_signal, recommendation, is_executable:false (دائماً), is_order:false (دائماً), strategy_brain, copy_event?, copy_event_category?, ev?, reason, warning?, note }`.

## EV gate behavior
يستهلك `ev_gate_config` (G7) + `ev_metrics` (مفاتيح بأسماء G7) تحت `ev_gate_mode`. `minimum_*` → measured≥limit · `max_expected_drawdown_pct` → measured≤limit. **EV لا يتجاوز Hard Risk ولا يمنح تنفيذاً** (Hard Risk منفصل في Risk Gates).

## الأسماء (SSOT/API/CONFIG فقط)
`copy_event`·`strategy_brain`·`migration_phase`·`ev_gate_mode`·`WARNING_CRITICAL` + عتبات G7. **لا اسم/`api_error_code` جديد.**

> **توصية ≠ تنفيذ · accepted/recommended ليست أمر شراء · لا order قابل للإرسال · لا استدعاء adapter · لا قدرة تداول.**
