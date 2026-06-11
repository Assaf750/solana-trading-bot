import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExecutionWalletRegistry, isTerminalWalletStatus } from '../src/execution-wallet-registry.mjs';
import { EXECUTION_WALLET_STATUS } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const wallet = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'execution-wallet.json'), 'utf8'));

function withWallet() {
  const reg = createExecutionWalletRegistry();
  assert.equal(reg.register(wallet()).ok, true);
  return reg;
}

test('registration starts at WARMING_UP (never ACTIVE on register)', () => {
  const reg = withWallet();
  const w = reg.get('exec-wallet-dev-1');
  assert.equal(w.execution_wallet_status, 'WARMING_UP');
  assert.ok(EXECUTION_WALLET_STATUS.includes(w.execution_wallet_status));
  // dupe + invalid creation mode
  assert.equal(reg.register(wallet()).reason, 'execution_wallet_exists');
  assert.equal(createExecutionWalletRegistry().register({ execution_wallet_id: 'x', execution_wallet_creation_mode: 'bogus' }).reason, 'invalid_execution_wallet_creation_mode');
  assert.equal(createExecutionWalletRegistry().register({}).reason, 'execution_wallet_id_required');
});

test('legal transitions pass; WARMING_UP -> ACTIVE only via explicit transition', () => {
  const reg = withWallet();
  assert.equal(reg.transition('exec-wallet-dev-1', 'ACTIVE').ok, true);
  assert.equal(reg.get('exec-wallet-dev-1').execution_wallet_status, 'ACTIVE');
  assert.equal(reg.transition('exec-wallet-dev-1', 'DRAINING').ok, true);
  assert.equal(reg.transition('exec-wallet-dev-1', 'RETIRED').ok, true);
});

test('illegal transition rejected with COMMAND_NOT_ALLOWED_IN_STATE', () => {
  const reg = withWallet(); // WARMING_UP
  const r = reg.transition('exec-wallet-dev-1', 'RETIRED'); // not allowed from WARMING_UP
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.ok(API_ERROR_CODE.includes(r.api_error_code));
  assert.equal(reg.transition('exec-wallet-dev-1', 'NOPE').reason, 'invalid_execution_wallet_status');
});

test('REVOKED is terminal (no outgoing transitions)', () => {
  const reg = withWallet();
  assert.equal(reg.transition('exec-wallet-dev-1', 'REVOKED').ok, true);
  assert.equal(reg.isTerminal('exec-wallet-dev-1'), true);
  for (const to of EXECUTION_WALLET_STATUS.filter((s) => s !== 'REVOKED')) {
    assert.equal(reg.transition('exec-wallet-dev-1', to).ok, false, `REVOKED must not -> ${to}`);
  }
  assert.equal(isTerminalWalletStatus('REVOKED'), true);
  assert.equal(isTerminalWalletStatus('ACTIVE'), false);
});

test('DRAINING blocks new entry/admission and permits exit only', () => {
  const reg = withWallet();
  reg.transition('exec-wallet-dev-1', 'ACTIVE');
  assert.equal(reg.isActionAllowed('exec-wallet-dev-1', 'new_entry'), true); // ACTIVE
  reg.transition('exec-wallet-dev-1', 'DRAINING');
  assert.equal(reg.isActionAllowed('exec-wallet-dev-1', 'new_entry'), false);
  assert.equal(reg.isActionAllowed('exec-wallet-dev-1', 'new_admission'), false);
  assert.equal(reg.isActionAllowed('exec-wallet-dev-1', 'exit'), true);
});

test('only ACTIVE permits new entry/admission; unknown action denied', () => {
  const reg = withWallet(); // WARMING_UP
  assert.equal(reg.isActionAllowed('exec-wallet-dev-1', 'new_entry'), false);
  assert.equal(reg.isActionAllowed('exec-wallet-dev-1', 'new_admission'), false);
  assert.equal(reg.isActionAllowed('exec-wallet-dev-1', 'whatever'), false);
});

test('key material is refused on registration and never stored', () => {
  const reg = createExecutionWalletRegistry();
  for (const k of ['private_key', 'seed', 'mnemonic', 'keypair', 'secretKey']) {
    const r = reg.register({ ...wallet(), execution_wallet_id: 'k-' + k, [k]: 'SHOULD_NEVER' });
    assert.equal(r.reason, 'key_material_not_accepted', `${k} must be refused`);
  }
  assert.equal(reg.size, 0, 'no wallet with key material is stored');
});

// Strip comments AND string/template literals from .mjs so that the module's own
// key-material refusal list (FORBIDDEN_FIELDS string literals) is not a false positive.
const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

test('no signer-profile / admission-gate / key / signing / network / DB in CODE', () => {
  const BAD = /(signer_profile|\badmission\b|activate_execution_wallet|register_signer_profile|private[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|signTransaction|sendTransaction|\.serialize\(|@solana\/|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:fs|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(BAD.test(code), false, `forbidden mechanism/scope in ${fn}`);
  }
});

test('no Gate D/E artifacts and no forbidden names; no secrets', () => {
  const GATE_DE = /(asset_transfer|wallet_rotation|profit_sweep|wallet_assignment_policy|real[_-]?live|REAL_LIVE)/i;
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  // .mjs scanned as CODE (strings stripped); .json scanned raw (data must be clean).
  const mjs = readdirSync(SRC).filter((f) => f.endsWith('.mjs')).map((f) => join(SRC, f));
  for (const fn of mjs) {
    const code = stripCode(readFileSync(fn, 'utf8'));
    assert.equal(GATE_DE.test(code), false, `Gate D/E artifact in ${fn}`);
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
  }
  const fixtureRaw = readFileSync(join(HERE, '..', 'fixtures', 'execution-wallet.json'), 'utf8');
  assert.equal(SECRET.test(fixtureRaw), false, 'secret-like content in fixture');
  for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(fixtureRaw), false, `forbidden ${n} in fixture`);
});

test('S20-hardening: register() refuses null/uninspectable input, never throws', () => {
  const reg = createExecutionWalletRegistry();
  const hostile = new Proxy({}, { get() { throw new Error('boom'); }, has() { throw new Error('boom'); } });
  for (const bad of [null, undefined, 42, 'x', [], hostile]) {
    let r; assert.doesNotThrow(() => { r = reg.register(bad); });
    assert.equal(r.ok, false);
  }
});
