import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  describeSendGateContract,
  createFailClosedSendGate,
  evaluateSendPreflight,
  refusesKeyMaterial,
  SEND_GATE_CONTRACT_STATUS,
} from '../src/index.mjs';
import {
  runMechanismGuard,
  ALLOWLIST,
  isAllowlisted,
  stripComments,
  stripCommentsAndStrings,
} from '../../../tools/check-mechanism-guards.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// A clean, valid-LOOKING devnet request: all preconditions satisfied, no threat indicators. It must STILL be
// refused, because there is no RPC and no send path at all.
const CLEAN_DEVNET = Object.freeze({
  sign_only_success: true,
  readiness_ready: true,
  preflight_ok: true,
  custody_status: 'ACTIVE',
  network: 'devnet',
  intent_id: 'intent-1',
  idempotency_key: 'idem-1',
});

// Assert the canonical fail-closed output shape (every send/broadcast/serialize capability false; nulls).
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

// ---- contract descriptor: every send/broadcast/serialize/RPC/live capability is false ----

test('contract descriptor pins all send capabilities to false (no execution authority surface)', () => {
  const c = describeSendGateContract();
  assert.equal(c.contract, 'send-gate');
  assert.equal(c.can_send, false);
  assert.equal(c.can_broadcast, false);
  assert.equal(c.can_serialize, false);
  assert.equal(c.has_rpc, false);
  assert.equal(c.is_live, false);
  assert.equal(c.accepts_key_material_input, false);
  assert.equal(c.requires_sign_only_success, true);
  // MILESTONE 2: descriptor records that the gate consumes the rpc-provider contract result fail-closed.
  assert.equal(c.consumes_rpc_provider, true);
  assert.ok(/rpc-provider/.test(c.note), 'descriptor note mentions the rpc-provider consumption');
  assert.equal(c.status, 'unconfigured_no_rpc');
  assert.equal(Object.isFrozen(c), true);
});

// ---- gate is fail-closed and exposes no send/broadcast/serialize methods ----

test('createFailClosedSendGate is unconfigured and exposes no send/broadcast/serialize methods', () => {
  const g = createFailClosedSendGate();
  assert.equal(g.status, 'unconfigured_no_rpc');
  assert.equal(g.isConfigured(), false);
  assert.equal(g.describe().contract, 'send-gate');
  assert.equal(Object.isFrozen(g), true);
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'submit', 'sign', 'connect', 'rpc']) {
    assert.equal(typeof g[m], 'undefined', `gate must not expose ${m}`);
  }
});

test('gate.evaluateSendPreflight on undefined/empty is refused (foundational no-RPC reason)', () => {
  const g = createFailClosedSendGate();
  for (const input of [undefined, null, {}, 42, 'x']) {
    const r = g.evaluateSendPreflight(input);
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('send_gate_unconfigured_no_rpc'));
  }
});

// ---- valid-looking devnet/testnet request is STILL refused ----

test('a valid-looking devnet/testnet request is STILL refused (no RPC, no send path)', () => {
  for (const network of ['devnet', 'testnet', 'localnet']) {
    const r = evaluateSendPreflight({ ...CLEAN_DEVNET, network });
    assertRefusedShape(r);
    assert.equal(r.blockers.includes('send_gate_unconfigured_no_rpc'), true);
    // a clean request has NO specific threat blocker, only the foundational one + (none of the precondition ones)
    assert.equal(r.blockers.includes('mainnet_indicator_blocked'), false);
    assert.equal(r.blockers.includes('endpoint_or_rpc_blocked'), false);
    assert.equal(r.blockers.includes('serialized_or_raw_tx_blocked'), false);
    assert.equal(r.blockers.includes('sign_only_not_completed'), false);
    assert.equal(r.blockers.includes('readiness_not_ready'), false);
    assert.equal(r.blockers.includes('preflight_not_ok'), false);
    assert.equal(r.blockers.includes('custody_not_active'), false);
  }
});

// ---- mainnet refusal ----

test('mainnet indicators are refused (mainnet_indicator_blocked)', () => {
  for (const bad of [
    { ...CLEAN_DEVNET, network: 'mainnet' },
    { ...CLEAN_DEVNET, network: 'mainnet-beta' },
    { ...CLEAN_DEVNET, cluster_kind: 'prod' },
  ]) {
    const r = evaluateSendPreflight(bad);
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('mainnet_indicator_blocked'), `expected mainnet block: ${JSON.stringify(bad)}`);
  }
});

// ---- endpoint / RPC / provider URL refusal ----

test('endpoint / RPC / provider URL indicators are refused (endpoint_or_rpc_blocked)', () => {
  for (const bad of [
    { ...CLEAN_DEVNET, rpc_endpoint: 'https://node.example/' },
    { ...CLEAN_DEVNET, provider_url: 'http://provider/' },
    { ...CLEAN_DEVNET, ws_socket: 'wss://node/' },
    { ...CLEAN_DEVNET, cluster: 'some-cluster' },
  ]) {
    const r = evaluateSendPreflight(bad);
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('endpoint_or_rpc_blocked'), `expected endpoint block: ${JSON.stringify(bad)}`);
  }
});

