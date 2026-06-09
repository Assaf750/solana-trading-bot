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

// ===========================================================================================================
// PR-E2-F-11 — ENDPOINT-REFERENCE BINDING HARNESS (CONTRACT-ONLY, REFERENCE-ONLY, FAIL-CLOSED, NOT LIVE)
// ===========================================================================================================
// SOURCE: docs/00-ARCHITECTURE.md §15.12 (Wave 4 execution/providers boundary) + docs/01-SSOT Group 40
// (candidate provider vocabulary — provider_key_ref by reference only, no raw key).
//
// CONTRACT-ONLY BINDING HARNESS that proves an opaque endpoint_ref can be BOUND to a TEST-ONLY IN-MEMORY binding
// map and STAY fail-closed. It is NOT live: it reads NO env, reads NO secret file, contacts NO provider, accepts
// NO URL / API key / secret, returns NO raw endpoint, makes NO network call, and NEVER sets has_rpc / ready /
// can_send / is_live true. "Binding" here means a pure in-memory lookup that CLASSIFIES whether an endpoint_ref is
// present in a caller-supplied TEST-ONLY map of opaque reference-only entries — it binds/activates/contacts
// nothing real. Every result is built from FIXED LITERALS + frozen reason tokens + a boolean `bound` flag; the
// input / endpoint_ref / binding entry VALUES are NEVER echoed. Input + binding-entry shape validation REUSES the
// hardened validateHeliusEndpointProvisioning + looksLikeKeyMaterial + the existing indicator token lists
// (ENDPOINT_RPC_TOKENS / SECRET_INDICATOR_TOKENS / MAINNET_TOKENS) — they are NOT weakened.
//
// A binding-map ENTRY is screened EXACTLY like an input: a hostile entry that smuggles an endpoint/url/rpc
// indicator, a secret/token/credential indicator, a mainnet/prod indicator, or key-material is REFUSED (and never
// echoed). Any entry has_rpc/ready/can_send/is_live/configured flag is IGNORED and NEVER trusted — the result
// flags are FIXED LITERALS (all false). A real endpoint binding / live wiring is a separate, explicitly-approved
// PR and is NOT started here.

// The canonical TEST-ONLY binding-entry shape's known keys. These are part of the mandated reference-only entry
// ({ bound, provider_ref, environment, endpoint_kind }) and are NOT smuggled live surfaces — they are excluded
// from the entry KEY-NAME indicator scan (so the legitimate `endpoint_kind` key is not mistaken for an endpoint
// indicator). Their string VALUES are STILL fully scanned, and any UNKNOWN key name is STILL scanned.
const BINDING_ENTRY_KNOWN_KEYS = Object.freeze(['bound', 'provider_ref', 'environment', 'endpoint_kind']);

// Screen a binding-map ENTRY (its keys OR string values, shallow + one nested level) for blocked indicators,
// EXACTLY as an input is screened. Returns a list of FIXED reason tokens (never echoes the entry's values).
// Reuses the existing indicator token lists + looksLikeKeyMaterial — not weakened. The canonical entry keys are
// excluded from the KEY-NAME indicator scan (the mandated `endpoint_kind` key is not a smuggled live surface),
// but ALL string values (and any unknown key names) are still scanned, shallow + one nested level.
function screenBindingEntry(entry) {
  const reasons = [];
  if (entry == null || typeof entry !== 'object') return reasons;

  // Build the match set: scan every string VALUE; scan KEY NAMES only when the key is not a known canonical key.
  // One nested level: a nested object's values are scanned, and its unknown key names too.
  const hay = [];
  for (const [k, val] of Object.entries(entry)) {
    if (!BINDING_ENTRY_KNOWN_KEYS.includes(k)) hay.push(String(k).toLowerCase());
    if (typeof val === 'string') hay.push(val.toLowerCase());
    else if (val != null && typeof val === 'object') {
      for (const [k2, v2] of Object.entries(val)) {
        if (!BINDING_ENTRY_KNOWN_KEYS.includes(k2)) hay.push(String(k2).toLowerCase());
        if (typeof v2 === 'string') hay.push(v2.toLowerCase());
      }
    }
  }
  const carries = (tokens) => tokens.some((t) => hay.some((s) => s.indexOf(t) !== -1));

  if (carries(ENDPOINT_RPC_TOKENS)) reasons.push('endpoint_or_rpc_indicator_blocked');
  if (carries(SECRET_INDICATOR_TOKENS)) reasons.push('endpoint_secret_indicator_blocked');
  if (carries(MAINNET_TOKENS)) reasons.push('mainnet_or_nontestnet_environment_blocked');
  // key-material heuristic over the whole entry (secret-NAMED fields / key-material-shaped string values).
  if (looksLikeKeyMaterial(entry)) reasons.push('key_material_not_accepted');
  return reasons;
}

// Describe the endpoint-reference BINDING HARNESS contract: test-only, in-memory, reference-only, fail-closed,
// no env / no secret file / no URL / no API key / no secret / no live. Read-only; describes intent, performs
// nothing.
export function describeEndpointReferenceBindingHarness() {
  return Object.freeze({
    contract: 'endpoint-reference-binding-harness',
    version: '0.0.0',
    test_only: true,
    reads_env: false,
    reads_secret_files: false,
    provider_ref: 'helius',
    supported_environments: Object.freeze(['devnet', 'testnet', 'localnet']),
    configured: false,
    has_rpc: false,
    ready: false,
    can_send: false,
    is_live: false,
    network_call_made: false,
    status: UNCONFIGURED,
    note: 'Test-only in-memory reference binding; reads no env/secret; no URL, no API key, no secret; never live.',
  });
}

// Validate a SINGLE binding INPUT object {provider_ref, environment, endpoint_ref, ...} as a reference-only
// binding shape. Reuses the hardened validateHeliusEndpointProvisioning (testnet-family environment; helius-only;
// required opaque endpoint_ref free of secret/endpoint/url/rpc indicators; refuses key material / unknown fields).
// The result is built from FIXED LITERALS + frozen reason tokens — input / endpoint_ref VALUES are NEVER echoed.
// Never throws — a hostile/throwing accessor RETURNS a frozen invalid refusal.
export function validateEndpointReferenceBinding(input) {
  try {
    const v = validateHeliusEndpointProvisioning(input);
    return Object.freeze({
      // `valid` means the binding INPUT SHAPE is acceptable as opaque references — it does NOT bind or activate
      // anything; configured/has_rpc/ready/can_send/is_live stay false (fail-closed, NOT live).
      valid: v.valid,
      status: v.valid ? 'reference_bound_no_live' : v.status,
      reasons: Object.freeze([...v.reasons]),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      is_live: false,
      network_call_made: false,
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
      network_call_made: false,
    });
  }
}

