# @soltrade/management-api (read-only skeleton — Gate A)

API إدارة **read-only** فقط. مشتقّ من `docs/03-API-CONTRACT.md §4/§8/§13` و`docs/01-SSOT.md`.

## endpoints
**بنية (تشغيلية):**
- `GET /health` — liveness ثابت. **لا يعني trading readiness.**
- `GET /ready` — readiness تشخيصي: `operating_state=WARMING_UP` · `real_live_config_valid=false` · `validation_status` · `WARNING_CRITICAL` + ملاحظة «ليست trading readiness».

**موارد read-only (GET فقط، `resource_type` من contracts):**
`/api/config`→config · `/api/positions`→position · `/api/intents`→intent · `/api/readiness`→readiness · `/api/health`→health · `/api/audit`→audit · `/api/opportunities`→opportunity.

## القواعد
- **GET فقط** · أي كتابة → `405` + `error_message` (بلا تنفيذ، بلا `api_error_code` جديد).
- **لا `command_type`** · **لا opportunity execution** (`buy_/execute_/submit_opportunity` غير موجودة) · **لا أمر خروج ذرّي**.
- مسار غير معروف → `RESOURCE_NOT_FOUND` (قائم). **لا `api_error_code` جديد.**
- `router.mjs` دالة نقيّة (`handleRequest`) قابلة للاختبار بلا منفذ. `server.mjs` مستمع **محلي inbound فقط** (node:http)، بلا أي اتصالات صادرة إلى مزوّدين خارجيين.

## الاستخدام
```js
import { handleRequest } from '@soltrade/management-api';
handleRequest({ method: 'GET', path: '/ready' });
```
تشغيل dev محلي: `npm run start:dev` (لا قدرة تنفيذ).

> **لا execution adapter · لا stream ingestion · لا decision engine · لا Risk live enforcement · لا signing/sending · لا قدرة تداول.**