test('broadcast / send-intent indicators are refused (broadcast_or_send_indicator_blocked)', () => {
  for (const bad of [{ ...CLEAN_DEVNET, broadcast: true }, { ...CLEAN_DEVNET, send: true }]) {
    const r = evaluateSendPreflight(bad);
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('broadcast_or_send_indicator_blocked'), `expected broadcast/send block: ${JSON.stringify(bad)}`);
  }
});

// ---- raw / serialized transaction refusal ----

test('serialized / raw transaction fields are refused (serialized_or_raw_tx_blocked)', () => {
  for (const bad of [
    { ...CLEAN_DEVNET, serialized: 'AQID' },
    { ...CLEAN_DEVNET, raw_transaction: 'AQID' },
    { ...CLEAN_DEVNET, transaction: 'AQID' },
    { ...CLEAN_DEVNET, wire_transaction: 'AQID' },
  ]) {
    const r = evaluateSendPreflight(bad);
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('serialized_or_raw_tx_blocked'), `expected serialize block: ${JSON.stringify(bad)}`);
  }
});

// ---- gate preconditions (sign-only success, readiness, preflight, custody) ----

test('missing sign-only success is a blocker (send never happens without sign-only success)', () => {
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, sign_only_success: false });
  assertRefusedShape(r);
  assert.ok(r.blockers.includes('sign_only_not_completed'));
});

test('readiness / preflight / custody failures are blockers', () => {
  const noReady = evaluateSendPreflight({ ...CLEAN_DEVNET, readiness_ready: false });
  assert.ok(noReady.blockers.includes('readiness_not_ready'));
  const noPre = evaluateSendPreflight({ ...CLEAN_DEVNET, preflight_ok: false });
  assert.ok(noPre.blockers.includes('preflight_not_ok'));
  const degraded = evaluateSendPreflight({ ...CLEAN_DEVNET, custody_status: 'DEGRADED' });
  assert.ok(degraded.blockers.includes('custody_not_active'));
  // even with EVERY precondition satisfied, the gate is still refused foundationally
  const allGood = evaluateSendPreflight(CLEAN_DEVNET);
  assert.equal(allGood.ok, false);
  assert.equal(allGood.reason, 'send_gate_unconfigured_no_rpc');
});

// ---- key material is refused and never echoed ----

test('key-material-shaped input is refused and never echoed; no key/raw fields in result', () => {
  const pem = '-----BEGIN PRIVATE KEY-----';
  const base58 = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  const words = Array(12).fill('abandon').join(' ');
  for (const km of [pem, base58, words, { secret: 'x' }, { private_key: 'x' }, { seed: 'x' }, { mnemonic: 'x' }, { keypair: 'x' }]) {
    assert.equal(refusesKeyMaterial(km), true, `must refuse: ${JSON.stringify(km).slice(0, 24)}`);
    const r = evaluateSendPreflight(km);
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('key_material_not_accepted'));
  }
  // refusal never echoes the secret value back, and the result carries no key/raw field names
  const withSecret = evaluateSendPreflight({ ...CLEAN_DEVNET, secret: 'super-secret-value' });
  assert.equal(JSON.stringify(withSecret).includes('super-secret-value'), false);
  for (const k of ['key', 'privateKey', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'raw', 'handle']) {
    assert.equal(k in withSecret, false, `result must not carry ${k}`);
  }
  // non-key inputs are not falsely flagged
  for (const ok of [undefined, null, 'devnet', { intent_id: 'i-1' }]) {
    assert.equal(refusesKeyMaterial(ok), false, `must NOT flag: ${JSON.stringify(ok)}`);
  }
});

// ---- the result never echoes request input (built from fixed literals) ----

test('result is built from fixed literals and never echoes request fields', () => {
  const r = evaluateSendPreflight({ ...CLEAN_DEVNET, marker_field: 'ECHO_MARKER_12345' });
  assert.equal(JSON.stringify(r).includes('ECHO_MARKER_12345'), false);
  assert.equal('marker_field' in r, false);
});

// ---- hostile/throwing input still RETURNS a refusal (never throws) ----

test('a request whose inspection throws (getter / Proxy trap) still RETURNS a frozen refusal', () => {
  const throwingGetter = { get sign_only_success() { throw new Error('boom'); } };
  const throwingProxy = new Proxy({}, { ownKeys() { throw new Error('ownKeys boom'); } });
  for (const hostile of [throwingGetter, throwingProxy]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendPreflight(hostile); }, 'must not propagate the exception');
    assertRefusedShape(r);
    assert.ok(r.blockers.includes('input_inspection_error'), 'inspection error recorded as a blocker');
    assert.ok(r.blockers.includes('send_gate_unconfigured_no_rpc'));
  }
  // the caught error message is never echoed into the result
  assert.equal(JSON.stringify(evaluateSendPreflight(throwingGetter)).includes('boom'), false);
});

