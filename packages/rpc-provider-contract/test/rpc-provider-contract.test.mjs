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
  // PR-E2-F-9 — provider registry (contract-only, Helius enabled reference-only, 3 slots, fail-closed, no-live).
  RPC_PROVIDER_MAX_SLOTS,
  describeRpcProviderRegistry,
  listSupportedRpcProviderRefs,
  normalizeRpcProviderSlots,
  validateRpcProviderSelection,
  // PR-E2-F-10 — Helius endpoint provisioning (contract-only, reference-only, fail-closed, no-live/no-secret).
  describeHeliusEndpointProvisioningContract,
  validateHeliusEndpointProvisioning,
  validateProviderEndpointRefs,
  // PR-E2-F-11 — endpoint-reference binding harness (test-only, in-memory, reference-only, fail-closed, no-live).
  describeEndpointReferenceBindingHarness,
  validateEndpointReferenceBinding,
  bindEndpointReferenceForTest,
  // PR-E2-F-13 — live RPC spike boundary (contract-only, test-only, no-broadcast, no-live).
  describeLiveRpcSpikeBoundaryContract,
  validateLiveRpcSpikeBoundaryRequest,
  evaluateLiveRpcSpikeBoundary,
} from '../src/index.mjs';
import {
  runMechanismGuard,
  ALLOWLIST,
  isAllowlisted,
  stripCommentsAndStrings,
} from '../../../tools/check-mechanism-guards.mjs';
// Test-only cross-package import (allowed): prove a Helius selection is STILL refused by the send gate.
import { evaluateSendPreflight } from '../../send-gate-contract/src/index.mjs';

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

// ---- (10b) key-material-shaped VALUES smuggled into provider_ref/endpoint_ref are refused (not accepted as a valid reference) ----

test('(10b) key-material-shaped reference VALUES (provider_ref/endpoint_ref) are refused, never accepted/echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nLEAKBYTES\n-----END PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const mnemonic = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, mnemonic]) {
    // smuggled as provider_ref value
    const a = validateRpcProviderConfig({ provider_ref: km, environment: 'devnet' });
    assert.equal(a.valid, false, `provider_ref key-material must be refused: ${km.slice(0, 16)}`);
    assert.equal(a.status, 'invalid_key_material');
    assert.ok(a.reasons.includes('key_material_not_accepted'));
    assert.equal(a.configured, false);
    assert.equal(a.has_rpc, false);
    assert.equal(JSON.stringify(a).includes(km), false, 'key material value never echoed');
    // smuggled as endpoint_ref value (with a clean provider_ref)
    const b = validateRpcProviderConfig({ provider_ref: 'opaque-ref-1', environment: 'devnet', endpoint_ref: km });
    assert.equal(b.valid, false, `endpoint_ref key-material must be refused: ${km.slice(0, 16)}`);
    assert.equal(b.status, 'invalid_key_material');
    assert.ok(b.reasons.includes('key_material_not_accepted'));
    assert.equal(JSON.stringify(b).includes(km), false);
    // refusesKeyMaterial predicate agrees for the shaped-value object
    assert.equal(refusesKeyMaterial({ provider_ref: km, environment: 'devnet' }), true);
  }
  // a clean opaque reference is still valid (no over-rejection of legitimate refs)
  const ok = validateRpcProviderConfig({ provider_ref: 'opaque-ref-handle-2', environment: 'devnet', endpoint_ref: 'opaque-ep-handle-3' });
  assert.equal(ok.valid, true);
  assert.equal(ok.status, 'reference_valid_no_rpc');
  assert.equal(ok.configured, false);
  assert.equal(ok.has_rpc, false);
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

// ===========================================================================================================
// PR-E2-F-9 — PROVIDER REGISTRY (contract-only, Helius enabled reference-only, 3 slots, fail-closed, NOT live)
// ===========================================================================================================
// 22 required proofs. The registry is references-only: a "valid" selection is configured:false / has_rpc:false /
// can_send:false / NOT live, slot contents are never echoed, and Helius is STILL refused by the send gate.

// Every registry selection result must be fail-closed (references-only, NOT live) regardless of validity.
function assertSelectionFailClosed(r) {
  assert.equal(Object.isFrozen(r), true);
  assert.equal(r.configured, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.can_send, false);
  assert.equal(r.max_provider_slots, 3);
  assert.equal(typeof r.slot_count, 'number');
  assert.equal(Object.isFrozen(r.reasons), true);
  // a registry selection result NEVER carries is_live:true and NEVER any live/handle/endpoint surface field.
  assert.notEqual(r.is_live, true);
  for (const k of ['key', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'endpoint', 'rpc_endpoint', 'provider_url', 'url', 'credential', 'handle', 'provider_ref']) {
    assert.equal(k in r, false, `selection result must not carry ${k}`);
  }
}

// ---- (R1)(R2)(R3)(R4)(R5) Helius accepted references-only; configured/has_rpc/can_send false; one slot valid ----

test('(R1-R5) Helius ref accepted references-only — valid/selection_valid_no_rpc, configured/has_rpc/can_send false, one slot', () => {
  const r = validateRpcProviderSelection([{ provider_ref: 'helius', environment: 'devnet' }]);
  assert.equal(r.valid, true, JSON.stringify([...r.reasons]));            // (1) accepted references-only
  assert.equal(r.status, 'selection_valid_no_rpc');
  assert.equal(r.configured, false);                                      // (2) configured:false
  assert.equal(r.has_rpc, false);                                         // (3) has_rpc:false
  assert.equal(r.can_send, false);                                        // (4) can_send:false
  assert.equal(r.slot_count, 1);                                          // (5) one slot valid
  assert.deepEqual([...r.reasons], []);
  assertSelectionFailClosed(r);
  // references-only: a valid Helius selection is NOT configured and does NOT activate anything.
});

// ---- (R6)(R7) 2-/3-slot CAPACITY via describe().max_provider_slots===3 and normalize within_capacity:true ----

test('(R6-R7) capacity: max_provider_slots===3; 2 and 3 slots are within_capacity:true', () => {
  assert.equal(RPC_PROVIDER_MAX_SLOTS, 3);
  const d = describeRpcProviderRegistry();
  assert.equal(d.max_provider_slots, 3);                                  // (6) capacity is 3
  const two = normalizeRpcProviderSlots([{ provider_ref: 'a' }, { provider_ref: 'b' }]);
  assert.equal(two.count, 2);
  assert.equal(two.within_capacity, true);                                // (6) two slots within capacity
  assert.equal(two.status, 'within_capacity_no_rpc');
  const three = normalizeRpcProviderSlots([{ provider_ref: 'a' }, { provider_ref: 'b' }, { provider_ref: 'c' }]);
  assert.equal(three.count, 3);
  assert.equal(three.within_capacity, true);                              // (7) three slots within capacity
  assert.equal(three.status, 'within_capacity_no_rpc');
  assert.equal(three.max_provider_slots, 3);
  assert.equal(Object.isFrozen(three), true);
  // {slots:Array} wrapper coercion counts the same.
  const wrapped = normalizeRpcProviderSlots({ slots: [{}, {}, {}] });
  assert.equal(wrapped.count, 3);
  assert.equal(wrapped.within_capacity, true);
});

// ---- (R8) 4+ slots -> selection too_many_provider_slots; normalize within_capacity:false / over_capacity ----

test('(R8) four+ slots -> too_many_provider_slots (selection) and over_capacity (normalize)', () => {
  const four = [
    { provider_ref: 'helius', environment: 'devnet' },
    { provider_ref: 'helius', environment: 'testnet' },
    { provider_ref: 'helius', environment: 'localnet' },
    { provider_ref: 'helius', environment: 'devnet' },
  ];
  const sel = validateRpcProviderSelection(four);
  assert.equal(sel.valid, false);
  assert.equal(sel.status, 'invalid');
  assert.equal(sel.slot_count, 4);
  assert.ok(sel.reasons.includes('too_many_provider_slots'));
  assertSelectionFailClosed(sel);
  const norm = normalizeRpcProviderSlots([{}, {}, {}, {}]);
  assert.equal(norm.count, 4);
  assert.equal(norm.within_capacity, false);
  assert.equal(norm.status, 'over_capacity');
  assert.equal(Object.isFrozen(norm), true);
});

// ---- (R9) zero slots -> selection no_provider_slots/unconfigured_no_rpc; normalize unconfigured_no_rpc ----

test('(R9) zero slots -> no_provider_slots + unconfigured_no_rpc (selection); unconfigured_no_rpc (normalize)', () => {
  for (const empty of [[], null, undefined, { slots: [] }]) {
    const sel = validateRpcProviderSelection(empty);
    assert.equal(sel.valid, false);
    assert.equal(sel.status, 'unconfigured_no_rpc');
    assert.equal(sel.slot_count, 0);
    assert.ok(sel.reasons.includes('no_provider_slots'), `no_provider_slots for ${JSON.stringify(empty)}`);
    assertSelectionFailClosed(sel);
  }
  for (const empty of [[], null, undefined, { slots: [] }]) {
    const norm = normalizeRpcProviderSlots(empty);
    assert.equal(norm.count, 0);
    assert.equal(norm.within_capacity, false);
    assert.equal(norm.status, 'unconfigured_no_rpc');
  }
});

// ---- (R10) unknown provider ref -> unknown_provider ----

test('(R10) unknown provider ref -> unknown_provider (invalid, fail-closed)', () => {
  const r = validateRpcProviderSelection([{ provider_ref: 'unknown-xyz', environment: 'devnet' }]);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('unknown_provider'));
  // a doc-listed-disabled ref does NOT classify as unknown_provider (that's provider_not_enabled — proof 12-set).
  assert.equal(r.reasons.includes('provider_not_enabled'), false);
  assertSelectionFailClosed(r);
});

// ---- (R11) duplicate Helius across two slots -> duplicate_provider ----

test('(R11) duplicate Helius across two slots -> duplicate_provider (invalid)', () => {
  const r = validateRpcProviderSelection([
    { provider_ref: 'helius', environment: 'devnet' },
    { provider_ref: 'helius', environment: 'testnet' },
  ]);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.equal(r.slot_count, 2);
  assert.ok(r.reasons.includes('duplicate_provider'));
  assertSelectionFailClosed(r);
});

// ---- (R12) mainnet environment slot -> mainnet_or_nontestnet_environment_blocked (propagated) ----

test('(R12) mainnet environment slot -> mainnet_or_nontestnet_environment_blocked; triton/yellowstone -> provider_not_enabled', () => {
  for (const env of ['mainnet', 'mainnet-beta', 'prod']) {
    const r = validateRpcProviderSelection([{ provider_ref: 'helius', environment: env }]);
    assert.equal(r.valid, false);
    assert.ok(r.reasons.includes('mainnet_or_nontestnet_environment_blocked'), `mainnet block for ${env}`);
    assertSelectionFailClosed(r);
  }
  // doc-listed DISABLED references are refused with provider_not_enabled (NOT enabled, NOT live).
  for (const ref of ['triton', 'yellowstone']) {
    const r = validateRpcProviderSelection([{ provider_ref: ref, environment: 'devnet' }]);
    assert.equal(r.valid, false);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('provider_not_enabled'), `provider_not_enabled for ${ref}`);
    assert.equal(r.reasons.includes('unknown_provider'), false);
    assertSelectionFailClosed(r);
  }
});

// ---- (R13) endpoint URL literal in a slot value -> endpoint_or_rpc_indicator_blocked AND not echoed ----

test('(R13) endpoint URL literal in a slot -> endpoint_or_rpc_indicator_blocked; URL never echoed', () => {
  const URL_LITERAL = 'https://x/';
  const r = validateRpcProviderSelection([{ provider_ref: 'helius', environment: 'devnet', endpoint_ref: URL_LITERAL }]);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked'));
  assert.equal(JSON.stringify(r).includes(URL_LITERAL), false, 'endpoint URL must not be echoed');
  assert.equal(JSON.stringify(r).includes('https://'), false);
  assertSelectionFailClosed(r);
});

// ---- (R14) api_key / endpoint secret indicator -> blocked and not echoed ----

test('(R14) api_key / endpoint secret indicator -> blocked and never echoed', () => {
  const MARK = 'MY-api_key-INDICATOR-ABC123';
  const r = validateRpcProviderSelection([{ provider_ref: 'helius', environment: 'devnet', endpoint_ref: MARK }]);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked'));
  assert.equal(JSON.stringify(r).includes(MARK), false, 'api_key indicator value must not be echoed');
  assert.equal(JSON.stringify(r).includes('api_key'), false);
  assertSelectionFailClosed(r);
});

// ---- (R15) key-material-shaped provider_ref -> key_material_not_accepted and not echoed ----

test('(R15) key-material-shaped provider_ref (PEM / long base58 / mnemonic) -> key_material_not_accepted; never echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nLEAKBYTES\n-----END PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const mnemonic = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, mnemonic]) {
    const r = validateRpcProviderSelection([{ provider_ref: km, environment: 'devnet' }]);
    assert.equal(r.valid, false, `key material refused: ${km.slice(0, 16)}`);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('key_material_not_accepted'));
    assert.equal(JSON.stringify(r).includes(km), false, 'key material never echoed');
    assertSelectionFailClosed(r);
    // smuggled as endpoint_ref value (with a clean Helius provider_ref) is also refused as key material.
    const r2 = validateRpcProviderSelection([{ provider_ref: 'helius', environment: 'devnet', endpoint_ref: km }]);
    assert.equal(r2.valid, false);
    assert.ok(r2.reasons.includes('key_material_not_accepted'));
    assert.equal(JSON.stringify(r2).includes(km), false);
  }
});

// ---- (R16) Helius selection is STILL refused by the send gate (cross-package, Milestone 2 preserved) ----

test('(R16) a Helius rpc_provider is STILL refused by the send gate (can_send:false)', () => {
  const sg = evaluateSendPreflight({
    sign_only_success: true,
    readiness_ready: true,
    preflight_ok: true,
    custody_status: 'ACTIVE',
    network: 'devnet',
    rpc_provider: { provider_ref: 'helius', environment: 'devnet' },
  });
  assert.equal(sg.can_send, false, 'Helius provider must NOT enable send — fail-closed boundary preserved');
});

// ---- (R17) faked {provider_ref:'helius',ready:true} is NOT configured/ready (unknown_field_rejected) ----

test('(R17) faked ready:true Helius slot -> unknown_field_rejected; never configured/has_rpc/can_send true', () => {
  const r = validateRpcProviderSelection([{ provider_ref: 'helius', environment: 'devnet', ready: true }]);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('unknown_field_rejected'), 'a surprise ready:true field is rejected');
  // a faked readiness flag can NEVER flip the fail-closed surface.
  assert.equal(r.configured, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.can_send, false);
  assert.notEqual(r.is_live, true);
  // the registry descriptor itself is fail-closed and never live.
  const d = describeRpcProviderRegistry();
  assert.equal(d.configured, false);
  assert.equal(d.has_rpc, false);
  assert.equal(d.can_send, false);
  assert.equal(d.is_live, false);
  assert.equal(d.status, 'unconfigured_no_rpc');
  assert.equal(d.contract, 'rpc-provider-registry');
  assert.deepEqual([...d.supported_provider_refs], ['helius']);
  assert.deepEqual([...d.doc_listed_disabled_provider_refs], ['triton', 'yellowstone']);
  assert.equal(Object.isFrozen(d), true);
  assert.deepEqual([...listSupportedRpcProviderRefs()], ['helius']);
  assert.equal(Object.isFrozen(listSupportedRpcProviderRefs()), true);
});

// ---- (R18) no SDK import — self-scan src specifiers: only relative, no @solana/jupiter/helius/jito/@noble/etc ----

