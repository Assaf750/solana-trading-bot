import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createSignerProfilesRegistry, isTerminalSignerStatus } from '../src/signer-profiles-registry.mjs';
import { SIGNER_PROFILE_STATUS, KEY_CUSTODY_MODE } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const SC = { permission_role: 'signer_control' };
const profile = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'signer-profile.json'), 'utf8'));

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

function withProfile() {
  const reg = createSignerProfilesRegistry();
  assert.equal(reg.register(profile(), SC).ok, true);
  return reg;
}

test('registration starts DISABLED (never auto-ACTIVE); enum custody validated', () => {
  const reg = withProfile();
  const p = reg.get('signer-profile-dev-1');
  assert.equal(p.signer_profile_status, 'DISABLED');
  assert.ok(SIGNER_PROFILE_STATUS.includes(p.signer_profile_status));
  assert.ok(KEY_CUSTODY_MODE.includes(p.key_custody_mode));
  assert.equal(reg.register({ signer_profile_id: 'x', key_custody_mode: 'bogus' }, SC).reason, 'invalid_key_custody_mode');
  assert.equal(reg.register(profile(), SC).reason, 'signer_profile_exists');
});

test('signer_control is required for sensitive ops (register/transition)', () => {
  const reg = createSignerProfilesRegistry();
  const r = reg.register(profile(), { permission_role: 'admin' }); // admin is NOT signer_control
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'PERMISSION_DENIED');
  assert.ok(API_ERROR_CODE.includes(r.api_error_code));
  reg.register(profile(), SC);
  assert.equal(reg.transition('signer-profile-dev-1', 'ACTIVE', { permission_role: 'operator' }).api_error_code, 'PERMISSION_DENIED');
});

test('legal transitions pass with signer_control', () => {
  const reg = withProfile();
  assert.equal(reg.transition('signer-profile-dev-1', 'ACTIVE', SC).ok, true);
  assert.equal(reg.transition('signer-profile-dev-1', 'DEGRADED', SC).ok, true);
  assert.equal(reg.transition('signer-profile-dev-1', 'ACTIVE', SC).ok, true);
});

test('illegal transition rejected with COMMAND_NOT_ALLOWED_IN_STATE', () => {
  const reg = withProfile(); // DISABLED
  const r = reg.transition('signer-profile-dev-1', 'DEGRADED', SC); // DISABLED -> DEGRADED not allowed
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.equal(reg.transition('signer-profile-dev-1', 'NOPE', SC).reason, 'invalid_signer_profile_status');
});

test('REVOKED is terminal', () => {
  const reg = withProfile();
  assert.equal(reg.transition('signer-profile-dev-1', 'REVOKED', SC).ok, true);
  assert.equal(reg.isTerminal('signer-profile-dev-1'), true);
  for (const to of SIGNER_PROFILE_STATUS.filter((s) => s !== 'REVOKED')) {
    assert.equal(reg.transition('signer-profile-dev-1', to, SC).ok, false, `REVOKED must not -> ${to}`);
  }
  assert.equal(isTerminalSignerStatus('REVOKED'), true);
  assert.equal(isTerminalSignerStatus('ACTIVE'), false);
});

test('key material is refused on registration and never stored', () => {
  const reg = createSignerProfilesRegistry();
  for (const k of ['private_key', 'seed', 'mnemonic', 'keypair', 'secretKey']) {
    const r = reg.register({ ...profile(), signer_profile_id: 'k-' + k, [k]: 'SHOULD_NEVER' }, SC);
    assert.equal(r.reason, 'key_material_not_accepted', `${k} must be refused`);
  }
  assert.equal(reg.size, 0);
});

test('references-only: no key material / KeyManager / signing-lib / admission / network / DB in CODE', () => {
  const BAD = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|KeyManager|@noble|tweetnacl|bs58|ed25519|web3|signTransaction|sendTransaction|\.serialize\(|@solana\/|admission|activate_execution_wallet|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:fs|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism/scope in ${fn}`);
  }
});

test('no Gate D/E artifacts, no forbidden names, no secrets', () => {
  const GATE_DE = /(asset_transfer|wallet_rotation|profit_sweep|wallet_assignment_policy|real[_-]?live|REAL_LIVE)/i;
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(GATE_DE.test(code), false, `Gate D/E artifact in ${fn}`);
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'signer-profile.json'), 'utf8');
  assert.equal(SECRET.test(fx), false, 'secret-like content in fixture');
});
