import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  describeCustodyProviderContract,
  createUnconfiguredCustodyProvider,
  selectCustodyProvider,
  refusesKeyMaterial,
  CUSTODY_PROVIDER_CONTRACT_STATUS,
} from '../src/index.mjs';
import { runMechanismGuard, ALLOWLIST, stripCommentsAndStrings } from '../../../tools/check-mechanism-guards.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// ---- contract descriptor: every execution capability is false ----

test('contract descriptor pins all execution capabilities to false (no execution authority surface)', () => {
  const c = describeCustodyProviderContract();
  assert.equal(c.can_export_key, false);
  assert.equal(c.holds_key_material, false);
  assert.equal(c.can_sign, false);
  assert.equal(c.can_send, false);
  assert.equal(c.accepts_key_material_input, false);
  assert.equal(c.is_live, false);
  assert.equal(c.status, 'unconfigured');
  // frozen / read-only
  assert.equal(Object.isFrozen(c), true);
});

// ---- stub provider is fail-closed ----

test('unconfigured provider is fail-closed on every operation', () => {
  const p = createUnconfiguredCustodyProvider();
  assert.equal(p.status, 'unconfigured');
  assert.equal(p.isConfigured(), false);
  assert.equal(p.health().ok, false);
  assert.equal(p.health().status, 'unconfigured');
  assert.equal(p.use({ any: 'request' }).ok, false);
  assert.equal(p.use().status, 'unconfigured');
  assert.equal(Object.isFrozen(p), true);
});

test('provider selection stub ALWAYS resolves to the unconfigured provider (never live)', () => {
  for (const sel of [undefined, null, 'helius', { provider: 'kms' }, { role: 'hot_path' }]) {
    const r = selectCustodyProvider(sel);
    assert.equal(r.ok, false);
    assert.equal(r.status, 'unconfigured');
    assert.equal(r.provider.isConfigured(), false);
  }
});

// ---- key material is refused (never accepted/stored/returned) ----

test('key-material-shaped input is refused by the contract', () => {
  const pem = '-----BEGIN PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const words = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, words, { secret: 'x' }, { private_key: 'x' }, { seed: 'x' }, { mnemonic: 'x' }, { keypair: 'x' }]) {
    assert.equal(refusesKeyMaterial(km), true, `must refuse: ${JSON.stringify(km).slice(0, 24)}`);
  }
  // non-key inputs are not falsely flagged
  for (const ok of [undefined, null, 'helius', { role: 'hot_path' }, { provider_ref: 'ref-123' }]) {
    assert.equal(refusesKeyMaterial(ok), false, `must NOT flag: ${JSON.stringify(ok)}`);
  }
});

test('use() refuses key material and never returns it; selection refuses key material', () => {
  const p = createUnconfiguredCustodyProvider();
  const r = p.use('-----BEGIN PRIVATE KEY-----');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'key material refused');
  // the result carries no key material back
  assert.equal(JSON.stringify(r).includes('PRIVATE KEY'), false);
  const s = selectCustodyProvider({ secret: 'nope' });
  assert.equal(s.ok, false);
  assert.equal(s.reason, 'key material refused in provider selection');
});

// ---- no live imports / no forbidden mechanisms in src (self-scan) ----

test('src contains NO live mechanism: no import of solana/crypto/provider/http/db', () => {
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'));
    // no imports at all (pure local module) — and certainly none forbidden
    assert.equal(/\bimport\b[^;]*\bfrom\b|\brequire\s*\(/.test(code), false, `no imports allowed in ${fn}`);
  }
});

test('src contains NO sign/send/serialize/Keypair/KeyManager/Connection/fetch/WebSocket/.query/activate_real_live', () => {
  const BAD = /(signTransaction|signAllTransactions|partialSign|sendTransaction|sendRawTransaction|sendAndConfirmTransaction|\bKeypair\b|fromSecretKey|fromSeed|generateKeyPair|\bKeyManager\b|new\s+Connection\s*\(|\.serialize\s*\(|\b(fetch|XMLHttpRequest)\s*\(|new\s+WebSocket|createPool|new\s+Pool|\.query\s*\(|activate_real_live\s*\()/;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(BAD.test(code), false, `forbidden mechanism in ${fn}`);
  }
});

// ---- guard / allowlist invariants unchanged ----

test('mechanism guard still PASSES and ALLOWLIST is unchanged (one isolated-signer path)', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
});

test('status constant is unconfigured', () => {
  assert.equal(CUSTODY_PROVIDER_CONTRACT_STATUS, 'unconfigured');
});
