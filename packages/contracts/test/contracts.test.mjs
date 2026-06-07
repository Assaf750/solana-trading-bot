import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as api from '../src/api-vocabulary.mjs';
import { CANDIDATE_COMMANDS, CANDIDATE_ERRORS } from '../src/candidate-commands.mjs';
import { FORBIDDEN_NAMES } from '../../ssot-types/src/forbidden.mjs';

test('no opportunity execution command exists in command_type', () => {
  for (const c of ['buy_opportunity', 'execute_opportunity', 'submit_opportunity']) {
    assert.equal(api.COMMAND_TYPE.includes(c), false, `${c} must not be a command_type`);
  }
});

test('no atomic batch-exit command exists (preview->request per-position only)', () => {
  for (const c of ['exit_all_positions', 'batch_exit_all_positions']) {
    assert.equal(api.COMMAND_TYPE.includes(c), false, `${c} must not exist`);
    assert.equal(CANDIDATE_COMMANDS.includes(c), false, `${c} must not exist`);
  }
  assert.ok(CANDIDATE_COMMANDS.includes('candidate_cmd_preview_batch_exit'));
  assert.ok(CANDIDATE_COMMANDS.includes('candidate_cmd_request_batch_exit'));
});

test('opportunity is a resource_type but has no command_type (read-only)', () => {
  assert.ok(api.RESOURCE_TYPE.includes('opportunity'));
  for (const c of api.COMMAND_TYPE) {
    assert.equal(/opportunity/.test(c), false, `command_type must not target opportunity: ${c}`);
  }
});

test('candidate commands/errors keep prefixes and are not real command_type values', () => {
  for (const c of CANDIDATE_COMMANDS) {
    assert.match(c, /^candidate_cmd_/, `${c} lost prefix`);
    assert.equal(api.COMMAND_TYPE.includes(c), false, `${c} must not be a real command_type`);
  }
  for (const e of CANDIDATE_ERRORS) assert.match(e, /^candidate_err_/, `${e} lost prefix`);
});

test('no forbidden name appears in API vocabulary', () => {
  const forbidden = new Set(FORBIDDEN_NAMES);
  const declared = new Set([
    ...Object.keys(api.API_VOCAB),
    ...Object.values(api.API_VOCAB).flat(),
    ...api.ENVELOPE_FIELDS,
    ...api.AUDIT_FIELDS,
    ...CANDIDATE_COMMANDS,
    ...CANDIDATE_ERRORS,
  ]);
  for (const n of declared) assert.equal(forbidden.has(n), false, `forbidden name leaked: ${n}`);
});

test('api error codes and event types match SSOT counts', () => {
  assert.equal(api.API_ERROR_CODE.length, 9);
  assert.equal(api.EVENT_TYPE.length, 8);
  assert.equal(api.STREAM_CHANNEL.length, 8);
  assert.equal(api.RESOURCE_TYPE.length, 13);
});
