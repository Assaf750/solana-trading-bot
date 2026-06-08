// MILESTONE 3 (E2-F-12) integration tests — proves the send-gate CONSUMES the sibling rpc-provider F11
// endpoint-reference BINDING HARNESS (bindEndpointReferenceForTest / validateEndpointReferenceBinding) in a
// FAIL-CLOSED way. Even a VALID reference-bound Helius binding must NOT open send. This is NOT live integration:
// there is no live RPC, no SDK, no dependency, no env/secret read, no endpoint URL/secret, no send/broadcast, no
// serialization. Every result is the canonical refused shape (can_send:false / send_gate_unconfigured_no_rpc).
//
// The 30 proofs run against the REAL imported send-gate + rpc-provider contracts (relative paths, not mocks).
//
// IMPORTS: ONLY node builtins (node:test/assert/fs/url/path — none in the forbidden node:net|http|https family)
// and local repo modules (the REAL send-gate contract + the mechanism-guard tool). Proof (25) asserts via an
// import-specifier self-scan that NO @solana/jupiter/helius/jito/http/db import is present in the send-gate src.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  describeSendGateContract,
  createFailClosedSendGate,
  evaluateSendPreflight,
} from '../src/index.mjs';
// Local repo tool — used to strip comments/strings for self-scans (so a scan does not match its own literals)
// and to assert the package src is NOT allowlisted (fully scanned).
import { isAllowlisted, stripComments, stripCommentsAndStrings } from '../../../tools/check-mechanism-guards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');

// Opaque endpoint reference: avoids EVERY refused substring (endpoint/rpc/url/http/ws/provider_url/api_key/
// secret/token/credential/mainnet/prod). 'helius' is the provider VALUE (an enabled reference-only ref), not a
// forbidden import — and it carries none of the blocked endpoint/secret/mainnet tokens.
const EP = 'helius-devnet-ref';

// A clean, valid-LOOKING devnet request with all gate preconditions satisfied and no threat indicators on the
// REQUEST scalars (rpc_provider / endpoint_binding_map supplied per-test). It must STILL be refused foundationally.
const CLEAN_DEVNET = Object.freeze({
  sign_only_success: true,
  readiness_ready: true,
  preflight_ok: true,
  custody_status: 'ACTIVE',
  network: 'devnet',
  intent_id: 'intent-1',
  idempotency_key: 'idem-1',
});

// A valid reference-only Helius binding INPUT + its TEST-ONLY in-memory binding map. Reference-only, no live.
const VALID_PROVIDER = Object.freeze({ provider_ref: 'helius', environment: 'devnet', endpoint_ref: EP });
const VALID_BINDING_MAP = Object.freeze({
  [EP]: Object.freeze({ bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' }),
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

// ---- (1) the send-gate consumes an endpoint binding and STILL refuses (foundational reason) ------------------

test('(1) consumes an endpoint binding (rpc_provider + endpoint_binding_map) and STILL refuses', () => {
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: VALID_PROVIDER, endpoint_binding_map: VALID_BINDING_MAP });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('send_gate_unconfigured_no_rpc'), 'foundational refusal always present');
});

// ---- (2-6) a VALID Helius reference binding keeps every live capability false --------------------------------

test('(2) a VALID Helius reference binding keeps can_send:false', () => {
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: VALID_PROVIDER, endpoint_binding_map: VALID_BINDING_MAP });
  assert.equal(r.can_send, false, 'a valid reference-bound binding must NOT open send');
});

test('(3) a VALID Helius reference binding keeps has_rpc:false', () => {
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: VALID_PROVIDER, endpoint_binding_map: VALID_BINDING_MAP });
  assert.equal(r.has_rpc, false);
});

test('(4) a VALID Helius reference binding keeps is_live:false (network_call modeled false)', () => {
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: VALID_PROVIDER, endpoint_binding_map: VALID_BINDING_MAP });
  assert.equal(r.is_live, false);
  // and a successful bind is recorded ONLY as the fixed no-live blocker (never opens send).
  assert.ok(r.blockers.includes('endpoint_binding_no_live'), 'a valid bind records endpoint_binding_no_live');
  assert.equal(r.blockers.includes('endpoint_binding_not_bound'), false, 'a valid bind is not "not_bound"');
});

