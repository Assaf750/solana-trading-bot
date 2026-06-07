import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { renderShell } from '../src/main.mjs';
import { STRINGS, LOCALES, dirFor } from '../src/i18n.mjs';
import { FORBIDDEN_NAMES } from '../../../packages/ssot-types/src/forbidden.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');

test('AR/EN locales present with matching keys; direction RTL/LTR', () => {
  assert.deepEqual([...LOCALES].sort(), ['ar', 'en']);
  assert.equal(dirFor('ar'), 'rtl');
  assert.equal(dirFor('en'), 'ltr');
  assert.deepEqual(Object.keys(STRINGS.ar).sort(), Object.keys(STRINGS.en).sort(), 'ar/en keys must match');
});

test('shell renders status/health/constraints sections, in both locales', () => {
  for (const locale of LOCALES) {
    const html = renderShell({ operating_state: 'WARMING_UP', real_live_config_valid: false, validation_status: 'invalid', warning: 'WARNING_CRITICAL' }, locale);
    for (const id of ['status', 'health', 'constraints']) {
      assert.match(html, new RegExp(`data-testid="${id}"`), `${locale} missing section ${id}`);
    }
    assert.match(html, /data-testid="not-trading-ready"/, 'must show health!=trading-readiness note');
  }
  assert.match(renderShell({}, 'ar'), /dir="rtl"/);
  assert.match(renderShell({}, 'en'), /dir="ltr"/);
});

test('missing metrics render as unavailable (never fabricated)', () => {
  const htmlEn = renderShell({}, 'en');
  assert.match(htmlEn, /unavailable/);
  assert.equal(/\b0\b|\bnull\b|\bundefined\b/.test(htmlEn.replace(/initial-scale|charset/g, '')), false, 'no fabricated zero/null');
  const htmlAr = renderShell({}, 'ar');
  assert.match(htmlAr, /غير متوفّر/);
});

test('NO execution controls / no trading actions in shell output', () => {
  const html = renderShell({ operating_state: 'WARMING_UP' }, 'en') + renderShell({}, 'ar');
  const EXEC = /(buy|sell|exit|execute|submit|swap|sign|send|trade)\b/i;
  // The only button is language toggle.
  const buttons = html.match(/<button[^>]*>.*?<\/button>/gis) || [];
  assert.equal(buttons.length <= 2, true);
  for (const b of buttons) {
    assert.equal(/data-action="toggle-language"/.test(b), true, `unexpected button: ${b}`);
    assert.equal(EXEC.test(b.replace(/toggle-language/g, '')), false, `exec-like button: ${b}`);
  }
});

test('dashboard source has no forbidden names and no network usage', () => {
  // Outbound MECHANISMS / provider SDK imports — not brand words in UI labels.
  const OUTBOUND = /(\bfetch\b|\bundici\b|\baxios\b|http\.request|https\.request|http\.get|https\.get|new WebSocket|wss?:\/\/|https?:\/\/|@solana\/|@jup|helius-sdk|jito-)/i;
  const forbidden = FORBIDDEN_NAMES.filter((n) => n !== 'HUNTABLE');
  for (const fn of readdirSync(SRC)) {
    if (!/\.(mjs|html)$/.test(fn)) continue;
    const code = readFileSync(join(SRC, fn), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');
    for (const n of forbidden) assert.equal(new RegExp(`\\b${n}\\b`).test(code), false, `forbidden ${n} in ${fn}`);
    assert.equal(/\bHUNTABLE\b/.test(code), false, `HUNTABLE in ${fn}`);
    assert.equal(OUTBOUND.test(code), false, `network usage in ${fn}`);
  }
});
