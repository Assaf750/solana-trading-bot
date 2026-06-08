// PR-H5 — Allowlist Activation DRY-RUN evidence (UPDATED post-B8 activation, PR-E2-R5).
//
// This is TEST/REPORT-ONLY. It originally proved that activating the declared allowlist path was *testable
// in theory* via an explicit `allowlist` PARAMETER, while the real `ALLOWLIST` stayed `[]`. As of B8
// (`DR-E2-B8-001`) the declared path has been ACTIVATED: the real `ALLOWLIST` now contains exactly that one
// path. The assertions below are updated to the post-activation reality, and the parameter-vs-real
// divergence proof now uses a DIFFERENT, non-activated hypothetical path to show that passing a parameter
// still never mutates the real `ALLOWLIST` (which remains exactly the one activated path). This file
// changes NO guard core.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scanText, runMechanismGuard, isAllowlisted, collectSourceFiles,
  ALLOWLIST, DECLARED_ALLOWLIST_PATHS,
} from './check-mechanism-guards.mjs';

const rules = (vs) => vs.map((v) => v.rule).sort();

const DECLARED = DECLARED_ALLOWLIST_PATHS[0];                 // 'packages/isolated-signer-runtime/src/'
const DECLARED_FILE = `${DECLARED}signer.mjs`;
const OUTSIDE_FILE = 'packages/signer-service-boundary/src/x.mjs';

// A SIMULATED, NON-activated extra path passed ONLY as a parameter — never assigned to the real ALLOWLIST.
const HYPOTHETICAL_EXTRA = 'packages/__hypothetical_other__/src/';
const SIMULATED_ALLOWLIST = Object.freeze([...DECLARED_ALLOWLIST_PATHS, HYPOTHETICAL_EXTRA]);

// ---- Proof 1: the REAL ALLOWLIST now holds exactly the one activated path -----

test('H5.1 real ALLOWLIST is the single activated declared path and guard runs at allowlist=1', () => {
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], DECLARED);
  const res = runMechanismGuard();                            // no args -> uses the real ALLOWLIST
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
});

// ---- Proof 2: the declared path EXISTS and is now ACTIVATED ------------------

test('H5.2 isolated-signer-runtime/src exists and is ACTIVATED; only its files are exempt', () => {
  const sources = collectSourceFiles();
  // the skeleton package source is actually present in the scan set
  assert.ok(
    sources.some((f) => f.replaceAll('\\', '/').includes('isolated-signer-runtime/src/')),
    'expected isolated-signer-runtime/src files to be scanned',
  );
  // the real allowlist now exempts the declared path, and ONLY files under it
  assert.equal(isAllowlisted(DECLARED_FILE, ALLOWLIST), true);
  // mirror the guard: compare on the repo-relative path (collectSourceFiles returns absolute paths)
  const toRel = (f) => { const n = f.replaceAll('\\', '/'); const i = n.indexOf('packages/'); return i >= 0 ? n.slice(i) : n; };
  for (const f of sources) {
    const rel = toRel(f);
    const expected = rel.startsWith('packages/isolated-signer-runtime/src/');
    assert.equal(isAllowlisted(rel, ALLOWLIST), expected, `real allowlist exemption mismatch for ${rel}`);
  }
});

// ---- Proof 3: a live mechanism OUTSIDE the activated path still FAILS ---------

test('H5.3 a live mechanism OUTSIDE the declared path FAILS under the real ALLOWLIST', () => {
  const v = scanText(OUTSIDE_FILE, "import { Connection } from '@solana/web3.js';\nc.sendRawTransaction(tx);");
  assert.ok(rules(v).includes('solana-sdk-import'));
  assert.ok(rules(v).includes('tx-send'));
});

// ---- Proof 4: a PARAMETER never mutates the real ALLOWLIST (still exactly one path) ----

test('H5.4 passing an extra allowlist path as a parameter does NOT mutate the real ALLOWLIST', () => {
  const live = "import { Connection } from '@solana/web3.js';\nconn.sendRawTransaction(tx);";
  const hypoFile = `${HYPOTHETICAL_EXTRA}x.mjs`;
  // under the simulated (param) allowlist the hypothetical extra path is exempt...
  assert.deepEqual(scanText(hypoFile, live, { allowlist: SIMULATED_ALLOWLIST }), []);
  // ...but under the REAL allowlist that same hypothetical path still fails (it was never activated)
  assert.ok(scanText(hypoFile, live).length > 0);
  // the real module-level ALLOWLIST was NOT mutated: still exactly the one activated path
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], DECLARED);
  assert.equal(runMechanismGuard().counts.allowlist, 1);
  // a simulated run reports the simulated count; the real run still reports 1 — no bleed-through
  assert.equal(runMechanismGuard({ allowlist: SIMULATED_ALLOWLIST }).counts.allowlist, SIMULATED_ALLOWLIST.length);
  assert.equal(runMechanismGuard().counts.allowlist, 1);
});

// ---- Proof 5: key material stays HARD-forbidden even inside the simulated allowlist ----

test('H5.5 key material is forbidden even inside the simulated allowlisted path', () => {
  const pem = scanText(DECLARED_FILE, "const k = '-----BEGIN PRIVATE KEY-----';", { allowlist: SIMULATED_ALLOWLIST });
  assert.ok(rules(pem).some((r) => r.startsWith('allowlisted_but_key_material:')));
  const blob = `const k = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';`;
  assert.ok(rules(scanText(DECLARED_FILE, blob, { allowlist: SIMULATED_ALLOWLIST })).some((r) => r.startsWith('allowlisted_but_key_material:')));
  const seed = scanText(DECLARED_FILE, 'const m = "mnemonic";', { allowlist: SIMULATED_ALLOWLIST });
  assert.ok(rules(seed).some((r) => r.startsWith('allowlisted_but_key_material:')));
});

// ---- Proof 6: live mechanism OUTSIDE the declared path stays rejected, even with the sim allowlist active ----

test('H5.6 live mechanisms OUTSIDE the declared path are rejected even under the simulated allowlist', () => {
  for (const [code, rule] of [
    ["import x from '@solana/web3.js';", 'solana-sdk-import'],
    ["import a from 'tweetnacl';", 'crypto-signing-lib-import'],
    ['wallet.signTransaction(t);', 'tx-sign'],
    ['c.sendRawTransaction(t);', 'tx-send'],
    ['tx.serialize();', 'tx-serialize'],
    ['const c = new Connection(u);', 'rpc-connection'],
    ['const k = new KeyManager();', 'key-manager'],
    ['activate_real_live();', 'real-live-activation-call'],
    ['const kp = Keypair.fromSecretKey(s);', 'keypair-material'],
  ]) {
    assert.ok(
      rules(scanText(OUTSIDE_FILE, code, { allowlist: SIMULATED_ALLOWLIST })).includes(rule),
      `${rule} must still fail outside the declared path under the simulated allowlist`,
    );
  }
});

// ---- Proof 7 (closing invariant): repo passes with exactly one activated path; everywhere else closed ----

test('H5.7 post-B8 the repo passes at allowlist=1; only the one declared path is activated', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], DECLARED);
});
