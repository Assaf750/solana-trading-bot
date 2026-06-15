import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  recordMapperFor,
  mapExecutionIntentToRecord, mapRecordToExecutionIntent,
  mapPositionToRecord, mapRecordToPosition,
  mapAuditEventToRecord, mapRecordToAuditEvent,
  mapDiagnosticRunToRecord, mapRecordToDiagnosticRun,
  mapProviderEventToRecord, mapRecordToProviderEvent,
  createMemoryStore, createInjectedJsonStore, createInjectedSqlStore, createInjectedEventWriter,
  createDecisionLedgerRepository, createPositionRepository, createDiagnosticRepository,
  createAuditRepository, createProviderEventRepository, createInjectedSqlRepository,
} from '../src/index.mjs';
import { DATA_OWNERSHIP } from '../../contracts/src/live-model.mjs';
import { stripComments } from '../../../tools/check-mechanism-guards.mjs';

const INTENT = { intent_id: 'i1', idempotency_key: 'k1', intent_type: 'BUY_INTENT', token_mint: 'M', size_usd: 25, status: 'CREATED', created_at: '2026-06-16T00:00:00.000Z' };
const POSITION = { position_id: 'p1', token_mint: 'M', leader_address: 'L', state: 'OPEN', qty: 100, avg_price_usd: 0.5, realized_usd: 0, unrealized_usd: 0, opened_at: '2026-06-16T00:00:00.000Z', updated_at: '2026-06-16T00:00:01.000Z' };
const AUDIT = { audit_scope: 'intent', audit_reason: 'live_sign_requested', command_type: 'open_signer_session', actor_ref: 'op', detail: { intent_id: 'i1' }, at: '2026-06-16T00:00:00.000Z' };
const DIAG = { run_id: 'd1', kind: 'preflight', readiness: 'valid', checks: [{ provider: 'rpc', status: 'pass' }], created_at: '2026-06-16T00:00:00.000Z' };
const ROUTE = { token_mint: 'M', side: 'buy', in_amount: 10, out_amount: 20, price_impact_pct: 0.1, slippage_bps: 100, route_valid: true, quoted_at: '2026-06-16T00:00:00.000Z' };

// ---------- mapper roundtrips ----------
test('mapper roundtrip: ExecutionIntent / Position / AuditEvent / DiagnosticRun are lossless', () => {
  assert.deepEqual(mapRecordToExecutionIntent(mapExecutionIntentToRecord(INTENT)), INTENT);
  assert.deepEqual(mapRecordToPosition(mapPositionToRecord(POSITION)), POSITION);
  assert.deepEqual(mapRecordToAuditEvent(mapAuditEventToRecord(AUDIT)), AUDIT);
  assert.deepEqual(mapRecordToDiagnosticRun(mapDiagnosticRunToRecord(DIAG)), DIAG);
});

test('records use schema column names (position_state/token_ref, audit_actor/event_timestamp)', () => {
  const pr = mapPositionToRecord(POSITION);
  assert.equal(pr.position_state, 'OPEN');
  assert.equal(pr.token_ref, 'M');
  assert.equal(pr.created_at, POSITION.opened_at);
  const ar = mapAuditEventToRecord(AUDIT);
  assert.equal(ar.audit_actor, 'op');
  assert.equal(ar.event_timestamp, AUDIT.at);
  assert.equal(ar.payload.detail.intent_id, 'i1'); // non-column fields preserved in payload
});

test('provider-event roundtrip carries a RouteQuote losslessly (quoted_at -> event_timestamp)', () => {
  const ev = { event_type: 'route_quote', ...ROUTE };
  const back = mapRecordToProviderEvent(mapProviderEventToRecord(ev));
  assert.equal(back.event_type, 'route_quote');
  assert.equal(back.event_timestamp, ROUTE.quoted_at);
  const rq = { token_mint: back.token_mint, side: back.side, in_amount: back.in_amount, out_amount: back.out_amount, price_impact_pct: back.price_impact_pct, slippage_bps: back.slippage_bps, route_valid: back.route_valid, quoted_at: back.event_timestamp };
  assert.deepEqual(rq, ROUTE);
});

// ---------- memory repository roundtrip ----------
test('memory DecisionLedgerRepository: put/get/list roundtrip; missing -> null', () => {
  const repo = createDecisionLedgerRepository({ store: createMemoryStore() });
  repo.put(INTENT);
  assert.deepEqual(repo.get('i1'), INTENT);
  assert.deepEqual(repo.list(), [INTENT]);
  assert.equal(repo.get('nope'), null);
});

