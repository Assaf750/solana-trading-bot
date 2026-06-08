// @soltrade/rpc-provider-contract — RPC Provider CONTRACT + FAIL-CLOSED SKELETON (Gate E / E2-F-7).
// SOURCE: docs/00-ARCHITECTURE.md §15.12 (Wave 4 execution/providers boundary) + docs/09-THREAT-SECURITY +
// docs/01-SSOT Group 40 (candidate provider vocabulary — provider_key_ref by reference only, no raw key).
//
// CONTRACT/SKELETON ONLY — there is NO live mechanism here and this is NOT an RPC client. This module describes
// what an RPC provider boundary MUST be (a fail-closed component that NEVER contacts a provider, NEVER carries a
// live endpoint, NEVER sends or broadcasts, and NEVER accepts key material) and ships a provider whose every
// evaluation resolves to "not ready". It performs no work and contacts nothing.
//
// ABSENT BY DESIGN (and forbidden here): RPC/provider client or SDK, Solana/Jupiter/Helius/Jito, network call,
// endpoint URL, transaction building/serialization, signing/sending, broadcast, KMS/vault, KeyManager, key
// material, configured-handle wiring, DB access, REAL-LIVE activation, execution authority. The result fields
// below are fixed literals (all false / not-ready) — request input is never echoed and nothing is ever sent.
//
// WHY OUTSIDE THE ALLOWLIST: a pure contract/skeleton has no live mechanism, so it lives outside the mechanism
// guard's allowlist and is FULLY SCANNED — proving it carries zero forbidden families. A real RPC provider /
// live endpoint is a separate, explicitly-approved PR and is NOT started here. The field names below are
// function-return names, NOT SSOT/API/CONFIG vocabulary.

const UNCONFIGURED = 'unconfigured_no_rpc';

// Testnet-family environments are the only permitted environment values. mainnet/prod (or any other value) is
// blocked: this boundary must never carry a mainnet indicator (fail-safe-not-fail-open).
const TESTNET_ENVS = Object.freeze(['devnet', 'testnet', 'localnet']);

// Only these config fields are permitted — anything else is rejected (no surprise fields). All are opaque
// references; none is a key, a secret, or a live endpoint.
const PROVIDER_CONFIG_KNOWN_FIELDS = Object.freeze(['provider_ref', 'environment', 'endpoint_ref']);

// ---- indicator token lists (string literals: lexer-blanked, so the guard's code-scan sees no mechanism) ----
// Detection is substring-based and intentionally CONSERVATIVE (over-refusal is fail-safe-not-fail-open): any
// input carrying one of these indicators is refused. None of these are ever executed — they are match tokens.
const MAINNET_TOKENS = Object.freeze(['mainnet', 'mainnet-beta', 'prod']);
// endpoint / RPC / provider-URL indicators — an RPC provider boundary must never carry a live endpoint surface.
const ENDPOINT_RPC_TOKENS = Object.freeze([
  'http://', 'https://', 'ws://', 'wss://', 'rpc', 'endpoint', 'provider_url', 'rpc_endpoint', 'cluster',
  'websocket', 'node_url', 'api_key', 'url',
]);
// broadcast / send-intent indicators — the boundary never broadcasts or sends.
const BROADCAST_SEND_TOKENS = Object.freeze(['broadcast', 'send']);

// Is the given input "key-material-shaped"? Used ONLY to REFUSE such input — never to accept/store/return it.
// Conservative heuristic: PEM, a long base58 blob, a multi-word mnemonic, or an object exposing a secret field.
// (Copied verbatim from the proven custody-provider-contract heuristic — lowercase regexes are guard-safe.)
function looksLikeKeyMaterial(input) {
  if (input == null) return false;
  if (typeof input === 'string') {
    const s = input.trim();
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) return true;       // PEM private key
    if (/^[1-9A-HJ-NP-Za-km-z]{64,}$/.test(s)) return true;              // long base58 blob
    if (s.split(/\s+/).length >= 12) return true;                        // mnemonic-length word list
    return false;
  }
  if (typeof input === 'object') {
    for (const k of Object.keys(input)) {
      if (/secret|private|seed|mnemonic|keypair|key_material|raw_key/i.test(k)) return true;
    }
  }
  return false;
}

