import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as runtime from '../src/index.mjs';
import { capabilities, describeIsolationBoundary } from '../src/index.mjs';
import { runMechanismGuard, scanText, isAllowlisted, ALLOWLIST, DECLARED_ALLOWLIST_PATHS } from '../../../tools/check-mechanism-guards.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';
import { createAuditLog } from '../../data/src/audit.mjs';
import { AUDIT_COLUMNS } from '../../data/src/schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const stripCode = (raw) => raw
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');

test('skeleton capabilities are all-false: no sign/send/key/live-mechanism, not allowlisted', () => {
  const c = capabilities();
  assert.deepEqual(c, { can_sign: false, can_send: false, has_key_material: false, live_mechanisms: false, allowlisted: false, status: 'skeleton' });
  const d = describeIsolationBoundary();
  assert.equal(d.can_sign, false); assert.equal(d.can_send, false); assert.equal(d.has_key_material, false);
  assert.equal(d.live_mechanisms, false); assert.equal(d.allowlisted, false);
});

test('skeleton exposes NO signing/sending/execution authority surface', () => {
  for (const k of ['sign', 'send', 'submit', 'execute', 'serialize', 'buildTransaction', 'loadKey', 'KeyManager', 'requestSign']) {
    assert.equal(typeof runtime[k], 'undefined', `runtime must not export ${k}`);
  }
});

test('package source contains NO live mechanism / no key material (CODE scan)', () => {
  const BAD = /(KeyManager|\bKMS\b|\bvault\b|@noble|tweetnacl|bs58|ed25519|web3|@solana\/|jupiter|helius|jito|signTransaction|signAllTransactions|partialSign|sendTransaction|sendRawTransaction|\.serialize\(|buildTransaction|new\s+Transaction|node:crypto|createHash|\bfetch\b|axios|https?:\/\/|node:net|node:http|node:dgram|INSERT\s|UPDATE\s|DELETE\s+FROM|\.query\(|clickhouse|createPool|private[_-]?key|secret[_-]?key|\bmnemonic\b|keypair|activate_real_live\s*\()/i;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(BAD.test(stripCode(readFileSync(join(SRC, fn), 'utf8'))), false, `forbidden mechanism in ${fn}`);
  }
});

test('only approved internal imports (E2-B wiring); no forbidden SDK/provider imports', () => {
  // E2-B introduces wiring that consumes the keyless lifecycle + custody provider contract via relative
  // imports. The skeleton module itself stays import-free; the wiring module may import ONLY the two
  // approved internal packages (relative paths). No external/SDK/provider import is allowed.
  const ALLOWED_IMPORT = /^(\.\.\/\.\.\/keyless-custody-lifecycle\/src\/index\.mjs|\.\.\/\.\.\/custody-provider-contract\/src\/index\.mjs|\.\.\/\.\.\/real-live-readiness\/src\/index\.mjs)$/;
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const raw = readFileSync(join(SRC, fn), 'utf8');
    for (const m of raw.matchAll(/\bimport\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      assert.equal(spec.startsWith('.') && ALLOWED_IMPORT.test(spec), true, `disallowed import "${spec}" in ${fn}`);
    }
    // bare imports (side-effect) are not allowed anywhere
    assert.equal(/\bimport\s*['"][^'"]+['"]/.test(raw), false, `bare side-effect import in ${fn}`);
  }
  // the skeleton module remains import-free
  assert.equal(/^\s*import\s/m.test(readFileSync(join(SRC, 'isolated-signer-runtime.mjs'), 'utf8')), false, 'skeleton module must stay import-free');
});

test('no forbidden SSOT names; no candidate_*', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    const code = stripCode(readFileSync(join(SRC, fn), 'utf8'));
    assert.equal(/candidate_/.test(code), false, `candidate_* in ${fn}`);
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
  }
});

// ---- the path now EXISTS and is ACTIVATED (B8, DR-E2-B8-001): exempt for THIS path only ----

test('B8 activated: ALLOWLIST holds exactly this one path and the guard passes at allowlist=1', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
  // this package's files ARE now exempt under the ACTIVE allowlist (this is the activated path)
  const here = 'packages/isolated-signer-runtime/src/index.mjs';
  assert.equal(isAllowlisted(here, ALLOWLIST), true);
});

