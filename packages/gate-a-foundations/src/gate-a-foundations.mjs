// @soltrade/gate-a-foundations
// Gate-A Stage-3 foundations: read-only Config Validation + Audit Path.
// STRICT: import-free, function-I/O-only, pure. No network primitive, no system
// clock, no secrets, no env/file reads. Results are Object.freeze of fixed
// literals; inputs are never echoed back; reasons are fixed string tokens;
// hostile/throwing input returns a frozen refusal and never throws.
// A valid config / audit path is read-only and NEVER opens trading readiness.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function gateAInvariantFlags() {
  return {
    trading_ready: false,
    routing_ready: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    signing_permitted: false,
    broadcast_permitted: false,
    is_live: false,
    real_live: false,
    mainnet_enabled: false,
    has_rpc: false
  };
}

const GATE_A_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'trading_ready',
  'can_send',
  'can_broadcast',
  'can_serialize',
  'signing_permitted',
  'broadcast_permitted',
  'is_live',
  'real_live',
  'mainnet_enabled',
  'has_rpc'
]);

const GATE_A_SECRET_KEY_RE =
  /secret|api[_-]?key|apikey|token|private|seed|mnemonic|keypair|raw_key|auth_token|credential/i;

const GATE_A_TESTNET_ENVS = Object.freeze(['devnet', 'testnet', 'localnet']);

function gateALooksSecretKeyName(k) {
  return GATE_A_SECRET_KEY_RE.test(String(k));
}

function gateAHasForbiddenTrueFlag(obj) {
  for (const f of GATE_A_FORBIDDEN_TRUE_FLAGS) {
    if (obj && obj[f] === true) return true;
  }
  return false;
}

// A field carries secret MATERIAL only if its name looks secret-bearing AND its value is an actual string
// payload. A boolean attestation like `no_secret_material:true` / `no_private_key_material:true` is a SAFE
// assertion (no material), so it must NOT be flagged even though its key name contains 'secret'/'private' —
// otherwise the required-attestation keys would make a valid envelope unreachable. We block the real cases
// (api_key/token/private_key/auth_token carrying a string value), and never echo the value.
function gateAHasSecretField(obj) {
  if (obj == null || typeof obj !== 'object') return false;
  for (const [k, v] of Object.entries(obj)) {
    if (gateALooksSecretKeyName(k) && typeof v === 'string') return true;
  }
  return false;
}

function gateANonTestnetEnv(env) {
  if (typeof env !== 'string') return false;
  const e = env.toLowerCase();
  return e.indexOf('mainnet') !== -1 || e.indexOf('prod') !== -1;
}

// ---------------------------------------------------------------------------
// CONFIG VALIDATION (Part C)
// ---------------------------------------------------------------------------

const GATE_A_CONFIG_STATES = Object.freeze([
  'CONFIG_UNCONFIGURED',
  'CONFIG_INVALID',
  'CONFIG_VALID_READ_ONLY',
  'CONFIG_DEGRADED'
]);

const GATE_A_CONFIG_REQUIRED_TRUE = Object.freeze([
  'hard_risk_limits_defined',
  'signer_isolation_declared',
  'environment_declared'
]);

export function describeGateAConfigValidationContract() {
  return Object.freeze({
    contract: 'gate-a-config-validation',
    version: '0.0.0',
    test_only: true,
    supported_states: GATE_A_CONFIG_STATES,
    required_attestations: GATE_A_CONFIG_REQUIRED_TRUE,
    read_only: true,
    config_is_not_trading_readiness: true,
    config_state: 'CONFIG_UNCONFIGURED',
    config_valid_read_only: false,
    status: 'CONFIG_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...gateAInvariantFlags(),
    note:
      'Read-only Gate-A config validation. Validates that the basic operational config can be evaluated; missing/invalid config fails closed. Reads NO secret/env/file, makes NO network call. A valid config is read-only only and does NOT open trading readiness / send / broadcast / signing / routing / mainnet / REAL-LIVE.'
  });
}

export function validateGateAConfig(config) {
  try {
    const obj =
      config != null && typeof config === 'object' && !Array.isArray(config)
        ? config
        : null;
    const reasons = [];
    if (!obj) {
      reasons.push('config_not_object');
    } else {
      if (gateAHasForbiddenTrueFlag(obj))
        reasons.push('forbidden_trading_indicator_blocked');
      if (gateAHasSecretField(obj)) reasons.push('secret_field_blocked');
      if (gateANonTestnetEnv(obj.environment))
        reasons.push('mainnet_or_nontestnet_environment_blocked');
      else if (
        typeof obj.environment === 'string' &&
        !GATE_A_TESTNET_ENVS.includes(obj.environment)
      )
        reasons.push('nontestnet_environment_blocked');
    }
    const unique = [...new Set(reasons)];
    const recognized = obj != null;
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid,
      recognized,
      reasons: Object.freeze([...unique]),
      ...gateAInvariantFlags()
    });
  } catch (_e) {
    return Object.freeze({
      valid: false,
      recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...gateAInvariantFlags()
    });
  }
}

