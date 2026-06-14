// notifier.mjs — best-effort operator notifications (Telegram + generic webhook). It NEVER
// blocks or throws into the trading path: every send is fire-and-forget with a timeout and all
// failures are swallowed. Secrets (bot token, webhook URL) are resolved from the vault at send
// time and never logged. Callers ignore the returned promise; tests may await it.

// engine/api event kind -> the notifications.* toggle that gates it (absent => always sent)
const EVENT_TOGGLE = {
  paper_entry: 'on_entry', live_entry: 'on_entry',
  paper_exit: 'on_exit', live_exit: 'on_exit',
  leader_auto_paused: 'on_exit',
  daily_loss_limit_hit: 'on_daily_loss',
  kill_engaged: 'on_kill', real_live_activated: 'on_kill',
};

export function createNotifier({ config, getSecret, fetchImpl = fetch }) {
  function resolve(ref) {
    if (typeof ref !== 'string' || !ref.startsWith('vault:')) return null;
    const r = getSecret(ref.slice(6));
    return r?.ok ? r.value : null;
  }

  async function postJson(url, body) {
    try {
      await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
    } catch { /* best-effort: a down endpoint never affects trading */ }
  }

  async function notify({ kind, text }) {
    let cfg;
    try { cfg = config.get(); } catch { return; }
    const n = cfg.notifications || {};
    if (!n.enabled || !text) return;
    const toggle = EVENT_TOGGLE[kind];
    if (toggle && n[toggle] === false) return; // this event type is muted
    const p = cfg.providers || {};
    const jobs = [];
    if (n.telegram_enabled) {
      const token = resolve(p.telegram_bot_token_ref);
      const chatId = n.telegram_chat_id;
      if (token && chatId) {
        // escape HTML metachars — with parse_mode:'HTML' an unescaped <,>,& makes Telegram
        // reject the message (400), and the best-effort catch would drop the alert silently.
        const safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        jobs.push(postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: chatId, text: safe, parse_mode: 'HTML', disable_web_page_preview: true,
        }));
      }
    }
    if (n.webhook_enabled) {
      const url = resolve(p.webhook_url_ref);
      // content (Discord) + text (Slack) + structured fields for custom consumers
      if (url) jobs.push(postJson(url, { content: text, text, kind, source: 'soltrade' }));
    }
    await Promise.all(jobs);
  }

  return { notify };
}