// ---------- injected JSON adapter (no node:fs; IO injected) ----------
test('injected JSON store: persists via injected readJson/writeJson; PositionRepository roundtrip', () => {
  let doc = null;
  const readJson = (_f, fb) => ({ value: doc ?? fb, corrupt: false });
  const writeJson = (_f, v) => { doc = v; };
  const store = createInjectedJsonStore({ readJson, writeJson, file: 'live-positions.json', collection: 'positions' });
  const repo = createPositionRepository({ store });
  repo.put(POSITION);
  assert.deepEqual(repo.get('p1'), POSITION);
  assert.ok(doc.positions.p1, 'persisted through injected writeJson');
  assert.equal(doc.positions.p1.position_state, 'OPEN');
});

// ---------- injected SQL adapter SHAPE (no pg; query/execute injected) ----------
test('injected SQL repository SHAPE: maps to a record + delegates to injected query/execute', () => {
  const calls = [];
  const query = (op) => { calls.push(['q', op]); return op.op === 'select_all' ? [] : null; };
  const execute = (op) => { calls.push(['e', op]); };
  const repo = createInjectedSqlRepository({ entity: 'ExecutionIntent', query, execute, table: 'intents' });
  repo.put(INTENT);
  const up = calls.find((c) => c[0] === 'e')[1];
  assert.equal(up.op, 'upsert');
  assert.equal(up.table, 'intents');
  assert.equal(up.id, 'i1');
  assert.equal(up.record.intent_id, 'i1');
  assert.ok(up.record.payload, 'non-column fields go to JSONB payload');
  repo.get('i1');
  assert.ok(calls.some((c) => c[0] === 'q' && c[1].op === 'select_by_id' && c[1].id === 'i1'));
});

// ---------- append-only audit + write-only event repos ----------
test('AuditRepository is append-only (append + list, no update); ProviderEventRepository writes', () => {
  const audit = createAuditRepository({ store: createMemoryStore(), now: () => 'T' });
  assert.equal(typeof audit.append, 'function');
  assert.equal(audit.put, undefined, 'no keyed update on append-only audit');
  audit.append(AUDIT);
  assert.equal(audit.list().length, 1);
  assert.deepEqual(audit.list()[0], AUDIT);

  const written = [];
  const repo = createProviderEventRepository({ writer: createInjectedEventWriter({ writeEvent: (rec) => written.push(rec) }) });
  repo.write({ event_type: 'route_quote', ...ROUTE });
  assert.equal(written.length, 1);
  assert.equal(written[0].event_type, 'route_quote');
  assert.equal(written[0].event_timestamp, ROUTE.quoted_at);
});

// ---------- fail-closed: unknown entity + invalid record/entity ----------
test('unknown entity is refused (mapper + repository)', () => {
  assert.throws(() => recordMapperFor('Nope'), /unknown_entity/);
  assert.throws(() => createInjectedSqlRepository({ entity: 'Nope', query: () => {}, execute: () => {}, table: 'x' }), /unknown_entity/);
});

test('invalid entity on write and invalid record on read both fail closed', () => {
  assert.throws(() => mapExecutionIntentToRecord({ intent_id: 'i' }), /invalid_ExecutionIntent/);
  assert.throws(() => mapRecordToExecutionIntent({ intent_id: 'i', payload: { status: 'CREATED' } }), /invalid_record_ExecutionIntent/);
  assert.throws(() => mapRecordToPosition('nope'), /invalid_record_Position/);
});

// ---------- data ownership consistency ----------
test('repositories expose the contracts DATA_OWNERSHIP for their entity; sot ∈ stores', () => {
  const STORES = new Set(['postgres', 'redis', 'clickhouse', 'json', 'ephemeral', 'vault']);
  const pairs = [
    [createDecisionLedgerRepository({ store: createMemoryStore() }), 'ExecutionIntent', 'decision-ledger'],
    [createPositionRepository({ store: createMemoryStore() }), 'Position', 'positions'],
    [createDiagnosticRepository({ store: createMemoryStore() }), 'DiagnosticRun', 'execution'],
    [createAuditRepository({ store: createMemoryStore() }), 'AuditEvent', 'audit'],
  ];
  for (const [repo, entity, pkg] of pairs) {
    assert.deepEqual(repo.ownership, DATA_OWNERSHIP[entity]);
    assert.equal(repo.ownership.pkg, pkg);
    assert.ok(STORES.has(repo.ownership.sot));
    assert.ok(repo.ownership.stores.includes(repo.ownership.sot));
  }
});

// ---------- purity: no mechanism imports in storage src ----------
test('storage src imports no node:fs / db driver / fetch (mechanism-injection rule)', () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const forbidden = /\bnode:fs\b|from\s+['"](pg|postgres|clickhouse|@clickhouse\/|ioredis|redis)['"]|\bfetch\s*\(|\bnew\s+WebSocket|node:crypto/;
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    // strip comments first (prose like "NO node:fs here" is not a mechanism); imports keep their text
    const code = stripComments(readFileSync(join(SRC, f), 'utf8'));
    assert.equal(forbidden.test(code), false, `mechanism token in ${f}`);
  }
});
