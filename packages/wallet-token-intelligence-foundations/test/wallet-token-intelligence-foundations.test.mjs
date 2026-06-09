// PR-S5-A test suite for @soltrade/wallet-token-intelligence-foundations
// node:test + node:assert/strict. Deterministic. Builds REAL Stage-4 normalized
// events via normalizeIngestionEvent from data-ingestion-foundations.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeWalletObservationIntelligenceContract,
  validateWalletObservationInput,
  evaluateWalletObservationIntelligence,
  describeTokenObservationIntelligenceContract,
  validateTokenObservationInput,
  evaluateTokenObservationIntelligence,
  describeWalletTokenRelationshipContract,
  validateWalletTokenRelationshipInput,
  evaluateWalletTokenRelationship
} from '../src/index.mjs';

import { normalizeIngestionEvent } from '../../data-ingestion-foundations/src/index.mjs';

// keep validate* imports referenced (contract surface) without affecting logic
void validateWalletObservationInput;
void validateTokenObservationInput;
void validateWalletTokenRelationshipInput;

// ---------------------------------------------------------------------------
// REAL Stage-4 normalized event builder
// ---------------------------------------------------------------------------

const mkEvent = (type, ref, wallet, token) => {
  const n = normalizeIngestionEvent({
    event_type: type,
    event_ref: ref,
    source_ref: 'mock_replay',
    observed_at_ref: 'ts',
    wallet_ref: wallet,
    token_ref: token,
    signature_ref: 'sig',
    slot_ref: 1
  });
  return n.normalized_event;
};

const walletEvents = [
  mkEvent('wallet_transaction_observed', 'ev-1', 'w-1', 't-1'),
  mkEvent('swap_observed', 'ev-2', 'w-1', 't-1'),
  mkEvent('mint_observed', 'ev-3', 'w-1', 't-2')
];
const walletInput = { purpose: 'wallet_observation_input', wallet_ref: 'w-1', events: walletEvents, read_only: true };

const tokenInput = {
  purpose: 'token_observation_input',
  token_ref: 't-1',
  events: [
    mkEvent('mint_observed', 'ev-1', 'w-1', 't-1'),
    mkEvent('pool_observed', 'ev-2', 'w-2', 't-1'),
    mkEvent('swap_observed', 'ev-3', 'w-1', 't-1')
  ],
  read_only: true
};

const relInput = {
  purpose: 'wallet_token_relationship_input',
  wallet_ref: 'w-1',
  token_ref: 't-1',
  events: [
    mkEvent('swap_observed', 'ev-1', 'w-1', 't-1'),
    mkEvent('swap_observed', 'ev-2', 'w-1', 't-1')
  ],
  read_only: true
};

// ---------------------------------------------------------------------------
// shared assertion helpers
// ---------------------------------------------------------------------------

const TRADING_FLAGS = [
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'can_send', 'can_broadcast', 'can_serialize', 'signing_permitted',
  'broadcast_permitted', 'is_live', 'mainnet_enabled', 'real_live'
];

function assertAllTradingFlagsFalse(r) {
  for (const f of TRADING_FLAGS) {
    assert.equal(r[f], false, `flag ${f} must be false`);
  }
  assert.equal(r.read_only, true, 'read_only must be true');
}

// hostile Proxy variants: throws-on-get, and get-returns-function
function hostileThrowProxy() {
  return new Proxy({}, { get() { throw new Error('hostile-get'); } });
}
function hostileFnProxy() {
  return new Proxy({}, { get() { return () => {}; } });
}

// ===========================================================================
// WALLET (W1..W11)
// ===========================================================================

test('W1 unconfigured on undefined', () => {
  const r = evaluateWalletObservationIntelligence(undefined);
  assert.equal(r.wallet_observation_state, 'WALLET_OBS_UNCONFIGURED');
});

test('W2 empty events -> degraded', () => {
  const r = evaluateWalletObservationIntelligence({ ...walletInput, events: [] });
  assert.equal(r.wallet_observation_state, 'WALLET_OBS_DEGRADED');
});

