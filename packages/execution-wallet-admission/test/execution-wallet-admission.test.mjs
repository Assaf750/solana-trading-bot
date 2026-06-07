import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createAdmissionGate, ADMISSION_COMMAND } from '../src/index.mjs';
import { createExecutionWalletRegistry } from '../../execution-wallet-registry/src/index.mjs';
import { createSignerProfilesRegistry } from '../../signer-profiles-registry/src/index.mjs';
import { API_ERROR_CODE, PERMISSION_ROLE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const SC = { permission_role: 'signer_control' };
const scenario = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'admission-scenario.json'), 'utf8'));

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

// Build a fully-ready scenario: wallet registered (WARMING_UP) + signer registered & ACTIVE.
function buildReady(overrides = {}) {
  const sc = scenario();
  const walletRegistry = createExecutionWalletRegistry();
  const signerRegistry = createSignerProfilesRegistry();
  assert.equal(walletRegistry.register(sc.wallet).ok, true);
  assert.equal(signerRegistry.register(sc.signer, SC).ok, true);
  assert.equal(signerRegistry.transition(sc.signer.signer_profile_id, 'ACTIVE', SC).ok, true);
  const gate = createAdmissionGate({ walletRegistry, signerRegistry });
  const req = { ...sc.request, ...overrides };
  return { walletRegistry, signerRegistry, gate, req, sc };
}

test('command identity is the SSOT name; gate exposes only admission (no sign/send surface)', () => {
  const { gate } = buildReady();
  assert.equal(gate.command, 'activate_execution_wallet');
  assert.equal(ADMISSION_COMMAND, 'activate_execution_wallet');
  // No execution authority surface: the only callable is the admission gate.
  assert.deepEqual(Object.keys(gate).sort(), ['activateExecutionWallet', 'command']);
  for (const k of ['sign', 'send', 'submit', 'execute', 'buy', 'transfer']) {
    assert.equal(typeof gate[k], 'undefined', `gate must not expose ${k}()`);
  }
});

test('activates (WARMING_UP -> ACTIVE) ONLY when all conditions are met', () => {
  const { gate, walletRegistry, req, sc } = buildReady();
  assert.equal(walletRegistry.get(sc.wallet.execution_wallet_id).execution_wallet_status, 'WARMING_UP');
  const r = gate.activateExecutionWallet(req);
  assert.equal(r.ok, true);
  assert.equal(r.admitted, true);
  assert.equal(r.command, 'activate_execution_wallet');
  assert.equal(r.execution_wallet_status, 'ACTIVE');
  assert.equal(walletRegistry.get(sc.wallet.execution_wallet_id).execution_wallet_status, 'ACTIVE');
  // Admission != signing / != sending: result carries no signature/tx evidence.
  for (const k of ['signature', 'signed', 'tx', 'transaction', 'serialized', 'is_valid_on_chain']) {
    assert.equal(k in r, false, `result must not contain ${k}`);
  }
});

test('missing Hard Risk limit rejects with REAL_LIVE_CONFIG_INVALID (no fail-open, stays WARMING_UP)', () => {
  const sc = scenario();
  const incomplete = { ...sc.request.risk_config };
  delete incomplete.max_total_drawdown_pct; // drop one Hard Risk limit
  const { gate, walletRegistry } = buildReady({ risk_config: incomplete });
  const r = gate.activateExecutionWallet({ ...scenario().request, risk_config: incomplete });
  assert.equal(r.ok, false);
  assert.equal(r.admitted, false);
  assert.equal(r.api_error_code, 'REAL_LIVE_CONFIG_INVALID');
  assert.equal(walletRegistry.get(sc.wallet.execution_wallet_id).execution_wallet_status, 'WARMING_UP');
});

test('real_live_config_valid=false (no risk_config at all) -> REAL_LIVE_CONFIG_INVALID', () => {
  const { gate, walletRegistry, sc } = buildReady({ risk_config: undefined });
  const r = gate.activateExecutionWallet({ ...sc.request, risk_config: undefined });
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'REAL_LIVE_CONFIG_INVALID');
  assert.equal(walletRegistry.get(sc.wallet.execution_wallet_id).execution_wallet_status, 'WARMING_UP');
});

