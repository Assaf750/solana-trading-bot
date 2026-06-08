import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createKeylessCustodyLifecycle, CUSTODY_PHASE } from '../src/index.mjs';
import { createAuditLog } from '../../data/src/index.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';
import { COMMAND_TYPE } from '../../contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';
import { runMechanismGuard, ALLOWLIST } from '../../../tools/check-mechanism-guards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const fx = () => JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'custody-scenario.json'), 'utf8'));
const load = () => fx().load_request;
const SC = () => fx().signer_control_ctx;

const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

const NO_SIG = (r) => {
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
  assert.equal(r.is_valid_on_chain, false);
  assert.equal(r.can_sign, false);
  assert.equal(r.can_send, false);
};

test('custody model refuses any key material input; nothing stored or returned', () => {
  const c = createKeylessCustodyLifecycle();
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair', 'secretKey']) {
    const r = c.requestLoad({ ...load(), [k]: 'SHOULD_NEVER' });
    assert.equal(r.refusal_reason, 'key_material_not_accepted');
    NO_SIG(r);
  }
  assert.equal(c.list().length, 0); // nothing stored
});

test('ACTIVE + isolated_signer + matching id loads to a mock usable state — but NO signature', () => {
  const c = createKeylessCustodyLifecycle();
  const r = c.requestLoad(load());
  assert.equal(r.ok, true);
  assert.equal(r.loaded, true);
  assert.equal(r.usable, true);
  assert.equal(r.custody_phase, CUSTODY_PHASE.LOADED);
  NO_SIG(r); // never a signature
  const u = c.use(load());
  assert.equal(u.ok, true); assert.equal(u.usable, true);
  NO_SIG(u);
});

test('custody unavailable => fail-closed DEGRADED (no load)', () => {
  const c = createKeylessCustodyLifecycle();
  const r = c.requestLoad({ ...load(), custody_available: false });
  assert.equal(r.ok, false);
  assert.equal(r.refusal_reason, 'custody_unavailable_degraded');
  assert.equal(r.custody_phase, CUSTODY_PHASE.DEGRADED);
  assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  assert.equal(c.get(load().signer_profile_id).custody_phase, CUSTODY_PHASE.DEGRADED);
});

test('reportCustodyFailure transitions to DEGRADED (fail-closed)', () => {
  const c = createKeylessCustodyLifecycle();
  const r = c.reportCustodyFailure({ signer_profile_id: 'signer-profile-dev-1', audit_actor: 'op' });
  assert.equal(r.ok, true);
  assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  assert.equal(c.get('signer-profile-dev-1').custody_phase, CUSTODY_PHASE.DEGRADED);
});

test('DISABLED / REVOKED / DEGRADED signer status is rejected for load', () => {
  const c = createKeylessCustodyLifecycle();
  for (const s of ['DISABLED', 'REVOKED', 'DEGRADED']) {
    assert.equal(c.requestLoad({ ...load(), signer_profile_status: s }).refusal_reason, 'signer_not_active');
  }
  assert.equal(c.requestLoad({ ...load(), signer_profile_status: 'bogus' }).refusal_reason, 'invalid_signer_profile_status');
});

test('non isolated_signer custody mode is rejected', () => {
  const c = createKeylessCustodyLifecycle();
  assert.equal(c.requestLoad({ ...load(), key_custody_mode: 'connected_wallet' }).refusal_reason, 'custody_not_isolated_signer');
  assert.equal(c.requestLoad({ ...load(), key_custody_mode: undefined }).refusal_reason, 'custody_not_isolated_signer');
});

test('least-privilege: a session for one profile is not usable by another id', () => {
  const c = createKeylessCustodyLifecycle();
  c.requestLoad(load()); // loads signer-profile-dev-1
  // use with a different id has no loaded session -> not_loaded (no access to dev-1)
  assert.equal(c.use({ ...load(), signer_profile_id: 'signer-profile-other' }).refusal_reason, 'not_loaded');
  // missing id
  assert.equal(c.requestLoad({ ...load(), signer_profile_id: undefined }).refusal_reason, 'missing_signer_profile_id');
});

test('revoke (signer_control) => simulated zeroize + terminal/unusable', () => {
  const c = createKeylessCustodyLifecycle();
  c.requestLoad(load());
  const r = c.revoke('signer-profile-dev-1', SC());
  assert.equal(r.ok, true); assert.equal(r.revoked, true); assert.equal(r.zeroized, true);
  assert.equal(r.custody_phase, CUSTODY_PHASE.ZEROIZED);
  // unusable afterward
  assert.equal(c.requestLoad(load()).refusal_reason, 'session_zeroized');
  assert.equal(c.use(load()).refusal_reason, 'session_zeroized');
  // revoke requires signer_control
  assert.equal(c.revoke('signer-profile-x', { audit_actor: 'op', permission_role: 'admin' }).refusal_reason, 'signer_control_required');
});

