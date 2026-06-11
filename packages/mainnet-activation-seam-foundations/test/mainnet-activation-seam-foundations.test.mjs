// PR-S23 test suite for @soltrade/mainnet-activation-seam-foundations.
// node:test + node:assert/strict. Deterministic. Mainnet-SHAPED, NO real network,
// NO real keys/funds.
//
// Builds: a REAL @soltrade/real-live-readiness verdict (ready / not-ready) consumed
// by shape, plus the EXISTING fail-closed send-gate refusal -> exercises the six
// foundations (A-F). Confirms the seam can NEVER be seam_ready / activation_performed
// / real_live_activated across ALL requirement-presence combinations AND under forged
// truthy inputs; a not-ready readiness verdict / kill engaged (incl. default/missing)
// -> seam not ready; raw mainnet RPC URL / key / PEM / base58 plants -> refused +
// absent from JSON; opaque endpoint_ref accepted; capital_limit missing/<=0/Infinity
// -> requirement met:false; suppression three not_*_authorized; guard redaction; the
// send-gate evaluateSendPreflight STILL ok:false beside it; health best state
// _SUPPRESSED; TOCTOU counting-getter; static guards.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  describeMainnetActivationSeamContract,
  evaluateMainnetActivationSeam,
  describeGlobalKillSwitchContract,
  evaluateGlobalKillSwitch,
  describeEmergencyExitContract,
  evaluateEmergencyExit,
  describeMainnetActivationSuppressionContract,
  evaluateMainnetActivationSuppression,
  describeMainnetForbiddenSurfaceContract,
  evaluateMainnetForbiddenSurface,
  isValidMainnetEndpointRef,
  describeMainnetActivationHealthContract,
  evaluateMainnetActivationHealth
} from '../src/index.mjs';

// REAL real-live-readiness verdict (consumed by shape; ready===true required).
import { evaluateRealLiveReadiness } from '../../real-live-readiness/src/real-live-readiness.mjs';
// EXISTING fail-closed send gate (test-level only, STILL refuses; do NOT modify).
import { evaluateSendPreflight } from '../../send-gate-contract/src/send-gate-contract.mjs';

// ---------------------------------------------------------------------------
// REAL readiness verdicts (ready / not-ready).
// ---------------------------------------------------------------------------

const READY_INPUT = {
  real_live_config_valid: true,
  validation_status: 'valid',
  signer_profile_status: 'ACTIVE',
  execution_wallet_status: 'ACTIVE',
  operating_state: 'ACTIVE',
  protocol_constant_status: 'green',
  provider_degraded: false,
  slot_lag: 1,
  slot_lag_max: 5,
  audit_path_available: true,
  admission_complete: true,
  operator_checklist_complete: true
};

const readyVerdict = evaluateRealLiveReadiness(READY_INPUT);            // { ready:true, blockers:[] }
const notReadyVerdict = evaluateRealLiveReadiness({});                  // { ready:false, blockers:[...] }
const sendGateRefusal = evaluateSendPreflight({});                      // { ok:false, can_send:false, ... }

test('preconditions: a REAL real-live-readiness verdict reaches ready; the send-gate STILL refuses', () => {
  assert.equal(readyVerdict.ready, true);
  assert.equal(readyVerdict.blockers.length, 0);
  assert.equal(notReadyVerdict.ready, false);
  assert.equal(sendGateRefusal.ok, false);
  assert.equal(sendGateRefusal.can_send, false);
});

// ---------------------------------------------------------------------------
// Shared assertion helpers
// ---------------------------------------------------------------------------

const EXEC_FLAGS = [
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
];

function assertSafe(res) {
  assert.equal(Object.isFrozen(res), true);
  assert.equal(res.read_only, true);
  assert.equal(res.advisory_only, true);
  for (const f of EXEC_FLAGS) {
    assert.equal(res[f], false, `flag ${f} must be false`);
  }
}

const goodSeam = (over = {}) => ({
  purpose: 'mainnet_activation_seam',
  owner_go_decision_present: true,
  funded_mainnet_wallet_present: true,
  mainnet_rpc_endpoint_ref: 'rpc-ref-001',
  capital_limit: 1000,
  all_gates_green: true,
  real_live_readiness: readyVerdict,
  ...over
});

