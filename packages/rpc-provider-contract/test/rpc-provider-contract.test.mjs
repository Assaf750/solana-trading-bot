import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  describeRpcProviderContract,
  createFailClosedRpcProvider,
  validateRpcProviderConfig,
  evaluateRpcReadiness,
  refusesKeyMaterial,
  RPC_PROVIDER_CONTRACT_STATUS,
} from '../src/index.mjs';
import {
  runMechanismGuard,
  ALLOWLIST,
  isAllowlisted,
  stripCommentsAndStrings,
} from '../../../tools/check-mechanism-guards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const PKG_JSON = join(HERE, '..', 'package.json');

// A clean, valid-LOOKING testnet readiness description: a (simulated) endpoint is present, the provider is up,
// and live RPC is even flagged enabled. It must STILL be not-ready, because there is no RPC and no live path.
const CLEAN_READY_LOOKING = Object.freeze({
  endpoint_present: true,
  provider_status: 'ok',
  live_rpc_enabled: true,
  environment: 'devnet',
});

// The canonical fixed-literal not-ready shape every readiness evaluation must return.
function assertNotReadyShape(r) {
  assert.equal(r.ready, false);
  assert.equal(r.configured, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.live_rpc_enabled, false);
  assert.equal(r.status, 'unconfigured_no_rpc');
  assert.equal(r.reason, 'rpc_provider_unconfigured_no_rpc');
  assert.equal(Object.isFrozen(r), true);
  assert.ok(Array.isArray(r.blockers));
  assert.equal(Object.isFrozen(r.blockers), true);
  // the foundational refusal is ALWAYS present and ALWAYS last.
  assert.equal(r.blockers[r.blockers.length - 1], 'rpc_provider_unconfigured_no_rpc');
}

// ---- (1) missing-endpoint readiness refuses (blocker missing_endpoint) ----

test('(1) missing-endpoint readiness refuses with blocker missing_endpoint', () => {
  // no endpoint_present flag -> missing_endpoint blocker (still not-ready foundationally).
  for (const input of [{}, { provider_status: 'ok' }, { endpoint_present: false }]) {
    const r = evaluateRpcReadiness(input);
    assertNotReadyShape(r);
    assert.ok(r.blockers.includes('missing_endpoint'), `expected missing_endpoint: ${JSON.stringify(input)}`);
  }
  // when a (simulated) endpoint IS present, the missing_endpoint blocker is absent (but still not-ready).
  const present = evaluateRpcReadiness({ endpoint_present: true });
  assertNotReadyShape(present);
  assert.equal(present.blockers.includes('missing_endpoint'), false);
});

// ---- (2) provider-failure readiness refuses (blocker provider_failed) ----

test('(2) provider-failure readiness refuses with blocker provider_failed', () => {
  const r = evaluateRpcReadiness({ endpoint_present: true, provider_status: 'failed' });
  assertNotReadyShape(r);
  assert.ok(r.blockers.includes('provider_failed'));
  // a non-failed provider_status does NOT raise provider_failed.
  const ok = evaluateRpcReadiness({ endpoint_present: true, provider_status: 'ok' });
  assert.equal(ok.blockers.includes('provider_failed'), false);
});

// ---- (3) mainnet config + readiness are both refused ----

test('(3) mainnet config is refused (mainnet_or_nontestnet_environment_blocked)', () => {
  for (const bad of [
    { provider_ref: 'ref-1', environment: 'mainnet' },
    { provider_ref: 'ref-1', environment: 'mainnet-beta' },
    { provider_ref: 'ref-1', environment: 'prod' },
  ]) {
    const v = validateRpcProviderConfig(bad);
    assert.equal(v.valid, false);
    assert.equal(v.configured, false);
    assert.equal(v.has_rpc, false);
    assert.ok(v.reasons.includes('mainnet_or_nontestnet_environment_blocked'), `expected mainnet block: ${JSON.stringify(bad)}`);
  }
});

test('(3) mainnet readiness indicators are refused (mainnet_indicator_blocked)', () => {
  for (const bad of [
    { endpoint_present: true, environment: 'mainnet' },
    { endpoint_present: true, network: 'mainnet-beta' },
    { endpoint_present: true, cluster_kind: 'prod' },
  ]) {
    const r = evaluateRpcReadiness(bad);
    assertNotReadyShape(r);
    assert.ok(r.blockers.includes('mainnet_indicator_blocked'), `expected mainnet block: ${JSON.stringify(bad)}`);
  }
});

