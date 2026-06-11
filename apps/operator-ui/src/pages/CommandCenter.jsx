import { useI18n } from '../i18n/index.jsx';
import PageHead from '../components/PageHead.jsx';
import { Card, Metric, Badge, DangerNote, StatusChip, PreviewDisabledAction, toneFor } from '../components/index.jsx';
import { SYSTEM, DECISION_TRACE, STREAM_HEALTH, READINESS, ALERTS } from '../fixtures/index.js';

export default function CommandCenter() {
  const { t } = useI18n();
  const reviewed = DECISION_TRACE.trace_entries.filter((e) => e.advanced).length;
  const total = DECISION_TRACE.trace_entries.length;
  const criticalAlerts = ALERTS.filter((a) => a.severity === 'critical');

  return (
    <div className="stack">
      <PageHead title={t('command.title')} sub={t('command.sub')} />

      <DangerNote tone="sim">{t('notice.readOnly')}</DangerNote>

      {criticalAlerts.length > 0 && (
        <DangerNote tone="danger" locked>
          <b>{criticalAlerts.length}</b> {t('common.severity').toLowerCase()} — {t('alerts.cannotSilence')}
        </DangerNote>
      )}

      <div className="grid cols-4">
        <Card title={t('command.systemStatus')}>
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            <StatusChip label={t('app.operatingState')} state={SYSTEM.operating_state} />
            <StatusChip label="protocol_constant_status" state={SYSTEM.protocol_constant_status} />
            <div className="row">
              <span className="muted">provider_degraded:</span>
              <Badge tone={SYSTEM.provider_degraded ? 'danger' : 'ok'}>{String(SYSTEM.provider_degraded)}</Badge>
            </div>
            <div className="row">
              <span className="muted">slot_lag:</span>
              <span className="mono">{SYSTEM.slot_lag} / {SYSTEM.slot_lag_max}</span>
            </div>
          </div>
        </Card>

        <Card title={t('command.pipelineHealth')}>
          <Metric label={t('command.overallOutcome')} value={<Badge tone="danger">{DECISION_TRACE.overall_outcome}</Badge>} />
          <div style={{ marginBlockStart: 'var(--s-3)' }}>
            <Metric label={t('command.uptimeStages')} value={`${reviewed} / ${total}`} mono />
          </div>
        </Card>

        <Card title="stream">
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            <StatusChip label="stream" state={STREAM_HEALTH.stream_health_state} />
            <div className="row"><span className="muted">last_seen_slot:</span><span className="mono">{STREAM_HEALTH.last_seen_slot}</span></div>
            <div className="row"><span className="muted">last_confirmed_slot:</span><span className="mono">{STREAM_HEALTH.last_confirmed_slot}</span></div>
          </div>
        </Card>

        <Card title={t('app.realLive')}>
          <Metric label="status" value={<Badge tone="danger">{t('app.blocked')}</Badge>} />
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBlockEnd: 0 }}>
            {READINESS.blockers.length} blocker(s) · prerequisite_for: <span className="mono">{READINESS.prerequisite_for}</span>
          </p>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t('command.readiness')}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {STREAM_HEALTH.readiness_checklist.map((c) => (
              <li key={c.item} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--c-border)' }}>
                <span className="mono">{c.item}</span>
                <Badge tone={toneFor(c.state)}>{c.state}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('command.alertDigest')}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {ALERTS.map((a) => (
              <li key={a.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--c-border)', gap: 'var(--s-2)' }}>
                <span>
                  <Badge tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warn' : 'info'}>{a.severity}</Badge>{' '}
                  <span className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>{a.category}</span>
                </span>
                <span className="muted" style={{ textAlign: 'end', flex: 1, minWidth: 0 }}>{a.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={t('command.criticalControls')} sub={t('command.controlsNote')}>
        <div className="row" style={{ gap: 'var(--s-4)' }}>
          <PreviewDisabledAction label="pause_system" />
          <PreviewDisabledAction label="resume_system" />
          <PreviewDisabledAction label="trigger_kill_switch" danger />
          <PreviewDisabledAction label="activate_real_live" danger />
        </div>
      </Card>
    </div>
  );
}
