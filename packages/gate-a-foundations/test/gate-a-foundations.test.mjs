// PR-S3-A test-agent proofs for @soltrade/gate-a-foundations.
// Read-only Gate-A Config Validation + Audit Path. Deterministic, no I/O beyond
// reading the package source for STATIC GUARDS. Asserts: fail-closed states,
// no secret echo, hostile-input refusal (frozen, no throw), and that NO result
// ever opens trading readiness.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  describeGateAConfigValidationContract,
  validateGateAConfig,
  evaluateGateAConfigReadiness,
  describeGateAAuditPathContract,
  validateGateAAuditEnvelope,
  evaluateGateAAuditPath
} from '../src/index.mjs';

// PR-S3-B: the four new Gate-A readiness-aggregator + status-shell functions.
import {
  describeGateAReadinessAggregatorContract,
  evaluateGateAReadiness,
  describeGateAStatusShellContract,
  evaluateGateAStatusShell
} from '../src/index.mjs';

// REAL Stage-2 producers from the rpc-provider-contract package (no network).
import {
  evaluateRpcHealthFromSpike,
  evaluateProtocolConstantHealth,
  evaluateLiveTestnetRpcReadOnlySpike
} from '../../rpc-provider-contract/src/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src', 'gate-a-foundations.mjs');
const PKG_JSON = join(HERE, '..', 'package.json');

// The 11 invariant flags that must NEVER be true in any result.
const INVARIANT_FLAGS = [
  'trading_ready',
  'can_send',
  'can_broadcast',
  'can_serialize',
  'signing_permitted',
  'routing_ready',
  'broadcast_permitted',
  'real_live',
  'is_live',
  'mainnet_enabled',
  'has_rpc'
];

function assertAllInvariantsFalse(result, ctx) {
  for (const f of INVARIANT_FLAGS) {
    assert.equal(result[f], false, `${ctx}: ${f} must be false`);
  }
}

// A Proxy whose every property get throws — exercises the hostile/throwing path.
function hostileProxy() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('hostile get');
      },
      has() {
        throw new Error('hostile has');
      },
      ownKeys() {
        throw new Error('hostile ownKeys');
      }
    }
  );
}

const goodCfg = {
  hard_risk_limits_defined: true,
  signer_isolation_declared: true,
  environment_declared: true,
  environment: 'devnet'
};

// ---------------------------------------------------------------------------
// CONFIG (C1..C12)
// ---------------------------------------------------------------------------

test('C1 undefined config -> CONFIG_UNCONFIGURED', () => {
  assert.equal(
    evaluateGateAConfigReadiness(undefined).config_state,
    'CONFIG_UNCONFIGURED'
  );
});

test('C2 null config -> CONFIG_UNCONFIGURED', () => {
  assert.equal(
    evaluateGateAConfigReadiness(null).config_state,
    'CONFIG_UNCONFIGURED'
  );
});

test('C3 {} -> CONFIG_UNCONFIGURED (no required attestations)', () => {
  assert.equal(
    evaluateGateAConfigReadiness({}).config_state,
    'CONFIG_UNCONFIGURED'
  );
});

test('C4 partial config -> CONFIG_DEGRADED', () => {
  assert.equal(
    evaluateGateAConfigReadiness({ hard_risk_limits_defined: true }).config_state,
    'CONFIG_DEGRADED'
  );
});

test('C5 goodCfg -> CONFIG_VALID_READ_ONLY && config_valid_read_only', () => {
  const r = evaluateGateAConfigReadiness(goodCfg);
  assert.equal(r.config_state, 'CONFIG_VALID_READ_ONLY');
  assert.equal(r.config_valid_read_only, true);
});

test('C6 can_send smuggled -> CONFIG_INVALID', () => {
  assert.equal(
    evaluateGateAConfigReadiness({ ...goodCfg, can_send: true }).config_state,
    'CONFIG_INVALID'
  );
});

test('C7 real_live smuggled -> CONFIG_INVALID', () => {
  assert.equal(
    evaluateGateAConfigReadiness({ ...goodCfg, real_live: true }).config_state,
    'CONFIG_INVALID'
  );
});

test('C8 mainnet environment -> CONFIG_INVALID', () => {
  assert.equal(
    evaluateGateAConfigReadiness({ ...goodCfg, environment: 'mainnet' })
      .config_state,
    'CONFIG_INVALID'
  );
});

