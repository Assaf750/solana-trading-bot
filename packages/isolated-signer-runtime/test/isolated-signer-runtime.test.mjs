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

test('package has no imports at all (dependency-free skeleton)', () => {
  for (const fn of readdirSync(SRC).filter((x) => x.endsWith('.mjs'))) {
    assert.equal(/^\s*import\s/m.test(readFileSync(join(SRC, fn), 'utf8')), false, `skeleton ${fn} must not import anything`);
  }
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
