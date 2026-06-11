import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createExecutionWalletLifecycle, LIFECYCLE_COMMANDS } from '../src/index.mjs';
import { createExecutionWalletRegistry } from '../../execution-wallet-registry/src/index.mjs';
import { createAuditLog } from '../../data/src/index.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';
import { API_ERROR_CODE, PERMISSION_ROLE } from '../../contracts/src/api-vocabulary.mjs';
import { EXECUTION_WALLET_STATUS } from '../../ssot-types/src/core-enums.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const sc = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'lifecycle-scenario.json'), 'utf8'));

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

// Build a registry with one registered wallet (WARMING_UP) + an injected in-memory audit log.
function build() {
  const f = sc();
  const walletRegistry = createExecutionWalletRegistry();
  assert.equal(walletRegistry.register(f.wallet).ok, true);
  const auditLog = createAuditLog();
  const lc = createExecutionWalletLifecycle({ walletRegistry, auditLog });
  return { walletRegistry, auditLog, lc, f, id: f.wallet.execution_wallet_id };
}
const statusOf = (reg, id) => reg.get(id).execution_wallet_status;

test('command catalog matches SSOT names; all target states are valid execution_wallet_status', () => {
  assert.deepEqual([...LIFECYCLE_COMMANDS].sort(), ['disable_execution_wallet', 'drain_execution_wallet', 'revoke_execution_wallet']);
  for (const s of ['DRAINING', 'DISABLED', 'REVOKED']) assert.ok(EXECUTION_WALLET_STATUS.includes(s));
});

test('drain transitions to DRAINING only — and creates NO asset transfer', () => {
  const { lc, walletRegistry, f, id } = build();
  const r = lc.drainExecutionWallet(f.drain_request);
  assert.equal(r.ok, true);
  assert.equal(r.execution_wallet_status, 'DRAINING');
  assert.equal(statusOf(walletRegistry, id), 'DRAINING');
  // No asset transfer is produced: result has no transfer fields, record only changed status.
  for (const k of ['asset_transfer_intent_id', 'asset_transfer_status', 'amount', 'destination_execution_wallet_id', 'tx', 'signature']) {
    assert.equal(k in r, false, `drain result must not contain ${k}`);
  }
  const rec = walletRegistry.get(id);
  for (const k of Object.keys(rec)) {
    assert.equal(/transfer|amount|balance|signature|tx/i.test(k), false, `wallet record must not gain ${k}`);
  }
});

test('disable transitions to DISABLED', () => {
  const { lc, walletRegistry, f, id } = build();
  const r = lc.disableExecutionWallet(f.disable_request);
  assert.equal(r.ok, true);
  assert.equal(r.execution_wallet_status, 'DISABLED');
  assert.equal(statusOf(walletRegistry, id), 'DISABLED');
});

test('revoke transitions to REVOKED', () => {
  const { lc, walletRegistry, f, id } = build();
  const r = lc.revokeExecutionWallet(f.revoke_request);
  assert.equal(r.ok, true);
  assert.equal(r.execution_wallet_status, 'REVOKED');
  assert.equal(statusOf(walletRegistry, id), 'REVOKED');
});

test('REVOKED is terminal — no further lifecycle command succeeds', () => {
  const { lc, walletRegistry, f, id } = build();
  assert.equal(lc.revokeExecutionWallet(f.revoke_request).ok, true);
  assert.equal(walletRegistry.isTerminal(id), true);
  const after = [
    lc.drainExecutionWallet({ ...f.drain_request }),
    lc.disableExecutionWallet({ ...f.disable_request }),
    lc.revokeExecutionWallet({ ...f.revoke_request }),
  ];
  for (const r of after) {
    assert.equal(r.ok, false);
    assert.equal(r.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  }
  assert.equal(statusOf(walletRegistry, id), 'REVOKED');
});

test('signer_control is REQUIRED for revoke (admin is rejected)', () => {
  const { lc, walletRegistry, f, id } = build();
  const r = lc.revokeExecutionWallet({ ...f.revoke_request, permission_role: 'admin' });
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'PERMISSION_DENIED');
  assert.ok(API_ERROR_CODE.includes(r.api_error_code));
  assert.ok(PERMISSION_ROLE.includes('signer_control'));
  assert.equal(statusOf(walletRegistry, id), 'WARMING_UP'); // unchanged
});

test('drain/disable reject insufficient roles (viewer/operator) with PERMISSION_DENIED', () => {
  const { lc, walletRegistry, f, id } = build();
  for (const role of ['viewer', 'operator']) {
    assert.equal(lc.drainExecutionWallet({ ...f.drain_request, permission_role: role }).api_error_code, 'PERMISSION_DENIED');
    assert.equal(lc.disableExecutionWallet({ ...f.disable_request, permission_role: role }).api_error_code, 'PERMISSION_DENIED');
  }
  assert.equal(statusOf(walletRegistry, id), 'WARMING_UP');
});

