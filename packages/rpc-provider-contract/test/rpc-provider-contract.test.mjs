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
