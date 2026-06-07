import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createSignerBoundary } from '../src/signer-boundary.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const FIX = join(HERE, '..', 'fixtures');
const paperIntent = () => JSON.parse(readFileSync(join(FIX, 'paper-signing-intent.json'), 'utf8'));

const assertNonSignature = (r) => {
  assert.equal(r.signed, false, 'signed must always be false');
  assert.equal(r.signature, null, 'signature must always be null');
  assert.equal(r.is_valid_on_chain, false, 'must never be valid on-chain');
};

test('boundary cannot sign or send (capabilities + no methods)', () => {
  const b = createSignerBoundary();
  const caps = b.capabilities();
  assert.deepEqual(caps, { can_sign: false, can_send: false, mock: true });
  for (const m of ['sign', 'send', 'submit', 'serializeTransaction', 'buildTransaction', 'loadKey']) {
    assert.equal(b[m], undefined, `boundary must NOT expose ${m}`);
  }
});

test('accepted paper request still produces NO signature', () => {
  const r = createSignerBoundary().requestSignature(paperIntent());
  assert.equal(r.accepted, true);
  assertNonSignature(r);
  assert.match(r.note, /not a signature/i);
  assert.match(r.note, /not valid on-chain/i);
});

test('any non-paper / REAL / LIVE request is refused (and unsigned)', () => {
  const b = createSignerBoundary();
  for (const mode of ['real', 'live', 'real_live', 'REAL-LIVE', undefined, '']) {
    const r = b.requestSignature({ ...paperIntent(), mode });
    assert.equal(r.accepted, false, `mode=${mode} must be refused`);
    assert.equal(r.refusal_reason, 'live_or_nonpaper_signing_refused');
    assertNonSignature(r);
  }
});

test('key material offered in the request is refused and never returned', () => {
  const b = createSignerBoundary();
  for (const k of ['private_key', 'privateKey', 'seed', 'seed_phrase', 'mnemonic', 'keypair', 'secret', 'secret_key']) {
    const r = b.requestSignature({ ...paperIntent(), [k]: 'SHOULD_NEVER_BE_USED' });
    assert.equal(r.accepted, false, `${k} must be refused`);
    assert.equal(r.refusal_reason, 'key_material_not_accepted');
    assertNonSignature(r);
    assert.equal(JSON.stringify(r).includes('SHOULD_NEVER_BE_USED'), false, `${k} value must not leak into result`);
  }
});

test('refuses invalid/non-ACTIVE signer profile (SSOT G15) — still unsigned', () => {
  const b = createSignerBoundary();
  assert.equal(b.requestSignature({ mode: 'paper' }).refusal_reason, 'missing_signer_profile_id');
  assert.equal(b.requestSignature({ mode: 'paper', signer_profile_id: 's', signer_profile_status: 'BOGUS' }).refusal_reason, 'invalid_signer_profile_status');
  assert.equal(b.requestSignature({ mode: 'paper', signer_profile_id: 's', signer_profile_status: 'REVOKED' }).refusal_reason, 'signer_not_active');
  assert.equal(b.requestSignature({ mode: 'paper', signer_profile_id: 's', signer_profile_status: 'ACTIVE', key_custody_mode: 'bogus' }).refusal_reason, 'invalid_key_custody_mode');
  for (const inp of [{}, null, undefined, { mode: 'paper', signer_profile_id: 's', signer_profile_status: 'DEGRADED' }]) {
    assertNonSignature(b.requestSignature(inp));
  }
});

test('no key material anywhere in source or fixtures', () => {
  const KEY = /(private[_-]?key|seed[_-]?phrase|\bmnemonic\b|keypair|secret_key|BEGIN .*PRIVATE KEY|[1-9A-HJ-NP-Za-km-z]{43,44})/i;
  // Source: allow the refusal/guard list, but no actual key VALUES. Fixtures: must be totally clean.
  for (const fn of readdirSync(FIX)) {
    assert.equal(KEY.test(readFileSync(join(FIX, fn), 'utf8')), false, `key-like content in fixture ${fn}`);
  }
});

test('no signing libraries / network / transaction-build in source', () => {
  const BAD = /(@solana\/|@noble|tweetnacl|bs58|ed25519|web3\.js|\bfetch\b|\baxios\b|undici|http\.request|https?:\/\/|new WebSocket|node:fs|node:net|readFileSync|process\.env)/i;
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.equal(BAD.test(code), false, `forbidden lib/network/fs/env usage in ${fn}`);
  }
});

test('no forbidden trading names in source', () => {
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false);
  }
});
