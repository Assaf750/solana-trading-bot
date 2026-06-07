import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createStreamIngestion } from '../src/stream-ingestion.mjs';
import { EVENT_TYPE, STREAM_CHANNEL } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const events = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'replay-events.json'), 'utf8'));

test('replay fixtures are read deterministically (same input -> same summary)', () => {
  const a = createStreamIngestion().replay(events());
  const b = createStreamIngestion().replay(events());
  assert.deepEqual(a, b);
  assert.equal(a.applied, 4);
  assert.equal(a.rejected, 0);
  assert.equal(a.cursor.last_seen_slot, 1003);
  assert.equal(a.cursor.last_confirmed_slot, 1001);
  assert.equal(a.cursor.last_event_sequence, 4);
  // envelope values are from SSOT
  for (const ev of events()) {
    assert.ok(EVENT_TYPE.includes(ev.event_type));
    assert.ok(STREAM_CHANNEL.includes(ev.stream_channel));
  }
});

test('dedup prevents reprocessing the same event_sequence', () => {
  const s = createStreamIngestion();
  const ev = events()[0];
  assert.equal(s.ingest(ev).applied, true);
  const dup = s.ingest(ev);
  assert.equal(dup.deduped, true);
  assert.equal(dup.applied, false);
  assert.equal(s.seenCount(), 1);
});

test('cursor advances forward-only (slots never regress)', () => {
  const s = createStreamIngestion();
  s.ingest({ event_type: 'health_update', event_sequence: 10, event_timestamp: 't', last_seen_slot: 5000, last_confirmed_slot: 4998 });
  // a later sequence carrying a LOWER slot must not regress the slot cursor
  s.ingest({ event_type: 'health_update', event_sequence: 11, event_timestamp: 't', last_seen_slot: 4000, last_confirmed_slot: 3999 });
  const c = s.getCursor();
  assert.equal(c.last_seen_slot, 5000);
  assert.equal(c.last_confirmed_slot, 4998);
  assert.equal(c.last_event_sequence, 11);
});

test('out-of-order events are skipped safely (cursor not regressed)', () => {
  const s = createStreamIngestion();
  s.ingest({ event_type: 'health_update', event_sequence: 5, event_timestamp: 't', last_seen_slot: 100 });
  const ooo = s.ingest({ event_type: 'health_update', event_sequence: 3, event_timestamp: 't', last_seen_slot: 90 });
  assert.equal(ooo.out_of_order, true);
  assert.equal(ooo.applied, false);
  assert.equal(s.getCursor().last_event_sequence, 5);
  assert.equal(s.getCursor().last_seen_slot, 100);
});

test('missing/invalid events are rejected (no fail-open)', () => {
  const s = createStreamIngestion();
  const cases = [
    [null, 'event_required'],
    [{ event_sequence: 1, event_timestamp: 't' }, 'invalid_event_type'],
    [{ event_type: 'nope', event_sequence: 1, event_timestamp: 't' }, 'invalid_event_type'],
    [{ event_type: 'health_update', stream_channel: 'nope', event_sequence: 1, event_timestamp: 't' }, 'invalid_stream_channel'],
    [{ event_type: 'health_update', event_sequence: 1.5, event_timestamp: 't' }, 'invalid_event_sequence'],
    [{ event_type: 'health_update', event_sequence: 1 }, 'missing_event_timestamp'],
    [{ event_type: 'health_update', event_sequence: 1, event_timestamp: 't', copy_event: 'nope' }, 'invalid_copy_event'],
    [{ event_type: 'health_update', event_sequence: 1, event_timestamp: 't', last_seen_slot: -1 }, 'invalid_last_seen_slot'],
  ];
  for (const [ev, reason] of cases) {
    const r = s.ingest(ev);
    assert.equal(r.rejected, true, `expected reject for ${reason}`);
    assert.equal(r.applied, false);
    assert.equal(r.reason, reason);
  }
  assert.equal(s.seenCount(), 0, 'no invalid event is applied');
});

test('valid copy_event is accepted', () => {
  const s = createStreamIngestion();
  const r = s.ingest({ event_type: 'position_update', stream_channel: 'position', event_sequence: 1, event_timestamp: 't', copy_event: 'leader_buy' });
  assert.equal(r.applied, true);
});

test('no live provider / RPC / network / websocket / grpc in source', () => {
  const BAD = /(helius|triton|yellowstone|jito|jupiter|@solana\/|\bgrpc\b|websocket|new WebSocket|\bfetch\b|axios|undici|http\.request|https?:\/\/|node:net|node:http|node:dgram)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `live/network usage in ${fn}`);
  }
});

test('no DB writes / execution / signing in source', () => {
  const BAD = /(INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|\bpg\b|clickhouse|node:fs|writeFileSync|signTransaction|sendTransaction|sendRawTransaction)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `db/exec/signing in ${fn}`);
  }
});

test('no forbidden names and no secrets in source/fixtures', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  const files = [...readdirSync(SRC).map((f) => join(SRC, f)), join(HERE, '..', 'fixtures', 'replay-events.json')];
  for (const fn of files) {
    if (!/\.(mjs|json)$/.test(fn)) continue;
    const code = readFileSync(fn, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
