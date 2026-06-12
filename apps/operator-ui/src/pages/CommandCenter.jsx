import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, EmptyState, Sparkline, FlashValue } from '../components/index.jsx';
import { api } from '../api/client.js';
import { useBackend } from '../api/useBackend.jsx';

const usd = (v) => `$${Number(v ?? 0).toFixed(2)}`;
const shortMint = (m) => `${String(m).slice(0, 4)}…${String(m).slice(-4)}`;

export default function CommandCenter() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected } = useBackend();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);

  const live = status?.mode === 'real_live';
  async function load() {
    const ev = await api.engineEvents();
    if (ev.ok) setEvents((ev.data.events || []).slice().reverse());
    const p = live ? await api.livePositions() : await api.positions();
    if (p.ok) setSummary(p.data.summary || null);
  }
  useEffect(() => {
    if (!connected) return undefined;
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [connected, live]);

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('command.title')} sub={t('command.sub')} />
        <DangerNote tone="danger" locked>
          {ar ? 'الخادم المحلي غير متصل. شغّل START.bat ثم أعد تحميل الصفحة.' : 'Local server offline. Run START.bat, then reload.'}
        </DangerNote>
        <EmptyState message={ar ? 'لا بيانات بدون الخادم — لا شيء يُختلق' : 'No data without the server — nothing is fabricated'} />
      </div>
    );
  }

  const op = status.operating_state || {};
  const readiness = status.readiness || {};
  const signer = status.signer || {};
  const vault = status.vault || {};
  const ks = status.kill_switch || {};
  const engine = status.engine || {};
  const globalKill = ks.global?.engaged !== false;
  const opTone = op.operating_state === 'ACTIVE' ? 'ok' : op.operating_state === 'KILLED' ? 'danger' : 'warn';

  const steps = [
    { done: vault.vault_exists, label: ar ? 'إنشاء الخزنة المشفّرة' : 'Create the encrypted vault', to: '/funds' },
    { done: Boolean(status.config_version > 1), label: ar ? 'حفظ حدود المخاطر' : 'Save your Hard-Risk limits', to: '/settings' },
    { done: !readiness.blockers?.some((b) => b.blocker === 'rpc_provider_not_configured'), label: ar ? 'إدخال مفتاح RPC' : 'Enter your RPC key', to: '/funds' },
    { done: engine.followed_wallets > 0, label: ar ? 'متابعة محفظة رابحة' : 'Follow a winning wallet', to: '/wallets' },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="stack">
      <PageHead title={ar ? 'مركز القيادة' : 'Command Center'} sub={ar ? 'الحالة الحية للنظام من الخادم المحلي' : 'Live system state from the local server'} />

      {globalKill && (
        <DangerNote tone="danger" locked>
          {ar ? 'مفتاح الإيقاف مفعّل — كل التداول موقوف. فكّه من صفحة التنبيهات.' : 'Kill switch ENGAGED — all trading halted. Disengage from Alerts.'}
        </DangerNote>
      )}

      <div className="kpi-strip">
        <div className="stattile"><span className="lbl">{ar ? 'الحالة' : 'State'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={opTone}>{op.operating_state}</Badge></span><span className="sub">{ar ? 'الوضع' : 'mode'}: {status.mode}</span></div>
        <div className="stattile"><span className="lbl">{ar ? 'المحرّك' : 'Engine'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}>{engine.paper_engine || '—'}</span><span className="sub">{ar ? `${engine.followed_wallets ?? 0} متابَعة` : `${engine.followed_wallets ?? 0} followed`}</span></div>
        <div className="stattile">
          <span className="lbl">{ar ? 'محقّق اليوم' : 'Realized today'}</span>
          <FlashValue className={`val ${(summary?.daily_realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'}`} value={Number(summary?.daily_realized_pnl_usd ?? 0)} format={(v) => usd(v)} />
          <Sparkline seed="realized-today" tone={(summary?.daily_realized_pnl_usd ?? 0) >= 0 ? 'pos' : 'neg'} bias={(summary?.daily_realized_pnl_usd ?? 0) >= 0 ? 1 : -1} width={130} height={26} points={32} />
          <span className="sub">{summary?.open_positions ?? 0} {ar ? 'مفتوح' : 'open'}</span>
        </div>
        <div className="stattile"><span className="lbl">{ar ? 'الخزنة' : 'Vault'}</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={vault.vault_unlocked ? 'ok' : vault.vault_exists ? 'warn' : 'danger'}>{vault.vault_unlocked ? (ar ? 'مفتوحة' : 'unlocked') : vault.vault_exists ? (ar ? 'مقفلة' : 'locked') : (ar ? 'غير منشأة' : 'none')}</Badge></span></div>
        <div className="stattile"><span className="lbl">signer</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}><Badge tone={signer.signer_status === 'ready' ? 'ok' : signer.signer_status === 'missing' ? 'danger' : 'warn'}>{signer.signer_status}</Badge></span></div>
        <div className="stattile"><span className="lbl">REAL-LIVE</span><span className="val" style={{ fontSize: 'var(--fs-md)' }}>{readiness.real_live_ready ? <Badge tone="warn">{ar ? 'بانتظارك' : 'awaiting you'}</Badge> : <Badge tone="danger">{t('app.blocked')}</Badge>}</span><span className="sub">{(readiness.blockers || []).length} {ar ? 'حاجز' : 'blockers'}</span></div>
      </div>

      <div className="workspace">
        <div className="stack" style={{ gap: 'var(--s-3)' }}>
          <Card title={ar ? 'قرارات المحرك الحية' : 'Live engine decisions'}>
            {events.length === 0 ? (
              <EmptyState message={ar ? 'لا أحداث بعد — تظهر عند نشاط القادة المتابَعين' : 'No events yet — they appear when followed leaders act'} />
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 360, overflow: 'auto' }}>
                {events.slice(0, 40).map((e, i) => (
                  <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--c-border)', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span className="mono faint" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{(e.ts || '').slice(11, 19)}</span>
                    <Badge tone={e.kind?.includes('rejected') || e.kind?.includes('gap') || e.kind?.includes('refused') ? 'danger' : e.kind?.includes('exit') ? 'warn' : e.kind?.includes('entry') ? 'ok' : 'info'}>{e.kind}</Badge>
                    {e.mint && <span className="mono" dir="ltr" style={{ fontSize: 'var(--fs-xs)' }}>{shortMint(e.mint)}</span>}
                    {e.rejections && <span className="mono neg fs-xs">{e.rejections.join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="detail-pane stack" style={{ gap: 'var(--s-3)' }}>
          <Card title={<span>🚀 {ar ? 'خطوات البدء' : 'Getting started'} <span className="faint fs-sm">{doneCount}/4</span></span>}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((s, i) => (
                <li key={i} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--c-border)' }}>
                  <span><span aria-hidden style={{ marginInlineEnd: 8 }}>{s.done ? '✅' : '⬜'}</span>{s.label}</span>
                  <Link to={s.to} className="mono fs-xs">{ar ? 'اذهب ←' : 'go →'}</Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={ar ? 'حواجز التشغيل الحقيقي' : 'REAL-LIVE blockers'}>
            {(readiness.blockers || []).length === 0
              ? <p className="muted">{ar ? 'لا حواجز إعداد متبقية' : 'No configuration blockers remain'}</p>
              : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {readiness.blockers.map((b, i) => (
                    <li key={i} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--c-border)' }}>
                      <span className="mono fs-xs">{b.blocker}</span>
                      <Badge tone="danger">{ar ? 'ناقص' : 'missing'}</Badge>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </div>
      </div>
    </div>
  );
}
