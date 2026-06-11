// @soltrade/operator-dashboard-foundations
//
// Read-only / advisory ONLY OPERATOR DASHBOARD foundation for Stage-18 (Phase
// C): PURE RENDER FUNCTIONS that turn the existing backend read-models
// (pipeline decision trace, pipeline health, paper P&L, profitability
// advisory, stream health / readiness checklist, security notices) into
// READ-ONLY, SELF-CONTAINED, INERT HTML strings, plus a static shell
// assembler. Import-free, pure, deterministic. NO DOM, NO server, NO network
// primitive, NO clock, NO RNG, NO environment access, NO filesystem access,
// NO signing, NO sending, NO secrets, NO mutable module/global state.
//
// THE CORE RULES:
//   - The UI layer is STRICTLY READ-ONLY over backend read-models. The
//     renderer NEVER computes P&L (it renders the model's numbers verbatim —
//     formatting only), NEVER fabricates a missing metric (missing renders as
//     'unavailable', never 0), shows unrealized P&L ONLY when the read-model
//     itself carries a number (mark-valid upstream), labels every simulated
//     output with a visible SIMULATED badge, and NEVER hides a security /
//     critical warning (a smuggled hide/collapse flag is ignored for them).
//   - XSS-SAFE: every interpolated string is HTML-escaped (& < > " '). A
//     hostile <script> / onerror= / ]]> payload in a ref or label appears
//     escaped in the output and is never executable.
//   - NO SECRETS EVER RENDERED: a consumed read-model carrying a forbidden
//     surface NAME (private_key / api_key / endpoint / ...) or a credential /
//     endpoint-shaped VALUE is REFUSED with a fail-closed error panel — the
//     value is NEVER echoed into html, reasons, or any output field.
//   - The generated HTML is INERT: no <form>, no <button>, no <input>, no
//     external script/src, no fetch, no event handlers — a details/summary
//     toggle (pure HTML) is the only collapse mechanism, and it is never used
//     for security/critical content.
//   - Hostile, throwing, or uninspectable input returns a FROZEN result with
//     an error panel and NEVER throws. Fail-Safe-Not-Fail-Open.
//
// IMPORTANT: every identifier here is a LOCAL function-I/O contract
// identifier (dash_* / DASH_*), NOT an SSOT name. This package adds NO name
// to docs/01-SSOT.md. The registered SSOT G22 candidate P&L field names
// (candidate_realized_pnl / candidate_fees_total / candidate_slippage_cost /
// candidate_paper_pnl / candidate_unrealized_pnl / candidate_mark_status /
// candidate_pnl_by_wallet / candidate_pnl_by_copy_mode /
// candidate_pnl_by_brain) are CONSUMED ONLY as INPUT field names of the
// Stage-14 paper P&L read-model and are displayed as data labels — never
// minted, never emitted as new output keys. Field names like private_key /
// api_key / endpoint appear ONLY inside refusal allowlists and prose.

// ---------------------------------------------------------------------------
// Shared module-internal helpers (NOT exported)
// ---------------------------------------------------------------------------

function dashSafeFlags() {
  return {
    read_only: true,
    has_secret: false,
    live_stream_enabled: false,
    network_call_made: false,
    endpoint_resolved: false,
    live_quote_enabled: false,
    signal_ready: false,
    trading_ready: false,
    risk_ready: false,
    intent_ready: false,
    routing_ready: false,
    route_ready: false,
    order_ready: false,
    transaction_ready: false,
    serialized_ready: false,
    message_bytes_ready: false,
    signer_ready: false,
    signing_permitted: false,
    broadcast_permitted: false,
    can_send: false,
    can_broadcast: false,
    can_serialize: false,
    is_live: false,
    mainnet_enabled: false,
    real_live: false
  };
}

// the 24 non-read_only flags above — none may EVER be true on any consumed
// read-model or any render result; a renderer NEVER flips a readiness flag.
const DASH_FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'has_secret', 'live_stream_enabled', 'network_call_made', 'endpoint_resolved',
  'live_quote_enabled', 'signal_ready', 'trading_ready', 'risk_ready',
  'intent_ready', 'routing_ready', 'route_ready', 'order_ready',
  'transaction_ready', 'serialized_ready', 'message_bytes_ready', 'signer_ready',
  'signing_permitted', 'broadcast_permitted', 'can_send', 'can_broadcast',
  'can_serialize', 'is_live', 'mainnet_enabled', 'real_live'
]);

// Execution-command KEY names refused on any consumed read-model. The
// forbidden opportunity / batch-exit command vocabulary appears here ONLY as
// fixed refusal literals — this package never generates or executes any.
const DASH_EXEC_CMD_KEYS = Object.freeze([
  'buy', 'sell', 'execute', 'submit', 'send', 'broadcast', 'swap', 'sign',
  'sign_tx', 'sign_transaction', 'order', 'place_order', 'build_tx',
  'send_tx', 'broadcast_tx', 'jupiter_route', 'load_key', 'load_signer',
  'activate_signer', 'route_execute', 'connect', 'open_stream', 'start_stream',
  'subscribe_live', 'activate', 'activate_live', 'enable_live',
  'resolve_endpoint', 'buy_opportunity', 'execute_opportunity',
  'submit_opportunity', 'exit_all_positions', 'batch_exit_all_positions'
]);

// Forbidden surface NAME scan (NAME-only redaction: a matched NAME refuses
// the panel; the VALUE is never read into any reason, label, or output).
// The 24 safe flags are exempt (has_secret:false is a legitimate key).
const DASH_FORBIDDEN_NAME_RE = /private|secret_key|secretkey|\bsecret\b|\bseed\b|seed_phrase|mnemonic|keypair|api[_-]?key|apikey|bearer|access[_-]?token|auth[_-]?token|\btoken\b|credential|password|signing_key|raw_key|provider_key|\bendpoint\b|endpoint_url|rpc_url|ws_url|stream_url|grpc|connection_string/i;

// credential / endpoint-shaped string VALUES (scheme://, PEM marker, long
// base58 blob). A planted endpoint or key VALUE under an innocent name still
// refuses the panel — and is never echoed.
const DASH_URL_VALUE_RE = /[a-z][a-z0-9+.-]*:\/\//i;
const DASH_PEM_RE = /-----BEGIN/;
const DASH_BASE58_BLOB_RE = /\b[1-9A-HJ-NP-Za-km-z]{64,}\b/;

const DASH_RENDER_STATES = Object.freeze([
  'DASH_RENDER_OK', 'DASH_RENDER_UNAVAILABLE', 'DASH_RENDER_INVALID',
  'DASH_RENDER_REFUSED'
]);

// HTML-escape EVERY interpolated string: & < > " '
// (character loop on purpose — keeps quote characters out of regex literals so
// the repo's code-only lexers/guards stay precise)
function dashEscapeHtml(v) {
  const s = String(v);
  const parts = [];
  for (const ch of s) {
    if (ch === '&') parts.push('&amp;');
    else if (ch === '<') parts.push('&lt;');
    else if (ch === '>') parts.push('&gt;');
    else if (ch === '"') parts.push('&quot;');
    else if (ch === "'") parts.push('&#39;');
    else parts.push(ch);
  }
  return parts.join('');
}

// TOCTOU defense step 1: shallow snapshot of the wrapper input — every own
// enumerable property is read EXACTLY ONCE via a single spread.
function dashSnapshot(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o)) return null;
  return { ...o };
}

// TOCTOU defense step 2: bounded DEEP CLONE of one consumed read-model.
// Every property (nested included) is read EXACTLY ONCE during the clone; all
// later screening AND rendering walk the SAME clone, so a hostile counting
// getter cannot serve a clean value to the screen and a dirty value to the
// renderer. Functions / excess depth / excess nodes throw -> caller fails
// closed.
const DASH_MAX_DEPTH = 8;
const DASH_MAX_NODES = 5000;

function dashDeepClone(v, depth, budget) {
  if (v === null) return null;
  const t = typeof v;
  if (t === 'function') throw new Error('dash_uninspectable');
  if (t !== 'object') return v;
  if (depth > DASH_MAX_DEPTH) throw new Error('dash_uninspectable');
  budget.n += 1;
  if (budget.n > DASH_MAX_NODES) throw new Error('dash_uninspectable');
  if (Array.isArray(v)) {
    const arr = [];
    for (const item of v) arr.push(dashDeepClone(item, depth + 1, budget));
    return arr;
  }
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    out[k] = dashDeepClone(val, depth + 1, budget);
  }
  return out;
}

