// Mechanism guard (PR-H2) — central, code-only guard that forbids LIVE Gate-D/Gate-E
// mechanisms in shipped runtime sources BEFORE their time. It does NOT add product logic;
// it only inspects packages/*/src/*.mjs and fixtures for forbidden mechanisms.
//
// Forbidden = live asset/token transfer · transaction build/serialize/sign/send · RPC/provider
// live calls · Solana/Jupiter/Helius/Jito imports or endpoints · KeyManager · key material
// (private key/seed/keypair/mnemonic) · REAL-LIVE activation calls.
//
// CODE-ONLY by design (avoids false positives in prohibition text):
//   - Layer A (imports): strip comments, KEEP strings, match only import/require/from specifiers.
//   - Layer B (mechanisms): strip comments AND strings, match real call/identifier mechanisms.
//   - Layer C (fixtures): scan raw JSON fixtures for secret/key-material literals only.
// Comments like "// no KeyManager" and governed SSOT string values like 'activate_real_live'
// or registries' FORBIDDEN_FIELDS=['private_key',...] are intentionally NOT flagged.
//
// Pure Node (no deps). Run: `node tools/check-mechanism-guards.mjs`.
// Exit 0 = PASS, exit 1 = FAIL. Importable: `import { runMechanismGuard, scanText } from ...`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- lexer (single pass) -----------------------------------------------------
// Correctly distinguishes comments from strings: `//` inside a string is NOT a comment,
// and a quote inside a comment is NOT a string. Returns two views:
//   noComments  — comments removed, string literals kept verbatim (for import specifiers)
//   noStrings   — comments removed AND string contents blanked (for code mechanisms)
export function lex(src) {
  let noComments = '';
  let noStrings = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : '';
    if (c === '/' && d === '/') {            // line comment
      while (i < n && src[i] !== '\n') i++;
      noComments += ' '; noStrings += ' ';
      continue;
    }
    if (c === '/' && d === '*') {            // block comment (preserve newlines)
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') { noComments += '\n'; noStrings += '\n'; }
        i++;
      }
      i += 2;
      noComments += ' '; noStrings += ' ';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { // string / template literal
      const quote = c;
      let str = c;
      i++;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') { str += ch + (i + 1 < n ? src[i + 1] : ''); i += 2; continue; }
        str += ch; i++;
        if (ch === quote) break;
      }
      noComments += str;              // keep specifier text
      noStrings += quote + quote;     // blank the content
      continue;
    }
    noComments += c; noStrings += c; i++;
  }
  return { noComments, noStrings };
}

export function stripComments(src) { return lex(src).noComments; }
export function stripCommentsAndStrings(src) { return lex(src).noStrings; }