test('post-B8 a HYPOTHETICAL live mechanism at THIS (activated) path is exempt; key material still forbidden', () => {
  const label = 'packages/isolated-signer-runtime/src/index.mjs';
  // active ALLOWLIST now contains this path -> live mechanism here is exempt from live-mechanism checks
  assert.deepEqual(scanText(label, "import x from '@solana/web3.js';"), []);
  assert.deepEqual(scanText(label, 'wallet.signTransaction(tx);'), []);
  // but key material stays HARD-forbidden even inside the activated path
  assert.ok(scanText(label, "const k = '-----BEGIN PRIVATE KEY-----';").some((v) => v.rule.startsWith('allowlisted_but_key_material:')));
  // and ALLOWLIST equals the declared path set (no drift, no extra path)
  assert.deepEqual([...ALLOWLIST], [...DECLARED_ALLOWLIST_PATHS]);
});

// ================= E2-B: custody lifecycle WIRING with STUB provider =================

const VALID_REQ = Object.freeze({
  audit_actor: 'op', signer_profile_id: 'sp1', permission_role: 'signer_control',
  signer_profile_status: 'ACTIVE', key_custody_mode: 'isolated_signer',
});

test('E2-B descriptor: wiring is stub-only with all execution capabilities false', () => {
  const d = runtime.describeCustodyLifecycle();
  assert.equal(d.status, 'stub_wiring');
  assert.equal(d.provider_status, 'unconfigured');
  assert.equal(d.can_sign, false);
  assert.equal(d.can_send, false);
  assert.equal(d.has_key_material, false);
  assert.equal(d.is_live, false);
});

test('E2-B wiring exposes NO signing/sending/execution authority surface', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  for (const k of ['sign', 'send', 'submit', 'execute', 'serialize', 'buildTransaction', 'loadKey', 'requestSign']) {
    assert.equal(typeof lc[k], 'undefined', `lifecycle must not expose ${k}`);
  }
});

test('E2-B fail-closed: provider unconfigured -> requestLoad never succeeds, recommends DEGRADED', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  const r = lc.requestLoad({ ...VALID_REQ });
  assert.equal(r.ok, false);
  assert.equal(r.refusal_reason, 'custody_unavailable_degraded');
  assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  assert.equal(r.can_sign, false);
  assert.equal(r.signed, false);
});

test('E2-B fail-closed: caller cannot force custody_available=true through the stub', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  // even if the caller passes custody_available:true, the stub forces it false -> DEGRADED
  const r = lc.requestLoad({ ...VALID_REQ, custody_available: true });
  assert.equal(r.ok, false);
  assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
});

test('E2-B fail-closed: use() requires loaded (never reachable) -> fail-closed, no signature', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  const r = lc.use({ ...VALID_REQ });
  assert.equal(r.ok, false);
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
});

test('E2-B rejects non-isolated_signer mode and non-ACTIVE status (delegated gate)', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  assert.equal(lc.requestLoad({ ...VALID_REQ, key_custody_mode: 'connected_wallet' }).refusal_reason, 'custody_not_isolated_signer');
  assert.equal(lc.requestLoad({ ...VALID_REQ, signer_profile_status: 'DISABLED' }).refusal_reason, 'signer_not_active');
});

test('E2-B least-privilege: profile A session does not grant profile B', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  lc.requestLoad({ ...VALID_REQ, signer_profile_id: 'A' });
  // B has its own (absent) session; use on B is not granted by A
  const rb = lc.use({ ...VALID_REQ, signer_profile_id: 'B' });
  assert.equal(rb.ok, false);
  assert.equal(rb.signer_profile_id, 'B');
});

test('E2-B zeroize is idempotent; revoke zeroizes (signer_control)', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  const z1 = lc.zeroize('sp1', { audit_actor: 'op' });
  assert.equal(z1.ok, true); assert.equal(z1.zeroized, true);
  const z2 = lc.zeroize('sp1', { audit_actor: 'op' });
  assert.equal(z2.ok, true); assert.equal(z2.idempotent, true);
  const rv = lc.revoke('sp2', { audit_actor: 'op', permission_role: 'signer_control' });
  assert.equal(rv.ok, true); assert.equal(rv.revoked, true); assert.equal(rv.zeroized, true);
});

test('E2-B key-material-shaped input is refused and never returned', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  const r = lc.requestLoad({ ...VALID_REQ, secret: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.refusal_reason, 'key_material_not_accepted');
  assert.equal(JSON.stringify(r).toLowerCase().includes('"x"'), false);
});