// consume one read-model slot: { ok, missing, model }
function dashConsume(raw) {
  if (raw == null) return { ok: false, missing: true, model: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, missing: false, model: null };
  }
  try {
    return { ok: true, missing: false, model: dashDeepClone(raw, 0, { n: 0 }) };
  } catch {
    return { ok: false, missing: false, model: null };
  }
}

// consume one array slot (e.g. notices)
function dashConsumeArray(raw) {
  if (raw == null) return { ok: false, missing: true, list: null };
  if (!Array.isArray(raw)) return { ok: false, missing: false, list: null };
  try {
    return { ok: true, missing: false, list: dashDeepClone(raw, 0, { n: 0 }) };
  } catch {
    return { ok: false, missing: false, list: null };
  }
}

// shared read-model screen over a CLONE (deep). Reasons are fixed codes; no
// value and no offending name is ever echoed.
function dashScreenClone(root) {
  const reasons = new Set();
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node == null || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      for (const v of node) {
        if (typeof v === 'string') dashScreenStringValue(v, reasons);
        else if (v != null && typeof v === 'object') stack.push(v);
      }
      continue;
    }
    for (const [k, v] of Object.entries(node)) {
      if (DASH_FORBIDDEN_TRUE_FLAGS.includes(k)) {
        if (v === true) reasons.add('forbidden_flag_blocked');
      } else {
        if (DASH_EXEC_CMD_KEYS.includes(String(k).toLowerCase())) {
          reasons.add('execution_command_blocked');
        }
        if (DASH_FORBIDDEN_NAME_RE.test(String(k))) {
          reasons.add('forbidden_surface_name_blocked');
        }
      }
      if (typeof v === 'string') dashScreenStringValue(v, reasons);
      else if (v != null && typeof v === 'object') stack.push(v);
    }
  }
  return [...reasons];
}

function dashScreenStringValue(s, reasons) {
  if (DASH_URL_VALUE_RE.test(s) || DASH_PEM_RE.test(s) || DASH_BASE58_BLOB_RE.test(s)) {
    reasons.add('forbidden_value_blocked');
  }
}

// ---------------------------------------------------------------------------
// Fixed bilingual presentation text (labels only — never SSOT names)
// ---------------------------------------------------------------------------

const DASH_TEXT = Object.freeze({
  unavailable: Object.freeze({ en: 'unavailable', ar: 'غير متاح' }),
  not_verified: Object.freeze({ en: 'not verified', ar: 'لم يُتحقَّق' }),
  met: Object.freeze({ en: 'met', ar: 'مستوفى' }),
  not_met: Object.freeze({ en: 'not met', ar: 'غير مستوفى' }),
  yes: Object.freeze({ en: 'yes', ar: 'نعم' }),
  no: Object.freeze({ en: 'no', ar: 'لا' }),
  simulated: Object.freeze({ en: 'SIMULATED', ar: 'محاكاة' }),
  warning: Object.freeze({ en: 'WARNING', ar: 'تحذير' }),
  refused: Object.freeze({
    en: 'render refused — forbidden content blocked (value not shown)',
    ar: 'رُفض العرض — حُجب محتوى محظور (لا تُعرض القيمة)'
  }),
  lang_invalid: Object.freeze({
    en: 'render invalid — lang must be ar or en',
    ar: 'عرض غير صالح — اللغة يجب أن تكون ar أو en'
  }),
  advisory_caption: Object.freeze({
    en: 'advisory only — not a command',
    ar: 'استشاري فقط — ليس أمراً'
  }),
  footer: Object.freeze({
    en: 'READ-ONLY OPERATOR VIEW — no commands',
    ar: 'عرض المشغّل للقراءة فقط — لا أوامر'
  }),
  read_only_badge: Object.freeze({ en: 'read-only', ar: 'للقراءة فقط' }),
  exits_only_warning: Object.freeze({
    en: 'stream advisory is exits-only-shaped (gap exceeded or provider degraded) — read-only advisory, not a command',
    ar: 'إنذار الدفق بشكل خروج-فقط (فجوة متجاوزة أو تدهور مزوّد) — إنذار للقراءة فقط، ليس أمراً'
  }),
  title_decision_trace: Object.freeze({ en: 'Decision Trace', ar: 'أثر القرار' }),
  title_pipeline_health: Object.freeze({ en: 'Pipeline Health', ar: 'صحّة المسار' }),
  title_paper_pnl: Object.freeze({ en: 'Paper P&L', ar: 'الربح والخسارة الورقية' }),
  title_profitability: Object.freeze({ en: 'Profitability Advisory', ar: 'استشارة الربحية' }),
  title_stream_health: Object.freeze({ en: 'Stream Health', ar: 'صحّة الدفق' }),
  title_security_notices: Object.freeze({ en: 'Security Notices', ar: 'تنبيهات الأمان' }),
  title_dashboard: Object.freeze({ en: 'Operator Dashboard', ar: 'لوحة المشغّل' }),
  overall_outcome: Object.freeze({ en: 'overall outcome', ar: 'النتيجة الإجمالية' }),
  stage: Object.freeze({ en: 'stage', ar: 'المرحلة' }),
  state: Object.freeze({ en: 'state', ar: 'الحالة' }),
  decisive_reason: Object.freeze({ en: 'decisive reason', ar: 'السبب الحاسم' }),
  advanced: Object.freeze({ en: 'advanced', ar: 'تقدّم' }),
  blocked: Object.freeze({ en: 'blocked', ar: 'محجوب' }),
  reasons: Object.freeze({ en: 'reasons', ar: 'الأسباب' }),
  totals: Object.freeze({ en: 'totals (from the read-model, verbatim)', ar: 'الإجماليات (من نموذج القراءة، حرفياً)' }),
  positions: Object.freeze({ en: 'positions', ar: 'المراكز' }),
  per_wallet: Object.freeze({ en: 'per wallet', ar: 'لكل محفظة' }),
  per_copy_mode: Object.freeze({ en: 'per copy mode', ar: 'لكل نمط نسخ' }),
  per_brain: Object.freeze({ en: 'per brain', ar: 'لكل عقل' }),
  wallet: Object.freeze({ en: 'wallet', ar: 'المحفظة' }),
  advisory: Object.freeze({ en: 'advisory', ar: 'الاستشارة' }),
  gap_slots: Object.freeze({ en: 'gap (slots)', ar: 'الفجوة (slots)' }),
  checklist: Object.freeze({ en: 'readiness checklist (display only — not trading readiness)', ar: 'قائمة الجاهزية (عرض فقط — ليست جاهزية تداول)' }),
  all_met: Object.freeze({ en: 'all items met', ar: 'كل البنود مستوفاة' }),
  no_notices: Object.freeze({ en: 'no notices', ar: 'لا تنبيهات' })
});

function dashLabel(key, lang) {
  const t = DASH_TEXT[key];
  if (lang === 'ar') return t.ar;
  if (lang === 'en') return t.en;
  return t.en + ' / ' + t.ar; // bilingual when no valid lang is available
}

function dashUnavailableSpan(lang) {
  return '<span class="dash-unavailable">' + dashEscapeHtml(dashLabel('unavailable', lang)) + '</span>';
}

// format a backend number VERBATIM (formatting only — never computed here).
// Anything that is not a finite number renders 'unavailable' — NEVER 0.
function dashFormatNumber(v, lang) {
  if (typeof v === 'number' && Number.isFinite(v)) return dashEscapeHtml(String(v));
  return dashUnavailableSpan(lang);
}

function dashFormatString(v, lang) {
  if (typeof v === 'string' && v.length > 0) return dashEscapeHtml(v);
  return dashUnavailableSpan(lang);
}

function dashPanelShell(kind, titleHtml, bodyHtml) {
  return '<section class="dash-panel" data-dash-panel="' + kind + '">'
    + '<h2 class="dash-panel-title">' + titleHtml + '</h2>'
    + bodyHtml
    + '</section>';
}

