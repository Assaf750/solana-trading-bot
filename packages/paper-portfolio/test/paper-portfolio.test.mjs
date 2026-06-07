import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createPaperPortfolio } from '../src/paper-portfolio.mjs';
import { CANDIDATE_ENUMS } from '../../ssot-types/src/candidate-enums.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const fills = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'simulated-fills.json'), 'utf8'));

function loaded() {
  const pf = createPaperPortfolio();
  for (const f of fills()) assert.equal(pf.addSimulatedFill(f).ok, true);
  return pf;
}

test('realized P&L is candidate/simulated and FIFO lot-based', () => {
  const pf = loaded();
  const r = pf.getRealized('pos-1');
  assert.equal(r.simulated, true);
  // sold 120 @1.5 vs lots: 100@1.0 then 20@1.2 -> (1.5-1.0)*100 + (1.5-1.2)*20 = 50 + 6 = 56
  assert.ok(Math.abs(r.candidate_realized_pnl - 56) < 1e-9);
  assert.ok(Math.abs(r.candidate_fees_total - 1.6) < 1e-9);
  assert.ok(Math.abs(r.candidate_slippage_cost - 0.7) < 1e-9);
});

test('unrealized P&L requires candidate_mark_status === valid', () => {
  const pf = loaded(); // 80 open @ avg 1.2
  const ok = pf.getUnrealized('pos-1', { candidate_mark_status: 'valid', mark: 1.5 });
  assert.equal(ok.unrealized_available, true);
  assert.ok(Math.abs(ok.candidate_unrealized_pnl - (1.5 - 1.2) * 80) < 1e-9);
  assert.equal(ok.candidate_mark_status, 'valid');
});

test('invalid/stale mark yields NO unrealized truth (null, not available)', () => {
  const pf = loaded();
  for (const status of ['stale', 'unavailable', 'low_confidence', 'display_only']) {
    const r = pf.getUnrealized('pos-1', { candidate_mark_status: status, mark: 1.5 });
    assert.equal(r.candidate_unrealized_pnl, null, `${status} must not produce unrealized truth`);
    assert.equal(r.unrealized_available, false);
    assert.equal(r.candidate_mark_status, status);
  }
  // missing mark value even with valid status -> not available
  const noMark = pf.getUnrealized('pos-1', { candidate_mark_status: 'valid' });
  assert.equal(noMark.unrealized_available, false);
  assert.equal(noMark.reason, 'mark_value_missing');
  // mark status must be a registered candidate_mark_status value
  assert.equal(pf.getUnrealized('pos-1', { candidate_mark_status: 'bogus', mark: 1 }).reason, 'invalid_mark_status');
});

test('only simulated fills accepted; on-chain-claimed fill rejected', () => {
  const pf = createPaperPortfolio();
  assert.equal(pf.addSimulatedFill({ position_ref: 'p', side: 'buy', quantity: 1, price: 1, is_valid_on_chain: true }).reason, 'only_simulated_fills_accepted');
  assert.equal(pf.addSimulatedFill({ position_ref: 'p', side: 'nope', quantity: 1, price: 1 }).reason, 'invalid_side');
  assert.equal(pf.addSimulatedFill({ side: 'buy', quantity: 1, price: 1 }).reason, 'position_ref_required');
});

test('every output is tagged simulated (backend read-model)', () => {
  const pf = loaded();
  assert.equal(pf.getRealized('pos-1').simulated, true);
  assert.equal(pf.getUnrealized('pos-1', { candidate_mark_status: 'valid', mark: 1 }).simulated, true);
  assert.equal(pf.getPortfolio('pos-1').simulated, true);
});

test('candidate fields use the registered candidate_mark_status enum; prefixes preserved', () => {
  const pf = loaded();
  const r = pf.getRealized('pos-1');
  for (const k of ['candidate_realized_pnl', 'candidate_fees_total', 'candidate_slippage_cost']) assert.ok(k in r);
  const u = pf.getUnrealized('pos-1', { candidate_mark_status: 'valid', mark: 1 });
  assert.ok('candidate_unrealized_pnl' in u);
  assert.ok(CANDIDATE_ENUMS.candidate_mark_status.includes('valid'));
});

test('no Opportunity/Radar P&L and no UX/API/dashboard exposure in source', () => {
  const BAD = /(opportunity|radar|dashboard|express|createServer|app\.get|res\.json|router\.|fetch\(|axios|https?:\/\/)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `UX/API/opportunity-radar coupling in ${fn}`);
  }
});

test('no execution/signing/network/DB in source', () => {
  const BAD = /(signTransaction|sendTransaction|buildTransaction|\.serialize\(|@solana\/|new WebSocket|node:net|node:http|node:fs|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|\bpg\b|sendRawTransaction)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `exec/network/db in ${fn}`);
  }
});

test('no forbidden (unprefixed P&L) names as real artifacts; no secrets', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  const files = [...readdirSync(SRC).map((f) => join(SRC, f)), join(HERE, '..', 'fixtures', 'simulated-fills.json')];
  for (const fn of files) {
    if (!/\.(mjs|json)$/.test(fn)) continue;
    const code = readFileSync(fn, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    // \b ensures candidate_realized_pnl does NOT match the forbidden bare realized_pnl
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
