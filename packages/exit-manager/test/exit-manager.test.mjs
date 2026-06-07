import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExitManager } from '../src/exit-manager.mjs';
import { createIntentLedger } from '../../intent-ledger/src/intent-ledger.mjs';
import { CANDIDATE_COMMANDS } from '../../contracts/src/candidate-commands.mjs';
import { CANDIDATE_ENUMS } from '../../ssot-types/src/candidate-enums.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const positions = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'positions.json'), 'utf8'));

test('candidate command names are used and remain candidate (registered)', () => {
  const em = createExitManager();
  assert.equal(em.command_preview, 'candidate_cmd_preview_batch_exit');
  assert.equal(em.command_request, 'candidate_cmd_request_batch_exit');
  assert.match(em.command_preview, /^candidate_cmd_/);
  assert.match(em.command_request, /^candidate_cmd_/);
  assert.ok(CANDIDATE_COMMANDS.includes(em.command_preview));
  assert.ok(CANDIDATE_COMMANDS.includes(em.command_request));
});

test('preview does NOT execute; classifies per-position with candidate statuses', () => {
  const em = createExitManager();
  const p = em.previewBatchExit(positions());
  assert.equal(p.executed, false);
  assert.equal(p.command, 'candidate_cmd_preview_batch_exit');
  const allowed = CANDIDATE_ENUMS.candidate_batch_exit_preview_item_status;
  for (const it of p.items) assert.ok(allowed.includes(it.candidate_batch_exit_preview_item_status));
  const byId = Object.fromEntries(p.items.map((i) => [i.id, i.candidate_batch_exit_preview_item_status]));
  assert.equal(byId['pos-1'], 'eligible');
  assert.equal(byId['pos-2'], 'eligible');
  assert.equal(byId['pos-3'], 'blocked');   // CLOSED
  assert.equal(byId['pos-4'], 'stale');     // OPENING
});

test('request is per-position (separate intent each), not atomic; does not execute', () => {
  const ledger = createIntentLedger();
  const em = createExitManager({ ledger });
  const p = em.previewBatchExit(positions());
  const r = em.requestBatchExit(p);
  assert.equal(r.ok, true);
  assert.equal(r.per_position, true);
  assert.equal(r.atomic, false);
  assert.equal(r.executed, false);
  // two eligible -> two SEPARATE intents created in the ledger
  const submitted = r.results.filter((x) => x.candidate_batch_exit_result_status === 'submitted');
  assert.equal(submitted.length, 2);
  const intentIds = submitted.map((x) => x.intent_id);
  assert.equal(new Set(intentIds).size, 2, 'each position has its own distinct intent');
  assert.equal(ledger.size, 2, 'two separate intents recorded (not one atomic op)');
  // blocked / stale mapped correctly
  assert.equal(r.results.find((x) => x.id === 'pos-3').candidate_batch_exit_result_status, 'blocked');
  assert.equal(r.results.find((x) => x.id === 'pos-4').candidate_batch_exit_result_status, 'skipped');
});

test('request accepted only on a fresh/valid preview (single-use)', () => {
  const em = createExitManager({ ledger: createIntentLedger() });
  const p = em.previewBatchExit(positions());
  assert.equal(em.requestBatchExit(p).ok, true);
  // re-using the same preview is rejected (consumed/stale)
  assert.equal(em.requestBatchExit(p).reason, 'stale_or_consumed_preview');
  assert.equal(em.requestBatchExit({ preview_id: 'nope' }).reason, 'unknown_preview');
  assert.equal(em.requestBatchExit(null).reason, 'invalid_preview');
});

test('no atomic exit and no forbidden exit-all names anywhere in source', () => {
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8');
    assert.equal(/\bexit_all_positions\b/.test(code), false, `exit_all_positions in ${fn}`);
    assert.equal(/\bbatch_exit_all_positions\b/.test(code), false, `batch_exit_all_positions in ${fn}`);
  }
  // the manager exposes no atomic "exitAll" style method
  const em = createExitManager();
  for (const m of ['exitAll', 'exitAllPositions', 'batchExitAll', 'execute', 'sign', 'send']) {
    assert.equal(em[m], undefined, `must NOT expose ${m}`);
  }
});

test('candidate prefixes preserved; no candidate -> implemented', () => {
  const em = createExitManager();
  const p = em.previewBatchExit(positions());
  // keys carry the candidate_ prefix verbatim
  assert.ok('candidate_batch_exit_preview_item_status' in p.items[0]);
  const r = em.requestBatchExit(p);
  assert.ok('candidate_batch_exit_result_status' in r.results[0]);
});

test('no signing/sending/transaction-building/network/DB in source', () => {
  const BAD = /(signTransaction|sendTransaction|sendRawTransaction|buildTransaction|\.serialize\(|\bfetch\b|axios|undici|https?:\/\/|@solana\/|new WebSocket|node:net|node:http|node:fs|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|\bpg\b)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `forbidden mechanism in ${fn}`);
  }
});

test('no forbidden names (as real artifacts) and no secrets in source/fixtures', () => {
  // exit_all/batch_exit already covered; check the rest of the forbidden registry.
  const forbidden = FORBIDDEN_NAMES.filter((n) => !['HUNTABLE', 'exit_all_positions', 'batch_exit_all_positions'].includes(n));
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  const files = [...readdirSync(SRC).map((f) => join(SRC, f)), join(HERE, '..', 'fixtures', 'positions.json')];
  for (const fn of files) {
    if (!/\.(mjs|json)$/.test(fn)) continue;
    const code = readFileSync(fn, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