test('(R18) src declares NO SDK/provider/network import specifier (only local relative paths)', () => {
  const reFrom = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const reBare = /\bimport\s*['"]([^'"]+)['"]/g;
  const reCall = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const FORBIDDEN_SPEC = /(@solana|@solana-program|solana|web3\.js|jupiter|@jup-ag|jito|helius|@noble|@coral-xyz|anchor|bs58|tweetnacl|ed25519|node:net|node:http|node:https|node:tls|node:dgram|undici|ws|axios|pg|redis|node:crypto)/i;
  for (const fn of srcMjsFiles()) {
    const text = readFileSync(join(SRC, fn), 'utf8');
    const specs = [];
    for (const re of [reFrom, reBare, reCall]) {
      for (const m of text.matchAll(re)) specs.push(m[1]);
    }
    for (const s of specs) {
      assert.equal(s.startsWith('.'), true, `${fn} must only import LOCAL relative paths: ${s}`);
      assert.equal(FORBIDDEN_SPEC.test(s), false, `${fn} must not import an SDK/provider/network module: ${s}`);
    }
  }
});

// ---- (R19) no dependency — package.json has no dependencies/devDependencies (registry adds none) ----

test('(R19) package.json still declares NO dependencies/devDependencies (registry is dependency-free)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  assert.equal('dependencies' in pkg, false);
  assert.equal('devDependencies' in pkg, false);
  assert.equal('peerDependencies' in pkg, false);
  assert.equal('optionalDependencies' in pkg, false);
});

// ---- (R20) no network/provider call — src import-free, no fetch/Connection in the registry code ----

test('(R20) src (incl. the registry) is import-free and carries NO network/provider mechanism', () => {
  const NETWORK_MECH = /(\b(fetch|XMLHttpRequest)\s*\(|new\s+WebSocket|WebSocket\s*\(|new\s+Connection\s*\(|XMLHttpRequest|EventSource|node:net|node:http)/;
  for (const fn of srcMjsFiles()) {
    const code = stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/\bimport\b[^;]*\bfrom\b|\brequire\s*\(/.test(code), false, `no imports allowed in ${fn}`);
    assert.equal(NETWORK_MECH.test(code), false, `no network/provider mechanism in ${fn}`);
  }
});

// ---- (R21) no send/broadcast/serialize methods on createFailClosedRpcProvider (unchanged by the registry) ----

test('(R21) createFailClosedRpcProvider still exposes NO send/broadcast/serialize/rpc method', () => {
  const p = createFailClosedRpcProvider();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'sendRawTransaction', 'submit', 'sign', 'connect', 'rpc', 'request', 'call', 'query', 'addProvider', 'selectProvider', 'register']) {
    assert.equal(typeof p[m], 'undefined', `provider must NOT expose ${m}`);
  }
  // the registry functions are pure/contract-only — none returns a configured or live surface.
  assert.equal(describeRpcProviderRegistry().is_live, false);
  assert.equal(validateRpcProviderSelection([{ provider_ref: 'helius', environment: 'devnet' }]).can_send, false);
});

// ---- (R22) hostile/throwing input -> frozen refusal (input_inspection_error / invalid), never throws, no echo ----

test('(R22) hostile/throwing input to selection & normalize -> frozen refusal, never throws, secret not echoed', () => {
  const SECRET = 'boom-secret-trap-XYZ';
  // a Proxy whose get trap throws on ANY property access -> coerceToSlots throws -> OUTER catch.
  const throwAll = new Proxy({}, { get() { throw new Error(SECRET); } });
  // a single throwing-getter object: wrapped as one slot; per-slot validateRpcProviderConfig catches internally.
  const throwingGetter = { get provider_ref() { throw new Error(SECRET); } };
  // an object with a throwing `slots` getter -> coerceToSlots throws -> OUTER catch.
  const throwingSlots = { get slots() { throw new Error(SECRET); } };

  for (const hostile of [throwAll, throwingGetter, throwingSlots]) {
    let sel;
    assert.doesNotThrow(() => { sel = validateRpcProviderSelection(hostile); }, 'selection must not propagate the exception');
    assert.equal(sel.valid, false);
    assert.equal(sel.status, 'invalid');
    assert.ok(sel.reasons.includes('input_inspection_error'));
    assertSelectionFailClosed(sel);
    assert.equal(JSON.stringify(sel).includes(SECRET), false, 'secret/error message never echoed (selection)');

    let norm;
    assert.doesNotThrow(() => { norm = normalizeRpcProviderSlots(hostile); }, 'normalize must not propagate the exception');
    assert.equal(Object.isFrozen(norm), true);
    assert.equal(norm.max_provider_slots, 3);
    assert.equal(JSON.stringify(norm).includes(SECRET), false, 'secret/error message never echoed (normalize)');
  }
  // the two outer-catch hostiles produce the documented fixed refusal shapes.
  for (const outer of [throwAll, throwingSlots]) {
    const norm = normalizeRpcProviderSlots(outer);
    assert.equal(norm.count, 0);
    assert.equal(norm.within_capacity, false);
    assert.equal(norm.status, 'invalid');
    const sel = validateRpcProviderSelection(outer);
    assert.equal(sel.slot_count, 0);
    assert.deepEqual([...sel.reasons], ['input_inspection_error']);
  }
  // primitive / weird inputs never throw either.
  for (const input of [42, 'x', true]) {
    assert.doesNotThrow(() => validateRpcProviderSelection(input));
    assert.doesNotThrow(() => normalizeRpcProviderSlots(input));
    // a non-array/non-object primitive coerces to [] -> zero slots.
    assert.equal(validateRpcProviderSelection(input).slot_count, 0);
    assert.equal(normalizeRpcProviderSlots(input).count, 0);
  }
});

// ===========================================================================================================
// PR-E2-F-10 — HELIUS ENDPOINT PROVISIONING (contract-only, reference-only, fail-closed, NOT live / NO secret)
// ===========================================================================================================
// 30 required proofs. "Provisioning" CLASSIFIES the shape of a reference-only provisioning description — it
// provisions/activates/contacts NOTHING. A "valid" provisioning shape is references-only: configured:false /
// has_rpc:false / ready:false / can_send:false / is_live:false, slot contents / endpoint_ref / secret VALUES are
// never echoed, and a provisioned Helius selection is STILL refused by the send gate.
//
// IMPORTANT — opaque endpoint_ref fixtures must avoid EVERY refused substring (no 'endpoint','rpc','url','http',
// 'ws','provider_url','api_key','secret','token','credential','mainnet','prod'). We use 'helius-slot-ref-1..N'.

const EP1 = 'helius-slot-ref-1';
const EP2 = 'helius-slot-ref-2';
const EP3 = 'helius-slot-ref-3';
const EP4 = 'helius-slot-ref-4';

// Every provisioning result must be fail-closed (reference-only, NOT live) regardless of validity.
function assertProvisioningFailClosed(r) {
  assert.equal(Object.isFrozen(r), true);
  assert.equal(r.configured, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.is_live, false);
  assert.notEqual(r.is_live, true);
  assert.equal(Object.isFrozen(r.reasons), true);
  // never carries a live/handle/endpoint/key surface field, and never echoes a provider_ref/endpoint_ref field.
  for (const k of ['key', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'endpoint', 'rpc_endpoint', 'provider_url', 'url', 'credential', 'handle', 'provider_ref', 'endpoint_ref']) {
    assert.equal(k in r, false, `provisioning result must not carry ${k}`);
  }
}

// ---- (1)-(5) Helius single-slot accepted references-only; valid/provisioning_valid_no_live; not configured/ready/sendable ----

test('(P1-P5) Helius single-slot provisioning valid references-only — configured/has_rpc/ready/can_send all false', () => {
  const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 });
  assert.equal(r.valid, true, JSON.stringify([...r.reasons]));            // (1) valid:true
  assert.equal(r.status, 'provisioning_valid_no_live');                   // (1) provisioning_valid_no_live
  assert.equal(r.configured, false);                                      // (2) configured:false
  assert.equal(r.has_rpc, false);                                         // (3) has_rpc:false
  assert.equal(r.ready, false);                                           // (4) ready:false
  assert.equal(r.can_send, false);                                        // (5) can_send:false
  assert.deepEqual([...r.reasons], []);
  assertProvisioningFailClosed(r);
});

// ---- (6) one-slot multi validator valid ----

test('(P6) one-slot validateProviderEndpointRefs is valid references-only (provisioning_valid_no_live)', () => {
  const r = validateProviderEndpointRefs([{ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 }]);
  assert.equal(r.valid, true, JSON.stringify([...r.reasons]));
  assert.equal(r.status, 'provisioning_valid_no_live');
  assert.equal(r.slot_count, 1);
  assert.equal(r.max_provider_slots, 3);
  assert.deepEqual([...r.reasons], []);
  assertProvisioningFailClosed(r);
});

// ---- (7) two distinct-endpoint_ref Helius slots -> valid, slot_count 2, still not configured/sendable ----

test('(P7) two distinct-endpoint_ref Helius slots -> valid, slot_count 2, configured:false/can_send:false', () => {
  const r = validateProviderEndpointRefs([
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 },
    { provider_ref: 'helius', environment: 'testnet', endpoint_ref: EP2 },
  ]);
  assert.equal(r.valid, true, JSON.stringify([...r.reasons]));
  assert.equal(r.status, 'provisioning_valid_no_live');
  assert.equal(r.slot_count, 2);
  assert.equal(r.configured, false);
  assert.equal(r.can_send, false);
  assert.deepEqual([...r.reasons], []);
  assertProvisioningFailClosed(r);
});

// ---- (8) three distinct slots -> valid, slot_count 3, no-live ----

test('(P8) three distinct-endpoint_ref Helius slots -> valid, slot_count 3, no-live', () => {
  const r = validateProviderEndpointRefs([
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 },
    { provider_ref: 'helius', environment: 'testnet', endpoint_ref: EP2 },
    { provider_ref: 'helius', environment: 'localnet', endpoint_ref: EP3 },
  ]);
  assert.equal(r.valid, true, JSON.stringify([...r.reasons]));
  assert.equal(r.status, 'provisioning_valid_no_live');
  assert.equal(r.slot_count, 3);
  assert.equal(r.is_live, false);
  assert.deepEqual([...r.reasons], []);
  assertProvisioningFailClosed(r);
});

// ---- (9) four slots -> too_many_provider_slots ----

test('(P9) four slots -> too_many_provider_slots (invalid, fail-closed)', () => {
  const r = validateProviderEndpointRefs([
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 },
    { provider_ref: 'helius', environment: 'testnet', endpoint_ref: EP2 },
    { provider_ref: 'helius', environment: 'localnet', endpoint_ref: EP3 },
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP4 },
  ]);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.equal(r.slot_count, 4);
  assert.ok(r.reasons.includes('too_many_provider_slots'));
  assertProvisioningFailClosed(r);
});

// ---- (10) zero slots -> no_provider_slots / unconfigured_no_rpc ----

test('(P10) zero slots -> no_provider_slots + unconfigured_no_rpc', () => {
  for (const empty of [[], null, undefined, { slots: [] }]) {
    const r = validateProviderEndpointRefs(empty);
    assert.equal(r.valid, false);
    assert.equal(r.status, 'unconfigured_no_rpc');
    assert.equal(r.slot_count, 0);
    assert.ok(r.reasons.includes('no_provider_slots'), `no_provider_slots for ${JSON.stringify(empty)}`);
    assertProvisioningFailClosed(r);
  }
});

// ---- (11) missing endpoint_ref -> endpoint_ref_missing (and not live) ----

test('(P11) missing endpoint_ref -> endpoint_ref_missing (unconfigured_no_rpc, not live)', () => {
  const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet' });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'unconfigured_no_rpc');
  assert.ok(r.reasons.includes('endpoint_ref_missing'));
  assertProvisioningFailClosed(r);
  // empty-string endpoint_ref is also missing.
  const empty = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: '' });
  assert.equal(empty.valid, false);
  assert.ok(empty.reasons.includes('endpoint_ref_missing'));
});

// ---- (12) endpoint_ref:'https://x/' -> endpoint_or_rpc_indicator_blocked AND URL not echoed ----

test('(P12) endpoint_ref URL literal -> endpoint_or_rpc_indicator_blocked; URL never echoed', () => {
  const URL_LITERAL = 'https://x/';
  const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: URL_LITERAL });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked'));
  assert.equal(JSON.stringify(r).includes(URL_LITERAL), false, 'endpoint URL must not be echoed');
  assert.equal(JSON.stringify(r).includes('https://'), false);
  assertProvisioningFailClosed(r);
});

// ---- (13) provider_url field -> blocked & not echoed ----

test('(P13) provider_url field -> blocked (unknown_field_rejected) & value never echoed', () => {
  const MARK = 'PROVIDER-URL-VALUE-MARK-13';
  const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1, provider_url: MARK });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('unknown_field_rejected'), 'a provider_url field is rejected as unknown');
  assert.equal(JSON.stringify(r).includes(MARK), false, 'provider_url value must not be echoed');
  assert.equal('provider_url' in r, false);
  assertProvisioningFailClosed(r);
});

// ---- (14) rpc_endpoint field -> blocked & not echoed ----

test('(P14) rpc_endpoint field -> blocked (unknown_field_rejected) & value never echoed', () => {
  const MARK = 'RPC-ENDPOINT-VALUE-MARK-14';
  const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1, rpc_endpoint: MARK });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('unknown_field_rejected'), 'an rpc_endpoint field is rejected as unknown');
  assert.equal(JSON.stringify(r).includes(MARK), false, 'rpc_endpoint value must not be echoed');
  assert.equal('rpc_endpoint' in r, false);
  assertProvisioningFailClosed(r);
});

// ---- (15) api_key field -> blocked (unknown_field_rejected) & not echoed ----

test('(P15) api_key field -> blocked (unknown_field_rejected) & value never echoed', () => {
  const MARK = 'API-KEY-VALUE-MARK-15';
  const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1, api_key: MARK });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('unknown_field_rejected'), 'an api_key field is rejected as unknown');
  assert.equal(JSON.stringify(r).includes(MARK), false, 'api_key value must not be echoed');
  assert.equal(JSON.stringify(r).includes('api_key'), false);
  assert.equal('api_key' in r, false);
  assertProvisioningFailClosed(r);
});

// ---- (16) secret/token field OR endpoint_ref containing 'secret'/'token' -> blocked & not echoed ----

test('(P16) secret-named field -> key_material_not_accepted; endpoint_ref carrying secret/token -> endpoint_secret_indicator_blocked; never echoed', () => {
  // a secret-NAMED field is refused as key material (by the reused hardened validator).
  const SECRET_VAL = 'SECRET-FIELD-VALUE-16';
  const rField = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1, secret: SECRET_VAL });
  assert.equal(rField.valid, false);
  assert.equal(rField.status, 'invalid');
  assert.ok(rField.reasons.includes('key_material_not_accepted'), 'secret-named field -> key_material_not_accepted');
  assert.equal(JSON.stringify(rField).includes(SECRET_VAL), false, 'secret value must not be echoed');
  assertProvisioningFailClosed(rField);

  // an endpoint_ref VALUE carrying a secret/token indicator -> endpoint_secret_indicator_blocked.
  for (const ep of ['my-secret-ref', 'my-token-ref', 'a-credential-ref', 'a-privatekey-ref', 'a-private_key-ref']) {
    const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: ep });
    assert.equal(r.valid, false, `secret-indicator endpoint_ref must be refused: ${ep}`);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('endpoint_secret_indicator_blocked'), `endpoint_secret_indicator_blocked for ${ep}`);
    assert.equal(JSON.stringify(r).includes(ep), false, 'endpoint_ref value must not be echoed');
    assertProvisioningFailClosed(r);
  }
});

// ---- (17) environment:'mainnet'/'prod' -> mainnet_or_nontestnet_environment_blocked ----

test('(P17) mainnet/prod environment -> mainnet_or_nontestnet_environment_blocked', () => {
  for (const env of ['mainnet', 'mainnet-beta', 'prod']) {
    const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: env, endpoint_ref: EP1 });
    assert.equal(r.valid, false);
    assert.ok(r.reasons.includes('mainnet_or_nontestnet_environment_blocked'), `mainnet block for ${env}`);
    // the input VALUE is never echoed: result carries only the fixed reason token + fixed literals, no
    // `environment` field. (Note: the reason token itself contains the word "mainnet" — that is the fixed
    // token name, not an echo of the input value; so we assert on field-absence + endpoint_ref non-echo.)
    assert.equal('environment' in r, false);
    assert.equal(JSON.stringify(r).includes(EP1), false, 'endpoint_ref value must not be echoed');
    assertProvisioningFailClosed(r);
  }
  // a 'prod' value (which does NOT overlap any reason-token substring) is genuinely never echoed.
  const prod = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'prod', endpoint_ref: EP1 });
  assert.equal(JSON.stringify(prod).includes('prod'), false, "the input value 'prod' must not be echoed");
});