test('W3 read-only ok with correct counts/refs', () => {
  const r = evaluateWalletObservationIntelligence(walletInput);
  assert.equal(r.wallet_observation_state, 'WALLET_OBS_READ_ONLY_OK');
  assert.equal(r.observed_event_count, 3);
  assert.equal(r.observed_swap_count, 1);
  assert.equal(r.observed_mint_count, 1);
  assert.equal(r.wallet_ref, 'w-1');
  assert.equal(r.first_observed_ref, 'ev-1');
  assert.equal(r.last_observed_ref, 'ev-3');
});

test('W4 swap observation does NOT become a signal', () => {
  const r = evaluateWalletObservationIntelligence(walletInput);
  assert.equal(r.signal_ready, false);
});

test('W5 mint observation does NOT become a buy signal', () => {
  const r = evaluateWalletObservationIntelligence(walletInput);
  assert.equal(r.signal_ready, false);
  assert.equal(r.trading_ready, false);
});

test('W6 smuggled signal_ready:true -> invalid', () => {
  const r = evaluateWalletObservationIntelligence({ ...walletInput, signal_ready: true });
  assert.equal(r.wallet_observation_state, 'WALLET_OBS_INVALID');
  assert.equal(r.signal_ready, false);
});

test('W7 smuggled buy_opportunity:true -> invalid', () => {
  const r = evaluateWalletObservationIntelligence({ ...walletInput, buy_opportunity: true });
  assert.equal(r.wallet_observation_state, 'WALLET_OBS_INVALID');
  assert.equal(r.trading_ready, false);
});

test('W8 endpoint_url -> invalid AND not echoed', () => {
  const r = evaluateWalletObservationIntelligence({ ...walletInput, endpoint_url: 'https://rpc.example' });
  assert.equal(r.wallet_observation_state, 'WALLET_OBS_INVALID');
  assert.ok(!JSON.stringify(r).includes('rpc.example'), 'endpoint host must not be echoed');
});

test('W9 api_key -> invalid AND not echoed', () => {
  const r = evaluateWalletObservationIntelligence({ ...walletInput, api_key: 'SECRET123' });
  assert.equal(r.wallet_observation_state, 'WALLET_OBS_INVALID');
  assert.ok(!JSON.stringify(r).includes('SECRET123'), 'secret must not be echoed');
});

test('W10 hostile Proxy -> frozen unconfigured, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateWalletObservationIntelligence(p); });
    assert.equal(r.wallet_observation_state, 'WALLET_OBS_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
    assertAllTradingFlagsFalse(r);
  }
});

test('W11 all trading flags false across all states', () => {
  const states = [
    evaluateWalletObservationIntelligence(undefined),                       // UNCONFIGURED
    evaluateWalletObservationIntelligence({ ...walletInput, signal_ready: true }), // INVALID
    evaluateWalletObservationIntelligence({ ...walletInput, events: [] }),   // DEGRADED
    evaluateWalletObservationIntelligence(walletInput)                       // READ_ONLY_OK
  ];
  const seen = new Set(states.map((s) => s.wallet_observation_state));
  assert.ok(seen.has('WALLET_OBS_UNCONFIGURED'));
  assert.ok(seen.has('WALLET_OBS_INVALID'));
  assert.ok(seen.has('WALLET_OBS_DEGRADED'));
  assert.ok(seen.has('WALLET_OBS_READ_ONLY_OK'));
  for (const r of states) assertAllTradingFlagsFalse(r);
});

// ===========================================================================
// TOKEN (T1..T9)
// ===========================================================================

test('T1 unconfigured on undefined', () => {
  const r = evaluateTokenObservationIntelligence(undefined);
  assert.equal(r.token_observation_state, 'TOKEN_OBS_UNCONFIGURED');
});

test('T2 read-only ok with correct counts (incl 2 distinct wallets)', () => {
  const r = evaluateTokenObservationIntelligence(tokenInput);
  assert.equal(r.token_observation_state, 'TOKEN_OBS_READ_ONLY_OK');
  assert.equal(r.observed_mint_count, 1);
  assert.equal(r.observed_pool_count, 1);
  assert.equal(r.observed_swap_count, 1);
  assert.equal(r.observed_wallet_count, 2);
});

