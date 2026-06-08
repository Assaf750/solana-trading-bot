// PR-E2-KMS-2 — Provider-selection fail-closed wiring evidence (TEST-ONLY).
//
// Proves the END-TO-END fail-closed wiring: an UNCONFIGURED / DEGRADED custody key-handle (E2-KMS-1,
// `resolveCustodyKeyHandle` -> handle:null) NEVER reaches signing in the real sign-only path (E2-C3-4).
// No real provider, no KMS SDK, no live calls, no new signing, no src change, no ALLOWLIST change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';

import * as runtime from '../src/index.mjs';
import { resolveCustodyKeyHandle, describeKeyHandleContract } from '../../custody-provider-contract/src/index.mjs';
import { runMechanismGuard, ALLOWLIST, stripCommentsAndStrings } from '../../../tools/check-mechanism-guards.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';

const CPC_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'custody-provider-contract', 'src');

const VALID = Object.freeze({
  risk_approved: true, real_live_config_valid: true,
  signer_profile_status: 'ACTIVE', execution_wallet_status: 'ACTIVE', operating_state: 'ACTIVE',
  custody_phase: 'loaded', provider_status: 'configured',
  payload_digest: 'digest-abc', approved_payload_digest: 'digest-abc',
  approval_age_slots: 2, max_approval_age_slots: 10,
  intent_id: 'intent-1', idempotency_key: 'idem-1',
  validation_status: 'valid', protocol_constant_status: 'green', provider_degraded: false,
  slot_lag: 0, slot_lag_max: 5, audit_path_available: true, admission_complete: true, operator_checklist_complete: true,
  audit_actor: 'op',
});

// ---- 1) key-handle resolution is fail-closed (unconfigured / DEGRADED / handle:null) ----

test('KMS-2 resolveCustodyKeyHandle is fail-closed: handle:null, unconfigured, DEGRADED', () => {
  for (const sel of [undefined, null, 'kms-ref', { provider: 'kms', role: 'hot_path' }]) {
    const r = resolveCustodyKeyHandle(sel);
    assert.equal(r.ok, false);
    assert.equal(r.status, 'unconfigured');
    assert.equal(r.handle, null);
    assert.equal(r.can_sign, false);
    assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  }
  assert.equal(describeKeyHandleContract().can_export_key, false);
});

// ---- 2) an unconfigured key-handle does NOT reach signing ----

test('KMS-2 the resolved (null) handle cannot sign: sign-only path -> no_signing_material', async () => {
  const resolved = resolveCustodyKeyHandle({ provider: 'kms' });
  assert.equal(resolved.handle, null);
  const r = await runtime.createRealSigningPath().attemptSign({ ...VALID }, resolved.handle);
  assert.equal(r.ok, false);
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
  assert.equal(r.can_send, false);
  assert.equal(r.reason, 'no_signing_material');
});

// ---- 3) DEGRADED/unconfigured custody blocks at the gate, even if a real key were supplied ----

test('KMS-2 DEGRADED/unconfigured custody blocks at the gate even with a real ephemeral key', async () => {
  const pair = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  const path = runtime.createRealSigningPath();
  const deg = await path.attemptSign({ ...VALID, custody_phase: 'degraded' }, pair.privateKey);
  assert.equal(deg.signed, false);
  assert.equal(deg.signature, null);
  assert.ok(deg.blockers.includes('custody_degraded'));
  assert.equal(deg.recommended_signer_profile_status, 'DEGRADED');
  const unconf = await path.attemptSign({ ...VALID, provider_status: 'unconfigured' }, pair.privateKey);
  assert.equal(unconf.signed, false);
  assert.ok(unconf.blockers.includes('custody_unconfigured'));
});

// ---- 4) key-material refusal at both layers; never echoed ----

test('KMS-2 key-material refused at handle resolution and at sign-only path; never echoed', async () => {
  const h = resolveCustodyKeyHandle({ secret: 'super-secret' });
  assert.equal(h.ok, false);
  assert.equal(h.reason, 'key_material_not_accepted');
  assert.equal(JSON.stringify(h).includes('super-secret'), false);
  const pair = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  const r = await runtime.createRealSigningPath().attemptSign({ ...VALID, secret: 'nope' }, pair.privateKey);
  assert.equal(r.signed, false);
  assert.ok(r.blockers.includes('key_material_not_accepted'));
  assert.equal(JSON.stringify(r).includes('nope'), false);
});

// ---- 5) no live provider surface in the custody-provider-contract package ----

test('KMS-2 custody-provider-contract has no live provider surface (import-free; no sign/KMS/KeyManager/net)', () => {
  // Case-sensitive set (matching the package's own convention): live-mechanism IDENTIFIERS only. Lowercase
  // words like "keypair"/"mnemonic" appear ONLY inside the contract's key-material-DETECTION regex (refusal
  // logic) and must not be flagged here. Import specifiers (@solana/@noble/KMS SDKs/node:net) are covered by
  // the import-free assertion below + the real mechanism guard.
  const BAD = /(signTransaction|signAllTransactions|partialSign|sendTransaction|sendRawTransaction|sendAndConfirmTransaction|\bKeypair\b|fromSecretKey|fromSeed|generateKeyPair|\bKeyManager\b|new\s+Connection\s*\(|\.serialize\s*\(|\b(fetch|XMLHttpRequest)\s*\(|new\s+WebSocket|\.query\s*\(|activate_real_live\s*\()/;
  for (const fn of readdirSync(CPC_SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCommentsAndStrings(readFileSync(join(CPC_SRC, fn), 'utf8'));
    assert.equal(/\bimport\b[^;]*\bfrom\b|\brequire\s*\(/.test(code), false, `import in ${fn}`);
    assert.equal(BAD.test(code), false, `live mechanism in ${fn}`);
  }
});

// ---- 6) audit before/after on the refused attempt; keys subset of AUDIT_COLUMNS; no leak ----

test('KMS-2 refused attempt audited before/after; keys ⊆ AUDIT_COLUMNS; no key/sig/digest leak', async () => {
  const log = createAuditLog();
  const resolved = resolveCustodyKeyHandle({ provider: 'kms' });
  await runtime.createRealSigningPath({ auditLog: log }).attemptSign({ ...VALID }, resolved.handle);
  assert.equal(log.length, 2);
  assert.match(log.get(0).audit_reason, /real_sign_before/);
  assert.match(log.get(1).audit_reason, /real_sign_after_refused:no_signing_material/);
  const allowed = new Set(AUDIT_COLUMNS);
  for (const e of log.list()) {
    for (const k of Object.keys(e)) assert.ok(allowed.has(k), `audit key ${k} in AUDIT_COLUMNS`);
    const blob = JSON.stringify(e);
    assert.equal(blob.includes('digest-abc'), false);
    for (const bad of ['privateKey', 'secret', 'mnemonic', 'seed']) assert.equal(blob.toLowerCase().includes(bad.toLowerCase()), false);
  }
});

// ---- 7) guard / capabilities invariants ----

test('KMS-2 guard allowlist=1; global capabilities all-false', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
  assert.equal(runtime.capabilities().can_sign, false);
  assert.equal(runtime.capabilities().can_send, false);
});