// ---- this package is OUTSIDE the allowlist and fully scanned ----

test('package src is NOT allowlisted (fully scanned by the mechanism guard)', () => {
  assert.equal(isAllowlisted('packages/send-gate-contract/src/'), false);
  assert.equal(isAllowlisted('packages/send-gate-contract/src/send-gate-contract.mjs'), false);
  assert.equal(isAllowlisted('packages/send-gate-contract/src/index.mjs'), false);
});

// ---- no live imports / no forbidden mechanisms in src (self-scan) ----

// MILESTONE 2: the gate now CONSUMES the sibling rpc-provider contract, so src is no longer import-free. It is
// allowed EXACTLY ONE relative internal import ('../../rpc-provider-contract/src/index.mjs') and NOTHING else:
// no require(), and no external/forbidden import family (Solana/Jupiter/Helius/Jito/@noble/tweetnacl/bs58/axios/
// node-fetch/undici/pg/redis/clickhouse/node:net|http|https). Every import specifier must be relative.
test('src allows ONLY the one relative internal rpc-provider import (no external/forbidden import, no require)', () => {
  // Forbidden import families (matched against the bare specifier). Mirrors the mechanism guard's import layer.
  const FORBIDDEN_SPEC = [
    /^@solana\//,
    /(^|\/)jupiter/i,
    /(^|\/)helius/i,
    /(^|\/)jito/i,
    /^@jup-ag\//,
    /^@noble\//,
    /^tweetnacl$/,
    /^bs58$/,
    /^ed25519/,
    /^(axios|node-fetch|undici|got|superagent)$/,
    /^(pg|postgres|@clickhouse\/|clickhouse|ioredis|redis)$/,
    /^node:(net|http|https|dgram|tls)$/,
  ];
  const ALLOWED_INTERNAL = '../../rpc-provider-contract/src/index.mjs';

  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    const noStrings = stripCommentsAndStrings(raw); // for mechanism checks (require)
    const withStrings = stripComments(raw);         // for specifier extraction (keeps the specifier text)
    // NO require() anywhere (CommonJS interop is forbidden in these pure ESM contracts).
    assert.equal(/\brequire\s*\(/.test(noStrings), false, `no require() allowed in ${fn}`);
    // Extract every `... from '<spec>'` import/export specifier from the comment-stripped (string-kept) code.
    const specs = [];
    for (const m of withStrings.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
    for (const m of withStrings.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) specs.push(m[1]); // bare `import '<spec>'`
    for (const spec of specs) {
      // Every specifier MUST be relative (starts with ./ or ../) — never a bare/external module.
      assert.ok(
        spec.startsWith('./') || spec.startsWith('../'),
        `import specifier must be relative in ${fn}: ${spec}`,
      );
      // And it must not match any forbidden import family.
      for (const re of FORBIDDEN_SPEC) {
        assert.equal(re.test(spec), false, `forbidden import family in ${fn}: ${spec}`);
      }
    }
    // The only NON-trivially-local (cross-package) specifier permitted is the rpc-provider internal import.
    const crossPkg = specs.filter((s) => s !== ALLOWED_INTERNAL && !s.startsWith('./'));
    assert.deepEqual(crossPkg, [], `only ${ALLOWED_INTERNAL} cross-package import is allowed in ${fn}`);
  }
});

// The single permitted cross-package import is actually PRESENT in the gate source (consumption is real).
// NOTE: specifiers must be read from the comment-stripped-but-string-PRESERVING view (`stripComments`), because
// `stripCommentsAndStrings` blanks string contents and would erase the specifier text.
test('src DOES import the rpc-provider contract (consumption is wired)', () => {
  const gateSrc = readFileSync(join(SRC, 'send-gate-contract.mjs'), 'utf8');
  const code = stripComments(gateSrc); // keeps string literals (specifiers) intact, removes comments
  const specs = [];
  for (const m of code.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) specs.push(m[1]);
  assert.ok(
    specs.includes('../../rpc-provider-contract/src/index.mjs'),
    'send-gate-contract.mjs must import the rpc-provider contract (relative internal specifier)',
  );
  // references the two consumption functions (and nothing live).
  const noStrings = stripCommentsAndStrings(gateSrc);
  assert.ok(/\bevaluateRpcReadiness\b/.test(noStrings), 'must reference evaluateRpcReadiness');
  assert.ok(/\bvalidateRpcProviderConfig\b/.test(noStrings), 'must reference validateRpcProviderConfig');
});

test('src contains NO sign/send/serialize/Connection/Keypair/KeyManager/fetch/WebSocket/.query/activate_real_live', () => {
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
  assert.equal(res.counts.violations, 0);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
});

test('status constant is unconfigured_no_rpc', () => {
  assert.equal(SEND_GATE_CONTRACT_STATUS, 'unconfigured_no_rpc');
});