test('E2-B shutdown/panic zeroize all sessions', () => {
  const lc = runtime.createIsolatedCustodyLifecycle();
  lc.requestLoad({ ...VALID_REQ, signer_profile_id: 'A' });
  lc.requestLoad({ ...VALID_REQ, signer_profile_id: 'B' });
  const s = lc.shutdown({ audit_actor: 'op' });
  assert.equal(s.ok, true);
  assert.ok(s.zeroized_sessions >= 2);
});

test('E2-B guard still PASSES with allowlist exactly one path (no allowlist change)', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
});

// ================= E2-C0: signing PREFLIGHT GATE (mock / no signing) =================

// A fully-satisfied (mock) preflight input. provider_status:'configured' is a HYPOTHETICAL input — the real
// E2-B wiring never produces it; here it only exercises the gate's logic. The gate STILL never signs.
const VALID_PREFLIGHT = Object.freeze({
  risk_approved: true,
  real_live_config_valid: true,
  signer_profile_status: 'ACTIVE',
  execution_wallet_status: 'ACTIVE',
  operating_state: 'ACTIVE',
  custody_phase: 'loaded',
  provider_status: 'configured',
  payload_digest: 'digest-abc',
  approved_payload_digest: 'digest-abc',
  approval_age_slots: 2,
  max_approval_age_slots: 10,
  intent_id: 'intent-1',
  idempotency_key: 'idem-1',
  // E0 readiness mock inputs (hard precondition; must all be ready for preflight_ok)
  validation_status: 'valid',
  protocol_constant_status: 'green',
  provider_degraded: false,
  slot_lag: 0,
  slot_lag_max: 5,
  audit_path_available: true,
  admission_complete: true,
  operator_checklist_complete: true,
});

test('E2-C0 happy path: preflight_ok but NEVER signs/sends', () => {
  const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT });
  assert.equal(r.preflight_ok, true);
  assert.equal(r.blockers.length, 0);
  // never signs, never sends, never attempts
  assert.equal(r.can_attempt_signing, false);
  assert.equal(r.signed, false);
  assert.equal(r.signature, null);
  assert.equal(r.can_send, false);
  assert.match(r.note, /separate E2-C approval/);
});

test('E2-C0 each missing/invalid precondition yields its blocker (fail-closed)', () => {
  const cases = [
    [{ risk_approved: false }, 'risk_not_approved'],
    [{ real_live_config_valid: false }, 'real_live_config_invalid'],
    [{ signer_profile_status: 'DEGRADED' }, 'signer_not_active'],
    [{ execution_wallet_status: 'DISABLED' }, 'execution_wallet_not_active'],
    [{ operating_state: 'EXITS_ONLY' }, 'operating_state_not_active'],
    [{ custody_phase: 'degraded' }, 'custody_degraded'],
    [{ provider_status: 'unconfigured' }, 'custody_unconfigured'],
    [{ payload_digest: 'x', approved_payload_digest: 'y' }, 'payload_digest_mismatch'],
    [{ approval_age_slots: 99 }, 'approval_stale'],
    [{ intent_id: undefined }, 'missing_intent_id'],
    [{ idempotency_key: undefined }, 'missing_idempotency_key'],
  ];
  for (const [override, blocker] of cases) {
    const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT, ...override });
    assert.equal(r.preflight_ok, false, `expected blocked for ${blocker}`);
    assert.ok(r.blockers.includes(blocker), `expected blocker ${blocker}, got ${r.blockers.join(',')}`);
    assert.equal(r.signed, false); assert.equal(r.signature, null); assert.equal(r.can_send, false);
  }
});

test('E2-C0 fail-closed: empty/invalid input is fully blocked, never ok', () => {
  for (const bad of [undefined, null, {}, 'x', 42]) {
    const r = runtime.evaluateSigningPreflight(bad);
    assert.equal(r.preflight_ok, false);
    assert.equal(r.can_attempt_signing, false);
    assert.equal(r.signed, false);
  }
  // missing provider_status is treated as unconfigured (fail-closed)
  const noProvider = { ...VALID_PREFLIGHT };
  delete noProvider.provider_status;
  assert.ok(runtime.evaluateSigningPreflight(noProvider).blockers.includes('custody_unconfigured'));
});

test('E2-C0 key-material-shaped input is refused (no further evaluation, never echoed)', () => {
  const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT, secret: 'nope' });
  assert.equal(r.preflight_ok, false);
  assert.deepEqual([...r.blockers], ['key_material_not_accepted']);
  assert.equal(JSON.stringify(r).includes('nope'), false);
});