test('T3 pool/mint observation does NOT become opportunity execution', () => {
  const r = evaluateTokenObservationIntelligence(tokenInput);
  assert.equal(r.signal_ready, false);
  assert.equal(r.trading_ready, false);
});

test('T4 accepted MUST NOT open trading', () => {
  const r = evaluateTokenObservationIntelligence({ ...tokenInput, accepted: true });
  assert.equal(r.trading_ready, false);
});

test('T5 buy_opportunity:true -> invalid', () => {
  const r = evaluateTokenObservationIntelligence({ ...tokenInput, buy_opportunity: true });
  assert.equal(r.token_observation_state, 'TOKEN_OBS_INVALID');
});

test('T6 execute_opportunity:true -> invalid', () => {
  const r = evaluateTokenObservationIntelligence({ ...tokenInput, execute_opportunity: true });
  assert.equal(r.token_observation_state, 'TOKEN_OBS_INVALID');
});

test('T7 submit_opportunity:true -> invalid', () => {
  const r = evaluateTokenObservationIntelligence({ ...tokenInput, submit_opportunity: true });
  assert.equal(r.token_observation_state, 'TOKEN_OBS_INVALID');
});

test('T8 secret/endpoint -> invalid AND not echoed', () => {
  const rk = evaluateTokenObservationIntelligence({ ...tokenInput, api_key: 'SECRET123' });
  assert.equal(rk.token_observation_state, 'TOKEN_OBS_INVALID');
  assert.ok(!JSON.stringify(rk).includes('SECRET123'));
  const re = evaluateTokenObservationIntelligence({ ...tokenInput, endpoint_url: 'https://rpc.example' });
  assert.equal(re.token_observation_state, 'TOKEN_OBS_INVALID');
  assert.ok(!JSON.stringify(re).includes('rpc.example'));
});

test('T9 hostile Proxy -> frozen unconfigured; flags false across states', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateTokenObservationIntelligence(p); });
    assert.equal(r.token_observation_state, 'TOKEN_OBS_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
    assertAllTradingFlagsFalse(r);
  }
  const states = [
    evaluateTokenObservationIntelligence(undefined),
    evaluateTokenObservationIntelligence({ ...tokenInput, buy_opportunity: true }),
    evaluateTokenObservationIntelligence({ ...tokenInput, events: [] }),
    evaluateTokenObservationIntelligence(tokenInput)
  ];
  for (const r of states) assertAllTradingFlagsFalse(r);
});

// ===========================================================================
// RELATIONSHIP (R1..R9)
// ===========================================================================

test('R1 unconfigured on undefined', () => {
  const r = evaluateWalletTokenRelationship(undefined);
  assert.equal(r.relationship_state, 'RELATIONSHIP_UNCONFIGURED');
});

test('R2 missing token_ref -> not read-only-ok', () => {
  const { token_ref, ...noToken } = relInput;
  void token_ref;
  const r = evaluateWalletTokenRelationship(noToken);
  assert.notEqual(r.relationship_state, 'RELATIONSHIP_READ_ONLY_OK');
});

test('R3 read-only ok with counts/types/refs', () => {
  const r = evaluateWalletTokenRelationship(relInput);
  assert.equal(r.relationship_state, 'RELATIONSHIP_READ_ONLY_OK');
  assert.equal(r.relationship_event_count, 2);
  assert.ok(r.observed_interaction_types.includes('swap_observed'));
  assert.equal(r.wallet_ref, 'w-1');
  assert.equal(r.token_ref, 't-1');
});

test('R4 repeated interactions do NOT become a copy signal', () => {
  const r = evaluateWalletTokenRelationship(relInput);
  assert.equal(r.signal_ready, false);
});

test('R5 early observation does NOT become early-buyer signal', () => {
  const r = evaluateWalletTokenRelationship(relInput);
  assert.ok(!('early_buyer' in r), 'no early_buyer field');
  assert.ok(!('copy' in r), 'no copy field');
  assert.equal(r.signal_ready, false);
});