test('(5) a VALID Helius reference binding keeps sent:false', () => {
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: VALID_PROVIDER, endpoint_binding_map: VALID_BINDING_MAP });
  assert.equal(r.sent, false);
});

test('(6) a VALID Helius reference binding keeps broadcast:false', () => {
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: VALID_PROVIDER, endpoint_binding_map: VALID_BINDING_MAP });
  assert.equal(r.broadcast, false);
});

// ---- (7) missing binding map -> still refused foundationally; empty map -> endpoint_binding_not_bound --------

test('(7) missing endpoint_binding_map -> still refused (foundational, no endpoint_binding blockers); EMPTY map -> endpoint_binding_not_bound', () => {
  // rpc_provider present but NO endpoint_binding_map: the milestone-3 block is skipped entirely.
  const noMap = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: VALID_PROVIDER });
  assertRefusedShape(noMap);
  assert.ok(noMap.blockers.includes('send_gate_unconfigured_no_rpc'), 'still refused foundationally');
  assert.equal(noMap.blockers.some((b) => b.startsWith('endpoint_binding')), false, 'no endpoint_binding blocker without a map');
  // an EMPTY binding map IS a supplied map -> the endpoint_ref resolves to nothing -> not bound.
  const emptyMap = evaluateSendPreflight({ ...CLEAN_DEVNET, rpc_provider: VALID_PROVIDER, endpoint_binding_map: {} });
  assertRefusedShape(emptyMap);
  assert.ok(emptyMap.blockers.includes('endpoint_binding_not_bound'), 'empty map yields endpoint_binding_not_bound');
  assert.ok(emptyMap.blockers.includes('endpoint_binding:endpoint_ref_unbound'), 'harness unbound reason surfaced');
});

// ---- (8) binding map missing the endpoint_ref entry -> endpoint_binding_not_bound ----------------------------

test('(8) binding map missing the endpoint_ref entry -> endpoint_binding_not_bound', () => {
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: { 'helius-other-ref': { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' } },
  });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('endpoint_binding_not_bound'));
  assert.ok(r.blockers.includes('endpoint_binding:endpoint_ref_unbound'));
});

// ---- (9) provider mismatch in the binding entry -> endpoint_binding:* mismatch reason ------------------------

test('(9) provider mismatch in binding entry -> endpoint_binding:endpoint_ref_provider_mismatch', () => {
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius-alt', environment: 'devnet', endpoint_kind: 'reference_only' } },
  });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('endpoint_binding:endpoint_ref_provider_mismatch'), 'provider mismatch surfaced');
  assert.ok(r.blockers.includes('endpoint_binding_not_bound'), 'a mismatched entry is not bound');
});

// ---- (10) environment mismatch in the binding entry -> endpoint_binding:* env mismatch -----------------------

test('(10) environment mismatch in binding entry -> endpoint_binding:endpoint_ref_environment_mismatch', () => {
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'localnet', endpoint_kind: 'reference_only' } },
  });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('endpoint_binding:endpoint_ref_environment_mismatch'), 'env mismatch surfaced');
  assert.ok(r.blockers.includes('endpoint_binding_not_bound'));
});

// ---- (11) a URL in the binding entry is blocked AND never echoed ---------------------------------------------

test('(11) a URL in the binding entry is blocked AND its value is NOT echoed', () => {
  const MARKER = 'AAMARKERURLZZ12345';
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', extra: `https://${MARKER}/` } },
  });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('endpoint_binding:endpoint_or_rpc_indicator_blocked'), 'URL in entry is blocked');
  assert.ok(r.blockers.includes('endpoint_binding_not_bound'), 'a blocked entry is not bound');
  assert.equal(JSON.stringify(r).includes(MARKER), false, 'URL value must NOT be echoed');
});

// ---- (12) an api_key in the binding entry is blocked & never echoed ------------------------------------------

