// PR-E2-C3-1 — Native WebCrypto Ed25519 PROBE / capability check (TEST-ONLY).
//
// This is a capability PROBE, not E2-C3 implementation. It only checks whether the test environment's
// `node:crypto.webcrypto.subtle` supports Ed25519, and — if so — that an EPHEMERAL key generated in test
// memory can sign+verify a LOCAL test payload. It does NOT touch project preflight/custody/adapter, does NOT
// sign any project/transaction payload, adds NO dependency, and introduces NO persisted/static key material.
//
// Test-only: this file lives under test/ and is NOT scanned by the mechanism guard (which scans src/** only).
// No `src` module is added. No `@solana/web3.js`, `@noble/curves`, `tweetnacl`, or `bs58` is used.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import * as runtime from '../src/index.mjs';
import { runMechanismGuard, ALLOWLIST } from '../../../tools/check-mechanism-guards.mjs';

const subtle = webcrypto && webcrypto.subtle;
const PROBE_PAYLOAD = new TextEncoder().encode('e2c31-webcrypto-ed25519-probe-payload');

// Detect Ed25519 support and, if present, run an ephemeral sign+verify over a LOCAL test payload.
// Returns { supported, signVerifyOk, privateExtractable }. Never extracts the private key.
async function probeEd25519() {
  if (!subtle || typeof subtle.generateKey !== 'function') {
    return { supported: false, signVerifyOk: false, reason: 'no_webcrypto_subtle' };
  }
  let keyPair;
  try {
    // private key is NON-extractable (false); public key is fine to use for verify.
    keyPair = await subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  } catch (e) {
    return { supported: false, signVerifyOk: false, reason: `ed25519_unsupported:${e && e.name ? e.name : 'error'}` };
  }
  const sig = await subtle.sign({ name: 'Ed25519' }, keyPair.privateKey, PROBE_PAYLOAD);
  const ok = await subtle.verify({ name: 'Ed25519' }, keyPair.publicKey, sig, PROBE_PAYLOAD);
  // tamper check: a flipped payload must NOT verify
  const tampered = await subtle.verify({ name: 'Ed25519' }, keyPair.publicKey, sig, new TextEncoder().encode('different'));
  return {
    supported: true,
    signVerifyOk: ok === true && tampered === false,
    privateExtractable: keyPair.privateKey.extractable === true,
  };
}

test('E2-C3-1 probe: Ed25519 WebCrypto either signs+verifies (ephemeral) or flags fallback — never fails the suite', async () => {
  const r = await probeEd25519();
  if (!r.supported) {
    // Unsupported: do NOT fail the project; record that a fallback (e.g. @noble/curves) will be needed in E2-C3.
    assert.equal(r.supported, false);
    assert.ok(typeof r.reason === 'string', 'unsupported probe should record a reason');
    // (no dependency added; no failure)
    return;
  }
  // Supported: ephemeral sign+verify works on a LOCAL test payload, and the private key is non-extractable.
  assert.equal(r.signVerifyOk, true, 'ephemeral Ed25519 sign/verify should succeed and reject a tampered payload');
  assert.equal(r.privateExtractable, false, 'probe private key must be non-extractable');
});

test('E2-C3-1 probe boundary: no project signing/custody surface flipped; capabilities stay all-false', () => {
  // The probe does NOT change runtime capabilities or expose any signing surface.
  const c = runtime.capabilities();
  assert.equal(c.can_sign, false);
  assert.equal(c.can_send, false);
  assert.equal(c.has_key_material, false);
  assert.equal(c.live_mechanisms, false);
  // mock signer still produces no real signature; preflight gate still never signs.
  for (const k of ['sign', 'send', 'submit', 'execute', 'serialize', 'buildTransaction', 'loadKey', 'requestSign']) {
    assert.equal(typeof runtime[k], 'undefined', `runtime must not export ${k}`);
  }
});

test('E2-C3-1 probe leaves guard/allowlist unchanged (one path) and the repo passing', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
});
