import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  scanText, runMechanismGuard, isAllowlisted, ALLOWLIST, collectSourceFiles,
} from './check-mechanism-guards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = (vs) => vs.map((v) => v.rule).sort();

// A non-existent, explicit future path used to exercise the carve-out WITHOUT opening any real package.
const FUTURE = 'packages/__future_isolated_signer__/src/';
const FUTURE_FILE = `${FUTURE}signer.mjs`;
const OTHER_FILE = 'packages/some-runtime/src/x.mjs';

// ---- default is closed (empty allowlist; current behavior preserved) ----

test('ALLOWLIST is empty by default (fail-closed; no path exempt)', () => {
  assert.equal(Array.isArray(ALLOWLIST), true);
  assert.equal(ALLOWLIST.length, 0);
});

test('runMechanismGuard() still PASSES on the real repo with the default empty allowlist', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 0);
  assert.ok(res.counts.sources > 0);
});

test('default allowlist matches NO existing source file (opens no package)', () => {
  for (const f of collectSourceFiles()) assert.equal(isAllowlisted(f, ALLOWLIST), false);
  // and the example future carve-out path does not correspond to an existing directory
  assert.equal(existsSync(join(ROOT, 'packages', '__future_isolated_signer__')), false);
});

// ---- forbidden mechanisms stay forbidden everywhere under the default ----

test('forbidden mechanisms are still flagged in any path with the default (empty) allowlist', () => {
  assert.ok(rules(scanText(OTHER_FILE, "import { Connection } from '@solana/web3.js';")).includes('solana-sdk-import'));
  assert.ok(rules(scanText(OTHER_FILE, 'conn.sendRawTransaction(tx);')).includes('tx-send'));
  assert.ok(rules(scanText(OTHER_FILE, 'wallet.signTransaction(tx);')).includes('tx-sign'));
  assert.ok(rules(scanText(OTHER_FILE, 'const k = new KeyManager();')).includes('key-manager'));
  assert.ok(rules(scanText(OTHER_FILE, 'await fetch(u);')).includes('http-fetch'));
  // even the FUTURE path is NOT exempt unless an allowlist is actually supplied
  assert.ok(rules(scanText(FUTURE_FILE, "import x from '@solana/web3.js';")).includes('solana-sdk-import'));
});

// ---- carve-out works ONLY for an explicitly allowlisted path ----

test('an explicit allowlist exempts live mechanisms ONLY in the allowlisted path', () => {
  const allow = [FUTURE];
  // allowlisted path: live mechanisms permitted (no violation)
  assert.deepEqual(scanText(FUTURE_FILE, "import { Connection } from '@solana/web3.js';\nconn.sendRawTransaction(tx);\nnew KeyManager();", { allowlist: allow }), []);
  // any OTHER path with the SAME mechanism still fails
  assert.ok(rules(scanText(OTHER_FILE, "import { Connection } from '@solana/web3.js';", { allowlist: allow })).includes('solana-sdk-import'));
  assert.ok(rules(scanText('packages/signer-boundary/src/x.mjs', 'sendTransaction(tx);', { allowlist: allow })).includes('tx-send'));
});

test('import / sign / send / RPC / KeyManager OUTSIDE allowlist all fail', () => {
  const allow = [FUTURE];
  const cases = [
    ["import a from 'axios';", 'http-client-import'],
    ["import x from '@solana/web3.js';", 'solana-sdk-import'],
    ['wallet.signTransaction(t);', 'tx-sign'],
    ['c.sendRawTransaction(t);', 'tx-send'],
    ['const c = new Connection(u);', 'rpc-connection'],
    ['const k = new KeyManager();', 'key-manager'],
    ['pool.query(sql);', 'db-write'],
  ];
  for (const [code, rule] of cases) {
    assert.ok(rules(scanText(OTHER_FILE, code, { allowlist: allow })).includes(rule), `${rule} must fail outside allowlist`);
  }
});

// ---- key material is HARD-forbidden even inside an allowlisted path ----

test('key material is forbidden even inside an allowlisted path', () => {
  const allow = [FUTURE];
  const pem = scanText(FUTURE_FILE, "const k = '-----BEGIN PRIVATE KEY-----';", { allowlist: allow });
  assert.ok(rules(pem).some((r) => r.startsWith('allowlisted_but_key_material:')), 'PEM key must be flagged even when allowlisted');
  const blob = `const k = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';`;
  assert.ok(rules(scanText(FUTURE_FILE, blob, { allowlist: allow })).some((r) => r.startsWith('allowlisted_but_key_material:')));
  // mnemonic too
  assert.ok(rules(scanText(FUTURE_FILE, 'const m = "seed phrase here";', { allowlist: allow })).some((r) => r.startsWith('allowlisted_but_key_material:')));
});

// ---- prefix safety (no sibling over-match) ----

test('allowlist matches by path-segment prefix only (no sibling over-match)', () => {
  assert.equal(isAllowlisted('packages/signer/src/x.mjs', ['packages/sign']), false); // 'sign' must not match 'signer'
  assert.equal(isAllowlisted('packages/sign/src/x.mjs', ['packages/sign/src/']), true);
  assert.equal(isAllowlisted('packages/sign-evil/src/x.mjs', ['packages/sign/src/']), false);
  // backslash paths normalize
  assert.equal(isAllowlisted('packages\\sign\\src\\x.mjs', ['packages/sign/src/']), true);
});

// ---- false positives and activate_real_live string-vs-call (unchanged guarantees) ----

test('comments and strings do not cause false positives (under default and allowlist)', () => {
  assert.deepEqual(scanText(OTHER_FILE, '// no sendTransaction, no KeyManager, no @solana/web3.js'), []);
  assert.deepEqual(scanText(OTHER_FILE, "const note = '@solana/web3.js is forbidden';"), []);
  assert.deepEqual(scanText(OTHER_FILE, "const s = 'this mentions sendTransaction and KeyManager';"), []);
});

test('activate_real_live as a STRING is fine; as a CALL it fails', () => {
  assert.deepEqual(scanText(OTHER_FILE, "const c = ['activate_real_live'];"), []);
  assert.ok(rules(scanText(OTHER_FILE, 'activate_real_live(cfg);')).includes('real-live-activation-call'));
  // and even string is fine inside an allowlisted path
  assert.deepEqual(scanText(FUTURE_FILE, "const c = 'activate_real_live';", { allowlist: [FUTURE] }), []);
});