test('(12) an api_key indicator in the binding entry is blocked & not echoed', () => {
  const MARKER = 'BBMARKERKEYZZ67890';
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', extra: `api_key-${MARKER}` } },
  });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('endpoint_binding:endpoint_secret_indicator_blocked'), 'api_key in entry is blocked');
  assert.ok(r.blockers.includes('endpoint_binding_not_bound'));
  assert.equal(JSON.stringify(r).includes(MARKER), false, 'api_key value must NOT be echoed');
});

// ---- (13) a secret/token in the binding entry is blocked & never echoed --------------------------------------

test('(13) a secret/token indicator in the binding entry is blocked & not echoed', () => {
  const MARKER = 'CCMARKERSECZZ24680';
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', extra: `secret-token-${MARKER}` } },
  });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('endpoint_binding:endpoint_secret_indicator_blocked'), 'secret/token in entry is blocked');
  assert.ok(r.blockers.includes('endpoint_binding_not_bound'));
  assert.equal(JSON.stringify(r).includes(MARKER), false, 'secret value must NOT be echoed');
});

// ---- (14) a key-material endpoint_ref is blocked & never echoed ----------------------------------------------

test('(14) a key-material endpoint_ref is blocked & not echoed', () => {
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: { provider_ref: 'helius', environment: 'devnet', endpoint_ref: base58 },
    endpoint_binding_map: { [base58]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' } },
  });
  assertRefusedShape(r);
  // a key-material-shaped reference is refused both by the rpc-provider consumption and the binding harness.
  assert.ok(r.blockers.includes('rpc_provider_key_material'), 'rpc-provider consumption flags key material');
  assert.ok(r.blockers.includes('endpoint_binding:key_material_not_accepted'), 'binding harness flags key material');
  assert.equal(r.blockers.includes('endpoint_binding_no_live'), false, 'key-material reference never binds');
  assert.equal(JSON.stringify(r).includes(base58), false, 'key-material value must NOT be echoed');
});

// ---- (15) a key-material binding entry VALUE is blocked & never echoed ----------------------------------------

test('(15) a key-material binding entry VALUE is blocked & not echoed', () => {
  const pem = '-----BEGIN PRIVATE KEY-----';
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only', blob: pem } },
  });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('endpoint_binding:key_material_not_accepted'), 'key-material entry value is blocked');
  assert.ok(r.blockers.includes('endpoint_binding_not_bound'), 'a key-material entry is not bound');
  assert.equal(JSON.stringify(r).includes(pem), false, 'key-material entry value must NOT be echoed');
});

// ---- (16) a faked bound/ready entry is IGNORED — result flags stay false --------------------------------------

test('(16) a faked binding entry {bound:true,has_rpc:true,ready:true,can_send:true} -> result STILL can_send:false/has_rpc:false', () => {
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: {
      [EP]: { bound: true, has_rpc: true, ready: true, can_send: true, is_live: true, configured: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' },
    },
  });
  assertRefusedShape(r);
  assert.equal(r.can_send, false, 'faked entry flags must NOT open send');
  assert.equal(r.has_rpc, false, 'faked entry flags must NOT set has_rpc');
  assert.equal(r.is_live, false);
});

// ---- (17) a faked rpc_provider_ready flag on the request is IGNORED — still refused ---------------------------

test('(17) faked rpc_provider_ready:true on the request + valid endpoint binding -> still refused (can_send:false)', () => {
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider_ready: true,
    readiness_ready: true,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: VALID_BINDING_MAP,
  });
  assertRefusedShape(r);
  assert.equal(r.can_send, false, 'a caller-supplied readiness flag never opens send');
  assert.equal(r.reason, 'send_gate_unconfigured_no_rpc');
});

// ---- (18) sign-only success + a valid endpoint binding -> still can_send:false --------------------------------

test('(18) sign_only_success:true + a valid endpoint binding -> still can_send:false', () => {
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    sign_only_success: true,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: VALID_BINDING_MAP,
  });
  assertRefusedShape(r);
  assert.equal(r.can_send, false, 'sign-only success + a valid binding does NOT open send');
  assert.equal(r.blockers.includes('sign_only_not_completed'), false, 'sign-only IS marked complete here');
  assert.ok(r.blockers.includes('send_gate_unconfigured_no_rpc'), 'foundational refusal still present');
});

// ---- (19) mainnet/prod in rpc_provider or binding -> refused --------------------------------------------------

