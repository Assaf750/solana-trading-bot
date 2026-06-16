// no-legacy-flags-guard.test.mjs — Hard legacy purge (Phase 3B-X). Guards that the legacy rollback
// backend flags are GONE as LIVE flags. RISK_BACKEND / PROVIDER_BACKEND / POSITIONS_BACKEND /
// DECISION_LEDGER_BACKEND must never be read as `process.env.<flag>` in runtime code (apps/server/src,
// packages, services), must not be defined in .env.example, and must appear in the canonical flags doc
// ONLY under "Removed flags" (never as an active flag row). The current package paths — @soltrade/risk,
// @soltrade/provider-adapters, @soltrade/positions, @soltrade/decision-ledger — are the only path.
// (Removed flags may still be NAMED in explanatory comments / removal notes; this guard targets live use.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LEGACY_FLAGS = ['RISK_BACKEND', 'PROVIDER_BACKEND', 'POSITIONS_BACKEND', 'DECISION_LEDGER_BACKEND'];

// recursively collect *.mjs under a dir (skip node_modules / dotfiles)
function mjsFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...mjsFiles(p));
    else if (e.name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

test('no legacy backend flag is read as a live process.env flag in runtime code', () => {
  const files = ['apps/server/src', 'packages', 'services'].flatMap((r) => mjsFiles(join(ROOT, r)));
  assert.ok(files.length > 20, 'sanity: scanned a real set of runtime files');
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const flag of LEGACY_FLAGS) {
      assert.ok(!new RegExp(`process\\.env\\.${flag}`).test(src), `${f} still reads process.env.${flag}`);
    }
  }
});

test('no legacy backend flag is defined in .env.example', () => {
  const env = readFileSync(join(ROOT, 'infra/docker/.env.example'), 'utf8');
  for (const flag of LEGACY_FLAGS) {
    assert.ok(!new RegExp(`^\\s*${flag}=`, 'm').test(env), `.env.example must not define ${flag}`);
  }
});

test('the canonical flags doc lists every legacy flag ONLY under "Removed flags"', () => {
  const md = readFileSync(join(ROOT, 'docs/architecture/live-first-runtime-flags.md'), 'utf8');
  const removedIdx = md.indexOf('## Removed flags');
  assert.ok(removedIdx > 0, 'flags doc has a "Removed flags" section');
  const activeSurface = md.slice(0, removedIdx); // everything before "Removed flags"
  for (const flag of LEGACY_FLAGS) {
    assert.ok(!activeSurface.includes(flag), `${flag} must not appear as an active flag (only under Removed flags)`);
  }
});