// ===========================================================================
// (A) MAINNET-ACTIVATION SEAM — the never-ready seam
// ===========================================================================

test('(A) descriptor: fixed literals + hardcoded met:false adapter requirement', () => {
  const d = describeMainnetActivationSeamContract();
  assertSafe(d);
  assert.equal(d.contract, 'mainnet-activation-seam');
  assert.equal(d.activation_performed, false);
  assert.equal(d.real_live_activated, false);
  assert.equal(d.seam_ready, false);
  assert.equal(d.endpoint_in_repo, false);
  assert.equal(d.key_in_repo, false);
  assert.equal(d.funds_in_repo, false);
  const adapter = d.seam_requirements.find((x) => x.requirement === 'MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION');
  assert.equal(adapter.met, false);
  assert.equal(Array.isArray(d.required_owner_inputs), true);
  assert.equal(d.required_owner_inputs.length > 0, true);
  // all seven requirement tokens present
  for (const t of [
    'MAINNET_REQ_OWNER_GO_DECISION', 'MAINNET_REQ_FUNDED_MAINNET_WALLET',
    'MAINNET_REQ_MAINNET_RPC_ENDPOINT_REF', 'MAINNET_REQ_CAPITAL_LIMIT',
    'MAINNET_REQ_ALL_GATES_GREEN', 'MAINNET_REQ_REAL_LIVE_READY',
    'MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION'
  ]) {
    assert.equal(d.supported_requirement_tokens.includes(t), true, `missing token ${t}`);
  }
});

test('(A) missing / hostile input -> unconfigured (never throws)', () => {
  for (const inp of [undefined, null, [], 42, 'x']) {
    const r = evaluateMainnetActivationSeam(inp);
    assertSafe(r);
    assert.equal(r.mainnet_seam_state, 'MAINNET_SEAM_UNCONFIGURED');
    assert.equal(r.activation_performed, false);
    assert.equal(r.real_live_activated, false);
    assert.equal(r.seam_ready, false);
  }
  const thrower = { purpose: 'mainnet_activation_seam', get capital_limit() { throw new Error('boom'); } };
  const r = evaluateMainnetActivationSeam(thrower);
  assertSafe(r);
  assert.equal(r.mainnet_seam_state, 'MAINNET_SEAM_UNCONFIGURED');
});

test('(A) seam NEVER seam_ready/activation_performed/real_live_activated across ALL requirement-presence combinations', () => {
  const bools = [true, false];
  const capitals = [1000, 0, -1, Infinity, undefined];
  let combos = 0;
  for (const go of bools) for (const funded of bools) for (const gates of bools) {
    for (const useRef of bools) for (const useReady of bools) for (const cap of capitals) {
      combos++;
      const inp = {
        purpose: 'mainnet_activation_seam',
        owner_go_decision_present: go,
        funded_mainnet_wallet_present: funded,
        all_gates_green: gates,
        capital_limit: cap,
        ...(useRef ? { mainnet_rpc_endpoint_ref: 'rpc-ref-xyz' } : {}),
        ...(useReady ? { real_live_readiness: readyVerdict } : {})
      };
      const r = evaluateMainnetActivationSeam(inp);
      assertSafe(r);
      assert.equal(r.seam_ready, false, 'seam_ready must NEVER be true');
      assert.equal(r.activation_performed, false, 'activation_performed must NEVER be true');
      assert.equal(r.real_live_activated, false, 'real_live_activated must NEVER be true');
      assert.equal(r.can_send, false);
      // the adapter-allowlist requirement is ALWAYS met:false
      const adapter = r.seam_requirements.find((x) => x.requirement === 'MAINNET_REQ_SEPARATE_SEND_ADAPTER_ALLOWLIST_DECISION');
      assert.equal(adapter.met, false);
      // capital requirement reflects finiteness/>0
      const capReq = r.seam_requirements.find((x) => x.requirement === 'MAINNET_REQ_CAPITAL_LIMIT');
      assert.equal(capReq.met, cap === 1000);
    }
  }
  assert.equal(combos, 2 * 2 * 2 * 2 * 2 * 5);
});

