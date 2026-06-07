import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createGateCHarness, provisionAndAdmit, walletStatus } from '../src/index.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';
import { LIFECYCLE_COMMANDS } from '../../execution-wallet-lifecycle/src/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sc = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'gate-c-scenario.json'), 'utf8'));

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

const actor = (f, role) => ({ execution_wallet_id: f.wallet.execution_wallet_id, permission_role: role, audit_actor: f.audit_actor });

// ---- C0→C1→C2→C3 integration: single execution wallet usable end-to-end ----

test('single wallet: register -> admit ACTIVE -> drain (DRAINING) [full integration]', () => {
  const f = sc();
  const h = createGateCHarness();
  const t = provisionAndAdmit(h, f);
  assert.equal(t.register.ok, true);
  assert.equal(t.status_before_admission, 'WARMING_UP');   // C0: starts WARMING_UP
  assert.equal(t.activate_signer.ok, true);                // C1: signer ACTIVE via signer_control
  assert.equal(t.admission.ok, true);                      // C2: all conditions + real_live_config_valid
  assert.equal(t.status_after_admission, 'ACTIVE');        // C2: WARMING_UP -> ACTIVE
  const r = h.lifecycle.drainExecutionWallet(actor(f, 'admin')); // C3
  assert.equal(r.ok, true);
  assert.equal(walletStatus(h, f.wallet.execution_wallet_id), 'DRAINING');
});

test('single wallet path can end in DISABLED (admit -> disable)', () => {
  const f = sc();
  const h = createGateCHarness();
  provisionAndAdmit(h, f);
  const r = h.lifecycle.disableExecutionWallet(actor(f, 'signer_control'));
  assert.equal(r.ok, true);
  assert.equal(walletStatus(h, f.wallet.execution_wallet_id), 'DISABLED');
});

test('single wallet path can end in REVOKED (admit -> revoke) and REVOKED is terminal', () => {
  const f = sc();
  const h = createGateCHarness();
  provisionAndAdmit(h, f);
  assert.equal(h.lifecycle.revokeExecutionWallet(actor(f, 'signer_control')).ok, true);
  assert.equal(walletStatus(h, f.wallet.execution_wallet_id), 'REVOKED');
  assert.equal(h.walletRegistry.isTerminal(f.wallet.execution_wallet_id), true);
  for (const cmd of ['drainExecutionWallet', 'disableExecutionWallet', 'revokeExecutionWallet']) {
    assert.equal(h.lifecycle[cmd](actor(f, 'signer_control')).api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  }
});

test('admission fails -> wallet stays WARMING_UP (missing Hard Risk -> REAL_LIVE_CONFIG_INVALID)', () => {
  const f = sc();
  delete f.request.risk_config.max_total_drawdown_pct;
  const h = createGateCHarness();
  const t = provisionAndAdmit(h, f);
  assert.equal(t.admission.ok, false);
  assert.equal(t.admission.api_error_code, 'REAL_LIVE_CONFIG_INVALID');
  assert.equal(t.status_after_admission, 'WARMING_UP');
});

// ---- C1: signer_profiles references-only ----

test('C1 signer profile is references-only (no key material on record)', () => {
  const f = sc();
  const h = createGateCHarness();
  provisionAndAdmit(h, f);
  const rec = h.signerRegistry.get(f.signer.signer_profile_id);
  assert.deepEqual(Object.keys(rec).sort(), ['key_custody_mode', 'signer_profile_id', 'signer_profile_status']);
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair', 'secretKey']) {
    assert.equal(k in rec, false, `signer record must not carry ${k}`);
  }
  // Registry exposes no signing surface.
  for (const k of ['sign', 'send', 'load', 'export', 'getKey']) assert.equal(typeof h.signerRegistry[k], 'undefined');
});

// ---- Permission separation: admin vs signer_control ----

