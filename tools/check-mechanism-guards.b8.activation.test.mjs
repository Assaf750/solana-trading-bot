// PR-E2-R5 / B8 — Allowlist Activation evidence (guard-only governance activation).
//
// B8 (`DR-E2-B8-001`) moved the single DECLARED isolated-signer path into the active ALLOWLIST. This test
// proves the activation is exactly as governed: ONE path, the declared one, with key material still
// HARD-forbidden inside it, every other path still fail-closed, the skeleton still free of live mechanisms,
// and the guard green. Activation is guard-only; it starts NO E2 implementation and adds NO live mechanism.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scanText, runMechanismGuard, isAllowlisted, collectSourceFiles,
  ALLOWLIST, DECLARED_ALLOWLIST_PATHS,
} from './check-mechanism-guards.mjs';
import { capabilities } from '../packages/isolated-signer-runtime/src/isolated-signer-runtime.mjs';

const rules = (vs) => vs.map((v) => v.rule).sort();
const DECLARED = 'packages/isolated-signer-runtime/src/';
const DECLARED_FILE = `${DECLARED}signer.mjs`;
const OUTSIDE_FILE = 'packages/signer-service-boundary/src/x.mjs';

// ---- B8.1: ALLOWLIST is exactly one path, the declared isolated-signer path ----

test('B8.1 ALLOWLIST contains exactly one entry == the declared isolated-signer path', () => {
  assert.equal(Array.isArray(ALLOWLIST), true);
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], DECLARED);
  // and it equals the declared path set (no drift between declaration and activation)
  assert.deepEqual([...ALLOWLIST], [...DECLARED_ALLOWLIST_PATHS]);
});

// ---- B8.2: no wildcard / no regex / no general bypass — only the literal prefix matches ----

test('B8.2 only the literal declared prefix matches; no wildcard/sibling/general bypass', () => {
  assert.equal(isAllowlisted(DECLARED_FILE, ALLOWLIST), true);
  assert.equal(isAllowlisted('packages/isolated-signer-runtime-evil/src/x.mjs', ALLOWLIST), false);
  assert.equal(isAllowlisted('packages/isolated-signer/src/x.mjs', ALLOWLIST), false);
  assert.equal(isAllowlisted('packages/other/src/x.mjs', ALLOWLIST), false);
  // entries are plain string prefixes, not regex sources
  for (const e of ALLOWLIST) assert.equal(typeof e, 'string');
});

// ---- B8.3: key material stays HARD-forbidden even inside the activated path ----

test('B8.3 key material is HARD-forbidden even inside the activated allowlisted path', () => {
  for (const src of [
    "const k = '-----BEGIN PRIVATE KEY-----';",
    `const k = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';`,
    'const m = "mnemonic";',
  ]) {
    assert.ok(
      rules(scanText(DECLARED_FILE, src)).some((r) => r.startsWith('allowlisted_but_key_material:')),
      `key material must be flagged inside the activated path: ${src.slice(0, 24)}`,
    );
  }
});

// ---- B8.4: live mechanisms OUTSIDE the activated path are still rejected ----

test('B8.4 live mechanisms OUTSIDE the activated path are still rejected (fail-closed elsewhere)', () => {
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
    assert.ok(rules(scanText(OUTSIDE_FILE, code)).includes(rule), `${rule} must still fail outside the activated path`);
  }
});

// ---- B8.5: the activated package is still a capabilities-all-false SKELETON (no live mechanism) ----

test('B8.5 isolated-signer-runtime is still a skeleton: no live mechanism, no key, cannot sign/send', () => {
  const caps = capabilities();
  assert.equal(caps.can_sign, false);
  assert.equal(caps.can_send, false);
  assert.equal(caps.has_key_material, false);
  assert.equal(caps.live_mechanisms, false);
  assert.equal(caps.status, 'skeleton');
});

// ---- B8.6: the guard PASSES on the real repo after activation ----

test('B8.6 the mechanism guard PASSES post-activation at allowlist=1, violations=0', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  assert.equal(res.counts.violations, 0);
  assert.ok(res.counts.sources > 0);
});

// ---- B8.7: every actually-exempt source file lies under the one declared path ----

test('B8.7 the only exempt source files are under the declared isolated-signer path', () => {
  // mirror the guard: compare on the repo-relative path (collectSourceFiles returns absolute paths)
  const toRel = (f) => { const n = f.replaceAll('\\', '/'); const i = n.indexOf('packages/'); return i >= 0 ? n.slice(i) : n; };
  const rels = collectSourceFiles().map(toRel);
  const exempt = rels.filter((rel) => isAllowlisted(rel, ALLOWLIST));
  assert.ok(exempt.length > 0, 'expected the activated isolated-signer files to be exempt');
  assert.ok(exempt.every((rel) => rel.startsWith('packages/isolated-signer-runtime/src/')));
  // and at least one non-isolated source file exists and is NOT exempt (fail-closed elsewhere)
  assert.ok(rels.some((rel) => !rel.startsWith('packages/isolated-signer-runtime/src/') && !isAllowlisted(rel, ALLOWLIST)));
});
