// @soltrade/stream-ingestion — replay/mock stream ingestion (Gate B / B5).
// SOURCE: docs/01-SSOT.md G12 (envelope) / G13 (stream_channel) / G5 (cursors) / G3 (copy_event)
// + docs/03-API-CONTRACT §9 + docs/05-DATA-MODEL §7.3 (stream_cursors).
// REPLAY/MOCK ONLY: consumes provided/fixture events. NO live stream, NO RPC/provider, NO WebSocket,
// NO gRPC, NO HTTP outbound, NO Redis-live, NO DB writes, NO execution, NO signing.
//
// INVARIANTS:
//  - Envelope validated against SSOT (event_type/stream_channel/copy_event); invalid => REJECT (no fail-open).
//  - Dedup by event_sequence; cursor (event_sequence + last_seen_slot/last_confirmed_slot) is FORWARD-ONLY.
//  - Out-of-order (sequence < last) is skipped safely without regressing the cursor.

import { EVENT_TYPE, STREAM_CHANNEL } from '../../contracts/src/api-vocabulary.mjs';
import { COPY_EVENT } from '../../ssot-types/src/core-enums.mjs';
import { createRedisProjectionAdapter } from '../../data/src/redis-adapter.mjs';

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isSlot = (v) => Number.isInteger(v) && v >= 0;

function validateEvent(ev) {
  if (ev == null || typeof ev !== 'object') return 'event_required';
  if (!EVENT_TYPE.includes(ev.event_type)) return 'invalid_event_type';
  if (ev.stream_channel != null && !STREAM_CHANNEL.includes(ev.stream_channel)) return 'invalid_stream_channel';
  if (!Number.isInteger(ev.event_sequence) || ev.event_sequence < 0) return 'invalid_event_sequence';
  if (!isStr(ev.event_timestamp)) return 'missing_event_timestamp';
  if (ev.copy_event != null && !COPY_EVENT.includes(ev.copy_event)) return 'invalid_copy_event';
  if (ev.last_seen_slot != null && !isSlot(ev.last_seen_slot)) return 'invalid_last_seen_slot';
  if (ev.last_confirmed_slot != null && !isSlot(ev.last_confirmed_slot)) return 'invalid_last_confirmed_slot';
  return null;
}

export function createStreamIngestion({ redis } = {}) {
  const seen = new Set();      // dedup by event_sequence
  let lastSequence = -1;       // forward-only sequence cursor
  let last_seen_slot = null;   // SSOT G5
  let last_confirmed_slot = null; // SSOT G5
  const projection = redis || createRedisProjectionAdapter(); // in-memory only

  function mirror() {
    if (last_seen_slot != null) projection.set('stream_cursors', 'last_seen_slot', last_seen_slot);
    if (last_confirmed_slot != null) projection.set('stream_cursors', 'last_confirmed_slot', last_confirmed_slot);
  }

  function ingest(ev) {
    const err = validateEvent(ev);
    if (err) return { ok: false, rejected: true, applied: false, reason: err };
    if (seen.has(ev.event_sequence)) return { ok: true, deduped: true, applied: false, event_sequence: ev.event_sequence };
    if (ev.event_sequence < lastSequence) return { ok: true, out_of_order: true, applied: false, event_sequence: ev.event_sequence };

    seen.add(ev.event_sequence);
    lastSequence = Math.max(lastSequence, ev.event_sequence);
    if (isSlot(ev.last_seen_slot)) last_seen_slot = Math.max(last_seen_slot ?? -1, ev.last_seen_slot);
    if (isSlot(ev.last_confirmed_slot)) last_confirmed_slot = Math.max(last_confirmed_slot ?? -1, ev.last_confirmed_slot);
    mirror();
    return { ok: true, applied: true, event_sequence: ev.event_sequence, cursor: { last_seen_slot, last_confirmed_slot } };
  }

  return Object.freeze({
    ingest,
    /** Replay an array of events deterministically; returns a summary. */
    replay(events) {
      const summary = { applied: 0, deduped: 0, out_of_order: 0, rejected: 0 };
      const list = Array.isArray(events) ? events : [];
      for (const ev of list) {
        const r = ingest(ev);
        if (r.rejected) summary.rejected++;
        else if (r.deduped) summary.deduped++;
        else if (r.out_of_order) summary.out_of_order++;
        else if (r.applied) summary.applied++;
      }
      return { ...summary, cursor: { last_seen_slot, last_confirmed_slot, last_event_sequence: lastSequence } };
    },
    getCursor() {
      return { last_seen_slot, last_confirmed_slot, last_event_sequence: lastSequence };
    },
    seenCount() { return seen.size; },
  });
}