// Collect a shallow set of lowercased strings (keys + string values, one nested level) from an input, used only
// to match refusal indicators. Never stores or returns input data beyond this local match set.
function collectStrings(input) {
  const out = [];
  if (input == null) return out;
  if (typeof input === 'string') { out.push(input); return out; }
  if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      out.push(String(k));
      if (typeof v === 'string') out.push(v);
      else if (v != null && typeof v === 'object') {
        for (const [k2, v2] of Object.entries(v)) {
          out.push(String(k2));
          if (typeof v2 === 'string') out.push(v2);
        }
      } else out.push(String(v));
    }
  }
  return out;
}

// True iff any indicator token appears (substring) in the input's keys/values. Conservative by design.
function hasIndicator(input, tokens) {
  const hay = collectStrings(input).map((s) => s.toLowerCase());
  return tokens.some((t) => hay.some((s) => s.indexOf(t) !== -1));
}

// Does a single string value carry a mainnet / endpoint-RPC / broadcast-send indicator? Used to validate that
// an opaque reference stays opaque (never a live surface, never a mainnet marker).
function valueHasBlockedIndicator(value) {
  if (typeof value !== 'string') return false;
  const s = value.toLowerCase();
  return MAINNET_TOKENS.some((t) => s.indexOf(t) !== -1)
    || ENDPOINT_RPC_TOKENS.some((t) => s.indexOf(t) !== -1)
    || BROADCAST_SEND_TOKENS.some((t) => s.indexOf(t) !== -1);
}

// The RPC-provider CONTRACT descriptor: what any conforming RPC provider boundary must expose, with every
// rpc/send/broadcast/live capability pinned to false. Read-only; describes intent, performs nothing.
export function describeRpcProviderContract() {
  return Object.freeze({
    contract: 'rpc-provider',
    version: '0.0.0',
    configured: false,                 // nothing is configured (this is a contract/skeleton)
    has_rpc: false,                    // no RPC/provider surface exists
    can_send: false,                   // the boundary NEVER sends
    can_broadcast: false,              // the boundary NEVER broadcasts
    accepts_key_material_input: false, // key-material-shaped input is refused
    is_live: false,
    status: UNCONFIGURED,
    operations: Object.freeze(['describe', 'validateConfig', 'evaluateReadiness']),
    note: 'RPC-provider CONTRACT + fail-closed SKELETON (E2-F-7). NOT an RPC client. Always refuses: no RPC, no '
      + 'endpoint, no send, no broadcast, no network, no SDK, no KMS, no KeyManager, no key material, no '
      + 'execution authority. A real RPC provider / live endpoint is a separate, explicitly-approved PR.',
  });
}

