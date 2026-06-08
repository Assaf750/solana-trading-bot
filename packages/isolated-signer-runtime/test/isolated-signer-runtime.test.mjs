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

// ---- the path now EXISTS but is NOT activated: still scanned, still fail-closed ----

test('the existing package is scanned by the guard and NOT exempt; ALLOWLIST stays empty', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.equal(res.counts.allowlist, 0);
  assert.equal(ALLOWLIST.length, 0);
  // none of this package's files are exempt under the ACTIVE (empty) allowlist
  const here = 'packages/isolated-signer-runtime/src/index.mjs';
  assert.equal(isAllowlisted(here, ALLOWLIST), false);
});

test('a HYPOTHETICAL live mechanism at this path is still REJECTED under the active empty ALLOWLIST', () => {
  const label = 'packages/isolated-signer-runtime/src/index.mjs';
  // default ALLOWLIST (empty) -> live mechanism here is flagged
  assert.ok(scanText(label, "import x from '@solana/web3.js';").some((v) => v.rule === 'solana-sdk-import'));
  assert.ok(scanText(label, 'wallet.signTransaction(tx);').some((v) => v.rule === 'tx-sign'));
  // ONLY if the declared path were activated would it be exempt (proof of declaration-not-activation)
  assert.deepEqual(scanText(label, "import x from '@solana/web3.js';", { allowlist: DECLARED_ALLOWLIST_PATHS }), []);
});