test('disable (signer_control) makes the session unusable', () => {
  const c = createKeylessCustodyLifecycle();
  c.requestLoad(load());
  assert.equal(c.disable('signer-profile-dev-1', SC()).ok, true);
  assert.equal(c.requestLoad(load()).refusal_reason, 'session_disabled');
  assert.equal(c.disable('signer-profile-dev-1', { audit_actor: 'op', permission_role: 'operator' }).refusal_reason, 'signer_control_required');
});

test('zeroize is idempotent (re-zeroize is a no-op success)', () => {
  const c = createKeylessCustodyLifecycle();
  c.requestLoad(load());
  const z1 = c.zeroize('signer-profile-dev-1', { audit_actor: 'op' });
  assert.equal(z1.ok, true); assert.equal(z1.idempotent, false);
  const z2 = c.zeroize('signer-profile-dev-1', { audit_actor: 'op' });
  assert.equal(z2.ok, true); assert.equal(z2.idempotent, true);
  assert.equal(c.get('signer-profile-dev-1').custody_phase, CUSTODY_PHASE.ZEROIZED);
});

test('shutdown / panic simulate zeroize of all sessions', () => {
  const c = createKeylessCustodyLifecycle();
  c.requestLoad(load());
  c.requestLoad({ ...load(), signer_profile_id: 'signer-profile-dev-2' });
  const s = c.shutdown({ audit_actor: 'op' });
  assert.equal(s.ok, true); assert.equal(s.zeroized_sessions, 2);
  for (const sess of c.list()) assert.equal(sess.custody_phase, CUSTODY_PHASE.ZEROIZED);
  const p = c.panic({ audit_actor: 'op' });
  assert.equal(p.ok, true); // idempotent at all-zeroized
});

test('audit append-only in-memory for every attributed lifecycle/security event; keys in AUDIT_COLUMNS', () => {
  const auditLog = createAuditLog();
  const c = createKeylessCustodyLifecycle({ auditLog });
  c.requestLoad(load());                                   // attempt + loaded
  c.requestLoad({ ...load(), custody_available: false, signer_profile_id: 'p2' }); // attempt + degraded
  c.revoke('signer-profile-dev-1', SC());                 // revoked (command_type)
  const entries = auditLog.list();
  assert.ok(entries.length >= 5);
  for (const m of ['update', 'delete', 'clear', 'remove', 'set']) assert.equal(typeof auditLog[m], 'undefined');
  for (const e of entries) {
    for (const k of Object.keys(e)) assert.ok(AUDIT_COLUMNS.includes(k), `audit key ${k} not in AUDIT_COLUMNS`);
    assert.equal(e.resource_type, 'signer_profile');
    assert.equal(e.audit_scope, 'signer_profile');
  }
  const revokeEntry = entries.find((e) => e.command_type === 'revoke_signer_profile');
  assert.ok(revokeEntry, 'revoke uses revoke_signer_profile command_type');
  assert.ok(COMMAND_TYPE.includes('revoke_signer_profile') && COMMAND_TYPE.includes('disable_signer_profile'));
});

test('missing audit_actor => refused before any effect', () => {
  const c = createKeylessCustodyLifecycle();
  const noActor = { ...load() }; delete noActor.audit_actor;
  assert.equal(c.requestLoad(noActor).refusal_reason, 'audit_actor_required');
  assert.equal(c.revoke('x', { permission_role: 'signer_control' }).refusal_reason, 'audit_actor_required');
});

// ---- guard / allowlist invariants ----

test('package is scanned by the mechanism guard, not exempt, and ALLOWLIST stays empty', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 0);
  assert.equal(ALLOWLIST.length, 0);
});

// ---- code governance scans ----

test('CODE: no KeyManager/KMS/vault, crypto/signing lib, signing/sending/serialization, tx-build, RPC/DB', () => {
  const BAD = /(KeyManager|\bKMS\b|\bvault\b|@noble|tweetnacl|bs58|ed25519|web3|@solana\/|jupiter|helius|jito|signTransaction|signAllTransactions|partialSign|sendTransaction|sendRawTransaction|\.serialize\(|buildTransaction|new\s+Transaction|node:crypto|createHash|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('CODE: no REAL-LIVE call, no allowlist mutation, no candidate_*, no forbidden SSOT names; clean fixture', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/activate_real_live\s*\(/.test(code), false, `activate_real_live invoked in ${fn}`);
    assert.equal(/ALLOWLIST\s*[=.]|allowlist\s*:/i.test(code), false, `allowlist mutation in ${fn}`);
    assert.equal(/candidate_/.test(code), false, `candidate_* in ${fn}`);
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
  }
  const raw = readFileSync(join(HERE, '..', 'fixtures', 'custody-scenario.json'), 'utf8');
  assert.equal(/(BEGIN .*PRIVATE KEY|seed phrase|\bmnemonic\b)/i.test(raw), false, 'secret-like content in fixture');
  for (const k of ['private_key', 'secret_key', 'seed', 'mnemonic', 'keypair']) {
    assert.equal(raw.includes(k), false, `fixture must not contain ${k}`);
  }
});
