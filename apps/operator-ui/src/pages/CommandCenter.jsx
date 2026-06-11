import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Metric, Badge, DangerNote, StatusChip, EmptyState } from '../components/index.jsx';
import { useBackend } from '../api/useBackend.jsx';

export default function CommandCenter() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const { status, connected } = useBackend();

  if (!connected) {
    return (
      <div className="stack">
        <PageHead title={t('command.title')} sub={t('command.sub')} />
        <DangerNote tone="danger" locked>
          {ar
            ? 'الخادم المحلي غير متصل. شغّل START.bat في مجلد البرنامج ثم أعد تحميل هذه الصفحة.'
            : 'Local server offline. Run START.bat in the app folder, then reload this page.'}
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
  const globalKill = ks.global?.engaged !== false;
  const signerTone = { ready: 'ok', degraded: 'warn', locked: 'warn', missing: 'danger', failed: 'danger' }[signer.signer_status] || 'neutral';

  const steps = [
    { done: vault.vault_exists, label: ar ? 'إنشاء الخزنة المشفّرة' : 'Create the encrypted vault', to: '/funds' },
    { done: Boolean(status.config_version > 1), label: ar ? 'حفظ حدود المخاطر (Hard-Risk)' : 'Save your Hard-Risk limits', to: '/settings' },
    { done: !readiness.blockers?.some((b) => b.blocker === 'rpc_provider_not_configured'), label: ar ? 'إدخال مفتاح RPC' : 'Enter your RPC key', to: '/funds' },
    { done: false, label: ar ? 'تسجيل محفظة متبوعة وتفعيل المتابعة' : 'Register a tracked wallet and enable follow', to: '/wallets' },
  ];

  return (
    <div className="stack">
      <PageHead title={t('command.title')} sub={ar ? 'حالة النظام الحية من الخادم المحلي' : 'Live system state from the local server'} />

      {globalKill && (
        <DangerNote tone="danger" locked>
          {ar ? 'مفتاح الإيقاف مُفعَّل — كل التداول موقوف. فكّه من صفحة التنبيهات.' : 'Kill switch ENGAGED — all trading halted. Disengage from the Alerts page.'}
        </DangerNote>
      )}

      <div className="grid cols-4">
        <Card title={t('command.systemStatus')}>
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            <StatusChip label={t('app.operatingState')} state={op.operating_state} />
            <div className="row">
              <span className="muted">{ar ? 'الوضع' : 'mode'}:</span>
              <Badge tone={status.mode === 'real_live' ? 'danger' : 'warn'}>{status.mode}</Badge>
            </div>
            <div className="row">
              <span className="muted">{ar ? 'السبب' : 'reason'}:</span>
              <span className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{op.reason || '—'}</span>
            </div>
          </div>
        </Card>

        <Card title={ar ? 'الخزنة والموقّع' : 'Vault & Signer'}>
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            <div className="row">
              <span className="muted">vault:</span>
              <Badge tone={vault.vault_unlocked ? 'ok' : vault.vault_exists ? 'warn' : 'danger'}>
                {vault.vault_unlocked ? 'unlocked' : vault.vault_exists ? 'locked' : 'missing'}
              </Badge>
            </div>
            <div className="row">
              <span className="muted">signer:</span>
              <Badge tone={signerTone}>{signer.signer_status}</Badge>
            </div>
            <div className="row">
              <span className="muted">{ar ? 'أسرار مخزنة' : 'secrets'}:</span>
              <span className="mono">{vault.secret_count ?? 0}</span>
            </div>
          </div>
        </Card>

        <Card title={ar ? 'المحركات' : 'Engines'}>
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            <div className="row">
              <span className="muted">paper:</span>
              <Badge tone="warn">{status.engine?.paper_engine || '—'}</Badge>
            </div>
            <div className="row">
              <span className="muted">live:</span>
              <Badge tone="danger">{status.engine?.live_engine || '—'}</Badge>
            </div>
          </div>
        </Card>

        <Card title={t('app.realLive')}>
          <Metric label="status" value={
            readiness.real_live_ready
              ? <Badge tone="warn">{ar ? 'بانتظار قرارك' : 'awaiting your decision'}</Badge>
              : <Badge tone="danger">{t('app.blocked')}</Badge>
          } />
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockEnd: 0 }}>
            {(readiness.blockers || []).length} {ar ? 'حاجز متبقٍ' : 'blocker(s) remaining'}
          </p>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={ar ? '🚀 خطوات البدء' : '🚀 Getting started'}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {steps.map((s, i) => (
              <li key={i} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--c-border)' }}>
                <span>
                  <span aria-hidden style={{ marginInlineEnd: 8 }}>{s.done ? '✅' : '⬜'}</span>
                  {s.label}
                </span>
                <Link to={s.to} className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{ar ? 'اذهب ←' : 'go →'}</Link>
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
                    <span className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{b.blocker}</span>
                    <Badge tone="danger">{ar ? 'ناقص' : 'missing'}</Badge>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      </div>

      <DangerNote tone="info">
        {ar
          ? 'محرك الورق (M3) ثم المحرك الحي (M4) قيد البناء — هذه الصفحة تعرض حالة الخادم الفعلية ولا تختلق أي رقم.'
          : 'The paper engine (M3) then live engine (M4) are being built — this page shows the real server state and fabricates nothing.'}
      </DangerNote>
    </div>
  );
}
