// Package boundary guard (ADR-0001 Phase 3A) — enforces the mechanism-injection rule:
// packages/* are the pure domain kernel; mechanisms are injected by apps/server or services.
// See docs/architecture/package-boundaries.md. Reuses tools/check-mechanism-guards.mjs and adds
// the layering + confinement assertions the mechanism guard does not itself cover.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import {
  runMechanismGuard, collectSourceFiles, isAllowlisted, ALLOWLIST,
  stripComments, stripCommentsAndStrings,
} from '../../tools/check-mechanism-guards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');
const FILES = collectSourceFiles(); // packages/*/src/**/*.mjs (no test/, no .d.ts)

// node:crypto carve-out = the single allowlisted isolated-signer path. node:fs carve-out = none today
// (packages inject readJson/writeJson). Extend FS_ALLOWLIST only with a documented JSON-adapter need.
const CRYPTO_ALLOWLIST = ALLOWLIST;
const FS_ALLOWLIST = [];

function importSpecifiers(code) {
  const noComments = stripComments(code);
  const specs = [];
  const res = [
    /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of res) for (const m of noComments.matchAll(re)) specs.push(m[1]);
  return specs;
}

function scanImports(predicate) {
  const hits = [];
  for (const f of FILES) {
    const r = rel(f);
    for (const spec of importSpecifiers(readFileSync(f, 'utf8'))) {
      if (predicate(spec, r)) hits.push(`${r} -> ${spec}`);
    }
  }
  return hits;
}

test('boundary: there ARE package sources to guard (the guard is wired)', () => {
  assert.ok(FILES.length > 100, `expected many package sources, got ${FILES.length}`);
});

test('boundary: ALLOWLIST is exactly the single isolated-signer path', () => {
  assert.equal(ALLOWLIST.length, 1);
  assert.equal(ALLOWLIST[0], 'packages/isolated-signer-runtime/src/');
});

test('boundary: mechanism guard passes (no live fetch/WebSocket/tx/db/provider mechanisms)', () => {
  const res = runMechanismGuard();
  assert.equal(res.ok, true, JSON.stringify(res.violations, null, 2));
});

test('boundary: no package imports apps/* or services/*', () => {
  const hits = scanImports((spec) => /(^|\/)(apps|services)\//.test(spec));
  assert.deepEqual(hits, [], `packages must not import apps/services:\n${hits.join('\n')}`);
});

test('boundary: node:crypto is confined to the allowlisted isolated-signer path', () => {
  const hits = scanImports((spec, r) => /^node:crypto(\/|$)/.test(spec) && !isAllowlisted(r, CRYPTO_ALLOWLIST));
  assert.deepEqual(hits, [], `node:crypto outside the allowlist:\n${hits.join('\n')}`);
});

test('boundary: no package imports node:fs (mechanisms injected, e.g. readJson/writeJson)', () => {
  const hits = scanImports((spec, r) => /^node:fs(\/|$)/.test(spec) && !isAllowlisted(r, FS_ALLOWLIST));
  assert.deepEqual(hits, [], `node:fs in packages (inject fs instead):\n${hits.join('\n')}`);
});

test('boundary: no package imports provider SDKs (jupiter/helius/jito/@jup-ag/@solana)', () => {
  const hits = scanImports((spec) => /(^@jup-ag\/|jupiter|helius|jito|^@solana\/)/i.test(spec));
  assert.deepEqual(hits, [], `provider/solana SDK import in packages:\n${hits.join('\n')}`);
});

test('boundary: no package imports db drivers (pg/postgres/clickhouse/redis)', () => {
  const hits = scanImports((spec) => /^(pg|postgres|@clickhouse\/.*|clickhouse|ioredis|redis)$/.test(spec));
  assert.deepEqual(hits, [], `db-driver import in packages (inject the client):\n${hits.join('\n')}`);
});

test('boundary: no package imports crypto-signing or http-client libs', () => {
  const hits = scanImports((spec) => /^(@noble\/|tweetnacl$|bs58$|ed25519|axios$|node-fetch$|undici$|got$|superagent$)/.test(spec));
  assert.deepEqual(hits, [], `signing/http-client import in packages:\n${hits.join('\n')}`);
});

test('boundary: no direct fetch()/new WebSocket() in non-allowlisted package src', () => {
  const hits = [];
  for (const f of FILES) {
    const r = rel(f);
    if (isAllowlisted(r, ALLOWLIST)) continue;
    const code = stripCommentsAndStrings(readFileSync(f, 'utf8'));
    if (/\bfetch\s*\(/.test(code)) hits.push(`${r}: fetch(`);
    if (/\b(new\s+WebSocket|WebSocket)\s*\(/.test(code)) hits.push(`${r}: WebSocket(`);
  }
  assert.deepEqual(hits, [], `direct network primitive in packages (inject request/wsFactory):\n${hits.join('\n')}`);
});