test('illegal transition (disable a DRAINING wallet) -> COMMAND_NOT_ALLOWED_IN_STATE', () => {
  const { lc, walletRegistry, f, id } = build();
  assert.equal(lc.drainExecutionWallet(f.drain_request).ok, true); // -> DRAINING
  const r = lc.disableExecutionWallet(f.disable_request);          // DRAINING -> DISABLED is illegal
  assert.equal(r.ok, false);
  assert.equal(r.api_error_code, 'COMMAND_NOT_ALLOWED_IN_STATE');
  assert.equal(statusOf(walletRegistry, id), 'DRAINING');
});

test('audit is append-only in-memory, one entry per attributed command (success AND failure)', () => {
  const { lc, auditLog, f } = build();
  lc.drainExecutionWallet(f.drain_request);                                   // success
  lc.revokeExecutionWallet({ ...f.revoke_request, permission_role: 'admin' }); // denied
  lc.disableExecutionWallet({ ...f.disable_request, execution_wallet_id: 'nope' }); // not found
  const entries = auditLog.list();
  assert.equal(entries.length, 3);
  // Append-only by construction: no mutation surface.
  for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof auditLog[m], 'undefined', `audit must not expose ${m}`);
  // Every entry uses only SSOT audit columns and carries the command + resource + actor.
  for (const e of entries) {
    for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k} must be an AUDIT_COLUMN`);
    assert.equal(e.resource_type, 'execution_wallet');
    assert.equal(e.audit_scope, 'execution_wallet');
    assert.ok(LIFECYCLE_COMMANDS.includes(e.command_type));
    assert.ok(typeof e.audit_actor === 'string' && e.audit_actor.length > 0);
  }
  assert.equal(entries[0].audit_reason.includes('DRAINING'), true);
  assert.equal(entries[1].api_error_code, 'PERMISSION_DENIED');
});

test('command without audit_actor is rejected before any transition (no audit append)', () => {
  const { lc, auditLog, walletRegistry, f, id } = build();
  const r = lc.drainExecutionWallet({ ...f.drain_request, audit_actor: undefined });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'audit_actor_required');
  assert.equal(auditLog.list().length, 0);
  assert.equal(statusOf(walletRegistry, id), 'WARMING_UP');
});

test('wallet stays WARMING_UP on any failure; gate exposes no execution authority', () => {
  const { lc, walletRegistry, f, id } = build();
  lc.drainExecutionWallet({ ...f.drain_request, permission_role: 'viewer' }); // denied
  assert.equal(statusOf(walletRegistry, id), 'WARMING_UP');
  // No sign/send/transfer/execute surface.
  for (const k of ['sign', 'send', 'submit', 'execute', 'transfer', 'buy', 'sweep', 'rotate']) {
    assert.equal(typeof lc[k], 'undefined', `lifecycle must not expose ${k}()`);
  }
});

test('requires the C0 walletRegistry (no silent construction)', () => {
  assert.throws(() => createExecutionWalletLifecycle({}));
  assert.throws(() => createExecutionWalletLifecycle({ walletRegistry: {} }));
});

test('CODE: no asset_transfer / wallet_rotation / profit_sweep / assignment-policy artifacts', () => {
  const BAD = /(asset_transfer|wallet_rotation|profit_sweep|wallet_assignment_policy|rotate_execution_wallet|sweep_profits|create_asset_transfer_intent)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `transfer/rotation/sweep artifact in ${fn}`);
  }
});

test('CODE: no signing/sending/serialization/KeyManager/key-material/signing-lib/RPC/DB mechanisms', () => {
  const BAD = /(private[_-]?key|secret[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|KeyManager|@noble|tweetnacl|bs58|ed25519|web3|signTransaction|sendTransaction|sendRawTransaction|\.serialize\(|@solana\/|jupiter|helius|jito|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: no REAL-LIVE / Gate-D-E, no forbidden SSOT names, no candidate_*, no secrets in fixture', () => {
  const LIVE = /(activate_real_live|real[_-]?live|REAL_LIVE)/i;
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  const SECRET = /(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(LIVE.test(code), false, `REAL-LIVE/Gate-D-E artifact in ${fn}`);
    assert.equal(/candidate_/.test(code), false, `candidate_* reference in ${fn}`);
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
  }
  const fx = readFileSync(join(HERE, '..', 'fixtures', 'lifecycle-scenario.json'), 'utf8');
  assert.equal(SECRET.test(fx), false, 'secret-like content in fixture');
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair']) {
    assert.equal(fx.includes(k), false, `fixture must not contain ${k}`);
  }
});

test('S20-hardening: lifecycle commands refuse null/uninspectable input, never throw', () => {
  const lc = createExecutionWalletLifecycle({ walletRegistry: createExecutionWalletRegistry(), auditLog: createAuditLog() });
  const hostile = new Proxy({}, { get() { throw new Error('boom'); } });
  for (const bad of [null, undefined, 42, 'x', [], hostile]) {
    let r; assert.doesNotThrow(() => { r = lc.drainExecutionWallet(bad); });
    assert.equal(r.ok, false);
  }
});
