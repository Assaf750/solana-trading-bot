import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  scanText, scanFixtureSecrets, runMechanismGuard,
  collectSourceFiles, FORBIDDEN_CODE, FORBIDDEN_IMPORTS,
} from './check-mechanism-guards.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fx = (n) => readFileSync(join(HERE, 'mechanism-guard-fixtures', n), 'utf8');
const rules = (vs) => vs.map((v) => v.rule).sort();

// ---- the guard PASSES on the real repo (current main is clean) ----
test('runMechanismGuard PASSES on packages/*/src (current main is clean)', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
  assert.ok(res.counts.sources > 0);
});

// ---- forbidden mechanisms ARE detected ----
test('detects forbidden imports (solana / http-client)', () => {
  assert.deepEqual(rules(scanText('t', "import { Connection } from '@solana/web3.js';")), ['crypto-signing-lib-import', 'solana-sdk-import']);
  assert.deepEqual(rules(scanText('t', "import axios from 'axios';")), ['http-client-import']);
  assert.deepEqual(rules(scanText('t', "const x = await import('node:http');")), ['node-network-import']);
  assert.deepEqual(rules(scanText('t', "const pg = require('pg');")), ['db-driver-import']);
});

test('detects forbidden code mechanisms (sign/send/connection/serialize/keypair/keymanager/fetch/ws/db)', () => {
  assert.ok(rules(scanText('t', 'wallet.signTransaction(tx);')).includes('tx-sign'));
  assert.ok(rules(scanText('t', 'conn.sendRawTransaction(tx);')).includes('tx-send'));
  assert.ok(rules(scanText('t', 'const c = new Connection(url);')).includes('rpc-connection'));
  assert.ok(rules(scanText('t', 'tx.serialize();')).includes('tx-serialize'));
  assert.ok(rules(scanText('t', 'Keypair.fromSecretKey(b);')).some((r) => r === 'keypair-material'));
  assert.ok(rules(scanText('t', 'const k = new KeyManager();')).includes('key-manager'));
  assert.ok(rules(scanText('t', 'await fetch(u);')).includes('http-fetch'));
  assert.ok(rules(scanText('t', 'const w = new WebSocket(u);')).includes('websocket'));
  assert.ok(rules(scanText('t', 'pool.query(sql);')).includes('db-write'));
  assert.ok(rules(scanText('t', 'activate_real_live(cfg);')).includes('real-live-activation-call'));
});

// ---- false-positive avoidance (the whole point of code-only scanning) ----
test('comments are ignored (prohibition text does not trip the guard)', () => {
  assert.deepEqual(scanText('t', '// no sendTransaction, no KeyManager, no @solana/web3.js here'), []);
  assert.deepEqual(scanText('t', '/* forbidden: signTransaction sendRawTransaction Keypair */'), []);
});

test('string literals are ignored for code mechanisms (governed names / refusal lists pass)', () => {
  assert.deepEqual(scanText('t', "const c = ['activate_real_live', 'drain_execution_wallet'];"), []);
  assert.deepEqual(scanText('t', "const FORBIDDEN = ['private_key','secretKey','mnemonic','keypair'];"), []);
  assert.deepEqual(scanText('t', "const s = 'this mentions sendTransaction and KeyManager';"), []);
});

test('a non-import string mentioning a module is NOT flagged; a real import IS', () => {
  assert.deepEqual(scanText('t', "const note = '@solana/web3.js is forbidden';"), []);
  assert.ok(rules(scanText('t', "import x from '@solana/web3.js';")).includes('solana-sdk-import'));
});

test('local relative imports are allowed', () => {
  assert.deepEqual(scanText('t', "import { x } from '../../config/src/validate.mjs';"), []);
  assert.deepEqual(scanText('t', "import { y } from './schema.mjs';"), []);
});

// ---- fixture secret scanning ----
test('fixture secret scan flags PEM / mnemonic / base58 key blobs', () => {
  assert.ok(rules(scanFixtureSecrets('t', '-----BEGIN PRIVATE KEY-----')).includes('pem-private-key'));
  assert.ok(rules(scanFixtureSecrets('t', '{"note":"seed phrase here"}')).includes('seed-phrase'));
  const keyBlob = '4xQy7KQ2t1FZ9bM3nP8sVwLrCeDhGjKuYtZaBcDfHkLmNpQrStUvWxYz12345678ABCDEFGHJKLMNPQRSTUVWXY';
  assert.ok(keyBlob.length >= 64);
  assert.ok(rules(scanFixtureSecrets('t', `"${keyBlob}"`)).includes('base58-key-blob'));
  // A public mint-length address (~44 base58 chars) is NOT a secret -> no violation.
  assert.deepEqual(scanFixtureSecrets('t', '"So11111111111111111111111111111111111111112"'), []);
  assert.deepEqual(scanFixtureSecrets('t', '{"execution_wallet_id":"exec-wallet-dev-1","max_open_positions":3}'), []);
});

// ---- end-to-end via the inert fixture files ----
test('safe-sample.mjs has zero violations; forbidden-sample.mjs is caught', () => {
  assert.deepEqual(scanText('safe', fx('safe-sample.mjs')), []);
  const bad = rules(scanText('bad', fx('forbidden-sample.mjs')));
  for (const expected of ['solana-sdk-import', 'http-client-import', 'rpc-connection', 'tx-send', 'tx-serialize', 'keypair-material', 'http-fetch']) {
    assert.ok(bad.includes(expected), `expected ${expected} in ${bad.join(',')}`);
  }
});

// ---- rule-set sanity ----
test('rule sets are non-empty and well-formed', () => {
  assert.ok(FORBIDDEN_CODE.length >= 8 && FORBIDDEN_IMPORTS.length >= 5);
  for (const r of [...FORBIDDEN_CODE, ...FORBIDDEN_IMPORTS]) {
    assert.equal(typeof r.label, 'string');
    assert.ok(r.re instanceof RegExp);
  }
  assert.ok(collectSourceFiles().every((p) => /\.mjs$/.test(p) && !/[\\/]test[\\/]/.test(p)));
});