test('C9 api_key field -> CONFIG_INVALID and secret not echoed', () => {
  const r = evaluateGateAConfigReadiness({ ...goodCfg, api_key: 'SECRET123' });
  assert.equal(r.config_state, 'CONFIG_INVALID');
  assert.equal(JSON.stringify(r).includes('SECRET123'), false);
});

test('C10 auth_token field -> CONFIG_INVALID and token not echoed', () => {
  const r = evaluateGateAConfigReadiness({ ...goodCfg, auth_token: 'tok-abc' });
  assert.equal(r.config_state, 'CONFIG_INVALID');
  assert.equal(JSON.stringify(r).includes('tok-abc'), false);
});

test('C11 hostile Proxy -> frozen CONFIG_UNCONFIGURED, no throw', () => {
  let r;
  assert.doesNotThrow(() => {
    r = evaluateGateAConfigReadiness(hostileProxy());
  });
  assert.equal(r.config_state, 'CONFIG_UNCONFIGURED');
  assert.equal(Object.isFrozen(r), true);
});

test('C12 all invariant flags false across every config state', () => {
  const states = [
    evaluateGateAConfigReadiness(undefined), // UNCONFIGURED
    evaluateGateAConfigReadiness({ ...goodCfg, can_send: true }), // INVALID
    evaluateGateAConfigReadiness({ hard_risk_limits_defined: true }), // DEGRADED
    evaluateGateAConfigReadiness(goodCfg) // VALID_READ_ONLY
  ];
  const seen = new Set(states.map((s) => s.config_state));
  assert.equal(seen.has('CONFIG_UNCONFIGURED'), true);
  assert.equal(seen.has('CONFIG_INVALID'), true);
  assert.equal(seen.has('CONFIG_DEGRADED'), true);
  assert.equal(seen.has('CONFIG_VALID_READ_ONLY'), true);
  for (const r of states) assertAllInvariantsFalse(r, r.config_state);
});

// ---------------------------------------------------------------------------
// AUDIT (D1..D12)
// ---------------------------------------------------------------------------

const goodEnv = {
  purpose: 'gate_a_audit_envelope',
  decision_ref: 'dec-1',
  actor_ref: 'actor-1',
  reason_code: 'GATE_A_READY',
  created_at_ref: 'ts-ref-1',
  audit_required: true,
  no_secret_material: true,
  no_private_key_material: true,
  no_live_execution: true
};

test('D1 undefined envelope -> AUDIT_UNCONFIGURED', () => {
  assert.equal(
    evaluateGateAAuditPath(undefined).audit_state,
    'AUDIT_UNCONFIGURED'
  );
});

test('D2 {} -> AUDIT_INVALID (missing required refs => hidden decision)', () => {
  assert.equal(evaluateGateAAuditPath({}).audit_state, 'AUDIT_INVALID');
});

test('D3 goodEnv -> AUDIT_PATH_VALID && audit_path_valid', () => {
  const r = evaluateGateAAuditPath(goodEnv);
  assert.equal(r.audit_state, 'AUDIT_PATH_VALID');
  assert.equal(r.audit_path_valid, true);
});

test('D4 missing decision_ref -> AUDIT_INVALID', () => {
  assert.equal(
    evaluateGateAAuditPath({ ...goodEnv, decision_ref: undefined }).audit_state,
    'AUDIT_INVALID'
  );
});

test('D5 missing reason_code -> AUDIT_INVALID', () => {
  assert.equal(
    evaluateGateAAuditPath({ ...goodEnv, reason_code: undefined }).audit_state,
    'AUDIT_INVALID'
  );
});

test('D6 audit_required:false -> NOT valid (degraded or invalid)', () => {
  const r = evaluateGateAAuditPath({ ...goodEnv, audit_required: false });
  assert.notEqual(r.audit_state, 'AUDIT_PATH_VALID');
  assert.equal(r.audit_path_valid, false);
});

test('D7 no_secret_material:false -> NOT valid', () => {
  const r = evaluateGateAAuditPath({ ...goodEnv, no_secret_material: false });
  assert.equal(r.audit_path_valid, false);
});

test('D8 private_key secret field -> AUDIT_INVALID and key not echoed', () => {
  const keyVal = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
  const r = evaluateGateAAuditPath({ ...goodEnv, private_key: keyVal });
  assert.equal(r.audit_state, 'AUDIT_INVALID');
  assert.equal(JSON.stringify(r).includes(keyVal), false);
});

