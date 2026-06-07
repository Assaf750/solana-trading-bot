import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { validateConfig } from '../src/validate.mjs';
import { FIELDS, CONFIG_OBJECTS, HARD_RISK_FIELDS, EV_FIELDS, ENUM_REFS } from '../src/schema.mjs';
import { COPY_MODE } from '../../ssot-types/src/core-enums.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const load = (name) => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', name), 'utf8'));

const ALLOWED_RULES = new Set([
  'bool', 'enum', 'string', 'number', 'number_pos', 'number_nonneg',
  'pct_pos', 'pct_nonneg', 'pct_open100', 'usdt_pos', 'int_pos', 'int_nonneg', 'duration_nonneg', 'auto',
]);

test('valid config passes (validation_status=valid, real_live_config_valid=true)', () => {
  const r = validateConfig(load('valid-config.json'));
  assert.deepEqual(r.errors, [], 'unexpected errors');
  assert.deepEqual(r.unknown_names, []);
  assert.equal(r.validation_status, 'valid');
  assert.equal(r.real_live_config_valid, true);
});

test('invalid config fails (enum/bounds/dependency/ordering/unknown)', () => {
  const r = validateConfig(load('invalid-config.json'));
  assert.equal(r.validation_status, 'invalid');
  assert.equal(r.real_live_config_valid, false);
  assert.ok(r.unknown_names.includes('bogus_object'), 'unknown object not caught');
  const blob = r.errors.join('\n');
  assert.match(blob, /ev_gate_mode/, 'bad enum not caught');
  assert.match(blob, /capital_reference required/, 'pct_of_capital dependency not caught');
  assert.match(blob, /take_profit_pct required/, 'take_profit dependency not caught');
  assert.match(blob, /limited_add requires copy_adds_for_follow_entry/, 'scale_in dependency not caught');
  assert.match(blob, /low<medium<high<major/, 'ordering not caught');
});

test('REAL-LIVE fails when Hard Risk limits are missing (no implicit infinity)', () => {
  const r = validateConfig(load('missing-hard-risk-config.json'));
  assert.deepEqual(r.errors, [], 'missing Hard Risk must not be a structural error');
  assert.equal(r.real_live_config_valid, false, 'must be REAL-LIVE invalid');
  assert.equal(r.validation_status, 'warning');
  const blob = r.warnings.join('\n');
  for (const k of ['max_creator_exposure_pct', 'max_cluster_exposure_pct', 'max_correlated_meme_exposure_pct']) {
    assert.match(blob, new RegExp(k), `missing ${k} not reported`);
  }
});

test('no config name is outside SSOT / 02-CONFIG', () => {
  const docs = ['docs/01-SSOT.md', 'docs/02-CONFIG-AND-POLICY-SCHEMA.md']
    .map((p) => readFileSync(join(ROOT, p), 'utf8')).join('\n');
  const backtick = new Set();
  for (const m of docs.matchAll(/`([^`]+)`/g)) {
    for (const tok of m[1].split(/[^A-Za-z0-9_]+/)) if (tok) backtick.add(tok);
  }
  for (const obj of CONFIG_OBJECTS) {
    assert.ok(backtick.has(obj), `config object not in docs: ${obj}`);
    for (const field of Object.keys(FIELDS[obj])) {
      assert.ok(backtick.has(field), `config field not in docs: ${obj}.${field}`);
    }
  }
});

test('no new threshold: every rule kind is from the whitelist; bounds use only 0 and 100', () => {
  for (const obj of CONFIG_OBJECTS) {
    for (const [field, def] of Object.entries(FIELDS[obj])) {
      assert.ok(ALLOWED_RULES.has(def.rule), `${obj}.${field} uses unknown rule ${def.rule}`);
    }
  }
  // The validator must not encode magic numeric thresholds beyond 0, 1 and 100.
  // Strip comments and string/template literals first so doc refs (e.g. "§10") don't count.
  const code = readFileSync(join(HERE, '..', 'src', 'validate.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
  const numbers = (code.match(/(?<![A-Za-z_])\d+(?:\.\d+)?/g) || []).filter((n) => !['0', '1', '100'].includes(n));
  assert.deepEqual(numbers, [], `unexpected numeric literals in validator code: ${numbers}`);
});

test('mutability per-wallet matches the docs (§8/§11)', () => {
  const pw = FIELDS.per_wallet_config;
  assert.equal(pw.copy_mode.mutable_when_open, 'frozen_at_entry');
  assert.equal(pw.take_profit_pct.mutable_when_open, 'frozen_at_entry');
  assert.equal(pw.conflict_resolution.mutable_when_open, 'fixed');
  assert.equal(pw.stop_loss_pct.mutable_when_open, 'asymmetric');
  assert.equal(pw.max_time_in_position.mutable_when_open, 'asymmetric');
  assert.equal(pw.follow_enabled.mutable_when_open, 'yes');
  assert.equal(pw.follow_enabled.applies_to_existing, 'yes');
  // Hard Risk: safety_critical + applies immediately to existing positions.
  for (const k of HARD_RISK_FIELDS) {
    assert.equal(FIELDS.risk_config[k].safety_critical, 'yes', `${k} must be safety_critical`);
    assert.equal(FIELDS.risk_config[k].applies_to_existing, 'immediate', `${k} must apply immediately`);
  }
  // EV thresholds: partial safety (subject to ev_gate_mode), never Hard Risk.
  for (const k of EV_FIELDS) assert.equal(FIELDS.ev_gate_config[k].safety_critical, 'partial');
});

test('enum validation consumes SSOT enums (no parallel definition)', () => {
  assert.equal(ENUM_REFS.copy_mode, COPY_MODE, 'copy_mode enum must be the SSOT array reference');
});

test('no forbidden/rejected name appears as a config field name', () => {
  const forbidden = new Set(FORBIDDEN_NAMES);
  for (const obj of CONFIG_OBJECTS) {
    assert.equal(forbidden.has(obj), false, `forbidden object name: ${obj}`);
    for (const field of Object.keys(FIELDS[obj])) {
      assert.equal(forbidden.has(field), false, `forbidden field name: ${field}`);
    }
  }
});
