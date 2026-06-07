// @soltrade/dashboard — shell render logic (deterministic, pure).
// Read-only diagnostic shell: shows system status / health / constraints.
// NO execution controls (no buy/sell/exit buttons), NO trading actions, NO network here.
// Missing metrics are shown as "unavailable" (never fabricated).

import { t, dirFor, LOCALES } from './i18n.mjs';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function row(locale, labelKey, value) {
  const v = value === undefined || value === null || value === '' ? t(locale, 'unavailable') : value;
  return `<div class="kv"><span class="k">${esc(t(locale, labelKey))}</span><span class="v">${esc(v)}</span></div>`;
}

/**
 * Render the read-only shell body for a given (mock/provided) state and locale.
 * @param state { operating_state?, real_live_config_valid?, validation_status?, warning? }
 * @param locale 'ar' | 'en'
 * @returns HTML string (no execution controls).
 */
export function renderShell(state = {}, locale = 'en') {
  const dir = dirFor(locale);
  const rlcv = state.real_live_config_valid === undefined ? undefined : String(state.real_live_config_valid);
  return [
    `<main dir="${dir}" lang="${esc(locale)}" data-testid="shell">`,
    `<h1>${esc(t(locale, 'app_title'))}</h1>`,
    `<p class="note" data-testid="not-trading-ready">${esc(t(locale, 'note_not_trading_ready'))}</p>`,
    `<section data-testid="status"><h2>${esc(t(locale, 'nav_status'))}</h2>`,
    row(locale, 'label_operating_state', state.operating_state),
    `</section>`,
    `<section data-testid="health"><h2>${esc(t(locale, 'nav_health'))}</h2>`,
    row(locale, 'label_real_live_config_valid', rlcv),
    row(locale, 'label_validation_status', state.validation_status),
    `</section>`,
    `<section data-testid="constraints"><h2>${esc(t(locale, 'nav_constraints'))}</h2>`,
    row(locale, 'label_warning', state.warning),
    `</section>`,
    `<button type="button" data-action="toggle-language">${esc(t(locale, 'lang_toggle'))}</button>`,
    `</main>`,
  ].join('');
}

export { LOCALES, dirFor };

// Browser bootstrap (no-op under Node import; guarded for the static shell page).
if (typeof document !== 'undefined') {
  let locale = (document.documentElement.lang === 'ar' ? 'ar' : 'en');
  const mount = () => {
    document.documentElement.dir = dirFor(locale);
    const root = document.getElementById('app');
    if (root) root.innerHTML = renderShell({}, locale); // empty state -> "unavailable" placeholders
    const btn = document.querySelector('[data-action="toggle-language"]');
    if (btn) btn.addEventListener('click', () => { locale = locale === 'ar' ? 'en' : 'ar'; mount(); });
  };
  mount();
}
