// MILESTONE 2 (E2-F-8) integration tests — proves the send-gate CONSUMES the sibling rpc-provider CONTRACT
// result in a FAIL-CLOSED way: it derives provider readiness/config from the rpc-provider contract (never from a
// caller-supplied flag) and STILL ALWAYS refuses. This is NOT live integration: there is no live RPC, no SDK, no
// dependency, no send/broadcast, no serialization. Every result is the canonical refused shape (can_send:false).
//
// IMPORTS: ONLY node builtins (node:test/assert/fs/url/path — none in the forbidden node:net|http|https family)
// and local repo modules (the REAL send-gate + rpc-provider contracts via relative paths). Test (12) asserts via
// an import-specifier self-scan that NO @solana/jupiter/helius/jito/http/db import is present in this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  describeSendGateContract,
  createFailClosedSendGate,
  evaluateSendPreflight,
} from '../src/index.mjs';
// The REAL rpc-provider contract — consumed read-only to prove the integration is genuine (not mocked).
import {
  evaluateRpcReadiness,
  validateRpcProviderConfig,
} from '../../rpc-provider-contract/src/index.mjs';
// Local repo tool — used ONLY to strip comments/strings so the self-scan does not match its own literals.
import { stripCommentsAndStrings } from '../../../tools/check-mechanism-guards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// A clean, valid-LOOKING devnet request with all gate preconditions satisfied and no threat indicators on the
// REQUEST itself (the rpc_provider sub-object is supplied per-test). It must STILL be refused foundationally.
const CLEAN_DEVNET = Object.freeze({
  sign_only_success: true,
  readiness_ready: true,
  preflight_ok: true,
  custody_status: 'ACTIVE',
  network: 'devnet',
  intent_id: 'intent-1',
  idempotency_key: 'idem-1',
});

// The canonical fail-closed output shape: every send/broadcast/serialize capability false; nulls; frozen.
function assertRefusedShape(r) {
  assert.equal(r.ok, false);
  assert.equal(r.sent, false);
  assert.equal(r.broadcast, false);
  assert.equal(r.signature, null);
  assert.equal(r.transaction, null);
  assert.equal(r.serialized, null);
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.can_serialize, false);
  assert.equal(r.has_rpc, false);
  assert.equal(r.is_live, false);
  assert.equal(r.status, 'unconfigured_no_rpc');
  assert.equal(r.reason, 'send_gate_unconfigured_no_rpc');
  assert.equal(Object.isFrozen(r), true);
}

// ---- (1) the gate consumes an rpc-provider readiness/config and STILL refuses --------------------------------

test('(1) consumes a valid-looking rpc-provider readiness/config and STILL refuses (foundational reason)', () => {
  // First confirm the consumed contract is genuinely fail-closed: evaluateRpcReadiness is ALWAYS not-ready.
  const providerReadiness = evaluateRpcReadiness({ endpoint_present: true, live_rpc_enabled: true, environment: 'devnet' });
  assert.equal(providerReadiness.ready, false, 'rpc-provider contract must report not-ready');
  // The send-gate, consuming such a provider, still refuses with the foundational reason.
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: { provider_ref: 'opaque-ref-1', environment: 'devnet' } });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('send_gate_unconfigured_no_rpc'), 'foundational refusal always present');
});

// ---- (2) missing rpc_provider -> rpc_provider_missing ---------------------------------------------------------

test('(2) missing rpc_provider yields blocker rpc_provider_missing', () => {
  for (const input of [CLEAN_DEVNET, { ...CLEAN_DEVNET, rpc_provider: undefined }, { ...CLEAN_DEVNET, rpc_provider: null }, {}, undefined, null]) {
    const r = evaluateSendPreflight(input);
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('rpc_provider_missing'), `expected rpc_provider_missing: ${JSON.stringify(input)}`);
    assert.equal(r.blockers.includes('rpc_provider_not_ready'), false, 'missing provider must NOT also report not_ready');
  }
});

// ---- (3) a provider yielding ready:false -> rpc_provider_not_ready --------------------------------------------

test('(3) a supplied provider (contract reports ready:false) yields blocker rpc_provider_not_ready', () => {
  // The consumed contract is always not-ready, so ANY supplied provider object produces rpc_provider_not_ready.
  for (const provider of [{}, { provider_ref: 'opaque-ref-2', environment: 'testnet' }, { endpoint_present: true, live_rpc_enabled: true }]) {
    assert.equal(evaluateRpcReadiness(provider).ready, false, 'contract precondition: always not-ready');
    const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: provider });
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('rpc_provider_not_ready'), `expected rpc_provider_not_ready: ${JSON.stringify(provider)}`);
    assert.equal(r.blockers.includes('rpc_provider_missing'), false, 'a supplied provider is not "missing"');
  }
});

// ---- (4) valid-looking testnet config stays references-only and does NOT open send ---------------------------