test('(A) ALL requirements maximally satisfied + FORGED truthy inputs -> STILL never ready', () => {
  // forge every truthy activation flag we can think of; the seam must still refuse.
  const forged = goodSeam({
    seam_ready: true, activation_performed: true, real_live_activated: true,
    activated: true, live_activated: true, can_send: true
  });
  const r = evaluateMainnetActivationSeam(forged);
  assertSafe(r);
  // forged forbidden true flags are screened -> INVALID, and STILL not ready.
  assert.equal(r.seam_ready, false);
  assert.equal(r.activation_performed, false);
  assert.equal(r.real_live_activated, false);
  assert.equal(r.mainnet_seam_state, 'MAINNET_SEAM_INVALID');

  // a perfectly clean maximal input is a DESCRIPTOR, still never ready.
  const clean = evaluateMainnetActivationSeam(goodSeam());
  assertSafe(clean);
  assert.equal(clean.mainnet_seam_state, 'MAINNET_SEAM_DESCRIPTOR');
  assert.equal(clean.seam_ready, false);
  assert.equal(clean.reasons.includes('unmet_mainnet_req_separate_send_adapter_allowlist_decision'), true);
  // the other six requirements ARE met on the clean maximal input
  for (const t of [
    'MAINNET_REQ_OWNER_GO_DECISION', 'MAINNET_REQ_FUNDED_MAINNET_WALLET',
    'MAINNET_REQ_MAINNET_RPC_ENDPOINT_REF', 'MAINNET_REQ_CAPITAL_LIMIT',
    'MAINNET_REQ_ALL_GATES_GREEN', 'MAINNET_REQ_REAL_LIVE_READY'
  ]) {
    assert.equal(clean.seam_requirements.find((x) => x.requirement === t).met, true, `${t} should be met`);
  }
});

test('(A) a NOT-ready real-live-readiness verdict -> readiness requirement unmet; seam not ready', () => {
  const r = evaluateMainnetActivationSeam(goodSeam({ real_live_readiness: notReadyVerdict }));
  assertSafe(r);
  assert.equal(r.seam_ready, false);
  const readyReq = r.seam_requirements.find((x) => x.requirement === 'MAINNET_REQ_REAL_LIVE_READY');
  assert.equal(readyReq.met, false);
  // a forged ready:true with blockers present is NOT consumed as ready (shape check).
  const forgedReady = evaluateMainnetActivationSeam(goodSeam({ real_live_readiness: { ready: true, blockers: [{ code: 'x' }] } }));
  assert.equal(forgedReady.seam_requirements.find((x) => x.requirement === 'MAINNET_REQ_REAL_LIVE_READY').met, false);
});

test('(A) capital_limit missing / <=0 / Infinity -> requirement met:false; finite>0 -> met:true', () => {
  for (const [cap, met] of [[undefined, false], [0, false], [-5, false], [Infinity, false], [NaN, false], ['100', false], [100, true], [0.01, true]]) {
    const r = evaluateMainnetActivationSeam(goodSeam({ capital_limit: cap }));
    const capReq = r.seam_requirements.find((x) => x.requirement === 'MAINNET_REQ_CAPITAL_LIMIT');
    assert.equal(capReq.met, met, `capital_limit ${String(cap)} -> met ${met}`);
    assert.equal(r.seam_ready, false);
  }
});

test('(A) raw mainnet RPC URL / key / PEM / base58 plants -> refused and ABSENT from JSON', () => {
  const plants = [
    { mainnet_rpc_endpoint_ref: 'https://api.mainnet-beta.solana.com/LEAK' },
    { endpoint_url: 'https://leak.example/rpc' },
    { api_key: 'SECRET-KEY-VALUE-LEAK' },
    { private_key: '-----BEGIN PRIVATE KEY-----LEAKLEAK' },
    { blob: '1'.repeat(70) + 'LEAK' },
    { network: 'mainnet-beta' }
  ];
  for (const p of plants) {
    const r = evaluateMainnetActivationSeam(goodSeam(p));
    assertSafe(r);
    assert.equal(r.mainnet_seam_state, 'MAINNET_SEAM_INVALID');
    assert.equal(r.seam_ready, false);
    const json = JSON.stringify(r);
    assert.equal(json.includes('LEAK'), false, `LEAK present for ${JSON.stringify(p)}`);
    assert.equal(json.includes('leak.example'), false);
    assert.equal(json.includes('mainnet-beta.solana.com'), false);
  }
});

