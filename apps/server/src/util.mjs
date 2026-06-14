// util.mjs — shared helpers: atomic JSON persistence, ids, deep freeze.
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
// repo root = apps/server/src/../../..
export const REPO_ROOT = join(HERE, '..', '..', '..');
export const DATA_DIR = process.env.SOLTRADE_DATA_DIR || join(REPO_ROOT, 'data');

export function ensureDataDir() {
  // 0700: state (incl. the encrypted vault) is owner-only on POSIX (best-effort on Windows).
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

export function newId(prefix) {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

export function nowIso() {
  return new Date().toISOString();
}

/** Read a JSON file from the data dir; returns fallback if absent/corrupt (fail-safe: corrupt state is reported, not silently used). */
export function readJson(name, fallback) {
  const p = join(DATA_DIR, name);
  if (!existsSync(p)) return { value: fallback, corrupt: false };
  try {
    return { value: JSON.parse(readFileSync(p, 'utf8')), corrupt: false };
  } catch {
    return { value: fallback, corrupt: true };
  }
}

/** Atomic write: write tmp then rename, so a crash never leaves a half-written state file. */
export function writeJson(name, value) {
  ensureDataDir();
  const p = join(DATA_DIR, name);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, p);
}

export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const k of Object.keys(obj)) deepFreeze(obj[k]);
  }
  return obj;
}

/** Mask a secret for display: first 3 + last 4 chars only, never more. */
export function maskSecret(s) {
  if (typeof s !== 'string' || s.length < 8) return '••••';
  return `${s.slice(0, 3)}…${s.slice(-4)}`;
}
