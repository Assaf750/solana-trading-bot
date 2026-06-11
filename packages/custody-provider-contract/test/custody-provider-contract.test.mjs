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
  validateProviderConfig,
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

// ================= E2-KMS-6: provider config VALIDATION (no SDK, validation-only) =================

test('E2-KMS-6 valid-looking refs validate as references only and do NOT activate', () => {
  const r = validateProviderConfig({ provider_ref: 'kms-key-ref-1', environment: 'devnet', key_alias: 'signer-alias-1' });
  assert.equal(r.valid, true);
  assert.equal(r.status, 'reference_valid_no_sdk');
  assert.equal(r.activated, false);
  assert.deepEqual([...r.reasons], []);
  // validation does NOT make the adapter configured / does NOT resolve a handle
  const a = createProviderAdapterSkeleton({ provider_ref: 'kms-key-ref-1', environment: 'devnet' });
  assert.equal(a.isConfigured(), false);
  assert.equal(a.resolveKeyHandle({ request: 'x' }).handle, null);
});

test('E2-KMS-6 missing / malformed config fails closed (DEGRADED, not valid)', () => {
  for (const cfg of [undefined, null, 'x', 42, {}, { environment: 'devnet' }, { provider_ref: 'r' }]) {
    const r = validateProviderConfig(cfg);
    assert.equal(r.valid, false, `must be invalid: ${JSON.stringify(cfg)}`);
    assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
    assert.equal(r.activated, false);
  }
});

test('E2-KMS-6 mainnet/prod environment or mainnet ref in testnet env is blocked', () => {
  assert.equal(validateProviderConfig({ provider_ref: 'r', environment: 'mainnet' }).valid, false);
  assert.ok(validateProviderConfig({ provider_ref: 'r', environment: 'mainnet-beta' }).reasons.includes('mainnet_or_nontestnet_environment_blocked'));
  assert.ok(validateProviderConfig({ provider_ref: 'r', environment: 'prod' }).reasons.includes('mainnet_or_nontestnet_environment_blocked'));
  // mainnet indicator mixed into a testnet env -> mismatch
  const mix = validateProviderConfig({ provider_ref: 'r', environment: 'devnet', cluster: 'mainnet' });
  assert.equal(mix.valid, false);
  assert.ok(mix.reasons.includes('env_ref_mismatch_mainnet_in_testnet'));
  // endpoint/URL in provider_ref blocked
  assert.ok(validateProviderConfig({ provider_ref: 'https://node/', environment: 'devnet' }).reasons.includes('provider_ref_endpoint_or_mainnet_blocked'));
});

test('E2-KMS-6 key-material-shaped config refused and never echoed; no key/raw fields in result', () => {
  const r = validateProviderConfig({ provider_ref: 'r', environment: 'devnet', secret: 'super-secret' });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid_key_material');
  assert.ok(r.reasons.includes('key_material_not_accepted'));
  assert.equal(JSON.stringify(r).includes('super-secret'), false);
  for (const k of ['key', 'privateKey', 'private_key', 'seed', 'mnemonic', 'keypair', 'handle', 'raw']) {
    assert.equal(k in r, false, `result must not carry ${k}`);
  }
});

test('E2-KMS-6 key_alias/key_id must be opaque reference strings (no endpoints/secrets)', () => {
  assert.equal(validateProviderConfig({ provider_ref: 'r', environment: 'devnet', key_alias: 'alias-ok' }).valid, true);
  assert.ok(validateProviderConfig({ provider_ref: 'r', environment: 'devnet', key_alias: 'https://x/' }).reasons.includes('key_alias_invalid_reference'));
  assert.ok(validateProviderConfig({ provider_ref: 'r', environment: 'devnet', key_id: '' }).reasons.includes('key_id_invalid_reference'));
});

// ================= E2-KMS-10: no-SDK provider config HARDENING =================

test('E2-KMS-10 valid testnet/devnet/localnet refs (known fields only) stay shape-only valid; no activation', () => {
  for (const environment of ['devnet', 'testnet', 'localnet']) {
    const r = validateProviderConfig({ provider_ref: 'kms-key-ref-1', environment, key_alias: 'signer-alias-1' });
    assert.equal(r.valid, true, `expected valid for ${environment}: ${r.reasons.join(',')}`);
    assert.equal(r.activated, false);
    assert.equal(r.status, 'reference_valid_no_sdk');
  }
  // a valid shape still does NOT configure/activate the skeleton
  const a = createProviderAdapterSkeleton({ provider_ref: 'kms-key-ref-1', environment: 'devnet' });
  assert.equal(a.isConfigured(), false);
  assert.equal(a.resolveKeyHandle({ request: 'x' }).handle, null);
});