// ---- (4) endpoint secret/marker is NEVER echoed in any result; no key/endpoint/credential field ----

test('(4) endpoint marker is NOT echoed in readiness/validation results; no key/endpoint field present', () => {
  const MARK = 'ECHO_ENDPOINT_MARKER_98765';
  // readiness: a marker buried in the (simulated) input must not surface in the fixed-literal result.
  const r = evaluateRpcReadiness({ endpoint_present: true, marker_field: MARK });
  assertNotReadyShape(r);
  assert.equal(JSON.stringify(r).includes(MARK), false);
  assert.equal('marker_field' in r, false);
  // validation: an unknown field's value (a fake endpoint marker) must not surface either.
  const v = validateRpcProviderConfig({ provider_ref: 'ref-1', environment: 'devnet', marker_field: MARK });
  assert.equal(JSON.stringify(v).includes(MARK), false);
  assert.equal('marker_field' in v, false);
  // no key/endpoint/credential/url field names leak into any result object.
  for (const obj of [r, v, describeRpcProviderContract()]) {
    for (const k of ['key', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'endpoint', 'rpc_endpoint', 'provider_url', 'url', 'credential', 'handle']) {
      assert.equal(k in obj, false, `result must not carry ${k}`);
    }
  }
});

// ---- (5) NO live call / module is import-free (self-scan SRC only, not the test) ----