test('D9 can_send smuggled execution flag -> AUDIT_INVALID', () => {
  assert.equal(
    evaluateGateAAuditPath({ ...goodEnv, can_send: true }).audit_state,
    'AUDIT_INVALID'
  );
});

test('D10 auth_token field -> AUDIT_INVALID and not echoed', () => {
  const r = evaluateGateAAuditPath({ ...goodEnv, auth_token: 't' });
  assert.equal(r.audit_state, 'AUDIT_INVALID');
  assert.equal(JSON.stringify(r).includes('"auth_token"'), false);
});

test('D11 hostile Proxy -> frozen AUDIT_UNCONFIGURED, no throw', () => {
  let r;
  assert.doesNotThrow(() => {
    r = evaluateGateAAuditPath(hostileProxy());
  });
  assert.equal(r.audit_state, 'AUDIT_UNCONFIGURED');
  assert.equal(Object.isFrozen(r), true);
});

test('D12 all invariant flags false across every audit result', () => {
  const results = [
    evaluateGateAAuditPath(undefined), // UNCONFIGURED
    evaluateGateAAuditPath({}), // INVALID
    evaluateGateAAuditPath({ ...goodEnv, audit_required: false }), // degraded/invalid
    evaluateGateAAuditPath(goodEnv), // PATH_VALID
    validateGateAAuditEnvelope(goodEnv)
  ];
  for (const r of results) assertAllInvariantsFalse(r, r.audit_state || 'validate');
});

// ---------------------------------------------------------------------------
// DESCRIPTORS (G1..G2)
// ---------------------------------------------------------------------------

test('G1 config contract descriptor', () => {
  const d = describeGateAConfigValidationContract();
  assert.equal(d.config_state, 'CONFIG_UNCONFIGURED');
  assert.equal(d.can_send, false);
  assert.equal(d.trading_ready, false);
  assert.equal(d.read_only, true);
  assert.equal(Object.isFrozen(d), true);
});

test('G2 audit contract descriptor', () => {
  const d = describeGateAAuditPathContract();
  assert.equal(d.audit_state, 'AUDIT_UNCONFIGURED');
  assert.equal(d.can_send, false);
  assert.equal(Object.isFrozen(d), true);
});

// ---------------------------------------------------------------------------
// STATIC GUARDS (S1..S4) — inspect the package source itself
// ---------------------------------------------------------------------------

test('S1 source is import-free', () => {
  const src = readFileSync(SRC, 'utf8');
  for (const line of src.split(/\r?\n/)) {
    assert.equal(/^import\s/.test(line), false, `import line: ${line}`);
    assert.equal(/require\(/.test(line), false, `require call: ${line}`);
  }
});

test('S2 no network/io/clock primitives in source', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.equal(/fetch\(/.test(src), false, 'fetch(');
  assert.equal(/new\s+WebSocket/.test(src), false, 'new WebSocket');
  assert.equal(/new\s+Connection/.test(src), false, 'new Connection');
  assert.equal(/sendTransaction/.test(src), false, 'sendTransaction');
  assert.equal(/process\.env/.test(src), false, 'process.env');
  assert.equal(/readFileSync/.test(src), false, 'readFileSync');
  assert.equal(/node:fs/.test(src), false, 'node:fs');
  assert.equal(/Date\.now/.test(src), false, 'Date.now');
  assert.equal(/new\s+Date/.test(src), false, 'new Date');
});

test('S3 package.json has no dependencies/devDependencies', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'));
  assert.equal('dependencies' in pkg, false, 'dependencies present');
  assert.equal('devDependencies' in pkg, false, 'devDependencies present');
});

test('S4 no real endpoint URL host in source', () => {
  const src = readFileSync(SRC, 'utf8');
  assert.equal(/https?:\/\/[a-z0-9]/i.test(src), false, 'endpoint URL host');
});

// ===========================================================================
// PR-S3-B — GATE-A READINESS AGGREGATOR (E1..E14) + STATUS SHELL (F1..F12)
// Uses REAL Stage-2 producers (rpc-provider-contract) + REAL Gate-A config/
// audit evaluators. No network: in-memory fake caller drives the F17 spike.
// ===========================================================================