test('R6 smuggled copy_signal/risk_ready/intent_ready -> invalid', () => {
  for (const k of ['copy_signal', 'risk_ready', 'intent_ready']) {
    const r = evaluateWalletTokenRelationship({ ...relInput, [k]: true });
    assert.equal(r.relationship_state, 'RELATIONSHIP_INVALID', `key ${k} must invalidate`);
    assert.notEqual(r[k], true, `smuggled ${k} must never surface as true`);
  }
});

test('R7 endpoint/secret -> invalid AND not echoed', () => {
  const re = evaluateWalletTokenRelationship({ ...relInput, endpoint_url: 'https://rpc.example' });
  assert.equal(re.relationship_state, 'RELATIONSHIP_INVALID');
  assert.ok(!JSON.stringify(re).includes('rpc.example'));
  const rk = evaluateWalletTokenRelationship({ ...relInput, api_key: 'SECRET123' });
  assert.equal(rk.relationship_state, 'RELATIONSHIP_INVALID');
  assert.ok(!JSON.stringify(rk).includes('SECRET123'));
});

test('R8 hostile Proxy -> frozen unconfigured, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateWalletTokenRelationship(p); });
    assert.equal(r.relationship_state, 'RELATIONSHIP_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
  }
});

test('R9 all flags false across states; read_only true', () => {
  const states = [
    evaluateWalletTokenRelationship(undefined),
    evaluateWalletTokenRelationship({ ...relInput, copy_signal: true }),
    evaluateWalletTokenRelationship({ ...relInput, events: [] }),
    evaluateWalletTokenRelationship(relInput)
  ];
  for (const r of states) assertAllTradingFlagsFalse(r);
});

// ===========================================================================
// DESCRIPTORS (G1..G3)
// ===========================================================================

test('G1 wallet descriptor frozen, read-only, no signal/trading', () => {
  const d = describeWalletObservationIntelligenceContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.signal_ready, false);
  assert.equal(d.trading_ready, false);
});

test('G2 token descriptor frozen, read-only, no signal/trading', () => {
  const d = describeTokenObservationIntelligenceContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.signal_ready, false);
  assert.equal(d.trading_ready, false);
});

test('G3 relationship descriptor frozen, read-only, no signal/trading', () => {
  const d = describeWalletTokenRelationshipContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.read_only, true);
  assert.equal(d.signal_ready, false);
  assert.equal(d.trading_ready, false);
});

// ===========================================================================
// STATIC (S1..S4)
// ===========================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dir, '..', 'src', 'wallet-token-intelligence-foundations.mjs');
const PKG = join(__dir, '..', 'package.json');

test('S1 src is import-free', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/^\s*import\s/m.test(src), 'no import statements');
  assert.ok(!/\bimport\s*\(/.test(src), 'no dynamic import()');
  assert.ok(!/\brequire\s*\(/.test(src), 'no require()');
});

test('S2 no network/clock/persistence primitives', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch(');
  assert.ok(!/new\s+WebSocket/.test(src), 'no new WebSocket');
  assert.ok(!/new\s+Connection/.test(src), 'no new Connection');
  assert.ok(!/sendTransaction/.test(src), 'no sendTransaction');
  assert.ok(!/process\.env/.test(src), 'no process.env');
  assert.ok(!/readFileSync/.test(src), 'no readFileSync');
  assert.ok(!/node:fs/.test(src), 'no node:fs');
  assert.ok(!/Date\.now/.test(src), 'no Date.now');
  assert.ok(!/new\s+Date/.test(src), 'no new Date');
});

test('S3 package.json has no dependencies', () => {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
  const deps = pkg.dependencies || {};
  assert.equal(Object.keys(deps).length, 0, 'no dependencies');
});