test('(A) opaque endpoint_ref accepted; nested mainnet token -> INVALID', () => {
  const ok = evaluateMainnetActivationSeam(goodSeam({ mainnet_rpc_endpoint_ref: 'rpc-ref-001' }));
  assert.equal(ok.mainnet_seam_state, 'MAINNET_SEAM_DESCRIPTOR');
  const nested = evaluateMainnetActivationSeam(goodSeam({ meta: { network: 'mainnet-beta' } }));
  assert.equal(nested.mainnet_seam_state, 'MAINNET_SEAM_INVALID');
  assert.equal(nested.reasons.includes('mainnet_smuggle_refused'), true);
});

test('(A) smuggled execution command -> INVALID', () => {
  const r1 = evaluateMainnetActivationSeam(goodSeam({ send: true }));
  assert.equal(r1.mainnet_seam_state, 'MAINNET_SEAM_INVALID');
  const r2 = evaluateMainnetActivationSeam(goodSeam({ activate_real_live: true }));
  assert.equal(r2.mainnet_seam_state, 'MAINNET_SEAM_INVALID');
});

// ===========================================================================
// (B) GLOBAL KILL SWITCH — fail-safe engaged when unknown
// ===========================================================================

test('(B) kill engaged when true; default / missing / unknown -> fail-safe ENGAGED; only explicit false disengages', () => {
  const d = describeGlobalKillSwitchContract();
  assertSafe(d);
  assert.equal(d.kill_engaged, true);

  const engaged = evaluateGlobalKillSwitch({ kill_engaged: true });
  assertSafe(engaged);
  assert.equal(engaged.mainnet_kill_state, 'MAINNET_KILL_ENGAGED');
  assert.equal(engaged.kill_engaged, true);

  for (const inp of [undefined, null, {}, { kill_engaged: 'nope' }, { kill_engaged: 1 }, { foo: 'bar' }]) {
    const r = evaluateGlobalKillSwitch(inp);
    assertSafe(r);
    assert.equal(r.mainnet_kill_state, 'MAINNET_KILL_ENGAGED', `default/unknown must be ENGAGED for ${JSON.stringify(inp)}`);
    assert.equal(r.kill_engaged, true);
  }

  const notEngaged = evaluateGlobalKillSwitch({ kill_engaged: false });
  assert.equal(notEngaged.mainnet_kill_state, 'MAINNET_KILL_NOT_ENGAGED');
  assert.equal(notEngaged.kill_engaged, false);
});

// ===========================================================================
// (C) EMERGENCY EXIT — exits-only posture
// ===========================================================================

test('(C) operating_state posture: EXITS_ONLY/KILLED/kill_signal -> ADVISED; ACTIVE -> NOT_ADVISED', () => {
  const d = describeEmergencyExitContract();
  assertSafe(d);
  assert.deepEqual([...d.supported_operating_state_values], ['WARMING_UP', 'ACTIVE', 'EXITS_ONLY', 'PAUSED', 'KILLED']);

  for (const os of ['EXITS_ONLY', 'KILLED', 'WARMING_UP', 'PAUSED']) {
    const r = evaluateEmergencyExit({ operating_state: os });
    assertSafe(r);
    assert.equal(r.mainnet_emergency_exit_state, 'MAINNET_EMERGENCY_EXIT_ADVISED');
    assert.equal(r.exit_only_advisory, true);
  }
  const active = evaluateEmergencyExit({ operating_state: 'ACTIVE' });
  assert.equal(active.mainnet_emergency_exit_state, 'MAINNET_EMERGENCY_EXIT_NOT_ADVISED');
  assert.equal(active.exit_only_advisory, false);
  // ACTIVE but kill_signal -> ADVISED
  const activeKilled = evaluateEmergencyExit({ operating_state: 'ACTIVE', kill_signal: true });
  assert.equal(activeKilled.mainnet_emergency_exit_state, 'MAINNET_EMERGENCY_EXIT_ADVISED');
  // missing -> UNCONFIGURED; unknown -> INVALID
  assert.equal(evaluateEmergencyExit({}).mainnet_emergency_exit_state, 'MAINNET_EMERGENCY_EXIT_UNCONFIGURED');
  assert.equal(evaluateEmergencyExit({ operating_state: 'BOGUS' }).mainnet_emergency_exit_state, 'MAINNET_EMERGENCY_EXIT_INVALID');
  // smuggle -> INVALID
  assert.equal(evaluateEmergencyExit({ operating_state: 'ACTIVE', network: 'mainnet' }).mainnet_emergency_exit_state, 'MAINNET_EMERGENCY_EXIT_INVALID');
});

