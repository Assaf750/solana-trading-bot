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

// String-level key-material heuristic: PEM, a long base58 blob, or a mnemonic-length word list.
// (Regexes are guard-safe — lowercase, not the capitalized FORBIDDEN_CODE keypair forms.)
function stringLooksLikeKeyMaterial(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) return true;       // PEM private key
  if (/^[1-9A-HJ-NP-Za-km-z]{64,}$/.test(t)) return true;              // long base58 blob
  if (t.split(/\s+/).length >= 12) return true;                        // mnemonic-length word list
  return false;
}

// Is the given input "key-material-shaped"? Used ONLY to REFUSE such input — never to accept/store/return it.
// Conservative: refuses a PEM / long-base58 / mnemonic STRING, an object exposing a secret-NAMED field, AND an
// object carrying a key-material-shaped string VALUE (incl. one nested level) — so a secret smuggled into an
// opaque reference field (e.g. provider_ref / endpoint_ref) is refused, never accepted as a "valid reference".
function looksLikeKeyMaterial(input) {
  if (input == null) return false;
  if (typeof input === 'string') return stringLooksLikeKeyMaterial(input);
  if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (/secret|private|seed|mnemonic|keypair|key_material|raw_key/i.test(k)) return true;
      if (typeof v === 'string' && stringLooksLikeKeyMaterial(v)) return true;
      if (v != null && typeof v === 'object') {
        for (const [k2, v2] of Object.entries(v)) {
          if (/secret|private|seed|mnemonic|keypair|key_material|raw_key/i.test(k2)) return true;
          if (typeof v2 === 'string' && stringLooksLikeKeyMaterial(v2)) return true;
        }
      }
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

// ===========================================================================================================
// PR-E2-F-9 — PROVIDER REGISTRY (CONTRACT-ONLY, FAIL-CLOSED, NOT LIVE)
// ===========================================================================================================
// SOURCE: docs/00-ARCHITECTURE.md §15.12 (Wave 4 execution/providers boundary) + docs/01-SSOT Group 40.
//
// CONTRACT-ONLY registry over up to 3 provider SLOTS. Helius is the ONLY ENABLED provider reference now
// (reference-only — NO live). triton / yellowstone are DOC-LISTED DISABLED/future references (placeholders;
// NOT enabled, NOT live). Jito (execution/bundle) and Jupiter (routing) are NOT RPC providers in this contract
// and are deliberately EXCLUDED from the registry.
//
// The provider tokens 'helius'/'triton'/'yellowstone' below are STRING LITERAL VALUES (provider references),
// never import specifiers — guard-safe. This registry has NO live mechanism: no SDK, no dependency, no endpoint
// URL, no API key, no secret, no send. Every result is fail-closed (configured:false / has_rpc:false /
// can_send:false / is_live:false) and built from FIXED LITERALS + a numeric count + frozen reason tokens —
// slot contents / provider_ref / endpoint values are NEVER echoed. Per-slot validation REUSES the existing
// hardened validateRpcProviderConfig (shape + testnet + endpoint + key-material + unknown-field).

const MAX_PROVIDER_SLOTS = 3;
export const RPC_PROVIDER_MAX_SLOTS = MAX_PROVIDER_SLOTS;

// The only ENABLED provider reference now (reference-only, NO live).
const SUPPORTED_PROVIDER_REFS = Object.freeze(['helius']);
// Doc-listed DISABLED/future references only (placeholders; NOT enabled, NOT live).
const DOC_LISTED_DISABLED_PROVIDER_REFS = Object.freeze(['triton', 'yellowstone']);

// Hard cap on iteration so a hostile huge input can never make us loop unboundedly. We only ever COUNT and
// per-slot-classify; slot CONTENTS are never echoed.
const SLOT_ITERATION_CAP = 100;

// Coerce arbitrary input into a slots array WITHOUT echoing contents:
//   Array                       -> itself
//   { slots: Array }            -> slots
//   a single slot-shaped object -> [it]
//   null / undefined / other    -> []
// A "slot-shaped object" is a plain object that is not the {slots:Array} wrapper.
function coerceToSlots(input) {
  if (Array.isArray(input)) return input;
  if (input != null && typeof input === 'object') {
    if (Array.isArray(input.slots)) return input.slots;
    // a single slot-shaped object (not a {slots:Array} wrapper) -> wrap as one slot.
    return [input];
  }
  return [];
}

// Describe the provider REGISTRY contract: contract-only, Helius enabled reference-only, others doc-listed/
// disabled, fail-closed, no live/SDK/endpoint/send. Read-only; describes intent, performs nothing.
export function describeRpcProviderRegistry() {
  return Object.freeze({
    contract: 'rpc-provider-registry',
    version: '0.0.0',
    max_provider_slots: MAX_PROVIDER_SLOTS,
    supported_provider_refs: SUPPORTED_PROVIDER_REFS,
    doc_listed_disabled_provider_refs: DOC_LISTED_DISABLED_PROVIDER_REFS,
    configured: false,
    has_rpc: false,
    can_send: false,
    is_live: false,
    status: UNCONFIGURED,
    note: 'Provider registry is CONTRACT-ONLY: Helius enabled reference-only, triton/yellowstone doc-listed/'
      + 'disabled, Jito/Jupiter excluded; fail-closed, no live, no SDK, no endpoint, no send.',
  });
}

// The list of ENABLED provider references (reference-only). Frozen; references-only, NOT live.
export function listSupportedRpcProviderRefs() {
  return SUPPORTED_PROVIDER_REFS;
}

// Normalize/count provider slots WITHOUT echoing slot contents. Coerces input as coerceToSlots, counts entries
// (capped at SLOT_ITERATION_CAP to guard huge inputs), and reports capacity classification. Never throws — the
// whole body is wrapped so a hostile/throwing accessor RETURNS a fixed 'invalid' refusal.
export function normalizeRpcProviderSlots(input) {
  try {
    const slots = coerceToSlots(input);
    // Count entries with a hard cap so a hostile huge input cannot make us iterate unboundedly.
    let count = 0;
    const len = slots.length;
    const bound = len > SLOT_ITERATION_CAP ? SLOT_ITERATION_CAP : len;
    for (let i = 0; i < bound; i += 1) count += 1;
    const withinCapacity = count >= 1 && count <= MAX_PROVIDER_SLOTS;
    let status;
    if (count === 0) status = UNCONFIGURED;
    else if (withinCapacity) status = 'within_capacity_no_rpc';
    else status = 'over_capacity';
    return Object.freeze({
      count,
      within_capacity: withinCapacity,
      max_provider_slots: MAX_PROVIDER_SLOTS,
      status,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      count: 0,
      within_capacity: false,
      max_provider_slots: MAX_PROVIDER_SLOTS,
      status: 'invalid',
    });
  }
}

// Validate a provider SELECTION (up to 3 slots) WITHOUT activating anything. Reuses the hardened
// validateRpcProviderConfig per slot (shape + testnet + endpoint + key-material + unknown-field), then classifies
// each slot's provider_ref against the ENABLED list (helius), the doc-listed DISABLED list (triton/yellowstone),
// and detects duplicates / unknown refs. A 'valid' selection is REFERENCES-ONLY and stays configured:false /
// has_rpc:false / can_send:false (NOT live). The result is built from FIXED LITERAL reason tokens + a numeric
// slot_count — slot / provider_ref / endpoint / secret VALUES are NEVER echoed. Never throws.
export function validateRpcProviderSelection(selection) {
  try {
    const slots = coerceToSlots(selection);
    const slotCount = slots.length;
    const reasons = [];

    if (slotCount === 0) reasons.push('no_provider_slots');
    if (slotCount > MAX_PROVIDER_SLOTS) reasons.push('too_many_provider_slots');

    const seen = [];
    const bound = slotCount > SLOT_ITERATION_CAP ? SLOT_ITERATION_CAP : slotCount;
    for (let i = 0; i < bound; i += 1) {
      const slot = slots[i];
      // Reuse the existing hardened validator (NOT weakened). It is itself try/catch-wrapped and never throws.
      const cfg = validateRpcProviderConfig(slot);
      if (!cfg.valid) {
        // Propagate per-slot reasons as FIXED tokens (no values echoed): key_material_not_accepted /
        // mainnet_or_nontestnet_environment_blocked / endpoint_or_rpc_indicator_blocked / unknown_field_rejected
        // / missing_provider_ref / missing_config / send_or_broadcast_indicator_blocked / input_inspection_error.
        for (const r of cfg.reasons) reasons.push(r);
      } else {
        const ref = (slot != null && typeof slot === 'object' && typeof slot.provider_ref === 'string')
          ? slot.provider_ref
          : '';
        if (SUPPORTED_PROVIDER_REFS.includes(ref)) {
          if (seen.includes(ref)) reasons.push('duplicate_provider');
          else seen.push(ref);
        } else if (DOC_LISTED_DISABLED_PROVIDER_REFS.includes(ref)) {
          reasons.push('provider_not_enabled');
        } else {
          reasons.push('unknown_provider');
        }
      }
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const valid = uniqueReasons.length === 0 && slotCount >= 1 && slotCount <= MAX_PROVIDER_SLOTS;
    let status;
    if (valid) status = 'selection_valid_no_rpc';
    else if (slotCount === 0) status = UNCONFIGURED;
    else status = 'invalid';

    return Object.freeze({
      // `valid` means the selection SHAPE is acceptable as opaque references — it does NOT configure or activate
      // anything; configured/has_rpc/can_send stay false (resolution remains fail-closed, NOT live).
      valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      configured: false,
      has_rpc: false,
      can_send: false,
      slot_count: slotCount,
      max_provider_slots: MAX_PROVIDER_SLOTS,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      configured: false,
      has_rpc: false,
      can_send: false,
      slot_count: 0,
      max_provider_slots: MAX_PROVIDER_SLOTS,
    });
  }
}

// ===========================================================================================================
// PR-E2-F-10 — HELIUS ENDPOINT PROVISIONING (CONTRACT-ONLY, REFERENCE-ONLY, FAIL-CLOSED, NOT LIVE)
// ===========================================================================================================
// SOURCE: docs/00-ARCHITECTURE.md §15.12 (Wave 4 execution/providers boundary) + docs/01-SSOT Group 40
// (candidate provider vocabulary — provider_key_ref by reference only, no raw key).
//
// CONTRACT-ONLY endpoint-PROVISIONING layer over Helius. REFERENCE-ONLY and fail-closed: an endpoint is named by
// an OPAQUE reference token (endpoint_ref) — there is NO live RPC, NO SDK, NO dependency, NO endpoint URL, NO API
// key, NO secret/token, NO send. "Provisioning" here means CLASSIFYING the shape of a reference-only provisioning
// description; it provisions/activates/contacts nothing. Every result is fail-closed (configured:false /
// has_rpc:false / ready:false / can_send:false / is_live:false) and is built from FIXED LITERALS + frozen reason
// tokens + a numeric slot_count — input / endpoint_ref / secret VALUES are NEVER echoed. Per-slot shape validation
// REUSES the hardened validateRpcProviderConfig (testnet-family environment; refuses mainnet/url/api_key/rpc/
// provider_url; refuses key material; rejects unknown fields; treats endpoint_ref as an optional opaque ref that
// refuses endpoint/url/rpc indicators) — it is NOT weakened.
//
// The token list below is composed of STRING LITERAL VALUES (refusal match tokens), never import specifiers —
// the module stays import-free and guard-safe. A real Helius endpoint / live provisioning is a separate,
// explicitly-approved PR and is NOT started here.

// Endpoint-reference secret indicators: a provisioning endpoint_ref must be an opaque reference, never a secret/
// token/credential/api-key/private-key marker. String literal VALUES (lexer-blanked) — never executed, only
// substring-matched. Conservative by design (over-refusal is fail-safe-not-fail-open).
const SECRET_INDICATOR_TOKENS = Object.freeze([
  'secret', 'token', 'credential', 'apikey', 'api_key', 'private_key', 'privatekey',
]);

// Describe the Helius endpoint-PROVISIONING contract: reference-only, fail-closed, no live/SDK/endpoint/key/send.
// Read-only; describes intent, performs nothing.
export function describeHeliusEndpointProvisioningContract() {
  return Object.freeze({
    contract: 'helius-endpoint-provisioning',
    version: '0.0.0',
    provider_ref: 'helius',
    supported_environments: Object.freeze(['devnet', 'testnet', 'localnet']),
    max_provider_slots: 3,
    configured: false,
    has_rpc: false,
    ready: false,
    can_send: false,
    is_live: false,
    status: UNCONFIGURED,
    note: 'Helius endpoint provisioning is reference-only; endpoint_ref is an opaque reference; no URL, no API '
      + 'key, no secret, no token, no mainnet, no live, no SDK, no send.',
  });
}

// Validate a SINGLE provisioning slot WITHOUT provisioning/activating anything. Reuses the hardened
// validateRpcProviderConfig for the shape (testnet-family environment; refuses mainnet/url/api_key/rpc; refuses
// key material; rejects unknown fields; endpoint_ref opaque-only). Then classifies provider_ref against the
// ENABLED list (helius) vs. doc-listed DISABLED refs (triton/yellowstone) vs. unknown, and requires endpoint_ref
// to be a present, opaque reference carrying no secret/token/credential/api-key indicator. The result is built
// from FIXED LITERALS + slot reasons — input / endpoint_ref / secret VALUES are NEVER echoed.
export function validateHeliusEndpointProvisioning(input) {
  try {
    // Reuse the existing hardened validator (NOT weakened). It is itself try/catch-wrapped and never throws.
    const cfg = validateRpcProviderConfig(input);
    const reasons = [];
    if (!cfg.valid) for (const r of cfg.reasons) reasons.push(r);

    // provider_ref classification: only 'helius' is enabled (reference-only); doc-listed disabled refs ->
    // provider_not_enabled; anything else -> unknown_provider.
    const ref = (input && typeof input === 'object' && typeof input.provider_ref === 'string')
      ? input.provider_ref
      : '';
    if (ref === 'helius') { /* enabled reference (reference-only, NOT live) */ }
    else if (DOC_LISTED_DISABLED_PROVIDER_REFS.includes(ref)) reasons.push('provider_not_enabled');
    else reasons.push('unknown_provider');

    // endpoint_ref: REQUIRED opaque reference; never a secret/token/credential/api-key indicator.
    const ep = (input && typeof input === 'object') ? input.endpoint_ref : undefined;
    if (typeof ep !== 'string' || ep.length === 0) reasons.push('endpoint_ref_missing');
    else if (SECRET_INDICATOR_TOKENS.some((t) => ep.toLowerCase().indexOf(t) !== -1)) {
      reasons.push('endpoint_secret_indicator_blocked');
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const valid = uniqueReasons.length === 0;
    let status;
    if (valid) status = 'provisioning_valid_no_live';
    else if (uniqueReasons.includes('endpoint_ref_missing')
      || uniqueReasons.includes('missing_provider_ref')
      || uniqueReasons.includes('mainnet_or_nontestnet_environment_blocked')) status = UNCONFIGURED;
    else status = 'invalid';

    return Object.freeze({
      // `valid` means the provisioning SHAPE is acceptable as opaque references — it does NOT provision or
      // activate anything; configured/has_rpc/ready/can_send/is_live stay false (fail-closed, NOT live).
      valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      is_live: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      is_live: false,
    });
  }
}

// Validate a MULTI-slot provisioning SELECTION (1..3 slots) WITHOUT provisioning/activating anything. Coerces
// input to a slots array (same coercion as the F9 registry), validates each slot via
// validateHeliusEndpointProvisioning (per-slot reasons propagated as fixed tokens), and detects duplicate
// endpoint_ref across slots. The result is built from FIXED LITERALS + a numeric slot_count + frozen reason
// tokens — slot / endpoint_ref / secret VALUES are NEVER echoed. Never throws.
export function validateProviderEndpointRefs(selection) {
  try {
    const slots = coerceToSlots(selection);
    const slotCount = slots.length;
    const reasons = [];

    if (slotCount === 0) reasons.push('no_provider_slots');
    if (slotCount > MAX_PROVIDER_SLOTS) reasons.push('too_many_provider_slots');

    const seenEndpoints = [];
    const bound = slotCount > SLOT_ITERATION_CAP ? SLOT_ITERATION_CAP : slotCount;
    for (let i = 0; i < bound; i += 1) {
      const slot = slots[i];
      const v = validateHeliusEndpointProvisioning(slot);
      if (!v.valid) {
        for (const r of v.reasons) reasons.push(r);
      } else {
        // A valid slot is guaranteed (by validateHeliusEndpointProvisioning) to carry a non-empty string
        // endpoint_ref; detect duplicates across slots without echoing the value.
        const ep = slot.endpoint_ref;
        if (seenEndpoints.includes(ep)) reasons.push('duplicate_endpoint_ref');
        else seenEndpoints.push(ep);
      }
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const valid = uniqueReasons.length === 0 && slotCount >= 1 && slotCount <= MAX_PROVIDER_SLOTS;
    let status;
    if (valid) status = 'provisioning_valid_no_live';
    else if (slotCount === 0) status = UNCONFIGURED;
    else status = 'invalid';

    return Object.freeze({
      // `valid` means the selection SHAPE is acceptable as opaque references — it does NOT provision or activate
      // anything; configured/has_rpc/ready/can_send/is_live stay false (fail-closed, NOT live).
      valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      is_live: false,
      slot_count: slotCount,
      max_provider_slots: MAX_PROVIDER_SLOTS,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      is_live: false,
      slot_count: 0,
      max_provider_slots: MAX_PROVIDER_SLOTS,
    });
  }
}
