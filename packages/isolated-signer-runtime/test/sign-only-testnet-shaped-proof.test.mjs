// PR-E2-C5-1 — Sign-only TESTNET/DEVNET-shaped proof (TEST-ONLY).
//
// Proves the existing real SIGN-ONLY path (E2-C3-4) can produce a valid Ed25519 signature over a
// testnet/devnet-shaped LOCAL payload, verified OFF-CHAIN, with NOTHING sent. Mainnet-shaped payloads (or any
// input carrying endpoint/RPC/send indicators) are REFUSED by the test harness BEFORE any signing — there is
// no network field in src (adding one would be a new SSOT name), so testnet-shaping + mainnet refusal live in
// this test. No src change, no dependency, no ALLOWLIST change, no broadcast/RPC/serialization/mainnet.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';

import * as runtime from '../src/index.mjs';
import { runMechanismGuard, scanText, isAllowlisted, ALLOWLIST, collectSourceFiles, stripCommentsAndStrings } from '../../../tools/check-mechanism-guards.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const enc = (s) => new TextEncoder().encode(s);
const toRel = (f) => { const n = f.replaceAll('\\', '/'); const i = n.indexOf('packages/'); return i >= 0 ? n.slice(i) : n; };
const ephemeralPair = () => webcrypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);

// ---- test harness: testnet/devnet shaping + mainnet/endpoint refusal (NO src network field) ----

// Indicators that mark a payload as mainnet / network-sending. Their presence => REFUSE (never sign).
const MAINNET_OR_SEND_INDICATOR = /(mainnet|rpc|endpoint|broadcast|\bsend\b|https?:\/\/|sendTransaction|provider_url|cluster)/i;
const TESTNET_NETWORKS = new Set(['devnet', 'testnet', 'localnet']);

// Returns true if the payload is mainnet-shaped or carries endpoint/RPC/send indicators.
function isMainnetOrSendShaped(payload) {
  if (payload == null || typeof payload !== 'object') return false;
  if (typeof payload.network === 'string' && !TESTNET_NETWORKS.has(payload.network)) return true;
  for (const [k, v] of Object.entries(payload)) {
    if (MAINNET_OR_SEND_INDICATOR.test(String(k))) return true;
    if (typeof v === 'string' && MAINNET_OR_SEND_INDICATOR.test(v)) return true;
  }
  return false;
}

// Build a sign request for a TESTNET/DEVNET-shaped local payload ONLY. Throws for mainnet/endpoint/RPC.
function buildTestnetSignRequest(payload, base) {
  if (isMainnetOrSendShaped(payload)) {
    const e = new Error('refused: mainnet/endpoint/send-shaped payload is not permitted in sign-only proof');
    e.refused = true;
    throw e;
  }
  if (!TESTNET_NETWORKS.has(payload.network)) {
    const e = new Error('refused: payload is not testnet/devnet-shaped');
    e.refused = true;
    throw e;
  }
  // derive a local digest for the testnet-shaped payload (in-test; no serialization, no tx)
  const digest = `${payload.network}:${payload.ref}`;
  return { ...base, payload_digest: digest, approved_payload_digest: digest };
}

const BASE = Object.freeze({
  risk_approved: true, real_live_config_valid: true,
  signer_profile_status: 'ACTIVE', execution_wallet_status: 'ACTIVE', operating_state: 'ACTIVE',
  custody_phase: 'loaded', provider_status: 'configured',
  approval_age_slots: 2, max_approval_age_slots: 10,
  intent_id: 'intent-1', idempotency_key: 'idem-1',
  validation_status: 'valid', protocol_constant_status: 'green', provider_degraded: false,
  slot_lag: 0, slot_lag_max: 5, audit_path_available: true, admission_complete: true, operator_checklist_complete: true,
  audit_actor: 'op',
});

// ---- 1) sign-only proof over a testnet/devnet-shaped payload; verifies off-chain; can_send false ----

test('C5-1 testnet/devnet-shaped payload signs and verifies OFF-CHAIN; can_send false; no tx', async () => {
  const pair = await ephemeralPair();
  for (const network of ['devnet', 'testnet', 'localnet']) {
    const req = buildTestnetSignRequest({ network, ref: 'local-payload-1' }, BASE);
    const r = await runtime.createRealSigningPath().attemptSign(req, pair.privateKey);
    assert.equal(r.ok, true);
    assert.equal(r.signed, true);
    assert.equal(r.can_send, false);
    const sig = Buffer.from(r.signature, 'base64');
    // OFF-CHAIN verification against the bound digest only
    assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, enc(`${network}:local-payload-1`)), true);
    assert.equal(await webcrypto.subtle.verify({ name: 'Ed25519' }, pair.publicKey, sig, enc('other-bytes')), false);
    for (const k of ['tx', 'transaction', 'serialized', 'raw', 'bytes', 'endpoint', 'rpc']) assert.equal(k in r, false, `no ${k}`);
  }
});

// ---- 2) mainnet/endpoint/RPC-shaped payloads are REFUSED before signing ----

