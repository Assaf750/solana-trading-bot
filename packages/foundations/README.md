# @soltrade/foundations

وحدات **Build Order** الأساسية (deterministic · local · fail-safe)، بالترتيب الإلزامي من `CLAUDE.md`/`06-BUILD §4`:

1. **`cost-pipeline.mjs`** — `estimateCost(input)` يحسب تكلفة حتمية من `CostEstimate` (ARCH §9). **fail-safe:** مدخل حرج مفقود/بائت → `priceable=false` (reject)، لا صفر. يستهلك `platform_fee_bps` (SSOT G8) كمدخل.
2. **`calibration-store.mjs`** — `createCalibrationStore()` مخزن in-memory لـ `CalibrationRecord` (ARCH §9). **finalized-only** يدخل priors؛ بلا بيانات real → priors **متشائمة** (لا تفاؤل).
3. **`rpc-health-monitor.mjs`** — `evaluateRpcHealth(samples, {slot_lag_threshold})` من عيّنات mocked متعدّدة المزوّدين (SlotLagMonitor، ARCH §15). يُخرِج `provider_degraded`/`slot_lag`/`last_seen_slot`/`last_confirmed_slot` (SSOT G5). **fail-safe:** عيّنات/عتبة مفقودة → `provider_degraded=true`. **بلا RPC calls.**
4. **`protocol-constant-monitor.mjs`** — `evaluateProtocolConstants(observed, baseline)` مقارنة mocked → `protocol_constant_status` (`green`\|`changed`، SSOT G5)؛ `changed`→KILLED (ARCH §10). **fail-safe:** قيمة مجهولة → `changed`. **بلا جلب خارجي.**

## الحوكمة
- **لا اتصالات خارجية حيّة** (لا RPC/Solana/Jupiter/Helius/Jito · لا fetch/http/net · لا endpoints).
- أسماء SSOT G5 فقط لمخرجات health/protocol؛ cost/calibration بُنى ARCH §9 الداخلية (internal-only، ليست أسماء API/data).
- لا أسماء مرفوضة · لا candidate→implemented · لا قدرة تداول · لا signing/sending · لا Risk live enforcement.
- يستهلك `@soltrade/ssot-types` (PROTOCOL_CONSTANT_STATUS) فقط؛ لا اعتمادات خارجية.

> **ملاحظة لغة:** هذه مراجع منطق حتمية مغطّاة باختبارات (Node). تطبيق الـ hot path بلغة Rust تحت `services/*` يأتي لاحقاً (06-BUILD §2) ويستهلك نفس العقود/الأسماء.

## الاستخدام
```js
import { estimateCost, createCalibrationStore, evaluateRpcHealth, evaluateProtocolConstants } from '@soltrade/foundations';
```
