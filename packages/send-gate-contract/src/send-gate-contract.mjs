// @soltrade/send-gate-contract — Send Gate CONTRACT + FAIL-CLOSED SKELETON (Gate E / E2-F-1).
// SOURCE: docs/00-ARCHITECTURE.md §15.12 (Wave 4 execution boundary) + docs/09-THREAT-SECURITY +
// reports/E2-F-0-SEND-TESTNET-BROADCAST-BOUNDARY-DESIGN.md (E2-F boundary: send/broadcast = separate phase).
//
// CONTRACT/SKELETON ONLY — there is NO live mechanism here. This module describes what a send gate MUST be
// (a fail-closed component that NEVER sends, broadcasts, serializes, or contacts an RPC/provider) and ships a
// gate whose every evaluation resolves to "refused". It performs no work and contacts nothing.
//
// ABSENT BY DESIGN (and forbidden here): RPC/provider client, Solana/Jupiter/Helius/Jito, transaction
// building/serialization, signing/sending, broadcast, network call, KMS/vault, KeyManager, key material,
// configured-handle wiring, DB access, REAL-LIVE activation, execution authority. The result fields below are
// fixed literals (all false/null) — request input is never echoed and no signature is ever produced.
//
// WHY OUTSIDE THE ALLOWLIST: a pure contract/skeleton has no live mechanism, so it lives outside the mechanism
// guard's allowlist and is FULLY SCANNED — proving it carries zero forbidden families. Real send/RPC/broadcast
// is a separate, explicitly-approved PR and is NOT started here.
//
// MILESTONE 2 (E2-F-8): this gate now CONSUMES the sibling rpc-provider CONTRACT result in a FAIL-CLOSED way.
// It reads the rpc-provider's readiness/config classification (never trusting a caller-supplied flag) and STILL
// ALWAYS refuses — evaluateRpcReadiness is always not-ready and validateRpcProviderConfig never configures, so a
// supplied provider always yields rpc_provider_not_ready and a missing provider yields rpc_provider_missing. The
// foundational refusal (send_gate_unconfigured_no_rpc) remains ALWAYS present. NOT live integration.
import { evaluateRpcReadiness, validateRpcProviderConfig } from '../../rpc-provider-contract/src/index.mjs';

const UNCONFIGURED = 'unconfigured_no_rpc';

// ---- indicator token lists (string literals: lexer-blanked, so the guard's code-scan sees no mechanism) ----
// Detection is substring-based and intentionally CONSERVATIVE (over-refusal is fail-safe-not-fail-open): any
// request carrying one of these indicators is refused. None of these are ever executed — they are match tokens.
const MAINNET_TOKENS = Object.freeze(['mainnet', 'mainnet-beta', 'prod']);
// endpoint / RPC / provider-URL indicators — a send gate must never carry a live endpoint surface.
const ENDPOINT_RPC_TOKENS = Object.freeze([
  'http://', 'https://', 'ws://', 'wss://', 'rpc', 'endpoint', 'provider_url', 'cluster', 'websocket',
  'node_url', 'live_call',
]);
// broadcast / send-intent indicators — the gate never broadcasts or sends.
const BROADCAST_SEND_TOKENS = Object.freeze(['broadcast', 'send']);
// serialized / raw-transaction indicators — the gate never builds or serializes a transaction.
const SERIALIZED_TX_TOKENS = Object.freeze([
  'serialized', 'serialize', 'raw_tx', 'raw_transaction', 'rawtransaction', 'wire_transaction',
  'transaction', 'tx_bytes', 'signed_transaction',
]);

// Is the given input "key-material-shaped"? Used ONLY to REFUSE such input — never to accept/store/return it.
// Conservative heuristic: PEM, a long base58 blob, a multi-word mnemonic, or an object exposing a secret field.
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

// Collect a shallow set of lowercased strings (keys + string values, one nested level) from a request, used
// only to match refusal indicators. Never stores or returns request data beyond this local match set.
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

// True iff any indicator token appears (substring) in the request's keys/values. Conservative by design.
function hasIndicator(input, tokens) {
  const hay = collectStrings(input).map((s) => s.toLowerCase());
  return tokens.some((t) => hay.some((s) => s.indexOf(t) !== -1));
}

function isTrue(input, key) {
  return input != null && typeof input === 'object' && input[key] === true;
}

// The send-gate CONTRACT descriptor: what any conforming send gate must expose, with every send/broadcast/
// serialize/RPC/live capability pinned to false. Read-only; describes intent, performs nothing.
export function describeSendGateContract() {
  return Object.freeze({
    contract: 'send-gate',
    version: '0.0.0',
    can_send: false,            // the gate NEVER sends
    can_broadcast: false,       // the gate NEVER broadcasts
    can_serialize: false,       // the gate NEVER builds/serializes a transaction
    has_rpc: false,             // no RPC/provider surface exists
    is_live: false,
    accepts_key_material_input: false,    // key-material-shaped input is refused
    requires_sign_only_success: true,     // send may never happen without prior sign-only success
    consumes_rpc_provider: true,          // consumes the rpc-provider CONTRACT result fail-closed (still refuses)
    status: UNCONFIGURED,
    operations: Object.freeze(['describe', 'evaluateSendPreflight']),
    note: 'Send-gate CONTRACT + fail-closed SKELETON (E2-F-1). Always refuses: no RPC, no send, no broadcast, '
      + 'no transaction build/serialization, no network, no KMS, no KeyManager, no key material, no execution '
      + 'authority. CONSUMES the rpc-provider CONTRACT result fail-closed (derives readiness/config from the '
      + 'contract, never a caller flag) and STILL ALWAYS refuses. Real send/testnet broadcast is a separate, '
      + 'explicitly-approved PR.',
  });
}