const FORBIDDEN_CODE = /(signTransaction|signAllTransactions|partialSign|sendTransaction|sendRawTransaction|sendAndConfirmTransaction|\bKeypair\b|fromSecretKey|fromSeed|generateKeyPair|\bKeyManager\b|new\s+Connection\s*\(|\.serialize\s*\(|\b(fetch|XMLHttpRequest)\s*\(|new\s+WebSocket|WebSocket\s*\(|createPool|new\s+Pool|\.query\s*\(|activate_real_live\s*\()/;

function srcMjsFiles() {
  return readdirSync(SRC).filter((x) => x.endsWith('.mjs'));
}

test('(5) src is import-free and carries NO forbidden live mechanism (self-scan, code only)', () => {
  const files = srcMjsFiles();
  assert.ok(files.length >= 2, 'expected src .mjs files present');
  for (const fn of files) {
    const code = stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/\bimport\b[^;]*\bfrom\b|\brequire\s*\(/.test(code), false, `no imports allowed in ${fn}`);
    assert.equal(FORBIDDEN_CODE.test(code), false, `forbidden mechanism in ${fn}`);
  }
});

// ---- (6) NO SDK import (scan src import specifiers = none) ----

test('(6) src declares NO import specifiers at all (no SDK, no network, no DB import)', () => {
  const reFrom = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const reBare = /\bimport\s*['"]([^'"]+)['"]/g;
  const reCall = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const fn of srcMjsFiles()) {
    const text = readFileSync(join(SRC, fn), 'utf8');
    const specs = [];
    for (const re of [reFrom, reBare, reCall]) {
      for (const m of text.matchAll(re)) specs.push(m[1]);
    }
    // index.mjs re-exports './rpc-provider-contract.mjs' (a LOCAL relative path), which is allowed.
    const nonLocal = specs.filter((s) => !s.startsWith('.'));
    assert.equal(nonLocal.length, 0, `${fn} must not import any non-local module: ${JSON.stringify(nonLocal)}`);
  }
});

// ---- (7) NO dependency (package.json has no dependencies/devDependencies) ----

test('(7) package.json declares NO dependencies or devDependencies', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  assert.equal(pkg.name, '@soltrade/rpc-provider-contract');
  assert.equal('dependencies' in pkg, false, 'no dependencies field allowed');
  assert.equal('devDependencies' in pkg, false, 'no devDependencies field allowed');
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
});

// ---- (8) guard PASS — runMechanismGuard ok, allowlist 1, violations 0 ----

test('(8) mechanism guard PASSES; ALLOWLIST length 1; violations 0', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(res.counts.violations, 0);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
});

// ---- (9) a configured-LOOKING (valid testnet refs) config still yields configured:false / has_rpc:false ----

test('(9) a valid references-only testnet config is NOT configured (configured:false, has_rpc:false)', () => {
  for (const good of [
    { provider_ref: 'opaque-ref-1', environment: 'devnet' },
    { provider_ref: 'opaque-ref-2', environment: 'testnet', endpoint_ref: 'opaque-ref-handle-2' },
    { provider_ref: 'opaque-ref-3', environment: 'localnet' },
  ]) {
    const v = validateRpcProviderConfig(good);
    assert.equal(v.valid, true, `expected valid shape: ${JSON.stringify(good)} got ${JSON.stringify(v.reasons)}`);
    assert.equal(v.status, 'reference_valid_no_rpc');
    // references-only: a valid SHAPE does NOT configure or activate anything.
    assert.equal(v.configured, false);
    assert.equal(v.has_rpc, false);
    assert.deepEqual([...v.reasons], []);
    assert.equal(Object.isFrozen(v), true);
  }
  // endpoint_ref that carries an endpoint/url/rpc indicator is rejected (not references-only).
  const badEp = validateRpcProviderConfig({ provider_ref: 'ref-1', environment: 'devnet', endpoint_ref: 'https://node/' });
  assert.equal(badEp.valid, false);
  assert.ok(badEp.reasons.includes('endpoint_or_rpc_indicator_blocked'));
  // unknown field is rejected.
  const badUnknown = validateRpcProviderConfig({ provider_ref: 'ref-1', environment: 'devnet', surprise: 'x' });
  assert.equal(badUnknown.valid, false);
  assert.ok(badUnknown.reasons.includes('unknown_field_rejected'));
  // missing provider_ref -> unconfigured.
  const missing = validateRpcProviderConfig({ environment: 'devnet' });
  assert.equal(missing.valid, false);
  assert.equal(missing.status, 'unconfigured_no_rpc');
  assert.ok(missing.reasons.includes('missing_provider_ref'));
});

// ---- (10) key-material config/input refused (key_material_not_accepted) and never echoed ----

test('(10) key-material config/input is refused and never echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const words = Array(12).fill('abandon').join(' ');
  const objs = [{ secret: 'x' }, { private_key: 'x' }, { seed: 'x' }, { mnemonic: 'x' }, { keypair: 'x' }, { key_material: 'x' }, { raw_key: 'x' }];

  // refusesKeyMaterial flags every key-material shape.
  for (const km of [pem, base58, words, ...objs]) {
    assert.equal(refusesKeyMaterial(km), true, `must refuse: ${JSON.stringify(km).slice(0, 24)}`);
  }
  // non-key inputs are NOT falsely flagged.
  for (const ok of [undefined, null, 'devnet', { provider_ref: 'ref-1' }, { environment: 'testnet' }]) {
    assert.equal(refusesKeyMaterial(ok), false, `must NOT flag: ${JSON.stringify(ok)}`);
  }

  // validateConfig: key-material object -> invalid_key_material.
  for (const km of objs) {
    const v = validateRpcProviderConfig(km);
    assert.equal(v.valid, false);
    assert.equal(v.status, 'invalid_key_material');
    assert.ok(v.reasons.includes('key_material_not_accepted'));
    assert.equal(v.configured, false);
    assert.equal(v.has_rpc, false);
  }

  // readiness: key-material input -> key_material_not_accepted blocker, still not-ready.
  const r = evaluateRpcReadiness({ endpoint_present: true, secret: 'super-secret-value' });
  assertNotReadyShape(r);
  assert.ok(r.blockers.includes('key_material_not_accepted'));
  // the secret value is never echoed into the result.
  assert.equal(JSON.stringify(r).includes('super-secret-value'), false);
  const vSecret = validateRpcProviderConfig({ provider_ref: 'ref', environment: 'devnet', secret: 'super-secret-value' });
  assert.equal(JSON.stringify(vSecret).includes('super-secret-value'), false);
});

// ---- (11) hostile/throwing input to evaluateRpcReadiness returns a frozen refusal and does NOT throw ----

test('(11) hostile/throwing input still RETURNS a frozen refusal (input_inspection_error), never throws', () => {
  const throwingGetter = { get live_rpc_enabled() { throw new Error('boom'); } };
  const throwingProxy = new Proxy({}, { ownKeys() { throw new Error('ownKeys boom'); } });
  for (const hostile of [throwingGetter, throwingProxy]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateRpcReadiness(hostile); }, 'must not propagate the exception');
    assertNotReadyShape(r);
    assert.ok(r.blockers.includes('input_inspection_error'), 'inspection error recorded as a blocker');
    assert.ok(r.blockers.includes('rpc_provider_unconfigured_no_rpc'));
  }
  // the caught error message is never echoed into the result.
  assert.equal(JSON.stringify(evaluateRpcReadiness(throwingGetter)).includes('boom'), false);
  // primitive / weird inputs never throw either.
  for (const input of [undefined, null, 42, 'x', true, []]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateRpcReadiness(input); });
    assertNotReadyShape(r);
  }
});