test('(19) mainnet/prod in rpc_provider or binding is refused', () => {
  // mainnet in the rpc_provider environment.
  const rProv = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: { provider_ref: 'helius', environment: 'mainnet', endpoint_ref: EP },
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' } },
  });
  assertRefusedShape(rProv);
  assert.ok(rProv.blockers.includes('mainnet_indicator_blocked'), 'mainnet provider blocked by send-gate scan');
  // mainnet/prod surfaced through the binding entry environment.
  const rEntry = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'prod', endpoint_kind: 'reference_only' } },
  });
  assertRefusedShape(rEntry);
  assert.ok(rEntry.blockers.includes('endpoint_binding:mainnet_or_nontestnet_environment_blocked'), 'prod entry env blocked by harness');
  assert.equal(rEntry.can_send, false);
});

// ---- (20) an unknown provider is refused ----------------------------------------------------------------------

test('(20) an unknown provider (binding input + entry) is refused', () => {
  const r = evaluateSendPreflight({
    ...CLEAN_DEVNET,
    rpc_provider: { provider_ref: 'someprovider', environment: 'devnet', endpoint_ref: EP },
    endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'someprovider', environment: 'devnet', endpoint_kind: 'reference_only' } },
  });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('endpoint_binding:unknown_provider'), 'unknown provider surfaced by harness');
  assert.ok(r.blockers.includes('endpoint_binding_not_bound'));
  assert.equal(r.can_send, false);
});

// ---- (21) triton / yellowstone (doc-listed disabled) are refused ---------------------------------------------

test('(21) triton/yellowstone (doc-listed disabled) bindings are refused (provider_not_enabled)', () => {
  for (const disabled of ['triton', 'yellowstone']) {
    const r = evaluateSendPreflight({
      ...CLEAN_DEVNET,
      rpc_provider: { provider_ref: disabled, environment: 'devnet', endpoint_ref: EP },
      endpoint_binding_map: { [EP]: { bound: true, provider_ref: disabled, environment: 'devnet', endpoint_kind: 'reference_only' } },
    });
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('endpoint_binding:provider_not_enabled'), `${disabled} is not enabled`);
    assert.equal(r.can_send, false);
  }
});

// ---- (22) hostile/throwing rpc_provider returns a frozen refusal, never throws -------------------------------

test('(22) hostile throwing rpc_provider (getter / Proxy) with a binding map -> frozen refusal (input_inspection_error), no throw', () => {
  const throwingGetter = {
    ...CLEAN_DEVNET,
    endpoint_binding_map: VALID_BINDING_MAP,
    get rpc_provider() { throw new Error('boom-provider'); },
  };
  const throwingProxyProvider = {
    ...CLEAN_DEVNET,
    endpoint_binding_map: VALID_BINDING_MAP,
    rpc_provider: new Proxy({}, { ownKeys() { throw new Error('ownKeys boom'); }, get() { throw new Error('get boom'); } }),
  };
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

// ---- (23) hostile/throwing endpoint_binding_map returns a frozen refusal, never throws, never echoes ---------

test('(23) hostile throwing endpoint_binding_map (getter / Proxy) -> frozen refusal, no throw, no echo', () => {
  const MARKER = 'DDMARKERMAPZZ13579';
  const throwingGetter = {
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    get endpoint_binding_map() { throw new Error(`boom-map-${MARKER}`); },
  };
  const throwingProxyMap = {
    ...CLEAN_DEVNET,
    rpc_provider: VALID_PROVIDER,
    endpoint_binding_map: new Proxy({}, { get() { throw new Error(`get boom ${MARKER}`); }, ownKeys() { throw new Error('ownKeys boom'); } }),
  };
  for (const hostile of [throwingGetter, throwingProxyMap]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendPreflight(hostile); }, 'must not propagate the exception');
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('input_inspection_error'), 'inspection error recorded as a blocker');
    assert.equal(JSON.stringify(r).includes(MARKER), false, 'hostile map error/value must NOT be echoed');
    assert.equal(JSON.stringify(r).includes('boom'), false, 'caught error message must NOT be echoed');
  }
});

