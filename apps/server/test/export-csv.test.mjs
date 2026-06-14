// export-csv.test.mjs — pure CSV builders for PnL/tax export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, positionsCsv, tradesCsv } from '../src/engine/export-csv.mjs';

test('toCsv: header + quoting of commas/quotes/newlines', () => {
  const csv = toCsv(['a', 'b'], [{ a: 'x,y', b: 'he said "hi"' }, { a: 'plain', b: 'line\nbreak' }]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'a,b');
  assert.equal(lines[1], '"x,y","he said ""hi"""');
  assert.equal(csv.includes('"line\nbreak"'), true);
});

test('positionsCsv: only CLOSED positions, joined with buy cost + sell proceeds', () => {
  const state = {
    positions: [
      { position_id: 'p1', position_state: 'CLOSED', simulated: true, leader_address: 'L', token_mint: 'M', copy_mode: 'follow_entry_user_exit', entry_ts: 't0', closed_at: 't1', realized_usd: 23.4567 },
      { position_id: 'p2', position_state: 'OPEN', simulated: true, token_mint: 'N' },
    ],
    trades: [
      { position_id: 'p1', side: 'buy', value_usd: 100 },
      { position_id: 'p1', side: 'sell', value_usd: 123.45 },
      { position_id: 'p2', side: 'buy', value_usd: 50 },
    ],
  };
  const csv = positionsCsv(state);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2, 'header + one closed position');
  assert.match(lines[0], /^position_id,simulated,leader_address,token_mint,copy_mode,entry_ts,closed_at,cost_usd,proceeds_usd,realized_usd$/);
  assert.match(lines[1], /^p1,true,L,M,follow_entry_user_exit,t0,t1,100,123.45,23.46$/);
});

test('tradesCsv: every trade row', () => {
  const state = { trades: [{ trade_id: 'x', ts: 't', simulated: false, position_id: 'p', side: 'buy', token_mint: 'M', qty_ui: 1, price_usd: 2, value_usd: 2, reason: 'leader_buy_copied' }] };
  const csv = tradesCsv(state);
  assert.equal(csv.split('\n').length, 2);
  assert.match(csv, /x,t,false,p,buy,M,1,2,2,leader_buy_copied/);
});

test('csv builders: empty state => header only', () => {
  assert.equal(positionsCsv({}).split('\n').length, 1);
  assert.equal(tradesCsv({}).split('\n').length, 1);
});