// --- REAL canonical valid records (same shapes used in F17 tests). ---
const F14rec = Object.freeze({
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
  requires_post_spike_revoke_or_disable: true
});
const F15rec = Object.freeze({
  purpose: 'rpc_client_supply_chain_review',
  client_ref: 'rpc-client-pkg',
  client_version: '1.2.3',
  no_network: true,
  no_send: true,
  no_broadcast: true,
  no_serialize: true,
  no_mainnet: true,
  no_real_live: true,
  requires_lockfile_review: true,
  requires_supply_chain_review: true,
  requires_separate_integration_pr: true,
  requires_pinned_version: true
});
const F16rec = Object.freeze({
  purpose: 'out_of_repo_endpoint_binding_adapter',
  provider_ref: 'helius',
  environment: 'devnet',
  endpoint_ref: 'helius-devnet-binding-ref',
  binding_source_kind: 'env_out_of_repo',
  secret_in_repo: false,
  endpoint_in_repo: false,
  no_network: true,
  no_send: true,
  no_broadcast: true,
  no_serialize: true,
  no_mainnet: true,
  no_real_live: true,
  requires_out_of_repo_secret_source: true,
  requires_separate_live_binding_pr: true
});

const base17 = Object.freeze({
  purpose: 'live_testnet_rpc_read_only_spike',
  environment: 'devnet',
  rpc_method: 'getVersion',
  approval_gate_record: F14rec,
  supply_chain_review_record: F15rec,
  binding_descriptor_record: F16rec,
  read_only: true,
  no_send: true,
  no_broadcast: true,
  no_serialize: true,
  no_sign: true,
  no_mainnet: true,
  no_real_live: true,
  endpoint_in_repo: false,
  requires_out_of_repo_binding: true,
  requires_separate_send_pr: true
});

const healthy = async (m) =>
  m === 'getHealth' ? 'ok' : { 'solana-core': '1.18.0' };

// The execution-command identifiers a status shell must NEVER expose as keys.
const EXEC_COMMAND_KEYS = [
  'buy',
  'sell',
  'execute',
  'submit',
  'send',
  'broadcast',
  'swap',
  'copy_now',
  'trade_now'
];
const EXEC_SUBSTRINGS = ['buy', 'sell', 'execute', 'submit', 'swap'];

// All readiness-aggregator + shell inputs are built ONCE in a setup test so the
// async spike runs deterministically; the proofs below consume the module state.
let rpcHealthy;
let rpcDegraded;
let pcOk;
let pcDegraded;
let cfgOk;
let cfgInvalid;
let cfgDegraded;
let audOk;
let audInvalid;
let allGood;
let readyAgg;
let degAgg;
let blkAgg;
let uncAgg;

test('PR-S3-B setup: build REAL Stage-2 + Gate-A inputs (no network)', async () => {
  const spike = await evaluateLiveTestnetRpcReadOnlySpike(base17, healthy);
  rpcHealthy = evaluateRpcHealthFromSpike(spike);
  rpcDegraded = evaluateRpcHealthFromSpike(
    await evaluateLiveTestnetRpcReadOnlySpike(base17)
  );

  const expectedConsts = {
    graduation_threshold_sol: 85,
    program_id_marker: 'pump-fun-marker',
    fee_bps: 100
  };
  const obsOk = {
    environment: 'devnet',
    source_read_only: true,
    observed_ok: true,
    observed: { ...expectedConsts }
  };
  pcOk = evaluateProtocolConstantHealth(obsOk, expectedConsts);
  pcDegraded = evaluateProtocolConstantHealth(
    { environment: 'devnet', source_read_only: true, observed_ok: false },
    expectedConsts
  );

  cfgOk = evaluateGateAConfigReadiness(goodCfg);
  cfgInvalid = evaluateGateAConfigReadiness({ ...goodCfg, can_send: true });
  cfgDegraded = evaluateGateAConfigReadiness({ hard_risk_limits_defined: true });

  audOk = evaluateGateAAuditPath(goodEnv);
  audInvalid = evaluateGateAAuditPath({ ...goodEnv, decision_ref: undefined });

  // Sanity: the REAL producers landed on the states the proofs depend on.
  assert.equal(rpcHealthy.health_state, 'READ_ONLY_HEALTHY');
  assert.equal(rpcDegraded.health_state, 'DEGRADED');
  assert.equal(pcOk.constants_state, 'READ_ONLY_CONSTANTS_OK');
  assert.equal(pcDegraded.constants_state, 'DEGRADED');
  assert.equal(cfgOk.config_state, 'CONFIG_VALID_READ_ONLY');
  assert.equal(cfgInvalid.config_state, 'CONFIG_INVALID');
  assert.equal(cfgDegraded.config_state, 'CONFIG_DEGRADED');
  assert.equal(audOk.audit_state, 'AUDIT_PATH_VALID');
  assert.equal(audInvalid.audit_state, 'AUDIT_INVALID');

  allGood = {
    rpc_health: rpcHealthy,
    protocol_constants: pcOk,
    config_readiness: cfgOk,
    audit_path: audOk
  };

  readyAgg = evaluateGateAReadiness(allGood);
  degAgg = evaluateGateAReadiness({ ...allGood, rpc_health: rpcDegraded });
  blkAgg = evaluateGateAReadiness({ ...allGood, config_readiness: cfgInvalid });
  uncAgg = evaluateGateAReadiness(undefined);
});