test('C5-1 mainnet/endpoint/RPC/send-shaped payloads are refused; no signature produced', async () => {
  const pair = await ephemeralPair();
  const path = runtime.createRealSigningPath();
  const mainnetCases = [
    { network: 'mainnet', ref: 'x' },
    { network: 'mainnet-beta', ref: 'x' },
    { network: 'devnet', ref: 'x', rpc_endpoint: 'https://example/' },
    { network: 'devnet', ref: 'x', broadcast: true },
    { network: 'devnet', ref: 'x', provider_url: 'http://node/' },
    { network: 'devnet', ref: 'x', cluster: 'mainnet' },
  ];
  for (const payload of mainnetCases) {
    let refused = false;
    try { buildTestnetSignRequest(payload, BASE); }
    catch (e) { refused = e.refused === true; }
    assert.equal(refused, true, `must refuse mainnet/endpoint payload: ${JSON.stringify(payload)}`);
  }
  // sanity: the path itself never sends regardless
  const r = await path.attemptSign(buildTestnetSignRequest({ network: 'devnet', ref: 'ok' }, BASE), pair.privateKey);
  assert.equal(r.can_send, false);
});

// ---- 3) gate failures refuse (wrong digest / stale approval / readiness / custody) ----

test('C5-1 gate failures refuse a signature for testnet-shaped requests too', async () => {
  const pair = await ephemeralPair();
  const path = runtime.createRealSigningPath();
  const req = buildTestnetSignRequest({ network: 'devnet', ref: 'r' }, BASE);
  const cases = [
    [{ payload_digest: 'devnet:WRONG' }, 'payload_digest_mismatch'], // breaks binding
    [{ approval_age_slots: 999 }, 'approval_stale'],
    [{ provider_degraded: true }, 'readiness_not_ready'],
    [{ custody_phase: 'degraded' }, 'custody_degraded'],
    [{ provider_status: 'unconfigured' }, 'custody_unconfigured'],
  ];
  for (const [override, blocker] of cases) {
    const r = await path.attemptSign({ ...req, ...override }, pair.privateKey);
    assert.notEqual(r.ok, true, `must refuse: ${blocker}`);
    assert.equal(r.signed, false);
    assert.equal(r.signature, null);
    assert.ok(r.blockers.includes(blocker), `expected ${blocker}`);
  }
});

// ---- 4) audit before/after, no secrets, keys subset of AUDIT_COLUMNS ----

test('C5-1 audit before/after for the testnet proof; keys ⊆ AUDIT_COLUMNS; no sig/digest/key', async () => {
  const pair = await ephemeralPair();
  const log = createAuditLog();
  const req = buildTestnetSignRequest({ network: 'devnet', ref: 'audit-ref' }, BASE);
  const r = await runtime.createRealSigningPath({ auditLog: log }).attemptSign(req, pair.privateKey);
  assert.equal(log.length, 2);
  assert.match(log.get(0).audit_reason, /real_sign_before/);
  assert.match(log.get(1).audit_reason, /real_sign_after_signed_sign_only_no_send/);
  const allowed = new Set(AUDIT_COLUMNS);
  for (const e of log.list()) {
    for (const k of Object.keys(e)) assert.ok(allowed.has(k), `audit key ${k} in AUDIT_COLUMNS`);
    const blob = JSON.stringify(e);
    assert.equal(blob.includes('devnet:audit-ref'), false, 'audit must not contain the digest');
    assert.equal(blob.includes(r.signature), false, 'audit must not contain the signature');
    for (const bad of ['privateKey', 'secret', 'mnemonic', 'seed']) assert.equal(blob.toLowerCase().includes(bad.toLowerCase()), false);
  }
});

// ---- 5) no key export / no static key material ----

test('C5-1 ephemeral key non-extractable; output carries no key; src has no static key material', async () => {
  const pair = await ephemeralPair();
  assert.equal(pair.privateKey.extractable, false);
  const r = await runtime.createRealSigningPath().attemptSign(buildTestnetSignRequest({ network: 'devnet', ref: 'k' }, BASE), pair.privateKey);
  for (const k of ['key', 'privateKey', 'private_key', 'secret', 'seed', 'mnemonic', 'keypair']) assert.equal(k in r, false, `output must not carry ${k}`);
  const KEYMAT = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|\b[1-9A-HJ-NP-Za-km-z]{64,}\b|\bmnemonic\b|seed phrase)/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(KEYMAT.test(stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'))), false, `static key material in ${fn}`);
  }
  assert.equal(existsSync(join(SRC, '..', 'fixtures')), false, 'no fixtures dir (no fixture keys)');
});

// ---- 6) no send / no RPC / no serialization in src ----

test('C5-1 no send/RPC/serialization anywhere in isolated-signer src', () => {
  const FORBID = /(\bsendTransaction\b|\bsendRawTransaction\b|new\s+Connection\s*\(|\.serialize\s*\(|buildTransaction|new\s+Transaction\b|\bfetch\s*\(|axios|node:net|node:http|node:dgram)/;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(FORBID.test(stripCommentsAndStrings(readFileSync(join(SRC, fn), 'utf8'))), false, `send/RPC/serialize in ${fn}`);
  }
});

// ---- 7) confinement / allowlist ----

test('C5-1 confinement: real-signing-path under allowlisted path; node:crypto confined; outside path forbidden', () => {
  assert.equal(isAllowlisted('packages/isolated-signer-runtime/src/real-signing-path.mjs', ALLOWLIST), true);
  assert.equal(ALLOWLIST.length, 1);
  for (const f of collectSourceFiles()) {
    if (/node:crypto/.test(readFileSync(f, 'utf8'))) {
      assert.ok(toRel(f).startsWith('packages/isolated-signer-runtime/src/'), `node:crypto outside path: ${toRel(f)}`);
    }
  }
  assert.ok(scanText('packages/other/src/x.mjs', "import x from '@noble/curves/ed25519';").some((v) => v.rule === 'crypto-signing-lib-import'));
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
});