// ---- (18) unknown provider_ref -> unknown_provider ----

test('(P18) unknown provider_ref -> unknown_provider (invalid, fail-closed)', () => {
  const r = validateHeliusEndpointProvisioning({ provider_ref: 'unknown-xyz', environment: 'devnet', endpoint_ref: EP1 });
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('unknown_provider'));
  assert.equal(r.reasons.includes('provider_not_enabled'), false);
  assertProvisioningFailClosed(r);
});

// ---- (19) triton / yellowstone -> provider_not_enabled ----

test('(P19) triton / yellowstone -> provider_not_enabled (doc-listed disabled, NOT live)', () => {
  for (const ref of ['triton', 'yellowstone']) {
    const r = validateHeliusEndpointProvisioning({ provider_ref: ref, environment: 'devnet', endpoint_ref: EP1 });
    assert.equal(r.valid, false);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('provider_not_enabled'), `provider_not_enabled for ${ref}`);
    assert.equal(r.reasons.includes('unknown_provider'), false);
    assertProvisioningFailClosed(r);
  }
});

// ---- (20) duplicate endpoint_ref across two Helius slots -> duplicate_endpoint_ref ----

test('(P20) duplicate endpoint_ref across two Helius slots -> duplicate_endpoint_ref (invalid)', () => {
  const r = validateProviderEndpointRefs([
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 },
    { provider_ref: 'helius', environment: 'testnet', endpoint_ref: EP1 },
  ]);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.equal(r.slot_count, 2);
  assert.ok(r.reasons.includes('duplicate_endpoint_ref'));
  assertProvisioningFailClosed(r);
});

// ---- (21) key-material-shaped endpoint_ref (PEM / long base58 / mnemonic) -> key_material_not_accepted, never echoed ----

test('(P21) key-material-shaped endpoint_ref (PEM/base58/mnemonic) -> key_material_not_accepted; never echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nLEAKBYTES\n-----END PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const mnemonic = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, mnemonic]) {
    const r = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: km });
    assert.equal(r.valid, false, `key material refused: ${km.slice(0, 16)}`);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('key_material_not_accepted'));
    assert.equal(JSON.stringify(r).includes(km), false, 'key material never echoed');
    assert.equal(JSON.stringify(r).includes('LEAKBYTES'), false, 'PEM bytes never echoed');
    assert.equal(JSON.stringify(r).includes(base58), false, 'base58 blob never echoed');
    assertProvisioningFailClosed(r);
    // same smuggled through the multi-slot surface is also refused as key material and not echoed.
    const r2 = validateProviderEndpointRefs([{ provider_ref: 'helius', environment: 'devnet', endpoint_ref: km }]);
    assert.equal(r2.valid, false);
    assert.ok(r2.reasons.includes('key_material_not_accepted'));
    assert.equal(JSON.stringify(r2).includes(km), false);
  }
});

// ---- (22) hostile/throwing input to both validators -> frozen refusal input_inspection_error, never throws ----

test('(P22) hostile/throwing input -> frozen input_inspection_error refusal, never throws, secret not echoed', () => {
  const SECRET = 'boom-secret-trap-P22';
  const throwingGetter = { get provider_ref() { throw new Error(SECRET); } };
  const throwingEndpoint = { provider_ref: 'helius', environment: 'devnet', get endpoint_ref() { throw new Error(SECRET); } };
  const throwAll = new Proxy({}, { get() { throw new Error(SECRET); } });
  const throwingSlots = { get slots() { throw new Error(SECRET); } };

  // single-slot validator never throws.
  for (const hostile of [throwingGetter, throwingEndpoint, throwAll]) {
    let r;
    assert.doesNotThrow(() => { r = validateHeliusEndpointProvisioning(hostile); }, 'single-slot must not propagate');
    assert.equal(r.valid, false);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('input_inspection_error'));
    assertProvisioningFailClosed(r);
    assert.equal(JSON.stringify(r).includes(SECRET), false, 'secret/error message never echoed (single-slot)');
  }

  // multi-slot validator never throws; outer-catch hostiles yield slot_count 0 + input_inspection_error.
  for (const hostile of [throwAll, throwingSlots]) {
    let r;
    assert.doesNotThrow(() => { r = validateProviderEndpointRefs(hostile); }, 'multi-slot must not propagate');
    assert.equal(r.valid, false);
    assert.equal(r.status, 'invalid');
    assert.equal(r.slot_count, 0);
    assert.deepEqual([...r.reasons], ['input_inspection_error']);
    assertProvisioningFailClosed(r);
    assert.equal(JSON.stringify(r).includes(SECRET), false, 'secret/error message never echoed (multi-slot)');
  }
  // a per-slot throwing getter is caught inside the per-slot validator and surfaces input_inspection_error.
  const perSlot = validateProviderEndpointRefs([throwingGetter]);
  assert.equal(perSlot.valid, false);
  assert.ok(perSlot.reasons.includes('input_inspection_error'));
  assert.equal(JSON.stringify(perSlot).includes(SECRET), false);

  // primitive / weird inputs never throw either.
  for (const input of [undefined, null, 42, 'x', true, []]) {
    assert.doesNotThrow(() => validateHeliusEndpointProvisioning(input));
    assert.doesNotThrow(() => validateProviderEndpointRefs(input));
  }
});

// ---- (23) a provisioned Helius selection still has can_send:false / not configured (provisioning + registry no send) ----

test('(P23) a provisioned Helius selection is STILL not configured and can_send:false (no send authority)', () => {
  const single = validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 });
  assert.equal(single.valid, true);
  assert.equal(single.configured, false);
  assert.equal(single.can_send, false);
  assert.equal(single.is_live, false);
  const multi = validateProviderEndpointRefs([
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 },
    { provider_ref: 'helius', environment: 'testnet', endpoint_ref: EP2 },
  ]);
  assert.equal(multi.valid, true);
  assert.equal(multi.configured, false);
  assert.equal(multi.can_send, false);
  assert.equal(multi.is_live, false);
  // the registry selection of the same Helius refs is likewise references-only / not sendable.
  const reg = validateRpcProviderSelection([{ provider_ref: 'helius', environment: 'devnet' }]);
  assert.equal(reg.can_send, false);
  assert.equal(reg.configured, false);
});

// ---- (24) Helius endpoint provisioning through the send gate is STILL refused (cross-package) ----

test('(P24) a provisioned Helius rpc_provider is STILL refused by the send gate (can_send:false)', () => {
  const sg = evaluateSendPreflight({
    sign_only_success: true,
    readiness_ready: true,
    preflight_ok: true,
    custody_status: 'ACTIVE',
    network: 'devnet',
    rpc_provider: { provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 },
  });
  assert.equal(sg.can_send, false, 'a provisioned Helius endpoint must NOT enable send — fail-closed preserved');
});

// ---- (25) no SDK import — self-scan src import specifiers (only local relative; no SDK/provider/network) ----

test('(P25) src declares NO SDK/provider/network import specifier (provisioning adds none)', () => {
  const reFrom = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const reBare = /\bimport\s*['"]([^'"]+)['"]/g;
  const reCall = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const FORBIDDEN_SPEC = /(@solana|@solana-program|solana|web3\.js|jupiter|@jup-ag|jito|helius|@noble|@coral-xyz|anchor|bs58|tweetnacl|ed25519|node:net|node:http|node:https|node:tls|node:dgram|undici|ws|axios|pg|redis|node:crypto)/i;
  for (const fn of srcMjsFiles()) {
    const text = readFileSync(join(SRC, fn), 'utf8');
    const specs = [];
    for (const re of [reFrom, reBare, reCall]) {
      for (const m of text.matchAll(re)) specs.push(m[1]);
    }
    for (const s of specs) {
      assert.equal(s.startsWith('.'), true, `${fn} must only import LOCAL relative paths: ${s}`);
      assert.equal(FORBIDDEN_SPEC.test(s), false, `${fn} must not import an SDK/provider/network module: ${s}`);
    }
  }
});

// ---- (26) no dependency — package.json still has no dependencies/devDependencies (provisioning adds none) ----

test('(P26) package.json still declares NO dependencies/devDependencies (provisioning is dependency-free)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  assert.equal('dependencies' in pkg, false);
  assert.equal('devDependencies' in pkg, false);
  assert.equal('peerDependencies' in pkg, false);
  assert.equal('optionalDependencies' in pkg, false);
});

// ---- (27) no network/provider call — src import-free, no fetch/Connection/WebSocket in the provisioning code ----

test('(P27) src (incl. provisioning) is import-free and carries NO network/provider mechanism', () => {
  const NETWORK_MECH = /(\b(fetch|XMLHttpRequest)\s*\(|new\s+WebSocket|WebSocket\s*\(|new\s+Connection\s*\(|XMLHttpRequest|EventSource|node:net|node:http)/;
  for (const fn of srcMjsFiles()) {
    const code = stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/\bimport\b[^;]*\bfrom\b|\brequire\s*\(/.test(code), false, `no imports allowed in ${fn}`);
    assert.equal(NETWORK_MECH.test(code), false, `no network/provider mechanism in ${fn}`);
    assert.equal(FORBIDDEN_CODE.test(code), false, `no forbidden live mechanism in ${fn}`);
  }
});

// ---- (28) no send/broadcast/serialize methods on createFailClosedRpcProvider (unchanged by provisioning) ----

test('(P28) createFailClosedRpcProvider still exposes NO send/broadcast/serialize/rpc method (provisioning is pure)', () => {
  const p = createFailClosedRpcProvider();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'sendRawTransaction', 'submit', 'sign', 'connect', 'rpc', 'request', 'call', 'query', 'provision', 'addEndpoint', 'setEndpoint', 'register']) {
    assert.equal(typeof p[m], 'undefined', `provider must NOT expose ${m}`);
  }
  // the provisioning functions are pure/contract-only — none returns a configured/live/sendable surface.
  assert.equal(describeHeliusEndpointProvisioningContract().is_live, false);
  assert.equal(validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 }).can_send, false);
  assert.equal(validateProviderEndpointRefs([{ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 }]).can_send, false);
});

// ---- (29) no literal endpoint URL / API key present in the new src (grep src for scheme://host / api key) ----

test('(P29) src contains NO literal endpoint URL or API-key literal (full-text scan)', () => {
  // scheme://<non-space-host> would be a real endpoint literal; an API-key-ish literal is also forbidden.
  const URL_LITERAL = /(https?:\/\/[^\s'")]+|wss?:\/\/[^\s'")]+)/;
  for (const fn of srcMjsFiles()) {
    const text = readFileSync(join(SRC, fn), 'utf8');
    assert.equal(URL_LITERAL.test(text), false, `${fn} must not contain a literal endpoint URL`);
    // the secret indicator tokens appear ONLY as match-token string literals, never as a real key/value pair.
    // assert there is no "api_key:" / "apiKey:" assignment-style literal carrying a value.
    assert.equal(/api_?key\s*[:=]\s*['"][^'"]+['"]/i.test(text), false, `${fn} must not assign an api key literal`);
    assert.equal(/secret\s*[:=]\s*['"][^'"]+['"]/i.test(text), false, `${fn} must not assign a secret literal`);
  }
});

// ---- (30) can_send:false unchanged across the provisioning matrix (valid AND invalid shapes) ----

test('(P30) can_send/is_live stay false across the whole provisioning matrix (valid + invalid)', () => {
  const matrix = [
    validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 }),     // valid
    validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'devnet' }),                        // missing ep
    validateHeliusEndpointProvisioning({ provider_ref: 'triton', environment: 'devnet', endpoint_ref: EP1 }),     // disabled
    validateHeliusEndpointProvisioning({ provider_ref: 'helius', environment: 'mainnet', endpoint_ref: EP1 }),    // mainnet
    validateProviderEndpointRefs([{ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 }]),         // valid multi
    validateProviderEndpointRefs([]),                                                                             // zero slots
    validateProviderEndpointRefs([
      { provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP1 },
      { provider_ref: 'helius', environment: 'testnet', endpoint_ref: EP1 },
    ]),                                                                                                            // duplicate
  ];
  for (const r of matrix) {
    assert.equal(r.can_send, false, `can_send must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.is_live, false, `is_live must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.configured, false);
    assert.equal(r.has_rpc, false);
    assert.equal(r.ready, false);
    assertProvisioningFailClosed(r);
  }
  // the descriptor is likewise fail-closed.
  const d = describeHeliusEndpointProvisioningContract();
  assert.equal(d.contract, 'helius-endpoint-provisioning');
  assert.equal(d.version, '0.0.0');
  assert.equal(d.provider_ref, 'helius');
  assert.deepEqual([...d.supported_environments], ['devnet', 'testnet', 'localnet']);
  assert.equal(d.max_provider_slots, 3);
  assert.equal(d.configured, false);
  assert.equal(d.has_rpc, false);
  assert.equal(d.ready, false);
  assert.equal(d.can_send, false);
  assert.equal(d.is_live, false);
  assert.equal(d.status, 'unconfigured_no_rpc');
  assert.equal(Object.isFrozen(d), true);
  assert.equal(typeof d.note, 'string');
});

// ===========================================================================================================
// PR-E2-F-11 — ENDPOINT-REFERENCE BINDING HARNESS (test-only, in-memory, reference-only, fail-closed, NOT live)
// ===========================================================================================================
// 32 required proofs. The harness proves an opaque endpoint_ref can be BOUND to a TEST-ONLY IN-MEMORY binding map
// and STAY fail-closed. It is NOT live: reads NO env, reads NO secret file, contacts NO provider, accepts NO
// URL/API key/secret, returns NO raw endpoint, makes NO network call, and NEVER sets has_rpc/ready/can_send/
// is_live/network_call_made true. A "bound" result is references-only — the result flags are FIXED LITERALS
// (all false), and the input / endpoint_ref / binding-entry VALUES are NEVER echoed. Any entry has_rpc/ready/
// can_send/is_live/configured flag is IGNORED and NEVER trusted.
//
// IMPORTANT — opaque endpoint_ref / binding VALUES must avoid EVERY refused substring (no 'endpoint','rpc','url',
// 'http','ws','provider_url','api_key','secret','token','credential','mainnet','prod'). We use 'helius-bind-ref-N'
// and 'reference_only'.

const BIND_REF_1 = 'helius-bind-ref-1';
const BIND_REF_2 = 'helius-bind-ref-2';

// A clean TEST-ONLY in-memory binding map: endpoint_ref -> reference-only entry. No live surface, no secret.
function cleanBindingMap(ref = BIND_REF_1, providerRef = 'helius', environment = 'devnet') {
  return { [ref]: { bound: true, provider_ref: providerRef, environment, endpoint_kind: 'reference_only' } };
}

// Every binding result must be fail-closed (references-only, NOT live) regardless of bound/validity. The result
// flags are FIXED LITERALS (all false); no live/handle/endpoint/key surface field is ever present.
function assertBindingFailClosed(r) {
  assert.equal(Object.isFrozen(r), true);
  assert.equal(r.configured, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.is_live, false);
  assert.equal(r.network_call_made, false);
  assert.notEqual(r.is_live, true);
  assert.equal(Object.isFrozen(r.reasons), true);
  // never carries a live/handle/endpoint/key surface field, and never echoes provider_ref/endpoint_ref/binding.
  for (const k of ['key', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'endpoint', 'rpc_endpoint', 'provider_url', 'url', 'credential', 'handle', 'provider_ref', 'endpoint_ref', 'binding', 'entry', 'bindingMap']) {
    assert.equal(k in r, false, `binding result must not carry ${k}`);
  }
}

// ---- (1) valid binding -> bound:true / reference_bound_no_live ----

