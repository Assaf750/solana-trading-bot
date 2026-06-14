import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

export default function Alerts() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected, refresh } = useBackend();
  const [confirmText, setConfirmText] = useState('');
  const [msg, setMsg] = useState(null);

  async function killNow() {
    const r = await api.triggerKill('global', null, 'operator manual stop');
    setMsg(r.ok
      ? { tone: 'ok', text: ar ? 'تم الإيقاف الفوري — الموقّع مقفل والنظام KILLED' : 'Emergency stop done — signer locked, system KILLED' }
      : { tone: 'danger', text: r.data?.error || 'failed' });
    refresh();
  }

  async function disengage() {
    const r = await api.killDisengage('global', null, confirmText);
    setMsg(r.ok
      ? { tone: 'ok', text: ar ? 'فُك مفتاح الإيقاف — استأنف عبر زر الاستئناف' : 'Kill switch disengaged — resume via the resume button' }
      : { tone: 'danger', text: r.data?.error || r.data?.expected || 'failed' });
    setConfirmText('');
    refresh();
  }

  async function pause() { await api.pauseSystem(); refresh(); }
  async function resume() {
    const r = await api.resumeSystem();
    if (!r.ok) setMsg({ tone: 'danger', text: r.data?.error || (ar ? 'الاستئناف مرفوض — فُك مفتاح الإيقاف أولاً' : 'Resume refused — disengage the kill switch first') });
    refresh();
  }

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('alerts.title')} sub={t('alerts.sub')} />
        <EmptyState message={ar ? 'الخادم غير متصل — شغّل START.bat' : 'Server offline — run START.bat'} />
      </div>
    );
  }

  const ks = status?.kill_switch || {};
  const globalEngaged = ks.global?.engaged !== false;
  const opState = status?.operating_state?.operating_state;
  const signer = status?.signer || {};
  const vault = status?.vault || {};

  return (
    <div className="stack">
      <PageHead title={t('alerts.title')} sub={ar ? 'مفتاح الإيقاف والتحكم في النظام — يعمل فعلياً' : 'Kill switch & system control — fully functional'} />

      <div className="kpi-strip">
        <div className="stattile"><span className="lbl">{ar ? 'مفتاح الإيقاف' : 'Kill switch'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={globalEngaged ? 'danger' : 'ok'}>{globalEngaged ? (ar ? 'مُفعَّل' : 'ENGAGED') : (ar ? 'مرفوع' : 'off')}</Badge></span></div>
        <div className="stattile"><span className="lbl">{ar ? 'حالة التشغيل' : 'Operating'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={opState === 'ACTIVE' ? 'ok' : opState === 'KILLED' ? 'danger' : 'warn'}>{opState || '—'}</Badge></span></div>
        <div className="stattile"><span className="lbl">signer</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={signer.signer_status === 'ready' ? 'ok' : signer.signer_status === 'missing' || signer.signer_status === 'failed' ? 'danger' : 'warn'}>{signer.signer_status || '—'}</Badge></span></div>
        <div className="stattile"><span className="lbl">{ar ? 'الخزنة' : 'Vault'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={vault.vault_unlocked ? 'ok' : vault.vault_exists ? 'warn' : 'danger'}>{vault.vault_unlocked ? (ar ? 'مفتوحة' : 'unlocked') : vault.vault_exists ? (ar ? 'مقفلة' : 'locked') : (ar ? 'غير منشأة' : 'none')}</Badge></span></div>
      </div>

      <DangerNote tone="danger" locked>{t('alerts.cannotSilence')}</DangerNote>

      <Card title={ar ? '🛑 مفتاح الإيقاف (Kill Switch)' : '🛑 Kill Switch'}>
        {!globalEngaged ? (
          <div className="estop">
            <p className="muted" style={{ maxWidth: 560, margin: 0 }}>
              {ar
                ? 'زر واحد يوقف كل شيء فوراً: يقفل الموقّع، يمنع أي توقيع/إرسال، وينقل النظام إلى KILLED. حالته محفوظة — إعادة تشغيل البرنامج لا تلغيه.'
                : 'One button halts everything instantly: locks the signer, blocks all signing/sending, moves the system to KILLED. Persisted — restarting the app does not clear it.'}
            </p>
            <button className="estop-btn" onClick={killNow}>
              <span aria-hidden>⛔</span>{ar ? 'إيقاف كل شيء الآن' : 'STOP EVERYTHING NOW'}
            </button>
          </div>
        ) : (
          <div className="estop-engaged">
            <div className="estop-ring live" aria-hidden>⛔</div>
            <Badge tone="danger">{ar ? 'مُفعَّل — كل التداول موقوف' : 'ENGAGED — all trading halted'}</Badge>
            <p className="muted" style={{ maxWidth: 560, margin: 0 }}>
              {ar
                ? `مُفعَّل منذ: ${ks.global?.at || '—'} · السبب: ${ks.global?.reason || '—'}. لفكّه اكتب DISENGAGE حرفياً ثم اضغط الزر.`
                : `Engaged at: ${ks.global?.at || '—'} · reason: ${ks.global?.reason || '—'}. To disengage, type DISENGAGE literally, then click.`}
            </p>
            <div className="row">
              <input className="search" dir="ltr" style={{ width: 180 }} placeholder="DISENGAGE" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              <button className="btn" onClick={disengage} disabled={confirmText !== 'DISENGAGE'}>
                {ar ? 'فك مفتاح الإيقاف' : 'Disengage kill switch'}
              </button>
            </div>
          </div>
        )}
        {msg && <div style={{ marginBlockStart: 'var(--s-3)', textAlign: 'center' }}><Badge tone={msg.tone}>{msg.text}</Badge></div>}
      </Card>

      <Card title={ar ? '⏯ التحكم في النظام' : '⏯ System control'} right={<Badge tone={opState === 'ACTIVE' ? 'ok' : opState === 'KILLED' ? 'danger' : 'warn'}>{opState}</Badge>}>
        <div className="row">
          <button className="btn" onClick={pause} disabled={opState === 'PAUSED' || opState === 'KILLED'}>
            {ar ? '⏸ إيقاف مؤقت (لا دخول جديد)' : '⏸ Pause (no new entries)'}
          </button>
          <button className="btn" onClick={resume} disabled={opState === 'ACTIVE' || opState === 'WARMING_UP'}>
            {ar ? '▶ استئناف (عبر WARMING_UP)' : '▶ Resume (via WARMING_UP)'}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockStart: 8 }}>
          {ar
            ? 'الاستئناف بعد KILLED يتطلب فك مفتاح الإيقاف أولاً ثم الاستئناف — ويمر دائماً عبر WARMING_UP لإعادة بناء الجاهزية.'
            : 'Resuming after KILLED requires disengaging the kill switch first — and always passes through WARMING_UP to rebuild readiness.'}
        </p>
      </Card>

      <Card title={ar ? 'سجل أحداث النظام (Audit)' : 'System events (Audit)'}>
        <AuditTail ar={ar} />
      </Card>
    </div>
  );
}

function AuditTail({ ar }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    const fetchRows = async () => {
      const r = await api.audit(25);
      if (alive) setRows(r.ok ? (r.data.audit || []).slice().reverse() : []);
    };
    fetchRows();
    const iv = setInterval(fetchRows, 10000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  if (rows === null) return <p className="muted">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>;
  if (!rows.length) return <EmptyState message={ar ? 'لا أحداث بعد' : 'No events yet'} />;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className="nosort">{ar ? 'الوقت' : 'time'}</th>
            <th className="nosort">{ar ? 'السبب' : 'reason'}</th>
            <th className="nosort">command</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={a.audit_id || i}>
              <td className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{(a.event_timestamp || '').replace('T', ' ').slice(0, 19)}</td>
              <td className="mono fs-xs">{a.audit_reason}</td>
              <td className="mono faint fs-xs">{a.command_type || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
