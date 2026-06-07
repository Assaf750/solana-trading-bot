# @soltrade/stream-ingestion (Gate B / B5)

ingestion **replay/mock فقط**، مشتقّ من `docs/01-SSOT G12/G13/G5/G3` و`docs/03-API §9` و`docs/05-DATA §7.3`. **لا live stream · لا RPC/provider · لا WebSocket/gRPC/HTTP outbound · لا Redis-live · لا DB writes · لا execution/signing.**

## المحتوى
- `stream-ingestion.mjs` / `.d.ts` — `createStreamIngestion({ redis? })` → `{ ingest(ev), replay(events), getCursor(), seenCount() }`.
- `fixtures/replay-events.json` — أحداث صالحة مرتّبة (قيم dev).

## replay / cursor / dedup
- **envelope validation (SSOT):** `event_type ∈ EVENT_TYPE` · `stream_channel ∈ STREAM_CHANNEL` · `event_sequence` integer≥0 · `event_timestamp` نصّ · `copy_event ∈ COPY_EVENT` (إن وُجد) · slots integer≥0. غير صالح → **rejected (لا fail-open)**.
- **dedup:** `event_sequence` مكرّر → `deduped` (لا تطبيق مزدوج).
- **cursor للأمام فقط:** `last_event_sequence` + `last_seen_slot`/`last_confirmed_slot` (G5) تتقدّم عبر `max` فقط.
- **out-of-order:** `event_sequence < last` → `out_of_order` (skip آمن، بلا تراجع للـ cursor).
- `redis` (اختياري) = `@soltrade/data` projection **in-memory** فقط (namespace `stream_cursors`).

## الأسماء (SSOT/API/DATA فقط)
`event_type`·`event_sequence`·`event_timestamp`·`stream_channel`·`copy_event`·`last_seen_slot`·`last_confirmed_slot` + `stream_cursors`. **لا `api_error_code` جديد** (`reason` داخلي).

> **لا live provider/RPC/network · لا DB writes/migrations · لا execution/signing/sending · لا قدرة تداول.** يقرأ الأحداث ويبني المؤشّر in-memory فقط.