// --- READINESS AGGREGATOR (E1..E14) ---

test('E1 undefined inputs -> GATE_A_UNCONFIGURED', () => {
  assert.equal(
    evaluateGateAReadiness(undefined).gate_a_state,
    'GATE_A_UNCONFIGURED'
  );
});

test('E2 missing one input (omit audit_path) -> GATE_A_UNCONFIGURED', () => {
  const { audit_path, ...partial } = allGood;
  void audit_path;
  assert.equal(
    evaluateGateAReadiness(partial).gate_a_state,
    'GATE_A_UNCONFIGURED'
  );
});

test('E3 allGood -> GATE_A_READY_READ_ONLY && gate_a_ready_read_only', () => {
  const r = evaluateGateAReadiness(allGood);
  assert.equal(r.gate_a_state, 'GATE_A_READY_READ_ONLY');
  assert.equal(r.gate_a_ready_read_only, true);
});

test('E4 degraded RPC -> GATE_A_DEGRADED', () => {
  assert.equal(
    evaluateGateAReadiness({ ...allGood, rpc_health: rpcDegraded }).gate_a_state,
    'GATE_A_DEGRADED'
  );
});

test('E5 degraded constants -> GATE_A_DEGRADED', () => {
  assert.equal(
    evaluateGateAReadiness({ ...allGood, protocol_constants: pcDegraded })
      .gate_a_state,
    'GATE_A_DEGRADED'
  );
});

test('E6 invalid config -> GATE_A_BLOCKED', () => {
  assert.equal(
    evaluateGateAReadiness({ ...allGood, config_readiness: cfgInvalid })
      .gate_a_state,
    'GATE_A_BLOCKED'
  );
});

test('E7 invalid audit -> GATE_A_BLOCKED', () => {
  assert.equal(
    evaluateGateAReadiness({ ...allGood, audit_path: audInvalid }).gate_a_state,
    'GATE_A_BLOCKED'
  );
});

test('E8 config degraded -> GATE_A_DEGRADED', () => {
  assert.equal(
    evaluateGateAReadiness({ ...allGood, config_readiness: cfgDegraded })
      .gate_a_state,
    'GATE_A_DEGRADED'
  );
});

test('E9 smuggled forbidden flag at top-level -> GATE_A_BLOCKED (fail-closed)', () => {
  assert.equal(
    evaluateGateAReadiness({ ...allGood, can_send: true }).gate_a_state,
    'GATE_A_BLOCKED'
  );
});

test('E10 smuggled forbidden flag inside a component -> GATE_A_BLOCKED', () => {
  assert.equal(
    evaluateGateAReadiness({
      ...allGood,
      rpc_health: { ...rpcHealthy, can_send: true }
    }).gate_a_state,
    'GATE_A_BLOCKED'
  );
});

test('E11 all invariant flags false across every aggregator state (incl READY_READ_ONLY)', () => {
  const results = [
    evaluateGateAReadiness(undefined), // UNCONFIGURED
    evaluateGateAReadiness({ ...allGood, rpc_health: rpcDegraded }), // DEGRADED
    evaluateGateAReadiness({ ...allGood, config_readiness: cfgInvalid }), // BLOCKED
    evaluateGateAReadiness(allGood) // READY_READ_ONLY
  ];
  const seen = new Set(results.map((r) => r.gate_a_state));
  assert.equal(seen.has('GATE_A_UNCONFIGURED'), true);
  assert.equal(seen.has('GATE_A_DEGRADED'), true);
  assert.equal(seen.has('GATE_A_BLOCKED'), true);
  assert.equal(seen.has('GATE_A_READY_READ_ONLY'), true);
  for (const r of results) assertAllInvariantsFalse(r, r.gate_a_state);
});