test('revoke REQUIRES signer_control; admin is NOT sufficient', () => {
  const f = sc();
  const h = createGateCHarness();
  provisionAndAdmit(h, f);
  const denied = h.lifecycle.revokeExecutionWallet(actor(f, 'admin'));
  assert.equal(denied.ok, false);
  assert.equal(denied.api_error_code, 'PERMISSION_DENIED');
  assert.equal(walletStatus(h, f.wallet.execution_wallet_id), 'ACTIVE'); // unchanged
  assert.equal(h.lifecycle.revokeExecutionWallet(actor(f, 'signer_control')).ok, true);
});

test('drain/disable accept admin or signer_control only (viewer/operator denied)', () => {
  const f = sc();
  for (const role of ['viewer', 'operator']) {
    const h = createGateCHarness(); provisionAndAdmit(h, f);
    assert.equal(h.lifecycle.drainExecutionWallet(actor(f, role)).api_error_code, 'PERMISSION_DENIED');
  }
  for (const role of ['admin', 'signer_control']) {
    const h = createGateCHarness(); provisionAndAdmit(h, f);
    assert.equal(h.lifecycle.drainExecutionWallet(actor(f, role)).ok, true);
  }
});

// ---- Audit: append-only in-memory for every attributed security command ----

test('audit exists for every attributed security command (success AND failure), append-only', () => {
  const f = sc();
  const h = createGateCHarness();
  provisionAndAdmit(h, f);
  h.lifecycle.drainExecutionWallet(actor(f, 'admin'));                 // success
  h.lifecycle.revokeExecutionWallet(actor(f, 'admin'));               // denied (admin can't revoke)
  h.lifecycle.disableExecutionWallet(actor(f, 'signer_control'));     // illegal from DRAINING
  const entries = h.auditLog.list();
  assert.equal(entries.length, 3);
  for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof h.auditLog[m], 'undefined');
  for (const e of entries) {
    for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k} not in AUDIT_COLUMNS`);
    assert.equal(e.resource_type, 'execution_wallet');
    assert.equal(e.audit_scope, 'execution_wallet');
    assert.ok(LIFECYCLE_COMMANDS.includes(e.command_type));
    assert.ok(typeof e.audit_actor === 'string' && e.audit_actor.length > 0);
  }
  assert.equal(entries[1].api_error_code, 'PERMISSION_DENIED');
  assert.equal(entries[2].api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
});

// ---- Harness exposes NO execution authority ----

test('harness exposes no signing/sending/transfer/execute surface', () => {
  const h = createGateCHarness();
  for (const k of ['sign', 'send', 'submit', 'execute', 'transfer', 'sweep', 'rotate', 'buy']) {
    assert.equal(typeof h[k], 'undefined', `harness must not expose ${k}()`);
  }
  // lifecycle surface is exactly the three security commands (+ commands/auditLog).
  assert.deepEqual(Object.keys(h.lifecycle).sort(), ['auditLog', 'commands', 'disableExecutionWallet', 'drainExecutionWallet', 'revokeExecutionWallet']);
});

// ---- Code governance scans (comment/string-stripped) ----

test('CODE: no Gate-D/Gate-E, no asset_transfer/rotation/sweep, no REAL-LIVE artifacts', () => {
  const BAD = /(asset_transfer|wallet_rotation|profit_sweep|wallet_assignment_policy|rotate_execution_wallet|sweep_profits|activate_real_live|real[_-]?live)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden Gate D/E artifact in ${fn}`);
  }
});

test('CODE: no signing/sending/serialization/KeyManager/key-material/signing-lib/RPC/DB', () => {
  const BAD = /(private[_-]?key|secret[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|KeyManager|@noble|tweetnacl|bs58|ed25519|web3|signTransaction|sendTransaction|sendRawTransaction|\.serialize\(|@solana\/|jupiter|helius|jito|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: no candidate_* references; fixture carries no key material/secrets', () => {
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(/candidate_/.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `candidate_* in ${fn}`);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'gate-c-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i.test(fx), false, 'secret-like content in fixture');
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair']) {
    assert.equal(fx.includes(k), false, `fixture must not contain ${k}`);
  }
});
