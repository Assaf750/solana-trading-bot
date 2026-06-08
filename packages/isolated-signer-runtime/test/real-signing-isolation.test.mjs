// PR-E2-C4 — Positive isolation & no-key-leak evidence for the real SIGN-ONLY path (TEST-ONLY).
//
// Comprehensive isolation pass over createRealSigningPath() (E2-C3-4): proves every gate failure refuses a
// signature, the happy path signs ONLY the bound approved digest, arbitrary-bytes signing is impossible,
// nothing leaks a key/signature/digest (output/audit/errors/source), audit before/after holds, there is no
// send/RPC/serialization, real signing is confined to the allowlisted path, and capabilities stay all-false
// globally. Adds no src change, no dependency, no ALLOWLIST change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';

import * as runtime from '../src/index.mjs';
import {
  runMechanismGuard, scanText, isAllowlisted, ALLOWLIST, collectSourceFiles, stripCommentsAndStrings,
} from '../../../tools/check-mechanism-guards.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const enc = (s) => new TextEncoder().encode(s);
const toRel = (f) => { const n = f.replaceAll('\\', '/'); const i = n.indexOf('packages/'); return i >= 0 ? n.slice(i) : n; };
const ephemeralPair = () => webcrypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);

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

// ---- 1) gate-failure matrix: every failure refuses a signature ----

test('C4 gate-failure matrix: each failure refuses a signature (signed:false, signature:null)', async () => {
  const pair = await ephemeralPair();
  const path = runtime.createRealSigningPath();
  const cases = [
    [{ risk_approved: false }, 'risk_not_approved'],
    [{ provider_degraded: true }, 'readiness_not_ready'],
    [{ signer_profile_status: 'DISABLED' }, 'signer_not_active'],
    [{ execution_wallet_status: 'DISABLED' }, 'execution_wallet_not_active'],
    [{ operating_state: 'EXITS_ONLY' }, 'operating_state_not_active'],
    [{ custody_phase: 'degraded' }, 'custody_degraded'],
    [{ provider_status: 'unconfigured' }, 'custody_unconfigured'],
    [{ payload_digest: 'x', approved_payload_digest: 'y' }, 'payload_digest_mismatch'],
    [{ approval_age_slots: 999 }, 'approval_stale'],
  ];
  for (const [override, blocker] of cases) {
    const r = await path.attemptSign({ ...VALID, ...override }, pair.privateKey);
    assert.notEqual(r.ok, true, `must refuse: ${blocker}`);
    assert.equal(r.signed, false);
    assert.equal(r.signature, null);
    assert.equal(r.can_send, false);
    assert.ok(r.blockers.includes(blocker), `expected ${blocker}`);
  }
  // missing audit_actor (audit configured) -> refused, no append
  const log = createAuditLog();
  const noActor = await runtime.createRealSigningPath({ auditLog: log }).attemptSign({ ...VALID, audit_actor: undefined }, pair.privateKey);
  assert.notEqual(noActor.ok, true);
  assert.ok(noActor.blockers.includes('audit_actor_required'));
  assert.equal(log.length, 0);
  // missing signerKey -> fail-closed no_signing_material
  const noKey = await path.attemptSign({ ...VALID });
  assert.equal(noKey.ok, false);
  assert.equal(noKey.signed, false);
  assert.equal(noKey.reason, 'no_signing_material');
});

// ---- 2) happy path: signs ONLY the bound digest; verifies; can_send false; no tx ----

test('C4 happy path: signs bound digest only, verifies, can_send false, no tx/serialized/raw', async () => {
  const pair = await ephemeralPair();
  const r = await runtime.createRealSigningPath().attemptSign({ ...VALID }, pair.privateKey);
  assert.equal(r.ok, true);
  assert.equal(r.signed, true);
  assert.equal(r.can_send, false);
  const sig = Buffer.from(r.signature, 'base64');
  assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, enc(VALID.approved_payload_digest)), true);
  for (const k of ['tx', 'transaction', 'serialized', 'raw', 'bytes']) assert.equal(k in r, false, `no ${k}`);
});

// ---- 3) arbitrary-bytes refusal ----

test('C4 arbitrary-bytes refusal: extra message/payload not signed; only bound digest is', async () => {
  const pair = await ephemeralPair();
  const r = await runtime.createRealSigningPath().attemptSign({ ...VALID, message: 'evil', payload: 'evil2' }, pair.privateKey);
  const sig = Buffer.from(r.signature, 'base64');
  assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, enc('evil')), false);
  assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, enc('evil2')), false);
  assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, enc(VALID.approved_payload_digest)), true);
});

// ---- 4) no-key-leak: output / audit / errors / source ----

test('C4 no-key-leak: output carries no key/private/seed/mnemonic; signature is the only crypto output', async () => {
  const pair = await ephemeralPair();
  const r = await runtime.createRealSigningPath().attemptSign({ ...VALID }, pair.privateKey);
  for (const k of ['key', 'privateKey', 'private_key', 'secret', 'secret_key', 'seed', 'mnemonic', 'keypair']) {
    assert.equal(k in r, false, `output must not carry ${k}`);
  }
  // the ephemeral private key is non-extractable -> cannot be serialised into output anyway
  assert.equal(pair.privateKey.extractable, false);
});