export function evaluateGateAConfigReadiness(config) {
  const buildC = (state, reasons) =>
    Object.freeze({
      valid: state !== 'CONFIG_INVALID',
      config_state: state,
      config_valid_read_only: state === 'CONFIG_VALID_READ_ONLY',
      status: state,
      reasons,
      ...gateAInvariantFlags()
    });
  try {
    const v = validateGateAConfig(config);
    if (!v.recognized || v.reasons.includes('input_inspection_error'))
      return buildC(
        'CONFIG_UNCONFIGURED',
        v.reasons.length ? v.reasons : Object.freeze(['config_not_object'])
      );
    if (
      v.reasons.includes('forbidden_trading_indicator_blocked') ||
      v.reasons.includes('secret_field_blocked') ||
      v.reasons.includes('mainnet_or_nontestnet_environment_blocked') ||
      v.reasons.includes('nontestnet_environment_blocked')
    )
      return buildC('CONFIG_INVALID', v.reasons);
    const obj = config;
    const present = GATE_A_CONFIG_REQUIRED_TRUE.filter(
      (k) => obj[k] !== undefined
    );
    const allTrue = GATE_A_CONFIG_REQUIRED_TRUE.every((k) => obj[k] === true);
    const envOk = GATE_A_TESTNET_ENVS.includes(obj.environment);
    if (present.length === 0)
      return buildC(
        'CONFIG_UNCONFIGURED',
        Object.freeze(['no_required_attestations'])
      );
    if (allTrue && envOk)
      return buildC('CONFIG_VALID_READ_ONLY', Object.freeze([]));
    return buildC(
      'CONFIG_DEGRADED',
      Object.freeze(['required_attestations_incomplete'])
    );
  } catch (_e) {
    return buildC('CONFIG_UNCONFIGURED', Object.freeze(['input_inspection_error']));
  }
}

// ---------------------------------------------------------------------------
// AUDIT PATH (Part D)
// ---------------------------------------------------------------------------

const GATE_A_AUDIT_STATES = Object.freeze([
  'AUDIT_UNCONFIGURED',
  'AUDIT_INVALID',
  'AUDIT_DEGRADED',
  'AUDIT_PATH_VALID'
]);

const GATE_A_AUDIT_REQUIRED_REFS = Object.freeze([
  'decision_ref',
  'actor_ref',
  'reason_code'
]);

const GATE_A_AUDIT_REQUIRED_TRUE = Object.freeze([
  'audit_required',
  'no_secret_material',
  'no_private_key_material',
  'no_live_execution'
]);

export function describeGateAAuditPathContract() {
  return Object.freeze({
    contract: 'gate-a-audit-path',
    version: '0.0.0',
    test_only: true,
    supported_states: GATE_A_AUDIT_STATES,
    required_refs: GATE_A_AUDIT_REQUIRED_REFS,
    required_attestations: GATE_A_AUDIT_REQUIRED_TRUE,
    read_only: true,
    audit_cannot_be_bypassed: true,
    audit_state: 'AUDIT_UNCONFIGURED',
    audit_path_valid: false,
    status: 'AUDIT_UNCONFIGURED',
    reasons: Object.freeze([]),
    ...gateAInvariantFlags(),
    note:
      'Read-only Gate-A audit path. Validates a test-only audit envelope carries a non-hidden decision_ref + actor_ref + reason_code and attests no secret/private-key material and no live execution. Stores NO secret/private-key/endpoint; never hides a decision/reason; cannot be bypassed. Makes no network call; reads no env/file.'
  });
}

export function validateGateAAuditEnvelope(envelope) {
  try {
    const obj =
      envelope != null &&
      typeof envelope === 'object' &&
      !Array.isArray(envelope)
        ? envelope
        : null;
    const reasons = [];
    if (!obj) {
      reasons.push('no_audit_envelope');
    } else {
      if (gateAHasForbiddenTrueFlag(obj))
        reasons.push('forbidden_trading_indicator_blocked');
      if (gateAHasSecretField(obj)) reasons.push('secret_field_blocked');
      // required refs must be non-empty strings (non-hidden decision/reason)
      for (const r of GATE_A_AUDIT_REQUIRED_REFS) {
        if (typeof obj[r] !== 'string' || obj[r].length === 0)
          reasons.push(r + '_missing');
      }
      for (const a of GATE_A_AUDIT_REQUIRED_TRUE) {
        if (obj[a] !== true) reasons.push(a + '_required');
      }
    }
    const unique = [...new Set(reasons)];
    const recognized = obj != null;
    const valid = recognized && unique.length === 0;
    return Object.freeze({
      valid,
      recognized,
      reasons: Object.freeze([...unique]),
      ...gateAInvariantFlags()
    });
  } catch (_e) {
    return Object.freeze({
      valid: false,
      recognized: false,
      reasons: Object.freeze(['input_inspection_error']),
      ...gateAInvariantFlags()
    });
  }
}

export function evaluateGateAAuditPath(envelope) {
  const buildA = (state, reasons) =>
    Object.freeze({
      valid: state !== 'AUDIT_INVALID',
      audit_state: state,
      audit_path_valid: state === 'AUDIT_PATH_VALID',
      status: state,
      reasons,
      ...gateAInvariantFlags()
    });
  try {
    const v = validateGateAAuditEnvelope(envelope);
    if (!v.recognized || v.reasons.includes('input_inspection_error'))
      return buildA(
        'AUDIT_UNCONFIGURED',
        v.reasons.length ? v.reasons : Object.freeze(['no_audit_envelope'])
      );
    if (
      v.reasons.includes('forbidden_trading_indicator_blocked') ||
      v.reasons.includes('secret_field_blocked')
    )
      return buildA('AUDIT_INVALID', v.reasons);
    // a missing decision/reason ref is an INVALID (hidden decision) not merely degraded:
    const refMissing = GATE_A_AUDIT_REQUIRED_REFS.some((r) =>
      v.reasons.includes(r + '_missing')
    );
    if (refMissing) return buildA('AUDIT_INVALID', v.reasons);
    if (v.reasons.length > 0) return buildA('AUDIT_DEGRADED', v.reasons);
    return buildA('AUDIT_PATH_VALID', Object.freeze([]));
  } catch (_e) {
    return buildA('AUDIT_UNCONFIGURED', Object.freeze(['input_inspection_error']));
  }
}