test('(B1) valid Helius binding -> bound:true, reference_bound_no_live', () => {
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    cleanBindingMap(BIND_REF_1),
  );
  assert.equal(r.bound, true, JSON.stringify([...r.reasons]));
  assert.equal(r.valid, true);
  assert.equal(r.status, 'reference_bound_no_live');
  assert.deepEqual([...r.reasons], []);
  assertBindingFailClosed(r);
});

// ---- (2)-(7) a bound result still has configured/has_rpc/ready/can_send/is_live/network_call_made all false ----

test('(B2-B7) a bound result has configured/has_rpc/ready/can_send/is_live/network_call_made all false', () => {
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    cleanBindingMap(BIND_REF_1),
  );
  assert.equal(r.bound, true);
  assert.equal(r.configured, false);          // (2) configured:false
  assert.equal(r.has_rpc, false);             // (3) has_rpc:false
  assert.equal(r.ready, false);               // (4) ready:false
  assert.equal(r.can_send, false);            // (5) can_send:false
  assert.equal(r.is_live, false);             // (6) is_live:false
  assert.equal(r.network_call_made, false);   // (7) network_call_made:false
  assertBindingFailClosed(r);
});

// ---- (8) missing binding (empty map) -> endpoint_ref_unbound / bound:false ----

test('(B8) missing binding (empty map) -> endpoint_ref_unbound, bound:false (unbound)', () => {
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    {},
  );
  assert.equal(r.bound, false);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'unbound');
  assert.ok(r.reasons.includes('endpoint_ref_unbound'));
  assertBindingFailClosed(r);
});

// ---- (9) empty/{} binding map -> refused (a present-but-different ref is also unbound) ----

test('(B9) empty {} binding map and a ref absent from a populated map are both refused (unbound)', () => {
  // empty {} map
  const empty = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    {},
  );
  assert.equal(empty.bound, false);
  assert.equal(empty.status, 'unbound');
  assert.ok(empty.reasons.includes('endpoint_ref_unbound'));
  assertBindingFailClosed(empty);
  // a populated map that does NOT contain the requested ref is likewise unbound.
  const absent = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    cleanBindingMap(BIND_REF_2),
  );
  assert.equal(absent.bound, false);
  assert.equal(absent.status, 'unbound');
  assert.ok(absent.reasons.includes('endpoint_ref_unbound'));
  assertBindingFailClosed(absent);
  // an entry whose bound flag is NOT true is also unbound (lookup hit but not bound).
  const notBound = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    { [BIND_REF_1]: { bound: false, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' } },
  );
  assert.equal(notBound.bound, false);
  assert.ok(notBound.reasons.includes('endpoint_ref_unbound'));
  assertBindingFailClosed(notBound);
});

// ---- (10) mismatched provider (entry.provider_ref !== 'helius') -> endpoint_ref_provider_mismatch ----

test('(B10) entry provider_ref mismatch -> endpoint_ref_provider_mismatch (invalid, bound:false)', () => {
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    { [BIND_REF_1]: { bound: true, provider_ref: 'other-ref', environment: 'devnet', endpoint_kind: 'reference_only' } },
  );
  assert.equal(r.bound, false);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('endpoint_ref_provider_mismatch'));
  // the entry value 'other-ref' is never echoed.
  assert.equal(JSON.stringify(r).includes('other-ref'), false);
  assertBindingFailClosed(r);
});

// ---- (11) mismatched environment -> endpoint_ref_environment_mismatch ----

test('(B11) entry environment mismatch -> endpoint_ref_environment_mismatch (invalid, bound:false)', () => {
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'testnet', endpoint_kind: 'reference_only' } },
  );
  assert.equal(r.bound, false);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('endpoint_ref_environment_mismatch'));
  assertBindingFailClosed(r);
});

// ---- (12) URL in binding entry value -> blocked AND URL not echoed ----

test('(B12) URL in binding entry value -> endpoint_or_rpc_indicator_blocked; URL never echoed', () => {
  const URL_LITERAL = 'https://x/';
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: URL_LITERAL } },
  );
  assert.equal(r.bound, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked'));
  assert.equal(JSON.stringify(r).includes(URL_LITERAL), false, 'URL value never echoed');
  assert.equal(JSON.stringify(r).includes('https://'), false);
  assertBindingFailClosed(r);
});

// ---- (13) api_key indicator in binding entry -> blocked & not echoed ----

test('(B13) api_key indicator in binding entry -> endpoint_or_rpc_indicator_blocked; value never echoed', () => {
  // 'api_key' is in ENDPOINT_RPC_TOKENS; carried as an UNKNOWN entry value -> blocked. Value never echoed.
  const MARK = 'MY-api_key-VALUE-B13';
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', extra: MARK } },
  );
  assert.equal(r.bound, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked'));
  assert.equal(JSON.stringify(r).includes(MARK), false, 'api_key value never echoed');
  assert.equal(JSON.stringify(r).includes('api_key'), false);
  assertBindingFailClosed(r);
});

// ---- (14) secret/token indicator in binding entry -> blocked & not echoed ----

test('(B14) secret/token indicator in binding entry -> endpoint_secret_indicator_blocked; value never echoed', () => {
  for (const MARK of ['MY-secret-VALUE-B14', 'MY-token-VALUE-B14', 'A-credential-VALUE-B14']) {
    const r = bindEndpointReferenceForTest(
      { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
      { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', extra: MARK } },
    );
    assert.equal(r.bound, false, `secret/token entry must be refused: ${MARK}`);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('endpoint_secret_indicator_blocked'), `endpoint_secret_indicator_blocked for ${MARK}`);
    assert.equal(JSON.stringify(r).includes(MARK), false, 'secret/token value never echoed');
    assertBindingFailClosed(r);
  }
});

// ---- (15) raw endpoint field (provider_url / rpc_endpoint) in entry -> blocked & not echoed ----

test('(B15) raw endpoint field name (provider_url / rpc_endpoint) in entry -> blocked; value never echoed', () => {
  for (const [field, MARK] of [['provider_url', 'PROVIDER-URL-VAL-B15'], ['rpc_endpoint', 'RPC-ENDPOINT-VAL-B15']]) {
    const r = bindEndpointReferenceForTest(
      { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
      { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', [field]: MARK } },
    );
    assert.equal(r.bound, false, `${field} entry must be refused`);
    assert.equal(r.status, 'invalid');
    // an UNKNOWN entry key carrying an endpoint/rpc indicator (provider_url / rpc_endpoint) is screened & blocked.
    assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked'), `endpoint_or_rpc_indicator_blocked for ${field}`);
    assert.equal(JSON.stringify(r).includes(MARK), false, `${field} value never echoed`);
    assert.equal(field in r, false);
    assertBindingFailClosed(r);
  }
});

// ---- (16) mainnet/prod in entry OR input -> blocked ----

test('(B16) mainnet/prod in binding entry OR input -> blocked', () => {
  // mainnet/prod smuggled into a binding entry VALUE (unknown key) -> mainnet_or_nontestnet_environment_blocked.
  for (const MARK of ['some-mainnet-marker', 'a-prod-marker']) {
    const r = bindEndpointReferenceForTest(
      { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
      { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', extra: MARK } },
    );
    assert.equal(r.bound, false, `mainnet/prod entry must be refused: ${MARK}`);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('mainnet_or_nontestnet_environment_blocked'), `mainnet block for ${MARK}`);
    assertBindingFailClosed(r);
  }
  // mainnet/prod in the INPUT environment is refused by the reused provisioning validator (input shape invalid).
  for (const env of ['mainnet', 'mainnet-beta', 'prod']) {
    const r = bindEndpointReferenceForTest(
      { provider_ref: 'helius', environment: env, endpoint_ref: BIND_REF_1 },
      cleanBindingMap(BIND_REF_1, 'helius', env),
    );
    assert.equal(r.bound, false, `mainnet input must be refused: ${env}`);
    assert.ok(r.reasons.includes('mainnet_or_nontestnet_environment_blocked'), `mainnet input block for ${env}`);
    assertBindingFailClosed(r);
  }
});

// ---- (17) unknown provider input -> unknown_provider ----

test('(B17) unknown provider input -> unknown_provider (invalid input shape, bound:false)', () => {
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'unknown-xyz', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    cleanBindingMap(BIND_REF_1, 'unknown-xyz'),
  );
  assert.equal(r.bound, false);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.ok(r.reasons.includes('unknown_provider'));
  assertBindingFailClosed(r);
});

// ---- (18) triton / yellowstone input -> provider_not_enabled ----

test('(B18) triton / yellowstone input -> provider_not_enabled (doc-listed disabled, bound:false)', () => {
  for (const ref of ['triton', 'yellowstone']) {
    const r = bindEndpointReferenceForTest(
      { provider_ref: ref, environment: 'devnet', endpoint_ref: BIND_REF_1 },
      cleanBindingMap(BIND_REF_1, ref),
    );
    assert.equal(r.bound, false);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('provider_not_enabled'), `provider_not_enabled for ${ref}`);
    assert.equal(r.reasons.includes('unknown_provider'), false);
    assertBindingFailClosed(r);
  }
});

// ---- (19) duplicate endpoint_ref via validateProviderEndpointRefs still duplicate_endpoint_ref (existing) ----

test('(B19) existing provisioning duplicate_endpoint_ref still holds (F10 surface unaffected by F11)', () => {
  const r = validateProviderEndpointRefs([
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    { provider_ref: 'helius', environment: 'testnet', endpoint_ref: BIND_REF_1 },
  ]);
  assert.equal(r.valid, false);
  assert.equal(r.status, 'invalid');
  assert.equal(r.slot_count, 2);
  assert.ok(r.reasons.includes('duplicate_endpoint_ref'));
  assert.equal(r.can_send, false);
  assert.equal(r.is_live, false);
});

// ---- (20) key-material-shaped endpoint_ref (PEM/base58/mnemonic) -> key_material_not_accepted & not echoed ----

test('(B20) key-material-shaped endpoint_ref (input) -> key_material_not_accepted; never echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nLEAKBYTES\n-----END PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const mnemonic = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, mnemonic]) {
    const r = bindEndpointReferenceForTest(
      { provider_ref: 'helius', environment: 'devnet', endpoint_ref: km },
      cleanBindingMap(km),
    );
    assert.equal(r.bound, false, `key material refused: ${km.slice(0, 16)}`);
    assert.equal(r.valid, false);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('key_material_not_accepted'));
    assert.equal(JSON.stringify(r).includes(km), false, 'key material never echoed');
    assert.equal(JSON.stringify(r).includes('LEAKBYTES'), false);
    assertBindingFailClosed(r);
    // validateEndpointReferenceBinding agrees: key-material input is refused & not echoed.
    const v = validateEndpointReferenceBinding({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: km });
    assert.equal(v.valid, false);
    assert.ok(v.reasons.includes('key_material_not_accepted'));
    assert.equal(JSON.stringify(v).includes(km), false);
  }
});

// ---- (21) key-material-shaped binding VALUE -> key_material_not_accepted & not echoed ----

test('(B21) key-material-shaped binding entry VALUE -> key_material_not_accepted; never echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nLEAKBYTES2\n-----END PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const mnemonic = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, mnemonic]) {
    const r = bindEndpointReferenceForTest(
      { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
      { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', extra: km } },
    );
    assert.equal(r.bound, false, `key-material binding value refused: ${km.slice(0, 16)}`);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('key_material_not_accepted'));
    assert.equal(JSON.stringify(r).includes(km), false, 'key-material binding value never echoed');
    assert.equal(JSON.stringify(r).includes('LEAKBYTES2'), false);
    assertBindingFailClosed(r);
  }
  // a secret-NAMED field in the entry is also refused as key material (never echoed).
  const SECRET_VAL = 'SECRET-NAMED-FIELD-VALUE-B21';
  const named = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', private_key: SECRET_VAL } },
  );
  assert.equal(named.bound, false);
  assert.ok(named.reasons.includes('key_material_not_accepted'));
  assert.equal(JSON.stringify(named).includes(SECRET_VAL), false);
  assertBindingFailClosed(named);
});

// ---- (22) hostile throwing input (getter/Proxy) to both validators -> frozen input_inspection_error, no throw ----

test('(B22) hostile/throwing input -> frozen input_inspection_error refusal, never throws, secret not echoed', () => {
  const SECRET = 'boom-secret-trap-B22';
  const throwingGetter = { get provider_ref() { throw new Error(SECRET); } };
  const throwingEndpoint = { provider_ref: 'helius', environment: 'devnet', get endpoint_ref() { throw new Error(SECRET); } };
  const throwAll = new Proxy({}, { get() { throw new Error(SECRET); } });

  // validateEndpointReferenceBinding never throws.
  for (const hostile of [throwingGetter, throwingEndpoint, throwAll]) {
    let v;
    assert.doesNotThrow(() => { v = validateEndpointReferenceBinding(hostile); }, 'validate must not propagate');
    assert.equal(v.valid, false);
    assert.equal(v.status, 'invalid');
    assert.ok(v.reasons.includes('input_inspection_error'));
    assert.equal(Object.isFrozen(v), true);
    assert.equal(v.network_call_made, false);
    assert.equal(JSON.stringify(v).includes(SECRET), false, 'secret never echoed (validate)');
  }
  // bindEndpointReferenceForTest never throws on a hostile input: it always returns a frozen, fail-closed refusal
  // carrying input_inspection_error and never echoes the secret. The exact status is a refusal value (invalid for
  // a getter that throws on the looked-up endpoint_ref / a throw-all Proxy; unbound when the provisioning step
  // caught the throw internally and the absent endpoint_ref then reads as not-bound) — both are fail-closed.
  for (const hostile of [throwingGetter, throwingEndpoint, throwAll]) {
    let r;
    assert.doesNotThrow(() => { r = bindEndpointReferenceForTest(hostile, cleanBindingMap(BIND_REF_1)); }, 'bind must not propagate');
    assert.equal(r.bound, false);
    assert.equal(r.valid, false);
    assert.ok(['invalid', 'unbound'].includes(r.status), `hostile bind status must be a refusal: ${r.status}`);
    assert.ok(r.reasons.includes('input_inspection_error'), `input_inspection_error recorded: ${JSON.stringify([...r.reasons])}`);
    assertBindingFailClosed(r);
    assert.equal(JSON.stringify(r).includes(SECRET), false, 'secret never echoed (bind)');
  }
  // a getter that throws on the LOOKED-UP endpoint_ref forces the outer catch -> a fixed 'invalid' refusal.
  const throwOnEndpoint = { provider_ref: 'helius', environment: 'devnet', get endpoint_ref() { throw new Error(SECRET); } };
  const rEp = bindEndpointReferenceForTest(throwOnEndpoint, cleanBindingMap(BIND_REF_1));
  assert.equal(rEp.bound, false);
  assert.equal(rEp.status, 'invalid');
  assert.deepEqual([...rEp.reasons], ['input_inspection_error']);
  assert.equal(JSON.stringify(rEp).includes(SECRET), false);
  assertBindingFailClosed(rEp);
  // primitive / weird inputs never throw either.
  for (const input of [undefined, null, 42, 'x', true, []]) {
    assert.doesNotThrow(() => validateEndpointReferenceBinding(input));
    assert.doesNotThrow(() => bindEndpointReferenceForTest(input, cleanBindingMap(BIND_REF_1)));
  }
});

// ---- (23) hostile throwing binding map (getter/Proxy) -> frozen refusal, no throw, no echo ----

