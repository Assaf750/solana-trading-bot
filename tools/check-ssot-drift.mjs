// SSOT vocabulary-drift + candidate guard (preliminary, PR-A2).
// Validates that the names declared in @soltrade/ssot-types and @soltrade/contracts:
//   1) all appear in docs/01-SSOT.md / docs/03-API-CONTRACT.md  (No name before SSOT)
//   2) include none of the forbidden/rejected names                (Rejected/Forbidden)
//   3) keep every candidate_ prefix intact                         (candidate stays candidate)
//   4) define none of the forbidden execution commands             (no trading authority)
//
// Pure Node (no deps). Run: `node tools/check-ssot-drift.mjs`.
// Exit 0 = PASS, exit 1 = FAIL. Importable: `import { runDriftCheck } from ...`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as core from '../packages/ssot-types/src/core-enums.mjs';
import { CANDIDATE_ENUMS, CANDIDATE_FIELDS } from '../packages/ssot-types/src/candidate-enums.mjs';
import { FORBIDDEN_NAMES } from '../packages/ssot-types/src/forbidden.mjs';
import * as api from '../packages/contracts/src/api-vocabulary.mjs';
import { CANDIDATE_COMMANDS, CANDIDATE_ERRORS } from '../packages/contracts/src/candidate-commands.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Execution commands that must never be defined as real names anywhere.
const FORBIDDEN_EXEC_COMMANDS = [
  'buy_opportunity', 'execute_opportunity', 'submit_opportunity',
  'exit_all_positions', 'batch_exit_all_positions',
];

function loadDocUniverse() {
  const docs = ['docs/01-SSOT.md', 'docs/03-API-CONTRACT.md']
    .map((p) => readFileSync(join(ROOT, p), 'utf8'))
    .join('\n');
  // Tokens inside backticks (official field/value names are backticked in SSOT).
  const backtick = new Set();
  for (const m of docs.matchAll(/`([^`]+)`/g)) {
    for (const tok of m[1].split(/[^A-Za-z0-9_]+/)) if (tok) backtick.add(tok);
  }
  // All identifier-like tokens (covers plain `·`-separated allowed_values, e.g. 30d).
  const words = new Set(docs.match(/[A-Za-z0-9_]+/g) || []);
  return { backtick, words };
}

export function runDriftCheck() {
  const errors = [];
  const { backtick, words } = loadDocUniverse();
  const forbidden = new Set(FORBIDDEN_NAMES);

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

  return { ok: errors.length === 0, errors, counts: {
    coreEnums: Object.keys(core.CORE_ENUMS).length,
    apiVocab: Object.keys(api.API_VOCAB).length,
    candidateEnums: Object.keys(CANDIDATE_ENUMS).length,
    candidateCommands: CANDIDATE_COMMANDS.length,
    forbidden: forbidden.size,
  } };
}

// CLI mode.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ok, errors, counts } = runDriftCheck();
  if (ok) {
    console.log(`SSOT drift check: PASS — core=${counts.coreEnums} api=${counts.apiVocab} candidate=${counts.candidateEnums} cmd=${counts.candidateCommands} forbidden=${counts.forbidden}`);
    process.exit(0);
  } else {
    console.error(`SSOT drift check: FAIL (${errors.length})`);
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }
}
