// PR-E2-F-5 — No-live-RPC send-gate HARNESS evidence (TEST-ONLY).
//
// Builds a NO-LIVE-RPC harness ENTIRELY inside this test: a pure model of "what a future send attempt would
// consult", with NO provider/SDK import and NO network call. It delegates the decision to the EXISTING,
// UNMODIFIED send gate (E2-F-1 evaluateSendPreflight) and only annotates a SIMULATED provider state. It NEVER
// sends/broadcasts/serializes and makes NO network call. Proves: live RPC disabled by default; missing endpoint
// refuses; provider failure fails closed; mainnet/endpoint indicators refused before any send; testnet-shaped
// requests still refused; no implicit broadcast; sign-only success still does not unlock send (E2-F-2
// continuity); no endpoint/credential/key leakage; no send/broadcast/serialize methods; hostile input -> frozen
// refusal. No src change in any package, no dependency, no ALLOWLIST change, no RPC, no real endpoint URL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

const ephemeralPair = () => webcrypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);

// Sign-only gate input (mirrors E2-C5-1/E2-F-2 BASE) so the real sign-only path reaches a genuine signature.
const BASE = Object.freeze({
  risk_approved: true, real_live_config_valid: true,
  signer_profile_status: 'ACTIVE', execution_wallet_status: 'ACTIVE', operating_state: 'ACTIVE',
  custody_phase: 'loaded', provider_status: 'configured',
  approval_age_slots: 2, max_approval_age_slots: 10,
  intent_id: 'intent-f5-1', idempotency_key: 'idem-f5-1',
  validation_status: 'valid', protocol_constant_status: 'green', provider_degraded: false,
  slot_lag: 0, slot_lag_max: 5, audit_path_available: true, admission_complete: true, operator_checklist_complete: true,
  audit_actor: 'op',
});

// ---- NO-LIVE-RPC harness (test-only; NO provider/SDK import, NO network call, NEVER sends) ----
// Default provider state: live RPC DISABLED, NO endpoint, unconfigured. There is no real provider object — the
// "providerState" is a plain simulated record. The harness performs NO network I/O of any kind.
const DEFAULT_PROVIDER = Object.freeze({ live_rpc_enabled: false, endpoint_present: false, provider_status: 'unconfigured' });
const PROVIDER_READY = Object.freeze({ live_rpc_enabled: true, endpoint_present: true, provider_status: 'configured' });

function harnessAttemptSend(request, providerState = DEFAULT_PROVIDER) {
  // Real, unmodified send-gate decision (always refuses; internally fail-safe — never throws).
  const gate = evaluateSendPreflight(request);
  const harness_blockers = [];
  try {
    if (!(providerState && providerState.live_rpc_enabled === true)) harness_blockers.push('live_rpc_disabled_by_default');
    if (!(providerState && providerState.endpoint_present === true)) harness_blockers.push('missing_endpoint');
    if (providerState && providerState.provider_status === 'failed') harness_blockers.push('provider_failed_fail_closed');
  } catch {
    // A hostile/throwing simulated provider state is still refused — never re-thrown, never echoed.
    harness_blockers.push('harness_input_inspection_error');
  }
  // The harness makes NO network call and NEVER sends/broadcasts/serializes.
  return Object.freeze({
    sent: false,
    broadcast: false,
    serialized: null,
    network_call_made: false,
    gate,
    harness_blockers: Object.freeze(harness_blockers),
  });
}

function assertNoSend(r) {
  assert.equal(r.sent, false);
  assert.equal(r.broadcast, false);
  assert.equal(r.serialized, null);
  assert.equal(r.network_call_made, false);
  assert.equal(r.gate.ok, false);
  assert.equal(r.gate.can_send, false);
  assert.equal(r.gate.sent, false);
  assert.equal(r.gate.broadcast, false);
  assert.equal(r.gate.reason, 'send_gate_unconfigured_no_rpc');
  assert.equal(Object.isFrozen(r), true);
}

const CLEAN_DEVNET = Object.freeze({ sign_only_success: true, readiness_ready: true, preflight_ok: true, custody_status: 'ACTIVE', network: 'devnet' });

// ---- 1) harness exists test-only; default state never sends; gate refuses ----

test('E2-F-5 no-live-RPC harness: default state makes no network call and never sends', () => {
  const r = harnessAttemptSend(CLEAN_DEVNET);
  assertNoSend(r);
  assert.ok(r.harness_blockers.includes('live_rpc_disabled_by_default'));
});

// ---- 2) live RPC disabled by default ----

