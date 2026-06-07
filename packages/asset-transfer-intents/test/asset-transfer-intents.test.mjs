import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createAssetTransferIntents, isTerminalTransferStatus } from '../src/index.mjs';
import { createExecutionWalletRegistry } from '../../execution-wallet-registry/src/index.mjs';
import { createAuditLog } from '../../data/src/index.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';
import { ASSET_TRANSFER_STATUS } from '../../ssot-types/src/core-enums.mjs';
import { API_ERROR_CODE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sc = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'transfer-scenario.json'), 'utf8'));
const ADMIN = { permission_role: 'admin', audit_actor: 'operator-dev-1' };

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

// Registry with both wallets ACTIVE (so destination is eligible).
function withRegistry() {
  const f = sc();
  const reg = createExecutionWalletRegistry();
  for (const w of f.wallets) reg.register(w);
  for (const w of f.wallets) reg.transition(w.execution_wallet_id, 'ACTIVE');
  return reg;
}
const newLedger = () => createAssetTransferIntents({ walletRegistry: withRegistry() });

test('create starts PENDING; ownership stays source', () => {
  const led = newLedger();
  const r = led.createAssetTransferIntent({ ...sc().create_request });
  assert.equal(r.ok, true);
  assert.equal(r.asset_transfer_status, 'PENDING');
  assert.equal(r.position_owner_wallet_id, 'exec-wallet-src');
  assert.equal(led.ownerOf('ati-dev-1'), 'exec-wallet-src');
});

test('submit -> SUBMITTED only, does NOT flip ownership', () => {
  const led = newLedger();
  led.createAssetTransferIntent({ ...sc().create_request });
  const s = led.simulate('ati-dev-1', 'SUBMITTED');
  assert.equal(s.ok, true);
  assert.equal(s.asset_transfer_status, 'SUBMITTED');
  assert.equal(led.ownerOf('ati-dev-1'), 'exec-wallet-src'); // unchanged
});

test('confirm -> CONFIRMED flips position_owner_wallet_id to destination', () => {
  const led = newLedger();
  led.createAssetTransferIntent({ ...sc().create_request });
  led.simulate('ati-dev-1', 'SUBMITTED');
  const c = led.simulate('ati-dev-1', 'CONFIRMED');
  assert.equal(c.ok, true);
  assert.equal(c.asset_transfer_status, 'CONFIRMED');
  assert.equal(c.position_owner_wallet_id, 'exec-wallet-dst');
  assert.equal(led.ownerOf('ati-dev-1'), 'exec-wallet-dst'); // flipped
  assert.equal(led.isTerminal('ati-dev-1'), true);
});

