import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { evaluateHardRisk, HARD_RISK_LIMIT_NAMES, HARD_RISK_BLOCK_CODE } from '../src/risk-gates.mjs';
import { HARD_RISK_FIELDS } from '../../config/src/schema.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const load = (n) => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', n), 'utf8'));
const RISK = () => load('risk-config.json');
const OK = () => load('measured-within-limits.json');

test('allows when all nine limits present and measured within them', () => {
  const r = evaluateHardRisk({ risk_config: RISK(), measured: OK() });
  assert.equal(r.decision, 'allow');
  assert.deepEqual(r.violations, []);
  assert.equal(r.real_live_config_valid, true);
  assert.equal(r.hard_risk_enforced, true);
  assert.equal(r.api_error_code, undefined);
});

test('each of the nine Hard Risk limits blocks when exceeded', () => {
  for (const name of HARD_RISK_FIELDS) {
    const measured = { ...OK(), [name]: RISK()[name] + 1 }; // exceed exactly this one
    const r = evaluateHardRisk({ risk_config: RISK(), measured });
    assert.equal(r.decision, 'block', `${name} breach must block`);
    assert.equal(r.api_error_code, 'HARD_RISK_BYPASS_REJECTED');
    assert.equal(r.reason, 'hard_risk_limit_exceeded');
    assert.ok(r.violations.some((v) => v.limit === name), `${name} must be in violations`);
  }
});

test('warning_only does NOT bypass Hard Risk', () => {
  const measured = { ...OK(), max_daily_loss_pct: RISK().max_daily_loss_pct + 5 };
  const r = evaluateHardRisk({ risk_config: RISK(), measured, ev_gate_mode: 'warning_only' });
  assert.equal(r.decision, 'block');
  assert.equal(r.hard_risk_enforced, true);
  assert.equal(r.api_error_code, 'HARD_RISK_BYPASS_REJECTED');
});

test('missing Hard Risk limit => block (no fail-open) + real_live_config_valid=false', () => {
  const risk = RISK();
  delete risk.max_cluster_exposure_pct;
  const r = evaluateHardRisk({ risk_config: risk, measured: OK() });
  assert.equal(r.decision, 'block');
  assert.equal(r.real_live_config_valid, false);
  assert.ok(r.missing_limits.includes('max_cluster_exposure_pct'));
  assert.equal(r.reason, 'hard_risk_limit_missing');
});

test('fail-safe: limit present but measured value missing => block (unverifiable)', () => {
  const measured = OK();
  delete measured.max_position_size_pct;
  const r = evaluateHardRisk({ risk_config: RISK(), measured });
  assert.equal(r.decision, 'block');
  assert.ok(r.unverifiable.includes('max_position_size_pct'));
  assert.equal(r.reason, 'hard_risk_unverifiable');
});

test('fail-safe: empty/garbage input => block, never allow', () => {
  assert.equal(evaluateHardRisk().decision, 'block');
  assert.equal(evaluateHardRisk({}).decision, 'block');
  assert.equal(evaluateHardRisk({ risk_config: {}, measured: {} }).decision, 'block');
});

test('no sidecar bypass: extra options cannot flip a block to allow', () => {
  const measured = { ...OK(), max_daily_loss_usdt: RISK().max_daily_loss_usdt + 1 };
  const base = { risk_config: RISK(), measured };
  for (const extra of [{ bypass: true }, { force: true }, { disable_enforcement: true }, { override: true }]) {
    const r = evaluateHardRisk({ ...base, ...extra });
    assert.equal(r.decision, 'block', `option ${JSON.stringify(extra)} must not bypass`);
  }
});

test('only SSOT names + existing error code are used; no new threshold in code', () => {
  assert.deepEqual([...HARD_RISK_LIMIT_NAMES], [...HARD_RISK_FIELDS]);
  assert.ok(API_ERROR_CODE.includes(HARD_RISK_BLOCK_CODE));
  // No magic numeric thresholds in enforcement code (comparisons only). Strip comments/strings.
  const code = readFileSync(join(SRC, 'risk-gates.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');
  const nums = (code.match(/(?<![A-Za-z_])\d+(?:\.\d+)?/g) || []).filter((n) => !['0'].includes(n));
  assert.deepEqual(nums, [], `unexpected numeric literal(s): ${nums}`);
});

test('source has no forbidden names and no network/secret usage', () => {
  const OUTBOUND = /(\bfetch\b|\bundici\b|\baxios\b|http\.request|https\.request|new WebSocket|wss?:\/\/|https?:\/\/|@solana\/|@jup|helius-sdk|jito-)/i;
  const SECRET = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|signer_material)/i;
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
    assert.equal(OUTBOUND.test(code), false, `network in ${fn}`);
    assert.equal(SECRET.test(code), false, `secret-like in ${fn}`);
  }
});
