// notifier.test.mjs — best-effort operator notifications (mocked fetch, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier } from '../src/notifier.mjs';

function harness(notifications, { secretOk = true } = {}) {
  const calls = [];
  const cfg = {
    notifications,
    providers: { telegram_bot_token_ref: 'vault:telegram_bot_token', webhook_url_ref: 'vault:webhook_url' },
  };
  const notifier = createNotifier({
    config: { get: () => cfg },
    getSecret: (name) => (secretOk ? { ok: true, value: name === 'webhook_url' ? 'https://hook.test/x' : 'TOKEN' } : { ok: false }),
    fetchImpl: async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true }; },
  });
  return { notifier, calls };
}

test('notifier: disabled => no send', async () => {
  const { notifier, calls } = harness({ enabled: false, telegram_enabled: true, telegram_chat_id: '1' });
  await notifier.notify({ kind: 'paper_entry', text: 'hi' });
  assert.equal(calls.length, 0);
});

test('notifier: telegram send hits the bot API with chat_id + text', async () => {
  const { notifier, calls } = harness({ enabled: true, telegram_enabled: true, telegram_chat_id: '99' });
  await notifier.notify({ kind: 'paper_entry', text: 'ENTRY' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\.telegram\.org\/botTOKEN\/sendMessage/);
  assert.equal(calls[0].body.chat_id, '99');
  assert.equal(calls[0].body.text, 'ENTRY');
});

test('notifier: webhook send posts content (Discord) + text (Slack)', async () => {
  const { notifier, calls } = harness({ enabled: true, webhook_enabled: true });
  await notifier.notify({ kind: 'live_exit', text: 'EXIT' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://hook.test/x');
  assert.equal(calls[0].body.content, 'EXIT');
  assert.equal(calls[0].body.text, 'EXIT');
});

test('notifier: event-type toggle mutes a kind', async () => {
  const { notifier, calls } = harness({ enabled: true, webhook_enabled: true, on_exit: false });
  await notifier.notify({ kind: 'live_exit', text: 'EXIT' }); // on_exit muted
  assert.equal(calls.length, 0);
  await notifier.notify({ kind: 'live_entry', text: 'ENTRY' }); // on_entry default true
  assert.equal(calls.length, 1);
});

test('notifier: missing secret (locked vault) => silently skips', async () => {
  const { notifier, calls } = harness({ enabled: true, telegram_enabled: true, telegram_chat_id: '1' }, { secretOk: false });
  await notifier.notify({ kind: 'paper_entry', text: 'x' });
  assert.equal(calls.length, 0);
});

test('notifier: a throwing fetch never propagates', async () => {
  const notifier = createNotifier({
    config: { get: () => ({ notifications: { enabled: true, webhook_enabled: true }, providers: { webhook_url_ref: 'vault:webhook_url' } }) },
    getSecret: () => ({ ok: true, value: 'https://hook.test/x' }),
    fetchImpl: async () => { throw new Error('down'); },
  });
  await notifier.notify({ kind: 'live_exit', text: 'x' }); // must resolve, not reject
  assert.ok(true);
});
