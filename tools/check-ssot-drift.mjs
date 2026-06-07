// SSOT vocabulary-drift + candidate guard (PR-A2).
// Validates that the names declared in @soltrade/ssot-types and @soltrade/contracts:
//   1) all appear in docs/01-SSOT.md / docs/03-API-CONTRACT.md  (No name before SSOT)
//   2) include none of the forbidden/rejected names                (Rejected/Forbidden)
//   3) keep every candidate_ prefix intact                         (candidate stays candidate)
//   4) define none of the forbidden execution commands             (no trading authority)
//   5) account for EVERY candidate enum in SSOT as either INCLUDED or explicitly
//      DEFERRED (coverage.mjs) — never a silent omission.
//
// Pure Node (no deps). Run: `node tools/check-ssot-drift.mjs`.
// Exit 0 = PASS, exit 1 = FAIL. Importable: `import { runDriftCheck } from ...`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as core from '../packages/ssot-types/src/core-enums.mjs';
import { CANDIDATE_ENUMS, CANDIDATE_FIELDS } from '../packages/ssot-types/src/candidate-enums.mjs';
import { FORBIDDEN_NAMES } from '../packages/ssot-types/src/forbidden.mjs';
import { DEFERRED_CANDIDATES, CLAIMS_FULL_SSOT_COVERAGE } from '../packages/ssot-types/src/coverage.mjs';
import * as api from '../packages/contracts/src/api-vocabulary.mjs';
import { CANDIDATE_COMMANDS, CANDIDATE_ERRORS } from '../packages/contracts/src/candidate-commands.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Execution commands that must never be defined as real names anywhere.
const FORBIDDEN_EXEC_COMMANDS = [
  'buy_opportunity', 'execute_opportunity', 'submit_opportunity',
  'exit_all_positions', 'batch_exit_all_positions',
];