test('E12 hostile Proxy -> frozen GATE_A_UNCONFIGURED, no throw', () => {
  let r;
  assert.doesNotThrow(() => {
    r = evaluateGateAReadiness(hostileProxy());
  });
  assert.equal(r.gate_a_state, 'GATE_A_UNCONFIGURED');
  assert.equal(Object.isFrozen(r), true);
});

test('E13 NO-ECHO: leaked endpoint field is not echoed in result JSON', () => {
  const r = evaluateGateAReadiness({
    ...allGood,
    leaked: 'https://secret-rpc.internal'
  });
  assert.equal(JSON.stringify(r).includes('secret-rpc.internal'), false);
});

test('E14 readiness aggregator contract descriptor', () => {
  const d = describeGateAReadinessAggregatorContract();
  assert.equal(d.gate_a_state, 'GATE_A_UNCONFIGURED');
  assert.equal(d.can_send, false);
  assert.equal(d.trading_ready, false);
  assert.equal(Object.isFrozen(d), true);
});

// --- STATUS SHELL (F1..F12) ---

test('F1 readyAgg -> shell status read_only_ready', () => {
  assert.equal(evaluateGateAStatusShell(readyAgg).status, 'read_only_ready');
});

test('F2 degAgg -> shell status degraded', () => {
  assert.equal(evaluateGateAStatusShell(degAgg).status, 'degraded');
});

test('F3 blkAgg -> shell status blocked', () => {
  assert.equal(evaluateGateAStatusShell(blkAgg).status, 'blocked');
});

test('F4 uncAgg -> shell status unconfigured', () => {
  assert.equal(evaluateGateAStatusShell(uncAgg).status, 'unconfigured');
});

test('F5 undefined -> shell status unconfigured', () => {
  assert.equal(evaluateGateAStatusShell(undefined).status, 'unconfigured');
});

test('F6 every shell result is read-only Gate-A stage with no trade capability', () => {
  const shells = [
    evaluateGateAStatusShell(readyAgg),
    evaluateGateAStatusShell(degAgg),
    evaluateGateAStatusShell(blkAgg),
    evaluateGateAStatusShell(uncAgg),
    evaluateGateAStatusShell(undefined)
  ];
  for (const s of shells) {
    assert.equal(s.stage, 'gate_a');
    assert.equal(s.can_trade, false);
    assert.equal(s.can_send, false);
    assert.equal(s.can_broadcast, false);
    assert.equal(s.requires_next_stage, 'data_ingestion');
  }
});

test('F7 shell results expose NO execution-command keys', () => {
  const shells = [
    evaluateGateAStatusShell(readyAgg),
    evaluateGateAStatusShell(degAgg),
    evaluateGateAStatusShell(blkAgg),
    evaluateGateAStatusShell(uncAgg),
    evaluateGateAStatusShell(undefined)
  ];
  for (const s of shells) {
    const keys = Object.keys(s);
    for (const cmd of EXEC_COMMAND_KEYS) {
      assert.equal(keys.includes(cmd), false, `forbidden command key: ${cmd}`);
    }
    for (const k of keys) {
      const lk = k.toLowerCase();
      for (const sub of EXEC_SUBSTRINGS) {
        assert.equal(
          lk.includes(sub),
          false,
          `key "${k}" contains forbidden substring "${sub}"`
        );
      }
    }
  }
});

test('F8 shell has no key whose value is a function (no command callables)', () => {
  const shells = [
    evaluateGateAStatusShell(readyAgg),
    evaluateGateAStatusShell(uncAgg),
    evaluateGateAStatusShell(undefined)
  ];
  for (const s of shells) {
    for (const k of Object.keys(s)) {
      assert.notEqual(typeof s[k], 'function', `callable key: ${k}`);
    }
  }
});

test('F9 hostile Proxy -> frozen unconfigured shell, no throw', () => {
  let s;
  assert.doesNotThrow(() => {
    s = evaluateGateAStatusShell(hostileProxy());
  });
  assert.equal(s.status, 'unconfigured');
  assert.equal(s.stage, 'gate_a');
  assert.equal(Object.isFrozen(s), true);
});

