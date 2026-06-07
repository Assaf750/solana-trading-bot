import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { handleRequest, ROUTE_RESOURCE_TYPES, READ_ONLY_ROUTES } from '../src/router.mjs';
import { RESOURCE_TYPE, API_ERROR_CODE, COMMAND_TYPE } from '../../../packages/contracts/src/api-vocabulary.mjs';
import { FORBIDDEN_NAMES } from '../../../packages/ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');

test('GET /health is liveness only and does NOT mean trading readiness', () => {
  const r = handleRequest({ method: 'GET', path: '/health' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
  assert.match(r.body.note, /not mean trading readiness/i);
  assert.equal('trading_ready' in r.body, false);
});

test('GET /ready is a diagnostic — REAL-LIVE invalid, not trading readiness', () => {
  const r = handleRequest({ method: 'GET', path: '/ready' });
  assert.equal(r.status, 200);
  assert.equal(r.body.real_live_config_valid, false);
  assert.equal(r.body.operating_state, 'WARMING_UP');
  assert.equal(r.body.warning, 'WARNING_CRITICAL');
  assert.match(r.body.note, /NOT trading readiness/i);
});

test('resource routes are read-only and map to SSOT resource_type', () => {
  const RT = new Set(RESOURCE_TYPE);
  for (const [path, rt] of Object.entries(ROUTE_RESOURCE_TYPES)) {
    assert.ok(RT.has(rt), `${path} -> ${rt} not a resource_type`);
    const r = handleRequest({ method: 'GET', path });
    assert.equal(r.status, 200);
    assert.equal(r.body.resource_type, rt);
    assert.equal(r.body.read_only, true);
    assert.deepEqual(r.body.data, []);
  }
});

test('writes/commands are rejected (read-only) — no execution', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const r = handleRequest({ method, path: '/api/positions' });
    assert.equal(r.status, 405);
    assert.equal(r.body.api_error_code, undefined, 'must not invent an api_error_code for 405');
    assert.match(r.body.error_message, /read-only/i);
  }
});

test('unknown resource returns existing RESOURCE_NOT_FOUND (no new api_error_code)', () => {
  const r = handleRequest({ method: 'GET', path: '/api/does-not-exist' });
  assert.equal(r.status, 404);
  assert.equal(r.body.api_error_code, 'RESOURCE_NOT_FOUND');
  assert.ok(API_ERROR_CODE.includes(r.body.api_error_code));
});

test('no opportunity execution route and no command_type endpoint exists', () => {
  // No route path encodes a command or opportunity execution.
  for (const route of READ_ONLY_ROUTES) {
    assert.equal(/buy|sell|exit|execute|submit|swap|sign|send/i.test(route), false, `exec-like route: ${route}`);
  }
  // The router never returns a command_type value as a resource_type.
  const cmds = new Set(COMMAND_TYPE);
  for (const rt of Object.values(ROUTE_RESOURCE_TYPES)) assert.equal(cmds.has(rt), false);
});

test('source has no forbidden names and no OUTBOUND network usage', () => {
  // Outbound MECHANISMS / provider SDK imports — not brand words in labels.
  const OUTBOUND = /(\bfetch\b|\bundici\b|\baxios\b|http\.request|http\.get|https\.request|https\.get|new WebSocket|wss?:\/\/|https?:\/\/|@solana\/|@jup|helius-sdk|jito-)/i;
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC).filter((f) => f.endsWith('.mjs'))) {
    const code = readFileSync(join(SRC, fn), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false, `HUNTABLE in ${fn}`);
    assert.equal(OUTBOUND.test(code), false, `outbound network usage in ${fn}`);
  }
});