test('(B23) hostile/throwing binding map -> frozen refusal, never throws, secret not echoed', () => {
  const SECRET = 'boom-map-trap-B23';
  const input = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 };
  // a Proxy whose get trap throws on ANY property access (the bindingMap[epRef] lookup throws -> outer catch).
  const throwAllMap = new Proxy({}, { get() { throw new Error(SECRET); } });
  // a map whose target endpoint_ref slot is a throwing getter -> lookup throws -> outer catch.
  const throwingSlotMap = { get [BIND_REF_1]() { throw new Error(SECRET); } };
  // a map whose entry exposes a throwing accessor on a screened property -> screen throws -> outer catch.
  const throwingEntryMap = { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', get endpoint_kind() { throw new Error(SECRET); } } };

  for (const hostileMap of [throwAllMap, throwingSlotMap, throwingEntryMap]) {
    let r;
    assert.doesNotThrow(() => { r = bindEndpointReferenceForTest(input, hostileMap); }, 'bind must not propagate map exception');
    assert.equal(r.bound, false);
    assert.equal(r.valid, false);
    assert.equal(r.status, 'invalid');
    assert.ok(r.reasons.includes('input_inspection_error'));
    assertBindingFailClosed(r);
    assert.equal(JSON.stringify(r).includes(SECRET), false, 'secret/error message never echoed (hostile map)');
  }
  // an Array bindingMap is rejected (not a plain object) -> unbound, never throws.
  const arrMap = bindEndpointReferenceForTest(input, [{ bound: true }]);
  assert.equal(arrMap.bound, false);
  assert.ok(arrMap.reasons.includes('endpoint_ref_unbound'));
  assertBindingFailClosed(arrMap);
  // a null / primitive bindingMap is rejected too.
  for (const badMap of [null, undefined, 42, 'x', true]) {
    let r;
    assert.doesNotThrow(() => { r = bindEndpointReferenceForTest(input, badMap); });
    assert.equal(r.bound, false);
    assert.ok(r.reasons.includes('endpoint_ref_unbound'));
    assertBindingFailClosed(r);
  }
});

// ---- (24) endpoint binding + provider registry still no-live (validateProviderEndpointRefs / selection) ----

test('(B24) endpoint binding leaves the provider registry / provisioning STILL no-live (can_send:false)', () => {
  // a bound endpoint_ref does NOT change the registry/provisioning surfaces — they stay references-only / no-live.
  const bound = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    cleanBindingMap(BIND_REF_1),
  );
  assert.equal(bound.bound, true);
  assert.equal(bound.can_send, false);
  // the F9 registry selection of the same Helius ref is still references-only / not sendable / not live.
  const sel = validateRpcProviderSelection([{ provider_ref: 'helius', environment: 'devnet' }]);
  assert.equal(sel.can_send, false);
  assert.equal(sel.configured, false);
  assert.notEqual(sel.is_live, true);
  // the F10 provisioning of the same endpoint_ref is still references-only / not sendable / not live.
  const prov = validateProviderEndpointRefs([{ provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 }]);
  assert.equal(prov.can_send, false);
  assert.equal(prov.configured, false);
  assert.equal(prov.is_live, false);
});

// ---- (25) endpoint binding through the send gate is STILL refused (cross-package, can_send:false) ----

test('(B25) a bound Helius endpoint_ref is STILL refused by the send gate (can_send:false)', () => {
  const sg = evaluateSendPreflight({
    sign_only_success: true,
    readiness_ready: true,
    preflight_ok: true,
    custody_status: 'ACTIVE',
    network: 'devnet',
    rpc_provider: { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
  });
  assert.equal(sg.can_send, false, 'a bound Helius endpoint must NOT enable send — fail-closed boundary preserved');
});

// ---- (26) faked entry flags {has_rpc:true, ready:true, can_send:true} are IGNORED (result flags stay false) ----

test('(B26) faked entry has_rpc/ready/can_send/is_live/configured flags are IGNORED; result flags stay false', () => {
  const r = bindEndpointReferenceForTest(
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 },
    { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', has_rpc: true, ready: true, can_send: true, is_live: true, configured: true, network_call_made: true } },
  );
  // the entry's faked flags can NEVER flip the fail-closed surface; result flags are FIXED LITERALS (all false).
  // Note: a faked flag-key like 'has_rpc' contains the 'rpc' token (and is not a canonical key) -> screened &
  // refused -> bound:false, AND the result flags stay false regardless (never-trust-entry-flags invariant).
  assert.equal(r.has_rpc, false);
  assert.equal(r.ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.is_live, false);
  assert.equal(r.configured, false);
  assert.equal(r.network_call_made, false);
  assert.equal(r.bound, false, 'a flag-spoofing entry is screened & refused');
  assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked'), 'has_rpc/can_send keys carry the rpc token');
  assertBindingFailClosed(r);
});

// ---- (27) no SDK import — self-scan src import specifiers (only local relative; no SDK/provider/network) ----

test('(B27) src declares NO SDK/provider/network import specifier (binding harness adds none)', () => {
  const reFrom = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const reBare = /\bimport\s*['"]([^'"]+)['"]/g;
  const reCall = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const FORBIDDEN_SPEC = /(@solana|@solana-program|solana|web3\.js|jupiter|@jup-ag|jito|helius|@noble|@coral-xyz|anchor|bs58|tweetnacl|ed25519|node:net|node:http|node:https|node:tls|node:dgram|undici|ws|axios|pg|redis|node:crypto|node:fs|node:process)/i;
  for (const fn of srcMjsFiles()) {
    const text = readFileSync(join(SRC, fn), 'utf8');
    const specs = [];
    for (const re of [reFrom, reBare, reCall]) {
      for (const m of text.matchAll(re)) specs.push(m[1]);
    }
    for (const s of specs) {
      assert.equal(s.startsWith('.'), true, `${fn} must only import LOCAL relative paths: ${s}`);
      assert.equal(FORBIDDEN_SPEC.test(s), false, `${fn} must not import an SDK/provider/network/fs module: ${s}`);
    }
  }
});

// ---- (28) no dependency — package.json still has no dependencies/devDependencies (binding adds none) ----

test('(B28) package.json still declares NO dependencies/devDependencies (binding harness is dependency-free)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  assert.equal('dependencies' in pkg, false);
  assert.equal('devDependencies' in pkg, false);
  assert.equal('peerDependencies' in pkg, false);
  assert.equal('optionalDependencies' in pkg, false);
});

// ---- (29) no network/provider call + NO env read (grep src for process.env / readFileSync / node:fs / node:process) ----