test('S4 no real endpoint URL host in src', () => {
  const src = readFileSync(SRC, 'utf8');
  // no http(s)/ws(s) literal with a host (the regex SOURCE patterns are escaped, not literal URLs)
  assert.ok(!/['"`]https?:\/\/[a-z0-9.-]+/i.test(src), 'no literal http(s) URL host');
  assert.ok(!/['"`]wss?:\/\/[a-z0-9.-]+/i.test(src), 'no literal ws(s) URL host');
});

// ===========================================================================
// PR-S5-B: DIAGNOSTICS + INTELLIGENCE HEALTH
// ===========================================================================

import {
  describeWalletTokenDiagnosticsContract,
  evaluateWalletTokenDiagnostics,
  describeIntelligenceHealthContract,
  evaluateIntelligenceHealth
} from '../src/index.mjs';

// REAL component-result builders (independent from the PR-S5-A fixtures above)
const mk = (type, ref, w, t) => normalizeIngestionEvent({
  event_type: type,
  event_ref: ref,
  source_ref: 'mock_replay',
  observed_at_ref: 'ts',
  wallet_ref: w,
  token_ref: t,
  signature_ref: 'sig',
  slot_ref: 1
}).normalized_event;

const wOk = evaluateWalletObservationIntelligence({
  purpose: 'wallet_observation_input',
  wallet_ref: 'w-1',
  events: [mk('swap_observed', 'e1', 'w-1', 't-1'), mk('mint_observed', 'e2', 'w-1', 't-2')],
  read_only: true
});
const tOk = evaluateTokenObservationIntelligence({
  purpose: 'token_observation_input',
  token_ref: 't-1',
  events: [mk('mint_observed', 'e1', 'w-1', 't-1'), mk('pool_observed', 'e2', 'w-2', 't-1')],
  read_only: true
});
const rOk = evaluateWalletTokenRelationship({
  purpose: 'wallet_token_relationship_input',
  wallet_ref: 'w-1',
  token_ref: 't-1',
  events: [mk('swap_observed', 'e1', 'w-1', 't-1'), mk('mint_observed', 'e2', 'w-1', 't-1')],
  read_only: true
});
const dOk = evaluateWalletTokenDiagnostics({
  purpose: 'wallet_token_diagnostics_input',
  wallet_observation: wOk,
  token_observation: tOk,
  relationship: rOk
});
const allGood = { wallet_observation: wOk, token_observation: tOk, relationship: rOk, diagnostics: dOk };
const diagInputGood = { purpose: 'wallet_token_diagnostics_input', wallet_observation: wOk, token_observation: tOk, relationship: rOk };

const wEmpty = evaluateWalletObservationIntelligence({ purpose: 'wallet_observation_input', wallet_ref: 'w-1', events: [], read_only: true });
const tEmpty = evaluateTokenObservationIntelligence({ purpose: 'token_observation_input', token_ref: 't-1', events: [], read_only: true });
const rEmpty = evaluateWalletTokenRelationship({ purpose: 'wallet_token_relationship_input', wallet_ref: 'w-1', token_ref: 't-1', events: [], read_only: true });

const DIAG_ALLOWLIST = new Set([
  'insufficient_observations', 'mixed_event_types_observed', 'token_activity_observed',
  'wallet_activity_observed', 'relationship_observed', 'diagnostic_only'
]);

// --- DIAGNOSTICS (D1..D12) ---

test('D1 undefined -> DIAGNOSTICS_UNCONFIGURED', () => {
  assert.equal(evaluateWalletTokenDiagnostics(undefined).diagnostics_state, 'DIAGNOSTICS_UNCONFIGURED');
});

test('D2 read-only-ok with diagnostic_only tag', () => {
  assert.equal(dOk.diagnostics_state, 'DIAGNOSTICS_READ_ONLY_OK');
  assert.ok(Array.isArray(dOk.diagnostics));
  assert.ok(dOk.diagnostics.includes('diagnostic_only'));
});

test('D3 activity tags present', () => {
  assert.ok(dOk.diagnostics.includes('wallet_activity_observed'));
  assert.ok(dOk.diagnostics.includes('token_activity_observed'));
  assert.ok(dOk.diagnostics.includes('relationship_observed'));
});

test('D4 insufficient observations tag', () => {
  const r = evaluateWalletTokenDiagnostics({
    purpose: 'wallet_token_diagnostics_input',
    wallet_observation: wEmpty,
    token_observation: tEmpty,
    relationship: rEmpty
  });
  assert.ok(r.diagnostics.includes('insufficient_observations'));
});

test('D5 every tag in allowlist', () => {
  for (const tag of dOk.diagnostics) {
    assert.ok(DIAG_ALLOWLIST.has(tag), `tag ${tag} must be allowlisted`);
  }
});

test('D6 diagnostic does NOT open signal_ready', () => {
  assert.equal(dOk.signal_ready, false);
});

test('D7 diagnostic does NOT open trading_ready', () => {
  assert.equal(dOk.trading_ready, false);
});

test('D8 diagnostic does NOT open can_send', () => {
  assert.equal(dOk.can_send, false);
});

test('D9 smuggled forbidden flag on input -> INVALID', () => {
  const r = evaluateWalletTokenDiagnostics({ ...diagInputGood, signal_ready: true });
  assert.equal(r.diagnostics_state, 'DIAGNOSTICS_INVALID');
  assert.equal(r.signal_ready, false);
});

test('D10 smuggled forbidden flag inside component -> INVALID', () => {
  const r = evaluateWalletTokenDiagnostics({
    purpose: 'wallet_token_diagnostics_input',
    wallet_observation: { ...wOk, trading_ready: true },
    token_observation: tOk,
    relationship: rOk
  });
  assert.equal(r.diagnostics_state, 'DIAGNOSTICS_INVALID');
});

test('D11 hostile Proxy -> frozen UNCONFIGURED, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateWalletTokenDiagnostics(p); });
    assert.equal(r.diagnostics_state, 'DIAGNOSTICS_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
    assertAllTradingFlagsFalse(r);
  }
});

test('D12 result frozen + diagnostic_only true', () => {
  assert.ok(Object.isFrozen(dOk));
  assert.equal(dOk.diagnostic_only, true);
});

// --- HEALTH (H1..H12) ---

const HEALTH_TRADING_FLAGS = [
  'signal_ready', 'trading_ready', 'risk_ready', 'intent_ready', 'routing_ready',
  'can_send', 'can_broadcast', 'can_serialize', 'signing_permitted',
  'broadcast_permitted', 'is_live', 'mainnet_enabled', 'real_live'
];

test('H1 undefined -> INTELLIGENCE_UNCONFIGURED', () => {
  assert.equal(evaluateIntelligenceHealth(undefined).intelligence_state, 'INTELLIGENCE_UNCONFIGURED');
});

test('H2 missing a component -> INTELLIGENCE_UNCONFIGURED', () => {
  const { diagnostics, ...noDiag } = allGood;
  void diagnostics;
  assert.equal(evaluateIntelligenceHealth(noDiag).intelligence_state, 'INTELLIGENCE_UNCONFIGURED');
});

test('H3 allGood -> INTELLIGENCE_READY_READ_ONLY', () => {
  const r = evaluateIntelligenceHealth(allGood);
  assert.equal(r.intelligence_state, 'INTELLIGENCE_READY_READ_ONLY');
  assert.equal(r.intelligence_ready_read_only, true);
});

test('H4 INVALID component -> INTELLIGENCE_BLOCKED', () => {
  const wInvalid = evaluateWalletObservationIntelligence({
    purpose: 'wallet_observation_input',
    wallet_ref: 'w-1',
    events: [mk('swap_observed', 'e1', 'w-1', 't-1')],
    read_only: true,
    buy_opportunity: true
  });
  assert.equal(wInvalid.wallet_observation_state, 'WALLET_OBS_INVALID');
  const r = evaluateIntelligenceHealth({ ...allGood, wallet_observation: wInvalid });
  assert.equal(r.intelligence_state, 'INTELLIGENCE_BLOCKED');
});

test('H5 DEGRADED component -> INTELLIGENCE_DEGRADED', () => {
  assert.equal(wEmpty.wallet_observation_state, 'WALLET_OBS_DEGRADED');
  const r = evaluateIntelligenceHealth({ ...allGood, wallet_observation: wEmpty });
  assert.equal(r.intelligence_state, 'INTELLIGENCE_DEGRADED');
});

test('H6 smuggled top-level forbidden flag -> INTELLIGENCE_BLOCKED', () => {
  const r = evaluateIntelligenceHealth({ ...allGood, can_send: true });
  assert.equal(r.intelligence_state, 'INTELLIGENCE_BLOCKED');
});

test('H7 smuggled forbidden flag inside component -> INTELLIGENCE_BLOCKED', () => {
  const r = evaluateIntelligenceHealth({ ...allGood, token_observation: { ...tOk, signal_ready: true } });
  assert.equal(r.intelligence_state, 'INTELLIGENCE_BLOCKED');
});

test('H8 all trading flags false + read_only across all states', () => {
  const noDiag = { wallet_observation: wOk, token_observation: tOk, relationship: rOk };
  const results = [
    evaluateIntelligenceHealth(undefined),                                   // UNCONFIGURED
    evaluateIntelligenceHealth({ ...allGood, wallet_observation: wEmpty }),   // DEGRADED
    evaluateIntelligenceHealth(allGood),                                     // READY_READ_ONLY
    evaluateIntelligenceHealth({ ...allGood, can_send: true })               // BLOCKED
  ];
  void noDiag;
  const seen = new Set(results.map((r) => r.intelligence_state));
  assert.ok(seen.has('INTELLIGENCE_UNCONFIGURED'));
  assert.ok(seen.has('INTELLIGENCE_DEGRADED'));
  assert.ok(seen.has('INTELLIGENCE_READY_READ_ONLY'));
  assert.ok(seen.has('INTELLIGENCE_BLOCKED'));
  for (const r of results) {
    for (const f of HEALTH_TRADING_FLAGS) assert.equal(r[f], false, `flag ${f} must be false`);
    assert.equal(r.read_only, true, 'read_only must be true');
  }
});

test('H9 NO-ECHO: leaked field not in result JSON', () => {
  const r = evaluateIntelligenceHealth({ ...allGood, leaked_marker_field: 'LEAK_TOKEN_XYZ' });
  assert.ok(!JSON.stringify(r).includes('LEAK_TOKEN_XYZ'), 'leaked field must not be echoed');
  assert.ok(!JSON.stringify(r).includes('leaked_marker_field'));
});

test('H10 hostile Proxy -> frozen UNCONFIGURED, no throw', () => {
  for (const p of [hostileThrowProxy(), hostileFnProxy()]) {
    let r;
    assert.doesNotThrow(() => { r = evaluateIntelligenceHealth(p); });
    assert.equal(r.intelligence_state, 'INTELLIGENCE_UNCONFIGURED');
    assert.ok(Object.isFrozen(r));
  }
});

test('H11 health descriptor frozen, no signal/trading', () => {
  const d = describeIntelligenceHealthContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.signal_ready, false);
  assert.equal(d.trading_ready, false);
});

test('H12 diagnostics descriptor frozen, diagnostic_only + advisory_only', () => {
  const d = describeWalletTokenDiagnosticsContract();
  assert.ok(Object.isFrozen(d));
  assert.equal(d.diagnostic_only, true);
  assert.equal(d.advisory_only, true);
});

// --- STATIC (S5..S7) ---

test('S5 src still import-free (incl appended region)', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/^\s*import\s/m.test(src), 'no import statements');
  assert.ok(!/\bimport\s*\(/.test(src), 'no dynamic import()');
  assert.ok(!/\brequire\s*\(/.test(src), 'no require()');
});

test('S6 appended region has no network/clock/persistence primitives', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch(');
  assert.ok(!/new\s+WebSocket/.test(src), 'no new WebSocket');
  assert.ok(!/new\s+Connection/.test(src), 'no new Connection');
  assert.ok(!/sendTransaction/.test(src), 'no sendTransaction');
  assert.ok(!/process\.env/.test(src), 'no process.env');
  assert.ok(!/readFileSync/.test(src), 'no readFileSync');
  assert.ok(!/node:fs/.test(src), 'no node:fs');
  assert.ok(!/Date\.now/.test(src), 'no Date.now');
  assert.ok(!/new\s+Date/.test(src), 'no new Date');
});

test('S7 no "can_send: true" anywhere in src', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/can_send\s*:\s*true/.test(src), 'no can_send: true literal');
});
