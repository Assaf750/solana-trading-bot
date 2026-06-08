import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as runtime from '../src/index.mjs';
import { capabilities, describeIsolationBoundary } from '../src/index.mjs';
import { runMechanismGuard, scanText, isAllowlisted, ALLOWLIST, DECLARED_ALLOWLIST_PATHS } from '../../../tools/check-mechanism-guards.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

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
  const ALLOWED_IMPORT = /^(\.\.\/\.\.\/keyless-custody-lifecycle\/src\/index\.mjs|\.\.\/\.\.\/custody-provider-contract\/src\/index\.mjs)$/;
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
