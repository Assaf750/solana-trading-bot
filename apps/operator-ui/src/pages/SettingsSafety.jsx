import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const HARD_RISK_FIELDS = [
  { field: 'max_daily_loss_pct', unit: '%' },
  { field: 'max_daily_loss_usdt', unit: 'USDT' },
  { field: 'max_total_drawdown_pct', unit: '%' },
  { field: 'max_open_positions', unit: '' },
  { field: 'max_position_size_pct', unit: '%' },
  { field: 'max_token_exposure_pct', unit: '%' },
  { field: 'max_creator_exposure_pct', unit: '%' },
  { field: 'max_cluster_exposure_pct', unit: '%' },
  { field: 'max_correlated_meme_exposure_pct', unit: '%' },
];

// One-click strategy profiles — populate the copy-defaults + EV gate, the operator
// reviews then Saves. Presets never touch Hard-Risk limits (those stay owner-owned).
const PRESETS = [
  {
    key: 'conservative', ico: '🛡', label: { en: 'Conservative', ar: 'محافظ' },
    desc: { en: 'Tight stops, strict EV, fast auto-pause. Capital preservation first.', ar: 'وقف ضيّق، EV صارم، إيقاف سريع. حماية رأس المال أولاً.' },
    mode: 'strict',
    copy: { take_profit_pct: 40, stop_loss_pct: 15, trailing_stop_pct: 12, max_entry_slippage_vs_leader: 1.5, min_mirror_sell_pct: 50, max_entry_drift_pct: 3, drift_action: 'skip', exit_on_leader_sell: true, auto_pause_after_losses: 2 },
    ev: { minimum_sample_size: 20, minimum_profit_factor: 1.5, minimum_exit_success_rate: 0.55, minimum_net_expectancy: 0, max_expected_drawdown_pct: 25 },
  },
  {
    key: 'balanced', ico: '⚖', label: { en: 'Balanced', ar: 'متوازن' },
    desc: { en: 'The default copy-trading profile — moderate targets, shrink on drift.', ar: 'ملف النسخ الافتراضي — أهداف معتدلة، تقليص عند الانحراف.' },
    mode: 'strict',
    copy: { take_profit_pct: 80, stop_loss_pct: 25, trailing_stop_pct: 25, max_entry_slippage_vs_leader: 2.5, min_mirror_sell_pct: 40, max_entry_drift_pct: 5, drift_action: 'shrink', exit_on_leader_sell: true, auto_pause_after_losses: 3 },
    ev: { minimum_sample_size: 15, minimum_profit_factor: 1.2, minimum_exit_success_rate: 0.5, minimum_net_expectancy: 0, max_expected_drawdown_pct: 35 },
  },
  {
    key: 'aggressive', ico: '🔥', label: { en: 'Aggressive', ar: 'هجومي' },
    desc: { en: 'Wide targets, warn-only EV, more tolerance for drift and losses.', ar: 'أهداف واسعة، EV تنبيه فقط، تحمّل أعلى للانحراف والخسائر.' },
    mode: 'warning_only',
    copy: { take_profit_pct: 150, stop_loss_pct: 35, trailing_stop_pct: 40, max_entry_slippage_vs_leader: 4, min_mirror_sell_pct: 30, max_entry_drift_pct: 8, drift_action: 'shrink', exit_on_leader_sell: false, auto_pause_after_losses: 5 },
    ev: { minimum_sample_size: 10, minimum_profit_factor: 1.0, minimum_exit_success_rate: 0.45, minimum_net_expectancy: 0, max_expected_drawdown_pct: 50 },
  },
];

