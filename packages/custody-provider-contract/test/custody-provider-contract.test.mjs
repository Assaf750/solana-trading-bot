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
  describeKeyHandleContract,
  resolveCustodyKeyHandle,
  createProviderAdapterSkeleton,
  CUSTODY_PROVIDER_CONTRACT_STATUS,
  CUSTODY_KEY_HANDLE_KIND,
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

// ================= E2-KMS-1: opaque key-handle interface (no real handle, no signing) =================

test('E2-KMS-1 key-handle descriptor: opaque, non-exportable, no raw key, no sign', () => {
  const d = describeKeyHandleContract();
  assert.equal(d.kind, 'key-handle');
  assert.equal(d.opaque, true);
  assert.equal(d.exportable, false);
  assert.equal(d.can_export_key, false);
  assert.equal(d.holds_raw_private_key, false);
  assert.equal(d.accepts_key_material_input, false);
  assert.equal(d.can_sign, false);
  assert.equal(d.status, 'unconfigured');
  assert.equal(CUSTODY_KEY_HANDLE_KIND, 'key-handle');
  // descriptor exposes NO export/sign methods (it is a plain frozen object)
  assert.equal(typeof d.exportKey, 'undefined');
  assert.equal(typeof d.sign, 'undefined');
  assert.equal(Object.isFrozen(d), true);
});

test('E2-KMS-1 contract descriptor embeds the key-handle interface and the resolveKeyHandle op', () => {
  const c = describeCustodyProviderContract();
  assert.equal(c.key_handle.kind, 'key-handle');
  assert.equal(c.key_handle.can_export_key, false);
  assert.ok(c.operations.includes('resolveKeyHandle'));
});

test('E2-KMS-1 resolveCustodyKeyHandle is fail-closed: no handle, DEGRADED, cannot sign/export', () => {
  for (const sel of [undefined, null, 'kms-ref', { provider: 'kms', role: 'hot_path' }]) {
    const r = resolveCustodyKeyHandle(sel);
    assert.equal(r.ok, false);
    assert.equal(r.status, 'unconfigured');
    assert.equal(r.handle, null);
    assert.equal(r.can_sign, false);
    assert.equal(r.can_export_key, false);
    assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  }
});

test('E2-KMS-1 provider.resolveKeyHandle mirrors fail-closed DEGRADED; describeKeyHandle matches', () => {
  const p = createUnconfiguredCustodyProvider();
  const r = p.resolveKeyHandle({ provider: 'kms' });
  assert.equal(r.ok, false);
  assert.equal(r.handle, null);
  assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  assert.equal(p.describeKeyHandle().kind, 'key-handle');
  assert.equal(p.describeKeyHandle().can_export_key, false);
});

test('E2-KMS-1 key-material-shaped input to handle resolution is refused and never echoed', () => {
  for (const km of ['-----BEGIN PRIVATE KEY-----', { secret: 'x' }, { private_key: 'x' }, { seed: 'x' }, { mnemonic: 'x' }, { keypair: 'x' }]) {
    const r = resolveCustodyKeyHandle(km);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'key_material_not_accepted');
    assert.equal(r.handle, null);
  }
  const withSecret = resolveCustodyKeyHandle({ secret: 'super-secret-value' });
  assert.equal(JSON.stringify(withSecret).includes('super-secret-value'), false);
});

test('E2-KMS-1 no handle ever exposes a key; result carries no key/private/raw fields', () => {
  const r = resolveCustodyKeyHandle({ provider: 'kms' });
  assert.equal(r.handle, null);
  for (const k of ['key', 'privateKey', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'raw']) {
    assert.equal(k in r, false, `result must not carry ${k}`);
  }
});

// ================= E2-KMS-4: provider adapter SKELETON (no SDK, fail-closed) =================

test('E2-KMS-4 skeleton descriptor: is_skeleton, no SDK, all execution caps false', () => {
  const a = createProviderAdapterSkeleton({ provider_ref: 'ref-1' });
  const d = a.describe();
  assert.equal(d.adapter, 'skeleton');
  assert.equal(d.is_skeleton, true);
  assert.equal(d.has_sdk, false);
  assert.equal(d.can_export_key, false);
  assert.equal(d.holds_raw_private_key, false);
  assert.equal(d.can_sign, false);
  assert.equal(d.is_live, false);
  assert.equal(d.status, 'unconfigured');
  assert.equal(a.isConfigured(), false);
  assert.equal(a.describeKeyHandle().kind, 'key-handle');
});

test('E2-KMS-4 skeleton has no signing/export methods', () => {
  const a = createProviderAdapterSkeleton({ provider_ref: 'ref-1' });
  for (const m of ['sign', 'send', 'serialize', 'exportKey', 'loadKey']) {
    assert.equal(typeof a[m], 'undefined', `skeleton must not expose ${m}`);
  }
});

test('E2-KMS-4 config_status reflects input (reference vs missing vs key-material)', () => {
  assert.equal(createProviderAdapterSkeleton({ provider_ref: 'ref-1' }).config_status, 'reference_present_no_sdk');
  assert.equal(createProviderAdapterSkeleton().config_status, 'unconfigured');
  assert.equal(createProviderAdapterSkeleton({}).config_status, 'unconfigured');
  assert.equal(createProviderAdapterSkeleton({ secret: 'x' }).config_status, 'invalid_key_material');
});

test('E2-KMS-4 resolveKeyHandle is ALWAYS fail-closed: no handle, DEGRADED, cannot sign/export', () => {
  const a = createProviderAdapterSkeleton({ provider_ref: 'ref-1' });
  const r = a.resolveKeyHandle({ request: 'sign-something' });
  assert.equal(r.ok, false);
  assert.equal(r.handle, null);
  assert.equal(r.can_sign, false);
  assert.equal(r.can_export_key, false);
  assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  assert.equal(r.reason, 'skeleton_no_sdk');
  for (const k of ['key', 'privateKey', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'raw']) {
    assert.equal(k in r, false, `result must not carry ${k}`);
  }
});

test('E2-KMS-4 key-material in request or config is refused and never echoed', () => {
  const a = createProviderAdapterSkeleton({ provider_ref: 'ref-1' });
  const r = a.resolveKeyHandle({ secret: 'super-secret' });
  assert.equal(r.reason, 'key_material_not_accepted');
  assert.equal(r.handle, null);
  assert.equal(JSON.stringify(r).includes('super-secret'), false);
  // key material in config -> config invalid, resolution refuses
  const bad = createProviderAdapterSkeleton({ private_key: 'leaked' });
  assert.equal(bad.config_status, 'invalid_key_material');
  const r2 = bad.resolveKeyHandle({ request: 'x' });
  assert.equal(r2.reason, 'config_invalid_key_material');
  assert.equal(r2.handle, null);
  assert.equal(JSON.stringify(bad.describe()).includes('leaked'), false);
});