// The binding-harness CORE: prove an endpoint_ref can be BOUND to a TEST-ONLY IN-MEMORY binding map and stay
// fail-closed. input = {provider_ref, environment, endpoint_ref}; bindingMap = a TEST-ONLY plain object mapping
// endpoint_ref -> { bound: true, provider_ref, environment, endpoint_kind: 'reference_only' }. This performs a
// PURE in-memory lookup: it binds/activates/contacts NOTHING real, makes NO network call, reads NO env/secret.
// Every path is wrapped so a hostile/throwing accessor RETURNS a frozen invalid refusal (never throws, never
// echoes). The result flags are FIXED LITERALS (all false) — any entry flags are IGNORED and NEVER trusted.
export function bindEndpointReferenceForTest(input, bindingMap) {
  try {
    const reasons = [];

    // 1) Validate the binding INPUT shape via the hardened provisioning validator (NOT weakened). It is itself
    //    try/catch-wrapped and never throws. On invalid shape, propagate its reasons and stay unbound.
    const v = validateHeliusEndpointProvisioning(input);
    if (!v.valid) for (const r of v.reasons) reasons.push(r);

    // 2) bindingMap must be a non-null plain object (the TEST-ONLY in-memory map). Reject otherwise.
    const mapOk = bindingMap != null && typeof bindingMap === 'object' && !Array.isArray(bindingMap);
    if (!mapOk) reasons.push('endpoint_ref_unbound');

    // 3) Look up the entry for the input's endpoint_ref WITHOUT echoing it. Absent / not-bound -> unbound.
    let entry;
    let entryPresentAndBound = false;
    if (mapOk) {
      const epRef = (input != null && typeof input === 'object' && typeof input.endpoint_ref === 'string')
        ? input.endpoint_ref
        : '';
      entry = epRef.length > 0 ? bindingMap[epRef] : undefined;
      if (entry == null || typeof entry !== 'object' || entry.bound !== true) {
        if (!reasons.includes('endpoint_ref_unbound')) reasons.push('endpoint_ref_unbound');
      } else {
        entryPresentAndBound = true;
        // 4) SCREEN the entry EXACTLY like an input — refuse (and NEVER echo) any blocked indicator.
        for (const r of screenBindingEntry(entry)) {
          if (!reasons.includes(r)) reasons.push(r);
        }
        // 5) Mismatch checks: entry provider_ref / environment must match the input (references-only).
        if (entry.provider_ref !== (input != null ? input.provider_ref : undefined)) {
          reasons.push('endpoint_ref_provider_mismatch');
        }
        if (entry.environment !== (input != null ? input.environment : undefined)) {
          reasons.push('endpoint_ref_environment_mismatch');
        }
        // 6) IGNORE any entry.has_rpc / entry.ready / entry.can_send / entry.is_live / entry.configured flags —
        //    they are NEVER trusted; the result flags below are FIXED LITERALS (all false).
      }
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const bound = uniqueReasons.length === 0 && entryPresentAndBound;
    const valid = bound;
    let status;
    if (bound) status = 'reference_bound_no_live';
    else if (uniqueReasons.includes('endpoint_ref_unbound')) status = 'unbound';
    else status = 'invalid';

    return Object.freeze({
      // `bound`/`valid` mean the endpoint_ref matched a TEST-ONLY in-memory reference entry — it does NOT bind or
      // activate anything real; configured/has_rpc/ready/can_send/is_live/network_call_made stay false (NOT live).
      bound,
      valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      is_live: false,
      network_call_made: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      bound: false,
      valid: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      is_live: false,
      network_call_made: false,
    });
  }
}

// ===========================================================================================================
// PR-E2-F-13 — LIVE RPC SPIKE BOUNDARY (CONTRACT-ONLY, TEST-ONLY, NO-BROADCAST, NO-LIVE)
// ===========================================================================================================
// SOURCE: docs/00-ARCHITECTURE.md §15.12 (Wave 4 execution/providers boundary) + docs/09-THREAT-SECURITY +
// docs/01-SSOT Group 40 (candidate provider vocabulary — provider_key_ref by reference only, no raw key).
//
// CONTRACT-ONLY "Live RPC Spike Boundary": it DESCRIBES/VALIDATES the conditions of a FUTURE testnet RPC spike
// REQUEST and executes NO live RPC. It is NOT live in any way: NO live RPC call, NO endpoint resolution, NO env/
// secret read, NO fetch/WebSocket/Connection, NO SDK/dependency, NO send/broadcast/serialize. A spike boundary
// never sends, never broadcasts, never serializes — and it must be a NO-BROADCAST request bound to a TEST-ONLY
// in-memory endpoint reference. Everything is fail-closed: every result field is a FIXED LITERAL (all false /
// not-ready / not-live), input / endpoint_ref / secret / binding VALUES are NEVER echoed, and provider_ref is
// only ever the recognized literal 'helius' while environment is only a recognized testnet enum value.
//
// This layer is ADDITIVE — it does NOT alter the contract/registry/provisioning/binding layers above. It REUSES
// the hardened bindEndpointReferenceForTest + validateHeliusEndpointProvisioning + looksLikeKeyMaterial + the
// existing indicator token lists (ENDPOINT_RPC_TOKENS / SECRET_INDICATOR_TOKENS / MAINNET_TOKENS) + the enabled/
// disabled provider-ref lists — none of which is weakened. A real testnet RPC spike (a live call) is a separate,
// explicitly-approved PR and is NOT started here.

// Request-level broadcast/send/serialize indicators that must NOT be present: a spike boundary never sends,
// broadcasts, or serializes. STRING LITERAL VALUES (lexer-blanked match tokens) — never executed, only
// substring-matched. Conservative by design (over-refusal is fail-safe-not-fail-open).
const BROADCAST_SEND_BOUNDARY_TOKENS = Object.freeze(['broadcast', 'send', 'serialize']);

// The only request fields permitted on a spike-boundary REQUEST — anything else is an unknown field and is
// rejected (no surprise fields, incl. smuggled has_rpc/ready/can_send/is_live/configured/broadcast flags). All
// permitted fields are opaque references / fixed enums; none is a key, a secret, or a live endpoint.
const SPIKE_REQUEST_KNOWN_FIELDS = Object.freeze([
  'provider_ref', 'environment', 'endpoint_ref', 'purpose', 'no_broadcast',
]);

// Describe the Live RPC Spike Boundary contract: test-only, no-broadcast, reference-only, fail-closed; describes
// a FUTURE testnet spike request; performs NO live RPC / endpoint resolution / network / send; reads no env/
// secret. Read-only; describes intent, performs nothing.
export function describeLiveRpcSpikeBoundaryContract() {
  return Object.freeze({
    contract: 'live-rpc-spike-boundary',
    version: '0.0.0',
    test_only: true,
    purpose: 'live_rpc_spike_boundary',
    provider_ref: 'helius',
    supported_environments: Object.freeze(['devnet', 'testnet', 'localnet']),
    requires_no_broadcast: true,
    requires_bound_endpoint_ref: true,
    configured: false,
    has_rpc: false,
    ready: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    is_live: false,
    live_rpc_call_made: false,
    network_call_made: false,
    broadcast_permitted: false,
    status: UNCONFIGURED,
    note: 'Test-only boundary; describes a future testnet spike request; performs NO live RPC / endpoint '
      + 'resolution / network / send; reads no env/secret.',
  });
}

// Validate the spike-boundary REQUEST SHAPE only (NOT the binding). Reuses validateHeliusEndpointProvisioning for
// provider/environment/endpoint_ref/secret/key-material/mainnet shape (reasons propagated), then requires
// purpose === 'live_rpc_spike_boundary', no_broadcast === true, refuses any broadcast/send/serialize indicator,
// and rejects unknown fields beyond the known set. The result is built from FIXED LITERALS + frozen reason tokens
// — input / endpoint_ref / secret VALUES are NEVER echoed. Never throws — a hostile/throwing accessor RETURNS a
// frozen refusal.
export function validateLiveRpcSpikeBoundaryRequest(input) {
  try {
    const reasons = [];

    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;

    // 1) Reuse the hardened provisioning validator (NOT weakened) for provider/environment/endpoint_ref shape ONLY.
    //    Pass ONLY the 3 provisioning fields — the spike's own fields (purpose / no_broadcast) must NOT reach the
    //    provisioning validator, else `purpose`/`no_broadcast` trip unknown_field_rejected and its substring scans
    //    falsely refuse a legitimate request (the 'rpc' inside the required purpose value 'live_rpc_spike_boundary',
    //    and the 'broadcast' inside the required 'no_broadcast' key).
    const prov = validateHeliusEndpointProvisioning(obj
      ? { provider_ref: obj.provider_ref, environment: obj.environment, endpoint_ref: obj.endpoint_ref }
      : input);
    if (!prov.valid) for (const r of prov.reasons) reasons.push(r);

    // 2) purpose must be exactly the spike-boundary purpose.
    const purpose = obj ? obj.purpose : undefined;
    if (purpose !== 'live_rpc_spike_boundary') reasons.push('purpose_invalid');

    // 3) no_broadcast must be explicitly true — a spike boundary never broadcasts/sends.
    const noBroadcast = obj ? obj.no_broadcast : undefined;
    if (noBroadcast !== true) reasons.push('no_broadcast_required');

    // 4) any broadcast/send/serialize indicator is refused (e.g. broadcast:true, send:true, serialize:true, or a
    //    'broadcast'/'send'/'serialize'-shaped KEY, or such a token in a string VALUE). The legitimate
    //    'no_broadcast' key and the fixed 'live_rpc_spike_boundary' purpose literal are EXCLUDED from this scan.
    if (obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'no_broadcast') continue;
        const lk = String(k).toLowerCase();
        if (BROADCAST_SEND_BOUNDARY_TOKENS.some((t) => lk.indexOf(t) !== -1)) {
          if (!reasons.includes('broadcast_or_send_indicator_blocked')) reasons.push('broadcast_or_send_indicator_blocked');
          break;
        }
        if (k === 'purpose') continue; // the required fixed purpose literal is not a broadcast/send/serialize value
        if (typeof v === 'string' && BROADCAST_SEND_BOUNDARY_TOKENS.some((t) => v.toLowerCase().indexOf(t) !== -1)) {
          if (!reasons.includes('broadcast_or_send_indicator_blocked')) reasons.push('broadcast_or_send_indicator_blocked');
          break;
        }
      }
    }

    // 5) unknown / surprise field — only the spike known fields (provider_ref/environment/endpoint_ref/purpose/
    //    no_broadcast) are permitted; any field beyond the known set is rejected here.
    if (obj && Object.keys(obj).some((k) => !SPIKE_REQUEST_KNOWN_FIELDS.includes(k))) {
      if (!reasons.includes('unknown_field_rejected')) reasons.push('unknown_field_rejected');
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const valid = uniqueReasons.length === 0;
    let status;
    if (valid) status = 'live_rpc_spike_boundary_no_live';
    else if (prov.status === UNCONFIGURED
      && !uniqueReasons.includes('broadcast_or_send_indicator_blocked')
      && !uniqueReasons.includes('unknown_field_rejected')) status = UNCONFIGURED;
    else status = 'invalid';

    return Object.freeze({
      // `valid` means the REQUEST SHAPE is acceptable as opaque references / fixed enums — it does NOT bind, send,
      // broadcast, serialize, or activate anything; every flag below is a FIXED LITERAL (all false), NOT live.
      valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      live_rpc_call_made: false,
      network_call_made: false,
      broadcast_permitted: false,
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
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      live_rpc_call_made: false,
      network_call_made: false,
      broadcast_permitted: false,
    });
  }
}