// ===========================================================================
// (D) SUPPRESSION — always three not_*_authorized tokens
// ===========================================================================

test('(D) ALWAYS suppressed:true with the three not_*_authorized tokens', () => {
  const d = describeMainnetActivationSuppressionContract();
  assertSafe(d);
  assert.equal(d.suppressed, true);
  for (const inp of [undefined, null, {}, { whatever: 1 }]) {
    const r = evaluateMainnetActivationSuppression(inp);
    assertSafe(r);
    assert.equal(r.suppressed, true);
    assert.equal(r.suppression_reasons.includes('not_activate_authorized'), true);
    assert.equal(r.suppression_reasons.includes('not_send_authorized'), true);
    assert.equal(r.suppression_reasons.includes('not_execution_authorized'), true);
  }
  // component codes when unclean
  const seam = evaluateMainnetActivationSeam(goodSeam());
  const killEngaged = evaluateGlobalKillSwitch({ kill_engaged: true });
  const r = evaluateMainnetActivationSuppression({ mainnet_activation_seam: seam, mainnet_kill_switch: killEngaged });
  assert.equal(r.suppression_reasons.includes('mainnet_seam_not_ready'), true);
  assert.equal(r.suppression_reasons.includes('mainnet_kill_engaged'), true);
});

// ===========================================================================
// (E) FORBIDDEN SURFACE GUARD + endpoint_ref shape-check
// ===========================================================================

test('(E) NAME-only redacting guard: blocks key/credential/endpoint/mainnet; ref never echoed', () => {
  const clean = evaluateMainnetForbiddenSurface({ purpose: 'mainnet_activation_seam', capital_limit: 100 });
  assertSafe(clean);
  assert.equal(clean.mainnet_surface_state, 'MAINNET_SURFACE_CLEAN');
  const blocks = [
    [{ private_key: 'LEAKKEY' }, 'key_material_detected'],
    [{ api_key: 'LEAKKEY' }, 'credential_detected'],
    [{ seed: 'LEAKSEED' }, 'key_material_detected'],
    [{ endpoint_url: 'https://leak.example/rpc' }, 'mainnet_surface_detected'],
    [{ network: 'mainnet-beta' }, 'mainnet_detected']
  ];
  for (const [inp, reason] of blocks) {
    const r = evaluateMainnetForbiddenSurface(inp);
    assertSafe(r);
    assert.equal(r.mainnet_surface_state, 'MAINNET_SURFACE_BLOCKED');
    assert.equal(r.forbidden_field_detected, true);
    assert.equal(r.reasons.includes(reason), true);
    const json = JSON.stringify(r);
    assert.equal(json.includes('LEAK'), false);
    assert.equal(json.includes('leak.example'), false);
  }
});

test('(E) isValidMainnetEndpointRef: opaque short token OK; ://, whitespace, >128, base58/PEM/mainnet refused', () => {
  // a bare raw mainnet/prod token (at a word boundary) is conservatively refused.
  assert.equal(isValidMainnetEndpointRef('mainnet-leak'), false);
  assert.equal(isValidMainnetEndpointRef('prod.ref'), false);            // 'prod' token refused
  // an opaque ref WITHOUT a raw mainnet/prod token is accepted.
  assert.equal(isValidMainnetEndpointRef('rpc-ref-001'), true);
  assert.equal(isValidMainnetEndpointRef('https://x/rpc'), false);
  assert.equal(isValidMainnetEndpointRef('has space'), false);
  assert.equal(isValidMainnetEndpointRef('x'.repeat(129)), false);
  assert.equal(isValidMainnetEndpointRef('-----BEGIN KEY'), false);
  assert.equal(isValidMainnetEndpointRef('1'.repeat(64)), false);
  assert.equal(isValidMainnetEndpointRef(42), false);
  assert.equal(isValidMainnetEndpointRef(''), false);
  // a clean opaque endpoint_ref does NOT trip the surface guard
  const r = evaluateMainnetForbiddenSurface({ purpose: 'mainnet_activation_seam', mainnet_rpc_endpoint_ref: 'rpc-ref-001' });
  assert.equal(r.mainnet_surface_state, 'MAINNET_SURFACE_CLEAN');
});