test('(B29) src (incl. binding harness) carries NO network/provider mechanism AND NO env/secret-file read', () => {
  const NETWORK_MECH = /(\b(fetch|XMLHttpRequest)\s*\(|new\s+WebSocket|WebSocket\s*\(|new\s+Connection\s*\(|XMLHttpRequest|EventSource|node:net|node:http)/;
  // env / secret-file read mechanisms must be entirely ABSENT from src (even inside comments/strings).
  const ENV_SECRET_READ = /(process\.env|readFileSync|readFile\s*\(|node:fs|node:process|require\s*\(\s*['"]fs['"])/;
  for (const fn of srcMjsFiles()) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    const code = stripCommentsAndStrings(raw);
    assert.equal(/\bimport\b[^;]*\bfrom\b|\brequire\s*\(/.test(code), false, `no imports allowed in ${fn}`);
    assert.equal(NETWORK_MECH.test(code), false, `no network/provider mechanism in ${fn}`);
    assert.equal(FORBIDDEN_CODE.test(code), false, `no forbidden live mechanism in ${fn}`);
    // full-text scan (raw, not just code): the harness reads NO env and NO secret file at all.
    assert.equal(ENV_SECRET_READ.test(raw), false, `${fn} must not read env / secret files`);
  }
  // the descriptor explicitly pins reads_env / reads_secret_files / network_call_made to false.
  const d = describeEndpointReferenceBindingHarness();
  assert.equal(d.reads_env, false);
  assert.equal(d.reads_secret_files, false);
  assert.equal(d.network_call_made, false);
});

// ---- (30) no send/broadcast/serialize methods on createFailClosedRpcProvider (unchanged by binding harness) ----

test('(B30) createFailClosedRpcProvider still exposes NO send/broadcast/serialize/rpc method (binding is pure)', () => {
  const p = createFailClosedRpcProvider();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'sendRawTransaction', 'submit', 'sign', 'connect', 'rpc', 'request', 'call', 'query', 'bind', 'bindEndpoint', 'resolve', 'lookup', 'register']) {
    assert.equal(typeof p[m], 'undefined', `provider must NOT expose ${m}`);
  }
  // the binding functions are pure/contract-only — none returns a configured/live/sendable surface.
  assert.equal(describeEndpointReferenceBindingHarness().is_live, false);
  assert.equal(bindEndpointReferenceForTest({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 }, cleanBindingMap(BIND_REF_1)).can_send, false);
});

// ---- (31) no literal endpoint URL / API key present in the new src (grep src for scheme://host / api key) ----

test('(B31) src contains NO literal endpoint URL or API-key literal (full-text scan, binding harness adds none)', () => {
  const URL_LITERAL = /(https?:\/\/[^\s'")]+|wss?:\/\/[^\s'")]+)/;
  for (const fn of srcMjsFiles()) {
    const text = readFileSync(join(SRC, fn), 'utf8');
    assert.equal(URL_LITERAL.test(text), false, `${fn} must not contain a literal endpoint URL`);
    assert.equal(/api_?key\s*[:=]\s*['"][^'"]+['"]/i.test(text), false, `${fn} must not assign an api key literal`);
    assert.equal(/secret\s*[:=]\s*['"][^'"]+['"]/i.test(text), false, `${fn} must not assign a secret literal`);
  }
});

// ---- (32) can_send:false unchanged across the whole binding matrix (bound + unbound + invalid shapes) ----

test('(B32) can_send/is_live/network_call_made stay false across the whole binding matrix', () => {
  const matrix = [
    bindEndpointReferenceForTest({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 }, cleanBindingMap(BIND_REF_1)), // bound
    bindEndpointReferenceForTest({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 }, {}),                          // unbound
    bindEndpointReferenceForTest({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 }, cleanBindingMap(BIND_REF_1, 'helius', 'testnet')), // env mismatch
    bindEndpointReferenceForTest({ provider_ref: 'unknown-xyz', environment: 'devnet', endpoint_ref: BIND_REF_1 }, cleanBindingMap(BIND_REF_1, 'unknown-xyz')),  // unknown provider
    bindEndpointReferenceForTest({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 }, { [BIND_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'https://x/' } }), // url in entry
    validateEndpointReferenceBinding({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: BIND_REF_1 }), // valid binding-input shape
    validateEndpointReferenceBinding({ provider_ref: 'helius', environment: 'mainnet', endpoint_ref: BIND_REF_1 }), // mainnet input
  ];
  for (const r of matrix) {
    assert.equal(r.can_send, false, `can_send must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.is_live, false, `is_live must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.network_call_made, false, `network_call_made must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.configured, false);
    assert.equal(r.has_rpc, false);
    assert.equal(r.ready, false);
    assert.equal(Object.isFrozen(r), true);
  }
  // the descriptor is likewise fail-closed and test-only.
  const d = describeEndpointReferenceBindingHarness();
  assert.equal(d.contract, 'endpoint-reference-binding-harness');
  assert.equal(d.version, '0.0.0');
  assert.equal(d.test_only, true);
  assert.equal(d.reads_env, false);
  assert.equal(d.reads_secret_files, false);
  assert.equal(d.provider_ref, 'helius');
  assert.deepEqual([...d.supported_environments], ['devnet', 'testnet', 'localnet']);
  assert.equal(d.configured, false);
  assert.equal(d.has_rpc, false);
  assert.equal(d.ready, false);
  assert.equal(d.can_send, false);
  assert.equal(d.is_live, false);
  assert.equal(d.network_call_made, false);
  assert.equal(d.status, 'unconfigured_no_rpc');
  assert.equal(Object.isFrozen(d), true);
  assert.equal(typeof d.note, 'string');
});

// ===========================================================================================================
// PR-E2-F-13 — LIVE RPC SPIKE BOUNDARY (contract-only, test-only, no-broadcast, NOT live)
// ===========================================================================================================
// 40 required proofs. The spike boundary DESCRIBES/VALIDATES the conditions of a FUTURE testnet RPC spike REQUEST
// and executes NO live RPC: no live RPC call, no endpoint resolution, no env/secret read, no fetch/WebSocket/
// Connection, no SDK/dependency, no send/broadcast/serialize. A valid spike request must be a NO-BROADCAST request
// bound to a TEST-ONLY in-memory endpoint reference. Everything is fail-closed: every result flag is a FIXED
// LITERAL (all false / not-ready / not-live), provider_ref is only ever the literal 'helius', environment is only
// a recognized testnet enum value, and input / endpoint_ref / secret / binding VALUES are NEVER echoed.
//
// IMPORTANT — opaque endpoint_ref / binding VALUES must avoid EVERY refused substring (no 'endpoint','rpc','url',
// 'http','ws','provider_url','api_key','secret','token','credential','mainnet','prod','broadcast','send',
// 'serialize'). We use 'helius-spike-ref-N' and 'reference_only'.

const SPIKE_REF_1 = 'helius-spike-ref-1';
const SPIKE_REF_2 = 'helius-spike-ref-2';

// A clean, spec-mandated valid spike REQUEST (a no-broadcast future-testnet-spike description).
function validSpikeRequest(ref = SPIKE_REF_1, environment = 'devnet') {
  return { provider_ref: 'helius', environment, endpoint_ref: ref, purpose: 'live_rpc_spike_boundary', no_broadcast: true };
}

// A clean TEST-ONLY in-memory binding map: endpoint_ref -> reference-only entry. No live surface, no secret.
function spikeBindingMap(ref = SPIKE_REF_1, providerRef = 'helius', environment = 'devnet') {
  return { [ref]: { bound: true, provider_ref: providerRef, environment, endpoint_kind: 'reference_only' } };
}

// The fixed-literal flags every spike-boundary REQUEST result must carry (all false — never live, never sendable).
function assertSpikeRequestFlagsFalse(r) {
  assert.equal(r.configured, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.can_serialize, false);
  assert.equal(r.is_live, false);
  assert.equal(r.live_rpc_call_made, false);
  assert.equal(r.network_call_made, false);
  assert.equal(r.broadcast_permitted, false);
  assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.isFrozen(r.reasons), true);
}

// Every spike-boundary EVAL result must be fail-closed (no-live) regardless of pass/fail. The result flags are
// FIXED LITERALS (all false); no live/handle/endpoint/key surface field is ever present, and an UNbound/failed
// result never echoes provider_ref/environment as real values.
function assertSpikeFailClosed(r) {
  assert.equal(Object.isFrozen(r), true);
  assert.equal(r.configured, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.can_serialize, false);
  assert.equal(r.is_live, false);
  assert.equal(r.live_rpc_call_made, false);
  assert.equal(r.network_call_made, false);
  assert.equal(r.broadcast_permitted, false);
  assert.notEqual(r.is_live, true);
  assert.equal(Object.isFrozen(r.reasons), true);
  // never carries a live/handle/endpoint/key surface field, and never echoes endpoint_ref/secret/binding values.
  for (const k of ['key', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'endpoint', 'rpc_endpoint', 'provider_url', 'url', 'credential', 'handle', 'endpoint_ref', 'binding', 'entry', 'bindingMap', 'purpose', 'no_broadcast']) {
    assert.equal(k in r, false, `spike result must not carry ${k}`);
  }
}

// ---- (S1) valid request + map -> valid:true / boundary_passed:true / live_rpc_spike_boundary_no_live ----

test('(S1) valid spike request + map -> valid:true, boundary_passed:true, live_rpc_spike_boundary_no_live', () => {
  const r = evaluateLiveRpcSpikeBoundary(validSpikeRequest(), spikeBindingMap());
  assert.equal(r.valid, true, JSON.stringify([...r.reasons]));
  assert.equal(r.boundary_passed, true);
  assert.equal(r.status, 'live_rpc_spike_boundary_no_live');
  assert.equal(r.bound, true);
  assert.deepEqual([...r.reasons], []);
  // provider_ref echoed ONLY as the recognized literal 'helius'; environment ONLY a recognized testnet enum value.
  assert.equal(r.provider_ref, 'helius');
  assert.equal(r.environment, 'devnet');
  assertSpikeFailClosed(r);
});

// ---- (S2) valid request + EMPTY map -> endpoint_ref_unbound, boundary_passed:false ----

test('(S2) valid request + EMPTY map -> endpoint_ref_unbound, boundary_passed:false (requires a bound endpoint_ref)', () => {
  const r = evaluateLiveRpcSpikeBoundary(validSpikeRequest(), {});
  assert.equal(r.boundary_passed, false);
  assert.equal(r.valid, false);
  assert.equal(r.bound, false);
  assert.ok(r.reasons.includes('endpoint_ref_unbound'), JSON.stringify([...r.reasons]));
  // an unbound/failed result must NOT echo provider_ref/environment as real values.
  assert.equal(r.provider_ref, undefined);
  assert.equal(r.environment, undefined);
  assertSpikeFailClosed(r);
});

// ---- (S3)-(S12) the valid result keeps all 10 capability/live flags false ----

test('(S3-S12) the valid spike result keeps configured/has_rpc/ready/can_send/can_broadcast/can_serialize/is_live/network_call_made/live_rpc_call_made/broadcast_permitted ALL false', () => {
  const r = evaluateLiveRpcSpikeBoundary(validSpikeRequest(), spikeBindingMap());
  assert.equal(r.boundary_passed, true, JSON.stringify([...r.reasons]));
  assert.equal(r.configured, false);          // (S3)
  assert.equal(r.has_rpc, false);             // (S4)
  assert.equal(r.ready, false);               // (S5)
  assert.equal(r.can_send, false);            // (S6)
  assert.equal(r.can_broadcast, false);       // (S7)
  assert.equal(r.can_serialize, false);       // (S8)
  assert.equal(r.is_live, false);             // (S9)
  assert.equal(r.network_call_made, false);   // (S10)
  assert.equal(r.live_rpc_call_made, false);  // (S11)
  assert.equal(r.broadcast_permitted, false); // (S12)
  assertSpikeFailClosed(r);
});

// ---- (S13) missing binding (no map / non-object map) refuses ----

test('(S13) missing binding (no map / null / primitive map) refuses (endpoint_ref_unbound, bound:false)', () => {
  for (const badMap of [undefined, null, 42, 'x', true]) {
    const r = evaluateLiveRpcSpikeBoundary(validSpikeRequest(), badMap);
    assert.equal(r.boundary_passed, false, `bad map must refuse: ${JSON.stringify(badMap)}`);
    assert.equal(r.bound, false);
    assert.ok(r.reasons.includes('endpoint_ref_unbound'));
    assertSpikeFailClosed(r);
  }
});

// ---- (S14) missing endpoint_ref refuses ----

test('(S14) missing endpoint_ref in the request refuses (not bound)', () => {
  const noEp = { provider_ref: 'helius', environment: 'devnet', purpose: 'live_rpc_spike_boundary', no_broadcast: true };
  const r = evaluateLiveRpcSpikeBoundary(noEp, spikeBindingMap());
  assert.equal(r.boundary_passed, false);
  assert.equal(r.bound, false);
  // the reused provisioning validator flags a missing endpoint_ref; the boundary stays unbound.
  assert.ok(r.reasons.includes('endpoint_ref_missing') || r.reasons.includes('endpoint_ref_unbound'), JSON.stringify([...r.reasons]));
  assertSpikeFailClosed(r);
});

// ---- (S15) empty binding map refuses ----

test('(S15) empty {} binding map refuses (endpoint_ref_unbound)', () => {
  const r = evaluateLiveRpcSpikeBoundary(validSpikeRequest(), {});
  assert.equal(r.boundary_passed, false);
  assert.equal(r.bound, false);
  assert.ok(r.reasons.includes('endpoint_ref_unbound'));
  // a populated map missing the requested ref is likewise unbound.
  const absent = evaluateLiveRpcSpikeBoundary(validSpikeRequest(SPIKE_REF_1), spikeBindingMap(SPIKE_REF_2));
  assert.equal(absent.boundary_passed, false);
  assert.ok(absent.reasons.includes('endpoint_ref_unbound'));
  assertSpikeFailClosed(r);
  assertSpikeFailClosed(absent);
});

// ---- (S16) provider mismatch (entry.provider_ref='triton') refuses ----

test('(S16) entry provider mismatch (entry.provider_ref=triton) refuses (bound:false)', () => {
  const r = evaluateLiveRpcSpikeBoundary(
    validSpikeRequest(SPIKE_REF_1),
    { [SPIKE_REF_1]: { bound: true, provider_ref: 'triton', environment: 'devnet', endpoint_kind: 'reference_only' } },
  );
  assert.equal(r.boundary_passed, false);
  assert.equal(r.bound, false);
  // surfaced from the binding step under the 'endpoint_binding:' prefix.
  assert.ok(r.reasons.includes('endpoint_binding:endpoint_ref_provider_mismatch') || r.reasons.includes('endpoint_ref_unbound'), JSON.stringify([...r.reasons]));
  assert.equal(JSON.stringify(r).includes('triton'), false, 'mismatched entry provider value never echoed');
  assertSpikeFailClosed(r);
});

// ---- (S17) environment mismatch refuses ----

test('(S17) entry environment mismatch refuses (bound:false)', () => {
  const r = evaluateLiveRpcSpikeBoundary(
    validSpikeRequest(SPIKE_REF_1, 'devnet'),
    { [SPIKE_REF_1]: { bound: true, provider_ref: 'helius', environment: 'testnet', endpoint_kind: 'reference_only' } },
  );
  assert.equal(r.boundary_passed, false);
  assert.equal(r.bound, false);
  assert.ok(r.reasons.includes('endpoint_binding:endpoint_ref_environment_mismatch') || r.reasons.includes('endpoint_ref_unbound'), JSON.stringify([...r.reasons]));
  assertSpikeFailClosed(r);
});

// ---- (S18) URL literal endpoint_ref 'https://x/' -> blocked AND not echoed ----

test('(S18) URL literal endpoint_ref (https://x/) -> blocked AND never echoed', () => {
  const URL_LITERAL = 'https://x/';
  const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: URL_LITERAL, purpose: 'live_rpc_spike_boundary', no_broadcast: true };
  const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap(URL_LITERAL));
  assert.equal(r.boundary_passed, false);
  assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked'), JSON.stringify([...r.reasons]));
  assert.equal(JSON.stringify(r).includes(URL_LITERAL), false, 'URL endpoint_ref never echoed');
  assert.equal(JSON.stringify(r).includes('https://'), false);
  assertSpikeFailClosed(r);
  // the request-shape validator alone also refuses & never echoes.
  const v = validateLiveRpcSpikeBoundaryRequest(req);
  assert.equal(v.valid, false);
  assert.ok(v.reasons.includes('endpoint_or_rpc_indicator_blocked'));
  assert.equal(JSON.stringify(v).includes(URL_LITERAL), false);
  assertSpikeRequestFlagsFalse(v);
});

// ---- (S19) raw endpoint field -> blocked & not echoed ----

test('(S19) a raw endpoint field name in the request -> unknown_field/endpoint blocked & never echoed', () => {
  const MARK = 'RAW-ENDPOINT-VALUE-S19';
  const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, endpoint: MARK };
  const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap());
  assert.equal(r.boundary_passed, false);
  // a surprise 'endpoint' field is both an unknown field AND carries the endpoint indicator.
  assert.ok(r.reasons.includes('unknown_field_rejected') || r.reasons.includes('endpoint_or_rpc_indicator_blocked'), JSON.stringify([...r.reasons]));
  assert.equal(JSON.stringify(r).includes(MARK), false, 'raw endpoint value never echoed');
  assertSpikeFailClosed(r);
});

// ---- (S20) provider_url / rpc_endpoint field -> blocked & not echoed ----

test('(S20) provider_url / rpc_endpoint field in the request -> blocked & never echoed', () => {
  for (const [field, MARK] of [['provider_url', 'PROVIDER-URL-VAL-S20'], ['rpc_endpoint', 'RPC-ENDPOINT-VAL-S20']]) {
    const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, [field]: MARK };
    const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap());
    assert.equal(r.boundary_passed, false, `${field} must refuse`);
    assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked') || r.reasons.includes('unknown_field_rejected'), `${field}: ${JSON.stringify([...r.reasons])}`);
    assert.equal(JSON.stringify(r).includes(MARK), false, `${field} value never echoed`);
    assert.equal(field in r, false);
    assertSpikeFailClosed(r);
  }
});

// ---- (S21) api_key field -> blocked & not echoed ----

test('(S21) an api_key field in the request -> blocked & never echoed', () => {
  const MARK = 'MY-api_key-VALUE-S21';
  const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, api_key: MARK };
  const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap());
  assert.equal(r.boundary_passed, false);
  assert.ok(r.reasons.includes('endpoint_or_rpc_indicator_blocked') || r.reasons.includes('unknown_field_rejected'), JSON.stringify([...r.reasons]));
  assert.equal(JSON.stringify(r).includes(MARK), false, 'api_key value never echoed');
  assert.equal(JSON.stringify(r).includes('api_key'), false);
  assertSpikeFailClosed(r);
});

// ---- (S22) secret / token field -> blocked & not echoed ----

test('(S22) a secret / token field in the request -> blocked & never echoed', () => {
  for (const [field, MARK] of [['secret', 'MY-secret-VALUE-S22'], ['token', 'MY-token-VALUE-S22'], ['credential', 'A-credential-VALUE-S22']]) {
    const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, [field]: MARK };
    const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap());
    assert.equal(r.boundary_passed, false, `${field} must refuse`);
    // a secret-NAMED field is key-material; secret/token/credential are also endpoint-secret indicators / unknown.
    assert.ok(
      r.reasons.includes('key_material_not_accepted')
      || r.reasons.includes('endpoint_secret_indicator_blocked')
      || r.reasons.includes('unknown_field_rejected'),
      `${field}: ${JSON.stringify([...r.reasons])}`,
    );
    assert.equal(JSON.stringify(r).includes(MARK), false, `${field} value never echoed`);
    assert.equal(field in r, false);
    assertSpikeFailClosed(r);
  }
});

// ---- (S23) key-material endpoint_ref (PEM/base58/mnemonic) -> blocked & not echoed ----

test('(S23) key-material-shaped endpoint_ref (PEM / long base58 / mnemonic) -> key_material_not_accepted; never echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nLEAKBYTES-S23\n-----END PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const mnemonic = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, mnemonic]) {
    const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: km, purpose: 'live_rpc_spike_boundary', no_broadcast: true };
    const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap(km));
    assert.equal(r.boundary_passed, false, `key material refused: ${km.slice(0, 16)}`);
    assert.ok(r.reasons.includes('key_material_not_accepted'), JSON.stringify([...r.reasons]));
    assert.equal(JSON.stringify(r).includes(km), false, 'key material never echoed');
    assert.equal(JSON.stringify(r).includes('LEAKBYTES-S23'), false);
    assertSpikeFailClosed(r);
  }
});

// ---- (S24) key-material binding value -> blocked & not echoed ----

test('(S24) key-material-shaped binding entry VALUE -> key_material_not_accepted; never echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nLEAKBYTES-S24\n-----END PRIVATE KEY-----';
  const r = evaluateLiveRpcSpikeBoundary(
    validSpikeRequest(SPIKE_REF_1),
    { [SPIKE_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', extra: pem } },
  );
  assert.equal(r.boundary_passed, false);
  assert.equal(r.bound, false);
  assert.ok(r.reasons.includes('endpoint_binding:key_material_not_accepted') || r.reasons.includes('key_material_not_accepted'), JSON.stringify([...r.reasons]));
  assert.equal(JSON.stringify(r).includes(pem), false, 'key-material binding value never echoed');
  assert.equal(JSON.stringify(r).includes('LEAKBYTES-S24'), false);
  assertSpikeFailClosed(r);
});

// ---- (S25) environment 'mainnet' / 'prod' -> blocked ----

test('(S25) environment mainnet / mainnet-beta / prod -> blocked (not a testnet enum)', () => {
  for (const env of ['mainnet', 'mainnet-beta', 'prod']) {
    const req = { provider_ref: 'helius', environment: env, endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true };
    const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap(SPIKE_REF_1, 'helius', env));
    assert.equal(r.boundary_passed, false, `mainnet/prod env must refuse: ${env}`);
    assert.ok(r.reasons.includes('mainnet_or_nontestnet_environment_blocked'), `${env}: ${JSON.stringify([...r.reasons])}`);
    // a refused result must NOT echo environment.
    assert.equal(r.environment, undefined);
    assertSpikeFailClosed(r);
  }
});

// ---- (S26) missing no_broadcast:true -> no_broadcast_required ----

test('(S26) missing/false no_broadcast -> no_broadcast_required', () => {
  for (const variant of [
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary' },
    { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: false },
  ]) {
    const v = validateLiveRpcSpikeBoundaryRequest(variant);
    assert.equal(v.valid, false);
    assert.ok(v.reasons.includes('no_broadcast_required'), JSON.stringify([...v.reasons]));
    assertSpikeRequestFlagsFalse(v);
    const r = evaluateLiveRpcSpikeBoundary(variant, spikeBindingMap());
    assert.equal(r.boundary_passed, false);
    assert.ok(r.reasons.includes('no_broadcast_required'));
    assertSpikeFailClosed(r);
  }
});

// ---- (S27) broadcast:true -> blocked ----

test('(S27) broadcast:true in the request -> broadcast_or_send_indicator_blocked', () => {
  const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, broadcast: true };
  const v = validateLiveRpcSpikeBoundaryRequest(req);
  assert.equal(v.valid, false);
  assert.ok(v.reasons.includes('broadcast_or_send_indicator_blocked'), JSON.stringify([...v.reasons]));
  assertSpikeRequestFlagsFalse(v);
  const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap());
  assert.equal(r.boundary_passed, false);
  assert.ok(r.reasons.includes('broadcast_or_send_indicator_blocked'));
  assertSpikeFailClosed(r);
});

// ---- (S28) send:true -> blocked ----

test('(S28) send:true in the request -> broadcast_or_send_indicator_blocked', () => {
  const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, send: true };
  const v = validateLiveRpcSpikeBoundaryRequest(req);
  assert.equal(v.valid, false);
  assert.ok(v.reasons.includes('broadcast_or_send_indicator_blocked'), JSON.stringify([...v.reasons]));
  assertSpikeRequestFlagsFalse(v);
  const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap());
  assert.equal(r.boundary_passed, false);
  assert.ok(r.reasons.includes('broadcast_or_send_indicator_blocked'));
  assertSpikeFailClosed(r);
});

// ---- (S29) serialize:true -> blocked ----

test('(S29) serialize:true in the request -> broadcast_or_send_indicator_blocked', () => {
  const req = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, serialize: true };
  const v = validateLiveRpcSpikeBoundaryRequest(req);
  assert.equal(v.valid, false);
  assert.ok(v.reasons.includes('broadcast_or_send_indicator_blocked'), JSON.stringify([...v.reasons]));
  assertSpikeRequestFlagsFalse(v);
  const r = evaluateLiveRpcSpikeBoundary(req, spikeBindingMap());
  assert.equal(r.boundary_passed, false);
  assert.ok(r.reasons.includes('broadcast_or_send_indicator_blocked'));
  assertSpikeFailClosed(r);
});

// ---- (S30) faked ready:true/has_rpc:true/can_send:true in request or entry -> result flags STILL false ----

test('(S30) faked ready/has_rpc/can_send in request OR entry -> ignored/refused; result flags STILL false', () => {
  // (a) smuggled into the REQUEST as unknown flag fields -> refused as unknown fields; result flags stay false.
  const fakedReq = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, ready: true, has_rpc: true, can_send: true };
  const rReq = evaluateLiveRpcSpikeBoundary(fakedReq, spikeBindingMap());
  assert.equal(rReq.ready, false);
  assert.equal(rReq.has_rpc, false);
  assert.equal(rReq.can_send, false);
  assert.equal(rReq.boundary_passed, false, 'smuggled flag fields are refused');
  assertSpikeFailClosed(rReq);
  // (b) smuggled into the binding ENTRY -> ignored / screened; result flags stay FIXED false.
  const rEntry = evaluateLiveRpcSpikeBoundary(
    validSpikeRequest(SPIKE_REF_1),
    { [SPIKE_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', ready: true, has_rpc: true, can_send: true } },
  );
  assert.equal(rEntry.ready, false);
  assert.equal(rEntry.has_rpc, false);
  assert.equal(rEntry.can_send, false);
  assertSpikeFailClosed(rEntry);
});

// ---- (S31) faked is_live:true/network_call_made:true -> ignored/refused, flags false ----

test('(S31) faked is_live/network_call_made in request OR entry -> ignored/refused; flags STILL false', () => {
  const fakedReq = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, is_live: true, network_call_made: true, live_rpc_call_made: true };
  const rReq = evaluateLiveRpcSpikeBoundary(fakedReq, spikeBindingMap());
  assert.equal(rReq.is_live, false);
  assert.equal(rReq.network_call_made, false);
  assert.equal(rReq.live_rpc_call_made, false);
  assert.equal(rReq.boundary_passed, false);
  assertSpikeFailClosed(rReq);
  const rEntry = evaluateLiveRpcSpikeBoundary(
    validSpikeRequest(SPIKE_REF_1),
    { [SPIKE_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', is_live: true, network_call_made: true } },
  );
  assert.equal(rEntry.is_live, false);
  assert.equal(rEntry.network_call_made, false);
  assert.equal(rEntry.live_rpc_call_made, false);
  assertSpikeFailClosed(rEntry);
});

// ---- (S32) hostile throwing request (getter / Proxy) -> frozen input_inspection_error refusal, no throw ----

test('(S32) hostile/throwing request (getter / Proxy) -> frozen input_inspection_error refusal, never throws', () => {
  const SECRET = 'boom-secret-trap-S32';
  const throwingGetter = { get provider_ref() { throw new Error(SECRET); } };
  const throwingPurpose = { provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, get purpose() { throw new Error(SECRET); }, no_broadcast: true };
  const throwAll = new Proxy({}, { get() { throw new Error(SECRET); } });
  for (const hostile of [throwingGetter, throwingPurpose, throwAll]) {
    let v;
    assert.doesNotThrow(() => { v = validateLiveRpcSpikeBoundaryRequest(hostile); }, 'validate must not propagate');
    assert.equal(v.valid, false);
    assert.equal(v.status, 'invalid');
    assert.ok(v.reasons.includes('input_inspection_error') || v.reasons.length > 0, JSON.stringify([...v.reasons]));
    assertSpikeRequestFlagsFalse(v);
    assert.equal(JSON.stringify(v).includes(SECRET), false, 'secret never echoed (validate)');

    let r;
    assert.doesNotThrow(() => { r = evaluateLiveRpcSpikeBoundary(hostile, spikeBindingMap()); }, 'eval must not propagate');
    assert.equal(r.boundary_passed, false);
    assert.equal(r.valid, false);
    assertSpikeFailClosed(r);
    assert.equal(JSON.stringify(r).includes(SECRET), false, 'secret never echoed (eval)');
  }
  // primitive / weird inputs never throw either.
  for (const input of [undefined, null, 42, 'x', true, []]) {
    assert.doesNotThrow(() => validateLiveRpcSpikeBoundaryRequest(input));
    assert.doesNotThrow(() => evaluateLiveRpcSpikeBoundary(input, spikeBindingMap()));
  }
});

// ---- (S33) hostile throwing binding map (getter / Proxy) -> frozen refusal, no throw, no echo ----

test('(S33) hostile/throwing binding map (getter / Proxy) -> frozen refusal, never throws, secret not echoed', () => {
  const SECRET = 'boom-map-trap-S33';
  const req = validSpikeRequest(SPIKE_REF_1);
  const throwAllMap = new Proxy({}, { get() { throw new Error(SECRET); } });
  const throwingSlotMap = { get [SPIKE_REF_1]() { throw new Error(SECRET); } };
  const throwingEntryMap = { [SPIKE_REF_1]: { bound: true, provider_ref: 'helius', environment: 'devnet', get endpoint_kind() { throw new Error(SECRET); } } };
  for (const hostileMap of [throwAllMap, throwingSlotMap, throwingEntryMap]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateLiveRpcSpikeBoundary(req, hostileMap); }, 'eval must not propagate map exception');
    assert.equal(r.boundary_passed, false);
    assert.equal(r.valid, false);
    assertSpikeFailClosed(r);
    assert.equal(JSON.stringify(r).includes(SECRET), false, 'secret/error message never echoed (hostile map)');
  }
});

// ---- (S34) no SDK import (self-scan src specifiers) ----

test('(S34) src declares NO SDK/provider/network import specifier (spike boundary adds none)', () => {
  const reFrom = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const reBare = /\bimport\s*['"]([^'"]+)['"]/g;
  const reCall = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const FORBIDDEN_SPEC = /(@solana|@solana-program|solana|web3\.js|jupiter|@jup-ag|jito|helius|@noble|@coral-xyz|anchor|bs58|tweetnacl|ed25519|node:net|node:http|node:https|node:tls|node:dgram|undici|ws|axios|pg|redis|node:crypto|node:fs|node:process)/i;
  for (const fn of srcMjsFiles()) {
    const text = readFileSync(join(SRC, fn), 'utf8');
    const specs = [];
    for (const re of [reFrom, reBare, reCall]) {
      for (const m of text.matchAll(re)) specs.push(m[1]);
    }
    for (const s of specs) {
      assert.equal(s.startsWith('.'), true, `${fn} must only import LOCAL relative paths: ${s}`);
      assert.equal(FORBIDDEN_SPEC.test(s), false, `${fn} must not import an SDK/provider/network/fs module: ${s}`);
    }
  }
});

// ---- (S35) no dependency (package.json) ----

test('(S35) package.json still declares NO dependencies/devDependencies (spike boundary is dependency-free)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  assert.equal('dependencies' in pkg, false);
  assert.equal('devDependencies' in pkg, false);
  assert.equal('peerDependencies' in pkg, false);
  assert.equal('optionalDependencies' in pkg, false);
});

// ---- (S36) no network/provider call (src import-free) ----

test('(S36) src (incl. spike boundary) is import-free and carries NO network/provider mechanism', () => {
  const NETWORK_MECH = /(\b(fetch|XMLHttpRequest)\s*\(|new\s+WebSocket|WebSocket\s*\(|new\s+Connection\s*\(|XMLHttpRequest|EventSource|node:net|node:http)/;
  for (const fn of srcMjsFiles()) {
    const code = stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/\bimport\b[^;]*\bfrom\b|\brequire\s*\(/.test(code), false, `no imports allowed in ${fn}`);
    assert.equal(NETWORK_MECH.test(code), false, `no network/provider mechanism in ${fn}`);
    assert.equal(FORBIDDEN_CODE.test(code), false, `no forbidden live mechanism in ${fn}`);
  }
});

// ---- (S37) no env/secret read (grep src for process.env / readFileSync / node:fs / node:process -> none) ----

test('(S37) src (incl. spike boundary) reads NO env and NO secret file', () => {
  const ENV_SECRET_READ = /(process\.env|readFileSync|readFile\s*\(|node:fs|node:process|require\s*\(\s*['"]fs['"])/;
  for (const fn of srcMjsFiles()) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    assert.equal(ENV_SECRET_READ.test(raw), false, `${fn} must not read env / secret files`);
  }
});

// ---- (S38) no send/broadcast/serialize methods on createFailClosedRpcProvider (unchanged by spike boundary) ----

test('(S38) createFailClosedRpcProvider still exposes NO send/broadcast/serialize/rpc method (spike adds none)', () => {
  const p = createFailClosedRpcProvider();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'sendRawTransaction', 'submit', 'sign', 'connect', 'rpc', 'request', 'call', 'query', 'spike', 'liveRpc', 'resolve', 'lookup', 'register']) {
    assert.equal(typeof p[m], 'undefined', `provider must NOT expose ${m}`);
  }
  // the spike functions are pure/contract-only — none returns a configured/live/sendable/broadcasting surface.
  assert.equal(describeLiveRpcSpikeBoundaryContract().is_live, false);
  assert.equal(describeLiveRpcSpikeBoundaryContract().can_broadcast, false);
  assert.equal(describeLiveRpcSpikeBoundaryContract().can_serialize, false);
  assert.equal(evaluateLiveRpcSpikeBoundary(validSpikeRequest(), spikeBindingMap()).can_send, false);
});

// ---- (S39) no literal endpoint URL / API key in src ----

test('(S39) src contains NO literal endpoint URL or API-key literal (full-text scan, spike boundary adds none)', () => {
  const URL_LITERAL = /(https?:\/\/[^\s'")]+|wss?:\/\/[^\s'")]+)/;
  for (const fn of srcMjsFiles()) {
    const text = readFileSync(join(SRC, fn), 'utf8');
    assert.equal(URL_LITERAL.test(text), false, `${fn} must not contain a literal endpoint URL`);
    assert.equal(/api_?key\s*[:=]\s*['"][^'"]+['"]/i.test(text), false, `${fn} must not assign an api key literal`);
    assert.equal(/secret\s*[:=]\s*['"][^'"]+['"]/i.test(text), false, `${fn} must not assign a secret literal`);
  }
});

// ---- (S40) can_send:false (and the descriptor) across the spike matrix ----

test('(S40) can_send/is_live/broadcast flags stay false across the whole spike matrix; descriptor fail-closed', () => {
  const matrix = [
    evaluateLiveRpcSpikeBoundary(validSpikeRequest(), spikeBindingMap()),                                    // valid (passes)
    evaluateLiveRpcSpikeBoundary(validSpikeRequest(), {}),                                                    // unbound
    evaluateLiveRpcSpikeBoundary(validSpikeRequest(SPIKE_REF_1, 'devnet'), spikeBindingMap(SPIKE_REF_1, 'helius', 'testnet')), // env mismatch
    evaluateLiveRpcSpikeBoundary({ provider_ref: 'helius', environment: 'mainnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true }, spikeBindingMap(SPIKE_REF_1, 'helius', 'mainnet')), // mainnet
    evaluateLiveRpcSpikeBoundary({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'live_rpc_spike_boundary', no_broadcast: true, broadcast: true }, spikeBindingMap()), // broadcast smuggled
    validateLiveRpcSpikeBoundaryRequest(validSpikeRequest()),                                                 // request-shape only
    validateLiveRpcSpikeBoundaryRequest({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: SPIKE_REF_1, purpose: 'wrong', no_broadcast: true }), // bad purpose
  ];
  for (const r of matrix) {
    assert.equal(r.can_send, false, `can_send must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.can_broadcast, false, `can_broadcast must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.can_serialize, false, `can_serialize must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.is_live, false, `is_live must be false: ${JSON.stringify([...r.reasons])}`);
    assert.equal(r.live_rpc_call_made, false);
    assert.equal(r.network_call_made, false);
    assert.equal(r.broadcast_permitted, false);
    assert.equal(r.configured, false);
    assert.equal(r.has_rpc, false);
    assert.equal(r.ready, false);
    assert.equal(Object.isFrozen(r), true);
  }
  // a bad purpose yields purpose_invalid.
  assert.ok(matrix[6].reasons.includes('purpose_invalid'), JSON.stringify([...matrix[6].reasons]));
  // the descriptor is fail-closed and test-only.
  const d = describeLiveRpcSpikeBoundaryContract();
  assert.equal(d.contract, 'live-rpc-spike-boundary');
  assert.equal(d.version, '0.0.0');
  assert.equal(d.test_only, true);
  assert.equal(d.purpose, 'live_rpc_spike_boundary');
  assert.equal(d.provider_ref, 'helius');
  assert.deepEqual([...d.supported_environments], ['devnet', 'testnet', 'localnet']);
  assert.equal(d.requires_no_broadcast, true);
  assert.equal(d.requires_bound_endpoint_ref, true);
  assert.equal(d.configured, false);
  assert.equal(d.has_rpc, false);
  assert.equal(d.ready, false);
  assert.equal(d.can_send, false);
  assert.equal(d.can_broadcast, false);
  assert.equal(d.can_serialize, false);
  assert.equal(d.is_live, false);
  assert.equal(d.live_rpc_call_made, false);
  assert.equal(d.network_call_made, false);
  assert.equal(d.broadcast_permitted, false);
  assert.equal(d.status, 'unconfigured_no_rpc');
  assert.equal(Object.isFrozen(d), true);
  assert.equal(typeof d.note, 'string');
});

// ============================================================================================================
// PR-E2-F-14 — Live Testnet RPC Spike APPROVAL GATE (contract/test-only, no-live, no-broadcast, fail-closed).
// 45 proofs (S1..S45) against the REAL exports re-exported from '../src/index.mjs'.
// ============================================================================================================

import {
  describeLiveRpcSpikeApprovalGateContract,
  validateLiveRpcSpikeApprovalGate,
  evaluateLiveRpcSpikeApprovalGate,
} from '../src/index.mjs';

const RUNBOOK = join(HERE, '..', '..', '..', 'docs', '08-RUNBOOK-OPS.md');

// Canonical, valid approval RECORD (opaque references / fixed enums / boolean attestations — no secret, no URL).
function validApprovalRecord(overrides = {}) {
  return {
    purpose: 'live_rpc_spike_approval_gate',
    target: 'testnet_rpc_spike',
    provider_ref: 'helius',
    environment: 'devnet',
    endpoint_ref: 'helius-devnet-approval-ref',
    no_broadcast: true,
    no_send: true,
    no_mainnet: true,
    no_real_live: true,
    requires_separate_live_spike_pr: true,
    requires_out_of_repo_endpoint_binding: true,
    requires_supply_chain_review: true,
    requires_post_spike_revoke_or_disable: true,
    ...overrides,
  };
}

// Every approval-gate result is fail-closed: an approved record authorizes NOTHING live. All capability/live
// flags are FIXED LITERALS false, and the result is frozen.
function assertApprovalGateFailClosed(r) {
  assert.equal(Object.isFrozen(r), true);
  assert.equal(r.live_rpc_authorized, false);
  assert.equal(r.configured, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.ready, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.can_serialize, false);
  assert.equal(r.is_live, false);
  assert.equal(r.real_live, false);
  assert.equal(r.network_call_made, false);
  assert.equal(r.live_rpc_call_made, false);
  assert.equal(r.broadcast_permitted, false);
}

// ---- (S1) valid record -> approval_record_valid / approval_gate_passed / valid_no_live status ----

test('(S1) valid approval record -> approval_record_valid=true, approval_gate_passed=true, valid_no_live status', () => {
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord());
  assert.equal(r.approval_record_valid, true, JSON.stringify([...(r.reasons || [])]));
  assert.equal(r.approval_gate_passed, true);
  assert.equal(r.valid, true);
  assert.equal(r.status, 'live_rpc_spike_approval_gate_valid_no_live');
  assert.deepEqual([...r.reasons], []);
});

// ---- (S2..S11) a VALID record keeps every capability/live flag FIXED-LITERAL false ----

test('(S2..S11) valid approval record authorizes NOTHING live — every capability/live flag stays false', () => {
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord());
  assert.equal(r.approval_gate_passed, true, 'precondition: record is valid');
  assert.equal(r.live_rpc_authorized, false);   // S2
  assert.equal(r.configured, false);             // S3
  assert.equal(r.has_rpc, false);                // S4
  assert.equal(r.ready, false);                  // S5
  assert.equal(r.can_send, false);               // S6
  assert.equal(r.can_broadcast, false);          // S7
  assert.equal(r.can_serialize, false);          // S8
  assert.equal(r.is_live, false);                // S9
  assert.equal(r.real_live, false);              // S10a
  assert.equal(r.network_call_made, false);      // S10b
  assert.equal(r.live_rpc_call_made, false);     // S11
  assertApprovalGateFailClosed(r);
});

// ---- (S12) a VALID record keeps requires_separate_live_spike_pr === true (FIXED LITERAL invariant) ----

test('(S12) valid approval record keeps requires_separate_live_spike_pr === true (fixed-literal invariant)', () => {
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord());
  assert.equal(r.requires_separate_live_spike_pr, true);
  // even an attempt to set it false yields a valid record whose result still attests true (fixed literal).
  const r2 = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ requires_separate_live_spike_pr: false }));
  assert.equal(r2.requires_separate_live_spike_pr, true, 'always a fixed literal true, never echoed');
});

// ---- (S13..S16) missing each requires_* attestation -> valid:false ----

test('(S13..S16) missing each requires_* attestation -> approval_record_valid=false', () => {
  const requiredKeys = [
    'requires_separate_live_spike_pr',       // S13
    'requires_out_of_repo_endpoint_binding', // S14
    'requires_supply_chain_review',          // S15
    'requires_post_spike_revoke_or_disable', // S16
  ];
  for (const key of requiredKeys) {
    const rec = validApprovalRecord();
    delete rec[key];
    const r = evaluateLiveRpcSpikeApprovalGate(rec);
    assert.equal(r.valid, false, `missing ${key} must invalidate`);
    assert.equal(r.approval_gate_passed, false);
    assertApprovalGateFailClosed(r);
  }
});

// ---- (S17..S20) missing each no_* attestation -> valid:false ----

test('(S17..S20) missing each no_* attestation -> approval_record_valid=false', () => {
  const noKeys = ['no_broadcast', 'no_send', 'no_mainnet', 'no_real_live']; // S17..S20
  for (const key of noKeys) {
    const rec = validApprovalRecord();
    delete rec[key];
    const r = evaluateLiveRpcSpikeApprovalGate(rec);
    assert.equal(r.valid, false, `missing ${key} must invalidate`);
    assert.equal(r.approval_gate_passed, false);
    assertApprovalGateFailClosed(r);
  }
});

// ---- (S21..S23) a broadcast / send / serialize FIELD -> valid:false (refused) ----

test('(S21..S23) a broadcast:true / send:true / serialize field -> approval_record_valid=false', () => {
  for (const extra of [{ broadcast: true }, { send: true }, { serialize: 'whatever' }]) { // S21,S22,S23
    const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord(extra));
    assert.equal(r.valid, false, `extra ${JSON.stringify(extra)} must be refused`);
    assert.equal(r.approval_gate_passed, false);
    assertApprovalGateFailClosed(r);
  }
});