test('E2-C0 output envelope carries NO signature/bytes/transaction', () => {
  const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT });
  assert.equal('signature' in r, true);
  assert.equal(r.signature, null);
  for (const k of ['bytes', 'tx', 'transaction', 'serialized', 'raw']) {
    assert.equal(k in r, false, `envelope must not carry ${k}`);
  }
});

// ================= E2-D: audit BEFORE/AFTER around the preflight attempt (no signing) =================

test('E2-D before+after audited for SUCCESS path; never signs', () => {
  const events = [];
  const gate = runtime.createSigningPreflightGate({ auditLog: { append: (e) => events.push(e) } });
  const ok = gate.evaluate({ ...VALID_PREFLIGHT, audit_actor: 'op', request_id: 'r1', signer_profile_id: 'sp1' });
  assert.equal(ok.preflight_ok, true);
  assert.equal(ok.signed, false); assert.equal(ok.signature, null); assert.equal(ok.can_send, false);
  assert.equal(events.length, 2); // before + after
  assert.match(events[0].audit_reason, /signing_preflight_before/);
  assert.match(events[1].audit_reason, /signing_preflight_after_ok_no_signing/);
});

test('E2-D before+after audited for REFUSAL path', () => {
  const events = [];
  const gate = runtime.createSigningPreflightGate({ auditLog: { append: (e) => events.push(e) } });
  const blocked = gate.evaluate({ ...VALID_PREFLIGHT, risk_approved: false, audit_actor: 'op', intent_id: 'i9' });
  assert.equal(blocked.preflight_ok, false);
  assert.equal(events.length, 2);
  assert.match(events[0].audit_reason, /signing_preflight_before/);
  assert.match(events[1].audit_reason, /signing_preflight_after_blocked:.*risk_not_approved/);
});

test('E2-D audit entries validate against AUDIT_COLUMNS (real append-only log)', () => {
  const log = createAuditLog();
  const gate = runtime.createSigningPreflightGate({ auditLog: log });
  gate.evaluate({ ...VALID_PREFLIGHT, audit_actor: 'op', request_id: 'r1', idempotency_key: 'k1', intent_id: 'i1', signer_profile_id: 'sp1' });
  gate.evaluate({ ...VALID_PREFLIGHT, risk_approved: false, audit_actor: 'op' });
  assert.equal(log.length, 4); // 2 attempts x (before + after); createAuditLog throws on unknown columns
  const allowed = new Set(AUDIT_COLUMNS);
  for (const e of log.list()) {
    for (const k of Object.keys(e)) assert.ok(allowed.has(k), `audit key ${k} must be in AUDIT_COLUMNS`);
  }
});

test('E2-D audit carries NO secrets / no raw payload / no signature / no tx bytes', () => {
  const log = createAuditLog();
  const gate = runtime.createSigningPreflightGate({ auditLog: log });
  // include a digest + (refused) key-material-shaped field; neither must reach the audit
  gate.evaluate({ ...VALID_PREFLIGHT, audit_actor: 'op', intent_id: 'i1', signer_profile_id: 'sp1', payload_digest: 'digest-abc', approved_payload_digest: 'digest-abc' });
  for (const e of log.list()) {
    const blob = JSON.stringify(e);
    for (const bad of ['digest-abc', 'signature', 'serialized', 'transaction', 'bytes', 'secret', 'private_key', 'mnemonic']) {
      assert.equal(blob.toLowerCase().includes(bad.toLowerCase()), false, `audit must not contain ${bad}`);
    }
  }
});

test('E2-D fail-closed: audit configured but audit_actor missing -> blocked, NO append (no partial)', () => {
  const log = createAuditLog();
  const gate = runtime.createSigningPreflightGate({ auditLog: log });
  const r = gate.evaluate({ ...VALID_PREFLIGHT }); // no audit_actor
  assert.equal(r.preflight_ok, false);
  assert.ok(r.blockers.includes('audit_actor_required'));
  assert.equal(r.signed, false);
  assert.equal(log.length, 0); // nothing appended, not even a "before"
});

test('E2-D append-only: gate audit log exposes no update/delete', () => {
  const log = createAuditLog();
  assert.equal(typeof log.append, 'function');
  assert.equal(typeof log.update, 'undefined');
  assert.equal(typeof log.delete, 'undefined');
  assert.equal(typeof log.clear, 'undefined');
});

test('E2-D no-audit passthrough still never signs', () => {
  const gate = runtime.createSigningPreflightGate();
  const r = gate.evaluate({ ...VALID_PREFLIGHT });
  assert.equal(r.preflight_ok, true);
  assert.equal(r.signed, false); assert.equal(r.signature, null); assert.equal(r.can_send, false);
});