// ===========================================================================
// (F) HEALTH — best state is _SUPPRESSED
// ===========================================================================

const fullHealthInputs = (over = {}) => ({
  mainnet_activation_seam: evaluateMainnetActivationSeam(goodSeam()),
  mainnet_kill_switch: evaluateGlobalKillSwitch({ kill_engaged: false }),
  mainnet_emergency_exit: evaluateEmergencyExit({ operating_state: 'ACTIVE' }),
  mainnet_activation_suppression: evaluateMainnetActivationSuppression({}),
  mainnet_forbidden_surface: evaluateMainnetForbiddenSurface({ purpose: 'mainnet_activation_seam' }),
  real_live_readiness: readyVerdict,
  send_gate_refusal: sendGateRefusal,
  ...over
});

test('(F) clean path -> best state _SUPPRESSED (no ready/activated state exists)', () => {
  const d = describeMainnetActivationHealthContract();
  assertSafe(d);
  assert.deepEqual([...d.supported_states], ['MAINNET_ACTIVATION_HEALTH_UNCONFIGURED', 'MAINNET_ACTIVATION_HEALTH_DEGRADED', 'MAINNET_ACTIVATION_HEALTH_SUPPRESSED', 'MAINNET_ACTIVATION_HEALTH_BLOCKED']);
  // there is NO 'ready'/'activated' state
  for (const s of d.supported_states) {
    assert.equal(/ready|activated/i.test(s), false, `health state must not be ready/activated: ${s}`);
  }
  const r = evaluateMainnetActivationHealth(fullHealthInputs());
  assertSafe(r);
  assert.equal(r.mainnet_activation_health_state, 'MAINNET_ACTIVATION_HEALTH_SUPPRESSED');
});

test('(F) kill engaged / surface blocked / not-ready / component INVALID -> BLOCKED; missing -> UNCONFIGURED', () => {
  const killEngaged = evaluateGlobalKillSwitch({ kill_engaged: true });
  const r1 = evaluateMainnetActivationHealth(fullHealthInputs({ mainnet_kill_switch: killEngaged }));
  assert.equal(r1.mainnet_activation_health_state, 'MAINNET_ACTIVATION_HEALTH_BLOCKED');

  const blockedSurface = evaluateMainnetForbiddenSurface({ private_key: 'X' });
  const r2 = evaluateMainnetActivationHealth(fullHealthInputs({ mainnet_forbidden_surface: blockedSurface }));
  assert.equal(r2.mainnet_activation_health_state, 'MAINNET_ACTIVATION_HEALTH_BLOCKED');

  const r3 = evaluateMainnetActivationHealth(fullHealthInputs({ real_live_readiness: notReadyVerdict }));
  assert.equal(r3.mainnet_activation_health_state, 'MAINNET_ACTIVATION_HEALTH_BLOCKED');

  const invalidSeam = evaluateMainnetActivationSeam(goodSeam({ network: 'mainnet' }));
  const r4 = evaluateMainnetActivationHealth(fullHealthInputs({ mainnet_activation_seam: invalidSeam }));
  assert.equal(r4.mainnet_activation_health_state, 'MAINNET_ACTIVATION_HEALTH_BLOCKED');

  const r5 = evaluateMainnetActivationHealth(fullHealthInputs({ mainnet_activation_seam: undefined }));
  assert.equal(r5.mainnet_activation_health_state, 'MAINNET_ACTIVATION_HEALTH_UNCONFIGURED');

  const r6 = evaluateMainnetActivationHealth(fullHealthInputs({ network: 'mainnet' }));
  assert.equal(r6.mainnet_activation_health_state, 'MAINNET_ACTIVATION_HEALTH_BLOCKED');

  for (const inp of [undefined, null, 'x', 5]) {
    const r = evaluateMainnetActivationHealth(inp);
    assertSafe(r);
    assert.equal(r.mainnet_activation_health_state, 'MAINNET_ACTIVATION_HEALTH_UNCONFIGURED');
  }
});

