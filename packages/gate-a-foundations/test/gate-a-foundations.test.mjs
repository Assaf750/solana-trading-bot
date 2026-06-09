// PR-S3-A test-agent proofs for @soltrade/gate-a-foundations.
// Read-only Gate-A Config Validation + Audit Path. Deterministic, no I/O beyond
// reading the package source for STATIC GUARDS. Asserts: fail-closed states,
// no secret echo, hostile-input refusal (frozen, no throw), and that NO result
// ever opens trading readiness.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
