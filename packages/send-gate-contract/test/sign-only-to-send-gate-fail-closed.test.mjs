// PR-E2-F-2 — Sign-only -> Send-gate fail-closed WIRING evidence (TEST-ONLY).
//
// Proves that producing a genuine SIGN-ONLY success via the EXISTING real sign-only path (E2-C3-4) does NOT
// grant send: when the sign-only result (or a request derived from it) is fed into the EXISTING send-gate
// contract (E2-F-1, evaluateSendPreflight), the gate ALWAYS refuses (foundational send_gate_unconfigured_no_rpc).
// No src change in any package, no dependency, no ALLOWLIST change, no RPC/send/broadcast/serialization, no
// mainnet, no REAL-LIVE. Both modules are imported UNMODIFIED; the wiring lives only in this test harness.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// EXISTING, UNMODIFIED modules under test:
import { createRealSigningPath } from '../../isolated-signer-runtime/src/index.mjs';
import {
  describeSendGateContract,
  createFailClosedSendGate,
  evaluateSendPreflight,
  refusesKeyMaterial,
} from '../src/index.mjs';
import { runMechanismGuard, ALLOWLIST, isAllowlisted } from '../../../tools/check-mechanism-guards.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';

// Ephemeral, NON-EXTRACTABLE WebCrypto Ed25519 key handle (test-only; never exported/persisted) — the
// established E2-C5-1 pattern for exercising the real sign-only path.
const ephemeralPair = () => webcrypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);

// A fully-clean sign-only gate input (mirrors the E2-C5-1 BASE) so attemptSign reaches a real signature.
const BASE = Object.freeze({
  risk_approved: true, real_live_config_valid: true,
  signer_profile_status: 'ACTIVE', execution_wallet_status: 'ACTIVE', operating_state: 'ACTIVE',
  custody_phase: 'loaded', provider_status: 'configured',
  approval_age_slots: 2, max_approval_age_slots: 10,
  intent_id: 'intent-f2-1', idempotency_key: 'idem-f2-1',
  validation_status: 'valid', protocol_constant_status: 'green', provider_degraded: false,
  slot_lag: 0, slot_lag_max: 5, audit_path_available: true, admission_complete: true, operator_checklist_complete: true,
  audit_actor: 'op',
});

async function produceSignOnlySuccess(pair, ref = 'wire-ref-1', auditLog) {
  const digest = `devnet:${ref}`;
  const req = { ...BASE, payload_digest: digest, approved_payload_digest: digest };
  return createRealSigningPath(auditLog ? { auditLog } : undefined).attemptSign(req, pair.privateKey);
}

// Derive a send request from a sign-only success. sign_only_success mirrors the genuine signed===true.
function deriveSendRequest(signResult, extra = {}) {
  return {
    sign_only_success: signResult.signed === true,
    readiness_ready: true,
    preflight_ok: true,
    custody_status: 'ACTIVE',
    network: 'devnet',
    intent_id: signResult.intent_id,
    ...extra,
  };
}

