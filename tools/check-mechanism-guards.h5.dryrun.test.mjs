// PR-H5 — Allowlist Activation DRY-RUN evidence.
//
// This is TEST/REPORT-ONLY. It proves that activating the declared allowlist path is *testable in theory*
// WITHOUT actually activating it. Activation here is SIMULATED purely by passing an explicit `allowlist`
// PARAMETER into the guard's public API (`runMechanismGuard({ allowlist })` / `scanText(..., { allowlist })`).
// The real module-level `ALLOWLIST` stays `[]` and is never modified. This file changes NO guard core.
//
// It is NOT B8 activation: B8 (moving the declared path into the real `ALLOWLIST`) remains BLOCKED.

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

// A SIMULATED allowlist passed ONLY as a parameter — never assigned to the real ALLOWLIST.
const SIMULATED_ALLOWLIST = Object.freeze([...DECLARED_ALLOWLIST_PATHS]);

// ---- Proof 1: the REAL ALLOWLIST is actually empty ---------------------------

test('H5.1 real ALLOWLIST is [] (empty) and the active guard runs at allowlist=0', () => {
  assert.equal(ALLOWLIST.length, 0);
  const res = runMechanismGuard();                            // no args -> uses the real empty ALLOWLIST
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 0);
});

// ---- Proof 2: the declared path EXISTS but is NOT activated ------------------

test('H5.2 isolated-signer-runtime/src exists yet is NOT activated under the real ALLOWLIST', () => {
  const sources = collectSourceFiles();
  // the skeleton package source is actually present in the scan set
  assert.ok(
    sources.some((f) => f.replaceAll('\\', '/').includes('isolated-signer-runtime/src/')),
    'expected isolated-signer-runtime/src files to be scanned',
  );
  // but the real (empty) allowlist exempts none of them
  assert.equal(isAllowlisted(DECLARED_FILE, ALLOWLIST), false);
  for (const f of sources) assert.equal(isAllowlisted(f, ALLOWLIST), false, `real allowlist must not exempt ${f}`);
});

// ---- Proof 3: live mechanism FAILS under the empty (real) allowlist ----------

test('H5.3 a live mechanism at the declared path FAILS under the real empty ALLOWLIST', () => {
  const v = scanText(DECLARED_FILE, "import { Connection } from '@solana/web3.js';\nc.sendRawTransaction(tx);");
  assert.ok(rules(v).includes('solana-sdk-import'));
  assert.ok(rules(v).includes('tx-send'));
});

// ---- Proof 4: PASSES only via an explicit allowlist PARAMETER (not the real ALLOWLIST) ----

test('H5.4 the SAME file is exempt ONLY when an allowlist is passed as a parameter; real state stays []', () => {
  const live = "import { Connection, Keypair } from '@solana/web3.js';\nconn.sendRawTransaction(tx);\nnew KeyManager();";
  // simulated activation via PARAMETER -> exempt
  assert.deepEqual(scanText(DECLARED_FILE, live, { allowlist: SIMULATED_ALLOWLIST }), []);
  // real guard (default arg) STILL fails on the very same content -> proves divergence
  assert.ok(scanText(DECLARED_FILE, live).length > 0);
  // and the real module-level ALLOWLIST was NOT mutated by passing a parameter
  assert.equal(ALLOWLIST.length, 0);
  assert.equal(runMechanismGuard().counts.allowlist, 0);
  // a simulated run reports the simulated count, the real run reports 0 — they do not bleed into each other
  assert.equal(runMechanismGuard({ allowlist: SIMULATED_ALLOWLIST }).counts.allowlist, SIMULATED_ALLOWLIST.length);
  assert.equal(runMechanismGuard().counts.allowlist, 0);
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

// ---- Proof 7 (closing invariant): repo is fully closed at the real empty ALLOWLIST ----

test('H5.7 dry-run leaves the repo fully closed: real guard PASS at allowlist=0, B8 not activated', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 0);
  assert.equal(ALLOWLIST.length, 0);
});