test('(4) valid-looking testnet provider config stays references-only (not_ready) and does NOT open send', () => {
  const provider = { provider_ref: 'opaque-ref-1', environment: 'devnet' };
  // The rpc-provider contract classifies this shape as references-only — valid SHAPE but NOT configured / no rpc.
  const cfg = validateRpcProviderConfig(provider);
  assert.equal(cfg.valid, true, 'references-only config is shape-valid');
  assert.equal(cfg.status, 'reference_valid_no_rpc');
  assert.equal(cfg.configured, false);
  assert.equal(cfg.has_rpc, false);
  // Consumed by the send-gate: still refused, still not_ready, send is NOT opened.
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: provider });
  assertRefusedShape(r);
  assert.equal(r.can_send, false, 'references-only config must NOT open send');
  assert.ok(r.blockers.includes('rpc_provider_not_ready'));
  assert.equal(r.blockers.includes('rpc_provider_key_material'), false, 'a clean reference is not key material');
});

// ---- (5) provider failure refuses -----------------------------------------------------------------------------

test('(5) provider failure ({provider_status:"failed"}) refuses (still not_ready)', () => {
  const provider = { provider_ref: 'opaque-ref-3', environment: 'testnet', provider_status: 'failed' };
  assert.equal(evaluateRpcReadiness(provider).ready, false);
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: provider });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('rpc_provider_not_ready'), 'failed provider is consumed as not-ready');
});

// ---- (6) mainnet provider -> mainnet_indicator_blocked --------------------------------------------------------

test('(6) mainnet provider ({environment:"mainnet"}) yields mainnet_indicator_blocked', () => {
  for (const provider of [{ environment: 'mainnet' }, { provider_ref: 'r', environment: 'mainnet-beta' }, { environment: 'prod' }]) {
    const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: provider });
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('mainnet_indicator_blocked'), `expected mainnet block: ${JSON.stringify(provider)}`);
    // and it remains not-ready / refused regardless.
    assert.ok(r.blockers.includes('rpc_provider_not_ready'));
  }
});

// ---- (7) endpoint/rpc/provider_url in rpc_provider -> endpoint_or_rpc_blocked and value NOT echoed ------------

test('(7) endpoint/rpc/provider_url fields are blocked and their value is NOT echoed', () => {
  const MARKER = 'ENDPOINT_MARKER_DO_NOT_ECHO_98765';
  for (const provider of [
    { endpoint: `https://${MARKER}.example/` },
    { rpc: `wss://${MARKER}/` },
    { provider_url: `http://${MARKER}/` },
  ]) {
    const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: provider });
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('endpoint_or_rpc_blocked'), `expected endpoint block: ${JSON.stringify(provider)}`);
    // the endpoint value is NEVER echoed into the frozen refusal.
    assert.equal(JSON.stringify(r).includes(MARKER), false, 'endpoint value must not be echoed');
  }
});

// ---- (8) sign-only success + rpc_provider: send-gate STILL refuses (can_send:false) --------------------------

test('(8) sign_only_success:true + rpc_provider: gate STILL refuses (can_send:false)', () => {
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    sign_only_success: true,
    rpc_provider: { provider_ref: 'opaque-ref-1', environment: 'devnet' },
  });
  assertRefusedShape(r);
  assert.equal(r.can_send, false, 'sign-only success does NOT open send');
  assert.equal(r.blockers.includes('sign_only_not_completed'), false, 'sign-only IS marked complete here');
  assert.ok(r.blockers.includes('send_gate_unconfigured_no_rpc'), 'foundational refusal still present');
  assert.ok(r.blockers.includes('rpc_provider_not_ready'));
});

// ---- (9) the gate exposes NO send/broadcast/serialize/sendTransaction/connect method --------------------------

test('(9) the gate exposes NO send/broadcast/serialize/sendTransaction/connect method', () => {
  const g = createFailClosedSendGate();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'sendRawTransaction', 'submit', 'sign', 'connect', 'rpc', 'broadcastTransaction']) {
    assert.equal(typeof g[m], 'undefined', `gate must not expose ${m}`);
  }
  // the descriptor likewise advertises no live capability and records the consumption.
  const c = describeSendGateContract();
  assert.equal(c.can_send, false);
  assert.equal(c.can_broadcast, false);
  assert.equal(c.can_serialize, false);
  assert.equal(c.has_rpc, false);
  assert.equal(c.is_live, false);
  assert.equal(c.consumes_rpc_provider, true);
});

// ---- (10) hostile/throwing rpc_provider returns a frozen refusal (input_inspection_error), never throws ------

test('(10) hostile/throwing rpc_provider (throwing getter / Proxy trap) returns a frozen refusal, never throws', () => {
  const throwingGetter = { ...CLEAN_DEVNET, get rpc_provider() { throw new Error('boom-provider'); } };
  const throwingProxyProvider = { ...CLEAN_DEVNET, rpc_provider: new Proxy({}, { ownKeys() { throw new Error('ownKeys boom'); }, get() { throw new Error('get boom'); } }) };
  for (const hostile of [throwingGetter, throwingProxyProvider]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendPreflight(hostile); }, 'must not propagate the exception');
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('input_inspection_error'), 'inspection error recorded as a blocker');
    assert.ok(r.blockers.includes('send_gate_unconfigured_no_rpc'), 'foundational refusal still present');
  }
  // the caught error message is never echoed into the result.
  assert.equal(JSON.stringify(evaluateSendPreflight(throwingGetter)).includes('boom'), false);
});