// Validate an RPC provider config WITHOUT activating anything. This NEVER contacts a provider, never loads an
// SDK, and never returns a handle. It classifies the config shape only: references are opaque strings;
// environment must be testnet-family; mainnet/prod, endpoint/RPC, and broadcast/send indicators are blocked;
// key material is refused; unknown fields are rejected. A "valid" shape is REFERENCES-ONLY and does NOT
// configure the provider (configured:false, has_rpc:false) — resolution stays fail-closed (separate PR).
export function validateRpcProviderConfig(config) {
  if (config == null || typeof config !== 'object') {
    return Object.freeze({
      valid: false,
      status: UNCONFIGURED,
      reasons: Object.freeze(['missing_config']),
      configured: false,
      has_rpc: false,
    });
  }
  // Inspection is wrapped so a hostile/throwing accessor (getter / Proxy trap) RETURNS a fail-closed refusal
  // (never throws, never echoes) — mirrors evaluateRpcReadiness and the E2-F-1 hardening.
  try {
    if (looksLikeKeyMaterial(config)) {
      return Object.freeze({
        valid: false,
        status: 'invalid_key_material',
        reasons: Object.freeze(['key_material_not_accepted']),
        configured: false,
        has_rpc: false,
      });
    }

    const reasons = [];

    // provider_ref: required opaque reference string (not a secret, not a mainnet/endpoint indicator).
    const refPresent = typeof config.provider_ref === 'string' && config.provider_ref.length > 0;
    if (!refPresent) reasons.push('missing_provider_ref');

    // environment: must be testnet-family. mainnet/prod (or any non-testnet value) is blocked.
    const env = config.environment;
    if (typeof env !== 'string' || env.length === 0 || !TESTNET_ENVS.includes(env)) {
      reasons.push('mainnet_or_nontestnet_environment_blocked');
    }

    // endpoint_ref: OPTIONAL opaque reference string only — never an endpoint/URL/RPC indicator.
    if (config.endpoint_ref !== undefined) {
      const epRef = config.endpoint_ref;
      if (typeof epRef !== 'string' || epRef.length === 0
        || ENDPOINT_RPC_TOKENS.some((t) => epRef.toLowerCase().indexOf(t) !== -1)) {
        reasons.push('endpoint_or_rpc_indicator_blocked');
      }
    }

    // unknown / surprise field — only the known reference fields are permitted.
    if (Object.keys(config).some((k) => !PROVIDER_CONFIG_KNOWN_FIELDS.includes(k))) {
      reasons.push('unknown_field_rejected');
    }

    // mainnet indicator anywhere (any key/value) — references must never carry a mainnet/prod marker.
    if (hasIndicator(config, MAINNET_TOKENS)) {
      reasons.push('mainnet_or_nontestnet_environment_blocked');
    }

    // endpoint / RPC / URL indicator in ANY value — references must be opaque, never a live-call surface.
    if (Object.values(config).some((v) => typeof v === 'string'
      && ENDPOINT_RPC_TOKENS.some((t) => v.toLowerCase().indexOf(t) !== -1))) {
      reasons.push('endpoint_or_rpc_indicator_blocked');
    }

    // broadcast / send indicator anywhere — this boundary never sends or broadcasts.
    if (hasIndicator(config, BROADCAST_SEND_TOKENS)) {
      reasons.push('send_or_broadcast_indicator_blocked');
    }

    // provider_ref value must itself stay opaque (no mainnet/endpoint/send markers buried inside it).
    if (refPresent && valueHasBlockedIndicator(config.provider_ref)) {
      if (MAINNET_TOKENS.some((t) => config.provider_ref.toLowerCase().indexOf(t) !== -1)
        && !reasons.includes('mainnet_or_nontestnet_environment_blocked')) {
        reasons.push('mainnet_or_nontestnet_environment_blocked');
      }
      if (ENDPOINT_RPC_TOKENS.some((t) => config.provider_ref.toLowerCase().indexOf(t) !== -1)
        && !reasons.includes('endpoint_or_rpc_indicator_blocked')) {
        reasons.push('endpoint_or_rpc_indicator_blocked');
      }
      if (BROADCAST_SEND_TOKENS.some((t) => config.provider_ref.toLowerCase().indexOf(t) !== -1)
        && !reasons.includes('send_or_broadcast_indicator_blocked')) {
        reasons.push('send_or_broadcast_indicator_blocked');
      }
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const valid = uniqueReasons.length === 0;
    // status: valid references-only -> reference_valid_no_rpc; missing core fields -> unconfigured_no_rpc;
    // key material -> invalid_key_material (handled above); else -> invalid.
    let status;
    if (valid) status = 'reference_valid_no_rpc';
    else if (uniqueReasons.includes('missing_provider_ref')
      || uniqueReasons.includes('mainnet_or_nontestnet_environment_blocked')) status = UNCONFIGURED;
    else status = 'invalid';
    // A missing-environment shape is foundationally unconfigured; but if a hard threat indicator is present we
    // keep the unconfigured status only when no clearly-invalid indicator dominates. Threat indicators that are
    // not "missing core field" map to 'invalid'.
    if (!valid && status === UNCONFIGURED) {
      const hasInvalidIndicator = uniqueReasons.includes('endpoint_or_rpc_indicator_blocked')
        || uniqueReasons.includes('send_or_broadcast_indicator_blocked')
        || uniqueReasons.includes('unknown_field_rejected');
      const hasMissingCore = uniqueReasons.includes('missing_provider_ref');
      if (hasInvalidIndicator && !hasMissingCore) status = 'invalid';
    }

    return Object.freeze({
      // `valid` means the config SHAPE is acceptable as opaque references — it does NOT configure or activate
      // anything; configured stays false and has_rpc stays false (resolution remains fail-closed).
      valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      configured: false,
      has_rpc: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      configured: false,
      has_rpc: false,
    });
  }
}

// Evaluate RPC readiness. This is ALWAYS not-ready: there is no RPC and no live path, so every input resolves to
// `rpc_provider_unconfigured_no_rpc`. The input is treated as a SIMULATED readiness description (not a live
// probe) and is inspected only to record blockers. The result is built from fixed literals — input is never
// echoed. Inspection is wrapped in try/catch so a hostile/throwing accessor RETURNS a refusal (never throws).
export function evaluateRpcReadiness(input) {
  const blockers = [];

  try {
    // live RPC is disabled by default — only an explicit simulated flag would mark it enabled (still not-ready).
    if (!(input != null && typeof input === 'object' && input.live_rpc_enabled === true)) {
      blockers.push('live_rpc_disabled_by_default');
    }
    // a (simulated) endpoint must be present for readiness; absence is a blocker.
    if (!(input != null && typeof input === 'object' && input.endpoint_present === true)) {
      blockers.push('missing_endpoint');
    }
    // a (simulated) failed provider status is a blocker.
    if (input != null && typeof input === 'object' && input.provider_status === 'failed') {
      blockers.push('provider_failed');
    }
    // threat indicators in the simulated input — conservative, fail-safe-not-fail-open.
    if (hasIndicator(input, MAINNET_TOKENS)) blockers.push('mainnet_indicator_blocked');
    if (hasIndicator(input, ENDPOINT_RPC_TOKENS)) blockers.push('endpoint_or_rpc_blocked');
    if (hasIndicator(input, BROADCAST_SEND_TOKENS)) blockers.push('send_or_broadcast_indicator_blocked');
    // key material — refuse; never echo it back.
    if (looksLikeKeyMaterial(input)) blockers.push('key_material_not_accepted');
  } catch {
    // Fail-safe-not-fail-open: a request whose inspection throws is still refused (never re-thrown, never an
    // error message echoed). The caught error object is deliberately NOT read — only a fixed blocker is added.
    if (!blockers.includes('input_inspection_error')) blockers.push('input_inspection_error');
  }

  // FOUNDATIONAL refusal — there is no RPC and no live path at all. ALWAYS present and ALWAYS last, so a
  // perfectly valid-looking input is still not-ready. This is the boundary's reason of record.
  blockers.push('rpc_provider_unconfigured_no_rpc');

  return Object.freeze({
    ready: false,
    configured: false,
    has_rpc: false,
    can_send: false,
    can_broadcast: false,
    live_rpc_enabled: false,
    status: UNCONFIGURED,
    reason: 'rpc_provider_unconfigured_no_rpc',
    blockers: Object.freeze(blockers),
  });
}

// Create a fail-closed RPC provider: an opaque object whose only decision surfaces (`validateConfig`,
// `evaluateReadiness`) always refuse / report not-ready. It exposes NO send/broadcast/serialize/sendTransaction/
// connect/rpc/submit method, is never configured, and contacts nothing.
export function createFailClosedRpcProvider() {
  return Object.freeze({
    status: UNCONFIGURED,
    isConfigured() { return false; },
    describe() { return describeRpcProviderContract(); },
    validateConfig(config) { return validateRpcProviderConfig(config); },
    evaluateReadiness(input) { return evaluateRpcReadiness(input); },
  });
}

// Explicit predicate the rest of the system can use to assert key-material refusal in tests/diagnostics.
export function refusesKeyMaterial(input) {
  return looksLikeKeyMaterial(input);
}

export const RPC_PROVIDER_CONTRACT_STATUS = UNCONFIGURED;