// ===========================================================================
// Integration consistency: the EXISTING send gate STILL refuses
// ===========================================================================

test('integration: send-gate evaluateSendPreflight STILL ok:false / can_send:false alongside everything', () => {
  const r = evaluateSendPreflight({ sign_only_success: true, readiness_ready: true, preflight_ok: true, custody_status: 'ACTIVE' });
  assert.equal(r.ok, false);
  assert.equal(r.can_send, false);
  assert.equal(r.can_broadcast, false);
  assert.equal(r.blockers.includes('send_gate_unconfigured_no_rpc'), true);
});

// ===========================================================================
// TOCTOU: a counting getter is read exactly once (snapshot-once)
// ===========================================================================

test('TOCTOU: counting getter is read exactly once per evaluation (snapshot-once)', () => {
  let n = 0;
  const hostile = {
    purpose: 'mainnet_activation_seam',
    owner_go_decision_present: true,
    funded_mainnet_wallet_present: true,
    all_gates_green: true,
    capital_limit: 1000,
    real_live_readiness: readyVerdict,
    get mainnet_rpc_endpoint_ref() { n++; return n === 1 ? 'rpc-ref-001' : 'https://leak.example/rpc'; }
  };
  const r = evaluateMainnetActivationSeam(hostile);
  assertSafe(r);
  assert.equal(n, 1, 'mainnet_rpc_endpoint_ref getter must be read exactly once (snapshot-once)');
  // the verdict reflects the single snapshotted (clean) value, and is STILL never ready.
  assert.equal(r.mainnet_seam_state, 'MAINNET_SEAM_DESCRIPTOR');
  assert.equal(r.seam_ready, false);
});

// ===========================================================================
// Static guards: import-free impl, no live network primitive, no can_send:true,
// no module-level mutable state, no new candidate_*, LOCAL MAINNET_* naming.
// ===========================================================================

function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : '';
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; out += ' '; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < n) { const ch = src[i]; if (ch === '\\') { i += 2; continue; } i++; if (ch === q) break; }
      out += q + q; continue;
    }
    out += c; i++;
  }
  return out;
}

test('static guard: src is import-free, carries NO live network primitive, no can_send:true, no mutable module state', () => {
  const files = ['../src/mainnet-activation-seam-foundations.mjs', '../src/index.mjs'].map((p) => fileURLToPath(new URL(p, import.meta.url)));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const code = stripCommentsAndStrings(src);
    assert.equal(/can_send\s*:\s*true/.test(src), false, `${f} must not contain can_send: true`);
    assert.equal(/can_broadcast\s*:\s*true/.test(src), false, `${f} must not contain can_broadcast: true`);
    assert.equal(/seam_ready\s*:\s*true/.test(src), false, `${f} must not contain seam_ready: true`);
    assert.equal(/activation_performed\s*:\s*true/.test(src), false, `${f} must not contain activation_performed: true`);
    assert.equal(/real_live_activated\s*:\s*true/.test(src), false, `${f} must not contain real_live_activated: true`);
    if (f.endsWith('mainnet-activation-seam-foundations.mjs')) {
      assert.equal(/^\s*import\s/m.test(code), false, 'implementation must be import-free');
      assert.equal(/require\s*\(/.test(code), false, 'implementation must not use require(');
      assert.equal(/\b(const|let|var)\s+\w*(records|store|ledger|payload|cache)\w*\s*=\s*\[\s*\]/i.test(code), false, 'no mutable module-level array');
      assert.equal(/fetch\s*\(|XMLHttpRequest|new\s+WebSocket|WebSocket\s*\(|new\s+Connection|sendTransaction|sendRawTransaction|sendAndConfirmTransaction|\.serialize\s*\(|new\s+Socket|\bgrpc\b/.test(code), false, 'no live network/send primitive');
      assert.equal(/signTransaction|partialSign|\bKeypair\b|fromSecretKey|webcrypto|subtle\.sign/.test(code), false, 'no signing/crypto primitive');
      assert.equal(/Date\.now|new\s+Date|process\.env|Math\.random/.test(code), false, 'no clock/env/RNG');
      assert.equal(/candidate_/.test(code), false, 'package declares no candidate_* name in code');
    }
  }
});