// ---- rule sets ---------------------------------------------------------------
// Layer A: forbidden module families (checked against import/require specifiers only).
export const FORBIDDEN_IMPORTS = [
  { label: 'solana-sdk-import', re: /^@solana\// },
  { label: 'crypto-signing-lib-import', re: /^(@noble\/|tweetnacl$|bs58$|ed25519|@solana\/web3\.js)/ },
  { label: 'provider-sdk-import', re: /(^@jup-ag\/|jupiter|helius|jito)/i },
  { label: 'http-client-import', re: /^(axios|node-fetch|undici|got|superagent)$/ },
  { label: 'node-network-import', re: /^node:(net|http|https|dgram|tls)$/ },
  { label: 'db-driver-import', re: /^(pg|postgres|@clickhouse\/|clickhouse|ioredis|redis)$/ },
];

// Layer B: forbidden live mechanisms in code (comments + strings already stripped).
export const FORBIDDEN_CODE = [
  { label: 'tx-sign', re: /\b(signTransaction|signAllTransactions|partialSign)\b/ },
  { label: 'tx-send', re: /\b(sendTransaction|sendRawTransaction|sendAndConfirmTransaction)\b/ },
  { label: 'rpc-connection', re: /\bnew\s+Connection\s*\(/ },
  { label: 'tx-serialize', re: /\.serialize\s*\(/ },
  { label: 'keypair-material', re: /\b(Keypair|fromSecretKey|fromSeed|generateKeyPair)\b/ },
  { label: 'key-manager', re: /\bKeyManager\b/ },
  { label: 'http-fetch', re: /\b(fetch|XMLHttpRequest)\s*\(/ },
  { label: 'websocket', re: /\b(new\s+WebSocket|WebSocket)\s*\(/ },
  { label: 'db-write', re: /\b(createPool|new\s+Pool|\.query)\s*\(/ },
  { label: 'real-live-activation-call', re: /\bactivate_real_live\s*\(/ },
];

// Layer C: secret / key-material literals in fixtures (raw scan).
export const FORBIDDEN_SECRETS = [
  { label: 'pem-private-key', re: /BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY/ },
  { label: 'seed-phrase', re: /seed phrase|\bmnemonic\b/i },
  // Private-key length only (>=64 base58 chars). Public mint addresses (~32-44) are NOT secrets.
  { label: 'base58-key-blob', re: /\b[1-9A-HJ-NP-Za-km-z]{64,}\b/ },
];

// ---- carve-out allowlist (PR-H3, ACTIVATED PR-E2-R5/B8) ----------------------
// ACTIVATED — governance decision B8 (`DR-E2-B8-001`) moved the single DECLARED isolated-signer path into
// ALLOWLIST. ALLOWLIST now contains EXACTLY ONE explicit path prefix and nothing else. There is NO
// wildcard, NO regex, and NO general bypass: every path NOT under this exact prefix stays fail-closed.
//
// An allowlisted path is exempt from the LIVE-MECHANISM checks (FORBIDDEN_IMPORTS + FORBIDDEN_CODE) ONLY.
// Hardcoded KEY MATERIAL stays HARD-FORBIDDEN even inside an allowlisted path (keys come from KMS/secret
// vault at runtime, never from source) — see scanText `allowlisted_but_key_material:*`.
//
// Activation opens the path for a FUTURE, separately-approved isolated-signer/execution package; it adds NO
// KMS/Vault, NO KeyManager, NO crypto/signing library, NO keys, NO signing/sending, NO tx build, NO RPC by
// itself. The package at this path is currently a capabilities-all-false SKELETON (PR-E2-1). E2
// implementation does NOT start here and requires its own separate approval.
export const ALLOWLIST = Object.freeze(['packages/isolated-signer-runtime/src/']);

// ---- DECLARED allowlist path (PR-H4) — now ACTIVE (PR-E2-R5/B8) --------------
// This names the single isolated-signer/execution path. As of B8 (`DR-E2-B8-001`) it has been moved into
// ALLOWLIST above; ALLOWLIST === DECLARED_ALLOWLIST_PATHS (one path). Even when active, KEY MATERIAL in
// source stays HARD-FORBIDDEN here. No other path may be added without a separate governance decision.
export const DECLARED_ALLOWLIST_PATHS = Object.freeze(['packages/isolated-signer-runtime/src/']);

/** True iff `relPath` is under an explicit allowlist directory prefix (path-segment match, no wildcards). */
export function isAllowlisted(relPath, allowlist = ALLOWLIST) {
  const p = String(relPath).replace(/\\/g, '/');
  return allowlist.some((entry) => {
    if (typeof entry !== 'string' || entry.length === 0) return false;
    const e = entry.replace(/\\/g, '/');
    const pref = e.endsWith('/') ? e : e + '/';
    return p === e || p.startsWith(pref);
  });
}

// ---- core scanners -----------------------------------------------------------
function importSpecifiers(noComments) {
  const specs = [];
  const reFrom = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const reBare = /\bimport\s*['"]([^'"]+)['"]/g;
  const reCall = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [reFrom, reBare, reCall]) {
    for (const m of noComments.matchAll(re)) specs.push(m[1]);
  }
  return specs;
}

/**
 * Scan one source text for violations. Returns an array of {label, rule, match}.
 * If the path is allowlisted (PR-H3), the live-mechanism checks are skipped, but hardcoded KEY MATERIAL
 * is STILL forbidden (allowlisted_but_key_material:*). With the default empty ALLOWLIST nothing is exempt.
 */
export function scanText(label, text, { allowlist = ALLOWLIST } = {}) {
  const violations = [];
  const { noComments, noStrings } = lex(text);

  if (isAllowlisted(label, allowlist)) {
    // Carve-out: live mechanisms permitted here, but key material in source is never allowed.
    for (const rule of FORBIDDEN_SECRETS) {
      const m = noComments.match(rule.re); // comments removed, strings kept (catch hardcoded key literals)
      if (m) violations.push({ label, rule: `allowlisted_but_key_material:${rule.label}`, match: m[0].slice(0, 24) });
    }
    return violations;
  }

  for (const spec of importSpecifiers(noComments)) {
    for (const rule of FORBIDDEN_IMPORTS) {
      if (rule.re.test(spec)) violations.push({ label, rule: rule.label, match: spec });
    }
  }
  for (const rule of FORBIDDEN_CODE) {
    const m = noStrings.match(rule.re);
    if (m) violations.push({ label, rule: rule.label, match: m[0].trim() });
  }
  return violations;
}

/** Scan raw fixture text (JSON) for secret/key-material literals. */
export function scanFixtureSecrets(label, text) {
  const violations = [];
  for (const rule of FORBIDDEN_SECRETS) {
    const m = text.match(rule.re);
    if (m) violations.push({ label, rule: rule.label, match: m[0].slice(0, 24) });
  }
  return violations;
}

function walk(dir, test, out) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, test, out);
    else if (test(p)) out.push(p);
  }
  return out;
}

/** Discover the runtime source files to guard: packages/<pkg>/src/**\/*.mjs (no test/, no .d.ts). */
export function collectSourceFiles(packagesDir) {
  const base = packagesDir || join(ROOT, 'packages');
  const pkgs = walk(base, (p) => /[\\/]src[\\/].*\.mjs$/.test(p) && !/[\\/]test[\\/]/.test(p), []);
  return pkgs;
}

/** Discover fixtures: packages/<pkg>/fixtures/**\/*.json */
export function collectFixtureFiles(packagesDir) {
  const base = packagesDir || join(ROOT, 'packages');
  return walk(base, (p) => /[\\/]fixtures[\\/].*\.json$/.test(p), []);
}

export function runMechanismGuard({ packagesDir, allowlist = ALLOWLIST } = {}) {
  const violations = [];
  const srcFiles = collectSourceFiles(packagesDir);
  for (const f of srcFiles) {
    violations.push(...scanText(relative(ROOT, f), readFileSync(f, 'utf8'), { allowlist }));
  }
  const fixtureFiles = collectFixtureFiles(packagesDir);
  for (const f of fixtureFiles) {
    violations.push(...scanFixtureSecrets(relative(ROOT, f), readFileSync(f, 'utf8')));
  }
  return {
    ok: violations.length === 0,
    violations,
    counts: { sources: srcFiles.length, fixtures: fixtureFiles.length, allowlist: allowlist.length, violations: violations.length },
  };
}

// CLI mode.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok, violations, counts } = runMechanismGuard();
  if (ok) {
    console.log(`mechanism guard: PASS — sources=${counts.sources} fixtures=${counts.fixtures} allowlist=${counts.allowlist} violations=0`);
    process.exit(0);
  } else {
    console.error(`mechanism guard: FAIL (${violations.length})`);
    for (const v of violations) console.error(`  - [${v.rule}] ${v.label}: ${v.match}`);
    process.exit(1);
  }
}
