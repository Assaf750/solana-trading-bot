import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  describeSigningAdapterContract,
  createNoopSigningAdapter,
  signingAdapterRefusesKeyMaterial,
  SIGNING_ADAPTER_CONTRACT_STATUS,
} from '../src/index.mjs';
import { runMechanismGuard, ALLOWLIST, stripCommentsAndStrings } from '../../../tools/check-mechanism-guards.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// A valid, already-validated preflight result (non-signing envelope).
const VALID_PREFLIGHT = Object.freeze({
  preflight_ok: true, signed: false, signature: null, can_send: false, blockers: [],
});

// ---- contract descriptor: every execution capability is false ----

test('contract descriptor pins all execution capabilities to false', () => {
  const c = describeSigningAdapterContract();
  assert.equal(c.can_sign, false);
  assert.equal(c.can_send, false);
  assert.equal(c.holds_key_material, false);
  assert.equal(c.can_export_key, false);
  assert.equal(c.is_live, false);
  assert.equal(c.status, 'unconfigured');
  assert.equal(Object.isFrozen(c), true);
});

// ---- no-op adapter is fail-closed ----

test('no-op adapter never signs, even for a valid preflight', () => {
  const a = createNoopSigningAdapter();
  assert.equal(a.isConfigured(), false);
  const r = a.sign({ preflight: VALID_PREFLIGHT, custody_handle: 'ref-123' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 'unconfigured');
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
  assert.equal(r.can_send, false);
  assert.equal(r.reason, 'noop_adapter_never_signs');
});

test('no-op adapter accepts a bare valid preflight object too (still never signs)', () => {
  const a = createNoopSigningAdapter();
  const r = a.sign({ ...VALID_PREFLIGHT });
  assert.equal(r.ok, false);
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
});

// ---- invalid preflight is rejected fail-closed ----

test('invalid / not-ok preflight is rejected with a reason; never signs', () => {
  const a = createNoopSigningAdapter();
  const cases = [
    [undefined, 'invalid_request'],
    [{ preflight: { ...VALID_PREFLIGHT, preflight_ok: false } }, 'preflight_not_ok'],
    [{ preflight: { ...VALID_PREFLIGHT, signed: true } }, 'preflight_signed_must_be_false'],
    [{ preflight: { ...VALID_PREFLIGHT, signature: 'x' } }, 'preflight_signature_must_be_null'],
    [{ preflight: { ...VALID_PREFLIGHT, can_send: true } }, 'preflight_can_send_must_be_false'],
    [{ preflight: { ...VALID_PREFLIGHT, blockers: ['risk_not_approved'] } }, 'preflight_has_blockers'],
    [{ preflight: { ...VALID_PREFLIGHT, recommended_signer_profile_status: 'DEGRADED' } }, 'custody_unsafe_degraded'],
  ];
  for (const [req, reason] of cases) {
    const r = a.sign(req);
    assert.equal(r.ok, false, `expected fail for ${reason}`);
    assert.equal(r.reason, reason);
    assert.equal(r.signed, false); assert.equal(r.signature, null); assert.equal(r.can_send, false);
  }
});

// ---- key material refused (never accepted/stored/returned) ----

test('key-material-shaped input is refused', () => {
  const pem = '-----BEGIN PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const words = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, words, { secret: 'x' }, { private_key: 'x' }, { seed: 'x' }, { mnemonic: 'x' }, { keypair: 'x' }]) {
    assert.equal(signingAdapterRefusesKeyMaterial(km), true, `must refuse ${JSON.stringify(km).slice(0, 24)}`);
  }
});

test('sign() refuses key material and never returns it', () => {
  const a = createNoopSigningAdapter();
  const r = a.sign({ preflight: VALID_PREFLIGHT, secret: 'super-secret-value' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'key_material_not_accepted');
  assert.equal(JSON.stringify(r).includes('super-secret-value'), false);
});

// ---- output envelope carries NO signature/bytes/transaction ----

test('fail-closed result carries no bytes/tx/transaction/serialized/raw', () => {
  const r = createNoopSigningAdapter().sign({ preflight: VALID_PREFLIGHT });
  assert.equal('signature' in r, true);
  assert.equal(r.signature, null);
  for (const k of ['bytes', 'tx', 'transaction', 'serialized', 'raw']) {
    assert.equal(k in r, false, `result must not carry ${k}`);
  }
});

// ---- no live mechanism in src (self-scan) ----

test('src has no forbidden mechanisms and no imports beyond the internal contract', () => {
  const ALLOWED = /^\.\.\/\.\.\/custody-provider-contract\/src\/index\.mjs$/;
  const BAD = /(signTransaction|signAllTransactions|partialSign|sendTransaction|sendRawTransaction|sendAndConfirmTransaction|\bKeypair\b|fromSecretKey|fromSeed|generateKeyPair|\bKeyManager\b|new\s+Connection\s*\(|\.serialize\s*\(|\b(fetch|XMLHttpRequest)\s*\(|new\s+WebSocket|createPool|new\s+Pool|\.query\s*\(|activate_real_live\s*\(|@noble|tweetnacl|bs58|ed25519|@solana\/|jupiter|helius|jito|\bKMS\b|\bvault\b)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    assert.equal(BAD.test(stripCommentsAndStrings(raw)), false, `forbidden mechanism in ${fn}`);
    for (const m of raw.matchAll(/\bimport\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
      assert.equal(ALLOWED.test(m[1]), true, `disallowed import "${m[1]}" in ${fn}`);
    }
  }
});

// ---- guard / allowlist invariants unchanged ----

test('mechanism guard PASSES and ALLOWLIST is unchanged (one isolated-signer path)', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
});

test('status constant is unconfigured', () => {
  assert.equal(SIGNING_ADAPTER_CONTRACT_STATUS, 'unconfigured');
});
