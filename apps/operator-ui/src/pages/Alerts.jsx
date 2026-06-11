import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Badge, DangerNote, PreviewDisabledAction } from '../components/index.jsx';
import { ALERTS } from '../fixtures/index.js';

const SEV_TONE = { critical: 'danger', warning: 'warn', info: 'info' };
const SEVERITIES = ['all', 'critical', 'warning', 'info'];

export default function Alerts() {
  const { t } = useI18n();
  const [sev, setSev] = useState('all');
  const filtered = ALERTS.filter((a) => sev === 'all' || a.severity === sev);

  return (
    <div className="stack">
      <PageHead title={t('alerts.title')} sub={t('alerts.sub')} />

      <DangerNote tone="danger" locked>{t('alerts.cannotSilence')}</DangerNote>

      <Card
        title={t('alerts.activeAlerts')}
        right={
          <div className="seg" role="group" aria-label={t('common.severity')}>
            {SEVERITIES.map((s) => (
              <button key={s} className={sev === s ? 'on' : ''} onClick={() => setSev(s)}>
                {s === 'all' ? t('common.all') : s}
              </button>
            ))}
          </div>
        }
      >
        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          {filtered.map((a) => {
            const locked = a.severity === 'critical' || a.category === 'security';
            return (
              <div
                key={a.id}
                className={`note ${a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warn' : 'info'}`}
                role={locked ? 'alert' : 'note'}
              >
                <span className="note-ico" aria-hidden>
                  {a.severity === 'critical' ? '⛔' : a.severity === 'warning' ? '⚠' : 'ℹ'}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 'var(--s-2)' }}>
                    <Badge tone={SEV_TONE[a.severity]}>{a.severity}</Badge>
                    <Badge tone="neutral">{a.category}</Badge>
                    <span className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>{a.source}</span>
                  </div>
                  <div style={{ marginBlockStart: 4 }}>{a.message}</div>
                </div>
                {locked ? (
                  <span className="lock-tag" title={t('alerts.ackPreview')}>🔒 {t('app.simulated')}</span>
                ) : (
                  <PreviewDisabledAction label={t('alerts.acknowledge')} />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