function assertSendRefused(r) {
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

// ---- 1) a genuine SIGN-ONLY success does NOT grant send ----

test('E2-F-2 sign-only success does NOT grant send; send gate still refuses', async () => {
  const pair = await ephemeralPair();
  const sign = await produceSignOnlySuccess(pair);
  assert.equal(sign.ok, true, 'sign-only path produced a real success');
  assert.equal(sign.signed, true);
  assert.equal(sign.can_send, false, 'sign-only path itself never sends');
  assert.ok(typeof sign.signature === 'string' && sign.signature.length > 0, 'a real Ed25519 signature was produced');

  const send = evaluateSendPreflight(deriveSendRequest(sign));
  assertSendRefused(send);
  assert.ok(send.blockers.includes('send_gate_unconfigured_no_rpc'));
  // the crux: both gates are closed — a genuine signature does not unlock send
  assert.equal(sign.can_send === false && send.can_send === false, true);
});

// ---- 2) valid-looking devnet/testnet/localnet send request (post sign-only) is STILL refused ----

test('E2-F-2 valid-looking devnet/testnet/localnet send request still refused', async () => {
  const pair = await ephemeralPair();
  const sign = await produceSignOnlySuccess(pair);
  for (const network of ['devnet', 'testnet', 'localnet']) {
    const send = evaluateSendPreflight(deriveSendRequest(sign, { network }));
    assertSendRefused(send);
    // a clean derived request carries no specific threat blocker — only the foundational refusal
    assert.equal(send.blockers.includes('mainnet_indicator_blocked'), false);
    assert.equal(send.blockers.includes('endpoint_or_rpc_blocked'), false);
    assert.equal(send.blockers.includes('serialized_or_raw_tx_blocked'), false);
    assert.equal(send.blockers.includes('broadcast_or_send_indicator_blocked'), false);
  }
});

// ---- 3) mainnet indicators on a post-sign-only send request are refused ----

test('E2-F-2 mainnet indicators are refused (mainnet_indicator_blocked)', async () => {
  const pair = await ephemeralPair();
  const sign = await produceSignOnlySuccess(pair);
  for (const extra of [{ network: 'mainnet' }, { network: 'mainnet-beta' }, { cluster_kind: 'prod' }]) {
    const send = evaluateSendPreflight(deriveSendRequest(sign, extra));
    assertSendRefused(send);
    assert.ok(send.blockers.includes('mainnet_indicator_blocked'), `expected mainnet block: ${JSON.stringify(extra)}`);
  }
});

// ---- 4) endpoint / RPC / provider URL fields are refused ----

test('E2-F-2 endpoint / RPC / provider URL fields are refused (endpoint_or_rpc_blocked)', async () => {
  const pair = await ephemeralPair();
  const sign = await produceSignOnlySuccess(pair);
  for (const extra of [
    { rpc_endpoint: 'https://node.example/' },
    { provider_url: 'http://provider/' },
    { ws_socket: 'wss://node/' },
    { cluster: 'some-cluster' },
  ]) {
    const send = evaluateSendPreflight(deriveSendRequest(sign, extra));
    assertSendRefused(send);
    assert.ok(send.blockers.includes('endpoint_or_rpc_blocked'), `expected endpoint block: ${JSON.stringify(extra)}`);
  }
});

// ---- 5) raw / serialized transaction fields are refused ----

test('E2-F-2 raw / serialized transaction fields are refused (serialized_or_raw_tx_blocked)', async () => {
  const pair = await ephemeralPair();
  const sign = await produceSignOnlySuccess(pair);
  for (const extra of [
    { serialized: 'AQID' },
    { raw_transaction: 'AQID' },
    { transaction: 'AQID' },
    { wire_transaction: 'AQID' },
  ]) {
    const send = evaluateSendPreflight(deriveSendRequest(sign, extra));
    assertSendRefused(send);
    assert.ok(send.blockers.includes('serialized_or_raw_tx_blocked'), `expected serialize block: ${JSON.stringify(extra)}`);
  }
});

// ---- 6) key-material-shaped input is refused and never echoed ----

test('E2-F-2 key-material-shaped input refused and never echoed; no key/raw fields in result', () => {
  for (const km of ['-----BEGIN PRIVATE KEY-----', { secret: 'x' }, { private_key: 'x' }, { seed: 'x' }, { mnemonic: 'x' }, { keypair: 'x' }]) {
    assert.equal(refusesKeyMaterial(km), true, `must refuse: ${JSON.stringify(km).slice(0, 24)}`);
    const r = evaluateSendPreflight(km);
    assertSendRefused(r);
    assert.ok(r.blockers.includes('key_material_not_accepted'));
  }
  const r = evaluateSendPreflight({ sign_only_success: true, secret: 'SECRET_MARKER_F2' });
  assert.equal(JSON.stringify(r).includes('SECRET_MARKER_F2'), false);
  for (const k of ['key', 'privateKey', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'raw', 'handle']) {
    assert.equal(k in r, false, `result must not carry ${k}`);
  }
});

// ---- 7) hostile / throwing input returns a frozen refusal (never throws) ----

test('E2-F-2 hostile/throwing input returns a frozen refusal (no exception)', () => {
  const throwingGetter = { get sign_only_success() { throw new Error('boom'); } };
  const throwingProxy = new Proxy({}, { ownKeys() { throw new Error('ownKeys boom'); } });
  for (const hostile of [throwingGetter, throwingProxy]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateSendPreflight(hostile); });
    assertSendRefused(r);
    assert.ok(r.blockers.includes('input_inspection_error'));
  }
  assert.equal(JSON.stringify(evaluateSendPreflight(throwingGetter)).includes('boom'), false);
});

// ---- 8) the send gate exposes no send/broadcast/serialize methods ----

test('E2-F-2 send gate exposes no send/broadcast/serialize methods; caps all false', () => {
  const g = createFailClosedSendGate();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'submit', 'sign', 'connect', 'rpc']) {
    assert.equal(typeof g[m], 'undefined', `gate must not expose ${m}`);
  }
  const d = describeSendGateContract();
  assert.equal(d.can_send, false);
  assert.equal(d.can_broadcast, false);
  assert.equal(d.can_serialize, false);
  assert.equal(d.has_rpc, false);
  assert.equal(d.is_live, false);
});

// ---- 9) audit and send-gate output carry no secrets / key material / endpoint ----

test('E2-F-2 audit and send-gate output carry no signature/secret/key/endpoint', async () => {
  const pair = await ephemeralPair();
  const log = createAuditLog();
  const sign = await produceSignOnlySuccess(pair, 'audit-wire', log);
  assert.equal(sign.signed, true);
  // sign-only audit: keys subset of AUDIT_COLUMNS; no signature/digest/key
  const allowed = new Set(AUDIT_COLUMNS);
  for (const e of log.list()) {
    for (const k of Object.keys(e)) assert.ok(allowed.has(k), `audit key ${k} ⊆ AUDIT_COLUMNS`);
    const blob = JSON.stringify(e);
    assert.equal(blob.includes(sign.signature), false, 'audit must not contain the signature');
    assert.equal(blob.includes('devnet:audit-wire'), false, 'audit must not contain the digest');
    for (const bad of ['privateKey', 'secret', 'mnemonic', 'seed']) {
      assert.equal(blob.toLowerCase().includes(bad.toLowerCase()), false, `audit must not contain ${bad}`);
    }
  }
  // send-gate output never echoes the signature, a secret, or an endpoint passed in the request
  const send = evaluateSendPreflight({
    sign_only_success: true, signature: sign.signature, secret: 'SECRET_MARKER_F2', rpc_endpoint: 'https://leak.example/',
  });
  const blob = JSON.stringify(send);
  assert.equal(blob.includes(sign.signature), false, 'send output must not echo the signature');
  assert.equal(blob.includes('SECRET_MARKER_F2'), false, 'send output must not echo a secret');
  assert.equal(blob.includes('leak.example'), false, 'send output must not echo an endpoint');
  assert.ok(send.blockers.includes('endpoint_or_rpc_blocked'));
  assert.ok(send.blockers.includes('key_material_not_accepted'));
});

// ---- 10) guard / allowlist invariants (test-only; no src change) ----

test('E2-F-2 guard PASS, ALLOWLIST one path, send-gate src NOT allowlisted', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(res.counts.violations, 0);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
  assert.equal(isAllowlisted('packages/send-gate-contract/src/send-gate-contract.mjs'), false);
});