function dashSimulatedBadge(lang) {
  return ' <span class="dash-badge-simulated">' + dashEscapeHtml(dashLabel('simulated', lang)) + '</span>';
}

function dashResult(kind, state, html, reasons) {
  return Object.freeze({
    html,
    render_state: state,
    panel_kind: kind,
    status: state,
    reasons: Object.freeze([...new Set(reasons)]),
    advisory_only: true,
    ...dashSafeFlags()
  });
}

function dashUnavailableResult(kind, titleKey, lang, reasons, badge) {
  const body = '<p class="dash-unavailable">' + dashEscapeHtml(dashLabel('unavailable', lang)) + '</p>';
  const title = dashEscapeHtml(dashLabel(titleKey, lang)) + (badge === true ? dashSimulatedBadge(lang) : '');
  return dashResult(kind, 'DASH_RENDER_UNAVAILABLE', dashPanelShell(kind, title, body), reasons);
}

function dashRefusedResult(kind, titleKey, lang, reasons) {
  const body = '<p class="dash-refused">' + dashEscapeHtml(dashLabel('refused', lang)) + '</p>';
  return dashResult(kind, 'DASH_RENDER_REFUSED',
    dashPanelShell(kind, dashEscapeHtml(dashLabel(titleKey, lang)), body), reasons);
}

function dashInvalidLangResult(kind, titleKey) {
  const body = '<p class="dash-refused">' + dashEscapeHtml(dashLabel('lang_invalid', null)) + '</p>';
  return dashResult(kind, 'DASH_RENDER_INVALID',
    dashPanelShell(kind, dashEscapeHtml(dashLabel(titleKey, null)), body), ['lang_invalid']);
}

// lang is a presentation choice, not a safety threshold — but it must still be
// explicit: only 'ar' | 'en' are accepted; anything else is refused INVALID.
function dashLangOf(snap) {
  const l = snap.lang;
  return (l === 'ar' || l === 'en') ? l : null;
}

// ---------------------------------------------------------------------------
// (2) DECISION TRACE PANEL
// ---------------------------------------------------------------------------

const DASH_TRACE_STAGE_ORDER = Object.freeze([
  'signal', 'risk', 'intent', 'route', 'signing_review', 'send_review'
]);

const DASH_PANEL_DECISION_TRACE = 'dash_decision_trace_panel';

export function describeDecisionTracePanelContract() {
  return Object.freeze({
    contract: 'operator-dashboard-decision-trace-panel',
    version: '0.0.0',
    test_only: true,
    panel_kind: DASH_PANEL_DECISION_TRACE,
    supported_render_states: DASH_RENDER_STATES,
    supported_langs: Object.freeze(['ar', 'en']),
    rendered_stage_order: DASH_TRACE_STAGE_ORDER,
    advisory_only: true,
    render_state: 'DASH_RENDER_UNAVAILABLE',
    html: '',
    reasons: Object.freeze([]),
    ...dashSafeFlags(),
    note: 'Read-only DECISION TRACE PANEL renderer (Stage-18, operator dashboard foundations). A PURE FUNCTION over { decision_trace: a Stage-13 pipeline decision-trace read-model (recognized ONLY by read_only:true + string overall_outcome + array trace_entries), lang: ar|en (REQUIRED; anything else -> DASH_RENDER_INVALID) }. Renders an ordered 6-stage READ-ONLY table in the FIXED order [signal, risk, intent, route, signing_review, send_review] with stage / state / decisive reason / advanced / blocked as TEXT (no icons-as-images, no handlers). A stage missing from trace_entries renders unavailable cells — the renderer NEVER invents a state. TOCTOU defense: the consumed model is deep-cloned EXACTLY ONCE; screening and rendering walk the SAME clone. Every interpolated string is HTML-escaped (& < > " \'). Fail-Safe-Not-Fail-Open: missing/hostile/unrecognized model -> DASH_RENDER_UNAVAILABLE (an unavailable panel, never invented data); a forbidden surface NAME, credential/endpoint-shaped VALUE, smuggled execution command key, or forbidden true flag anywhere in the model -> DASH_RENDER_REFUSED (the value is NEVER echoed). The html is inert: no form, no button, no input, no script, no external src, no event handler. Rendering grants NOTHING: no execution authority, no trading readiness; all 24 readiness/execution flags stay false on every result.'
  });
}