test('C4 no-key-leak: induced sign error fails closed with no key material in result', async () => {
  const pair = await ephemeralPair();
  // pass a VERIFY-only public key as the signer -> subtle.sign throws -> caught -> fail-closed sign_error
  const r = await runtime.createRealSigningPath().attemptSign({ ...VALID }, pair.publicKey);
  assert.equal(r.ok, false);
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
  assert.equal(r.reason, 'sign_error');
  for (const bad of ['privateKey', 'secret', 'mnemonic', 'seed']) assert.equal(JSON.stringify(r).toLowerCase().includes(bad.toLowerCase()), false);
});

test('C4 no-key-leak: source contains no static key material (PEM/base58/mnemonic literals)', () => {
  const KEYMAT = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|\b[1-9A-HJ-NP-Za-km-z]{64,}\b|\bmnemonic\b|seed phrase)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    // scan comment+string-stripped code: any key material would be a literal, which must be absent
    const code = stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(KEYMAT.test(code), false, `static key material in ${fn}`);
  }
  assert.equal(existsSync(join(SRC, '..', 'fixtures')), false, 'package has no fixtures dir (no fixture keys)');
});

// ---- 5) audit before/after; keys subset of AUDIT_COLUMNS; no leak ----

test('C4 audit before/after on success and refusal; keys ⊆ AUDIT_COLUMNS; no sig/digest/key', async () => {
  const pair = await ephemeralPair();
  const allowed = new Set(AUDIT_COLUMNS);
  const okLog = createAuditLog();
  const okR = await runtime.createRealSigningPath({ auditLog: okLog }).attemptSign({ ...VALID }, pair.privateKey);
  const noLog = createAuditLog();
  await runtime.createRealSigningPath({ auditLog: noLog }).attemptSign({ ...VALID, risk_approved: false }, pair.privateKey);
  assert.equal(okLog.length, 2);
  assert.equal(noLog.length, 2);
  assert.match(okLog.get(0).audit_reason, /real_sign_before/);
  assert.match(okLog.get(1).audit_reason, /real_sign_after_signed_sign_only_no_send/);
  assert.match(noLog.get(1).audit_reason, /real_sign_after_refused:.*risk_not_approved/);
  for (const log of [okLog, noLog]) {
    for (const e of log.list()) {
      for (const k of Object.keys(e)) assert.ok(allowed.has(k), `audit key ${k} must be in AUDIT_COLUMNS`);
      const blob = JSON.stringify(e);
      assert.equal(blob.includes('digest-abc'), false);
      assert.equal(blob.includes(okR.signature), false);
      for (const bad of ['privateKey', 'private_key', 'secret', 'mnemonic', 'seed']) assert.equal(blob.toLowerCase().includes(bad.toLowerCase()), false);
    }
  }
});

// ---- 6) no send / no RPC / no serialization in src ----

test('C4 no send/RPC/serialization anywhere in isolated-signer src', () => {
  const FORBID = /(\bsendTransaction\b|\bsendRawTransaction\b|new\s+Connection\s*\(|\.serialize\s*\(|buildTransaction|new\s+Transaction\b|\bfetch\s*\(|axios|node:net|node:http|node:dgram)/;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(FORBID.test(stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'))), false, `send/RPC/serialize in ${fn}`);
  }
});

// ---- 7) confinement: real signing only under the allowlisted path; node:crypto confined ----

test('C4 confinement: real-signing-path is under the allowlisted path; ALLOWLIST unchanged', () => {
  assert.equal(isAllowlisted('packages/isolated-signer-runtime/src/real-signing-path.mjs', ALLOWLIST), true);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
});

test('C4 confinement: node:crypto appears in src ONLY under isolated-signer-runtime/src', () => {
  for (const f of collectSourceFiles()) {
    const rel = toRel(f);
    if (/node:crypto/.test(readFileSync(f, 'utf8'))) {
      assert.ok(rel.startsWith('packages/isolated-signer-runtime/src/'), `node:crypto outside the allowlisted path: ${rel}`);
    }
  }
});

test('C4 confinement: a forbidden crypto-lib import OUTSIDE the path is still rejected', () => {
  const outside = 'packages/other-pkg/src/x.mjs';
  assert.ok(scanText(outside, "import x from '@noble/curves/ed25519';").some((v) => v.rule === 'crypto-signing-lib-import'));
  assert.ok(scanText(outside, "import x from '@solana/web3.js';").some((v) => v.rule === 'solana-sdk-import'));
});

// ---- 8) capabilities: global all-false; only local sign-only descriptor flips can_sign ----

test('C4 capabilities: global all-false; local sign-only descriptor only; can_send false everywhere', () => {
  const c = runtime.capabilities();
  assert.equal(c.can_sign, false);
  assert.equal(c.can_send, false);
  assert.equal(c.has_key_material, false);
  assert.equal(c.live_mechanisms, false);
  const d = runtime.describeRealSigningPath();
  assert.equal(d.can_sign, true);   // local sign-only/test-gated only
  assert.equal(d.can_send, false);
  // other descriptors do not flip can_send
  assert.equal(runtime.describeWebcryptoSigningAdapter().can_send, false);
  assert.equal(runtime.describeMockSigner().can_send, false);
});

test('C4 guard PASSES with allowlist exactly one path', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
});