test('E2-F-5 live RPC disabled by default', () => {
  assert.equal(DEFAULT_PROVIDER.live_rpc_enabled, false);
  const r = harnessAttemptSend(CLEAN_DEVNET, DEFAULT_PROVIDER);
  assert.ok(r.harness_blockers.includes('live_rpc_disabled_by_default'));
  assertNoSend(r);
});

// ---- 3) missing endpoint refuses (even if live_rpc simulated enabled) ----

test('E2-F-5 missing endpoint refuses', () => {
  const r = harnessAttemptSend(CLEAN_DEVNET, { live_rpc_enabled: true, endpoint_present: false, provider_status: 'configured' });
  assert.ok(r.harness_blockers.includes('missing_endpoint'));
  assertNoSend(r);
});

// ---- 4) provider failure fails closed ----

test('E2-F-5 provider failure refuses fail-closed', () => {
  const r = harnessAttemptSend(CLEAN_DEVNET, { live_rpc_enabled: true, endpoint_present: true, provider_status: 'failed' });
  assert.ok(r.harness_blockers.includes('provider_failed_fail_closed'));
  assertNoSend(r);
});

// ---- 5) mainnet / endpoint indicators refused before any send (no literal URL — placeholders only) ----

test('E2-F-5 mainnet/endpoint indicators refused before any send', () => {
  const cases = [
    [{ network: 'mainnet' }, 'mainnet_indicator_blocked'],
    [{ cluster_kind: 'prod' }, 'mainnet_indicator_blocked'],
    [{ rpc_endpoint: 'x' }, 'endpoint_or_rpc_blocked'],
    [{ provider_url: 'x' }, 'endpoint_or_rpc_blocked'],
    [{ cluster: 'c' }, 'endpoint_or_rpc_blocked'],
  ];
  for (const [extra, blocker] of cases) {
    const r = harnessAttemptSend({ ...CLEAN_DEVNET, ...extra }, PROVIDER_READY);
    assertNoSend(r);
    assert.ok(r.gate.blockers.includes(blocker), `expected ${blocker} for ${JSON.stringify(extra)}`);
  }
});

// ---- 6) testnet/devnet-shaped request without live RPC stays refused ----

test('E2-F-5 testnet/devnet/localnet-shaped request (no live RPC) stays refused', () => {
  for (const network of ['devnet', 'testnet', 'localnet']) {
    const r = harnessAttemptSend({ ...CLEAN_DEVNET, network });
    assertNoSend(r);
    assert.equal(r.gate.reason, 'send_gate_unconfigured_no_rpc');
  }
});

// ---- 7) no implicit broadcast: no send, no broadcast, no serialization ----

test('E2-F-5 no implicit broadcast even with a simulated "ready" provider', () => {
  const r = harnessAttemptSend(CLEAN_DEVNET, PROVIDER_READY);
  assertNoSend(r);
  assert.equal(r.gate.can_broadcast, false);
  assert.equal(r.gate.can_serialize, false);
});

// ---- 8) even all simulated preconditions satisfied -> still refused (no send path / no network) ----

test('E2-F-5 with all simulated preconditions satisfied, harness still does not send', () => {
  const r = harnessAttemptSend({ ...CLEAN_DEVNET }, PROVIDER_READY);
  assert.equal(r.harness_blockers.includes('live_rpc_disabled_by_default'), false);
  assert.equal(r.harness_blockers.includes('missing_endpoint'), false);
  assert.equal(r.harness_blockers.includes('provider_failed_fail_closed'), false);
  assertNoSend(r);
  assert.ok(r.gate.blockers.includes('send_gate_unconfigured_no_rpc'));
});

// ---- 9) sign-only success + harness send request stays refused (E2-F-2 continuity) ----

test('E2-F-5 genuine sign-only success + harness send request stays refused', async () => {
  const pair = await ephemeralPair();
  const digest = 'devnet:f5-ref';
  const sign = await createRealSigningPath().attemptSign({ ...BASE, payload_digest: digest, approved_payload_digest: digest }, pair.privateKey);
  assert.equal(sign.ok, true);
  assert.equal(sign.signed, true);
  assert.equal(sign.can_send, false);
  const r = harnessAttemptSend(
    { sign_only_success: sign.signed === true, readiness_ready: true, preflight_ok: true, custody_status: 'ACTIVE', network: 'devnet', intent_id: sign.intent_id },
    PROVIDER_READY,
  );
  assertNoSend(r);
  assert.equal(sign.can_send === false && r.gate.can_send === false, true);
});