export function renderDecisionTracePanel(input) {
  const KIND = DASH_PANEL_DECISION_TRACE;
  const TITLE = 'title_decision_trace';
  try {
    const snap = dashSnapshot(input);
    if (snap === null) return dashUnavailableResult(KIND, TITLE, null, ['no_render_input']);
    const lang = dashLangOf(snap);
    if (lang === null) return dashInvalidLangResult(KIND, TITLE);

    const c = dashConsume(snap.decision_trace);
    if (c.missing) return dashUnavailableResult(KIND, TITLE, lang, ['decision_trace_missing']);
    if (!c.ok) return dashUnavailableResult(KIND, TITLE, lang, ['input_inspection_error']);
    const m = c.model;

    const screened = dashScreenClone(m);
    if (screened.length > 0) return dashRefusedResult(KIND, TITLE, lang, screened);

    const recognized = (m.read_only === true)
      && (typeof m.overall_outcome === 'string')
      && Array.isArray(m.trace_entries);
    if (!recognized) return dashUnavailableResult(KIND, TITLE, lang, ['unrecognized_decision_trace']);

    const byStage = new Map();
    for (const e of m.trace_entries) {
      if (e != null && typeof e === 'object' && !Array.isArray(e)
        && typeof e.stage === 'string' && !byStage.has(e.stage)) {
        byStage.set(e.stage, e);
      }
    }

    let rows = '';
    for (const stage of DASH_TRACE_STAGE_ORDER) {
      const e = byStage.get(stage);
      if (e === undefined) {
        rows += '<tr><td>' + dashEscapeHtml(stage) + '</td>'
          + '<td>' + dashUnavailableSpan(lang) + '</td>'
          + '<td>' + dashUnavailableSpan(lang) + '</td>'
          + '<td>' + dashUnavailableSpan(lang) + '</td>'
          + '<td>' + dashUnavailableSpan(lang) + '</td></tr>';
        continue;
      }
      rows += '<tr><td>' + dashEscapeHtml(stage) + '</td>'
        + '<td>' + dashFormatString(e.stage_state, lang) + '</td>'
        + '<td>' + dashFormatString(e.decisive_reason, lang) + '</td>'
        + '<td>' + dashEscapeHtml(dashLabel(e.advanced === true ? 'yes' : 'no', lang)) + '</td>'
        + '<td>' + dashEscapeHtml(dashLabel(e.blocked === true ? 'yes' : 'no', lang)) + '</td></tr>';
    }

    const body = '<p>' + dashEscapeHtml(dashLabel('overall_outcome', lang)) + ': '
      + '<span class="dash-chip">' + dashFormatString(m.overall_outcome, lang) + '</span></p>'
      + '<table class="dash-table"><thead><tr>'
      + '<th>' + dashEscapeHtml(dashLabel('stage', lang)) + '</th>'
      + '<th>' + dashEscapeHtml(dashLabel('state', lang)) + '</th>'
      + '<th>' + dashEscapeHtml(dashLabel('decisive_reason', lang)) + '</th>'
      + '<th>' + dashEscapeHtml(dashLabel('advanced', lang)) + '</th>'
      + '<th>' + dashEscapeHtml(dashLabel('blocked', lang)) + '</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>';

    return dashResult(KIND, 'DASH_RENDER_OK',
      dashPanelShell(KIND, dashEscapeHtml(dashLabel(TITLE, lang)), body),
      ['decision_trace_rendered']);
  } catch {
    return dashUnavailableResult(KIND, TITLE, null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (3) PIPELINE HEALTH PANEL
// ---------------------------------------------------------------------------

const DASH_PIPELINE_HEALTH_STATES = Object.freeze([
  'PIPELINE_HEALTH_UNCONFIGURED', 'PIPELINE_HEALTH_BLOCKED',
  'PIPELINE_HEALTH_DEGRADED', 'PIPELINE_HEALTH_SUPPRESSED',
  'PIPELINE_HEALTH_REVIEWED_ADVISORY'
]);

const DASH_PANEL_PIPELINE_HEALTH = 'dash_pipeline_health_panel';

export function describePipelineHealthPanelContract() {
  return Object.freeze({
    contract: 'operator-dashboard-pipeline-health-panel',
    version: '0.0.0',
    test_only: true,
    panel_kind: DASH_PANEL_PIPELINE_HEALTH,
    supported_render_states: DASH_RENDER_STATES,
    supported_langs: Object.freeze(['ar', 'en']),
    consumed_health_states: DASH_PIPELINE_HEALTH_STATES,
    advisory_only: true,
    render_state: 'DASH_RENDER_UNAVAILABLE',
    html: '',
    reasons: Object.freeze([]),
    ...dashSafeFlags(),
    note: 'Read-only PIPELINE HEALTH PANEL renderer (Stage-18). A PURE FUNCTION over { pipeline_health (or decision_health): a Stage-13 pipeline-health read-model recognized ONLY by read_only:true + pipeline_health_state in the consumed 5-state vocabulary, lang: ar|en REQUIRED }. Renders a state chip plus the model reasons list as escaped TEXT. The consumed state strings are Stage-13 LOCAL vocabulary consumed-only — never minted here. Unrecognized/missing model or unknown state string -> DASH_RENDER_UNAVAILABLE (unavailable, never invented). Forbidden surface NAME / credential/endpoint VALUE / smuggled command / forbidden flag -> DASH_RENDER_REFUSED, value never echoed. Hostile input -> frozen error panel, never throws. Inert html; rendering grants nothing; all 24 readiness/execution flags stay false.'
  });
}

export function renderPipelineHealthPanel(input) {
  const KIND = DASH_PANEL_PIPELINE_HEALTH;
  const TITLE = 'title_pipeline_health';
  try {
    const snap = dashSnapshot(input);
    if (snap === null) return dashUnavailableResult(KIND, TITLE, null, ['no_render_input']);
    const lang = dashLangOf(snap);
    if (lang === null) return dashInvalidLangResult(KIND, TITLE);

    const raw = (snap.pipeline_health !== undefined && snap.pipeline_health !== null)
      ? snap.pipeline_health : snap.decision_health;
    const c = dashConsume(raw);
    if (c.missing) return dashUnavailableResult(KIND, TITLE, lang, ['pipeline_health_missing']);
    if (!c.ok) return dashUnavailableResult(KIND, TITLE, lang, ['input_inspection_error']);
    const m = c.model;

    const screened = dashScreenClone(m);
    if (screened.length > 0) return dashRefusedResult(KIND, TITLE, lang, screened);

    const recognized = (m.read_only === true)
      && DASH_PIPELINE_HEALTH_STATES.includes(m.pipeline_health_state);
    if (!recognized) return dashUnavailableResult(KIND, TITLE, lang, ['unrecognized_pipeline_health']);

    let items = '';
    if (Array.isArray(m.reasons)) {
      for (const r of m.reasons) {
        items += '<li>' + dashFormatString(r, lang) + '</li>';
      }
    }
    const body = '<p><span class="dash-chip">' + dashEscapeHtml(m.pipeline_health_state) + '</span></p>'
      + '<p>' + dashEscapeHtml(dashLabel('reasons', lang)) + ':</p>'
      + '<ul class="dash-list">' + (items === '' ? '<li>' + dashUnavailableSpan(lang) + '</li>' : items) + '</ul>';

    return dashResult(KIND, 'DASH_RENDER_OK',
      dashPanelShell(KIND, dashEscapeHtml(dashLabel(TITLE, lang)), body),
      ['pipeline_health_rendered']);
  } catch {
    return dashUnavailableResult(KIND, TITLE, null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (4) PAPER P&L PANEL — SIMULATED badge mandatory; backend numbers verbatim
// ---------------------------------------------------------------------------

const DASH_PANEL_PAPER_PNL = 'dash_paper_pnl_panel';

// the registered SSOT G22 candidate P&L field names this panel CONSUMES and
// displays as data labels (consumed-only — never minted as new names).
const DASH_PAPER_TOTAL_FIELDS = Object.freeze([
  'candidate_realized_pnl', 'candidate_fees_total', 'candidate_slippage_cost',
  'candidate_paper_pnl'
]);

export function describePaperPnlPanelContract() {
  return Object.freeze({
    contract: 'operator-dashboard-paper-pnl-panel',
    version: '0.0.0',
    test_only: true,
    panel_kind: DASH_PANEL_PAPER_PNL,
    supported_render_states: DASH_RENDER_STATES,
    supported_langs: Object.freeze(['ar', 'en']),
    consumed_total_fields: DASH_PAPER_TOTAL_FIELDS,
    advisory_only: true,
    simulated_badge_required: true,
    render_state: 'DASH_RENDER_UNAVAILABLE',
    html: '',
    reasons: Object.freeze([]),
    ...dashSafeFlags(),
    note: 'Read-only PAPER P&L PANEL renderer (Stage-18). A PURE FUNCTION over { paper_pnl_read_model: a Stage-14 paper P&L read-model recognized ONLY by read_only:true + string paper_pnl_state, lang: ar|en REQUIRED }. THE RENDERER NEVER COMPUTES P&L: it renders the model totals (candidate_realized_pnl / candidate_fees_total / candidate_slippage_cost / candidate_paper_pnl — registered G22 candidate names consumed as data labels), the positions map, and the candidate_pnl_by_wallet / candidate_pnl_by_copy_mode / candidate_pnl_by_brain aggregates VERBATIM (formatting only — String(n) of the backend number; it never sums, never derives). candidate_unrealized_pnl renders as a number ONLY when the model value IS a finite number (mark-valid upstream); null/missing renders the unavailable label — NEVER 0. A model carrying simulated:true ALWAYS shows a prominent SIMULATED badge (AR: محاكاة); a READ_MODEL-state model NOT marked simulated:true is REFUSED (simulated_marking_missing — paper truth must stay visibly simulated). Missing metric -> unavailable, never fabricated. Unrecognized/missing model or non-READ_MODEL state -> DASH_RENDER_UNAVAILABLE (badge still shown when the model says simulated:true). Forbidden surface NAME / credential/endpoint VALUE / smuggled command / forbidden flag -> DASH_RENDER_REFUSED, value never echoed. Inert html; no execution authority; all 24 readiness/execution flags stay false.'
  });
}

export function renderPaperPnlPanel(input) {
  const KIND = DASH_PANEL_PAPER_PNL;
  const TITLE = 'title_paper_pnl';
  try {
    const snap = dashSnapshot(input);
    if (snap === null) return dashUnavailableResult(KIND, TITLE, null, ['no_render_input']);
    const lang = dashLangOf(snap);
    if (lang === null) return dashInvalidLangResult(KIND, TITLE);

    const c = dashConsume(snap.paper_pnl_read_model);
    if (c.missing) return dashUnavailableResult(KIND, TITLE, lang, ['paper_pnl_read_model_missing']);
    if (!c.ok) return dashUnavailableResult(KIND, TITLE, lang, ['input_inspection_error']);
    const m = c.model;

    const screened = dashScreenClone(m);
    if (screened.length > 0) return dashRefusedResult(KIND, TITLE, lang, screened);

    const recognized = (m.read_only === true) && (typeof m.paper_pnl_state === 'string');
    if (!recognized) return dashUnavailableResult(KIND, TITLE, lang, ['unrecognized_paper_pnl_read_model']);

    const badge = (m.simulated === true);
    if (m.paper_pnl_state !== 'PAPER_PNL_READ_MODEL') {
      return dashUnavailableResult(KIND, TITLE, lang, ['paper_pnl_not_read_model'], badge);
    }
    // a paper read-model that does not declare itself simulated is refused —
    // paper truth must never be renderable as real truth.
    if (!badge) return dashRefusedResult(KIND, TITLE, lang, ['simulated_marking_missing']);

    // totals — the model's numbers VERBATIM (formatting only)
    let totalRows = '';
    for (const f of DASH_PAPER_TOTAL_FIELDS) {
      totalRows += '<tr><td>' + dashEscapeHtml(f) + '</td><td>'
        + dashFormatNumber(m[f], lang) + '</td></tr>';
    }

    // positions — unrealized ONLY when the model value is a number
    let positionRows = '';
    const positions = (m.positions != null && typeof m.positions === 'object' && !Array.isArray(m.positions))
      ? m.positions : {};
    for (const [ref, p] of Object.entries(positions)) {
      if (p == null || typeof p !== 'object' || Array.isArray(p)) {
        positionRows += '<tr><td>' + dashEscapeHtml(ref) + '</td>'
          + '<td colspan="5">' + dashUnavailableSpan(lang) + '</td></tr>';
        continue;
      }
      positionRows += '<tr><td>' + dashEscapeHtml(ref) + '</td>'
        + '<td>' + dashFormatNumber(p.candidate_realized_pnl, lang) + '</td>'
        + '<td>' + dashFormatNumber(p.candidate_fees_total, lang) + '</td>'
        + '<td>' + dashFormatNumber(p.candidate_slippage_cost, lang) + '</td>'
        + '<td>' + dashFormatNumber(p.candidate_unrealized_pnl, lang) + '</td>'
        + '<td>' + dashFormatString(p.candidate_mark_status, lang) + '</td></tr>';
    }

    // aggregates — the model's bucket numbers VERBATIM
    const aggregate = (labelKey, map) => {
      let rows = '';
      const obj = (map != null && typeof map === 'object' && !Array.isArray(map)) ? map : {};
      for (const [ref, b] of Object.entries(obj)) {
        const bucket = (b != null && typeof b === 'object' && !Array.isArray(b)) ? b : {};
        rows += '<tr><td>' + dashEscapeHtml(ref) + '</td>'
          + '<td>' + dashFormatNumber(bucket.candidate_paper_pnl, lang) + '</td>'
          + '<td>' + dashFormatNumber(bucket.candidate_fees_total, lang) + '</td>'
          + '<td>' + dashFormatNumber(bucket.candidate_slippage_cost, lang) + '</td></tr>';
      }
      if (rows === '') rows = '<tr><td colspan="4">' + dashUnavailableSpan(lang) + '</td></tr>';
      return '<h3 class="dash-subtitle">' + dashEscapeHtml(dashLabel(labelKey, lang)) + '</h3>'
        + '<table class="dash-table"><thead><tr>'
        + '<th>' + dashEscapeHtml(dashLabel('wallet', lang)) + '</th>'
        + '<th>candidate_paper_pnl</th><th>candidate_fees_total</th><th>candidate_slippage_cost</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';
    };

    const body = '<h3 class="dash-subtitle">' + dashEscapeHtml(dashLabel('totals', lang)) + '</h3>'
      + '<table class="dash-table"><tbody>' + totalRows + '</tbody></table>'
      + '<h3 class="dash-subtitle">' + dashEscapeHtml(dashLabel('positions', lang)) + '</h3>'
      + '<table class="dash-table"><thead><tr><th>position</th>'
      + '<th>candidate_realized_pnl</th><th>candidate_fees_total</th>'
      + '<th>candidate_slippage_cost</th><th>candidate_unrealized_pnl</th>'
      + '<th>candidate_mark_status</th></tr></thead><tbody>'
      + (positionRows === '' ? '<tr><td colspan="6">' + dashUnavailableSpan(lang) + '</td></tr>' : positionRows)
      + '</tbody></table>'
      + aggregate('per_wallet', m.candidate_pnl_by_wallet)
      + aggregate('per_copy_mode', m.candidate_pnl_by_copy_mode)
      + aggregate('per_brain', m.candidate_pnl_by_brain);

    return dashResult(KIND, 'DASH_RENDER_OK',
      dashPanelShell(KIND, dashEscapeHtml(dashLabel(TITLE, lang)) + dashSimulatedBadge(lang), body),
      ['paper_pnl_rendered']);
  } catch {
    return dashUnavailableResult(KIND, TITLE, null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (5) PROFITABILITY ADVISORY PANEL — advisory tokens as text; never a command
// ---------------------------------------------------------------------------

const DASH_PANEL_PROFITABILITY = 'dash_profitability_advisory_panel';

export function describeProfitabilityAdvisoryPanelContract() {
  return Object.freeze({
    contract: 'operator-dashboard-profitability-advisory-panel',
    version: '0.0.0',
    test_only: true,
    panel_kind: DASH_PANEL_PROFITABILITY,
    supported_render_states: DASH_RENDER_STATES,
    supported_langs: Object.freeze(['ar', 'en']),
    advisory_only: true,
    render_state: 'DASH_RENDER_UNAVAILABLE',
    html: '',
    reasons: Object.freeze([]),
    ...dashSafeFlags(),
    note: 'Read-only PROFITABILITY ADVISORY PANEL renderer (Stage-18). A PURE FUNCTION over { copyability_advisory: a Stage-16 (D) result recognized ONLY by read_only:true + copyability_advisory_state === COPYABILITY_ADVISORY_READ_MODEL, wallet_profitability: a Stage-16 (B) result recognized ONLY by read_only:true + profitability_state === PROFITABILITY_READ_MODEL, lang: ar|en REQUIRED } — at least one recognized model is required, else DASH_RENDER_UNAVAILABLE. Advisory tokens render as TEXT CHIPS with a permanent explicit caption in BOTH languages: "advisory only — not a command / استشاري فقط — ليس أمراً" — the panel never renders an instruction, never implies a command. profitability_win_rate / profitability_win_loss_ratio render the backend numbers verbatim; null -> unavailable; profitability_profit_factor is ALWAYS null upstream (count buckets cannot yield a money-weighted profit factor) and therefore ALWAYS renders unavailable — never faked. Simulated models (simulated:true) show the SIMULATED badge. Forbidden surface NAME / credential/endpoint VALUE / smuggled command / forbidden flag -> DASH_RENDER_REFUSED, value never echoed. Inert html; no execution authority; all 24 readiness/execution flags stay false.'
  });
}

export function renderProfitabilityAdvisoryPanel(input) {
  const KIND = DASH_PANEL_PROFITABILITY;
  const TITLE = 'title_profitability';
  try {
    const snap = dashSnapshot(input);
    if (snap === null) return dashUnavailableResult(KIND, TITLE, null, ['no_render_input']);
    const lang = dashLangOf(snap);
    if (lang === null) return dashInvalidLangResult(KIND, TITLE);

    const advC = dashConsume(snap.copyability_advisory);
    const wpC = dashConsume(snap.wallet_profitability);
    if ((!advC.ok && !advC.missing) || (!wpC.ok && !wpC.missing)) {
      return dashUnavailableResult(KIND, TITLE, lang, ['input_inspection_error']);
    }
    for (const cc of [advC, wpC]) {
      if (cc.ok) {
        const screened = dashScreenClone(cc.model);
        if (screened.length > 0) return dashRefusedResult(KIND, TITLE, lang, screened);
      }
    }

    const adv = (advC.ok
      && advC.model.read_only === true
      && advC.model.copyability_advisory_state === 'COPYABILITY_ADVISORY_READ_MODEL'
      && advC.model.profitability_advisory_by_wallet != null
      && typeof advC.model.profitability_advisory_by_wallet === 'object'
      && !Array.isArray(advC.model.profitability_advisory_by_wallet))
      ? advC.model : null;
    const wp = (wpC.ok
      && wpC.model.read_only === true
      && wpC.model.profitability_state === 'PROFITABILITY_READ_MODEL'
      && wpC.model.profitability_by_wallet != null
      && typeof wpC.model.profitability_by_wallet === 'object'
      && !Array.isArray(wpC.model.profitability_by_wallet))
      ? wpC.model : null;

    if (adv === null && wp === null) {
      return dashUnavailableResult(KIND, TITLE, lang, ['no_recognized_profitability_model']);
    }

    // permanent caption in BOTH languages — the advisory is never a command
    const caption = '<p class="dash-caption">'
      + dashEscapeHtml(DASH_TEXT.advisory_caption.en) + ' · '
      + dashEscapeHtml(DASH_TEXT.advisory_caption.ar) + '</p>';

    let advisorySection = '';
    if (adv !== null) {
      let items = '';
      for (const [ref, entry] of Object.entries(adv.profitability_advisory_by_wallet)) {
        const e = (entry != null && typeof entry === 'object' && !Array.isArray(entry)) ? entry : {};
        let why = '';
        if (Array.isArray(e.profitability_advisory_reasons)) {
          why = e.profitability_advisory_reasons
            .filter((x) => typeof x === 'string')
            .map((x) => dashEscapeHtml(x))
            .join(', ');
        }
        items += '<li>' + dashEscapeHtml(ref) + ': '
          + '<span class="dash-chip">' + dashFormatString(e.profitability_advisory, lang) + '</span>'
          + (why === '' ? '' : ' <span class="dash-caption">' + why + '</span>') + '</li>';
      }
      if (items === '') items = '<li>' + dashUnavailableSpan(lang) + '</li>';
      advisorySection = '<h3 class="dash-subtitle">' + dashEscapeHtml(dashLabel('advisory', lang)) + '</h3>'
        + '<ul class="dash-list">' + items + '</ul>';
    }

    let metricsSection = '';
    if (wp !== null) {
      let rows = '';
      for (const [ref, entry] of Object.entries(wp.profitability_by_wallet)) {
        const e = (entry != null && typeof entry === 'object' && !Array.isArray(entry)) ? entry : {};
        rows += '<tr><td>' + dashEscapeHtml(ref) + '</td>'
          + '<td>' + dashFormatNumber(e.profitability_net, lang) + '</td>'
          + '<td>' + dashFormatNumber(e.profitability_win_rate, lang) + '</td>'
          + '<td>' + dashFormatNumber(e.profitability_win_loss_ratio, lang) + '</td>'
          + '<td>' + dashFormatNumber(e.profitability_profit_factor, lang) + '</td>'
          + '<td>' + dashFormatString(e.profitability_evidence, lang) + '</td></tr>';
      }
      if (rows === '') rows = '<tr><td colspan="6">' + dashUnavailableSpan(lang) + '</td></tr>';
      metricsSection = '<table class="dash-table"><thead><tr>'
        + '<th>' + dashEscapeHtml(dashLabel('wallet', lang)) + '</th>'
        + '<th>profitability_net</th><th>profitability_win_rate</th>'
        + '<th>profitability_win_loss_ratio</th><th>profitability_profit_factor</th>'
        + '<th>profitability_evidence</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    const badge = ((adv !== null && adv.simulated === true) || (wp !== null && wp.simulated === true));
    return dashResult(KIND, 'DASH_RENDER_OK',
      dashPanelShell(KIND,
        dashEscapeHtml(dashLabel(TITLE, lang)) + (badge ? dashSimulatedBadge(lang) : ''),
        caption + advisorySection + metricsSection),
      ['profitability_advisory_rendered']);
  } catch {
    return dashUnavailableResult(KIND, TITLE, null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (6) STREAM HEALTH PANEL — exits-only-shaped advisory is ALWAYS visible
// ---------------------------------------------------------------------------

const DASH_STREAM_HEALTH_STATES = Object.freeze([
  'LIVE_STREAM_HEALTH_UNCONFIGURED', 'LIVE_STREAM_HEALTH_INVALID',
  'LIVE_STREAM_HEALTH_SYNCED', 'LIVE_STREAM_HEALTH_GAP_RECOVERABLE',
  'LIVE_STREAM_HEALTH_GAP_EXCEEDED', 'LIVE_STREAM_HEALTH_DEGRADED'
]);

const DASH_PANEL_STREAM_HEALTH = 'dash_stream_health_panel';

export function describeStreamHealthPanelContract() {
  return Object.freeze({
    contract: 'operator-dashboard-stream-health-panel',
    version: '0.0.0',
    test_only: true,
    panel_kind: DASH_PANEL_STREAM_HEALTH,
    supported_render_states: DASH_RENDER_STATES,
    supported_langs: Object.freeze(['ar', 'en']),
    consumed_stream_health_states: DASH_STREAM_HEALTH_STATES,
    advisory_only: true,
    render_state: 'DASH_RENDER_UNAVAILABLE',
    html: '',
    reasons: Object.freeze([]),
    ...dashSafeFlags(),
    note: 'Read-only STREAM HEALTH PANEL renderer (Stage-18). A PURE FUNCTION over { stream_health: a Stage-17 stream-health read-model recognized ONLY by read_only:true + stream_health_state in the consumed Stage-17 LOCAL 6-state vocabulary, readiness_checklist: a Stage-17 live-readiness checklist read-model recognized ONLY by read_only:true + live_readiness_state === LIVE_READINESS_CHECKLIST + array checklist, lang: ar|en REQUIRED } — at least one recognized model required, else DASH_RENDER_UNAVAILABLE. Renders the gap-state chip and gap_slots verbatim. When the model carries live_stream_advisory === LIVE_ADVISORY_EXITS_ONLY_SHAPED the panel renders a VISIBLE warning block — ALWAYS: any hide/collapse flag smuggled on the input is IGNORED; a safety-shaped advisory is never hidden. Checklist items render met / not met; an unknown/unverified item (reason unknown_not_verified or non-boolean met) renders "not verified" — display only, NOT trading readiness. Forbidden surface NAME / credential/endpoint VALUE / smuggled command / forbidden flag -> DASH_RENDER_REFUSED, value never echoed. Inert html; rendering grants nothing; all 24 readiness/execution flags stay false.'
  });
}

export function renderStreamHealthPanel(input) {
  const KIND = DASH_PANEL_STREAM_HEALTH;
  const TITLE = 'title_stream_health';
  try {
    const snap = dashSnapshot(input);
    if (snap === null) return dashUnavailableResult(KIND, TITLE, null, ['no_render_input']);
    const lang = dashLangOf(snap);
    if (lang === null) return dashInvalidLangResult(KIND, TITLE);

    const shC = dashConsume(snap.stream_health);
    const clC = dashConsume(snap.readiness_checklist);
    if ((!shC.ok && !shC.missing) || (!clC.ok && !clC.missing)) {
      return dashUnavailableResult(KIND, TITLE, lang, ['input_inspection_error']);
    }
    for (const cc of [shC, clC]) {
      if (cc.ok) {
        const screened = dashScreenClone(cc.model);
        if (screened.length > 0) return dashRefusedResult(KIND, TITLE, lang, screened);
      }
    }

    const sh = (shC.ok
      && shC.model.read_only === true
      && DASH_STREAM_HEALTH_STATES.includes(shC.model.stream_health_state))
      ? shC.model : null;
    const cl = (clC.ok
      && clC.model.read_only === true
      && clC.model.live_readiness_state === 'LIVE_READINESS_CHECKLIST'
      && Array.isArray(clC.model.checklist))
      ? clC.model : null;

    if (sh === null && cl === null) {
      return dashUnavailableResult(KIND, TITLE, lang, ['no_recognized_stream_model']);
    }

    let body = '';
    if (sh !== null) {
      body += '<p><span class="dash-chip">' + dashEscapeHtml(sh.stream_health_state) + '</span> '
        + dashEscapeHtml(dashLabel('gap_slots', lang)) + ': '
        + dashFormatNumber(sh.gap_slots, lang) + '</p>';
      // a safety-shaped advisory is NEVER hidden — any hide/collapse smuggle
      // on the input wrapper is deliberately ignored here.
      if (sh.live_stream_advisory === 'LIVE_ADVISORY_EXITS_ONLY_SHAPED') {
        body += '<div class="dash-warning" role="alert"><strong>'
          + dashEscapeHtml(dashLabel('warning', lang)) + ':</strong> '
          + dashEscapeHtml(sh.live_stream_advisory) + ' — '
          + dashEscapeHtml(dashLabel('exits_only_warning', lang)) + '</div>';
      }
    }
    if (cl !== null) {
      let items = '';
      for (const item of cl.checklist) {
        const it = (item != null && typeof item === 'object' && !Array.isArray(item)) ? item : {};
        let statusKey;
        if (it.met === true) statusKey = 'met';
        else if (it.met === false && it.reason === 'unknown_not_verified') statusKey = 'not_verified';
        else if (it.met === false) statusKey = 'not_met';
        else statusKey = 'not_verified';
        items += '<li>' + dashFormatString(it.item, lang) + ': '
          + dashEscapeHtml(dashLabel(statusKey, lang)) + '</li>';
      }
      if (items === '') items = '<li>' + dashUnavailableSpan(lang) + '</li>';
      body += '<h3 class="dash-subtitle">' + dashEscapeHtml(dashLabel('checklist', lang)) + '</h3>'
        + '<ul class="dash-list">' + items + '</ul>'
        + '<p>' + dashEscapeHtml(dashLabel('all_met', lang)) + ': '
        + dashEscapeHtml(dashLabel(cl.all_met === true ? 'yes' : 'no', lang)) + '</p>';
    }

    return dashResult(KIND, 'DASH_RENDER_OK',
      dashPanelShell(KIND, dashEscapeHtml(dashLabel(TITLE, lang)), body),
      ['stream_health_rendered']);
  } catch {
    return dashUnavailableResult(KIND, TITLE, null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (7) SECURITY NOTICES PANEL — security/critical can NEVER be hidden
// ---------------------------------------------------------------------------

const DASH_NOTICE_SEVERITIES = Object.freeze(['info', 'warning', 'critical', 'security']);

const DASH_PANEL_SECURITY_NOTICES = 'dash_security_notices_panel';

export function describeSecurityNoticesPanelContract() {
  return Object.freeze({
    contract: 'operator-dashboard-security-notices-panel',
    version: '0.0.0',
    test_only: true,
    panel_kind: DASH_PANEL_SECURITY_NOTICES,
    supported_render_states: DASH_RENDER_STATES,
    supported_langs: Object.freeze(['ar', 'en']),
    supported_severities: DASH_NOTICE_SEVERITIES,
    advisory_only: true,
    render_state: 'DASH_RENDER_UNAVAILABLE',
    html: '',
    reasons: Object.freeze([]),
    ...dashSafeFlags(),
    note: 'Read-only SECURITY NOTICES PANEL renderer (Stage-18). A PURE FUNCTION over { notices: [{ severity: info|warning|critical|security, text_en, text_ar, hide? }], lang: ar|en REQUIRED }. SECURITY AND CRITICAL NOTICES ARE ALWAYS RENDERED FULLY VISIBLE: a hide/collapse flag — smuggled on the wrapper input OR on the notice itself — is IGNORED for severity critical/security (and warning); only an info notice may collapse, and even then it stays IN the document inside a pure <details>/<summary> toggle (never removed, no handler, no script). An unknown/missing severity is fail-safe treated as critical (never hidden). Notice text renders in the requested lang with fallback to the other language, escaped; missing text renders unavailable — never invented. Forbidden surface NAME / credential/endpoint VALUE / smuggled command / forbidden flag in any notice -> DASH_RENDER_REFUSED, value never echoed. Inert html; rendering grants nothing; all 24 readiness/execution flags stay false.'
  });
}

export function renderSecurityNoticesPanel(input) {
  const KIND = DASH_PANEL_SECURITY_NOTICES;
  const TITLE = 'title_security_notices';
  try {
    const snap = dashSnapshot(input);
    if (snap === null) return dashUnavailableResult(KIND, TITLE, null, ['no_render_input']);
    const lang = dashLangOf(snap);
    if (lang === null) return dashInvalidLangResult(KIND, TITLE);

    const c = dashConsumeArray(snap.notices);
    if (c.missing) return dashUnavailableResult(KIND, TITLE, lang, ['notices_missing']);
    if (!c.ok) return dashUnavailableResult(KIND, TITLE, lang, ['input_inspection_error']);
    const notices = c.list;

    const screened = dashScreenClone(notices);
    if (screened.length > 0) return dashRefusedResult(KIND, TITLE, lang, screened);

    const reasons = ['security_notices_rendered'];
    let body = '';
    if (notices.length === 0) {
      body = '<p class="dash-caption">' + dashEscapeHtml(dashLabel('no_notices', lang)) + '</p>';
    }
    for (const raw of notices) {
      const n = (raw != null && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      let severity = n.severity;
      if (!DASH_NOTICE_SEVERITIES.includes(severity)) {
        // fail-safe: an unknown severity can never be the quiet one
        severity = 'critical';
        if (!reasons.includes('unknown_severity_treated_as_critical')) {
          reasons.push('unknown_severity_treated_as_critical');
        }
      }
      const primary = (lang === 'ar') ? n.text_ar : n.text_en;
      const fallback = (lang === 'ar') ? n.text_en : n.text_ar;
      const text = (typeof primary === 'string' && primary.length > 0)
        ? dashEscapeHtml(primary)
        : ((typeof fallback === 'string' && fallback.length > 0)
          ? dashEscapeHtml(fallback) : dashUnavailableSpan(lang));
      const sevTag = '<span class="dash-chip">' + dashEscapeHtml(severity) + '</span> ';

      const hideRequested = (snap.hide === true) || (n.hide === true)
        || (n.hidden === true) || (n.collapsed === true);
      if (severity === 'critical' || severity === 'security' || severity === 'warning') {
        // ALWAYS visible — the hide request is ignored on purpose
        const cls = (severity === 'warning') ? 'dash-warning' : 'dash-notice-critical';
        body += '<div class="' + cls + '" role="alert">' + sevTag + text + '</div>';
      } else if (hideRequested) {
        // info may collapse — but it stays in the document, pure HTML toggle
        body += '<details class="dash-notice-info"><summary>' + sevTag
          + dashEscapeHtml(severity) + '</summary><p>' + text + '</p></details>';
      } else {
        body += '<div class="dash-notice-info">' + sevTag + text + '</div>';
      }
    }

    return dashResult(KIND, 'DASH_RENDER_OK',
      dashPanelShell(KIND, dashEscapeHtml(dashLabel(TITLE, lang)), body), reasons);
  } catch {
    return dashUnavailableResult(KIND, TITLE, null, ['input_inspection_error']);
  }
}

// ---------------------------------------------------------------------------
// (8) OPERATOR DASHBOARD ASSEMBLER — static, inert, self-contained document
// ---------------------------------------------------------------------------

const DASH_PANEL_DASHBOARD = 'dash_operator_dashboard';

// forbidden interactive / external markup inside any composed panel html.
// Built from plain strings so the words never appear as bare code tokens.
const DASH_FORBIDDEN_MARKUP_RE = new RegExp([
  '<script\\b', '<form\\b', '<button\\b', '<input\\b', '<textarea\\b',
  '<select\\b', '<iframe\\b', '<object\\b', '<embed\\b', '<img\\b', '<link\\b',
  '<meta\\s+http', '<a\\s', 'javascript:', 'fetch\\s*\\(', 'xmlhttprequest',
  'websocket', '\\bsrc\\s*='
].join('|'), 'i');

// minimal inline CSS — design-token-named custom properties only (visual
// tokens in the spirit of docs/12-DESIGN-SYSTEM.md; presentation only).
const DASH_STYLE = ':root{'
  + '--dash-color-bg:#10141b;--dash-color-surface:#1a2029;--dash-color-text:#e8ebf0;'
  + '--dash-color-neutral:#8a93a3;--dash-color-critical:#e5484d;--dash-color-warning:#f5a524;'
  + '--dash-color-info:#3b82d4;--dash-color-success:#30a46c;--dash-color-simulated:#9a6dd7;'
  + '--dash-color-readonly:#5aa7a7;'
  + '--dash-space-1:4px;--dash-space-2:8px;--dash-space-3:16px;'
  + '--dash-radius-1:6px;'
  + '--dash-font-body:system-ui,sans-serif;--dash-font-mono:ui-monospace,monospace'
  + '}'
  + 'body{background:var(--dash-color-bg);color:var(--dash-color-text);font-family:var(--dash-font-body);margin:var(--dash-space-3)}'
  + '.dash-panel{background:var(--dash-color-surface);border-radius:var(--dash-radius-1);padding:var(--dash-space-3);margin-bottom:var(--dash-space-3)}'
  + '.dash-panel-title{font-size:1rem;margin:0 0 var(--dash-space-2)}'
  + '.dash-subtitle{font-size:.9rem;margin:var(--dash-space-2) 0 var(--dash-space-1)}'
  + '.dash-table{border-collapse:collapse;width:100%}'
  + '.dash-table th,.dash-table td{border-bottom:1px solid var(--dash-color-neutral);padding:var(--dash-space-1) var(--dash-space-2);text-align:start;font-variant-numeric:tabular-nums}'
  + '.dash-chip{display:inline-block;border:1px solid var(--dash-color-neutral);border-radius:var(--dash-radius-1);padding:0 var(--dash-space-2);font-family:var(--dash-font-mono)}'
  + '.dash-badge-simulated{display:inline-block;background:var(--dash-color-simulated);color:var(--dash-color-bg);border-radius:var(--dash-radius-1);padding:0 var(--dash-space-2);font-weight:700}'
  + '.dash-badge-readonly{display:inline-block;border:1px solid var(--dash-color-readonly);color:var(--dash-color-readonly);border-radius:var(--dash-radius-1);padding:0 var(--dash-space-2)}'
  + '.dash-warning{border:1px solid var(--dash-color-warning);color:var(--dash-color-warning);padding:var(--dash-space-2);border-radius:var(--dash-radius-1);margin:var(--dash-space-2) 0}'
  + '.dash-notice-critical{border:1px solid var(--dash-color-critical);color:var(--dash-color-critical);padding:var(--dash-space-2);border-radius:var(--dash-radius-1);margin:var(--dash-space-2) 0}'
  + '.dash-notice-info{border:1px solid var(--dash-color-info);padding:var(--dash-space-2);border-radius:var(--dash-radius-1);margin:var(--dash-space-2) 0}'
  + '.dash-unavailable{color:var(--dash-color-neutral)}'
  + '.dash-refused{color:var(--dash-color-critical)}'
  + '.dash-caption{color:var(--dash-color-neutral);font-size:.85rem}'
  + '.dash-list{margin:var(--dash-space-1) 0;padding-inline-start:var(--dash-space-3)}'
  + '.dash-footer{color:var(--dash-color-readonly);border-top:1px solid var(--dash-color-neutral);margin-top:var(--dash-space-3);padding-top:var(--dash-space-2)}';

function dashDocument(lang, titleHtml, mainHtml) {
  const dir = (lang === 'ar') ? 'rtl' : 'ltr';
  const langAttr = (lang === 'ar') ? 'ar' : 'en';
  const footer = dashEscapeHtml(DASH_TEXT.footer.en) + ' · ' + dashEscapeHtml(DASH_TEXT.footer.ar);
  return '<!DOCTYPE html>'
    + '<html lang="' + langAttr + '" dir="' + dir + '">'
    + '<head><meta charset="utf-8"><title>' + titleHtml + '</title>'
    + '<style>' + DASH_STYLE + '</style></head>'
    + '<body><header class="dash-header"><h1>' + titleHtml + '</h1> '
    + '<span class="dash-badge-readonly">'
    + dashEscapeHtml(DASH_TEXT.read_only_badge.en) + ' · ' + dashEscapeHtml(DASH_TEXT.read_only_badge.ar)
    + '</span></header>'
    + '<main>' + mainHtml + '</main>'
    + '<footer class="dash-footer">' + footer + '</footer>'
    + '</body></html>';
}

// a recognized render result: frozen, read-only, html string, LOCAL state,
// frozen-able reasons array — anything else is refused fail-closed.
function dashRecognizeRenderResult(p) {
  if (p == null || typeof p !== 'object' || Array.isArray(p)) return false;
  try {
    if (!Object.isFrozen(p)) return false;
    if (p.read_only !== true) return false;
    if (typeof p.html !== 'string') return false;
    if (!DASH_RENDER_STATES.includes(p.render_state)) return false;
    if (!Array.isArray(p.reasons)) return false;
    for (const f of DASH_FORBIDDEN_TRUE_FLAGS) {
      if (p[f] === true) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function describeOperatorDashboardContract() {
  return Object.freeze({
    contract: 'operator-dashboard-assembler',
    version: '0.0.0',
    test_only: true,
    panel_kind: DASH_PANEL_DASHBOARD,
    supported_render_states: DASH_RENDER_STATES,
    supported_langs: Object.freeze(['ar', 'en']),
    advisory_only: true,
    render_state: 'DASH_RENDER_UNAVAILABLE',
    html: '',
    reasons: Object.freeze([]),
    ...dashSafeFlags(),
    note: 'Read-only OPERATOR DASHBOARD ASSEMBLER (Stage-18). A PURE FUNCTION over { panels: [render results produced by the Stage-18 panel renderers], lang: ar|en REQUIRED, title_ref?: display string (escaped; refused when endpoint/credential-shaped) }. Composes ONE full static, self-contained, INERT HTML document: inline minimal CSS using design-token-named custom properties only (visual tokens; presentation only), dir=rtl for ar / dir=ltr for en, a fixed READ-ONLY footer line in BOTH languages ("READ-ONLY OPERATOR VIEW — no commands / عرض المشغّل للقراءة فقط — لا أوامر"). The assembler REFUSES (DASH_RENDER_REFUSED) any panel that is not a recognized FROZEN render result (frozen + read_only:true + string html + LOCAL render_state + reasons array + no forbidden true flag) and any panel html carrying interactive/external markup (script/form/button/input/iframe/img/link/anchor/external src/javascript:/fetch). The assembled page contains NO form, NO button, NO input, NO script, NO external resource, NO fetch, NO event handler — it cannot issue a command. panels missing/not an array -> DASH_RENDER_UNAVAILABLE. Hostile input -> frozen error document, never throws. Assembly grants NOTHING; all 24 readiness/execution flags stay false.'
  });
}

export function assembleOperatorDashboard(input) {
  const KIND = DASH_PANEL_DASHBOARD;
  const errorDoc = (lang, labelKey) => dashDocument(lang,
    dashEscapeHtml(dashLabel('title_dashboard', lang)),
    '<section class="dash-panel"><p class="dash-refused">'
    + dashEscapeHtml(dashLabel(labelKey, lang)) + '</p></section>');
  try {
    const snap = dashSnapshot(input);
    if (snap === null) {
      return dashResult(KIND, 'DASH_RENDER_UNAVAILABLE', errorDoc(null, 'unavailable'), ['no_render_input']);
    }
    const lang = dashLangOf(snap);
    if (lang === null) {
      return dashResult(KIND, 'DASH_RENDER_INVALID', errorDoc(null, 'lang_invalid'), ['lang_invalid']);
    }

    // title_ref: display-only, escaped; an endpoint/credential-shaped value is
    // refused and never echoed.
    let titleHtml = dashEscapeHtml(dashLabel('title_dashboard', lang));
    const titleRef = snap.title_ref;
    if (titleRef !== undefined && titleRef !== null) {
      if (typeof titleRef !== 'string') {
        return dashResult(KIND, 'DASH_RENDER_INVALID', errorDoc(lang, 'unavailable'), ['title_ref_invalid']);
      }
      if (DASH_URL_VALUE_RE.test(titleRef) || DASH_PEM_RE.test(titleRef) || DASH_BASE58_BLOB_RE.test(titleRef)) {
        return dashResult(KIND, 'DASH_RENDER_REFUSED', errorDoc(lang, 'refused'), ['forbidden_value_blocked']);
      }
      titleHtml = dashEscapeHtml(titleRef);
    }

    const rawPanels = snap.panels;
    if (!Array.isArray(rawPanels)) {
      return dashResult(KIND, 'DASH_RENDER_UNAVAILABLE', errorDoc(lang, 'unavailable'), ['panels_missing']);
    }
    const panels = [...rawPanels];

    let mainHtml = '';
    for (const p of panels) {
      if (!dashRecognizeRenderResult(p)) {
        return dashResult(KIND, 'DASH_RENDER_REFUSED', errorDoc(lang, 'refused'), ['panel_not_render_result']);
      }
      if (DASH_FORBIDDEN_MARKUP_RE.test(p.html)) {
        return dashResult(KIND, 'DASH_RENDER_REFUSED', errorDoc(lang, 'refused'), ['panel_html_forbidden_markup']);
      }
      mainHtml += p.html;
    }
    if (mainHtml === '') {
      mainHtml = '<section class="dash-panel"><p class="dash-unavailable">'
        + dashEscapeHtml(dashLabel('unavailable', lang)) + '</p></section>';
    }

    return dashResult(KIND, 'DASH_RENDER_OK',
      dashDocument(lang, titleHtml, mainHtml), ['dashboard_assembled']);
  } catch {
    return dashResult(KIND, 'DASH_RENDER_UNAVAILABLE', errorDoc(null, 'unavailable'), ['input_inspection_error']);
  }
}