// ---- (S24) provider_ref not helius -> valid:false ----

test('(S24) provider_ref not helius (e.g. phantom) -> approval_record_valid=false', () => {
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ provider_ref: 'phantom' }));
  assert.equal(r.valid, false);
  assertApprovalGateFailClosed(r);
});

// ---- (S25) unknown provider -> valid:false ----

test('(S25) unknown provider_ref -> approval_record_valid=false', () => {
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ provider_ref: 'totally-unknown-provider' }));
  assert.equal(r.valid, false);
  assert.ok(r.reasons.includes('unknown_provider'), JSON.stringify([...r.reasons]));
  assertApprovalGateFailClosed(r);
});

// ---- (S26) disabled provider refs (triton, yellowstone) -> valid:false ----

test('(S26) disabled provider refs (triton, yellowstone) -> approval_record_valid=false', () => {
  for (const ref of ['triton', 'yellowstone']) {
    const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ provider_ref: ref }));
    assert.equal(r.valid, false, `${ref} must be refused`);
    assertApprovalGateFailClosed(r);
  }
});

// ---- (S27) mainnet & prod environment -> valid:false ----

test('(S27) mainnet & prod environment -> approval_record_valid=false (fail-closed)', () => {
  for (const env of ['mainnet', 'prod']) {
    const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ environment: env }));
    assert.equal(r.valid, false, `${env} must be refused`);
    assertApprovalGateFailClosed(r);
  }
});