test('signer profile not ACTIVE -> COMMAND_NOT_ALLOWED_IN_STATE', () => {
  const sc = scenario();
  const walletRegistry = createExecutionWalletRegistry();
  const signerRegistry = createSignerProfilesRegistry();
  walletRegistry.register(sc.wallet);
  signerRegistry.register(sc.signer, SC); // stays DISABLED (not ACTIVE)
  const gate = createAdmissionGate({ walletRegistry, signerRegistry });
  const r = gate.activateExecutionWallet(sc.request);
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.equal(walletRegistry.get(sc.wallet.execution_wallet_id).execution_wallet_status, 'WARMING_UP');
});

test('wallet not WARMING_UP -> COMMAND_NOT_ALLOWED_IN_STATE', () => {
  const { gate, walletRegistry, sc, req } = buildReady();
  walletRegistry.transition(sc.wallet.execution_wallet_id, 'DISABLED'); // legal WARMING_UP -> DISABLED
  const r = gate.activateExecutionWallet(req);
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.equal(walletRegistry.get(sc.wallet.execution_wallet_id).execution_wallet_status, 'DISABLED');
});

test('funded=false rejects (fail-safe; stays WARMING_UP)', () => {
  const { gate, walletRegistry, req, sc } = buildReady({ funded: false });
  const r = gate.activateExecutionWallet(req);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'wallet_not_funded');
  assert.equal(walletRegistry.get(sc.wallet.execution_wallet_id).execution_wallet_status, 'WARMING_UP');
});

test('signer_reachable=false rejects (fail-safe)', () => {
  const { gate, req } = buildReady({ signer_reachable: false });
  const r = gate.activateExecutionWallet(req);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'signer_not_reachable');
});

test('key_custody_verified=false rejects (fail-safe)', () => {
  const { gate, req } = buildReady({ key_custody_verified: false });
  const r = gate.activateExecutionWallet(req);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'key_custody_not_verified');
});

test('insufficient permission -> PERMISSION_DENIED (operator cannot admit)', () => {
  const { gate, walletRegistry, sc, req } = buildReady();
  const r = gate.activateExecutionWallet({ ...req, permission_role: 'operator' });
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'PERMISSION_DENIED');
  assert.ok(API_ERROR_CODE.includes(r.api_error_code));
  assert.equal(walletRegistry.get(sc.wallet.execution_wallet_id).execution_wallet_status, 'WARMING_UP');
});

test('linking signer/custody requires signer_control (admin alone insufficient)', () => {
  const { gate, req } = buildReady();
  const r = gate.activateExecutionWallet({ ...req, permission_role: 'admin', links_signer_or_custody: true });
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'PERMISSION_DENIED');
  assert.ok(PERMISSION_ROLE.includes('signer_control'));
});

test('unknown wallet / unknown signer are rejected (not fail-open)', () => {
  const { gate, req } = buildReady();
  assert.equal(gate.activateExecutionWallet({ ...req, execution_wallet_id: 'nope' }).reason, 'execution_wallet_not_found');
  assert.equal(gate.activateExecutionWallet({ ...req, signer_profile_id: 'nope' }).reason, 'signer_profile_not_found');
});

test('gate requires both C0 and C1 registries (no silent construction)', () => {
  assert.throws(() => createAdmissionGate({}));
  assert.throws(() => createAdmissionGate({ walletRegistry: {} }));
});

test('CODE: no signing/sending/KeyManager/key-material/signing-lib/RPC/DB/Gate-D-E mechanisms', () => {
  const BAD = /(private[_-]?key|secret[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|KeyManager|@noble|tweetnacl|bs58|ed25519|web3|signTransaction|sendTransaction|sendRawTransaction|\.serialize\(|@solana\/|jupiter|helius|jito|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|node:fs|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: no Gate D/E artifacts, no forbidden SSOT names, no secrets in fixture', () => {
  const GATE_DE = /(asset_transfer|wallet_rotation|profit_sweep|wallet_assignment_policy)/i;
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(GATE_DE.test(code), false, `Gate D/E artifact in ${fn}`);
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'admission-scenario.json'), 'utf8');
  assert.equal(SECRET.test(fx), false, 'secret-like content in fixture');
  // Fixture carries no key material fields.
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair']) {
    assert.equal(fx.includes(k), false, `fixture must not contain ${k}`);
  }
});

test('CODE: no candidate_* promotion to implemented names introduced here', () => {
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    // This module defines no candidate_* at all; ensure none are declared/promoted.
    assert.equal(/candidate_/.test(code), false, `unexpected candidate_* reference in ${fn}`);
  }
});