test('ownership flips ONLY on CONFIRMED (cannot confirm directly from PENDING)', () => {
  const led = newLedger();
  led.createAssetTransferIntent({ ...sc().create_request });
  const bad = led.simulate('ati-dev-1', 'CONFIRMED'); // PENDING -> CONFIRMED illegal
  assert.equal(bad.ok, false);
  assert.equal(bad.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.equal(led.ownerOf('ati-dev-1'), 'exec-wallet-src'); // still source
});

test('FAILED and CANCELLED are terminal and never flip ownership', () => {
  for (const path of [['SUBMITTED', 'FAILED'], ['PENDING-cancel']]) {
    const led = newLedger();
    led.createAssetTransferIntent({ ...sc().create_request });
    if (path[0] === 'PENDING-cancel') {
      assert.equal(led.cancelAssetTransferIntent('ati-dev-1', ADMIN).asset_transfer_status, 'CANCELLED');
    } else {
      led.simulate('ati-dev-1', 'SUBMITTED');
      assert.equal(led.simulate('ati-dev-1', 'FAILED').asset_transfer_status, 'FAILED');
    }
    assert.equal(led.isTerminal('ati-dev-1'), true);
    assert.equal(led.ownerOf('ati-dev-1'), 'exec-wallet-src'); // never flipped
    assert.equal(isTerminalTransferStatus(led.get('ati-dev-1').asset_transfer_status), true);
  }
});

test('cancel before terminal works (PENDING direct; SUBMITTED simulated, no on-chain guarantee)', () => {
  const led1 = newLedger();
  led1.createAssetTransferIntent({ ...sc().create_request });
  const c1 = led1.cancelAssetTransferIntent('ati-dev-1', ADMIN);
  assert.equal(c1.ok, true); assert.equal(c1.simulated_cancel_after_submitted, false);

  const led2 = newLedger();
  led2.createAssetTransferIntent({ ...sc().create_request });
  led2.simulate('ati-dev-1', 'SUBMITTED');
  const c2 = led2.cancelAssetTransferIntent('ati-dev-1', ADMIN);
  assert.equal(c2.ok, true); assert.equal(c2.simulated_cancel_after_submitted, true); // documented: simulated only
});

test('cancel after terminal is rejected with COMMAND_NOT_ALLOWED_IN_STATE', () => {
  const led = newLedger();
  led.createAssetTransferIntent({ ...sc().create_request });
  led.simulate('ati-dev-1', 'SUBMITTED');
  led.simulate('ati-dev-1', 'CONFIRMED');
  const r = led.cancelAssetTransferIntent('ati-dev-1', ADMIN);
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.ok(API_ERROR_CODE.includes(r.api_error_code));
});

test('duplicate idempotency_key (and duplicate id) reject with IDEMPOTENCY_CONFLICT', () => {
  const led = newLedger();
  assert.equal(led.createAssetTransferIntent({ ...sc().create_request }).ok, true);
  const dupKey = led.createAssetTransferIntent({ ...sc().create_request, asset_transfer_intent_id: 'ati-other' });
  assert.equal(dupKey.api_error_code, 'IDEMPOTENCY_CONFLICT'); // same idempotency_key
  const dupId = led.createAssetTransferIntent({ ...sc().create_request, idempotency_key: 'idem-2' });
  assert.equal(dupId.api_error_code, 'IDEMPOTENCY_CONFLICT'); // same asset_transfer_intent_id
});

test('source and destination cannot be the same wallet', () => {
  const led = newLedger();
  const r = led.createAssetTransferIntent({ ...sc().create_request, destination_execution_wallet_id: 'exec-wallet-src', position_owner_wallet_id: 'exec-wallet-src' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'source_equals_destination');
});

test('source must match the current owner (position_owner_wallet_id)', () => {
  const led = newLedger();
  const r = led.createAssetTransferIntent({ ...sc().create_request, position_owner_wallet_id: 'exec-wallet-dst' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'source_not_current_owner');
});

test('destination must be ACTIVE/eligible when C0 registry is consumed', () => {
  const f = sc();
  const reg = createExecutionWalletRegistry();
  for (const w of f.wallets) reg.register(w);
  reg.transition('exec-wallet-src', 'ACTIVE'); // dst stays WARMING_UP (not eligible)
  const led = createAssetTransferIntents({ walletRegistry: reg });
  const r = led.createAssetTransferIntent({ ...f.create_request });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'destination_not_eligible');
});

test('admin is required for create and cancel; missing audit_actor rejected pre-effect', () => {
  const led = newLedger();
  assert.equal(led.createAssetTransferIntent({ ...sc().create_request, permission_role: 'operator' }).api_error_code, 'PERMISSION_DENIED');
  assert.equal(led.createAssetTransferIntent({ ...sc().create_request, audit_actor: undefined }).reason, 'audit_actor_required');
  assert.equal(led.size, 0);
  led.createAssetTransferIntent({ ...sc().create_request });
  assert.equal(led.cancelAssetTransferIntent('ati-dev-1', { permission_role: 'viewer', audit_actor: 'x' }).api_error_code, 'PERMISSION_DENIED');
});

test('audit is append-only in-memory, one entry per attributed command (success AND failure)', () => {
  const auditLog = createAuditLog();
  const led = createAssetTransferIntents({ walletRegistry: withRegistry(), auditLog });
  led.createAssetTransferIntent({ ...sc().create_request });                                 // success
  led.createAssetTransferIntent({ ...sc().create_request, permission_role: 'operator' });    // denied
  led.cancelAssetTransferIntent('ati-dev-1', ADMIN);                                         // success
  const entries = auditLog.list();
  assert.equal(entries.length, 3);
  for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof auditLog[m], 'undefined');
  for (const e of entries) {
    for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k} not in AUDIT_COLUMNS`);
    assert.equal(e.resource_type, 'asset_transfer');
    assert.equal(e.audit_scope, 'asset_transfer');
    assert.ok(['create_asset_transfer_intent', 'cancel_asset_transfer_intent'].includes(e.command_type));
    assert.ok(typeof e.audit_actor === 'string' && e.audit_actor.length > 0);
  }
  assert.equal(entries[1].api_error_code, 'PERMISSION_DENIED');
});

test('simulate is engine-only and exposes no execution authority / no real transfer', () => {
  const led = newLedger();
  for (const k of ['sign', 'send', 'submit', 'execute', 'transfer', 'sweep', 'rotate', 'broadcast', 'serialize']) {
    assert.equal(typeof led[k], 'undefined', `ledger must not expose ${k}()`);
  }
  // all simulate target values are SSOT asset_transfer_status values
  for (const s of ['SUBMITTED', 'CONFIRMED', 'FAILED', 'CANCELLED', 'PENDING']) assert.ok(ASSET_TRANSFER_STATUS.includes(s));
  assert.equal(led.simulate('nope', 'SUBMITTED').reason, 'asset_transfer_intent_not_found');
});

// ---- code governance scans (comment/string-stripped) ----

test('CODE: no live transfer / transfer-boundary / token-transfer / rotation / sweep', () => {
  const BAD = /(transfer[_-]?boundary|token[_-]?transfer|live[_-]?transfer|wallet_rotation|profit_sweep|rotate_execution_wallet|sweep_profits)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden artifact in ${fn}`);
  }
});

test('CODE: no tx build/serialize/sign/send, KeyManager, key material, signing-lib, RPC/DB, REAL-LIVE', () => {
  const BAD = /(private[_-]?key|secret[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|KeyManager|@noble|tweetnacl|bs58|ed25519|web3|signTransaction|sendTransaction|sendRawTransaction|\.serialize\(|@solana\/|jupiter|helius|jito|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool|activate_real_live|real[_-]?live)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: no candidate_*; no forbidden SSOT names; no secrets in fixture', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/candidate_/.test(code), false, `candidate_* in ${fn}`);
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'transfer-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b)/i.test(fx), false, 'secret-like content in fixture');
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair']) {
    assert.equal(fx.includes(k), false, `fixture must not contain ${k}`);
  }
});