test('E2-KMS-10 unknown/surprise fields are rejected', () => {
  for (const extra of [{ exec: 'x' }, { rpc_endpoint: 'r' }, { provider_url: 'u' }, { broadcast: true }, { send: true }, { foo: 'bar' }]) {
    const r = validateProviderConfig({ provider_ref: 'r', environment: 'devnet', ...extra });
    assert.equal(r.valid, false, `must reject unknown field: ${JSON.stringify(extra)}`);
    assert.ok(r.reasons.includes('unknown_field_rejected'), `expected unknown_field_rejected for ${JSON.stringify(extra)}`);
    assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  }
});

test('E2-KMS-10 endpoint/RPC/URL/live-call indicators in any value are blocked (incl. wss:// and bare send)', () => {
  // wss:// is caught by the hardening scan even though it is not in the mainnet/endpoint ref check
  const wss = validateProviderConfig({ provider_ref: 'r', environment: 'devnet', key_alias: 'wss://node' });
  assert.equal(wss.valid, false);
  assert.ok(wss.reasons.includes('endpoint_or_live_call_indicator_blocked'));
  // a bare "send" indicator in an otherwise-known field value is blocked
  const send = validateProviderConfig({ provider_ref: 'r', environment: 'devnet', key_alias: 'send-target' });
  assert.equal(send.valid, false);
  assert.ok(send.reasons.includes('endpoint_or_live_call_indicator_blocked'));
});

test('E2-KMS-10 key-material-shaped config still refused and never echoed; no key/raw/handle in result', () => {
  const r = validateProviderConfig({ provider_ref: 'r', environment: 'devnet', secret: 'super-secret' });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid_key_material');
  assert.equal(JSON.stringify(r).includes('super-secret'), false);
  for (const k of ['key', 'privateKey', 'private_key', 'seed', 'mnemonic', 'keypair', 'handle', 'raw']) {
    assert.equal(k in r, false, `result must not carry ${k}`);
  }
});

test('E2-KMS-10 guard remains allowlist=1; no SDK selected; skeleton stays fail-closed', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  const a = createProviderAdapterSkeleton({ provider_ref: 'kms-key-ref-1', environment: 'devnet' });
  assert.equal(a.isConfigured(), false);
  assert.equal(a.resolveKeyHandle({ request: 'x' }).recommended_signer_profile_status, 'DEGRADED');
});

// ---------------------------------------------------------------------------
// Stage-19 security-review HARDENING regressions (binding condition,
// reports/E2-STAGE-19): the key-material detector must be DEEP.
// ---------------------------------------------------------------------------

test('S19-hardening: NESTED secret-bearing field name is refused (deep scan)', () => {
  assert.equal(refusesKeyMaterial({ nested: { secret_key: 'x' } }), true);
  assert.equal(refusesKeyMaterial({ a: { b: { c: { private_key: 'x' } } } }), true);
  assert.equal(refusesKeyMaterial({ list: [{ ok: 1 }, { seed_phrase: 'x' }] }), true);
});

test('S19-hardening: PEM / base58-blob / mnemonic string VALUES under innocuous keys are refused', () => {
  assert.equal(refusesKeyMaterial({ memo: '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----' }), true);
  assert.equal(refusesKeyMaterial({ note: '1'.repeat(0) + '5Kb8kLf9zgWQnogidDA76MzPL6TsZZY36hWXMssSzNydYXYB9KF5Kb8kLf9zgWQnogidDA76MzPL6Ts' }), true);
  assert.equal(refusesKeyMaterial({ comment: 'one two three four five six seven eight nine ten eleven twelve' }), true);
  // clean nested inputs still pass
  assert.equal(refusesKeyMaterial({ nested: { label: 'ok', n: 3 }, list: ['a', 'b'] }), false);
});

test('S19-hardening: depth/budget bound exceeded or throwing accessor -> refused (fail-safe)', () => {
  let deep = { v: 'leaf' };
  for (let i = 0; i < 10; i++) deep = { next: deep };
  assert.equal(refusesKeyMaterial(deep), true, 'beyond max depth -> suspicious -> refused');
  const hostile = new Proxy({}, { ownKeys() { throw new Error('hostile'); }, getOwnPropertyDescriptor() { throw new Error('hostile'); } });
  assert.equal(refusesKeyMaterial({ wrap: hostile }), true, 'uninspectable -> refused');
});