test('F10 shell results are frozen', () => {
  assert.equal(Object.isFrozen(evaluateGateAStatusShell(readyAgg)), true);
  assert.equal(Object.isFrozen(evaluateGateAStatusShell(undefined)), true);
});

test('F11 NO-ECHO: leaked endpoint string in agg-like input is not echoed in shell JSON', () => {
  const s = evaluateGateAStatusShell({
    gate_a_state: 'GATE_A_READY_READ_ONLY',
    leaked_endpoint: 'https://secret-rpc.internal'
  });
  assert.equal(JSON.stringify(s).includes('secret-rpc.internal'), false);
});

test('F12 status shell contract descriptor', () => {
  const d = describeGateAStatusShellContract();
  assert.equal(d.stage, 'gate_a');
  assert.equal(d.can_trade, false);
  assert.equal(d.has_execution_commands, false);
  assert.equal(Object.isFrozen(d), true);
});

// --- STATIC GUARDS (S5..S7) — appended region of the package source. ---

test('S5 appended source region is import-free + no IO/clock primitives', () => {
  const src = readFileSync(SRC, 'utf8');
  // re-confirm whole-file invariants hold after the PR-S3-B append:
  for (const line of src.split(/\r?\n/)) {
    assert.equal(/^import\s/.test(line), false, `import line: ${line}`);
    assert.equal(/require\(/.test(line), false, `require call: ${line}`);
  }
  assert.equal(/fetch\(/.test(src), false, 'fetch(');
  assert.equal(/new\s+WebSocket/.test(src), false, 'new WebSocket');
  assert.equal(/new\s+Connection/.test(src), false, 'new Connection');
  assert.equal(/sendTransaction/.test(src), false, 'sendTransaction');
  assert.equal(/process\.env/.test(src), false, 'process.env');
  assert.equal(/readFileSync/.test(src), false, 'readFileSync');
  assert.equal(/node:fs/.test(src), false, 'node:fs');
  assert.equal(/Date\.now/.test(src), false, 'Date.now');
  assert.equal(/new\s+Date/.test(src), false, 'new Date');
});

test('S6 no "can_send: true" anywhere in packages/*/src', () => {
  const root = join(HERE, '..', '..');
  const offenders = [];
  function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        walk(full);
      } else if (/\.(mjs|js|ts|d\.ts)$/.test(ent.name)) {
        const body = readFileSync(full, 'utf8');
        if (/can_send\s*:\s*true/.test(body)) offenders.push(full);
      }
    }
  }
  // only descend into each package's src directory
  for (const pkg of readdirSync(root, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const srcDir = join(root, pkg.name, 'src');
    let exists = true;
    try {
      readdirSync(srcDir);
    } catch {
      exists = false;
    }
    if (exists) walk(srcDir);
  }
  assert.deepEqual(offenders, [], `can_send:true found in: ${offenders.join(', ')}`);
});

test('S7 shell src + descriptor expose NO execution-command identifier as a result key', () => {
  const src = readFileSync(SRC, 'utf8');
  // The shell result/descriptor objects must not declare any execution command
  // identifier as an object key (e.g. `buy:`, `execute:`, `swap:`).
  for (const cmd of [...EXEC_COMMAND_KEYS]) {
    const keyDecl = new RegExp('["\\\']?' + cmd + '["\\\']?\\s*:', 'g');
    // Allow appearance only inside the prose note (it lists forbidden words).
    // Verify by checking the runtime shell + descriptor objects directly:
    void keyDecl;
  }
  const shellKeys = new Set([
    ...Object.keys(evaluateGateAStatusShell(undefined)),
    ...Object.keys(describeGateAStatusShellContract())
  ]);
  for (const cmd of EXEC_COMMAND_KEYS) {
    assert.equal(shellKeys.has(cmd), false, `shell key: ${cmd}`);
  }
  for (const k of shellKeys) {
    const lk = k.toLowerCase();
    for (const sub of EXEC_SUBSTRINGS) {
      assert.equal(lk.includes(sub), false, `shell key "${k}" has "${sub}"`);
    }
  }
  // src guard: ensure no exec-command identifier is used as an OBJECT KEY in
  // the appended shell builder (keys are `identifier:` style).
  for (const cmd of EXEC_COMMAND_KEYS) {
    const re = new RegExp('\\b' + cmd + '\\s*:', '');
    assert.equal(re.test(src), false, `exec key "${cmd}:" present in src`);
  }
});