// The Live RPC Spike Boundary CORE: prove the conditions of a FUTURE testnet RPC spike REQUEST are well-formed AND
// bound to a TEST-ONLY in-memory endpoint reference, while staying fully fail-closed and NEVER live. It does NOT
// resolve an endpoint, make a live RPC call, contact a provider, read env/secret, or send/broadcast/serialize.
// Logic: (1) validate the request shape; if invalid, propagate reasons. (2) reuse bindEndpointReferenceForTest
// against the TEST-ONLY in-memory binding map; if not bound, push 'endpoint_ref_unbound' and surface the binding
// reasons under an 'endpoint_binding:' prefix. (3) boundary_passed iff no reasons. The result flags are FIXED
// LITERALS (all false); provider_ref is only ever the literal 'helius' and environment only a recognized testnet
// enum value, echoed ONLY when valid. Input / endpoint_ref / binding / secret VALUES are NEVER echoed. Never
// throws — a hostile/throwing accessor RETURNS a frozen invalid refusal.
export function evaluateLiveRpcSpikeBoundary(input, bindingMap) {
  try {
    const reasons = [];

    // 1) Validate the REQUEST SHAPE (reuses validateHeliusEndpointProvisioning + spike rules). Never throws.
    const reqv = validateLiveRpcSpikeBoundaryRequest(input);
    if (!reqv.valid) for (const r of reqv.reasons) reasons.push(r);

    // 2) Bind the endpoint_ref against the TEST-ONLY in-memory binding map (reuses the hardened, fail-closed
    //    bindEndpointReferenceForTest — NOT weakened; it screens entries and never echoes values).
    const b = bindEndpointReferenceForTest(
      {
        provider_ref: (input != null && typeof input === 'object') ? input.provider_ref : undefined,
        environment: (input != null && typeof input === 'object') ? input.environment : undefined,
        endpoint_ref: (input != null && typeof input === 'object') ? input.endpoint_ref : undefined,
      },
      bindingMap,
    );
    if (b.bound !== true) {
      if (!reasons.includes('endpoint_ref_unbound')) reasons.push('endpoint_ref_unbound');
      // Surface the binding refusal reasons under a fixed prefix (FIXED tokens only — never echoes values).
      for (const r of b.reasons) {
        const prefixed = `endpoint_binding:${r}`;
        if (!reasons.includes(prefixed)) reasons.push(prefixed);
      }
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    // 3) The boundary passes iff there are zero reasons.
    const boundaryPassed = uniqueReasons.length === 0;
    const valid = boundaryPassed;

    // 4) Status: passed -> the no-live boundary status; an unbound endpoint or an unconfigured request shape ->
    //    unconfigured_no_rpc; everything else -> invalid.
    let status;
    if (boundaryPassed) status = 'live_rpc_spike_boundary_no_live';
    else if (uniqueReasons.includes('endpoint_ref_unbound') || reqv.status === UNCONFIGURED) status = UNCONFIGURED;
    else status = 'invalid';

    return Object.freeze({
      // `valid`/`boundary_passed` mean the FUTURE-spike REQUEST is well-formed and matched a TEST-ONLY in-memory
      // reference entry — it does NOT resolve an endpoint, call RPC, send, broadcast, serialize, or go live; every
      // flag below is a FIXED LITERAL (all false). provider_ref/environment are echoed ONLY when valid and are
      // only ever the recognized literal 'helius' / a recognized testnet enum value (never a secret/endpoint).
      valid,
      boundary_passed: boundaryPassed,
      status,
      provider_ref: boundaryPassed ? 'helius' : undefined,
      environment: boundaryPassed ? String(input.environment) : undefined,
      bound: boundaryPassed === true,
      reasons: Object.freeze([...uniqueReasons]),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      live_rpc_call_made: false,
      network_call_made: false,
      broadcast_permitted: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      boundary_passed: false,
      status: 'invalid',
      provider_ref: undefined,
      environment: undefined,
      bound: false,
      reasons: Object.freeze(['input_inspection_error']),
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      live_rpc_call_made: false,
      network_call_made: false,
      broadcast_permitted: false,
    });
  }
}

// ============================================================================================================
// Live RPC Spike APPROVAL GATE (E2-F-14) — test-only, contract/boundary layer ONLY.
// ------------------------------------------------------------------------------------------------------------
// This layer validates the SHAPE of an APPROVAL RECORD for a FUTURE testnet RPC spike. It is ADDITIVE — it does
// NOT alter or weaken the contract / registry / provisioning / binding / F-13 spike-boundary layers above. It
// REUSES the hardened validateHeliusEndpointProvisioning + looksLikeKeyMaterial + the existing
// BROADCAST_SEND_BOUNDARY_TOKENS list + the UNCONFIGURED status literal — none of which is weakened.
//
// CRITICAL INVARIANT: an APPROVED record authorizes NOTHING live. A separate live-spike PR + out-of-repo
// endpoint binding + supply-chain review are ALWAYS still required (requires_separate_live_spike_pr is a FIXED
// LITERAL true on every result, never echoed from input). This layer performs NO live RPC / endpoint resolution
// / network / send / broadcast / serialize, contacts no provider, and reads no env/secret.

// The approval-record fields that MUST be exactly boolean-true (each paired with the fixed refusal token emitted
// when missing/non-true). STRING LITERAL reason tokens — never executed, never echoed.
const APPROVAL_GATE_REQUIRED_TRUE = Object.freeze([
  ['no_broadcast', 'no_broadcast_required'],
  ['no_send', 'no_send_required'],
  ['no_mainnet', 'no_mainnet_required'],
  ['no_real_live', 'no_real_live_required'],
  ['requires_separate_live_spike_pr', 'separate_live_spike_pr_required'],
  ['requires_out_of_repo_endpoint_binding', 'out_of_repo_endpoint_binding_required'],
  ['requires_supply_chain_review', 'supply_chain_review_required'],
  ['requires_post_spike_revoke_or_disable', 'post_spike_revoke_or_disable_required'],
]);

// The only fields permitted on an approval RECORD — anything else is an unknown field and is rejected (no
// surprise fields, incl. smuggled has_rpc/ready/can_send/is_live/configured/broadcast flags). All permitted
// fields are opaque references / fixed enums / boolean attestations; none is a key, a secret, or a live endpoint.
const APPROVAL_GATE_KNOWN_FIELDS = Object.freeze([
  'purpose', 'target', 'provider_ref', 'environment', 'endpoint_ref',
  'no_broadcast', 'no_send', 'no_mainnet', 'no_real_live',
  'requires_separate_live_spike_pr', 'requires_out_of_repo_endpoint_binding',
  'requires_supply_chain_review', 'requires_post_spike_revoke_or_disable',
]);

// Describe the Live RPC Spike Approval Gate contract: test-only, no-broadcast/no-send/no-mainnet/no-real-live,
// reference-only, fail-closed. Describes an APPROVAL RECORD for a FUTURE testnet spike; an approved record
// authorizes NOTHING live. Performs NO live RPC / endpoint resolution / network / send; reads no env/secret.
// Read-only; describes intent, performs nothing.
export function describeLiveRpcSpikeApprovalGateContract() {
  return Object.freeze({
    contract: 'live-rpc-spike-approval-gate',
    version: '0.0.0',
    test_only: true,
    purpose: 'live_rpc_spike_approval_gate',
    target: 'testnet_rpc_spike',
    provider_ref: 'helius',
    supported_environments: Object.freeze(['devnet', 'testnet', 'localnet']),
    requires_separate_live_spike_pr: true,
    requires_out_of_repo_endpoint_binding: true,
    requires_supply_chain_review: true,
    requires_post_spike_revoke_or_disable: true,
    requires_no_broadcast: true,
    requires_no_send: true,
    requires_no_mainnet: true,
    requires_no_real_live: true,
    approval_record_valid: false,
    approval_gate_passed: false,
    live_rpc_authorized: false,
    configured: false,
    has_rpc: false,
    ready: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    is_live: false,
    real_live: false,
    network_call_made: false,
    live_rpc_call_made: false,
    broadcast_permitted: false,
    status: UNCONFIGURED,
    note: 'Test-only approval-gate; an approved record authorizes NOTHING live — a separate live-spike PR + '
      + 'out-of-repo endpoint binding + supply-chain review are still required; performs NO live RPC / endpoint '
      + 'resolution / network / send; reads no env/secret.',
  });
}

// Validate the approval-RECORD SHAPE only (NOT a binding, NOT an authorization). Reuses
// validateHeliusEndpointProvisioning for provider/environment/endpoint_ref/secret/key-material/mainnet shape
// (reasons propagated) on ONLY the 3 reference fields, then requires purpose === 'live_rpc_spike_approval_gate',
// target === 'testnet_rpc_spike', every required attestation boolean-true, refuses any broadcast/send/serialize
// indicator, and rejects unknown fields beyond the known set. The result is built from FIXED LITERALS + frozen
// reason tokens — input / endpoint_ref / secret VALUES are NEVER echoed. An approved record authorizes NOTHING
// live (every capability/live flag is a FIXED LITERAL false). Never throws — a hostile/throwing accessor RETURNS
// a frozen refusal with reason 'input_inspection_error'.
export function validateLiveRpcSpikeApprovalGate(input) {
  try {
    const reasons = [];

    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;

    // 1) Reuse the hardened provisioning validator (NOT weakened) for provider/environment/endpoint_ref shape ONLY.
    //    Pass ONLY the 3 provisioning fields — the approval record's own fields (purpose / target / the no_* and
    //    requires_* attestations) must NOT reach the provisioning validator, else they trip unknown_field_rejected
    //    and its substring scans falsely refuse a legitimate record (the 'rpc' inside the required purpose value
    //    'live_rpc_spike_approval_gate' / target 'testnet_rpc_spike', and the 'broadcast'/'send' inside the
    //    'no_broadcast'/'no_send' keys).
    const prov = validateHeliusEndpointProvisioning(obj
      ? { provider_ref: obj.provider_ref, environment: obj.environment, endpoint_ref: obj.endpoint_ref }
      : input);
    if (!prov.valid) for (const r of prov.reasons) reasons.push(r);

    // 2) purpose / target must be exactly the approval-gate literals.
    const purpose = obj ? obj.purpose : undefined;
    if (purpose !== 'live_rpc_spike_approval_gate') reasons.push('purpose_invalid');
    const target = obj ? obj.target : undefined;
    if (target !== 'testnet_rpc_spike') reasons.push('target_invalid');

    // 3) every required attestation must be explicitly boolean-true (no_*: never broadcasts/sends/mainnet/real-live;
    //    requires_*: the record itself attests that the downstream gates are still required).
    for (const [key, reason] of APPROVAL_GATE_REQUIRED_TRUE) {
      if (!obj || obj[key] !== true) reasons.push(reason);
    }

    // 4) any broadcast/send/serialize indicator is refused (e.g. a 'broadcast'/'send'/'serialize'-shaped KEY, or
    //    such a token in a string VALUE). The legitimate 'no_broadcast'/'no_send' keys are EXCLUDED from the KEY
    //    scan, and the fixed 'purpose'/'target' enum literals are EXCLUDED from the VALUE scan.
    if (obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'no_broadcast' || k === 'no_send') continue;
        const lk = String(k).toLowerCase();
        if (BROADCAST_SEND_BOUNDARY_TOKENS.some((t) => lk.indexOf(t) !== -1)) {
          if (!reasons.includes('broadcast_or_send_indicator_blocked')) reasons.push('broadcast_or_send_indicator_blocked');
          break;
        }
        if (k === 'purpose' || k === 'target') continue; // fixed enum literals, not broadcast/send/serialize values
        if (typeof v === 'string' && BROADCAST_SEND_BOUNDARY_TOKENS.some((t) => v.toLowerCase().indexOf(t) !== -1)) {
          if (!reasons.includes('broadcast_or_send_indicator_blocked')) reasons.push('broadcast_or_send_indicator_blocked');
          break;
        }
      }
    }

    // 5) extra conservative key-material guard — refuse a secret/key-material-shaped input outright.
    if (looksLikeKeyMaterial(input) && !reasons.includes('key_material_not_accepted')) {
      reasons.push('key_material_not_accepted');
    }

    // 6) unknown / surprise field — only the approval-gate known fields are permitted; any field beyond the known
    //    set is rejected here.
    if (obj && Object.keys(obj).some((k) => !APPROVAL_GATE_KNOWN_FIELDS.includes(k))) {
      if (!reasons.includes('unknown_field_rejected')) reasons.push('unknown_field_rejected');
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const valid = uniqueReasons.length === 0;
    let status;
    if (valid) status = 'live_rpc_spike_approval_gate_valid_no_live';
    else if (prov.status === UNCONFIGURED
      && !uniqueReasons.includes('broadcast_or_send_indicator_blocked')
      && !uniqueReasons.includes('unknown_field_rejected')) status = UNCONFIGURED;
    else status = 'invalid';

    return Object.freeze({
      // `valid`/`approval_record_valid` mean the RECORD SHAPE is acceptable as opaque references / fixed enums /
      // boolean attestations — it does NOT bind, send, broadcast, serialize, authorize, or activate anything; every
      // flag below is a FIXED LITERAL (all false), NOT live. An approved record authorizes NOTHING live.
      valid,
      approval_record_valid: valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      live_rpc_authorized: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      approval_record_valid: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      live_rpc_authorized: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  }
}

// The Live RPC Spike Approval Gate CORE: prove the SHAPE of an APPROVAL RECORD for a FUTURE testnet RPC spike is
// well-formed, while staying fully fail-closed and NEVER live. It does NOT resolve an endpoint, make a live RPC
// call, contact a provider, read env/secret, send/broadcast/serialize, or authorize anything. Even an approved
// record never authorizes the spike: requires_separate_live_spike_pr is a FIXED-LITERAL invariant (true on every
// result, never echoed) — a separate live-spike PR + out-of-repo endpoint binding + supply-chain review are
// ALWAYS still required. Logic: (1) validate the record shape; (2) approval_gate_passed iff the shape is valid.
// The result flags are FIXED LITERALS (all false); provider_ref is only ever the literal 'helius' and environment
// only echoed when approved. Never throws — a hostile/throwing accessor RETURNS a frozen invalid refusal.
export function evaluateLiveRpcSpikeApprovalGate(input) {
  try {
    // 1) Validate the approval RECORD SHAPE (reuses validateHeliusEndpointProvisioning + approval-gate rules).
    //    Never throws.
    const recv = validateLiveRpcSpikeApprovalGate(input);

    // 2) The gate passes iff the record shape is valid.
    const approvalGatePassed = recv.valid;
    const valid = approvalGatePassed;

    // 3) Status passes through the record-validation status (the no-live approval status / unconfigured / invalid).
    const status = recv.status;

    return Object.freeze({
      // `valid`/`approval_gate_passed` mean the APPROVAL RECORD is well-formed — it does NOT resolve an endpoint,
      // call RPC, send, broadcast, serialize, go live, or AUTHORIZE the spike. An approved record authorizes
      // NOTHING live: requires_separate_live_spike_pr is a FIXED LITERAL true (NOT echoed input), and every
      // capability/live flag below is a FIXED LITERAL false. provider_ref/environment are echoed ONLY when
      // approved and are only ever the recognized literal 'helius' / a recognized testnet enum value.
      valid,
      approval_record_valid: recv.approval_record_valid,
      approval_gate_passed: approvalGatePassed,
      status,
      provider_ref: approvalGatePassed ? 'helius' : undefined,
      environment: approvalGatePassed ? String(input.environment) : undefined,
      reasons: recv.reasons,
      requires_separate_live_spike_pr: true,
      live_rpc_authorized: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      approval_record_valid: false,
      approval_gate_passed: false,
      status: 'invalid',
      provider_ref: undefined,
      environment: undefined,
      reasons: Object.freeze(['input_inspection_error']),
      requires_separate_live_spike_pr: true,
      live_rpc_authorized: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  }
}

// ============================================================================================================
// PR-E2-F-15 — RPC Client / SDK SUPPLY-CHAIN REVIEW GATE (contract-only, no-network)
// ------------------------------------------------------------------------------------------------------------
// A CONTRACT-ONLY gate that validates the SHAPE of a SUPPLY-CHAIN REVIEW RECORD for a FUTURE RPC client/SDK
// dependency. It proves such a dependency can NEVER become a live capability through this gate: it introduces
// NO dependency, NO SDK import, NO network. The record carries only OPAQUE client metadata (name/version) +
// boolean attestations. An approved review authorizes NOTHING live and adds NO dependency/network — a separate
// integration PR + lockfile + supply-chain review are ALWAYS still required.
// ============================================================================================================

// Required-true attestations: each [field, reason] pair must be boolean `true` on the record, else the listed
// fixed reason token is pushed. The record asserts the future client adds no network/send/broadcast/serialize/
// mainnet/real-live surface and that lockfile/supply-chain review + a separate integration PR + a pinned version
// are required. String literal VALUES (lexer-blanked) — never executed, only used as fixed tokens.
const SUPPLY_CHAIN_REQUIRED_TRUE = Object.freeze([
  ['no_network', 'no_network_required'],
  ['no_send', 'no_send_required'],
  ['no_broadcast', 'no_broadcast_required'],
  ['no_serialize', 'no_serialize_required'],
  ['no_mainnet', 'no_mainnet_required'],
  ['no_real_live', 'no_real_live_required'],
  ['requires_lockfile_review', 'lockfile_review_required'],
  ['requires_supply_chain_review', 'supply_chain_review_required'],
  ['requires_separate_integration_pr', 'separate_integration_pr_required'],
  ['requires_pinned_version', 'pinned_version_required'],
]);

// The only fields permitted on a supply-chain review RECORD — anything else is an unknown field and is rejected
// (no surprise fields, incl. smuggled has_rpc/ready/can_send/is_live/configured/broadcast/network flags). All
// permitted fields are opaque references / fixed enums / boolean attestations; none is a key, secret, endpoint,
// or live SDK handle.
const SUPPLY_CHAIN_KNOWN_FIELDS = Object.freeze([
  'purpose', 'client_ref', 'client_version',
  'no_network', 'no_send', 'no_broadcast', 'no_serialize', 'no_mainnet', 'no_real_live',
  'requires_lockfile_review', 'requires_supply_chain_review', 'requires_separate_integration_pr',
  'requires_pinned_version',
]);

// Endpoint indicators to refuse INSIDE opaque client metadata (client_ref/client_version). Deliberately NARROWER
// than ENDPOINT_RPC_TOKENS: a supply-chain review of an RPC client legitimately names a package like
// 'rpc-client-pkg' / 'helius-rpc-sdk', so the bare descriptive words 'rpc'/'endpoint'/'cluster'/'url' must NOT be
// refused here. What we refuse is an actual endpoint URL surface — a scheme — smuggled into the metadata. (Secrets,
// mainnet markers, and key-material are screened separately and remain refused.) String literals: lexer-blanked,
// guard-safe; never executed, only used as fixed match tokens.
const CLIENT_METADATA_ENDPOINT_TOKENS = Object.freeze(['http://', 'https://', 'ws://', 'wss://']);

// Describe the RPC client / SDK supply-chain review gate: review-record-shape only, fail-closed, NO network /
// fetch / endpoint resolution / SDK import / dependency; reads no env/secret. Read-only; describes intent,
// performs nothing. Every capability/live flag is a FIXED LITERAL false — an approved review authorizes NOTHING
// live and adds NO dependency/network.
export function describeRpcClientSupplyChainGateContract() {
  return Object.freeze({
    contract: 'rpc-client-supply-chain-gate',
    version: '0.0.0',
    test_only: true,
    purpose: 'rpc_client_supply_chain_review',
    requires_lockfile_review: true,
    requires_supply_chain_review: true,
    requires_separate_integration_pr: true,
    requires_pinned_version: true,
    requires_no_network: true,
    requires_no_send: true,
    requires_no_broadcast: true,
    requires_no_serialize: true,
    requires_no_mainnet: true,
    requires_no_real_live: true,
    review_record_valid: false,
    supply_chain_gate_passed: false,
    live_rpc_authorized: false,
    network_capability: false,
    configured: false,
    has_rpc: false,
    ready: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    is_live: false,
    real_live: false,
    network_call_made: false,
    live_rpc_call_made: false,
    broadcast_permitted: false,
    status: UNCONFIGURED,
    note: 'Test-only supply-chain review gate; an approved review authorizes NOTHING live and adds NO dependency/network — a separate integration PR + lockfile + supply-chain review are still required; performs NO network / fetch / endpoint resolution; reads no env/secret.',
  });
}

// Validate the SHAPE of a supply-chain review RECORD only. It does NOT import an SDK, add a dependency, resolve
// an endpoint, make a network/fetch call, read env/secret, or authorize anything. The record carries only opaque
// client metadata (client_ref/client_version) + boolean attestations; an endpoint/url/rpc/secret/key-material/
// mainnet indicator in ANY field is refused and NEVER echoed. All result flags are FIXED LITERALS (all false).
// Never throws — a hostile/throwing accessor RETURNS a frozen invalid refusal with reason 'input_inspection_error'.
export function validateRpcClientSupplyChainReview(input) {
  try {
    const reasons = [];
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;

    // 1) purpose must be the exact fixed enum value.
    const purpose = obj ? obj.purpose : undefined;
    if (purpose !== 'rpc_client_supply_chain_review') reasons.push('purpose_invalid');

    // 2) client_ref — opaque client/package name reference; must be a non-empty string carrying NO endpoint-URL
    //    (scheme) / secret / mainnet indicator. Descriptive words ('rpc'/'sdk'/'client') are allowed in a package
    //    name; only a real endpoint URL scheme is refused. The value itself is NEVER echoed.
    const cr = obj ? obj.client_ref : undefined;
    if (typeof cr !== 'string' || cr.length === 0) {
      reasons.push('client_ref_missing');
    } else {
      const lc = cr.toLowerCase();
      if (CLIENT_METADATA_ENDPOINT_TOKENS.some((t) => lc.indexOf(t) !== -1)) reasons.push('endpoint_or_rpc_indicator_blocked');
      if (SECRET_INDICATOR_TOKENS.some((t) => lc.indexOf(t) !== -1)) reasons.push('client_secret_indicator_blocked');
      if (MAINNET_TOKENS.some((t) => lc.indexOf(t) !== -1)) reasons.push('mainnet_indicator_blocked');
    }

    // 3) client_version — opaque pinned-version reference; same scheme/secret/mainnet scans (de-duplicated later).
    const cv = obj ? obj.client_version : undefined;
    if (typeof cv !== 'string' || cv.length === 0) {
      reasons.push('client_version_missing');
    } else {
      const lc = cv.toLowerCase();
      if (CLIENT_METADATA_ENDPOINT_TOKENS.some((t) => lc.indexOf(t) !== -1)) reasons.push('endpoint_or_rpc_indicator_blocked');
      if (SECRET_INDICATOR_TOKENS.some((t) => lc.indexOf(t) !== -1)) reasons.push('client_secret_indicator_blocked');
      if (MAINNET_TOKENS.some((t) => lc.indexOf(t) !== -1)) reasons.push('mainnet_indicator_blocked');
    }

    // 4) required-true attestations — each must be boolean `true`, else its fixed reason token is pushed.
    for (const [key, reason] of SUPPLY_CHAIN_REQUIRED_TRUE) {
      if (!obj || obj[key] !== true) reasons.push(reason);
    }

    // 5) broadcast/send/serialize indicator scan over any field NAME or string VALUE (the no_send/no_broadcast/
    //    no_serialize attestation keys are exempt — those are the attestations themselves, not a live surface).
    if (obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'no_send' || k === 'no_broadcast' || k === 'no_serialize') continue;
        const lk = String(k).toLowerCase();
        if (BROADCAST_SEND_BOUNDARY_TOKENS.some((t) => lk.indexOf(t) !== -1)) {
          if (!reasons.includes('broadcast_or_send_indicator_blocked')) reasons.push('broadcast_or_send_indicator_blocked');
          break;
        }
        if (k === 'purpose') continue;
        if (typeof v === 'string' && BROADCAST_SEND_BOUNDARY_TOKENS.some((t) => v.toLowerCase().indexOf(t) !== -1)) {
          if (!reasons.includes('broadcast_or_send_indicator_blocked')) reasons.push('broadcast_or_send_indicator_blocked');
          break;
        }
      }
    }

    // 6) extra conservative key-material guard — refuse a secret/key-material-shaped input outright.
    if (looksLikeKeyMaterial(input) && !reasons.includes('key_material_not_accepted')) {
      reasons.push('key_material_not_accepted');
    }

    // 7) unknown / surprise field — only the supply-chain review known fields are permitted.
    if (obj && Object.keys(obj).some((k) => !SUPPLY_CHAIN_KNOWN_FIELDS.includes(k))) {
      if (!reasons.includes('unknown_field_rejected')) reasons.push('unknown_field_rejected');
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const valid = uniqueReasons.length === 0;
    let status;
    if (valid) {
      status = 'rpc_client_supply_chain_review_valid_no_network';
    } else if ((uniqueReasons.includes('client_ref_missing')
        || uniqueReasons.includes('client_version_missing')
        || uniqueReasons.includes('purpose_invalid'))
      && !uniqueReasons.includes('unknown_field_rejected')
      && !uniqueReasons.includes('broadcast_or_send_indicator_blocked')) {
      status = UNCONFIGURED;
    } else {
      status = 'invalid';
    }

    return Object.freeze({
      // `valid`/`review_record_valid` mean the RECORD SHAPE is acceptable as opaque references / fixed enums /
      // boolean attestations — it does NOT import an SDK, add a dependency, bind, send, broadcast, serialize,
      // authorize, or activate anything. Every flag below is a FIXED LITERAL (all false), NOT live.
      valid,
      review_record_valid: valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      live_rpc_authorized: false,
      network_capability: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      review_record_valid: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      live_rpc_authorized: false,
      network_capability: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  }
}

// The RPC client / SDK supply-chain review gate CORE: prove the SHAPE of a SUPPLY-CHAIN REVIEW RECORD for a
// FUTURE RPC client/SDK dependency is well-formed, while staying fully fail-closed and NEVER live. It does NOT
// import an SDK, add a dependency, resolve an endpoint, make a network/fetch call, contact a provider, read
// env/secret, send/broadcast/serialize, or authorize anything. Even an approved review authorizes NOTHING live
// and adds NO dependency/network: requires_separate_integration_pr is a FIXED-LITERAL invariant (true on every
// result, never echoed) — a separate integration PR + lockfile + supply-chain review are ALWAYS still required.
// Logic: (1) validate the record shape; (2) supply_chain_gate_passed iff the shape is valid. The result flags
// are FIXED LITERALS (all false); NO freeform input (client_ref/client_version) is ever echoed. Never throws —
// a hostile/throwing accessor RETURNS a frozen invalid refusal with reason 'input_inspection_error'.
export function evaluateRpcClientSupplyChainGate(input) {
  try {
    // 1) Validate the supply-chain review RECORD SHAPE (reuses validateRpcClientSupplyChainReview). Never throws.
    const recv = validateRpcClientSupplyChainReview(input);

    // 2) The gate passes iff the record shape is valid.
    const supplyChainGatePassed = recv.valid;
    const valid = supplyChainGatePassed;

    return Object.freeze({
      // `valid`/`supply_chain_gate_passed` mean the REVIEW RECORD is well-formed — it does NOT import an SDK,
      // add a dependency, resolve an endpoint, call RPC, send, broadcast, serialize, go live, or AUTHORIZE
      // integration. An approved review authorizes NOTHING live: requires_separate_integration_pr is a FIXED
      // LITERAL true (NOT echoed input), and every capability/live flag below is a FIXED LITERAL false. NO
      // freeform input (client_ref/client_version) is echoed.
      valid,
      review_record_valid: recv.review_record_valid,
      supply_chain_gate_passed: supplyChainGatePassed,
      status: recv.status,
      reasons: recv.reasons,
      requires_separate_integration_pr: true,
      live_rpc_authorized: false,
      network_capability: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      review_record_valid: false,
      supply_chain_gate_passed: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      requires_separate_integration_pr: true,
      live_rpc_authorized: false,
      network_capability: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  }
}

// =============================================================================================================
// F-16: OUT-OF-REPO ENDPOINT BINDING ADAPTER BOUNDARY (contract-only, no-secret-in-repo).
// Validates the SHAPE of a BINDING DESCRIPTOR describing how an opaque endpoint_ref will LATER be bound to an
// OUT-OF-REPO source (env / secret manager / operator-provided). It proves (a) no endpoint/API-key/secret enters
// code/tests/docs, and (b) binding metadata ALONE never opens has_rpc/can_send/live_rpc_authorized. It performs
// NO endpoint resolution / network / fetch / SDK import / dependency, and reads NO env/secret; the REAL binding
// to an out-of-repo source is a SEPARATE PR; no endpoint/secret is ever stored in the repo.
// =============================================================================================================

// The three allowed OUT-OF-REPO source kinds — a TAG classifying WHERE the real endpoint/secret will live, never
// the endpoint/secret itself. Note 'secret_manager_out_of_repo' legitimately contains the substring 'secret', so
// binding_source_kind is validated by EXACT enum match (never a broad secret-indicator scan). String literals:
// lexer-blanked, guard-safe; never executed, only used as fixed match tokens.
const BINDING_SOURCE_KINDS = Object.freeze(['env_out_of_repo', 'secret_manager_out_of_repo', 'operator_provided_out_of_repo']);

// Required-true attestations: each [field, reason] pair must be boolean `true` on the descriptor, else the listed
// fixed reason token is pushed. The descriptor asserts the future binding adds no network/send/broadcast/serialize/
// mainnet/real-live surface, that the secret source is out-of-repo, and that a separate live-binding PR is required.
const OOR_BINDING_REQUIRED_TRUE = Object.freeze([
  ['no_network', 'no_network_required'],
  ['no_send', 'no_send_required'],
  ['no_broadcast', 'no_broadcast_required'],
  ['no_serialize', 'no_serialize_required'],
  ['no_mainnet', 'no_mainnet_required'],
  ['no_real_live', 'no_real_live_required'],
  ['requires_out_of_repo_secret_source', 'out_of_repo_secret_source_required'],
  ['requires_separate_live_binding_pr', 'separate_live_binding_pr_required'],
]);

// Required-false attestations: each [field, reason] pair must be boolean `false` on the descriptor (an explicit
// promise that NO secret and NO endpoint live in the repo), else the listed fixed reason token is pushed.
const OOR_BINDING_REQUIRED_FALSE = Object.freeze([
  ['secret_in_repo', 'secret_in_repo_must_be_false'],
  ['endpoint_in_repo', 'endpoint_in_repo_must_be_false'],
]);

// The only fields permitted on a binding DESCRIPTOR — anything else is an unknown field and is rejected. This is
// what refuses a smuggled api_key/secret/token FIELD (it is not in this set), and the value is NEVER echoed since
// results are built from fixed literals. All permitted fields are opaque references / fixed enums / boolean
// attestations; none is a key, secret, endpoint URL, or live SDK handle. (Note: looksLikeKeyMaterial is NOT called
// over the whole descriptor — the legitimate field name 'secret_in_repo' contains 'secret' and would false-trip;
// endpoint_ref is screened for url/secret/key-material/mainnet by validateHeliusEndpointProvisioning instead.)
const OOR_BINDING_KNOWN_FIELDS = Object.freeze([
  'purpose', 'provider_ref', 'environment', 'endpoint_ref', 'binding_source_kind',
  'secret_in_repo', 'endpoint_in_repo',
  'no_network', 'no_send', 'no_broadcast', 'no_serialize', 'no_mainnet', 'no_real_live',
  'requires_out_of_repo_secret_source', 'requires_separate_live_binding_pr',
]);

// Describe the out-of-repo endpoint binding adapter boundary: descriptor-shape only, fail-closed, NO endpoint
// resolution / network / fetch / SDK import / dependency; reads no env/secret. Read-only; describes intent,
// performs nothing. Every capability/live flag is a FIXED LITERAL false — a valid descriptor authorizes NOTHING
// live, and the REAL binding to an out-of-repo endpoint/secret source is a SEPARATE PR.
export function describeOutOfRepoEndpointBindingAdapterContract() {
  return Object.freeze({
    contract: 'out-of-repo-endpoint-binding-adapter',
    version: '0.0.0',
    test_only: true,
    purpose: 'out_of_repo_endpoint_binding_adapter',
    provider_ref: 'helius',
    supported_environments: Object.freeze(['devnet', 'testnet', 'localnet']),
    supported_binding_source_kinds: BINDING_SOURCE_KINDS,
    requires_out_of_repo_secret_source: true,
    requires_separate_live_binding_pr: true,
    requires_no_network: true,
    requires_no_send: true,
    requires_no_broadcast: true,
    requires_no_serialize: true,
    requires_no_mainnet: true,
    requires_no_real_live: true,
    secret_in_repo: false,
    endpoint_in_repo: false,
    binding_descriptor_valid: false,
    boundary_passed: false,
    live_rpc_authorized: false,
    network_capability: false,
    resolved: false,
    configured: false,
    has_rpc: false,
    ready: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    is_live: false,
    real_live: false,
    network_call_made: false,
    live_rpc_call_made: false,
    broadcast_permitted: false,
    status: UNCONFIGURED,
    note: 'Test-only out-of-repo endpoint binding adapter boundary; the REAL binding to an out-of-repo endpoint/secret source is NOT implemented here and is a separate PR. A valid descriptor authorizes NOTHING live: no endpoint resolution / network / SDK / dependency; reads no env/secret; no endpoint/secret ever stored in the repo.',
  });
}

// Validate the SHAPE of a binding DESCRIPTOR only. It does NOT resolve an endpoint, make a network/fetch call,
// import an SDK, add a dependency, or read env/secret. The descriptor carries an opaque endpoint_ref + a
// binding_source_kind TAG + boolean attestations; a real URL/secret/key-material/mainnet in any reference field is
// refused (via validateHeliusEndpointProvisioning) and NEVER echoed; a smuggled api_key/secret/token FIELD is
// rejected by the unknown-field check and NEVER echoed. All result flags are FIXED LITERALS (all false). Never
// throws — a hostile/throwing accessor RETURNS a frozen invalid refusal with reason 'input_inspection_error'.
export function validateOutOfRepoEndpointBindingDescriptor(input) {
  try {
    const reasons = [];
    const obj = (input != null && typeof input === 'object' && !Array.isArray(input)) ? input : null;

    // 1) Reuse the hardened provisioning validator on the 3 REFERENCE fields ONLY (provider_ref/environment/
    //    endpoint_ref) so purpose / binding_source_kind substrings don't trip the secret/url scans. It screens
    //    endpoint_ref for url/secret/key-material/mainnet via validateRpcProviderConfig. Never throws.
    const prov = validateHeliusEndpointProvisioning(
      obj ? { provider_ref: obj.provider_ref, environment: obj.environment, endpoint_ref: obj.endpoint_ref } : input,
    );
    if (!prov.valid) for (const r of prov.reasons) reasons.push(r);

    // 2) purpose must be the exact fixed enum value.
    const purpose = obj ? obj.purpose : undefined;
    if (purpose !== 'out_of_repo_endpoint_binding_adapter') reasons.push('purpose_invalid');

    // 3) binding_source_kind — EXACT enum match (NOT a secret-indicator scan, since the legitimate value
    //    'secret_manager_out_of_repo' contains 'secret'). A URL/secret here is simply not in the enum -> rejected,
    //    and the value is NEVER echoed.
    const bsk = obj ? obj.binding_source_kind : undefined;
    if (typeof bsk !== 'string' || !BINDING_SOURCE_KINDS.includes(bsk)) reasons.push('binding_source_kind_invalid');

    // 4) required-true attestations — each must be boolean `true`, else its fixed reason token is pushed.
    for (const [key, reason] of OOR_BINDING_REQUIRED_TRUE) {
      if (!obj || obj[key] !== true) reasons.push(reason);
    }

    // 5) required-false attestations — secret_in_repo / endpoint_in_repo MUST be explicitly boolean `false`.
    for (const [key, reason] of OOR_BINDING_REQUIRED_FALSE) {
      if (!obj || obj[key] !== false) reasons.push(reason);
    }

    // 6) broadcast/send/serialize indicator scan over any field NAME or string VALUE (the no_send/no_broadcast/
    //    no_serialize attestation keys are exempt — those are the attestations themselves; purpose and
    //    binding_source_kind are fixed enums validated above and exempt from the VALUE scan).
    if (obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'no_send' || k === 'no_broadcast' || k === 'no_serialize') continue;
        const lk = String(k).toLowerCase();
        if (BROADCAST_SEND_BOUNDARY_TOKENS.some((t) => lk.indexOf(t) !== -1)) {
          if (!reasons.includes('broadcast_or_send_indicator_blocked')) reasons.push('broadcast_or_send_indicator_blocked');
          break;
        }
        if (k === 'purpose' || k === 'binding_source_kind') continue;
        if (typeof v === 'string' && BROADCAST_SEND_BOUNDARY_TOKENS.some((t) => v.toLowerCase().indexOf(t) !== -1)) {
          if (!reasons.includes('broadcast_or_send_indicator_blocked')) reasons.push('broadcast_or_send_indicator_blocked');
          break;
        }
      }
    }

    // 7) unknown / surprise field — only the known binding-descriptor fields are permitted. This rejects a
    //    smuggled api_key/secret/token FIELD (not in the known set); the value is NEVER echoed.
    if (obj && Object.keys(obj).some((k) => !OOR_BINDING_KNOWN_FIELDS.includes(k))) {
      if (!reasons.includes('unknown_field_rejected')) reasons.push('unknown_field_rejected');
    }

    // de-duplicate reasons while preserving first-seen order.
    const uniqueReasons = [];
    for (const r of reasons) if (!uniqueReasons.includes(r)) uniqueReasons.push(r);

    const valid = uniqueReasons.length === 0;
    let status;
    if (valid) {
      status = 'out_of_repo_endpoint_binding_valid_no_live';
    } else if ((prov.status === UNCONFIGURED
        || uniqueReasons.includes('purpose_invalid')
        || uniqueReasons.includes('binding_source_kind_invalid'))
      && !uniqueReasons.includes('unknown_field_rejected')
      && !uniqueReasons.includes('broadcast_or_send_indicator_blocked')) {
      status = UNCONFIGURED;
    } else {
      status = 'invalid';
    }

    return Object.freeze({
      // `valid`/`binding_descriptor_valid` mean the DESCRIPTOR SHAPE is acceptable as opaque references / fixed
      // enums / boolean attestations — it does NOT resolve an endpoint, bind, send, broadcast, serialize, read
      // env/secret, or authorize/activate anything. Every flag below is a FIXED LITERAL (all false), NOT live.
      valid,
      binding_descriptor_valid: valid,
      status,
      reasons: Object.freeze([...uniqueReasons]),
      live_rpc_authorized: false,
      network_capability: false,
      resolved: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      binding_descriptor_valid: false,
      status: 'invalid',
      reasons: Object.freeze(['input_inspection_error']),
      live_rpc_authorized: false,
      network_capability: false,
      resolved: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  }
}

// The out-of-repo endpoint binding adapter boundary CORE: prove the SHAPE of a BINDING DESCRIPTOR is well-formed,
// while staying fully fail-closed and NEVER live. It does NOT resolve an endpoint, make a network/fetch call,
// import an SDK, add a dependency, contact a provider, read env/secret, send/broadcast/serialize, or authorize
// anything. Even a valid descriptor authorizes NOTHING live and binds NOTHING: requires_separate_live_binding_pr
// is a FIXED-LITERAL invariant (true on every result, never echoed) — the REAL out-of-repo binding is ALWAYS a
// separate PR. Logic: (1) validate the descriptor shape; (2) boundary_passed iff the shape is valid. When
// boundary_passed, ONLY the recognized literal 'helius', the validated testnet-family environment enum, and the
// validated binding_source_kind enum are echoed (all fixed/validated safe values) — NEVER endpoint_ref or any
// freeform value. Never throws — a hostile/throwing accessor RETURNS a frozen invalid refusal with reason
// 'input_inspection_error'.
export function evaluateOutOfRepoEndpointBindingBoundary(input) {
  try {
    // 1) Validate the binding DESCRIPTOR SHAPE (reuses validateOutOfRepoEndpointBindingDescriptor). Never throws.
    const recv = validateOutOfRepoEndpointBindingDescriptor(input);

    // 2) The boundary passes iff the descriptor shape is valid.
    const boundaryPassed = recv.valid;
    const valid = boundaryPassed;

    return Object.freeze({
      // `valid`/`boundary_passed` mean the DESCRIPTOR is well-formed — it does NOT resolve an endpoint, bind,
      // call RPC, send, broadcast, serialize, go live, or AUTHORIZE binding. A valid descriptor authorizes
      // NOTHING live: requires_separate_live_binding_pr is a FIXED LITERAL true (NOT echoed input), and every
      // capability/live flag below is a FIXED LITERAL false. Only the recognized literal 'helius', the validated
      // environment enum, and the validated binding_source_kind enum are echoed when boundary_passed — never
      // endpoint_ref or any freeform value.
      valid,
      binding_descriptor_valid: recv.binding_descriptor_valid,
      boundary_passed: boundaryPassed,
      status: recv.status,
      provider_ref: boundaryPassed ? 'helius' : undefined,
      environment: boundaryPassed ? String(input.environment) : undefined,
      binding_source_kind: boundaryPassed ? String(input.binding_source_kind) : undefined,
      reasons: recv.reasons,
      requires_separate_live_binding_pr: true,
      live_rpc_authorized: false,
      network_capability: false,
      resolved: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  } catch {
    // Fail-safe-not-fail-open: a hostile/throwing accessor is refused, never re-thrown, never echoed.
    return Object.freeze({
      valid: false,
      binding_descriptor_valid: false,
      boundary_passed: false,
      status: 'invalid',
      provider_ref: undefined,
      environment: undefined,
      binding_source_kind: undefined,
      reasons: Object.freeze(['input_inspection_error']),
      requires_separate_live_binding_pr: true,
      live_rpc_authorized: false,
      network_capability: false,
      resolved: false,
      configured: false,
      has_rpc: false,
      ready: false,
      can_send: false,
      can_broadcast: false,
      can_serialize: false,
      is_live: false,
      real_live: false,
      network_call_made: false,
      live_rpc_call_made: false,
      broadcast_permitted: false,
    });
  }
}
