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

export default function SettingsSafety() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected, refresh } = useBackend();
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({});
  const [capital, setCapital] = useState('');
  const [evMode, setEvMode] = useState('strict');
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
    }
  }
  useEffect(() => { if (connected) loadConfig(); }, [connected]);

  async function save() {
    setSaveMsg(null);
    const hard_risk = {};
    for (const { field } of HARD_RISK_FIELDS) {
      const v = form[field];
      hard_risk[field] = v === '' || v === null ? null : Number(v);
    }
    const patch = {
      hard_risk,
      ev: { ev_gate_mode: evMode },
      execution: { capital_limit: capital === '' ? null : Number(capital) },
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

  return (
    <div className="stack">
      <PageHead title={t('settings.title')} sub={t('settings.sub')} />

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
        </Card>

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
      </div>

      <div className="row">
        <button className="btn" onClick={save}>{ar ? '💾 حفظ الإعدادات' : '💾 Save settings'}</button>
        {saveMsg && <Badge tone={saveMsg.tone}>{saveMsg.text}</Badge>}
        {cfg && <span className="muted fs-xs">config_version: {cfg.config_version}</span>}
      </div>

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
    </div>
  );
}