// ---- (24) the gate exposes NO send/broadcast/serialize/sendTransaction/connect method -------------------------

test('(24) the gate exposes NO send/broadcast/serialize/sendTransaction/connect method', () => {
  const g = createFailClosedSendGate();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'sendRawTransaction', 'submit', 'sign', 'connect', 'rpc', 'bind', 'bindEndpoint']) {
    assert.equal(typeof g[m], 'undefined', `gate must not expose ${m}`);
  }
  // the descriptor advertises no live capability and records BOTH consumptions fail-closed.
  const c = describeSendGateContract();
  assert.equal(c.can_send, false);
  assert.equal(c.can_broadcast, false);
  assert.equal(c.can_serialize, false);
  assert.equal(c.has_rpc, false);
  assert.equal(c.is_live, false);
  assert.equal(c.consumes_rpc_provider, true);
  assert.equal(c.consumes_endpoint_binding, true);
  assert.equal(Object.isFrozen(c), true);
});

// ---- (25) no SDK import: send-gate src specifiers are only relative (one cross-package rpc-provider import) ---

test('(25) send-gate src declares ONLY relative specifiers (no SDK/provider/network import family)', () => {
  const FORBIDDEN_SPEC = [
    /^@solana\//, /(^|\/)jupiter/i, /(^|\/)helius/i, /(^|\/)jito/i, /^@jup-ag\//,
    /^@noble\//, /^tweetnacl$/, /^bs58$/, /^ed25519/,
    /^(axios|node-fetch|undici|got|superagent)$/,
    /^(pg|postgres|@clickhouse\/|clickhouse|ioredis|redis)$/,
    /^node:(net|http|https|dgram|tls)$/,
  ];
  const ALLOWED_INTERNAL = '../../rpc-provider-contract/src/index.mjs';
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    const withStrings = stripComments(raw); // keeps specifier text, removes comments
    const specs = [];
    for (const m of withStrings.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
    for (const m of withStrings.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
    for (const spec of specs) {
      assert.ok(spec.startsWith('./') || spec.startsWith('../'), `import specifier must be relative in ${fn}: ${spec}`);
      for (const re of FORBIDDEN_SPEC) assert.equal(re.test(spec), false, `forbidden import family in ${fn}: ${spec}`);
    }
    const crossPkg = specs.filter((s) => s !== ALLOWED_INTERNAL && !s.startsWith('./'));
    assert.deepEqual(crossPkg, [], `only ${ALLOWED_INTERNAL} cross-package import is allowed in ${fn}`);
  }
  // the package src is NOT allowlisted (fully scanned by the mechanism guard).
  assert.equal(isAllowlisted('packages/send-gate-contract/src/'), false);
});

// ---- (26) no dependency: package.json declares no dependencies/devDependencies -------------------------------

test('(26) package.json declares NO dependencies/devDependencies (binding consumption is dependency-free)', () => {
  const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  assert.equal(Object.keys(deps).length, 0, 'no runtime dependencies');
  assert.equal(Object.keys(devDeps).length, 0, 'no dev dependencies');
});

// ---- (27) no network/provider call: send-gate src is free of external/provider imports -----------------------

test('(27) send-gate src is import-free of externals (only the relative rpc-provider contract is imported)', () => {
  const gateSrc = readFileSync(join(SRC, 'send-gate-contract.mjs'), 'utf8');
  const code = stripComments(gateSrc); // keeps strings (specifiers) intact, removes comments
  const specs = [];
  for (const m of code.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
  // exactly one cross-package import: the rpc-provider contract (proves real consumption, not a mock).
  assert.ok(specs.includes('../../rpc-provider-contract/src/index.mjs'), 'imports the rpc-provider contract');
  const external = specs.filter((s) => !s.startsWith('./') && !s.startsWith('../'));
  assert.deepEqual(external, [], 'no external/bare module imports');
  // the binding-harness consumption functions are referenced (consumption is real, not stubbed).
  const noStrings = stripCommentsAndStrings(gateSrc);
  assert.ok(/\bbindEndpointReferenceForTest\b/.test(noStrings), 'must reference bindEndpointReferenceForTest');
  assert.ok(/\bvalidateEndpointReferenceBinding\b/.test(noStrings), 'must reference validateEndpointReferenceBinding');
});

// ---- (28) no env/secret read: send-gate src carries no process.env/readFileSync/node:fs/node:process ----------

test('(28) send-gate src reads NO env / no secret file (no process.env/readFileSync/node:fs/node:process/fetch)', () => {
  const BAD = /(process\.env|readFileSync|readFile\b|node:fs|node:process|\bfetch\s*\(|new\s+WebSocket|new\s+Connection\s*\()/;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(BAD.test(code), false, `forbidden env/secret/network mechanism in ${fn}`);
  }
});

// ---- (29) no literal endpoint URL / API key in send-gate src (full-text scan) --------------------------------

test('(29) send-gate src contains NO literal endpoint URL or API-key literal', () => {
  // Full-text scan (NOT comment-stripped) so even a literal in a comment would be caught. A literal endpoint URL
  // requires a HOST after the scheme ([^\s'")]+) — the gate's bare scheme-only match TOKENS ('http://' etc., used
  // as conservative refusal indicators, never as endpoints) are immediately followed by a closing quote and so do
  // NOT match. Schemes are assembled at runtime so this assertion's own pattern is not itself a literal URL.
  const URL_LIT = new RegExp(`(${['ht', 'tps?:'].join('')}//[^\\s'")]+|${['w', 'ss?:'].join('')}//[^\\s'")]+)`);
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    assert.equal(URL_LIT.test(raw), false, `literal endpoint URL present in ${fn}`);
    // No long API-key-shaped hex/base58 secret literal (32+ contiguous key-ish chars assigned to a key field).
    assert.equal(/api[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]/i.test(raw), false, `literal api key present in ${fn}`);
  }
});

// ---- (30) can_send:false across the whole binding matrix ------------------------------------------------------

test('(30) can_send:false (and every live cap false) across the whole binding matrix', () => {
  const matrix = [
    // valid bind
    { rpc_provider: VALID_PROVIDER, endpoint_binding_map: VALID_BINDING_MAP },
    // empty map
    { rpc_provider: VALID_PROVIDER, endpoint_binding_map: {} },
    // missing entry
    { rpc_provider: VALID_PROVIDER, endpoint_binding_map: { 'helius-x-ref': { bound: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' } } },
    // provider mismatch
    { rpc_provider: VALID_PROVIDER, endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius-alt', environment: 'devnet', endpoint_kind: 'reference_only' } } },
    // env mismatch
    { rpc_provider: VALID_PROVIDER, endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'localnet', endpoint_kind: 'reference_only' } } },
    // mainnet entry
    { rpc_provider: VALID_PROVIDER, endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'helius', environment: 'mainnet', endpoint_kind: 'reference_only' } } },
    // faked flags entry
    { rpc_provider: VALID_PROVIDER, endpoint_binding_map: { [EP]: { bound: true, has_rpc: true, ready: true, can_send: true, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' } } },
    // unbound entry (bound:false)
    { rpc_provider: VALID_PROVIDER, endpoint_binding_map: { [EP]: { bound: false, provider_ref: 'helius', environment: 'devnet', endpoint_kind: 'reference_only' } } },
    // no map at all (milestone-3 skipped)
    { rpc_provider: VALID_PROVIDER },
    // map but no rpc_provider
    { endpoint_binding_map: VALID_BINDING_MAP },
    // unknown provider
    { rpc_provider: { provider_ref: 'someprovider', environment: 'devnet', endpoint_ref: EP }, endpoint_binding_map: { [EP]: { bound: true, provider_ref: 'someprovider', environment: 'devnet', endpoint_kind: 'reference_only' } } },
  ];
  for (const extra of matrix) {
    const r = evaluateSendPreflight({ ...CLEAN_DEVNET, ...extra });
    assertRefusedShape(r);
    assert.equal(r.can_send, false, `can_send must be false for ${JSON.stringify(Object.keys(extra))}`);
    assert.equal(r.can_broadcast, false);
    assert.equal(r.can_serialize, false);
    assert.equal(r.has_rpc, false);
    assert.equal(r.is_live, false);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'send_gate_unconfigured_no_rpc');
  }
});

void HERE;