// ---- (11) key-material-shaped provider refs -> rpc_provider_key_material; secret NOT echoed -------------------

test('(11) key-material-shaped provider refs yield rpc_provider_key_material and the secret is NOT echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const words = Array(12).fill('abandon').join(' ');
  for (const secret of [pem, base58, words]) {
    const provider = { provider_ref: secret };
    // The consumed contract classifies a key-material-shaped reference as invalid_key_material.
    assert.equal(validateRpcProviderConfig(provider).status, 'invalid_key_material', `contract must flag key material: ${secret.slice(0, 16)}`);
    const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: provider });
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('rpc_provider_key_material'), `expected rpc_provider_key_material: ${secret.slice(0, 16)}`);
    // the secret value is NEVER echoed into the frozen refusal.
    assert.equal(JSON.stringify(r).includes(secret), false, 'secret must not be echoed');
  }
  // a secret-NAMED field inside rpc_provider is likewise classified as key material by the contract.
  const namedSecretProvider = { secret: 'super-secret-value' };
  assert.equal(validateRpcProviderConfig(namedSecretProvider).status, 'invalid_key_material');
  const r2 = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: namedSecretProvider });
  assertRefusedShape(r2);
  assert.ok(r2.blockers.includes('rpc_provider_key_material'));
  assert.equal(JSON.stringify(r2).includes('super-secret-value'), false, 'named secret value must not be echoed');
});

// ---- (12) no network/provider call: this test file imports only node builtins + local repo modules -----------

test('(12) test file imports only node builtins + local repo modules (no @solana/jupiter/helius/jito/http/db)', () => {
  const selfPath = fileURLToPath(import.meta.url);
  const src = readFileSync(selfPath, 'utf8');
  // Extract every import specifier (comments/strings are not stripped here, but specifiers are unambiguous).
  const specs = [];
  for (const m of src.matchAll(/\bimport\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
  assert.ok(specs.length >= 4, 'expected several imports');
  const FORBIDDEN = [
    /^@solana\//, /(^|\/)jupiter/i, /(^|\/)helius/i, /(^|\/)jito/i, /^@jup-ag\//,
    /^@noble\//, /^tweetnacl$/, /^bs58$/, /^ed25519/,
    /^(axios|node-fetch|undici|got|superagent)$/,
    /^(pg|postgres|@clickhouse\/|clickhouse|ioredis|redis)$/,
    /^node:(net|http|https|dgram|tls)$/,
  ];
  for (const spec of specs) {
    const isNodeBuiltin = spec.startsWith('node:');
    const isRelative = spec.startsWith('./') || spec.startsWith('../');
    assert.ok(isNodeBuiltin || isRelative, `only node builtins / relative imports allowed: ${spec}`);
    for (const re of FORBIDDEN) assert.equal(re.test(spec), false, `forbidden import family in test: ${spec}`);
  }
  // sanity: the local contracts are imported by relative path (proves real consumption, not a mock).
  assert.ok(specs.includes('../src/index.mjs'), 'imports the send-gate contract');
  assert.ok(specs.includes('../../rpc-provider-contract/src/index.mjs'), 'imports the rpc-provider contract');
  // no require() in this test file either — scan the comment/string-stripped source so this assertion (and the
  // regex used to make it) does NOT match its own literal text.
  const stripped = stripCommentsAndStrings(src);
  assert.equal(/\brequire\s*\(/.test(stripped), false, 'no CommonJS interop in the integration test file');
  void HERE; // (HERE retained for symmetry with sibling tests; ensure no unused-var lint trip)
});

// ---- (13) can_send:false on EVERY result ----------------------------------------------------------------------

test('(13) can_send:false on every result across a representative matrix of provider inputs', () => {
  const providers = [
    undefined,
    null,
    {},
    { provider_ref: 'opaque-ref-1', environment: 'devnet' },
    { provider_ref: 'opaque-ref-2', environment: 'testnet', provider_status: 'failed' },
    { environment: 'mainnet' },
    { endpoint: 'https://node.example/' },
    { secret: 'x' },
    { provider_ref: '-----BEGIN PRIVATE KEY-----' },
  ];
  for (const provider of providers) {
    const input = provider === undefined ? { ...CLEAN_DEVNET } : { ...CLEAN_DEVNET, rpc_provider: provider };
    const r = evaluateSendPreflight(input);
    assert.equal(r.can_send, false, `can_send must be false for provider ${JSON.stringify(provider)}`);
    assert.equal(r.can_broadcast, false);
    assert.equal(r.can_serialize, false);
    assert.equal(r.is_live, false);
    assert.equal(r.ok, false);
  }
});