function loadDocs() {
  const ssot = readFileSync(join(ROOT, 'docs/01-SSOT.md'), 'utf8');
  const apiDoc = readFileSync(join(ROOT, 'docs/03-API-CONTRACT.md'), 'utf8');
  const docs = ssot + '\n' + apiDoc;
  // Tokens inside backticks (official field/value names are backticked in SSOT).
  const backtick = new Set();
  for (const m of docs.matchAll(/`([^`]+)`/g)) {
    for (const tok of m[1].split(/[^A-Za-z0-9_]+/)) if (tok) backtick.add(tok);
  }
  // All identifier-like tokens (covers plain `·`-separated allowed_values, e.g. 30d).
  const words = new Set(docs.match(/[A-Za-z0-9_]+/g) || []);
  return { ssot, backtick, words };
}

// Every candidate enum DEFINED in SSOT (table row whose source_of_truth_field is
// candidate_* and whose type cell contains "enum").
function discoverCandidateEnums(ssotText) {
  // SSOT rows are: | <arabic term> | `source_of_truth_field` | <type> | ... |
  // A candidate enum = a cell `candidate_*` whose following (type) cell contains "enum".
  const found = new Set();
  for (const line of ssotText.split('\n')) {
    if (!line.includes('candidate_')) continue;
    const cells = line.split('|').map((c) => c.trim());
    for (let i = 0; i < cells.length - 1; i++) {
      const m = cells[i].match(/^`(candidate_[a-z0-9_]+)`$/);
      if (m && /enum/.test(cells[i + 1])) found.add(m[1]);
    }
  }
  return found;
}

export function runDriftCheck() {
  const errors = [];
  const { ssot, backtick, words } = loadDocs();
  const forbidden = new Set(FORBIDDEN_NAMES);
  const includedCandidates = new Set(Object.keys(CANDIDATE_ENUMS));
  const deferredCandidates = new Set(DEFERRED_CANDIDATES);

  // Collect declared NAMES (the source_of_truth_field keys) and VALUES.
  const enumNames = [...Object.keys(core.CORE_ENUMS), ...Object.keys(api.API_VOCAB)];
  const candidateNames = [
    ...Object.keys(CANDIDATE_ENUMS),
    ...CANDIDATE_FIELDS,
    ...CANDIDATE_COMMANDS,
    ...CANDIDATE_ERRORS,
  ];
  const fieldNames = [...api.ENVELOPE_FIELDS, ...api.AUDIT_FIELDS];

  const values = [
    ...Object.values(core.CORE_ENUMS).flat(),
    ...Object.values(api.API_VOCAB).flat(),
    ...Object.values(CANDIDATE_ENUMS).flat(),
    core.WARNING_CRITICAL,
    ...core.COPY_EVENT_CLASSIFICATION_FLAG,
  ];

  // (1) Presence in SSOT docs.
  for (const name of [...enumNames, ...candidateNames, ...fieldNames]) {
    if (!backtick.has(name)) errors.push(`NAME not found as backticked SSOT token: ${name}`);
  }
  for (const v of values) {
    if (!words.has(String(v))) errors.push(`VALUE not found in SSOT docs: ${v}`);
  }

  // (2) No forbidden/rejected name declared.
  const allDeclared = new Set([...enumNames, ...candidateNames, ...fieldNames, ...values.map(String)]);
  for (const n of allDeclared) {
    if (forbidden.has(n)) errors.push(`FORBIDDEN name declared: ${n}`);
  }

  // (3) candidate_ prefix integrity.
  for (const n of Object.keys(CANDIDATE_ENUMS)) {
    if (!n.startsWith('candidate_')) errors.push(`candidate enum missing prefix: ${n}`);
  }
  for (const n of CANDIDATE_FIELDS) {
    if (!n.startsWith('candidate_')) errors.push(`candidate field missing prefix: ${n}`);
  }
  for (const n of CANDIDATE_COMMANDS) {
    if (!n.startsWith('candidate_cmd_')) errors.push(`candidate command missing prefix: ${n}`);
  }
  for (const n of CANDIDATE_ERRORS) {
    if (!n.startsWith('candidate_err_')) errors.push(`candidate error missing prefix: ${n}`);
  }

  // (4) No forbidden execution command among real (non-candidate) command_type values.
  for (const c of FORBIDDEN_EXEC_COMMANDS) {
    if (api.COMMAND_TYPE.includes(c)) errors.push(`forbidden execution command in command_type: ${c}`);
    if (CANDIDATE_COMMANDS.includes(c)) errors.push(`forbidden execution command in candidate commands: ${c}`);
  }

  // (5) Coverage: every candidate enum in SSOT is INCLUDED or explicitly DEFERRED.
  const discovered = discoverCandidateEnums(ssot);
  for (const name of discovered) {
    const included = includedCandidates.has(name);
    const deferred = deferredCandidates.has(name);
    if (!included && !deferred) {
      errors.push(`candidate enum in SSOT is neither included nor deferred: ${name}`);
    }
    if (included && deferred) {
      errors.push(`candidate enum marked both included AND deferred: ${name}`);
    }
  }
  // Deferred list must not contain stale names absent from SSOT.
  for (const name of deferredCandidates) {
    if (!discovered.has(name)) errors.push(`deferred candidate not found in SSOT (stale): ${name}`);
  }
  // Included candidates must actually be candidate enums in SSOT.
  for (const name of includedCandidates) {
    if (!discovered.has(name)) errors.push(`included candidate not found as SSOT enum: ${name}`);
  }
  // Honesty: do not claim full coverage while candidates are deferred.
  if (deferredCandidates.size > 0 && CLAIMS_FULL_SSOT_COVERAGE) {
    errors.push('CLAIMS_FULL_SSOT_COVERAGE is true while candidates are deferred');
  }

  return { ok: errors.length === 0, errors, counts: {
    coreEnums: Object.keys(core.CORE_ENUMS).length,
    apiVocab: Object.keys(api.API_VOCAB).length,
    candidateEnumsInSsot: discovered.size,
    candidateIncluded: includedCandidates.size,
    candidateDeferred: deferredCandidates.size,
    candidateCommands: CANDIDATE_COMMANDS.length,
    forbidden: forbidden.size,
  } };
}

// CLI mode.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok, errors, counts } = runDriftCheck();
  if (ok) {
    console.log(`SSOT drift check: PASS — core=${counts.coreEnums} api=${counts.apiVocab} candidate(ssot=${counts.candidateEnumsInSsot}, included=${counts.candidateIncluded}, deferred=${counts.candidateDeferred}) cmd=${counts.candidateCommands} forbidden=${counts.forbidden}`);
    process.exit(0);
  } else {
    console.error(`SSOT drift check: FAIL (${errors.length})`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
}