// ---- (S28) missing endpoint_ref -> valid:false ----

test('(S28) missing endpoint_ref -> approval_record_valid=false', () => {
  const rec = validApprovalRecord();
  delete rec.endpoint_ref;
  const r = evaluateLiveRpcSpikeApprovalGate(rec);
  assert.equal(r.valid, false);
  assertApprovalGateFailClosed(r);
});

// ---- (S29) URL literal in endpoint_ref -> valid:false AND the URL not echoed ----

test('(S29) URL literal in endpoint_ref -> valid:false AND url not echoed in result', () => {
  const URL = 'https://x.example/rpc';
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ endpoint_ref: URL }));
  assert.equal(r.valid, false);
  assert.equal(JSON.stringify(r).includes('https://x.example'), false, 'url value never echoed');
  assertApprovalGateFailClosed(r);
});

// ---- (S30) raw endpoint -> refused & not echoed ----

test('(S30) raw endpoint in endpoint_ref -> refused & not echoed', () => {
  const RAW = 'https://my-real-rpc.helius.xyz/?api-key=zzz-S30-secret';
  const v = validateLiveRpcSpikeApprovalGate(validApprovalRecord({ endpoint_ref: RAW }));
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ endpoint_ref: RAW }));
  assert.equal(v.valid, false);
  assert.equal(r.valid, false);
  assert.equal(JSON.stringify(v).includes('my-real-rpc') || JSON.stringify(v).includes('zzz-S30-secret'), false, 'raw endpoint never echoed (validate)');
  assert.equal(JSON.stringify(r).includes('my-real-rpc') || JSON.stringify(r).includes('zzz-S30-secret'), false, 'raw endpoint never echoed (eval)');
  assertApprovalGateFailClosed(r);
});

// ---- (S31) provider_url / rpc_endpoint field -> refused & not echoed ----

test('(S31) provider_url / rpc_endpoint field -> refused & not echoed', () => {
  for (const extra of [{ provider_url: 'https://leak-S31.example/x' }, { rpc_endpoint: 'wss://leak-S31.example/x' }]) {
    const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord(extra));
    assert.equal(r.valid, false, `${JSON.stringify(extra)} must be refused`);
    assert.equal(JSON.stringify(r).includes('leak-S31'), false, 'field value never echoed');
    assertApprovalGateFailClosed(r);
  }
});

// ---- (S32) api_key field -> refused & not echoed ----

test('(S32) api_key field -> refused & not echoed', () => {
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ api_key: 'AKIA-S32-leak-value' }));
  assert.equal(r.valid, false);
  assert.equal(JSON.stringify(r).includes('AKIA-S32-leak-value'), false, 'api_key value never echoed');
  assertApprovalGateFailClosed(r);
});

// ---- (S33) secret / token field -> refused & not echoed ----

test('(S33) secret / token field -> refused & not echoed', () => {
  for (const extra of [{ secret: 'sk-S33-leak-secret' }, { token: 'tok-S33-leak-token' }]) {
    const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord(extra));
    assert.equal(r.valid, false, `${JSON.stringify(extra)} must be refused`);
    assert.equal(JSON.stringify(r).includes('S33-leak'), false, 'secret/token value never echoed');
    assertApprovalGateFailClosed(r);
  }
});

// ---- (S34) key-material-shaped endpoint_ref (70-char base58) -> refused & not echoed ----

test('(S34) key-material-shaped endpoint_ref (70-char base58) -> refused & not echoed', () => {
  const B58 = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789abcdefghijkmn'; // 70 base58 chars
  assert.equal(B58.length, 70);
  const v = validateLiveRpcSpikeApprovalGate(validApprovalRecord({ endpoint_ref: B58 }));
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ endpoint_ref: B58 }));
  assert.equal(v.valid, false);
  assert.equal(r.valid, false);
  assert.equal(JSON.stringify(v).includes(B58), false, 'key-material endpoint_ref never echoed (validate)');
  assert.equal(JSON.stringify(r).includes(B58), false, 'key-material endpoint_ref never echoed (eval)');
  assertApprovalGateFailClosed(r);
});

// ---- (S35) faked ready/has_rpc/can_send extra fields -> ignored/refused; result flags stay false ----

test('(S35) faked ready:true / has_rpc:true / can_send:true extra fields -> refused; flags stay false', () => {
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ ready: true, has_rpc: true, can_send: true }));
  assert.equal(r.valid, false, 'smuggled capability fields must be refused (unknown/indicator)');
  assert.equal(r.ready, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.can_send, false);
  assertApprovalGateFailClosed(r);
});

// ---- (S36) faked is_live/real_live/network_call_made -> ignored/refused; flags stay false ----

test('(S36) faked is_live:true / real_live:true / network_call_made:true -> refused; flags stay false', () => {
  const r = evaluateLiveRpcSpikeApprovalGate(validApprovalRecord({ is_live: true, real_live: true, network_call_made: true }));
  assert.equal(r.valid, false, 'smuggled live fields must be refused (unknown field)');
  assert.equal(r.is_live, false);
  assert.equal(r.real_live, false);
  assert.equal(r.network_call_made, false);
  assertApprovalGateFailClosed(r);
});

// ---- (S37) hostile input (throwing Proxy) -> frozen refusal {valid:false}, no throw, frozen ----

test('(S37) hostile input (throwing Proxy) -> frozen {valid:false} refusal, never throws', () => {
  const SECRET = 'boom-approval-trap-S37';
  const hostile = new Proxy({}, { get() { throw new Error(SECRET); } });
  let v;
  assert.doesNotThrow(() => { v = validateLiveRpcSpikeApprovalGate(hostile); }, 'validate must not propagate');
  assert.equal(v.valid, false);
  assert.equal(Object.isFrozen(v), true);
  assert.ok(v.reasons.includes('input_inspection_error'), JSON.stringify([...v.reasons]));
  assert.equal(JSON.stringify(v).includes(SECRET), false, 'secret never echoed (validate)');

  let r;
  assert.doesNotThrow(() => { r = evaluateLiveRpcSpikeApprovalGate(hostile); }, 'eval must not propagate');
  assert.equal(r.valid, false);
  assert.equal(r.approval_gate_passed, false);
  assert.equal(Object.isFrozen(r), true);
  assert.ok(r.reasons.includes('input_inspection_error'), JSON.stringify([...r.reasons]));
  assert.equal(JSON.stringify(r).includes(SECRET), false, 'secret never echoed (eval)');
  assertApprovalGateFailClosed(r);
  // primitive / weird inputs never throw either.
  for (const input of [undefined, null, 42, 'x', true, []]) {
    assert.doesNotThrow(() => validateLiveRpcSpikeApprovalGate(input));
    assert.doesNotThrow(() => evaluateLiveRpcSpikeApprovalGate(input));
  }
});

// ---- (S38) module is import-free (self-scan rpc-provider-contract.mjs) ----

test('(S38) src/rpc-provider-contract.mjs (incl. approval gate) is import-free', () => {
  const code = stripCommentsAndStrings(readFileSync(join(SRC, 'rpc-provider-contract.mjs'), 'utf8'));
  assert.equal(/^import\s/m.test(code), false, 'no import statement allowed');
  assert.equal(/\bimport\b[^;]*\bfrom\b|\brequire\s*\(/.test(code), false, 'no import-from / require() allowed');
});

// ---- (S39) no dependency added (package.json) ----

test('(S39) package.json declares NO dependencies (approval gate added none)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  assert.equal('dependencies' in pkg, false);
  assert.equal('devDependencies' in pkg, false);
  assert.equal('peerDependencies' in pkg, false);
  assert.equal('optionalDependencies' in pkg, false);
});

// ---- (S40) no network/provider call mechanism in the new approval-gate code region ----

test('(S40) approval-gate code region carries NO fetch / new WebSocket / new Connection mechanism', () => {
  const full = readFileSync(join(SRC, 'rpc-provider-contract.mjs'), 'utf8');
  const idx = full.indexOf('Live RPC Spike APPROVAL GATE (E2-F-14)');
  assert.ok(idx !== -1, 'approval-gate region marker present');
  const region = stripCommentsAndStrings(full.slice(idx));
  assert.equal(/\bfetch\s*\(/.test(region), false, 'no fetch(');
  assert.equal(/new\s+WebSocket|WebSocket\s*\(/.test(region), false, 'no WebSocket');
  assert.equal(/new\s+Connection\s*\(/.test(region), false, 'no new Connection(');
  assert.equal(/XMLHttpRequest|EventSource|node:net|node:http/.test(region), false, 'no network module');
});

// ---- (S41) no env / secret-file read in src ----

test('(S41) src (incl. approval gate) reads NO env and NO secret file', () => {
  const ENV_SECRET_READ = /(process\.env|readFileSync|readFile\s*\(|node:fs|node:process|require\s*\(\s*['"]fs['"])/;
  for (const fn of srcMjsFiles()) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    assert.equal(ENV_SECRET_READ.test(raw), false, `${fn} must not read env / secret files`);
  }
});

// ---- (S42) no send/broadcast/serialize METHODS on createFailClosedRpcProvider (approval gate adds none) ----

test('(S42) createFailClosedRpcProvider exposes NO send/broadcast/serialize/rpc method (approval gate adds none)', () => {
  const p = createFailClosedRpcProvider();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'sendRawTransaction', 'submit', 'sign', 'connect', 'rpc', 'request', 'call', 'query', 'approve', 'authorize', 'spike', 'liveRpc', 'resolve', 'lookup', 'register']) {
    assert.equal(typeof p[m], 'undefined', `provider must NOT expose ${m}`);
  }
  // the approval-gate functions are pure/contract-only — none returns a configured/live/sendable surface.
  assert.equal(describeLiveRpcSpikeApprovalGateContract().is_live, false);
  assert.equal(describeLiveRpcSpikeApprovalGateContract().can_broadcast, false);
  assert.equal(describeLiveRpcSpikeApprovalGateContract().can_serialize, false);
  assert.equal(evaluateLiveRpcSpikeApprovalGate(validApprovalRecord()).can_send, false);
});

// ---- (S43) no literal endpoint URL / API key in the new approval-gate region ----

test('(S43) approval-gate region contains NO literal endpoint URL or API-key/secret literal', () => {
  const full = readFileSync(join(SRC, 'rpc-provider-contract.mjs'), 'utf8');
  const idx = full.indexOf('Live RPC Spike APPROVAL GATE (E2-F-14)');
  assert.ok(idx !== -1, 'approval-gate region marker present');
  const region = full.slice(idx);
  assert.equal(/(https?:\/\/[^\s'")]+|wss?:\/\/[^\s'")]+)/.test(region), false, 'no literal endpoint URL');
  assert.equal(/api_?key\s*[:=]\s*['"][^'"]+['"]/i.test(region), false, 'no api key literal assignment');
  assert.equal(/secret\s*[:=]\s*['"][^'"]+['"]/i.test(region), false, 'no secret literal assignment');
});

// ---- (S44) runbook section exists with the mandated no-live / no-broadcast / separate-PR / out-of-repo phrases ----

test('(S44) docs/08-RUNBOOK-OPS.md has §15 with no-live / no-broadcast / separate-PR / out-of-repo-secret phrases', () => {
  const md = readFileSync(RUNBOOK, 'utf8');
  assert.ok(md.includes('## 15.'), 'runbook §15 heading present');
  // no-live: an approved record authorizes nothing live.
  assert.ok(md.includes('live_rpc_authorized=false'), 'no-live phrase present');
  // no-broadcast / no-send.
  assert.ok(md.includes('broadcast/send'), 'no-broadcast/send phrase present');
  // separate PR required for any live spike.
  assert.ok(md.includes('PR منفصل'), 'separate-PR phrase present');
  // out-of-repo endpoint / secret binding.
  assert.ok(md.includes('out-of-repo'), 'out-of-repo-secret phrase present');
});

// ---- (S45) can_send:true does not exist anywhere in packages/*/src (repo-wide invariant unchanged) ----

test('(S45) NO `can_send: true` anywhere in packages/*/src (approval gate did not introduce one)', () => {
  const PKGS = join(HERE, '..', '..');
  const CAN_SEND_TRUE = /can_send\s*:\s*true/;
  const offenders = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'test') continue;
        walk(full);
      } else if (entry.name.endsWith('.mjs')) {
        if (CAN_SEND_TRUE.test(readFileSync(full, 'utf8'))) offenders.push(full);
      }
    }
  }
  // walk every package's src directory.
  for (const pkg of readdirSync(PKGS, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    let srcDir;
    try { srcDir = join(PKGS, pkg.name, 'src'); readdirSync(srcDir); } catch { continue; }
    walk(srcDir);
  }
  assert.deepEqual(offenders, [], `can_send: true must not appear in any package src: ${offenders.join(', ')}`);
});
