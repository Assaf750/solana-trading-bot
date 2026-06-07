// @soltrade/dashboard — i18n (AR/EN) + direction (RTL/LTR). Display strings only.
// No SSOT/API names are redefined here; these are UI labels. No execution labels.

export const LOCALES = Object.freeze(['ar', 'en']);
export const DIRECTION = Object.freeze({ ar: 'rtl', en: 'ltr' });

export const STRINGS = Object.freeze({
  ar: Object.freeze({
    app_title: 'محرّك النسخ على سولانا — لوحة التشغيل',
    nav_status: 'الحالة',
    nav_health: 'الصحّة',
    nav_constraints: 'القيود والتحذيرات',
    label_operating_state: 'حالة التشغيل',
    label_real_live_config_valid: 'صلاحية تكوين REAL-LIVE',
    label_validation_status: 'حالة التحقّق',
    label_warning: 'تحذير',
    note_not_trading_ready: 'هذه اللوحة تشخيصية فقط — الصحّة لا تعني جاهزية التداول. REAL-LIVE قرار المستخدم.',
    unavailable: 'غير متوفّر',
    lang_toggle: 'English',
  }),
  en: Object.freeze({
    app_title: 'Solana Copy Engine — Operations Shell',
    nav_status: 'Status',
    nav_health: 'Health',
    nav_constraints: 'Constraints & Warnings',
    label_operating_state: 'Operating state',
    label_real_live_config_valid: 'REAL-LIVE config valid',
    label_validation_status: 'Validation status',
    label_warning: 'Warning',
    note_not_trading_ready: 'This shell is diagnostic only — health does not mean trading readiness. REAL-LIVE is a user decision.',
    unavailable: 'unavailable',
    lang_toggle: 'العربية',
  }),
});

export function dirFor(locale) {
  return DIRECTION[locale] || 'ltr';
}

export function t(locale, key) {
  const table = STRINGS[locale] || STRINGS.en;
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
}