// ---- 10) no endpoint/credential/key/secret leakage in output or audit ----

test('E2-F-5 output and audit carry no endpoint/credential/key/secret', async () => {
  const r = harnessAttemptSend({ sign_only_success: true, rpc_endpoint: 'ENDPOINT_MARKER_F5', secret: 'SECRET_MARKER_F5' }, PROVIDER_READY);
  const blob = JSON.stringify(r);
  assert.equal(blob.includes('ENDPOINT_MARKER_F5'), false);
  assert.equal(blob.includes('SECRET_MARKER_F5'), false);
  for (const k of ['key', 'privateKey', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair', 'raw', 'handle', 'endpoint', 'credential', 'api_key']) {
    assert.equal(k in r.gate, false, `gate result must not carry ${k}`);
  }
  // key material is refused (and never echoed)
  assert.equal(refusesKeyMaterial({ secret: 'x' }), true);
  assert.ok(r.gate.blockers.includes('key_material_not_accepted'));

  // sign-only audit: keys subset of AUDIT_COLUMNS; no signature/endpoint marker
  const pair = await ephemeralPair();
  const log = createAuditLog();
  const digest = 'devnet:f5-audit';
  const sign = await createRealSigningPath({ auditLog: log }).attemptSign({ ...BASE, payload_digest: digest, approved_payload_digest: digest }, pair.privateKey);
  const allowed = new Set(AUDIT_COLUMNS);
  for (const e of log.list()) {
    for (const kk of Object.keys(e)) assert.ok(allowed.has(kk), `audit key ${kk} ⊆ AUDIT_COLUMNS`);
    const eb = JSON.stringify(e);
    assert.equal(eb.includes(sign.signature), false);
    assert.equal(eb.includes('ENDPOINT_MARKER_F5'), false);
  }
});

// ---- 11) send-gate surface exposes no send/broadcast/serialize methods ----

test('E2-F-5 send-gate surface exposes no send/broadcast/serialize methods', () => {
  const g = createFailClosedSendGate();
  for (const m of ['send', 'broadcast', 'serialize', 'sendTransaction', 'submit', 'connect', 'rpc']) {
    assert.equal(typeof g[m], 'undefined', `gate must not expose ${m}`);
  }
  const d = describeSendGateContract();
  assert.equal(d.can_send, false);
  assert.equal(d.has_rpc, false);
  assert.equal(d.is_live, false);
});

// ---- 12) hostile/throwing input (request or provider state) returns a frozen refusal (no throw) ----

test('E2-F-5 hostile/throwing input returns a frozen refusal (no exception)', () => {
  const throwingRequest = { get sign_only_success() { throw new Error('boom'); } };
  const throwingProvider = { get live_rpc_enabled() { throw new Error('prov boom'); } };
  let r1;
  assert.doesNotThrow(() => { r1 = harnessAttemptSend(throwingRequest); });
  assertNoSend(r1);
  assert.ok(r1.gate.blockers.includes('input_inspection_error'));
  let r2;
  assert.doesNotThrow(() => { r2 = harnessAttemptSend(CLEAN_DEVNET, throwingProvider); });
  assertNoSend(r2);
  assert.ok(r2.harness_blockers.includes('harness_input_inspection_error'));
  assert.equal(JSON.stringify(harnessAttemptSend(throwingRequest)).includes('boom'), false);
});

// ---- 13) harness import-clean (no provider/SDK/network/solana/http); guard unchanged; src not allowlisted ----

test('E2-F-5 harness imports no provider/SDK/network; guard PASS allowlist=1; src not allowlisted', () => {
  const code = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const specs = [...code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const FORBID = /(^@solana\/|jupiter|helius|jito|^@noble\/|^tweetnacl$|^bs58$|^axios$|^node-fetch$|^undici$|^got$|^pg$|^postgres$|^redis$|^ioredis$|^@clickhouse\/|^node:(net|http|https|dgram|tls)$)/i;
  assert.equal(specs.some((s) => FORBID.test(s)), false, `forbidden import in test harness: ${specs.join(',')}`);
  // the harness made no network call (modeled, and proven by import-cleanliness above)
  assert.equal(harnessAttemptSend(CLEAN_DEVNET).network_call_made, false);
  // send-gate src remains NOT allowlisted (fully scanned); guard PASS, ALLOWLIST one path
  assert.equal(isAllowlisted('packages/send-gate-contract/src/send-gate-contract.mjs'), false);
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(res.counts.violations, 0);
  assert.equal(ALLOWLIST.length, 1);
});
