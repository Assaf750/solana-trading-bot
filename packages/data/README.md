# @soltrade/data

سجلّ نموذج البيانات + مسار كتابة Audit (append-only) + Redis projection adapter، مشتقّ من **`docs/05-DATA-MODEL.md` §4–§7** و**`docs/01-SSOT.md`**. الأساسي (غير-candidate) فقط؛ إضافات candidate (§8–§17) خارج نطاق PR-A4.

## المحتوى
- `schema.mjs` / `.d.ts` — `PG_TABLES` (§4 core + §5 runtime) · `CH_TABLES` (§6) · `REDIS_NAMESPACES` (§7). لكل جدول: `api` (أعمدة بأسماء SSOT) + `storage_only` (داخلية: id/FKs/partition/markers) + flags (`append_only`/`projection`). `AUDIT_COLUMNS` · `API_DATA_NAMES`.
- `audit.mjs` / `.d.ts` — `createAuditLog()` مسار **append-only بالتصميم**: `append`/`list`/`get` فقط — **لا `update` ولا `delete`**. يتحقّق من الأعمدة مقابل `AUDIT_COLUMNS` ويجمّد الإدخالات.
- `redis-adapter.mjs` / `.d.ts` — `createRedisProjectionAdapter()` طبقة **projection/cache فقط** (in-memory)، namespaces محصورة بمجموعة الوثائق، **لا event bus تداول · لا publish/subscribe · لا أسرار** (يرفض مفاتيح تشبه الأسرار).

## migrations (skeleton)
- `migrations/postgres/0001_core_tables.sql` (§4) · `0002_runtime_state.sql` (§5) · `0003_audit_append_only.sql` (triggers تمنع UPDATE/DELETE على `audit_log`).
- `migrations/clickhouse/0001_analytical_tables.sql` (§6، MergeTree، partition زمني).
- **تطبيق dev:** عبر حاويات `infra/docker` (psql / clickhouse-client). skeleton: أنواع عامة بلا فهارس إنتاجية.

## الحوكمة (مفروضة بالاختبارات + drift guard)
- **PostgreSQL = سلطة الحالة/الأوامر + audit المعتمد · ClickHouse = إسقاط تحليلي فقط · Redis = projection/cache.**
- audit **append-only** (كوداً + DB trigger) · لا أسماء مرفوضة كأعمدة/كيانات · لا أعمدة private key/seed · أسماء API من SSOT حصراً.
- candidate data (§8–§17) خارج النطاق · لا تحويل candidate→implemented.

## الاستخدام
```js
import { createAuditLog, createRedisProjectionAdapter, PG_TABLES, AUDIT_COLUMNS } from '@soltrade/data';
const audit = createAuditLog();
audit.append({ command_type: 'pause_system', resource_type: 'config', audit_actor: 'op1', event_sequence: 1 });
```

> **لا migrations تنفيذ تداول · لا services business logic · لا API server · لا signing/sending · لا قدرة تداول.**
