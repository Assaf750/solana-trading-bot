# @soltrade/risk-gates (Gate B / B1)

طبقة فرض **Hard Risk** حتمية، مشتقّة من `docs/00-ARCHITECTURE §5/§10` و`docs/02-CONFIG §6/§11` و`docs/01-SSOT G6/G11`. **طبقة فرض لا sidecar** — لا خيار لتعطيل/تجاوز الفرض.

## المحتوى
- `risk-gates.mjs` / `.d.ts` — `evaluateHardRisk({ risk_config, measured, ev_gate_mode })` → `{ decision: allow|block, violations[], missing_limits[], unverifiable[], real_live_config_valid, hard_risk_enforced:true, api_error_code?, reason? }`.
- `fixtures/` — `risk-config.json` (الحدود التسعة، قيم dev) · `measured-within-limits.json`.

## الحدود التسعة (G6، تُستهلَك من `@soltrade/config` HARD_RISK_FIELDS)
`max_daily_loss_pct` · `max_daily_loss_usdt` · `max_total_drawdown_pct` · `max_open_positions` · `max_position_size_pct` · `max_token_exposure_pct` · `max_creator_exposure_pct` · `max_cluster_exposure_pct` · `max_correlated_meme_exposure_pct`.

## القواعد (invariants)
- **Hard Risk مُلزِم دائماً** · **`ev_gate_mode=warning_only` لا يتجاوزه** (لا يُقرأ في القرار).
- **حدّ مفقود ≠ بلا حدّ** → block + `real_live_config_valid=false` (لا fail-open).
- **بُعد غير قابل للتحقّق** (حدّ موجود بلا قيمة measured) → block (fail-safe).
- block → `api_error_code=HARD_RISK_BYPASS_REJECTED` (قائم، **لا code جديد**).
- **لا threshold جديد** (مقارنة `>` فقط ضد الحدود التسعة) · لا اسم خارج SSOT/CONFIG · لا DB/execution/network.

## الاستخدام
```js
import { evaluateHardRisk } from '@soltrade/risk-gates';
evaluateHardRisk({ risk_config, measured, ev_gate_mode: 'warning_only' }); // Hard Risk still enforced
```

> **لا signing/sending · لا execution adapter · لا قدرة تداول.** يقرّر allow/block فقط؛ التنفيذ (لاحقاً) يجب أن يمرّ عبر هذا الحارس قبل أي adapter.
