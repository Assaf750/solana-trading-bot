import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scanText, runMechanismGuard, isAllowlisted, ALLOWLIST, DECLARED_ALLOWLIST_PATHS, collectSourceFiles,
} from './check-mechanism-guards.mjs';

const rules = (vs) => vs.map((v) => v.rule).sort();

const DECLARED = DECLARED_ALLOWLIST_PATHS[0];                 // 'packages/isolated-signer-runtime/src/'
const DECLARED_FILE = `${DECLARED}signer.mjs`;
const OTHER_FILE = 'packages/some-runtime/src/x.mjs';

// ---- declaration, not activation ----

test('DECLARED_ALLOWLIST_PATHS has exactly one explicit isolated-signer path', () => {
  assert.equal(Array.isArray(DECLARED_ALLOWLIST_PATHS), true);
  assert.equal(DECLARED_ALLOWLIST_PATHS.length, 1);
  assert.equal(DECLARED, 'packages/isolated-signer-runtime/src/');
});

test('B8 ACTIVATED: ALLOWLIST now equals the single declared path and guard runs at allowlist=1', () => {
  assert.equal(ALLOWLIST.length, 1);
  assert.deepEqual([...ALLOWLIST], [...DECLARED_ALLOWLIST_PATHS]); // ALLOWLIST === DECLARED (one path)
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
  // the declared path is now part of the ACTIVE allowlist
  assert.equal(isAllowlisted(DECLARED_FILE, ALLOWLIST), true);
});

test('the declared path is ACTIVATED: the active ALLOWLIST exempts ONLY files under that path', () => {
  // The isolated-signer-runtime skeleton package EXISTS (PR-E2-1); post-B8 the declared path is in the
  // ACTIVE ALLOWLIST -> only its files are exempt; every other source file is still fully scanned.
  // mirror the guard: compare on the repo-relative path (collectSourceFiles returns absolute paths).
  const toRel = (f) => { const n = f.replaceAll('\\', '/'); const i = n.indexOf('packages/'); return i >= 0 ? n.slice(i) : n; };
  for (const f of collectSourceFiles()) {
    const rel = toRel(f);
    const expected = rel.startsWith('packages/isolated-signer-runtime/src/');
    assert.equal(isAllowlisted(rel, ALLOWLIST), expected, `active allowlist exemption mismatch for ${rel}`);
  }
  // The guard runs over the now-activated skeleton and still passes at allowlist=1 (skeleton has no live mechanism).
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 1);
});

// ---- the declared path WOULD exempt live mechanisms (only when explicitly activated) ----

test('under the declared allowlist, live mechanisms at that path are exempt; elsewhere they still fail', () => {
  // file AT the declared path: live mechanisms would be permitted (future activation)
  assert.deepEqual(scanText(DECLARED_FILE, "import { Connection, Keypair } from '@solana/web3.js';\nconn.sendRawTransaction(tx);\nnew KeyManager();", { allowlist: DECLARED_ALLOWLIST_PATHS }), []);
  // same mechanism in ANY other path STILL fails, even with the declared allowlist active
  assert.ok(rules(scanText(OTHER_FILE, "import x from '@solana/web3.js';", { allowlist: DECLARED_ALLOWLIST_PATHS })).includes('solana-sdk-import'));
  assert.ok(rules(scanText('packages/signer-service-boundary/src/x.mjs', 'wallet.signTransaction(t);', { allowlist: DECLARED_ALLOWLIST_PATHS })).includes('tx-sign'));
});

test('sign/send/RPC/KeyManager/crypto OUTSIDE the declared path fail', () => {
  for (const [code, rule] of [
    ["import x from '@solana/web3.js';", 'solana-sdk-import'],
    ["import a from 'tweetnacl';", 'crypto-signing-lib-import'],
    ['c.sendRawTransaction(t);', 'tx-send'],
    ['const c = new Connection(u);', 'rpc-connection'],
    ['const k = new KeyManager();', 'key-manager'],
  ]) {
    assert.ok(rules(scanText(OTHER_FILE, code, { allowlist: DECLARED_ALLOWLIST_PATHS })).includes(rule), `${rule} must fail outside declared path`);
  }
});

// ---- key material stays HARD-forbidden even at the declared path ----

test('key material is forbidden even at the declared (allowlisted) path', () => {
  const pem = scanText(DECLARED_FILE, "const k = '-----BEGIN PRIVATE KEY-----';", { allowlist: DECLARED_ALLOWLIST_PATHS });
  assert.ok(rules(pem).some((r) => r.startsWith('allowlisted_but_key_material:')));
  const blob = `const k = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';`;
  assert.ok(rules(scanText(DECLARED_FILE, blob, { allowlist: DECLARED_ALLOWLIST_PATHS })).some((r) => r.startsWith('allowlisted_but_key_material:')));
});

// ---- prefix / sibling safety ----

test('declared path matches by path-segment prefix only (no sibling over-match)', () => {
  assert.equal(isAllowlisted(DECLARED_FILE, DECLARED_ALLOWLIST_PATHS), true);
  assert.equal(isAllowlisted('packages/isolated-signer-runtime-evil/src/x.mjs', DECLARED_ALLOWLIST_PATHS), false);
  assert.equal(isAllowlisted('packages/isolated-signer/src/x.mjs', DECLARED_ALLOWLIST_PATHS), false);
  // backslash paths normalize
  assert.equal(isAllowlisted('packages\\isolated-signer-runtime\\src\\signer.mjs', DECLARED_ALLOWLIST_PATHS), true);
});

// ---- the active guard still fails closed everywhere EXCEPT the one activated path ----

test('forbidden mechanisms still fail in every path EXCEPT the activated declared path', () => {
  // declared path is now exempt from live-mechanism checks (B8 activated)
  assert.deepEqual(scanText(DECLARED_FILE, "import x from '@solana/web3.js';"), []);
  // every OTHER path still fails closed under the active allowlist
  assert.ok(rules(scanText(OTHER_FILE, "import x from '@solana/web3.js';")).includes('solana-sdk-import'));
  assert.ok(rules(scanText(OTHER_FILE, 'new KeyManager();')).includes('key-manager'));
  // current repo is clean and passes at allowlist=1
  const res = runMechanismGuard();
  assert.equal(res.ok, true);
  assert.equal(res.counts.allowlist, 1);
});