// ---- (11b) hostile/throwing input to validateRpcProviderConfig also RETURNS a fail-closed refusal (never throws) ----

test('(11b) validateRpcProviderConfig is fail-closed on a hostile/throwing accessor (no throw, no echo)', () => {
  const throwingGetter = { get provider_ref() { throw new Error('boom'); } };
  const throwingProxy = new Proxy({}, { ownKeys() { throw new Error('ownKeys boom'); } });
  for (const hostile of [throwingGetter, throwingProxy]) {
    let r;
    assert.doesNotThrow(() => { r = validateRpcProviderConfig(hostile); }, 'must not propagate the exception');
    assert.equal(r.valid, false);
    assert.equal(r.configured, false);
    assert.equal(r.has_rpc, false);
    assert.ok(r.reasons.includes('input_inspection_error'));
    assert.equal(Object.isFrozen(r), true);
  }
  assert.equal(JSON.stringify(validateRpcProviderConfig(throwingGetter)).includes('boom'), false);
});

// ---- (12) fail-closed provider exposes NO send/broadcast/serialize/sendTransaction/connect method; descriptor pins all false ----

test('(12) createFailClosedRpcProvider exposes NO send/broadcast/serialize/connect method', () => {
  const p = createFailClosedRpcProvider();
  assert.equal(p.status, 'unconfigured_no_rpc');
  assert.equal(p.isConfigured(), false);
  assert.equal(p.describe().contract, 'rpc-provider');
  assert.equal(Object.isFrozen(p), true);
  // only the three contract operations exist as functions; nothing executes.
  for (const m of ['describe', 'validateConfig', 'evaluateReadiness']) {
    assert.equal(typeof p[m], 'function', `provider must expose ${m}`);
  }
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'sendRawTransaction', 'submit', 'sign', 'connect', 'rpc', 'request', 'call', 'query']) {
    assert.equal(typeof p[m], 'undefined', `provider must NOT expose ${m}`);
  }
  // provider's decision surfaces delegate to the fail-closed functions.
  const r = p.evaluateReadiness({ endpoint_present: true });
  assertNotReadyShape(r);
  const v = p.validateConfig({ provider_ref: 'ref-1', environment: 'devnet' });
  assert.equal(v.configured, false);
  assert.equal(v.has_rpc, false);
});

test('(12) descriptor pins can_send/can_broadcast/has_rpc/is_live/configured to false', () => {
  const c = describeRpcProviderContract();
  assert.equal(c.contract, 'rpc-provider');
  assert.equal(c.version, '0.0.0');
  assert.equal(c.configured, false);
  assert.equal(c.has_rpc, false);
  assert.equal(c.can_send, false);
  assert.equal(c.can_broadcast, false);
  assert.equal(c.accepts_key_material_input, false);
  assert.equal(c.is_live, false);
  assert.equal(c.status, 'unconfigured_no_rpc');
  assert.deepEqual([...c.operations], ['describe', 'validateConfig', 'evaluateReadiness']);
  assert.equal(Object.isFrozen(c), true);
  assert.equal(Object.isFrozen(c.operations), true);
});

// ---- (13) the package src is NOT allowlisted ----

test('(13) package src is NOT allowlisted (fully scanned by the mechanism guard)', () => {
  assert.equal(isAllowlisted('packages/rpc-provider-contract/src/'), false);
  assert.equal(isAllowlisted('packages/rpc-provider-contract/src/rpc-provider-contract.mjs'), false);
  assert.equal(isAllowlisted('packages/rpc-provider-contract/src/index.mjs'), false);
});

// ---- status constant ----

test('status constant is unconfigured_no_rpc', () => {
  assert.equal(RPC_PROVIDER_CONTRACT_STATUS, 'unconfigured_no_rpc');
});