// Evaluate a send "preflight". This is the ONLY decision surface and it is ALWAYS fail-closed: there is no RPC
// and no send path, so every request is refused with `send_gate_unconfigured_no_rpc`. In addition, specific
// threat indicators (mainnet / endpoint-RPC / broadcast-send / serialized-raw-tx / key-material) and missing
// gate preconditions (sign-only success, readiness, preflight, active custody) are recorded as blockers. The
// result is built from fixed literals — request input is never echoed and no signature is ever produced.
export function evaluateSendPreflight(input) {
  const blockers = [];

  // Inspect the request defensively: a hostile/throwing accessor (getter / Proxy trap) must NOT escape the
  // gate as an exception — every request must RETURN a refusal. Any inspection error itself becomes a blocker.
  try {
    // key material — refuse first; never echo it back.
    if (looksLikeKeyMaterial(input)) blockers.push('key_material_not_accepted');
    // mainnet — a send gate must never carry a mainnet indicator.
    if (hasIndicator(input, MAINNET_TOKENS)) blockers.push('mainnet_indicator_blocked');
    // endpoint / RPC / provider URL — no live endpoint surface.
    if (hasIndicator(input, ENDPOINT_RPC_TOKENS)) blockers.push('endpoint_or_rpc_blocked');
    // broadcast / send intent — the gate never broadcasts or sends.
    if (hasIndicator(input, BROADCAST_SEND_TOKENS)) blockers.push('broadcast_or_send_indicator_blocked');
    // serialized / raw transaction — the gate never builds or serializes a transaction.
    if (hasIndicator(input, SERIALIZED_TX_TOKENS)) blockers.push('serialized_or_raw_tx_blocked');

    // gate preconditions (even a clean request still ends up refused foundationally below).
    if (!isTrue(input, 'sign_only_success')) blockers.push('sign_only_not_completed');
    if (!isTrue(input, 'readiness_ready')) blockers.push('readiness_not_ready');
    if (!isTrue(input, 'preflight_ok')) blockers.push('preflight_not_ok');
    if (!(input != null && typeof input === 'object' && input.custody_status === 'ACTIVE')) {
      blockers.push('custody_not_active');
    }

    // MILESTONE 2 — consume the rpc-provider CONTRACT result, never trusting a caller flag. Readiness is DERIVED
    // from the contract: evaluateRpcReadiness is always not-ready and validateRpcProviderConfig never configures,
    // so a supplied provider always yields rpc_provider_not_ready; a missing provider yields rpc_provider_missing.
    const provider = (input != null && typeof input === 'object') ? input.rpc_provider : undefined;
    if (provider === undefined || provider === null) {
      blockers.push('rpc_provider_missing');
    } else {
      if (validateRpcProviderConfig(provider).status === 'invalid_key_material') blockers.push('rpc_provider_key_material');
      if (evaluateRpcReadiness(provider).ready !== true) blockers.push('rpc_provider_not_ready');
    }
  } catch {
    // Fail-safe-not-fail-open: a request whose inspection throws is still refused (never re-thrown, never an
    // error message echoed). The caught error object is deliberately NOT read — only a fixed blocker is added.
    if (!blockers.includes('input_inspection_error')) blockers.push('input_inspection_error');
  }

  // FOUNDATIONAL refusal — there is no RPC and no send path at all. This is ALWAYS present, so a perfectly
  // valid-looking request is still refused. This is the gate's reason of record.
  blockers.push('send_gate_unconfigured_no_rpc');

  return Object.freeze({
    ok: false,
    sent: false,
    broadcast: false,
    signature: null,        // never produce or echo a signature
    transaction: null,      // never build a transaction
    serialized: null,       // never serialize a transaction
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    has_rpc: false,
    is_live: false,
    status: UNCONFIGURED,
    reason: 'send_gate_unconfigured_no_rpc',
    blockers: Object.freeze(blockers),
  });
}

// Create a fail-closed send gate: an opaque object whose only decision surface (`evaluateSendPreflight`) always
// refuses. It exposes NO send/broadcast/serialize method, is never configured, and contacts nothing.
export function createFailClosedSendGate() {
  const gate = {
    status: UNCONFIGURED,
    isConfigured() { return false; },
    describe() { return describeSendGateContract(); },
    evaluateSendPreflight(request) { return evaluateSendPreflight(request); },
  };
  return Object.freeze(gate);
}

// Explicit predicate the rest of the system can use to assert key-material refusal in tests/diagnostics.
export function refusesKeyMaterial(input) {
  return looksLikeKeyMaterial(input);
}

export const SEND_GATE_CONTRACT_STATUS = UNCONFIGURED;
