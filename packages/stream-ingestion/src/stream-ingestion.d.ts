// Types for stream-ingestion.mjs. Replay/mock only. Names from SSOT G12/G13/G5/G3.

export interface StreamEvent {
  event_type: string;            // SSOT G12 (EVENT_TYPE)
  event_sequence: number;        // SSOT G12 (integer >= 0)
  event_timestamp: string;       // SSOT G12
  stream_channel?: string;       // SSOT G13
  copy_event?: string;           // SSOT G3
  last_seen_slot?: number;       // SSOT G5
  last_confirmed_slot?: number;  // SSOT G5
}

export interface IngestResult {
  ok: boolean;
  applied: boolean;
  rejected?: boolean;
  deduped?: boolean;
  out_of_order?: boolean;
  reason?: string;
  event_sequence?: number;
  cursor?: { last_seen_slot: number | null; last_confirmed_slot: number | null };
}

export interface Cursor {
  last_seen_slot: number | null;
  last_confirmed_slot: number | null;
  last_event_sequence: number;
}

export interface ReplaySummary {
  applied: number;
  deduped: number;
  out_of_order: number;
  rejected: number;
  cursor: Cursor;
}

export interface StreamIngestion {
  ingest(ev: StreamEvent): IngestResult;
  replay(events: StreamEvent[]): ReplaySummary;
  getCursor(): Cursor;
  seenCount(): number;
}

export function createStreamIngestion(opts?: { redis?: unknown }): StreamIngestion;
