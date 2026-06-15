// history.test.mjs — append-only operator activity log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.SOLTRADE_DATA_DIR = process.env.SOLTRADE_DATA_DIR || mkdtempSync(join(tmpdir(), 'soltrade-hist-'));
const { createHistory } = await import('../src/engine/history.mjs');

test('history: records, lists newest-first, filters by type, counts', () => {
  const h = createHistory({ file: 'hist-a.json' });
  h.record({ type: 'token_analysis', mint: 'M1', verdict: 'suitable' });
  h.record({ type: 'wallet_analysis', address: 'W1', tier: 'copy_allowed' });
  h.record({ type: 'token_analysis', mint: 'M2', verdict: 'high_risk' });
  const all = h.list();
  assert.equal(all.length, 3);
  assert.equal(all[0].mint, 'M2'); // newest first
  assert.ok(all[0].id && all[0].ts);
  const tokensOnly = h.list({ type: 'token_analysis' });
  assert.equal(tokensOnly.length, 2);
  const c = h.counts();
  assert.equal(c.total, 3);
  assert.equal(c.by_type.token_analysis, 2);
  assert.equal(c.by_type.wallet_analysis, 1);
});

test('history: ignores malformed entries; honors limit', () => {
  const h = createHistory({ file: 'hist-b.json' });
  h.record(null); h.record({}); h.record({ nope: 1 });
  assert.equal(h.counts().total, 0);
  for (let i = 0; i < 10; i += 1) h.record({ type: 'radar_scan', mint: `m${i}` });
  assert.equal(h.list({ limit: 3 }).length, 3);
});