// ================= E2-E: readiness integration + fail-closed DEGRADED (no signing) =================

test('E2-E readiness ready=true allows preflight_ok but NEVER signs', () => {
  const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT });
  assert.equal(r.preflight_ok, true);
  assert.equal(r.readiness_ready, true);
  assert.equal(r.signed, false); assert.equal(r.signature, null); assert.equal(r.can_send, false);
});

test('E2-E readiness blockers prevent preflight_ok (readiness_not_ready)', () => {
  // each readiness mock input flipped to a not-ready value adds readiness_not_ready
  for (const override of [
    { validation_status: 'invalid' },
    { protocol_constant_status: 'changed' },
    { provider_degraded: true },
    { slot_lag: 999 },
    { audit_path_available: false },
    { admission_complete: false },
    { operator_checklist_complete: false },
  ]) {
    const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT, ...override });
    assert.equal(r.preflight_ok, false, `expected blocked for ${JSON.stringify(override)}`);
    assert.ok(r.blockers.includes('readiness_not_ready'), `expected readiness_not_ready for ${JSON.stringify(override)}`);
    assert.equal(r.signed, false); assert.equal(r.can_send, false);
  }
});

test('E2-E custody DEGRADED is fail-closed and recommends signer_profile_status=DEGRADED', () => {
  const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT, custody_phase: 'degraded' });
  assert.equal(r.preflight_ok, false);
  assert.ok(r.blockers.includes('custody_degraded'));
  assert.equal(r.recommended_signer_profile_status, 'DEGRADED');
  assert.equal(r.signed, false); assert.equal(r.can_send, false);
});

test('E2-E unconfigured/unknown provider is fail-closed and recommends DEGRADED', () => {
  const unconf = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT, provider_status: 'unconfigured' });
  assert.ok(unconf.blockers.includes('custody_unconfigured'));
  assert.equal(unconf.recommended_signer_profile_status, 'DEGRADED');
  const noProvider = { ...VALID_PREFLIGHT };
  delete noProvider.provider_status;
  const r2 = runtime.evaluateSigningPreflight(noProvider);
  assert.ok(r2.blockers.includes('custody_unconfigured'));
  assert.equal(r2.recommended_signer_profile_status, 'DEGRADED');
});

test('E2-E audit before/after continues through readiness failure', () => {
  const log = createAuditLog();
  const gate = runtime.createSigningPreflightGate({ auditLog: log });
  const r = gate.evaluate({ ...VALID_PREFLIGHT, provider_degraded: true, audit_actor: 'op' });
  assert.equal(r.preflight_ok, false);
  assert.ok(r.blockers.includes('readiness_not_ready'));
  assert.equal(log.length, 2); // before + after, even on readiness failure
  assert.match(log.get(0).audit_reason, /signing_preflight_before/);
  assert.match(log.get(1).audit_reason, /signing_preflight_after_blocked:.*readiness_not_ready/);
});

test('E2-E does NOT call activate_real_live and adds no REAL-LIVE activation', () => {
  // source scan: no activation call anywhere in the gate
  const code = stripCode(readFileSync(join(SRC, 'signing-preflight-gate.mjs'), 'utf8'));
  assert.equal(/activate_real_live\s*\(/.test(code), false);
  // even a fully-ready preflight never signs/sends and carries no activation
  const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT });
  assert.equal(r.can_send, false);
  assert.equal('activated' in r, false);
});

test('E2-E key material refused even with full readiness inputs; capabilities stay all-false', () => {
  const r = runtime.evaluateSigningPreflight({ ...VALID_PREFLIGHT, secret: 'no' });
  assert.deepEqual([...r.blockers], ['key_material_not_accepted']);
  assert.equal(JSON.stringify(r).includes('"no"'), false);
  assert.equal(runtime.capabilities().can_sign, false);
  assert.equal(runtime.capabilities().can_send, false);
});

test('E2-C0 does not flip capabilities; no signing/sending surface added', () => {
  // module-level: only the gate functions are added; no sign/send/execute exports
  for (const k of ['sign', 'send', 'submit', 'execute', 'serialize', 'buildTransaction', 'loadKey', 'requestSign']) {
    assert.equal(typeof runtime[k], 'undefined', `runtime must not export ${k}`);
  }
  // capabilities remain all-false
  assert.equal(runtime.capabilities().can_sign, false);
  assert.equal(runtime.capabilities().can_send, false);
});