export default function SettingsSafety() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected, refresh } = useBackend();
  const [tab, setTab] = useState('strategy');
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [capital, setCapital] = useState('');
  const [evMode, setEvMode] = useState('strict');
  const [ev, setEv] = useState({});
  const [safety, setSafety] = useState({});
  const [copyDef, setCopyDef] = useState({});
  const [exec, setExec] = useState({});
  const [activePreset, setActivePreset] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);
  const [confirmLive, setConfirmLive] = useState('');
  const [liveResult, setLiveResult] = useState(null);

  async function loadConfig() {
    const r = await api.config();
    if (r.ok) {
      setCfg(r.data);
      const f = {};
      for (const { field } of HARD_RISK_FIELDS) f[field] = r.data.hard_risk?.[field] ?? '';
      setForm(f);
      setCapital(r.data.execution?.capital_limit ?? '');
      setEvMode(r.data.ev?.ev_gate_mode || 'strict');
      const d = r.data;
      const g = (o, k) => (o?.[k] ?? '');
      setEv({
        minimum_net_expectancy: g(d.ev, 'minimum_net_expectancy'), minimum_profit_factor: g(d.ev, 'minimum_profit_factor'),
        minimum_lower_confidence_bound: g(d.ev, 'minimum_lower_confidence_bound'), minimum_sample_size: g(d.ev, 'minimum_sample_size'),
        minimum_exit_success_rate: g(d.ev, 'minimum_exit_success_rate'), max_expected_drawdown_pct: g(d.ev, 'max_expected_drawdown_pct'),
      });
      setSafety({
        enabled: d.safety?.enabled !== false, require_mint_revoked: d.safety?.require_mint_revoked !== false,
        require_freeze_revoked: d.safety?.require_freeze_revoked !== false, block_permanent_delegate: d.safety?.block_permanent_delegate !== false,
      });
      setCopyDef({
        take_profit_pct: g(d.copy_defaults, 'take_profit_pct'), stop_loss_pct: g(d.copy_defaults, 'stop_loss_pct'),
        max_entry_slippage_vs_leader: g(d.copy_defaults, 'max_entry_slippage_vs_leader'), min_mirror_sell_pct: g(d.copy_defaults, 'min_mirror_sell_pct'),
        max_entry_drift_pct: g(d.copy_defaults, 'max_entry_drift_pct'), drift_action: d.copy_defaults?.drift_action || 'skip',
        exit_on_leader_sell: Boolean(d.copy_defaults?.exit_on_leader_sell), auto_pause_after_losses: g(d.copy_defaults, 'auto_pause_after_losses'),
        trailing_stop_pct: g(d.copy_defaults, 'trailing_stop_pct'),
      });
      setExec({
        signer_backend: d.execution?.signer_backend || 'node', submit_backend: d.execution?.submit_backend || 'rpc',
        jito_tip_account: d.execution?.jito_tip_account ?? '', jito_tip_lamports: g(d.execution, 'jito_tip_lamports'),
        sizing_mode: d.execution?.sizing_mode || 'fixed_usd', sizing_value: g(d.execution, 'sizing_value'),
      });
      setActivePreset(null);
    }
  }
  useEffect(() => { if (connected) loadConfig(); }, [connected]);

  function applyPreset(p) {
    setCopyDef((prev) => ({ ...prev, ...p.copy }));
    setEvMode(p.mode);
    setEv((prev) => ({ ...prev, ...p.ev }));
    setActivePreset(p.key);
    setSaveMsg({ tone: 'warn', text: ar ? `طُبِّق ملف «${p.label.ar}» على الحقول — راجِع ثم احفظ` : `Applied “${p.label.en}” to the fields — review, then Save` });
  }

  async function save() {
    setSaveMsg(null);
    const hard_risk = {};
    for (const { field } of HARD_RISK_FIELDS) {
      const v = form[field];
      hard_risk[field] = v === '' || v === null ? null : Number(v);
    }
    const numOrNull = (v) => (v === '' || v === null ? null : Number(v));
    const patch = {
      hard_risk,
      ev: {
        ev_gate_mode: evMode,
        minimum_net_expectancy: numOrNull(ev.minimum_net_expectancy), minimum_profit_factor: numOrNull(ev.minimum_profit_factor),
        minimum_lower_confidence_bound: numOrNull(ev.minimum_lower_confidence_bound), minimum_sample_size: numOrNull(ev.minimum_sample_size),
        minimum_exit_success_rate: numOrNull(ev.minimum_exit_success_rate), max_expected_drawdown_pct: numOrNull(ev.max_expected_drawdown_pct),
      },
      safety: {
        enabled: !!safety.enabled, require_mint_revoked: !!safety.require_mint_revoked,
        require_freeze_revoked: !!safety.require_freeze_revoked, block_permanent_delegate: !!safety.block_permanent_delegate,
      },
      copy_defaults: {
        take_profit_pct: numOrNull(copyDef.take_profit_pct), stop_loss_pct: numOrNull(copyDef.stop_loss_pct),
        max_entry_slippage_vs_leader: numOrNull(copyDef.max_entry_slippage_vs_leader), min_mirror_sell_pct: numOrNull(copyDef.min_mirror_sell_pct),
        max_entry_drift_pct: numOrNull(copyDef.max_entry_drift_pct), drift_action: copyDef.drift_action || 'skip',
        exit_on_leader_sell: !!copyDef.exit_on_leader_sell, auto_pause_after_losses: numOrNull(copyDef.auto_pause_after_losses),
        trailing_stop_pct: numOrNull(copyDef.trailing_stop_pct),
      },
      execution: {
        capital_limit: capital === '' ? null : Number(capital),
        signer_backend: exec.signer_backend || 'node', submit_backend: exec.submit_backend || 'rpc',
        jito_tip_account: exec.jito_tip_account === '' ? null : exec.jito_tip_account, jito_tip_lamports: numOrNull(exec.jito_tip_lamports),
        sizing_mode: exec.sizing_mode || 'fixed_usd', sizing_value: numOrNull(exec.sizing_value),
      },
    };
    const r = await api.updateConfig(patch);
    if (r.ok) {
      setSaveMsg({ tone: 'ok', text: ar ? `تم الحفظ ✓ (نسخة الإعدادات ${r.data.config_version})` : `Saved ✓ (config_version ${r.data.config_version})` });
      await loadConfig();
      refresh();
    } else {
      const errs = (r.data?.errors || []).map((e) => `${e.field}: ${e.error}`).join(' · ');
      setSaveMsg({ tone: 'danger', text: (ar ? 'رفض الحفظ — ' : 'Save rejected — ') + (errs || r.data?.api_error_code || '') });
    }
  }

  async function tryActivate() {
    const r = await api.activateRealLive(confirmLive);
    setLiveResult(r.data);
    refresh();
  }

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('settings.title')} sub={t('settings.sub')} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat ثم أعد تحميل الصفحة' : 'Server offline — run START.bat, then reload'} />
      </div>
    );
  }

  const readiness = status?.readiness;
  const missing = HARD_RISK_FIELDS.filter(({ field }) => form[field] === '' || form[field] === null);
  const complete = missing.length === 0;
  const blockerN = readiness?.blockers?.length ?? 0;

  const TABS = [
    { key: 'strategy', ico: '🎯', label: { en: 'Strategy & copy', ar: 'الاستراتيجية والنسخ' } },
    { key: 'risk', ico: '🛡', label: { en: 'Risk & EV', ar: 'المخاطر و EV' }, badge: complete ? null : 'danger' },
    { key: 'execution', ico: '⚡', label: { en: 'Execution', ar: 'التنفيذ' } },
    { key: 'activation', ico: '🔴', label: { en: 'Real-live', ar: 'التفعيل الحقيقي' }, badge: blockerN ? 'warn' : 'ok' },
  ];

  const evFields = [
    ['minimum_sample_size', ar ? 'أدنى عدد صفقات' : 'Min sample size'],
    ['minimum_profit_factor', ar ? 'أدنى عامل ربح' : 'Min profit factor'],
    ['minimum_exit_success_rate', ar ? 'أدنى نسبة نجاح (0–1)' : 'Min exit success (0–1)'],
    ['minimum_net_expectancy', ar ? 'أدنى توقّع صافٍ' : 'Min net expectancy'],
    ['minimum_lower_confidence_bound', ar ? 'أدنى حدّ ثقة' : 'Min lower conf. bound'],
    ['max_expected_drawdown_pct', ar ? 'أقصى تراجع متوقّع %' : 'Max expected drawdown %'],
  ];
  const copyFields = [
    ['take_profit_pct', ar ? 'جني الربح %' : 'Take-profit %'],
    ['stop_loss_pct', ar ? 'وقف الخسارة %' : 'Stop-loss %'],
    ['trailing_stop_pct', ar ? 'وقف متحرك %' : 'Trailing stop %'],
    ['max_entry_slippage_vs_leader', ar ? 'انزلاق الدخول %' : 'Entry slippage %'],
    ['min_mirror_sell_pct', ar ? 'أدنى بيع مرآة %' : 'Min mirror sell %'],
    ['max_entry_drift_pct', ar ? 'حدّ انحراف الدخول %' : 'Max entry drift %'],
    ['auto_pause_after_losses', ar ? 'إيقاف بعد N خسائر' : 'Auto-pause after N losses'],
  ];

  return (
    <div className="stack">
      <PageHead title={t('settings.title')} sub={t('settings.sub')} />

      <div className="settings-tabs" role="tablist">
        {TABS.map((tb) => (
          <button key={tb.key} role="tab" aria-selected={tab === tb.key} className={tab === tb.key ? 'on' : ''} onClick={() => setTab(tb.key)}>
            <span className="st-ico" aria-hidden>{tb.ico}</span>
            {ar ? tb.label.ar : tb.label.en}
            {tb.badge && <span className={`led ${tb.badge}`} style={{ marginInlineStart: 2 }} />}
          </button>
        ))}
      </div>

      {tab === 'strategy' && (
        <>
          <Card
            title={ar ? 'ملفات الاستراتيجية الجاهزة' : 'Strategy presets'}
            sub={ar ? 'انقر ملفاً لملء حقول النسخ و EV — ثم راجِع واحفظ. لا يمسّ حدود المخاطر.' : 'Click a profile to fill the copy + EV fields — then review and Save. Hard-risk limits are untouched.'}
          >
            <div className="preset-grid">
              {PRESETS.map((p) => (
                <button key={p.key} className={`preset-card ${activePreset === p.key ? 'on' : ''}`} onClick={() => applyPreset(p)}>
                  <div className="pc-top"><span className="pc-ico" aria-hidden>{p.ico}</span>{ar ? p.label.ar : p.label.en}</div>
                  <div className="pc-desc">{ar ? p.desc.ar : p.desc.en}</div>
                  <div className="pc-stat">
                    <span>TP {p.copy.take_profit_pct}%</span>
                    <span>SL {p.copy.stop_loss_pct}%</span>
                    <span>EV {p.mode === 'strict' ? 'strict' : 'warn'}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card title={ar ? 'افتراضات النسخ العامة' : 'Global copy defaults'} sub={ar ? 'تُستخدم ما لم تُستبدل لكل محفظة.' : 'Used unless overridden per-wallet.'}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)' }}>
              {copyFields.map(([k, label]) => (
                <label key={k} className="stack" style={{ gap: 4 }}>
                  <span className="muted fs-xs">{label}</span>
                  <input className="search" type="number" inputMode="decimal" step="any" dir="ltr" placeholder={ar ? 'فارغ = افتراضي' : 'empty = default'} value={copyDef[k] ?? ''} onChange={(e) => { setActivePreset(null); setCopyDef({ ...copyDef, [k]: e.target.value }); }} />
                </label>
              ))}
              <label className="stack" style={{ gap: 4 }}>
                <span className="muted fs-xs">{ar ? 'إجراء الانحراف' : 'Drift action'}</span>
                <select className="search" dir="ltr" value={copyDef.drift_action || 'skip'} onChange={(e) => setCopyDef({ ...copyDef, drift_action: e.target.value })}>
                  <option value="skip">skip</option><option value="shrink">shrink</option>
                </select>
              </label>
              <label className="row" style={{ gap: 8, alignSelf: 'end' }}>
                <input type="checkbox" checked={!!copyDef.exit_on_leader_sell} onChange={(e) => setCopyDef({ ...copyDef, exit_on_leader_sell: e.target.checked })} />
                <span className="fs-xs">{ar ? 'خروج عند بيع القائد' : 'Exit on leader sell'}</span>
              </label>
            </div>
          </Card>

          <Card title={t('settings.evGate')}>
            <div className="row">
              <span className="muted">ev_gate_mode:</span>
              <div className="seg" role="group">
                <button className={evMode === 'strict' ? 'on' : ''} onClick={() => setEvMode('strict')}>strict</button>
                <button className={evMode === 'warning_only' ? 'on' : ''} onClick={() => setEvMode('warning_only')}>warning_only</button>
              </div>
            </div>
            <p className="muted fs-sm">
              {ar ? 'warning_only لا يُرخي أبداً أي حد Hard-Risk ولا مفتاح الإيقاف.' : 'warning_only never relaxes a Hard-Risk limit or a kill switch.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)', marginBlockStart: 'var(--s-2)' }}>
              {evFields.map(([k, label]) => (
                <label key={k} className="stack" style={{ gap: 4 }}>
                  <span className="muted fs-xs">{label}</span>
                  <input className="search" type="number" inputMode="decimal" step="any" dir="ltr" value={ev[k] ?? ''} onChange={(e) => { setActivePreset(null); setEv({ ...ev, [k]: e.target.value }); }} />
                </label>
              ))}
            </div>
            <p className="faint fs-xs" style={{ marginBlockStart: 6 }}>
              {ar ? 'تُطبَّق على أداء كل قائد بعد بلوغ «أدنى عدد صفقات». غير المنفَّذ بعد: lower-confidence و expected-drawdown.' : 'Applied per-leader once min sample is reached. Not yet enforced: lower-confidence & expected-drawdown.'}
            </p>
          </Card>
        </>
      )}

      {tab === 'risk' && (
        <>
          <DangerNote tone="warn" locked>{t('settings.hardRiskNote')}</DangerNote>

          <Card
            title={t('settings.hardRisk')}
            sub={ar ? 'هذه الحدود ملزمة دائماً. كل الحقول التسعة مطلوبة بقيم منتهية — لا لانهائية ضمنية.' : 'Always binding. All nine fields required with finite values — no implicit infinity.'}
            right={<Badge tone={complete ? 'ok' : 'danger'}>{t('settings.completeness')}: {complete ? t('settings.complete') : t('settings.incomplete')}</Badge>}
          >
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th className="nosort">field</th>
                    <th className="nosort">{t('common.value')}</th>
                    <th className="nosort">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {HARD_RISK_FIELDS.map(({ field, unit }) => {
                    const v = form[field];
                    const isMissing = v === '' || v === null || v === undefined;
                    return (
                      <tr key={field}>
                        <td className="mono">{field}</td>
                        <td className="num">
                          <input
                            className="search" type="number" inputMode="decimal" step="any"
                            style={{ width: 130 }}
                            value={v ?? ''}
                            placeholder={ar ? 'غير محدد' : 'unset'}
                            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                          />
                          <span className="muted" style={{ marginInlineStart: 6 }}>{unit}</span>
                        </td>
                        <td>
                          {isMissing
                            ? <Badge tone="danger">{t('settings.limitMissing')}</Badge>
                            : <Badge tone="ok">set</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid cols-2">
            <Card title={ar ? 'رأس المال' : 'Capital'}>
              <div className="row">
                <span className="muted mono">capital_limit:</span>
                <input
                  className="search" type="number" inputMode="decimal" step="any" style={{ width: 140 }}
                  value={capital} placeholder={ar ? 'مطلوب للتشغيل الحقيقي' : 'required for REAL-LIVE'}
                  onChange={(e) => setCapital(e.target.value)}
                />
                <span className="muted">USD</span>
              </div>
              <p className="muted fs-sm">
                {ar ? 'سقف رأس المال الذي يُسمح للمحرك بالتصرف فيه. يجب أن يكون رقماً منتهياً أكبر من صفر.' : 'The cap the engine may operate with. Must be finite and > 0.'}
              </p>
            </Card>

            <Card title={ar ? 'فحص أمان العملة (anti-rug)' : 'Token safety (anti-rug)'} sub={ar ? 'يُرفض الدخول إن فشل الفحص (fail-closed).' : 'Entry is rejected if a check fails (fail-closed).'}>
              {[
                ['enabled', ar ? 'تفعيل الفحص' : 'Enabled'],
                ['require_mint_revoked', ar ? 'صلاحية السكّ مُلغاة' : 'Mint authority revoked'],
                ['require_freeze_revoked', ar ? 'صلاحية التجميد مُلغاة' : 'Freeze authority revoked'],
                ['block_permanent_delegate', ar ? 'حظر PermanentDelegate (Token-2022)' : 'Block PermanentDelegate (Token-2022)'],
              ].map(([k, label]) => (
                <label key={k} className="row" style={{ gap: 8, marginBlockEnd: 6 }}>
                  <input type="checkbox" checked={!!safety[k]} onChange={(e) => setSafety({ ...safety, [k]: e.target.checked })} />
                  <span className="fs-sm">{label}</span>
                </label>
              ))}
            </Card>
          </div>
        </>
      )}

      {tab === 'execution' && (
        <Card title={ar ? 'التنفيذ (متقدم)' : 'Execution (advanced)'} sub={ar ? 'موقّع/إرسال المسار الحيّ. Rust/Jito يتراجعان آمناً.' : 'Live-path signer/submit. Rust/Jito fail safe to in-process/RPC.'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)' }}>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted fs-xs">signer_backend</span>
              <select className="search" dir="ltr" value={exec.signer_backend || 'node'} onChange={(e) => setExec({ ...exec, signer_backend: e.target.value })}>
                <option value="node">node (in-process)</option><option value="rust">rust (hot-executor)</option>
              </select>
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted fs-xs">submit_backend</span>
              <select className="search" dir="ltr" value={exec.submit_backend || 'rpc'} onChange={(e) => setExec({ ...exec, submit_backend: e.target.value })}>
                <option value="rpc">rpc (sendTransaction)</option><option value="jito">jito (bundle + tip)</option>
              </select>
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted fs-xs">{ar ? 'حساب إكرامية Jito (base58)' : 'Jito tip account (base58)'}</span>
              <input className="search" dir="ltr" placeholder={ar ? 'مطلوب لـjito' : 'required for jito'} value={exec.jito_tip_account ?? ''} onChange={(e) => setExec({ ...exec, jito_tip_account: e.target.value })} />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted fs-xs">jito_tip_lamports</span>
              <input className="search" type="number" inputMode="decimal" dir="ltr" value={exec.jito_tip_lamports ?? ''} onChange={(e) => setExec({ ...exec, jito_tip_lamports: e.target.value })} />
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted fs-xs">{ar ? 'نمط التحجيم العام' : 'Global sizing mode'}</span>
              <select className="search" dir="ltr" value={exec.sizing_mode || 'fixed_usd'} onChange={(e) => setExec({ ...exec, sizing_mode: e.target.value })}>
                <option value="fixed_usd">fixed_usd</option><option value="fixed_sol">fixed_sol</option><option value="pct_of_capital">pct_of_capital</option>
              </select>
            </label>
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted fs-xs">{ar ? 'قيمة التحجيم العامة' : 'Global sizing value'}</span>
              <input className="search" type="number" inputMode="decimal" step="any" dir="ltr" value={exec.sizing_value ?? ''} onChange={(e) => setExec({ ...exec, sizing_value: e.target.value })} />
            </label>
          </div>
        </Card>
      )}

      {tab === 'activation' && (
        <Card title={t('settings.realLive')} right={
          readiness?.real_live_ready
            ? <Badge tone="warn">{ar ? 'الشروط مكتملة — بانتظار قرارك' : 'requirements met — awaiting your decision'}</Badge>
            : <Badge tone="danger">{t('app.blocked')}</Badge>
        }>
          <span className="muted">{t('settings.blockers')}:</span>
          {readiness?.blockers?.length ? (
            <ul style={{ margin: '6px 0 12px', paddingInlineStart: 18 }}>
              {readiness.blockers.map((b, i) => (
                <li key={i}>
                  <span className="mono neg">{b.blocker}</span>
                  {b.missing_limits && <span className="faint"> — {b.missing_limits.join(', ')}</span>}
                  {b.missing && <span className="faint"> — {b.missing.join(', ')}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="muted">{ar ? 'لا حواجز متبقية من جهة الإعداد.' : 'No configuration blockers remain.'}</p>}

          <DangerNote tone="danger" locked>
            {ar
              ? 'التفعيل الحقيقي قرارك أنت وحدك ويعرّض أموالاً حقيقية للخسارة. يتطلب: اكتمال كل الشروط أعلاه + كتابة ACTIVATE-REAL-LIVE حرفياً. زر الإيقاف في صفحة التنبيهات يوقف كل شيء فوراً. للرجوع للوضع الورقي: زر «إلغاء التفعيل» يظهر بعد التفعيل.'
              : 'Real activation is YOUR decision alone and puts real money at risk. Requires: every condition above met + typing ACTIVATE-REAL-LIVE literally. The kill switch on Alerts stops everything instantly. To return to paper: a deactivate button appears after activation.'}
          </DangerNote>
          <div className="row" style={{ marginBlockStart: 'var(--s-3)' }}>
            {status?.mode !== 'real_live' ? (
              <>
                <input
                  className="search" style={{ width: 220 }} dir="ltr"
                  placeholder="ACTIVATE-REAL-LIVE"
                  value={confirmLive}
                  onChange={(e) => setConfirmLive(e.target.value)}
                />
                <button className="btn" onClick={tryActivate} disabled={confirmLive !== 'ACTIVATE-REAL-LIVE'}>
                  {ar ? '🔴 تفعيل التداول الحقيقي' : '🔴 Activate REAL-LIVE'}
                </button>
              </>
            ) : (
              <button className="btn" onClick={async () => {
                await api.deactivateRealLive();
                setLiveResult(null); setConfirmLive(''); refresh();
              }}>
                {ar ? '↩ إلغاء التفعيل — عودة للوضع الورقي' : '↩ Deactivate — back to paper'}
              </button>
            )}
          </div>
          {liveResult && (
            <div style={{ marginBlockStart: 'var(--s-3)' }}>
              <Badge tone={liveResult.ok ? 'warn' : 'danger'}>{liveResult.ok ? (ar ? 'مُفعَّل — أموال حقيقية' : 'ACTIVATED — real money') : liveResult.api_error_code || 'refused'}</Badge>
              {liveResult.warning && <p className="muted" style={{ marginBlockStart: 6 }}>{liveResult.warning}</p>}
              <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
                {(liveResult.blockers || []).map((b, i) => (
                  <li key={i} className="mono fs-sm">{b.blocker}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {tab !== 'activation' && (
        <div className="settings-savebar">
          <button className="btn primary" onClick={save}>{ar ? '💾 حفظ كل الإعدادات' : '💾 Save all settings'}</button>
          {saveMsg && <Badge tone={saveMsg.tone}>{saveMsg.text}</Badge>}
          <span className="topbar-spacer" />
          {cfg && <span className="muted fs-xs">config_version: {cfg.config_version}</span>}
        </div>
      )}
    </div>
  );
}
